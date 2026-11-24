/**
 * Scratch風 ネスト式ブロック＆式エンジン（命令ブロック＋丸い変数・演算はめ込み対応）
 */
(function (global) {
  'use strict';

  let idSeq = 1;
  function nextId() {
    idSeq += 1;
    return 'blk_' + Date.now().toString(36) + '_' + idSeq;
  }

  const PALETTE_DEFS = {
    cmd_set: {
      kind: 'stmt',
      type: 'cmd_set',
      category: 'cat-var',
      label: '[ 〇〇 ] を ( 〇〇 ) にする',
      create: () => ({ id: nextId(), type: 'cmd_set', targetVar: null, valueExpr: { kind: 'num', value: '' } })
    },
    cmd_repeat: {
      kind: 'stmt',
      type: 'cmd_repeat',
      category: 'cat-ctrl',
      label: '( 5 ) 回くり返す { ... }',
      create: () => ({ id: nextId(), type: 'cmd_repeat', count: 5, children: [] })
    },
    cmd_if: {
      kind: 'stmt',
      type: 'cmd_if',
      category: 'cat-ctrl',
      label: 'もし < ( 〇〇 ) = ( 0 ) > なら { ... }',
      create: () => ({ id: nextId(), type: 'cmd_if', leftExpr: null, rightVal: 0, children: [] })
    },
    op_name_to_num: {
      kind: 'expr',
      type: 'op_name_to_num',
      category: 'cat-op',
      label: '( 〇〇 ) を数字に置きかえる',
      create: () => ({ kind: 'op_name_to_num', arg: null })
    },
    op_add: {
      kind: 'expr',
      type: 'op_add',
      category: 'cat-op',
      label: '( 〇〇 ) ＋ ( 〇〇 )',
      create: () => ({ kind: 'op_add', left: null, right: null })
    },
    op_div: {
      kind: 'expr',
      type: 'op_div',
      category: 'cat-op',
      label: '( 〇〇 ) ÷ ( 2 )',
      create: () => ({ kind: 'op_div', left: null, right: { kind: 'num', value: 2 } })
    },
    op_round: {
      kind: 'expr',
      type: 'op_round',
      category: 'cat-op',
      label: '( 〇〇 ) を四捨五入',
      create: () => ({ kind: 'op_round', arg: null })
    },
    op_mod: {
      kind: 'expr',
      type: 'op_mod',
      category: 'cat-op',
      label: '( 〇〇 ) を ( 7 ) でわったあまり',
      create: () => ({ kind: 'op_mod', left: null, right: { kind: 'num', value: 7 } })
    }
  };

  function cloneExpr(expr) {
    if (!expr) return null;
    const out = { kind: expr.kind };
    if (expr.name !== undefined) out.name = expr.name;
    if (expr.value !== undefined) out.value = expr.value;
    if (expr.left !== undefined) out.left = cloneExpr(expr.left);
    if (expr.right !== undefined) out.right = cloneExpr(expr.right);
    if (expr.arg !== undefined) out.arg = cloneExpr(expr.arg);
    return out;
  }

  function hydrateBlocks(rawList) {
    return (rawList || []).map((b) => {
      const cloned = { id: b.id || nextId(), type: b.type };
      if (b.type === 'cmd_set') {
        cloned.targetVar = b.targetVar || null;
        cloned.valueExpr = cloneExpr(b.valueExpr);
      } else if (b.type === 'cmd_repeat') {
        cloned.count = b.count !== undefined ? Number(b.count) : 5;
        cloned.children = hydrateBlocks(b.children || []);
      } else if (b.type === 'cmd_if') {
        cloned.leftExpr = cloneExpr(b.leftExpr);
        cloned.rightVal = b.rightVal !== undefined ? Number(b.rightVal) : 0;
        cloned.children = hydrateBlocks(b.children || []);
      }
      return cloned;
    });
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
    }
    return null;
  }

  function findListByKey(rootList, containerKey) {
    if (!containerKey || containerKey === 'root') return rootList;
    const info = findContainerInfo(rootList, containerKey);
    if (!info) return null;
    info.block.children = info.block.children || [];
    return info.block.children;
  }

  function isDescendant(block, candidateId) {
    if (!block) return false;
    if (block.id === candidateId) return true;
    const ch = block.children || [];
    for (let i = 0; i < ch.length; i++) {
      if (isDescendant(ch[i], candidateId)) return true;
    }
    return false;
  }

  // スロットパス操作 (例: "blk_1|val.left")
  function getExprByPath(rootList, slotPath) {
    const [blockId, propPath] = slotPath.split('|');
    const info = findContainerInfo(rootList, blockId);
    if (!info) return null;
    const blk = info.block;
    const parts = propPath.split('.');
    if (parts[0] === 'target') return blk.targetVar ? { kind: 'var', name: blk.targetVar } : null;
    let cur = parts[0] === 'val' ? blk.valueExpr : (parts[0] === 'left' ? blk.leftExpr : null);
    for (let i = 1; i < parts.length; i++) {
      if (!cur) return null;
      cur = cur[parts[i]];
    }
    return cur || null;
  }

  function setExprByPath(rootList, slotPath, newExpr) {
    const [blockId, propPath] = slotPath.split('|');
    const info = findContainerInfo(rootList, blockId);
    if (!info) return false;
    const blk = info.block;
    const parts = propPath.split('.');

    if (parts[0] === 'target') {
      if (newExpr === null) {
        blk.targetVar = null;
        return true;
      }
      if (newExpr.kind === 'var') {
        blk.targetVar = newExpr.name;
        return true;
      }
      return false;
    }

    if (parts.length === 1) {
      if (parts[0] === 'val') blk.valueExpr = newExpr;
      else if (parts[0] === 'left') blk.leftExpr = newExpr;
      return true;
    }

    let cur = parts[0] === 'val' ? blk.valueExpr : (parts[0] === 'left' ? blk.leftExpr : null);
    for (let i = 1; i < parts.length - 1; i++) {
      if (!cur) return false;
      cur = cur[parts[i]];
    }
    if (!cur) return false;
    cur[parts[parts.length - 1]] = newExpr;
    return true;
  }

  // =========================================================================
  // 式評価＆プログラム実行
  // =========================================================================
  function evalExpr(expr, vars) {
    if (!expr) return null;
    if (expr.kind === 'num') {
      if (expr.value === '' || expr.value === null || expr.value === undefined) return null;
      const str = String(expr.value).trim();
      if (!str) return null;
      if (/^-?\d+(\.\d+)?$/.test(str)) {
        return Number(str);
      }
      return str;
    }
    if (expr.kind === 'color') return expr.value || null;
    if (expr.kind === 'var') {
      return Object.prototype.hasOwnProperty.call(vars, expr.name) ? vars[expr.name] : null;
    }
    if (expr.kind === 'op_name_to_num') {
      const a = evalExpr(expr.arg, vars);
      if (a === null || a === '') return null;
      if (typeof a === 'number') return a;
      const conv = global.UranaiCurriculum.convertNameToNumbers(String(a));
      return conv.items.length > 0 ? conv.numberValue : null;
    }
    if (expr.kind === 'op_add') {
      const l = evalExpr(expr.left, vars);
      const r = evalExpr(expr.right, vars);
      if (typeof l !== 'number' || typeof r !== 'number') return null;
      return l + r;
    }
    if (expr.kind === 'op_div') {
      const l = evalExpr(expr.left, vars);
      const r = evalExpr(expr.right, vars);
      if (typeof l !== 'number' || typeof r !== 'number' || r === 0) return null;
      return l / r;
    }
    if (expr.kind === 'op_round') {
      const a = evalExpr(expr.arg, vars);
      if (typeof a !== 'number') return null;
      return Math.round(a);
    }
    if (expr.kind === 'op_mod') {
      const l = evalExpr(expr.left, vars);
      const r = evalExpr(expr.right, vars);
      if (typeof l !== 'number' || typeof r !== 'number' || r === 0) return null;
      return ((l % r) + r) % r;
    }
    return null;
  }

  function executeProgram(blocks) {
    const vars = {};
    let afterRepeatVal = null;
    let guard = 0;

    function runList(list) {
      for (let i = 0; i < (list || []).length; i++) {
        if (guard > 300) break;
        guard += 1;
        const b = list[i];
        if (b.type === 'cmd_set' && b.targetVar) {
          const val = evalExpr(b.valueExpr, vars);
          if (val !== null) {
            vars[b.targetVar] = val;
          }
        } else if (b.type === 'cmd_repeat') {
          const cnt = Math.max(1, Math.min(20, Number(b.count) || 1));
          for (let r = 0; r < cnt; r++) {
            runList(b.children || []);
          }
          if (vars['置き換えた数字と今日の日の和'] !== undefined) {
            afterRepeatVal = vars['置き換えた数字と今日の日の和'];
          }
        } else if (b.type === 'cmd_if') {
          const lv = evalExpr(b.leftExpr, vars);
          if (lv !== null && Number(lv) === Number(b.rightVal)) {
            runList(b.children || []);
          }
        }
      }
    }

    runList(blocks);
    return { vars: vars, afterRepeatVal: afterRepeatVal };
  }

  // =========================================================================
  // Scratch風 DOM レンダリング
  // =========================================================================
  function createExprSlotElement(expr, slotPath, slotMode, opts) {
    // slotMode: 'var-only' | 'any' | 'expr-only'
    const readOnly = !!opts.readOnly;
    const isActive = !readOnly && opts.activeSlotPath === slotPath;

    // 変数オーバルが入っていて、それがドラッグ可能な場合
    if (expr && expr.kind === 'var') {
      const chip = document.createElement('span');
      chip.className = 'scratch-oval scratch-var-oval' + (isActive ? ' is-slot-active' : '');
      chip.textContent = expr.name;
      chip.dataset.slotPath = slotPath;
      chip.dataset.slotMode = slotMode;
      if (!readOnly) {
        chip.title = '枠の外へドラッグで外す／タップで別の変数に入替';
        opts.attachExprDrag(chip, slotPath, expr.name, expr);
      }
      return chip;
    }

    if (expr && expr.kind === 'color') {
      const chip = document.createElement('span');
      chip.className = 'scratch-oval scratch-color-oval' + (isActive ? ' is-slot-active' : '');
      chip.textContent = expr.value;
      chip.dataset.slotPath = slotPath;
      chip.dataset.slotMode = slotMode;
      if (!readOnly) {
        opts.attachExprDrag(chip, slotPath, expr.value, expr);
      }
      return chip;
    }

    // 緑の演算ブロックが入っている場合
    if (expr && expr.kind && expr.kind.indexOf('op_') === 0) {
      const opEl = document.createElement('span');
      opEl.className = 'scratch-op-oval';
      opEl.dataset.slotPath = slotPath;
      opEl.dataset.slotMode = slotMode;

      const addTxt = (t) => {
        const s = document.createElement('span');
        s.textContent = t;
        opEl.appendChild(s);
      };

      if (expr.kind === 'op_name_to_num') {
        opEl.appendChild(createExprSlotElement(expr.arg, slotPath + '.arg', 'any', opts));
        addTxt('を数字に置きかえる');
      } else if (expr.kind === 'op_add') {
        opEl.appendChild(createExprSlotElement(expr.left, slotPath + '.left', 'any', opts));
        addTxt('＋');
        opEl.appendChild(createExprSlotElement(expr.right, slotPath + '.right', 'any', opts));
      } else if (expr.kind === 'op_div') {
        opEl.appendChild(createExprSlotElement(expr.left, slotPath + '.left', 'any', opts));
        addTxt('÷');
        opEl.appendChild(createExprSlotElement(expr.right, slotPath + '.right', 'any', opts));
      } else if (expr.kind === 'op_round') {
        opEl.appendChild(createExprSlotElement(expr.arg, slotPath + '.arg', 'any', opts));
        addTxt('を四捨五入');
      } else if (expr.kind === 'op_mod') {
        opEl.appendChild(createExprSlotElement(expr.left, slotPath + '.left', 'any', opts));
        addTxt('を');
        opEl.appendChild(createExprSlotElement(expr.right, slotPath + '.right', 'any', opts));
        addTxt('でわったあまり');
      }

      if (!readOnly) {
        opts.attachExprDrag(opEl, slotPath, '計算ブロック', expr);
      }
      return opEl;
    }

    // 空スロット または 数値入力スロット
    const hole = document.createElement('span');
    hole.className = 'scratch-hole' + (slotMode === 'var-only' ? ' is-var-hole' : '') + (isActive ? ' is-slot-active' : '');
    hole.dataset.slotPath = slotPath;
    hole.dataset.slotMode = slotMode;

    if (readOnly) {
      hole.textContent = expr && expr.kind === 'num' && expr.value !== '' ? String(expr.value) : '〇〇';
      return hole;
    }

    if (slotMode === 'var-only') {
      hole.textContent = '〇〇';
      hole.addEventListener('click', (e) => {
        e.stopPropagation();
        opts.onSelectSlot(slotPath, slotMode);
      });
      return hole;
    }

    // 数値・文字入力とオーバルはめ込みの両対応穴
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'scratch-hole-input';
    inp.placeholder = '〇〇';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.value = expr && expr.kind === 'num' && expr.value !== '' && expr.value !== null ? String(expr.value) : '';
    const syncWidth = () => {
      const len = Math.max(3, (inp.value || '').length + 1);
      inp.style.width = Math.min(18, len * 1.1) + 'ch';
    };
    syncWidth();
    inp.addEventListener('pointerdown', (e) => e.stopPropagation());
    inp.addEventListener('focus', () => opts.onSelectSlot(slotPath, slotMode, true));
    inp.addEventListener('input', () => {
      syncWidth();
      opts.onUpdateNumSlot(slotPath, inp.value);
    });
    hole.addEventListener('click', (e) => {
      if (e.target !== inp) {
        opts.onSelectSlot(slotPath, slotMode);
      }
    });
    hole.appendChild(inp);
    return hole;
  }

  function createBlockElement(block, opts) {
    const readOnly = !!opts.readOnly;
    const def = PALETTE_DEFS[block.type];
    const el = document.createElement('div');
    el.className = 'prog-block scratch-stmt ' + (def ? def.category : 'cat-var');
    el.dataset.blockId = block.id;
    el.dataset.blockType = block.type;

    const head = document.createElement('div');
    head.className = 'prog-block-head';

    const labelWrap = document.createElement('div');
    labelWrap.className = 'prog-block-label';

    const addTxt = (t) => {
      const s = document.createElement('span');
      s.textContent = t;
      labelWrap.appendChild(s);
    };

    if (block.type === 'cmd_set') {
      const targetExpr = block.targetVar ? { kind: 'var', name: block.targetVar } : null;
      labelWrap.appendChild(createExprSlotElement(targetExpr, block.id + '|target', 'var-only', opts));
      addTxt('を');
      labelWrap.appendChild(createExprSlotElement(block.valueExpr, block.id + '|val', 'any', opts));
      addTxt('にする');
    } else if (block.type === 'cmd_repeat') {
      if (readOnly) {
        const p = document.createElement('span');
        p.className = 'blk-readonly-pill';
        p.textContent = String(block.count);
        labelWrap.appendChild(p);
      } else {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'scratch-hole-input is-inline-num';
        inp.min = 1;
        inp.max = 20;
        inp.value = String(block.count);
        inp.addEventListener('pointerdown', (e) => e.stopPropagation());
        inp.addEventListener('change', () => {
          let v = Math.max(1, Math.min(20, Math.round(Number(inp.value) || 5)));
          inp.value = String(v);
          block.count = v;
          if (opts.onChange) opts.onChange();
        });
        labelWrap.appendChild(inp);
      }
      addTxt('回くり返す');
    } else if (block.type === 'cmd_if') {
      addTxt('もし 〈');
      labelWrap.appendChild(createExprSlotElement(block.leftExpr, block.id + '|left', 'any', opts));
      addTxt('=');
      if (readOnly) {
        const p = document.createElement('span');
        p.className = 'blk-readonly-pill';
        p.textContent = String(block.rightVal);
        labelWrap.appendChild(p);
      } else {
        const sel = document.createElement('select');
        sel.className = 'blk-select';
        for (let m = 0; m <= 6; m++) {
          const opt = document.createElement('option');
          opt.value = String(m);
          opt.textContent = String(m);
          if (Number(block.rightVal) === m) opt.selected = true;
          sel.appendChild(opt);
        }
        sel.addEventListener('pointerdown', (e) => e.stopPropagation());
        sel.addEventListener('change', () => {
          block.rightVal = Number(sel.value);
          if (opts.onChange) opts.onChange();
        });
        labelWrap.appendChild(sel);
      }
      addTxt('〉なら');
    }

    head.appendChild(labelWrap);

    if (!readOnly && opts.attachStmtDrag) {
      opts.attachStmtDrag(head, block.id, block.type);
    }

    el.appendChild(head);

    if (block.type === 'cmd_repeat' || block.type === 'cmd_if') {
      const nest = document.createElement('div');
      nest.className = 'prog-nest';

      const dropList = document.createElement('div');
      dropList.className = 'nest-drop-list';
      dropList.dataset.containerId = block.id;

      (block.children || []).forEach((child) => {
        dropList.appendChild(createBlockElement(child, opts));
      });

      if (!readOnly && (block.children || []).length === 0) {
        const hint = document.createElement('div');
        hint.className = 'nest-empty-hint';
        hint.textContent = 'ここにブロックを入れる';
        dropList.appendChild(hint);
      }

      nest.appendChild(dropList);
      el.appendChild(nest);

      const foot = document.createElement('div');
      foot.className = 'prog-nest-footer';
      foot.textContent = block.type === 'cmd_repeat' ? 'ここまで くり返す' : 'ここまで もし';
      el.appendChild(foot);
    }

    return el;
  }

  global.UranaiBlocks = {
    PALETTE_DEFS: PALETTE_DEFS,
    cloneExpr: cloneExpr,
    hydrateBlocks: hydrateBlocks,
    findContainerInfo: findContainerInfo,
    findListByKey: findListByKey,
    isDescendant: isDescendant,
    getExprByPath: getExprByPath,
    setExprByPath: setExprByPath,
    executeProgram: executeProgram,
    createBlockElement: createBlockElement
  };
})(window);
