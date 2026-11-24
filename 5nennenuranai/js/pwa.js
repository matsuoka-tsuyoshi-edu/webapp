/**
 * pwa.js
 * オフラインPWA管理・キャッシュ削除/強制再読み込み・全画面・誤操作/縦向き対策
 */
window.TakakukeiApp = window.TakakukeiApp || {};

window.TakakukeiApp.initPWA = function (options) {
  const { onInstallAvailable, onStatusChange } = options || {};
  let deferredInstallPrompt = null;

  // 1. 誤操作防止（ページ全体のピンチイン・ピンチアウト・ダブルタップズーム・背景スクロール抑止）
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 280) {
      // Blockly操作やボタン連打以外でのダブルタップズームを防ぐ
      const inBlockly = e.target && e.target.closest && e.target.closest('#blocklyDiv');
      if (!inBlockly) {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });

  // マルチタッチでのピンチズーム防止
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
      return;
    }
    const scrollableModal = e.target && e.target.closest && e.target.closest('.modal-body');
    const inBlockly = e.target && e.target.closest && e.target.closest('#blocklyDiv');
    const inStepNav = e.target && e.target.closest && e.target.closest('.step-nav');
    if (!scrollableModal && !inBlockly && !inStepNav) {
      e.preventDefault();
    }
  }, { passive: false });

  // Ctrl + ホイールでのPCブラウザズーム誤操作を抑制
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // 2. 横向きチェック（CSSのmedia queryに加えてJSでも画面比を監視）
  const overlay = document.getElementById('orientation-overlay');
  function checkOrientation() {
    if (!overlay) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    overlay.style.display = isPortrait ? 'flex' : 'none';
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();

  // 3. Service Worker 登録（HTTP / HTTPS / localhost のみ）
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      if (reg && reg.update) {
        reg.update().catch(() => {});
      }
      if (onStatusChange) onStatusChange();
    }).catch(() => {});
  }

  // 4. Chrome PWA インストールイベント捕捉
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (onInstallAvailable) onInstallAvailable(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    if (onInstallAvailable) onInstallAvailable(false);
  });

  // オンライン / オフライン監視
  window.addEventListener('online', () => onStatusChange && onStatusChange());
  window.addEventListener('offline', () => onStatusChange && onStatusChange());

  async function triggerInstall() {
    if (!deferredInstallPrompt) return false;
    deferredInstallPrompt.prompt();
    const res = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (onInstallAvailable) onInstallAvailable(false);
    return res && res.outcome === 'accepted';
  }

  // 5. 全画面切り替え（iOS Safari対応含む）
  async function toggleFullscreen() {
    const docEl = document.documentElement;
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

    try {
      if (!isFs) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
          }
          return { supported: true, active: true };
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
          return { supported: true, active: true };
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return { supported: true, active: false };
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
          return { supported: true, active: false };
        }
      }
    } catch (e) {
      // iOS Safari 等で全画面APIが制限されている場合
    }

    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    return { supported: false, standalone: isStandalone };
  }

  // 6. キャッシュ削除＆強制リフレッシュ機能
  async function clearCacheAndReload() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {
      // エラーが出ても再読み込みを試行
    }
    const base = location.href.split('?')[0].split('#')[0];
    location.replace(base + '?v=' + Date.now());
  }

  return {
    toggleFullscreen,
    triggerInstall,
    canInstall: () => !!deferredInstallPrompt,
    clearCacheAndReload
  };
};
