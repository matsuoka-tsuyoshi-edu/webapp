import { AGE_LEVELS, applyI18nToDOM, t, tPlain } from './i18n.js';
import {
  GRID_SIZE,
  STROKE_COLORS,
  STROKE_WIDTHS,
  buildAngleArcPaths,
  buildArcSvgPath,
  cloneObject,
  createPresetShape,
  detectAngleAtTap,
  detectRightAngleAtEndpoint,
  findEdgeNearPoint,
  findPerpendicularSnap,
  flipObjectHorizontal,
  getObjectCenter,
  getTransformHandles,
  hitTestObject,
  resolveColor,
  resolveFillColor,
  snapPoint,
  snapValue,
  splitPolygon,
  translateObject,
  uid
} from './shapes.js';
import { createZipBlob, readZipBuffer } from './zip.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// アプリ状態
const state = {
  objects: [],
  history: [],
  historyIndex: -1,
  view: { x: 0, y: 0, scale: 1, minScale: 0.35, maxScale: 3.5 },
  tool: 'select',       // 'select' | 'pan' | 'point' | 'line' | 'place' | 'compass' | 'angle' | 'edge_mark' | 'eraser' | 'scissors'
  pointerToolMode: 'select', // 'select' | 'pan'
  lineOrPointMode: 'line',   // 'line' | 'point'
  lineSubType: 'line_segment',
  placeSubType: 'tri_equilateral',
  edgeMarkMode: 'parallel',  // 'parallel' | 'equal'
  angleFillMode: false,
  defaultStyle: {
    strokeColor: 'default',
    strokeWidth: 2,
    lineStyle: 'solid',
    fillEnabled: true
  },
  style: {
    strokeColor: 'default',
    strokeWidth: 2,
    lineStyle: 'solid',
    fillEnabled: true
  },
  snapEnabled: true,
  darkMode: false,
  ageLevel: 'elem_high',
  loupeMode: 'auto', // 'auto' | 'always' | 'off'
  selectedId: null,
  selectedIds: [],
  multiSelectAddMode: false,
  transformTargetId: null,
  transformSubMode: 'both', // 'both' | 'rotate' | 'scale' | 'vertex'
  bgImage: null // { dataUrl, bytes, mime, ext, width, height, opacity, scale, x, y }
};

// DOM参照
const svg = document.getElementById('board-svg');
const viewportGroup = document.getElementById('viewport-group');
const bgImageLayer = document.getElementById('bg-image-layer');
const objectsLayer = document.getElementById('objects-layer');
const previewLayer = document.getElementById('preview-layer');
const overlayLayer = document.getElementById('overlay-layer');
const loupeLayer = document.getElementById('loupe-layer');
const loupeUse = document.getElementById('loupe-use');
const loupeClipCircle = document.getElementById('loupe-clip-circle');
const loupeShadow = document.getElementById('loupe-shadow');
const loupeBg = document.getElementById('loupe-bg');
const loupeRing = document.getElementById('loupe-ring');
const loupeCrossH = document.getElementById('loupe-cross-h');
const loupeCrossV = document.getElementById('loupe-cross-v');
const loupeCenterDot = document.getElementById('loupe-center-dot');
const multiBar = document.getElementById('multi-bar');
const angleBar = document.getElementById('angle-bar');
const markBar = document.getElementById('mark-bar');
const transformBar = document.getElementById('transform-bar');
const bgControls = document.getElementById('bg-controls');
const toastEl = document.getElementById('toast');

// インタラクション用ランタイム変数
const activePointers = new Map();
let interaction = null; // 現在の単一/変形/描画セッション
let longPressTimer = null;
let compassPinnedAnchor = null; // PC/単指フォールバック用支点
let toastTimer = null;
let dragSnapshotDirty = false;

// --- 初期化 ---
function init() {
  loadPreferences();
  centerViewOrigin();
  buildStaticMenus();
  bindUIEvents();
  bindCanvasEvents();
  registerServiceWorker();
  pushHistory();
  applyTheme();
  applyLanguage();
  updateToolbarState();
  renderAll();
}

function loadPreferences() {
  try {
    const savedDark = localStorage.getItem('mathnote_dark');
    if (savedDark === '1') state.darkMode = true;
    const savedAge = localStorage.getItem('mathnote_age');
    if (savedAge && AGE_LEVELS.some((a) => a.id === savedAge)) {
      state.ageLevel = savedAge;
    }
    const savedLoupe = localStorage.getItem('mathnote_loupe');
    if (savedLoupe === 'auto' || savedLoupe === 'always' || savedLoupe === 'off') {
      state.loupeMode = savedLoupe;
    }
  } catch (_) {}
}

function savePreferences() {
  try {
    localStorage.setItem('mathnote_dark', state.darkMode ? '1' : '0');
    localStorage.setItem('mathnote_age', state.ageLevel);
    localStorage.setItem('mathnote_loupe', state.loupeMode);
  } catch (_) {}
}

function centerViewOrigin() {
  const rect = svg.getBoundingClientRect();
  state.view.x = Math.round(rect.width / 2);
  state.view.y = Math.round(rect.height / 2);
  state.view.scale = 1;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
}

// --- 履歴 (Undo / Redo) ---
function pushHistory() {
  const snap = JSON.stringify(state.objects);
  if (state.historyIndex >= 0 && state.history[state.historyIndex] === snap) return;
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snap);
  if (state.history.length > 60) state.history.shift();
  state.historyIndex = state.history.length - 1;
  updateHistoryButtons();
}

function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex--;
  state.objects = JSON.parse(state.history[state.historyIndex]);
  clearSelectionAndTransform();
  updateHistoryButtons();
  renderAll();
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  state.objects = JSON.parse(state.history[state.historyIndex]);
  clearSelectionAndTransform();
  updateHistoryButtons();
  renderAll();
}

function updateHistoryButtons() {
  document.getElementById('btn-undo').disabled = state.historyIndex <= 0;
  document.getElementById('btn-redo').disabled = state.historyIndex >= state.history.length - 1;
}

// --- 座標変換・スナップ ---
function clientToWorld(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - state.view.x) / state.view.scale,
    y: (sy - state.view.y) / state.view.scale
  };
}

function collectOtherVertices(excludeId) {
  const pts = [];
  for (const obj of state.objects) {
    if (obj.id === excludeId) continue;
    if (obj.kind === 'polygon') {
      obj.vertices.forEach((v) => pts.push({ x: v.x, y: v.y }));
    } else if (obj.kind === 'line') {
      pts.push({ x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 });
    } else if (obj.kind === 'point') {
      pts.push({ x: obj.x, y: obj.y });
    } else if (obj.kind === 'circle' || obj.kind === 'arc') {
      pts.push({ x: obj.cx, y: obj.cy });
    }
  }
  return pts;
}

function snapWorldPoint(wx, wy, excludeId = null) {
  if (!state.snapEnabled) return { x: wx, y: wy };
  const magDist = 18 / state.view.scale;
  const targets = collectOtherVertices(excludeId);
  let best = null;
  let minD = magDist;
  for (const tp of targets) {
    const d = Math.hypot(wx - tp.x, wy - tp.y);
    if (d < minD) {
      minD = d;
      best = { x: tp.x, y: tp.y };
    }
  }
  if (best) return best;
  return snapPoint(wx, wy, GRID_SIZE);
}

function computeMoveDeltaWithSnap(obj, rawDx, rawDy, baseObj) {
  if (!state.snapEnabled) return { dx: rawDx, dy: rawDy };

  const threshold = 22 / state.view.scale;
  const targets = collectOtherVertices(obj.id);

  let candidateVerts = [];
  if (baseObj.kind === 'polygon') {
    candidateVerts = baseObj.vertices.map((v) => ({ x: v.x + rawDx, y: v.y + rawDy }));
  } else if (baseObj.kind === 'line') {
    candidateVerts = [
      { x: baseObj.x1 + rawDx, y: baseObj.y1 + rawDy },
      { x: baseObj.x2 + rawDx, y: baseObj.y2 + rawDy }
    ];
  } else if (baseObj.kind === 'point') {
    candidateVerts = [{ x: baseObj.x + rawDx, y: baseObj.y + rawDy }];
  } else if (baseObj.kind === 'circle' || baseObj.kind === 'arc') {
    candidateVerts = [{ x: baseObj.cx + rawDx, y: baseObj.cy + rawDy }];
  } else {
    return { dx: rawDx, dy: rawDy };
  }

  // 1. 他図形頂点へのマグネットスナップ優先
  let bestMag = null;
  let minMag = threshold;
  for (const cv of candidateVerts) {
    for (const tv of targets) {
      const d = Math.hypot(cv.x - tv.x, cv.y - tv.y);
      if (d < minMag) {
        minMag = d;
        bestMag = { dx: rawDx + (tv.x - cv.x), dy: rawDy + (tv.y - cv.y) };
      }
    }
  }
  if (bestMag) return bestMag;

  // 2. 方眼交点へのスナップ（最も交点に近い頂点を基準）
  let bestGrid = { dx: rawDx, dy: rawDy };
  let minGrid = Infinity;
  for (const cv of candidateVerts) {
    const gx = snapValue(cv.x, GRID_SIZE);
    const gy = snapValue(cv.y, GRID_SIZE);
    const d = Math.hypot(cv.x - gx, cv.y - gy);
    if (d < minGrid) {
      minGrid = d;
      bestGrid = { dx: rawDx + (gx - cv.x), dy: rawDy + (gy - cv.y) };
    }
  }
  return bestGrid;
}

// --- 静的メニュー生成・UIイベント ---
function buildStaticMenus() {
  const swatchGrid = document.getElementById('swatch-grid');
  swatchGrid.innerHTML = '';
  for (const col of STROKE_COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch-btn';
    btn.style.background = col.swatch;
    btn.dataset.colorId = col.id;
    btn.title = col.label;
    btn.addEventListener('click', () => {
      state.style.strokeColor = col.id;
      applyStyleToSelection({ strokeColor: col.id });
      updateToolbarState();
      closeAllPopovers();
    });
    swatchGrid.appendChild(btn);
  }

  const widthList = document.getElementById('width-list');
  widthList.innerHTML = '';
  for (const w of STROKE_WIDTHS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pop-item';
    btn.dataset.widthVal = String(w.value);
    btn.innerHTML = `<span class="width-line-preview" style="height:${w.value}px"></span><span>${w.label} (${w.value}px)</span>`;
    btn.addEventListener('click', () => {
      state.style.strokeWidth = w.value;
      applyStyleToSelection({ strokeWidth: w.value });
      updateToolbarState();
      closeAllPopovers();
    });
    widthList.appendChild(btn);
  }

  const ageList = document.getElementById('age-list');
  ageList.innerHTML = '';
  for (const lv of AGE_LEVELS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pop-item';
    btn.dataset.ageId = lv.id;
    btn.textContent = lv.label;
    btn.addEventListener('click', () => {
      state.ageLevel = lv.id;
      savePreferences();
      applyLanguage();
      updateToolbarState();
      closeAllPopovers();
    });
    ageList.appendChild(btn);
  }
}

function applyStyleToSelection(patch) {
  const ids = state.transformTargetId
    ? [state.transformTargetId]
    : (state.selectedIds.length > 0 ? state.selectedIds : (state.selectedId ? [state.selectedId] : []));

  if (ids.length === 0) {
    Object.assign(state.defaultStyle, patch);
    Object.assign(state.style, patch);
    return;
  }

  let changed = false;
  for (const id of ids) {
    const obj = state.objects.find((o) => o.id === id);
    if (!obj) continue;
    Object.assign(obj, patch);
    if (obj.kind === 'angle_arc' && patch.strokeColor) {
      obj.fillColor = patch.strokeColor;
    }
    changed = true;
  }
  Object.assign(state.style, patch);
  if (changed) {
    pushHistory();
    renderAll();
  }
}

function syncStyleFromSelection() {
  const targetId = state.transformTargetId || state.selectedId || state.selectedIds[state.selectedIds.length - 1];
  const obj = targetId ? state.objects.find((o) => o.id === targetId) : null;
  if (obj) {
    state.style.strokeColor = obj.strokeColor || 'default';
    state.style.strokeWidth = obj.strokeWidth || 2;
    state.style.lineStyle = obj.lineStyle || 'solid';
    if (typeof obj.fillEnabled === 'boolean') {
      state.style.fillEnabled = obj.fillEnabled;
    }
  } else {
    state.style = { ...state.defaultStyle };
  }
}

