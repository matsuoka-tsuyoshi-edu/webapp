/**
 * Progress Persistence (localStorage) & Saiki City Sugoroku Map Data
 * Path: スタート -> ①かみうら -> ②やよい -> ③さいき -> ④ほんじょう -> ⑤うめ
 *       -> ⑥なおかわ -> ⑦つるみ -> ⑧よのうづ -> ⑨かまえ -> ゴール！
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "ktatsujin_progress_v1";

  const START_TILE = {
    id: -1,
    label: "スタート",
    name: "スタート",
    icon: "🚩",
    desc: "しゅっぱつ！",
  };

  const SAIKI_STATIONS = [
    { id: 0, label: "① かみうら", name: "かみうら", icon: "🌊", desc: "うみが きれいな まち" },
    { id: 1, label: "② やよい", name: "やよい", icon: "🌾", desc: "たんぼと かわの まち" },
    { id: 2, label: "③ さいき", name: "さいき", icon: "🏯", desc: "おしろと みなとの まち" },
    { id: 3, label: "④ ほんじょう", name: "ほんじょう", icon: "🌿", desc: "ほたると みずの まち" },
    { id: 4, label: "⑤ うめ", name: "うめ", icon: "⛰️", desc: "やまとしぜんが いっぱい" },
    { id: 5, label: "⑥ なおかわ", name: "なおかわ", icon: "🪲", desc: "カブトムシの もり" },
    { id: 6, label: "⑦ つるみ", name: "つるみ", icon: "🐟", desc: "おさかなが おいしい！" },
    { id: 7, label: "⑧ よのうづ", name: "よのうづ", icon: "🐚", desc: "うみかぜが きもちいい" },
    { id: 8, label: "⑨ かまえ", name: "かまえ", icon: "🐠", desc: "きらきら みなみの うみ" },
    { id: 9, label: "ゴール！", name: "ゴール！", icon: "🏆", desc: "さいきし 1しゅう たっせい！" },
  ];

  function createDefaultData() {
    return {
      version: 1,
      step: 0,          // 0 = スタート, 1..10 = ①かみうら..ゴール！
      laps: 0,
      crowns: new Array(10).fill(false),
      totalClears: 0,
      totalPerfects: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  function sanitizeData(raw) {
    const def = createDefaultData();
    if (!raw || typeof raw !== "object") return def;

    const step = Number.isInteger(raw.step) ? Math.max(0, Math.min(10, raw.step)) : 0;
    const laps = Number.isInteger(raw.laps) ? Math.max(0, raw.laps) : 0;
    const crowns = Array.isArray(raw.crowns) && raw.crowns.length === 10
      ? raw.crowns.map(Boolean)
      : def.crowns;
    const totalClears = Number.isInteger(raw.totalClears) ? Math.max(0, raw.totalClears) : 0;
    const totalPerfects = Number.isInteger(raw.totalPerfects) ? Math.max(0, raw.totalPerfects) : 0;

    return {
      version: 1,
      step: step,
      laps: laps,
      crowns: crowns,
      totalClears: totalClears,
      totalPerfects: totalPerfects,
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
      // Ignore storage quota / private mode issues
    }
    return clean;
  }

  function recordSessionClear(isPerfect) {
    const data = load();
    let completedLap = false;

    if (data.step >= 10) {
      data.laps += 1;
      data.step = 0;
      data.crowns = new Array(10).fill(false);
    }

    const stationIdx = data.step; // 0..9
    data.crowns[stationIdx] = Boolean(isPerfect);
    data.step = stationIdx + 1;   // 1..10
    data.totalClears += 1;
    if (isPerfect) data.totalPerfects += 1;

    if (data.step === 10) {
      completedLap = true;
    }

    const saved = save(data);
    return {
      data: saved,
      arrivedIndex: stationIdx,
      arrivedStation: SAIKI_STATIONS[stationIdx],
      completedLap: completedLap,
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
    if (!parsed || typeof parsed !== "object" || typeof parsed.step !== "number") {
      throw new Error("Invalid backup JSON format");
    }
    return save(parsed);
  }

  global.ProgressStore = {
    START_TILE: START_TILE,
    STATIONS: SAIKI_STATIONS,
    load: load,
    save: save,
    recordSessionClear: recordSessionClear,
    resetAll: resetAll,
    exportJsonText: exportJsonText,
    importJsonText: importJsonText,
  };
})(window);
