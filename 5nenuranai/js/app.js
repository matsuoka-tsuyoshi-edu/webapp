/**
 * 占いの館 - メインアプリケーション (v2.2 名前変数・タイトル統一版)
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'uranai_app_v2_state';
  const BUILD_VER = '20261124-11';

  const NgFilter = global.UranaiNgFilter;
  const Sound = global.UranaiSound;
  const Curriculum = global.UranaiCurriculum;
  const Blocks = global.UranaiBlocks;

  const $ = (id) => document.getElementById(id);

  function createInitialState() {
    return {
      scene: 1,
      maxUnlockedScene: 1,
      teacherMode: false,
      fcOrder: shuffleArray(Curriculum.FLOWCHART_ITEMS.map((i) => i.id)),
      fcSlots: { 'ア': null, 'イ': null, 'ウ': null, 'エ': null, 'オ': null, 'カ': null },
      fcCompleted: false,
      programBlocks: [],
      progCompleted: false,
      simFirstDone: false,
      simAutoMode: false,
      lastSimResult: null
    };
  }

  let state = createInitialState();
  let selectedFcItemId = null;
  let activeSlotPath = null; // Scene 4 タップ選択中の穴
  let activeSlotMode = null;
  let dragPayload = null;
  let simRun = null;

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(createInitialState(), parsed);
        if (state.programBlocks) {
          state.programBlocks = Blocks.hydrateBlocks(state.programBlocks);
        }
      }
    } catch (e) {
      state = createInitialState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function hardResetAll() {
    stopSimTimers();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    state = createInitialState();
    activeSlotPath = null;
    activeSlotMode = null;
    saveState();
    goToScene(1);
  }

  // =========================================================================
  // Service Worker ＆ ピンチ・ダブルタップ完全抑止
  // =========================================================================
  function initServiceWorker() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker
        .register('./sw.js?v=' + BUILD_VER, { updateViaCache: 'none' })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {});
    }
  }

  function initTouchAndOrientationGuards() {
    function checkOrientation() {
      const overlay = $('portrait-lock-overlay');
      if (!overlay) return;
      overlay.hidden = !(window.innerHeight > window.innerWidth);
    }
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();

    ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
      document.addEventListener(evt, (e) => e.preventDefault(), { capture: true, passive: false });
    });

    document.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches && e.touches.length > 1) e.preventDefault();
      },
      { capture: true, passive: false }
    );

    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const scrollable = e.target && e.target.closest ? e.target.closest('.scrollable-y') : null;
        if (!scrollable) e.preventDefault();
      },
      { capture: true, passive: false }
    );

    document.addEventListener('dblclick', (e) => e.preventDefault(), { capture: true, passive: false });
    document.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey) e.preventDefault();
      },
      { capture: true, passive: false }
    );

    let lastTouchEnd = 0;
    document.addEventListener(
      'touchend',
      (e) => {
        const now = Date.now();
        const isInteractive = e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, .fc-card, .fc-slot, .palette-item, .scratch-oval, .scratch-hole, .scratch-op-oval, .magic-number-card, .ancient-gem-btn, .brand-area');
        if (!isInteractive && now - lastTouchEnd <= 450) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      },
      { capture: true, passive: false }
    );
  }

  // =========================================================================
  // 共通モーダル
  // =========================================================================
  function showModal(icon, title, htmlBody, buttons) {
    $('modal-icon').textContent = icon || '🔮';
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
    showModal('🔮', 'ちょっと待った！', '<p style="font-weight:700; color:#ffd859;">' + NgFilter.WARNING_MESSAGE + '</p>');
  }

  // =========================================================================
  // シーン遷移制御（Scene 1 〜 5）
  // =========================================================================
  function goToScene(sceneNum) {
    stopSimTimers();
    if (!state.teacherMode && sceneNum > state.maxUnlockedScene) return;
    state.scene = sceneNum;
    if (sceneNum > state.maxUnlockedScene) state.maxUnlockedScene = sceneNum;
    saveState();

    $('app-shell').setAttribute('data-scene', String(sceneNum));
    for (let s = 1; s <= 5; s++) {
      $('scene-' + s).hidden = s !== sceneNum;
    }

    $('btn-open-rules').hidden = sceneNum < 3;
    $('teacher-badge').hidden = !state.teacherMode;

    document.querySelectorAll('.scene-pill').forEach((pill) => {
      const pNum = Number(pill.dataset.scene);
      const unlocked = state.teacherMode || pNum <= state.maxUnlockedScene;
      pill.classList.toggle('is-active', pNum === sceneNum);
      pill.classList.toggle('is-done', pNum < state.maxUnlockedScene);
      pill.classList.toggle('is-locked', !unlocked);
      pill.disabled = !unlocked;
    });

    if (sceneNum === 3) renderScene3Flowchart();
    if (sceneNum === 4) renderScene4Programming();
    if (sceneNum === 5) renderScene5Simulator();
  }

  // =========================================================================
  // SCENE 3：フローチャート完成画面
  // =========================================================================
  function getFcItemById(id) {
    return Curriculum.FLOWCHART_ITEMS.find((i) => i.id === id) || null;
  }

  function isSlotPlaced(itemId) {
    return Object.keys(state.fcSlots).some((k) => state.fcSlots[k] === itemId);
  }

  function renderFlowchartDiagram(containerEl, mode, opts) {
    const o = opts || {};
    containerEl.innerHTML = '';

    function addTerm(txt) {
      const d = document.createElement('div');
      d.className = 'fc-node-term';
      d.textContent = txt;
      containerEl.appendChild(d);
    }
    function addArrow() {
      const a = document.createElement('div');
      a.className = 'fc-arrow';
      a.textContent = '↓';
      containerEl.appendChild(a);
    }

    addTerm('スタート');

    Curriculum.FLOWCHART_SLOTS.forEach((slot) => {
      addArrow();
      const box = document.createElement('div');
      box.className = 'fc-slot kind-' + slot.kind;
      box.dataset.fcSlot = slot.key;

      const placedId = state.fcSlots[slot.key];
      const item = mode === 'builder' ? (placedId ? getFcItemById(placedId) : null) : getFcItemById(slot.answerId);

      if (item) {
        box.classList.add('is-filled');
        box.textContent = item.label;
      } else {
        box.textContent = slot.key + '（ここにいれる）';
      }

      if (mode === 'builder') {
        const allFilled = Curriculum.FLOWCHART_SLOTS.every((s) => !!state.fcSlots[s.key]);
        if (allFilled && item && item.id !== slot.answerId) {
          box.classList.add('is-wrong');
        }

        box.addEventListener('click', () => {
          if (selectedFcItemId) {
            placeFcItemInSlot(selectedFcItemId, slot.key);
            selectedFcItemId = null;
          } else if (state.fcSlots[slot.key]) {
            Sound.playSnap();
            state.fcSlots[slot.key] = null;
            evaluateFlowchartState();
            renderScene3Flowchart();
          }
        });
      } else if (mode === 'prog') {
        const glowList = o.highlightSlots || [];
        if (glowList.indexOf(slot.key) !== -1) {
          box.classList.add('is-stage-glow');
        } else {
          box.classList.add('is-stage-dim');
        }
      } else if (mode === 'sim') {
        if (o.tapSlots && o.tapSlots.indexOf(slot.key) !== -1) {
          box.classList.add('is-tap-target');
          box.addEventListener('click', () => o.onTapSlot && o.onTapSlot(slot.key));
        }
        if (o.flashSlots && o.flashSlots.indexOf(slot.key) !== -1) {
          box.classList.add('is-flash');
        }
      }

      containerEl.appendChild(box);

      if (slot.key === 'オ') {
        addArrow();
        const loopEnd = document.createElement('div');
        loopEnd.className = 'fc-loop-end';
        loopEnd.textContent = 'くり返し終わり';
        containerEl.appendChild(loopEnd);
      }
    });

    const branches = document.createElement('div');
    branches.className = 'fc-branches-mini';
    Curriculum.FORTUNE_COLORS.forEach((c) => {
      const tag = document.createElement('span');
      tag.className = 'fc-branch-tag';
      tag.style.background = c.hex;
      tag.style.color = c.textColor;
      tag.textContent = c.mod + ':' + c.name;
      branches.appendChild(tag);
    });
    containerEl.appendChild(branches);
    addArrow();
    addTerm('終わり');
  }

  function placeFcItemInSlot(itemId, slotKey) {
    Object.keys(state.fcSlots).forEach((k) => {
      if (state.fcSlots[k] === itemId) state.fcSlots[k] = null;
    });
    state.fcSlots[slotKey] = itemId;
    Sound.playSnap();
    evaluateFlowchartState();
    renderScene3Flowchart();
  }

  function evaluateFlowchartState() {
    const allFilled = Curriculum.FLOWCHART_SLOTS.every((s) => !!state.fcSlots[s.key]);
    const allCorrect = Curriculum.FLOWCHART_SLOTS.every((s) => state.fcSlots[s.key] === s.answerId);
    state.fcCompleted = allCorrect;
    if (allCorrect && state.maxUnlockedScene < 4) {
      state.maxUnlockedScene = 4;
      Sound.playClear();
    }
    saveState();
    return { allFilled: allFilled, allCorrect: allCorrect };
  }

  function renderScene3Flowchart() {
    const bankEl = $('fc-bank');
    bankEl.innerHTML = '';

    state.fcOrder.forEach((itemId) => {
      if (isSlotPlaced(itemId)) return;
      const item = getFcItemById(itemId);
      if (!item) return;

      const card = document.createElement('div');
      card.className = 'fc-card kind-' + item.kind + (selectedFcItemId === item.id ? ' is-selected' : '');
      card.textContent = item.label;

      attachPointerDrag(card, {
        label: item.label,
        onTap: () => {
          Sound.playSnap();
          selectedFcItemId = selectedFcItemId === item.id ? null : item.id;
          renderScene3Flowchart();
        },
        onDrop: (x, y) => {
          const els = document.elementsFromPoint(x, y);
          for (let i = 0; i < els.length; i++) {
            const slotEl = els[i].closest ? els[i].closest('[data-fc-slot]') : null;
            if (slotEl) {
              selectedFcItemId = null;
              placeFcItemInSlot(item.id, slotEl.dataset.fcSlot);
              return;
            }
          }
        },
        highlightFinder: (x, y) => {
          const els = document.elementsFromPoint(x, y);
          for (let i = 0; i < els.length; i++) {
            const slotEl = els[i].closest ? els[i].closest('[data-fc-slot]') : null;
            if (slotEl) return slotEl;
          }
          return null;
        }
      });

      bankEl.appendChild(card);
    });

    renderFlowchartDiagram($('fc-builder-diagram'), 'builder');

    const status = evaluateFlowchartState();
    const nextBtn = $('btn-scene3-next');
    const owlBubble = $('fc-owl-bubble');
    const statusText = $('fc-status-text');

    if (status.allCorrect) {
      nextBtn.disabled = false;
      nextBtn.textContent = '✨ つぎへ（プログラミングへ） ▶';
      statusText.textContent = '完璧なフローチャートが完成しました！';
      owlBubble.textContent = '「見事じゃ！完璧な設計図ができたな！いよいよブロックでプログラミングするぞ！」';
    } else if (status.allFilled) {
      nextBtn.disabled = true;
      nextBtn.textContent = '🔒 ただしい順番にしよう';
      statusText.textContent = '赤い枠のブロックを見直そう（タップで外せるよ）';
      owlBubble.textContent = '「おしい！赤い枠のところが ちがうみたいじゃ。タップして入れかえてみよう！」';
    } else {
      nextBtn.disabled = true;
      nextBtn.textContent = '🔒 かんせいしたら つぎへ ▶';
      statusText.textContent = 'ア〜カを すべて正しくうめよう！';
      owlBubble.textContent = '「このルールを フローチャートにしてみよう！真ん中のブロックを 右の『ア〜カ』へ ドラッグするのじゃ！」';
    }
  }

  // =========================================================================
  // SCENE 4：Scratch風ブロックプログラミング（段階別パレット＆枠外削除）
  // =========================================================================
  function isOutsideProgWorkspace(x, y) {
    const ws = $('prog-workspace');
    if (!ws) return false;
    const r = ws.getBoundingClientRect();
    return x < r.left || x > r.right || y < r.top || y > r.bottom;
  }

  function findExprSlotAt(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (let i = 0; i < els.length; i++) {
      const slotEl = els[i].closest ? els[i].closest('[data-slot-path]') : null;
      if (slotEl && slotEl.closest('#scene-4')) return slotEl;
    }
    return null;
  }

  function findStmtContainerAt(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (let i = 0; i < els.length; i++) {
      const container = els[i].closest ? els[i].closest('[data-container-id]') : null;
      if (container && container.closest('#scene-4')) return container;
    }
    for (let j = 0; j < els.length; j++) {
      if (els[j].id === 'prog-workspace' || els[j].id === 'prog-empty-hint') {
        return $('prog-list');
      }
    }
    return null;
  }

  // タップ時はめ込み用の、最初の空スロットを探す
  function findFirstCompatibleSlot(exprKind) {
    const allSlots = document.querySelectorAll('#prog-list [data-slot-path]');
    for (let i = 0; i < allSlots.length; i++) {
      const s = allSlots[i];
      const mode = s.dataset.slotMode;
      const isEmptyHole = s.classList.contains('scratch-hole');
      if (!isEmptyHole) continue;
      if (exprKind === 'var' && mode === 'var-only') return s.dataset.slotPath;
      if (exprKind !== 'var' && mode !== 'var-only') {
        // 入力欄が空ならそこへ
        const inp = s.querySelector('input');
        if (!inp || inp.value === '') return s.dataset.slotPath;
      }
    }
    // 変数なら var-only が空でなくても空の 'any' 穴を探す
    if (exprKind === 'var') {
      for (let j = 0; j < allSlots.length; j++) {
        const s2 = allSlots[j];
        if (s2.classList.contains('scratch-hole') && s2.dataset.slotMode === 'any') {
          const inp2 = s2.querySelector('input');
          if (!inp2 || inp2.value === '') return s2.dataset.slotPath;
        }
      }
    }
    return null;
  }

  function insertExprIntoSlot(slotPath, exprObj) {
    const ok = Blocks.setExprByPath(state.programBlocks, slotPath, Blocks.cloneExpr(exprObj));
    if (ok) {
      Sound.playSnap();
      activeSlotPath = null;
      activeSlotMode = null;
      saveState();
      renderScene4Programming();
    } else {
      Sound.playWarn();
    }
  }

  function renderScene4Programming() {
    const exec = Blocks.executeProgram(state.programBlocks);
    const evalRes = Curriculum.evaluateProgramProgress(state.programBlocks, exec.vars);
    const meta = Curriculum.getProgStageMeta(evalRes.stage);

    // 左：フローチャート（今組む部分のみ光る）
    renderFlowchartDiagram($('prog-flowchart-view'), 'prog', {
      highlightSlots: meta.highlightSlots
    });

    // 中央：水晶玉メッセージ（ア〜カは使わない！）
    $('prog-crystal-msg').textContent = '「' + meta.owlMsg + '」';

    // カテゴリ1：変わる数（数を入れる入れ物）
    const varsEl = $('prog-vars-palette');
    varsEl.innerHTML = '';
    meta.vars.forEach((vName) => {
      const chip = document.createElement('span');
      chip.className = 'scratch-oval scratch-var-oval';
      chip.textContent = vName;
      const exprObj = { kind: 'var', name: vName };

      attachPointerDrag(chip, {
        label: vName,
        onTap: () => {
          const targetPath = activeSlotPath || findFirstCompatibleSlot('var');
          if (targetPath) {
            insertExprIntoSlot(targetPath, exprObj);
          } else {
            Sound.playWarn();
          }
        },
        highlightFinder: (x, y) => findExprSlotAt(x, y),
        onDrop: (x, y) => {
          const slotEl = findExprSlotAt(x, y);
          if (slotEl) {
            insertExprIntoSlot(slotEl.dataset.slotPath, exprObj);
          }
        }
      });

      varsEl.appendChild(chip);
    });

    // カテゴリ2：命令・けいさんブロック
    const palEl = $('prog-palette');
    palEl.innerHTML = '';
    meta.commands.forEach((cmdType) => {
      const def = Blocks.PALETTE_DEFS[cmdType];
      if (!def) return;
      const item = document.createElement('div');
      item.className = 'palette-item ' + def.category + (def.kind === 'expr' ? ' is-expr-item' : '');
      item.innerHTML =
        '<span>' + escapeHtml(def.label) + '</span>' +
        '<span class="palette-add-badge">' + (def.kind === 'expr' ? 'はめる' : '+ 追加') + '</span>';

      if (def.kind === 'stmt') {
        attachPointerDrag(item, {
          label: def.label,
          onTap: () => {
            state.programBlocks.push(def.create());
            Sound.playSnap();
            saveState();
            renderScene4Programming();
          },
          highlightFinder: (x, y) => findStmtContainerAt(x, y),
          onDrop: (x, y) => {
            const containerEl = findStmtContainerAt(x, y);
            if (!containerEl) return;
            insertStmtAt(def.create(), containerEl, y);
          }
        });
      } else {
        // 緑の計算ブロック（丸穴にはめる）
        attachPointerDrag(item, {
          label: def.label,
          onTap: () => {
            const targetPath = (activeSlotPath && activeSlotMode !== 'var-only')
              ? activeSlotPath
              : findFirstCompatibleSlot('expr');
            if (targetPath) {
              insertExprIntoSlot(targetPath, def.create());
            } else {
              Sound.playWarn();
            }
          },
          highlightFinder: (x, y) => {
            const s = findExprSlotAt(x, y);
            return s && s.dataset.slotMode !== 'var-only' ? s : null;
          },
          onDrop: (x, y) => {
            const s = findExprSlotAt(x, y);
            if (s && s.dataset.slotMode !== 'var-only') {
              insertExprIntoSlot(s.dataset.slotPath, def.create());
            }
          }
        });
      }

      palEl.appendChild(item);
    });

    // カテゴリ3：ラッキーカラー（ステージC以降）
    const colorsSec = $('prog-colors-section');
    const colorsEl = $('prog-colors-palette');
    colorsEl.innerHTML = '';
    if (meta.colors.length > 0) {
      colorsSec.hidden = false;
      meta.colors.forEach((cName) => {
        const cInfo = Curriculum.getColorByName(cName);
        const chip = document.createElement('span');
        chip.className = 'scratch-oval scratch-color-oval';
        if (cInfo) {
          chip.style.background = cInfo.hex;
          chip.style.color = cInfo.textColor;
        }
        chip.textContent = cName;
        const exprObj = { kind: 'color', value: cName };

        attachPointerDrag(chip, {
          label: cName,
          onTap: () => {
            const targetPath = (activeSlotPath && activeSlotMode !== 'var-only')
              ? activeSlotPath
              : findFirstCompatibleSlot('color');
            if (targetPath) {
              insertExprIntoSlot(targetPath, exprObj);
            } else {
              Sound.playWarn();
            }
          },
          highlightFinder: (x, y) => {
            const s = findExprSlotAt(x, y);
            return s && s.dataset.slotMode !== 'var-only' ? s : null;
          },
          onDrop: (x, y) => {
            const s = findExprSlotAt(x, y);
            if (s && s.dataset.slotMode !== 'var-only') {
              insertExprIntoSlot(s.dataset.slotPath, exprObj);
            }
          }
        });

        colorsEl.appendChild(chip);
      });
    } else {
      colorsSec.hidden = true;
    }

    // 右上：組み立て済みブロックの描画（スクロール位置を維持して下端作業しやすくする）
    const wsEl = $('prog-workspace');
    const prevScrollTop = wsEl ? wsEl.scrollTop : 0;
    const listEl = $('prog-list');
    listEl.innerHTML = '';
    const blockOpts = {
      readOnly: false,
      activeSlotPath: activeSlotPath,
      onChange: () => {
        saveState();
        renderScene4RealtimeMonitor();
      },
      onSelectSlot: (slotPath, slotMode, keepFocus) => {
        if (!keepFocus) Sound.playSnap();
        activeSlotPath = activeSlotPath === slotPath && !keepFocus ? null : slotPath;
        activeSlotMode = activeSlotPath ? slotMode : null;
        if (!keepFocus) renderScene4Programming();
      },
      onUpdateNumSlot: (slotPath, val) => {
        const check = NgFilter.validateText(val);
        if (!check.ok) {
          showNgWarningModal();
          Blocks.setExprByPath(state.programBlocks, slotPath, { kind: 'num', value: '' });
          saveState();
          renderScene4Programming();
          return;
        }
        Blocks.setExprByPath(state.programBlocks, slotPath, { kind: 'num', value: val });
        saveState();
        renderScene4RealtimeMonitor();
      },
      attachStmtDrag: (headEl, blockId, blockType) => {
        const def = Blocks.PALETTE_DEFS[blockType];
        attachPointerDrag(headEl, {
          label: def ? def.label : 'ブロック',
          checkDeleteZone: (x, y) => isOutsideProgWorkspace(x, y),
          highlightFinder: (x, y) => (isOutsideProgWorkspace(x, y) ? null : findStmtContainerAt(x, y)),
          onTap: null,
          onDrop: (x, y) => {
            if (isOutsideProgWorkspace(x, y)) {
              const info = Blocks.findContainerInfo(state.programBlocks, blockId);
              if (info) {
                info.list.splice(info.index, 1);
                Sound.playSnap();
                saveState();
                renderScene4Programming();
              }
              return;
            }
            const containerEl = findStmtContainerAt(x, y);
            if (containerEl) {
              moveStmtToContainer(blockId, containerEl, y);
            }
          }
        });
      },
      attachExprDrag: (exprEl, slotPath, label, exprObj) => {
        attachPointerDrag(exprEl, {
          label: label,
          checkDeleteZone: (x, y) => isOutsideProgWorkspace(x, y),
          highlightFinder: (x, y) => (isOutsideProgWorkspace(x, y) ? null : findExprSlotAt(x, y)),
          onTap: () => {
            Sound.playSnap();
            const mode = exprEl.dataset.slotMode || 'any';
            activeSlotPath = activeSlotPath === slotPath ? null : slotPath;
            activeSlotMode = activeSlotPath ? mode : null;
            renderScene4Programming();
          },
          onDrop: (x, y) => {
            if (isOutsideProgWorkspace(x, y)) {
              const mode = exprEl.dataset.slotMode || 'any';
              Blocks.setExprByPath(
                state.programBlocks,
                slotPath,
                mode === 'var-only' ? null : { kind: 'num', value: '' }
              );
              Sound.playSnap();
              saveState();
              renderScene4Programming();
              return;
            }
            const targetSlot = findExprSlotAt(x, y);
            if (targetSlot && targetSlot.dataset.slotPath !== slotPath) {
              const targetPath = targetSlot.dataset.slotPath;
              if (targetPath.indexOf(slotPath + '.') === 0) return; // 自身の子孫へは移動不可
              const ok = Blocks.setExprByPath(state.programBlocks, targetPath, Blocks.cloneExpr(exprObj));
              if (ok) {
                const srcMode = exprEl.dataset.slotMode || 'any';
                Blocks.setExprByPath(
                  state.programBlocks,
                  slotPath,
                  srcMode === 'var-only' ? null : { kind: 'num', value: '' }
                );
                Sound.playSnap();
                saveState();
                renderScene4Programming();
              }
            }
          }
        });
      }
    };

    state.programBlocks.forEach((b) => {
      listEl.appendChild(Blocks.createBlockElement(b, blockOpts));
    });
    $('prog-empty-hint').hidden = state.programBlocks.length > 0;
    if (wsEl) wsEl.scrollTop = prevScrollTop;

    renderScene4RealtimeMonitor();
  }

  function insertStmtAt(newBlk, containerEl, y) {
    const containerKey = containerEl.dataset.containerId || 'root';
    const targetList = Blocks.findListByKey(state.programBlocks, containerKey);
    if (!targetList) return;

    let insertIdx = targetList.length;
    const directChildren = Array.from(containerEl.children).filter((c) => c.dataset && c.dataset.blockId);
    for (let i = 0; i < directChildren.length; i++) {
      const r = directChildren[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        insertIdx = i;
        break;
      }
    }
    targetList.splice(insertIdx, 0, newBlk);
    Sound.playSnap();
    saveState();
    renderScene4Programming();
  }

  function moveStmtToContainer(blockId, containerEl, y) {
    const info = Blocks.findContainerInfo(state.programBlocks, blockId);
    if (!info) return;
    const containerKey = containerEl.dataset.containerId || 'root';
    if (containerKey !== 'root' && Blocks.isDescendant(info.block, containerKey)) return;

    const targetList = Blocks.findListByKey(state.programBlocks, containerKey);
    if (!targetList) return;

    let insertIdx = targetList.length;
    const directChildren = Array.from(containerEl.children).filter((c) => c.dataset && c.dataset.blockId);
    for (let i = 0; i < directChildren.length; i++) {
      const r = directChildren[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        insertIdx = i;
        break;
      }
    }
    if (info.list === targetList && info.index < insertIdx) insertIdx -= 1;
    const moved = info.list.splice(info.index, 1)[0];
    targetList.splice(Math.max(0, Math.min(targetList.length, insertIdx)), 0, moved);
    Sound.playSnap();
    saveState();
    renderScene4Programming();
  }

  // 右下：正しいときにだけ変数結果ボックスを表示！
  function renderScene4RealtimeMonitor() {
    const exec = Blocks.executeProgram(state.programBlocks);
    const evalRes = Curriculum.evaluateProgramProgress(state.programBlocks, exec.vars);
    const v = exec.vars;
    const V = Curriculum.VAR_NAMES;

    const badgeMap = { A: 'ステップ 1/3', B: 'ステップ 2/3', C: 'ステップ 3/3', DONE: 'かんせい！' };
    $('prog-stage-badge').textContent = badgeMap[evalRes.stage] || '';

    const varsRow = $('rt-vars-row');
    varsRow.hidden = !evalRes.okA;

    $('rt-box-rawname').hidden = !(evalRes.okA && evalRes.hasRawName);
    $('rt-box-name').hidden = !evalRes.okA;
    $('rt-box-date').hidden = !evalRes.okA;
    $('rt-box-sum').hidden = !evalRes.okA;
    $('rt-box-rep').hidden = !evalRes.okB;
    $('rt-box-mod').hidden = !evalRes.okC;
    $('rt-box-color').hidden = !evalRes.okC;

    if (evalRes.okA) {
      if (evalRes.hasRawName) {
        $('rt-rawname').textContent = String(v[V.RAW_NAME]);
      }
      $('rt-name').textContent = String(v[V.NAME]);
      $('rt-date').textContent = String(v[V.DATE]);
      const initialSum = Number(v[V.NAME]) + Number(v[V.DATE]);
      $('rt-sum').textContent = String(initialSum);
    }
    if (evalRes.okB) {
      $('rt-rep').textContent = String(exec.afterRepeatVal !== null ? exec.afterRepeatVal : v[V.SUM]);
    }
    if (evalRes.okC) {
      $('rt-mod').textContent = String(v[V.MOD]);
      $('rt-color').textContent = String(v[V.COLOR] || '-');
    }

    const nextBtn = $('btn-scene4-next');
    const fb = $('rt-feedback');
    state.progCompleted = evalRes.stage === 'DONE';

    if (state.progCompleted) {
      if (state.maxUnlockedScene < 5) {
        state.maxUnlockedScene = 5;
        Sound.playClear();
      }
      nextBtn.disabled = false;
      nextBtn.textContent = '🔮 占いの館（シミュレータ）へ！ ▶';
      fb.textContent = '✨ すべてのプログラムが正しく動いたよ！占いの館へ進もう！';
    } else {
      nextBtn.disabled = true;
      nextBtn.textContent = '🔒 ぜんぶ組めたら 占いの館へ ▶';
      if (evalRes.wrongColorMsg) {
        fb.textContent = '💡 ' + evalRes.wrongColorMsg;
      } else if (evalRes.stage === 'A') {
        fb.textContent = '「名前」と「置きかえた数字」と「今日の日」を決め、「和」を＋で計算してみよう！';
      } else if (evalRes.stage === 'B') {
        fb.textContent = '和ができた！つぎは「5回くり返す」の中で「和 ÷ 2 を四捨五入」しよう！';
      } else if (!evalRes.okMod) {
        fb.textContent = 'くり返しOK！つぎは「7でわったあまり」を計算しよう！';
      } else {
        fb.textContent = 'あまりの分岐あと ' + evalRes.missingColors.length + '色（数字：' + evalRes.missingColors.join('・') + '）！';
      }
    }
    saveState();
  }

  // お助け（中途半端に1歩だけヒントを追加する）
  function applyOneStepAssist() {
    const exec = Blocks.executeProgram(state.programBlocks);
    const evalRes = Curriculum.evaluateProgramProgress(state.programBlocks, exec.vars);
    const V = Curriculum.VAR_NAMES;

    if (evalRes.stage === 'A') {
      const hasRaw = state.programBlocks.some((b) => b.type === 'cmd_set' && b.targetVar === V.RAW_NAME);
      const hasName = state.programBlocks.some((b) => b.type === 'cmd_set' && b.targetVar === V.NAME);
      const hasDate = state.programBlocks.some((b) => b.type === 'cmd_set' && b.targetVar === V.DATE);
      if (!hasRaw) {
        state.programBlocks.push(Blocks.hydrateBlocks([{ type: 'cmd_set', targetVar: V.RAW_NAME, valueExpr: { kind: 'num', value: 'さんすうしゅうた' } }])[0]);
      } else if (!hasName) {
        state.programBlocks.push(Blocks.hydrateBlocks([{
          type: 'cmd_set',
          targetVar: V.NAME,
          valueExpr: { kind: 'op_name_to_num', arg: { kind: 'var', name: V.RAW_NAME } }
        }])[0]);
      } else if (!hasDate) {
        state.programBlocks.push(Blocks.hydrateBlocks([{ type: 'cmd_set', targetVar: V.DATE, valueExpr: { kind: 'num', value: Curriculum.getTodayDayOfMonth() } }])[0]);
      } else {
        state.programBlocks.push(Blocks.hydrateBlocks([{
          type: 'cmd_set',
          targetVar: V.SUM,
          valueExpr: { kind: 'op_add', left: { kind: 'var', name: V.NAME }, right: null }
        }])[0]);
      }
    } else if (evalRes.stage === 'B') {
      const rep = state.programBlocks.find((b) => b.type === 'cmd_repeat');
      if (!rep) {
        state.programBlocks.push(Blocks.hydrateBlocks([{ type: 'cmd_repeat', count: 5, children: [] }])[0]);
      } else {
        rep.children.push(Blocks.hydrateBlocks([{
          type: 'cmd_set',
          targetVar: V.SUM,
          valueExpr: {
            kind: 'op_round',
            arg: { kind: 'op_div', left: null, right: { kind: 'num', value: 2 } }
          }
        }])[0]);
      }
    } else if (evalRes.stage === 'C') {
      if (!evalRes.okMod) {
        state.programBlocks.push(Blocks.hydrateBlocks([{
          type: 'cmd_set',
          targetVar: V.MOD,
          valueExpr: { kind: 'op_mod', left: { kind: 'var', name: V.SUM }, right: { kind: 'num', value: 7 } }
        }])[0]);
      } else if (evalRes.missingColors.length > 0) {
        // 1つだけ（あるいは残り2つ以下なら全部）ではなく、まず1つだけお助け
        const m = evalRes.missingColors[0];
        const col = Curriculum.getColorByMod(m);
        state.programBlocks.push(Blocks.hydrateBlocks([{
          type: 'cmd_if',
          leftExpr: { kind: 'var', name: V.MOD },
          rightVal: m,
          children: [{ type: 'cmd_set', targetVar: V.COLOR, valueExpr: { kind: 'color', value: col.name } }]
        }])[0]);
      }
    }
    Sound.playSnap();
    saveState();
    renderScene4Programming();
  }

  // =========================================================================
  // SCENE 5：魔法の占いの館シミュレータ
  // =========================================================================
  function stopSimTimers() {
    if (simRun && simRun.timer) {
      clearTimeout(simRun.timer);
      simRun.timer = null;
    }
  }

  function renderScene5Simulator() {
    stopSimTimers();
    const today = new Date();
    const dayNum = today.getDate();
    $('today-full-text').textContent = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + dayNum + '日';
    $('today-day-chip').textContent = String(dayNum);

    if (!state.programBlocks || state.programBlocks.length === 0) {
      state.programBlocks = Blocks.hydrateBlocks(Curriculum.getCompletePreset('さんすうしゅうた', dayNum));
      saveState();
    }

    $('auto-mode-toggle-wrap').hidden = !state.simFirstDone;
    $('chk-auto-mode').checked = !!state.simAutoMode;
    renderAncientGems();
    resetSimSession();
  }

  function renderAncientGems() {
    const row = $('ancient-gems-row');
    row.innerHTML = '';
    Curriculum.FORTUNE_COLORS.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ancient-gem-btn';
      btn.dataset.gemMod = String(c.mod);
      btn.innerHTML =
        '<span class="gem-sphere" style="--gem-hex:' + c.hex + '; --gem-glow:' + c.glow + ';">' + c.mod + '</span>' +
        '<span>' + c.name + '</span>';
      btn.addEventListener('click', () => handleGemChoice(c.mod));
      row.appendChild(btn);
    });
  }

  function resetSimSession() {
    stopSimTimers();
    const dayNum = Curriculum.getTodayDayOfMonth();
    simRun = {
      phase: 'WAIT_NAME',
      nameText: '',
      origNum: 0,
      currentNum: 0,
      dateDay: dayNum,
      loopIdx: 0
    };

    $('sim-name-input').disabled = false;
    $('sim-name-input').value = '';
    $('sim-char-cards').innerHTML = '<span style="font-size:0.78rem; color:#cfc2f7;">ひらがな・カタカナを入れると 1文字ずつ数字にかわるよ</span>';

    const card = $('magic-number-card');
    card.classList.add('is-empty');
    card.classList.remove('is-shaking');
    $('mnc-value').textContent = '----';
    $('mnc-op-tag').hidden = true;

    resetSimCrystalVisual();
    $('ancient-gems-panel').hidden = true;
    $('sim-crystal-speech').innerHTML = '「<ruby>名前<rt>なまえ</rt></ruby>を ひらがな（カタカナもOK）で 入力するのじゃ！」';

    renderSimFlowchartAndBlocks();
  }

  function resetSimCrystalVisual() {
    const ball = $('sim-crystal-ball');
    ball.classList.remove('is-pulsing');
    const body = ball.querySelector('.orb-body');
    body.style.background = '';
    body.style.boxShadow = '';
    $('sim-orb-inner').innerHTML = '<div class="orb-eyes"><span>✦</span><span>✦</span></div>';
  }

  function renderSimFlowchartAndBlocks() {
    const p = simRun ? simRun.phase : 'WAIT_NAME';
    const V = Curriculum.VAR_NAMES;
    let tapSlots = [];
    let flashSlots = [];

    if (p === 'ADD_DATE') tapSlots = ['イ'];
    else if (p.indexOf('LOOP_') === 0) tapSlots = ['ウ', 'エ', 'オ'];
    else if (p === 'MOD_7') tapSlots = ['カ'];
    else if (p === 'PICK_COLOR') flashSlots = ['カ'];

    const isAuto = !!(state.simFirstDone && state.simAutoMode);
    renderFlowchartDiagram($('sim-flowchart-view'), 'sim', {
      tapSlots: isAuto ? [] : tapSlots,
      flashSlots: isAuto ? tapSlots.concat(flashSlots) : flashSlots,
      onTapSlot: (slotKey) => handleSimFlowchartTap(slotKey)
    });

    const progEl = $('sim-program-view');
    progEl.innerHTML = '';
    state.programBlocks.forEach((b) => {
      progEl.appendChild(Blocks.createBlockElement(b, { readOnly: true }));
    });

    // 該当するScratchブロックを連動フラッシュ
    progEl.querySelectorAll('.prog-block').forEach((blkEl, idx) => {
      const bType = blkEl.dataset.blockType;
      if (p === 'ADD_DATE' && bType === 'cmd_set' && idx <= 2) {
        blkEl.classList.add('is-running');
      } else if (p.indexOf('LOOP_') === 0 && (bType === 'cmd_repeat' || blkEl.closest('[data-block-type="cmd_repeat"]'))) {
        blkEl.classList.add('is-running');
      } else if (p === 'MOD_7' && bType === 'cmd_set' && blkEl.textContent.indexOf(V.MOD) !== -1) {
        blkEl.classList.add('is-running');
      } else if (p === 'PICK_COLOR' && bType === 'cmd_if') {
        const pill = blkEl.querySelector('.blk-readonly-pill');
        if (pill && Number(pill.textContent) === simRun.currentNum) {
          blkEl.classList.add('is-running');
        }
      }
    });
  }

  function handleSimNameInput(rawText) {
    if (!simRun || (simRun.phase !== 'WAIT_NAME' && simRun.phase !== 'WAIT_DROP')) return;

    const check = NgFilter.validateText(rawText);
    if (!check.ok) {
      showNgWarningModal();
      $('sim-name-input').value = '';
      return;
    }

    const res = Curriculum.convertNameToNumbers(rawText);
    const cardsEl = $('sim-char-cards');
    const card = $('magic-number-card');

    if (res.items.length === 0) {
      simRun.phase = 'WAIT_NAME';
      simRun.origNum = 0;
      cardsEl.innerHTML = '<span style="font-size:0.78rem; color:#cfc2f7;">ひらがな・カタカナを入れると 1文字ずつ数字にかわるよ</span>';
      card.classList.add('is-empty');
      $('mnc-value').textContent = '----';
      $('sim-crystal-speech').innerHTML = '「<ruby>名前<rt>なまえ</rt></ruby>を ひらがな（カタカナもOK）で 入力するのじゃ！」';
      return;
    }

    cardsEl.innerHTML = '';
    res.items.forEach((item) => {
      const chip = document.createElement('div');
      chip.className = 'char-chip';
      chip.innerHTML = '<span class="ck">' + escapeHtml(item.char) + '</span><span class="cn">' + item.num + '</span>';
      cardsEl.appendChild(chip);
    });

    simRun.phase = 'WAIT_DROP';
    simRun.nameText = res.normalized;
    simRun.origNum = res.numberValue;
    simRun.currentNum = res.numberValue;

    card.classList.remove('is-empty');
    $('mnc-value').textContent = res.digitString;
    $('sim-crystal-speech').innerHTML =
      '「数字に変換したカード（<strong>' + escapeHtml(res.digitString) + '</strong>）を <strong>わたし（水晶玉）に 重ねるのじゃ！</strong>」';
  }

  function startSimRitualFromDrop() {
    if (!simRun || simRun.phase !== 'WAIT_DROP') return;

    $('sim-name-input').disabled = true;
    $('magic-number-card').classList.add('is-shaking');
    $('sim-crystal-ball').classList.add('is-pulsing');
    Sound.playSnap();

    simRun.phase = 'ADD_DATE';
    renderSimFlowchartAndBlocks();

    if (state.simFirstDone && state.simAutoMode) {
      $('sim-crystal-speech').innerHTML = '「⚡ 自動モード発動！魔力が流れはじめたぞ…！」';
      simRun.timer = setTimeout(runAutoSimSequence, 550);
    } else {
      $('sim-crystal-speech').innerHTML =
        '「カードが震えだしたぞ！さぁ、色が変わった フローチャート（<strong>名前の数に日付をたす</strong>）を タップするのじゃ！」';
    }
  }

  function animateFlyingOp(sourceEl, opLabel, nextValue, callback) {
    const chip = $('flying-op-chip');
    const card = $('magic-number-card');
    const srcRect = sourceEl.getBoundingClientRect();
    const dstRect = card.getBoundingClientRect();

    chip.textContent = opLabel;
    chip.style.transition = 'none';
    chip.style.left = (srcRect.left + srcRect.width / 2) + 'px';
    chip.style.top = (srcRect.top + srcRect.height / 2) + 'px';
    chip.style.transform = 'translate(-50%, -50%) scale(0.9)';
    chip.hidden = false;

    void chip.offsetWidth;
    chip.style.transition = 'left 0.42s cubic-bezier(0.22, 1, 0.36, 1), top 0.42s cubic-bezier(0.22, 1, 0.36, 1), transform 0.42s';
    chip.style.left = (dstRect.left + dstRect.width / 2) + 'px';
    chip.style.top = (dstRect.top + dstRect.height / 2) + 'px';
    chip.style.transform = 'translate(-50%, -50%) scale(1.12)';

    Sound.playStep();

    setTimeout(() => {
      chip.hidden = true;
      const tag = $('mnc-op-tag');
      tag.textContent = opLabel;
      tag.hidden = false;
      Sound.playSnap();

      setTimeout(() => {
        tag.hidden = true;
        simRun.currentNum = nextValue;
        $('mnc-value').textContent = String(nextValue);
        if (callback) callback();
      }, 240);
    }, 430);
  }

  function handleSimFlowchartTap(slotKey) {
    if (!simRun) return;
    if (simRun.phase === 'ADD_DATE' && slotKey === 'イ') {
      const nextVal = simRun.currentNum + simRun.dateDay;
      animateFlyingOp($('today-day-chip'), '＋' + simRun.dateDay, nextVal, () => {
        simRun.phase = 'LOOP_1';
        simRun.loopIdx = 1;
        renderSimFlowchartAndBlocks();
        $('sim-crystal-speech').innerHTML =
          '「日付が合体したぞ！つぎは『<strong>5回くり返す（÷2して四捨五入）</strong>』をタップするのじゃ！（<strong>1 / 5回目</strong>）」';
      });
    } else if (simRun.phase.indexOf('LOOP_') === 0 && (slotKey === 'ウ' || slotKey === 'エ' || slotKey === 'オ')) {
      const nextVal = Math.round(simRun.currentNum / 2);
      const srcEl = document.querySelector('#sim-flowchart-view [data-fc-slot="' + slotKey + '"]') || $('sim-flowchart-view');
      animateFlyingOp(srcEl, '÷2 四捨五入', nextVal, () => {
        if (simRun.loopIdx < 5) {
          simRun.loopIdx += 1;
          simRun.phase = 'LOOP_' + simRun.loopIdx;
          renderSimFlowchartAndBlocks();
          $('sim-crystal-speech').innerHTML =
            '「数字が半分になったぞ！もういちど『くり返し』をタップじゃ！（<strong>' + simRun.loopIdx + ' / 5回目</strong>）」';
        } else {
          simRun.phase = 'MOD_7';
          renderSimFlowchartAndBlocks();
          $('sim-crystal-speech').innerHTML =
            '「5回くり返し 完了じゃ！最後は『<strong>7でわったあまりがいくらか</strong>』をタップするのじゃ！」';
        }
      });
    } else if (simRun.phase === 'MOD_7' && slotKey === 'カ') {
      const rem = ((simRun.currentNum % 7) + 7) % 7;
      const srcEl = document.querySelector('#sim-flowchart-view [data-fc-slot="カ"]') || $('sim-flowchart-view');
      animateFlyingOp(srcEl, '÷7 のあまり', rem, () => {
        enterPickColorPhase(false);
      });
    }
  }

  function runAutoSimSequence() {
    if (!simRun) return;
    if (simRun.phase === 'ADD_DATE') {
      const nextVal = simRun.currentNum + simRun.dateDay;
      animateFlyingOp($('today-day-chip'), '＋' + simRun.dateDay, nextVal, () => {
        simRun.phase = 'LOOP_1';
        simRun.loopIdx = 1;
        renderSimFlowchartAndBlocks();
        simRun.timer = setTimeout(runAutoSimSequence, 220);
      });
    } else if (simRun.phase.indexOf('LOOP_') === 0) {
      const nextVal = Math.round(simRun.currentNum / 2);
      const srcEl = document.querySelector('#sim-flowchart-view [data-fc-slot="エ"]') || $('sim-flowchart-view');
      animateFlyingOp(srcEl, '÷2 四捨五入 (' + simRun.loopIdx + '/5)', nextVal, () => {
        if (simRun.loopIdx < 5) {
          simRun.loopIdx += 1;
          simRun.phase = 'LOOP_' + simRun.loopIdx;
          renderSimFlowchartAndBlocks();
          simRun.timer = setTimeout(runAutoSimSequence, 180);
        } else {
          simRun.phase = 'MOD_7';
          renderSimFlowchartAndBlocks();
          simRun.timer = setTimeout(runAutoSimSequence, 220);
        }
      });
    } else if (simRun.phase === 'MOD_7') {
      const rem = ((simRun.currentNum % 7) + 7) % 7;
      const srcEl = document.querySelector('#sim-flowchart-view [data-fc-slot="カ"]') || $('sim-flowchart-view');
      animateFlyingOp(srcEl, '÷7 のあまり', rem, () => {
        enterPickColorPhase(true);
      });
    }
  }

  function enterPickColorPhase(isAuto) {
    simRun.phase = 'PICK_COLOR';
    $('magic-number-card').classList.remove('is-shaking');
    renderSimFlowchartAndBlocks();
    $('ancient-gems-panel').hidden = false;

    if (isAuto) {
      $('sim-crystal-speech').innerHTML =
        '「出た数字は【<strong>' + simRun.currentNum + '</strong>】じゃ！いにしえのルールで色が変わるぞ…！」';
      simRun.timer = setTimeout(() => handleGemChoice(simRun.currentNum), 650);
    } else {
      $('sim-crystal-speech').innerHTML =
        '「出た数字は【<strong>' + simRun.currentNum + '</strong>】！では、<strong>いにしえのルール</strong>にしたがって、下の玉からカラーを決めるが良い！」';
    }
  }

  function handleGemChoice(chosenMod) {
    if (!simRun || simRun.phase !== 'PICK_COLOR') return;
    if (Number(chosenMod) !== simRun.currentNum) {
      Sound.playWarn();
      $('sim-crystal-speech').innerHTML =
        '「おっと！カードに出ている数字は【<strong>' + simRun.currentNum + '</strong>】じゃよ。おなじ数字の玉をえらぶのじゃ！」';
      return;
    }

    const color = Curriculum.getColorByMod(chosenMod);
    if (!color) return;

    simRun.phase = 'FINISHED';
    const ball = $('sim-crystal-ball');
    ball.classList.remove('is-pulsing');
    const body = ball.querySelector('.orb-body');
    body.style.background = 'radial-gradient(circle at 34% 28%, #ffffff 0%, ' + color.hex + ' 58%, #14052b 100%)';
    body.style.boxShadow = '0 0 38px ' + color.glow + ', inset 0 -10px 20px rgba(0,0,0,0.38)';
    $('sim-orb-inner').innerHTML =
      '<div style="font-size:1.5rem;">' + color.emoji + '</div>' +
      '<div style="font-size:0.9rem;">' + escapeHtml(color.name) + '</div>';

    $('sim-crystal-speech').innerHTML =
      '「✨ 今日の <strong>' + escapeHtml(simRun.nameText) + '</strong> さんのラッキーカラーは<br><strong style="font-size:1.15em; color:' + color.hex + '; text-shadow:0 0 8px #000;">【' + escapeHtml(color.name) + '】</strong> じゃ！<br><span style="font-size:0.86em;">' + escapeHtml(color.defaultMsg) + '</span>」';

    Sound.playMagicFinish();
    launchConfetti(color.hex);

    state.simFirstDone = true;
    state.lastSimResult = { name: simRun.nameText, color: color.name, mod: color.mod, date: simRun.dateDay };
    saveState();

    $('auto-mode-toggle-wrap').hidden = false;
    $('chk-auto-mode').checked = !!state.simAutoMode;
  }

  function launchConfetti(mainHex) {
    const canvas = $('confetti-canvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    const palette = [mainHex, '#ffe270', '#8ceeff', '#ffffff', '#ff7eb6'];

    const pieces = [];
    for (let i = 0; i < 46; i++) {
      pieces.push({
        x: rect.width / 2,
        y: rect.height * 0.45,
        vx: (Math.random() - 0.5) * 9,
        vy: (Math.random() - 0.85) * 8,
        size: 4 + Math.random() * 5,
        color: palette[i % palette.length],
        life: 60 + Math.random() * 25
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
  // 共通 Pointer Events ドラッグ＆ドロップ（枠外削除表示対応）
  // =========================================================================
  function attachPointerDrag(el, cfg) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('input, select, button')) return;
      e.stopPropagation();
      dragPayload = {
        cfg: cfg,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        pointerId: e.pointerId
      };
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragPayload || dragPayload.pointerId !== e.pointerId) return;
      const dist = Math.hypot(e.clientX - dragPayload.startX, e.clientY - dragPayload.startY);
      if (!dragPayload.active && dist > 9) {
        dragPayload.active = true;
        const ghost = $('drag-ghost');
        ghost.textContent = dragPayload.cfg.label;
        ghost.classList.remove('is-delete-zone');
        ghost.hidden = false;
      }
      if (dragPayload.active) {
        const ghost = $('drag-ghost');
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
        document.querySelectorAll('.is-drop-over').forEach((n) => n.classList.remove('is-drop-over'));

        const inDelete = dragPayload.cfg.checkDeleteZone && dragPayload.cfg.checkDeleteZone(e.clientX, e.clientY);
        ghost.classList.toggle('is-delete-zone', !!inDelete);
        ghost.textContent = inDelete ? '🗑️ はなすと消えるよ' : dragPayload.cfg.label;

        if (!inDelete && dragPayload.cfg.highlightFinder) {
          const target = dragPayload.cfg.highlightFinder(e.clientX, e.clientY);
          if (target) target.classList.add('is-drop-over');
        }
      }
    });

    const endHandler = (e) => {
      if (!dragPayload || dragPayload.pointerId !== e.pointerId) return;
      const wasActive = dragPayload.active;
      const cfgCopy = dragPayload.cfg;
      document.querySelectorAll('.is-drop-over').forEach((n) => n.classList.remove('is-drop-over'));
      const ghost = $('drag-ghost');
      ghost.hidden = true;
      ghost.classList.remove('is-delete-zone');
      dragPayload = null;

      if (!wasActive) {
        if (cfgCopy.onTap) cfgCopy.onTap();
      } else if (cfgCopy.onDrop) {
        cfgCopy.onDrop(e.clientX, e.clientY);
      }
    };

    el.addEventListener('pointerup', endHandler);
    el.addEventListener('pointercancel', endHandler);
  }

  function initSimCardDrag() {
    const card = $('magic-number-card');
    attachPointerDrag(card, {
      label: '🔮 数字カード',
      onTap: () => {
        if (!simRun || simRun.phase !== 'WAIT_DROP') return;
        const dz = $('sim-crystal-dropzone');
        dz.classList.add('is-drop-ready');
        setTimeout(() => dz.classList.remove('is-drop-ready'), 700);
      },
      highlightFinder: (x, y) => {
        if (!simRun || simRun.phase !== 'WAIT_DROP') return null;
        const dz = $('sim-crystal-dropzone');
        const r = dz.getBoundingClientRect();
        const over = x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 24 && y <= r.bottom + 24;
        dz.classList.toggle('is-drop-ready', over);
        return over ? dz : null;
      },
      onDrop: (x, y) => {
        const dz = $('sim-crystal-dropzone');
        dz.classList.remove('is-drop-ready');
        if (!simRun || simRun.phase !== 'WAIT_DROP') return;
        const r = dz.getBoundingClientRect();
        if (x >= r.left - 28 && x <= r.right + 28 && y >= r.top - 28 && y <= r.bottom + 28) {
          startSimRitualFromDrop();
        }
      }
    });
  }

  // =========================================================================
  // 先生・開発用メニュー & 初期化
  // =========================================================================
  function initTeacherAndSystemControls() {
    let tapCount = 0;
    let tapTimer = null;

    $('brand-secret-trigger').addEventListener('click', () => {
      tapCount += 1;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 2200);
      if (tapCount >= 5) {
        tapCount = 0;
        $('teacher-modal-backdrop').hidden = false;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
        $('teacher-modal-backdrop').hidden = false;
      }
    });

    $('btn-close-teacher').addEventListener('click', () => {
      $('teacher-modal-backdrop').hidden = true;
    });

    $('btn-unlock-all').addEventListener('click', () => {
      state.teacherMode = true;
      state.maxUnlockedScene = 5;
      saveState();
      $('teacher-modal-backdrop').hidden = true;
      goToScene(state.scene);
    });

    $('btn-fill-demo-all').addEventListener('click', () => {
      state.teacherMode = true;
      state.maxUnlockedScene = 5;
      Curriculum.FLOWCHART_SLOTS.forEach((s) => { state.fcSlots[s.key] = s.answerId; });
      state.fcCompleted = true;
      state.programBlocks = Blocks.hydrateBlocks(Curriculum.getCompletePreset('さんすうしゅうた', Curriculum.getTodayDayOfMonth()));
      state.progCompleted = true;
      saveState();
      $('teacher-modal-backdrop').hidden = true;
      goToScene(state.scene);
    });

    $('btn-hard-reset').addEventListener('click', () => {
      $('teacher-modal-backdrop').hidden = true;
      hardResetAll();
    });

    $('btn-dev-reset').addEventListener('click', () => {
      Sound.playSnap();
      showModal(
        '↺',
        '最初からやり直す？',
        '<p>保存しているフローチャート・プログラム・占い結果をリセットして、最初の画面にもどります。</p>',
        [
          { text: 'はい、リセットする', className: 'primary-magic-btn', onClick: hardResetAll },
          { text: 'やめる', className: 'mini-btn' }
        ]
      );
    });

    $('btn-open-rules').addEventListener('click', () => {
      Sound.playSnap();
      $('rules-modal-backdrop').hidden = false;
    });
    $('btn-close-rules').addEventListener('click', () => {
      $('rules-modal-backdrop').hidden = true;
    });

    function updateSoundIcon() {
      $('sound-icon').textContent = Sound.getMuted() ? '🔇' : '🔊';
    }
    $('btn-sound').addEventListener('click', () => {
      Sound.setMuted(!Sound.getMuted());
      updateSoundIcon();
      if (!Sound.getMuted()) Sound.playSnap();
    });
    updateSoundIcon();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    loadState();
    initServiceWorker();
    initTouchAndOrientationGuards();
    initTeacherAndSystemControls();
    initSimCardDrag();

    document.querySelectorAll('.scene-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const target = Number(pill.dataset.scene);
        if (!state.teacherMode && target > state.maxUnlockedScene) return;
        Sound.playSnap();
        goToScene(target);
      });
    });

    $('btn-scene1-next').addEventListener('click', () => {
      Sound.playSnap();
      if (state.maxUnlockedScene < 2) state.maxUnlockedScene = 2;
      goToScene(2);
    });

    $('btn-scene2-next').addEventListener('click', () => {
      Sound.playSnap();
      if (state.maxUnlockedScene < 3) state.maxUnlockedScene = 3;
      goToScene(3);
    });

    $('btn-fc-reset-slots').addEventListener('click', () => {
      Sound.playSnap();
      state.fcSlots = { 'ア': null, 'イ': null, 'ウ': null, 'エ': null, 'オ': null, 'カ': null };
      state.fcCompleted = false;
      selectedFcItemId = null;
      saveState();
      renderScene3Flowchart();
    });
    $('btn-scene3-next').addEventListener('click', () => {
      if (!state.fcCompleted) return;
      Sound.playSnap();
      goToScene(4);
    });

    $('btn-prog-assist').addEventListener('click', applyOneStepAssist);

    $('btn-prog-clear').addEventListener('click', () => {
      Sound.playSnap();
      state.programBlocks = [];
      activeSlotPath = null;
      activeSlotMode = null;
      saveState();
      renderScene4Programming();
    });

    $('btn-scene4-next').addEventListener('click', () => {
      if (!state.progCompleted) return;
      Sound.playSnap();
      goToScene(5);
    });

    $('sim-name-input').addEventListener('input', (e) => {
      handleSimNameInput(e.target.value);
    });
    $('btn-sim-reset-run').addEventListener('click', () => {
      Sound.playSnap();
      resetSimSession();
    });
    $('chk-auto-mode').addEventListener('change', (e) => {
      state.simAutoMode = !!e.target.checked;
      saveState();
      renderSimFlowchartAndBlocks();
    });

    goToScene(state.scene || 1);
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
