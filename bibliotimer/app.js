/* ==========================================================================
   ビブリオバトル・タイマー アプリケーション ロジック
   ========================================================================== */

// --- アプリケーションの状態管理 ---
const state = {
    // 3フェーズ個別の設定時間 (ミリ秒)
    durationPres: 300000,       // 発表 (5分)
    durationDisc: 180000,       // ディスカッション (3分)
    durationTran: 15000,        // 移動準備 (15秒)
    
    totalDuration: 300000, // 現在のアクティブ制限時間 (ミリ秒)
    timeLeft: 300000,      // 残り時間 (ミリ秒)
    isRunning: false,      // タイマー作動中フラグ
    lastTime: 0,           // 直近のフレーム時刻 (performance.now())
    animationFrameId: null,// アニメーションフレームID
    
    // 設定パラメータ
    bellEnabled: true,          // ベル（チャイム）の有無
    soundType: 'bell-standard', // 'bell-standard' | 'bell-high' | 'buzzer' | 'horn'
    autoBatonMode: 'auto',      // 'off' | 'manual' | 'auto' (デフォルト: auto)
    battlePhase: 'presentation',// 'presentation' | 'discussion' | 'transition'
    currentModeLabel: '発表',   // 現在のモード表示名
    theme: 'light',             // 'light' | 'dark'
    
    // ベルの鳴動管理フラグ
    rung1Min: false,       // 残り1分のベル
    rungEnd: false         // 終了時のベル
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
    timePresMin: document.getElementById('time-pres-min'),
    timePresSec: document.getElementById('time-pres-sec'),
    timeDiscMin: document.getElementById('time-disc-min'),
    timeDiscSec: document.getElementById('time-disc-sec'),
    timeTranMin: document.getElementById('time-tran-min'),
    timeTranSec: document.getElementById('time-tran-sec'),
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
        const duration = 1.8; // 余韻を少し長めにして美しい残響にする

        const baseFreq = 2500; // 超高音のキーンとした突き抜けるピッチ (約2.5kHz)
        const partials = [
            { freq: baseFreq, gain: 0.45, decayScale: 1.0 },
            { freq: baseFreq * 1.503, gain: 0.2, decayScale: 0.7 },
            { freq: baseFreq * 2.001, gain: 0.1, decayScale: 0.5 },
            { freq: baseFreq * 2.42, gain: 0.05, decayScale: 0.3 }
        ];

        const masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.35, now + 0.002); // 超鋭い瞬時のアタック
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
        playSingleBell(i * 0.6); // 高音ベルはテンポよく0.6秒間隔
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
    // すでに初期化されている場合はタッチイベント外での再レジュームを避ける（iOS自動再生ブロック対策）
    if (!audioCtx) {
        initAudio();
    }
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
    
    // 2. 右側（サブ）表示は不要になったため常に非表示
    elements.timeSub.textContent = '';
    elements.timeSeparator.innerHTML = '';
    
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
    let nextDuration = state.durationPres;
    let nextLabel = '発表';
    
    if (state.battlePhase === 'presentation') {
        nextPhase = 'discussion';
        nextDuration = state.durationDisc;
        nextLabel = 'ディスカッション';
    } else if (state.battlePhase === 'discussion') {
        nextPhase = 'transition';
        nextDuration = state.durationTran;
        nextLabel = '移動準備';
    } else if (state.battlePhase === 'transition') {
        nextPhase = 'presentation';
        nextDuration = state.durationPres;
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
    
    if (state.autoBatonMode === 'auto') {
        // オート連続モードの場合:
        // 終了チャイムの再生中（余韻）を考慮し、1.2秒後に自動的にタイマーを開始
        setTimeout(() => {
            if (!state.isRunning) {
                startTimer(true); // 自動起動フラグを true に指定して呼び出す（iOSブロック対策）
            }
        }, 1200);
    }
}

/**
 * タイマーを開始する
 * @param {boolean} isAutoStart 自動起動（タッチイベント外）かどうか
 */
