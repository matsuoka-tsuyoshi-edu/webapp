/**
 * app.js - ほしぞらナビ（星座と星の動きシミュレーション）メインコントローラ v1.1.0
 *
 * - 平射ドーム投影（正角図法）による天頂歪み（横伸び）の解消
 * - 星座線タップ選択＆蛍光色スタンプ（「📌 星座をのこす」）＋日時表示＋続き再生
 * - 探究学習向けの初期シンプル表示（初期は星座線のみ。星座名・星の名前・ヒントは独立ON/OFF）
 * - iPad Safari ピンチアウト・バウンススクロール完全防止 & キャッシュ無効化
 */

(function () {
  'use strict';

  const Astro = window.AstroCalc;

  // ==========================================================
  // 0. iPad Safari ピンチアウト・スクロール防止 & キャッシュ無効化
  // ==========================================================
  function initIOSGuardsAndNoCache() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      }).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then(keys => {
        keys.forEach(k => caches.delete(k));
      }).catch(() => {});
    }

    ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
      document.addEventListener(evt, e => e.preventDefault(), { passive: false });
    });

    document.addEventListener(
      'touchmove',
      e => {
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const scrollable = e.target && e.target.closest ? e.target.closest('.modal-scroll') : null;
        if (!scrollable) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    let lastTouchEnd = 0;
    document.addEventListener(
      'touchend',
      e => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          const tag = (e.target && e.target.tagName) || '';
          if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
            e.preventDefault();
          }
        }
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

  // ==========================================================
  // 1. 観測地点プリセット（sunandmoon 完全継承 + 海外スポット）
  // ==========================================================
  const LOCATION_PRESETS = [
    {
      group: '🏫 佐伯市・市内小学校（全15校）',
      items: [
        { id: 'oita-saiki', name: '大分県佐伯市', lat: 32.9600, lon: 131.9000, tz: 9 },
        { id: 'saiki-umeryokuho', name: '佐伯市立宇目緑豊小学校', lat: 32.8571, lon: 131.6733, tz: 9 },
        { id: 'saiki-shinonome', name: '佐伯市立東雲小学校', lat: 33.0465, lon: 131.9257, tz: 9 },
        { id: 'saiki-yahata', name: '佐伯市立八幡小学校', lat: 33.0035, lon: 131.8919, tz: 9 },
        { id: 'saiki-saikihigashi', name: '佐伯市立佐伯東小学校', lat: 32.9648, lon: 131.8985, tz: 9 },
        { id: 'saiki-saiki', name: '佐伯市立佐伯小学校', lat: 32.9577, lon: 131.8929, tz: 9 },
        { id: 'saiki-tomachidai', name: '佐伯市立渡町台小学校', lat: 32.9584, lon: 131.9085, tz: 9 },
        { id: 'saiki-tsuruoka', name: '佐伯市立鶴岡小学校', lat: 32.9609, lon: 131.8749, tz: 9 },
        { id: 'saiki-kirihata', name: '佐伯市立切畑小学校', lat: 32.9534, lon: 131.8381, tz: 9 },
        { id: 'saiki-kamino', name: '佐伯市立上野小学校', lat: 32.9704, lon: 131.8340, tz: 9 },
        { id: 'saiki-meiji', name: '佐伯市立明治小学校', lat: 32.9819, lon: 131.8495, tz: 9 },
        { id: 'saiki-honjo', name: '佐伯市立本匠小学校', lat: 32.9555, lon: 131.8025, tz: 9 },
        { id: 'saiki-naokawa', name: '佐伯市立直川小学校', lat: 32.8978, lon: 131.7767, tz: 9 },
        { id: 'saiki-yonouzu', name: '佐伯市立米水津小学校', lat: 32.9219, lon: 131.9798, tz: 9 },
        { id: 'saiki-matsuura', name: '佐伯市立松浦小学校', lat: 32.9454, lon: 131.9614, tz: 9 },
        { id: 'saiki-kamaeshonan', name: '佐伯市立蒲江翔南学園', lat: 32.8030, lon: 131.9430, tz: 9 }
      ]
    },
    {
      group: '🏠 大分県の市町村（全18市町村）',
      items: [
        { id: 'oita-saiki-city', name: '大分県佐伯市', lat: 32.96, lon: 131.90, tz: 9 },
        { id: 'oita-oita', name: '大分県大分市', lat: 33.24, lon: 131.61, tz: 9 },
        { id: 'oita-beppu', name: '大分県別府市', lat: 33.28, lon: 131.49, tz: 9 },
        { id: 'oita-nakatsu', name: '大分県中津市', lat: 33.60, lon: 131.19, tz: 9 },
        { id: 'oita-hita', name: '大分県日田市', lat: 33.32, lon: 130.94, tz: 9 },
        { id: 'oita-usuki', name: '大分県臼杵市', lat: 33.13, lon: 131.80, tz: 9 },
        { id: 'oita-tsukumi', name: '大分県津久見市', lat: 33.07, lon: 131.86, tz: 9 },
        { id: 'oita-taketa', name: '大分県竹田市', lat: 32.97, lon: 131.40, tz: 9 },
        { id: 'oita-bungotakada', name: '大分県豊後高田市', lat: 33.56, lon: 131.44, tz: 9 },
        { id: 'oita-kitsuki', name: '大分県杵築市', lat: 33.42, lon: 131.62, tz: 9 },
        { id: 'oita-usa', name: '大分県宇佐市', lat: 33.53, lon: 131.35, tz: 9 },
        { id: 'oita-bungoono', name: '大分県豊後大野市', lat: 32.98, lon: 131.59, tz: 9 },
        { id: 'oita-yufu', name: '大分県由布市', lat: 33.18, lon: 131.43, tz: 9 },
        { id: 'oita-kunisaki', name: '大分県国東市', lat: 33.56, lon: 131.73, tz: 9 },
        { id: 'oita-himeshima', name: '大分県姫島村', lat: 33.73, lon: 131.67, tz: 9 },
        { id: 'oita-hiji', name: '大分県日出町', lat: 33.37, lon: 131.53, tz: 9 },
        { id: 'oita-kokonoe', name: '大分県九重町', lat: 33.22, lon: 131.19, tz: 9 },
        { id: 'oita-kusu', name: '大分県玖珠町', lat: 33.28, lon: 131.15, tz: 9 }
      ]
    },
    {
      group: '🗾 九州・沖縄の県庁所在地',
      items: [
        { id: 'kyushu-fukuoka', name: '福岡県福岡市', lat: 33.59, lon: 130.40, tz: 9 },
        { id: 'kyushu-saga', name: '佐賀県佐賀市', lat: 33.26, lon: 130.30, tz: 9 },
        { id: 'kyushu-nagasaki', name: '長崎県長崎市', lat: 32.75, lon: 129.88, tz: 9 },
        { id: 'kyushu-kumamoto', name: '熊本県熊本市', lat: 32.80, lon: 130.71, tz: 9 },
        { id: 'kyushu-oita', name: '大分県大分市', lat: 33.24, lon: 131.61, tz: 9 },
        { id: 'kyushu-miyazaki', name: '宮崎県宮崎市', lat: 31.91, lon: 131.42, tz: 9 },
        { id: 'kyushu-kagoshima', name: '鹿児島県鹿児島市', lat: 31.60, lon: 130.56, tz: 9 },
        { id: 'kyushu-naha', name: '沖縄県那覇市', lat: 26.21, lon: 127.68, tz: 9 }
      ]
    },
    {
      group: '🗼 日本の主要都市',
      items: [
        { id: 'jp-sapporo', name: '北海道札幌市', lat: 43.06, lon: 141.35, tz: 9 },
        { id: 'jp-nemuro', name: '北海道根室市', lat: 43.33, lon: 145.58, tz: 9 },
        { id: 'jp-aomori', name: '青森県青森市', lat: 40.82, lon: 140.74, tz: 9 },
        { id: 'jp-sendai', name: '宮城県仙台市', lat: 38.27, lon: 140.87, tz: 9 },
        { id: 'jp-niigata', name: '新潟県新潟市', lat: 37.92, lon: 139.04, tz: 9 },
        { id: 'jp-tokyo', name: '東京都', lat: 35.69, lon: 139.69, tz: 9 },
        { id: 'jp-yokohama', name: '神奈川県横浜市', lat: 35.44, lon: 139.64, tz: 9 },
        { id: 'jp-nagano', name: '長野県長野市', lat: 36.65, lon: 138.18, tz: 9 },
        { id: 'jp-kanazawa', name: '石川県金沢市', lat: 36.56, lon: 136.66, tz: 9 },
        { id: 'jp-shizuoka', name: '静岡県静岡市', lat: 34.98, lon: 138.38, tz: 9 },
        { id: 'jp-nagoya', name: '愛知県名古屋市', lat: 35.18, lon: 136.91, tz: 9 },
        { id: 'jp-kyoto', name: '京都府京都市', lat: 35.01, lon: 135.77, tz: 9 },
        { id: 'jp-osaka', name: '大阪府大阪市', lat: 34.69, lon: 135.50, tz: 9 },
        { id: 'jp-kobe', name: '兵庫県神戸市', lat: 34.69, lon: 135.20, tz: 9 },
        { id: 'jp-matsue', name: '島根県松江市', lat: 35.47, lon: 133.05, tz: 9 },
        { id: 'jp-okayama', name: '岡山県岡山市', lat: 34.66, lon: 133.93, tz: 9 },
        { id: 'jp-hiroshima', name: '広島県広島市', lat: 34.40, lon: 132.46, tz: 9 },
        { id: 'jp-yamaguchi', name: '山口県山口市', lat: 34.18, lon: 131.47, tz: 9 },
        { id: 'jp-takamatsu', name: '香川県高松市', lat: 34.34, lon: 134.05, tz: 9 },
        { id: 'jp-matsuyama', name: '愛媛県松山市', lat: 33.84, lon: 132.77, tz: 9 },
        { id: 'jp-kochi', name: '高知県高知市', lat: 33.56, lon: 133.53, tz: 9 },
        { id: 'jp-ishigaki', name: '沖縄県石垣市', lat: 24.34, lon: 124.16, tz: 9 }
      ]
    },
    {
      group: '✈️ 世界の星空・海外スポット（緯度くらべ）',
      items: [
        { id: 'world-northpole', name: '北極点（北緯90°）', lat: 89.99, lon: 0.00, tz: 0, badge: '北極星が真上！星がしずまない' },
        { id: 'world-fairbanks', name: 'フェアバンクス（アラスカ）', lat: 64.84, lon: -147.72, tz: -9, badge: 'オーロラの街・北極星がとても高い' },
        { id: 'world-london', name: 'ロンドン（イギリス）', lat: 51.51, lon: -0.13, tz: 0, badge: '日本より北極星が高い(約51.5°)' },
        { id: 'world-cairo', name: 'カイロ（エジプト）', lat: 30.04, lon: 31.24, tz: 2, badge: '佐伯市と近い緯度・ピラミッドの空' },
        { id: 'world-hawaii', name: 'ハワイ・マウナケア', lat: 19.82, lon: -155.47, tz: -10, badge: '北極星も南十字星も両方見える！' },
        { id: 'world-singapore', name: 'シンガポール（赤道ちかく）', lat: 1.35, lon: 103.82, tz: 8, badge: '北極星が地面すれすれ・星が真上を通る' },
        { id: 'world-cairns', name: 'ケアンズ（オーストラリア）', lat: -16.92, lon: 145.77, tz: 10, badge: '南十字星が見える・オリオン座が逆さま' },
        { id: 'world-sydney', name: 'シドニー（オーストラリア）', lat: -33.87, lon: 151.21, tz: 10, badge: '佐伯市と反対の緯度！南の空が時計回り' },
        { id: 'world-showa', name: '南極・昭和基地', lat: -69.01, lon: 39.58, tz: 3, badge: '日本の南極観測基地・南十字星が沈まない' },
        { id: 'world-southpole', name: '南極点（南緯90°）', lat: -89.99, lon: 0.00, tz: 0, badge: '天の南極が真上！星が時計回りに水平回転' }
      ]
    }
  ];

  // 蛍光色スタンプパレット
  const NEON_COLORS = ['#39ff14', '#ff2a85', '#00f5ff', '#faff00', '#ff9100'];

  // ==========================================================
  // 2. アプリケーション状態 (State)
  // ==========================================================
  function createDefaultEveningDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
  }

  const state = {
    currentDate: createDefaultEveningDate(),
    location: { id: 'oita-saiki', name: '大分県佐伯市', lat: 32.9600, lon: 131.9000, tz: 9 },
    viewMode: 'panorama', // 'panorama' | 'dome'
    viewAzimuth: 180,     // 0=北, 90=東, 180=南, 270=西
    targetAzimuth: null,
    isPlaying: false,
    playSpeed: 15,        // 分/秒
    use24Hour: false,
    // 初期状態は「星座線のみ」のシンプル表示（探究学習向け）
    showLines: true,
    showConstNames: false,
    showStarNames: false,
    showAsterisms: false,
    showPlanets: false,
    showTrails: false,
    showUnderground: false,
    forceDayStars: false,
    timeHudCollapsed: false,
    dataCollapsed: false,
    ctrlCollapsed: false,
    astroExpanded: false,
    moonZoomOpen: false,
    calYear: null,
    calMonth: null,
    calHour: 20,
    // 選択中星座＆残した蛍光星座スタンプ・月スタンプ
    selectedConstellationId: null,
    stamps: [], // { constId, name, color, dateTimeLabel, stars: [{az, alt}], lines: [[{az,alt},{az,alt}]] }
    moonStamps: [], // { az, alt, phase, tiltRad, dateTimeLabel, color }
    // 比較モーダル状態
    compareOpen: false,
    compareMode: '4dir',
    comparePlaying: false,
    compareLocA: { name: '大分県佐伯市', lat: 32.96, lon: 131.90, tz: 9 },
    compareLocB: { name: 'シドニー（オーストラリア）', lat: -33.87, lon: 151.21, tz: 10 },
    compareDirA: 180,
    compareDirB: 180,
    // ヒット判定キャッシュ（画面座標）
    renderedSegments: [],
    renderedMoon: null
  };

  // DOM要素
  const el = {
    viewport: document.getElementById('sky-viewport'),
    canvas: document.getElementById('sky-canvas'),
    labelsLayer: document.getElementById('sky-labels-layer'),
    compassBar: document.getElementById('horizon-compass-bar'),
    directionQuickBar: document.getElementById('direction-quick-bar'),
    controlPanel: document.getElementById('control-panel'),
    selectedBar: document.getElementById('selected-const-bar'),
    selectedName: document.getElementById('selected-const-name'),
    btnStampMain: document.getElementById('btn-stamp-const'),
    btnClearStamps: document.getElementById('btn-clear-stamps'),
    stampCount: document.getElementById('stamp-count'),
    displayDate: document.getElementById('display-date'),
    displayAmpm: document.getElementById('display-ampm'),
    displayTime: document.getElementById('display-time'),
    displayLocName: document.getElementById('display-location-name'),
    displayLatLon: document.getElementById('display-latlon'),
    hudDataBody: document.getElementById('hud-data-body'),
    timeSlider: document.getElementById('time-slider'),
    btnPlayPause: document.getElementById('btn-play-pause')
  };

  const ctx = el.canvas.getContext('2d');

  // ==========================================================
  // 3. 平射ドーム投影エンジン（天頂の「みにょーん」完全防止＋広画面端途切れ防止）
  // ==========================================================
  const DOME_BIAS = 1.0;
  const DOME_NORM = 1 + DOME_BIAS; // 2.0

  function shortestAzDiff(az, centerAz) {
    return ((az - centerAz + 540) % 360) - 180;
  }

  function getDomeMetrics(width, height) {
    const horizonY = height * 0.77;
    const topY = height * 0.11;
    // 縦横のスケールを同一(等方)にすることで、天頂の星座が横に引き伸ばされない
    const domeScale = Math.min((width * 0.47) / DOME_NORM, (horizonY - topY) / DOME_NORM);
    return { horizonY, topY, domeScale };
  }

  /**
   * 地平座標 (azimuth, altitude) -> Canvas座標 { x, y, visible }
   * 平射ドーム投影（正角図法）：角度と縦横比を保つため天頂付近でも横伸びしない
   */
  function projectToCanvas(az, alt, width, height, mode, centerAz, allowBelow) {
    if (mode === 'dome') {
      const cx = width / 2;
      const cy = height * 0.49;
      const maxR = Math.min(width, height) * 0.37;
      if (alt < -12) return { x: 0, y: 0, visible: false };
      const r = ((90 - Math.max(alt, -10)) / 90) * maxR;
      const rad = az * Astro.DEG2RAD;
      const x = cx - r * Math.sin(rad);
      const y = cy - r * Math.cos(rad);
      return { x, y, visible: alt >= 0 || allowBelow };
    }

    const { horizonY, domeScale } = getDomeMetrics(width, height);
    const dAz = shortestAzDiff(az, centerAz);

    const lam = dAz * Astro.DEG2RAD;
    const phi = alt * Astro.DEG2RAD;
    const cosPhi = Math.cos(phi);
    const x3 = cosPhi * Math.sin(lam);
    const y3 = Math.sin(phi);
    const z3 = cosPhi * Math.cos(lam);

    // 完全正背面の特異点近くのみ除外し、フルHD等の横広画面でも画面端まで滑らかに投影
    if (z3 < -0.78) return { x: 0, y: 0, visible: false };
    const denom = 1 + DOME_BIAS * z3;
    if (denom <= 0.18) return { x: 0, y: 0, visible: false };

    const k = DOME_NORM / denom;
    const u = k * x3;
    const v = k * y3;

    const x = width * 0.5 + u * domeScale;
    const y = horizonY - v * domeScale;

    if (x < -160 || x > width + 160 || y < -160 || y > height + 160) {
      return { x: 0, y: 0, visible: false };
    }
    return { x, y, visible: true, dAz, horizonY };
  }

  // ==========================================================
  // 4. 空・星・星座線・スタンプ・風景の描画
  // ==========================================================
  const COLOR_MAP = {
    blue: '#93c5fd',
    white: '#f8fafc',
    yellow: '#fef08a',
    orange: '#fdba74',
    red: '#fca5a5'
  };

  function getStarRadius(mag) {
    if (mag < 0) return 5.2;
    if (mag < 1.0) return 4.2;
    if (mag < 1.8) return 3.3;
    if (mag < 2.6) return 2.6;
    if (mag < 3.5) return 2.0;
    return 1.5;
  }

  /**
   * 3D方向補間で緩やかなドーム上の曲線として線分を描画する
   */
  function drawSphericalSegment(targetCtx, posA, posB, width, height, mode, centerAz, allowBelow) {
    const steps = 4;
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const azDiff = shortestAzDiff(posB.azimuth, posA.azimuth);
      const az = Astro.normDeg(posA.azimuth + azDiff * t);
      const alt = posA.altitude + (posB.altitude - posA.altitude) * t;
      const pt = projectToCanvas(az, alt, width, height, mode, centerAz, allowBelow);
      if (!pt.visible) {
        prev = null;
        continue;
      }
      if (prev && Math.abs(pt.x - prev.x) < width * 0.55) {
        if (i === 1) targetCtx.moveTo(prev.x, prev.y);
        targetCtx.lineTo(pt.x, pt.y);
      } else {
        targetCtx.moveTo(pt.x, pt.y);
      }
      prev = pt;
    }
  }

  function drawSkyScene(targetCtx, width, height, options) {
    const {
      date,
      loc,
      mode,
      centerAz,
      showLines,
      showConstNames,
      showStarNames,
      showAsterisms,
      showPlanets,
      showTrails,
      showUnderground,
      forceDayStars,
      selectedConstId,
      stamps,
      moonStamps,
      collectHits
    } = options;

    const jd = Astro.toJulianDay(date, loc.tz);
    const sunPos = Astro.getSunPosition(jd, loc.lat, loc.lon);
    const moonPos = Astro.getMoonPosition(jd, loc.lat, loc.lon);
    const moonPhase = Astro.getMoonPhase(jd);
    const lighting = Astro.getSkyLighting(sunPos.altitude, forceDayStars);

    // 1. 空グラデーション背景
    const grad = targetCtx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, lighting.topColor);
    grad.addColorStop(0.55, lighting.midColor);
    grad.addColorStop(0.85, lighting.botColor);
    grad.addColorStop(1, lighting.botColor);
    targetCtx.fillStyle = grad;
    targetCtx.fillRect(0, 0, width, height);

    const { horizonY, domeScale } = getDomeMetrics(width, height);

    // ドーム感を演出するうっすらとしたドーム高度線（パノラマ時）
    if (mode === 'panorama') {
      targetCtx.save();
      targetCtx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
      targetCtx.lineWidth = 1;
      [30, 60].forEach(altDeg => {
        targetCtx.beginPath();
        let started = false;
        for (let d = -95; d <= 95; d += 5) {
          const az = Astro.normDeg(centerAz + d);
          const p = projectToCanvas(az, altDeg, width, height, 'panorama', centerAz, showUnderground);
          if (!p.visible) continue;
          if (!started) {
            targetCtx.moveTo(p.x, p.y);
            started = true;
          } else {
            targetCtx.lineTo(p.x, p.y);
          }
        }
        targetCtx.stroke();
      });
      // 天頂マーク（うっすら）
      const zenithP = projectToCanvas(centerAz, 90, width, height, 'panorama', centerAz, false);
      if (zenithP.visible) {
        targetCtx.fillStyle = 'rgba(148, 163, 184, 0.25)';
        targetCtx.beginPath();
        targetCtx.arc(zenithP.x, zenithP.y, 2.5, 0, Math.PI * 2);
        targetCtx.fill();
      }
      targetCtx.restore();
    } else {
      // 全天マップ用の円枠背景
      const cx = width / 2;
      const cy = height * 0.49;
      const maxR = Math.min(width, height) * 0.37;
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.arc(cx, cy, maxR + 6, 0, Math.PI * 2);
      targetCtx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      targetCtx.fill();
      targetCtx.lineWidth = 2;
      targetCtx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
      targetCtx.stroke();

      targetCtx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      targetCtx.lineWidth = 1;
      [0.33, 0.66].forEach(f => {
        targetCtx.beginPath();
        targetCtx.arc(cx, cy, maxR * f, 0, Math.PI * 2);
        targetCtx.stroke();
      });
      targetCtx.beginPath();
      targetCtx.moveTo(cx - maxR, cy);
      targetCtx.lineTo(cx + maxR, cy);
      targetCtx.moveTo(cx, cy - maxR);
      targetCtx.lineTo(cx, cy + maxR);
      targetCtx.stroke();

      targetCtx.font = 'bold 14px "BIZ UDPGothic", sans-serif';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      targetCtx.fillStyle = '#93c5fd';
      targetCtx.fillText('北 (きた)', cx, cy - maxR - 18);
      targetCtx.fillStyle = '#fca5a5';
      targetCtx.fillText('南 (みなみ)', cx, cy + maxR + 18);
      targetCtx.fillStyle = '#fde047';
      targetCtx.fillText('東', cx - maxR - 20, cy);
      targetCtx.fillText('西', cx + maxR + 20, cy);

      targetCtx.beginPath();
      targetCtx.arc(cx, cy, maxR, 0, Math.PI * 2);
      targetCtx.clip();
    }

    // 2. 全恒星の地平座標計算
    const starPositions = {};
    const starAlpha = lighting.starAlpha;

    if (starAlpha > 0.02) {
      targetCtx.save();
      Astro.BACKGROUND_STARS.forEach(bs => {
        const pos = Astro.equatorialToHorizontal(bs.ra, bs.dec, jd, loc.lat, loc.lon);
        if (!showUnderground && pos.altitude < -2) return;
        const p = projectToCanvas(pos.azimuth, pos.altitude, width, height, mode, centerAz, showUnderground);
        if (!p.visible) return;
        targetCtx.globalAlpha = (pos.altitude < 0 ? 0.25 : 0.65) * starAlpha;
        targetCtx.fillStyle = COLOR_MAP[bs.color] || '#f8fafc';
        targetCtx.beginPath();
        targetCtx.arc(p.x, p.y, bs.mag < 4.3 ? 1.4 : 1.0, 0, Math.PI * 2);
        targetCtx.fill();
      });
      targetCtx.restore();
    }

    Astro.STARS_DATA.forEach(s => {
      const pos = Astro.equatorialToHorizontal(s.ra, s.dec, jd, loc.lat, loc.lon);
      const p = projectToCanvas(pos.azimuth, pos.altitude, width, height, mode, centerAz, showUnderground);
      starPositions[s.id] = { star: s, pos, p };
    });

    // 3. 軌跡（通り道：星は暗い空、太陽と月は昼でもはっきり表示）
    if (showTrails && starAlpha > 0.05) {
      const trailStars = ['polaris', 'betelgeuse', 'rigel', 'vega', 'altair', 'antares', 'arcturus', 'dubhe', 'acrux'];
      targetCtx.save();
      targetCtx.lineWidth = 1.4;
      targetCtx.setLineDash([4, 5]);
      trailStars.forEach(sid => {
        const st = Astro.STAR_MAP[sid];
        if (!st) return;
        targetCtx.strokeStyle = sid === 'polaris' ? 'rgba(250,204,21,0.5)' : 'rgba(147, 197, 253, 0.35)';
        targetCtx.beginPath();
        let started = false;
        let prevX = null;
        for (let h = -12; h <= 12; h += 0.5) {
          const sampleJd = jd + h / 24;
          const pos = Astro.equatorialToHorizontal(st.ra, st.dec, sampleJd, loc.lat, loc.lon);
          if (!showUnderground && pos.altitude < 0) {
            started = false;
            prevX = null;
            continue;
          }
          const p = projectToCanvas(pos.azimuth, pos.altitude, width, height, mode, centerAz, showUnderground);
          if (!p.visible) {
            started = false;
            prevX = null;
            continue;
          }
          if (prevX !== null && Math.abs(p.x - prevX) > width * 0.45) started = false;
          if (!started) {
            targetCtx.moveTo(p.x, p.y);
            started = true;
          } else {
            targetCtx.lineTo(p.x, p.y);
          }
          prevX = p.x;
        }
        targetCtx.stroke();
      });
      targetCtx.restore();
    }

    if (showTrails) {
      const drawSolarLunarTrail = (posFn, color, lineWidth) => {
        const segments = [];
        let curSeg = [];

        for (let h = -12; h <= 12; h += 0.25) {
          const sampleJd = jd + h / 24;
          const pos = posFn(sampleJd, loc.lat, loc.lon);
          if (!showUnderground && pos.altitude < -8) {
            if (curSeg.length > 1) segments.push(curSeg);
            curSeg = [];
            continue;
          }
          const p = projectToCanvas(pos.azimuth, pos.altitude, width, height, mode, centerAz, true);
          if (!p.visible) {
            if (curSeg.length > 1) segments.push(curSeg);
            curSeg = [];
            continue;
          }
          if (curSeg.length > 0 && Math.abs(p.x - curSeg[curSeg.length - 1].x) > width * 0.45) {
            if (curSeg.length > 1) segments.push(curSeg);
            curSeg = [];
          }
          curSeg.push({ x: p.x, y: p.y });
        }
        if (curSeg.length > 1) segments.push(curSeg);
        if (segments.length === 0) return;

        targetCtx.save();
        if (!showUnderground && mode === 'panorama') {
          targetCtx.beginPath();
          targetCtx.rect(0, 0, width, horizonY);
          targetCtx.clip();
        }
        targetCtx.lineCap = 'round';

        const traceAll = () => {
          targetCtx.beginPath();
          segments.forEach(seg => {
            targetCtx.moveTo(seg[0].x, seg[0].y);
            for (let i = 1; i < seg.length; i++) {
              targetCtx.lineTo(seg[i].x, seg[i].y);
            }
          });
          targetCtx.stroke();
        };

        targetCtx.setLineDash([7, 6]);
        targetCtx.lineWidth = lineWidth + 2.6;
        targetCtx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
        traceAll();

        targetCtx.lineWidth = lineWidth;
        targetCtx.strokeStyle = color;
        traceAll();
        targetCtx.restore();
      };

      // 太陽と月は地平線より上にあるとき（またはとうかON時）のみ通り道を表示
      if (!forceDayStars && (showUnderground || sunPos.altitude >= 0)) {
        drawSolarLunarTrail(Astro.getSunPosition, '#facc15', 3.0);
      }
      if (showUnderground || moonPos.altitude >= 0) {
        drawSolarLunarTrail(Astro.getMoonPosition, '#e2e8f0', 2.4);
      }
    }

    // 4. 星座線描画 + ヒット判定線分収集
    const segmentsForHit = [];
    if (showLines && starAlpha > 0.05) {
      Astro.CONSTELLATIONS_DATA.forEach(c => {
        const isSelected = c.id === selectedConstId;
        targetCtx.save();
        targetCtx.lineWidth = isSelected ? 3.6 : 1.8;
        if (isSelected) {
          targetCtx.shadowColor = '#38bdf8';
          targetCtx.shadowBlur = 12;
        }

        c.lines.forEach(([idA, idB]) => {
          const a = starPositions[idA];
          const b = starPositions[idB];
          if (!a || !b || !a.p.visible || !b.p.visible) return;
          if (!showUnderground && a.pos.altitude < -2 && b.pos.altitude < -2) return;
          if (Math.abs(a.p.x - b.p.x) > width * 0.55) return;

          const below = a.pos.altitude < 0 || b.pos.altitude < 0;
          if (isSelected) {
            targetCtx.strokeStyle = `rgba(56, 189, 248, ${0.98 * starAlpha})`;
          } else {
            targetCtx.strokeStyle = below
              ? `rgba(125, 211, 252, ${0.22 * starAlpha})`
              : `rgba(125, 211, 252, ${0.68 * starAlpha})`;
          }

          targetCtx.beginPath();
          drawSphericalSegment(targetCtx, a.pos, b.pos, width, height, mode, centerAz, showUnderground);
          targetCtx.stroke();

          if (collectHits && (!below || showUnderground)) {
            segmentsForHit.push({ constId: c.id, x1: a.p.x, y1: a.p.y, x2: b.p.x, y2: b.p.y });
          }
        });
        targetCtx.restore();
      });
    }

    // 5. 大三角・目印ガイド（📐 大三角・目印 ON時のみ）
    if (showAsterisms && starAlpha > 0.1) {
      targetCtx.save();
      Astro.ASTERISMS_DATA.forEach(ast => {
        if (ast.type === 'polygon' || ast.type === 'polyline') {
          const pts = ast.stars.map(id => starPositions[id]).filter(Boolean);
          if (pts.length !== ast.stars.length) return;
          if (pts.some(pt => !pt.p.visible || (!showUnderground && pt.pos.altitude < -5))) return;
          let jump = false;
          for (let i = 1; i < pts.length; i++) {
            if (Math.abs(pts[i].p.x - pts[i - 1].p.x) > width * 0.55) jump = true;
          }
          if (jump) return;

          targetCtx.strokeStyle = ast.color;
          targetCtx.globalAlpha = 0.72 * starAlpha;
          targetCtx.lineWidth = 2.2;
          targetCtx.setLineDash([7, 5]);
          targetCtx.beginPath();
          targetCtx.moveTo(pts[0].p.x, pts[0].p.y);
          for (let i = 1; i < pts.length; i++) {
            targetCtx.lineTo(pts[i].p.x, pts[i].p.y);
          }
          if (ast.closed) targetCtx.closePath();
          targetCtx.stroke();

          const avgX = pts.reduce((acc, pt) => acc + pt.p.x, 0) / pts.length;
          const avgY = pts.reduce((acc, pt) => acc + pt.p.y, 0) / pts.length;
          targetCtx.setLineDash([]);
          targetCtx.globalAlpha = 0.95 * starAlpha;
          targetCtx.font = 'bold 12px "BIZ UDPGothic", sans-serif';
          targetCtx.textAlign = 'center';
          targetCtx.fillStyle = ast.color;
          targetCtx.fillText(`▲ ${ast.name}`, avgX, avgY);
        } else if (ast.type === 'guide') {
          const from = starPositions[ast.from];
          const to = starPositions[ast.to];
          if (!from || !to || !from.p.visible || !to.p.visible) return;
          if (!showUnderground && (from.pos.altitude < 0 || to.pos.altitude < 0)) return;
          if (Math.abs(from.p.x - to.p.x) > width * 0.55) return;
          targetCtx.strokeStyle = ast.color;
          targetCtx.globalAlpha = 0.65 * starAlpha;
          targetCtx.lineWidth = 1.8;
          targetCtx.setLineDash([4, 6]);
          targetCtx.beginPath();
          targetCtx.moveTo(from.p.x, from.p.y);
          targetCtx.lineTo(to.p.x, to.p.y);
          targetCtx.stroke();
          targetCtx.setLineDash([]);
          targetCtx.font = 'bold 11px "BIZ UDPGothic", sans-serif';
          targetCtx.fillStyle = '#fde047';
          targetCtx.textAlign = 'center';
          targetCtx.fillText('×5倍 → 北極星', (from.p.x + to.p.x) / 2, (from.p.y + to.p.y) / 2 - 6);
        }
      });
      targetCtx.restore();
    }

    // 6. 残した星座（蛍光色スタンプ＋日付・時間）
    if (stamps && stamps.length > 0) {
      stamps.forEach(st => {
        targetCtx.save();
        targetCtx.strokeStyle = st.color;
        targetCtx.fillStyle = st.color;
        targetCtx.shadowColor = st.color;
        targetCtx.shadowBlur = 14;
        targetCtx.lineWidth = 3.0;

        st.lines.forEach(([a, b]) => {
          const pa = projectToCanvas(a.az, a.alt, width, height, mode, centerAz, true);
          const pb = projectToCanvas(b.az, b.alt, width, height, mode, centerAz, true);
          if (!pa.visible || !pb.visible) return;
          if (Math.abs(pa.x - pb.x) > width * 0.55) return;
          targetCtx.beginPath();
          drawSphericalSegment(
            targetCtx,
            { azimuth: a.az, altitude: a.alt },
            { azimuth: b.az, altitude: b.alt },
            width,
            height,
            mode,
            centerAz,
            true
          );
          targetCtx.stroke();
        });

        let topPt = null;
        st.stars.forEach(s => {
          const p = projectToCanvas(s.az, s.alt, width, height, mode, centerAz, true);
          if (!p.visible) return;
          if (!topPt || p.y < topPt.y) topPt = p;
          targetCtx.beginPath();
          targetCtx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
          targetCtx.fill();
        });

        // 日付・時刻ラベルをネオンバッジで表示
        if (topPt) {
          targetCtx.shadowBlur = 6;
          targetCtx.font = 'bold 11.5px "BIZ UDPGothic", sans-serif';
          targetCtx.textAlign = 'center';
          const text = `${st.name} ${st.dateTimeLabel}`;
          const tw = targetCtx.measureText(text).width + 14;
          const bx = topPt.x;
          const by = Math.max(120, topPt.y - 24);
          targetCtx.fillStyle = 'rgba(2, 6, 23, 0.88)';
          targetCtx.fillRect(bx - tw / 2, by - 14, tw, 20);
          targetCtx.lineWidth = 1.5;
          targetCtx.strokeRect(bx - tw / 2, by - 14, tw, 20);
          targetCtx.fillStyle = st.color;
          targetCtx.fillText(text, bx, by);
        }
        targetCtx.restore();
      });
    }

    // 6.5. 残した月スタンプ（場所・時刻・満ち欠けを固定記録）
    if (moonStamps && moonStamps.length > 0) {
      moonStamps.forEach((ms, idx) => {
        const mp = projectToCanvas(ms.az, ms.alt, width, height, mode, centerAz, true);
        if (!mp.visible) return;
        targetCtx.save();
        targetCtx.strokeStyle = ms.color || '#fde047';
        targetCtx.shadowColor = ms.color || '#fde047';
        targetCtx.shadowBlur = 12;
        targetCtx.lineWidth = 2;
        targetCtx.setLineDash([3, 3]);
        targetCtx.beginPath();
        targetCtx.arc(mp.x, mp.y, 17, 0, Math.PI * 2);
        targetCtx.stroke();
        targetCtx.setLineDash([]);
        drawMoonPhaseDisk(targetCtx, mp.x, mp.y, 13, ms.phase, ms.tiltRad);

        targetCtx.shadowBlur = 6;
        targetCtx.font = 'bold 11px "BIZ UDPGothic", sans-serif';
        targetCtx.textAlign = 'center';
        const text = `🌙${idx + 1} ${ms.dateTimeLabel} (${ms.phase.name})`;
        const tw = targetCtx.measureText(text).width + 12;
        const bx = mp.x;
        const by = Math.max(120, mp.y - 24);
        targetCtx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        targetCtx.fillRect(bx - tw / 2, by - 13, tw, 18);
        targetCtx.lineWidth = 1.2;
        targetCtx.strokeStyle = ms.color || '#fde047';
        targetCtx.strokeRect(bx - tw / 2, by - 13, tw, 18);
        targetCtx.fillStyle = ms.color || '#fef08a';
        targetCtx.fillText(text, bx, by);
        targetCtx.restore();
      });
    }

    // 7. カタログ恒星本体＆ラベル候補収集
    const collectedHits = [];
    if (starAlpha > 0.02) {
      targetCtx.save();
      Astro.STARS_DATA.forEach(s => {
        const item = starPositions[s.id];
        if (!item || !item.p.visible) return;
        if (!showUnderground && item.pos.altitude < -1) return;

        const { x, y } = item.p;
        const r = getStarRadius(s.mag);
        const col = COLOR_MAP[s.color] || '#ffffff';
        const below = item.pos.altitude < 0;
        const a = (below ? 0.35 : 1.0) * starAlpha;

        if (s.isMajor || s.mag < 1.8) {
          const g = targetCtx.createRadialGradient(x, y, 0, x, y, r * 3.2);
          g.addColorStop(0, col);
          g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          targetCtx.globalAlpha = a * 0.85;
          targetCtx.fillStyle = g;
          targetCtx.beginPath();
          targetCtx.arc(x, y, r * 3.2, 0, Math.PI * 2);
          targetCtx.fill();
        }

        targetCtx.globalAlpha = a;
        targetCtx.fillStyle = col;
        targetCtx.beginPath();
        targetCtx.arc(x, y, r, 0, Math.PI * 2);
        targetCtx.fill();

        // ⭐ 星の名前 ON時のみ有名な星の名前を収集
        if (collectHits && showStarNames && !below && (s.isMajor || s.desc)) {
          collectedHits.push({
            kind: 'star',
            id: s.id,
            label: s.name,
            x,
            y: y - r - 13,
            isMajor: !!s.isMajor
          });
        }
      });
      targetCtx.restore();
    }

    // 🏷️ 星座名 ON時のみ星座名を収集
    if (collectHits && showConstNames && starAlpha > 0.15) {
      Astro.CONSTELLATIONS_DATA.forEach(c => {
        const sp = starPositions[c.centerStar];
        if (!sp || !sp.p.visible) return;
        if (!showUnderground && sp.pos.altitude < 2) return;
        collectedHits.push({
          kind: 'constellation',
          id: c.id,
          label: c.name,
          x: sp.p.x,
          y: sp.p.y + 18
        });
      });
    }

    // 7.5. 惑星（🪐 惑星 ON時のみ表示）
    if (showPlanets && starAlpha > 0.05) {
      const planets = Astro.getPlanetsPositions(jd, loc.lat, loc.lon);
      const placedPlanetLabels = [];
      targetCtx.save();
      planets.forEach(pl => {
        if (!showUnderground && pl.altitude < -2) return;
        const pp = projectToCanvas(pl.azimuth, pl.altitude, width, height, mode, centerAz, showUnderground);
        if (!pp.visible) return;

        const below = pl.altitude < 0;
        const alpha = (below ? 0.35 : 0.96) * Math.min(1, starAlpha * 1.15);
        targetCtx.globalAlpha = alpha;

        // 惑星のほのかな光彩
        const g = targetCtx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, pl.radius * 3.4);
        g.addColorStop(0, pl.color);
        g.addColorStop(0.45, 'rgba(253, 224, 71, 0.35)');
        g.addColorStop(1, 'rgba(253, 224, 71, 0)');
        targetCtx.fillStyle = g;
        targetCtx.beginPath();
        targetCtx.arc(pp.x, pp.y, pl.radius * 3.4, 0, Math.PI * 2);
        targetCtx.fill();

        // 土星の輪
        if (pl.hasRing) {
          targetCtx.strokeStyle = '#fde68a';
          targetCtx.lineWidth = 1.5;
          targetCtx.beginPath();
          targetCtx.ellipse(pp.x, pp.y, pl.radius * 2.2, pl.radius * 0.72, -0.35, 0, Math.PI * 2);
          targetCtx.stroke();
        }

        // 惑星本体（ベタ塗り円）
        targetCtx.fillStyle = pl.color;
        targetCtx.beginPath();
        targetCtx.arc(pp.x, pp.y, pl.radius, 0, Math.PI * 2);
        targetCtx.fill();

        // ラベル（近接惑星同士が重ならないようオフセット調整）
        targetCtx.font = 'bold 11.5px "BIZ UDPGothic", sans-serif';
        targetCtx.textAlign = 'left';
        targetCtx.textBaseline = 'middle';
        const lx = pp.x + pl.radius + 7;
        let ly = pp.y;
        while (placedPlanetLabels.some(p => Math.abs(p.x - lx) < 75 && Math.abs(p.y - ly) < 19)) {
          ly += 20;
        }
        placedPlanetLabels.push({ x: lx, y: ly });
        const labelText = `🪐 ${pl.name}`;
        const tw = targetCtx.measureText(labelText).width + 10;
        targetCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        targetCtx.fillRect(lx - 4, ly - 9, tw, 18);
        targetCtx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
        targetCtx.lineWidth = 1;
        targetCtx.strokeRect(lx - 4, ly - 9, tw, 18);
        targetCtx.fillStyle = '#fef08a';
        targetCtx.fillText(labelText, lx + 1, ly + 0.5);
      });
      targetCtx.restore();
    }

    // 8. 月・太陽の描画（地平線より上をクリップして出入り付近の突然の消失を防止）
    targetCtx.save();
    if (!showUnderground && mode === 'panorama') {
      targetCtx.beginPath();
      targetCtx.rect(0, 0, width, horizonY);
      targetCtx.clip();
    }
    let renderedMoon = null;
    const moonProj = projectToCanvas(moonPos.azimuth, moonPos.altitude, width, height, mode, centerAz, showUnderground);
    if (moonProj.visible && (showUnderground || moonPos.altitude >= -14)) {
      const tiltRad = Astro.getMoonBrightLimbAngle(sunPos, moonPos, moonPhase.age < 14.765);
      drawMoonBody(targetCtx, moonProj.x, moonProj.y, moonPhase, moonPos.altitude < 0, tiltRad);
      if (moonPos.altitude >= -2 || showUnderground) {
        renderedMoon = { x: moonProj.x, y: moonProj.y, r: 22 };
      }
    }
    const sunProj = projectToCanvas(sunPos.azimuth, sunPos.altitude, width, height, mode, centerAz, showUnderground);
    if (sunProj.visible && (showUnderground || sunPos.altitude >= -14) && !forceDayStars) {
      drawSunBody(targetCtx, sunProj.x, sunProj.y, sunPos.altitude < 0);
    }
    targetCtx.restore();

    if (mode === 'dome') {
      targetCtx.restore();
    } else {
      drawPanoramaLandscape(targetCtx, width, height, horizonY, domeScale, centerAz, showUnderground, loc);
    }

    return { sunPos, moonPos, moonPhase, lighting, collectedHits, segmentsForHit, renderedMoon };
  }

  function drawSunBody(cCtx, x, y, isBelow) {
    cCtx.save();
    cCtx.globalAlpha = isBelow ? 0.4 : 1.0;
    const g = cCtx.createRadialGradient(x, y, 4, x, y, 36);
    g.addColorStop(0, '#fef08a');
    g.addColorStop(0.5, '#f59e0b');
    g.addColorStop(1, 'rgba(245, 158, 11, 0)');
    cCtx.fillStyle = g;
    cCtx.beginPath();
    cCtx.arc(x, y, 36, 0, Math.PI * 2);
    cCtx.fill();

    cCtx.fillStyle = '#fbbf24';
    cCtx.beginPath();
    cCtx.arc(x, y, 16, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.restore();
  }

  function drawMoonPhaseDisk(cCtx, cx, cy, r, phase, tiltRad) {
    cCtx.save();
    cCtx.translate(cx, cy);
    if (tiltRad) cCtx.rotate(tiltRad);

    // 暗い部分（ベタ塗り）
    cCtx.fillStyle = '#1e293b';
    cCtx.beginPath();
    cCtx.arc(0, 0, r, 0, Math.PI * 2);
    cCtx.fill();

    // 満ち欠けマスクを作成して光っている部分を描く（ベタ塗り）
    cCtx.save();
    cCtx.beginPath();
    const waxing = phase.age < 14.765;
    const k = Math.cos(phase.phaseAngle);
    cCtx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, !waxing);
    cCtx.ellipse(0, 0, Math.abs(r * k), r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k < 0);
    cCtx.closePath();
    cCtx.clip();

    cCtx.fillStyle = '#fef08a';
    cCtx.fillRect(-r, -r, r * 2, r * 2);
    cCtx.restore();

    // 輪郭の線
    cCtx.strokeStyle = 'rgba(254, 240, 138, 0.55)';
    cCtx.lineWidth = 1.2;
    cCtx.beginPath();
    cCtx.arc(0, 0, r, 0, Math.PI * 2);
    cCtx.stroke();

    cCtx.restore();
  }

  function drawMoonBody(cCtx, x, y, phase, isBelow, tiltRad) {
    cCtx.save();
    cCtx.globalAlpha = isBelow ? 0.35 : 0.96;
    drawMoonPhaseDisk(cCtx, x, y, 14, phase, tiltRad);

    cCtx.font = 'bold 10.5px "BIZ UDPGothic", sans-serif';
    cCtx.textAlign = 'center';
    cCtx.fillStyle = '#fef08a';
    cCtx.fillText(`月`, x, y + 25);
    cCtx.restore();
  }

  function drawPanoramaLandscape(cCtx, width, height, horizonY, domeScale, centerAz, showUnderground, loc) {
    cCtx.save();
    cCtx.globalAlpha = showUnderground ? 0.35 : 1.0;

    cCtx.fillStyle = '#1e293b';
    cCtx.beginPath();
    cCtx.moveTo(0, height);
    for (let px = 0; px <= width; px += 14) {
      const az = Astro.normDeg(centerAz + ((px - width * 0.5) / domeScale) * 40);
      const rad = az * Astro.DEG2RAD;
      const hill = Math.sin(rad * 2) * 18 + Math.cos(rad * 3 + 1.1) * 14 + Math.sin(rad * 5) * 7;
      cCtx.lineTo(px, horizonY - 20 - Math.max(-10, hill));
    }
    cCtx.lineTo(width, height);
    cCtx.closePath();
    cCtx.fill();

    const southP = projectToCanvas(180, 0, width, height, 'panorama', centerAz, true);
    if (southP.visible) {
      const sx = southP.x;
      cCtx.fillStyle = '#334155';
      cCtx.fillRect(sx - 44, horizonY - 34, 88, 34);
      cCtx.fillStyle = '#1e293b';
      cCtx.fillRect(sx - 10, horizonY - 52, 20, 18);
      cCtx.fillStyle = '#dc2626';
      cCtx.beginPath();
      cCtx.moveTo(sx - 13, horizonY - 52);
      cCtx.lineTo(sx, horizonY - 66);
      cCtx.lineTo(sx + 13, horizonY - 52);
      cCtx.closePath();
      cCtx.fill();
      cCtx.fillStyle = '#f8fafc';
      cCtx.beginPath();
      cCtx.arc(sx, horizonY - 43, 5, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.fillStyle = '#fde047';
      for (let wx = -34; wx <= 24; wx += 14) {
        if (Math.abs(wx) < 6) continue;
        cCtx.fillRect(sx + wx, horizonY - 26, 8, 8);
      }
    }

    const northP = projectToCanvas(0, 0, width, height, 'panorama', centerAz, true);
    if (northP.visible) {
      const nx = northP.x;
      cCtx.fillStyle = '#475569';
      cCtx.beginPath();
      cCtx.moveTo(nx - 10, horizonY);
      cCtx.lineTo(nx - 6, horizonY - 46);
      cCtx.lineTo(nx + 6, horizonY - 46);
      cCtx.lineTo(nx + 10, horizonY);
      cCtx.closePath();
      cCtx.fill();
      cCtx.fillStyle = '#fef08a';
      cCtx.beginPath();
      cCtx.arc(nx, horizonY - 50, 6, 0, Math.PI * 2);
      cCtx.fill();
    }

    const eastP = projectToCanvas(90, 0, width, height, 'panorama', centerAz, true);
    if (eastP.visible) {
      const ex = eastP.x;
      cCtx.fillStyle = '#0f172a';
      cCtx.fillRect(ex - 28, horizonY - 42, 18, 42);
      cCtx.fillRect(ex - 6, horizonY - 58, 22, 58);
      cCtx.fillRect(ex + 20, horizonY - 32, 16, 32);
    }

    const westP = projectToCanvas(270, 0, width, height, 'panorama', centerAz, true);
    if (westP.visible) {
      const wx = westP.x;
      cCtx.fillStyle = '#334155';
      cCtx.fillRect(wx - 4, horizonY - 45, 8, 45);
      cCtx.strokeStyle = '#94a3b8';
      cCtx.lineWidth = 2.5;
      cCtx.beginPath();
      cCtx.moveTo(wx - 18, horizonY - 56);
      cCtx.lineTo(wx + 18, horizonY - 30);
      cCtx.moveTo(wx + 18, horizonY - 56);
      cCtx.lineTo(wx - 18, horizonY - 30);
      cCtx.stroke();
    }

    const groundGrad = cCtx.createLinearGradient(0, horizonY, 0, height);
    if (loc.lat < -60 || loc.lat > 75) {
      groundGrad.addColorStop(0, '#334155');
      groundGrad.addColorStop(1, '#1e293b');
    } else {
      groundGrad.addColorStop(0, '#14532d');
      groundGrad.addColorStop(1, '#052e16');
    }
    cCtx.fillStyle = groundGrad;
    cCtx.fillRect(0, horizonY, width, height - horizonY);

    cCtx.strokeStyle = showUnderground ? 'rgba(148, 163, 184, 0.5)' : 'rgba(255, 255, 255, 0.25)';
    cCtx.lineWidth = 1.5;
    cCtx.beginPath();
    cCtx.moveTo(0, horizonY);
    cCtx.lineTo(width, horizonY);
    cCtx.stroke();

    cCtx.restore();
  }

  // ==========================================================
  // 5. 方位バッジ・ヒント・HUD更新
  // ==========================================================
  const COMPASS_POINTS = [
    { az: 0, kanji: '北', kana: 'きた', cls: 'is-cardinal-n' },
    { az: 45, kanji: '北東', kana: '', cls: 'is-sub' },
    { az: 90, kanji: '東', kana: 'ひがし', cls: '' },
    { az: 135, kanji: '南東', kana: '', cls: 'is-sub' },
    { az: 180, kanji: '南', kana: 'みなみ', cls: 'is-cardinal-s' },
    { az: 225, kanji: '南西', kana: '', cls: 'is-sub' },
    { az: 270, kanji: '西', kana: 'にし', cls: '' },
    { az: 315, kanji: '北西', kana: '', cls: 'is-sub' }
  ];

  function updateCompassBar(width, height) {
    if (state.viewMode === 'dome') {
      el.compassBar.innerHTML = '';
      return;
    }
    const html = [];
    COMPASS_POINTS.forEach(pt => {
      const p = projectToCanvas(pt.az, 0, width, height, 'panorama', state.viewAzimuth, true);
      if (!p.visible || p.x < 30 || p.x > width - 30) return;
      html.push(
        `<div class="compass-badge ${pt.cls}" style="left:${p.x.toFixed(1)}px">` +
          `<span class="cb-kanji">${pt.kanji}</span>` +
          (pt.kana ? `<span class="cb-kana">${pt.kana}</span>` : '') +
        `</div>`
      );
    });
    el.compassBar.innerHTML = html.join('');
  }

  function updateDirectionButtonsUI() {
    const az = Astro.normDeg(state.viewAzimuth);
    document.querySelectorAll('.dir-btn[data-az]').forEach(btn => {
      const bAz = Number(btn.dataset.az);
      const diff = Math.abs(shortestAzDiff(bAz, az));
      btn.classList.toggle('active', state.viewMode === 'panorama' && diff < 35);
    });
  }

  function updateBottomBarsPosition() {
    if (!el.controlPanel || !el.directionQuickBar || !el.compassBar) return;
    const panelH = el.controlPanel.offsetHeight || 86;
    el.directionQuickBar.style.bottom = `${panelH + 8}px`;
    el.compassBar.style.bottom = `${panelH + 46}px`;
  }

  function updateSelectedConstellationUI() {
    const con = state.selectedConstellationId ? Astro.CONSTELLATION_MAP[state.selectedConstellationId] : null;
    if (con) {
      el.selectedBar.classList.remove('hidden');
      el.selectedName.textContent = `✨ えらんだ星座: ${con.name}`;
      el.btnStampMain.disabled = false;
      el.btnStampMain.textContent = `📌 ${con.name}をのこす`;
    } else {
      el.selectedBar.classList.add('hidden');
      el.btnStampMain.disabled = true;
      el.btnStampMain.textContent = '📌 星座をのこす';
    }

    const cnt = state.stamps.length + state.moonStamps.length;
    el.stampCount.textContent = String(cnt);
    el.btnClearStamps.classList.toggle('hidden', cnt === 0);
  }

  function formatDateTimeShort(d) {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    if (state.use24Hour) {
      return `${m}/${day} ${h}:${min}`;
    }
    const ampm = h >= 12 ? '午後' : '午前';
    return `${m}/${day} ${ampm}${h % 12}:${min}`;
  }

  function updateHUD(renderInfo) {
    const d = state.currentDate;
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const w = weekdays[d.getDay()];

    el.displayDate.textContent = `${y}年 ${m}月 ${day}日 (${w})`;

    const h = d.getHours();
    const min = d.getMinutes();
    const padMin = String(min).padStart(2, '0');

    if (state.use24Hour) {
      el.displayAmpm.classList.add('hidden');
      el.displayTime.textContent = `${h} : ${padMin}`;
    } else {
      el.displayAmpm.classList.remove('hidden');
      const isPm = h >= 12;
      el.displayAmpm.textContent = isPm ? '午後' : '午前';
      el.displayAmpm.classList.toggle('is-day', h >= 6 && h < 18);
      el.displayTime.textContent = `${h % 12} : ${padMin}`;
    }

    el.timeSlider.value = h * 60 + min;

    const loc = state.location;
    el.displayLocName.textContent = loc.name;
    const latLabel = loc.lat >= 0 ? `北緯 ${loc.lat.toFixed(2)}°` : `南緯 ${Math.abs(loc.lat).toFixed(2)}°`;
    const lonLabel = loc.lon >= 0 ? `東経 ${loc.lon.toFixed(2)}°` : `西経 ${Math.abs(loc.lon).toFixed(2)}°`;
    el.displayLatLon.textContent = `${latLabel} / ${lonLabel}`;
  }

  function formatMinutesLabel(totalMin) {
    if (totalMin === null || totalMin === undefined) return '―';
    const norm = ((Math.round(totalMin) % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = String(norm % 60).padStart(2, '0');
    if (state.use24Hour) {
      return `${h}:${m}`;
    }
    const ampm = h >= 12 ? '午後' : '午前';
    return `${ampm}${h % 12}:${m}`;
  }

  function updateAstroAccordion(renderInfo) {
    if (!state.astroExpanded) return;

    const d = state.currentDate;
    const loc = state.location;
    const sunTimes = Astro.getSunTimes(d, loc.lat, loc.lon, loc.tz);
    const moonTimes = Astro.getMoonTimes(d, loc.lat, loc.lon, loc.tz);

    const sunGrid = document.getElementById('sun-times-content');
    if (sunTimes.polarState === 'always_up') {
      sunGrid.innerHTML = `<div class="polar-alert-badge">☀️ 白夜（1日中太陽がしずまない！ / 最高 ${Math.round(sunTimes.maxAlt)}°）</div>`;
    } else if (sunTimes.polarState === 'always_down') {
      sunGrid.innerHTML = `<div class="polar-alert-badge is-polar-night">🌑 極夜（1日中太陽がのぼらない！ / 最高 ${Math.round(sunTimes.maxAlt)}°）</div>`;
    } else {
      sunGrid.innerHTML = `
        <div><small>日の出</small><strong>${formatMinutesLabel(sunTimes.riseMin)}</strong></div>
        <div><small>一番高いとき</small><strong>${formatMinutesLabel(sunTimes.transitMin)} (${Math.round(sunTimes.maxAlt)}°)</strong></div>
        <div><small>日の入り</small><strong>${formatMinutesLabel(sunTimes.setMin)}</strong></div>
      `;
    }

    const moonGrid = document.getElementById('moon-times-content');
    if (moonTimes.polarState === 'always_up') {
      moonGrid.innerHTML = `<div class="polar-alert-badge">🌕 1日中 月がしずまない！（最高 ${Math.round(moonTimes.maxAlt)}°）</div>`;
    } else if (moonTimes.polarState === 'always_down') {
      moonGrid.innerHTML = `<div class="polar-alert-badge is-polar-night">🌑 今日は月が地平線の上にのぼらないよ</div>`;
    } else {
      moonGrid.innerHTML = `
        <div><small>月の出</small><strong>${formatMinutesLabel(moonTimes.riseMin)}</strong></div>
        <div><small>一番高いとき</small><strong>${formatMinutesLabel(moonTimes.transitMin)} (${Math.round(moonTimes.maxAlt)}°)</strong></div>
        <div><small>月の入り</small><strong>${formatMinutesLabel(moonTimes.setMin)}</strong></div>
      `;
    }

    const jd = Astro.toJulianDay(d, loc.tz);
    const moonPos = renderInfo ? renderInfo.moonPos : Astro.getMoonPosition(jd, loc.lat, loc.lon);
    const moonPhase = renderInfo ? renderInfo.moonPhase : Astro.getMoonPhase(jd);

    document.getElementById('moon-phase-name-chip').textContent = moonPhase.name;
    document.getElementById('moon-age-chip').textContent = `月齢 ${moonPhase.age.toFixed(1)}`;
    const badge = document.getElementById('moon-horizon-badge');
    const isUp = moonPos.altitude >= 0;
    badge.textContent = isUp ? '地上' : '地平線の下';
    badge.classList.toggle('is-below', !isUp);
  }

  function renderMoonZoomModal() {
    const d = state.currentDate;
    const loc = state.location;
    const jd = Astro.toJulianDay(d, loc.tz);
    const moonPos = Astro.getMoonPosition(jd, loc.lat, loc.lon);
    const moonPhase = Astro.getMoonPhase(jd);
    const moonTimes = Astro.getMoonTimes(d, loc.lat, loc.lon, loc.tz);
    const isSouthHemi = loc.lat < 0;

    const cvs = document.getElementById('moon-zoom-canvas');
    const mCtx = cvs.getContext('2d');
    mCtx.clearRect(0, 0, cvs.width, cvs.height);
    // 夜空風のほのかな星背景
    mCtx.fillStyle = '#020617';
    mCtx.fillRect(0, 0, cvs.width, cvs.height);
    drawMoonPhaseDisk(mCtx, cvs.width / 2, cvs.height / 2, 82, moonPhase, isSouthHemi ? Math.PI : 0);

    document.getElementById('moon-zoom-hemi-badge').classList.toggle('hidden', !isSouthHemi);
    document.getElementById('mz-phase-name').textContent = moonPhase.name;
    const statusEl = document.getElementById('mz-horizon-status');
    const isUp = moonPos.altitude >= 0;
    statusEl.textContent = isUp ? 'いま地上にあります' : 'いま地平線の下です';
    statusEl.classList.toggle('is-below', !isUp);

    document.getElementById('mz-age').textContent = moonPhase.age.toFixed(1);
    document.getElementById('mz-illum').textContent = `${Math.round(moonPhase.illum * 100)}%`;
    document.getElementById('mz-pos').textContent = `方位 ${Math.round(moonPos.azimuth)}° / 高さ ${Math.round(moonPos.altitude)}°`;

    let timesStr = '';
    if (moonTimes.polarState === 'always_up') {
      timesStr = `今日は1日中しずみません（最高 ${Math.round(moonTimes.maxAlt)}°）`;
    } else if (moonTimes.polarState === 'always_down') {
      timesStr = '今日は1日中 地平線の下にあります';
    } else {
      timesStr = `月の出: ${formatMinutesLabel(moonTimes.riseMin)} ／ 一番高いとき: ${formatMinutesLabel(moonTimes.transitMin)} ／ 月の入り: ${formatMinutesLabel(moonTimes.setMin)}`;
    }
    document.getElementById('mz-times-summary').textContent = timesStr;
  }

  function openMoonZoomModal() {
    state.moonZoomOpen = true;
    renderMoonZoomModal();
    openModal('modal-moon-zoom');
  }

  function updateLabelsOverlay(hits) {
    if ((!state.showConstNames && !state.showStarNames) || !hits || hits.length === 0) {
      el.labelsLayer.innerHTML = '';
      return;
    }

    const sorted = hits.slice().sort((a, b) => {
      if (a.kind === 'star' && b.kind !== 'star') return -1;
      if (a.kind !== 'star' && b.kind === 'star') return 1;
      return (b.isMajor ? 1 : 0) - (a.isMajor ? 1 : 0);
    });

    const placed = [];
    const fragments = [];
    const w = el.viewport.clientWidth;
    const h = el.viewport.clientHeight;

    sorted.forEach(item => {
      if (item.x < 30 || item.x > w - 30 || item.y < 105 || item.y > h - 140) return;
      const tooClose = placed.some(p => Math.abs(p.x - item.x) < 76 && Math.abs(p.y - item.y) < 22);
      if (tooClose) return;
      placed.push(item);

      const cls = item.kind === 'star'
        ? `sky-hit-chip star-chip${item.isMajor ? ' is-major' : ''}`
        : 'sky-hit-chip const-chip';

      fragments.push(
        `<button type="button" class="${cls}" data-kind="${item.kind}" data-id="${item.id}" style="left:${item.x.toFixed(1)}px;top:${item.y.toFixed(1)}px">${item.label}</button>`
      );
    });

    el.labelsLayer.innerHTML = fragments.join('');
  }

  // ==========================================================
  // 6. 比較モーダル描画
  // ==========================================================

  function renderCompareModal() {
    if (!state.compareOpen) return;

    const d = state.currentDate;
    const h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? '午後' : '午前';
    document.getElementById('cmp-current-time').textContent =
      `${d.getFullYear()}年 ${d.getMonth() + 1}月 ${d.getDate()}日 ${ampm} ${h % 12}:${min}`;

    if (state.compareMode === '4dir') {
      [0, 90, 180, 270].forEach(az => {
        const cvs = document.getElementById(`cmp-canvas-${az}`);
        if (!cvs) return;
        drawSkyScene(cvs.getContext('2d'), cvs.width, cvs.height, {
          date: state.currentDate,
          loc: state.location,
          mode: 'panorama',
          centerAz: az,
          showLines: true,
          showConstNames: false,
          showStarNames: false,
          showAsterisms: state.showAsterisms,
          showTrails: state.showTrails,
          showUnderground: false,
          forceDayStars: true,
          selectedConstId: state.selectedConstellationId,
          stamps: state.stamps,
          moonStamps: state.moonStamps,
          showPlanets: state.showPlanets,
          collectHits: false
        });
      });
    } else {
      const cvsA = document.getElementById('cmp-canvas-world-a');
      const cvsB = document.getElementById('cmp-canvas-world-b');
      if (cvsA) {
        drawSkyScene(cvsA.getContext('2d'), cvsA.width, cvsA.height, {
          date: state.currentDate,
          loc: state.compareLocA,
          mode: 'panorama',
          centerAz: state.compareDirA,
          showLines: true,
          showConstNames: state.showConstNames,
          showStarNames: state.showStarNames,
          showAsterisms: state.showAsterisms,
          showPlanets: state.showPlanets,
          showTrails: state.showTrails,
          showUnderground: false,
          forceDayStars: true,
          selectedConstId: null,
          stamps: [],
          moonStamps: [],
          collectHits: false
        });
        document.getElementById('cmp-world-info-a').textContent =
          `${state.compareLocA.name} (緯度 ${state.compareLocA.lat.toFixed(1)}°)`;
      }
      if (cvsB) {
        drawSkyScene(cvsB.getContext('2d'), cvsB.width, cvsB.height, {
          date: state.currentDate,
          loc: state.compareLocB,
          mode: 'panorama',
          centerAz: state.compareDirB,
          showLines: true,
          showConstNames: state.showConstNames,
          showStarNames: state.showStarNames,
          showAsterisms: state.showAsterisms,
          showPlanets: state.showPlanets,
          showTrails: state.showTrails,
          showUnderground: false,
          forceDayStars: true,
          selectedConstId: null,
          stamps: [],
          moonStamps: [],
          collectHits: false
        });
        document.getElementById('cmp-world-info-b').textContent =
          `${state.compareLocB.name} (緯度 ${state.compareLocB.lat.toFixed(1)}°)`;
      }
    }
  }

  // ==========================================================
  // 7. 星座線のヒット判定（タップ選択）
  // ==========================================================
  function distPointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function findConstellationAtPoint(px, py) {
    let bestId = null;
    let bestDist = 24; // タップしやすい許容半径 24px
    state.renderedSegments.forEach(seg => {
      const d = distPointToSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
      if (d < bestDist) {
        bestDist = d;
        bestId = seg.constId;
      }
    });
    return bestId;
  }

  // ==========================================================
  // 8. メインレンダリング & アニメーションループ
  // ==========================================================
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = el.viewport.clientWidth;
    const h = el.viewport.clientHeight;
    if (el.canvas.width !== Math.floor(w * dpr) || el.canvas.height !== Math.floor(h * dpr)) {
      el.canvas.width = Math.floor(w * dpr);
      el.canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function renderAll() {
    const { w, h } = resizeCanvas();
    const info = drawSkyScene(ctx, w, h, {
      date: state.currentDate,
      loc: state.location,
      mode: state.viewMode,
      centerAz: state.viewAzimuth,
      showLines: state.showLines,
      showConstNames: state.showConstNames,
      showStarNames: state.showStarNames,
      showAsterisms: state.showAsterisms,
      showPlanets: state.showPlanets,
      showTrails: state.showTrails,
      showUnderground: state.showUnderground,
      forceDayStars: state.forceDayStars,
      selectedConstId: state.selectedConstellationId,
      stamps: state.stamps,
      moonStamps: state.moonStamps,
      collectHits: true
    });

    state.renderedSegments = info.segmentsForHit;
    state.renderedMoon = info.renderedMoon;
    updateCompassBar(w, h);
    updateDirectionButtonsUI();
    updateSelectedConstellationUI();
    updateBottomBarsPosition();
    updateHUD(info);
    updateAstroAccordion(info);
    updateLabelsOverlay(info.collectedHits);
    renderCompareModal();
    if (state.moonZoomOpen) renderMoonZoomModal();
  }

  let lastTs = performance.now();
  function animateLoop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;
    let needsRender = false;

    if (state.isPlaying || (state.compareOpen && state.comparePlaying)) {
      const addMs = dt * state.playSpeed * 60 * 1000;
      state.currentDate = new Date(state.currentDate.getTime() + addMs);
      needsRender = true;
    }

    if (state.targetAzimuth !== null) {
      const diff = shortestAzDiff(state.targetAzimuth, state.viewAzimuth);
      if (Math.abs(diff) < 0.6) {
        state.viewAzimuth = state.targetAzimuth;
        state.targetAzimuth = null;
      } else {
        state.viewAzimuth = Astro.normDeg(state.viewAzimuth + diff * Math.min(1, dt * 10));
      }
      needsRender = true;
    }

    if (needsRender) {
      renderAll();
    }
    requestAnimationFrame(animateLoop);
  }

  // ==========================================================
  // 9. モーダル & 蛍光スタンプ操作
  // ==========================================================
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    if (id === 'modal-compare') {
      state.compareOpen = false;
      state.comparePlaying = false;
    } else if (id === 'modal-moon-zoom') {
      state.moonZoomOpen = false;
    }
  }

  function stampSelectedConstellation() {
    if (!state.selectedConstellationId) return;
    const con = Astro.CONSTELLATION_MAP[state.selectedConstellationId];
    if (!con) return;

    const jd = Astro.toJulianDay(state.currentDate, state.location.tz);
    const color = NEON_COLORS[state.stamps.length % NEON_COLORS.length];
    const dateTimeLabel = formatDateTimeShort(state.currentDate);

    const set = new Set();
    con.lines.forEach(([a, b]) => {
      set.add(a);
      set.add(b);
    });

    const posMap = {};
    const stars = [];
    Array.from(set).forEach(sid => {
      const s = Astro.STAR_MAP[sid];
      if (!s) return;
      const p = Astro.equatorialToHorizontal(s.ra, s.dec, jd, state.location.lat, state.location.lon);
      posMap[sid] = { az: p.azimuth, alt: p.altitude };
      stars.push({ az: p.azimuth, alt: p.altitude });
    });

    const lines = [];
    con.lines.forEach(([a, b]) => {
      if (posMap[a] && posMap[b]) lines.push([posMap[a], posMap[b]]);
    });

    state.stamps.push({
      constId: con.id,
      name: con.name,
      color,
      dateTimeLabel,
      stars,
      lines
    });
    renderAll();
  }

  function stampCurrentMoon() {
    const jd = Astro.toJulianDay(state.currentDate, state.location.tz);
    const moonPos = Astro.getMoonPosition(jd, state.location.lat, state.location.lon);
    const sunPos = Astro.getSunPosition(jd, state.location.lat, state.location.lon);
    const phase = Astro.getMoonPhase(jd);
    const tiltRad = Astro.getMoonBrightLimbAngle(sunPos, moonPos, phase.age < 14.765);
    const color = NEON_COLORS[(state.stamps.length + state.moonStamps.length) % NEON_COLORS.length];

    state.moonStamps.push({
      az: moonPos.azimuth,
      alt: moonPos.altitude,
      phase,
      tiltRad,
      dateTimeLabel: formatDateTimeShort(state.currentDate),
      color
    });
    renderAll();
  }

  function getMoonCalendarBadge(age) {
    if (age < 1.0 || age >= 28.5) return '新月';
    if (age >= 2.0 && age < 3.8) return '三日月';
    if (age >= 6.8 && age < 8.1) return '上弦';
    if (age >= 14.2 && age < 15.6) return '満月';
    if (age >= 21.6 && age < 22.9) return '下弦';
    return '';
  }

  function renderCalendarModal() {
    const year = state.calYear || state.currentDate.getFullYear();
    const month = state.calMonth || (state.currentDate.getMonth() + 1);
    const hour = state.calHour;
    const isSouthHemi = state.location.lat < 0;

    document.getElementById('cal-month-title').textContent = `${year}年 ${month}月`;
    document.getElementById('cal-hour-select').value = String(hour);

    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';

    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let i = 0; i < firstWeekday; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-cell is-empty';
      grid.appendChild(empty);
    }

    const curY = state.currentDate.getFullYear();
    const curM = state.currentDate.getMonth() + 1;
    const curD = state.currentDate.getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d, hour, 0, 0);
      const jd = Astro.toJulianDay(dt, state.location.tz);
      const phase = Astro.getMoonPhase(jd);
      const dow = dt.getDay();
      const badge = getMoonCalendarBadge(phase.age);

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell';
      if (dow === 0) cell.classList.add('is-sun');
      if (dow === 6) cell.classList.add('is-sat');
      if (year === curY && month === curM && d === curD) cell.classList.add('is-selected');

      const dayNum = document.createElement('span');
      dayNum.className = 'cal-day-num';
      dayNum.textContent = String(d);

      const cvs = document.createElement('canvas');
      cvs.className = 'cal-moon-canvas';
      cvs.width = 38;
      cvs.height = 38;
      const cCtx = cvs.getContext('2d');
      drawMoonPhaseDisk(cCtx, 19, 19, 15, phase, isSouthHemi ? Math.PI : 0);

      const ageText = document.createElement('span');
      ageText.className = 'cal-age-text';
      ageText.textContent = `月齢 ${phase.age.toFixed(1)}`;

      const tag = document.createElement('span');
      tag.className = 'cal-phase-tag';
      tag.textContent = badge || ' ';

      cell.appendChild(dayNum);
      cell.appendChild(cvs);
      cell.appendChild(ageText);
      cell.appendChild(tag);

      cell.addEventListener('click', () => {
        state.currentDate = new Date(year, month - 1, d, hour, 0, 0);
        closeModal('modal-calendar');
        renderAll();
      });

      grid.appendChild(cell);
    }
  }

  function openCalendarModal() {
    state.calYear = state.currentDate.getFullYear();
    state.calMonth = state.currentDate.getMonth() + 1;
    renderCalendarModal();
    openModal('modal-calendar');
  }

  function renderLocationList(groupIdx) {
    const container = document.getElementById('location-list-container');
    if (groupIdx === 'custom') {
      container.innerHTML = `
        <div class="custom-loc-form">
          <label>場所の名前
            <input type="text" id="custom-loc-name" value="${state.location.name}">
          </label>
          <label>緯度（北緯は＋、南緯は−）
            <input type="number" id="custom-loc-lat" step="0.01" min="-90" max="90" value="${state.location.lat}">
          </label>
          <label>経度（東経は＋、西経は−）
            <input type="number" id="custom-loc-lon" step="0.01" min="-180" max="180" value="${state.location.lon}">
          </label>
          <label>時差（日本は 9）
            <input type="number" id="custom-loc-tz" step="1" min="-12" max="14" value="${state.location.tz}">
          </label>
        </div>
        <div style="margin-top:14px; text-align:right;">
          <button type="button" id="btn-apply-custom-loc" class="btn-primary">この緯度・経度で見る</button>
        </div>
      `;
      document.getElementById('btn-apply-custom-loc').addEventListener('click', () => {
        const name = document.getElementById('custom-loc-name').value.trim() || '自由な地点';
        const lat = Math.max(-89.99, Math.min(89.99, parseFloat(document.getElementById('custom-loc-lat').value) || 32.96));
        const lon = Math.max(-180, Math.min(180, parseFloat(document.getElementById('custom-loc-lon').value) || 131.9));
        const tz = Math.max(-12, Math.min(14, parseFloat(document.getElementById('custom-loc-tz').value) || 9));
        state.location = { id: 'custom', name, lat, lon, tz };
        state.stamps = [];
        state.moonStamps = [];
        closeModal('modal-location');
        renderAll();
      });
      return;
    }

    const group = LOCATION_PRESETS[Number(groupIdx)] || LOCATION_PRESETS[0];
    const itemsHtml = group.items.map(item => {
      const selected = item.name === state.location.name ? 'selected' : '';
      const latStr = item.lat >= 0 ? `北緯${item.lat.toFixed(2)}°` : `南緯${Math.abs(item.lat).toFixed(2)}°`;
      const lonStr = item.lon >= 0 ? `東経${item.lon.toFixed(2)}°` : `西経${Math.abs(item.lon).toFixed(2)}°`;
      return `
        <button type="button" class="loc-item-btn ${selected}" data-id="${item.id}">
          <span class="loc-item-name">${item.name}</span>
          <span class="loc-item-meta">${latStr} / ${lonStr}</span>
          ${item.badge ? `<span class="loc-item-badge">${item.badge}</span>` : ''}
        </button>
      `;
    }).join('');
    container.innerHTML = `<div class="loc-grid">${itemsHtml}</div>`;

    container.querySelectorAll('.loc-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const found = group.items.find(i => i.id === btn.dataset.id);
        if (found) {
          state.location = { ...found };
          state.stamps = [];
          state.moonStamps = [];
          closeModal('modal-location');
          renderAll();
        }
      });
    });
  }

  function populateCompareWorldSelects() {
    const allItems = LOCATION_PRESETS.flatMap(g => g.items);
    const selA = document.getElementById('cmp-world-loc-a');
    const selB = document.getElementById('cmp-world-loc-b');
    const opts = allItems.map((it, i) => `<option value="${i}">${it.name}</option>`).join('');
    selA.innerHTML = opts;
    selB.innerHTML = opts;

    const idxA = allItems.findIndex(x => x.id === 'oita-saiki');
    const idxB = allItems.findIndex(x => x.id === 'world-sydney');
    if (idxA >= 0) selA.value = String(idxA);
    if (idxB >= 0) selB.value = String(idxB);

    selA.onchange = () => {
      state.compareLocA = { ...allItems[Number(selA.value)] };
      renderCompareModal();
    };
    selB.onchange = () => {
      state.compareLocB = { ...allItems[Number(selB.value)] };
      renderCompareModal();
    };
    document.getElementById('cmp-world-dir-a').onchange = e => {
      state.compareDirA = Number(e.target.value);
      renderCompareModal();
    };
    document.getElementById('cmp-world-dir-b').onchange = e => {
      state.compareDirB = Number(e.target.value);
      renderCompareModal();
    };
  }

  function openStarInfoModal(kind, id) {
    const body = document.getElementById('star-info-body');
    const jd = Astro.toJulianDay(state.currentDate, state.location.tz);

    if (kind === 'star') {
      const s = Astro.STAR_MAP[id];
      if (!s) return;
      const pos = Astro.equatorialToHorizontal(s.ra, s.dec, jd, state.location.lat, state.location.lon);
      const col = COLOR_MAP[s.color] || '#fff';
      const colorNames = { blue: '青白（とても高温）', white: '白（高温）', yellow: '黄白（太陽と同じくらい）', orange: 'オレンジ（やや低温）', red: '赤（低温）' };
      body.innerHTML = `
        <div class="star-card-detail">
          <div class="star-hero">
            <div class="star-orb" style="background:${col}; box-shadow:0 0 24px ${col};"></div>
            <div class="star-hero-text">
              <h3>⭐ ${s.name}</h3>
              <div class="star-hero-meta">${s.constellation} ／ 明るさ: ${s.mag.toFixed(1)}等星 ／ 色: ${colorNames[s.color] || s.color}</div>
              <div class="star-hero-meta">いまの位置: 方位 ${Math.round(pos.azimuth)}° / 高さ ${Math.round(pos.altitude)}° ${s.temp ? `/ 表面温度 ${s.temp}` : ''}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      const c = Astro.CONSTELLATION_MAP[id];
      if (!c) return;
      body.innerHTML = `
        <div class="star-card-detail">
          <div class="star-hero">
            <div class="star-orb" style="background:#38bdf8; box-shadow:0 0 24px #38bdf8;"></div>
            <div class="star-hero-text">
              <h3>✨ ${c.name} <small style="font-size:12px;">(${c.ruby})</small></h3>
              <div class="star-hero-meta">見やすい季節: ${c.season}</div>
            </div>
          </div>
        </div>
      `;
    }
    openModal('modal-star-info');
  }

  function initDatetimeModal() {
    const selY = document.getElementById('dt-year');
    const selM = document.getElementById('dt-month');
    const selD = document.getElementById('dt-day');
    const selH = document.getElementById('dt-hour');
    const selMin = document.getElementById('dt-minute');

    for (let y = 2024; y <= 2032; y++) selY.innerHTML += `<option value="${y}">${y}年</option>`;
    for (let m = 1; m <= 12; m++) selM.innerHTML += `<option value="${m}">${m}月</option>`;
    for (let d = 1; d <= 31; d++) selD.innerHTML += `<option value="${d}">${d}日</option>`;
    for (let h = 0; h <= 23; h++) selH.innerHTML += `<option value="${h}">${h}時</option>`;
    for (let m = 0; m <= 55; m += 5) selMin.innerHTML += `<option value="${m}">${String(m).padStart(2, '0')}分</option>`;

    document.getElementById('btn-open-datetime').addEventListener('click', () => {
      const cd = state.currentDate;
      selY.value = String(cd.getFullYear());
      selM.value = String(cd.getMonth() + 1);
      selD.value = String(cd.getDate());
      selH.value = String(cd.getHours());
      selMin.value = String(Math.floor(cd.getMinutes() / 5) * 5);
      openModal('modal-datetime');
    });

    document.getElementById('btn-dt-today').addEventListener('click', () => {
      state.currentDate = createDefaultEveningDate();
      closeModal('modal-datetime');
      renderAll();
    });

    document.getElementById('btn-dt-apply').addEventListener('click', () => {
      state.currentDate = new Date(
        Number(selY.value),
        Number(selM.value) - 1,
        Number(selD.value),
        Number(selH.value),
        Number(selMin.value),
        0
      );
      closeModal('modal-datetime');
      renderAll();
    });
  }

  // ==========================================================
  // 10. イベント登録 & 起動
  // ==========================================================
  function bindEvents() {
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragMoved = false;
    let dragStartAz = 180;

    el.viewport.addEventListener('pointerdown', e => {
      if (
        e.target.closest('.sky-hit-chip') ||
        e.target.closest('#direction-quick-bar') ||
        e.target.closest('#selected-const-bar') ||
        e.target.closest('.space-card')
      ) {
        return;
      }
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartAz = state.viewAzimuth;
      state.targetAzimuth = null;
      el.viewport.setPointerCapture(e.pointerId);
    });

    el.viewport.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.hypot(dx, dy) > 7) dragMoved = true;
      if (state.viewMode === 'dome' || !dragMoved) return;

      const degPerPx = 150 / Math.max(el.viewport.clientWidth, 400);
      state.viewAzimuth = Astro.normDeg(dragStartAz - dx * degPerPx);
      renderAll();
    });

    el.viewport.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      try { el.viewport.releasePointerCapture(e.pointerId); } catch (_) {}

      // ドラッグではなくタップ/クリックだった場合：まず月、次に星座線を選択
      if (!dragMoved) {
        const rect = el.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        if (state.renderedMoon && Math.hypot(px - state.renderedMoon.x, py - state.renderedMoon.y) <= state.renderedMoon.r + 8) {
          openMoonZoomModal();
          return;
        }
        const hitConstId = findConstellationAtPoint(px, py);
        state.selectedConstellationId = hitConstId;
        renderAll();
      }
    });

    // 太陽・月データ折りたたみトグル＆月拡大モーダル起動
    document.getElementById('btn-toggle-astro').addEventListener('click', () => {
      state.astroExpanded = !state.astroExpanded;
      document.getElementById('astro-collapse-body').classList.toggle('hidden', !state.astroExpanded);
      document.getElementById('btn-toggle-astro').setAttribute('aria-expanded', String(state.astroExpanded));
      document.getElementById('astro-accordion-arrow').textContent = state.astroExpanded ? '▲ とじる' : '▼ ひらく';
      updateAstroAccordion();
    });

    document.getElementById('btn-open-moon-zoom-bar').addEventListener('click', openMoonZoomModal);
    document.getElementById('btn-open-moon-zoom').addEventListener('click', e => {
      e.stopPropagation();
      openMoonZoomModal();
    });

    // カレンダーモーダル
    document.getElementById('btn-open-calendar').addEventListener('click', openCalendarModal);
    document.getElementById('cal-prev-month').addEventListener('click', () => {
      if (state.calMonth <= 1) {
        state.calYear -= 1;
        state.calMonth = 12;
      } else {
        state.calMonth -= 1;
      }
      renderCalendarModal();
    });
    document.getElementById('cal-next-month').addEventListener('click', () => {
      if (state.calMonth >= 12) {
        state.calYear += 1;
        state.calMonth = 1;
      } else {
        state.calMonth += 1;
      }
      renderCalendarModal();
    });
    document.getElementById('cal-hour-select').addEventListener('change', e => {
      state.calHour = Number(e.target.value);
      renderCalendarModal();
    });

    el.viewport.addEventListener('pointercancel', () => { dragging = false; });

    // ラベルタップ時
    el.labelsLayer.addEventListener('click', e => {
      const chip = e.target.closest('.sky-hit-chip');
      if (!chip) return;
      if (chip.dataset.kind === 'constellation') {
        state.selectedConstellationId = chip.dataset.id;
        renderAll();
      } else {
        openStarInfoModal(chip.dataset.kind, chip.dataset.id);
      }
    });

    // 選択中アクションバー & スタンプ（星座＋月）
    document.getElementById('btn-stamp-selected').addEventListener('click', stampSelectedConstellation);
    document.getElementById('btn-stamp-const').addEventListener('click', stampSelectedConstellation);
    document.getElementById('btn-stamp-moon').addEventListener('click', stampCurrentMoon);
    document.getElementById('btn-moon-zoom-stamp').addEventListener('click', () => {
      stampCurrentMoon();
      closeModal('modal-moon-zoom');
    });
    document.getElementById('btn-deselect-const').addEventListener('click', () => {
      state.selectedConstellationId = null;
      renderAll();
    });
    document.getElementById('btn-clear-stamps').addEventListener('click', () => {
      state.stamps = [];
      state.moonStamps = [];
      renderAll();
    });

    // 方角ワンタップボタン
    document.querySelectorAll('.dir-btn[data-az]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.viewMode = 'panorama';
        document.getElementById('btn-toggle-dome').classList.remove('active');
        state.targetAzimuth = Number(btn.dataset.az);
        updateDirectionButtonsUI();
      });
    });

    document.getElementById('btn-toggle-dome').addEventListener('click', function () {
      state.viewMode = state.viewMode === 'dome' ? 'panorama' : 'dome';
      this.classList.toggle('active', state.viewMode === 'dome');
      renderAll();
    });

    // 日付操作
    document.getElementById('btn-prev-day').addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() - 86400000);
      renderAll();
    });
    document.getElementById('btn-next-day').addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() + 86400000);
      renderAll();
    });

    // 季節ジャンプ
    document.querySelectorAll('.season-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = Number(btn.dataset.month);
        const day = Number(btn.dataset.day);
        const cur = state.currentDate;
        state.currentDate = new Date(cur.getFullYear(), m - 1, day, 20, 0, 0);
        document.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderAll();
      });
    });

    // 24h切替
    document.getElementById('btn-toggle-24h').addEventListener('click', function () {
      state.use24Hour = !state.use24Hour;
      this.textContent = state.use24Hour ? '午前/午後' : '24h表示';
      renderAll();
    });

    // 左・右カード＆下部パネルのコンパクト折りたたみ
    document.getElementById('btn-toggle-time-hud').addEventListener('click', function () {
      state.timeHudCollapsed = !state.timeHudCollapsed;
      document.getElementById('hud-left-card').classList.toggle('is-collapsed', state.timeHudCollapsed);
      this.textContent = state.timeHudCollapsed ? '▼ ひらく' : '▲ かくす';
    });

    document.getElementById('btn-toggle-data').addEventListener('click', function () {
      state.dataCollapsed = !state.dataCollapsed;
      el.hudDataBody.classList.toggle('hidden', state.dataCollapsed);
      this.textContent = state.dataCollapsed ? '▼ ひらく' : '▲ かくす';
    });

    document.getElementById('btn-toggle-ctrl-row').addEventListener('click', function () {
      state.ctrlCollapsed = !state.ctrlCollapsed;
      document.getElementById('ctrl-toggles-row').classList.toggle('hidden', state.ctrlCollapsed);
      this.textContent = state.ctrlCollapsed ? '▲ ひらく' : '▼ かくす';
      updateBottomBarsPosition();
    });

    // 再生コントロール
    document.getElementById('btn-play-pause').addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      el.btnPlayPause.textContent = state.isPlaying ? '⏸' : '▶';
      el.btnPlayPause.classList.toggle('playing', state.isPlaying);
    });
    document.getElementById('btn-step-back').addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() - 3600000);
      renderAll();
    });
    document.getElementById('btn-step-fwd').addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() + 3600000);
      renderAll();
    });
    el.timeSlider.addEventListener('input', e => {
      const mins = Number(e.target.value);
      const d = state.currentDate;
      state.currentDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mins / 60), mins % 60, 0);
      renderAll();
    });
    document.querySelectorAll('.btn-time-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = Number(btn.dataset.minutes);
        const d = state.currentDate;
        state.currentDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mins / 60), mins % 60, 0);
        renderAll();
      });
    });
    document.getElementById('play-speed-select').addEventListener('change', e => {
      state.playSpeed = Number(e.target.value);
    });

    // 表示トグル
    const toggles = [
      ['toggle-lines', 'showLines'],
      ['toggle-const-names', 'showConstNames'],
      ['toggle-star-names', 'showStarNames'],
      ['toggle-asterisms', 'showAsterisms'],
      ['toggle-planets', 'showPlanets'],
      ['toggle-trails', 'showTrails'],
      ['toggle-underground', 'showUnderground'],
      ['toggle-daystars', 'forceDayStars']
    ];
    toggles.forEach(([domId, key]) => {
      document.getElementById(domId).addEventListener('click', function () {
        state[key] = !state[key];
        this.classList.toggle('active', state[key]);
        renderAll();
      });
    });

    // 地点モーダル
    document.getElementById('btn-open-location').addEventListener('click', () => {
      renderLocationList(0);
      document.querySelectorAll('.loc-tab').forEach((t, idx) => t.classList.toggle('active', idx === 0));
      openModal('modal-location');
    });
    document.querySelectorAll('.loc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.loc-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderLocationList(tab.dataset.group);
      });
    });

    // 比較モーダル
    document.getElementById('btn-open-compare').addEventListener('click', () => {
      state.compareOpen = true;
      populateCompareWorldSelects();
      openModal('modal-compare');
      renderCompareModal();
    });
    document.querySelectorAll('.cmp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cmp-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.compareMode = tab.dataset.cmpmode;
        document.getElementById('compare-4dir-grid').classList.toggle('hidden', state.compareMode !== '4dir');
        document.getElementById('compare-world-grid').classList.toggle('hidden', state.compareMode !== 'world');
        renderCompareModal();
      });
    });
    document.getElementById('cmp-play-pause').addEventListener('click', function () {
      state.comparePlaying = !state.comparePlaying;
      this.textContent = state.comparePlaying ? '⏸ いったん停止' : '▶ 4方向どうじ再生';
    });
    document.getElementById('cmp-step-back').addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() - 3600000);
      renderAll();
    });
    document.getElementById('cmp-step-fwd').addEventListener('click', () => {
      state.currentDate = new Date(state.currentDate.getTime() + 3600000);
      renderAll();
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', e => {
        if (e.target === bd) closeModal(bd.id);
      });
    });

    window.addEventListener('resize', renderAll);
    initDatetimeModal();
  }

  function boot() {
    initIOSGuardsAndNoCache();
    bindEvents();
    renderAll();
    requestAnimationFrame(() => {
      updateBottomBarsPosition();
      requestAnimationFrame(animateLoop);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
