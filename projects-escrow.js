(function () {
  const ProjectsMod = {
    subTab: 'browse', // 'browse' | 'my' | 'ledger' | 'inspection' | 'vip_labor'
    postTypeFilter: 'all', // 'all' | 'hiring' | 'seeking'
    projects: [],
    ledgerEntries: [],
    ledgerSiteFilter: 'all',
    myInspections: [],
    myVipLabor: [],
    currentProposals: [],
    activeProjectId: null,
    activeDemoItem: null,
    postPhotoBase64: '',
    demoCache: {},
    unsubProjects: null,
    unsubProposals: null,
    unsubLedger: null,
    unsubInspections: null,
    unsubVipLabor: null,
    attachedUid: null,

    ensureListeners(app) {
      if (!this.unsubProjects) {
        this.unsubProjects = app.db
          .collection('projects')
          .orderBy('createdAt', 'desc')
          .limit(60)
          .onSnapshot(
            (snap) => {
              this.projects = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
              if (app.activeTab === 'projects') this.rerender();
              if (this.activeProjectId) this.refreshDetailModal();
            },
            (err) => console.error('projects listener error:', err)
          );
      }

      if (!app.user) {
        this.detachUserListeners();
        return;
      }

      if (this.attachedUid !== app.user.uid) {
        this.detachUserListeners();
        this.attachedUid = app.user.uid;

        this.unsubLedger = app.db
          .collection('siteLedger')
          .where('ownerUid', '==', app.user.uid)
          .limit(100)
          .onSnapshot(
            (snap) => {
              this.ledgerEntries = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              if (app.activeTab === 'projects' && this.subTab === 'ledger') this.rerender();
            },
            () => {}
          );

        this.unsubInspections = app.db
          .collection('vipRequests')
          .where('userId', '==', app.user.uid)
          .onSnapshot(
            (snap) => {
              this.myInspections = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              if (app.activeTab === 'projects' && this.subTab === 'inspection') this.rerender();
            },
            () => {}
          );

        this.unsubVipLabor = app.db
          .collection('vipLaborRequests')
          .where('userId', '==', app.user.uid)
          .onSnapshot(
            (snap) => {
              this.myVipLabor = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              if (app.activeTab === 'projects' && this.subTab === 'vip_labor') this.rerender();
            },
            () => {}
          );
      }
    },

    detachUserListeners() {
      if (this.unsubLedger) { this.unsubLedger(); this.unsubLedger = null; }
      if (this.unsubInspections) { this.unsubInspections(); this.unsubInspections = null; }
      if (this.unsubVipLabor) { this.unsubVipLabor(); this.unsubVipLabor = null; }
      this.attachedUid = null;
      this.ledgerEntries = [];
      this.myInspections = [];
      this.myVipLabor = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'projects') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) { this.subTab = tab; this.rerender(); },
    setPostTypeFilter(t) { this.postTypeFilter = t; this.rerender(); },
    setFilter(catId) { window.DamanApp.selectedMainCat = catId || 'all'; this.rerender(); },
    setGovFilter(gov) { window.DamanApp.selectedGov = gov || 'all'; this.rerender(); },
    setSearch(val) { window.DamanApp.searchQuery = (val || '').trim(); this.rerender(); },

    getCatLabel(catId, lang) {
      const c = window.DAMAN_CATEGORIES.find((x) => x.id === catId);
      if (!c) return catId || '-';
      return lang === 'ar' ? c.ar : c.en;
    },

    // Zero-Firebase-Reads Demo Ads Engine (split between Hiring & Seeking)
    getDemoAdsForCategory(catId) {
      const app = window.DamanApp;
      if (app.appConfig && app.appConfig.hideDemoAds) return [];

      const cats = catId === 'all' ? window.DAMAN_CATEGORIES.slice(0, 6) : window.DAMAN_CATEGORIES.filter((c) => c.id === catId);
      const govs = window.DAMAN_GOVERNORATES;
      const providers = [
        { name: 'مجموعة النيل للمقاولات والإنشاءات', role: 'company', phone: '01000001021', rating: 4.9, count: 18 },
        { name: 'م. أحمد السعيد — مكتب استشاري', role: 'company', phone: '01100002032', rating: 4.8, count: 14 },
        { name: 'شركة الرواد للخدمات المتكاملة', role: 'company', phone: '01200003043', rating: 4.7, count: 22 },
        { name: 'مقاول تنفيذ معتمد — محمود حسن', role: 'contractor', phone: '01000004054', rating: 4.6, count: 9 },
        { name: 'المتحدة للتوريدات والتنفيذ', role: 'company', phone: '01500005065', rating: 4.9, count: 31 },
        { name: 'فريق الإتقان الفني المتخصص', role: 'contractor', phone: '01000006076', rating: 4.5, count: 11 },
        { name: 'مكتب الصفا الهندسي والتشطيبات', role: 'company', phone: '01100007087', rating: 4.8, count: 16 },
        { name: 'شركة الأفق لإدارة المواقع والمنشآت', role: 'company', phone: '01200008098', rating: 4.7, count: 13 },
        { name: 'م. طارق عبد الرحمن — إشراف وتنفيذ', role: 'contractor', phone: '01000009109', rating: 4.9, count: 25 },
        { name: 'شركة البناء الحديث للتعاقدات', role: 'company', phone: '01100001120', rating: 4.6, count: 12 }
      ];

      const list = [];
      cats.forEach((cat, cIdx) => {
        const perCat = catId === 'all' ? 2 : 10;
        for (let i = 0; i < perCat; i++) {
          const prov = providers[(cIdx + i) % providers.length];
          const gov = govs[(cIdx * 3 + i * 2) % govs.length];
          const isHiring = i % 2 === 0;
          const id = `demo_${cat.id}_${i}`;
          const item = {
            id,
            isDemo: true,
            isFeatured: i === 0,
            postType: isHiring ? 'hiring' : 'seeking',
            mainCategory: cat.id,
            title: isHiring ? `مطلوب تنفيذ / عمالة في ${cat.ar} — ${gov}` : `متاح للتنفيذ والعمل في ${cat.ar} (${prov.name})`,
            location: gov,
            budget: (i + 2) * 12500,
            description: isHiring
              ? `مطلوب فريق عمل أو شركة متخصصة لتنفيذ أعمال ${cat.ar} في ${gov}. التعاقد وحجز الدفعات عبر محفظة ضمان سايت (3.5%) لضمان حق الطرفين.`
              : `فريق ومقاول جاهز للتنفيذ الفوري في قطاع ${cat.ar} داخل ${gov} وجميع المحافظات بأعلى جودة والتزام تام بالمواعيد.`,
            clientId: `demo_user_${(cIdx + i) % providers.length}`,
            clientName: prov.name,
            clientPhone: prov.phone,
            clientAccountType: prov.role,
            clientRating: prov.rating,
            clientRatingCount: prov.count,
            status: 'open',
            proposalsCount: (i % 5) + 1,
            demoReviews: [
              { fromName: 'عميل موثّق', rating: 5, comment: 'التزام ممتاز بالمواعيد وجودة عالية في التنفيذ.' },
              { fromName: 'م. كريم عادل', rating: 4, comment: 'تعامل محترم وسعر مناسب جداً.' }
            ]
          };
          this.demoCache[id] = item;
          list.push(item);
        }
      });
      return list;
    },

    statusBadge(status, isAr) {
      const map = {
        pending_review: { cls: 'bg-purple-500/20 text-purple-300', ar: 'قيد مراجعة الإدارة', en: 'Pending Review' },
        open: { cls: 'bg-emerald-500/20 text-emerald-300', ar: 'مفتوح', en: 'Open' },
        pending_funding: { cls: 'bg-orange-500/20 text-orange-300', ar: 'بانتظار الشحن', en: 'Pending Funding' },
        in_progress: { cls: 'bg-amber-500/20 text-amber-300', ar: 'عقد ضمان نشط', en: 'Escrow Active' },
        completed: { cls: 'bg-sky-500/20 text-sky-300', ar: 'مكتمل', en: 'Completed' },
        disputed: { cls: 'bg-rose-500/20 text-rose-300', ar: 'قيد النزاع', en: 'Disputed' },
        suspended: { cls: 'bg-slate-700 text-slate-300', ar: 'موقوف إدارياً', en: 'Suspended' }
      };
      const st = map[status] || map.open;
      return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}">${isAr ? st.ar : st.en}</span>`;
    },

    compressImage(file, maxW = 820, quality = 0.58) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Read error'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Image error'));
          img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async handleProjectPhoto(input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        this.postPhotoBase64 = await this.compressImage(file);
        const prev = document.getElementById('post-proj-prev');
        if (prev) prev.innerHTML = `<img src="${this.postPhotoBase64}" class="w-full max-h-36 object-cover rounded-xl border border-emerald-500/40 mt-2" />`;
      } catch (e) { app.toast('تعذر قراءة الصورة', 'error'); }
    },

    openPostModal() {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (app.profile.status === 'frozen') return app.toast(app.t('frozenNotice'), 'error');

      this.postPhotoBase64 = '';
      let modal = document.getElementById('daman-post-project-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-post-project-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');

      const defaultCat = app.selectedMainCat && app.selectedMainCat !== 'all' ? app.selectedMainCat : window.DAMAN_CATEGORIES[0].id;
      const catOpts = window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === defaultCat ? 'selected' : ''}>${isAr ? c.ar : c.en}</option>`).join('');
      const govOpts = window.DAMAN_GOVERNORATES.map((g) => `<option value="${g}">${g}</option>`).join('');

      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-extrabold text-amber-400"><i class="fa-solid fa-plus-circle me-1"></i> ${isAr ? 'نشر مشروع أو إعلان جديد' : 'Post Project / Ad'}</h3>
            <button onclick="document.getElementById('daman-post-project-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanProjects.submitProject(event)" class="space-y-2.5">
            <select id="pp-post-type" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/50 text-xs text-amber-300 font-black">
              <option value="hiring">${isAr ? '📌 صاحب عمل / مشروع (أبحث عن مقاول أو شركة أو عمالة)' : 'Hiring / Project Owner'}</option>
              <option value="seeking">${isAr ? '👷 باحث عن عمل / مقدم خدمة (أعرض خدماتي ومعداتي)' : 'Job Seeker / Service Provider'}</option>
            </select>
            <select id="pp-main-cat" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold">${catOpts}</select>
            <select id="pp-gov" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold">${govOpts}</select>
            <input id="pp-title" type="text" required placeholder="${isAr ? 'عنوان المشروع أو الإعلان' : 'Title'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="pp-budget" type="number" min="100" step="any" required placeholder="${isAr ? 'الميزانية / السعر (ج.م)' : 'Budget (EGP)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-white font-bold" />
              <input id="pp-area" type="text" placeholder="${isAr ? 'المساحة / الكمية' : 'Area / Qty'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <textarea id="pp-desc" rows="3" required placeholder="${isAr ? 'اكتب تفاصيل البنود والمواصفات...' : 'Details...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <label class="block p-2.5 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 text-center cursor-pointer">
              <span class="text-xs font-bold text-slate-300"><i class="fa-solid fa-image text-amber-400 me-1"></i> ${isAr ? 'إرفاق صورة (اختياري)' : 'Photo (Optional)'}</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanProjects.handleProjectPhoto(this)" />
              <div id="post-proj-prev"></div>
            </label>
            <button id="pp-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> ${isAr ? 'إرسال المنشور لمراجعة الإدارة' : 'Submit for Review'}
            </button>
          </form>
        </div>`;
    },

    async submitProject(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const btn = document.getElementById('pp-submit-btn');
      if (btn) btn.disabled = true;
      const title = document.getElementById('pp-title').value.trim();

      try {
        const initialStatus = app.isAdmin() ? 'open' : 'pending_review';
        await app.db.collection('projects').add({
          postType: document.getElementById('pp-post-type').value,
          mainCategory: document.getElementById('pp-main-cat').value,
          location: document.getElementById('pp-gov').value,
          title,
          budget: parseFloat(document.getElementById('pp-budget').value) || 0,
          areaSpecs: document.getElementById('pp-area').value.trim(),
          description: document.getElementById('pp-desc').value.trim(),
          photoBase64: this.postPhotoBase64 || '',
          clientId: app.user.uid,
          clientName: app.profile.companyName || app.profile.kycFullName || app.profile.name || '',
          clientEmail: app.profile.email || app.user.email || '',
          clientPhone: app.profile.phone || '',
          clientAccountType: app.profile.accountType || 'client',
          clientRating: app.profile.ratingAvg || 0,
          clientRatingCount: app.profile.ratingCount || 0,
          isFeatured: false,
          status: initialStatus,
          proposalsCount: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (!app.isAdmin()) {
          await app.sendNotification('ADMIN', 'منشور جديد بانتظار المراجعة', `${title} — بواسطة ${app.profile.name}`);
        }
        this.postPhotoBase64 = '';
        document.getElementById('daman-post-project-modal').classList.add('hidden');
        app.toast(app.isAdmin() ? 'تم النشر بنجاح' : 'تم إرسال منشورك لمراجعة الإدارة قبل النشر', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    // ==================== SITE LEDGER (سجل العمال واليوميات والمصاريف وتصفية الخميس) ====================
    async addLedgerEntry(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user) return app.openAuthModal('login');
      const siteName = document.getElementById('lg-site').value.trim();
      const workerName = document.getElementById('lg-worker').value.trim();
      const entryDate = document.getElementById('lg-date').value || new Date().toISOString().slice(0, 10);
      const entryType = document.getElementById('lg-type').value; // daily | expense | lump | deduction
      const count = parseFloat(document.getElementById('lg-count').value) || 1;
      const rate = parseFloat(document.getElementById('lg-rate').value) || 0;
      const overtime = parseFloat(document.getElementById('lg-overtime').value) || 0;
      const notes = document.getElementById('lg-notes').value.trim();

      const total = Math.round((count * rate + overtime) * 100) / 100;
      if (total <= 0) return app.toast('أدخل قيمة صحيحة للبند', 'error');

      try {
        await app.db.collection('siteLedger').add({
          ownerUid: app.user.uid,
          siteName,
          workerName,
          entryDate,
          entryType,
          count,
          rate,
          overtime,
          total,
          notes,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        document.getElementById('lg-date').value = new Date().toISOString().slice(0, 10);
        document.getElementById('lg-site').value = siteName;
        app.toast('تم تسجيل البند في سجل العمال بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async deleteLedgerEntry(id) {
      if (!window.confirm('حذف هذا السجل؟')) return;
      try {
        await window.DamanApp.db.collection('siteLedger').doc(id).delete();
        window.DamanApp.toast('تم الحذف', 'info');
      } catch (e) { window.DamanApp.toast(e.message, 'error'); }
    },

    printLedgerA4() {
      const app = window.DamanApp;
      const list = this.ledgerSiteFilter === 'all'
        ? this.ledgerEntries
        : this.ledgerEntries.filter((x) => x.siteName === this.ledgerSiteFilter);
      if (!list.length) return app.toast('لا توجد بيانات للطباعة', 'warning');

      let totalWages = 0, totalLump = 0, totalExpenses = 0, totalDeduct = 0;
      const typeAr = { daily: 'يوميات وإضافي', lump: 'مقطوعية', expense: 'مصروف / عهدة / سلفة', deduction: 'خصم / جزاء' };

      const rows = list.map((it, i) => {
        if (it.entryType === 'daily') totalWages += Number(it.total || 0);
        else if (it.entryType === 'lump') totalLump += Number(it.total || 0);
        else if (it.entryType === 'expense') totalExpenses += Number(it.total || 0);
        else if (it.entryType === 'deduction') totalDeduct += Number(it.total || 0);
        return `<tr><td>${i + 1}</td><td>${app.esc(it.entryDate)}</td><td>${app.esc(it.siteName)}</td><td>${app.esc(it.workerName)}</td><td>${typeAr[it.entryType] || it.entryType}</td><td>${it.count} × ${app.fmtMoney(it.rate)}${it.overtime ? ' + ' + app.fmtMoney(it.overtime) + ' إضافي' : ''}</td><td><b>${app.fmtMoney(it.total)} ج.م</b></td><td>${app.esc(it.notes || '-')}</td></tr>`;
      }).join('');

      const netPayable = Math.round((totalWages + totalLump - totalExpenses - totalDeduct) * 100) / 100;
      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');

      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>كشف سجل العمال وتصفية الحساب — ضمان سايت</title><style>@page{size:A4 portrait;margin:12mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11px;line-height:1.5;}.sheet{border:2px solid #000;padding:14px 16px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}table{width:100%;border-collapse:collapse;margin-bottom:10px;}th,td{border:1px solid #000;padding:4px 6px;text-align:right;}th{background:#f0f0f0;}.sum{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px;text-align:center;}.sbox{border:1px solid #000;padding:6px;}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:22px;text-align:center;}.sig{border:1px solid #000;padding:8px 6px 38px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة / حفظ كشف الحساب PDF (A4)</button><div class="sheet"><div class="hdr"><div><h2 style="margin:0">كشف سجل العمال واليوميات وتصفية الحساب</h2><div>المشروع / الموقع: <b>${app.esc(this.ledgerSiteFilter === 'all' ? 'جميع المواقع' : this.ledgerSiteFilter)}</b></div></div><div><div><b>منصة ضمان سايت | DamanSite</b></div><div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div></div></div><table><thead><tr><th>#</th><th>التاريخ</th><th>الموقع</th><th>العامل / المقاول</th><th>النوع</th><th>التفاصيل</th><th>الإجمالي</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table><div class="sum"><div class="sbox">اليوميات<br/><b>${app.fmtMoney(totalWages)} ج.م</b></div><div class="sbox">المقطوعية<br/><b>${app.fmtMoney(totalLump)} ج.م</b></div><div class="sbox">المصاريف والسُلف<br/><b>-${app.fmtMoney(totalExpenses)} ج.م</b></div><div class="sbox">الخصومات<br/><b>-${app.fmtMoney(totalDeduct)} ج.م</b></div><div class="sbox" style="background:#eee">صافي التصفية<br/><b>${app.fmtMoney(netPayable)} ج.م</b></div></div><div class="sigs"><div class="sig">توقيع المشرف / المهندس</div><div class="sig">توقيع المقاول / المستلم</div><div class="sig">اعتماد المدير المسؤول</div></div></div></body></html>`);
      win.document.close();
    },

    renderLedgerTab(app) {
      const isAr = app.lang === 'ar';
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;

      const sites = [...new Set(this.ledgerEntries.map((x) => x.siteName).filter(Boolean))];
      const list = this.ledgerSiteFilter === 'all' ? this.ledgerEntries : this.ledgerEntries.filter((x) => x.siteName === this.ledgerSiteFilter);

      let wages = 0, lump = 0, exp = 0, ded = 0;
      list.forEach((it) => {
        if (it.entryType === 'daily') wages += Number(it.total || 0);
        else if (it.entryType === 'lump') lump += Number(it.total || 0);
        else if (it.entryType === 'expense') exp += Number(it.total || 0);
        else if (it.entryType === 'deduction') ded += Number(it.total || 0);
      });
      const net = Math.round((wages + lump - exp - ded) * 100) / 100;
      const today = new Date().toISOString().slice(0, 10);

      return `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-3.5 bg-gradient-to-br from-slate-800 to-slate-950 border border-amber-500/40 space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-black text-amber-400"><i class="fa-solid fa-book-open me-1"></i> ${isAr ? 'سجل العمال واليوميات وتصفية الخميس' : 'Site Labor Ledger'}</div>
              <button onclick="DamanProjects.printLedgerA4()" class="px-2.5 py-1.5 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>كشف A4 PDF</button>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div class="p-2 rounded-xl bg-slate-950/80"><div class="text-slate-400">يوميات + مقطوعية</div><div class="text-xs font-black text-emerald-400 mt-0.5">${app.fmtMoney(wages + lump)}</div></div>
              <div class="p-2 rounded-xl bg-slate-950/80"><div class="text-slate-400">مصاريف + خصومات</div><div class="text-xs font-black text-rose-400 mt-0.5">-${app.fmtMoney(exp + ded)}</div></div>
              <div class="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40"><div class="text-amber-200">صافي التصفية</div><div class="text-xs font-black text-amber-300 mt-0.5">${app.fmtMoney(net)} ج.م</div></div>
            </div>
          </div>

          <form onsubmit="DamanProjects.addLedgerEntry(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="text-xs font-extrabold text-white"><i class="fa-solid fa-plus text-emerald-400 me-1"></i> تسجيل حركة جديدة (يومية / مصروف / مقطوعية / خصم)</div>
            <div class="grid grid-cols-2 gap-2">
              <input id="lg-site" type="text" required placeholder="اسم الموقع / المشروع" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              <input id="lg-date" type="date" value="${today}" required class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="lg-worker" type="text" required placeholder="اسم العامل / المقاول" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              <select id="lg-type" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-bold text-white">
                <option value="daily">يوميات عمل (+)</option>
                <option value="lump">مقطوعية / بند (+)</option>
                <option value="expense">مصروف / سلفة / عهدة (-)</option>
                <option value="deduction">خصم / جزاء (-)</option>
              </select>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <input id="lg-count" type="number" step="any" min="0.5" value="1" placeholder="العدد" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              <input id="lg-rate" type="number" step="any" min="1" required placeholder="السعر / المبلغ" class="px-2 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs text-white font-bold" />
              <input id="lg-overtime" type="number" step="any" min="0" value="0" placeholder="إضافي (ج.م)" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <input id="lg-notes" type="text" placeholder="ملاحظات (مثال: مصاريف يوم الثلاثاء / سلفة)" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">إضافة للسجل</button>
          </form>

          ${sites.length ? `
            <select onchange="DamanProjects.ledgerSiteFilter=this.value; DamanProjects.rerender()" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white">
              <option value="all">تصفية حسب الموقع: جميع المواقع (${this.ledgerEntries.length})</option>
              ${sites.map((s) => `<option value="${app.esc(s)}" ${this.ledgerSiteFilter === s ? 'selected' : ''}>${app.esc(s)}</option>`).join('')}
            </select>` : ''}

          <div class="space-y-2">
            ${!list.length
              ? '<div class="text-center text-xs text-slate-400 py-5">لا توجد حركات مسجلة في سجل العمال بعد</div>'
              : list.map((it) => {
                  const isNeg = it.entryType === 'expense' || it.entryType === 'deduction';
                  return `
                    <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div class="min-w-0">
                        <div class="font-extrabold text-white truncate">${app.esc(it.workerName)} <span class="text-[10px] text-amber-300">(${app.esc(it.siteName)})</span></div>
                        <div class="text-[10px] text-slate-400">${app.esc(it.entryDate)} • ${it.count} × ${app.fmtMoney(it.rate)} ${it.overtime ? '+ إضافي ' + app.fmtMoney(it.overtime) : ''} ${it.notes ? '— ' + app.esc(it.notes) : ''}</div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="font-black ${isNeg ? 'text-rose-400' : 'text-emerald-400'}">${isNeg ? '-' : '+'}${app.fmtMoney(it.total)}</span>
                        <button onclick="DamanProjects.deleteLedgerEntry('${it.id}')" class="text-slate-500 hover:text-rose-400"><i class="fa-solid fa-trash"></i></button>
                      </div>
                    </div>`;
                }).join('')}
          </div>
        </div>`;
    },

    // ==================== PROJECT DETAIL, ESCROW & CONTRACTS ====================
    openProjectDetail(projectId) {
      const app = window.DamanApp;
      this.activeProjectId = projectId;
      this.activeDemoItem = this.demoCache[projectId] || null;
      if (this.unsubProposals) { this.unsubProposals(); this.unsubProposals = null; }
      this.currentProposals = [];

      let modal = document.getElementById('daman-project-detail-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-project-detail-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');

      if (!this.activeDemoItem) {
        this.unsubProposals = app.db.collection('projects').doc(projectId).collection('proposals').onSnapshot(
          (snap) => {
            this.currentProposals = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            this.refreshDetailModal();
          },
          () => this.refreshDetailModal()
        );
      }
      this.refreshDetailModal();
    },

    closeDetailModal() {
      this.activeProjectId = null;
      this.activeDemoItem = null;
      if (this.unsubProposals) { this.unsubProposals(); this.unsubProposals = null; }
      document.getElementById('daman-project-detail-modal')?.classList.add('hidden');
    },

    refreshDetailModal() {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const modal = document.getElementById('daman-project-detail-modal');
      if (!modal || !this.activeProjectId) return;
      const proj = this.activeDemoItem || this.projects.find((p) => p.id === this.activeProjectId);
      if (!proj) return;

      const isDemo = !!proj.isDemo;
      const uid = app.user ? app.user.uid : null;
      const isOwner = !isDemo && uid && proj.clientId === uid;
      const stars = '★'.repeat(Math.round(proj.clientRating || 4)) + '☆'.repeat(5 - Math.round(proj.clientRating || 4));
      const chatTargetUid = isDemo ? 'admin' : proj.clientId;
      const typeBadge = proj.postType === 'seeking'
        ? `<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300">${isAr ? 'باحث عن عمل / مقدم خدمة' : 'Provider'}</span>`
        : `<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">${isAr ? 'صاحب عمل / مشروع' : 'Project Owner'}</span>`;

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 max-h-[92vh] overflow-y-auto space-y-3.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap mb-1">
                ${typeBadge}
                ${this.statusBadge(proj.status, isAr)}
              </div>
              <h3 class="text-sm font-black text-white leading-snug">${app.esc(proj.title)}</h3>
            </div>
            <button onclick="DamanProjects.closeDetailModal()" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 shrink-0"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${proj.photoBase64 ? `<img src="${proj.photoBase64}" class="w-full max-h-48 object-cover rounded-xl border border-slate-800" />` : ''}

          <div onclick="DamanApp.openPublicProfile('${proj.clientId}',{name:'${app.esc(proj.clientName).replace(/'/g, "\\'")}',phone:'${app.esc(proj.clientPhone || '')}',accountType:'${proj.clientAccountType || 'company'}',ratingAvg:${proj.clientRating || 4.8},ratingCount:${proj.clientRatingCount || 5},kycStatus:'verified'})"
            class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-amber-500/40">
            <div class="min-w-0">
              <div class="text-xs font-extrabold text-amber-300 truncate">${app.esc(proj.clientName)}</div>
              <div class="text-[10px] text-amber-400">${stars} (${proj.clientRatingCount || 0})</div>
            </div>
            <div class="text-end shrink-0">
              <div class="text-xs font-black text-emerald-400">${app.fmtMoney(proj.contractAmount || proj.budget)} ${app.t('egp')}</div>
              <div class="text-[10px] text-slate-400">${app.esc(proj.location)}</div>
            </div>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">${app.esc(proj.description)}</p>

          <div class="grid grid-cols-3 gap-1.5">
            <button onclick="DamanApp.revealPhoneWithAdvice('${app.esc(proj.clientPhone || '01000000000')}','${app.esc(proj.clientName).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-[11px]"><i class="fa-solid fa-phone me-1"></i>الهاتف</button>
            <button onclick="DamanProjects.closeDetailModal(); DamanApp.openChatWith('${chatTargetUid}','${app.esc(proj.clientName).replace(/'/g, "\\'")}','${proj.id}','${app.esc(proj.title).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 font-extrabold text-[11px]"><i class="fa-solid fa-comments me-1"></i>دردشة واتفاق</button>
            <button onclick="DamanApp.shareOnWhatsApp('${app.esc(proj.title).replace(/'/g, "\\'")}','${app.esc(proj.location)}')" class="py-2 rounded-xl bg-green-600/20 border border-green-500/40 text-green-300 font-extrabold text-[11px]"><i class="fa-brands fa-whatsapp me-1"></i>مشاركة</button>
          </div>

          ${!isDemo && proj.status === 'open' && uid && !isOwner ? `
            <form onsubmit="DamanProjects.submitProposal(event,'${proj.id}')" class="p-3 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2">
              <div class="text-xs font-extrabold text-emerald-400">تقديم عرض سعر سريع</div>
              <div class="grid grid-cols-2 gap-2">
                <input id="bid-cost" type="number" min="100" required placeholder="التكلفة (ج.م)" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
                <input id="bid-days" type="number" min="1" required placeholder="المدة (أيام)" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
              </div>
              <textarea id="bid-notes" rows="2" required placeholder="تفاصيل العرض..." class="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"></textarea>
              <button type="submit" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">إرسال العرض</button>
            </form>` : ''}
        </div>`;
    },

    async submitProposal(e, projectId) {
      e.preventDefault();
      const app = window.DamanApp;
      const totalCost = parseFloat(document.getElementById('bid-cost').value);
      const durationDays = parseInt(document.getElementById('bid-days').value, 10);
      const notes = document.getElementById('bid-notes').value.trim();
      const proj = this.projects.find((p) => p.id === projectId);
      try {
        await app.db.collection('projects').doc(projectId).collection('proposals').add({
          projectId, bidderId: app.user.uid, bidderName: app.profile.companyName || app.profile.name || '',
          totalCost, durationDays, notes, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.db.collection('projects').doc(projectId).update({ proposalsCount: firebase.firestore.FieldValue.increment(1) });
        if (proj?.clientId) await app.sendNotification(proj.clientId, 'عرض سعر جديد على مشروعك', `${app.profile.name} — ${app.fmtMoney(totalCost)} ج.م`);
        app.toast('تم إرسال عرض السعر بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    renderProjectCard(proj, app) {
      const isAr = app.lang === 'ar';
      const catLabel = this.getCatLabel(proj.mainCategory, app.lang);
      const stars = '★'.repeat(Math.round(proj.clientRating || 4)) + '☆'.repeat(5 - Math.round(proj.clientRating || 4));
      const typeTag = proj.postType === 'seeking'
        ? `<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 shrink-0">باحث عن عمل</span>`
        : `<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 shrink-0">مطلوب تنفيذ</span>`;

      return `
        <div onclick="DamanProjects.openProjectDetail('${proj.id}')" class="glass-card rounded-2xl p-3.5 space-y-2 cursor-pointer transition-all ${proj.isFeatured ? 'border-amber-500/70 bg-amber-500/5' : 'hover:border-amber-500/40'}">
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1 min-w-0">
              ${typeTag}
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 truncate">${app.esc(catLabel)}</span>
            </div>
            ${this.statusBadge(proj.status, isAr)}
          </div>
          <h4 class="text-xs font-extrabold text-white leading-snug">${app.esc(proj.title)}</h4>
          <p class="text-[11px] text-slate-400 line-clamp-2">${app.esc(proj.description)}</p>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
            <span class="text-slate-300 truncate"><i class="fa-solid fa-location-dot text-amber-400 me-1"></i>${app.esc(proj.location)}</span>
            <span class="font-black text-emerald-400 shrink-0">${app.fmtMoney(proj.contractAmount || proj.budget)} ${app.t('egp')}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span class="truncate">${app.esc(proj.clientName || '-')} <span class="text-amber-400 ms-1">${stars}</span></span>
            <span class="shrink-0">${proj.proposalsCount || 0} عروض</span>
          </div>
        </div>`;
    },

    renderBrowseTab(app) {
      const isAr = app.lang === 'ar';
      const selCat = app.selectedMainCat || 'all';
      const selGov = app.selectedGov || 'all';
      const q = (app.searchQuery || '').toLowerCase();

      const livePosts = this.projects.filter((p) => p.status !== 'pending_review' && p.status !== 'suspended');
      const demoPosts = this.getDemoAdsForCategory(selCat);
      const combined = livePosts.concat(demoPosts).filter((p) => {
        if (this.postTypeFilter !== 'all' && (p.postType || 'hiring') !== this.postTypeFilter) return false;
        if (selCat !== 'all' && p.mainCategory !== selCat) return false;
        if (selGov !== 'all' && p.location !== selGov) return false;
        if (q && !(p.title + ' ' + p.description + ' ' + p.location + ' ' + p.clientName).toLowerCase().includes(q)) return false;
        return true;
      });
      combined.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));

      return `
        <div class="space-y-3">
          <!-- Hiring vs Seeking Split -->
          <div class="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanProjects.setPostTypeFilter('all')" class="py-1.5 rounded-lg text-[10px] font-black ${this.postTypeFilter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">الكل</button>
            <button onclick="DamanProjects.setPostTypeFilter('hiring')" class="py-1.5 rounded-lg text-[10px] font-black ${this.postTypeFilter === 'hiring' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">أصحاب الأعمال</button>
            <button onclick="DamanProjects.setPostTypeFilter('seeking')" class="py-1.5 rounded-lg text-[10px] font-black ${this.postTypeFilter === 'seeking' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">باحثين عن عمل</button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <select onchange="DamanProjects.setFilter(this.value)" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-white">
              <option value="all" ${selCat === 'all' ? 'selected' : ''}>كل الأقسام (24)</option>
              ${window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}" ${selCat === c.id ? 'selected' : ''}>${isAr ? c.ar : c.en}</option>`).join('')}
            </select>
            <select onchange="DamanProjects.setGovFilter(this.value)" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-white">
              <option value="all" ${selGov === 'all' ? 'selected' : ''}>كل المحافظات</option>
              ${window.DAMAN_GOVERNORATES.map((g) => `<option value="${g}" ${selGov === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>

          <input type="search" value="${app.esc(app.searchQuery || '')}" oninput="DamanProjects.setSearch(this.value)" placeholder="ابحث بالعنوان أو المحافظة أو التخصص..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white" />

          ${!combined.length
            ? '<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد نتائج مطابقة</div>'
            : `<div class="space-y-2.5">${combined.map((p) => this.renderProjectCard(p, app)).join('')}</div>`}
        </div>`;
    },

    renderInspectionTab(app) {
      return `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-900/70 via-slate-900 to-slate-950 border border-emerald-500/50 space-y-1.5">
            <div class="text-xs font-black text-emerald-300"><i class="fa-solid fa-shield-halved me-1"></i> الاستلام الهندسي بضمان مادي 3 أضعاف (3x)</div>
            <p class="text-[11px] text-slate-200 leading-relaxed">نستلم الشدات، الأسقف، المحارة، التشطيبات، أو نمسك مشروعك كامل استشارات هندسية مع ضمان مادي يصل لـ 3 أضعاف قيمة الخدمة. حدد المساحة والموقع وسنرسل لك السعر فوراً.</p>
          </div>
          <form onsubmit="DamanProjects.submitInspectionRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <select id="insp-pkg" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs font-bold text-white">
              <option value="shoring_roof">استلام شدة وسقف كامل بضمان 3x (تشوين + شدة وحدادة + صب)</option>
              <option value="plaster_finish">استلام محارة وتشطيبات بضمان 3x (شقة / فيلا / مبنى)</option>
              <option value="four_visits">باقة 4 زيارات هندسية شاملة بضمان 3x</option>
              <option value="full_consulting">استشارات وإدارة مشروع كامل من البداية للتسليم (3x)</option>
              <option value="single_visit">معاينة هندسية منفردة وتقرير فني معتمد</option>
            </select>
            <input id="insp-area" type="text" required placeholder="المساحة بالمتر المربع وعدد الأدوار (إلزامي للتسعير)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="insp-location" type="text" required placeholder="المحافظة وعنوان الموقع بالتفصيل" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="insp-phone" type="tel" required value="${app.esc(app.profile?.phone || '')}" placeholder="رقم الهاتف للتواصل" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="insp-notes" rows="2" placeholder="ملاحظات إضافية عن البند المطلوب استلامه..." class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button id="insp-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">إرسال للإدارة لتحديد السعر</button>
          </form>
          ${this.myInspections.length ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2">
              <h4 class="text-xs font-extrabold text-amber-400">طلبات الاستلام والضمان الخاصة بي</h4>
              ${this.myInspections.map((r) => `
                <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                  <div class="font-bold text-white">${app.esc(r.packageLabel)}</div>
                  <div class="text-[10px] text-slate-400">${app.esc(r.area)} — ${app.esc(r.location)}</div>
                  ${r.quotedPrice ? `<div class="font-black text-emerald-400">السعر المحدد: ${app.fmtMoney(r.quotedPrice)} ج.م</div>` : `<div class="text-[10px] text-amber-300">بانتظار تسعير الإدارة</div>`}
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    },

    renderVipLaborTab(app) {
      return `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-900/50 to-slate-950 border border-amber-500/40 space-y-1">
            <div class="text-xs font-black text-amber-300"><i class="fa-solid fa-people-group me-1"></i> طلب عمالة VIP مضمونة من ضمان سايت</div>
            <p class="text-[11px] text-slate-300">للشركات والمهندسين والأفراد — نوفر فرق عمل مضمونة في كل القطاعات.</p>
          </div>
          <form onsubmit="DamanProjects.submitVipLabor(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <select id="vl-cat" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-bold text-white">
              ${window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}">${c.ar}</option>`).join('')}
            </select>
            <input id="vl-trade" type="text" required placeholder="التخصص المطلوب (نجارين، حدادين، مبيضين محارة...)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="vl-count" type="number" min="1" required placeholder="عدد العمال" class="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              <input id="vl-days" type="text" required placeholder="المدة (مثلاً 10 أيام)" class="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <input id="vl-location" type="text" required placeholder="المحافظة ومكان الموقع" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="vl-phone" type="tel" required value="${app.esc(app.profile?.phone || '')}" placeholder="رقم الهاتف للتواصل" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <button id="vl-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">إرسال طلب عمالة VIP للإدارة</button>
          </form>
        </div>`;
    },

    async submitInspectionRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const sel = document.getElementById('insp-pkg');
      try {
        await app.db.collection('vipRequests').add({
          userId: app.user.uid, userName: app.profile.name || '', userEmail: app.profile.email || '',
          packageId: sel.value, packageLabel: sel.options[sel.selectedIndex].text,
          area: document.getElementById('insp-area').value.trim(),
          location: document.getElementById('insp-location').value.trim(),
          phone: document.getElementById('insp-phone').value.trim(),
          notes: document.getElementById('insp-notes').value.trim(),
          status: 'pending', quotedPrice: 0, adminNote: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', 'طلب استلام هندسي وضمان 3x جديد', `${sel.options[sel.selectedIndex].text} — ${document.getElementById('insp-area').value.trim()}`);
        e.target.reset();
        app.toast('تم إرسال طلب الاستلام الهندسي للإدارة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async submitVipLabor(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const trade = document.getElementById('vl-trade').value.trim();
      try {
        await app.db.collection('vipLaborRequests').add({
          userId: app.user.uid, userName: app.profile.name || '', userEmail: app.profile.email || '',
          category: document.getElementById('vl-cat').value, trade,
          workersCount: parseInt(document.getElementById('vl-count').value, 10) || 1,
          duration: document.getElementById('vl-days').value.trim(),
          location: document.getElementById('vl-location').value.trim(),
          phone: document.getElementById('vl-phone').value.trim(),
          status: 'pending', adminNote: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', 'طلب عمالة VIP جديد', `${trade} — ${document.getElementById('vl-location').value.trim()}`);
        e.target.reset();
        app.toast('تم إرسال طلب عمالة VIP للإدارة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    render(container, app) {
      this.ensureListeners(app);
      const body =
        this.subTab === 'browse' ? this.renderBrowseTab(app)
        : this.subTab === 'ledger' ? this.renderLedgerTab(app)
        : this.subTab === 'inspection' ? this.renderInspectionTab(app)
        : this.renderVipLaborTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-black text-white"><i class="fa-solid fa-briefcase text-amber-400 me-1.5"></i> المشاريع والسجل والضمان</h2>
            <button onclick="DamanProjects.openPostModal()" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px] flex items-center gap-1">
              <i class="fa-solid fa-plus"></i><span>انشر الآن</span>
            </button>
          </div>
          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanProjects.setSubTab('browse')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'browse' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">السوق</button>
            <button onclick="DamanProjects.setSubTab('ledger')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'ledger' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">سجل العمال</button>
            <button onclick="DamanProjects.setSubTab('inspection')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'inspection' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">ضمان 3x</button>
            <button onclick="DamanProjects.setSubTab('vip_labor')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'vip_labor' ? 'bg-purple-500 text-white' : 'text-slate-400'}">عمالة VIP</button>
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanProjects = ProjectsMod;
  if (window.DamanApp) window.DamanApp.registerModule('projects', ProjectsMod);
})();
