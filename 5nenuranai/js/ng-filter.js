/**
 * 教育的安全設計：不適切ワードフィルター（NGワード辞書）
 * ひらがな・カタカナ・漢字・ローマ字・伏せ字・スペース混入などの揺らぎに対応します。
 */
(function (global) {
  'use strict';

  const WARNING_MESSAGE =
    'おっと！占いの館では、みんなが悲しくなる言葉や危険な魔法は使えないよ。別の言葉に変えてみよう！';

  // 正規化後の文字列に対して部分一致で検知するNG語リスト
  const NG_WORDS = [
    // 暴力的・攻撃的表現
    'しね', 'しぬ', '死ね', '死ぬ', 'ころす', 'ころせ', '殺す', '殺せ', 'ごろし',
    'じさつ', '自殺', 'ばくはつ', '爆発', 'ぼうりょく', '暴力', 'なぐる', '殴る',
    'けとばす', 'きえろ', '消えろ', 'くたばれ',
    // 侮辱・いじめ・悪口
    'ばか', 'バカ', '馬鹿', 'あほ', 'アホ', '阿呆', 'まぬけ', '間抜け', 'かす', 'カス',
    'くず', 'クズ', 'ごみ', 'ゴミ', 'きもい', 'キモい', 'キモイ', 'ぶす', 'ブス',
    'ぶさいく', 'でぶ', 'デブ', 'ちび', 'チビ', 'はげ', 'ハゲ', 'うざい', 'ウザい',
    'ざこ', 'ザコ', '雑魚', 'むのう', '無能', 'しつこい', 'だまれ', '黙れ', 'へたくそ',
    // 卑猥・排泄系いたずら語
    'うんこ', 'ウンコ', 'うんち', 'ウンチ', 'おしっこ', 'ちんこ', 'ちんちん', 'ちんぽ',
    'まんこ', 'おっぱい', 'せっくす', 'セックス', 'えっち', 'エッチ', 'へんたい', '変態',
    'ぱんつ', 'パンツ', 'はだか', '裸', 'おなら', 'ぶーぶーくさい', 'くさい',
    // 差別的・不適切表現
    'がいじ', 'ガイジ', 'きちがい', '気違い', 'しょうがいしゃ', 'びんぼう', '貧乏',
    // ローマ字・英語表記
    'shine', 'korosu', 'baka', 'aho', 'unko', 'unchi', 'oppai', 'chinko', 'manko',
    'fuck', 'shit', 'bitch', 'damn', 'kill', 'die', 'stupid', 'idiot', 'loser', 'sex', 'porn'
  ];

  // カタカナをひらがなに変換
  function katakanaToHiragana(str) {
    return str.replace(/[\u30a1-\u30f6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  }

  // 文字列を正規化（全角半角統一、小文字化、カタカナ→ひらがな）
  function normalizeBasic(input) {
    if (!input) return '';
    return katakanaToHiragana(String(input).normalize('NFKC').toLowerCase());
  }

  // 伏せ字・スペース・記号を除去した文字列も生成
  function normalizeStrict(input) {
    return normalizeBasic(input).replace(/[\s　・･.,。、!！?？\-_ー~〜○◯〇×✕*＊#＃@＠/／\\()（）「」『』]/g, '');
  }

  // 正規化済み辞書をあらかじめ準備
  const NORMALIZED_NG = NG_WORDS.map((w) => normalizeStrict(w)).filter(Boolean);

  function containsNgWord(text) {
    const basic = normalizeBasic(text);
    const strict = normalizeStrict(text);
    if (!strict && !basic) return false;

    for (let i = 0; i < NORMALIZED_NG.length; i++) {
      const ng = NORMALIZED_NG[i];
      if (basic.indexOf(ng) !== -1 || strict.indexOf(ng) !== -1) {
        return true;
      }
    }
    return false;
  }

  function validateText(text) {
    if (containsNgWord(text)) {
      return { ok: false, message: WARNING_MESSAGE };
    }
    return { ok: true, message: '' };
  }

  global.UranaiNgFilter = {
    WARNING_MESSAGE: WARNING_MESSAGE,
    containsNgWord: containsNgWord,
    validateText: validateText
  };
})(window);
