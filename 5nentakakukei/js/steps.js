/**
 * steps.js
 * 小学5年算数「正多角形」スモールステップ定義・ツールボックス・解説データ
 */
window.TakakukeiApp = window.TakakukeiApp || {};

window.TakakukeiApp.STEPS = [
  {
    id: 1,
    shortName: '1. 線',
    title: 'ステップ1：ペンを下ろして、線をかこう',
    badge: 'ステップ 1',
    isSecret: false,
    forcePenOffStart: true, // ペンを下ろすブロックを必ず使う体験
    hasExplain: false,
    desc: '「ペンを下ろす」と「歩うごかす」をつなげて、長さ 100 の まっすぐな線を かこう！',
    hint: '左のリストから「ペンを下ろす」をおいて、その下に「100 歩うごかす」をパチンとつなげてみよう！',
    clearMessage: 'バッチリ！「ペンを下ろす」をつかうと、うごいたあとに 線がかけるんだね！',
    goalType: 'line',
    drawScale: 2.4,
    startPos: { x: 210, y: 330, angle: -90 },
    toolboxMode: 'step1',
    defaultXml: ''
  },
  {
    id: 2,
    shortName: '2. 角',
    title: 'ステップ2：曲がって「角（かど）」をかこう',
    badge: 'ステップ 2',
    isSecret: false,
    forcePenOffStart: false,
    hasExplain: false,
    desc: '「100 歩うごかす」→「右に 90 度まわす」→「100 歩うごかす」をつなげて、かどを かこう！',
    hint: 'すすんでから「右に 90 度まわす」をいれて、そのあともう一度「100 歩うごかす」をつなげてみよう。',
    clearMessage: '大せいこう！「まわす」ブロックをつかうと、むきをかえて まがることができるね！',
    goalType: 'corner',
    drawScale: 2.2,
    startPos: { x: 100, y: 320, angle: -90 },
    toolboxMode: 'step2',
    defaultXml: ''
  },
  {
    id: 3,
    shortName: '3. 四角形',
    title: 'ステップ3：1辺が 100 の 正方形をかこう',
    badge: 'ステップ 3',
    isSecret: false,
    forcePenOffStart: false,
    hasExplain: true,
    explainPromptOnEnter: false,
    desc: '1辺が 100 の 正方形を かこう！「4 回くりかえす」ブロックをつかうと 短くかけるよ！',
    hint: '正方形は 4回 すすんで、90度ずつ 右に まがるよ。「4 回くりかえす」の中に「100 歩うごかす」と「右に 90 度まわす」をいれてみよう！',
    clearMessage: 'すごい！正方形が かけたね！同じことのくりかえしは「くりかえす」をつかうと カンタンだね！',
    goalType: 'square',
    drawScale: 2.2,
    startPos: { x: 100, y: 320, angle: -90 },
    toolboxMode: 'full',
    defaultXml: ''
  },
  {
    id: 4,
    shortName: '4. 三角形',
    title: 'ステップ4：正三角形を デバッグしよう！',
    badge: 'ステップ 4',
    isSecret: false,
    forcePenOffStart: false,
    hasExplain: true,
    explainPromptOnEnter: true,
    desc: '今のプログラムは「60度」になっていて、うまくかけないよ（バグ）。「📖 かいせつ」を見て、ただしい角度に なおそう！',
    hint: 'キャラクターが「まっすぐすすむ方向」から 外回りに まわる角度を考えよう！ 180 − 60 ＝ ？（度）',
    clearMessage: 'やったね！デバッグ大せいこう！三角形の内側の 60度 ではなく、外回りの「120度」まわるのがポイントだね！',
    goalType: 'triangle',
    drawScale: 1.6,
    startPos: { x: 90, y: 315, angle: -90 },
    toolboxMode: 'full',
    // 教科書p.180のバグ体験用初期ブロック（3回くりかえす・100歩・右に60度）
    defaultXml: `
      <xml>
        <block type="custom_repeat" x="10" y="16">
          <value name="TIMES">
            <shadow type="math_number"><field name="NUM">3</field></shadow>
          </value>
          <statement name="DO">
            <block type="move_steps">
              <value name="STEPS">
                <shadow type="math_number"><field name="NUM">100</field></shadow>
              </value>
              <next>
                <block type="turn_degrees">
                  <field name="DIRECTION">RIGHT</field>
                  <value name="DEGREES">
                    <shadow type="math_number"><field name="NUM">60</field></shadow>
                  </value>
                </block>
              </next>
            </block>
          </statement>
        </block>
      </xml>
    `
  },
  {
    id: 5,
    shortName: '5. 五角形',
    title: 'ステップ5【ひみつ】：正五角形をかこう',
    badge: 'ひみつ 1',
    isSecret: true,
    unlockAfter: 4,
    forcePenOffStart: false,
    hasExplain: true,
    explainPromptOnEnter: false,
    desc: 'ひみつのステージへ ようこそ！きまり（360 ÷ 辺の数）をつかって、1辺が 100 の 正五角形を かこう！',
    hint: '1周ぐるっとまわると 360度！五角形は 5回まわるから、1回にまわる角度は「360 ÷ 5 ＝ ？度」かな？',
    clearMessage: 'お見事！正五角形が かけたね！「360 ÷ 辺の数」をつかえば、どんな正多角形でも かけるよ！',
    goalType: 'pentagon',
    drawScale: 1.75,
    startPos: { x: 80, y: 298, angle: -90 },
    toolboxMode: 'full',
    defaultXml: ''
  },
  {
    id: 6,
    shortName: '6. 星型',
    title: 'ステップ6【ひみつ】：星型（★）にちょうせん！',
    badge: 'ひみつ 2',
    isSecret: true,
    unlockAfter: 5,
    forcePenOffStart: false,
    hasExplain: true,
    explainPromptOnEnter: false,
    desc: 'さいごの チャレンジ！5回くりかえして、1辺が 100 の 星型（★）を かこう！何回まわるかな？',
    hint: '星のトゲの 内側の角は 36度。だから外回りに「180 − 36 ＝ 144度」ずつ、5回まわってみよう！（長さは 100 がおてほん通りだよ）',
    clearMessage: 'パーフェクト！！全ステップ完全制覇おめでとう！きみは 正多角形プログラミングマスターだ！！',
    goalType: 'star',
    drawScale: 2.5,
    startPos: { x: 85, y: 175, angle: 0 },
    toolboxMode: 'full',
    defaultXml: ''
  },
  {
    id: 7,
    shortName: 'じゆう',
    title: 'じゆうモード：いろいろな図形をかこう！',
    badge: 'じゆう',
    isSecret: false,
    isFree: true,
    forcePenOffStart: false,
    hasExplain: true,
    explainPromptOnEnter: false,
    desc: '正六角形（60度）や正八角形（45度）、辺の長さを短くした正二十角形（18度）など、自由に作ってみよう！',
    hint: 'はみだすときは、歩数を「50」や「30」に短くしてみよう。360 ÷ 辺の数 ＝ まわる角度 だよ！',
    clearMessage: '',
    goalType: 'free',
    drawScale: 1.5,
    startPos: { x: 210, y: 250, angle: -90 },
    toolboxMode: 'full',
    defaultXml: ''
  }
];

