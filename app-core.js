(function () {
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDSkWNxg9B5Ot_jIDdao2OIFCboMl_yRxU',
    authDomain: 'daman-site-36583.firebaseapp.com',
    projectId: 'daman-site-36583',
    storageBucket: 'daman-site-36583.firebasestorage.app',
    messagingSenderId: '1053020809096',
    appId: '1:1053020809096:web:damansite'
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Enable Offline Persistence for weak site networks
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  const ADMIN_EMAIL = 'adelnabilabdullah@gmail.com';

  const CATEGORIES = [
    { id: 'concrete', ar: 'خرسانات وشدات خشبية ومعدنية', en: 'Concrete & Formwork' },
    { id: 'steel', ar: 'حدادة مسلحة', en: 'Rebar & Steel' },
    { id: 'masonry', ar: 'مباني وطوب', en: 'Masonry & Bricks' },
    { id: 'plaster', ar: 'محارة وبياض', en: 'Plastering' },
    { id: 'plumbing', ar: 'سباكة وتأسيس صحي', en: 'Plumbing' },
    { id: 'electrical', ar: 'كهرباء وتأسيس سمارت', en: 'Electrical & Smart' },
    { id: 'ceramic', ar: 'سيراميك وبورسلين ورخام', en: 'Ceramics & Marble' },
    { id: 'gypsum', ar: 'جبسمبورد وديكورات أسقف', en: 'Gypsum Board' },
    { id: 'painting', ar: 'نقاشة ودهانات', en: 'Painting' },
    { id: 'carpentry', ar: 'نجارة باب وشباك وأثاث', en: 'Carpentry' },
    { id: 'aluminum', ar: 'ألوميتال وواجهات زجاج', en: 'Aluminum & Glass' },
    { id: 'insulation', ar: 'عزل مائي وحراري', en: 'Waterproofing & Insulation' },
    { id: 'hvac', ar: 'تكييف وتبريد وتهوية', en: 'HVAC' },
    { id: 'landscape', ar: 'لاندسكيب وحمامات سباحة', en: 'Landscape & Pools' },
    { id: 'materials', ar: 'توريد خامات ومواد بناء B2B', en: 'B2B Building Materials' },
    { id: 'equipment', ar: 'تأجير معدات وشدات وأوناش', en: 'Equipment Rental' },
    { id: 'general', ar: 'مقاولات عامة وتشطيب كامل', en: 'General Contracting' }
  ];

  const I18N = {
    ar: {
      navHome: 'الرئيسية', navProjects: 'السوق', navChat: 'الشات',
      navCompany: 'الشركات', navWallet: 'المحفظة', navProfile: 'صفحتي',
      loginBtn: 'تسجيل الدخول', registerBtn: 'حساب جديد', logoutBtn: 'خروج',
      currency: 'ج.م'
    },
    en: {
      navHome: 'Home', navProjects: 'Market', navChat: 'Chat',
      navCompany: 'Companies', navWallet: 'Wallet', navProfile: 'Profile',
      loginBtn: 'Sign In', registerBtn: 'Sign Up', logoutBtn: 'Logout',
      currency: 'EGP'
    }
  };

  const DamanApp = {
    auth,
    db,
    ADMIN_EMAIL,
    CATEGORIES,
    lang: localStorage.getItem('daman_lang') || 'ar',
    activeTab: 'home',
    user: null,
    profile: null,
    appConfig: {
      commissionRate: 0.035,
      vipCommissionRate: 0.10,
      minDeposit: 100,
      minWithdraw: 100,
      withdrawFeePct: 0,
      withdrawFeeFlat: 0,
      requireKycForActions: true,
      maintenanceMode: false,
      disableCalls: false,
      moderators: [],
      supportWhatsapp: '201030374787',
      paymentAccounts: {
        vodafoneCash: '01030374787',
        instaPay: 'adelnabil@instapay',
        bankInfo: 'سيتم التحديث من لوحة الإدارة'
      },
      packages: {
        individualMonthly: 150,
        companyMonthly: 450,
        boostAdPrice: 75
      },
      turnServer: ''
    },
    modules: {},
    notifications: [],
    unsubProfile: null,
    unsubConfig: null,
    unsubNotifs: null,

    // Facebook-style Profile State
    viewingPublicUid: null,
    publicProfileData: null,
    profileSubTab: 'posts', // 'posts' | 'portfolio' | 'reviews'
    profilePosts: [],
    profilePortfolio: [],
    profileReviews: [],
    mediaCache: {},
    pendingDeepLink: null,

    // ==================== CORE HELPERS ====================
    t(key) {
      return (I18N[this.lang] && I18N[this.lang][key]) || I18N.ar[key] || key;
    },

    esc(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    fmtMoney(n) {
      const num = Number(n || 0);
      return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },

    // Local Egypt Date (YYYY-MM-DD) — prevents midnight UTC date shift
    todayLocal() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    // Arabic Search Normalizer
    normalizeAr(str) {
      return String(str || '')
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .trim();
    },

    // Unified Egyptian Phone Normalizer -> 01xxxxxxxxx
    normalizePhone(raw) {
      let p = String(raw || '').replace(/[^\d]/g, '');
      if (p.startsWith('0020')) p = p.slice(3);
      else if (p.startsWith('20') && p.length === 12) p = '0' + p.slice(2);
      else if (p.length === 10 && p.startsWith('1')) p = '0' + p;
      return p;
    },

    maskNationalId(nid) {
      const s = String(nid || '').trim();
      if (s.length < 8) return '—';
      return s.slice(0, 3) + '********' + s.slice(-3);
    },

    // Extract & Validate Birth Date + Age >= 18 from Egyptian 14-digit National ID
    parseEgyptianNationalId(rawNid) {
      const nid = String(rawNid || '').replace(/\D/g, '');
      if (nid.length !== 14) return { valid: false, error: 'الرقم القومي يجب أن يكون 14 رقماً بالضبط' };
      const centuryDigit = nid[0];
      if (centuryDigit !== '2' && centuryDigit !== '3') return { valid: false, error: 'صيغة الرقم القومي غير صحيحة' };
      const year = (centuryDigit === '2' ? 1900 : 2000) + parseInt(nid.slice(1, 3), 10);
      const month = parseInt(nid.slice(3, 5), 10);
      const day = parseInt(nid.slice(5, 7), 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) return { valid: false, error: 'تاريخ الميلاد داخل الرقم القومي غير صحيح' };
      const bd = new Date(year, month - 1, day);
      if (bd.getFullYear() !== year || bd.getMonth() !== month - 1 || bd.getDate() !== day) {
        return { valid: false, error: 'تاريخ الميلاد داخل الرقم القومي غير صالح' };
      }
      const now = new Date();
      let age = now.getFullYear() - year;
      const mDiff = now.getMonth() - (month - 1);
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < day)) age--;
      if (age < 18) return { valid: false, error: 'السن القانوني للتعاقد على ضمان سايت 18 سنة على الأقل' };
      const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { valid: true, nid, birthDate, age };
    },

    compressImage(file, maxW = 820, quality = 0.6) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Read error'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Image error'));
          img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > maxW) {
              h = Math.round((h * maxW) / w);
              w = maxW;
            }
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', quality));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    // Separate Heavy Media Vault (Prevents Admin lag & 1MB Firestore limit)
    async saveMedia(base64, meta = {}) {
      if (!base64) return '';
      const ref = await db.collection('mediaVault').add({
        data: base64,
        ownerId: this.user ? this.user.uid : '',
        kind: meta.kind || 'image',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.mediaCache[ref.id] = base64;
      return ref.id;
    },

    async fetchMedia(mediaIdOrBase64) {
      if (!mediaIdOrBase64) return '';
      if (String(mediaIdOrBase64).startsWith('data:')) return mediaIdOrBase64;
      if (this.mediaCache[mediaIdOrBase64]) return this.mediaCache[mediaIdOrBase64];
      try {
        const snap = await db.collection('mediaVault').doc(mediaIdOrBase64).get();
        if (snap.exists && snap.data().data) {
          this.mediaCache[mediaIdOrBase64] = snap.data().data;
          return snap.data().data;
        }
      } catch (e) {}
      return '';
    },

    async openMediaLightbox(mediaIdOrBase64, title = 'معاينة المرفق') {
      if (!mediaIdOrBase64) return this.toast('لا يوجد مرفق متاح', 'warning');
      if (String(mediaIdOrBase64).startsWith('data:')) {
        return window.DamanLightbox.open(mediaIdOrBase64, title);
      }
      this.toast('جارٍ تحميل الصورة...', 'info');
      const src = await this.fetchMedia(mediaIdOrBase64);
      if (src) window.DamanLightbox.open(src, title);
      else this.toast('تعذر تحميل الصورة', 'error');
    },

    // Double-Click Prevention Wrapper for Financial Actions
    async withLock(key, fn) {
      this._locks = this._locks || {};
      if (this._locks[key]) return;
      this._locks[key] = true;
      try {
        return await fn();
      } finally {
        setTimeout(() => { this._locks[key] = false; }, 600);
      }
    },

    toast(msg, type = 'info') {
      const box = document.getElementById('daman-toast-container');
      if (!box) return;
      const colors = {
        success: 'bg-emerald-600 border-emerald-400 text-white',
        error: 'bg-rose-600 border-rose-400 text-white',
        warning: 'bg-amber-500 border-amber-300 text-slate-950',
        info: 'bg-slate-800 border-slate-600 text-white'
      };
      const el = document.createElement('div');
      el.className = `pointer-events-auto px-3.5 py-2.5 rounded-xl border text-xs font-extrabold shadow-2xl transition-all duration-300 ${colors[type] || colors.info}`;
      el.textContent = msg;
      box.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }, 3600);
    },

    async sendNotification(targetUid, title, body) {
      if (!targetUid) return;
      try {
        await db.collection('notifications').add({
          userId: targetUid,
          title: String(title || '').slice(0, 120),
          body: String(body || '').slice(0, 280),
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {}
    },

    // ==================== ROLES, CONFIG & BLACKLIST ====================
    isAdmin() {
      return !!(this.user && (this.user.email || '').toLowerCase() === ADMIN_EMAIL);
    },

    isMod() {
      if (!this.user || this.isAdmin()) return false;
      const mods = Array.isArray(this.appConfig?.moderators) ? this.appConfig.moderators : [];
      return mods.map((x) => String(x || '').toLowerCase().trim()).includes((this.user.email || '').toLowerCase());
    },

    hasAdminAccess() {
      return this.isAdmin() || this.isMod();
    },

    isKycVerified() {
      if (this.hasAdminAccess()) return true;
      return !!(this.profile && this.profile.kycStatus === 'verified');
    },

    getCommissionRate() {
      const r = Number(this.appConfig?.commissionRate);
      return !isNaN(r) && r >= 0 && r <= 0.3 ? r : 0.035;
    },

    getVipCommissionRate() {
      const r = Number(this.appConfig?.vipCommissionRate);
      return !isNaN(r) && r >= 0 && r <= 0.4 ? r : 0.10;
    },

    isSubscriptionActive(prof) {
      const p = prof || this.profile;
      if (!p) return false;
      if (this.hasAdminAccess() && !prof) return true;
      return Number(p.subscriptionExpiresAt || 0) > Date.now();
    },

    async checkBlacklist({ email, phone, nationalId, commercialReg }) {
      try {
        const snap = await db.collection('blacklist').limit(300).get();
        const normP = this.normalizePhone(phone);
        const normE = String(email || '').toLowerCase().trim();
        const normN = String(nationalId || '').replace(/\D/g, '');
        const normC = String(commercialReg || '').trim();
        for (const doc of snap.docs) {
          const val = String(doc.data().value || '').trim();
          const low = val.toLowerCase();
          if (normE && low === normE) return doc.data().reason || 'حساب محظور';
          if (normP && this.normalizePhone(val) === normP) return doc.data().reason || 'رقم هاتف محظور';
          if (normN && val.replace(/\D/g, '') === normN) return doc.data().reason || 'رقم قومي محظور';
          if (normC && val === normC) return doc.data().reason || 'سجل تجاري محظور';
        }
      } catch (e) {}
      return null;
    },

    // ==================== MODULE REGISTRY & BOOT ====================
    registerModule(name, mod) {
      this.modules[name] = mod;
      if (this.activeTab === name) this.renderCurrentTab();
    },

    init() {
      this.applyLanguageDOM();
      this.parseUrlDeepLinks();

      // Listen to App Config
      this.unsubConfig = db.collection('settings').doc('appConfig').onSnapshot((snap) => {
        if (snap.exists) {
          this.appConfig = Object.assign({}, this.appConfig, snap.data());
        }
        this.syncHeaderButtons();
        this.renderCurrentTab();
      }, () => {});

      // Listen to Firebase Auth State
      auth.onAuthStateChanged((u) => {
        this.user = u || null;
        if (this.unsubProfile) { try { this.unsubProfile(); } catch (e) {} this.unsubProfile = null; }
        if (this.unsubNotifs) { try { this.unsubNotifs(); } catch (e) {} this.unsubNotifs = null; }

        if (!u) {
          this.profile = null;
          this.notifications = [];
          this.resetAllModules();
          this.syncHeaderButtons();
          this.handlePendingDeepLink();
          this.renderCurrentTab();
          return;
        }

        // Watch own user profile
        this.unsubProfile = db.collection('users').doc(u.uid).onSnapshot(
          (snap) => {
            if (snap.exists) {
              this.profile = Object.assign({ uid: u.uid }, snap.data());
              this.checkBirthdayAndAlerts();
            } else {
              // Ensure basic profile exists (especially for Admin first login)
              const base = {
                name: u.displayName || (u.email === ADMIN_EMAIL ? 'إدارة ضمان سايت' : 'مستخدم ضمان سايت'),
                email: u.email || '',
                phone: '',
                accountType: 'individual',
                kycStatus: u.email === ADMIN_EMAIL ? 'verified' : 'none',
                status: 'active',
                balanceAvailable: 0,
                balanceEscrow: 0,
                ratingAvg: 5,
                ratingCount: 0,
                followers: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              };
              db.collection('users').doc(u.uid).set(base, { merge: true }).catch(() => {});
              this.profile = Object.assign({ uid: u.uid }, base);
            }
            this.syncHeaderButtons();
            this.handlePendingDeepLink();
            this.renderCurrentTab();
          },
          () => { this.renderCurrentTab(); }
        );

        // Watch Notifications
        const notifTargets = this.hasAdminAccess() ? [u.uid, 'ADMIN'] : [u.uid];
        this.unsubNotifs = db
          .collection('notifications')
          .where('userId', 'in', notifTargets)
          .limit(35)
          .onSnapshot((snap) => {
            this.notifications = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            this.updateNotifBadge();
          }, () => {});
      });
    },

    parseUrlDeepLinks() {
      try {
        const sp = new URLSearchParams(window.location.search);
        const pUid = sp.get('profile');
        const vCode = sp.get('verify');
        if (pUid) this.pendingDeepLink = { type: 'profile', value: pUid };
        else if (vCode) this.pendingDeepLink = { type: 'verify', value: vCode };
      } catch (e) {}
    },

    handlePendingDeepLink() {
      if (!this.pendingDeepLink) return;
      const dl = this.pendingDeepLink;
      this.pendingDeepLink = null;
      if (dl.type === 'profile') {
        this.openPublicProfile(dl.value);
      } else if (dl.type === 'verify') {
        setTimeout(() => this.openVerifyContractModal(dl.value), 350);
      }
    },

    resetAllModules() {
      Object.values(this.modules).forEach((m) => {
        if (m && typeof m.detachListeners === 'function') {
          try { m.detachListeners(); } catch (e) {}
        }
      });
      this.viewingPublicUid = null;
      this.publicProfileData = null;
    },

    // ==================== BIRTHDAY & EXPIRY AUTO ALERTS ====================
    isBirthdayToday(prof) {
      const p = prof || this.profile;
      if (!p || !p.birthDate || String(p.birthDate).length < 10) return false;
      return String(p.birthDate).slice(5, 10) === this.todayLocal().slice(5, 10);
    },

    checkBirthdayAndAlerts() {
      if (!this.user || !this.profile) return;
      const today = this.todayLocal();
      const year = today.slice(0, 4);

      // 1. Automatic Birthday Greeting Notification (Once per year)
      if (this.isBirthdayToday(this.profile)) {
        const bKey = `daman_bday_${this.user.uid}_${year}`;
        if (!localStorage.getItem(bKey)) {
          localStorage.setItem(bKey, '1');
          const nm = this.profile.name || 'صديق ضمان سايت';
          this.sendNotification(
            this.user.uid,
            `🎂 كل سنة وأنت طيب يا ${nm}!`,
            'أسرة ضمان سايت تتمنى لك عاماً سعيداً مليئاً بالنجاح والتوفيق والرزق الواسع.'
          );
        }
      }

      // 2. Subscription 3-Day Expiry Reminder
      const exp = Number(this.profile.subscriptionExpiresAt || 0);
      if (exp > Date.now() && exp - Date.now() <= 3 * 24 * 60 * 60 * 1000) {
        const sKey = `daman_sub_warn_${this.user.uid}_${today}`;
        if (!localStorage.getItem(sKey)) {
          localStorage.setItem(sKey, '1');
          const daysLeft = Math.max(1, Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000)));
          this.sendNotification(
            this.user.uid,
            'تنبيه: باقتك على وشك الانتهاء',
            `يتبقى ${daysLeft} يوم على انتهاء باقتك الحالية — يرجى التجديد من المحفظة لضمان استمرار المميزات.`
          );
        }
      }
    },

    // ==================== NAVIGATION & HEADER ====================
    applyLanguageDOM() {
      document.documentElement.lang = this.lang;
      document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      const lb = document.getElementById('daman-lang-btn');
      if (lb) lb.textContent = this.lang === 'ar' ? 'EN' : 'عربي';
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (k) el.textContent = this.t(k);
      });
    },

    toggleLang() {
      this.lang = this.lang === 'ar' ? 'en' : 'ar';
      localStorage.setItem('daman_lang', this.lang);
      this.applyLanguageDOM();
      this.syncHeaderButtons();
      this.renderCurrentTab();
    },

    syncHeaderButtons() {
      const authBtn = document.getElementById('daman-auth-header-btn');
      const adminBtn = document.getElementById('daman-admin-header-btn');
      if (adminBtn) {
        adminBtn.classList.toggle('hidden', !this.hasAdminAccess());
        adminBtn.innerHTML = this.isAdmin()
          ? '<i class="fa-solid fa-crown me-1"></i> الإدارة'
          : '<i class="fa-solid fa-user-shield me-1"></i> الإشراف';
      }
      if (authBtn) {
        if (this.user) {
          authBtn.className = 'px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-rose-400 text-[10px] font-black';
          authBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket me-1"></i>' + this.t('logoutBtn');
        } else {
          authBtn.className = 'px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-black';
          authBtn.textContent = this.lang === 'ar' ? 'دخول' : 'Login';
        }
      }
    },

    handleHeaderAuthClick() {
      if (this.user) {
        if (!window.confirm('هل تريد تسجيل الخروج من حسابك؟')) return;
        this.resetAllModules();
        auth.signOut().then(() => {
          this.toast('تم تسجيل الخروج بنجاح', 'info');
          this.switchTab('home');
        });
      } else {
        this.openAuthModal('login');
      }
    },

    switchTab(tab) {
      if (tab === 'admin' && !this.hasAdminAccess()) {
        return this.toast('هذه اللوحة خاصة بالإدارة فقط', 'error');
      }
      this.activeTab = tab;
      if (tab === 'profile') {
        this.viewingPublicUid = null;
        if (this.user) this.loadProfileTabExtras(this.user.uid);
      }
      document.querySelectorAll('.nav-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tab);
      });
      try { history.pushState({ tab }, ''); } catch (e) {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.renderCurrentTab();
    },

    updateNotifBadge() {
      const badge = document.getElementById('daman-notif-badge');
      if (!badge) return;
      const unread = this.notifications.filter((n) => !n.read).length;
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    },

    // ==================== MAIN RENDER ROUTER (WITH HARD KYC WALL) ====================
    renderCurrentTab() {
      const main = document.getElementById('app-main');
      if (!main) return;

      // 1. Maintenance Mode Gate
      if (this.appConfig?.maintenanceMode && !this.hasAdminAccess()) {
        main.innerHTML = `
          <div class="glass-card rounded-3xl p-7 text-center space-y-3 mt-10 border-amber-500/40">
            <i class="fa-solid fa-screwdriver-wrench text-4xl text-amber-400"></i>
            <h2 class="text-base font-black text-white">التطبيق في وضع الصيانة والتطوير</h2>
            <p class="text-xs text-slate-300">نقوم بتحديثات سريعة لخدمتكم بشكل أفضل. سنعود خلال دقائق.</p>
          </div>`;
        return;
      }

      // 2. Banned User Gate
      if (this.user && this.profile && this.profile.status === 'banned' && !this.isAdmin()) {
        main.innerHTML = `
          <div class="glass-card rounded-3xl p-7 text-center space-y-3 mt-10 border-rose-500/60">
            <i class="fa-solid fa-ban text-4xl text-rose-500"></i>
            <h2 class="text-base font-black text-rose-400">تم إيقاف هذا الحساب من الإدارة</h2>
            <p class="text-xs text-slate-300">${this.esc(this.profile.banReason || 'للمراجعة يرجى التواصل مع إدارة ضمان سايت')}</p>
            <button onclick="DamanApp.handleHeaderAuthClick()" class="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-black">تسجيل الخروج</button>
          </div>`;
        return;
      }

      // 3. HARD MANDATORY KYC WALL (Non-admin signed-in users MUST verify ID + Selfie first)
      if (this.user && this.profile && !this.isKycVerified() && !this.viewingPublicUid) {
        this.renderMandatoryKycWall(main);
        return;
      }

      // 4. Public Profile View (Facebook-Style Page)
      if (this.viewingPublicUid) {
        this.renderFacebookProfile(main, this.viewingPublicUid);
        return;
      }

      // 5. Standard Tabs
      if (this.activeTab === 'home') return this.renderHomeTab(main);
      if (this.activeTab === 'profile') {
        if (!this.user) {
          main.innerHTML = `
            <div class="glass-card rounded-2xl p-7 text-center space-y-3 mt-6">
              <i class="fa-solid fa-user-lock text-3xl text-amber-400"></i>
              <h3 class="text-sm font-black text-white">سجّل الدخول لعرض صفحتك الشخصية</h3>
              <button onclick="DamanApp.openAuthModal('login')" class="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول / حساب جديد</button>
            </div>`;
          return;
        }
        return this.renderFacebookProfile(main, this.user.uid);
      }

      const mod = this.modules[this.activeTab];
      if (mod && typeof mod.render === 'function') {
        mod.render(main, this);
      } else {
        main.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">جارٍ تحميل القسم...</div>`;
      }
    },

    renderMandatoryKycWall(container) {
      const st = this.profile?.kycStatus || 'none';
      const isCompany = this.profile?.accountType === 'company' || this.profile?.accountType === 'supplier';
      const wa = this.appConfig?.supportWhatsapp || '201030374787';

      if (st === 'pending') {
        container.innerHTML = `
          <div class="glass-card rounded-3xl p-6 text-center space-y-4 mt-4 border-amber-500/50">
            <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl">
              <i class="fa-solid fa-hourglass-half animate-pulse"></i>
            </div>
            <h2 class="text-base font-black text-amber-400">حسابك قيد مراجعة التوثيق الإجباري</h2>
            <p class="text-xs text-slate-300 leading-relaxed">
              تم استلام مستندات التوثيق بنجاح. تقوم إدارة <b>ضمان سايت</b> حالياً بمطابقة البطاقة والسيلفي وتثبيت بياناتك القانونية لفتح المحفظة والسوق والعقود.
            </p>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="window.location.reload()" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-rotate me-1"></i> تحديث الحالة
              </button>
              <a href="https://wa.me/${wa}?text=${encodeURIComponent('مرحباً إدارة ضمان سايت، قمت برفع مستندات التوثيق وأرجو المراجعة لحسابي: ' + (this.profile?.phone || this.user?.email || ''))}" target="_blank" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
                <i class="fa-brands fa-whatsapp me-1 text-sm"></i> تواصل واتساب
              </a>
            </div>
            <button onclick="DamanApp.handleHeaderAuthClick()" class="text-[11px] text-rose-400 font-bold underline">تسجيل الخروج</button>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="glass-card rounded-3xl p-6 text-center space-y-4 mt-4 border-rose-500/50">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl">
            <i class="fa-solid fa-id-card-clip"></i>
          </div>
          <h2 class="text-base font-black text-white">توثيق الهوية إجباري قبل استخدام التطبيق</h2>
          ${st === 'rejected' ? `
            <div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/50 text-xs text-rose-200 font-bold">
              ❌ تم رفض التوثيق السابق: ${this.esc(this.profile?.kycRejectionReason || 'الصور غير واضحة — يرجى إعادة الرفع بوضوح')}
            </div>` : ''}
          <p class="text-xs text-slate-300 leading-relaxed">
            لحماية جميع الأطراف والأموال داخل <b>ضمان سايت</b>، لا يُسمح بالإيداع أو السحب أو النشر أو التعاقد إلا بعد توثيق الحساب.
            ${isCompany
              ? '<br/><b class="text-amber-300">مطلوب للشركات والموردين:</b> السجل التجاري + البطاقة الضريبية + بطاقة المسؤول (وش وضهر) + سيلفي.'
              : '<br/><b class="text-amber-300">مطلوب للأفراد والمقاولين:</b> بطاقة الرقم القومي (وش وضهر) + صورة سيلفي واضحة.'}
          </p>
          <button onclick="if(window.DamanWallet) DamanWallet.openKycModal(true)" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20">
            <i class="fa-solid fa-shield-check me-1.5"></i> ابدأ توثيق الحساب الآن
          </button>
          <div class="flex items-center justify-center gap-4 text-[11px]">
            <button onclick="DamanApp.openPrivacyModal()" class="text-slate-400 underline">سياسة الخصوصية</button>
            <button onclick="DamanApp.handleHeaderAuthClick()" class="text-rose-400 font-bold underline">تسجيل الخروج</button>
          </div>
        </div>`;
    },

    // ==================== HOME TAB ====================
    renderHomeTab(container) {
      const p = this.profile;
      const isBday = p && this.isBirthdayToday(p);
      const avail = Number(p?.balanceAvailable || 0);
      const esc = Number(p?.balanceEscrow || 0);
      const exp = Number(p?.subscriptionExpiresAt || 0);
      const expSoon = exp > Date.now() && exp - Date.now() <= 3 * 24 * 60 * 60 * 1000;

      container.innerHTML = `
        <div class="space-y-3.5">
          ${isBday ? `
            <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-500/25 via-rose-500/20 to-purple-500/25 border border-amber-400/60 text-center space-y-1">
              <div class="text-2xl">🎂🎉</div>
              <div class="text-sm font-black text-amber-300">كل سنة وأنت طيب يا ${this.esc(p.name)}!</div>
              <div class="text-[11px] text-slate-200">أسرة ضمان سايت تتمنى لك عاماً سعيداً ومليئاً بالنجاح والمشاريع المباركة.</div>
            </div>` : ''}

          ${expSoon ? `
            <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-between gap-2 text-xs">
              <span class="font-bold text-amber-200"><i class="fa-solid fa-clock me-1"></i> باقتك ستنتهي خلال أقل من 3 أيام!</span>
              <button onclick="DamanApp.switchTab('wallet')" class="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]">تجديد</button>
            </div>` : ''}

          <!-- Hero / Balance Banner -->
          <div class="glass-card rounded-3xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-amber-500/30 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="text-[11px] text-amber-400 font-extrabold">أهلاً بك في ضمان سايت 🏗️</div>
                <h1 class="text-base font-black text-white">${p ? this.esc(p.companyName || p.name) : 'أقوى منصة مقاولات وضمان مالي في مصر'}</h1>
              </div>
              ${p ? `<span class="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black"><i class="fa-solid fa-badge-check me-1"></i>موثّق</span>` : ''}
            </div>

            ${p ? `
              <div class="grid grid-cols-2 gap-2">
                <div onclick="DamanApp.switchTab('wallet')" class="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/30 cursor-pointer">
                  <div class="text-[10px] text-slate-400 font-bold">الرصيد المتاح</div>
                  <div class="text-base font-black text-emerald-400 mt-0.5">${this.fmtMoney(avail)} <span class="text-[10px]">ج.م</span></div>
                </div>
                <div onclick="DamanApp.switchTab('wallet')" class="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30 cursor-pointer">
                  <div class="text-[10px] text-slate-400 font-bold">محجوز بالضمان</div>
                  <div class="text-base font-black text-amber-400 mt-0.5">${this.fmtMoney(esc)} <span class="text-[10px]">ج.م</span></div>
                </div>
              </div>` : `
              <p class="text-xs text-slate-300 leading-relaxed">عقود رسمية بضمان مالي 100%، توريد خامات B2B، استلام هندسي بضمان 3 أضعاف، وإدارة متكاملة لشركات المقاولات والموظفين.</p>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanApp.openAuthModal('register')" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">إنشاء حساب موثّق</button>
                <button onclick="DamanApp.openAuthModal('login')" class="py-2.5 rounded-xl bg-slate-800 text-white font-black text-xs">تسجيل الدخول</button>
              </div>`}
          </div>

          <!-- Core Services Grid -->
          <div class="grid grid-cols-2 gap-2.5">
            <button onclick="DamanApp.switchTab('projects')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-amber-500/50">
              <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center"><i class="fa-solid fa-helmet-safety"></i></div>
              <div class="text-xs font-black text-white">السوق والموردين B2B</div>
              <div class="text-[10px] text-slate-400">مشاريع، صنايعية، وموردي خامات</div>
            </button>

            <button onclick="if(window.DamanProjects) DamanProjects.setSubTab('inspection'); DamanApp.switchTab('projects')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-emerald-500/50">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><i class="fa-solid fa-shield-halved"></i></div>
              <div class="text-xs font-black text-white">استلام هندسي بضمان 3x</div>
              <div class="text-[10px] text-slate-400">استلام شدات وأسقف بضمان 3 أضعاف</div>
            </button>

            <button onclick="if(window.DamanProjects) DamanProjects.setSubTab('viplabor'); DamanApp.switchTab('projects')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-purple-500/50">
              <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center"><i class="fa-solid fa-users-gear"></i></div>
              <div class="text-xs font-black text-white">توريد عمالة VIP</div>
              <div class="text-[10px] text-slate-400">فرق فنية مختبرة بضمان المنصة</div>
            </button>

            <button onclick="DamanApp.switchTab('company')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-sky-500/50">
              <div class="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center"><i class="fa-solid fa-building-user"></i></div>
              <div class="text-xs font-black text-white">إدارة الشركات والـ HR</div>
              <div class="text-[10px] text-slate-400">حضور GPS، رواتب، وعهدة وتقارير</div>
            </button>
          </div>

          <!-- Official Contract Verification + Share My Page -->
          <div class="grid grid-cols-2 gap-2.5">
            <button onclick="DamanApp.openVerifyContractModal()" class="p-3 rounded-2xl bg-slate-900 border border-slate-700 flex items-center gap-2.5 text-start">
              <i class="fa-solid fa-qrcode text-xl text-amber-400"></i>
              <div>
                <div class="text-[11px] font-black text-white">فحص عقد رسمي</div>
                <div class="text-[9.5px] text-slate-400">تحقق بكود العقد أو QR</div>
              </div>
            </button>
            <button onclick="${p ? `DamanApp.openShareProfileModal('${p.uid}')` : `DamanApp.openAuthModal('login')`}" class="p-3 rounded-2xl bg-slate-900 border border-slate-700 flex items-center gap-2.5 text-start">
              <i class="fa-solid fa-share-nodes text-xl text-emerald-400"></i>
              <div>
                <div class="text-[11px] font-black text-white">شارك صفحتك</div>
                <div class="text-[9.5px] text-slate-400">رابط مباشر + QR Code</div>
              </div>
            </button>
          </div>

          <!-- Direct Admin Support -->
          <button onclick="if(window.DamanChat) DamanChat.openDirectChat('admin','إدارة ضمان سايت')" class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border border-amber-500/40 flex items-center justify-between text-xs font-black text-amber-300">
            <span><i class="fa-solid fa-headset me-1.5"></i> تواصل مباشرة مع إدارة ضمان سايت</span>
            <i class="fa-solid fa-chevron-left"></i>
          </button>
        </div>`;
    },

    // ==================== FACEBOOK-STYLE USER/COMPANY/SUPPLIER PAGE ====================
    async openPublicProfile(uid) {
      if (!uid) return;
      this.viewingPublicUid = uid;
      this.profileSubTab = 'posts';
      this.publicProfileData = null;
      try { history.pushState({ publicProfile: uid }, ''); } catch (e) {}
      this.renderCurrentTab();

      try {
        const snap = await db.collection('users').doc(uid).get();
        if (!snap.exists) {
          this.toast('هذه الصفحة غير موجودة', 'error');
          this.viewingPublicUid = null;
          return this.renderCurrentTab();
        }
        this.publicProfileData = Object.assign({ uid: snap.id }, snap.data());
        await this.loadProfileTabExtras(uid);
        this.renderCurrentTab();
      } catch (e) {
        this.toast('تعذر تحميل الصفحة', 'error');
      }
    },

    async loadProfileTabExtras(uid) {
      try {
        const [postsSnap, portSnap, revSnap] = await Promise.all([
          db.collection('projects').where('ownerId', '==', uid).limit(25).get(),
          db.collection('userPortfolios').where('userId', '==', uid).limit(25).get(),
          db.collection('reviews').where('targetUserId', '==', uid).limit(30).get()
        ]);
        this.profilePosts = postsSnap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        this.profilePortfolio = portSnap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        this.profileReviews = revSnap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        this.renderCurrentTab();
      } catch (e) {}
    },

    setProfileSubTab(t) {
      this.profileSubTab = t;
      this.renderCurrentTab();
    },

    async toggleFollowUser(targetUid) {
      if (!this.user) return this.openAuthModal('login');
      if (targetUid === this.user.uid) return;
      const target = this.publicProfileData;
      const followers = Array.isArray(target?.followers) ? target.followers : [];
      const following = followers.includes(this.user.uid);
      try {
        await db.collection('users').doc(targetUid).update({
          followers: following
            ? firebase.firestore.FieldValue.arrayRemove(this.user.uid)
            : firebase.firestore.FieldValue.arrayUnion(this.user.uid)
        });
        if (target) {
          target.followers = following
            ? followers.filter((x) => x !== this.user.uid)
            : followers.concat([this.user.uid]);
        }
        this.toast(following ? 'تم إلغاء المتابعة' : 'تمت المتابعة بنجاح ✅', 'success');
        this.renderCurrentTab();
      } catch (e) { this.toast(e.message, 'error'); }
    },

    async uploadProfileMedia(input, field) {
      const file = input.files && input.files[0];
      if (!file || !this.user) return;
      try {
        this.toast('جارٍ رفع الصورة...', 'info');
        const b64 = await this.compressImage(file, field === 'coverPhoto' ? 900 : 400, 0.58);
        const patch = {};
        patch[field] = b64;
        await db.collection('users').doc(this.user.uid).update(patch);
        this.toast('تم تحديث الصورة بنجاح ✅', 'success');
      } catch (e) { this.toast('تعذر رفع الصورة', 'error'); }
      input.value = '';
    },

    openEditProfileModal() {
      const p = this.profile;
      if (!p) return;
      let m = document.getElementById('daman-edit-prof-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-edit-prof-modal';
        m.className = 'daman-modal fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 space-y-3 text-xs max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">تعديل بيانات الصفحة (اسم العرض)</h3>
            <button onclick="document.getElementById('daman-edit-prof-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <p class="text-[10px] text-slate-400">ملاحظة: اسم العرض يظهر في السوق وصفحتك العامة، بينما بياناتك القانونية الموثّقة من البطاقة محفوظة ومقفولة للعقود الرسمية فقط.</p>
          <form onsubmit="DamanApp.saveProfileEdit(event)" class="space-y-2.5">
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">اسم العرض / الشهرة أو اسم الشركة</label><input id="ep-name" type="text" required value="${this.esc(p.companyName || p.name || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">التخصص الرئيسي</label><input id="ep-spec" type="text" value="${this.esc(p.specialty || '')}" placeholder="مثال: مقاول نجارة مسلحة / مورد حديد وأسمنت" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">المحافظة / نطاق العمل</label><input id="ep-city" type="text" value="${this.esc(p.city || '')}" placeholder="مثال: القاهرة والجيزة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">نبذة عنك وسنوات الخبرة</label><textarea id="ep-bio" rows="3" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${this.esc(p.bio || '')}</textarea></div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ التعديلات</button>
          </form>
        </div>`;
    },

    async saveProfileEdit(e) {
      e.preventDefault();
      if (!this.user) return;
      const nameVal = document.getElementById('ep-name').value.trim();
      const patch = {
        name: nameVal,
        specialty: document.getElementById('ep-spec').value.trim(),
        city: document.getElementById('ep-city').value.trim(),
        bio: document.getElementById('ep-bio').value.trim()
      };
      if (this.profile?.accountType === 'company' || this.profile?.accountType === 'supplier') {
        patch.companyName = nameVal;
      }
      try {
        await db.collection('users').doc(this.user.uid).update(patch);
        document.getElementById('daman-edit-prof-modal').classList.add('hidden');
        this.toast('تم تحديث بيانات صفحتك ✅', 'success');
      } catch (err) { this.toast(err.message, 'error'); }
    },

    openAddPortfolioModal() {
      let m = document.getElementById('daman-port-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-port-modal';
        m.className = 'daman-modal fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      this._tempPortImg = '';
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-emerald-400">إضافة عمل جديد لمعرض سابقة الأعمال</h3>
            <button onclick="document.getElementById('daman-port-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanApp.submitPortfolioItem(event)" class="space-y-2.5">
            <input id="pt-title" type="text" required placeholder="عنوان العمل (مثال: شدة سقف فيلا بالتجمع)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="pt-desc" rows="2" placeholder="وصف مختصر للعمل والتاريخ والموقع..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <label class="block p-3 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-emerald-300"><i class="fa-solid fa-camera me-1"></i> اختر صورة العمل</span>
              <input type="file" accept="image/*" required class="hidden" onchange="DamanApp.handlePortPhoto(this)" />
              <div id="pt-prev"></div>
            </label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">نشر في معرض الأعمال</button>
          </form>
        </div>`;
    },

    async handlePortPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this._tempPortImg = await this.compressImage(f, 760, 0.58);
        const p = document.getElementById('pt-prev');
        if (p) p.innerHTML = `<img src="${this._tempPortImg}" class="max-h-32 mx-auto rounded-lg mt-2" />`;
      } catch (e) {}
    },

    async submitPortfolioItem(e) {
      e.preventDefault();
      if (!this.user || !this._tempPortImg) return this.toast('اختر صورة العمل أولاً', 'warning');
      try {
        await db.collection('userPortfolios').add({
          userId: this.user.uid,
          title: document.getElementById('pt-title').value.trim(),
          description: document.getElementById('pt-desc').value.trim(),
          imageBase64: this._tempPortImg,
          date: this.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('daman-port-modal').classList.add('hidden');
        this.toast('تم نشر العمل في صفحتك بنجاح ✅', 'success');
        await this.loadProfileTabExtras(this.user.uid);
      } catch (err) { this.toast(err.message, 'error'); }
    },

    async deletePortfolioItem(id) {
      if (!window.confirm('حذف هذا العمل من معرضك؟')) return;
      try {
        await db.collection('userPortfolios').doc(id).delete();
        this.profilePortfolio = this.profilePortfolio.filter((x) => x.id !== id);
        this.renderCurrentTab();
        this.toast('تم الحذف', 'info');
      } catch (e) { this.toast(e.message, 'error'); }
    },

    getProfileShareUrl(uid) {
      const base = window.location.origin + window.location.pathname;
      return `${base}?profile=${encodeURIComponent(uid)}`;
    },

    openShareProfileModal(uid, nameHint) {
      const url = this.getProfileShareUrl(uid);
      const displayName = nameHint || this.profile?.companyName || this.profile?.name || 'ضمان سايت';
      let m = document.getElementById('daman-share-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-share-modal';
        m.className = 'daman-modal fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-2xl p-4 space-y-3 text-center text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">مشاركة صفحة: ${this.esc(displayName)}</h3>
            <button onclick="document.getElementById('daman-share-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-3 bg-white rounded-2xl inline-block mx-auto">
            <div id="daman-profile-qr"></div>
          </div>
          <p class="text-[11px] text-slate-300">امسح كود الـ QR في الموقع أو شارك الرابط المباشر ليفتح التطبيق على صفحتك وسابقة أعمالك وتقييماتك فوراً.</p>
          <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-amber-300 break-all select-all">${this.esc(url)}</div>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="navigator.clipboard.writeText('${url}'); DamanApp.toast('تم نسخ الرابط بنجاح ✅','success')" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">
              <i class="fa-solid fa-copy me-1"></i> نسخ الرابط
            </button>
            <a href="https://wa.me/?text=${encodeURIComponent('تصفح صفحتي وسابقة أعمالي الموثقة على ضمان سايت:\n' + url)}" target="_blank" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center">
              <i class="fa-brands fa-whatsapp me-1 text-sm"></i> واتساب
            </a>
          </div>
        </div>`;

      setTimeout(() => {
        const qrEl = document.getElementById('daman-profile-qr');
        if (qrEl && window.QRCode) {
          qrEl.innerHTML = '';
          new QRCode(qrEl, { text: url, width: 156, height: 156, colorDark: '#000000', colorLight: '#ffffff' });
        }
      }, 60);
    },

    async reportUserOrPost(targetType, targetId, targetTitle) {
      if (!this.user) return this.openAuthModal('login');
      const reason = window.prompt(`سبب الإبلاغ عن ${targetTitle}:`, 'محتوى مخالف أو سلوك غير لائق');
      if (!reason || !reason.trim()) return;
      try {
        await db.collection('reports').add({
          targetType,
          targetId,
          targetTitle: targetTitle || '',
          reason: reason.trim(),
          reporterUid: this.user.uid,
          reporterName: this.profile?.name || '',
          status: 'open',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.sendNotification('ADMIN', 'بلاغ مستخدم جديد 🚨', `${targetTitle}: ${reason.trim()}`);
        this.toast('تم إرسال البلاغ للإدارة وسيتم مراجعته فوراً', 'success');
      } catch (e) { this.toast(e.message, 'error'); }
    },

    renderFacebookProfile(container, targetUid) {
      const isOwn = !!(this.user && targetUid === this.user.uid);
      const p = isOwn ? this.profile : this.publicProfileData;
      if (!p) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-xs text-slate-400">جارٍ تحميل الصفحة...</div>`;
        return;
      }

      const displayName = p.companyName || p.name || 'مستخدم ضمان سايت';
      const accLabels = { company: 'شركة مقاولات', supplier: 'مورّد خامات B2B', individual: 'مقاول / فني / عميل' };
      const followers = Array.isArray(p.followers) ? p.followers : [];
      const iFollow = !!(this.user && followers.includes(this.user.uid));
      const isSub = this.isSubscriptionActive(p);

      container.innerHTML = `
        <div class="space-y-3">
          ${!isOwn ? `
            <button onclick="DamanApp.viewingPublicUid=null; DamanApp.renderCurrentTab()" class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200">
              <i class="fa-solid fa-arrow-right me-1"></i> رجوع
            </button>` : ''}

          <!-- Facebook-Style Header Card (Cover + Avatar + Badges + Actions) -->
          <div class="glass-card rounded-3xl overflow-hidden border-slate-700/80">
            <!-- Cover Photo -->
            <div class="relative h-32 bg-gradient-to-r from-amber-600/40 via-slate-800 to-emerald-700/40">
              ${p.coverPhoto ? `<img src="${p.coverPhoto}" onclick="DamanLightbox.open('${p.coverPhoto}','صورة الغلاف')" class="w-full h-full object-cover cursor-pointer" />` : ''}
              ${isOwn ? `
                <label class="absolute top-2 end-2 px-2.5 py-1 rounded-xl bg-black/70 text-white text-[10px] font-bold cursor-pointer">
                  <i class="fa-solid fa-camera me-1"></i> غلاف
                  <input type="file" accept="image/*" class="hidden" onchange="DamanApp.uploadProfileMedia(this,'coverPhoto')" />
                </label>` : ''}
            </div>

            <div class="px-4 pb-4 -mt-10 relative space-y-2.5">
              <div class="flex items-end justify-between gap-2">
                <div class="relative">
                  <div class="w-20 h-20 rounded-2xl bg-slate-900 border-4 border-slate-950 overflow-hidden flex items-center justify-center text-2xl font-black text-amber-400 shadow-xl">
                    ${p.avatarPhoto
                      ? `<img src="${p.avatarPhoto}" onclick="DamanLightbox.open('${p.avatarPhoto}','${this.esc(displayName)}')" class="w-full h-full object-cover cursor-pointer" />`
                      : this.esc(displayName.charAt(0).toUpperCase())}
                  </div>
                  ${isOwn ? `
                    <label class="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer shadow">
                      <i class="fa-solid fa-camera text-[10px]"></i>
                      <input type="file" accept="image/*" class="hidden" onchange="DamanApp.uploadProfileMedia(this,'avatarPhoto')" />
                    </label>` : ''}
                </div>
                <div class="flex items-center gap-1.5 pb-1">
                  <button onclick="DamanApp.openShareProfileModal('${targetUid}','${this.esc(displayName).replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-black">
                    <i class="fa-solid fa-qrcode me-1"></i> مشاركة / QR
                  </button>
                  ${isOwn ? `<button onclick="DamanApp.openEditProfileModal()" class="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-[11px] font-bold"><i class="fa-solid fa-pen"></i></button>` : ''}
                </div>
              </div>

              <div>
                <div class="flex items-center flex-wrap gap-1.5">
                  <h2 class="text-base font-black text-white">${this.esc(displayName)}</h2>
                  ${p.kycStatus === 'verified' ? `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[9.5px] font-black"><i class="fa-solid fa-circle-check me-0.5"></i>موثّق</span>` : ''}
                  ${isSub ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[9.5px] font-black">★ VIP</span>` : ''}
                </div>
                <div class="text-[11px] text-amber-300 font-bold mt-0.5">${accLabels[p.accountType] || accLabels.individual}${p.specialty ? ' • ' + this.esc(p.specialty) : ''}</div>
                ${p.city ? `<div class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot me-1"></i>${this.esc(p.city)}</div>` : ''}
                ${p.bio ? `<p class="text-xs text-slate-300 mt-1.5 leading-relaxed">${this.esc(p.bio)}</p>` : ''}
              </div>

              <!-- Stats Strip -->
              <div class="grid grid-cols-3 gap-2 text-center pt-1">
                <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div class="text-xs font-black text-amber-400">⭐ ${Number(p.ratingAvg || 5).toFixed(1)}</div>
                  <div class="text-[9.5px] text-slate-400">(${Number(p.ratingCount || 0)} تقييم)</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div class="text-xs font-black text-white">${followers.length}</div>
                  <div class="text-[9.5px] text-slate-400">متابع</div>
                </div>
                <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div class="text-xs font-black text-emerald-400">${this.profilePortfolio.length}</div>
                  <div class="text-[9.5px] text-slate-400">سابقة أعمال</div>
                </div>
              </div>

              <!-- Visitor Action Buttons -->
              ${!isOwn ? `
                <div class="grid grid-cols-3 gap-1.5 pt-1">
                  <button onclick="DamanApp.toggleFollowUser('${targetUid}')" class="py-2 rounded-xl ${iFollow ? 'bg-slate-800 text-amber-400 border border-amber-500/40' : 'bg-sky-500 text-slate-950'} font-black text-[11px]">
                    <i class="fa-solid ${iFollow ? 'fa-user-check' : 'fa-user-plus'} me-1"></i> ${iFollow ? 'متابَع' : 'متابعة'}
                  </button>
                  <button onclick="if(window.DamanChat) DamanChat.openDirectChat('${targetUid}','${this.esc(displayName).replace(/'/g, "\\'")}','','طلب عرض سعر مباشر')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">
                    <i class="fa-solid fa-file-invoice-dollar me-1"></i> عرض سعر
                  </button>
                  <button onclick="DamanApp.reportUserOrPost('user','${targetUid}','${this.esc(displayName).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold text-[11px]">
                    <i class="fa-solid fa-flag me-1"></i> إبلاغ
                  </button>
                </div>` : `
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                  <button onclick="DamanApp.openAddPortfolioModal()" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">
                    <i class="fa-solid fa-plus me-1"></i> أضف سابقة أعمال
                  </button>
                  <button onclick="if(window.DamanProjects){ DamanProjects.openPostModal(); }" class="py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px]">
                    <i class="fa-solid fa-bullhorn me-1"></i> نشر إعلان / منشور
                  </button>
                </div>`}
            </div>
          </div>

          <!-- 3 Sub-Tabs (Posts | Portfolio | Reviews) -->
          <div class="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-extrabold">
            <button onclick="DamanApp.setProfileSubTab('posts')" class="py-2 rounded-lg ${this.profileSubTab === 'posts' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">المنشورات (${this.profilePosts.length})</button>
            <button onclick="DamanApp.setProfileSubTab('portfolio')" class="py-2 rounded-lg ${this.profileSubTab === 'portfolio' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">سابقة الأعمال (${this.profilePortfolio.length})</button>
            <button onclick="DamanApp.setProfileSubTab('reviews')" class="py-2 rounded-lg ${this.profileSubTab === 'reviews' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">التقييمات (${this.profileReviews.length})</button>
          </div>

          ${this.profileSubTab === 'posts' ? `
            <div class="space-y-2">
              ${!this.profilePosts.length
                ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد منشورات بعد.</div>`
                : this.profilePosts.map((po) => {
                    const boosted = Number(po.boostedUntil || 0) > Date.now();
                    return `
                      <div class="glass-card rounded-2xl p-3.5 space-y-1.5 ${boosted ? 'border-amber-500/60' : ''}">
                        <div class="flex items-center justify-between gap-2">
                          <div class="text-xs font-black text-white">${boosted ? '★ ' : ''}${this.esc(po.title)}</div>
                          <span class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-bold">${this.esc(po.status || 'approved')}</span>
                        </div>
                        <p class="text-[11px] text-slate-300">${this.esc(po.description || '')}</p>
                        <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <span>${po.budget ? this.fmtMoney(po.budget) + ' ج.م' : ''} • ${this.esc(po.city || '')}</span>
                          ${isOwn && window.DamanProjects ? `<button onclick="DamanProjects.openEditPostModal('${po.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold">تعديل</button>` : ''}
                        </div>
                      </div>`;
                  }).join('')}
            </div>` : ''}

          ${this.profileSubTab === 'portfolio' ? `
            <div class="grid grid-cols-2 gap-2.5">
              ${!this.profilePortfolio.length
                ? `<div class="col-span-2 glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد صور في معرض سابقة الأعمال بعد.</div>`
                : this.profilePortfolio.map((item) => `
                  <div class="glass-card rounded-2xl overflow-hidden space-y-1.5 pb-2">
                    <img src="${item.imageBase64}" onclick="DamanLightbox.open('${item.imageBase64}','${this.esc(item.title)}')" class="w-full h-32 object-cover cursor-pointer" />
                    <div class="px-2.5 space-y-0.5">
                      <div class="text-[11px] font-black text-white truncate">${this.esc(item.title)}</div>
                      ${item.description ? `<div class="text-[10px] text-slate-400 line-clamp-2">${this.esc(item.description)}</div>` : ''}
                      <div class="flex items-center justify-between text-[9px] text-slate-500 pt-1">
                        <span>${this.esc(item.date || '')}</span>
                        ${isOwn ? `<button onclick="DamanApp.deletePortfolioItem('${item.id}')" class="text-rose-400 font-bold">حذف</button>` : ''}
                      </div>
                    </div>
                  </div>`).join('')}
            </div>` : ''}

          ${this.profileSubTab === 'reviews' ? `
            <div class="space-y-2">
              ${!this.profileReviews.length
                ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد تقييمات بعد.</div>`
                : this.profileReviews.map((rv) => `
                  <div class="glass-card rounded-2xl p-3 space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-black text-white">${this.esc(rv.fromName || 'عميل')}</span>
                      <span class="text-amber-400 font-black">${'★'.repeat(Number(rv.rating || 5))}</span>
                    </div>
                    <p class="text-[11px] text-slate-300">${this.esc(rv.comment || '')}</p>
                  </div>`).join('')}
            </div>` : ''}

          <!-- Own Account Legal & Security Settings (Google Play Compliant) -->
          ${isOwn ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2.5 text-xs">
              <div class="font-black text-amber-400"><i class="fa-solid fa-shield-halved me-1"></i> البيانات القانونية الموثّقة وإعدادات الأمان</div>
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                <div>الاسم بالبطاقة (للعقود): <b class="text-white">${this.esc(p.legalName || 'غير مثبت بعد')}</b></div>
                <div>الرقم القومي: <b class="text-emerald-400">${this.maskNationalId(p.nationalId)}</b></div>
                <div>تاريخ الميلاد: <b class="text-amber-300">${this.esc(p.birthDate || '—')}</b></div>
                <div>العنوان بالبطاقة: <b class="text-slate-300">${this.esc(p.legalAddress || '—')}</b></div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanApp.openChangePasswordModal()" class="py-2 rounded-xl bg-slate-800 text-sky-300 font-bold text-[11px]"><i class="fa-solid fa-key me-1"></i>تغيير كلمة المرور</button>
                <button onclick="DamanApp.openPrivacyModal()" class="py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-[11px]"><i class="fa-solid fa-file-contract me-1"></i>الخصوصية والشروط</button>
              </div>
              ${!this.isAdmin() ? `
                <button onclick="DamanApp.requestDeleteAccount()" class="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-[11px]">
                  <i class="fa-solid fa-user-xmark me-1"></i> طلب حذف الحساب نهائياً
                </button>` : ''}
            </div>` : ''}
        </div>`;
    },

    // ==================== AUTH MODAL (LOGIN / REGISTER / SMART FORGOT PASSWORD) ====================
    openAuthModal(mode = 'login') {
      let m = document.getElementById('daman-auth-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-auth-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const isReg = mode === 'register';
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-5 space-y-3.5 max-h-[92vh] overflow-y-auto text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-black text-amber-400">${isReg ? 'إنشاء حساب جديد في ضمان سايت' : 'تسجيل الدخول'}</h3>
            <button onclick="document.getElementById('daman-auth-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl">
            <button onclick="DamanApp.openAuthModal('login')" class="py-2 rounded-lg font-black ${!isReg ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">دخول</button>
            <button onclick="DamanApp.openAuthModal('register')" class="py-2 rounded-lg font-black ${isReg ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">حساب جديد</button>
          </div>

          ${isReg ? `
            <form onsubmit="DamanApp.submitRegister(event)" class="space-y-2.5">
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">اسم العرض / الشهرة أو اسم الشركة</label><input id="rg-name" type="text" required placeholder="مثال: م. أحمد / أبو محمد / شركة النور" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">نوع الحساب</label>
                <select id="rg-type" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                  <option value="individual">فرد / مقاول / فني / عميل</option>
                  <option value="company">شركة مقاولات / مكتب هندسي</option>
                  <option value="supplier">مورّد خامات ومواد بناء (B2B)</option>
                </select>
              </div>
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">رقم الموبايل المصري</label><input id="rg-phone" type="tel" required placeholder="01xxxxxxxxx" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">البريد الإلكتروني (اختياري — يُنصح به لاستعادة كلمة المرور)</label><input id="rg-email" type="email" placeholder="example@gmail.com" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">كلمة المرور (6 أحرف على الأقل)</label><input id="rg-pass" type="password" minlength="6" required class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <label class="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input id="rg-terms" type="checkbox" required class="mt-0.5 accent-amber-500" />
                <span class="text-[10.5px] text-slate-300 leading-relaxed">
                  أوافق على <b class="text-amber-400 underline" onclick="event.preventDefault(); DamanApp.openPrivacyModal()">الشروط والأحكام وسياسة الخصوصية</b> وأوافق على تسجيل المكالمات داخل التطبيق لمدة 30 يوماً لحفظ الحقوق.
                </span>
              </label>
              <button type="submit" class="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black">إنشاء الحساب والمتابعة للتوثيق</button>
            </form>` : `
            <form onsubmit="DamanApp.submitLogin(event)" class="space-y-2.5">
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">البريد الإلكتروني أو رقم الموبايل</label><input id="lg-id" type="text" required placeholder="01xxxxxxxxx أو email@gmail.com" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">كلمة المرور</label><input id="lg-pass" type="password" required class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <button type="submit" class="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black">دخول</button>
              <button type="button" onclick="DamanApp.handleForgotPassword()" class="w-full text-center text-[11px] text-sky-400 font-bold underline pt-1">نسيت كلمة المرور؟</button>
            </form>`}
        </div>`;
    },

    async submitRegister(e) {
      e.preventDefault();
      await this.withLock('register', async () => {
        const name = document.getElementById('rg-name').value.trim();
        const accountType = document.getElementById('rg-type').value;
        const phone = this.normalizePhone(document.getElementById('rg-phone').value);
        const rawEmail = document.getElementById('rg-email').value.trim().toLowerCase();
        const pass = document.getElementById('rg-pass').value;
        const terms = document.getElementById('rg-terms').checked;

        if (!terms) return this.toast('يجب الموافقة على الشروط وتسجيل المكالمات أولاً', 'warning');
        if (!/^01[0125]\d{8}$/.test(phone)) return this.toast('أدخل رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01)', 'error');

        const authEmail = rawEmail || `${phone}@phone.damansite.app`;
        const bl = await this.checkBlacklist({ email: authEmail, phone });
        if (bl) return this.toast(`تعذر التسجيل: ${bl}`, 'error');

        // Prevent Duplicate Phone
        const dupPhone = await db.collection('users').where('phone', '==', phone).limit(1).get();
        if (!dupPhone.empty) return this.toast('رقم الموبايل مسجّل بالفعل بحساب آخر', 'error');

        try {
          const cred = await auth.createUserWithEmailAndPassword(authEmail, pass);
          await db.collection('users').doc(cred.user.uid).set({
            name,
            companyName: accountType !== 'individual' ? name : '',
            accountType,
            phone,
            email: authEmail,
            isPhoneAccount: !rawEmail,
            kycStatus: 'none',
            status: 'active',
            balanceAvailable: 0,
            balanceEscrow: 0,
            ratingAvg: 5,
            ratingCount: 0,
            followers: [],
            termsAcceptedAt: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          document.getElementById('daman-auth-modal').classList.add('hidden');
          this.toast('تم إنشاء الحساب! يرجى استكمال التوثيق الإجباري الآن', 'success');
        } catch (err) {
          this.toast(err.code === 'auth/email-already-in-use' ? 'هذا البريد أو الرقم مسجّل بالفعل' : err.message, 'error');
        }
      });
    },

    async submitLogin(e) {
      e.preventDefault();
      await this.withLock('login', async () => {
        let id = document.getElementById('lg-id').value.trim();
        const pass = document.getElementById('lg-pass').value;
        if (!id.includes('@')) {
          const p = this.normalizePhone(id);
          id = `${p}@phone.damansite.app`;
        }
        try {
          await auth.signInWithEmailAndPassword(id.toLowerCase(), pass);
          document.getElementById('daman-auth-modal').classList.add('hidden');
          this.toast('مرحباً بعودتك في ضمان سايت ✅', 'success');
        } catch (err) {
          this.toast('بيانات الدخول غير صحيحة، تأكد من البريد/الموبايل وكلمة المرور', 'error');
        }
      });
    },

    async handleForgotPassword() {
      const id = (document.getElementById('lg-id')?.value || '').trim();
      const input = id || window.prompt('أدخل بريدك الإلكتروني أو رقم الموبايل المسجّل:');
      if (!input) return;
      if (!input.includes('@') || input.endsWith('@phone.damansite.app')) {
        const wa = this.appConfig?.supportWhatsapp || '201030374787';
        if (window.confirm('حسابات رقم الموبايل تتطلب التحقق ببطاقة الهوية عبر واتساب الدعم لإعادة تعيين كلمة المرور.\nهل تريد فتح واتساب الدعم الآن؟')) {
          window.open(`https://wa.me/${wa}?text=${encodeURIComponent('مرحباً إدارة ضمان سايت، نسيت كلمة المرور لحسابي برقم: ' + input)}`, '_blank');
        }
        return;
      }
      try {
        await auth.sendPasswordResetEmail(input.toLowerCase());
        this.toast('تم إرسال رابط استعادة كلمة المرور لبريدك الإلكتروني ✅', 'success');
      } catch (e) { this.toast('تعذر إرسال الرابط — تأكد من صحة البريد الإلكتروني', 'error'); }
    },

    openChangePasswordModal() {
      const np = window.prompt('أدخل كلمة المرور الجديدة (6 أحرف على الأقل):');
      if (!np || np.length < 6) return this.toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
      if (!this.user) return;
      this.user.updatePassword(np)
        .then(() => this.toast('تم تغيير كلمة المرور بنجاح ✅', 'success'))
        .catch(() => this.toast('لأمان حسابك، سجّل خروج ثم ادخل مرة أخرى وحاول التغيير فوراً', 'warning'));
    },

    // Google Play Mandatory Account Deletion (Locked if user has balance/escrow/active contracts)
    async requestDeleteAccount() {
      if (!this.user || !this.profile) return;
      if (Number(this.profile.balanceAvailable || 0) > 0 || Number(this.profile.balanceEscrow || 0) > 0) {
        return this.toast('لا يمكن حذف الحساب طالما لديك رصيد متاح أو محجوز بالضمان — يرجى تصفية محفظتك أولاً', 'error');
      }
      try {
        const [ag1, ag2] = await Promise.all([
          db.collection('chatAgreements').where('payerUid', '==', this.user.uid).limit(10).get(),
          db.collection('chatAgreements').where('createdBy', '==', this.user.uid).limit(10).get()
        ]);
        const hasOpen = [...ag1.docs, ...ag2.docs].some((d) => ['active', 'disputed'].includes(d.data().status));
        if (hasOpen) {
          return this.toast('لا يمكن حذف الحساب لوجود عقد نشط أو نزاع مفتوح حالياً', 'error');
        }
        if (!window.confirm('هل أنت متأكد من طلب حذف حسابك نهائياً؟ سيتم إيقاف الحساب ومراجعة الطلب من الإدارة.')) return;
        await db.collection('supportTickets').add({
          userId: this.user.uid,
          userName: this.profile.name || '',
          userEmail: this.profile.email || '',
          subject: 'طلب حذف حساب نهائياً (Google Play Policy)',
          message: 'يرجى حذف حسابي نهائياً بعد التحقق من خلوه من أي التزامات.',
          status: 'open',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.sendNotification('ADMIN', 'طلب حذف حساب', this.profile.name || this.user.uid);
        this.toast('تم استلام طلب حذف الحساب بنجاح وسيتم تنفيذه خلال 48 ساعة', 'info');
      } catch (e) { this.toast(e.message, 'error'); }
    },

    // ==================== CONTRACT QR/CODE VERIFICATION MODAL ====================
    async openVerifyContractModal(presetCode = '') {
      let m = document.getElementById('daman-verify-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-verify-modal';
        m.className = 'daman-modal fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-2xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-qrcode me-1"></i> التحقق من صحة عقد ضمان سايت</h3>
            <button onclick="document.getElementById('daman-verify-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanApp.runContractVerify(event)" class="flex gap-2">
            <input id="vc-code" type="text" required value="${this.esc(presetCode)}" placeholder="أدخل كود العقد (مثال: TKT-123456)" class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold uppercase" />
            <button type="submit" class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black">فحص</button>
          </form>
          <div id="vc-result"></div>
        </div>`;
      if (presetCode) this.runContractVerify(null, presetCode);
    },

    async runContractVerify(e, forcedCode) {
      if (e) e.preventDefault();
      const code = (forcedCode || document.getElementById('vc-code')?.value || '').trim().toUpperCase();
      const resBox = document.getElementById('vc-result');
      if (!code || !resBox) return;
      resBox.innerHTML = `<div class="text-center text-slate-400 py-3">جارٍ الفحص في قاعدة البيانات...</div>`;
      try {
        const snap = await db.collection('chatAgreements').where('ticketNumber', '==', code).limit(1).get();
        if (snap.empty) {
          resBox.innerHTML = `<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-300 font-bold text-center">❌ هذا الكود غير مسجّل في ضمان سايت — احذر من العقود المزوّرة!</div>`;
          return;
        }
        const a = snap.docs[0].data();
        const stMap = {
          active: '✅ عقد ساري ومموّل 100% بالضمان',
          completed: '🏁 عقد مكتمل وتمت تصفيته بالكامل',
          cancelled: '❌ عقد مفسوخ ومُلغى',
          disputed: '⚖️ عقد قيد النزاع أمام الإدارة',
          proposed: '⏳ عرض سعر مبدئي غير مموّل بعد'
        };
        resBox.innerHTML = `
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-1.5 text-[11px]">
            <div class="font-black text-emerald-300 text-center">${stMap[a.status] || a.status}</div>
            <div>كود العقد: <b class="text-white">${this.esc(a.ticketNumber)}</b></div>
            <div>البند: <b class="text-white">${this.esc(a.title)}</b></div>
            <div>القيمة المعتمدة: <b class="text-amber-300">${this.fmtMoney(a.totalAmount)} ج.م</b></div>
            <div>اعتماد النسخة الموقّعة: <b class="text-white">${a.contractStatus === 'approved' ? 'معتمد من الإدارة ✅' : 'بانتظار الاعتماد'}</b></div>
            <div>الطرف الأول: <b>${this.esc(a.payerName || '—')}</b></div>
            <div>الطرف الثاني: <b>${this.esc(a.providerName || a.createdByName || '—')}</b></div>
          </div>`;
      } catch (err) {
        resBox.innerHTML = `<div class="text-rose-400 text-center">يرجى تسجيل الدخول للتحقق من تفاصيل العقد.</div>`;
      }
    },

    // ==================== NOTIFICATIONS & PRIVACY MODALS ====================
    openNotificationsModal() {
      let m = document.getElementById('daman-notifs-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-notifs-modal';
        m.className = 'daman-modal fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-4 max-h-[85vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-bell me-1"></i> الإشعارات (${this.notifications.length})</h3>
            <button onclick="document.getElementById('daman-notifs-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          ${!this.notifications.length
            ? `<div class="text-center text-slate-400 py-8">لا توجد إشعارات حالياً</div>`
            : this.notifications.map((n) => `
              <div class="p-3 rounded-xl ${n.read ? 'bg-slate-950/60 border-slate-800' : 'bg-amber-500/10 border-amber-500/40'} border space-y-1">
                <div class="font-black text-white">${this.esc(n.title)}</div>
                <div class="text-[11px] text-slate-300 leading-relaxed">${this.esc(n.body)}</div>
              </div>`).join('')}
        </div>`;

      // Mark unread as read
      this.notifications.filter((n) => !n.read).forEach((n) => {
        db.collection('notifications').doc(n.id).update({ read: true }).catch(() => {});
      });
    },

    openPrivacyModal() {
      let m = document.getElementById('daman-privacy-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-privacy-modal';
        m.className = 'daman-modal fixed inset-0 z-[95] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 max-h-[85vh] overflow-y-auto space-y-2.5 text-xs leading-relaxed text-slate-300">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">سياسة الخصوصية والشروط القانونية — ضمان سايت</h3>
            <button onclick="document.getElementById('daman-privacy-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <p>1. <b>التوثيق الإلزامي:</b> تُستخدم صور بطاقة الرقم القومي والسيلفي والسجل التجاري حصرياً للتحقق من هوية المتعاقدين وتثبيت البيانات القانونية داخل العقود الرسمية، وتُحفظ بسرية تامة ولا تُعرض للعامة.</p>
          <p>2. <b>الضمان المالي:</b> لا يُعتمد أي عقد إلا بعد حجز 100% من قيمة التعاقد + عمولة المنصة (3.5%) ورفع نسخة العقد الموقّع واعتماده من الإدارة.</p>
          <p>3. <b>تسجيل المكالمات:</b> تُسجّل المكالمات الصوتية داخل التطبيق لحماية حقوق الطرفين والفصل في النزاعات، وتُحذف تلقائياً بعد 30 يوماً ما لم يكن هناك نزاع قائم.</p>
          <p>4. <b>حذف البيانات:</b> يحق لكل مستخدم طلب حذف حسابه من إعدادات «صفحتي» بشرط عدم وجود أرصدة معلّقة أو عقود نشطة أو نزاعات قائمة.</p>
          <button onclick="document.getElementById('daman-privacy-modal').classList.add('hidden')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">فهمت وأوافق</button>
        </div>`;
    }
  };

  window.DamanApp = DamanApp;
  window.addEventListener('DOMContentLoaded', () => DamanApp.init());
})();