function expandSelectionWithGroups(seedIds) {
  const idSet = new Set(seedIds);
  const groupIds = new Set();
  for (const obj of state.objects) {
    if (idSet.has(obj.id) && obj.groupId) groupIds.add(obj.groupId);
  }
  if (groupIds.size > 0) {
    for (const obj of state.objects) {
      if (obj.groupId && groupIds.has(obj.groupId)) idSet.add(obj.id);
    }
  }
  return Array.from(idSet);
}

function setSelectionIds(ids) {
  const valid = expandSelectionWithGroups(ids).filter((id) => state.objects.some((o) => o.id === id));
  state.selectedIds = valid;
  state.selectedId = valid.length > 0 ? valid[valid.length - 1] : null;
  syncStyleFromSelection();
  updateToolbarState();
  updateMultiBarUI();
}

function closeAllPopovers() {
  document.querySelectorAll('.popover-menu.open').forEach((m) => m.classList.remove('open'));
}

function openPopoverNearButton(menuId, anchorEl, placement = 'top') {
  const menu = document.getElementById(menuId);
  const wasOpen = menu.classList.contains('open');
  closeAllPopovers();
  if (wasOpen) return;

  menu.classList.add('open');
  const rect = anchorEl.getBoundingClientRect();
  const mRect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left;
  let top;
  if (placement === 'left-dock') {
    left = rect.right + 10;
    top = Math.max(10, Math.min(vh - mRect.height - 10, rect.top + rect.height / 2 - mRect.height / 2));
  } else if (placement === 'right-dock') {
    left = rect.left - mRect.width - 10;
    top = Math.max(10, Math.min(vh - mRect.height - 10, rect.top + rect.height / 2 - mRect.height / 2));
  } else {
    left = rect.left + rect.width / 2 - mRect.width / 2;
    left = Math.max(10, Math.min(vw - mRect.width - 10, left));
    if (placement === 'top') {
      top = rect.top - mRect.height - 10;
      if (top < 10) top = rect.bottom + 8;
    } else {
      top = rect.bottom + 8;
      if (top + mRect.height > vh - 10) top = rect.top - mRect.height - 10;
    }
  }

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function bindUIEvents() {
  // ブラウザの拡大・右クリック・ピンチを全体で抑止
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('#canvas-wrap')) e.preventDefault();
  });
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  // ポップオーバー外タップで閉じる
  window.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.popover-menu') && !e.target.closest('.has-sub') &&
        !e.target.closest('#btn-color') && !e.target.closest('#btn-width') && !e.target.closest('#btn-menu')) {
      closeAllPopovers();
    }
  });

  // 左1列レールボタン
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  const confirmAndClearAll = () => {
    if (state.objects.length === 0) return;
    if (window.confirm(tPlain('confirm_clear', state.ageLevel))) {
      state.objects = [];
      clearSelectionAndTransform();
      compassPinnedAnchor = null;
      pushHistory();
      renderAll();
    }
  };

  document.getElementById('btn-color').addEventListener('click', (e) => {
    openPopoverNearButton('menu-color', e.currentTarget, 'left-dock');
  });
  document.getElementById('btn-width').addEventListener('click', (e) => {
    openPopoverNearButton('menu-width', e.currentTarget, 'left-dock');
  });
  document.getElementById('btn-menu').addEventListener('click', (e) => {
    openPopoverNearButton('menu-settings', e.currentTarget, 'left-dock');
  });

  document.querySelectorAll('#line-style-list .pop-item[data-line-style]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ls = btn.dataset.lineStyle;
      state.style.lineStyle = ls;
      applyStyleToSelection({ lineStyle: ls });
      updateToolbarState();
      closeAllPopovers();
    });
  });

  document.getElementById('btn-toggle-fill').addEventListener('click', () => {
    state.style.fillEnabled = !state.style.fillEnabled;
    applyStyleToSelection({ fillEnabled: state.style.fillEnabled, fillColor: state.style.strokeColor });
    updateToolbarState();
  });

  document.getElementById('btn-snap').addEventListener('click', () => {
    state.snapEnabled = !state.snapEnabled;
    updateToolbarState();
  });

  document.getElementById('btn-scissors').addEventListener('click', () => {
    if (state.tool === 'scissors') {
      setTool(state.pointerToolMode);
    } else {
      setTool('scissors');
    }
  });

  // 角度モードバー
  document.getElementById('btn-angle-fill').addEventListener('click', () => {
    state.angleFillMode = !state.angleFillMode;
    updateToolbarState();
  });
  document.getElementById('btn-angle-done').addEventListener('click', () => {
    setTool(state.pointerToolMode);
  });

  // 記号モードバー
  document.querySelectorAll('#mark-bar [data-mark-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setEdgeMarkMode(btn.dataset.markMode);
    });
  });
  document.getElementById('btn-mark-done').addEventListener('click', () => {
    setTool(state.pointerToolMode);
  });

  document.getElementById('btn-dark').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    savePreferences();
    applyTheme();
    updateToolbarState();
    renderAll();
  });

  // 複数選択・グループ化バー
  document.getElementById('btn-multi-add').addEventListener('click', () => {
    state.multiSelectAddMode = !state.multiSelectAddMode;
    updateMultiBarUI();
  });
  document.getElementById('btn-multi-group').addEventListener('click', () => {
    if (state.selectedIds.length < 2) return;
    const gid = uid('grp');
    for (const id of state.selectedIds) {
      const obj = state.objects.find((o) => o.id === id);
      if (obj) obj.groupId = gid;
    }
    pushHistory();
    updateMultiBarUI();
    renderOverlay();
    showToast('グループにしました');
  });
  document.getElementById('btn-multi-ungroup').addEventListener('click', () => {
    let changed = false;
    for (const id of state.selectedIds) {
      const obj = state.objects.find((o) => o.id === id);
      if (obj && obj.groupId) {
        delete obj.groupId;
        changed = true;
      }
    }
    if (changed) {
      pushHistory();
      updateMultiBarUI();
      renderOverlay();
      showToast('グループを解除しました');
    }
  });
  document.getElementById('btn-multi-delete').addEventListener('click', () => {
    if (state.selectedIds.length === 0) return;
    const delSet = new Set(state.selectedIds);
    state.objects = state.objects.filter((o) => !delSet.has(o.id));
    clearSelectionAndTransform();
    pushHistory();
    renderAll();
  });
  document.getElementById('btn-multi-clear').addEventListener('click', () => {
    clearSelectionAndTransform();
    renderAll();
  });

  document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('btn-toggle-ui').addEventListener('click', () => {
    const hidden = document.body.classList.toggle('ui-hidden');
    const lbl = document.getElementById('ui-toggle-label');
    if (lbl) {
      lbl.setAttribute('data-i18n', hidden ? 'show_ui' : 'hide_ui');
      lbl.innerHTML = t(hidden ? 'show_ui' : 'hide_ui', state.ageLevel);
    }
    closeAllPopovers();
  });

  document.getElementById('btn-collapse-main').addEventListener('click', () => {
    document.body.classList.add('main-collapsed');
    closeAllPopovers();
  });
  document.getElementById('tab-expand-main').addEventListener('click', () => {
    document.body.classList.remove('main-collapsed');
  });

  document.querySelectorAll('#loupe-mode-list .pop-item[data-loupe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.loupeMode = btn.dataset.loupe;
      savePreferences();
      updateToolbarState();
      closeAllPopovers();
    });
  });

  // 左縦1列ツールボタン（タップ＆長押しサブメニュー対応）
  document.querySelectorAll('#main-rail .tool-btn').forEach((btn) => {
    let pressTimer = null;
    let longPressed = false;

    const openSubForBtn = (isLong) => {
      const menuId = btn.dataset.menu;
      if (!menuId) return;
      if (menuId === 'menu-shapes') {
        const extra = document.getElementById('shapes-extra-group');
        if (extra) extra.style.display = isLong ? 'block' : 'none';
      }
      if (menuId === 'menu-line') {
        const extra = document.getElementById('line-point-extra');
        if (extra) extra.style.display = isLong ? 'block' : 'none';
      }
      openPopoverNearButton(menuId, btn, 'left-dock');
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return;
      longPressed = false;
      clearTimeout(pressTimer);
      if (btn.dataset.menu) {
        pressTimer = setTimeout(() => {
          longPressed = true;
          if (navigator.vibrate) navigator.vibrate(20);
          openSubForBtn(true);
        }, 320);
      }
    });

    btn.addEventListener('pointerup', () => clearTimeout(pressTimer));
    btn.addEventListener('pointercancel', () => clearTimeout(pressTimer));
    btn.addEventListener('pointerleave', () => clearTimeout(pressTimer));

    btn.addEventListener('contextmenu', (e) => {
      if (!btn.dataset.menu) return;
      e.preventDefault();
      clearTimeout(pressTimer);
      openSubForBtn(true);
    });

    btn.addEventListener('click', () => {
      if (longPressed) {
        longPressed = false;
        return;
      }
      const tool = btn.dataset.tool;
      const menuId = btn.dataset.menu;

      // 選択/画面移動：短押しで現在モード、選択中再タップでサブメニュー
      if (tool === 'select') {
        if (state.tool === state.pointerToolMode) {
          openSubForBtn(true);
        } else {
          closeAllPopovers();
          setTool(state.pointerToolMode);
        }
        return;
      }

      // 線/点統合：短押しで現在モード、すでに選択中なら線メニュー開く（長押しで点も出る）
      if (tool === 'line') {
        if (state.tool === state.lineOrPointMode) {
          openSubForBtn(true);
        } else {
          closeAllPopovers();
          setTool(state.lineOrPointMode);
        }
        return;
      }

      // 図形統合：短押しで三角形ピッカー（長押しで四角形・正多角形も展開）
      if (tool === 'shape') {
        openSubForBtn(false);
        return;
      }

      // 消去/全消去統合：短押しで消しゴム、すでに消去選択中ならサブメニュー
      if (tool === 'eraser') {
        if (state.tool === 'eraser') {
          openSubForBtn(true);
        } else {
          closeAllPopovers();
          setTool('eraser');
        }
        return;
      }

      // 記号：初回タップで記号モードへ（再タップや長押しで平行/等長メニュー）
      if (tool === 'edge_mark') {
        if (state.tool === 'edge_mark') {
          openSubForBtn(true);
        } else {
          closeAllPopovers();
          setTool('edge_mark');
        }
        return;
      }

      if (menuId) {
        openSubForBtn(false);
        return;
      }

      closeAllPopovers();
      setTool(tool);
    });
  });

  // 選択・画面移動サブメニュー項目
  document.querySelectorAll('#menu-pointer .pop-item[data-pointer-mode]').forEach((item) => {
    item.addEventListener('click', () => {
      const mode = item.dataset.pointerMode;
      state.pointerToolMode = mode;
      document.querySelectorAll('#menu-pointer .pop-item').forEach((p) => p.classList.remove('selected'));
      item.classList.add('selected');
      const iconEl = document.getElementById('pointer-tool-icon');
      const lblEl = document.getElementById('pointer-tool-label');
      if (iconEl) iconEl.textContent = mode === 'pan' ? '✋' : '👆';
      if (lblEl) {
        const key = mode === 'pan' ? 'tool_pan' : 'tool_select';
        lblEl.setAttribute('data-i18n', key);
        lblEl.innerHTML = t(key, state.ageLevel);
      }
      closeAllPopovers();
      setTool(mode);
    });
  });

  // 消去・全消去サブメニュー項目
  document.querySelectorAll('#menu-eraser .pop-item[data-eraser-mode]').forEach((item) => {
    item.addEventListener('click', () => {
      const em = item.dataset.eraserMode;
      closeAllPopovers();
      if (em === 'clear_all') {
        confirmAndClearAll();
      } else {
        setTool('eraser');
      }
    });
  });

  // 記号サブメニュー項目
  document.querySelectorAll('#menu-edge-mark .pop-item[data-mark-pick]').forEach((item) => {
    item.addEventListener('click', () => {
      setEdgeMarkMode(item.dataset.markPick);
      closeAllPopovers();
      setTool('edge_mark');
    });
  });

  // プルダウン項目クリック（線・点・図形・円）
  document.querySelectorAll('.popover-menu .pop-item[data-tool]').forEach((item) => {
    item.addEventListener('click', () => {
      const tool = item.dataset.tool;
      const sub = item.dataset.sub;
      const parentMenu = item.closest('.popover-menu');
      parentMenu.querySelectorAll('.pop-item').forEach((p) => p.classList.remove('selected'));
      item.classList.add('selected');

      if (tool === 'line') {
        state.lineOrPointMode = 'line';
        state.lineSubType = sub;
        const iconEl = document.getElementById('line-tool-icon');
        const lblEl = document.getElementById('line-tool-label');
        if (iconEl) iconEl.textContent = '📏';
        if (lblEl) {
          lblEl.setAttribute('data-i18n', 'tool_line');
          lblEl.innerHTML = t('tool_line', state.ageLevel);
        }
        setTool('line');
      } else if (tool === 'point') {
        state.lineOrPointMode = 'point';
        const iconEl = document.getElementById('line-tool-icon');
        const lblEl = document.getElementById('line-tool-label');
        if (iconEl) iconEl.textContent = '●';
        if (lblEl) {
          lblEl.setAttribute('data-i18n', 'tool_point');
          lblEl.innerHTML = t('tool_point', state.ageLevel);
        }
        setTool('point');
      } else if (tool === 'place') {
        state.placeSubType = sub;
        if (item.dataset.icon && parentMenu.id === 'menu-shapes') {
          const shapeIcon = document.getElementById('shape-tool-icon');
          if (shapeIcon) shapeIcon.textContent = item.dataset.icon;
        }
        setTool('place');
      }
      closeAllPopovers();
    });
  });

  // 長押し変形バー
  document.querySelectorAll('#transform-bar [data-tf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.transformSubMode = btn.dataset.tf;
      updateTransformBarUI();
      renderOverlay();
    });
  });
  document.getElementById('btn-tf-clone').addEventListener('click', () => {
    const obj = getTransformTarget();
    if (!obj) return;
    const copy = cloneObject(obj, GRID_SIZE);
    state.objects.push(copy);
    state.selectedId = copy.id;
    state.transformTargetId = copy.id;
    pushHistory();
    renderAll();
  });
  document.getElementById('btn-tf-flip').addEventListener('click', () => {
    const obj = getTransformTarget();
    if (!obj) return;
    flipObjectHorizontal(obj);
    pushHistory();
    renderAll();
  });
  document.getElementById('btn-tf-delete').addEventListener('click', () => {
    const id = state.transformTargetId;
    if (!id) return;
    state.objects = state.objects.filter((o) => o.id !== id);
    clearSelectionAndTransform();
    pushHistory();
    renderAll();
  });
  document.getElementById('btn-tf-done').addEventListener('click', () => {
    state.transformTargetId = null;
    updateTransformBarUI();
    renderAll();
  });

  // ズームコントロール
  document.getElementById('btn-zoom-in').addEventListener('click', () => zoomAroundCenter(1.25));
  document.getElementById('btn-zoom-out').addEventListener('click', () => zoomAroundCenter(0.8));
  document.getElementById('btn-zoom-reset').addEventListener('click', () => {
    centerViewOrigin();
    updateZoomDisplay();
    renderAll();
  });

  // 保存・読込・背景画像
  document.getElementById('btn-save-json').addEventListener('click', () => {
    closeAllPopovers();
    exportJson();
  });
  document.getElementById('btn-load-json').addEventListener('click', () => {
    closeAllPopovers();
    document.getElementById('input-json').click();
  });
  document.getElementById('btn-save-zip').addEventListener('click', () => {
    closeAllPopovers();
    exportZip();
  });
  document.getElementById('btn-load-zip').addEventListener('click', () => {
    closeAllPopovers();
    document.getElementById('input-zip').click();
  });
  document.getElementById('btn-load-image').addEventListener('click', () => {
    closeAllPopovers();
    document.getElementById('input-image').click();
  });
  document.getElementById('btn-clear-image').addEventListener('click', () => {
    closeAllPopovers();
    state.bgImage = null;
    updateBgControlsUI();
    renderBgImage();
  });

  document.getElementById('input-json').addEventListener('change', handleJsonImport);
  document.getElementById('input-zip').addEventListener('change', handleZipImport);
  document.getElementById('input-image').addEventListener('change', handleImageImport);

  document.getElementById('bg-opacity-range').addEventListener('input', (e) => {
    if (!state.bgImage) return;
    state.bgImage.opacity = Number(e.target.value) / 100;
    renderBgImage();
  });
  document.getElementById('bg-scale-range').addEventListener('input', (e) => {
    if (!state.bgImage) return;
    state.bgImage.scale = Number(e.target.value) / 100;
    renderBgImage();
  });
}

