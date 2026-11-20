/* =========================================================
   音速ラボ - モード1：音速ハンター（実測計測ツール）
   ========================================================= */

(function (global) {
  'use strict';

  var MAX_HISTORY = 5;
  var MIC_ARM_DELAY_MS = 55; // 画面タップ直後の振動・音の誤検知防止

  var state = {
    distance: 100,
    temperature: 15,
    mode: 'manual', // 'manual' | 'mic'
    micThreshold: 55,
    measuring: false,
    startTime: 0,
    rafId: null,
    lastResult: null, // { distance, timeSec, speed }
    history: [], // [{ id, trialNo, distance, timeSec, speed }]
    trialCounter: 0
  };

  var els = {};
  var ignoreClickUntil = 0;

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function calcTheoreticalSpeed(tempC) {
    return 331.5 + 0.6 * tempC;
  }

  function cacheElements() {
    els.view = document.getElementById('view-hunter');
    els.distSlider = document.getElementById('hunter-distance-slider');
    els.distInput = document.getElementById('hunter-distance-input');
    els.btnMinus = document.getElementById('btn-dist-minus');
    els.btnPlus = document.getElementById('btn-dist-plus');
    els.presetBtns = document.querySelectorAll('.btn-preset');

    els.btnModeManual = document.getElementById('btn-mode-manual');
    els.btnModeMic = document.getElementById('btn-mode-mic');
    els.micPanel = document.getElementById('mic-panel');
    els.micMeterFill = document.getElementById('mic-meter-fill');
    els.micThresholdMarker = document.getElementById('mic-threshold-marker');
    els.micStatusText = document.getElementById('mic-status-text');
    els.micThresholdSlider = document.getElementById('mic-threshold-slider');
    els.micThresholdValue = document.getElementById('mic-threshold-value');
    els.micErrorMsg = document.getElementById('mic-error-msg');

    els.timerStatus = document.getElementById('hunter-timer-status');
    els.timerDisplay = document.getElementById('hunter-timer-display');
    els.btnCancel = document.getElementById('btn-hunter-cancel');
    els.btnMain = document.getElementById('btn-hunter-main');

    els.resFormula = document.getElementById('hunter-result-formula');
    els.resTime = document.getElementById('res-time');
    els.resSpeed = document.getElementById('res-speed');

    els.btnToggleRef = document.getElementById('btn-toggle-ref');
    els.refToggleArrow = document.getElementById('ref-toggle-arrow');
    els.refBody = document.getElementById('ref-body');
    els.tempSlider = document.getElementById('hunter-temp-slider');
    els.tempInput = document.getElementById('hunter-temp-input');
    els.refTheoretical = document.getElementById('ref-theoretical-speed');
    els.refDiff = document.getElementById('ref-diff-text');

    els.btnClearHistory = document.getElementById('btn-clear-history');
    els.historyBody = document.getElementById('hunter-history-body');
    els.avgCount = document.getElementById('avg-count');
    els.avgSpeed = document.getElementById('avg-speed-value');
  }

  function updateDistance(newDist) {
    var d = clamp(Math.round(Number(newDist) || 100), 10, 500);
    state.distance = d;
    els.distSlider.value = String(d);
    els.distInput.value = String(d);

    els.presetBtns.forEach(function (btn) {
      var preset = Number(btn.getAttribute('data-distance'));
      btn.classList.toggle('active', preset === d);
    });
  }

  function updateTemperature(newTemp) {
    var t = clamp(Math.round(Number(newTemp) || 0), -10, 40);
    if (isNaN(Number(newTemp))) t = 15;
    state.temperature = t;
    els.tempSlider.value = String(t);
    els.tempInput.value = String(t);
    updateReferenceDisplay();
  }

  function updateReferenceDisplay() {
    var theory = calcTheoreticalSpeed(state.temperature);
    els.refTheoretical.textContent = theory.toFixed(1) + ' m/s';

    if (!state.lastResult) {
      els.refDiff.textContent = '--';
      return;
    }

    var diff = state.lastResult.speed - theory;
    var sign = diff >= 0 ? '+' : '';
    els.refDiff.textContent = sign + diff.toFixed(1) + ' m/s';
  }

  function renderTimer(seconds) {
    els.timerDisplay.innerHTML = seconds.toFixed(3) + ' <span class="timer-unit">秒</span>';
  }

  function setMainButtonState(isRunning) {
    if (isRunning) {
      els.btnMain.classList.remove('state-ready');
      els.btnMain.classList.add('state-running');
      els.btnMain.innerHTML =
        '<span class="mega-icon">🔊</span>' +
        '<span class="mega-text">音が聞こえた！（ストップ）</span>';
      els.timerStatus.textContent = state.mode === 'mic' ? '🎤 音を待っています！' : '⏱ 計測中…';
      els.timerStatus.classList.add('is-running');
      els.btnCancel.hidden = false;
    } else {
      els.btnMain.classList.remove('state-running');
      els.btnMain.classList.add('state-ready');
      els.btnMain.innerHTML =
        '<span class="mega-icon">🚩</span>' +
        '<span class="mega-text">光が見えた！（スタート）</span>';
      els.timerStatus.textContent = 'じゅんび完了';
      els.timerStatus.classList.remove('is-running');
      els.btnCancel.hidden = true;
    }
  }

  function startMeasurement() {
    if (state.measuring) return;
    if (global.OnsokuAudio) {
      global.OnsokuAudio.ensureAudioContext();
    }

    state.measuring = true;
    state.startTime = performance.now();
    setMainButtonState(true);
    renderTimer(0);

    function loop(now) {
      if (!state.measuring) return;
      var elapsedSec = Math.max(0, (now - state.startTime) / 1000);
      renderTimer(elapsedSec);
      state.rafId = requestAnimationFrame(loop);
    }
    state.rafId = requestAnimationFrame(loop);
  }

  function cancelMeasurement() {
    if (!state.measuring) return;
    state.measuring = false;
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    setMainButtonState(false);
    renderTimer(0);
  }

  function stopMeasurement(endTimestamp) {
    if (!state.measuring) return;
    var end = typeof endTimestamp === 'number' ? endTimestamp : performance.now();
    state.measuring = false;
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }

    var timeSec = Math.max(0.001, (end - state.startTime) / 1000);
    var speed = state.distance / timeSec;

    renderTimer(timeSec);
    setMainButtonState(false);
    els.timerStatus.textContent = '✅ 計測おわり';

    state.lastResult = {
      distance: state.distance,
      timeSec: timeSec,
      speed: speed
    };

    els.resTime.textContent = timeSec.toFixed(3) + ' 秒';
    els.resSpeed.textContent = '約 ' + speed.toFixed(1) + ' m/s';
    els.resFormula.textContent =
      state.distance + 'm ÷ ' + timeSec.toFixed(3) + '秒 ＝ ' + speed.toFixed(1) + ' m/s';

    updateReferenceDisplay();
    addHistoryItem(state.distance, timeSec, speed);
  }

  function addHistoryItem(distance, timeSec, speed) {
    state.trialCounter += 1;
    state.history.unshift({
      id: state.trialCounter,
      trialNo: state.trialCounter,
      distance: distance,
      timeSec: timeSec,
      speed: speed
    });

    if (state.history.length > MAX_HISTORY) {
      state.history.length = MAX_HISTORY;
    }
    renderHistory();
  }

  function removeHistoryItem(id) {
    state.history = state.history.filter(function (item) {
      return item.id !== id;
    });
    renderHistory();
  }

  function clearHistory() {
    state.history = [];
    state.trialCounter = 0;
    renderHistory();
  }

  function renderHistory() {
    if (state.history.length === 0) {
      els.historyBody.innerHTML =
        '<tr class="empty-row"><td colspan="5">まだ記録がありません</td></tr>';
      els.avgCount.textContent = '0';
      els.avgSpeed.textContent = '---.- m/s';
      return;
    }

    var rowsHtml = state.history.map(function (item) {
      return (
        '<tr>' +
        '<td>#' + item.trialNo + '</td>' +
        '<td>' + item.distance + ' m</td>' +
        '<td>' + item.timeSec.toFixed(3) + ' 秒</td>' +
        '<td><strong>' + item.speed.toFixed(1) + ' m/s</strong></td>' +
        '<td><button type="button" class="btn-row-del" data-del-id="' + item.id + '" aria-label="記録を削除">✕</button></td>' +
        '</tr>'
      );
    }).join('');

    els.historyBody.innerHTML = rowsHtml;

    var sumSpeed = state.history.reduce(function (acc, cur) {
      return acc + cur.speed;
    }, 0);
    var avg = sumSpeed / state.history.length;
    els.avgCount.textContent = String(state.history.length);
    els.avgSpeed.textContent = avg.toFixed(1) + ' m/s';
  }

  function switchMeasureMode(mode) {
    if (state.measuring) {
      cancelMeasurement();
    }
    state.mode = mode;
    var isMic = mode === 'mic';

    els.btnModeManual.classList.toggle('active', !isMic);
    els.btnModeManual.setAttribute('aria-selected', String(!isMic));
    els.btnModeMic.classList.toggle('active', isMic);
    els.btnModeMic.setAttribute('aria-selected', String(isMic));

    els.micPanel.hidden = !isMic;
    els.micErrorMsg.hidden = true;
    els.micErrorMsg.textContent = '';

    if (isMic) {
      els.micStatusText.textContent = 'マイク接続中…';
      if (global.OnsokuAudio) {
        global.OnsokuAudio.startMicMonitor(
          function onLevel(level, timestamp) {
            els.micMeterFill.style.width = level + '%';
            if (state.measuring) {
              var elapsedMs = timestamp - state.startTime;
              if (elapsedMs >= MIC_ARM_DELAY_MS && level >= state.micThreshold) {
                stopMeasurement(timestamp);
              }
            }
          },
          function onError(errMsg) {
            els.micErrorMsg.textContent = errMsg;
            els.micErrorMsg.hidden = false;
            els.micStatusText.textContent = '利用不可';
          }
        ).then(function () {
          if (state.mode === 'mic') {
            els.micStatusText.textContent = 'マイクON（反応待機OK）';
          }
        }).catch(function () {});
      }
    } else {
      if (global.OnsokuAudio) {
        global.OnsokuAudio.stopMicMonitor();
      }
      els.micMeterFill.style.width = '0%';
      els.micStatusText.textContent = 'OFF';
    }
  }

  function bindEvents() {
    els.distSlider.addEventListener('input', function () {
      updateDistance(this.value);
    });
    els.distInput.addEventListener('change', function () {
      updateDistance(this.value);
    });
    els.btnMinus.addEventListener('click', function () {
      updateDistance(state.distance - 1);
    });
    els.btnPlus.addEventListener('click', function () {
      updateDistance(state.distance + 1);
    });
    els.presetBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        updateDistance(this.getAttribute('data-distance'));
      });
    });

    els.btnModeManual.addEventListener('click', function () {
      switchMeasureMode('manual');
    });
    els.btnModeMic.addEventListener('click', function () {
      switchMeasureMode('mic');
    });

    els.micThresholdSlider.addEventListener('input', function () {
      var val = clamp(Number(this.value), 10, 95);
      state.micThreshold = val;
      els.micThresholdValue.textContent = String(val);
      els.micThresholdMarker.style.left = val + '%';
    });

    // 超大型ボタンは反応速度を最優先して pointerdown で即座に判定
    els.btnMain.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      ignoreClickUntil = performance.now() + 450;
      if (!state.measuring) {
        startMeasurement();
      } else {
        stopMeasurement(performance.now());
      }
    });

    els.btnMain.addEventListener('click', function () {
      if (performance.now() < ignoreClickUntil) return;
      if (!state.measuring) {
        startMeasurement();
      } else {
        stopMeasurement(performance.now());
      }
    });

    els.btnCancel.addEventListener('click', function () {
      cancelMeasurement();
    });

    // 参考データ折りたたみ
    els.btnToggleRef.addEventListener('click', function () {
      var isHidden = els.refBody.hidden;
      els.refBody.hidden = !isHidden;
      els.btnToggleRef.setAttribute('aria-expanded', String(isHidden));
      els.refToggleArrow.textContent = isHidden ? '▲ とじる' : '▼ ひらく';
    });

    els.tempSlider.addEventListener('input', function () {
      updateTemperature(this.value);
    });
    els.tempInput.addEventListener('change', function () {
      updateTemperature(this.value);
    });

    els.btnClearHistory.addEventListener('click', function () {
      clearHistory();
    });

    els.historyBody.addEventListener('click', function (e) {
      var delBtn = e.target.closest('[data-del-id]');
      if (!delBtn) return;
      var id = Number(delBtn.getAttribute('data-del-id'));
      removeHistoryItem(id);
    });
  }

  function onLeaveView() {
    if (state.measuring) {
      cancelMeasurement();
    }
    if (state.mode === 'mic' && global.OnsokuAudio) {
      global.OnsokuAudio.stopMicMonitor();
      els.micMeterFill.style.width = '0%';
      els.micStatusText.textContent = '停止中';
    }
  }

  function onEnterView() {
    if (state.mode === 'mic') {
      switchMeasureMode('mic');
    }
  }

  function init() {
    cacheElements();
    bindEvents();
    updateDistance(100);
    updateTemperature(15);
    renderHistory();
  }

  global.OnsokuHunter = {
    init: init,
    onEnterView: onEnterView,
    onLeaveView: onLeaveView
  };
})(window);
