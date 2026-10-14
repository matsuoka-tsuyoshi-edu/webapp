// ==========================================
// すごろくアプリ (sugoroku/app.js)
// ==========================================

const state = {
  unlocked: {
    puzzle: true,
    game: false,
    custom: false
  },
  // フローチャートのピース定義
  pieces: [
    { id: 'p_dice', text: 'さいころを ふる', correctSlot: 'slot_a' },
    { id: 'p_which_eye', text: 'さいころの目が 何か', correctSlot: 'slot_i' },
    { id: 'p_step_1', text: '1歩進む', correctSlot: 'slot_u' },
    { id: 'p_step_2', text: '2歩進む', correctSlot: 'slot_e' },
    { id: 'p_step_3', text: '3歩進む', correctSlot: 'slot_o' },
    { id: 'p_step_4', text: '4歩進む', correctSlot: 'slot_ka' },
    { id: 'p_step_5', text: '5歩進む', correctSlot: 'slot_ki' },
    { id: 'p_step_6', text: '6歩進む', correctSlot: 'slot_ku' },
    { id: 'p_has_instr', text: 'マスに指示があるか どうか', correctSlot: 'slot_ke' },
    { id: 'p_do_instr', text: 'マスの指示に したがう', correctSlot: 'slot_ko' }
  ],
  // スロットの状態
  slots: {
    slot_a: null,  // ア
    slot_i: null,  // イ
    slot_u: null,  // ウ
    slot_e: null,  // エ
    slot_o: null,  // オ
    slot_ka: null, // カ
    slot_ki: null, // キ
    slot_ku: null, // ク
    slot_ke: null, // ケ
    slot_ko: null  // コ
  },
  selectedPieceId: null,

  // ゲーム状態
  playMode: 'solo', // 'solo' or 'vs-cpu'
  turn: 'player',   // 'player' or 'cpu'
  playerPos: 0,
  cpuPos: 0,
  playerRest: 0,
  cpuRest: 0,
  isRolling: false,
  speed: 'normal',

  // ルール設定
  rules: {
    cellInstructions: {
      2: { type: 'step', val: 3, label: '3進む' },
      10: { type: 'step', val: 2, label: '2進む' },
      14: { type: 'rest', val: 1, label: '1回休み' },
      20: { type: 'back', val: 3, label: '3もどる' },
      24: { type: 'step', val: 4, label: '4進む' },
      25: { type: 'rest', val: 1, label: '1回休み' },
      28: { type: 'back', val: 4, label: '4もどる' }
    },
    diceType: '1-6'
  }
};

const SPEED_MAP = {
  slow: 900,
  normal: 500,
  fast: 250
};

// スロット名と日本語の対応
const SLOT_NAMES = {
  slot_a: 'ア',
  slot_i: 'イ',
  slot_u: 'ウ',
  slot_e: 'エ',
  slot_o: 'オ',
  slot_ka: 'カ',
  slot_ki: 'キ',
  slot_ku: 'ク',
  slot_ke: 'ケ',
  slot_ko: 'コ'
};

document.addEventListener('DOMContentLoaded', () => {
  loadUnlockState();
  setupTabs();
  setupSoundToggle();
  setupTeacherUnlock();
  initPuzzle();
  initGameBoard();
  initCustomRules();
  confetti.init();
  updateTabUI();
});