function toggleFullscreen() {
  const docEl = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => showToast('共有ボタン→ホーム画面に追加で全画面になります'));
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else {
      showToast('iPad/iPhoneは共有ボタンから「ホーム画面に追加」で全画面になります');
    }
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function setTool(tool) {
  state.tool = tool;
  if (tool !== 'select') {
    state.transformTargetId = null;
  }
  if (tool !== 'compass') {
    compassPinnedAnchor = null;
  }
  updateToolbarState();
  updateTransformBarUI();
  renderAll();
}

function clearSelectionAndTransform() {
  state.selectedId = null;
  state.selectedIds = [];
  state.multiSelectAddMode = false;
  state.transformTargetId = null;
  syncStyleFromSelection();
  updateToolbarState();
  updateTransformBarUI();
  updateMultiBarUI();
}

function getTransformTarget() {
  if (!state.transformTargetId) return null;
  return state.objects.find((o) => o.id === state.transformTargetId) || null;
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', state.darkMode);
}

function setEdgeMarkMode(mode) {
  state.edgeMarkMode = mode;
  const iconEl = document.getElementById('mark-tool-icon');
  if (iconEl) iconEl.textContent = mode === 'equal' ? '╂' : '∥';
  document.querySelectorAll('#mark-bar [data-mark-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.markMode === mode);
  });
  document.querySelectorAll('#menu-edge-mark .pop-item').forEach((b) => {
    b.classList.toggle('selected', b.dataset.markPick === mode);
  });
}

function updateMultiBarUI() {
  const hasTransform = Boolean(getTransformTarget());
  const isSpecialBar = state.tool === 'angle' || state.tool === 'edge_mark';
  const count = state.selectedIds.length;
  const show = !hasTransform && !isSpecialBar && count > 0;
  multiBar.classList.toggle('open', show);
  if (!show) return;

  const badge = document.getElementById('multi-count-badge');
  badge.textContent = count > 1 ? `${count}個 選択中` : '選択中';

  const selectedObjs = state.objects.filter((o) => state.selectedIds.includes(o.id));
  const hasGroup = selectedObjs.some((o) => Boolean(o.groupId));
  const distinctGroups = new Set(selectedObjs.map((o) => o.groupId || o.id));

  document.getElementById('btn-multi-add').classList.toggle('active', state.multiSelectAddMode);
  document.getElementById('btn-multi-group').style.display = (count >= 2 && distinctGroups.size > 1) ? 'inline-flex' : 'none';
  document.getElementById('btn-multi-ungroup').style.display = hasGroup ? 'inline-flex' : 'none';
}

function applyLanguage() {
  applyI18nToDOM(document, state.ageLevel);
}

function updateToolbarState() {
  document.getElementById('btn-snap').classList.toggle('active', state.snapEnabled);
  document.getElementById('btn-scissors').classList.toggle('warn-active', state.tool === 'scissors');

  angleBar.classList.toggle('open', state.tool === 'angle');
  markBar.classList.toggle('open', state.tool === 'edge_mark');
  const angFillBtn = document.getElementById('btn-angle-fill');
  if (angFillBtn) angFillBtn.classList.toggle('active', state.angleFillMode);
  const angFillTxt = document.getElementById('angle-fill-text');
  if (angFillTxt) angFillTxt.textContent = state.angleFillMode ? 'ON' : 'OFF';

  const darkBtn = document.getElementById('btn-dark');
  darkBtn.classList.toggle('selected', state.darkMode);
  const darkTxt = document.getElementById('dark-state-text');
  if (darkTxt) darkTxt.textContent = state.darkMode ? 'ON' : 'OFF';

  const dot = document.getElementById('current-color-dot');
  dot.style.background = resolveColor(state.style.strokeColor, state.darkMode);
  document.getElementById('current-width-bar').style.height = `${Math.min(10, state.style.strokeWidth)}px`;
  const ls = state.style.lineStyle || 'solid';
  document.getElementById('current-width-bar').style.borderTop = ls === 'double' ? '2px solid currentColor' : 'none';

  document.querySelectorAll('.swatch-btn').forEach((b) => {
    b.classList.toggle('selected', b.dataset.colorId === state.style.strokeColor);
  });
  document.querySelectorAll('#line-style-list .pop-item').forEach((b) => {
    b.classList.toggle('selected', b.dataset.lineStyle === ls);
  });
  document.querySelectorAll('#width-list .pop-item').forEach((b) => {
    b.classList.toggle('selected', Number(b.dataset.widthVal) === state.style.strokeWidth);
  });
  document.querySelectorAll('#age-list .pop-item').forEach((b) => {
    b.classList.toggle('selected', b.dataset.ageId === state.ageLevel);
  });
  document.querySelectorAll('#loupe-mode-list .pop-item').forEach((b) => {
    b.classList.toggle('selected', b.dataset.loupe === state.loupeMode);
  });

  const fillBtn = document.getElementById('btn-toggle-fill');
  fillBtn.classList.toggle('selected', state.style.fillEnabled);
  document.getElementById('fill-state-text').textContent = state.style.fillEnabled ? 'ON' : 'OFF';

  // ツールレールアクティブ表示
  document.querySelectorAll('#main-rail .tool-btn').forEach((btn) => {
    const tName = btn.dataset.tool;
    let isActive = state.tool === tName;
    if (tName === 'select' && (state.tool === 'select' || state.tool === 'pan')) {
      isActive = true;
    }
    if (tName === 'line' && (state.tool === 'line' || state.tool === 'point')) {
      isActive = true;
    }
    if (state.tool === 'place') {
      if (tName === 'shape' && !state.placeSubType.startsWith('circle_')) isActive = true;
      if (tName === 'circle' && state.placeSubType.startsWith('circle_')) isActive = true;
    }
    btn.classList.toggle('active', isActive);
  });

  updateMultiBarUI();
  updateZoomDisplay();
}

function updateTransformBarUI() {
  const hasTarget = Boolean(getTransformTarget());
  transformBar.classList.toggle('open', hasTarget);
  document.querySelectorAll('#transform-bar [data-tf]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tf === state.transformSubMode);
  });
  updateMultiBarUI();
}

function updateZoomDisplay() {
  document.getElementById('btn-zoom-reset').textContent = `${Math.round(state.view.scale * 100)}%`;
}

function updateBgControlsUI() {
  const hasBg = Boolean(state.bgImage);
  bgControls.classList.toggle('open', hasBg);
  document.getElementById('btn-clear-image').style.display = hasBg ? 'flex' : 'none';
  if (hasBg) {
    document.getElementById('bg-opacity-range').value = String(Math.round(state.bgImage.opacity * 100));
    document.getElementById('bg-scale-range').value = String(Math.round(state.bgImage.scale * 100));
  }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

// --- キャンバスインタラクション（タップ・移動・長押し変形・コンパス・ピンチズーム） ---
function bindCanvasEvents() {
  svg.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUpOrCancel);
  window.addEventListener('pointercancel', onPointerUpOrCancel);

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomAtScreenPoint(sx, sy, factor);
  }, { passive: false });
}

function zoomAroundCenter(factor) {
  const rect = svg.getBoundingClientRect();
  zoomAtScreenPoint(rect.width / 2, rect.height / 2, factor);
}

