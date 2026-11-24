(function () {
  const CACHE_TTL_MS = 120000; // تحديث كاش الدليل كل دقيقتين لتوفير استهلاك Firebase

  const GlobalSearch = {
    query: '',
    filterTab: 'all', // 'all' | 'users' | 'categories' | 'posts' | 'companies'
    usersCache: [],
    companiesCache: [],
    lastFetchAt: 0,
    loadingDir: false,
    _debounceTimer: null,
    _booted: false,

    norm(s) {
      if (window.DamanApp && typeof window.DamanApp.normalizeAr === 'function') {
        return window.DamanApp.normalizeAr(s);
      }
      return String(s || '')
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F]/g, '')
        .trim();
    },

    async ensureDirectory(force = false) {
      const app = window.DamanApp;
      if (!app || !app.db) return;

      if (window.DamanProjects && typeof DamanProjects.ensureListeners === 'function') {
        try { DamanProjects.ensureListeners(app); } catch (e) {}
      }

      if (!force && this.lastFetchAt && (Date.now() - this.lastFetchAt) < CACHE_TTL_MS && this.usersCache.length) {
        return;
      }
      if (this.loadingDir) return;
      this.loadingDir = true;

      try {
        const tasks = [
          app.db.collection('users').limit(300).get().catch(() => null),
          app.user ? app.db.collection('companies').limit(120).get().catch(() => null) : Promise.resolve(null)
        ];
        const [uSnap, cSnap] = await Promise.all(tasks);
        if (uSnap && uSnap.docs) {
          this.usersCache = uSnap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .filter((u) => u.status !== 'banned');
        }
        if (cSnap && cSnap.docs) {
          this.companiesCache = cSnap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .filter((c) => c.status !== 'suspended');
        }
        this.lastFetchAt = Date.now();
      } finally {
        this.loadingDir = false;
      }
    },

    getCategoriesList() {
      if (window.DamanCatAds && typeof DamanCatAds.getActiveCategories === 'function') {
        return DamanCatAds.getActiveCategories();
      }
      return (window.DamanApp && Array.isArray(window.DamanApp.CATEGORIES)) ? window.DamanApp.CATEGORIES : [];
    },

    getCategoryLabel(id) {
      if (window.DamanCatAds && typeof DamanCatAds.getCatName === 'function') {
        return DamanCatAds.getCatName(id);
      }
      const c = this.getCategoriesList().find((x) => x.id === id);
      return c ? `${c.icon || '📌'} ${c.ar}` : (id || 'عام');
    },

    searchAll(rawQuery) {
      const app = window.DamanApp;
      const q = this.norm(rawQuery);
      if (!q) return { users: [], categories: [], posts: [], companies: [], total: 0 };

      // 1. الأقسام والخدمات
      const categories = this.getCategoriesList().filter((c) => {
        const grpName = window.DamanCatAds && DamanCatAds.getGroupMeta && DamanCatAds.resolveCatGroup
          ? DamanCatAds.getGroupMeta(DamanCatAds.resolveCatGroup(c)).ar
          : '';
        return this.norm(`${c.ar} ${c.en || ''} ${grpName}`).includes(q);
      });

      // 2. الأشخاص والمقاولين والصنايعية
      const users = this.usersCache.filter((u) => {
        const hay = `${u.name || ''} ${u.legalName || ''} ${u.companyName || ''} ${u.specialty || ''} ${u.jobTitle || ''} ${u.city || ''} ${u.bio || ''} ${u.phone || ''}`;
        return this.norm(hay).includes(q);
      });

      // 3. إعلانات ومشاريع وتوريدات السوق (من كل الأقسام بدون تقييد)
      const myUid = app.user?.uid;
      const allPosts = (window.DamanProjects && typeof DamanProjects.getAllMarketPosts === 'function')
        ? DamanProjects.getAllMarketPosts(app)
        : [];
      const posts = allPosts.filter((p) => {
        const isOwn = !p.isDemo && myUid && p.ownerId === myUid;
        if (p.status !== 'approved' && !isOwn && !app.hasAdminAccess()) return false;
        const hay = `${p.title || ''} ${p.description || ''} ${p.city || ''} ${p.ownerName || ''} ${this.getCategoryLabel(p.category)}`;
        return this.norm(hay).includes(q);
      });

      // 4. الشركات المسجّلة
      const companies = this.companiesCache.filter((c) => {
        const hay = `${c.name || ''} ${c.code || ''} ${c.ownerName || ''}`;
        return this.norm(hay).includes(q);
      });

      return {
        users,
        categories,
        posts,
        companies,
        total: users.length + categories.length + posts.length + companies.length
      };
    },

    // ==================== ACTIONS FROM RESULTS ====================
    closeModal() {
      document.getElementById('daman-global-search-modal')?.classList.add('hidden');
    },

    openPerson(uid) {
      this.closeModal();
      if (window.DamanApp && typeof DamanApp.openPublicProfile === 'function') {
        DamanApp.openPublicProfile(uid);
      }
    },

    chatPerson(uid) {
      const u = this.usersCache.find((x) => x.id === uid);
      const name = (u && (u.companyName || u.name)) || 'مستخدم';
      this.closeModal();
      if (window.DamanChat && typeof DamanChat.openDirectChat === 'function') {
        DamanChat.openDirectChat(uid, name);
      }
    },

    openCategory(catId) {
      this.closeModal();
      if (window.DamanProjects) DamanProjects.searchQuery = '';
      if (window.DamanCatAds && typeof DamanCatAds.openFromHomeToCat === 'function') {
        DamanCatAds.openFromHomeToCat(catId);
      } else if (window.DamanApp && typeof DamanApp.openCategoryFromHome === 'function') {
        DamanApp.openCategoryFromHome(catId);
      }
    },

    openAd(pid) {
      this.closeModal();
      if (window.DamanProjects && typeof DamanProjects.openPostDetails === 'function') {
        DamanProjects.openPostDetails(pid);
      }
    },

    openCompany(compId) {
      const c = this.companiesCache.find((x) => x.id === compId);
      if (!c) return;
      this.closeModal();
      if (c.ownerId && window.DamanApp && typeof DamanApp.openPublicProfile === 'function') {
        DamanApp.openPublicProfile(c.ownerId);
      }
    },

    // ==================== UNIVERSAL SEARCH MODAL ====================
    async openModal(initialQuery = '') {
      const app = window.DamanApp;
      if (!app) return;
      if (typeof initialQuery === 'string' && initialQuery.trim()) {
        this.query = initialQuery.trim();
      }
      this.filterTab = 'all';

      let m = document.getElementById('daman-global-search-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-global-search-modal';
        m.className = 'daman-modal fixed inset-0 z-[95] bg-black/92 backdrop-blur-md flex items-start justify-center p-2.5 pt-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'globalSearch' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-3.5 max-h-[90vh] flex flex-col gap-2.5 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-magnifying-glass me-1"></i> البحث الشامل في ضمان سايت</h3>
            <button type="button" onclick="DamanSearch.closeModal()" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form onsubmit="DamanSearch.onModalSubmit(event)" class="flex items-center gap-1.5">
            <div class="relative flex-1">
              <input id="daman-gs-input" type="search" value="${app.esc(this.query)}" oninput="DamanSearch.onModalInput(this.value)" placeholder="ابحث عن شخص، مقاول، قسم، إعلان، أو شركة..." class="w-full ps-3 pe-8 py-2.5 rounded-xl bg-slate-950 border border-amber-500/50 text-xs text-white font-bold focus:outline-none focus:border-amber-400" autocomplete="off" />
              <button type="button" id="daman-gs-clear" onclick="DamanSearch.clearModalInput()" class="${this.query ? '' : 'hidden'} absolute top-2 end-2 w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-[10px]">×</button>
            </div>
            <button type="submit" class="px-3.5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shrink-0"><i class="fa-solid fa-magnifying-glass me-1"></i> بحث</button>
          </form>

          <div id="daman-gs-tabs" class="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10.5px] font-black"></div>

          <div id="daman-gs-results" class="flex-1 overflow-y-auto space-y-2.5 pe-0.5">
            <div class="text-center py-8 text-amber-300 font-bold animate-pulse">جارٍ تجهيز دليل الأشخاص والأقسام والإعلانات...</div>
          </div>
        </div>`;

      setTimeout(() => {
        const inp = document.getElementById('daman-gs-input');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }, 60);

      await this.ensureDirectory();
      this.renderModalResults();
    },

    onModalSubmit(e) {
      e.preventDefault();
      const val = document.getElementById('daman-gs-input')?.value || '';
      this.query = val.trim();
      this.renderModalResults();
    },

    onModalInput(val) {
      this.query = val || '';
      const clr = document.getElementById('daman-gs-clear');
      if (clr) clr.classList.toggle('hidden', !this.query.trim());
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.renderModalResults(), 150);
    },

    clearModalInput() {
      this.query = '';
      const inp = document.getElementById('daman-gs-input');
      if (inp) { inp.value = ''; inp.focus(); }
      document.getElementById('daman-gs-clear')?.classList.add('hidden');
      this.renderModalResults();
    },

    setFilterTab(t) {
      this.filterTab = t;
      this.renderModalResults();
    },

    accountTypeAr(t) {
      return { company: '🏢 شركة', supplier: '🚚 مورّد B2B', individual: '👷 مقاول / فني' }[t] || '👤 عضو';
    },

    renderModalResults() {
      const app = window.DamanApp;
      const tabsEl = document.getElementById('daman-gs-tabs');
      const resEl = document.getElementById('daman-gs-results');
      if (!tabsEl || !resEl) return;

      const qTrim = String(this.query || '').trim();
      if (!qTrim) {
        tabsEl.innerHTML = '';
        const popularCats = this.getCategoriesList().slice(0, 8);
        const topUsers = this.usersCache.filter((u) => u.kycStatus === 'verified').slice(0, 4);
        resEl.innerHTML = `
          <div class="space-y-3">
            <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              💡 اكتب <b>اسم شخص أو مقاول</b>، أو <b>اسم قسم</b> (مثل: أمن، نظافة، برمجة، محاسبة، إنشاءات، سباكة)، أو <b>اسم مدينة</b>، أو <b>اسم شركة</b>.
            </div>
            ${popularCats.length ? `
              <div class="space-y-1.5">
                <div class="font-black text-amber-400 text-[11px]">🗂️ أقسام سريعة</div>
                <div class="flex flex-wrap gap-1.5">
                  ${popularCats.map((c) => `<button type="button" onclick="DamanSearch.openCategory('${app.esc(c.id)}')" class="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400 text-slate-200 font-bold text-[10.5px]">${app.esc(c.icon || '📌')} ${app.esc(c.ar)}</button>`).join('')}
                </div>
              </div>` : ''}
            ${topUsers.length ? `
              <div class="space-y-1.5">
                <div class="font-black text-emerald-400 text-[11px]">👤 أعضاء موثّقين</div>
                ${topUsers.map((u) => this.renderPersonRow(u, app)).join('')}
              </div>` : ''}
          </div>`;
        return;
      }

      const r = this.searchAll(qTrim);
      const tabDefs = [
        ['all', `الكل (${r.total})`],
        ['users', `👤 أشخاص (${r.users.length})`],
        ['categories', `🗂️ أقسام (${r.categories.length})`],
        ['posts', `📢 إعلانات (${r.posts.length})`],
        ['companies', `🏢 شركات (${r.companies.length})`]
      ];
      tabsEl.innerHTML = tabDefs.map(([k, lbl]) => `
        <button type="button" onclick="DamanSearch.setFilterTab('${k}')" class="shrink-0 px-2.5 py-1.5 rounded-xl border ${this.filterTab === k ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-800 text-slate-300'}">${lbl}</button>`).join('');

      if (!r.total) {
        resEl.innerHTML = `
          <div class="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
            <i class="fa-solid fa-magnifying-glass text-2xl text-slate-600"></i>
            <div class="font-black text-slate-300">مفيش نتائج مطابقة لـ «${app.esc(qTrim)}»</div>
            <div class="text-[10.5px] text-slate-500">جرّب كتابة جزء من الاسم أو اسم قسم أو مدينة تانية.</div>
          </div>`;
        return;
      }

      const blocks = [];
      const showAll = this.filterTab === 'all';

      if ((showAll || this.filterTab === 'categories') && r.categories.length) {
        blocks.push(`
          <div class="space-y-1.5">
            <div class="font-black text-amber-400 text-[11px]">🗂️ الأقسام المطابقة (${r.categories.length})</div>
            <div class="grid grid-cols-2 gap-1.5">
              ${(showAll ? r.categories.slice(0, 6) : r.categories).map((c) => `
                <button type="button" onclick="DamanSearch.openCategory('${app.esc(c.id)}')" class="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 hover:border-amber-400 text-start flex items-center gap-2">
                  <span class="text-base shrink-0">${app.esc(c.icon || '📌')}</span>
                  <span class="text-[11px] font-black text-white leading-tight line-clamp-2">${app.esc(c.ar)}</span>
                </button>`).join('')}
            </div>
          </div>`);
      }

      if ((showAll || this.filterTab === 'users') && r.users.length) {
        blocks.push(`
          <div class="space-y-1.5">
            <div class="font-black text-emerald-400 text-[11px]">👤 الأشخاص والمقاولين (${r.users.length})</div>
            ${(showAll ? r.users.slice(0, 6) : r.users.slice(0, 30)).map((u) => this.renderPersonRow(u, app)).join('')}
          </div>`);
      }

      if ((showAll || this.filterTab === 'posts') && r.posts.length) {
        blocks.push(`
          <div class="space-y-1.5">
            <div class="font-black text-sky-400 text-[11px]">📢 إعلانات ومشاريع السوق (${r.posts.length})</div>
            ${(showAll ? r.posts.slice(0, 6) : r.posts.slice(0, 30)).map((p) => `
              <div onclick="DamanSearch.openAd('${app.esc(p.id)}')" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-400 cursor-pointer space-y-1">
                <div class="font-black text-white text-[11px] leading-snug">${app.esc(p.title)}</div>
                <div class="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                  <span class="truncate">${app.esc(this.getCategoryLabel(p.category))} • ${app.esc(p.city || '')}</span>
                  ${p.budget ? `<b class="text-emerald-400 shrink-0">${app.fmtMoney(p.budget)} ج.م</b>` : ''}
                </div>
              </div>`).join('')}
          </div>`);
      }

      if ((showAll || this.filterTab === 'companies') && r.companies.length) {
        blocks.push(`
          <div class="space-y-1.5">
            <div class="font-black text-purple-300 text-[11px]">🏢 الشركات (${r.companies.length})</div>
            ${(showAll ? r.companies.slice(0, 5) : r.companies.slice(0, 20)).map((c) => `
              <div onclick="DamanSearch.openCompany('${app.esc(c.id)}')" class="p-2.5 rounded-xl bg-slate-950 border border-purple-500/40 cursor-pointer flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-black text-white truncate">🏢 ${app.esc(c.name)}</div>
                  <div class="text-[10px] text-amber-300">الكود: ${app.esc(c.code || '—')} • ${app.esc(c.ownerName || '')}</div>
                </div>
                <span class="px-2 py-1 rounded-lg bg-purple-600/30 text-purple-200 text-[10px] font-black shrink-0">عرض</span>
              </div>`).join('')}
          </div>`);
      }

      resEl.innerHTML = blocks.join('');
    },

    renderPersonRow(u, app) {
      const dispName = u.companyName || u.name || 'مستخدم';
      const sub = [this.accountTypeAr(u.accountType), u.specialty || u.jobTitle || '', u.city || ''].filter(Boolean).join(' • ');
      const isMe = app.user && app.user.uid === u.id;
      return `
        <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-2">
          <div onclick="DamanSearch.openPerson('${app.esc(u.id)}')" class="min-w-0 flex-1 cursor-pointer">
            <div class="font-black text-white truncate text-[11.5px]">${app.esc(dispName)} ${u.kycStatus === 'verified' ? '<i class="fa-solid fa-circle-check text-emerald-400 ms-0.5 text-[10px]"></i>' : ''}</div>
            <div class="text-[10px] text-slate-400 truncate">${app.esc(sub)}</div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" onclick="DamanSearch.openPerson('${app.esc(u.id)}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">الملف</button>
            ${!isMe ? `<button type="button" onclick="DamanSearch.chatPerson('${app.esc(u.id)}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">مراسلة</button>` : ''}
          </div>
        </div>`;
    },

    // ==================== 1. HEADER SEARCH BUTTON & HOME SEARCH BAR ====================
    injectHeaderButton() {
      if (document.getElementById('daman-global-search-btn')) return;
      const notifBtn = document.getElementById('daman-notif-btn');
      if (!notifBtn || !notifBtn.parentNode) return;
      const btn = document.createElement('button');
      btn.id = 'daman-global-search-btn';
      btn.type = 'button';
      btn.title = 'بحث شامل (أشخاص، أقسام، إعلانات، شركات)';
      btn.className = 'w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-400 hover:bg-amber-500 hover:text-slate-950 flex items-center justify-center transition';
      btn.innerHTML = '<i class="fa-solid fa-magnifying-glass text-sm"></i>';
      btn.onclick = () => this.openModal('');
      notifBtn.parentNode.insertBefore(btn, notifBtn);
    },

    submitHomeSearch(e) {
      e.preventDefault();
      const val = (document.getElementById('daman-home-gs-inp')?.value || '').trim();
      this.openModal(val);
    },

    injectHomeSearchBar(container, app) {
      if (document.getElementById('daman-home-gs-wrap')) return;
      const root = container.firstElementChild;
      if (!root) return;
      const wrap = document.createElement('form');
      wrap.id = 'daman-home-gs-wrap';
      wrap.onsubmit = (e) => this.submitHomeSearch(e);
      wrap.className = 'flex items-center gap-1.5';
      wrap.innerHTML = `
        <div class="relative flex-1">
          <i class="fa-solid fa-magnifying-glass absolute top-3 start-3 text-amber-400 text-xs"></i>
          <input id="daman-home-gs-inp" type="search" placeholder="ابحث عن شخص، مقاول، قسم، إعلان، أو شركة..." class="w-full ps-8 pe-3 py-2.5 rounded-2xl bg-slate-900 border border-amber-500/40 text-xs text-white font-bold placeholder:text-slate-400" />
        </div>
        <button type="submit" class="px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs shrink-0 shadow-lg shadow-amber-500/20">بحث</button>`;
      root.insertBefore(wrap, root.firstElementChild);
    },

    // ==================== 2. FIX MARKET TOP SEARCH BAR (SEPARATE REAL SEARCH FROM POST AD!) ====================
    submitMarketSearch(e) {
      e.preventDefault();
      const val = (document.getElementById('daman-mkt-gs-inp')?.value || '').trim();
      if (window.DamanProjects) DamanProjects.onSearchInput(val);
      this.openModal(val);
    },

    onMarketLiveInput(val) {
      const q = val || '';
      document.getElementById('daman-mkt-gs-clr')?.classList.toggle('hidden', !q.trim());
      if (window.DamanProjects) {
        // عند البحث نفتح البحث على كل الأقسام عشان ميحصرش النتيجة في قسم واحد
        if (q.trim() && DamanProjects.selectedCategory && DamanProjects.selectedCategory !== 'all') {
          DamanProjects.selectedCategory = 'all';
        }
        DamanProjects.onSearchInput(q);
      }
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(async () => {
        if (q.trim()) await this.ensureDirectory();
        this.renderMarketQuickHits(q);
      }, 180);
    },

    clearMarketSearch() {
      const inp = document.getElementById('daman-mkt-gs-inp');
      if (inp) { inp.value = ''; inp.focus(); }
      document.getElementById('daman-mkt-gs-clr')?.classList.add('hidden');
      if (window.DamanProjects) DamanProjects.onSearchInput('');
      this.renderMarketQuickHits('');
    },

    renderMarketQuickHits(rawQuery) {
      const slot = document.getElementById('daman-mkt-universal-hits');
      if (!slot) return;
      const q = String(rawQuery || '').trim();
      if (!q) { slot.innerHTML = ''; slot.classList.add('hidden'); return; }

      const app = window.DamanApp;
      const r = this.searchAll(q);
      if (!r.users.length && !r.categories.length && !r.companies.length) {
        slot.innerHTML = '';
        slot.classList.add('hidden');
        return;
      }

      slot.classList.remove('hidden');
      slot.innerHTML = `
        <div class="glass-card rounded-2xl p-3 border-sky-500/40 space-y-2.5 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="font-black text-sky-300 text-[11px]">🔎 نتائج فورية (أشخاص / أقسام / شركات)</span>
            <button type="button" onclick="DamanSearch.openModal(document.getElementById('daman-mkt-gs-inp')?.value || '')" class="text-[10px] font-black text-amber-300 underline">عرض كل النتائج (${r.total})</button>
          </div>

          ${r.categories.length ? `
            <div class="flex flex-wrap gap-1.5">
              ${r.categories.slice(0, 5).map((c) => `
                <button type="button" onclick="DamanSearch.openCategory('${app.esc(c.id)}')" class="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-200 font-black text-[10.5px]">
                  ${app.esc(c.icon || '📌')} قسم: ${app.esc(c.ar)}
                </button>`).join('')}
            </div>` : ''}

          ${r.users.length ? `
            <div class="space-y-1.5">
              ${r.users.slice(0, 4).map((u) => this.renderPersonRow(u, app)).join('')}
            </div>` : ''}

          ${r.companies.length ? `
            <div class="flex flex-wrap gap-1.5">
              ${r.companies.slice(0, 3).map((c) => `
                <button type="button" onclick="DamanSearch.openCompany('${app.esc(c.id)}')" class="px-2.5 py-1 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 font-bold text-[10.5px]">
                  🏢 ${app.esc(c.name)} (${app.esc(c.code || '')})
                </button>`).join('')}
            </div>` : ''}
        </div>`;
    },

    enhanceMarketSearchBar(container, app) {
      if (!window.DamanProjects || DamanProjects.subTab !== 'market') return;
      const oldInput = container.querySelector('input[oninput*="DamanProjects.onSearchInput"]');
      if (!oldInput) return;
      const oldRow = oldInput.parentNode;
      if (!oldRow || oldRow.dataset.searchFixed) return;
      oldRow.dataset.searchFixed = '1';

      const curVal = DamanProjects.searchQuery || '';
      const box = document.createElement('div');
      box.className = 'space-y-2';
      box.innerHTML = `
        <form onsubmit="DamanSearch.submitMarketSearch(event)" class="flex items-center gap-1.5">
          <div class="relative flex-1">
            <i class="fa-solid fa-magnifying-glass absolute top-3 start-3 text-amber-400 text-xs"></i>
            <input id="daman-mkt-gs-inp" type="search" value="${app.esc(curVal)}" oninput="DamanSearch.onMarketLiveInput(this.value)" placeholder="ابحث عن شخص، اسم، قسم، مدينة، أو إعلان..." class="w-full ps-8 pe-8 py-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-xs text-white font-bold" />
            <button type="button" id="daman-mkt-gs-clr" onclick="DamanSearch.clearMarketSearch()" class="${curVal ? '' : 'hidden'} absolute top-2 end-2 w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-[10px]">×</button>
          </div>
          <button type="submit" class="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shrink-0"><i class="fa-solid fa-magnifying-glass me-1"></i> بحث</button>
        </form>
        <div id="daman-mkt-universal-hits" class="hidden"></div>
        <button type="button" onclick="DamanProjects.openPostModal()" class="w-full py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-black text-[11px] flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-plus-circle"></i> نشر إعلان / مشروع / عرض توريد جديد
        </button>`;

      oldRow.parentNode.replaceChild(box, oldRow);
      if (curVal.trim()) this.renderMarketQuickHits(curVal);
    },

    // ==================== BOOT & HOOKS ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.injectHeaderButton();

      if (typeof app.renderHomeTab === 'function' && !app._gsHomeHooked) {
        app._gsHomeHooked = true;
        const origHome = app.renderHomeTab.bind(app);
        app.renderHomeTab = (container) => {
          origHome(container);
          try { this.injectHomeSearchBar(container, app); } catch (e) {}
        };
      }

      if (window.DamanProjects && !DamanProjects._gsMktHooked) {
        DamanProjects._gsMktHooked = true;
        const origRender = DamanProjects.render.bind(DamanProjects);
        DamanProjects.render = (container, a) => {
          origRender(container, a);
          try { this.enhanceMarketSearchBar(container, a); } catch (e) {}
        };
      }

      if (['home', 'projects'].includes(app.activeTab)) {
        app.renderCurrentTab();
      }
    }
  };

  window.DamanSearch = GlobalSearch;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => GlobalSearch.boot(), 320));
  else setTimeout(() => GlobalSearch.boot(), 320);
})();