window.TakakukeiApp.getToolboxXml = function (mode, alwaysPenDown) {
  const penBlocks = alwaysPenDown ? '' : `
    <block type="pen_down"></block>
    <block type="pen_up"></block>
  `;

  if (mode === 'step1') {
    return `
      <xml id="toolbox">
        <block type="pen_down"></block>
        <block type="pen_up"></block>
        <block type="move_steps">
          <value name="STEPS">
            <shadow type="math_number"><field name="NUM">100</field></shadow>
          </value>
        </block>
        <block type="math_number"><field name="NUM">100</field></block>
      </xml>
    `;
  }

  if (mode === 'step2') {
    return `
      <xml id="toolbox">
        <block type="move_steps">
          <value name="STEPS">
            <shadow type="math_number"><field name="NUM">100</field></shadow>
          </value>
        </block>
        <block type="turn_degrees">
          <field name="DIRECTION">RIGHT</field>
        </block>
        ${penBlocks}
        <block type="math_number"><field name="NUM">10</field></block>
      </xml>
    `;
  }

  return `
    <xml id="toolbox">
      <block type="move_steps">
        <value name="STEPS">
          <shadow type="math_number"><field name="NUM">100</field></shadow>
        </value>
      </block>
      <block type="turn_degrees">
        <field name="DIRECTION">RIGHT</field>
      </block>
      ${penBlocks}
      <block type="custom_repeat">
        <value name="TIMES">
          <shadow type="math_number"><field name="NUM">4</field></shadow>
        </value>
      </block>
      <block type="math_number"><field name="NUM">10</field></block>
    </xml>
  `;
};
