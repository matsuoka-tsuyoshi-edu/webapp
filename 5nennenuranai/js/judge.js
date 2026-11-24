/**
 * judge.js
 * 小学5年生向け スモールステップ幾何学判定・つまずきフィードバックエンジン
 */
window.TakakukeiApp = window.TakakukeiApp || {};

window.TakakukeiApp.judgeStep = function (step, state, workspaceStats) {
  const { segments, actionLog } = state;

  if (step.goalType === 'free') {
    return { cleared: false, feedback: '' };
  }

  // 共通チェック：線が一本も描かれていない場合
  if (segments.length === 0) {
    const movedWithoutPen = actionLog.some((a) => a.type === 'move' && Math.abs(a.steps) > 0 && !a.drawing);
    if (movedWithoutPen) {
      return {
        cleared: false,
        warn: true,
        feedback: 'あれ？うごいたけれど 線がかかれていないよ！「ペンを下ろす」ブロックを 上に いれてみよう！'
      };
    }
    return {
      cleared: false,
      warn: true,
      feedback: 'ブロックを つなげて「▶ じっこう」を おしてみよう！'
    };
  }

  // 連続した線分の間の実際の曲がり角度（符号付き -180..180 あるいは 絶対値）を計算
  function angleDiff(a1, a2) {
    let d = (a2 - a1) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function isClosed(segs) {
    if (segs.length < 3) return false;
    const first = segs[0];
    const last = segs[segs.length - 1];
    const dist = Math.hypot(last.x2 - first.x1, last.y2 - first.y1);
    return dist < 6;
  }

  function allSameLength(segs, minLen) {
    if (segs.length === 0) return false;
    const base = segs[0].length;
    if (base < minLen) return false;
    return segs.every((s) => Math.abs(s.length - base) < Math.max(3, base * 0.05));
  }

  function allTurnsNear(segs, targetAbsDeg, tolerance) {
    if (segs.length < 2) return false;
    let sign = null;
    for (let i = 0; i < segs.length; i++) {
      const nextIdx = (i + 1) % segs.length;
      if (i === segs.length - 1 && !isClosed(segs)) break;
      const d = angleDiff(segs[i].angle, segs[nextIdx].angle);
      if (Math.abs(Math.abs(d) - targetAbsDeg) > tolerance) {
        return false;
      }
      const curSign = d >= 0 ? 1 : -1;
      if (sign === null) sign = curSign;
      else if (sign !== curSign) return false;
    }
    return true;
  }

  // ステップ1：線を書く
  if (step.goalType === 'line') {
    const totalLen = segments.reduce((acc, s) => acc + s.length, 0);
    if (totalLen >= 60) {
      return { cleared: true, feedback: '' };
    }
    return {
      cleared: false,
      warn: true,
      feedback: 'もう少し 長い線を かいてみよう！（100 歩うごかす がおすすめだよ）'
    };
  }

  // ステップ2：角（かど）
  if (step.goalType === 'corner') {
    if (segments.length < 2) {
      return {
        cleared: false,
        warn: true,
        feedback: '「100 歩うごかす」→「右に 90 度まわす」→「100 歩うごかす」の 2本の線で かどを つくろう！'
      };
    }
    for (let i = 0; i < segments.length - 1; i++) {
      const s1 = segments[i];
      const s2 = segments[i + 1];
      const d = Math.abs(angleDiff(s1.angle, s2.angle));
      if (s1.length >= 40 && s2.length >= 40 && Math.abs(d - 90) <= 5) {
        return { cleared: true, feedback: '' };
      }
    }
    return {
      cleared: false,
      warn: true,
      feedback: 'おしい！「90度」まわってから もう1回 すすんで、きれいな直角の かどを つくってみよう！'
    };
  }

  // ステップ3：正方形
  if (step.goalType === 'square') {
    if (segments.length === 4 && isClosed(segments) && allSameLength(segments, 40) && allTurnsNear(segments, 90, 3)) {
      const tip = workspaceStats.hasRepeat
        ? ''
        : '（※ 4回ならべて書けたね！つぎは「4回くりかえす」ブロックも つかってみると 短くなるよ！）';
      return { cleared: true, extraMessage: tip, feedback: '' };
    }
    return {
      cleared: false,
      warn: true,
      feedback: '正方形に なっていないよ。同じ長さで「4回」すすんで、かどは「90度」まわしてみよう！'
    };
  }

  // ステップ4：正三角形
  if (step.goalType === 'triangle') {
    if (segments.length === 3 && isClosed(segments) && allSameLength(segments, 40) && allTurnsNear(segments, 120, 3)) {
      return { cleared: true, feedback: '' };
    }
    // 60度バグの検出
    const has60Turn = state.turns.some((t) => Math.abs(Math.abs(t) - 60) <= 3);
    if (has60Turn) {
      return {
        cleared: false,
        warn: true,
        suggestExplain: true,
        feedback: 'おしい！図形の「うちがわ」の 60度 だと 外にひらいてしまうよ！「📖 かいせつ」を見て 外回りの角度を 考えよう！'
      };
    }
    return {
      cleared: false,
      warn: true,
      suggestExplain: true,
      feedback: '正三角形に なっていないよ。「3回」くりかえして、外回りに「120度」まわしてみよう！'
    };
  }

  // ステップ5：正五角形（隠しステージ）
  if (step.goalType === 'pentagon') {
    if (segments.length === 5 && isClosed(segments) && allSameLength(segments, 35) && allTurnsNear(segments, 72, 3)) {
      return { cleared: true, feedback: '' };
    }
    const has108Turn = state.turns.some((t) => Math.abs(Math.abs(t) - 108) <= 3);
    if (has108Turn) {
      return {
        cleared: false,
        warn: true,
        suggestExplain: true,
        feedback: 'おしい！108度は 五角形の「うちがわ」の角だよ！「360 ÷ 5 ＝ ？度」の 外回りを 考えよう！'
      };
    }
    return {
      cleared: false,
      warn: true,
      suggestExplain: true,
      feedback: '正五角形に なっていないよ。「5回」くりかえして、「360 ÷ 5」の角度だけ まわしてみよう！'
    };
  }

  // ステップ6：星型（隠しステージ）
  if (step.goalType === 'star') {
    if (segments.length === 5 && isClosed(segments) && allSameLength(segments, 40) && allTurnsNear(segments, 144, 3)) {
      return { cleared: true, feedback: '' };
    }
    const has36Turn = state.turns.some((t) => Math.abs(Math.abs(t) - 36) <= 3);
    if (has36Turn) {
      return {
        cleared: false,
        warn: true,
        suggestExplain: true,
        feedback: 'おしい！36度は トゲの「うちがわ」の角だよ！外回りに「180 − 36 ＝ 144度」まわしてみよう！'
      };
    }
    return {
      cleared: false,
      warn: true,
      suggestExplain: true,
      feedback: '星型に なっていないよ。「5回」くりかえして、外回りに「144度」まわしてみよう！'
    };
  }

  return { cleared: false, feedback: '' };
};
