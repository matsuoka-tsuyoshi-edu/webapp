/**
 * ブロックエンジン＆インタプリタ（ドラッグ＆ドロップ＋タップ操作＋フラッシュ表示対応）
 */
(function (global) {
  'use strict';

  let idSeq = 1;
  function nextId() {
    idSeq += 1;
    return 'blk_' + Date.now().toString(36) + '_' + idSeq;
  }

  const BLOCK_CATALOG = {
    set_name: {
      type: 'set_name',
      category: 'cat-var',
      paletteLabel: '[名前] を (数字) にする',
      isContainer: false,
      createDefault: (ctx) => ({ id: nextId(), type: 'set_name', value: Number(ctx.nameNum) || 10332331 })
    },
    set_date: {
      type: 'set_date',
      category: 'cat-var',
      paletteLabel: '[日付] を (今日の日) にする',
      isContainer: false,
      createDefault: (ctx) => ({ id: nextId(), type: 'set_date', value: Number(ctx.todayDate) || 24 })
    },
    add_sum: {
      type: 'add_sum',
      category: 'cat-op',
      paletteLabel: '[名前と日付の和] を ([名前] + [日付]) にする',
      isContainer: false,
      createDefault: () => ({ id: nextId(), type: 'add_sum' })
    },
    repeat: {
      type: 'repeat',
      category: 'cat-ctrl',
      paletteLabel: '(5) 回くり返す { ... }',
      isContainer: true,
      createDefault: () => ({ id: nextId(), type: 'repeat', count: 5, children: [] })
    },
    halve_round: {
      type: 'halve_round',
      category: 'cat-op',
      paletteLabel: '[名前と日付の和] を (÷2して四捨五入) にする',
      isContainer: false,
      createDefault: () => ({ id: nextId(), type: 'halve_round' })
    },
    mod7: {
      type: 'mod7',
      category: 'cat-op',
      paletteLabel: '[7でわったあまり] を (和 ÷ 7 の余り) にする',
      isContainer: false,
      createDefault: () => ({ id: nextId(), type: 'mod7' })
    },
    if_mod: {
      type: 'if_mod',
      category: 'cat-ctrl',
      paletteLabel: 'もし <[7でわったあまり] = 0> なら { ... }',
      isContainer: true,
      createDefault: () => ({ id: nextId(), type: 'if_mod', modValue: 0, children: [] })
    },
    if_else_mod: {
      type: 'if_else_mod',
      category: 'cat-ctrl',
      paletteLabel: 'もし <[7でわったあまり] = 0> なら〜でなければ',
      isContainer: true,
      hasElse: true,
      createDefault: () => ({ id: nextId(), type: 'if_else_mod', modValue: 0, children: [], elseChildren: [] })
    },
    set_color: {
      type: 'set_color',
      category: 'cat-color',
      paletteLabel: '[今日のラッキーカラー] を (赤) にする',
      isContainer: false,
      createDefault: () => ({ id: nextId(), type: 'set_color', color: '赤' })
    }
  };

  function hydrateBlocks(rawList) {
    return (rawList || []).map((item) => {
      const cloned = {
        id: item.id || nextId(),
        type: item.type
      };
      if (item.value !== undefined) cloned.value = Number(item.value) || 0;
      if (item.count !== undefined) cloned.count = Number(item.count) || 1;
      if (item.modValue !== undefined) cloned.modValue = Number(item.modValue) || 0;
      if (item.color !== undefined) cloned.color = String(item.color);
      if (item.type === 'repeat' || item.type === 'if_mod' || item.type === 'if_else_mod') {
        cloned.children = hydrateBlocks(item.children || []);
      }
      if (item.type === 'if_else_mod') {
        cloned.elseChildren = hydrateBlocks(item.elseChildren || []);
      }
      return cloned;
    });
  }

  function createDefaultVars() {
    return {
      '名前': 0,
      '日付': 0,
      '名前と日付の和': 0,
      '7でわったあまり': '?',
      '今日のラッキーカラー': 'まだきまっていない'
    };
  }

  function buildExecutionTrace(blocks, overrideInput) {
    const vars = createDefaultVars();
    const trace = [];
    let guard = 0;
    const MAX_STEPS = 200;

    function pushStep(blockId, blockType, changedVar, log) {
      guard += 1;
      if (guard > MAX_STEPS) return;
      trace.push({
        blockId: blockId,
        blockType: blockType,
        changedVar: changedVar,
        log: log,
        vars: Object.assign({}, vars)
      });
    }

    function runList(list) {
      for (let i = 0; i < (list || []).length; i++) {
        if (guard >= MAX_STEPS) break;
        const b = list[i];

        if (b.type === 'set_name') {
          const val = overrideInput && overrideInput.nameNum !== undefined
            ? Number(overrideInput.nameNum)
            : Number(b.value) || 0;
          vars['名前'] = val;
          pushStep(b.id, b.type, '名前', '名前を「' + val + '」にしました。');
        } else if (b.type === 'set_date') {
          const val = overrideInput && overrideInput.dateNum !== undefined
            ? Number(overrideInput.dateNum)
            : Number(b.value) || 0;
          vars['日付'] = val;
          pushStep(b.id, b.type, '日付', '日付を「' + val + '」にしました。');
        } else if (b.type === 'add_sum') {
          const sum = Number(vars['名前']) + Number(vars['日付']);
          vars['名前と日付の和'] = sum;
          pushStep(b.id, b.type, '名前と日付の和', vars['名前'] + ' + ' + vars['日付'] + ' = ' + sum);
        } else if (b.type === 'repeat') {
          const cnt = Math.max(1, Math.min(20, Number(b.count) || 1));
          pushStep(b.id, b.type, null, cnt + '回くり返しを開始！');
          for (let r = 1; r <= cnt; r++) {
            if (guard >= MAX_STEPS) break;
            pushStep(b.id, b.type, null, r + '回目のくり返し');
            runList(b.children || []);
          }
        } else if (b.type === 'halve_round') {
          const prev = Number(vars['名前と日付の和']) || 0;
          const next = Math.round(prev / 2);
          vars['名前と日付の和'] = next;
          pushStep(b.id, b.type, '名前と日付の和', prev + ' ÷ 2 (四捨五入) → ' + next);
        } else if (b.type === 'mod7') {
          const cur = Number(vars['名前と日付の和']) || 0;
          const rem = ((cur % 7) + 7) % 7;
          vars['7でわったあまり'] = rem;
          pushStep(b.id, b.type, '7でわったあまり', cur + ' を 7 でわったあまり → ' + rem);
        } else if (b.type === 'if_mod') {
          const target = Number(b.modValue) || 0;
          const actual = vars['7でわったあまり'];
          const matched = actual !== '?' && Number(actual) === target;
          pushStep(b.id, b.type, null, 'あまり(' + actual + ') = ' + target + ' ？ → ' + (matched ? 'あたり！' : 'ちがう'));
          if (matched) runList(b.children || []);
        } else if (b.type === 'if_else_mod') {
          const target = Number(b.modValue) || 0;
          const actual = vars['7でわったあまり'];
          const matched = actual !== '?' && Number(actual) === target;
          pushStep(b.id, b.type, null, 'あまり(' + actual + ') = ' + target + ' ？');
          if (matched) runList(b.children || []);
          else runList(b.elseChildren || []);
        } else if (b.type === 'set_color') {
          vars['今日のラッキーカラー'] = b.color || '赤';
          pushStep(b.id, b.type, '今日のラッキーカラー', 'ラッキーカラー → ' + vars['今日のラッキーカラー']);
        }
      }
    }

    runList(blocks);
    return { trace: trace, finalVars: vars };
  }

  function findContainerInfo(rootList, targetId, parentList) {
    const list = parentList || rootList;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.id === targetId) return { list: list, index: i, block: b };
      if (b.children) {
        const res = findContainerInfo(rootList, targetId, b.children);
        if (res) return res;
      }
      if (b.elseChildren) {
        const res = findContainerInfo(rootList, targetId, b.elseChildren);
        if (res) return res;
      }
    }
    return null;
  }

  function findListByKey(rootList, containerKey) {
    if (!containerKey || containerKey === 'root') return rootList;
    const parts = containerKey.split(':');
    const blockId = parts[0];
    const slot = parts[1] || 'children';
    const info = findContainerInfo(rootList, blockId);
    if (!info) return null;
    if (slot === 'else') {
      info.block.elseChildren = info.block.elseChildren || [];
      return info.block.elseChildren;
    }
    info.block.children = info.block.children || [];
    return info.block.children;
  }

  function isDescendant(block, candidateId) {
    if (!block) return false;
    if (block.id === candidateId) return true;
    const lists = [block.children || [], block.elseChildren || []];
    for (let l = 0; l < lists.length; l++) {
      for (let i = 0; i < lists[l].length; i++) {
        if (isDescendant(lists[l][i], candidateId)) return true;
      }
    }
    return false;
  }

  function createBlockElement(block, options) {
    const opts = options || {};
    const readOnly = !!opts.readOnly;
    const meta = BLOCK_CATALOG[block.type];
    const el = document.createElement('div');
    el.className = 'prog-block ' + (meta ? meta.category : 'cat-var');
    el.dataset.blockId = block.id;
    el.dataset.blockType = block.type;

    const head = document.createElement('div');
    head.className = 'prog-block-head';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'prog-block-label';

    if (!readOnly) {
      const dragHandle = document.createElement('span');
      dragHandle.className = 'blk-drag-handle';
      dragHandle.textContent = '⠿';
      labelWrap.appendChild(dragHandle);
    }

    function addText(txt) {
      const s = document.createElement('span');
      s.textContent = txt;
      labelWrap.appendChild(s);
    }

    function addNumberInput(val, min, max, wide, onChange) {
      if (readOnly) {
        const pill = document.createElement('span');
        pill.className = 'blk-readonly-pill';
        pill.textContent = String(val);
        labelWrap.appendChild(pill);
        return;
      }
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'blk-input' + (wide ? ' blk-input-wide' : '');
      inp.value = val;
      inp.min = min;
      inp.max = max;
      inp.addEventListener('pointerdown', (e) => e.stopPropagation());
      inp.addEventListener('change', () => {
        let v = Number(inp.value);
        if (isNaN(v)) v = min;
        v = Math.max(min, Math.min(max, Math.round(v)));
        inp.value = v;
        onChange(v);
      });
      labelWrap.appendChild(inp);
    }

    if (block.type === 'set_name') {
      addText('[名前] を');
      addNumberInput(block.value, 0, 99999999999999, true, (v) => {
        block.value = v;
        if (opts.onChange) opts.onChange();
      });
      addText('にする');
    } else if (block.type === 'set_date') {
      addText('[日付] を');
      addNumberInput(block.value, 1, 31, false, (v) => {
        block.value = v;
        if (opts.onChange) opts.onChange();
      });
      addText('にする');
    } else if (block.type === 'add_sum') {
      addText('[名前と日付の和] を ([名前] + [日付]) にする');
    } else if (block.type === 'repeat') {
      addNumberInput(block.count, 1, 20, false, (v) => {
        block.count = v;
        if (opts.onChange) opts.onChange();
      });
      addText('回くり返す');
    } else if (block.type === 'halve_round') {
      addText('[名前と日付の和] を (([名前と日付の和] ÷ 2) を四捨五入) にする');
    } else if (block.type === 'mod7') {
      addText('[7でわったあまり] を ([名前と日付の和] を 7 でわった余り) にする');
    } else if (block.type === 'if_mod' || block.type === 'if_else_mod') {
      addText('もし <[7でわったあまり] =');
      if (readOnly) {
        const pill = document.createElement('span');
        pill.className = 'blk-readonly-pill';
        pill.textContent = String(block.modValue);
        labelWrap.appendChild(pill);
      } else {
        const sel = document.createElement('select');
        sel.className = 'blk-select';
        for (let m = 0; m <= 6; m++) {
          const opt = document.createElement('option');
          opt.value = String(m);
          opt.textContent = String(m);
          if (Number(block.modValue) === m) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener('pointerdown', (e) => e.stopPropagation());
        sel.addEventListener('change', () => {
          block.modValue = Number(sel.value);
          if (opts.onChange) opts.onChange();
        });
        labelWrap.appendChild(sel);
      }
      addText('> なら');
    } else if (block.type === 'set_color') {
      addText('[今日のラッキーカラー] を');
      if (readOnly) {
        const pill = document.createElement('span');
        pill.className = 'blk-readonly-pill';
        pill.textContent = block.color;
        labelWrap.appendChild(pill);
      } else {
        const sel = document.createElement('select');
        sel.className = 'blk-select';
        global.UranaiCurriculum.FORTUNE_COLORS.forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.emoji + ' ' + c.name;
          if (block.color === c.name) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('pointerdown', (e) => e.stopPropagation());
        sel.addEventListener('change', () => {
          block.color = sel.value;
          if (opts.onChange) opts.onChange();
        });
        labelWrap.appendChild(sel);
      }
      addText('にする');
    }

    head.appendChild(labelWrap);

    if (!readOnly) {
      const controls = document.createElement('div');
      controls.className = 'blk-controls';

      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.className = 'blk-ctrl-btn';
      btnUp.textContent = '▲';
      btnUp.addEventListener('pointerdown', (e) => e.stopPropagation());
      btnUp.addEventListener('click', () => opts.onMove && opts.onMove(block.id, -1));

      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.className = 'blk-ctrl-btn';
      btnDown.textContent = '▼';
      btnDown.addEventListener('pointerdown', (e) => e.stopPropagation());
      btnDown.addEventListener('click', () => opts.onMove && opts.onMove(block.id, 1));

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'blk-ctrl-btn';
      btnDel.textContent = '✕';
      btnDel.addEventListener('pointerdown', (e) => e.stopPropagation());
      btnDel.addEventListener('click', () => opts.onDelete && opts.onDelete(block.id));

      controls.appendChild(btnUp);
      controls.appendChild(btnDown);
      controls.appendChild(btnDel);
      head.appendChild(controls);

      if (opts.attachDragStart) {
        opts.attachDragStart(head, { mode: 'move', blockId: block.id, label: labelWrap.textContent });
      }
    }

    el.appendChild(head);

    if (block.type === 'repeat' || block.type === 'if_mod' || block.type === 'if_else_mod') {
      const nest = renderNestArea(block, 'children', 'このなかに ブロックを入れる', opts);
      el.appendChild(nest);

      if (block.type === 'if_else_mod') {
        const elseLabel = document.createElement('div');
        elseLabel.className = 'prog-nest-footer';
        elseLabel.textContent = 'でなければ';
        el.appendChild(elseLabel);
        const elseNest = renderNestArea(block, 'else', 'ちがうときの ブロックを入れる', opts);
        el.appendChild(elseNest);
      }
    }

    return el;
  }

  function renderNestArea(block, slot, titleText, opts) {
    const nest = document.createElement('div');
    nest.className = 'prog-nest';

    if (!opts.readOnly) {
      const hdr = document.createElement('div');
      hdr.className = 'prog-nest-header';
      const span = document.createElement('span');
      span.textContent = titleText;
      hdr.appendChild(span);

      const quickBtn = document.createElement('button');
      quickBtn.type = 'button';
      quickBtn.className = 'blk-ctrl-btn';
      quickBtn.textContent = '+ なかに追加';
      quickBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      quickBtn.addEventListener('click', () => opts.onQuickAddInside && opts.onQuickAddInside(block.id, slot));
      hdr.appendChild(quickBtn);
      nest.appendChild(hdr);
    }

    const dropList = document.createElement('div');
    dropList.className = 'nest-drop-list';
    const containerKey = block.id + ':' + slot;
    dropList.dataset.containerId = containerKey;

    const listArr = slot === 'else' ? (block.elseChildren || []) : (block.children || []);
    listArr.forEach((child) => {
      dropList.appendChild(createBlockElement(child, opts));
    });

    nest.appendChild(dropList);
    return nest;
  }

  global.UranaiBlocks = {
    BLOCK_CATALOG: BLOCK_CATALOG,
    hydrateBlocks: hydrateBlocks,
    createDefaultVars: createDefaultVars,
    buildExecutionTrace: buildExecutionTrace,
    findContainerInfo: findContainerInfo,
    findListByKey: findListByKey,
    isDescendant: isDescendant,
    createBlockElement: createBlockElement
  };
})(window);
