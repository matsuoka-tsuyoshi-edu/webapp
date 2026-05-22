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
    soundType: 'bell-standard', // 'bell-standard' | 'bell-high' | 'buzzer' | 'horn'
    autoBatonMode: 'off',       // 'off' | 'manual' | 'auto'
    battlePhase: 'presentation',// 'presentation' | 'discussion' | 'transition'
    currentModeLabel: '発表',   // 現在のモード表示名
    theme: 'light',             // 'light' | 'dark'
    
    // ベルの鳴動管理フラグ（各セッションで1度だけ鳴らすため）
    rung1Min: false,       // 残り1分のベル
    rungEnd: false,        // 終了時のベル
    
    // カスタム時間用一時保存
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
    soundTypeRadios: document.getElementsByName('sound-type'),
    autoBatonRadios: document.getElementsByName('auto-baton'),
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
/**
 * 従来の標準的な電子鐘（チーン）を再生する
 */
function playStandardBell(count = 1) {
    const playSingleBell = (delay) => {
        const now = audioCtx.currentTime + delay;
        const duration = 2.5;

        const baseFreq = 880; // A5 澄んだ高い音
        const partials = [
            { freq: baseFreq, gain: 0.5, decayScale: 1.0 },
            { freq: baseFreq * 1.5, gain: 0.25, decayScale: 0.7 },
            { freq: baseFreq * 2.0, gain: 0.15, decayScale: 0.5 },
            { freq: baseFreq * 2.38, gain: 0.10, decayScale: 0.4 },
            { freq: baseFreq * 3.0, gain: 0.05, decayScale: 0.3 }
        ];

        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.4, now + 0.005);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        masterGain.connect(audioCtx.destination);

        partials.forEach(p => {
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(p.freq, now);
            oscGain.gain.setValueAtTime(p.gain, now);
            oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * p.decayScale);
            osc.connect(oscGain);
            oscGain.connect(masterGain);
            osc.start(now);
            osc.stop(now + duration);
        });
    };

    for (let i = 0; i < count; i++) {
        playSingleBell(i * 0.8);
    }
}

/**
 * 高音の澄んだベル（フロントベル風）を再生する
 */
function playHighBell(count = 1) {
    const playSingleBell = (delay) => {
        const now = audioCtx.currentTime + delay;
        const duration = 1.2; // 少し余韻を短く

        const baseFreq = 1600; // 高音のチンッという響き
        const partials = [
            { freq: baseFreq, gain: 0.4, decayScale: 1.0 },
            { freq: baseFreq * 1.5, gain: 0.2, decayScale: 0.6 },
            { freq: baseFreq * 2.0, gain: 0.1, decayScale: 0.4 },
            { freq: baseFreq * 2.5, gain: 0.05, decayScale: 0.2 }
        ];

        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.3, now + 0.003); // アタックを非常に鋭く
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        masterGain.connect(audioCtx.destination);

        partials.forEach(p => {
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(p.freq, now);
            oscGain.gain.setValueAtTime(p.gain, now);
            oscGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * p.decayScale);
            osc.connect(oscGain);
            oscGain.connect(masterGain);
            osc.start(now);
            osc.stop(now + duration);
        });
    };

    for (let i = 0; i < count; i++) {
        playSingleBell(i * 0.5); // 高テンポで鳴らす
    }
}

/**
 * 電子警告ブザー音（プー、プー、プー）を再生する
 */
function playBuzzer(count = 1) {
    const playSingleBuzzer = (delay) => {
        const now = audioCtx.currentTime + delay;
        const duration = 0.25; // 歯切れの良い電子警告音

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = 'square'; // 矩形波で無機質なブザー感を出す
        osc.frequency.setValueAtTime(480, now); // ピッピーというピッチ

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gainNode.gain.setValueAtTime(0.15, now + duration - 0.02);
        gainNode.gain.linearRampToValueAtTime(0, now + duration); // ポップノイズ防止

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + duration);
    };

    for (let i = 0; i < count; i++) {
        playSingleBuzzer(i * 0.4);
    }
}

/**
 * 重厚なアリーナホーン（ブォーー）を再生する
 */
