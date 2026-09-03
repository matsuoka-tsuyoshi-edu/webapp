/**
 * りずむクエスト - 1週間のせいかつリズムを整えよう！
 * 変更: スクリーンタイムのデフォルト設定変更（毎日19:00〜20:00、土日13:00〜16:00削除）
 */

// 1. 定数・設定
const DAYS = [
  { id: 'sun', name: '日曜日', short: '日', badgeClass: 'sun' },
  { id: 'mon', name: '月曜日', short: '月', badgeClass: '' },
  { id: 'tue', name: '火曜日', short: '火', badgeClass: '' },
  { id: 'wed', name: '水曜日', short: '水', badgeClass: '' },
  { id: 'thu', name: '木曜日', short: '木', badgeClass: '' },
  { id: 'fri', name: '金曜日', short: '金', badgeClass: '' },
  { id: 'sat', name: '土曜日', short: '土', badgeClass: 'sat' }
];

const CATEGORIES = {
  sleep: { id: 'sleep', name: 'すいみん', color: '#2563eb', icon: 'fa-moon' },
  meal: { id: 'meal', name: 'ごはん', color: '#ea580c', icon: 'fa-utensils' },
  study: { id: 'study', name: '勉強', color: '#7c3aed', icon: 'fa-book-open' },
  play: { id: 'play', name: 'スクリーンタイム', color: '#059669', icon: 'fa-mobile-screen-button' },
  exercise: { id: 'exercise', name: '運動', color: '#dc2626', icon: 'fa-person-running' }
};

// 2. アプリ状態
let state = {
  viewMode: 'week', // 'week' or 'day'
  selectedDayIndex: 1, // デフォルト: 月曜日
  activeCategory: 'sleep',
  snapMinutes: 15,
  sleepCalcMode: 'morning_wake', // 'morning_wake' (前の日から今朝までのすいみん) or 'night_start' (今晩から次の日の朝までのすいみん)
  blocks: [],
  editingBlockId: null
};

// ドラッグ中一時状態
let dragContext = null;

// 3. 初期化処理
document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadData();
  renderAll();
  setupEventListeners();
});

