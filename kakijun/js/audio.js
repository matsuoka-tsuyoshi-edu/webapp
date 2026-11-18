/**
 * 効果音（Web Audio API）＆ 音声読み上げ（Web Speech API）
 * iPad Safari のオーディオ制限を考慮したアンロック機構付き
 */
(function (global) {
  'use strict';

  const Kakijun = (global.Kakijun = global.Kakijun || {});

  let audioCtx = null;
  let enabled = true;
  let unlocked = false;
  let jaVoice = null;

  function getContext() {
    if (!audioCtx) {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (Ctx) {
        audioCtx = new Ctx();
      }
    }
    return audioCtx;
  }

  function pickJapaneseVoice() {
    if (!('speechSynthesis' in global)) return null;
    const voices = global.speechSynthesis.getVoices() || [];
    // iOS / macOS / Windows で自然な日本語音声を優先
    return (
      voices.find((v) => v.lang === 'ja-JP' && /Kyoko|O-Ren|Nanami|Haruka|Ayumi/i.test(v.name)) ||
      voices.find((v) => v.lang && v.lang.startsWith('ja')) ||
      null
    );
  }

  if ('speechSynthesis' in global) {
    jaVoice = pickJapaneseVoice();
    if (typeof global.speechSynthesis.onvoiceschanged !== 'undefined') {
      global.speechSynthesis.onvoiceschanged = function () {
        jaVoice = pickJapaneseVoice();
      };
    }
  }

  function unlock() {
    const ctx = getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    if (ctx && !unlocked) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.01);
        unlocked = true;
      } catch (e) {
        // ignore
      }
    }
  }

  function playTone(freq, startOffset, duration, type, volume) {
    if (!enabled) return;
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }

    const now = ctx.currentTime + (startOffset || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const vol = volume != null ? volume : 0.16;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  const Sound = {
    isEnabled: function () {
      return enabled;
    },

    setEnabled: function (val) {
      enabled = !!val;
      if (!enabled && 'speechSynthesis' in global) {
        try {
          global.speechSynthesis.cancel();
        } catch (e) {
          // ignore
        }
      }
    },

    unlock: unlock,

    tap: function () {
      playTone(660, 0, 0.08, 'sine', 0.12);
    },

    strokeDone: function () {
      playTone(587.33, 0, 0.09, 'triangle', 0.12);
      playTone(880, 0.06, 0.11, 'triangle', 0.1);
    },

    judgeDrum: function () {
      playTone(392, 0, 0.12, 'triangle', 0.14);
      playTone(523.25, 0.12, 0.18, 'triangle', 0.16);
    },

    correct: function () {
      // ピンポン♪（明るい4音）
      playTone(659.25, 0.0, 0.14, 'sine', 0.18);
      playTone(523.25, 0.12, 0.14, 'sine', 0.16);
      playTone(659.25, 0.24, 0.14, 'sine', 0.18);
      playTone(783.99, 0.36, 0.32, 'sine', 0.2);
    },

    wrong: function () {
      // やさしい「おしい！」音
      playTone(311.13, 0.0, 0.16, 'triangle', 0.14);
      playTone(261.63, 0.16, 0.24, 'triangle', 0.14);
    },

    fanfare: function () {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (n, idx) {
        playTone(n, idx * 0.11, idx === notes.length - 1 ? 0.45 : 0.16, 'triangle', 0.18);
      });
    },

    speak: function (text, rate) {
      if (!enabled || !text || !('speechSynthesis' in global)) return;
      try {
        global.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'ja-JP';
        if (!jaVoice) jaVoice = pickJapaneseVoice();
        if (jaVoice) utter.voice = jaVoice;
        utter.rate = rate || 0.9; // 子ども向けに少しゆっくり
        utter.pitch = 1.1;
        global.speechSynthesis.speak(utter);
      } catch (e) {
        // ignore speech errors
      }
    }
  };

  Kakijun.Sound = Sound;
})(window);