function zoomAtScreenPoint(sx, sy, factor) {
  const newScale = Math.max(state.view.minScale, Math.min(state.view.maxScale, state.view.scale * factor));
  const wx = (sx - state.view.x) / state.view.scale;
  const wy = (sy - state.view.y) / state.view.scale;
  state.view.scale = newScale;
  state.view.x = sx - wx * newScale;
  state.view.y = sy - wy * newScale;
  updateZoomDisplay();
  renderAll();
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function onPointerDown(e) {
  if (e.button === 2) return;
  closeAllPopovers();
  svg.setPointerCapture?.(e.pointerId);

  activePointers.set(e.pointerId, {
    id: e.pointerId,
    clientX: e.clientX,
    clientY: e.clientY,
    startX: e.clientX,
    startY: e.clientY
  });

  // 2本指になった場合
  if (activePointers.size === 2) {
    cancelLongPress();

    // コンパスモードなら「二点タッチ作図」！
    if (state.tool === 'compass') {
      const pts = Array.from(activePointers.values());
      const anchorPt = pts[0];
      const penPt = pts[1];
      const aw = clientToWorld(anchorPt.clientX, anchorPt.clientY);
      const rawAnchor = interaction && interaction.type === 'compass_anchor_hold'
        ? interaction.anchor
        : snapWorldPoint(aw.x, aw.y);

      const penWorld = clientToWorld(penPt.clientX, penPt.clientY);
      const r = Math.hypot(penWorld.x - rawAnchor.x, penWorld.y - rawAnchor.y);
      const startAngle = Math.atan2(penWorld.y - rawAnchor.y, penWorld.x - rawAnchor.x);

      interaction = {
        type: 'compass_two_finger',
        anchorPointerId: anchorPt.id,
        penPointerId: penPt.id,
        anchor: rawAnchor,
        radius: Math.max(8, r),
        startAngle,
        lastAngle: startAngle,
        deltaAngle: 0,
        penWorld
      };
      renderPreview();
      return;
    }

    // 2本目が図形をタップした場合（1本目が図形をホールド中の複数選択！）
    if (state.tool === 'select' && interaction && (interaction.type === 'move_obj' || interaction.type === 'multi_select_hold') && !interaction.moved) {
      const pts = Array.from(activePointers.values());
      const secondPtr = pts.find((p) => p.id === e.pointerId) || pts[1];
      const w2 = clientToWorld(secondPtr.clientX, secondPtr.clientY);
      const hit2 = findTopObjectAt(w2.x, w2.y);
      if (hit2 && hit2.kind !== 'right_angle') {
        const curSet = new Set(state.selectedIds);
        curSet.add(hit2.id);
        setSelectionIds(Array.from(curSet));
        interaction = {
          type: 'multi_select_hold',
          anchorPointerId: interaction.anchorPointerId || interaction.pointerId,
          tapPointerId: secondPtr.id,
          moved: false
        };
        renderOverlay();
        return;
      }
    }

    // 通常モードではピンチズーム＆2本指パン
    const pts = Array.from(activePointers.values());
    const rect = svg.getBoundingClientRect();
    const midX = (pts[0].clientX + pts[1].clientX) / 2 - rect.left;
    const midY = (pts[0].clientY + pts[1].clientY) / 2 - rect.top;
    const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
    interaction = {
      type: 'pinch',
      startDist: Math.max(10, dist),
      startScale: state.view.scale,
      worldMidX: (midX - state.view.x) / state.view.scale,
      worldMidY: (midY - state.view.y) / state.view.scale
    };
    renderPreview();
    return;
  }

  if (activePointers.size > 2) return;

  const world = clientToWorld(e.clientX, e.clientY);

  // --- コンパスモード (1本目押し下げ) ---
  if (state.tool === 'compass') {
    const snapped = snapWorldPoint(world.x, world.y);
    // すでに固定支点がある場合、支点タップなら再設定、別の場所ならドラッグで円弧開始の可能性
    if (compassPinnedAnchor && Math.hypot(world.x - compassPinnedAnchor.x, world.y - compassPinnedAnchor.y) > 26 / state.view.scale) {
      const r = Math.hypot(world.x - compassPinnedAnchor.x, world.y - compassPinnedAnchor.y);
      const startAngle = Math.atan2(world.y - compassPinnedAnchor.y, world.x - compassPinnedAnchor.x);
      interaction = {
        type: 'compass_pinned_drag',
        pointerId: e.pointerId,
        anchor: { ...compassPinnedAnchor },
        radius: Math.max(8, r),
        startAngle,
        lastAngle: startAngle,
        deltaAngle: 0,
        penWorld: world,
        moved: false
      };
    } else {
      interaction = {
        type: 'compass_anchor_hold',
        pointerId: e.pointerId,
        anchor: snapped,
        moved: false
      };
    }
    renderPreview();
    return;
  }

  // --- パン専用モード ---
  if (state.tool === 'pan') {
    interaction = {
      type: 'pan',
      pointerId: e.pointerId,
      lastClientX: e.clientX,
      lastClientY: e.clientY
    };
    return;
  }

  // --- 点モード (押しながらスライド微調整＋虫眼鏡で離した位置に確定) ---
  if (state.tool === 'point') {
    const pt = snapWorldPoint(world.x, world.y);
    interaction = {
      type: 'place_point',
      pointerId: e.pointerId,
      x: pt.x,
      y: pt.y
    };
    renderPreview();
    showLoupeIfNeeded('place_point', null, pt.x, pt.y, e.clientX, e.clientY);
    return;
  }

  // --- 図形配置モード ---
  if (state.tool === 'place') {
    const obj = createPresetShape(state.placeSubType, world.x, world.y, state.style, state.snapEnabled);
    state.objects.push(obj);
    pushHistory();
    state.tool = 'select';
    state.transformTargetId = null;
    setSelectionIds([obj.id]);
    updateTransformBarUI();
    renderAll();
    return;
  }

  // --- 線モード ---
  if (state.tool === 'line') {
    if (state.lineSubType === 'line_freehand') {
      interaction = {
        type: 'draw_freehand',
        pointerId: e.pointerId,
        points: [{ x: world.x, y: world.y }]
      };
    } else {
      const start = snapWorldPoint(world.x, world.y);
      interaction = {
        type: 'draw_line',
        pointerId: e.pointerId,
        subType: state.lineSubType,
        x1: start.x,
        y1: start.y,
        x2: start.x,
        y2: start.y
      };
    }
    renderPreview();
    return;
  }

  // --- はさみ（切断）モード（スナップON時は方眼・頂点にスナップ） ---
  if (state.tool === 'scissors') {
    const start = snapWorldPoint(world.x, world.y);
    interaction = {
      type: 'scissors',
      pointerId: e.pointerId,
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: start.y
    };
    renderPreview();
    return;
  }

  // --- 角度ツール (タップした角に円弧1〜3本＋内側塗りを配置・循環) ---
  if (state.tool === 'angle') {
    const tol = 18 / state.view.scale;
    // 1. 既存の角度円弧をタップしたら 1 -> 2 -> 3 -> 削除
    for (let i = state.objects.length - 1; i >= 0; i--) {
      const o = state.objects[i];
      if (o.kind === 'angle_arc' && hitTestObject(o, world.x, world.y, tol)) {
        const nextArcs = (o.arcs || 1) + 1;
        if (nextArcs > 3) {
          state.objects = state.objects.filter((item) => item.id !== o.id);
          showToast('角度マークを消しました');
        } else {
          o.arcs = nextArcs;
          o.fillEnabled = state.angleFillMode;
          if (state.angleFillMode) o.fillColor = state.style.strokeColor;
        }
        pushHistory();
        renderAll();
        return;
      }
    }

    // 2. 新しい角を検出して円弧を追加
    const detected = detectAngleAtTap(world.x, world.y, state.objects, 78 / state.view.scale);
    if (detected) {
      const obj = {
        id: uid('ang'),
        kind: 'angle_arc',
        vx: detected.vx,
        vy: detected.vy,
        startAngle: detected.startAngle,
        deltaAngle: detected.deltaAngle,
        arcs: 1,
        radius: 26,
        strokeColor: state.style.strokeColor,
        strokeWidth: state.style.strokeWidth,
        fillEnabled: state.angleFillMode,
        fillColor: state.style.strokeColor
      };
      state.objects.push(obj);
      pushHistory();
      renderAll();
    } else {
      showToast('角の近くをタップしてください');
    }
    return;
  }

  // --- 辺記号ツール (平行・同じ長さマーク 1〜3本) ---
  if (state.tool === 'edge_mark') {
    const edge = findEdgeNearPoint(world.x, world.y, state.objects, 22 / state.view.scale);
    if (!edge) {
      showToast('辺や線分をタップしてください');
      return;
    }
    const mode = state.edgeMarkMode; // 'parallel' | 'equal'
    if (edge.obj.kind === 'polygon') {
      if (!edge.obj.edgeMarks) edge.obj.edgeMarks = {};
      const cur = edge.obj.edgeMarks[edge.edgeIndex] || { parallel: 0, equal: 0 };
      cur[mode] = ((cur[mode] || 0) + 1) % 4;
      edge.obj.edgeMarks[edge.edgeIndex] = cur;
    } else if (edge.obj.kind === 'line') {
      if (!edge.obj.edgeMark) edge.obj.edgeMark = { parallel: 0, equal: 0 };
      edge.obj.edgeMark[mode] = ((edge.obj.edgeMark[mode] || 0) + 1) % 4;
    }
    pushHistory();
    renderAll();
    return;
  }

  // --- 消しゴムモード ---
  if (state.tool === 'eraser') {
    interaction = { type: 'eraser', pointerId: e.pointerId, erased: false };
    eraseAt(world.x, world.y);
    return;
  }

  // --- 選択・移動・長押し変形モード ('select') ---
  // 1. まず変形ハンドルにヒットしたかチェック
  const tfObj = getTransformTarget();
  if (tfObj) {
    const handles = getTransformHandles(tfObj);
    const hitR = 26 / state.view.scale;
    for (const h of handles) {
      if (Math.hypot(world.x - h.x, world.y - h.y) <= hitR) {
        interaction = {
          type: 'handle_drag',
          pointerId: e.pointerId,
          objId: tfObj.id,
          handleIdx: h.idx,
          center: getObjectCenter(tfObj),
          startWorld: { ...world },
          startHandle: { x: h.x, y: h.y },
          baseObj: JSON.parse(JSON.stringify(tfObj))
        };
        dragSnapshotDirty = false;
        return;
      }
    }
  }

  // 2. 既存オブジェクトにヒットしたか（手前から探索）
  const hitObj = findTopObjectAt(world.x, world.y);
  if (hitObj) {
    // 直角マークをクリック/タップで消せるようにする
    if (hitObj.kind === 'right_angle') {
      interaction = {
        type: 'tap_right_angle',
        pointerId: e.pointerId,
        objId: hitObj.id,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false
      };
      return;
    }

    if (state.transformTargetId && state.transformTargetId !== hitObj.id) {
      state.transformTargetId = null;
      updateTransformBarUI();
    }

    // Shiftキーまたは「追加選択」モードONのときは複数選択をトグル/追加
    if (e.shiftKey || state.multiSelectAddMode) {
      const groupIds = expandSelectionWithGroups([hitObj.id]);
      const curSet = new Set(state.selectedIds);
      const allIn = groupIds.every((id) => curSet.has(id));
      if (allIn && curSet.size > groupIds.length) {
        groupIds.forEach((id) => curSet.delete(id));
      } else {
        groupIds.forEach((id) => curSet.add(id));
      }
      setSelectionIds(Array.from(curSet));
    } else if (!state.selectedIds.includes(hitObj.id)) {
      setSelectionIds([hitObj.id]);
    } else {
      // すでに複数選択されているうちの1つを触った場合、そのグループ選択を維持しスタイルだけ同期
      state.selectedId = hitObj.id;
      syncStyleFromSelection();
      updateToolbarState();
      updateMultiBarUI();
    }

    const moveIds = state.selectedIds.length > 0 ? state.selectedIds : [hitObj.id];
    const baseMap = new Map();
    for (const id of moveIds) {
      const target = state.objects.find((o) => o.id === id);
      if (target) baseMap.set(id, JSON.parse(JSON.stringify(target)));
    }

    interaction = {
      type: 'move_obj',
      pointerId: e.pointerId,
      objId: hitObj.id,
      moveIds,
      startWorld: { ...world },
      startClient: { x: e.clientX, y: e.clientY },
      baseObj: baseMap.get(hitObj.id),
      baseMap,
      moved: false
    };
    dragSnapshotDirty = false;

    // 長押しタイマー起動（単一図形 polygon / circle / line のみ回転・拡大縮小対象）
    if (moveIds.length === 1 && (hitObj.kind === 'polygon' || hitObj.kind === 'circle' || hitObj.kind === 'line')) {
      cancelLongPress();
      longPressTimer = setTimeout(() => {
        if (!interaction || interaction.type !== 'move_obj' || interaction.moved) return;
        state.transformTargetId = hitObj.id;
        state.selectedId = hitObj.id;
        interaction.type = 'idle_after_longpress';
        if (navigator.vibrate) navigator.vibrate(25);
        updateTransformBarUI();
        updateMultiBarUI();
        renderAll();
      }, 430);
    }
    renderOverlay();
    return;
  }

  // 3. 空白部分をタップ/ドラッグ → 変形解除してパン
  if (state.transformTargetId || state.selectedIds.length > 0 || state.selectedId) {
    clearSelectionAndTransform();
    renderOverlay();
  }
  interaction = {
    type: 'pan',
    pointerId: e.pointerId,
    lastClientX: e.clientX,
    lastClientY: e.clientY
  };
}

function onPointerMove(e) {
  const ptr = activePointers.get(e.pointerId);
  if (ptr) {
    ptr.clientX = e.clientX;
    ptr.clientY = e.clientY;
  }
  if (!interaction) return;

  // ピンチズーム処理
  if (interaction.type === 'pinch' && activePointers.size >= 2) {
    const pts = Array.from(activePointers.values());
    const rect = svg.getBoundingClientRect();
    const midX = (pts[0].clientX + pts[1].clientX) / 2 - rect.left;
    const midY = (pts[0].clientY + pts[1].clientY) / 2 - rect.top;
    const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
    const ratio = dist / interaction.startDist;
    const nextScale = Math.max(state.view.minScale, Math.min(state.view.maxScale, interaction.startScale * ratio));
    state.view.scale = nextScale;
    state.view.x = midX - interaction.worldMidX * nextScale;
    state.view.y = midY - interaction.worldMidY * nextScale;
    updateZoomDisplay();
    renderAll();
    return;
  }

  // 二点タッチコンパス（2本目ドラッグ）
  if (interaction.type === 'compass_two_finger') {
    if (e.pointerId === interaction.penPointerId) {
      const world = clientToWorld(e.clientX, e.clientY);
      updateCompassArcProgress(interaction, world);
      renderPreview();
      const curAngle = interaction.startAngle + interaction.deltaAngle;
      const penX = interaction.anchor.x + interaction.radius * Math.cos(curAngle);
      const penY = interaction.anchor.y + interaction.radius * Math.sin(curAngle);
      showLoupeIfNeeded('compass', null, penX, penY, e.clientX, e.clientY);
    }
    return;
  }

  if (interaction.pointerId !== e.pointerId) return;
  const world = clientToWorld(e.clientX, e.clientY);

  if (interaction.type === 'place_point') {
    const pt = snapWorldPoint(world.x, world.y);
    interaction.x = pt.x;
    interaction.y = pt.y;
    renderPreview();
    showLoupeIfNeeded('place_point', null, pt.x, pt.y, e.clientX, e.clientY);
    return;
  }

  if (interaction.type === 'compass_anchor_hold') {
    if (Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY) > 10) {
      interaction.moved = true;
      // 1本目をドラッグしたままなら支点をリアルタイム移動
      interaction.anchor = snapWorldPoint(world.x, world.y);
      renderPreview();
      showLoupeIfNeeded('compass', null, interaction.anchor.x, interaction.anchor.y, e.clientX, e.clientY);
    }
    return;
  }

  if (interaction.type === 'compass_pinned_drag') {
    if (Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY) > 6) {
      interaction.moved = true;
    }
    updateCompassArcProgress(interaction, world);
    renderPreview();
    const curAngle = interaction.startAngle + interaction.deltaAngle;
    const penX = interaction.anchor.x + interaction.radius * Math.cos(curAngle);
    const penY = interaction.anchor.y + interaction.radius * Math.sin(curAngle);
    showLoupeIfNeeded('compass', null, penX, penY, e.clientX, e.clientY);
    return;
  }

  if (interaction.type === 'pan') {
    const dx = e.clientX - interaction.lastClientX;
    const dy = e.clientY - interaction.lastClientY;
    interaction.lastClientX = e.clientX;
    interaction.lastClientY = e.clientY;
    state.view.x += dx;
    state.view.y += dy;
    applyViewportTransform();
    return;
  }

  if (interaction.type === 'draw_line') {
    let end = snapWorldPoint(world.x, world.y);
    let perpSnap = null;
    if (interaction.subType === 'line_segment') {
      perpSnap = findPerpendicularSnap(
        interaction.x1,
        interaction.y1,
        world.x,
        world.y,
        state.objects,
        24 / state.view.scale
      );
      if (perpSnap) {
        end = { x: perpSnap.x, y: perpSnap.y };
      }
    }
    interaction.x2 = end.x;
    interaction.y2 = end.y;
    interaction.perpSnap = perpSnap;
    renderPreview();
    showLoupeIfNeeded('draw_line', null, end.x, end.y, e.clientX, e.clientY);
    return;
  }

  if (interaction.type === 'draw_freehand') {
    const last = interaction.points[interaction.points.length - 1];
    if (Math.hypot(world.x - last.x, world.y - last.y) >= 3 / state.view.scale) {
      interaction.points.push({ x: world.x, y: world.y });
      renderPreview();
    }
    return;
  }

  if (interaction.type === 'scissors') {
    const end = snapWorldPoint(world.x, world.y);
    interaction.x2 = end.x;
    interaction.y2 = end.y;
    renderPreview();
    showLoupeIfNeeded('scissors', null, end.x, end.y, e.clientX, e.clientY);
    return;
  }

  if (interaction.type === 'eraser') {
    eraseAt(world.x, world.y);
    return;
  }

  if (interaction.type === 'tap_right_angle') {
    if (Math.hypot(e.clientX - interaction.startClient.x, e.clientY - interaction.startClient.y) > 10) {
      interaction.moved = true;
    }
    return;
  }

  if (interaction.type === 'move_obj') {
    const movePx = Math.hypot(e.clientX - interaction.startClient.x, e.clientY - interaction.startClient.y);
    if (movePx > 8) {
      interaction.moved = true;
      cancelLongPress();
    }
    if (!interaction.moved) return;

    const obj = state.objects.find((o) => o.id === interaction.objId);
    if (!obj) return;
    const rawDx = world.x - interaction.startWorld.x;
    const rawDy = world.y - interaction.startWorld.y;
    const { dx, dy } = computeMoveDeltaWithSnap(obj, rawDx, rawDy, interaction.baseObj);

    const moveIds = interaction.moveIds || [obj.id];
    for (const id of moveIds) {
      const target = state.objects.find((o) => o.id === id);
      const base = interaction.baseMap?.get(id);
      if (!target || !base) continue;
      restoreObjectFromBase(target, base);
      translateObject(target, dx, dy);
    }
    dragSnapshotDirty = true;
    renderObjectsAndOverlay();
    const focusPt = obj.kind === 'point'
      ? { x: obj.x, y: obj.y }
      : { x: interaction.startWorld.x + dx, y: interaction.startWorld.y + dy };
    showLoupeIfNeeded('move_obj', obj, focusPt.x, focusPt.y, e.clientX, e.clientY);
    return;
  }

  if (interaction.type === 'handle_drag') {
    const obj = state.objects.find((o) => o.id === interaction.objId);
    if (!obj) return;
    applyHandleTransform(obj, interaction, world);
    dragSnapshotDirty = true;
    renderObjectsAndOverlay();
    const handles = getTransformHandles(obj);
    const h = handles.find((item) => item.idx === interaction.handleIdx) || world;
    showLoupeIfNeeded('handle_drag', obj, h.x, h.y, e.clientX, e.clientY);
  }
}

