// ==========================================
// がい数計算機アプリ (gaisu/app.js)
// ==========================================

const state = {
  unlocked: {
    puzzle: true,
    machine: false,
    quiz: false
  },
  // パズルスロット（教科書の4つの□）
  // 正解：pos1=3, cond1=5, cond2=9, pos2=3
  slots: {
    pos1: null,   // 上から [ 3 ] けた目の数字を見る
    cond1: null,  // [ 5 ] 以上の数か
    cond2: null,  // 上から2けた目の数字は [ 9 ] か
    pos2: null    // 上から [ 3 ] けた目以降の数字を、すべて0にする
  },
  selectedDigit: null,

  // マシン状態
  inputNumber: '41684',
  digits: [],
  speed: 'normal',
  isRunning: false,
  stepMode: false,
  stepIndex: 0,
  stepResolve: null,

  // クイズ状態
  quizIndex: 0,
  quizList: [
    {
      q: '58294 を 上から2けたのがい数に すると、いくつになるかな？',
      options: ['58000', '59000', '60000'],
      correct: 0,
      exp: '上から3けた目の「2」を見るよ。2は5以上ではない（切り捨て）だから、上から2けたはそのままで【58000】になるね！'
    },
    {
      q: '73620 を 上から2けたのがい数に すると、いくつになるかな？',
      options: ['73000', '74000', '80000'],
      correct: 1,
      exp: '上から3けた目の「6」を見るよ。6は5以上（切り上げ）！上から2けた目の「3」を1つ大きくして【74000】だね！'
    },
    {
      q: '29815 を 上から2けたのがい数に すると、いくつになるかな？（くり上がり注意！）',
      options: ['29000', '30000', '39000'],
      correct: 1,
      exp: '上から3けた目の「8」は5以上！2けた目が「9」なので、1けた目を1つ大きく(3)し、2けた目は0になって【30000】になるよ！'
    }
  ]
};

const SPEED_MAP = {
  slow: 1100,
  normal: 600,
  fast: 300
};

document.addEventListener('DOMContentLoaded', () => {
  loadUnlockState();
  setupTabs();
  setupSoundToggle();
  setupTeacherUnlock();
  initPuzzle();
  initMachine();
  initQuiz();
  confetti.init();
  updateTabUI();
});

