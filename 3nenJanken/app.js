// ==========================================
// 状態管理と初期設定
// ==========================================
const state = {
  // アンロック状態（①クリアで②、②クリアで③が解放）
  unlocked: {
    puzzle: true,
    game: false,
    custom: false
  },
  // ルール設定
  rules: {
    rockStep: 3,
    scissorsStep: 6,
    paperStep: 6,
    goalStep: 20
  },
  // アニメーション速度
  speed: 'normal', // 'slow', 'normal', 'fast'
  // パズルピース定義
  pieces: [
    { id: 'p_janken', text: 'じゃんけんの けっかは。', shape: 'diamond' },
    { id: 'p_step3', text: '3歩進む。', shape: 'rect' },
    { id: 'p_step6_1', text: '6歩進む。', shape: 'rect' },
    { id: 'p_step6_2', text: '6歩進む。', shape: 'rect' },
    { id: 'p_goal', text: 'ゴールした人が いますか。', shape: 'diamond' }
  ],
  // パズルのスロット配置状態
  puzzleSlots: {
    slot_a: null,
    slot_i: null,
    slot_u: null,
    slot_e: null,
    slot_o: null
  },
  selectedPieceId: null,

  // ゲーム状態
  playerPos: 0,
  cpuPos: 0,
  isGameRunning: false
};

const SPEED_MAP = {
  slow: 800,
  normal: 500,
  fast: 250
};

// ==========================================
// 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadUnlockState();
  setupTabs();
  setupSoundToggle();
  setupTeacherUnlock();
  initPuzzle();
  initGame();
  initCustomRules();
  initConfetti();
  updateTabUI();
});

// アンロック状態の保存と復元（localStorage）
function loadUnlockState() {
  try {
    const saved = localStorage.getItem('janken_unlocked_steps');
    if (saved) {
      const parsed = JSON.parse(saved);
      state.unlocked = { ...state.unlocked, ...parsed };
    }
  } catch (e) {
    console.warn('localStorage error', e);
  }
}

function saveUnlockState() {
  try {
    localStorage.setItem('janken_unlocked_steps', JSON.stringify(state.unlocked));
  } catch (e) {
    console.warn('localStorage error', e);
  }
}

function updateTabUI() {
  const btnGame = document.getElementById('tab-btn-game');
  const btnCustom = document.getElementById('tab-btn-custom');
  const teacherIcon = document.getElementById('teacher-btn-icon');
  const teacherBtn = document.getElementById('btn-teacher-toggle');

  if (state.unlocked.game) {
    btnGame.classList.remove('locked');
    const lockIcon = btnGame.querySelector('.tab-lock-icon');
    if (lockIcon) lockIcon.style.display = 'none';
  } else {
    btnGame.classList.add('locked');
    const lockIcon = btnGame.querySelector('.tab-lock-icon');
    if (lockIcon) lockIcon.style.display = 'inline';
  }

  if (state.unlocked.custom) {
    btnCustom.classList.remove('locked');
    const lockIcon = btnCustom.querySelector('.tab-lock-icon');
    if (lockIcon) lockIcon.style.display = 'none';
  } else {
    btnCustom.classList.add('locked');
    const lockIcon = btnCustom.querySelector('.tab-lock-icon');
    if (lockIcon) lockIcon.style.display = 'inline';
  }

  // 先生ボタンのアイコン（全開放中なら再ロック用「🔒」、未開放なら解除用「🔓」）
  const isAllUnlocked = state.unlocked.game && state.unlocked.custom;
  if (teacherIcon && teacherBtn) {
    if (isAllUnlocked) {
      teacherIcon.textContent = '🔒';
      teacherBtn.title = 'せんせい用：ふたたびロックする';
    } else {
      teacherIcon.textContent = '🔓';
      teacherBtn.title = 'せんせい用：合言葉でぜんぶひらく';
    }
  }
}

