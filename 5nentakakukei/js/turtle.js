/**
 * turtle.js
 * タートル描画エンジン（高解像度対応・滑らかな移動/回転アニメ・ガイド線・軌跡記録）
 */
window.TakakukeiApp = window.TakakukeiApp || {};

window.TakakukeiApp.createTurtleEngine = function (canvas) {
  const LOGICAL_SIZE = 420;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = LOGICAL_SIZE * DPR;
  canvas.height = LOGICAL_SIZE * DPR;

  const ctx = canvas.getContext('2d');
  const trackCanvas = document.createElement('canvas');
  trackCanvas.width = LOGICAL_SIZE * DPR;
  trackCanvas.height = LOGICAL_SIZE * DPR;
  const trackCtx = trackCanvas.getContext('2d');
  trackCtx.scale(DPR, DPR);

  let turtle = { x: 210, y: 260, angle: -90, isPenDown: true };
  let startPos = { x: 210, y: 260, angle: -90 };
  let currentGoalType = 'line';
  let showGuide = true;
  let showTurnAngles = true;
  let alwaysPenDown = false;
  let drawScale = 1.0;
  let runToken = 0;

  // 回転中の外角可視化用オーバーレイ＆表示しっぱなし用履歴
  let activeTurnArc = null; // { x, y, fromAngle, currentAngle }
  let recordedTurnArcs = [];

  // 判定用ログ
  let segments = [];
  let turns = [];
  let actionLog = [];

  function setConfig(opts) {
    if (opts.startPos) startPos = { ...opts.startPos };
    if (opts.goalType !== undefined) currentGoalType = opts.goalType;
    if (opts.showGuide !== undefined) showGuide = opts.showGuide;
    if (opts.showTurnAngles !== undefined) showTurnAngles = opts.showTurnAngles;
    if (opts.alwaysPenDown !== undefined) alwaysPenDown = opts.alwaysPenDown;
    if (opts.drawScale !== undefined) drawScale = Number(opts.drawScale) || 1.0;
  }

  function getToken() {
    return runToken;
  }

  function cancelRun() {
    runToken++;
    activeTurnArc = null;
    redrawAll();
  }

  function reset(initialPenDown) {
    runToken++;
    activeTurnArc = null;
    recordedTurnArcs = [];
    segments = [];
    turns = [];
    actionLog = [];
    trackCtx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    turtle = {
      x: startPos.x,
      y: startPos.y,
      angle: startPos.angle,
      isPenDown: initialPenDown
    };
    redrawAll();
  }

  function drawGrid(targetCtx) {
    targetCtx.save();
    targetCtx.strokeStyle = '#f1f5f9';
    targetCtx.lineWidth = 1;
    for (let p = 20; p < LOGICAL_SIZE; p += 50) {
      targetCtx.beginPath();
      targetCtx.moveTo(p, 0);
      targetCtx.lineTo(p, LOGICAL_SIZE);
      targetCtx.stroke();

      targetCtx.beginPath();
      targetCtx.moveTo(0, p);
      targetCtx.lineTo(LOGICAL_SIZE, p);
      targetCtx.stroke();
    }
    targetCtx.restore();
  }

  function drawGuideShape(targetCtx) {
    if (!showGuide || !currentGoalType || currentGoalType === 'free') return;

    targetCtx.save();
    targetCtx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    targetCtx.lineWidth = 3;
    targetCtx.setLineDash([7, 6]);
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';

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

  function drawTurnArc(targetCtx, arc, isActive) {
    if (!arc) return;
    const { x, y, fromAngle, currentAngle } = arc;
    const delta = currentAngle - fromAngle;
    if (Math.abs(delta) < 1) return;

    const radius = isActive ? 32 : 25;
    const extLen = isActive ? 56 : 44;
    const labelDist = isActive ? 48 : 39;

    targetCtx.save();
    // 元の直進方向の点線
    const fromRad = (fromAngle * Math.PI) / 180;
    targetCtx.beginPath();
    targetCtx.setLineDash([4, 4]);
    targetCtx.strokeStyle = isActive ? '#475569' : 'rgba(100, 116, 139, 0.75)';
    targetCtx.lineWidth = isActive ? 2.2 : 1.8;
    targetCtx.moveTo(x, y);
    targetCtx.lineTo(x + extLen * Math.cos(fromRad), y + extLen * Math.sin(fromRad));
    targetCtx.stroke();

    // 回転扇形
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
    targetCtx.lineWidth = isActive ? 2.5 : 2;
    targetCtx.stroke();

    // 角度テキスト（白い縁取り付き・画面端クランプ）
    const midRad = ((fromAngle + currentAngle) / 2) * (Math.PI / 180);
    const tx = Math.max(18, Math.min(LOGICAL_SIZE - 18, x + labelDist * Math.cos(midRad)));
    const ty = Math.max(14, Math.min(LOGICAL_SIZE - 14, y + labelDist * Math.sin(midRad)));
    const label = `${Math.round(Math.abs(delta))}°`;
    targetCtx.font = isActive ? 'bold 14px sans-serif' : 'bold 13px sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.lineWidth = 4;
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
    ctx.save();
    ctx.translate(turtle.x, turtle.y);
    const rad = (turtle.angle * Math.PI) / 180;

    // 進行方向のガイド点線（短め）
    ctx.save();
    ctx.rotate(rad);
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 2;
    ctx.moveTo(16, 0);
    ctx.lineTo(42, 0);
    ctx.stroke();
    ctx.restore();

    // タートル本体（赤い矢印）
    ctx.rotate((turtle.angle + 90) * (Math.PI / 180));
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 12);
    ctx.lineTo(0, 6);
    ctx.lineTo(-12, 12);
    ctx.closePath();

    ctx.fillStyle = (turtle.isPenDown || alwaysPenDown) ? '#ef4444' : '#94a3b8';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  function redrawAll() {
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    drawGrid(ctx);
    drawGuideShape(ctx);
    ctx.drawImage(trackCanvas, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
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

    let prevX = startX;
    let prevY = startY;

    const ok = await animateFrames(300, token, (t) => {
      const curX = startX + (targetX - startX) * t;
      const curY = startY + (targetY - startY) * t;
      if (drawing) {
        trackCtx.beginPath();
        trackCtx.moveTo(prevX, prevY);
        trackCtx.lineTo(curX, curY);
        trackCtx.strokeStyle = '#2563eb';
        trackCtx.lineWidth = 4.5;
        trackCtx.lineCap = 'round';
        trackCtx.stroke();
      }
      prevX = curX;
      prevY = curY;
      turtle.x = curX;
      turtle.y = curY;
      redrawAll();
    });

    if (!ok) return;

    if (drawing && Math.abs(numSteps) > 0.1) {
      segments.push({
        x1: startX,
        y1: startY,
        x2: targetX,
        y2: targetY,
        length: Math.abs(numSteps),
        angle: turtle.angle
      });
    }
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

    // 1. 回転アニメーション（360ms）
    const ok = await animateFrames(360, token, (t) => {
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

    // 2. 曲がった角度を視認できるよう、扇形と角度を表示したまま一時停止（600ms）
    turtle.angle = targetAngle;
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

  function getState() {
    return {
      turtle: { ...turtle },
      segments: segments.slice(),
      turns: turns.slice(),
      actionLog: actionLog.slice()
    };
  }

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
    getState
  };
};
