(function () {
  const ProjectsMod = {
    subTab: 'market', // 'market' | 'ledger' | 'inspection' | 'viplabor'
    marketFilter: 'all', // 'all' | 'project' | 'worker' | 'supplier' | 'favorites'
    selectedCategory: 'all',
    searchQuery: '',

    projects: [],
    ledgerEntries: [],
    inspectionReqs: [],
    vipLaborReqs: [],

    attachedUid: null,
    unsubProjects: null,
    unsubLedger: null,
    unsubInspect: null,
    unsubVipLabor: null,

    viewedSession: new Set(),
    tempPostPhoto: '',

    ensureListeners(app) {
      // Market projects feed (public approved + user's own posts)
      if (!this.unsubProjects) {
        this.unsubProjects = app.db
          .collection('projects')
          .limit(120)
          .onSnapshot(
            (snap) => {
              this.projects = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => {
                  const aBoost = Number(a.boostedUntil || 0) > Date.now() ? 1 : 0;
                  const bBoost = Number(b.boostedUntil || 0) > Date.now() ? 1 : 0;
                  if (bBoost !== aBoost) return bBoost - aBoost;
                  return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
                });
              if (app.activeTab === 'projects' && this.subTab === 'market') this.rerender();
            },
            () => {}
          );
      }

      const curUid = app.user ? app.user.uid : null;
      if (this.attachedUid === curUid) return;
      this.detachUserListeners();
      this.attachedUid = curUid;
      if (!curUid) return;

      this.unsubLedger = app.db
        .collection('siteLedger')
        .where('ownerId', '==', curUid)
        .limit(150)
        .onSnapshot(
          (snap) => {
            this.ledgerEntries = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'projects' && this.subTab === 'ledger') this.rerender();
          },
          () => {}
        );

      this.unsubInspect = app.db
        .collection('vipRequests')
        .where('userId', '==', curUid)
        .limit(40)
        .onSnapshot(
          (snap) => {
            this.inspectionReqs = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'projects' && this.subTab === 'inspection') this.rerender();
          },
          () => {}
        );

      this.unsubVipLabor = app.db
        .collection('vipLaborRequests')
        .where('userId', '==', curUid)
        .limit(40)
        .onSnapshot(
          (snap) => {
            this.vipLaborReqs = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'projects' && this.subTab === 'viplabor') this.rerender();
          },
          () => {}
        );
    },

    detachUserListeners() {
      ['unsubLedger', 'unsubInspect', 'unsubVipLabor'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      this.attachedUid = null;
      this.ledgerEntries = [];
      this.inspectionReqs = [];
      this.vipLaborReqs = [];
    },

    detachListeners() {
      this.detachUserListeners();
      if (this.unsubProjects) { try { this.unsubProjects(); } catch (e) {} this.unsubProjects = null; }
      this.projects = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'projects') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) {
      this.subTab = t;
      this.rerender();
    },

    setMarketFilter(f) {
      this.marketFilter = f;
      this.rerender();
    },

    setCategory(c) {
      this.selectedCategory = c;
      this.rerender();
    },

    onSearchInput(val) {
      this.searchQuery = val || '';
      const box = document.getElementById('daman-market-list-slot');
      if (box) box.innerHTML = this.renderMarketCards(window.DamanApp);
    },

    catLabel(id) {
      const c = (window.DamanApp.CATEGORIES || []).find((x) => x.id === id);
      return c ? (window.DamanApp.lang === 'ar' ? c.ar : c.en) : (id || 'عام');
    },

    postTypeLabel(t) {
      if (t === 'supplier') return '🚚 توريد خامات B2B';
      if (t === 'worker') return '👷 مقاول / فني يبحث عن عمل';
      return '🏗️ مطلوب تنفيذ / مشروع';
    },

    // ==================== CREATE / EDIT / CLOSE / BOOST / FAVORITE POSTS ====================
    openPostModal() {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) return app.toast('يجب توثيق الحساب بالبطاقة والسيلفي قبل النشر', 'warning');
      this.openPostEditorModal(null);
    },

    openEditPostModal(pid) {
      const post = this.projects.find((x) => x.id === pid);
      if (!post) {
        window.DamanApp.db.collection('projects').doc(pid).get().then((s) => {
          if (s.exists) this.openPostEditorModal(Object.assign({ id: s.id }, s.data()));
        }).catch(() => {});
        return;
      }
      this.openPostEditorModal(post);
    },

    openPostEditorModal(existing) {
      const app = window.DamanApp;
      this.tempPostPhoto = existing?.imageBase64 || '';
      let m = document.getElementById('daman-post-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-post-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      const catsOpt = app.CATEGORIES.map((c) => `<option value="${c.id}" ${existing?.category === c.id ? 'selected' : ''}>${app.esc(c.ar)}</option>`).join('');
      const defType = existing?.postType || (app.profile?.accountType === 'supplier' ? 'supplier' : 'project');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">${existing ? 'تعديل الإعلان (سيُعاد لمراجعة الإدارة)' : 'نشر إعلان / مشروع / عرض توريد B2B'}</h3>
            <button onclick="document.getElementById('daman-post-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanProjects.savePost(event,'${existing ? existing.id : ''}')" class="space-y-2.5">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">نوع الإعلان</label>
                <select id="pm-type" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                  <option value="project" ${defType === 'project' ? 'selected' : ''}>مطلوب تنفيذ / عمالة</option>
                  <option value="worker" ${defType === 'worker' ? 'selected' : ''}>مقاول / فني متاح للعمل</option>
                  <option value="supplier" ${defType === 'supplier' ? 'selected' : ''}>توريد خامات ومعدات B2B</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">التخصص</label>
                <select id="pm-cat" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">${catsOpt}</select>
              </div>
            </div>

            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">عنوان الإعلان</label><input id="pm-title" type="text" required value="${app.esc(existing?.title || '')}" placeholder="مثال: مطلوب نجارين مسلح للتجمع الخامس / توريد رمل وزلط" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>

            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">الميزانية / السعر التقريبي (ج.م)</label><input id="pm-budget" type="number" min="0" step="any" value="${existing?.budget || ''}" placeholder="اختياري" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">المدينة / موقع المشروع</label><input id="pm-city" type="text" required value="${app.esc(existing?.city || app.profile?.city || '')}" placeholder="مثال: القاهرة الجديدة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>

            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">التفاصيل والكميات والمواصفات</label><textarea id="pm-desc" rows="3" required placeholder="اكتب كل التفاصيل الواضحة للعمل أو التوريد..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc(existing?.description || '')}</textarea></div>

            <label class="block p-2.5 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-emerald-300"><i class="fa-solid fa-image me-1"></i> صورة للمشروع أو الخامة (اختياري)</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanProjects.handlePostPhoto(this)" />
              <div id="pm-photo-prev">${this.tempPostPhoto ? `<img src="${this.tempPostPhoto}" class="max-h-24 mx-auto rounded mt-1.5" />` : ''}</div>
            </label>

            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">
              ${existing ? 'حفظ التعديلات وإرسال للمراجعة' : 'نشر الإعلان الآن'}
            </button>
          </form>
        </div>`;
    },

    async handlePostPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this.tempPostPhoto = await window.DamanApp.compressImage(f, 580, 0.52);
        const p = document.getElementById('pm-photo-prev');
        if (p) p.innerHTML = `<img src="${this.tempPostPhoto}" class="max-h-24 mx-auto rounded mt-1.5" />`;
      } catch (e) {}
    },

    async savePost(e, existingId) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.withLock('savePost', async () => {
        const payload = {
          postType: document.getElementById('pm-type').value,
          category: document.getElementById('pm-cat').value,
          title: document.getElementById('pm-title').value.trim(),
          budget: parseFloat(document.getElementById('pm-budget').value) || 0,
          city: document.getElementById('pm-city').value.trim(),
          description: document.getElementById('pm-desc').value.trim(),
          imageBase64: this.tempPostPhoto || '',
          status: app.hasAdminAccess() ? 'approved' : 'pending_review',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          if (existingId) {
            await app.db.collection('projects').doc(existingId).update(payload);
            await app.sendNotification('ADMIN', 'منشور معدّل بانتظار المراجعة ✏️', payload.title);
            app.toast(app.hasAdminAccess() ? 'تم تحديث المنشور بنجاح ✅' : 'تم حفظ التعديلات وإعادة المنشور لمراجعة الإدارة', 'success');
          } else {
            Object.assign(payload, {
              ownerId: app.user.uid,
              ownerName: app.profile?.companyName || app.profile?.name || '',
              ownerType: app.profile?.accountType || 'individual',
              ownerVerified: app.profile?.kycStatus === 'verified',
              ownerVip: app.isSubscriptionActive(),
              views: 0,
              boostedUntil: 0,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await app.db.collection('projects').add(payload);
            if (!app.hasAdminAccess()) {
              await app.sendNotification('ADMIN', 'منشور جديد بالسوق بانتظار الموافقة 📢', `${payload.ownerName}: ${payload.title}`);
            }
            app.toast(app.hasAdminAccess() ? 'تم النشر مباشرة في السوق ✅' : 'تم إرسال إعلانك لمراجعة الإدارة وسيظهر فور اعتماده ✅', 'success');
          }
          document.getElementById('daman-post-modal').classList.add('hidden');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async toggleClosePost(pid) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      if (!p) return;
      const next = p.status === 'closed' ? (app.hasAdminAccess() ? 'approved' : 'pending_review') : 'closed';
      if (!window.confirm(next === 'closed' ? 'إغلاق الإعلان وإخفاؤه من السوق (تم الاتفاق)؟' : 'إعادة فتح الإعلان؟')) return;
      try {
        await app.db.collection('projects').doc(pid).update({ status: next });
        app.toast(next === 'closed' ? 'تم إغلاق الإعلان ✅' : 'تم إرسال طلب إعادة فتح الإعلان', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async toggleFavorite(pid) {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const favs = Array.isArray(app.profile.favorites) ? app.profile.favorites : [];
      const exists = favs.includes(pid);
      try {
        await app.db.collection('users').doc(app.user.uid).update({
          favorites: exists ? firebase.firestore.FieldValue.arrayRemove(pid) : firebase.firestore.FieldValue.arrayUnion(pid)
        });
        app.toast(exists ? 'تمت الإزالة من المفضلة' : 'تم الحفظ في المفضلة ❤️', 'info');
      } catch (e) {}
    },

    async boostPost(pid) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      if (!p || !app.user) return;
      const price = Number(app.appConfig?.packages?.boostAdPrice || 75);
      const avail = Number(app.profile?.balanceAvailable || 0);
      if (avail < price) {
        if (window.confirm(`تمييز الإعلان لمدة 7 أيام بـ ${app.fmtMoney(price)} ج.م.\nرصيدك لا يكفي — هل تريد شحن المحفظة الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(price - avail);
        }
        return;
      }
      if (!window.confirm(`تأكيد تمييز الإعلان «${p.title}» وتثبيته بأعلى السوق لمدة 7 أيام بمبلغ ${app.fmtMoney(price)} ج.م؟`)) return;

      await app.withLock('boost_' + pid, async () => {
        const uRef = app.db.collection('users').doc(app.user.uid);
        const pRef = app.db.collection('projects').doc(pid);
        try {
          await app.db.runTransaction(async (tx) => {
            const uDoc = await tx.get(uRef);
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            if (curAvail < price) throw new Error('الرصيد المتاح غير كافٍ');
            tx.update(uRef, { balanceAvailable: Math.round((curAvail - price) * 100) / 100 });
            tx.update(pRef, { boostedUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'ad_boost', amount: -price,
              note: `تمييز إعلان لمدة 7 أيام: ${p.title}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(app.db.collection('platformFees').doc(), {
              type: 'ad_boost', projectId: pid, userId: app.user.uid,
              userName: app.profile?.companyName || app.profile?.name || '',
              amount: price, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          app.toast('تم تمييز إعلانك وتثبيته بأعلى السوق لمدة 7 أيام ★', 'success');
        } catch (e) { app.toast(e.message, 'error'); }
      });
    },

    openPostDetails(pid) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      if (!p) return;

      if (!this.viewedSession.has(pid) && app.user && p.ownerId !== app.user.uid) {
        this.viewedSession.add(pid);
        app.db.collection('projects').doc(pid).update({ views: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
      }

      let m = document.getElementById('daman-post-detail-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-post-detail-modal';
        m.className = 'daman-modal fixed inset-0 z-[86] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const isOwner = app.user && p.ownerId === app.user.uid;
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 font-black text-[10px]">${this.postTypeLabel(p.postType)}</span>
            <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <h3 class="text-sm font-black text-white">${app.esc(p.title)}</h3>
          ${p.imageBase64 ? `<img src="${p.imageBase64}" onclick="DamanLightbox.open('${p.imageBase64}','${app.esc(p.title)}')" class="w-full max-h-56 object-cover rounded-2xl border border-slate-700 cursor-pointer" />` : ''}
          <p class="text-slate-200 leading-relaxed whitespace-pre-line">${app.esc(p.description || '')}</p>
          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            <div>التخصص: <b class="text-amber-300">${app.esc(this.catLabel(p.category))}</b></div>
            <div>الموقع: <b class="text-white">${app.esc(p.city || '—')}</b></div>
            <div>السعر/الميزانية: <b class="text-emerald-400">${p.budget ? app.fmtMoney(p.budget) + ' ج.م' : 'بالاتفاق'}</b></div>
            <div>المشاهدات: <b class="text-slate-300">${Number(p.views || 0)}</b></div>
          </div>
          <div onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); DamanApp.openPublicProfile('${p.ownerId}')" class="p-2.5 rounded-xl bg-slate-800/80 flex items-center justify-between cursor-pointer">
            <div>
              <div class="font-black text-white">${app.esc(p.ownerName || 'مستخدم')} ${p.ownerVerified ? '<i class="fa-solid fa-circle-check text-emerald-400 ms-1"></i>' : ''}</div>
              <div class="text-[10px] text-amber-300">اضغط لزيارة الصفحة وسابقة الأعمال والتقييمات</div>
            </div>
            <i class="fa-solid fa-chevron-left text-slate-400"></i>
          </div>
          <div class="flex gap-2">
            ${!isOwner ? `
              <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); if(window.DamanChat) DamanChat.openDirectChat('${p.ownerId}','${app.esc(p.ownerName || '').replace(/'/g, "\\'")}','${p.id}','${app.esc(p.title).replace(/'/g, "\\'")}')" class="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">
                <i class="fa-solid fa-comments me-1"></i> مراسلة واتفاق بالضمان
              </button>
              <button onclick="DamanApp.reportUserOrPost('project','${p.id}','${app.esc(p.title).replace(/'/g, "\\'")}')" class="px-3.5 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold">
                <i class="fa-solid fa-flag"></i>
              </button>` : `
              <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); DamanProjects.openEditPostModal('${p.id}')" class="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">تعديل</button>
              <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); DamanProjects.boostPost('${p.id}')" class="flex-1 py-2.5 rounded-xl bg-purple-500 text-white font-black">★ تمييز الإعلان</button>`}
          </div>
        </div>`;
    },

    // ==================== SITE WORKERS & WAGES LEDGER (WITH A4 PRINT & عهدة) ====================
    async submitLedgerEntry(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user) return app.openAuthModal('login');
      const workerName = document.getElementById('ld-worker').value.trim();
      const entryType = document.getElementById('ld-type').value;
      const amount = Math.round((parseFloat(document.getElementById('ld-amt').value) || 0) * 100) / 100;
      const siteName = document.getElementById('ld-site').value.trim();
      const note = document.getElementById('ld-note').value.trim();
      if (!workerName || amount <= 0) return;

      try {
        await app.db.collection('siteLedger').add({
          ownerId: app.user.uid,
          workerName,
          entryType, // 'wage' | 'overtime' | 'advance' | 'deduction' | 'custody'
          amount,
          siteName,
          note,
          date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast('تم التسجيل في دفتر الموقع بنجاح ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async deleteLedgerEntry(id) {
      if (!window.confirm('حذف هذا القيد من دفتر الموقع؟')) return;
      try {
        await window.DamanApp.db.collection('siteLedger').doc(id).delete();
        window.DamanApp.toast('تم الحذف', 'info');
      } catch (e) {}
    },

    ledgerTypeLabel(t) {
      return { wage: 'يومية عمل (+)', overtime: 'إضافي / سهر (+)', advance: 'سلفة (-)', deduction: 'خصم / جزاء (-)', custody: 'عهدة موقع (مشتريات)' }[t] || t;
    },

    printLedgerA4() {
      const app = window.DamanApp;
      const byWorker = {};
      this.ledgerEntries.forEach((x) => {
        const k = x.workerName || 'غير مسمى';
        if (!byWorker[k]) byWorker[k] = { wages: 0, advances: 0, deductions: 0, custody: 0 };
        if (x.entryType === 'wage' || x.entryType === 'overtime') byWorker[k].wages += Number(x.amount || 0);
        else if (x.entryType === 'advance') byWorker[k].advances += Number(x.amount || 0);
        else if (x.entryType === 'deduction') byWorker[k].deductions += Number(x.amount || 0);
        else if (x.entryType === 'custody') byWorker[k].custody += Number(x.amount || 0);
      });

      const summaryRows = Object.entries(byWorker).map(([name, s], i) => {
        const net = Math.round((s.wages - s.advances - s.deductions) * 100) / 100;
        return `<tr><td>${i + 1}</td><td><b>${app.esc(name)}</b></td><td>${app.fmtMoney(s.wages)}</td><td>${app.fmtMoney(s.advances)}</td><td>${app.fmtMoney(s.deductions)}</td><td>${app.fmtMoney(s.custody)}</td><td><b>${app.fmtMoney(net)} ج.م</b></td></tr>`;
      }).join('');

      const detailRows = this.ledgerEntries.map((x, i) => `
        <tr><td>${i + 1}</td><td>${app.esc(x.date || '')}</td><td>${app.esc(x.workerName)}</td><td>${this.ledgerTypeLabel(x.entryType)}</td><td>${app.esc(x.siteName || '—')}</td><td>${app.esc(x.note || '—')}</td><td><b>${app.fmtMoney(x.amount)} ج.م</b></td></tr>`).join('');

      const html = `
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:16px;">تصفية حساب العمال واليوميات والعهدة — ضمان سايت</h2>
              <div style="font-size:11px;">إعداد: ${app.esc(app.profile?.legalName || app.profile?.name || '')}</div>
            </div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>

          <h4 style="margin:6px 0;">أولاً: ملخص صافي المستحقات لكل عامل / مقاول</h4>
          <table style="margin-bottom:12px;">
            <thead><tr><th>#</th><th>الاسم</th><th>يوميات وإضافي</th><th>السلف</th><th>الخصومات</th><th>عهدة</th><th>الصافي المستحق</th></tr></thead>
            <tbody>${summaryRows || '<tr><td colspan="7" style="text-align:center;">لا توجد قيود</td></tr>'}</tbody>
          </table>

          <h4 style="margin:6px 0;">ثانياً: السجل التفصيلي للحركات</h4>
          <table>
            <thead><tr><th>#</th><th>التاريخ</th><th>الاسم</th><th>النوع</th><th>الموقع</th><th>البيان</th><th>المبلغ</th></tr></thead>
            <tbody>${detailRows || '<tr><td colspan="7" style="text-align:center;">لا توجد قيود</td></tr>'}</tbody>
          </table>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:22px; text-align:center; font-size:11px;">
            <div>توقيع مشرف الموقع / المقاول<br/><br/>.....................................</div>
            <div>توقيع المستلم<br/><br/>.....................................</div>
          </div>
        </div>`;

      window.DamanPrint(html);
    },

    // ==================== ENGINEERING INSPECTION 3x (WITH WALLET PAYMENT -> ADMIN PROFIT) ====================
    async submitInspectionRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      await app.withLock('inspReq', async () => {
        const element = document.getElementById('ins-elem').value;
        const location = document.getElementById('ins-loc').value.trim();
        const area = document.getElementById('ins-area').value.trim();
        const preferredDate = document.getElementById('ins-date').value;
        const notes = document.getElementById('ins-notes').value.trim();
        try {
          await app.db.collection('vipRequests').add({
            userId: app.user.uid,
            userName: app.profile?.companyName || app.profile?.name || '',
            userPhone: app.profile?.phone || '',
            element, location, area, preferredDate, notes,
            quotedPrice: 0,
            status: 'pending', // 'pending' | 'quoted' | 'paid' | 'completed' | 'rejected'
            date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.sendNotification('ADMIN', 'طلب استلام هندسي 3x جديد 🛡️', `${app.profile?.name} — ${element} (${location})`);
          e.target.reset();
          app.toast('تم إرسال طلب الاستلام الهندسي 3x بنجاح! سيتم التسعير والرد قريباً ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async payInspectionRequest(reqId) {
      const app = window.DamanApp;
      const req = this.inspectionReqs.find((x) => x.id === reqId);
      if (!req || req.status !== 'quoted' || Number(req.quotedPrice || 0) <= 0) return;

      const price = Number(req.quotedPrice);
      const avail = Number(app.profile?.balanceAvailable || 0);
      if (avail < price) {
        const diff = Math.round((price - avail) * 100) / 100;
        if (window.confirm(`رسوم الاستلام الهندسي 3x هي ${app.fmtMoney(price)} ج.م.\nرصيدك المتاح غير كافٍ — هل تريد شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
        }
        return;
      }
      if (!window.confirm(`تأكيد دفع ${app.fmtMoney(price)} ج.م من المحفظة لتأكيد موعد الاستلام الهندسي بضمان 3x؟`)) return;

      await app.withLock('payIns_' + reqId, async () => {
        const uRef = app.db.collection('users').doc(app.user.uid);
        const rRef = app.db.collection('vipRequests').doc(reqId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [uDoc, rDoc] = await Promise.all([tx.get(uRef), tx.get(rRef)]);
            if (rDoc.data().status !== 'quoted') throw new Error('حالة الطلب تغيرت بالفعل');
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            if (curAvail < price) throw new Error('الرصيد المتاح غير كافٍ');
            tx.update(uRef, { balanceAvailable: Math.round((curAvail - price) * 100) / 100 });
            tx.update(rRef, { status: 'paid', paidAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'inspection_3x', amount: -price,
              note: `دفع خدمة الاستلام الهندسي 3x (${req.element} — ${req.location})`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Credit Admin Net Profit Treasury directly
            tx.set(app.db.collection('platformFees').doc(), {
              type: 'inspection_3x', requestId: reqId, userId: app.user.uid,
              userName: app.profile?.companyName || app.profile?.name || '',
              amount: price, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification('ADMIN', 'تم دفع طلب استلام هندسي 3x ✅', `${app.profile?.name} دفع ${app.fmtMoney(price)} ج.م (${req.location})`);
          app.toast('تم الدفع وتأكيد موعد الاستلام الهندسي 3x بنجاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== VIP LABOR SUPPLY (FIXED 10% SEPARATION — NO DOUBLE COUNTING!) ====================
    async submitVipLaborRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      await app.withLock('vipLabReq', async () => {
        const trade = document.getElementById('vl-trade').value.trim();
        const workersCount = parseInt(document.getElementById('vl-count').value, 10) || 1;
        const days = parseInt(document.getElementById('vl-days').value, 10) || 1;
        const location = document.getElementById('vl-loc').value.trim();
        const notes = document.getElementById('vl-notes').value.trim();
        try {
          await app.db.collection('vipLaborRequests').add({
            userId: app.user.uid,
            userName: app.profile?.companyName || app.profile?.name || '',
            userPhone: app.profile?.phone || '',
            trade, workersCount, days, location, notes,
            baseCost: 0,
            vipFee: 0,
            totalQuoted: 0,
            status: 'pending', // 'pending' | 'quoted' | 'funded' | 'settled' | 'rejected'
            date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.sendNotification('ADMIN', 'طلب توريد عمالة VIP جديد 👷', `${app.profile?.name}: ${workersCount} (${trade}) × ${days} أيام — ${location}`);
          e.target.reset();
          app.toast('تم إرسال طلب عمالة VIP بنجاح! ستصلك التسعيرة قريباً ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async fundVipLaborRequest(reqId) {
      const app = window.DamanApp;
      const req = this.vipLaborReqs.find((x) => x.id === reqId);
      if (!req || req.status !== 'quoted') return;

      const baseCost = Math.round(Number(req.baseCost || 0) * 100) / 100;
      const vipRate = app.getVipCommissionRate();
      const vipFee = Math.round(Number(req.vipFee || baseCost * vipRate) * 100) / 100;
      const total = Math.round((baseCost + vipFee) * 100) / 100;
      if (baseCost <= 0) return;

      const avail = Number(app.profile?.balanceAvailable || 0);
      if (avail < total) {
        const diff = Math.round((total - avail) * 100) / 100;
        if (window.confirm(`إجمالي حجز عمالة VIP: ${app.fmtMoney(total)} ج.م (التكلفة ${app.fmtMoney(baseCost)} + عمولة VIP ${app.fmtMoney(vipFee)}).\nرصيدك المتاح لا يكفي — هل تريد شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
        }
        return;
      }

      if (!window.confirm(`تأكيد حجز عمالة VIP؟\n• تكلفة العمالة المحجوزة بالضمان: ${app.fmtMoney(baseCost)} ج.م\n• عمولة توريد VIP (${(vipRate * 100).toFixed(0)}%): ${app.fmtMoney(vipFee)} ج.م\n• الإجمالي المخصوم: ${app.fmtMoney(total)} ج.م`)) return;

      await app.withLock('fundVip_' + reqId, async () => {
        const uRef = app.db.collection('users').doc(app.user.uid);
        const rRef = app.db.collection('vipLaborRequests').doc(reqId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [uDoc, rDoc] = await Promise.all([tx.get(uRef), tx.get(rRef)]);
            if (rDoc.data().status !== 'quoted') throw new Error('حالة الطلب تغيرت بالفعل');
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
            if (curAvail < total) throw new Error('الرصيد المتاح غير كافٍ');

            // CLEAN ACCOUNTING: ONLY baseCost goes to Escrow; vipFee goes immediately to platformFees!
            tx.update(uRef, {
              balanceAvailable: Math.round((curAvail - total) * 100) / 100,
              balanceEscrow: Math.round((curEsc + baseCost) * 100) / 100
            });
            tx.update(rRef, {
              status: 'funded',
              lockedBaseCost: baseCost,
              paidVipFee: vipFee,
              totalPaid: total,
              fundedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'vip_labor_lock', amount: -total,
              note: `حجز عمالة VIP (${req.trade} — ${req.workersCount} عامل): ضمان ${app.fmtMoney(baseCost)} + عمولة ${app.fmtMoney(vipFee)}`,
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (vipFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                type: 'vip_labor_fee', requestId: reqId, userId: app.user.uid,
                userName: app.profile?.companyName || app.profile?.name || '',
                amount: vipFee, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          await app.sendNotification('ADMIN', 'تم حجز وتمويل عمالة VIP ✅', `${app.profile?.name} حجز ${app.fmtMoney(total)} ج.م (${req.trade})`);
          app.toast('تم حجز عمالة VIP بنجاح! ستتواصل معك الإدارة لتنسيق النزول للموقع ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== RENDER SUB-VIEWS ====================
    renderMarketCards(app) {
      const myUid = app.user?.uid;
      const favs = Array.isArray(app.profile?.favorites) ? app.profile.favorites : [];
      const qNorm = app.normalizeAr(this.searchQuery);

      const list = this.projects.filter((p) => {
        const isOwn = myUid && p.ownerId === myUid;
        if (p.status !== 'approved' && !isOwn && !app.hasAdminAccess()) return false;
        if (this.marketFilter === 'favorites') {
          if (!favs.includes(p.id)) return false;
        } else if (this.marketFilter !== 'all' && p.postType !== this.marketFilter) {
          return false;
        }
        if (this.selectedCategory !== 'all' && p.category !== this.selectedCategory) return false;
        if (qNorm) {
          const hay = app.normalizeAr(`${p.title} ${p.description} ${p.city} ${p.ownerName} ${this.catLabel(p.category)}`);
          if (!hay.includes(qNorm)) return false;
        }
        return true;
      });

      if (!list.length) {
        return `<div class="glass-card rounded-2xl p-7 text-center text-xs text-slate-400">لا توجد إعلانات مطابقة للبحث حالياً.</div>`;
      }

      return list.map((p) => {
        const isOwn = myUid && p.ownerId === myUid;
        const isFav = favs.includes(p.id);
        const boosted = Number(p.boostedUntil || 0) > Date.now();
        return `
          <div class="glass-card rounded-2xl p-3.5 space-y-2 ${boosted ? 'border-amber-400 bg-amber-500/5' : ''}">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center flex-wrap gap-1.5">
                ${boosted ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[9.5px] font-black">★ مميّز</span>` : ''}
                <span class="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 text-[9.5px] font-bold">${this.postTypeLabel(p.postType)}</span>
                <span class="px-2 py-0.5 rounded-lg bg-slate-950 text-slate-300 text-[9.5px]">${app.esc(this.catLabel(p.category))}</span>
                ${p.status !== 'approved' ? `<span class="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 text-[9px] font-black">${app.esc(p.status)}</span>` : ''}
              </div>
              <button onclick="DamanProjects.toggleFavorite('${p.id}')" class="text-sm ${isFav ? 'text-rose-500' : 'text-slate-500'}">
                <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
              </button>
            </div>

            <div onclick="DamanProjects.openPostDetails('${p.id}')" class="cursor-pointer space-y-1.5">
              <h4 class="text-xs font-black text-white">${app.esc(p.title)}</h4>
              ${p.imageBase64 ? `<img src="${p.imageBase64}" class="w-full h-36 object-cover rounded-xl border border-slate-800" />` : ''}
              <p class="text-[11px] text-slate-300 line-clamp-2">${app.esc(p.description || '')}</p>
            </div>

            <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
              <button onclick="DamanApp.openPublicProfile('${p.ownerId}')" class="font-bold text-sky-300 hover:underline">
                <i class="fa-solid fa-user me-1"></i>${app.esc(p.ownerName || 'مستخدم')} ${p.ownerVerified ? '✅' : ''}
              </button>
              <div class="flex items-center gap-2">
                <span><i class="fa-solid fa-location-dot me-0.5"></i>${app.esc(p.city || '')}</span>
                ${p.budget ? `<b class="text-emerald-400">${app.fmtMoney(p.budget)} ج.م</b>` : ''}
              </div>
            </div>

            <div class="flex items-center gap-1.5 pt-0.5">
              ${!isOwn ? `
                <button onclick="if(window.DamanChat) DamanChat.openDirectChat('${p.ownerId}','${app.esc(p.ownerName || '').replace(/'/g, "\\'")}','${p.id}','${app.esc(p.title).replace(/'/g, "\\'")}')" class="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">
                  <i class="fa-solid fa-comments me-1"></i> مراسلة واتفاق
                </button>
                <button onclick="DamanProjects.openPostDetails('${p.id}')" class="px-3 py-2 rounded-xl bg-slate-800 text-white font-bold text-[10.5px]">التفاصيل</button>` : `
                <button onclick="DamanProjects.openEditPostModal('${p.id}')" class="flex-1 py-1.5 rounded-xl bg-slate-800 text-amber-300 font-bold text-[10.5px]">تعديل</button>
                <button onclick="DamanProjects.boostPost('${p.id}')" class="flex-1 py-1.5 rounded-xl bg-purple-500/25 text-purple-200 border border-purple-500/40 font-black text-[10.5px]">★ تمييز</button>
                <button onclick="DamanProjects.toggleClosePost('${p.id}')" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[10.5px]">${p.status === 'closed' ? 'فتح' : 'إغلاق'}</button>`}
            </div>
          </div>`;
      }).join('');
    },

    renderMarketTab(app) {
      const catOpts = `<option value="all">كل التخصصات (17)</option>` + app.CATEGORIES.map((c) => `<option value="${c.id}" ${this.selectedCategory === c.id ? 'selected' : ''}>${app.esc(c.ar)}</option>`).join('');
      return `
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <input type="text" value="${app.esc(this.searchQuery)}" oninput="DamanProjects.onSearchInput(this.value)" placeholder="ابحث عن صنايعي، مشروع، مورد حديد/أسمنت، مدينة..." class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button onclick="DamanProjects.openPostModal()" class="px-3.5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shrink-0">
              <i class="fa-solid fa-plus me-1"></i> نشر
            </button>
          </div>

          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
            ${[
              ['all', 'الكل'],
              ['project', '🏗️ مشاريع'],
              ['worker', '👷 مقاولين وفنيين'],
              ['supplier', '🚚 موردين B2B'],
              ['favorites', '❤️ المفضلة']
            ].map(([k, lbl]) => `
              <button onclick="DamanProjects.setMarketFilter('${k}')" class="shrink-0 px-3 py-1.5 rounded-xl ${this.marketFilter === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
          </div>

          <select onchange="DamanProjects.setCategory(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-bold">${catOpts}</select>

          <div id="daman-market-list-slot" class="space-y-2.5">${this.renderMarketCards(app)}</div>
        </div>`;
    },

    renderLedgerTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
      return `
        <div class="space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="font-black text-amber-400"><i class="fa-solid fa-clipboard-list me-1"></i> دفتر عمال ويوميات وعهدة الموقع</h3>
            <button onclick="DamanProjects.printLedgerA4()" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10.5px]"><i class="fa-solid fa-print me-1"></i> تصفية A4</button>
          </div>

          <form onsubmit="DamanProjects.submitLedgerEntry(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <input id="ld-worker" type="text" required placeholder="اسم العامل / المقاول" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="ld-type" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                <option value="wage">يومية عمل (+)</option>
                <option value="overtime">إضافي / سهر (+)</option>
                <option value="advance">سلفة (-)</option>
                <option value="deduction">خصم / جزاء (-)</option>
                <option value="custody">عهدة مشتريات</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="ld-amt" type="number" min="1" step="any" required placeholder="المبلغ (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
              <input id="ld-site" type="text" placeholder="اسم الموقع / الفيلا" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <input id="ld-note" type="text" placeholder="ملاحظات / تفاصيل البند..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إضافة القيد للدفتر</button>
          </form>

          <div class="space-y-2">
            ${!this.ledgerEntries.length
              ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد قيود مسجّلة في دفتر الموقع بعد.</div>`
              : this.ledgerEntries.map((x) => `
                <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="font-black text-white">${app.esc(x.workerName)} • <span class="text-amber-300">${this.ledgerTypeLabel(x.entryType)}</span></div>
                    <div class="text-[10px] text-slate-400">${app.esc(x.date || '')} ${x.siteName ? '• ' + app.esc(x.siteName) : ''} ${x.note ? '• ' + app.esc(x.note) : ''}</div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <b class="${['advance', 'deduction'].includes(x.entryType) ? 'text-rose-400' : 'text-emerald-400'}">${app.fmtMoney(x.amount)} ج.م</b>
                    <button onclick="DamanProjects.deleteLedgerEntry('${x.id}')" class="text-rose-400"><i class="fa-solid fa-trash-can"></i></button>
                  </div>
                </div>`).join('')}
          </div>
        </div>`;
    },

    renderInspectionTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
      return `
        <div class="space-y-3 text-xs">
          <div class="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 space-y-1">
            <div class="font-black text-emerald-300"><i class="fa-solid fa-shield-halved me-1"></i> خدمة الاستلام الهندسي بضمان 3 أضعاف (3x)</div>
            <p class="text-[11px] text-slate-200 leading-relaxed">فحص واستلام الشدات الخشبية والمعدنية والحدادة والأسقف والمحارة والتشطيبات بتقرير هندسي معتمد وضمان مادي 3 أضعاف قيمة الخدمة.</p>
          </div>

          <form onsubmit="DamanProjects.submitInspectionRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <select id="ins-elem" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold">
              <option value="استلام شدة خشبية ومعدنية لسقف">استلام شدة خشبية ومعدنية لسقف</option>
              <option value="استلام حدادة مسلحة قبل الصب">استلام حدادة مسلحة قبل الصب</option>
              <option value="استلام مباني ومحارة وبؤج وأوتار">استلام مباني ومحارة وبؤج وأوتار</option>
              <option value="استلام تأسيس سباكة وكهرباء وعزل">استلام تأسيس سباكة وكهرباء وعزل</option>
              <option value="استلام تشطيب كامل (فيلا / شقة)">استلام تشطيب كامل (فيلا / شقة)</option>
            </select>
            <div class="grid grid-cols-2 gap-2">
              <input id="ins-loc" type="text" required placeholder="عنوان الموقع والكمبوند" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="ins-area" type="text" required placeholder="المساحة التقريبية (م²)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <input id="ins-date" type="date" required value="${app.todayLocal()}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="ins-notes" rows="2" placeholder="أي ملاحظات أو مواعيد الصب..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">طلب تسعير واستلام هندسي 3x</button>
          </form>

          <div class="space-y-2">
            ${this.inspectionReqs.map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-black text-white">${app.esc(r.element)}</span>
                  <span class="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 text-[10px] font-black">${app.esc(r.status)}</span>
                </div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.location)} • المساحة: ${app.esc(r.area)} • الموعد: ${app.esc(r.preferredDate || '')}</div>
                ${r.adminNote ? `<div class="p-2 rounded-lg bg-slate-950 text-[10.5px] text-sky-300">رد الإدارة: ${app.esc(r.adminNote)}</div>` : ''}
                ${r.status === 'quoted' && Number(r.quotedPrice || 0) > 0 ? `
                  <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500 flex items-center justify-between gap-2">
                    <span class="font-black text-emerald-300">التسعيرة المعتمدة: ${app.fmtMoney(r.quotedPrice)} ج.م</span>
                    <button onclick="DamanProjects.payInspectionRequest('${r.id}')" class="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">موافقة ودفع من المحفظة</button>
                  </div>` : ''}
                ${r.status === 'paid' ? `<div class="text-emerald-400 font-black text-[10.5px]">✅ تم الدفع (${app.fmtMoney(r.quotedPrice)} ج.م) وجارٍ تنسيق الزيارة الهندسية</div>` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderVipLaborTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
      const vipPct = (app.getVipCommissionRate() * 100).toFixed(0);
      return `
        <div class="space-y-3 text-xs">
          <div class="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-500/40 space-y-1">
            <div class="font-black text-purple-300"><i class="fa-solid fa-users-gear me-1"></i> توريد عمالة VIP بضمان ضمان سايت (عمولة ${vipPct}%)</div>
            <p class="text-[11px] text-slate-200 leading-relaxed">نوفر لك فرقاً فنية مختبرة (نجارين، حدادين، بنائين، مبيضين محارة، تشطيبات) بضمان كامل للالتزام والجودة، ويتم الحجز 100% عبر المحفظة.</p>
          </div>

          <form onsubmit="DamanProjects.submitVipLaborRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <input id="vl-trade" type="text" required placeholder="التخصص المطلوب (مثال: نجارين مسلح / حدادين / مبيضين محارة)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">عدد العمال</label><input id="vl-count" type="number" min="1" value="6" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">عدد الأيام</label><input id="vl-days" type="number" min="1" value="5" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <input id="vl-loc" type="text" required placeholder="موقع المشروع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="vl-notes" rows="2" placeholder="تفاصيل البند وموعد النزول المطلوب..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-purple-500 text-white font-black">إرسال طلب عمالة VIP</button>
          </form>

          <div class="space-y-2">
            ${this.vipLaborReqs.map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-black text-white">${app.esc(r.trade)} (${r.workersCount} عامل × ${r.days} أيام)</span>
                  <span class="px-2 py-0.5 rounded-lg bg-slate-800 text-purple-300 text-[10px] font-black">${app.esc(r.status)}</span>
                </div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.location)}</div>
                ${r.adminNote ? `<div class="p-2 rounded-lg bg-slate-950 text-[10.5px] text-sky-300">رد الإدارة: ${app.esc(r.adminNote)}</div>` : ''}
                ${r.status === 'quoted' && Number(r.baseCost || 0) > 0 ? `
                  <div class="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500 space-y-1.5">
                    <div class="text-[11px] text-purple-200">
                      تكلفة العمالة (ضمان): <b>${app.fmtMoney(r.baseCost)} ج.م</b> + عمولة VIP (${vipPct}%): <b>${app.fmtMoney(r.vipFee)} ج.م</b>
                      <br/><b class="text-emerald-300">الإجمالي للحجز: ${app.fmtMoney(r.totalQuoted || (Number(r.baseCost) + Number(r.vipFee)))} ج.م</b>
                    </div>
                    <button onclick="DamanProjects.fundVipLaborRequest('${r.id}')" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">موافقة وحجز 100% من المحفظة</button>
                  </div>` : ''}
                ${r.status === 'funded' ? `<div class="text-emerald-400 font-black text-[10.5px]">✅ تم الحجز (ضمان العمالة: ${app.fmtMoney(r.lockedBaseCost)} ج.م | عمولة: ${app.fmtMoney(r.paidVipFee)} ج.م)</div>` : ''}
                ${r.status === 'settled' ? `<div class="text-sky-400 font-black text-[10.5px]">🏁 تم التنفيذ وتسوية الحساب بالكامل</div>` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    },

    render(container, app) {
      this.ensureListeners(app);
      const body = this.subTab === 'ledger'
        ? this.renderLedgerTab(app)
        : this.subTab === 'inspection'
        ? this.renderInspectionTab(app)
        : this.subTab === 'viplabor'
        ? this.renderVipLaborTab(app)
        : this.renderMarketTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-extrabold">
            <button onclick="DamanProjects.setSubTab('market')" class="py-2 rounded-lg ${this.subTab === 'market' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">السوق B2B</button>
            <button onclick="DamanProjects.setSubTab('ledger')" class="py-2 rounded-lg ${this.subTab === 'ledger' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">دفتر الموقع</button>
            <button onclick="DamanProjects.setSubTab('inspection')" class="py-2 rounded-lg ${this.subTab === 'inspection' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">استلام 3x</button>
            <button onclick="DamanProjects.setSubTab('viplabor')" class="py-2 rounded-lg ${this.subTab === 'viplabor' ? 'bg-purple-500 text-white' : 'text-slate-400'}">عمالة VIP</button>
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanProjects = ProjectsMod;
  if (window.DamanApp) window.DamanApp.registerModule('projects', ProjectsMod);
})();
