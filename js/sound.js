/**
 * Web Audio API Sound Effects (No external MP3/WAV required).
 * Designed for iPad Safari: unlock() must be called from a user gesture.
 */
(function (global) {
  "use strict";

  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function unlock() {
    const c = ensureContext();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(0);
      osc.stop(c.currentTime + 0.01);
    } catch (e) {
      // Ignore audio unlock edge cases
    }
  }

  function playTone(freq, startOffset, duration, type, volume) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime + startOffset;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume || 0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playPingPong() {
    // Classic Japanese quiz "Pin-Pon!" chime
    playTone(1046.5, 0.0, 0.16, "sine", 0.25);     // C6
    playTone(1318.5, 0.12, 0.34, "sine", 0.28);    // E6
    playTone(2093.0, 0.12, 0.25, "triangle", 0.08); // soft overtone
  }

  function playWrong() {
    // Gentle soft "bu-bu" so kids don't feel discouraged
    playTone(246.94, 0.0, 0.13, "triangle", 0.18);  // B3
    playTone(196.0, 0.15, 0.22, "triangle", 0.18);  // G3
  }

  function playFlip() {
    // Tactile "Kuri-Pera" ring click + paper swish
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;

    // 1. Subtle ring click
    playTone(1800, 0.0, 0.035, "triangle", 0.07);

    // 2. Soft paper swish via short bandpassed noise
    try {
      const length = Math.floor(c.sampleRate * 0.14);
      const buffer = c.createBuffer(1, length, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / length) * Math.PI);
      }
      const noise = c.createBufferSource();
      noise.buffer = buffer;

      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(2600, now + 0.12);
      filter.Q.value = 1.6;

      const gain = c.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      noise.start(now);
    } catch (e) {
      // Fallback ignored
    }
  }

  function playErase() {
    playTone(520, 0.0, 0.05, "sine", 0.10);
    playTone(380, 0.04, 0.07, "sine", 0.08);
  }

  function playFanfare() {
    // Cheerful 10/10 celebration jingle
    const notes = [
      [523.25, 0.0, 0.12],   // C5
      [659.25, 0.11, 0.12],  // E5
      [783.99, 0.22, 0.12],  // G5
      [1046.5, 0.34, 0.45],  // C6
      [783.99, 0.34, 0.45],  // G5 harmony
      [659.25, 0.34, 0.45],  // E5 harmony
    ];
    notes.forEach(function (n) {
      playTone(n[0], n[1], n[2], "triangle", 0.20);
    });
  }

  function setMuted(val) {
    muted = Boolean(val);
  }

  function isMuted() {
    return muted;
  }

  global.SoundFX = {
    unlock: unlock,
    playPingPong: playPingPong,
    playWrong: playWrong,
    playFlip: playFlip,
    playErase: playErase,
    playFanfare: playFanfare,
    setMuted: setMuted,
    isMuted: isMuted,
  };
})(window);
