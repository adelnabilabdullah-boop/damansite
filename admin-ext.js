(function () {
  if (!window.DamanAdmin) return;

  const AdminExt = {
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
          <div class="flex justify-between items-center"><h3 class="text-sm font-black text-purple-300">${ex ? '✏️ تعديل باقة التمييز' : '+ إضافة باقة وميزة تمييز جديدة'}</h3><button onclick="document.getElementById('daman-adm-bpkg-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
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
              <div><label class="text-[10px] text-slate-400">لون الإطار والشارة</label>
                <select id="bp-color" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="amber" ${ex?.color === 'amber' ? 'selected' : ''}>ذهبي</option>
                  <option value="purple" ${ex?.color === 'purple' ? 'selected' : ''}>ماسي بنفسجي</option>
                  <option value="emerald" ${ex?.color === 'emerald' ? 'selected' : ''}>أخضر زمردي</option>
                  <option value="sky" ${ex?.color === 'sky' ? 'selected' : ''}>أزرق فضي</option>
                  <option value="rose" ${ex?.color === 'rose' ? 'selected' : ''}>أحمر عاجل</option>
                </select>
              </div>
              <label class="flex items-center gap-1.5 pt-4 text-[10.5px] font-bold text-emerald-300"><input id="bp-home" type="checkbox" ${ex ? (ex.showOnHome ? 'checked' : '') : 'checked'} class="accent-emerald-500" /> يظهر في الرئيسية</label>
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
      const catsOpt = app.CATEGORIES.map((c) => `<option value="${c.id}" ${p.category === c.id ? 'selected' : ''}>${app.esc(c.ar)}</option>`).join('');
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
          <div class="flex justify-between items-center"><h3 class="text-sm font-black text-amber-400">✏️ تعديل ونقل وتمييز الإعلان</h3><button onclick="document.getElementById('daman-adm-proj-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="text-[10.5px] text-slate-400">المشاهدات الحالية: <b class="text-sky-300">👁️ ${Number(p.views || 0)}</b> • المعلن: <b class="text-white">${app.esc(p.ownerName || '')}</b></div>
          <form onsubmit="DamanAdmin.saveProjectAdminEdit(event,'${p.id}')" class="space-y-2">
            <div><label class="text-[10px] text-slate-400">عنوان الإعلان *</label><input id="ap-title" type="text" required value="${app.esc(p.title || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-amber-300">نقل لقسم / تخصص آخر *</label><select id="ap-cat" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">${catsOpt}</select></div>
              <div><label class="text-[10px] text-sky-300">نوع الإعلان *</label>
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
              <div><label class="text-[10px] text-slate-400">حالة النشر</label>
                <select id="ap-status" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold">
                  <option value="approved" ${p.status === 'approved' ? 'selected' : ''}>منشور ✅</option>
                  <option value="pending_review" ${p.status === 'pending_review' ? 'selected' : ''}>قيد المراجعة ⏳</option>
                  <option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>مرفوض ❌</option>
                  <option value="closed" ${p.status === 'closed' ? 'selected' : ''}>مغلق 🔒</option>
                </select>
              </div>
              <div><label class="text-[10px] text-purple-300">باقة التمييز المطبّقة</label>
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
      const patch = {
        title: document.getElementById('ap-title').value.trim(),
        category: document.getElementById('ap-cat').value,
        postType: document.getElementById('ap-type').value,
        budget: parseFloat(document.getElementById('ap-budget').value) || 0,
        city: document.getElementById('ap-city').value.trim(),
        status: document.getElementById('ap-status').value,
        description: document.getElementById('ap-desc').value.trim()
      };
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
      await app.db.collection('projects').doc(pid).update({ status });
      if (p) await app.sendNotification(p.ownerId, status === 'approved' ? '✅ تم نشر إعلانك' : '❌ تم رفض إعلانك', p.title);
      await app.logAudit('market_moderate', `${status}: ${p?.title || pid}`, pid);
      app.toast('تم التحديث ✅', 'success');
      this.loadTabData('market');
    },

    async deleteProjectAdmin(pid) {
      if (!window.confirm('حذف هذا الإعلان نهائياً من السوق؟')) return;
      await window.DamanApp.db.collection('projects').doc(pid).delete();
      this.loadTabData('market');
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
      const catAr = (id) => (app.CATEGORIES.find((c) => c.id === id) || {}).ar || id;

      return `
        <div class="space-y-4 text-xs">
          <!-- Publish Ad Directly from Admin + Manage Boost Packages -->
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
            ${!pendingPosts.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد إعلانات معلّقة</div>` : pendingPosts.map((p) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5 border-amber-500/40">
                <div class="font-black text-white">${app.esc(p.title)} (${app.esc(p.ownerName)})</div>
                <div class="text-[10px] text-amber-300">القسم: ${app.esc(catAr(p.category))} • 👁️ ${Number(p.views || 0)} مشاهدة</div>
                <p class="text-[11px] text-slate-300">${app.esc(p.description)}</p>
                <div class="grid grid-cols-3 gap-1.5">
                  <button onclick="DamanAdmin.moderateProject('${p.id}','approved')" class="py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ نشر</button>
                  <button onclick="DamanAdmin.openEditProjectAdminModal('${p.id}')" class="py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black">✏️ نقل/تعديل</button>
                  <button onclick="DamanAdmin.moderateProject('${p.id}','rejected')" class="py-1.5 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
                </div>
              </div>`).join('')}
          </div>

          <div class="space-y-2">
            <div class="font-black text-emerald-400">🛡️ الاستلام الهندسي 3x (${this.inspections.length})</div>
            ${this.inspections.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.element)} — ${app.esc(r.userName)}</b><span class="text-amber-300 font-bold">${this.statusAr(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.location)} • ${app.esc(r.userPhone || '')}</div>
                <div class="flex flex-wrap gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteInspection('${r.id}')" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">تسعير</button>` : ''}
                  ${r.status === 'paid' ? `<label class="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] cursor-pointer">📄 رفع التقرير الهندسي<input type="file" accept="image/*" class="hidden" onchange="DamanAdmin.uploadInspectionReport(this,'${r.id}')" /></label>` : ''}
                  ${r.reportMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.reportMedia}','التقرير الهندسي')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">التقرير</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد طلبات</div>'}
          </div>

          <div class="space-y-2">
            <div class="font-black text-purple-300">👷 عمالة VIP (${this.vipLabors.length})</div>
            ${this.vipLabors.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.trade)} (${r.workersCount} عامل × ${r.days} يوم)</b><span class="text-purple-300 font-bold">${this.statusAr(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.userName)} • ${app.esc(r.location)}</div>
                <div class="flex gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteVipLabor('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-purple-500 text-white font-black text-[10px]">تسعير (+ VIP)</button>` : ''}
                  ${r.status === 'funded' ? `<button onclick="DamanAdmin.settleVipLabor('${r.id}','settle')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">✅ تسوية</button><button onclick="DamanAdmin.settleVipLabor('${r.id}','refund')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">ردّ</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد طلبات</div>'}
          </div>

          <div class="space-y-1.5">
            <div class="font-black text-slate-300">كل إعلانات السوق — نقل قسم / تمييز / مشاهدات (${this.projects.length})</div>
            ${this.projects.slice(0, 25).map((p) => {
              const boosted = Number(p.boostedUntil || 0) > Date.now();
              return `
                <div class="glass-card rounded-xl p-2.5 flex justify-between items-center gap-2">
                  <div class="min-w-0">
                    <span class="truncate text-white font-bold block">${boosted ? (p.boostBadge || '★') + ' ' : ''}${app.esc(p.title)}</span>
                    <span class="text-[9.5px] text-slate-400">${app.esc(catAr(p.category))} • 👁️ ${Number(p.views || 0)} مشاهدة • ${this.statusAr(p.status)}</span>
                  </div>
                  <div class="flex gap-1 shrink-0">
                    <button onclick="DamanAdmin.openEditProjectAdminModal('${p.id}')" class="px-2 py-1 rounded bg-amber-500 text-slate-950 text-[10px] font-black">نقل/تمييز</button>
                    <button onclick="DamanAdmin.deleteProjectAdmin('${p.id}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px]">حذف</button>
                  </div>
                </div>`;
            }).join('')}
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

    // ==================== 3. LIVE CHAT SURVEILLANCE & INTERVENTION ====================
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
      return `
        <div class="space-y-4 text-xs">
          <div class="space-y-2">
            <div class="font-black text-purple-300">👁️ مراقبة كل المحادثات بين المستخدمين (${this.chats.length})</div>
            ${!this.chats.length ? '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد محادثات بعد</div>' : this.chats.map((c) => `
              <div class="glass-card rounded-xl p-3 flex justify-between items-center gap-2 ${c.frozen ? 'border-rose-500/50' : ''}">
                <div class="min-w-0">
                  <div class="font-black text-white truncate">${app.esc(Object.values(c.participantNames || {}).join(' ⇄ '))} ${c.frozen ? '🔒' : ''}</div>
                  <div class="text-[10px] text-slate-400 truncate mt-0.5">${app.esc(c.lastMessage || '')}</div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button onclick="DamanAdmin.openAdminChatWatchModal('${c.id}')" class="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white font-black text-[10px]">👁️ مراقبة وتدخّل</button>
                  <button onclick="DamanAdmin.toggleFreezeChat('${c.id}',${!!c.frozen})" class="px-2 py-1.5 rounded-lg bg-slate-800 text-rose-300 text-[10px]">${c.frozen ? 'فك' : 'تجميد'}</button>
                </div>
              </div>`).join('')}
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
    },

    // ==================== 4. COMPANIES 360° ====================
    async toggleCompanyStatus(compId, curSt) {
      if (!window.DamanApp.isAdmin()) return;
      const next = curSt === 'suspended' ? 'active' : 'suspended';
      await window.DamanApp.db.collection('companies').doc(compId).update({ status: next });
      window.DamanApp.toast(next === 'suspended' ? 'تم إيقاف الشركة' : 'تم التفعيل ✅', 'info');
      this.loadTabData('companies');
    },

    async openCompanyControlModal(compId) {
      const app = window.DamanApp;
      const comp = this.companies.find((c) => c.id === compId) || (await app.db.collection('companies').doc(compId).get()).data();
      if (!comp) return;
      let m = document.getElementById('daman-admin-comp-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-admin-comp-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-5 text-center text-xs text-slate-300">جارٍ التحميل...</div>`;
      const [memSnap, cusSnap, repSnap] = await Promise.all([
        app.db.collection('companyMembers').where('companyId', '==', compId).limit(100).get(),
        app.db.collection('companyCustody').where('companyId', '==', compId).limit(40).get(),
        app.db.collection('companyDailyReports').where('companyId', '==', compId).limit(20).get()
      ]);
      const mems = memSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      const custs = cusSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      const reps = repSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-purple-300">👑 ${app.esc(comp.name)}</h3><button onclick="document.getElementById('daman-admin-comp-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          ${app.isAdmin() ? `
            <form onsubmit="DamanAdmin.saveCompanyMetaEdit(event,'${compId}')" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <input id="ac-name" type="text" required value="${app.esc(comp.name || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
              <div class="grid grid-cols-2 gap-1.5"><input id="ac-cr" type="text" value="${app.esc(comp.commercialReg || '')}" placeholder="سجل تجاري" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /><input id="ac-tax" type="text" value="${app.esc(comp.taxCard || '')}" placeholder="بطاقة ضريبية" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
              <button type="submit" class="w-full py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black">حفظ بيانات الشركة</button>
            </form>` : ''}
          <form onsubmit="DamanAdmin.sendAdminCompanyMsg(event,'${compId}')" class="flex gap-1.5"><input id="adm-comp-msg" type="text" required placeholder="رسالة رسمية لجروب الشركة..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white" /><button type="submit" class="px-3 py-2 rounded-xl bg-purple-500 text-white font-black">إرسال</button></form>
          <div class="font-black text-amber-400">الأعضاء (${mems.length})</div>
          ${mems.map((mem) => `<div class="p-2 rounded-xl bg-slate-950 flex justify-between items-center"><div><b class="text-white">${app.esc(mem.name)}</b> <span class="text-slate-400">(${app.esc(mem.jobTitle || '')})</span></div><div class="flex gap-1"><button onclick="DamanAdmin.adminEditCompMemberSalary('${mem.id}','${compId}',${Number(mem.baseSalary || 0)})" class="px-2 py-1 rounded bg-slate-800 text-amber-300 text-[10px]">راتب: ${app.fmtMoney(mem.baseSalary || 0)}</button></div></div>`).join('')}
          <div class="font-black text-sky-400">العهدة (${custs.length}) والتقارير (${reps.length})</div>
          ${custs.slice(0, 5).map((c) => `<div class="p-1.5 rounded bg-slate-950 flex justify-between text-[10px]"><span>🧾 ${app.esc(c.holderName)}: ${app.esc(c.note)}</span><b class="text-amber-300">${app.fmtMoney(c.amount)}</b></div>`).join('')}
        </div>`;
    },

    async saveCompanyMetaEdit(e, compId) {
      e.preventDefault();
      await window.DamanApp.db.collection('companies').doc(compId).update({ name: document.getElementById('ac-name').value.trim(), commercialReg: document.getElementById('ac-cr').value.trim(), taxCard: document.getElementById('ac-tax').value.trim() });
      window.DamanApp.toast('تم حفظ بيانات الشركة ✅', 'success');
      this.loadTabData('companies');
    },

    async sendAdminCompanyMsg(e, compId) {
      e.preventDefault();
      const inp = document.getElementById('adm-comp-msg');
      if (!inp?.value.trim()) return;
      await window.DamanApp.db.collection('companyMessages').add({ companyId: compId, senderId: window.DamanApp.user.uid, senderName: '👑 إدارة ضمان سايت', isPlatformAdmin: true, text: inp.value.trim(), date: window.DamanApp.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      inp.value = '';
      window.DamanApp.toast('تم الإرسال ✅', 'success');
    },

    async adminEditCompMemberSalary(memId, compId, curSal) {
      const nv = parseFloat(window.prompt('الراتب الأساسي الجديد:', curSal));
      if (isNaN(nv) || nv < 0) return;
      await window.DamanApp.db.collection('companyMembers').doc(memId).update({ baseSalary: nv });
      this.openCompanyControlModal(compId);
    },

    renderCompaniesTab(app) {
      return `
        <div class="space-y-2.5 text-xs">
          <div class="font-black text-sky-400">🏢 الشركات المسجّلة (${this.companies.length})</div>
          ${!this.companies.length ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد شركات بعد.</div>` : this.companies.map((c) => `
            <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 ${c.status === 'suspended' ? 'border-rose-500/50 opacity-75' : ''}">
              <div class="min-w-0"><div class="font-black text-white truncate">${app.esc(c.name)} ${c.status === 'suspended' ? '🚫' : ''}</div><div class="text-[10px] text-amber-300">الكود: ${app.esc(c.code)} • ${app.esc(c.ownerName || '')}</div></div>
              <div class="flex gap-1 shrink-0"><button onclick="DamanAdmin.openCompanyControlModal('${c.id}')" class="px-2.5 py-1.5 rounded-xl bg-purple-500 text-white font-black text-[10px]">تحكّم 360°</button>${app.isAdmin() ? `<button onclick="DamanAdmin.toggleCompanyStatus('${c.id}','${c.status || 'active'}')" class="px-2 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[10px]">${c.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button>` : ''}</div>
            </div>`).join('')}
        </div>`;
    },

    // ==================== 5. USERS 360° + PROMOS + BLACKLIST ====================
    async openUser360Modal(uid) {
      const app = window.DamanApp;
      let m = document.getElementById('daman-user360-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-user360-modal';
        m.className = 'daman-modal fixed inset-0 z-[92] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-6 text-center text-xs text-amber-300">جارٍ تحميل ملف 360°...</div>`;

      const [uDoc, kycDoc, txSnap, agSnap] = await Promise.all([
        app.db.collection('users').doc(uid).get(),
        app.db.collection('kycRequests').doc(uid).get().catch(() => null),
        app.db.collection('transactions').where('userId', '==', uid).limit(15).get(),
        app.db.collection('chatAgreements').where('participants', 'array-contains', uid).limit(10).get()
      ]);
      if (!uDoc.exists) return m.classList.add('hidden');
      const u = Object.assign({ id: uDoc.id }, uDoc.data());
      const kyc = kycDoc && kycDoc.exists ? kycDoc.data() : null;
      const txs = this.sortDesc(txSnap.docs.map((d) => d.data()));
      const ags = this.sortDesc(agSnap.docs.map((d) => d.data()));

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">🔎 ملف 360°: ${app.esc(u.name)}</h3><button onclick="document.getElementById('daman-user360-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="grid grid-cols-4 gap-1.5 text-center text-[10px]">
            <div class="p-1.5 rounded-xl bg-slate-950 border border-emerald-500/40"><div class="text-slate-400">كاش</div><b class="text-emerald-400">${app.fmtMoney(u.balanceAvailable || 0)}</b></div>
            <div class="p-1.5 rounded-xl bg-slate-950 border border-amber-500/40"><div class="text-slate-400">ضمان</div><b class="text-amber-400">${app.fmtMoney(u.balanceEscrow || 0)}</b></div>
            <div class="p-1.5 rounded-xl bg-slate-950 border border-purple-500/40"><div class="text-slate-400">هدايا</div><b class="text-purple-300">${app.fmtMoney(u.balanceBonus || 0)}</b></div>
            <div class="p-1.5 rounded-xl bg-slate-950 border border-rose-500/40"><div class="text-slate-400">مجمّد</div><b class="text-rose-400">${app.fmtMoney(u.balanceFrozen || 0)}</b></div>
          </div>
          ${kyc ? `<div class="p-2 rounded-xl bg-slate-950 border border-amber-500/30 flex flex-wrap gap-1.5">${kyc.idFrontMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.idFrontMedia}','وش البطاقة')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">🪪 وش</button>` : ''}${kyc.idBackMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.idBackMedia}','ضهر البطاقة')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">🪪 ضهر</button>` : ''}${kyc.selfieMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.selfieMedia}','سيلفي')" class="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">🤳 سيلفي</button>` : ''}${kyc.crMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.crMedia}','السجل التجاري')" class="px-2 py-1 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">📄 سجل</button>` : ''}</div>` : ''}

          ${app.isAdmin() ? `
            <form onsubmit="DamanAdmin.saveUserFullProfileEdit(event,'${uid}')" class="p-2.5 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-1.5">
              <div class="font-black text-sky-400">✏️ تعديل بيانات المستخدم والبطاقة</div>
              <div class="grid grid-cols-2 gap-1.5">
                <input id="ue-name" type="text" value="${app.esc(u.name || '')}" placeholder="اسم العرض" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                <input id="ue-phone" type="text" value="${app.esc(u.phone || '')}" placeholder="الموبايل" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                <input id="ue-legal" type="text" value="${app.esc(u.legalName || '')}" placeholder="الرباعي" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                <input id="ue-nid" type="text" maxlength="14" value="${app.esc(u.nationalId || '')}" placeholder="الرقم القومي" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-bold" />
                <input id="ue-bday" type="date" value="${app.esc(u.birthDate || '')}" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                <select id="ue-kyc" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-300 font-bold"><option value="verified" ${u.kycStatus === 'verified' ? 'selected' : ''}>موثّق ✅</option><option value="pending" ${u.kycStatus === 'pending' ? 'selected' : ''}>مراجعة</option><option value="rejected" ${u.kycStatus === 'rejected' ? 'selected' : ''}>مرفوض</option><option value="none" ${!u.kycStatus || u.kycStatus === 'none' ? 'selected' : ''}>غير موثّق</option></select>
              </div>
              <input id="ue-addr" type="text" value="${app.esc(u.legalAddress || '')}" placeholder="العنوان بالبطاقة" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
              <button type="submit" class="w-full py-1.5 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ تعديلات البيانات</button>
            </form>

            <form onsubmit="DamanAdmin.applyManualBalance(event,'${uid}')" class="p-2.5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-1.5">
              <div class="font-black text-emerald-400">💰 تعديل / تجميد رصيد (بقيد مزدوج)</div>
              <div class="grid grid-cols-2 gap-1.5">
                <select id="mb-mode" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-[10px]"><option value="bonus_add">+ هدايا</option><option value="cash_gift">+ كاش (من الأرباح)</option><option value="cash_vf">+ إيداع كاش (محفظة)</option><option value="cash_ip">+ إيداع كاش (إنستا)</option><option value="cash_bk">+ إيداع كاش (بنك)</option><option value="cash_deduct">- خصم كاش</option><option value="freeze">🔒 تجميد</option><option value="unfreeze">🔓 فك تجميد</option></select>
                <input id="mb-amt" type="number" min="1" step="any" required placeholder="المبلغ" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-white font-black" />
              </div>
              <input id="mb-note" type="text" required placeholder="السبب..." class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
              <button type="submit" class="w-full py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black">تنفيذ القيد</button>
            </form>

            <form onsubmit="DamanAdmin.saveUserGodSettings(event,'${uid}')" class="p-2.5 rounded-2xl bg-slate-950 border border-purple-500/40 space-y-1.5">
              <div class="grid grid-cols-2 gap-1.5">
                <div><label class="text-[9.5px] text-slate-400">عمولة مخصصة %</label><input id="u3-comm" type="number" step="0.1" value="${u.customCommissionRate != null && u.customCommissionRate !== '' ? (Number(u.customCommissionRate) * 100).toFixed(2) : ''}" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
                <div><label class="text-[9.5px] text-slate-400">إضافة أيام VIP</label><input id="u3-vip" type="number" min="0" value="0" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
              </div>
              <input id="u3-crm" type="text" value="${app.esc(u.adminCrmNote || '')}" placeholder="ملاحظة سرية للإدارة فقط" class="w-full px-2 py-1.5 rounded bg-slate-900 text-amber-200" />
              <button type="submit" class="w-full py-1.5 rounded-xl bg-purple-500 text-white font-black">حفظ العمولة والـ VIP</button>
            </form>` : ''}

          <div class="grid grid-cols-3 gap-1.5">
            <button onclick="DamanAdmin.sendDirectNotif('${uid}','${app.esc(u.name).replace(/'/g, "\\'")}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">🔔 إشعار</button>
            <button onclick="DamanAdmin.revokeUserKyc('${uid}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">إلغاء توثيق</button>
            <button onclick="DamanAdmin.toggleBanUser('${uid}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">${u.status === 'banned' ? 'فك حظر' : 'حظر'}</button>
          </div>
          <div class="space-y-1 max-h-32 overflow-y-auto">${ags.map((a) => `<div class="p-1.5 rounded bg-slate-950 text-[10px] flex justify-between"><span>📄 ${app.esc(a.ticketNumber)}</span><b class="text-amber-300">${app.fmtMoney(a.totalAmount)}</b></div>`).join('')}${txs.slice(0, 8).map((t) => `<div class="p-1.5 rounded bg-slate-950 text-[10px] flex justify-between"><span>${app.esc(t.note || t.type)}</span><b class="${Number(t.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${app.fmtMoney(t.amount)}</b></div>`).join('')}</div>
        </div>`;
    },

    async saveUserFullProfileEdit(e, uid) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.db.collection('users').doc(uid).update({
        name: document.getElementById('ue-name').value.trim(),
        phone: app.normalizePhone(document.getElementById('ue-phone').value),
        legalName: document.getElementById('ue-legal').value.trim(),
        nationalId: document.getElementById('ue-nid').value.replace(/\D/g, ''),
        birthDate: document.getElementById('ue-bday').value,
        kycStatus: document.getElementById('ue-kyc').value,
        legalAddress: document.getElementById('ue-addr').value.trim()
      });
      await app.logAudit('admin_edit_user', `تعديل بيانات ${uid}`, uid);
      app.toast('تم حفظ بيانات المستخدم ✅', 'success');
      this.openUser360Modal(uid);
    },

    async applyManualBalance(e, uid) {
      e.preventDefault();
      const app = window.DamanApp;
      const mode = document.getElementById('mb-mode').value;
      const amt = Math.round((parseFloat(document.getElementById('mb-amt').value) || 0) * 100) / 100;
      const note = document.getElementById('mb-note').value.trim();
      if (amt <= 0 || !note) return;
      const uRef = app.db.collection('users').doc(uid);
      try {
        await app.db.runTransaction(async (tx) => {
          const u = (await tx.get(uRef)).data() || {};
          const curA = Number(u.balanceAvailable || 0), curB = Number(u.balanceBonus || 0), curF = Number(u.balanceFrozen || 0);
          if (mode === 'bonus_add') {
            tx.update(uRef, { balanceBonus: Math.round((curB + amt) * 100) / 100 });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_bonus', isBonus: true, amount: amt, note, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'cash_gift') {
            tx.update(uRef, { balanceAvailable: Math.round((curA + amt) * 100) / 100 });
            tx.set(app.db.collection('adminExpenses').doc(), { amount: amt, category: 'user_gift', channel: 'none', note: `هدية كاش: ${u.name} — ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_gift', amount: amt, balanceBefore: curA, balanceAfter: Math.round((curA + amt) * 100) / 100, note, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'cash_deduct') {
            if (curA < amt) throw new Error('الرصيد لا يكفي');
            tx.update(uRef, { balanceAvailable: Math.round((curA - amt) * 100) / 100 });
            tx.set(app.db.collection('platformFees').doc(), { type: 'admin_adjustment', userId: uid, amount: amt, cashPaid: amt, bonusUsed: 0, note, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_deduct', amount: -amt, balanceBefore: curA, balanceAfter: Math.round((curA - amt) * 100) / 100, note, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode.startsWith('cash_')) {
            const ch = mode === 'cash_vf' ? 'vodafone_cash' : mode === 'cash_ip' ? 'instapay' : 'bank';
            tx.update(uRef, { balanceAvailable: Math.round((curA + amt) * 100) / 100 });
            tx.set(app.db.collection('walletRequests').doc(), { type: 'deposit', userId: uid, userName: u.name || '', channel: ch, amount: amt, actualAmount: amt, txRef: 'MANUAL-' + Date.now(), adminNote: note, status: 'approved', date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'deposit_approved', amount: amt, balanceBefore: curA, balanceAfter: Math.round((curA + amt) * 100) / 100, note, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'freeze') {
            if (curA < amt) throw new Error('المتاح لا يكفي');
            tx.update(uRef, { balanceAvailable: Math.round((curA - amt) * 100) / 100, balanceFrozen: Math.round((curF + amt) * 100) / 100, frozenReason: note });
          } else if (mode === 'unfreeze') {
            if (curF < amt) throw new Error('المجمّد أقل من ذلك');
            tx.update(uRef, { balanceAvailable: Math.round((curA + amt) * 100) / 100, balanceFrozen: Math.max(0, Math.round((curF - amt) * 100) / 100) });
          }
        });
        await app.logAudit('manual_balance', `${mode} ${amt}: ${note}`, uid);
        app.toast('تم تنفيذ القيد المالي ✅', 'success');
        this.openUser360Modal(uid);
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async saveUserGodSettings(e, uid) {
      e.preventDefault();
      const app = window.DamanApp;
      const commRaw = document.getElementById('u3-comm').value.trim();
      const vipDays = parseInt(document.getElementById('u3-vip').value, 10) || 0;
      const patch = { customCommissionRate: commRaw !== '' ? Number(commRaw) / 100 : '', adminCrmNote: document.getElementById('u3-crm').value.trim() };
      if (vipDays > 0) {
        const curExp = Number(((await app.db.collection('users').doc(uid).get()).data() || {}).subscriptionExpiresAt || 0);
        patch.subscriptionExpiresAt = Math.max(Date.now(), curExp) + vipDays * 86400000;
      }
      await app.db.collection('users').doc(uid).update(patch);
      app.toast('تم الحفظ ✅', 'success');
      this.openUser360Modal(uid);
    },

    async sendDirectNotif(uid, name) {
      const title = window.prompt(`إشعار إلى ${name}:`, 'رسالة من الإدارة');
      if (!title) return;
      const body = window.prompt('نص الإشعار:');
      if (!body) return;
      await window.DamanApp.sendNotification(uid, title.trim(), body.trim());
      window.DamanApp.toast('تم الإرسال ✅', 'success');
    },

    async revokeUserKyc(uid) {
      const r = window.prompt('سبب إلغاء التوثيق:', 'يرجى تحديث صور البطاقة');
      if (!r) return;
      await window.DamanApp.db.collection('users').doc(uid).update({ kycStatus: 'rejected', kycRejectionReason: r });
      window.DamanApp.toast('تم إلغاء التوثيق', 'info');
    },

    async sendBroadcastNotification(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const seg = document.getElementById('bc-seg').value;
      const title = document.getElementById('bc-title').value.trim();
      const body = document.getElementById('bc-body').value.trim();
      const targets = this.users.filter((u) => seg === 'all' || u.accountType === seg);
      if (!window.confirm(`إرسال إلى ${targets.length} مستخدم؟`)) return;
      await Promise.all(targets.map((u) => app.sendNotification(u.id, title, body)));
      e.target.reset();
      app.toast(`تم الإرسال لـ ${targets.length} مستخدم 📢`, 'success');
    },

    async toggleBanUser(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      const ban = u.status !== 'banned';
      const reason = ban ? (window.prompt('سبب الحظر:', 'مخالفة الشروط') || 'مخالفة') : '';
      await app.db.collection('users').doc(uid).update({ status: ban ? 'banned' : 'active', banReason: reason });
      app.toast(ban ? 'تم الحظر' : 'تم فك الحظر ✅', 'info');
      this.loadTabData('users');
    },

    async deleteUserSafely(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || Number(u.balanceAvailable || 0) > 0 || Number(u.balanceEscrow || 0) > 0 || Number(u.balancePendingWithdraw || 0) > 0) return app.toast('ممنوع حذف مستخدم لديه رصيد!', 'error');
      if (!window.confirm(`حذف «${u.name}»؟`)) return;
      await app.db.collection('users').doc(uid).delete();
      this.loadTabData('users');
    },

    async addBlacklistEntry(e) {
      e.preventDefault();
      await window.DamanApp.db.collection('blacklist').add({ value: document.getElementById('bl-val').value.trim(), reason: document.getElementById('bl-reason').value.trim() || 'حظر دائم', date: window.DamanApp.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      e.target.reset();
      this.loadTabData('users');
    },

    async removeBlacklist(id) { await window.DamanApp.db.collection('blacklist').doc(id).delete(); this.loadTabData('users'); },

    async createPromoCode(e) {
      e.preventDefault();
      const code = document.getElementById('pr-code').value.trim().toUpperCase();
      await window.DamanApp.db.collection('promoCodes').doc(code).set({ code, amount: parseFloat(document.getElementById('pr-amt').value) || 0, maxUses: parseInt(document.getElementById('pr-max').value, 10) || 10, usedBy: [], active: true, expiresAt: Date.now() + 30 * 86400000, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      e.target.reset();
      this.loadTabData('users');
    },

    async togglePromoCode(code, cur) { await window.DamanApp.db.collection('promoCodes').doc(code).update({ active: !cur }); this.loadTabData('users'); },
    async deletePromoCode(code) { if (!window.confirm('حذف الكود؟')) return; await window.DamanApp.db.collection('promoCodes').doc(code).delete(); this.loadTabData('users'); },
    async resolveReport(id, st) { await window.DamanApp.db.collection('reports').doc(id).update({ status: st }); this.loadTabData('users'); },

    renderUsersTab(app) {
      const q = app.normalizeAr(this.userSearch);
      const filtered = this.users.filter((u) => !q || app.normalizeAr(`${u.name} ${u.legalName} ${u.phone} ${u.nationalId} ${u.email}`).includes(q));
      const openReports = this.reports.filter((r) => r.status === 'open');
      return `
        <div class="space-y-3 text-xs">
          ${app.isAdmin() ? `
            <form onsubmit="DamanAdmin.sendBroadcastNotification(event)" class="glass-card rounded-2xl p-3 space-y-2 border-purple-500/40">
              <div class="font-black text-purple-300">📣 إشعار جماعي فوري</div>
              <div class="grid grid-cols-2 gap-1.5"><select id="bc-seg" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold"><option value="all">الكل (${this.users.length})</option><option value="company">الشركات</option><option value="supplier">الموردين</option><option value="individual">الأفراد</option></select><input id="bc-title" type="text" required placeholder="العنوان" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <input id="bc-body" type="text" required placeholder="نص الإشعار الجماعي..." class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">إرسال للجميع</button>
            </form>` : ''}
          ${openReports.length ? `<div class="space-y-1">${openReports.map((r) => `<div class="glass-card rounded-xl p-2 border-rose-500/40 flex justify-between"><span>🚨 ${app.esc(r.targetTitle)}: ${app.esc(r.reason)}</span><button onclick="DamanAdmin.resolveReport('${r.id}','closed')" class="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 text-[10px]">إغلاق</button></div>`).join('')}</div>` : ''}
          <input type="text" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالاسم / القومي / الموبايل..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          ${filtered.map((u) => `<div class="glass-card rounded-2xl p-3 space-y-1"><div class="flex justify-between"><b class="text-white">${app.esc(u.name)} ${u.kycStatus === 'verified' ? '✅' : ''} ${u.status === 'banned' ? '🚫' : ''}</b><span class="text-emerald-400 font-bold">كاش: ${app.fmtMoney(u.balanceAvailable || 0)}</span></div><div class="text-[10px] text-slate-400">${app.esc(u.phone || '')} • قومي: ${app.esc(u.nationalId || '—')}</div><div class="flex gap-1.5 pt-1"><button onclick="DamanAdmin.openUser360Modal('${u.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">🔎 ملف 360° وتعديل كامل</button><button onclick="DamanAdmin.deleteUserSafely('${u.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-[10px]">حذف</button></div></div>`).join('')}

          <form onsubmit="DamanAdmin.addBlacklistEntry(event)" class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/40">
            <div class="font-black text-rose-400">🚫 القائمة السوداء (${this.blacklist.length})</div>
            <div class="grid grid-cols-2 gap-1.5"><input id="bl-val" type="text" required placeholder="رقم قومي / موبايل / إيميل" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /><input id="bl-reason" type="text" placeholder="السبب" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            <button type="submit" class="w-full py-1.5 rounded-lg bg-rose-500 text-white font-black">إضافة للحظر</button>
            <div class="flex flex-wrap gap-1">${this.blacklist.map((b) => `<span class="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-rose-300">${app.esc(b.value)} <button type="button" onclick="DamanAdmin.removeBlacklist('${b.id}')" class="text-white ms-1">×</button></span>`).join('')}</div>
          </form>

          <form onsubmit="DamanAdmin.createPromoCode(event)" class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🎁 أكواد الهدايا (${this.promoCodes.length})</div>
            <div class="grid grid-cols-3 gap-1.5"><div><label class="text-[9.5px] text-slate-400">الكود</label><input id="pr-code" type="text" required placeholder="DAMAN50" class="w-full px-2 py-1 rounded bg-slate-950 text-white uppercase font-bold" /></div><div><label class="text-[9.5px] text-slate-400">المبلغ ج.م</label><input id="pr-amt" type="number" min="5" required class="w-full px-2 py-1 rounded bg-slate-950 text-white" /></div><div><label class="text-[9.5px] text-slate-400">أقصى استخدام</label><input id="pr-max" type="number" min="1" value="20" required class="w-full px-2 py-1 rounded bg-slate-950 text-white" /></div></div>
            <button type="submit" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black">إنشاء الكود</button>
            ${this.promoCodes.map((pr) => `<div class="p-1.5 rounded bg-slate-950 flex justify-between text-[10px]"><span><b class="text-amber-300">${app.esc(pr.code || pr.id)}</b> — ${app.fmtMoney(pr.amount)} ج.م</span><div class="flex gap-1"><button type="button" onclick="DamanAdmin.togglePromoCode('${app.esc(pr.id)}',${!!pr.active})" class="px-2 py-0.5 rounded bg-slate-800 ${pr.active ? 'text-emerald-400' : 'text-rose-400'}">${pr.active ? 'مفعّل' : 'موقوف'}</button><button type="button" onclick="DamanAdmin.deletePromoCode('${app.esc(pr.id)}')" class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">حذف</button></div></div>`).join('')}
          </form>
        </div>`;
    },

    // ==================== 6. RBAC, AUDIT LOG, LIVE DB & EMERGENCY SETTINGS ====================
    async saveModeratorRBAC(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const email = document.getElementById('rb-email').value.trim().toLowerCase();
      if (!email.includes('@')) return;
      const perms = { kyc: document.getElementById('rb-kyc').checked, wallet: document.getElementById('rb-wallet').checked, contracts: document.getElementById('rb-contracts').checked, market: document.getElementById('rb-market').checked, companies: document.getElementById('rb-companies').checked, users: document.getElementById('rb-users').checked, comms: document.getElementById('rb-comms').checked };
      const curMods = Array.isArray(app.appConfig?.moderators) ? app.appConfig.moderators : [];
      const curMap = Object.assign({}, app.appConfig?.moderatorPerms || {});
      curMap[email] = perms;
      await app.db.collection('settings').doc('appConfig').set({ moderators: Array.from(new Set(curMods.concat([email]))), moderatorPerms: curMap }, { merge: true });
      e.target.reset();
      app.toast('تم حفظ صلاحيات المشرف ✅', 'success');
    },

    async removeModerator(email) {
      const app = window.DamanApp;
      const nextMods = (app.appConfig?.moderators || []).filter((x) => x.toLowerCase() !== email.toLowerCase());
      const nextMap = Object.assign({}, app.appConfig?.moderatorPerms || {});
      delete nextMap[email.toLowerCase()];
      await app.db.collection('settings').doc('appConfig').set({ moderators: nextMods, moderatorPerms: nextMap }, { merge: true });
    },

    renderSecurityTab(app) {
      const mods = Array.isArray(app.appConfig?.moderators) ? app.appConfig.moderators : [];
      const ms = this.mediaStats || { total: 0, recordings: 0, receipts: 0, kyc: 0 };
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanAdmin.saveModeratorRBAC(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-purple-500/40">
            <div class="font-black text-purple-300">🛡️ صلاحيات المشرفين المساعدين (RBAC)</div>
            <input id="rb-email" type="email" required placeholder="إيميل المشرف" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-1 text-[10.5px]">
              <label><input id="rb-kyc" type="checkbox" checked /> التوثيق</label><label><input id="rb-wallet" type="checkbox" /> الشحن والسحب</label>
              <label><input id="rb-contracts" type="checkbox" checked /> العقود والنزاعات</label><label><input id="rb-market" type="checkbox" checked /> السوق</label>
              <label><input id="rb-companies" type="checkbox" /> الشركات</label><label><input id="rb-users" type="checkbox" checked /> المستخدمين</label>
              <label><input id="rb-comms" type="checkbox" checked /> مراقبة الشات</label>
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">حفظ المشرف</button>
            ${mods.map((em) => `<div class="p-2 rounded bg-slate-950 flex justify-between"><span>${app.esc(em)}</span><button type="button" onclick="DamanAdmin.removeModerator('${app.esc(em)}')" class="text-rose-400">حذف</button></div>`).join('')}
          </form>
          <div class="glass-card rounded-2xl p-3 text-[11px]">🧹 خزنة المرفقات: <b>${ms.total}</b> ملف (بطاقات ${ms.kyc} | إيصالات ${ms.receipts} | تسجيلات ${ms.recordings})</div>
          <div class="font-black text-amber-400">📜 سجل الرقابة (${this.auditLogs.length})</div>
          ${this.auditLogs.slice(0, 30).map((l) => `<div class="glass-card rounded-xl p-2 text-[10px]"><b class="text-amber-300">${app.esc(l.action)}</b> (${app.esc(l.date)} ${app.esc(l.time || '')}): ${app.esc(l.details)}</div>`).join('')}
        </div>`;
    },

    selectDbCollection(col) { this.dbCol = col; this.loadTabData('db'); },

    openDbDocEditor(docId) {
      const app = window.DamanApp;
      const doc = this.dbDocs.find((d) => d.id === docId);
      if (!doc) return;
      const clean = {};
      Object.keys(doc).forEach((k) => { if (k !== 'id' && !(doc[k] && typeof doc[k] === 'object' && typeof doc[k].seconds === 'number')) clean[k] = doc[k]; });
      let m = document.getElementById('daman-db-ed-modal');
      if (!m) { m = document.createElement('div'); m.id = 'daman-db-ed-modal'; m.className = 'daman-modal fixed inset-0 z-[94] bg-black/92 flex items-center justify-center p-3'; document.body.appendChild(m); }
      m.classList.remove('hidden');
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-2.5 text-xs"><div class="flex justify-between"><h3 class="font-black text-amber-400">🗄️ ${app.esc(this.dbCol)} / ${app.esc(docId)}</h3><button onclick="document.getElementById('daman-db-ed-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div><textarea id="db-json-area" rows="12" dir="ltr" class="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-[11px]">${app.esc(JSON.stringify(clean, null, 2))}</textarea><div class="grid grid-cols-2 gap-2"><button onclick="DamanAdmin.saveDbDocJson('${app.esc(docId)}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">حفظ</button><button onclick="DamanAdmin.deleteDbDoc('${app.esc(docId)}')" class="py-2 rounded-xl bg-rose-600 text-white font-black">حذف</button></div></div>`;
    },

    async saveDbDocJson(docId) {
      try {
        await window.DamanApp.db.collection(this.dbCol).doc(docId).set(JSON.parse(document.getElementById('db-json-area').value), { merge: true });
        document.getElementById('daman-db-ed-modal').classList.add('hidden');
        window.DamanApp.toast('تم الحفظ ✅', 'success');
        this.loadTabData('db');
      } catch (e) { window.DamanApp.toast(e.message, 'error'); }
    },

    async deleteDbDoc(docId) {
      if (['settings', 'auditLogs'].includes(this.dbCol) || !window.confirm('حذف السجل نهائياً؟')) return;
      await window.DamanApp.db.collection(this.dbCol).doc(docId).delete();
      document.getElementById('daman-db-ed-modal').classList.add('hidden');
      this.loadTabData('db');
    },

    renderDbTab(app) {
      const cols = ['users', 'projects', 'chatAgreements', 'walletRequests', 'kycRequests', 'companies', 'companyOps', 'vipRequests', 'vipLaborRequests', 'chats', 'platformFees', 'adminExpenses', 'disputes', 'promoCodes', 'blacklist', 'settings'];
      const q = app.normalizeAr(this.dbFilter);
      const list = this.dbDocs.filter((d) => !q || app.normalizeAr(JSON.stringify(d)).includes(q));
      return `
        <div class="space-y-2.5 text-xs">
          <select onchange="DamanAdmin.selectDbCollection(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-purple-500/40 text-purple-200 font-black">${cols.map((k) => `<option value="${k}" ${this.dbCol === k ? 'selected' : ''}>جدول: ${k}</option>`).join('')}</select>
          <input type="text" value="${app.esc(this.dbFilter)}" oninput="DamanAdmin.dbFilter=this.value; DamanAdmin.rerender()" placeholder="تصفية..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          ${list.map((d) => `<div class="glass-card rounded-xl p-2.5 flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-white block truncate">${app.esc(d.name || d.title || d.ticketNumber || d.code || d.id)}</b><span class="text-[9.5px] text-slate-400">${app.esc(d.id)}</span></div><button onclick="DamanAdmin.openDbDocEditor('${app.esc(d.id)}')" class="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-black text-[10px]">تعديل</button></div>`).join('')}
        </div>`;
    },

    async saveEmergencyAndGeneralSettings(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const cfg = {
        commissionRate: (parseFloat(document.getElementById('st-comm').value) || 3.5) / 100,
        vipCommissionRate: (parseFloat(document.getElementById('st-vipcomm').value) || 10) / 100,
        packages: { individualMonthly: parseFloat(document.getElementById('st-pkg-ind').value) || 150, companyMonthly: parseFloat(document.getElementById('st-pkg-comp').value) || 450, boostAdPrice: parseFloat(document.getElementById('st-pkg-boost').value) || 75 },
        supportWhatsapp: document.getElementById('st-wa').value.trim(),
        turnServer: document.getElementById('st-turn').value.trim(),
        maintenanceMode: document.getElementById('ks-maint').checked,
        maintenanceMessage: document.getElementById('ks-maint-msg').value.trim(),
        disableRegistrations: document.getElementById('ks-noreg').checked,
        disableDeposits: document.getElementById('ks-nodep').checked,
        disableWithdrawals: document.getElementById('ks-nowd').checked,
        disableCalls: document.getElementById('ks-nocalls').checked,
        disableNewContracts: document.getElementById('ks-noct').checked,
        disableMarketPosting: document.getElementById('ks-nopost').checked,
        requireKycForActions: document.getElementById('ks-reqkyc').checked
      };
      await app.db.collection('settings').doc('appConfig').set(cfg, { merge: true });
      await app.logAudit('settings_save', `تحديث الإعدادات والطوارئ`);
      app.toast('تم حفظ كل الإعدادات ومفاتيح الطوارئ فوراً ✅', 'success');
    },

    async triggerForceReloadAllDevices() {
      const app = window.DamanApp;
      if (!window.confirm('إجبار تحديث الكاش على جميع الموبايلات الآن؟')) return;
      const ver = Date.now();
      localStorage.setItem('daman_force_ver', String(ver));
      await app.db.collection('settings').doc('appConfig').set({ forceReloadVersion: ver }, { merge: true });
      app.toast('تم إرسال أمر التحديث 🚀', 'success');
    },

    async exportFullBackup() {
      const app = window.DamanApp;
      app.toast('جارٍ تجهيز النسخة الاحتياطية...', 'info');
      const cols = ['users', 'walletRequests', 'platformFees', 'adminExpenses', 'treasuryTransfers', 'chatAgreements', 'disputes', 'projects', 'companies', 'companyMembers', 'companyOps', 'vipRequests', 'vipLaborRequests', 'blacklist', 'promoCodes', 'auditLogs', 'settings'];
      const dump = { exportedAt: new Date().toISOString(), version: app.APP_VERSION, collections: {} };
      for (const c of cols) dump.collections[c] = await this.safeDocs(app.db.collection(c).limit(500).get(), c);
      const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `damansite-backup-${app.todayLocal()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.toast('تم تنزيل النسخة الاحتياطية JSON ✅', 'success');
    },

    renderSettingsTab(app) {
      const cfg = app.appConfig || {};
      const pkgs = cfg.packages || {};
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanAdmin.saveEmergencyAndGeneralSettings(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-rose-500/40">
            <div class="font-black text-rose-400">🚨 مفاتيح الطوارئ الـ 7</div>
            <div class="grid grid-cols-2 gap-1.5 text-[10.5px] font-bold">
              <label class="p-2 rounded-xl bg-rose-500/15 text-rose-200"><input id="ks-maint" type="checkbox" ${cfg.maintenanceMode ? 'checked' : ''} /> وضع الصيانة</label>
              <label class="p-2 rounded-xl bg-slate-950"><input id="ks-noreg" type="checkbox" ${cfg.disableRegistrations ? 'checked' : ''} /> إيقاف التسجيل</label>
              <label class="p-2 rounded-xl bg-slate-950"><input id="ks-nodep" type="checkbox" ${cfg.disableDeposits ? 'checked' : ''} /> إيقاف الإيداع</label>
              <label class="p-2 rounded-xl bg-slate-950"><input id="ks-nowd" type="checkbox" ${cfg.disableWithdrawals ? 'checked' : ''} /> إيقاف السحب</label>
              <label class="p-2 rounded-xl bg-slate-950"><input id="ks-nocalls" type="checkbox" ${cfg.disableCalls ? 'checked' : ''} /> إيقاف المكالمات</label>
              <label class="p-2 rounded-xl bg-slate-950"><input id="ks-noct" type="checkbox" ${cfg.disableNewContracts ? 'checked' : ''} /> إيقاف العقود</label>
              <label class="p-2 rounded-xl bg-slate-950"><input id="ks-nopost" type="checkbox" ${cfg.disableMarketPosting ? 'checked' : ''} /> إيقاف النشر</label>
              <label class="p-2 rounded-xl bg-emerald-500/10 text-emerald-300"><input id="ks-reqkyc" type="checkbox" ${cfg.requireKycForActions !== false ? 'checked' : ''} /> توثيق إجباري</label>
            </div>
            <input id="ks-maint-msg" type="text" value="${app.esc(cfg.maintenanceMessage || '')}" placeholder="رسالة الصيانة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-slate-400">عمولة الضمان %</label><input id="st-comm" type="number" step="0.1" value="${(Number(cfg.commissionRate || 0.035) * 100).toFixed(1)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 text-white font-bold" /></div>
              <div><label class="text-[10px] text-slate-400">عمولة VIP %</label><input id="st-vipcomm" type="number" step="0.5" value="${(Number(cfg.vipCommissionRate || 0.10) * 100).toFixed(1)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="text-[9.5px] text-slate-400">باقة أفراد</label><input id="st-pkg-ind" type="number" value="${Number(pkgs.individualMonthly || 150)}" class="w-full px-2 py-1.5 rounded bg-slate-950 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">باقة شركات</label><input id="st-pkg-comp" type="number" value="${Number(pkgs.companyMonthly || 450)}" class="w-full px-2 py-1.5 rounded bg-slate-950 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">تمييز افتراضي</label><input id="st-pkg-boost" type="number" value="${Number(pkgs.boostAdPrice || 75)}" class="w-full px-2 py-1.5 rounded bg-slate-950 text-white" /></div>
            </div>
            <input id="st-wa" type="text" value="${app.esc(cfg.supportWhatsapp || '201030374787')}" placeholder="واتساب الدعم" class="w-full px-3 py-2 rounded-xl bg-slate-950 text-white" />
            <input id="st-turn" type="text" value="${app.esc(cfg.turnServer || '')}" placeholder="سيرفر TURN (اختياري)" class="w-full px-3 py-2 rounded-xl bg-slate-950 text-white" />
            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">حفظ كل الإعدادات</button>
          </form>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="DamanAdmin.triggerForceReloadAllDevices()" class="py-3 rounded-2xl bg-sky-600 text-white font-black text-[11px]">🚀 إجبار تحديث الأجهزة</button>
            <button onclick="DamanAdmin.exportFullBackup()" class="py-3 rounded-2xl bg-emerald-600 text-white font-black text-[11px]">💾 نسخة احتياطية JSON</button>
          </div>
        </div>`;
    }
  };

  Object.assign(window.DamanAdmin, AdminExt);
  if (window.DamanApp && window.DamanApp.activeTab === 'admin') {
    window.DamanApp.renderCurrentTab();
  }
})();
