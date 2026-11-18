/**
 * 穴埋め単語データ（ひらがな46文字・カタカナ45文字 全文字対応）
 * word: 表示・読み上げ単語
 * blankIndex: □にする文字のインデックス（0始まり）
 * target: 正解の文字（STROKESのキー）
 * emoji: 正解時に表示する絵文字
 * type: 'hiragana' | 'katakana'
 */
(function (global) {
  'use strict';

  const Kakijun = (global.Kakijun = global.Kakijun || {});

  Kakijun.WORDS = [
    // ================= ひらがな（46文字） =================
    { word: 'あかちゃん', blankIndex: 0, target: 'あ', emoji: '👶', type: 'hiragana' },
    { word: 'ぴあの', blankIndex: 1, target: 'あ', emoji: '🎹', type: 'hiragana' },
    { word: 'あり', blankIndex: 0, target: 'あ', emoji: '🐜', type: 'hiragana' },

    { word: 'いぬ', blankIndex: 0, target: 'い', emoji: '🐶', type: 'hiragana' },
    { word: 'すいか', blankIndex: 1, target: 'い', emoji: '🍉', type: 'hiragana' },
    { word: 'いちご', blankIndex: 0, target: 'い', emoji: '🍓', type: 'hiragana' },

    { word: 'うさぎ', blankIndex: 0, target: 'う', emoji: '🐰', type: 'hiragana' },
    { word: 'ぼうし', blankIndex: 1, target: 'う', emoji: '👒', type: 'hiragana' },
    { word: 'うし', blankIndex: 0, target: 'う', emoji: '🐄', type: 'hiragana' },

    { word: 'えほん', blankIndex: 0, target: 'え', emoji: '📖', type: 'hiragana' },
    { word: 'かえる', blankIndex: 1, target: 'え', emoji: '🐸', type: 'hiragana' },
    { word: 'えんぴつ', blankIndex: 0, target: 'え', emoji: '✏️', type: 'hiragana' },

    { word: 'おにぎり', blankIndex: 0, target: 'お', emoji: '🍙', type: 'hiragana' },
    { word: 'かお', blankIndex: 1, target: 'お', emoji: '😊', type: 'hiragana' },
    { word: 'おほしさま', blankIndex: 0, target: 'お', emoji: '⭐', type: 'hiragana' },

    { word: 'かさ', blankIndex: 0, target: 'か', emoji: '☂️', type: 'hiragana' },
    { word: 'みかん', blankIndex: 1, target: 'か', emoji: '🍊', type: 'hiragana' },
    { word: 'いるか', blankIndex: 2, target: 'か', emoji: '🐬', type: 'hiragana' },

    { word: 'きりん', blankIndex: 0, target: 'き', emoji: '🦒', type: 'hiragana' },
    { word: 'ゆき', blankIndex: 1, target: 'き', emoji: '❄️', type: 'hiragana' },
    { word: 'きのこ', blankIndex: 0, target: 'き', emoji: '🍄', type: 'hiragana' },

    { word: 'くま', blankIndex: 0, target: 'く', emoji: '🐻', type: 'hiragana' },
    { word: 'さくら', blankIndex: 1, target: 'く', emoji: '🌸', type: 'hiragana' },
    { word: 'にく', blankIndex: 1, target: 'く', emoji: '🍖', type: 'hiragana' },

    { word: 'けーき', blankIndex: 0, target: 'け', emoji: '🍰', type: 'hiragana' },
    { word: 'けむし', blankIndex: 0, target: 'け', emoji: '🐛', type: 'hiragana' },
    { word: 'とけい', blankIndex: 1, target: 'け', emoji: '🕰️', type: 'hiragana' },

    { word: 'こあら', blankIndex: 0, target: 'こ', emoji: '🐨', type: 'hiragana' },
    { word: 'ねこ', blankIndex: 1, target: 'こ', emoji: '🐱', type: 'hiragana' },
    { word: 'たこ', blankIndex: 1, target: 'こ', emoji: '🐙', type: 'hiragana' },

    { word: 'さかな', blankIndex: 0, target: 'さ', emoji: '🐟', type: 'hiragana' },
    { word: 'うさぎ', blankIndex: 1, target: 'さ', emoji: '🐰', type: 'hiragana' },
    { word: 'かさ', blankIndex: 1, target: 'さ', emoji: '☂️', type: 'hiragana' },

    { word: 'しか', blankIndex: 0, target: 'し', emoji: '🦌', type: 'hiragana' },
    { word: 'うし', blankIndex: 1, target: 'し', emoji: '🐄', type: 'hiragana' },
    { word: 'ほし', blankIndex: 1, target: 'し', emoji: '⭐', type: 'hiragana' },

    { word: 'すいか', blankIndex: 0, target: 'す', emoji: '🍉', type: 'hiragana' },
    { word: 'なす', blankIndex: 1, target: 'す', emoji: '🍆', type: 'hiragana' },
    { word: 'いす', blankIndex: 1, target: 'す', emoji: '🪑', type: 'hiragana' },

    { word: 'せみ', blankIndex: 0, target: 'せ', emoji: '🪲', type: 'hiragana' },
    { word: 'せんせい', blankIndex: 0, target: 'せ', emoji: '👩‍🏫', type: 'hiragana' },
    { word: 'ふうせん', blankIndex: 2, target: 'せ', emoji: '🎈', type: 'hiragana' },

    { word: 'そら', blankIndex: 0, target: 'そ', emoji: '🌤️', type: 'hiragana' },
    { word: 'そり', blankIndex: 0, target: 'そ', emoji: '🛷', type: 'hiragana' },
    { word: 'みそしる', blankIndex: 1, target: 'そ', emoji: '🥣', type: 'hiragana' },

    { word: 'たこ', blankIndex: 0, target: 'た', emoji: '🐙', type: 'hiragana' },
    { word: 'うた', blankIndex: 1, target: 'た', emoji: '🎵', type: 'hiragana' },
    { word: 'ぶた', blankIndex: 1, target: 'た', emoji: '🐷', type: 'hiragana' },

    { word: 'ちーず', blankIndex: 0, target: 'ち', emoji: '🧀', type: 'hiragana' },
    { word: 'はち', blankIndex: 1, target: 'ち', emoji: '🐝', type: 'hiragana' },
    { word: 'いちご', blankIndex: 1, target: 'ち', emoji: '🍓', type: 'hiragana' },

    { word: 'つき', blankIndex: 0, target: 'つ', emoji: '🌙', type: 'hiragana' },
    { word: 'くつ', blankIndex: 1, target: 'つ', emoji: '👞', type: 'hiragana' },
    { word: 'えんぴつ', blankIndex: 3, target: 'つ', emoji: '✏️', type: 'hiragana' },

    { word: 'てぶくろ', blankIndex: 0, target: 'て', emoji: '🧤', type: 'hiragana' },
    { word: 'てがみ', blankIndex: 0, target: 'て', emoji: '✉️', type: 'hiragana' },
    { word: 'ぽてと', blankIndex: 1, target: 'て', emoji: '🍟', type: 'hiragana' },

    { word: 'とまと', blankIndex: 0, target: 'と', emoji: '🍅', type: 'hiragana' },
    { word: 'とり', blankIndex: 0, target: 'と', emoji: '🐦', type: 'hiragana' },
    { word: 'ぽてと', blankIndex: 2, target: 'と', emoji: '🍟', type: 'hiragana' },

    { word: 'なす', blankIndex: 0, target: 'な', emoji: '🍆', type: 'hiragana' },
    { word: 'ばなな', blankIndex: 1, target: 'な', emoji: '🍌', type: 'hiragana' },
    { word: 'さかな', blankIndex: 2, target: 'な', emoji: '🐟', type: 'hiragana' },

    { word: 'にじ', blankIndex: 0, target: 'に', emoji: '🌈', type: 'hiragana' },
    { word: 'おにぎり', blankIndex: 1, target: 'に', emoji: '🍙', type: 'hiragana' },
    { word: 'わに', blankIndex: 1, target: 'に', emoji: '🐊', type: 'hiragana' },

    { word: 'ぬりえ', blankIndex: 0, target: 'ぬ', emoji: '🎨', type: 'hiragana' },
    { word: 'いぬ', blankIndex: 1, target: 'ぬ', emoji: '🐶', type: 'hiragana' },
    { word: 'たぬき', blankIndex: 1, target: 'ぬ', emoji: '🦝', type: 'hiragana' },

    { word: 'ねこ', blankIndex: 0, target: 'ね', emoji: '🐱', type: 'hiragana' },
    { word: 'きつね', blankIndex: 2, target: 'ね', emoji: '🦊', type: 'hiragana' },
    { word: 'ねずみ', blankIndex: 0, target: 'ね', emoji: '🐭', type: 'hiragana' },

    { word: 'のり', blankIndex: 0, target: 'の', emoji: '🍙', type: 'hiragana' },
    { word: 'きのこ', blankIndex: 1, target: 'の', emoji: '🍄', type: 'hiragana' },
    { word: 'ぴあの', blankIndex: 2, target: 'の', emoji: '🎹', type: 'hiragana' },

    { word: 'はな', blankIndex: 0, target: 'は', emoji: '🌷', type: 'hiragana' },
    { word: 'ごはん', blankIndex: 1, target: 'は', emoji: '🍚', type: 'hiragana' },
    { word: 'はち', blankIndex: 0, target: 'は', emoji: '🐝', type: 'hiragana' },

    { word: 'ひよこ', blankIndex: 0, target: 'ひ', emoji: '🐥', type: 'hiragana' },
    { word: 'ひまわり', blankIndex: 0, target: 'ひ', emoji: '🌻', type: 'hiragana' },
    { word: 'あひる', blankIndex: 1, target: 'ひ', emoji: '🦆', type: 'hiragana' },

    { word: 'ふうせん', blankIndex: 0, target: 'ふ', emoji: '🎈', type: 'hiragana' },
    { word: 'ふね', blankIndex: 0, target: 'ふ', emoji: '🚢', type: 'hiragana' },
    { word: 'おふろ', blankIndex: 1, target: 'ふ', emoji: '🛁', type: 'hiragana' },

    { word: 'へび', blankIndex: 0, target: 'へ', emoji: '🐍', type: 'hiragana' },
    { word: 'へちま', blankIndex: 0, target: 'へ', emoji: '🥒', type: 'hiragana' },
    { word: 'おへそ', blankIndex: 1, target: 'へ', emoji: '😊', type: 'hiragana' },

    { word: 'ほし', blankIndex: 0, target: 'ほ', emoji: '⭐', type: 'hiragana' },
    { word: 'えほん', blankIndex: 1, target: 'ほ', emoji: '📖', type: 'hiragana' },
    { word: 'おほしさま', blankIndex: 1, target: 'ほ', emoji: '🌟', type: 'hiragana' },

    { word: 'まめ', blankIndex: 0, target: 'ま', emoji: '🫛', type: 'hiragana' },
    { word: 'とまと', blankIndex: 1, target: 'ま', emoji: '🍅', type: 'hiragana' },
    { word: 'くるま', blankIndex: 2, target: 'ま', emoji: '🚗', type: 'hiragana' },

    { word: 'みかん', blankIndex: 0, target: 'み', emoji: '🍊', type: 'hiragana' },
    { word: 'みみ', blankIndex: 0, target: 'み', emoji: '👂', type: 'hiragana' },
    { word: 'はさみ', blankIndex: 2, target: 'み', emoji: '✂️', type: 'hiragana' },

    { word: 'むし', blankIndex: 0, target: 'む', emoji: '🐛', type: 'hiragana' },
    { word: 'おむらいす', blankIndex: 1, target: 'む', emoji: '🍳', type: 'hiragana' },
    { word: 'けむし', blankIndex: 1, target: 'む', emoji: '🐛', type: 'hiragana' },

    { word: 'めがね', blankIndex: 0, target: 'め', emoji: '👓', type: 'hiragana' },
    { word: 'あめ', blankIndex: 1, target: 'め', emoji: '🍬', type: 'hiragana' },
    { word: 'かめ', blankIndex: 1, target: 'め', emoji: '🐢', type: 'hiragana' },

    { word: 'もも', blankIndex: 0, target: 'も', emoji: '🍑', type: 'hiragana' },
    { word: 'くも', blankIndex: 1, target: 'も', emoji: '☁️', type: 'hiragana' },
    { word: 'いも', blankIndex: 1, target: 'も', emoji: '🍠', type: 'hiragana' },

    { word: 'やま', blankIndex: 0, target: 'や', emoji: '⛰️', type: 'hiragana' },
    { word: 'やきいも', blankIndex: 0, target: 'や', emoji: '🍠', type: 'hiragana' },
    { word: 'たいや', blankIndex: 2, target: 'や', emoji: '🛞', type: 'hiragana' },

    { word: 'ゆき', blankIndex: 0, target: 'ゆ', emoji: '❄️', type: 'hiragana' },
    { word: 'ゆびわ', blankIndex: 0, target: 'ゆ', emoji: '💍', type: 'hiragana' },
    { word: 'おゆ', blankIndex: 1, target: 'ゆ', emoji: '♨️', type: 'hiragana' },

    { word: 'よっと', blankIndex: 0, target: 'よ', emoji: '⛵', type: 'hiragana' },
    { word: 'ひよこ', blankIndex: 1, target: 'よ', emoji: '🐥', type: 'hiragana' },
    { word: 'たいよう', blankIndex: 2, target: 'よ', emoji: '☀️', type: 'hiragana' },

    { word: 'らいおん', blankIndex: 0, target: 'ら', emoji: '🦁', type: 'hiragana' },
    { word: 'とら', blankIndex: 1, target: 'ら', emoji: '🐯', type: 'hiragana' },
    { word: 'さくら', blankIndex: 2, target: 'ら', emoji: '🌸', type: 'hiragana' },

    { word: 'りす', blankIndex: 0, target: 'り', emoji: '🐿️', type: 'hiragana' },
    { word: 'りんご', blankIndex: 0, target: 'り', emoji: '🍎', type: 'hiragana' },
    { word: 'あり', blankIndex: 1, target: 'り', emoji: '🐜', type: 'hiragana' },

    { word: 'るびー', blankIndex: 0, target: 'る', emoji: '💎', type: 'hiragana' },
    { word: 'かえる', blankIndex: 2, target: 'る', emoji: '🐸', type: 'hiragana' },
    { word: 'さる', blankIndex: 1, target: 'る', emoji: '🐒', type: 'hiragana' },

    { word: 'れもん', blankIndex: 0, target: 'れ', emoji: '🍋', type: 'hiragana' },
    { word: 'かれー', blankIndex: 1, target: 'れ', emoji: '🍛', type: 'hiragana' },
    { word: 'れいぞうこ', blankIndex: 0, target: 'れ', emoji: '🧊', type: 'hiragana' },

    { word: 'ろぼっと', blankIndex: 0, target: 'ろ', emoji: '🤖', type: 'hiragana' },
    { word: 'てぶくろ', blankIndex: 3, target: 'ろ', emoji: '🧤', type: 'hiragana' },
    { word: 'おふろ', blankIndex: 2, target: 'ろ', emoji: '🛁', type: 'hiragana' },

    { word: 'わに', blankIndex: 0, target: 'わ', emoji: '🐊', type: 'hiragana' },
    { word: 'ゆびわ', blankIndex: 2, target: 'わ', emoji: '💍', type: 'hiragana' },
    { word: 'ひまわり', blankIndex: 2, target: 'わ', emoji: '🌻', type: 'hiragana' },

    { word: 'てをあらう', blankIndex: 1, target: 'を', emoji: '🧼', type: 'hiragana' },
    { word: 'ほんをよむ', blankIndex: 2, target: 'を', emoji: '📖', type: 'hiragana' },

    { word: 'ぱんだ', blankIndex: 1, target: 'ん', emoji: '🐼', type: 'hiragana' },
    { word: 'みかん', blankIndex: 2, target: 'ん', emoji: '🍊', type: 'hiragana' },
    { word: 'めろん', blankIndex: 2, target: 'ん', emoji: '🍈', type: 'hiragana' },

    // ================= カタカナ（45文字） =================
    { word: 'アイス', blankIndex: 0, target: 'ア', emoji: '🍨', type: 'katakana' },
    { word: 'ピアノ', blankIndex: 1, target: 'ア', emoji: '🎹', type: 'katakana' },
    { word: 'コアラ', blankIndex: 1, target: 'ア', emoji: '🐨', type: 'katakana' },

    { word: 'イカ', blankIndex: 0, target: 'イ', emoji: '🦑', type: 'katakana' },
    { word: 'スイカ', blankIndex: 1, target: 'イ', emoji: '🍉', type: 'katakana' },
    { word: 'イルカ', blankIndex: 0, target: 'イ', emoji: '🐬', type: 'katakana' },

    { word: 'ウサギ', blankIndex: 0, target: 'ウ', emoji: '🐰', type: 'katakana' },
    { word: 'ゾウ', blankIndex: 1, target: 'ウ', emoji: '🐘', type: 'katakana' },
    { word: 'マウス', blankIndex: 1, target: 'ウ', emoji: '🐭', type: 'katakana' },

    { word: 'エプロン', blankIndex: 0, target: 'エ', emoji: '👩‍🍳', type: 'katakana' },
    { word: 'カエル', blankIndex: 1, target: 'エ', emoji: '🐸', type: 'katakana' },

    { word: 'オニギリ', blankIndex: 0, target: 'オ', emoji: '🍙', type: 'katakana' },
    { word: 'オオカミ', blankIndex: 0, target: 'オ', emoji: '🐺', type: 'katakana' },

    { word: 'カメラ', blankIndex: 0, target: 'カ', emoji: '📷', type: 'katakana' },
    { word: 'イルカ', blankIndex: 2, target: 'カ', emoji: '🐬', type: 'katakana' },
    { word: 'カサ', blankIndex: 0, target: 'カ', emoji: '☂️', type: 'katakana' },

    { word: 'キリン', blankIndex: 0, target: 'キ', emoji: '🦒', type: 'katakana' },
    { word: 'キツネ', blankIndex: 0, target: 'キ', emoji: '🦊', type: 'katakana' },
    { word: 'ケーキ', blankIndex: 2, target: 'キ', emoji: '🍰', type: 'katakana' },

    { word: 'クマ', blankIndex: 0, target: 'ク', emoji: '🐻', type: 'katakana' },
    { word: 'クルマ', blankIndex: 0, target: 'ク', emoji: '🚗', type: 'katakana' },
    { word: 'マスク', blankIndex: 2, target: 'ク', emoji: '😷', type: 'katakana' },

    { word: 'ケーキ', blankIndex: 0, target: 'ケ', emoji: '🍰', type: 'katakana' },
    { word: 'バケツ', blankIndex: 1, target: 'ケ', emoji: '🪣', type: 'katakana' },

    { word: 'コアラ', blankIndex: 0, target: 'コ', emoji: '🐨', type: 'katakana' },
    { word: 'ネコ', blankIndex: 1, target: 'コ', emoji: '🐱', type: 'katakana' },
    { word: 'タコ', blankIndex: 1, target: 'コ', emoji: '🐙', type: 'katakana' },

    { word: 'サル', blankIndex: 0, target: 'サ', emoji: '🐒', type: 'katakana' },
    { word: 'ウサギ', blankIndex: 1, target: 'サ', emoji: '🐰', type: 'katakana' },
    { word: 'サカナ', blankIndex: 0, target: 'サ', emoji: '🐟', type: 'katakana' },

    { word: 'シマウマ', blankIndex: 0, target: 'シ', emoji: '🦓', type: 'katakana' },
    { word: 'ウシ', blankIndex: 1, target: 'シ', emoji: '🐄', type: 'katakana' },
    { word: 'ブラシ', blankIndex: 2, target: 'シ', emoji: '🪥', type: 'katakana' },

    { word: 'スイカ', blankIndex: 0, target: 'ス', emoji: '🍉', type: 'katakana' },
    { word: 'アイス', blankIndex: 2, target: 'ス', emoji: '🍨', type: 'katakana' },
    { word: 'バス', blankIndex: 1, target: 'ス', emoji: '🚌', type: 'katakana' },

    { word: 'セミ', blankIndex: 0, target: 'セ', emoji: '🪲', type: 'katakana' },
    { word: 'セーター', blankIndex: 0, target: 'セ', emoji: '🧶', type: 'katakana' },

    { word: 'ソラ', blankIndex: 0, target: 'ソ', emoji: '🌤️', type: 'katakana' },
    { word: 'ソリ', blankIndex: 0, target: 'ソ', emoji: '🛷', type: 'katakana' },

    { word: 'タコ', blankIndex: 0, target: 'タ', emoji: '🐙', type: 'katakana' },
    { word: 'ブタ', blankIndex: 1, target: 'タ', emoji: '🐷', type: 'katakana' },
    { word: 'タオル', blankIndex: 0, target: 'タ', emoji: '🧻', type: 'katakana' },

    { word: 'チーズ', blankIndex: 0, target: 'チ', emoji: '🧀', type: 'katakana' },
    { word: 'イチゴ', blankIndex: 1, target: 'チ', emoji: '🍓', type: 'katakana' },
    { word: 'ハチ', blankIndex: 1, target: 'チ', emoji: '🐝', type: 'katakana' },

    { word: 'ツキ', blankIndex: 0, target: 'ツ', emoji: '🌙', type: 'katakana' },
    { word: 'キツネ', blankIndex: 1, target: 'ツ', emoji: '🦊', type: 'katakana' },
    { word: 'クツ', blankIndex: 1, target: 'ツ', emoji: '👞', type: 'katakana' },

    { word: 'テレビ', blankIndex: 0, target: 'テ', emoji: '📺', type: 'katakana' },
    { word: 'テント', blankIndex: 0, target: 'テ', emoji: '⛺', type: 'katakana' },
    { word: 'ポテト', blankIndex: 1, target: 'テ', emoji: '🍟', type: 'katakana' },

    { word: 'トマト', blankIndex: 0, target: 'ト', emoji: '🍅', type: 'katakana' },
    { word: 'ロケット', blankIndex: 3, target: 'ト', emoji: '🚀', type: 'katakana' },
    { word: 'ポテト', blankIndex: 2, target: 'ト', emoji: '🍟', type: 'katakana' },

    { word: 'ナス', blankIndex: 0, target: 'ナ', emoji: '🍆', type: 'katakana' },
    { word: 'バナナ', blankIndex: 1, target: 'ナ', emoji: '🍌', type: 'katakana' },
    { word: 'サカナ', blankIndex: 2, target: 'ナ', emoji: '🐟', type: 'katakana' },

    { word: 'ニンジン', blankIndex: 0, target: 'ニ', emoji: '🥕', type: 'katakana' },
    { word: 'ワニ', blankIndex: 1, target: 'ニ', emoji: '🐊', type: 'katakana' },

    { word: 'ヌイグルミ', blankIndex: 0, target: 'ヌ', emoji: '🧸', type: 'katakana' },
    { word: 'イヌ', blankIndex: 1, target: 'ヌ', emoji: '🐶', type: 'katakana' },

    { word: 'ネコ', blankIndex: 0, target: 'ネ', emoji: '🐱', type: 'katakana' },
    { word: 'キツネ', blankIndex: 2, target: 'ネ', emoji: '🦊', type: 'katakana' },
    { word: 'メガネ', blankIndex: 2, target: 'ネ', emoji: '👓', type: 'katakana' },

    { word: 'ノート', blankIndex: 0, target: 'ノ', emoji: '📓', type: 'katakana' },
    { word: 'ピアノ', blankIndex: 2, target: 'ノ', emoji: '🎹', type: 'katakana' },
    { word: 'キノコ', blankIndex: 1, target: 'ノ', emoji: '🍄', type: 'katakana' },

    { word: 'ハサミ', blankIndex: 0, target: 'ハ', emoji: '✂️', type: 'katakana' },
    { word: 'ハチ', blankIndex: 0, target: 'ハ', emoji: '🐝', type: 'katakana' },

    { word: 'ヒヨコ', blankIndex: 0, target: 'ヒ', emoji: '🐥', type: 'katakana' },
    { word: 'アヒル', blankIndex: 1, target: 'ヒ', emoji: '🦆', type: 'katakana' },

    { word: 'フネ', blankIndex: 0, target: 'フ', emoji: '🚢', type: 'katakana' },
    { word: 'フウセン', blankIndex: 0, target: 'フ', emoji: '🎈', type: 'katakana' },

    { word: 'ヘビ', blankIndex: 0, target: 'ヘ', emoji: '🐍', type: 'katakana' },
    { word: 'ヘリコプター', blankIndex: 0, target: 'ヘ', emoji: '🚁', type: 'katakana' },

    { word: 'ホシ', blankIndex: 0, target: 'ホ', emoji: '⭐', type: 'katakana' },
    { word: 'ホネ', blankIndex: 0, target: 'ホ', emoji: '🦴', type: 'katakana' },

    { word: 'マスク', blankIndex: 0, target: 'マ', emoji: '😷', type: 'katakana' },
    { word: 'クマ', blankIndex: 1, target: 'マ', emoji: '🐻', type: 'katakana' },
    { word: 'トマト', blankIndex: 1, target: 'マ', emoji: '🍅', type: 'katakana' },

    { word: 'ミカン', blankIndex: 0, target: 'ミ', emoji: '🍊', type: 'katakana' },
    { word: 'ハサミ', blankIndex: 2, target: 'ミ', emoji: '✂️', type: 'katakana' },
    { word: 'ネズミ', blankIndex: 2, target: 'ミ', emoji: '🐭', type: 'katakana' },

    { word: 'ムシ', blankIndex: 0, target: 'ム', emoji: '🐛', type: 'katakana' },
    { word: 'オムライス', blankIndex: 1, target: 'ム', emoji: '🍳', type: 'katakana' },

    { word: 'メガネ', blankIndex: 0, target: 'メ', emoji: '👓', type: 'katakana' },
    { word: 'カメラ', blankIndex: 1, target: 'メ', emoji: '📷', type: 'katakana' },

    { word: 'モモ', blankIndex: 0, target: 'モ', emoji: '🍑', type: 'katakana' },
    { word: 'クモ', blankIndex: 1, target: 'モ', emoji: '☁️', type: 'katakana' },

    { word: 'ヤマ', blankIndex: 0, target: 'ヤ', emoji: '⛰️', type: 'katakana' },
    { word: 'タイヤ', blankIndex: 2, target: 'ヤ', emoji: '🛞', type: 'katakana' },

    { word: 'ユキ', blankIndex: 0, target: 'ユ', emoji: '❄️', type: 'katakana' },
    { word: 'ユビワ', blankIndex: 0, target: 'ユ', emoji: '💍', type: 'katakana' },

    { word: 'ヨット', blankIndex: 0, target: 'ヨ', emoji: '⛵', type: 'katakana' },
    { word: 'ヒヨコ', blankIndex: 1, target: 'ヨ', emoji: '🐥', type: 'katakana' },
    { word: 'クレヨン', blankIndex: 2, target: 'ヨ', emoji: '🖍️', type: 'katakana' },

    { word: 'ライオン', blankIndex: 0, target: 'ラ', emoji: '🦁', type: 'katakana' },
    { word: 'コアラ', blankIndex: 2, target: 'ラ', emoji: '🐨', type: 'katakana' },
    { word: 'カメラ', blankIndex: 2, target: 'ラ', emoji: '📷', type: 'katakana' },

    { word: 'リンゴ', blankIndex: 0, target: 'リ', emoji: '🍎', type: 'katakana' },
    { word: 'キリン', blankIndex: 1, target: 'リ', emoji: '🦒', type: 'katakana' },
    { word: 'ゴリラ', blankIndex: 1, target: 'リ', emoji: '🦍', type: 'katakana' },

    { word: 'イルカ', blankIndex: 1, target: 'ル', emoji: '🐬', type: 'katakana' },
    { word: 'サル', blankIndex: 1, target: 'ル', emoji: '🐒', type: 'katakana' },
    { word: 'カエル', blankIndex: 2, target: 'ル', emoji: '🐸', type: 'katakana' },

    { word: 'レモン', blankIndex: 0, target: 'レ', emoji: '🍋', type: 'katakana' },
    { word: 'カレー', blankIndex: 1, target: 'レ', emoji: '🍛', type: 'katakana' },
    { word: 'クレヨン', blankIndex: 1, target: 'レ', emoji: '🖍️', type: 'katakana' },

    { word: 'ロボット', blankIndex: 0, target: 'ロ', emoji: '🤖', type: 'katakana' },
    { word: 'メロン', blankIndex: 1, target: 'ロ', emoji: '🍈', type: 'katakana' },
    { word: 'ロケット', blankIndex: 0, target: 'ロ', emoji: '🚀', type: 'katakana' },

    { word: 'ワニ', blankIndex: 0, target: 'ワ', emoji: '🐊', type: 'katakana' },
    { word: 'ユビワ', blankIndex: 2, target: 'ワ', emoji: '💍', type: 'katakana' },
    { word: 'ヒマワリ', blankIndex: 2, target: 'ワ', emoji: '🌻', type: 'katakana' },

    { word: 'キリン', blankIndex: 2, target: 'ン', emoji: '🦒', type: 'katakana' },
    { word: 'メロン', blankIndex: 2, target: 'ン', emoji: '🍈', type: 'katakana' },
    { word: 'パンダ', blankIndex: 1, target: 'ン', emoji: '🐼', type: 'katakana' }
  ];
})(window);
