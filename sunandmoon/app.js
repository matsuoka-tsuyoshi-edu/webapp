/**
 * 小学6年理科「月と太陽」シミュレーション - アプリケーション本体 (app.js)
 */

(function () {
  'use strict';

  // --- アプリケーション状態 (State) ---
  const state = {
    currentDate: new Date(),       // 現在のシミュレーション日時
    isPlaying: false,             // アニメーション再生中フラグ
    playSpeedMinutesPerSec: 15,   // 再生速度 (1秒あたりの経過分数: デフォルト15分)
    lastTimestamp: 0,             // アニメーション用
    showPath: true,               // 通り道（軌跡線）表示フラグ
    showUnderground: false,       // 地面透過モード
    showSpaceView: false,         // 宇宙視点ミニビュー
    isPmMode: false,              // 午後表示優先フラグ
    use24Hour: false,             // 24時間表示フラグ (false: 午前/午後, true: 24時間)
    showAstroData: true,          // 右上データの詳細表示フラグ
    pinnedMoons: [],              // 空にピン留めした比較用の月リスト
    compareDateA: null,           // 比較モーダル左の日時
    compareDateB: null,           // 比較モーダル右の日時
    hideCompareInfo: false,       // 比較モーダルのデータ非表示フラグ
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1,
    calHour: 20,                  // カレンダー基準時刻
    calCompareMode: false,        // カレンダーから2日比較モード
    calPickedDates: [],           // カレンダーで選択された日付配列
    stars: []                     // 星の座標リスト
  };

  // --- DOM要素の参照キャッシュ ---
  const elements = {
    skyViewport: document.getElementById('sky-viewport'),
    starsCanvas: document.getElementById('stars-canvas'),
    pathCanvas: document.getElementById('path-canvas'),
    celestialLayer: document.getElementById('celestial-layer'),
    pinnedMoonsLayer: document.getElementById('pinned-moons-layer'),
    sunElement: document.getElementById('sun-element'),
    moonElement: document.getElementById('moon-element'),
    moonHint: document.getElementById('moon-hint'),
    
    // 日時表示
    dateDisplay: document.getElementById('date-display'),
    timeDigits: document.getElementById('time-digits'),
    ampmBadge: document.getElementById('ampm-badge'),
    btnTimeFormat: document.getElementById('btn-time-format'),
    btnPrevDay: document.getElementById('btn-prev-day'),
    btnNextDay: document.getElementById('btn-next-day'),
    btnEditDate: document.getElementById('btn-edit-date'),
    btnOpenCalendarTop: document.getElementById('btn-open-calendar-top'),
    datetimeDropdown: document.getElementById('datetime-picker-dropdown'),
    pickerColAmPm: document.getElementById('picker-col-ampm'),
    selectYear: document.getElementById('select-year'),
    selectMonth: document.getElementById('select-month'),
    selectDay: document.getElementById('select-day'),
    selectAmPm: document.getElementById('select-ampm'),
    selectHour: document.getElementById('select-hour'),
    selectMinute: document.getElementById('select-minute'),
    btnApplyDate: document.getElementById('btn-apply-date'),
    btnTodayDate: document.getElementById('btn-today-date'),

    // 右上天体ボード
    astroCard: document.getElementById('astro-card'),
    astroCardBody: document.getElementById('astro-card-body'),
    btnToggleAstroData: document.getElementById('btn-toggle-astro-data'),
    btnLocationPicker: document.getElementById('btn-location-picker'),
    locationNameText: document.getElementById('location-name-text'),
    locationPickerDropdown: document.getElementById('location-picker-dropdown'),
    selectLocationPreset: document.getElementById('select-location-preset'),
    inputLocName: document.getElementById('input-loc-name'),
    inputLocLat: document.getElementById('input-loc-lat'),
    inputLocLon: document.getElementById('input-loc-lon'),
    btnResetLocation: document.getElementById('btn-reset-location'),
    btnApplyLocation: document.getElementById('btn-apply-location'),
    sunRiseText: document.getElementById('sun-rise-text'),
    sunTransitText: document.getElementById('sun-transit-text'),
    sunSetText: document.getElementById('sun-set-text'),
    moonRiseText: document.getElementById('moon-rise-text'),
    moonTransitText: document.getElementById('moon-transit-text'),
    moonSetText: document.getElementById('moon-set-text'),
    moonAgeText: document.getElementById('moon-age-text'),
    moonShapeName: document.getElementById('moon-shape-name'),
    moonAltitudeStatus: document.getElementById('moon-altitude-status'),
    moonBadgeBtn: document.getElementById('moon-badge-btn'),
    moonDataRow: document.getElementById('moon-data-row'),
    
    // 下部コントロール
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnStepBack: document.getElementById('btn-step-back'),
    btnStepForward: document.getElementById('btn-step-forward'),
    timeSlider: document.getElementById('time-slider'),
    timelineTicks: document.getElementById('timeline-ticks'),
    selectSpeed: document.getElementById('select-speed'),
    btnTogglePath: document.getElementById('btn-toggle-path'),
    btnToggleUnderground: document.getElementById('btn-toggle-underground'),
    btnToggleSpaceView: document.getElementById('btn-toggle-space-view'),
    btnPinMoon: document.getElementById('btn-pin-moon'),
    btnClearPins: document.getElementById('btn-clear-pins'),
    btnOpenCompare: document.getElementById('btn-open-compare'),
    btnOpenCalendar: document.getElementById('btn-open-calendar'),

    // 月拡大モーダル
    moonModal: document.getElementById('moon-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalMoonSvg: document.getElementById('modal-moon-svg'),
    modalMoonRuby: document.getElementById('modal-moon-ruby'),
    modalMoonName: document.getElementById('modal-moon-name'),
    modalMoonAge: document.getElementById('modal-moon-age'),
    modalMoonPhase: document.getElementById('modal-moon-phase'),
    btnToggleExplanation: document.getElementById('btn-toggle-explanation'),
    modalExplanation: document.getElementById('modal-explanation'),

    // 2つの月をくらべるモーダル
    compareModal: document.getElementById('compare-modal'),
    btnCompareToggleInfo: document.getElementById('btn-compare-toggle-info'),
    btnCompareSyncTime: document.getElementById('btn-compare-sync-time'),
    btnCloseCompare: document.getElementById('btn-close-compare'),
    compAYear: document.getElementById('comp-a-year'),
    compAMonth: document.getElementById('comp-a-month'),
    compADay: document.getElementById('comp-a-day'),
    compAHour: document.getElementById('comp-a-hour'),
    compAMoonSvg: document.getElementById('comp-a-moon-svg'),
    compASkySvg: document.getElementById('comp-a-sky-svg'),
    compAInfo: document.getElementById('comp-a-info'),
    compBYear: document.getElementById('comp-b-year'),
    compBMonth: document.getElementById('comp-b-month'),
    compBDay: document.getElementById('comp-b-day'),
    compBHour: document.getElementById('comp-b-hour'),
    compBMoonSvg: document.getElementById('comp-b-moon-svg'),
    compBSkySvg: document.getElementById('comp-b-sky-svg'),
    compBInfo: document.getElementById('comp-b-info'),
    btnComparePinBoth: document.getElementById('btn-compare-pin-both'),

    // 月齢カレンダーモーダル
    calendarModal: document.getElementById('calendar-modal'),
    btnCalPrevMonth: document.getElementById('btn-cal-prev-month'),
    calSelectYear: document.getElementById('cal-select-year'),
    calSelectMonth: document.getElementById('cal-select-month'),
    btnCalNextMonth: document.getElementById('btn-cal-next-month'),
    calSelectHour: document.getElementById('cal-select-hour'),
    btnCalModeCompare: document.getElementById('btn-cal-mode-compare'),
    calSelectionStatus: document.getElementById('cal-selection-status'),
    btnCloseCalendar: document.getElementById('btn-close-calendar'),
    calendarGrid: document.getElementById('calendar-grid'),

    // 宇宙視点ミニビュー
    spaceViewPanel: document.getElementById('space-view-panel'),
    spaceCanvas: document.getElementById('space-canvas'),
    landscapeSvg: document.getElementById('landscape-svg')
  };

  // --- 星空の初期化 ---
  function initStars() {
    const numStars = 180;
    state.stars = [];
    for (let i = 0; i < numStars; i++) {
      state.stars.push({
        x: Math.random(),
        y: Math.random() * 0.75, // 地平線より上
        radius: Math.random() * 1.5 + 0.5,
        baseAlpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.05 + 0.02,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
  }

  // 実際の表示領域サイズ取得 (iPad SafariのURLバー・タブバー分を除外)
  function getViewportSize() {
    const width = window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth;
    const height = window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight;
    return { width, height };
  }

  // キャンバスのリサイズ対応
  function resizeCanvases() {
    const { width, height } = getViewportSize();

    document.documentElement.style.setProperty('--app-height', `${height}px`);

    elements.starsCanvas.width = width;
    elements.starsCanvas.height = height;

    elements.pathCanvas.width = width;
    elements.pathCanvas.height = height;

    updateSimulation(true);
  }

  // --- 天文計算結果と画面座標変換 ---
  // 水平視野角: 東(75°) 〜 南(180°) 〜 西(285°) (時角ベースのscreenAzを使用)
  const AZ_MIN = 75;
  const AZ_MAX = 285;
  const AZ_SPAN = AZ_MAX - AZ_MIN;

  function azAltToScreenCoords(screenAz, alt, width, height) {
    // 地平線のY位置（画面高さの75%位置：下部60pxのコントロールバーと地面を余裕をもって確保）
    const horizonY = height * 0.75;
    const zenithY = height * 0.14;
    const skyHeight = horizonY - zenithY;

    // X座標: 時角ベース (75°=東寄り 〜 180°=南 〜 285°=西寄り)
    const x = ((screenAz - AZ_MIN) / AZ_SPAN) * width;

    // Y座標: alt >= 0 はドーム補正高度でなめらかな円弧を描き、alt < 0 は地面の下に収める
    let y;
    if (alt >= 0) {
      const domeAlt = 0.35 * alt + 0.65 * 90.0 * Math.sin((alt * Math.PI) / 180.0);
      y = horizonY - (domeAlt / 90.0) * skyHeight;
    } else {
      const underDepth = Math.max(20, (height - 68) - horizonY);
      y = horizonY + (Math.abs(alt) / 90.0) * underDepth;
    }

    return { x, y, horizonY };
  }

  // --- 空のグラデーション & 背景演出 ---
  function updateSkyAndLighting(sunAlt) {
    let bgStyle = '';
    let starVisibility = 0;
    let windowLightFill = '#1e293b'; // 昼間のビルの窓
    let windowLightOpacity = 0.3;

    if (sunAlt > 12) {
      // 昼間（快晴の青空）
      bgStyle = 'linear-gradient(to bottom, #1d4ed8 0%, #3b82f6 45%, #93c5fd 82%, #bfdbfe 100%)';
      starVisibility = 0;
      windowLightFill = '#94a3b8';
      windowLightOpacity = 0.2;
    } else if (sunAlt > 0) {
      // 日の出直後 / 日の入り直前（朝焼け・夕焼けの空）
      const t = sunAlt / 12.0; // 0 (地平線) ~ 1 (12度)
      bgStyle = `linear-gradient(to bottom, 
        rgba(30, 58, 138, 1) 0%, 
        rgba(194, 65, 12, ${1 - t * 0.5}) 40%, 
        rgba(234, 88, 12, ${1 - t * 0.3}) 70%, 
        rgba(254, 215, 170, 1) 85%, 
        rgba(253, 230, 138, 1) 100%)`;
      starVisibility = (1 - t) * 0.25;
      windowLightFill = '#fbbf24';
      windowLightOpacity = (1 - t) * 0.7;
    } else if (sunAlt > -8) {
      // 夕暮れ・薄暮 (Twilight)
      const t = (sunAlt - (-8)) / 8.0; // 0 (-8度) ~ 1 (0度)
      bgStyle = `linear-gradient(to bottom, 
        #090d16 0%, 
        #1e1b4b 30%, 
        #7c2d12 65%, 
        #c2410c 80%, 
        #f97316 100%)`;
      starVisibility = 0.25 + (1 - t) * 0.45;
      windowLightFill = '#facc15';
      windowLightOpacity = 0.85;
    } else if (sunAlt > -18) {
      // 天文薄明〜深い夜空
      const t = (sunAlt - (-18)) / 10.0; // 0 (-18度) ~ 1 (-8度)
      bgStyle = `linear-gradient(to bottom, 
        #020617 0%, 
        #0b1120 40%, 
        #172554 75%, 
        #1e1b4b 100%)`;
      starVisibility = 0.7 + (1 - t) * 0.3;
      windowLightFill = '#fde047';
      windowLightOpacity = 1.0;
    } else {
      // 完全な夜空（漆黒・満天の星）
      bgStyle = 'linear-gradient(to bottom, #020617 0%, #070d1e 50%, #0f172a 82%, #1e1b4b 100%)';
      starVisibility = 1.0;
      windowLightFill = '#fef08a';
      windowLightOpacity = 1.0;
    }

    elements.skyViewport.style.background = bgStyle;

    // ビルの窓の光を更新
    const windows = document.querySelectorAll('.window-light');
    windows.forEach(w => {
      w.style.fill = windowLightFill;
      w.style.opacity = windowLightOpacity;
    });

    // 星空の描画
    drawStars(starVisibility);
  }

  // --- 星々の描画 (Canvas) ---
  function drawStars(visibility) {
    const ctx = elements.starsCanvas.getContext('2d');
    const width = elements.starsCanvas.width;
    const height = elements.starsCanvas.height;

    ctx.clearRect(0, 0, width, height);

    if (visibility <= 0.02) return;

    const time = performance.now() * 0.002;

    for (let star of state.stars) {
      const x = star.x * width;
      const y = star.y * height;
      const twinkle = Math.sin(time + star.twinklePhase) * 0.25 + 0.75;
      const alpha = star.baseAlpha * visibility * twinkle;

      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
      ctx.shadowBlur = star.radius > 1.2 ? 4 : 0;
      ctx.shadowColor = '#ffffff';
      ctx.fill();
    }
  }

  // --- 月のSVG満ち欠け形状の生成関数 (クレーター・グラデーションなしのくっきりベタ塗り) ---
  // elongation: 0~360度 (0:新月, 90:上弦, 180:満月, 270:下弦)
  // angleToSun: 画面上で太陽が存在する方向（ラジアン）
  function renderMoonSVG(elongation, angleToSun, isModal = false, customRadius = null) {
    const radius = customRadius !== null ? customRadius : (isModal ? 88 : 32);
    const size = radius * 2 + 8;
    const cx = size / 2;
    const cy = size / 2;

    // 離角を 0~360 に正規化
    let elong = elongation % 360;
    if (elong < 0) elong += 360;

    // 月の明暗境界線 (terminator) の短軸比率 (-1.0 ~ 1.0)
    // elong 0:新月, 90:上弦, 180:満月, 270:下弦
    const cosE = Math.cos(elong * Math.PI / 180.0);
    // 右半分が光る期間: 0 < elong < 180 (上弦側)
    // 左半分が光る期間: 180 < elong < 360 (下弦側)
    const isWaxing = elong <= 180;

    // 楕円の短軸半径 rx
    const rx = Math.abs(cosE) * radius;
    const lightFill = '#fde047';
    let lightPath = '';

    if (elong < 1.0 || elong > 359.0) {
      // 新月: 光らない
      lightPath = '';
    } else if (Math.abs(elong - 180) < 1.5) {
      // 満月: 全面ベタ塗り
      lightPath = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${lightFill}" />`;
    } else if (isWaxing) {
      // 満ちていく月 (新月〜上弦〜満月): 右半分側が光る
      if (cosE > 0) {
        lightPath = `
          <path d="M ${cx} ${cy - radius}
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}
                   A ${rx} ${radius} 0 0 0 ${cx} ${cy - radius} Z"
                fill="${lightFill}" />
        `;
      } else {
        lightPath = `
          <path d="M ${cx} ${cy - radius}
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius}
                   A ${rx} ${radius} 0 0 1 ${cx} ${cy - radius} Z"
                fill="${lightFill}" />
        `;
      }
    } else {
      // 欠けていく月 (満月〜下弦〜新月): 左半分側が光る
      if (cosE < 0) {
        lightPath = `
          <path d="M ${cx} ${cy + radius}
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}
                   A ${rx} ${radius} 0 0 1 ${cx} ${cy + radius} Z"
                fill="${lightFill}" />
        `;
      } else {
        lightPath = `
          <path d="M ${cx} ${cy + radius}
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius}
                   A ${rx} ${radius} 0 0 0 ${cx} ${cy + radius} Z"
                fill="${lightFill}" />
        `;
      }
    }

    // 太陽のある方向への傾き（回転）
    let rotateDeg = 0;
    if (!isModal && angleToSun !== null) {
      const sunAngleDeg = angleToSun * 180.0 / Math.PI;
      rotateDeg = isWaxing ? sunAngleDeg : sunAngleDeg - 180.0;
      while (rotateDeg > 180) rotateDeg -= 360;
      while (rotateDeg < -180) rotateDeg += 360;
      rotateDeg = Math.max(-55, Math.min(55, rotateDeg));
    }

    return `
      <svg viewBox="0 0 ${size} ${size}" class="moon-svg" style="transform: rotate(${rotateDeg}deg);">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
        ${lightPath}
      </svg>
    `;
  }

  // --- 太陽と月の軌跡（点線パス）の描画 ---
  function drawCelestialPaths(year, month, day, width, height) {
    const ctx = elements.pathCanvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    if (!state.showPath) return;

    const dailyPath = AstroCalc.getDailyPath(year, month, day, undefined, undefined, state.currentDate);

    // 太陽の通り道（オレンジ色の点線）
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.65)';

    let started = false;
    let prevScreenAz = null;
    for (let pt of dailyPath.sun) {
      const coord = azAltToScreenCoords(pt.screenAz, pt.alt, width, height);
      if (!state.showUnderground && pt.alt < -2) {
        started = false;
        prevScreenAz = null;
        continue;
      }
      if (prevScreenAz !== null && Math.abs(pt.screenAz - prevScreenAz) > 180) {
        started = false;
      }
      if (!started) {
        ctx.moveTo(coord.x, coord.y);
        started = true;
      } else {
        ctx.lineTo(coord.x, coord.y);
      }
      prevScreenAz = pt.screenAz;
    }
    ctx.stroke();

    // 月の通り道（黄色の点線）
    ctx.beginPath();
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';

    started = false;
    prevScreenAz = null;
    for (let pt of dailyPath.moon) {
      const coord = azAltToScreenCoords(pt.screenAz, pt.alt, width, height);
      if (!state.showUnderground && pt.alt < -2) {
        started = false;
        prevScreenAz = null;
        continue;
      }
      if (prevScreenAz !== null && Math.abs(pt.screenAz - prevScreenAz) > 180) {
        started = false;
      }
      if (!started) {
        ctx.moveTo(coord.x, coord.y);
        started = true;
      } else {
        ctx.lineTo(coord.x, coord.y);
      }
      prevScreenAz = pt.screenAz;
    }
    ctx.stroke();
    ctx.setLineDash([]); // リセット
  }

  // --- 宇宙視点ミニビューの描画 (Canvas) ---
  function drawSpaceView(elongation) {
    if (!state.showSpaceView) return;

    const canvas = elements.spaceCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const earthR = Math.round(w * 0.10);
    const moonOrbitR = Math.round(w * 0.34);
    const moonR = Math.round(w * 0.055);

    ctx.clearRect(0, 0, w, h);

    // 太陽光の矢印（右側から左へ差し込む太陽光）
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#f59e0b';

    const arrowStep = Math.max(24, Math.round(h * 0.18));
    for (let y = Math.round(h * 0.18); y <= h - Math.round(h * 0.16); y += arrowStep) {
      ctx.beginPath();
      ctx.moveTo(w - 4, y);
      ctx.lineTo(w - 22, y);
      ctx.stroke();
      // 矢印の鏃
      ctx.beginPath();
      ctx.moveTo(w - 22, y);
      ctx.lineTo(w - 17, y - 3.5);
      ctx.lineTo(w - 17, y + 3.5);
      ctx.closePath();
      ctx.fill();
    }

    // 「太陽光」ラベル
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('たいようの光 ◀◀', w - 4, 14);

    // 月の公転軌道（点線の円）
    ctx.beginPath();
    ctx.arc(cx, cy, moonOrbitR, 0, Math.PI * 2);
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // 地球（中央）
    // 右半分が昼（明るい青）、左半分が夜（暗い群青）
    ctx.beginPath();
    ctx.arc(cx, cy, earthR, -Math.PI / 2, Math.PI / 2, false); // 右半分
    ctx.fillStyle = '#3b82f6';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, earthR, Math.PI / 2, -Math.PI / 2, false); // 左半分
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ちきゅう', cx, cy + 3);

    // 月の位置（公転軌道上）
    // 離角 elongation (0°=太陽側・右端, 90°=上弦・真上, 180°=満月・左端, 270°=下弦・真下)
    // 反時計回りに公転
    const moonAngle = (elongation * Math.PI) / 180.0;
    const mx = cx + moonOrbitR * Math.cos(-moonAngle); // 反時計回り
    const my = cy + moonOrbitR * Math.sin(-moonAngle);

    // 月の光っている側（太陽光は常に右から来るので、右半分が光る）
    ctx.beginPath();
    ctx.arc(mx, my, moonR, -Math.PI / 2, Math.PI / 2, false); // 右半分
    ctx.fillStyle = '#fef08a';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(mx, my, moonR, Math.PI / 2, -Math.PI / 2, false); // 左半分
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(mx, my, moonR, 0, Math.PI * 2);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 月ラベル
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.fillText('つき', mx, my - moonR - 3);
  }

  // --- 時刻表記フォーマット (12時間: 午前/午後 ⇄ 24時間表示) ---
  function formatEventTime(hhmmStr) {
    if (!hhmmStr || !hhmmStr.includes(':')) return '--:--';
    const [hStr, mStr] = hhmmStr.split(':');
    const h24 = parseInt(hStr, 10);
    if (isNaN(h24)) return '--:--';
    if (state.use24Hour) {
      return `${String(h24).padStart(2, '0')}:${mStr}`;
    }
    const prefix = h24 >= 12 ? '午後' : '午前';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${prefix}${h12}:${mStr}`;
  }

  function updateAstroEventsUI(events) {
    if (!events) return;
    elements.sunRiseText.textContent = formatEventTime(events.sun.rise);
    elements.sunTransitText.textContent = formatEventTime(events.sun.transit);
    elements.sunSetText.textContent = formatEventTime(events.sun.set);

    elements.moonRiseText.textContent = formatEventTime(events.moon.rise);
    elements.moonTransitText.textContent = formatEventTime(events.moon.transit);
    elements.moonSetText.textContent = formatEventTime(events.moon.set);
  }

  // --- メイン画面の空に月をピン留め比較描画 ---
  function addPinnedMoon(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return;
    const jd = AstroCalc.getJulianDay(dateObj);
    const moonPos = AstroCalc.getMoonPosition(jd);
    const sunPos = AstroCalc.getSunPosition(jd);
    const phaseInfo = AstroCalc.getMoonPhaseInfo(moonPos.age, moonPos.elongation);

    // 同じ年月日・時分は重複登録しない
    const key = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}-${dateObj.getHours()}-${dateObj.getMinutes()}`;
    if (state.pinnedMoons.some(p => p.key === key)) return;

    if (state.pinnedMoons.length >= 6) {
      state.pinnedMoons.shift();
    }

    state.pinnedMoons.push({
      key,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      day: dateObj.getDate(),
      hour: dateObj.getHours(),
      minute: dateObj.getMinutes(),
      screenAz: moonPos.screenAz,
      alt: moonPos.alt,
      elongation: moonPos.elongation,
      sunScreenAz: sunPos.screenAz,
      sunAlt: sunPos.alt,
      phaseName: phaseInfo.name,
      ageFormatted: phaseInfo.ageFormatted
    });

    const { width, height } = getViewportSize();
    renderPinnedMoons(width, height);
  }

  function renderPinnedMoons(width, height) {
    if (!elements.pinnedMoonsLayer) return;
    elements.pinnedMoonsLayer.innerHTML = '';

    if (elements.btnClearPins) {
      elements.btnClearPins.style.display = state.pinnedMoons.length > 0 ? 'flex' : 'none';
    }

    state.pinnedMoons.forEach((pin, idx) => {
      const coords = azAltToScreenCoords(pin.screenAz, pin.alt, width, height);
      const sunCoords = azAltToScreenCoords(pin.sunScreenAz, pin.sunAlt, width, height);
      const angleToSun = Math.atan2(sunCoords.y - coords.y, sunCoords.x - coords.x);

      const item = document.createElement('div');
      item.className = 'pinned-moon-item';
      item.style.left = `${coords.x}px`;
      item.style.top = `${coords.y}px`;

      if (pin.alt < 0) {
        if (state.showUnderground) {
          item.style.opacity = '0.45';
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      }

      const hText = state.use24Hour
        ? `${pin.hour}時`
        : `${pin.hour >= 12 ? '午後' : '午前'}${pin.hour % 12 === 0 ? 12 : pin.hour % 12}時`;

      item.innerHTML = `
        ${renderMoonSVG(pin.elongation, angleToSun, false, 26)}
        <div class="pinned-moon-tag">
          <span>#${idx + 1} ${pin.month}/${pin.day} ${hText} (${pin.phaseName})</span>
          <button type="button" class="btn-remove-pin" title="この月を消す">×</button>
        </div>
      `;

      const removeBtn = item.querySelector('.btn-remove-pin');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.pinnedMoons.splice(idx, 1);
        const size = getViewportSize();
        renderPinnedMoons(size.width, size.height);
      });

      elements.pinnedMoonsLayer.appendChild(item);
    });
  }

  // --- メインシミュレーション更新 ---
  let lastCheckedDateStr = '';
  let lastMoonHourAngle = null;
  let lastDailyEvents = null;

  function updateSimulation(forceRedrawPaths = false) {
    const { width, height } = getViewportSize();
    const dt = state.currentDate;

    if (!dt || isNaN(dt.getTime())) {
      state.currentDate = new Date();
      return updateSimulation(true);
    }

    // JSTの日付文字列
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const hours = dt.getHours();
    const minutes = dt.getMinutes();

    const dateStr = `${year}-${month}-${day}`;

    // 1. 日時UIの更新
    updateDateTimeUI(dt);

    // 2. ユリウス日の計算と現在の太陽・月の位置計算
    const jd = AstroCalc.getJulianDay(dt);
    const sunPos = AstroCalc.getSunPosition(jd);
    const moonPos = AstroCalc.getMoonPosition(jd);

    const crossedMoonCycle = lastMoonHourAngle !== null && Math.abs(moonPos.hourAngle - lastMoonHourAngle) > 180;
    lastMoonHourAngle = moonPos.hourAngle;

    // 3. 日が替わった場合・強制再描画・月の周期境界を跨いだ場合にイベントと軌跡を更新
    if (dateStr !== lastCheckedDateStr || forceRedrawPaths || crossedMoonCycle) {
      if (dateStr !== lastCheckedDateStr || !lastDailyEvents) {
        lastCheckedDateStr = dateStr;
        lastDailyEvents = AstroCalc.getDailyEvents(year, month, day);
      }
      updateAstroEventsUI(lastDailyEvents);
      drawCelestialPaths(year, month, day, width, height);
    } else if (lastDailyEvents) {
      updateAstroEventsUI(lastDailyEvents);
    }

    // 月の月齢と形状名
    const moonPhaseInfo = AstroCalc.getMoonPhaseInfo(moonPos.age, moonPos.elongation);
    elements.moonAgeText.textContent = `月齢 ${moonPhaseInfo.ageFormatted}`;
    elements.moonShapeName.textContent = moonPhaseInfo.name;

    // 月の地上/地平線下ステータス
    if (elements.moonAltitudeStatus) {
      if (moonPos.alt < 0) {
        elements.moonAltitudeStatus.textContent = '地面の下';
        elements.moonAltitudeStatus.className = 'moon-status-tag underground';
      } else {
        elements.moonAltitudeStatus.textContent = '地上';
        elements.moonAltitudeStatus.className = 'moon-status-tag';
      }
    }

    // 4. 背景の空と街の明かりの更新
    updateSkyAndLighting(sunPos.alt);

    // 5. 太陽と月の画面座標（時角ベースの滑らかな円弧）
    const sunCoords = azAltToScreenCoords(sunPos.screenAz, sunPos.alt, width, height);
    const moonCoords = azAltToScreenCoords(moonPos.screenAz, moonPos.alt, width, height);

    // 太陽の配置
    elements.sunElement.style.left = `${sunCoords.x}px`;
    elements.sunElement.style.top = `${sunCoords.y}px`;

    // 地平線下の場合の表示制御
    if (sunPos.alt < 0) {
      if (state.showUnderground) {
        elements.sunElement.style.opacity = '0.35';
        elements.sunElement.style.display = 'block';
      } else {
        elements.sunElement.style.opacity = '0';
        elements.sunElement.style.display = 'none';
      }
    } else {
      elements.sunElement.style.opacity = '1';
      elements.sunElement.style.display = 'block';
    }

    // 太陽の方向ベクトル（月が光る向きを計算）
    const dx = sunCoords.x - moonCoords.x;
    const dy = sunCoords.y - moonCoords.y;
    const angleToSun = Math.atan2(dy, dx);

    // 月のSVG更新 & 配置 (moon-hint と moon-label を保持)
    let moonSvgWrap = elements.moonElement.querySelector('.moon-svg-wrap');
    if (!moonSvgWrap) {
      elements.moonElement.insertAdjacentHTML('afterbegin', '<div class="moon-svg-wrap" style="width:100%;height:100%;"></div>');
      moonSvgWrap = elements.moonElement.querySelector('.moon-svg-wrap');
    }
    moonSvgWrap.innerHTML = renderMoonSVG(moonPos.elongation, angleToSun, false);
    elements.moonElement.style.left = `${moonCoords.x}px`;
    elements.moonElement.style.top = `${moonCoords.y}px`;

    if (moonPos.alt < 0) {
      if (state.showUnderground) {
        elements.moonElement.style.opacity = '0.45';
        elements.moonElement.style.display = 'block';
      } else {
        elements.moonElement.style.opacity = '0';
        elements.moonElement.style.display = 'none';
      }
    } else {
      elements.moonElement.style.opacity = '1';
      elements.moonElement.style.display = 'block';
    }

    // 6. タイムスライダーの値を同期 (0 ~ 1440 分)
    const currentMinutes = hours * 60 + minutes;
    elements.timeSlider.value = currentMinutes;

    // 7. 宇宙視点ミニビュー & ピン留め月の更新
    drawSpaceView(moonPos.elongation);
    renderPinnedMoons(width, height);
  }

  // --- 指定年月の日数に応じた日セレクト更新 ---
  function updateDayOptions(year, month, keepDay) {
    const maxDays = new Date(year, month, 0).getDate();
    const prevVal = keepDay !== undefined ? keepDay : (parseInt(elements.selectDay.value, 10) || 1);
    const clampedDay = Math.min(Math.max(1, prevVal), maxDays);

    elements.selectDay.innerHTML = '';
    for (let d = 1; d <= maxDays; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `${d}日`;
      elements.selectDay.appendChild(opt);
    }
    elements.selectDay.value = String(clampedDay);
  }

  // --- 時ドロップダウンを 12時間制 / 24時間制 に応じて構築 ---
  function updateHourSelectOptions() {
    elements.selectHour.innerHTML = '';
    if (state.use24Hour) {
      if (elements.pickerColAmPm) elements.pickerColAmPm.style.display = 'none';
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = `${h}時`;
        elements.selectHour.appendChild(opt);
      }
    } else {
      if (elements.pickerColAmPm) elements.pickerColAmPm.style.display = 'flex';
      for (let h = 0; h < 12; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h === 0 ? '12時' : `${h}時`;
        elements.selectHour.appendChild(opt);
      }
    }
  }

  // --- ドロップダウンピッカーの値を現在日時に同期 ---
  function syncDropdownValues(dt) {
    if (!dt || isNaN(dt.getTime())) return;
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const h24 = dt.getHours();
    const minutes = dt.getMinutes();

    if (!Array.from(elements.selectYear.options).some(o => Number(o.value) === year)) {
      const opt = document.createElement('option');
      opt.value = year;
      opt.textContent = `${year}年`;
      elements.selectYear.appendChild(opt);
    }

    elements.selectYear.value = String(year);
    elements.selectMonth.value = String(month);
    updateDayOptions(year, month, day);
    if (state.use24Hour) {
      elements.selectHour.value = String(h24);
    } else {
      elements.selectAmPm.value = h24 >= 12 ? 'pm' : 'am';
      elements.selectHour.value = String(h24 % 12);
    }
    elements.selectMinute.value = String(minutes);
  }

  // --- 日時表示UIの更新 ---
  function updateDateTimeUI(dt) {
    if (!dt || isNaN(dt.getTime())) return;
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[dt.getDay()];

    elements.dateDisplay.textContent = `${year}年 ${month}月 ${day}日 (${dayOfWeek})`;

    const h24 = dt.getHours();
    const minutes = dt.getMinutes();
    const mStr = String(minutes).padStart(2, '0');
    const isPm = h24 >= 12;
    state.isPmMode = isPm;

    if (state.use24Hour) {
      elements.ampmBadge.style.display = 'none';
      elements.timeDigits.textContent = `${String(h24).padStart(2, '0')} : ${mStr}`;
      if (elements.btnTimeFormat) {
        elements.btnTimeFormat.textContent = '午前/午後';
        elements.btnTimeFormat.classList.add('active-24h');
      }
      if (elements.timelineTicks) {
        elements.timelineTicks.innerHTML = '<span>0時</span><span>6時</span><span>12時</span><span>18時</span><span>24時</span>';
      }
    } else {
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      elements.ampmBadge.style.display = '';
      elements.ampmBadge.textContent = isPm ? '午後' : '午前';
      elements.ampmBadge.className = `ampm-badge ${isPm ? 'pm' : 'am'}`;
      elements.timeDigits.textContent = `${h12} : ${mStr}`;
      if (elements.btnTimeFormat) {
        elements.btnTimeFormat.textContent = '24h表示';
        elements.btnTimeFormat.classList.remove('active-24h');
      }
      if (elements.timelineTicks) {
        elements.timelineTicks.innerHTML = '<span>午前0時</span><span>午前6時</span><span>正午</span><span>午後6時</span><span>午後12時</span>';
      }
    }

    // ドロップダウンピッカーの値も同期（開いている時は更新しない）
    if (!elements.datetimeDropdown.classList.contains('active')) {
      syncDropdownValues(dt);
    }
  }

  // --- ドロップダウンピッカーの選択肢を初期化 ---
  function initDropdownSelectors() {
    // 年 (2024~2030)
    elements.selectYear.innerHTML = '';
    for (let y = 2024; y <= 2030; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y}年`;
      elements.selectYear.appendChild(opt);
    }

    // 月 (1~12)
    elements.selectMonth.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `${m}月`;
      elements.selectMonth.appendChild(opt);
    }

    // 日 (初期年月に合わせて生成)
    const initDt = state.currentDate;
    updateDayOptions(initDt.getFullYear(), initDt.getMonth() + 1, initDt.getDate());

    // 時 (12h/24h設定に応じて構築)
    updateHourSelectOptions();

    // 分 (0~59 を 1分刻みで用意し、未一致による空値・NaNを防ぐ)
    elements.selectMinute.innerHTML = '';
    for (let m = 0; m < 60; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `${String(m).padStart(2, '0')}分`;
      elements.selectMinute.appendChild(opt);
    }

    syncDropdownValues(state.currentDate);
  }

  // --- アニメーションループ (再生) ---
  function animationLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const deltaMs = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;

    if (state.isPlaying) {
      // 1秒あたり state.playSpeedMinutesPerSec 分進める
      const minutesToAdd = (deltaMs / 1000.0) * state.playSpeedMinutesPerSec;
      state.currentDate = new Date(state.currentDate.getTime() + minutesToAdd * 60 * 1000);
      updateSimulation();
    }

    requestAnimationFrame(animationLoop);
  }

  // ==========================================================================
  // 2つの月をくらべるモーダル (#compare-modal)
  // ==========================================================================
  function getCompareEls(side) {
    return side === 'a'
      ? {
          year: elements.compAYear,
          month: elements.compAMonth,
          day: elements.compADay,
          hour: elements.compAHour,
          moonSvg: elements.compAMoonSvg,
          skySvg: elements.compASkySvg,
          info: elements.compAInfo
        }
      : {
          year: elements.compBYear,
          month: elements.compBMonth,
          day: elements.compBDay,
          hour: elements.compBHour,
          moonSvg: elements.compBMoonSvg,
          skySvg: elements.compBSkySvg,
          info: elements.compBInfo
        };
  }

  function updateCompareDayOptions(side, year, month, keepDay) {
    const els = getCompareEls(side);
    const maxDays = new Date(year, month, 0).getDate();
    const prev = keepDay !== undefined ? keepDay : (parseInt(els.day.value, 10) || 1);
    const clamped = Math.min(Math.max(1, prev), maxDays);
    els.day.innerHTML = '';
    for (let d = 1; d <= maxDays; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `${d}日`;
      els.day.appendChild(opt);
    }
    els.day.value = String(clamped);
  }

  function initCompareSelectors() {
    ['a', 'b'].forEach(side => {
      const els = getCompareEls(side);
      els.year.innerHTML = '';
      for (let y = 2024; y <= 2030; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}年`;
        els.year.appendChild(opt);
      }
      els.month.innerHTML = '';
      for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m}月`;
        els.month.appendChild(opt);
      }
      els.hour.innerHTML = '';
      for (let h = 0; h < 24; h++) {
        const opt = document.createElement('option');
        opt.value = h;
        const ampm = h >= 12 ? '午後' : '午前';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        opt.textContent = `${h}時 (${ampm}${h12}時)`;
        els.hour.appendChild(opt);
      }
    });
  }

  function setCompareDate(side, dt) {
    const els = getCompareEls(side);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const h = dt.getHours();
    if (!Array.from(els.year.options).some(o => Number(o.value) === y)) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y}年`;
      els.year.appendChild(opt);
    }
    els.year.value = String(y);
    els.month.value = String(m);
    updateCompareDayOptions(side, y, m, d);
    els.hour.value = String(h);
    if (side === 'a') state.compareDateA = new Date(y, m - 1, d, h, 0, 0);
    else state.compareDateB = new Date(y, m - 1, d, h, 0, 0);
  }

  function readCompareDate(side) {
    const els = getCompareEls(side);
    const y = parseInt(els.year.value, 10);
    const m = parseInt(els.month.value, 10);
    const maxD = new Date(y, m, 0).getDate();
    const d = Math.min(Math.max(1, parseInt(els.day.value, 10) || 1), maxD);
    const h = parseInt(els.hour.value, 10) || 0;
    const dt = new Date(y, m - 1, d, h, 0, 0);
    if (side === 'a') state.compareDateA = dt;
    else state.compareDateB = dt;
    return dt;
  }

  function renderMiniSkySVG(sunPos, moonPos) {
    const W = 240;
    const H = 92;
    const horizonY = 74;
    const skyTopY = 14;
    const mapX = (sAz) => Math.max(12, Math.min(W - 12, ((sAz - AZ_MIN) / AZ_SPAN) * W));
    const mapY = (alt) => {
      if (alt >= 0) {
        const dome = 0.35 * alt + 0.65 * 90.0 * Math.sin((alt * Math.PI) / 180.0);
        return horizonY - (dome / 90.0) * (horizonY - skyTopY);
      }
      return Math.min(H - 6, horizonY + (Math.abs(alt) / 90.0) * 16);
    };

    const mx = mapX(moonPos.screenAz);
    const my = mapY(moonPos.alt);
    const sx = mapX(sunPos.screenAz);
    const sy = mapY(sunPos.alt);

    const sunMark = sunPos.alt >= -2
      ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="6" fill="#fb923c" />`
      : '';

    const moonBelow = moonPos.alt < 0;
    const moonMark = moonBelow
      ? `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="7" fill="none" stroke="#fde047" stroke-width="1.5" stroke-dasharray="2,2" />
         <text x="${mx.toFixed(1)}" y="${horizonY - 6}" fill="#94a3b8" font-size="9" font-weight="bold" text-anchor="middle">地面の下</text>`
      : `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" fill="#fde047" stroke="#0f172a" stroke-width="1" />`;

    return `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%">
        <path d="M 12 ${horizonY} Q ${W / 2} ${skyTopY} ${W - 12} ${horizonY}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-dasharray="4,4" />
        <line x1="0" y1="${horizonY}" x2="${W}" y2="${horizonY}" stroke="#4ade80" stroke-width="2" />
        <rect x="0" y="${horizonY}" width="${W}" height="${H - horizonY}" fill="rgba(20, 83, 45, 0.5)" />
        ${sunMark}
        ${moonMark}
      </svg>
    `;
  }

  function updateCompareCard(side) {
    const els = getCompareEls(side);
    const dt = readCompareDate(side);
    const jd = AstroCalc.getJulianDay(dt);
    const sunPos = AstroCalc.getSunPosition(jd);
    const moonPos = AstroCalc.getMoonPosition(jd);
    const phaseInfo = AstroCalc.getMoonPhaseInfo(moonPos.age, moonPos.elongation);
    const events = AstroCalc.getDailyEvents(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());

    els.moonSvg.innerHTML = renderMoonSVG(moonPos.elongation, null, true, 50);
    els.skySvg.innerHTML = renderMiniSkySVG(sunPos, moonPos);

    const statusBadge = moonPos.alt >= 0 ? '地上に見えています' : '地面の下にあります';
    els.info.innerHTML = `
      <div class="compare-info-title">${phaseInfo.name}（月齢 ${phaseInfo.ageFormatted} / 光る割合 ${Math.round(moonPos.phaseFraction * 100)}%）</div>
      <div class="compare-info-sub">月の状態: ${statusBadge}</div>
      <div class="compare-info-sub">月の出 ${formatEventTime(events.moon.rise)} ／ 一番高いとき ${formatEventTime(events.moon.transit)} ／ 月の入り ${formatEventTime(events.moon.set)}</div>
    `;
  }

  function openCompareModal(dateA, dateB) {
    const baseA = dateA ? new Date(dateA) : new Date(state.currentDate);
    const baseB = dateB ? new Date(dateB) : new Date(baseA.getTime() + 4 * 24 * 60 * 60 * 1000);
    setCompareDate('a', baseA);
    setCompareDate('b', baseB);
    updateCompareCard('a');
    updateCompareCard('b');
    elements.compareModal.classList.add('active');
  }

  function closeCompareModal() {
    elements.compareModal.classList.remove('active');
  }

  // ==========================================================================
  // 月齢カレンダーモーダル (#calendar-modal)
  // ==========================================================================
  function initCalendarSelectors() {
    elements.calSelectYear.innerHTML = '';
    for (let y = 2024; y <= 2030; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y}年`;
      elements.calSelectYear.appendChild(opt);
    }
    elements.calSelectMonth.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `${m}月`;
      elements.calSelectMonth.appendChild(opt);
    }
  }

  function updateCalendarModeUI() {
    elements.btnCalModeCompare.classList.toggle('active', state.calCompareMode);
    if (!state.calCompareMode) {
      elements.calSelectionStatus.textContent = '日付をタップするとその空へ移動';
    } else if (state.calPickedDates.length === 0) {
      elements.calSelectionStatus.textContent = '1つ目の日付をタップしてください';
    } else {
      const d1 = state.calPickedDates[0];
      elements.calSelectionStatus.textContent = `1つ目: ${d1.getMonth() + 1}/${d1.getDate()} → 2つ目をタップ`;
    }
  }

  function getCalendarPhaseShortBadge(shapeType, age) {
    if (shapeType === 'new') return '新月';
    if (shapeType === 'first-quarter') return '上弦';
    if (shapeType === 'full') return '満月';
    if (shapeType === 'last-quarter') return '下弦';
    if (shapeType === 'waxing-crescent' && age >= 2.0 && age <= 4.2) return '三日月';
    return '';
  }

  function renderCalendarGrid() {
    const year = state.calYear;
    const month = state.calMonth;
    const hour = state.calHour;

    elements.calSelectYear.value = String(year);
    elements.calSelectMonth.value = String(month);
    elements.calSelectHour.value = String(hour);
    elements.calendarGrid.innerHTML = '';

    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day-empty';
      elements.calendarGrid.appendChild(empty);
    }

    const curY = state.currentDate.getFullYear();
    const curM = state.currentDate.getMonth() + 1;
    const curD = state.currentDate.getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month - 1, d, hour, 0, 0);
      const dow = cellDate.getDay();
      const jd = AstroCalc.getJulianDay(cellDate);
      const moonPos = AstroCalc.getMoonPosition(jd);
      const phaseInfo = AstroCalc.getMoonPhaseInfo(moonPos.age, moonPos.elongation);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-day-cell';

      if (year === curY && month === curM && d === curD) {
        cell.classList.add('is-current-sim');
      }
      const isPicked = state.calPickedDates.some(
        p => p.getFullYear() === year && p.getMonth() + 1 === month && p.getDate() === d
      );
      if (isPicked) {
        cell.classList.add('is-picked');
      }

      const dayNumClass = dow === 0 ? 'sun' : (dow === 6 ? 'sat' : '');
      const badgeText = getCalendarPhaseShortBadge(phaseInfo.shapeType, moonPos.age);

      cell.innerHTML = `
        <div class="cal-day-top">
          <span class="cal-day-num ${dayNumClass}">${d}</span>
          <span class="cal-age-mini">齢${phaseInfo.ageFormatted}</span>
        </div>
        <div class="cal-moon-icon">${renderMoonSVG(moonPos.elongation, null, true, 16)}</div>
        ${badgeText ? `<span class="cal-phase-badge">${badgeText}</span>` : ''}
      `;

      cell.addEventListener('click', () => {
        if (!state.calCompareMode) {
          state.currentDate = new Date(year, month - 1, d, hour, 0, 0);
          closeCalendarModal();
          updateSimulation(true);
          return;
        }

        const existIdx = state.calPickedDates.findIndex(
          p => p.getFullYear() === year && p.getMonth() + 1 === month && p.getDate() === d
        );
        if (existIdx >= 0) {
          state.calPickedDates.splice(existIdx, 1);
          updateCalendarModeUI();
          renderCalendarGrid();
          return;
        }

        state.calPickedDates.push(new Date(year, month - 1, d, hour, 0, 0));
        if (state.calPickedDates.length >= 2) {
          const [d1, d2] = state.calPickedDates;
          state.calPickedDates = [];
          closeCalendarModal();
          openCompareModal(d1, d2);
        } else {
          updateCalendarModeUI();
          renderCalendarGrid();
        }
      });

      elements.calendarGrid.appendChild(cell);
    }

    updateCalendarModeUI();
  }

  function openCalendarModal() {
    state.calYear = state.currentDate.getFullYear();
    state.calMonth = state.currentDate.getMonth() + 1;
    state.calPickedDates = [];
    renderCalendarGrid();
    elements.calendarModal.classList.add('active');
  }

  function closeCalendarModal() {
    elements.calendarModal.classList.remove('active');
  }

  // ==========================================================================
  // 観測地点（大分県全市町村・九州県庁所在地・日本主要都市・手入力）
  // ==========================================================================
  const LOCATION_PRESETS = [
    {
      group: '大分県の市町村（全18市町村）',
      items: [
        { id: 'oita-saiki', name: '大分県佐伯市', lat: 32.96, lon: 131.90 },
        { id: 'oita-oita', name: '大分県大分市', lat: 33.24, lon: 131.61 },
        { id: 'oita-beppu', name: '大分県別府市', lat: 33.28, lon: 131.49 },
        { id: 'oita-nakatsu', name: '大分県中津市', lat: 33.60, lon: 131.19 },
        { id: 'oita-hita', name: '大分県日田市', lat: 33.32, lon: 130.94 },
        { id: 'oita-usuki', name: '大分県臼杵市', lat: 33.13, lon: 131.80 },
        { id: 'oita-tsukumi', name: '大分県津久見市', lat: 33.07, lon: 131.86 },
        { id: 'oita-taketa', name: '大分県竹田市', lat: 32.97, lon: 131.40 },
        { id: 'oita-bungotakada', name: '大分県豊後高田市', lat: 33.56, lon: 131.44 },
        { id: 'oita-kitsuki', name: '大分県杵築市', lat: 33.42, lon: 131.62 },
        { id: 'oita-usa', name: '大分県宇佐市', lat: 33.53, lon: 131.35 },
        { id: 'oita-bungoono', name: '大分県豊後大野市', lat: 32.98, lon: 131.59 },
        { id: 'oita-yufu', name: '大分県由布市', lat: 33.18, lon: 131.43 },
        { id: 'oita-kunisaki', name: '大分県国東市', lat: 33.56, lon: 131.73 },
        { id: 'oita-himeshima', name: '大分県姫島村', lat: 33.73, lon: 131.67 },
        { id: 'oita-hiji', name: '大分県日出町', lat: 33.37, lon: 131.53 },
        { id: 'oita-kokonoe', name: '大分県九重町', lat: 33.22, lon: 131.19 },
        { id: 'oita-kusu', name: '大分県玖珠町', lat: 33.28, lon: 131.15 }
      ]
    },
    {
      group: '九州・沖縄の県庁所在地',
      items: [
        { id: 'kyushu-fukuoka', name: '福岡県福岡市', lat: 33.59, lon: 130.40 },
        { id: 'kyushu-saga', name: '佐賀県佐賀市', lat: 33.26, lon: 130.30 },
        { id: 'kyushu-nagasaki', name: '長崎県長崎市', lat: 32.75, lon: 129.88 },
        { id: 'kyushu-kumamoto', name: '熊本県熊本市', lat: 32.80, lon: 130.71 },
        { id: 'kyushu-oita', name: '大分県大分市', lat: 33.24, lon: 131.61 },
        { id: 'kyushu-miyazaki', name: '宮崎県宮崎市', lat: 31.91, lon: 131.42 },
        { id: 'kyushu-kagoshima', name: '鹿児島県鹿児島市', lat: 31.60, lon: 130.56 },
        { id: 'kyushu-naha', name: '沖縄県那覇市', lat: 26.21, lon: 127.68 }
      ]
    },
    {
      group: '日本の主要都市',
      items: [
        { id: 'jp-sapporo', name: '北海道札幌市', lat: 43.06, lon: 141.35 },
        { id: 'jp-nemuro', name: '北海道根室市', lat: 43.33, lon: 145.58 },
        { id: 'jp-aomori', name: '青森県青森市', lat: 40.82, lon: 140.74 },
        { id: 'jp-sendai', name: '宮城県仙台市', lat: 38.27, lon: 140.87 },
        { id: 'jp-niigata', name: '新潟県新潟市', lat: 37.92, lon: 139.04 },
        { id: 'jp-tokyo', name: '東京都', lat: 35.69, lon: 139.69 },
        { id: 'jp-yokohama', name: '神奈川県横浜市', lat: 35.44, lon: 139.64 },
        { id: 'jp-nagano', name: '長野県長野市', lat: 36.65, lon: 138.18 },
        { id: 'jp-kanazawa', name: '石川県金沢市', lat: 36.56, lon: 136.66 },
        { id: 'jp-shizuoka', name: '静岡県静岡市', lat: 34.98, lon: 138.38 },
        { id: 'jp-nagoya', name: '愛知県名古屋市', lat: 35.18, lon: 136.91 },
        { id: 'jp-kyoto', name: '京都府京都市', lat: 35.01, lon: 135.77 },
        { id: 'jp-osaka', name: '大阪府大阪市', lat: 34.69, lon: 135.50 },
        { id: 'jp-kobe', name: '兵庫県神戸市', lat: 34.69, lon: 135.20 },
        { id: 'jp-matsue', name: '島根県松江市', lat: 35.47, lon: 133.05 },
        { id: 'jp-okayama', name: '岡山県岡山市', lat: 34.66, lon: 133.93 },
        { id: 'jp-hiroshima', name: '広島県広島市', lat: 34.40, lon: 132.46 },
        { id: 'jp-yamaguchi', name: '山口県山口市', lat: 34.18, lon: 131.47 },
        { id: 'jp-takamatsu', name: '香川県高松市', lat: 34.34, lon: 134.05 },
        { id: 'jp-matsuyama', name: '愛媛県松山市', lat: 33.84, lon: 132.77 },
        { id: 'jp-kochi', name: '高知県高知市', lat: 33.56, lon: 133.53 },
        { id: 'jp-ishigaki', name: '沖縄県石垣市', lat: 24.34, lon: 124.16 }
      ]
    }
  ];

  function findLocationPresetById(id) {
    for (const grp of LOCATION_PRESETS) {
      const found = grp.items.find(item => item.id === id);
      if (found) return found;
    }
    return null;
  }

  function initLocationSelector() {
    if (!elements.selectLocationPreset) return;
    elements.selectLocationPreset.innerHTML = '';

    LOCATION_PRESETS.forEach(grp => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = grp.group;
      grp.items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = `${item.name} (${item.lat.toFixed(2)}°, ${item.lon.toFixed(2)}°)`;
        optgroup.appendChild(opt);
      });
      elements.selectLocationPreset.appendChild(optgroup);
    });

    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = '✏️ 緯度・経度を手入力（カスタム）';
    elements.selectLocationPreset.appendChild(customOpt);

    elements.selectLocationPreset.value = 'oita-saiki';
  }

  function syncLocationInputsFromObserver() {
    const obs = AstroCalc.getObserver();
    if (elements.locationNameText) elements.locationNameText.textContent = obs.name;
    if (elements.inputLocName) elements.inputLocName.value = obs.name;
    if (elements.inputLocLat) elements.inputLocLat.value = Number(obs.lat).toFixed(2);
    if (elements.inputLocLon) elements.inputLocLon.value = Number(obs.lon).toFixed(2);

    let matchedId = 'custom';
    for (const grp of LOCATION_PRESETS) {
      const found = grp.items.find(
        item => item.name === obs.name && Math.abs(item.lat - obs.lat) < 0.01 && Math.abs(item.lon - obs.lon) < 0.01
      );
      if (found) {
        matchedId = found.id;
        break;
      }
    }
    if (elements.selectLocationPreset) {
      elements.selectLocationPreset.value = matchedId;
    }
  }

  function applyObserverLocation(rawName, rawLat, rawLon) {
    const currentObs = AstroCalc.getObserver();
    const parsedLat = parseFloat(rawLat);
    const parsedLon = parseFloat(rawLon);
    const lat = !isNaN(parsedLat) ? Math.min(89.5, Math.max(-89.5, parsedLat)) : currentObs.lat;
    const lon = !isNaN(parsedLon) ? Math.min(180.0, Math.max(-180.0, parsedLon)) : currentObs.lon;
    const trimmedName = (rawName || '').trim();
    const name = trimmedName || `北緯${lat.toFixed(2)}° 東経${lon.toFixed(2)}°`;

    AstroCalc.setObserver(lat, lon, name);
    syncLocationInputsFromObserver();

    // ピン留めされた月の位置も新しい観測地で再計算
    state.pinnedMoons.forEach(pin => {
      const pinDate = new Date(pin.year, pin.month - 1, pin.day, pin.hour, pin.minute, 0);
      const jd = AstroCalc.getJulianDay(pinDate);
      const moonPos = AstroCalc.getMoonPosition(jd);
      const sunPos = AstroCalc.getSunPosition(jd);
      pin.screenAz = moonPos.screenAz;
      pin.alt = moonPos.alt;
      pin.sunScreenAz = sunPos.screenAz;
      pin.sunAlt = sunPos.alt;
    });

    lastCheckedDateStr = '';
    lastDailyEvents = null;
    updateSimulation(true);
  }

  // --- 月の拡大モーダルを開く ---
  function openMoonModal() {
    const jd = AstroCalc.getJulianDay(state.currentDate);
    const moonPos = AstroCalc.getMoonPosition(jd);
    const sunPos = AstroCalc.getSunPosition(jd);
    const moonPhaseInfo = AstroCalc.getMoonPhaseInfo(moonPos.age, moonPos.elongation);

    elements.modalMoonSvg.innerHTML = renderMoonSVG(moonPos.elongation, null, true);
    elements.modalMoonRuby.textContent = moonPhaseInfo.ruby;
    elements.modalMoonName.textContent = moonPhaseInfo.name;
    elements.modalMoonAge.textContent = `月齢 ${moonPhaseInfo.ageFormatted}`;
    elements.modalMoonPhase.textContent = `光る割合: ${Math.round(moonPos.phaseFraction * 100)}%`;

    // 児童向けの一言解説文
    let sunRelation = "";
    if (moonPos.elongation >= 70 && moonPos.elongation <= 110) {
      sunRelation = "★太陽は西（右）のほうにあるので、右半分に光が当たって明るく見えます！夕方の南の空で観察しやすいよ。";
    } else if (moonPos.elongation >= 170 && moonPos.elongation <= 190) {
      sunRelation = "★太陽とちょうど反対側にあるので、全体に光が当たって丸く見えます！太陽が沈むころに東から昇ってくるよ。";
    } else if (moonPos.elongation >= 250 && moonPos.elongation <= 290) {
      sunRelation = "★太陽は東（左）のほうにあるので、左半分に光が当たっています！真夜中に東から昇って、明け方に南の空に見えるよ。";
    } else if (moonPos.elongation < 45 || moonPos.elongation > 315) {
      sunRelation = "★太陽の近くにあるため、太陽の光が強くて見えにくいか、細い形で見えます。";
    } else {
      sunRelation = "★太陽と月の位置関係によって、地球から見える光の当たっている部分が変わるよ！";
    }

    elements.modalExplanation.innerHTML = `
      <p style="margin-bottom: 8px;"><strong>【形の特徴】</strong> ${moonPhaseInfo.desc}</p>
      <p style="color: #fde047;">${sunRelation}</p>
    `;

    // 子どもたちが自分で考え発表する場を作るため、解説は初期状態で非表示
    if (elements.modalExplanation) {
      elements.modalExplanation.style.display = 'none';
    }
    if (elements.btnToggleExplanation) {
      elements.btnToggleExplanation.classList.remove('opened');
      elements.btnToggleExplanation.innerHTML = '<span>💡 ヒント・解説をみる ▾</span>';
    }

    elements.moonModal.classList.add('active');
  }

  function closeMoonModal() {
    elements.moonModal.classList.remove('active');
  }

  // --- イベントリスナーの登録 ---
  function registerEventListeners() {
    // 再生 / 一時停止
    elements.btnPlayPause.addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      if (state.isPlaying) {
        elements.iconPlay.style.display = 'none';
        elements.iconPause.style.display = 'block';
        elements.btnPlayPause.style.background = '#dc2626'; // 赤色
      } else {
        elements.iconPlay.style.display = 'block';
        elements.iconPause.style.display = 'none';
        elements.btnPlayPause.style.background = '#2563eb'; // 青色
      }
    });

    // コマ戻し / コマ送り (1時間)
    elements.btnStepBack.addEventListener('click', () => {
      state.isPlaying = false;
      elements.iconPlay.style.display = 'block';
      elements.iconPause.style.display = 'none';
      elements.btnPlayPause.style.background = '#2563eb';
      state.currentDate = new Date(state.currentDate.getTime() - 60 * 60 * 1000);
      updateSimulation();
    });

    elements.btnStepForward.addEventListener('click', () => {
      state.isPlaying = false;
      elements.iconPlay.style.display = 'block';
      elements.iconPause.style.display = 'none';
      elements.btnPlayPause.style.background = '#2563eb';
      state.currentDate = new Date(state.currentDate.getTime() + 60 * 60 * 1000);
      updateSimulation();
    });

    // タイムスライダー操作 (0 ~ 1440分)
    elements.timeSlider.addEventListener('input', (e) => {
      const minutesTotal = parseInt(e.target.value, 10);
      const h = Math.floor(minutesTotal / 60);
      const m = minutesTotal % 60;
      
      const newDate = new Date(state.currentDate);
      newDate.setHours(h);
      newDate.setMinutes(m);
      state.currentDate = newDate;

      updateSimulation();
    });

    // 再生速度セレクト
    elements.selectSpeed.addEventListener('change', (e) => {
      state.playSpeedMinutesPerSec = parseFloat(e.target.value);
    });

    // クイック時間ジャンプボタン
    const quickTimeBtns = document.querySelectorAll('.btn-quick-time');
    quickTimeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetHour = parseInt(btn.dataset.hour, 10);
        const newDate = new Date(state.currentDate);
        newDate.setHours(targetHour);
        newDate.setMinutes(0);
        state.currentDate = newDate;
        updateSimulation();
      });
    });

    // 前の日・次の日ボタン
    elements.btnPrevDay.addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() - 24 * 60 * 60 * 1000);
      updateSimulation(true);
    });

    elements.btnNextDay.addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() + 24 * 60 * 60 * 1000);
      updateSimulation(true);
    });

    // 午前/午後バッジタップで12時間反転
    elements.ampmBadge.addEventListener('click', () => {
      const h = state.currentDate.getHours();
      const newH = (h + 12) % 24;
      const newDate = new Date(state.currentDate);
      newDate.setHours(newH);
      state.currentDate = newDate;
      updateSimulation();
    });

    // 12時間(午前/午後) ⇄ 24時間 表示切り替え
    if (elements.btnTimeFormat) {
      elements.btnTimeFormat.addEventListener('click', () => {
        state.use24Hour = !state.use24Hour;
        updateHourSelectOptions();
        syncDropdownValues(state.currentDate);
        updateSimulation(true);
      });
    }

    // 太陽と月のデータ詳細表示 隠す/表示する
    if (elements.btnToggleAstroData && elements.astroCard) {
      elements.btnToggleAstroData.addEventListener('click', () => {
        state.showAstroData = !state.showAstroData;
        elements.astroCard.classList.toggle('collapsed', !state.showAstroData);
        elements.btnToggleAstroData.textContent = state.showAstroData ? '▲ かくす' : '▼ データを表示';
      });
    }

    // 日時変更ドロップダウン開閉
    elements.btnEditDate.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !elements.datetimeDropdown.classList.contains('active');
      if (willOpen) {
        updateHourSelectOptions();
        syncDropdownValues(state.currentDate);
      }
      elements.datetimeDropdown.classList.toggle('active', willOpen);
    });

    // 年・月変更時に「日」の上限（28〜31日）を自動調整
    const handleYearOrMonthChange = () => {
      const y = parseInt(elements.selectYear.value, 10) || state.currentDate.getFullYear();
      const m = parseInt(elements.selectMonth.value, 10) || (state.currentDate.getMonth() + 1);
      updateDayOptions(y, m);
    };
    elements.selectYear.addEventListener('change', handleYearOrMonthChange);
    elements.selectMonth.addEventListener('change', handleYearOrMonthChange);

    // 適用ボタン
    elements.btnApplyDate.addEventListener('click', () => {
      const fallback = (!isNaN(state.currentDate.getTime())) ? state.currentDate : new Date();
      const parsedY = parseInt(elements.selectYear.value, 10);
      const parsedM = parseInt(elements.selectMonth.value, 10);
      const parsedD = parseInt(elements.selectDay.value, 10);
      const parsedH = parseInt(elements.selectHour.value, 10);
      const parsedMn = parseInt(elements.selectMinute.value, 10);

      const y = !isNaN(parsedY) ? parsedY : fallback.getFullYear();
      const m1 = !isNaN(parsedM) ? Math.min(Math.max(1, parsedM), 12) : (fallback.getMonth() + 1);
      const maxDays = new Date(y, m1, 0).getDate();
      const d = !isNaN(parsedD) ? Math.min(Math.max(1, parsedD), maxDays) : Math.min(fallback.getDate(), maxDays);

      let h24;
      if (state.use24Hour) {
        h24 = !isNaN(parsedH) ? Math.min(Math.max(0, parsedH), 23) : fallback.getHours();
      } else {
        const ampm = elements.selectAmPm.value === 'pm' ? 'pm' : 'am';
        const h12mod = !isNaN(parsedH) ? (parsedH % 12) : (fallback.getHours() % 12);
        h24 = (ampm === 'pm' ? 12 : 0) + h12mod;
      }
      const mn = !isNaN(parsedMn) ? Math.min(Math.max(0, parsedMn), 59) : fallback.getMinutes();

      const nextDate = new Date(y, m1 - 1, d, h24, mn, 0);
      if (!isNaN(nextDate.getTime())) {
        state.currentDate = nextDate;
      }
      elements.datetimeDropdown.classList.remove('active');
      updateSimulation(true);
    });

    // 今日ボタン
    elements.btnTodayDate.addEventListener('click', () => {
      state.currentDate = new Date();
      elements.datetimeDropdown.classList.remove('active');
      updateSimulation(true);
    });

    // ドロップダウン外クリックで閉じる
    document.addEventListener('click', (e) => {
      if (!elements.datetimeDropdown.contains(e.target) && e.target !== elements.btnEditDate) {
        elements.datetimeDropdown.classList.remove('active');
      }
      if (elements.locationPickerDropdown && elements.btnLocationPicker &&
          !elements.locationPickerDropdown.contains(e.target) &&
          !elements.btnLocationPicker.contains(e.target)) {
        elements.locationPickerDropdown.classList.remove('active');
      }
    });

    // 観測地点（地域・緯度経度）変更ドロップダウン操作
    if (elements.btnLocationPicker && elements.locationPickerDropdown) {
      elements.btnLocationPicker.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !elements.locationPickerDropdown.classList.contains('active');
        if (willOpen) {
          syncLocationInputsFromObserver();
        }
        elements.locationPickerDropdown.classList.toggle('active', willOpen);
      });
    }
    if (elements.selectLocationPreset) {
      elements.selectLocationPreset.addEventListener('change', () => {
        const preset = findLocationPresetById(elements.selectLocationPreset.value);
        if (preset) {
          elements.inputLocName.value = preset.name;
          elements.inputLocLat.value = preset.lat.toFixed(2);
          elements.inputLocLon.value = preset.lon.toFixed(2);
        }
      });
    }
    const markCustomLocation = () => {
      if (elements.selectLocationPreset) {
        elements.selectLocationPreset.value = 'custom';
      }
    };
    if (elements.inputLocLat) elements.inputLocLat.addEventListener('input', markCustomLocation);
    if (elements.inputLocLon) elements.inputLocLon.addEventListener('input', markCustomLocation);
    if (elements.btnApplyLocation) {
      elements.btnApplyLocation.addEventListener('click', () => {
        applyObserverLocation(elements.inputLocName.value, elements.inputLocLat.value, elements.inputLocLon.value);
        elements.locationPickerDropdown.classList.remove('active');
      });
    }
    if (elements.btnResetLocation) {
      elements.btnResetLocation.addEventListener('click', () => {
        applyObserverLocation('大分県佐伯市', 32.96, 131.90);
        elements.locationPickerDropdown.classList.remove('active');
      });
    }

    // 表示トグル: 通り道
    elements.btnTogglePath.addEventListener('click', () => {
      state.showPath = !state.showPath;
      elements.btnTogglePath.classList.toggle('active', state.showPath);
      const { width, height } = getViewportSize();
      drawCelestialPaths(
        state.currentDate.getFullYear(),
        state.currentDate.getMonth() + 1,
        state.currentDate.getDate(),
        width,
        height
      );
    });

    // 表示トグル: 地面とうか
    elements.btnToggleUnderground.addEventListener('click', () => {
      state.showUnderground = !state.showUnderground;
      elements.btnToggleUnderground.classList.toggle('active', state.showUnderground);
      updateSimulation(true);
    });

    // 表示トグル: 宇宙から見る
    elements.btnToggleSpaceView.addEventListener('click', () => {
      state.showSpaceView = !state.showSpaceView;
      elements.btnToggleSpaceView.classList.toggle('active', state.showSpaceView);
      elements.spaceViewPanel.classList.toggle('active', state.showSpaceView);
      if (state.showSpaceView) {
        const jd = AstroCalc.getJulianDay(state.currentDate);
        const moonPos = AstroCalc.getMoonPosition(jd);
        drawSpaceView(moonPos.elongation);
      }
    });

    // 空に月をピン留めして比較
    if (elements.btnPinMoon) {
      elements.btnPinMoon.addEventListener('click', () => {
        addPinnedMoon(state.currentDate);
      });
    }
    if (elements.btnClearPins) {
      elements.btnClearPins.addEventListener('click', () => {
        state.pinnedMoons = [];
        const { width, height } = getViewportSize();
        renderPinnedMoons(width, height);
      });
    }

    // 2つの月をくらべるモーダル操作
    if (elements.btnOpenCompare) {
      elements.btnOpenCompare.addEventListener('click', () => openCompareModal());
    }
    if (elements.btnCloseCompare) {
      elements.btnCloseCompare.addEventListener('click', closeCompareModal);
    }
    if (elements.compareModal) {
      elements.compareModal.addEventListener('click', (e) => {
        if (e.target === elements.compareModal) closeCompareModal();
      });
    }
    if (elements.btnCompareToggleInfo) {
      elements.btnCompareToggleInfo.addEventListener('click', () => {
        state.hideCompareInfo = !state.hideCompareInfo;
        const card = elements.compareModal.querySelector('.compare-modal-card');
        if (card) card.classList.toggle('hide-compare-info', state.hideCompareInfo);
        elements.btnCompareToggleInfo.classList.toggle('active', state.hideCompareInfo);
        elements.btnCompareToggleInfo.textContent = state.hideCompareInfo ? '💡 名前・データを表示' : '💡 名前・データをかくす';
      });
    }
    if (elements.btnCompareSyncTime) {
      elements.btnCompareSyncTime.addEventListener('click', () => {
        elements.compBHour.value = elements.compAHour.value;
        updateCompareCard('b');
      });
    }
    ['a', 'b'].forEach(side => {
      const els = getCompareEls(side);
      els.year.addEventListener('change', () => {
        updateCompareDayOptions(side, parseInt(els.year.value, 10), parseInt(els.month.value, 10));
        updateCompareCard(side);
      });
      els.month.addEventListener('change', () => {
        updateCompareDayOptions(side, parseInt(els.year.value, 10), parseInt(els.month.value, 10));
        updateCompareCard(side);
      });
      els.day.addEventListener('change', () => updateCompareCard(side));
      els.hour.addEventListener('change', () => updateCompareCard(side));
    });
    document.querySelectorAll('.btn-comp-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.target;
        const days = parseInt(btn.dataset.days, 10);
        const dt = readCompareDate(side);
        dt.setDate(dt.getDate() + days);
        setCompareDate(side, dt);
        updateCompareCard(side);
      });
    });
    document.querySelectorAll('.btn-comp-now').forEach(btn => {
      btn.addEventListener('click', () => {
        const side = btn.dataset.target;
        setCompareDate(side, new Date(state.currentDate));
        updateCompareCard(side);
      });
    });
    if (elements.btnComparePinBoth) {
      elements.btnComparePinBoth.addEventListener('click', () => {
        const dA = readCompareDate('a');
        const dB = readCompareDate('b');
        state.pinnedMoons = [];
        addPinnedMoon(dA);
        state.currentDate = new Date(dB);
        closeCompareModal();
        updateSimulation(true);
      });
    }

    // 月齢カレンダーモーダル操作
    if (elements.btnOpenCalendar) {
      elements.btnOpenCalendar.addEventListener('click', openCalendarModal);
    }
    if (elements.btnOpenCalendarTop) {
      elements.btnOpenCalendarTop.addEventListener('click', openCalendarModal);
    }
    if (elements.btnCloseCalendar) {
      elements.btnCloseCalendar.addEventListener('click', closeCalendarModal);
    }
    if (elements.calendarModal) {
      elements.calendarModal.addEventListener('click', (e) => {
        if (e.target === elements.calendarModal) closeCalendarModal();
      });
    }
    if (elements.btnCalPrevMonth) {
      elements.btnCalPrevMonth.addEventListener('click', () => {
        state.calMonth -= 1;
        if (state.calMonth < 1) { state.calMonth = 12; state.calYear -= 1; }
        renderCalendarGrid();
      });
    }
    if (elements.btnCalNextMonth) {
      elements.btnCalNextMonth.addEventListener('click', () => {
        state.calMonth += 1;
        if (state.calMonth > 12) { state.calMonth = 1; state.calYear += 1; }
        renderCalendarGrid();
      });
    }
    if (elements.calSelectYear) {
      elements.calSelectYear.addEventListener('change', () => {
        state.calYear = parseInt(elements.calSelectYear.value, 10);
        renderCalendarGrid();
      });
    }
    if (elements.calSelectMonth) {
      elements.calSelectMonth.addEventListener('change', () => {
        state.calMonth = parseInt(elements.calSelectMonth.value, 10);
        renderCalendarGrid();
      });
    }
    if (elements.calSelectHour) {
      elements.calSelectHour.addEventListener('change', () => {
        state.calHour = parseInt(elements.calSelectHour.value, 10);
        renderCalendarGrid();
      });
    }
    if (elements.btnCalModeCompare) {
      elements.btnCalModeCompare.addEventListener('click', () => {
        state.calCompareMode = !state.calCompareMode;
        state.calPickedDates = [];
        updateCalendarModeUI();
        renderCalendarGrid();
      });
    }

    // 月タップで拡大モーダル（空の月、または右上カードの月・月齢バッジ）
    elements.moonElement.addEventListener('click', (e) => {
      e.stopPropagation();
      openMoonModal();
      if (elements.moonHint) {
        elements.moonHint.style.display = 'none'; // 一度タップしたらヒント消去
      }
    });

    if (elements.moonBadgeBtn) {
      elements.moonBadgeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMoonModal();
      });
    }

    if (elements.moonDataRow) {
      elements.moonDataRow.addEventListener('click', (e) => {
        e.stopPropagation();
        openMoonModal();
      });
    }

    // ヒント・解説トグル（児童が考えて発表した後に開く）
    if (elements.btnToggleExplanation) {
      elements.btnToggleExplanation.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = elements.modalExplanation.style.display === 'none';
        if (isHidden) {
          elements.modalExplanation.style.display = 'block';
          elements.btnToggleExplanation.classList.add('opened');
          elements.btnToggleExplanation.innerHTML = '<span>▲ ヒント・解説をとじる</span>';
        } else {
          elements.modalExplanation.style.display = 'none';
          elements.btnToggleExplanation.classList.remove('opened');
          elements.btnToggleExplanation.innerHTML = '<span>💡 ヒント・解説をみる ▾</span>';
        }
      });
    }

    // モーダル閉じる
    elements.btnCloseModal.addEventListener('click', closeMoonModal);
    elements.moonModal.addEventListener('click', (e) => {
      if (e.target === elements.moonModal) {
        closeMoonModal();
      }
    });

    // ウィンドウリサイズ・Safariバー変化（visualViewport）対応
    window.addEventListener('resize', resizeCanvases);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeCanvases);
    }

    // キーボードショートカット (電子黒板やキーボード付きiPad向け、入力中は無効)
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        elements.btnPlayPause.click();
      } else if (e.code === 'ArrowRight') {
        elements.btnStepForward.click();
      } else if (e.code === 'ArrowLeft') {
        elements.btnStepBack.click();
      }
    });
  }

  // --- 初期化 ---
  function init() {
    initStars();
    initDropdownSelectors();
    initLocationSelector();
    syncLocationInputsFromObserver();
    initCompareSelectors();
    initCalendarSelectors();
    registerEventListeners();
    resizeCanvases();
    requestAnimationFrame(animationLoop);
  }

  // DOM構築完了時に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