function onPointerUpOrCancel(e) {
  const ptr = activePointers.get(e.pointerId);
  activePointers.delete(e.pointerId);
  cancelLongPress();
  hideLoupe();

  if (!interaction) return;

  // 二点タッチコンパスの2本目を離した → 円弧確定（1本目はまだ押しっぱなし可能！）
  if (interaction.type === 'compass_two_finger') {
    if (e.pointerId === interaction.penPointerId) {
      commitCompassArc(interaction);
      // まだ1本目の指が押されていれば同じ支点で次の円弧を描ける状態へ戻す
      if (activePointers.has(interaction.anchorPointerId)) {
        interaction = {
          type: 'compass_anchor_hold',
          pointerId: interaction.anchorPointerId,
          anchor: interaction.anchor,
          moved: true
        };
      } else {
        interaction = null;
      }
      renderPreview();
      return;
    }
    if (e.pointerId === interaction.anchorPointerId) {
      commitCompassArc(interaction);
      interaction = null;
      renderPreview();
      return;
    }
  }

  if (interaction.type === 'compass_anchor_hold' && e.pointerId === interaction.pointerId) {
    // 短いタップならPC/単指操作用の支点ピンを固定
    if (!interaction.moved) {
      compassPinnedAnchor = { ...interaction.anchor };
      showToast('支点（針）をセットしました。別位置をドラッグして円弧を描けます');
    }
    interaction = null;
    renderPreview();
    return;
  }

  if (interaction.type === 'compass_pinned_drag' && e.pointerId === interaction.pointerId) {
    if (interaction.moved) {
      commitCompassArc(interaction);
    } else if (ptr) {
      // 動かなければ支点移動
      const w = clientToWorld(e.clientX, e.clientY);
      compassPinnedAnchor = snapWorldPoint(w.x, w.y);
    }
    interaction = null;
    renderPreview();
    return;
  }

  if (interaction.type === 'pinch') {
    if (activePointers.size < 2) interaction = null;
    return;
  }

  if (interaction.type === 'multi_select_hold') {
    if (e.pointerId === interaction.anchorPointerId) {
      interaction = null;
    } else if (!activePointers.has(interaction.anchorPointerId)) {
      interaction = null;
    }
    return;
  }

  if (interaction.pointerId !== e.pointerId) return;

  if (interaction.type === 'tap_right_angle') {
    if (!interaction.moved) {
      state.objects = state.objects.filter((o) => o.id !== interaction.objId);
      pushHistory();
      showToast('直角マークを消しました');
    }
  } else if (interaction.type === 'place_point') {
    const obj = {
      id: uid('pt'),
      kind: 'point',
      x: interaction.x,
      y: interaction.y,
      strokeColor: state.style.strokeColor,
      strokeWidth: state.style.strokeWidth
    };
    state.objects.push(obj);
    state.selectedId = null;
    state.selectedIds = [];
    updateMultiBarUI();
    pushHistory();
  } else if (interaction.type === 'draw_line') {
    if (Math.hypot(interaction.x2 - interaction.x1, interaction.y2 - interaction.y1) >= 6) {
      const obj = {
        id: uid('ln'),
        kind: 'line',
        subType: interaction.subType,
        x1: interaction.x1,
        y1: interaction.y1,
        x2: interaction.x2,
        y2: interaction.y2,
        strokeColor: state.style.strokeColor,
        strokeWidth: state.style.strokeWidth,
        lineStyle: state.style.lineStyle || 'solid'
      };
      const existingBeforeLine = state.objects.slice();
      state.objects.push(obj);

      // 垂直に下ろした場合（または直交接点）は自動で直角マークを付与
      if (interaction.subType === 'line_segment') {
        const ra = interaction.perpSnap ||
          detectRightAngleAtEndpoint(obj.x1, obj.y1, obj.x2, obj.y2, existingBeforeLine);
        if (ra) {
          state.objects.push({
            id: uid('ra'),
            kind: 'right_angle',
            x: ra.x,
            y: ra.y,
            ux: ra.ux,
            uy: ra.uy,
            vx: ra.vx,
            vy: ra.vy,
            size: 16,
            strokeColor: state.style.strokeColor
          });
        }
      }

      state.selectedId = null;
      state.selectedIds = [];
      updateMultiBarUI();
      pushHistory();
    }
  } else if (interaction.type === 'draw_freehand') {
    if (interaction.points.length >= 2) {
      const obj = {
        id: uid('fh'),
        kind: 'freehand',
        points: interaction.points,
        strokeColor: state.style.strokeColor,
        strokeWidth: state.style.strokeWidth,
        lineStyle: state.style.lineStyle || 'solid'
      };
      state.objects.push(obj);
      state.selectedId = null;
      state.selectedIds = [];
      updateMultiBarUI();
      pushHistory();
    }
  } else if (interaction.type === 'scissors') {
    performCut(
      { x: interaction.x1, y: interaction.y1 },
      { x: interaction.x2, y: interaction.y2 }
    );
  } else if (interaction.type === 'eraser') {
    if (interaction.erased) pushHistory();
  } else if ((interaction.type === 'move_obj' || interaction.type === 'handle_drag') && dragSnapshotDirty) {
    pushHistory();
  }

  interaction = null;
  dragSnapshotDirty = false;
  renderAll();
}

