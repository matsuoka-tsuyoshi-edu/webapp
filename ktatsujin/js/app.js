/**
 * てがき けいさんカード — Main Application Controller (v0.3.0)
 * Addition & Subtraction (with carry/borrow & sub-levels),
 * Interactive 10-frame hints, Saiki City Sugoroku Map, and 5-tap JSON backup.
 */
(function (global) {
  "use strict";

  const ANIMALS = ["🐶", "🐱", "🐰", "🐻", "🐼", "🐨", "🦊", "🐯", "🦁", "🦄"];

  const state = {
    selectedMode: "add",       // 'add' | 'sub'
    selectedRegroup: "mix",    // 'none' | 'only' | 'mix'
    selectedSubLevel: "lv1",   // 'lv1' | 'lv2' | 'lv3'
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
    hintLeft: [],     // for add: ('a'|'b'|null)[10]; for sub: ({active:boolean}|null)[10]
    hintRight: [],
  };

  let padTens = null;
  let padOnes = null;
  let wrongStampTimer = null;

  // 隠し5回タップ・リセット2段階確認用
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

    els.demoCardBtn = document.getElementById("demo-card-btn");
    els.demoRing = document.getElementById("demo-ring");
    els.demoEquation = document.getElementById("demo-equation");
    els.btnModeAdd = document.getElementById("btn-mode-add");
    els.btnModeSub = document.getElementById("btn-mode-sub");
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
    els.btnStartMapPreview = document.getElementById("btn-start-map-preview");
    els.startLapBadge = document.getElementById("start-lap-badge");
    els.startMiniTrack = document.getElementById("start-mini-track");
    els.startMiniStatus = document.getElementById("start-mini-status");
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
    els.tenWrapLeft = document.getElementById("ten-wrap-left");
    els.tenWrapRight = document.getElementById("ten-wrap-right");
    els.tenFrameOp = document.getElementById("ten-frame-op");
    els.tenFrameLeft = document.getElementById("ten-frame-left");
    els.tenFrameRight = document.getElementById("ten-frame-right");
    els.tenCountLeft = document.getElementById("ten-count-left");
    els.tenCountRight = document.getElementById("ten-count-right");

    els.celebrationZone = document.getElementById("celebration-zone");
    els.comboStage = document.getElementById("combo-stage");
    els.animalParade = document.getElementById("animal-parade");

    els.helperBanner = document.getElementById("helper-banner");
    els.bubbleTens = document.getElementById("bubble-tens");
    els.bubbleOnes = document.getElementById("bubble-ones");
    els.canvasTens = document.getElementById("canvas-tens");
    els.canvasOnes = document.getElementById("canvas-ones");
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
    els.resultAdvice = document.getElementById("result-advice");
    els.carryBreakdown = document.getElementById("carry-breakdown");
    els.resultTbody = document.getElementById("result-tbody");
    els.btnRetryAll = document.getElementById("btn-retry-all");
    els.btnRetryWrong = document.getElementById("btn-retry-wrong");

    els.btnMapBack = document.getElementById("btn-map-back");
    els.btnMapPlay = document.getElementById("btn-map-play");
    els.sugorokuBoard = document.getElementById("sugoroku-board");
    els.mapStatsPill = document.getElementById("map-stats-pill");

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
    let activeId = null;
    let lastHandledAt = 0;

    btn.addEventListener("pointerdown", function (e) {
      if (btn.disabled) return;
      activeId = e.pointerId;
    });

    document.addEventListener("pointerup", function (e) {
      if (activeId === null || e.pointerId !== activeId) return;
      activeId = null;
      if (btn.disabled) return;

      const rect = btn.getBoundingClientRect();
      const pad = 14;
      const inside =
        e.clientX >= rect.left - pad &&
        e.clientX <= rect.right + pad &&
        e.clientY >= rect.top - pad &&
        e.clientY <= rect.bottom + pad;

      if (inside) {
        lastHandledAt = Date.now();
        handler(e);
      }
    });

    document.addEventListener("pointercancel", function (e) {
      if (e.pointerId === activeId) {
        activeId = null;
      }
    });

    btn.addEventListener("click", function (e) {
      if (Date.now() - lastHandledAt < 450) return;
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
     スタート画面のモード・難易度UI同期
     ======================================================================== */
  function getDemoSamples() {
    if (state.selectedMode === "add") {
      if (state.selectedRegroup === "none") return ["3 ＋ 4 ＝", "2 ＋ 6 ＝", "5 ＋ 3 ＝"];
      if (state.selectedRegroup === "only") return ["8 ＋ 7 ＝", "9 ＋ 5 ＝", "6 ＋ 8 ＝"];
      return ["3 ＋ 4 ＝", "8 ＋ 7 ＝", "5 ＋ 9 ＝"];
    }
    if (state.selectedRegroup === "none") {
      if (state.selectedSubLevel === "lv1") return ["8 － 3 ＝", "9 － 4 ＝", "7 － 2 ＝"];
      if (state.selectedSubLevel === "lv2") return ["16 － 4 ＝", "18 － 5 ＝", "14 － 3 ＝"];
      return ["8 － 3 ＝", "16 － 4 ＝", "15 － 2 ＝"];
    }
    if (state.selectedRegroup === "only") return ["13 － 5 ＝", "15 － 8 ＝", "12 － 7 ＝"];
    return ["8 － 3 ＝", "13 － 5 ＝", "16 － 4 ＝"];
  }

  function updateModeSelectionUI() {
    const isAdd = state.selectedMode === "add";

    els.btnModeAdd.classList.toggle("is-active", isAdd);
    els.btnModeSub.classList.toggle("is-active", !isAdd);

    if (isAdd) {
      els.labelRegroupNone.textContent = "くりあがり なし";
      els.exRegroupNone.textContent = "れい：3＋4";
      els.labelRegroupOnly.textContent = "くりあがり あり";
      els.exRegroupOnly.textContent = "れい：8＋7";
      els.exRegroupMix.textContent = "3＋4・8＋7";
      els.sublevelRow.hidden = true;
    } else {
      els.labelRegroupNone.textContent = "くりさがり なし";
      els.exRegroupNone.textContent = "れい：8−3・16−4";
      els.labelRegroupOnly.textContent = "くりさがり あり";
      els.exRegroupOnly.textContent = "れい：13−5";
      els.exRegroupMix.textContent = "8−3・13−5";
      els.sublevelRow.hidden = state.selectedRegroup !== "none";
    }

    els.btnRegroupNone.classList.toggle("is-active", state.selectedRegroup === "none");
    els.btnRegroupOnly.classList.toggle("is-active", state.selectedRegroup === "only");
    els.btnRegroupMix.classList.toggle("is-active", state.selectedRegroup === "mix");

    els.btnSubLv1.classList.toggle("is-active", state.selectedSubLevel === "lv1");
    els.btnSubLv2.classList.toggle("is-active", state.selectedSubLevel === "lv2");
    els.btnSubLv3.classList.toggle("is-active", state.selectedSubLevel === "lv3");

    state.demoIndex = 0;
    els.demoEquation.textContent = getDemoSamples()[0];
    els.modePill.textContent = (isAdd ? "たしざん" : "ひきざん") + " 10もん";
  }

  /* ========================================================================
     佐伯市一周すごろくUI更新＆専用画面（スタート + ①〜⑨ + ゴール！）
     ======================================================================== */
  // 6列×2段のスネーク配置座標と進行矢印
  const BOARD_LAYOUT = [
    { col: "1", row: "1", arrowDir: "right", arrowText: "➔" },         // 0: スタート
    { col: "2", row: "1", arrowDir: "right", arrowText: "➔" },         // 1: ①かみうら
    { col: "3", row: "1", arrowDir: "right", arrowText: "➔" },         // 2: ②やよい
    { col: "4", row: "1", arrowDir: "right", arrowText: "➔" },         // 3: ③さいき
    { col: "5", row: "1", arrowDir: "right", arrowText: "➔" },         // 4: ④ほんじょう
    { col: "6", row: "1", arrowDir: "down", arrowText: "⬇" },          // 5: ⑤うめ
    { col: "6", row: "2", arrowDir: "left", arrowText: "⬅" },          // 6: ⑥なおかわ
    { col: "5", row: "2", arrowDir: "left", arrowText: "⬅" },          // 7: ⑦つるみ
    { col: "4", row: "2", arrowDir: "left", arrowText: "⬅" },          // 8: ⑧よのうづ
    { col: "3", row: "2", arrowDir: "left", arrowText: "⬅" },          // 9: ⑨かまえ
    { col: "1 / span 2", row: "2", arrowDir: null, arrowText: "" },     // 10: ゴール！
  ];

  function refreshProgressUI() {
    const data = global.ProgressStore.load();
    const stations = global.ProgressStore.STATIONS;
    const lapNum = data.laps + 1;

    els.topMapLabel.textContent = "すごろく (" + data.step + "/10)";
    els.startLapBadge.textContent = lapNum + "しゅうめ";

    els.startMiniTrack.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const bar = document.createElement("span");
      bar.className = "mini-step-dot";
      if (i < data.step) bar.classList.add("is-cleared");
      else if (i === data.step) bar.classList.add("is-next");
      els.startMiniTrack.appendChild(bar);
    }

    if (data.step === 0) {
      els.startMiniStatus.textContent =
        "🚩 いまは「スタート」！ つぎは「① かみうら」をめざそう！";
    } else if (data.step >= 10) {
      els.startMiniStatus.textContent =
        "🏆 さいきし 1しゅう ゴール！ つぎのチャレンジで " + (lapNum + 1) + "しゅうめへ！";
    } else {
      const nextStation = stations[data.step];
      els.startMiniStatus.textContent =
        "いま「" + stations[data.step - 1].name + "」！ つぎは「" + nextStation.label + "」" + nextStation.icon;
    }
  }

  function renderSugorokuScreen(justArrived) {
    const data = global.ProgressStore.load();
    const startTile = global.ProgressStore.START_TILE;
    const stations = global.ProgressStore.STATIONS;
    const lapNum = data.laps + 1;

    // スタート(index 0) + ①かみうら〜ゴール！(index 1..10) の全11マス
    const allTiles = [startTile].concat(stations);

    els.sugorokuBoard.innerHTML = "";
    allTiles.forEach(function (item, idx) {
      const layout = BOARD_LAYOUT[idx];
      const isStart = idx === 0;
      const isGoal = idx === 10;
      const isCleared = idx >= 1 && idx <= data.step;
      const hasCrown = idx >= 1 && Boolean(data.crowns[idx - 1]);
      const isHere = idx === data.step;

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

      // マス上部の地名バー
      const header = document.createElement("div");
      header.className = "tile-header";
      header.textContent = item.label;
      tile.appendChild(header);

      // マスの中身（アイコン・説明・🌸・👑）
      const body = document.createElement("div");
      body.className = "tile-body";

      const icon = document.createElement("span");
      icon.className = "tile-icon";
      icon.textContent = item.icon;
      body.appendChild(icon);

      const desc = document.createElement("span");
      desc.className = "tile-desc";
      desc.textContent = item.desc;
      body.appendChild(desc);

      const stamps = document.createElement("div");
      stamps.className = "tile-stamps";
      if (isCleared) {
        const sakura = document.createElement("span");
        sakura.className = "stamp-sakura";
        sakura.textContent = "🌸";
        sakura.title = "つうか！";
        stamps.appendChild(sakura);
      }
      if (hasCrown) {
        const crown = document.createElement("span");
        crown.className = "stamp-crown";
        crown.textContent = "👑";
        crown.title = "1かいめで ぜんもんせいかい！";
        stamps.appendChild(crown);
      }
      body.appendChild(stamps);
      tile.appendChild(body);

      // 現在地バッジ
      if (isHere) {
        const here = document.createElement("span");
        here.className = "tile-here-badge";
        here.textContent = "🐰 いまここ！";
        tile.appendChild(here);
      }

      // 次のマスへの矢印
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
      "クリア回数：" + data.totalClears + "かい ／ いま " + lapNum + "しゅうめ（🌸 " + data.step + "/10・👑 " + data.totalPerfects + "こ）";
  }

  function openMapScreen(justArrived) {
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
     隠し5回タップ：データ引き継ぎモーダル
     ======================================================================== */
  function openTransferModal() {
    const data = global.ProgressStore.load();
    els.transferSummary.innerHTML =
      "いまの きろく：<strong>" + (data.laps + 1) + "しゅうめ</strong>（" +
      data.step + " / 10 マス）／ ごうけいクリア：<strong>" + data.totalClears + "かい</strong>（👑 " +
      data.totalPerfects + "こ）";
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
        refreshProgressUI();
        if (state.currentScreen === "map") renderSugorokuScreen(false);
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
    refreshProgressUI();
    if (state.currentScreen === "map") renderSugorokuScreen(false);
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
    els.btnHome.hidden = name === "start";
    els.btnOpenMap.hidden = name === "quiz" || name === "map";
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
     10のかたまり（5×2配列）ヒントボード（たしざん・ひきざん両対応）
     ======================================================================== */
  function initHintForCard(card) {
    state.hintLeft = [];
    state.hintRight = [];

    if (card.mode === "add") {
      for (let i = 0; i < 10; i++) {
        state.hintLeft.push(i < card.a ? "a" : null);
        state.hintRight.push(i < card.b ? "b" : null);
      }
    } else {
      // ひきざん：a個を10のまとまり枠へ並べる
      const leftN = Math.min(10, card.a);
      const rightN = Math.max(0, card.a - 10);
      for (let i = 0; i < 10; i++) {
        state.hintLeft.push(i < leftN ? { active: true } : null);
        state.hintRight.push(i < rightN ? { active: true } : null);
      }
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
     スタート画面 サンプルカードめくり（左中央リング）
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
      }, 240);
    }, 310);
  }

  /* ========================================================================
     クイズ進行
     ======================================================================== */
  function startSession(customDeck) {
    global.SoundFX.unlock();
    const isCustom = Boolean(customDeck && customDeck.length);
    state.isRetryOnlySession = isCustom;

    state.deck = isCustom
      ? customDeck.slice()
      : global.MathCards.generateDeck({
          mode: state.selectedMode,
          count: 10,
          regroupFilter: state.selectedRegroup,
          subLevel: state.selectedSubLevel,
        });

    state.currentIndex = 0;
    state.streak = 0;
    state.maxCombo = 0;
    state.records = [];
    state.isTransitioning = false;

    const modeLabel = (state.selectedMode === "sub" ? "ひきざん " : "たしざん ") + state.deck.length + "もん";
    els.modePill.textContent = modeLabel;
    els.comboStage.innerHTML = "";
    els.animalParade.innerHTML = "";
    els.streakBadge.hidden = true;

    showScreen("quiz");
    loadCurrentCard(false);
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
      }, 250);
    }

    padTens.clear();
    padOnes.clear();
    setHelperMessage("ゆび や ペンで こたえを かいてね！", "normal");
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

    if (!tensPred && !onesPred) {
      setHelperMessage("✏️ わくの なかに こたえの すうじを かいてね！", "warn");
      return;
    }

    if (tensPred && !onesPred) {
      setHelperMessage("👉 いちの くらい も かいてね！（ひとけたの こたえは みぎの わくだよ）", "warn");
      return;
    }

    const card = state.deck[state.currentIndex];

    // 十の位「0」禁止ルール
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

    let isCorrect = rawUserAnswer === card.answer;
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

    // 正解！
    if (wrongStampTimer) {
      clearTimeout(wrongStampTimer);
      wrongStampTimer = null;
    }

    state.isTransitioning = true;
    els.btnSubmit.disabled = true;

    const firstTryCorrect = state.currentAttempts === 1;
    const elapsedMs = Date.now() - state.cardStartTime;

    state.records.push({
      card: card,
      userAnswer: firstTryCorrect ? String(card.answer) : state.currentFirstAnswer,
      finalAnswer: card.answer,
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
    }, 680);
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
    }, 330);
  }

  /* ========================================================================
     結果発表画面
     ======================================================================== */
  function showResults() {
    closeHintBoard(false);
    const analysis = global.MathCards.analyzeResults(state.records);
    const isPerfectTen = analysis.correctCount === analysis.total && analysis.total >= 10;

    // 通常10問セッションなら佐伯市一周すごろくを1マス進める
    let sugorokuOutcome = null;
    if (!state.isRetryOnlySession && analysis.total >= 10) {
      sugorokuOutcome = global.ProgressStore.recordSessionClear(isPerfectTen);
      refreshProgressUI();
    }

    els.resultBadge.textContent = analysis.badge;
    els.resultScoreNum.textContent = String(analysis.correctCount);
    els.resultScoreDenom.textContent = "/ " + analysis.total + " もん（1かいめ せいかい）";
    els.resultHeadline.textContent = analysis.headline;
    els.statMaxCombo.textContent = String(state.maxCombo);
    els.statAvgSec.textContent = analysis.avgSec.toFixed(1);
    els.resultAdvice.textContent = analysis.advice;

    if (sugorokuOutcome) {
      state.justArrivedOnResult = true;
      els.btnResultMap.hidden = false;
      const st = sugorokuOutcome.arrivedStation;
      if (sugorokuOutcome.completedLap) {
        els.resultSugorokuText.textContent =
          "🏆 さいきし 1しゅう ゴール！！ おめでとう！（すごろくを みる）";
      } else {
        els.resultSugorokuText.textContent =
          "🗺️ " + st.icon + "「" + st.name + "」に とうちゃく！🌸" +
          (isPerfectTen ? "＋👑" : "") + "（すごろくを みる）";
      }
    } else {
      state.justArrivedOnResult = false;
      els.btnResultMap.hidden = true;
    }

    els.carryBreakdown.innerHTML = "";
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
      tdAns.textContent = String(rec.card.answer);

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

    if (analysis.wrongCards.length > 0) {
      els.btnRetryWrong.hidden = false;
      els.btnRetryWrong.textContent =
        "💪 まちがえた " + analysis.wrongCards.length + "もんだけ！";
    } else {
      els.btnRetryWrong.hidden = true;
    }

    els.perfectFrameTop.hidden = !isPerfectTen;
    els.perfectFrameBottom.hidden = !isPerfectTen;

    showScreen("result");
    renderProgressDots();

    if (isPerfectTen || (sugorokuOutcome && sugorokuOutcome.completedLap)) {
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

    // すごろく専用画面のナビゲーション
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

    // 隠し5回タップ：データ引き継ぎモーダル
    bindReliableTap(els.brandTapTarget, handleBrandTap);
    bindReliableTap(els.btnCloseTransfer, closeTransferModal);
    bindReliableTap(els.btnExportJson, handleExportJson);
    els.importJsonInput.addEventListener("change", handleImportFileChange);
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
      showScreen("start");
      updateModeSelectionUI();
      refreshProgressUI();
      renderProgressDots();
    });

    bindReliableTap(els.btnRetryAll, function () {
      startSession();
    });

    bindReliableTap(els.btnRetryWrong, function () {
      const wrongCards = state.records
        .filter(function (r) { return !r.isCorrect; })
        .map(function (r) { return r.card; });
      startSession(wrongCards);
    });

    updateModeSelectionUI();
    refreshProgressUI();
    showScreen("start");
    renderProgressDots();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
