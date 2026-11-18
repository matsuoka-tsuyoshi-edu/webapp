/**
 * 手書き文字認識＆書き順判定エンジン（純JavaScript・オフライン完結）
 * v0.6.0:
 * - アイデア1：2段階「急所チェック（ライバル文字対決）」方式を導入
 *   第1段階：太めぼかしシルエット＋アスペクト補正でガイド外れを寛容に許可
 *   第2段階：シルエットが近いライバル文字同士を「終端方向・結びループ・画長比・全体向き」の急所で比較し、
 *            わ/れ/ね、ぬ/め、ラ/う、あ/お、シ/ツ、ソ/ン 等の紛らわしい誤記を的確に識別
 */
(function (global) {
  'use strict';

  const Kakijun = (global.Kakijun = global.Kakijun || {});

  const RESAMPLE_N = 28;
  const SIG_N = 14;

  function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  function pathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += dist(pts[i - 1], pts[i]);
    }
    return len;
  }

  function resample(pts, n) {
    if (!pts || pts.length === 0) return [];
    if (pts.length === 1) {
      return Array.from({ length: n }, function () { return [pts[0][0], pts[0][1]]; });
    }
    const total = pathLength(pts);
    if (total < 1e-4) {
      return Array.from({ length: n }, function () { return [pts[0][0], pts[0][1]]; });
    }

    const step = total / (n - 1);
    const out = [[pts[0][0], pts[0][1]]];
    let accum = 0;
    const src = pts.map(function (p) { return [p[0], p[1]]; });

    let i = 1;
    while (i < src.length && out.length < n) {
      const d = dist(src[i - 1], src[i]);
      if (accum + d >= step) {
        const t = (step - accum) / d;
        const nx = src[i - 1][0] + t * (src[i][0] - src[i - 1][0]);
        const ny = src[i - 1][1] + t * (src[i][1] - src[i - 1][1]);
        const np = [nx, ny];
        out.push(np);
        src.splice(i, 0, np);
        accum = 0;
        i++;
      } else {
        accum += d;
        i++;
      }
    }
    while (out.length < n) {
      const last = src[src.length - 1];
      out.push([last[0], last[1]]);
    }
    return out;
  }

  function cleanStrokes(strokes) {
    if (!Array.isArray(strokes)) return [];
    return strokes.filter(function (st) {
      if (!st || st.length === 0) return false;
      return pathLength(st) >= 3.0;
    });
  }

  /**
   * 等比バウンディングボックス正規化（中央 50,50・最大辺 68）
   */
  function normalizeStrokesBox(strokes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(function (st) {
      st.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      });
    });

    const span = Math.max(maxX - minX, maxY - minY, 20);
    const scale = Math.min(2.3, Math.max(0.65, 68 / span));
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;

    return strokes.map(function (st) {
      return st.map(function (p) {
        return [
          Math.max(0, Math.min(100, 50 + (p[0] - cx) * scale)),
          Math.max(0, Math.min(100, 50 + (p[1] - cy) * scale))
        ];
      });
    });
  }

  /**
   * 縦横独立のアスペクト微補正正規化
   */
  function normalizeStrokesAniso(strokes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(function (st) {
      st.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      });
    });

    const w = Math.max(maxX - minX, 24);
    const h = Math.max(maxY - minY, 24);
    const sx = Math.min(2.2, Math.max(0.65, 66 / w));
    const sy = Math.min(2.2, Math.max(0.65, 66 / h));
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;

    return strokes.map(function (st) {
      return st.map(function (p) {
        return [
          Math.max(0, Math.min(100, 50 + (p[0] - cx) * sx)),
          Math.max(0, Math.min(100, 50 + (p[1] - cy) * sy))
        ];
      });
    });
  }

  function dtwDistance(a, b) {
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n }, function () {
      return new Float64Array(m).fill(Infinity);
    });
    dp[0][0] = dist(a[0], b[0]);
    for (let i = 1; i < n; i++) dp[i][0] = dp[i - 1][0] + dist(a[i], b[0]);
    for (let j = 1; j < m; j++) dp[0][j] = dp[0][j - 1] + dist(a[0], b[j]);

    for (let i = 1; i < n; i++) {
      for (let j = 1; j < m; j++) {
        const cost = dist(a[i], b[j]);
        const prev = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        dp[i][j] = cost + prev;
      }
    }
    return dp[n - 1][m - 1] / ((n + m) * 0.5);
  }

  function directionSimilarity(a, b) {
    let sumCos = 0;
    let count = 0;
    for (let i = 0; i < a.length - 1; i++) {
      const ax = a[i + 1][0] - a[i][0];
      const ay = a[i + 1][1] - a[i][1];
      const bx = b[i + 1][0] - b[i][0];
      const by = b[i + 1][1] - b[i][1];
      const la = Math.hypot(ax, ay);
      const lb = Math.hypot(bx, by);
      if (la > 0.2 && lb > 0.2) {
        sumCos += (ax * bx + ay * by) / (la * lb);
        count++;
      }
    }
    return count === 0 ? 1 : sumCos / count;
  }

  function compareStrokePair(rawUser, rawTmpl) {
    const u = resample(rawUser, RESAMPLE_N);
    const t = resample(rawTmpl, RESAMPLE_N);

    const dtw = dtwDistance(u, t);
    const startDist = dist(u[0], t[0]);
    const endDist = dist(u[u.length - 1], t[t.length - 1]);
    const dirSim = directionSimilarity(u, t);

    const dirPenalty = dirSim < 0.05 ? (0.05 - dirSim) * 32 : 0;

    const lenU = Math.max(10, pathLength(rawUser));
    const lenT = Math.max(10, pathLength(rawTmpl));
    const lenRatio = Math.max(lenU, lenT) / Math.min(lenU, lenT);
    const lenPenalty = lenRatio > 2.4 ? (lenRatio - 2.4) * 9 : 0;

    const score = dtw * 0.62 + startDist * 0.19 + endDist * 0.19 + dirPenalty + lenPenalty;
    return {
      score: score,
      dtw: dtw,
      startDist: startDist,
      endDist: endDist,
      dirSim: dirSim
    };
  }

  /**
   * 太めのぼかしグリッド（24x24, 半径2）
   */
  function rasterizeSoft(strokes, gridSize) {
    const g = gridSize || 24;
    const buf = new Float32Array(g * g);

    function mark(gx, gy) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx >= 0 && nx < g && ny >= 0 && ny < g) {
            const d2 = dx * dx + dy * dy;
            let w = 0;
            if (d2 === 0) w = 1.0;
            else if (d2 <= 2) w = 0.68;
            else if (d2 <= 4) w = 0.32;
            if (w > 0) {
              const idx = ny * g + nx;
              if (w > buf[idx]) buf[idx] = w;
            }
          }
        }
      }
    }

    strokes.forEach(function (st) {
      const pts = resample(st, 32);
      pts.forEach(function (p) {
        const gx = Math.max(0, Math.min(g - 1, Math.round((p[0] / 100) * (g - 1))));
        const gy = Math.max(0, Math.min(g - 1, Math.round((p[1] / 100) * (g - 1))));
        mark(gx, gy);
      });
    });

    return buf;
  }

  function cosineGridSimilarity(bufA, bufB) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < bufA.length; i++) {
      dot += bufA[i] * bufB[i];
      na += bufA[i] * bufA[i];
      nb += bufB[i] * bufB[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // =========================================================
  // 第2段階：急所特徴（Stroke Keypoint Signature）抽出＆比較
  // =========================================================
  function unitVec(dx, dy) {
    const l = Math.hypot(dx, dy);
    return l > 2.0 ? [dx / l, dy / l] : [0, 0];
  }

  function extractCharSigFromNorm(normStrokes) {
    const lens = normStrokes.map(function (st) {
      return Math.max(4.0, pathLength(st));
    });
    const tot = lens.reduce(function (a, b) { return a + b; }, 0) || 1;

    return normStrokes.map(function (st, idx) {
      const r = resample(st, SIG_N);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      r.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      });

      const sx = r[0][0], sy = r[0][1];
      const ex = r[r.length - 1][0], ey = r[r.length - 1][1];
      const ov = unitVec(ex - sx, ey - sy);
      const ev = unitVec(ex - r[8][0], ey - r[8][1]);

      let tailAng = 0;
      for (let k = 7; k < r.length - 1; k++) {
        const v1x = r[k][0] - r[k - 1][0], v1y = r[k][1] - r[k - 1][1];
        const v2x = r[k + 1][0] - r[k][0], v2y = r[k + 1][1] - r[k][1];
        tailAng += Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
      }
      let fullAng = 0;
      for (let k = 1; k < r.length - 1; k++) {
        const v1x = r[k][0] - r[k - 1][0], v1y = r[k][1] - r[k - 1][1];
        const v2x = r[k + 1][0] - r[k][0], v2y = r[k + 1][1] - r[k][1];
        fullAng += Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y);
      }

      return {
        start: [sx, sy],
        end: [ex, ey],
        lenNorm: lens[idx] / tot,
        spanX: maxX - minX,
        spanY: maxY - minY,
        ov: ov,
        ev: ev,
        tailDeg: tailAng * (180 / Math.PI),
        fullDeg: fullAng * (180 / Math.PI),
        rawLen: lens[idx]
      };
    });
  }

  function strokeSigDist(u, t) {
    const posErr = (dist(u.start, t.start) + dist(u.end, t.end)) * 0.5 * 0.35;
    const lenErr = Math.abs(u.lenNorm - t.lenNorm) * 100 * 0.55;
    const spanErr = (Math.abs(u.spanX - t.spanX) + Math.abs(u.spanY - t.spanY)) * 0.22;

    let endDirErr = 0;
    if ((u.ev[0] !== 0 || u.ev[1] !== 0) && (t.ev[0] !== 0 || t.ev[1] !== 0)) {
      const cosE = u.ev[0] * t.ev[0] + u.ev[1] * t.ev[1];
      endDirErr = (1.0 - cosE) * 26.0;
    }

    let ovDirErr = 0;
    if ((u.ov[0] !== 0 || u.ov[1] !== 0) && (t.ov[0] !== 0 || t.ov[1] !== 0)) {
      const cosO = u.ov[0] * t.ov[0] + u.ov[1] * t.ov[1];
      ovDirErr = (1.0 - cosO) * 18.0;
    }

    const turnWeight = Math.max(u.rawLen, t.rawLen) > 75 ? 1.0 : 0.2;
    const tailErr = Math.min(50.0, Math.abs(u.tailDeg - t.tailDeg) * 0.18 * turnWeight);
    const fullErr = Math.min(50.0, Math.abs(u.fullDeg - t.fullDeg) * 0.08 * turnWeight);

    return posErr + lenErr + spanErr + endDirErr + ovDirErr + tailErr + fullErr;
  }

  function charSigDist(uSig, tSig) {
    const n = uSig.length;
    if (n !== tSig.length || n === 0) return 999;

    if (n <= 5) {
      const mat = Array.from({ length: n }, function (_, i) {
        return Array.from({ length: n }, function (_, j) {
          return strokeSigDist(uSig[i], tSig[j]);
        });
      });
      const used = new Array(n).fill(false);
      let best = Infinity;
      function dfs(idx, acc) {
        if (acc >= best) return;
        if (idx === n) { best = acc; return; }
        for (let j = 0; j < n; j++) {
          if (!used[j]) {
            used[j] = true;
            dfs(idx + 1, acc + mat[idx][j]);
            used[j] = false;
          }
        }
      }
      dfs(0, 0);
      return best / n;
    }

    let sum = 0;
    for (let i = 0; i < n; i++) {
      let best = Infinity;
      for (let j = 0; j < n; j++) {
        const d = strokeSigDist(uSig[i], tSig[j]);
        if (d < best) best = d;
      }
      sum += best;
    }
    return sum / n;
  }

  // テンプレートの事前キャッシュ（iPadでの高速判定用）
  const tmplCache = new WeakMap();
  function getTemplateCache(strokesMap) {
    if (tmplCache.has(strokesMap)) return tmplCache.get(strokesMap);
    const cache = {};
    Object.keys(strokesMap).forEach(function (ch) {
      const sts = strokesMap[ch].strokes;
      const norm = normalizeStrokesBox(sts);
      const aniso = normalizeStrokesAniso(sts);
      cache[ch] = {
        rawGrid: rasterizeSoft(sts, 24),
        normGrid: rasterizeSoft(norm, 24),
        anisoGrid: rasterizeSoft(aniso, 24),
        norm: norm,
        sig: extractCharSigFromNorm(norm)
      };
    });
    tmplCache.set(strokesMap, cache);
    return cache;
  }

  function prepareUserPrecomputed(userStrokes) {
    const norm = normalizeStrokesBox(userStrokes);
    const aniso = normalizeStrokesAniso(userStrokes);
    return {
      raw: userStrokes,
      norm: norm,
      aniso: aniso,
      rawGrid: rasterizeSoft(userStrokes, 24),
      normGrid: rasterizeSoft(norm, 24),
      anisoGrid: rasterizeSoft(aniso, 24),
      sig: extractCharSigFromNorm(norm)
    };
  }

  function getSoftSimCached(uPre, tPre) {
    const g1 = cosineGridSimilarity(uPre.rawGrid, tPre.rawGrid);
    const g2 = cosineGridSimilarity(uPre.normGrid, tPre.normGrid);
    const g3 = cosineGridSimilarity(uPre.anisoGrid, tPre.anisoGrid);
    return Math.max(g1, g2, g3);
  }

  /**
   * 急所対決 ＋ 明らかな別文字の統合チェック
   */
  function findRivalWinner(uPre, targetChar, targetSoft, strokesMap, cache) {
    const uCount = uPre.raw.length;
    const tPre = cache[targetChar];
    const fTarget = charSigDist(uPre.sig, tPre.sig);

    let bestRival = null;
    let bestScore = 0;

    Object.keys(strokesMap).forEach(function (ch) {
      if (ch === targetChar) return;
      const other = strokesMap[ch];
      if (!other) return;
      const oCount = other.strokes.length;
      if (Math.abs(oCount - uCount) > 1) return;

      const oPre = cache[ch];
      const oSoft = getSoftSimCached(uPre, oPre);

      // ケースA：大枠シルエット自体が別文字の方が圧倒的に高い（例：「く」vs「あ」、「ロ」vs「キ」）
      if (oSoft >= 0.72 && oSoft - targetSoft >= 0.16) {
        const s = 100 + (oSoft - targetSoft) * 100;
        if (s > bestScore) {
          bestScore = s;
          bestRival = ch;
        }
        return;
      }

      // ケースB（アイデア1本命）：同じ画数でシルエットも近いライバル文字との急所対決
      // （わ/れ/ね、ぬ/め、ラ/う、あ/お、シ/ツ、ソ/ン など）
      if (oCount === uCount && oSoft >= 0.58 && oSoft >= targetSoft - 0.04) {
        const fRival = charSigDist(uPre.sig, oPre.sig);
        const gain = fTarget - fRival;
        if (gain >= 15.0 && gain > bestScore) {
          bestScore = gain;
          bestRival = ch;
        }
      }
    });

    return bestRival;
  }

  function bestUnorderedMatch(userStrokes, tmplStrokes) {
    const n = tmplStrokes.length;
    if (n > 6) {
      let sum = 0, mx = 0;
      for (let i = 0; i < n; i++) {
        let best = Infinity;
        for (let j = 0; j < n; j++) {
          const s = compareStrokePair(userStrokes[i], tmplStrokes[j]).score;
          if (s < best) best = s;
        }
        sum += best;
        if (best > mx) mx = best;
      }
      return { avg: sum / n, maxStroke: mx };
    }

    const matrix = Array.from({ length: n }, function (_, i) {
      return Array.from({ length: n }, function (_, j) {
        return compareStrokePair(userStrokes[i], tmplStrokes[j]).score;
      });
    });

    const used = new Array(n).fill(false);
    let bestSum = Infinity;
    let bestMax = Infinity;

    function dfs(idx, acc, curMax) {
      if (acc >= bestSum) return;
      if (idx === n) { bestSum = acc; bestMax = curMax; return; }
      for (let j = 0; j < n; j++) {
        if (!used[j]) {
          used[j] = true;
          dfs(idx + 1, acc + matrix[idx][j], Math.max(curMax, matrix[idx][j]));
          used[j] = false;
        }
      }
    }
    dfs(0, 0, 0);
    return { avg: bestSum / n, maxStroke: bestMax };
  }

  function evaluateOrderedPairs(userRaw, userNorm, tmplRaw, tmplNorm) {
    let sumScore = 0;
    let worstStrokeIdx = -1;
    let worstScore = -1;
    let worstDirSim = 1;
    let worstDirIdx = -1;

    for (let i = 0; i < tmplRaw.length; i++) {
      const r1 = compareStrokePair(userRaw[i], tmplRaw[i]);
      const r2 = compareStrokePair(userNorm[i], tmplNorm[i]);
      const best = r1.score <= r2.score ? r1 : r2;
      sumScore += best.score;
      if (best.score > worstScore) {
        worstScore = best.score;
        worstStrokeIdx = i;
      }
      if (best.dirSim < worstDirSim) {
        worstDirSim = best.dirSim;
        worstDirIdx = i;
      }
    }

    return {
      avgScore: sumScore / tmplRaw.length,
      worstScore: worstScore,
      worstStrokeIdx: worstStrokeIdx,
      worstDirSim: worstDirSim,
      worstDirIdx: worstDirIdx
    };
  }

  const THRESHOLDS = {
    easy: {
      shapeFirstCos: 0.61,
      maxAvgScore: 36,
      maxStrokeScore: 48,
      minDirSim: -0.25,
      minGridCos: 0.48
    },
    normal: {
      shapeFirstCos: 0.68,
      maxAvgScore: 26,
      maxStrokeScore: 36,
      minDirSim: -0.05,
      minGridCos: 0.56
    },
    strict: {
      shapeFirstCos: 0.99,
      maxAvgScore: 18,
      maxStrokeScore: 26,
      minDirSim: 0.15,
      minGridCos: 0.64
    }
  };

  /**
   * メイン判定関数（2段階：第1段階=シルエット容認 → 第2段階=急所ライバル対決）
   */
  function evaluate(rawUserStrokes, targetChar, options) {
    const opts = options || {};
    const checkOrder = opts.checkOrder !== false;
    const strictness = opts.strictness || 'easy';
    const isFreehand = !!opts.isFreehand;
    const baseTh = THRESHOLDS[strictness] || THRESHOLDS.easy;
    const th = {
      shapeFirstCos: Math.max(0.52, baseTh.shapeFirstCos - (isFreehand ? 0.04 : 0)),
      maxAvgScore: baseTh.maxAvgScore + (isFreehand ? 5 : 0),
      maxStrokeScore: baseTh.maxStrokeScore + (isFreehand ? 7 : 0),
      minDirSim: baseTh.minDirSim - (isFreehand ? 0.08 : 0),
      minGridCos: Math.max(0.42, baseTh.minGridCos - (isFreehand ? 0.05 : 0))
    };

    const strokesMap = opts.strokesMap || Kakijun.STROKES || {};
    const tmpl = strokesMap[targetChar];
    if (!tmpl) {
      return { ok: true, reason: 'no_template', message: 'よく かけたね！ ばっちりだよ✨' };
    }

    const userStrokes = cleanStrokes(rawUserStrokes);
    const tmplStrokes = tmpl.strokes;

    if (userStrokes.length === 0) {
      return {
        ok: false,
        reason: 'empty',
        message: 'まだ かいてないよ！ ゆびで かいてみよう✨'
      };
    }

    const cache = getTemplateCache(strokesMap);
    const uPre = prepareUserPrecomputed(userStrokes);
    const tPre = cache[targetChar];
    const softGridCos = getSoftSimCached(uPre, tPre);

    // 第2段階：急所ライバル対決（わ/れ、ぬ/め、ラ/う 等）＆明らかな別文字チェック
    const rival = findRivalWinner(uPre, targetChar, softGridCos, strokesMap, cache);
    if (rival) {
      return {
        ok: false,
        reason: 'confused_char',
        confusedWith: rival,
        softGridCos: softGridCos,
        message: 'おしい！ 「' + rival + '」に みえるよ！ 「' + targetChar + '」を よく みて かこう✨'
      };
    }

    // 第1段階：大枠の形が合っていれば ⭕（easy / normal）
    const strokeDiff = Math.abs(userStrokes.length - tmplStrokes.length);
    if (strictness !== 'strict') {
      const neededCos = strokeDiff === 0 ? th.shapeFirstCos : th.shapeFirstCos + 0.09;
      if (strokeDiff <= 1 && softGridCos >= neededCos) {
        return {
          ok: true,
          reason: 'match_shape_first',
          softGridCos: softGridCos,
          message: 'すごい！！ 「' + targetChar + '」の かたちが ばっちりだよ💮'
        };
      }
    }

    if (!checkOrder) {
      if (userStrokes.length === tmplStrokes.length) {
        const uRaw = bestUnorderedMatch(userStrokes, tmplStrokes);
        const uNorm = bestUnorderedMatch(uPre.norm, tPre.norm);
        const bestU = uRaw.avg <= uNorm.avg ? uRaw : uNorm;
        if (bestU.avg <= th.maxAvgScore + 4 && softGridCos >= th.minGridCos) {
          return {
            ok: true,
            reason: 'match_unordered',
            score: bestU.avg,
            softGridCos: softGridCos,
            message: 'やったね！ じょうずに かけたよ✨'
          };
        }
      }

      if (userStrokes.length < tmplStrokes.length) {
        return {
          ok: false,
          reason: 'shape_incomplete',
          softGridCos: softGridCos,
          message: 'いい ちょうし！ あと すこし せんを たしてみよう✨'
        };
      }
      return {
        ok: false,
        reason: 'shape_mismatch',
        softGridCos: softGridCos,
        message: 'おしい！ いい いきおいだよ！ 「' + targetChar + '」を もういちど かいてみよう✨'
      };
    }

    if (userStrokes.length < tmplStrokes.length) {
      const diff = tmplStrokes.length - userStrokes.length;
      return {
        ok: false,
        reason: 'few_strokes',
        softGridCos: softGridCos,
        message: 'いい かんじ！ あと ' + diff + 'かく かいてみよう✨'
      };
    }
    if (userStrokes.length > tmplStrokes.length) {
      return {
        ok: false,
        reason: 'many_strokes',
        softGridCos: softGridCos,
        message: 'げんきいっぱい かけたね！ ' + tmplStrokes.length + 'かく で かいてみよう✨'
      };
    }

    const ordered = evaluateOrderedPairs(userStrokes, uPre.norm, tmplStrokes, tPre.norm);
    const uRaw = bestUnorderedMatch(userStrokes, tmplStrokes);
    const uNorm = bestUnorderedMatch(uPre.norm, tPre.norm);
    const unordered = uRaw.avg <= uNorm.avg ? uRaw : uNorm;

    if (
      strictness === 'strict' &&
      tmplStrokes.length >= 2 &&
      unordered.avg <= th.maxAvgScore &&
      ordered.avgScore - unordered.avg > 6.5
    ) {
      return {
        ok: false,
        reason: 'wrong_order',
        avgScore: ordered.avgScore,
        unorderedAvg: unordered.avg,
        softGridCos: softGridCos,
        message: 'かたちは すごく じょうず✨ かきじゅんだけ 「おてほん」で みてみよう！'
      };
    }

    if (
      ordered.avgScore <= th.maxAvgScore &&
      ordered.worstScore <= th.maxStrokeScore &&
      softGridCos >= th.minGridCos
    ) {
      return {
        ok: true,
        reason: 'match_ordered',
        avgScore: ordered.avgScore,
        softGridCos: softGridCos,
        message: 'すごい！！ かきじゅんも かたちも ばっちりだよ💮'
      };
    }

    return {
      ok: false,
      reason: 'shape_mismatch',
      strokeIndex: ordered.worstStrokeIdx,
      avgScore: ordered.avgScore,
      softGridCos: softGridCos,
      message: 'おしい！ とても じょうずだよ。 「おてほん」を みて もういちど✨'
    };
  }

  /**
   * 書いている最中のリアルタイム・ポジティブサポートメッセージ
   */
  function getLiveSupport(rawUserStrokes, targetChar, strokesMap) {
    const map = strokesMap || Kakijun.STROKES || {};
    const tmpl = map[targetChar];
    const userStrokes = cleanStrokes(rawUserStrokes);
    const total = tmpl ? tmpl.strokes.length : 1;
    const count = userStrokes.length;

    if (count === 0) {
      return '●（まる）から かいてみよう！ できるかな？✨';
    }

    if (count < total) {
      const messages = [
        'おっ、いいね✨ つぎは どこから かくかな？',
        'すごい！ ' + count + 'かくめ じょうずに かけたね！',
        'いい ちょうし✨ あと ' + (total - count) + 'かく だよ！',
        'おっ、その いきおい！ つぎは ' + (count + 1) + 'かくめ だよ✨'
      ];
      return messages[(count - 1) % messages.length];
    }

    if (tmpl && count >= total) {
      const cache = getTemplateCache(map);
      const uPre = prepareUserPrecomputed(userStrokes);
      const softGridCos = getSoftSimCached(uPre, cache[targetChar]);
      const rival = findRivalWinner(uPre, targetChar, softGridCos, map, cache);
      if (rival) {
        return 'おっ、「' + rival + '」の もじにも みえるね！ 「' + targetChar + '」か みてみよう✨';
      }
      if (softGridCos >= 0.54) {
        return 'わあ！ 「' + targetChar + '」の もじに みえるね✨ ボタンを おしてみよう！';
      }
    }

    return 'かけたね✨ ボタンを おして すすもう！';
  }

  Kakijun.Recognizer = {
    evaluate: evaluate,
    getLiveSupport: getLiveSupport,
    resample: resample,
    cleanStrokes: cleanStrokes,
    compareStrokePair: compareStrokePair,
    normalizeStrokesBox: normalizeStrokesBox
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Kakijun.Recognizer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
