/**
 * confetti.js
 * クリア時の紙吹雪（Confetti）演出＆やさしいファンファーレ（Web Audio API）
 */
window.TakakukeiApp = window.TakakukeiApp || {};

window.TakakukeiApp.createConfetti = function (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;
  let running = false;

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#eab308'];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  function playFanfare() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ac = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const times = [0, 0.1, 0.2, 0.32];
      const durs = [0.12, 0.12, 0.12, 0.35];

      notes.forEach((freq, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const startAt = ac.currentTime + times[i];
        gain.gain.setValueAtTime(0.001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + durs[i]);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(startAt);
        osc.stop(startAt + durs[i] + 0.02);
      });
    } catch (e) {
      // 音声再生不可環境では静かにスキップ
    }
  }

  function launch(withSound) {
    resize();
    particles = [];
    const count = 170;
    const w = canvas.width;
    const h = canvas.height;

    for (let i = 0; i < count; i++) {
      const fromTop = i < 110;
      particles.push({
        x: fromTop ? Math.random() * w : (i % 2 === 0 ? w * 0.12 : w * 0.88),
        y: fromTop ? -10 - Math.random() * (h * 0.45) : h * 0.85,
        vx: fromTop ? (Math.random() - 0.5) * 5 : (i % 2 === 0 ? 2 + Math.random() * 5 : -2 - Math.random() * 5),
        vy: fromTop ? 2.2 + Math.random() * 4.0 : -8 - Math.random() * 6,
        size: 9 + Math.random() * 9,
        color: COLORS[i % COLORS.length],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.22,
        wobble: Math.random() * 10,
        life: 0
      });
    }

    if (withSound !== false) {
      playFanfare();
    }

    if (!running) {
      running = true;
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function tick() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = 0;
    const h = canvas.height;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life += 1;
      p.wobble += 0.1;
      p.x += p.vx + Math.sin(p.wobble) * 1.2;
      p.y += p.vy;
      p.vy += 0.04;
      p.rot += p.vRot;

      if (p.y < h + 30) {
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
        ctx.restore();
      }
    }

    if (alive > 0 && particles[0].life < 360) {
      rafId = requestAnimationFrame(tick);
    } else {
      stop();
    }
  }

  return { launch, stop };
};