// 先生用パスワード認証 ＆ 再ロック切り替え
function setupTeacherUnlock() {
  const btnTeacherToggle = document.getElementById('btn-teacher-toggle');
  
  // パスワードモーダル要素
  const pwOverlay = document.getElementById('teacher-modal-overlay');
  const input = document.getElementById('teacher-pw-input');
  const errorMsg = document.getElementById('teacher-pw-error');
  const btnSubmit = document.getElementById('btn-teacher-submit');
  const btnCancel = document.getElementById('btn-teacher-cancel');
  const form = document.getElementById('teacher-form');

  // 再ロックモーダル要素
  const relockOverlay = document.getElementById('relock-modal-overlay');
  const btnRelockCancel = document.getElementById('btn-relock-cancel');
  const btnRelockConfirm = document.getElementById('btn-relock-confirm');

  // ボタンクリック時の振り分け
  btnTeacherToggle.addEventListener('click', () => {
    const isAllUnlocked = state.unlocked.game && state.unlocked.custom;
    if (isAllUnlocked) {
      // 全開放中なら再ロック確認を表示
      relockOverlay.classList.add('open');
    } else {
      // 未開放ならパスワード入力を表示
      input.value = '';
      errorMsg.style.display = 'none';
      pwOverlay.classList.add('open');
      setTimeout(() => input.focus(), 150);
    }
  });

  // パスワードモーダル閉じる
  btnCancel.addEventListener('click', () => {
    pwOverlay.classList.remove('open');
  });

  // パスワード判定（合言葉: sensei）
  const checkPassword = () => {
    const val = input.value.trim().toLowerCase();
    if (val === 'sensei') {
      state.unlocked.game = true;
      state.unlocked.custom = true;
      saveUnlockState();
      updateTabUI();
      pwOverlay.classList.remove('open');
      window.soundPlayer.playCorrect();
      showModal('🔓 合言葉を かくにんしました', 'すべてのモードが つかえるようになりました！<br>もう一度 右上の 🔒 を押すと 再びロックできます。', 'success');
    } else {
      window.soundPlayer.playWrong();
      errorMsg.style.display = 'block';
      input.select();
    }
  };

  btnSubmit.addEventListener('click', checkPassword);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    checkPassword();
  });

  // 再ロックモーダル操作
  btnRelockCancel.addEventListener('click', () => {
    relockOverlay.classList.remove('open');
  });

  btnRelockConfirm.addEventListener('click', () => {
    state.unlocked.game = false;
    state.unlocked.custom = false;
    saveUnlockState();
    updateTabUI();
    switchTab('puzzle'); // パズル画面へ戻す
    relockOverlay.classList.remove('open');
    window.soundPlayer.playClick();
    showModal('🔒 ロック完了', '②ゲーム と ③ルールかいぞう に ロックをかけました！<br>さいしょの状態（①フローチャートのみ）にもどりました。', 'info');
  });
}

