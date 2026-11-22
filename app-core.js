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

  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  const ADMIN_EMAIL = 'adelnabilabdullah@gmail.com';
  const APP_VERSION = '24';

  const MODULE_FILES = {
    wallet: `wallet-kyc.js?v=${APP_VERSION}`,
    chat: `chat-support.js?v=${APP_VERSION}`,
    projects: `projects-escrow.js?v=${APP_VERSION}`,
    company: `company-panel.js?v=${APP_VERSION}`,
    admin: `admin.js?v=${APP_VERSION}`
  };

  // 6 Official Built-in DamanSite Home Promo Ads (Editable/Toggleable from Admin)
  const OFFICIAL_HOME_BANNERS = [
    {
      id: 'off_1',
      badge: '🛡️ الأكثر طلباً — ضمان مالي 3 أضعاف (3x)',
      title: 'باقة استلام السقف الكاملة (3 زيارات هندسية بـ 9,000 ج.م)',
      subtitle: 'استلام الخامات + الشدة والحدادة قبل الصب + الإشراف أثناء الصب بتقرير هندسي معتمد وضمان مادي 3 أضعاف.',
      ctaText: 'احجز استلام 3x الآن',
      action: 'inspection',
      theme: 'emerald'
    },
    {
      id: 'off_2',
      badge: '🔒 حماية أموالك 100% — نظام الضمان المالي',
      title: 'تعاقد بعقد رسمي A4 بالرقم القومي وتواريخ التنفيذ بدون قلق',
      subtitle: 'احجز 100% من قيمة الشغل بالمحفظة، وقّع باللمس، واطبع عقدك بكود QR — ولا يُصرف جنيه قبل الاستلام الفعلي.',
      ctaText: 'تصفح السوق وتعاقد',
      action: 'market',
      theme: 'amber'
    },
    {
      id: 'off_3',
      badge: '👷 توريد فوري للمواقع — عمالة VIP',
      title: 'فرق نجارين وحدادين ومحارة وتشطيبات مختبرة بضمان المنصة',
      subtitle: 'اطلب عدد العمال والتخصص والموقع، ونجهزلك فرقة محترفة جاهزة للنزول الفوري بضمان الالتزام والجودة.',
      ctaText: 'اطلب فرقة VIP',
      action: 'viplabor',
      theme: 'purple'
    },
    {
      id: 'off_4',
      badge: '🚚 توريدات B2B بأسعار المصنع',
      title: 'حديد وأسمنت وخرسانة جاهزة وشدات معدنية بدفع آمن عند الاستلام',
      subtitle: 'تواصل مباشرة مع موردين موثّقين بالضمان المالي واستلم خامات موقعك بالوزن والمواصفة المعتمدة.',
      ctaText: 'دليل الموردين B2B',
      action: 'suppliers',
      theme: 'sky'
    },
    {
      id: 'off_5',
      badge: '🏢 منظومة شركات المقاولات والـ HR',
      title: 'أدِر مواقعك وموظفيك بالـ GPS والرواتب والعهدة والتقارير اليومية',
      subtitle: 'كشف تلقائي للحضور خارج الموقع، مستخلصات مقاولين، إشعارات خصم، جرد، صب خرسانة، ورواتب A4.',
      ctaText: 'افتح لوحة الشركات',
      action: 'company',
      theme: 'sky'
    },
    {
      id: 'off_6',
      badge: '★ ضاعف شغلك ومبيعاتك',
      title: 'ميّز إعلانك بأعلى السوق أو اشترك في باقة VIP الآن',
      subtitle: 'اظهر في الصفحة الرئيسية وأول نتائج البحث أمام آلاف المقاولين وشركات التطوير والموردين في مصر.',
      ctaText: 'عرض الباقات والتمييز',
      action: 'wallet',
      theme: 'amber'
    }
  ];

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
      appName: 'ضمان سايت',
      tagline: 'الضمان المالي والمقاولات B2B',
      navHome: 'الرئيسية', navProjects: 'السوق', navChat: 'الشات',
      navCompany: 'الشركات', navWallet: 'المحفظة', navProfile: 'صفحتي',
      loginBtn: 'تسجيل الدخول', registerBtn: 'حساب جديد', logoutBtn: 'خروج',
      currency: 'ج.م'
    },
    en: {
      appName: 'DamanSite',
      tagline: 'Escrow & B2B Contracting',
      navHome: 'Home', navProjects: 'Market', navChat: 'Chat',
      navCompany: 'Companies', navWallet: 'Wallet', navProfile: 'Profile',
      loginBtn: 'Sign In', registerBtn: 'Sign Up', logoutBtn: 'Logout',
      currency: 'EGP'
    }
  };

  const DEFAULT_PRIVACY = `1. التوثيق الإلزامي بالهوية: تُحفظ صور بطاقة الرقم القومي والسيلفي والسجل التجاري بسرية تامة داخل خزنة مشفّرة، وتُستخدم البيانات القانونية (الاسم الرباعي، الرقم القومي، العنوان) داخل العقود الرسمية فقط ولا تُعرض للعامة.
2. الضمان المالي 100%: لا يُعتمد أي عقد إلا بعد حجز 100% من قيمته + عمولة المنصة في المحفظة، وتوقيع العقد ورفع صورته لاعتماد الإدارة.
3. تسجيل المكالمات: تُسجّل المكالمات الصوتية داخل التطبيق تلقائياً لحفظ الحقوق عند النزاعات، وتُحذف بعد 30 يوماً ما لم يتم تثبيتها لنزاع قائم.
4. رصيد الهدايا والبرومو: يُستخدم في الباقات وتمييز الإعلانات والخدمات ولا يُسحب نقداً.
5. النزاعات والتحكيم: قرار إدارة ضمان سايت في النزاعات ملزم للطرفين استناداً إلى العقد الموقّع والمحادثات والصور وتقارير الحضور.`;

  const DamanApp = {
    auth,
    db,
    ADMIN_EMAIL,
    APP_VERSION,
    CATEGORIES,
    OFFICIAL_HOME_BANNERS,
    lang: localStorage.getItem('daman_lang') || 'ar',
    activeTab: 'home',
    user: null,
    profile: null,

    // Complete Dynamic AppConfig Controlled 100% from Admin Panel
    appConfig: {
      branding: {
        appNameAr: 'ضمان سايت',
        appNameEn: 'DamanSite',
        taglineAr: 'الضمان المالي والمقاولات B2B',
        taglineEn: 'Escrow & B2B Contracting',
        heroWelcome: 'أهلاً بك في ضمان سايت 🏗️',
        heroGuestTitle: 'أقوى منصة مقاولات وضمان مالي في مصر',
        heroGuestDesc: 'عقود رسمية بضمان مالي 100%، توريد خامات B2B، استلام هندسي بضمان 3 أضعاف، وإدارة متكاملة لشركات المقاولات والموظفين.',
        facebookUrl: '',
        privacyText: DEFAULT_PRIVACY
      },
      announcement: {
        enabled: false,
        text: '',
        color: 'amber', // 'amber' | 'emerald' | 'rose' | 'sky'
        action: 'none'
      },
      commissionRate: 0.035,
      vipCommissionRate: 0.10,
      minDeposit: 100,
      maxDeposit: 250000,
      minWithdraw: 100,
      maxWithdrawDaily: 50000,
      withdrawFeePct: 0,
      withdrawFeeFlat: 0,
      channelWithdrawFees: {
        vodafone_cash: { pct: '', flat: '' },
        instapay: { pct: '', flat: '' },
        bank: { pct: '', flat: '' }
      },
      depositSessionMinutes: 10,
      depositChannels: { vodafone_cash: true, instapay: true, bank: true },
      withdrawChannels: { vodafone_cash: true, instapay: true, bank: false },
      openingBalances: { vodafone_cash: 0, instapay: 0, bank: 0 },
      backupAccounts: { vodafoneCash: [], instaPay: [], bank: [] },
      paymentAccounts: {
        vodafoneCash: '01030374787',
        vodafoneHolder: 'ضمان سايت',
        instaPay: 'adelnabil@instapay',
        instaPayHolder: 'ضمان سايت',
        bankInfo: 'سيتم التحديث من لوحة الإدارة',
        bankIban: ''
      },
      packages: {
        individualMonthly: 150,
        companyMonthly: 450,
        boostAdPrice: 75
      },
      requireKycForActions: true,
      maintenanceMode: false,
      maintenanceMessage: 'نقوم حالياً بتحديثات سريعة لتحسين الخدمة، سنعود خلال دقائق.',
      disableRegistrations: false,
      disableDeposits: false,
      disableWithdrawals: false,
      disableCalls: false,
      disableNewContracts: false,
      disableMarketPosting: false,
      hideOfficialBanners: false,
      hideDemoPosts: false,
      customHomeBanners: [],
      moderators: [],
      moderatorPerms: {},
      supportWhatsapp: '201030374787',
      turnServer: '',
      forceReloadVersion: 0
    },

    modules: {},
    loadingMods: {},
    failedMods: {},
    notifications: [],
    unsubProfile: null,
    unsubConfig: null,
    unsubNotifs: null,

    viewingPublicUid: null,
    publicProfileData: null,
    profileSubTab: 'posts',
    profilePosts: [],
    profilePortfolio: [],
    profileReviews: [],
    mediaCache: {},
    pendingDeepLink: null,
    dismissedAnnText: '',

    // ==================== CORE HELPERS ====================
    t(key) {
      const br = this.appConfig?.branding || {};
      if (key === 'appName') return this.lang === 'ar' ? (br.appNameAr || I18N.ar.appName) : (br.appNameEn || I18N.en.appName);
      if (key === 'tagline') return this.lang === 'ar' ? (br.taglineAr || I18N.ar.tagline) : (br.taglineEn || I18N.en.tagline);
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

    todayLocal() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    addDaysLocal(baseDateStr, days) {
      const base = baseDateStr ? new Date(baseDateStr + 'T12:00:00') : new Date();
      base.setDate(base.getDate() + (parseInt(days, 10) || 0));
      return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    },

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
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', quality));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async saveMedia(base64, meta = {}) {
      if (!base64) return '';
      const ref = await db.collection('mediaVault').add({
        data: base64,
        ownerId: this.user ? this.user.uid : '',
        kind: meta.kind || 'image',
        date: this.todayLocal(),
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
      const openFn = (src) => {
        if (window.DamanLightbox) window.DamanLightbox.open(src, title);
        else window.open(src, '_blank');
      };
      if (String(mediaIdOrBase64).startsWith('data:')) return openFn(mediaIdOrBase64);
      this.toast('جارٍ تحميل الصورة...', 'info');
      const src = await this.fetchMedia(mediaIdOrBase64);
      if (src) openFn(src);
      else this.toast('تعذر تحميل الصورة', 'error');
    },

    async withLock(key, fn) {
      this._locks = this._locks || {};
      if (this._locks[key]) return;
      this._locks[key] = true;
      try { return await fn(); } finally { setTimeout(() => { this._locks[key] = false; }, 600); }
    },

    toast(msg, type = 'info') {
      let box = document.getElementById('daman-toast-container');
      if (!box) {
        box = document.createElement('div');
        box.id = 'daman-toast-container';
        box.className = 'fixed top-16 inset-x-3 z-[125] max-w-md mx-auto space-y-2 pointer-events-none';
        document.body.appendChild(box);
      }
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
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3600);
    },

    async sendNotification(targetUid, title, body) {
      if (!targetUid) return;
      try {
        await db.collection('notifications').add({
          userId: targetUid,
          title: String(title || '').slice(0, 120),
          body: String(body || '').slice(0, 300),
          read: false,
          date: this.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {}
    },

    async logAudit(action, details, targetId = '') {
      if (!this.user) return;
      try {
        await db.collection('auditLogs').add({
          actorUid: this.user.uid,
          actorEmail: this.user.email || '',
          actorName: this.profile?.name || this.user.email || '',
          action,
          details: String(details || '').slice(0, 400),
          targetId: String(targetId || ''),
          date: this.todayLocal(),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {}
    },

    // ==================== ROLES, RBAC, CONFIG & BLACKLIST ====================
    isAdmin() {
      return !!(this.user && (this.user.email || '').toLowerCase() === ADMIN_EMAIL);
    },

    isMod() {
      if (!this.user || this.isAdmin()) return false;
      const email = (this.user.email || '').toLowerCase();
      const mods = Array.isArray(this.appConfig?.moderators) ? this.appConfig.moderators : [];
      if (mods.map((x) => String(x || '').toLowerCase().trim()).includes(email)) return true;
      const permsMap = this.appConfig?.moderatorPerms || {};
      return !!permsMap[email];
    },

    hasAdminAccess() {
      return this.isAdmin() || this.isMod();
    },

    // Granular RBAC check for Admin Tabs/Actions
    canMod(perm) {
      if (this.isAdmin()) return true;
      if (!this.isMod()) return false;
      // Treasury, Settings, Balance Edits, Backup are STRICTLY Main Admin Only
      if (['treasury', 'settings', 'backup', 'balance_edit'].includes(perm)) return false;
      const email = (this.user.email || '').toLowerCase();
      const perms = (this.appConfig?.moderatorPerms && this.appConfig.moderatorPerms[email]) || null;
      if (!perms) return true; // Legacy moderator without restricted map
      return perms[perm] !== false;
    },

    isKycVerified() {
      if (this.hasAdminAccess()) return true;
      if (this.appConfig?.requireKycForActions === false) return true;
      return !!(this.profile && this.profile.kycStatus === 'verified');
    },

    getCommissionRate(userProf) {
      const p = userProf || this.profile;
      if (p && p.customCommissionRate != null && p.customCommissionRate !== '') {
        const cr = Number(p.customCommissionRate);
        if (!isNaN(cr) && cr >= 0 && cr <= 0.3) return cr;
      }
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

    // ==================== CACHE KILLER & DYNAMIC MODULE LOADER ====================
    async forceClearCacheAndReload() {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (e) {}
      window.location.replace(window.location.pathname + `?v=${APP_VERSION}&t=` + Date.now());
    },

    loadMissingModule(tab) {
      const file = MODULE_FILES[tab];
      if (!file || this.modules[tab] || this.loadingMods[tab]) return;
      this.loadingMods[tab] = true;
      this.failedMods[tab] = false;
      const sc = document.createElement('script');
      sc.src = file + '&t=' + Date.now();
      sc.onload = () => {
        this.loadingMods[tab] = false;
        if (!this.modules[tab]) this.failedMods[tab] = true;
        this.renderCurrentTab();
      };
      sc.onerror = () => {
        this.loadingMods[tab] = false;
        this.failedMods[tab] = true;
        this.renderCurrentTab();
      };
      document.body.appendChild(sc);
    },

    registerModule(name, mod) {
      this.modules[name] = mod;
      this.loadingMods[name] = false;
      this.failedMods[name] = false;
      if (this.activeTab === name || (name === 'projects' && this.activeTab === 'home')) {
        this.renderCurrentTab();
      }
    },

    // ==================== BOOT & GOOGLE REDIRECT HANDLER ====================
    init() {
      if (!document.getElementById('daman-admin-header-btn')) {
        if (!sessionStorage.getItem('daman_healed_v' + APP_VERSION)) {
          sessionStorage.setItem('daman_healed_v' + APP_VERSION, '1');
          this.forceClearCacheAndReload();
          return;
        }
      }

      this.applyLanguageDOM();
      this.parseUrlDeepLinks();

      // Handle Google Sign-In Redirect Result (Mobile / APK WebView safe)
      auth.getRedirectResult().then(async (res) => {
        if (res && res.user) {
          await this.finalizeGoogleUser(res.user);
        }
      }).catch((err) => {
        if (err && err.code && err.code !== 'auth/no-auth-event') {
          this.toast('تعذر إكمال الدخول بجوجل: ' + (err.message || ''), 'error');
        }
      });

      this.unsubConfig = db.collection('settings').doc('appConfig').onSnapshot((snap) => {
        if (snap.exists) {
          const data = snap.data();
          this.appConfig = Object.assign({}, this.appConfig, data, {
            branding: Object.assign({}, this.appConfig.branding, data.branding || {}),
            announcement: Object.assign({}, this.appConfig.announcement, data.announcement || {}),
            paymentAccounts: Object.assign({}, this.appConfig.paymentAccounts, data.paymentAccounts || {}),
            packages: Object.assign({}, this.appConfig.packages, data.packages || {}),
            depositChannels: Object.assign({}, this.appConfig.depositChannels, data.depositChannels || {}),
            withdrawChannels: Object.assign({}, this.appConfig.withdrawChannels, data.withdrawChannels || {}),
            openingBalances: Object.assign({}, this.appConfig.openingBalances, data.openingBalances || {}),
            backupAccounts: Object.assign({}, this.appConfig.backupAccounts, data.backupAccounts || {})
          });

          // Remote Force Reload trigger from Admin Panel
          const remoteVer = Number(data.forceReloadVersion || 0);
          const localVer = Number(localStorage.getItem('daman_force_ver') || 0);
          if (remoteVer > 0 && localVer > 0 && remoteVer > localVer) {
            localStorage.setItem('daman_force_ver', String(remoteVer));
            this.forceClearCacheAndReload();
            return;
          } else if (remoteVer > 0 && !localVer) {
            localStorage.setItem('daman_force_ver', String(remoteVer));
          }
        }
        this.applyBrandingDOM();
        this.renderAnnouncementBar();
        this.syncHeaderButtons();
        this.renderCurrentTab();
      }, () => {});

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

        this.unsubProfile = db.collection('users').doc(u.uid).onSnapshot(
          (snap) => {
            if (snap.exists) {
              this.profile = Object.assign({ uid: u.uid }, snap.data());
              this.checkBirthdayAndAlerts();
            } else {
              const isAdm = (u.email || '').toLowerCase() === ADMIN_EMAIL;
              const refCode = 'DMN-' + u.uid.slice(0, 6).toUpperCase();
              const base = {
                name: u.displayName || (isAdm ? 'إدارة ضمان سايت' : 'مستخدم ضمان سايت'),
                email: (u.email || '').toLowerCase(),
                phone: '',
                avatarPhoto: u.photoURL || '',
                accountType: 'individual',
                authProvider: (u.providerData && u.providerData[0]?.providerId) || 'password',
                needsOnboarding: !isAdm,
                referralCode: refCode,
                kycStatus: isAdm ? 'verified' : 'none',
                status: 'active',
                balanceAvailable: 0,
                balanceEscrow: 0,
                balancePendingWithdraw: 0,
                balanceBonus: 0,
                balanceFrozen: 0,
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

    applyBrandingDOM() {
      const br = this.appConfig?.branding || {};
      const titleEl = document.getElementById('daman-header-brand');
      const subEl = document.getElementById('daman-header-sub');
      if (titleEl) {
        titleEl.innerHTML = `${this.esc(br.appNameAr || 'ضمان سايت')} <span class="text-amber-400 text-[10px]">${this.esc(br.appNameEn || 'DamanSite')}</span>`;
      }
      if (subEl) {
        subEl.textContent = this.lang === 'ar' ? (br.taglineAr || 'الضمان المالي والمقاولات B2B') : (br.taglineEn || 'Escrow & B2B Contracting');
      }
      document.title = `${br.appNameAr || 'ضمان سايت'} | ${br.appNameEn || 'DamanSite'}`;
    },

    renderAnnouncementBar() {
      const ann = this.appConfig?.announcement || {};
      let bar = document.getElementById('daman-announcement-bar');
      if (!ann.enabled || !ann.text || this.dismissedAnnText === ann.text) {
        if (bar) bar.remove();
        return;
      }
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'daman-announcement-bar';
        const main = document.getElementById('app-main');
        if (main && main.parentNode) main.parentNode.insertBefore(bar, main);
        else document.body.prepend(bar);
      }
      const styles = {
        amber: 'bg-amber-500 text-slate-950',
        emerald: 'bg-emerald-500 text-slate-950',
        rose: 'bg-rose-600 text-white',
        sky: 'bg-sky-500 text-slate-950'
      };
      const cls = styles[ann.color] || styles.amber;
      bar.className = `px-3 py-2 text-[11px] font-black flex items-center justify-between gap-2 ${cls}`;
      bar.innerHTML = `
        <div class="flex-1 cursor-pointer leading-snug" onclick="${ann.action && ann.action !== 'none' ? `DamanApp.handleBannerAction('${this.esc(ann.action)}')` : ''}">
          <i class="fa-solid fa-bullhorn me-1"></i> ${this.esc(ann.text)}
        </div>
        <button onclick="DamanApp.dismissedAnnText='${this.esc(ann.text).replace(/'/g, "\\'")}'; document.getElementById('daman-announcement-bar')?.remove()" class="px-1.5 opacity-80 hover:opacity-100"><i class="fa-solid fa-xmark"></i></button>`;
    },

    parseUrlDeepLinks() {
      try {
        const sp = new URLSearchParams(window.location.search);
        const pUid = sp.get('profile');
        const vCode = sp.get('verify');
        const ref = sp.get('ref');
        if (ref) localStorage.setItem('daman_ref_code', ref.trim().toUpperCase());
        if (pUid) this.pendingDeepLink = { type: 'profile', value: pUid };
        else if (vCode) this.pendingDeepLink = { type: 'verify', value: vCode };
      } catch (e) {}
    },

    handlePendingDeepLink() {
      if (!this.pendingDeepLink) return;
      const dl = this.pendingDeepLink;
      this.pendingDeepLink = null;
      if (dl.type === 'profile') this.openPublicProfile(dl.value);
      else if (dl.type === 'verify') setTimeout(() => this.openVerifyContractModal(dl.value), 350);
    },

    resetAllModules() {
      Object.values(this.modules).forEach((m) => {
        if (m && typeof m.detachListeners === 'function') { try { m.detachListeners(); } catch (e) {} }
      });
      this.viewingPublicUid = null;
      this.publicProfileData = null;
    },

    isBirthdayToday(prof) {
      const p = prof || this.profile;
      if (!p || !p.birthDate || String(p.birthDate).length < 10) return false;
      return String(p.birthDate).slice(5, 10) === this.todayLocal().slice(5, 10);
    },

    checkBirthdayAndAlerts() {
      if (!this.user || !this.profile) return;
      const today = this.todayLocal();
      const year = today.slice(0, 4);
      if (this.isBirthdayToday(this.profile)) {
        const bKey = `daman_bday_${this.user.uid}_${year}`;
        if (!localStorage.getItem(bKey)) {
          localStorage.setItem(bKey, '1');
          const nm = this.profile.name || 'صديق ضمان سايت';
          this.sendNotification(this.user.uid, `🎂 كل سنة وأنت طيب يا ${nm}!`, 'أسرة ضمان سايت تتمنى لك عاماً سعيداً مليئاً بالنجاح والتوفيق.');
        }
      }
      const exp = Number(this.profile.subscriptionExpiresAt || 0);
      if (exp > Date.now() && exp - Date.now() <= 3 * 24 * 60 * 60 * 1000) {
        const sKey = `daman_sub_warn_${this.user.uid}_${today}`;
        if (!localStorage.getItem(sKey)) {
          localStorage.setItem(sKey, '1');
          const daysLeft = Math.max(1, Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000)));
          this.sendNotification(this.user.uid, 'تنبيه: باقتك على وشك الانتهاء', `يتبقى ${daysLeft} يوم على انتهاء باقتك الحالية.`);
        }
      }
    },

    applyLanguageDOM() {
      document.documentElement.lang = this.lang;
      document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      const lb = document.getElementById('daman-lang-btn');
      if (lb) lb.textContent = this.lang === 'ar' ? 'EN' : 'عربي';
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (k) el.textContent = this.t(k);
      });
      this.applyBrandingDOM();
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

    handleBannerAction(act) {
      if (act === 'inspection') {
        if (window.DamanProjects) DamanProjects.subTab = 'inspection';
        return this.switchTab('projects');
      }
      if (act === 'viplabor') {
        if (window.DamanProjects) DamanProjects.subTab = 'viplabor';
        return this.switchTab('projects');
      }
      if (act === 'suppliers') {
        if (window.DamanProjects) {
          DamanProjects.subTab = 'market';
          DamanProjects.marketFilter = 'supplier';
          DamanProjects.selectedCategory = 'all';
        }
        return this.switchTab('projects');
      }
      if (act === 'market') {
        if (window.DamanProjects) {
          DamanProjects.subTab = 'market';
          DamanProjects.marketFilter = 'all';
        }
        return this.switchTab('projects');
      }
      if (act === 'company') return this.switchTab('company');
      if (act === 'wallet') {
        if (window.DamanWallet) DamanWallet.subTab = 'packages';
        return this.switchTab('wallet');
      }
      if (act === 'whatsapp') {
        const wa = this.appConfig?.supportWhatsapp || '201030374787';
        return window.open(`https://wa.me/${wa}?text=${encodeURIComponent('مرحباً إدارة ضمان سايت، أستفسر عن عروضكم')}`, '_blank');
      }
      if (window.DamanChat) DamanChat.openDirectChat('admin', 'إدارة ضمان سايت');
      else this.switchTab('chat');
    },

    openCategoryFromHome(catId) {
      if (window.DamanProjects) {
        DamanProjects.subTab = 'market';
        DamanProjects.marketFilter = 'all';
        DamanProjects.selectedCategory = catId;
      }
      this.switchTab('projects');
    },

    // ==================== MAIN RENDER ROUTER ====================
    renderCurrentTab() {
      const main = document.getElementById('app-main');
      if (!main) return;

      if (this.appConfig?.maintenanceMode && !this.hasAdminAccess()) {
        main.innerHTML = `
          <div class="glass-card rounded-3xl p-7 text-center space-y-3 mt-10 border-amber-500/40">
            <i class="fa-solid fa-screwdriver-wrench text-4xl text-amber-400"></i>
            <h2 class="text-base font-black text-white">التطبيق في وضع الصيانة المؤقتة</h2>
            <p class="text-xs text-slate-300 leading-relaxed">${this.esc(this.appConfig.maintenanceMessage || 'سنعود للعمل خلال دقائق.')}</p>
          </div>`;
        return;
      }

      if (this.user && this.profile && this.profile.status === 'banned' && !this.isAdmin()) {
        main.innerHTML = `
          <div class="glass-card rounded-3xl p-7 text-center space-y-3 mt-10 border-rose-500/60">
            <i class="fa-solid fa-ban text-4xl text-rose-500"></i>
            <h2 class="text-base font-black text-rose-400">تم إيقاف هذا الحساب من الإدارة</h2>
            <p class="text-xs text-slate-300">${this.esc(this.profile.banReason || '')}</p>
            <button onclick="DamanApp.handleHeaderAuthClick()" class="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-xs font-black">تسجيل الخروج</button>
          </div>`;
        return;
      }

      // Mandatory Google Post-Signup Onboarding (Phone + Account Type) -> Mandatory KYC Gate
      if (this.user && this.profile && !this.isKycVerified() && !this.viewingPublicUid) {
        this.renderMandatoryKycWall(main);
        return;
      }

      if (this.viewingPublicUid) {
        this.renderFacebookProfile(main, this.viewingPublicUid);
        return;
      }

      if (this.activeTab === 'home') return this.renderHomeTab(main);
      if (this.activeTab === 'profile') {
        if (!this.user) {
          main.innerHTML = `<div class="glass-card rounded-2xl p-7 text-center space-y-3 mt-6"><i class="fa-solid fa-user-lock text-3xl text-amber-400"></i><h3 class="text-sm font-black text-white">سجّل الدخول لعرض صفحتك الشخصية</h3><button onclick="DamanApp.openAuthModal('login')" class="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول / حساب جديد</button></div>`;
          return;
        }
        return this.renderFacebookProfile(main, this.user.uid);
      }

      const mod = this.modules[this.activeTab];
      if (mod && typeof mod.render === 'function') {
        mod.render(main, this);
      } else {
        const expectedFile = (MODULE_FILES[this.activeTab] || '').split('?')[0];
        if (!this.failedMods[this.activeTab]) {
          this.loadMissingModule(this.activeTab);
          main.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-xs text-amber-300 font-bold">جارٍ تحميل القسم (${this.esc(expectedFile)})...</div>`;
        } else {
          main.innerHTML = `
            <div class="glass-card rounded-2xl p-5 text-center space-y-3 border-rose-500/50 text-xs">
              <i class="fa-solid fa-triangle-exclamation text-2xl text-rose-400"></i>
              <div class="font-black text-rose-300">تعذر تحميل ملف القسم: ${this.esc(expectedFile)}</div>
              <p class="text-[11px] text-slate-300">تأكد من رفع ملف <b>${this.esc(expectedFile)}</b> بنفس الاسم (بحروف صغيرة) على GitHub.</p>
              <button onclick="DamanApp.failedMods['${this.activeTab}']=false; DamanApp.loadMissingModule('${this.activeTab}')" class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black">إعادة المحاولة</button>
            </div>`;
        }
      }
    },

    // ==================== MANDATORY ONBOARDING (GOOGLE PHONE/TYPE) + KYC WALL ====================
    async submitGoogleOnboarding(e) {
      e.preventDefault();
      await this.withLock('gOnboard', async () => {
        const name = document.getElementById('go-name').value.trim();
        const accountType = document.getElementById('go-type').value;
        const phone = this.normalizePhone(document.getElementById('go-phone').value);
        const refCode = (document.getElementById('go-ref')?.value || '').trim().toUpperCase();

        if (!/^01[0125]\d{8}$/.test(phone)) return this.toast('أدخل رقم موبايل مصري صحيح (11 رقم)', 'error');
        const bl = await this.checkBlacklist({ email: this.user.email, phone });
        if (bl) return this.toast(`تعذر الاستكمال: ${bl}`, 'error');

        const dup = await db.collection('users').where('phone', '==', phone).limit(2).get();
        if (dup.docs.some((d) => d.id !== this.user.uid)) {
          return this.toast('رقم الموبايل مسجّل بالفعل بحساب آخر', 'error');
        }

        try {
          await db.collection('users').doc(this.user.uid).update({
            name,
            companyName: accountType !== 'individual' ? name : '',
            accountType,
            phone,
            referredBy: refCode,
            needsOnboarding: false,
            termsAcceptedAt: Date.now()
          });
          this.toast('تم حفظ بياناتك بنجاح! استكمل الآن خطوة التوثيق بالبطاقة 🪪', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
      });
    },

    renderMandatoryKycWall(container) {
      const p = this.profile || {};
      const st = p.kycStatus || 'none';
      const wa = this.appConfig?.supportWhatsapp || '201030374787';

      // Step 1 for Google Sign-In Users: Capture Egyptian Phone + Account Type + Terms before KYC
      if (!p.phone || p.needsOnboarding) {
        const savedRef = localStorage.getItem('daman_ref_code') || '';
        container.innerHTML = `
          <div class="glass-card rounded-3xl p-5 space-y-3.5 mt-4 border-amber-500/50 text-xs">
            <div class="text-center space-y-1">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl"><i class="fa-brands fa-google"></i></div>
              <h2 class="text-sm font-black text-white">خطوة 1 من 2: استكمال بيانات حسابك</h2>
              <p class="text-[11px] text-slate-300">تم الدخول بحساب جوجل (${this.esc(p.email || '')}) — أدخل رقم موبايلك ونوع الحساب للانتقال للتوثيق بالبطاقة.</p>
            </div>
            <form onsubmit="DamanApp.submitGoogleOnboarding(event)" class="space-y-2.5">
              <div><label class="block text-[10.5px] font-bold text-slate-300 mb-1">اسم العرض / الشهرة أو اسم الشركة *</label><input id="go-name" type="text" required value="${this.esc(p.name || '')}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div>
                <label class="block text-[10.5px] font-bold text-slate-300 mb-1">نوع الحساب *</label>
                <select id="go-type" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                  <option value="individual">فرد / مقاول / فني / عميل</option>
                  <option value="company">شركة مقاولات / مكتب هندسي</option>
                  <option value="supplier">مورّد خامات ومواد بناء (B2B)</option>
                </select>
              </div>
              <div><label class="block text-[10.5px] font-bold text-slate-300 mb-1">رقم الموبايل المصري (11 رقم) *</label><input id="go-phone" type="tel" required placeholder="01xxxxxxxxx" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-bold" /></div>
              <div><label class="block text-[10.5px] font-bold text-slate-400 mb-1">كود دعوة صديق (اختياري)</label><input id="go-ref" type="text" value="${this.esc(savedRef)}" placeholder="DMN-XXXXXX" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white uppercase" /></div>
              <label class="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"><input type="checkbox" required class="mt-0.5 accent-amber-500" /><span class="text-[10.5px] text-slate-300">أوافق على <button type="button" onclick="DamanApp.openPrivacyModal()" class="text-amber-400 underline font-bold">الشروط وسياسة الخصوصية</button> وتسجيل المكالمات لمدة 30 يوماً.</span></label>
              <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">حفظ والمتابعة للتوثيق بالبطاقة</button>
            </form>
            <div class="text-center"><button onclick="DamanApp.handleHeaderAuthClick()" class="text-[11px] text-rose-400 font-bold underline">تسجيل الخروج</button></div>
          </div>`;
        return;
      }

      const isCompany = p.accountType === 'company' || p.accountType === 'supplier';
      if (st === 'pending') {
        container.innerHTML = `
          <div class="glass-card rounded-3xl p-6 text-center space-y-4 mt-4 border-amber-500/50">
            <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl"><i class="fa-solid fa-hourglass-half animate-pulse"></i></div>
            <h2 class="text-base font-black text-amber-400">حسابك قيد مراجعة التوثيق الإجباري</h2>
            <p class="text-xs text-slate-300 leading-relaxed">تم استلام مستندات التوثيق بنجاح وتقوم إدارة <b>${this.esc(this.t('appName'))}</b> حالياً بمطابقة البطاقة والسيلفي لفتح المحفظة والسوق والعقود.</p>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="window.location.reload()" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تحديث الحالة</button>
              <a href="https://wa.me/${wa}?text=${encodeURIComponent('مرحباً إدارة ضمان سايت، قمت برفع مستندات التوثيق لحسابي: ' + (p.phone || p.email || ''))}" target="_blank" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center"><i class="fa-brands fa-whatsapp me-1"></i> واتساب</a>
            </div>
            <button onclick="DamanApp.handleHeaderAuthClick()" class="text-[11px] text-rose-400 font-bold underline">تسجيل الخروج</button>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="glass-card rounded-3xl p-6 text-center space-y-4 mt-4 border-rose-500/50">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-3xl"><i class="fa-solid fa-id-card-clip"></i></div>
          <h2 class="text-base font-black text-white">خطوة 2 من 2: توثيق الهوية الإجباري</h2>
          ${st === 'rejected' ? `<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/50 text-xs text-rose-200 font-bold">❌ سبب الرفض: ${this.esc(p.kycRejectionReason || 'الصور غير واضحة')}</div>` : ''}
          <p class="text-xs text-slate-300 leading-relaxed">${isCompany ? 'مطلوب للشركات والموردين: صورة السجل التجاري + البطاقة الضريبية + بطاقة المسؤول (وش وضهر) + سيلفي.' : 'مطلوب للأفراد والمقاولين: بطاقة الرقم القومي (وش وضهر) + صورة سيلفي واضحة. تُستخدم البيانات تلقائياً في العقود الرسمية فقط.'}</p>
          <button onclick="if(window.DamanWallet){ DamanWallet.openKycModal(true); } else { DamanApp.loadMissingModule('wallet'); DamanApp.toast('جارٍ تحميل شاشة التوثيق...','info'); }" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-sm">ابدأ رفع البطاقة والسيلفي الآن</button>
          <button onclick="DamanApp.handleHeaderAuthClick()" class="text-[11px] text-rose-400 font-bold underline">تسجيل الخروج</button>
        </div>`;
    },

    // ==================== HOME TAB ====================
    renderHomeTab(container) {
      const p = this.profile;
      const br = this.appConfig?.branding || {};
      const isBday = p && this.isBirthdayToday(p);
      const avail = Number(p?.balanceAvailable || 0);
      const esc = Number(p?.balanceEscrow || 0);
      const exp = Number(p?.subscriptionExpiresAt || 0);
      const expSoon = exp > Date.now() && exp - Date.now() <= 3 * 24 * 60 * 60 * 1000;

      const customBanners = Array.isArray(this.appConfig?.customHomeBanners) ? this.appConfig.customHomeBanners : [];
      const officialList = this.appConfig?.hideOfficialBanners ? [] : OFFICIAL_HOME_BANNERS;
      const allBanners = [...customBanners, ...officialList];

      const themeStyles = {
        emerald: { box: 'from-emerald-950/90 via-slate-900 to-slate-950 border-emerald-500/50', badge: 'bg-emerald-500/20 text-emerald-300', btn: 'bg-emerald-500 text-slate-950' },
        amber: { box: 'from-amber-950/80 via-slate-900 to-slate-950 border-amber-500/50', badge: 'bg-amber-500/20 text-amber-300', btn: 'bg-amber-500 text-slate-950' },
        purple: { box: 'from-purple-950/80 via-slate-900 to-slate-950 border-purple-500/50', badge: 'bg-purple-500/20 text-purple-300', btn: 'bg-purple-500 text-white' },
        sky: { box: 'from-sky-950/80 via-slate-900 to-slate-950 border-sky-500/50', badge: 'bg-sky-500/20 text-sky-300', btn: 'bg-sky-500 text-slate-950' }
      };

      const featuredPosts = window.DamanProjects && typeof DamanProjects.getFeaturedPosts === 'function'
        ? DamanProjects.getFeaturedPosts(5)
        : [];

      container.innerHTML = `
        <div class="space-y-4">
          ${this.hasAdminAccess() ? `
            <button onclick="DamanApp.switchTab('admin')" class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-400/60 text-white flex items-center justify-between text-xs font-black shadow-xl">
              <span><i class="fa-solid fa-crown text-amber-300 me-1.5"></i> لوحة سيطرة الإدارة الشاملة (خزنة، ميزان، إعلانات، شركات، طوارئ)</span>
              <i class="fa-solid fa-chevron-left"></i>
            </button>` : ''}

          ${isBday ? `
            <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-500/25 via-rose-500/20 to-purple-500/25 border border-amber-400/60 text-center space-y-1">
              <div class="text-2xl">🎂🎉</div>
              <div class="text-sm font-black text-amber-300">كل سنة وأنت طيب يا ${this.esc(p.name)}!</div>
              <div class="text-[11px] text-slate-200">أسرة ${this.esc(br.appNameAr || 'ضمان سايت')} تتمنى لك عاماً سعيداً ومليئاً بالنجاح.</div>
            </div>` : ''}

          ${expSoon ? `
            <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/50 flex items-center justify-between gap-2 text-xs">
              <span class="font-bold text-amber-200"><i class="fa-solid fa-clock me-1"></i> باقتك ستنتهي خلال أقل من 3 أيام!</span>
              <button onclick="DamanApp.switchTab('wallet')" class="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]">تجديد</button>
            </div>` : ''}

          <!-- Hero / Balance Card -->
          <div class="glass-card rounded-3xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border-amber-500/30 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="text-[11px] text-amber-400 font-extrabold">${this.esc(br.heroWelcome || 'أهلاً بك في ضمان سايت 🏗️')}</div>
                <h1 class="text-base font-black text-white">${p ? this.esc(p.companyName || p.name) : this.esc(br.heroGuestTitle || 'أقوى منصة مقاولات وضمان مالي في مصر')}</h1>
              </div>
              ${p ? `<span class="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black">موثّق ✅</span>` : ''}
            </div>

            ${p ? `
              <div class="grid grid-cols-2 gap-2">
                <div onclick="DamanApp.switchTab('wallet')" class="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/30 cursor-pointer">
                  <div class="text-[10px] text-slate-400 font-bold">الرصيد الكاش المتاح</div>
                  <div class="text-base font-black text-emerald-400 mt-0.5">${this.fmtMoney(avail)} <span class="text-[10px]">ج.م</span></div>
                </div>
                <div onclick="DamanApp.switchTab('wallet')" class="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30 cursor-pointer">
                  <div class="text-[10px] text-slate-400 font-bold">محجوز بالضمان</div>
                  <div class="text-base font-black text-amber-400 mt-0.5">${this.fmtMoney(esc)} <span class="text-[10px]">ج.م</span></div>
                </div>
              </div>` : `
              <p class="text-xs text-slate-300 leading-relaxed">${this.esc(br.heroGuestDesc || '')}</p>
              <div class="space-y-2">
                <button onclick="DamanApp.signInWithGoogle()" class="w-full py-2.5 rounded-xl bg-white text-slate-900 font-black text-xs flex items-center justify-center gap-2 shadow">
                  <i class="fa-brands fa-google text-rose-500"></i> الدخول السريع بحساب Google
                </button>
                <div class="grid grid-cols-2 gap-2">
                  <button onclick="DamanApp.openAuthModal('register')" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">إنشاء حساب جديد</button>
                  <button onclick="DamanApp.openAuthModal('login')" class="py-2.5 rounded-xl bg-slate-800 text-white font-black text-xs">دخول بالهاتف/الإيميل</button>
                </div>
              </div>`}
          </div>

          <!-- Official + Custom Home Promo Banners -->
          ${allBanners.length ? `
            <div class="space-y-2">
              <div class="flex items-center justify-between px-1">
                <h2 class="text-xs font-black text-amber-400"><i class="fa-solid fa-fire me-1"></i> عروض وخدمات ${this.esc(br.appNameAr || 'ضمان سايت')} (${allBanners.length})</h2>
                ${this.isAdmin() ? `<button onclick="if(window.DamanAdmin) DamanAdmin.subTab='ads'; DamanApp.switchTab('admin')" class="text-[10px] font-black text-purple-300 underline">+ تحكم بالإعلانات</button>` : ''}
              </div>
              <div class="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory">
                ${allBanners.map((b) => {
                  const st = themeStyles[b.theme] || themeStyles.amber;
                  return `
                    <div class="snap-start shrink-0 w-[86%] sm:w-[72%] rounded-3xl p-4 bg-gradient-to-br ${st.box} border flex flex-col justify-between gap-3 shadow-lg">
                      <div class="space-y-1.5">
                        <span class="inline-block px-2.5 py-0.5 rounded-lg ${st.badge} text-[9.5px] font-black">${this.esc(b.badge)}</span>
                        <h3 class="text-sm font-black text-white leading-snug">${this.esc(b.title)}</h3>
                        <p class="text-[11px] text-slate-300 leading-relaxed">${this.esc(b.subtitle)}</p>
                      </div>
                      <button onclick="DamanApp.handleBannerAction('${this.esc(b.action || 'admin_chat')}')" class="w-full py-2 rounded-xl ${st.btn} font-black text-xs">
                        ${this.esc(b.ctaText || 'اطلب الآن')} <i class="fa-solid fa-arrow-left ms-1 text-[10px]"></i>
                      </button>
                    </div>`;
                }).join('')}
              </div>
            </div>` : ''}

          <!-- Core Services Grid -->
          <div class="grid grid-cols-2 gap-2.5">
            <button onclick="DamanApp.switchTab('projects')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-amber-500/50">
              <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center"><i class="fa-solid fa-helmet-safety"></i></div>
              <div class="text-xs font-black text-white">السوق والموردين B2B</div>
              <div class="text-[10px] text-slate-400">مشاريع، صنايعية، وموردي خامات</div>
            </button>

            <button onclick="DamanApp.handleBannerAction('inspection')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-emerald-500/50">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><i class="fa-solid fa-shield-halved"></i></div>
              <div class="text-xs font-black text-white">استلام هندسي بضمان 3x</div>
              <div class="text-[10px] text-slate-400">استلام شدات وأسقف بضمان 3 أضعاف</div>
            </button>

            <button onclick="DamanApp.handleBannerAction('viplabor')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-purple-500/50">
              <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center"><i class="fa-solid fa-users-gear"></i></div>
              <div class="text-xs font-black text-white">توريد عمالة VIP</div>
              <div class="text-[10px] text-slate-400">فرق فنية مختبرة بضمان المنصة</div>
            </button>

            <button onclick="DamanApp.switchTab('company')" class="glass-card rounded-2xl p-3.5 text-start space-y-1.5 hover:border-sky-500/50">
              <div class="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center"><i class="fa-solid fa-building-user"></i></div>
              <div class="text-xs font-black text-white">إدارة الشركات والمواقع</div>
              <div class="text-[10px] text-slate-400">GPS، مستخلصات، إضافي، جرد ورواتب</div>
            </button>
          </div>

          <!-- Featured Ads ★ -->
          ${featuredPosts.length ? `
            <div class="space-y-2">
              <div class="flex items-center justify-between px-1">
                <h2 class="text-xs font-black text-amber-400"><i class="fa-solid fa-star me-1"></i> الإعلانات المميزة في السوق (${featuredPosts.length})</h2>
                <button onclick="DamanApp.handleBannerAction('market')" class="text-[10.5px] font-black text-emerald-400 underline">عرض الكل ←</button>
              </div>
              <div class="space-y-2">
                ${featuredPosts.map((fp) => `
                  <div onclick="if(window.DamanProjects){ DamanProjects.openPostDetails('${fp.id}'); }" class="glass-card rounded-2xl p-3 border-amber-400/50 bg-amber-500/5 space-y-1.5 cursor-pointer hover:border-amber-400">
                    <div class="flex items-center justify-between gap-2">
                      <span class="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[9.5px] font-black">★ إعلان مميز</span>
                      <span class="text-[10px] font-black text-emerald-400">${fp.budget ? this.fmtMoney(fp.budget) + ' ج.م' : 'بالاتفاق'}</span>
                    </div>
                    <div class="text-xs font-black text-white">${this.esc(fp.title)}</div>
                    <div class="flex items-center justify-between text-[10px] text-slate-400">
                      <span class="truncate"><i class="fa-solid fa-user-check text-emerald-400 me-1"></i>${this.esc(fp.ownerName || '')}</span>
                      <span class="shrink-0"><i class="fa-solid fa-location-dot me-0.5"></i>${this.esc(fp.city || '')}</span>
                    </div>
                  </div>`).join('')}
              </div>
            </div>` : ''}

          <!-- 17 Categories Quick Strip -->
          <div class="space-y-2">
            <div class="px-1 text-xs font-black text-slate-200"><i class="fa-solid fa-layer-group text-amber-400 me-1"></i> تصفح السوق حسب التخصص (17 قسم)</div>
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1.5">
              ${this.CATEGORIES.map((c) => `
                <button onclick="DamanApp.openCategoryFromHome('${c.id}')" class="shrink-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-[10.5px] font-bold text-slate-200">${this.esc(c.ar)}</button>`).join('')}
            </div>
          </div>

          <!-- Verify Contract + Share My Page -->
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

          <!-- Direct Admin Chat & WhatsApp -->
          <div class="grid grid-cols-3 gap-2">
            <button onclick="DamanApp.handleBannerAction('admin_chat')" class="col-span-2 p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border border-amber-500/40 flex items-center justify-between text-xs font-black text-amber-300">
              <span><i class="fa-solid fa-headset me-1.5"></i> تواصل مع إدارة المنصة</span>
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button onclick="DamanApp.handleBannerAction('whatsapp')" class="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs flex items-center justify-center gap-1">
              <i class="fa-brands fa-whatsapp text-base"></i> واتساب
            </button>
          </div>
        </div>`;
    },

    // ==================== GOOGLE SIGN-IN + FULL AUTH SUITE ====================
    async signInWithGoogle() {
      await this.withLock('googleAuth', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
          const res = await auth.signInWithPopup(provider);
          if (res && res.user) await this.finalizeGoogleUser(res.user);
        } catch (err) {
          if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
            this.toast('جارٍ التحويل لصفحة تسجيل دخول Google...', 'info');
            auth.signInWithRedirect(provider).catch((e) => this.toast(e.message, 'error'));
          } else if (err && err.code === 'auth/unauthorized-domain') {
            this.toast('أضف نطاق الموقع في Firebase Authentication → Authorized domains', 'error');
          } else if (err && err.code === 'auth/operation-not-allowed') {
            this.toast('يرجى تفعيل خيار Google في Firebase Authentication → Sign-in method', 'error');
          } else if (err && err.code !== 'auth/popup-closed-by-user') {
            this.toast(err.message || 'تعذر تسجيل الدخول بجوجل', 'error');
          }
        }
      });
    },

    async finalizeGoogleUser(u) {
      const email = (u.email || '').toLowerCase();
      const isAdm = email === ADMIN_EMAIL;

      const bl = await this.checkBlacklist({ email });
      if (bl && !isAdm) {
        await auth.signOut();
        return this.toast(`حسابك محظور من المنصة: ${bl}`, 'error');
      }

      const uRef = db.collection('users').doc(u.uid);
      const snap = await uRef.get();
      if (!snap.exists) {
        if (this.appConfig?.disableRegistrations && !isAdm) {
          try { await u.delete(); } catch (e) { await auth.signOut(); }
          return this.toast('التسجيل الجديد متوقف مؤقتاً من الإدارة', 'warning');
        }
        await uRef.set({
          name: u.displayName || (isAdm ? 'إدارة ضمان سايت' : 'مستخدم ضمان سايت'),
          email,
          phone: '',
          avatarPhoto: u.photoURL || '',
          accountType: 'individual',
          authProvider: 'google',
          needsOnboarding: !isAdm,
          referralCode: 'DMN-' + u.uid.slice(0, 6).toUpperCase(),
          kycStatus: isAdm ? 'verified' : 'none',
          status: 'active',
          balanceAvailable: 0,
          balanceEscrow: 0,
          balancePendingWithdraw: 0,
          balanceBonus: 0,
          balanceFrozen: 0,
          ratingAvg: 5,
          ratingCount: 0,
          followers: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      document.getElementById('daman-auth-modal')?.classList.add('hidden');
      this.toast('تم تسجيل الدخول بحساب Google بنجاح ✅', 'success');
    },

    togglePassVisibility(inputId, btnEl) {
      const inp = document.getElementById(inputId);
      if (!inp) return;
      const isPass = inp.type === 'password';
      inp.type = isPass ? 'text' : 'password';
      if (btnEl) btnEl.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    },

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
      const savedRef = localStorage.getItem('daman_ref_code') || '';

      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-5 space-y-3.5 max-h-[92vh] overflow-y-auto text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-black text-amber-400">${isReg ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h3>
            <button onclick="document.getElementById('daman-auth-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <!-- 1-Click Google Sign-In -->
          <button type="button" onclick="DamanApp.signInWithGoogle()" class="w-full py-2.5 rounded-xl bg-white text-slate-900 font-black text-xs flex items-center justify-center gap-2 shadow-lg">
            <i class="fa-brands fa-google text-rose-500 text-sm"></i>
            ${isReg ? 'التسجيل السريع بحساب Google' : 'الدخول بحساب Google'}
          </button>

          <div class="flex items-center gap-2 text-[10px] text-slate-500">
            <div class="flex-1 h-px bg-slate-800"></div><span>أو بالبريد / رقم الموبايل</span><div class="flex-1 h-px bg-slate-800"></div>
          </div>

          <div class="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl">
            <button onclick="DamanApp.openAuthModal('login')" class="py-2 rounded-lg font-black ${!isReg ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">دخول</button>
            <button onclick="DamanApp.openAuthModal('register')" class="py-2 rounded-lg font-black ${isReg ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">حساب جديد</button>
          </div>

          ${isReg ? `
            <form onsubmit="DamanApp.submitRegister(event)" class="space-y-2.5">
              <input id="rg-name" type="text" required placeholder="اسم العرض / الشهرة أو اسم الشركة *" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="rg-type" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                <option value="individual">فرد / مقاول / فني / عميل</option>
                <option value="company">شركة مقاولات / مكتب هندسي</option>
                <option value="supplier">مورّد خامات ومواد بناء (B2B)</option>
              </select>
              <input id="rg-phone" type="tel" required placeholder="رقم الموبايل المصري (01xxxxxxxxx) *" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="rg-email" type="email" placeholder="البريد الإلكتروني (مُفضل لاستعادة كلمة المرور)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <div class="relative">
                <input id="rg-pass" type="password" minlength="6" required placeholder="كلمة المرور (6 أحرف على الأقل) *" class="w-full px-3 py-2.5 pe-10 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                <button type="button" onclick="DamanApp.togglePassVisibility('rg-pass',this)" class="absolute top-2.5 end-3 text-slate-400"><i class="fa-solid fa-eye"></i></button>
              </div>
              <input id="rg-ref" type="text" value="${this.esc(savedRef)}" placeholder="كود دعوة صديق (اختياري)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white uppercase" />
              <label class="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input id="rg-terms" type="checkbox" required class="mt-0.5 accent-amber-500" />
                <span class="text-[10.5px] text-slate-300">أوافق على <button type="button" onclick="DamanApp.openPrivacyModal()" class="text-amber-400 underline font-bold">الشروط وسياسة الخصوصية</button> والتوثيق الإلزامي بالبطاقة.</span>
              </label>
              <button type="submit" class="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black">إنشاء الحساب والمتابعة للتوثيق</button>
            </form>` : `
            <form onsubmit="DamanApp.submitLogin(event)" class="space-y-2.5">
              <input id="lg-id" type="text" required placeholder="البريد الإلكتروني أو رقم الموبايل" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <div class="relative">
                <input id="lg-pass" type="password" required placeholder="كلمة المرور" class="w-full px-3 py-2.5 pe-10 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                <button type="button" onclick="DamanApp.togglePassVisibility('lg-pass',this)" class="absolute top-2.5 end-3 text-slate-400"><i class="fa-solid fa-eye"></i></button>
              </div>
              <button type="submit" class="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black">دخول</button>
              <button type="button" onclick="DamanApp.handleForgotPassword()" class="w-full text-center text-[11px] text-sky-400 font-bold underline">نسيت كلمة المرور؟ استعادتها الآن</button>
            </form>`}
        </div>`;
    },

    async submitRegister(e) {
      e.preventDefault();
      if (this.appConfig?.disableRegistrations) {
        return this.toast('التسجيل الجديد متوقف مؤقتاً من الإدارة', 'warning');
      }
      await this.withLock('register', async () => {
        const name = document.getElementById('rg-name').value.trim();
        const accountType = document.getElementById('rg-type').value;
        const phone = this.normalizePhone(document.getElementById('rg-phone').value);
        const rawEmail = document.getElementById('rg-email').value.trim().toLowerCase();
        const pass = document.getElementById('rg-pass').value;
        const refCode = (document.getElementById('rg-ref')?.value || '').trim().toUpperCase();

        if (!/^01[0125]\d{8}$/.test(phone)) return this.toast('أدخل رقم موبايل مصري صحيح (11 رقم)', 'error');
        const authEmail = rawEmail || `${phone}@phone.damansite.app`;
        const bl = await this.checkBlacklist({ email: authEmail, phone });
        if (bl) return this.toast(`تعذر التسجيل: ${bl}`, 'error');

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
            authProvider: 'password',
            needsOnboarding: false,
            referralCode: 'DMN-' + cred.user.uid.slice(0, 6).toUpperCase(),
            referredBy: refCode,
            kycStatus: 'none',
            status: 'active',
            balanceAvailable: 0,
            balanceEscrow: 0,
            balancePendingWithdraw: 0,
            balanceBonus: 0,
            balanceFrozen: 0,
            ratingAvg: 5,
            ratingCount: 0,
            followers: [],
            termsAcceptedAt: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          document.getElementById('daman-auth-modal').classList.add('hidden');
          this.toast('تم إنشاء الحساب! استكمل التوثيق بالبطاقة والسيلفي الآن 🪪', 'success');
        } catch (err) { this.toast(err.message, 'error'); }
      });
    },

    async submitLogin(e) {
      e.preventDefault();
      await this.withLock('login', async () => {
        let id = document.getElementById('lg-id').value.trim();
        const pass = document.getElementById('lg-pass').value;
        if (!id.includes('@')) id = `${this.normalizePhone(id)}@phone.damansite.app`;
        try {
          await auth.signInWithEmailAndPassword(id.toLowerCase(), pass);
          document.getElementById('daman-auth-modal').classList.add('hidden');
          this.toast('مرحباً بعودتك ✅', 'success');
        } catch (err) { this.toast('بيانات الدخول غير صحيحة — تأكد من البريد/الرقم وكلمة المرور أو جرّب الدخول بحساب Google', 'error'); }
      });
    },

    async handleForgotPassword() {
      const id = (document.getElementById('lg-id')?.value || '').trim();
      const input = id || window.prompt('أدخل بريدك الإلكتروني (أو رقم الموبايل المسجّل به):');
      if (!input) return;
      if (!input.includes('@') || input.endsWith('@phone.damansite.app')) {
        const wa = this.appConfig?.supportWhatsapp || '201030374787';
        if (window.confirm('حسابات رقم الموبايل بدون بريد إلكتروني تتطلب التحقق السريع عبر واتساب الإدارة لإعادة تعيين كلمة المرور.\nفتح واتساب الإدارة الآن؟')) {
          window.open(`https://wa.me/${wa}?text=${encodeURIComponent('مرحباً إدارة ضمان سايت، نسيت كلمة المرور لحساب الموبايل: ' + input)}`, '_blank');
        }
        return;
      }
      try {
        await auth.sendPasswordResetEmail(input.toLowerCase());
        this.toast('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني (راجع البريد والـ Spam) ✅', 'success');
      } catch (e) { this.toast('تأكد من صحة البريد الإلكتروني المسجّل', 'error'); }
    },

    openChangePasswordModal() {
      if (this.profile?.authProvider === 'google') {
        return this.toast('حسابك مسجّل عبر Google — كلمة المرور تُدار من إعدادات حساب Google الخاص بك', 'info');
      }
      const np = window.prompt('أدخل كلمة المرور الجديدة (6 أحرف على الأقل):');
      if (!np || np.length < 6 || !this.user) return;
      this.user.updatePassword(np)
        .then(() => this.toast('تم تغيير كلمة المرور بنجاح ✅', 'success'))
        .catch(() => this.toast('لأمانك: سجّل خروج وادخل مرة أخرى ثم غيّر كلمة المرور', 'warning'));
    },

    async requestDeleteAccount() {
      if (!this.user || !this.profile) return;
      if (Number(this.profile.balanceAvailable || 0) > 0 || Number(this.profile.balanceEscrow || 0) > 0 || Number(this.profile.balancePendingWithdraw || 0) > 0) {
        return this.toast('لا يمكن حذف الحساب لوجود رصيد متاح أو ضمان أو سحب معلّق', 'error');
      }
      if (!window.confirm('تأكيد إرسال طلب حذف الحساب نهائياً؟')) return;
      await db.collection('supportTickets').add({
        userId: this.user.uid, userName: this.profile.name || '', userEmail: this.profile.email || '',
        subject: 'طلب حذف حساب نهائياً', message: 'يرجى حذف حسابي نهائياً.', status: 'open',
        date: this.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await this.sendNotification('ADMIN', 'طلب حذف حساب', this.profile.name || this.user.uid);
      this.toast('تم استلام طلب حذف الحساب', 'info');
    },

    // ==================== FACEBOOK-STYLE PUBLIC & OWN PROFILE ====================
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
      } catch (e) { this.toast('تعذر تحميل الصفحة', 'error'); }
    },

    async loadProfileTabExtras(uid) {
      try {
        const [postsSnap, portSnap, revSnap] = await Promise.all([
          db.collection('projects').where('ownerId', '==', uid).limit(25).get(),
          db.collection('userPortfolios').where('userId', '==', uid).limit(25).get(),
          db.collection('reviews').where('targetUserId', '==', uid).limit(30).get()
        ]);
        this.profilePosts = postsSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        this.profilePortfolio = portSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        this.profileReviews = revSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        this.renderCurrentTab();
      } catch (e) {}
    },

    setProfileSubTab(t) { this.profileSubTab = t; this.renderCurrentTab(); },

    async toggleFollowUser(targetUid) {
      if (!this.user) return this.openAuthModal('login');
      if (targetUid === this.user.uid) return;
      const target = this.publicProfileData;
      const followers = Array.isArray(target?.followers) ? target.followers : [];
      const following = followers.includes(this.user.uid);
      try {
        await db.collection('users').doc(targetUid).update({
          followers: following ? firebase.firestore.FieldValue.arrayRemove(this.user.uid) : firebase.firestore.FieldValue.arrayUnion(this.user.uid)
        });
        if (target) target.followers = following ? followers.filter((x) => x !== this.user.uid) : followers.concat([this.user.uid]);
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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">تعديل بيانات صفحتك</h3><button onclick="document.getElementById('daman-edit-prof-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanApp.saveProfileEdit(event)" class="space-y-2.5">
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">اسم العرض / الشهرة</label><input id="ep-name" type="text" required value="${this.esc(p.companyName || p.name || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">التخصص الرئيسي</label><input id="ep-spec" type="text" value="${this.esc(p.specialty || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">المحافظة / نطاق العمل</label><input id="ep-city" type="text" value="${this.esc(p.city || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">رابط صفحتك على فيسبوك (اختياري)</label><input id="ep-fb" type="url" value="${this.esc(p.facebookUrl || '')}" placeholder="https://facebook.com/..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">نبذة عنك</label><textarea id="ep-bio" rows="3" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${this.esc(p.bio || '')}</textarea></div>
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
        facebookUrl: document.getElementById('ep-fb').value.trim(),
        bio: document.getElementById('ep-bio').value.trim()
      };
      if (this.profile?.accountType === 'company' || this.profile?.accountType === 'supplier') patch.companyName = nameVal;
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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-emerald-400">إضافة سابقة أعمال جديدة</h3><button onclick="document.getElementById('daman-port-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanApp.submitPortfolioItem(event)" class="space-y-2.5">
            <input id="pt-title" type="text" required placeholder="عنوان العمل" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="pt-desc" rows="2" placeholder="وصف مختصر..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <label class="block p-3 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer"><span class="font-bold text-emerald-300"><i class="fa-solid fa-camera me-1"></i> اختر صورة العمل</span><input type="file" accept="image/*" required class="hidden" onchange="DamanApp.handlePortPhoto(this)" /><div id="pt-prev"></div></label>
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
        this.toast('تم نشر العمل في صفحتك ✅', 'success');
        await this.loadProfileTabExtras(this.user.uid);
      } catch (err) { this.toast(err.message, 'error'); }
    },

    async deletePortfolioItem(id) {
      if (!window.confirm('حذف هذا العمل من معرضك؟')) return;
      await db.collection('userPortfolios').doc(id).delete();
      this.profilePortfolio = this.profilePortfolio.filter((x) => x.id !== id);
      this.renderCurrentTab();
    },

    getProfileShareUrl(uid) {
      const ref = this.profile?.referralCode ? `&ref=${encodeURIComponent(this.profile.referralCode)}` : '';
      return `${window.location.origin}${window.location.pathname}?profile=${encodeURIComponent(uid)}${ref}`;
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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">مشاركة صفحة: ${this.esc(displayName)}</h3><button onclick="document.getElementById('daman-share-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="p-3 bg-white rounded-2xl inline-block mx-auto"><div id="daman-profile-qr"></div></div>
          <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-amber-300 break-all select-all">${this.esc(url)}</div>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="navigator.clipboard.writeText('${url}'); DamanApp.toast('تم نسخ الرابط ✅','success')" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">نسخ الرابط</button>
            <a href="https://wa.me/?text=${encodeURIComponent('تصفح صفحتي الموثقة على ضمان سايت:\n' + url)}" target="_blank" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center">واتساب</a>
          </div>
        </div>`;
      setTimeout(() => {
        const qrEl = document.getElementById('daman-profile-qr');
        if (qrEl && window.QRCode) { qrEl.innerHTML = ''; new QRCode(qrEl, { text: url, width: 156, height: 156, colorDark: '#000', colorLight: '#fff' }); }
      }, 60);
    },

    async reportUserOrPost(targetType, targetId, targetTitle) {
      if (!this.user) return this.openAuthModal('login');
      const reason = window.prompt(`سبب الإبلاغ عن ${targetTitle}:`, 'محتوى مخالف');
      if (!reason || !reason.trim()) return;
      try {
        await db.collection('reports').add({
          targetType, targetId, targetTitle: targetTitle || '', reason: reason.trim(),
          reporterUid: this.user.uid, reporterName: this.profile?.name || '', status: 'open',
          date: this.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.sendNotification('ADMIN', 'بلاغ مستخدم جديد 🚨', `${targetTitle}: ${reason.trim()}`);
        this.toast('تم إرسال البلاغ للإدارة ✅', 'success');
      } catch (e) { this.toast(e.message, 'error'); }
    },

    renderFacebookProfile(container, targetUid) {
      const isOwn = !!(this.user && targetUid === this.user.uid);
      const p = isOwn ? this.profile : this.publicProfileData;
      if (!p) { container.innerHTML = `<div class="glass-card rounded-2xl p-8 text-center text-xs text-slate-400">جارٍ تحميل الصفحة...</div>`; return; }

      const displayName = p.companyName || p.name || 'مستخدم ضمان سايت';
      const accLabels = { company: 'شركة مقاولات', supplier: 'مورّد خامات B2B', individual: 'مقاول / فني / عميل' };
      const followers = Array.isArray(p.followers) ? p.followers : [];
      const iFollow = !!(this.user && followers.includes(this.user.uid));
      const isSub = this.isSubscriptionActive(p);

      container.innerHTML = `
        <div class="space-y-3">
          ${!isOwn ? `<button onclick="DamanApp.viewingPublicUid=null; DamanApp.renderCurrentTab()" class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200"><i class="fa-solid fa-arrow-right me-1"></i> رجوع</button>` : ''}
          <div class="glass-card rounded-3xl overflow-hidden border-slate-700/80">
            <div class="relative h-32 bg-gradient-to-r from-amber-600/40 via-slate-800 to-emerald-700/40">
              ${p.coverPhoto ? `<img src="${p.coverPhoto}" onclick="DamanApp.openMediaLightbox('${p.coverPhoto}','صورة الغلاف')" class="w-full h-full object-cover cursor-pointer" />` : ''}
              ${isOwn ? `<label class="absolute top-2 end-2 px-2.5 py-1 rounded-xl bg-black/70 text-white text-[10px] font-bold cursor-pointer"><i class="fa-solid fa-camera me-1"></i> غلاف<input type="file" accept="image/*" class="hidden" onchange="DamanApp.uploadProfileMedia(this,'coverPhoto')" /></label>` : ''}
            </div>
            <div class="px-4 pb-4 -mt-10 relative space-y-2.5">
              <div class="flex items-end justify-between gap-2">
                <div class="relative">
                  <div class="w-20 h-20 rounded-2xl bg-slate-900 border-4 border-slate-950 overflow-hidden flex items-center justify-center text-2xl font-black text-amber-400 shadow-xl">
                    ${p.avatarPhoto ? `<img src="${p.avatarPhoto}" onclick="DamanApp.openMediaLightbox('${p.avatarPhoto}','${this.esc(displayName)}')" class="w-full h-full object-cover cursor-pointer" />` : this.esc(displayName.charAt(0).toUpperCase())}
                  </div>
                  ${isOwn ? `<label class="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer shadow"><i class="fa-solid fa-camera text-[10px]"></i><input type="file" accept="image/*" class="hidden" onchange="DamanApp.uploadProfileMedia(this,'avatarPhoto')" /></label>` : ''}
                </div>
                <div class="flex items-center gap-1.5 pb-1">
                  <button onclick="DamanApp.openShareProfileModal('${targetUid}','${this.esc(displayName).replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-black"><i class="fa-solid fa-qrcode me-1"></i> مشاركة / QR</button>
                  ${isOwn ? `<button onclick="DamanApp.openEditProfileModal()" class="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-[11px] font-bold"><i class="fa-solid fa-pen"></i></button>` : ''}
                </div>
              </div>
              <div>
                <div class="flex items-center flex-wrap gap-1.5">
                  <h2 class="text-base font-black text-white">${this.esc(displayName)}</h2>
                  ${p.kycStatus === 'verified' ? `<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[9.5px] font-black">موثّق ✅</span>` : ''}
                  ${isSub ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[9.5px] font-black">★ VIP</span>` : ''}
                </div>
                <div class="text-[11px] text-amber-300 font-bold mt-0.5">${accLabels[p.accountType] || accLabels.individual}${p.specialty ? ' • ' + this.esc(p.specialty) : ''}</div>
                ${p.city ? `<div class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot me-1"></i>${this.esc(p.city)}</div>` : ''}
                ${p.facebookUrl ? `<a href="${this.esc(p.facebookUrl)}" target="_blank" class="inline-flex items-center gap-1 text-[10.5px] text-sky-400 font-bold underline mt-1"><i class="fa-brands fa-facebook"></i> صفحة فيسبوك</a>` : ''}
                ${p.bio ? `<p class="text-xs text-slate-300 mt-1.5 leading-relaxed">${this.esc(p.bio)}</p>` : ''}
              </div>
              <div class="grid grid-cols-3 gap-2 text-center pt-1">
                <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800"><div class="text-xs font-black text-amber-400">⭐ ${Number(p.ratingAvg || 5).toFixed(1)}</div><div class="text-[9.5px] text-slate-400">(${Number(p.ratingCount || 0)} تقييم)</div></div>
                <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800"><div class="text-xs font-black text-white">${followers.length}</div><div class="text-[9.5px] text-slate-400">متابع</div></div>
                <div class="p-2 rounded-xl bg-slate-950/80 border border-slate-800"><div class="text-xs font-black text-emerald-400">${this.profilePortfolio.length}</div><div class="text-[9.5px] text-slate-400">سابقة أعمال</div></div>
              </div>
              ${!isOwn ? `
                <div class="grid grid-cols-3 gap-1.5 pt-1">
                  <button onclick="DamanApp.toggleFollowUser('${targetUid}')" class="py-2 rounded-xl ${iFollow ? 'bg-slate-800 text-amber-400 border border-amber-500/40' : 'bg-sky-500 text-slate-950'} font-black text-[11px]">${iFollow ? 'متابَع' : 'متابعة'}</button>
                  <button onclick="if(window.DamanChat) DamanChat.openDirectChat('${targetUid}','${this.esc(displayName).replace(/'/g, "\\'")}','','طلب عرض سعر مباشر')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">عرض سعر</button>
                  <button onclick="DamanApp.reportUserOrPost('user','${targetUid}','${this.esc(displayName).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold text-[11px]">إبلاغ</button>
                </div>` : `
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                  <button onclick="DamanApp.openAddPortfolioModal()" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">+ أضف سابقة أعمال</button>
                  <button onclick="if(window.DamanProjects){ DamanProjects.openPostModal(); } else { DamanApp.switchTab('projects'); }" class="py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px]">نشر إعلان / منشور</button>
                </div>`}
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-extrabold">
            <button onclick="DamanApp.setProfileSubTab('posts')" class="py-2 rounded-lg ${this.profileSubTab === 'posts' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">المنشورات (${this.profilePosts.length})</button>
            <button onclick="DamanApp.setProfileSubTab('portfolio')" class="py-2 rounded-lg ${this.profileSubTab === 'portfolio' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">سابقة الأعمال (${this.profilePortfolio.length})</button>
            <button onclick="DamanApp.setProfileSubTab('reviews')" class="py-2 rounded-lg ${this.profileSubTab === 'reviews' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">التقييمات (${this.profileReviews.length})</button>
          </div>

          ${this.profileSubTab === 'posts' ? `<div class="space-y-2">${!this.profilePosts.length ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد منشورات بعد.</div>` : this.profilePosts.map((po) => `<div class="glass-card rounded-2xl p-3.5 space-y-1.5"><div class="flex items-center justify-between gap-2"><div class="text-xs font-black text-white">${this.esc(po.title)}</div><span class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-bold">${this.esc(po.status || 'approved')}</span></div><p class="text-[11px] text-slate-300">${this.esc(po.description || '')}</p></div>`).join('')}</div>` : ''}
          ${this.profileSubTab === 'portfolio' ? `<div class="grid grid-cols-2 gap-2.5">${!this.profilePortfolio.length ? `<div class="col-span-2 glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد صور في معرض الأعمال بعد.</div>` : this.profilePortfolio.map((item) => `<div class="glass-card rounded-2xl overflow-hidden space-y-1.5 pb-2"><img src="${item.imageBase64}" onclick="DamanApp.openMediaLightbox('${item.imageBase64}','${this.esc(item.title)}')" class="w-full h-32 object-cover cursor-pointer" /><div class="px-2.5"><div class="text-[11px] font-black text-white truncate">${this.esc(item.title)}</div>${isOwn ? `<button onclick="DamanApp.deletePortfolioItem('${item.id}')" class="text-[10px] text-rose-400 font-bold">حذف</button>` : ''}</div></div>`).join('')}</div>` : ''}
          ${this.profileSubTab === 'reviews' ? `<div class="space-y-2">${!this.profileReviews.length ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد تقييمات بعد.</div>` : this.profileReviews.map((rv) => `<div class="glass-card rounded-2xl p-3 space-y-1"><div class="flex justify-between text-xs"><span class="font-black text-white">${this.esc(rv.fromName)}</span><span class="text-amber-400">${'★'.repeat(Number(rv.rating || 5))}</span></div><p class="text-[11px] text-slate-300">${this.esc(rv.comment || '')}</p></div>`).join('')}</div>` : ''}

          ${isOwn ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2.5 text-xs">
              <div class="font-black text-amber-400"><i class="fa-solid fa-shield-halved me-1"></i> البيانات القانونية الموثّقة وإعدادات الأمان</div>
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                <div>الاسم بالبطاقة (للعقود): <b class="text-white">${this.esc(p.legalName || 'غير مثبت بعد')}</b></div>
                <div>الرقم القومي: <b class="text-emerald-400">${this.maskNationalId(p.nationalId)}</b></div>
                <div>تاريخ الميلاد: <b class="text-amber-300">${this.esc(p.birthDate || '—')}</b></div>
                <div>العنوان بالبطاقة: <b class="text-slate-300">${this.esc(p.legalAddress || '—')}</b></div>
                ${p.referralCode ? `<div>كود الدعوة الخاص بك: <b class="text-sky-300 select-all">${this.esc(p.referralCode)}</b></div>` : ''}
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanApp.openChangePasswordModal()" class="py-2 rounded-xl bg-slate-800 text-sky-300 font-bold text-[11px]">تغيير كلمة المرور</button>
                <button onclick="DamanApp.openPrivacyModal()" class="py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-[11px]">الخصوصية والشروط</button>
              </div>
              ${!this.isAdmin() ? `<button onclick="DamanApp.requestDeleteAccount()" class="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-[11px]">طلب حذف الحساب نهائياً</button>` : ''}
            </div>` : ''}
        </div>`;
    },

    // ==================== VERIFY CONTRACT QR, NOTIFS & DYNAMIC PRIVACY ====================
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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">التحقق من عقد رسمي</h3><button onclick="document.getElementById('daman-verify-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanApp.runContractVerify(event)" class="flex gap-2">
            <input id="vc-code" type="text" required value="${this.esc(presetCode)}" placeholder="كود العقد (TKT-123456)" class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold uppercase" />
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
      resBox.innerHTML = `<div class="text-center text-slate-400 py-3">جارٍ الفحص...</div>`;
      try {
        const snap = await db.collection('chatAgreements').where('ticketNumber', '==', code).limit(1).get();
        if (snap.empty) { resBox.innerHTML = `<div class="p-3 rounded-xl bg-rose-500/15 text-rose-300 font-bold text-center">❌ كود العقد غير موجود في سجلات ضمان سايت!</div>`; return; }
        const a = snap.docs[0].data();
        resBox.innerHTML = `
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-1 text-[11px]">
            <div class="text-emerald-300 font-black">✅ عقد رسمي موثّق على منصة ضمان سايت</div>
            <div>الكود: <b>${this.esc(a.ticketNumber)}</b> | الحالة: <b>${this.esc(a.status)}</b></div>
            <div>البند: <b>${this.esc(a.title)}</b></div>
            <div>القيمة الإجمالية: <b class="text-amber-300">${this.fmtMoney(a.totalAmount)} ج.م</b></div>
            <div>تاريخ البداية: <b>${this.esc(a.startDate || a.date || '—')}</b> | تاريخ الانتهاء: <b>${this.esc(a.endDate || '—')}</b></div>
            <div>الطرفان: ${this.esc(a.payerName)} ⇄ ${this.esc(a.providerName)}</div>
            <div>اعتماد النسخة الموقّعة: <b class="${a.contractStatus === 'approved' ? 'text-emerald-400' : 'text-amber-300'}">${a.contractStatus === 'approved' ? 'معتمد من الإدارة ✅' : 'قيد الاعتماد'}</b></div>
          </div>`;
      } catch (err) { resBox.innerHTML = `<div class="text-rose-400 text-center">تعذر الفحص</div>`; }
    },

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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">الإشعارات (${this.notifications.length})</h3><button onclick="document.getElementById('daman-notifs-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          ${!this.notifications.length ? `<div class="text-center text-slate-400 py-8">لا توجد إشعارات</div>` : this.notifications.map((n) => `<div class="p-3 rounded-xl ${n.read ? 'bg-slate-950/60 border-slate-800' : 'bg-amber-500/10 border-amber-500/40'} border space-y-1"><div class="flex justify-between gap-2"><div class="font-black text-white">${this.esc(n.title)}</div><span class="text-[9.5px] text-slate-500 shrink-0">${this.esc(n.date || '')}</span></div><div class="text-[11px] text-slate-300 whitespace-pre-line">${this.esc(n.body)}</div></div>`).join('')}
        </div>`;
      this.notifications.filter((n) => !n.read).forEach((n) => db.collection('notifications').doc(n.id).update({ read: true }).catch(() => {}));
    },

    openPrivacyModal() {
      const txt = this.appConfig?.branding?.privacyText || DEFAULT_PRIVACY;
      let m = document.getElementById('daman-privacy-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-privacy-modal';
        m.className = 'daman-modal fixed inset-0 z-[95] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 max-h-[85vh] overflow-y-auto space-y-3 text-xs leading-relaxed text-slate-300">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">سياسة الخصوصية والشروط — ${this.esc(this.t('appName'))}</h3><button onclick="document.getElementById('daman-privacy-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="whitespace-pre-line text-[11.5px] text-slate-200">${this.esc(txt)}</div>
          <button onclick="document.getElementById('daman-privacy-modal').classList.add('hidden')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">موافق</button>
        </div>`;
    }
  };

  window.DamanApp = DamanApp;
  window.addEventListener('DOMContentLoaded', () => DamanApp.init());
})();