// ==========================================
// 状態の保存とアンロック
// ==========================================
function loadUnlockState() {
  try {
    const saved = localStorage.getItem('gaisu_unlocked_steps');
    if (saved) {
      state.unlocked = { ...state.unlocked, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn(e);
  }
}

function saveUnlockState() {
  try {
    localStorage.setItem('gaisu_unlocked_steps', JSON.stringify(state.unlocked));
  } catch (e) {
    console.warn(e);
  }
}

function updateTabUI() {
  const btnMachine = document.getElementById('tab-btn-machine');
  const btnQuiz = document.getElementById('tab-btn-quiz');
  const teacherIcon = document.getElementById('teacher-btn-icon');
  const teacherBtn = document.getElementById('btn-teacher-toggle');

  if (state.unlocked.machine) {
    btnMachine.classList.remove('locked');
    const lock = btnMachine.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'none';
  } else {
    btnMachine.classList.add('locked');
    const lock = btnMachine.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'inline';
  }

  if (state.unlocked.quiz) {
    btnQuiz.classList.remove('locked');
    const lock = btnQuiz.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'none';
  } else {
    btnQuiz.classList.add('locked');
    const lock = btnQuiz.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'inline';
  }

  const isAll = state.unlocked.machine && state.unlocked.quiz;
  if (teacherIcon && teacherBtn) {
    teacherIcon.textContent = isAll ? '🔒' : '🔓';
    teacherBtn.title = isAll ? 'せんせい用：ふたたびロックする' : 'せんせい用：合言葉でぜんぶひらく';
  }
}

// ==========================================
// タブ切り替え
// ==========================================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      const tabId = btn.getAttribute('data-tab');
      if (tabId === 'machine' && !state.unlocked.machine) {
        showModal('🔒 まだうごかせないよ', 'まずは ①アルゴリズムパズル の□をうめて、こたえあわせをしよう！');
        return;
      }
      if (tabId === 'quiz' && !state.unlocked.quiz) {
        showModal('🔒 まだひらけないよ', 'まずは ①アルゴリズムパズル をクリアしてね！');
        return;
      }
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const activeContent = document.getElementById(`tab-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');
  if (activeContent) activeContent.classList.add('active');

  if (tabId === 'machine') {
    renderMachineFlowchart();
    prepareDigitsDisplay();
  }
}

// ==========================================
// 音声トグル & 先生用アンロック
// ==========================================
function setupSoundToggle() {
  const btn = document.getElementById('btn-sound-toggle');
  const icon = document.getElementById('sound-icon');
  btn.addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    icon.textContent = sound.enabled ? '🔊' : '🔇';
    if (sound.enabled) sound.playClick();
  });
}

// ==========================================
// 先生用パスワード認証（合言葉「sensei」）＆ 再ロック切り替え
// ==========================================
function setupTeacherUnlock() {
  const toggleBtn = document.getElementById('btn-teacher-toggle');
  
  // パスワード入力モーダル
  const pwOverlay = document.getElementById('teacher-modal-overlay');
  const input = document.getElementById('teacher-pw-input');
  const errorMsg = document.getElementById('teacher-pw-error');
  const btnSubmit = document.getElementById('btn-teacher-submit');
  const btnCancel = document.getElementById('btn-teacher-cancel');
  const form = document.getElementById('teacher-form');

  // 再ロックモーダル
  const relockOverlay = document.getElementById('relock-modal-overlay');
  const btnRelockCancel = document.getElementById('btn-relock-cancel');
  const btnRelockConfirm = document.getElementById('btn-relock-confirm');

  toggleBtn.addEventListener('click', () => {
    sound.playClick();
    const isAllUnlocked = state.unlocked.machine && state.unlocked.quiz;
    if (isAllUnlocked) {
      relockOverlay.classList.add('open');
    } else {
      input.value = '';
      errorMsg.style.display = 'none';
      pwOverlay.classList.add('open');
      setTimeout(() => input.focus(), 150);
    }
  });

  // パスワード送信処理
  function doUnlock() {
    const entered = input.value.trim().toLowerCase();
    if (entered === 'sensei') {
      sound.playCorrect();
      state.unlocked.machine = true;
      state.unlocked.quiz = true;
      saveUnlockState();
      updateTabUI();
      pwOverlay.classList.remove('open');
      showModal('🔓 合言葉せいかい！', 'すべてのタブを開放しました。授業に合わせてご活用ください！', '✨');
    } else {
      sound.playWrong();
      errorMsg.style.display = 'block';
      input.select();
    }
  }

  btnSubmit.addEventListener('click', doUnlock);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    doUnlock();
  });

  btnCancel.addEventListener('click', () => {
    sound.playClick();
    pwOverlay.classList.remove('open');
  });

  // 再ロック処理
  btnRelockConfirm.addEventListener('click', () => {
    sound.playClick();
    state.unlocked.machine = false;
    state.unlocked.quiz = false;
    saveUnlockState();
    updateTabUI();
    relockOverlay.classList.remove('open');
    switchTab('puzzle');
    showModal('🔒 ロックしました', '初期状態（①パズルのみ）にもどしました。', '🔒');
  });

  btnRelockCancel.addEventListener('click', () => {
    sound.playClick();
    relockOverlay.classList.remove('open');
  });
}

function showModal(title, body, icon = '💡') {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  document.getElementById('modal-icon').textContent = icon;
  overlay.classList.add('open');

  document.getElementById('btn-modal-close').onclick = () => {
    sound.playClick();
    overlay.classList.remove('open');
  };
}

// ==========================================
// タブ①：アルゴリズムパズル
// ==========================================
function initPuzzle() {
  renderDigitButtons();
  setupHintExamples();
  renderPuzzleSVG();

  document.getElementById('btn-check-puzzle').addEventListener('click', checkPuzzleAnswer);
  document.getElementById('btn-reset-puzzle').addEventListener('click', resetPuzzle);
}

function renderDigitButtons() {
  const grid = document.getElementById('digits-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= 9; i++) {
    const btn = document.createElement('button');
    btn.className = `digit-btn ${state.selectedDigit === i ? 'selected' : ''}`;
    btn.textContent = i;
    btn.addEventListener('click', () => {
      sound.playClick();
      state.selectedDigit = (state.selectedDigit === i) ? null : i;
      renderDigitButtons();
      highlightSlotBoxes();
    });
    grid.appendChild(btn);
  }
}

function highlightSlotBoxes() {
  document.querySelectorAll('.node-slot-box').forEach(box => {
    if (state.selectedDigit !== null) {
      box.classList.add('active-target');
    } else {
      box.classList.remove('active-target');
    }
  });
}

function setupHintExamples() {
  const chips = document.querySelectorAll('.example-chip');
  const tip = document.getElementById('example-tip');

  const tips = {
    '47477': '🐿️ <strong>47477 のとき</strong><br>・上から2けたは「47」<br>・上から<strong>3</strong>けた目の「4」を見る<br>・4は <strong>5</strong>以上ではないので切り捨て！<br>➔ <strong>47000</strong> になるよ！',
    '41684': '🐿️ <strong>41684 のとき</strong><br>・上から2けたは「41」<br>・上から<strong>3</strong>けた目の「6」を見る<br>・6は <strong>5</strong>以上！2けた目は<strong>9</strong>ではないので、1つ大きくして「42」！<br>➔ <strong>42000</strong> になるよ！',
    '39972': '🐿️ <strong>39972 のとき</strong><br>・上から2けたは「39」<br>・上から<strong>3</strong>けた目の「9」は <strong>5</strong>以上！<br>・上から2けた目が <strong>9</strong> なので、1けた目を1つ大きく(4)し、2けた目は0にくり上がり！<br>➔ <strong>40000</strong> になるよ！'
  };

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      sound.playClick();
      const num = chip.getAttribute('data-ex');
      tip.innerHTML = tips[num] || '';
    });
  });
}

function renderPuzzleSVG() {
  const svg = document.getElementById('puzzle-svg');
  // 教科書画像2と完全に一致するレイアウト
  svg.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#57606f"/>
      </marker>
    </defs>

    <!-- [スタート] -->
    <rect x="170" y="20" width="180" height="40" class="node-start-end"/>
    <text x="260" y="40" class="node-text">スタート</text>

    <line x1="260" y1="60" x2="260" y2="85" class="flow-line" marker-end="url(#arrow)"/>

    <!-- [上から □ けた目の数字を見る] -->
    <g class="process-group" transform="translate(70, 85)">
      <rect width="380" height="42" class="node-process"/>
      <text x="100" y="22" class="node-text">上から</text>
      <!-- スロット1: pos1 -->
      <g class="slot-box-group" data-slot="pos1" transform="translate(130, 7)">
        <rect width="28" height="28" class="node-slot-box" id="slot-box-pos1"/>
        <text x="14" y="15" class="slot-digit-text" id="slot-text-pos1">□</text>
      </g>
      <text x="245" y="22" class="node-text">けた目の数字を 見る</text>
    </g>

    <line x1="260" y1="127" x2="260" y2="155" class="flow-line" marker-end="url(#arrow)"/>

    <!-- < □ 以上の数か > （ひし形：判断） -->
    <g transform="translate(260, 185)">
      <polygon points="0,-30 120,0 0,30 -120,0" class="node-decision"/>
      <!-- スロット2: cond1 -->
      <g class="slot-box-group" data-slot="cond1" transform="translate(-48, -14)">
        <rect width="28" height="28" class="node-slot-box" id="slot-box-cond1"/>
        <text x="14" y="15" class="slot-digit-text" id="slot-text-cond1">□</text>
      </g>
      <text x="26" y="1" class="node-text">以上の数か</text>
    </g>

    <!-- 分岐：いいえ（左） / はい（右） -->
    <!-- いいえ（左ルート：そのまま下へ） -->
    <path d="M 140 185 L 30 185 L 30 456 L 80 456" class="flow-line" marker-end="url(#arrow)"/>
    <text x="85" y="176" class="node-label-small">いいえ</text>

    <!-- はい（右ルート） -->
    <line x1="380" y1="185" x2="480" y2="185" class="flow-line"/>
    <text x="425" y="176" class="node-label-small">はい</text>
    <line x1="480" y1="185" x2="480" y2="235" class="flow-line" marker-end="url(#arrow)"/>

    <!-- < 上から2けた目の数字は □ か > （ひし形：判断） -->
    <g transform="translate(480, 265)">
      <polygon points="0,-30 130,0 0,30 -130,0" class="node-decision"/>
      <text x="-36" y="1" class="node-text" font-size="11.5">上から2けた目の数字は</text>
      <!-- スロット3: cond2 -->
      <g class="slot-box-group" data-slot="cond2" transform="translate(45, -14)">
        <rect width="28" height="28" class="node-slot-box" id="slot-box-cond2"/>
        <text x="14" y="15" class="slot-digit-text" id="slot-text-cond2">□</text>
      </g>
      <text x="88" y="1" class="node-text" font-size="11.5">か</text>
    </g>

    <!-- 分岐：いいえ（下左） / はい（右下） -->
    <!-- いいえ（左下） -->
    <path d="M 410 295 L 410 330" class="flow-line" marker-end="url(#arrow)"/>
    <text x="385" y="315" class="node-label-small">いいえ</text>
    <g transform="translate(245, 330)">
      <rect width="195" height="52" class="node-process"/>
      <text x="97" y="20" class="node-text" font-size="11.5">上から2けた目の数を</text>
      <text x="97" y="38" class="node-text" font-size="11.5">1つ大きくする</text>
    </g>

    <!-- はい（右下） -->
    <path d="M 550 295 L 550 330" class="flow-line" marker-end="url(#arrow)"/>
    <text x="565" y="315" class="node-label-small">はい</text>
    <g transform="translate(460, 330)">
      <rect width="245" height="52" class="node-process"/>
      <text x="122" y="20" class="node-text" font-size="11">上から1けた目の数字を 1つ大きくし、</text>
      <text x="122" y="38" class="node-text" font-size="11">上から2けた目を 0にする</text>
    </g>

    <!-- 合流線（2つのルート合流） -->
    <path d="M 342 382 L 342 410 L 270 410 L 270 435" class="flow-line" marker-end="url(#arrow)"/>
    <path d="M 582 382 L 582 410 L 270 410" class="flow-line"/>

    <!-- [上から □ けた目以降の数字を、すべて 0にする] -->
    <g class="process-group" transform="translate(80, 435)">
      <rect width="450" height="42" class="node-process"/>
      <text x="100" y="22" class="node-text">上から</text>
      <!-- スロット4: pos2 -->
      <g class="slot-box-group" data-slot="pos2" transform="translate(130, 7)">
        <rect width="28" height="28" class="node-slot-box" id="slot-box-pos2"/>
        <text x="14" y="15" class="slot-digit-text" id="slot-text-pos2">□</text>
      </g>
      <text x="295" y="22" class="node-text">けた目以降の数字を、すべて 0にする</text>
    </g>

    <line x1="305" y1="477" x2="305" y2="505" class="flow-line" marker-end="url(#arrow)"/>

    <!-- [おわり] -->
    <rect x="215" y="505" width="180" height="38" class="node-start-end"/>
    <text x="305" y="524" class="node-text">おわり</text>
  `;

  // スロットクリックイベント
  document.querySelectorAll('.slot-box-group').forEach(group => {
    group.addEventListener('click', () => {
      const slotKey = group.getAttribute('data-slot');
      onSlotClick(slotKey);
    });
  });

  updateSlotDisplay();
}

function onSlotClick(slotKey) {
  sound.playClick();
  if (state.selectedDigit !== null) {
    state.slots[slotKey] = state.selectedDigit;
    state.selectedDigit = null;
  } else {
    // 選択なしでタップ時はクリア
    if (state.slots[slotKey] !== null) {
      state.slots[slotKey] = null;
    }
  }

  renderDigitButtons();
  updateSlotDisplay();
  highlightSlotBoxes();
}

function updateSlotDisplay() {
  for (const slotKey in state.slots) {
    const val = state.slots[slotKey];
    const box = document.getElementById(`slot-box-${slotKey}`);
    const text = document.getElementById(`slot-text-${slotKey}`);
    if (!box || !text) continue;

    if (val !== null) {
      box.classList.add('filled');
      box.classList.remove('slot-error');
      text.textContent = val;
    } else {
      box.classList.remove('filled', 'slot-error', 'slot-correct');
      text.textContent = '□';
    }
  }
}

function checkPuzzleAnswer() {
  const correctAnswers = {
    pos1: 3,  // 上から3けた目を見る
    cond1: 5, // 5以上か
    cond2: 9, // 上から2けた目は9か
    pos2: 3   // 上から3けた目以降をすべて0にする
  };

  let allFilled = true;
  let allCorrect = true;

  for (const k in correctAnswers) {
    const box = document.getElementById(`slot-box-${k}`);
    const val = state.slots[k];

    if (val === null) {
      allFilled = false;
    } else if (val === correctAnswers[k]) {
      if (box) {
        box.classList.remove('slot-error');
        box.classList.add('slot-correct');
      }
    } else {
      allCorrect = false;
      if (box) {
        box.classList.add('slot-error');
      }
    }
  }

  if (!allFilled) {
    sound.playWrong();
    showModal('あともうすこし！', 'まだ「□」のままの場所があるよ。1〜9の数字を入れてね！', '✏️');
    return;
  }

  if (allCorrect) {
    sound.playFanfare();
    confetti.start(4000);
    state.unlocked.machine = true;
    state.unlocked.quiz = true;
    saveUnlockState();
    updateTabUI();

    showModal(
      '🎉 だいせいかい！',
      'アルゴリズムが かんせいしたよ！\n【3】【5】【9】【3】ですべて正解！\n②がい数マシンを動かす のロックが解除されたよ。じっさいに計算させてみよう！',
      '🌟'
    );
  } else {
    sound.playWrong();
    showModal(
      'おしい！',
      'あかい枠の数字を もういちど見なおしてみてね！\nリスさんのヒントを読むと ひらめくかも！？',
      '🤔'
    );
  }
}

function resetPuzzle() {
  sound.playClick();
  for (const k in state.slots) {
    state.slots[k] = null;
  }
  state.selectedDigit = null;
  renderDigitButtons();
  updateSlotDisplay();
}

// ==========================================
// タブ②：がい数マシン（動くアルゴリズム＆計算機）
// ==========================================
function initMachine() {
  setupMachineControls();
  renderMachineFlowchart();
  prepareDigitsDisplay();
}

function setupMachineControls() {
  const input = document.getElementById('input-number');
  const btnRun = document.getElementById('btn-run-algo');
  const btnStep = document.getElementById('btn-step-algo');
  const btnReset = document.getElementById('btn-reset-algo');
  const btnRandom = document.getElementById('btn-random-num');
  const speedSelect = document.getElementById('speed-select');
  const presetChips = document.querySelectorAll('.preset-chip[data-num]');

  input.addEventListener('change', () => {
    state.inputNumber = input.value;
    prepareDigitsDisplay();
  });

  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      sound.playClick();
      input.value = chip.getAttribute('data-num');
      state.inputNumber = input.value;
      prepareDigitsDisplay();
    });
  });

  btnRandom.addEventListener('click', () => {
    sound.playClick();
    const rand = Math.floor(Math.random() * 90000) + 10000; // 5桁
    input.value = `${rand}`;
    state.inputNumber = `${rand}`;
    prepareDigitsDisplay();
  });

  speedSelect.addEventListener('change', (e) => {
    state.speed = e.target.value;
  });

  btnRun.addEventListener('click', () => {
    if (state.isRunning) return;
    runAlgorithm(false);
  });

  btnStep.addEventListener('click', () => {
    if (state.isRunning && state.stepMode) {
      if (state.stepResolve) {
        state.stepResolve();
        state.stepResolve = null;
      }
    } else if (!state.isRunning) {
      runAlgorithm(true);
    }
  });

  btnReset.addEventListener('click', () => {
    sound.playClick();
    resetMachine();
  });
}

