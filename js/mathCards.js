/**
 * Calculation Card Generator & Weakness Analyzer
 * Supports Addition (no_carry, carry_only, mix) and Subtraction (no_borrow lv1/lv2/lv3, borrow_only, mix).
 * Structured for future Grade 2+ expansion (mul, div, div_rem).
 */
(function (global) {
  "use strict";

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function buildAdditionPools() {
    const noCarry = [];
    const carry = [];
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        const sum = a + b;
        const card = {
          id: "add_" + a + "_" + b,
          mode: "add",
          a: a,
          b: b,
          operator: "＋",
          answer: sum,
          hasCarry: sum >= 10,
          hasRegroup: sum >= 10,
          subGroup: sum >= 10 ? "carry" : "no_carry",
          expression: a + " ＋ " + b,
        };
        if (sum >= 10) carry.push(card);
        else noCarry.push(card);
      }
    }
    return { noCarry: noCarry, carry: carry };
  }

  function buildSubtractionPools() {
    const lv1 = []; // 1桁 - 1桁（くりさがりなし）
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= a; b++) {
        lv1.push({
          id: "sub1_" + a + "_" + b,
          mode: "sub",
          a: a,
          b: b,
          operator: "－",
          answer: a - b,
          hasCarry: false,
          hasRegroup: false,
          subGroup: "no_borrow_lv1",
          expression: a + " － " + b,
        });
      }
    }

    const lv2 = []; // 2桁 - 1桁（くりさがりなし）
    for (let a = 11; a <= 19; a++) {
      const ones = a % 10;
      for (let b = 1; b <= ones; b++) {
        lv2.push({
          id: "sub2_" + a + "_" + b,
          mode: "sub",
          a: a,
          b: b,
          operator: "－",
          answer: a - b,
          hasCarry: false,
          hasRegroup: false,
          subGroup: "no_borrow_lv2",
          expression: a + " － " + b,
        });
      }
    }

    const borrow = []; // くりさがりあり（11..18 - b, b > a%10）
    for (let a = 11; a <= 18; a++) {
      const ones = a % 10;
      for (let b = ones + 1; b <= 9; b++) {
        borrow.push({
          id: "subB_" + a + "_" + b,
          mode: "sub",
          a: a,
          b: b,
          operator: "－",
          answer: a - b,
          hasCarry: false,
          hasRegroup: true,
          subGroup: "borrow",
          expression: a + " － " + b,
        });
      }
    }

    return { lv1: lv1, lv2: lv2, borrow: borrow };
  }

  /**
   * Generate a deck of calculation cards.
   * @param {Object} options
   * @param {string} [options.mode='add'] - 'add' | 'sub'
   * @param {number} [options.count=10]
   * @param {string} [options.regroupFilter='mix'] - 'none' | 'only' | 'mix'
   * @param {string} [options.subLevel='lv1'] - 'lv1' | 'lv2' | 'lv3' (when mode='sub' and regroupFilter='none')
   */
  function generateDeck(options) {
    const opts = options || {};
    const mode = opts.mode || "add";
    const count = opts.count || 10;
    const regroupFilter = opts.regroupFilter || opts.carryFilter || "mix";
    const subLevel = opts.subLevel || "lv1";

    if (mode === "add") {
      const pools = buildAdditionPools();
      if (regroupFilter === "none" || regroupFilter === "no_carry") {
        return shuffle(pools.noCarry).slice(0, count);
      }
      if (regroupFilter === "only" || regroupFilter === "carry_only") {
        return shuffle(pools.carry).slice(0, count);
      }
      const half = Math.floor(count / 2);
      const c1 = shuffle(pools.noCarry).slice(0, half);
      const c2 = shuffle(pools.carry).slice(0, count - c1.length);
      return shuffle(c1.concat(c2));
    }

    if (mode === "sub") {
      const pools = buildSubtractionPools();
      if (regroupFilter === "only") {
        return shuffle(pools.borrow).slice(0, count);
      }
      if (regroupFilter === "none") {
        if (subLevel === "lv1") {
          return shuffle(pools.lv1).slice(0, count);
        }
        if (subLevel === "lv2") {
          return shuffle(pools.lv2).slice(0, count);
        }
        // lv3: 1桁-1桁 と 2桁-1桁 のまぜまぜ
        const half = Math.floor(count / 2);
        const s1 = shuffle(pools.lv1).slice(0, half);
        const s2 = shuffle(pools.lv2).slice(0, count - s1.length);
        return shuffle(s1.concat(s2));
      }
      // くりさがり あり・なし まぜまぜ
      const noBorrowMix = shuffle(pools.lv1.slice(0, 20).concat(pools.lv2.slice(0, 20)));
      const half = Math.floor(count / 2);
      const s1 = shuffle(noBorrowMix).slice(0, half);
      const s2 = shuffle(pools.borrow).slice(0, count - s1.length);
      return shuffle(s1.concat(s2));
    }

    throw new Error("Unsupported mode: " + mode);
  }

  /**
   * Analyze a completed session for student-friendly feedback.
   */
  function analyzeResults(records) {
    const total = records.length;
    const correctCount = records.filter(function (r) { return r.isCorrect; }).length;
    const wrongRecords = records.filter(function (r) { return !r.isCorrect; });
    const mode = records.length > 0 ? records[0].card.mode : "add";

    const noRegroup = records.filter(function (r) { return !r.card.hasRegroup; });
    const withRegroup = records.filter(function (r) { return r.card.hasRegroup; });

    const noRegroupWrong = noRegroup.filter(function (r) { return !r.isCorrect; }).length;
    const withRegroupWrong = withRegroup.filter(function (r) { return !r.isCorrect; }).length;

    const totalMs = records.reduce(function (acc, r) { return acc + (r.elapsedMs || 0); }, 0);
    const avgSec = total > 0 ? totalMs / total / 1000 : 0;

    const slowCorrect = records.filter(function (r) {
      return r.isCorrect && (r.elapsedMs || 0) >= 7000;
    });

    const regroupWord = mode === "sub" ? "くりさがり" : "くりあがり";
    const opWord = mode === "sub" ? "ひきざん" : "たしざん";

    let headline = "";
    let advice = "";
    let badge = "🌟";

    if (correctCount === total && total >= 10) {
      badge = "👑";
      headline = "ぜんもん 1かいめ せいかい！ すごすぎる！！";
      if (avgSec <= 4.5) {
        advice = "とっても はやくて せいかく！ きみは " + opWord + " の めいじん だね！";
      } else {
        advice = "10もん ぜんぶ まちがえずに とけたね！ このちょうしで どんどん すすもう！";
      }
    } else if (correctCount === total) {
      badge = "🎉";
      headline = "ぜんぶ せいかい！ リベンジ せいこう！";
      advice = "にがてだった もんだいも しっかり できるようになったね！";
    } else if (withRegroupWrong > noRegroupWrong && withRegroup.length > 0) {
      badge = "💪";
      headline = "あとすこし！ よく がんばったね！";
      advice =
        mode === "sub"
          ? "「くりさがりの ある ひきざん」が ちょっと にがてかも！ 10のまとまりから ひいてみよう。"
          : "「10を こえる たしざん（くりあがり）」が ちょっと にがてかも！ 10の まとまりを つくると かんたんだよ。";
    } else if (noRegroupWrong > withRegroupWrong && noRegroup.length > 0) {
      badge = "🌱";
      headline = "おしい！ もうちょっとだね！";
      advice = "「" + regroupWord + " のない " + opWord + "」を もういちど ゆっくり たしかめてみよう！";
    } else {
      badge = "✨";
      headline = "チャレンジ おつかれさま！";
      advice = "まちがえた もんだいだけを もういちど やってみると、ぐんと とくいになるよ！";
    }

    if (correctCount < total && slowCorrect.length > 0 && wrongRecords.length <= 2) {
      advice += " （「" + slowCorrect[0].card.expression + "」のように じかんがかかった もんだいも れんしゅうしよう！）";
    }

    return {
      mode: mode,
      regroupWord: regroupWord,
      total: total,
      correctCount: correctCount,
      wrongCount: wrongRecords.length,
      wrongCards: wrongRecords.map(function (r) { return r.card; }),
      noRegroupStats: {
        total: noRegroup.length,
        correct: noRegroup.length - noRegroupWrong,
      },
      withRegroupStats: {
        total: withRegroup.length,
        correct: withRegroup.length - withRegroupWrong,
      },
      avgSec: avgSec,
      totalSec: totalMs / 1000,
      badge: badge,
      headline: headline,
      advice: advice,
    };
  }

  global.MathCards = {
    generateDeck: generateDeck,
    analyzeResults: analyzeResults,
  };
})(window);
