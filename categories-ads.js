(function () {
  const DEFAULT_CATEGORIES = [
    { id: 'concrete', ar: 'خرسانات وشدات خشبية ومعدنية', en: 'Concrete & Formwork', icon: '🏗️', color: 'amber', active: true },
    { id: 'steel', ar: 'حدادة مسلحة', en: 'Rebar & Steel', icon: '🔩', color: 'slate', active: true },
    { id: 'masonry', ar: 'مباني وطوب', en: 'Masonry & Bricks', icon: '🧱', color: 'rose', active: true },
    { id: 'plaster', ar: 'محارة وبياض', en: 'Plastering', icon: '🪣', color: 'amber', active: true },
    { id: 'plumbing', ar: 'سباكة وتأسيس صحي', en: 'Plumbing', icon: '🚰', color: 'sky', active: true },
    { id: 'electrical', ar: 'كهرباء وتأسيس سمارت', en: 'Electrical & Smart', icon: '⚡', color: 'amber', active: true },
    { id: 'ceramic', ar: 'سيراميك وبورسلين ورخام', en: 'Ceramics & Marble', icon: '⬜', color: 'emerald', active: true },
    { id: 'gypsum', ar: 'جبسمبورد وديكورات أسقف', en: 'Gypsum Board', icon: '✨', color: 'purple', active: true },
    { id: 'painting', ar: 'نقاشة ودهانات', en: 'Painting', icon: '🎨', color: 'rose', active: true },
    { id: 'carpentry', ar: 'نجارة باب وشباك وأثاث', en: 'Carpentry', icon: '🪵', color: 'amber', active: true },
    { id: 'aluminum', ar: 'ألوميتال وواجهات زجاج', en: 'Aluminum & Glass', icon: '🪟', color: 'sky', active: true },
    { id: 'insulation', ar: 'عزل مائي وحراري', en: 'Waterproofing & Insulation', icon: '🛡️', color: 'emerald', active: true },
    { id: 'hvac', ar: 'تكييف وتبريد وتهوية', en: 'HVAC', icon: '❄️', color: 'sky', active: true },
    { id: 'landscape', ar: 'لاندسكيب وحمامات سباحة', en: 'Landscape & Pools', icon: '🌴', color: 'emerald', active: true },
    { id: 'materials', ar: 'توريد خامات ومواد بناء B2B', en: 'B2B Building Materials', icon: '🚚', color: 'amber', active: true },
    { id: 'equipment', ar: 'تأجير معدات وشدات وأوناش', en: 'Equipment Rental', icon: '🚜', color: 'purple', active: true },
    { id: 'general', ar: 'مقاولات عامة وتشطيب كامل', en: 'General Contracting', icon: '🏢', color: 'emerald', active: true }
  ];

  const CatAds = {
    allCategories: DEFAULT_CATEGORIES.map((c) => Object.assign({}, c)),
    categoryAds: [],
    showGridInMarket: false,
    tempAdImage: '',
    unsubDoc: null,
    _booted: false,

    hBtn(id) {
      return `<button type="button" onclick="window.DamanToggleHelp && window.DamanToggleHelp('${id}')" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/25 border border-sky-400/70 text-sky-300 text-[9.5px] font-black ms-1 align-middle" title="شرح الخانة">؟</button>`;
    },

    hBox(id, text) {
      return `<div id="fh-${id}" class="hidden mt-1 mb-1.5 p-2.5 rounded-xl bg-sky-950/95 border border-sky-400/60 text-[11px] text-sky-100 leading-relaxed font-semibold shadow-lg">💡 ${text}</div>`;
    },

    themeBox(theme) {
      return {
        amber: { card: 'from-amber-950/85 via-slate-900 to-slate-950 border-amber-500/60', badge: 'bg-amber-500 text-slate-950', btn: 'bg-amber-500 text-slate-950' },
        emerald: { card: 'from-emerald-950/85 via-slate-900 to-slate-950 border-emerald-500/60', badge: 'bg-emerald-500 text-slate-950', btn: 'bg-emerald-500 text-slate-950' },
        purple: { card: 'from-purple-950/85 via-slate-900 to-slate-950 border-purple-500/60', badge: 'bg-purple-500 text-white', btn: 'bg-purple-500 text-white' },
        sky: { card: 'from-sky-950/85 via-slate-900 to-slate-950 border-sky-500/60', badge: 'bg-sky-500 text-slate-950', btn: 'bg-sky-500 text-slate-950' },
        rose: { card: 'from-rose-950/85 via-slate-900 to-slate-950 border-rose-500/60', badge: 'bg-rose-500 text-white', btn: 'bg-rose-500 text-white' }
      }[theme] || { card: 'from-amber-950/85 via-slate-900 to-slate-950 border-amber-500/60', badge: 'bg-amber-500 text-slate-950', btn: 'bg-amber-500 text-slate-950' };
    },

    getActiveCategories() {
      return this.allCategories.filter((c) => c.active !== false);
    },

    getCatById(id) {
      return this.allCategories.find((c) => c.id === id) || null;
    },

    getCatName(id) {
      if (id === 'all') return 'كل الأقسام';
      const c = this.getCatById(id);
      return c ? `${c.icon || '📌'} ${c.ar}` : (id || 'عام');
    },

    getAdsForCategory(catId) {
      const now = Date.now();
      return this.categoryAds.filter((ad) => {
        if (ad.active === false) return false;
        if (ad.expiresAt && Number(ad.expiresAt) > 0 && Number(ad.expiresAt) < now) return false;
        if (catId === 'all') return true;
        return ad.categoryId === catId || ad.categoryId === 'all';
      });
    },

    countPostsByCategory(app) {
      const counts = { all: 0 };
      if (!window.DamanProjects || typeof DamanProjects.getAllMarketPosts !== 'function') return counts;
      const myUid = app.user?.uid;
      const posts = DamanProjects.getAllMarketPosts(app).filter((p) => {
        const isOwn = !p.isDemo && myUid && p.ownerId === myUid;
        return p.status === 'approved' || isOwn || app.hasAdminAccess();
      });
      counts.all = posts.length;
      posts.forEach((p) => {
        const k = p.category || 'general';
        counts[k] = (counts[k] || 0) + 1;
      });
      return counts;
    },

    syncGlobalCategories(app) {
      const active = this.getActiveCategories();
      if (app && Array.isArray(app.CATEGORIES)) {
        app.CATEGORIES.length = 0;
        active.forEach((c) => app.CATEGORIES.push({ id: c.id, ar: c.ar, en: c.en || c.ar, icon: c.icon || '📌' }));
      }
    },

    // ==================== ACTION TRIGGER FOR CATEGORY ADS ====================
    triggerCategoryAd(adId) {
      const app = window.DamanApp;
      const ad = this.categoryAds.find((x) => x.id === adId);
      if (!ad || !app) return;
      const type = ad.actionType || 'admin_chat';
      const val = String(ad.actionValue || '').trim();

      if (type === 'whatsapp') {
        const phone = (val || app.appConfig?.supportWhatsapp || '201030374787').replace(/[^\d]/g, '');
        const waNum = phone.startsWith('01') ? '2' + phone : phone;
        return window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(`مرحباً، أستفسر عن إعلان القسم: ${ad.title}`)}`, '_blank');
      }
      if (type === 'url' && val) {
        const url = /^https?:\/\//i.test(val) ? val : 'https://' + val;
        return window.open(url, '_blank', 'noopener,noreferrer');
      }
      if (type === 'inspection' || type === 'viplabor' || type === 'company' || type === 'wallet') {
        return app.handleBannerAction(type);
      }
      if (type === 'user_chat' && val && window.DamanChat) {
        return DamanChat.openDirectChat(val, ad.advertiserName || ad.title, '', `استفسار عن إعلان: ${ad.title}`);
      }
      if (window.DamanChat) {
        return DamanChat.openDirectChat('admin', 'إدارة ضمان سايت', '', `استفسار عن إعلان القسم: ${ad.title}`);
      }
      app.switchTab('chat');
    },

    // ==================== RENDER CATEGORY ADS BANNER SLOT ====================
    renderCategoryAdsBlock(catId, app) {
      const ads = this.getAdsForCategory(catId);
      if (!ads.length) return '';

      return `
        <div class="space-y-2">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-black text-amber-400">
              <i class="fa-solid fa-bullhorn me-1"></i> ${catId === 'all' ? 'إعلانات الأقسام المميزة' : `إعلانات قسم: ${app.esc(this.getCatName(catId))}`} (${ads.length})
            </span>
            ${app.isAdmin() ? `<button type="button" onclick="DamanCatAds.openAdminCategoriesTab()" class="text-[10px] font-black text-purple-300 underline">+ إدارة</button>` : ''}
          </div>
          <div class="${ads.length > 1 ? 'flex gap-2.5 overflow-x-auto pb-1.5 snap-x snap-mandatory' : ''}">
            ${ads.map((ad) => {
              const st = this.themeBox(ad.theme);
              return `
                <div class="${ads.length > 1 ? 'snap-start shrink-0 w-[88%] sm:w-[75%]' : 'w-full'} rounded-2xl p-3.5 bg-gradient-to-br ${st.card} border space-y-2 shadow-lg">
                  <div class="flex items-center justify-between gap-2">
                    <span class="px-2 py-0.5 rounded-lg ${st.badge} text-[9.5px] font-black">${app.esc(ad.badge || '★ إعلان القسم')}</span>
                    <span class="text-[9.5px] text-slate-300 font-bold">${app.esc(this.getCatName(ad.categoryId))}</span>
                  </div>
                  ${ad.imageBase64 ? `<img src="${ad.imageBase64}" onclick="DamanApp.openMediaLightbox('${ad.mediaId || ad.imageBase64}','${app.esc(ad.title).replace(/'/g, "\\'")}')" class="w-full h-32 object-cover rounded-xl border border-slate-700 cursor-pointer" />` : ''}
                  <div class="space-y-1">
                    <div class="text-xs font-black text-white leading-snug">${app.esc(ad.title)}</div>
                    ${ad.subtitle ? `<p class="text-[11px] text-slate-300 leading-relaxed">${app.esc(ad.subtitle)}</p>` : ''}
                  </div>
                  <div class="flex items-center justify-between gap-2 pt-1">
                    ${ad.priceText ? `<b class="text-xs text-emerald-400">${app.esc(ad.priceText)}</b>` : '<span></span>'}
                    <button type="button" onclick="DamanCatAds.triggerCategoryAd('${app.esc(ad.id)}')" class="px-3.5 py-2 rounded-xl ${st.btn} font-black text-[11px] shrink-0">
                      ${app.esc(ad.ctaText || 'تواصل الآن')} <i class="fa-solid fa-arrow-left ms-1 text-[9.5px]"></i>
                    </button>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    },

    // ==================== MARKET INTERACTIVE CATEGORIES BAR & GRID ====================
    toggleMarketGrid() {
      this.showGridInMarket = !this.showGridInMarket;
      if (window.DamanProjects) DamanProjects.rerender();
    },

    selectMarketCat(catId) {
      this.showGridInMarket = false;
      if (window.DamanProjects) DamanProjects.setCategory(catId);
    },

    enhanceMarketDOM(container, app) {
      if (!window.DamanProjects || DamanProjects.subTab !== 'market') return;
      const listSlot = document.getElementById('daman-market-list-slot');
      if (!listSlot) return;

      const oldSel = container.querySelector('select[onchange*="DamanProjects.setCategory"]');
      if (oldSel) oldSel.classList.add('hidden');

      let catWrap = document.getElementById('daman-cats-enhanced-wrap');
      if (!catWrap) {
        catWrap = document.createElement('div');
        catWrap.id = 'daman-cats-enhanced-wrap';
        catWrap.className = 'space-y-2.5';
        listSlot.parentNode.insertBefore(catWrap, listSlot);
      }

      const activeCats = this.getActiveCategories();
      const selCat = DamanProjects.selectedCategory || 'all';
      const counts = this.countPostsByCategory(app);

      const catPills = `
        <div class="space-y-2">
          <div class="flex items-center justify-between px-0.5">
            <span class="text-[11px] font-black text-slate-200"><i class="fa-solid fa-layer-group text-amber-400 me-1"></i> أقسام السوق (${activeCats.length} قسم)</span>
            <button type="button" onclick="DamanCatAds.toggleMarketGrid()" class="px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 text-[10px] font-black">
              ${this.showGridInMarket ? 'إغلاق الشبكة ×' : '⊞ عرض كل الأقسام'}
            </button>
          </div>
          ${this.showGridInMarket ? `
            <div class="grid grid-cols-2 gap-1.5">
              <button type="button" onclick="DamanCatAds.selectMarketCat('all')" class="p-2.5 rounded-xl border text-start flex items-center justify-between gap-1 ${selCat === 'all' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-900 border-slate-800 text-slate-200 font-bold'} text-[10.5px]">
                <span>🌐 كل الأقسام</span><span class="px-1.5 py-0.5 rounded bg-black/20 text-[9.5px]">${counts.all || 0}</span>
              </button>
              ${activeCats.map((c) => {
                const hasAd = this.getAdsForCategory(c.id).some((a) => a.categoryId === c.id);
                return `
                  <button type="button" onclick="DamanCatAds.selectMarketCat('${app.esc(c.id)}')" class="p-2.5 rounded-xl border text-start flex items-center justify-between gap-1 ${selCat === c.id ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-900 border-slate-800 text-slate-200 font-bold'} text-[10.5px]">
                    <span class="truncate">${app.esc(c.icon || '📌')} ${app.esc(c.ar)} ${hasAd ? '🔥' : ''}</span>
                    <span class="px-1.5 py-0.5 rounded bg-black/20 text-[9.5px] shrink-0">${counts[c.id] || 0}</span>
                  </button>`;
              }).join('')}
            </div>` : `
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
              <button type="button" onclick="DamanCatAds.selectMarketCat('all')" class="shrink-0 px-3 py-1.5 rounded-xl border ${selCat === 'all' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-800 text-slate-300'}">
                🌐 الكل (${counts.all || 0})
              </button>
              ${activeCats.map((c) => {
                const hasAd = this.getAdsForCategory(c.id).some((a) => a.categoryId === c.id);
                return `
                  <button type="button" onclick="DamanCatAds.selectMarketCat('${app.esc(c.id)}')" class="shrink-0 px-3 py-1.5 rounded-xl border ${selCat === c.id ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 border-slate-800 text-slate-300'}">
                    ${app.esc(c.icon || '📌')} ${app.esc(c.ar)} (${counts[c.id] || 0})${hasAd ? ' ★' : ''}
                  </button>`;
              }).join('')}
            </div>`}
        </div>`;

      catWrap.innerHTML = catPills + this.renderCategoryAdsBlock(selCat, app);
    },

    enhanceHomeDOM(container, app) {
      const catBtns = container.querySelectorAll('button[onclick^="DamanApp.openCategoryFromHome"]');
      if (!catBtns.length) return;
      const strip = catBtns[0].parentNode;
      if (!strip || strip.dataset.catEnhanced) return;
      strip.dataset.catEnhanced = '1';

      const activeCats = this.getActiveCategories();
      const counts = this.countPostsByCategory(app);
      strip.innerHTML = activeCats.map((c) => {
        const hasAd = this.getAdsForCategory(c.id).some((a) => a.categoryId === c.id);
        return `
          <button onclick="DamanApp.openCategoryFromHome('${app.esc(c.id)}')" class="shrink-0 px-3 py-2 rounded-xl bg-slate-900 border ${hasAd ? 'border-amber-500/60' : 'border-slate-800'} hover:border-amber-500 text-[10.5px] font-bold text-slate-200 flex items-center gap-1.5">
            <span>${app.esc(c.icon || '📌')} ${app.esc(c.ar)}</span>
            <span class="px-1.5 py-0.5 rounded-md bg-slate-950 text-amber-300 text-[9.5px] font-black">${counts[c.id] || 0}</span>
          </button>`;
      }).join('');

      const titleEl = strip.previousElementSibling;
      if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-layer-group text-amber-400 me-1"></i> تصفح السوق حسب القسم (${activeCats.length} قسم)`;
      }
    },

    // ==================== ADMIN PANEL: CATEGORIES & CATEGORY ADS MANAGER ====================
    openAdminCategoriesTab() {
      const app = window.DamanApp;
      if (!app || !app.isAdmin()) return;
      if (window.DamanAdmin) DamanAdmin._viewingCategoriesTab = true;
      app.switchTab('admin');
      if (window.DamanAdmin) DamanAdmin.rerender();
    },

    async persistConfig() {
      const app = window.DamanApp;
      if (!app || !app.isAdmin()) return;
      await app.db.collection('settings').doc('categoriesConfig').set({
        categories: this.allCategories,
        categoryAds: this.categoryAds,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    },

    openCategoryEditorModal(editId = '') {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const ex = editId ? this.allCategories.find((c) => c.id === editId) : null;

      let m = document.getElementById('daman-cat-ed-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-cat-ed-modal';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const icons = ['🏗️', '🔩', '🧱', '🪣', '🚰', '⚡', '⬜', '✨', '🎨', '🪵', '🪟', '🛡️', '❄️', '🌴', '🚚', '🚜', '🏢', '🚗', '☀️', '📐', '🧰', '🏠'];

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-2.5 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-black text-amber-400">${ex ? '✏️ تعديل القسم' : '+ إضافة قسم جديد للسوق'}</h3>
            <button onclick="document.getElementById('daman-cat-ed-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanCatAds.saveCategory(event,'${app.esc(editId)}')" class="space-y-2.5">
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">اسم القسم بالعربي * ${this.hBtn('ce-ar')}</label>
              ${this.hBox('ce-ar', 'اكتب اسم القسم الذي سيظهر للمستخدمين في السوق والصفحة الرئيسية وقائمة نشر الإعلانات (مثال: نقل وسيارات مواقع، أو طاقة شمسية).')}
              <input id="ce-ar" type="text" required value="${app.esc(ex?.ar || '')}" placeholder="مثال: نقل وسيارات مواقع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">الاسم بالإنجليزية (اختياري) ${this.hBtn('ce-en')}</label>
              ${this.hBox('ce-en', 'يظهر في حال تحويل المستخدم واجهة التطبيق إلى اللغة الإنجليزية.')}
              <input id="ce-en" type="text" value="${app.esc(ex?.en || '')}" placeholder="Vehicles & Transport" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div>
              <label class="block text-[10px] text-amber-300 mb-1">أيقونة القسم (إيموجي) * ${this.hBtn('ce-ic')}</label>
              ${this.hBox('ce-ic', 'اختر أيقونة من الأزرار أدناه أو اكتب أي إيموجي يعبر عن القسم.')}
              <input id="ce-icon" type="text" required value="${app.esc(ex?.icon || '📌')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white text-center text-base font-bold" />
              <div class="flex flex-wrap gap-1 pt-1.5">
                ${icons.map((ic) => `<button type="button" onclick="document.getElementById('ce-icon').value='${ic}'" class="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-400 text-sm">${ic}</button>`).join('')}
              </div>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ القسم وتطبيقه فوراً</button>
          </form>
        </div>`;
    },

    async saveCategory(e, editId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ar = document.getElementById('ce-ar').value.trim();
      const en = document.getElementById('ce-en').value.trim() || ar;
      const icon = document.getElementById('ce-icon').value.trim() || '📌';
      if (!ar) return;

      if (editId) {
        this.allCategories = this.allCategories.map((c) => (c.id === editId ? Object.assign({}, c, { ar, en, icon }) : c));
      } else {
        const id = 'cat_' + Date.now();
        this.allCategories.push({ id, ar, en, icon, color: 'amber', active: true });
      }
      await this.persistConfig();
      await app.logAudit('category_save', `${editId ? 'تعديل' : 'إضافة'} قسم: ${ar}`);
      document.getElementById('daman-cat-ed-modal').classList.add('hidden');
      app.toast('تم حفظ القسم وتحديث السوق فوراً ✅', 'success');
    },

    async moveCategoryOrder(idx, dir) {
      const target = idx + dir;
      if (target < 0 || target >= this.allCategories.length) return;
      const arr = [...this.allCategories];
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      this.allCategories = arr;
      await this.persistConfig();
    },

    async toggleCategoryActive(catId) {
      this.allCategories = this.allCategories.map((c) => (c.id === catId ? Object.assign({}, c, { active: c.active === false }) : c));
      await this.persistConfig();
      window.DamanApp.toast('تم تحديث حالة القسم ✅', 'info');
    },

    async deleteCategory(catId) {
      const c = this.getCatById(catId);
      if (!window.confirm(`حذف قسم «${c?.ar || catId}» نهائياً؟ (يمكنك إخفاؤه بدلاً من الحذف لو عليه إعلانات قديمة)`)) return;
      this.allCategories = this.allCategories.filter((x) => x.id !== catId);
      await this.persistConfig();
      window.DamanApp.toast('تم حذف القسم', 'info');
    },

    // ==================== ADMIN: CATEGORY ADS CRUD ====================
    openCategoryAdModal(editId = '') {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const ex = editId ? this.categoryAds.find((x) => x.id === editId) : null;
      this.tempAdImage = ex?.imageBase64 || '';

      let m = document.getElementById('daman-catad-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-catad-modal';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      const catOpts = `<option value="all" ${ex?.categoryId === 'all' ? 'selected' : ''}>🌐 كل الأقسام (يظهر في كل قسم)</option>` +
        this.allCategories.map((c) => `<option value="${app.esc(c.id)}" ${ex?.categoryId === c.id ? 'selected' : ''}>${app.esc(c.icon || '📌')} ${app.esc(c.ar)}</option>`).join('');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-2.5 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-black text-purple-300">${ex ? '✏️ تعديل إعلان القسم' : '+ إضافة إعلان مخصص لقسم'}</h3>
            <button onclick="document.getElementById('daman-catad-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form onsubmit="DamanCatAds.saveCategoryAd(event,'${app.esc(editId)}')" class="space-y-2.5">
            <div>
              <label class="block text-[10px] text-amber-300 font-bold mb-1">القسم الذي يظهر فيه الإعلان * ${this.hBtn('ca-cat')}</label>
              ${this.hBox('ca-cat', 'اختر القسم المحدد الذي تريد ظهور الإعلان في قمته، أو اختر «كل الأقسام» ليظهر كإعلان راعي في جميع الأقسام.')}
              <select id="ca-cat" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">${catOpts}</select>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-300 mb-1">الشارة (Badge) * ${this.hBtn('ca-bdg')}</label><input id="ca-badge" type="text" required value="${app.esc(ex?.badge || '🔥 عرض حصري')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-300 mb-1">لون البانر</label>
                <select id="ca-theme" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="amber" ${ex?.theme === 'amber' ? 'selected' : ''}>ذهبي</option>
                  <option value="emerald" ${ex?.theme === 'emerald' ? 'selected' : ''}>أخضر</option>
                  <option value="purple" ${ex?.theme === 'purple' ? 'selected' : ''}>بنفسجي</option>
                  <option value="sky" ${ex?.theme === 'sky' ? 'selected' : ''}>أزرق</option>
                  <option value="rose" ${ex?.theme === 'rose' ? 'selected' : ''}>أحمر</option>
                </select>
              </div>
            </div>
            ${this.hBox('ca-bdg', 'كلمة قصيرة ملفتة تظهر أعلى كارت الإعلان (مثال: 🔥 راعي القسم، أو ★ عرض خاص).')}

            <div>
              <label class="block text-[10px] text-slate-300 mb-1">عنوان الإعلان * ${this.hBtn('ca-ttl')}</label>
              ${this.hBox('ca-ttl', 'العنوان الرئيسي الكبير الذي يقرأه المستخدم فور دخوله القسم.')}
              <input id="ca-title" type="text" required value="${app.esc(ex?.title || '')}" placeholder="مثال: خصم 15% على توريد الشدات المعدنية هذا الأسبوع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div>
              <label class="block text-[10px] text-slate-300 mb-1">تفاصيل الإعلان ${this.hBtn('ca-sub')}</label>
              ${this.hBox('ca-sub', 'اشرح العرض أو الخدمة أو رقم التواصل أو المميزات في سطرين.')}
              <textarea id="ca-sub" rows="2" placeholder="تفاصيل العرض..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc(ex?.subtitle || '')}</textarea>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-emerald-300 mb-1">السعر / نص العرض (اختياري)</label><input id="ca-price" type="text" value="${app.esc(ex?.priceText || '')}" placeholder="مثال: يبدأ من 500 ج.م" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold" /></div>
              <div><label class="block text-[10px] text-slate-300 mb-1">المدة بالأيام (0 = دائم) ${this.hBtn('ca-dy')}</label><input id="ca-days" type="number" min="0" value="0" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-center" /></div>
            </div>
            ${this.hBox('ca-dy', 'لو كتبت 7 مثلاً سيختفي الإعلان تلقائياً بعد 7 أيام. ولو تركتها 0 يظل شغالاً حتى توقفه بنفسك.')}

            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-300 mb-1">نص الزرار *</label><input id="ca-cta" type="text" required value="${app.esc(ex?.ctaText || 'اطلب الآن')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div>
                <label class="block text-[10px] text-sky-300 mb-1">عند الضغط على الزرار ${this.hBtn('ca-act')}</label>
                <select id="ca-act" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-sky-300 font-bold">
                  <option value="whatsapp" ${ex?.actionType === 'whatsapp' ? 'selected' : ''}>واتساب مباشر</option>
                  <option value="admin_chat" ${ex?.actionType === 'admin_chat' ? 'selected' : ''}>شات الإدارة</option>
                  <option value="url" ${ex?.actionType === 'url' ? 'selected' : ''}>فتح رابط خارجي</option>
                  <option value="inspection" ${ex?.actionType === 'inspection' ? 'selected' : ''}>شاشة استلام 3x</option>
                  <option value="viplabor" ${ex?.actionType === 'viplabor' ? 'selected' : ''}>شاشة عمالة VIP</option>
                </select>
              </div>
            </div>
            ${this.hBox('ca-act', 'حدّد ماذا يحدث عندما يضغط المستخدم على زرار الإعلان: يفتح واتساب برقم المعلن، أو شات الإدارة، أو رابط خارجي، أو إحدى خدمات المنصة.')}

            <div>
              <label class="block text-[10px] text-slate-300 mb-1">رقم الواتساب أو الرابط (لو اخترت واتساب أو رابط) ${this.hBtn('ca-val')}</label>
              ${this.hBox('ca-val', 'اكتب رقم واتساب المعلن (مثال: 01030374787) لو اخترت واتساب، أو رابط الصفحة/الموقع لو اخترت رابط خارجي. اتركه فارغاً لاستخدام واتساب الإدارة الافتراضي.')}
              <input id="ca-val" type="text" value="${app.esc(ex?.actionValue || '')}" placeholder="010xxxxxxxx أو https://..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <label class="block p-2.5 rounded-xl border border-dashed border-purple-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-purple-300"><i class="fa-solid fa-image me-1"></i> صورة بانر الإعلان (اختياري)</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanCatAds.handleAdPhoto(this)" />
              <div id="ca-photo-prev">${this.tempAdImage ? `<img src="${this.tempAdImage}" class="max-h-24 mx-auto rounded mt-1.5" />` : ''}</div>
            </label>

            <button type="submit" class="w-full py-3 rounded-2xl bg-purple-600 text-white font-black">حفظ ونشر إعلان القسم فوراً</button>
          </form>
        </div>`;
    },

    async handleAdPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this.tempAdImage = await window.DamanApp.compressImage(f, 520, 0.50);
        const p = document.getElementById('ca-photo-prev');
        if (p) p.innerHTML = `<img src="${this.tempAdImage}" class="max-h-24 mx-auto rounded mt-1.5" />`;
      } catch (e) {}
    },

    async saveCategoryAd(e, editId) {
      e.preventDefault();
      const app = window.DamanApp;
      const days = parseInt(document.getElementById('ca-days').value, 10) || 0;
      const existing = editId ? this.categoryAds.find((x) => x.id === editId) : null;
      const expiresAt = days > 0 ? Date.now() + days * 86400000 : (existing?.expiresAt || 0);

      let mediaId = existing?.mediaId || '';
      if (this.tempAdImage && this.tempAdImage !== existing?.imageBase64) {
        try { mediaId = await app.saveMedia(this.tempAdImage, { kind: 'cat_ad_banner' }); } catch (err) {}
      }

      const item = {
        id: editId || ('cad_' + Date.now()),
        categoryId: document.getElementById('ca-cat').value,
        badge: document.getElementById('ca-badge').value.trim() || '★ إعلان القسم',
        theme: document.getElementById('ca-theme').value,
        title: document.getElementById('ca-title').value.trim(),
        subtitle: document.getElementById('ca-sub').value.trim(),
        priceText: document.getElementById('ca-price').value.trim(),
        ctaText: document.getElementById('ca-cta').value.trim() || 'تواصل الآن',
        actionType: document.getElementById('ca-act').value,
        actionValue: document.getElementById('ca-val').value.trim(),
        imageBase64: this.tempAdImage || '',
        mediaId,
        expiresAt,
        active: existing ? existing.active !== false : true,
        date: existing?.date || app.todayLocal()
      };

      const idx = this.categoryAds.findIndex((x) => x.id === item.id);
      if (idx >= 0) this.categoryAds[idx] = item;
      else this.categoryAds.unshift(item);

      await this.persistConfig();
      await app.logAudit('cat_ad_save', `إعلان قسم (${item.categoryId}): ${item.title}`);
      document.getElementById('daman-catad-modal').classList.add('hidden');
      app.toast('تم حفظ ونشر إعلان القسم بنجاح ✅', 'success');
    },

    async toggleCategoryAd(adId) {
      this.categoryAds = this.categoryAds.map((x) => (x.id === adId ? Object.assign({}, x, { active: x.active === false }) : x));
      await this.persistConfig();
    },

    async deleteCategoryAd(adId) {
      if (!window.confirm('حذف إعلان القسم هذا نهائياً؟')) return;
      this.categoryAds = this.categoryAds.filter((x) => x.id !== adId);
      await this.persistConfig();
      window.DamanApp.toast('تم حذف إعلان القسم', 'info');
    },

    renderAdminCategoriesPanel(app) {
      const counts = this.countPostsByCategory(app);
      const now = Date.now();

      return `
        <div class="space-y-4 text-xs">
          <!-- 1. Category Ads Management -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-purple-500/40">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black text-purple-300">📢 إعلانات وبانرات الأقسام (${this.categoryAds.length})</span>
              <button type="button" onclick="DamanCatAds.openCategoryAdModal('')" class="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-black text-[10.5px]">+ إعلان لقسم</button>
            </div>
            <p class="text-[10.5px] text-slate-400">أي إعلان تضيفه هنا يظهر في قمة القسم الذي تختاره داخل السوق فوراً بصورته وزرار تواصله.</p>
            ${!this.categoryAds.length ? `<div class="p-4 rounded-xl bg-slate-950 text-center text-slate-500">لا توجد إعلانات مخصصة للأقسام بعد — اضغط «+ إعلان لقسم» لإضافة أول إعلان.</div>` : this.categoryAds.map((ad) => {
              const expired = ad.expiresAt && Number(ad.expiresAt) > 0 && Number(ad.expiresAt) < now;
              return `
                <div class="p-3 rounded-xl bg-slate-950 border ${ad.active !== false && !expired ? 'border-purple-500/40' : 'border-slate-800 opacity-70'} space-y-1.5">
                  <div class="flex justify-between items-start gap-2">
                    <div class="min-w-0">
                      <span class="text-[10px] font-black text-amber-300">${app.esc(this.getCatName(ad.categoryId))}</span>
                      <div class="font-black text-white truncate">${app.esc(ad.title)}</div>
                      <div class="text-[9.5px] text-slate-400">${ad.priceText ? app.esc(ad.priceText) + ' • ' : ''}${expired ? '⏰ منتهي الصلاحية' : ad.expiresAt ? 'حتى ' + new Date(ad.expiresAt).toLocaleDateString('ar-EG') : 'دائم'}</div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                      <button type="button" onclick="DamanCatAds.openCategoryAdModal('${app.esc(ad.id)}')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">تعديل</button>
                      <button type="button" onclick="DamanCatAds.toggleCategoryAd('${app.esc(ad.id)}')" class="px-2 py-1 rounded bg-slate-800 ${ad.active !== false ? 'text-emerald-400' : 'text-rose-400'} font-bold text-[10px]">${ad.active !== false ? 'مفعّل' : 'موقوف'}</button>
                      <button type="button" onclick="DamanCatAds.deleteCategoryAd('${app.esc(ad.id)}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- 2. Dynamic Categories Management -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-amber-500/40">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black text-amber-400">🗂️ إدارة أقسام السوق (${this.allCategories.length} قسم)</span>
              <button type="button" onclick="DamanCatAds.openCategoryEditorModal('')" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">+ قسم جديد</button>
            </div>
            <div class="space-y-1.5">
              ${this.allCategories.map((c, idx) => `
                <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 ${c.active === false ? 'opacity-55' : ''}">
                  <div class="min-w-0">
                    <b class="text-white block truncate">${app.esc(c.icon || '📌')} ${app.esc(c.ar)}</b>
                    <span class="text-[9.5px] text-slate-400">ID: ${app.esc(c.id)} • إعلانات السوق: <b class="text-emerald-400">${counts[c.id] || 0}</b> • بانرات: <b class="text-purple-300">${this.categoryAds.filter((a) => a.categoryId === c.id).length}</b></span>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="DamanCatAds.moveCategoryOrder(${idx},-1)" class="px-1.5 py-1 rounded bg-slate-800 text-slate-300 text-[10px]" title="أعلى">↑</button>
                    <button type="button" onclick="DamanCatAds.moveCategoryOrder(${idx},1)" class="px-1.5 py-1 rounded bg-slate-800 text-slate-300 text-[10px]" title="أسفل">↓</button>
                    <button type="button" onclick="DamanCatAds.openCategoryEditorModal('${app.esc(c.id)}')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">تعديل</button>
                    <button type="button" onclick="DamanCatAds.toggleCategoryActive('${app.esc(c.id)}')" class="px-2 py-1 rounded bg-slate-800 ${c.active !== false ? 'text-emerald-400' : 'text-rose-400'} text-[10px]">${c.active !== false ? 'ظاهر' : 'مخفي'}</button>
                    <button type="button" onclick="DamanCatAds.deleteCategory('${app.esc(c.id)}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px]">حذف</button>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>`;
    },

    // ==================== NON-INVASIVE HOOKS INTO APP, PROJECTS & ADMIN ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app || !app.db) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      // Fix Bug #1: Start projects listener immediately so real featured ads appear on Home on first load
      if (window.DamanProjects && typeof DamanProjects.ensureListeners === 'function') {
        try { DamanProjects.ensureListeners(app); } catch (e) {}
      }

      // Live listener for settings/categoriesConfig
      this.unsubDoc = app.db.collection('settings').doc('categoriesConfig').onSnapshot((snap) => {
        if (snap.exists) {
          const d = snap.data() || {};
          if (Array.isArray(d.categories) && d.categories.length) this.allCategories = d.categories;
          if (Array.isArray(d.categoryAds)) this.categoryAds = d.categoryAds;
        }
        this.syncGlobalCategories(app);
        if (['home', 'projects', 'admin'].includes(app.activeTab)) app.renderCurrentTab();
      }, () => {});

      // Hook Home Tab to show icons + live counts
      if (typeof app.renderHomeTab === 'function' && !app._catHomeHooked) {
        app._catHomeHooked = true;
        const origHome = app.renderHomeTab.bind(app);
        app.renderHomeTab = (container) => {
          origHome(container);
          try { this.enhanceHomeDOM(container, app); } catch (e) {}
        };
      }

      // Hook Projects Market Tab to show visual categories + category-specific ads
      if (window.DamanProjects && !DamanProjects._catMarketHooked) {
        DamanProjects._catMarketHooked = true;
        const origProjRender = DamanProjects.render.bind(DamanProjects);
        DamanProjects.render = (container, a) => {
          origProjRender(container, a);
          try { this.enhanceMarketDOM(container, a); } catch (e) {}
        };
      }

      // Hook Admin Panel to inject "🗂️ الأقسام وإعلاناتها" tab cleanly
      if (window.DamanAdmin && !DamanAdmin._catAdminHooked) {
        DamanAdmin._catAdminHooked = true;
        const origSetTab = DamanAdmin.setSubTab.bind(DamanAdmin);
        DamanAdmin.setSubTab = function (t) {
          if (t === 'categories') {
            if (!window.DamanApp.isAdmin()) return window.DamanApp.toast('هذا القسم للأدمن الرئيسي فقط', 'error');
            this._viewingCategoriesTab = true;
            this.rerender();
            return;
          }
          this._viewingCategoriesTab = false;
          return origSetTab(t);
        };

        const origAdminRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdminRender(container, a);
          try {
            if (!a.isAdmin()) return;
            const tabBar = container.querySelector('.overflow-x-auto');
            if (!tabBar) return;

            const isCatActive = !!DamanAdmin._viewingCategoriesTab;
            if (isCatActive) {
              Array.from(tabBar.querySelectorAll('button')).forEach((b) => {
                b.className = 'shrink-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300';
              });
            }

            let catBtn = tabBar.querySelector('[data-adm-cat-tab]');
            if (!catBtn) {
              catBtn = document.createElement('button');
              catBtn.setAttribute('data-adm-cat-tab', '1');
              catBtn.onclick = () => DamanAdmin.setSubTab('categories');
              catBtn.textContent = '🗂️ الأقسام وإعلاناتها';
              tabBar.appendChild(catBtn);
            }
            catBtn.className = `shrink-0 px-3 py-2 rounded-xl ${isCatActive ? 'bg-purple-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300'}`;

            if (isCatActive) {
              while (tabBar.nextElementSibling) tabBar.nextElementSibling.remove();
              const slot = document.createElement('div');
              slot.id = 'adm-cats-panel-slot';
              slot.innerHTML = this.renderAdminCategoriesPanel(a);
              tabBar.parentNode.appendChild(slot);
            }
          } catch (e) {}
        };
      }

      if (['home', 'projects', 'admin'].includes(app.activeTab)) app.renderCurrentTab();
    }
  };

  window.DamanCatAds = CatAds;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => CatAds.boot(), 120));
  else setTimeout(() => CatAds.boot(), 120);
})();
