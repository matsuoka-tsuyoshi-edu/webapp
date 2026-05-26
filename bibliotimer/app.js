/* ==========================================================================
   ビブリオバトル・タイマー アプリケーション ロジック
   ========================================================================== */

// --- アプリケーションの状態管理 ---
const state = {
    totalDuration: 300000, // デフォルト: 5分 (300,000ミリ秒)
    timeLeft: 300000,      // 残り時間 (ミリ秒)
    isRunning: false,      // タイマー作動中フラグ
    lastTime: 0,           // 直近のフレーム時刻 (performance.now())
    animationFrameId: null,// アニメーションフレームID
    
    // 設定パラメータ
    suffixType: 'none', // 'phase' | 'none'
    bellEnabled: true,          // ベル（チャイム）の有無
    currentModeLabel: '発表',   // 現在のモード表示名
    theme: 'light',             // 'light' | 'dark'
    
    // ベルの鳴動管理フラグ（各セッションで1度だけ鳴らすため）
    rung1Min: false,       // 残り1分のベル
    rungEnd: false,        // 終了時のベル
    
    // カスタム時間用一時保存
    customMinutes: 5,
    customSeconds: 0
};

// デフォルト設定定数 (初期状態へ戻すリセット用)
const DEFAULT_SETTINGS = {
    totalDuration: 300000,
    suffixType: 'none',
    bellEnabled: true,
    currentModeLabel: '発表',
    theme: 'light',
    customMinutes: 5,
    customSeconds: 0
};

// --- DOM 要素の取得 ---
const elements = {
    body: document.body,
    timeMain: document.getElementById('time-main'),
    timeSub: document.getElementById('time-sub'),
    timeSeparator: document.getElementById('time-separator'),
    timerDisplay: document.getElementById('timer-display'),
    modeBadge: document.getElementById('mode-badge'),
    
    // ボタン類
    startStopBtn: document.getElementById('start-stop-btn'),
    resetBtn: document.getElementById('reset-btn'),
    settingsToggle: document.getElementById('settings-toggle'),
    settingsClose: document.getElementById('settings-close'),
    settingsSave: document.getElementById('settings-save'),
    settingsReset: document.getElementById('settings-reset'),
    soundTestBtn: document.getElementById('sound-test-btn'),
    
    // 構造要素
    playContent: document.querySelector('.play-content'),
    pauseContent: document.querySelector('.pause-content'),
    settingsModal: document.getElementById('settings-modal'),
    
    // 設定フォーム要素
    presetBtns: document.querySelectorAll('.preset-btn'),
    customTimeInputs: document.getElementById('custom-time-inputs'),
    customMinutes: document.getElementById('custom-minutes'),
    customSeconds: document.getElementById('custom-seconds'),
    suffixRadios: document.getElementsByName('suffix-type'),
    bellEnabledCheckbox: document.getElementById('bell-enabled'),
    themeRadios: document.getElementsByName('theme')
};

// --- Web Audio API によるベルチャイムの合成音生成 ---
let audioCtx = null;

/**
 * AudioContextを初期化し、ブラウザの音声制限を解除する
 */
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

/**
 * 澄んだ電子鐘（チーン）の音を合成・再生する
 * @param {number} count ベルを鳴らす回数
 */
