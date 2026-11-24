/**
 * 魔法のプログラミング占いの館 - メインアプリケーション制御
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'uranai_app_state_v1';
  const BUILD_VER = '20261124-01';

  const NgFilter = global.UranaiNgFilter;
  const Sound = global.UranaiSound;
  const Curriculum = global.UranaiCurriculum;
  const Blocks = global.UranaiBlocks;

  // アプリ状態
  let state = {
    currentStep: 0,
    unlockedMaxStep: 0,
    clearedSteps: {},
    teacherMode: false,
    nameText: '',
    nameNum: 9,
    programsByStep: {},
    customMessages: {}
  };

  let deferredInstallPrompt = null;
  let stepRunner = null; // 1つずつ実行用のカーソル状態
  let animTimer = null;
  let isAnimatingRun = false;
  let secretTapCount = 0;
  let secretTapTimer = null;

  // DOM 参照
  const $ = (id) => document.getElementById(id);

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(state, parsed);
      }
    } catch (e) {}
    if (!state.programsByStep) state.programsByStep = {};
    if (!state.clearedSteps) state.clearedSteps = {};
    if (!state.customMessages) state.customMessages = {};
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function getTodayDate() {
    return Curriculum.getTodayDayOfMonth();
  }

  function getStepMeta(stepId) {
    const metas = Curriculum.getStepsMeta(state.nameNum, getTodayDate());
    return metas[stepId];
  }

  function getCurrentProgram() {
    const key = String(state.currentStep);
    if (!state.programsByStep[key]) {
      const meta = getStepMeta(state.currentStep);
      if (state.currentStep === 4 && state.programsByStep['3'] && state.programsByStep['3'].length > 0) {
        state.programsByStep[key] = Blocks.hydrateBlocks(state.programsByStep['3']);
      } else {
        const starter = meta.starterBlocks || meta.exampleBlocks || [];
        state.programsByStep[key] = Blocks.hydrateBlocks(starter);
      }
    }
    return state.programsByStep[key];
  }

  function setCurrentProgram(list) {
    state.programsByStep[String(state.currentStep)] = list;
    saveState();
  }

  // =========================================================================
  // Service Worker / PWA / 全画面 / 画面ロック / 誤操作防止
  // =========================================================================
  function initServiceWorkerAndPwa() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker
        .register('./sw.js?v=' + BUILD_VER, { updateViaCache: 'none' })
        .then((reg) => {
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = $('btn-install');
      if (btn) btn.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      const btn = $('btn-install');
      if (btn) btn.hidden = true;
    });

    const installBtn = $('btn-install');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        try {
          await deferredInstallPrompt.userChoice;
        } catch (e) {}
        deferredInstallPrompt = null;
        installBtn.hidden = true;
      });
    }
  }

  function isIosSafari() {
    const ua = navigator.userAgent || '';
    const isAppleMobile = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isAppleMobile && !window.MSStream;
  }

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function initFullscreenButton() {
    const btn = $('btn-fullscreen');
    const label = $('fullscreen-label');
    if (!btn) return;

    function updateLabel() {
      const fs = !!(document.fullscreenElement || document.webkitFullscreenElement || isStandaloneMode());
      label.textContent = fs ? 'もとにもどす' : '全画面';
    }

    document.addEventListener('fullscreenchange', updateLabel);
    document.addEventListener('webkitfullscreenchange', updateLabel);

    btn.addEventListener('click', async () => {
      Sound.playSnap();
      const docEl = document.documentElement;
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;

      if (fsEl) {
        if (document.exitFullscreen) await document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        updateLabel();
        return;
      }

      if (docEl.requestFullscreen) {
        try {
          await docEl.requestFullscreen();
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
          updateLabel();
          return;
        } catch (e) {}
      } else if (docEl.webkitRequestFullscreen) {
        try {
          docEl.webkitRequestFullscreen();
          updateLabel();
          return;
        } catch (e) {}
      }

      // iPad / iOS Safari で標準 Fullscreen API が使えない場合の案内
      if (isIosSafari() && !isStandaloneMode()) {
        showModal(
          '📱',
          'iPad・iPhoneで 全画面にする方法',
          '<p style="text-align:left;">Safariの<strong>共有ボタン（□から上向きの矢印）</strong>をおして、<br><strong>「ホーム画面に追加」</strong>をえらぶと、上のバーが消えて<strong>全画面アプリ</strong>としてあそべるよ！</p>'
        );
      } else if (isStandaloneMode()) {
        showModal('✨', '全画面モード中', '<p>いまはすでに全画面（アプリ）モードで動いているよ！</p>');
      }
    });

    updateLabel();
  }

  function initTouchAndOrientationGuards() {
    // 縦横チェック
    function checkOrientation() {
      const overlay = $('portrait-lock-overlay');
      if (!overlay) return;
      const isPortrait = window.innerHeight > window.innerWidth;
      overlay.hidden = !isPortrait;
    }

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();

    // iOS Safari ピンチズーム抑制
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
      document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
    });

    // マルチタッチピンチ & スクロール領域外での画面引っ張り防止
    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const scrollable = e.target && e.target.closest ? e.target.closest('.scrollable-y') : null;
        if (!scrollable) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // ダブルタップによる意図しない拡大抑制
    let lastTouchEnd = 0;
    document.addEventListener(
      'touchend',
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 280) {
          const tag = (e.target && e.target.tagName) || '';
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
          }
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

  // =========================================================================
  // モーダル制御
  // =========================================================================
  function showModal(icon, title, htmlBody, buttons) {
    $('modal-icon').textContent = icon || '🦉';
    $('modal-title').textContent = title || 'お知らせ';
    $('modal-body').innerHTML = htmlBody || '';

    const actions = $('modal-actions');
    actions.innerHTML = '';

    if (buttons && buttons.length) {
      buttons.forEach((b) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = b.className || 'primary-magic-btn';
        btn.textContent = b.text;
        btn.addEventListener('click', () => {
          closeModal();
          if (b.onClick) b.onClick();
        });
        actions.appendChild(btn);
      });
    } else {
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'primary-magic-btn';
      ok.textContent = 'OK！';
      ok.addEventListener('click', closeModal);
      actions.appendChild(ok);
    }

    $('modal-backdrop').hidden = false;
  }

  function closeModal() {
    $('modal-backdrop').hidden = true;
  }

  function showNgWarningModal() {
    Sound.playWarn();
    showModal(
      '🦉',
      'ちょっと待った！',
      '<p style="font-weight:700; color:#ffd859;">' + NgFilter.WARNING_MESSAGE + '</p>'
    );
  }

  // =========================================================================
  // ステップナビゲーション & UI切替
  // =========================================================================
  function renderStepTabs() {
    const tabs = document.querySelectorAll('.step-tab');
    tabs.forEach((tab) => {
      const sId = Number(tab.dataset.step);
      const isUnlocked = state.teacherMode || sId <= state.unlockedMaxStep;
      tab.classList.toggle('is-active', sId === state.currentStep);
      tab.classList.toggle('is-cleared', !!state.clearedSteps[String(sId)]);
      tab.classList.toggle('is-locked', !isUnlocked);
      tab.disabled = !isUnlocked;
    });

    const badge = $('teacher-badge');
    if (badge) badge.hidden = !state.teacherMode;
  }

  function switchStep(stepId) {
    stopRunningAnimation();
    stepRunner = null;
    if (!state.teacherMode && stepId > state.unlockedMaxStep) return;

    state.currentStep = stepId;
    saveState();
    renderStepTabs();
    renderCurrentStepView();
    resetCrystalAndVars();
  }

  function renderCurrentStepView() {
    const sId = state.currentStep;
    const meta = getStepMeta(sId);

    $('mission-title').textContent = meta.title;
    $('mission-desc').textContent = meta.desc;

    const isStep0 = sId === 0;
    $('step0-left-panel').hidden = !isStep0;
    $('step0-center-panel').hidden = !isStep0;
    $('block-palette-panel').hidden = isStep0;
    $('program-editor-panel').hidden = isStep0;
    $('step4-custom-bar').hidden = sId !== 4;

    if (isStep0) {
      updateStep0Conversion($('step0-name-input').value || state.nameText || 'たろう');
    } else {
      renderPalette(meta.allowedBlocks);
      renderProgramList();
    }
  }

  // =========================================================================
  // ステップ0：名前の数字変換マシン
  // =========================================================================
  function updateStep0Conversion(rawText) {
    const inputEl = $('step0-name-input');
    if (inputEl && inputEl.value !== rawText) {
      inputEl.value = rawText;
    }

    const check = NgFilter.validateText(rawText);
    if (!check.ok) {
      showNgWarningModal();
      return;
    }

    const res = Curriculum.convertNameToNumbers(rawText);
    state.nameText = res.normalized;
    state.nameNum = res.total;
    saveState();

    const cardsEl = $('step0-cards');
    cardsEl.innerHTML = '';

    if (res.items.length === 0) {
      const hint = document.createElement('span');
      hint.style.color = '#cfc2f7';
      hint.style.fontSize = '0.84rem';
      hint.textContent = 'ひらがなを入力すると、1文字ずつ数字にかわるよ！';
      cardsEl.appendChild(hint);
    } else {
      res.items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.innerHTML =
          '<span class="c-kana">' + escapeHtml(item.char) + '</span>' +
          '<span class="c-vowel">' + escapeHtml(item.vowel) + '</span>' +
          '<span class="c-num">' + item.num + '</span>';
        cardsEl.appendChild(card);
      });
    }

    $('step0-total-value').textContent = String(res.total);
    $('step0-btn-val').textContent = String(res.total);
    $('var-val-name').textContent = String(res.total);
    $('var-val-date').textContent = String(getTodayDate());
  }

  function initStep0() {
    const inputEl = $('step0-name-input');
    inputEl.value = state.nameText || '';

    inputEl.addEventListener('input', () => {
      updateStep0Conversion(inputEl.value);
    });

    $('btn-step0-sample').addEventListener('click', () => {
      Sound.playSnap();
      updateStep0Conversion('たろう');
    });

    $('btn-step0-complete').addEventListener('click', () => {
      const val = inputEl.value.trim() || 'たろう';
      const check = NgFilter.validateText(val);
      if (!check.ok) {
        showNgWarningModal();
        return;
      }
      const res = Curriculum.convertNameToNumbers(val);
      if (res.items.length === 0) {
        showModal('🦉', 'ひらがなを入れてね', '<p>じぶんの名前を<strong>ひらがな</strong>で入れてからボタンを押してね！</p>');
        return;
      }

      state.nameText = res.normalized;
      state.nameNum = res.total;
      state.clearedSteps['0'] = true;
      if (state.unlockedMaxStep < 1) state.unlockedMaxStep = 1;
      // ステップ1の初期ブロックがあれば名前数字を更新
      if (!state.programsByStep['1'] || state.programsByStep['1'].length === 0) {
        state.programsByStep['1'] = [];
      }
      saveState();

      Sound.playClear();
      showModal(
        '🎉',
        'ステップ0 クリア！',
        '<p>「<strong>' + escapeHtml(res.normalized) + '</strong>」の数字は <strong>' + res.total + '</strong> だね！<br>ステップ1が解放されたよ！</p>',
        [
          {
            text: 'ステップ1へすすむ！',
            onClick: () => switchStep(1)
          }
        ]
      );
    });
  }

  // =========================================================================
  // パレット & ブロック組み立てエリア（Pointer Events D&D + タップ両対応）
  // =========================================================================
  let dragState = null;

  function renderPalette(allowedTypes) {
    const paletteEl = $('block-palette');
    paletteEl.innerHTML = '';

    (allowedTypes || []).forEach((type) => {
      const meta = Blocks.BLOCK_CATALOG[type];
      if (!meta) return;
      const item = document.createElement('div');
      item.className = 'palette-item ' + meta.category;
      item.innerHTML =
        '<span>' + escapeHtml(meta.paletteLabel) + '</span>' +
        '<span class="palette-add-badge">+ 追加</span>';

      attachDragStart(item, { mode: 'create', blockType: type, label: meta.paletteLabel });
      paletteEl.appendChild(item);
    });
  }

  function countBlocks(list) {
    let total = 0;
    (list || []).forEach((b) => {
      total += 1;
      if (b.children) total += countBlocks(b.children);
      if (b.elseChildren) total += countBlocks(b.elseChildren);
    });
    return total;
  }

  function renderProgramList() {
    const program = getCurrentProgram();
    const listEl = $('program-list');
    listEl.innerHTML = '';

    const options = {
      onChange: () => {
        stepRunner = null;
        saveState();
      },
      onMove: (blockId, dir) => {
        Sound.playSnap();
        moveBlockInList(program, blockId, dir);
      },
      onDelete: (blockId) => {
        Sound.playSnap();
        deleteBlockFromList(program, blockId);
      },
      onQuickAddInside: (blockId, slot) => {
        openQuickAddInsideModal(blockId, slot);
      },
      attachDragStart: attachDragStart
    };

    program.forEach((b) => {
      listEl.appendChild(Blocks.createBlockElement(b, options));
    });

    const total = countBlocks(program);
    $('block-count-badge').textContent = total + 'こ';
    $('empty-drop-hint').hidden = program.length > 0;
  }

  function moveBlockInList(rootList, blockId, dir) {
    const info = Blocks.findContainerInfo(rootList, blockId);
    if (!info) return;
    const newIdx = info.index + dir;
    if (newIdx < 0 || newIdx >= info.list.length) return;
    const removed = info.list.splice(info.index, 1)[0];
    info.list.splice(newIdx, 0, removed);
    stepRunner = null;
    setCurrentProgram(rootList);
    renderProgramList();
  }

  function deleteBlockFromList(rootList, blockId) {
    const info = Blocks.findContainerInfo(rootList, blockId);
    if (!info) return;
    info.list.splice(info.index, 1);
    stepRunner = null;
    setCurrentProgram(rootList);
    renderProgramList();
  }

  function openQuickAddInsideModal(blockId, slot) {
    const meta = getStepMeta(state.currentStep);
    const allowed = (meta.allowedBlocks || []).filter((t) => {
      const cat = Blocks.BLOCK_CATALOG[t];
      return cat && !cat.isContainer;
    });

    if (allowed.length === 0) {
      showModal('🦉', 'ヒント', '<p>このステップでは、入れられるブロックがパレットにないよ。</p>');
      return;
    }

    const html = allowed
      .map((t) => {
        const cat = Blocks.BLOCK_CATALOG[t];
        return (
          '<button type="button" class="palette-item ' + cat.category + '" data-quick-type="' + t + '" style="width:100%; margin-bottom:8px;">' +
          '<span>' + escapeHtml(cat.paletteLabel) + '</span>' +
          '<span class="palette-add-badge">えらぶ</span>' +
          '</button>'
        );
      })
      .join('');

    showModal('🧩', 'なかに 入れるブロックを えらぼう！', '<div style="text-align:left;">' + html + '</div>', [
      { text: 'やめる', className: 'mini-btn' }
    ]);

    const body = $('modal-body');
    body.querySelectorAll('[data-quick-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.quickType;
        const program = getCurrentProgram();
        const targetList = Blocks.findListByKey(program, blockId + ':' + slot);
        if (targetList) {
          const newBlk = Blocks.BLOCK_CATALOG[type].createDefault({
            nameNum: state.nameNum,
            todayDate: getTodayDate()
          });
          targetList.push(newBlk);
          Sound.playSnap();
          stepRunner = null;
          setCurrentProgram(program);
          renderProgramList();
        }
        closeModal();
      });
    });
  }

  function attachDragStart(el, payload) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('input, select, button')) return;

      dragState = {
        payload: payload,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        pointerId: e.pointerId,
        currentContainer: null
      };

      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.active && Math.hypot(dx, dy) > 9) {
        dragState.active = true;
        const ghost = $('drag-ghost');
        ghost.textContent = dragState.payload.label;
        ghost.hidden = false;
      }
      if (dragState.active) {
        const ghost = $('drag-ghost');
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
        updateDropHighlight(e.clientX, e.clientY);
      }
    });

    const endDrag = (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;
      const wasActive = dragState.active;
      const payloadCopy = dragState.payload;
      clearDropHighlights();
      $('drag-ghost').hidden = true;
      dragState = null;

      if (!wasActive) {
        // タップ操作（パレットからの場合は末尾へ追加）
        if (payloadCopy.mode === 'create') {
          addBlockToContainer(payloadCopy.blockType, 'root');
        }
        return;
      }

      handleDropAt(e.clientX, e.clientY, payloadCopy);
    };

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
  }

  function findDropTargetAt(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (let i = 0; i < els.length; i++) {
      const container = els[i].closest ? els[i].closest('[data-container-id]') : null;
      if (container) return container;
    }
    // プログラムワークスペース内の空き領域にドロップされた場合はrootへ
    for (let j = 0; j < els.length; j++) {
      if (els[j].id === 'program-workspace' || els[j].id === 'empty-drop-hint') {
        return $('program-list');
      }
    }
    return null;
  }

  function clearDropHighlights() {
    document.querySelectorAll('.is-drop-over').forEach((el) => el.classList.remove('is-drop-over'));
  }

  function updateDropHighlight(x, y) {
    clearDropHighlights();
    const target = findDropTargetAt(x, y);
    if (target) target.classList.add('is-drop-over');
  }

  function addBlockToContainer(blockType, containerKey, insertIndex) {
    const meta = Blocks.BLOCK_CATALOG[blockType];
    if (!meta) return;
    const program = getCurrentProgram();
    const targetList = Blocks.findListByKey(program, containerKey || 'root');
    if (!targetList) return;

    const newBlk = meta.createDefault({
      nameNum: state.nameNum,
      todayDate: getTodayDate()
    });

    if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= targetList.length) {
      targetList.splice(insertIndex, 0, newBlk);
    } else {
      targetList.push(newBlk);
    }
    Sound.playSnap();
    stepRunner = null;
    setCurrentProgram(program);
    renderProgramList();
  }

  function handleDropAt(x, y, payload) {
    const containerEl = findDropTargetAt(x, y);
    if (!containerEl) return;
    const containerKey = containerEl.dataset.containerId || 'root';

    // ドロップ位置の挿入インデックスを計算
    let insertIdx = containerEl.children.length;
    const directChildren = Array.from(containerEl.children).filter((c) => c.dataset && c.dataset.blockId);
    for (let i = 0; i < directChildren.length; i++) {
      const rect = directChildren[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        insertIdx = i;
        break;
      }
    }

    if (payload.mode === 'create') {
      addBlockToContainer(payload.blockType, containerKey, insertIdx);
      return;
    }

    if (payload.mode === 'move') {
      const program = getCurrentProgram();
      const info = Blocks.findContainerInfo(program, payload.blockId);
      if (!info) return;

      // 自分自身の中へドロップする循環移動を防止
      const targetBlockId = containerKey === 'root' ? null : containerKey.split(':')[0];
      if (targetBlockId && Blocks.isDescendant(info.block, targetBlockId)) {
        return;
      }

      const targetList = Blocks.findListByKey(program, containerKey);
      if (!targetList) return;

      if (info.list === targetList && info.index < insertIdx) {
        insertIdx -= 1;
      }
      const moved = info.list.splice(info.index, 1)[0];
      targetList.splice(Math.max(0, Math.min(targetList.length, insertIdx)), 0, moved);
      Sound.playSnap();
      stepRunner = null;
      setCurrentProgram(program);
      renderProgramList();
    }
  }

  // =========================================================================
  // プログラム実行・水晶玉ステージ・変数モニター・紙吹雪
  // =========================================================================
  function stopRunningAnimation() {
    if (animTimer) {
      clearTimeout(animTimer);
      animTimer = null;
    }
    isAnimatingRun = false;
    document.querySelectorAll('.prog-block.is-running').forEach((el) => el.classList.remove('is-running'));
    const ball = $('crystal-ball');
    if (ball) ball.classList.remove('is-pulsing');
  }

  function resetCrystalAndVars() {
    stopRunningAnimation();
    stepRunner = null;
    const defaults = Blocks.createDefaultVars();
    if (state.currentStep === 0) {
      defaults['名前'] = state.nameNum || 0;
      defaults['日付'] = getTodayDate();
    }
    updateVarsDisplay(defaults, null);

    const ball = $('crystal-ball');
    ball.style.background = '';
    ball.style.boxShadow = '';
    $('crystal-inner-text').innerHTML = '<span class="crystal-emoji">✨</span><span class="crystal-status">じゅんびOK</span>';
    $('fortune-result-box').hidden = true;
    $('exec-step-label').textContent = '待機中';
    $('exec-log').textContent = 'プログラムをつくって「うらないを実行！」をおしてね。';
  }

  function updateVarsDisplay(vars, changedVar) {
    const map = [
      ['名前', 'var-val-name'],
      ['日付', 'var-val-date'],
      ['名前と日付の和', 'var-val-sum'],
      ['7でわったあまり', 'var-val-mod'],
      ['今日のラッキーカラー', 'var-val-color']
    ];

    map.forEach(([varName, elId]) => {
      const valEl = $(elId);
      if (valEl) valEl.textContent = String(vars[varName]);
      const itemEl = valEl ? valEl.closest('.var-item') : null;
      if (itemEl) {
        itemEl.classList.remove('is-flash');
        if (changedVar === varName) {
          void itemEl.offsetWidth;
          itemEl.classList.add('is-flash');
        }
      }
    });
  }

  function highlightBlockById(blockId) {
    document.querySelectorAll('.prog-block.is-running').forEach((el) => el.classList.remove('is-running'));
    if (!blockId) return;
    const target = document.querySelector('.prog-block[data-block-id="' + blockId + '"]');
    if (target) {
      target.classList.add('is-running');
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function applyFortunePresentation(vars, guestLabel) {
    const colorName = vars['今日のラッキーカラー'];
    const colorInfo = Curriculum.getColorByName(colorName);
    const ball = $('crystal-ball');
    const resultBox = $('fortune-result-box');

    if (colorInfo) {
      ball.style.background =
        'radial-gradient(circle at 35% 30%, #ffffff 0%, ' + colorInfo.hex + ' 58%, #1a0938 100%)';
      ball.style.boxShadow = '0 0 34px ' + colorInfo.hex + ', inset 0 -10px 18px rgba(0,0,0,0.35)';
      $('crystal-inner-text').innerHTML =
        '<span class="crystal-emoji">' + colorInfo.emoji + '</span>' +
        '<span class="crystal-status">' + escapeHtml(colorInfo.name) + '</span>';

      const custom = state.customMessages[colorInfo.name] || {};
      const msgText = custom.msg || colorInfo.defaultMsg;
      const itemText = custom.item || colorInfo.defaultItem;

      const pill = $('result-color-pill');
      pill.textContent = (guestLabel ? guestLabel + 'の ' : '') + 'ラッキーカラー：' + colorInfo.name;
      pill.style.background = colorInfo.hex;
      pill.style.color = colorInfo.textColor;

      $('result-message').textContent = msgText;
      $('result-item').textContent = '🎁 ラッキーアイテム：' + itemText;
      resultBox.hidden = false;

      Sound.playMagicFinish();
      launchConfetti(colorInfo.hex);
    } else {
      $('crystal-inner-text').innerHTML =
        '<span class="crystal-emoji">✨</span><span class="crystal-status">和 = ' + vars['名前と日付の和'] + '</span>';
    }
  }

  function runProgramAnimated(overrideInput, guestLabel) {
    if (state.currentStep === 0 && !overrideInput) {
      showModal('🦉', 'まずは名前を変換しよう！', '<p>ステップ0では、自分の名前を数字に変えて「ステップ1へ！」ボタンをおしてね。</p>');
      return;
    }

    const program = getCurrentProgram();
    if (program.length === 0) {
      showModal('🧩', 'ブロックが空だよ', '<p>左のパレットからブロックを追加してプログラムを組み立ててみよう！</p>');
      return;
    }

    stopRunningAnimation();
    stepRunner = null;
    const exec = Blocks.buildExecutionTrace(program, overrideInput);
    const trace = exec.trace;

    if (trace.length === 0) return;

    isAnimatingRun = true;
    $('crystal-ball').classList.add('is-pulsing');
    $('fortune-result-box').hidden = true;

    let idx = 0;
    const delayMs = trace.length > 25 ? 110 : 260;

    function tick() {
      if (!isAnimatingRun) return;
      if (idx >= trace.length) {
        isAnimatingRun = false;
        $('crystal-ball').classList.remove('is-pulsing');
        highlightBlockById(null);
        $('exec-step-label').textContent = 'かんりょう！';
        applyFortunePresentation(exec.finalVars, guestLabel);
        if (!overrideInput) {
          checkStepCompletion(program, exec.finalVars);
        }
        return;
      }

      const step = trace[idx];
      highlightBlockById(step.blockId);
      updateVarsDisplay(step.vars, step.changedVar);
      $('exec-step-label').textContent = (idx + 1) + ' / ' + trace.length;
      $('exec-log').textContent = step.log;
      Sound.playStep();

      idx += 1;
      animTimer = setTimeout(tick, delayMs);
    }

    tick();
  }

  function runSingleStep() {
    if (state.currentStep === 0) return;
    const program = getCurrentProgram();
    if (program.length === 0) {
      showModal('🧩', 'ブロックが空だよ', '<p>ブロックを置いてから「1つずつ」をおしてね！</p>');
      return;
    }

    if (isAnimatingRun) stopRunningAnimation();

    if (!stepRunner) {
      const exec = Blocks.buildExecutionTrace(program);
      stepRunner = { trace: exec.trace, finalVars: exec.finalVars, index: 0 };
      $('fortune-result-box').hidden = true;
    }

    if (stepRunner.index >= stepRunner.trace.length) {
      highlightBlockById(null);
      $('exec-step-label').textContent = 'かんりょう！';
      applyFortunePresentation(stepRunner.finalVars);
      checkStepCompletion(program, stepRunner.finalVars);
      stepRunner = null;
      return;
    }

    const s = stepRunner.trace[stepRunner.index];
    highlightBlockById(s.blockId);
    updateVarsDisplay(s.vars, s.changedVar);
    $('exec-step-label').textContent = (stepRunner.index + 1) + ' / ' + stepRunner.trace.length;
    $('exec-log').textContent = s.log;
    Sound.playStep();
    stepRunner.index += 1;

    if (stepRunner.index >= stepRunner.trace.length) {
      setTimeout(() => {
        if (!stepRunner) return;
        highlightBlockById(null);
        $('exec-step-label').textContent = 'かんりょう！';
        applyFortunePresentation(stepRunner.finalVars);
        checkStepCompletion(program, stepRunner.finalVars);
        stepRunner = null;
      }, 280);
    }
  }

  function checkStepCompletion(program, finalVars) {
    const sId = state.currentStep;
    const res = Curriculum.evaluateStepGoal(sId, program, finalVars);
    if (res.cleared) {
      const wasCleared = !!state.clearedSteps[String(sId)];
      state.clearedSteps[String(sId)] = true;
      if (sId < 4 && state.unlockedMaxStep < sId + 1) {
        state.unlockedMaxStep = sId + 1;
      }
      saveState();
      renderStepTabs();

      if (!wasCleared || sId < 4) {
        Sound.playClear();
        const btns =
          sId < 4
            ? [
                { text: 'ステップ' + (sId + 1) + 'へすすむ！', onClick: () => switchStep(sId + 1) },
                { text: 'もう少しここで試す', className: 'mini-btn' }
              ]
            : [{ text: 'やったー！' }];

        showModal('🎉', 'ステップ' + sId + ' クリア！', '<p>' + escapeHtml(res.message) + '</p>', btns);
      }
    } else if (res.reason) {
      $('exec-log').textContent = '💡 ' + res.reason;
    }
  }

  // 紙吹雪エフェクト
  function launchConfetti(mainHex) {
    const canvas = $('confetti-canvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    const palette = [mainHex, '#ffe270', '#8ceeff', '#ffffff', '#ff7eb6'];

    const pieces = [];
    for (let i = 0; i < 42; i++) {
      pieces.push({
        x: rect.width / 2,
        y: rect.height * 0.42,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.85) * 7,
        size: 4 + Math.random() * 5,
        color: palette[i % palette.length],
        life: 55 + Math.random() * 25
      });
    }

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18;
        p.life -= 1;
        ctx.globalAlpha = Math.max(0, p.life / 60);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.7);
      }
      ctx.globalAlpha = 1;
      if (alive) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(frame);
  }

  // =========================================================================
  // ステップ4：オリジナルメッセージ & おきゃくさん占い & 先生用メニュー
  // =========================================================================
  function initStep4Modals() {
    $('btn-open-custom-messages').addEventListener('click', () => {
      Sound.playSnap();
      const list = $('custom-msg-list');
      list.innerHTML = '';

      Curriculum.FORTUNE_COLORS.forEach((c) => {
        const saved = state.customMessages[c.name] || {};
        const row = document.createElement('div');
        row.className = 'custom-msg-row';
        row.innerHTML =
          '<div style="font-weight:900; color:' + c.hex + ';">' + c.emoji + ' ' + c.name + '</div>' +
          '<input type="text" maxlength="60" data-color="' + c.name + '" data-field="msg" placeholder="アドバイス" value="' + escapeAttr(saved.msg || c.defaultMsg) + '">' +
          '<input type="text" maxlength="25" data-color="' + c.name + '" data-field="item" placeholder="ラッキーアイテム" value="' + escapeAttr(saved.item || c.defaultItem) + '">';
        list.appendChild(row);
      });

      $('custom-msg-backdrop').hidden = false;
    });

    $('btn-close-custom-msg').addEventListener('click', () => {
      $('custom-msg-backdrop').hidden = true;
    });

    $('btn-reset-custom-msg').addEventListener('click', () => {
      state.customMessages = {};
      saveState();
      $('custom-msg-backdrop').hidden = true;
      showModal('✨', 'もとにもどしたよ', '<p>7色のメッセージとアイテムをさいしょの言葉にもどしました。</p>');
    });

    $('btn-save-custom-msg').addEventListener('click', () => {
      const inputs = $('custom-msg-list').querySelectorAll('input');
      const nextCustom = {};
      for (let i = 0; i < inputs.length; i++) {
        const inp = inputs[i];
        const check = NgFilter.validateText(inp.value);
        if (!check.ok) {
          showNgWarningModal();
          return;
        }
        const color = inp.dataset.color;
        const field = inp.dataset.field;
        nextCustom[color] = nextCustom[color] || {};
        nextCustom[color][field] = inp.value.trim();
      }
      state.customMessages = nextCustom;
      saveState();
      $('custom-msg-backdrop').hidden = true;
      Sound.playClear();
      showModal('💾', 'ほぞんしたよ！', '<p>オリジナルメッセージが保存されたよ！占いを実行してためしてみよう！</p>');
    });

    // おきゃくさんモード
    $('btn-open-guest-mode').addEventListener('click', () => {
      Sound.playSnap();
      $('guest-date-input').value = String(getTodayDate());
      $('guest-modal-backdrop').hidden = false;
    });

    $('btn-close-guest').addEventListener('click', () => {
      $('guest-modal-backdrop').hidden = true;
    });

    $('btn-run-guest').addEventListener('click', () => {
      const gName = $('guest-name-input').value.trim();
      const gDate = Number($('guest-date-input').value) || getTodayDate();
      const check = NgFilter.validateText(gName);
      if (!check.ok) {
        $('guest-modal-backdrop').hidden = true;
        showNgWarningModal();
        return;
      }
      const res = Curriculum.convertNameToNumbers(gName);
      if (res.items.length === 0) {
        showModal('🦉', 'なまえを入れてね', '<p>友だちの名前を<strong>ひらがな</strong>で入れてね！</p>');
        return;
      }
      $('guest-modal-backdrop').hidden = true;
      runProgramAnimated({ nameNum: res.total, dateNum: gDate }, gName + 'さん');
    });
  }

  function initTeacherMenu() {
    function openTeacherModal() {
      $('teacher-modal-backdrop').hidden = false;
    }

    $('brand-secret-trigger').addEventListener('click', () => {
      secretTapCount += 1;
      clearTimeout(secretTapTimer);
      secretTapTimer = setTimeout(() => {
        secretTapCount = 0;
      }, 2200);
      if (secretTapCount >= 5) {
        secretTapCount = 0;
        openTeacherModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
        openTeacherModal();
      }
    });

    $('btn-close-teacher').addEventListener('click', () => {
      $('teacher-modal-backdrop').hidden = true;
    });

    $('btn-unlock-all').addEventListener('click', () => {
      state.teacherMode = true;
      state.unlockedMaxStep = 4;
      saveState();
      renderStepTabs();
      $('teacher-modal-backdrop').hidden = true;
      showModal('👩‍🏫', '先生モードON', '<p>すべてのステージ（ステップ0〜4）が解放されました。</p>');
    });

    $('btn-lock-reset').addEventListener('click', () => {
      state.teacherMode = false;
      state.unlockedMaxStep = 0;
      state.clearedSteps = {};
      state.currentStep = 0;
      saveState();
      renderStepTabs();
      switchStep(0);
      $('teacher-modal-backdrop').hidden = true;
    });

    $('btn-fill-step-demo').addEventListener('click', () => {
      $('teacher-modal-backdrop').hidden = true;
      if (state.currentStep === 0) {
        updateStep0Conversion('さくら');
        return;
      }
      const meta = getStepMeta(state.currentStep);
      setCurrentProgram(Blocks.hydrateBlocks(meta.exampleBlocks || []));
      renderProgramList();
    });

    $('btn-hard-reset').addEventListener('click', () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      location.reload();
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  // =========================================================================
  // 初期化
  // =========================================================================
  function init() {
    loadState();
    initServiceWorkerAndPwa();
    initFullscreenButton();
    initTouchAndOrientationGuards();
    initStep0();
    initStep4Modals();
    initTeacherMenu();

    // ステップタブクリック
    document.querySelectorAll('.step-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const sId = Number(tab.dataset.step);
        if (!state.teacherMode && sId > state.unlockedMaxStep) {
          Sound.playWarn();
          showModal('🔒', 'まだロック中だよ', '<p>まえのステップをクリアすると開くよ！</p>');
          return;
        }
        Sound.playSnap();
        switchStep(sId);
      });
    });

    // ヒント
    $('btn-hint').addEventListener('click', () => {
      Sound.playSnap();
      const meta = getStepMeta(state.currentStep);
      showModal('💡', 'フクロウ先生のヒント', '<p>' + escapeHtml(meta.hint) + '</p>');
    });

    // おてほん & クリア
    $('btn-load-example').addEventListener('click', () => {
      Sound.playSnap();
      const meta = getStepMeta(state.currentStep);
      setCurrentProgram(Blocks.hydrateBlocks(meta.exampleBlocks || []));
      stepRunner = null;
      renderProgramList();
    });

    $('btn-clear-program').addEventListener('click', () => {
      Sound.playSnap();
      setCurrentProgram([]);
      stepRunner = null;
      renderProgramList();
      resetCrystalAndVars();
    });

    // 実行・1ステップ・リセット
    $('btn-run').addEventListener('click', () => runProgramAnimated());
    $('btn-step-run').addEventListener('click', () => runSingleStep());
    $('btn-reset-vars').addEventListener('click', () => {
      Sound.playSnap();
      resetCrystalAndVars();
    });

    // サウンドトグル
    function updateSoundIcon() {
      $('sound-icon').textContent = Sound.getMuted() ? '🔇' : '🔊';
    }
    $('btn-sound').addEventListener('click', () => {
      Sound.setMuted(!Sound.getMuted());
      updateSoundIcon();
      if (!Sound.getMuted()) Sound.playSnap();
    });
    updateSoundIcon();

    renderStepTabs();
    renderCurrentStepView();
    resetCrystalAndVars();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
