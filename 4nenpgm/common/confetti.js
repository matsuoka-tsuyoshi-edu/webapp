// ==========================================
// 紙吹雪パーティクル生成エンジン（Canvas）
// ==========================================
class ConfettiEffect {
  constructor(canvasId = 'confetti-canvas') {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationId = null;
    this.canvasId = canvasId;
  }

  init() {
    this.canvas = document.getElementById(this.canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start(durationMs = 3500) {
    if (!this.canvas) this.init();
    if (!this.canvas || !this.ctx) return;

    this.particles = [];
    const colors = ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#9b59b6', '#ff6b81', '#2bcbba'];
    const count = 120;

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * -this.canvas.height * 0.5,
        w: Math.random() * 12 + 6,
        h: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 3,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10
      });
    }

    if (this.animationId) cancelAnimationFrame(this.animationId);
    const startTime = performance.now();

    const loop = (time) => {
      const elapsed = time - startTime;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      let activeCount = 0;
      this.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;

        if (p.y < this.canvas.height + 20) {
          activeCount++;
          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rot * Math.PI) / 180);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          this.ctx.restore();
        }
      });

      if (elapsed < durationMs && activeCount > 0) {
        this.animationId = requestAnimationFrame(loop);
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(loop);
  }
}

const confetti = new ConfettiEffect();
