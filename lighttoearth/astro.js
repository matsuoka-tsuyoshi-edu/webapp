/**
 * 天体計算モジュール (AstroCalc)
 * 小学理科「太陽と地球と月の動き・光の当たり方」シミュレーション用天文略算ライブラリ
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
  function rad(degVal) { return degVal * Math.PI / 180.0; }
  function deg(radVal) { return radVal * 180.0 / Math.PI; }
  function normDeg(degVal) {
    let d = degVal % 360.0;
    if (d < 0) d += 360.0;
    return d;
  }

  // ユリウス日 (JD) の計算
  function getJulianDay(date) {
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

    // グリニッジ恒星時 (GMST) と地方恒星時 (LMST)
    const gmst = normDeg(280.46061837 + 360.98564736629 * d);
    const lmst = normDeg(gmst + lon);
    // 時角 H (0~360) および 符号付き時角 hourAngle (-180~+180: 東が負、一番高いときが0、西が正)
    const H = normDeg(lmst - alpha);
    let hourAngle = H;
    if (hourAngle > 180.0) hourAngle -= 360.0;
    const screenAz = 180.0 + hourAngle;

    // 地平座標 (高度 alt, 方位角 az: 北=0, 東=90, 南=180, 西=270)
    const sinAlt = Math.sin(rad(lat)) * Math.sin(rad(delta)) + Math.cos(rad(lat)) * Math.cos(rad(delta)) * Math.cos(rad(H));
    const alt = deg(Math.asin(Math.max(-1.0, Math.min(1.0, sinAlt))));

    const denom = Math.cos(rad(lat)) * Math.cos(rad(alt));
    const cosAz = Math.abs(denom) > 1e-9
      ? (Math.sin(rad(delta)) - Math.sin(rad(lat)) * sinAlt) / denom
      : 0;
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
      delta: delta,
      gmst: gmst,
      lmst: lmst,
      eps: eps
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
    const delta = deg(Math.asin(Math.max(-1.0, Math.min(1.0, z))));

    // 地方恒星時・時角 (H: 0~360, hourAngle: -180~+180)
    const gmst = normDeg(280.46061837 + 360.98564736629 * d);
    const lmst = normDeg(gmst + lon);
    const H = normDeg(lmst - alpha);
    let hourAngle = H;
    if (hourAngle > 180.0) hourAngle -= 360.0;
    const screenAz = 180.0 + hourAngle;

    // 地平座標
    const sinAlt = Math.sin(rad(lat)) * Math.sin(rad(delta)) + Math.cos(rad(lat)) * Math.cos(rad(delta)) * Math.cos(rad(H));
    const rawAlt = deg(Math.asin(Math.max(-1.0, Math.min(1.0, sinAlt))));

    // 地上の見え方用に穏やかに安定化した高度（出没時刻 rawAlt=0° は厳密維持）
    const rawMaxAlt = Math.max(15.0, 90.0 - Math.abs(lat - delta));
    const meanMaxAlt = Math.max(15.0, 90.0 - Math.abs(lat));
    const targetMaxAlt = 0.78 * meanMaxAlt + 0.22 * rawMaxAlt;
    const alt = Math.max(-88.0, Math.min(88.0, rawAlt * (targetMaxAlt / rawMaxAlt)));

    const denom = Math.cos(rad(lat)) * Math.cos(rad(rawAlt));
    const cosAz = Math.abs(denom) > 1e-9
      ? (Math.sin(rad(delta)) - Math.sin(rad(lat)) * sinAlt) / denom
      : 0;
    const clampedCosAz = Math.max(-1.0, Math.min(1.0, cosAz));
    let az = deg(Math.acos(clampedCosAz));
    if (Math.sin(rad(H)) > 0) {
      az = 360.0 - az;
    }

    // 月齢・位相
    const sunPos = getSunPosition(jd, lat, lon);
    const elongation = normDeg(lambda - sunPos.lambda);
    const age = elongation / 360.0 * 29.530588853;
    const phaseFraction = (1.0 - Math.cos(rad(elongation))) / 2.0;

    return {
      alt: alt,
      rawAlt: rawAlt,
      az: az,
      hourAngle: hourAngle,
      screenAz: screenAz,
      lambda: lambda,
      beta: beta,
      alpha: alpha,
      delta: delta,
      elongation: elongation,       // 0~360度 (0:新月, 90:上弦, 180:満月, 270:下弦)
      age: age,                     // 0~29.5日
      phaseFraction: phaseFraction  // 0.0~1.0 (輝面比)
    };
  }

  // 月の名前と小学生向け説明文を取得
  function getMoonPhaseInfo(age, elongation) {
    let name = "";
    let ruby = "";
    let desc = "";
    let shapeType = "";

    const elong = normDeg(elongation);

    if (elong >= 350 || elong < 10) {
      name = "新月";
      ruby = "しんげつ";
      shapeType = "new";
      desc = "地球から見て太陽と同じ方向にあるため、光が当たる側が地球の反対（太陽側）になって見えません。";
    } else if (elong >= 10 && elong < 75) {
      name = "三日月";
      ruby = "みかづき";
      shapeType = "waxing-crescent";
      desc = "太陽の光が当たっている面のほんの一部だけが、夕方の西の空に細く光って見えます。";
    } else if (elong >= 75 && elong < 105) {
      name = "上弦の月";
      ruby = "じょうげんのつき";
      shapeType = "first-quarter";
      desc = "宇宙から見ると地球・太陽と90度の位置にあります。右半分が光って見え、夕方ごろに南の空に高く見えます。";
    } else if (elong >= 105 && elong < 170) {
      name = "十日余の月（十三夜）";
      ruby = "じゅうさんや";
      shapeType = "waxing-gibbous";
      desc = "満月に近づき、太陽の光が当たる面が地球に多く向いて丸くふくらんできた月です。";
    } else if (elong >= 170 && elong < 190) {
      name = "満月";
      ruby = "まんげつ";
      shapeType = "full";
      desc = "太陽と地球のちょうど反対側にあるため、太陽の光が当たっている丸い面全体が地球の夜側からよく見えます。";
    } else if (elong >= 190 && elong < 255) {
      name = "十六夜・居待月";
      ruby = "いざよい";
      shapeType = "waning-gibbous";
      desc = "満月を過ぎて、太陽と反対側から少しずつずれて右端が欠け始めた月です。";
    } else if (elong >= 255 && elong < 285) {
      name = "下弦の月";
      ruby = "かげんのつき";
      shapeType = "last-quarter";
      desc = "上弦の月とは反対の90度の位置にあります。左半分が光って見え、明け方の南の空に高く見えます。";
    } else {
      name = "有明の月";
      ruby = "ありあけのつき";
      shapeType = "waning-crescent";
      desc = "太陽の近くにもどり、明け方の東の空に左側だけが細く光って見える月です。";
    }

    return {
      name: name,
      ruby: ruby,
      shapeType: shapeType,
      desc: desc,
      ageFormatted: age.toFixed(1)
    };
  }

  // 指定日の日の出・日の入り・一番高いとき、月の出・月の入り・一番高いときを計算
  function getDailyEvents(year, month, day, lat, lon) {
    lat = lat !== undefined ? lat : observer.lat;
    lon = lon !== undefined ? lon : observer.lon;

    const stepMin = 5;
    let sunRise = null;
    let sunSet = null;
    let sunTransit = null;
    let sunMaxAlt = -999;
    let sunMinAlt = 999;

    let moonRise = null;
    let moonSet = null;
    let moonTransit = null;
    let moonMaxAlt = -999;
    let moonMinAlt = 999;

    let prevSunAlt = null;
    let prevMoonAlt = null;

    for (let m = 0; m <= 24 * 60; m += stepMin) {
      let h = Math.floor(m / 60);
      let mn = m % 60;
      if (h === 24) { h = 23; mn = 59; }

      const utcDate = new Date(Date.UTC(year, month - 1, day, h - 9, mn, 0));
      const jd = getJulianDay(utcDate);

      const sun = getSunPosition(jd, lat, lon);
      const moon = getMoonPosition(jd, lat, lon);

      if (sun.alt > sunMaxAlt) {
        sunMaxAlt = sun.alt;
        sunTransit = { hour: h, minute: mn, alt: sun.alt };
      }
      if (sun.alt < sunMinAlt) {
        sunMinAlt = sun.alt;
      }
      if (moon.alt > moonMaxAlt) {
        moonMaxAlt = moon.alt;
        moonTransit = { hour: h, minute: mn, alt: moon.alt };
      }
      if (moon.alt < moonMinAlt) {
        moonMinAlt = moon.alt;
      }

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

    let sunRiseStr = formatTime(sunRise);
    let sunSetStr = formatTime(sunSet);
    if (sunRise === null && sunSet === null) {
      if (sunMinAlt >= -0.833) {
        sunRiseStr = "白夜(沈まない)";
        sunSetStr = "白夜(沈まない)";
      } else if (sunMaxAlt < -0.833) {
        sunRiseStr = "極夜(昇らない)";
        sunSetStr = "極夜(昇らない)";
      }
    }

    let moonRiseStr = formatTime(moonRise);
    let moonSetStr = formatTime(moonSet);
    if (moonRise === null && moonSet === null) {
      if (moonMinAlt >= 0) {
        moonRiseStr = "1日中地上";
        moonSetStr = "1日中地上";
      } else if (moonMaxAlt < 0) {
        moonRiseStr = "昇らない";
        moonSetStr = "昇らない";
      }
    }

    return {
      sun: {
        rise: sunRiseStr,
        set: sunSetStr,
        transit: formatTime(sunTransit),
        maxAlt: sunMaxAlt > -90 ? sunMaxAlt.toFixed(1) : "--"
      },
      moon: {
        rise: moonRiseStr,
        set: moonSetStr,
        transit: formatTime(moonTransit),
        maxAlt: moonMaxAlt > -90 ? moonMaxAlt.toFixed(1) : "--"
      }
    };
  }

  // 1日の天体軌道（点線のガイドパス用）を生成
  function getDailyPath(year, month, day, lat, lon, refDate) {
    lat = lat !== undefined ? lat : observer.lat;
    lon = lon !== undefined ? lon : observer.lon;

    const pointsSun = [];
    const pointsMoon = [];

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

  /**
   * 宇宙視点用の3D位置・自転・公転・光の方向を一括算出
   * 座標系: 黄道面を XY 平面とし、+Z を黄道北極（反時計回り公転）とする
   */
  function getSpaceState(date, lat, lon) {
    lat = lat !== undefined ? lat : observer.lat;
    lon = lon !== undefined ? lon : observer.lon;

    const jd = getJulianDay(date);
    const sunPos = getSunPosition(jd, lat, lon);
    const moonPos = getMoonPosition(jd, lat, lon);
    const phaseInfo = getMoonPhaseInfo(moonPos.age, moonPos.elongation);

    // 太陽中心に対する地球の公転角度（春分太陽=0°に対し地球は180°側から反時計回り公転）
    const earthOrbitAngleDeg = normDeg(sunPos.lambda + 180.0);
    // 地球から太陽へ向かう単位ベクトル（平行太陽光の到来方向）
    const sunDirEcl = {
      x: Math.cos(rad(sunPos.lambda)),
      y: Math.sin(rad(sunPos.lambda)),
      z: 0
    };

    // 月から地球・太陽の位置関係（3D黄道座標）
    const cosB = Math.cos(rad(moonPos.beta));
    const moonDirEcl = {
      x: cosB * Math.cos(rad(moonPos.lambda)),
      y: cosB * Math.sin(rad(moonPos.lambda)),
      z: Math.sin(rad(moonPos.beta))
    };

    // 太陽光方向を基準とした地球の自転角（0°:正午、+90°:夕方、180°:真夜中、-90°:朝）
    const earthSpinAngleDeg = normDeg(sunPos.hourAngle);

    // 太陽自身の自転角（約25.38日周期）
    const d = jd - 2451545.0;
    const sunSpinAngleDeg = normDeg((d / 25.38) * 360.0);

    // 観測地点の時間帯ラベル（白夜・極夜・太陽の高度と時角から判定）
    let observerTimeZoneLabel = "☀️ 昼";
    if (Math.abs(lat) >= 60 && Math.abs(sunPos.hourAngle) > 150 && sunPos.alt > -0.833) {
      observerTimeZoneLabel = "☀️ 白夜（夜でも太陽が出る）";
    } else if (Math.abs(lat) >= 60 && Math.abs(sunPos.hourAngle) < 30 && sunPos.alt < -0.833) {
      observerTimeZoneLabel = "🌙 極夜（昼でも夜のまま）";
    } else if (sunPos.alt <= -12) {
      observerTimeZoneLabel = "🌙 夜";
    } else if (sunPos.alt <= 8) {
      observerTimeZoneLabel = sunPos.hourAngle < 0 ? "🌅 朝" : "🌇 夕方";
    }

    return {
      jd,
      sunPos,
      moonPos,
      phaseInfo,
      earthOrbitAngleDeg,
      earthSpinAngleDeg,
      moonElongationDeg: moonPos.elongation,
      moonAbsoluteOrbitDeg: moonPos.lambda,
      sunSpinAngleDeg,
      sunDirEcl,
      moonDirEcl,
      epsDeg: sunPos.eps,
      gmstDeg: sunPos.gmst,
      lmstDeg: sunPos.lmst,
      observerTimeZoneLabel
    };
  }

  return {
    setObserver,
    getObserver,
    getJulianDay,
    getSunPosition,
    getMoonPosition,
    getMoonPhaseInfo,
    getDailyEvents,
    getDailyPath,
    getSpaceState
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AstroCalc;
}