// --------------------------------------------------------------------------
// UI初期描画
// --------------------------------------------------------------------------
function initUI() {
  const pillsContainer = document.getElementById('category-pills');
  pillsContainer.innerHTML = '';
  Object.values(CATEGORIES).forEach(cat => {
    const pill = document.createElement('button');
    pill.className = `cat-pill ${cat.id === state.activeCategory ? 'active' : ''}`;
    pill.style.backgroundColor = cat.color;
    pill.style.color = '#fff';
    pill.innerHTML = `<i class="fa-solid ${cat.icon}"></i> ${cat.name}`;
    pill.addEventListener('click', () => {
      state.activeCategory = cat.id;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
    pillsContainer.appendChild(pill);
  });

  const ticksContainer = document.getElementById('timeline-ticks');
  ticksContainer.innerHTML = '';
  for (let hour = 0; hour <= 24; hour += 2) {
    const tick = document.createElement('div');
    tick.className = 'tick-mark';
    tick.style.left = `${(hour / 24) * 100}%`;
    tick.textContent = `${hour}:00`;
    ticksContainer.appendChild(tick);
  }

  const daysContainer = document.getElementById('days-container');
  daysContainer.innerHTML = '';
  DAYS.forEach((day, index) => {
    const row = document.createElement('div');
    row.className = 'day-row';
    row.dataset.dayIndex = index;

    const badgeCol = document.createElement('div');
    badgeCol.className = 'day-badge-col';
    badgeCol.innerHTML = `<span class="day-badge ${day.badgeClass}" title="タップで1日表示">${day.name}</span>`;
    badgeCol.addEventListener('click', () => {
      switchViewMode('day', index);
    });

    const track = document.createElement('div');
    track.className = 'timeline-track';
    track.dataset.dayIndex = index;

    for (let h = 1; h < 24; h++) {
      const line = document.createElement('div');
      line.className = `grid-line ${h % 6 === 0 ? 'major' : ''}`;
      line.style.left = `${(h / 24) * 100}%`;
      track.appendChild(line);
    }

    row.appendChild(badgeCol);
    row.appendChild(track);
    daysContainer.appendChild(row);
  });
}

// --------------------------------------------------------------------------
// ビューモード切り替え (1週間表示 / 1日詳細表示)
// --------------------------------------------------------------------------
function switchViewMode(mode, dayIndex = 1) {
  state.viewMode = mode;
  state.selectedDayIndex = dayIndex;

  const daysContainer = document.getElementById('days-container');
  const copyContainer = document.getElementById('day-copy-container');

  document.querySelectorAll('.view-tab').forEach(tab => {
    const tabMode = tab.dataset.view;
    const tabDay = parseInt(tab.dataset.day, 10);

    if (mode === 'week' && tabMode === 'week') {
      tab.classList.add('active');
    } else if (mode === 'day' && tabMode === 'day' && tabDay === dayIndex) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const rows = daysContainer.querySelectorAll('.day-row');
  if (mode === 'week') {
    daysContainer.classList.remove('mode-single-day');
    copyContainer.style.display = 'none';
    rows.forEach(r => r.style.display = 'flex');
  } else {
    daysContainer.classList.add('mode-single-day');
    copyContainer.style.display = 'block';
    rows.forEach(r => {
      const rIndex = parseInt(r.dataset.dayIndex, 10);
      r.style.display = (rIndex === dayIndex) ? 'flex' : 'none';
    });
  }

  renderAll();
}

// --------------------------------------------------------------------------
// 描画更新 & 重なり判定
// --------------------------------------------------------------------------
function renderAll() {
  renderBlocks();
  renderStats();
}

function renderBlocks() {
  document.querySelectorAll('.timeline-track').forEach(track => {
    track.querySelectorAll('.activity-block').forEach(b => b.remove());
  });

  const renderedSegments = [];

  state.blocks.forEach(block => {
    if (!CATEGORIES[block.category]) return;

    let start = block.startHour;
    let end = block.endHour;

    if (end <= 24) {
      renderedSegments.push({
        blockId: block.id,
        dayIndex: block.dayIndex,
        startHour: start,
        endHour: end,
        category: block.category,
        isSegment: false
      });
    } else {
      // 日またぎ睡眠ブロック
      renderedSegments.push({
        blockId: block.id,
        dayIndex: block.dayIndex,
        startHour: start,
        endHour: 24,
        category: block.category,
        isSegment: true,
        part: 'night'
      });
      const nextDayIndex = (block.dayIndex + 1) % 7;
      renderedSegments.push({
        blockId: block.id,
        dayIndex: nextDayIndex,
        startHour: 0,
        endHour: end - 24,
        category: block.category,
        isSegment: true,
        part: 'morning'
      });
    }
  });

  // 重なり判定
  const overlappingBlockIds = new Set();
  const daySegmentGroups = {};

  renderedSegments.forEach(seg => {
    if (!daySegmentGroups[seg.dayIndex]) daySegmentGroups[seg.dayIndex] = [];
    daySegmentGroups[seg.dayIndex].push(seg);
  });

  Object.values(daySegmentGroups).forEach(segs => {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const segA = segs[i];
        const segB = segs[j];
        if (segA.startHour < segB.endHour && segA.endHour > segB.startHour) {
          overlappingBlockIds.add(segA.blockId);
          overlappingBlockIds.add(segB.blockId);
        }
      }
    }
  });

  // DOMエレメント配置
  renderedSegments.forEach(seg => {
    const track = document.querySelector(`.timeline-track[data-day-index="${seg.dayIndex}"]`);
    if (!track) return;

    const block = state.blocks.find(b => b.id === seg.blockId);
    if (!block) return;

    const cat = CATEGORIES[seg.category] || CATEGORIES.play;
    const blockEl = document.createElement('div');
    blockEl.className = 'activity-block';
    blockEl.dataset.blockId = block.id;

    if (overlappingBlockIds.has(block.id)) {
      blockEl.classList.add('overlap-warning');
    }

    const leftPercent = (seg.startHour / 24) * 100;
    const widthPercent = ((seg.endHour - seg.startHour) / 24) * 100;

    blockEl.style.left = `${leftPercent}%`;
    blockEl.style.width = `${widthPercent}%`;
    blockEl.style.backgroundColor = cat.color;

    let timeText = '';
    if (seg.isSegment) {
      if (seg.part === 'night') {
        timeText = `${formatHour(block.startHour)}〜翌${formatHour(block.endHour - 24)}`;
      } else {
        timeText = `〜${formatHour(block.endHour - 24)}`;
      }
    } else {
      timeText = `${formatHour(block.startHour)}-${formatHour(block.endHour)}`;
    }

    blockEl.innerHTML = `
      <div class="block-handle handle-left" data-action="resize-left"></div>
      <div class="block-content">
        <span class="block-title"><i class="fa-solid ${cat.icon}"></i> ${cat.name}</span>
        <span class="block-time-range">(${timeText})</span>
      </div>
      <div class="block-handle handle-right" data-action="resize-right"></div>
    `;

    track.appendChild(blockEl);
  });

  const alertContainer = document.getElementById('overlap-alert-container');
  if (overlappingBlockIds.size > 0) {
    alertContainer.innerHTML = `
      <div class="overlap-alert-box">
        <i class="fa-solid fa-triangle-exclamation text-red-600 text-lg"></i>
        <span>⚠️ 【注意】同じ時間帯に 複数の予定が重なっています！ 重なった部分は二重にカウントされません。</span>
      </div>
    `;
  } else {
    alertContainer.innerHTML = '';
  }
}

// --------------------------------------------------------------------------
// 統計集計 (モードに応じた切り替え対応)
// --------------------------------------------------------------------------
function renderStats() {
  const statsGrid = document.getElementById('stats-grid');
  const sectionTitle = document.getElementById('stats-section-title');
  statsGrid.innerHTML = '';

  const isDayMode = state.viewMode === 'day';
  const selectedDay = DAYS[state.selectedDayIndex];

  if (isDayMode) {
    sectionTitle.innerHTML = `<i class="fa-solid fa-calendar-day"></i> 【${selectedDay.name}】の リズムふりかえり`;
  } else {
    sectionTitle.innerHTML = `<i class="fa-solid fa-trophy"></i> 1しゅうかんの リズムふりかえり`;
  }

  const categoryTotals = {};
  Object.keys(CATEGORIES).forEach(k => categoryTotals[k] = 0);

  if (isDayMode) {
    const currentDayIdx = state.selectedDayIndex;

    Object.keys(CATEGORIES).forEach(catId => {
      if (catId === 'sleep') {
        let sleepBlocks = [];

        if (state.sleepCalcMode === 'morning_wake') {
          // モード1 (デフォルト): 【前の日から今朝までのすいみん】 (例: 日曜22:00〜月曜06:00)
          const prevDayIdx = (currentDayIdx + 6) % 7;
          sleepBlocks = state.blocks.filter(b => b.category === 'sleep' && b.dayIndex === prevDayIdx);
        } else {
          // モード2: 【今晩から次の日の朝までのすいみん】 (例: 月曜22:00〜火曜06:00)
          sleepBlocks = state.blocks.filter(b => b.category === 'sleep' && b.dayIndex === currentDayIdx);
        }

        let intervals = sleepBlocks.map(b => [b.startHour, b.endHour]);
        if (intervals.length > 0) {
          intervals.sort((a, b) => a[0] - b[0]);
          let merged = [intervals[0]];
          for (let i = 1; i < intervals.length; i++) {
            let current = intervals[i];
            let last = merged[merged.length - 1];
            if (current[0] <= last[1]) {
              last[1] = Math.max(last[1], current[1]);
            } else {
              merged.push(current);
            }
          }
          let sum = 0;
          merged.forEach(inv => sum += (inv[1] - inv[0]));
          categoryTotals.sleep = sum;
        }
      } else {
        // その他の活動カテゴリ (0:00〜24:00)
        const dayBlocks = state.blocks.filter(b => b.category === catId && b.dayIndex === currentDayIdx);
        let intervals = dayBlocks.map(b => [b.startHour, Math.min(24, b.endHour)]);

        if (intervals.length > 0) {
          intervals.sort((a, b) => a[0] - b[0]);
          let merged = [intervals[0]];
          for (let i = 1; i < intervals.length; i++) {
            let current = intervals[i];
            let last = merged[merged.length - 1];
            if (current[0] <= last[1]) {
              last[1] = Math.max(last[1], current[1]);
            } else {
              merged.push(current);
            }
          }
          let sum = 0;
          merged.forEach(inv => sum += (inv[1] - inv[0]));
          categoryTotals[catId] = sum;
        }
      }
    });
  } else {
    // 1週間一覧モード
    for (let day = 0; day < 7; day++) {
      const dayIntervalsByCategory = {};
      Object.keys(CATEGORIES).forEach(k => dayIntervalsByCategory[k] = []);

      state.blocks.forEach(block => {
        if (!CATEGORIES[block.category]) return;
        let start = block.startHour;
        let end = block.endHour;

        if (end <= 24) {
          if (block.dayIndex === day) dayIntervalsByCategory[block.category].push([start, end]);
        } else {
          if (block.dayIndex === day) dayIntervalsByCategory[block.category].push([start, 24]);
          const nextDay = (block.dayIndex + 1) % 7;
          if (nextDay === day) dayIntervalsByCategory[block.category].push([0, end - 24]);
        }
      });

      Object.keys(CATEGORIES).forEach(catId => {
        const intervals = dayIntervalsByCategory[catId];
        if (intervals.length === 0) return;

        intervals.sort((a, b) => a[0] - b[0]);
        let merged = [intervals[0]];
        for (let i = 1; i < intervals.length; i++) {
          let current = intervals[i];
          let last = merged[merged.length - 1];
          if (current[0] <= last[1]) {
            last[1] = Math.max(last[1], current[1]);
          } else {
            merged.push(current);
          }
        }
        let daySum = 0;
        merged.forEach(inv => daySum += (inv[1] - inv[0]));
        categoryTotals[catId] += daySum;
      });
    }
  }

  Object.values(CATEGORIES).forEach(cat => {
    const hours = categoryTotals[cat.id] || 0;

    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.borderLeftColor = cat.color;

    if (isDayMode) {
      let subtext = `【${selectedDay.name}】の合計`;
      if (cat.id === 'sleep') {
        if (state.sleepCalcMode === 'morning_wake') {
          subtext = `🌅 前の日から今朝までのすいみん`;
        } else {
          subtext = `🌙 今晩から次の日の朝までのすいみん`;
        }
      }

      card.innerHTML = `
        <span class="cat-name"><i class="fa-solid ${cat.icon}"></i> ${cat.name}</span>
        <span class="total-hours">${formatDurationHours(hours)}</span>
        <span class="avg-hours">${subtext}</span>
      `;
    } else {
      const avgHours = (hours / 7).toFixed(1);
      card.innerHTML = `
        <span class="cat-name"><i class="fa-solid ${cat.icon}"></i> ${cat.name}</span>
        <span class="total-hours">${formatDurationHours(hours)}</span>
        <span class="avg-hours">1日平均: 約 ${avgHours}時間</span>
      `;
    }
    statsGrid.appendChild(card);
  });

  renderInsights(categoryTotals, isDayMode, selectedDay.name);
}

function renderInsights(totals, isDayMode, dayName) {
  const container = document.getElementById('habit-insights');
  container.innerHTML = '';

  const sleepHours = isDayMode ? totals.sleep : totals.sleep / 7;
  const exerciseHours = totals.exercise;

  const insights = [];

  if (isDayMode) {
    const sleepLabel = state.sleepCalcMode === 'morning_wake' ? '前の日から今朝までのすいみん' : '今晩から次の日の朝までのすいみん';
    if (sleepHours >= 7.5 && sleepHours <= 9.5) {
      insights.push({ type: 'good', text: `【${dayName}】のすいみん（${sleepLabel}）は ${formatDurationHours(sleepHours)} で、とても健康的です！✨` });
    } else if (sleepHours < 7.0 && sleepHours > 0) {
      insights.push({ type: 'warn', text: `【${dayName}】のすいみん（${sleepLabel}）が ${formatDurationHours(sleepHours)} と少し少なめです。夜は早めにねよう！🌙` });
    } else if (sleepHours === 0) {
      insights.push({ type: 'warn', text: `【${dayName}】にすいみんの予定がありません。ねる時間をいれましょう！` });
    }

    if (exerciseHours >= 1) {
      insights.push({ type: 'good', text: `【${dayName}】は ${formatDurationHours(exerciseHours)} しっかり体を動かせました！🏃‍♂️` });
    }
  } else {
    if (sleepHours >= 7.5 && sleepHours <= 9.5) {
      insights.push({ type: 'good', text: `ねる時間が 1日平均 ${sleepHours.toFixed(1)}時間 で、とってもすばらしい生活リズムです！✨` });
    } else if (sleepHours < 7.0) {
      insights.push({ type: 'warn', text: `ねる時間が 1日平均 ${sleepHours.toFixed(1)}時間 です。成長や元気のために、もう少し早くねよう！🌙` });
    }

    if (exerciseHours >= 3) {
      insights.push({ type: 'good', text: `運動の時間が1週間で ${exerciseHours.toFixed(1)}時間 あります！体を動かす素晴らしい習慣です🏃‍♂️` });
    } else {
      insights.push({ type: 'warn', text: `運動の時間が少なめです。外で遊んだり運動する時間を増やしてみよう！⚽` });
    }
  }

  insights.forEach(item => {
    const div = document.createElement('div');
    div.className = `insight-item ${item.type === 'warn' ? 'warn-item' : ''}`;
    const icon = item.type === 'good' ? 'fa-circle-check' : item.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info';
    div.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${item.text}</span>`;
    container.appendChild(div);
  });
}

// --------------------------------------------------------------------------
// イベントリスナー設定
// --------------------------------------------------------------------------
function setupEventListeners() {
  const daysContainer = document.getElementById('days-container');

  daysContainer.addEventListener('pointerdown', onPointerDown);

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  document.getElementById('view-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.view-tab');
    if (!btn) return;
    const mode = btn.dataset.view;
    const day = parseInt(btn.dataset.day, 10);
    switchViewMode(mode, day);
  });

  document.getElementById('snap-setting').addEventListener('change', (e) => {
    state.snapMinutes = parseInt(e.target.value, 10);
  });

  document.getElementById('sleep-calc-mode-select').addEventListener('change', (e) => {
    state.sleepCalcMode = e.target.value;
    renderStats();
  });

  document.getElementById('btn-export-file').addEventListener('click', exportDataToFile);
  document.getElementById('btn-import-file').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', importDataFromFile);

  document.getElementById('btn-sample-data').addEventListener('click', loadSampleData);
  document.getElementById('btn-clear-all').addEventListener('click', clearAllData);

  setupCopyModalEvents();
  setupModalEvents();
}

function onPointerDown(e) {
  const track = e.target.closest('.timeline-track');
  if (!track) return;

  const dayIndex = parseInt(track.dataset.dayIndex, 10);
  const trackRect = track.getBoundingClientRect();
  const clickX = e.clientX - trackRect.left;
  const clickRatio = Math.max(0, Math.min(1, clickX / trackRect.width));
  const clickedHour = clickRatio * 24;

  const blockEl = e.target.closest('.activity-block');
  const handleEl = e.target.closest('.block-handle');

  if (blockEl) {
    const blockId = blockEl.dataset.blockId;
    const block = state.blocks.find(b => b.id === blockId);
    if (!block) return;

    dragContext = {
      action: handleEl ? handleEl.dataset.action : 'move',
      blockId: block.id,
      dayIndex: block.dayIndex,
      initialStart: block.startHour,
      initialEnd: block.endHour,
      startX: e.clientX,
      trackWidth: trackRect.width,
      isMoved: false,
      blockEl: blockEl
    };

    blockEl.classList.add('dragging');
    updateDragTooltips(block);
    e.target.setPointerCapture(e.pointerId);
  } else {
    const snappedStart = snapHour(clickedHour);
    let duration = 1.5;
    let snappedEnd = snappedStart + duration;

    if (state.activeCategory === 'sleep' && snappedStart >= 21) {
      snappedEnd = snappedStart + (24 - snappedStart) + 6.0;
    }

    const newBlock = {
      id: 'b_' + Date.now(),
      dayIndex: dayIndex,
      category: state.activeCategory,
      startHour: snappedStart,
      endHour: snappedEnd,
      note: ''
    };

    state.blocks.push(newBlock);
    saveData();
    renderAll();

    const newBlockEl = document.querySelector(`.activity-block[data-block-id="${newBlock.id}"]`);
    if (newBlockEl) {
      dragContext = {
        action: 'move',
        blockId: newBlock.id,
        dayIndex: dayIndex,
        initialStart: newBlock.startHour,
        initialEnd: newBlock.endHour,
        startX: e.clientX,
        trackWidth: trackRect.width,
        isMoved: false,
        blockEl: newBlockEl
      };
      updateDragTooltips(newBlock);
    }
  }
}

function onPointerMove(e) {
  if (!dragContext) return;

  const deltaX = e.clientX - dragContext.startX;
  if (Math.abs(deltaX) > 4) {
    dragContext.isMoved = true;
  }

  const deltaHours = (deltaX / dragContext.trackWidth) * 24;
  const block = state.blocks.find(b => b.id === dragContext.blockId);
  if (!block) return;

  const duration = dragContext.initialEnd - dragContext.initialStart;

  if (dragContext.action === 'resize-left') {
    let newStart = snapHour(dragContext.initialStart + deltaHours);
    newStart = Math.max(0, Math.min(dragContext.initialEnd - 0.25, newStart));
    block.startHour = newStart;
  } else if (dragContext.action === 'resize-right') {
    let newEnd = snapHour(dragContext.initialEnd + deltaHours);
    newEnd = Math.max(dragContext.initialStart + 0.25, newEnd);
    block.endHour = newEnd;
  } else if (dragContext.action === 'move') {
    let newStart = snapHour(dragContext.initialStart + deltaHours);
    newStart = Math.max(0, newStart);
    block.startHour = newStart;
    block.endHour = newStart + duration;
  }

  renderAll();

  const activeBlockEl = document.querySelector(`.activity-block[data-block-id="${block.id}"]`);
  if (activeBlockEl) {
    dragContext.blockEl = activeBlockEl;
    updateDragTooltips(block);
  }
}

function onPointerUp(e) {
  if (!dragContext) return;

  removeDragTooltips();

  const blockEl = document.querySelector(`.activity-block[data-block-id="${dragContext.blockId}"]`);
  if (blockEl) {
    blockEl.classList.remove('dragging');
  }

  if (!dragContext.isMoved && dragContext.action === 'move') {
    openEditModal(dragContext.blockId);
  }

  dragContext = null;
  saveData();
}

/**
 * ★ ブロック【内部】リアルタイム浮遊ツールチップ表示 ★
 */
function updateDragTooltips(block) {
  if (!dragContext || !dragContext.blockEl) return;

  const blockEl = dragContext.blockEl;
  const action = dragContext.action;

  let tooltipEl = blockEl.querySelector('.drag-tooltip-internal');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'drag-tooltip-internal';
    blockEl.appendChild(tooltipEl);
  }

  const endStr = block.endHour > 24 ? `翌${formatHour(block.endHour - 24)}` : formatHour(block.endHour);

  if (action === 'resize-left') {
    tooltipEl.innerHTML = `<i class="fa-solid fa-clock"></i> 始点: ${formatHour(block.startHour)}`;
  } else if (action === 'resize-right') {
    tooltipEl.innerHTML = `<i class="fa-solid fa-clock"></i> 終点: ${endStr}`;
  } else {
    const durationStr = formatDurationHours(block.endHour - block.startHour);
    tooltipEl.innerHTML = `<i class="fa-solid fa-clock"></i> ${formatHour(block.startHour)} 〜 ${endStr} (${durationStr})`;
  }
}

function removeDragTooltips() {
  document.querySelectorAll('.drag-tooltip-internal').forEach(tt => tt.remove());
}

// --------------------------------------------------------------------------
// 補助計算関数
// --------------------------------------------------------------------------
function snapHour(hour) {
  const step = state.snapMinutes / 60;
  return Math.round(hour / step) * step;
}

function formatHour(h) {
  let normalizedH = h % 24;
  if (normalizedH < 0) normalizedH += 24;
  const totalMinutes = Math.round(normalizedH * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatDurationHours(h) {
  const totalMinutes = Math.round(h * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hours}時間`;
  return `${hours}時間${mins}分`;
}

function hoursToTimeString(h) {
  return formatHour(h);
}

function timeStringToHours(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m / 60);
}

// --------------------------------------------------------------------------
// 他の曜日からの予定コピー機能
// --------------------------------------------------------------------------
function setupCopyModalEvents() {
  const btnOpen = document.getElementById('btn-open-copy-modal');
  const modal = document.getElementById('copy-modal');
  const selectSource = document.getElementById('copy-modal-source-select');
  const targetLabel = document.getElementById('copy-modal-target-label');

  btnOpen.addEventListener('click', () => {
    const targetDay = DAYS[state.selectedDayIndex];
    targetLabel.textContent = `【${targetDay.name}】に他の曜日の予定をコピーします。`;

    selectSource.innerHTML = '';
    DAYS.forEach((d, idx) => {
      if (idx !== state.selectedDayIndex) {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = d.name;
        selectSource.appendChild(opt);
      }
    });

    modal.classList.add('open');
  });

  document.getElementById('copy-modal-close-btn').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('copy-modal-cancel-btn').addEventListener('click', () => modal.classList.remove('open'));

  document.getElementById('copy-modal-exec-btn').addEventListener('click', () => {
    const sourceDayIndex = parseInt(selectSource.value, 10);
    const targetDayIndex = state.selectedDayIndex;

    state.blocks = state.blocks.filter(b => b.dayIndex !== targetDayIndex);

    const sourceBlocks = state.blocks.filter(b => b.dayIndex === sourceDayIndex);
    sourceBlocks.forEach(sb => {
      state.blocks.push({
        id: 'b_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        dayIndex: targetDayIndex,
        category: sb.category,
        startHour: sb.startHour,
        endHour: sb.endHour,
        note: sb.note
      });
    });

    saveData();
    renderAll();
    modal.classList.remove('open');
    alert(`【${DAYS[sourceDayIndex].name}】の予定を【${DAYS[targetDayIndex].name}】にコピーしました！`);
  });
}

// --------------------------------------------------------------------------
// ファイル保存 & 読込機能
// --------------------------------------------------------------------------
function exportDataToFile() {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const filename = `rizumu_quest_${YYYY}${MM}${DD}_${hh}${mm}${ss}.json`;

  const exportObject = {
    appName: "りずむクエスト",
    version: "4.4",
    savedAt: now.toISOString(),
    blocks: state.blocks
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataFromFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (parsed && Array.isArray(parsed.blocks)) {
        state.blocks = parsed.blocks.filter(b => b.category !== 'school');
        saveData();
        renderAll();
        alert('データを 正常に読み込みました！');
      } else {
        alert('ファイルのデータ形式が 正しくありません。');
      }
    } catch(err) {
      alert('ファイルの読み込みに 失敗しました。');
    }
  };
  reader.readAsText(file);
}

// --------------------------------------------------------------------------
// モーダル編集機能
// --------------------------------------------------------------------------
function setupModalEvents() {
  const catSelect = document.getElementById('modal-category-select');

  catSelect.innerHTML = '';
  Object.values(CATEGORIES).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  document.getElementById('modal-close-btn').addEventListener('click', closeEditModal);
  document.getElementById('modal-cancel-btn').addEventListener('click', closeEditModal);

  document.getElementById('modal-save-btn').addEventListener('click', () => {
    if (!state.editingBlockId) return;
    const block = state.blocks.find(b => b.id === state.editingBlockId);
    if (block) {
      block.category = catSelect.value;
      block.startHour = timeStringToHours(document.getElementById('modal-start-time').value);
      let endH = timeStringToHours(document.getElementById('modal-end-time').value);

      if (endH <= block.startHour) {
        endH += 24;
      }
      block.endHour = endH;
      block.note = document.getElementById('modal-note').value;

      saveData();
      renderAll();
    }
    closeEditModal();
  });

  document.getElementById('modal-delete-btn').addEventListener('click', () => {
    if (!state.editingBlockId) return;
    state.blocks = state.blocks.filter(b => b.id !== state.editingBlockId);
    saveData();
    renderAll();
    closeEditModal();
  });
}

function openEditModal(blockId) {
  const block = state.blocks.find(b => b.id === blockId);
  if (!block) return;

  state.editingBlockId = blockId;
  document.getElementById('modal-category-select').value = block.category;
  document.getElementById('modal-start-time').value = hoursToTimeString(block.startHour);
  document.getElementById('modal-end-time').value = hoursToTimeString(block.endHour % 24);
  document.getElementById('modal-note').value = block.note || '';

  document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  state.editingBlockId = null;
}

// --------------------------------------------------------------------------
// データ永続化 & デフォルトサンプルデータ
// --------------------------------------------------------------------------
function saveData() {
  localStorage.setItem('rizumu_quest_blocks_v8', JSON.stringify(state.blocks));
}

function loadData() {
  const saved = localStorage.getItem('rizumu_quest_blocks_v8');
  if (saved) {
    try {
      state.blocks = JSON.parse(saved).filter(b => b.category !== 'school');
      if (Array.isArray(state.blocks) && state.blocks.length > 0) return;
    } catch(e) {}
  }
  loadSampleData();
}

function clearAllData() {
  if (confirm('すべての予定を 消してもいいですか？')) {
    state.blocks = [];
    saveData();
    renderAll();
  }
}

function loadSampleData() {
  const samples = [];

  DAYS.forEach((day, index) => {
    const isWeekend = (index === 0 || index === 6);

    // 毎日共通: すいみん (22:00〜6:00)
    samples.push({
      id: `s_sleep_${index}`,
      dayIndex: index,
      category: 'sleep',
      startHour: 22.0,
      endHour: 30.0,
      note: 'すいみん'
    });

    // 毎日共通: 朝ごはん (6:30〜7:30)
    samples.push({
      id: `s_bkm_${index}`,
      dayIndex: index,
      category: 'meal',
      startHour: 6.5,
      endHour: 7.5,
      note: '朝ごはん'
    });

    // 毎日共通: スクリーンタイム (19:00〜20:00)
    samples.push({
      id: `s_scrt_${index}`,
      dayIndex: index,
      category: 'play',
      startHour: 19.0,
      endHour: 20.0,
      note: 'スクリーンタイム'
    });

    if (!isWeekend) {
      // 平日
      samples.push({ id: `s_lun_${index}`, dayIndex: index, category: 'meal', startHour: 12.0, endHour: 13.0, note: '給食・昼ごはん' });
      samples.push({ id: `s_ex_${index}`, dayIndex: index, category: 'exercise', startHour: 16.0, endHour: 17.0, note: '部活・運動' });
      samples.push({ id: `s_std_${index}`, dayIndex: index, category: 'study', startHour: 17.0, endHour: 18.0, note: '宿題・勉強' });
      samples.push({ id: `s_din_${index}`, dayIndex: index, category: 'meal', startHour: 18.0, endHour: 19.0, note: '夜ごはん' });
    } else {
      // 土日 (土日の13:00〜16:00スクリーンタイムは削除)
      samples.push({ id: `s_ex_${index}`, dayIndex: index, category: 'exercise', startHour: 9.5, endHour: 11.0, note: 'スポーツ・運動' });
      samples.push({ id: `s_lun_${index}`, dayIndex: index, category: 'meal', startHour: 12.0, endHour: 13.0, note: '昼ごはん' });
      samples.push({ id: `s_din_${index}`, dayIndex: index, category: 'meal', startHour: 18.0, endHour: 19.0, note: '夜ごはん' });
    }
  });

  state.blocks = samples;
  saveData();
  renderAll();
}
