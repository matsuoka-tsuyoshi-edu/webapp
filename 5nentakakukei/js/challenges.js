/**
 * challenges.js
 * 超発展チャレンジ（全16問）のお題定義・おてほん線生成・一致判定
 */
window.TakakukeiApp = window.TakakukeiApp || {};

(function (App) {
  function repeatCmds(times, list) {
    const out = [];
    for (let i = 0; i < times; i++) {
      for (let j = 0; j < list.length; j++) {
        out.push(list[j]);
      }
    }
    return out;
  }

  // お題コマンド列から論理空間の線分リストを生成（反転オプション付き）
  function buildSegmentsFromCommands(cmds, startPos, drawScale, mirrorTurn) {
    let x = startPos.x;
    let y = startPos.y;
    let angle = startPos.angle;
    let penDown = true;
    const segs = [];

    for (let i = 0; i < cmds.length; i++) {
      const c = cmds[i];
      if (c.t === 'pd') {
        penDown = true;
      } else if (c.t === 'pu') {
        penDown = false;
      } else if (c.t === 'tr') {
        angle += mirrorTurn ? -c.v : c.v;
      } else if (c.t === 'tl') {
        angle += mirrorTurn ? c.v : -c.v;
      } else if (c.t === 'mv') {
        const rad = (angle * Math.PI) / 180;
        const dist = c.v * drawScale;
        const nx = x + dist * Math.cos(rad);
        const ny = y + dist * Math.sin(rad);
        if (penDown && Math.abs(c.v) > 0.1) {
          segs.push({ x1: x, y1: y, x2: nx, y2: ny, len: Math.abs(c.v) });
        }
        x = nx;
        y = ny;
      }
    }
    return segs;
  }

  App.CHALLENGES = [
    // --- レベル1：いろいろな正多角形 ---
    {
      id: 'c1',
      num: 1,
      level: 'レベル1：正多角形マスター',
      title: '正六角形（せいろっかくけい）',
      desc: '1辺が 100 の 正六角形を かこう！（6回くりかえす）',
      hint: '360 ÷ 6 ＝ 60度！ 6回くりかえしてみよう。',
      drawScale: 1.35,
      startPos: { x: 85, y: 277, angle: -90 },
      fastDefault: false,
      needsPenBlock: false,
      cmds: repeatCmds(6, [{ t: 'mv', v: 100 }, { t: 'tr', v: 60 }])
    },
    {
      id: 'c2',
      num: 2,
      level: 'レベル1：正多角形マスター',
      title: '正八角形（せいはっかくけい）',
      desc: '1辺が 80 の 正八角形を かこう！（8回くりかえす）',
      hint: '360 ÷ 8 ＝ 45度！ 長さは 80 歩で 8回くりかえそう。',
      drawScale: 1.45,
      startPos: { x: 70, y: 268, angle: -90 },
      fastDefault: false,
      needsPenBlock: false,
      cmds: repeatCmds(8, [{ t: 'mv', v: 80 }, { t: 'tr', v: 45 }])
    },
    {
      id: 'c3',
      num: 3,
      level: 'レベル1：正多角形マスター',
      title: '正十角形（せいじゅっかくけい）',
      desc: '1辺が 60 の 正十角形を かこう！（10回くりかえす）',
      hint: '360 ÷ 10 ＝ 36度！ 長さは 60 歩で 10回くりかえそう。',
      drawScale: 1.5,
      startPos: { x: 65, y: 255, angle: -90 },
      fastDefault: false,
      needsPenBlock: false,
      cmds: repeatCmds(10, [{ t: 'mv', v: 60 }, { t: 'tr', v: 36 }])
    },
    {
      id: 'c4',
      num: 4,
      level: 'レベル1：正多角形マスター',
      title: '正十二角形（せいじゅうにかくけい）',
      desc: '1辺が 50 の 正十二角形を かこう！（12回くりかえす）',
      hint: '360 ÷ 12 ＝ 30度！ 長さは 50 歩で 12回くりかえそう。',
      drawScale: 1.55,
      startPos: { x: 62, y: 248, angle: -90 },
      fastDefault: true,
      needsPenBlock: false,
      cmds: repeatCmds(12, [{ t: 'mv', v: 50 }, { t: 'tr', v: 30 }])
    },
    {
      id: 'c5',
      num: 5,
      level: 'レベル1：正多角形マスター',
      title: 'ほぼ円！？正三十六角形',
      desc: '1辺が 20 の 正三十六角形（36回）を かいて、円に 近づけよう！',
      hint: '360 ÷ 36 ＝ 10度！ 長さ 20 歩で 36回くりかえしてみよう。',
      drawScale: 1.35,
      startPos: { x: 55, y: 223, angle: -90 },
      fastDefault: true,
      needsPenBlock: false,
      cmds: repeatCmds(36, [{ t: 'mv', v: 20 }, { t: 'tr', v: 10 }])
    },

    // --- レベル2：くみあわせ図形＆いろいろな星 ---
    {
      id: 'c6',
      num: 6,
      level: 'レベル2：回転のくふう',
      title: '3だん かいだん',
      desc: '右と 左の まわり方を つかいわけて、長さ 60 の 3だん かいだんを かこう！',
      hint: '「60歩 → 右に90度 → 60歩 → 左に90度」を 3回くりかえしてみよう！',
      drawScale: 1.55,
      startPos: { x: 70, y: 348, angle: -90 },
      fastDefault: false,
      needsPenBlock: false,
      cmds: repeatCmds(3, [{ t: 'mv', v: 60 }, { t: 'tr', v: 90 }, { t: 'mv', v: 60 }, { t: 'tl', v: 90 }])
    },
    {
      id: 'c7',
      num: 7,
      level: 'レベル2：回転のくふう',
      title: 'ギザギザの 山（3つ）',
      desc: '60度の とがった山を 3つ ならべて かこう！（1辺 80、くりかえし3回）',
      hint: '最初に「右に30度」むいておいて、「80歩 → 右120度 → 80歩 → 左120度」を 3回くりかえすと かけるよ！',
      drawScale: 1.35,
      startPos: { x: 48, y: 260, angle: -90 },
      fastDefault: false,
      needsPenBlock: false,
      cmds: [{ t: 'tr', v: 30 }].concat(
        repeatCmds(3, [{ t: 'mv', v: 80 }, { t: 'tr', v: 120 }, { t: 'mv', v: 80 }, { t: 'tl', v: 120 }])
      )
    },
    {
      id: 'c8',
      num: 8,
      level: 'レベル2：回転のくふう',
      title: '八芒星（8つトゲの星）',
      desc: '1辺 100 で 8回くりかえして、8つトゲの かっこいい星を かこう！',
      hint: '1回に「135度」ずつ 右にまわってみよう！（135 × 8 ＝ 1080 ＝ 3周！）',
      drawScale: 2.6,
      startPos: { x: 80, y: 158, angle: 0 },
      fastDefault: false,
      needsPenBlock: false,
      cmds: repeatCmds(8, [{ t: 'mv', v: 100 }, { t: 'tr', v: 135 }])
    },
    {
      id: 'c9',
      num: 9,
      level: 'レベル2：回転のくふう',
      title: '十芒星（10トゲの星）',
      desc: '1辺 100 で 10回くりかえして、10コのとがった星を かこう！',
      hint: '1回に「108度」ずつ 右にまわってみよう！（108 × 10 ＝ 1080 ＝ 3周！）',
      drawScale: 2.6,
      startPos: { x: 80, y: 170, angle: 0 },
      fastDefault: false,
      needsPenBlock: false,
      cmds: repeatCmds(10, [{ t: 'mv', v: 100 }, { t: 'tr', v: 108 }])
    },

    // --- レベル3：ペンを上げる・下ろす活用 ---
    {
      id: 'c10',
      num: 10,
      level: 'レベル3：ペンの上げ下ろし',
      title: 'はなれた点線（4ほん）',
      desc: '「ペンを上げる／下ろす」を つかって、長さ 40・すきま 30 の点線を 4本 かこう！',
      hint: '「ペンを下ろす → 40歩 → ペンを上げる → 30歩」を 4回くりかえそう！',
      drawScale: 1.35,
      startPos: { x: 210, y: 380, angle: -90 },
      fastDefault: false,
      needsPenBlock: true,
      cmds: repeatCmds(4, [{ t: 'pd' }, { t: 'mv', v: 40 }, { t: 'pu' }, { t: 'mv', v: 30 }])
    },
    {
      id: 'c11',
      num: 11,
      level: 'レベル3：ペンの上げ下ろし',
      title: 'ならんだ 2つの正方形',
      desc: '1辺 80 の正方形を かいたあと、すきま 40 あけて 右にもう1つ 正方形を かこう！',
      hint: '1つ目の正方形 → ペンを上げる → 右に90度 → 120歩（80＋40） → 左に90度 → ペンを下ろす → 2つ目の正方形！',
      drawScale: 1.45,
      startPos: { x: 65, y: 268, angle: -90 },
      fastDefault: false,
      needsPenBlock: true,
      cmds: [
        { t: 'pd' },
        ...repeatCmds(4, [{ t: 'mv', v: 80 }, { t: 'tr', v: 90 }]),
        { t: 'pu' },
        { t: 'tr', v: 90 },
        { t: 'mv', v: 120 },
        { t: 'tl', v: 90 },
        { t: 'pd' },
        ...repeatCmds(4, [{ t: 'mv', v: 80 }, { t: 'tr', v: 90 }])
      ]
    },

    // --- レベル4：くりかえしの中のくりかえし（幾何学アート） ---
    {
      id: 'c12',
      num: 12,
      level: 'レベル4：二重くりかえしアート',
      title: '風車（正方形 × 4）',
      desc: 'くりかえすの中にくりかえすを入れて、1辺 80 の正方形が 4つ 並んだ「風車」をかこう！',
      hint: '「4回くりかえす」の中に「4回くりかえす（80歩・右90度）」を入れ、その下に「右に90度まわす」をいれよう！',
      drawScale: 1.75,
      startPos: { x: 210, y: 210, angle: -90 },
      fastDefault: true,
      needsPenBlock: false,
      cmds: repeatCmds(4, [...repeatCmds(4, [{ t: 'mv', v: 80 }, { t: 'tr', v: 90 }]), { t: 'tr', v: 90 }])
    },
    {
      id: 'c13',
      num: 13,
      level: 'レベル4：二重くりかえしアート',
      title: '6まいの花びら（三角形 × 6）',
      desc: '1辺 90 の正三角形を 60度ずつ ずらしながら 6つ かいて、お花の模様をつくろう！',
      hint: '「6回くりかえす」の中に「3回くりかえす（90歩・右120度）」を入れ、その下に「右に60度まわす」をいれよう！',
      drawScale: 1.65,
      startPos: { x: 210, y: 210, angle: -90 },
      fastDefault: true,
      needsPenBlock: false,
      cmds: repeatCmds(6, [...repeatCmds(3, [{ t: 'mv', v: 90 }, { t: 'tr', v: 120 }]), { t: 'tr', v: 60 }])
    },
    {
      id: 'c14',
      num: 14,
      level: 'レベル4：二重くりかえしアート',
      title: 'きらめく太陽（正方形 × 8）',
      desc: '1辺 80 の正方形を 45度ずつ まわしながら 8つ かいてみよう！',
      hint: '「8回くりかえす」の中に「4回くりかえす（80歩・右90度）」を入れ、その下に「右に45度まわす」をいれよう！',
      drawScale: 1.38,
      startPos: { x: 210, y: 210, angle: -90 },
      fastDefault: true,
      needsPenBlock: false,
      cmds: repeatCmds(8, [...repeatCmds(4, [{ t: 'mv', v: 80 }, { t: 'tr', v: 90 }]), { t: 'tr', v: 45 }])
    },
    {
      id: 'c15',
      num: 15,
      level: 'レベル4：二重くりかえしアート',
      title: '六角の結晶（正六角形 × 6）',
      desc: '1辺 60 の正六角形を 60度ずつ ずらして 6つ かくと、どんな結晶ができるかな？',
      hint: '「6回くりかえす」の中に「6回くりかえす（60歩・右60度）」を入れ、その下に「右に60度まわす」をいれよう！',
      drawScale: 1.4,
      startPos: { x: 210, y: 210, angle: -90 },
      fastDefault: true,
      needsPenBlock: false,
      cmds: repeatCmds(6, [...repeatCmds(6, [{ t: 'mv', v: 60 }, { t: 'tr', v: 60 }]), { t: 'tr', v: 60 }])
    },
    {
      id: 'c16',
      num: 16,
      level: 'レベル4：二重くりかえしアート',
      title: '【最終奥義】五角形マンダラ（×10）',
      desc: '1辺 60 の正五角形を 36度ずつ ずらして 10こ かく、最高の幾何学アートにちょうせん！',
      hint: '「10回くりかえす」の中に「5回くりかえす（60歩・右72度）」を入れ、その下に「右に36度まわす」をいれよう！',
      drawScale: 1.5,
      startPos: { x: 210, y: 210, angle: -90 },
      fastDefault: true,
      needsPenBlock: false,
      cmds: repeatCmds(10, [...repeatCmds(5, [{ t: 'mv', v: 60 }, { t: 'tr', v: 72 }]), { t: 'tr', v: 36 }])
    }
  ];

  App.getChallengeGuideSegments = function (challenge) {
    return buildSegmentsFromCommands(challenge.cmds, challenge.startPos, challenge.drawScale, false);
  };

  // 点から線分への最短距離
  function distPointToSeg(px, py, s) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(px - s.x1, py - s.y1);
    let t = ((px - s.x1) * dx + (py - s.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
  }

  // おてほん線分と描かれた線分群が一致しているか判定（左回り反転も許容）
  function matchesExpectedSegments(drawnSegs, expectedSegs) {
    if (drawnSegs.length === 0 || expectedSegs.length === 0) return false;

    const tol = 8; // 論理ピクセル許容誤差
    const drawnTotal = drawnSegs.reduce((a, s) => a + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
    const expTotal = expectedSegs.reduce((a, s) => a + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
    if (drawnTotal < expTotal * 0.88 || drawnTotal > expTotal * 1.15) {
      return false;
    }

    // おてほんの各線分の始点・中点・終点が、描かれた線分のいずれかの近くにあるか
    for (let i = 0; i < expectedSegs.length; i++) {
      const es = expectedSegs[i];
      const mx = (es.x1 + es.x2) / 2;
      const my = (es.y1 + es.y2) / 2;
      const pts = [
        [es.x1, es.y1],
        [mx, my],
        [es.x2, es.y2]
      ];
      for (let p = 0; p < pts.length; p++) {
        let minD = Infinity;
        for (let j = 0; j < drawnSegs.length; j++) {
          const d = distPointToSeg(pts[p][0], pts[p][1], drawnSegs[j]);
          if (d < minD) minD = d;
        }
        if (minD > tol) return false;
      }
    }

    // 逆チェック：描かれた線分におてほんから大きく外れた線がないか
    for (let j = 0; j < drawnSegs.length; j++) {
      const ds = drawnSegs[j];
      const mx = (ds.x1 + ds.x2) / 2;
      const my = (ds.y1 + ds.y2) / 2;
      let minD = Infinity;
      for (let i = 0; i < expectedSegs.length; i++) {
        const d = distPointToSeg(mx, my, expectedSegs[i]);
        if (d < minD) minD = d;
      }
      if (minD > tol) return false;
    }

    return true;
  }

  function rotateSegments(segs, cx, cy, rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return segs.map((s) => {
      const dx1 = s.x1 - cx;
      const dy1 = s.y1 - cy;
      const dx2 = s.x2 - cx;
      const dy2 = s.y2 - cy;
      return {
        x1: cx + dx1 * cos - dy1 * sin,
        y1: cy + dx1 * sin + dy1 * cos,
        x2: cx + dx2 * cos - dy2 * sin,
        y2: cy + dx2 * sin + dy2 * cos,
        len: s.len
      };
    });
  }

  function segAngleRad(s) {
    return Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  }

  App.judgeChallenge = function (challenge, state) {
    const drawnSegs = state.segments;
    if (drawnSegs.length === 0) {
      const movedWithoutPen = state.actionLog.some((a) => a.type === 'move' && Math.abs(a.steps) > 0 && !a.drawing);
      if (movedWithoutPen) {
        return {
          cleared: false,
          warn: true,
          feedback: 'あれ？線がかかれていないよ！「ペンを下ろす」ブロックを いれてみよう！'
        };
      }
      return { cleared: false, warn: true, feedback: 'ブロックを つなげて「▶ じっこう」を おしてみよう！' };
    }

    const expectedNormal = buildSegmentsFromCommands(challenge.cmds, challenge.startPos, challenge.drawScale, false);
    const expectedMirror = buildSegmentsFromCommands(challenge.cmds, challenge.startPos, challenge.drawScale, true);

    let matched = matchesExpectedSegments(drawnSegs, expectedNormal) || matchesExpectedSegments(drawnSegs, expectedMirror);

    // 「まわる」を「うごかす」より先に置いた場合など、開始点での初期回転ズレを吸収して判定
    if (!matched && drawnSegs.length > 0 && expectedNormal.length > 0) {
      const drawnAng0 = segAngleRad(drawnSegs[0]);
      const cx = challenge.startPos.x;
      const cy = challenge.startPos.y;
      const candidates = [expectedNormal, expectedMirror];
      for (let k = 0; k < candidates.length && !matched; k++) {
        const base = candidates[k];
        const delta = drawnAng0 - segAngleRad(base[0]);
        const rotated = rotateSegments(base, cx, cy, delta);
        if (matchesExpectedSegments(drawnSegs, rotated)) {
          matched = true;
        }
      }
    }

    if (matched) {
      return {
        cleared: true,
        clearMessage: `問題 ${challenge.num}「${challenge.title}」クリア！！みごとな プログラムだね！`
      };
    }

    return {
      cleared: false,
      warn: true,
      feedback: 'おてほんの 点線と 少しちがうみたい。「💡 ヒント」や 歩数・角度を たしかめてみよう！'
    };
  };
})(window.TakakukeiApp);
