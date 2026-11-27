// 年齢・立場別の用語＆ふりがな辞書
// レベル: 'elem_low' (しょうがく1〜3年), 'elem_high' (小学4〜6年), 'junior' (中学生), 'teacher' (先生・一般)

export const AGE_LEVELS = [
  { id: 'elem_low', label: 'しょうがく 1〜3ねん' },
  { id: 'elem_high', label: '小学生（4〜6年）' },
  { id: 'junior', label: '中学生' },
  { id: 'teacher', label: '先生・一般' }
];

const DICT = {
  app_title: {
    elem_low: 'ずけいノート',
    elem_high: '<ruby>図形<rt>ずけい</rt></ruby>ノート',
    junior: '図形ノート',
    teacher: '図形ノート'
  },
  undo: {
    elem_low: 'もどす',
    elem_high: 'もどす',
    junior: '元に戻す',
    teacher: '元に戻す'
  },
  redo: {
    elem_low: 'やりなおす',
    elem_high: 'やり<ruby>直<rt>なお</rt></ruby>す',
    junior: 'やり直す',
    teacher: 'やり直す'
  },
  clear: {
    elem_low: 'ぜんけし',
    elem_high: 'ぜんぶ<ruby>消<rt>け</rt></ruby>す',
    junior: '全消去',
    teacher: '全消去'
  },
  snap: {
    elem_low: 'スナップ',
    elem_high: '<ruby>スナップ<rt>すなっぷ</rt></ruby>',
    junior: 'スナップ',
    teacher: 'スナップ'
  },
  angles: {
    elem_low: 'かど',
    elem_high: '<ruby>角<rt>かく</rt></ruby>',
    junior: '角表示',
    teacher: '角表示'
  },
  scissors: {
    elem_low: 'はさみ',
    elem_high: 'はさみ',
    junior: '切断',
    teacher: '切断'
  },
  color: {
    elem_low: 'いろ',
    elem_high: '<ruby>色<rt>いろ</rt></ruby>',
    junior: '色',
    teacher: '色'
  },
  width: {
    elem_low: 'ふとさ',
    elem_high: '<ruby>太<rt>ふと</rt></ruby>さ',
    junior: '太さ',
    teacher: '線幅'
  },
  fill_label: {
    elem_low: 'なかをぬる',
    elem_high: '<ruby>中<rt>なか</rt></ruby>をぬる',
    junior: '塗りつぶし',
    teacher: '塗りつぶし'
  },
  dark_mode: {
    elem_low: 'ダーク',
    elem_high: 'ダーク',
    junior: 'ダーク',
    teacher: 'ダーク'
  },
  menu: {
    elem_low: 'せってい',
    elem_high: '<ruby>設定<rt>せってい</rt></ruby>・<ruby>保存<rt>ほぞん</rt></ruby>',
    junior: '設定・保存',
    teacher: 'メニュー'
  },
  fullscreen: {
    elem_low: 'おおきく',
    elem_high: '<ruby>全画面<rt>ぜんがめん</rt></ruby>',
    junior: '全画面',
    teacher: '全画面'
  },

  // 下部メインツール
  tool_select: {
    elem_low: 'えらぶ・うごかす',
    elem_high: '<ruby>選<rt>えら</rt></ruby>ぶ・<ruby>動<rt>うご</rt></ruby>かす',
    junior: '選択・移動',
    teacher: '選択・移動'
  },
  tool_pan: {
    elem_low: 'がめんをうごかす',
    elem_high: '<ruby>画面<rt>がめん</rt></ruby><ruby>移動<rt>いどう</rt></ruby>',
    junior: '画面移動',
    teacher: 'パン移動'
  },
  tool_point: {
    elem_low: 'てん',
    elem_high: '<ruby>点<rt>てん</rt></ruby>',
    junior: '点',
    teacher: '点'
  },
  tool_line: {
    elem_low: 'せん',
    elem_high: '<ruby>線<rt>せん</rt></ruby>',
    junior: '線',
    teacher: '線'
  },
  line_segment: {
    elem_low: 'まっすぐな せん',
    elem_high: '<ruby>直線<rt>ちょくせん</rt></ruby>',
    junior: '<ruby>線分<rt>せんぶん</rt></ruby>',
    teacher: '線分'
  },
  line_freehand: {
    elem_low: 'じゆうに かく',
    elem_high: '<ruby>自由<rt>じゆう</rt></ruby>な<ruby>線<rt>せん</rt></ruby>',
    junior: 'フリーハンド',
    teacher: '自由線'
  },
  line_arrow: {
    elem_low: 'やじるし',
    elem_high: '<ruby>矢印<rt>やじるし</rt></ruby>',
    junior: '矢印',
    teacher: '矢印'
  },
  tool_triangle: {
    elem_low: 'さんかく',
    elem_high: '<ruby>三角形<rt>さんかくけい</rt></ruby>',
    junior: '三角形',
    teacher: '三角形'
  },
  tri_general: {
    elem_low: 'ふつうの さんかく',
    elem_high: '<ruby>一般<rt>いっぱん</rt></ruby>の<ruby>三角形<rt>さんかくけい</rt></ruby>',
    junior: '一般三角形',
    teacher: '一般三角形'
  },
  tri_isosceles: {
    elem_low: 'にとうへん さんかく',
    elem_high: '<ruby>二等辺<rt>にとうへん</rt></ruby><ruby>三角形<rt>さんかくけい</rt></ruby>',
    junior: '二等辺三角形',
    teacher: '二等辺三角形'
  },
  tri_equilateral: {
    elem_low: 'せい さんかくけい',
    elem_high: '<ruby>正三角形<rt>せいさんかくけい</rt></ruby>',
    junior: '正三角形',
    teacher: '正三角形'
  },
  tri_right: {
    elem_low: 'ちょっかく さんかく',
    elem_high: '<ruby>直角<rt>ちょっかく</rt></ruby><ruby>三角形<rt>さんかくけい</rt></ruby>',
    junior: '直角三角形',
    teacher: '直角三角形'
  },
  tool_quad: {
    elem_low: 'しかく',
    elem_high: '<ruby>四角形<rt>しかくけい</rt></ruby>',
    junior: '四角形',
    teacher: '四角形'
  },
  quad_square: {
    elem_low: 'せいほうけい（ましかく）',
    elem_high: '<ruby>正方形<rt>せいほうけい</rt></ruby>',
    junior: '正方形',
    teacher: '正方形'
  },
  quad_rect: {
    elem_low: 'ちょうほうけい（ながしかく）',
    elem_high: '<ruby>長方形<rt>ちょうほうけい</rt></ruby>',
    junior: '長方形',
    teacher: '長方形'
  },
  quad_para: {
    elem_low: 'へいこうしへんけい',
    elem_high: '<ruby>平行四辺形<rt>へいこうしへんけい</rt></ruby>',
    junior: '平行四辺形',
    teacher: '平行四辺形'
  },
  quad_trap: {
    elem_low: 'だいけい',
    elem_high: '<ruby>台形<rt>だいけい</rt></ruby>',
    junior: '台形',
    teacher: '台形'
  },
  quad_rhombus: {
    elem_low: 'ひしがた',
    elem_high: 'ひし<ruby>形<rt>がた</rt></ruby>',
    junior: 'ひし形',
    teacher: 'ひし形'
  },
  tool_poly: {
    elem_low: 'たかっけい',
    elem_high: '<ruby>正多角形<rt>せいたかっけい</rt></ruby>',
    junior: '正多角形',
    teacher: '正多角形'
  },
  poly_pentagon: {
    elem_low: 'せい ごかっけい',
    elem_high: '<ruby>正五角形<rt>せいごかっけい</rt></ruby>',
    junior: '正五角形',
    teacher: '正五角形'
  },
  poly_hexagon: {
    elem_low: 'せい ろっかっけい',
    elem_high: '<ruby>正六角形<rt>せいろっかっけい</rt></ruby>',
    junior: '正六角形',
    teacher: '正六角形'
  },
  poly_octagon: {
    elem_low: 'せい はっかっけい',
    elem_high: '<ruby>正八角形<rt>せいはっかっけい</rt></ruby>',
    junior: '正八角形',
    teacher: '正八角形'
  },
  tool_circle: {
    elem_low: 'えん',
    elem_high: '<ruby>円<rt>えん</rt></ruby>',
    junior: '円',
    teacher: '円'
  },
  circle_regular: {
    elem_low: 'せいえん（まる）',
    elem_high: '<ruby>正円<rt>せいえん</rt></ruby>',
    junior: '正円',
    teacher: '正円'
  },
  circle_ellipse: {
    elem_low: 'だえん（つぶれたまる）',
    elem_high: '<ruby>楕円<rt>だえん</rt></ruby>',
    junior: '<ruby>楕円<rt>だえん</rt></ruby>',
    teacher: '楕円'
  },
  tool_compass: {
    elem_low: 'コンパス',
    elem_high: 'コンパス',
    junior: 'コンパス',
    teacher: 'コンパス'
  },
  tool_eraser: {
    elem_low: 'けしごむ',
    elem_high: '<ruby>消<rt>け</rt></ruby>しゴム',
    junior: '消しゴム',
    teacher: '消去'
  },

  // 長押し変形メニュー
  tf_title: {
    elem_low: 'ちょうてんを ドラッグして かえよう！',
    elem_high: '<ruby>頂点<rt>ちょうてん</rt></ruby>をドラッグして<ruby>変<rt>か</rt></ruby>えよう',
    junior: '頂点をドラッグして変形',
    teacher: '頂点ドラッグで変形'
  },
  tf_both: {
    elem_low: 'かいてん＆おおきさ',
    elem_high: '<ruby>回転<rt>かいてん</rt></ruby>＆<ruby>拡大縮小<rt>かくだいしゅくしょう</rt></ruby>',
    junior: '回転・拡大縮小',
    teacher: '回転＋拡大縮小'
  },
  tf_rotate: {
    elem_low: 'かいてん（まわす）',
    elem_high: '<ruby>回転<rt>かいてん</rt></ruby>だけ',
    junior: '回転のみ',
    teacher: '回転'
  },
  tf_scale: {
    elem_low: 'おおきく・ちいさく',
    elem_high: '<ruby>拡大<rt>かくだい</rt></ruby>・<ruby>縮小<rt>しゅくしょう</rt></ruby>',
    junior: '拡大・縮小のみ',
    teacher: '拡大・縮小'
  },
  tf_vertex: {
    elem_low: 'かたちをかえる',
    elem_high: '<ruby>頂点<rt>ちょうてん</rt></ruby>をうごかす',
    junior: '頂点編集',
    teacher: '頂点編集'
  },
  tf_clone: {
    elem_low: 'ふやす',
    elem_high: '<ruby>複製<rt>ふくせい</rt></ruby>',
    junior: '複製',
    teacher: '複製'
  },
  tf_flip: {
    elem_low: 'うらがえす',
    elem_high: '<ruby>裏返<rt>うらがえ</rt></ruby>す',
    junior: '反転',
    teacher: '反転'
  },
  tf_delete: {
    elem_low: 'けす',
    elem_high: '<ruby>消<rt>け</rt></ruby>す',
    junior: '削除',
    teacher: '削除'
  },
  tf_done: {
    elem_low: 'おわり',
    elem_high: '<ruby>完了<rt>かんりょう</rt></ruby>',
    junior: '完了',
    teacher: '完了'
  },

  // 設定・保存メニュー
  menu_age: {
    elem_low: 'ことばの むずかしさ',
    elem_high: '<ruby>学年<rt>がくねん</rt></ruby>・ことば',
    junior: '表示用語のレベル',
    teacher: '用語・ふりがな設定'
  },
  menu_save_json: {
    elem_low: 'JSONで ほぞん',
    elem_high: 'JSONで<ruby>保存<rt>ほぞん</rt></ruby>',
    junior: 'JSON保存',
    teacher: 'JSON保存'
  },
  menu_load_json: {
    elem_low: 'JSONを よみこむ',
    elem_high: 'JSONを<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>む',
    junior: 'JSON読込',
    teacher: 'JSON読込'
  },
  menu_save_zip: {
    elem_low: 'ZIP（がぞうもいっしょ）で ほぞん',
    elem_high: 'ZIPで<ruby>保存<rt>ほぞん</rt></ruby>（<ruby>画像<rt>がぞう</rt></ruby>こみ）',
    junior: 'ZIP保存（画像含む）',
    teacher: 'ZIPパッケージ保存'
  },
  menu_load_zip: {
    elem_low: 'ZIPを よみこむ',
    elem_high: 'ZIPを<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>む',
    junior: 'ZIP読込',
    teacher: 'ZIP読込'
  },
  menu_load_image: {
    elem_low: 'しゃしん・がぞうを おく',
    elem_high: '<ruby>背景画像<rt>はいけいがぞう</rt></ruby>を<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>む',
    junior: '背景画像を読込',
    teacher: '背景画像を重ねる'
  },
  menu_clear_image: {
    elem_low: 'がぞうを はずす',
    elem_high: '<ruby>背景画像<rt>はいけいがぞう</rt></ruby>を<ruby>消<rt>け</rt></ruby>す',
    junior: '背景画像を削除',
    teacher: '背景画像削除'
  },
  menu_manual: {
    elem_low: 'つかいかた（マニュアル）',
    elem_high: '<ruby>使<rt>つか</rt></ruby>いかた（マニュアル）',
    junior: 'オンラインマニュアル',
    teacher: 'オンラインマニュアル'
  },

  // 状態ガイド / トースト
  hint_place: {
    elem_low: 'ほうがんの おきたい ところを タップしてね',
    elem_high: '<ruby>方眼<rt>ほうがん</rt></ruby>の<ruby>上<rt>うえ</rt></ruby>をタップして<ruby>置<rt>お</rt></ruby>こう',
    junior: '方眼紙上をタップして配置してください',
    teacher: '方眼上をタップして配置'
  },
  hint_line: {
    elem_low: 'ゆびで ドラッグして せんを かこう',
    elem_high: 'ドラッグして<ruby>線<rt>せん</rt></ruby>をかこう',
    junior: 'ドラッグで線を描画',
    teacher: 'ドラッグで線分・線を描画'
  },
  hint_compass: {
    elem_low: '1ぽんめの ゆびで はりをおさえたまま、2ほんめの ゆびで くるっと かこう！（PCは クリックしてから ドラッグ）',
    elem_high: '1本目で<ruby>支点<rt>してん</rt></ruby>をおさえたまま、2本目のゆびをドラッグして<ruby>円弧<rt>えんこ</rt></ruby>をかこう！（マウスはクリック後にドラッグ）',
    junior: '1点目で支点を押さえたまま、2点目をドラッグして円弧を描きます（マウスはクリックで支点固定後にドラッグ）',
    teacher: '二点タッチ（1点目支点ホールド＋2点目ドラッグ）またはクリック固定後ドラッグで円弧を描画'
  },
  hint_scissors: {
    elem_low: 'ずけいを よこぎるように ドラッグすると きれるよ！',
    elem_high: '<ruby>図形<rt>ずけい</rt></ruby>を<ruby>横切<rt>よこぎ</rt></ruby>るようにドラッグすると<ruby>切<rt>き</rt></ruby>れるよ',
    junior: '図形を横切るようにドラッグして切断します',
    teacher: '図形を横断ドラッグして切断'
  },
  hint_select: {
    elem_low: 'ずけいを ドラッグで いどう。ながおしで かいてん・おおきさ！',
    elem_high: 'ドラッグで<ruby>移動<rt>いどう</rt></ruby>、<ruby>長押<rt>ながお</rt></ruby>しで<ruby>回転<rt>かいてん</rt></ruby>・<ruby>拡大縮小<rt>かくだいしゅくしょう</rt></ruby>！',
    junior: 'ドラッグで移動、長押しで回転・拡大縮小ができます',
    teacher: 'ドラッグで移動 / 長押しで回転・拡大縮小 / 空白ドラッグで画面移動'
  },
  portrait_title: {
    elem_low: 'がめんを よこむきに してね！',
    elem_high: '<ruby>画面<rt>がめん</rt></ruby>を<ruby>横向<rt>よこむ</rt></ruby>きにしてね！',
    junior: '画面を横向きにしてください',
    teacher: '横向き（ランドスケープ）でご利用ください'
  },
  portrait_desc: {
    elem_low: 'このアプリは よこむきで つかうよ。タブレットや スマホを よこに たおしてね。',
    elem_high: 'このノートは<ruby>横向<rt>よこむ</rt></ruby>き<ruby>専用<rt>せんよう</rt></ruby>です。タブレットやパソコンの<ruby>画面<rt>がめん</rt></ruby>を<ruby>横長<rt>よこなが</rt></ruby>にしてください。',
    junior: 'このアプリは横向き専用です。端末を横向きにするか、ウィンドウを横長に広げてください。',
    teacher: '端末を横向き（ランドスケープ）にするか、ブラウザウィンドウを横長にしてご使用ください。'
  },
  confirm_clear: {
    elem_low: 'かいたものを ぜんぶ けしても いいですか？',
    elem_high: 'かいた<ruby>図形<rt>ずけい</rt></ruby>や<ruby>線<rt>せん</rt></ruby>を すべて<ruby>消<rt>け</rt></ruby>しますか？',
    junior: '描いた図形や線をすべて消去しますか？',
    teacher: 'キャンバス上の全要素を消去しますか？'
  },
  bg_opacity: {
    elem_low: 'しゃしんの こさ',
    elem_high: '<ruby>画像<rt>がぞう</rt></ruby>のこさ',
    junior: '画像の濃さ',
    teacher: '背景不透明度'
  },
  bg_scale: {
    elem_low: 'しゃしんの おおきさ',
    elem_high: '<ruby>画像<rt>がぞう</rt></ruby>のおおきさ',
    junior: '画像サイズ',
    teacher: '背景倍率'
  },
  hide_ui: {
    elem_low: 'かくす',
    elem_high: 'かくす',
    junior: '非表示',
    teacher: '発表'
  },
  show_ui: {
    elem_low: 'もどす',
    elem_high: 'もどす',
    junior: '表示',
    teacher: '表示'
  },
  menu_loupe: {
    elem_low: 'むしめがね（かくだい）',
    elem_high: '<ruby>虫眼鏡<rt>むしめがね</rt></ruby>（ドラッグ<ruby>拡大<rt>かくだい</rt></ruby>）',
    junior: '虫眼鏡（拡大ルーペ）',
    teacher: 'ドラッグ拡大ルーペ'
  },
  loupe_auto: {
    elem_low: 'じどう（おすすめ）',
    elem_high: '<ruby>自動<rt>じどう</rt></ruby>（おすすめ）',
    junior: '自動（点・頂点・線など）',
    teacher: '自動（精密操作時）'
  },
  loupe_always: {
    elem_low: 'いつも つかう',
    elem_high: 'いつも<ruby>使<rt>つか</rt></ruby>う',
    junior: '常時オン',
    teacher: '常に表示'
  },
  loupe_off: {
    elem_low: 'つかわない',
    elem_high: '<ruby>使<rt>つか</rt></ruby>わない',
    junior: 'オフ',
    teacher: 'オフ'
  },
  menu_dock: {
    elem_low: 'ツールバーの ばしょ',
    elem_high: 'ツールバーの<ruby>位置<rt>いち</rt></ruby>',
    junior: 'ツールバーの位置',
    teacher: 'ツールバー配置'
  },
  dock_bottom: {
    elem_low: 'した',
    elem_high: '<ruby>下<rt>した</rt></ruby>',
    junior: '下',
    teacher: '下'
  },
  dock_left: {
    elem_low: 'ひだり',
    elem_high: '<ruby>左<rt>ひだり</rt></ruby>',
    junior: '左',
    teacher: '左'
  },
  dock_right: {
    elem_low: 'みぎ',
    elem_high: '<ruby>右<rt>みぎ</rt></ruby>',
    junior: '右',
    teacher: '右'
  },
  menu_show_hint: {
    elem_low: 'ガイドを ひょうじ',
    elem_high: 'ガイドを<ruby>表示<rt>ひょうじ</rt></ruby>',
    junior: '操作ガイド表示',
    teacher: '操作ガイド表示'
  },
  multi_group: {
    elem_low: 'グループにする',
    elem_high: 'グループ<ruby>化<rt>か</rt></ruby>',
    junior: 'グループ化',
    teacher: 'グループ化'
  },
  multi_ungroup: {
    elem_low: 'グループを ほどく',
    elem_high: 'グループ<ruby>解除<rt>かいじょ</rt></ruby>',
    junior: 'グループ解除',
    teacher: 'グループ解除'
  },
  multi_add: {
    elem_low: 'ついかで えらぶ',
    elem_high: '<ruby>追加<rt>ついか</rt></ruby><ruby>選択<rt>せんたく</rt></ruby>',
    junior: '追加選択',
    teacher: '連続選択'
  },
  multi_delete: {
    elem_low: 'まとめて けす',
    elem_high: 'まとめて<ruby>消<rt>け</rt></ruby>す',
    junior: '一括削除',
    teacher: '一括削除'
  },
  multi_clear: {
    elem_low: 'かいじょ',
    elem_high: '<ruby>解除<rt>かいじょ</rt></ruby>',
    junior: '解除',
    teacher: '解除'
  }
};

export function t(key, level = 'elem_high') {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[level] || entry.elem_high || entry.teacher || key;
}

export function tPlain(key, level = 'elem_high') {
  const html = t(key, level);
  return html.replace(/<rt>.*?<\/rt>/g, '').replace(/<\/?ruby>/g, '');
}

export function applyI18nToDOM(root, level) {
  const nodes = root.querySelectorAll('[data-i18n]');
  nodes.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key, level);
  });
}
