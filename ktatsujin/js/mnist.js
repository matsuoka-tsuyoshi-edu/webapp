/**
 * Pure-JS MNIST CNN Inference & Child-Friendly Preprocessing
 * Uses window.MNIST_WEIGHTS (extracted from ONNX Model Zoo mnist-12.onnx).
 */
(function (global) {
  "use strict";

  let offCrop = null;
  let off28 = null;

  function ensureCanvases() {
    if (!offCrop) {
      offCrop = document.createElement("canvas");
      off28 = document.createElement("canvas");
      off28.width = 28;
      off28.height = 28;
    }
  }

  function conv2dSame5x5Relu(inp, cIn, h, w, weights, bias, cOut) {
    const out = new Float32Array(cOut * h * w);
    const hw = h * w;
    for (let co = 0; co < cOut; co++) {
      const b = bias[co];
      const outBase = co * hw;
      for (let y = 0; y < h; y++) {
        const yw = y * w;
        for (let x = 0; x < w; x++) {
          let sum = b;
          for (let ci = 0; ci < cIn; ci++) {
            const wBase = (co * cIn + ci) * 25;
            const iBase = ci * hw;
            for (let ky = 0; ky < 5; ky++) {
              const iy = y + ky - 2;
              if (iy < 0 || iy >= h) continue;
              const iRow = iBase + iy * w;
              const kRow = wBase + ky * 5;
              for (let kx = 0; kx < 5; kx++) {
                const ix = x + kx - 2;
                if (ix < 0 || ix >= w) continue;
                sum += inp[iRow + ix] * weights[kRow + kx];
              }
            }
          }
          out[outBase + yw + x] = sum > 0 ? sum : 0;
        }
      }
    }
    return out;
  }

  function maxPool(inp, c, h, w, k) {
    const oH = Math.floor(h / k);
    const oW = Math.floor(w / k);
    const out = new Float32Array(c * oH * oW);
    const hw = h * w;
    const oHW = oH * oW;
    for (let ch = 0; ch < c; ch++) {
      const iBase = ch * hw;
      const oBase = ch * oHW;
      for (let oy = 0; oy < oH; oy++) {
        for (let ox = 0; ox < oW; ox++) {
          let m = -1e9;
          for (let ky = 0; ky < k; ky++) {
            const iRow = iBase + (oy * k + ky) * w;
            for (let kx = 0; kx < k; kx++) {
              const v = inp[iRow + ox * k + kx];
              if (v > m) m = v;
            }
          }
          out[oBase + oy * oW + ox] = m;
        }
      }
    }
    return out;
  }

  function forward(img784) {
    const W = global.MNIST_WEIGHTS;
    if (!W) {
      throw new Error("MNIST_WEIGHTS is not loaded.");
    }
    const c1 = conv2dSame5x5Relu(img784, 1, 28, 28, W.conv1W, W.conv1B, 8);
    const p1 = maxPool(c1, 8, 28, 28, 2);
    const c2 = conv2dSame5x5Relu(p1, 8, 14, 14, W.conv2W, W.conv2B, 16);
    const p2 = maxPool(c2, 16, 14, 14, 3);

    const logits = new Float32Array(10);
    for (let cls = 0; cls < 10; cls++) {
      let s = W.fcB[cls];
      for (let i = 0; i < 256; i++) {
        s += p2[i] * W.fcW[i * 10 + cls];
      }
      logits[cls] = s;
    }

    let maxLogit = -Infinity;
    for (let i = 0; i < 10; i++) {
      if (logits[i] > maxLogit) maxLogit = logits[i];
    }
    const probs = new Array(10);
    let expSum = 0;
    for (let i = 0; i < 10; i++) {
      const e = Math.exp(logits[i] - maxLogit);
      probs[i] = e;
      expSum += e;
    }
    for (let i = 0; i < 10; i++) {
      probs[i] /= expSum;
    }

    let bestIdx = 0;
    let secondIdx = 1;
    if (probs[1] > probs[0]) {
      bestIdx = 1;
      secondIdx = 0;
    }
    for (let i = 2; i < 10; i++) {
      if (probs[i] > probs[bestIdx]) {
        secondIdx = bestIdx;
        bestIdx = i;
      } else if (probs[i] > probs[secondIdx]) {
        secondIdx = i;
      }
    }

    return {
      digit: bestIdx,
      confidence: probs[bestIdx],
      secondDigit: secondIdx,
      secondConfidence: probs[secondIdx],
      probs: probs,
    };
  }

  /**
   * Preprocess a transparent-background ink canvas into normalized 28x28 MNIST float tensor.
   * Returns null if there is not enough ink.
   */
  function preprocessCanvas(sourceCanvas) {
    ensureCanvases();
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const raw = ctx.getImageData(0, 0, w, h).data;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    let inkCount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = raw[(y * w + x) * 4 + 3];
        if (alpha > 18) {
          inkCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Require a minimal amount of ink to avoid stray 1px taps
    if (inkCount < 12 || maxX < minX || maxY < minY) {
      return null;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    // Fit inside 20x20 preserving aspect ratio
    const scale = 20 / Math.max(cropW, cropH);
    const nw = Math.max(1, Math.round(cropW * scale));
    const nh = Math.max(1, Math.round(cropH * scale));

    offCrop.width = nw;
    offCrop.height = nh;
    const cropCtx = offCrop.getContext("2d", { willReadFrequently: true });
    cropCtx.clearRect(0, 0, nw, nh);
    cropCtx.imageSmoothingEnabled = true;
    cropCtx.imageSmoothingQuality = "high";
    cropCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, nw, nh);

    // Compute center of mass of resized digit
    const cropData = cropCtx.getImageData(0, 0, nw, nh).data;
    let mass = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const a = cropData[(y * nw + x) * 4 + 3];
        if (a > 0) {
          mass += a;
          sumX += x * a;
          sumY += y * a;
        }
      }
    }

    const cx = mass > 0 ? sumX / mass : nw / 2;
    const cy = mass > 0 ? sumY / mass : nh / 2;

    let dx = Math.round(14 - cx);
    let dy = Math.round(14 - cy);
    if (nw <= 26) {
      dx = Math.max(1, Math.min(27 - nw, dx));
    } else {
      dx = Math.round((28 - nw) / 2);
    }
    if (nh <= 26) {
      dy = Math.max(1, Math.min(27 - nh, dy));
    } else {
      dy = Math.round((28 - nh) / 2);
    }

    const ctx28 = off28.getContext("2d", { willReadFrequently: true });
    ctx28.clearRect(0, 0, 28, 28);
    ctx28.drawImage(offCrop, dx, dy);

    const data28 = ctx28.getImageData(0, 0, 28, 28).data;
    const tensor = new Float32Array(784);
    for (let i = 0; i < 784; i++) {
      tensor[i] = data28[i * 4 + 3] / 255.0;
    }
    return tensor;
  }

  function recognizeCanvas(canvas) {
    const tensor = preprocessCanvas(canvas);
    if (!tensor) return null;
    return forward(tensor);
  }

  global.MnistRecognizer = {
    recognizeCanvas: recognizeCanvas,
    preprocessCanvas: preprocessCanvas,
  };
})(window);