function startTimer(isAutoStart = false) {
    if (!isAutoStart) {
        initAudio();
    }
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
            state.durationPres = config.durationPres || 300000;
            state.durationDisc = config.durationDisc || 180000;
            state.durationTran = config.durationTran || 15000;
            state.autoBatonMode = config.autoBatonMode || 'auto'; // デフォルト: オート連続
            state.bellEnabled = config.bellEnabled !== undefined ? config.bellEnabled : true;
            state.soundType = config.soundType || 'bell-standard';
            state.currentModeLabel = config.currentModeLabel || '発表';
            state.theme = config.theme || 'light';
            
            state.totalDuration = config.totalDuration || state.durationPres;
            state.timeLeft = state.totalDuration;
            
            // 読み込んだトータル時間と個別設定時間を比較して現在のバトルフェーズを同期
            if (state.totalDuration === state.durationDisc) {
                state.battlePhase = 'discussion';
            } else if (state.totalDuration === state.durationTran) {
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
    // 各個別時間の読み取り
    const presMin = parseInt(elements.timePresMin.value) || 0;
    const presSec = parseInt(elements.timePresSec.value) || 0;
    state.durationPres = (presMin * 60 + presSec) * 1000;
    
    const discMin = parseInt(elements.timeDiscMin.value) || 0;
    const discSec = parseInt(elements.timeDiscSec.value) || 0;
    state.durationDisc = (discMin * 60 + discSec) * 1000;
    
    const tranMin = parseInt(elements.timeTranMin.value) || 0;
    const tranSec = parseInt(elements.timeTranSec.value) || 0;
    state.durationTran = (tranMin * 60 + tranSec) * 1000;
    
    // 現在アクティブなフェーズに合わせてトータルデュレーションを設定
    if (state.battlePhase === 'presentation') {
        state.totalDuration = state.durationPres;
        state.currentModeLabel = '発表';
    } else if (state.battlePhase === 'discussion') {
        state.totalDuration = state.durationDisc;
        state.currentModeLabel = 'ディスカッション';
    } else if (state.battlePhase === 'transition') {
        state.totalDuration = state.durationTran;
        state.currentModeLabel = '移動準備';
    } else {
        state.totalDuration = state.durationPres;
        state.currentModeLabel = '発表';
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
        durationPres: state.durationPres,
        durationDisc: state.durationDisc,
        durationTran: state.durationTran,
        totalDuration: state.totalDuration,
        bellEnabled: state.bellEnabled,
        soundType: state.soundType,
        autoBatonMode: state.autoBatonMode,
        currentModeLabel: state.currentModeLabel,
        theme: state.theme
    };
    localStorage.setItem('bibliotimer_settings', JSON.stringify(configToSave));
    
    // 反映
    elements.body.setAttribute('data-theme', state.theme);
    resetTimer(); // 設定保存後はタイマーを初期値に戻す
    
    closeSettingsModal();
}

/**
 * 設定画面の時間を初期デフォルトにリセットする
 */
function resetSettingsToDefault() {
    if (confirm('設定をすべて初期のデフォルト値に戻しますか？\n（現在実行中のタイマーも最初に戻ります）')) {
        // 1. localStorageデータを消去
        localStorage.removeItem('bibliotimer_settings');
        
        // 2. 状態管理パラメータをデフォルトに戻す
        state.durationPres = 300000; // 5分
        state.durationDisc = 180000; // 3分
        state.durationTran = 15000;  // 15秒
        state.bellEnabled = true;
        state.soundType = 'bell-standard';
        state.autoBatonMode = 'auto'; // デフォルトはオート連続
        state.theme = 'light';
        
        state.battlePhase = 'presentation';
        state.totalDuration = state.durationPres;
        state.timeLeft = state.totalDuration;
        state.currentModeLabel = '発表';
        
        // 3. テーマの即時反映
        elements.body.setAttribute('data-theme', state.theme);
        
        // 4. フォーム入力UIの復元と同期
        syncSettingsToForm();
        
        // 5. タイマーの即時リセットと表示の更新
        resetTimer();
    }
}

/**
 * 設定フォームに現在の状態を初期セットする
 */
function syncSettingsToForm() {
    // 1. 各個別時間の分秒の復元
    elements.timePresMin.value = Math.floor(state.durationPres / 60000);
    elements.timePresSec.value = Math.floor((state.durationPres % 60000) / 1000);
    
    elements.timeDiscMin.value = Math.floor(state.durationDisc / 60000);
    elements.timeDiscSec.value = Math.floor((state.durationDisc % 60000) / 1000);
    
    elements.timeTranMin.value = Math.floor(state.durationTran / 60000);
    elements.timeTranSec.value = Math.floor((state.durationTran % 60000) / 1000);
    
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
    elements.settingsReset.addEventListener('click', resetSettingsToDefault);
    
    // モーダルの外側をクリックして閉じる
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            closeSettingsModal();
        }
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

/**
 * 設定画面の分・秒セレクトボックスの選択肢を動的に生成する
 */
function populateSelectOptions() {
    const selectElements = [
        { el: elements.timePresMin, max: 99, defaultVal: 5 },
        { el: elements.timePresSec, max: 59, defaultVal: 0 },
        { el: elements.timeDiscMin, max: 99, defaultVal: 3 },
        { el: elements.timeDiscSec, max: 59, defaultVal: 0 },
        { el: elements.timeTranMin, max: 99, defaultVal: 0 },
        { el: elements.timeTranSec, max: 59, defaultVal: 15 }
    ];
    
    selectElements.forEach(item => {
        if (!item.el) return;
        
        // 既存の選択肢をクリア
        item.el.innerHTML = '';
        
        for (let i = 0; i <= item.max; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = String(i).padStart(2, '0');
            item.el.appendChild(opt);
        }
        
        // 初期デフォルト値のセット
        item.el.value = item.defaultVal;
    });
}

// --- アプリケーション起動 ---
window.addEventListener('DOMContentLoaded', () => {
    populateSelectOptions(); // セレクトボックスの選択肢を動的に生成
    loadSettings();
    initEventListeners();
    updateDisplay();
});
