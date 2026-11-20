/**
 * 音の波ラボ - メインアプリケーションコントローラ
 */
(function () {
  'use strict';

  const { SoundAudioEngine, PRESETS } = window.SoundWaveAudio;
  const { WaveformRenderer } = window.SoundWaveRenderer;

  const TERM_TEXTS = {
    simple: {
      subtitle: '〜音の大きさと高さを波でしらべよう〜',
      ampLabel: '波の高さ',
      ampHint: '（音の大きさ）',
      freqLabel: '波の細かさ',
      freqHint: '（音の高さ）',
      gridInfo: '方眼：よこ1マス = 0.002びょう',
      showHz: false
    },
    science: {
      subtitle: '〜振幅・振動数と音の性質の探究〜',
      ampLabel: '振幅（しんぷく）',
      ampHint: '（音の大きさ）',
      freqLabel: '振動数（しんどうすう）',
      freqHint: '（音の高さ）',
      gridInfo: '方眼：よこ1マス = 2 ms（0.002秒）',
      showHz: true
    }
  };

  const PLAY_SCAN_DURATION_MS = 2000;

  class SoundWaveApp {
    constructor() {
      this.engine = new SoundAudioEngine();
      this.termMode = 'simple'; // 'simple' | 'science'
      this.overlayEnabled = false;
      this.recordingTrackId = null;
      this.toastTimer = null;
      this.playAnim = {
        trackId: null,
        startTime: 0,
        rafId: null,
        progress: null
      };

      this.tracks = {
        a: this._createTrackState('a', '#track-a', '#2563eb', 'tuningFork440'),
        b: this._createTrackState('b', '#track-b', '#ea580c', 'tuningFork440')
      };

      this._bindGlobalEvents();
      this._bindHeaderEvents();
      this._bindCenterBarEvents();
      this._bindTrackEvents(this.tracks.a);
      this._bindTrackEvents(this.tracks.b);

      this.engine.onPlayStateChange = (trackId, isPlaying) => {
        this._updatePlayButtons(trackId, isPlaying);
      };

      this._applyTermMode();
      this._checkOrientation();
      this.renderAll();
    }

    _createTrackState(id, selector, color, initialPreset) {
      const root = document.querySelector(selector);
      const canvas = root.querySelector('[data-role="canvas"]');
      return {
        id: id,
        root: root,
        renderer: new WaveformRenderer(canvas, color),
        waveData: this.engine.createPresetData(initialPreset),
        presetValue: initialPreset,
        ampScale: 1.0,
        freqScale: 1.0,
        loop: false,
        isPlaying: false,
        els: {
          canvas: canvas,
          sourceBadge: root.querySelector('[data-role="source-badge"]'),
          hzBadge: root.querySelector('[data-role="hz-badge"]'),
          recIndicator: root.querySelector('[data-role="rec-indicator"]'),
          recText: root.querySelector('[data-role="rec-text"]'),
          recMeter: root.querySelector('[data-role="rec-meter"]'),
          btnRecord: root.querySelector('[data-action="record"]'),
          recordLabel: root.querySelector('[data-role="record-label"]'),
          selectPreset: root.querySelector('[data-action="preset"]'),
          btnPlay: root.querySelector('[data-action="play"]'),
          playIcon: root.querySelector('[data-role="play-icon"]'),
          playLabel: root.querySelector('[data-role="play-label"]'),
          sliderAmp: root.querySelector('[data-param="amp"]'),
          sliderFreq: root.querySelector('[data-param="freq"]'),
          ampVal: root.querySelector('[data-role="amp-val"]'),
          freqVal: root.querySelector('[data-role="freq-val"]'),
          chkLoop: root.querySelector('[data-action="loop"]'),
          btnReset: root.querySelector('[data-action="reset"]')
        }
      };
    }

    /* ----------------------------------------------------------------------
       iPad Safari 向け操作制限（ピンチ・スクロール無効化、縦向きブロック）
       ---------------------------------------------------------------------- */
    _bindGlobalEvents() {
      // ピンチズーム禁止（Safari固有ジェスチャーイベント）
      ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
        document.addEventListener(
          evt,
          (e) => {
            e.preventDefault();
          },
          { passive: false }
        );
      });

      // スクロール・ドラッグ移動・マルチタッチピンチ禁止（スライダー横操作は許可）
      document.addEventListener(
        'touchmove',
        (e) => {
          if (e.touches.length > 1) {
            e.preventDefault();
            return;
          }
          const target = e.target;
          if (target && target.closest && target.closest('input[type="range"]')) {
            return;
          }
          e.preventDefault();
        },
        { passive: false }
      );

      // ダブルタップによるズームを防止
      let lastTouchEnd = 0;
      document.addEventListener(
        'touchend',
        (e) => {
          const now = Date.now();
          if (now - lastTouchEnd <= 280) {
            const target = e.target;
            if (!target.closest('button, input, select, label')) {
              e.preventDefault();
            }
          }
          lastTouchEnd = now;
        },
        { passive: false }
      );

      // リサイズ＆向き変更監視
      const onLayoutChange = () => {
        this._checkOrientation();
        requestAnimationFrame(() => this.renderAll());
      };

      window.addEventListener('resize', onLayoutChange);
      window.addEventListener('orientationchange', () => {
        setTimeout(onLayoutChange, 120);
      });
    }

    _checkOrientation() {
      const overlay = document.getElementById('portrait-overlay');
      const isPortrait = window.innerHeight > window.innerWidth;

      if (isPortrait) {
        overlay.classList.add('is-portrait-forced');
        // 縦向きになったら再生や録音を安全に停止
        this.engine.stopPlayback();
        if (this.recordingTrackId) {
          this.engine.stopRecording();
        }
      } else {
        overlay.classList.remove('is-portrait-forced');
      }
    }

    /* ----------------------------------------------------------------------
       ヘッダー＆ヘルプモーダル
       ---------------------------------------------------------------------- */
    _bindHeaderEvents() {
      const segControl = document.getElementById('term-mode-control');
      segControl.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn');
        if (!btn) return;
        const mode = btn.dataset.mode;
        if (!mode || mode === this.termMode) return;

        this.termMode = mode;
        segControl.querySelectorAll('.seg-btn').forEach((b) => {
          const active = b.dataset.mode === mode;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        this._applyTermMode();
      });

      const modal = document.getElementById('help-modal');
      const btnHelp = document.getElementById('btn-help');
      const btnClose = document.getElementById('btn-close-help');

      btnHelp.addEventListener('click', () => {
        modal.classList.remove('is-hidden');
      });
      btnClose.addEventListener('click', () => {
        modal.classList.add('is-hidden');
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('is-hidden');
        }
      });
    }

    _applyTermMode() {
      const t = TERM_TEXTS[this.termMode];
      document.getElementById('app-subtitle').textContent = t.subtitle;
      document.getElementById('grid-scale-info').textContent = t.gridInfo;

      document.querySelectorAll('[data-term="amp"]').forEach((el) => (el.textContent = t.ampLabel));
      document.querySelectorAll('[data-term="amp-hint"]').forEach((el) => (el.textContent = t.ampHint));
      document.querySelectorAll('[data-term="freq"]').forEach((el) => (el.textContent = t.freqLabel));
      document.querySelectorAll('[data-term="freq-hint"]').forEach((el) => (el.textContent = t.freqHint));

      this._updateTrackReadouts(this.tracks.a);
      this._updateTrackReadouts(this.tracks.b);
    }

    /* ----------------------------------------------------------------------
       中央バー（コピー＆重ねて表示）
       ---------------------------------------------------------------------- */
    _bindCenterBarEvents() {
      const btnCopy = document.getElementById('btn-copy-a-to-b');
      btnCopy.addEventListener('click', () => {
        this._copyAToB();
      });

      const chkOverlay = document.getElementById('chk-overlay');
      chkOverlay.addEventListener('change', (e) => {
        this.overlayEnabled = e.target.checked;
        this.renderTrack('b');
        this.showToast(
          this.overlayEnabled
            ? '下のグラフに上の波を重ねて表示したよ！'
            : '重ね表示をオフにしたよ'
        );
      });
    }

    _copyAToB() {
      const a = this.tracks.a;
      const b = this.tracks.b;

      if (this.engine.activeTrackId === 'b') {
        this.engine.stopPlayback();
      }

      // 波形データとパラメータを複製
      b.waveData = {
        sourceType: a.waveData.sourceType,
        presetId: a.waveData.presetId,
        label: a.waveData.label,
        sampleRate: a.waveData.sampleRate,
        samples: new Float32Array(a.waveData.samples),
        displayStartIndex: a.waveData.displayStartIndex,
        baseFreq: a.waveData.baseFreq
      };
      b.presetValue = a.presetValue;
      b.ampScale = a.ampScale;
      b.freqScale = a.freqScale;

      // UI同期
      b.els.sliderAmp.value = String(b.ampScale);
      b.els.sliderFreq.value = String(b.freqScale);
      if (a.waveData.sourceType === 'preset' && a.presetValue) {
        b.els.selectPreset.value = a.presetValue;
      }

      this._updateTrackReadouts(b);
      this.renderTrack('b');
      this.showToast('上の音を下にコピーしたよ！下のスライダーで変えてみよう');
    }

    /* ----------------------------------------------------------------------
       各トラックの操作イベント
       ---------------------------------------------------------------------- */
    _bindTrackEvents(track) {
      const { els } = track;

      // 録音ボタン
      els.btnRecord.addEventListener('click', () => {
        if (this.recordingTrackId === track.id) {
          this.engine.stopRecording();
        } else {
          this._startTrackRecording(track);
        }
      });

      // プリセット選択
      els.selectPreset.addEventListener('change', (e) => {
        const presetId = e.target.value;
        if (!PRESETS[presetId]) return;

        if (this.engine.activeTrackId === track.id) {
          this.engine.stopPlayback();
        }

        track.presetValue = presetId;
        track.waveData = this.engine.createPresetData(presetId);
        this._updateTrackReadouts(track);
        this.renderAll();
      });

      // 再生 / 停止ボタン
      els.btnPlay.addEventListener('click', () => {
        if (this.recordingTrackId) {
          this.engine.stopRecording();
        }
        if (track.isPlaying) {
          this.engine.stopPlayback();
        } else {
          this.engine.play(track.id, track.waveData, track.ampScale, track.freqScale, track.loop);
        }
      });

      // 振幅スライダー
      els.sliderAmp.addEventListener('input', (e) => {
        track.ampScale = parseFloat(e.target.value);
        this._updateTrackReadouts(track);
        this.engine.updatePlayingParams(track.id, track.ampScale, track.freqScale);
        this._renderAffectedBy(track.id);
      });

      // 振動数スライダー
      els.sliderFreq.addEventListener('input', (e) => {
        track.freqScale = parseFloat(e.target.value);
        this._updateTrackReadouts(track);
        this.engine.updatePlayingParams(track.id, track.ampScale, track.freqScale);
        this._renderAffectedBy(track.id);
      });

      // くり返し再生
      els.chkLoop.addEventListener('change', (e) => {
        track.loop = e.target.checked;
        this.engine.updateLoopTimer(track.id, track.loop);
      });

      // もとに戻すボタン
      els.btnReset.addEventListener('click', () => {
        track.ampScale = 1.0;
        track.freqScale = 1.0;
        els.sliderAmp.value = '1';
        els.sliderFreq.value = '1';
        this._updateTrackReadouts(track);
        this.engine.updatePlayingParams(track.id, track.ampScale, track.freqScale);
        this._renderAffectedBy(track.id);
      });
    }

    _startTrackRecording(track) {
      if (this.recordingTrackId) {
        this.engine.stopRecording();
      }

      this.recordingTrackId = track.id;
      this._setRecordingUI(track, true);

      this.engine.startRecording({
        onProgress: (level, remainSec) => {
          track.els.recMeter.style.width = `${Math.round(level * 100)}%`;
          track.els.recText.textContent = `録音中… 音を出してね（あと ${remainSec.toFixed(1)}秒）`;
        },
        onComplete: (recordedWave) => {
          this.recordingTrackId = null;
          this._setRecordingUI(track, false);

          track.waveData = recordedWave;
          track.ampScale = 1.0;
          track.freqScale = 1.0;
          track.els.sliderAmp.value = '1';
          track.els.sliderFreq.value = '1';

          this._updateTrackReadouts(track);
          this._renderAffectedBy(track.id);
          this.showToast('録音できたよ！波の形を見てみよう');
        },
        onError: (msg) => {
          this.recordingTrackId = null;
          this._setRecordingUI(track, false);
          this.showToast(msg, 3600);
        }
      });
    }

    _setRecordingUI(track, isRec) {
      track.els.btnRecord.classList.toggle('is-recording', isRec);
      track.els.recordLabel.textContent = isRec ? 'とめる' : '録音する';
      track.els.recIndicator.classList.toggle('is-hidden', !isRec);
      if (!isRec) {
        track.els.recMeter.style.width = '0%';
      }
    }

    _updatePlayButtons(activeTrackId, isPlaying) {
      ['a', 'b'].forEach((id) => {
        const tr = this.tracks[id];
        const playingThis = id === activeTrackId && isPlaying;
        tr.isPlaying = playingThis;
        tr.els.btnPlay.classList.toggle('is-playing', playingThis);
        tr.els.playIcon.textContent = playingThis ? '■' : '▶';
        tr.els.playLabel.textContent = playingThis ? 'とめる' : '音を聞く';
      });

      if (isPlaying && activeTrackId) {
        this._startPlayAnimation(activeTrackId);
      } else {
        this._stopPlayAnimation();
      }
    }

    _startPlayAnimation(trackId) {
      this._stopPlayAnimation();

      this.playAnim.trackId = trackId;
      this.playAnim.startTime = performance.now();
      this.playAnim.progress = 0;

      const tick = (now) => {
        if (this.playAnim.trackId !== trackId) return;
        const tr = this.tracks[trackId];
        const elapsed = now - this.playAnim.startTime;
        this.playAnim.progress = tr.loop
          ? (elapsed % PLAY_SCAN_DURATION_MS) / PLAY_SCAN_DURATION_MS
          : Math.min(1, elapsed / PLAY_SCAN_DURATION_MS);

        this.renderTrack(trackId);
        this.playAnim.rafId = requestAnimationFrame(tick);
      };

      this.playAnim.rafId = requestAnimationFrame(tick);
    }

    _stopPlayAnimation() {
      if (this.playAnim.rafId !== null) {
        cancelAnimationFrame(this.playAnim.rafId);
        this.playAnim.rafId = null;
      }
      const prevId = this.playAnim.trackId;
      this.playAnim.trackId = null;
      this.playAnim.progress = null;
      if (prevId) {
        this.renderTrack(prevId);
      } else {
        this.renderAll();
      }
    }

    _updateTrackReadouts(track) {
      const { els, waveData, ampScale, freqScale } = track;
      const showHz = TERM_TEXTS[this.termMode].showHz;

      els.sourceBadge.textContent = waveData.label;
      els.ampVal.textContent = `×${ampScale.toFixed(1)}`;

      if (showHz) {
        if (waveData.baseFreq) {
          const estHz = Math.round(waveData.baseFreq * freqScale);
          els.freqVal.textContent = `×${freqScale.toFixed(1)}（約 ${estHz} Hz）`;
          els.hzBadge.textContent = `約 ${estHz} Hz`;
        } else {
          els.freqVal.textContent = `×${freqScale.toFixed(1)}`;
          els.hzBadge.textContent = '--- Hz';
        }
        els.hzBadge.classList.remove('is-hidden');
      } else {
        els.freqVal.textContent = `×${freqScale.toFixed(1)}`;
        els.hzBadge.classList.add('is-hidden');
      }
    }

    _renderAffectedBy(trackId) {
      this.renderTrack(trackId);
      if (trackId === 'a' && this.overlayEnabled) {
        this.renderTrack('b');
      }
    }

    renderTrack(trackId) {
      const tr = this.tracks[trackId];
      const overlay = trackId === 'b' && this.overlayEnabled ? this.tracks.a : null;
      const progress = this.playAnim.trackId === trackId ? this.playAnim.progress : null;
      tr.renderer.render(tr, overlay, progress);
    }

    renderAll() {
      this.renderTrack('a');
      this.renderTrack('b');
    }

    showToast(message, durationMs = 2400) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.remove('is-hidden');
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        toast.classList.add('is-hidden');
      }, durationMs);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.__soundWaveApp = new SoundWaveApp();
  });
})();