// ==========================================
// タブ切り替え（ロック制御付き）
// ==========================================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // ロック判定
      if (!state.unlocked[targetTab]) {
        window.soundPlayer.playWrong();
        if (targetTab === 'game') {
          showModal('🔒 まだあそべないよ', 'まずは <b>① フローチャート</b> を かんせいさせよう！<br>正解すると ゲームで あそべるようになるよ！', 'wrong');
        } else if (targetTab === 'custom') {
          showModal('🔒 まだあそべないよ', 'まずは <b>② ゲーム</b> で じゃんけん勝負して、<br>ゴールまで あそんでみよう！', 'wrong');
        }
        return;
      }

      switchTab(targetTab);
      window.soundPlayer.playClick();
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabId}`);
  });

  if (tabId === 'game') {
    renderGameFlowchart();
    updateTrackDisplay();
    setTimeout(() => {
      updateTokenPosition('player', state.playerPos);
      updateTokenPosition('cpu', state.cpuPos);
    }, 50);
  }
}

window.addEventListener('resize', () => {
  if (document.getElementById('tab-game').classList.contains('active')) {
    updateTokenPosition('player', state.playerPos);
    updateTokenPosition('cpu', state.cpuPos);
  }
});

// ==========================================
// 音声トグル
// ==========================================
function setupSoundToggle() {
  const btn = document.getElementById('btn-sound-toggle');
  const icon = document.getElementById('sound-icon');

  btn.addEventListener('click', () => {
    window.soundPlayer.enabled = !window.soundPlayer.enabled;
    if (window.soundPlayer.enabled) {
      icon.textContent = '🔊';
      window.soundPlayer.playClick();
    } else {
      icon.textContent = '🔇';
    }
  });
}

// ==========================================
// ① パズルモード
// ==========================================
function initPuzzle() {
  renderPuzzlePieces();
  renderPuzzleFlowchart();

  document.getElementById('btn-check-puzzle').addEventListener('click', checkPuzzleAnswer);

  document.getElementById('btn-reset-puzzle').addEventListener('click', () => {
    Object.keys(state.puzzleSlots).forEach(k => state.puzzleSlots[k] = null);
    state.selectedPieceId = null;
    renderPuzzlePieces();
    renderPuzzleFlowchart();
    window.soundPlayer.playClick();
  });
}

function renderPuzzlePieces() {
  const container = document.getElementById('pieces-container');
  container.innerHTML = '';

  state.pieces.forEach(piece => {
    const isPlaced = Object.values(state.puzzleSlots).includes(piece.id);
    if (isPlaced) return;

    const card = document.createElement('div');
    card.className = `piece-card ${state.selectedPieceId === piece.id ? 'selected' : ''}`;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', piece.id);
    card.setAttribute('data-shape', piece.shape);

    const shapeName = piece.shape === 'diamond' ? 'ひし形◇' : '四角□';
    card.innerHTML = `
      <span>${piece.text}</span>
      <span class="shape-badge">${shapeName}</span>
    `;

    // タップ選択
    card.addEventListener('click', () => {
      window.soundPlayer.playClick();
      state.selectedPieceId = state.selectedPieceId === piece.id ? null : piece.id;
      renderPuzzlePieces();
    });

    // ドラッグ＆ドロップ
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', piece.id);
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    container.appendChild(card);
  });
}

function renderPuzzleFlowchart() {
  const svg = document.getElementById('puzzle-svg');
  svg.innerHTML = buildFlowchartSVG(true);
  attachPuzzleSlotEvents();
}

function attachPuzzleSlotEvents() {
  const slots = document.querySelectorAll('#puzzle-svg .drop-slot');
  slots.forEach(slot => {
    const slotKey = slot.getAttribute('data-slot');

    slot.addEventListener('click', () => {
      const currentPieceId = state.puzzleSlots[slotKey];
      if (currentPieceId) {
        state.puzzleSlots[slotKey] = null;
        window.soundPlayer.playClick();
        renderPuzzlePieces();
        renderPuzzleFlowchart();
      } else if (state.selectedPieceId) {
        state.puzzleSlots[slotKey] = state.selectedPieceId;
        state.selectedPieceId = null;
        window.soundPlayer.playClick();
        renderPuzzlePieces();
        renderPuzzleFlowchart();
      }
    });

    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      const pieceId = e.dataTransfer.getData('text/plain');
      if (pieceId) {
        Object.keys(state.puzzleSlots).forEach(k => {
          if (state.puzzleSlots[k] === pieceId) state.puzzleSlots[k] = null;
        });
        state.puzzleSlots[slotKey] = pieceId;
        window.soundPlayer.playClick();
        renderPuzzlePieces();
        renderPuzzleFlowchart();
      }
    });
  });
}

function checkPuzzleAnswer() {
  const s = state.puzzleSlots;
  const isFilled = Object.values(s).every(v => v !== null);

  if (!isFilled) {
    window.soundPlayer.playWrong();
    showModal('🤔 まだ すきまがあるよ！', 'アから オの すべての わくに ことばを えらんで はめてみてね！', 'info');
    return;
  }

  const isA = s.slot_a === 'p_janken';
  const isI = s.slot_i === 'p_step3';
  const isUE = (s.slot_u === 'p_step6_1' && s.slot_e === 'p_step6_2') ||
               (s.slot_u === 'p_step6_2' && s.slot_e === 'p_step6_1');
  const isO = s.slot_o === 'p_goal';

  if (isA && isI && isUE && isO) {
    state.unlocked.game = true;
    saveUnlockState();
    updateTabUI();

    window.soundPlayer.playCorrect();
    setTimeout(() => window.soundPlayer.playFanfare(), 300);
    fireConfetti();
    showModal(
      '🎉 だいせいかい！',
      'フローチャートが かんせいしたよ！<br><b>② ゲームであそぶ</b> が つかえるようになったよ！<br>さっそく ゲームへすすもう！',
      'success',
      () => switchTab('game')
    );
  } else {
    window.soundPlayer.playWrong();
    let hint = 'どこかが ちがっているみたい！<br>';
    if (!isA || !isO) {
      hint += '💡 ひし形◇には「〜ですか」「〜は」という質問・判断が入るよ。<br>';
    }
    if (!isI || !isUE) {
      hint += '💡 四角□には「〜歩進む」という命令が入るよ。グーとチョキ・パーの歩数をかくにんしてね！';
    }
    showModal('惜しい！もうすこし！', hint, 'wrong');
  }
}

// ==========================================
// フローチャートSVGビルダー（右シフト・完全分離版）
// viewBox: 0 0 600 580
// 中央線: x = 260
// 右側分岐中心: x = 425 (アからオへの線に一切被らない配置)
// ==========================================
function buildFlowchartSVG(isPuzzleMode) {
  const r = state.rules;

  let svg = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#0984e3" />
      </marker>
      <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#ff9f43" />
      </marker>
    </defs>
  `;

  // --- 接続ライン（Edges） ---

  // 1. スタート -> ア（縦線: x=260）
  svg += `<line id="edge-start-to-a" x1="260" y1="50" x2="260" y2="105" stroke="#0984e3" stroke-width="2.2" marker-end="url(#arrow)" />`;

  // 2. あいこ（アの左角 -> 左へ -> 内側を上へ -> スタート下へ矢印）
  svg += `<path id="edge-aiko" d="M 165 138 L 110 138 L 110 84 L 252 84" fill="none" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;
  svg += `<text x="120" y="130" font-size="12" font-weight="bold" fill="#57606f">あいこ</text>`;

  // 3. 負けた（★アの下角 -> 真下にまっすぐ -> オの上角へ直結！ x=260）
  svg += `<line id="edge-lose" x1="260" y1="171" x2="260" y2="430" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;
  svg += `<text x="235" y="205" font-size="12" font-weight="bold" fill="#57606f">負けた</text>`;

  // 4. 勝った（アの右角 355 ➔ 右へ 425 ➔ 真下へ折れて「何で勝ちましたか」の上角 425,198 へ！）
  svg += `<path id="edge-win" d="M 355 138 L 425 138 L 425 195 L 425 198" fill="none" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;
  svg += `<text x="375" y="128" font-size="12" font-weight="bold" fill="#0984e3">勝った</text>`;

  // 5. 「何で勝ちましたか」からの3分岐
  // グー -> イ (center 325)
  svg += `<path id="edge-rock" d="M 385 238 L 325 238 L 325 280" fill="none" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;
  svg += `<text x="295" y="265" font-size="12" font-weight="bold" fill="#57606f">グー</text>`;

  // チョキ -> ウ (center 425)
  svg += `<line id="edge-scissors" x1="425" y1="252" x2="425" y2="280" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;
  svg += `<text x="432" y="270" font-size="12" font-weight="bold" fill="#57606f">チョキ</text>`;

  // パー -> エ (center 525)
  svg += `<path id="edge-paper" d="M 465 238 L 525 238 L 525 280" fill="none" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;
  svg += `<text x="532" y="265" font-size="12" font-weight="bold" fill="#57606f">パー</text>`;

  // 6. イ・ウ・エからの合流線 -> 下へ降りて左へ折れ、オの右角 (355, 465) へ矢印！
  svg += `<path id="edge-merge" d="M 325 316 L 325 340 L 525 340 M 425 316 L 425 340 M 525 316 L 525 340 M 475 340 L 475 465 L 357 465" fill="none" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;

  // 7. いいえ（オの左角 -> 左へ -> 一番外側を上へ -> スタート直下へ矢印）
  svg += `<path id="edge-not-goal" d="M 165 465 L 50 465 L 50 64 L 252 64" fill="none" stroke="#0984e3" stroke-width="2" marker-end="url(#arrow)" />`;
  svg += `<text x="105" y="455" font-size="12" font-weight="bold" fill="#57606f">いいえ</text>`;

  // 8. はい（オの下角 -> 真下のおわりへ）
  svg += `<line id="edge-is-goal" x1="260" y1="498" x2="260" y2="530" stroke="#0984e3" stroke-width="2.2" marker-end="url(#arrow)" />`;
  svg += `<text x="272" y="516" font-size="12" font-weight="bold" fill="#0984e3">はい</text>`;

  // --- ノード（Nodes） ---

  // [スタート] (center 260)
  svg += `
    <g id="node-start">
      <rect x="180" y="14" width="160" height="36" rx="18" fill="#e8f4fd" stroke="#0984e3" stroke-width="2" />
      <text x="260" y="32" font-size="15" font-weight="bold" fill="#0984e3" text-anchor="middle" dominant-baseline="central">スタート</text>
    </g>
  `;

  // [ア]（ひし形: center 260, 138）
  if (isPuzzleMode) {
    const piece = state.puzzleSlots.slot_a ? state.pieces.find(p => p.id === state.puzzleSlots.slot_a) : null;
    const isFilled = !!piece;
    svg += `
      <g id="node-a" class="puzzle-slot-group">
        <polygon class="drop-slot ${isFilled ? 'filled' : ''}" data-slot="slot_a" data-shape="diamond"
                 points="260,105 355,138 260,171 165,138" />
        <text class="${isFilled ? 'slot-text' : 'slot-label'}" x="260" y="138">
          ${isFilled ? piece.text : 'ア'}
        </text>
      </g>
    `;
  } else {
    svg += `
      <g id="node-a">
        <polygon points="260,105 355,138 260,171 165,138" fill="#e8f8f0" stroke="#2ecc71" stroke-width="2.2" />
        <text x="260" y="138" font-size="13.5" font-weight="bold" fill="#2d3436" text-anchor="middle" dominant-baseline="central">じゃんけんの けっかは。</text>
      </g>
    `;
  }

  // [何で勝ちましたか。]（ひし形: center 425, 225 / 左角345〜右角505）
  // 負けたの線(x=260)から85px右に離れており、一切被らない！
  svg += `
    <g id="node-how">
      <polygon points="425,198 505,225 425,252 345,225" fill="#e8f8f0" stroke="#2ecc71" stroke-width="2" />
      <text x="425" y="225" font-size="12" font-weight="bold" fill="#2d3436" text-anchor="middle" dominant-baseline="central">何で 勝ちましたか。</text>
    </g>
  `;

  // [イ]（長方形：グー / center 325, 298 / x=284〜366）
  if (isPuzzleMode) {
    const piece = state.puzzleSlots.slot_i ? state.pieces.find(p => p.id === state.puzzleSlots.slot_i) : null;
    const isFilled = !!piece;
    svg += `
      <g id="node-i" class="puzzle-slot-group">
        <rect class="drop-slot ${isFilled ? 'filled' : ''}" data-slot="slot_i" data-shape="rect"
              x="284" y="280" width="82" height="36" rx="4" />
        <text class="${isFilled ? 'slot-text' : 'slot-label'}" x="325" y="298">
          ${isFilled ? piece.text : 'イ'}
        </text>
      </g>
    `;
  } else {
    svg += `
      <g id="node-i">
        <rect x="284" y="280" width="82" height="36" rx="4" fill="#ffeef0" stroke="#ff7675" stroke-width="2" />
        <text x="325" y="298" font-size="12.5" font-weight="bold" fill="#d63031" text-anchor="middle" dominant-baseline="central">${r.rockStep}歩進む。</text>
      </g>
    `;
  }

  // [ウ]（長方形：チョキ / center 425, 298 / x=384〜466）
  if (isPuzzleMode) {
    const piece = state.puzzleSlots.slot_u ? state.pieces.find(p => p.id === state.puzzleSlots.slot_u) : null;
    const isFilled = !!piece;
    svg += `
      <g id="node-u" class="puzzle-slot-group">
        <rect class="drop-slot ${isFilled ? 'filled' : ''}" data-slot="slot_u" data-shape="rect"
              x="384" y="280" width="82" height="36" rx="4" />
        <text class="${isFilled ? 'slot-text' : 'slot-label'}" x="425" y="298">
          ${isFilled ? piece.text : 'ウ'}
        </text>
      </g>
    `;
  } else {
    svg += `
      <g id="node-u">
        <rect x="384" y="280" width="82" height="36" rx="4" fill="#ffeef0" stroke="#ff7675" stroke-width="2" />
        <text x="425" y="298" font-size="12.5" font-weight="bold" fill="#d63031" text-anchor="middle" dominant-baseline="central">${r.scissorsStep}歩進む。</text>
      </g>
    `;
  }

  // [エ]（長方形：パー / center 525, 298 / x=484〜566）
  if (isPuzzleMode) {
    const piece = state.puzzleSlots.slot_e ? state.pieces.find(p => p.id === state.puzzleSlots.slot_e) : null;
    const isFilled = !!piece;
    svg += `
      <g id="node-e" class="puzzle-slot-group">
        <rect class="drop-slot ${isFilled ? 'filled' : ''}" data-slot="slot_e" data-shape="rect"
              x="484" y="280" width="82" height="36" rx="4" />
        <text class="${isFilled ? 'slot-text' : 'slot-label'}" x="525" y="298">
          ${isFilled ? piece.text : 'エ'}
        </text>
      </g>
    `;
  } else {
    svg += `
      <g id="node-e">
        <rect x="484" y="280" width="82" height="36" rx="4" fill="#ffeef0" stroke="#ff7675" stroke-width="2" />
        <text x="525" y="298" font-size="12.5" font-weight="bold" fill="#d63031" text-anchor="middle" dominant-baseline="central">${r.paperStep}歩進む。</text>
      </g>
    `;
  }

  // [オ]（ひし形: center 260, 465）
  if (isPuzzleMode) {
    const piece = state.puzzleSlots.slot_o ? state.pieces.find(p => p.id === state.puzzleSlots.slot_o) : null;
    const isFilled = !!piece;
    svg += `
      <g id="node-o" class="puzzle-slot-group">
        <polygon class="drop-slot ${isFilled ? 'filled' : ''}" data-slot="slot_o" data-shape="diamond"
                 points="260,432 355,465 260,498 165,465" />
        <text class="${isFilled ? 'slot-text' : 'slot-label'}" x="260" y="465">
          ${isFilled ? piece.text : 'オ'}
        </text>
      </g>
    `;
  } else {
    svg += `
      <g id="node-o">
        <polygon points="260,432 355,465 260,498 165,465" fill="#e8f8f0" stroke="#2ecc71" stroke-width="2.2" />
        <text x="260" y="465" font-size="13" font-weight="bold" fill="#2d3436" text-anchor="middle" dominant-baseline="central">ゴールした人が いますか。</text>
      </g>
    `;
  }

  // [おわり] (center 260, 550)
  svg += `
    <g id="node-end">
      <rect x="180" y="532" width="160" height="36" rx="18" fill="#e8f4fd" stroke="#0984e3" stroke-width="2" />
      <text x="260" y="550" font-size="15" font-weight="bold" fill="#0984e3" text-anchor="middle" dominant-baseline="central">おわり</text>
    </g>
  `;

  return svg;
}

// ==========================================
// ② ゲームモード
// ==========================================
function initGame() {
  renderGameFlowchart();
  initTrackCells();

  document.querySelectorAll('.hand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.isGameRunning) return;
      const hand = btn.getAttribute('data-hand');
      playRound(hand);
    });
  });

  document.getElementById('speed-select').addEventListener('change', (e) => {
    state.speed = e.target.value;
  });

  document.getElementById('btn-reset-game').addEventListener('click', resetGame);
}

function renderGameFlowchart() {
  const svg = document.getElementById('game-svg');
  svg.innerHTML = buildFlowchartSVG(false);
}

function initTrackCells() {
  const playerContainer = document.getElementById('cells-player');
  const cpuContainer = document.getElementById('cells-cpu');
  playerContainer.innerHTML = '';
  cpuContainer.innerHTML = '';

  const total = state.rules.goalStep;
  document.querySelectorAll('.goal-step-label').forEach(el => el.textContent = total);

  for (let i = 0; i <= total; i++) {
    const isStart = i === 0;
    const isGoal = i === total;

    const cellP = document.createElement('div');
    cellP.className = `cell ${isStart ? 'start' : ''} ${isGoal ? 'goal' : ''}`;
    cellP.textContent = isStart ? 'S' : (isGoal ? 'G' : i);
    cellP.id = `cell-player-${i}`;
    playerContainer.appendChild(cellP);

    const cellC = document.createElement('div');
    cellC.className = `cell ${isStart ? 'start' : ''} ${isGoal ? 'goal' : ''}`;
    cellC.textContent = isStart ? 'S' : (isGoal ? 'G' : i);
    cellC.id = `cell-cpu-${i}`;
    cpuContainer.appendChild(cellC);
  }

  const tokenP = document.createElement('div');
  tokenP.id = 'token-player';
  tokenP.className = 'player-token';
  tokenP.textContent = '👦';
  playerContainer.appendChild(tokenP);

  const tokenC = document.createElement('div');
  tokenC.id = 'token-cpu';
  tokenC.className = 'player-token';
  tokenC.textContent = '🤖';
  cpuContainer.appendChild(tokenC);

  updateTokenPosition('player', 0);
  updateTokenPosition('cpu', 0);
}

function updateTrackDisplay() {
  document.getElementById('score-player').textContent = `${state.playerPos}歩 / ${state.rules.goalStep}歩`;
  document.getElementById('score-cpu').textContent = `${state.cpuPos}歩 / ${state.rules.goalStep}歩`;
}

function updateTokenPosition(player, pos) {
  const token = document.getElementById(`token-${player}`);
  const targetCell = document.getElementById(`cell-${player}-${pos}`);
  if (token && targetCell) {
    const rect = targetCell.offsetLeft + (targetCell.offsetWidth / 2) - 14;
    token.style.left = `${rect}px`;
  }
}

async function playRound(playerHand) {
  state.isGameRunning = true;
  disableHandButtons(true);

  const hands = ['rock', 'scissors', 'paper'];
  const cpuHand = hands[Math.floor(Math.random() * hands.length)];

  window.soundPlayer.playPon();

  let result = 'draw';
  if (playerHand === cpuHand) {
    result = 'draw';
  } else if (
    (playerHand === 'rock' && cpuHand === 'scissors') ||
    (playerHand === 'scissors' && cpuHand === 'paper') ||
    (playerHand === 'paper' && cpuHand === 'rock')
  ) {
    result = 'win';
  } else {
    result = 'lose';
  }

  const handEmojiMap = { rock: '✊', scissors: '✌️', paper: '🖐️' };
  document.getElementById('player-hand-disp').textContent = handEmojiMap[playerHand];
  document.getElementById('cpu-hand-disp').textContent = handEmojiMap[cpuHand];

  const judgeDisp = document.getElementById('round-judge-disp');
  if (result === 'win') {
    judgeDisp.textContent = 'あなたの かち！';
    judgeDisp.style.color = '#2ecc71';
  } else if (result === 'lose') {
    judgeDisp.textContent = 'あいての かち！';
    judgeDisp.style.color = '#e74c3c';
  } else {
    judgeDisp.textContent = 'あいこ！';
    judgeDisp.style.color = '#f39c12';
  }
  document.getElementById('round-result-card').style.display = 'flex';

  const statusMsg = document.getElementById('game-status-msg');
  statusMsg.textContent = 'フローチャートを たどっているよ...';

  // フローチャートをトレース実行！
  await traceFlowchart(result, playerHand, cpuHand);

  // 終了判定
  if (state.playerPos >= state.rules.goalStep || state.cpuPos >= state.rules.goalStep) {
    const isPlayerWin = state.playerPos >= state.rules.goalStep;

    state.unlocked.custom = true;
    saveUnlockState();
    updateTabUI();

    window.soundPlayer.playFanfare();
    fireConfetti();
    showModal(
      isPlayerWin ? '👑 おめでとう！ゴール！！' : '🤖 コンピュータのゴール！',
      isPlayerWin
        ? 'あなたが さいしょに ゴールしました！<br><b>③ ルールかいぞう</b> で 歩数をかえて あそべるようになったよ！'
        : 'コンピュータが 先にゴールしました！<br>もう一回 ちょうせんするか、<b>③ ルールかいぞう</b> をためしてみてね！',
      'success',
      () => resetGame()
    );
  } else {
    statusMsg.textContent = 'つぎの手を えらんでね！';
    disableHandButtons(false);
    state.isGameRunning = false;
  }
}

function disableHandButtons(disabled) {
  document.querySelectorAll('.hand-btn').forEach(b => {
    b.disabled = disabled;
    b.style.opacity = disabled ? '0.5' : '1';
    b.style.cursor = disabled ? 'not-allowed' : 'pointer';
  });
}

// フローチャートのトレースアニメーション（教科書の結線に完全連動）
async function traceFlowchart(result, playerHand, cpuHand) {
  const delayMs = SPEED_MAP[state.speed] || 500;
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  const svg = document.getElementById('game-svg');
  const clearActive = () => {
    svg.querySelectorAll('.node-active').forEach(el => el.classList.remove('node-active'));
    svg.querySelectorAll('.edge-active').forEach(el => el.classList.remove('edge-active'));
  };

  const highlight = (nodeId, edgeId) => {
    clearActive();
    if (nodeId) {
      const n = svg.querySelector(`#${nodeId}`);
      if (n) n.classList.add('node-active');
    }
    if (edgeId) {
      const e = svg.querySelector(`#${edgeId}`);
      if (e) e.classList.add('edge-active');
    }
    window.soundPlayer.playNode();
  };

  // 1. スタート
  highlight('node-start', 'edge-start-to-a');
  await sleep(delayMs);

  // 2. ア：じゃんけんの結果は。
  highlight('node-a', null);
  await sleep(delayMs);

  if (result === 'draw') {
    // 【あいこルート】：アの左から内側の矢印を通ってスタート下へ戻る
    highlight('node-a', 'edge-aiko');
    await sleep(delayMs * 1.2);
    clearActive();
    return;
  }

  if (result === 'lose') {
    // 【負けたルート】：アの下から真下の矢印を通って直接オの上の角へ！
    highlight('node-a', 'edge-lose');
    await sleep(delayMs);

    // 相手が進む
    const steps = cpuHand === 'rock' ? state.rules.rockStep :
                  cpuHand === 'scissors' ? state.rules.scissorsStep : state.rules.paperStep;
    await advancePlayer('cpu', steps);

    // オ：ゴールした人がいますか（相手がゴールしたか判定）
    highlight('node-o', null);
    await sleep(delayMs);

    const isCpuGoal = state.cpuPos >= state.rules.goalStep;
    if (isCpuGoal) {
      highlight('node-o', 'edge-is-goal');
      await sleep(delayMs);
      highlight('node-end', null);
      await sleep(delayMs);
    } else {
      highlight('node-o', 'edge-not-goal');
      await sleep(delayMs * 1.3);
    }
    clearActive();
    return;
  }

  // 【勝ったルート】
  highlight('node-a', 'edge-win');
  await sleep(delayMs);

  // 何で勝ちましたか。
  highlight('node-how', null);
  await sleep(delayMs);

  // グー・チョキ・パーの分岐
  let targetNode = 'node-i';
  let targetEdge = 'edge-rock';
  let steps = state.rules.rockStep;

  if (playerHand === 'scissors') {
    targetNode = 'node-u';
    targetEdge = 'edge-scissors';
    steps = state.rules.scissorsStep;
  } else if (playerHand === 'paper') {
    targetNode = 'node-e';
    targetEdge = 'edge-paper';
    steps = state.rules.paperStep;
  }

  highlight(null, targetEdge);
  await sleep(delayMs * 0.7);

  highlight(targetNode, null);
  await sleep(delayMs);

  // プレイヤーが進む
  await advancePlayer('player', steps);

  // 合流線 -> オの右角へ
  highlight(null, 'edge-merge');
  await sleep(delayMs);

  // オ：ゴールした人がいますか。
  highlight('node-o', null);
  await sleep(delayMs);

  // ゴール判定
  const isPlayerGoal = state.playerPos >= state.rules.goalStep;
  if (isPlayerGoal) {
    highlight('node-o', 'edge-is-goal');
    await sleep(delayMs);
    highlight('node-end', null);
    await sleep(delayMs);
  } else {
    highlight('node-o', 'edge-not-goal');
    await sleep(delayMs * 1.3);
  }

  clearActive();
}