function resetMachine() {
  state.isRunning = false;
  state.stepMode = false;
  clearMachineHighlights();
  document.getElementById('machine-result').style.display = 'none';
  document.getElementById('algo-status-msg').textContent = '「けいさんスタート！」ボタンをおしてね！';
  prepareDigitsDisplay();
}

function prepareDigitsDisplay() {
  const numStr = `${state.inputNumber}`.trim();
  state.digits = numStr.split('').map(d => parseInt(d, 10));

  const row = document.getElementById('digits-row');
  row.innerHTML = '';

  state.digits.forEach((d, idx) => {
    const box = document.createElement('div');
    box.className = 'digit-box';
    box.id = `digit-box-${idx}`;
    box.innerHTML = `
      <span class="digit-box-pos">上から${idx + 1}けた</span>
      <span class="digit-box-val" id="digit-val-${idx}">${d}</span>
    `;
    row.appendChild(box);
  });
}

function renderMachineFlowchart() {
  const svg = document.getElementById('machine-svg');
  // 正解の数字（3, 5, 9, 3）が入った動的トレース用フローチャート
  svg.innerHTML = `
    <defs>
      <marker id="m-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#57606f"/>
      </marker>
    </defs>

    <!-- [スタート] -->
    <rect id="mnode-start" x="170" y="20" width="180" height="40" class="node-start-end"/>
    <text x="260" y="40" class="node-text">スタート</text>

    <line x1="260" y1="60" x2="260" y2="85" class="flow-line" marker-end="url(#m-arrow)"/>

    <!-- [上から 3 けた目の数字を見る] -->
    <rect id="mnode-step1" x="70" y="85" width="380" height="42" class="node-process"/>
    <text x="260" y="106" class="node-text">上から <tspan fill="#d35400" font-size="16">3</tspan> けた目の数字を 見る</text>

    <line x1="260" y1="127" x2="260" y2="155" class="flow-line" marker-end="url(#m-arrow)"/>

    <!-- < 5 以上の数か > -->
    <polygon id="mnode-step2" points="260,155 380,185 260,215 140,185" class="node-decision"/>
    <text x="260" y="186" class="node-text"><tspan fill="#d35400" font-size="16">5</tspan> 以上の数か</text>

    <!-- いいえ（左） -->
    <path id="mnode-line-no" d="M 140 185 L 30 185 L 30 456 L 80 456" class="flow-line" marker-end="url(#m-arrow)"/>
    <text x="85" y="176" class="node-label-small">いいえ</text>

    <!-- はい（右） -->
    <line x1="380" y1="185" x2="480" y2="185" class="flow-line"/>
    <text x="425" y="176" class="node-label-small">はい</text>
    <line x1="480" y1="185" x2="480" y2="235" class="flow-line" marker-end="url(#m-arrow)"/>

    <!-- < 上から2けた目の数字は 9 か > -->
    <polygon id="mnode-step3" points="480,235 610,265 480,295 350,265" class="node-decision"/>
    <text x="480" y="266" class="node-text" font-size="12">上から2けた目の数字は <tspan fill="#d35400" font-size="14">9</tspan> か</text>

    <!-- いいえ（左下） -->
    <path d="M 410 295 L 410 330" class="flow-line" marker-end="url(#m-arrow)"/>
    <text x="385" y="315" class="node-label-small">いいえ</text>
    <g id="mnode-step-add1" transform="translate(245, 330)">
      <rect width="195" height="52" class="node-process"/>
      <text x="97" y="20" class="node-text" font-size="11.5">上から2けた目の数を</text>
      <text x="97" y="38" class="node-text" font-size="11.5">1つ大きくする</text>
    </g>

    <!-- はい（右下） -->
    <path d="M 550 295 L 550 330" class="flow-line" marker-end="url(#m-arrow)"/>
    <text x="565" y="315" class="node-label-small">はい</text>
    <g id="mnode-step-carry" transform="translate(460, 330)">
      <rect width="245" height="52" class="node-process"/>
      <text x="122" y="20" class="node-text" font-size="11">上から1けた目の数字を 1つ大きくし、</text>
      <text x="122" y="38" class="node-text" font-size="11">上から2けた目を 0にする</text>
    </g>

    <!-- 合流線 -->
    <path d="M 342 382 L 342 410 L 270 410 L 270 435" class="flow-line" marker-end="url(#m-arrow)"/>
    <path d="M 582 382 L 582 410 L 270 410" class="flow-line"/>

    <!-- [上から 3 けた目以降の数字を、すべて 0にする] -->
    <rect id="mnode-step-zero" x="80" y="435" width="450" height="42" class="node-process"/>
    <text x="305" y="456" class="node-text">上から <tspan fill="#d35400" font-size="16">3</tspan> けた目以降の数字を、すべて 0にする</text>

    <line x1="305" y1="477" x2="305" y2="505" class="flow-line" marker-end="url(#m-arrow)"/>

    <rect id="mnode-end" x="215" y="505" width="180" height="38" class="node-start-end"/>
    <text x="305" y="524" class="node-text">おわり</text>
  `;
}

