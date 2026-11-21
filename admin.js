<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>ضمان سايت | DamanSite — منصة المقاولات والتوريدات والضمان المالي</title>
  <meta name="description" content="ضمان سايت — منصة المقاولات والتوريدات B2B، الضمان المالي للعقود، الاستلام الهندسي، وإدارة شركات المقاولات والموظفين." />
  <meta name="theme-color" content="#020617" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="ضمان سايت" />

  <!-- PWA Manifest -->
  <link rel="manifest" href="manifest.json?v=20" />

  <!-- Fonts & Icons -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- Client-Side QR Code Generator (for User Profiles & Official A4 Contracts) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

  <!-- Firebase Compat SDKs -->
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>

  <style>
    :root {
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
    }
    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Cairo', Tahoma, Arial, sans-serif;
      background-color: #020617;
      color: #f1f5f9;
      min-height: 100vh;
      overflow-x: hidden;
    }
    .glass-card {
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(51, 65, 85, 0.72);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    .nav-btn.active {
      color: #f59e0b;
    }
    .nav-btn.active .nav-indicator {
      opacity: 1;
      transform: scaleX(1);
    }
    .nav-indicator {
      opacity: 0;
      transform: scaleX(0);
      transition: all 0.2s ease;
    }
    ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    ::-webkit-scrollbar-track {
      background: #020617;
    }
    ::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 999px;
    }
    /* Signature Canvas Touch Lock */
    canvas.sig-pad {
      touch-action: none;
      cursor: crosshair;
    }

    /* Internal A4 Print Area (Hidden on screen, ONLY visible on print — 100% APK compatible) */
    #daman-print-area {
      display: none;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm;
      }
      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        overflow: visible !important;
      }
      #app-shell,
      #daman-lightbox,
      #daman-toast-container,
      #daman-global-call-overlay,
      #daman-offline-banner,
      #daman-update-banner,
      .daman-modal,
      .no-print {
        display: none !important;
      }
      #daman-print-area {
        display: block !important;
        width: 100% !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: 'Cairo', Tahoma, Arial, sans-serif !important;
        font-size: 11.5px !important;
        line-height: 1.55 !important;
      }
      #daman-print-area * {
        color: #000000 !important;
        box-shadow: none !important;
      }
      #daman-print-area table {
        width: 100%;
        border-collapse: collapse;
      }
      #daman-print-area th,
      #daman-print-area td {
        border: 1px solid #000000 !important;
        padding: 5px 7px !important;
        text-align: right;
      }
      #daman-print-area th {
        background: #f2f2f2 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">

  <!-- ==================== PERSISTENT GLOBAL MEDIA & OVERLAYS (OUTSIDE RERENDER) ==================== -->
  <!-- Persistent WebRTC Remote Audio Element (Never destroyed during chat rerender) -->
  <audio id="daman-remote-audio" autoplay playsinline class="hidden"></audio>

  <!-- Network Offline Banner -->
  <div id="daman-offline-banner" class="hidden fixed inset-x-0 top-0 z-[120] bg-rose-600 text-white text-center text-[11px] font-black py-1.5 px-3 shadow-lg">
    <i class="fa-solid fa-wifi-slash me-1"></i> لا يوجد اتصال بالإنترنت — أنت تتصفح البيانات المحفوظة مؤقتاً، وسيتم المزامنة فور عودة الشبكة.
  </div>

  <!-- App Update Available Banner (PWA / APK Auto-Sync) -->
  <div id="daman-update-banner" class="hidden fixed inset-x-3 bottom-20 z-[115] max-w-md mx-auto bg-amber-500 text-slate-950 rounded-2xl px-3.5 py-2.5 shadow-2xl flex items-center justify-between gap-2">
    <span class="text-xs font-black"><i class="fa-solid fa-sparkles me-1"></i> يوجد تحديث جديد للتطبيق</span>
    <button onclick="window.DamanApplyUpdate()" class="px-3 py-1 rounded-xl bg-slate-950 text-amber-400 text-[11px] font-black">تحديث الآن</button>
  </div>

  <!-- Internal Image Lightbox (Replaces blocked window.open on Mobile/APK) -->
  <div id="daman-lightbox" class="hidden fixed inset-0 z-[130] bg-black/95 backdrop-blur-md flex flex-col p-3">
    <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
      <span id="daman-lightbox-title" class="text-xs font-black text-amber-400 truncate">معاينة الصورة</span>
      <div class="flex items-center gap-2 shrink-0">
        <a id="daman-lightbox-dl" href="#" download="damansite-image.jpg" class="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-[11px] font-black">
          <i class="fa-solid fa-download me-1"></i> حفظ
        </a>
        <button onclick="window.DamanLightbox.close()" class="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
    <div class="flex-1 flex items-center justify-center overflow-auto py-3" onclick="if(event.target===this) window.DamanLightbox.close()">
      <img id="daman-lightbox-img" src="" alt="Preview" class="max-w-full max-h-[82vh] object-contain rounded-xl border border-slate-700 shadow-2xl" />
    </div>
  </div>

  <!-- Toast Container -->
  <div id="daman-toast-container" class="fixed top-16 inset-x-3 z-[125] max-w-md mx-auto space-y-2 pointer-events-none"></div>

  <!-- Internal A4 Black & White Print Container -->
  <div id="daman-print-area" dir="rtl"></div>

  <!-- ==================== MAIN APP SHELL ==================== -->
  <div id="app-shell" class="min-h-screen flex flex-col max-w-2xl mx-auto relative">

    <!-- Sticky Top Header -->
    <header class="sticky top-0 z-40 bg-slate-950/92 backdrop-blur-md border-b border-slate-800/80 px-3 py-2.5" style="padding-top: calc(0.6rem + var(--safe-top));">
      <div class="flex items-center justify-between gap-2">
        <!-- Brand Logo -->
        <button onclick="DamanApp.switchTab('home')" class="flex items-center gap-2 text-start min-w-0">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-base shadow-lg shadow-amber-500/20 shrink-0">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <div class="min-w-0">
            <div class="text-sm font-black text-white leading-tight truncate">ضمان سايت <span class="text-amber-400 text-[10px]">DamanSite</span></div>
            <div class="text-[9.5px] text-slate-400 font-bold truncate" id="daman-header-sub">الضمان المالي والمقاولات B2B</div>
          </div>
        </button>

        <!-- Header Actions -->
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- PWA Install Button -->
          <button id="daman-install-btn" onclick="window.DamanPromptInstall()" class="hidden px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-black">
            <i class="fa-solid fa-mobile-screen-button me-1"></i> تثبيت
          </button>

          <!-- Admin / Mod Panel Shortcut -->
          <button id="daman-admin-header-btn" onclick="DamanApp.switchTab('admin')" class="hidden px-2.5 py-1.5 rounded-xl bg-purple-600 text-white text-[10px] font-black shadow-lg">
            <i class="fa-solid fa-crown me-1"></i> الإدارة
          </button>

          <!-- Notifications Bell -->
          <button id="daman-notif-btn" onclick="DamanApp.openNotificationsModal()" class="relative w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 flex items-center justify-center">
            <i class="fa-solid fa-bell text-sm"></i>
            <span id="daman-notif-badge" class="hidden absolute -top-1 -end-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">0</span>
          </button>

          <!-- Language Toggle -->
          <button id="daman-lang-btn" onclick="DamanApp.toggleLang()" class="px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 hover:text-white">
            EN
          </button>

          <!-- Auth / Account Quick Button -->
          <button id="daman-auth-header-btn" onclick="DamanApp.handleHeaderAuthClick()" class="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-black">
            دخول
          </button>
        </div>
      </div>
    </header>

    <!-- Main Dynamic View -->
    <main id="app-main" class="flex-1 px-3 pt-3 pb-24">
      <!-- Initial Splash Loader -->
      <div class="flex flex-col items-center justify-center py-24 space-y-3 text-center">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center text-2xl font-black animate-pulse shadow-xl shadow-amber-500/20">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <div class="text-sm font-black text-white">جارٍ تشغيل ضمان سايت...</div>
        <div class="text-[11px] text-slate-400">جاري الاتصال الآمن بقاعدة البيانات</div>
      </div>
    </main>

    <!-- Fixed Bottom Navigation Bar (6 Core Tabs) -->
    <nav id="app-bottom-nav" class="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 max-w-2xl mx-auto" style="padding-bottom: var(--safe-bottom);">
      <div class="grid grid-cols-6 gap-0.5 px-1 py-1.5">
        <button data-tab="home" onclick="DamanApp.switchTab('home')" class="nav-btn active relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 transition">
          <span class="nav-indicator absolute top-0 w-6 h-0.5 rounded-full bg-amber-400"></span>
          <i class="fa-solid fa-house text-sm"></i>
          <span class="text-[9.5px] font-extrabold mt-0.5" data-i18n="navHome">الرئيسية</span>
        </button>

        <button data-tab="projects" onclick="DamanApp.switchTab('projects')" class="nav-btn relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 transition">
          <span class="nav-indicator absolute top-0 w-6 h-0.5 rounded-full bg-amber-400"></span>
          <i class="fa-solid fa-helmet-safety text-sm"></i>
          <span class="text-[9.5px] font-extrabold mt-0.5" data-i18n="navProjects">السوق</span>
        </button>

        <button data-tab="chat" onclick="DamanApp.switchTab('chat')" class="nav-btn relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 transition">
          <span class="nav-indicator absolute top-0 w-6 h-0.5 rounded-full bg-amber-400"></span>
          <i class="fa-solid fa-comments text-sm"></i>
          <span class="text-[9.5px] font-extrabold mt-0.5" data-i18n="navChat">الشات</span>
          <span id="daman-chat-unread-badge" class="hidden absolute top-0.5 end-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">0</span>
        </button>

        <button data-tab="company" onclick="DamanApp.switchTab('company')" class="nav-btn relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 transition">
          <span class="nav-indicator absolute top-0 w-6 h-0.5 rounded-full bg-amber-400"></span>
          <i class="fa-solid fa-building text-sm"></i>
          <span class="text-[9.5px] font-extrabold mt-0.5" data-i18n="navCompany">الشركات</span>
        </button>

        <button data-tab="wallet" onclick="DamanApp.switchTab('wallet')" class="nav-btn relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 transition">
          <span class="nav-indicator absolute top-0 w-6 h-0.5 rounded-full bg-amber-400"></span>
          <i class="fa-solid fa-wallet text-sm"></i>
          <span class="text-[9.5px] font-extrabold mt-0.5" data-i18n="navWallet">المحفظة</span>
        </button>

        <button data-tab="profile" onclick="DamanApp.switchTab('profile')" class="nav-btn relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 transition">
          <span class="nav-indicator absolute top-0 w-6 h-0.5 rounded-full bg-amber-400"></span>
          <i class="fa-solid fa-user-circle text-sm"></i>
          <span class="text-[9.5px] font-extrabold mt-0.5" data-i18n="navProfile">صفحتي</span>
        </button>
      </div>
    </nav>
  </div>

  <!-- ==================== GLOBAL INFRASTRUCTURE HELPERS (LIGHTBOX, A4 PRINT, PWA, BACK BUTTON) ==================== -->
  <script>
    // 1. Internal Image Lightbox (100% APK & Mobile Safe)
    window.DamanLightbox = {
      open(src, title) {
        if (!src) return;
        const box = document.getElementById('daman-lightbox');
        const img = document.getElementById('daman-lightbox-img');
        const ttl = document.getElementById('daman-lightbox-title');
        const dl = document.getElementById('daman-lightbox-dl');
        if (!box || !img) return;
        img.src = src;
        if (ttl) ttl.textContent = title || 'معاينة الصورة';
        if (dl) dl.href = src;
        box.classList.remove('hidden');
        try { history.pushState({ damanModal: 'lightbox' }, ''); } catch (e) {}
      },
      close() {
        const box = document.getElementById('daman-lightbox');
        if (box) box.classList.add('hidden');
      }
    };

    // 2. Internal A4 B&W Print Engine (100% APK Safe — No blocked window.open)
    window.DamanPrint = function (htmlContent, qrCallback) {
      const area = document.getElementById('daman-print-area');
      if (!area) return;
      area.innerHTML = htmlContent;
      if (typeof qrCallback === 'function') {
        try { qrCallback(area); } catch (e) {}
      }
      setTimeout(() => {
        window.print();
      }, 280);
    };

    // 3. Offline / Online Status Detection
    (function () {
      const syncNet = () => {
        const b = document.getElementById('daman-offline-banner');
        if (b) b.classList.toggle('hidden', navigator.onLine);
      };
      window.addEventListener('online', syncNet);
      window.addEventListener('offline', syncNet);
      syncNet();
    })();

    // 4. PWA Install Prompt & Service Worker Auto-Update
    window.DamanDeferredInstall = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.DamanDeferredInstall = e;
      const btn = document.getElementById('daman-install-btn');
      if (btn) btn.classList.remove('hidden');
    });

    window.DamanPromptInstall = async function () {
      if (!window.DamanDeferredInstall) return;
      window.DamanDeferredInstall.prompt();
      try { await window.DamanDeferredInstall.userChoice; } catch (e) {}
      window.DamanDeferredInstall = null;
      const btn = document.getElementById('daman-install-btn');
      if (btn) btn.classList.add('hidden');
    };

    window.DamanNewWorker = null;
    window.DamanApplyUpdate = function () {
      if (window.DamanNewWorker) {
        window.DamanNewWorker.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js?v=20').then((reg) => {
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                window.DamanNewWorker = nw;
                const b = document.getElementById('daman-update-banner');
                if (b) b.classList.remove('hidden');
              }
            });
          });
        }).catch(() => {});
      });
    }

    // 5. Android Hardware Back Button Handling inside APK/PWA
    window.addEventListener('popstate', () => {
      const lb = document.getElementById('daman-lightbox');
      if (lb && !lb.classList.contains('hidden')) {
        lb.classList.add('hidden');
        return;
      }
      const openModals = Array.from(document.querySelectorAll('.daman-modal')).filter((m) => !m.classList.contains('hidden'));
      if (openModals.length) {
        openModals[openModals.length - 1].classList.add('hidden');
        return;
      }
      if (window.DamanChat && window.DamanChat.activeChatId) {
        window.DamanChat.closeActiveChat(true);
        return;
      }
      if (window.DamanApp && window.DamanApp.viewingPublicUid) {
        window.DamanApp.viewingPublicUid = null;
        window.DamanApp.renderCurrentTab();
        return;
      }
      if (window.DamanApp && window.DamanApp.activeTab !== 'home') {
        window.DamanApp.switchTab('home');
      }
    });
  </script>

  <!-- ==================== MODULAR APPLICATION SCRIPTS (UNIFIED VERSION v20) ==================== -->
  <script src="app-core.js?v=20"></script>
  <script src="wallet-kyc.js?v=20"></script>
  <script src="chat-support.js?v=20"></script>
  <script src="projects-escrow.js?v=20"></script>
  <script src="company-panel.js?v=20"></script>
  <script src="admin.js?v=20"></script>
</body>
</html>
