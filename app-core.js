(function () {
  if (!firebase.apps.length) {
    firebase.initializeApp(window.DAMAN_CONFIG.firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  const savedLang = localStorage.getItem('daman_lang');
  const autoLang = (navigator.language || 'ar').toLowerCase().startsWith('ar') ? 'ar' : 'en';

  const App = {
    auth,
    db,
    user: null,
    profile: null,
    unsubProfile: null,
    unsubNotifs: null,
    notifications: [],
    lang: savedLang || autoLang,
    activeTab: 'home',
    selectedMainCat: window.DAMAN_CATEGORIES[0].id,
    selectedSubCat: null,
    ads: window.DAMAN_DEFAULT_ADS.slice(),
    adIndex: 0,
    adTimer: null,
    modules: {},

    isAdmin() {
      return !!(
        this.user &&
        this.user.email &&
        this.user.email.trim().toLowerCase() === window.DAMAN_CONFIG.adminEmail
      );
    },

    t(key) {
      const dict = window.DAMAN_I18N[this.lang] || window.DAMAN_I18N.ar;
      return dict[key] || key;
    },

    esc(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    fmtMoney(val) {
      const n = Number(val || 0);
      return n.toLocaleString(this.lang === 'ar' ? 'ar-EG' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    },

    toast(message, type = 'info') {
      const box = document.getElementById('toast-container');
      if (!box) return;
      const colors = {
        success: 'bg-emerald-600 border-emerald-400 text-white',
        error: 'bg-rose-600 border-rose-400 text-white',
        warning: 'bg-amber-600 border-amber-400 text-white',
        info: 'bg-slate-800 border-slate-600 text-slate-100'
      };
      const el = document.createElement('div');
      el.className = `px-4 py-3 rounded-xl border shadow-xl text-xs font-bold flex items-center gap-2 transition-all duration-300 ${colors[type] || colors.info}`;
      el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i><span>${this.esc(message)}</span>`;
      box.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px)';
        setTimeout(() => el.remove(), 300);
      }, 3200);
    },

    registerModule(name, moduleObj) {
      this.modules[name] = moduleObj;
      if (this.activeTab === name || (name === 'chat' && this.activeTab === 'support')) {
        this.renderCurrentTab();
      }
    },

    applyLanguage() {
      const html = document.documentElement;
      html.lang = this.lang;
      html.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      localStorage.setItem('daman_lang', this.lang);

      const langBtn = document.getElementById('lang-btn-text');
      if (langBtn) langBtn.textContent = this.lang === 'ar' ? 'EN' : 'عربي';

      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        el.textContent = this.t(key);
      });
    },

    toggleLanguage() {
      this.lang = this.lang === 'ar' ? 'en' : 'ar';
      this.applyLanguage();
      this.renderHeaderState();
      this.renderCurrentTab();
    },

    init() {
      this.applyLanguage();
      this.loadAds();
      this.bindAuthForms();

      auth.onAuthStateChanged((user) => {
        this.user = user;
        if (this.unsubProfile) {
          this.unsubProfile();
          this.unsubProfile = null;
        }
        if (this.unsubNotifs) {
          this.unsubNotifs();
          this.unsubNotifs = null;
        }

        if (!user) {
          this.profile = null;
          this.notifications = [];
          this.renderHeaderState();
          this.renderCurrentTab();
          return;
        }

        const userRef = db.collection('users').doc(user.uid);
        this.unsubProfile = userRef.onSnapshot(
          (snap) => {
            if (!snap.exists) {
              this.openOnboardingModal();
              return;
            }
            this.profile = Object.assign({ uid: user.uid }, snap.data());
            this.closeModal('onboarding-modal');
            this.closeModal('auth-modal');
            this.renderHeaderState();
            this.renderCurrentTab();
          },
          (err) => {
            console.error('Profile listener error:', err);
          }
        );

        this.unsubNotifs = db
          .collection('notifications')
          .where('userId', '==', user.uid)
          .limit(20)
          .onSnapshot(
            (snap) => {
              this.notifications = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              this.renderNotifBadge();
            },
            () => {}
          );
      });

      this.renderHeaderState();
      this.renderCurrentTab();
    },

    async loadAds() {
      try {
        const snap = await db.collection('ads').where('active', '==', true).get();
        if (!snap.empty) {
          this.ads = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        } else {
          this.ads = window.DAMAN_DEFAULT_ADS.slice();
        }
      } catch (e) {
        this.ads = window.DAMAN_DEFAULT_ADS.slice();
      }
      if (this.activeTab === 'home') this.renderHome();
      this.startAdAutoplay();
    },

    startAdAutoplay() {
      if (this.adTimer) clearInterval(this.adTimer);
      this.adTimer = setInterval(() => {
        if (this.activeTab === 'home' && this.ads.length > 1) {
          this.adIndex = (this.adIndex + 1) % this.ads.length;
          const wrap = document.getElementById('home-ad-slider');
          if (wrap) wrap.innerHTML = this.buildAdSlideHtml();
        }
      }, 5000);
    },

    stepAd(delta) {
      if (!this.ads.length) return;
      this.adIndex = (this.adIndex + delta + this.ads.length) % this.ads.length;
      const wrap = document.getElementById('home-ad-slider');
      if (wrap) wrap.innerHTML = this.buildAdSlideHtml();
    },

    renderNotifBadge() {
      const unread = this.notifications.filter((n) => !n.read).length;
      const badge = document.getElementById('notif-badge');
      if (!badge) return;
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    },

    renderHeaderState() {
      const adminBtn = document.getElementById('header-admin-btn');
      const authBtn = document.getElementById('header-auth-btn');
      const notifBtn = document.getElementById('header-notif-btn');

      if (adminBtn) {
        if (this.isAdmin()) adminBtn.classList.remove('hidden');
        else adminBtn.classList.add('hidden');
      }
      if (authBtn) {
        if (this.user) authBtn.classList.add('hidden');
        else authBtn.classList.remove('hidden');
      }
      if (notifBtn) {
        if (this.user) notifBtn.classList.remove('hidden');
        else notifBtn.classList.add('hidden');
      }

      document.querySelectorAll('.nav-btn').forEach((btn) => {
        const t = btn.getAttribute('data-tab');
        if (t === this.activeTab) {
          btn.classList.add('text-amber-400');
          btn.classList.remove('text-slate-400');
        } else {
          btn.classList.remove('text-amber-400');
          btn.classList.add('text-slate-400');
        }
      });
    },

    switchTab(tab) {
      if (tab === 'admin' && !this.isAdmin()) {
        this.toast(this.lang === 'ar' ? 'صلاحية الإدارة مقصورة على مدير المنصة فقط' : 'Admin access restricted', 'error');
        return;
      }
      this.activeTab = tab;
      this.renderHeaderState();
      this.renderCurrentTab();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    selectMainCategory(catId) {
      this.selectedMainCat = catId;
      this.selectedSubCat = null;
      this.renderHome();
    },

    openSubCategory(mainId, subId) {
      this.selectedMainCat = mainId;
      this.selectedSubCat = subId;
      this.switchTab('projects');
    },

    renderCurrentTab() {
      const main = document.getElementById('app-main');
      if (!main) return;

      if (this.profile && this.profile.status === 'banned' && !this.isAdmin()) {
        main.innerHTML = `
          <div class="p-6 text-center mt-10 bg-rose-950/50 border border-rose-500/40 rounded-2xl">
            <i class="fa-solid fa-ban text-4xl text-rose-400 mb-3"></i>
            <h2 class="text-lg font-extrabold text-white mb-2">${this.lang === 'ar' ? 'تم إيقاف الحساب' : 'Account Suspended'}</h2>
            <p class="text-xs text-slate-300 leading-relaxed">${this.t('frozenNotice')}</p>
            <button onclick="DamanApp.logout()" class="mt-4 px-5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white">${this.t('logout')}</button>
          </div>`;
        return;
      }

      if (this.activeTab === 'home') return this.renderHome();
      if (this.activeTab === 'about') return this.renderAbout();
      if (this.activeTab === 'profile') return this.renderProfile();

      const mod = this.modules[this.activeTab];
      if (mod && typeof mod.render === 'function') {
        mod.render(main, this);
      } else {
        this.renderPhasePlaceholder(main, this.activeTab);
      }
    },

    buildAdSlideHtml() {
      const ad = this.ads[this.adIndex] || this.ads[0];
      if (!ad) return '';
      const badge = this.lang === 'ar' ? (ad.badgeAr || ad.badge || 'إعلان') : (ad.badgeEn || ad.badgeAr || 'Promo');
      const title = this.lang === 'ar' ? (ad.titleAr || ad.title) : (ad.titleEn || ad.titleAr);
      const desc = this.lang === 'ar' ? (ad.descAr || ad.desc) : (ad.descEn || ad.descAr);
      const grad = ad.gradient || 'from-amber-600 via-amber-500 to-orange-600';
      const clickAttr = ad.linkUrl
        ? `window.open('${this.esc(ad.linkUrl)}','_blank')`
        : `DamanApp.switchTab('${this.esc(ad.actionTab || 'about')}')`;

      return `
        <div onclick="${clickAttr}" class="relative overflow-hidden rounded-2xl p-4 cursor-pointer bg-gradient-to-br ${grad} border border-white/15 shadow-lg min-h-[132px] flex flex-col justify-between">
          ${ad.imageBase64 ? `<img src="${ad.imageBase64}" class="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none" />` : ''}
          <div class="relative z-10 flex items-center justify-between">
            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-black/35 text-amber-200 border border-white/15">${this.esc(badge)}</span>
            <div class="flex items-center gap-1" onclick="event.stopPropagation()">
              <button onclick="DamanApp.stepAd(-1)" class="w-6 h-6 rounded-full bg-black/30 text-white text-[10px] flex items-center justify-center"><i class="fa-solid fa-chevron-${this.lang === 'ar' ? 'right' : 'left'}"></i></button>
              <button onclick="DamanApp.stepAd(1)" class="w-6 h-6 rounded-full bg-black/30 text-white text-[10px] flex items-center justify-center"><i class="fa-solid fa-chevron-${this.lang === 'ar' ? 'left' : 'right'}"></i></button>
            </div>
          </div>
          <div class="relative z-10 mt-2">
            <h3 class="text-sm font-extrabold text-white leading-snug">${this.esc(title)}</h3>
            <p class="text-[11px] text-white/85 mt-1 leading-relaxed line-clamp-2">${this.esc(desc)}</p>
          </div>
          <div class="relative z-10 flex justify-center gap-1.5 mt-3">
            ${this.ads.map((_, idx) => `<span class="h-1.5 rounded-full transition-all ${idx === this.adIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}"></span>`).join('')}
          </div>
        </div>`;
    },

    renderHome() {
      const main = document.getElementById('app-main');
      const activeCat = window.DAMAN_CATEGORIES.find((c) => c.id === this.selectedMainCat) || window.DAMAN_CATEGORIES[0];

      const frozenBar =
        this.profile && this.profile.status === 'frozen'
          ? `<div class="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation"></i><span>${this.t('frozenNotice')}</span></div>`
          : '';

      const userCard = this.profile
        ? `
          <div class="glass-card rounded-2xl p-3.5 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-extrabold text-white truncate">${this.esc(this.profile.name)}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">${this.getRoleLabel(this.profile.accountType)}</span>
                ${this.profile.kycStatus === 'verified' ? `<i class="fa-solid fa-circle-check text-sky-400 text-xs" title="${this.t('verified')}"></i>` : ''}
              </div>
              <div class="flex items-center gap-3 mt-1.5 text-[11px]">
                <span class="text-emerald-400 font-bold">${this.t('availableBal')}: ${this.fmtMoney(this.profile.balanceAvailable)} ${this.t('egp')}</span>
                <span class="text-amber-300 font-bold">${this.t('escrowBal')}: ${this.fmtMoney(this.profile.balanceEscrow)} ${this.t('egp')}</span>
              </div>
            </div>
            <button onclick="DamanApp.switchTab('wallet')" class="shrink-0 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-[11px]">
              <i class="fa-solid fa-wallet"></i>
            </button>
          </div>`
        : `
          <div class="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-extrabold text-white">${this.lang === 'ar' ? 'أهلاً بك في ضمان سايت' : 'Welcome to DamanSite'}</h2>
              <p class="text-[11px] text-slate-400 mt-0.5">${this.lang === 'ar' ? 'سجّل كعميل أو مقاول أو شركة مقاولات وابدأ بأمان' : 'Join as Client, Contractor, or Contracting Company'}</p>
            </div>
            <button onclick="DamanApp.openAuthModal('register')" class="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs">
              ${this.t('loginBtn')}
            </button>
          </div>`;

      main.innerHTML = `
        <div class="space-y-4">
          ${frozenBar}
          ${userCard}

          <!-- Homepage Ads Slider -->
          <div id="home-ad-slider">${this.buildAdSlideHtml()}</div>

          <!-- Quick Shortcuts -->
          <div class="grid grid-cols-4 gap-2">
            <button onclick="DamanApp.switchTab('projects')" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-amber-500/40">
              <span class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center"><i class="fa-solid fa-plus"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${this.t('postProject')}</span>
            </button>
            <button onclick="DamanApp.switchTab('chat')" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-emerald-500/40">
              <span class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><i class="fa-solid fa-robot"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${this.t('aiSupport')}</span>
            </button>
            <button onclick="DamanApp.switchTab('company')" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-sky-500/40">
              <span class="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center"><i class="fa-solid fa-building"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${this.t('companyPanel')}</span>
            </button>
            <button onclick="DamanApp.switchTab('about')" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-purple-500/40">
              <span class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center"><i class="fa-solid fa-circle-info"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${this.t('aboutApp')}</span>
            </button>
          </div>

          <!-- Hierarchical Categories (Smooth Grid) -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-extrabold text-white">${this.t('mainCategories')}</h3>
              <span class="text-[10px] text-slate-400">${this.t('tapCategoryHint')}</span>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              ${window.DAMAN_CATEGORIES.map((cat) => {
                const isSelected = cat.id === activeCat.id;
                return `
                  <button onclick="DamanApp.selectMainCategory('${cat.id}')"
                    class="text-start rounded-2xl p-3 border transition-all ${isSelected ? 'bg-slate-800 border-amber-500 shadow-md shadow-amber-500/10' : 'glass-card hover:border-slate-600'}">
                    <div class="flex items-center justify-between mb-2">
                      <span class="w-9 h-9 rounded-xl bg-gradient-to-br ${cat.color} text-white flex items-center justify-center text-sm shadow">
                        <i class="fa-solid ${cat.icon}"></i>
                      </span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/80 text-slate-300">${cat.subs.length}</span>
                    </div>
                    <div class="text-xs font-extrabold text-white">${this.lang === 'ar' ? cat.ar : cat.en}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5 line-clamp-1">${this.lang === 'ar' ? cat.descAr : cat.descEn}</div>
                  </button>`;
              }).join('')}
            </div>
          </div>

          <!-- Sub-Categories Panel -->
          <div class="glass-card rounded-2xl p-3.5 border-amber-500/30">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <i class="fa-solid ${activeCat.icon} text-amber-400"></i>
                <h4 class="text-xs font-extrabold text-white">${this.lang === 'ar' ? activeCat.ar : activeCat.en} — ${this.t('subCategories')}</h4>
              </div>
              <button onclick="DamanApp.openSubCategory('${activeCat.id}', null)" class="text-[10px] font-bold text-amber-400 hover:underline">${this.t('browseProjects')}</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${activeCat.subs.map((sub) => `
                <button onclick="DamanApp.openSubCategory('${activeCat.id}', '${sub.id}')"
                  class="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-start transition-all">
                  <span class="w-8 h-8 shrink-0 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center text-xs">
                    <i class="fa-solid ${sub.icon}"></i>
                  </span>
                  <span class="text-[11px] font-bold text-slate-200 leading-tight">${this.lang === 'ar' ? sub.ar : sub.en}</span>
                </button>`).join('')}
            </div>
          </div>
        </div>`;
    },

    renderAbout() {
      const main = document.getElementById('app-main');
      const isAr = this.lang === 'ar';
      main.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-2xl p-5 bg-gradient-to-br from-slate-800 to-slate-900 border border-amber-500/30 text-center">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center text-2xl shadow-lg mb-3">
              <i class="fa-solid fa-helmet-safety"></i>
            </div>
            <h2 class="text-lg font-extrabold text-white">${isAr ? 'ضمان سايت | DamanSite' : 'DamanSite Platform'}</h2>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              ${isAr
                ? 'أول منصة مصرية متكاملة تجمع بين إدارة المقاولات والتشطيبات، الضمان المالي الوسيط (Escrow)، والمعاينات الهندسية المعتمدة لحماية المالك والمقاول وشركات المقاولات.'
                : 'An integrated platform combining contracting & finishing, financial escrow protection, and certified site inspections for owners, contractors, and firms.'}
            </p>
          </div>

          <div class="glass-card rounded-2xl p-4 space-y-3">
            <h3 class="text-sm font-extrabold text-amber-400 flex items-center gap-2"><i class="fa-solid fa-shield-halved"></i> ${isAr ? 'كيف يعمل نظام الضمان المالي (3.5%)؟' : 'How 3.5% Financial Escrow Works'}</h3>
            <ol class="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>${isAr ? 'ينشر العميل مشروعه ويستقبل عروض الأسعار والدفعات من المقاولين والشركات الموثّقة.' : 'Client posts a project and receives formal cost & milestone bids.'}</li>
              <li>${isAr ? 'عند قبول العرض، يتم حجز قيمة المرحلة داخل محفظة الضمان (Escrow) بأمان تام.' : 'Upon acceptance, the stage amount is locked safely in Escrow.'}</li>
              <li>${isAr ? 'ينفذ المقاول أو الشركة العمل ويتم الاستلام الهندسي أو موافقة العميل.' : 'Contractor/Company executes the work and completes handover.'}</li>
              <li>${isAr ? 'يتحرر المبلغ فوراً لمحفظة المنفّذ بعد خصم عمولة ضمان المنصة (3.5%) مع إتاحة التقييم.' : 'Funds release immediately minus 3.5% escrow fee, unlocking verified ratings.'}</li>
            </ol>
          </div>

          <div class="glass-card rounded-2xl p-4 space-y-2.5">
            <h3 class="text-sm font-extrabold text-sky-400 flex items-center gap-2"><i class="fa-solid fa-building-user"></i> ${isAr ? 'خدماتنا للأفراد والشركات' : 'Services for Individuals & Companies'}</h3>
            <ul class="space-y-2 text-xs text-slate-300">
              <li class="flex items-start gap-2"><i class="fa-solid fa-check text-emerald-400 mt-1"></i><span>${isAr ? '17 تخصصاً معمارياً وإنشائياً مقسمة تحت 4 قطاعات رئيسية.' : '17 construction & finishing specialties across 4 main pillars.'}</span></li>
              <li class="flex items-start gap-2"><i class="fa-solid fa-check text-emerald-400 mt-1"></i><span>${isAr ? 'حسابات موثّقة لشركات المقاولات والمكاتب الهندسية مع إدارة فرق العمل وعقود الباطن (B2B).' : 'Verified corporate accounts with internal team management and B2B subcontracting.'}</span></li>
              <li class="flex items-start gap-2"><i class="fa-solid fa-check text-emerald-400 mt-1"></i><span>${isAr ? 'باقات معاينة هندسية قبل الصب وعند الاستلام مع تقارير فنية معتمدة.' : 'Engineering inspection visits before pouring and at handover.'}</span></li>
              <li class="flex items-start gap-2"><i class="fa-solid fa-check text-emerald-400 mt-1"></i><span>${isAr ? 'دردشة مباشرة، دعم فني بالذكاء الاصطناعي 24/7، ولجنة إدارة للفصل العادل في النزاعات.' : 'Live chat, 24/7 AI support, and fair administrative dispute resolution.'}</span></li>
            </ul>
          </div>

          <button onclick="DamanApp.switchTab('home')" class="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-extrabold text-white">
            ${isAr ? 'العودة للرئيسية' : 'Back to Home'}
          </button>
        </div>`;
    },

    renderProfile() {
      const main = document.getElementById('app-main');
      if (!this.user || !this.profile) {
        main.innerHTML = `
          <div class="glass-card rounded-2xl p-6 text-center mt-6 space-y-3">
            <i class="fa-solid fa-user-shield text-4xl text-amber-400"></i>
            <h3 class="text-base font-extrabold text-white">${this.lang === 'ar' ? 'سجّل الدخول لإدارة حسابك' : 'Sign in to manage your profile'}</h3>
            <p class="text-xs text-slate-400">${this.lang === 'ar' ? 'تابع محفظتك، مشاريعك، تقييماتك، وحساب شركتك من مكان واحد.' : 'Track your wallet, projects, ratings, and company workspace.'}</p>
            <button onclick="DamanApp.openAuthModal('login')" class="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs">${this.t('loginBtn')}</button>
          </div>`;
        return;
      }

      const p = this.profile;
      const stars = '★'.repeat(Math.round(p.ratingAvg || 0)) + '☆'.repeat(5 - Math.round(p.ratingAvg || 0));

      main.innerHTML = `
        <div class="space-y-4">
          <div class="glass-card rounded-2xl p-4">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center text-xl font-black">
                ${this.esc((p.name || 'U').charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h3 class="text-sm font-extrabold text-white truncate">${this.esc(p.name)}</h3>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">${this.getRoleLabel(p.accountType)}</span>
                </div>
                <p class="text-[11px] text-slate-400 truncate mt-0.5">${this.esc(p.email)}</p>
                <div class="flex items-center gap-2 mt-1 text-xs">
                  <span class="text-amber-400 tracking-tighter">${stars}</span>
                  <span class="text-[10px] text-slate-400">(${p.ratingCount || 0})</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full ${p.kycStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}">
                    ${p.kycStatus === 'verified' ? this.t('verified') : p.kycStatus === 'pending' ? this.t('pendingKyc') : this.t('unverified')}
                  </span>
                </div>
              </div>
            </div>

            ${p.accountType === 'company' ? `
              <div class="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                <span><i class="fa-solid fa-building text-sky-400 me-1"></i> ${this.esc(p.companyName || '-')}</span>
                <span class="text-[10px] text-slate-400">${this.lang === 'ar' ? 'سجل تجاري:' : 'CR:'} ${this.esc(p.commercialReg || '-')}</span>
              </div>` : ''}
          </div>

          <!-- Balances Snapshot -->
          <div class="grid grid-cols-3 gap-2">
            <div class="glass-card rounded-xl p-3 text-center">
              <div class="text-[10px] text-slate-400">${this.t('availableBal')}</div>
              <div class="text-xs font-extrabold text-emerald-400 mt-1">${this.fmtMoney(p.balanceAvailable)}</div>
            </div>
            <div class="glass-card rounded-xl p-3 text-center">
              <div class="text-[10px] text-slate-400">${this.t('escrowBal')}</div>
              <div class="text-xs font-extrabold text-amber-400 mt-1">${this.fmtMoney(p.balanceEscrow)}</div>
            </div>
            <div class="glass-card rounded-xl p-3 text-center">
              <div class="text-[10px] text-slate-400">${this.t('heldBal')}</div>
              <div class="text-xs font-extrabold text-rose-400 mt-1">${this.fmtMoney(p.balanceHeld)}</div>
            </div>
          </div>

          <!-- Action List -->
          <div class="glass-card rounded-2xl divide-y divide-slate-800 overflow-hidden">
            ${p.accountType === 'company' ? `
              <button onclick="DamanApp.switchTab('company')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-white hover:bg-slate-800/60">
                <span class="flex items-center gap-2.5"><i class="fa-solid fa-building-shield text-sky-400 w-4"></i>${this.t('companyPanel')}</span>
                <i class="fa-solid fa-chevron-${this.lang === 'ar' ? 'left' : 'right'} text-slate-500"></i>
              </button>` : ''}
            ${this.isAdmin() ? `
              <button onclick="DamanApp.switchTab('admin')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-amber-400 hover:bg-slate-800/60">
                <span class="flex items-center gap-2.5"><i class="fa-solid fa-crown w-4"></i>${this.lang === 'ar' ? 'لوحة الإدارة العليا (Super Admin)' : 'Super Admin Dashboard'}</span>
                <i class="fa-solid fa-chevron-${this.lang === 'ar' ? 'left' : 'right'}"></i>
              </button>` : ''}
            <button onclick="DamanApp.switchTab('wallet')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-white hover:bg-slate-800/60">
              <span class="flex items-center gap-2.5"><i class="fa-solid fa-wallet text-emerald-400 w-4"></i>${this.t('navWallet')}</span>
              <i class="fa-solid fa-chevron-${this.lang === 'ar' ? 'left' : 'right'} text-slate-500"></i>
            </button>
            <button onclick="DamanApp.switchTab('chat')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-white hover:bg-slate-800/60">
              <span class="flex items-center gap-2.5"><i class="fa-solid fa-headset text-purple-400 w-4"></i>${this.t('aiSupport')}</span>
              <i class="fa-solid fa-chevron-${this.lang === 'ar' ? 'left' : 'right'} text-slate-500"></i>
            </button>
            <button onclick="DamanApp.switchTab('about')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-white hover:bg-slate-800/60">
              <span class="flex items-center gap-2.5"><i class="fa-solid fa-circle-info text-slate-300 w-4"></i>${this.t('aboutApp')}</span>
              <i class="fa-solid fa-chevron-${this.lang === 'ar' ? 'left' : 'right'} text-slate-500"></i>
            </button>
            <button onclick="DamanApp.logout()" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-rose-400 hover:bg-rose-950/30">
              <span class="flex items-center gap-2.5"><i class="fa-solid fa-right-from-bracket w-4"></i>${this.t('logout')}</span>
            </button>
          </div>
        </div>`;
    },

    renderPhasePlaceholder(container, tabName) {
      const phaseMap = {
        wallet: 'المرحلة 2 (wallet.js)',
        projects: 'المرحلة 2 (projects-escrow.js)',
        chat: 'المرحلة 3 (chat-support.js)',
        company: 'المرحلة 3 (company-panel.js)',
        admin: 'المرحلة 4 (admin.js)'
      };
      container.innerHTML = `
        <div class="glass-card rounded-2xl p-6 text-center mt-6 space-y-3 border-amber-500/30">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl">
            <i class="fa-solid fa-cubes"></i>
          </div>
          <h3 class="text-sm font-extrabold text-white">${this.t('phasePendingTitle')}</h3>
          <p class="text-xs text-slate-400 leading-relaxed">${this.t('phasePendingDesc')}</p>
          <div class="inline-block text-[11px] font-bold px-3 py-1 rounded-full bg-slate-800 text-amber-300">${phaseMap[tabName] || tabName}</div>
        </div>`;
    },

    getRoleLabel(type) {
      if (type === 'contractor') return this.t('roleContractor');
      if (type === 'company') return this.t('roleCompany');
      return this.t('roleClient');
    },

    openModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    },

    closeModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    },

    openAuthModal(mode = 'login') {
      this.setAuthMode(mode);
      this.openModal('auth-modal');
    },

    setAuthMode(mode) {
      const loginForm = document.getElementById('login-form');
      const regForm = document.getElementById('register-form');
      const tLogin = document.getElementById('tab-login-btn');
      const tReg = document.getElementById('tab-reg-btn');
      if (mode === 'register') {
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
        tReg.className = 'flex-1 py-2 text-xs font-extrabold rounded-lg bg-amber-500 text-slate-950';
        tLogin.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-400';
      } else {
        regForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        tLogin.className = 'flex-1 py-2 text-xs font-extrabold rounded-lg bg-amber-500 text-slate-950';
        tReg.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-400';
      }
    },

    toggleCompanyFields(selectId, boxId) {
      const sel = document.getElementById(selectId);
      const box = document.getElementById(boxId);
      if (!sel || !box) return;
      if (sel.value === 'company') box.classList.remove('hidden');
      else box.classList.add('hidden');
    },

    openOnboardingModal() {
      const nameInput = document.getElementById('ob-name');
      if (nameInput && this.user) nameInput.value = this.user.displayName || '';
      this.openModal('onboarding-modal');
    },

    openNotifications() {
      const list = document.getElementById('notif-list');
      if (list) {
        if (!this.notifications.length) {
          list.innerHTML = `<div class="text-center text-xs text-slate-400 py-8">${this.lang === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}</div>`;
        } else {
          list.innerHTML = this.notifications
            .map((n) => `
              <div class="p-3 rounded-xl ${n.read ? 'bg-slate-900/60' : 'bg-amber-500/10 border border-amber-500/30'}">
                <div class="text-xs font-bold text-white">${this.esc(n.title || '')}</div>
                <div class="text-[11px] text-slate-300 mt-0.5">${this.esc(n.body || '')}</div>
              </div>`)
            .join('');
          this.notifications
            .filter((n) => !n.read)
            .forEach((n) => db.collection('notifications').doc(n.id).update({ read: true }).catch(() => {}));
        }
      }
      this.openModal('notifications-modal');
    },

    bindAuthForms() {
      const loginForm = document.getElementById('login-form');
      if (loginForm) {
        loginForm.onsubmit = async (e) => {
          e.preventDefault();
          const email = document.getElementById('login-email').value.trim();
          const pass = document.getElementById('login-pass').value;
          try {
            await auth.signInWithEmailAndPassword(email, pass);
            this.toast(this.lang === 'ar' ? 'تم تسجيل الدخول بنجاح' : 'Signed in successfully', 'success');
          } catch (err) {
            this.toast(err.message, 'error');
          }
        };
      }

      const regForm = document.getElementById('register-form');
      if (regForm) {
        regForm.onsubmit = async (e) => {
          e.preventDefault();
          const name = document.getElementById('reg-name').value.trim();
          const phone = document.getElementById('reg-phone').value.trim();
          const email = document.getElementById('reg-email').value.trim();
          const pass = document.getElementById('reg-pass').value;
          const accountType = document.getElementById('reg-role').value;
          const companyName = document.getElementById('reg-company-name').value.trim();
          const commercialReg = document.getElementById('reg-company-cr').value.trim();

          try {
            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            await db.collection('users').doc(cred.user.uid).set({
              uid: cred.user.uid,
              email: email.toLowerCase(),
              name,
              phone,
              accountType,
              companyName: accountType === 'company' ? companyName : '',
              commercialReg: accountType === 'company' ? commercialReg : '',
              kycStatus: 'unverified',
              status: 'active',
              balanceAvailable: 0,
              balanceEscrow: 0,
              balanceHeld: 0,
              ratingAvg: 0,
              ratingCount: 0,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.toast(this.lang === 'ar' ? 'تم إنشاء الحساب بنجاح' : 'Account created successfully', 'success');
          } catch (err) {
            this.toast(err.message, 'error');
          }
        };
      }

      const obForm = document.getElementById('onboarding-form');
      if (obForm) {
        obForm.onsubmit = async (e) => {
          e.preventDefault();
          if (!this.user) return;
          const name = document.getElementById('ob-name').value.trim();
          const phone = document.getElementById('ob-phone').value.trim();
          const accountType = document.getElementById('ob-role').value;
          const companyName = document.getElementById('ob-company-name').value.trim();
          const commercialReg = document.getElementById('ob-company-cr').value.trim();
          try {
            await db.collection('users').doc(this.user.uid).set({
              uid: this.user.uid,
              email: (this.user.email || '').toLowerCase(),
              name,
              phone,
              accountType,
              companyName: accountType === 'company' ? companyName : '',
              commercialReg: accountType === 'company' ? commercialReg : '',
              kycStatus: 'unverified',
              status: 'active',
              balanceAvailable: 0,
              balanceEscrow: 0,
              balanceHeld: 0,
              ratingAvg: 0,
              ratingCount: 0,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.toast(this.lang === 'ar' ? 'تم حفظ بيانات حسابك بنجاح' : 'Profile completed', 'success');
          } catch (err) {
            this.toast(err.message, 'error');
          }
        };
      }
    },

    async googleSignIn() {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
      } catch (err) {
        this.toast(err.message, 'error');
      }
    },

    async logout() {
      await auth.signOut();
      this.activeTab = 'home';
      this.toast(this.lang === 'ar' ? 'تم تسجيل الخروج' : 'Signed out', 'info');
    }
  };

  window.DamanApp = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
