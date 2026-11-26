(function () {
  const AdminExt1 = {
    marketSearch: '',

    // ==================== 1. BOOST PACKAGES & MARKET FULL CONTROL ====================
    getBoostList(app) {
      if (app.appConfig && Array.isArray(app.appConfig.boostPackages) && app.appConfig.boostPackages.length) {
        return app.appConfig.boostPackages;
      }
      return (window.DamanProjects && window.DamanProjects.DEFAULT_BOOST_PACKAGES) || [
        { id: 'silver', name: 'تمييز فضي (3 أيام)', badge: '⭐ مميز فضي', price: 40, days: 3, color: 'sky', priority: 1, showOnHome: false, features: 'ظهور أعلى الإعلانات العادية + إطار أزرق', active: true },
        { id: 'gold', name: 'تمييز ذهبي (7 أيام)', badge: '★ إعلان مميز', price: 75, days: 7, color: 'amber', priority: 2, showOnHome: true, features: 'أعلى السوق + ظهور بالصفحة الرئيسية + إطار ذهبي', active: true },
        { id: 'diamond', name: 'تمييز ماسي VIP (30 يوم)', badge: '💎 ماسي VIP', price: 250, days: 30, color: 'purple', priority: 3, showOnHome: true, features: 'أعلى أولوية بقمة السوق والرئيسية + إطار ماسي', active: true }
      ];
    },

    openBoostPkgModal(editId = '') {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const list = this.getBoostList(app);
      const ex = editId ? list.find((x) => x.id === editId) : null;

      let m = document.getElementById('daman-adm-bpkg-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-adm-bpkg-modal';
        m.className = 'daman-modal fixed inset-0 z-[93] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 space-y-2.5 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-black text-purple-300">${ex ? '✏️ تعديل باقة التمييز' : '+ إضافة باقة وميزة تمييز جديدة'}</h3>
            <button onclick="document.getElementById('daman-adm-bpkg-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanAdmin.saveBoostPackage(event,'${app.esc(editId)}')" class="space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-slate-400">اسم الباقة *</label><input id="bp-name" type="text" required value="${app.esc(ex?.name || '')}" placeholder="تمييز بلاتيني 14 يوم" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[10px] text-slate-400">نص الشارة على الإعلان *</label><input id="bp-badge" type="text" required value="${app.esc(ex?.badge || '★ مميز')}" placeholder="🔥 عرض حصري" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300 font-bold" /></div>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="text-[10px] text-emerald-300">السعر (ج.م) *</label><input id="bp-price" type="number" min="0" step="any" required value="${ex ? Number(ex.price) : 100}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
              <div><label class="text-[10px] text-amber-300">المدة (أيام) *</label><input id="bp-days" type="number" min="1" max="365" required value="${ex ? Number(ex.days) : 10}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-black" /></div>
              <div><label class="text-[10px] text-sky-300">الأولوية (1-10)</label><input id="bp-prio" type="number" min="1" max="10" required value="${ex ? Number(ex.priority || 1) : 2}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-slate-400">لون الإطار والشارة</label>
                <select id="bp-color" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="amber" ${ex?.color === 'amber' ? 'selected' : ''}>ذهبي</option>
                  <option value="purple" ${ex?.color === 'purple' ? 'selected' : ''}>ماسي بنفسجي</option>
                  <option value="emerald" ${ex?.color === 'emerald' ? 'selected' : ''}>أخضر زمردي</option>
                  <option value="sky" ${ex?.color === 'sky' ? 'selected' : ''}>أزرق فضي</option>
                  <option value="rose" ${ex?.color === 'rose' ? 'selected' : ''}>أحمر عاجل</option>
                </select>
              </div>
              <label class="flex items-center gap-1.5 pt-4 text-[10.5px] font-bold text-emerald-300">
                <input id="bp-home" type="checkbox" ${ex ? (ex.showOnHome ? 'checked' : '') : 'checked'} class="accent-emerald-500" /> يظهر في الرئيسية
              </label>
            </div>
            <div><label class="text-[10px] text-slate-400">وصف المميزات الظاهر للعميل</label><textarea id="bp-feat" rows="2" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(ex?.features || '')}</textarea></div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-purple-500 text-white font-black">حفظ باقة التمييز فوراً</button>
          </form>
        </div>`;
    },

    async saveBoostPackage(e, editId) {
      e.preventDefault();
      const app = window.DamanApp;
      const list = [...this.getBoostList(app)];
      const item = {
        id: editId || ('tier_' + Date.now()),
        name: document.getElementById('bp-name').value.trim(),
        badge: document.getElementById('bp-badge').value.trim(),
        price: parseFloat(document.getElementById('bp-price').value) || 0,
        days: parseInt(document.getElementById('bp-days').value, 10) || 7,
        priority: parseInt(document.getElementById('bp-prio').value, 10) || 1,
        color: document.getElementById('bp-color').value,
        showOnHome: document.getElementById('bp-home').checked,
        features: document.getElementById('bp-feat').value.trim(),
        active: true
      };
      const idx = list.findIndex((x) => x.id === item.id);
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], item);
      else list.push(item);

      await app.db.collection('settings').doc('appConfig').set({ boostPackages: list }, { merge: true });
      await app.logAudit('boost_pkg_save', `${item.name} (${item.price} ج.م / ${item.days} يوم)`);
      document.getElementById('daman-adm-bpkg-modal').classList.add('hidden');
      app.toast('تم حفظ باقة التمييز وتطبيقها على السوق فوراً ✅', 'success');
      this.rerender();
    },

    async toggleBoostPackage(pkgId) {
      const app = window.DamanApp;
      const list = this.getBoostList(app).map((x) => (x.id === pkgId ? Object.assign({}, x, { active: x.active === false }) : x));
      await app.db.collection('settings').doc('appConfig').set({ boostPackages: list }, { merge: true });
      this.rerender();
    },

    async deleteBoostPackage(pkgId) {
      const app = window.DamanApp;
      if (!window.confirm('حذف باقة التمييز هذه؟')) return;
      const list = this.getBoostList(app).filter((x) => x.id !== pkgId);
      await app.db.collection('settings').doc('appConfig').set({ boostPackages: list }, { merge: true });
      this.rerender();
    },

    openEditProjectAdminModal(pid) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      if (!p) return;
      const cats = Array.isArray(app.CATEGORIES) ? app.CATEGORIES : [];
      const catsOpt = cats.map((c) => `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${app.esc(c.ar)}</option>`).join('');
      const bPkgs = this.getBoostList(app);

      let m = document.getElementById('daman-adm-proj-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-adm-proj-modal';
        m.className = 'daman-modal fixed inset-0 z-[92] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-2.5 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-black text-amber-400">✏️ تعديل ونقل وتمييز الإعلان</h3>
            <button onclick="document.getElementById('daman-adm-proj-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="text-[10.5px] text-slate-400">المشاهدات الحالية: <b class="text-sky-300">👁️ ${Number(p.views || 0)}</b> • المعلن: <b class="text-white">${app.esc(p.ownerName || '')}</b></div>
          <form onsubmit="DamanAdmin.saveProjectAdminEdit(event,'${p.id}')" class="space-y-2">
            <div><label class="text-[10px] text-slate-400">عنوان الإعلان *</label><input id="ap-title" type="text" required value="${app.esc(p.title || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-amber-300">نقل لقسم / تخصص آخر *</label><select id="ap-cat" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">${catsOpt}</select></div>
              <div>
                <label class="text-[10px] text-sky-300">نوع الإعلان *</label>
                <select id="ap-type" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-sky-500/40 text-sky-300 font-bold">
                  <option value="project" ${p.postType === 'project' ? 'selected' : ''}>🏗️ مشروع / مطلوب تنفيذ</option>
                  <option value="worker" ${p.postType === 'worker' ? 'selected' : ''}>👷 مقاول / فني متاح</option>
                  <option value="supplier" ${p.postType === 'supplier' ? 'selected' : ''}>🚚 مورّد خامات B2B</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-slate-400">السعر / الميزانية (ج.م)</label><input id="ap-budget" type="number" step="any" value="${Number(p.budget || 0)}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[10px] text-slate-400">المدينة</label><input id="ap-city" type="text" value="${app.esc(p.city || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-slate-400">حالة النشر</label>
                <select id="ap-status" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold">
                  <option value="approved" ${p.status === 'approved' ? 'selected' : ''}>منشور ✅</option>
                  <option value="pending_review" ${p.status === 'pending_review' ? 'selected' : ''}>قيد المراجعة ⏳</option>
                  <option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>مرفوض ❌</option>
                  <option value="closed" ${p.status === 'closed' ? 'selected' : ''}>مغلق 🔒</option>
                </select>
              </div>
              <div>
                <label class="text-[10px] text-purple-300">باقة التمييز المطبّقة</label>
                <select id="ap-tier" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-purple-500/40 text-purple-200 font-bold">
                  <option value="keep">ترك التمييز كما هو</option>
                  <option value="none">إلغاء التمييز (عادي)</option>
                  ${bPkgs.map((bp) => `<option value="${app.esc(bp.id)}">${app.esc(bp.badge)} (${bp.days} يوم)</option>`).join('')}
                </select>
              </div>
            </div>
            <div><label class="text-[10px] text-slate-400">التفاصيل</label><textarea id="ap-desc" rows="3" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(p.description || '')}</textarea></div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ التعديلات والنقل فوراً</button>
          </form>
        </div>`;
    },

    async saveProjectAdminEdit(e, pid) {
      e.preventDefault();
      const app = window.DamanApp;
      const tierSel = document.getElementById('ap-tier').value;
      const newStatus = document.getElementById('ap-status').value;
      const patch = {
        title: document.getElementById('ap-title').value.trim(),
        category: document.getElementById('ap-cat').value,
        postType: document.getElementById('ap-type').value,
        budget: parseFloat(document.getElementById('ap-budget').value) || 0,
        city: document.getElementById('ap-city').value.trim(),
        status: newStatus,
        description: document.getElementById('ap-desc').value.trim()
      };
      if (newStatus === 'approved') {
        patch.rejectionReason = '';
        patch.editedByUser = false;
      }
      if (tierSel === 'none') {
        patch.boostedUntil = 0; patch.boostTierId = ''; patch.boostPriority = 0;
      } else if (tierSel !== 'keep') {
        const bp = this.getBoostList(app).find((b) => b.id === tierSel);
        if (bp) {
          patch.boostedUntil = Date.now() + Number(bp.days || 7) * 86400000;
          patch.boostTierId = bp.id; patch.boostBadge = bp.badge;
          patch.boostColor = bp.color; patch.boostPriority = Number(bp.priority || 1);
          patch.showOnHome = bp.showOnHome !== false;
        }
      }
      await app.db.collection('projects').doc(pid).update(patch);
      await app.logAudit('admin_edit_project', `تعديل/نقل إعلان ${pid} إلى قسم ${patch.category}`, pid);
      document.getElementById('daman-adm-proj-modal').classList.add('hidden');
      app.toast('تم حفظ تعديل ونقل الإعلان ✅', 'success');
      this.loadTabData('market');
    },

    async moderateProject(pid, status) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      let rejectionReason = '';
      if (status === 'rejected') {
        const inp = window.prompt(`سبب رفض الإعلان «${p?.title || ''}» (سيظهر لصاحب الإعلان لتعديله):`, 'المعلومات غير مكتملة أو مخالفة لشروط النشر');
        if (inp === null) return;
        rejectionReason = inp.trim() || 'مخالفة شروط النشر — يرجى التعديل وإعادة الإرسال';
      }

      const patch = {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason : '',
        editedByUser: false,
        reviewedBy: app.user.email,
        reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await app.db.collection('projects').doc(pid).update(patch);
      if (p && p.ownerId) {
        await app.sendNotification(
          p.ownerId,
          status === 'approved' ? '✅ تم اعتماد ونشر إعلانك' : '❌ تم رفض إعلانك — يمكنك تعديله',
          status === 'approved' ? p.title : `${p.title} — السبب: ${rejectionReason}`
        ).catch(() => {});
      }
      await app.logAudit('market_moderate', `${status}: ${p?.title || pid}${rejectionReason ? ' | ' + rejectionReason : ''}`, pid);
      app.toast(status === 'approved' ? 'تم اعتماد ونشر الإعلان ✅' : 'تم رفض الإعلان وإبلاغ صاحبه ❌', 'success');
      this.loadTabData('market');
    },

    async deleteProjectAdmin(pid) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      const reason = window.prompt(
        `حذف الإعلان «${p?.title || pid}» نهائياً من السوق\nاكتب سبب الحذف (سيصل لصاحب الإعلان في إشعار):`,
        'مخالفة شروط النشر في السوق'
      );
      if (reason === null) return;
      const cleanReason = reason.trim() || 'تم الحذف بواسطة إدارة المنصة';

      await app.withLock('admDelProj_' + pid, async () => {
        try {
          if (p && p.imageMedia) {
            await app.db.collection('mediaVault').doc(p.imageMedia).delete().catch(() => {});
          }
          await app.db.collection('projects').doc(pid).delete();
          if (p && p.ownerId && p.ownerId !== app.user?.uid) {
            await app.sendNotification(p.ownerId, '🗑️ تم حذف إعلانك من قِبل الإدارة', `${p.title} — السبب: ${cleanReason}`).catch(() => {});
          }
          await app.logAudit('admin_delete_project', `حذف إعلان (${p?.title || pid}) — السبب: ${cleanReason}`, pid);
          app.toast('تم حذف الإعلان وإبلاغ صاحبه ✅', 'success');
          this.loadTabData('market');
        } catch (err) {
          app.toast('تعذر الحذف: ' + err.message, 'error');
        }
      });
    },

    async quoteInspection(reqId) {
      const app = window.DamanApp;
      const r = this.inspections.find((x) => x.id === reqId);
      if (!r) return;
      const price = parseFloat(window.prompt(`تسعير طلب الاستلام 3x (${r.element}):`, r.quotedPrice || '9000'));
      if (!price || price <= 0) return;
      const note = window.prompt('ملاحظة وموعد المهندس:', 'تم التسعير — اضغط موافقة ودفع لتأكيد الزيارة') || '';
      await app.db.collection('vipRequests').doc(reqId).update({ quotedPrice: price, adminNote: note, status: 'quoted' });
      await app.sendNotification(r.userId, `تم تسعير الاستلام 3x (${app.fmtMoney(price)} ج.م)`, note);
      app.toast('تم إرسال التسعيرة ✅', 'success');
      this.loadTabData('market');
    },

    async uploadInspectionReport(input, reqId) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      if (!f) return;
      input.value = '';
      const reportMedia = await app.saveMedia(await app.compressImage(f, 920, 0.62), { kind: 'inspection_report' });
      const r = this.inspections.find((x) => x.id === reqId);
      await app.db.collection('vipRequests').doc(reqId).update({ reportMedia, status: 'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp() });
      if (r) await app.sendNotification(r.userId, '📄 تم رفع التقرير الهندسي 3x!', 'افتح قسم استلام 3x لمعاينة التقرير المعتمد.');
      app.toast('تم رفع التقرير وإغلاق الطلب ✅', 'success');
      this.loadTabData('market');
    },

    async quoteVipLabor(reqId) {
      const app = window.DamanApp;
      const r = this.vipLabors.find((x) => x.id === reqId);
      if (!r) return;
      const baseCost = parseFloat(window.prompt(`التكلفة الصافية للعمالة (${r.workersCount} ${r.trade} × ${r.days} يوم):`, r.baseCost || '5000'));
      if (!baseCost || baseCost <= 0) return;
      const vipFee = Math.round(baseCost * app.getVipCommissionRate() * 100) / 100;
      const totalQuoted = Math.round((baseCost + vipFee) * 100) / 100;
      const note = window.prompt('ملاحظات الإدارة:', `التكلفة ${app.fmtMoney(baseCost)} + عمولة VIP ${app.fmtMoney(vipFee)}`) || '';
      await app.db.collection('vipLaborRequests').doc(reqId).update({ baseCost, vipFee, totalQuoted, adminNote: note, status: 'quoted' });
      await app.sendNotification(r.userId, `تم تسعير عمالة VIP (${app.fmtMoney(totalQuoted)} ج.م)`, note);
      app.toast('تم إرسال التسعيرة ✅', 'success');
      this.loadTabData('market');
    },

    async settleVipLabor(reqId, mode) {
      const app = window.DamanApp;
      const r = this.vipLabors.find((x) => x.id === reqId);
      if (!r || r.status !== 'funded') return;
      const amt = Number(r.lockedBaseCost || r.baseCost || 0);
      if (!window.confirm(mode === 'settle' ? `إتمام وتسوية (${app.fmtMoney(amt)} ج.م)؟` : `رد الضمان (${app.fmtMoney(amt)} ج.م)؟`)) return;
      const uRef = app.db.collection('users').doc(r.userId);
      const rRef = app.db.collection('vipLaborRequests').doc(reqId);
      await app.db.runTransaction(async (tx) => {
        const [uDoc, reqDoc] = await Promise.all([tx.get(uRef), tx.get(rRef)]);
        if (reqDoc.data().status !== 'funded') throw new Error('تمت التسوية مسبقاً');
        const uPatch = { balanceEscrow: Math.max(0, Math.round((Number((uDoc.data() || {}).balanceEscrow || 0) - amt) * 100) / 100) };
        if (mode === 'refund') uPatch.balanceAvailable = Math.round((Number((uDoc.data() || {}).balanceAvailable || 0) + amt) * 100) / 100;
        tx.update(uRef, uPatch);
        tx.update(rRef, { status: mode === 'settle' ? 'settled' : 'refunded', settledAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
      app.toast('تمت التسوية بنجاح ✅', 'success');
      this.loadTabData('market');
    },

    renderMarketTab(app) {
      const pendingPosts = this.projects.filter((p) => p.status === 'pending_review');
      const bPkgs = this.getBoostList(app);
      const catAr = (id) => {
        if (window.DamanCatAds && typeof DamanCatAds.getCatById === 'function') {
          const c = DamanCatAds.getCatById(id);
          if (c) return c.ar;
        }
        return ((app.CATEGORIES || []).find((c) => c.id === id) || {}).ar || id;
      };
      const mq = app.normalizeAr(this.marketSearch || '');
      const filteredAll = this.projects.filter((p) => !mq || app.normalizeAr(`${p.title} ${p.ownerName} ${p.city} ${catAr(p.category)}`).includes(mq));

      return `
        <div class="space-y-4 text-xs">
          ${app.isAdmin() ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-purple-500/40">
              <div class="flex items-center justify-between gap-2">
                <span class="font-black text-purple-300">★ باقات ومميزات التمييز (${bPkgs.length})</span>
                <div class="flex gap-1.5">
                  <button onclick="if(window.DamanProjects) DamanProjects.openPostModal()" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">+ نشر إعلان</button>
                  <button onclick="DamanAdmin.openBoostPkgModal('')" class="px-2.5 py-1 rounded-lg bg-purple-500 text-white font-black text-[10px]">+ باقة تمييز</button>
                </div>
              </div>
              <div class="space-y-1.5">
                ${bPkgs.map((bp) => `
                  <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <b class="text-white block truncate">${app.esc(bp.badge)} — ${app.esc(bp.name)}</b>
                      <span class="text-[10px] text-emerald-400">${app.fmtMoney(bp.price)} ج.م / ${bp.days} يوم ${bp.showOnHome ? '• رئيسية' : ''} • أولوية ${bp.priority || 1}</span>
                    </div>
                    <div class="flex gap-1 shrink-0">
                      <button onclick="DamanAdmin.openBoostPkgModal('${app.esc(bp.id)}')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">تعديل</button>
                      <button onclick="DamanAdmin.toggleBoostPackage('${app.esc(bp.id)}')" class="px-2 py-1 rounded bg-slate-800 ${bp.active !== false ? 'text-emerald-400' : 'text-rose-400'} text-[10px]">${bp.active !== false ? 'مفعّل' : 'موقوف'}</button>
                      <button onclick="DamanAdmin.deleteBoostPackage('${app.esc(bp.id)}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px]">حذف</button>
                    </div>
                  </div>`).join('')}
              </div>
            </div>` : ''}

          <div class="space-y-2">
            <div class="font-black text-amber-400">📢 إعلانات بانتظار الموافقة (${pendingPosts.length})</div>
            ${!pendingPosts.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد إعلانات معلّقة ✅</div>` : pendingPosts.map((p) => `
              <div class="glass-card rounded-2xl p-3 space-y-2 border-amber-500/50">
                <div class="flex items-start justify-between gap-2">
                  <div class="font-black text-white">${app.esc(p.title)}</div>
                  ${p.editedByUser ? `<span class="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-[9.5px] font-black shrink-0">✏️ تم تعديله</span>` : `<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[9.5px] font-black shrink-0">🆕 جديد</span>`}
                </div>
                <div class="text-[10px] text-amber-300">المعلن: <b class="text-white">${app.esc(p.ownerName || '—')}</b> • القسم: ${app.esc(catAr(p.category))} • ${app.esc(p.city || '—')}</div>
                ${p.imageBase64 ? `<img src="${p.imageBase64}" onclick="DamanApp.openMediaLightbox('${p.imageBase64}','صورة الإعلان')" class="w-full max-h-32 object-cover rounded-xl border border-slate-700 cursor-pointer" />` : ''}
                <p class="text-[11px] text-slate-300 whitespace-pre-line">${app.esc(p.description)}</p>
                <div class="grid grid-cols-4 gap-1.5">
                  <button onclick="DamanAdmin.moderateProject('${p.id}','approved')" class="py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10.5px]">✅ نشر</button>
                  <button onclick="DamanAdmin.openEditProjectAdminModal('${p.id}')" class="py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">✏️ تعديل</button>
                  <button onclick="DamanAdmin.moderateProject('${p.id}','rejected')" class="py-1.5 rounded-xl bg-rose-500 text-white font-black text-[10.5px]">❌ رفض</button>
                  <button onclick="DamanAdmin.deleteProjectAdmin('${p.id}')" class="py-1.5 rounded-xl bg-slate-800 border border-rose-500/50 text-rose-300 font-black text-[10.5px]">🗑️ حذف</button>
                </div>
              </div>`).join('')}
          </div>

          <div class="space-y-2">
            <div class="font-black text-emerald-400">🛡️ الاستلام الهندسي 3x (${this.inspections.length})</div>
            ${this.inspections.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.element)} — ${app.esc(r.userName)}</b><span class="text-amber-300 font-bold">${this.statusAr(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.location)} • المساحة: ${app.esc(r.area || '—')} • ${app.esc(r.userPhone || '')}</div>
                <div class="flex flex-wrap gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteInspection('${r.id}')" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">تسعير</button>` : ''}
                  ${r.status === 'paid' ? `<label class="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] cursor-pointer">📄 رفع التقرير الهندسي<input type="file" accept="image/*" class="hidden" onchange="DamanAdmin.uploadInspectionReport(this,'${r.id}')" /></label>` : ''}
                  ${r.reportMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.reportMedia}','التقرير الهندسي')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">عرض التقرير</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد طلبات</div>'}
          </div>

          <div class="space-y-2">
            <div class="font-black text-purple-300">👷 عمالة VIP (${this.vipLabors.length})</div>
            ${this.vipLabors.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.trade)} (${r.workersCount} عامل × ${r.days} يوم)</b><span class="text-purple-300 font-bold">${this.statusAr(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.userName)} • ${app.esc(r.location)} • بداية: ${app.esc(r.startDate || r.date || '')}</div>
                <div class="flex gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteVipLabor('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-purple-500 text-white font-black text-[10px]">تسعير (+ VIP)</button>` : ''}
                  ${r.status === 'funded' ? `<button onclick="DamanAdmin.settleVipLabor('${r.id}','settle')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">✅ تسوية</button><button onclick="DamanAdmin.settleVipLabor('${r.id}','refund')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">ردّ الضمان</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد طلبات</div>'}
          </div>

          <div class="space-y-2">
            <div class="font-black text-slate-300">كل إعلانات السوق — بحث / نقل / تمييز / حذف (${filteredAll.length})</div>
            <input type="text" value="${app.esc(this.marketSearch || '')}" oninput="DamanAdmin.marketSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بعنوان الإعلان أو اسم المعلن أو القسم أو المدينة..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            ${filteredAll.slice(0, 100).map((p) => {
              const boosted = Number(p.boostedUntil || 0) > Date.now();
              return `
                <div class="glass-card rounded-xl p-2.5 flex justify-between items-center gap-2">
                  <div class="min-w-0">
                    <span class="truncate text-white font-bold block">${boosted ? (p.boostBadge || '★') + ' ' : ''}${app.esc(p.title)}</span>
                    <span class="text-[9.5px] text-slate-400">${app.esc(p.ownerName || '—')} • ${app.esc(catAr(p.category))} • 👁️ ${Number(p.views || 0)} • ${this.statusAr(p.status)}</span>
                  </div>
                  <div class="flex gap-1 shrink-0">
                    ${p.status === 'pending_review' ? `<button onclick="DamanAdmin.moderateProject('${p.id}','approved')" class="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-[10px] font-black">نشر</button>` : ''}
                    <button onclick="DamanAdmin.openEditProjectAdminModal('${p.id}')" class="px-2 py-1 rounded bg-amber-500 text-slate-950 text-[10px] font-black">تعديل/تمييز</button>
                    <button onclick="DamanAdmin.deleteProjectAdmin('${p.id}')" class="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-black">حذف</button>
                  </div>
                </div>`;
            }).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد إعلانات مطابقة</div>'}
          </div>
        </div>`;
    },

    // ==================== 2. EVERY WORD IN APP (BRANDING + 4 CARDS + 6 NAV TABS + BANNERS) ====================
    async saveAnnouncementAndBranding(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const patch = {
        announcement: {
          enabled: document.getElementById('an-en').checked,
          text: document.getElementById('an-txt').value.trim(),
          color: document.getElementById('an-col').value,
          action: document.getElementById('an-act').value
        },
        branding: {
          appNameAr: document.getElementById('br-ar').value.trim() || 'ضمان سايت',
          appNameEn: document.getElementById('br-en').value.trim() || 'DamanSite',
          taglineAr: document.getElementById('br-tag-ar').value.trim(),
          taglineEn: document.getElementById('br-tag-en').value.trim(),
          heroWelcome: document.getElementById('br-hw').value.trim(),
          heroGuestTitle: document.getElementById('br-ht').value.trim(),
          heroGuestDesc: document.getElementById('br-hd').value.trim(),
          privacyText: document.getElementById('br-priv').value.trim(),
          navLabels: {
            navHome: document.getElementById('nv-home').value.trim() || 'الرئيسية',
            navProjects: document.getElementById('nv-proj').value.trim() || 'السوق',
            navChat: document.getElementById('nv-chat').value.trim() || 'الشات',
            navCompany: document.getElementById('nv-comp').value.trim() || 'الشركات',
            navWallet: document.getElementById('nv-wal').value.trim() || 'المحفظة',
            navProfile: document.getElementById('nv-prof').value.trim() || 'صفحتي'
          },
          homeCards: {
            c1Title: document.getElementById('hc-1t').value.trim(), c1Sub: document.getElementById('hc-1s').value.trim(),
            c2Title: document.getElementById('hc-2t').value.trim(), c2Sub: document.getElementById('hc-2s').value.trim(),
            c3Title: document.getElementById('hc-3t').value.trim(), c3Sub: document.getElementById('hc-3s').value.trim(),
            c4Title: document.getElementById('hc-4t').value.trim(), c4Sub: document.getElementById('hc-4s').value.trim()
          }
        },
        hideDemoPosts: document.getElementById('ad-hide-demo').checked,
        hideOfficialBanners: document.getElementById('ad-hide-off').checked
      };
      await app.db.collection('settings').doc('appConfig').set(patch, { merge: true });
      await app.logAudit('branding_update', 'تحديث كل نصوص التطبيق والتبويبات والكروت');
      app.toast('تم تطبيق كل التعديلات النصية على التطبيق فوراً ✅', 'success');
    },

    async addCustomHomeBanner(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const cur = Array.isArray(app.appConfig?.customHomeBanners) ? app.appConfig.customHomeBanners : [];
      await app.db.collection('settings').doc('appConfig').set({
        customHomeBanners: cur.concat([{
          id: 'bn_' + Date.now(),
          badge: document.getElementById('hb-badge').value.trim() || 'عرض خاص',
          title: document.getElementById('hb-title').value.trim(),
          subtitle: document.getElementById('hb-sub').value.trim(),
          ctaText: document.getElementById('hb-cta').value.trim() || 'اطلب الآن',
          action: document.getElementById('hb-act').value,
          theme: document.getElementById('hb-theme').value
        }])
      }, { merge: true });
      e.target.reset();
      app.toast('تم نشر البانر على الرئيسية فوراً ✅', 'success');
    },

    async deleteCustomHomeBanner(id) {
      const app = window.DamanApp;
      const cur = Array.isArray(app.appConfig?.customHomeBanners) ? app.appConfig.customHomeBanners : [];
      await app.db.collection('settings').doc('appConfig').set({ customHomeBanners: cur.filter((x) => x.id !== id) }, { merge: true });
      app.toast('تم حذف البانر', 'info');
    },

    renderAdsAndBrandingTab(app) {
      const cfg = app.appConfig || {};
      const br = cfg.branding || {};
      const nv = br.navLabels || {};
      const hc = br.homeCards || {};
      const ann = cfg.announcement || {};
      const customBanners = Array.isArray(cfg.customHomeBanners) ? cfg.customHomeBanners : [];

      return `
        <div class="space-y-3.5 text-xs">
          <form onsubmit="DamanAdmin.saveAnnouncementAndBranding(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-amber-500/40">
            <div class="font-black text-amber-400">📣 الشريط العاجل + التحكم في كل حرف بالتطبيق</div>
            <label class="flex items-center gap-2 p-2 rounded-xl bg-slate-950 font-bold text-amber-300"><input id="an-en" type="checkbox" ${ann.enabled ? 'checked' : ''} class="accent-amber-500" /> تفعيل الشريط العاجل أعلى التطبيق</label>
            <input id="an-txt" type="text" value="${app.esc(ann.text || '')}" placeholder="نص الشريط العاجل..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <select id="an-col" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="amber" ${ann.color === 'amber' ? 'selected' : ''}>ذهبي</option><option value="emerald" ${ann.color === 'emerald' ? 'selected' : ''}>أخضر</option><option value="rose" ${ann.color === 'rose' ? 'selected' : ''}>أحمر</option><option value="sky" ${ann.color === 'sky' ? 'selected' : ''}>أزرق</option></select>
              <select id="an-act" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="none">بدون انتقال</option><option value="inspection" ${ann.action === 'inspection' ? 'selected' : ''}>استلام 3x</option><option value="viplabor" ${ann.action === 'viplabor' ? 'selected' : ''}>عمالة VIP</option><option value="market" ${ann.action === 'market' ? 'selected' : ''}>السوق</option><option value="whatsapp" ${ann.action === 'whatsapp' ? 'selected' : ''}>واتساب</option></select>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <div><label class="text-[9.5px] text-slate-400">اسم التطبيق (عربي)</label><input id="br-ar" type="text" value="${app.esc(br.appNameAr || 'ضمان سايت')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[9.5px] text-slate-400">اسم التطبيق (EN)</label><input id="br-en" type="text" value="${app.esc(br.appNameEn || 'DamanSite')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[9.5px] text-slate-400">الشعار الفرعي (عربي)</label><input id="br-tag-ar" type="text" value="${app.esc(br.taglineAr || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">الشعار الفرعي (EN)</label><input id="br-tag-en" type="text" value="${app.esc(br.taglineEn || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div><label class="text-[9.5px] text-slate-400">سطر الترحيب</label><input id="br-hw" type="text" value="${app.esc(br.heroWelcome || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="text-[9.5px] text-slate-400">العنوان الرئيسي للزوار</label><input id="br-ht" type="text" value="${app.esc(br.heroGuestTitle || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="text-[9.5px] text-slate-400">الوصف الرئيسي</label><textarea id="br-hd" rows="2" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(br.heroGuestDesc || '')}</textarea></div>

            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div class="font-bold text-sky-300 text-[10.5px]">أسماء التبويبات الـ 6 في الشريط السفلي:</div>
              <div class="grid grid-cols-3 gap-1.5">
                <input id="nv-home" type="text" value="${app.esc(nv.navHome || 'الرئيسية')}" class="px-2 py-1 rounded bg-slate-900 text-white text-center" />
                <input id="nv-proj" type="text" value="${app.esc(nv.navProjects || 'السوق')}" class="px-2 py-1 rounded bg-slate-900 text-white text-center" />
                <input id="nv-chat" type="text" value="${app.esc(nv.navChat || 'الشات')}" class="px-2 py-1 rounded bg-slate-900 text-white text-center" />
                <input id="nv-comp" type="text" value="${app.esc(nv.navCompany || 'الشركات')}" class="px-2 py-1 rounded bg-slate-900 text-white text-center" />
                <input id="nv-wal" type="text" value="${app.esc(nv.navWallet || 'المحفظة')}" class="px-2 py-1 rounded bg-slate-900 text-white text-center" />
                <input id="nv-prof" type="text" value="${app.esc(nv.navProfile || 'صفحتي')}" class="px-2 py-1 rounded bg-slate-900 text-white text-center" />
              </div>
            </div>

            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div class="font-bold text-emerald-300 text-[10.5px]">عناوين ووصف الكروت الـ 4 في الرئيسية:</div>
              <div class="grid grid-cols-2 gap-1.5">
                <input id="hc-1t" type="text" value="${app.esc(hc.c1Title || 'السوق والموردين B2B')}" class="px-2 py-1 rounded bg-slate-900 text-white" />
                <input id="hc-1s" type="text" value="${app.esc(hc.c1Sub || 'مشاريع، صنايعية، وموردي خامات')}" class="px-2 py-1 rounded bg-slate-900 text-slate-300" />
                <input id="hc-2t" type="text" value="${app.esc(hc.c2Title || 'استلام هندسي بضمان 3x')}" class="px-2 py-1 rounded bg-slate-900 text-white" />
                <input id="hc-2s" type="text" value="${app.esc(hc.c2Sub || 'استلام شدات وأسقف بضمان 3 أضعاف')}" class="px-2 py-1 rounded bg-slate-900 text-slate-300" />
                <input id="hc-3t" type="text" value="${app.esc(hc.c3Title || 'توريد عمالة VIP')}" class="px-2 py-1 rounded bg-slate-900 text-white" />
                <input id="hc-3s" type="text" value="${app.esc(hc.c3Sub || 'فرق فنية مختبرة بضمان المنصة')}" class="px-2 py-1 rounded bg-slate-900 text-slate-300" />
                <input id="hc-4t" type="text" value="${app.esc(hc.c4Title || 'إدارة الشركات والمواقع')}" class="px-2 py-1 rounded bg-slate-900 text-white" />
                <input id="hc-4s" type="text" value="${app.esc(hc.c4Sub || 'GPS، مستخلصات، إضافي، جرد ورواتب')}" class="px-2 py-1 rounded bg-slate-900 text-slate-300" />
              </div>
            </div>

            <div><label class="text-[9.5px] text-slate-400">نص سياسة الخصوصية والشروط الكامل:</label><textarea id="br-priv" rows="3" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(br.privacyText || '')}</textarea></div>
            <div class="grid grid-cols-2 gap-2 text-[10.5px] font-bold">
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ad-hide-demo" type="checkbox" ${cfg.hideDemoPosts ? 'checked' : ''} class="accent-rose-500" /> إخفاء الـ 20 منشور توضيحي</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ad-hide-off" type="checkbox" ${cfg.hideOfficialBanners ? 'checked' : ''} class="accent-rose-500" /> إخفاء البانرات الرسمية</label>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ وتطبيق كل الحروف والتبويبات فوراً</button>
          </form>

          <form onsubmit="DamanAdmin.addCustomHomeBanner(event)" class="glass-card rounded-2xl p-4 space-y-2 border-emerald-500/40">
            <div class="font-black text-emerald-400">+ إضافة إعلان / بانر خاص على الرئيسية</div>
            <div class="grid grid-cols-2 gap-2">
              <input id="hb-badge" type="text" placeholder="شارة (عرض خاص 🔥)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="hb-theme" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"><option value="amber">ذهبي</option><option value="emerald">أخضر</option><option value="purple">بنفسجي</option><option value="sky">أزرق</option></select>
            </div>
            <input id="hb-title" type="text" required placeholder="عنوان الإعلان" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-bold" />
            <textarea id="hb-sub" rows="2" required placeholder="تفاصيل الإعلان..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <div class="grid grid-cols-2 gap-2">
              <input id="hb-cta" type="text" value="اطلب الآن" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="hb-act" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="admin_chat">شات الإدارة</option><option value="inspection">استلام 3x</option><option value="viplabor">عمالة VIP</option><option value="market">السوق</option><option value="company">الشركات</option><option value="whatsapp">واتساب</option></select>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">نشر البانر على الرئيسية</button>
          </form>

          ${customBanners.map((b) => `<div class="glass-card rounded-xl p-3 flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-white block truncate">${app.esc(b.title)}</b><span class="text-[10px] text-slate-400 truncate block">${app.esc(b.subtitle)}</span></div><button onclick="DamanAdmin.deleteCustomHomeBanner('${b.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px]">حذف</button></div>`).join('')}
        </div>`;
    },

    // ==================== 3. LIVE CHAT SURVEILLANCE, SEARCH & INTERVENTION ====================
    closeAdminChatWatch() {
      if (this.unsubAdminChatWatch) { try { this.unsubAdminChatWatch(); } catch (e) {} this.unsubAdminChatWatch = null; }
      document.getElementById('daman-adm-chat-watch')?.classList.add('hidden');
    },

    openAdminChatWatchModal(chatId) {
      const app = window.DamanApp;
      const chat = this.chats.find((c) => c.id === chatId);
      const title = chat ? Object.values(chat.participantNames || {}).join(' ⇄ ') : chatId;

      if (this.unsubAdminChatWatch) { try { this.unsubAdminChatWatch(); } catch (e) {} this.unsubAdminChatWatch = null; }

      let m = document.getElementById('daman-adm-chat-watch');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-adm-chat-watch';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md h-[88vh] bg-slate-900 border-2 border-purple-500/60 rounded-3xl p-3.5 flex flex-col gap-2 text-xs">
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div class="min-w-0">
              <div class="text-sm font-black text-purple-300 truncate">👁️ مراقبة مباشرة: ${app.esc(title)}</div>
              <div class="text-[10px] text-slate-400">Chat ID: ${app.esc(chatId)} ${chat?.frozen ? '• 🔒 مجمّدة' : '• 🟢 نشطة'}</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="DamanAdmin.toggleFreezeChat('${chatId}',${!!chat?.frozen}); DamanAdmin.closeAdminChatWatch()" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px]">${chat?.frozen ? 'فك التجميد' : 'تجميد'}</button>
              <button onclick="DamanAdmin.closeAdminChatWatch()" class="w-7 h-7 rounded-lg bg-slate-800 text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </div>

          <div id="adm-watch-msgs" class="flex-1 overflow-y-auto space-y-2 p-2 rounded-2xl bg-slate-950 border border-slate-800">
            <div class="text-center text-amber-300 py-8">جارٍ تحميل رسائل المحادثة لحظياً...</div>
          </div>

          <form onsubmit="DamanAdmin.sendAdminInterventionMsg(event,'${chatId}')" class="flex gap-1.5">
            <input id="adm-int-input" type="text" required placeholder="تدخّل واكتب رسالة رسمية كـ (👑 إدارة ضمان سايت)..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/50 text-white" />
            <button type="submit" class="px-3.5 py-2 rounded-xl bg-purple-600 text-white font-black">إرسال</button>
          </form>
        </div>`;

      this.unsubAdminChatWatch = app.db.collection('chats').doc(chatId).collection('messages').limit(150).onSnapshot((snap) => {
        const box = document.getElementById('adm-watch-msgs');
        if (!box) return;
        const msgs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        if (!msgs.length) { box.innerHTML = '<div class="text-center text-slate-500 py-10">لا توجد رسائل في هذه المحادثة بعد.</div>'; return; }
        box.innerHTML = msgs.map((msg) => `
          <div class="p-2.5 rounded-xl ${msg.isAdmin ? 'bg-purple-900/70 border border-amber-400' : 'bg-slate-900 border border-slate-800'} space-y-1">
            <div class="flex justify-between text-[10px]">
              <b class="${msg.isAdmin ? 'text-amber-300' : 'text-sky-300'}">${app.esc(msg.senderName || msg.senderId)}</b>
              <span class="text-slate-500">${app.esc(msg.date || '')} ${app.esc(msg.time || '')}</span>
            </div>
            ${msg.type === 'image' && msg.thumbBase64 ? `<img src="${msg.thumbBase64}" onclick="DamanApp.openMediaLightbox('${msg.mediaId || msg.thumbBase64}','مرفق محادثة')" class="max-h-36 rounded-lg cursor-pointer" />` : ''}
            <div class="text-white whitespace-pre-line leading-relaxed">${app.esc(msg.text || '')}</div>
          </div>`).join('');
        box.scrollTop = box.scrollHeight;
      }, (err) => {
        const box = document.getElementById('adm-watch-msgs');
        if (box) box.innerHTML = `<div class="text-rose-400 text-center py-6">تعذر القراءة: ${app.esc(err.message)}</div>`;
      });
    },

    async sendAdminInterventionMsg(e, chatId) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('adm-int-input');
      const text = inp?.value.trim();
      if (!text) return;
      inp.value = '';
      const chatRef = app.db.collection('chats').doc(chatId);
      await chatRef.collection('messages').add({
        senderId: app.user.uid, senderName: '👑 إدارة ضمان سايت', isAdmin: true,
        type: 'text', text, date: app.todayLocal(),
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await chatRef.update({ lastMessage: `👑 الإدارة: ${text.slice(0, 80)}`, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      await app.logAudit('admin_chat_intervention', `تدخل في الشات ${chatId}`, chatId);
    },

    async toggleFreezeChat(chatId, curFrozen) {
      await window.DamanApp.db.collection('chats').doc(chatId).update({ frozen: !curFrozen });
      this.loadTabData('comms');
    },

    async playCallRecording(recId, mediaId) {
      const slot = document.getElementById('rec-player-' + recId);
      if (!slot) return;
      slot.innerHTML = `<span class="text-[10px] text-amber-300">جارٍ التحميل...</span>`;
      const src = await window.DamanApp.fetchMedia(mediaId);
      slot.innerHTML = src ? `<audio controls autoplay src="${src}" class="w-full h-8 mt-1"></audio>` : `<span class="text-[10px] text-rose-400">غير متاح</span>`;
    },

    async togglePinRecording(recId, curPinned) {
      await window.DamanApp.db.collection('callRecordings').doc(recId).update({ pinned: !curPinned });
      this.loadTabData('comms');
    },

    async cleanupExpiredRecordings() {
      const app = window.DamanApp;
      const snap = await app.db.collection('callRecordings').limit(100).get();
      const expired = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((r) => !r.pinned && Number(r.expiresAt || 0) < Date.now());
      if (!expired.length) return app.toast('لا توجد تسجيلات منتهية (>30 يوم)', 'info');
      if (!window.confirm(`حذف ${expired.length} تسجيل مكالمات منتهي؟`)) return;
      for (const r of expired) {
        if (r.audioMedia) await app.db.collection('mediaVault').doc(r.audioMedia).delete().catch(() => {});
        await app.db.collection('callRecordings').doc(r.id).delete().catch(() => {});
      }
      await app.logAudit('media_cleanup', `حذف ${expired.length} تسجيل منتهي`);
      app.toast(`تم تنظيف ${expired.length} تسجيل ✅`, 'success');
      this.loadTabData(this.subTab);
    },

    async replyTicket(tid, userId) {
      const reply = window.prompt('رد الإدارة على التذكرة:');
      if (!reply) return;
      await window.DamanApp.db.collection('supportTickets').doc(tid).update({ adminReply: reply.trim(), status: 'closed' });
      await window.DamanApp.sendNotification(userId, 'تم الرد على تذكرة الدعم', reply.trim());
      this.loadTabData('comms');
    },

    renderCommsTab(app) {
      const q = app.normalizeAr(this.chatSearch || '');
      const filteredChats = this.chats.filter((c) => !q || app.normalizeAr(`${Object.values(c.participantNames || {}).join(' ')} ${c.lastMessage || ''} ${c.contextTitle || ''}`).includes(q));

      return `
        <div class="space-y-4 text-xs">
          <div class="space-y-2">
            <div class="font-black text-purple-300">👁️ مراقبة كل المحادثات بين المستخدمين (${filteredChats.length})</div>
            <input type="text" value="${app.esc(this.chatSearch || '')}" oninput="DamanAdmin.chatSearch=this.value; DamanAdmin.rerender()" placeholder="بحث باسم أحد الطرفين أو نص آخر رسالة..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            ${!filteredChats.length ? '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد محادثات مطابقة</div>' : filteredChats.map((c) => `
              <div class="glass-card rounded-xl p-3 flex justify-between items-center gap-2 ${c.frozen ? 'border-rose-500/50' : ''}">
                <div class="min-w-0">
                  <div class="font-black text-white truncate">${app.esc(Object.values(c.participantNames || {}).join(' ⇄ '))} ${c.frozen ? '🔒' : ''}</div>
                  <div class="text-[10px] text-slate-400 truncate mt-0.5">${app.esc(c.lastMessage || '')}</div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button onclick="DamanAdmin.openAdminChatWatchModal('${c.id}')" class="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white font-black text-[10px]">👁️ مراقبة وتدخّل</button>
                  <button onclick="DamanAdmin.toggleFreezeChat('${c.id}',${!!c.frozen})" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-rose-300 text-[10px]">${c.frozen ? 'فك' : 'تجميد'}</button>
                </div>
              </div>`).join('')}
            <button onclick="DamanAdmin.loadMore('comms')" class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">تحميل المزيد</button>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between items-center"><span class="font-black text-amber-400">🎙️ تسجيلات المكالمات (${this.callRecordings.length})</span><button onclick="DamanAdmin.cleanupExpiredRecordings()" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">تنظيف المنتهي</button></div>
            ${this.callRecordings.map((r) => `<div class="glass-card rounded-xl p-2.5 space-y-1.5"><div class="flex justify-between"><b class="text-white">${app.esc(r.callerName)} ⇄ ${app.esc(r.otherName)} (${r.durationSec || 0}ث)</b><span class="text-slate-400">${app.esc(r.date || '')}</span></div><div class="flex gap-1.5"><button onclick="DamanAdmin.playCallRecording('${r.id}','${r.audioMedia || ''}')" class="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">▶ تشغيل</button><button onclick="DamanAdmin.togglePinRecording('${r.id}',${!!r.pinned})" class="px-3 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">${r.pinned ? '📌 مثبّت' : 'تثبيت'}</button></div><div id="rec-player-${r.id}"></div></div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد تسجيلات</div>'}
          </div>

          <div class="space-y-2">
            <div class="font-black text-sky-400">🎫 التذاكر المفتوحة</div>
            ${this.tickets.filter((t) => t.status === 'open').map((t) => `<div class="glass-card rounded-xl p-3 space-y-1"><div class="font-black text-white">${app.esc(t.subject)} — ${app.esc(t.userName)}</div><div class="text-[11px] text-slate-300">${app.esc(t.message)}</div><button onclick="DamanAdmin.replyTicket('${t.id}','${t.userId}')" class="px-3 py-1 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">رد وإغلاق</button></div>`).join('') || '<div class="text-slate-400 text-center">لا توجد تذاكر مفتوحة ✅</div>'}
          </div>
        </div>`;
    }
  };

  if (window.DamanAdmin && typeof window.DamanAdmin.registerExtension === 'function') {
    window.DamanAdmin.registerExtension(1, AdminExt1);
  } else {
    window.__damanAdminExtQueue = window.__damanAdminExtQueue || [];
    window.__damanAdminExtQueue.push([1, AdminExt1]);
  }
})();
