/**
 * Calculation Card Generator & Weakness Analyzer
 * Supports:
 *   - Addition (no_carry, carry_only, mix)
 *   - Subtraction (no_borrow lv1/lv2/lv3, borrow_only, mix)
 *   - Multiplication (tables 2..9 asc/desc/rand, and 2..5 / 6..9 / pick3 / pick5 / all random)
 *   - Division (exact, remainder, mix)
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
          remainder: 0,
          hasRemainder: false,
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
    const lv1 = [];
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= a; b++) {
        lv1.push({
          id: "sub1_" + a + "_" + b,
          mode: "sub",
          a: a,
          b: b,
          operator: "－",
          answer: a - b,
          remainder: 0,
          hasRemainder: false,
          hasCarry: false,
          hasRegroup: false,
          subGroup: "no_borrow_lv1",
          expression: a + " － " + b,
        });
      }
    }

    const lv2 = [];
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
          remainder: 0,
          hasRemainder: false,
          hasCarry: false,
          hasRegroup: false,
          subGroup: "no_borrow_lv2",
          expression: a + " － " + b,
        });
      }
    }

    const borrow = [];
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
          remainder: 0,
          hasRemainder: false,
          hasCarry: false,
          hasRegroup: true,
          subGroup: "borrow",
          expression: a + " － " + b,
        });
      }
    }

    return { lv1: lv1, lv2: lv2, borrow: borrow };
  }

  function makeMulCard(a, b) {
    return {
      id: "mul_" + a + "_" + b,
      mode: "mul",
      a: a,
      b: b,
      operator: "×",
      answer: a * b,
      remainder: 0,
      hasRemainder: false,
      hasCarry: false,
      hasRegroup: a >= 6,
      subGroup: a >= 6 ? "high_table" : "low_table",
      expression: a + " × " + b,
    };
  }

  function buildMulDeckFromTables(tables, count) {
    const pool = [];
    tables.forEach(function (t) {
      for (let b = 1; b <= 9; b++) {
        pool.push(makeMulCard(t, b));
      }
    });
    return shuffle(pool).slice(0, count);
  }

  function buildDivisionPools() {
    const exact = [];
    const rem = [];
    for (let b = 2; b <= 9; b++) {
      for (let q = 1; q <= 9; q++) {
        const aExact = b * q;
        exact.push({
          id: "divE_" + aExact + "_" + b,
          mode: "div",
          a: aExact,
          b: b,
          operator: "÷",
          answer: q,
          remainder: 0,
          hasRemainder: false,
          hasCarry: false,
          hasRegroup: false,
          subGroup: "div_exact",
          expression: aExact + " ÷ " + b,
        });

        for (let r = 1; r < b; r++) {
          const aRem = b * q + r;
          rem.push({
            id: "divR_" + aRem + "_" + b,
            mode: "div",
            a: aRem,
            b: b,
            operator: "÷",
            answer: q,
            remainder: r,
            hasRemainder: true,
            hasCarry: false,
            hasRegroup: true,
            subGroup: "div_rem",
            expression: aRem + " ÷ " + b,
          });
        }
      }
    }
    return { exact: exact, rem: rem };
  }

  /**
   * Generate a deck of calculation cards.
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
        if (subLevel === "lv1") return shuffle(pools.lv1).slice(0, count);
        if (subLevel === "lv2") return shuffle(pools.lv2).slice(0, count);
        const half = Math.floor(count / 2);
        const s1 = shuffle(pools.lv1).slice(0, half);
        const s2 = shuffle(pools.lv2).slice(0, count - s1.length);
        return shuffle(s1.concat(s2));
      }
      const noBorrowMix = shuffle(pools.lv1.slice(0, 20).concat(pools.lv2.slice(0, 20)));
      const half = Math.floor(count / 2);
      const s1 = shuffle(noBorrowMix).slice(0, half);
      const s2 = shuffle(pools.borrow).slice(0, count - s1.length);
      return shuffle(s1.concat(s2));
    }

    if (mode === "mul") {
      const mulKind = opts.mulKind || "all_rand";
      if (mulKind === "table") {
        const table = opts.mulTable || 2;
        const order = opts.mulOrder || "asc";
        const cards = [];
        for (let b = 1; b <= 9; b++) {
          cards.push(makeMulCard(table, b));
        }
        if (order === "desc") return cards.reverse();
        if (order === "rand") return shuffle(cards);
        return cards;
      }

      if (mulKind === "low") return buildMulDeckFromTables([2, 3, 4, 5], 10);
      if (mulKind === "high") return buildMulDeckFromTables([6, 7, 8, 9], 10);
      if (mulKind === "pick3" || mulKind === "pick3_user" || mulKind === "pick3_auto") {
        const chosen = Array.isArray(opts.mulTables) && opts.mulTables.length === 3
          ? opts.mulTables.slice().sort(function (a, b) { return a - b; })
          : shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3).sort(function (a, b) { return a - b; });
        const deck = buildMulDeckFromTables(chosen, 10);
        deck.selectedTables = chosen;
        return deck;
      }
      if (mulKind === "pick5" || mulKind === "pick5_user" || mulKind === "pick5_auto") {
        const chosen = Array.isArray(opts.mulTables) && opts.mulTables.length === 5
          ? opts.mulTables.slice().sort(function (a, b) { return a - b; })
          : shuffle([2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 5).sort(function (a, b) { return a - b; });
        const deck = buildMulDeckFromTables(chosen, 10);
        deck.selectedTables = chosen;
        return deck;
      }
      return buildMulDeckFromTables([2, 3, 4, 5, 6, 7, 8, 9], 10);
    }

    if (mode === "div") {
      const divKind = opts.divKind || "mix"; // 'exact' | 'rem' | 'mix'
      const pools = buildDivisionPools();
      if (divKind === "exact") {
        return shuffle(pools.exact).slice(0, count);
      }
      if (divKind === "rem") {
        return shuffle(pools.rem).slice(0, count);
      }
      const half = Math.floor(count / 2);
      const d1 = shuffle(pools.exact).slice(0, half);
      const d2 = shuffle(pools.rem).slice(0, count - d1.length);
      return shuffle(d1.concat(d2));
    }

    throw new Error("Unsupported mode: " + mode);
  }

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

    const regroupWord =
      mode === "sub"
        ? "くりさがり"
        : mode === "mul"
          ? "6〜9のだん"
          : mode === "div"
            ? "あまり"
            : "くりあがり";
    const opWord =
      mode === "sub"
        ? "ひきざん"
        : mode === "mul"
          ? "かけざん"
          : mode === "div"
            ? "わりざん"
            : "たしざん";

    let headline = "";
    let advice = "";
    let badge = "🌟";

    if (correctCount === total && total >= 9) {
      badge = "👑";
      headline = "ぜんもん 1かいめ せいかい！ すごすぎる！！";
      if (avgSec <= 4.5) {
        advice = "とっても はやくて せいかく！ きみは " + opWord + " の めいじん だね！";
      } else {
        advice = total + "もん ぜんぶ まちがえずに とけたね！ このちょうしで どんどん すすもう！";
      }
    } else if (correctCount === total) {
      badge = "🎉";
      headline = "ぜんぶ せいかい！ リベンジ せいこう！";
      advice = "にがてだった もんだいも しっかり できるようになったね！";
    } else if (mode === "mul") {
      if (withRegroupWrong > noRegroupWrong && withRegroup.length > 0) {
        badge = "💪";
        headline = "あとすこし！ よく がんばったね！";
        advice = "「6〜9のだん」が ちょっと にがてかも！ 1つまえの だんに たす ほうほうを つかってみよう。";
      } else {
        badge = "✨";
        headline = "チャレンジ おつかれさま！";
        advice = "まちがえた 九九を もういちど やってみると、すらすら いえるようになるよ！";
      }
    } else if (mode === "div") {
      if (withRegroupWrong > noRegroupWrong && withRegroup.length > 0) {
        badge = "💪";
        headline = "あとすこし！ よく がんばったね！";
        advice = "「あまりのある わりざん」が ちょっと にがてかも！ わるかずの 九九で 1ばん ちかい かずを さがしてみよう。";
      } else {
        badge = "✨";
        headline = "チャレンジ おつかれさま！";
        advice = "まちがえた わりざんを もういちど やってみると、もっと はやく とけるようになるよ！";
      }
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
