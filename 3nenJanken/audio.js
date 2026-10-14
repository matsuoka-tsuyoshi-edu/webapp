// Web Audio API による効果音生成（外部音声ファイル不要・完全オフライン対応）
class SoundPlayer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ポン！じゃんけんの音
  playPon() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ピッ！選択音
  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // トントン（歩く音）
  playStep(pitchOffset = 0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 + pitchOffset * 30, now);
    osc.frequency.exponentialRampToValueAtTime(320 + pitchOffset * 20, now + 0.09);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // ピカッ（フローチャート通過音）
  playNode() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now); // E5

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ピンポン（正解音）
  playCorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // 高音ピンポン（ド〜ミ〜）
    const notes = [
      { f: 523.25, time: 0, dur: 0.2 }, // C5
      { f: 659.25, time: 0.22, dur: 0.4 } // E5
    ];

    notes.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, now + note.time);

      gain.gain.setValueAtTime(0.25, now + note.time);
      gain.gain.linearRampToValueAtTime(0.01, now + note.time + note.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.dur);
    });
  }

  // ブブー（不正解音）
  playWrong() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.18].forEach(startTime => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now + startTime);

      gain.gain.setValueAtTime(0.2, now + startTime);
      gain.gain.linearRampToValueAtTime(0.01, now + startTime + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + startTime);
      osc.stop(now + startTime + 0.14);
    });
  }

  // ファンファーレ（ゴール達成音）
  playFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, time: 0.0, dur: 0.15 }, // C5
      { f: 523.25, time: 0.16, dur: 0.15 }, // C5
      { f: 523.25, time: 0.32, dur: 0.15 }, // C5
      { f: 659.25, time: 0.48, dur: 0.4 },  // E5
      { f: 587.33, time: 0.9, dur: 0.2 },   // D5
      { f: 659.25, time: 1.12, dur: 0.2 },  // E5
      { f: 783.99, time: 1.35, dur: 0.7 }   // G5
    ];

    melody.forEach(m => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(m.f, now + m.time);

      gain.gain.setValueAtTime(0.3, now + m.time);
      gain.gain.linearRampToValueAtTime(0.01, now + m.time + m.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + m.time);
      osc.stop(now + m.time + m.dur);
    });
  }
}

window.soundPlayer = new SoundPlayer();
