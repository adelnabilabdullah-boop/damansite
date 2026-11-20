(function () {
  const ProjectsMod = {
    subTab: 'browse',
    projects: [],
    myInspections: [],
    currentProposals: [],
    activeProjectId: null,
    postPhotoBase64: '',
    unsubProjects: null,
    unsubProposals: null,
    unsubInspections: null,
    attachedInspUid: null,

    ensureListeners(app) {
      if (!this.unsubProjects) {
        this.unsubProjects = app.db
          .collection('projects')
          .orderBy('createdAt', 'desc')
          .limit(80)
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
        if (this.unsubInspections) { this.unsubInspections(); this.unsubInspections = null; }
        this.attachedInspUid = null;
        this.myInspections = [];
        return;
      }

      if (this.attachedInspUid !== app.user.uid) {
        if (this.unsubInspections) this.unsubInspections();
        this.attachedInspUid = app.user.uid;
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
      }
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

    setFilter(mainId, subId) {
      const app = window.DamanApp;
      app.selectedMainCat = mainId;
      app.selectedSubCat = subId || null;
      this.rerender();
    },

    getCatLabels(mainId, subId, lang) {
      const main = window.DAMAN_CATEGORIES.find((c) => c.id === mainId);
      const sub = main ? main.subs.find((s) => s.id === subId) : null;
      const isAr = lang === 'ar';
      return {
        mainLabel: main ? (isAr ? main.ar : main.en) : mainId || '-',
        subLabel: sub ? (isAr ? sub.ar : sub.en) : subId || '-'
      };
    },

    statusBadge(status, isAr) {
      const map = {
        open: { cls: 'bg-emerald-500/20 text-emerald-300', ar: 'مفتوح للعروض', en: 'Open' },
        in_progress: { cls: 'bg-amber-500/20 text-amber-300', ar: 'عقد ضمان نشط', en: 'Escrow Active' },
        completed: { cls: 'bg-sky-500/20 text-sky-300', ar: 'مكتمل', en: 'Completed' },
        disputed: { cls: 'bg-rose-500/20 text-rose-300', ar: 'قيد النزاع', en: 'Disputed' },
        suspended: { cls: 'bg-slate-700 text-slate-300', ar: 'موقوف إدارياً', en: 'Suspended' }
      };
      const st = map[status] || map.open;
      return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}">${isAr ? st.ar : st.en}</span>`;
    },

    compressImage(file, maxW = 850, quality = 0.6) {
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
        if (prev) {
          prev.innerHTML = `<img src="${this.postPhotoBase64}" class="w-full max-h-36 object-cover rounded-xl border border-emerald-500/40 mt-2" />`;
        }
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

      const defaultMain = app.selectedMainCat && app.selectedMainCat !== 'all' ? app.selectedMainCat : window.DAMAN_CATEGORIES[0].id;
      const mainOptions = window.DAMAN_CATEGORIES.map(
        (c) => `<option value="${c.id}" ${c.id === defaultMain ? 'selected' : ''}>${isAr ? c.ar : c.en}</option>`
      ).join('');

      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-extrabold text-amber-400"><i class="fa-solid fa-plus-circle me-1"></i> ${isAr ? 'نشر مشروع أو طلب تنفيذ' : 'Post a New Project'}</h3>
            <button onclick="document.getElementById('daman-post-project-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanProjects.submitProject(event)" class="space-y-2.5">
            <select id="pp-main-cat" onchange="DamanProjects.populateSubSelect()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold">
              ${mainOptions}
            </select>
            <select id="pp-sub-cat" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold"></select>

            <input id="pp-title" type="text" required placeholder="${isAr ? 'عنوان المشروع (مثال: تشطيب شقة 140م سوبر لوكس)' : 'Project Title'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="pp-location" type="text" required placeholder="${isAr ? 'الموقع / المحافظة والمنطقة (مثال: التجمع الخامس)' : 'Location / City'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <div class="grid grid-cols-2 gap-2">
              <input id="pp-budget" type="number" min="500" step="any" required placeholder="${isAr ? 'الميزانية التقديرية (ج.م)' : 'Est. Budget (EGP)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-white font-bold" />
              <input id="pp-area" type="text" placeholder="${isAr ? 'المساحة / الكمية (اختياري)' : 'Area / Qty (Optional)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>

            <textarea id="pp-desc" rows="3" required placeholder="${isAr ? 'اكتب تفاصيل البنود والمواصفات المطلوبة بوضوح...' : 'Describe scope, specs & requirements...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>

            <label class="block p-2.5 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 text-center cursor-pointer">
              <span class="text-xs font-bold text-slate-300"><i class="fa-solid fa-image text-amber-400 me-1"></i> ${isAr ? 'إرفاق صورة للموقع أو الرسم (اختياري)' : 'Attach Site Photo / Plan (Optional)'}</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanProjects.handleProjectPhoto(this)" />
              <div id="post-proj-prev"></div>
            </label>

            <button id="pp-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> ${isAr ? 'نشر المشروع واستقبال العروض' : 'Publish Project'}
            </button>
          </form>
        </div>`;

      this.populateSubSelect(app.selectedSubCat);
    },

    populateSubSelect(preselectSubId) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const mainSel = document.getElementById('pp-main-cat');
      const subSel = document.getElementById('pp-sub-cat');
      if (!mainSel || !subSel) return;
      const mainCat = window.DAMAN_CATEGORIES.find((c) => c.id === mainSel.value) || window.DAMAN_CATEGORIES[0];
      subSel.innerHTML = mainCat.subs
        .map((s) => `<option value="${s.id}" ${s.id === preselectSubId ? 'selected' : ''}>${isAr ? s.ar : s.en}</option>`)
        .join('');
    },

    async submitProject(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const btn = document.getElementById('pp-submit-btn');
      if (btn) btn.disabled = true;

      try {
        await app.db.collection('projects').add({
          mainCategory: document.getElementById('pp-main-cat').value,
          subCategory: document.getElementById('pp-sub-cat').value,
          title: document.getElementById('pp-title').value.trim(),
          location: document.getElementById('pp-location').value.trim(),
          budget: parseFloat(document.getElementById('pp-budget').value) || 0,
          areaSpecs: document.getElementById('pp-area').value.trim(),
          description: document.getElementById('pp-desc').value.trim(),
          photoBase64: this.postPhotoBase64 || '',
          clientId: app.user.uid,
          clientName: app.profile.kycFullName || app.profile.name || '',
          clientEmail: app.profile.email || app.user.email || '',
          clientPhone: app.profile.phone || '',
          clientAccountType: app.profile.accountType || 'client',
          status: 'open',
          proposalsCount: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this.postPhotoBase64 = '';
        document.getElementById('daman-post-project-modal').classList.add('hidden');
        app.toast(isAr ? 'تم نشر المشروع بنجاح وسيظهر للمقاولين والشركات فوراً' : 'Project published successfully', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    openProjectDetail(projectId) {
      const app = window.DamanApp;
      this.activeProjectId = projectId;

      if (this.unsubProposals) {
        this.unsubProposals();
        this.unsubProposals = null;
      }
      this.currentProposals = [];

      let modal = document.getElementById('daman-project-detail-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-project-detail-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');

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

      this.refreshDetailModal();
    },

    closeDetailModal() {
      this.activeProjectId = null;
      if (this.unsubProposals) {
        this.unsubProposals();
        this.unsubProposals = null;
      }
      const modal = document.getElementById('daman-project-detail-modal');
      if (modal) modal.classList.add('hidden');
    },

    buildMilestonesFromPlan(total, plan) {
      const t = Number(total);
      if (plan === 'two') {
        const m1 = Math.round(t * 0.5 * 100) / 100;
        const m2 = Math.round((t - m1) * 100) / 100;
        return [
          { id: 1, titleAr: 'الدفعة الأولى (50% - بدء وتشوين)', titleEn: 'Stage 1 (50% - Start & Mobilization)', amount: m1, status: 'funded' },
          { id: 2, titleAr: 'الدفعة الثانية (50% - استلام نهائي)', titleEn: 'Stage 2 (50% - Final Handover)', amount: m2, status: 'funded' }
        ];
      }
      if (plan === 'three') {
        const m1 = Math.round(t * 0.3 * 100) / 100;
        const m2 = Math.round(t * 0.4 * 100) / 100;
        const m3 = Math.round((t - m1 - m2) * 100) / 100;
        return [
          { id: 1, titleAr: 'الدفعة الأولى (30% - تجهيز وبدء)', titleEn: 'Stage 1 (30% - Kickoff)', amount: m1, status: 'funded' },
          { id: 2, titleAr: 'الدفعة الثانية (40% - منتصف التنفيذ)', titleEn: 'Stage 2 (40% - Midpoint)', amount: m2, status: 'funded' },
          { id: 3, titleAr: 'الدفعة الثالثة (30% - استلام نهائي)', titleEn: 'Stage 3 (30% - Final Handover)', amount: m3, status: 'funded' }
        ];
      }
      return [{ id: 1, titleAr: 'دفعة كاملة عند الاستلام (100%)', titleEn: 'Full Payment on Handover (100%)', amount: t, status: 'funded' }];
    },

    planLabel(plan, isAr) {
      if (plan === 'two') return isAr ? 'دفعتين (50% / 50%)' : '2 Stages (50% / 50%)';
      if (plan === 'three') return isAr ? '3 دفعات (30% / 40% / 30%)' : '3 Stages (30% / 40% / 30%)';
      return isAr ? 'دفعة واحدة عند الاستلام (100%)' : 'Single Payment on Handover (100%)';
    },

    refreshDetailModal() {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const modal = document.getElementById('daman-project-detail-modal');
      if (!modal || !this.activeProjectId) return;

      const proj = this.projects.find((p) => p.id === this.activeProjectId);
      if (!proj) {
        modal.innerHTML = `<div class="bg-slate-900 p-6 rounded-2xl text-xs text-slate-300">${isAr ? 'لم يتم العثور على المشروع' : 'Project not found'}</div>`;
        return;
      }

      const uid = app.user ? app.user.uid : null;
      const isOwner = uid && proj.clientId === uid;
      const isAwarded = uid && proj.awardedTo === uid;
      const cats = this.getCatLabels(proj.mainCategory, proj.subCategory, app.lang);
      const alreadyBid = uid && this.currentProposals.some((b) => b.bidderId === uid);

      // Escrow Contract Section
      let escrowHtml = '';
      if (proj.status === 'in_progress' || proj.status === 'completed' || proj.status === 'disputed') {
        const fee = Math.round(Number(proj.contractAmount || 0) * window.DAMAN_CONFIG.commissionRate * 100) / 100;
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
              <div class="p-2 rounded-xl bg-slate-950/80">
                <div class="text-[9px] text-slate-400">${isAr ? 'قيمة العقد' : 'Total'}</div>
                <div class="text-[11px] font-black text-white mt-0.5">${app.fmtMoney(proj.contractAmount)}</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-950/80">
                <div class="text-[9px] text-slate-400">${isAr ? 'عمولة 3.5%' : 'Fee 3.5%'}</div>
                <div class="text-[11px] font-black text-amber-400 mt-0.5">${app.fmtMoney(fee)}</div>
              </div>
              <div class="p-2 rounded-xl bg-slate-950/80">
                <div class="text-[9px] text-slate-400">${isAr ? 'صافي المنفّذ' : 'Net Payout'}</div>
                <div class="text-[11px] font-black text-emerald-400 mt-0.5">${app.fmtMoney(net)}</div>
              </div>
            </div>

            <div class="text-[11px] text-slate-300 flex items-center justify-between">
              <span>${isAr ? 'المنفّذ المعتمد:' : 'Awarded To:'} <b class="text-white">${app.esc(proj.awardedCompany || proj.awardedName || '-')}</b></span>
              ${(isOwner || isAwarded) ? `
                <button onclick="DamanProjects.startChat('${isOwner ? proj.awardedTo : proj.clientId}','${app.esc((isOwner ? proj.awardedName : proj.clientName) || '').replace(/'/g, "\\'")}','${proj.id}','${app.esc(proj.title).replace(/'/g, "\\'")}')"
                  class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">
                  <i class="fa-solid fa-comments me-1"></i>${isAr ? 'دردشة العقد' : 'Contract Chat'}
                </button>` : ''}
            </div>

            <div class="space-y-2">
              <div class="text-[11px] font-extrabold text-slate-200">${isAr ? 'الدفعات المرحلية (Milestones):' : 'Escrow Milestones:'}</div>
              ${ms.map((m, idx) => `
                <div class="p-2.5 rounded-xl bg-slate-950/90 border ${m.status === 'released' ? 'border-emerald-500/30' : 'border-slate-800'} flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-[11px] font-bold text-white">${app.esc(isAr ? m.titleAr : m.titleEn)}</div>
                    <div class="text-[10px] text-amber-300 font-extrabold">${app.fmtMoney(m.amount)} ${app.t('egp')}</div>
                  </div>
                  ${m.status === 'released'
                    ? `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0"><i class="fa-solid fa-check me-1"></i>${isAr ? 'تم التحرير' : 'Released'}</span>`
                    : (isOwner && proj.status === 'in_progress')
                      ? `<button onclick="DamanProjects.releaseMilestone('${proj.id}', ${idx})" class="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px]">${isAr ? 'استلام وتحرير' : 'Release'}</button>`
                      : `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 shrink-0">${isAr ? 'محجوز بالضمان' : 'In Escrow'}</span>`
                  }
                </div>`).join('')}
            </div>

            ${(isOwner || isAwarded) && proj.status === 'in_progress' ? `
              <button onclick="DamanProjects.openDisputeModal('${proj.id}')" class="w-full py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-[11px]">
                <i class="fa-solid fa-scale-balanced me-1"></i> ${isAr ? 'فتح نزاع ومراجعة إدارية على هذا العقد' : 'Open Administrative Dispute'}
              </button>` : ''}

            ${proj.status === 'completed' && isOwner && !proj.clientRated ? `
              <button onclick="DamanProjects.openReviewModal('${proj.id}','${proj.awardedTo}','${app.esc(proj.awardedCompany || proj.awardedName).replace(/'/g, "\\'")}','client')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-star me-1"></i> ${isAr ? 'تقييم المقاول / الشركة الآن' : 'Rate Contractor / Company'}
              </button>` : ''}

            ${proj.status === 'completed' && isAwarded && !proj.providerRated ? `
              <button onclick="DamanProjects.openReviewModal('${proj.id}','${proj.clientId}','${app.esc(proj.clientName).replace(/'/g, "\\'")}','provider')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-star me-1"></i> ${isAr ? 'تقييم العميل الآن' : 'Rate Client'}
              </button>` : ''}
          </div>`;
      }

      // Proposal Submission Form (for non-owners on open projects)
      let bidFormHtml = '';
      if (proj.status === 'open' && uid && !isOwner && !alreadyBid) {
        bidFormHtml = `
          <form onsubmit="DamanProjects.submitProposal(event, '${proj.id}')" class="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2.5">
            <h4 class="text-xs font-extrabold text-emerald-400"><i class="fa-solid fa-hand-holding-dollar me-1"></i> ${isAr ? 'تقديم عرض سعر وتكلفة' : 'Submit Cost Proposal'}</h4>
            <div class="grid grid-cols-2 gap-2">
              <input id="bid-cost" type="number" min="100" step="any" required placeholder="${isAr ? 'التكلفة الإجمالية (ج.م)' : 'Total Cost (EGP)'}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white" />
              <input id="bid-days" type="number" min="1" required placeholder="${isAr ? 'مدة التنفيذ (أيام)' : 'Duration (Days)'}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            </div>
            <select id="bid-plan" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-bold">
              <option value="single">${isAr ? 'نظام الدفع: دفعة واحدة عند الاستلام (100%)' : 'Payment: Single on Handover (100%)'}</option>
              <option value="two">${isAr ? 'نظام الدفع: دفعتين (50% بدء + 50% استلام)' : 'Payment: 2 Stages (50% + 50%)'}</option>
              <option value="three" selected>${isAr ? 'نظام الدفع: 3 دفعات (30% + 40% + 30%)' : 'Payment: 3 Stages (30% + 40% + 30%)'}</option>
            </select>
            <textarea id="bid-notes" rows="2" required placeholder="${isAr ? 'المواصفات الفنية، الخامات، والضمان المقدم...' : 'Technical specs, materials & warranty...'}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"></textarea>
            <div class="text-[10px] text-slate-400"><i class="fa-solid fa-circle-info text-amber-400 me-1"></i> ${isAr ? 'يتم خصم عمولة الضمان 3.5% تلقائياً عند تحرير الدفعة لمحفظتك.' : 'A 3.5% escrow fee is deducted upon milestone release.'}</div>
            <button id="bid-submit-btn" type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs">
              ${isAr ? 'إرسال عرض السعر للعميل' : 'Submit Proposal'}
            </button>
          </form>`;
      }

      // Proposals List
      const proposalsHtml = `
        <div class="space-y-2">
          <h4 class="text-xs font-extrabold text-white flex items-center justify-between">
            <span><i class="fa-solid fa-list-check text-amber-400 me-1"></i> ${isAr ? 'عروض الأسعار المقدّمة' : 'Submitted Proposals'} (${this.currentProposals.length})</span>
          </h4>
          ${!this.currentProposals.length
            ? `<div class="text-center text-[11px] text-slate-400 py-4 bg-slate-950/60 rounded-xl">${isAr ? 'لا توجد عروض أسعار مقدّمة على هذا المشروع حتى الآن' : 'No proposals submitted yet'}</div>`
            : this.currentProposals.map((b) => {
                const stars = '★'.repeat(Math.round(b.bidderRating || 0)) + '☆'.repeat(5 - Math.round(b.bidderRating || 0));
                return `
                  <div class="p-3 rounded-xl bg-slate-950/80 border ${b.status === 'accepted' ? 'border-emerald-500' : 'border-slate-800'} space-y-2">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-xs font-extrabold text-white">${app.esc(b.bidderCompany || b.bidderName)}</span>
                          <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">${app.getRoleLabel(b.bidderRole)}</span>
                          ${b.bidderVerified ? `<i class="fa-solid fa-circle-check text-sky-400 text-[11px]"></i>` : ''}
                        </div>
                        <div class="text-[10px] text-amber-400 mt-0.5">${stars} <span class="text-slate-400">(${b.bidderRatingCount || 0})</span></div>
                      </div>
                      <div class="text-end shrink-0">
                        <div class="text-xs font-black text-emerald-400">${app.fmtMoney(b.totalCost)} ${app.t('egp')}</div>
                        <div class="text-[10px] text-slate-400">${b.durationDays} ${isAr ? 'يوم' : 'days'}</div>
                      </div>
                    </div>
                    <div class="text-[10px] text-sky-300 font-bold">${this.planLabel(b.milestonePlan, isAr)}</div>
                    <p class="text-[11px] text-slate-300 leading-relaxed">${app.esc(b.notes)}</p>
                    <div class="flex items-center gap-2 pt-1">
                      ${isOwner && proj.status === 'open' ? `
                        <button onclick="DamanProjects.acceptProposal('${proj.id}','${b.id}')" class="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px]">
                          <i class="fa-solid fa-shield-check me-1"></i> ${isAr ? 'قبول وحجز الضمان' : 'Accept & Lock Escrow'}
                        </button>` : ''}
                      ${uid && uid !== b.bidderId ? `
                        <button onclick="DamanProjects.startChat('${b.bidderId}','${app.esc(b.bidderCompany || b.bidderName).replace(/'/g, "\\'")}','${proj.id}','${app.esc(proj.title).replace(/'/g, "\\'")}')" class="px-3 py-2 rounded-lg bg-slate-800 text-sky-300 font-bold text-[11px]">
                          <i class="fa-solid fa-comment-dots"></i>
                        </button>` : ''}
                    </div>
                  </div>`;
              }).join('')}
        </div>`;

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 max-h-[92vh] overflow-y-auto space-y-3.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap mb-1">
                ${this.statusBadge(proj.status, isAr)}
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${app.esc(cats.subLabel)}</span>
              </div>
              <h3 class="text-sm font-black text-white leading-snug">${app.esc(proj.title)}</h3>
            </div>
            <button onclick="DamanProjects.closeDetailModal()" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 shrink-0"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${proj.photoBase64 ? `<img src="${proj.photoBase64}" class="w-full max-h-48 object-cover rounded-xl border border-slate-800" />` : ''}

          <div class="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <div><span class="text-slate-400">${isAr ? 'الموقع:' : 'Location:'}</span> <b class="text-white">${app.esc(proj.location)}</b></div>
            <div><span class="text-slate-400">${isAr ? 'الميزانية:' : 'Budget:'}</span> <b class="text-amber-400">${app.fmtMoney(proj.budget)} ${app.t('egp')}</b></div>
            <div><span class="text-slate-400">${isAr ? 'المالك:' : 'Owner:'}</span> <b class="text-white">${app.esc(proj.clientName)}</b></div>
            ${proj.areaSpecs ? `<div><span class="text-slate-400">${isAr ? 'المساحة:' : 'Area:'}</span> <b class="text-white">${app.esc(proj.areaSpecs)}</b></div>` : ''}
          </div>

          <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">${app.esc(proj.description)}</p>

          ${uid && !isOwner && proj.status === 'open' ? `
            <button onclick="DamanProjects.startChat('${proj.clientId}','${app.esc(proj.clientName).replace(/'/g, "\\'")}','${proj.id}','${app.esc(proj.title).replace(/'/g, "\\'")}')" class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs">
              <i class="fa-solid fa-comments me-1"></i> ${isAr ? 'مراسلة صاحب المشروع للاستفسار' : 'Message Project Owner'}
            </button>` : ''}

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
      if (app.profile.status === 'frozen') return app.toast(app.t('frozenNotice'), 'error');

      const totalCost = parseFloat(document.getElementById('bid-cost').value);
      const durationDays = parseInt(document.getElementById('bid-days').value, 10);
      const milestonePlan = document.getElementById('bid-plan').value;
      const notes = document.getElementById('bid-notes').value.trim();

      if (!totalCost || totalCost < 100) return app.toast(isAr ? 'أدخل تكلفة صحيحة' : 'Enter a valid cost', 'error');

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
            body: `${app.profile.companyName || app.profile.name} — ${app.fmtMoney(totalCost)} ${app.t('egp')} (${proj.title})`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        app.toast(isAr ? 'تم إرسال عرض السعر بنجاح' : 'Proposal submitted successfully', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    async acceptProposal(projectId, proposalId) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');

      const prop = this.currentProposals.find((b) => b.id === proposalId);
      if (!prop) return;

      const avail = Number(app.profile.balanceAvailable || 0);
      const totalCost = Number(prop.totalCost || 0);

      if (avail < totalCost) {
        app.toast(
          isAr
            ? `رصيدك المتاح (${app.fmtMoney(avail)} ج.م) أقل من قيمة العرض (${app.fmtMoney(totalCost)} ج.م). اشحن محفظتك أولاً.`
            : `Available balance (${app.fmtMoney(avail)}) is less than proposal cost (${app.fmtMoney(totalCost)}). Deposit first.`,
          'warning'
        );
        this.closeDetailModal();
        app.switchTab('wallet');
        return;
      }

      const ok = window.confirm(
        isAr
          ? `تأكيد قبول العرض وحجز مبلغ ${app.fmtMoney(totalCost)} ج.م داخل محفظة الضمان (Escrow) لصالح هذا العقد؟`
          : `Confirm accepting proposal and locking ${app.fmtMoney(totalCost)} EGP in Escrow?`
      );
      if (!ok) return;

      const projRef = app.db.collection('projects').doc(projectId);
      const propRef = projRef.collection('proposals').doc(proposalId);
      const clientRef = app.db.collection('users').doc(app.user.uid);
      const contractNumber = 'DMN-' + Date.now().toString().slice(-6);
      const milestones = this.buildMilestonesFromPlan(totalCost, prop.milestonePlan);
      const commissionAmount = Math.round(totalCost * window.DAMAN_CONFIG.commissionRate * 100) / 100;

      try {
        await app.db.runTransaction(async (tx) => {
          const [projDoc, propDoc, clientDoc] = await Promise.all([tx.get(projRef), tx.get(propRef), tx.get(clientRef)]);
          if (!projDoc.exists || projDoc.data().status !== 'open') {
            throw new Error(isAr ? 'هذا المشروع لم يعد مفتوحاً للعروض' : 'Project is no longer open');
          }
          const cData = clientDoc.data() || {};
          const curAvail = Number(cData.balanceAvailable || 0);
          const curEscrow = Number(cData.balanceEscrow || 0);
          if (curAvail < totalCost) {
            throw new Error(isAr ? 'الرصيد المتاح غير كافٍ لحجز مبلغ الضمان' : 'Insufficient available balance');
          }

          tx.update(clientRef, {
            balanceAvailable: Math.round((curAvail - totalCost) * 100) / 100,
            balanceEscrow: Math.round((curEscrow + totalCost) * 100) / 100
          });

          tx.update(projRef, {
            status: 'in_progress',
            contractNumber,
            awardedProposalId: proposalId,
            awardedTo: prop.bidderId,
            awardedName: prop.bidderName,
            awardedEmail: prop.bidderEmail || '',
            awardedCompany: prop.bidderCompany || '',
            awardedCR: prop.bidderCR || '',
            contractAmount: totalCost,
            commissionRate: window.DAMAN_CONFIG.commissionRate,
            commissionAmount,
            durationDays: prop.durationDays,
            milestones,
            awardedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          tx.update(propRef, { status: 'accepted' });

          tx.set(app.db.collection('transactions').doc(), {
            userId: app.user.uid,
            type: 'escrow_lock',
            title: isAr ? `حجز ضمان عقد ${contractNumber}` : `Escrow Lock ${contractNumber}`,
            note: projDoc.data().title,
            amount: -totalCost,
            projectId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          tx.set(app.db.collection('notifications').doc(), {
            userId: prop.bidderId,
            title: isAr ? 'مبروك! تم قبول عرضك وحجز الضمان' : 'Proposal Accepted & Funded',
            body: `${projDoc.data().title} — ${contractNumber} (${app.fmtMoney(totalCost)} ${app.t('egp')})`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        app.toast(isAr ? 'تم تفعيل عقد الضمان المالي بنجاح وحجز المبلغ بأمان' : 'Escrow contract activated', 'success');
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
      const fee = Math.round(Number(ms.amount) * window.DAMAN_CONFIG.commissionRate * 100) / 100;
      const net = Math.round((Number(ms.amount) - fee) * 100) / 100;

      const ok = window.confirm(
        isAr
          ? `تأكيد استلام "${ms.titleAr}" وتحرير مبلغ ${app.fmtMoney(ms.amount)} ج.م؟\nسيصل للمنفّذ صافي ${app.fmtMoney(net)} ج.م بعد خصم عمولة الضمان 3.5% (${app.fmtMoney(fee)} ج.م).`
          : `Confirm release of ${app.fmtMoney(ms.amount)} EGP? Provider receives ${app.fmtMoney(net)} EGP after 3.5% fee (${app.fmtMoney(fee)} EGP).`
      );
      if (!ok) return;

      const projRef = app.db.collection('projects').doc(projectId);
      const clientRef = app.db.collection('users').doc(proj.clientId);
      const provRef = app.db.collection('users').doc(proj.awardedTo);

      try {
        await app.db.runTransaction(async (tx) => {
          const [projDoc, clientDoc, provDoc] = await Promise.all([tx.get(projRef), tx.get(clientRef), tx.get(provRef)]);
          const pData = projDoc.data();
          if (!pData || pData.status !== 'in_progress') throw new Error(isAr ? 'العقد غير نشط' : 'Contract not active');

          const updatedMs = (pData.milestones || []).slice();
          if (!updatedMs[msIndex] || updatedMs[msIndex].status === 'released') {
            throw new Error(isAr ? 'تم تحرير هذه الدفعة مسبقاً' : 'Milestone already released');
          }

          const amount = Number(updatedMs[msIndex].amount);
          const txFee = Math.round(amount * window.DAMAN_CONFIG.commissionRate * 100) / 100;
          const txNet = Math.round((amount - txFee) * 100) / 100;

          updatedMs[msIndex] = Object.assign({}, updatedMs[msIndex], {
            status: 'released',
            releasedAt: new Date().toISOString()
          });

          const allDone = updatedMs.every((m) => m.status === 'released');

          const clientEscrow = Number((clientDoc.data() || {}).balanceEscrow || 0);
          const provAvail = Number((provDoc.data() || {}).balanceAvailable || 0);

          tx.update(clientRef, {
            balanceEscrow: Math.max(0, Math.round((clientEscrow - amount) * 100) / 100)
          });
          tx.update(provRef, {
            balanceAvailable: Math.round((provAvail + txNet) * 100) / 100
          });

          tx.update(projRef, {
            milestones: updatedMs,
            status: allDone ? 'completed' : 'in_progress'
          });

          tx.set(app.db.collection('transactions').doc(), {
            userId: proj.clientId,
            type: 'escrow_release',
            title: isAr ? `تحرير دفعة — ${pData.contractNumber}` : `Milestone Released — ${pData.contractNumber}`,
            note: updatedMs[msIndex].titleAr,
            amount: -amount,
            projectId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          tx.set(app.db.collection('transactions').doc(), {
            userId: proj.awardedTo,
            type: 'payout_received',
            title: isAr ? `استلام صافي دفعة — ${pData.contractNumber}` : `Net Payout — ${pData.contractNumber}`,
            note: isAr ? `بعد خصم عمولة الضمان 3.5% (${app.fmtMoney(txFee)} ج.م)` : `After 3.5% fee (${app.fmtMoney(txFee)} EGP)`,
            amount: txNet,
            projectId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          tx.set(app.db.collection('platformFees').doc(), {
            projectId,
            contractNumber: pData.contractNumber || '',
            grossAmount: amount,
            feeAmount: txFee,
            rate: window.DAMAN_CONFIG.commissionRate,
            clientId: proj.clientId,
            providerId: proj.awardedTo,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          tx.set(app.db.collection('notifications').doc(), {
            userId: proj.awardedTo,
            title: isAr ? 'تم تحرير دفعة مالية لمحفظتك' : 'Milestone Payout Credited',
            body: `+${app.fmtMoney(txNet)} ${app.t('egp')} (${pData.title})`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        app.toast(isAr ? 'تم تحرير الدفعة بنجاح وإضافة الصافي لمحفظة المنفّذ' : 'Milestone released successfully', 'success');
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
            <h3 class="text-sm font-extrabold text-rose-400"><i class="fa-solid fa-scale-balanced me-1"></i> ${isAr ? 'فتح نزاع مالي / هندسي' : 'Open Dispute'}</h3>
            <button onclick="document.getElementById('daman-dispute-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <p class="text-[11px] text-slate-300 leading-relaxed">${isAr ? 'سيتم تجميد الدفعات المتبقية في الضمان لحين مراجعة الإدارة والفصل العادل بين الطرفين.' : 'Remaining escrow funds will be held until administration reviews and resolves the dispute.'}</p>
          <form onsubmit="DamanProjects.submitDispute(event, '${projectId}')" class="space-y-2.5">
            <textarea id="disp-reason" rows="3" required placeholder="${isAr ? 'اشرح سبب النزاع بالتفصيل...' : 'Describe the dispute clearly...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs">${isAr ? 'تأكيد رفع النزاع للإدارة' : 'Submit Dispute'}</button>
          </form>
        </div>`;
    },

    async submitDispute(e, projectId) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const reason = document.getElementById('disp-reason').value.trim();
      const proj = this.projects.find((p) => p.id === projectId);
      if (!proj) return;
      try {
        await app.db.collection('disputes').add({
          projectId,
          contractNumber: proj.contractNumber || '',
          projectTitle: proj.title || '',
          contractAmount: proj.contractAmount || 0,
          clientId: proj.clientId,
          clientName: proj.clientName || '',
          providerId: proj.awardedTo || '',
          providerName: proj.awardedCompany || proj.awardedName || '',
          openedBy: app.user.uid,
          openedByName: app.profile.name || '',
          reason,
          status: 'open',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.db.collection('projects').doc(projectId).update({ status: 'disputed' });
        document.getElementById('daman-dispute-modal').classList.add('hidden');
        app.toast(isAr ? 'تم رفع النزاع للإدارة وتجميد العقد لحين الفصل فيه' : 'Dispute submitted to administration', 'warning');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    openReviewModal(projectId, targetUid, targetName, reviewerSide) {
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
          <form onsubmit="DamanProjects.submitReview(event,'${projectId}','${targetUid}','${reviewerSide}')" class="space-y-3">
            <select id="rev-stars" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-extrabold text-amber-400">
              <option value="5">★★★★★ (5/5 - ممتاز)</option>
              <option value="4">★★★★☆ (4/5 - جيد جداً)</option>
              <option value="3">★★★☆☆ (3/5 - جيد)</option>
              <option value="2">★★☆☆☆ (2/5 - مقبول)</option>
              <option value="1">★☆☆☆☆ (1/5 - ضعيف)</option>
            </select>
            <textarea id="rev-comment" rows="3" required placeholder="${isAr ? 'اكتب تقييمك عن الالتزام وجودة التنفيذ والتعامل...' : 'Write your review on quality and professionalism...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'حفظ التقييم' : 'Submit Review'}</button>
          </form>
        </div>`;
    },

    async submitReview(e, projectId, targetUid, reviewerSide) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const stars = parseInt(document.getElementById('rev-stars').value, 10) || 5;
      const comment = document.getElementById('rev-comment').value.trim();
      const proj = this.projects.find((p) => p.id === projectId);

      const targetRef = app.db.collection('users').doc(targetUid);
      const projRef = app.db.collection('projects').doc(projectId);

      try {
        await app.db.runTransaction(async (tx) => {
          const tDoc = await tx.get(targetRef);
          const tData = tDoc.data() || {};
          const oldCount = Number(tData.ratingCount || 0);
          const oldAvg = Number(tData.ratingAvg || 0);
          const newCount = oldCount + 1;
          const newAvg = Math.round(((oldAvg * oldCount + stars) / newCount) * 10) / 10;

          tx.update(targetRef, { ratingAvg: newAvg, ratingCount: newCount });
          tx.update(projRef, reviewerSide === 'client' ? { clientRated: true } : { providerRated: true });
          tx.set(app.db.collection('reviews').doc(), {
            targetUserId: targetUid,
            fromUserId: app.user.uid,
            fromName: app.profile.name || '',
            projectId,
            projectTitle: proj ? proj.title : '',
            rating: stars,
            comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        document.getElementById('daman-review-modal').classList.add('hidden');
        app.toast(isAr ? 'شكراً لك! تم تسجيل التقييم بنجاح' : 'Review submitted successfully', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    printContractA4(projectId) {
      const app = window.DamanApp;
      const proj = this.projects.find((p) => p.id === projectId);
      if (!proj) return;

      const cats = this.getCatLabels(proj.mainCategory, proj.subCategory, 'ar');
      const total = Number(proj.contractAmount || 0);
      const fee = Math.round(total * window.DAMAN_CONFIG.commissionRate * 100) / 100;
      const net = Math.round((total - fee) * 100) / 100;
      const dateStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      const msRows = (proj.milestones || [])
        .map(
          (m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${app.esc(m.titleAr)}</td>
              <td>${app.fmtMoney(m.amount)} ج.م</td>
              <td>${m.status === 'released' ? 'تم التسليم والتحرير' : 'محجوز بالضمان'}</td>
            </tr>`
        )
        .join('');

      const win = window.open('', '_blank');
      if (!win) {
        app.toast(app.lang === 'ar' ? 'يرجى السماح بالنوافذ المنبثقة لطباعة العقد' : 'Please allow pop-ups to print contract', 'warning');
        return;
      }

      win.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>عقد ضمان سايت - ${app.esc(proj.contractNumber || '')}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', 'Tahoma', Arial, sans-serif; color: #000; background: #fff; margin: 0; padding: 0; font-size: 11.5px; line-height: 1.55; }
  .sheet { width: 100%; max-width: 210mm; margin: 0 auto; border: 2px solid #000; padding: 14px 18px; }
  .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
  .hdr h1 { margin: 0; font-size: 18px; font-weight: 900; }
  .hdr .sub { font-size: 11px; margin-top: 2px; }
  .meta { text-align: left; font-size: 11px; }
  .sec-title { background: #eee; border: 1px solid #000; padding: 4px 8px; font-weight: 800; font-size: 12px; margin: 10px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #000; padding: 5px 7px; text-align: right; }
  th { background: #f3f3f3; font-weight: 800; }
  .terms { margin: 4px 0; padding-right: 18px; font-size: 11px; }
  .terms li { margin-bottom: 3px; }
  .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; text-align: center; }
  .sig-box { border: 1px solid #000; padding: 8px 6px 36px; font-weight: 700; font-size: 11px; }
  .print-btn { display: block; margin: 10px auto; padding: 8px 24px; background: #000; color: #fff; border: none; font-weight: 700; cursor: pointer; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة / حفظ كملف PDF (A4)</button>
  <div class="sheet">
    <div class="hdr">
      <div>
        <h1>عقد تنفيذ أعمال وضمان مالي وسيط (Escrow)</h1>
        <div class="sub">منصة ضمان سايت | DamanSite — للرقابة الهندسية وحماية المدفوعات</div>
      </div>
      <div class="meta">
        <div><b>رقم العقد:</b> ${app.esc(proj.contractNumber || proj.id.slice(0, 8).toUpperCase())}</div>
        <div><b>تاريخ التحرير:</b> ${dateStr}</div>
      </div>
    </div>

    <div class="sec-title">أولاً: بيانات أطراف التعاقد</div>
    <table>
      <tr>
        <th style="width:18%">الطرف الأول (المالك)</th>
        <td style="width:32%">${app.esc(proj.clientName || '-')}</td>
        <th style="width:18%">البريد / الهاتف</th>
        <td style="width:32%">${app.esc(proj.clientEmail || '-')} ${proj.clientPhone ? ' | ' + app.esc(proj.clientPhone) : ''}</td>
      </tr>
      <tr>
        <th>الطرف الثاني (المنفّذ)</th>
        <td>${app.esc(proj.awardedCompany || proj.awardedName || '-')}</td>
        <th>البريد / السجل</th>
        <td>${app.esc(proj.awardedEmail || '-')} ${proj.awardedCR ? ' | س.ت: ' + app.esc(proj.awardedCR) : ''}</td>
      </tr>
    </table>

    <div class="sec-title">ثانياً: نطاق الأعمال والموقع</div>
    <table>
      <tr>
        <th style="width:18%">اسم المشروع</th>
        <td colspan="3"><b>${app.esc(proj.title)}</b></td>
      </tr>
      <tr>
        <th>القسم والتخصص</th>
        <td>${app.esc(cats.mainLabel)} — ${app.esc(cats.subLabel)}</td>
        <th style="width:18%">الموقع والمدة</th>
        <td>${app.esc(proj.location)} (${proj.durationDays || '-'} يوم)</td>
      </tr>
      <tr>
        <th>الوصف والمواصفات</th>
        <td colspan="3">${app.esc(proj.description)}</td>
      </tr>
    </table>

    <div class="sec-title">ثالثاً: القيمة المالية وجدول الدفعات المحجوزة بالضمان</div>
    <table>
      <tr>
        <th>إجمالي قيمة العقد</th>
        <th>عمولة الضمان (3.5%)</th>
        <th>صافي مستحقات الطرف الثاني</th>
      </tr>
      <tr>
        <td><b>${app.fmtMoney(total)} ج.م</b></td>
        <td>${app.fmtMoney(fee)} ج.م</td>
        <td><b>${app.fmtMoney(net)} ج.م</b></td>
      </tr>
    </table>
    <table>
      <thead>
        <tr><th style="width:8%">#</th><th>بيان المرحلة / الدفعة</th><th style="width:22%">القيمة</th><th style="width:22%">الحالة</th></tr>
      </thead>
      <tbody>${msRows}</tbody>
    </table>

    <div class="sec-title">رابعاً: الشروط والأحكام الملزمة</div>
    <ol class="terms">
      <li>تم حجز قيمة العقد بالكامل داخل محفظة الضمان الوسيط بمنصة «ضمان سايت» ولا يُصرف أي مبلغ إلا بعد تأكيد الاستلام أو بقرار إداري هندسي.</li>
      <li>يلتزم الطرف الثاني بتنفيذ الأعمال طبقاً لأصول الصناعة والمواصفات المتفق عليها وفي المدة المحددة أعلاه.</li>
      <li>تُخصم عمولة المنصة بنسبة 3.5% تلقائياً عند تحرير كل دفعة، وتُضاف الصافيات لمحفظة الطرف الثاني، ويتم السحب خلال يوم عمل واحد على حساب مطابق لاسمه.</li>
      <li>في حال نشوء أي خلاف، يحق لأي طرف رفع نزاع عبر التطبيق وتلتزم الأطراف بقرار المراجعة الفنية والإدارية للمنصة.</li>
    </ol>

    <div class="sigs">
      <div class="sig-box">توقيع الطرف الأول (المالك)<br/><span style="font-weight:400;font-size:10px">${app.esc(proj.clientName || '')}</span></div>
      <div class="sig-box">توقيع الطرف الثاني (المنفّذ)<br/><span style="font-weight:400;font-size:10px">${app.esc(proj.awardedCompany || proj.awardedName || '')}</span></div>
      <div class="sig-box">اعتماد منصة ضمان سايت<br/><span style="font-weight:400;font-size:10px">عقد موثّق إلكترونياً — DamanSite</span></div>
    </div>
  </div>
</body>
</html>`);
      win.document.close();
    },

    startChat(otherUid, otherName, projectId, projectTitle) {
      const app = window.DamanApp;
      if (window.DamanChat && typeof window.DamanChat.openDirectChat === 'function') {
        this.closeDetailModal();
        window.DamanChat.openDirectChat(otherUid, otherName, projectId, projectTitle);
      } else {
        this.closeDetailModal();
        app.switchTab('chat');
        app.toast(app.lang === 'ar' ? 'سيتم تفعيل الدردشة المباشرة في الخطوة 3 (chat-support.js)' : 'Direct chat activates in Step 3', 'info');
      }
    },

    renderProjectCard(proj, app) {
      const isAr = app.lang === 'ar';
      const cats = this.getCatLabels(proj.mainCategory, proj.subCategory, app.lang);
      return `
        <div onclick="DamanProjects.openProjectDetail('${proj.id}')" class="glass-card rounded-2xl p-3.5 space-y-2 cursor-pointer hover:border-amber-500/50 transition-all">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 truncate">${app.esc(cats.subLabel)}</span>
            ${this.statusBadge(proj.status, isAr)}
          </div>
          <h4 class="text-xs font-extrabold text-white leading-snug">${app.esc(proj.title)}</h4>
          <p class="text-[11px] text-slate-400 line-clamp-2">${app.esc(proj.description)}</p>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
            <span class="text-slate-300 truncate"><i class="fa-solid fa-location-dot text-amber-400 me-1"></i>${app.esc(proj.location)}</span>
            <span class="font-black text-emerald-400 shrink-0">${app.fmtMoney(proj.contractAmount || proj.budget)} ${app.t('egp')}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span><i class="fa-solid fa-user me-1"></i>${app.esc(proj.clientName || '-')}</span>
            <span><i class="fa-solid fa-file-signature text-sky-400 me-1"></i>${proj.proposalsCount || 0} ${isAr ? 'عروض' : 'bids'}</span>
          </div>
        </div>`;
    },

    renderBrowseTab(app) {
      const isAr = app.lang === 'ar';
      const selMain = app.selectedMainCat || 'all';
      const selSub = app.selectedSubCat || null;
      const activeMainObj = window.DAMAN_CATEGORIES.find((c) => c.id === selMain);

      const filtered = this.projects.filter((p) => {
        if (p.status === 'suspended') return false;
        if (selMain !== 'all' && p.mainCategory !== selMain) return false;
        if (selSub && p.subCategory !== selSub) return false;
        return true;
      });

      return `
        <div class="space-y-3">
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button onclick="DamanProjects.setFilter('all', null)" class="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border ${selMain === 'all' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-800'}">
              ${isAr ? 'الكل' : 'All'}
            </button>
            ${window.DAMAN_CATEGORIES.map((c) => `
              <button onclick="DamanProjects.setFilter('${c.id}', null)" class="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-extrabold border ${selMain === c.id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-800'}">
                ${isAr ? c.ar : c.en}
              </button>`).join('')}
          </div>

          ${activeMainObj ? `
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button onclick="DamanProjects.setFilter('${activeMainObj.id}', null)" class="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold ${!selSub ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40' : 'bg-slate-900 text-slate-400'}">
                ${isAr ? 'كل التخصصات' : 'All Specialties'}
              </button>
              ${activeMainObj.subs.map((s) => `
                <button onclick="DamanProjects.setFilter('${activeMainObj.id}', '${s.id}')" class="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold ${selSub === s.id ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40' : 'bg-slate-900 text-slate-400'}">
                  ${isAr ? s.ar : s.en}
                </button>`).join('')}
            </div>` : ''}

          ${!filtered.length
            ? `<div class="glass-card rounded-2xl p-6 text-center space-y-2">
                 <i class="fa-solid fa-folder-open text-3xl text-slate-500"></i>
                 <div class="text-xs font-bold text-slate-300">${isAr ? 'لا توجد مشاريع في هذا القسم حالياً' : 'No projects in this category yet'}</div>
                 <button onclick="DamanProjects.openPostModal()" class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'كن أول من ينشر مشروعاً' : 'Post First Project'}</button>
               </div>`
            : `<div class="space-y-2.5">${filtered.map((p) => this.renderProjectCard(p, app)).join('')}</div>`}
        </div>`;
    },

    renderMyTab(app) {
      const isAr = app.lang === 'ar';
      if (!app.user) {
        return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
      }
      const uid = app.user.uid;
      const mine = this.projects.filter((p) => p.clientId === uid || p.awardedTo === uid);
      if (!mine.length) {
        return `
          <div class="glass-card rounded-2xl p-6 text-center space-y-2">
            <i class="fa-solid fa-file-contract text-3xl text-slate-500"></i>
            <div class="text-xs font-bold text-slate-300">${isAr ? 'لا توجد مشاريع أو عقود خاصة بك بعد' : 'You have no projects or contracts yet'}</div>
            <button onclick="DamanProjects.openPostModal()" class="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'انشر مشروعك الأول' : 'Post Your First Project'}</button>
          </div>`;
      }
      return `<div class="space-y-2.5">${mine.map((p) => this.renderProjectCard(p, app)).join('')}</div>`;
    },

    renderInspectionTab(app) {
      const isAr = app.lang === 'ar';
      return `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-900/60 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-emerald-300"><i class="fa-solid fa-clipboard-check me-1"></i> ${isAr ? 'معاينات وضمان التنفيذ (DamanSite)' : 'Engineering Site Inspections'}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">VIP</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              ${isAr
                ? 'احجز زيارة مهندس استشاري للموقع لفحص التشوينات، الشدات والحدادة، أو استلام الصب والتشطيبات مع تقرير فني رسمي.'
                : 'Book an independent engineering inspection for materials, shoring/steel, pouring, or finishing handover.'}
            </p>
          </div>

          <form onsubmit="DamanProjects.submitInspectionRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-white">${isAr ? 'نموذج حجز معاينة هندسية / طلب VIP' : 'Book Inspection / VIP Request'}</h4>
            <select id="insp-pkg" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-bold text-white">
              <option value="roof_3_visits">${isAr ? 'باقة السقف الكاملة — 3 زيارات (تشوين + شدة وحدادة + صب) — 9,000 ج.م' : 'Full Roof Package — 3 Visits (9,000 EGP)'}</option>
              <option value="single_visit">${isAr ? 'معاينة هندسية منفردة وتقرير فني للموقع' : 'Single Engineering Site Inspection'}</option>
              <option value="finishing_handover">${isAr ? 'استلام تشطيبات شقة / فيلا وتقرير ملاحظات' : 'Finishing Handover Inspection'}</option>
              <option value="vip_supervision">${isAr ? 'طلب إشراف وضمان VIP لمشروع كامل' : 'Full VIP Supervision & Warranty'}</option>
            </select>
            <input id="insp-location" type="text" required placeholder="${isAr ? 'عنوان الموقع / المحافظة والكمبوند' : 'Site Address / Governorate'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="insp-phone" type="tel" required value="${app.esc(app.profile?.phone || '')}" placeholder="${isAr ? 'رقم الهاتف للتواصل والتنسيق' : 'Contact Phone Number'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="insp-date" type="date" required class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="insp-notes" rows="2" placeholder="${isAr ? 'ملاحظات إضافية (المساحة، مرحلة الأعمال...)' : 'Additional notes (area, current stage...)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button id="insp-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-calendar-check me-1"></i> ${isAr ? 'إرسال طلب المعاينة للإدارة' : 'Submit Inspection Request'}
            </button>
          </form>

          ${this.myInspections.length ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2">
              <h4 class="text-xs font-extrabold text-amber-400">${isAr ? 'طلبات المعاينة الخاصة بي' : 'My Inspection Requests'}</h4>
              ${this.myInspections.map((r) => `
                <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div class="flex items-center justify-between text-xs font-bold text-white">
                    <span>${app.esc(r.packageLabel || r.packageId)}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">${app.esc(r.status || 'pending')}</span>
                  </div>
                  <div class="text-[10px] text-slate-400">${app.esc(r.location)} — ${app.esc(r.preferredDate || '')}</div>
                  ${r.adminNote ? `<div class="text-[10px] text-emerald-300">${isAr ? 'رد الإدارة:' : 'Admin:'} ${app.esc(r.adminNote)}</div>` : ''}
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    },

    async submitInspectionRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const sel = document.getElementById('insp-pkg');
      const btn = document.getElementById('insp-submit-btn');
      if (btn) btn.disabled = true;

      try {
        await app.db.collection('vipRequests').add({
          userId: app.user.uid,
          userName: app.profile.name || '',
          userEmail: app.profile.email || app.user.email || '',
          packageId: sel.value,
          packageLabel: sel.options[sel.selectedIndex].text,
          location: document.getElementById('insp-location').value.trim(),
          phone: document.getElementById('insp-phone').value.trim(),
          preferredDate: document.getElementById('insp-date').value,
          notes: document.getElementById('insp-notes').value.trim(),
          status: 'pending',
          adminNote: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast(isAr ? 'تم إرسال طلب المعاينة الهندسية بنجاح وسيتواصل معك فريقنا' : 'Inspection request submitted', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    render(container, app) {
      this.ensureListeners(app);
      const isAr = app.lang === 'ar';

      const body =
        this.subTab === 'browse'
          ? this.renderBrowseTab(app)
          : this.subTab === 'my'
          ? this.renderMyTab(app)
          : this.renderInspectionTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-black text-white"><i class="fa-solid fa-briefcase text-amber-400 me-1.5"></i> ${isAr ? 'المشاريع وعقود الضمان' : 'Projects & Escrow'}</h2>
            <button onclick="DamanProjects.openPostModal()" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1">
              <i class="fa-solid fa-plus"></i><span>${app.t('postProject')}</span>
            </button>
          </div>

          <div class="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanProjects.setSubTab('browse')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'browse' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'سوق المشاريع' : 'Market'}</button>
            <button onclick="DamanProjects.setSubTab('my')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'my' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'عقودي ومشاريعي' : 'My Contracts'}</button>
            <button onclick="DamanProjects.setSubTab('inspection')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'inspection' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'معاينة و VIP' : 'Inspection'}</button>
          </div>

          ${body}
        </div>`;
    }
  };

  window.DamanProjects = ProjectsMod;
  if (window.DamanApp) window.DamanApp.registerModule('projects', ProjectsMod);
})();
