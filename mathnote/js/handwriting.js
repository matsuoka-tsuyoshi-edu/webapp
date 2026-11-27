// 外部依存ゼロのブラウザ内手書き文字・数字認識エンジン
// MNIST的 16x16 空間特徴 + 4方向勾配特徴 + 手書き数字/記号ベクターテンプレート + 画数/縦横比制約

const GRID = 16;
const RENDER_SIZE = 48;

// 認識対象文字セット（数字・英字・算数数学記号・ひらがな・カタカナ・算数基本漢字）
const DIGIT_CHARS = '0123456789'.split('');
const SYMBOL_CHARS = ['+', '-', '×', '÷', '=', '.', '°', '(', ')', '∠', '△', '□', '%'];
const UPPER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOWER_CHARS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const HIRAGANA_CHARS = (
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ' +
  'まみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'
).split('');
const KATAKANA_CHARS = (
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ' +
  'マミムメモヤユヨラリルレロワヲン'
).split('');
const MATH_KANJI_CHARS = (
  '一二三四五六七八九十百千万億角辺点線面長高底面体積円周正等平行四台ひ形直頂中心半径倍割分秒時間年月日上下左右大小多少同組数式答図'
).split('');

// 手書き特有の書き癖を補う追加ベクターテンプレート (0〜1正規化座標のストローク群)
const HANDWRITTEN_TEMPLATES = [
  { char: '0', strokes: [[[0.5, 0.08], [0.22, 0.25], [0.18, 0.55], [0.3, 0.86], [0.55, 0.92], [0.8, 0.72], [0.82, 0.36], [0.68, 0.12], [0.5, 0.08]]], minS: 1, maxS: 1 },
  { char: '1', strokes: [[[0.5, 0.08], [0.5, 0.92]]], minS: 1, maxS: 1, narrow: true },
  { char: '1', strokes: [[[0.32, 0.22], [0.52, 0.08], [0.52, 0.92]]], minS: 1, maxS: 2 },
  { char: '2', strokes: [[[0.2, 0.28], [0.38, 0.1], [0.7, 0.12], [0.8, 0.34], [0.55, 0.6], [0.18, 0.9], [0.85, 0.9]]], minS: 1, maxS: 1 },
  { char: '3', strokes: [[[0.22, 0.18], [0.55, 0.08], [0.78, 0.24], [0.65, 0.44], [0.38, 0.48], [0.72, 0.56], [0.82, 0.76], [0.58, 0.92], [0.2, 0.82]]], minS: 1, maxS: 1 },
  { char: '4', strokes: [[[0.62, 0.1], [0.15, 0.65], [0.88, 0.65]], [[0.65, 0.1], [0.65, 0.92]]], minS: 2, maxS: 2 },
  { char: '4', strokes: [[[0.22, 0.12], [0.22, 0.62], [0.86, 0.62]], [[0.68, 0.12], [0.68, 0.92]]], minS: 2, maxS: 2 },
  { char: '4', strokes: [[[0.65, 0.1], [0.16, 0.64], [0.88, 0.64], [0.65, 0.1], [0.65, 0.92]]], minS: 1, maxS: 1 },
  { char: '5', strokes: [[[0.78, 0.1], [0.25, 0.1], [0.22, 0.48], [0.58, 0.46], [0.82, 0.64], [0.68, 0.88], [0.24, 0.88]]], minS: 1, maxS: 1 },
  { char: '5', strokes: [[[0.26, 0.12], [0.22, 0.48], [0.6, 0.46], [0.82, 0.66], [0.64, 0.9], [0.22, 0.86]], [[0.26, 0.12], [0.8, 0.12]]], minS: 2, maxS: 2 },
  { char: '6', strokes: [[[0.68, 0.1], [0.35, 0.25], [0.18, 0.58], [0.24, 0.86], [0.58, 0.92], [0.82, 0.74], [0.72, 0.52], [0.38, 0.5], [0.2, 0.66]]], minS: 1, maxS: 1 },
  { char: '7', strokes: [[[0.18, 0.12], [0.82, 0.12], [0.42, 0.9]]], minS: 1, maxS: 1 },
  { char: '7', strokes: [[[0.2, 0.3], [0.2, 0.12], [0.82, 0.12], [0.45, 0.92]]], minS: 1, maxS: 2 },
  { char: '8', strokes: [[[0.5, 0.48], [0.24, 0.32], [0.28, 0.12], [0.72, 0.12], [0.76, 0.32], [0.5, 0.48], [0.2, 0.68], [0.28, 0.9], [0.72, 0.9], [0.8, 0.68], [0.5, 0.48]]], minS: 1, maxS: 2 },
  { char: '9', strokes: [[[0.78, 0.34], [0.65, 0.1], [0.3, 0.14], [0.2, 0.36], [0.4, 0.52], [0.75, 0.42], [0.78, 0.18], [0.66, 0.9]]], minS: 1, maxS: 2 },
  { char: '+', strokes: [[[0.5, 0.14], [0.5, 0.86]], [[0.14, 0.5], [0.86, 0.5]]], minS: 2, maxS: 2 },
  { char: '-', strokes: [[[0.12, 0.5], [0.88, 0.5]]], minS: 1, maxS: 1, flat: true },
  { char: '×', strokes: [[[0.16, 0.16], [0.84, 0.84]], [[0.84, 0.16], [0.16, 0.84]]], minS: 2, maxS: 2 },
  { char: '=', strokes: [[[0.14, 0.35], [0.86, 0.35]], [[0.14, 0.65], [0.86, 0.65]]], minS: 2, maxS: 2 },
  { char: '÷', strokes: [[[0.14, 0.5], [0.86, 0.5]], [[0.48, 0.22], [0.52, 0.22]], [[0.48, 0.78], [0.52, 0.78]]], minS: 3, maxS: 3 },
  { char: '∠', strokes: [[[0.84, 0.16], [0.16, 0.84], [0.88, 0.84]]], minS: 1, maxS: 2 },
  { char: '△', strokes: [[[0.5, 0.12], [0.12, 0.86], [0.88, 0.86], [0.5, 0.12]]], minS: 1, maxS: 3 },
  { char: '□', strokes: [[[0.14, 0.14], [0.86, 0.14], [0.86, 0.86], [0.14, 0.86], [0.14, 0.14]]], minS: 1, maxS: 4 }
];