// ==========================================
// 状態の保存とアンロック
// ==========================================
function loadUnlockState() {
  try {
    const saved = localStorage.getItem('sugoroku_unlocked_steps');
    if (saved) {
      state.unlocked = { ...state.unlocked, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn(e);
  }
}

function saveUnlockState() {
  try {
    localStorage.setItem('sugoroku_unlocked_steps', JSON.stringify(state.unlocked));
  } catch (e) {
    console.warn(e);
  }
}

function updateTabUI() {
  const btnGame = document.getElementById('tab-btn-game');
  const btnCustom = document.getElementById('tab-btn-custom');
  const teacherIcon = document.getElementById('teacher-btn-icon');
  const teacherBtn = document.getElementById('btn-teacher-toggle');

  if (state.unlocked.game) {
    btnGame.classList.remove('locked');
    const lock = btnGame.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'none';
  } else {
    btnGame.classList.add('locked');
    const lock = btnGame.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'inline';
  }

  if (state.unlocked.custom) {
    btnCustom.classList.remove('locked');
    const lock = btnCustom.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'none';
  } else {
    btnCustom.classList.add('locked');
    const lock = btnCustom.querySelector('.tab-lock-icon');
    if (lock) lock.style.display = 'inline';
  }

  const isAll = state.unlocked.game && state.unlocked.custom;
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
      if (tabId === 'game' && !state.unlocked.game) {
        showModal('🔒 まだあそべないよ', 'まずは ①フローチャート のパズルをといて、こたえあわせをしよう！');
        return;
      }
      if (tabId === 'custom' && !state.unlocked.custom) {
        showModal('🔒 まだひらけないよ', 'まずは ①フローチャート をクリアしてね！');
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

  if (tabId === 'game') {
    renderGameFlowchart();
  }
}

// ==========================================
// 音声トグル
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

  // ヘッダーボタンクリック時
  toggleBtn.addEventListener('click', () => {
    sound.playClick();
    const isAllUnlocked = state.unlocked.game && state.unlocked.custom;
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
      state.unlocked.game = true;
      state.unlocked.custom = true;
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
    state.unlocked.game = false;
    state.unlocked.custom = false;
    saveUnlockState();
    updateTabUI();
    relockOverlay.classList.remove('open');
    switchTab('puzzle');
    showModal('🔒 ロックしました', '初期状態（①フローチャートのみ）にもどしました。', '🔒');
  });

  btnRelockCancel.addEventListener('click', () => {
    sound.playClick();
    relockOverlay.classList.remove('open');
  });
}

// ==========================================
// モーダルダイアログ
// ==========================================
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
// タブ①：パズルモード
// ==========================================
function shufflePieces() {
  state.shuffledPieces = [...state.pieces];
  for (let i = state.shuffledPieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.shuffledPieces[i], state.shuffledPieces[j]] = [state.shuffledPieces[j], state.shuffledPieces[i]];
  }
}

function initPuzzle() {
  shufflePieces();
  renderPieces();
  renderPuzzleSVG();

  document.getElementById('btn-check-puzzle').addEventListener('click', checkPuzzleAnswer);
  document.getElementById('btn-reset-puzzle').addEventListener('click', resetPuzzle);
}

function renderPieces() {
  const container = document.getElementById('pieces-container');
  container.innerHTML = '';

  const list = state.shuffledPieces && state.shuffledPieces.length > 0 ? state.shuffledPieces : state.pieces;
  list.forEach(p => {
    const isUsed = Object.values(state.slots).includes(p.id);
    const item = document.createElement('div');
    item.className = `piece-item ${isUsed ? 'used' : ''} ${state.selectedPieceId === p.id ? 'selected' : ''}`;
    item.setAttribute('data-piece-id', p.id);

    let shapeBadge = '処理';
    if (p.id === 'p_which_eye' || p.id === 'p_has_instr') shapeBadge = '判断';
    if (p.id.startsWith('p_step_')) shapeBadge = '進む';

    item.innerHTML = `
      <span>${p.text}</span>
      <span class="piece-shape-badge">${shapeBadge}</span>
    `;

    item.addEventListener('click', () => {
      sound.playClick();
      if (state.selectedPieceId === p.id) {
        state.selectedPieceId = null;
      } else {
        state.selectedPieceId = p.id;
      }
      renderPieces();
      highlightTargetSlots();
    });

    container.appendChild(item);
  });
}

function highlightTargetSlots() {
  document.querySelectorAll('.node-slot').forEach(slot => {
    if (state.selectedPieceId) {
      slot.classList.add('active-target');
    } else {
      slot.classList.remove('active-target');
    }
  });
}

function renderPuzzleSVG() {
  const svg = document.getElementById('puzzle-svg');
  svg.innerHTML = `
    <!-- 定義：矢印マーカー -->
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#57606f"/>
      </marker>
    </defs>

    <!-- [スタート] -->
    <rect x="250" y="20" width="180" height="40" class="node-start-end"/>
    <text x="340" y="40" class="node-text">スタート</text>

    <!-- 矢印 -->
    <line x1="340" y1="60" x2="340" y2="85" class="flow-line" marker-end="url(#arrow)"/>

    <!-- [くり返し(ゴールするまで)] -->
    <rect x="220" y="85" width="240" height="38" class="node-loop"/>
    <text x="340" y="104" class="node-text" fill="#0984e3">くり返し(ゴールするまで)</text>

    <!-- 矢印 -->
    <line x1="340" y1="123" x2="340" y2="145" class="flow-line" marker-end="url(#arrow)"/>

    <!-- スロット [ ア ] -->
    <g class="slot-group" data-slot="slot_a" transform="translate(230, 145)">
      <rect width="220" height="42" rx="6" class="node-slot" id="svg-slot-a"/>
      <text x="110" y="22" class="node-text" id="slot-text-a">ア</text>
    </g>

    <!-- 矢印 -->
    <line x1="340" y1="187" x2="340" y2="210" class="flow-line" marker-end="url(#arrow)"/>

    <!-- スロット < イ > （ひし形：さいころの目が何か） -->
    <g class="slot-group" data-slot="slot_i" transform="translate(340, 240)">
      <polygon points="0,-28 110,0 0,28 -110,0" class="node-slot" id="svg-slot-i"/>
      <text x="0" y="1" class="node-text" id="slot-text-i">イ</text>
    </g>

    <!-- 分岐線 (1〜6) -->
    <!-- ウ(1) -->
    <path d="M 230 240 L 55 240 L 55 295" class="flow-line" marker-end="url(#arrow)"/>
    <text x="55" y="232" class="node-label-small" text-anchor="middle">1のとき</text>
    <g class="slot-group" data-slot="slot_u" transform="translate(10, 295)">
      <rect width="90" height="38" rx="6" class="node-slot" id="svg-slot-u"/>
      <text x="45" y="20" class="node-text" id="slot-text-u" font-size="11">ウ</text>
    </g>

    <!-- エ(2) -->
    <path d="M 230 240 L 165 240 L 165 295" class="flow-line" marker-end="url(#arrow)"/>
    <text x="165" y="232" class="node-label-small" text-anchor="middle">2のとき</text>
    <g class="slot-group" data-slot="slot_e" transform="translate(120, 295)">
      <rect width="90" height="38" rx="6" class="node-slot" id="svg-slot-e"/>
      <text x="45" y="20" class="node-text" id="slot-text-e" font-size="11">エ</text>
    </g>

    <!-- オ(3) -->
    <path d="M 290 260 L 275 260 L 275 295" class="flow-line" marker-end="url(#arrow)"/>
    <text x="275" y="252" class="node-label-small" text-anchor="middle">3のとき</text>
    <g class="slot-group" data-slot="slot_o" transform="translate(230, 295)">
      <rect width="90" height="38" rx="6" class="node-slot" id="svg-slot-o"/>
      <text x="45" y="20" class="node-text" id="slot-text-o" font-size="11">オ</text>
    </g>

    <!-- カ(4) -->
    <path d="M 390 260 L 405 260 L 405 295" class="flow-line" marker-end="url(#arrow)"/>
    <text x="405" y="252" class="node-label-small" text-anchor="middle">4のとき</text>
    <g class="slot-group" data-slot="slot_ka" transform="translate(360, 295)">
      <rect width="90" height="38" rx="6" class="node-slot" id="svg-slot-ka"/>
      <text x="45" y="20" class="node-text" id="slot-text-ka" font-size="11">カ</text>
    </g>

    <!-- キ(5) -->
    <path d="M 450 240 L 515 240 L 515 295" class="flow-line" marker-end="url(#arrow)"/>
    <text x="515" y="232" class="node-label-small" text-anchor="middle">5のとき</text>
    <g class="slot-group" data-slot="slot_ki" transform="translate(470, 295)">
      <rect width="90" height="38" rx="6" class="node-slot" id="svg-slot-ki"/>
      <text x="45" y="20" class="node-text" id="slot-text-ki" font-size="11">キ</text>
    </g>

    <!-- ク(6) -->
    <path d="M 450 240 L 625 240 L 625 295" class="flow-line" marker-end="url(#arrow)"/>
    <text x="625" y="232" class="node-label-small" text-anchor="middle">6のとき</text>
    <g class="slot-group" data-slot="slot_ku" transform="translate(580, 295)">
      <rect width="90" height="38" rx="6" class="node-slot" id="svg-slot-ku"/>
      <text x="45" y="20" class="node-text" id="slot-text-ku" font-size="11">ク</text>
    </g>

    <!-- 合流線 -->
    <path d="M 55 333 L 55 355 L 625 355 L 625 333" class="flow-line"/>
    <line x1="165" y1="333" x2="165" y2="355" class="flow-line"/>
    <line x1="275" y1="333" x2="275" y2="355" class="flow-line"/>
    <line x1="405" y1="333" x2="405" y2="355" class="flow-line"/>
    <line x1="515" y1="333" x2="515" y2="355" class="flow-line"/>
    <line x1="340" y1="355" x2="340" y2="378" class="flow-line" marker-end="url(#arrow)"/>

    <!-- スロット < ケ > （ひし形：マスに指示があるかどうか） -->
    <g class="slot-group" data-slot="slot_ke" transform="translate(340, 405)">
      <polygon points="0,-26 120,0 0,26 -120,0" class="node-slot" id="svg-slot-ke"/>
      <text x="0" y="1" class="node-text" id="slot-text-ke">ケ</text>
    </g>

    <!-- 分岐：はい / いいえ -->
    <!-- はい（下へ） -->
    <line x1="340" y1="431" x2="340" y2="455" class="flow-line" marker-end="url(#arrow)"/>
    <text x="352" y="443" class="node-label-small">はい</text>

    <!-- スロット [ コ ]（四角：マスの指示にしたがう） -->
    <g class="slot-group" data-slot="slot_ko" transform="translate(230, 455)">
      <rect width="220" height="40" rx="6" class="node-slot" id="svg-slot-ko"/>
      <text x="110" y="21" class="node-text" id="slot-text-ko">コ</text>
    </g>

    <!-- いいえ（右へ迂回して合流） -->
    <path d="M 460 405 L 535 405 L 535 508 L 345 508" class="flow-line" marker-end="url(#arrow)"/>
    <text x="490" y="396" class="node-label-small">いいえ</text>

    <!-- コからの下向き矢印 -->
    <line x1="340" y1="495" x2="340" y2="520" class="flow-line" marker-end="url(#arrow)"/>

    <!-- [くり返し(ゴールすると 終わり)] -->
    <rect x="220" y="520" width="240" height="38" class="node-loop"/>
    <text x="340" y="539" class="node-text" fill="#0984e3">くり返し(ゴールすると 終わり)</text>

    <!-- 矢印 -->
    <line x1="340" y1="558" x2="340" y2="580" class="flow-line" marker-end="url(#arrow)"/>

    <!-- [ゴール] -->
    <rect x="250" y="580" width="180" height="36" class="node-start-end"/>
    <text x="340" y="598" class="node-text">ゴール</text>
  `;

  // スロットのクリックイベント設定
  document.querySelectorAll('.slot-group').forEach(group => {
    group.addEventListener('click', () => {
      const slotKey = group.getAttribute('data-slot');
      onSlotClick(slotKey);
    });
  });

  updateSlotDisplay();
}

function onSlotClick(slotKey) {
  sound.playClick();

  // すでにピースが選択されている場合、スロットに配置
  if (state.selectedPieceId) {
    // もしそのピースが他のスロットにあったらクリア
    for (const k in state.slots) {
      if (state.slots[k] === state.selectedPieceId) {
        state.slots[k] = null;
      }
    }
    state.slots[slotKey] = state.selectedPieceId;
    state.selectedPieceId = null;
  } else {
    // ピース非選択時：スロットに既に入っていれば取り外す
    if (state.slots[slotKey]) {
      state.slots[slotKey] = null;
    }
  }

  renderPieces();
  updateSlotDisplay();
  highlightTargetSlots();
}

function updateSlotDisplay() {
  for (const slotKey in state.slots) {
    const pieceId = state.slots[slotKey];
    const shortKey = slotKey.replace('slot_', '');
    const svgSlot = document.getElementById(`svg-slot-${shortKey}`);
    const slotText = document.getElementById(`slot-text-${shortKey}`);

    if (!svgSlot || !slotText) continue;

    if (pieceId) {
      const piece = state.pieces.find(p => p.id === pieceId);
      svgSlot.classList.add('filled');
      svgSlot.classList.remove('slot-error');
      
      // 色の適用
      if (slotKey.startsWith('slot_u') || slotKey.startsWith('slot_e') || slotKey.startsWith('slot_o') || 
          slotKey.startsWith('slot_ka') || slotKey.startsWith('slot_ki') || slotKey.startsWith('slot_ku')) {
        svgSlot.style.fill = '#ffccd2'; // 教科書のピンク
        svgSlot.style.stroke = '#ff7675';
      } else if (slotKey === 'slot_i' || slotKey === 'slot_ke') {
        svgSlot.style.fill = '#dff9fb'; // ひし形の薄緑
        svgSlot.style.stroke = '#22a6b3';
      } else {
        svgSlot.style.fill = '#ffeaa7'; // 処理の黄色
        svgSlot.style.stroke = '#fdcb6e';
      }

      slotText.textContent = piece ? piece.text : SLOT_NAMES[slotKey];
    } else {
      svgSlot.classList.remove('filled', 'slot-error', 'slot-correct');
      svgSlot.style.fill = '';
      svgSlot.style.stroke = '';
      slotText.textContent = SLOT_NAMES[slotKey];
    }
  }
}

function checkPuzzleAnswer() {
  let allCorrect = true;
  let filledCount = 0;

  for (const slotKey in state.slots) {
    const pieceId = state.slots[slotKey];
    const shortKey = slotKey.replace('slot_', '');
    const svgSlot = document.getElementById(`svg-slot-${shortKey}`);

    if (pieceId) filledCount++;

    const piece = state.pieces.find(p => p.id === pieceId);
    if (piece && piece.correctSlot === slotKey) {
      if (svgSlot) {
        svgSlot.classList.remove('slot-error');
        svgSlot.classList.add('slot-correct');
      }
    } else {
      allCorrect = false;
      if (svgSlot && pieceId) {
        svgSlot.classList.add('slot-error');
      }
    }
  }

  if (filledCount < Object.keys(state.slots).length) {
    sound.playWrong();
    showModal('あともうすこし！', 'まだ あいているスロットがあるよ。すべてうめてから こたえあわせをしよう！', '✏️');
    return;
  }

  if (allCorrect) {
    sound.playFanfare();
    confetti.start(4000);
    state.unlocked.game = true;
    state.unlocked.custom = true;
    saveUnlockState();
    updateTabUI();

    showModal(
      '🎉 だいせいかい！',
      'フローチャートが かんせいしたよ！\n②すごろくであそぶ のロックが解除されたよ。じっさいに動かしてみよう！',
      '🌟'
    );
  } else {
    sound.playWrong();
    showModal(
      'おしい！',
      'あかい枠のスロットの場所を もういちど見なおしてみてね！',
      '🤔'
    );
  }
}

function resetPuzzle() {
  sound.playClick();
  for (const k in state.slots) {
    state.slots[k] = null;
  }
  state.selectedPieceId = null;
  shufflePieces();
  renderPieces();
  updateSlotDisplay();
}

// ==========================================
// タブ②：ゲームモード＆すごろく盤面
// ==========================================
function initGameBoard() {
  renderBoard();
  setupGameControls();
  renderGameFlowchart();
}

function renderBoard() {
  const grid = document.getElementById('board-grid');
  grid.innerHTML = '';

  // 教科書のコース（全30マス＋スタート＋ゴール）
  // 視覚的に分かりやすいトラック状のグリッドレイアウト
  // 0: スタート
  // 1〜30
  // 31: ゴール
  for (let i = 0; i <= 31; i++) {
    const cell = document.createElement('div');
    cell.id = `cell-${i}`;
    cell.className = 'board-cell';

    if (i === 0) {
      cell.classList.add('cell-start');
      cell.innerHTML = `
        <span class="cell-num">START</span>
        <div class="cell-tokens" id="tokens-${i}"></div>
        <span class="cell-instruction">スタート</span>
      `;
    } else if (i === 31) {
      cell.classList.add('cell-goal');
      cell.innerHTML = `
        <span class="cell-num">GOAL</span>
        <div class="cell-tokens" id="tokens-${i}"></div>
        <span class="cell-instruction">ゴール🏁</span>
      `;
    } else {
      const instr = state.rules.cellInstructions[i];
      let instrHtml = '';
      if (instr) {
        if (instr.type === 'step') cell.classList.add('cell-event-step');
        if (instr.type === 'back') cell.classList.add('cell-event-back');
        if (instr.type === 'rest') cell.classList.add('cell-event-rest');
        instrHtml = `<span class="cell-instruction">${instr.label}</span>`;
      }
      cell.innerHTML = `
        <span class="cell-num">${i}</span>
        <div class="cell-tokens" id="tokens-${i}"></div>
        ${instrHtml}
      `;
    }

    grid.appendChild(cell);

    // 動物デコレーションを間に挿入
    if (i === 4) {
      const deco = document.createElement('div');
      deco.className = 'animal-deco';
      deco.innerHTML = `<span>🐼</span><span>パンダ</span>`;
      grid.appendChild(deco);
    } else if (i === 12) {
      const deco = document.createElement('div');
      deco.className = 'animal-deco';
      deco.innerHTML = `<span>🐘</span><span>ゾウ</span>`;
      grid.appendChild(deco);
    } else if (i === 20) {
      const deco = document.createElement('div');
      deco.className = 'animal-deco';
      deco.innerHTML = `<span>🦁</span><span>ライオン</span>`;
      grid.appendChild(deco);
    }
  }

  updatePlayerTokens();
}

function updatePlayerTokens() {
  // すべてのマスからトークンを消去
  document.querySelectorAll('.cell-tokens').forEach(el => el.innerHTML = '');

  // プレイヤートークン配置
  const pCell = document.getElementById(`tokens-${state.playerPos}`);
  if (pCell) {
    const pToken = document.createElement('span');
    pToken.className = 'player-token';
    pToken.id = 'token-player';
    pToken.textContent = '👦';
    pToken.title = 'あなた';
    pCell.appendChild(pToken);
  }

  // CPU対戦モードならCPUも配置
  if (state.playMode === 'vs-cpu') {
    const cpuCell = document.getElementById(`tokens-${state.cpuPos}`);
    if (cpuCell) {
      const cpuToken = document.createElement('span');
      cpuToken.className = 'player-token';
      cpuToken.id = 'token-cpu';
      cpuToken.textContent = '🤖';
      cpuToken.title = 'コンピュータ';
      cpuCell.appendChild(cpuToken);
    }
  }
}

function renderGameFlowchart() {
  const svg = document.getElementById('game-svg');
  // パズルと同じ構造で、テキストが正解の状態で表示される連動フローチャート
  svg.innerHTML = `
    <defs>
      <marker id="arrow2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#57606f"/>
      </marker>
    </defs>

    <rect id="gnode-start" x="250" y="20" width="180" height="40" class="node-start-end"/>
    <text x="340" y="40" class="node-text">スタート</text>

    <line x1="340" y1="60" x2="340" y2="85" class="flow-line" marker-end="url(#arrow2)"/>

    <rect id="gnode-loop-start" x="220" y="85" width="240" height="38" class="node-loop"/>
    <text x="340" y="104" class="node-text" fill="#0984e3">くり返し(ゴールするまで)</text>

    <line x1="340" y1="123" x2="340" y2="145" class="flow-line" marker-end="url(#arrow2)"/>

    <!-- [さいころを ふる] -->
    <rect id="gnode-dice" x="230" y="145" width="220" height="42" class="node-process"/>
    <text x="340" y="167" class="node-text">さいころを ふる</text>

    <line x1="340" y1="187" x2="340" y2="210" class="flow-line" marker-end="url(#arrow2)"/>

    <!-- <さいころの目が 何か> -->
    <polygon id="gnode-which-eye" points="340,212 450,240 340,268 230,240" class="node-decision"/>
    <text x="340" y="241" class="node-text">さいころの目が 何か</text>

    <!-- ウ(1) -->
    <path d="M 230 240 L 55 240 L 55 295" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="55" y="232" class="node-label-small" text-anchor="middle">1のとき</text>
    <rect id="gnode-step-1" x="10" y="295" width="90" height="38" class="node-process-pink"/>
    <text x="55" y="315" class="node-text" font-size="11">1歩進む</text>

    <!-- エ(2) -->
    <path d="M 230 240 L 165 240 L 165 295" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="165" y="232" class="node-label-small" text-anchor="middle">2のとき</text>
    <rect id="gnode-step-2" x="120" y="295" width="90" height="38" class="node-process-pink"/>
    <text x="165" y="315" class="node-text" font-size="11">2歩進む</text>

    <!-- オ(3) -->
    <path d="M 290 260 L 275 260 L 275 295" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="275" y="252" class="node-label-small" text-anchor="middle">3のとき</text>
    <rect id="gnode-step-3" x="230" y="295" width="90" height="38" class="node-process-pink"/>
    <text x="275" y="315" class="node-text" font-size="11">3歩進む</text>

    <!-- カ(4) -->
    <path d="M 390 260 L 405 260 L 405 295" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="405" y="252" class="node-label-small" text-anchor="middle">4のとき</text>
    <rect id="gnode-step-4" x="360" y="295" width="90" height="38" class="node-process-pink"/>
    <text x="405" y="315" class="node-text" font-size="11">4歩進む</text>

    <!-- キ(5) -->
    <path d="M 450 240 L 515 240 L 515 295" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="515" y="232" class="node-label-small" text-anchor="middle">5のとき</text>
    <rect id="gnode-step-5" x="470" y="295" width="90" height="38" class="node-process-pink"/>
    <text x="515" y="315" class="node-text" font-size="11">5歩進む</text>

    <!-- ク(6) -->
    <path d="M 450 240 L 625 240 L 625 295" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="625" y="232" class="node-label-small" text-anchor="middle">6のとき</text>
    <rect id="gnode-step-6" x="580" y="295" width="90" height="38" class="node-process-pink"/>
    <text x="625" y="315" class="node-text" font-size="11">6歩進む</text>

    <!-- 合流 -->
    <path d="M 55 333 L 55 355 L 625 355 L 625 333" class="flow-line"/>
    <line x1="165" y1="333" x2="165" y2="355" class="flow-line"/>
    <line x1="275" y1="333" x2="275" y2="355" class="flow-line"/>
    <line x1="405" y1="333" x2="405" y2="355" class="flow-line"/>
    <line x1="515" y1="333" x2="515" y2="355" class="flow-line"/>
    <line x1="340" y1="355" x2="340" y2="378" class="flow-line" marker-end="url(#arrow2)"/>

    <!-- <マスに指示があるか どうか> -->
    <polygon id="gnode-has-instr" points="340,379 460,405 340,431 220,405" class="node-decision"/>
    <text x="340" y="406" class="node-text">マスに指示があるか どうか</text>

    <line x1="340" y1="431" x2="340" y2="455" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="352" y="443" class="node-label-small">はい</text>

    <!-- [マスの指示に したがう] -->
    <rect id="gnode-do-instr" x="230" y="455" width="220" height="40" class="node-process"/>
    <text x="340" y="476" class="node-text">マスの指示に したがう</text>

    <path d="M 460 405 L 535 405 L 535 508 L 345 508" class="flow-line" marker-end="url(#arrow2)"/>
    <text x="490" y="396" class="node-label-small">いいえ</text>

    <line x1="340" y1="495" x2="340" y2="520" class="flow-line" marker-end="url(#arrow2)"/>

    <rect id="gnode-loop-end" x="220" y="520" width="240" height="38" class="node-loop"/>
    <text x="340" y="539" class="node-text" fill="#0984e3">くり返し(ゴールすると 終わり)</text>

    <line x1="340" y1="558" x2="340" y2="580" class="flow-line" marker-end="url(#arrow2)"/>

    <rect id="gnode-goal" x="250" y="580" width="180" height="36" class="node-start-end"/>
    <text x="340" y="598" class="node-text">ゴール</text>
  `;
}

function highlightFlowNode(nodeId) {
  document.querySelectorAll('#game-svg .node-highlight').forEach(el => el.classList.remove('node-highlight'));
  const target = document.getElementById(nodeId);
  if (target) {
    target.classList.add('node-highlight');
    sound.playNode();
  }
}

function clearFlowHighlights() {
  document.querySelectorAll('#game-svg .node-highlight').forEach(el => el.classList.remove('node-highlight'));
}

// ==========================================
// ゲームコントロール＆実行ループ
// ==========================================
function setupGameControls() {
  const btnRoll = document.getElementById('btn-roll-dice');
  const btnReset = document.getElementById('btn-reset-game');
  const speedSelect = document.getElementById('speed-select');
  const modeRadios = document.querySelectorAll('input[name="play-mode"]');

  btnRoll.addEventListener('click', () => {
    if (state.isRolling) return;
    runTurn();
  });

  btnReset.addEventListener('click', () => {
    sound.playClick();
    resetGame();
  });

  speedSelect.addEventListener('change', (e) => {
    state.speed = e.target.value;
  });

  modeRadios.forEach(r => {
    r.addEventListener('change', (e) => {
      state.playMode = e.target.value;
      resetGame();
    });
  });
}

function resetGame() {
  state.playerPos = 0;
  state.cpuPos = 0;
  state.playerRest = 0;
  state.cpuRest = 0;
  state.turn = 'player';
  state.isRolling = false;
  clearFlowHighlights();
  updatePlayerTokens();
  document.getElementById('turn-indicator').textContent = '👦 あなたの ばんです！';
  document.getElementById('game-msg').textContent = '「さいころを ふる！」ボタンをおしてね！';
  document.getElementById('dice-display').textContent = '🎲';
}

function getDelay() {
  return SPEED_MAP[state.speed] || 500;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function runTurn() {
  state.isRolling = true;
  const isPlayer = (state.turn === 'player');
  const currentPos = isPlayer ? state.playerPos : state.cpuPos;
  const actorName = isPlayer ? '👦 あなた' : '🤖 コンピュータ';
  const restCount = isPlayer ? state.playerRest : state.cpuRest;

  // 休みチェック
  if (restCount > 0) {
    if (isPlayer) state.playerRest--;
    else state.cpuRest--;
    document.getElementById('game-msg').textContent = `${actorName} は「1回休み」中です…`;
    sound.playBad();
    await sleep(getDelay() * 1.5);
    endTurn();
    return;
  }

  // 1. フローチャート: くり返し(ゴールするまで)
  highlightFlowNode('gnode-loop-start');
  document.getElementById('game-msg').textContent = `${actorName} の番：くり返し(ゴールするまで)`;
  await sleep(getDelay());

  // 2. フローチャート: さいころをふる
  highlightFlowNode('gnode-dice');
  document.getElementById('game-msg').textContent = `${actorName} が さいころを ふっています…`;
  sound.playDiceRoll();

  // サイコロアニメーション
  const diceBox = document.getElementById('dice-display');
  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  for (let i = 0; i < 6; i++) {
    diceBox.textContent = diceEmojis[Math.floor(Math.random() * 6)];
    await sleep(70);
  }

  // 出た目決定
  let eye = 1;
  if (state.rules.diceType === '1-3') {
    eye = Math.floor(Math.random() * 3) + 1;
  } else if (state.rules.diceType === 'special') {
    const evens = [2, 4, 6];
    eye = evens[Math.floor(Math.random() * 3)];
  } else if (state.rules.diceType === 'fast') {
    eye = Math.floor(Math.random() * 3) + 4;
  } else {
    eye = Math.floor(Math.random() * 6) + 1;
  }
  diceBox.textContent = diceEmojis[eye - 1] || `${eye}`;
  document.getElementById('game-msg').textContent = `${actorName} は 【 ${eye} 】の目を 出しました！`;
  await sleep(getDelay());

  // 3. フローチャート: さいころの目が何か
  highlightFlowNode('gnode-which-eye');
  await sleep(getDelay() * 0.8);

  // 4. フローチャート: ○歩進む
  highlightFlowNode(`gnode-step-${eye}`);
  document.getElementById('game-msg').textContent = `${actorName} は ${eye}歩 進みます！`;
  await sleep(getDelay());

  // コマを進める
  let targetPos = Math.min(currentPos + eye, 31);
  for (let p = currentPos + 1; p <= targetPos; p++) {
    if (isPlayer) state.playerPos = p;
    else state.cpuPos = p;
    updatePlayerTokens();
    sound.playStep();
    await sleep(getDelay() * 0.4);
  }

  // ゴールチェック
  if (targetPos >= 31) {
    highlightFlowNode('gnode-goal');
    document.getElementById('game-msg').textContent = `🏁 ${actorName} が ゴールしました！！！おめでとう！`;
    sound.playFanfare();
    confetti.start(5000);
    showModal('🏁 GOAL！！！', `${actorName} が見事ゴールしました！`, '🏆');
    state.isRolling = false;
    return;
  }

  // 5. フローチャート: マスに指示があるかどうか
  highlightFlowNode('gnode-has-instr');
  const currentCell = targetPos;
  const instruction = state.rules.cellInstructions[currentCell];
  await sleep(getDelay());

  if (instruction) {
    // 指示ありルート (はい -> マスの指示にしたがう)
    highlightFlowNode('gnode-do-instr');
    sound.playEvent();
    document.getElementById('game-msg').textContent = `📍 ${currentCell}番マス：「${instruction.label}」！`;
    await sleep(getDelay() * 1.2);

    if (instruction.type === 'step') {
      const bonusTarget = Math.min(currentCell + instruction.val, 31);
      for (let p = currentCell + 1; p <= bonusTarget; p++) {
        if (isPlayer) state.playerPos = p;
        else state.cpuPos = p;
        updatePlayerTokens();
        sound.playStep(1);
        await sleep(getDelay() * 0.4);
      }
      if (bonusTarget >= 31) {
        highlightFlowNode('gnode-goal');
        document.getElementById('game-msg').textContent = `🏁 ${actorName} が ゴールしました！！！おめでとう！`;
        sound.playFanfare();
        confetti.start(5000);
        showModal('🏁 GOAL！！！', `${actorName} が見事ゴールしました！`, '🏆');
        state.isRolling = false;
        return;
      }
    } else if (instruction.type === 'back') {
      sound.playBad();
      const backTarget = Math.max(currentCell - instruction.val, 0);
      for (let p = currentCell - 1; p >= backTarget; p--) {
        if (isPlayer) state.playerPos = p;
        else state.cpuPos = p;
        updatePlayerTokens();
        sound.playStep(-1);
        await sleep(getDelay() * 0.4);
      }
    } else if (instruction.type === 'rest') {
      sound.playBad();
      if (isPlayer) state.playerRest = instruction.val;
      else state.cpuRest = instruction.val;
    }
  } else {
    // 指示なし（いいえルート）
    document.getElementById('game-msg').textContent = `指示はありません。次のターンへ！`;
    await sleep(getDelay() * 0.6);
  }

  // 6. フローチャート: くり返し(ゴールすると終わり)
  highlightFlowNode('gnode-loop-end');
  await sleep(getDelay() * 0.8);
  clearFlowHighlights();

  endTurn();
}

async function endTurn() {
  if (state.playMode === 'vs-cpu') {
    state.turn = (state.turn === 'player') ? 'cpu' : 'player';
    if (state.turn === 'cpu') {
      document.getElementById('turn-indicator').textContent = '🤖 コンピュータの ばんです';
      document.getElementById('game-msg').textContent = 'コンピュータが 考え中…';
      await sleep(1000);
      runTurn();
      return;
    } else {
      document.getElementById('turn-indicator').textContent = '👦 あなたの ばんです！';
      document.getElementById('game-msg').textContent = '「さいころを ふる！」ボタンをおしてね！';
    }
  } else {
    document.getElementById('game-msg').textContent = 'つぎの さいころを ふろう！';
  }
  state.isRolling = false;
}

// ==========================================
// タブ③：ルールかいぞう
// ==========================================
function initCustomRules() {
  document.getElementById('btn-apply-rules').addEventListener('click', applyCustomRules);
  document.getElementById('btn-reset-rules').addEventListener('click', resetCustomRules);
}

function parseRuleValue(strVal) {
  if (strVal === 'none') return null;
  if (strVal === 'start') return { type: 'back', val: 30, label: 'スタートへもどる' };
  const parts = strVal.split(':');
  const type = parts[0];
  const val = parseInt(parts[1], 10);
  let label = '';
  if (type === 'step') label = `${val}進む`;
  if (type === 'back') label = `${val}もどる`;
  if (type === 'rest') label = `${val}回休み`;
  return { type, val, label };
}

function applyCustomRules() {
  sound.playCorrect();
  const c2 = parseRuleValue(document.getElementById('custom-cell-2').value);
  const c10 = parseRuleValue(document.getElementById('custom-cell-10').value);
  const c14 = parseRuleValue(document.getElementById('custom-cell-14').value);
  const c20 = parseRuleValue(document.getElementById('custom-cell-20').value);
  const c24 = parseRuleValue(document.getElementById('custom-cell-24').value);
  const c28 = parseRuleValue(document.getElementById('custom-cell-28').value);
  const dice = document.getElementById('custom-dice-type').value;

  state.rules.cellInstructions = {};
  if (c2) state.rules.cellInstructions[2] = c2;
  if (c10) state.rules.cellInstructions[10] = c10;
  if (c14) state.rules.cellInstructions[14] = c14;
  if (c20) state.rules.cellInstructions[20] = c20;
  if (c24) state.rules.cellInstructions[24] = c24;
  if (c28) state.rules.cellInstructions[28] = c28;
  state.rules.diceType = dice;

  renderBoard();
  showModal('⚙️ ルールを更新しました！', 'あたらしいルールで すごろく盤面をととのえたよ！ゲームでためしてみよう！');
  switchTab('game');
}

function resetCustomRules() {
  sound.playClick();
  document.getElementById('custom-cell-2').value = 'step:3';
  document.getElementById('custom-cell-10').value = 'step:2';
  document.getElementById('custom-cell-14').value = 'rest:1';
  document.getElementById('custom-cell-20').value = 'back:3';
  document.getElementById('custom-cell-24').value = 'step:4';
  document.getElementById('custom-cell-28').value = 'back:4';
  document.getElementById('custom-dice-type').value = '1-6';
  applyCustomRules();
}
