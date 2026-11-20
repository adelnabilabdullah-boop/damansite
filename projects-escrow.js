(function () {
  const ProjectsMod = {
    subTab: 'browse',
    projects: [],
    myInspections: [],
    myVipLabor: [],
    currentProposals: [],
    activeProjectId: null,
    activeDemoItem: null,
    postPhotoBase64: '',
    demoCache: {},
    unsubProjects: null,
    unsubProposals: null,
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
      if (this.unsubInspections) { this.unsubInspections(); this.unsubInspections = null; }
      if (this.unsubVipLabor) { this.unsubVipLabor(); this.unsubVipLabor = null; }
      this.attachedUid = null;
      this.myInspections = [];
      this.myVipLabor = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'projects') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) {
      this.subTab = tab;
      this.rerender();
    },

    setFilter(catId) {
      window.DamanApp.selectedMainCat = catId || 'all';
      this.rerender();
    },

    setGovFilter(gov) {
      window.DamanApp.selectedGov = gov || 'all';
      this.rerender();
    },

    setSearch(val) {
      window.DamanApp.searchQuery = (val || '').trim();
      this.rerender();
    },

    getCatLabel(catId, lang) {
      const c = window.DAMAN_CATEGORIES.find((x) => x.id === catId);
      if (!c) return catId || '-';
      return lang === 'ar' ? c.ar : c.en;
    },

    // Zero-Firebase-Reads Demo Ads Engine (10 realistic ads per sector)
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

      const templates = [
        'تنفيذ متكامل بأعلى مواصفات في قطاع',
        'عروض أسعار خاصة للشركات والأفراد —',
        'توريد وتنفيذ بضمان شامل لـ',
        'فريق عمل جاهز للاستلام الفوري في',
        'تعاقدات مضمونة ومعتمدة لـ',
        'باقات تنفيذ اقتصادية وممتازة في',
        'إشراف وتنفيذ هندسي متكامل لـ',
        'خدمات احترافية وسريعة في مجال',
        'مطلوب وتنفيذ مشاريع كبرى في',
        'أفضل جودة وأسرع تسليم في قطاع'
      ];

      const list = [];
      cats.forEach((cat, cIdx) => {
        const perCat = catId === 'all' ? 2 : 10;
        for (let i = 0; i < perCat; i++) {
          const prov = providers[(cIdx + i) % providers.length];
          const gov = govs[(cIdx * 3 + i * 2) % govs.length];
          const id = `demo_${cat.id}_${i}`;
          const item = {
            id,
            isDemo: true,
            isFeatured: i === 0,
            mainCategory: cat.id,
            title: `${templates[i]} ${cat.ar}`,
            location: gov,
            budget: (i + 2) * 12500,
            description: `نقدم خدمات متكاملة في ${cat.ar} داخل ${gov} وجميع المحافظات بأعلى جودة والتزام تام بالمواعيد. التعاقد والدفع متاح عبر نظام الضمان المالي في ضمان سايت (3.5%) لحماية حقوق الطرفين.`,
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
        open: { cls: 'bg-emerald-500/20 text-emerald-300', ar: 'مفتوح للعروض', en: 'Open' },
        pending_funding: { cls: 'bg-orange-500/20 text-orange-300', ar: 'بانتظار إتمام الشحن', en: 'Pending Funding' },
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
            let w = img.width;
            let h = img.height;
            if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
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
      } catch (e) {
        app.toast(app.lang === 'ar' ? 'تعذر قراءة الصورة' : 'Could not load image', 'error');
      }
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
          <div class="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200 mb-3">
            <i class="fa-solid fa-shield-check me-1"></i> ${isAr ? 'يتم مراجعة المنشور من الإدارة للتأكد من صحة القسم قبل نشره للجميع.' : 'Posts are reviewed by administration before going live.'}
          </div>
          <form onsubmit="DamanProjects.submitProject(event)" class="space-y-2.5">
            <select id="pp-main-cat" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold">${catOpts}</select>
            <select id="pp-gov" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold">${govOpts}</select>
            <input id="pp-title" type="text" required placeholder="${isAr ? 'عنوان المشروع أو الإعلان' : 'Project / Ad Title'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="pp-budget" type="number" min="100" step="any" required placeholder="${isAr ? 'الميزانية التقديرية (ج.م)' : 'Est. Budget (EGP)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-white font-bold" />
              <input id="pp-area" type="text" placeholder="${isAr ? 'المساحة / الكمية (اختياري)' : 'Area / Qty'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <textarea id="pp-desc" rows="3" required placeholder="${isAr ? 'اكتب تفاصيل البنود والمواصفات المطلوبة...' : 'Describe scope & specifications...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>

            <label class="block p-2.5 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 text-center cursor-pointer">
              <span class="text-xs font-bold text-slate-300"><i class="fa-solid fa-image text-amber-400 me-1"></i> ${isAr ? 'إرفاق صورة للموقع أو الإعلان (اختياري)' : 'Attach Photo (Optional)'}</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanProjects.handleProjectPhoto(this)" />
              <div id="post-proj-prev"></div>
            </label>

            <button id="pp-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> ${isAr ? 'إرسال المنشور لمراجعة الإدارة' : 'Submit for Admin Review'}
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

      try {
        // Admin posts go live directly; regular user posts go to pending_review
        const initialStatus = app.isAdmin() ? 'open' : 'pending_review';
        await app.db.collection('projects').add({
          mainCategory: document.getElementById('pp-main-cat').value,
          location: document.getElementById('pp-gov').value,
          title: document.getElementById('pp-title').value.trim(),
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
        this.postPhotoBase64 = '';
        document.getElementById('daman-post-project-modal').classList.add('hidden');
        app.toast(
          app.isAdmin()
            ? (isAr ? 'تم نشر المنشور بنجاح' : 'Published successfully')
            : (isAr ? 'تم إرسال منشورك بنجاح وهو الآن قيد مراجعة الإدارة قبل النشر' : 'Submitted for admin review'),
          'success'
        );
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

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
        this.unsubProposals = app.db
          .collection('projects')
          .doc(projectId)
          .collection('proposals')
          .onSnapshot(
            (snap) => {
              this.currentProposals = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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

    buildMilestonesFromPlan(total, plan) {
      const t = Number(total);
      if (plan === 'two') {
        const m1 = Math.round(t * 0.5 * 100) / 100;
        const m2 = Math.round((t - m1) * 100) / 100;
        return [
          { id: 1, titleAr: 'الدفعة الأولى (50% - بدء وتشوين)', titleEn: 'Stage 1 (50%)', amount: m1, status: 'funded' },
          { id: 2, titleAr: 'الدفعة الثانية (50% - استلام نهائي)', titleEn: 'Stage 2 (50%)', amount: m2, status: 'funded' }
        ];
      }
      if (plan === 'three') {
        const m1 = Math.round(t * 0.3 * 100) / 100;
        const m2 = Math.round(t * 0.4 * 100) / 100;
        const m3 = Math.round((t - m1 - m2) * 100) / 100;
        return [
          { id: 1, titleAr: 'الدفعة الأولى (30% - تجهيز وبدء)', titleEn: 'Stage 1 (30%)', amount: m1, status: 'funded' },
          { id: 2, titleAr: 'الدفعة الثانية (40% - منتصف التنفيذ)', titleEn: 'Stage 2 (40%)', amount: m2, status: 'funded' },
          { id: 3, titleAr: 'الدفعة الثالثة (30% - استلام نهائي)', titleEn: 'Stage 3 (30%)', amount: m3, status: 'funded' }
        ];
      }
      return [{ id: 1, titleAr: 'دفعة كاملة عند الاستلام (100%)', titleEn: 'Full Payment (100%)', amount: t, status: 'funded' }];
    },

    planLabel(plan, isAr) {
      if (plan === 'two') return isAr ? 'دفعتين (50% / 50%)' : '2 Stages (50%/50%)';
      if (plan === 'three') return isAr ? '3 دفعات (30% / 40% / 30%)' : '3 Stages (30%/40%/30%)';
      return isAr ? 'دفعة واحدة عند الاستلام (100%)' : 'Single Payment (100%)';
    },

    refreshDetailModal() {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const modal = document.getElementById('daman-project-detail-modal');
      if (!modal || !this.activeProjectId) return;

      const proj = this.activeDemoItem || this.projects.find((p) => p.id === this.activeProjectId);
      if (!proj) {
        modal.innerHTML = `<div class="bg-slate-900 p-6 rounded-2xl text-xs text-slate-300">${isAr ? 'لم يتم العثور على المنشور' : 'Not found'}</div>`;
        return;
      }

      const isDemo = !!proj.isDemo;
      const uid = app.user ? app.user.uid : null;
      const isOwner = !isDemo && uid && proj.clientId === uid;
      const isAwarded = !isDemo && uid && proj.awardedTo === uid;
      const catLabel = this.getCatLabel(proj.mainCategory, app.lang);
      const alreadyBid = !isDemo && uid && this.currentProposals.some((b) => b.bidderId === uid);
      const stars = '★'.repeat(Math.round(proj.clientRating || 4)) + '☆'.repeat(5 - Math.round(proj.clientRating || 4));
      const chatTargetUid = isDemo ? 'admin' : proj.clientId;

      // Pending Funding Banner (Initial Hold when balance < contract amount)
      let pendingFundingHtml = '';
      if (!isDemo && proj.status === 'pending_funding') {
        const reqAmt = Number(proj.contractAmount || 0);
        const curAvail = Number(app.profile?.balanceAvailable || 0);
        const shortfall = Math.max(0, Math.round((reqAmt - curAvail) * 100) / 100);
        pendingFundingHtml = `
          <div class="p-3.5 rounded-2xl bg-orange-500/15 border border-orange-500/40 space-y-2.5">
            <div class="text-xs font-black text-orange-300"><i class="fa-solid fa-hourglass-half me-1"></i> ${isAr ? 'حجز مبدئي — بانتظار إتمام الشحن' : 'Initial Hold — Awaiting Funding'}</div>
            <p class="text-[11px] text-orange-100 leading-relaxed">
              ${isAr
                ? `تم قبول عرض <b>${app.esc(proj.awardedCompany || proj.awardedName)}</b> بقيمة <b>${app.fmtMoney(reqAmt)} ج.م</b> مبدئياً.`
                : `Proposal by <b>${app.esc(proj.awardedCompany || proj.awardedName)}</b> (${app.fmtMoney(reqAmt)} EGP) is provisionally accepted.`}
            </p>
            ${isOwner ? (
              shortfall > 0
                ? `<button onclick="DamanProjects.closeDetailModal(); DamanWallet.openDepositWithAmount(${shortfall})" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">
                     <i class="fa-solid fa-wallet me-1"></i> ${isAr ? `اشحن الفرق الآن (${app.fmtMoney(shortfall)} ج.م)` : `Deposit Shortfall (${app.fmtMoney(shortfall)} EGP)`}
                   </button>`
                : `<button onclick="DamanProjects.finalizePendingFunding('${proj.id}')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                     <i class="fa-solid fa-shield-check me-1"></i> ${isAr ? `تفعيل العقد وحجز ${app.fmtMoney(reqAmt)} ج.م الآن` : `Lock ${app.fmtMoney(reqAmt)} EGP & Activate`}
                   </button>`
            ) : ''}
          </div>`;
      }

      // Active Escrow Contract Section
      let escrowHtml = '';
      if (!isDemo && (proj.status === 'in_progress' || proj.status === 'completed' || proj.status === 'disputed')) {
        const rate = app.getCommissionRate();
        const fee = Math.round(Number(proj.contractAmount || 0) * rate * 100) / 100;
        const net = Math.round((Number(proj.contractAmount || 0) - fee) * 100) / 100;
        const ms = proj.milestones || [];

        escrowHtml = `
          <div class="p-3.5 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-amber-500/40 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="text-xs font-black text-amber-400"><i class="fa-solid fa-file-contract me-1"></i> ${isAr ? 'عقد الضمان المالي (Escrow)' : 'Escrow Contract'}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">${isAr ? 'رقم العقد:' : 'Contract #'} ${app.esc(proj.contractNumber || proj.id.slice(0, 8).toUpperCase())}</div>
              </div>
              ${(isOwner || isAwarded || app.isAdmin()) ? `
                <button onclick="DamanProjects.printContractA4('${proj.id}')" class="px-2.5 py-1.5 rounded-lg bg-white text-slate-950 font-black text-[10px] flex items-center gap-1">
                  <i class="fa-solid fa-print"></i><span>${isAr ? 'عقد A4 PDF' : 'Print A4'}</span>
                </button>` : ''}
            </div>

            <div class="grid grid-cols-3 gap-1.5 text-center">
              <div class="p-2 rounded-xl bg-slate-950/80"><div class="text-[9px] text-slate-400">${isAr ? 'قيمة العقد' : 'Total'}</div><div class="text-[11px] font-black text-white mt-0.5">${app.fmtMoney(proj.contractAmount)}</div></div>
              <div class="p-2 rounded-xl bg-slate-950/80"><div class="text-[9px] text-slate-400">${isAr ? 'عمولة 3.5%' : 'Fee 3.5%'}</div><div class="text-[11px] font-black text-amber-400 mt-0.5">${app.fmtMoney(fee)}</div></div>
              <div class="p-2 rounded-xl bg-slate-950/80"><div class="text-[9px] text-slate-400">${isAr ? 'صافي المنفّذ' : 'Net'}</div><div class="text-[11px] font-black text-emerald-400 mt-0.5">${app.fmtMoney(net)}</div></div>
            </div>

            <div class="space-y-2">
              ${ms.map((m, idx) => `
                <div class="p-2.5 rounded-xl bg-slate-950/90 border ${m.status === 'released' ? 'border-emerald-500/30' : 'border-slate-800'} flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold text-white">${app.esc(isAr ? m.titleAr : m.titleEn)}</div>
                    <div class="text-[10px] text-amber-300 font-extrabold">${app.fmtMoney(m.amount)} ${app.t('egp')}</div>
                  </div>
                  ${m.status === 'released'
                    ? `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0"><i class="fa-solid fa-check me-1"></i>${isAr ? 'تم التحرير' : 'Released'}</span>`
                    : (isOwner && proj.status === 'in_progress')
                      ? `<button onclick="DamanProjects.releaseMilestone('${proj.id}', ${idx})" class="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">${isAr ? 'استلام وتحرير' : 'Release'}</button>`
                      : `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 shrink-0">${isAr ? 'محجوز بالضمان' : 'In Escrow'}</span>`}
                </div>`).join('')}
            </div>

            ${(isOwner || isAwarded) && proj.status === 'in_progress' ? `
              <button onclick="DamanProjects.openDisputeModal('${proj.id}')" class="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-[11px]">
                <i class="fa-solid fa-scale-balanced me-1"></i> ${isAr ? 'فتح نزاع ومراجعة إدارية' : 'Open Dispute'}
              </button>` : ''}

            ${proj.status === 'completed' && isOwner && !proj.clientRated ? `
              <button onclick="DamanProjects.openReviewModal('${proj.id}','${proj.awardedTo}','${app.esc(proj.awardedCompany || proj.awardedName).replace(/'/g, "\\'")}','client')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-star me-1"></i> ${isAr ? 'تقييم المنفّذ الآن' : 'Rate Provider'}
              </button>` : ''}

            ${proj.status === 'completed' && isAwarded && !proj.providerRated ? `
              <button onclick="DamanProjects.openReviewModal('${proj.id}','${proj.clientId}','${app.esc(proj.clientName).replace(/'/g, "\\'")}','provider')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-star me-1"></i> ${isAr ? 'تقييم العميل الآن' : 'Rate Client'}
              </button>` : ''}
          </div>`;
      }

      // Bid Form (real open projects only)
      let bidFormHtml = '';
      if (!isDemo && proj.status === 'open' && uid && !isOwner && !alreadyBid) {
        bidFormHtml = `
          <form onsubmit="DamanProjects.submitProposal(event, '${proj.id}')" class="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2.5">
            <h4 class="text-xs font-extrabold text-emerald-400"><i class="fa-solid fa-hand-holding-dollar me-1"></i> ${isAr ? 'تقديم عرض سعر وتكلفة' : 'Submit Cost Proposal'}</h4>
            <div class="grid grid-cols-2 gap-2">
              <input id="bid-cost" type="number" min="100" step="any" required placeholder="${isAr ? 'التكلفة الإجمالية (ج.م)' : 'Total Cost (EGP)'}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white" />
              <input id="bid-days" type="number" min="1" required placeholder="${isAr ? 'المدة (أيام)' : 'Days'}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            </div>
            <select id="bid-plan" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-bold">
              <option value="single">${isAr ? 'دفعة واحدة عند الاستلام (100%)' : 'Single Payment (100%)'}</option>
              <option value="two">${isAr ? 'دفعتين (50% بدء + 50% استلام)' : '2 Stages (50% + 50%)'}</option>
              <option value="three" selected>${isAr ? '3 دفعات (30% + 40% + 30%)' : '3 Stages (30% + 40% + 30%)'}</option>
            </select>
            <textarea id="bid-notes" rows="2" required placeholder="${isAr ? 'المواصفات الفنية والضمان المقدم...' : 'Specs & warranty...'}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"></textarea>
            <button id="bid-submit-btn" type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">${isAr ? 'إرسال عرض السعر' : 'Submit Proposal'}</button>
          </form>`;
      }

      const proposalsHtml = isDemo
        ? `
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div class="text-xs font-extrabold text-amber-300"><i class="fa-solid fa-star me-1"></i> ${isAr ? 'تقييمات العملاء السابقين' : 'Client Reviews'} (${proj.clientRating} ★)</div>
            ${(proj.demoReviews || []).map((r) => `<div class="text-[11px] text-slate-200 bg-slate-950/70 p-2 rounded-lg"><b>${app.esc(r.fromName)}:</b> ${app.esc(r.comment)}</div>`).join('')}
          </div>`
        : `
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-white"><i class="fa-solid fa-list-check text-amber-400 me-1"></i> ${isAr ? 'عروض الأسعار المقدّمة' : 'Proposals'} (${this.currentProposals.length})</h4>
            ${!this.currentProposals.length
              ? `<div class="text-center text-[11px] text-slate-400 py-3 bg-slate-950/60 rounded-xl">${isAr ? 'لا توجد عروض أسعار بعد' : 'No proposals yet'}</div>`
              : this.currentProposals.map((b) => `
                  <div class="p-3 rounded-xl bg-slate-950/80 border ${b.status === 'accepted' ? 'border-emerald-500' : 'border-slate-800'} space-y-2">
                    <div class="flex items-start justify-between gap-2">
                      <button type="button" onclick="DamanApp.openPublicProfile('${b.bidderId}',{name:'${app.esc(b.bidderCompany || b.bidderName).replace(/'/g, "\\'")}',accountType:'${b.bidderRole}',ratingAvg:${b.bidderRating || 0},ratingCount:${b.bidderRatingCount || 0}})" class="text-start min-w-0">
                        <div class="text-xs font-extrabold text-amber-300 underline truncate">${app.esc(b.bidderCompany || b.bidderName)}</div>
                        <div class="text-[10px] text-amber-400">${'★'.repeat(Math.round(b.bidderRating || 0))}${'☆'.repeat(5 - Math.round(b.bidderRating || 0))} (${b.bidderRatingCount || 0})</div>
                      </button>
                      <div class="text-end shrink-0">
                        <div class="text-xs font-black text-emerald-400">${app.fmtMoney(b.totalCost)} ${app.t('egp')}</div>
                        <div class="text-[10px] text-slate-400">${b.durationDays} ${isAr ? 'يوم' : 'days'}</div>
                      </div>
                    </div>
                    <div class="text-[10px] text-sky-300 font-bold">${this.planLabel(b.milestonePlan, isAr)}</div>
                    <p class="text-[11px] text-slate-300">${app.esc(b.notes)}</p>
                    <div class="flex items-center gap-2 pt-1">
                      ${isOwner && proj.status === 'open' ? `
                        <button onclick="DamanProjects.acceptProposal('${proj.id}','${b.id}')" class="flex-1 py-2 rounded-lg bg-amber-500 text-slate-950 font-black text-[11px]">
                          <i class="fa-solid fa-shield-check me-1"></i> ${isAr ? 'قبول وحجز الضمان' : 'Accept & Escrow'}
                        </button>` : ''}
                      ${uid && uid !== b.bidderId ? `
                        <button onclick="DamanApp.openChatWith('${b.bidderId}','${app.esc(b.bidderCompany || b.bidderName).replace(/'/g, "\\'")}','${proj.id}','${app.esc(proj.title).replace(/'/g, "\\'")}')" class="px-3 py-2 rounded-lg bg-slate-800 text-sky-300 font-bold text-[11px]"><i class="fa-solid fa-comment-dots"></i></button>` : ''}
                    </div>
                  </div>`).join('')}
          </div>`;

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 max-h-[92vh] overflow-y-auto space-y-3.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap mb-1">
                ${proj.isFeatured ? `<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">${isAr ? 'إعلان مميز ★' : 'Featured ★'}</span>` : ''}
                ${this.statusBadge(proj.status, isAr)}
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${app.esc(catLabel)}</span>
              </div>
              <h3 class="text-sm font-black text-white leading-snug">${app.esc(proj.title)}</h3>
            </div>
            <button onclick="DamanProjects.closeDetailModal()" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 shrink-0"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${proj.photoBase64 ? `<img src="${proj.photoBase64}" class="w-full max-h-48 object-cover rounded-xl border border-slate-800" />` : ''}

          <!-- Clickable Owner Profile Bar -->
          <div onclick="DamanApp.openPublicProfile('${proj.clientId}',{name:'${app.esc(proj.clientName).replace(/'/g, "\\'")}',phone:'${app.esc(proj.clientPhone || '')}',accountType:'${proj.clientAccountType || 'company'}',ratingAvg:${proj.clientRating || 4.8},ratingCount:${proj.clientRatingCount || 5},kycStatus:'verified'})"
            class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-amber-500/40">
            <div class="min-w-0">
              <div class="text-xs font-extrabold text-amber-300 truncate"><i class="fa-solid fa-user-circle me-1"></i> ${app.esc(proj.clientName)}</div>
              <div class="text-[10px] text-amber-400">${stars} <span class="text-slate-400">(${proj.clientRatingCount || 0} ${isAr ? 'تقييم' : 'reviews'}) — ${isAr ? 'اضغط لعرض الصفحة' : 'View profile'}</span></div>
            </div>
            <div class="text-end shrink-0">
              <div class="text-xs font-black text-emerald-400">${app.fmtMoney(proj.contractAmount || proj.budget)} ${app.t('egp')}</div>
              <div class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot text-amber-400 me-0.5"></i>${app.esc(proj.location)}</div>
            </div>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">${app.esc(proj.description)}</p>

          <!-- Contact & Share Actions -->
          <div class="grid grid-cols-3 gap-1.5">
            <button onclick="DamanApp.revealPhoneWithAdvice('${app.esc(proj.clientPhone || '01000000000')}','${app.esc(proj.clientName).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-[11px]">
              <i class="fa-solid fa-phone me-1"></i>${isAr ? 'الهاتف' : 'Phone'}
            </button>
            <button onclick="DamanProjects.closeDetailModal(); DamanApp.openChatWith('${chatTargetUid}','${app.esc(proj.clientName).replace(/'/g, "\\'")}','${proj.id}','${app.esc(proj.title).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 font-extrabold text-[11px]">
              <i class="fa-solid fa-comments me-1"></i>${isAr ? 'دردشة' : 'Chat'}
            </button>
            <button onclick="DamanApp.shareOnWhatsApp('${app.esc(proj.title).replace(/'/g, "\\'")}','${app.esc(proj.location)} - ${app.fmtMoney(proj.budget)} ج.م')" class="py-2 rounded-xl bg-green-600/20 border border-green-500/40 text-green-300 font-extrabold text-[11px]">
              <i class="fa-brands fa-whatsapp me-1"></i>${isAr ? 'مشاركة' : 'Share'}
            </button>
          </div>

          ${pendingFundingHtml}
          ${escrowHtml}
          ${bidFormHtml}
          ${proposalsHtml}
        </div>`;
    },

    async submitProposal(e, projectId) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const totalCost = parseFloat(document.getElementById('bid-cost').value);
      const durationDays = parseInt(document.getElementById('bid-days').value, 10);
      const milestonePlan = document.getElementById('bid-plan').value;
      const notes = document.getElementById('bid-notes').value.trim();
      const btn = document.getElementById('bid-submit-btn');
      if (btn) btn.disabled = true;

      const proj = this.projects.find((p) => p.id === projectId);
      try {
        await app.db.collection('projects').doc(projectId).collection('proposals').add({
          projectId,
          bidderId: app.user.uid,
          bidderName: app.profile.kycFullName || app.profile.name || '',
          bidderEmail: app.profile.email || app.user.email || '',
          bidderCompany: app.profile.companyName || '',
          bidderCR: app.profile.commercialReg || '',
          bidderRole: app.profile.accountType || 'contractor',
          bidderVerified: app.profile.kycStatus === 'verified',
          bidderRating: app.profile.ratingAvg || 0,
          bidderRatingCount: app.profile.ratingCount || 0,
          totalCost,
          durationDays,
          milestonePlan,
          notes,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.db.collection('projects').doc(projectId).update({
          proposalsCount: firebase.firestore.FieldValue.increment(1)
        });
        if (proj && proj.clientId) {
          await app.db.collection('notifications').add({
            userId: proj.clientId,
            title: isAr ? 'عرض سعر جديد على مشروعك' : 'New Proposal Received',
            body: `${app.profile.companyName || app.profile.name} — ${app.fmtMoney(totalCost)} ${app.t('egp')}`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        app.toast(isAr ? 'تم إرسال عرض السعر بنجاح' : 'Proposal submitted', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    // Smart Escrow Acceptance: Locks immediately if balance is enough, or puts on Initial Hold (pending_funding)
    async acceptProposal(projectId, proposalId) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const prop = this.currentProposals.find((b) => b.id === proposalId);
      if (!prop) return;

      const avail = Number(app.profile.balanceAvailable || 0);
      const totalCost = Number(prop.totalCost || 0);
      const contractNumber = 'DMN-' + Date.now().toString().slice(-6);
      const milestones = this.buildMilestonesFromPlan(totalCost, prop.milestonePlan);

      // Case 1: Insufficient balance -> Provisional Hold (pending_funding) + Direct Top-Up button
      if (avail < totalCost) {
        const shortfall = Math.round((totalCost - avail) * 100) / 100;
        const okHold = window.confirm(
          isAr
            ? `رصيدك المتاح (${app.fmtMoney(avail)} ج.م) أقل من قيمة العرض (${app.fmtMoney(totalCost)} ج.م).\nهل تريد قبول العرض كـ «حجز مبدئي» والانتقال لشحن الفرق (${app.fmtMoney(shortfall)} ج.م)؟`
            : `Available balance (${app.fmtMoney(avail)}) is less than ${app.fmtMoney(totalCost)}. Put on Initial Hold and deposit ${app.fmtMoney(shortfall)} EGP?`
        );
        if (!okHold) return;

        try {
          await app.db.collection('projects').doc(projectId).update({
            status: 'pending_funding',
            contractNumber,
            awardedProposalId: proposalId,
            awardedTo: prop.bidderId,
            awardedName: prop.bidderName,
            awardedEmail: prop.bidderEmail || '',
            awardedCompany: prop.bidderCompany || '',
            awardedCR: prop.bidderCR || '',
            contractAmount: totalCost,
            durationDays: prop.durationDays,
            milestones
          });
          await app.db.collection('projects').doc(projectId).collection('proposals').doc(proposalId).update({ status: 'accepted' });
          await app.db.collection('notifications').add({
            userId: prop.bidderId,
            title: isAr ? 'قبول مبدئي لعرضك — بانتظار شحن العميل' : 'Proposal Provisionally Accepted',
            body: `${contractNumber} (${app.fmtMoney(totalCost)} ${app.t('egp')})`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          this.closeDetailModal();
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(shortfall);
        } catch (err) {
          app.toast(err.message, 'error');
        }
        return;
      }

      // Case 2: Sufficient balance -> Atomic Escrow Lock immediately
      if (!window.confirm(isAr ? `تأكيد قبول العرض وحجز ${app.fmtMoney(totalCost)} ج.م داخل محفظة الضمان (Escrow)؟` : `Lock ${totalCost} EGP in Escrow?`)) return;
      await this.executeAtomicEscrowLock(projectId, proposalId, prop, contractNumber, totalCost, milestones);
    },

    async finalizePendingFunding(projectId) {
      const app = window.DamanApp;
      const proj = this.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const totalCost = Number(proj.contractAmount || 0);
      if (Number(app.profile?.balanceAvailable || 0) < totalCost) {
        return app.toast(app.lang === 'ar' ? 'الرصيد المتاح ما زال غير كافٍ' : 'Balance still insufficient', 'warning');
      }
      await this.executeAtomicEscrowLock(
        projectId,
        proj.awardedProposalId,
        {
          bidderId: proj.awardedTo,
          bidderName: proj.awardedName,
          bidderEmail: proj.awardedEmail,
          bidderCompany: proj.awardedCompany,
          bidderCR: proj.awardedCR,
          durationDays: proj.durationDays
        },
        proj.contractNumber,
        totalCost,
        proj.milestones
      );
    },

    async executeAtomicEscrowLock(projectId, proposalId, prop, contractNumber, totalCost, milestones) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const projRef = app.db.collection('projects').doc(projectId);
      const clientRef = app.db.collection('users').doc(app.user.uid);
      const rate = app.getCommissionRate();

      try {
        await app.db.runTransaction(async (tx) => {
          const [projDoc, clientDoc] = await Promise.all([tx.get(projRef), tx.get(clientRef)]);
          const pData = projDoc.data() || {};
          if (pData.status !== 'open' && pData.status !== 'pending_funding') {
            throw new Error(isAr ? 'العقد غير متاح للتفعيل' : 'Contract cannot be activated');
          }
          const cData = clientDoc.data() || {};
          const curAvail = Number(cData.balanceAvailable || 0);
          const curEscrow = Number(cData.balanceEscrow || 0);
          if (curAvail < totalCost) throw new Error(isAr ? 'الرصيد المتاح غير كافٍ' : 'Insufficient balance');

          tx.update(clientRef, {
            balanceAvailable: Math.round((curAvail - totalCost) * 100) / 100,
            balanceEscrow: Math.round((curEscrow + totalCost) * 100) / 100
          });
          tx.update(projRef, {
            status: 'in_progress',
            contractNumber,
            awardedProposalId: proposalId || '',
            awardedTo: prop.bidderId,
            awardedName: prop.bidderName,
            awardedEmail: prop.bidderEmail || '',
            awardedCompany: prop.bidderCompany || '',
            awardedCR: prop.bidderCR || '',
            contractAmount: totalCost,
            commissionRate: rate,
            commissionAmount: Math.round(totalCost * rate * 100) / 100,
            durationDays: prop.durationDays || 0,
            milestones,
            awardedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          if (proposalId) {
            tx.update(projRef.collection('proposals').doc(proposalId), { status: 'accepted' });
          }
          tx.set(app.db.collection('transactions').doc(), {
            userId: app.user.uid,
            type: 'escrow_lock',
            title: isAr ? `حجز ضمان عقد ${contractNumber}` : `Escrow Lock ${contractNumber}`,
            note: pData.title || '',
            amount: -totalCost,
            projectId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          tx.set(app.db.collection('notifications').doc(), {
            userId: prop.bidderId,
            title: isAr ? 'تم تفعيل عقد الضمان وحجز المبلغ' : 'Escrow Funded & Active',
            body: `${pData.title || ''} — ${contractNumber} (${app.fmtMoney(totalCost)} ${app.t('egp')})`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        app.toast(isAr ? 'تم تفعيل عقد الضمان المالي وحجز المبلغ بأمان' : 'Escrow contract activated', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    async releaseMilestone(projectId, msIndex) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const proj = this.projects.find((p) => p.id === projectId);
      if (!proj || !proj.milestones || !proj.milestones[msIndex]) return;

      const ms = proj.milestones[msIndex];
      const rate = app.getCommissionRate();
      const fee = Math.round(Number(ms.amount) * rate * 100) / 100;
      const net = Math.round((Number(ms.amount) - fee) * 100) / 100;

      if (!window.confirm(isAr ? `تأكيد استلام "${ms.titleAr}" وتحرير ${app.fmtMoney(ms.amount)} ج.م (صافي المنفّذ ${app.fmtMoney(net)} ج.م بعد خصم 3.5%)؟` : `Release ${ms.amount} EGP?`)) return;

      const projRef = app.db.collection('projects').doc(projectId);
      const clientRef = app.db.collection('users').doc(proj.clientId);
      const provRef = app.db.collection('users').doc(proj.awardedTo);

      try {
        await app.db.runTransaction(async (tx) => {
          const [projDoc, clientDoc, provDoc] = await Promise.all([tx.get(projRef), tx.get(clientRef), tx.get(provRef)]);
          const pData = projDoc.data();
          if (!pData || pData.status !== 'in_progress') throw new Error(isAr ? 'العقد غير نشط' : 'Contract not active');

          const updatedMs = (pData.milestones || []).slice();
          if (!updatedMs[msIndex] || updatedMs[msIndex].status === 'released') throw new Error(isAr ? 'تم التحرير مسبقاً' : 'Already released');

          const amount = Number(updatedMs[msIndex].amount);
          const txFee = Math.round(amount * rate * 100) / 100;
          const txNet = Math.round((amount - txFee) * 100) / 100;
          updatedMs[msIndex] = Object.assign({}, updatedMs[msIndex], { status: 'released', releasedAt: new Date().toISOString() });
          const allDone = updatedMs.every((m) => m.status === 'released');

          tx.update(clientRef, { balanceEscrow: Math.max(0, Math.round((Number((clientDoc.data() || {}).balanceEscrow || 0) - amount) * 100) / 100) });
          tx.update(provRef, { balanceAvailable: Math.round((Number((provDoc.data() || {}).balanceAvailable || 0) + txNet) * 100) / 100 });
          tx.update(projRef, { milestones: updatedMs, status: allDone ? 'completed' : 'in_progress' });

          tx.set(app.db.collection('transactions').doc(), {
            userId: proj.awardedTo,
            type: 'payout_received',
            title: isAr ? `صافي دفعة — ${pData.contractNumber}` : `Net Payout — ${pData.contractNumber}`,
            note: isAr ? `بعد عمولة 3.5% (${app.fmtMoney(txFee)} ج.م)` : `After 3.5% fee`,
            amount: txNet,
            projectId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          tx.set(app.db.collection('platformFees').doc(), {
            projectId, contractNumber: pData.contractNumber || '', grossAmount: amount, feeAmount: txFee, rate,
            clientId: proj.clientId, providerId: proj.awardedTo, createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          tx.set(app.db.collection('notifications').doc(), {
            userId: proj.awardedTo,
            title: isAr ? 'تم تحرير دفعة لمحفظتك' : 'Milestone Released',
            body: `+${app.fmtMoney(txNet)} ${app.t('egp')} (${pData.title})`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        app.toast(isAr ? 'تم تحرير الدفعة بنجاح' : 'Milestone released', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    openDisputeModal(projectId) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      let modal = document.getElementById('daman-dispute-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-dispute-modal';
        modal.className = 'fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-rose-500/40 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-extrabold text-rose-400"><i class="fa-solid fa-scale-balanced me-1"></i> ${isAr ? 'فتح نزاع إداري' : 'Open Dispute'}</h3>
            <button onclick="document.getElementById('daman-dispute-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanProjects.submitDispute(event, '${projectId}')" class="space-y-2.5">
            <textarea id="disp-reason" rows="3" required placeholder="${isAr ? 'اشرح سبب النزاع بالتفصيل...' : 'Explain the dispute...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs">${isAr ? 'تأكيد رفع النزاع للإدارة' : 'Submit Dispute'}</button>
          </form>
        </div>`;
    },

    async submitDispute(e, projectId) {
      e.preventDefault();
      const app = window.DamanApp;
      const proj = this.projects.find((p) => p.id === projectId);
      if (!proj) return;
      try {
        await app.db.collection('disputes').add({
          projectId, contractNumber: proj.contractNumber || '', projectTitle: proj.title || '', contractAmount: proj.contractAmount || 0,
          clientId: proj.clientId, clientName: proj.clientName || '', providerId: proj.awardedTo || '', providerName: proj.awardedCompany || proj.awardedName || '',
          openedBy: app.user.uid, openedByName: app.profile.name || '', reason: document.getElementById('disp-reason').value.trim(),
          status: 'open', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.db.collection('projects').doc(projectId).update({ status: 'disputed' });
        document.getElementById('daman-dispute-modal').classList.add('hidden');
        app.toast(app.lang === 'ar' ? 'تم رفع النزاع للإدارة بنجاح' : 'Dispute submitted', 'warning');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    openReviewModal(projectId, targetUid, targetName, side) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      let modal = document.getElementById('daman-review-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-review-modal';
        modal.className = 'fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-extrabold text-amber-400"><i class="fa-solid fa-star me-1"></i> ${isAr ? 'تقييم' : 'Rate'} ${app.esc(targetName)}</h3>
            <button onclick="document.getElementById('daman-review-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanProjects.submitReview(event,'${projectId}','${targetUid}','${side}')" class="space-y-3">
            <select id="rev-stars" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-extrabold text-amber-400">
              <option value="5">★★★★★ (5/5)</option><option value="4">★★★★☆ (4/5)</option><option value="3">★★★☆☆ (3/5)</option><option value="2">★★☆☆☆ (2/5)</option><option value="1">★☆☆☆☆ (1/5)</option>
            </select>
            <textarea id="rev-comment" rows="3" required placeholder="${isAr ? 'اكتب تقييمك...' : 'Write review...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'حفظ التقييم' : 'Submit'}</button>
          </form>
        </div>`;
    },

    async submitReview(e, projectId, targetUid, side) {
      e.preventDefault();
      const app = window.DamanApp;
      const stars = parseInt(document.getElementById('rev-stars').value, 10) || 5;
      const comment = document.getElementById('rev-comment').value.trim();
      const proj = this.projects.find((p) => p.id === projectId);
      const targetRef = app.db.collection('users').doc(targetUid);
      try {
        await app.db.runTransaction(async (tx) => {
          const tDoc = await tx.get(targetRef);
          const tData = tDoc.data() || {};
          const newCount = Number(tData.ratingCount || 0) + 1;
          const newAvg = Math.round(((Number(tData.ratingAvg || 0) * (newCount - 1) + stars) / newCount) * 10) / 10;
          tx.update(targetRef, { ratingAvg: newAvg, ratingCount: newCount });
          tx.update(app.db.collection('projects').doc(projectId), side === 'client' ? { clientRated: true } : { providerRated: true });
          tx.set(app.db.collection('reviews').doc(), {
            targetUserId: targetUid, fromUserId: app.user.uid, fromName: app.profile.name || '',
            projectId, projectTitle: proj ? proj.title : '', rating: stars, comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        document.getElementById('daman-review-modal').classList.add('hidden');
        app.toast(app.lang === 'ar' ? 'تم تسجيل التقييم بنجاح' : 'Review submitted', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    printContractA4(projectId) {
      const app = window.DamanApp;
      const proj = this.projects.find((p) => p.id === projectId);
      if (!proj) return;
      const total = Number(proj.contractAmount || 0);
      const rate = app.getCommissionRate();
      const fee = Math.round(total * rate * 100) / 100;
      const net = Math.round((total - fee) * 100) / 100;
      const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      const msRows = (proj.milestones || []).map((m, i) => `<tr><td>${i + 1}</td><td>${app.esc(m.titleAr)}</td><td>${app.fmtMoney(m.amount)} ج.م</td><td>${m.status === 'released' ? 'تم التسليم والتحرير' : 'محجوز بالضمان'}</td></tr>`).join('');
      const win = window.open('', '_blank');
      if (!win) return app.toast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning');
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>عقد ضمان سايت</title><style>@page{size:A4 portrait;margin:14mm;}body{font-family:'Cairo','Tahoma',Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11.5px;line-height:1.55;}.sheet{border:2px solid #000;padding:14px 18px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}.sec{background:#eee;border:1px solid #000;padding:4px 8px;font-weight:800;margin:10px 0 6px;}table{width:100%;border-collapse:collapse;margin-bottom:8px;}th,td{border:1px solid #000;padding:5px 7px;text-align:right;}th{background:#f3f3f3;}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px;text-align:center;}.sig{border:1px solid #000;padding:8px 6px 36px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة / حفظ PDF (A4)</button><div class="sheet"><div class="hdr"><div><h2 style="margin:0">عقد تنفيذ أعمال وضمان مالي وسيط (Escrow)</h2><div>منصة ضمان سايت | DamanSite</div></div><div><div><b>رقم العقد:</b> ${app.esc(proj.contractNumber || '')}</div><div><b>التاريخ:</b> ${dateStr}</div></div></div><div class="sec">أولاً: أطراف التعاقد</div><table><tr><th>الطرف الأول (المالك)</th><td>${app.esc(proj.clientName || '-')}</td><th>البريد</th><td>${app.esc(proj.clientEmail || '-')}</td></tr><tr><th>الطرف الثاني (المنفّذ)</th><td>${app.esc(proj.awardedCompany || proj.awardedName || '-')}</td><th>البريد</th><td>${app.esc(proj.awardedEmail || '-')}</td></tr></table><div class="sec">ثانياً: نطاق المشروع</div><table><tr><th>العنوان</th><td><b>${app.esc(proj.title)}</b></td><th>الموقع والمدة</th><td>${app.esc(proj.location)} (${proj.durationDays || '-'} يوم)</td></tr><tr><th>التفاصيل</th><td colspan="3">${app.esc(proj.description)}</td></tr></table><div class="sec">ثالثاً: القيمة وجدول الدفعات</div><table><tr><th>الإجمالي</th><th>عمولة الضمان (3.5%)</th><th>صافي المنفّذ</th></tr><tr><td><b>${app.fmtMoney(total)} ج.م</b></td><td>${app.fmtMoney(fee)} ج.م</td><td><b>${app.fmtMoney(net)} ج.م</b></td></tr></table><table><thead><tr><th>#</th><th>المرحلة</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${msRows}</tbody></table><div class="sigs"><div class="sig">توقيع الطرف الأول</div><div class="sig">توقيع الطرف الثاني</div><div class="sig">اعتماد ضمان سايت</div></div></div></body></html>`);
      win.document.close();
    },

    renderProjectCard(proj, app) {
      const isAr = app.lang === 'ar';
      const catLabel = this.getCatLabel(proj.mainCategory, app.lang);
      const stars = '★'.repeat(Math.round(proj.clientRating || 4)) + '☆'.repeat(5 - Math.round(proj.clientRating || 4));
      return `
        <div onclick="DamanProjects.openProjectDetail('${proj.id}')" class="glass-card rounded-2xl p-3.5 space-y-2 cursor-pointer transition-all ${proj.isFeatured ? 'border-amber-500/70 bg-amber-500/5' : 'hover:border-amber-500/40'}">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              ${proj.isFeatured ? `<span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shrink-0">${isAr ? 'مميز ★' : 'Featured ★'}</span>` : ''}
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
            <span class="truncate"><i class="fa-solid fa-user me-1"></i>${app.esc(proj.clientName || '-')} <span class="text-amber-400 ms-1">${stars}</span></span>
            <span class="shrink-0"><i class="fa-solid fa-file-signature text-sky-400 me-1"></i>${proj.proposalsCount || 0} ${isAr ? 'عروض' : 'bids'}</span>
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
        if (selCat !== 'all' && p.mainCategory !== selCat) return false;
        if (selGov !== 'all' && p.location !== selGov) return false;
        if (q && !(p.title + ' ' + p.description + ' ' + p.location + ' ' + p.clientName).toLowerCase().includes(q)) return false;
        return true;
      });
      combined.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));

      return `
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <select onchange="DamanProjects.setFilter(this.value)" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-white">
              <option value="all" ${selCat === 'all' ? 'selected' : ''}>${isAr ? 'كل الأقسام (24)' : 'All 24 Sectors'}</option>
              ${window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}" ${selCat === c.id ? 'selected' : ''}>${isAr ? c.ar : c.en}</option>`).join('')}
            </select>
            <select onchange="DamanProjects.setGovFilter(this.value)" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-white">
              <option value="all" ${selGov === 'all' ? 'selected' : ''}>${isAr ? 'كل المحافظات' : 'All Governorates'}</option>
              ${window.DAMAN_GOVERNORATES.map((g) => `<option value="${g}" ${selGov === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>

          <input type="search" value="${app.esc(app.searchQuery || '')}" oninput="DamanProjects.setSearch(this.value)"
            placeholder="${isAr ? 'ابحث بالعنوان أو المحافظة أو اسم الشركة...' : 'Search title, location, company...'}"
            class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white" />

          ${!combined.length
            ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">${isAr ? 'لا توجد نتائج مطابقة للبحث' : 'No matching results'}</div>`
            : `<div class="space-y-2.5">${combined.map((p) => this.renderProjectCard(p, app)).join('')}</div>`}
        </div>`;
    },

    renderMyTab(app) {
      const isAr = app.lang === 'ar';
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
      const uid = app.user.uid;
      const mine = this.projects.filter((p) => p.clientId === uid || p.awardedTo === uid);
      if (!mine.length) return `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">${isAr ? 'لا توجد مشاريع أو عقود خاصة بك بعد' : 'No projects or contracts yet'}</div>`;
      return `<div class="space-y-2.5">${mine.map((p) => this.renderProjectCard(p, app)).join('')}</div>`;
    },

    renderInspectionTab(app) {
      const isAr = app.lang === 'ar';
      return `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-900/60 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-1.5">
            <div class="text-xs font-black text-emerald-300"><i class="fa-solid fa-clipboard-check me-1"></i> ${isAr ? 'باقات معاينة وضمان «ضمان سايت»' : 'DamanSite Inspection Packages'}</div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${isAr ? 'اختر الباقة المناسبة واكتب المساحة والموقع — وتقوم إدارتنا الهندسية بتحديد السعر المناسب وإرساله لك فوراً.' : 'Select a package & enter area — our engineering admin will send your tailored price.'}</p>
          </div>
          <form onsubmit="DamanProjects.submitInspectionRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <select id="insp-pkg" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs font-bold text-white">
              <option value="roof_full">${isAr ? 'باقة سقف كامل (3 زيارات: تشوين + شدة وحدادة + صب) — حسب المساحة' : 'Full Roof Package (3 Visits)'}</option>
              <option value="four_visits">${isAr ? 'باقة 4 زيارات هندسية شاملة — حسب المساحة' : '4 Engineering Visits Package'}</option>
              <option value="full_building">${isAr ? 'باقة مبنى كامل (إشراف واستلام مراحل) — حسب المساحة' : 'Full Building Supervision Package'}</option>
              <option value="finishing_handover">${isAr ? 'معاينة واستلام تشطيبات شقة / فيلا — حسب المساحة' : 'Finishing Handover Inspection'}</option>
              <option value="single_visit">${isAr ? 'معاينة هندسية منفردة وتقرير فني — حسب المساحة' : 'Single Engineering Inspection'}</option>
            </select>
            <input id="insp-area" type="text" required placeholder="${isAr ? 'المساحة بالمتر المربع وعدد الأدوار (إلزامي للتسعير)' : 'Area (m2) & Floors (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="insp-location" type="text" required placeholder="${isAr ? 'المحافظة وعنوان الموقع بالتفصيل' : 'Governorate & Site Address'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="insp-phone" type="tel" required value="${app.esc(app.profile?.phone || '')}" placeholder="${isAr ? 'رقم الهاتف للتواصل' : 'Phone Number'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="insp-notes" rows="2" placeholder="${isAr ? 'ملاحظات إضافية عن حالة المبنى أو المرحلة...' : 'Additional notes...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button id="insp-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">${isAr ? 'إرسال للإدارة لتحديد السعر' : 'Request Admin Pricing'}</button>
          </form>
          ${this.myInspections.length ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2">
              <h4 class="text-xs font-extrabold text-amber-400">${isAr ? 'طلبات المعاينة الخاصة بي' : 'My Inspection Requests'}</h4>
              ${this.myInspections.map((r) => `
                <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                  <div class="font-bold text-white">${app.esc(r.packageLabel)}</div>
                  <div class="text-[10px] text-slate-400">${app.esc(r.area || '')} — ${app.esc(r.location || '')}</div>
                  ${r.quotedPrice ? `<div class="text-xs font-black text-emerald-400">${isAr ? 'السعر المحدد من الإدارة:' : 'Quoted Price:'} ${app.fmtMoney(r.quotedPrice)} ${app.t('egp')}</div>` : `<div class="text-[10px] text-amber-300">${isAr ? 'بانتظار تسعير الإدارة' : 'Awaiting pricing'}</div>`}
                  ${r.adminNote ? `<div class="text-[10px] text-sky-300">${app.esc(r.adminNote)}</div>` : ''}
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    },

    renderVipLaborTab(app) {
      const isAr = app.lang === 'ar';
      return `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-900/50 via-slate-900 to-slate-950 border border-amber-500/40 space-y-1.5">
            <div class="text-xs font-black text-amber-300"><i class="fa-solid fa-people-group me-1"></i> ${isAr ? 'طلب عمالة VIP مضمونة من ضمان سايت' : 'Request Guaranteed VIP Labor'}</div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${isAr ? 'نوفر لك عمالة وفنيين وفرق تنفيذ مضمونة في جميع القطاعات الـ 24 بإشراف مباشر من ضمان سايت.' : 'We supply vetted VIP teams across all 24 sectors directly supervised by DamanSite.'}</p>
          </div>
          <form onsubmit="DamanProjects.submitVipLabor(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <select id="vl-cat" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-bold text-white">
              ${window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}">${isAr ? c.ar : c.en}</option>`).join('')}
            </select>
            <input id="vl-trade" type="text" required placeholder="${isAr ? 'التخصص المطلوب (مثال: نجارين مسلح، حدادين، أفراد أمن...)' : 'Required Specialty / Trade'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="vl-count" type="number" min="1" required placeholder="${isAr ? 'عدد العمال المطلوب' : 'Number of Workers'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              <input id="vl-days" type="text" required placeholder="${isAr ? 'المدة (مثلاً 15 يوم / شهر)' : 'Duration'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <input id="vl-location" type="text" required placeholder="${isAr ? 'المحافظة ومكان الموقع' : 'Governorate & Site Location'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="vl-phone" type="tel" required value="${app.esc(app.profile?.phone || '')}" placeholder="${isAr ? 'رقم الهاتف للتنسيق' : 'Contact Phone'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <button id="vl-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'إرسال طلب عمالة VIP للإدارة' : 'Submit VIP Labor Request'}</button>
          </form>
          ${this.myVipLabor.length ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2">
              <h4 class="text-xs font-extrabold text-amber-400">${isAr ? 'طلبات عمالة VIP الخاصة بي' : 'My VIP Labor Requests'}</h4>
              ${this.myVipLabor.map((r) => `
                <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                  <div class="font-bold text-white">${app.esc(r.trade)} (${r.workersCount} ${isAr ? 'عامل' : 'workers'})</div>
                  <div class="text-[10px] text-slate-400">${app.esc(r.location)} — ${app.esc(r.duration)}</div>
                  <div class="text-[10px] text-emerald-300">${r.adminNote ? app.esc(r.adminNote) : (isAr ? 'قيد المراجعة والتجهيز من الإدارة' : 'Under admin review')}</div>
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    },

    async submitInspectionRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const sel = document.getElementById('insp-pkg');
      const btn = document.getElementById('insp-submit-btn');
      if (btn) btn.disabled = true;
      try {
        await app.db.collection('vipRequests').add({
          userId: app.user.uid, userName: app.profile.name || '', userEmail: app.profile.email || app.user.email || '',
          packageId: sel.value, packageLabel: sel.options[sel.selectedIndex].text,
          area: document.getElementById('insp-area').value.trim(),
          location: document.getElementById('insp-location').value.trim(),
          phone: document.getElementById('insp-phone').value.trim(),
          notes: document.getElementById('insp-notes').value.trim(),
          status: 'pending', quotedPrice: 0, adminNote: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast(app.lang === 'ar' ? 'تم إرسال طلب المعاينة للإدارة وسيصلك السعر قريباً' : 'Inspection request submitted', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
      finally { if (btn) btn.disabled = false; }
    },

    async submitVipLabor(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const btn = document.getElementById('vl-submit-btn');
      if (btn) btn.disabled = true;
      try {
        await app.db.collection('vipLaborRequests').add({
          userId: app.user.uid, userName: app.profile.name || '', userEmail: app.profile.email || app.user.email || '',
          category: document.getElementById('vl-cat').value,
          trade: document.getElementById('vl-trade').value.trim(),
          workersCount: parseInt(document.getElementById('vl-count').value, 10) || 1,
          duration: document.getElementById('vl-days').value.trim(),
          location: document.getElementById('vl-location').value.trim(),
          phone: document.getElementById('vl-phone').value.trim(),
          status: 'pending', adminNote: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast(app.lang === 'ar' ? 'تم إرسال طلب عمالة VIP للإدارة بنجاح' : 'VIP labor request submitted', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
      finally { if (btn) btn.disabled = false; }
    },

    render(container, app) {
      this.ensureListeners(app);
      const isAr = app.lang === 'ar';
      const body =
        this.subTab === 'browse' ? this.renderBrowseTab(app)
        : this.subTab === 'my' ? this.renderMyTab(app)
        : this.subTab === 'inspection' ? this.renderInspectionTab(app)
        : this.renderVipLaborTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-black text-white"><i class="fa-solid fa-briefcase text-amber-400 me-1.5"></i> ${isAr ? 'المشاريع والإعلانات' : 'Projects & Ads'}</h2>
            <button onclick="DamanProjects.openPostModal()" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px] flex items-center gap-1">
              <i class="fa-solid fa-plus"></i><span>${app.t('postProject')}</span>
            </button>
          </div>
          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanProjects.setSubTab('browse')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'browse' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'السوق' : 'Market'}</button>
            <button onclick="DamanProjects.setSubTab('my')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'my' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'مشاريعي' : 'Mine'}</button>
            <button onclick="DamanProjects.setSubTab('inspection')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'inspection' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'المعاينات' : 'Inspect'}</button>
            <button onclick="DamanProjects.setSubTab('vip_labor')" class="py-2 rounded-lg text-[10px] font-extrabold ${this.subTab === 'vip_labor' ? 'bg-purple-500 text-white' : 'text-slate-400'}">${isAr ? 'عمالة VIP' : 'VIP Labor'}</button>
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanProjects = ProjectsMod;
  if (window.DamanApp) window.DamanApp.registerModule('projects', ProjectsMod);
})();