async function advancePlayer(player, steps) {
  const currentPos = player === 'player' ? state.playerPos : state.cpuPos;
  const targetPos = Math.min(state.rules.goalStep, currentPos + steps);
  const token = document.getElementById(`token-${player}`);

  for (let pos = currentPos + 1; pos <= targetPos; pos++) {
    if (player === 'player') state.playerPos = pos;
    else state.cpuPos = pos;

    updateTokenPosition(player, pos);
    updateTrackDisplay();

    if (token) {
      token.classList.remove('jump');
      void token.offsetWidth;
      token.classList.add('jump');
    }

    window.soundPlayer.playStep(pos % 5);
    await new Promise(r => setTimeout(r, 200));
  }
}

function resetGame() {
  state.playerPos = 0;
  state.cpuPos = 0;
  state.isGameRunning = false;
  updateTokenPosition('player', 0);
  updateTokenPosition('cpu', 0);
  updateTrackDisplay();
  disableHandButtons(false);
  document.getElementById('round-result-card').style.display = 'none';
  document.getElementById('game-status-msg').textContent = 'じゃんけんの手をおして、ゲームをスタートしよう！';
}

// ==========================================
// ③ カスタマイズモード
// ==========================================
function initCustomRules() {
  const rockInput = document.getElementById('input-rock-step');
  const scissorsInput = document.getElementById('input-scissors-step');
  const paperInput = document.getElementById('input-paper-step');
  const goalInput = document.getElementById('input-goal-step');

  const applyBtn = document.getElementById('btn-apply-rules');
  const resetBtn = document.getElementById('btn-reset-rules');

  applyBtn.addEventListener('click', () => {
    state.rules.rockStep = parseInt(rockInput.value, 10) || 3;
    state.rules.scissorsStep = parseInt(scissorsInput.value, 10) || 6;
    state.rules.paperStep = parseInt(paperInput.value, 10) || 6;
    state.rules.goalStep = parseInt(goalInput.value, 10) || 20;

    document.getElementById('label-step-rock').textContent = `${state.rules.rockStep}歩進む`;
    document.getElementById('label-step-scissors').textContent = `${state.rules.scissorsStep}歩進む`;
    document.getElementById('label-step-paper').textContent = `${state.rules.paperStep}歩進む`;

    initTrackCells();
    resetGame();
    renderGameFlowchart();

    window.soundPlayer.playClick();
    showModal(
      '⚙️ ルールを こうしんしたよ！',
      `・グー：${state.rules.rockStep}歩<br>・チョキ：${state.rules.scissorsStep}歩<br>・パー：${state.rules.paperStep}歩<br>・ゴール：${state.rules.goalStep}歩<br><br>あたらしいルールで ゲームを楽しもう！`,
      'info',
      () => switchTab('game')
    );
  });

  resetBtn.addEventListener('click', () => {
    rockInput.value = 3;
    scissorsInput.value = 6;
    paperInput.value = 6;
    goalInput.value = 20;
    applyBtn.click();
  });
}

