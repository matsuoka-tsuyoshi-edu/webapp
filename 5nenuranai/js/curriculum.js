/**
 * 教科書（小5算数 P.258〜259）準拠カリキュラム定義 (v2.1 Scratch本格ブロック版)
 */
(function (global) {
  'use strict';

  const FORTUNE_COLORS = [
    {
      mod: 0,
      name: '赤',
      hex: '#ff3b5c',
      glow: 'rgba(255, 59, 92, 0.78)',
      textColor: '#ffffff',
      emoji: '🔴',
      defaultMsg: 'パワーがみなぎる1日！むずかしい算数にも元気にチャレンジしてみよう！',
      defaultItem: '赤いえんぴつ'
    },
    {
      mod: 1,
      name: 'オレンジ',
      hex: '#ff8c1a',
      glow: 'rgba(255, 140, 26, 0.78)',
      textColor: '#1f0c00',
      emoji: '🟠',
      defaultMsg: 'えがおが光るハッピーデー！友だちにやさしい声をかけるとさらに吉！',
      defaultItem: 'ハンカチ'
    },
    {
      mod: 2,
      name: '黄',
      hex: '#ffd32a',
      glow: 'rgba(255, 211, 42, 0.78)',
      textColor: '#261d00',
      emoji: '🟡',
      defaultMsg: 'ひらめきがさえる予感！授業でたくさん発表できるかも！',
      defaultItem: '星がたのシール'
    },
    {
      mod: 3,
      name: '緑',
      hex: '#2ed573',
      glow: 'rgba(46, 213, 115, 0.78)',
      textColor: '#042411',
      emoji: '🟢',
      defaultMsg: '心がおちついて集中できる日！じっくり考えればきっと解けるよ！',
      defaultItem: '緑のノート'
    },
    {
      mod: 4,
      name: '青',
      hex: '#1e90ff',
      glow: 'rgba(30, 144, 255, 0.78)',
      textColor: '#ffffff',
      emoji: '🔵',
      defaultMsg: 'さわやかな風のようないい日！忘れ物チェックをすると大成功！',
      defaultItem: '水筒（すいとう）'
    },
    {
      mod: 5,
      name: 'あい色',
      hex: '#3b4cca',
      glow: 'rgba(59, 76, 202, 0.82)',
      textColor: '#ffffff',
      emoji: '🫐',
      defaultMsg: 'ふしぎなちえがわいてくる日！本をよむと新しい発見があるよ！',
      defaultItem: '青いしおり'
    },
    {
      mod: 6,
      name: 'むらさき',
      hex: '#9c4dff',
      glow: 'rgba(156, 77, 255, 0.82)',
      textColor: '#ffffff',
      emoji: '🟣',
      defaultMsg: 'まほうのようにラッキーが重なる日！じぶんの得意なことをのばそう！',
      defaultItem: 'きらきらキーホルダー'
    }
  ];

  // 教科書P.258「名前の置きかえルール」準拠
  const VOWEL_GROUPS = {
    1: 'あかさたなはまやらわがざだばぱぁゃゎ',
    2: 'いきしちにひみりぎじぢびぴぃゐ',
    3: 'うくすつぬふむゆるぐずづぶぷぅゅっゔ',
    4: 'えけせてねへめれげぜでべぺぇゑ',
    5: 'おこそとのほもよろをごぞどぼぽぉょ',
    0: 'ん'
  };

  const VOWEL_LABELS = { 1: 'あ段', 2: 'い段', 3: 'う段', 4: 'え段', 5: 'お段', 0: 'ん' };

  const CHAR_TO_NUM = {};
  Object.keys(VOWEL_GROUPS).forEach((numStr) => {
    const num = Number(numStr);
    const chars = VOWEL_GROUPS[numStr];
    for (let i = 0; i < chars.length; i++) {
      CHAR_TO_NUM[chars[i]] = num;
    }
  });

  function toHiragana(raw) {
    return String(raw || '')
      .normalize('NFKC')
      .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/\s+/g, '')
      .trim();
  }

  function convertNameToNumbers(rawInput) {
    const normalized = toHiragana(rawInput);
    const items = [];
    let digitStr = '';
    let prevNum = 0;

    for (let i = 0; i < normalized.length; i++) {
      if (items.length >= 14) break;
      const ch = normalized[i];
      if (ch === 'ー') {
        const n = prevNum;
        items.push({ char: ch, num: n, vowel: 'のばす音' });
        digitStr += String(n);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(CHAR_TO_NUM, ch)) {
        const n = CHAR_TO_NUM[ch];
        items.push({ char: ch, num: n, vowel: VOWEL_LABELS[n] });
        digitStr += String(n);
        prevNum = n;
      }
    }

    return {
      normalized: normalized,
      items: items,
      digitString: digitStr || '0',
      numberValue: digitStr ? Number(digitStr) : 0
    };
  }

  // フローチャート（教科書P.258準拠・6スロット）
  const FLOWCHART_ITEMS = [
    { id: 'name_to_num', label: '名前を数字に置きかえる', kind: 'process' },
    { id: 'add_date', label: '名前の数に日付をたす', kind: 'process' },
    { id: 'repeat_5', label: '5回くり返す', kind: 'loop' },
    { id: 'div_2', label: '2でわる', kind: 'process' },
    { id: 'round_1', label: '小数第一位を四捨五入する', kind: 'process' },
    { id: 'mod_7', label: '7でわったあまりがいくらか', kind: 'decision' }
  ];

  const FLOWCHART_SLOTS = [
    { key: 'ア', answerId: 'name_to_num', kind: 'process' },
    { key: 'イ', answerId: 'add_date', kind: 'process' },
    { key: 'ウ', answerId: 'repeat_5', kind: 'loop' },
    { key: 'エ', answerId: 'div_2', kind: 'process' },
    { key: 'オ', answerId: 'round_1', kind: 'process' },
    { key: 'カ', answerId: 'mod_7', kind: 'decision' }
  ];

  function getTodayDayOfMonth() {
    return new Date().getDate();
  }

  function getColorByName(name) {
    for (let i = 0; i < FORTUNE_COLORS.length; i++) {
      if (FORTUNE_COLORS[i].name === name) return FORTUNE_COLORS[i];
    }
    return null;
  }

  function getColorByMod(modVal) {
    const m = Number(modVal);
    for (let i = 0; i < FORTUNE_COLORS.length; i++) {
      if (FORTUNE_COLORS[i].mod === m) return FORTUNE_COLORS[i];
    }
    return null;
  }

  // =========================================================================
  // Scene 4 段階別パレット定義（フローチャートの光っている部分で使うブロックのみ）
  // =========================================================================
  const VAR_NAMES = {
    NAME: '置きかえた数字',
    DATE: '今日の日',
    SUM: '置き換えた数字と今日の日の和',
    MOD: '7でわったあまり',
    COLOR: '今日のラッキーカラー'
  };

  function getProgStageMeta(stageId) {
    const map = {
      A: {
        id: 'A',
        owlMsg: 'まずは光っている部分じゃ！「変わる数」の入れ物を用意して、名前と今日の日をセットし、2つをたした「和」をつくるのじゃ！',
        highlightSlots: ['ア', 'イ'],
        vars: [VAR_NAMES.NAME, VAR_NAMES.DATE, VAR_NAMES.SUM],
        commands: ['cmd_set', 'op_add'],
        colors: []
      },
      B: {
        id: 'B',
        owlMsg: 'おみごと！つぎは光っている「くり返し」の部分じゃ！「置き換えた数字と今日の日の和」を2でわって四捨五入する計算を、5回くり返すのじゃ！',
        highlightSlots: ['ウ', 'エ', 'オ'],
        vars: [VAR_NAMES.SUM],
        commands: ['cmd_repeat', 'cmd_set', 'op_div', 'op_round'],
        colors: []
      },
      C: {
        id: 'C',
        owlMsg: 'いよいよ最後、光っている「7でわったあまり」と色の分岐じゃ！あまり（0〜6）によって7色の「今日のラッキーカラー」を決めるのじゃ！',
        highlightSlots: ['カ'],
        vars: [VAR_NAMES.SUM, VAR_NAMES.MOD, VAR_NAMES.COLOR],
        commands: ['cmd_set', 'op_mod', 'cmd_if'],
        colors: FORTUNE_COLORS.map((c) => c.name)
      },
      DONE: {
        id: 'DONE',
        owlMsg: '完璧な魔法のプログラムが完成したぞ！いよいよ「占いの館（シミュレータ）」へ進もう！',
        highlightSlots: ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ'],
        vars: [VAR_NAMES.NAME, VAR_NAMES.DATE, VAR_NAMES.SUM, VAR_NAMES.MOD, VAR_NAMES.COLOR],
        commands: ['cmd_set', 'op_add', 'cmd_repeat', 'op_div', 'op_round', 'cmd_if', 'op_mod'],
        colors: FORTUNE_COLORS.map((c) => c.name)
      }
    };
    return map[stageId] || map.A;
  }

  // 式検査ヘルパー
  function isVarExpr(expr, expectedName) {
    return !!(expr && expr.kind === 'var' && expr.name === expectedName);
  }

  function isNumExpr(expr, expectedVal) {
    if (!expr || expr.kind !== 'num') return false;
    if (expectedVal === undefined) return expr.value !== '' && expr.value !== null && !isNaN(Number(expr.value));
    return Number(expr.value) === Number(expectedVal);
  }

  function isAddOfNameAndDate(expr) {
    if (!expr || expr.kind !== 'op_add') return false;
    return (
      (isVarExpr(expr.left, VAR_NAMES.NAME) && isVarExpr(expr.right, VAR_NAMES.DATE)) ||
      (isVarExpr(expr.left, VAR_NAMES.DATE) && isVarExpr(expr.right, VAR_NAMES.NAME))
    );
  }

  function isHalveRoundOfSum(expr) {
    if (!expr || expr.kind !== 'op_round') return false;
    const inner = expr.arg;
    return !!(inner && inner.kind === 'op_div' && isVarExpr(inner.left, VAR_NAMES.SUM) && isNumExpr(inner.right, 2));
  }

  function isMod7OfSum(expr) {
    return !!(expr && expr.kind === 'op_mod' && isVarExpr(expr.left, VAR_NAMES.SUM) && isNumExpr(expr.right, 7));
  }

  function evaluateProgramProgress(blocks) {
    const list = blocks || [];
    const idxName = list.findIndex((b) => b.type === 'cmd_set' && b.targetVar === VAR_NAMES.NAME && isNumExpr(b.valueExpr));
    const idxDate = list.findIndex((b) => b.type === 'cmd_set' && b.targetVar === VAR_NAMES.DATE && isNumExpr(b.valueExpr));
    const idxAdd = list.findIndex((b) => b.type === 'cmd_set' && b.targetVar === VAR_NAMES.SUM && isAddOfNameAndDate(b.valueExpr));

    const okA = idxName !== -1 && idxDate !== -1 && idxAdd !== -1 && idxAdd > idxName && idxAdd > idxDate;

    let okB = false;
    let idxRep = -1;
    if (okA) {
      idxRep = list.findIndex((b, idx) => {
        if (idx <= idxAdd || b.type !== 'cmd_repeat' || Number(b.count) !== 5) return false;
        return (b.children || []).some((ch) => ch.type === 'cmd_set' && ch.targetVar === VAR_NAMES.SUM && isHalveRoundOfSum(ch.valueExpr));
      });
      okB = idxRep !== -1;
    }

    let okMod = false;
    let missingColors = [];
    let wrongColorMsg = '';
    if (okB) {
      const idxMod = list.findIndex((b, idx) => idx > idxRep && b.type === 'cmd_set' && b.targetVar === VAR_NAMES.MOD && isMod7OfSum(b.valueExpr));
      okMod = idxMod !== -1;

      if (okMod) {
        const covered = {};
        list.forEach((b, idx) => {
          if (idx <= idxMod || b.type !== 'cmd_if') return;
          if (isVarExpr(b.leftExpr, VAR_NAMES.MOD) && b.rightVal !== '' && b.rightVal !== null) {
            const m = Number(b.rightVal);
            const expectedColor = getColorByMod(m);
            const setColorBlk = (b.children || []).find((ch) => ch.type === 'cmd_set' && ch.targetVar === VAR_NAMES.COLOR);
            if (expectedColor && setColorBlk && setColorBlk.valueExpr && setColorBlk.valueExpr.kind === 'color') {
              if (setColorBlk.valueExpr.value === expectedColor.name) {
                covered[String(m)] = true;
              } else {
                wrongColorMsg = m + ' のときのラッキーカラーは「' + expectedColor.name + '」だよ！';
              }
            }
          }
        });
        for (let m = 0; m <= 6; m++) {
          if (!covered[String(m)]) missingColors.push(m);
        }
      }
    }

    const okC = okB && okMod && missingColors.length === 0 && !wrongColorMsg;
    let stage = 'A';
    if (okA) stage = 'B';
    if (okB) stage = 'C';
    if (okC) stage = 'DONE';

    return {
      stage: stage,
      okA: okA,
      okB: okB,
      okMod: okMod,
      okC: okC,
      missingColors: missingColors,
      wrongColorMsg: wrongColorMsg
    };
  }

  function getCompletePreset(nameNum, todayDate) {
    return [
      { type: 'cmd_set', targetVar: VAR_NAMES.NAME, valueExpr: { kind: 'num', value: Number(nameNum) || 10332331 } },
      { type: 'cmd_set', targetVar: VAR_NAMES.DATE, valueExpr: { kind: 'num', value: Number(todayDate) || getTodayDayOfMonth() } },
      {
        type: 'cmd_set',
        targetVar: VAR_NAMES.SUM,
        valueExpr: {
          kind: 'op_add',
          left: { kind: 'var', name: VAR_NAMES.NAME },
          right: { kind: 'var', name: VAR_NAMES.DATE }
        }
      },
      {
        type: 'cmd_repeat',
        count: 5,
        children: [
          {
            type: 'cmd_set',
            targetVar: VAR_NAMES.SUM,
            valueExpr: {
              kind: 'op_round',
              arg: {
                kind: 'op_div',
                left: { kind: 'var', name: VAR_NAMES.SUM },
                right: { kind: 'num', value: 2 }
              }
            }
          }
        ]
      },
      {
        type: 'cmd_set',
        targetVar: VAR_NAMES.MOD,
        valueExpr: {
          kind: 'op_mod',
          left: { kind: 'var', name: VAR_NAMES.SUM },
          right: { kind: 'num', value: 7 }
        }
      }
    ].concat(
      FORTUNE_COLORS.map((c) => ({
        type: 'cmd_if',
        leftExpr: { kind: 'var', name: VAR_NAMES.MOD },
        rightVal: c.mod,
        children: [
          { type: 'cmd_set', targetVar: VAR_NAMES.COLOR, valueExpr: { kind: 'color', value: c.name } }
        ]
      }))
    );
  }

  global.UranaiCurriculum = {
    FORTUNE_COLORS: FORTUNE_COLORS,
    FLOWCHART_ITEMS: FLOWCHART_ITEMS,
    FLOWCHART_SLOTS: FLOWCHART_SLOTS,
    VAR_NAMES: VAR_NAMES,
    toHiragana: toHiragana,
    convertNameToNumbers: convertNameToNumbers,
    getTodayDayOfMonth: getTodayDayOfMonth,
    getColorByName: getColorByName,
    getColorByMod: getColorByMod,
    getProgStageMeta: getProgStageMeta,
    evaluateProgramProgress: evaluateProgramProgress,
    getCompletePreset: getCompletePreset
  };
})(window);