function playBell(count = 1) {
    initAudio();
    if (!audioCtx) return;

    const playSingleBell = (delay) => {
        const now = audioCtx.currentTime + delay;
        const duration = 2.5; // ベルの余韻（秒）

        // メタルベル独特の非調和倍音の周波数比率
        // C5 (基音: 約 523.25Hz) または A5 (基音: 880Hz) をベースに設定
        const baseFreq = 880; // A5 澄んだ高い音
        const partials = [
            { freq: baseFreq, gain: 0.5, decayScale: 1.0 },
            { freq: baseFreq * 1.5, gain: 0.25, decayScale: 0.7 },
            { freq: baseFreq * 2.0, gain: 0.15, decayScale: 0.5 },
            { freq: baseFreq * 2.38, gain: 0.10, decayScale: 0.4 },
            { freq: baseFreq * 3.0, gain: 0.05, decayScale: 0.3 }
        ];

        // 全体を包むメインのゲインノード
        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0, now);
        // アタック: 瞬間的に立ち上がる
        masterGain.gain.linearRampToValueAtTime(0.4, now + 0.005);
        // ディケイ: 指数関数的に減衰する
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        masterGain.connect(audioCtx.destination);

        // 各倍音のオシレーターを生成してブレンドする
        partials.forEach(p => {
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();

            osc.type = 'sine'; // 澄んだベルにはサイン波を使用
            osc.frequency.setValueAtTime(p.freq, now);

            // 倍音ごとに個別の減衰を設定
            oscGain.gain.setValueAtTime(p.gain, now);
            oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * p.decayScale);

            osc.connect(oscGain);
            oscGain.connect(masterGain);

            osc.start(now);
            osc.stop(now + duration);
        });
    };

    // 指定回数分、一定の間隔でベルを鳴らす
    for (let i = 0; i < count; i++) {
        playSingleBell(i * 0.8); // 0.8秒間隔
    }
}

// --- タイマー動作ロジック ---

/**
 * タイマー画面を再描画する
 */
function updateDisplay() {
    // 1. メイン表示 (分:秒)
    const totalSeconds = Math.floor(state.timeLeft / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    
    const minutesStr = String(m).padStart(2, '0');
    const secondsStr = String(s).padStart(2, '0');
    
    elements.timeMain.textContent = `${minutesStr}:${secondsStr}`;
    
    // 2. 右側（サブ）表示の切り替え
    if (state.suffixType === 'phase') {
        elements.timeSub.textContent = state.currentModeLabel;
        elements.timeSeparator.innerHTML = '&nbsp;';
    } else {
        elements.timeSub.textContent = '';
        elements.timeSeparator.innerHTML = '';
    }
    
    // 3. 残り時間による文字色変化
    // 30秒以下: 黄色(アンバー) / 10秒以下: 赤 / それ以上: 通常
    elements.timerDisplay.className = ''; // クラス初期化
    if (state.timeLeft <= 10000) {
        elements.timerDisplay.classList.add('timer-color-alert'); // 赤
    } else if (state.timeLeft <= 30000) {
        elements.timerDisplay.classList.add('timer-color-warn');  // 黄色（アンバー）
    } else {
        elements.timerDisplay.classList.add('timer-color-normal'); // 通常（黒/白）
    }
    
    // 4. モードバッジの表示更新
    elements.modeBadge.textContent = state.currentModeLabel;
}

/**
 * 高精度タイマーループ (requestAnimationFrame)
 */
function timerLoop(now) {
    if (!state.isRunning) return;
    
    const delta = now - state.lastTime;
    state.lastTime = now;
    
    state.timeLeft -= delta;
    
    // ベルの判定
    if (state.bellEnabled) {
        // 残り1分を切った瞬間 (60,000ms以下、かつ初期値が1分以上の場合にのみ実行)
        if (state.timeLeft <= 60000 && state.totalDuration > 60000 && !state.rung1Min) {
            playBell(1); // 1回鳴らす
            state.rung1Min = true;
        }
        
        // 終了時
        if (state.timeLeft <= 0 && !state.rungEnd) {
            playBell(3); // 3回鳴らす
            state.rungEnd = true;
        }
    }
    
    // 時間切れ処理
    if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.isRunning = false;
        showPlayIcon(true);
        elements.settingsToggle.classList.remove('dimmed');
        updateDisplay();
        return;
    }
    
    updateDisplay();
    state.animationFrameId = requestAnimationFrame(timerLoop);
}

/**
 * タイマーを開始する
 */
