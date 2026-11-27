// 幾何・図形データモデルと計算ヘルパー

export const GRID_SIZE = 40;

export const ANGLE_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export const STROKE_COLORS = [
  { id: 'default', label: '黒(標準)', light: '#111827', dark: '#f8fafc', swatch: '#111827' },
  { id: '#ef4444', label: '赤', light: '#ef4444', dark: '#f87171', swatch: '#ef4444' },
  { id: '#2563eb', label: '青', light: '#2563eb', dark: '#60a5fa', swatch: '#2563eb' },
  { id: '#16a34a', label: '緑', light: '#16a34a', dark: '#4ade80', swatch: '#16a34a' },
  { id: '#f59e0b', label: 'オレンジ', light: '#d97706', dark: '#fbbf24', swatch: '#f59e0b' },
  { id: '#9333ea', label: '紫', light: '#9333ea', dark: '#c084fc', swatch: '#9333ea' },
  { id: '#0891b2', label: '水色', light: '#0891b2', dark: '#22d3ee', swatch: '#06b6d4' },
  { id: '#db2777', label: 'ピンク', light: '#db2777', dark: '#f472b6', swatch: '#ec4899' }
];

export const STROKE_WIDTHS = [
  { value: 2, key: 'thin', label: 'ほそい' },
  { value: 4, key: 'normal', label: 'ふつう' },
  { value: 7, key: 'thick', label: 'ふとい' },
  { value: 11, key: 'bold', label: 'ごくぶと' }
];

export function resolveColor(colorId, isDark) {
  if (!colorId || colorId === 'default') {
    return isDark ? '#f8fafc' : '#111827';
  }
  const found = STROKE_COLORS.find((c) => c.id === colorId);
  if (found) return isDark ? found.dark : found.light;
  return colorId;
}

export function resolveFillColor(colorId, isDark) {
  if (!colorId || colorId === 'default') {
    return isDark ? 'rgba(96, 165, 250, 0.16)' : 'rgba(59, 130, 246, 0.12)';
  }
  return hexToRgba(resolveColor(colorId, isDark), isDark ? 0.22 : 0.16);
}