function playHorn(count = 1) {
    const playSingleHorn = (delay) => {
        const now = audioCtx.currentTime + delay;
        const duration = 0.8; // 長めの豪快なホーン

        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc1.type = 'sawtooth'; // 鋸歯状波で太く
        osc2.type = 'sawtooth';

        osc1.frequency.setValueAtTime(120, now); // 低音
        osc2.frequency.setValueAtTime(121.5, now); // わずかにデチューンして厚みを出す

        filter.type = 'lowpass'; // 耳に痛い高域をカット
        filter.frequency.setValueAtTime(800, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05); // 立ち上がりを少し粘る
        gainNode.gain.setValueAtTime(0.25, now + duration - 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    };

    for (let i = 0; i < count; i++) {
        playSingleHorn(i * 1.0);
    }
}

/**
 * 選択された音色でチャイムを再生するメイン関数
 * @param {number} count 再生する回数
 * @param {string} soundType 再生する音色の種類（指定がなければ現在の設定値）
 */
function playBell(count = 1, soundType = state.soundType) {
    initAudio();
    if (!audioCtx) return;

    switch (soundType) {
        case 'bell-high':
            playHighBell(count);
            break;
        case 'buzzer':
            playBuzzer(count);
            break;
        case 'horn':
            playHorn(count);
            break;
        case 'bell-standard':
        default:
            playStandardBell(count);
            break;
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
        
        // ビブリオバトル進行遷移処理を実行
        handlePhaseTransition();
        return;
    }
    
    updateDisplay();
    state.animationFrameId = requestAnimationFrame(timerLoop);
}

/**
 * ビブリオバトルのフェーズ（発表➔ディスカッション➔移動）を自動で切り替える
 */
function handlePhaseTransition() {
    if (state.autoBatonMode === 'off') return;
    
    let nextPhase = 'presentation';
    let nextDuration = 300000; // 5分
    let nextLabel = '発表';
    
    if (state.battlePhase === 'presentation') {
        nextPhase = 'discussion';
        nextDuration = 180000; // 3分
        nextLabel = 'ディスカッション';
    } else if (state.battlePhase === 'discussion') {
        nextPhase = 'transition';
        nextDuration = 15000; // 15秒 (ミリ秒単位)
        nextLabel = '移動準備';
    } else if (state.battlePhase === 'transition') {
        nextPhase = 'presentation';
        nextDuration = 300000; // 5分
        nextLabel = '発表';
    }
    
    // 状態の移行
    state.battlePhase = nextPhase;
    state.totalDuration = nextDuration;
    state.timeLeft = nextDuration;
    state.currentModeLabel = nextLabel;
    
    // 各フェーズでの終了フラグなどのリセット
    state.rung1Min = false;
    state.rungEnd = false;
    
    // 画面表示更新
    updateDisplay();
    
    // 設定画面のプリセット選択状態も同期
    syncCurrentPhaseToPresetUI();
    
    if (state.autoBatonMode === 'auto') {
        // オート連続モードの場合:
        // 終了チャイムの再生中（余韻）を考慮し、1.2秒後に自動的にタイマーを開始
        setTimeout(() => {
            if (!state.isRunning) {
                startTimer();
            }
        }, 1200);
    }
}

/**
 * 現在のバトルフェーズに対応する設定画面のプリセットをアクティブにする
 */
function syncCurrentPhaseToPresetUI() {
    elements.presetBtns.forEach(btn => btn.classList.remove('active'));
    
    let currentSec = state.totalDuration / 1000;
    let matched = false;
    
    elements.presetBtns.forEach(btn => {
        const btnTime = btn.getAttribute('data-time');
        if (btnTime !== 'custom' && parseInt(btnTime) === currentSec) {
            btn.classList.add('active');
            matched = true;
        }
    });
    
    if (!matched) {
        const customBtn = Array.from(elements.presetBtns).find(btn => btn.getAttribute('data-time') === 'custom');
        if (customBtn) customBtn.classList.add('active');
        
        const min = Math.floor(currentSec / 60);
        const sec = currentSec % 60;
        elements.customMinutes.value = min;
        elements.customSeconds.value = sec;
        elements.customTimeInputs.classList.remove('hidden');
    } else {
        elements.customTimeInputs.classList.add('hidden');
    }
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
            state.soundType = config.soundType || 'bell-standard';
            state.autoBatonMode = config.autoBatonMode || 'off';
            state.currentModeLabel = config.currentModeLabel || '発表';
            state.theme = config.theme || 'light';
            state.customMinutes = config.customMinutes || 5;
            state.customSeconds = config.customSeconds || 0;
            
            // 読み込んだ時間から現在のバトルフェーズを割り出して同期
            const currentSec = state.totalDuration / 1000;
            if (currentSec === 300) {
                state.battlePhase = 'presentation';
            } else if (currentSec === 180) {
                state.battlePhase = 'discussion';
            } else if (currentSec === 15) {
                state.battlePhase = 'transition';
            } else {
                state.battlePhase = 'presentation';
            }
            
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
    
    // 保存した設定時間から現在のフェーズを同期
    if (duration === 300000) {
        state.battlePhase = 'presentation';
    } else if (duration === 180000) {
        state.battlePhase = 'discussion';
    } else if (duration === 15000) {
        state.battlePhase = 'transition';
    } else {
        state.battlePhase = 'presentation';
    }
    
    // サフィックス設定の取得
    for (const radio of elements.suffixRadios) {
        if (radio.checked) {
            state.suffixType = radio.value;
            break;
        }
    }
    
    // ベル音設定の取得
    state.bellEnabled = elements.bellEnabledCheckbox.checked;
    
    // 効果音種別設定の取得
    for (const radio of elements.soundTypeRadios) {
        if (radio.checked) {
            state.soundType = radio.value;
            break;
        }
    }
    
    // 自動進行バトンモード設定の取得
    for (const radio of elements.autoBatonRadios) {
        if (radio.checked) {
            state.autoBatonMode = radio.value;
            break;
        }
    }
    
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
        soundType: state.soundType,
        autoBatonMode: state.autoBatonMode,
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
    
    // 3.5 効果音種別の復元
    for (const radio of elements.soundTypeRadios) {
        radio.checked = (radio.value === state.soundType);
    }
    
    // 3.8 自動バトン設定の復元
    for (const radio of elements.autoBatonRadios) {
        radio.checked = (radio.value === state.autoBatonMode);
    }
    
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
        
        let selectedType = 'bell-standard';
        for (const radio of elements.soundTypeRadios) {
            if (radio.checked) {
                selectedType = radio.value;
                break;
            }
        }
        playBell(1, selectedType); // 選択中の音色で1回テスト再生
    });

    // 効果音ラジオボタンの切替時にプレビュー再生
    elements.soundTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                initAudio();
                playBell(1, radio.value);
            }
        });
    });
}

// --- アプリケーション起動 ---
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initEventListeners();
    updateDisplay();
});
