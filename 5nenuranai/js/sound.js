/**
 * Web Audio API を使った軽量サウンドエフェクトエンジン
 * 外部音声ファイル不要で、iPad Safari / Chrome でも動作します。
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'uranai_sound_muted';
  let ctx = null;
  let isMuted = false;

  try {
    isMuted = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    isMuted = false;
  }

  function getContext() {
    if (isMuted) return null;
    if (!ctx) {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freq, duration, type, volume, delay) {
    try {
      const audio = getContext();
      if (!audio) return;
      const now = audio.currentTime + (delay || 0);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(volume || 0.12, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) {}
  }

  function playSnap() {
    playTone(520, 0.08, 'triangle', 0.14, 0);
    playTone(780, 0.09, 'sine', 0.1, 0.03);
  }

  function playStep() {
    playTone(660, 0.09, 'sine', 0.1, 0);
  }

  function playThump() {
    // 魔力が「どんっ」と響く低音＋輝き
    playTone(110, 0.18, 'sine', 0.18, 0);
    playTone(580, 0.11, 'triangle', 0.08, 0.02);
  }

  function playMagicFinish() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => playTone(n, 0.24, 'triangle', 0.13, idx * 0.07));
  }

  function playClear() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((n, idx) => playTone(n, 0.28, 'sine', 0.14, idx * 0.08));
  }

  function playWarn() {
    playTone(260, 0.16, 'triangle', 0.13, 0);
    playTone(210, 0.22, 'triangle', 0.12, 0.12);
  }

  function setMuted(muted) {
    isMuted = !!muted;
    try {
      localStorage.setItem(STORAGE_KEY, isMuted ? '1' : '0');
    } catch (e) {}
    return isMuted;
  }

  function getMuted() {
    return isMuted;
  }

  global.UranaiSound = {
    playSnap: playSnap,
    playStep: playStep,
    playThump: playThump,
    playMagicFinish: playMagicFinish,
    playClear: playClear,
    playWarn: playWarn,
    setMuted: setMuted,
    getMuted: getMuted
  };
})(window);