function startTimer() {
    initAudio();
    if (state.isRunning) return;
    
    // すでに0秒の場合は、設定された時間に自動リセットして開始
    if (state.timeLeft <= 0) {
        resetTimer();
    }
    
    state.isRunning = true;
    state.lastTime = performance.now();
    showPlayIcon(false);
    
    // タイマー作動中は設定ボタンを操作不能＆半透明にする
    elements.settingsToggle.classList.add('dimmed');
    
    state.animationFrameId = requestAnimationFrame(timerLoop);
}

/**
 * タイマーを一時停止する
 */
function pauseTimer() {
    if (!state.isRunning) return;
    
    state.isRunning = false;
    if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
    }
    showPlayIcon(true);
    elements.settingsToggle.classList.remove('dimmed');
}

/**
 * タイマーをリセットする
 */
function resetTimer() {
    state.isRunning = false;
    if (state.animationFrameId) {
        cancelAnimationFrame(state.animationFrameId);
    }
    
    state.timeLeft = state.totalDuration;
    state.rung1Min = false;
    state.rungEnd = false;
    
    showPlayIcon(true);
    elements.settingsToggle.classList.remove('dimmed');
    updateDisplay();
}

/**
 * スタート/一時停止ボタンの表示を切り替える
 * @param {boolean} showPlay trueならスタート、falseなら一時停止を表示
 */
function showPlayIcon(showPlay) {
    if (showPlay) {
        elements.playContent.classList.remove('hidden');
        elements.pauseContent.classList.add('hidden');
    } else {
        elements.playContent.classList.add('hidden');
        elements.pauseContent.classList.remove('hidden');
    }
}

// --- 設定・ダイアログ処理 ---

/**
 * ローカルストレージから設定を読み込む
 */
function loadSettings() {
    const saved = localStorage.getItem('bibliotimer_settings');
    if (saved) {
        try {
            const config = JSON.parse(saved);
            state.totalDuration = config.totalDuration || 300000;
            state.timeLeft = state.totalDuration;
            state.suffixType = config.suffixType === 'centiseconds' ? 'none' : (config.suffixType || 'none');
            state.bellEnabled = config.bellEnabled !== undefined ? config.bellEnabled : true;
            state.currentModeLabel = config.currentModeLabel || '発表';
            state.theme = config.theme || 'light';
            state.customMinutes = config.customMinutes || 5;
            state.customSeconds = config.customSeconds || 0;
            
            // テーマの反映
            elements.body.setAttribute('data-theme', state.theme);
        } catch (e) {
            console.error('Failed to parse settings', e);
        }
    }
    updateDisplay();
}

/**
 * 設定をローカルストレージに保存し反映する
 */
function saveSettings() {
    // 選択されたプリセットの判定
    const activePresetBtn = document.querySelector('.preset-btn.active');
    const timeValue = activePresetBtn.getAttribute('data-time');
    let label = activePresetBtn.getAttribute('data-label') || '発表';
    let duration = 300000;
    
    if (timeValue === 'custom') {
        const min = parseInt(elements.customMinutes.value) || 0;
        const sec = parseInt(elements.customSeconds.value) || 0;
        duration = (min * 60 + sec) * 1000;
        label = 'カスタム';
        
        state.customMinutes = min;
        state.customSeconds = sec;
    } else {
        duration = parseInt(timeValue) * 1000;
    }
    
    state.totalDuration = duration;
    state.currentModeLabel = label;
    
    // サフィックス設定の取得
    for (const radio of elements.suffixRadios) {
        if (radio.checked) {
            state.suffixType = radio.value;
            break;
        }
    }
    
    // ベル音設定の取得
    state.bellEnabled = elements.bellEnabledCheckbox.checked;
    
    // テーマ設定の取得
    for (const radio of elements.themeRadios) {
        if (radio.checked) {
            state.theme = radio.value;
            break;
        }
    }
    
    // ストレージへ保存
    const configToSave = {
        totalDuration: state.totalDuration,
        suffixType: state.suffixType,
        bellEnabled: state.bellEnabled,
        currentModeLabel: state.currentModeLabel,
        theme: state.theme,
        customMinutes: state.customMinutes,
        customSeconds: state.customSeconds
    };
    localStorage.setItem('bibliotimer_settings', JSON.stringify(configToSave));
    
    // 反映
    elements.body.setAttribute('data-theme', state.theme);
    resetTimer(); // 設定保存後はタイマーを初期値に戻す
    
    closeSettingsModal();
}

