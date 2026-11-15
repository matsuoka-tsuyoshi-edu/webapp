/**
 * astro.js - 天文計算エンジン & 恒星・星座カタログモジュール
 * 対象: ほしぞらナビ（星座と星の動きシミュレーション）
 *
 * - J2000.0赤道座標（赤経RA, 赤緯Dec）から観測地の地方恒星時・地平座標（方位角, 高度）を計算
 * - 太陽・月の概算位置および空の明るさ判定
 * - 主要恒星カタログ（1等星〜3等星、約120星）＋天球上の背景星（約240星）
 * - 主要22星座＋大三角・北極星ガイド（アステリズム）データ
 */

(function (global) {
  'use strict';

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function normDeg(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    return d;
  }

  /**
   * 現地時刻（Dateオブジェクトの年月日時分を観測地ローカル時刻として扱う）と
   * タイムゾーンオフセット(時間, 日本=+9)からユリウス日(JD)を計算
   */
  function toJulianDay(localDate, tzOffsetHours) {
    const tz = typeof tzOffsetHours === 'number' ? tzOffsetHours : 9;
    // localDate の getFullYear() 等を「観測地の現地時刻」とみなしてUTC時刻を算出
    const utcMs = Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      localDate.getSeconds()
    ) - tz * 3600 * 1000;
    return utcMs / 86400000 + 2440587.5;
  }

  /**
   * グリニッジ平均恒星時(GMST)および地方恒星時(LST) [度]
   */
  function getLocalSiderealTime(jd, lonDeg) {
    const T = (jd - 2451545.0) / 36525.0;
    const gmst =
      280.46061837 +
      360.98564736629 * (jd - 2451545.0) +
      0.000387933 * T * T -
      (T * T * T) / 38710000.0;
    return normDeg(gmst + lonDeg);
  }

  /**
   * 赤道座標 (raDeg, decDeg) -> 地平座標 { azimuth, altitude }
   * azimuth: 北=0, 東=90, 南=180, 西=270
   * altitude: 地平線=0, 天頂=+90, 天底=-90
   */
  function equatorialToHorizontal(raDeg, decDeg, jd, latDeg, lonDeg) {
    const lst = getLocalSiderealTime(jd, lonDeg);
    const haRad = normDeg(lst - raDeg) * DEG2RAD;
    const decRad = decDeg * DEG2RAD;
    const latRad = latDeg * DEG2RAD;

    const sinAlt =
      Math.sin(decRad) * Math.sin(latRad) +
      Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const y = -Math.sin(haRad) * Math.cos(decRad);
    const x =
      Math.sin(decRad) * Math.cos(latRad) -
      Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad);
    let az = Math.atan2(y, x) * RAD2DEG;
    az = normDeg(az);

    return {
      azimuth: az,
      altitude: altRad * RAD2DEG
    };
  }

  /**
   * 太陽の概算位置 (J2000ベース)
   */
  function getSunPosition(jd, latDeg, lonDeg) {
    const d = jd - 2451545.0;
    const g = normDeg(357.529 + 0.98560028 * d) * DEG2RAD;
    const q = normDeg(280.459 + 0.98564736 * d);
    const L = normDeg(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG2RAD;
    const e = (23.439 - 0.00000036 * d) * DEG2RAD;

    const ra = normDeg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) * RAD2DEG);
    const dec = Math.asin(Math.sin(e) * Math.sin(L)) * RAD2DEG;

    const pos = equatorialToHorizontal(ra, dec, jd, latDeg, lonDeg);
    return { ...pos, ra, dec };
  }

  /**
   * 月の概算位置と月齢
   */
  function getMoonPosition(jd, latDeg, lonDeg) {
    const d = jd - 2451545.0;
    const L = normDeg(218.316 + 13.176396 * d);
    const M = normDeg(134.963 + 13.064993 * d) * DEG2RAD;
    const F = normDeg(93.272 + 13.229350 * d) * DEG2RAD;

    const lon = (L + 6.289 * Math.sin(M)) * DEG2RAD;
    const lat = (5.128 * Math.sin(F)) * DEG2RAD;
    const eps = 23.439 * DEG2RAD;

    const sinDec =
      Math.sin(lat) * Math.cos(eps) +
      Math.cos(lat) * Math.sin(eps) * Math.sin(lon);
    const dec = Math.asin(Math.max(-1, Math.min(1, sinDec))) * RAD2DEG;

    const y = Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps);
    const x = Math.cos(lon);
    const ra = normDeg(Math.atan2(y, x) * RAD2DEG);

    const pos = equatorialToHorizontal(ra, dec, jd, latDeg, lonDeg);
    return { ...pos, ra, dec };
  }

  function getMoonPhase(jd) {
    const knownNewMoon = 2451550.09766;
    const synodicMonth = 29.530588853;
    const age = ((jd - knownNewMoon) % synodicMonth + synodicMonth) % synodicMonth;
    const phaseAngle = (age / synodicMonth) * 2 * Math.PI;
    const illum = (1 - Math.cos(phaseAngle)) / 2;
    let name = '新月';
    let desc = '太陽と同じ方向にあるため、地球からはほとんど見えません。';
    if (age < 1.5 || age >= 28.0) {
      name = '新月';
      desc = '太陽と同じ方向にあるため、光っている面が反対側を向いていて地球からは見えません。';
    } else if (age < 5.5) {
      name = '三日月';
      desc = '夕方の西の空に、ほそい弓のような形で見えます。太陽が沈んだあと少しして西へ沈みます。';
    } else if (age < 9.5) {
      name = '上弦の月';
      desc = 'ちょうど右半分（南半球では左半分）が光る半月です。昼ごろにのぼり、夕方南の高い空に見えて、真夜中ごろに沈みます。';
    } else if (age < 13.5) {
      name = '十三夜';
      desc = '満月に近く、丸みに向かって少しずつふくらんでいる明るい月です。';
    } else if (age < 16.5) {
      name = '満月';
      desc = '太陽と反対側にあるため、丸く全部が光って見えます！夕方東からのぼり、真夜中に一番高くなり、明け方に西へ沈みます。';
    } else if (age < 20.5) {
      name = '寝待月';
      desc = '満月をすぎて少し欠けはじめた月で、夜の遅い時間に東から昇ってきます。';
    } else if (age < 24.5) {
      name = '下弦の月';
      desc = '上弦の月とは反対側の半分が光る半月です。真夜中ごろに東からのぼり、明け方に南の空で見え、昼ごろに沈みます。';
    } else {
      name = '有明の月';
      desc = '明け方の東の空にほそく光って見える、新月直前の月です。';
    }
    return { age, illum, name, phaseAngle, desc };
  }

  /**
   * 1日の出・南中・入・白夜/極夜を算出する共通ヘルパー
   */
  function computeRiseTransitSet(localDate, latDeg, lonDeg, tzOffset, posFn, thresholdAlt) {
    const baseMidnight = new Date(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      0, 0, 0
    );
    const baseJd = toJulianDay(baseMidnight, tzOffset);

    let riseMin = null;
    let setMin = null;
    let maxAlt = -999;
    let maxMin = 0;
    let maxAz = 180;
    let minAlt = 999;

    let prevAlt = null;
    for (let m = 0; m <= 1440; m += 10) {
      const jd = baseJd + m / 1440;
      const pos = posFn(jd, latDeg, lonDeg);
      const alt = pos.altitude;

      if (alt > maxAlt) {
        maxAlt = alt;
        maxMin = m;
        maxAz = pos.azimuth;
      }
      if (alt < minAlt) {
        minAlt = alt;
      }

      if (prevAlt !== null) {
        if (prevAlt < thresholdAlt && alt >= thresholdAlt && riseMin === null) {
          const frac = (thresholdAlt - prevAlt) / (alt - prevAlt || 1e-6);
          riseMin = Math.round((m - 10) + frac * 10);
        } else if (prevAlt >= thresholdAlt && alt < thresholdAlt && setMin === null) {
          const frac = (thresholdAlt - prevAlt) / (alt - prevAlt || 1e-6);
          setMin = Math.round((m - 10) + frac * 10);
        }
      }
      prevAlt = alt;
    }

    // 南中時刻を1分刻みで微調整
    const startFine = Math.max(0, maxMin - 10);
    const endFine = Math.min(1440, maxMin + 10);
    for (let m = startFine; m <= endFine; m += 1) {
      const pos = posFn(baseJd + m / 1440, latDeg, lonDeg);
      if (pos.altitude > maxAlt) {
        maxAlt = pos.altitude;
        maxMin = m;
        maxAz = pos.azimuth;
      }
    }

    let polarState = 'normal';
    if (minAlt >= thresholdAlt) {
      polarState = 'always_up';
    } else if (maxAlt < thresholdAlt) {
      polarState = 'always_down';
    }

    return {
      riseMin,
      setMin,
      transitMin: maxMin,
      maxAlt,
      transitAz: maxAz,
      polarState
    };
  }

  function getSunTimes(localDate, latDeg, lonDeg, tzOffset) {
    return computeRiseTransitSet(localDate, latDeg, lonDeg, tzOffset, getSunPosition, -0.833);
  }

  function getMoonTimes(localDate, latDeg, lonDeg, tzOffset) {
    return computeRiseTransitSet(localDate, latDeg, lonDeg, tzOffset, getMoonPosition, 0.0);
  }

  /**
   * 恒星カタログ
   * ra: 赤経(度 = 時*15), dec: 赤緯(度), mag: 等級, color: 'blue'|'white'|'yellow'|'orange'|'red'
   */
  const STARS_DATA = [
    // --- こぐま座 (UMi) ---
    { id: 'polaris', name: '北極星 (ポラリス)', ruby: 'ほっきょくせい', constellation: 'こぐま座', ra: 37.95, dec: 89.26, mag: 1.98, color: 'yellow', isMajor: true, temp: '約6,000℃', desc: '北の空でほとんど動かない特別な星！北極星の地面からの高さ（高度）を測ると、自分がいる場所の「北緯」がわかります。佐伯市では約33°の高さに見えます。' },
    { id: 'umi_del', name: 'イルドゥン', constellation: 'こぐま座', ra: 263.05, dec: 86.59, mag: 4.35, color: 'white' },
    { id: 'umi_eps', name: 'ウルシ・ミノリスε', constellation: 'こぐま座', ra: 251.49, dec: 82.04, mag: 4.21, color: 'yellow' },
    { id: 'umi_zet', name: 'アリファ', constellation: 'こぐま座', ra: 236.01, dec: 77.79, mag: 4.29, color: 'white' },
    { id: 'umi_bet', name: 'コカブ', constellation: 'こぐま座', ra: 222.68, dec: 74.16, mag: 2.07, color: 'orange' },
    { id: 'umi_gam', name: 'フェルカド', constellation: 'こぐま座', ra: 230.18, dec: 71.83, mag: 3.00, color: 'white' },
    { id: 'umi_eta', name: 'アンワル', constellation: 'こぐま座', ra: 244.38, dec: 75.76, mag: 4.95, color: 'white' },

    // --- おおぐま座 / 北斗七星 (UMa) ---
    { id: 'dubhe', name: 'ドゥーベ', constellation: 'おおぐま座', ra: 165.93, dec: 61.75, mag: 1.81, color: 'orange', desc: '北斗七星のひしゃくの先端にある星。メラクと結んで北へ5倍のばすと北極星が見つかります。' },
    { id: 'merak', name: 'メラク', constellation: 'おおぐま座', ra: 165.46, dec: 56.38, mag: 2.34, color: 'white' },
    { id: 'phecda', name: 'フェクダ', constellation: 'おおぐま座', ra: 178.46, dec: 53.69, mag: 2.41, color: 'white' },
    { id: 'megrez', name: 'メグレズ', constellation: 'おおぐま座', ra: 183.86, dec: 57.03, mag: 3.32, color: 'white' },
    { id: 'alioth', name: 'アリオト', constellation: 'おおぐま座', ra: 193.51, dec: 55.96, mag: 1.76, color: 'white' },
    { id: 'mizar', name: 'ミザール', constellation: 'おおぐま座', ra: 200.98, dec: 54.93, mag: 2.23, color: 'white' },
    { id: 'alkaid', name: 'アルカイド', constellation: 'おおぐま座', ra: 206.89, dec: 49.31, mag: 1.85, color: 'blue', desc: '北斗七星の柄（え）の端の星。ここから曲線をのばすと「春の大曲線」になります。' },

    // --- カシオペヤ座 (Cas) ---
    { id: 'cas_bet', name: 'カフ', constellation: 'カシオペヤ座', ra: 2.29, dec: 59.15, mag: 2.28, color: 'white' },
    { id: 'cas_alp', name: 'シェダル', constellation: 'カシオペヤ座', ra: 10.13, dec: 56.54, mag: 2.24, color: 'orange' },
    { id: 'cas_gam', name: 'ツィー', constellation: 'カシオペヤ座', ra: 14.18, dec: 60.72, mag: 2.15, color: 'blue' },
    { id: 'cas_del', name: 'ルクバ', constellation: 'カシオペヤ座', ra: 21.45, dec: 60.24, mag: 2.66, color: 'white' },
    { id: 'cas_eps', name: 'セギン', constellation: 'カシオペヤ座', ra: 28.60, dec: 63.67, mag: 3.35, color: 'blue' },

    // --- こと座 (Lyr) ---
    { id: 'vega', name: 'ベガ (おりひめ星)', ruby: 'べが', constellation: 'こと座', ra: 279.23, dec: 38.78, mag: 0.03, color: 'blue', isMajor: true, temp: '約9,600℃', desc: '七夕の「おりひめ星」として有名な青白い1等星。夏の大三角の1つで、とても明るくかがやきます。' },
    { id: 'lyr_eps', name: 'ダブルダブル', constellation: 'こと座', ra: 281.08, dec: 39.67, mag: 4.60, color: 'white' },
    { id: 'lyr_zet', name: 'こと座ζ', constellation: 'こと座', ra: 281.19, dec: 37.60, mag: 4.34, color: 'white' },
    { id: 'lyr_bet', name: 'シェリアク', constellation: 'こと座', ra: 282.52, dec: 33.36, mag: 3.52, color: 'blue' },
    { id: 'lyr_gam', name: 'スラファト', constellation: 'こと座', ra: 284.74, dec: 32.69, mag: 3.25, color: 'blue' },

    // --- わし座 (Aql) ---
    { id: 'altair', name: 'アルタイル (ひこ星)', ruby: 'あるたいる', constellation: 'わし座', ra: 297.70, dec: 8.87, mag: 0.76, color: 'white', isMajor: true, temp: '約7,500℃', desc: '七夕の「ひこ星」として有名な1等星。天の川をはさんでおりひめ星（ベガ）と向かい合っています。夏の大三角の1つです。' },
    { id: 'aql_gam', name: 'タラゼド', constellation: 'わし座', ra: 296.56, dec: 10.61, mag: 2.72, color: 'orange' },
    { id: 'aql_bet', name: 'アルシャイン', constellation: 'わし座', ra: 298.83, dec: 6.41, mag: 3.71, color: 'yellow' },
    { id: 'aql_del', name: 'わし座δ', constellation: 'わし座', ra: 291.37, dec: 3.11, mag: 3.36, color: 'white' },
    { id: 'aql_zet', name: 'オカブ', constellation: 'わし座', ra: 286.35, dec: 13.86, mag: 2.99, color: 'white' },
    { id: 'aql_lam', name: 'わし座λ', constellation: 'わし座', ra: 286.56, dec: -4.88, mag: 3.43, color: 'blue' },
    { id: 'aql_the', name: 'わし座θ', constellation: 'わし座', ra: 302.83, dec: -0.82, mag: 3.24, color: 'blue' },

    // --- はくちょう座 (Cyg) ---
    { id: 'deneb', name: 'デネブ', ruby: 'でねぶ', constellation: 'はくちょう座', ra: 310.36, dec: 45.28, mag: 1.25, color: 'white', isMajor: true, temp: '約8,500℃', desc: 'はくちょう座のしっぽでかがやく1等星。夏の大三角の1つです。太陽の何万倍も明るい巨大な星です。' },
    { id: 'cyg_gam', name: 'サドル', constellation: 'はくちょう座', ra: 305.56, dec: 40.26, mag: 2.23, color: 'yellow' },
    { id: 'cyg_eps', name: 'ギェナー', constellation: 'はくちょう座', ra: 311.55, dec: 33.97, mag: 2.48, color: 'orange' },
    { id: 'cyg_del', name: 'ファワリス', constellation: 'はくちょう座', ra: 296.24, dec: 45.13, mag: 2.86, color: 'blue' },
    { id: 'albireo', name: 'アルビレオ', constellation: 'はくちょう座', ra: 292.68, dec: 27.96, mag: 3.05, color: 'yellow', desc: 'はくちょうのくちばしの星。望遠鏡で見るとオレンジと青の2つの星が並ぶ美しい二重星です。' },

    // --- さそり座 (Sco) ---
    { id: 'antares', name: 'アンタレス', ruby: 'あんたれす', constellation: 'さそり座', ra: 247.35, dec: -26.43, mag: 1.06, color: 'red', isMajor: true, temp: '約3,500℃', desc: '夏の南の空低くに赤く光るさそり座の心臓の1等星。赤い色をしているため「火星に対抗するもの」という意味の名前がついています。' },
    { id: 'sco_bet', name: 'アクラブ', constellation: 'さそり座', ra: 241.36, dec: -19.81, mag: 2.56, color: 'blue' },
    { id: 'sco_del', name: 'ジュバ', constellation: 'さそり座', ra: 240.08, dec: -22.62, mag: 2.29, color: 'blue' },
    { id: 'sco_pi', name: 'さそり座π', constellation: 'さそり座', ra: 239.71, dec: -26.11, mag: 2.89, color: 'blue' },
    { id: 'sco_tau', name: 'アルニヤト', constellation: 'さそり座', ra: 248.97, dec: -28.22, mag: 2.82, color: 'blue' },
    { id: 'sco_eps', name: 'ララワグラ', constellation: 'さそり座', ra: 252.54, dec: -34.29, mag: 2.29, color: 'orange' },
    { id: 'sco_zet', name: 'さそり座ζ', constellation: 'さそり座', ra: 253.65, dec: -42.36, mag: 3.62, color: 'orange' },
    { id: 'sco_eta', name: 'さそり座η', constellation: 'さそり座', ra: 258.04, dec: -43.24, mag: 3.32, color: 'white' },
    { id: 'sco_the', name: 'サルガス', constellation: 'さそり座', ra: 264.33, dec: -42.99, mag: 1.86, color: 'yellow' },
    { id: 'sco_kap', name: 'ギルタブ', constellation: 'さそり座', ra: 265.62, dec: -39.03, mag: 2.39, color: 'blue' },
    { id: 'shaula', name: 'シャウラ', constellation: 'さそり座', ra: 263.40, dec: -37.10, mag: 1.62, color: 'blue' },

    // --- いて座 (Sgr) 南斗六星 ---
    { id: 'sgr_sig', name: 'ヌンキ', constellation: 'いて座', ra: 283.82, dec: -26.30, mag: 2.05, color: 'blue' },
    { id: 'sgr_phi', name: 'いて座φ', constellation: 'いて座', ra: 281.41, dec: -26.99, mag: 3.17, color: 'blue' },
    { id: 'sgr_lam', name: 'カウス・ボレアリス', constellation: 'いて座', ra: 276.99, dec: -25.42, mag: 2.82, color: 'orange' },
    { id: 'sgr_mu', name: 'ポリス', constellation: 'いて座', ra: 273.44, dec: -21.06, mag: 3.84, color: 'blue' },
    { id: 'sgr_tau', name: 'いて座τ', constellation: 'いて座', ra: 286.74, dec: -27.67, mag: 3.32, color: 'orange' },
    { id: 'sgr_zet', name: 'アスケラ', constellation: 'いて座', ra: 285.65, dec: -29.88, mag: 2.60, color: 'white' },
    { id: 'sgr_del', name: 'カウス・メディア', constellation: 'いて座', ra: 275.25, dec: -29.83, mag: 2.72, color: 'orange' },
    { id: 'sgr_eps', name: 'カウス・アウストラリス', constellation: 'いて座', ra: 276.04, dec: -34.38, mag: 1.79, color: 'blue' },

    // --- オリオン座 (Ori) ---
    { id: 'betelgeuse', name: 'ベテルギウス', ruby: 'べてるぎうす', constellation: 'オリオン座', ra: 88.79, dec: 7.41, mag: 0.45, color: 'red', isMajor: true, temp: '約3,500℃', desc: 'オリオン座の左上の肩に赤くかがやく1等星。温度が低いため赤色に見えます。冬の大三角の1つです。' },
    { id: 'rigel', name: 'リゲル', ruby: 'りげる', constellation: 'オリオン座', ra: 78.63, dec: -8.20, mag: 0.18, color: 'blue', isMajor: true, temp: '約11,000℃', desc: 'オリオン座の足元で青白く強く光る1等星。とても高温なので青白い色をしています。' },
    { id: 'bellatrix', name: 'ベラトリックス', constellation: 'オリオン座', ra: 81.28, dec: 6.35, mag: 1.64, color: 'blue' },
    { id: 'saiph', name: 'サイフ', constellation: 'オリオン座', ra: 86.94, dec: -9.67, mag: 2.07, color: 'blue' },
    { id: 'mintaka', name: 'ミンタカ (三つ星)', constellation: 'オリオン座', ra: 83.00, dec: -0.30, mag: 2.25, color: 'blue' },
    { id: 'alnilam', name: 'アルニラム (三つ星)', constellation: 'オリオン座', ra: 84.05, dec: -1.20, mag: 1.69, color: 'blue' },
    { id: 'alnitak', name: 'アルニタク (三つ星)', constellation: 'オリオン座', ra: 85.19, dec: -1.94, mag: 1.74, color: 'blue' },

    // --- おおいぬ座 (CMa) ---
    { id: 'sirius', name: 'シリウス', ruby: 'しりうす', constellation: 'おおいぬ座', ra: 101.29, dec: -16.72, mag: -1.46, color: 'blue', isMajor: true, temp: '約10,000℃', desc: '太陽をのぞく全天の星の中で一番明るくかがやく-1.5等星！青白く美しく光り、冬の大三角の1つです。' },
    { id: 'cma_bet', name: 'ミルザム', constellation: 'おおいぬ座', ra: 95.67, dec: -17.96, mag: 1.98, color: 'blue' },
    { id: 'cma_del', name: 'ウェズン', constellation: 'おおいぬ座', ra: 107.10, dec: -26.39, mag: 1.83, color: 'yellow' },
    { id: 'cma_eps', name: 'アダーラ', constellation: 'おおいぬ座', ra: 104.66, dec: -28.97, mag: 1.50, color: 'blue' },
    { id: 'cma_eta', name: 'アルドラ', constellation: 'おおいぬ座', ra: 111.02, dec: -29.30, mag: 2.45, color: 'blue' },
    { id: 'cma_omi', name: 'おおいぬ座ο2', constellation: 'おおいぬ座', ra: 105.76, dec: -23.83, mag: 3.02, color: 'blue' },

    // --- こいぬ座 (CMi) ---
    { id: 'procyon', name: 'プロキオン', ruby: 'ぷろきおん', constellation: 'こいぬ座', ra: 114.83, dec: 5.22, mag: 0.40, color: 'yellow', isMajor: true, temp: '約6,500℃', desc: '冬の大三角の1つをつくる明るい1等星。少し黄みがかった白色に光ります。' },
    { id: 'cmi_bet', name: 'ゴメイサ', constellation: 'こいぬ座', ra: 111.79, dec: 8.29, mag: 2.89, color: 'blue' },

    // --- おうし座 (Tau) ---
    { id: 'aldebaran', name: 'アルデバラン', ruby: 'あるでばらん', constellation: 'おうし座', ra: 68.98, dec: 16.51, mag: 0.87, color: 'orange', isMajor: true, temp: '約4,000℃', desc: '冬のダイヤモンドの1つで、オレンジ色に光るおうし座の目の1等星。オリオン座の三つ星を右上にのばすと見つかります。' },
    { id: 'tau_bet', name: 'エルナト', constellation: 'おうし座', ra: 81.57, dec: 28.61, mag: 1.65, color: 'blue' },
    { id: 'tau_zet', name: '天関', constellation: 'おうし座', ra: 84.41, dec: 21.14, mag: 2.97, color: 'blue' },
    { id: 'tau_gam', name: 'ヒアデスγ', constellation: 'おうし座', ra: 64.95, dec: 15.63, mag: 3.65, color: 'yellow' },
    { id: 'tau_eps', name: 'アイン', constellation: 'おうし座', ra: 67.15, dec: 19.18, mag: 3.53, color: 'orange' },
    { id: 'subaru', name: 'すばる (プレアデス星団)', ruby: 'すばる', constellation: 'おうし座', ra: 56.87, dec: 24.11, mag: 1.60, color: 'blue', desc: '青白い星がぎゅっと集まって見える「星のあつまり（星団）」。目だけで6〜7個の星が見えます。' },

    // --- ふたご座 (Gem) ---
    { id: 'castor', name: 'カストル', constellation: 'ふたご座', ra: 113.65, dec: 31.89, mag: 1.58, color: 'white' },
    { id: 'pollux', name: 'ポルックス', ruby: 'ぽるっくす', constellation: 'ふたご座', ra: 116.33, dec: 28.03, mag: 1.16, color: 'orange', isMajor: true, temp: '約4,900℃', desc: 'ふたご座の弟の頭でオレンジ色に光る1等星。兄のカストルと仲よく並んでいます。' },
    { id: 'gem_gam', name: 'アルヘナ', constellation: 'ふたご座', ra: 99.43, dec: 16.40, mag: 1.93, color: 'white' },
    { id: 'gem_mu', name: 'テジャト', constellation: 'ふたご座', ra: 95.74, dec: 22.51, mag: 2.87, color: 'red' },
    { id: 'gem_eps', name: 'メブスタ', constellation: 'ふたご座', ra: 100.98, dec: 25.13, mag: 3.06, color: 'yellow' },
    { id: 'gem_del', name: 'ワサト', constellation: 'ふたご座', ra: 110.03, dec: 21.98, mag: 3.50, color: 'white' },

    // --- ぎょしゃ座 (Aur) ---
    { id: 'capella', name: 'カペラ', ruby: 'かぺら', constellation: 'ぎょしゃ座', ra: 79.17, dec: 46.00, mag: 0.08, color: 'yellow', isMajor: true, temp: '約5,000℃', desc: '冬の空の高いところに黄色く明るくかがやく1等星。実は太陽に似た2つの大きな星が回る二重星です。' },
    { id: 'aur_bet', name: 'メンカリナン', constellation: 'ぎょしゃ座', ra: 89.88, dec: 44.95, mag: 1.90, color: 'white' },
    { id: 'aur_the', name: 'マハシム', constellation: 'ぎょしゃ座', ra: 89.93, dec: 37.21, mag: 2.65, color: 'white' },
    { id: 'aur_iot', name: 'ハッサレ', constellation: 'ぎょしゃ座', ra: 74.25, dec: 33.17, mag: 2.69, color: 'orange' },
    { id: 'aur_eta', name: 'ヘゼ', constellation: 'ぎょしゃ座', ra: 76.63, dec: 41.23, mag: 3.18, color: 'blue' },
    { id: 'aur_south', name: 'ぎょしゃ座南星', constellation: 'ぎょしゃ座', ra: 82.60, dec: 33.80, mag: 3.70, color: 'white' },

    // --- しし座 (Leo) ---
    { id: 'regulus', name: 'レグルス', ruby: 'れぐるす', constellation: 'しし座', ra: 152.09, dec: 11.97, mag: 1.36, color: 'blue', isMajor: true, temp: '約12,000℃', desc: '春のしし座の心臓で青白く光る1等星。ライオンの頭の部分は「ししの大がま（？マークの逆）」と呼ばれます。' },
    { id: 'denebola', name: 'デネボラ', constellation: 'しし座', ra: 177.26, dec: 14.57, mag: 2.14, color: 'white', desc: 'しし座のしっぽの星。春の大三角の1つです。' },
    { id: 'leo_gam', name: 'アルギエバ', constellation: 'しし座', ra: 154.99, dec: 19.84, mag: 2.01, color: 'orange' },
    { id: 'leo_zet', name: 'アダフェラ', constellation: 'しし座', ra: 154.17, dec: 23.42, mag: 3.44, color: 'white' },
    { id: 'leo_mu', name: 'ラサラス', constellation: 'しし座', ra: 148.19, dec: 26.01, mag: 3.88, color: 'orange' },
    { id: 'leo_eps', name: 'アルゲヌビ', constellation: 'しし座', ra: 146.46, dec: 23.77, mag: 2.97, color: 'yellow' },
    { id: 'leo_del', name: 'ゾスマ', constellation: 'しし座', ra: 168.53, dec: 20.52, mag: 2.56, color: 'white' },
    { id: 'leo_the', name: 'シェルタン', constellation: 'しし座', ra: 168.56, dec: 15.43, mag: 3.34, color: 'white' },

    // --- うしかい座 (Boo) ---
    { id: 'arcturus', name: 'アークトゥルス', ruby: 'あーくとぅるす', constellation: 'うしかい座', ra: 213.92, dec: 19.18, mag: -0.05, color: 'orange', isMajor: true, temp: '約4,300℃', desc: '春の空で一番明るくオレンジ色に光る1等星。「春の大三角」と「春の大曲線」の目印です。' },
    { id: 'boo_eps', name: 'イザール', constellation: 'うしかい座', ra: 221.25, dec: 27.07, mag: 2.35, color: 'orange' },
    { id: 'boo_eta', name: 'ムフリッド', constellation: 'うしかい座', ra: 208.67, dec: 18.40, mag: 2.68, color: 'yellow' },
    { id: 'boo_gam', name: 'セギヌス', constellation: 'うしかい座', ra: 218.02, dec: 38.31, mag: 3.04, color: 'white' },
    { id: 'boo_bet', name: 'ネッカル', constellation: 'うしかい座', ra: 225.49, dec: 40.39, mag: 3.49, color: 'yellow' },
    { id: 'boo_del', name: 'うしかい座δ', constellation: 'うしかい座', ra: 228.88, dec: 33.31, mag: 3.46, color: 'yellow' },

    // --- おとめ座 (Vir) ---
    { id: 'spica', name: 'スピカ', ruby: 'すぴか', constellation: 'おとめ座', ra: 201.30, dec: -11.16, mag: 0.98, color: 'blue', isMajor: true, temp: '約22,000℃', desc: '春の夜空に青白く清らかに光る1等星。「真珠星」とも呼ばれ、春の大三角の1つです。' },
    { id: 'vir_gam', name: 'ポリマ', constellation: 'おとめ座', ra: 190.42, dec: -1.45, mag: 2.74, color: 'white' },
    { id: 'vir_eps', name: 'ビンデミアトリックス', constellation: 'おとめ座', ra: 195.54, dec: 10.96, mag: 2.85, color: 'yellow' },
    { id: 'vir_zet', name: 'ヘゼ', constellation: 'おとめ座', ra: 203.67, dec: -0.60, mag: 3.38, color: 'white' },
    { id: 'vir_del', name: 'ミネラウバ', constellation: 'おとめ座', ra: 193.90, dec: 3.40, mag: 3.39, color: 'red' },

    // --- ペガスス座 (Peg) 秋の四辺形 ---
    { id: 'peg_alp', name: 'マルカブ', constellation: 'ペガスス座', ra: 346.19, dec: 15.21, mag: 2.49, color: 'blue' },
    { id: 'peg_bet', name: 'シェアト', constellation: 'ペガスス座', ra: 345.94, dec: 28.08, mag: 2.44, color: 'red' },
    { id: 'peg_gam', name: 'アルゲニブ', constellation: 'ペガスス座', ra: 3.31, dec: 15.18, mag: 2.83, color: 'blue' },
    { id: 'peg_eps', name: 'エニフ', constellation: 'ペガスス座', ra: 326.05, dec: 9.88, mag: 2.38, color: 'orange' },
    { id: 'peg_zet', name: 'ホマム', constellation: 'ペガスス座', ra: 340.37, dec: 10.83, mag: 3.41, color: 'blue' },

    // --- アンドロメダ座 (And) ---
    { id: 'and_alp', name: 'アルフェラッツ', constellation: 'アンドロメダ座', ra: 2.10, dec: 29.09, mag: 2.07, color: 'blue', desc: '秋の四辺形の1つの角をつくる2等星です。' },
    { id: 'and_bet', name: 'ミラク', constellation: 'アンドロメダ座', ra: 17.43, dec: 35.62, mag: 2.07, color: 'red' },
    { id: 'and_gam', name: 'アルマク', constellation: 'アンドロメダ座', ra: 30.97, dec: 42.33, mag: 2.10, color: 'orange' },
    { id: 'and_del', name: 'アンドロメダ座δ', constellation: 'アンドロメダ座', ra: 9.83, dec: 30.86, mag: 3.27, color: 'orange' },
    { id: 'and_mu', name: 'アンドロメダ座μ', constellation: 'アンドロメダ座', ra: 14.19, dec: 38.50, mag: 3.86, color: 'white' },
    { id: 'and_nu', name: 'アンドロメダ座ν', constellation: 'アンドロメダ座', ra: 12.45, dec: 41.08, mag: 4.53, color: 'blue' },

    // --- みなみのうお座 (PsA) ---
    { id: 'fomalhaut', name: 'フォーマルハウト', ruby: 'ふぉーまるはうと', constellation: 'みなみのうお座', ra: 344.41, dec: -29.62, mag: 1.16, color: 'white', isMajor: true, temp: '約8,600℃', desc: '秋の南の空にぽつんと1つだけ明るく光る1等星。周りに明るい星がないため「秋の一つ星」とも呼ばれます。' },
    { id: 'psa_eps', name: 'みなみのうお座ε', constellation: 'みなみのうお座', ra: 340.16, dec: -27.04, mag: 4.18, color: 'blue' },
    { id: 'psa_del', name: 'みなみのうお座δ', constellation: 'みなみのうお座', ra: 343.99, dec: -32.54, mag: 4.20, color: 'yellow' },

    // --- 南天の星座 (海外・低緯度で見える星) ---
    // みなみじゅうじ座 (Cru)
    { id: 'acrux', name: 'アクルックス', ruby: 'あくるっくす', constellation: 'みなみじゅうじ座', ra: 186.65, dec: -63.10, mag: 0.77, color: 'blue', isMajor: true, temp: '約28,000℃', desc: '南十字星の一番下でかがやく青白い1等星！日本では沖縄南部以南でないと見えませんが、オーストラリアなど南半球では一年中見られる大切な道しるべです。' },
    { id: 'mimosa', name: 'ミモザ (ベクルックス)', ruby: 'みもざ', constellation: 'みなみじゅうじ座', ra: 191.93, dec: -59.69, mag: 1.25, color: 'blue', isMajor: true, temp: '約27,000℃', desc: '南十字星の東側（左）で青白くかがやく1等星。' },
    { id: 'gacrux', name: 'ガクルックス', constellation: 'みなみじゅうじ座', ra: 187.79, dec: -57.11, mag: 1.59, color: 'red', desc: '南十字星のてっぺんで赤っぽく光る星。' },
    { id: 'cru_del', name: 'イマイ', constellation: 'みなみじゅうじ座', ra: 183.79, dec: -58.75, mag: 2.79, color: 'blue' },

    // ケンタウルス座 (Cen)
    { id: 'rigil_kent', name: 'アルファ・ケンタウリ', ruby: 'あるふぁ・けんたうり', constellation: 'ケンタウルス座', ra: 219.90, dec: -60.83, mag: -0.01, color: 'yellow', isMajor: true, temp: '約5,800℃', desc: '太陽をのぞくと地球に一番近い恒星（約4.3光年）！全天で3番目に明るい1等星で、南十字星の近くでハダルと並んで光ります。' },
    { id: 'hadar', name: 'ハダル (ベータ・ケンタウリ)', ruby: 'はだる', constellation: 'ケンタウルス座', ra: 210.96, dec: -60.37, mag: 0.61, color: 'blue', isMajor: true, temp: '約25,000℃', desc: '南十字星のすぐ隣で青白くかがやく1等星。アルファ・ケンタウリとともに「南十字星を指さす星」と呼ばれます。' },
    { id: 'cen_the', name: 'メンケント', constellation: 'ケンタウルス座', ra: 211.67, dec: -36.37, mag: 2.06, color: 'orange' },
    { id: 'cen_gam', name: 'ムリファイン', constellation: 'ケンタウルス座', ra: 190.38, dec: -48.96, mag: 2.20, color: 'white' },

    // りゅうこつ座 (Car)
    { id: 'canopus', name: 'カノープス', ruby: 'かのーぷす', constellation: 'りゅうこつ座', ra: 95.99, dec: -52.70, mag: -0.74, color: 'yellow', isMajor: true, temp: '約7,300℃', desc: 'シリウスに次いで全天で2番目に明るい恒星！日本では冬の南の地平線すれすれに少しだけ見えるため「見ると長生きする星」と言われますが、オーストラリアなどでは高い空に見えます。' },
    { id: 'car_bet', name: 'ミアプラキドゥス', constellation: 'りゅうこつ座', ra: 138.30, dec: -69.72, mag: 1.67, color: 'white' },
    { id: 'car_eps', name: 'アビオール', constellation: 'りゅうこつ座', ra: 125.63, dec: -59.51, mag: 1.86, color: 'orange' },
    { id: 'car_iot', name: 'アスピディスケ', constellation: 'りゅうこつ座', ra: 139.27, dec: -59.28, mag: 2.21, color: 'white' }
  ];

  // 天球上の背景星（4〜5等星相当）を確定シードで生成（星座と同じように日周運動する）
  const BACKGROUND_STARS = [];
  (function generateBackgroundStars() {
    let seed = 42197;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    const colors = ['white', 'blue', 'yellow', 'orange'];
    for (let i = 0; i < 240; i++) {
      const ra = rand() * 360;
      const u = rand() * 2 - 1;
      const dec = Math.asin(u) * RAD2DEG;
      const mag = 3.6 + rand() * 1.9;
      const color = colors[Math.floor(rand() * colors.length)];
      BACKGROUND_STARS.push({ ra, dec, mag, color });
    }
  })();

  /**
   * 22星座カタログ
   */
  const CONSTELLATIONS_DATA = [
    {
      id: 'umi',
      name: 'こぐま座',
      ruby: 'こぐまざ',
      season: '北の空（一年中）',
      centerStar: 'polaris',
      lines: [
        ['polaris', 'umi_del'], ['umi_del', 'umi_eps'], ['umi_eps', 'umi_zet'],
        ['umi_zet', 'umi_bet'], ['umi_bet', 'umi_gam'], ['umi_gam', 'umi_eta'], ['umi_eta', 'umi_zet']
      ],
      motif: 'bear_small',
      desc: 'しっぽの先が「北極星」になっている小さなひしゃく形の星座です。北の空で一年中見ることができます。',
      point4th: '北極星はほとんど動かず、まわりの星が北極星を中心に反時計回り（左回り）に1時間で約15°ずつ回ります。'
    },
    {
      id: 'uma',
      name: 'おおぐま座 (北斗七星)',
      ruby: 'おおぐまざ（ほくとしちせい）',
      season: '北の空・春',
      centerStar: 'alioth',
      lines: [
        ['dubhe', 'merak'], ['merak', 'phecda'], ['phecda', 'megrez'], ['megrez', 'dubhe'],
        ['megrez', 'alioth'], ['alioth', 'mizar'], ['mizar', 'alkaid']
      ],
      motif: 'dipper',
      desc: '大きなひしゃくの形をした「北斗七星」で有名な星座です。春から夏にかけて北の高い空でよく見えます。',
      point4th: '水をくむ部分の2つの星（メラクとドゥーベ）を5倍のばすと「北極星」が見つかります！'
    },
    {
      id: 'cas',
      name: 'カシオペヤ座',
      ruby: 'かしおぺやざ',
      season: '北の空・秋',
      centerStar: 'cas_gam',
      lines: [
        ['cas_bet', 'cas_alp'], ['cas_alp', 'cas_gam'], ['cas_gam', 'cas_del'], ['cas_del', 'cas_eps']
      ],
      motif: 'crown',
      desc: 'アルファベットの「M」や「W」の形にならんだ5つの星が目印の星座です。秋から冬にかけて高い空に見えます。',
      point4th: 'Wの左右の線をのばして交わった点と真ん中の星を結んで5倍のばすと「北極星」が見つかります！'
    },
    {
      id: 'lyr',
      name: 'こと座',
      ruby: 'ことざ',
      season: '夏',
      centerStar: 'vega',
      lines: [
        ['vega', 'lyr_eps'], ['vega', 'lyr_zet'], ['lyr_zet', 'lyr_bet'],
        ['lyr_bet', 'lyr_gam'], ['lyr_gam', 'lyr_zet']
      ],
      motif: 'harp',
      desc: '1等星ベガ（おりひめ星）と小さな平行四辺形が目印の美しい星座です。夏の大三角の1つを作ります。',
      point4th: '夏の大三角の星は、夕方東からのぼり、真夜中に頭の真上（天頂）近くを通り、明け方に西へしずみます。'
    },
    {
      id: 'aql',
      name: 'わし座',
      ruby: 'わしざ',
      season: '夏',
      centerStar: 'altair',
      lines: [
        ['aql_gam', 'altair'], ['altair', 'aql_bet'], ['altair', 'aql_del'],
        ['aql_del', 'aql_lam'], ['aql_del', 'aql_zet'], ['aql_del', 'aql_the']
      ],
      motif: 'eagle',
      desc: '1等星アルタイル（ひこ星）を中心に、大きな翼を広げたワシの姿をした夏の星座です。',
      point4th: 'ひこ星（アルタイル）はおりひめ星（ベガ）と天の川をはさんで向かい合っています。'
    },
    {
      id: 'cyg',
      name: 'はくちょう座',
      ruby: 'はくちょうざ',
      season: '夏',
      centerStar: 'cyg_gam',
      lines: [
        ['deneb', 'cyg_gam'], ['cyg_gam', 'albireo'],
        ['cyg_del', 'cyg_gam'], ['cyg_gam', 'cyg_eps']
      ],
      motif: 'swan',
      desc: '大きな十字の形「北十字星」が天の川の上を飛ぶように見える夏の星座です。しっぽの星が1等星デネブです。',
      point4th: 'ベガ・アルタイル・デネブの3つの1等星を結ぶと「夏の大三角」になります。'
    },
    {
      id: 'sco',
      name: 'さそり座',
      ruby: 'さそりざ',
      season: '夏',
      centerStar: 'antares',
      lines: [
        ['sco_bet', 'sco_del'], ['sco_del', 'sco_pi'], ['sco_del', 'antares'],
        ['antares', 'sco_tau'], ['sco_tau', 'sco_eps'], ['sco_eps', 'sco_zet'],
        ['sco_zet', 'sco_eta'], ['sco_eta', 'sco_the'], ['sco_the', 'sco_kap'], ['sco_kap', 'shaula']
      ],
      motif: 'scorpion',
      desc: 'S字の大きなつり針のような形と、心臓の赤い1等星アンタレスが目印の夏の南の星座です。',
      point4th: '南の空の低いところを、東（左）から西（右）へ大きく弧をえがいて移動します。'
    },
    {
      id: 'sgr',
      name: 'いて座',
      ruby: 'いてざ',
      season: '夏',
      centerStar: 'sgr_phi',
      lines: [
        ['sgr_sig', 'sgr_phi'], ['sgr_phi', 'sgr_lam'], ['sgr_lam', 'sgr_mu'],
        ['sgr_sig', 'sgr_tau'], ['sgr_tau', 'sgr_zet'], ['sgr_zet', 'sgr_phi'],
        ['sgr_phi', 'sgr_del'], ['sgr_del', 'sgr_eps']
      ],
      motif: 'bow',
      desc: 'さそり座の東どなりにあり、6つの星がひしゃく形にならぶ「南斗六星」が有名な夏の星座です。',
      point4th: 'いて座のあたりは天の川がもっとも濃く明るく見える方向です。'
    },
    {
      id: 'ori',
      name: 'オリオン座',
      ruby: 'おりおんざ',
      season: '冬',
      centerStar: 'alnilam',
      lines: [
        ['betelgeuse', 'bellatrix'], ['bellatrix', 'mintaka'], ['mintaka', 'rigel'],
        ['rigel', 'saiph'], ['saiph', 'alnitak'], ['alnitak', 'betelgeuse'],
        ['mintaka', 'alnilam'], ['alnilam', 'alnitak']
      ],
      motif: 'hunter',
      desc: 'まん中に3つの星がきれいにならぶ「三つ星」と、赤いベテルギウス・青白いリゲルの2つの1等星をもつ冬の王様星座です！',
      point4th: '時刻がたつと、オリオン座の傾きが変わりながら東から南を通り西へ動く様子を「星をのこす」でくらべてみよう！'
    },
    {
      id: 'cma',
      name: 'おおいぬ座',
      ruby: 'おおいぬざ',
      season: '冬',
      centerStar: 'sirius',
      lines: [
        ['sirius', 'cma_bet'], ['sirius', 'cma_omi'], ['cma_omi', 'cma_del'],
        ['cma_del', 'cma_eps'], ['cma_del', 'cma_eta']
      ],
      motif: 'dog_big',
      desc: 'オリオン座の三つ星を左下にのばすと見つかる全天で一番明るい1等星「シリウス」がある星座です。',
      point4th: 'シリウスは太陽以外の星で一番明るい-1.5等星。青白く強い光をはなちます。'
    },
    {
      id: 'cmi',
      name: 'こいぬ座',
      ruby: 'こいぬざ',
      season: '冬',
      centerStar: 'procyon',
      lines: [['procyon', 'cmi_bet']],
      motif: 'dog_small',
      desc: '2つの星がならぶ小さな星座ですが、1等星プロキオンは冬の大三角の大切な1つです。',
      point4th: 'ベテルギウス（赤）・シリウス（青白）・プロキオン（黄白）を結ぶと「冬の大三角」ができます。'
    },
    {
      id: 'tau',
      name: 'おうし座',
      ruby: 'おうしざ',
      season: '冬',
      centerStar: 'aldebaran',
      lines: [
        ['tau_bet', 'aldebaran'], ['aldebaran', 'tau_gam'], ['tau_gam', 'tau_eps'],
        ['tau_eps', 'tau_zet']
      ],
      motif: 'bull',
      desc: 'オレンジ色の1等星アルデバランと、星がぎゅっと集まった「すばる（プレアデス星団）」が美しい冬の星座です。',
      point4th: 'オリオン座の三つ星を右上にのばすとアルデバラン、さらにのばすとすばるが見つかります。'
    },
    {
      id: 'gem',
      name: 'ふたご座',
      ruby: 'ふたござ',
      season: '冬',
      centerStar: 'pollux',
      lines: [
        ['castor', 'pollux'], ['castor', 'gem_eps'], ['gem_eps', 'gem_mu'],
        ['pollux', 'gem_del'], ['gem_del', 'gem_gam']
      ],
      motif: 'twins',
      desc: '仲よくならんだ兄カストルと弟ポルックスの2つの星が頭になっている冬の星座です。',
      point4th: '冬の高い空を通るため、一晩中長い時間見ることができます。'
    },
    {
      id: 'aur',
      name: 'ぎょしゃ座',
      ruby: 'ぎょしゃざ',
      season: '冬',
      centerStar: 'capella',
      lines: [
        ['capella', 'aur_bet'], ['aur_bet', 'aur_the'], ['aur_the', 'aur_south'],
        ['aur_south', 'aur_iot'], ['aur_iot', 'aur_eta'], ['aur_eta', 'capella']
      ],
      desc: '大きな五角形の形と、黄色くかがやく1等星カペラが目印の冬の星座です。',
      point4th: 'シリウス・リゲル・アルデバラン・カペラ・ポルックス・プロキオンの6つを結ぶ「冬のダイヤモンド」の一員です。'
    },
    {
      id: 'leo',
      name: 'しし座',
      ruby: 'ししざ',
      season: '春',
      centerStar: 'leo_gam',
      lines: [
        ['leo_eps', 'leo_mu'], ['leo_mu', 'leo_zet'], ['leo_zet', 'leo_gam'],
        ['leo_gam', 'regulus'], ['leo_gam', 'leo_del'], ['leo_del', 'denebola'],
        ['denebola', 'leo_the'], ['leo_the', 'regulus']
      ],
      motif: 'lion',
      desc: '春の夜空で大きく姿を見せるライオンの星座。？マークをさかさまにした「ししの大がま」と1等星レグルスが目印です。',
      point4th: 'しっぽの星デネボラは、アークトゥルス・スピカとともに「春の大三角」を作ります。'
    },
    {
      id: 'boo',
      name: 'うしかい座',
      ruby: 'うしかいざ',
      season: '春',
      centerStar: 'arcturus',
      lines: [
        ['arcturus', 'boo_eta'], ['arcturus', 'boo_eps'], ['boo_eps', 'boo_del'],
        ['boo_del', 'boo_bet'], ['boo_bet', 'boo_gam'], ['boo_gam', 'arcturus']
      ],
      motif: 'kite',
      desc: 'ネクタイ（またはたこ）のような五角形の先に、オレンジ色の1等星アークトゥルスがかがやく春の星座です。',
      point4th: '北斗七星の柄のカーブをそのままのばすとアークトゥルス（春の大曲線）にぶつかります。'
    },
    {
      id: 'vir',
      name: 'おとめ座',
      ruby: 'おとめざ',
      season: '春',
      centerStar: 'spica',
      lines: [
        ['spica', 'vir_zet'], ['vir_zet', 'vir_gam'], ['vir_gam', 'vir_del'],
        ['vir_del', 'vir_eps'], ['vir_zet', 'vir_eps']
      ],
      motif: 'wing',
      desc: '青白く光る1等星スピカがかがやく大きな春の星座です。',
      point4th: '春の大曲線をアークトゥルスからさらに南へのばすとスピカが見つかります。'
    },
    {
      id: 'peg',
      name: 'ペガスス座',
      ruby: 'ぺがすすざ',
      season: '秋',
      centerStar: 'peg_alp',
      lines: [
        ['peg_alp', 'peg_bet'], ['peg_bet', 'and_alp'], ['and_alp', 'peg_gam'],
        ['peg_gam', 'peg_alp'], ['peg_alp', 'peg_zet'], ['peg_zet', 'peg_eps']
      ],
      motif: 'pegasus',
      desc: '秋の空の高いところに大きな四角形「秋の四辺形」をつくる翼のある馬の星座です。',
      point4th: '秋の四辺形を目印に、まわりの秋の星座をさがしてみましょう。'
    },
    {
      id: 'and',
      name: 'アンドロメダ座',
      ruby: 'あんどろめだざ',
      season: '秋',
      centerStar: 'and_bet',
      lines: [
        ['and_del', 'and_bet'], ['and_bet', 'and_gam'],
        ['and_bet', 'and_mu'], ['and_mu', 'and_nu']
      ],
      desc: '秋の四辺形のすぐ東から北東へ星がすっとのびる秋の星座です。',
      point4th: 'アンドロメダ座の星（μ・ν）の近くに250万光年かなたの「アンドロメダ銀河」があります。'
    },
    {
      id: 'psa',
      name: 'みなみのうお座',
      ruby: 'みなみのうおざ',
      season: '秋',
      centerStar: 'fomalhaut',
      lines: [
        ['fomalhaut', 'psa_eps'], ['psa_eps', 'psa_del'], ['psa_del', 'fomalhaut']
      ],
      motif: 'fish',
      desc: '秋の南の空で1等星フォーマルハウトが1つだけぽつんと光る星座です。',
      point4th: '秋は1等星がこのフォーマルハウトだけなので「秋の一つ星」と呼ばれます。'
    },
    // --- 南天（海外・低緯度） ---
    {
      id: 'cru',
      name: 'みなみじゅうじ座 (南十字星)',
      ruby: 'みなみじゅうじざ',
      season: '南の空（海外）',
      centerStar: 'acrux',
      lines: [
        ['gacrux', 'acrux'], ['cru_del', 'mimosa']
      ],
      motif: 'cross',
      desc: '南半球の夜空でシンボルになっている美しい十字の星座！1等星アクルックスとミモザを含み、とても小さく引きしまった形をしています。',
      point4th: 'たての線（ガクルックス→アクルックス）を下へ約4.5倍のばすと「天の南極（南の空の回転中心）」が見つかります！'
    },
    {
      id: 'cen',
      name: 'ケンタウルス座',
      ruby: 'けんたうるすざ',
      season: '南の空（海外）',
      centerStar: 'hadar',
      lines: [
        ['rigil_kent', 'hadar'], ['hadar', 'cen_gam'], ['cen_gam', 'cen_the']
      ],
      motif: 'centaur',
      desc: '南十字星のすぐ横で明るくかがやく2つの1等星（アルファ・ケンタウリとハダル）をもつ南の空の大きな星座です。',
      point4th: 'シドニーなどの南半球では、南の空の星は時計回り（右回り）に回転します。日本とくらべてみよう！'
    },
    {
      id: 'car',
      name: 'りゅうこつ座',
      ruby: 'りゅうこつざ',
      season: '南の空（海外）',
      centerStar: 'canopus',
      lines: [
        ['canopus', 'car_eps'], ['car_eps', 'car_iot'], ['car_iot', 'car_bet']
      ],
      motif: 'ship',
      desc: '全天で2番目に明るい1等星カノープスをもつ大きな南の星座です。',
      point4th: '佐伯市では冬の真夜中に南の地平線すれすれに少しだけ見えますが、南半球では高い空に見えます！'
    }
  ];

  /**
   * 大三角・大曲線・北極星ガイド（アステリズム）
   */
  const ASTERISMS_DATA = [
    {
      id: 'summer_tri',
      name: '夏の大三角',
      color: '#38bdf8',
      type: 'polygon',
      stars: ['vega', 'altair', 'deneb'],
      closed: true,
      labelStar: 'vega'
    },
    {
      id: 'winter_tri',
      name: '冬の大三角',
      color: '#f59e0b',
      type: 'polygon',
      stars: ['betelgeuse', 'sirius', 'procyon'],
      closed: true,
      labelStar: 'betelgeuse'
    },
    {
      id: 'spring_tri',
      name: '春の大三角',
      color: '#a3e635',
      type: 'polygon',
      stars: ['arcturus', 'spica', 'denebola'],
      closed: true,
      labelStar: 'arcturus'
    },
    {
      id: 'spring_curve',
      name: '春の大曲線',
      color: '#bef264',
      type: 'polyline',
      stars: ['alioth', 'mizar', 'alkaid', 'arcturus', 'spica'],
      closed: false,
      labelStar: 'alkaid'
    },
    {
      id: 'autumn_square',
      name: '秋の四辺形',
      color: '#c084fc',
      type: 'polygon',
      stars: ['peg_alp', 'peg_bet', 'and_alp', 'peg_gam'],
      closed: true,
      labelStar: 'peg_bet'
    },
    {
      id: 'polaris_guide_uma',
      name: '北斗七星から北極星 (×5倍)',
      color: '#fde047',
      type: 'guide',
      from: 'merak',
      through: 'dubhe',
      to: 'polaris'
    },
    {
      id: 'polaris_guide_cas',
      name: 'カシオペヤ座から北極星 (×5倍)',
      color: '#fde047',
      type: 'guide',
      from: 'cas_gam',
      through: 'cas_gam',
      to: 'polaris',
      virtualMid: { fromA: 'cas_bet', throughA: 'cas_alp', fromB: 'cas_eps', throughB: 'cas_del' }
    }
  ];

  // 高速検索用マップ
  const STAR_MAP = {};
  STARS_DATA.forEach(s => {
    STAR_MAP[s.id] = s;
  });

  const CONSTELLATION_MAP = {};
  CONSTELLATIONS_DATA.forEach(c => {
    CONSTELLATION_MAP[c.id] = c;
  });

  /**
   * 空の明るさ状態を取得（太陽高度によるグラデーション色・星の見えやすさ）
   */
  function getSkyLighting(sunAlt, forceDayStars) {
    if (forceDayStars) {
      return {
        phase: 'night',
        starAlpha: 1.0,
        topColor: '#050b1a',
        midColor: '#0c1836',
        botColor: '#172a52',
        horizonGlow: 'rgba(56, 189, 248, 0.12)',
        label: '昼の星モード（太陽の光をかくして表示中）'
      };
    }

    if (sunAlt <= -12) {
      return {
        phase: 'night',
        starAlpha: 1.0,
        topColor: '#030816',
        midColor: '#0a1633',
        botColor: '#162954',
        horizonGlow: 'rgba(59, 130, 246, 0.10)',
        label: '夜空'
      };
    } else if (sunAlt <= -4) {
      const t = (sunAlt + 12) / 8; // 0(暗い) -> 1(薄明)
      return {
        phase: 'twilight',
        starAlpha: 1.0 - t * 0.45,
        topColor: '#0b1838',
        midColor: '#1d3366',
        botColor: '#6b3b5b',
        horizonGlow: 'rgba(251, 146, 60, 0.35)',
        label: '薄明（明け方・夕方）'
      };
    } else if (sunAlt <= 2) {
      const t = (sunAlt + 4) / 6;
      return {
        phase: 'dawn_dusk',
        starAlpha: Math.max(0.1, 0.55 - t * 0.45),
        topColor: '#1d4ed8',
        midColor: '#60a5fa',
        botColor: '#fb923c',
        horizonGlow: 'rgba(251, 146, 60, 0.55)',
        label: '日の出・日の入りごろ'
      };
    } else {
      return {
        phase: 'day',
        starAlpha: 0.0,
        topColor: '#1d4ed8',
        midColor: '#3b82f6',
        botColor: '#93c5fd',
        horizonGlow: 'rgba(255, 255, 255, 0.15)',
        label: '昼間'
      };
    }
  }

  /**
   * 季節を月日から取得
   */
  function getSeasonLabel(month) {
    if (month >= 3 && month <= 5) return '春';
    if (month >= 6 && month <= 8) return '夏';
    if (month >= 9 && month <= 11) return '秋';
    return '冬';
  }

  /**
   * 月の明るい縁（太陽光側）がキャンバス上で向く角度（ラジアン）を返す
   */
  function getMoonBrightLimbAngle(sunPos, moonPos, isWaxing) {
    const dAz = (sunPos.azimuth - moonPos.azimuth) * DEG2RAD;
    const hs = sunPos.altitude * DEG2RAD;
    const hm = moonPos.altitude * DEG2RAD;
    const u = Math.cos(hs) * Math.sin(dAz); // 右方向（方位角増加）
    const v = Math.sin(hs) * Math.cos(hm) - Math.cos(hs) * Math.sin(hm) * Math.cos(dAz); // 上方向（高度増加）
    const sunAngle = Math.atan2(-v, u);
    return isWaxing ? sunAngle : sunAngle - Math.PI;
  }

  // NASA JPL J2000 軌道要素（1800-2050年 近似）: [a0, da, e0, de, I0, dI, L0, dL, wbar0, dwbar, Om0, dOm]
  const PLANET_ELEMENTS = {
    earth:   [1.00000261,  0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166,  35999.37244981, 102.93768193,  0.32327364,   0.0,         0.0],
    mercury: [0.38709927,  0.00000037, 0.20563593,  0.00001906,  7.00497902, -0.00594749, 252.25032350, 149472.67411175,  77.45779628,  0.16047689,  48.33076593, -0.12534081],
    venus:   [0.72333566,  0.00000390, 0.00677672, -0.00004107,  3.39467605, -0.00078890, 181.97909950,  58517.81538729, 131.60246718,  0.00268329,  76.67984255, -0.27769418],
    mars:    [1.52371034,  0.00001847, 0.09339410,  0.00007882,  1.84969142, -0.00813131,  -4.55343205,  19140.30268499, -23.94362959,  0.44441088,  49.55953891, -0.29257343],
    jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253,  1.30439695, -0.00183714,  34.39644051,   3034.74612775,  14.72847983,  0.21252668, 100.47390909,  0.20469106],
    saturn:  [9.53667594, -0.00125060, 0.05386179, -0.00050991,  2.48599187,  0.00193609,  49.95424423,   1222.49362201,  92.59887831, -0.41897216, 113.66242448, -0.28867794]
  };

  const PLANET_META = [
    { id: 'mercury', name: '水星', ruby: 'すいせい', color: '#cbd5e1', radius: 3.8, hasRing: false },
    { id: 'venus',   name: '金星', ruby: 'きんせい', color: '#fef08a', radius: 5.5, hasRing: false },
    { id: 'mars',    name: '火星', ruby: 'かせい',   color: '#fb7185', radius: 4.5, hasRing: false },
    { id: 'jupiter', name: '木星', ruby: 'もくせい', color: '#fde68a', radius: 5.2, hasRing: false },
    { id: 'saturn',  name: '土星', ruby: 'どせい',   color: '#fcd34d', radius: 4.6, hasRing: true }
  ];

  function calcHeliocentricEcliptic(key, T) {
    const el = PLANET_ELEMENTS[key];
    const a = el[0] + el[1] * T;
    const e = el[2] + el[3] * T;
    const I = (el[4] + el[5] * T) * DEG2RAD;
    const L = el[6] + el[7] * T;
    const wbar = el[8] + el[9] * T;
    const Om = (el[10] + el[11] * T) * DEG2RAD;
    const w = wbar * DEG2RAD - Om;

    let Mdeg = normDeg(L - wbar);
    if (Mdeg > 180) Mdeg -= 360;
    const M = Mdeg * DEG2RAD;

    // ケプラー方程式 M = E - e*sin(E) を解く
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 6; i++) {
      const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
      E += dE;
      if (Math.abs(dE) < 1e-7) break;
    }

    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

    const cosW = Math.cos(w), sinW = Math.sin(w);
    const cosO = Math.cos(Om), sinO = Math.sin(Om);
    const cosI = Math.cos(I), sinI = Math.sin(I);

    const x = (cosW * cosO - sinW * sinO * cosI) * xp + (-sinW * cosO - cosW * sinO * cosI) * yp;
    const y = (cosW * sinO + sinW * cosO * cosI) * xp + (-sinW * sinO + cosW * cosO * cosI) * yp;
    const z = (sinW * sinI) * xp + (cosW * sinI) * yp;
    return { x, y, z };
  }

  /**
   * 5つの肉眼惑星（水星・金星・火星・木星・土星）の位置を計算
   */
  function getPlanetsPositions(jd, latDeg, lonDeg) {
    const T = (jd - 2451545.0) / 36525.0;
    const earth = calcHeliocentricEcliptic('earth', T);
    const eps = (23.43928 - 0.01301 * T) * DEG2RAD;
    const cosEps = Math.cos(eps);
    const sinEps = Math.sin(eps);

    return PLANET_META.map(meta => {
      const helio = calcHeliocentricEcliptic(meta.id, T);
      const dx = helio.x - earth.x;
      const dy = helio.y - earth.y;
      const dz = helio.z - earth.z;

      const xEq = dx;
      const yEq = dy * cosEps - dz * sinEps;
      const zEq = dy * sinEps + dz * cosEps;

      const ra = normDeg(Math.atan2(yEq, xEq) * RAD2DEG);
      const dec = Math.atan2(zEq, Math.hypot(xEq, yEq)) * RAD2DEG;
      const horiz = equatorialToHorizontal(ra, dec, jd, latDeg, lonDeg);

      return {
        ...meta,
        ra,
        dec,
        azimuth: horiz.azimuth,
        altitude: horiz.altitude
      };
    });
  }

  global.AstroCalc = {
    DEG2RAD,
    RAD2DEG,
    normDeg,
    toJulianDay,
    getLocalSiderealTime,
    equatorialToHorizontal,
    getSunPosition,
    getMoonPosition,
    getMoonPhase,
    getMoonBrightLimbAngle,
    getPlanetsPositions,
    getSunTimes,
    getMoonTimes,
    getSkyLighting,
    getSeasonLabel,
    STARS_DATA,
    BACKGROUND_STARS,
    CONSTELLATIONS_DATA,
    ASTERISMS_DATA,
    STAR_MAP,
    CONSTELLATION_MAP
  };
})(window);
