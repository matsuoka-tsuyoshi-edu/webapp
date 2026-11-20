/* =========================================================
   音速ラボ - メインアプリケーション制御
   （画面遷移・縦向き警告・ピンチ/スクロール無効化）
   ========================================================= */

(function (global) {
  'use strict';

  var APP_VERSION = '1.0.0';
  var currentView = 'home';

  var views = {};
  var orientationOverlay = null;

  function checkOrientation() {
    if (!orientationOverlay) return;
    var isPortrait = window.innerHeight > window.innerWidth;
    orientationOverlay.hidden = !isPortrait;

    if (!isPortrait && currentView === 'race' && global.OnsokuRace) {
      // 横向きに復帰した際にCanvasサイズを再計算
      requestAnimationFrame(function () {
        global.OnsokuRace.onEnterView();
      });
    }
  }

  function setupTouchGuards() {
    // iPad Safari のピンチイン・ピンチアウトジェスチャーを無効化
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (evtName) {
      document.addEventListener(evtName, function (e) {
        e.preventDefault();
      }, { passive: false });
    });

    // マルチタッチによる拡大縮小を無効化
    document.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // 画面全体のドラッグスクロールを無効化（スライダーと履歴テーブル内のスクロールのみ許可）
    document.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
        return;
      }

      var target = e.target;
      if (target && target.tagName === 'INPUT' && target.type === 'range') {
        return;
      }

      var historyWrap = target && target.closest ? target.closest('.history-table-wrap') : null;
      if (historyWrap && historyWrap.scrollHeight > historyWrap.clientHeight) {
        return;
      }

      e.preventDefault();
    }, { passive: false });

    // ダブルタップ拡大防止（ボタンや入力欄以外での連続タップを抑止）
    var lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
      var target = e.target;
      var interactive = target && target.closest
        ? target.closest('button, input, select, label, a')
        : null;
      if (interactive) return;

      var now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }

  function navigateTo(nextView) {
    if (nextView === currentView) return;

    // 離脱フック
    if (currentView === 'hunter' && global.OnsokuHunter) {
      global.OnsokuHunter.onLeaveView();
    } else if (currentView === 'race' && global.OnsokuRace) {
      global.OnsokuRace.onLeaveView();
    }

    Object.keys(views).forEach(function (key) {
      var el = views[key];
      if (!el) return;
      var active = key === nextView;
      el.hidden = !active;
      el.classList.toggle('active', active);
    });

    currentView = nextView;

    // 入室フック
    if (nextView === 'hunter' && global.OnsokuHunter) {
      global.OnsokuHunter.onEnterView();
    } else if (nextView === 'race' && global.OnsokuRace) {
      global.OnsokuRace.onEnterView();
    }
  }

  function initApp() {
    document.body.classList.add('assets-ready');

    views = {
      home: document.getElementById('view-home'),
      hunter: document.getElementById('view-hunter'),
      race: document.getElementById('view-race')
    };
    orientationOverlay = document.getElementById('orientation-overlay');

    var versionEl = document.getElementById('app-version-label');
    if (versionEl) {
      versionEl.textContent = 'Ver ' + APP_VERSION;
    }

    if (global.OnsokuHunter) {
      global.OnsokuHunter.init();
    }
    if (global.OnsokuRace) {
      global.OnsokuRace.init();
    }

    var btnGoHunter = document.getElementById('btn-go-hunter');
    var btnGoRace = document.getElementById('btn-go-race');
    if (btnGoHunter) {
      btnGoHunter.addEventListener('click', function () {
        if (global.OnsokuAudio) global.OnsokuAudio.ensureAudioContext();
        navigateTo('hunter');
      });
    }
    if (btnGoRace) {
      btnGoRace.addEventListener('click', function () {
        if (global.OnsokuAudio) global.OnsokuAudio.ensureAudioContext();
        navigateTo('race');
      });
    }

    document.querySelectorAll('[data-nav="home"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        navigateTo('home');
      });
    });

    setupTouchGuards();
    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', function () {
      setTimeout(checkOrientation, 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})(window);