let templateCache = null;

function ensureTemplates() {
  if (templateCache) return templateCache;
  templateCache = [];

  const canvas = document.createElement('canvas');
  canvas.width = RENDER_SIZE;
  canvas.height = RENDER_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const renderCharFeature = (ch, fontSpec, angleDeg = 0) => {
    ctx.clearRect(0, 0, RENDER_SIZE, RENDER_SIZE);
    ctx.save();
    ctx.translate(RENDER_SIZE / 2, RENDER_SIZE / 2);
    if (angleDeg) ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontSpec;
    ctx.fillText(ch, 0, 1);
    ctx.restore();
    return extractFeaturesFromCanvas(ctx, RENDER_SIZE, RENDER_SIZE);
  };

  const renderStrokesFeature = (strokes) => {
    ctx.clearRect(0, 0, RENDER_SIZE, RENDER_SIZE);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pad = 6;
    const span = RENDER_SIZE - pad * 2;
    for (const s of strokes) {
      if (s.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(pad + s[0][0] * span, pad + s[0][1] * span);
      if (s.length === 1) {
        ctx.lineTo(pad + s[0][0] * span + 0.5, pad + s[0][1] * span + 0.5);
      } else {
        for (let i = 1; i < s.length; i++) {
          ctx.lineTo(pad + s[i][0] * span, pad + s[i][1] * span);
        }
      }
      ctx.stroke();
    }
    return extractFeaturesFromCanvas(ctx, RENDER_SIZE, RENDER_SIZE);
  };

  const addEntry = (ch, category, feat, extra = {}) => {
    if (!feat) return;
    templateCache.push({ char: ch, category, ...feat, ...extra });
  };

  // 1. 手書き数字・記号テンプレート
  for (const tpl of HANDWRITTEN_TEMPLATES) {
    const feat = renderStrokesFeature(tpl.strokes);
    const cat = DIGIT_CHARS.includes(tpl.char) ? 'digit' : 'symbol';
    addEntry(tpl.char, cat, feat, { minS: tpl.minS, maxS: tpl.maxS, narrow: tpl.narrow, flat: tpl.flat });
  }

  // 2. フォント由来の各カテゴリテンプレート
  const registerGroup = (chars, category) => {
    for (const ch of chars) {
      const f1 = renderCharFeature(ch, '600 34px "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif', 0);
      addEntry(ch, category, f1);
      if (category === 'digit' || category === 'upper') {
        const f2 = renderCharFeature(ch, '600 34px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif', -6);
        addEntry(ch, category, f2);
      }
    }
  };

  registerGroup(DIGIT_CHARS, 'digit');
  registerGroup(SYMBOL_CHARS, 'symbol');
  registerGroup(UPPER_CHARS, 'upper');
  registerGroup(LOWER_CHARS, 'lower');
  registerGroup(HIRAGANA_CHARS, 'hiragana');
  registerGroup(KATAKANA_CHARS, 'katakana');
  registerGroup(MATH_KANJI_CHARS, 'kanji');

  return templateCache;
}

function extractFeaturesFromCanvas(ctx, w, h) {
  const imgData = ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = imgData[(y * w + x) * 4 + 3];
      if (a > 24) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);
  const aspect = bw / bh;
  const maxSide = Math.max(bw, bh);

  // 16x16 正規化グリッド（アスペクト比維持しつつ中央配置、極細文字は少し太め反映）
  const grid = new Float32Array(GRID * GRID);
  const ox = (maxSide - bw) / 2;
  const oy = (maxSide - bh) / 2;

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const sx = Math.floor(minX - ox + ((gx + 0.5) / GRID) * maxSide);
      const sy = Math.floor(minY - oy + ((gy + 0.5) / GRID) * maxSide);
      // 3x3 近傍で平滑化（位置ズレ耐性）
      let sum = 0;
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = sx + dx;
          const py = sy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const weight = (dx === 0 && dy === 0) ? 2 : 1;
            sum += (imgData[(py * w + px) * 4 + 3] / 255) * weight;
            cnt += weight;
          } else {
            cnt += 1;
          }
        }
      }
      grid[gy * GRID + gx] = sum / Math.max(1, cnt);
    }
  }

  // L2正規化
  let norm = 0;
  for (let i = 0; i < grid.length; i++) norm += grid[i] * grid[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < grid.length; i++) grid[i] /= norm;

  // 4x4 ブロックの4方向勾配特徴（64次元）
  const dirHist = new Float32Array(4 * 4 * 4);
  for (let gy = 1; gy < GRID - 1; gy++) {
    for (let gx = 1; gx < GRID - 1; gx++) {
      const idx = gy * GRID + gx;
      const dx = grid[idx + 1] - grid[idx - 1];
      const dy = grid[idx + GRID] - grid[idx - GRID];
      const mag = Math.hypot(dx, dy);
      if (mag < 0.01) continue;
      const by = Math.floor(gy / 4);
      const bx = Math.floor(gx / 4);
      const base = (by * 4 + bx) * 4;
      const ang = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180;
      const bin = ang < 22.5 || ang >= 157.5 ? 0 : (ang < 67.5 ? 1 : (ang < 112.5 ? 2 : 3));
      dirHist[base + bin] += mag;
    }
  }
  let dNorm = 0;
  for (let i = 0; i < dirHist.length; i++) dNorm += dirHist[i] * dirHist[i];
  dNorm = Math.sqrt(dNorm) || 1;
  for (let i = 0; i < dirHist.length; i++) dirHist[i] /= dNorm;

  return { grid, dirHist, aspect };
}

