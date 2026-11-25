/**
 * turtle.js
 * タートル描画エンジン（無限ベクターキャンバス・パン/ズーム/全体フィット・回転外角表示・ガイド線）
 */
window.TakakukeiApp = window.TakakukeiApp || {};

window.TakakukeiApp.createTurtleEngine = function (canvas, options) {
  const { onViewChange } = options || {};
  const LOGICAL_SIZE = 420;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = LOGICAL_SIZE * DPR;
  canvas.height = LOGICAL_SIZE * DPR;

  const ctx = canvas.getContext('2d');

  let turtle = { x: 210, y: 260, angle: -90, isPenDown: true };
  let startPos = { x: 210, y: 260, angle: -90 };
  let currentGoalType = 'line';
  let showGuide = true;
  let showTurnAngles = true;
  let alwaysPenDown = false;
  let fastMode = false;
  let customGuideSegments = null;
  let drawScale = 1.0;
  let runToken = 0;

  // カメラ（パン・ズーム）状態
  const MIN_ZOOM = 0.12;
  const MAX_ZOOM = 3.5;
  let view = { offsetX: 0, offsetY: 0, zoom: 1.0 };

  // ベクター線分と回転アーク履歴
  let drawnPaths = []; // { x1, y1, x2, y2 }
  let activePath = null; // アニメ中の現在線分
  let activeTurnArc = null; // { x, y, fromAngle, currentAngle }
  let recordedTurnArcs = [];

  // 判定用ログ（論理歩数ベース）
  let segments = [];
  let turns = [];
  let actionLog = [];

  function notifyView() {
    if (onViewChange) {
      onViewChange(view.zoom);
    }
  }

  function setConfig(opts) {
    if (opts.startPos) startPos = { ...opts.startPos };
    if (opts.goalType !== undefined) currentGoalType = opts.goalType;
    if (opts.showGuide !== undefined) showGuide = opts.showGuide;
    if (opts.showTurnAngles !== undefined) showTurnAngles = opts.showTurnAngles;
    if (opts.alwaysPenDown !== undefined) alwaysPenDown = opts.alwaysPenDown;
    if (opts.fastMode !== undefined) fastMode = !!opts.fastMode;
    if (opts.customGuideSegments !== undefined) customGuideSegments = opts.customGuideSegments;
    if (opts.drawScale !== undefined) drawScale = Number(opts.drawScale) || 1.0;
  }

  function getToken() {
    return runToken;
  }

  function cancelRun() {
    runToken++;
    activeTurnArc = null;
    activePath = null;
    redrawAll();
  }

  function reset(initialPenDown) {
    runToken++;
    activeTurnArc = null;
    activePath = null;
    recordedTurnArcs = [];
    drawnPaths = [];
    segments = [];
    turns = [];
    actionLog = [];
    turtle = {
      x: startPos.x,
      y: startPos.y,
      angle: startPos.angle,
      isPenDown: initialPenDown
    };
    redrawAll();
  }

  // --- カメラ操作 API ---
  function resetView() {
    view = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    notifyView();
    redrawAll();
  }

  function zoomBy(factor, anchorLogicalX, anchorLogicalY) {
    const oldZoom = view.zoom;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    if (Math.abs(newZoom - oldZoom) < 0.0001) return;

    const ax = anchorLogicalX !== undefined ? anchorLogicalX : LOGICAL_SIZE / 2;
    const ay = anchorLogicalY !== undefined ? anchorLogicalY : LOGICAL_SIZE / 2;
    const ratio = newZoom / oldZoom;
    const center = LOGICAL_SIZE / 2;

    view.offsetX = (ax - center) - (ax - center - view.offsetX) * ratio;
    view.offsetY = (ay - center) - (ay - center - view.offsetY) * ratio;
    view.zoom = newZoom;
    notifyView();
    redrawAll();
  }

  function fitToDrawing() {
    const pts = [{ x: turtle.x, y: turtle.y }];
    for (let i = 0; i < drawnPaths.length; i++) {
      const p = drawnPaths[i];
      pts.push({ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 });
    }
    if (activePath) {
      pts.push({ x: activePath.x1, y: activePath.y1 }, { x: activePath.x2, y: activePath.y2 });
    }

    // まだ何も描かれておらずタートルも開始点にいる場合は初期ビューに戻す
    if (drawnPaths.length === 0 && !activePath && Math.hypot(turtle.x - startPos.x, turtle.y - startPos.y) < 1) {
      resetView();
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].x < minX) minX = pts[i].x;
      if (pts[i].x > maxX) maxX = pts[i].x;
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }

    const spanX = Math.max(40, maxX - minX);
    const spanY = Math.max(40, maxY - minY);
    const pad = Math.max(55, Math.max(spanX, spanY) * 0.12);

    const boxW = spanX + pad * 2;
    const boxH = spanY + pad * 2;
    const targetZoom = Math.max(MIN_ZOOM, Math.min(1.8, (LOGICAL_SIZE * 0.94) / Math.max(boxW, boxH)));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    view.zoom = targetZoom;
    view.offsetX = -(cx - LOGICAL_SIZE / 2) * view.zoom;
    view.offsetY = -(cy - LOGICAL_SIZE / 2) * view.zoom;
    notifyView();
    redrawAll();
  }

  // --- ポインター操作（ドラッグパン＆ホイールズーム） ---
  let isDragging = false;
  let activePointerId = null;
  let lastClientX = 0;
  let lastClientY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    isDragging = true;
    activePointerId = e.pointerId;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    canvas.classList.add('dragging');
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const scaleFactor = LOGICAL_SIZE / rect.width;
    const dx = (e.clientX - lastClientX) * scaleFactor;
    const dy = (e.clientY - lastClientY) * scaleFactor;
    lastClientX = e.clientX;
    lastClientY = e.clientY;

    view.offsetX += dx;
    view.offsetY += dy;
    redrawAll();
  });

  function endDrag(e) {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;
    activePointerId = null;
    canvas.classList.remove('dragging');
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const lx = ((e.clientX - rect.left) / rect.width) * LOGICAL_SIZE;
    const ly = ((e.clientY - rect.top) / rect.height) * LOGICAL_SIZE;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoomBy(factor, lx, ly);
  }, { passive: false });

  // --- 描画ヘルパー ---
  function screenToWorld(sx, sy) {
    const c = LOGICAL_SIZE / 2;
    return {
      x: c + (sx - c - view.offsetX) / view.zoom,
      y: c + (sy - c - view.offsetY) / view.zoom
    };
  }

  function drawGrid(targetCtx) {
    const tl = screenToWorld(0, 0);
    const br = screenToWorld(LOGICAL_SIZE, LOGICAL_SIZE);
    const step = view.zoom < 0.35 ? 200 : view.zoom < 0.65 ? 100 : 50;
    const originOffset = 20;

    const startX = Math.floor((tl.x - originOffset) / step) * step + originOffset;
    const endX = Math.ceil((br.x - originOffset) / step) * step + originOffset;
    const startY = Math.floor((tl.y - originOffset) / step) * step + originOffset;
    const endY = Math.ceil((br.y - originOffset) / step) * step + originOffset;

    targetCtx.save();
    targetCtx.strokeStyle = '#e8eef5';
    targetCtx.lineWidth = 1 / view.zoom;

    for (let x = startX; x <= endX; x += step) {
      targetCtx.beginPath();
      targetCtx.moveTo(x, tl.y);
      targetCtx.lineTo(x, br.y);
      targetCtx.stroke();
    }

    for (let y = startY; y <= endY; y += step) {
      targetCtx.beginPath();
      targetCtx.moveTo(tl.x, y);
      targetCtx.lineTo(br.x, y);
      targetCtx.stroke();
    }
    targetCtx.restore();
  }

  function drawGuideShape(targetCtx) {
    if (!showGuide || !currentGoalType || currentGoalType === 'free') return;

    targetCtx.save();
    targetCtx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    targetCtx.lineWidth = 3 / Math.max(0.5, Math.min(1.4, view.zoom));
    targetCtx.setLineDash([7 / view.zoom, 6 / view.zoom]);
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';

    if (currentGoalType === 'challenge' && Array.isArray(customGuideSegments)) {
      targetCtx.beginPath();
      for (let i = 0; i < customGuideSegments.length; i++) {
        const s = customGuideSegments[i];
        targetCtx.moveTo(s.x1, s.y1);
        targetCtx.lineTo(s.x2, s.y2);
      }
      targetCtx.stroke();
      targetCtx.restore();
      return;
    }

    let cx = startPos.x;
    let cy = startPos.y;
    let ang = startPos.angle;

    const stepForward = (len) => {
      const rad = (ang * Math.PI) / 180;
      const dist = len * drawScale;
      const nx = cx + dist * Math.cos(rad);
      const ny = cy + dist * Math.sin(rad);
      targetCtx.lineTo(nx, ny);
      cx = nx;
      cy = ny;
    };

    targetCtx.beginPath();
    targetCtx.moveTo(cx, cy);

    if (currentGoalType === 'line') {
      stepForward(100);
    } else if (currentGoalType === 'corner') {
      stepForward(100);
      ang += 90;
      stepForward(100);
    } else if (currentGoalType === 'square') {
      for (let i = 0; i < 4; i++) {
        stepForward(100);
        ang += 90;
      }
    } else if (currentGoalType === 'triangle') {
      for (let i = 0; i < 3; i++) {
        stepForward(100);
        ang += 120;
      }
    } else if (currentGoalType === 'pentagon') {
      for (let i = 0; i < 5; i++) {
        stepForward(100);
        ang += 72;
      }
    } else if (currentGoalType === 'star') {
      for (let i = 0; i < 5; i++) {
        stepForward(100);
        ang += 144;
      }
    }

    targetCtx.stroke();
    targetCtx.restore();
  }

  function drawDrawnPaths(targetCtx) {
    if (drawnPaths.length === 0 && !activePath) return;
    targetCtx.save();
    targetCtx.strokeStyle = '#2563eb';
    targetCtx.lineWidth = 4.5 / Math.pow(Math.max(0.2, Math.min(1.6, view.zoom)), 0.72);
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';

    targetCtx.beginPath();
    for (let i = 0; i < drawnPaths.length; i++) {
      const p = drawnPaths[i];
      targetCtx.moveTo(p.x1, p.y1);
      targetCtx.lineTo(p.x2, p.y2);
    }
    if (activePath) {
      targetCtx.moveTo(activePath.x1, activePath.y1);
      targetCtx.lineTo(activePath.x2, activePath.y2);
    }
    targetCtx.stroke();
    targetCtx.restore();
  }

  function drawTurnArc(targetCtx, arc, isActive) {
    if (!arc) return;
    const { x, y, fromAngle, currentAngle } = arc;
    const delta = currentAngle - fromAngle;
    if (Math.abs(delta) < 1) return;

    // 大きくズームアウトしたときも角度が見やすいよう適度にスケーリング補正
    const uiScale = 1 / Math.pow(Math.max(0.25, Math.min(1.5, view.zoom)), 0.7);
    const radius = (isActive ? 32 : 25) * uiScale;
    const extLen = (isActive ? 56 : 44) * uiScale;
    const labelDist = (isActive ? 48 : 39) * uiScale;

    targetCtx.save();
    const fromRad = (fromAngle * Math.PI) / 180;
    targetCtx.beginPath();
    targetCtx.setLineDash([4 * uiScale, 4 * uiScale]);
    targetCtx.strokeStyle = isActive ? '#475569' : 'rgba(100, 116, 139, 0.75)';
    targetCtx.lineWidth = (isActive ? 2.2 : 1.8) * uiScale;
    targetCtx.moveTo(x, y);
    targetCtx.lineTo(x + extLen * Math.cos(fromRad), y + extLen * Math.sin(fromRad));
    targetCtx.stroke();

    targetCtx.setLineDash([]);
    const toRad = (currentAngle * Math.PI) / 180;
    targetCtx.beginPath();
    targetCtx.moveTo(x, y);
    targetCtx.arc(x, y, radius, fromRad, toRad, delta < 0);
    targetCtx.closePath();
    targetCtx.fillStyle = isActive ? 'rgba(245, 158, 11, 0.38)' : 'rgba(245, 158, 11, 0.24)';
    targetCtx.fill();

    targetCtx.beginPath();
    targetCtx.arc(x, y, radius, fromRad, toRad, delta < 0);
    targetCtx.strokeStyle = isActive ? '#d97706' : 'rgba(217, 119, 6, 0.85)';
    targetCtx.lineWidth = (isActive ? 2.5 : 2) * uiScale;
    targetCtx.stroke();

    const midRad = ((fromAngle + currentAngle) / 2) * (Math.PI / 180);
    const tx = x + labelDist * Math.cos(midRad);
    const ty = y + labelDist * Math.sin(midRad);
    const label = `${Math.round(Math.abs(delta))}°`;
    const fontSize = Math.round((isActive ? 14 : 13) * uiScale);
    targetCtx.font = `bold ${fontSize}px sans-serif`;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.lineWidth = 4 * uiScale;
    targetCtx.strokeStyle = '#ffffff';
    targetCtx.strokeText(label, tx, ty);
    targetCtx.fillStyle = '#b45309';
    targetCtx.fillText(label, tx, ty);
    targetCtx.restore();
  }

  function drawTurnArcsOverlay(targetCtx) {
    if (!showTurnAngles) return;
    for (let i = 0; i < recordedTurnArcs.length; i++) {
      drawTurnArc(targetCtx, recordedTurnArcs[i], false);
    }
    if (activeTurnArc) {
      drawTurnArc(targetCtx, activeTurnArc, true);
    }
  }

  function drawTurtle() {
    const uiScale = 1 / Math.pow(Math.max(0.25, Math.min(1.5, view.zoom)), 0.72);
    ctx.save();
    ctx.translate(turtle.x, turtle.y);
    const rad = (turtle.angle * Math.PI) / 180;

    // 進行方向のガイド点線
    ctx.save();
    ctx.rotate(rad);
    ctx.beginPath();
    ctx.setLineDash([3 * uiScale, 3 * uiScale]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 2 * uiScale;
    ctx.moveTo(16 * uiScale, 0);
    ctx.lineTo(42 * uiScale, 0);
    ctx.stroke();
    ctx.restore();

    // タートル本体（赤い矢印）
    ctx.rotate((turtle.angle + 90) * (Math.PI / 180));
    ctx.beginPath();
    ctx.moveTo(0, -18 * uiScale);
    ctx.lineTo(12 * uiScale, 12 * uiScale);
    ctx.lineTo(0, 6 * uiScale);
    ctx.lineTo(-12 * uiScale, 12 * uiScale);
    ctx.closePath();

    ctx.fillStyle = (turtle.isPenDown || alwaysPenDown) ? '#ef4444' : '#94a3b8';
    ctx.fill();
    ctx.lineWidth = 2.5 * uiScale;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  function redrawAll() {
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

    // カメラ変換（ワールド座標系へ）
    const c = LOGICAL_SIZE / 2;
    ctx.translate(c + view.offsetX, c + view.offsetY);
    ctx.scale(view.zoom, view.zoom);
    ctx.translate(-c, -c);

    drawGrid(ctx);
    drawGuideShape(ctx);
    drawDrawnPaths(ctx);
    drawTurnArcsOverlay(ctx);
    drawTurtle();
    ctx.restore();
  }

  function penDown() {
    if (!alwaysPenDown) {
      turtle.isPenDown = true;
      actionLog.push({ type: 'penDown' });
      redrawAll();
    }
  }

  function penUp() {
    if (!alwaysPenDown) {
      turtle.isPenDown = false;
      actionLog.push({ type: 'penUp' });
      redrawAll();
    }
  }

  function animateFrames(durationMs, token, onFrame) {
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        if (token !== runToken) {
          resolve(false);
          return;
        }
        const t = Math.min(1, (now - start) / durationMs);
        onFrame(t);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve(true);
        }
      }
      requestAnimationFrame(frame);
    });
  }

  async function moveSteps(steps, token) {
    if (token !== runToken) return;
    const numSteps = Number(steps);
    if (!Number.isFinite(numSteps)) return;

    const startX = turtle.x;
    const startY = turtle.y;
    const rad = (turtle.angle * Math.PI) / 180;
    const pixelDist = numSteps * drawScale;
    const targetX = startX + pixelDist * Math.cos(rad);
    const targetY = startY + pixelDist * Math.sin(rad);
    const drawing = turtle.isPenDown || alwaysPenDown;

    actionLog.push({ type: 'move', steps: numSteps, drawing });

    const ok = await animateFrames(fastMode ? 35 : 300, token, (t) => {
      const curX = startX + (targetX - startX) * t;
      const curY = startY + (targetY - startY) * t;
      if (drawing) {
        activePath = { x1: startX, y1: startY, x2: curX, y2: curY };
      }
      turtle.x = curX;
      turtle.y = curY;
      redrawAll();
    });

    activePath = null;
    if (!ok) return;

    if (drawing && Math.abs(numSteps) > 0.1) {
      drawnPaths.push({ x1: startX, y1: startY, x2: targetX, y2: targetY });
      segments.push({
        x1: startX,
        y1: startY,
        x2: targetX,
        y2: targetY,
        length: Math.abs(numSteps),
        angle: turtle.angle
      });
    }
    redrawAll();
  }

  function sleepWithToken(ms, token) {
    return new Promise((resolve) => {
      const start = performance.now();
      function check(now) {
        if (token !== runToken) {
          resolve(false);
          return;
        }
        if (now - start >= ms) {
          resolve(true);
        } else {
          requestAnimationFrame(check);
        }
      }
      requestAnimationFrame(check);
    });
  }

  async function turnDegrees(deg, token) {
    if (token !== runToken) return;
    const numDeg = Number(deg);
    if (!Number.isFinite(numDeg)) return;

    const fromAngle = turtle.angle;
    const targetAngle = fromAngle + numDeg;
    actionLog.push({ type: 'turn', deg: numDeg });
    turns.push(numDeg);

    const ok = await animateFrames(fastMode ? 25 : 360, token, (t) => {
      const curAngle = fromAngle + numDeg * t;
      turtle.angle = curAngle;
      activeTurnArc = {
        x: turtle.x,
        y: turtle.y,
        fromAngle,
        currentAngle: curAngle
      };
      redrawAll();
    });

    if (!ok) {
      activeTurnArc = null;
      return;
    }

    turtle.angle = targetAngle;
    if (fastMode) {
      activeTurnArc = null;
      recordedTurnArcs.push({
        x: turtle.x,
        y: turtle.y,
        fromAngle,
        currentAngle: targetAngle
      });
      redrawAll();
      return;
    }

    activeTurnArc = {
      x: turtle.x,
      y: turtle.y,
      fromAngle,
      currentAngle: targetAngle
    };
    redrawAll();

    const kept = await sleepWithToken(600, token);
    activeTurnArc = null;
    if (kept) {
      recordedTurnArcs.push({
        x: turtle.x,
        y: turtle.y,
        fromAngle,
        currentAngle: targetAngle
      });
      redrawAll();
    }
  }

  function isDrawingOutOfDefaultView() {
    const margin = 12;
    for (let i = 0; i < drawnPaths.length; i++) {
      const p = drawnPaths[i];
      if (
        p.x1 < margin || p.x1 > LOGICAL_SIZE - margin ||
        p.y1 < margin || p.y1 > LOGICAL_SIZE - margin ||
        p.x2 < margin || p.x2 > LOGICAL_SIZE - margin ||
        p.y2 < margin || p.y2 > LOGICAL_SIZE - margin
      ) {
        return true;
      }
    }
    return false;
  }

  function getState() {
    return {
      turtle: { ...turtle },
      segments: segments.slice(),
      turns: turns.slice(),
      actionLog: actionLog.slice(),
      isOutOfView: isDrawingOutOfDefaultView()
    };
  }

  notifyView();

  return {
    setConfig,
    getToken,
    cancelRun,
    reset,
    redrawAll,
    penDown,
    penUp,
    moveSteps,
    turnDegrees,
    getState,
    resetView,
    zoomBy,
    fitToDrawing
  };
};
