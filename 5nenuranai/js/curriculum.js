/**
 * 教科書（小5算数 P.258〜259）準拠カリキュラム定義
 * ・ひらがな＆カタカナ→母音数字連結変換（「さんすうしゅうた」→「10332331」）
 * ・フローチャート6スロット（ア〜カ）
 * ・7色マッピング（0:赤〜6:むらさき）
 * ・段階的ブロックプログラミング評価（ステージA/B/C）
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
  // 「小さい文字は、大きい文字と同じ段。」→ ぁゃゎ=1, ぃ=2, ぅゅっ=3, ぇ=4, ぉょ=5, ん=0
  const VOWEL_GROUPS = {
    1: 'あかさたなはまやらわがざだばぱぁゃゎ',
    2: 'いきしちにひみりぎじぢびぴぃゐ',
    3: 'うくすつぬふむゆるぐずづぶぷぅゅっゔ',
    4: 'えけせてねへめれげぜでべぺぇゑ',
    5: 'おこそとのほもよろをごぞどぼぽぉょ',
    0: 'ん'
  };

  const VOWEL_LABELS = {
    1: 'あ段',
    2: 'い段',
    3: 'う段',
    4: 'え段',
    5: 'お段',
    0: 'ん'
  };

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
      // カタカナ（ァ-ヶ、ヴ）をひらがなへ変換
      .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
      .replace(/\s+/g, '')
      .trim();
  }

  /**
   * 名前を1文字ずつ分解し、教科書通りに数字を「連結」したひとつの数にする
   * 例：「さんすうしゅうた」→「10332331」
   */
  function convertNameToNumbers(rawInput) {
    const normalized = toHiragana(rawInput);
    const items = [];
    let digitStr = '';
    let prevNum = 0;

    for (let i = 0; i < normalized.length; i++) {
      if (items.length >= 14) break; // JS安全整数範囲（15桁以内）
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
    { key: 'ア', answerId: 'name_to_num', kind: 'process', stage: 'A' },
    { key: 'イ', answerId: 'add_date', kind: 'process', stage: 'A' },
    { key: 'ウ', answerId: 'repeat_5', kind: 'loop', stage: 'B' },
    { key: 'エ', answerId: 'div_2', kind: 'process', stage: 'B' },
    { key: 'オ', answerId: 'round_1', kind: 'process', stage: 'B' },
    { key: 'カ', answerId: 'mod_7', kind: 'decision', stage: 'C' }
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

  // プログラミング画面（Scene 4）のステージ定義（フローチャート連動ステップ解放方式）
  function getProgStageMeta(stageId) {
    const map = {
      A: {
        id: 'A',
        title: 'ミッション1：名前と日付をたそう！（手順①②）',
        owlMsg: 'まずは光っている「ア」「イ」の部分じゃ！[名前]・[日付]をセットして、[名前と日付の和]を計算するブロックを並べるのじゃ。',
        allowedBlocks: ['set_name', 'set_date', 'add_sum'],
        highlightSlots: ['ア', 'イ']
      },
      B: {
        id: 'B',
        title: 'ミッション2：5回くり返そう！（手順③）',
        owlMsg: 'すばらしい！つぎは光っている「ウ・エ・オ」の部分じゃ！[5回くり返す]の中に[2でわって四捨五入]を入れるのじゃ。',
        allowedBlocks: ['set_name', 'set_date', 'add_sum', 'repeat', 'halve_round'],
        highlightSlots: ['ウ', 'エ', 'オ']
      },
      C: {
        id: 'C',
        title: 'ミッション3：7でわったあまりで色をきめよう！（手順④⑤）',
        owlMsg: 'あと少しじゃ！[7でわったあまり]を求めて、0〜6のすべてに合う[もし〜なら]で7つのラッキーカラーをきめるのじゃ！',
        allowedBlocks: ['mod7', 'if_mod', 'if_else_mod', 'set_color', 'set_name', 'set_date', 'add_sum', 'repeat', 'halve_round'],
        highlightSlots: ['カ']
      },
      DONE: {
        id: 'DONE',
        title: 'プログラムかんせい！',
        owlMsg: 'おみごと！完璧な魔法のプログラムができたぞ！下の「占いの館（シミュレータ）へ！」ボタンを押すのじゃ！',
        allowedBlocks: ['set_name', 'set_date', 'add_sum', 'repeat', 'halve_round', 'mod7', 'if_mod', 'if_else_mod', 'set_color'],
        highlightSlots: ['ア', 'イ', 'ウ', 'エ', 'オ', 'カ']
      }
    };
    return map[stageId] || map.A;
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

  function checkStageA(blocks) {
    const flat = flattenBlocks(blocks);
    const iName = flat.findIndex((b) => b.type === 'set_name');
    const iDate = flat.findIndex((b) => b.type === 'set_date');
    const iAdd = flat.findIndex((b) => b.type === 'add_sum');
    return iName !== -1 && iDate !== -1 && iAdd !== -1 && iAdd > iName && iAdd > iDate;
  }

  function checkStageB(blocks) {
    if (!checkStageA(blocks)) return false;
    const flat = flattenBlocks(blocks);
    const rep = flat.find((b) => b.type === 'repeat' && Number(b.count) === 5);
    return !!(rep && (rep.children || []).some((c) => c.type === 'halve_round'));
  }

  function checkStageC(blocks) {
    if (!checkStageB(blocks)) return false;
    const flat = flattenBlocks(blocks);
    const hasMod7 = flat.some((b) => b.type === 'mod7');
    if (!hasMod7) return false;

    // 0〜6 の7色すべての分岐が揃っているか確認（if_mod / if_else_mod）
    const coveredMods = {};
    flat.forEach((b) => {
      if ((b.type === 'if_mod' || b.type === 'if_else_mod') && (b.children || []).some((c) => c.type === 'set_color')) {
        coveredMods[String(b.modValue)] = true;
      }
    });
    for (let m = 0; m <= 6; m++) {
      if (!coveredMods[String(m)]) return false;
    }
    return true;
  }

  function getCompletePreset(nameNum, todayDate) {
    return [
      { type: 'set_name', value: Number(nameNum) || 10332331 },
      { type: 'set_date', value: Number(todayDate) || getTodayDayOfMonth() },
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
    );
  }

  global.UranaiCurriculum = {
    FORTUNE_COLORS: FORTUNE_COLORS,
    FLOWCHART_ITEMS: FLOWCHART_ITEMS,
    FLOWCHART_SLOTS: FLOWCHART_SLOTS,
    toHiragana: toHiragana,
    convertNameToNumbers: convertNameToNumbers,
    getTodayDayOfMonth: getTodayDayOfMonth,
    getColorByName: getColorByName,
    getColorByMod: getColorByMod,
    getProgStageMeta: getProgStageMeta,
    checkStageA: checkStageA,
    checkStageB: checkStageB,
    checkStageC: checkStageC,
    getCompletePreset: getCompletePreset
  };
})(window);
