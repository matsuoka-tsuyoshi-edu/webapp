/**
 * 音の波ラボ - 波形描画エンジン (HTML5 Canvas)
 * - 方眼グリッド（横10マス=20ms / 縦上下各4マス）
 * - センターライン（0基準線）＆目盛り表示
 * - 線形補間による滑らかな波形描画＆重ね合わせ（オーバーレイ）比較
 */
(function (global) {
  'use strict';

  const WINDOW_SECONDS = 0.020; // 表示時間窓: 20ms (横10マス → 1マス = 2ms)
  const GRID_COLS = 10;
  const GRID_HALF_ROWS = 4; // 上4マス + 下4マス = 8マス
  const BASE_PEAK = 0.44;   // audio-engine.js の正規化ピークと一致させる

  class WaveformRenderer {
    constructor(canvas, primaryColor) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.primaryColor = primaryColor;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = Math.max(100, Math.floor(rect.width));
      const h = Math.max(80, Math.floor(rect.height));

      if (this.width !== w || this.height !== h || this.dpr !== dpr) {
        this.width = w;
        this.height = h;
        this.dpr = dpr;
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
      }
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    /**
     * メイン描画
     * @param {Object} track - { waveData, ampScale, freqScale }
     * @param {Object|null} overlayTrack - 重ねて表示する上の音のデータ（任意）
     * @param {number|null} playProgress - 再生中の進捗 (0.0〜1.0)。停止時は null
     */
    render(track, overlayTrack, playProgress = null) {
      this.resize();
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.clearRect(0, 0, w, h);

      // 1. 背景＆方眼グリッド
      this._drawGrid(ctx, w, h);

      // 2. 重ね合わせ用の波形（ある場合、背面・半透明破線）
      if (overlayTrack && overlayTrack.waveData) {
        this._drawWave(ctx, w, h, overlayTrack, {
          color: 'rgba(37, 99, 235, 0.48)',
          lineWidth: 2.3,
          dashed: [7, 5]
        });
      }

      // 3. メインの波形
      if (track && track.waveData) {
        this._drawWave(ctx, w, h, track, {
          color: this.primaryColor,
          lineWidth: 2.8,
          dashed: null
        });

        // 4. 再生中のプレイヘッド（●が波の上を流れる）
        if (typeof playProgress === 'number' && playProgress >= 0 && playProgress <= 1) {
          this._drawPlayhead(ctx, w, h, track, playProgress);
        }
      }
    }

    _drawGrid(ctx, w, h) {
      const padTop = 8;
      const padBottom = 8;
      const plotH = h - padTop - padBottom;
      const centerY = padTop + plotH / 2;
      const rowHeight = plotH / (GRID_HALF_ROWS * 2);
      const colWidth = w / GRID_COLS;

      // 背景
      ctx.fillStyle = '#fafcff';
      ctx.fillRect(0, 0, w, h);

      // 縦の方眼線（10分割：1マス = 2ms）
      ctx.lineWidth = 1;
      for (let c = 1; c < GRID_COLS; c++) {
        const x = Math.round(c * colWidth) + 0.5;
        ctx.strokeStyle = c === 5 ? '#cbd5e1' : '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, h - padBottom);
        ctx.stroke();
      }

      // 横の方眼線（上下各4マス）
      for (let r = -GRID_HALF_ROWS; r <= GRID_HALF_ROWS; r++) {
        if (r === 0) continue; // センターラインは後で太めに描画
        const y = Math.round(centerY - r * rowHeight) + 0.5;
        ctx.strokeStyle = Math.abs(r) === 2 ? '#cbd5e1' : '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // センターライン（0基準線）
      const cy = Math.round(centerY) + 0.5;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.stroke();

      // 左端にマス目数のガイド数字（+4, +2, 0, -2, -4）を控えめに表示
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const labels = [4, 2, 0, -2, -4];
      for (let i = 0; i < labels.length; i++) {
        const lv = labels[i];
        const y = centerY - lv * rowHeight;
        const text = lv > 0 ? `+${lv}` : `${lv}`;
        ctx.fillText(text, 5, y);
      }
    }

    _getWaveYAtX(w, h, track, x) {
      const waveData = track.waveData;
      const samples = waveData.samples;
      const len = samples.length;
      if (!len) return h / 2;

      const padTop = 8;
      const padBottom = 8;
      const plotH = h - padTop - padBottom;
      const centerY = padTop + plotH / 2;
      const rowHeight = plotH / (GRID_HALF_ROWS * 2);

      // ampScale=1.0 のときピーク (BASE_PEAK) がちょうど「2マス分」になる係数
      const ampToPixels = (2 * rowHeight) / BASE_PEAK;
      const totalAmpPx = track.ampScale * ampToPixels;

      const startIdx = waveData.displayStartIndex || 0;
      const sampleRate = waveData.sampleRate || 44100;
      const freqScale = track.freqScale || 1.0;

      const t = (x / w) * WINDOW_SECONDS;
      const offsetSamples = t * freqScale * sampleRate;
      const rawIdx = startIdx + offsetSamples;

      // 安全な折り返し＋線形補間
      const i0 = Math.floor(rawIdx) % len;
      const i1 = (i0 + 1) % len;
      const frac = rawIdx - Math.floor(rawIdx);
      const val = samples[i0] * (1 - frac) + samples[i1] * frac;

      return centerY - val * totalAmpPx;
    }

    _drawWave(ctx, w, h, track, style) {
      const samples = track.waveData.samples;
      if (!samples || !samples.length) return;

      ctx.save();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (style.dashed) {
        ctx.setLineDash(style.dashed);
      }

      ctx.beginPath();
      const stepPx = 1.5; // 高密度かつ滑らか
      for (let x = 0; x <= w; x += stepPx) {
        const y = this._getWaveYAtX(w, h, track, x);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.restore();
    }

    _drawPlayhead(ctx, w, h, track, progress) {
      const px = Math.max(0, Math.min(w, progress * w));
      const py = this._getWaveYAtX(w, h, track, px);
      const padTop = 8;
      const padBottom = 8;

      ctx.save();

      // 現在の時間位置を示す細い縦ガイド線
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = this.primaryColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, h - padBottom);
      ctx.stroke();

      // 波の上をなぞる●の外側グロー（光輪）
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = this.primaryColor;
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.fill();

      // ●本体（白縁取り付き）
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.primaryColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  global.SoundWaveRenderer = {
    WaveformRenderer: WaveformRenderer,
    WINDOW_SECONDS: WINDOW_SECONDS
  };
})(window);