function highlightMachineNode(nodeId) {
  clearMachineHighlights();
  const target = document.getElementById(nodeId);
  if (target) {
    target.classList.add('node-highlight');
    sound.playNode();
  }
}

function clearMachineHighlights() {
  document.querySelectorAll('#machine-svg .node-highlight').forEach(el => el.classList.remove('node-highlight'));
}

async function waitStepOrDelay() {
  if (state.stepMode) {
    return new Promise(res => {
      state.stepResolve = res;
    });
  } else {
    const ms = SPEED_MAP[state.speed] || 600;
    return new Promise(res => setTimeout(res, ms));
  }
}

// アルゴリズム実行ループ
async function runAlgorithm(isStep) {
  state.isRunning = true;
  state.stepMode = isStep;
  document.getElementById('machine-result').style.display = 'none';

  const numStr = `${state.inputNumber}`.trim();
  if (numStr.length < 3) {
    showModal('注意', '3けた以上の数字を入力してね！', '⚠️');
    state.isRunning = false;
    return;
  }

  prepareDigitsDisplay();
  const digitsWorking = [...state.digits];

  // 1. スタート
  highlightMachineNode('mnode-start');
  document.getElementById('algo-status-msg').textContent = '① スタート！計算をはじめます。';
  await waitStepOrDelay();

  // 2. 上から3けた目の数字を見る
  highlightMachineNode('mnode-step1');
  const d3 = digitsWorking[2]; // 3けた目（インデックス2）
  const box3 = document.getElementById('digit-box-2');
  if (box3) box3.classList.add('target-digit');
  document.getElementById('algo-status-msg').textContent = `② 上から3けた目の数字は【 ${d3} 】です！`;
  sound.playStep();
  await waitStepOrDelay();

  // 3. 5以上の数か？
  highlightMachineNode('mnode-step2');
  const is5orMore = (d3 >= 5);
  document.getElementById('algo-status-msg').textContent = `③ 3けた目の「${d3}」は 5以上？ ➔ 【 ${is5orMore ? 'はい（四捨五入の切り上げ）' : 'いいえ（四捨五入の切り捨て）'} 】`;
  sound.playClick();
  await waitStepOrDelay();

  if (is5orMore) {
    // はいルート ➔ 上から2けた目は9か？
    highlightMachineNode('mnode-step3');
    const d2 = digitsWorking[1]; // 2けた目
    const box2 = document.getElementById('digit-box-1');
    if (box2) box2.classList.add('target-digit');
    const is9 = (d2 === 9);
    document.getElementById('algo-status-msg').textContent = `④ 上から2けた目の数字は「${d2}」。9ですか？ ➔ 【 ${is9 ? 'はい（繰り上がり！）' : 'いいえ'} 】`;
    sound.playClick();
    await waitStepOrDelay();

    if (!is9) {
      // いいえ ➔ 上から2けた目を1つ大きくする
      highlightMachineNode('mnode-step-add1');
      digitsWorking[1] = d2 + 1;
      const val2 = document.getElementById('digit-val-1');
      if (val2) val2.textContent = digitsWorking[1];
      if (box2) box2.classList.add('modified');
      sound.playCalculate();
      document.getElementById('algo-status-msg').textContent = `⑤ 2けた目の「${d2}」を 1つ大きくして【 ${digitsWorking[1]} 】にしました！`;
      await waitStepOrDelay();
    } else {
      // はい ➔ 1けた目を+1し、2けた目を0にする（繰り上がり）
      highlightMachineNode('mnode-step-carry');
      digitsWorking[0] = digitsWorking[0] + 1;
      digitsWorking[1] = 0;
      const box1 = document.getElementById('digit-box-0');
      const val1 = document.getElementById('digit-val-0');
      const val2 = document.getElementById('digit-val-1');
      if (val1) val1.textContent = digitsWorking[0];
      if (val2) val2.textContent = digitsWorking[1];
      if (box1) box1.classList.add('modified');
      if (box2) box2.classList.add('modified');
      sound.playCalculate();
      document.getElementById('algo-status-msg').textContent = `⑤ くり上がり！1けた目を【 ${digitsWorking[0]} 】にして、2けた目を【 0 】にしました！`;
      await waitStepOrDelay();
    }
  } else {
    // いいえルート ➔ そのまま合流
    document.getElementById('algo-status-msg').textContent = `④ 5未満なので、上から2けた目はそのまま（切り捨て）です！`;
    await waitStepOrDelay();
  }

  // 4. 上から3けた目以降をすべて0にする
  highlightMachineNode('mnode-step-zero');
  for (let i = 2; i < digitsWorking.length; i++) {
    digitsWorking[i] = 0;
    const val = document.getElementById(`digit-val-${i}`);
    const b = document.getElementById(`digit-box-${i}`);
    if (val) val.textContent = '0';
    if (b) {
      b.classList.remove('target-digit');
      b.classList.add('zeroed');
    }
  }
  sound.playStep();
  document.getElementById('algo-status-msg').textContent = '⑥ 上から3けた目以降の数字を、すべて「0」にしました！';
  await waitStepOrDelay();

  // 5. おわり
  highlightMachineNode('mnode-end');
  const finalNum = digitsWorking.join('');
  document.getElementById('algo-status-msg').textContent = `🎉 アルゴリズム完了！がい数は【 ${finalNum} 】です！`;
  sound.playFanfare();

  // 結果表示
  const resultArea = document.getElementById('machine-result');
  const resultText = document.getElementById('result-text');
  resultArea.style.display = 'flex';
  resultText.textContent = `上から2けたのがい数：${finalNum}`;

  state.isRunning = false;
  state.stepMode = false;
}