export function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(59, 130, 246, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function snapValue(val, step = GRID_SIZE) {
  return Math.round(val / step) * step;
}

export function snapPoint(x, y, step = GRID_SIZE) {
  return { x: Math.round(x / step) * step, y: Math.round(y / step) * step };
}

export function uid(prefix = 'obj') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * プリセット図形を指定ワールド座標中心付近に生成する
 */
export function createPresetShape(subType, wx, wy, style, snapEnabled = true) {
  const G = GRID_SIZE;
  const cx = snapEnabled ? snapValue(wx) : wx;
  const cy = snapEnabled ? snapValue(wy) : wy;

  const baseStyle = {
    strokeColor: style.strokeColor || 'default',
    strokeWidth: style.strokeWidth || 2,
    fillEnabled: style.fillEnabled !== false
  };

  if (subType === 'circle_regular' || subType === 'circle_ellipse') {
    return {
      id: uid('cir'),
      kind: 'circle',
      subType,
      cx,
      cy,
      rx: subType === 'circle_ellipse' ? G * 3 : G * 2,
      ry: G * 2,
      rotation: 0,
      ...baseStyle
    };
  }

  let pts = [];
  if (subType === 'tri_general') {
    pts = [
      { x: cx - G, y: cy - G * 2 },
      { x: cx + G * 3, y: cy + G * 2 },
      { x: cx - G * 3, y: cy + G * 2 }
    ];
  } else if (subType === 'tri_isosceles') {
    pts = [
      { x: cx, y: cy - G * 3 },
      { x: cx + G * 2, y: cy + G * 2 },
      { x: cx - G * 2, y: cy + G * 2 }
    ];
  } else if (subType === 'tri_equilateral') {
    const half = G * 2;
    const h = half * Math.sqrt(3);
    const botY = snapEnabled ? snapValue(cy + h / 2) : cy + h / 2;
    pts = [
      { x: cx, y: botY - h },
      { x: cx + half, y: botY },
      { x: cx - half, y: botY }
    ];
  } else if (subType === 'tri_right') {
    pts = [
      { x: cx - G * 2, y: cy - G * 2 },
      { x: cx + G * 2, y: cy + G },
      { x: cx - G * 2, y: cy + G }
    ];
  } else if (subType === 'quad_square') {
    pts = [
      { x: cx - G * 2, y: cy - G * 2 },
      { x: cx + G * 2, y: cy - G * 2 },
      { x: cx + G * 2, y: cy + G * 2 },
      { x: cx - G * 2, y: cy + G * 2 }
    ];
  } else if (subType === 'quad_rect') {
    pts = [
      { x: cx - G * 3, y: cy - G * 2 },
      { x: cx + G * 3, y: cy - G * 2 },
      { x: cx + G * 3, y: cy + G * 2 },
      { x: cx - G * 3, y: cy + G * 2 }
    ];
  } else if (subType === 'quad_para') {
    pts = [
      { x: cx - G * 1, y: cy - G * 2 },
      { x: cx + G * 3, y: cy - G * 2 },
      { x: cx + G * 1, y: cy + G * 2 },
      { x: cx - G * 3, y: cy + G * 2 }
    ];
  } else if (subType === 'quad_trap') {
    pts = [
      { x: cx - G * 1, y: cy - G * 2 },
      { x: cx + G * 2, y: cy - G * 2 },
      { x: cx + G * 3, y: cy + G * 2 },
      { x: cx - G * 3, y: cy + G * 2 }
    ];
  } else if (subType === 'quad_rhombus') {
    pts = [
      { x: cx, y: cy - G * 2 },
      { x: cx + G * 3, y: cy },
      { x: cx, y: cy + G * 2 },
      { x: cx - G * 3, y: cy }
    ];
  } else if (subType === 'poly_pentagon' || subType === 'poly_hexagon' || subType === 'poly_octagon') {
    const sides = subType === 'poly_pentagon' ? 5 : subType === 'poly_hexagon' ? 6 : 8;
    const radius = G * 2.5;
    // 底辺が水平になる向き（五角形は頂点が上、六・八角形は辺が上下水平）
    const offset = sides === 5 ? -Math.PI / 2 : (Math.PI / sides) - Math.PI / 2;
    for (let i = 0; i < sides; i++) {
      const a = offset + (i * Math.PI * 2) / sides;
      pts.push({
        x: cx + radius * Math.cos(a),
        y: cy + radius * Math.sin(a)
      });
    }
  }

  const vertices = pts.map((p, i) => ({
    x: p.x,
    y: p.y,
    angleColor: ANGLE_COLORS[i % ANGLE_COLORS.length]
  }));

  return {
    id: uid('poly'),
    kind: 'polygon',
    subType,
    vertices,
    ...baseStyle
  };
}

/**
 * オブジェクトの重心（または中心）を取得
 */
export function getObjectCenter(obj) {
  if (obj.kind === 'polygon') {
    const n = obj.vertices.length;
    if (n === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (const v of obj.vertices) {
      sx += v.x;
      sy += v.y;
    }
    return { x: sx / n, y: sy / n };
  }
  if (obj.kind === 'circle' || obj.kind === 'arc') {
    return { x: obj.cx, y: obj.cy };
  }
  if (obj.kind === 'line') {
    return { x: (obj.x1 + obj.x2) / 2, y: (obj.y1 + obj.y2) / 2 };
  }
  if (obj.kind === 'freehand') {
    if (!obj.points.length) return { x: 0, y: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of obj.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  if (obj.kind === 'point' || obj.kind === 'right_angle') {
    return { x: obj.x, y: obj.y };
  }
  return { x: 0, y: 0 };
}

/**
 * 変形ハンドル用の頂点リストを返す
 */
export function getTransformHandles(obj) {
  if (obj.kind === 'polygon') {
    return obj.vertices.map((v, idx) => ({ idx, x: v.x, y: v.y }));
  }
  if (obj.kind === 'circle') {
    const cos = Math.cos(obj.rotation || 0);
    const sin = Math.sin(obj.rotation || 0);
    const locals = [
      { x: 0, y: -obj.ry },
      { x: obj.rx, y: 0 },
      { x: 0, y: obj.ry },
      { x: -obj.rx, y: 0 }
    ];
    return locals.map((p, idx) => ({
      idx,
      x: obj.cx + p.x * cos - p.y * sin,
      y: obj.cy + p.x * sin + p.y * cos
    }));
  }
  if (obj.kind === 'line') {
    return [
      { idx: 0, x: obj.x1, y: obj.y1 },
      { idx: 1, x: obj.x2, y: obj.y2 }
    ];
  }
  return [];
}

export function translateObject(obj, dx, dy) {
  if (obj.kind === 'polygon') {
    obj.vertices.forEach((v) => { v.x += dx; v.y += dy; });
  } else if (obj.kind === 'circle' || obj.kind === 'arc') {
    obj.cx += dx;
    obj.cy += dy;
  } else if (obj.kind === 'line') {
    obj.x1 += dx; obj.y1 += dy;
    obj.x2 += dx; obj.y2 += dy;
  } else if (obj.kind === 'freehand') {
    obj.points.forEach((p) => { p.x += dx; p.y += dy; });
  } else if (obj.kind === 'point' || obj.kind === 'right_angle') {
    obj.x += dx;
    obj.y += dy;
  }
}

export function flipObjectHorizontal(obj) {
  const c = getObjectCenter(obj);
  if (obj.kind === 'polygon') {
    obj.vertices.forEach((v) => {
      v.x = 2 * c.x - v.x;
    });
    obj.vertices.reverse();
  } else if (obj.kind === 'circle') {
    obj.rotation = -(obj.rotation || 0);
  } else if (obj.kind === 'line') {
    obj.x1 = 2 * c.x - obj.x1;
    obj.x2 = 2 * c.x - obj.x2;
  } else if (obj.kind === 'freehand') {
    obj.points.forEach((p) => { p.x = 2 * c.x - p.x; });
  }
}

export function cloneObject(obj, offset = GRID_SIZE) {
  const copy = JSON.parse(JSON.stringify(obj));
  copy.id = uid(copy.kind.slice(0, 3));
  translateObject(copy, offset, offset);
  return copy;
}

export function calcPolygonArea(verts) {
  let area = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * 図形のヤイバ式 多角形切断
 */
export function splitPolygon(vertices, lineStart, lineEnd) {
  const A = lineStart.y - lineEnd.y;
  const B = lineEnd.x - lineStart.x;
  const C = -A * lineStart.x - B * lineStart.y;
  const dist = (p) => A * p.x + B * p.y + C;

  const poly1 = [];
  const poly2 = [];
  const EPS = 0.001;

  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    const d1 = dist(p1);
    const d2 = dist(p2);

    if (d1 >= -EPS) poly1.push({ ...p1 });
    if (d1 <= EPS) poly2.push({ ...p1 });

    if (d1 * d2 < -EPS * EPS) {
      const t = d1 / (d1 - d2);
      const ix = p1.x + t * (p2.x - p1.x);
      const iy = p1.y + t * (p2.y - p1.y);
      const inter = { x: ix, y: iy };
      poly1.push({ ...inter });
      poly2.push({ ...inter });
    }
  }

  if (poly1.length < 3 || poly2.length < 3) return [vertices];
  if (calcPolygonArea(poly1) < 80 || calcPolygonArea(poly2) < 80) return [vertices];
  return [poly1, poly2];
}

/**
 * ヒット判定（ワールド座標 (wx, wy) がオブジェクト上にあるか）
 */
export function hitTestObject(obj, wx, wy, tolerance = 14) {
  if (obj.kind === 'right_angle') {
    const sz = obj.size || 16;
    const mx = obj.x + (obj.ux + obj.vx) * sz * 0.5;
    const my = obj.y + (obj.uy + obj.vy) * sz * 0.5;
    const d1 = Math.hypot(wx - obj.x, wy - obj.y);
    const d2 = Math.hypot(wx - mx, wy - my);
    return Math.min(d1, d2) <= Math.max(18, tolerance + 4);
  }
  if (obj.kind === 'point') {
    return Math.hypot(wx - obj.x, wy - obj.y) <= Math.max(18, tolerance + obj.strokeWidth);
  }
  if (obj.kind === 'line') {
    return distToSegment(wx, wy, obj.x1, obj.y1, obj.x2, obj.y2) <= Math.max(14, tolerance + obj.strokeWidth * 0.5);
  }
  if (obj.kind === 'freehand') {
    const thr = Math.max(14, tolerance + obj.strokeWidth * 0.5);
    for (let i = 0; i < obj.points.length - 1; i++) {
      if (distToSegment(wx, wy, obj.points[i].x, obj.points[i].y, obj.points[i + 1].x, obj.points[i + 1].y) <= thr) {
        return true;
      }
    }
    return false;
  }
  if (obj.kind === 'circle') {
    const dx = wx - obj.cx;
    const dy = wy - obj.cy;
    const cos = Math.cos(-(obj.rotation || 0));
    const sin = Math.sin(-(obj.rotation || 0));
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const norm = (lx * lx) / Math.max(1, obj.rx * obj.rx) + (ly * ly) / Math.max(1, obj.ry * obj.ry);
    if (obj.fillEnabled) {
      return norm <= 1.08;
    }
    const edgeDist = Math.abs(Math.sqrt(norm) - 1) * Math.min(obj.rx, obj.ry);
    return edgeDist <= Math.max(14, tolerance);
  }
  if (obj.kind === 'arc') {
    const d = Math.hypot(wx - obj.cx, wy - obj.cy);
    if (Math.abs(d - obj.r) > Math.max(14, tolerance)) return false;
    if (obj.isFullCircle) return true;
    const ang = Math.atan2(wy - obj.cy, wx - obj.cx);
    return isAngleInArc(ang, obj.startAngle, obj.deltaAngle);
  }
  if (obj.kind === 'polygon') {
    if (pointInPolygon(wx, wy, obj.vertices)) return true;
    const n = obj.vertices.length;
    for (let i = 0; i < n; i++) {
      const a = obj.vertices[i];
      const b = obj.vertices[(i + 1) % n];
      if (distToSegment(wx, wy, a.x, a.y, b.x, b.y) <= tolerance) return true;
    }
    return false;
  }
  return false;
}

export function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * vx + (py - y1) * vy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

export function pointInPolygon(x, y, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function normalizeAngle(a) {
  const tau = Math.PI * 2;
  return ((a % tau) + tau) % tau;
}

function isAngleInArc(angle, startAngle, deltaAngle) {
  if (Math.abs(deltaAngle) >= Math.PI * 2 - 0.01) return true;
  const a = normalizeAngle(angle);
  const s = normalizeAngle(startAngle);
  if (deltaAngle >= 0) {
    const diff = normalizeAngle(a - s);
    return diff <= deltaAngle + 0.12;
  } else {
    const diff = normalizeAngle(s - a);
    return diff <= Math.abs(deltaAngle) + 0.12;
  }
}

/**
 * コンパス円弧のSVGパス文字列を生成
 */
export function buildArcSvgPath(cx, cy, r, startAngle, deltaAngle) {
  const absDelta = Math.abs(deltaAngle);
  if (absDelta >= Math.PI * 2 - 0.02) {
    // ほぼ全周の場合は2つの半円で表現
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(startAngle + Math.PI);
    const y2 = cy + r * Math.sin(startAngle + Math.PI);
    return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2} A ${r} ${r} 0 1 1 ${x1} ${y1}`;
  }
  const endAngle = startAngle + deltaAngle;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = absDelta > Math.PI ? 1 : 0;
  const sweep = deltaAngle >= 0 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

/**
 * 多角形の内角マーク（直角記号または扇形パス）を生成
 */
export function buildPolygonAngleElements(verts) {
  const n = verts.length;
  if (n < 3) return [];
  // 多角形の向き（符号付き面積）
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    signedArea += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
  }
  const ccw = signedArea > 0;
  const items = [];

  for (let i = 0; i < n; i++) {
    const v = verts[i];
    if (!v.angleColor) continue;
    const prev = verts[(i - 1 + n) % n];
    const next = verts[(i + 1) % n];

    const u1x = prev.x - v.x, u1y = prev.y - v.y;
    const u2x = next.x - v.x, u2y = next.y - v.y;
    const l1 = Math.hypot(u1x, u1y);
    const l2 = Math.hypot(u2x, u2y);
    if (l1 < 6 || l2 < 6) continue;

    const a1 = Math.atan2(u1y, u1x);
    const a2 = Math.atan2(u2y, u2x);

    // 内角の方向を決める
    const dot = (u1x * u2x + u1y * u2y) / (l1 * l2);
    const clamped = Math.max(-1, Math.min(1, dot));
    const innerDeg = (Math.acos(clamped) * 180) / Math.PI;
    const isRight = Math.abs(innerDeg - 90) < 1.8;

    const r = Math.min(20, l1 * 0.35, l2 * 0.35);

    if (isRight) {
      const p1x = v.x + (u1x / l1) * r;
      const p1y = v.y + (u1y / l1) * r;
      const p2x = v.x + (u2x / l2) * r;
      const p2y = v.y + (u2y / l2) * r;
      const p3x = p1x + (u2x / l2) * r;
      const p3y = p1y + (u2y / l2) * r;
      items.push({
        d: `M ${p1x} ${p1y} L ${p3x} ${p3y} L ${p2x} ${p2y}`,
        fill: 'none',
        stroke: v.angleColor,
        isRight: true
      });
    } else {
      // a1 から a2 への角度差
      let diff = normalizeAngle(a2 - a1);
      // 画面座標(Y下向き)では ccw(面積>0) が時計回り視覚となるため、外積で内角側を判定
      const cross = u1x * u2y - u1y * u2x;
      const sweep = ccw ? (cross > 0 ? 1 : 0) : (cross < 0 ? 0 : 1);
      let start = a1;
      let end = a2;
      if (sweep === 1) {
        diff = normalizeAngle(end - start);
      } else {
        diff = normalizeAngle(start - end);
      }
      const largeArc = diff > Math.PI ? 1 : 0;
      const sx = v.x + r * Math.cos(start);
      const sy = v.y + r * Math.sin(start);
      const ex = v.x + r * Math.cos(end);
      const ey = v.y + r * Math.sin(end);
      items.push({
        d: `M ${v.x} ${v.y} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey} Z`,
        fill: v.angleColor,
        stroke: v.angleColor,
        isRight: false
      });
    }
  }
  return items;
}

/**
 * 始点 (x1, y1) から、図形の辺・線分（および延長線）への垂線の足を探索する
 */
export function findPerpendicularSnap(x1, y1, wx, wy, objects, threshold = 24) {
  const segments = [];
  for (const obj of objects) {
    if (obj.kind === 'polygon') {
      const n = obj.vertices.length;
      for (let i = 0; i < n; i++) {
        const a = obj.vertices[i];
        const b = obj.vertices[(i + 1) % n];
        segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
      }
    } else if (obj.kind === 'line') {
      segments.push({ ax: obj.x1, ay: obj.y1, bx: obj.x2, by: obj.y2 });
    }
  }

  let best = null;
  let minD = threshold;

  for (const seg of segments) {
    const abx = seg.bx - seg.ax;
    const aby = seg.by - seg.ay;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq < 16) continue;

    // 始点 (x1, y1) から直線 AB への正射影
    const t = ((x1 - seg.ax) * abx + (y1 - seg.ay) * aby) / abLenSq;
    if (t < -0.5 || t > 1.5) continue;

    const hx = seg.ax + t * abx;
    const hy = seg.ay + t * aby;
    const perpLen = Math.hypot(x1 - hx, y1 - hy);
    if (perpLen < 14) continue;

    const d = Math.hypot(wx - hx, wy - hy);
    if (d < minD) {
      minD = d;
      const abLen = Math.sqrt(abLenSq);
      const ux = (x1 - hx) / perpLen;
      const uy = (y1 - hy) / perpLen;
      // 辺側方向（HがB側寄りならA方向、A側寄りならB方向へマークを出す）
      const dir = t > 0.55 ? -1 : 1;
      const vx = (abx / abLen) * dir;
      const vy = (aby / abLen) * dir;
      const extFrom = t < 0 ? { x: seg.ax, y: seg.ay } : (t > 1 ? { x: seg.bx, y: seg.by } : null);
      best = { x: hx, y: hy, ux, uy, vx, vy, onSegment: t >= -0.02 && t <= 1.02, extFrom };
    }
  }
  return best;
}

/**
 * 確定した線分 (x1,y1)->(x2,y2) の終点が既存の辺・線分と直交しているか判定
 */
export function detectRightAngleAtEndpoint(x1, y1, x2, y2, objects) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 14) return null;
  const ux = -dx / len; // 終点から始点向き
  const uy = -dy / len;

  for (const obj of objects) {
    const segs = [];
    if (obj.kind === 'polygon') {
      const n = obj.vertices.length;
      for (let i = 0; i < n; i++) {
        segs.push([obj.vertices[i], obj.vertices[(i + 1) % n]]);
      }
    } else if (obj.kind === 'line') {
      segs.push([{ x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }]);
    }
    for (const [a, b] of segs) {
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const abLen = Math.hypot(abx, aby);
      if (abLen < 8) continue;
      const t = ((x2 - a.x) * abx + (y2 - a.y) * aby) / (abLen * abLen);
      if (t < -0.5 || t > 1.5) continue;
      const px = a.x + t * abx;
      const py = a.y + t * aby;
      if (Math.hypot(x2 - px, y2 - py) > 4.5) continue;
      const dot = Math.abs((dx / len) * (abx / abLen) + (dy / len) * (aby / abLen));
      if (dot <= 0.03) {
        const dir = t > 0.55 ? -1 : 1;
        return {
          x: px,
          y: py,
          ux,
          uy,
          vx: (abx / abLen) * dir,
          vy: (aby / abLen) * dir
        };
      }
    }
  }
  return null;
}

