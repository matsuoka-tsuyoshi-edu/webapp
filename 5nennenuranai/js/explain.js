/**
 * explain.js
 * ステップ3以降の「外回り（外角）」アニメーション解説モーダル
 */
window.TakakukeiApp = window.TakakukeiApp || {};

window.TakakukeiApp.createExplainManager = function () {
  const modal = document.getElementById('explainModal');
  const titleEl = document.getElementById('explainModalTitle');
  const textBox = document.getElementById('explainTextBox');
  const tabsBox = document.getElementById('explainTabs');
  const canvas = document.getElementById('explainCanvas');
  const closeBtn = document.getElementById('closeExplainBtn');
  const okBtn = document.getElementById('okExplainBtn');

  const W = 280;
  const H = 240;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');

  let rafId = null;
  let animStart = 0;
  let currentMode = 'square'; // 'square', 'tri_bad', 'tri_good', 'pentagon', 'star', 'free'

  function stopAnim() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function close() {
    stopAnim();
    modal.classList.remove('open');
  }

  closeBtn.addEventListener('click', close);
  okBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  function drawArrow(x, y, angleDeg, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(((angleDeg + 90) * Math.PI) / 180);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(9, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fillStyle = color || '#ef4444';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }

  function drawStraightExtension(x, y, angleDeg, len) {
    const rad = (angleDeg * Math.PI) / 180;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * Math.cos(rad), y + len * Math.sin(rad));
    ctx.stroke();
    ctx.restore();
  }

  function drawAngleSector(x, y, fromDeg, sweepDeg, radius, fillColor, strokeColor, labelText) {
    const fromRad = (fromDeg * Math.PI) / 180;
    const toRad = ((fromDeg + sweepDeg) * Math.PI) / 180;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, fromRad, toRad, sweepDeg < 0);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, fromRad, toRad, sweepDeg < 0);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (labelText) {
      const midRad = ((fromDeg + sweepDeg / 2) * Math.PI) / 180;
      const lx = x + (radius + 17) * Math.cos(midRad);
      const ly = y + (radius + 17) * Math.sin(midRad);
      ctx.fillStyle = strokeColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, lx, ly);
    }
    ctx.restore();
  }

  function renderPolygonLoop(tSec, sides, turnDeg, sideLen, originX, originY, startDeg, isBadDemo) {
    // 1ステップ = 移動0.6s + 回転説明0.9s = 1.5s
    const stepDur = 1.5;
    const totalDur = sides * stepDur + 1.0;
    const loopT = tSec % totalDur;

    // 頂点計算
    const pts = [{ x: originX, y: originY, ang: startDeg }];
    let cx = originX;
    let cy = originY;
    let cAng = startDeg;
    for (let i = 0; i < sides; i++) {
      const rad = (cAng * Math.PI) / 180;
      cx += sideLen * Math.cos(rad);
      cy += sideLen * Math.sin(rad);
      cAng += turnDeg;
      pts.push({ x: cx, y: cy, ang: cAng });
    }

    // 正三角形・五角形・正方形の目標図形を薄く表示（バグ表示のときは正しい三角形を点線で表示）
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    if (isBadDemo) {
      // 正しい正三角形（120度）の点線
      let bx = originX;
      let by = originY;
      let bAng = startDeg;
      ctx.moveTo(bx, by);
      for (let i = 0; i < 3; i++) {
        bx += sideLen * Math.cos((bAng * Math.PI) / 180);
        by += sideLen * Math.sin((bAng * Math.PI) / 180);
        ctx.lineTo(bx, by);
        bAng += 120;
      }
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // 現在の進行位置を計算
    const completedSteps = Math.min(sides, Math.floor(loopT / stepDur));
    const inStepT = loopT - completedSteps * stepDur;

    // すでに描き終わった辺を描画
    ctx.save();
    ctx.strokeStyle = isBadDemo ? '#dc2626' : '#2563eb';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < completedSteps; i++) {
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    }
    ctx.stroke();
    ctx.restore();

    let turtleX = pts[completedSteps].x;
    let turtleY = pts[completedSteps].y;
    let turtleAng = pts[completedSteps].ang;

    if (completedSteps < sides) {
      const p0 = pts[completedSteps];
      const p1 = pts[completedSteps + 1];
      if (inStepT < 0.6) {
        // 移動フェーズ
        const ratio = inStepT / 0.6;
        turtleX = p0.x + (p1.x - p0.x) * ratio;
        turtleY = p0.y + (p1.y - p0.y) * ratio;
        turtleAng = p0.ang;

        ctx.save();
        ctx.strokeStyle = isBadDemo ? '#dc2626' : '#2563eb';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(turtleX, turtleY);
        ctx.stroke();
        ctx.restore();
      } else {
        // 回転フェーズ（外回りアーク表示！）
        const ratio = Math.min(1, (inStepT - 0.6) / 0.7);
        turtleX = p1.x;
        turtleY = p1.y;
        const sweep = turnDeg * ratio;
        turtleAng = p0.ang + sweep;

        ctx.save();
        ctx.strokeStyle = isBadDemo ? '#dc2626' : '#2563eb';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.restore();

        // まっすぐ進む点線
        drawStraightExtension(p1.x, p1.y, p0.ang, 56);

        // 内角の補助表示（正三角形・星型の場合）
        if (currentMode === 'tri_good') {
          drawAngleSector(p1.x, p1.y, p0.ang + 120, 60, 22, 'rgba(56, 189, 248, 0.28)', '#0284c7', '内60°');
        }

        // 外回りの角度扇形
        drawAngleSector(
          p1.x,
          p1.y,
          p0.ang,
          sweep,
          30,
          isBadDemo ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.38)',
          isBadDemo ? '#dc2626' : '#d97706',
          `外${Math.round(sweep)}°`
        );
      }
    }

    drawArrow(turtleX, turtleY, turtleAng, isBadDemo ? '#dc2626' : '#ef4444');

    // 五角形などでは累積回転角度バッジを表示
    if (currentMode === 'pentagon') {
      const doneTurns = completedSteps + (completedSteps < sides && inStepT >= 0.6 ? Math.min(1, (inStepT - 0.6) / 0.7) : 0);
      const totalDeg = Math.round(doneTurns * 72);
      ctx.save();
      ctx.fillStyle = '#1e3a8a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`回った合計：${totalDeg}° / 360°`, 12, 22);
      ctx.restore();
    }
  }

  function loop(now) {
    const tSec = (now - animStart) / 1000;
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 背景グリッド
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = 20; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 20; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (currentMode === 'square') {
      renderPolygonLoop(tSec, 4, 90, 95, 85, 175, -90, false);
    } else if (currentMode === 'tri_bad') {
      renderPolygonLoop(tSec, 3, 60, 75, 55, 190, -90, true);
    } else if (currentMode === 'tri_good') {
      renderPolygonLoop(tSec, 3, 120, 105, 80, 185, -90, false);
    } else if (currentMode === 'pentagon') {
      renderPolygonLoop(tSec, 5, 72, 72, 85, 170, -90, false);
    } else if (currentMode === 'star') {
      renderPolygonLoop(tSec, 5, 144, 120, 80, 105, 0, false);
    } else {
      renderPolygonLoop(tSec, 6, 60, 62, 75, 155, -90, false);
    }

    ctx.restore();
    rafId = requestAnimationFrame(loop);
  }

  function setMode(mode) {
    currentMode = mode;
    animStart = performance.now();

    tabsBox.querySelectorAll('.explain-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'square') {
      textBox.innerHTML = `
        <h3 style="margin-top:0;color:#1e3a8a;">かどは「まっすぐ」から 外回りに まがる！</h3>
        <p>キャラクターは いつでも <strong>「まっすぐ すすむ むき（点線）」</strong> から どれくらい まがるかを 考えます。</p>
        <div class="explain-point">
          正方形の かどは <strong>90°</strong>！<br>
          「100歩うごかす」→「右に 90° まわす」を <strong>4回くりかえす</strong> と かけるよ！
        </div>
        <p style="font-size:0.86rem;color:#475569;">※ 教科書 p.179〜180：同じことを くりかえすときは「くりかえす」ブロックを使うと みじかく わかりやすく なるよ。</p>
      `;
    } else if (mode === 'tri_bad') {
      textBox.innerHTML = `
        <h3 style="margin-top:0;color:#dc2626;">なぜ 60° だと 正三角形にならないの？</h3>
        <p>正三角形の <strong>うちがわ</strong> の角は 60° だけど、キャラクターは「まっすぐ進む方向（点線）」から 60° しか 回らないため、<strong>外にひらいて</strong> しまいます！</p>
        <div class="explain-point">
          ❌ 60° まわすと、曲がりたりない！<br>
          上の「⭕ 外回りに 120°！」タブを おして 見くらべてみよう！
        </div>
      `;
    } else if (mode === 'tri_good') {
      textBox.innerHTML = `
        <h3 style="margin-top:0;color:#1e3a8a;">「外回り」に 120° まわろう！</h3>
        <p>まっすぐの線（180°）から、正三角形の うちの角（60°）を ひくと…</p>
        <div class="explain-point">
          ⭕ <strong>180° − 60° ＝ 120°</strong><br>
          まっすぐ進む向きから <strong>外回りに 120°</strong> まわると、ピタッと 正三角形になるよ！
        </div>
        <p style="font-size:0.86rem;color:#475569;">さらに、3回まわると <strong>120° × 3 ＝ 360°</strong> で 1周して もとの向きに もどるよ！</p>
      `;
    } else if (mode === 'pentagon') {
      textBox.innerHTML = `
        <h3 style="margin-top:0;color:#1e3a8a;">きまりを見つけよう！（教科書 p.181）</h3>
        <p>どの正多角形も、1周ぐるっと回ると まわした角度の合計は <strong>360°</strong> になります。</p>
        <div class="explain-point">
          辺の数 × まわす角度 ＝ <strong>360°</strong><br>
          正五角形は <strong>360 ÷ 5 ＝ 72°</strong>！
        </div>
        <table class="formula-table">
          <tr><th>図形</th><th>正三角形</th><th>正方形</th><th>正五角形</th><th>正六角形</th></tr>
          <tr><td>辺の数</td><td>3</td><td>4</td><td><strong>5</strong></td><td>6</td></tr>
          <tr><td>まわす角度</td><td>120°</td><td>90°</td><td><strong style="color:#d97706;">72°</strong></td><td>60°</td></tr>
        </table>
      `;
    } else if (mode === 'star') {
      textBox.innerHTML = `
        <h3 style="margin-top:0;color:#9a3412;">★ 星型の 外回りは 144°！</h3>
        <p>星のとがった トゲの うちがわの角は <strong>36°</strong> です。</p>
        <div class="explain-point">
          まっすぐの線（180°）から 36° を ひくと…<br>
          <strong>180° − 36° ＝ 144°</strong>！<br>
          5回まわると 144° × 5 ＝ 720°（2周）で 星になるよ！
        </div>
      `;
    } else {
      textBox.innerHTML = `
        <h3 style="margin-top:0;color:#1e3a8a;">いろいろな 正多角形の きまり</h3>
        <p><strong>まわす角度 ＝ 360 ÷ 辺の数</strong> をつかうと、いろいろな正多角形がかけるよ！</p>
        <table class="formula-table">
          <tr><th>図形</th><th>辺の数</th><th>まわす角度</th><th>おすすめの長さ</th></tr>
          <tr><td>正六角形</td><td>6</td><td>60°</td><td>70 歩</td></tr>
          <tr><td>正八角形</td><td>8</td><td>45°</td><td>55 歩</td></tr>
          <tr><td>正十角形</td><td>10</td><td>36°</td><td>45 歩</td></tr>
          <tr><td>正二十角形</td><td>20</td><td>18°</td><td>25 歩</td></tr>
        </table>
      `;
    }
  }

  function openForStep(step) {
    stopAnim();
    tabsBox.innerHTML = '';

    let defaultMode = 'square';
    if (step.goalType === 'square') {
      titleEl.textContent = '📖 かいせつ：正方形の まわり方';
      tabsBox.innerHTML = `<button class="explain-tab active" data-mode="square">正方形（90°）</button>`;
      defaultMode = 'square';
    } else if (step.goalType === 'triangle') {
      titleEl.textContent = '📖 かいせつ：なぜ 60° じゃダメなの？';
      tabsBox.innerHTML = `
        <button class="explain-tab bad" data-mode="tri_bad">❌ 60°だと…</button>
        <button class="explain-tab" data-mode="tri_good">⭕ 外回り 120°！</button>
      `;
      defaultMode = 'tri_bad';
    } else if (step.goalType === 'pentagon') {
      titleEl.textContent = '📖 かいせつ：正五角形と 360° のきまり';
      tabsBox.innerHTML = `
        <button class="explain-tab active" data-mode="pentagon">正五角形（72°）</button>
        <button class="explain-tab" data-mode="tri_good">正三角形（120°）</button>
      `;
      defaultMode = 'pentagon';
    } else if (step.goalType === 'star') {
      titleEl.textContent = '📖 かいせつ：星型（★）の 外回り角度';
      tabsBox.innerHTML = `<button class="explain-tab active" data-mode="star">星型（144°）</button>`;
      defaultMode = 'star';
    } else {
      titleEl.textContent = '📖 かいせつ：いろいろな 正多角形';
      tabsBox.innerHTML = `
        <button class="explain-tab active" data-mode="free">正六角形（60°）</button>
        <button class="explain-tab" data-mode="pentagon">正五角形（72°）</button>
        <button class="explain-tab" data-mode="star">星型（144°）</button>
      `;
      defaultMode = 'free';
    }

    tabsBox.querySelectorAll('.explain-tab').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    setMode(defaultMode);
    modal.classList.add('open');
    rafId = requestAnimationFrame(loop);
  }

  return { openForStep, close };
};