// ==========================================
// タブ③：クイズ＆かいぞう
// ==========================================
function initQuiz() {
  renderQuiz();
  document.getElementById('btn-next-quiz').addEventListener('click', () => {
    sound.playClick();
    state.quizIndex = (state.quizIndex + 1) % state.quizList.length;
    renderQuiz();
  });
}

function renderQuiz() {
  const qData = state.quizList[state.quizIndex];
  document.getElementById('quiz-question').textContent = `もんだい（${state.quizIndex + 1}/${state.quizList.length}）：${qData.q}`;
  const feedback = document.getElementById('quiz-feedback');
  feedback.style.display = 'none';

  const container = document.getElementById('quiz-options');
  container.innerHTML = '';

  qData.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-btn';
    btn.textContent = opt;

    btn.addEventListener('click', () => {
      if (idx === qData.correct) {
        sound.playCorrect();
        confetti.start(2500);
        feedback.className = 'quiz-feedback correct';
        feedback.innerHTML = `⭕ <strong>せいかい！</strong><br>${qData.exp}`;
      } else {
        sound.playWrong();
        feedback.className = 'quiz-feedback wrong';
        feedback.innerHTML = `❌ <strong>おしい！</strong><br>${qData.exp}`;
      }
      feedback.style.display = 'block';
    });

    container.appendChild(btn);
  });
}
