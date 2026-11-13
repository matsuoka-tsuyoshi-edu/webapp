/**
 * 天体計算モジュール (AstroCalc)
 * 小学6年理科「月と太陽」シミュレーション用天文略算ライブラリ
 */

const AstroCalc = (function() {
  // 観測地デフォルト: 大分県佐伯市 (北緯 32.96°, 東経 131.90°)
  // 日本標準時基準 (JST: UTC+9)
  let observer = {
    lat: 32.96,
    lon: 131.90,
    name: "大分県佐伯市"
  };

  function setObserver(lat, lon, name) {
    observer.lat = lat;
    observer.lon = lon;
    if (name) observer.name = name;
  }

  function getObserver() {
    return { ...observer };
  }

  // ユーティリティ数学関数
  function rad(deg) { return deg * Math.PI / 180.0; }
  function deg(rad) { return rad * 180.0 / Math.PI; }
  function normDeg(deg) {
    let d = deg % 360.0;
    if (d < 0) d += 360.0;
    return d;
  }

  // ユリウス日 (JD) の計算
  function getJulianDay(date) {
    // date は UTC で取得
    let y = date.getUTCFullYear();
    let m = date.getUTCMonth() + 1;
    let d = date.getUTCDate();
    let h = date.getUTCHours();
    let mn = date.getUTCMinutes();
    let s = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000.0;

    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const dayFraction = (h + mn / 60.0 + s / 3600.0) / 24.0;
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + dayFraction + B - 1524.5;
  }

  // 太陽の位置計算
  function getSunPosition(jd, lat, lon) {
    lat = lat !== undefined ? lat : observer.lat;
    lon = lon !== undefined ? lon : observer.lon;

    const d = jd - 2451545.0; // J2000.0 からの日数

    // 平均近点角 M (度)
    const M = normDeg(357.529 + 0.98560028 * d);
    // 平均黄経 L (度)
    const L = normDeg(280.459 + 0.98564736 * d);
    // 真黄経 lambda (度)
    const lambda = normDeg(L + 1.915 * Math.sin(rad(M)) + 0.020 * Math.sin(rad(2 * M)));
    // 黄道傾斜角 epsilon (度)
    const eps = 23.439 - 0.00000036 * d;

    // 赤経 alpha, 赤緯 delta
    const sinLambda = Math.sin(rad(lambda));
    const cosLambda = Math.cos(rad(lambda));
    const sinEps = Math.sin(rad(eps));
    const cosEps = Math.cos(rad(eps));

    const alpha = normDeg(deg(Math.atan2(cosEps * sinLambda, cosLambda)));
    const delta = deg(Math.asin(sinEps * sinLambda));

    // グリニッジ恒星時 (GMST)
    const gmst = normDeg(280.46061837 + 360.98564736629 * d);
    // 地方恒星時 (LMST)
    const lmst = normDeg(gmst + lon);
    // 時角 H (0~360) および 符号付き時角 hourAngle (-180~+180: 東が負、南中が0、西が正)
    const H = normDeg(lmst - alpha);
    let hourAngle = H;
    if (hourAngle > 180.0) hourAngle -= 360.0;
    const screenAz = 180.0 + hourAngle;

    // 地平座標 (高度 alt, 方位角 az: 北=0, 東=90, 南=180, 西=270)
    const sinAlt = Math.sin(rad(lat)) * Math.sin(rad(delta)) + Math.cos(rad(lat)) * Math.cos(rad(delta)) * Math.cos(rad(H));
    const alt = deg(Math.asin(sinAlt));

    const cosAz = (Math.sin(rad(delta)) - Math.sin(rad(lat)) * sinAlt) / (Math.cos(rad(lat)) * Math.cos(rad(alt)));
    const clampedCosAz = Math.max(-1.0, Math.min(1.0, cosAz));
    let az = deg(Math.acos(clampedCosAz));
    if (Math.sin(rad(H)) > 0) {
      az = 360.0 - az;
    }

    return {
      alt: alt,
      az: az,
      hourAngle: hourAngle,
      screenAz: screenAz,
      lambda: lambda,
      alpha: alpha,
      delta: delta
    };
  }

  // 月の位置計算
  function getMoonPosition(jd, lat, lon) {
    lat = lat !== undefined ? lat : observer.lat;
    lon = lon !== undefined ? lon : observer.lon;

    const d = jd - 2451545.0;

    // 平均要素
    const L = normDeg(218.316 + 13.176396 * d);      // 月の平均黄経
    const M = normDeg(134.963 + 13.064993 * d);      // 月の平均近点角
    const F = normDeg(93.272 + 13.229350 * d);       // 昇交点黄経
    const sunL = normDeg(280.459 + 0.98564736 * d);   // 太陽の平均黄経
    const D = normDeg(L - sunL);                     // 平均離角

    // 主な摂動項の計算
    const lambda = normDeg(L + 6.289 * Math.sin(rad(M))
                             + 1.274 * Math.sin(rad(2 * D - M))
                             + 0.658 * Math.sin(rad(2 * D))
                             - 0.214 * Math.sin(rad(2 * M))
                             - 0.186 * Math.sin(rad(sunL))
                             - 0.114 * Math.sin(rad(2 * F)));

    const beta = (5.128 * Math.sin(rad(F))
                + 0.280 * Math.sin(rad(M + F))
                + 0.277 * Math.sin(rad(M - F))
                + 0.173 * Math.sin(rad(2 * D - F)));

    const eps = 23.439 - 0.00000036 * d;

    // 赤道座標
    const cosBeta = Math.cos(rad(beta));
    const sinBeta = Math.sin(rad(beta));
    const cosLambda = Math.cos(rad(lambda));
    const sinLambda = Math.sin(rad(lambda));
    const cosEps = Math.cos(rad(eps));
    const sinEps = Math.sin(rad(eps));

    const x = cosBeta * cosLambda;
    const y = cosEps * cosBeta * sinLambda - sinEps * sinBeta;
    const z = sinEps * cosBeta * sinLambda + cosEps * sinBeta;

    const alpha = normDeg(deg(Math.atan2(y, x)));
    const delta = deg(Math.asin(z));

    // 地方恒星時・時角 (H: 0~360, hourAngle: -180~+180)
    const gmst = normDeg(280.46061837 + 360.98564736629 * d);
    const lmst = normDeg(gmst + lon);
    const H = normDeg(lmst - alpha);
    let hourAngle = H;
    if (hourAngle > 180.0) hourAngle -= 360.0;
    const screenAz = 180.0 + hourAngle;

    // 地平座標
    const sinAlt = Math.sin(rad(lat)) * Math.sin(rad(delta)) + Math.cos(rad(lat)) * Math.cos(rad(delta)) * Math.cos(rad(H));
    const alt = deg(Math.asin(sinAlt));

    const cosAz = (Math.sin(rad(delta)) - Math.sin(rad(lat)) * sinAlt) / (Math.cos(rad(lat)) * Math.cos(rad(alt)));
    const clampedCosAz = Math.max(-1.0, Math.min(1.0, cosAz));
    let az = deg(Math.acos(clampedCosAz));
    if (Math.sin(rad(H)) > 0) {
      az = 360.0 - az;
    }

    // 月齢・位相
    // 太陽黄経との離角
    const sunPos = getSunPosition(jd, lat, lon);
    const elongation = normDeg(lambda - sunPos.lambda);
    const age = elongation / 360.0 * 29.530588853;
    const phaseFraction = (1.0 - Math.cos(rad(elongation))) / 2.0;

    return {
      alt: alt,
      az: az,
      hourAngle: hourAngle,
      screenAz: screenAz,
      lambda: lambda,
      beta: beta,
      alpha: alpha,
      delta: delta,
      elongation: elongation, // 0~360度 (0:新月, 90:上弦, 180:満月, 270:下弦)
      age: age,               // 0~29.5
      phaseFraction: phaseFraction // 0.0~1.0 (輝面比)
    };
  }

  // 月の名前と児童向け説明文を取得
  function getMoonPhaseInfo(age, elongation) {
    // elongation: 0~360度
    let name = "";
    let ruby = "";
    let desc = "";
    let shapeType = ""; // 'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full', 'waning-gibbous', 'last-quarter', 'waning-crescent'

    const elong = normDeg(elongation);

    if (elong >= 350 || elong < 10) {
      name = "新月";
      ruby = "しんげつ";
      shapeType = "new";
      desc = "太陽と同じ方向にあるため、光が当たる面が地球から見えず、空に見えません。";
    } else if (elong >= 10 && elong < 75) {
      name = "三日月";
      ruby = "みかづき";
      shapeType = "waxing-crescent";
      desc = "夕方の西の空に見える細い月です。太陽の光が右側から当たって右側が光っています。";
    } else if (elong >= 75 && elong < 105) {
      name = "上弦の月";
      ruby = "じょうげんのつき";
      shapeType = "first-quarter";
      desc = "夕方に南の空で見える半月です。右半分が光っていて、真夜中に西の地平線に沈みます。";
    } else if (elong >= 105 && elong < 170) {
      name = "十日余の月（十三夜）";
      ruby = "じゅうさんや";
      shapeType = "waxing-gibbous";
      desc = "満月に近づいてだんだん丸くなってきた月です。夕方から夜遅くまでよく見えます。";
    } else if (elong >= 170 && elong < 190) {
      name = "満月";
      ruby = "まんげつ";
      shapeType = "full";
      desc = "太陽とちょうど反対側にある月です。夕方に東から昇り、真夜中に真南（一番高いところ）を通り、明け方に西へ沈みます。";
    } else if (elong >= 190 && elong < 255) {
      name = "十六夜・居待月";
      ruby = "いざよい";
      shapeType = "waning-gibbous";
      desc = "満月を過ぎて、少しずつ右側が欠け始めた月です。夜遅くに東の空から昇ってきます。";
    } else if (elong >= 255 && elong < 285) {
      name = "下弦の月";
      ruby = "かげんのつき";
      shapeType = "last-quarter";
      desc = "真夜中に東から昇る半月です。上弦とは逆で左半分が光り、明け方に真南に見えます。";
    } else {
      name = "有明の月";
      ruby = "ありあけのつき";
      shapeType = "waning-crescent";
      desc = "明け方の東の空に見える細い月です。太陽が昇る直前に東の地平線から姿を現します。";
    }

    return {
      name: name,
      ruby: ruby,
      shapeType: shapeType,
      desc: desc,
      ageFormatted: age.toFixed(1)
    };
  }

  // 指定日の日の出・日の入り・南中、月の出・月の入り・南中を計算
  function getDailyEvents(year, month, day, lat, lon) {
    lat = lat !== undefined ? lat : observer.lat;
    lon = lon !== undefined ? lon : observer.lon;

    const stepMin = 5;
    let sunRise = null;
    let sunSet = null;
    let sunTransit = null;
    let sunMaxAlt = -999;

    let moonRise = null;
    let moonSet = null;
    let moonTransit = null;
    let moonMaxAlt = -999;

    let prevSunAlt = null;
    let prevMoonAlt = null;

    for (let m = 0; m <= 24 * 60; m += stepMin) {
      let h = Math.floor(m / 60);
      let mn = m % 60;
      if (h === 24) { h = 23; mn = 59; }

      // JST (UTC+9) の日時を作成
      const utcDate = new Date(Date.UTC(year, month - 1, day, h - 9, mn, 0));
      const jd = getJulianDay(utcDate);

      const sun = getSunPosition(jd, lat, lon);
      const moon = getMoonPosition(jd, lat, lon);

      // 南中判定 (最高高度)
      if (sun.alt > sunMaxAlt) {
        sunMaxAlt = sun.alt;
        sunTransit = { hour: h, minute: mn, alt: sun.alt };
      }
      if (moon.alt > moonMaxAlt) {
        moonMaxAlt = moon.alt;
        moonTransit = { hour: h, minute: mn, alt: moon.alt };
      }

      // 出没判定 (太陽は大気差などを考慮し -0.833°、月は 0.0°)
      const sunHorizon = -0.833;
      const moonHorizon = 0.0;

      if (prevSunAlt !== null) {
        if (prevSunAlt < sunHorizon && sun.alt >= sunHorizon && sunRise === null) {
          const frac = (sunHorizon - prevSunAlt) / (sun.alt - prevSunAlt);
          const minExact = (m - stepMin) + frac * stepMin;
          sunRise = { hour: Math.floor(minExact / 60), minute: Math.round(minExact % 60) };
        } else if (prevSunAlt >= sunHorizon && sun.alt < sunHorizon && sunSet === null) {
          const frac = (sunHorizon - prevSunAlt) / (sun.alt - prevSunAlt);
          const minExact = (m - stepMin) + frac * stepMin;
          sunSet = { hour: Math.floor(minExact / 60), minute: Math.round(minExact % 60) };
        }
      }

      if (prevMoonAlt !== null) {
        if (prevMoonAlt < moonHorizon && moon.alt >= moonHorizon && moonRise === null) {
          const frac = (moonHorizon - prevMoonAlt) / (moon.alt - prevMoonAlt);
          const minExact = (m - stepMin) + frac * stepMin;
          moonRise = { hour: Math.floor(minExact / 60), minute: Math.round(minExact % 60) };
        } else if (prevMoonAlt >= moonHorizon && moon.alt < moonHorizon && moonSet === null) {
          const frac = (moonHorizon - prevMoonAlt) / (moon.alt - prevMoonAlt);
          const minExact = (m - stepMin) + frac * stepMin;
          moonSet = { hour: Math.floor(minExact / 60), minute: Math.round(minExact % 60) };
        }
      }

      prevSunAlt = sun.alt;
      prevMoonAlt = moon.alt;
    }

    function formatTime(t) {
      if (!t) return "--:--";
      let h = t.hour;
      let m = t.minute;
      if (m >= 60) { h += 1; m -= 60; }
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    return {
      sun: {
        rise: formatTime(sunRise),
        set: formatTime(sunSet),
        transit: formatTime(sunTransit),
        maxAlt: sunMaxAlt > -90 ? sunMaxAlt.toFixed(1) : "--"
      },
      moon: {
        rise: formatTime(moonRise),
        set: formatTime(moonSet),
        transit: formatTime(moonTransit),
        maxAlt: moonMaxAlt > -90 ? moonMaxAlt.toFixed(1) : "--"
      }
    };
  }

  // 1日の天体軌道（点線のガイドパス用：時角 -180°〜+180° の1周期分を滑らかにサンプリング）を生成
  function getDailyPath(year, month, day, lat, lon, refDate) {
    lat = lat !== undefined ? lat : observer.lat;
    lon = lon !== undefined ? lon : observer.lon;

    const pointsSun = [];
    const pointsMoon = [];

    // 太陽の南中時刻を基準に1周期 (-175°〜+175°) を10分刻みでサンプリング
    const noonUtc = new Date(Date.UTC(year, month - 1, day, 12 - 9, 0, 0));
    const noonJd = getJulianDay(noonUtc);
    const sunAtNoon = getSunPosition(noonJd, lat, lon);
    const sunTransitJd = noonJd - sunAtNoon.hourAngle / 360.0;

    for (let step = -70; step <= 70; step++) {
      const jd = sunTransitJd + (step * 10) / 1440.0;
      const sun = getSunPosition(jd, lat, lon);
      pointsSun.push({
        az: sun.az,
        screenAz: sun.screenAz,
        hourAngle: sun.hourAngle,
        alt: sun.alt
      });
    }

    // 月は参照日時（または正午）における現在の周期（時角0°中心の -176°〜+176°）を10分刻みでサンプリング
    const refJd = refDate ? getJulianDay(refDate) : noonJd;
    const moonAtRef = getMoonPosition(refJd, lat, lon);
    const moonTransitJd = refJd - moonAtRef.hourAngle / 347.8;

    for (let step = -73; step <= 73; step++) {
      const jd = moonTransitJd + (step * 10) / 1440.0;
      const moon = getMoonPosition(jd, lat, lon);
      pointsMoon.push({
        az: moon.az,
        screenAz: moon.screenAz,
        hourAngle: moon.hourAngle,
        alt: moon.alt
      });
    }

    return { sun: pointsSun, moon: pointsMoon };
  }

  return {
    setObserver,
    getObserver,
    getJulianDay,
    getSunPosition,
    getMoonPosition,
    getMoonPhaseInfo,
    getDailyEvents,
    getDailyPath
  };
})();

// グローバルスコープで利用可能にする
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AstroCalc;
}
