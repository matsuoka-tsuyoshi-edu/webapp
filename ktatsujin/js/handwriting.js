/**
 * Handwriting Pad Controller for Tens & Ones Digit Boxes
 * Optimized for iPad Safari (touch & Apple Pencil) with live MNIST recognition.
 */
(function (global) {
  "use strict";

  function DigitPad(options) {
    this.canvas = options.canvas;
    this.bubbleEl = options.bubbleEl;
    this.placeholderText = options.placeholderText || "ここに かいてね";
    this.disallowZero = Boolean(options.disallowZero);
    this.onUpdate = options.onUpdate || function () {};
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    // Fixed crisp internal resolution for consistent MNIST stroke width & fast preprocessing
    this.canvas.width = 220;
    this.canvas.height = 220;

    this.isDrawing = false;
    this.activePointerId = null;
    this.lastPt = null;
    this.lastStrokeTime = 0;
    this.hasStrokes = false;
    this.prediction = null;
    this.debounceTimer = null;

    this._bindEvents();
    this.updateBubble();
  }

  DigitPad.prototype._getPoint = function (e) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) * this.canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * this.canvas.height) / rect.height,
    };
  };

  DigitPad.prototype._drawSegment = function (from, to) {
    const ctx = this.ctx;
    ctx.strokeStyle = "#1e293b";
    ctx.fillStyle = "#1e293b";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 17;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  DigitPad.prototype._drawDot = function (pt) {
    const ctx = this.ctx;
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 8.5, 0, Math.PI * 2);
    ctx.fill();
  };

  DigitPad.prototype._scheduleRecognize = function (delayMs) {
    const self = this;
    if (self.debounceTimer) {
      clearTimeout(self.debounceTimer);
    }
    self.debounceTimer = setTimeout(function () {
      self.recognizeNow();
    }, typeof delayMs === "number" ? delayMs : 140);
  };

  DigitPad.prototype.recognizeNow = function () {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (!this.hasStrokes) {
      this.prediction = null;
      this.updateBubble();
      this.onUpdate(this);
      return null;
    }
    const res = global.MnistRecognizer.recognizeCanvas(this.canvas);
    this.prediction = res;
    this.updateBubble();
    this.onUpdate(this);
    return res;
  };

  DigitPad.prototype.updateBubble = function () {
    if (!this.bubbleEl) return;
    this.bubbleEl.classList.remove("is-recognized", "is-unsure", "is-zero-invalid");

    if (!this.hasStrokes || !this.prediction) {
      this.bubbleEl.textContent = this.placeholderText;
      return;
    }

    const p = this.prediction;
    if (this.disallowZero && p.digit === 0) {
      this.bubbleEl.classList.add("is-zero-invalid");
      this.bubbleEl.innerHTML = "「<strong>0</strong>」は いらないよ！";
      return;
    }

    this.bubbleEl.classList.add("is-recognized");
    if (p.confidence < 0.55 && p.secondConfidence > 0.22) {
      this.bubbleEl.classList.add("is-unsure");
      this.bubbleEl.innerHTML =
        '「<strong>' + p.digit + '</strong>」かな？（' + p.secondDigit + "かも）";
    } else {
      this.bubbleEl.innerHTML = '「<strong>' + p.digit + '</strong>」って よめるよ！';
    }
  };

  DigitPad.prototype.clear = function () {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.isDrawing = false;
    this.activePointerId = null;
    this.lastPt = null;
    this.hasStrokes = false;
    this.prediction = null;
    this.updateBubble();
    this.onUpdate(this);
  };

  DigitPad.prototype.isEmpty = function () {
    return !this.hasStrokes || this.prediction === null;
  };

  DigitPad.prototype._bindEvents = function () {
    const self = this;
    const canvas = this.canvas;

    ["touchstart", "touchmove", "touchend"].forEach(function (evtName) {
      canvas.addEventListener(
        evtName,
        function (e) {
          e.preventDefault();
        },
        { passive: false }
      );
    });

    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      const now = Date.now();
      // Recover automatically if a previous pointer was dropped by iPadOS palm rejection
      if (self.isDrawing && now - self.lastStrokeTime > 1500) {
        self.isDrawing = false;
        self.activePointerId = null;
      }
      if (self.isDrawing) return;

      self.isDrawing = true;
      self.activePointerId = e.pointerId;
      self.lastStrokeTime = now;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        // Ignore if capture unavailable
      }
      if (self.debounceTimer) {
        clearTimeout(self.debounceTimer);
        self.debounceTimer = null;
      }
      const pt = self._getPoint(e);
      self.lastPt = pt;
      self.hasStrokes = true;
      self._drawDot(pt);
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!self.isDrawing || e.pointerId !== self.activePointerId) return;
      e.preventDefault();
      self.lastStrokeTime = Date.now();

      const events =
        typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
      for (let i = 0; i < events.length; i++) {
        const pt = self._getPoint(events[i]);
        if (self.lastPt) {
          self._drawSegment(self.lastPt, pt);
        }
        self.lastPt = pt;
      }
    });

    function finishStroke(e) {
      if (!self.isDrawing || e.pointerId !== self.activePointerId) return;
      e.preventDefault();
      self.isDrawing = false;
      self.activePointerId = null;
      self.lastPt = null;
      try {
        if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch (err) {
        // Ignore
      }
      self._scheduleRecognize(140);
    }

    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("lostpointercapture", function (e) {
      if (self.isDrawing && e.pointerId === self.activePointerId) {
        self.isDrawing = false;
        self.activePointerId = null;
        self.lastPt = null;
        self._scheduleRecognize(140);
      }
    });
  };

  global.DigitPad = DigitPad;
})(window);
