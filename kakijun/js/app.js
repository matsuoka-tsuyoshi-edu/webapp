/**
 * アプリケーションメイン制御 (v0.3.0)
 * - クイズ画面：上中央に大きな単語、横に絵文字ボックス、下中央に特大手書き枠、左下に応援
 * - 練習画面（没頭フロー）：1→2→3回目を止まらず書いて、2・3回目は空きエリアに過去回の単語＋文字をミニ表示
 * - 先生マル付け画面：横書き1・2・3回目を縦に並べて順番にマル付け。❌はタップで単語の中から1箇所ずつ直し
 */
(function (global) {
  'use strict';

  const Kakijun = (global.Kakijun = global.Kakijun || {});

  const state = {
    mode: 'hiragana',
    settings: {
      guideMode: true,
      questionCount: 3,
      quizJudge: 'shape',
      strictness: 'easy'
    },
    questions: [],
    currentIndex: 0,
    practiceStep: 0, // 0, 1, 2
    practiceAttempts: [
      { strokes: [], result: null },
      { strokes: [], result: null },
      { strokes: [], result: null }
    ],
    repairMode: false,
    repairIndex: -1,
    quizSolved: false,
    isFirstHiraganaRun: true,
    busy: false,
    reviewTimers: []
  };

  let quizCanvas = null;
  let practiceCanvas = null;

  function $(id) {
    return document.getElementById(id);
  }

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(function (el) {
      el.classList.remove('active');
    });
    const target = $('screen-' + name);
    if (target) target.classList.add('active');

    const inGame = name === 'quiz' || name === 'practice' || name === 'review';
    $('btn-home').classList.toggle('hidden', name === 'home');
    $('progress-badge').classList.toggle('hidden', !inGame);

    global.requestAnimationFrame(function () {
      if (name === 'quiz' && quizCanvas) quizCanvas.resize();
      if (name === 'practice' && practiceCanvas) practiceCanvas.resize();
    });
  }

  function updateProgressBadge() {
    $('progress-text').textContent = (state.currentIndex + 1) + ' / ' + state.questions.length + ' もんめ';
  }

  function updateHomeBadges() {
    $('home-guide-badge').textContent = '🌟 ガイドモード：' + (state.settings.guideMode ? 'ON' : 'OFF');
    $('home-qcount').textContent = String(state.settings.questionCount);
  }

  function isKanjiType(tp) {
    return tp && tp.indexOf('kanji') === 0;
  }

  function buildQuestionSet(mode, count) {
    if (mode === 'mixed') {
      const types = ['hiragana', 'katakana', 'kanji1', 'kanji2', 'kanji3'];
      for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = types[i];
        types[i] = types[j];
        types[j] = tmp;
      }
      const picked = [];
      let tIdx = 0;
      const usedTargets = new Set();
      while (picked.length < count) {
        const t = types[tIdx % types.length];
        const candidates = Kakijun.WORDS.filter(function (w) {
          return w.type === t && !usedTargets.has(w.target);
        });
        if (candidates.length > 0) {
          const item = candidates[Math.floor(Math.random() * candidates.length)];
          usedTargets.add(item.target);
          picked.push(item);
        }
        tIdx++;
        if (tIdx > 40) break;
      }
      return picked;
    }

    const pool = Kakijun.WORDS.filter(function (w) {
      return w.type === mode;
    });

    const byChar = {};
    pool.forEach(function (item) {
      if (!byChar[item.target]) byChar[item.target] = [];
      byChar[item.target].push(item);
    });

    const chars = Object.keys(byChar);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }

    const picked = [];
    if (mode === 'hiragana' && state.isFirstHiraganaRun) {
      state.isFirstHiraganaRun = false;
      const akachan = pool.find(function (w) { return w.word === 'あかちゃん'; });
      if (akachan) {
        picked.push(akachan);
        const idx = chars.indexOf('あ');
        if (idx !== -1) chars.splice(idx, 1);
      }
    }

    for (let i = 0; i < chars.length && picked.length < count; i++) {
      const list = byChar[chars[i]];
      const item = list[Math.floor(Math.random() * list.length)];
      picked.push(item);
    }
    return picked;
  }

  function renderQuizWordTiles(container, item, filled) {
    container.innerHTML = '';
    const chars = Array.from(item.word);
    container.classList.toggle('is-long-word', chars.length >= 6);
    chars.forEach(function (ch, idx) {
      const span = document.createElement('span');
      span.className = 'char-tile';
      if (idx === item.blankIndex) {
        if (item.reading) {
          span.classList.add('has-ruby');
          const ruby = document.createElement('span');
          ruby.className = 'tile-ruby';
          ruby.textContent = item.reading;
          const main = document.createElement('span');
          main.className = 'tile-main';
          main.textContent = filled ? ch : '□';
          span.appendChild(ruby);
          span.appendChild(main);
        } else {
          span.textContent = filled ? ch : '□';
        }
        span.classList.add(filled ? 'is-filled' : 'is-blank');
      } else {
        span.textContent = ch;
      }
      container.appendChild(span);
    });
  }

  function renderPracticeWordStage(item) {
    const stage = $('practice-word-stage');
    const wrapper = $('practice-canvas-wrapper');

    stage.querySelectorAll('.practice-fixed-char, .practice-fixed-phrase').forEach(function (el) {
      el.remove();
    });

    const chars = Array.from(item.word);
    stage.classList.remove('len-2', 'len-3', 'len-4', 'len-5', 'len-6');
    stage.classList.add('len-' + Math.min(6, Math.max(2, chars.length)));

    if (isKanjiType(item.type)) {
      const before = chars.slice(0, item.blankIndex).join('');
      const after = chars.slice(item.blankIndex + 1).join('');
      if (before) {
        const div = document.createElement('div');
        div.className = before.length === 1 ? 'practice-fixed-char' : 'practice-fixed-phrase';
        div.textContent = before;
        stage.insertBefore(div, wrapper);
      }
      if (after) {
        const div = document.createElement('div');
        div.className = after.length === 1 ? 'practice-fixed-char' : 'practice-fixed-phrase';
        div.textContent = after;
        stage.appendChild(div);
      }
      return;
    }

    for (let i = 0; i < item.blankIndex; i++) {
      const div = document.createElement('div');
      div.className = 'practice-fixed-char';
      div.textContent = chars[i];
      stage.insertBefore(div, wrapper);
    }

    for (let i = item.blankIndex + 1; i < chars.length; i++) {
      const div = document.createElement('div');
      div.className = 'practice-fixed-char';
      div.textContent = chars[i];
      stage.appendChild(div);
    }
  }

  /**
   * 練習2回目・3回目の右上空きエリアに、過去回の「単語＋書いた文字」を小さく表示
   */
  function renderPreviousMiniList(item, upToCount) {
    const ph = $('practice-prev-placeholder');
    const list = $('practice-prev-list');
    list.innerHTML = '';

    if (upToCount <= 0 || state.repairMode) {
      ph.classList.remove('hidden');
      list.classList.add('hidden');
      ph.innerHTML = state.repairMode
        ? '<span>まちがえなおし！<br>ていねいに かいてみよう✨</span>'
        : '<span>1かいめ → 2かいめ → 3かいめ<br>つづけて かいてみよう！</span>';
      return;
    }

    ph.classList.add('hidden');
    list.classList.remove('hidden');

    const chars = Array.from(item.word);
    const before = chars.slice(0, item.blankIndex).join('');
    const after = chars.slice(item.blankIndex + 1).join('');

    for (let stepIdx = 0; stepIdx < upToCount; stepIdx++) {
      const row = document.createElement('div');
      row.className = 'prev-mini-row';

      const tag = document.createElement('span');
      tag.className = 'prev-mini-tag';
      tag.textContent = (stepIdx + 1) + 'かいめ';
      row.appendChild(tag);

      const wordWrap = document.createElement('div');
      wordWrap.className = 'mini-word-inline';

      if (before) {
        const spB = document.createElement('span');
        spB.className = 'mini-inline-char';
        spB.textContent = before;
        wordWrap.appendChild(spB);
      }
      const cv = document.createElement('canvas');
      cv.className = 'mini-inline-canvas';
      cv.width = 76;
      cv.height = 76;
      Kakijun.HandwritingCanvas.drawStrokesToCanvas(cv, state.practiceAttempts[stepIdx].strokes);
      wordWrap.appendChild(cv);
      if (after) {
        const spA = document.createElement('span');
        spA.className = 'mini-inline-char';
        spA.textContent = after;
        wordWrap.appendChild(spA);
      }

      row.appendChild(wordWrap);
      list.appendChild(row);
    }
  }

  function setFeedback(el, text, statusClass) {
    el.classList.remove('is-success', 'is-retry');
    if (statusClass) el.classList.add(statusClass);
    el.querySelector('.feedback-text').textContent = text;
  }

  function updateLiveSupport(screenKey, strokes) {
    const item = state.questions[state.currentIndex];
    if (!item) return;
    if (screenKey === 'quiz' && state.quizSolved) return;

    const msg = Kakijun.Recognizer.getLiveSupport(strokes, item.target);
    const el = $(screenKey === 'quiz' ? 'quiz-feedback' : 'practice-feedback');
    setFeedback(el, msg, null);
  }

  function runJudgeAnimation(prefix, isOk, onAfterMark) {
    state.busy = true;
    const overlay = $(prefix + '-judge-overlay');
    const banner = $(prefix + '-judge-banner');
    const mark = $(prefix + '-judge-mark');

    banner.textContent = 'はんてい！！';
    mark.textContent = '';
    mark.classList.add('hidden');
    overlay.classList.remove('hidden');

    Kakijun.Sound.judgeDrum();

    global.setTimeout(function () {
      mark.textContent = isOk ? '⭕' : '❌';
      mark.classList.remove('hidden');
      if (isOk) {
        Kakijun.Sound.correct();
      } else {
        Kakijun.Sound.wrong();
      }

      global.setTimeout(function () {
        overlay.classList.add('hidden');
        state.busy = false;
        if (onAfterMark) onAfterMark();
      }, 880);
    }, 480);
  }

  function syncDemoUi(prefix, isDemo) {
    const demoBtn = $('btn-' + prefix + '-demo');
    if (demoBtn) {
      demoBtn.textContent = isDemo ? '✏️ かく' : '👀 おてほん';
      demoBtn.classList.toggle('is-write-mode', isDemo);
    }

    if (prefix === 'quiz') {
      if (state.quizSolved) return;
      $('btn-quiz-undo').classList.toggle('hidden', isDemo);
      $('btn-quiz-clear').classList.toggle('hidden', isDemo);
      $('btn-quiz-submit').classList.toggle('hidden', isDemo);
      if (isDemo) {
        setFeedback($('quiz-feedback'), 'おてほんを よく みてね！ みおわったら「✏️ かく」を おそう✨', null);
      } else {
        updateLiveSupport('quiz', quizCanvas.getStrokes());
      }
    } else if (prefix === 'practice') {
      const isSubmitMode = state.repairMode || state.practiceStep === 2;
      $('btn-practice-undo').classList.toggle('hidden', isDemo);
      $('btn-practice-clear').classList.toggle('hidden', isDemo);
      $('btn-practice-next-write').classList.toggle('hidden', isDemo || isSubmitMode);
      $('btn-practice-submit').classList.toggle('hidden', isDemo || !isSubmitMode);
      if (isDemo) {
        setFeedback($('practice-feedback'), 'いろの じゅんばんを みてね！ みおわったら「✏️ かく」を おそう✨', null);
      } else {
        updateLiveSupport('practice', practiceCanvas.getStrokes());
      }
    }
  }

  // =========================================================
  // ステップ1：クイズ画面
  // =========================================================
  function startQuizForCurrent() {
    const item = state.questions[state.currentIndex];
    state.quizSolved = false;
    state.busy = false;

    updateProgressBadge();
    renderQuizWordTiles($('quiz-word-chars'), item, false);

    $('quiz-reveal-placeholder').classList.remove('hidden');
    $('quiz-reveal-answer').classList.add('hidden');
    $('quiz-reveal-emoji').textContent = item.emoji;
    $('quiz-reveal-word').textContent = item.word;

    const quizRuby = $('quiz-ruby-badge');
    if (item.reading) {
      quizRuby.textContent = item.reading;
      quizRuby.classList.remove('hidden');
    } else {
      quizRuby.classList.add('hidden');
    }

    $('btn-quiz-demo').classList.remove('hidden');
    $('btn-quiz-demo').textContent = '👀 おてほん';
    $('btn-quiz-demo').classList.remove('is-write-mode');
    $('btn-quiz-submit').classList.remove('hidden');
    $('btn-quiz-undo').classList.remove('hidden');
    $('btn-quiz-clear').classList.remove('hidden');
    $('btn-quiz-next').classList.add('hidden');

    const guideMsg = state.settings.guideMode
      ? '●（まる）から ゆびで なぞってみよう！ できるかな？✨'
      : '□に はいる もじを ゆびで かいてみよう！✨';
    setFeedback($('quiz-feedback'), guideMsg, null);

    showScreen('quiz');

    quizCanvas.reset();
    quizCanvas.setConfig({
      targetChar: item.target,
      guideMode: state.settings.guideMode,
      guideOpacity: state.settings.guideMode ? 0.34 : 0,
      showStartDot: state.settings.guideMode,
      showLeadGuide: state.settings.guideMode,
      locked: false
    });
    quizCanvas.startPulse();
  }

  function handleQuizSubmit() {
    if (state.busy || state.quizSolved) return;
    const item = state.questions[state.currentIndex];
    if (!quizCanvas.hasDrawing()) {
      setFeedback($('quiz-feedback'), 'まだ かいてないよ！ ゆびで 1せん かいてみよう✨', 'is-retry');
      Kakijun.Sound.wrong();
      return;
    }

    if (state.settings.quizJudge === 'none') {
      completeQuizSuccess(item, 'よく かけたね！ 「' + item.word + '」の かんせい✨');
      return;
    }

    const res = Kakijun.Recognizer.evaluate(quizCanvas.getStrokes(), item.target, {
      checkOrder: false,
      strictness: state.settings.strictness,
      isFreehand: !state.settings.guideMode
    });

    runJudgeAnimation('quiz', res.ok, function () {
      if (res.ok) {
        completeQuizSuccess(item, 'やったね！ 「' + item.word + '」が でたよ✨');
      } else {
        setFeedback($('quiz-feedback'), res.message, 'is-retry');
      }
    });
  }

  function completeQuizSuccess(item, msg) {
    state.quizSolved = true;
    quizCanvas.setConfig({ locked: true });
    quizCanvas.stopPulse();

    renderQuizWordTiles($('quiz-word-chars'), item, true);
    $('quiz-reveal-placeholder').classList.add('hidden');
    $('quiz-reveal-answer').classList.remove('hidden');

    setFeedback($('quiz-feedback'), msg, 'is-success');

    $('btn-quiz-demo').classList.add('hidden');
    $('btn-quiz-submit').classList.add('hidden');
    $('btn-quiz-undo').classList.add('hidden');
    $('btn-quiz-clear').classList.add('hidden');
    $('btn-quiz-next').classList.remove('hidden');

    if (state.settings.quizJudge === 'none') {
      Kakijun.Sound.correct();
    }
    global.setTimeout(function () {
      Kakijun.Sound.speak(item.speakText || item.word);
    }, 300);
  }

  // =========================================================
  // ステップ2：書き没頭フェーズ（1→2→3回目）＆ 間違い直しモード
  // =========================================================
  function startPracticeForCurrent() {
    state.repairMode = false;
    state.repairIndex = -1;
    state.practiceAttempts = [
      { strokes: [], result: null },
      { strokes: [], result: null },
      { strokes: [], result: null }
    ];
    state.busy = false;

    setupPracticeCommonHeader();
    showScreen('practice');
    setupPracticeStep(0);
  }

  function setupPracticeCommonHeader() {
    const item = state.questions[state.currentIndex];
    const chars = Array.from(item.word);
    const blankText = chars.map(function (ch, idx) {
      return idx === item.blankIndex ? '□' : ch;
    }).join(isKanjiType(item.type) ? '' : ' ');

    $('practice-emoji').textContent = item.emoji;
    $('practice-prompt-blank').textContent = blankText;
    $('practice-prompt-reading').textContent = '（' + (item.reading || item.word) + '）';

    const pRuby = $('practice-ruby-badge');
    if (item.reading) {
      pRuby.textContent = item.reading;
      pRuby.classList.remove('hidden');
    } else {
      pRuby.classList.add('hidden');
    }
    renderPracticeWordStage(item);
  }

  function setupPracticeStep(stepIdx) {
    state.practiceStep = stepIdx;
    const item = state.questions[state.currentIndex];

    const stepConfigs = [
      {
        label: 'カラーおてほん あり（●ガイド）',
        guideOpacity: state.settings.guideMode ? 0.34 : 0.24,
        showStartDot: state.settings.guideMode,
        showLeadGuide: state.settings.guideMode,
        hint: '1かいめ！ いろの じゅんばんに ●から なぞってみよう✨'
      },
      {
        label: 'もっと うすい おてほん',
        guideOpacity: 0.15, // 1回目より薄いカラーガイド
        showStartDot: state.settings.guideMode,
        showLeadGuide: false,
        hint: '2かいめ！ うすい いろを たよりに かいてみよう✨'
      },
      {
        label: 'おてほん なし！',
        guideOpacity: 0,
        showStartDot: false,
        showLeadGuide: false,
        hint: '3かいめ！ なにも みないで かけるかな？ チャレンジ✨'
      }
    ];

    const cfg = stepConfigs[stepIdx];
    if (state.repairMode) {
      $('practice-step-pill').textContent = (stepIdx + 1) + 'かいめ なおし';
      $('practice-step-label').textContent = cfg.label;
      setFeedback($('practice-feedback'), (stepIdx + 1) + 'かいめ の なおし！ 単語の なかで もういちど かこう✨', null);
    } else {
      $('practice-step-pill').textContent = 'れんしゅう ' + (stepIdx + 1) + '/3';
      $('practice-step-label').textContent = cfg.label;
      setFeedback($('practice-feedback'), cfg.hint, null);
    }

    renderPreviousMiniList(item, stepIdx);

    $('btn-practice-undo').classList.remove('hidden');
    $('btn-practice-clear').classList.remove('hidden');
    $('btn-practice-demo').classList.remove('hidden');
    $('btn-practice-demo').textContent = '👀 おてほん';
    $('btn-practice-demo').classList.remove('is-write-mode');

    // 1・2回目は「つぎへ」、3回目（または間違い直し）は「できた！」
    const isSubmitMode = state.repairMode || stepIdx === 2;
    $('btn-practice-next-write').classList.toggle('hidden', isSubmitMode);
    $('btn-practice-submit').classList.toggle('hidden', !isSubmitMode);

    practiceCanvas.reset();
    practiceCanvas.resize();
    practiceCanvas.setConfig({
      targetChar: item.target,
      guideMode: state.settings.guideMode && (cfg.showStartDot || cfg.showLeadGuide),
      guideOpacity: cfg.guideOpacity,
      showStartDot: cfg.showStartDot,
      showLeadGuide: cfg.showLeadGuide,
      locked: false
    });
    practiceCanvas.startPulse();
  }

  /**
   * 1・2回目の「つぎへ ➡️」：判定を挟まずスムーズに次の枠へ！
   */
  function handlePracticeNextWrite() {
    if (state.busy) return;
    if (!practiceCanvas.hasDrawing()) {
      setFeedback($('practice-feedback'), 'まだ かいてないよ！ ゆびで かいてから「つぎへ」をおそう✨', 'is-retry');
      Kakijun.Sound.wrong();
      return;
    }

    Kakijun.Sound.tap();
    state.practiceAttempts[state.practiceStep].strokes = practiceCanvas.getStrokes();
    setupPracticeStep(state.practiceStep + 1);
  }

  /**
   * 3回目「できた！」→ まとめて先生マル付け画面へ！
   * または、間違い直しモード「できた！」→ その1箇所を判定してマル付け画面へ戻る！
   */
  function handlePracticeSubmit() {
    if (state.busy) return;
    const item = state.questions[state.currentIndex];
    if (!practiceCanvas.hasDrawing()) {
      setFeedback($('practice-feedback'), 'まだ かいてないよ！ ゆびで かいてみよう✨', 'is-retry');
      Kakijun.Sound.wrong();
      return;
    }

    if (state.repairMode) {
      const idx = state.repairIndex;
      const strokes = practiceCanvas.getStrokes();
      const res = Kakijun.Recognizer.evaluate(strokes, item.target, {
        checkOrder: true,
        strictness: state.settings.strictness,
        isFreehand: idx === 2
      });

      runJudgeAnimation('practice', res.ok, function () {
        if (res.ok) {
          state.practiceAttempts[idx].strokes = strokes;
          state.practiceAttempts[idx].result = res;
          state.repairMode = false;
          state.repairIndex = -1;
          practiceCanvas.stopPulse();
          showReviewScreen(false); // 既にマル付け済みなので即座に更新表示
        } else {
          setFeedback($('practice-feedback'), res.message, 'is-retry');
        }
      });
      return;
    }

    // 3回目完了 → 保存してまとめてマル付け画面へ！
    Kakijun.Sound.tap();
    state.practiceAttempts[2].strokes = practiceCanvas.getStrokes();
    practiceCanvas.stopPulse();

    // 1・2・3回目をまとめて採点
    for (let i = 0; i < 3; i++) {
      state.practiceAttempts[i].result = Kakijun.Recognizer.evaluate(
        state.practiceAttempts[i].strokes,
        item.target,
        {
          checkOrder: true,
          strictness: state.settings.strictness,
          isFreehand: i === 2
        }
      );
    }

    showReviewScreen(true);
  }

  // =========================================================
  // ステップ3：せんせいの まとめてマル付け画面
  // =========================================================
  function showReviewScreen(animateStamps) {
    const item = state.questions[state.currentIndex];
    const chars = Array.from(item.word);

    $('review-word-badge').textContent = item.emoji + ' ' + item.word;
    $('btn-review-proceed').classList.add('hidden');

    const rowsContainer = $('review-rows');
    rowsContainer.innerHTML = '';

    const subHints = ['うすい おてほん', 'もっと うすい', 'おてほん なし'];

    state.practiceAttempts.forEach(function (att, idx) {
      const row = document.createElement('div');
      row.className = 'review-row';
      row.dataset.step = String(idx);

      // 1. 回数ラベル
      const labelCol = document.createElement('div');
      labelCol.className = 'review-step-label';
      labelCol.innerHTML =
        '<span class="review-num-badge">' + (idx + 1) + 'かいめ</span>' +
        '<span class="review-sub-hint">' + subHints[idx] + '</span>';
      row.appendChild(labelCol);

      // 2. 横書き単語＋書いた文字のミニ枠
      const wordCol = document.createElement('div');
      wordCol.className = 'review-word-inline';
      if (isKanjiType(item.type)) {
        const before = chars.slice(0, item.blankIndex).join('');
        const after = chars.slice(item.blankIndex + 1).join('');
        if (before) {
          const boxB = document.createElement('div');
          boxB.className = before.length === 1 ? 'review-char-box' : 'review-phrase-box';
          boxB.textContent = before;
          wordCol.appendChild(boxB);
        }
        const cv = document.createElement('canvas');
        cv.className = 'review-drawn-canvas';
        cv.width = 160;
        cv.height = 160;
        Kakijun.HandwritingCanvas.drawStrokesToCanvas(cv, att.strokes);
        wordCol.appendChild(cv);
        if (after) {
          const boxA = document.createElement('div');
          boxA.className = after.length === 1 ? 'review-char-box' : 'review-phrase-box';
          boxA.textContent = after;
          wordCol.appendChild(boxA);
        }
      } else {
        chars.forEach(function (ch, cIdx) {
          if (cIdx === item.blankIndex) {
            const cv = document.createElement('canvas');
            cv.className = 'review-drawn-canvas';
            cv.width = 160;
            cv.height = 160;
            Kakijun.HandwritingCanvas.drawStrokesToCanvas(cv, att.strokes);
            wordCol.appendChild(cv);
          } else {
            const box = document.createElement('div');
            box.className = 'review-char-box';
            box.textContent = ch;
            wordCol.appendChild(box);
          }
        });
      }
      row.appendChild(wordCol);

      // 3. 先生コメント
      const commentCol = document.createElement('div');
      commentCol.className = 'review-comment';
      commentCol.textContent = animateStamps ? 'まるつけ中…' : att.result.message;
      row.appendChild(commentCol);

      // 4. スタンプ＆直しボタン
      const stampCol = document.createElement('div');
      stampCol.className = 'review-stamp-area';
      const stamp = document.createElement('div');
      stamp.className = 'review-stamp';
      stamp.textContent = animateStamps ? '' : (att.result.ok ? '⭕' : '❌');
      stampCol.appendChild(stamp);

      const fixBtn = document.createElement('button');
      fixBtn.type = 'button';
      fixBtn.className = 'btn-fix-pill hidden';
      fixBtn.textContent = '✏️ なおす！';
      stampCol.appendChild(fixBtn);

      row.appendChild(stampCol);

      // ❌行のタップでまちがえなおしへ
      row.addEventListener('click', function () {
        if (state.busy) return;
        if (!att.result || att.result.ok) return;
        Kakijun.Sound.tap();
        enterRepairMode(idx);
      });

      rowsContainer.appendChild(row);
    });

    showScreen('review');

    if (animateStamps) {
      runSequentialGrading();
    } else {
      // 直し後の再表示はすぐ結果を反映
      state.practiceAttempts.forEach(function (att, idx) {
        applyRowResult(idx, att.result, false);
      });
      finalizeReviewSummary();
    }
  }

  function applyRowResult(idx, res, playSound) {
    const row = document.querySelector('#review-rows .review-row[data-step="' + idx + '"]');
    if (!row) return;

    row.classList.remove('is-ok', 'is-ng');
    row.classList.add(res.ok ? 'is-ok' : 'is-ng');
    row.querySelector('.review-comment').textContent = res.message;
    row.querySelector('.review-stamp').textContent = res.ok ? '⭕' : '❌';
    row.querySelector('.btn-fix-pill').classList.toggle('hidden', res.ok);

    if (playSound) {
      if (res.ok) Kakijun.Sound.correct();
      else Kakijun.Sound.wrong();
    }
  }

  function clearReviewTimers() {
    state.reviewTimers.forEach(function (id) {
      global.clearTimeout(id);
    });
    state.reviewTimers = [];
  }

  function runSequentialGrading() {
    clearReviewTimers();
    state.busy = true;
    $('review-banner').textContent = 'せんせいが まるつけ するよ！ どれどれ…？';
    $('review-support-text').textContent = '1かいめ から じゅんばんに みてみよう✨';

    [0, 1, 2].forEach(function (idx) {
      const tid = global.setTimeout(function () {
        applyRowResult(idx, state.practiceAttempts[idx].result, true);
        if (idx === 2) {
          state.busy = false;
          finalizeReviewSummary();
        }
      }, 380 + idx * 460);
      state.reviewTimers.push(tid);
    });
  }

  function finalizeReviewSummary() {
    const ngCount = state.practiceAttempts.filter(function (a) {
      return !a.result || !a.result.ok;
    }).length;

    const proceedBtn = $('btn-review-proceed');
    if (ngCount === 0) {
      $('review-banner').textContent = '💮 ぜんぶ まる！！ すばらしい！！';
      $('review-support-text').textContent = '3かいとも じょうずに かけたね！ つぎへ すすもう✨';
      $('review-support').classList.add('is-success');
      $('review-support').classList.remove('is-retry');

      proceedBtn.textContent = (state.currentIndex + 1 < state.questions.length)
        ? 'つぎの もんだいへ！ ➡️'
        : 'けっかを みる！ 🎉';
      proceedBtn.classList.remove('hidden');
      Kakijun.Sound.fanfare();
    } else {
      $('review-banner').textContent = '❌の ところを タップして まちがえなおし しよう✨';
      $('review-support-text').textContent = 'あと ' + ngCount + 'つ！ 赤い ところを タップすると 書きなおせるよ！';
      $('review-support').classList.remove('is-success');
      $('review-support').classList.add('is-retry');
      proceedBtn.classList.add('hidden');
    }
  }

  function enterRepairMode(stepIdx) {
    state.repairMode = true;
    state.repairIndex = stepIdx;
    setupPracticeCommonHeader();
    showScreen('practice');
    setupPracticeStep(stepIdx);
  }

  function handleReviewProceed() {
    Kakijun.Sound.tap();
    if (state.currentIndex + 1 < state.questions.length) {
      state.currentIndex++;
      startQuizForCurrent();
    } else {
      showResultScreen();
    }
  }

  // =========================================================
  // 5. 結果画面
  // =========================================================
  function showResultScreen() {
    if (quizCanvas) quizCanvas.stopPulse();
    if (practiceCanvas) practiceCanvas.stopPulse();

    const container = $('result-words');
    container.innerHTML = '';
    state.questions.forEach(function (q) {
      const chip = document.createElement('div');
      chip.className = 'result-word-chip';
      chip.innerHTML = '<span class="chip-emoji">' + q.emoji + '</span><span>' + q.word + '</span>';
      container.appendChild(chip);
    });

    showScreen('result');
    Kakijun.Sound.fanfare();
    global.setTimeout(function () {
      Kakijun.Sound.speak('よく がんばったね！ ぜんぶ かけたよ！');
    }, 550);
  }

  // =========================================================
  // 画面向き・ピンチ/スクロール抑止・初期化
  // =========================================================
  function checkOrientation() {
    const isPortrait = global.innerHeight > global.innerWidth;
    $('portrait-overlay').classList.toggle('force-show', isPortrait);
    if (!isPortrait) {
      if (quizCanvas) quizCanvas.resize();
      if (practiceCanvas) practiceCanvas.resize();
    }
  }

  function preventTouchZoomAndScroll() {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (evName) {
      document.addEventListener(evName, function (e) {
        e.preventDefault();
      }, { passive: false });
    });

    document.addEventListener('touchmove', function (e) {
      if (e.target && e.target.closest && e.target.closest('.modal-body')) return;
      e.preventDefault();
    }, { passive: false });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }

  function setupSettingsModal() {
    const modal = $('settings-modal');

    function bindSegmented(containerId, key, isNumber) {
      const group = $(containerId);
      group.addEventListener('click', function (e) {
        const btn = e.target.closest('.seg-btn');
        if (!btn) return;
        Kakijun.Sound.tap();
        group.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.settings[key] = isNumber ? Number(btn.dataset.val) : btn.dataset.val;
      });
    }

    bindSegmented('opt-qcount', 'questionCount', true);
    bindSegmented('opt-quiz-judge', 'quizJudge', false);
    bindSegmented('opt-strictness', 'strictness', false);

    $('opt-guide').addEventListener('change', function (e) {
      state.settings.guideMode = e.target.checked;
    });

    $('btn-settings').addEventListener('click', function () {
      Kakijun.Sound.unlock();
      Kakijun.Sound.tap();
      modal.classList.remove('hidden');
    });

    function closeSettings() {
      Kakijun.Sound.tap();
      modal.classList.add('hidden');
      updateHomeBadges();
      if ($('screen-quiz').classList.contains('active') && !state.quizSolved) {
        quizCanvas.setConfig({
          guideMode: state.settings.guideMode,
          guideOpacity: state.settings.guideMode ? 0.34 : 0,
          showStartDot: state.settings.guideMode,
          showLeadGuide: state.settings.guideMode
        });
      }
    }

    $('btn-settings-close').addEventListener('click', closeSettings);
    $('btn-settings-save').addEventListener('click', closeSettings);
  }

  function startSession(mode) {
    Kakijun.Sound.unlock();
    Kakijun.Sound.tap();
    state.mode = mode;
    state.questions = buildQuestionSet(mode, state.settings.questionCount);
    state.currentIndex = 0;
    startQuizForCurrent();
  }

  function init() {
    preventTouchZoomAndScroll();
    checkOrientation();

    global.addEventListener('resize', checkOrientation);
    global.addEventListener('orientationchange', function () {
      global.setTimeout(checkOrientation, 120);
    });
    if (global.visualViewport) {
      global.visualViewport.addEventListener('resize', checkOrientation);
    }

    quizCanvas = new Kakijun.HandwritingCanvas($('quiz-guide-canvas'), $('quiz-draw-canvas'), {
      onChange: function (strokes) {
        updateLiveSupport('quiz', strokes);
      },
      onDemoChange: function (isDemo) {
        syncDemoUi('quiz', isDemo);
      }
    });
    practiceCanvas = new Kakijun.HandwritingCanvas($('practice-guide-canvas'), $('practice-draw-canvas'), {
      onChange: function (strokes) {
        updateLiveSupport('practice', strokes);
      },
      onDemoChange: function (isDemo) {
        syncDemoUi('practice', isDemo);
      }
    });

    document.querySelectorAll('.mode-card').forEach(function (card) {
      card.addEventListener('click', function () {
        startSession(card.dataset.mode);
      });
    });

    $('btn-home').addEventListener('click', function () {
      Kakijun.Sound.tap();
      clearReviewTimers();
      state.busy = false;
      quizCanvas.stopDemo();
      practiceCanvas.stopDemo();
      quizCanvas.stopPulse();
      practiceCanvas.stopPulse();
      showScreen('home');
    });

    $('btn-sound').addEventListener('click', function () {
      Kakijun.Sound.unlock();
      const next = !Kakijun.Sound.isEnabled();
      Kakijun.Sound.setEnabled(next);
      $('btn-sound').setAttribute('aria-pressed', String(next));
      $('btn-sound').querySelector('.icon').textContent = next ? '🔊' : '🔇';
      $('sound-label').textContent = next ? 'おと ON' : 'おと OFF';
      if (next) Kakijun.Sound.tap();
    });

    // クイズ画面ボタン
    $('btn-quiz-speak').addEventListener('click', function () {
      Kakijun.Sound.unlock();
      const item = state.questions[state.currentIndex];
      if (item) Kakijun.Sound.speak(item.speakText || item.word, 0.85);
    });
    $('btn-quiz-demo').addEventListener('click', function () {
      if (state.busy || state.quizSolved) return;
      Kakijun.Sound.tap();
      if (quizCanvas.isDemoMode()) {
        quizCanvas.exitDemoMode();
      } else {
        quizCanvas.playDemo();
      }
    });
    $('btn-quiz-undo').addEventListener('click', function () {
      Kakijun.Sound.tap();
      quizCanvas.undo();
    });
    $('btn-quiz-clear').addEventListener('click', function () {
      Kakijun.Sound.tap();
      quizCanvas.reset();
    });
    $('btn-quiz-submit').addEventListener('click', handleQuizSubmit);
    $('btn-quiz-next').addEventListener('click', function () {
      Kakijun.Sound.tap();
      startPracticeForCurrent();
    });

    // 練習画面ボタン
    $('btn-practice-speak').addEventListener('click', function () {
      Kakijun.Sound.unlock();
      const item = state.questions[state.currentIndex];
      if (item) Kakijun.Sound.speak(item.speakText || item.word, 0.85);
    });
    $('btn-practice-demo').addEventListener('click', function () {
      if (state.busy) return;
      Kakijun.Sound.tap();
      if (practiceCanvas.isDemoMode()) {
        practiceCanvas.exitDemoMode();
      } else {
        practiceCanvas.playDemo();
      }
    });
    $('btn-practice-undo').addEventListener('click', function () {
      Kakijun.Sound.tap();
      practiceCanvas.undo();
    });
    $('btn-practice-clear').addEventListener('click', function () {
      Kakijun.Sound.tap();
      practiceCanvas.reset();
    });
    $('btn-practice-next-write').addEventListener('click', handlePracticeNextWrite);
    $('btn-practice-submit').addEventListener('click', handlePracticeSubmit);

    // マル付け画面ボタン
    $('btn-review-proceed').addEventListener('click', handleReviewProceed);

    // 結果画面ボタン
    $('btn-result-again').addEventListener('click', function () {
      startSession(state.mode);
    });
    $('btn-result-home').addEventListener('click', function () {
      Kakijun.Sound.tap();
      showScreen('home');
    });

    setupSettingsModal();
    updateHomeBadges();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