function updateCompassArcProgress(session, penWorld) {
  session.penWorld = penWorld;
  const ang = Math.atan2(penWorld.y - session.anchor.y, penWorld.x - session.anchor.x);
  let diff = ang - session.lastAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  session.deltaAngle += diff;
  session.lastAngle = ang;
  // 最大2πでクランプ
  if (session.deltaAngle > Math.PI * 2) session.deltaAngle = Math.PI * 2;
  if (session.deltaAngle < -Math.PI * 2) session.deltaAngle = -Math.PI * 2;
}

function commitCompassArc(session) {
  if (Math.abs(session.deltaAngle) < 0.08) return;
  const isFullCircle = Math.abs(session.deltaAngle) >= Math.PI * 2 - 0.14;
  const obj = {
    id: uid('arc'),
    kind: 'arc',
    cx: session.anchor.x,
    cy: session.anchor.y,
    r: session.radius,
    startAngle: session.startAngle,
    deltaAngle: isFullCircle ? Math.PI * 2 : session.deltaAngle,
    isFullCircle,
    strokeColor: state.style.strokeColor,
    strokeWidth: state.style.strokeWidth,
    lineStyle: state.style.lineStyle || 'solid'
  };
  state.objects.push(obj);
  pushHistory();
  renderObjects();
}

function applyHandleTransform(obj, session, world) {
  const mode = state.transformSubMode;
  const base = session.baseObj;
  const c = session.center;

  if (mode === 'vertex') {
    const snapped = snapWorldPoint(world.x, world.y, obj.id);
    if (obj.kind === 'polygon') {
      obj.vertices[session.handleIdx].x = snapped.x;
      obj.vertices[session.handleIdx].y = snapped.y;
    } else if (obj.kind === 'line') {
      if (session.handleIdx === 0) { obj.x1 = snapped.x; obj.y1 = snapped.y; }
      else { obj.x2 = snapped.x; obj.y2 = snapped.y; }
    } else if (obj.kind === 'circle') {
      const dx = snapped.x - obj.cx;
      const dy = snapped.y - obj.cy;
      const cos = Math.cos(-(obj.rotation || 0));
      const sin = Math.sin(-(obj.rotation || 0));
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (session.handleIdx === 0 || session.handleIdx === 2) {
        obj.ry = Math.max(12, Math.abs(ly));
      } else {
        obj.rx = Math.max(12, Math.abs(lx));
      }
    }
    return;
  }

  const v0x = session.startHandle.x - c.x;
  const v0y = session.startHandle.y - c.y;
  const r0 = Math.max(8, Math.hypot(v0x, v0y));
  const a0 = Math.atan2(v0y, v0x);

  const curTarget = state.snapEnabled && mode === 'both'
    ? snapWorldPoint(world.x, world.y, obj.id)
    : world;
  const v1x = curTarget.x - c.x;
  const v1y = curTarget.y - c.y;
  const r1 = Math.max(12, Math.hypot(v1x, v1y));
  const a1 = Math.atan2(v1y, v1x);

  let dTheta = a1 - a0;
  let scale = r1 / r0;

  if (mode === 'rotate') {
    scale = 1;
    // スナップON時は15度刻みに軽く吸着
    if (state.snapEnabled) {
      const step = (15 * Math.PI) / 180;
      const snappedTheta = Math.round(dTheta / step) * step;
      if (Math.abs(dTheta - snappedTheta) < 0.08) dTheta = snappedTheta;
    }
  } else if (mode === 'scale') {
    dTheta = 0;
  }

  session.liveInfo = {
    deg: Math.round(((dTheta * 180) / Math.PI + 360) % 360),
    scalePct: Math.round(scale * 100)
  };

  const cos = Math.cos(dTheta);
  const sin = Math.sin(dTheta);

  restoreObjectFromBase(obj, base);
  if (obj.kind === 'polygon') {
    obj.vertices.forEach((v) => {
      const rx = (v.x - c.x) * scale;
      const ry = (v.y - c.y) * scale;
      v.x = c.x + rx * cos - ry * sin;
      v.y = c.y + rx * sin + ry * cos;
    });
  } else if (obj.kind === 'circle') {
    obj.rx = Math.max(12, base.rx * scale);
    obj.ry = Math.max(12, base.ry * scale);
    obj.rotation = (base.rotation || 0) + dTheta;
  } else if (obj.kind === 'line') {
    const p1x = (base.x1 - c.x) * scale;
    const p1y = (base.y1 - c.y) * scale;
    const p2x = (base.x2 - c.x) * scale;
    const p2y = (base.y2 - c.y) * scale;
    obj.x1 = c.x + p1x * cos - p1y * sin;
    obj.y1 = c.y + p1x * sin + p1y * cos;
    obj.x2 = c.x + p2x * cos - p2y * sin;
    obj.y2 = c.y + p2x * sin + p2y * cos;
  }
}

function restoreObjectFromBase(target, base) {
  if (target.kind === 'polygon') {
    target.vertices = base.vertices.map((v) => ({ ...v }));
  } else if (target.kind === 'circle') {
    target.cx = base.cx; target.cy = base.cy;
    target.rx = base.rx; target.ry = base.ry;
    target.rotation = base.rotation || 0;
  } else if (target.kind === 'line') {
    target.x1 = base.x1; target.y1 = base.y1;
    target.x2 = base.x2; target.y2 = base.y2;
  } else if (target.kind === 'point') {
    target.x = base.x; target.y = base.y;
  } else if (target.kind === 'arc') {
    target.cx = base.cx; target.cy = base.cy;
  } else if (target.kind === 'freehand') {
    target.points = base.points.map((p) => ({ ...p }));
  }
}

function findTopObjectAt(wx, wy) {
  const tol = 16 / state.view.scale;
  // 点・直角マーク・角度円弧を優先判定
  for (let i = state.objects.length - 1; i >= 0; i--) {
    if (state.objects[i].kind === 'point' && hitTestObject(state.objects[i], wx, wy, tol)) {
      return state.objects[i];
    }
  }
  for (let i = state.objects.length - 1; i >= 0; i--) {
    if (state.objects[i].kind === 'right_angle' && hitTestObject(state.objects[i], wx, wy, tol)) {
      return state.objects[i];
    }
  }
  for (let i = state.objects.length - 1; i >= 0; i--) {
    if (state.objects[i].kind === 'angle_arc' && hitTestObject(state.objects[i], wx, wy, tol)) {
      return state.objects[i];
    }
  }
  for (let i = state.objects.length - 1; i >= 0; i--) {
    if (hitTestObject(state.objects[i], wx, wy, tol)) {
      return state.objects[i];
    }
  }
  return null;
}

function eraseAt(wx, wy) {
  const target = findTopObjectAt(wx, wy);
  if (!target) return;
  state.objects = state.objects.filter((o) => o.id !== target.id);
  if (state.selectedId === target.id) state.selectedId = null;
  if (state.transformTargetId === target.id) state.transformTargetId = null;
  if (interaction && interaction.type === 'eraser') interaction.erased = true;
  renderAll();
}

function performCut(p1, p2) {
  if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 12) return;
  const next = [];
  let didCut = false;

  // 切断線分の法線方向に少し離すベクトル
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 6;
  const ny = (dx / len) * 6;

  for (const obj of state.objects) {
    if (obj.kind !== 'polygon') {
      next.push(obj);
      continue;
    }
    const pieces = splitPolygon(obj.vertices, p1, p2);
    if (pieces.length === 2) {
      didCut = true;
      next.push({
        ...obj,
        id: uid('poly'),
        vertices: pieces[0].map((v) => ({ ...v, x: v.x + nx, y: v.y + ny }))
      });
      next.push({
        ...obj,
        id: uid('poly'),
        vertices: pieces[1].map((v) => ({ ...v, x: v.x - nx, y: v.y - ny }))
      });
    } else {
      next.push(obj);
    }
  }

  if (didCut) {
    clearSelectionAndTransform();
    state.objects = next;
    pushHistory();
    showToast('図形を切り分けました');
  }
}

// --- レンダリング ---
function renderAll() {
  applyViewportTransform();
  renderBgImage();
  renderObjects();
  renderPreview();
  renderOverlay();
}

function renderObjectsAndOverlay() {
  renderObjects();
  renderOverlay();
}

function applyViewportTransform() {
  viewportGroup.setAttribute(
    'transform',
    `translate(${state.view.x}, ${state.view.y}) scale(${state.view.scale})`
  );
}

function renderBgImage() {
  bgImageLayer.innerHTML = '';
  if (!state.bgImage) return;
  const img = createSvgEl('image');
  const w = state.bgImage.width * state.bgImage.scale;
  const h = state.bgImage.height * state.bgImage.scale;
  img.setAttribute('href', state.bgImage.dataUrl);
  img.setAttribute('x', String(-w / 2));
  img.setAttribute('y', String(-h / 2));
  img.setAttribute('width', String(w));
  img.setAttribute('height', String(h));
  img.setAttribute('opacity', String(state.bgImage.opacity));
  bgImageLayer.appendChild(img);
}

function applyLineStyleAndAppend(container, tag, attrs, stroke, sw, lineStyle, fill = 'none') {
  const style = lineStyle || 'solid';
  const el = createSvgEl(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  el.setAttribute('stroke', stroke);
  el.setAttribute('fill', fill);

  if (style === 'double') {
    const outerW = sw * 2.2 + 2.5;
    const innerW = Math.max(1.4, sw * 0.8);
    el.setAttribute('stroke-width', String(outerW));
    container.appendChild(el);

    const inner = createSvgEl(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'marker-end') continue;
      inner.setAttribute(k, String(v));
    }
    inner.setAttribute('stroke', 'var(--bg-canvas)');
    inner.setAttribute('stroke-width', String(innerW));
    inner.setAttribute('fill', 'none');
    container.appendChild(inner);
  } else {
    el.setAttribute('stroke-width', String(sw));
    if (style === 'dashed') {
      el.setAttribute('stroke-dasharray', `${Math.max(4, sw * 2.5)} ${Math.max(4, sw * 1.9)}`);
    }
    container.appendChild(el);
  }
}

function appendEdgeMarks(container, ax, ay, bx, by, mark, stroke, sw) {
  if (!mark) return;
  const eqCount = mark.equal || 0;
  const parCount = mark.parallel || 0;
  if (eqCount === 0 && parCount === 0) return;

  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 16) return;
  const tx = dx / len;
  const ty = dy / len;
  const nx = -ty;
  const ny = tx;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;

  // 等長マーク（垂直短いバー 1〜3本）
  if (eqCount > 0) {
    const shiftBase = parCount > 0 ? -12 : 0;
    const spacing = 5.5;
    const halfH = 6 + sw * 0.4;
    for (let i = 0; i < eqCount; i++) {
      const off = shiftBase + (i - (eqCount - 1) / 2) * spacing;
      const cx = mx + tx * off;
      const cy = my + ty * off;
      const bar = createSvgEl('line');
      bar.setAttribute('x1', String(cx - nx * halfH));
      bar.setAttribute('y1', String(cy - ny * halfH));
      bar.setAttribute('x2', String(cx + nx * halfH));
      bar.setAttribute('y2', String(cy + ny * halfH));
      bar.setAttribute('stroke', stroke);
      bar.setAttribute('stroke-width', String(Math.max(2, sw * 0.85)));
      bar.setAttribute('stroke-linecap', 'round');
      container.appendChild(bar);
    }
  }

  // 平行マーク（矢じりシェブロン 1〜3個）
  if (parCount > 0) {
    const shiftBase = eqCount > 0 ? 12 : 0;
    const spacing = 6.5;
    const armLen = 6.5 + sw * 0.35;
    for (let i = 0; i < parCount; i++) {
      const off = shiftBase + (i - (parCount - 1) / 2) * spacing;
      const cx = mx + tx * off;
      const cy = my + ty * off;
      const tipX = cx + tx * (armLen * 0.55);
      const tipY = cy + ty * (armLen * 0.55);
      const b1x = cx - tx * (armLen * 0.45) + nx * (armLen * 0.65);
      const b1y = cy - ty * (armLen * 0.45) + ny * (armLen * 0.65);
      const b2x = cx - tx * (armLen * 0.45) - nx * (armLen * 0.65);
      const b2y = cy - ty * (armLen * 0.45) - ny * (armLen * 0.65);
      const chev = createSvgEl('path');
      chev.setAttribute('d', `M ${b1x} ${b1y} L ${tipX} ${tipY} L ${b2x} ${b2y}`);
      chev.setAttribute('fill', 'none');
      chev.setAttribute('stroke', stroke);
      chev.setAttribute('stroke-width', String(Math.max(2, sw * 0.85)));
      chev.setAttribute('stroke-linecap', 'round');
      chev.setAttribute('stroke-linejoin', 'round');
      container.appendChild(chev);
    }
  }
}

