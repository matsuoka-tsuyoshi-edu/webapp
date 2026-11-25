/**
 * app.js
 * メインアプリケーション制御（Blockly・スモールステップ・実行・クリア判定・先生モード）
 */
(function () {
  const App = window.TakakukeiApp;
  const STORAGE_KEY = '5nen_takakukei_progress_v1';

  // --- 1. Blockly カスタムブロック定義（Scratch寄せ配色：命令=オレンジ、繰り返し=黄色、数値=緑） ---
  const CMD_ORANGE = '#F97316';
  const CTRL_YELLOW = '#EAB308';
  const NUM_GREEN = '#22A745';

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'move_steps',
      message0: '%1 歩うごかす',
      args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }],
      previousStatement: null,
      nextStatement: null,
      colour: CMD_ORANGE
    },
    {
      type: 'turn_degrees',
      message0: '%1 に %2 度まわす',
      args0: [
        {
          type: 'field_dropdown',
          name: 'DIRECTION',
          options: [
            ['右 ↻', 'RIGHT'],
            ['左 ↺', 'LEFT']
          ]
        },
        { type: 'input_value', name: 'DEGREES', check: 'Number' }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: CMD_ORANGE
    },
    {
      type: 'custom_repeat',
      message0: '%1 回くりかえす %2 %3',
      args0: [
        { type: 'input_value', name: 'TIMES', check: 'Number' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' }
      ],
      previousStatement: null,
      nextStatement: null,
      colour: CTRL_YELLOW
    },
    {
      type: 'pen_down',
      message0: 'ペンを下ろす',
      previousStatement: null,
      nextStatement: null,
      colour: CMD_ORANGE
    },
    {
      type: 'pen_up',
      message0: 'ペンを上げる',
      previousStatement: null,
      nextStatement: null,
      colour: CMD_ORANGE
    }
  ]);

  // --- 2. コード生成器設定（Blockly v9〜v12互換） ---
  const customGenerator = new Blockly.Generator('JS_CUSTOM');
  customGenerator.PRECEDENCE = 0;
  customGenerator.forBlock = customGenerator.forBlock || {};

  function registerBlockGen(type, fn) {
    customGenerator[type] = fn;
    customGenerator.forBlock[type] = fn;
  }

  registerBlockGen('move_steps', function (block) {
    const steps = customGenerator.valueToCode(block, 'STEPS', customGenerator.PRECEDENCE) || '0';
    return 'if (isAborted()) return;\nawait moveSteps(' + steps + ');\n';
  });

  registerBlockGen('turn_degrees', function (block) {
    const dir = block.getFieldValue('DIRECTION');
    const degrees = customGenerator.valueToCode(block, 'DEGREES', customGenerator.PRECEDENCE) || '0';
    const angle = dir === 'RIGHT' ? degrees : '(-(' + degrees + '))';
    return 'if (isAborted()) return;\nawait turnDegrees(' + angle + ');\n';
  });

  registerBlockGen('custom_repeat', function (block) {
    const repeats = customGenerator.valueToCode(block, 'TIMES', customGenerator.PRECEDENCE) || '0';
    const branch = customGenerator.statementToCode(block, 'DO');
    return 'for (let i = 0; i < Math.min(Number(' + repeats + ') || 0, 360); i++) {\n  if (isAborted()) return;\n' + branch + '}\n';
  });

  registerBlockGen('pen_down', function () {
    return 'if (isAborted()) return;\npenDown();\n';
  });

  registerBlockGen('pen_up', function () {
    return 'if (isAborted()) return;\npenUp();\n';
  });

  registerBlockGen('math_number', function (block) {
    const rawVal = block.getFieldValue('NUM');
    return [String(rawVal), customGenerator.PRECEDENCE];
  });

  customGenerator.scrub_ = function (block, code, thisOnly) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    if (nextBlock && !thisOnly) {
      return code + customGenerator.blockToCode(nextBlock);
    }
    return code;
  };

  // --- 3. DOM要素の取得 ---
  const stepNavEl = document.getElementById('stepNav');
  const missionBadgeEl = document.getElementById('missionBadge');
  const missionTitleEl = document.getElementById('missionTitle');
  const missionDescEl = document.getElementById('missionDesc');
  const runBtn = document.getElementById('runBtn');
  const resetBtn = document.getElementById('resetBtn');
  const explainBtn = document.getElementById('explainBtn');
  const hintBtn = document.getElementById('hintBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const penCheckbox = document.getElementById('alwaysPenDown');
  const penCard = document.getElementById('penOptionCard');
  const guideCheckbox = document.getElementById('showGuideCheck');
  const angleCheckbox = document.getElementById('showAngleCheck');
  const feedbackEl = document.getElementById('stageFeedback');
  const penDotEl = document.getElementById('penStatusDot');
  const penStatusTextEl = document.getElementById('penStatusText');
  const angleStatusTextEl = document.getElementById('angleStatusText');

  // モーダル要素
  const clearModal = document.getElementById('clearModal');
  const clearTitleEl = document.getElementById('clearModalTitle');
  const clearMsgEl = document.getElementById('clearModalMessage');
  const unlockBannerEl = document.getElementById('unlockBanner');
  const nextStepBtn = document.getElementById('nextStepBtn');
  const closeClearBtn = document.getElementById('closeClearBtn');

  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const installAppRow = document.getElementById('installAppRow');
  const installAppBtn = document.getElementById('installAppBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const teacherUnlockBtn = document.getElementById('teacherUnlockBtn');
  const resetProgressBtn = document.getElementById('resetProgressBtn');
  const netStatusLabel = document.getElementById('netStatusLabel');

  const infoModal = document.getElementById('infoModal');
  const infoTitleEl = document.getElementById('infoModalTitle');
  const infoBodyEl = document.getElementById('infoModalBody');
  const closeInfoBtn = document.getElementById('closeInfoBtn');
  const okInfoBtn = document.getElementById('okInfoBtn');

  // --- 4. 状態管理 ---
  let progress = loadProgress();
  let currentStepId = progress.currentStepId || 1;
  let isRunning = false;
  let feedbackTimer = null;
  let preferredAlwaysPenDown = true;

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          cleared: Array.isArray(parsed.cleared) ? parsed.cleared : [],
          teacherUnlock: !!parsed.teacherUnlock,
          currentStepId: Number(parsed.currentStepId) || 1
        };
      }
    } catch (e) {}
    return { cleared: [], teacherUnlock: false, currentStepId: 1 };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cleared: progress.cleared,
        teacherUnlock: progress.teacherUnlock,
        currentStepId: currentStepId
      }));
    } catch (e) {}
  }

  function isStepUnlocked(step) {
    if (progress.teacherUnlock) return true;
    if (!step.isSecret) return true;
    return progress.cleared.includes(step.unlockAfter);
  }

  function getStepById(id) {
    return App.STEPS.find((s) => s.id === id) || App.STEPS[0];
  }

  // --- 5. Blockly 初期化（子どもがつまみやすい大きめサイズ・テーマ） ---
  const kidsLargeTheme = Blockly.Theme.defineTheme('kidsLargeTheme', {
    base: Blockly.Themes.Classic,
    blockStyles: {
      math_blocks: {
        colourPrimary: NUM_GREEN,
        colourSecondary: '#1B8A38',
        colourTertiary: '#146B2B'
      }
    },
    fontStyle: {
      family: '"Hiragino Maru Gothic ProN", "Yu Gothic UI", "Meiryo", sans-serif',
      weight: 'bold',
      size: 14
    }
  });

  const workspace = Blockly.inject('blocklyDiv', {
    toolbox: App.getToolboxXml('step1', false),
    media: './vendor/blockly/media/',
    theme: kidsLargeTheme,
    scrollbars: true,
    trashcan: true,
    zoom: {
      controls: true,
      wheel: false,
      startScale: 1.25,
      maxScale: 2.2,
      minScale: 0.6,
      scaleSpeed: 1.15
    }
  });

  window.addEventListener('resize', () => {
    setTimeout(() => Blockly.svgResize(workspace), 60);
  });

  // --- 6. エンジン初期化 ---
  const turtle = App.createTurtleEngine(document.getElementById('turtleCanvas'));
  const explainMgr = App.createExplainManager();
  const confetti = App.createConfetti(document.getElementById('confettiCanvas'));

  function updateNetworkLabel() {
    if (!netStatusLabel) return;
    netStatusLabel.textContent = navigator.onLine
      ? 'オンライン（最新を自動チェックします）'
      : 'オフライン（キャッシュで動作中）';
  }

  const pwa = App.initPWA({
    onInstallAvailable: (available) => {
      if (installAppRow) {
        installAppRow.style.display = available ? 'flex' : 'none';
      }
    },
    onStatusChange: updateNetworkLabel
  });
  updateNetworkLabel();

  // --- 7. UI更新＆ステップ切り替え ---
  function showFeedback(msg, isWarn, durationMs) {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    if (!msg) {
      feedbackEl.classList.remove('show', 'warn');
      return;
    }
    feedbackEl.textContent = msg;
    feedbackEl.classList.toggle('warn', !!isWarn);
    feedbackEl.classList.add('show');
    if (durationMs !== 0) {
      feedbackTimer = setTimeout(() => {
        feedbackEl.classList.remove('show');
      }, durationMs || 6500);
    }
  }

  function updateStatusStrip() {
    const st = turtle.getState().turtle;
    const effectiveDown = st.isPenDown || penCheckbox.checked;
    penDotEl.className = 'pen-dot ' + (effectiveDown ? 'down' : 'up');
    penStatusTextEl.textContent = effectiveDown ? 'ペン：下りている' : 'ペン：上がっている';

    let dispDeg = Math.round((st.angle + 90) % 360);
    if (dispDeg < 0) dispDeg += 360;
    angleStatusTextEl.textContent = '向き：' + dispDeg + '°';
  }

  function renderStepNav() {
    stepNavEl.innerHTML = '';
    App.STEPS.forEach((step) => {
      const unlocked = isStepUnlocked(step);
      const cleared = progress.cleared.includes(step.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'step-pill';
      if (step.id === currentStepId) btn.classList.add('active');
      if (cleared) btn.classList.add('cleared');
      if (!unlocked) btn.classList.add('locked');
      else if (step.isSecret) btn.classList.add('secret-unlocked');

      if (!unlocked) {
        btn.textContent = '🔒 ひみつ';
      } else if (step.isSecret) {
        btn.textContent = '✨ ' + step.shortName;
      } else {
        btn.textContent = step.shortName;
      }

      btn.addEventListener('click', () => {
        if (!unlocked) {
          const prev = getStepById(step.unlockAfter);
          showInfo('🔒 ひみつのステージ', `このステージは「${prev.shortName}」を クリアすると あそべるよ！がんばってね！`);
          return;
        }
        selectStep(step.id);
      });
      stepNavEl.appendChild(btn);
    });
  }

  function loadDefaultBlocks(step) {
    workspace.clear();
    if (step.defaultXml && step.defaultXml.trim()) {
      try {
        const xmlDom = Blockly.utils.xml.textToDom(step.defaultXml.trim());
        Blockly.Xml.domToWorkspace(xmlDom, workspace);
      } catch (e) {}
    }
  }

  function applyStepConfig(step) {
    // ペン設定：ステップ1のみ「ペンを下ろす」ブロックを使うため強制OFF、それ以外はユーザーの好み（初期値ON）
    if (step.forcePenOffStart) {
      penCheckbox.checked = false;
      penCheckbox.disabled = true;
      penCard.style.opacity = '0.75';
    } else {
      penCheckbox.disabled = false;
      penCard.style.opacity = '1';
      penCheckbox.checked = preferredAlwaysPenDown;
    }

    // ツールボックス更新
    workspace.updateToolbox(App.getToolboxXml(step.toolboxMode, penCheckbox.checked));

    // タートル初期化
    turtle.setConfig({
      startPos: step.startPos,
      goalType: step.goalType,
      showGuide: guideCheckbox.checked,
      showTurnAngles: angleCheckbox.checked,
      alwaysPenDown: penCheckbox.checked
    });
    turtle.reset(!step.forcePenOffStart && penCheckbox.checked);
    updateStatusStrip();
  }

  function selectStep(stepId) {
    if (isRunning) {
      turtle.cancelRun();
      isRunning = false;
      runBtn.disabled = false;
    }
    currentStepId = stepId;
    saveProgress();

    const step = getStepById(stepId);
    missionBadgeEl.textContent = step.badge;
    missionBadgeEl.className = 'mission-badge' + (step.isSecret ? ' secret' : '');
    missionTitleEl.textContent = step.title;
    missionDescEl.textContent = step.desc;

    explainBtn.style.display = step.hasExplain ? 'inline-flex' : 'none';
    explainBtn.classList.toggle('pulse', !!step.explainPromptOnEnter);

    showFeedback('', false);
    renderStepNav();
    loadDefaultBlocks(step);
    applyStepConfig(step);
    Blockly.svgResize(workspace);
  }

  // --- 8. イベント設定 ---
  penCheckbox.addEventListener('change', () => {
    const step = getStepById(currentStepId);
    if (!step.forcePenOffStart) {
      preferredAlwaysPenDown = penCheckbox.checked;
    }
    workspace.updateToolbox(App.getToolboxXml(step.toolboxMode, penCheckbox.checked));
    turtle.setConfig({ alwaysPenDown: penCheckbox.checked });
    if (!isRunning) {
      turtle.reset(penCheckbox.checked);
    }
    updateStatusStrip();
  });

  guideCheckbox.addEventListener('change', () => {
    turtle.setConfig({ showGuide: guideCheckbox.checked });
    turtle.redrawAll();
  });

  angleCheckbox.addEventListener('change', () => {
    turtle.setConfig({ showTurnAngles: angleCheckbox.checked });
    turtle.redrawAll();
  });

  explainBtn.addEventListener('click', () => {
    explainBtn.classList.remove('pulse');
    explainMgr.openForStep(getStepById(currentStepId));
  });

  hintBtn.addEventListener('click', () => {
    const step = getStepById(currentStepId);
    showInfo('💡 ヒント', step.hint);
  });

  resetBtn.addEventListener('click', () => {
    turtle.cancelRun();
    isRunning = false;
    runBtn.disabled = false;
    const step = getStepById(currentStepId);
    turtle.reset(!step.forcePenOffStart && penCheckbox.checked);
    showFeedback('', false);
    updateStatusStrip();
  });

  // --- 9. 実行＆クリア判定 ---
  async function runCode() {
    if (isRunning) return;

    // 全角数字チェック＆角度スロット未入力チェック
    const allBlocks = workspace.getAllBlocks(false);
    for (const block of allBlocks) {
      if (block.type === 'math_number') {
        const val = String(block.getFieldValue('NUM'));
        if (/[０-９]/.test(val)) {
          showInfo(
            '⚠️ すうじに「ぜんかく」がつかわれているよ！',
            'キーボードの「英数（えいすう）」ボタンをおしてから、はんかくの数字（1, 2, 3...）を にゅうりょくしてね！'
          );
          return;
        }
      }
      if (block.type === 'turn_degrees' && !block.getInputTargetBlock('DEGREES')) {
        showInfo(
          '⚠️ 「度まわす」の 角度が からっぽだよ！',
          '「〜度まわす」ブロックの あなに、左から「10」の数字ブロックを はめて、まわる角度を じぶんで 入力してみよう！'
        );
        return;
      }
    }

    const step = getStepById(currentStepId);
    isRunning = true;
    runBtn.disabled = true;
    showFeedback('', false);

    turtle.setConfig({
      startPos: step.startPos,
      goalType: step.goalType,
      showGuide: guideCheckbox.checked,
      showTurnAngles: angleCheckbox.checked,
      alwaysPenDown: penCheckbox.checked
    });
    turtle.reset(!step.forcePenOffStart && penCheckbox.checked);
    const token = turtle.getToken();

    const code = customGenerator.workspaceToCode(workspace);
    const hasRepeat = allBlocks.some((b) => b.type === 'custom_repeat');

    try {
      const fn = new Function(
        'moveSteps',
        'turnDegrees',
        'penDown',
        'penUp',
        'isAborted',
        'return (async () => { ' + code + ' })();'
      );

      await fn(
        (s) => turtle.moveSteps(s, token).then(updateStatusStrip),
        (d) => turtle.turnDegrees(d, token).then(updateStatusStrip),
        () => { turtle.penDown(); updateStatusStrip(); },
        () => { turtle.penUp(); updateStatusStrip(); },
        () => token !== turtle.getToken()
      );

      if (token !== turtle.getToken()) return; // 途中でリセットされた

      updateStatusStrip();
      const result = App.judgeStep(step, turtle.getState(), { hasRepeat });

      if (result.cleared) {
        handleStepClear(step, result.extraMessage);
      } else if (result.feedback) {
        showFeedback(result.feedback, result.warn, 8000);
        if (result.suggestExplain && step.hasExplain) {
          explainBtn.classList.add('pulse');
        }
      }
    } catch (e) {
      showInfo('⚠️ エラー', 'プログラムの じっこう中に エラーが おきました：' + e.message);
    } finally {
      isRunning = false;
      runBtn.disabled = false;
    }
  }

  function handleStepClear(step, extraMessage) {
    const wasFirstClear = !progress.cleared.includes(step.id);
    if (wasFirstClear) {
      progress.cleared.push(step.id);
      saveProgress();
    }

    renderStepNav();
    confetti.launch(true);

    clearTitleEl.textContent = `🎉 ${step.shortName} クリア！`;
    clearMsgEl.textContent = step.clearMessage + (extraMessage ? '\n' + extraMessage : '');

    // 新しく解放された隠しステージがあるかチェック
    const newlyUnlocked = App.STEPS.find((s) => s.isSecret && s.unlockAfter === step.id);
    if (newlyUnlocked && wasFirstClear) {
      unlockBannerEl.style.display = 'block';
      unlockBannerEl.innerHTML = `✨ ひみつのステージ <strong>「${newlyUnlocked.shortName}」</strong> が あらわれたよ！！`;
    } else {
      unlockBannerEl.style.display = 'none';
    }

    const nextStep = App.STEPS.find((s) => s.id === step.id + 1);
    if (nextStep && isStepUnlocked(nextStep)) {
      nextStepBtn.style.display = 'inline-flex';
      nextStepBtn.textContent = nextStep.isFree ? '🎨 じゆうモードへ！' : `つぎへ（${nextStep.shortName}）▶`;
      nextStepBtn.onclick = () => {
        clearModal.classList.remove('open');
        confetti.stop();
        selectStep(nextStep.id);
      };
    } else {
      nextStepBtn.style.display = 'none';
    }

    clearModal.classList.add('open');
  }

  closeClearBtn.addEventListener('click', () => {
    clearModal.classList.remove('open');
    confetti.stop();
  });

  runBtn.addEventListener('click', runCode);

  // --- 10. 汎用情報モーダル・設定モーダル・全画面 ---
  function showInfo(title, bodyHtml) {
    infoTitleEl.textContent = title;
    infoBodyEl.innerHTML = String(bodyHtml).replace(/\n/g, '<br>');
    infoModal.classList.add('open');
  }

  closeInfoBtn.addEventListener('click', () => infoModal.classList.remove('open'));
  okInfoBtn.addEventListener('click', () => infoModal.classList.remove('open'));
  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) infoModal.classList.remove('open');
  });

  fullscreenBtn.addEventListener('click', async () => {
    const res = await pwa.toggleFullscreen();
    if (!res.supported) {
      if (res.standalone) {
        showInfo('📺 ぜんがめん表示', 'すでに 全画面（アプリ）モードで 動いているよ！');
      } else {
        showInfo(
          '📱 iPad / Safari で 全画面にする方法',
          'iPad の Safari では、画面の上（または下）の <strong>「共有ボタン（□に↑）」</strong> を おして、<strong>「ホーム画面に追加」</strong> を えらぶと、全画面アプリとして あそべるよ！'
        );
      }
    }
  });

  settingsBtn.addEventListener('click', () => {
    updateNetworkLabel();
    settingsModal.classList.add('open');
  });
  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('open'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('open');
  });

  installAppBtn.addEventListener('click', async () => {
    await pwa.triggerInstall();
    settingsModal.classList.remove('open');
  });

  clearCacheBtn.addEventListener('click', async () => {
    if (confirm('アプリの古いキャッシュを削除して、最新の状態に再読み込みしますか？（クリア記録は消えません）')) {
      await pwa.clearCacheAndReload();
    }
  });

  teacherUnlockBtn.addEventListener('click', () => {
    progress.teacherUnlock = !progress.teacherUnlock;
    saveProgress();
    renderStepNav();
    teacherUnlockBtn.textContent = progress.teacherUnlock ? '🔒 ひみつを隠す（通常）' : '🔓 全ステージを解放';
    alert(progress.teacherUnlock ? '先生モード：すべてのステージを解放しました。' : '通常モードに戻しました。');
  });

  resetProgressBtn.addEventListener('click', () => {
    if (confirm('すべてのクリア記録をリセットして、ステップ1からやり直しますか？')) {
      progress = { cleared: [], teacherUnlock: false, currentStepId: 1 };
      saveProgress();
      teacherUnlockBtn.textContent = '🔓 全ステージを解放';
      settingsModal.classList.remove('open');
      selectStep(1);
    }
  });

  // 初期表示
  teacherUnlockBtn.textContent = progress.teacherUnlock ? '🔒 ひみつを隠す（通常）' : '🔓 全ステージを解放';
  selectStep(currentStepId);
})();
