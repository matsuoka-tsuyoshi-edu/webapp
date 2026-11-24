/**
 * 魔法の占いの館 - メインアプリケーション (v2.0 5シーンウィザード＆魔法シミュレータ)
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'uranai_app_v2_state';
  const BUILD_VER = '20261124-04';

  const NgFilter = global.UranaiNgFilter;
  const Sound = global.UranaiSound;
  const Curriculum = global.UranaiCurriculum;
  const Blocks = global.UranaiBlocks;

  const $ = (id) => document.getElementById(id);

  // =========================================================================
  // アプリ状態（localStorage 保存対象）
  // =========================================================================
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

  // シーン内の一時状態
  let selectedFcItemId = null;
  let dragPayload = null;
  let simRun = null; // { phase, nameText, origNum, currentNum, dateDay, loopCount, timer }

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
    saveState();
    goToScene(1);
  }

  // =========================================================================
  // Service Worker（キャッシュ無効化）＆ ピンチ・ダブルタップ完全抑止
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
        const isInteractive = e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, .fc-card, .fc-slot, .palette-item, .magic-number-card, .ancient-gem-btn, .brand-area');
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

    // 「きめ方をみる」ボタンは Scene 3〜5 で常設表示
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

    // 0〜6 の分岐ラベル
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
    // すでに別のスロットにあれば外す
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
  // SCENE 4：ブロックプログラミング（1画面・フローチャート連動ステップ解放方式）
  // =========================================================================
  function getCurrentProgStage() {
    const b = state.programBlocks;
    if (!Curriculum.checkStageA(b)) return 'A';
    if (!Curriculum.checkStageB(b)) return 'B';
    if (!Curriculum.checkStageC(b)) return 'C';
    return 'DONE';
  }

  function renderScene4Programming() {
    const stageId = getCurrentProgStage();
    const meta = Curriculum.getProgStageMeta(stageId);

    // 左：フローチャート（今組む部分をハイライト）
    renderFlowchartDiagram($('prog-flowchart-view'), 'prog', {
      highlightSlots: meta.highlightSlots
    });

    // 中央：水晶玉メッセージ＆パレット
    $('prog-crystal-msg').textContent = '「' + meta.owlMsg + '」';
    const paletteEl = $('prog-palette');
    paletteEl.innerHTML = '';

    meta.allowedBlocks.forEach((type) => {
      const cat = Blocks.BLOCK_CATALOG[type];
      if (!cat) return;
      const item = document.createElement('div');
      item.className = 'palette-item ' + cat.category;
      item.innerHTML =
        '<span>' + escapeHtml(cat.paletteLabel) + '</span>' +
        '<span class="palette-add-badge">+ 追加</span>';

      attachPointerDrag(item, {
        label: cat.paletteLabel,
        onTap: () => addBlockToProgContainer(type, 'root'),
        onDrop: (x, y) => dropBlockAt(x, y, { mode: 'create', blockType: type }),
        highlightFinder: (x, y) => findProgDropTarget(x, y)
      });

      paletteEl.appendChild(item);
    });

    $('prog-helper-area').hidden = stageId !== 'C';

    // 右上：組み立て済みブロックリスト
    const listEl = $('prog-list');
    listEl.innerHTML = '';
    const options = {
      onChange: () => {
        saveState();
        renderScene4RealtimeMonitor();
      },
      onMove: (blockId, dir) => {
        Sound.playSnap();
        const info = Blocks.findContainerInfo(state.programBlocks, blockId);
        if (!info) return;
        const nextIdx = info.index + dir;
        if (nextIdx < 0 || nextIdx >= info.list.length) return;
        const removed = info.list.splice(info.index, 1)[0];
        info.list.splice(nextIdx, 0, removed);
        saveState();
        renderScene4Programming();
      },
      onDelete: (blockId) => {
        Sound.playSnap();
        const info = Blocks.findContainerInfo(state.programBlocks, blockId);
        if (!info) return;
        info.list.splice(info.index, 1);
        saveState();
        renderScene4Programming();
      },
      onQuickAddInside: (blockId, slot) => {
        openQuickAddInsideModal(blockId, slot);
      },
      attachDragStart: (el, payload) => {
        attachPointerDrag(el, {
          label: payload.label,
          onTap: null,
          onDrop: (x, y) => dropBlockAt(x, y, payload),
          highlightFinder: (x, y) => findProgDropTarget(x, y)
        });
      }
    };

    state.programBlocks.forEach((b) => {
      listEl.appendChild(Blocks.createBlockElement(b, options));
    });
    $('prog-empty-hint').hidden = state.programBlocks.length > 0;

    renderScene4RealtimeMonitor();
  }

  function renderScene4RealtimeMonitor() {
    const stageId = getCurrentProgStage();
    const stageNumMap = { A: 'ミッション 1/3', B: 'ミッション 2/3', C: 'ミッション 3/3', DONE: 'かんせい！' };
    $('prog-stage-badge').textContent = stageNumMap[stageId] || '';

    // サンプル入力「さんすうしゅうた」= 10332331 ＋ 今日の日付でリアルタイム解釈
    const exec = Blocks.buildExecutionTrace(state.programBlocks, {
      nameNum: 10332331,
      dateNum: Curriculum.getTodayDayOfMonth()
    });
    const v = exec.finalVars;

    $('rt-name').textContent = state.programBlocks.some((b) => b.type === 'set_name') ? String(v['名前']) : '-';
    $('rt-date').textContent = state.programBlocks.some((b) => b.type === 'set_date') ? String(v['日付']) : '-';
    $('rt-sum').textContent = v['名前と日付の和'] ? String(v['名前と日付の和']) : '-';
    $('rt-mod').textContent = v['7でわったあまり'] !== '?' ? String(v['7でわったあまり']) : '-';
    $('rt-color').textContent = v['今日のラッキーカラー'] !== 'まだきまっていない' ? v['今日のラッキーカラー'] : '-';

    const nextBtn = $('btn-scene4-next');
    const fb = $('rt-feedback');

    state.progCompleted = stageId === 'DONE';
    if (state.progCompleted) {
      if (state.maxUnlockedScene < 5) {
        state.maxUnlockedScene = 5;
        Sound.playClear();
      }
      nextBtn.disabled = false;
      nextBtn.textContent = '🔮 占いの館（シミュレータ）へ！ ▶';
      fb.textContent = '✨ すべての手順がつながりました！占いの館へ進もう！';
    } else {
      nextBtn.disabled = true;
      nextBtn.textContent = '🔒 ぜんぶ組めたら 占いの館へ ▶';
      if (stageId === 'A') {
        fb.textContent = 'まずは [名前]・[日付]・[名前と日付の和] を組んでみよう！';
      } else if (stageId === 'B') {
        fb.textContent = '和が計算できた！つぎは [5回くり返す] の中に [÷2して四捨五入] を入れよう！';
      } else {
        fb.textContent = 'くり返し完了！つぎは [7でわったあまり] と 0〜6 の [もし〜なら] を並べよう！';
      }
    }
    saveState();
  }

  function findProgDropTarget(x, y) {
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

  function addBlockToProgContainer(blockType, containerKey, insertIdx) {
    const cat = Blocks.BLOCK_CATALOG[blockType];
    if (!cat) return;
    const targetList = Blocks.findListByKey(state.programBlocks, containerKey || 'root');
    if (!targetList) return;
    const newBlk = cat.createDefault({
      nameNum: 10332331,
      todayDate: Curriculum.getTodayDayOfMonth()
    });
    if (typeof insertIdx === 'number' && insertIdx >= 0 && insertIdx <= targetList.length) {
      targetList.splice(insertIdx, 0, newBlk);
    } else {
      targetList.push(newBlk);
    }
    Sound.playSnap();
    saveState();
    renderScene4Programming();
  }

  function dropBlockAt(x, y, payload) {
    const containerEl = findProgDropTarget(x, y);
    if (!containerEl) return;
    const containerKey = containerEl.dataset.containerId || 'root';

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
      addBlockToProgContainer(payload.blockType, containerKey, insertIdx);
      return;
    }

    if (payload.mode === 'move') {
      const info = Blocks.findContainerInfo(state.programBlocks, payload.blockId);
      if (!info) return;
      const targetBlockId = containerKey === 'root' ? null : containerKey.split(':')[0];
      if (targetBlockId && Blocks.isDescendant(info.block, targetBlockId)) return;
      const targetList = Blocks.findListByKey(state.programBlocks, containerKey);
      if (!targetList) return;
      if (info.list === targetList && info.index < insertIdx) insertIdx -= 1;
      const moved = info.list.splice(info.index, 1)[0];
      targetList.splice(Math.max(0, Math.min(targetList.length, insertIdx)), 0, moved);
      Sound.playSnap();
      saveState();
      renderScene4Programming();
    }
  }

  function openQuickAddInsideModal(blockId, slot) {
    const meta = Curriculum.getProgStageMeta(getCurrentProgStage());
    const allowed = meta.allowedBlocks.filter((t) => {
      const c = Blocks.BLOCK_CATALOG[t];
      return c && !c.isContainer;
    });

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

    $('modal-body').querySelectorAll('[data-quick-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        addBlockToProgContainer(btn.dataset.quickType, blockId + ':' + slot);
        closeModal();
      });
    });
  }

  // =========================================================================
  // SCENE 5：魔法の占いの館シミュレータ（ハリー・ポッター／ドクター・ストレンジ風）
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

    // プログラムが未完成（先生スキップ等で直接来た場合）は完成プリセットを補完
    if (!state.programBlocks || state.programBlocks.length === 0) {
      state.programBlocks = Blocks.hydrateBlocks(Curriculum.getCompletePreset(10332331, dayNum));
      saveState();
    }

    // 自動モードUI表示制御（初回完了後に解放）
    $('auto-mode-toggle-wrap').hidden = !state.simFirstDone;
    $('chk-auto-mode').checked = !!state.simAutoMode;

    // 7つのリアル魔法の玉を描画
    renderAncientGems();

    // 初期状態リセット
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
      phase: 'WAIT_NAME', // WAIT_NAME -> WAIT_DROP -> ADD_DATE -> LOOP_1..5 -> MOD_7 -> PICK_COLOR -> FINISHED
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
    let tapSlots = [];
    let flashSlots = [];
    let flashBlockTypes = [];

    if (p === 'ADD_DATE') {
      tapSlots = ['イ'];
      flashBlockTypes = ['set_name', 'set_date', 'add_sum'];
    } else if (p.indexOf('LOOP_') === 0) {
      tapSlots = ['ウ', 'エ', 'オ'];
      flashBlockTypes = ['repeat', 'halve_round'];
    } else if (p === 'MOD_7') {
      tapSlots = ['カ'];
      flashBlockTypes = ['mod7'];
    } else if (p === 'PICK_COLOR') {
      flashSlots = ['カ'];
      flashBlockTypes = ['if_mod', 'if_else_mod', 'set_color'];
    }

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

    // 該当ブロックをフラッシュ
    if (flashBlockTypes.length > 0) {
      progEl.querySelectorAll('.prog-block').forEach((blkEl) => {
        const bType = blkEl.dataset.blockType;
        if (flashBlockTypes.indexOf(bType) !== -1) {
          if (p === 'PICK_COLOR' && (bType === 'if_mod' || bType === 'if_else_mod')) {
            // 該当する余りの分岐ブロックを強く光らせる
            const pill = blkEl.querySelector('.blk-readonly-pill');
            if (pill && Number(pill.textContent) === simRun.currentNum) {
              blkEl.classList.add('is-running');
            }
          } else {
            blkEl.classList.add('is-running');
          }
        }
      });
    }
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
    const card = $('magic-number-card');
    card.classList.add('is-shaking');
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

  // 飛んでいく演算ブロック演出 → 数字カードにガシャンと合体＆変化
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
        enterPickColorPhase();
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
  // 共通 Pointer Events ドラッグ＆ドロップヘルパー
  // =========================================================================
  function attachPointerDrag(el, cfg) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('input, select, button')) return;
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
        ghost.hidden = false;
      }
      if (dragPayload.active) {
        const ghost = $('drag-ghost');
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
        document.querySelectorAll('.is-drop-over').forEach((n) => n.classList.remove('is-drop-over'));
        if (dragPayload.cfg.highlightFinder) {
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
      $('drag-ghost').hidden = true;
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
        // タップ時は水晶玉ドロップゾーンを強調して誘導
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
      state.programBlocks = Blocks.hydrateBlocks(Curriculum.getCompletePreset(10332331, Curriculum.getTodayDayOfMonth()));
      state.progCompleted = true;
      saveState();
      $('teacher-modal-backdrop').hidden = true;
      goToScene(state.scene);
    });

    $('btn-hard-reset').addEventListener('click', () => {
      $('teacher-modal-backdrop').hidden = true;
      hardResetAll();
    });

    // ヘッダー常設「↺ リセット」ボタン
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

    // 常設「📜 きめ方をみる」モーダル
    $('btn-open-rules').addEventListener('click', () => {
      Sound.playSnap();
      $('rules-modal-backdrop').hidden = false;
    });
    $('btn-close-rules').addEventListener('click', () => {
      $('rules-modal-backdrop').hidden = true;
    });

    // サウンド
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

    // シーン進行バー
    document.querySelectorAll('.scene-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const target = Number(pill.dataset.scene);
        if (!state.teacherMode && target > state.maxUnlockedScene) return;
        Sound.playSnap();
        goToScene(target);
      });
    });

    // Scene 1 -> 2
    $('btn-scene1-next').addEventListener('click', () => {
      Sound.playSnap();
      if (state.maxUnlockedScene < 2) state.maxUnlockedScene = 2;
      goToScene(2);
    });

    // Scene 2 -> 3
    $('btn-scene2-next').addEventListener('click', () => {
      Sound.playSnap();
      if (state.maxUnlockedScene < 3) state.maxUnlockedScene = 3;
      goToScene(3);
    });

    // Scene 3 フローチャートリセット & 次へ
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

    // Scene 4 プログラミング操作
    $('btn-prog-example').addEventListener('click', () => {
      Sound.playSnap();
      state.programBlocks = Blocks.hydrateBlocks(Curriculum.getCompletePreset(10332331, Curriculum.getTodayDayOfMonth()));
      saveState();
      renderScene4Programming();
    });

    $('btn-prog-clear').addEventListener('click', () => {
      Sound.playSnap();
      state.programBlocks = [];
      saveState();
      renderScene4Programming();
    });

    $('btn-add-remaining-colors').addEventListener('click', () => {
      Sound.playSnap();
      const existingMods = {};
      state.programBlocks.forEach((b) => {
        if (b.type === 'if_mod' || b.type === 'if_else_mod') existingMods[String(b.modValue)] = true;
      });
      Curriculum.FORTUNE_COLORS.forEach((c) => {
        if (!existingMods[String(c.mod)]) {
          state.programBlocks.push(Blocks.hydrateBlocks([{
            type: 'if_mod',
            modValue: c.mod,
            children: [{ type: 'set_color', color: c.name }]
          }])[0]);
        }
      });
      saveState();
      renderScene4Programming();
    });

    $('btn-scene4-next').addEventListener('click', () => {
      if (!state.progCompleted) return;
      Sound.playSnap();
      goToScene(5);
    });

    // Scene 5 シミュレータ入力・リセット・自動モード
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
