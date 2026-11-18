/**
 * Progress Persistence (localStorage) — v3 Schema (backward-compatible with v1/v2)
 * - saiki: 佐伯市一周すごろく (add/sub)
 * - oita: 大分県一周すごろく (mul all_rand 1-shot)
 * - kyushu: 九州・沖縄一周すごろく (div mix 1-shot)
 * - mulBadges & divBadges: 🌸 cleared / 👑 1-shot / 🎖️ master
 * - japan: 日本一周 計算の旅 (47 prefectures, unlocked on Kyushu goal)
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "ktatsujin_progress_v1";

  const START_TILE = {
    id: -1,
    label: "スタート",
    name: "スタート",
    icon: "🚩",
  };

  const SAIKI_STATIONS = [
    { id: 0, label: "① かみうら", name: "かみうら", icon: "🌊" },
    { id: 1, label: "② やよい", name: "やよい", icon: "🌾" },
    { id: 2, label: "③ さいき", name: "さいき", icon: "🏯" },
    { id: 3, label: "④ ほんじょう", name: "ほんじょう", icon: "🌿" },
    { id: 4, label: "⑤ うめ", name: "うめ", icon: "⛰️" },
    { id: 5, label: "⑥ なおかわ", name: "なおかわ", icon: "🪲" },
    { id: 6, label: "⑦ つるみ", name: "つるみ", icon: "🐟" },
    { id: 7, label: "⑧ よのうづ", name: "よのうづ", icon: "🐚" },
    { id: 8, label: "⑨ かまえ", name: "かまえ", icon: "🐠" },
    { id: 9, label: "ゴール！", name: "ゴール！", icon: "🏆" },
  ];

  const OITA_STATIONS = [
    { id: 0, label: "① さいき", name: "さいき", icon: "🌊" },
    { id: 1, label: "② うすき・つくみ", name: "うすき・つくみ", icon: "🍊" },
    { id: 2, label: "③ おおいた", name: "おおいた", icon: "🏙️" },
    { id: 3, label: "④ べっぷ", name: "べっぷ", icon: "♨️" },
    { id: 4, label: "⑤ ゆふ", name: "ゆふ", icon: "⛰️" },
    { id: 5, label: "⑥ たけた", name: "たけた", icon: "🏯" },
    { id: 6, label: "⑦ ひた", name: "ひた", icon: "🌲" },
    { id: 7, label: "⑧ なかつ", name: "なかつ", icon: "🍁" },
    { id: 8, label: "⑨ うさ・くにさき", name: "うさ・くにさき", icon: "⛩️" },
    { id: 9, label: "ゴール！", name: "ゴール！", icon: "🏆" },
  ];

  const KYUSHU_STATIONS = [
    { id: 0, label: "① おおいた", name: "おおいた", icon: "♨️" },
    { id: 1, label: "② ふくおか", name: "ふくおか", icon: "🍓" },
    { id: 2, label: "③ さが", name: "さが", icon: "🎈" },
    { id: 3, label: "④ ながさき", name: "ながさき", icon: "⛪" },
    { id: 4, label: "⑤ くまもと", name: "くまもと", icon: "🐻" },
    { id: 5, label: "⑥ みやざき", name: "みやざき", icon: "🌴" },
    { id: 6, label: "⑦ かごしま", name: "かごしま", icon: "🌋" },
    { id: 7, label: "⑧ おきなわ", name: "おきなわ", icon: "🌺" },
    { id: 8, label: "ゴール！", name: "ゴール！", icon: "🏆" },
  ];

  function createBalancedJapanAssignments() {
    const types = [];
    let i;
    for (i = 0; i < 10; i++) types.push("add");
    for (i = 0; i < 10; i++) types.push("sub");
    for (i = 0; i < 9; i++) types.push("mul");
    for (i = 0; i < 9; i++) types.push("div_exact");
    for (i = 0; i < 9; i++) types.push("div_rem");

    for (i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = types[i];
      types[i] = types[j];
      types[j] = tmp;
    }

    const map = {};
    for (i = 1; i <= 47; i++) {
      map[String(i)] = types[i - 1];
    }
    return map;
  }

  function createDefaultBoard(unlocked, len) {
    const n = len || 10;
    return {
      unlocked: Boolean(unlocked),
      step: 0,
      laps: 0,
      crowns: new Array(n).fill(false),
      totalClears: 0,
      totalPerfects: 0,
    };
  }

  function createDefaultJapan() {
    return {
      unlocked: false,
      assignments: createBalancedJapanAssignments(),
      cleared: {},
    };
  }

  function createDefaultData() {
    return {
      version: 3,
      saiki: createDefaultBoard(true, 10),
      oita: createDefaultBoard(false, 10),
      kyushu: createDefaultBoard(false, 9),
      mulBadges: {},
      divBadges: {},
      japan: createDefaultJapan(),
      updatedAt: new Date().toISOString(),
    };
  }

  function sanitizeBoard(raw, defaultUnlocked, len) {
    const n = len || 10;
    const def = createDefaultBoard(defaultUnlocked, n);
    if (!raw || typeof raw !== "object") return def;
    return {
      unlocked: defaultUnlocked ? true : Boolean(raw.unlocked),
      step: Number.isInteger(raw.step) ? Math.max(0, Math.min(n, raw.step)) : 0,
      laps: Number.isInteger(raw.laps) ? Math.max(0, raw.laps) : 0,
      crowns:
        Array.isArray(raw.crowns) && raw.crowns.length === n
          ? raw.crowns.map(Boolean)
          : def.crowns,
      totalClears: Number.isInteger(raw.totalClears) ? Math.max(0, raw.totalClears) : 0,
      totalPerfects: Number.isInteger(raw.totalPerfects) ? Math.max(0, raw.totalPerfects) : 0,
    };
  }

  function sanitizeBadgeMap(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (k) {
      const v = raw[k];
      if (v && typeof v === "object") {
        out[k] = {
          cleared: Boolean(v.cleared),
          perfect: Boolean(v.perfect),
        };
      }
    });
    return out;
  }

  function sanitizeJapan(raw, kyushuBoard) {
    const kyushuGoalReached =
      kyushuBoard && (kyushuBoard.step >= 9 || kyushuBoard.laps >= 1);
    const base = createDefaultJapan();
    if (!raw || typeof raw !== "object") {
      base.unlocked = Boolean(kyushuGoalReached);
      return base;
    }

    const validTypes = { add: true, sub: true, mul: true, div_exact: true, div_rem: true };
    const assignments = base.assignments;
    if (raw.assignments && typeof raw.assignments === "object") {
      for (let i = 1; i <= 47; i++) {
        const key = String(i);
        if (validTypes[raw.assignments[key]]) {
          assignments[key] = raw.assignments[key];
        }
      }
    }

    return {
      unlocked: Boolean(raw.unlocked || kyushuGoalReached),
      assignments: assignments,
      cleared: sanitizeBadgeMap(raw.cleared),
    };
  }

  function sanitizeData(raw) {
    const def = createDefaultData();
    if (!raw || typeof raw !== "object") return def;

    if (typeof raw.step === "number" && !raw.saiki) {
      return {
        version: 3,
        saiki: sanitizeBoard(raw, true, 10),
        oita: createDefaultBoard(false, 10),
        kyushu: createDefaultBoard(false, 9),
        mulBadges: {},
        divBadges: {},
        japan: createDefaultJapan(),
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : def.updatedAt,
      };
    }

    const kyushu = sanitizeBoard(raw.kyushu, false, 9);
    return {
      version: 3,
      saiki: sanitizeBoard(raw.saiki, true, 10),
      oita: sanitizeBoard(raw.oita, false, 10),
      kyushu: kyushu,
      mulBadges: sanitizeBadgeMap(raw.mulBadges),
      divBadges: sanitizeBadgeMap(raw.divBadges),
      japan: sanitizeJapan(raw.japan, kyushu),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : def.updatedAt,
    };
  }

  function load() {
    try {
      const txt = global.localStorage.getItem(STORAGE_KEY);
      if (!txt) return createDefaultData();
      return sanitizeData(JSON.parse(txt));
    } catch (e) {
      return createDefaultData();
    }
  }

  function save(data) {
    const clean = sanitizeData(data);
    clean.updatedAt = new Date().toISOString();
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
      // Ignore storage errors
    }
    return clean;
  }

  function advanceBoard(board, stations, isPerfect) {
    const len = stations.length;
    let completedLap = false;
    const justUnlocked = !board.unlocked;
    board.unlocked = true;

    if (board.step >= len) {
      board.laps += 1;
      board.step = 0;
      board.crowns = new Array(len).fill(false);
    }

    const stationIdx = board.step;
    board.crowns[stationIdx] = Boolean(isPerfect);
    board.step = stationIdx + 1;
    board.totalClears += 1;
    if (isPerfect) board.totalPerfects += 1;
    if (board.step === len) completedLap = true;

    return {
      justUnlocked: justUnlocked,
      arrivedIndex: stationIdx,
      arrivedStation: stations[stationIdx],
      completedLap: completedLap,
    };
  }

  function recordSessionClear(isPerfect) {
    const data = load();
    const res = advanceBoard(data.saiki, SAIKI_STATIONS, isPerfect);
    const saved = save(data);
    return {
      data: saved,
      arrivedIndex: res.arrivedIndex,
      arrivedStation: res.arrivedStation,
      completedLap: res.completedLap,
    };
  }

  function recordOitaOneShotClear() {
    const data = load();
    const res = advanceBoard(data.oita, OITA_STATIONS, true);
    const saved = save(data);
    return {
      data: saved,
      justUnlocked: res.justUnlocked,
      arrivedIndex: res.arrivedIndex,
      arrivedStation: res.arrivedStation,
      completedLap: res.completedLap,
    };
  }

  function recordKyushuOneShotClear() {
    const data = load();
    const wasJapanUnlocked = data.japan.unlocked;
    const res = advanceBoard(data.kyushu, KYUSHU_STATIONS, true);
    if (res.completedLap) {
      data.japan.unlocked = true;
    }
    const saved = save(data);
    return {
      data: saved,
      justUnlocked: res.justUnlocked,
      justUnlockedJapan: !wasJapanUnlocked && saved.japan.unlocked,
      arrivedIndex: res.arrivedIndex,
      arrivedStation: res.arrivedStation,
      completedLap: res.completedLap,
    };
  }

  function recordMulCourseResult(courseKey, isPerfect) {
    if (!courseKey) return load();
    const data = load();
    const prev = data.mulBadges[courseKey] || { cleared: false, perfect: false };
    data.mulBadges[courseKey] = {
      cleared: true,
      perfect: Boolean(prev.perfect || isPerfect),
    };
    return save(data);
  }

  function recordDivCourseResult(divKind, isPerfect) {
    const data = load();
    const prev = data.divBadges[divKind] || { cleared: false, perfect: false };
    data.divBadges[divKind] = {
      cleared: true,
      perfect: Boolean(prev.perfect || isPerfect),
    };
    return save(data);
  }

  function getDivBadge(data, divKind) {
    return (data && data.divBadges && data.divBadges[divKind]) || { cleared: false, perfect: false };
  }

  function getDivMasterStatus(data) {
    const kinds = ["exact", "rem", "mix"];
    let clearedCount = 0;
    let perfectCount = 0;
    kinds.forEach(function (k) {
      const b = getDivBadge(data, k);
      if (b.cleared) clearedCount++;
      if (b.perfect) perfectCount++;
    });
    return {
      clearedCount: clearedCount,
      perfectCount: perfectCount,
      isMaster: clearedCount === 3,
      isPerfectMaster: perfectCount === 3,
    };
  }

  function getMulCourseBadge(data, courseKey) {
    const b = data && data.mulBadges && data.mulBadges[courseKey];
    return b || { cleared: false, perfect: false };
  }

  function getTableMasterStatus(data, table) {
    const keys = [
      "t_" + table + "_asc",
      "t_" + table + "_desc",
      "t_" + table + "_rand",
    ];
    let clearedCount = 0;
    let perfectCount = 0;
    keys.forEach(function (k) {
      const b = getMulCourseBadge(data, k);
      if (b.cleared) clearedCount++;
      if (b.perfect) perfectCount++;
    });
    return {
      clearedCount: clearedCount,
      perfectCount: perfectCount,
      isMaster: clearedCount === 3,
      isPerfectMaster: perfectCount === 3,
    };
  }

  function getTotalMasteredTables(data) {
    let count = 0;
    for (let t = 2; t <= 9; t++) {
      if (getTableMasterStatus(data, t).isMaster) count++;
    }
    return count;
  }

  function recordJapanPrefResult(prefId, isPerfect) {
    const data = load();
    const key = String(prefId);
    const prev = data.japan.cleared[key] || { cleared: false, perfect: false };
    data.japan.cleared[key] = {
      cleared: true,
      perfect: Boolean(prev.perfect || isPerfect),
    };
    return save(data);
  }

  function getJapanStats(data) {
    const clearedMap = (data && data.japan && data.japan.cleared) || {};
    let clearedCount = 0;
    let perfectCount = 0;
    Object.keys(clearedMap).forEach(function (k) {
      if (clearedMap[k].cleared) clearedCount++;
      if (clearedMap[k].perfect) perfectCount++;
    });
    return {
      clearedCount: clearedCount,
      perfectCount: perfectCount,
      allCleared: clearedCount >= 47,
    };
  }

  function resetAll() {
    return save(createDefaultData());
  }

  function exportJsonText() {
    return JSON.stringify(load(), null, 2);
  }

  function importJsonText(jsonText) {
    const parsed = JSON.parse(jsonText);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (typeof parsed.step !== "number" && typeof parsed.saiki !== "object")
    ) {
      throw new Error("Invalid backup JSON format");
    }
    return save(parsed);
  }

  global.ProgressStore = {
    START_TILE: START_TILE,
    SAIKI_STATIONS: SAIKI_STATIONS,
    OITA_STATIONS: OITA_STATIONS,
    KYUSHU_STATIONS: KYUSHU_STATIONS,
    STATIONS: SAIKI_STATIONS,
    load: load,
    save: save,
    recordSessionClear: recordSessionClear,
    recordOitaOneShotClear: recordOitaOneShotClear,
    recordKyushuOneShotClear: recordKyushuOneShotClear,
    recordMulCourseResult: recordMulCourseResult,
    recordDivCourseResult: recordDivCourseResult,
    getDivBadge: getDivBadge,
    getDivMasterStatus: getDivMasterStatus,
    getMulCourseBadge: getMulCourseBadge,
    getTableMasterStatus: getTableMasterStatus,
    getTotalMasteredTables: getTotalMasteredTables,
    recordJapanPrefResult: recordJapanPrefResult,
    getJapanStats: getJapanStats,
    resetAll: resetAll,
    exportJsonText: exportJsonText,
    importJsonText: importJsonText,
  };
})(window);
