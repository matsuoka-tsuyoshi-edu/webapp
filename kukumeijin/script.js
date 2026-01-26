// ===== ユーティリティ =====
const $  = (s, p=document)=>p.querySelector(s);
const $$ = (s, p=document)=>Array.from(p.querySelectorAll(s));
const rand = (n)=>Math.floor(Math.random()*n);
const choice = (arr)=>arr[rand(arr.length)];
const shuffle = (a)=>{ for(let i=a.length-1;i>0;i--){ const j=rand(i+1); [a[j],a[i]]=[a[i],a[j]];} return a; };

// ★ デバッグ設定
const ALWAYS_SHOW_DEBUG = false; 

function logDebug(message) {
    const debugWindow = $('#debugWindow');
    if (state.trainingModeActive && debugWindow) return;
    if (debugWindow && debugWindow.style.display !== 'none') { 
        const time = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${time}] ${message}`;
        debugWindow.appendChild(logEntry);
        debugWindow.scrollTop = debugWindow.scrollHeight; 
    }
    console.log(message); 
}

// デバッグ用長押し関連
let debugLongPressTimer = null;
const LONG_PRESS_DURATION = 2000; 

function handleDebugPressStart(e) {
    e.preventDefault();
    if (debugLongPressTimer) clearTimeout(debugLongPressTimer);
    debugLongPressTimer = setTimeout(() => {
        triggerDebugPrompt();
        debugLongPressTimer = null;
    }, LONG_PRESS_DURATION);
}
function handleDebugPressEnd(e) {
    if (debugLongPressTimer) {
        clearTimeout(debugLongPressTimer);
        debugLongPressTimer = null;
    }
}
function triggerDebugPrompt() {
    const debugWindow = $('#debugWindow');
    if (debugWindow.style.display === 'block') {
        debugWindow.style.display = 'none';
        return;
    }
    const input = prompt("コマンドを入力 (debug / hide):");
    if (input === "debug") {
        debugWindow.style.display = 'block';
        logDebug("--- DEBUG MODE ACTIVATED ---");
    } else if (input === "hide") {
        debugWindow.style.display = 'none';
    }
}

const praiseWords = ['おいしいねぇ','うまいね！','最高！','とろける〜','またお願い！','おみごと！','絶品だ！','ぴったり！','さすが！'];
const missedMessages = ["ちがうよ～", "もったいないよぉ", "だれもいないよぉ"];
const trainingCorrectFeedback = ["よし！", "うむ！", "さすがじゃ！"];
const trainingIncorrectFeedback = ["もういちどじゃ！", "ちがうぞ！", "まだまだじゃ！"];

// ===== 状態 =====
const state = {
  started:false,
  running:false, timeLeft:60, timerId:null,
  score:0, busy:false, pending:[],
  prepA:null, prepB:null, prepHoldTimer:null,
  customers:[], best:0, last:0,
  netaMap:{},
  charPick:[],
  activeTimers: new Set(),
  // ★ モード管理: 'normal' (答えを注文) or 'inverse' (九九を注文)
  gameMode: 'normal',
  
  // ★ 設定された段（モード②用）: デフォルトは2〜9
  selectedDans: [2,3,4,5,6,7,8,9],

  // ★ 親方モード用
  mistakeCount: 0,
  trainingModeActive: false,
  trainingCorrectCount: 0,
  currentTrainingProblem: null, 
  currentTrainingInput: "" 
};
const bestKey = 'kuku-meijin-best';
const PREP_HOLD_MS = 500;
const EAT_LIMIT = 5;
const MISTAKE_LIMIT = 5; 
const TRAINING_GOAL = 5; 

// ★ タイマー初期化 
function clearAllTimers() {
  logDebug("Clearing all timers..."); 
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  state.activeTimers.forEach(id => clearTimeout(id)); 
  state.activeTimers.clear(); 
  if (state.prepHoldTimer) {
     clearTimeout(state.prepHoldTimer);
     state.prepHoldTimer = null;
  }
}

// ===== ランダム抽選 =====
function pickUniqueInt(min, max, count){
  const arr=[]; for(let i=min;i<=max;i++) arr.push(i);
  shuffle(arr); return arr.slice(0, count);
}
// ★ネタマップ構築（0も含める）
function buildNetaMap(){
  // 1-9用画像。0用には10個目などを割り当てる
  const picks = pickUniqueInt(1,12,10); 
  const map = {}; 
  for(let n=1;n<=9;n++){ map[n] = `neta/${picks[n-1]}.png`; }
  // 0は10番目の画像を使う
  map[0] = `neta/${picks[9]}.png`;
  state.netaMap = map;
}
function pickCustomers(){ state.charPick = pickUniqueInt(1,10,3); }

// ===== 寿司バーレイアウト =====
function layoutSushiBarSizes(){
  const bar = $('#sushiBar');
  const gap = parseFloat(getComputedStyle(bar).gap) || 8;
  const totalGap = gap * 10; // 0-9で10個
  const barWidth = bar.clientWidth;
  const baseW = Math.max(30, Math.floor((barWidth - totalGap) / 10)); // 10個
  const baseH = Math.round(baseW * 0.75);
  const tileW = Math.max(30, baseW);
  const tileH = baseH + 10;
  document.documentElement.style.setProperty('--sushi-w', `${tileW}px`);
  document.documentElement.style.setProperty('--sushi-h', `${tileH}px`);
}

// ===== 寿司バー描画 (共通) =====
// 1,2,3...9, 0 の順に並べる
function renderSushiBar(){
  const bar = $('#sushiBar'); bar.innerHTML='';
  const nums = [1,2,3,4,5,6,7,8,9,0];
  
  nums.forEach(n => {
    const tile = document.createElement('div');
    tile.className='sushi';
    tile.dataset.val = String(n);
    tile.style.backgroundImage = `url("${state.netaMap[n]}")`;

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = n;
    tile.appendChild(num);

    tile.addEventListener('click', ()=>handleTap(n, tile));
    bar.appendChild(tile);
  });
  layoutSushiBarSizes();
}

// ===== ターゲット生成（モードによる違い） =====
function makeTarget(){ 
    let a, b;
    
    // ★ モード②の場合、選択された段の中から出題
    if (state.gameMode === 'inverse') {
        const available = (state.selectedDans.length > 0) ? state.selectedDans : [2,3,4,5,6,7,8,9];
        a = choice(available);
        b = 2 + rand(8); 
    } else {
        // モード①の場合は 1～9
        a = 1 + rand(9);
        b = 1 + rand(9);
    }
    const product = a * b;

    if (state.gameMode === 'normal') {
        return { val: product, label: String(product), type: 'answer' };
    } else {
        return { val: product, label: `${a} × ${b}`, type: 'equation' };
    }
}

// ===== お客さん描画 =====
function renderCustomers(){
  const wrap=$('#customers'); wrap.innerHTML=''; state.customers=[];
  const baseLeft = 0; const gap = 220;
  const customerNames = ["左", "中", "右"]; 
  for(let i=0;i<3;i++){
    const c=document.createElement('div'); c.className='customer';
    c.style.left = (baseLeft + gap*i) + 'px';
    c.style.bottom = '0px';

    const targetObj = makeTarget();

    const bubble=document.createElement('div'); bubble.className='bubble hidden';
    bubble.textContent=targetObj.label;

    const avatar=document.createElement('div'); avatar.className='avatar';
    const idx = state.charPick[i];
    avatar.style.backgroundImage = `url("char/char${idx}.png")`;

    const body=document.createElement('div'); body.className='body';
    const stack=document.createElement('div'); stack.className='plate-stack';

    c.appendChild(bubble); c.appendChild(avatar); c.appendChild(body); c.appendChild(stack);
    wrap.appendChild(c);
    
    state.customers.push({
        el:c, 
        bubbleEl:bubble, 
        target: targetObj.val, 
        label: targetObj.label,
        x: 0, 
        stackEl:stack, 
        eaten:0, 
        charIdx:idx, 
        name: customerNames[i]
    }); 
  }
}

// お客さんの座標計算
function updateCustomerCoordinates() {
    const belt=$('#belt'); 
    if (!belt || state.customers.length === 0 || !state.customers[0].el) return; 
    const gameRect = $('#game').getBoundingClientRect();
    state.customers.forEach((c, i)=>{
        const r=c.el.getBoundingClientRect();
        c.x = r.left + r.width/2 - gameRect.left; 
    });
}


// ===== 準備台UI更新（モード分岐） =====
function updatePrep(){
  const L=$('#prepLeft'), R=$('#prepRight'), H=$('#prepHint');
  const op = $('#prepOperator');

  // お寿司の絵をセットする関数
  const setSushi = (el, val) => {
      if(val == null){
          el.textContent='?'; el.classList.add('empty'); el.style.backgroundImage='none';
      } else {
          el.textContent=val; el.classList.remove('empty'); 
          el.style.backgroundImage = `url("${state.netaMap[val]}")`;
      }
  };

  setSushi(L, state.prepA);
  setSushi(R, state.prepB);

  // モードごとの表示微調整
  if (state.gameMode === 'normal') {
      op.classList.remove('hidden'); // 「×」を表示
      if(state.prepA==null) H.textContent='おすしを２つえらぼう'; 
      else if(state.prepB==null) H.textContent='もう１つえらぼう'; 
      else H.textContent='（できたら、タップしてね）'; 
  } else {
      op.classList.add('hidden'); // 「×」を隠す（数字を並べるため）
      if(state.prepA==null) H.textContent='こたえのすうじをえらぼう'; 
      else if(state.prepB==null) H.textContent='（できたら、タップしてね）'; 
      else H.textContent='（できたら、タップしてね）'; 
  }
}

function clearPrep(){ 
    state.prepA=null; state.prepB=null; 
    updatePrep(); 
}

// ★★★ handleTap (共通：お寿司パネルタップ) ★★★
function handleTap(n, el){
    if (!state.running && !state.trainingModeActive) return;

    // --- 特訓モード中の入力 ---
    if (state.trainingModeActive) {
        handleTrainingInput(n);
        el.classList.add('flash'); 
        setTimeout(() => el.classList.remove('flash'), 300);
        return;
    }

    // --- 通常ゲーム中の入力 ---
    if (state.prepHoldTimer) return;
    el.classList.add('flash'); 
    setTimeout(() => el.classList.remove('flash'), 300); 

    // 数字を埋めるロジック（共通化：左から埋める）
    if (state.prepA == null) { 
        state.prepA = n; 
        updatePrep(); 
        return; 
    }
    // 2つ目が空いている場合
    if (state.prepB == null) {
        state.prepB = n; 
        updatePrep();
        // 通常モードなら自動確定タイマー
        if (state.gameMode === 'normal') {
             if (state.prepHoldTimer) clearTimeout(state.prepHoldTimer); 
             state.prepHoldTimer = setTimeout(() => { 
                state.prepHoldTimer = null; 
            }, PREP_HOLD_MS);
        }
        return;
    }
    // 両方埋まっている場合、左を上書きして右を消す（やり直ししやすくする）
    state.prepA = n; state.prepB = null; 
    updatePrep();
}

// ★★★ 準備台タップ（送信） ★★★
$('#prepDish').addEventListener('click', ()=>{
  if(state.trainingModeActive) return; 
  if(!state.running) return;

  // モード①：2つの要素があるとき送信
  // モード②：1つでも要素があれば送信可能（1桁の答えがあるため）
  if (state.gameMode === 'normal') {
      if(state.prepA !== null && state.prepB !== null){
        state.pending.push({ type: 'normal', val: [state.prepA, state.prepB] });
        clearPrep();
        if(!state.busy) sendNext();
      }
  } else {
      // モード②（数字連結）
      if(state.prepA !== null) {
          // Aだけ、あるいはAとB
          const digit1 = state.prepA;
          const digit2 = state.prepB;
          let answerVal;
          if (digit2 === null) {
              answerVal = digit1; // 1桁
          } else {
              answerVal = parseInt(`${digit1}${digit2}`, 10); // 2桁連結
          }
          state.pending.push({ type: 'inverse', val: answerVal, visuals: [digit1, digit2] });
          clearPrep();
          if(!state.busy) sendNext();
      }
  }
});


// ★★★ sendNext (判定ロジック) ★★★
function sendNext(){
  if(state.pending.length===0 || state.busy) return;
  const item = state.pending.shift();
  state.busy=true; 

  let submittedValue;
  // 生成するお皿のビジュアル用
  let visualA, visualB; 

  if (item.type === 'normal') {
      // ①かけ算を作るモード
      const [a, b] = item.val;
      submittedValue = a * b;
      visualA = a; visualB = b;
      logDebug(`Dish(Normal): ${a} x ${b} = ${submittedValue}`);
  } else {
      // ②答えの数字を作るモード
      submittedValue = item.val;
      visualA = item.visuals[0];
      visualB = item.visuals[1]; // nullの可能性あり
      logDebug(`Dish(Inverse): Value = ${submittedValue}`);
  }
  
  // マッチするお客さんを探す
  let targetCustomer = null;
  let targetCustomerIndex = -1; 
  for (let i = state.customers.length - 1; i >= 0; i--) {
      const customer = state.customers[i];
      if (!customer || customer.x === 0) continue;
      
      const match = customer.target !== null && customer.target === submittedValue; 
      if (match && targetCustomer === null) { 
          targetCustomer = customer;
          targetCustomerIndex = i; 
      }
  }
  
  // 間違い判定
  if (targetCustomer === null) {
      state.mistakeCount++;
      if (state.mistakeCount >= MISTAKE_LIMIT && !state.trainingModeActive) { 
          startTrainingMode();
          state.busy = false; 
          return; 
      }
  } else {
      state.mistakeCount = 0;
  }

  const belt=$('#belt'); 
  const gameRect = $('#game').getBoundingClientRect(); 
  const prep=$('#prep'); 
  const prepRect=prep.getBoundingClientRect();

  // 皿エレメントを作成
  const dish=document.createElement('div'); dish.className='dish';
  const pair=document.createElement('div'); pair.className='pair';

  // 皿の中身の描画（共通：お寿司を並べる）
  const createMiniSushi = (v) => {
      const s=document.createElement('div'); s.className='mini-sushi'; 
      s.textContent=v;
      s.style.backgroundImage = `url("${state.netaMap[v]}")`;
      return s;
  };

  const s1 = createMiniSushi(visualA);
  pair.appendChild(s1);

  if (state.gameMode === 'normal') {
      // ×マークを挟む
      const gari=document.createElement('div'); gari.className='gari';
      const mul=document.createElement('span'); mul.className='mul'; mul.textContent='×';
      gari.appendChild(mul);
      pair.appendChild(gari);
      const s2 = createMiniSushi(visualB);
      pair.appendChild(s2);
  } else {
      // 数字を並べるだけ（隙間を少し開ける？）
      if (visualB !== null) {
          const s2 = createMiniSushi(visualB);
          pair.appendChild(s2);
      }
  }

  dish.appendChild(pair);

  // ハズレメッセージ
  if (!targetCustomer) {
      const missedMsgEl = document.createElement('span');
      missedMsgEl.className = 'missed-message';
      missedMsgEl.textContent = choice(missedMessages);
      dish.appendChild(missedMsgEl);
  }

  const startX = prepRect.left - gameRect.left; 
  const endX_full = -400; 
  const fullDurationMs = 6000; 

  dish.style.transform = `translate(${startX}px, -50%)`; 
  belt.appendChild(dish);
  void dish.offsetWidth; 

  if (targetCustomer) {
      // 当たりアニメーション
      const targetX = targetCustomer.x; 
      const distance = startX - targetX; 
      const fullDistance = startX - endX_full; 
      const speedFactor = 1.0 - (2 - targetCustomerIndex) * 0.15; 
      const baseDuration = fullDurationMs * (distance / fullDistance);
      const durationMs = Math.max(100, Math.round(baseDuration * speedFactor)); 
      
      dish.style.transition = `transform ${durationMs}ms linear`; 
      dish.style.transform = `translate(${targetX}px, -50%)`;     

      const arrivalTimer = setTimeout(() => {
          handleArrivalAtCustomer(targetCustomer, dish); 
          state.activeTimers.delete(arrivalTimer); 
      }, durationMs);
      state.activeTimers.add(arrivalTimer); 

  } else {
      // ハズレアニメーション
      dish.style.transition = `transform ${fullDurationMs}ms linear`; 
      dish.style.transform = `translate(${endX_full}px, -50%)`;    

      const endTimer = setTimeout(() => {
          try { dish.remove(); } catch(e) {}
          state.busy = false; 
          sendNext();
          state.activeTimers.delete(endTimer); 
      }, fullDurationMs);
      state.activeTimers.add(endTimer); 
  }
}

// 皿が客に到着
function handleArrivalAtCustomer(c, dishEl) {
  if(!dishEl.isConnected) return;
  
  c.target = null; // 一時的に無効化

  const computedStyle = window.getComputedStyle(dishEl);
  const transformMatrix = new DOMMatrix(computedStyle.transform);
  const currentX = transformMatrix.m41; 
  const currentY = transformMatrix.m42; 

  dishEl.style.transition = 'none'; 
  dishEl.style.transform = `translate(${currentX}px, ${currentY}px)`; 
  void dishEl.offsetWidth; 

  dishEl.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
  dishEl.style.transform = `translate(${currentX}px, ${currentY}px) scale(0.85)`; 
  dishEl.style.opacity = 0;

  const removeTimer = setTimeout(() => {
      try { dishEl.remove(); } catch(e) {}
      state.busy = false; 
      sendNext(); 
      state.activeTimers.delete(removeTimer); 
  }, 280); 
  state.activeTimers.add(removeTimer); 

  showPraise(c,true); 
  addPlateToStack(c);
  c.eaten = (c.eaten||0) + 1;
  state.score++; $('#score').textContent=state.score;

  if(c.eaten >= EAT_LIMIT){
      replaceCustomer(c);
  }
}

// 褒める＆次の注文
function showPraise(c, ok){
  if(!ok) return;
  const b=c.bubbleEl;
  b.classList.add('ok');
  b.textContent = choice(praiseWords);
  
  const praiseTimer = setTimeout(()=>{
    if(c.target === null && c.eaten < EAT_LIMIT){
      // 新しい注文
      const newTarget = makeTarget();
      c.target = newTarget.val;
      c.label = newTarget.label;

      b.classList.remove('ok');
      b.textContent = c.label;
    }
    state.activeTimers.delete(praiseTimer); 
  }, 1200); 
  state.activeTimers.add(praiseTimer); 

  c.el.animate([{transform:'translateY(0)'},{transform:'translateY(-2px)'},{transform:'translateY(0)'}],{duration:300, iterations:1});
}

// 客の交代
function replaceCustomer(c){
  let nextIdx;
  const candidates = [1,2,3,4,5,6,7,8,9,10].filter(i=>i!==c.charIdx);
  nextIdx = choice(candidates.length? candidates : [c.charIdx]);

  c.el.animate([{opacity:1},{opacity:0}], {duration:220, fill:'forwards'});
  
  const replaceTimer = setTimeout(()=>{
    const avatar = c.el.querySelector('.avatar');
    // ★修正: 変数名を idx から nextIdx に変更
    avatar.style.backgroundImage = `url("char/char${nextIdx}.png")`;
    c.stackEl.innerHTML = '';
    c.eaten = 0;
    
    // 新しい注文
    const newTarget = makeTarget();
    c.target = newTarget.val;
    c.label = newTarget.label;
    
    c.bubbleEl.classList.remove('ok'); 
    c.bubbleEl.textContent = c.label;
    c.charIdx = nextIdx;
    c.el.animate([{opacity:0},{opacity:1}], {duration:220, fill:'forwards'});
    state.activeTimers.delete(replaceTimer); 
  }, 220);
  state.activeTimers.add(replaceTimer); 
}

// 皿スタック
function addPlateToStack(cust){
  const p=document.createElement('div');
  p.className='plate-mini';
  cust.stackEl.appendChild(p);
}

// 記録更新
function updateRecord(){
  $('#best').textContent = Number(localStorage.getItem(bestKey)||state.best||0);
  $('#last').textContent = state.last||0;
}

// ===== 進行 =====
function beginGame(){
  logDebug(`--- beginGame (${state.gameMode}) ---`); 
  clearAllTimers(); 
  state.busy = false;
  state.pending = [];
  state.prepA = null;
  state.prepB = null;
  updatePrep();
  $$('.dish').forEach(o=>o.remove()); 
  const debugWindow = $('#debugWindow');
  if(debugWindow && !ALWAYS_SHOW_DEBUG) {
      debugWindow.innerHTML = "Debug Log:<br>"; 
  }
  $('#endMessageOverlay').classList.add('hidden');
  $('#finalPlateStacks').innerHTML = '';
  
  state.mistakeCount = 0;
  state.trainingModeActive = false;
  $('#trainingOverlay').classList.add('hidden');
  $('#game').classList.remove('training-active'); 

  // UI表示制御
  $('#hud').classList.remove('hidden'); 
  $('#customers').classList.remove('hidden'); 
  $('#belt').classList.remove('hidden'); 
  $('#prep').classList.remove('hidden'); 
  $('#record').classList.remove('hidden'); 
  $('#sushiBar').classList.remove('hidden');
  
  // モード別表示テキスト
  if (state.gameMode === 'normal') {
      $('#prepTitle').textContent = "おすしをにぎるよ";
  } else {
      $('#prepTitle').textContent = "こたえをにぎるよ";
  }

  pickCustomers();
  renderCustomers(); 

  $$('.bubble', $('#customers')).forEach(b=>b.classList.remove('hidden'));
  $('#btnResume').classList.remove('show');

  updateCustomerCoordinates(); 

  state.running=true; state.score=0;
  $('#score').textContent='0'; 
  state.timeLeft = 60; 
  $('#time').textContent=state.timeLeft;

  state.timerId=setInterval(()=>{
      if (state.trainingModeActive) return; 
      state.timeLeft--; 
      $('#time').textContent=state.timeLeft;
      if(state.timeLeft<=0) endGame();
  },1000);
}

function startGame(){
  logDebug("--- startGame ---"); 
  if(state.running || state.trainingModeActive) return; 
  state.started = true;
  
  // 選択されたモードを取得
  const modeRadios = document.getElementsByName('gameMode');
  for (const radio of modeRadios) {
      if (radio.checked) {
          state.gameMode = radio.value;
          break;
      }
  }

  $('#startOverlay').style.display='none';
  $('#endMessageOverlay').classList.add('hidden'); 
  $('#trainingOverlay').classList.add('hidden'); 
  beginGame();
}

function endGame(){
  logDebug("--- endGame ---"); 
  if(!state.running) return;
  state.running=false; 
  clearAllTimers(); 

  state.last=state.score; const prevBest=Number(localStorage.getItem(bestKey)||0);
  state.best=Math.max(prevBest,state.last); localStorage.setItem(bestKey,String(state.best)); updateRecord();

  $$('.dish').forEach(o=>o.remove());
  state.busy=false; state.pending.length=0;

  $('#customers').classList.add('hidden'); 
  $$('.bubble', $('#customers')).forEach(b=>b.classList.add('hidden'));

  $('#finalScore').textContent = state.score;
  
  const feedbackEl = $('#endFeedbackMessage');
  let feedbackMessage = "";
  if (state.last >= 20) feedbackMessage = "すごい！てんさい！";
  else if (state.last >= 15) feedbackMessage = "とってもいいね！";
  else if (state.last >= 10) feedbackMessage = "いいね！";
  else if (state.last >= 5) feedbackMessage = "がんばったね！";
  else feedbackMessage = "もうすこし がんばってみよう！";
  feedbackEl.textContent = feedbackMessage;

  // 皿スタック生成
  const stackContainer = $('#finalPlateStacks');
  stackContainer.innerHTML = ''; 
  const numStacks = Math.floor(state.score / 5);
  const remainingPlates = state.score % 5;
  for(let i = 0; i < numStacks; i++) {
      const stackDiv = document.createElement('div');
      stackDiv.className = 'final-plate-stack';
      for (let j = 0; j < 5; j++) {
          const plateDiv = document.createElement('div');
          plateDiv.className = 'final-plate-mini';
          stackDiv.appendChild(plateDiv);
      }
      stackContainer.appendChild(stackDiv);
  }
  if (remainingPlates > 0) {
      const stackDiv = document.createElement('div');
      stackDiv.className = 'final-plate-stack';
      for (let j = 0; j < remainingPlates; j++) {
          const plateDiv = document.createElement('div');
          plateDiv.className = 'final-plate-mini';
          stackDiv.appendChild(plateDiv);
      }
      stackContainer.appendChild(stackDiv);
  }

  $('#endMessageOverlay').classList.remove('hidden'); 
  $('#btnResume').classList.add('show');
}

function resumeGame(){
  logDebug("--- Back to Title ---");
  // 終了フラグなどを念のためクリア
  state.running = false;
  state.trainingModeActive = false;
  
  // UIリセット（ゲーム画面の要素を隠す）
  $('#endMessageOverlay').classList.add('hidden');
  $('#hud').classList.add('hidden');
  $('#customers').classList.add('hidden');
  $('#belt').classList.add('hidden');
  $('#prep').classList.add('hidden');
  $('#record').classList.add('hidden');
  $('#sushiBar').classList.add('hidden');
  
  // 皿の掃除
  $$('.dish').forEach(o=>o.remove());
  
  // タイトル表示
  $('#startOverlay').style.display = 'flex';
}

// ★★★ 親方モード関連 ★★★

function startTrainingMode() {
    state.trainingModeActive = true;
    state.running = false; 
    clearAllTimers(); 
    state.trainingCorrectCount = 0;
    state.currentTrainingInput = "";

    $('#game').classList.add('training-active'); 
    $('#hud').classList.add('hidden');
    // お寿司バーは使うので表示したままにするが、オーバーレイの下になるようにCSS調整済み
    // ただし z-index に注意。お寿司バーは z-index:1。オーバーレイは 20。
    // 特訓中はお寿司バーを操作したいので、入力を handleTrainingInput でさばく
    
    if (!ALWAYS_SHOW_DEBUG) $('#debugWindow').style.display = 'none';

    $('#trainingOverlay').classList.remove('hidden');
    
    $('#trainingMessage').textContent = 'まちがえすぎじゃ！\nとっくんじゃ！';
    $('#trainingFeedback').textContent = ''; 

    generateTrainingProblem(); 
}

function generateTrainingProblem() {
    if (state.trainingCorrectCount >= TRAINING_GOAL) {
        endTrainingMode();
        return;
    }
    const a = 1 + rand(9);
    const b = 1 + rand(9);
    state.currentTrainingProblem = { a, b, answer: a * b };
    state.currentTrainingInput = ""; 
    $('#trainingProblem').textContent = `${a} x ${b} = ?`;
    $('#trainingFeedback').textContent = `のこり ${TRAINING_GOAL - state.trainingCorrectCount} もん`; 
}

// 特訓モード用入力ハンドラ
function handleTrainingInput(n) {
    state.currentTrainingInput += String(n);
    $('#trainingProblem').textContent = `${state.currentTrainingProblem.a} x ${state.currentTrainingProblem.b} = ${state.currentTrainingInput}`; 

    // 答えの桁数チェック
    const ansStr = String(state.currentTrainingProblem.answer);
    if (state.currentTrainingInput.length >= ansStr.length) {
        checkTrainingAnswer();
    }
}

function checkTrainingAnswer() {
    const answer = state.currentTrainingProblem.answer;
    const userAnswer = parseInt(state.currentTrainingInput, 10);
    const feedbackEl = $('#trainingFeedback');

    if (userAnswer === answer) {
        state.trainingCorrectCount++;
        feedbackEl.textContent = choice(trainingCorrectFeedback); 
        feedbackEl.style.color = '#a3e635'; 
        
        const nextProbTimer = setTimeout(() => {
            generateTrainingProblem();
            state.activeTimers.delete(nextProbTimer);
        }, 1000); 
        state.activeTimers.add(nextProbTimer);
        
    } else {
        feedbackEl.textContent = choice(trainingIncorrectFeedback); 
        feedbackEl.style.color = '#facc15'; 
        state.currentTrainingInput = ""; 
        $('#trainingProblem').textContent = `${state.currentTrainingProblem.a} x ${state.currentTrainingProblem.b} = ?`; 
    }
}

function endTrainingMode() {
    $('#trainingMessage').textContent = 'もう一度、みせびらきじゃ！';
    $('#trainingProblem').textContent = '';
    $('#trainingFeedback').textContent = `よく がんばった！ (${state.trainingCorrectCount}/${TRAINING_GOAL})`;
    
    const returnTimer = setTimeout(() => {
        state.trainingModeActive = false; 
        $('#trainingOverlay').classList.add('hidden'); 
        
        // タイトル画面へ戻る
        $('#startOverlay').style.display = 'flex'; 
        $('#hud').classList.add('hidden'); 
        $('#game').classList.remove('training-active'); 
        
        state.activeTimers.delete(returnTimer);
    }, 3000); 
    state.activeTimers.add(returnTimer);
}

// ===== 起動 =====
function init(){
  logDebug("--- init ---"); 
  
  if (ALWAYS_SHOW_DEBUG) {
      const debugWindow = $('#debugWindow');
      if (debugWindow) debugWindow.style.display = 'block';
  }

  buildNetaMap();
  pickCustomers();
  renderCustomers(); 
  renderSushiBar();
  updateRecord();
  updatePrep();

  $('#btnStartCenter').addEventListener('click', startGame);
  $('#btnResume').addEventListener('click', resumeGame);

  // ★★★ 設定ボタン系イベント ★★★
  const settingOverlay = $('#settingOverlay');
  const btnDetail = $('#btnMode2Detail');
  const btnClose = $('#btnSettingClose');

  if(btnDetail) {
    btnDetail.addEventListener('click', (e) => {
      e.stopPropagation();
      // モード2を選択状態にする
      const radio2 = document.querySelector('input[value="inverse"]');
      if(radio2) radio2.checked = true;
      settingOverlay.classList.remove('hidden');
    });
  }

  if(btnClose) {
    btnClose.addEventListener('click', () => {
      // チェックボックスの状態を state.selectedDans に保存
      const checks = settingOverlay.querySelectorAll('input[type="checkbox"]');
      const newDans = [];
      checks.forEach(ch => {
        if(ch.checked) newDans.push(parseInt(ch.value, 10));
      });

      // 1つもチェックがない場合はアラート等出すか、全部有効にするか
      if(newDans.length === 0) {
        alert("どれかひとつは 選んでね！");
        return;
      }

      state.selectedDans = newDans;
      settingOverlay.classList.add('hidden');
    });
  }

  // デバッグ用長押し
  const timerArea = $('.timer');
  if (timerArea) {
      timerArea.addEventListener('mousedown', handleDebugPressStart);
      timerArea.addEventListener('mouseup', handleDebugPressEnd);
      timerArea.addEventListener('mouseleave', handleDebugPressEnd); 
      timerArea.addEventListener('touchstart', handleDebugPressStart, { passive: false });
      timerArea.addEventListener('touchend', handleDebugPressEnd);
      timerArea.addEventListener('touchcancel', handleDebugPressEnd); 
  }

  window.addEventListener('resize', ()=>{
    layoutSushiBarSizes();
    if (!state.trainingModeActive) { 
        updateCustomerCoordinates(); 
    }
  });
  
  updateCustomerCoordinates(); 
  setTimeout(updateCustomerCoordinates, 100); 
}

init();