/**
 * 音の波ラボ - オーディオエンジン (Web Audio API)
 * - 外部ファイル不使用・数式によるプリセット波形生成
 * - iPad Safari対応 マイク録音＆安定区間抽出
 * - ゼロクロス位相合わせ・自己相関ピッチ推定・リアルタイム再生
 */
(function (global) {
  'use strict';

  const SAMPLE_RATE = 44100;
  const BASE_PEAK = 0.44; // ampScale=2.0 でも 0.88 に収まりクリップしない安全値
  const MAX_RECORD_SECONDS = 2.5;

  const PRESETS = {
    tuningFork440: {
      id: 'tuningFork440',
      label: '音叉（ふつう）440Hz',
      shortLabel: '音叉 440Hz',
      baseFreq: 440
    },
    tuningFork220: {
      id: 'tuningFork220',
      label: '音叉（ひくい）220Hz',
      shortLabel: '音叉 220Hz',
      baseFreq: 220
    },
    recorder440: {
      id: 'recorder440',
      label: 'リコーダーの音',
      shortLabel: 'リコーダー',
      baseFreq: 440
    },
    voiceA: {
      id: 'voiceA',
      label: '人の声「あー」',
      shortLabel: '声「あー」',
      baseFreq: 220
    }
  };

  class SoundAudioEngine {
    constructor() {
      this.ctx = null;
      this.activeSource = null;
      this.activeGain = null;
      this.activeStopTimer = null;
      this.activeTrackId = null;
      this.onPlayStateChange = null;

      this.recordingState = null;
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) {
          throw new Error('お使いのブラウザは音声機能に対応していません。');
        }
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        return this.ctx.resume();
      }
      return Promise.resolve();
    }

    /**
     * プリセット音源データを数式から生成して返す（1.0秒間の完全周期バッファ）
     */
    createPresetData(presetId) {
      const meta = PRESETS[presetId] || PRESETS.tuningFork440;
      const length = SAMPLE_RATE; // 1.0秒（220Hz・440Hzともに整数周期）
      const samples = new Float32Array(length);
      const twoPi = Math.PI * 2;

      for (let i = 0; i < length; i++) {
        const t = i / SAMPLE_RATE;
        let v = 0;

        if (meta.id === 'tuningFork440') {
          v = Math.sin(twoPi * 440 * t);
        } else if (meta.id === 'tuningFork220') {
          v = Math.sin(twoPi * 220 * t);
        } else if (meta.id === 'recorder440') {
          // 柔らかい倍音構成（リコーダー風）
          v =
            1.0 * Math.sin(twoPi * 440 * t) +
            0.28 * Math.sin(twoPi * 880 * t + 0.2) +
            0.14 * Math.sin(twoPi * 1320 * t) +
            0.05 * Math.sin(twoPi * 1760 * t);
        } else if (meta.id === 'voiceA') {
          // 人の声「あ」の疑似フォルマント合成（基音220Hz）
          v =
            0.55 * Math.sin(twoPi * 220 * t) +
            0.45 * Math.sin(twoPi * 440 * t + 0.3) +
            0.72 * Math.sin(twoPi * 660 * t + 0.6) +
            0.48 * Math.sin(twoPi * 880 * t + 0.9) +
            0.22 * Math.sin(twoPi * 1100 * t + 0.4) +
            0.12 * Math.sin(twoPi * 1320 * t);
        }
        samples[i] = v;
      }

      this._normalizePeak(samples, BASE_PEAK);
      const zeroCrossIndex = this._findRisingZeroCross(samples, 0, Math.floor(SAMPLE_RATE * 0.05));

      return {
        sourceType: 'preset',
        presetId: meta.id,
        label: meta.shortLabel,
        sampleRate: SAMPLE_RATE,
        samples: samples,
        displayStartIndex: zeroCrossIndex,
        baseFreq: meta.baseFreq
      };
    }

    /**
     * マイク録音開始
     */
    async startRecording({ onProgress, onComplete, onError }) {
      if (this.recordingState) {
        this.stopRecording();
      }
      this.stopPlayback();

      try {
        await this.ensureContext();
      } catch (err) {
        onError && onError('音声の準備ができませんでした。');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        onError && onError('このブラウザや接続ではマイク録音を使えません。サンプル音源を試してみよう！');
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e2) {
          onError && onError('マイクの使用が許可されませんでした。右のサンプル音源をえらんで実験できます。');
          return;
        }
      }

      const actualRate = this.ctx.sampleRate || SAMPLE_RATE;
      const source = this.ctx.createMediaStreamSource(stream);
      const processor = this.ctx.createScriptProcessor(2048, 1, 1);
      const muteGain = this.ctx.createGain();
      muteGain.gain.value = 0;

      const chunks = [];
      let totalSamples = 0;
      const maxSamples = Math.floor(actualRate * MAX_RECORD_SECONDS);
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;

        try {
          processor.disconnect();
          source.disconnect();
          muteGain.disconnect();
        } catch (_) {}

        stream.getTracks().forEach((t) => t.stop());
        this.recordingState = null;

        const merged = this._mergeChunks(chunks, totalSamples);
        const processed = this._processRecordedBuffer(merged, actualRate);
        if (!processed) {
          onError && onError('音が小さすぎて波がとれませんでした。もう少し大きく音を出して録音してね！');
          return;
        }
        onComplete && onComplete(processed);
      };

      processor.onaudioprocess = (ev) => {
        if (finished) return;
        const input = ev.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        chunks.push(copy);
        totalSamples += copy.length;

        let sumSq = 0;
        for (let i = 0; i < copy.length; i++) {
          sumSq += copy[i] * copy[i];
        }
        const rms = Math.sqrt(sumSq / copy.length);
        const elapsed = totalSamples / actualRate;
        const remain = Math.max(0, MAX_RECORD_SECONDS - elapsed);

        if (onProgress) {
          onProgress(Math.min(1, rms * 4.5), remain);
        }

        if (totalSamples >= maxSamples) {
          finish();
        }
      };

      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(this.ctx.destination);

      this.recordingState = { stop: finish };
    }

    stopRecording() {
      if (this.recordingState) {
        this.recordingState.stop();
      }
    }

    /**
     * 音声再生（ワンショット約2秒、またはループ）
     */
    async play(trackId, waveData, ampScale, freqScale, loop) {
      if (!waveData || !waveData.samples || waveData.samples.length === 0) return;

      this.stopPlayback(true);
      await this.ensureContext();

      const buffer = this.ctx.createBuffer(1, waveData.samples.length, waveData.sampleRate);
      buffer.getChannelData(0).set(waveData.samples);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.setValueAtTime(Math.max(0.25, freqScale), this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      // クリック音防止のためごく短時間（10ms）で立ち上げ
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.max(0, ampScale), now + 0.012);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(now);

      this.activeSource = source;
      this.activeGain = gain;
      this.activeTrackId = trackId;

      if (this.onPlayStateChange) {
        this.onPlayStateChange(trackId, true);
      }

      if (!loop) {
        this.activeStopTimer = setTimeout(() => {
          this.stopPlayback();
        }, 2000);
      }
    }

    /**
     * 再生中にスライダーが動かされたときリアルタイムに音量・音程を更新
     */
    updatePlayingParams(trackId, ampScale, freqScale) {
      if (!this.ctx || this.activeTrackId !== trackId || !this.activeSource || !this.activeGain) {
        return;
      }
      const now = this.ctx.currentTime;
      this.activeGain.gain.setTargetAtTime(Math.max(0, ampScale), now, 0.015);
      this.activeSource.playbackRate.setTargetAtTime(Math.max(0.25, freqScale), now, 0.015);
    }

    /**
     * ループ設定が再生中に変更された場合
     */
    updateLoopTimer(trackId, loop) {
      if (this.activeTrackId !== trackId) return;
      if (this.activeStopTimer) {
        clearTimeout(this.activeStopTimer);
        this.activeStopTimer = null;
      }
      if (!loop) {
        this.activeStopTimer = setTimeout(() => {
          this.stopPlayback();
        }, 2000);
      }
    }

    stopPlayback(silentNotify = false) {
      if (this.activeStopTimer) {
        clearTimeout(this.activeStopTimer);
        this.activeStopTimer = null;
      }

      const prevTrackId = this.activeTrackId;
      const src = this.activeSource;
      const gain = this.activeGain;

      this.activeSource = null;
      this.activeGain = null;
      this.activeTrackId = null;

      if (src && gain && this.ctx) {
        try {
          const now = this.ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0.0001, now + 0.02);
          src.stop(now + 0.025);
        } catch (_) {
          try { src.stop(); } catch (__) {}
        }
      }

      if (!silentNotify && prevTrackId && this.onPlayStateChange) {
        this.onPlayStateChange(prevTrackId, false);
      }
    }

    /* ----------------------------------------------------------------------
       内部オーディオ解析ヘルパー
       ---------------------------------------------------------------------- */
    _mergeChunks(chunks, totalLength) {
      const result = new Float32Array(totalLength);
      let offset = 0;
      for (let i = 0; i < chunks.length; i++) {
        result.set(chunks[i], offset);
        offset += chunks[i].length;
      }
      return result;
    }

    _processRecordedBuffer(rawSamples, sampleRate) {
      if (rawSamples.length < sampleRate * 0.15) return null;

      // DCオフセット除去
      let mean = 0;
      for (let i = 0; i < rawSamples.length; i++) mean += rawSamples[i];
      mean /= rawSamples.length;
      for (let i = 0; i < rawSamples.length; i++) rawSamples[i] -= mean;

      // 最大ピーク確認
      let maxAbs = 0;
      for (let i = 0; i < rawSamples.length; i++) {
        const a = Math.abs(rawSamples[i]);
        if (a > maxAbs) maxAbs = a;
      }
      if (maxAbs < 0.012) {
        return null; // ほぼ無音
      }

      // 最も安定した大きい区間（約0.6秒、または全体が短ければそれ以下）をRMSスライディングで探索
      const clipLen = Math.min(rawSamples.length, Math.floor(sampleRate * 0.65));
      const winStep = Math.floor(sampleRate * 0.02);
      const rmsWin = Math.floor(sampleRate * 0.08);

      let bestPeakCenter = Math.floor(rawSamples.length / 2);
      let bestRms = -1;

      for (let start = 0; start + rmsWin < rawSamples.length; start += winStep) {
        let sum = 0;
        for (let j = 0; j < rmsWin; j++) {
          const s = rawSamples[start + j];
          sum += s * s;
        }
        const rms = sum / rmsWin;
        if (rms > bestRms) {
          bestRms = rms;
          bestPeakCenter = start + Math.floor(rmsWin / 2);
        }
      }

      let clipStart = Math.max(0, bestPeakCenter - Math.floor(clipLen / 2));
      if (clipStart + clipLen > rawSamples.length) {
        clipStart = Math.max(0, rawSamples.length - clipLen);
      }

      const clip = rawSamples.slice(clipStart, clipStart + clipLen);
      this._normalizePeak(clip, BASE_PEAK);

      // クリップ両端を少しクロスフェード整形（ループ再生時のクリック軽減）
      const fadeSamples = Math.min(Math.floor(sampleRate * 0.025), Math.floor(clip.length / 6));
      for (let i = 0; i < fadeSamples; i++) {
        const w = i / fadeSamples;
        clip[i] *= w;
        clip[clip.length - 1 - i] *= w;
      }

      // 波形描画開始点（中心付近でゼロクロス）
      const searchStart = Math.floor(clip.length * 0.35);
      const searchEnd = Math.min(clip.length - Math.floor(sampleRate * 0.05), searchStart + Math.floor(sampleRate * 0.08));
      const displayStartIndex = this._findRisingZeroCross(clip, searchStart, Math.max(searchStart + 1, searchEnd));

      // 自己相関による基本周波数推定
      const estFreq = this._estimatePitch(clip, sampleRate, displayStartIndex);

      return {
        sourceType: 'mic',
        presetId: null,
        label: 'マイク録音',
        sampleRate: sampleRate,
        samples: clip,
        displayStartIndex: displayStartIndex,
        baseFreq: estFreq
      };
    }

    _normalizePeak(samples, targetPeak) {
      let maxVal = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = Math.abs(samples[i]);
        if (a > maxVal) maxVal = a;
      }
      if (maxVal > 0.00001) {
        const ratio = targetPeak / maxVal;
        for (let i = 0; i < samples.length; i++) {
          samples[i] *= ratio;
        }
      }
    }

    _findRisingZeroCross(samples, startIdx, endIdx) {
      const limit = Math.min(samples.length - 1, endIdx);
      for (let i = Math.max(1, startIdx); i < limit; i++) {
        if (samples[i - 1] <= 0 && samples[i] > 0) {
          return i;
        }
      }
      return Math.max(0, startIdx);
    }

    /**
     * 自己相関法で基本周波数を推定 (75Hz 〜 1200Hz)
     */
    _estimatePitch(samples, sampleRate, startOffset) {
      const analysisLen = Math.min(2048, samples.length - startOffset);
      if (analysisLen < 512) return null;

      const minLag = Math.floor(sampleRate / 1200);
      const maxLag = Math.min(Math.floor(analysisLen / 2), Math.floor(sampleRate / 75));
      if (maxLag <= minLag) return null;

      let energy = 0;
      for (let i = 0; i < analysisLen; i++) {
        const v = samples[startOffset + i];
        energy += v * v;
      }
      if (energy < 0.001) return null;

      let bestLag = -1;
      let bestCorr = 0;

      for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        let normA = 0;
        let normB = 0;
        const limit = analysisLen - lag;
        for (let i = 0; i < limit; i++) {
          const a = samples[startOffset + i];
          const b = samples[startOffset + i + lag];
          sum += a * b;
          normA += a * a;
          normB += b * b;
        }
        const denom = Math.sqrt(normA * normB);
        const corr = denom > 0 ? sum / denom : 0;
        if (corr > bestCorr) {
          bestCorr = corr;
          bestLag = lag;
        }
      }

      if (bestLag > 0 && bestCorr > 0.55) {
        return Math.round(sampleRate / bestLag);
      }
      return null;
    }
  }

  global.SoundWaveAudio = {
    PRESETS: PRESETS,
    SoundAudioEngine: SoundAudioEngine
  };
})(window);