// ==========================================
// モーダルダイアログ
// ==========================================
function showModal(title, message, type = 'info', onClose = null) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const iconEl = document.getElementById('modal-icon');
  const closeBtn = document.getElementById('btn-modal-close');

  titleEl.innerHTML = title;
  bodyEl.innerHTML = message;

  if (type === 'success') iconEl.textContent = '🎉';
  else if (type === 'wrong') iconEl.textContent = '💡';
  else iconEl.textContent = '✨';

  overlay.classList.add('open');

  const handler = () => {
    overlay.classList.remove('open');
    closeBtn.removeEventListener('click', handler);
    if (onClose) onClose();
  };
  closeBtn.addEventListener('click', handler);
}

// ==========================================
// 紙吹雪（Confetti）エフェクト
// ==========================================
let confettiParticles = [];
let confettiCtx = null;
let confettiAnimId = null;

function initConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  confettiCtx = canvas.getContext('2d');

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', resize);
  resize();
}

function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas || !confettiCtx) return;

  confettiParticles = [];
  const colors = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fd79a8'];

  for (let i = 0; i < 90; i++) {
    confettiParticles.push({
      x: canvas.width / 2,
      y: canvas.height / 3,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.7) * 14,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10
    });
  }

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animateConfetti();
}

function animateConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!confettiCtx || confettiParticles.length === 0) return;

  confettiCtx.clearRect(0, 0, canvas.width, canvas.height);

  confettiParticles.forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.35;
    p.rotation += p.vRot;

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    confettiCtx.restore();

    if (p.y > canvas.height) {
      confettiParticles.splice(idx, 1);
    }
  });

  if (confettiParticles.length > 0) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  } else {
    confettiCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