function renderObjects() {
  objectsLayer.innerHTML = '';
  for (const obj of state.objects) {
    const stroke = resolveColor(obj.strokeColor, state.darkMode);
    const sw = obj.strokeWidth || 2;
    const ls = obj.lineStyle || 'solid';

    if (obj.kind === 'polygon') {
      const g = createSvgEl('g');
      const fill = obj.fillEnabled ? resolveFillColor(obj.strokeColor, state.darkMode) : 'transparent';
      applyLineStyleAndAppend(
        g,
        'polygon',
        { points: obj.vertices.map((v) => `${v.x},${v.y}`).join(' '), 'stroke-linejoin': 'round' },
        stroke,
        sw,
        ls,
        fill
      );
      if (obj.edgeMarks) {
        const n = obj.vertices.length;
        for (let i = 0; i < n; i++) {
          if (obj.edgeMarks[i]) {
            const a = obj.vertices[i];
            const b = obj.vertices[(i + 1) % n];
            appendEdgeMarks(g, a.x, a.y, b.x, b.y, obj.edgeMarks[i], stroke, sw);
          }
        }
      }
      objectsLayer.appendChild(g);
    } else if (obj.kind === 'circle') {
      const attrs = { cx: obj.cx, cy: obj.cy, rx: obj.rx, ry: obj.ry };
      if (obj.rotation) {
        const deg = (obj.rotation * 180) / Math.PI;
        attrs.transform = `rotate(${deg} ${obj.cx} ${obj.cy})`;
      }
      const fill = obj.fillEnabled ? resolveFillColor(obj.strokeColor, state.darkMode) : 'transparent';
      applyLineStyleAndAppend(objectsLayer, 'ellipse', attrs, stroke, sw, ls, fill);
    } else if (obj.kind === 'line') {
      const g = createSvgEl('g');
      const attrs = { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2, 'stroke-linecap': 'round' };
      if (obj.subType === 'line_arrow') {
        attrs['marker-end'] = 'url(#arrow-head)';
      }
      applyLineStyleAndAppend(g, 'line', attrs, stroke, sw, ls, 'none');
      if (obj.edgeMark) {
        appendEdgeMarks(g, obj.x1, obj.y1, obj.x2, obj.y2, obj.edgeMark, stroke, sw);
      }
      objectsLayer.appendChild(g);
    } else if (obj.kind === 'freehand') {
      if (obj.points.length < 2) continue;
      const d = obj.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      applyLineStyleAndAppend(
        objectsLayer,
        'path',
        { d, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
        stroke,
        sw,
        ls,
        'none'
      );
    } else if (obj.kind === 'point') {
      const el = createSvgEl('circle');
      el.setAttribute('cx', String(obj.x));
      el.setAttribute('cy', String(obj.y));
      el.setAttribute('r', String(Math.max(4, sw * 1.15)));
      el.setAttribute('fill', stroke);
      objectsLayer.appendChild(el);
    } else if (obj.kind === 'right_angle') {
      const sz = obj.size || 16;
      const p1x = obj.x + obj.ux * sz;
      const p1y = obj.y + obj.uy * sz;
      const p2x = obj.x + obj.vx * sz;
      const p2y = obj.y + obj.vy * sz;
      const p3x = p1x + obj.vx * sz;
      const p3y = p1y + obj.vy * sz;
      const el = createSvgEl('path');
      el.setAttribute('d', `M ${p1x} ${p1y} L ${p3x} ${p3y} L ${p2x} ${p2y}`);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', '2.5');
      el.setAttribute('stroke-linejoin', 'round');
      el.setAttribute('stroke-linecap', 'round');
      objectsLayer.appendChild(el);
    } else if (obj.kind === 'angle_arc') {
      const g = createSvgEl('g');
      const { strokePaths, fillPath } = buildAngleArcPaths(
        obj.vx,
        obj.vy,
        obj.radius || 26,
        obj.startAngle,
        obj.deltaAngle,
        obj.arcs || 1
      );
      if (obj.fillEnabled) {
        const fEl = createSvgEl('path');
        fEl.setAttribute('d', fillPath);
        fEl.setAttribute('fill', resolveFillColor(obj.fillColor || obj.strokeColor, state.darkMode));
        fEl.setAttribute('fill-opacity', '0.85');
        g.appendChild(fEl);
      }
      for (const sp of strokePaths) {
        const pEl = createSvgEl('path');
        pEl.setAttribute('d', sp);
        pEl.setAttribute('fill', 'none');
        pEl.setAttribute('stroke', stroke);
        pEl.setAttribute('stroke-width', String(Math.max(1.8, sw)));
        pEl.setAttribute('stroke-linecap', 'round');
        g.appendChild(pEl);
      }
      objectsLayer.appendChild(g);
    } else if (obj.kind === 'arc') {
      if (obj.isFullCircle) {
        applyLineStyleAndAppend(objectsLayer, 'circle', { cx: obj.cx, cy: obj.cy, r: obj.r }, stroke, sw, ls, 'none');
      } else {
        applyLineStyleAndAppend(
          objectsLayer,
          'path',
          { d: buildArcSvgPath(obj.cx, obj.cy, obj.r, obj.startAngle, obj.deltaAngle), 'stroke-linecap': 'round' },
          stroke,
          sw,
          ls,
          'none'
        );
      }
    }
  }
}

function renderPreview() {
  previewLayer.innerHTML = '';

  // PC/単指用の固定支点ピン表示
  if (state.tool === 'compass' && compassPinnedAnchor && (!interaction || interaction.type !== 'compass_two_finger')) {
    drawCompassPin(compassPinnedAnchor.x, compassPinnedAnchor.y);
  }

  if (!interaction) return;

  const stroke = resolveColor(state.style.strokeColor, state.darkMode);
  const sw = state.style.strokeWidth;

  if (interaction.type === 'place_point') {
    const ptEl = createSvgEl('circle');
    ptEl.setAttribute('cx', String(interaction.x));
    ptEl.setAttribute('cy', String(interaction.y));
    ptEl.setAttribute('r', String(Math.max(4, sw * 1.15)));
    ptEl.setAttribute('fill', stroke);
    previewLayer.appendChild(ptEl);

    const ring = createSvgEl('circle');
    ring.setAttribute('cx', String(interaction.x));
    ring.setAttribute('cy', String(interaction.y));
    ring.setAttribute('r', String(14 / state.view.scale));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#3b82f6');
    ring.setAttribute('stroke-width', String(1.5 / state.view.scale));
    ring.setAttribute('stroke-dasharray', `${3 / state.view.scale} ${3 / state.view.scale}`);
    previewLayer.appendChild(ring);
  } else if (interaction.type === 'draw_line') {
    const attrs = {
      x1: interaction.x1,
      y1: interaction.y1,
      x2: interaction.x2,
      y2: interaction.y2,
      'stroke-linecap': 'round'
    };
    if (interaction.subType === 'line_arrow') attrs['marker-end'] = 'url(#arrow-head)';
    applyLineStyleAndAppend(previewLayer, 'line', attrs, stroke, sw, state.style.lineStyle || 'solid', 'none');

    const gridLen = (Math.hypot(interaction.x2 - interaction.x1, interaction.y2 - interaction.y1) / GRID_SIZE).toFixed(1);
    if (interaction.perpSnap) {
      const ps = interaction.perpSnap;
      if (ps.extFrom) {
        const ext = createSvgEl('line');
        ext.setAttribute('x1', String(ps.extFrom.x));
        ext.setAttribute('y1', String(ps.extFrom.y));
        ext.setAttribute('x2', String(ps.x));
        ext.setAttribute('y2', String(ps.y));
        ext.setAttribute('stroke', '#3b82f6');
        ext.setAttribute('stroke-width', String(1.5 / state.view.scale));
        ext.setAttribute('stroke-dasharray', `${4 / state.view.scale} ${4 / state.view.scale}`);
        previewLayer.appendChild(ext);
      }
      const sz = 16;
      const p1x = ps.x + ps.ux * sz, p1y = ps.y + ps.uy * sz;
      const p2x = ps.x + ps.vx * sz, p2y = ps.y + ps.vy * sz;
      const p3x = p1x + ps.vx * sz, p3y = p1y + ps.vy * sz;
      const raPath = createSvgEl('path');
      raPath.setAttribute('d', `M ${p1x} ${p1y} L ${p3x} ${p3y} L ${p2x} ${p2y}`);
      raPath.setAttribute('fill', 'none');
      raPath.setAttribute('stroke', '#ef4444');
      raPath.setAttribute('stroke-width', String(2.5 / state.view.scale));
      previewLayer.appendChild(raPath);
      drawFloatingBadge((interaction.x1 + interaction.x2) / 2, (interaction.y1 + interaction.y2) / 2 - 14, `${gridLen} マス (90°)`);
    } else {
      drawFloatingBadge((interaction.x1 + interaction.x2) / 2, (interaction.y1 + interaction.y2) / 2 - 14, `${gridLen} マス`);
    }
  } else if (interaction.type === 'draw_freehand' && interaction.points.length >= 2) {
    const d = interaction.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    applyLineStyleAndAppend(
      previewLayer,
      'path',
      { d, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
      stroke,
      sw,
      state.style.lineStyle || 'solid',
      'none'
    );
  } else if (interaction.type === 'scissors') {
    const el = createSvgEl('line');
    el.setAttribute('x1', String(interaction.x1));
    el.setAttribute('y1', String(interaction.y1));
    el.setAttribute('x2', String(interaction.x2));
    el.setAttribute('y2', String(interaction.y2));
    el.setAttribute('stroke', '#f59e0b');
    el.setAttribute('stroke-width', String(3 / state.view.scale));
    el.setAttribute('stroke-dasharray', `${8 / state.view.scale} ${6 / state.view.scale}`);
    previewLayer.appendChild(el);
  } else if (interaction.type === 'compass_anchor_hold') {
    drawCompassPin(interaction.anchor.x, interaction.anchor.y);
  } else if (interaction.type === 'compass_two_finger' || interaction.type === 'compass_pinned_drag') {
    const { anchor, radius, startAngle, deltaAngle } = interaction;
    drawCompassPin(anchor.x, anchor.y);

    // 薄い全周ガイド円
    const guide = createSvgEl('circle');
    guide.setAttribute('cx', String(anchor.x));
    guide.setAttribute('cy', String(anchor.y));
    guide.setAttribute('r', String(radius));
    guide.setAttribute('fill', 'none');
    guide.setAttribute('stroke', '#f59e0b');
    guide.setAttribute('stroke-width', String(1.5 / state.view.scale));
    guide.setAttribute('stroke-dasharray', `${5 / state.view.scale} ${5 / state.view.scale}`);
    guide.setAttribute('opacity', '0.6');
    previewLayer.appendChild(guide);

    // コンパス脚線（支点→現在の描画点）
    const curAngle = startAngle + deltaAngle;
    const penX = anchor.x + radius * Math.cos(curAngle);
    const penY = anchor.y + radius * Math.sin(curAngle);
    const leg = createSvgEl('line');
    leg.setAttribute('x1', String(anchor.x));
    leg.setAttribute('y1', String(anchor.y));
    leg.setAttribute('x2', String(penX));
    leg.setAttribute('y2', String(penY));
    leg.setAttribute('stroke', '#f59e0b');
    leg.setAttribute('stroke-width', String(2 / state.view.scale));
    previewLayer.appendChild(leg);

    // 描いている円弧
    if (Math.abs(deltaAngle) > 0.02) {
      const arc = createSvgEl('path');
      arc.setAttribute('d', buildArcSvgPath(anchor.x, anchor.y, radius, startAngle, deltaAngle));
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', stroke);
      arc.setAttribute('stroke-width', String(sw));
      arc.setAttribute('stroke-linecap', 'round');
      previewLayer.appendChild(arc);
    }

    const deg = Math.round((Math.abs(deltaAngle) * 180) / Math.PI);
    const rGrid = (radius / GRID_SIZE).toFixed(1);
    drawFloatingBadge(penX, penY - 18, `r=${rGrid}マス  ${deg}°`);
  }
}

function drawCompassPin(x, y) {
  const s = 1 / state.view.scale;
  const outer = createSvgEl('circle');
  outer.setAttribute('cx', String(x));
  outer.setAttribute('cy', String(y));
  outer.setAttribute('r', String(14 * s));
  outer.setAttribute('fill', 'rgba(245, 158, 11, 0.22)');
  outer.setAttribute('stroke', '#f59e0b');
  outer.setAttribute('stroke-width', String(2 * s));
  previewLayer.appendChild(outer);

  const inner = createSvgEl('circle');
  inner.setAttribute('cx', String(x));
  inner.setAttribute('cy', String(y));
  inner.setAttribute('r', String(4 * s));
  inner.setAttribute('fill', '#d97706');
  previewLayer.appendChild(inner);
}

function drawFloatingBadge(x, y, text) {
  const s = 1 / state.view.scale;
  const g = createSvgEl('g');
  g.setAttribute('transform', `translate(${x}, ${y}) scale(${s})`);
  const txt = createSvgEl('text');
  txt.setAttribute('x', '0');
  txt.setAttribute('y', '0');
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('font-size', '12');
  txt.setAttribute('font-weight', '700');
  txt.setAttribute('fill', state.darkMode ? '#fde047' : '#1d4ed8');
  txt.setAttribute('stroke', state.darkMode ? '#0f172a' : '#ffffff');
  txt.setAttribute('stroke-width', '3');
  txt.setAttribute('paint-order', 'stroke');
  txt.textContent = text;
  g.appendChild(txt);
  previewLayer.appendChild(g);
}

function renderOverlay() {
  overlayLayer.innerHTML = '';
  const s = 1 / state.view.scale;

  // 選択中（複数選択・グループ含む）のハイライト表示
  const selIds = state.selectedIds.length > 0 ? state.selectedIds : (state.selectedId ? [state.selectedId] : []);
  if (!state.transformTargetId && selIds.length > 0) {
    for (const id of selIds) {
      const sel = state.objects.find((o) => o.id === id);
      if (!sel) continue;
      if (sel.kind === 'polygon') {
        const outline = createSvgEl('polygon');
        outline.setAttribute('points', sel.vertices.map((v) => `${v.x},${v.y}`).join(' '));
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', sel.groupId ? '#10b981' : '#3b82f6');
        outline.setAttribute('stroke-width', String(2 * s));
        outline.setAttribute('stroke-dasharray', `${5 * s} ${4 * s}`);
        outline.setAttribute('opacity', '0.75');
        overlayLayer.appendChild(outline);
      }
      const c = getObjectCenter(sel);
      const cross = createSvgEl('circle');
      cross.setAttribute('cx', String(c.x));
      cross.setAttribute('cy', String(c.y));
      cross.setAttribute('r', String(4.5 * s));
      cross.setAttribute('fill', sel.groupId ? '#10b981' : '#3b82f6');
      cross.setAttribute('opacity', '0.8');
      overlayLayer.appendChild(cross);
    }
  }

  // 長押し変形モード中のハンドル表示
  const tfObj = getTransformTarget();
  if (!tfObj) return;

  const c = getObjectCenter(tfObj);
  // 中心軸マーク
  const axis = createSvgEl('g');
  axis.setAttribute('stroke', '#2563eb');
  axis.setAttribute('stroke-width', String(2 * s));
  const l1 = createSvgEl('line');
  l1.setAttribute('x1', String(c.x - 8 * s)); l1.setAttribute('y1', String(c.y));
  l1.setAttribute('x2', String(c.x + 8 * s)); l1.setAttribute('y2', String(c.y));
  const l2 = createSvgEl('line');
  l2.setAttribute('x1', String(c.x)); l2.setAttribute('y1', String(c.y - 8 * s));
  l2.setAttribute('x2', String(c.x)); l2.setAttribute('y2', String(c.y + 8 * s));
  axis.append(l1, l2);
  overlayLayer.appendChild(axis);

  const handles = getTransformHandles(tfObj);
  for (const h of handles) {
    // 中心からの点線ガイド
    const guide = createSvgEl('line');
    guide.setAttribute('x1', String(c.x));
    guide.setAttribute('y1', String(c.y));
    guide.setAttribute('x2', String(h.x));
    guide.setAttribute('y2', String(h.y));
    guide.setAttribute('stroke', '#3b82f6');
    guide.setAttribute('stroke-width', String(1.2 * s));
    guide.setAttribute('stroke-dasharray', `${4 * s} ${4 * s}`);
    guide.setAttribute('opacity', '0.5');
    overlayLayer.appendChild(guide);

    const ring = createSvgEl('circle');
    ring.setAttribute('cx', String(h.x));
    ring.setAttribute('cy', String(h.y));
    ring.setAttribute('r', String(11 * s));
    ring.setAttribute('fill', '#ffffff');
    ring.setAttribute('stroke', state.transformSubMode === 'vertex' ? '#f59e0b' : '#2563eb');
    ring.setAttribute('stroke-width', String(3 * s));
    ring.style.cursor = 'grab';
    overlayLayer.appendChild(ring);
  }

  if (interaction && interaction.type === 'handle_drag' && interaction.liveInfo) {
    const info = interaction.liveInfo;
    drawFloatingBadge(c.x, c.y - 24 * s, `${info.deg}° / ${info.scalePct}%`);
  }
}

function createSvgEl(tag) {
  return document.createElementNS(SVG_NS, tag);
}

// --- ドラッグ時拡大虫眼鏡（ルーペ） ---
function shouldShowLoupe(actionKind, obj) {
  if (state.loupeMode === 'off') return false;
  if (state.loupeMode === 'always') return true;
  // autoモード: すべての図形・点の移動、点配置、線、頂点、はさみ、コンパス時に表示
  if (actionKind === 'move_obj' || actionKind === 'place_point' || actionKind === 'draw_line' ||
      actionKind === 'scissors' || actionKind === 'handle_drag' || actionKind === 'compass') {
    return true;
  }
  return false;
}

function showLoupeIfNeeded(actionKind, obj, wx, wy, clientX, clientY) {
  if (!shouldShowLoupe(actionKind, obj)) {
    hideLoupe();
    return;
  }
  const rect = svg.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const R = 72;

  // 指に隠れない位置（基本は指の真上115px、上端に近ければ下115pxへ自動退避）
  const lx = Math.max(R + 12, Math.min(rect.width - R - 12, sx));
  const ly = sy > 195 ? sy - 115 : Math.min(rect.height - R - 12, sy + 115);

  const loupeScale = Math.max(2.0, state.view.scale * 2.4);
  const tx = lx - wx * loupeScale;
  const ty = ly - wy * loupeScale;

  loupeClipCircle.setAttribute('cx', String(lx));
  loupeClipCircle.setAttribute('cy', String(ly));
  loupeShadow.setAttribute('cx', String(lx));
  loupeShadow.setAttribute('cy', String(ly + 3));
  loupeBg.setAttribute('x', String(lx - R - 4));
  loupeBg.setAttribute('y', String(ly - R - 4));
  loupeBg.setAttribute('width', String((R + 4) * 2));
  loupeBg.setAttribute('height', String((R + 4) * 2));
  loupeUse.setAttribute('transform', `translate(${tx}, ${ty}) scale(${loupeScale})`);

  loupeRing.setAttribute('cx', String(lx));
  loupeRing.setAttribute('cy', String(ly));
  loupeCrossH.setAttribute('x1', String(lx - 16));
  loupeCrossH.setAttribute('x2', String(lx + 16));
  loupeCrossH.setAttribute('y1', String(ly));
  loupeCrossH.setAttribute('y2', String(ly));
  loupeCrossV.setAttribute('x1', String(lx));
  loupeCrossV.setAttribute('x2', String(lx));
  loupeCrossV.setAttribute('y1', String(ly - 16));
  loupeCrossV.setAttribute('y2', String(ly + 16));
  loupeCenterDot.setAttribute('cx', String(lx));
  loupeCenterDot.setAttribute('cy', String(ly));

  loupeLayer.style.display = '';
}

function hideLoupe() {
  if (loupeLayer) loupeLayer.style.display = 'none';
}

// --- JSON / ZIP / 背景画像 入出力 ---
function buildNotePayload(includeInlineImage = true) {
  return {
    app: 'mathnote-geometry',
    version: 1,
    savedAt: new Date().toISOString(),
    settings: {
      darkMode: state.darkMode,
      snapEnabled: state.snapEnabled,
      ageLevel: state.ageLevel
    },
    view: { ...state.view },
    objects: state.objects,
    bgImage: state.bgImage
      ? {
          width: state.bgImage.width,
          height: state.bgImage.height,
          opacity: state.bgImage.opacity,
          scale: state.bgImage.scale,
          mime: state.bgImage.mime,
          ext: state.bgImage.ext,
          assetPath: `assets/bg_image.${state.bgImage.ext}`,
          dataUrl: includeInlineImage ? state.bgImage.dataUrl : undefined
        }
      : null
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function exportJson() {
  const payload = buildNotePayload(true);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `zukei_note_${timestampSlug()}.json`);
  showToast('JSONファイルを保存しました');
}

async function exportZip() {
  const files = [];
  const payload = buildNotePayload(false);
  files.push({
    name: 'note.json',
    data: JSON.stringify(payload, null, 2)
  });

  if (state.bgImage && state.bgImage.bytes) {
    files.push({
      name: `assets/bg_image.${state.bgImage.ext}`,
      data: state.bgImage.bytes
    });
  }

  const zipBlob = createZipBlob(files);
  downloadBlob(zipBlob, `zukei_note_${timestampSlug()}.zip`);
  showToast('ZIPファイルを保存しました');
}

async function applyLoadedPayload(payload, assetBytesMap = null) {
  if (!payload || !Array.isArray(payload.objects)) {
    throw new Error('ノートの形式が正しくありません。');
  }
  state.objects = payload.objects;
  if (payload.view) {
    state.view = { ...state.view, ...payload.view };
  }
  if (payload.settings) {
    if (typeof payload.settings.darkMode === 'boolean') state.darkMode = payload.settings.darkMode;
    if (typeof payload.settings.snapEnabled === 'boolean') state.snapEnabled = payload.settings.snapEnabled;
  }

  state.bgImage = null;
  if (payload.bgImage) {
    if (assetBytesMap && payload.bgImage.assetPath && assetBytesMap.has(payload.bgImage.assetPath)) {
      const bytes = assetBytesMap.get(payload.bgImage.assetPath);
      const blob = new Blob([bytes], { type: payload.bgImage.mime || 'image/png' });
      const dataUrl = await blobToDataUrl(blob);
      state.bgImage = {
        ...payload.bgImage,
        bytes,
        dataUrl
      };
    } else if (payload.bgImage.dataUrl) {
      const bytes = await dataUrlToBytes(payload.bgImage.dataUrl);
      state.bgImage = {
        ...payload.bgImage,
        bytes
      };
    }
  }

  clearSelectionAndTransform();
  applyTheme();
  updateToolbarState();
  updateBgControlsUI();
  pushHistory();
  renderAll();
}

function handleJsonImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(String(reader.result));
      await applyLoadedPayload(payload);
      showToast('JSONを読み込みました');
    } catch (err) {
      alert(`JSON読み込みエラー: ${err.message}`);
    }
  };
  reader.readAsText(file, 'utf-8');
}

async function handleZipImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const map = await readZipBuffer(buf);
    const jsonBytes = map.get('note.json');
    if (!jsonBytes) throw new Error('ZIP内に note.json が見つかりません。');
    const payload = JSON.parse(new TextDecoder('utf-8').decode(jsonBytes));
    await applyLoadedPayload(payload, map);
    showToast('ZIPを読み込みました');
  } catch (err) {
    alert(`ZIP読み込みエラー: ${err.message}`);
  }
}

async function handleImageImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dataUrl = await blobToDataUrl(file);
    const dims = await getImageDimensions(dataUrl);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    state.bgImage = {
      dataUrl,
      bytes,
      mime: file.type || 'image/png',
      ext,
      width: dims.width,
      height: dims.height,
      opacity: 0.65,
      scale: 1
    };
    updateBgControlsUI();
    renderBgImage();
    showToast('画像に方眼紙を重ねました');
  } catch (err) {
    alert(`画像読み込みエラー: ${err.message}`);
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBytes(dataUrl) {
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

init();