function extractFeaturesFromStrokes(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const bw = Math.max(4, maxX - minX);
  const bh = Math.max(4, maxY - minY);
  const maxSide = Math.max(bw, bh);

  const canvas = document.createElement('canvas');
  canvas.width = RENDER_SIZE;
  canvas.height = RENDER_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pad = 6;
  const span = RENDER_SIZE - pad * 2;
  const ox = (maxSide - bw) / 2;
  const oy = (maxSide - bh) / 2;

  for (const s of strokes) {
    if (s.length === 0) continue;
    ctx.beginPath();
    const x0 = pad + ((s[0].x - minX + ox) / maxSide) * span;
    const y0 = pad + ((s[0].y - minY + oy) / maxSide) * span;
    ctx.moveTo(x0, y0);
    if (s.length === 1) {
      ctx.lineTo(x0 + 0.5, y0 + 0.5);
    } else {
      for (let i = 1; i < s.length; i++) {
        ctx.lineTo(
          pad + ((s[i].x - minX + ox) / maxSide) * span,
          pad + ((s[i].y - minY + oy) / maxSide) * span
        );
      }
    }
    ctx.stroke();
  }

  return extractFeaturesFromCanvas(ctx, RENDER_SIZE, RENDER_SIZE);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * 1文字分のストローク群を認識して上位候補リストを返す
 * @param {Array<Array<{x:number, y:number}>>} strokes
 * @param {'all' | 'digit'} mode
 * @returns {Array<{char: string, score: number}>}
 */
export function recognizeSingleChar(strokes, mode = 'all') {
  if (!strokes || strokes.length === 0) return [];
  const inputFeat = extractFeaturesFromStrokes(strokes);
  if (!inputFeat) return [];

  const strokeCount = strokes.length;
  const templates = ensureTemplates();
  const bestByChar = new Map();

  for (const tpl of templates) {
    if (mode === 'digit' && tpl.category !== 'digit' && tpl.category !== 'symbol') continue;

    const simGrid = dot(inputFeat.grid, tpl.grid);
    const simDir = dot(inputFeat.dirHist, tpl.dirHist);
    let score = simGrid * 0.62 + simDir * 0.38;

    // 縦横比の近いものを優遇
    const aspectDiff = Math.abs(Math.log((inputFeat.aspect + 0.15) / (tpl.aspect + 0.15)));
    score -= aspectDiff * 0.18;

    // 画数制約があればペナルティ
    if (tpl.minS && strokeCount < tpl.minS) score -= 0.18;
    if (tpl.maxS && strokeCount > tpl.maxS) score -= 0.18;

    // ピリオド・小さい点の特例
    if (tpl.char === '.' && strokeCount === 1 && strokes[0].length <= 5) {
      score += 0.12;
    }

    const prev = bestByChar.get(tpl.char);
    if (prev === undefined || score > prev) {
      bestByChar.set(tpl.char, score);
    }
  }

  const ranked = Array.from(bestByChar.entries())
    .map(([char, score]) => ({ char, score }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 5);
}

/**
 * 横に続けて書かれた複数のストロークを1文字ずつのグループに自動分割して認識する
 * @param {Array<Array<{x:number, y:number}>>} strokes
 * @param {'all' | 'digit'} mode
 * @returns {{ text: string, candidatesList: Array<Array<{char:string, score:number}>> }}
 */
export function recognizeHandwriting(strokes, mode = 'all') {
  if (!strokes || strokes.length === 0) return { text: '', candidatesList: [] };

  // 各ストロークのX範囲を取得
  const boxes = strokes.map((s) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of s) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { s, minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  });

  // 全体の平均文字高さから分割閾値を決定
  let globalMinY = Infinity, globalMaxY = -Infinity;
  for (const b of boxes) {
    if (b.minY < globalMinY) globalMinY = b.minY;
    if (b.maxY > globalMaxY) globalMaxY = b.maxY;
  }
  const refHeight = Math.max(36, globalMaxY - globalMinY);
  const splitGap = refHeight * 0.36;

  // X開始順にソートして、ギャップが閾値以下なら同じ文字クラスタにまとめる
  boxes.sort((a, b) => a.minX - b.minX);
  const groups = [];
  for (const b of boxes) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push({ minX: b.minX, maxX: b.maxX, strokes: [b.s] });
    } else if (b.minX <= last.maxX + splitGap) {
      last.maxX = Math.max(last.maxX, b.maxX);
      last.strokes.push(b.s);
    } else {
      groups.push({ minX: b.minX, maxX: b.maxX, strokes: [b.s] });
    }
  }

  let text = '';
  const candidatesList = [];
  for (const g of groups) {
    const cands = recognizeSingleChar(g.strokes, mode);
    if (cands.length > 0) {
      text += cands[0].char;
      candidatesList.push(cands);
    }
  }

  return { text, candidatesList };
}
