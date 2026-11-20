/* =========================================================
   音速ラボ - モード2：音速レース（伝わり方シミュレーター）
   ========================================================= */

(function (global) {
  'use strict';

  var MEDIUM_LABELS = {
    vacuum: '宇宙（真空）',
    air: '空気（気体）',
    water: '水（液体）',
    iron: '鉄（固体）'
  };

  var state = {
    courseDistance: 100,
    timeScale: 0.1, // 1 | 0.1 | 0.02
    running: false,
    simElapsedSec: 0,
    lastFrameTime: 0,
    rafId: null,
    isActiveView: false,
    winnerLaneId: null,
    lanes: [
      {
        id: 1,
        medium: 'air',
        temp: 15,
        speed: 340.5,
        progress: 0,
        finished: false,
        finishTimeSec: null,
        rippleAge: 0,
        particles: []
      },
      {
        id: 2,
        medium: 'water',
        temp: 15,
        speed: 1467.5,
        progress: 0,
        finished: false,
        finishTimeSec: null,
        rippleAge: 0,
        particles: []
      }
    ]
  };

  var els = {};

  function calcSoundSpeed(medium, tempC) {
    switch (medium) {
      case 'vacuum':
        return 0;
      case 'air':
        return 331.5 + 0.6 * tempC;
      case 'water':
        return 1480 + 2.5 * (tempC - 20);
      case 'iron':
        return 5130;
      default:
        return 340.5;
    }
  }

  // 粒子モデル生成（固体：規則的格子、液体：やや密なランダム、気体：まばら、真空：0個）
  function buildParticles(medium) {
    var list = [];
    if (medium === 'vacuum') {
      // 真空は背景の星だけ別描画、音を伝える粒は0個
      for (var s = 0; s < 28; s++) {
        list.push({
          isStar: true,
          nx: Math.random(),
          ny: Math.random(),
          r: 0.8 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2
        });
      }
      return list;
    }

    if (medium === 'iron') {
      var cols = 30;
      var rows = 4;
      for (var rIdx = 0; rIdx < rows; rIdx++) {
        for (var cIdx = 0; cIdx < cols; cIdx++) {
          list.push({
            nx: (cIdx + 0.5) / cols,
            ny: 0.22 + ((rIdx + 0.5) / rows) * 0.56,
            vx: 0,
            vy: 0,
            phase: (cIdx * 0.4) + (rIdx * 0.7),
            radius: 4.5
          });
        }
      }
      return list;
    }

    if (medium === 'water') {
      var countW = 84;
      for (var w = 0; w < countW; w++) {
        list.push({
          nx: Math.random(),
          ny: 0.16 + Math.random() * 0.68,
          vx: (Math.random() - 0.5) * 0.04,
          vy: (Math.random() - 0.5) * 0.06,
          phase: Math.random() * Math.PI * 2,
          radius: 4.0
        });
      }
      return list;
    }

    // air (気体)
    var countA = 40;
    for (var a = 0; a < countA; a++) {
      list.push({
        nx: Math.random(),
        ny: 0.16 + Math.random() * 0.68,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.24,
        phase: Math.random() * Math.PI * 2,
        radius: 4.2
      });
    }
    return list;
  }

  function cacheElements() {
    els.distBtns = document.querySelectorAll('[data-race-dist]');
    els.scaleBtns = document.querySelectorAll('[data-race-scale]');
    els.elapsedDisplay = document.getElementById('race-elapsed-display');
    els.btnStart = document.getElementById('btn-race-start');
    els.btnReset = document.getElementById('btn-race-reset');
    els.btnMute = document.getElementById('btn-sound-mute');

    els.laneEls = [1, 2].map(function (id) {
      return {
        mediumSelect: document.getElementById('lane' + id + '-medium'),
        tempWrap: document.getElementById('lane' + id + '-temp-wrap'),
        tempSlider: document.getElementById('lane' + id + '-temp'),
        tempVal: document.getElementById('lane' + id + '-temp-val'),
        speedBadge: document.getElementById('lane' + id + '-speed-badge'),
        finishBadge: document.getElementById('lane' + id + '-finish-badge'),
        canvas: document.getElementById('lane' + id + '-canvas')
      };
    });
  }

  function updateLaneUI(laneIndex) {
    var lane = state.lanes[laneIndex];
    var dom = els.laneEls[laneIndex];

    lane.speed = calcSoundSpeed(lane.medium, lane.temp);

    var isVacuum = lane.medium === 'vacuum';
    dom.tempSlider.disabled = isVacuum || state.running;
    dom.mediumSelect.disabled = state.running;
    dom.tempWrap.classList.toggle('is-disabled', isVacuum);

    if (isVacuum) {
      dom.tempVal.textContent = '-- ℃';
      dom.speedBadge.textContent = '音速: 0 m/s（伝わらない）';
    } else {
      dom.tempVal.textContent = lane.temp + ' ℃';
      if (lane.medium === 'iron') {
        dom.speedBadge.textContent = '音速: 約 ' + lane.speed.toFixed(0) + ' m/s';
      } else {
        dom.speedBadge.textContent = '音速: ' + lane.speed.toFixed(1) + ' m/s';
      }
    }

    updateFinishBadge(laneIndex);
  }

  function updateFinishBadge(laneIndex) {
    var lane = state.lanes[laneIndex];
    var badge = els.laneEls[laneIndex].finishBadge;

    badge.classList.remove('is-winner', 'is-finished', 'is-vacuum');

    if (lane.medium === 'vacuum') {
      if (state.running || state.simElapsedSec > 0) {
        badge.textContent = '伝わらない';
        badge.classList.add('is-vacuum');
      } else {
        badge.textContent = '媒質なし（真空）';
      }
      return;
    }

    if (lane.finished && lane.finishTimeSec !== null) {
      var prefix = state.winnerLaneId === lane.id ? '🏆 1位！ ' : 'ゴール！ ';
      if (state.winnerLaneId === 'tie') {
        prefix = '🤝 同時！ ';
      }
      badge.textContent = prefix + lane.finishTimeSec.toFixed(3) + ' 秒';
      badge.classList.add(state.winnerLaneId === lane.id ? 'is-winner' : 'is-finished');
    } else if (state.running) {
      badge.textContent = '伝達中… ' + Math.round(lane.progress * 100) + '%';
    } else {
      badge.textContent = '待機中';
    }
  }

  function resizeCanvases() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.laneEls.forEach(function (dom) {
      var wrap = dom.canvas.parentElement;
      if (!wrap) return;
      var rect = wrap.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      dom.canvas.width = Math.round(rect.width * dpr);
      dom.canvas.height = Math.round(rect.height * dpr);
      var ctx = dom.canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  function resetSimulation() {
    state.running = false;
    state.simElapsedSec = 0;
    state.winnerLaneId = null;

    state.lanes.forEach(function (lane, idx) {
      lane.progress = 0;
      lane.finished = false;
      lane.finishTimeSec = null;
      lane.rippleAge = 0;
      updateLaneUI(idx);
    });

    els.elapsedDisplay.textContent = '0.000 秒';
    els.btnStart.disabled = false;
    els.btnStart.textContent = '▶ 一斉スタート！';

    els.distBtns.forEach(function (b) { b.disabled = false; });
    els.scaleBtns.forEach(function (b) { b.disabled = false; });
  }

  function startSimulation() {
    if (state.running) return;
    resetSimulation();

    if (global.OnsokuAudio) {
      global.OnsokuAudio.ensureAudioContext();
      global.OnsokuAudio.playStartCue();
    }

    state.running = true;
    state.lastFrameTime = performance.now();
    els.btnStart.disabled = true;
    els.btnStart.textContent = '▶ 比較中…';

    els.distBtns.forEach(function (b) { b.disabled = true; });
    els.scaleBtns.forEach(function (b) { b.disabled = true; });

    state.lanes.forEach(function (_, idx) {
      updateLaneUI(idx);
    });
  }

  function stepPhysics(dtRealSec, nowMs) {
    // 非走行中でも粒子の熱運動だけ滑らかに動かす
    var thermalBase = dtRealSec;
    state.lanes.forEach(function (lane) {
      if (lane.medium === 'air') {
        // 気温が高いほど激しく動く (-10℃ -> 0.5倍, 40℃ -> 1.6倍)
        var tempFactor = 0.7 + ((lane.temp + 10) / 50) * 1.1;
        lane.particles.forEach(function (p) {
          p.nx += p.vx * thermalBase * tempFactor;
          p.ny += p.vy * thermalBase * tempFactor;
          if (p.nx < 0.01) { p.nx = 0.01; p.vx = Math.abs(p.vx); }
          if (p.nx > 0.99) { p.nx = 0.99; p.vx = -Math.abs(p.vx); }
          if (p.ny < 0.14) { p.ny = 0.14; p.vy = Math.abs(p.vy); }
          if (p.ny > 0.86) { p.ny = 0.86; p.vy = -Math.abs(p.vy); }
        });
      } else if (lane.medium === 'water') {
        var waterFactor = 0.7 + ((lane.temp + 10) / 50) * 0.5;
        lane.particles.forEach(function (p) {
          p.nx += p.vx * thermalBase * waterFactor;
          p.ny += p.vy * thermalBase * waterFactor;
          if (p.nx < 0.01) { p.nx = 0.01; p.vx = Math.abs(p.vx); }
          if (p.nx > 0.99) { p.nx = 0.99; p.vx = -Math.abs(p.vx); }
          if (p.ny < 0.14) { p.ny = 0.14; p.vy = Math.abs(p.vy); }
          if (p.ny > 0.86) { p.ny = 0.86; p.vy = -Math.abs(p.vy); }
        });
      }

      if (lane.finished && lane.rippleAge < 1.2) {
        lane.rippleAge += dtRealSec;
      }
    });

    if (!state.running) return;

    state.simElapsedSec += dtRealSec * state.timeScale;
    els.elapsedDisplay.textContent = state.simElapsedSec.toFixed(3) + ' 秒';

    var newlyFinished = [];
    var hasActiveTransmittingLane = false;

    state.lanes.forEach(function (lane, idx) {
      if (lane.medium === 'vacuum' || lane.speed <= 0) {
        return;
      }
      if (!lane.finished) {
        var traveled = lane.speed * state.simElapsedSec;
        lane.progress = Math.min(1, traveled / state.courseDistance);
        if (lane.progress >= 1) {
          lane.finished = true;
          lane.finishTimeSec = state.courseDistance / lane.speed;
          lane.rippleAge = 0;
          newlyFinished.push(lane);
        } else {
          hasActiveTransmittingLane = true;
        }
      }
      updateFinishBadge(idx);
    });

    if (newlyFinished.length > 0) {
      if (state.winnerLaneId === null) {
        if (newlyFinished.length === 2 &&
            Math.abs(newlyFinished[0].finishTimeSec - newlyFinished[1].finishTimeSec) < 0.0005) {
          state.winnerLaneId = 'tie';
        } else {
          newlyFinished.sort(function (a, b) {
            return a.finishTimeSec - b.finishTimeSec;
          });
          state.winnerLaneId = newlyFinished[0].id;
        }
      }

      newlyFinished.forEach(function (lane) {
        if (global.OnsokuAudio) {
          global.OnsokuAudio.playLaneFinish(lane.id);
        }
      });

      state.lanes.forEach(function (_, idx) {
        updateFinishBadge(idx);
      });
    }

    // 両方とも真空の場合、1.5秒演出後に終了
    var bothVacuum = state.lanes[0].medium === 'vacuum' && state.lanes[1].medium === 'vacuum';
    if (!hasActiveTransmittingLane && (!bothVacuum || state.simElapsedSec >= 0.15)) {
      state.running = false;
      els.btnStart.disabled = false;
      els.btnStart.textContent = '▶ もう一度スタート！';
      els.distBtns.forEach(function (b) { b.disabled = false; });
      els.scaleBtns.forEach(function (b) { b.disabled = false; });
      state.lanes.forEach(function (_, idx) {
        updateLaneUI(idx);
      });
    }
  }

  function drawSpeakerIcon(ctx, x, y, active) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = active ? '#2563eb' : '#334155';
    ctx.beginPath();
    ctx.moveTo(-12, -7);
    ctx.lineTo(-4, -7);
    ctx.lineTo(6, -14);
    ctx.lineTo(6, 14);
    ctx.lineTo(-4, 7);
    ctx.lineTo(-12, 7);
    ctx.closePath();
    ctx.fill();

    // 音の放射マーク
    ctx.strokeStyle = active ? '#f59e0b' : '#94a3b8';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(9, 0, 6, -0.7, 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9, 0, 11, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
  }

  function drawEarIcon(ctx, x, y, arrived, rippleAge, isDarkBg) {
    ctx.save();
    ctx.translate(x, y);

    if (arrived && rippleAge < 1.0) {
      var r = 14 + rippleAge * 28;
      var alpha = Math.max(0, 1 - rippleAge);
      ctx.strokeStyle = 'rgba(234, 179, 8, ' + alpha.toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = arrived ? '#fef08a' : (isDarkBg ? '#334155' : '#f1f5f9');
    ctx.strokeStyle = arrived ? '#eab308' : (isDarkBg ? '#94a3b8' : '#475569');
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // シンプルな耳のシルエット
    ctx.strokeStyle = arrived ? '#b45309' : (isDarkBg ? '#e2e8f0' : '#1e293b');
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-1, -2, 7, Math.PI * 0.85, Math.PI * 2.15);
    ctx.quadraticCurveTo(6, 7, 1, 9);
    ctx.quadraticCurveTo(-4, 10, -4, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -1, 3, -0.5, Math.PI * 0.9);
    ctx.stroke();

    ctx.restore();
  }

  function renderLane(laneIndex, nowMs) {
    var lane = state.lanes[laneIndex];
    var canvas = els.laneEls[laneIndex].canvas;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    if (w <= 0 || h <= 0) return;

    var ctx = canvas.getContext('2d');
    var isVacuum = lane.medium === 'vacuum';

    // 背景グラデーション
    var grad = ctx.createLinearGradient(0, 0, w, 0);
    if (isVacuum) {
      grad.addColorStop(0, '#090d1e');
      grad.addColorStop(1, '#172042');
    } else if (lane.medium === 'air') {
      grad.addColorStop(0, '#f0f9ff');
      grad.addColorStop(1, '#e0f2fe');
    } else if (lane.medium === 'water') {
      grad.addColorStop(0, '#cffafe');
      grad.addColorStop(1, '#a5f3fc');
    } else {
      grad.addColorStop(0, '#e2e8f0');
      grad.addColorStop(1, '#cbd5e1');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    var startX = 48;
    var endX = w - 48;
    var trackW = Math.max(40, endX - startX);
    var centerY = h * 0.5;

    // 距離目盛り線（下部）
    var tickY = h - 16;
    ctx.strokeStyle = isVacuum ? 'rgba(148, 163, 184, 0.35)' : 'rgba(51, 65, 85, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(startX, tickY);
    ctx.lineTo(endX, tickY);
    ctx.stroke();

    ctx.fillStyle = isVacuum ? '#94a3b8' : '#475569';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'center';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (ratio) {
      var tx = startX + trackW * ratio;
      ctx.beginPath();
      ctx.moveTo(tx, tickY - 4);
      ctx.lineTo(tx, tickY + 4);
      ctx.stroke();
      ctx.fillText(Math.round(state.courseDistance * ratio) + 'm', tx, tickY - 7);
    });

    // 粒子と音波の描画
    var waveFrontX = startX + trackW * lane.progress;
    var waveBand = Math.max(36, trackW * 0.08);
    var hasWave = !isVacuum && (state.running || lane.progress > 0);

    if (isVacuum) {
      // 真空の星
      lane.particles.forEach(function (star) {
        var twinkle = 0.4 + 0.6 * Math.abs(Math.sin(nowMs * 0.0015 + star.phase));
        ctx.fillStyle = 'rgba(248, 250, 252, ' + twinkle.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(star.nx * w, star.ny * h, star.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
      ctx.font = '800 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        state.running || state.simElapsedSec > 0
          ? '⚠ 音を伝える物質（空気などの粒）がないため、音は伝わらない！'
          : '宇宙（真空）：音を伝える物質（粒）がない空間',
        w / 2,
        centerY + 4
      );
    } else {
      // 進行済みエリアのうっすらハイライト
      if (hasWave) {
        ctx.fillStyle = lane.id === 1
          ? 'rgba(37, 99, 235, 0.08)'
          : 'rgba(234, 88, 12, 0.08)';
        ctx.fillRect(startX, 10, waveFrontX - startX, h - 34);
      }

      // 物質の粒（疎密波として進行波付近で水平に振動する）
      var baseColor = lane.medium === 'iron'
        ? '#475569'
        : (lane.medium === 'water' ? '#0284c7' : '#2563eb');
      var activeColor = lane.id === 1 ? '#f59e0b' : '#ef4444';

      lane.particles.forEach(function (p) {
        var px = startX + p.nx * trackW;
        var py = p.ny * (h - 24);

        // 熱振動（固体の格子は小さくその場で振動）
        if (lane.medium === 'iron') {
          var vibAmp = 0.8 + ((lane.temp + 10) / 50) * 1.1;
          px += Math.sin(nowMs * 0.025 + p.phase) * vibAmp;
          py += Math.cos(nowMs * 0.022 + p.phase) * vibAmp;
        }

        var isNearWave = false;
        if (hasWave && lane.progress < 1) {
          var distToFront = waveFrontX - px;
          if (distToFront >= -10 && distToFront <= waveBand) {
            isNearWave = true;
            // 縦波（進行方向に平行な疎密変位）
            var norm = distToFront / waveBand;
            var displacement = Math.sin(norm * Math.PI * 2) * 8;
            px += displacement;
          }
        }

        ctx.fillStyle = isNearWave ? activeColor : baseColor;
        ctx.globalAlpha = isNearWave ? 0.95 : (lane.medium === 'air' ? 0.72 : 0.82);
        ctx.beginPath();
        ctx.arc(px, py, isNearWave ? p.radius + 1.2 : p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // 波面のライン描画
      if (hasWave) {
        ctx.strokeStyle = lane.id === 1 ? '#1d4ed8' : '#c2410c';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(waveFrontX, 12);
        ctx.lineTo(waveFrontX, h - 24);
        ctx.stroke();

        // 波面ラベル（走行中のみ）
        if (state.running && !lane.finished) {
          ctx.fillStyle = lane.id === 1 ? '#1d4ed8' : '#c2410c';
          ctx.font = '800 12px sans-serif';
          ctx.textAlign = lane.progress > 0.85 ? 'right' : 'left';
          var labelX = lane.progress > 0.85 ? waveFrontX - 6 : waveFrontX + 6;
          ctx.fillText('音の波', labelX, 24);
        }
      }
    }

    // 左端スピーカー & 右端耳アイコン
    drawSpeakerIcon(ctx, 24, centerY - 6, state.running && !isVacuum);
    drawEarIcon(ctx, w - 24, centerY - 6, lane.finished, lane.rippleAge, isVacuum);
  }

  function animationLoop(nowMs) {
    if (!state.isActiveView) {
      state.rafId = null;
      return;
    }

    var dtRealSec = state.lastFrameTime ? Math.min(0.05, (nowMs - state.lastFrameTime) / 1000) : 0.016;
    state.lastFrameTime = nowMs;

    stepPhysics(dtRealSec, nowMs);
    renderLane(0, nowMs);
    renderLane(1, nowMs);

    state.rafId = requestAnimationFrame(animationLoop);
  }

  function startAnimationLoop() {
    if (state.rafId !== null) return;
    state.lastFrameTime = performance.now();
    state.rafId = requestAnimationFrame(animationLoop);
  }

  function stopAnimationLoop() {
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }

  function bindEvents() {
    els.distBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.running) return;
        var d = Number(this.getAttribute('data-race-dist'));
        state.courseDistance = d;
        els.distBtns.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        resetSimulation();
      });
    });

    els.scaleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.running) return;
        var s = Number(this.getAttribute('data-race-scale'));
        state.timeScale = s;
        els.scaleBtns.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        resetSimulation();
      });
    });

    els.btnStart.addEventListener('click', function () {
      startSimulation();
    });

    els.btnReset.addEventListener('click', function () {
      resetSimulation();
    });

    els.btnMute.addEventListener('click', function () {
      if (!global.OnsokuAudio) return;
      var nextMuted = !global.OnsokuAudio.getMuted();
      global.OnsokuAudio.setMuted(nextMuted);
      els.btnMute.classList.toggle('is-muted', nextMuted);
      els.btnMute.setAttribute('aria-pressed', String(nextMuted));
      els.btnMute.textContent = nextMuted ? '🔇 消音中' : '🔊 音 ON';
    });

    els.laneEls.forEach(function (dom, idx) {
      dom.mediumSelect.addEventListener('change', function () {
        if (state.running) return;
        var lane = state.lanes[idx];
        lane.medium = this.value;
        lane.particles = buildParticles(lane.medium);
        resetSimulation();
      });

      dom.tempSlider.addEventListener('input', function () {
        if (state.running) return;
        state.lanes[idx].temp = Number(this.value);
        updateLaneUI(idx);
      });
    });

    window.addEventListener('resize', function () {
      if (state.isActiveView) {
        resizeCanvases();
      }
    });
  }

  function onEnterView() {
    state.isActiveView = true;
    resizeCanvases();
    startAnimationLoop();
  }

  function onLeaveView() {
    state.isActiveView = false;
    stopAnimationLoop();
    resetSimulation();
  }

  function init() {
    cacheElements();
    state.lanes.forEach(function (lane, idx) {
      lane.particles = buildParticles(lane.medium);
      updateLaneUI(idx);
    });
    bindEvents();
  }

  global.OnsokuRace = {
    init: init,
    onEnterView: onEnterView,
    onLeaveView: onLeaveView,
    MEDIUM_LABELS: MEDIUM_LABELS
  };
})(window);
