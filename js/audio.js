/* =========================================================
   音速ラボ - Web Audio API エンジン (効果音 & マイク監視)
   ========================================================= */

(function (global) {
  'use strict';

  var audioCtx = null;
  var isMuted = false;

  // マイク監視用ステート
  var micStream = null;
  var micSource = null;
  var micAnalyser = null;
  var micRafId = null;
  var micActive = false;

  function getAudioContextClass() {
    return global.AudioContext || global.webkitAudioContext || null;
  }

  function ensureAudioContext() {
    var Ctx = getAudioContextClass();
    if (!Ctx) return null;
    if (!audioCtx) {
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function setMuted(muted) {
    isMuted = Boolean(muted);
  }

  function getMuted() {
    return isMuted;
  }

  // 音速レース：一斉スタートの合図音
  function playStartCue() {
    if (isMuted) return;
    var ctx = ensureAudioContext();
    if (!ctx) return;

    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 音速レース：ゴール到達時の「ピコン！」（レーン1とレーン2で音程を差別化）
  function playLaneFinish(laneNumber) {
    if (isMuted) return;
    var ctx = ensureAudioContext();
    if (!ctx) return;

    var now = ctx.currentTime;
    var freqs = laneNumber === 1 ? [1046.5, 1318.5] : [659.25, 783.99]; // レーン1: C6->E6 / レーン2: E5->G5

    freqs.forEach(function (freq, idx) {
      var start = now + idx * 0.065;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = laneNumber === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.24, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  // 音速ハンター：マイク入力の開始
  function startMicMonitor(onLevel, onError) {
    if (micActive) {
      return Promise.resolve(true);
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      var noApiMsg = 'このブラウザではマイク機能が使えません。「手動ストップ」を使ってください。';
      if (onError) onError(noApiMsg);
      return Promise.reject(new Error(noApiMsg));
    }

    var ctx = ensureAudioContext();
    if (!ctx) {
      var noCtxMsg = '音声処理機能が利用できません。「手動ストップ」を使ってください。';
      if (onError) onError(noCtxMsg);
      return Promise.reject(new Error(noCtxMsg));
    }

    var idealConstraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    };

    return navigator.mediaDevices.getUserMedia(idealConstraints)
      .catch(function () {
        return navigator.mediaDevices.getUserMedia({ audio: true });
      })
      .then(function (stream) {
        micStream = stream;
        micSource = ctx.createMediaStreamSource(stream);
        micAnalyser = ctx.createAnalyser();
        micAnalyser.fftSize = 1024;
        micAnalyser.smoothingTimeConstant = 0.2;
        micSource.connect(micAnalyser);
        micActive = true;

        var useFloat = typeof micAnalyser.getFloatTimeDomainData === 'function';
        var floatBuf = useFloat ? new Float32Array(micAnalyser.fftSize) : null;
        var byteBuf = useFloat ? null : new Uint8Array(micAnalyser.fftSize);

        function tick() {
          if (!micActive || !micAnalyser) return;
          var peak = 0;

          if (useFloat) {
            micAnalyser.getFloatTimeDomainData(floatBuf);
            for (var i = 0; i < floatBuf.length; i++) {
              var absVal = Math.abs(floatBuf[i]);
              if (absVal > peak) peak = absVal;
            }
          } else {
            micAnalyser.getByteTimeDomainData(byteBuf);
            for (var j = 0; j < byteBuf.length; j++) {
              var norm = Math.abs((byteBuf[j] - 128) / 128);
              if (norm > peak) peak = norm;
            }
          }

          // 対数に近いスケーリングで小さな音〜大きな音を見やすく0..100に正規化
          var level = Math.min(100, Math.round(Math.pow(peak, 0.55) * 115));
          if (onLevel) {
            onLevel(level, performance.now());
          }
          micRafId = requestAnimationFrame(tick);
        }

        micRafId = requestAnimationFrame(tick);
        return true;
      })
      .catch(function (err) {
        stopMicMonitor();
        var msg = 'マイクの使用が許可されませんでした。Safariの設定を確認するか、「手動ストップ」を使ってください。';
        if (err && err.name === 'NotFoundError') {
          msg = 'マイクが見つかりませんでした。「手動ストップ」を使ってください。';
        }
        if (onError) onError(msg);
        throw err;
      });
  }

  // 音速ハンター：マイク監視の停止と解放
  function stopMicMonitor() {
    micActive = false;
    if (micRafId !== null) {
      cancelAnimationFrame(micRafId);
      micRafId = null;
    }
    if (micSource) {
      try { micSource.disconnect(); } catch (e) {}
      micSource = null;
    }
    micAnalyser = null;
    if (micStream) {
      try {
        micStream.getTracks().forEach(function (track) {
          track.stop();
        });
      } catch (e) {}
      micStream = null;
    }
  }

  function isMicRunning() {
    return micActive;
  }

  global.OnsokuAudio = {
    ensureAudioContext: ensureAudioContext,
    setMuted: setMuted,
    getMuted: getMuted,
    playStartCue: playStartCue,
    playLaneFinish: playLaneFinish,
    startMicMonitor: startMicMonitor,
    stopMicMonitor: stopMicMonitor,
    isMicRunning: isMicRunning
  };
})(window);