/**
 * 設定フォームに現在の状態を初期セットする
 */
function syncSettingsToForm() {
    // 1. プリセットボタンの選択状態を復元
    elements.presetBtns.forEach(btn => btn.classList.remove('active'));
    
    let matchedPreset = false;
    const currentSec = state.totalDuration / 1000;
    
    elements.presetBtns.forEach(btn => {
        const btnTime = btn.getAttribute('data-time');
        if (btnTime !== 'custom' && parseInt(btnTime) === currentSec) {
            btn.classList.add('active');
            matchedPreset = true;
        }
    });
    
    if (!matchedPreset) {
        // カスタム判定
        const customBtn = Array.from(elements.presetBtns).find(btn => btn.getAttribute('data-time') === 'custom');
        if (customBtn) customBtn.classList.add('active');
        elements.customTimeInputs.classList.remove('hidden');
    } else {
        elements.customTimeInputs.classList.add('hidden');
    }
    
    elements.customMinutes.value = state.customMinutes;
    elements.customSeconds.value = state.customSeconds;
    
    // 2. 右側表示のラジオボタンの復元
    for (const radio of elements.suffixRadios) {
        radio.checked = (radio.value === state.suffixType);
    }
    
    // 3. ベルチェックボックスの復元
    elements.bellEnabledCheckbox.checked = state.bellEnabled;
    
    // 4. テーマの復元
    for (const radio of elements.themeRadios) {
        radio.checked = (radio.value === state.theme);
    }
}

function openSettingsModal() {
    if (state.isRunning) return; // 動作中は開けない
    syncSettingsToForm();
    elements.settingsModal.classList.add('active');
}

function closeSettingsModal() {
    elements.settingsModal.classList.remove('active');
}

// --- イベントリスナーの登録 ---

function initEventListeners() {
    // 画面タップで AudioContext を先行アクティブ化 (iOS対策)
    document.addEventListener('click', initAudio, { once: false });
    document.addEventListener('touchstart', initAudio, { once: false });

    // スタート・一時停止ボタン
    elements.startStopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        if (state.isRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    // リセットボタン
    elements.resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetTimer();
    });

    // 設定モーダル制御
    elements.settingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettingsModal();
    });
    elements.settingsClose.addEventListener('click', closeSettingsModal);
    elements.settingsSave.addEventListener('click', saveSettings);
    
    // 初期設定に戻すリセット処理
    elements.settingsReset.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('設定をすべて初期状態（デフォルト）に戻しますか？')) {
            // ストレージの保存データをクリア
            localStorage.removeItem('bibliotimer_settings');
            
            // stateをデフォルト値に更新
            Object.assign(state, DEFAULT_SETTINGS);
            state.timeLeft = state.totalDuration;
            
            // UI表示とテーマを反映
            elements.body.setAttribute('data-theme', state.theme);
            resetTimer();
            
            closeSettingsModal();
        }
    });
    
    // モーダルの外側をクリックして閉じる
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            closeSettingsModal();
        }
    });

    // プリセットボタンの切替イベント
    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (btn.getAttribute('data-time') === 'custom') {
                elements.customTimeInputs.classList.remove('hidden');
            } else {
                elements.customTimeInputs.classList.add('hidden');
            }
        });
    });

    // 音量テストボタン
    elements.soundTestBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        playBell(1); // 1回鳴動テスト
    });
}

// --- アプリケーション起動 ---
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initEventListeners();
    updateDisplay();
});
