/**
 * てがき けいさんカード — Main Application Controller (v0.5.0)
 * Supports:
 *   - Addition & Subtraction (Saiki City Sugoroku)
 *   - Multiplication (Tables 2..9 & Mix, Oita Prefecture Sugoroku)
 *   - Division (Exact, Remainder, Mix, Kyushu-Okinawa Sugoroku)
 *   - Japan 47-Prefecture Calculation Tour (unlocked upon Kyushu-Okinawa Goal)
 *   - Interactive Hints for all 4 operations, 5-tap JSON backup/restore
 */
(function (global) {
  "use strict";

  const ANIMALS = ["🐶", "🐱", "🐰", "🐻", "🐼", "🐨", "🦊", "🐯", "🦁", "🦄"];

  const BOARD_LAYOUT_11 = [
    { col: "1", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "2", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "3", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "4", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "5", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "6", row: "1", arrowDir: "down", arrowText: "⬇" },
    { col: "6", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "5", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "4", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "3", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "1 / span 2", row: "2", arrowDir: null, arrowText: "" },
  ];

  const BOARD_LAYOUT_10 = [
    { col: "1", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "2", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "3", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "4", row: "1", arrowDir: "right", arrowText: "➔" },
    { col: "5", row: "1", arrowDir: "down", arrowText: "⬇" },
    { col: "5", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "4", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "3", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "2", row: "2", arrowDir: "left", arrowText: "⬅" },
    { col: "1", row: "2", arrowDir: null, arrowText: "" },
  ];

  const JAPAN_OP_META = {
    add: { title: "➕ たしざん県！", desc: "たしざん 10もん（あり・なしまぜまぜ）に ちょうせん！" },
    sub: { title: "➖ ひきざん県！", desc: "ひきざん 10もん（あり・なしまぜまぜ）に ちょうせん！" },
    mul: { title: "✖️ かけざん県！", desc: "九九 ぜんぶばらばら 10もんに ちょうせん！" },
    div_exact: { title: "➗ わりざん県（あまりなし）！", desc: "わりきれる わりざん 10もんに ちょうせん！" },
    div_rem: { title: "➗ わりざん県（あまりあり）！", desc: "あまりのある わりざん 10もんに ちょうせん！" },
  };

  const state = {
    selectedMode: "add",       // 'add' | 'sub' | 'mul' | 'div'
    selectedRegroup: "mix",    // 'none' | 'only' | 'mix'
    selectedSubLevel: "lv1",   // 'lv1' | 'lv2' | 'lv3'

    mulTopTab: 2,
    mulKind: "table",
    mulTable: 2,
    mulOrder: "asc",
    mulCustomTables: [2, 3, 4],

    selectedDivKind: "mix",    // 'exact' | 'rem' | 'mix'

    activeMulKind: "table",
    activeMulCourseKey: "",
    activeMulTablesLabel: "",
    activeDivKind: "mix",

    // 日本一周チャレンジ中の都道府県情報
    japanChallenge: null,      // null | { pref, assignedType }
    modalPrefTarget: null,

    isRetryOnlySession: false,
    currentScreen: "start",
    mapReturnScreen: "start",
    justArrivedOnResult: false,

    deck: [],
    currentIndex: 0,
    streak: 0,
    maxCombo: 0,
    records: [],
    cardStartTime: 0,
    isTransitioning: false,
    demoIndex: 0,

    currentAttempts: 0,
    currentFirstAnswer: null,
    currentUsedHint: false,
    hintOpen: false,
    hintLeft: [],
    hintRight: [],
    mulLitRows: 0,
    divGroupsLit: 0,
  };

  let padTens = null;
  let padOnes = null;
  let wrongStampTimer = null;

  let brandTapCount = 0;
  let brandTapResetTimer = null;
  let resetConfirmArmed = false;
  let resetArmTimer = null;

  const els = {};

  function cacheDom() {
    els.portraitLock = document.getElementById("portrait-lock");
    els.brandTapTarget = document.getElementById("brand-tap-target");
    els.modePill = document.getElementById("mode-pill");
    els.progressDots = document.getElementById("progress-dots");
    els.btnOpenJapan = document.getElementById("btn-open-japan");
    els.topJapanLabel = document.getElementById("top-japan-label");
    els.btnOpenMap = document.getElementById("btn-open-map");
    els.topMapLabel = document.getElementById("top-map-label");
    els.btnSound = document.getElementById("btn-sound");
    els.soundIcon = document.getElementById("sound-icon");
    els.soundLabel = document.getElementById("sound-label");
    els.btnHome = document.getElementById("btn-home");

    els.screenStart = document.getElementById("screen-start");
    els.screenQuiz = document.getElementById("screen-quiz");
    els.screenResult = document.getElementById("screen-result");
    els.screenMap = document.getElementById("screen-map");
    els.screenJapan = document.getElementById("screen-japan");

    els.demoCardBtn = document.getElementById("demo-card-btn");
    els.demoRing = document.getElementById("demo-ring");
    els.demoEquation = document.getElementById("demo-equation");
    els.btnModeAdd = document.getElementById("btn-mode-add");
    els.btnModeSub = document.getElementById("btn-mode-sub");
    els.btnModeMul = document.getElementById("btn-mode-mul");
    els.btnModeDiv = document.getElementById("btn-mode-div");
    els.regroupRow = document.getElementById("regroup-row");
    els.btnRegroupNone = document.getElementById("btn-regroup-none");
    els.btnRegroupOnly = document.getElementById("btn-regroup-only");
    els.btnRegroupMix = document.getElementById("btn-regroup-mix");
    els.labelRegroupNone = document.getElementById("label-regroup-none");
    els.labelRegroupOnly = document.getElementById("label-regroup-only");
    els.exRegroupNone = document.getElementById("ex-regroup-none");
    els.exRegroupOnly = document.getElementById("ex-regroup-only");
    els.exRegroupMix = document.getElementById("ex-regroup-mix");
    els.sublevelRow = document.getElementById("sublevel-row");
    els.btnSubLv1 = document.getElementById("btn-sub-lv1");
    els.btnSubLv2 = document.getElementById("btn-sub-lv2");
    els.btnSubLv3 = document.getElementById("btn-sub-lv3");

    els.mulSummaryBox = document.getElementById("mul-summary-box");
    els.mulSummaryCourse = document.getElementById("mul-summary-course");
    els.mulSummaryBadges = document.getElementById("mul-summary-badges");
    els.btnOpenMulModal = document.getElementById("btn-open-mul-modal");

    els.divOptionsWrap = document.getElementById("div-options-wrap");
    els.btnDivExact = document.getElementById("btn-div-exact");
    els.btnDivRem = document.getElementById("btn-div-rem");
    els.btnDivMix = document.getElementById("btn-div-mix");
    els.stampDivExact = document.getElementById("stamp-div-exact");
    els.stampDivRem = document.getElementById("stamp-div-rem");
    els.stampDivMix = document.getElementById("stamp-div-mix");
    els.divMasterBar = document.getElementById("div-master-bar");

    els.btnStartMapPreview = document.getElementById("btn-start-map-preview");
    els.startMapTitle = document.getElementById("start-map-title");
    els.startLapBadge = document.getElementById("start-lap-badge");
    els.startMiniTrack = document.getElementById("start-mini-track");
    els.startMiniStatus = document.getElementById("start-mini-status");
    els.secretUnlockHint = document.getElementById("secret-unlock-hint");
    els.btnStartJapan = document.getElementById("btn-start-japan");
    els.btnStartJapanLabel = document.getElementById("btn-start-japan-label");
    els.btnStart = document.getElementById("btn-start");

    els.questionCounter = document.getElementById("question-counter");
    els.streakBadge = document.getElementById("streak-badge");
    els.quizRing = document.getElementById("quiz-ring");
    els.activeCard = document.getElementById("active-card");
    els.cardUnder1 = document.getElementById("card-under-1");
    els.cardUnder2 = document.getElementById("card-under-2");
    els.cardNumTag = document.getElementById("card-num-tag");
    els.cardEquation = document.getElementById("card-equation");
    els.cardStamp = document.getElementById("card-stamp");
    els.stampMark = document.getElementById("stamp-mark");
    els.stampText = document.getElementById("stamp-text");

    els.hintTriggerRow = document.getElementById("hint-trigger-row");
    els.btnShowHint = document.getElementById("btn-show-hint");
    els.hintBoard = document.getElementById("hint-board");
    els.hintBoardTitle = document.getElementById("hint-board-title");
    els.btnCloseHint = document.getElementById("btn-close-hint");
    els.hintInstruction = document.getElementById("hint-instruction");
    els.tenFramesRow = document.getElementById("ten-frames-row");
    els.tenWrapLeft = document.getElementById("ten-wrap-left");
    els.tenWrapRight = document.getElementById("ten-wrap-right");
    els.tenFrameOp = document.getElementById("ten-frame-op");
    els.tenFrameLeft = document.getElementById("ten-frame-left");
    els.tenFrameRight = document.getElementById("ten-frame-right");
    els.tenCountLeft = document.getElementById("ten-count-left");
    els.tenCountRight = document.getElementById("ten-count-right");

    els.mulHintArea = document.getElementById("mul-hint-area");
    els.mulArrayGrid = document.getElementById("mul-array-grid");
    els.btnMulStep = document.getElementById("btn-mul-step");
    els.btnMulResetHint = document.getElementById("btn-mul-reset-hint");

    els.divHintArea = document.getElementById("div-hint-area");
    els.divDotsStage = document.getElementById("div-dots-stage");
    els.btnDivStep = document.getElementById("btn-div-step");
    els.btnDivResetHint = document.getElementById("btn-div-reset-hint");

    els.celebrationZone = document.getElementById("celebration-zone");
    els.comboStage = document.getElementById("combo-stage");
    els.animalParade = document.getElementById("animal-parade");

    els.helperBanner = document.getElementById("helper-banner");
    els.answerBoard = document.getElementById("answer-board");
    els.bubbleTens = document.getElementById("bubble-tens");
    els.bubbleOnes = document.getElementById("bubble-ones");
    els.canvasTens = document.getElementById("canvas-tens");
    els.canvasOnes = document.getElementById("canvas-ones");
    els.watermarkLeft = document.getElementById("watermark-left");
    els.watermarkRight = document.getElementById("watermark-right");
    els.labelSlotLeft = document.getElementById("label-slot-left");
    els.labelSlotRight = document.getElementById("label-slot-right");
    els.divRemSeparator = document.getElementById("div-rem-separator");
    els.btnClearTens = document.getElementById("btn-clear-tens");
    els.btnClearOnes = document.getElementById("btn-clear-ones");
    els.btnSubmit = document.getElementById("btn-submit");
    els.btnClearAll = document.getElementById("btn-clear-all");

    els.confettiLayer = document.getElementById("confetti-layer");
    els.perfectFrameTop = document.getElementById("perfect-frame-top");
    els.perfectFrameBottom = document.getElementById("perfect-frame-bottom");
    els.resultBadge = document.getElementById("result-badge");
    els.resultScoreNum = document.getElementById("result-score-num");
    els.resultScoreDenom = document.getElementById("result-score-denom");
    els.resultHeadline = document.getElementById("result-headline");
    els.statMaxCombo = document.getElementById("stat-max-combo");
    els.statAvgSec = document.getElementById("stat-avg-sec");
    els.btnResultMap = document.getElementById("btn-result-map");
    els.resultSugorokuText = document.getElementById("result-sugoroku-text");
    els.resultMulAward = document.getElementById("result-mul-award");
    els.resultAdvice = document.getElementById("result-advice");
    els.carryBreakdown = document.getElementById("carry-breakdown");
    els.resultListTitle = document.getElementById("result-list-title");
    els.resultTbody = document.getElementById("result-tbody");
    els.btnRetryAll = document.getElementById("btn-retry-all");
    els.btnRetryAllLabel = document.getElementById("btn-retry-all-label");
    els.btnRetryWrong = document.getElementById("btn-retry-wrong");
    els.btnResultPickMul = document.getElementById("btn-result-pick-mul");
    els.btnResultToJapan = document.getElementById("btn-result-to-japan");

    els.mapScreenShell = document.getElementById("map-screen-shell");
    els.mapScreenTitle = document.getElementById("map-screen-title");
    els.btnMapBack = document.getElementById("btn-map-back");
    els.btnMapPlay = document.getElementById("btn-map-play");
    els.sugorokuBoard = document.getElementById("sugoroku-board");
    els.mapStatsPill = document.getElementById("map-stats-pill");
    els.mapFutureNote = document.getElementById("map-future-note");

    els.japanProgressPill = document.getElementById("japan-progress-pill");
    els.btnJapanBack = document.getElementById("btn-japan-back");
    els.japanTileGrid = document.getElementById("japan-tile-grid");

    els.modalMul = document.getElementById("modal-mul");
    els.btnCloseMul = document.getElementById("btn-close-mul");
    els.mulMasterCounter = document.getElementById("mul-master-counter");
    els.mulTablesGrid = document.getElementById("mul-tables-grid");
    els.mulSubpanelTitle = document.getElementById("mul-subpanel-title");
    els.mulOrderRow = document.getElementById("mul-order-row");
    els.mulMixGrid = document.getElementById("mul-mix-grid");
    els.mulCustomPicker = document.getElementById("mul-custom-picker");
    els.mulPickerPrompt = document.getElementById("mul-picker-prompt");
    els.mulPickerPills = document.getElementById("mul-picker-pills");
    els.mulSelectedPreview = document.getElementById("mul-selected-preview");
    els.btnMulStart = document.getElementById("btn-mul-start");

    els.modalPref = document.getElementById("modal-pref");
    els.btnClosePref = document.getElementById("btn-close-pref");
    els.prefRegionPill = document.getElementById("pref-region-pill");
    els.prefModalName = document.getElementById("pref-modal-name");
    els.prefSvgPath = document.getElementById("pref-svg-path");
    els.prefOpAnnounce = document.getElementById("pref-op-announce");
    els.prefOpDesc = document.getElementById("pref-op-desc");
    els.prefStatusBadge = document.getElementById("pref-status-badge");
    els.btnPrefStart = document.getElementById("btn-pref-start");

    els.modalTransfer = document.getElementById("modal-transfer");
    els.btnCloseTransfer = document.getElementById("btn-close-transfer");
    els.transferSummary = document.getElementById("transfer-summary");
    els.btnExportJson = document.getElementById("btn-export-json");
    els.importJsonInput = document.getElementById("import-json-input");
    els.btnResetData = document.getElementById("btn-reset-data");
    els.resetBtnLabel = document.getElementById("reset-btn-label");
    els.transferStatus = document.getElementById("transfer-status");
  }

  /* ========================================================================
     iPad Safari 誤操作防止 & 高信頼タップバインド
     ======================================================================== */
  function installSafariGuards() {
    ["gesturestart", "gesturechange", "gestureend"].forEach(function (name) {
      document.addEventListener(
        name,
        function (e) {
          e.preventDefault();
        },
        { passive: false }
      );
    });

    document.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
      },
      { passive: false }
    );

    document.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  function bindReliableTap(btn, handler) {
    if (!btn) return;
    let activePointerId = null;
    let activeTouch = false;
    let lastGestureAt = 0;

    function isInsideButton(clientX, clientY) {
      const rect = btn.getBoundingClientRect();
      if (!rect.width && !rect.height) return false;
      const pad = 16;
      return (
        clientX >= rect.left - pad &&
        clientX <= rect.right + pad &&
        clientY >= rect.top - pad &&
        clientY <= rect.bottom + pad
      );
    }

    btn.addEventListener("pointerdown", function (e) {
      if (btn.disabled) return;
      activePointerId = e.pointerId;
    });

    document.addEventListener("pointerup", function (e) {
      if (activePointerId === null || e.pointerId !== activePointerId) return;
      activePointerId = null;
      activeTouch = false;
      if (btn.disabled) return;

      if (isInsideButton(e.clientX, e.clientY)) {
        lastGestureAt = Date.now();
        handler(e);
      }
    });

    document.addEventListener("pointercancel", function (e) {
      if (e.pointerId === activePointerId) {
        activePointerId = null;
      }
    });

    btn.addEventListener(
      "touchstart",
      function (e) {
        if (btn.disabled) return;
        if (e.touches && e.touches.length === 1) {
          activeTouch = true;
        }
      },
      { passive: true }
    );

    btn.addEventListener(
      "touchend",
      function (e) {
        if (!activeTouch) return;
        activeTouch = false;
        activePointerId = null;
        if (btn.disabled) return;

        const t = e.changedTouches && e.changedTouches[0];
        if (!t || isInsideButton(t.clientX, t.clientY)) {
          lastGestureAt = Date.now();
          handler(e);
        }
      },
      { passive: true }
    );

    btn.addEventListener(
      "touchcancel",
      function () {
        activeTouch = false;
      },
      { passive: true }
    );

    btn.addEventListener("click", function (e) {
      if (Date.now() - lastGestureAt < 400) return;
      if (btn.disabled) return;
      handler(e);
    });
  }

  function updateOrientationLock() {
    const isPortrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle("is-portrait", isPortrait);
    if (els.portraitLock) {
      els.portraitLock.setAttribute("aria-hidden", String(!isPortrait));
    }
  }

  /* ========================================================================
     かけざんコース定義・ラベル・バッジヘルパー
     ======================================================================== */
  function getMulCourseKey(kind, table, order) {
    if (kind === "table") return "t_" + table + "_" + order;
    if (kind === "low") return "mix_low";
    if (kind === "high") return "mix_high";
    if (kind === "pick3_auto") return "mix_pick3_auto";
    if (kind === "pick3_user") return "mix_pick3_user";
    if (kind === "pick5_auto") return "mix_pick5_auto";
    if (kind === "pick5_user") return "mix_pick5_user";
    return "mix_all";
  }

  function getMulCourseLabel() {
    if (state.mulKind === "table") {
      const orderText =
        state.mulOrder === "asc"
          ? "じゅんばん"
          : state.mulOrder === "desc"
            ? "ぎゃく"
            : "ばらばら";
      return state.mulTable + "のだん・" + orderText + "（9もん）";
    }
    if (state.mulKind === "low") return "2〜5のだん ばらばら（10もん）";
    if (state.mulKind === "high") return "6〜9のだん ばらばら（10もん）";
    if (state.mulKind === "pick3_auto") return "おまかせ 3つのだん（10もん）";
    if (state.mulKind === "pick3_user") {
      return state.mulCustomTables.length === 3
        ? "えらんだ 3つのだん [" + state.mulCustomTables.join("・") + "]（10もん）"
        : "じぶんでえらぶ 3つのだん（3つえらんでね）";
    }
    if (state.mulKind === "pick5_auto") return "おまかせ 5つのだん（10もん）";
    if (state.mulKind === "pick5_user") {
      return state.mulCustomTables.length === 5
        ? "えらんだ 5つのだん [" + state.mulCustomTables.join("・") + "]（10もん）"
        : "じぶんでえらぶ 5つのだん（5つえらんでね）";
    }
    return "ぜんぶ ばらばら（2〜9のだん・10もん）";
  }

  function formatCourseBadgeText(data, kind, key) {
    const b = global.ProgressStore.getMulCourseBadge(data, key);
    if (!b.cleared) return "";
    const isPickSpecial =
      kind === "pick3_auto" ||
      kind === "pick3_user" ||
      kind === "pick5_auto" ||
      kind === "pick5_user";
    if (b.perfect) {
      return isPickSpecial ? "👑🎖️" : "👑";
    }
    return "🌸";
  }

  function isMulSelectionReady() {
    if (state.mulKind === "pick3_user") return state.mulCustomTables.length === 3;
    if (state.mulKind === "pick5_user") return state.mulCustomTables.length === 5;
    return true;
  }

  /* ========================================================================
     スタート画面のモード・難易度UI同期
     ======================================================================== */
  function getDemoSamples() {
    if (state.selectedMode === "add") {
      if (state.selectedRegroup === "none") return ["3 ＋ 4 ＝", "2 ＋ 6 ＝", "5 ＋ 3 ＝"];
      if (state.selectedRegroup === "only") return ["8 ＋ 7 ＝", "9 ＋ 5 ＝", "6 ＋ 8 ＝"];
      return ["3 ＋ 4 ＝", "8 ＋ 7 ＝", "5 ＋ 9 ＝"];
    }
    if (state.selectedMode === "sub") {
      if (state.selectedRegroup === "none") {
        if (state.selectedSubLevel === "lv1") return ["8 － 3 ＝", "9 － 4 ＝", "7 － 2 ＝"];
        if (state.selectedSubLevel === "lv2") return ["16 － 4 ＝", "18 － 5 ＝", "14 － 3 ＝"];
        return ["8 － 3 ＝", "16 － 4 ＝", "15 － 2 ＝"];
      }
      if (state.selectedRegroup === "only") return ["13 － 5 ＝", "15 － 8 ＝", "12 － 7 ＝"];
      return ["8 － 3 ＝", "13 － 5 ＝", "16 － 4 ＝"];
    }
    if (state.selectedMode === "mul") {
      if (state.mulKind === "table") {
        const t = state.mulTable;
        return [t + " × 2 ＝", t + " × 5 ＝", t + " × 8 ＝"];
      }
      return ["6 × 7 ＝", "8 × 4 ＝", "9 × 3 ＝"];
    }
    if (state.selectedDivKind === "exact") return ["24 ÷ 6 ＝", "35 ÷ 5 ＝", "18 ÷ 3 ＝"];
    if (state.selectedDivKind === "rem") return ["23 ÷ 5 ＝", "17 ÷ 4 ＝", "29 ÷ 6 ＝"];
    return ["24 ÷ 6 ＝", "23 ÷ 5 ＝", "42 ÷ 7 ＝"];
  }

  function formatSimpleBadge(b) {
    if (!b || !b.cleared) return "";
    return b.perfect ? "👑" : "🌸";
  }

  function updateModeSelectionUI() {
    const mode = state.selectedMode;
    const isAdd = mode === "add";
    const isSub = mode === "sub";
    const isMul = mode === "mul";
    const isDiv = mode === "div";
    const data = global.ProgressStore.load();

    els.btnModeAdd.classList.toggle("is-active", isAdd);
    els.btnModeSub.classList.toggle("is-active", isSub);
    els.btnModeMul.classList.toggle("is-active", isMul);
    els.btnModeDiv.classList.toggle("is-active", isDiv);

    els.regroupRow.hidden = isMul || isDiv;
    els.mulSummaryBox.hidden = !isMul;
    els.divOptionsWrap.hidden = !isDiv;

    if (isAdd) {
      els.labelRegroupNone.textContent = "くりあがり なし";
      els.exRegroupNone.textContent = "れい：3＋4";
      els.labelRegroupOnly.textContent = "くりあがり あり";
      els.exRegroupOnly.textContent = "れい：8＋7";
      els.exRegroupMix.textContent = "3＋4・8＋7";
      els.sublevelRow.hidden = true;
    } else if (isSub) {
      els.labelRegroupNone.textContent = "くりさがり なし";
      els.exRegroupNone.textContent = "れい：8−3・16−4";
      els.labelRegroupOnly.textContent = "くりさがり あり";
      els.exRegroupOnly.textContent = "れい：13−5";
      els.exRegroupMix.textContent = "8−3・13−5";
      els.sublevelRow.hidden = state.selectedRegroup !== "none";
    } else if (isMul) {
      els.sublevelRow.hidden = true;
      const key = getMulCourseKey(state.mulKind, state.mulTable, state.mulOrder);
      const badgeText = formatCourseBadgeText(data, state.mulKind, key);
      const masteredCount = global.ProgressStore.getTotalMasteredTables(data);
      els.mulSummaryCourse.textContent = getMulCourseLabel();
      els.mulSummaryBadges.textContent =
        (badgeText ? "せいせき：" + badgeText + " ／ " : "") +
        "九九マスター：" + masteredCount + "/8 だん";
    } else {
      els.sublevelRow.hidden = true;
      els.btnDivExact.classList.toggle("is-active", state.selectedDivKind === "exact");
      els.btnDivRem.classList.toggle("is-active", state.selectedDivKind === "rem");
      els.btnDivMix.classList.toggle("is-active", state.selectedDivKind === "mix");

      els.stampDivExact.textContent = formatSimpleBadge(global.ProgressStore.getDivBadge(data, "exact"));
      els.stampDivRem.textContent = formatSimpleBadge(global.ProgressStore.getDivBadge(data, "rem"));
      els.stampDivMix.textContent = formatSimpleBadge(global.ProgressStore.getDivBadge(data, "mix"));

      const divMaster = global.ProgressStore.getDivMasterStatus(data);
      els.divMasterBar.textContent = divMaster.isPerfectMaster
        ? "👑🎖️ わりざんマスター 達成！！（全コース一発クリア！）"
        : "わりざんマスター：👑 " + divMaster.perfectCount + " / 3（3つで 🎖️！）";
    }

    els.btnRegroupNone.classList.toggle("is-active", state.selectedRegroup === "none");
    els.btnRegroupOnly.classList.toggle("is-active", state.selectedRegroup === "only");
    els.btnRegroupMix.classList.toggle("is-active", state.selectedRegroup === "mix");

    els.btnSubLv1.classList.toggle("is-active", state.selectedSubLevel === "lv1");
    els.btnSubLv2.classList.toggle("is-active", state.selectedSubLevel === "lv2");
    els.btnSubLv3.classList.toggle("is-active", state.selectedSubLevel === "lv3");

    state.demoIndex = 0;
    els.demoEquation.textContent = getDemoSamples()[0];
    els.modePill.textContent =
      isAdd ? "たしざん 10もん" : isSub ? "ひきざん 10もん" : isMul ? "かけざん" : "わりざん 10もん";

    refreshProgressUI();
    updateTopButtonsVisibility();
  }

  function updateTopButtonsVisibility() {
    const data = global.ProgressStore.load();
    const isStartOrResult = state.currentScreen === "start" || state.currentScreen === "result";

    if (!isStartOrResult) {
      els.btnOpenMap.hidden = true;
      els.btnOpenJapan.hidden = true;
      return;
    }

    els.btnOpenJapan.hidden = !data.japan.unlocked;
    if (data.japan.unlocked) {
      const jpStats = global.ProgressStore.getJapanStats(data);
      els.topJapanLabel.textContent = "日本一周 (" + jpStats.clearedCount + "/47)";
    }

    if (state.selectedMode === "mul") {
      els.btnOpenMap.hidden = !data.oita.unlocked;
    } else if (state.selectedMode === "div") {
      els.btnOpenMap.hidden = !data.kyushu.unlocked;
    } else {
      els.btnOpenMap.hidden = false;
    }
  }

  /* ========================================================================
     かけざんコース選択ポップアップ（#modal-mul）
     ======================================================================== */
  function openMulModal() {
    state.mulTopTab = state.mulKind === "table" ? state.mulTable : "all";
    renderMulModal();
    els.modalMul.hidden = false;
  }

  function closeMulModal() {
    els.modalMul.hidden = true;
    updateModeSelectionUI();
  }

  function renderMulModal() {
    const data = global.ProgressStore.load();
    const masteredTotal = global.ProgressStore.getTotalMasteredTables(data);
    els.mulMasterCounter.textContent =
      "九九マスター：" + masteredTotal + " / 8 だん（🌸 クリア ／ 👑 1ぱつ ／ 🎖️ コンプリート）";

    els.mulTablesGrid.innerHTML = "";
    for (let t = 2; t <= 9; t++) {
      (function (tableNum) {
        const status = global.ProgressStore.getTableMasterStatus(data, tableNum);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mul-table-tile";
        if (state.mulTopTab === tableNum) btn.classList.add("is-selected");
        if (status.isMaster) btn.classList.add("is-mastered");

        const name = document.createElement("span");
        name.className = "mul-tile-name";
        name.textContent = tableNum + "のだん";
        btn.appendChild(name);

        const badge = document.createElement("span");
        badge.className = "mul-tile-badge";
        if (status.isPerfectMaster) {
          badge.textContent = "👑🎖️";
        } else if (status.isMaster) {
          badge.textContent = "🌸🎖️";
        } else if (status.perfectCount > 0) {
          badge.textContent = "👑" + status.clearedCount + "/3";
        } else if (status.clearedCount > 0) {
          badge.textContent = "🌸" + status.clearedCount + "/3";
        } else {
          badge.textContent = "・";
        }
        btn.appendChild(badge);

        bindReliableTap(btn, function () {
          state.mulTopTab = tableNum;
          state.mulKind = "table";
          state.mulTable = tableNum;
          renderMulModal();
        });
        els.mulTablesGrid.appendChild(btn);
      })(t);
    }

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "mul-table-tile";
    if (state.mulTopTab === "all") allBtn.classList.add("is-selected");
    const allBadge = formatCourseBadgeText(data, "all_rand", "mix_all");
    if (allBadge) allBtn.classList.add("is-mastered");

    const allName = document.createElement("span");
    allName.className = "mul-tile-name";
    allName.textContent = "🌟 ぜんぶ";
    allBtn.appendChild(allName);

    const allB = document.createElement("span");
    allB.className = "mul-tile-badge";
    allB.textContent = allBadge || "まぜまぜ";
    allBtn.appendChild(allB);

    bindReliableTap(allBtn, function () {
      state.mulTopTab = "all";
      if (state.mulKind === "table") state.mulKind = "low";
      renderMulModal();
    });
    els.mulTablesGrid.appendChild(allBtn);

    if (typeof state.mulTopTab === "number") {
      const t = state.mulTopTab;
      els.mulSubpanelTitle.textContent = t + "のだん：ならびかたを えらんでね！";
      els.mulOrderRow.hidden = false;
      els.mulMixGrid.hidden = true;
      els.mulCustomPicker.hidden = true;

      const orderDefs = [
        { order: "asc", title: "📈 じゅんばん", sub: t + "×1 〜 " + t + "×9" },
        { order: "desc", title: "📉 ぎゃく", sub: t + "×9 〜 " + t + "×1" },
        { order: "rand", title: "🎲 ばらばら", sub: t + "のだん ランダム" },
      ];

      els.mulOrderRow.innerHTML = "";
      orderDefs.forEach(function (od) {
        const key = getMulCourseKey("table", t, od.order);
        const stamp = formatCourseBadgeText(data, "table", key);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-mul-choice";
        if (state.mulKind === "table" && state.mulTable === t && state.mulOrder === od.order) {
          btn.classList.add("is-selected");
        }
        btn.innerHTML =
          '<span class="choice-main">' + od.title + "</span>" +
          '<span class="choice-sub">' + od.sub + "</span>" +
          '<span class="choice-stamp">' + (stamp || "　") + "</span>";
        bindReliableTap(btn, function () {
          state.mulKind = "table";
          state.mulTable = t;
          state.mulOrder = od.order;
          renderMulModal();
        });
        els.mulOrderRow.appendChild(btn);
      });
    } else {
      els.mulSubpanelTitle.textContent = "ぜんぶのだん：チャレンジを えらんでね！";
      els.mulOrderRow.hidden = true;
      els.mulMixGrid.hidden = false;

      const mixDefs = [
        { kind: "low", title: "2〜5のだん", sub: "ばらばら 10もん", special: false },
        { kind: "high", title: "6〜9のだん", sub: "ばらばら 10もん", special: false },
        { kind: "pick3_auto", title: "🎲 おまかせ 3つ", sub: "アプリがえらぶよ", special: false },
        { kind: "pick3_user", title: "✋ えらぶ 3つ", sub: "すきな段を3つ", special: false },
        { kind: "pick5_auto", title: "🎲 おまかせ 5つ", sub: "アプリがえらぶよ", special: false },
        { kind: "pick5_user", title: "✋ えらぶ 5つ", sub: "すきな段を5つ", special: false },
        { kind: "all_rand", title: "🏆 ぜんぶ ばらばら（2〜9のだん）", sub: "1ぱつクリアで すごいことが！？", special: true },
      ];

      els.mulMixGrid.innerHTML = "";
      mixDefs.forEach(function (md) {
        const key = getMulCourseKey(md.kind, 0, "");
        const stamp = formatCourseBadgeText(data, md.kind, key);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-mul-choice" + (md.special ? " is-special" : "");
        if (state.mulKind === md.kind) btn.classList.add("is-selected");

        btn.innerHTML =
          '<span class="choice-main">' + md.title + "</span>" +
          '<span class="choice-sub">' + md.sub + "</span>" +
          '<span class="choice-stamp">' + (stamp || "　") + "</span>";
        bindReliableTap(btn, function () {
          state.mulKind = md.kind;
          if (md.kind === "pick3_user") {
            state.mulCustomTables = state.mulCustomTables.slice(0, 3);
          } else if (md.kind === "pick5_user" && state.mulCustomTables.length > 5) {
            state.mulCustomTables = state.mulCustomTables.slice(0, 5);
          }
          renderMulModal();
        });
        els.mulMixGrid.appendChild(btn);
      });

      if (state.mulKind === "pick3_user" || state.mulKind === "pick5_user") {
        const needed = state.mulKind === "pick3_user" ? 3 : 5;
        els.mulCustomPicker.hidden = false;
        const remain = needed - state.mulCustomTables.length;
        els.mulPickerPrompt.textContent =
          remain > 0
            ? "すきな だんを " + needed + "つ えらんでね！（あと " + remain + "つ）"
            : "✅ " + needed + "つ えらべたよ！（[" + state.mulCustomTables.join("・") + "]のだん）";

        els.mulPickerPills.innerHTML = "";
        for (let n = 2; n <= 9; n++) {
          (function (num) {
            const pBtn = document.createElement("button");
            pBtn.type = "button";
            pBtn.className = "btn-pick-num";
            if (state.mulCustomTables.indexOf(num) !== -1) pBtn.classList.add("is-picked");
            pBtn.textContent = String(num);

            bindReliableTap(pBtn, function () {
              const idx = state.mulCustomTables.indexOf(num);
              if (idx !== -1) {
                state.mulCustomTables.splice(idx, 1);
              } else if (state.mulCustomTables.length < needed) {
                state.mulCustomTables.push(num);
                state.mulCustomTables.sort(function (a, b) { return a - b; });
              }
              renderMulModal();
            });
            els.mulPickerPills.appendChild(pBtn);
          })(n);
        }
      } else {
        els.mulCustomPicker.hidden = true;
      }
    }

    els.mulSelectedPreview.textContent = "えらんだコース：" + getMulCourseLabel();
    els.btnMulStart.disabled = !isMulSelectionReady();
  }

  /* ========================================================================
     すごろくUI更新＆専用画面（佐伯市 / 大分県 / 九州・沖縄）
     ======================================================================== */
  function refreshProgressUI() {
    const data = global.ProgressStore.load();

    // 日本一周ボタンの表示（九州・沖縄ゴール後のみ）
    if (data.japan.unlocked) {
      const jpStats = global.ProgressStore.getJapanStats(data);
      els.btnStartJapan.hidden = false;
      els.btnStartJapanLabel.textContent =
        jpStats.allCleared
          ? "👑 日本一周 47都道府県 せいは！！（マップをみる）"
          : "🗾 日本一周 計算の旅へ！！（" + jpStats.clearedCount + " / 47県）";
    } else {
      els.btnStartJapan.hidden = true;
    }

    if (state.selectedMode === "mul") {
      const oita = data.oita;
      if (!oita.unlocked) {
        els.btnStartMapPreview.hidden = true;
        els.secretUnlockHint.hidden = false;
        els.secretUnlockHint.innerHTML =
          "🌟 「ぜんぶのだん」の <strong>ぜんぶ ばらばら</strong> を 1かいめで ぜんもん せいかい すると… ひみつの ごほうびが でるかも！？";
        els.topMapLabel.textContent = "すごろく";
        return;
      }

      els.secretUnlockHint.hidden = true;
      els.btnStartMapPreview.hidden = false;
      const stations = global.ProgressStore.OITA_STATIONS;
      const lapNum = oita.laps + 1;
      els.topMapLabel.textContent = "おおいた (" + oita.step + "/10)";
      els.startMapTitle.innerHTML = "🗺️ <strong>おおいたけん 1しゅう すごろく</strong>";
      els.startLapBadge.textContent = lapNum + "しゅうめ";
      renderMiniTrack(oita.step, 10);

      if (oita.step === 0) {
        els.startMiniStatus.textContent = "🚩 いまは「スタート」！ つぎは「① さいき」をめざそう！";
      } else if (oita.step >= 10) {
        els.startMiniStatus.textContent =
          "🏆 おおいたけん 1しゅう ゴール！ ぜんぶばらばら一発クリアで " + (lapNum + 1) + "しゅうめへ！";
      } else {
        const nextSt = stations[oita.step];
        els.startMiniStatus.textContent =
          "いま「" + stations[oita.step - 1].name + "」！ つぎは「" + nextSt.label + "」" + nextSt.icon;
      }
      return;
    }

    if (state.selectedMode === "div") {
      const kyushu = data.kyushu;
      if (!kyushu.unlocked) {
        els.btnStartMapPreview.hidden = true;
        els.secretUnlockHint.hidden = false;
        els.secretUnlockHint.innerHTML =
          "🌟 わりざんの <strong>まぜまぜ</strong> を 1かいめで ぜんもん せいかい すると… ひみつの すごろくが ひらくよ！？";
        els.topMapLabel.textContent = "すごろく";
        return;
      }

      els.secretUnlockHint.hidden = true;
      els.btnStartMapPreview.hidden = false;
      const stations = global.ProgressStore.KYUSHU_STATIONS;
      const lapNum = kyushu.laps + 1;
      els.topMapLabel.textContent = "きゅうしゅう (" + kyushu.step + "/9)";
      els.startMapTitle.innerHTML = "🗺️ <strong>きゅうしゅう・おきなわ 1しゅう すごろく</strong>";
      els.startLapBadge.textContent = lapNum + "しゅうめ";
      renderMiniTrack(kyushu.step, 9);

      if (kyushu.step === 0) {
        els.startMiniStatus.textContent = "🚩 いまは「スタート」！ つぎは「① おおいた」をめざそう！";
      } else if (kyushu.step >= 9) {
        els.startMiniStatus.textContent =
          "🏆 九州・沖縄ゴール！ 🗾日本一周チャレンジも ひらいたよ！";
      } else {
        const nextSt = stations[kyushu.step];
        els.startMiniStatus.textContent =
          "いま「" + stations[kyushu.step - 1].name + "」！ つぎは「" + nextSt.label + "」" + nextSt.icon;
      }
      return;
    }

    // たしざん・ひきざん：佐伯市一周すごろくのみ
    els.secretUnlockHint.hidden = true;
    els.btnStartMapPreview.hidden = false;
    const saiki = data.saiki;
    const stations = global.ProgressStore.SAIKI_STATIONS;
    const lapNum = saiki.laps + 1;

    els.topMapLabel.textContent = "さいきし (" + saiki.step + "/10)";
    els.startMapTitle.innerHTML = "🗺️ <strong>さいきし 1しゅう すごろく</strong>";
    els.startLapBadge.textContent = lapNum + "しゅうめ";
    renderMiniTrack(saiki.step, 10);

    if (saiki.step === 0) {
      els.startMiniStatus.textContent = "🚩 いまは「スタート」！ つぎは「① かみうら」をめざそう！";
    } else if (saiki.step >= 10) {
      els.startMiniStatus.textContent =
        "🏆 さいきし 1しゅう ゴール！ つぎのチャレンジで " + (lapNum + 1) + "しゅうめへ！";
    } else {
      const nextStation = stations[saiki.step];
      els.startMiniStatus.textContent =
        "いま「" + stations[saiki.step - 1].name + "」！ つぎは「" + nextStation.label + "」" + nextStation.icon;
    }
  }

  function renderMiniTrack(step, total) {
    els.startMiniTrack.innerHTML = "";
    els.startMiniTrack.style.gridTemplateColumns = "repeat(" + total + ", 1fr)";
    for (let i = 0; i < total; i++) {
      const bar = document.createElement("span");
      bar.className = "mini-step-dot";
      if (i < step) bar.classList.add("is-cleared");
      else if (i === step) bar.classList.add("is-next");
      els.startMiniTrack.appendChild(bar);
    }
  }

  function renderSugorokuScreen(justArrived) {
    const data = global.ProgressStore.load();
    const isOita = state.selectedMode === "mul";
    const isKyushu = state.selectedMode === "div";

    const board = isOita ? data.oita : isKyushu ? data.kyushu : data.saiki;
    const stations = isOita
      ? global.ProgressStore.OITA_STATIONS
      : isKyushu
        ? global.ProgressStore.KYUSHU_STATIONS
        : global.ProgressStore.SAIKI_STATIONS;
    const layoutArr = isKyushu ? BOARD_LAYOUT_10 : BOARD_LAYOUT_11;
    const totalSteps = stations.length;
    const startTile = global.ProgressStore.START_TILE;
    const lapNum = board.laps + 1;

    els.mapScreenShell.classList.toggle("is-oita-theme", isOita);
    els.mapScreenShell.classList.toggle("is-kyushu-theme", isKyushu);
    els.sugorokuBoard.classList.toggle("is-kyushu-board", isKyushu);

    if (isOita) {
      els.mapScreenTitle.textContent = "🗺️ おおいたけん ぐるっと 1しゅう すごろく";
      els.mapFutureNote.textContent = "🏆 「ぜんぶ ばらばら」を 1かいめで ぜんもんせいかい すると 1マスすすむよ！";
    } else if (isKyushu) {
      els.mapScreenTitle.textContent = "🗺️ きゅうしゅう・おきなわ 1しゅう すごろく";
      els.mapFutureNote.textContent = "🗾 ゴールまで たどりつくと「日本一周 計算の旅」が ひらくよ！！";
    } else {
      els.mapScreenTitle.textContent = "🗺️ さいきし ぐるっと 1しゅう すごろく";
      els.mapFutureNote.textContent = "🌱 10もん クリアで 1マスすすむよ！（1かいめ ぜんもんせいかいで 👑）";
    }

    const allTiles = [startTile].concat(stations);
    els.sugorokuBoard.innerHTML = "";

    allTiles.forEach(function (item, idx) {
      const layout = layoutArr[idx];
      const isStart = idx === 0;
      const isGoal = idx === totalSteps;
      const isCleared = idx >= 1 && idx <= board.step;
      const hasCrown = idx >= 1 && Boolean(board.crowns[idx - 1]);
      const isHere = idx === board.step;

      const tile = document.createElement("div");
      tile.className = "sugoroku-tile";
      if (isStart) tile.classList.add("is-start");
      if (isCleared) tile.classList.add("is-cleared");
      if (isGoal) tile.classList.add("is-goal");
      if (isHere) {
        tile.classList.add("is-here");
        if (justArrived) tile.classList.add("is-just-arrived");
      }

      tile.style.gridColumn = layout.col;
      tile.style.gridRow = layout.row;

      const header = document.createElement("div");
      header.className = "tile-header";
      header.textContent = item.label;
      tile.appendChild(header);

      const body = document.createElement("div");
      body.className = "tile-body";

      const icon = document.createElement("span");
      icon.className = "tile-icon";
      icon.textContent = item.icon;
      body.appendChild(icon);

      const stamps = document.createElement("div");
      stamps.className = "tile-stamps";
      if (isCleared) {
        const sakura = document.createElement("span");
        sakura.className = "stamp-sakura";
        sakura.textContent = "🌸";
        stamps.appendChild(sakura);
      }
      if (hasCrown) {
        const crown = document.createElement("span");
        crown.className = "stamp-crown";
        crown.textContent = "👑";
        stamps.appendChild(crown);
      }
      body.appendChild(stamps);
      tile.appendChild(body);

      if (isHere) {
        const here = document.createElement("span");
        here.className = "tile-here-badge";
        here.textContent = "🐰 いまここ！";
        tile.appendChild(here);
      }

      if (layout.arrowDir) {
        const arrow = document.createElement("span");
        arrow.className = "tile-connector dir-" + layout.arrowDir;
        arrow.textContent = layout.arrowText;
        arrow.setAttribute("aria-hidden", "true");
        tile.appendChild(arrow);
      }

      els.sugorokuBoard.appendChild(tile);
    });

    els.mapStatsPill.textContent =
      "クリア回数：" + board.totalClears + "かい ／ いま " + lapNum + "しゅうめ（🌸 " + board.step + "/" + totalSteps + "・👑 " + board.totalPerfects + "こ）";
  }

  function openMapScreen(justArrived) {
    const data = global.ProgressStore.load();
    if (state.selectedMode === "mul" && !data.oita.unlocked) return;
    if (state.selectedMode === "div" && !data.kyushu.unlocked) return;

    if (state.currentScreen === "start" || state.currentScreen === "result") {
      state.mapReturnScreen = state.currentScreen;
    }
    renderSugorokuScreen(Boolean(justArrived));
    showScreen("map");
    renderProgressDots();
  }

  function closeMapScreen() {
    const target = state.mapReturnScreen === "result" ? "result" : "start";
    showScreen(target);
    renderProgressDots();
  }

  /* ========================================================================
     日本一周 計算の旅（47都道府県マップ＆シルエットポップアップ）
     ======================================================================== */
  function openJapanScreen() {
    const data = global.ProgressStore.load();
    if (!data.japan.unlocked) return;
    renderJapanMap();
    showScreen("japan");
    renderProgressDots();
  }

  function renderJapanMap() {
    const data = global.ProgressStore.load();
    const stats = global.ProgressStore.getJapanStats(data);
    els.japanProgressPill.textContent =
      "せいは：" + stats.clearedCount + " / 47 けん（👑 " + stats.perfectCount + "こ）";

    els.japanTileGrid.innerHTML = "";
    global.JapanData.PREFECTURES.forEach(function (pref) {
      const status = data.japan.cleared[String(pref.id)];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pref-tile region-" + pref.region;
      if (status && status.cleared) btn.classList.add("is-cleared");
      if (status && status.perfect) btn.classList.add("is-perfect");

      btn.style.gridColumn = pref.cs > 1 ? pref.c + " / span " + pref.cs : String(pref.c);
      btn.style.gridRow = pref.rs > 1 ? pref.r + " / span " + pref.rs : String(pref.r);

      const label = document.createElement("span");
      label.textContent = pref.short;
      btn.appendChild(label);

      const st = document.createElement("span");
      st.className = "pref-tile-status";
      if (status && status.perfect) st.textContent = "👑";
      else if (status && status.cleared) st.textContent = "🌸";
      else st.textContent = "？";
      btn.appendChild(st);

      bindReliableTap(btn, function () {
        openPrefModal(pref);
      });

      els.japanTileGrid.appendChild(btn);
    });
  }

  function openPrefModal(pref) {
    const data = global.ProgressStore.load();
    const assignedType = data.japan.assignments[String(pref.id)] || "add";
    const meta = JAPAN_OP_META[assignedType] || JAPAN_OP_META.add;
    const status = data.japan.cleared[String(pref.id)];

    state.modalPrefTarget = { pref: pref, assignedType: assignedType };

    els.prefRegionPill.textContent = pref.region + "ちほう";
    els.prefModalName.textContent = pref.kana + "（" + pref.name + "）";
    els.prefSvgPath.setAttribute("d", pref.path);
    els.prefOpAnnounce.textContent = meta.title;
    els.prefOpDesc.textContent = meta.desc;

    if (status && status.perfect) {
      els.prefStatusBadge.textContent = "👑 1かいめ ぜんもんせいかい済み！ もう1かいあそべるよ";
    } else if (status && status.cleared) {
      els.prefStatusBadge.textContent = "🌸 クリア済み！ こんどは 1ぱつ👑をめざそう！";
    } else {
      els.prefStatusBadge.textContent = "？ まだ 未挑戦の県だよ！ 10もんクリアで色がつくよ";
    }

    els.modalPref.hidden = false;
  }

  function closePrefModal() {
    els.modalPref.hidden = true;
  }

  /* ========================================================================
     隠し5回タップ：データ引き継ぎモーダル
     ======================================================================== */
  function openTransferModal() {
    const data = global.ProgressStore.load();
    let html =
      "さいきし：<strong>" + (data.saiki.laps + 1) + "しゅうめ</strong>（" +
      data.saiki.step + " / 10 マス・👑 " + data.saiki.totalPerfects + "こ）";
    if (data.oita.unlocked) {
      html +=
        "<br>おおいたけん：<strong>" + (data.oita.laps + 1) + "しゅうめ</strong>（" +
        data.oita.step + " / 10 マス）";
    }
    if (data.kyushu.unlocked) {
      html +=
        "<br>きゅうしゅう・おきなわ：<strong>" + (data.kyushu.laps + 1) + "しゅうめ</strong>（" +
        data.kyushu.step + " / 9 マス）";
    }
    if (data.japan.unlocked) {
      const jp = global.ProgressStore.getJapanStats(data);
      html += "<br>日本一周：<strong>" + jp.clearedCount + " / 47 けん</strong>（👑 " + jp.perfectCount + "こ）";
    }
    html += "<br>九九マスター：<strong>" + global.ProgressStore.getTotalMasteredTables(data) + " / 8 だん</strong>";
    els.transferSummary.innerHTML = html;
    els.transferStatus.textContent = "";
    disarmReset();
    els.modalTransfer.hidden = false;
  }

  function closeTransferModal() {
    disarmReset();
    els.modalTransfer.hidden = true;
  }

  function disarmReset() {
    resetConfirmArmed = false;
    if (resetArmTimer) {
      clearTimeout(resetArmTimer);
      resetArmTimer = null;
    }
    els.resetBtnLabel.textContent = "🗑️ データを さいしょからにする（リセット）";
  }

  function handleBrandTap() {
    brandTapCount++;
    if (brandTapResetTimer) clearTimeout(brandTapResetTimer);
    brandTapResetTimer = setTimeout(function () {
      brandTapCount = 0;
    }, 2500);

    if (brandTapCount >= 5) {
      brandTapCount = 0;
      clearTimeout(brandTapResetTimer);
      openTransferModal();
    }
  }

  function handleExportJson() {
    try {
      const jsonText = global.ProgressStore.exportJsonText();
      const blob = new Blob([jsonText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const ymd =
        d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");

      const a = document.createElement("a");
      a.href = url;
      a.download = "ktatsujin_backup_" + ymd + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1000);

      els.transferStatus.textContent = "✅ バックアップファイル（JSON）を ほぞんしました！";
    } catch (e) {
      els.transferStatus.textContent = "⚠️ ほぞんに しっぱいしました。";
    }
  }

  function handleImportFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        global.ProgressStore.importJsonText(String(reader.result));
        updateModeSelectionUI();
        if (state.currentScreen === "map") renderSugorokuScreen(false);
        if (state.currentScreen === "japan") renderJapanMap();
        if (!els.modalMul.hidden) renderMulModal();
        openTransferModal();
        els.transferStatus.textContent = "✅ データを よみこんで ひきつぎました！";
      } catch (err) {
        els.transferStatus.textContent = "⚠️ 正しいバックアップファイル（JSON）ではありません。";
      }
      els.importJsonInput.value = "";
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleResetTap() {
    if (!resetConfirmArmed) {
      resetConfirmArmed = true;
      els.resetBtnLabel.textContent = "⚠️ ほんとうに けす？（もう1かい おしてね）";
      resetArmTimer = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    global.ProgressStore.resetAll();
    updateModeSelectionUI();
    if (state.currentScreen === "map" || state.currentScreen === "japan") {
      showScreen("start");
    }
    if (!els.modalMul.hidden) renderMulModal();
    openTransferModal();
    els.transferStatus.textContent = "🗑️ データを さいしょから に もどしました。";
  }

  /* ========================================================================
     画面切り替え & 進捗ドット
     ======================================================================== */
  function showScreen(name) {
    state.currentScreen = name;
    els.screenStart.hidden = name !== "start";
    els.screenQuiz.hidden = name !== "quiz";
    els.screenResult.hidden = name !== "result";
    els.screenMap.hidden = name !== "map";
    els.screenJapan.hidden = name !== "japan";
    els.btnHome.hidden = name === "start" || name === "japan";
    updateTopButtonsVisibility();
    if (name !== "result") {
      els.confettiLayer.innerHTML = "";
    }
  }

  function renderProgressDots() {
    els.progressDots.innerHTML = "";
    if (els.screenQuiz.hidden && els.screenResult.hidden) return;

    for (let i = 0; i < state.deck.length; i++) {
      const dot = document.createElement("span");
      dot.className = "progress-dot";
      if (i < state.records.length) {
        dot.classList.add(state.records[i].isCorrect ? "is-correct" : "is-retry");
      } else if (i === state.currentIndex && !els.screenQuiz.hidden) {
        dot.classList.add("is-current");
      }
      els.progressDots.appendChild(dot);
    }
  }

  /* ========================================================================
     コンボ・動物応援・紙吹雪演出
     ======================================================================== */
  function spawnComboPopup(comboCount) {
    const el = document.createElement("div");
    el.className = "combo-pop" + (comboCount >= 5 ? " is-super" : "");
    el.textContent = comboCount + " コンボ！";
    els.comboStage.appendChild(el);

    while (els.comboStage.children.length > 4) {
      els.comboStage.removeChild(els.comboStage.firstChild);
    }
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1600);
  }

  function addCheeringAnimal(correctTotal) {
    const emoji = ANIMALS[(correctTotal - 1) % ANIMALS.length];
    const span = document.createElement("span");
    span.className = "animal-cheer";
    span.textContent = emoji;
    els.animalParade.appendChild(span);
  }

  function spawnConfetti() {
    els.confettiLayer.innerHTML = "";
    const symbols = ["🌸", "🌺", "🌻", "🌷", "✨", "⭐", "🎉", "💐"];
    for (let i = 0; i < 34; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.textContent = symbols[i % symbols.length];
      piece.style.left = (Math.random() * 96 + 2) + "%";
      piece.style.animationDuration = (2.6 + Math.random() * 2.2).toFixed(2) + "s";
      piece.style.animationDelay = (Math.random() * 1.4).toFixed(2) + "s";
      els.confettiLayer.appendChild(piece);
    }
  }

  /* ========================================================================
     ヒントボード（たし・ひき・かけ・わり 全対応）
     ======================================================================== */
  function initHintForCard(card) {
    state.hintLeft = [];
    state.hintRight = [];
    state.mulLitRows = 0;
    state.divGroupsLit = 0;

    if (card.mode === "add") {
      for (let i = 0; i < 10; i++) {
        state.hintLeft.push(i < card.a ? "a" : null);
        state.hintRight.push(i < card.b ? "b" : null);
      }
    } else if (card.mode === "sub") {
      const leftN = Math.min(10, card.a);
      const rightN = Math.max(0, card.a - 10);
      for (let i = 0; i < 10; i++) {
        state.hintLeft.push(i < leftN ? { active: true } : null);
        state.hintRight.push(i < rightN ? { active: true } : null);
      }
    } else if (card.mode === "mul") {
      // 先生方の指導法：1つ前の段（b - 1）まで表示し、「あと a を足すといくつ？」で導く
      state.mulLitRows = card.b >= 2 ? card.b - 1 : 1;
    } else if (card.mode === "div") {
      state.divGroupsLit = 0;
    }
  }

  function openHintBoard() {
    const card = state.deck[state.currentIndex];
    if (!card) return;
    if (!state.currentUsedHint) {
      initHintForCard(card);
    }
    state.currentUsedHint = true;
    state.hintOpen = true;
    els.hintTriggerRow.hidden = true;
    els.celebrationZone.hidden = true;
    els.hintBoard.hidden = false;
    renderHintBoard();
  }

  function closeHintBoard(keepTriggerVisible) {
    state.hintOpen = false;
    els.hintBoard.hidden = true;
    els.celebrationZone.hidden = false;
    if (keepTriggerVisible && state.currentAttempts > 0) {
      els.hintTriggerRow.hidden = false;
    }
  }

  function countDots(arr) {
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== null) n++;
    }
    return n;
  }

  function countSubDots(arr) {
    let active = 0;
    let removed = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== null) {
        if (arr[i].active) active++;
        else removed++;
      }
    }
    return { active: active, removed: removed };
  }

  function moveAddDotBetween(fromSide, fromIdx, toSide, toIdx) {
    const fromArr = fromSide === "left" ? state.hintLeft : state.hintRight;
    const toArr = toSide === "left" ? state.hintLeft : state.hintRight;
    if (fromArr[fromIdx] === null) return false;

    let targetIdx = typeof toIdx === "number" ? toIdx : -1;
    if (targetIdx < 0 || toArr[targetIdx] !== null) {
      targetIdx = toArr.indexOf(null);
    }
    if (targetIdx === -1) return false;

    const token = fromArr[fromIdx];
    fromArr[fromIdx] = null;
    toArr[targetIdx] = token;
    global.SoundFX.playErase();
    renderHintBoard();
    return true;
  }

  function renderHintBoard() {
    const card = state.deck[state.currentIndex];
    if (!card) return;

    els.tenFramesRow.hidden = true;
    els.mulHintArea.hidden = true;
    els.divHintArea.hidden = true;

    if (card.mode === "mul") {
      els.mulHintArea.hidden = false;
      els.hintBoardTitle.textContent = "💡 1つまえの だんに " + card.a + " を たしてみよう！";

      const dotSize = card.b >= 7 ? "13px" : card.b >= 5 ? "16px" : "20px";
      els.mulArrayGrid.style.setProperty("--mul-dot-size", dotSize);
      els.mulArrayGrid.innerHTML = "";

      for (let r = 1; r <= card.b; r++) {
        (function (rowIdx) {
          const rowEl = document.createElement("div");
          rowEl.className = "mul-array-row" + (rowIdx <= state.mulLitRows ? " is-lit" : "");

          const dotsWrap = document.createElement("div");
          dotsWrap.className = "mul-array-row-dots";
          for (let c = 0; c < card.a; c++) {
            const d = document.createElement("span");
            d.className = "mul-array-dot";
            dotsWrap.appendChild(d);
          }
          rowEl.appendChild(dotsWrap);

          const sumEl = document.createElement("span");
          sumEl.className = "mul-row-sum";
          sumEl.textContent = rowIdx <= state.mulLitRows ? String(card.a * rowIdx) : "？";
          rowEl.appendChild(sumEl);

          bindReliableTap(rowEl, function () {
            state.mulLitRows = rowIdx;
            global.SoundFX.playErase();
            renderHintBoard();
          });
          els.mulArrayGrid.appendChild(rowEl);
        })(r);
      }

      els.hintInstruction.classList.remove("is-complete");
      if (card.b === 1) {
        els.hintInstruction.textContent =
          "「" + card.a + " × 1」は " + card.a + " が 1こぶんだよ！ こたえは いくつ？";
        els.hintInstruction.classList.add("is-complete");
      } else if (state.mulLitRows === card.b - 1) {
        const prevAns = card.a * (card.b - 1);
        els.hintInstruction.textContent =
          "「" + card.a + " × " + (card.b - 1) + " ＝ " + prevAns + "」に、あと " + card.a + " を たすと いくつかな？";
      } else if (state.mulLitRows >= card.b) {
        const curAns = card.a * card.b;
        els.hintInstruction.textContent =
          card.a + " が " + card.b + "こぶんで " + curAns + "！ さぁ こたえを かいてね！";
        els.hintInstruction.classList.add("is-complete");
      } else {
        const curSum = card.a * state.mulLitRows;
        els.hintInstruction.textContent =
          "いま " + card.a + " × " + state.mulLitRows + " ＝ " + curSum + "（つぎの れつも おしてみよう！）";
      }
      return;
    }

    if (card.mode === "div") {
      els.divHintArea.hidden = false;
      els.hintBoardTitle.textContent = "💡 " + card.a + "こを " + card.b + "こずつ わけてみよう！";

      const dotPx = card.a > 56 ? "9px" : card.a > 30 ? "11px" : "14px";
      els.divDotsStage.style.setProperty("--div-dot-size", dotPx);
      els.divDotsStage.innerHTML = "";

      for (let g = 0; g < state.divGroupsLit; g++) {
        const grp = document.createElement("div");
        grp.className = "div-group-box";
        for (let k = 0; k < card.b; k++) {
          const dt = document.createElement("span");
          dt.className = "div-dot-unit";
          grp.appendChild(dt);
        }
        els.divDotsStage.appendChild(grp);
      }

      const remainingDots = card.a - state.divGroupsLit * card.b;
      if (remainingDots > 0) {
        const restWrap = document.createElement("div");
        restWrap.className =
          "div-ungrouped-wrap" +
          (state.divGroupsLit >= card.answer && card.remainder > 0 ? " is-remainder" : "");
        for (let r = 0; r < remainingDots; r++) {
          const dt = document.createElement("span");
          dt.className = "div-dot-unit";
          restWrap.appendChild(dt);
        }
        els.divDotsStage.appendChild(restWrap);
      }

      els.hintInstruction.classList.remove("is-complete");
      if (state.divGroupsLit >= card.answer) {
        els.hintInstruction.classList.add("is-complete");
        els.hintInstruction.textContent =
          card.remainder > 0
            ? "できた！ " + card.b + "こずつ " + card.answer + "グループ と、あまり " + card.remainder + "こ！"
            : "ぴったり！ " + card.b + "こずつ " + card.answer + "グループ に わけられたよ！";
      } else {
        els.hintInstruction.textContent =
          "「グループに わける」を おしてね！（いま " + state.divGroupsLit + "グループ／のこり " + remainingDots + "こ）";
      }
      return;
    }

    // たしざん・ひきざん用 10のかたまり
    els.tenFramesRow.hidden = false;

    if (card.mode === "add") {
      els.hintBoardTitle.textContent = "💡 10の まとまりで かんがえよう！";
      els.tenWrapRight.hidden = false;
      els.tenFrameOp.hidden = false;
      els.tenFrameOp.textContent = "＋";

      const leftCount = countDots(state.hintLeft);
      const rightCount = countDots(state.hintRight);

      els.tenFrameLeft.classList.toggle("is-ten-full", leftCount === 10);
      els.tenFrameRight.classList.toggle("is-ten-full", rightCount === 10);

      els.tenCountLeft.textContent = leftCount === 10 ? "ひだり：10（いっぱい！）" : "ひだり：" + leftCount;
      els.tenCountLeft.classList.toggle("is-full", leftCount === 10);

      els.tenCountRight.textContent = rightCount === 10 ? "みぎ：10（いっぱい！）" : "みぎ：" + rightCount;
      els.tenCountRight.classList.toggle("is-full", rightCount === 10);

      els.hintInstruction.classList.remove("is-complete");
      if (card.hasRegroup) {
        if (leftCount === 10) {
          els.hintInstruction.textContent =
            "やった！ 10 と " + rightCount + " に なったよ！ さぁ、こたえは いくつ？";
          els.hintInstruction.classList.add("is-complete");
        } else if (rightCount === 10) {
          els.hintInstruction.textContent =
            "やった！ " + leftCount + " と 10 に なったよ！ さぁ、こたえは いくつ？";
          els.hintInstruction.classList.add("is-complete");
        } else {
          els.hintInstruction.textContent =
            "●を ドラッグして、どちらかの わくを 10（いっぱい）に しよう！";
        }
      } else {
        if (leftCount === 0 || rightCount === 0) {
          els.hintInstruction.textContent =
            "ひとつに まとまったよ！ ぜんぶで いくつ？ こたえを かいてね！";
          els.hintInstruction.classList.add("is-complete");
        } else {
          els.hintInstruction.textContent =
            "●を ドラッグ（または タップ）して、ひとつの わくに まとめてみよう！";
        }
      }

      renderAddSlots(els.tenFrameLeft, state.hintLeft, "left");
      renderAddSlots(els.tenFrameRight, state.hintRight, "right");
      return;
    }

    // ひきざん用ヒント描画
    els.hintBoardTitle.textContent = "💡 ●を タップして ひいてみよう！";
    const hasTwoFrames = card.a > 10;
    els.tenWrapRight.hidden = !hasTwoFrames;
    els.tenFrameOp.hidden = !hasTwoFrames;
    els.tenFrameOp.textContent = "と";

    els.tenFrameLeft.classList.remove("is-ten-full", "is-drop-ready");
    els.tenFrameRight.classList.remove("is-ten-full", "is-drop-ready");

    const leftStats = countSubDots(state.hintLeft);
    const rightStats = countSubDots(state.hintRight);
    const totalRemoved = leftStats.removed + rightStats.removed;
    const totalActive = leftStats.active + rightStats.active;

    els.tenCountLeft.classList.remove("is-full");
    els.tenCountRight.classList.remove("is-full");
    els.tenCountLeft.textContent = "のこり：" + leftStats.active + "こ";
    els.tenCountRight.textContent = "のこり：" + rightStats.active + "こ";

    els.hintInstruction.classList.remove("is-complete");
    if (totalRemoved === card.b) {
      els.hintInstruction.textContent =
        "ばっちり " + card.b + "こ とったよ！ のこりの あおい●（" +
        (hasTwoFrames ? leftStats.active + " と " + rightStats.active : totalActive) +
        "）は いくつ？";
      els.hintInstruction.classList.add("is-complete");
    } else if (totalRemoved > card.b) {
      els.hintInstruction.textContent =
        "とりすぎちゃった！ " + card.b + "こ になるように ✕ をタップして もどそう（いま " + totalRemoved + "こ）";
    } else {
      els.hintInstruction.textContent =
        "●を " + card.b + "こ タップして とろう！（いま " + totalRemoved + "こ とったよ）";
    }

    renderSubSlots(els.tenFrameLeft, state.hintLeft);
    if (hasTwoFrames) {
      renderSubSlots(els.tenFrameRight, state.hintRight);
    }
  }

  function renderSubSlots(container, slots) {
    container.innerHTML = "";
    slots.forEach(function (item, idx) {
      const slot = document.createElement("div");
      slot.className = "ten-slot" + (item === null ? " is-empty" : "");
      if (item !== null) {
        const dot = document.createElement("div");
        dot.className = "hint-dot is-a" + (item.active ? "" : " is-removed");
        bindReliableTap(dot, function () {
          slots[idx].active = !slots[idx].active;
          global.SoundFX.playErase();
          renderHintBoard();
        });
        slot.appendChild(dot);
      }
      container.appendChild(slot);
    });
  }

  function renderAddSlots(container, slots, side) {
    container.innerHTML = "";
    slots.forEach(function (token, idx) {
      const slot = document.createElement("div");
      slot.className = "ten-slot" + (token === null ? " is-empty" : "");
      slot.dataset.side = side;
      slot.dataset.index = String(idx);

      if (token !== null) {
        const dot = document.createElement("div");
        dot.className = "hint-dot " + (token === "a" ? "is-a" : "is-b");
        attachDotDrag(dot, side, idx, token);
        slot.appendChild(dot);
      }
      container.appendChild(slot);
    });
  }

  function attachDotDrag(dotEl, side, idx, token) {
    dotEl.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startTime = Date.now();
      const pointerId = e.pointerId;
      let moved = false;

      dotEl.classList.add("is-dragging-source");

      const ghost = document.createElement("div");
      ghost.className = "drag-ghost-dot " + (token === "a" ? "is-a" : "is-b");
      ghost.style.left = startX + "px";
      ghost.style.top = startY + "px";
      document.body.appendChild(ghost);

      function getTargetFrame(clientX, clientY) {
        const hit = document.elementFromPoint(clientX, clientY);
        if (!hit) return null;
        const slotEl = hit.closest ? hit.closest(".ten-slot") : null;
        const frameEl = hit.closest ? hit.closest(".ten-frame") : null;
        if (!frameEl) return null;
        const targetSide = frameEl.dataset.side;
        const targetSlotIdx =
          slotEl && slotEl.dataset.side === targetSide ? Number(slotEl.dataset.index) : -1;
        return { frameEl: frameEl, side: targetSide, slotIdx: targetSlotIdx };
      }

      function onMove(ev) {
        if (ev.pointerId !== pointerId) return;
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) > 8) moved = true;

        ghost.style.left = ev.clientX + "px";
        ghost.style.top = ev.clientY + "px";

        els.tenFrameLeft.classList.remove("is-drop-ready");
        els.tenFrameRight.classList.remove("is-drop-ready");

        const target = getTargetFrame(ev.clientX, ev.clientY);
        if (target) {
          const arr = target.side === "left" ? state.hintLeft : state.hintRight;
          if (arr.indexOf(null) !== -1) {
            target.frameEl.classList.add("is-drop-ready");
          }
        }
      }

      function cleanup() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        els.tenFrameLeft.classList.remove("is-drop-ready");
        els.tenFrameRight.classList.remove("is-drop-ready");
        dotEl.classList.remove("is-dragging-source");
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }

      function onUp(ev) {
        if (ev.pointerId !== pointerId) return;
        ev.preventDefault();
        const elapsed = Date.now() - startTime;
        const target = getTargetFrame(ev.clientX, ev.clientY);
        cleanup();

        if (!moved && elapsed < 260) {
          const otherSide = side === "left" ? "right" : "left";
          moveAddDotBetween(side, idx, otherSide, -1);
          return;
        }

        if (target) {
          if (target.side === side && target.slotIdx === idx) return;
          moveAddDotBetween(side, idx, target.side, target.slotIdx);
        }
      }

      function onCancel(ev) {
        if (ev.pointerId !== pointerId) return;
        cleanup();
      }

      document.addEventListener("pointermove", onMove, { passive: false });
      document.addEventListener("pointerup", onUp, { passive: false });
      document.addEventListener("pointercancel", onCancel, { passive: false });
    });
  }

  /* ========================================================================
     スタート画面 サンプルカードめくり（ペラッと 510ms）
     ======================================================================== */
  function flipDemoCard() {
    if (els.demoCardBtn.classList.contains("is-flipping-out")) return;
    global.SoundFX.unlock();
    global.SoundFX.playFlip();

    els.demoRing.classList.add("is-clicking");
    els.demoCardBtn.classList.add("is-flipping-out");

    const samples = getDemoSamples();
    setTimeout(function () {
      state.demoIndex = (state.demoIndex + 1) % samples.length;
      els.demoEquation.textContent = samples[state.demoIndex];
      els.demoCardBtn.classList.remove("is-flipping-out");
      els.demoCardBtn.classList.add("is-entering");
      els.demoRing.classList.remove("is-clicking");
      setTimeout(function () {
        els.demoCardBtn.classList.remove("is-entering");
      }, 260);
    }, 510);
  }

  /* ========================================================================
     手書き枠のモード判定（通常2桁 vs しょう・あまり）
     ======================================================================== */
  function isRemainderInputMode() {
    if (state.japanChallenge) {
      return state.japanChallenge.assignedType === "div_rem";
    }
    return state.selectedMode === "div" && (state.activeDivKind === "rem" || state.activeDivKind === "mix");
  }

  function configureInputSlots() {
    const remMode = isRemainderInputMode();
    const activeMode = state.japanChallenge
      ? state.japanChallenge.assignedType
      : state.selectedMode;
    const isPlaceColored = !remMode && (activeMode === "add" || activeMode === "sub");

    if (els.answerBoard) {
      els.answerBoard.classList.toggle("is-place-colored", isPlaceColored);
    }

    if (remMode) {
      els.labelSlotLeft.textContent = "こたえ（しょう）";
      els.watermarkLeft.textContent = "こたえ";
      els.labelSlotRight.textContent = "あまり";
      els.watermarkRight.textContent = "あまり";
      els.divRemSeparator.hidden = false;
    } else {
      els.labelSlotLeft.textContent = "じゅうの くらい";
      els.watermarkLeft.textContent = "じゅう";
      els.labelSlotRight.textContent = "いちの くらい";
      els.watermarkRight.textContent = "いち";
      els.divRemSeparator.hidden = true;
    }
  }

  /* ========================================================================
     クイズ進行
     ======================================================================== */
  function startSession(customDeck, japanCtx) {
    global.SoundFX.unlock();
    const isCustom = Boolean(customDeck && customDeck.length);
    state.isRetryOnlySession = isCustom;

    if (japanCtx) {
      state.japanChallenge = japanCtx;
    } else if (!isCustom) {
      state.japanChallenge = null;
    }

    if (isCustom) {
      state.deck = customDeck.slice();
    } else if (state.japanChallenge) {
      const jt = state.japanChallenge.assignedType;
      if (jt === "add") {
        state.deck = global.MathCards.generateDeck({ mode: "add", count: 10, regroupFilter: "mix" });
      } else if (jt === "sub") {
        state.deck = global.MathCards.generateDeck({ mode: "sub", count: 10, regroupFilter: "mix" });
      } else if (jt === "mul") {
        state.deck = global.MathCards.generateDeck({ mode: "mul", mulKind: "all_rand" });
      } else if (jt === "div_exact") {
        state.deck = global.MathCards.generateDeck({ mode: "div", count: 10, divKind: "exact" });
      } else {
        state.deck = global.MathCards.generateDeck({ mode: "div", count: 10, divKind: "rem" });
      }
    } else if (state.selectedMode === "mul") {
      if (!isMulSelectionReady()) {
        openMulModal();
        return;
      }
      state.activeMulKind = state.mulKind;
      state.activeMulCourseKey = getMulCourseKey(state.mulKind, state.mulTable, state.mulOrder);
      state.deck = global.MathCards.generateDeck({
        mode: "mul",
        mulKind: state.mulKind,
        mulTable: state.mulTable,
        mulOrder: state.mulOrder,
        mulTables: state.mulCustomTables,
      });
      state.activeMulTablesLabel = state.deck.selectedTables
        ? state.deck.selectedTables.join("・")
        : "";
    } else if (state.selectedMode === "div") {
      state.activeDivKind = state.selectedDivKind;
      state.deck = global.MathCards.generateDeck({
        mode: "div",
        count: 10,
        divKind: state.selectedDivKind,
      });
    } else {
      state.deck = global.MathCards.generateDeck({
        mode: state.selectedMode,
        count: 10,
        regroupFilter: state.selectedRegroup,
        subLevel: state.selectedSubLevel,
      });
    }

    state.currentIndex = 0;
    state.streak = 0;
    state.maxCombo = 0;
    state.records = [];
    state.isTransitioning = false;

    if (state.japanChallenge) {
      els.modePill.textContent = "🗾 " + state.japanChallenge.pref.name + "（10もん）";
    } else {
      const modeName =
        state.selectedMode === "sub"
          ? "ひきざん"
          : state.selectedMode === "mul"
            ? "かけざん"
            : state.selectedMode === "div"
              ? "わりざん"
              : "たしざん";
      const extraTables =
        state.selectedMode === "mul" && state.activeMulTablesLabel && !isCustom
          ? " [" + state.activeMulTablesLabel + "のだん]"
          : "";
      els.modePill.textContent = modeName + extraTables + " " + state.deck.length + "もん";
    }

    els.comboStage.innerHTML = "";
    els.animalParade.innerHTML = "";
    els.streakBadge.hidden = true;

    configureInputSlots();
    showScreen("quiz");
    loadCurrentCard(false);
  }

  function getDefaultQuizPrompt() {
    if (isRemainderInputMode()) {
      const isMix = !state.japanChallenge && state.selectedMode === "div" && state.activeDivKind === "mix";
      return isMix
        ? "ひだりに「こたえ」、みぎに「あまり」（わりきれるときは あまり空欄OK！）"
        : "ひだりに「こたえ（しょう）」、みぎに「あまり」を かいてね！";
    }
    return "ゆび や ペンで こたえを かいてね！";
  }

  function loadCurrentCard(withEnterAnim) {
    if (wrongStampTimer) {
      clearTimeout(wrongStampTimer);
      wrongStampTimer = null;
    }

    const card = state.deck[state.currentIndex];
    const total = state.deck.length;

    state.currentAttempts = 0;
    state.currentFirstAnswer = null;
    state.currentUsedHint = false;
    closeHintBoard(false);
    els.hintTriggerRow.hidden = true;

    els.questionCounter.textContent = (state.currentIndex + 1) + " もんめ / " + total + " もん";
    els.cardNumTag.textContent = "No." + (state.currentIndex + 1);
    els.cardEquation.textContent = card.expression + " ＝";

    els.cardStamp.hidden = true;
    els.cardStamp.className = "card-feedback-stamp";

    const remaining = total - state.currentIndex - 1;
    els.cardUnder1.hidden = remaining < 1;
    els.cardUnder2.hidden = remaining < 2;

    if (withEnterAnim) {
      els.activeCard.classList.add("is-entering");
      setTimeout(function () {
        els.activeCard.classList.remove("is-entering");
      }, 260);
    }

    padTens.clear();
    padOnes.clear();
    setHelperMessage(getDefaultQuizPrompt(), "normal");
    els.btnSubmit.disabled = false;
    state.isTransitioning = false;
    state.cardStartTime = Date.now();
    renderProgressDots();
  }

  function setHelperMessage(text, mode) {
    els.helperBanner.textContent = text;
    els.helperBanner.classList.remove("is-warn", "is-zero-warn");
    if (mode === "warn") {
      void els.helperBanner.offsetWidth;
      els.helperBanner.classList.add("is-warn");
    } else if (mode === "zero") {
      void els.helperBanner.offsetWidth;
      els.helperBanner.classList.add("is-zero-warn");
    }
  }

  function checkDigitTolerance(pred, expectedDigit) {
    if (!pred) return false;
    if (pred.digit === expectedDigit) return true;
    if (pred.confidence < 0.60 && pred.probs[expectedDigit] >= 0.26) {
      return true;
    }
    return false;
  }

  function showWrongAttempt(stampMsg, helperMsg, helperMode) {
    state.streak = 0;
    els.streakBadge.hidden = true;
    global.SoundFX.playWrong();

    els.stampMark.textContent = "×";
    els.stampText.textContent = stampMsg;
    els.cardStamp.className = "card-feedback-stamp is-wrong";
    els.cardStamp.hidden = false;

    setHelperMessage(helperMsg, helperMode || "warn");

    if (!state.hintOpen) {
      els.hintTriggerRow.hidden = false;
    }

    if (wrongStampTimer) clearTimeout(wrongStampTimer);
    wrongStampTimer = setTimeout(function () {
      els.cardStamp.hidden = true;
    }, 950);

    els.btnSubmit.disabled = false;
    state.isTransitioning = false;
  }

  function handleSubmit() {
    if (state.isTransitioning) return;
    global.SoundFX.unlock();

    const tensPred = padTens.recognizeNow();
    const onesPred = padOnes.recognizeNow();
    const card = state.deck[state.currentIndex];
    const remMode = isRemainderInputMode();

    let isCorrect = false;
    let firstAnswerText = "";

    if (remMode) {
      // 「こたえ（しょう）」＋「あまり」モード
      if (!tensPred && !onesPred) {
        setHelperMessage("✏️ ひだりの「こたえ（しょう）」を かいてね！", "warn");
        return;
      }
      if (!tensPred) {
        setHelperMessage("👈 ひだりの「こたえ（しょう）」も かいてね！", "warn");
        return;
      }
      if (tensPred.digit === 0) {
        state.currentAttempts++;
        if (state.currentFirstAnswer === null) {
          state.currentFirstAnswer = "0" + (onesPred ? "あまり" + onesPred.digit : "");
        }
        showWrongAttempt(
          "0は つかわないよ！",
          "🚫 こたえ（しょう）に「0」は いらないよ！ けして もういちど こたえてね",
          "zero"
        );
        return;
      }
      if (card.hasRemainder && !onesPred) {
        setHelperMessage("👉 みぎの「あまり」も かいてね！", "warn");
        return;
      }

      const qVal = tensPred.digit;
      const rVal = onesPred ? onesPred.digit : 0;
      firstAnswerText = onesPred ? qVal + " あまり " + rVal : String(qVal);

      if (onesPred && rVal >= card.b) {
        state.currentAttempts++;
        if (state.currentFirstAnswer === null) {
          state.currentFirstAnswer = firstAnswerText;
        }
        showWrongAttempt(
          "あまりがおおきいよ！",
          "🚫 あまり（" + rVal + "）が わるかず（" + card.b + "）より おおきいよ！ まだ わけられるね",
          "zero"
        );
        return;
      }

      const qOk = checkDigitTolerance(tensPred, card.answer);
      const rOk = card.hasRemainder
        ? Boolean(onesPred) && checkDigitTolerance(onesPred, card.remainder)
        : !onesPred || checkDigitTolerance(onesPred, 0);

      isCorrect = qOk && rOk;
      state.currentAttempts++;

      if (!isCorrect) {
        if (state.currentFirstAnswer === null) {
          state.currentFirstAnswer = firstAnswerText;
        }
        const msg =
          !card.hasRemainder && onesPred && rVal > 0 && qOk
            ? "🤔 このもんだいは あまりがない（わりきれる）よ！ あまりを けしてみてね"
            : "🤔 ん？ もういちど けいさんしてみよう！（ヒントボタンも つかえるよ）";
        showWrongAttempt("もういちど！", msg, "warn");
        return;
      }
    } else {
      // 通常（じゅうのくらい・いちのくらい）モード
      if (!tensPred && !onesPred) {
        setHelperMessage("✏️ わくの なかに こたえの すうじを かいてね！", "warn");
        return;
      }
      if (tensPred && !onesPred) {
        setHelperMessage("👉 いちの くらい も かいてね！（ひとけたの こたえは みぎの わくだよ）", "warn");
        return;
      }
      if (tensPred && tensPred.digit === 0) {
        state.currentAttempts++;
        if (state.currentFirstAnswer === null) {
          state.currentFirstAnswer = "0" + onesPred.digit;
        }
        showWrongAttempt(
          "0は いらないよ！",
          "🚫 じゅうの くらいの「0」は いらないよ！ けして もういちど こたえてね",
          "zero"
        );
        return;
      }

      const tensVal = tensPred ? tensPred.digit : 0;
      const onesVal = onesPred.digit;
      const rawUserAnswer = tensPred ? tensVal * 10 + onesVal : onesVal;

      isCorrect = rawUserAnswer === card.answer;
      let displayUserAnswer = rawUserAnswer;

      if (!isCorrect) {
        const expTens = Math.floor(card.answer / 10);
        const expOnes = card.answer % 10;
        const tensOk =
          expTens === 0
            ? !tensPred
            : tensPred && checkDigitTolerance(tensPred, expTens);
        const onesOk = checkDigitTolerance(onesPred, expOnes);

        if (tensOk && onesOk) {
          isCorrect = true;
          displayUserAnswer = card.answer;
        }
      }

      state.currentAttempts++;

      if (!isCorrect) {
        if (state.currentFirstAnswer === null) {
          state.currentFirstAnswer = String(displayUserAnswer);
        }
        showWrongAttempt(
          "もういちど！",
          "🤔 ん？ もういちど けいさんしてみよう！（ヒントボタンも つかえるよ）",
          "warn"
        );
        return;
      }
    }

    // 正解！
    if (wrongStampTimer) {
      clearTimeout(wrongStampTimer);
      wrongStampTimer = null;
    }

    state.isTransitioning = true;
    els.btnSubmit.disabled = true;

    const firstTryCorrect = state.currentAttempts === 1;
    const elapsedMs = Date.now() - state.cardStartTime;
    const correctDisplay = card.hasRemainder
      ? card.answer + " あまり " + card.remainder
      : String(card.answer);

    state.records.push({
      card: card,
      userAnswer: firstTryCorrect ? correctDisplay : state.currentFirstAnswer,
      finalAnswer: correctDisplay,
      isCorrect: firstTryCorrect,
      attempts: state.currentAttempts,
      usedHint: state.currentUsedHint,
      elapsedMs: elapsedMs,
    });

    global.SoundFX.playPingPong();
    els.stampMark.textContent = "◯";
    els.stampText.textContent = firstTryCorrect ? "せいかい！" : "せいかい！ よくがんばったね！";
    els.cardStamp.className = "card-feedback-stamp is-correct";
    els.cardStamp.hidden = false;

    if (firstTryCorrect) {
      state.streak++;
      if (state.streak > state.maxCombo) {
        state.maxCombo = state.streak;
      }
      if (state.streak >= 2) {
        els.streakBadge.textContent = "🔥 " + state.streak + " れんぞく";
        els.streakBadge.hidden = false;
        spawnComboPopup(state.streak);
      }
      const firstTryTotal = state.records.filter(function (r) { return r.isCorrect; }).length;
      addCheeringAnimal(firstTryTotal);
    }

    renderProgressDots();

    setTimeout(function () {
      flipToNextCard();
    }, 640);
  }

  function flipToNextCard() {
    global.SoundFX.playFlip();
    els.quizRing.classList.add("is-clicking");
    els.activeCard.classList.add("is-flipping-out");

    setTimeout(function () {
      els.activeCard.classList.remove("is-flipping-out");
      els.quizRing.classList.remove("is-clicking");

      state.currentIndex++;
      if (state.currentIndex >= state.deck.length) {
        showResults();
      } else {
        loadCurrentCard(true);
      }
    }, 510);
  }

  /* ========================================================================
     結果発表画面
     ======================================================================== */
  function showResults() {
    closeHintBoard(false);
    const analysis = global.MathCards.analyzeResults(state.records);
    const isPerfectRun = analysis.correctCount === analysis.total && analysis.total >= 9;

    let sugorokuOutcome = null;
    let boardKind = "saiki";

    els.resultMulAward.hidden = true;
    els.btnResultMap.hidden = true;
    state.justArrivedOnResult = false;

    if (!state.isRetryOnlySession) {
      if (state.japanChallenge) {
        const pref = state.japanChallenge.pref;
        const updated = global.ProgressStore.recordJapanPrefResult(pref.id, isPerfectRun);
        const jpStats = global.ProgressStore.getJapanStats(updated);
        els.resultMulAward.hidden = false;
        els.resultMulAward.textContent = jpStats.allCleared
          ? "🏆 47都道府県 ぜんぶ せいは！！ 日本一周おめでとう！！"
          : (isPerfectRun ? "👑 " : "🌸 ") +
            pref.name + " クリア！（日本せいは：" + jpStats.clearedCount + " / 47県）";
        refreshProgressUI();
      } else if (state.selectedMode === "mul") {
        const updated = global.ProgressStore.recordMulCourseResult(
          state.activeMulCourseKey,
          isPerfectRun
        );
        const isPickSpecial =
          state.activeMulKind === "pick3_auto" ||
          state.activeMulKind === "pick3_user" ||
          state.activeMulKind === "pick5_auto" ||
          state.activeMulKind === "pick5_user";

        els.resultMulAward.hidden = false;
        if (state.activeMulKind === "table") {
          const tStatus = global.ProgressStore.getTableMasterStatus(updated, state.mulTable);
          if (tStatus.isPerfectMaster) {
            els.resultMulAward.textContent = "👑🎖️ " + state.mulTable + "のだん カンペキマスター 達成！！";
          } else if (tStatus.isMaster) {
            els.resultMulAward.textContent = "🌸🎖️ " + state.mulTable + "のだん マスター 達成！";
          } else {
            els.resultMulAward.textContent =
              (isPerfectRun ? "👑 1ぱつクリア！" : "🌸 クリア！") +
              "（" + state.mulTable + "のだん：" + tStatus.clearedCount + "/3）";
          }
        } else if (isPickSpecial && isPerfectRun) {
          els.resultMulAward.textContent = "👑🎖️ 1ぱつごうかくメダル ゲット！！";
        } else {
          els.resultMulAward.textContent = isPerfectRun
            ? "👑 1ぱつクリア すごい！"
            : "🌸 コースクリア！ つぎは 1ぱつクリアを めざそう！";
        }

        if (state.activeMulKind === "all_rand" && isPerfectRun) {
          sugorokuOutcome = global.ProgressStore.recordOitaOneShotClear();
          boardKind = "oita";
        }
        refreshProgressUI();
      } else if (state.selectedMode === "div") {
        const updated = global.ProgressStore.recordDivCourseResult(
          state.activeDivKind,
          isPerfectRun
        );
        const dMaster = global.ProgressStore.getDivMasterStatus(updated);
        els.resultMulAward.hidden = false;
        if (dMaster.isPerfectMaster) {
          els.resultMulAward.textContent = "👑🎖️ わりざんマスター 達成！！（3つぜんぶ👑！）";
        } else {
          els.resultMulAward.textContent =
            (isPerfectRun ? "👑 1ぱつクリア！" : "🌸 クリア！") +
            "（わりざん👑：" + dMaster.perfectCount + "/3）";
        }

        if (state.activeDivKind === "mix" && isPerfectRun) {
          sugorokuOutcome = global.ProgressStore.recordKyushuOneShotClear();
          boardKind = "kyushu";
        }
        refreshProgressUI();
      } else if (analysis.total >= 10) {
        sugorokuOutcome = global.ProgressStore.recordSessionClear(isPerfectRun);
        boardKind = "saiki";
        refreshProgressUI();
      }
    }

    els.resultBadge.textContent = analysis.badge;
    els.resultScoreNum.textContent = String(analysis.correctCount);
    els.resultScoreDenom.textContent = "/ " + analysis.total + " もん（1かいめ せいかい）";
    els.resultHeadline.textContent = analysis.headline;
    els.statMaxCombo.textContent = String(state.maxCombo);
    els.statAvgSec.textContent = analysis.avgSec.toFixed(1);
    els.resultAdvice.textContent = analysis.advice;
    els.resultListTitle.textContent = "📝 " + analysis.total + "もんの けっか いちらん";

    if (sugorokuOutcome) {
      state.justArrivedOnResult = true;
      els.btnResultMap.hidden = false;
      const st = sugorokuOutcome.arrivedStation;

      if (boardKind === "oita" && sugorokuOutcome.justUnlocked) {
        els.resultSugorokuText.textContent =
          "🎉 ひみつの「おおいたけん 1しゅう すごろく」が でたよ！！（" + st.icon + st.name + "へ！）";
      } else if (boardKind === "kyushu" && sugorokuOutcome.justUnlocked) {
        els.resultSugorokuText.textContent =
          "🎉 ひみつの「きゅうしゅう・おきなわ 1しゅう すごろく」が でたよ！！（" + st.icon + st.name + "へ！）";
      } else if (boardKind === "kyushu" && sugorokuOutcome.justUnlockedJapan) {
        els.resultSugorokuText.textContent =
          "🏆 九州・沖縄ゴール！！ 🗾「日本一周 計算の旅」が かいほうされたよ！！";
      } else if (sugorokuOutcome.completedLap) {
        const areaName =
          boardKind === "oita" ? "おおいたけん" : boardKind === "kyushu" ? "きゅうしゅう・おきなわ" : "さいきし";
        els.resultSugorokuText.textContent =
          "🏆 " + areaName + " 1しゅう ゴール！！ おめでとう！（すごろくを みる）";
      } else {
        els.resultSugorokuText.textContent =
          "🗺️ " + st.icon + "「" + st.name + "」に とうちゃく！🌸" +
          (isPerfectRun ? "＋👑" : "") + "（すごろくを みる）";
      }
    }

    els.carryBreakdown.innerHTML = "";
    if (!state.japanChallenge && state.selectedMode !== "mul") {
      if (analysis.noRegroupStats.total > 0) {
        const c1 = document.createElement("span");
        c1.className = "carry-chip";
        c1.textContent =
          analysis.regroupWord + " なし：" +
          analysis.noRegroupStats.correct + "/" + analysis.noRegroupStats.total;
        els.carryBreakdown.appendChild(c1);
      }
      if (analysis.withRegroupStats.total > 0) {
        const c2 = document.createElement("span");
        c2.className = "carry-chip";
        c2.textContent =
          analysis.regroupWord + " あり：" +
          analysis.withRegroupStats.correct + "/" + analysis.withRegroupStats.total;
        els.carryBreakdown.appendChild(c2);
      }
    }

    els.resultTbody.innerHTML = "";
    state.records.forEach(function (rec, idx) {
      const tr = document.createElement("tr");
      if (!rec.isCorrect) tr.className = "row-wrong";

      const tdIdx = document.createElement("td");
      tdIdx.textContent = String(idx + 1);

      const tdEq = document.createElement("td");
      tdEq.textContent = rec.card.expression;

      const tdUser = document.createElement("td");
      tdUser.textContent = String(rec.userAnswer);

      const tdAns = document.createElement("td");
      tdAns.textContent = String(rec.finalAnswer);

      const tdRes = document.createElement("td");
      if (rec.isCorrect) {
        tdRes.className = "mark-ok";
        tdRes.textContent = "◯";
      } else {
        tdRes.className = "mark-retry";
        tdRes.textContent = rec.usedHint ? "💡やりなおし" : "やりなおし";
      }

      tr.appendChild(tdIdx);
      tr.appendChild(tdEq);
      tr.appendChild(tdUser);
      tr.appendChild(tdAns);
      tr.appendChild(tdRes);
      els.resultTbody.appendChild(tr);
    });

    els.btnRetryAllLabel.textContent = "🔁 もういちど " + state.deck.length + "もん！";
    els.btnResultPickMul.hidden = Boolean(state.japanChallenge) || state.selectedMode !== "mul";
    els.btnResultToJapan.hidden = !state.japanChallenge;

    if (analysis.wrongCards.length > 0) {
      els.btnRetryWrong.hidden = false;
      els.btnRetryWrong.textContent =
        "💪 まちがえた " + analysis.wrongCards.length + "もんだけ！";
    } else {
      els.btnRetryWrong.hidden = true;
    }

    els.perfectFrameTop.hidden = !isPerfectRun;
    els.perfectFrameBottom.hidden = !isPerfectRun;

    showScreen("result");
    renderProgressDots();

    if (isPerfectRun || (sugorokuOutcome && sugorokuOutcome.completedLap)) {
      spawnConfetti();
      global.SoundFX.playFanfare();
    }
  }

  /* ========================================================================
     初期化
     ======================================================================== */
  function init() {
    cacheDom();
    installSafariGuards();
    updateOrientationLock();

    window.addEventListener("resize", updateOrientationLock);
    window.addEventListener("orientationchange", function () {
      setTimeout(updateOrientationLock, 80);
    });

    padTens = new global.DigitPad({
      canvas: els.canvasTens,
      bubbleEl: els.bubbleTens,
      placeholderText: "ここに かいてね",
      disallowZero: true,
    });

    padOnes = new global.DigitPad({
      canvas: els.canvasOnes,
      bubbleEl: els.bubbleOnes,
      placeholderText: "ここに かいてね",
    });

    // スタート画面コース選択
    bindReliableTap(els.btnModeAdd, function () {
      state.selectedMode = "add";
      updateModeSelectionUI();
    });

    bindReliableTap(els.btnModeSub, function () {
      state.selectedMode = "sub";
      updateModeSelectionUI();
    });

    bindReliableTap(els.btnModeMul, function () {
      state.selectedMode = "mul";
      updateModeSelectionUI();
      openMulModal();
    });

    bindReliableTap(els.btnModeDiv, function () {
      state.selectedMode = "div";
      updateModeSelectionUI();
    });

    [els.btnDivExact, els.btnDivRem, els.btnDivMix].forEach(function (btn) {
      bindReliableTap(btn, function () {
        state.selectedDivKind = btn.dataset.div;
        updateModeSelectionUI();
      });
    });

    bindReliableTap(els.btnOpenMulModal, openMulModal);
    bindReliableTap(els.btnCloseMul, closeMulModal);
    bindReliableTap(els.btnMulStart, function () {
      if (!isMulSelectionReady()) return;
      els.modalMul.hidden = true;
      updateModeSelectionUI();
      startSession();
    });

    [els.btnRegroupNone, els.btnRegroupOnly, els.btnRegroupMix].forEach(function (btn) {
      bindReliableTap(btn, function () {
        state.selectedRegroup = btn.dataset.regroup;
        updateModeSelectionUI();
      });
    });

    [els.btnSubLv1, els.btnSubLv2, els.btnSubLv3].forEach(function (btn) {
      bindReliableTap(btn, function () {
        state.selectedSubLevel = btn.dataset.level;
        updateModeSelectionUI();
      });
    });

    bindReliableTap(els.demoCardBtn, flipDemoCard);
    bindReliableTap(els.btnStart, function () {
      startSession();
    });

    // すごろく専用画面
    bindReliableTap(els.btnOpenMap, function () {
      openMapScreen(state.currentScreen === "result" && state.justArrivedOnResult);
    });
    bindReliableTap(els.btnStartMapPreview, function () {
      openMapScreen(false);
    });
    bindReliableTap(els.btnResultMap, function () {
      openMapScreen(state.justArrivedOnResult);
    });
    bindReliableTap(els.btnMapBack, closeMapScreen);
    bindReliableTap(els.btnMapPlay, function () {
      startSession();
    });

    // 日本一周専用画面＆都道府県ポップアップ
    bindReliableTap(els.btnOpenJapan, openJapanScreen);
    bindReliableTap(els.btnStartJapan, openJapanScreen);
    bindReliableTap(els.btnJapanBack, function () {
      showScreen("start");
      updateModeSelectionUI();
      renderProgressDots();
    });
    bindReliableTap(els.btnClosePref, closePrefModal);
    bindReliableTap(els.btnPrefStart, function () {
      if (!state.modalPrefTarget) return;
      const target = state.modalPrefTarget;
      closePrefModal();
      startSession(null, target);
    });
    bindReliableTap(els.btnResultToJapan, openJapanScreen);

    // 隠し5回タップ：データ引き継ぎモーダル
    bindReliableTap(els.brandTapTarget, handleBrandTap);
    bindReliableTap(els.btnCloseTransfer, closeTransferModal);
    bindReliableTap(els.btnExportJson, handleExportJson);
    if (els.importJsonInput) {
      els.importJsonInput.addEventListener("change", handleImportFileChange);
    }
    bindReliableTap(els.btnResetData, handleResetTap);

    // クイズ画面ボタン
    bindReliableTap(els.btnClearTens, function () {
      global.SoundFX.playErase();
      padTens.clear();
    });

    bindReliableTap(els.btnClearOnes, function () {
      global.SoundFX.playErase();
      padOnes.clear();
    });

    bindReliableTap(els.btnClearAll, function () {
      global.SoundFX.playErase();
      padTens.clear();
      padOnes.clear();
      setHelperMessage("きれいになったよ！ もういちど かいてね", "normal");
    });

    bindReliableTap(els.btnSubmit, handleSubmit);

    bindReliableTap(els.btnShowHint, function () {
      global.SoundFX.unlock();
      openHintBoard();
    });

    bindReliableTap(els.btnCloseHint, function () {
      closeHintBoard(true);
    });

    bindReliableTap(els.btnMulStep, function () {
      const card = state.deck[state.currentIndex];
      if (!card || card.mode !== "mul") return;
      if (state.mulLitRows < card.b) {
        state.mulLitRows++;
        global.SoundFX.playErase();
        renderHintBoard();
      }
    });

    bindReliableTap(els.btnMulResetHint, function () {
      state.mulLitRows = 1;
      global.SoundFX.playErase();
      renderHintBoard();
    });

    bindReliableTap(els.btnDivStep, function () {
      const card = state.deck[state.currentIndex];
      if (!card || card.mode !== "div") return;
      if (state.divGroupsLit < card.answer) {
        state.divGroupsLit++;
        global.SoundFX.playErase();
        renderHintBoard();
      }
    });

    bindReliableTap(els.btnDivResetHint, function () {
      state.divGroupsLit = 0;
      global.SoundFX.playErase();
      renderHintBoard();
    });

    bindReliableTap(els.btnSound, function () {
      const nextMuted = !global.SoundFX.isMuted();
      global.SoundFX.setMuted(nextMuted);
      if (!nextMuted) global.SoundFX.unlock();
      els.btnSound.classList.toggle("is-muted", nextMuted);
      els.soundIcon.textContent = nextMuted ? "🔇" : "🔊";
      els.soundLabel.textContent = nextMuted ? "おと OFF" : "おと ON";
    });

    bindReliableTap(els.btnHome, function () {
      closeHintBoard(false);
      state.japanChallenge = null;
      showScreen("start");
      updateModeSelectionUI();
      renderProgressDots();
    });

    bindReliableTap(els.btnRetryAll, function () {
      startSession(null, state.japanChallenge);
    });

    bindReliableTap(els.btnRetryWrong, function () {
      const wrongCards = state.records
        .filter(function (r) { return !r.isCorrect; })
        .map(function (r) { return r.card; });
      startSession(wrongCards, state.japanChallenge);
    });

    bindReliableTap(els.btnResultPickMul, function () {
      showScreen("start");
      updateModeSelectionUI();
      renderProgressDots();
      openMulModal();
    });

    updateModeSelectionUI();
    showScreen("start");
    renderProgressDots();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
