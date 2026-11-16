/**
 * ひかりと地球・月 v1.3 - アプリケーション本体 (app.js)
 * 宇宙から見た太陽・地球・月の動きと光の当たり方（太陽中心・地動説モデル／ベタ塗り3D／iPad Safari横向き対応）
 */

(function () {
  'use strict';

  // --- アプリケーション状態 (State) ---
  const state = {
    currentDate: new Date(),         // 現在のシミュレーション日時
    isPlaying: false,                // アニメーション再生中フラグ
    playSpeedMinutesPerSec: 15,      // 再生速度 (1秒あたりの経過分数)
    lastTimestamp: 0,                // requestAnimationFrame 用

    // 表示オプション
    showSunlight: true,              // 太陽の光（矢印・光の帯）表示フラグ
    showOrbits: true,                // 軌道・視線ライン表示フラグ
    lockHourOnMoonDrag: false,       // 月・地球ドラッグ時に佐伯の時刻（時分）を固定するか
    use24Hour: false,                // 24時間表示 (false: 午前/午後, true: 24時間)
    showObserverCardBody: true,      // 左上（佐伯からの見え方）詳細展開フラグ
    showAstroData: true,             // 右上（出入り時刻）詳細展開フラグ

    // 宇宙カメラ視点状態
    camera: {
      yaw: 0,                        // 水平回転角（ラジアン）
      pitch: (58 * Math.PI) / 180,   // 仰角（ラジアン：初期は上から斜めに見下ろす立体視点）
      panX: 0,                       // 画面平行移動 X (px)
      panY: 0,                       // 画面平行移動 Y (px)
      zoom: 1.0,                     // 拡大率（つねに太陽を不動の基準として拡大縮小）
      dragMode: 'rotate'             // 'rotate'（背景ドラッグで視点回転）| 'pan'（背景ドラッグで視点移動）
    },

    sunVisualSpinOffsetDeg: 0,       // 太陽ドラッグ回転の見た目の角度オフセット
    activeDragLabel: '',             // ドラッグ中にキャンバス上部に出す操作フィードバック文字

    // ピン留め・比較・カレンダー
    pinnedSnapshots: [],             // 宇宙にのこした天体スナップショット（最大6個）
    compareDateA: null,
    compareDateB: null,
    hideCompareInfo: false,
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1,
    calHour: 20,
    calCompareMode: false,
    calPickedDates: [],

    portraitWarningDismissed: false, // 縦向き案内一時閉じフラグ
    stars: [],                       // 背景の星空
    lastProjected: null              // 最新の3D投影座標キャッシュ（ヒット判定用）
  };

  // --- DOM要素の参照 ---
  const elements = {
    spaceViewport: document.getElementById('space-viewport'),
    spaceCanvas: document.getElementById('space-main-canvas'),
    pinnedBadgesLayer: document.getElementById('pinned-badges-layer'),

    // 左上：佐伯（指定地点）から見た空と月カード
    earthObserverCard: document.getElementById('earth-observer-card'),
    observerCardTitle: document.getElementById('observer-card-title'),
    observerTimezonePill: document.getElementById('observer-timezone-pill'),
    btnToggleObserverCard: document.getElementById('btn-toggle-observer-card'),
    saikiMoonPreviewBtn: document.getElementById('saiki-moon-preview-btn'),
    saikiMoonSvg: document.getElementById('saiki-moon-svg'),
    saikiMoonName: document.getElementById('saiki-moon-name'),
    saikiMoonSub: document.getElementById('saiki-moon-sub'),
    saikiSkySvg: document.getElementById('saiki-sky-svg'),
    skyDirEast: document.getElementById('sky-dir-east'),
    skyDirCenter: document.getElementById('sky-dir-center'),
    skyDirWest: document.getElementById('sky-dir-west'),
    saikiMoonStatus: document.getElementById('saiki-moon-status'),

    // 右上：日付・時刻・地域・出入りカード
    astroCard: document.getElementById('astro-card'),
    btnToggleAstroData: document.getElementById('btn-toggle-astro-data'),
    btnLocationPicker: document.getElementById('btn-location-picker'),
    locationNameText: document.getElementById('location-name-text'),

    // 観測地点選択モーダル
    locationModal: document.getElementById('location-modal'),
    locationCurrentBadge: document.getElementById('location-current-badge'),
    btnResetSaikiModal: document.getElementById('btn-reset-saiki-modal'),
    btnCloseLocation: document.getElementById('btn-close-location'),
    locationCategoryTabs: document.getElementById('location-category-tabs'),
    locationCategoryDesc: document.getElementById('location-category-desc'),
    locationGrid: document.getElementById('location-grid'),
    inputLocName: document.getElementById('input-loc-name'),
    inputLocLat: document.getElementById('input-loc-lat'),
    inputLocLon: document.getElementById('input-loc-lon'),
    btnApplyLocation: document.getElementById('btn-apply-location'),

    dateDisplay: document.getElementById('date-display'),
    btnPrevDay: document.getElementById('btn-prev-day'),
    btnTodayQuick: document.getElementById('btn-today-quick'),
    btnNextDay: document.getElementById('btn-next-day'),
    ampmBadge: document.getElementById('ampm-badge'),
    timeDigits: document.getElementById('time-digits'),
    btnTimeFormat: document.getElementById('btn-time-format'),
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
    btnTodayDate: document.getElementById('btn-today-date'),
    btnApplyDate: document.getElementById('btn-apply-date'),

    sunRiseText: document.getElementById('sun-rise-text'),
    sunTransitText: document.getElementById('sun-transit-text'),
    sunSetText: document.getElementById('sun-set-text'),
    moonRiseText: document.getElementById('moon-rise-text'),
    moonTransitText: document.getElementById('moon-transit-text'),
    moonSetText: document.getElementById('moon-set-text'),
    moonDataRow: document.getElementById('moon-data-row'),
    moonBadgeBtn: document.getElementById('moon-badge-btn'),
    moonShapeName: document.getElementById('moon-shape-name'),
    moonAltitudeStatus: document.getElementById('moon-altitude-status'),
    moonAgeText: document.getElementById('moon-age-text'),

    // 左下：カメラ視点コントロールバー & 右下凡例
    btnCamModeRotate: document.getElementById('btn-cam-mode-rotate'),
    btnCamModePan: document.getElementById('btn-cam-mode-pan'),
    btnViewTop: document.getElementById('btn-view-top'),
    btnViewDiag: document.getElementById('btn-view-diag'),
    btnViewSide: document.getElementById('btn-view-side'),
    btnToggleScale: document.getElementById('btn-toggle-scale'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    btnViewReset: document.getElementById('btn-view-reset'),
    legendObserverName: document.getElementById('legend-observer-name'),
    dragHintText: document.getElementById('drag-hint-text'),

    // 下部コントロールバー
    btnStepBack: document.getElementById('btn-step-back'),
    btnPlayPause: document.getElementById('btn-play-pause'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    btnStepForward: document.getElementById('btn-step-forward'),
    timeSlider: document.getElementById('time-slider'),
    timelineTicks: document.getElementById('timeline-ticks'),
    selectSpeed: document.getElementById('select-speed'),
    btnToggleLight: document.getElementById('btn-toggle-light'),
    btnTogglePath: document.getElementById('btn-toggle-path'),
    btnLockHour: document.getElementById('btn-lock-hour'),
    btnPinMoon: document.getElementById('btn-pin-moon'),
    btnClearPins: document.getElementById('btn-clear-pins'),
    btnOpenCompare: document.getElementById('btn-open-compare'),
    btnOpenCalendar: document.getElementById('btn-open-calendar'),

    // 月拡大モーダル
    moonModal: document.getElementById('moon-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    modalMoonDatetime: document.getElementById('modal-moon-datetime'),
    modalMoonRuby: document.getElementById('modal-moon-ruby'),
    modalMoonName: document.getElementById('modal-moon-name'),
    modalEarthViewCaption: document.getElementById('modal-earth-view-caption'),
    modalMoonSvg: document.getElementById('modal-moon-svg'),
    modalSpaceSvg: document.getElementById('modal-space-svg'),
    modalMoonAge: document.getElementById('modal-moon-age'),
    modalMoonPhase: document.getElementById('modal-moon-phase'),
    modalMoonVis: document.getElementById('modal-moon-vis'),
    btnModalPrev3Day: document.getElementById('btn-modal-prev-3day'),
    btnModalPrevDay: document.getElementById('btn-modal-prev-day'),
    btnModalNextDay: document.getElementById('btn-modal-next-day'),
    btnModalNext3Day: document.getElementById('btn-modal-next-3day'),
    btnModalPinMoon: document.getElementById('btn-modal-pin-moon'),
    btnToggleExplanation: document.getElementById('btn-toggle-explanation'),
    modalExplanation: document.getElementById('modal-explanation'),

    // くらべるモーダル
    compareModal: document.getElementById('compare-modal'),
    btnCompareToggleInfo: document.getElementById('btn-compare-toggle-info'),
    btnCompareSyncTime: document.getElementById('btn-compare-sync-time'),
    btnCloseCompare: document.getElementById('btn-close-compare'),
    compAYear: document.getElementById('comp-a-year'),
    compAMonth: document.getElementById('comp-a-month'),
    compADay: document.getElementById('comp-a-day'),
    compAHour: document.getElementById('comp-a-hour'),
    compAMoonSvg: document.getElementById('comp-a-moon-svg'),
    compASpaceSvg: document.getElementById('comp-a-space-svg'),
    compAInfo: document.getElementById('comp-a-info'),
    compBYear: document.getElementById('comp-b-year'),
    compBMonth: document.getElementById('comp-b-month'),
    compBDay: document.getElementById('comp-b-day'),
    compBHour: document.getElementById('comp-b-hour'),
    compBMoonSvg: document.getElementById('comp-b-moon-svg'),
    compBSpaceSvg: document.getElementById('comp-b-space-svg'),
    compBInfo: document.getElementById('comp-b-info'),
    btnComparePinBoth: document.getElementById('btn-compare-pin-both'),

    // カレンダーモーダル
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

    // 縦向き警告オーバーレイ
    portraitWarningOverlay: document.getElementById('portrait-warning-overlay'),
    btnDismissPortraitWarning: document.getElementById('btn-dismiss-portrait-warning')
  };

  // --- 数学・ベクトルヘルパー ---
  function rad(d) { return (d * Math.PI) / 180.0; }
  function clamp(v, minV, maxV) { return Math.max(minV, Math.min(maxV, v)); }
  function vecNorm(v) {
    const len = Math.hypot(v.x, v.y, v.z);
    if (len < 1e-9) return { x: 0, y: 0, z: 1 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }
  function getShortObserverName(name) {
    return (name || '')
      .replace(/^大分県/, '')
      .replace(/^佐伯市立/, '')
      .replace(/（.*?）/g, '');
  }

  // 赤道座標方向から黄道3D方向へ変換（地軸傾斜 epsDeg 反映）
  function latLonToEclipticVec(latDeg, lonDeg, gmstDeg, epsDeg) {
    const phi = rad(latDeg);
    const theta = rad(gmstDeg + lonDeg);
    const eqX = Math.cos(phi) * Math.cos(theta);
    const eqY = Math.cos(phi) * Math.sin(theta);
    const eqZ = Math.sin(phi);

    const eps = rad(epsDeg);
    const cosE = Math.cos(eps);
    const sinE = Math.sin(eps);
    return {
      x: eqX,
      y: eqY * cosE + eqZ * sinE,
      z: -eqY * sinE + eqZ * cosE
    };
  }

  // 簡易大陸ポリゴン（日本＋主要大陸のシンプルなシルエット：経度・緯度）
  const WORLD_CONTINENTS = [
    // 日本列島（九州・本州・北海道）
    [
      [31, 130], [33, 129.5], [34.5, 132], [35.5, 136], [38, 140], [41, 141],
      [44, 143], [45, 145], [42.5, 144], [40, 142], [36, 140.5], [34, 136], [32.5, 132]
    ],
    // ユーラシア大陸
    [
      [36, -9], [44, -9], [52, 2], [58, 10], [66, 20], [70, 50], [72, 95],
      [68, 135], [64, 175], [52, 140], [40, 128], [32, 121], [22, 114],
      [10, 104], [8, 78], [22, 68], [28, 48], [32, 34], [38, 24], [36, 4]
    ],
    // アフリカ大陸
    [
      [35, -6], [36, 10], [31, 32], [12, 44], [2, 45], [-18, 36],
      [-34, 20], [-20, 13], [4, 9], [6, -12], [20, -17]
    ],
    // オーストラリア大陸
    [
      [-12, 131], [-12, 142], [-22, 150], [-36, 150], [-38, 140], [-33, 115], [-20, 118]
    ],
    // 北アメリカ大陸
    [
      [70, -162], [70, -120], [62, -78], [48, -55], [30, -81], [25, -80],
      [20, -90], [16, -95], [22, -106], [34, -120], [50, -128], [60, -148]
    ],
    // 南アメリカ大陸
    [
      [10, -75], [8, -60], [-5, -35], [-22, -40], [-42, -64],
      [-54, -68], [-44, -74], [-18, -71], [-4, -81]
    ]
  ];

  // --- 背景の星空初期化 ---
  function initStars() {
    state.stars = [];
    for (let i = 0; i < 160; i++) {
      state.stars.push({
        x: Math.random(),
        y: Math.random(),
        radius: Math.random() * 1.3 + 0.5,
        alpha: Math.random() * 0.55 + 0.25
      });
    }
  }

  // --- 実表示領域サイズ取得（iPad Safari URL/タブバー対応・ピンチ拡大無視） ---
  function getViewportSize() {
    const vv = window.visualViewport;
    const isUnscaled = vv && Math.abs((vv.scale || 1) - 1) < 0.05;
    const width = isUnscaled ? Math.round(vv.width) : window.innerWidth;
    const height = isUnscaled ? Math.round(vv.height) : window.innerHeight;
    return { width, height };
  }

  // 縦向き時の透過グレーアウト案内制御
  function updateOrientationWarning(width, height) {
    if (!elements.portraitWarningOverlay) return;
    const isPortrait = height > width;
    if (!isPortrait) {
      state.portraitWarningDismissed = false;
      elements.portraitWarningOverlay.classList.remove('active', 'dismissed');
    } else {
      elements.portraitWarningOverlay.classList.toggle('active', !state.portraitWarningDismissed);
      elements.portraitWarningOverlay.classList.toggle('dismissed', state.portraitWarningDismissed);
    }
  }

  function resizeCanvases() {
    const { width, height } = getViewportSize();
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    updateOrientationWarning(width, height);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    elements.spaceCanvas.width = Math.round(width * dpr);
    elements.spaceCanvas.height = Math.round(height * dpr);
    elements.spaceCanvas.style.width = `${width}px`;
    elements.spaceCanvas.style.height = `${height}px`;

    updateSimulation(true);
  }

  // --- カメラ回転・3D投影 ---
  function rotateVecToCam(v) {
    const cy = Math.cos(state.camera.yaw);
    const sy = Math.sin(state.camera.yaw);
    const rx = v.x * cy - v.y * sy;
    const ry = v.x * sy + v.y * cy;
    const rz = v.z;

    const cp = Math.cos(state.camera.pitch);
    const sp = Math.sin(state.camera.pitch);
    return {
      x: rx,
      y: ry * sp + rz * cp,
      z: -ry * cp + rz * sp
    };
  }

  function projectWorldPoint(p, camTarget, centerX, centerY, baseScale) {
    const rel = {
      x: p.x - camTarget.x,
      y: p.y - camTarget.y,
      z: p.z - camTarget.z
    };
    const cam = rotateVecToCam(rel);
    const focal = 1750.0;
    // 拡大率（zoom）を切り離した純粋な3D幾何奥行きのみで遠近感を計算し、高倍率ズーム時の歪みを防ぐ
    const unzoomedScale = baseScale / Math.max(0.25, state.camera.zoom);
    const persp = clamp(focal / Math.max(450.0, focal - cam.z * unzoomedScale), 0.6, 1.75);
    const scale = baseScale * persp;
    return {
      sx: centerX + cam.x * scale,
      sy: centerY - cam.y * scale,
      camZ: cam.z,
      scale: scale,
      camPos: cam
    };
  }

  // Sutherland-Hodgman による前面半球 (z >= 0) ポリゴンクリッピング
  function clipSpherePolygonFront(camVerts) {
    if (!camVerts || camVerts.length < 3) return [];
    const output = [];
    for (let i = 0; i < camVerts.length; i++) {
      const a = camVerts[i];
      const b = camVerts[(i + 1) % camVerts.length];
      const aIn = a.z >= 0;
      const bIn = b.z >= 0;

      if (aIn && bIn) {
        output.push(b);
      } else if (aIn && !bIn) {
        const t = a.z / (a.z - b.z);
        output.push(vecNorm({
          x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y),
          z: 0
        }));
      } else if (!aIn && bIn) {
        const t = a.z / (a.z - b.z);
        output.push(vecNorm({
          x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y),
          z: 0
        }));
        output.push(b);
      }
    }
    return output;
  }

  // 明暗境界（昼・光が当たる側のパス）を構築してクリッピング（グラデーションなし・完全ベタ塗り）
  function buildLitHemispherePath(ctx, R, lightCam) {
    const alpha = Math.atan2(-lightCam.y, lightCam.x);
    const lz = clamp(lightCam.z, -1, 1);

    ctx.save();
    ctx.rotate(alpha);
    ctx.beginPath();

    if (lz >= 0.998) {
      ctx.arc(0, 0, R, 0, Math.PI * 2);
    } else if (lz <= -0.998) {
      // 光面がほぼ完全な裏側
      ctx.moveTo(0, 0);
    } else {
      ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
      const rx = Math.abs(lz) * R;
      if (rx < 0.4) {
        ctx.lineTo(0, -R);
      } else if (lz >= 0) {
        ctx.ellipse(0, 0, rx, R, 0, Math.PI / 2, Math.PI * 1.5, false);
      } else {
        ctx.ellipse(0, 0, rx, R, 0, Math.PI / 2, -Math.PI / 2, true);
      }
      ctx.closePath();
    }
    ctx.restore();
  }

  // 地球表面の緯線・経線・大陸をベタ塗りで描画（昼色／夜色をクリップで切り替え）
  function drawEarthSurfaceLayer(ctx, R, spaceState, colors) {
    const gmst = spaceState.gmstDeg;
    const eps = spaceState.epsDeg;

    // 緯線（赤道）
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = Math.max(0.8, R * 0.028);
    ctx.beginPath();
    let penDown = false;
    for (let lon = 0; lon <= 360; lon += 12) {
      const camV = rotateVecToCam(latLonToEclipticVec(0, lon, gmst, eps));
      if (camV.z >= 0) {
        const px = camV.x * R;
        const py = -camV.y * R;
        if (!penDown) {
          ctx.moveTo(px, py);
          penDown = true;
        } else {
          ctx.lineTo(px, py);
        }
      } else {
        penDown = false;
      }
    }
    ctx.stroke();

    // 経線（6本）
    for (let lon = 0; lon < 360; lon += 60) {
      ctx.beginPath();
      penDown = false;
      for (let lat = -85; lat <= 85; lat += 12) {
        const camV = rotateVecToCam(latLonToEclipticVec(lat, lon, gmst, eps));
        if (camV.z >= 0) {
          const px = camV.x * R;
          const py = -camV.y * R;
          if (!penDown) {
            ctx.moveTo(px, py);
            penDown = true;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          penDown = false;
        }
      }
      ctx.stroke();
    }

    // 大陸シルエット（ベタ塗り）
    ctx.fillStyle = colors.land;
    for (const poly of WORLD_CONTINENTS) {
      const camVerts = poly.map(([lat, lon]) => rotateVecToCam(latLonToEclipticVec(lat, lon, gmst, eps)));
      const clipped = clipSpherePolygonFront(camVerts);
      if (clipped.length >= 3) {
        ctx.beginPath();
        clipped.forEach((v, idx) => {
          const px = v.x * R;
          const py = -v.y * R;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
      }
    }

    // 北極・南極の白い氷冠（極地をベタ塗り）
    function drawIceCap(latEdge) {
      const capPoly = [];
      for (let lon = 0; lon < 360; lon += 30) capPoly.push([latEdge, lon]);
      const capCam = capPoly.map(([lat, lon]) => rotateVecToCam(latLonToEclipticVec(lat, lon, gmst, eps)));
      const capClipped = clipSpherePolygonFront(capCam);
      if (capClipped.length >= 3) {
        ctx.fillStyle = colors.ice;
        ctx.beginPath();
        capClipped.forEach((v, idx) => {
          const px = v.x * R;
          const py = -v.y * R;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
      }
    }
    drawIceCap(74);
    drawIceCap(-72);
  }

  // --- ベタ塗り3D地球の描画 ---
  function drawFlatEarth(ctx, cx, cy, R, lightCam, spaceState, isGhost) {
    ctx.save();
    ctx.translate(cx, cy);
    if (isGhost) ctx.globalAlpha = 0.42;

    // 球体全体クリップ
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    // 1. 夜側（かげ）のベタ塗り
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4);
    drawEarthSurfaceLayer(ctx, R, spaceState, {
      land: '#166534',
      ice: '#475569',
      grid: 'rgba(148, 163, 184, 0.25)'
    });

    // 2. 昼側（光が当たる側）を明暗境界でクリップしてベタ塗り
    if (lightCam.z > -0.998) {
      ctx.save();
      buildLitHemispherePath(ctx, R, lightCam);
      ctx.clip();

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4);
      drawEarthSurfaceLayer(ctx, R, spaceState, {
        land: '#4ade80',
        ice: '#f8fafc',
        grid: 'rgba(255, 255, 255, 0.35)'
      });
      ctx.restore();
    }

    // 昼夜のさかい目ライン（光の当たり方ON時）
    if (state.showSunlight && lightCam.z > -0.998 && lightCam.z < 0.998) {
      const alpha = Math.atan2(-lightCam.y, lightCam.x);
      const rx = Math.abs(lightCam.z) * R;
      ctx.save();
      ctx.rotate(alpha);
      ctx.beginPath();
      if (rx < 0.4) {
        ctx.moveTo(0, -R);
        ctx.lineTo(0, R);
      } else if (lightCam.z >= 0) {
        ctx.ellipse(0, 0, rx, R, 0, Math.PI / 2, Math.PI * 1.5, false);
      } else {
        ctx.ellipse(0, 0, rx, R, 0, Math.PI / 2, -Math.PI / 2, true);
      }
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = Math.max(1.2, R * 0.045);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // 球体クリップ解除

    // 地軸・北極/南極マーカー（地球拡大時や極地観察時にわかりやすく表示）
    if (!isGhost) {
      const drawPoleAxis = (poleLat, label) => {
        const poleVec = rotateVecToCam(latLonToEclipticVec(poleLat, 0, spaceState.gmstDeg, spaceState.epsDeg));
        if (poleVec.z >= -0.1) {
          const px = poleVec.x * R * 1.18;
          const py = -poleVec.y * R * 1.18;
          ctx.beginPath();
          ctx.moveTo(poleVec.x * R * 0.9, -poleVec.y * R * 0.9);
          ctx.lineTo(px, py);
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          ctx.fillStyle = '#bae6fd';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, px, poleVec.y >= 0 ? py - 4 : py + 11);
        }
      };
      drawPoleAxis(90, '北極(N)');
      drawPoleAxis(-90, '南極(S)');
    }

    // 外枠
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = isGhost ? '#38bdf8' : '#7dd3fc';
    ctx.lineWidth = isGhost ? 1.5 : 2;
    ctx.stroke();

    ctx.restore();
  }

  // --- ベタ塗り3D月の描画 ---
  function drawFlatMoon(ctx, cx, cy, R, lightCam, isGhost) {
    ctx.save();
    ctx.translate(cx, cy);
    if (isGhost) ctx.globalAlpha = 0.72;

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();

    // 影側（ベタ塗り）
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4);

    // 光る側（ベタ塗り）
    if (lightCam.z > -0.998) {
      ctx.save();
      buildLitHemispherePath(ctx, R, lightCam);
      ctx.clip();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-R - 2, -R - 2, R * 2 + 4, R * 2 + 4);
      ctx.restore();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.strokeStyle = isGhost ? '#38bdf8' : '#facc15';
    ctx.lineWidth = isGhost ? 1.8 : 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // --- ベタ塗り太陽の描画（自転がわかる黒点・コロナ線つき・グラデーションなし） ---
  function drawFlatSun(ctx, cx, cy, R, spinDeg) {
    ctx.save();
    ctx.translate(cx, cy);

    // 外側コロナのベタ塗り輪
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, R * 1.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.28)';
    ctx.fill();

    // 自転で回転するコロナの三角トゲ（12本）
    const spinRad = rad(spinDeg);
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i < 12; i++) {
      const a = spinRad + (i * Math.PI * 2) / 12;
      const tipR = R * 1.34;
      const baseR = R * 1.01;
      const da = 0.11;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - da) * baseR, Math.sin(a - da) * baseR);
      ctx.lineTo(Math.cos(a) * tipR, Math.sin(a) * tipR);
      ctx.lineTo(Math.cos(a + da) * baseR, Math.sin(a + da) * baseR);
      ctx.closePath();
      ctx.fill();
    }

    // 本体（ベタ塗り）
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 太陽の自転が視覚的にわかる太陽黒点・模様
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.94, 0, Math.PI * 2);
    ctx.clip();

    const spotAngles = [0, 120, 240];
    spotAngles.forEach((offset, idx) => {
      const a = rad(spinDeg + offset);
      const dist = R * (0.42 + idx * 0.11);
      const sx = Math.cos(a) * dist;
      const sy = -Math.sin(a) * dist * Math.max(0.25, Math.abs(Math.sin(state.camera.pitch)));
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2.5, R * 0.11), 0, Math.PI * 2);
      ctx.fillStyle = '#ea580c';
      ctx.fill();
    });
    ctx.restore();

    ctx.restore();
  }

  // --- 太陽光矢印の描画（ベタ塗り） ---
  function drawSunlightBeams(ctx, earthSx, earthSy, sunDirCam, moonSx, moonSy, earthR, moonR, mode) {
    if (!state.showSunlight) return;
    // 画面2D空間での太陽光が進む向き（太陽 → 地球方向 = -sunDirCam）
    const rayDir2D = { x: -sunDirCam.x, y: sunDirCam.y }; // Canvas Yは下向きなので符号反転
    const len2D = Math.hypot(rayDir2D.x, rayDir2D.y);
    if (len2D < 0.08) return; // カメラ真裏/真正面から光が来ているときは矢印省略
    const ux = rayDir2D.x / len2D;
    const uy = rayDir2D.y / len2D;
    const px = -uy; // 垂直方向
    const py = ux;

    const isCloseZoom = earthR > 75;
    const span = isCloseZoom
      ? Math.min(240, Math.max(110, earthR * 1.35))
      : (mode === 'earth-focus' ? Math.max(150, earthR * 3.1) : Math.max(96, earthR * 3.6));
    const step = isCloseZoom ? Math.min(95, earthR * 0.65) : span / 2;
    const distOut = isCloseZoom ? earthR + 58 : span * 0.98;
    const distIn = isCloseZoom ? earthR + 12 : span * 0.56;

    ctx.save();
    // くっきり平行光の矢印（5本）
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.88)';
    ctx.fillStyle = '#fde047';
    ctx.lineWidth = 2.2;

    for (let i = -2; i <= 2; i++) {
      const ox = earthSx + px * (i * step * 0.5);
      const oy = earthSy + py * (i * step * 0.5);
      const startX = ox - ux * distOut;
      const startY = oy - uy * distOut;
      const endX = ox - ux * distIn;
      const endY = oy - uy * distIn;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // 矢印の先端
      const head = 7.5;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - ux * head + px * (head * 0.55), endY - uy * head + py * (head * 0.55));
      ctx.lineTo(endX - ux * head - px * (head * 0.55), endY - uy * head - py * (head * 0.55));
      ctx.closePath();
      ctx.fill();
    }

    // ラベル「☀️ 太陽の光」（太陽本体と重ならない位置に配置）
    const labelDist = isCloseZoom ? earthR + 36 : span * 0.8;
    const labelX = earthSx - ux * labelDist + px * (step * 1.45);
    const labelY = earthSy - uy * labelDist + py * (step * 1.45);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☀️ 太陽の光', labelX, labelY);

    ctx.restore();
  }

  // --- メイン宇宙キャンバス描画 ---
  function drawSpaceScene(spaceState) {
    const canvas = elements.spaceCanvas;
    const ctx = canvas.getContext('2d');
    const { width, height } = getViewportSize();
    const dpr = canvas.width / Math.max(1, width);

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. 宇宙の背景（ベタ塗り＆星々）
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    for (const s of state.stars) {
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.fill();
    }

    // 2. ワールド定数と基準スケール（太陽原点・地動説カメラ）
    const usableH = Math.max(280, height - 135);
    const isEarthCloseup = state.camera.zoom >= 1.8;
    const baseScale = (Math.min(width * 0.66, usableH * 0.86) / 460) * state.camera.zoom;

    const EARTH_ORBIT_R = 148;
    const MOON_ORBIT_R = 64;
    const SUN_WORLD_R = 28;
    const EARTH_WORLD_R = 23;
    const MOON_WORLD_R = 11.5;

    // 太陽はつねに宇宙の不動の基準点 (0, 0, 0)
    const sunWorld = { x: 0, y: 0, z: 0 };
    // 地球の位置（反時計回り公転：-sunDirEcl * EARTH_ORBIT_R）
    const earthWorld = {
      x: -spaceState.sunDirEcl.x * EARTH_ORBIT_R,
      y: -spaceState.sunDirEcl.y * EARTH_ORBIT_R,
      z: 0
    };
    // 月の位置（地球中心＋月黄道方向 * MOON_ORBIT_R）
    const moonRelWorld = {
      x: spaceState.moonDirEcl.x * MOON_ORBIT_R,
      y: spaceState.moonDirEcl.y * MOON_ORBIT_R,
      z: spaceState.moonDirEcl.z * MOON_ORBIT_R
    };
    const moonWorld = {
      x: earthWorld.x + moonRelWorld.x,
      y: earthWorld.y + moonRelWorld.y,
      z: earthWorld.z + moonRelWorld.z
    };

    const camTarget = sunWorld;
    const centerX = width * 0.5 + state.camera.panX;
    const centerY = height * 0.52 + state.camera.panY;

    // 3. 地球の公転軌道リング（地球中心視点でも一部が見えるよう大きく円弧を描く）
    if (state.showOrbits) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.8;
      for (let deg = 0; deg <= 360; deg += 6) {
        const pt = {
          x: Math.cos(rad(deg)) * EARTH_ORBIT_R,
          y: Math.sin(rad(deg)) * EARTH_ORBIT_R,
          z: 0
        };
        const p = projectWorldPoint(pt, camTarget, centerX, centerY, baseScale);
        if (deg === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 地球の公転方向を示す矢印（地球の少し先）
      const aheadAngle = spaceState.earthOrbitAngleDeg + 20;
      const arrowPos = projectWorldPoint({
        x: Math.cos(rad(aheadAngle)) * EARTH_ORBIT_R,
        y: Math.sin(rad(aheadAngle)) * EARTH_ORBIT_R,
        z: 0
      }, camTarget, centerX, centerY, baseScale);
      const arrowNext = projectWorldPoint({
        x: Math.cos(rad(aheadAngle + 4)) * EARTH_ORBIT_R,
        y: Math.sin(rad(aheadAngle + 4)) * EARTH_ORBIT_R,
        z: 0
      }, camTarget, centerX, centerY, baseScale);
      const adx = arrowNext.sx - arrowPos.sx;
      const ady = arrowNext.sy - arrowPos.sy;
      const alen = Math.hypot(adx, ady);
      if (alen > 0.5) {
        const aux = adx / alen;
        const auy = ady / alen;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(arrowPos.sx + aux * 8, arrowPos.sy + auy * 8);
        ctx.lineTo(arrowPos.sx - aux * 5 - auy * 5, arrowPos.sy - auy * 5 + aux * 5);
        ctx.lineTo(arrowPos.sx - aux * 5 + auy * 5, arrowPos.sy - auy * 5 - aux * 5);
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('公転 ↺', arrowPos.sx, arrowPos.sy - 11);
      }

      // 月の公転軌道リング（地球のまわり）
      ctx.beginPath();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.48)';
      ctx.lineWidth = 1.6;
      for (let deg = 0; deg <= 360; deg += 6) {
        // 月の傾斜は約5.1°なので軌道円も視覚的に揃える
        const incZ = Math.sin(rad(deg - spaceState.moonAbsoluteOrbitDeg)) * 0; // 平面ガイド
        const pt = {
          x: earthWorld.x + Math.cos(rad(deg)) * MOON_ORBIT_R,
          y: earthWorld.y + Math.sin(rad(deg)) * MOON_ORBIT_R,
          z: earthWorld.z + incZ
        };
        const p = projectWorldPoint(pt, camTarget, centerX, centerY, baseScale);
        if (deg === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 4. 主要天体の投影座標と半径を計算
    const sunProj = projectWorldPoint(sunWorld, camTarget, centerX, centerY, baseScale);
    const earthProj = projectWorldPoint(earthWorld, camTarget, centerX, centerY, baseScale);
    const moonProj = projectWorldPoint(moonWorld, camTarget, centerX, centerY, baseScale);

    const sunScreenR = Math.max(18, SUN_WORLD_R * sunProj.scale);
    const earthScreenR = Math.max(16, EARTH_WORLD_R * earthProj.scale);
    const moonScreenR = Math.max(9, MOON_WORLD_R * moonProj.scale);

    // 太陽方向ベクトル（地球・月ともに平行太陽光として sunDirEcl を使用）
    const sunDirCam = rotateVecToCam(spaceState.sunDirEcl);

    // 5. 太陽光ビームの描画（地球・月を照らす様子）
    drawSunlightBeams(ctx, earthProj.sx, earthProj.sy, sunDirCam, moonProj.sx, moonProj.sy, earthScreenR, moonScreenR, isEarthCloseup ? 'earth-focus' : 'solar-system');

    // 6. 佐伯から月を見る視線ライン（軌道・ガイドON時）
    const obs = AstroCalc.getObserver();
    const saikiVecEcl = latLonToEclipticVec(obs.lat, obs.lon, spaceState.gmstDeg, spaceState.epsDeg);
    const saikiVecCam = rotateVecToCam(saikiVecEcl);
    const saikiScreenX = earthProj.sx + saikiVecCam.x * earthScreenR;
    const saikiScreenY = earthProj.sy - saikiVecCam.y * earthScreenR;
    const moonAboveHorizon = spaceState.moonPos.rawAlt >= 0;

    if (state.showOrbits) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(saikiScreenX, saikiScreenY);
      ctx.lineTo(moonProj.sx, moonProj.sy);
      ctx.strokeStyle = moonAboveHorizon ? 'rgba(253, 224, 71, 0.72)' : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = moonAboveHorizon ? 2 : 1.3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 7. ピン留めしたスナップショット（のこした天体）の描画用配列を構築
    const drawQueue = [];

    // 本体3天体をキューに追加（奥行き camZ の小さい順＝奥から手前へ描画）
    drawQueue.push({
      type: 'sun',
      camZ: sunProj.camZ,
      sx: sunProj.sx,
      sy: sunProj.sy,
      r: sunScreenR
    });
    drawQueue.push({
      type: 'earth',
      camZ: earthProj.camZ,
      sx: earthProj.sx,
      sy: earthProj.sy,
      r: earthScreenR
    });
    drawQueue.push({
      type: 'moon',
      camZ: moonProj.camZ,
      sx: moonProj.sx,
      sy: moonProj.sy,
      r: moonScreenR
    });

    // ピン留め天体（太陽中心の公転軌道上の位置に固定表示）
    const pinBadgePositions = [];
    state.pinnedSnapshots.forEach((pin, idx) => {
      const pinEarthWorld = {
        x: -pin.sunDirEcl.x * EARTH_ORBIT_R,
        y: -pin.sunDirEcl.y * EARTH_ORBIT_R,
        z: 0
      };
      const anchorEarth = pinEarthWorld;
      const pinMoonWorld = {
        x: anchorEarth.x + pin.moonDirEcl.x * MOON_ORBIT_R,
        y: anchorEarth.y + pin.moonDirEcl.y * MOON_ORBIT_R,
        z: anchorEarth.z + pin.moonDirEcl.z * MOON_ORBIT_R
      };
      const pEarthProj = projectWorldPoint(anchorEarth, camTarget, centerX, centerY, baseScale);
      const pMoonProj = projectWorldPoint(pinMoonWorld, camTarget, centerX, centerY, baseScale);
      const pMoonR = Math.max(8, MOON_WORLD_R * pMoonProj.scale * 0.92);
      const pEarthR = Math.max(14, EARTH_WORLD_R * pEarthProj.scale * 0.92);
      const pinLightCam = rotateVecToCam(pin.sunDirEcl);

      const earthDist = Math.hypot(pEarthProj.sx - earthProj.sx, pEarthProj.sy - earthProj.sy);
      if (earthDist > 12) {
        drawQueue.push({
          type: 'pin-earth',
          camZ: pEarthProj.camZ - 0.1,
          sx: pEarthProj.sx,
          sy: pEarthProj.sy,
          r: pEarthR,
          lightCam: pinLightCam,
          spaceState: pin.spaceState
        });
      }

      drawQueue.push({
        type: 'pin-moon',
        camZ: pMoonProj.camZ - 0.05,
        sx: pMoonProj.sx,
        sy: pMoonProj.sy,
        r: pMoonR,
        lightCam: pinLightCam,
        anchorSx: pEarthProj.sx,
        anchorSy: pEarthProj.sy
      });

      pinBadgePositions.push({
        idx,
        pin,
        sx: pMoonProj.sx,
        sy: pMoonProj.sy + pMoonR + 6
      });
    });

    // Zソート（奥 -> 手前）
    drawQueue.sort((a, b) => a.camZ - b.camZ);

    for (const item of drawQueue) {
      if (item.type === 'sun') {
        const sunSpinTotal = spaceState.sunSpinAngleDeg + state.sunVisualSpinOffsetDeg;
        drawFlatSun(ctx, item.sx, item.sy, item.r, sunSpinTotal);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☀️ 太陽', item.sx, item.sy + item.r + 16);
      } else if (item.type === 'earth') {
        drawFlatEarth(ctx, item.sx, item.sy, item.r, sunDirCam, spaceState, false);

        // 📍 佐伯（観測地点）ピンとラベル・ズームイン時の観測ガイド描画
        if (saikiVecCam.z >= -0.25) {
          const isFront = saikiVecCam.z >= 0;
          ctx.save();
          ctx.globalAlpha = isFront ? 1.0 : 0.45;
          const pinRadius = clamp(item.r * 0.12, 4.5, 11);
          ctx.beginPath();
          ctx.arc(saikiScreenX, saikiScreenY, pinRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // 佐伯・観測地点の接平面地平線・東/西ガイド（拡大時）
          if ((isEarthCloseup || item.r >= 45) && isFront) {
            const obsRad = rad(spaceState.lmstDeg);
            const epsR = rad(spaceState.epsDeg);
            const eqEast = { x: -Math.sin(obsRad), y: Math.cos(obsRad), z: 0 };
            const eclEast = {
              x: eqEast.x,
              y: eqEast.y * Math.cos(epsR) + eqEast.z * Math.sin(epsR),
              z: -eqEast.y * Math.sin(epsR) + eqEast.z * Math.cos(epsR)
            };
            const camEast = rotateVecToCam(eclEast);
            const tLen = Math.hypot(camEast.x, camEast.y);
            if (tLen > 0.15) {
              const guideLen = Math.min(72, item.r * 0.62);
              const ex = (camEast.x / tLen) * guideLen;
              const ey = -(camEast.y / tLen) * guideLen;
              ctx.strokeStyle = item.r >= 85 ? '#4ade80' : 'rgba(255, 255, 255, 0.78)';
              ctx.lineWidth = item.r >= 85 ? 2.4 : 1.5;
              ctx.beginPath();
              ctx.moveTo(saikiScreenX - ex, saikiScreenY - ey);
              ctx.lineTo(saikiScreenX + ex, saikiScreenY + ey);
              ctx.stroke();
              ctx.fillStyle = '#fef08a';
              ctx.font = 'bold 10px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('東', saikiScreenX + ex * 1.24, saikiScreenY + ey * 1.24 + 3);
              ctx.fillText('西', saikiScreenX - ex * 1.24, saikiScreenY - ey * 1.24 + 3);
            }

            // 佐伯から月への方向矢印（大きくズームインして月が画面外にあるときでも向きを明示）
            if (item.r >= 85) {
              const mdx = moonProj.sx - saikiScreenX;
              const mdy = moonProj.sy - saikiScreenY;
              const mDist = Math.hypot(mdx, mdy);
              if (mDist > 40) {
                const mux = mdx / mDist;
                const muy = mdy / mDist;
                const arrowLen = Math.min(95, mDist * 0.55);
                const ax = saikiScreenX + mux * arrowLen;
                const ay = saikiScreenY + muy * arrowLen;
                ctx.beginPath();
                ctx.moveTo(saikiScreenX + mux * (pinRadius + 4), saikiScreenY + muy * (pinRadius + 4));
                ctx.lineTo(ax, ay);
                ctx.strokeStyle = moonAboveHorizon ? '#fde047' : '#94a3b8';
                ctx.lineWidth = 2.4;
                ctx.stroke();

                const head = 8;
                const px = -muy;
                const py = mux;
                ctx.fillStyle = moonAboveHorizon ? '#fde047' : '#94a3b8';
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax - mux * head + px * 4.5, ay - muy * head + py * 4.5);
                ctx.lineTo(ax - mux * head - px * 4.5, ay - muy * head - py * 4.5);
                ctx.closePath();
                ctx.fill();

                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(
                  moonAboveHorizon ? `🌙 月の方向 (${spaceState.phaseInfo.name})` : '🌙 月は地球の裏側',
                  ax + mux * 12,
                  ay + muy * 12 - 6
                );
              }
            }
          }

          // 佐伯ラベルチップ
          const shortName = getShortObserverName(obs.name);
          ctx.font = 'bold 11px sans-serif';
          const tw = ctx.measureText(shortName).width;
          const lx = saikiScreenX + 12;
          const ly = saikiScreenY - 18;
          ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
          ctx.fillRect(lx - 4, ly - 10, tw + 8, 15);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(lx - 4, ly - 10, tw + 8, 15);
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(shortName, lx, ly + 1);
          ctx.restore();
        }

        // 「🌍 地球」ラベル
        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🌍 地球', item.sx, item.sy + item.r + 16);
      } else if (item.type === 'moon') {
        drawFlatMoon(ctx, item.sx, item.sy, item.r, sunDirCam, false);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🌙 月 (${spaceState.phaseInfo.name})`, item.sx, item.sy - item.r - 7);
      } else if (item.type === 'pin-earth') {
        drawFlatEarth(ctx, item.sx, item.sy, item.r, item.lightCam, item.spaceState, true);
      } else if (item.type === 'pin-moon') {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(item.anchorSx, item.anchorSy);
        ctx.lineTo(item.sx, item.sy);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawFlatMoon(ctx, item.sx, item.sy, item.r, item.lightCam, true);
      }
    }

    // 8. ドラッグ操作中のリアルタイム案内バッジ（画面上部中央）
    if (state.activeDragLabel) {
      ctx.save();
      ctx.font = 'bold 13px sans-serif';
      const wTxt = ctx.measureText(state.activeDragLabel).width + 24;
      const bx = width / 2 - wTxt / 2;
      const by = 14;
      ctx.fillStyle = 'rgba(37, 99, 235, 0.92)';
      ctx.fillRect(bx, by, wTxt, 28);
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, wTxt, 28);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(state.activeDragLabel, width / 2, by + 19);
      ctx.restore();
    }

    ctx.restore();

    // ピン留めHTMLバッジの位置同期
    renderPinnedBadges(pinBadgePositions);

    // ヒット判定用の最新スクリーン座標を保持
    state.lastProjected = {
      sun: { sx: sunProj.sx, sy: sunProj.sy, r: sunScreenR, camZ: sunProj.camZ },
      earth: { sx: earthProj.sx, sy: earthProj.sy, r: earthScreenR, camZ: earthProj.camZ },
      moon: { sx: moonProj.sx, sy: moonProj.sy, r: moonScreenR, camZ: moonProj.camZ }
    };
  }

  // --- ピン留め（天体をのこす）管理 ---
  function getPinKey(dateObj) {
    return `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}-${dateObj.getHours()}-${dateObj.getMinutes()}`;
  }

  function addPinnedSnapshot(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return;
    const key = getPinKey(dateObj);
    if (state.pinnedSnapshots.some(p => p.key === key)) return;

    if (state.pinnedSnapshots.length >= 6) {
      state.pinnedSnapshots.shift();
    }

    const sp = AstroCalc.getSpaceState(dateObj);
    state.pinnedSnapshots.push({
      key,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      day: dateObj.getDate(),
      hour: dateObj.getHours(),
      minute: dateObj.getMinutes(),
      sunDirEcl: sp.sunDirEcl,
      moonDirEcl: sp.moonDirEcl,
      elongation: sp.moonPos.elongation,
      phaseName: sp.phaseInfo.name,
      ageFormatted: sp.phaseInfo.ageFormatted,
      spaceState: sp
    });

    updateSimulation(false);
  }

  function renderPinnedBadges(positions) {
    if (!elements.pinnedBadgesLayer) return;
    elements.pinnedBadgesLayer.innerHTML = '';

    if (elements.btnClearPins) {
      elements.btnClearPins.style.display = state.pinnedSnapshots.length > 0 ? 'flex' : 'none';
    }

    positions.forEach(({ idx, pin, sx, sy }) => {
      const hText = state.use24Hour
        ? `${pin.hour}時`
        : `${pin.hour >= 12 ? '午後' : '午前'}${pin.hour % 12 === 0 ? 12 : pin.hour % 12}時`;

      const tag = document.createElement('div');
      tag.className = 'pinned-space-tag';
      tag.style.left = `${sx}px`;
      tag.style.top = `${sy}px`;
      tag.innerHTML = `
        <span>#${idx + 1} ${pin.month}/${pin.day} ${hText} (${pin.phaseName})</span>
        <button type="button" class="btn-remove-pin" title="のこした天体を消す">×</button>
      `;

      tag.querySelector('.btn-remove-pin').addEventListener('click', (e) => {
        e.stopPropagation();
        state.pinnedSnapshots.splice(idx, 1);
        updateSimulation(false);
      });

      elements.pinnedBadgesLayer.appendChild(tag);
    });
  }

  // --- ベタ塗り月のSVG生成（佐伯からの見え方：グラデーション・クレーターなし・滑らかな満ち欠け） ---
  function renderMoonSVG(elongation, angleToSun = null, isModal = false, customRadius = null) {
    const radius = customRadius !== null ? customRadius : (isModal ? 54 : 26);
    const size = radius * 2 + 8;
    const cx = size / 2;
    const cy = size / 2;

    let elong = elongation % 360;
    if (elong < 0) elong += 360;

    const cosE = Math.cos((elong * Math.PI) / 180.0);
    const isWaxing = elong <= 180;
    const rx = Math.abs(cosE) * radius;
    const lightFill = '#fde047';
    let lightPath = '';

    const cxS = cx.toFixed(2);
    const topY = (cy - radius).toFixed(2);
    const botY = (cy + radius).toFixed(2);
    const rS = radius.toFixed(2);
    const rxS = rx.toFixed(2);

    if (elong < 1.0 || elong > 359.0) {
      lightPath = '';
    } else if (Math.abs(elong - 180) < 1.5) {
      lightPath = `<circle cx="${cxS}" cy="${cy.toFixed(2)}" r="${rS}" fill="${lightFill}" />`;
    } else if (isWaxing) {
      if (rx < 0.25) {
        lightPath = `<path d="M ${cxS} ${topY} A ${rS} ${rS} 0 0 1 ${cxS} ${botY} L ${cxS} ${topY} Z" fill="${lightFill}" />`;
      } else if (cosE > 0) {
        lightPath = `<path d="M ${cxS} ${topY} A ${rS} ${rS} 0 0 1 ${cxS} ${botY} A ${rxS} ${rS} 0 0 0 ${cxS} ${topY} Z" fill="${lightFill}" />`;
      } else {
        lightPath = `<path d="M ${cxS} ${topY} A ${rS} ${rS} 0 0 1 ${cxS} ${botY} A ${rxS} ${rS} 0 0 1 ${cxS} ${topY} Z" fill="${lightFill}" />`;
      }
    } else {
      if (rx < 0.25) {
        lightPath = `<path d="M ${cxS} ${botY} A ${rS} ${rS} 0 0 1 ${cxS} ${topY} L ${cxS} ${botY} Z" fill="${lightFill}" />`;
      } else if (cosE < 0) {
        lightPath = `<path d="M ${cxS} ${botY} A ${rS} ${rS} 0 0 1 ${cxS} ${topY} A ${rxS} ${rS} 0 0 1 ${cxS} ${botY} Z" fill="${lightFill}" />`;
      } else {
        lightPath = `<path d="M ${cxS} ${botY} A ${rS} ${rS} 0 0 1 ${cxS} ${topY} A ${rxS} ${rS} 0 0 0 ${cxS} ${botY} Z" fill="${lightFill}" />`;
      }
    }

    let rotateDeg = 0;
    if (!isModal && angleToSun !== null) {
      const sunAngleDeg = (angleToSun * 180.0) / Math.PI;
      rotateDeg = isWaxing ? sunAngleDeg : sunAngleDeg - 180.0;
      while (rotateDeg > 180) rotateDeg -= 360;
      while (rotateDeg < -180) rotateDeg += 360;
      rotateDeg = clamp(rotateDeg, -22, 22);
    }

    const styleAttr = rotateDeg !== 0 ? ` style="transform: rotate(${rotateDeg.toFixed(1)}deg);"` : '';
    const southFlipAttr = AstroCalc.getObserver().lat < 0 ? ` transform="translate(${size}, 0) scale(-1, 1)"` : '';
    return `
      <svg viewBox="0 0 ${size} ${size}" class="moon-svg"${styleAttr}>
        <g${southFlipAttr}>
          <circle cx="${cxS}" cy="${cy.toFixed(2)}" r="${rS}" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
          ${lightPath}
        </g>
      </svg>
    `;
  }

  // --- 佐伯のミニ空SVG（東・南・西） ---
  function renderSaikiSkySVG(sunPos, moonPos) {
    const W = 180;
    const H = 62;
    const horizonY = 48;
    const skyTopY = 8;
    const AZ_MIN = 75;
    const AZ_SPAN = 210;

    const mapX = (sAz) => clamp(((sAz - AZ_MIN) / AZ_SPAN) * W, 10, W - 10);
    const mapY = (alt) => {
      if (alt >= 0) {
        const dome = 0.35 * alt + 0.65 * 90.0 * Math.sin((alt * Math.PI) / 180.0);
        return horizonY - (dome / 90.0) * (horizonY - skyTopY);
      }
      return Math.min(H - 5, horizonY + (Math.abs(alt) / 90.0) * 12);
    };

    // 空のベタ塗り色（昼・夕方/朝・夜）
    let skyColor = '#020617';
    if (sunPos.alt > 10) skyColor = '#2563eb';
    else if (sunPos.alt > -6) skyColor = '#c2410c';

    const sx = mapX(sunPos.screenAz);
    const sy = mapY(sunPos.alt);
    const mx = mapX(moonPos.screenAz);
    const my = mapY(moonPos.alt);

    const sunMark = sunPos.alt >= -2
      ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5.5" fill="#fde047" stroke="#f59e0b" stroke-width="1.5" />`
      : '';
    const moonBelow = moonPos.alt < 0;
    const moonMark = moonBelow
      ? `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="none" stroke="#fde047" stroke-width="1.4" stroke-dasharray="2,2" />`
      : `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="6" fill="#fde047" stroke="#0f172a" stroke-width="1" />`;

    return `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%">
        <rect x="0" y="0" width="${W}" height="${horizonY}" fill="${skyColor}" />
        <path d="M 10 ${horizonY} Q ${W / 2} ${skyTopY} ${W - 10} ${horizonY}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.2" stroke-dasharray="3,3" />
        <rect x="0" y="${horizonY}" width="${W}" height="${H - horizonY}" fill="#14532d" />
        <line x1="0" y1="${horizonY}" x2="${W}" y2="${horizonY}" stroke="#4ade80" stroke-width="1.8" />
        ${sunMark}
        ${moonMark}
      </svg>
    `;
  }

  // --- ミニ宇宙図SVG（太陽の光・地球・佐伯・月の位置関係、モーダル＆比較用、ベタ塗り） ---
  function renderMiniSpaceDiagramSVG(dateObj) {
    const sp = AstroCalc.getSpaceState(dateObj);
    const W = 230;
    const H = 120;
    const cx = 102;
    const cy = H / 2;
    const earthR = 17;
    const orbitR = 44;
    const moonR = 8;

    // 太陽光を右から左へ固定（地球・月の光る側を常に右半分にベタ塗りして直感的に比較）
    const elongRad = rad(sp.moonElongationDeg);
    const mx = cx + orbitR * Math.cos(-elongRad);
    const my = cy + orbitR * Math.sin(-elongRad);

    // 佐伯の位置（地球上で太陽方向からの時角反時計回り）
    const saikiRad = rad(sp.earthSpinAngleDeg);
    const sx = cx + earthR * Math.cos(-saikiRad);
    const sy = cy + earthR * Math.sin(-saikiRad);

    // 視線ライン（観測地点→月）
    const obsName = getShortObserverName(AstroCalc.getObserver().name);

    return `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="100%">
        <rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="#020617" />
        <!-- 太陽光矢印（右から左） -->
        <line x1="${W - 8}" y1="26" x2="${W - 34}" y2="26" stroke="#fde047" stroke-width="2" />
        <polygon points="${W - 38},26 ${W - 30},22 ${W - 30},30" fill="#fde047" />
        <line x1="${W - 8}" y1="60" x2="${W - 34}" y2="60" stroke="#fde047" stroke-width="2" />
        <polygon points="${W - 38},60 ${W - 30},56 ${W - 30},64" fill="#fde047" />
        <line x1="${W - 8}" y1="94" x2="${W - 34}" y2="94" stroke="#fde047" stroke-width="2" />
        <polygon points="${W - 38},94 ${W - 30},90 ${W - 30},98" fill="#fde047" />
        <text x="${W - 6}" y="14" fill="#fde047" font-size="9.5" font-weight="bold" text-anchor="end">☀️ 太陽の光 ◀</text>

        <!-- 地球が太陽のまわりを回る公転軌道ガイド -->
        <path d="M ${cx + 6} 4 Q ${cx - 6} ${cy} ${cx + 6} ${H - 4}" fill="none" stroke="rgba(56,189,248,0.34)" stroke-width="1.3" stroke-dasharray="3,4" />
        <!-- 月の公転軌道 -->
        <circle cx="${cx}" cy="${cy}" r="${orbitR}" fill="none" stroke="rgba(250,204,21,0.35)" stroke-width="1.3" stroke-dasharray="3,3" />
        <!-- 佐伯→月の視線 -->
        <line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="rgba(125,211,252,0.7)" stroke-width="1.2" stroke-dasharray="2.5,2.5" />

        <!-- 地球（右半分：昼 #38bdf8、左半分：夜 #0f172a） -->
        <path d="M ${cx} ${cy - earthR} A ${earthR} ${earthR} 0 0 1 ${cx} ${cy + earthR} Z" fill="#38bdf8" />
        <path d="M ${cx} ${cy - earthR} A ${earthR} ${earthR} 0 0 0 ${cx} ${cy + earthR} Z" fill="#0f172a" />
        <circle cx="${cx}" cy="${cy}" r="${earthR}" fill="none" stroke="#7dd3fc" stroke-width="1.5" />

        <!-- 佐伯ピン -->
        <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3.6" fill="#ef4444" stroke="#ffffff" stroke-width="1.2" />
        <text x="${cx}" y="${H - 5}" fill="#bae6fd" font-size="9" font-weight="bold" text-anchor="middle">赤点：${obsName}</text>

        <!-- 月（右半分：光 #fde047、左半分：影 #1e293b） -->
        <path d="M ${mx.toFixed(1)} ${(my - moonR).toFixed(1)} A ${moonR} ${moonR} 0 0 1 ${mx.toFixed(1)} ${(my + moonR).toFixed(1)} Z" fill="#fde047" />
        <path d="M ${mx.toFixed(1)} ${(my - moonR).toFixed(1)} A ${moonR} ${moonR} 0 0 0 ${mx.toFixed(1)} ${(my + moonR).toFixed(1)} Z" fill="#1e293b" />
        <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${moonR}" fill="none" stroke="#facc15" stroke-width="1.2" />
        <text x="${mx.toFixed(1)}" y="${(my - moonR - 3).toFixed(1)}" fill="#fef08a" font-size="8.5" font-weight="bold" text-anchor="middle">月</text>
      </svg>
    `;
  }

  // --- 時刻表記フォーマット ---
  function formatEventTime(hhmmStr) {
    if (!hhmmStr) return '--:--';
    if (!hhmmStr.includes(':')) return hhmmStr;
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

  // --- 日時UIの更新とドロップダウン同期 ---
  function updateDayOptions(year, month, keepDay) {
    const maxDays = new Date(year, month, 0).getDate();
    const prevVal = keepDay !== undefined ? keepDay : (parseInt(elements.selectDay.value, 10) || 1);
    const clampedDay = clamp(prevVal, 1, maxDays);

    elements.selectDay.innerHTML = '';
    for (let d = 1; d <= maxDays; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `${d}日`;
      elements.selectDay.appendChild(opt);
    }
    elements.selectDay.value = String(clampedDay);
  }

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

  function updateDateTimeUI(dt) {
    if (!dt || isNaN(dt.getTime())) return;
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    elements.dateDisplay.textContent = `${year}年 ${month}月 ${day}日 (${dayNames[dt.getDay()]})`;

    const h24 = dt.getHours();
    const mStr = String(dt.getMinutes()).padStart(2, '0');
    const isPm = h24 >= 12;

    if (state.use24Hour) {
      elements.ampmBadge.style.display = 'none';
      elements.timeDigits.textContent = `${String(h24).padStart(2, '0')} : ${mStr}`;
      elements.btnTimeFormat.textContent = '午前/午後';
      elements.btnTimeFormat.classList.add('active-24h');
      elements.timelineTicks.innerHTML = '<span>0時</span><span>6時</span><span>12時</span><span>18時</span><span>24時</span>';
    } else {
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      elements.ampmBadge.style.display = '';
      elements.ampmBadge.textContent = isPm ? '午後' : '午前';
      elements.ampmBadge.className = `ampm-badge ${isPm ? 'pm' : 'am'}`;
      elements.timeDigits.textContent = `${h12} : ${mStr}`;
      elements.btnTimeFormat.textContent = '24h表示';
      elements.btnTimeFormat.classList.remove('active-24h');
      elements.timelineTicks.innerHTML = '<span>0時</span><span>6時</span><span>正午</span><span>18時</span><span>24時</span>';
    }

    if (!elements.datetimeDropdown.classList.contains('active')) {
      syncDropdownValues(dt);
    }
  }

  function initDropdownSelectors() {
    elements.selectYear.innerHTML = '';
    for (let y = 2024; y <= 2030; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y}年`;
      elements.selectYear.appendChild(opt);
    }
    elements.selectMonth.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `${m}月`;
      elements.selectMonth.appendChild(opt);
    }
    updateDayOptions(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, state.currentDate.getDate());
    updateHourSelectOptions();

    elements.selectMinute.innerHTML = '';
    for (let m = 0; m < 60; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = `${String(m).padStart(2, '0')}分`;
      elements.selectMinute.appendChild(opt);
    }
    syncDropdownValues(state.currentDate);
  }

  // --- メインシミュレーション更新 ---
  let lastCheckedDateStr = '';
  let lastDailyEvents = null;

  function updateSimulation(forceRefreshEvents = false) {
    const dt = state.currentDate;
    if (!dt || isNaN(dt.getTime())) {
      state.currentDate = new Date();
      return updateSimulation(true);
    }

    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const hours = dt.getHours();
    const minutes = dt.getMinutes();
    const dateStr = `${year}-${month}-${day}`;

    updateDateTimeUI(dt);

    if (dateStr !== lastCheckedDateStr || forceRefreshEvents || !lastDailyEvents) {
      lastCheckedDateStr = dateStr;
      lastDailyEvents = AstroCalc.getDailyEvents(year, month, day);
    }
    updateAstroEventsUI(lastDailyEvents);

    const spaceState = AstroCalc.getSpaceState(dt);
    const { sunPos, moonPos, phaseInfo } = spaceState;
    const obs = AstroCalc.getObserver();

    // 左上カード（佐伯・観測地点からの見え方）の更新
    const shortLoc = getShortObserverName(obs.name);
    if (elements.observerCardTitle) {
      elements.observerCardTitle.textContent = `👀 「${obs.name}」から見た月`;
    }
    if (elements.observerTimezonePill) {
      elements.observerTimezonePill.textContent = spaceState.observerTimeZoneLabel;
    }
    if (elements.legendObserverName) {
      elements.legendObserverName.textContent = shortLoc;
    }
    if (elements.skyDirCenter) {
      elements.skyDirCenter.textContent = obs.lat < 0 ? '北' : '南';
    }

    // 満ち欠けを1日周期の傾き揺れなしで滑らかに表示する（angleToSun = null）
    if (elements.saikiMoonSvg) {
      elements.saikiMoonSvg.innerHTML = renderMoonSVG(moonPos.elongation, null, false, 26);
    }
    if (elements.saikiMoonName) {
      elements.saikiMoonName.textContent = phaseInfo.name;
    }
    if (elements.saikiMoonSub) {
      elements.saikiMoonSub.textContent = `月齢 ${phaseInfo.ageFormatted}・光る ${Math.round(moonPos.phaseFraction * 100)}%`;
    }
    if (elements.saikiSkySvg) {
      elements.saikiSkySvg.innerHTML = renderSaikiSkySVG(sunPos, moonPos);
    }

    const isVisible = moonPos.rawAlt >= 0;
    if (elements.saikiMoonStatus) {
      elements.saikiMoonStatus.textContent = isVisible ? '地上に見えている' : '地平線の下（地球の裏側）';
      elements.saikiMoonStatus.className = isVisible ? 'moon-status-tag' : 'moon-status-tag underground';
    }

    // 右上カード内の月バッジ更新
    elements.moonAgeText.textContent = `月齢 ${phaseInfo.ageFormatted}`;
    elements.moonShapeName.textContent = phaseInfo.name;
    elements.moonAltitudeStatus.textContent = isVisible ? '地上' : '地平線の下';
    elements.moonAltitudeStatus.className = isVisible ? 'moon-status-tag' : 'moon-status-tag underground';

    // スライダー同期
    elements.timeSlider.value = hours * 60 + minutes;

    // 宇宙3Dキャンバス再描画
    drawSpaceScene(spaceState);
  }

  // --- アニメーションループ ---
  function animationLoop(timestamp) {
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const deltaMs = Math.min(100, timestamp - state.lastTimestamp);
    state.lastTimestamp = timestamp;

    if (state.isPlaying) {
      const minutesToAdd = (deltaMs / 1000.0) * state.playSpeedMinutesPerSec;
      state.currentDate = new Date(state.currentDate.getTime() + minutesToAdd * 60 * 1000);
      updateSimulation();
    }
    requestAnimationFrame(animationLoop);
  }

  // ==========================================================================
  // 観測地点設定（カテゴリタブ式モーダル：小学校・中学校・佐伯市・大分県・九州・その他・海外）
  // ==========================================================================
  function formatCoord(val) {
    return Number(val).toFixed(4).replace(/00$/, '');
  }

  function formatLatLonJP(lat, lon) {
    const latLabel = lat >= 0 ? `北緯${Math.abs(lat).toFixed(2)}°` : `南緯${Math.abs(lat).toFixed(2)}°`;
    const lonLabel = lon >= 0 ? `東経${Math.abs(lon).toFixed(2)}°` : `西経${Math.abs(lon).toFixed(2)}°`;
    return `${latLabel}, ${lonLabel}`;
  }

  const LOCATION_CATEGORY_DESCS = {
    elementary: '佐伯市内の小学校（全15校・義務教育学校を含む）から観測地点を選べます。',
    junior_high: '佐伯市内の中学校（全11校・義務教育学校を含む）から観測地点を選べます。',
    saiki: '佐伯市の代表地点や、9つの地域（佐伯・上浦・弥生・本匠・宇目・直川・鶴見・米水津・蒲江）から選べます。',
    oita: '大分県内すべての市町村（全18市町村）から観測地点を選べます。',
    kyushu: '九州・沖縄地方の各県庁所在地（全8都市）から観測地点を選べます。',
    other: '日本の北（北海道）から南（石垣島）までの主要都市を選べます。',
    overseas: 'こっそり世界中の特別な場所へ！ノルウェーの白夜・極夜や南極点、南半球での月の見え方の違いを確かめられます（※時刻は日本時間）。'
  };

  const LOCATIONS_DATA = {
    elementary: [
      { id: 'el-umeryokuho', name: '佐伯市立宇目緑豊小学校', lat: 32.8571, lon: 131.6733, badge: '宇目' },
      { id: 'el-shinonome', name: '佐伯市立東雲小学校', lat: 33.0465, lon: 131.9257, badge: '上浦' },
      { id: 'el-yahata', name: '佐伯市立八幡小学校', lat: 33.0035, lon: 131.8919, badge: '佐伯' },
      { id: 'el-saikihigashi', name: '佐伯市立佐伯東小学校', lat: 32.9648, lon: 131.8985, badge: '佐伯' },
      { id: 'el-saiki', name: '佐伯市立佐伯小学校', lat: 32.9577, lon: 131.8929, badge: '佐伯' },
      { id: 'el-tomachidai', name: '佐伯市立渡町台小学校', lat: 32.9584, lon: 131.9085, badge: '佐伯' },
      { id: 'el-tsuruoka', name: '佐伯市立鶴岡小学校', lat: 32.9609, lon: 131.8749, badge: '佐伯' },
      { id: 'el-kirihata', name: '佐伯市立切畑小学校', lat: 32.9534, lon: 131.8381, badge: '弥生' },
      { id: 'el-kamino', name: '佐伯市立上野小学校', lat: 32.9704, lon: 131.8340, badge: '弥生' },
      { id: 'el-meiji', name: '佐伯市立明治小学校', lat: 32.9819, lon: 131.8495, badge: '弥生' },
      { id: 'el-honjo', name: '佐伯市立本匠小学校', lat: 32.9555, lon: 131.8025, badge: '本匠' },
      { id: 'el-naokawa', name: '佐伯市立直川小学校', lat: 32.8978, lon: 131.7767, badge: '直川' },
      { id: 'el-yonouzu', name: '佐伯市立米水津小学校', lat: 32.9219, lon: 131.9798, badge: '米水津' },
      { id: 'el-matsuura', name: '佐伯市立松浦小学校', lat: 32.9454, lon: 131.9614, badge: '鶴見' },
      { id: 'el-kamaeshonan', name: '佐伯市立蒲江翔南学園', lat: 32.8030, lon: 131.9430, badge: '蒲江・義務教育学校' }
    ],
    junior_high: [
      { id: 'jh-yonouzu', name: '佐伯市立米水津中学校', lat: 32.9228, lon: 131.9765, badge: '米水津' },
      { id: 'jh-tsurumi', name: '佐伯市立鶴見中学校', lat: 32.9317, lon: 131.9922, badge: '鶴見' },
      { id: 'jh-umeryokuho', name: '佐伯市立宇目緑豊中学校', lat: 32.8576, lon: 131.6745, badge: '宇目' },
      { id: 'jh-naokawa', name: '佐伯市立直川中学校', lat: 32.8992, lon: 131.7781, badge: '直川' },
      { id: 'jh-honjo', name: '佐伯市立本匠中学校', lat: 32.9562, lon: 131.8008, badge: '本匠' },
      { id: 'jh-shinonome', name: '佐伯市立東雲中学校', lat: 33.0468, lon: 131.9255, badge: '上浦' },
      { id: 'jh-showa', name: '佐伯市立昭和中学校', lat: 32.9815, lon: 131.8550, badge: '弥生' },
      { id: 'jh-hikoyo', name: '佐伯市立彦陽中学校', lat: 32.9992, lon: 131.8942, badge: '佐伯' },
      { id: 'jh-tsuruya', name: '佐伯市立鶴谷中学校', lat: 32.9542, lon: 131.8915, badge: '佐伯' },
      { id: 'jh-saikijonan', name: '佐伯市立佐伯城南中学校', lat: 32.9598, lon: 131.8995, badge: '佐伯' },
      { id: 'jh-saikiminami', name: '佐伯市立佐伯南中学校', lat: 32.9540, lon: 131.8705, badge: '佐伯' },
      { id: 'jh-kamaeshonan', name: '佐伯市立蒲江翔南学園', lat: 32.8030, lon: 131.9430, badge: '蒲江・義務教育学校' }
    ],
    saiki: [
      { id: 'saiki-default', name: '大分県佐伯市', lat: 32.9600, lon: 131.9000, badge: '初期設定・代表地点' },
      { id: 'saiki-center', name: '佐伯市 佐伯地区（中心部）', lat: 32.9602, lon: 131.8997, badge: '市役所周辺' },
      { id: 'saiki-kamiura', name: '佐伯市 上浦地区', lat: 33.0450, lon: 131.9210, badge: '豊後二見ヶ浦' },
      { id: 'saiki-yayoi', name: '佐伯市 弥生地区', lat: 32.9710, lon: 131.8450, badge: '道の駅やよい周辺' },
      { id: 'saiki-honjo-area', name: '佐伯市 本匠地区', lat: 32.9560, lon: 131.8010, badge: '大水車周辺' },
      { id: 'saiki-ume-area', name: '佐伯市 宇目地区', lat: 32.8570, lon: 131.6740, badge: '藤河内・ととろ' },
      { id: 'saiki-naokawa-area', name: '佐伯市 直川地区', lat: 32.8980, lon: 131.7770, badge: '憩の森周辺' },
      { id: 'saiki-tsurumi-area', name: '佐伯市 鶴見地区', lat: 32.9310, lon: 132.0830, badge: '九州最東端・鶴御崎' },
      { id: 'saiki-yonouzu-area', name: '佐伯市 米水津地区', lat: 32.9220, lon: 131.9800, badge: '間越海岸周辺' },
      { id: 'saiki-kamae-area', name: '佐伯市 蒲江地区', lat: 32.7980, lon: 131.9420, badge: '蒲江・離島周辺' }
    ],
    oita: [
      { id: 'oita-saiki-city', name: '大分県佐伯市', lat: 32.96, lon: 131.90, badge: '代表地点' },
      { id: 'oita-oita', name: '大分県大分市', lat: 33.24, lon: 131.61, badge: '県庁所在地' },
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
      { id: 'oita-himeshima', name: '大分県姫島村', lat: 33.73, lon: 131.67, badge: '離島' },
      { id: 'oita-hiji', name: '大分県日出町', lat: 33.37, lon: 131.53 },
      { id: 'oita-kokonoe', name: '大分県九重町', lat: 33.22, lon: 131.19 },
      { id: 'oita-kusu', name: '大分県玖珠町', lat: 33.28, lon: 131.15 }
    ],
    kyushu: [
      { id: 'kyushu-fukuoka', name: '福岡県福岡市', lat: 33.59, lon: 130.40 },
      { id: 'kyushu-saga', name: '佐賀県佐賀市', lat: 33.26, lon: 130.30 },
      { id: 'kyushu-nagasaki', name: '長崎県長崎市', lat: 32.75, lon: 129.88 },
      { id: 'kyushu-kumamoto', name: '熊本県熊本市', lat: 32.80, lon: 130.71 },
      { id: 'kyushu-oita', name: '大分県大分市', lat: 33.24, lon: 131.61 },
      { id: 'kyushu-miyazaki', name: '宮崎県宮崎市', lat: 31.91, lon: 131.42 },
      { id: 'kyushu-kagoshima', name: '鹿児島県鹿児島市', lat: 31.60, lon: 130.56 },
      { id: 'kyushu-naha', name: '沖縄県那覇市', lat: 26.21, lon: 127.68 }
    ],
    other: [
      { id: 'jp-wakkanai', name: '北海道稚内市', lat: 45.42, lon: 141.67, badge: '日本最北端' },
      { id: 'jp-sapporo', name: '北海道札幌市', lat: 43.06, lon: 141.35 },
      { id: 'jp-nemuro', name: '北海道根室市', lat: 43.33, lon: 145.58, badge: '日の出が早い' },
      { id: 'jp-aomori', name: '青森県青森市', lat: 40.82, lon: 140.74 },
      { id: 'jp-sendai', name: '宮城県仙台市', lat: 38.27, lon: 140.87 },
      { id: 'jp-niigata', name: '新潟県新潟市', lat: 37.92, lon: 139.04 },
      { id: 'jp-tokyo', name: '東京都', lat: 35.69, lon: 139.69, badge: '日本の首都' },
      { id: 'jp-yokohama', name: '神奈川県横浜市', lat: 35.44, lon: 139.64 },
      { id: 'jp-kanazawa', name: '石川県金沢市', lat: 36.56, lon: 136.66 },
      { id: 'jp-nagano', name: '長野県長野市', lat: 36.65, lon: 138.18 },
      { id: 'jp-nagoya', name: '愛知県名古屋市', lat: 35.18, lon: 136.91 },
      { id: 'jp-kyoto', name: '京都府京都市', lat: 35.01, lon: 135.77 },
      { id: 'jp-osaka', name: '大阪府大阪市', lat: 34.69, lon: 135.50 },
      { id: 'jp-kobe', name: '兵庫県神戸市', lat: 34.69, lon: 135.19 },
      { id: 'jp-matsue', name: '島根県松江市', lat: 35.47, lon: 133.05 },
      { id: 'jp-okayama', name: '岡山県岡山市', lat: 34.66, lon: 133.92 },
      { id: 'jp-hiroshima', name: '広島県広島市', lat: 34.40, lon: 132.46 },
      { id: 'jp-takamatsu', name: '香川県高松市', lat: 34.34, lon: 134.04 },
      { id: 'jp-matsuyama', name: '愛媛県松山市', lat: 33.84, lon: 132.77 },
      { id: 'jp-kochi', name: '高知県高知市', lat: 33.56, lon: 133.53 },
      { id: 'jp-ishigaki', name: '沖縄県石垣市', lat: 24.34, lon: 124.16, badge: '日本最南・最西端寄り' }
    ],
    overseas: [
      { id: 'w-tromso', name: 'ノルウェー・トロムソ', lat: 69.65, lon: 18.96, badge: '北極圏', note: '夏は白夜（太陽が沈まない）・冬は極夜（太陽が昇らない）' },
      { id: 'w-oslo', name: 'ノルウェー・オスロ', lat: 59.91, lon: 10.75, badge: '北欧', note: '北緯60°近く！夏と冬で昼の長さが大きく変わります' },
      { id: 'w-south-pole', name: '南極点（アムンゼン・スコット基地）', lat: -89.99, lon: 0.00, badge: '南緯90°', note: '半年ずっと昼（白夜）・半年ずっと夜（極夜）！' },
      { id: 'w-syowa', name: '南極・昭和基地', lat: -69.01, lon: 39.58, badge: '日本の南極基地', note: '南半球のため月が北の空に逆向きに見えます' },
      { id: 'w-north-pole', name: '北極点', lat: 89.99, lon: 0.00, badge: '北緯90°', note: '地球のてっぺん！地軸の傾きと昼夜がよく分かります' },
      { id: 'w-singapore', name: 'シンガポール', lat: 1.35, lon: 103.82, badge: '赤道直下', note: '1年中昼と夜の長さがほぼ12時間ずつです' },
      { id: 'w-sydney', name: 'オーストラリア・シドニー', lat: -33.87, lon: 151.21, badge: '南半球', note: '佐伯と季節が逆！月も上下左右さかさまに見えます' },
      { id: 'w-cairns', name: 'オーストラリア・ケアンズ', lat: -16.92, lon: 145.77, badge: '南半球', note: '南緯17°のトロピカルな南半球の空' },
      { id: 'w-hawaii', name: 'ハワイ・マウナケア', lat: 19.82, lon: -155.47, badge: 'すばる望遠鏡', note: '日本の巨大望遠鏡がある太平洋の島' },
      { id: 'w-fairbanks', name: 'アラスカ・フェアバンクス', lat: 64.84, lon: -147.72, badge: 'オーロラの街', note: '北極圏近くの大きな昼夜の変化を観察できます' },
      { id: 'w-london', name: 'イギリス・ロンドン', lat: 51.48, lon: 0.00, badge: '経度0°', note: 'グリニッジ標準時の基準となる本初子午線の街' },
      { id: 'w-cairo', name: 'エジプト・カイロ', lat: 30.04, lon: 31.24, badge: 'ピラミッド', note: '佐伯とほぼ同じ緯度（北緯30°）で時差だけを体験' }
    ]
  };

  let activeLocationCategory = 'elementary';

  function findCategoryByObserver(obs) {
    for (const [catKey, list] of Object.entries(LOCATIONS_DATA)) {
      const matched = list.find(
        item => item.name === obs.name && Math.abs(item.lat - obs.lat) < 0.0005 && Math.abs(item.lon - obs.lon) < 0.0005
      );
      if (matched) return catKey;
    }
    return null;
  }

  function syncLocationInputsFromObserver() {
    const obs = AstroCalc.getObserver();
    if (elements.locationNameText) elements.locationNameText.textContent = obs.name;
    if (elements.inputLocName) elements.inputLocName.value = obs.name;
    if (elements.inputLocLat) elements.inputLocLat.value = formatCoord(obs.lat);
    if (elements.inputLocLon) elements.inputLocLon.value = formatCoord(obs.lon);
    if (elements.locationCurrentBadge) {
      elements.locationCurrentBadge.textContent = `現在：${obs.name} (${formatLatLonJP(obs.lat, obs.lon)})`;
    }
  }

  function renderLocationCategory(category) {
    if (!LOCATIONS_DATA[category]) category = 'elementary';
    activeLocationCategory = category;

    if (elements.locationCategoryTabs) {
      elements.locationCategoryTabs.querySelectorAll('.loc-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
      });
    }
    if (elements.locationCategoryDesc) {
      elements.locationCategoryDesc.textContent = LOCATION_CATEGORY_DESCS[category] || '';
    }
    if (!elements.locationGrid) return;

    const obs = AstroCalc.getObserver();
    const list = LOCATIONS_DATA[category] || [];
    const isWorldTab = category === 'overseas';
    elements.locationGrid.innerHTML = '';

    list.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'loc-item-btn';
      const isSelected =
        item.name === obs.name &&
        Math.abs(item.lat - obs.lat) < 0.0005 &&
        Math.abs(item.lon - obs.lon) < 0.0005;
      if (isSelected) btn.classList.add('selected');

      const badgeHtml = item.badge
        ? `<span class="loc-item-badge${isWorldTab ? ' world-badge' : ''}">${item.badge}</span>`
        : '';
      const noteHtml = item.note ? `<div class="loc-item-note">${item.note}</div>` : '';

      btn.innerHTML = `
        <div class="loc-item-top">
          <span class="loc-item-name">${item.name}</span>
          ${badgeHtml}
        </div>
        <div class="loc-item-meta">${formatLatLonJP(item.lat, item.lon)}</div>
        ${noteHtml}
      `;

      btn.addEventListener('click', () => {
        applyObserverLocation(item.name, item.lat, item.lon);
        closeLocationModal();
      });
      elements.locationGrid.appendChild(btn);
    });
  }

  function openLocationModal() {
    syncLocationInputsFromObserver();
    const matchedCat = findCategoryByObserver(AstroCalc.getObserver());
    renderLocationCategory(matchedCat || activeLocationCategory || 'elementary');
    if (elements.locationModal) {
      elements.locationModal.classList.add('active');
    }
  }

  function closeLocationModal() {
    if (elements.locationModal) {
      elements.locationModal.classList.remove('active');
    }
  }

  function applyObserverLocation(rawName, rawLat, rawLon) {
    const currentObs = AstroCalc.getObserver();
    const parsedLat = parseFloat(rawLat);
    const parsedLon = parseFloat(rawLon);
    const lat = !isNaN(parsedLat) ? clamp(parsedLat, -89.99, 89.99) : currentObs.lat;
    const lon = !isNaN(parsedLon) ? clamp(parsedLon, -180.0, 180.0) : currentObs.lon;
    const trimmedName = (rawName || '').trim();
    const name = trimmedName || formatLatLonJP(lat, lon);

    // 南半球・南極点選択時は地球の裏面（南側）が見えやすいよう自動でカメラ仰角を反転
    if (lat < -20 && state.camera.pitch > 0) {
      state.camera.pitch = (-58 * Math.PI) / 180;
      clearPresetAngleActive();
    } else if (lat >= 0 && state.camera.pitch < 0) {
      state.camera.pitch = (58 * Math.PI) / 180;
      clearPresetAngleActive();
      if (elements.btnViewDiag) elements.btnViewDiag.classList.add('active');
    }

    AstroCalc.setObserver(lat, lon, name);
    syncLocationInputsFromObserver();
    lastCheckedDateStr = '';
    lastDailyEvents = null;
    updateSimulation(true);
  }

  // ==========================================================================
  // 月の拡大モーダル
  // ==========================================================================
  function formatFullDateTimeForModal(dt) {
    if (!dt || isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dow = dayNames[dt.getDay()];
    const h24 = dt.getHours();
    const mStr = String(dt.getMinutes()).padStart(2, '0');
    if (state.use24Hour) {
      return `${y}年 ${m}月 ${d}日 (${dow}) ${String(h24).padStart(2, '0')}:${mStr}`;
    }
    const ampm = h24 >= 12 ? '午後' : '午前';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${y}年 ${m}月 ${d}日 (${dow}) ${ampm}${h12}:${mStr}`;
  }

  function updateModalPinButtonState() {
    if (!elements.btnModalPinMoon) return;
    const key = getPinKey(state.currentDate);
    const alreadyPinned = state.pinnedSnapshots.some(p => p.key === key);
    const countText = state.pinnedSnapshots.length > 0 ? `（現在${state.pinnedSnapshots.length}個）` : '';
    elements.btnModalPinMoon.classList.toggle('is-pinned', alreadyPinned);
    elements.btnModalPinMoon.textContent = alreadyPinned
      ? `✅ 宇宙に残しました${countText}`
      : `📌 この天体を宇宙に残す${countText}`;
  }

  function openMoonModal(preserveExplanationState = false) {
    const dt = state.currentDate;
    const sp = AstroCalc.getSpaceState(dt);
    const { moonPos, phaseInfo } = sp;
    const obs = AstroCalc.getObserver();

    elements.modalMoonDatetime.textContent = formatFullDateTimeForModal(dt);
    elements.modalMoonRuby.textContent = phaseInfo.ruby;
    elements.modalMoonName.textContent = phaseInfo.name;
    elements.modalEarthViewCaption.textContent = `👀 ${obs.name.replace(/^大分県/, '')}から見た形`;
    elements.modalMoonSvg.innerHTML = renderMoonSVG(moonPos.elongation, null, true, 54);
    elements.modalSpaceSvg.innerHTML = renderMiniSpaceDiagramSVG(dt);

    elements.modalMoonAge.textContent = `月齢 ${phaseInfo.ageFormatted}`;
    elements.modalMoonPhase.textContent = `光る割合: ${Math.round(moonPos.phaseFraction * 100)}%`;
    const isVis = moonPos.rawAlt >= 0;
    elements.modalMoonVis.textContent = isVis ? '地上に見えている' : '地平線の下（地球の裏側）';

    let sunRelation = '';
    if (moonPos.elongation >= 70 && moonPos.elongation <= 110) {
      sunRelation = '★太陽の光が右側から当たっているため、地上から見ると「右半分」が明るく光って見えます！';
    } else if (moonPos.elongation >= 170 && moonPos.elongation <= 190) {
      sunRelation = '★地球をはさんで太陽の反対側に月があるため、光が当たっている丸い面全体がこちらを向きます！';
    } else if (moonPos.elongation >= 250 && moonPos.elongation <= 290) {
      sunRelation = '★太陽の光が左側から当たっているため、地上から見ると「左半分」が明るく光って見えます！';
    } else if (moonPos.elongation < 45 || moonPos.elongation > 315) {
      sunRelation = '★月が太陽と同じ方向にあるため、光が当たっている面が太陽側（地球の反対側）を向いています。';
    } else {
      sunRelation = '★宇宙での「太陽・地球・月」の位置関係（離角）によって、光が当たっている場所のうち地球から見える広さが変わります！';
    }

    elements.modalExplanation.innerHTML = `
      <p style="margin-bottom: 6px;"><strong>【見え方の特徴】</strong> ${phaseInfo.desc}</p>
      <p style="color: #fde047;">${sunRelation}</p>
    `;

    if (!preserveExplanationState) {
      elements.modalExplanation.style.display = 'none';
      elements.btnToggleExplanation.classList.remove('opened');
      elements.btnToggleExplanation.innerHTML = '<span>💡 ヒント・解説を見る ▾</span>';
    }

    updateModalPinButtonState();
    elements.moonModal.classList.add('active');
  }

  function closeMoonModal() {
    elements.moonModal.classList.remove('active');
  }

  // ==========================================================================
  // 2つの日時をくらべるモーダル
  // ==========================================================================
  function getCompareEls(side) {
    return side === 'a'
      ? {
          year: elements.compAYear,
          month: elements.compAMonth,
          day: elements.compADay,
          hour: elements.compAHour,
          moonSvg: elements.compAMoonSvg,
          spaceSvg: elements.compASpaceSvg,
          info: elements.compAInfo
        }
      : {
          year: elements.compBYear,
          month: elements.compBMonth,
          day: elements.compBDay,
          hour: elements.compBHour,
          moonSvg: elements.compBMoonSvg,
          spaceSvg: elements.compBSpaceSvg,
          info: elements.compBInfo
        };
  }

  function updateCompareDayOptions(side, year, month, keepDay) {
    const els = getCompareEls(side);
    const maxDays = new Date(year, month, 0).getDate();
    const prev = keepDay !== undefined ? keepDay : (parseInt(els.day.value, 10) || 1);
    const clamped = clamp(prev, 1, maxDays);
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
        opt.textContent = `${h}時(${ampm}${h12})`;
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
    const fixedDt = new Date(y, m - 1, d, h, 0, 0);
    if (side === 'a') state.compareDateA = fixedDt;
    else state.compareDateB = fixedDt;
  }

  function readCompareDate(side) {
    const els = getCompareEls(side);
    const y = parseInt(els.year.value, 10);
    const m = parseInt(els.month.value, 10);
    const maxD = new Date(y, m, 0).getDate();
    const d = clamp(parseInt(els.day.value, 10) || 1, 1, maxD);
    const h = parseInt(els.hour.value, 10) || 0;
    const dt = new Date(y, m - 1, d, h, 0, 0);
    if (side === 'a') state.compareDateA = dt;
    else state.compareDateB = dt;
    return dt;
  }

  function updateCompareCard(side) {
    const els = getCompareEls(side);
    const dt = readCompareDate(side);
    const sp = AstroCalc.getSpaceState(dt);
    const { moonPos, phaseInfo } = sp;
    const events = AstroCalc.getDailyEvents(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());

    els.moonSvg.innerHTML = renderMoonSVG(moonPos.elongation, null, true, 42);
    els.spaceSvg.innerHTML = renderMiniSpaceDiagramSVG(dt);

    const statusBadge = moonPos.rawAlt >= 0 ? '地上に見えている' : '地平線の下（地球の裏側）';
    els.info.innerHTML = `
      <div class="compare-info-title">${phaseInfo.name}（月齢 ${phaseInfo.ageFormatted} / 光る ${Math.round(moonPos.phaseFraction * 100)}%）</div>
      <div class="compare-info-sub">状態: ${statusBadge} (${sp.observerTimeZoneLabel})</div>
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
  // 月齢カレンダーモーダル
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
      elements.calSelectionStatus.textContent = '日付をタップするとその日時に移動';
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
      if (state.calPickedDates.some(p => p.getFullYear() === year && p.getMonth() + 1 === month && p.getDate() === d)) {
        cell.classList.add('is-picked');
      }

      const dayNumClass = dow === 0 ? 'sun' : (dow === 6 ? 'sat' : '');
      const badgeText = getCalendarPhaseShortBadge(phaseInfo.shapeType, moonPos.age);

      cell.innerHTML = `
        <div class="cal-day-top">
          <span class="cal-day-num ${dayNumClass}">${d}</span>
          <span class="cal-age-mini">齢${phaseInfo.ageFormatted}</span>
        </div>
        <div class="cal-moon-icon">${renderMoonSVG(moonPos.elongation, null, true, 14)}</div>
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

  // --- 太陽中心モデルのまま自在にパン・指定位置基準ズームを行うヘルパー ---
  function clampPanBounds() {
    const { width, height } = getViewportSize();
    const usableH = Math.max(280, height - 135);
    const baseScale = (Math.min(width * 0.66, usableH * 0.86) / 460) * state.camera.zoom;
    const orbitRadiusPx = 220 * baseScale;
    const maxPanX = width * 0.48 + orbitRadiusPx;
    const maxPanY = height * 0.48 + orbitRadiusPx;
    state.camera.panX = clamp(state.camera.panX, -maxPanX, maxPanX);
    state.camera.panY = clamp(state.camera.panY, -maxPanY, maxPanY);
  }

  function zoomAroundScreenPoint(newZoom, anchorSx, anchorSy) {
    const { width, height } = getViewportSize();
    const oldZoom = state.camera.zoom;
    const clampedZoom = clamp(newZoom, 0.22, 16.0);
    const ratio = clampedZoom / Math.max(0.001, oldZoom);

    const baseCx = width * 0.5;
    const baseCy = height * 0.52;
    const curSunCenterX = baseCx + state.camera.panX;
    const curSunCenterY = baseCy + state.camera.panY;

    const newSunCenterX = anchorSx - (anchorSx - curSunCenterX) * ratio;
    const newSunCenterY = anchorSy - (anchorSy - curSunCenterY) * ratio;

    state.camera.zoom = clampedZoom;
    state.camera.panX = newSunCenterX - baseCx;
    state.camera.panY = newSunCenterY - baseCy;
    clampPanBounds();
    updateCameraPresetUI();
  }

  function centerCameraOnEarth(targetZoom) {
    const { width, height } = getViewportSize();
    if (targetZoom !== undefined) {
      state.camera.zoom = clamp(targetZoom, 0.22, 16.0);
    }
    const sp = AstroCalc.getSpaceState(state.currentDate);
    const EARTH_ORBIT_R = 148;
    const earthWorld = {
      x: -sp.sunDirEcl.x * EARTH_ORBIT_R,
      y: -sp.sunDirEcl.y * EARTH_ORBIT_R,
      z: 0
    };
    const usableH = Math.max(280, height - 135);
    const baseScale = (Math.min(width * 0.66, usableH * 0.86) / 460) * state.camera.zoom;
    const p = projectWorldPoint(earthWorld, { x: 0, y: 0, z: 0 }, 0, 0, baseScale);
    state.camera.panX = -p.sx;
    state.camera.panY = -p.sy;
    clampPanBounds();
    updateCameraPresetUI();
  }

  // ==========================================================================
  // 宇宙キャンバスでの指ドラッグ操作（1本指：太陽中心での天体公転/視点回転、2本指：太陽系スクロール＆拡大縮小）
  // ==========================================================================
  function setupSpaceCanvasInteractions(setPlayingFn) {
    const canvas = elements.spaceCanvas;
    const activePointers = new Map();
    let activePointerId = null;
    let dragTarget = null; // 'moon' | 'earth' | 'sun' | 'background' | 'two-finger'
    let dragEarthAsSpin = false;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    // 2本指ジェスチャー状態
    let prevTwoMid = null;
    let prevTwoDist = 0;

    // カメラ用開始状態
    let startYaw = 0;
    let startPitch = 0;
    let startPanX = 0;
    let startPanY = 0;

    // 天体回転用累積角
    let startTimeMs = 0;
    let startDateSnapshot = null;
    let startSunSpinOffset = 0;
    let prevAngleRad = 0;
    let cumulativeAngleDeg = 0;

    const DRAG_THRESHOLD_PX = 6;
    const SYNODIC_MONTH_MIN = 29.530588853 * 24 * 60;
    const TROPICAL_YEAR_MIN = 365.2422 * 24 * 60;

    function getPointerCanvasPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    function hitTestTarget(px, py) {
      const proj = state.lastProjected;
      if (!proj) return 'background';

      const candidates = [
        { name: 'moon', data: proj.moon, pad: 18 },
        { name: 'earth', data: proj.earth, pad: 14 },
        { name: 'sun', data: proj.sun, pad: 12 }
      ];
      candidates.sort((a, b) => b.data.camZ - a.data.camZ);

      for (const c of candidates) {
        const dist = Math.hypot(px - c.data.sx, py - c.data.sy);
        if (dist <= c.data.r + c.pad) {
          return c.name;
        }
      }
      return 'background';
    }

    function getPolarAngleAround(px, py, cx, cy) {
      return Math.atan2(-(py - cy), px - cx);
    }

    function unwrapAngleDeltaDeg(newRad, oldRad) {
      let diff = ((newRad - oldRad) * 180.0) / Math.PI;
      while (diff > 180.0) diff -= 360.0;
      while (diff < -180.0) diff += 360.0;
      if (Math.sin(state.camera.pitch) < 0) diff = -diff;
      return diff;
    }

    function getTwoFingerMetrics() {
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      return {
        mid: { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 },
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y)
      };
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const pos = getPointerCanvasPos(e);
      activePointers.set(e.pointerId, pos);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}

      // 2本目の指が触れたら「2本指スクロール＆ピンチ拡大縮小」へ移行（太陽中心のまま操作）
      if (activePointers.size >= 2) {
        dragTarget = 'two-finger';
        activePointerId = null;
        hasMoved = true;
        canvas.classList.add('is-dragging');
        const metrics = getTwoFingerMetrics();
        prevTwoMid = metrics.mid;
        prevTwoDist = metrics.dist;
        state.activeDragLabel = '🖐️ 2本指：太陽系をスクロール ／ ピンチで拡大・縮小';
        updateSimulation();
        return;
      }

      activePointerId = e.pointerId;
      startX = pos.x;
      startY = pos.y;
      hasMoved = false;
      dragTarget = hitTestTarget(pos.x, pos.y);
      dragEarthAsSpin = (state.camera.zoom >= 2.2 && !state.lockHourOnMoonDrag);

      startYaw = state.camera.yaw;
      startPitch = state.camera.pitch;
      startPanX = state.camera.panX;
      startPanY = state.camera.panY;

      startTimeMs = state.currentDate.getTime();
      startDateSnapshot = new Date(startTimeMs);
      startSunSpinOffset = state.sunVisualSpinOffsetDeg;
      cumulativeAngleDeg = 0;

      const proj = state.lastProjected;
      if (dragTarget === 'moon' && proj) {
        prevAngleRad = getPolarAngleAround(pos.x, pos.y, proj.earth.sx, proj.earth.sy);
      } else if (dragTarget === 'earth' && proj) {
        prevAngleRad = dragEarthAsSpin
          ? getPolarAngleAround(pos.x, pos.y, proj.earth.sx, proj.earth.sy)
          : getPolarAngleAround(pos.x, pos.y, proj.sun.sx, proj.sun.sy);
      } else if (dragTarget === 'sun' && proj) {
        prevAngleRad = getPolarAngleAround(pos.x, pos.y, proj.sun.sx, proj.sun.sy);
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!activePointers.has(e.pointerId)) return;
      const pos = getPointerCanvasPos(e);
      activePointers.set(e.pointerId, pos);

      // 2本指ジェスチャー中（太陽系の自由スクロール＋ピンチ拡大縮小）
      if (dragTarget === 'two-finger' && activePointers.size >= 2) {
        const metrics = getTwoFingerMetrics();
        if (prevTwoMid) {
          state.camera.panX += (metrics.mid.x - prevTwoMid.x);
          state.camera.panY += (metrics.mid.y - prevTwoMid.y);
          clampPanBounds();
        }
        if (prevTwoDist >= 12 && metrics.dist >= 12) {
          const ratio = metrics.dist / prevTwoDist;
          zoomAroundScreenPoint(state.camera.zoom * ratio, metrics.mid.x, metrics.mid.y);
        }
        prevTwoMid = metrics.mid;
        prevTwoDist = metrics.dist;
        state.activeDragLabel = '🖐️ 2本指：太陽系をスクロール ／ ピンチで拡大・縮小';
        updateSimulation();
        return;
      }

      if (activePointerId !== e.pointerId || dragTarget === 'two-finger') return;
      const dx = pos.x - startX;
      const dy = pos.y - startY;

      if (!hasMoved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        hasMoved = true;
        canvas.classList.add('is-dragging');
        if (dragTarget !== 'background' && dragTarget !== 'sun') {
          setPlayingFn(false);
        }
      }

      const proj = state.lastProjected;
      if (dragTarget === 'moon' && proj) {
        const curRad = getPolarAngleAround(pos.x, pos.y, proj.earth.sx, proj.earth.sy);
        cumulativeAngleDeg += unwrapAngleDeltaDeg(curRad, prevAngleRad);

        if (state.lockHourOnMoonDrag) {
          const dayDelta = Math.round((cumulativeAngleDeg / 360.0) * 29.530588853);
          const next = new Date(startDateSnapshot);
          next.setDate(startDateSnapshot.getDate() + dayDelta);
          state.currentDate = next;
          state.activeDragLabel = `🌙 月を公転中（時刻固定: ${dayDelta >= 0 ? '+' : ''}${dayDelta}日）`;
        } else {
          const deltaMin = (cumulativeAngleDeg / 360.0) * SYNODIC_MONTH_MIN;
          state.currentDate = new Date(startTimeMs + deltaMin * 60 * 1000);
          state.activeDragLabel = '🌙 月を回転中（地球も太陽のまわりを公転します）';
        }
        updateSimulation();
        if (state.lastProjected) {
          prevAngleRad = getPolarAngleAround(pos.x, pos.y, state.lastProjected.earth.sx, state.lastProjected.earth.sy);
        } else {
          prevAngleRad = curRad;
        }
      } else if (dragTarget === 'earth' && proj) {
        if (dragEarthAsSpin) {
          const curRad = getPolarAngleAround(pos.x, pos.y, proj.earth.sx, proj.earth.sy);
          cumulativeAngleDeg += unwrapAngleDeltaDeg(curRad, prevAngleRad);

          const deltaMin = (cumulativeAngleDeg / 360.0) * 1440.0;
          state.currentDate = new Date(startTimeMs + deltaMin * 60 * 1000);
          state.activeDragLabel = '🌍 地球を自転中（太陽のまわりを公転しながら進みます）';
          updateSimulation();
          if (state.lastProjected) {
            prevAngleRad = getPolarAngleAround(pos.x, pos.y, state.lastProjected.earth.sx, state.lastProjected.earth.sy);
          } else {
            prevAngleRad = curRad;
          }
        } else {
          const curRad = getPolarAngleAround(pos.x, pos.y, proj.sun.sx, proj.sun.sy);
          cumulativeAngleDeg += unwrapAngleDeltaDeg(curRad, prevAngleRad);

          if (state.lockHourOnMoonDrag) {
            const dayDelta = Math.round((cumulativeAngleDeg / 360.0) * 365.2422);
            const next = new Date(startDateSnapshot);
            next.setDate(startDateSnapshot.getDate() + dayDelta);
            state.currentDate = next;
            state.activeDragLabel = `🌍 地球を公転中（時刻固定: ${dayDelta >= 0 ? '+' : ''}${dayDelta}日）`;
          } else {
            const deltaMin = (cumulativeAngleDeg / 360.0) * TROPICAL_YEAR_MIN;
            state.currentDate = new Date(startTimeMs + deltaMin * 60 * 1000);
            state.activeDragLabel = '🌍 地球が太陽のまわりを自転しながら公転しています';
          }
          updateSimulation();
          if (state.lastProjected) {
            prevAngleRad = getPolarAngleAround(pos.x, pos.y, state.lastProjected.sun.sx, state.lastProjected.sun.sy);
          } else {
            prevAngleRad = curRad;
          }
        }
      } else if (dragTarget === 'sun' && proj) {
        const curRad = getPolarAngleAround(pos.x, pos.y, proj.sun.sx, proj.sun.sy);
        cumulativeAngleDeg += unwrapAngleDeltaDeg(curRad, prevAngleRad);
        prevAngleRad = curRad;
        state.sunVisualSpinOffsetDeg = startSunSpinOffset + cumulativeAngleDeg;
        state.activeDragLabel = '☀️ 太陽を回転中（太陽の自転）';
        updateSimulation();
      } else if (dragTarget === 'background') {
        if (state.camera.dragMode === 'rotate') {
          state.camera.yaw = startYaw + dx * 0.007;
          state.camera.pitch = clamp(startPitch + dy * 0.007, (-89 * Math.PI) / 180, (89 * Math.PI) / 180);
          clearPresetAngleActive();
          state.activeDragLabel = '🔄 視点を回転中';
        } else {
          state.camera.panX = startPanX + dx;
          state.camera.panY = startPanY + dy;
          clampPanBounds();
          state.activeDragLabel = '✋ 視点を移動中';
        }
        updateSimulation();
      }
    });

    function finishPointer(e) {
      activePointers.delete(e.pointerId);
      try {
        if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}

      if (dragTarget === 'two-finger') {
        if (activePointers.size < 2) {
          prevTwoMid = null;
          prevTwoDist = 0;
        }
        if (activePointers.size === 0) {
          dragTarget = null;
          activePointerId = null;
          hasMoved = false;
          state.activeDragLabel = '';
          canvas.classList.remove('is-dragging');
          updateSimulation();
        }
        return;
      }

      if (activePointerId !== e.pointerId) return;
      const wasMoved = hasMoved;
      const target = dragTarget;
      activePointerId = null;
      dragTarget = null;
      hasMoved = false;
      state.activeDragLabel = '';
      canvas.classList.remove('is-dragging');

      if (!wasMoved && target === 'moon') {
        openMoonModal();
      } else {
        updateSimulation();
      }
    }

    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);

    // PC・トラックパッドでのホイール操作でも地球の位置やポインタ位置基準で拡大・縮小
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const pos = getPointerCanvasPos(e);
      const ep = state.lastProjected ? state.lastProjected.earth : null;
      const anchorX = (ep && ep.sx >= 0 && ep.sx <= canvas.clientWidth) ? ep.sx : pos.x;
      const anchorY = (ep && ep.sy >= 0 && ep.sy <= canvas.clientHeight) ? ep.sy : pos.y;
      const factor = Math.exp(-e.deltaY * 0.0018);
      zoomAroundScreenPoint(state.camera.zoom * factor, anchorX, anchorY);
      updateSimulation();
    }, { passive: false });
  }

  function clearPresetAngleActive() {
    [elements.btnViewTop, elements.btnViewDiag, elements.btnViewSide].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
  }

  function updateCameraPresetUI() {
    elements.btnCamModeRotate.classList.toggle('active', state.camera.dragMode === 'rotate');
    elements.btnCamModePan.classList.toggle('active', state.camera.dragMode === 'pan');
    const isZoomed = state.camera.zoom >= 1.8;
    elements.btnToggleScale.classList.toggle('active', isZoomed);
    elements.btnToggleScale.textContent = isZoomed ? '☀️ 太陽系全体' : '🌏 地球を拡大';
  }

  // --- イベントリスナーの登録 ---
  function registerEventListeners() {
    function setPlaying(playing) {
      state.isPlaying = playing;
      elements.iconPlay.style.display = playing ? 'none' : 'block';
      elements.iconPause.style.display = playing ? 'block' : 'none';
      elements.btnPlayPause.style.background = playing ? '#dc2626' : '#2563eb';
    }

    setupSpaceCanvasInteractions(setPlaying);

    // 再生・一時停止・コマ送り
    elements.btnPlayPause.addEventListener('click', () => setPlaying(!state.isPlaying));
    elements.btnStepBack.addEventListener('click', () => {
      setPlaying(false);
      state.currentDate = new Date(state.currentDate.getTime() - 60 * 60 * 1000);
      updateSimulation();
    });
    elements.btnStepForward.addEventListener('click', () => {
      setPlaying(false);
      state.currentDate = new Date(state.currentDate.getTime() + 60 * 60 * 1000);
      updateSimulation();
    });

    // 24時間スライダー
    elements.timeSlider.addEventListener('input', (e) => {
      const minutesTotal = parseInt(e.target.value, 10);
      const nextDate = new Date(state.currentDate);
      nextDate.setHours(Math.floor(minutesTotal / 60));
      nextDate.setMinutes(minutesTotal % 60);
      state.currentDate = nextDate;
      updateSimulation();
    });

    // 再生速度
    elements.selectSpeed.addEventListener('change', (e) => {
      state.playSpeedMinutesPerSec = parseFloat(e.target.value);
    });

    // クイック時間ジャンプ
    document.querySelectorAll('.btn-quick-time').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetHour = parseInt(btn.dataset.hour, 10);
        const nextDate = new Date(state.currentDate);
        nextDate.setHours(targetHour, 0, 0, 0);
        state.currentDate = nextDate;
        updateSimulation();
      });
    });

    // 前の日・今日・次の日
    elements.btnPrevDay.addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() - 24 * 60 * 60 * 1000);
      updateSimulation(true);
    });
    if (elements.btnTodayQuick) {
      elements.btnTodayQuick.addEventListener('click', () => {
        state.currentDate = new Date();
        updateSimulation(true);
      });
    }
    elements.btnNextDay.addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() + 24 * 60 * 60 * 1000);
      updateSimulation(true);
    });

    // 午前/午後反転 & 24h切替
    elements.ampmBadge.addEventListener('click', () => {
      const nextDate = new Date(state.currentDate);
      nextDate.setHours((nextDate.getHours() + 12) % 24);
      state.currentDate = nextDate;
      updateSimulation();
    });
    elements.btnTimeFormat.addEventListener('click', () => {
      state.use24Hour = !state.use24Hour;
      updateHourSelectOptions();
      syncDropdownValues(state.currentDate);
      updateSimulation(true);
    });

    // 左上カード折りたたみ / 右上詳細折りたたみ
    elements.btnToggleObserverCard.addEventListener('click', () => {
      state.showObserverCardBody = !state.showObserverCardBody;
      elements.earthObserverCard.classList.toggle('collapsed', !state.showObserverCardBody);
      elements.btnToggleObserverCard.textContent = state.showObserverCardBody ? '▲ 隠す' : '▼ 見る';
    });
    elements.btnToggleAstroData.addEventListener('click', () => {
      state.showAstroData = !state.showAstroData;
      elements.astroCard.classList.toggle('collapsed', !state.showAstroData);
      elements.btnToggleAstroData.textContent = state.showAstroData ? '▲ 隠す' : '▼ データを表示';
    });

    // 左上カードの月プレビュー・右上バッジタップで月拡大モーダル
    elements.saikiMoonPreviewBtn.addEventListener('click', () => openMoonModal());
    elements.moonBadgeBtn.addEventListener('click', () => openMoonModal());
    elements.moonDataRow.addEventListener('click', () => openMoonModal());

    // 日時変更ドロップダウン
    elements.btnEditDate.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLocationModal();
      const willOpen = !elements.datetimeDropdown.classList.contains('active');
      if (willOpen) {
        updateHourSelectOptions();
        syncDropdownValues(state.currentDate);
      }
      elements.datetimeDropdown.classList.toggle('active', willOpen);
    });

    const handleYearMonthChange = () => {
      const y = parseInt(elements.selectYear.value, 10) || state.currentDate.getFullYear();
      const m = parseInt(elements.selectMonth.value, 10) || (state.currentDate.getMonth() + 1);
      updateDayOptions(y, m);
    };
    elements.selectYear.addEventListener('change', handleYearMonthChange);
    elements.selectMonth.addEventListener('change', handleYearMonthChange);

    elements.btnApplyDate.addEventListener('click', () => {
      const fb = !isNaN(state.currentDate.getTime()) ? state.currentDate : new Date();
      const y = parseInt(elements.selectYear.value, 10) || fb.getFullYear();
      const m = clamp(parseInt(elements.selectMonth.value, 10) || (fb.getMonth() + 1), 1, 12);
      const maxD = new Date(y, m, 0).getDate();
      const d = clamp(parseInt(elements.selectDay.value, 10) || fb.getDate(), 1, maxD);
      const parsedH = parseInt(elements.selectHour.value, 10);
      let h24;
      if (state.use24Hour) {
        h24 = !isNaN(parsedH) ? clamp(parsedH, 0, 23) : fb.getHours();
      } else {
        const ampm = elements.selectAmPm.value === 'pm' ? 'pm' : 'am';
        const h12mod = !isNaN(parsedH) ? (parsedH % 12) : (fb.getHours() % 12);
        h24 = (ampm === 'pm' ? 12 : 0) + h12mod;
      }
      const parsedMn = parseInt(elements.selectMinute.value, 10);
      const mn = !isNaN(parsedMn) ? clamp(parsedMn, 0, 59) : fb.getMinutes();

      const nextDate = new Date(y, m - 1, d, h24, mn, 0);
      if (!isNaN(nextDate.getTime())) {
        state.currentDate = nextDate;
      }
      elements.datetimeDropdown.classList.remove('active');
      updateSimulation(true);
    });

    elements.btnTodayDate.addEventListener('click', () => {
      state.currentDate = new Date();
      elements.datetimeDropdown.classList.remove('active');
      updateSimulation(true);
    });

    // 観測地点選択モーダル
    elements.btnLocationPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.datetimeDropdown.classList.remove('active');
      openLocationModal();
    });
    if (elements.btnCloseLocation) {
      elements.btnCloseLocation.addEventListener('click', closeLocationModal);
    }
    if (elements.locationModal) {
      elements.locationModal.addEventListener('click', (e) => {
        if (e.target === elements.locationModal) closeLocationModal();
      });
    }
    if (elements.locationCategoryTabs) {
      elements.locationCategoryTabs.querySelectorAll('.loc-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          renderLocationCategory(tab.dataset.category);
        });
      });
    }
    if (elements.btnApplyLocation) {
      elements.btnApplyLocation.addEventListener('click', () => {
        applyObserverLocation(elements.inputLocName.value, elements.inputLocLat.value, elements.inputLocLon.value);
        closeLocationModal();
      });
    }
    if (elements.btnResetSaikiModal) {
      elements.btnResetSaikiModal.addEventListener('click', () => {
        applyObserverLocation('大分県佐伯市', 32.96, 131.90);
        closeLocationModal();
      });
    }

    document.addEventListener('click', (e) => {
      if (!elements.datetimeDropdown.contains(e.target) && !elements.btnEditDate.contains(e.target)) {
        elements.datetimeDropdown.classList.remove('active');
      }
    });

    // カメラ・視点操作バー
    elements.btnCamModeRotate.addEventListener('click', () => {
      state.camera.dragMode = 'rotate';
      updateCameraPresetUI();
    });
    elements.btnCamModePan.addEventListener('click', () => {
      state.camera.dragMode = 'pan';
      updateCameraPresetUI();
    });
    elements.btnViewTop.addEventListener('click', () => {
      state.camera.yaw = 0;
      state.camera.pitch = (89 * Math.PI) / 180;
      clearPresetAngleActive();
      elements.btnViewTop.classList.add('active');
      updateSimulation();
    });
    elements.btnViewDiag.addEventListener('click', () => {
      state.camera.yaw = 0;
      state.camera.pitch = (58 * Math.PI) / 180;
      clearPresetAngleActive();
      elements.btnViewDiag.classList.add('active');
      updateSimulation();
    });
    elements.btnViewSide.addEventListener('click', () => {
      state.camera.yaw = 0;
      state.camera.pitch = (14 * Math.PI) / 180;
      clearPresetAngleActive();
      elements.btnViewSide.classList.add('active');
      updateSimulation();
    });
    function getZoomButtonAnchor() {
      const { width, height } = getViewportSize();
      const ep = state.lastProjected ? state.lastProjected.earth : null;
      if (ep && ep.sx >= 0 && ep.sx <= width && ep.sy >= 0 && ep.sy <= height) {
        return { x: ep.sx, y: ep.sy };
      }
      return { x: width * 0.5, y: height * 0.52 };
    }

    elements.btnToggleScale.addEventListener('click', () => {
      if (state.camera.zoom < 1.8) {
        centerCameraOnEarth(2.5);
      } else {
        state.camera.zoom = 1.0;
        state.camera.panX = 0;
        state.camera.panY = 0;
        updateCameraPresetUI();
      }
      updateSimulation();
    });
    elements.btnZoomIn.addEventListener('click', () => {
      const anchor = getZoomButtonAnchor();
      zoomAroundScreenPoint(state.camera.zoom * 1.28, anchor.x, anchor.y);
      updateSimulation();
    });
    elements.btnZoomOut.addEventListener('click', () => {
      const anchor = getZoomButtonAnchor();
      zoomAroundScreenPoint(state.camera.zoom / 1.28, anchor.x, anchor.y);
      updateSimulation();
    });
    elements.btnViewReset.addEventListener('click', () => {
      state.camera.yaw = 0;
      state.camera.pitch = (58 * Math.PI) / 180;
      state.camera.panX = 0;
      state.camera.panY = 0;
      state.camera.zoom = 1.0;
      clearPresetAngleActive();
      elements.btnViewDiag.classList.add('active');
      updateCameraPresetUI();
      updateSimulation();
    });

    // 下部オプションボタン
    elements.btnToggleLight.addEventListener('click', () => {
      state.showSunlight = !state.showSunlight;
      elements.btnToggleLight.classList.toggle('active', state.showSunlight);
      updateSimulation();
    });
    elements.btnTogglePath.addEventListener('click', () => {
      state.showOrbits = !state.showOrbits;
      elements.btnTogglePath.classList.toggle('active', state.showOrbits);
      updateSimulation();
    });
    elements.btnLockHour.addEventListener('click', () => {
      state.lockHourOnMoonDrag = !state.lockHourOnMoonDrag;
      elements.btnLockHour.classList.toggle('active', state.lockHourOnMoonDrag);
    });
    elements.btnPinMoon.addEventListener('click', () => {
      addPinnedSnapshot(state.currentDate);
    });
    elements.btnClearPins.addEventListener('click', () => {
      state.pinnedSnapshots = [];
      updateSimulation();
    });

    // 月拡大モーダル操作
    function stepModalDays(offsetDays) {
      setPlaying(false);
      const dt = state.currentDate;
      state.currentDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + offsetDays, dt.getHours(), dt.getMinutes(), 0);
      updateSimulation(true);
      openMoonModal(true);
    }
    elements.btnModalPrev3Day.addEventListener('click', (e) => { e.stopPropagation(); stepModalDays(-3); });
    elements.btnModalPrevDay.addEventListener('click', (e) => { e.stopPropagation(); stepModalDays(-1); });
    elements.btnModalNextDay.addEventListener('click', (e) => { e.stopPropagation(); stepModalDays(1); });
    elements.btnModalNext3Day.addEventListener('click', (e) => { e.stopPropagation(); stepModalDays(3); });
    elements.btnModalPinMoon.addEventListener('click', (e) => {
      e.stopPropagation();
      addPinnedSnapshot(state.currentDate);
      updateModalPinButtonState();
    });
    elements.btnToggleExplanation.addEventListener('click', (e) => {
      e.stopPropagation();
      const hidden = elements.modalExplanation.style.display === 'none';
      elements.modalExplanation.style.display = hidden ? 'block' : 'none';
      elements.btnToggleExplanation.classList.toggle('opened', hidden);
      elements.btnToggleExplanation.innerHTML = hidden
        ? '<span>▲ ヒント・解説を閉じる</span>'
        : '<span>💡 ヒント・解説を見る ▾</span>';
    });
    elements.btnCloseModal.addEventListener('click', closeMoonModal);
    elements.moonModal.addEventListener('click', (e) => {
      if (e.target === elements.moonModal) closeMoonModal();
    });

    // 比べるモーダル操作
    elements.btnOpenCompare.addEventListener('click', () => openCompareModal());
    elements.btnCloseCompare.addEventListener('click', closeCompareModal);
    elements.compareModal.addEventListener('click', (e) => {
      if (e.target === elements.compareModal) closeCompareModal();
    });
    elements.btnCompareToggleInfo.addEventListener('click', () => {
      state.hideCompareInfo = !state.hideCompareInfo;
      const card = elements.compareModal.querySelector('.compare-modal-card');
      if (card) card.classList.toggle('hide-compare-info', state.hideCompareInfo);
      elements.btnCompareToggleInfo.classList.toggle('active', state.hideCompareInfo);
      elements.btnCompareToggleInfo.textContent = state.hideCompareInfo ? '💡 名前・データを表示' : '💡 名前・データを隠す';
    });
    elements.btnCompareSyncTime.addEventListener('click', () => {
      elements.compBHour.value = elements.compAHour.value;
      updateCompareCard('b');
    });
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
        const dt = readCompareDate(side);
        dt.setDate(dt.getDate() + parseInt(btn.dataset.days, 10));
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
    elements.btnComparePinBoth.addEventListener('click', () => {
      const dA = readCompareDate('a');
      const dB = readCompareDate('b');
      state.pinnedSnapshots = [];
      addPinnedSnapshot(dA);
      state.currentDate = new Date(dB);
      closeCompareModal();
      updateSimulation(true);
    });

    // カレンダーモーダル操作
    elements.btnOpenCalendar.addEventListener('click', openCalendarModal);
    elements.btnOpenCalendarTop.addEventListener('click', openCalendarModal);
    elements.btnCloseCalendar.addEventListener('click', closeCalendarModal);
    elements.calendarModal.addEventListener('click', (e) => {
      if (e.target === elements.calendarModal) closeCalendarModal();
    });
    elements.btnCalPrevMonth.addEventListener('click', () => {
      state.calMonth -= 1;
      if (state.calMonth < 1) { state.calMonth = 12; state.calYear -= 1; }
      renderCalendarGrid();
    });
    elements.btnCalNextMonth.addEventListener('click', () => {
      state.calMonth += 1;
      if (state.calMonth > 12) { state.calMonth = 1; state.calYear += 1; }
      renderCalendarGrid();
    });
    elements.calSelectYear.addEventListener('change', () => {
      state.calYear = parseInt(elements.calSelectYear.value, 10);
      renderCalendarGrid();
    });
    elements.calSelectMonth.addEventListener('change', () => {
      state.calMonth = parseInt(elements.calSelectMonth.value, 10);
      renderCalendarGrid();
    });
    elements.calSelectHour.addEventListener('change', () => {
      state.calHour = parseInt(elements.calSelectHour.value, 10);
      renderCalendarGrid();
    });
    elements.btnCalModeCompare.addEventListener('click', () => {
      state.calCompareMode = !state.calCompareMode;
      state.calPickedDates = [];
      updateCalendarModeUI();
      renderCalendarGrid();
    });

    // 画面リサイズ・回転・Safari visualViewport 対応
    window.addEventListener('resize', resizeCanvases);
    window.addEventListener('orientationchange', () => {
      resizeCanvases();
      setTimeout(resizeCanvases, 180);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resizeCanvases);
    }
    elements.btnDismissPortraitWarning.addEventListener('click', (e) => {
      e.stopPropagation();
      state.portraitWarningDismissed = true;
      const { width, height } = getViewportSize();
      updateOrientationWarning(width, height);
    });

    // iPad Safari ピンチイン・ピンチアウト、ダブルタップ拡大、ドラッグスクロールの完全防止
    const preventZoomGesture = (e) => e.preventDefault();
    document.addEventListener('gesturestart', preventZoomGesture, { passive: false });
    document.addEventListener('gesturechange', preventZoomGesture, { passive: false });
    document.addEventListener('gestureend', preventZoomGesture, { passive: false });
    document.addEventListener('touchmove', (e) => {
      // モーダル内の縦スクロール要素・スライダー・フォーム部品以外は既定スクロール・マルチタッチピンチをすべて阻止
      const allowSingleTouch = e.target && e.target.closest && e.target.closest('.modal-content-card, .compare-modal-card, .calendar-grid, .location-modal-card, .location-grid, input, select, textarea');
      if ((e.touches && e.touches.length > 1) || (e.scale && e.scale !== 1) || !allowSingleTouch) {
        e.preventDefault();
      }
    }, { passive: false });
    document.addEventListener('dblclick', preventZoomGesture, { passive: false });
    let lastTouchEndTime = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      const isInteractive = e.target && e.target.closest && e.target.closest('button, input, select, option, a, label');
      if (!isInteractive && now - lastTouchEndTime <= 300 && e.touches && e.touches.length === 0) {
        e.preventDefault();
      }
      lastTouchEndTime = now;
    }, { passive: false });

    // キーボードショートカット
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
    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      screen.orientation.lock('landscape').catch(() => {});
    }
    initStars();
    initDropdownSelectors();
    syncLocationInputsFromObserver();
    initCompareSelectors();
    initCalendarSelectors();
    updateCameraPresetUI();
    clearPresetAngleActive();
    if (elements.btnViewDiag) elements.btnViewDiag.classList.add('active'); // 初期仰角(68°)に近い斜め見下ろし状態
    registerEventListeners();
    resizeCanvases();
    requestAnimationFrame(animationLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
