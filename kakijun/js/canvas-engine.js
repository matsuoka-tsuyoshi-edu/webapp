/**
 * 手書きキャンバスエンジン
 * - 高DPI対応（iPad Retina）
 * - 点線十字 ＋ 濃度調整可能な薄い灰色ガイド文字
 * - 開始点「●」＆ 指の少し先を走る先導ガイドアニメーション
 * - お手本アニメーション再生 & 縮小サムネイル出力
 */
(function (global) {
  'use strict';

  const Kakijun = (global.Kakijun = global.Kakijun || {});

  // ①赤 ②青 ③緑 ④黄 ⑤紫 ⑥以降すべて灰色
  const STROKE_RGB = [
    [239, 68, 68],   // 1画目: 赤
    [59, 130, 246],  // 2画目: 青
    [34, 197, 94],   // 3画目: 緑
    [234, 179, 8],   // 4画目: 黄色
    [168, 85, 247],  // 5画目: 紫
    [148, 163, 184]  // 6画目以降: 灰色
  ];

  function getStrokeRgb(idx) {
    return STROKE_RGB[Math.min(idx, STROKE_RGB.length - 1)];
  }

  function getStrokeRgba(idx, alpha) {
    const rgb = getStrokeRgb(idx);
    return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + alpha + ')';
  }

  function getStrokeColor(idx) {
    return getStrokeRgba(idx, 1);
  }

  function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function strokeLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += dist(pts[i - 1], pts[i]);
    }
    return len;
  }

  /**
   * ポリラインを密に補間（先導ガイドの滑らかな追従用）
   */
  function densifyStroke(pts, count) {
    if (!pts || pts.length === 0) return [];
    if (pts.length === 1) return [pts[0]];
    if (Kakijun.Recognizer && Kakijun.Recognizer.resample) {
      return Kakijun.Recognizer.resample(pts, count || 64);
    }
    return pts;
  }

  /**
   * 滑らかな二次ベジェ曲線でストロークを描画（座標はキャンバスpx）
   */
  function strokeSmoothPolyline(ctx, pts, scaleX, scaleY) {
    if (!pts || pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * scaleX, pts[0][1] * scaleY);
    if (pts.length === 1) {
      ctx.lineTo(pts[0][0] * scaleX + 0.1, pts[0][1] * scaleY + 0.1);
    } else if (pts.length === 2) {
      ctx.lineTo(pts[1][0] * scaleX, pts[1][1] * scaleY);
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = ((pts[i][0] + pts[i + 1][0]) * 0.5) * scaleX;
        const my = ((pts[i][1] + pts[i + 1][1]) * 0.5) * scaleY;
        ctx.quadraticCurveTo(pts[i][0] * scaleX, pts[i][1] * scaleY, mx, my);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last[0] * scaleX, last[1] * scaleY);
    }
    ctx.stroke();
  }

  class HandwritingCanvas {
    constructor(guideCanvas, drawCanvas, options) {
      this.guideCanvas = guideCanvas;
      this.drawCanvas = drawCanvas;
      this.gCtx = guideCanvas.getContext('2d');
      this.dCtx = drawCanvas.getContext('2d');

      this.opts = Object.assign({
        onStrokeComplete: null,
        onChange: null,
        onDemoChange: null
      }, options || {});

      this.logicalSize = 300;
      this.dpr = Math.min(global.devicePixelRatio || 1, 2);

      this.targetChar = '';
      this.guideMode = true;
      this.guideOpacity = 0.34; // 0 = なし, 0.15 = 2回目より薄い, 0.34 = 1回目うすい
      this.showStartDot = true;
      this.showLeadGuide = true;
      this.locked = false;
      this.demoMode = false;

      this.userStrokes = []; // 正規化 0〜100 座標の配列
      this.currentStroke = null;
      this.activePointerId = null;

      // 先導ガイド用の進捗状態
      this.denseTemplate = [];
      this.leadProgressIdx = 0;
      this.leadTracking = false;

      this.pulseAnimId = null;
      this.demoAnimId = null;
      this.pulsePhase = 0;

      this._bindEvents();
      this.resize();
    }

    resize() {
      const rect = this.drawCanvas.getBoundingClientRect();
      const size = Math.max(180, Math.round(rect.width || 300));
      this.logicalSize = size;
      this.dpr = Math.min(global.devicePixelRatio || 1, 2);

      [this.guideCanvas, this.drawCanvas].forEach((c) => {
        c.width = Math.round(size * this.dpr);
        c.height = Math.round(size * this.dpr);
      });

      this.renderGuide();
      this.renderUserStrokes();
    }

    setConfig(cfg) {
      if (cfg.targetChar !== undefined) this.targetChar = cfg.targetChar;
      if (cfg.guideMode !== undefined) this.guideMode = cfg.guideMode;
      if (cfg.guideOpacity !== undefined) this.guideOpacity = cfg.guideOpacity;
      if (cfg.showStartDot !== undefined) this.showStartDot = cfg.showStartDot;
      if (cfg.showLeadGuide !== undefined) this.showLeadGuide = cfg.showLeadGuide;
      if (cfg.locked !== undefined) this.locked = cfg.locked;

      this._rebuildDenseTemplate();
      this.renderGuide();
    }

    _rebuildDenseTemplate() {
      const tmpl = (Kakijun.STROKES && Kakijun.STROKES[this.targetChar]) || null;
      if (!tmpl) {
        this.denseTemplate = [];
        return;
      }
      this.denseTemplate = tmpl.strokes.map(function (st) {
        return densifyStroke(st, 64);
      });
    }

    reset() {
      this.stopDemo();
      this.userStrokes = [];
      this.currentStroke = null;
      this.activePointerId = null;
      this.leadTracking = false;
      this.leadProgressIdx = 0;
      this.locked = false;
      this.renderGuide();
      this.renderUserStrokes();
      if (this.opts.onChange) this.opts.onChange(this.userStrokes);
    }

    undo() {
      if (this.locked || this.userStrokes.length === 0) return;
      this.userStrokes.pop();
      this.leadTracking = false;
      this.leadProgressIdx = 0;
      this.renderGuide();
      this.renderUserStrokes();
      if (this.opts.onChange) this.opts.onChange(this.userStrokes);
    }

    getStrokes() {
      return this.userStrokes.map(function (st) {
        return st.map(function (p) { return [p[0], p[1]]; });
      });
    }

    hasDrawing() {
      return this.userStrokes.length > 0;
    }

    startPulse() {
      if (this.pulseAnimId) return;
      const self = this;
      const tick = function () {
        self.pulsePhase += 0.08;
        self.renderGuide();
        self.pulseAnimId = global.requestAnimationFrame(tick);
      };
      this.pulseAnimId = global.requestAnimationFrame(tick);
    }

    stopPulse() {
      if (this.pulseAnimId) {
        global.cancelAnimationFrame(this.pulseAnimId);
        this.pulseAnimId = null;
      }
    }

    /**
     * ガイドレイヤー描画（点線十字 ＋ 薄い見本 ＋ ● ＋ 先導ガイド）
     */
    renderGuide() {
      const self = this;
      const ctx = this.gCtx;
      const s = this.logicalSize;
      const scale = s / 100;

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);

      // 1. 点線の十字
      ctx.save();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(s / 2, 10);
      ctx.lineTo(s / 2, s - 10);
      ctx.moveTo(10, s / 2);
      ctx.lineTo(s - 10, s / 2);
      ctx.stroke();
      ctx.restore();

      const tmpl = (Kakijun.STROKES && Kakijun.STROKES[this.targetChar]) || null;
      if (!tmpl) {
        ctx.restore();
        return;
      }

      // 2. なぞり書き用カラー見本文字（①赤 ②青 ③緑 ④黄 ⑤紫 ⑥以降灰、2回目はより薄く）
      if (this.guideOpacity > 0) {
        ctx.save();
        ctx.lineWidth = Math.max(14, s * 0.065);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        tmpl.strokes.forEach(function (st, idx) {
          ctx.strokeStyle = getStrokeRgba(idx, self.guideOpacity);
          strokeSmoothPolyline(ctx, st, scale, scale);
        });
        ctx.restore();
      }

      // 3. ガイドモード：開始点「●」と先導ガイド
      const nextIdx = this.userStrokes.length;
      if (this.guideMode && !this.locked && !this.demoMode && nextIdx < tmpl.strokes.length) {
        const denseSt = this.denseTemplate[nextIdx] || tmpl.strokes[nextIdx];
        const startPt = denseSt[0];

        // 今の画をまだ書き始めていないとき：開始点に「●」を脈打ち表示（画ごとの色）
        if (this.showStartDot && !this.currentStroke) {
          const pulse = 1 + Math.sin(this.pulsePhase) * 0.14;
          const baseR = Math.max(11, s * 0.042);
          const strokeColor = getStrokeColor(nextIdx);

          // 外側のやわらかい輪
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = strokeColor;
          ctx.beginPath();
          ctx.arc(startPt[0] * scale, startPt[1] * scale, baseR * 1.55 * pulse, 0, Math.PI * 2);
          ctx.fill();

          // 内側の「●」
          ctx.globalAlpha = 1.0;
          ctx.fillStyle = strokeColor;
          ctx.beginPath();
          ctx.arc(startPt[0] * scale, startPt[1] * scale, baseR, 0, Math.PI * 2);
          ctx.fill();

          // 番号（何画目か）
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold ' + Math.round(baseR * 1.15) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(nextIdx + 1), startPt[0] * scale, startPt[1] * scale + 0.5);
          ctx.restore();
        }

        // 指を置いて動かしている最中：少し先を走る先導ガイド
        if (this.showLeadGuide && this.currentStroke && this.leadTracking && denseSt.length > 1) {
          const leadOffset = Math.max(5, Math.round(denseSt.length * 0.15));
          const leadIdx = Math.min(denseSt.length - 1, this.leadProgressIdx + leadOffset);
          const leadPt = denseSt[leadIdx];

          // 進む道のりを少し明るくハイライト
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = Math.max(10, s * 0.045);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          strokeSmoothPolyline(ctx, denseSt.slice(this.leadProgressIdx, leadIdx + 1), scale, scale);
          ctx.restore();

          // 先導マーカー（光る青い●）
          const r = Math.max(9, s * 0.036);
          ctx.save();
          ctx.fillStyle = 'rgba(14, 165, 233, 0.28)';
          ctx.beginPath();
          ctx.arc(leadPt[0] * scale, leadPt[1] * scale, r * 1.65, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(leadPt[0] * scale, leadPt[1] * scale, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(leadPt[0] * scale - r * 0.25, leadPt[1] * scale - r * 0.25, r * 0.28, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    }

    /**
     * ユーザーが描いた軌跡レイヤーを描画
     */
    renderUserStrokes() {
      const ctx = this.dCtx;
      const s = this.logicalSize;
      const scale = s / 100;

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = Math.max(14, s * 0.062);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      this.userStrokes.forEach(function (st) {
        strokeSmoothPolyline(ctx, st, scale, scale);
      });

      if (this.currentStroke && this.currentStroke.length > 0) {
        ctx.strokeStyle = '#0f172a';
        strokeSmoothPolyline(ctx, this.currentStroke, scale, scale);
      }

      ctx.restore();
    }

    isDemoMode() {
      return this.demoMode;
    }

    /**
     * お手本アニメーション再生（画ごとの薄いカラー＆自然な一定速度で描き、終わっても「かく」まで表示保持）
     * 色: ①薄い赤 ②薄い青 ③薄い緑 ④薄い黄 ⑤薄い紫 ⑥以降すべて薄い灰
     */
    playDemo() {
      this.stopDemo();
      const tmpl = (Kakijun.STROKES && Kakijun.STROKES[this.targetChar]) || null;
      if (!tmpl) return;

      const self = this;
      const denseList = tmpl.strokes.map(function (st) {
        const len = strokeLength(st);
        const pointCount = Math.max(16, Math.min(180, Math.round(len / 1.25)));
        return densifyStroke(st, pointCount);
      });

      let sIdx = 0;
      let pIdx = 0;
      this.demoMode = true;
      this.locked = true;
      this.renderGuide();
      if (this.opts.onDemoChange) this.opts.onDemoChange(true);

      const ctx = this.dCtx;
      const s = this.logicalSize;
      const scale = s / 100;

      const drawStartNumber = function (pt, idx) {
        const r = Math.max(10, s * 0.034);
        ctx.save();
        ctx.fillStyle = getStrokeRgba(idx, 0.88);
        ctx.beginPath();
        ctx.arc(pt[0] * scale, pt[1] * scale, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(r * 1.15) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), pt[0] * scale, pt[1] * scale + 0.5);
        ctx.restore();
      };

      const renderDemoFrame = function (finishedAll) {
        ctx.save();
        ctx.setTransform(self.dpr, 0, 0, self.dpr, 0, 0);
        ctx.clearRect(0, 0, s, s);

        ctx.lineWidth = Math.max(15, s * 0.065);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const completedCount = finishedAll ? denseList.length : sIdx;
        for (let i = 0; i < completedCount; i++) {
          ctx.strokeStyle = getStrokeRgba(i, 0.56);
          strokeSmoothPolyline(ctx, denseList[i], scale, scale);
          drawStartNumber(denseList[i][0], i);
        }

        if (!finishedAll && sIdx < denseList.length) {
          const curSlice = denseList[sIdx].slice(0, pIdx + 1);
          ctx.strokeStyle = getStrokeRgba(sIdx, 0.62);
          strokeSmoothPolyline(ctx, curSlice, scale, scale);
          drawStartNumber(denseList[sIdx][0], sIdx);

          const tip = curSlice[curSlice.length - 1];
          ctx.fillStyle = getStrokeRgba(sIdx, 0.92);
          ctx.beginPath();
          ctx.arc(tip[0] * scale, tip[1] * scale, Math.max(9, s * 0.036), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.restore();
      };

      const step = function () {
        if (!self.demoMode) return;
        if (sIdx >= denseList.length) {
          // 描き終わったあとも「かく」ボタンを押すまでお手本を表示したままにする
          renderDemoFrame(true);
          self.demoAnimId = null;
          return;
        }

        renderDemoFrame(false);

        pIdx += 1;
        if (pIdx >= denseList[sIdx].length) {
          sIdx++;
          pIdx = 0;
          self.demoAnimId = global.setTimeout(function () {
            self.demoAnimId = global.requestAnimationFrame(step);
          }, 260);
        } else {
          self.demoAnimId = global.requestAnimationFrame(step);
        }
      };

      this.demoAnimId = global.requestAnimationFrame(step);
    }

    stopDemo() {
      if (this.demoAnimId) {
        global.cancelAnimationFrame(this.demoAnimId);
        global.clearTimeout(this.demoAnimId);
        this.demoAnimId = null;
      }
      if (this.demoMode) {
        this.demoMode = false;
        this.locked = false;
        if (this.opts.onDemoChange) this.opts.onDemoChange(false);
      }
    }

    exitDemoMode() {
      this.stopDemo();
      this.renderGuide();
      this.renderUserStrokes();
    }

    /**
     * 指定のミニキャンバスへ現在書いた文字をサムネイル描画
     */
    renderToThumbnail(thumbCanvas) {
      if (!thumbCanvas) return;
      const tCtx = thumbCanvas.getContext('2d');
      const w = thumbCanvas.width;
      const h = thumbCanvas.height;
      const scaleX = w / 100;
      const scaleY = h / 100;

      tCtx.clearRect(0, 0, w, h);

      // 点線十字
      tCtx.save();
      tCtx.strokeStyle = '#e2e8f0';
      tCtx.lineWidth = 1;
      tCtx.setLineDash([3, 3]);
      tCtx.beginPath();
      tCtx.moveTo(w / 2, 4);
      tCtx.lineTo(w / 2, h - 4);
      tCtx.moveTo(4, h / 2);
      tCtx.lineTo(w - 4, h / 2);
      tCtx.stroke();
      tCtx.restore();

      tCtx.save();
      tCtx.strokeStyle = '#1e293b';
      tCtx.lineWidth = Math.max(4, w * 0.07);
      tCtx.lineCap = 'round';
      tCtx.lineJoin = 'round';
      this.userStrokes.forEach(function (st) {
        strokeSmoothPolyline(tCtx, st, scaleX, scaleY);
      });
      tCtx.restore();
    }

    _toNormalizedPoint(ev) {
      const rect = this.drawCanvas.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      return [
        Math.max(0, Math.min(100, x)),
        Math.max(0, Math.min(100, y))
      ];
    }

    _updateLeadTracking(pt) {
      const nextIdx = this.userStrokes.length;
      if (!this.guideMode || nextIdx >= this.denseTemplate.length) {
        this.leadTracking = false;
        return;
      }
      const denseSt = this.denseTemplate[nextIdx];
      if (!denseSt || denseSt.length === 0) return;

      if (!this.leadTracking) {
        // 開始点「●」付近（半径22以内）に触れたら先導ガイド起動
        if (dist(pt, denseSt[0]) <= 24) {
          this.leadTracking = true;
          this.leadProgressIdx = 0;
        }
        return;
      }

      // 前回進捗から前方の範囲で最も近い点へ進める（逆戻りを防ぎつつ追従）
      const searchEnd = Math.min(denseSt.length - 1, this.leadProgressIdx + 22);
      let bestIdx = this.leadProgressIdx;
      let bestD = Infinity;
      for (let i = this.leadProgressIdx; i <= searchEnd; i++) {
        const d = dist(pt, denseSt[i]);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      if (bestD < 26) {
        this.leadProgressIdx = bestIdx;
      }
    }

    _bindEvents() {
      const el = this.drawCanvas;
      const self = this;

      el.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        if (self.locked || self.activePointerId !== null) return;
        if (Kakijun.Sound) Kakijun.Sound.unlock();

        self.activePointerId = ev.pointerId;
        if (el.setPointerCapture) {
          try { el.setPointerCapture(ev.pointerId); } catch (e) {}
        }

        const pt = self._toNormalizedPoint(ev);
        self.currentStroke = [pt];
        self.leadTracking = false;
        self.leadProgressIdx = 0;
        self._updateLeadTracking(pt);

        self.renderGuide();
        self.renderUserStrokes();
      }, { passive: false });

      el.addEventListener('pointermove', function (ev) {
        if (self.locked || ev.pointerId !== self.activePointerId || !self.currentStroke) return;
        ev.preventDefault();
        const pt = self._toNormalizedPoint(ev);
        const last = self.currentStroke[self.currentStroke.length - 1];
        if (dist(pt, last) >= 1.2) {
          self.currentStroke.push(pt);
          self._updateLeadTracking(pt);
          self.renderGuide();
          self.renderUserStrokes();
        }
      }, { passive: false });

      const finishStroke = function (ev) {
        if (ev.pointerId !== self.activePointerId || !self.currentStroke) return;
        ev.preventDefault();
        if (el.releasePointerCapture) {
          try { el.releasePointerCapture(ev.pointerId); } catch (e) {}
        }
        const finished = self.currentStroke;
        self.currentStroke = null;
        self.activePointerId = null;
        self.leadTracking = false;
        self.leadProgressIdx = 0;

        // 極小誤タップは描画リストに残さない
        let len = 0;
        for (let i = 1; i < finished.length; i++) {
          len += dist(finished[i - 1], finished[i]);
        }
        if (len >= 3.0) {
          self.userStrokes.push(finished);
          if (Kakijun.Sound) Kakijun.Sound.strokeDone();
          if (self.opts.onStrokeComplete) self.opts.onStrokeComplete(self.userStrokes);
          if (self.opts.onChange) self.opts.onChange(self.userStrokes);
        }

        self.renderGuide();
        self.renderUserStrokes();
      };

      el.addEventListener('pointerup', finishStroke, { passive: false });
      el.addEventListener('pointercancel', finishStroke, { passive: false });
    }
  }

  /**
   * 任意のキャンバスに点線十字＋ストローク配列を綺麗に描画する汎用ヘルパー
   */
  HandwritingCanvas.drawStrokesToCanvas = function (canvas, strokes, options) {
    if (!canvas) return;
    const opts = options || {};
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const scaleX = w / 100;
    const scaleY = h / 100;

    ctx.clearRect(0, 0, w, h);

    // 点線十字
    ctx.save();
    ctx.strokeStyle = opts.gridColor || '#cbd5e1';
    ctx.lineWidth = Math.max(1, w * 0.015);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 4);
    ctx.lineTo(w / 2, h - 4);
    ctx.moveTo(4, h / 2);
    ctx.lineTo(w - 4, h / 2);
    ctx.stroke();
    ctx.restore();

    if (!strokes || strokes.length === 0) return;

    ctx.save();
    ctx.strokeStyle = opts.strokeColor || '#1e293b';
    ctx.lineWidth = Math.max(4, w * 0.075);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach(function (st) {
      strokeSmoothPolyline(ctx, st, scaleX, scaleY);
    });
    ctx.restore();
  };

  Kakijun.HandwritingCanvas = HandwritingCanvas;
})(window);
