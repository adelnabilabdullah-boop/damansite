(function () {
  const WALLET_VER = '28';

  if (!window.DamanToggleHelp) {
    window.DamanToggleHelp = function (id) {
      const el = document.getElementById('fh-' + id);
      if (el) el.classList.toggle('hidden');
    };
  }

  const WalletMod = {
    subTab: 'overview',
    txFilter: 'all',
    txSearch: '',
    requests: [],
    transactions: [],
    attachedUid: null,
    unsubReqs: null,
    unsubTxs: null,

    _opsReady: false,
    _opsLoading: false,

    depositTimer: null,
    depositSecondsLeft: 0,
    depositExpired: false,
    freshAppConfig: null,
    selectedDepositChannel: 'vodafone_cash',
    tempReceiptBase64: '',

    kycPhotos: { idFront: '', idBack: '', selfie: '', crDoc: '', taxDoc: '' },

    hBtn(id) {
      return `<button type="button" onclick="window.DamanToggleHelp('${id}')" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/25 border border-sky-400/70 text-sky-300 text-[9.5px] font-black ms-1 align-middle" title="شرح الخانة">؟</button>`;
    },

    hBox(id, text) {
      return `<div id="fh-${id}" class="hidden mt-1 mb-1.5 p-2.5 rounded-xl bg-sky-950/95 border border-sky-400/60 text-[11px] text-sky-100 leading-relaxed font-semibold shadow-lg">💡 ${text}</div>`;
    },

    registerOps(opsObj) {
      Object.assign(this, opsObj);
      this._opsReady = true;
      this._opsLoading = false;
    },

    ensureOpsLoaded(cb) {
      if (this._opsReady) { if (cb) cb(); return; }
      if (this._opsLoading) {
        if (cb) setTimeout(() => { if (this._opsReady) cb(); }, 700);
        return;
      }
      this._opsLoading = true;
      const sc = document.createElement('script');
      sc.src = `wallet-ops.js?v=${WALLET_VER}&t=${Date.now()}`;
      sc.onload = () => {
        this._opsLoading = false;
        if (this._opsReady && cb) cb();
      };
      sc.onerror = () => {
        this._opsLoading = false;
        if (window.DamanApp) window.DamanApp.toast('تأكد من رفع ملف wallet-ops.js على GitHub', 'error');
      };
      document.body.appendChild(sc);
    },

    openDepositModal(prefillAmount = '') {
      if (this._opsReady && typeof this._openDepositModalImpl === 'function') {
        return this._openDepositModalImpl(prefillAmount);
      }
      window.DamanApp.toast('جارٍ فتح شاشة الإيداع...', 'info');
      this.ensureOpsLoaded(() => {
        if (typeof this._openDepositModalImpl === 'function') this._openDepositModalImpl(prefillAmount);
      });
    },

    openWithdrawModal() {
      if (this._opsReady && typeof this._openWithdrawModalImpl === 'function') {
        return this._openWithdrawModalImpl();
      }
      window.DamanApp.toast('جارٍ فتح شاشة السحب...', 'info');
      this.ensureOpsLoaded(() => {
        if (typeof this._openWithdrawModalImpl === 'function') this._openWithdrawModalImpl();
      });
    },

    openDepositWithAmount(neededAmount) {
      window.DamanApp.switchTab('wallet');
      setTimeout(() => this.openDepositModal(Math.ceil(Number(neededAmount || 0))), 160);
    },

    ensureListeners(app) {
      this.ensureOpsLoaded();
      if (!app.user) { this.detachListeners(); return; }
      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      this.unsubReqs = app.db.collection('walletRequests').where('userId', '==', app.user.uid).limit(50).onSnapshot((snap) => {
        this.requests = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'wallet') this.rerender();
      }, () => {});

      this.unsubTxs = app.db.collection('transactions').where('userId', '==', app.user.uid).limit(100).onSnapshot((snap) => {
        this.transactions = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'wallet') this.rerender();
      }, () => {});
    },

    clearDepositTimer() {
      if (this.depositTimer) { clearInterval(this.depositTimer); this.depositTimer = null; }
    },

    detachListeners() {
      if (this.unsubReqs) { try { this.unsubReqs(); } catch (e) {} this.unsubReqs = null; }
      if (this.unsubTxs) { try { this.unsubTxs(); } catch (e) {} this.unsubTxs = null; }
      this.clearDepositTimer();
      this.attachedUid = null;
      this.requests = [];
      this.transactions = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'wallet') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) { this.subTab = t; this.rerender(); },
    setTxFilter(f) { this.txFilter = f; this.rerender(); },

    channelShort(ch) {
      return { vodafone_cash: 'محفظة كاش', instapay: 'إنستا باي', bank: 'تحويل بنكي' }[ch] || ch || '—';
    },

    statusBadge(st) {
      if (st === 'approved') return '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black">معتمد ✅</span>';
      if (st === 'rejected') return '<span class="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-black">مرفوض ❌</span>';
      if (st === 'cancelled') return '<span class="px-2 py-0.5 rounded-lg bg-slate-700 text-slate-300 text-[10px] font-black">ملغى ↩️</span>';
      return '<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-black">قيد المراجعة ⏳</span>';
    },

    // ==================== MANDATORY KYC MODAL (WITH ? HELP ON EVERY FIELD) ====================
    openKycModal(isForced = false) {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const p = app.profile;
      const isCompany = p.accountType === 'company' || p.accountType === 'supplier';
      this.kycPhotos = { idFront: '', idBack: '', selfie: '', crDoc: '', taxDoc: '' };

      let m = document.getElementById('daman-kyc-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-kyc-modal';
        m.className = 'daman-modal fixed inset-0 z-[92] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-id-card-clip me-1"></i> توثيق الهوية الإجباري (${isCompany ? 'شركة / مورّد' : 'أفراد / مقاولين'})</h3>
            ${!isForced ? `<button onclick="document.getElementById('daman-kyc-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>` : ''}
          </div>
          <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 leading-relaxed">
            اضغط على علامة <b>(؟)</b> بجانب أي خانة لمعرفة المطلوب كتابته فيها بالتفصيل. صور البطاقة سرية تماماً ولا يراها إلا الإدارة.
          </div>

          <form onsubmit="DamanWallet.submitKyc(event)" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">${isCompany ? 'الاسم الرباعي للمسؤول القانوني *' : 'الاسم الرباعي كما في البطاقة *'} ${this.hBtn('k-name')}</label>
              ${this.hBox('k-name', 'اكتب اسمك الرباعي بالكامل بنفس الحروف المكتوبة على وش بطاقة الرقم القومي — يُستخدم هذا الاسم تلقائياً في العقود الرسمية لضمان حقك.')}
              <input id="kyc-legal-name" type="text" required value="${app.esc(p.legalName || '')}" placeholder="مثال: عادل نبيل عبد الله محمد" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">الرقم القومي (14 رقم) * ${this.hBtn('k-nid')}</label>
              ${this.hBox('k-nid', 'اكتب الـ 14 رقم المكتوبين أسفل وش بطاقة الرقم القومي بالإنجليزية بدون مسافات. لا يُعرض الرقم القومي للعامة ويُستخدم فقط في العقود ومنع الحسابات الوهمية.')}
              <input id="kyc-nid" type="text" inputmode="numeric" maxlength="14" required value="${app.esc(p.nationalId || '')}" oninput="DamanWallet.previewNidBirthDate(this.value)" placeholder="29801012101234" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black tracking-wider" />
              <div id="kyc-nid-info" class="text-[10px] mt-1 font-bold text-slate-400">سيتم استخراج تاريخ الميلاد والتحقق من السن (+18) تلقائياً</div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">العنوان المثبت بالبطاقة * ${this.hBtn('k-addr')}</label>
              ${this.hBox('k-addr', 'اكتب عنوان السكن كما هو مكتوب في بطاقتك الشخصية (المحافظة — المركز أو الحي — الشارع) ليظهر بشكل رسمي في العقود.')}
              <input id="kyc-address" type="text" required value="${app.esc(p.legalAddress || '')}" placeholder="المحافظة — المركز/الحي — الشارع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            ${isCompany ? `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/40 space-y-2">
                <div class="text-[11px] font-black text-sky-300">بيانات الشركة / المورّد ${this.hBtn('k-comp')}</div>
                ${this.hBox('k-comp', 'أدخل الاسم الرسمي للشركة ورقم السجل التجاري والبطاقة الضريبية لتوثيق حسابك كشركة أو مورد B2B معتمد.')}
                <input id="kyc-comp-name" type="text" required value="${app.esc(p.companyName || p.name || '')}" placeholder="الاسم الرسمي للشركة" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
                <div class="grid grid-cols-2 gap-2">
                  <input id="kyc-cr" type="text" required value="${app.esc(p.commercialReg || '')}" placeholder="رقم السجل التجاري" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
                  <input id="kyc-tax" type="text" required value="${app.esc(p.taxCard || '')}" placeholder="رقم البطاقة الضريبية" class="px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
                </div>
              </div>` : ''}

            <div class="space-y-1">
              <div class="text-[10.5px] font-bold text-amber-300">صور البطاقة والسيلفي * ${this.hBtn('k-photos')}</div>
              ${this.hBox('k-photos', 'صوّر وش البطاقة وضهر البطاقة في إضاءة واضحة بدون انعكاس فلاش، والتقط سيلفي واضح لوجهك (يفضل ممسكاً بالبطاقة) لمطابقة الهوية بسرعة.')}
              <div class="grid grid-cols-2 gap-2">
                <label class="p-2.5 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer">
                  <div class="text-[10.5px] font-black text-amber-300">🪪 وش البطاقة *</div>
                  <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'idFront')" />
                  <div id="kyc-prev-idFront" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div>
                </label>
                <label class="p-2.5 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer">
                  <div class="text-[10.5px] font-black text-amber-300">🪪 ضهر البطاقة *</div>
                  <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'idBack')" />
                  <div id="kyc-prev-idBack" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div>
                </label>
              </div>
              <label class="block p-3 rounded-xl border border-dashed border-emerald-500/60 bg-slate-950 text-center cursor-pointer">
                <div class="text-[11px] font-black text-emerald-300">🤳 صورة سيلفي واضحة لوجهك *</div>
                <input type="file" accept="image/*" capture="user" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'selfie')" />
                <div id="kyc-prev-selfie" class="text-[9.5px] text-slate-500 mt-1">اضغط لالتقاط سيلفي مباشر</div>
              </label>
              ${isCompany ? `
                <div class="grid grid-cols-2 gap-2">
                  <label class="p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950 text-center cursor-pointer"><div class="text-[10px] font-black text-sky-300">📄 السجل التجاري *</div><input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'crDoc')" /><div id="kyc-prev-crDoc" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div></label>
                  <label class="p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950 text-center cursor-pointer"><div class="text-[10px] font-black text-sky-300">📄 البطاقة الضريبية *</div><input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'taxDoc')" /><div id="kyc-prev-taxDoc" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div></label>
                </div>` : ''}
            </div>

            <button id="kyc-submit-btn" type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> إرسال مستندات التوثيق للإدارة
            </button>
          </form>
        </div>`;

      if (p.nationalId) this.previewNidBirthDate(p.nationalId);
    },

    previewNidBirthDate(val) {
      const box = document.getElementById('kyc-nid-info');
      if (!box) return;
      const clean = String(val || '').replace(/\D/g, '');
      if (clean.length < 14) {
        box.className = 'text-[10px] mt-1 font-bold text-slate-400';
        box.textContent = `متبقي ${14 - clean.length} رقم...`;
        return;
      }
      const res = window.DamanApp.parseEgyptianNationalId(clean);
      box.className = `text-[10px] mt-1 font-black ${res.valid ? 'text-emerald-400' : 'text-rose-400'}`;
      box.textContent = res.valid ? `✅ رقم قومي صحيح — تاريخ الميلاد: ${res.birthDate} (السن: ${res.age} سنة)` : `❌ ${res.error}`;
    },

    async handleKycPhoto(input, slot) {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const b64 = await window.DamanApp.compressImage(file, 780, 0.56);
        this.kycPhotos[slot] = b64;
        const prev = document.getElementById('kyc-prev-' + slot);
        if (prev) prev.innerHTML = `<img src="${b64}" class="max-h-24 mx-auto rounded-lg mt-1.5 border border-slate-700" />`;
      } catch (e) { window.DamanApp.toast('تعذر ضغط الصورة', 'error'); }
    },

    async submitKyc(e) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.withLock('submitKyc', async () => {
        const legalName = document.getElementById('kyc-legal-name').value.trim();
        const nidRaw = document.getElementById('kyc-nid').value.trim();
        const legalAddress = document.getElementById('kyc-address').value.trim();
        const isCompany = app.profile?.accountType === 'company' || app.profile?.accountType === 'supplier';
        const companyName = isCompany ? document.getElementById('kyc-comp-name').value.trim() : '';
        const commercialReg = isCompany ? document.getElementById('kyc-cr').value.trim() : '';
        const taxCard = isCompany ? document.getElementById('kyc-tax').value.trim() : '';

        if (legalName.split(/\s+/).length < 3) return app.toast('اكتب الاسم الرباعي بالكامل', 'warning');
        const parsed = app.parseEgyptianNationalId(nidRaw);
        if (!parsed.valid) return app.toast(parsed.error, 'error');
        if (!this.kycPhotos.idFront || !this.kycPhotos.idBack || !this.kycPhotos.selfie) return app.toast('ارفع صور البطاقة والسيلفي أولاً', 'warning');
        if (isCompany && (!this.kycPhotos.crDoc || !this.kycPhotos.taxDoc)) return app.toast('ارفع صورة السجل والضريبية', 'warning');

        const btn = document.getElementById('kyc-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الرفع الآمن...'; }
        try {
          const bl = await app.checkBlacklist({ email: app.profile?.email, phone: app.profile?.phone, nationalId: parsed.nid, commercialReg });
          if (bl) { if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; } return app.toast(`تعذر التوثيق: ${bl}`, 'error'); }

          const dupNid = await app.db.collection('users').where('nationalId', '==', parsed.nid).limit(2).get();
          if (dupNid.docs.some((d) => d.id !== app.user.uid)) {
            if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
            return app.toast('هذا الرقم القومي مسجّل بالفعل على حساب آخر!', 'error');
          }

          const [idFrontMedia, idBackMedia, selfieMedia, crMedia, taxMedia] = await Promise.all([
            app.saveMedia(this.kycPhotos.idFront, { kind: 'kyc_id_front' }),
            app.saveMedia(this.kycPhotos.idBack, { kind: 'kyc_id_back' }),
            app.saveMedia(this.kycPhotos.selfie, { kind: 'kyc_selfie' }),
            isCompany ? app.saveMedia(this.kycPhotos.crDoc, { kind: 'kyc_cr' }) : Promise.resolve(''),
            isCompany ? app.saveMedia(this.kycPhotos.taxDoc, { kind: 'kyc_tax' }) : Promise.resolve('')
          ]);

          await app.db.collection('kycRequests').doc(app.user.uid).set({
            userId: app.user.uid, displayName: app.profile?.companyName || app.profile?.name || '',
            accountType: app.profile?.accountType || 'individual', phone: app.profile?.phone || '', email: app.profile?.email || '',
            legalName, nationalId: parsed.nid, birthDate: parsed.birthDate, legalAddress,
            companyName, commercialReg, taxCard, idFrontMedia, idBackMedia, selfieMedia, crMedia, taxMedia,
            status: 'pending', submittedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('users').doc(app.user.uid).update({ kycStatus: 'pending', kycRejectionReason: '' });
          await app.sendNotification('ADMIN', 'طلب توثيق هوية جديد 🪪', `${legalName} (${parsed.nid})`);
          document.getElementById('daman-kyc-modal').classList.add('hidden');
          app.toast('تم إرسال مستندات التوثيق بنجاح ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
          app.toast(err.message, 'error');
        }
      });
    },

    // ==================== PACKAGES, PROMO CODES & EXPORTS ====================
    async buyPackage(planType) {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) return this.openKycModal(true);

      const pkgs = app.appConfig?.packages || {};
      const price = planType === 'company' ? Number(pkgs.companyMonthly || 450) : Number(pkgs.individualMonthly || 150);
      const label = planType === 'company' ? 'باقة الشركات والموردين VIP (30 يوم)' : 'باقة الأفراد والمقاولين VIP (30 يوم)';
      const avail = Number(app.profile.balanceAvailable || 0);
      const bonus = Number(app.profile.balanceBonus || 0);

      if (avail + bonus < price) {
        const diff = Math.round((price - (avail + bonus)) * 100) / 100;
        if (window.confirm(`رصيدك غير كافٍ — شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) this.openDepositModal(diff);
        return;
      }
      if (!window.confirm(`تأكيد الاشتراك في ${label} بمبلغ ${app.fmtMoney(price)} ج.م؟`)) return;

      await app.withLock('buyPkg', async () => {
        const userRef = app.db.collection('users').doc(app.user.uid);
        try {
          await app.db.runTransaction(async (tx) => {
            const d = (await tx.get(userRef)).data() || {};
            const curA = Number(d.balanceAvailable || 0), curB = Number(d.balanceBonus || 0);
            if (curA + curB < price) throw new Error('الرصيد غير كافٍ');
            const bonusUsed = Math.round(Math.min(curB, price) * 100) / 100;
            const cashPaid = Math.round((price - bonusUsed) * 100) / 100;
            const afterA = Math.round((curA - cashPaid) * 100) / 100;

            tx.update(userRef, {
              balanceAvailable: afterA, balanceBonus: Math.round((curB - bonusUsed) * 100) / 100,
              subscriptionPlan: planType, subscriptionExpiresAt: Math.max(Date.now(), Number(d.subscriptionExpiresAt || 0)) + 30 * 86400000
            });
            tx.set(app.db.collection('transactions').doc(), { userId: app.user.uid, type: 'subscription', amount: -price, cashPaid, bonusUsed, balanceBefore: curA, balanceAfter: afterA, note: label, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('platformFees').doc(), { type: 'subscription', planType, userId: app.user.uid, userName: app.profile?.name || '', amount: cashPaid, cashPaid, bonusUsed, grossPrice: price, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          });
          app.toast(`تم تفعيل ${label} بنجاح ★`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async redeemPromoCode(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      const code = (document.getElementById('promo-inp')?.value || '').trim().toUpperCase();
      if (!code) return;
      await app.withLock('promo', async () => {
        const codeRef = app.db.collection('promoCodes').doc(code);
        const userRef = app.db.collection('users').doc(app.user.uid);
        try {
          let reward = 0;
          await app.db.runTransaction(async (tx) => {
            const [cDoc, uDoc] = await Promise.all([tx.get(codeRef), tx.get(userRef)]);
            if (!cDoc.exists) throw new Error('كود الهدية غير صحيح');
            const c = cDoc.data();
            if (!c.active || (c.expiresAt && Number(c.expiresAt) < Date.now())) throw new Error('الكود غير صالح أو منتهي');
            const used = Array.isArray(c.usedBy) ? c.usedBy : [];
            if (used.includes(app.user.uid)) throw new Error('استخدمت هذا الكود من قبل');
            if (Number(c.maxUses || 1) <= used.length) throw new Error('تم استنفاد الكود');
            reward = Number(c.amount || 0);
            const curB = Number((uDoc.data() || {}).balanceBonus || 0);
            tx.update(codeRef, { usedBy: firebase.firestore.FieldValue.arrayUnion(app.user.uid) });
            tx.update(userRef, { balanceBonus: Math.round((curB + reward) * 100) / 100 });
            tx.set(app.db.collection('transactions').doc(), { userId: app.user.uid, type: 'promo_bonus', isBonus: true, amount: reward, note: `كود هدية (${code})`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          });
          document.getElementById('promo-inp').value = '';
          app.toast(`مبروك! تمت إضافة ${app.fmtMoney(reward)} ج.م لرصيد الهدايا 🎉`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    getFilteredTransactions() {
      const app = window.DamanApp;
      const q = app.normalizeAr(this.txSearch);
      return this.transactions.filter((t) => {
        if (this.txFilter === 'in' && Number(t.amount || 0) <= 0) return false;
        if (this.txFilter === 'out' && Number(t.amount || 0) >= 0) return false;
        if (this.txFilter === 'escrow' && !String(t.type || '').includes('escrow') && !['daily_payout', 'milestone_payout', 'final_settlement'].includes(t.type)) return false;
        if (this.txFilter === 'bonus' && !t.isBonus && !String(t.type || '').includes('bonus') && !String(t.type || '').includes('gift')) return false;
        if (q && !app.normalizeAr(`${t.note} ${t.type} ${t.date}`).includes(q)) return false;
        return true;
      });
    },

    exportTransactionsCsv() {
      const app = window.DamanApp;
      const rows = this.getFilteredTransactions();
      if (!rows.length) return app.toast('لا توجد حركات للتصدير', 'info');
      const escCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const lines = [['التاريخ', 'النوع', 'البيان', 'المبلغ', 'الرصيد بعد'].map(escCsv).join(',')].concat(
        rows.map((t) => [t.date || '', t.type || '', t.note || '', t.amount || 0, t.balanceAfter ?? ''].map(escCsv).join(','))
      );
      const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a'); a.href = url; a.download = `damansite-wallet-${app.todayLocal()}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.toast('تم تصدير Excel/CSV ✅', 'success');
    },

    printWalletStatementA4() {
      const app = window.DamanApp;
      const p = app.profile || {};
      const rows = this.getFilteredTransactions().map((t, i) => `<tr><td>${i + 1}</td><td>${app.esc(t.date || '')}</td><td>${app.esc(t.note || t.type || '')}</td><td><b>${app.fmtMoney(t.amount)} ج.م</b></td><td>${t.balanceAfter != null ? app.fmtMoney(t.balanceAfter) + ' ج.م' : '—'}</td></tr>`).join('');
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">كشف حساب المحفظة — ${app.esc(app.t('appName'))}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table style="margin-bottom:12px;">
            <tr><th>الاسم القانوني</th><td>${app.esc(p.legalName || p.name || '—')}</td><th>الرقم القومي</th><td>${app.esc(p.nationalId || '—')}</td></tr>
            <tr><th>المتاح كاش</th><td><b>${app.fmtMoney(p.balanceAvailable || 0)} ج.م</b></td><th>المحجوز بالضمان</th><td><b>${app.fmtMoney(p.balanceEscrow || 0)} ج.م</b></td></tr>
          </table>
          <table><thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>الرصيد بعد</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;">لا توجد حركات</td></tr>'}</tbody></table>
        </div>`);
    },

    render(container, app) {
      this.ensureListeners(app);
      if (!app.user || !app.profile) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">سجّل الدخول لعرض المحفظة</button></div>`;
        return;
      }

      const p = app.profile;
      const avail = Number(p.balanceAvailable || 0);
      const esc = Number(p.balanceEscrow || 0);
      const holdW = Number(p.balancePendingWithdraw || 0);
      const bonus = Number(p.balanceBonus || 0);
      const frozen = Number(p.balanceFrozen || 0);
      const pkgs = app.appConfig?.packages || {};
      const subActive = app.isSubscriptionActive();
      const subExpDate = p.subscriptionExpiresAt ? new Date(Number(p.subscriptionExpiresAt)).toLocaleDateString('ar-EG') : '';
      const filteredTxs = this.getFilteredTransactions();

      container.innerHTML = `
        <div class="space-y-3.5">
          ${frozen > 0 ? `<div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/60 text-xs text-rose-200 font-bold">🔒 مبلغ مجمّد مؤقتاً: <b>${app.fmtMoney(frozen)} ج.م</b>${p.frozenReason ? ' — ' + app.esc(p.frozenReason) : ''}</div>` : ''}

          <div class="glass-card rounded-3xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/30 space-y-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="text-xs font-black text-emerald-400"><i class="fa-solid fa-wallet me-1"></i> محفظة ${app.esc(app.t('appName'))} ${this.hBtn('w-bal')}</div>
              <div class="flex items-center gap-1.5">
                <button onclick="DamanWallet.exportTransactionsCsv()" class="px-2.5 py-1 rounded-xl bg-slate-800 text-emerald-300 text-[10px] font-black">Excel</button>
                <button onclick="DamanWallet.printWalletStatementA4()" class="px-2.5 py-1 rounded-xl bg-white text-slate-950 text-[10px] font-black">كشف A4</button>
              </div>
            </div>
            ${this.hBox('w-bal', '• المتاح كاش: رصيدك الحر للسحب أو التعاقد. • محجوز بالضمان: مبالغ عقودك الجارية. • قيد السحب: طلب سحب بانتظار التحويل. • الهدايا: للباقات وتمييز الإعلانات فقط.')}

            <div class="grid grid-cols-2 gap-2 text-center">
              <div class="p-2.5 rounded-2xl bg-slate-950/90 border border-emerald-500/40"><div class="text-[9.5px] text-slate-400 font-bold">المتاح كاش</div><div class="text-base font-black text-emerald-400 mt-0.5">${app.fmtMoney(avail)} <span class="text-[10px]">ج.م</span></div></div>
              <div class="p-2.5 rounded-2xl bg-slate-950/90 border border-amber-500/40"><div class="text-[9.5px] text-slate-400 font-bold">محجوز بالضمان</div><div class="text-base font-black text-amber-400 mt-0.5">${app.fmtMoney(esc)} <span class="text-[10px]">ج.م</span></div></div>
              <div class="p-2 rounded-2xl bg-slate-950/80 border border-sky-500/30"><div class="text-[9px] text-slate-400 font-bold">قيد السحب</div><div class="text-xs font-black text-sky-400 mt-0.5">${app.fmtMoney(holdW)} ج.م</div></div>
              <div class="p-2 rounded-2xl bg-slate-950/80 border border-purple-500/30"><div class="text-[9px] text-slate-400 font-bold">رصيد هدايا</div><div class="text-xs font-black text-purple-300 mt-0.5">${app.fmtMoney(bonus)} ج.م</div></div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button onclick="DamanWallet.openDepositModal()" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-plus-circle me-1"></i> شحن / إيداع (3 وسائل)</button>
              <button onclick="DamanWallet.openWithdrawModal()" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-arrow-up-from-bracket me-1"></i> سحب كاش (وسيلتين)</button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-extrabold">
            <button onclick="DamanWallet.setSubTab('overview')" class="py-2 rounded-lg ${this.subTab === 'overview' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">الحركات (${this.transactions.length})</button>
            <button onclick="DamanWallet.setSubTab('requests')" class="py-2 rounded-lg ${this.subTab === 'requests' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">الطلبات (${this.requests.length})</button>
            <button onclick="DamanWallet.setSubTab('packages')" class="py-2 rounded-lg ${this.subTab === 'packages' ? 'bg-purple-500 text-white' : 'text-slate-400'}">الباقات والهدايا</button>
          </div>

          ${this.subTab === 'overview' ? `
            <div class="space-y-2.5">
              <input type="text" value="${app.esc(this.txSearch)}" oninput="DamanWallet.txSearch=this.value; DamanWallet.rerender()" placeholder="بحث في الحركات..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white" />
              <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-extrabold">
                ${[['all', 'الكل'], ['in', 'وارد (+)'], ['out', 'صادر (-)'], ['escrow', 'ضمان وعقود'], ['bonus', 'هدايا']].map(([k, lbl]) => `<button onclick="DamanWallet.setTxFilter('${k}')" class="shrink-0 px-2.5 py-1.5 rounded-xl ${this.txFilter === k ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
              </div>
              ${!filteredTxs.length ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد حركات مالية.</div>` : filteredTxs.map((t) => `<div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 text-xs"><div class="min-w-0"><div class="font-bold text-white truncate">${app.esc(t.note || t.type)}</div><div class="text-[10px] text-slate-400">${app.esc(t.date || '')}${t.balanceAfter != null ? ` • بعد: <b class="text-slate-200">${app.fmtMoney(t.balanceAfter)} ج.م</b>` : ''}</div></div><div class="font-black shrink-0 ${t.isBonus ? 'text-purple-300' : Number(t.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${Number(t.amount || 0) >= 0 ? '+' : ''}${app.fmtMoney(t.amount)} ج.م</div></div>`).join('')}
            </div>` : ''}

          ${this.subTab === 'requests' ? `
            <div class="space-y-2">
              ${!this.requests.length ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد طلبات بعد.</div>` : this.requests.map((r) => `
                <div class="glass-card rounded-2xl p-3 space-y-1.5 text-xs">
                  <div class="flex items-center justify-between"><span class="font-black ${r.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}">${r.type === 'deposit' ? '⬇️ إيداع' : '⬆️ سحب'} — ${app.fmtMoney(r.actualAmount || r.amount)} ج.م</span>${this.statusBadge(r.status)}</div>
                  <div class="text-[10.5px] text-slate-300">${this.channelShort(r.channel)} • ${app.esc(r.date || '')}</div>
                  ${r.txRef ? `<div class="text-[10px] text-amber-300">المرجع: <b>${app.esc(r.txRef)}</b></div>` : ''}
                  ${r.destAccount ? `<div class="text-[10px] text-sky-300">إلى: ${app.esc(r.destAccount)} (الصافي: ${app.fmtMoney(r.netPayout || r.amount)} ج.م)</div>` : ''}
                  ${r.adminNote ? `<div class="p-2 rounded-lg bg-slate-950 text-[10px] text-rose-300">ملاحظة الإدارة: ${app.esc(r.adminNote)}</div>` : ''}
                  <div class="flex items-center flex-wrap gap-2 pt-0.5">
                    ${r.receiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.receiptMedia}','إيصال الإيداع')" class="text-[10px] text-emerald-300 underline font-bold">إيصال الإيداع</button>` : ''}
                    ${r.payoutReceiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.payoutReceiptMedia}','إيصال التحويل من الإدارة')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-[10px]">إيصال التحويل</button>` : ''}
                    ${r.type === 'withdraw' && r.status === 'pending' ? `<button onclick="if(DamanWallet.cancelPendingWithdraw) DamanWallet.cancelPendingWithdraw('${r.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px] ms-auto">إلغاء السحب</button>` : ''}
                  </div>
                </div>`).join('')}
            </div>` : ''}

          ${this.subTab === 'packages' ? `
            <div class="space-y-3 text-xs">
              ${subActive ? `<div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 font-bold text-center">★ باقتك مفعّلة حتى: <b>${subExpDate}</b></div>` : ''}
              <div class="glass-card rounded-2xl p-4 border-amber-500/40 space-y-2"><div class="flex justify-between"><b class="text-amber-400">★ باقة الأفراد VIP</b><b class="text-white">${app.fmtMoney(pkgs.individualMonthly || 150)} ج.م/شهر</b></div><button onclick="DamanWallet.buyPackage('individual')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">اشتراك / تجديد</button></div>
              <div class="glass-card rounded-2xl p-4 border-purple-500/40 space-y-2"><div class="flex justify-between"><b class="text-purple-300">👑 باقة الشركات B2B</b><b class="text-white">${app.fmtMoney(pkgs.companyMonthly || 450)} ج.م/شهر</b></div><button onclick="DamanWallet.buyPackage('company')" class="w-full py-2.5 rounded-xl bg-purple-500 text-white font-black">اشتراك / تجديد</button></div>
              <form onsubmit="DamanWallet.redeemPromoCode(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
                <div class="font-black text-sky-300">🎁 كود هدية / برومو كود ${this.hBtn('w-promo')}</div>
                ${this.hBox('w-promo', 'أدخل كود الهدية الذي حصلت عليه من إدارة ضمان سايت ليُضاف فوراً في رصيد الهدايا لاستخدامه في الباقات وتمييز الإعلانات.')}
                <div class="flex gap-2"><input id="promo-inp" type="text" required placeholder="أدخل الكود..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white uppercase font-bold" /><button type="submit" class="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-black">تفعيل</button></div>
              </form>
            </div>` : ''}
        </div>`;
    }
  };

  window.DamanWallet = WalletMod;
  if (window.__damanWalletOpsPending) {
    WalletMod.registerOps(window.__damanWalletOpsPending);
    window.__damanWalletOpsPending = null;
  }
  if (window.DamanApp) window.DamanApp.registerModule('wallet', WalletMod);
})();
