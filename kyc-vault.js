(function () {
  const KycVault = {
    docs: [],
    loading: false,
    filterStatus: 'all', // 'all' | 'approved' | 'pending' | 'rejected' | 'company'
    searchQuery: '',
    _lastOpenedData: null,
    _booted: false,

    isApprovedStatus(st) {
      return st === 'approved' || st === 'verified';
    },

    statusBadge(st) {
      if (this.isApprovedStatus(st)) return '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black">موثّق ✅</span>';
      if (st === 'rejected') return '<span class="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-black">مرفوض ❌</span>';
      if (st === 'pending') return '<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-black">قيد المراجعة ⏳</span>';
      return '<span class="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[10px] font-bold">غير موثّق</span>';
    },

    accountTypeAr(t) {
      return { company: '🏢 شركة مقاولات', supplier: '🚚 مورّد B2B', individual: '👷 فرد / مقاول' }[t] || '👤 فرد';
    },

    async resolveImgSrc(app, val) {
      if (!val) return '';
      if (String(val).startsWith('data:') || String(val).startsWith('http')) return val;
      try { return (await app.fetchMedia(val)) || ''; } catch (e) { return ''; }
    },

    // ==================== 1. ADMIN ARCHIVE DATA & RENDER ====================
    async loadArchive(force = false) {
      const app = window.DamanApp;
      if (!app || !app.db || !app.hasAdminAccess()) return;
      if (this.loading) return;
      if (!force && this.docs.length) {
        this.renderArchiveListOnly();
        return;
      }

      this.loading = true;
      const listEl = document.getElementById('daman-kycv-list');
      if (listEl) listEl.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-amber-300 font-bold">جارٍ تحميل أرشيف البطاقات والسجلات التجارية...</div>`;

      try {
        const snap = await app.db.collection('kycRequests').limit(300).get();
        this.docs = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      } catch (err) {
        app.toast('تعذر تحميل أرشيف التوثيق: ' + err.message, 'error');
      } finally {
        this.loading = false;
        this.renderArchiveListOnly();
      }
    },

    setFilter(st) {
      this.filterStatus = st;
      this.renderArchiveListOnly();
      const bar = document.getElementById('daman-kycv-filters');
      if (bar) bar.innerHTML = this.renderFilterButtonsHTML();
    },

    onSearch(val) {
      this.searchQuery = val || '';
      this.renderArchiveListOnly();
    },

    renderFilterButtonsHTML() {
      const total = this.docs.length;
      const cApp = this.docs.filter((d) => this.isApprovedStatus(d.status)).length;
      const cPen = this.docs.filter((d) => d.status === 'pending').length;
      const cRej = this.docs.filter((d) => d.status === 'rejected').length;
      const cCmp = this.docs.filter((d) => d.accountType === 'company' || d.accountType === 'supplier' || d.crMedia || d.commercialReg).length;

      const tabs = [
        ['all', `الكل (${total})`],
        ['approved', `✅ موثّق (${cApp})`],
        ['pending', `⏳ معلّق (${cPen})`],
        ['company', `🏢 شركات وسجلات (${cCmp})`],
        ['rejected', `❌ مرفوض (${cRej})`]
      ];
      return tabs.map(([k, lbl]) => `
        <button type="button" onclick="DamanKycVault.setFilter('${k}')" class="shrink-0 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-black ${this.filterStatus === k ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-800 text-slate-300'}">${lbl}</button>`).join('');
    },

    renderArchiveListOnly() {
      const app = window.DamanApp;
      const el = document.getElementById('daman-kycv-list');
      const bar = document.getElementById('daman-kycv-filters');
      if (bar) bar.innerHTML = this.renderFilterButtonsHTML();
      if (!el) return;

      const q = app.normalizeAr(this.searchQuery || '');
      const list = this.docs.filter((d) => {
        if (this.filterStatus === 'approved' && !this.isApprovedStatus(d.status)) return false;
        if (this.filterStatus === 'pending' && d.status !== 'pending') return false;
        if (this.filterStatus === 'rejected' && d.status !== 'rejected') return false;
        if (this.filterStatus === 'company' && !(d.accountType === 'company' || d.accountType === 'supplier' || d.crMedia || d.commercialReg)) return false;
        if (q) {
          const hay = `${d.legalName || ''} ${d.displayName || ''} ${d.nationalId || ''} ${d.phone || ''} ${d.email || ''} ${d.companyName || ''} ${d.commercialReg || ''} ${d.taxCard || ''}`;
          if (!app.normalizeAr(hay).includes(q)) return false;
        }
        return true;
      });

      if (!list.length) {
        el.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد مستندات توثيق مطابقة في الأرشيف.</div>`;
        return;
      }

      el.innerHTML = list.map((d) => {
        const uid = d.userId || d.id;
        const docsTags = [
          d.idFrontMedia ? '🪪 وش' : '',
          d.idBackMedia ? '🪪 ضهر' : '',
          d.selfieMedia ? '🤳 سيلفي' : '',
          d.crMedia ? '🏢 سجل تجاري' : '',
          d.taxMedia ? '🧾 ضريبية' : ''
        ].filter(Boolean).join(' • ');

        return `
          <div class="glass-card rounded-2xl p-3 space-y-2 border-slate-800 hover:border-amber-500/40">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-black text-white truncate">${app.esc(d.legalName || d.displayName || 'مستخدم')}</div>
                <div class="text-[10px] text-amber-300 font-bold">قومي: ${app.esc(d.nationalId || '—')} • ${this.accountTypeAr(d.accountType)}</div>
              </div>
              ${this.statusBadge(d.status)}
            </div>

            ${d.companyName || d.commercialReg || d.taxCard ? `
              <div class="p-2 rounded-xl bg-slate-950 border border-sky-500/30 text-[10px] text-sky-200">
                🏢 <b>${app.esc(d.companyName || '—')}</b> • س.ت: <b>${app.esc(d.commercialReg || '—')}</b> • ضريبية: <b>${app.esc(d.taxCard || '—')}</b>
              </div>` : ''}

            <div class="text-[10px] text-slate-400">
              📞 ${app.esc(d.phone || '—')} • ${app.esc(d.legalAddress || '')}
            </div>
            <div class="text-[10px] text-emerald-300 font-bold">${docsTags || 'بدون صور مرفقة'}</div>

            <div class="flex gap-1.5 pt-0.5">
              <button type="button" onclick="DamanKycVault.openDocsModal('${app.esc(uid)}',false)" class="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">
                <i class="fa-solid fa-id-card me-1"></i> عرض كل المستندات والصور
              </button>
              ${window.DamanAdmin && DamanAdmin.openUser360Modal ? `<button type="button" onclick="DamanAdmin.openUser360Modal('${app.esc(uid)}')" class="px-3 py-2 rounded-xl bg-slate-800 text-sky-300 font-bold text-[10px]">ملف 360°</button>` : ''}
            </div>
          </div>`;
      }).join('');
    },

    renderAdminArchivePanel(app) {
      setTimeout(() => this.loadArchive(false), 30);
      return `
        <div class="space-y-3 text-xs">
          <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-black text-amber-300">🪪 أرشيف البطاقات والسجلات التجارية (الدائم)</div>
              <div class="text-[10px] text-slate-300">راجع في أي وقت كل البطاقات والسيلفي والسجلات التجارية التي تم توثيقها أو رفضها.</div>
            </div>
            <button type="button" onclick="DamanKycVault.loadArchive(true)" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] shrink-0">تحديث</button>
          </div>

          <input type="search" value="${app.esc(this.searchQuery)}" oninput="DamanKycVault.onSearch(this.value)" placeholder="ابحث بالاسم الرباعي، الرقم القومي، السجل التجاري، أو الموبايل..." class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-amber-500/40 text-xs text-white font-bold" />

          <div id="daman-kycv-filters" class="flex items-center gap-1 overflow-x-auto pb-1">
            ${this.renderFilterButtonsHTML()}
          </div>

          <div id="daman-kycv-list" class="space-y-2"></div>
        </div>`;
    },

    // ==================== 2. FULL DOCUMENTS VIEWER MODAL (FOR ADMIN & SELF-VIEW USER) ====================
    async openDocsModal(uid, isSelfView = false) {
      const app = window.DamanApp;
      if (!app || !app.user || !uid) return;
      if (!isSelfView && !app.hasAdminAccess() && uid !== app.user.uid) return;

      let m = document.getElementById('daman-kycv-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-kycv-modal';
        m.className = 'daman-modal fixed inset-0 z-[95] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'kycVault' }, ''); } catch (e) {}

      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-6 text-center text-xs text-amber-300 font-bold">جارٍ تحميل البطاقة والسجل التجاري والمستندات الموثّقة...</div>`;

      try {
        const [kycSnap, userSnap] = await Promise.all([
          app.db.collection('kycRequests').doc(uid).get().catch(() => null),
          app.db.collection('users').doc(uid).get().catch(() => null)
        ]);

        const kyc = kycSnap && kycSnap.exists ? kycSnap.data() : null;
        const usr = userSnap && userSnap.exists ? userSnap.data() : null;

        if (!kyc && !usr) {
          m.innerHTML = `<div class="w-full max-w-sm bg-slate-900 border border-rose-500/50 rounded-3xl p-5 text-center space-y-3 text-xs"><div class="text-rose-300 font-black">لا توجد مستندات توثيق مسجّلة لهذا الحساب بعد.</div><button type="button" onclick="document.getElementById('daman-kycv-modal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold">إغلاق</button></div>`;
          return;
        }

        const merged = {
          uid,
          legalName: kyc?.legalName || usr?.legalName || usr?.name || '—',
          displayName: kyc?.displayName || usr?.name || '—',
          nationalId: kyc?.nationalId || usr?.nationalId || '—',
          birthDate: kyc?.birthDate || usr?.birthDate || '—',
          legalAddress: kyc?.legalAddress || usr?.legalAddress || usr?.city || '—',
          phone: kyc?.phone || usr?.phone || '—',
          email: kyc?.email || usr?.email || '—',
          accountType: kyc?.accountType || usr?.accountType || 'individual',
          companyName: kyc?.companyName || usr?.companyName || '',
          commercialReg: kyc?.commercialReg || usr?.commercialReg || '',
          taxCard: kyc?.taxCard || usr?.taxCard || '',
          status: usr?.kycStatus || kyc?.status || 'none',
          rejectionReason: usr?.kycRejectionReason || kyc?.rejectionReason || ''
        };
        this._lastOpenedData = merged;

        const mediaSlots = [
          { key: 'idFront', label: '🪪 وش البطاقة الشخصية', id: kyc?.idFrontMedia || '' },
          { key: 'idBack', label: '🪪 ضهر البطاقة الشخصية', id: kyc?.idBackMedia || '' },
          { key: 'selfie', label: '🤳 صورة السيلفي للتحقق', id: kyc?.selfieMedia || '' },
          { key: 'cr', label: '🏢 صورة السجل التجاري', id: kyc?.crMedia || '' },
          { key: 'tax', label: '🧾 صورة البطاقة الضريبية', id: kyc?.taxMedia || '' }
        ].filter((s) => !!s.id);

        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-black text-amber-400 truncate">🪪 ${isSelfView ? 'مستنداتي الموثّقة' : 'ملف التوثيق والمستندات'}</h3>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="DamanKycVault.printKycRecordA4()" class="px-2.5 py-1 rounded-xl bg-white text-slate-950 font-black text-[10px]">🖨️ A4</button>
                <button type="button" onclick="document.getElementById('daman-kycv-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>

            <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
              <div class="flex items-center justify-between gap-2">
                <b class="text-white text-xs">${app.esc(merged.legalName)}</b>
                ${this.statusBadge(merged.status)}
              </div>
              <div class="grid grid-cols-2 gap-1.5 pt-1 text-[10.5px]">
                <div>الرقم القومي: <b class="text-amber-300 select-all">${app.esc(merged.nationalId)}</b></div>
                <div>تاريخ الميلاد: <b class="text-white">${app.esc(merged.birthDate)}</b></div>
                <div>نوع الحساب: <b class="text-sky-300">${this.accountTypeAr(merged.accountType)}</b></div>
                <div>الموبايل: <b class="text-white select-all">${app.esc(merged.phone)}</b></div>
              </div>
              <div class="text-[10.5px] text-slate-300 pt-1 border-t border-slate-800">العنوان: <b>${app.esc(merged.legalAddress)}</b></div>
              ${merged.companyName || merged.commercialReg || merged.taxCard ? `
                <div class="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[10.5px] text-sky-200 space-y-0.5 mt-1">
                  <div>🏢 اسم الشركة: <b>${app.esc(merged.companyName || '—')}</b></div>
                  <div>📄 السجل التجاري: <b class="select-all">${app.esc(merged.commercialReg || '—')}</b></div>
                  <div>🧾 البطاقة الضريبية: <b class="select-all">${app.esc(merged.taxCard || '—')}</b></div>
                </div>` : ''}
              ${merged.rejectionReason ? `<div class="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-[10.5px] text-rose-200">سبب الرفض / الملاحظة: ${app.esc(merged.rejectionReason)}</div>` : ''}
            </div>

            <div class="space-y-2">
              <div class="font-black text-amber-300">🖼️ المستندات والصور المرفوعة (${mediaSlots.length})</div>
              ${!mediaSlots.length ? `
                <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-400">
                  لا توجد صور مرفوعة في الخزنة لهذا الحساب (ربما تم التوثيق يدوياً أو لم يرفع المستخدم المستندات بعد).
                </div>` : `
                <div id="daman-kycv-imgs-grid" class="grid grid-cols-1 gap-2.5">
                  ${mediaSlots.map((s) => `
                    <div class="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <div class="flex items-center justify-between">
                        <span class="font-black text-slate-200 text-[11px]">${s.label}</span>
                        <span id="kycv-st-${s.key}" class="text-[10px] text-amber-300">جارٍ التحميل...</span>
                      </div>
                      <div id="kycv-img-${s.key}" class="min-h-[80px] rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 text-[10px]">جاري جلب الصورة...</div>
                    </div>`).join('')}
                </div>`}
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              ${!isSelfView && app.hasAdminAccess() ? `
                ${window.DamanAdmin && DamanAdmin.openUser360Modal ? `<button type="button" onclick="document.getElementById('daman-kycv-modal').classList.add('hidden'); DamanAdmin.openUser360Modal('${app.esc(uid)}')" class="py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-[11px]">🔎 ملف 360°</button>` : '<div></div>'}
                ${window.DamanAdmin && DamanAdmin.revokeUserKyc ? `<button type="button" onclick="DamanAdmin.revokeUserKyc('${app.esc(uid)}')" class="py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black text-[11px]">⚠️ طلب إعادة توثيق</button>` : '<div></div>'}` : `
                <button type="button" onclick="document.getElementById('daman-kycv-modal').classList.add('hidden'); if(window.DamanWallet) DamanWallet.openKycModal(false)" class="col-span-2 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px]">🔄 تحديث / إعادة رفع البطاقة أو السجل التجاري</button>`}
            </div>
          </div>`;

        // Fetch and render all uploaded document images in parallel
        mediaSlots.forEach(async (s) => {
          const src = await this.resolveImgSrc(app, s.id);
          const slotEl = document.getElementById('kycv-img-' + s.key);
          const stEl = document.getElementById('kycv-st-' + s.key);
          if (!slotEl) return;
          if (!src) {
            if (stEl) stEl.textContent = 'غير متاح';
            slotEl.innerHTML = `<span class="text-rose-400">تعذر تحميل الصورة</span>`;
            return;
          }
          if (stEl) stEl.innerHTML = `<button type="button" onclick="window.DamanLightbox.open('${src.replace(/'/g, "\\'")}','${s.label}')" class="text-emerald-400 underline font-black">تكبير وحفظ</button>`;
          slotEl.innerHTML = `<img src="${src}" onclick="window.DamanLightbox.open(this.src,'${s.label}')" class="w-full max-h-56 object-contain rounded-xl cursor-pointer border border-slate-700" />`;
        });
      } catch (err) {
        app.toast(err.message, 'error');
        m.classList.add('hidden');
      }
    },

    printKycRecordA4() {
      const app = window.DamanApp;
      const d = this._lastOpenedData;
      if (!d) return;
      const stAr = this.isApprovedStatus(d.status) ? 'موثّق ومعتمد' : d.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة';
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:16px;">بيان توثيق الهوية والسجل التجاري — ${app.esc(app.t('appName'))}</h2>
              <div style="font-size:11px;">مستخرج رسمي من أرشيف التوثيق</div>
            </div>
            <div style="font-size:11px; text-align:left;">
              <div><b>التاريخ:</b> ${app.todayLocal()}</div>
              <div><b>الحالة:</b> ${stAr}</div>
            </div>
          </div>
          <table>
            <tr><th style="width:28%;">الاسم الرباعي القانوني</th><td><b>${app.esc(d.legalName)}</b></td></tr>
            <tr><th>الرقم القومي</th><td><b>${app.esc(d.nationalId)}</b></td></tr>
            <tr><th>تاريخ الميلاد</th><td>${app.esc(d.birthDate)}</td></tr>
            <tr><th>العنوان بالبطاقة</th><td>${app.esc(d.legalAddress)}</td></tr>
            <tr><th>نوع الحساب</th><td>${this.accountTypeAr(d.accountType)}</td></tr>
            <tr><th>رقم الموبايل / البريد</th><td>${app.esc(d.phone)} — ${app.esc(d.email)}</td></tr>
            ${d.companyName || d.commercialReg || d.taxCard ? `
              <tr><th>الاسم الرسمي للشركة</th><td><b>${app.esc(d.companyName || '—')}</b></td></tr>
              <tr><th>رقم السجل التجاري</th><td><b>${app.esc(d.commercialReg || '—')}</b></td></tr>
              <tr><th>رقم البطاقة الضريبية</th><td><b>${app.esc(d.taxCard || '—')}</b></td></tr>` : ''}
          </table>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:26px; text-align:center; font-size:11px;">
            <div>مسؤول المراجعة والتوثيق<br/><br/>.....................................</div>
            <div>اعتماد الإدارة<br/><br/>.....................................</div>
          </div>
        </div>`);
    },

    // ==================== 3. USER SELF-VIEW CARD INSIDE "صفحتي" (PROFILE TAB) ====================
    injectUserProfileVaultCard() {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'profile' || app.viewingPublicUid || !app.user || !app.profile) return;
      const main = document.getElementById('app-main');
      if (!main || document.getElementById('daman-my-kyc-vault-card')) return;

      const root = main.firstElementChild || main;
      const p = app.profile;
      const card = document.createElement('div');
      card.id = 'daman-my-kyc-vault-card';
      card.className = 'glass-card rounded-2xl p-3.5 border-amber-500/40 flex items-center justify-between gap-2 text-xs mb-3';
      card.innerHTML = `
        <div class="min-w-0">
          <div class="font-black text-amber-400 flex items-center gap-1.5 flex-wrap">
            <span>🪪 مستنداتي الموثّقة (البطاقة / السجل)</span>
            ${this.statusBadge(p.kycStatus)}
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5 truncate">
            ${p.nationalId ? `قومي: ${app.maskNationalId ? app.maskNationalId(p.nationalId) : p.nationalId}` : 'لم يتم رفع البطاقة بعد'}${p.commercialReg ? ` • س.ت: ${app.esc(p.commercialReg)}` : ''}
          </div>
        </div>
        <button type="button" onclick="DamanKycVault.openDocsModal('${app.esc(app.user.uid)}',true)" class="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px] shrink-0">
          👁️ عرض المستندات
        </button>`;

      if (root.children.length > 1) root.insertBefore(card, root.children[1]);
      else root.appendChild(card);
    },

    // ==================== 4. HOOK INTO ADMIN PANEL & PROFILE TAB ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      // Hook Admin Panel to add "🪪 أرشيف البطاقات" tab cleanly
      if (window.DamanAdmin && !DamanAdmin._kycVaultHooked) {
        DamanAdmin._kycVaultHooked = true;

        const origSetTab = DamanAdmin.setSubTab.bind(DamanAdmin);
        DamanAdmin.setSubTab = function (t) {
          if (t === 'kyc_vault') {
            if (!window.DamanApp.hasAdminAccess()) return window.DamanApp.toast('للإدارة فقط', 'error');
            this._viewingCategoriesTab = false;
            this._viewingKycVaultTab = true;
            this.rerender();
            return;
          }
          this._viewingKycVaultTab = false;
          return origSetTab(t);
        };

        const origAdminRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdminRender(container, a);
          try {
            if (!a.hasAdminAccess()) return;
            const tabBar = container.querySelector('.overflow-x-auto');
            if (!tabBar) return;

            const isVaultActive = !!DamanAdmin._viewingKycVaultTab;
            if (isVaultActive) {
              Array.from(tabBar.querySelectorAll('button')).forEach((b) => {
                b.className = 'shrink-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300';
              });
            }

            let btn = tabBar.querySelector('[data-adm-kycv-tab]');
            if (!btn) {
              btn = document.createElement('button');
              btn.setAttribute('data-adm-kycv-tab', '1');
              btn.onclick = () => DamanAdmin.setSubTab('kyc_vault');
              btn.textContent = '🪪 أرشيف البطاقات';
              tabBar.appendChild(btn);
            }
            btn.className = `shrink-0 px-3 py-2 rounded-xl ${isVaultActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'}`;

            if (isVaultActive) {
              while (tabBar.nextElementSibling) tabBar.nextElementSibling.remove();
              const slot = document.createElement('div');
              slot.id = 'adm-kycv-panel-slot';
              slot.innerHTML = this.renderAdminArchivePanel(a);
              tabBar.parentNode.appendChild(slot);
            }
          } catch (e) {}
        };
      }

      // Hook Profile Tab cleanly so user can always review their own uploaded ID/CR
      if (typeof app.renderCurrentTab === 'function' && !app._kycProfHooked) {
        app._kycProfHooked = true;
        const origRenderTab = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRenderTab();
          if (app.activeTab === 'profile') setTimeout(() => this.injectUserProfileVaultCard(), 60);
        };
      }

      if (app.activeTab === 'profile') setTimeout(() => this.injectUserProfileVaultCard(), 100);
      if (app.activeTab === 'admin' && window.DamanAdmin) DamanAdmin.rerender();
    }
  };

  window.DamanKycVault = KycVault;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => KycVault.boot(), 340));
  else setTimeout(() => KycVault.boot(), 340);
})();
