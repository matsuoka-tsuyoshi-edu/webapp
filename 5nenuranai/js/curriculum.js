/**
 * カリキュラム定義・ひらがな変換ロジック・7色データ・クリア判定
 */
(function (global) {
  'use strict';

  const FORTUNE_COLORS = [
    {
      mod: 0,
      name: '赤',
      hex: '#ff4757',
      textColor: '#ffffff',
      emoji: '❤️',
      defaultMsg: 'パワーがみなぎる1日！むずかしい算数にも元気にチャレンジしてみよう！',
      defaultItem: '赤いえんぴつ'
    },
    {
      mod: 1,
      name: 'オレンジ',
      hex: '#ff8c1a',
      textColor: '#1f0c00',
      emoji: '🍊',
      defaultMsg: 'えがおが光るハッピーデー！友だちにやさしい声をかけるとさらに吉！',
      defaultItem: 'ハンカチ'
    },
    {
      mod: 2,
      name: '黄',
      hex: '#ffd32a',
      textColor: '#261d00',
      emoji: '⭐',
      defaultMsg: 'ひらめきがさえる予感！授業でたくさん発表できるかも！',
      defaultItem: '星がたのシール'
    },
    {
      mod: 3,
      name: '緑',
      hex: '#2ed573',
      textColor: '#042411',
      emoji: '🍀',
      defaultMsg: '心がおちついて集中できる日！じっくり考えればきっと解けるよ！',
      defaultItem: '緑のノート'
    },
    {
      mod: 4,
      name: '青',
      hex: '#1e90ff',
      textColor: '#ffffff',
      emoji: '💎',
      defaultMsg: 'さわやかな風のようないい日！忘れ物チェックをすると大成功！',
      defaultItem: '水筒（すいとう）'
    },
    {
      mod: 5,
      name: 'あい色',
      hex: '#3b4cca',
      textColor: '#ffffff',
      emoji: '🌌',
      defaultMsg: 'ふしぎなちえがわいてくる日！本をよむと新しい発見があるよ！',
      defaultItem: '青いしおり'
    },
    {
      mod: 6,
      name: 'むらさき',
      hex: '#9c4dff',
      textColor: '#ffffff',
      emoji: '🔮',
      defaultMsg: 'まほうのようにラッキーが重なる日！じぶんの得意なことをのばそう！',
      defaultItem: 'きらきらキーホルダー'
    }
  ];

  // ひらがな → 母音番号マッピング（1:あ段, 2:い段, 3:う段, 4:え段, 5:お段, 0:ん/っ）
  const VOWEL_GROUPS = {
    1: 'あかさたなはまやらわがざだばぱぁゃゎ',
    2: 'いきしちにひみりぎじぢびぴぃゐ',
    3: 'うくすつぬふむゆるぐずづぶぷぅゅゔ',
    4: 'えけせてねへめれげぜでべぺぇゑ',
    5: 'おこそとのほもよろをごぞどぼぽぉょ',
    0: 'んっ'
  };

  const VOWEL_LABELS = {
    1: 'あ段',
    2: 'い段',
    3: 'う段',
    4: 'え段',
    5: 'お段',
    0: 'そのほか'
  };

  const CHAR_TO_NUM = {};
  Object.keys(VOWEL_GROUPS).forEach((numStr) => {
    const num = Number(numStr);
    const chars = VOWEL_GROUPS[numStr];
    for (let i = 0; i < chars.length; i++) {
      CHAR_TO_NUM[chars[i]] = num;
    }
  });

  function convertNameToNumbers(rawInput) {
    const normalized = String(rawInput || '')
      .normalize('NFKC')
      .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .trim();

    const items = [];
    let total = 0;
    let prevNum = 0;

    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === 'ー') {
        items.push({ char: ch, num: prevNum, vowel: 'のばす音' });
        total += prevNum;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(CHAR_TO_NUM, ch)) {
        const n = CHAR_TO_NUM[ch];
        items.push({ char: ch, num: n, vowel: VOWEL_LABELS[n] });
        total += n;
        prevNum = n;
      }
    }

    return { normalized: normalized, items: items, total: total };
  }

  function getTodayDayOfMonth() {
    return new Date().getDate();
  }

  function getColorByName(name) {
    for (let i = 0; i < FORTUNE_COLORS.length; i++) {
      if (FORTUNE_COLORS[i].name === name) return FORTUNE_COLORS[i];
    }
    return null;
  }

  function getStepsMeta(nameNum, todayDate) {
    const nVal = Number(nameNum) || 9;
    const dVal = Number(todayDate) || getTodayDayOfMonth();

    return {
      0: {
        id: 0,
        title: 'ステップ0：名前の数字変換マシン',
        desc: '自分の名前（ひらがな）を母音のルールで数字にへんかんしよう！',
        hint: '「あ・か・さ…」は1、「い・き・し…」は2、「う・く・す…」は3、「え・け・せ…」は4、「お・こ・そ…」は5、「ん」は0だよ。',
        allowedBlocks: [],
        starterBlocks: [],
        exampleBlocks: []
      },
      1: {
        id: 1,
        title: 'ステップ1：名前と日付をたそう！',
        desc: '「名前」「日付」の変数に数字を入れて、2つをたし算した答えを「名前と日付の和」に入れよう！',
        hint: '①[名前]を(...)にする → ②[日付]を(...)にする → ③[名前と日付の和]を([名前]+[日付])にする、のじゅんばんに並べよう！',
        allowedBlocks: ['set_name', 'set_date', 'add_sum'],
        starterBlocks: [],
        exampleBlocks: [
          { type: 'set_name', value: nVal },
          { type: 'set_date', value: dVal },
          { type: 'add_sum' }
        ]
      },
      2: {
        id: 2,
        title: 'ステップ2：2でわって四捨五入をくり返そう！',
        desc: '「名前と日付の和」を「2でわって四捨五入」する計算を、「5回くり返す」ブロックを使って組み立てよう！',
        hint: '「5回くり返す」ブロックのなかに、「[名前と日付の和]を(([名前と日付の和]÷2)を四捨五入)にする」ブロックを入れよう！',
        allowedBlocks: ['set_name', 'set_date', 'add_sum', 'repeat', 'halve_round'],
        starterBlocks: [
          { type: 'set_name', value: nVal },
          { type: 'set_date', value: dVal },
          { type: 'add_sum' }
        ],
        exampleBlocks: [
          { type: 'set_name', value: nVal },
          { type: 'set_date', value: dVal },
          { type: 'add_sum' },
          {
            type: 'repeat',
            count: 5,
            children: [{ type: 'halve_round' }]
          }
        ]
      },
      3: {
        id: 3,
        title: 'ステップ3：7でわったあまりで色をきめよう！',
        desc: 'まず「7でわったあまり」を計算し、「もし〜なら」ブロックで0〜6の余りに合わせた色をセットしよう！（少なくとも今の余りに合う分岐をつくってみよう）',
        hint: '①[7でわったあまり]を計算する → ②「もし<[7でわったあまり]=○>なら」の中に「[今日のラッキーカラー]を(色)にする」を入れよう！7色ぶん作るとかんぺき！',
        allowedBlocks: ['mod7', 'if_else_mod', 'if_mod', 'set_color'],
        starterBlocks: [
          { type: 'set_name', value: nVal },
          { type: 'set_date', value: dVal },
          { type: 'add_sum' },
          {
            type: 'repeat',
            count: 5,
            children: [{ type: 'halve_round' }]
          },
          { type: 'mod7' }
        ],
        exampleBlocks: [
          { type: 'set_name', value: nVal },
          { type: 'set_date', value: dVal },
          { type: 'add_sum' },
          {
            type: 'repeat',
            count: 5,
            children: [{ type: 'halve_round' }]
          },
          { type: 'mod7' }
        ].concat(
          FORTUNE_COLORS.map((c) => ({
            type: 'if_mod',
            modValue: c.mod,
            children: [{ type: 'set_color', color: c.name }]
          }))
        )
      },
      4: {
        id: 4,
        title: 'ステップ4：占いの館 オープン！',
        desc: '完全版の占いプログラムを実行しよう！下のボタンから「7色のメッセージ」を書いたり、「友だちをうらなう」ことができるよ！',
        hint: 'まずは「うらないを実行！」で占ってみよう。ブロックを変えたり、オリジナルのアドバイスを書いて友達と占い合おう！',
        allowedBlocks: ['set_name', 'set_date', 'add_sum', 'repeat', 'halve_round', 'mod7', 'if_else_mod', 'if_mod', 'set_color'],
        starterBlocks: null, // Step 4 はステップ3を引き継ぐか完全版プリセットを使用
        exampleBlocks: [
          { type: 'set_name', value: nVal },
          { type: 'set_date', value: dVal },
          { type: 'add_sum' },
          {
            type: 'repeat',
            count: 5,
            children: [{ type: 'halve_round' }]
          },
          { type: 'mod7' }
        ].concat(
          FORTUNE_COLORS.map((c) => ({
            type: 'if_mod',
            modValue: c.mod,
            children: [{ type: 'set_color', color: c.name }]
          }))
        )
      }
    };
  }

  function flattenBlocks(blocks) {
    const out = [];
    (blocks || []).forEach((b) => {
      out.push(b);
      if (b.children) out.push.apply(out, flattenBlocks(b.children));
      if (b.elseChildren) out.push.apply(out, flattenBlocks(b.elseChildren));
    });
    return out;
  }

  function evaluateStepGoal(stepId, blocks, vars) {
    const flat = flattenBlocks(blocks);
    if (stepId === 1) {
      const hasName = flat.some((b) => b.type === 'set_name');
      const hasDate = flat.some((b) => b.type === 'set_date');
      const hasAdd = flat.some((b) => b.type === 'add_sum');
      if (hasName && hasDate && hasAdd && vars['名前と日付の和'] === vars['名前'] + vars['日付']) {
        return { cleared: true, message: 'バッチリ！変数「名前」と「日付」をたし算できたね！ステップ2へ進もう！' };
      }
      return { cleared: false, reason: '「名前」「日付」「名前と日付の和（たし算）」の3つのブロックをつなげて実行してみよう！' };
    }

    if (stepId === 2) {
      const repeatBlock = flat.find((b) => b.type === 'repeat' && Number(b.count) === 5);
      const hasHalveInside = repeatBlock && (repeatBlock.children || []).some((c) => c.type === 'halve_round');
      if (repeatBlock && hasHalveInside) {
        return { cleared: true, message: 'すごい！「5回くり返す」ブロックでスッキリ計算できたね！次はステップ3だ！' };
      }
      return { cleared: false, reason: '「5回くり返す」ブロックのなかに「2でわって四捨五入」ブロックを入れて実行しよう！' };
    }

    if (stepId === 3) {
      const hasMod7 = flat.some((b) => b.type === 'mod7');
      const hasIf = flat.some((b) => b.type === 'if_mod' || b.type === 'if_else_mod');
      const colorSet = vars['今日のラッキーカラー'] && vars['今日のラッキーカラー'] !== 'まだきまっていない';
      if (hasMod7 && hasIf && colorSet) {
        return {
          cleared: true,
          message: 'おめでとう！7でわったあまりで「今日のラッキーカラー」がきまったね！いよいよ「占いの館」オープンだよ！'
        };
      }
      return {
        cleared: false,
        reason: '「7でわったあまり」を計算し、「もし〜なら」ブロックを使って「今日のラッキーカラー」が決まるようにしよう！（ヒント：おてほんボタンも参考になるよ）'
      };
    }

    if (stepId === 4) {
      const colorSet = vars['今日のラッキーカラー'] && vars['今日のラッキーカラー'] !== 'まだきまっていない';
      if (colorSet) {
        return { cleared: true, message: '🌟 占いの館・完全クリア！自分だけのオリジナルメッセージを書いて友だちと占い合おう！' };
      }
      return { cleared: false, reason: '「今日のラッキーカラー」が決まるようにプログラムを動かしてみよう！' };
    }

    return { cleared: false, reason: '' };
  }

  global.UranaiCurriculum = {
    FORTUNE_COLORS: FORTUNE_COLORS,
    convertNameToNumbers: convertNameToNumbers,
    getTodayDayOfMonth: getTodayDayOfMonth,
    getColorByName: getColorByName,
    getStepsMeta: getStepsMeta,
    evaluateStepGoal: evaluateStepGoal
  };
})(window);
