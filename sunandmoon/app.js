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
    stars: []                     // 星の座標リスト
  };

  // --- DOM要素の参照キャッシュ ---
  const elements = {
    skyViewport: document.getElementById('sky-viewport'),
    starsCanvas: document.getElementById('stars-canvas'),
    pathCanvas: document.getElementById('path-canvas'),
    celestialLayer: document.getElementById('celestial-layer'),
    sunElement: document.getElementById('sun-element'),
    moonElement: document.getElementById('moon-element'),
    moonHint: document.getElementById('moon-hint'),
    
    // 日時表示
    dateDisplay: document.getElementById('date-display'),
    timeDigits: document.getElementById('time-digits'),
    ampmBadge: document.getElementById('ampm-badge'),
    btnPrevDay: document.getElementById('btn-prev-day'),
    btnNextDay: document.getElementById('btn-next-day'),
    btnEditDate: document.getElementById('btn-edit-date'),
    datetimeDropdown: document.getElementById('datetime-picker-dropdown'),
    selectYear: document.getElementById('select-year'),
    selectMonth: document.getElementById('select-month'),
    selectDay: document.getElementById('select-day'),
    selectAmPm: document.getElementById('select-ampm'),
    selectHour: document.getElementById('select-hour'),
    selectMinute: document.getElementById('select-minute'),
    btnApplyDate: document.getElementById('btn-apply-date'),
    btnTodayDate: document.getElementById('btn-today-date'),

    // 右上天体ボード
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
    selectSpeed: document.getElementById('select-speed'),
    btnTogglePath: document.getElementById('btn-toggle-path'),
    btnToggleUnderground: document.getElementById('btn-toggle-underground'),
    btnToggleSpaceView: document.getElementById('btn-toggle-space-view'),

    // モーダル
    moonModal: document.getElementById('moon-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalMoonSvg: document.getElementById('modal-moon-svg'),
    modalMoonRuby: document.getElementById('modal-moon-ruby'),
    modalMoonName: document.getElementById('modal-moon-name'),
    modalMoonAge: document.getElementById('modal-moon-age'),
    modalMoonPhase: document.getElementById('modal-moon-phase'),
    btnToggleExplanation: document.getElementById('btn-toggle-explanation'),
    modalExplanation: document.getElementById('modal-explanation'),

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

  // --- 月のSVG満ち欠け形状の生成関数 ---
  // elongation: 0~360度 (0:新月, 90:上弦, 180:満月, 270:下弦)
  // angleToSun: 画面上で太陽が存在する方向（ラジアン）
  function renderMoonSVG(elongation, angleToSun, isModal = false) {
    const radius = isModal ? 100 : 32;
    const size = radius * 2 + 10;
    const cx = size / 2;
    const cy = size / 2;

    // 離角を 0~360 に正規化
    let elong = elongation % 360;
    if (elong < 0) elong += 360;

    // 月の明暗境界線 (terminator) の短軸比率 (-1.0 ~ 1.0)
    // elong 0:新月(k=-1), elong 90:上弦(k=0), elong 180:満月(k=1), elong 270:下弦(k=0)
    const cosE = Math.cos(elong * Math.PI / 180.0);
    // 右半分が光る期間: 0 < elong < 180 (上弦側)
    // 左半分が光る期間: 180 < elong < 360 (下弦側)
    const isWaxing = elong <= 180;

    // 基本となる月の暗い円盤（ダークサイド）
    let paths = `
      <defs>
        <!-- クレーターや海（模様）のパターン -->
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stop-color="#fffbeb" stop-opacity="0.95" />
          <stop offset="95%" stop-color="#fef08a" stop-opacity="1" />
          <stop offset="100%" stop-color="#facc15" stop-opacity="0.8" />
        </radialGradient>
        <radialGradient id="craterDark" cx="30%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#1e293b" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.1" />
        </radialGradient>
        <clipPath id="moonCircleClip-${isModal ? 'modal' : 'main'}">
          <circle cx="${cx}" cy="${cy}" r="${radius}" />
        </clipPath>
      </defs>

      <!-- 月の裏面（影・暗い部分） -->
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#1e293b" stroke="#334155" stroke-width="1" />
    `;

    // 明るい部分のパス (Terminator curve)
    // 楕円の短軸半径 rx
    const rx = Math.abs(cosE) * radius;

    let lightPath = '';

    if (elong < 1.0 || elong > 359.0) {
      // 新月: ほぼ光らない
      lightPath = '';
    } else if (Math.abs(elong - 180) < 1.5) {
      // 満月: 全面光る
      lightPath = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#moonGlow)" />`;
    } else if (isWaxing) {
      // 満ちていく月 (新月〜上弦〜満月): 右半分側が光る
      // 外周: (cx, cy-radius) から (cx, cy+radius) へ時計回り(sweep=1)
      if (cosE > 0) {
        // 三日月系 (0 < elong < 90): 内側に凹む楕円 (sweep=0 で右側を通る)
        lightPath = `
          <path d="M ${cx} ${cy - radius} 
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius} 
                   A ${rx} ${radius} 0 0 0 ${cx} ${cy - radius} Z" 
                fill="url(#moonGlow)" />
        `;
      } else {
        // 十三夜系 (90 <= elong < 180): 外側に膨らむ楕円 (sweep=1 で左側を通る)
        lightPath = `
          <path d="M ${cx} ${cy - radius} 
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy + radius} 
                   A ${rx} ${radius} 0 0 1 ${cx} ${cy - radius} Z" 
                fill="url(#moonGlow)" />
        `;
      }
    } else {
      // 欠けていく月 (満月〜下弦〜新月): 左半分側が光る
      // 外周: (cx, cy+radius) から (cx, cy-radius) へ時計回り(sweep=1)
      if (cosE < 0) {
        // 十六夜系 (180 < elong <= 270): 外側に膨らむ楕円 (sweep=1 で右側を通る)
        lightPath = `
          <path d="M ${cx} ${cy + radius} 
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius} 
                   A ${rx} ${radius} 0 0 1 ${cx} ${cy + radius} Z" 
                fill="url(#moonGlow)" />
        `;
      } else {
        // 有明月系 (270 < elong < 360): 内側に凹む楕円 (sweep=0 で左側を通る)
        lightPath = `
          <path d="M ${cx} ${cy + radius} 
                   A ${radius} ${radius} 0 0 1 ${cx} ${cy - radius} 
                   A ${rx} ${radius} 0 0 0 ${cx} ${cy + radius} Z" 
                fill="url(#moonGlow)" />
        `;
      }
    }

    // クレーターの装飾（月らしさを演出）
    const craterScale = radius / 32;
    const craters = `
      <g clip-path="url(#moonCircleClip-${isModal ? 'modal' : 'main'})" opacity="0.35">
        <circle cx="${cx - 8 * craterScale}" cy="${cy - 7 * craterScale}" r="${6 * craterScale}" fill="#475569" />
        <circle cx="${cx + 10 * craterScale}" cy="${cy + 5 * craterScale}" r="${8 * craterScale}" fill="#475569" />
        <circle cx="${cx + 2 * craterScale}" cy="${cy + 12 * craterScale}" r="${5 * craterScale}" fill="#475569" />
        <circle cx="${cx - 12 * craterScale}" cy="${cy + 8 * craterScale}" r="${7 * craterScale}" fill="#475569" />
        <circle cx="${cx + 14 * craterScale}" cy="${cy - 9 * craterScale}" r="${5 * craterScale}" fill="#475569" />
      </g>
    `;

    // 太陽のある方向への傾き（回転）
    // モーダルでは北（上）を天頂として標準的な正立表示、空の月は太陽の方向に合わせて自然に傾ける
    let rotateDeg = 0;
    if (!isModal && angleToSun !== null) {
      const sunAngleDeg = angleToSun * 180.0 / Math.PI;
      if (isWaxing) {
        // 右側（0°）が光っているので、太陽の方向に向ける
        rotateDeg = sunAngleDeg;
      } else {
        // 左側（180°）が光っているので、太陽の方向に向ける
        rotateDeg = sunAngleDeg - 180.0;
      }
      // 児童が見て上下逆さまにならないよう自然な傾き（-55°〜+55°）にクランプ
      while (rotateDeg > 180) rotateDeg -= 360;
      while (rotateDeg < -180) rotateDeg += 360;
      rotateDeg = Math.max(-55, Math.min(55, rotateDeg));
    }

    return `
      <svg viewBox="0 0 ${size} ${size}" class="moon-svg" style="transform: rotate(${rotateDeg}deg);">
        ${paths}
        ${craters}
        <g clip-path="url(#moonCircleClip-${isModal ? 'modal' : 'main'})">
          ${lightPath}
        </g>
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

  // --- メインシミュレーション更新 ---
  let lastCheckedDateStr = '';
  let lastMoonHourAngle = null;

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
      if (dateStr !== lastCheckedDateStr) {
        lastCheckedDateStr = dateStr;
        const events = AstroCalc.getDailyEvents(year, month, day);

        elements.sunRiseText.textContent = events.sun.rise;
        elements.sunTransitText.textContent = events.sun.transit;
        elements.sunSetText.textContent = events.sun.set;

        elements.moonRiseText.textContent = events.moon.rise;
        elements.moonTransitText.textContent = events.moon.transit;
        elements.moonSetText.textContent = events.moon.set;
      }

      drawCelestialPaths(year, month, day, width, height);
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
        // 地平線の下に隠れる
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

    // 月のSVG更新 & 配置
    elements.moonElement.innerHTML = renderMoonSVG(moonPos.elongation, angleToSun, false);
    elements.moonElement.style.left = `${moonCoords.x}px`;
    elements.moonElement.style.top = `${moonCoords.y}px`;

    if (moonPos.alt < 0) {
      if (state.showUnderground) {
        elements.moonElement.style.opacity = '0.35';
        elements.moonElement.style.display = 'block';
      } else {
        elements.moonElement.style.opacity = '0';
        elements.moonElement.style.display = 'none';
      }
    } else {
      // 昼間の月は青空に溶け込んでほんのり見える演出
      if (sunPos.alt > 10) {
        elements.moonElement.style.opacity = '0.85';
      } else {
        elements.moonElement.style.opacity = '1';
      }
      elements.moonElement.style.display = 'block';
    }

    // 6. タイムスライダーの値を同期 (0 ~ 1440 分)
    const currentMinutes = hours * 60 + minutes;
    elements.timeSlider.value = currentMinutes;

    // 7. 宇宙視点ミニビューの更新
    drawSpaceView(moonPos.elongation);
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

  // --- ドロップダウンピッカーの値を現在日時に同期 ---
  function syncDropdownValues(dt) {
    if (!dt || isNaN(dt.getTime())) return;
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const h24 = dt.getHours();
    const minutes = dt.getMinutes();

    // 年が選択肢範囲外なら安全にクランプまたは追加
    if (!Array.from(elements.selectYear.options).some(o => Number(o.value) === year)) {
      const opt = document.createElement('option');
      opt.value = year;
      opt.textContent = `${year}年`;
      elements.selectYear.appendChild(opt);
    }

    elements.selectYear.value = String(year);
    elements.selectMonth.value = String(month);
    updateDayOptions(year, month, day);
    elements.selectAmPm.value = h24 >= 12 ? 'pm' : 'am';
    elements.selectHour.value = String(h24 % 12);
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

    // 午前/午後表示
    const isPm = h24 >= 12;
    state.isPmMode = isPm;

    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    elements.ampmBadge.textContent = isPm ? '午後' : '午前';
    elements.ampmBadge.className = `ampm-badge ${isPm ? 'pm' : 'am'}`;

    elements.timeDigits.textContent = `${h12} : ${mStr}`;

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

    // 時 (12時間制: 0=12時, 1~11=1~11時。午前/午後は selectAmPm で指定)
    elements.selectHour.innerHTML = '';
    for (let h = 0; h < 12; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h === 0 ? '12時' : `${h}時`;
      elements.selectHour.appendChild(opt);
    }

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

    // 日時変更ドロップダウン開閉
    elements.btnEditDate.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !elements.datetimeDropdown.classList.contains('active');
      if (willOpen) {
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
      const parsedH12 = parseInt(elements.selectHour.value, 10);
      const parsedMn = parseInt(elements.selectMinute.value, 10);

      const y = !isNaN(parsedY) ? parsedY : fallback.getFullYear();
      const m1 = !isNaN(parsedM) ? Math.min(Math.max(1, parsedM), 12) : (fallback.getMonth() + 1);
      const maxDays = new Date(y, m1, 0).getDate();
      const d = !isNaN(parsedD) ? Math.min(Math.max(1, parsedD), maxDays) : Math.min(fallback.getDate(), maxDays);
      const ampm = elements.selectAmPm.value === 'pm' ? 'pm' : 'am';
      const h12mod = !isNaN(parsedH12) ? (parsedH12 % 12) : (fallback.getHours() % 12);
      const h24 = (ampm === 'pm' ? 12 : 0) + h12mod;
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
    });

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

    // キーボードショートカット (電子黒板やキーボード付きiPad向け)
    window.addEventListener('keydown', (e) => {
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
