(function () {
  const WalletMod = {
    subTab: 'overview', // 'overview' | 'requests' | 'packages'
    txFilter: 'all', // 'all' | 'in' | 'out' | 'escrow' | 'bonus'
    txSearch: '',
    requests: [],
    transactions: [],
    attachedUid: null,
    unsubReqs: null,
    unsubTxs: null,

    depositTimer: null,
    depositSecondsLeft: 0,
    depositExpired: false,
    freshAppConfig: null,
    selectedDepositChannel: 'vodafone_cash',
    tempReceiptBase64: '',

    kycPhotos: { idFront: '', idBack: '', selfie: '', crDoc: '', taxDoc: '' },

    ensureListeners(app) {
      if (!app.user) {
        this.detachListeners();
        return;
      }
      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      this.unsubReqs = app.db
        .collection('walletRequests')
        .where('userId', '==', app.user.uid)
        .limit(50)
        .onSnapshot(
          (snap) => {
            this.requests = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'wallet') this.rerender();
          },
          () => {}
        );

      this.unsubTxs = app.db
        .collection('transactions')
        .where('userId', '==', app.user.uid)
        .limit(100)
        .onSnapshot(
          (snap) => {
            this.transactions = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'wallet') this.rerender();
          },
          () => {}
        );
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

    getEnabledDepositChannels(cfg) {
      const c = (cfg && cfg.depositChannels) || {};
      return {
        vodafone_cash: c.vodafone_cash !== false,
        instapay: c.instapay !== false,
        bank: c.bank !== false
      };
    },

    getEnabledWithdrawChannels(cfg) {
      const c = (cfg && cfg.withdrawChannels) || {};
      return {
        vodafone_cash: c.vodafone_cash !== false,
        instapay: c.instapay !== false,
        bank: c.bank === true
      };
    },

    // ==================== MANDATORY KYC VERIFICATION MODAL ====================
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
            <h3 class="text-sm font-black text-amber-400">
              <i class="fa-solid fa-id-card-clip me-1"></i> توثيق الهوية الإجباري (${isCompany ? 'شركة / مورّد' : 'أفراد / مقاولين'})
            </h3>
            ${!isForced ? `<button onclick="document.getElementById('daman-kyc-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>` : ''}
          </div>

          <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 leading-relaxed">
            <b>مهم للعقود الرسمية:</b> اكتب الاسم الرباعي والرقم القومي والعنوان <b>كما في بطاقة الرقم القومي بالضبط</b>. تُحفظ الصور بسرية تامة ولا يراها إلا الإدارة وتُستخدم البيانات داخل العقود الرسمية فقط.
          </div>

          <form onsubmit="DamanWallet.submitKyc(event)" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">${isCompany ? 'الاسم الرباعي للمسؤول القانوني (من البطاقة) *' : 'الاسم الرباعي كما في البطاقة بالضبط *'}</label>
              <input id="kyc-legal-name" type="text" required value="${app.esc(p.legalName || '')}" placeholder="مثال: عادل نبيل عبد الله محمد" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">الرقم القومي (14 رقم) *</label>
              <input id="kyc-nid" type="text" inputmode="numeric" maxlength="14" required value="${app.esc(p.nationalId || '')}" oninput="DamanWallet.previewNidBirthDate(this.value)" placeholder="29801012101234" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black tracking-wider" />
              <div id="kyc-nid-info" class="text-[10px] mt-1 font-bold text-slate-400">سيتم استخراج تاريخ الميلاد والتحقق من السن (+18) تلقائياً</div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">العنوان المثبت بضهر البطاقة *</label>
              <input id="kyc-address" type="text" required value="${app.esc(p.legalAddress || '')}" placeholder="المحافظة — المركز/الحي — الشارع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            ${isCompany ? `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/40 space-y-2">
                <div class="text-[11px] font-black text-sky-300">بيانات الشركة / المورّد</div>
                <div><label class="block text-[10px] text-slate-400 mb-1">الاسم الرسمي للشركة *</label><input id="kyc-comp-name" type="text" required value="${app.esc(p.companyName || p.name || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" /></div>
                <div class="grid grid-cols-2 gap-2">
                  <div><label class="block text-[10px] text-slate-400 mb-1">رقم السجل التجاري *</label><input id="kyc-cr" type="text" required value="${app.esc(p.commercialReg || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" /></div>
                  <div><label class="block text-[10px] text-slate-400 mb-1">رقم البطاقة الضريبية *</label><input id="kyc-tax" type="text" required value="${app.esc(p.taxCard || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" /></div>
                </div>
              </div>` : ''}

            <div class="grid grid-cols-2 gap-2">
              <label class="p-2.5 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer">
                <div class="text-[10.5px] font-black text-amber-300"><i class="fa-solid fa-id-card me-1"></i>وش البطاقة *</div>
                <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'idFront')" />
                <div id="kyc-prev-idFront" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div>
              </label>

              <label class="p-2.5 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer">
                <div class="text-[10.5px] font-black text-amber-300"><i class="fa-solid fa-id-card-clip me-1"></i>ضهر البطاقة *</div>
                <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'idBack')" />
                <div id="kyc-prev-idBack" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div>
              </label>
            </div>

            <label class="block p-3 rounded-xl border border-dashed border-emerald-500/60 bg-slate-950 text-center cursor-pointer">
              <div class="text-[11px] font-black text-emerald-300"><i class="fa-solid fa-camera-retro me-1"></i> صورة سيلفي واضحة لوجهك (يفضل مع البطاقة) *</div>
              <input type="file" accept="image/*" capture="user" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'selfie')" />
              <div id="kyc-prev-selfie" class="text-[9.5px] text-slate-500 mt-1">اضغط لالتقاط سيلفي مباشر</div>
            </label>

            ${isCompany ? `
              <div class="grid grid-cols-2 gap-2">
                <label class="p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950 text-center cursor-pointer">
                  <div class="text-[10px] font-black text-sky-300">صورة السجل التجاري *</div>
                  <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'crDoc')" />
                  <div id="kyc-prev-crDoc" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div>
                </label>
                <label class="p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950 text-center cursor-pointer">
                  <div class="text-[10px] font-black text-sky-300">صورة البطاقة الضريبية *</div>
                  <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleKycPhoto(this,'taxDoc')" />
                  <div id="kyc-prev-taxDoc" class="text-[9px] text-slate-500 mt-1">اضغط للرفع</div>
                </label>
              </div>` : ''}

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
      if (res.valid) {
        box.className = 'text-[10px] mt-1 font-black text-emerald-400';
        box.textContent = `✅ رقم قومي صحيح — تاريخ الميلاد: ${res.birthDate} (السن: ${res.age} سنة)`;
      } else {
        box.className = 'text-[10px] mt-1 font-black text-rose-400';
        box.textContent = `❌ ${res.error}`;
      }
    },

    async handleKycPhoto(input, slot) {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const b64 = await window.DamanApp.compressImage(file, 780, 0.56);
        this.kycPhotos[slot] = b64;
        const prev = document.getElementById('kyc-prev-' + slot);
        if (prev) prev.innerHTML = `<img src="${b64}" class="max-h-24 mx-auto rounded-lg mt-1.5 border border-slate-700" />`;
      } catch (e) {
        window.DamanApp.toast('تعذر ضغط الصورة، جرّب صورة أخرى', 'error');
      }
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

        if (legalName.split(/\s+/).length < 3) {
          return app.toast('يرجى كتابة الاسم الرباعي بالكامل كما هو مكتوب في البطاقة', 'warning');
        }
        const parsed = app.parseEgyptianNationalId(nidRaw);
        if (!parsed.valid) return app.toast(parsed.error, 'error');

        if (!this.kycPhotos.idFront || !this.kycPhotos.idBack || !this.kycPhotos.selfie) {
          return app.toast('يجب رفع صور وش وضهر البطاقة وصورة السيلفي أولاً', 'warning');
        }
        if (isCompany && (!this.kycPhotos.crDoc || !this.kycPhotos.taxDoc)) {
          return app.toast('يجب رفع صورة السجل التجاري والبطاقة الضريبية', 'warning');
        }

        const btn = document.getElementById('kyc-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الفحص والرفع الآمن...'; }

        try {
          const bl = await app.checkBlacklist({
            email: app.profile?.email, phone: app.profile?.phone, nationalId: parsed.nid, commercialReg
          });
          if (bl) {
            if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
            return app.toast(`تعذر التوثيق: ${bl}`, 'error');
          }

          const dupNid = await app.db.collection('users').where('nationalId', '==', parsed.nid).limit(2).get();
          const conflict = dupNid.docs.find((d) => d.id !== app.user.uid);
          if (conflict) {
            if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
            return app.toast('هذا الرقم القومي موثّق ومسجّل بالفعل على حساب آخر!', 'error');
          }

          const [idFrontMedia, idBackMedia, selfieMedia, crMedia, taxMedia] = await Promise.all([
            app.saveMedia(this.kycPhotos.idFront, { kind: 'kyc_id_front' }),
            app.saveMedia(this.kycPhotos.idBack, { kind: 'kyc_id_back' }),
            app.saveMedia(this.kycPhotos.selfie, { kind: 'kyc_selfie' }),
            isCompany ? app.saveMedia(this.kycPhotos.crDoc, { kind: 'kyc_cr' }) : Promise.resolve(''),
            isCompany ? app.saveMedia(this.kycPhotos.taxDoc, { kind: 'kyc_tax' }) : Promise.resolve('')
          ]);

          await app.db.collection('kycRequests').doc(app.user.uid).set({
            userId: app.user.uid,
            displayName: app.profile?.companyName || app.profile?.name || '',
            accountType: app.profile?.accountType || 'individual',
            phone: app.profile?.phone || '',
            email: app.profile?.email || '',
            legalName, nationalId: parsed.nid, birthDate: parsed.birthDate, legalAddress,
            companyName, commercialReg, taxCard,
            idFrontMedia, idBackMedia, selfieMedia, crMedia, taxMedia,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          await app.db.collection('users').doc(app.user.uid).update({
            kycStatus: 'pending', kycRejectionReason: ''
          });

          await app.sendNotification('ADMIN', 'طلب توثيق هوية جديد 🪪', `${legalName} (${parsed.nid}) — بانتظار المراجعة.`);
          document.getElementById('daman-kyc-modal').classList.add('hidden');
          app.toast('تم إرسال مستندات التوثيق بنجاح! سيتم المراجعة سريعاً ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
          app.toast(err.message, 'error');
        }
      });
    },

    // ==================== 3-CHANNEL DEPOSIT MODAL (WALLET + HOLDER | BANK NAME/HOLDER/ACC | INSTAPAY DIRECT LINK) ====================
    clearDepositTimer() {
      if (this.depositTimer) { clearInterval(this.depositTimer); this.depositTimer = null; }
    },

    closeDepositModal() {
      this.clearDepositTimer();
      document.getElementById('daman-deposit-modal')?.classList.add('hidden');
    },

    openDepositWithAmount(neededAmount) {
      window.DamanApp.switchTab('wallet');
      setTimeout(() => this.openDepositModal(Math.ceil(Number(neededAmount || 0))), 140);
    },

    async openDepositModal(prefillAmount = '') {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) {
        app.toast('لا يمكن الإيداع قبل توثيق الحساب بالبطاقة والسيلفي', 'error');
        return this.openKycModal(true);
      }

      if (app.appConfig?.disableDeposits && !app.isAdmin()) {
        return app.toast('طلبات الإيداع متوقفة مؤقتاً للصيانة من الإدارة — حاول بعد قليل', 'warning');
      }

      if (this.requests.some((r) => r.type === 'deposit' && r.status === 'pending')) {
        return app.toast('لديك طلب إيداع قيد المراجعة بالفعل — انتظر اعتماده قبل إرسال طلب جديد', 'warning');
      }

      let liveCfg = Object.assign({}, app.appConfig || {});
      try {
        const cfgSnap = await app.db.collection('settings').doc('appConfig').get({ source: 'server' });
        if (cfgSnap.exists) liveCfg = Object.assign({}, liveCfg, cfgSnap.data());
      } catch (e) {}

      if (liveCfg.disableDeposits && !app.isAdmin()) {
        return app.toast('طلبات الإيداع متوقفة مؤقتاً من الإدارة', 'warning');
      }

      const enabled = this.getEnabledDepositChannels(liveCfg);
      const activeList = ['vodafone_cash', 'instapay', 'bank'].filter((k) => enabled[k]);
      if (!activeList.length) {
        return app.toast('جميع قنوات الإيداع متوقفة مؤقتاً — تواصل مع الإدارة', 'error');
      }

      this.freshAppConfig = liveCfg;
      this.selectedDepositChannel = activeList[0];
      this.tempReceiptBase64 = '';
      this.depositExpired = false;
      const minsCfg = Math.max(2, Math.min(30, Number(liveCfg.depositSessionMinutes || 10)));
      this.depositSecondsLeft = minsCfg * 60;

      let m = document.getElementById('daman-deposit-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-deposit-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      this.renderDepositModalContent(m, prefillAmount, minsCfg);
      this.startDepositCountdown();
    },

    selectDepositChannel(ch) {
      this.selectedDepositChannel = ch;
      ['vodafone_cash', 'instapay', 'bank'].forEach((k) => {
        const btn = document.getElementById('dep-tab-' + k);
        const card = document.getElementById('dep-card-' + k);
        if (btn) {
          btn.className = `py-2 px-1.5 rounded-xl text-[10.5px] font-black border transition ${k === ch ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700'}`;
        }
        if (card) card.classList.toggle('hidden', k !== ch);
      });
      const sel = document.getElementById('dep-channel-hidden');
      if (sel) sel.value = ch;
    },

    renderDepositModalContent(modal, prefillAmount = '', minsCfg = 10) {
      const app = window.DamanApp;
      const cfg = this.freshAppConfig || app.appConfig || {};
      const acc = cfg.paymentAccounts || {};
      const enabled = this.getEnabledDepositChannels(cfg);
      const minDep = Number(cfg.minDeposit || 100);
      const maxDep = Number(cfg.maxDeposit || 250000);
      const mins = String(Math.floor(this.depositSecondsLeft / 60)).padStart(2, '0');
      const secs = String(this.depositSecondsLeft % 60).padStart(2, '0');

      const ch = this.selectedDepositChannel;
      const vfNum = acc.vodafoneCash || 'غير محدد';
      const vfHolder = acc.vodafoneHolder || 'غير محدد';
      const ipAddr = acc.instaPay || '';
      const ipHolder = acc.instaPayHolder || '';
      const ipLink = String(acc.instaPayLink || '').trim();
      const bankName = acc.bankName || '';
      const bankHolder = acc.bankHolder || '';
      const bankAccount = acc.bankAccount || acc.bankInfo || 'غير محدد';
      const bankIban = acc.bankIban || '';

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-emerald-400"><i class="fa-solid fa-circle-arrow-down me-1"></i> شحن المحفظة (إيداع عبر 3 وسائل)</h3>
            <button onclick="DamanWallet.closeDepositModal()" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/60 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-black text-rose-300"><i class="fa-solid fa-stopwatch me-1"></i> صلاحية أرقام الاستقبال الحالية</span>
              <span id="dep-countdown-lbl" class="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white font-black text-sm tracking-widest">${mins}:${secs}</span>
            </div>
            <p class="text-[10.5px] text-rose-100 leading-relaxed">
              ⚠️ <b>هام جداً:</b> تتغير أرقام الاستقبال دورياً عند اكتمال الحد الأقصى. حوّل وارفع الإيصال خلال <b>${minsCfg} دقائق</b> فقط، ولا تحوّل أبداً على رقم قديم محفوظ لديك.
            </p>
          </div>

          <div id="dep-expired-gate" class="hidden p-5 rounded-2xl bg-slate-950 border border-rose-500/60 text-center space-y-3">
            <i class="fa-solid fa-clock-rotate-left text-3xl text-rose-400"></i>
            <div class="text-sm font-black text-rose-300">انتهت مهلة البيانات الحالية!</div>
            <p class="text-[11px] text-slate-300">حمايةً لأموالك، تم إخفاء الأرقام السابقة. اضغط أدناه لجلب الحسابات النشطة لحظياً.</p>
            <button onclick="DamanWallet.openDepositModal('${app.esc(prefillAmount)}')" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">
              <i class="fa-solid fa-rotate me-1"></i> تحديث وجلب الحسابات النشطة الآن
            </button>
          </div>

          <div id="dep-active-body" class="space-y-3">
            <div class="grid grid-cols-3 gap-1.5">
              ${enabled.vodafone_cash ? `<button id="dep-tab-vodafone_cash" type="button" onclick="DamanWallet.selectDepositChannel('vodafone_cash')" class="py-2 px-1.5 rounded-xl text-[10.5px] font-black border ${ch === 'vodafone_cash' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700'}">📱 محافظ كاش</button>` : ''}
              ${enabled.instapay ? `<button id="dep-tab-instapay" type="button" onclick="DamanWallet.selectDepositChannel('instapay')" class="py-2 px-1.5 rounded-xl text-[10.5px] font-black border ${ch === 'instapay' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700'}">⚡ إنستا باي</button>` : ''}
              ${enabled.bank ? `<button id="dep-tab-bank" type="button" onclick="DamanWallet.selectDepositChannel('bank')" class="py-2 px-1.5 rounded-xl text-[10.5px] font-black border ${ch === 'bank' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700'}">🏦 تحويل بنكي</button>` : ''}
            </div>

            <!-- 1. E-WALLET: Wallet Number + Wallet Holder Name -->
            <div id="dep-card-vodafone_cash" class="${ch === 'vodafone_cash' ? '' : 'hidden'} p-3 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2">
              <div class="text-[10.5px] text-amber-300 font-black"><i class="fa-solid fa-mobile-screen-button me-1"></i> بيانات المحفظة الإلكترونية النشطة</div>
              <div class="p-2.5 rounded-xl bg-slate-900 space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class="text-[9.5px] text-slate-400">رقم المحفظة (فودافون / اتصالات / أورنج / WE):</div>
                    <div class="text-sm font-black text-white tracking-wider select-all">${app.esc(vfNum)}</div>
                  </div>
                  <button type="button" onclick="navigator.clipboard.writeText('${app.esc(vfNum)}'); DamanApp.toast('تم نسخ رقم المحفظة ✅','success')" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px] shrink-0">نسخ الرقم</button>
                </div>
                <div class="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span class="text-slate-400">اسم صاحب المحفظة:</span>
                  <b class="text-emerald-300">${app.esc(vfHolder)}</b>
                </div>
              </div>
            </div>

            <!-- 2. INSTAPAY: Direct Clickable Link + Address/Holder -->
            <div id="dep-card-instapay" class="${ch === 'instapay' ? '' : 'hidden'} p-3 rounded-2xl bg-slate-950 border border-purple-500/50 space-y-2">
              <div class="text-[10.5px] text-purple-300 font-black"><i class="fa-solid fa-bolt me-1"></i> التحويل المباشر عبر إنستا باي (InstaPay)</div>
              ${ipLink ? `
                <a href="${app.esc(ipLink)}" target="_blank" rel="noopener noreferrer" class="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  اضغط هنا للتحويل مباشرة عبر إنستا باي ⚡
                </a>` : ''}
              <div class="p-2.5 rounded-xl bg-slate-900 space-y-1.5">
                ${ipAddr ? `
                  <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-[9.5px] text-slate-400">عنوان إنستا باي (IPA):</div>
                      <div class="text-xs font-black text-emerald-300 truncate select-all">${app.esc(ipAddr)}</div>
                    </div>
                    <button type="button" onclick="navigator.clipboard.writeText('${app.esc(ipAddr)}'); DamanApp.toast('تم نسخ عنوان إنستا باي ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] shrink-0">نسخ</button>
                  </div>` : ''}
                ${ipHolder ? `
                  <div class="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span class="text-slate-400">اسم صاحب الحساب:</span>
                    <b class="text-white">${app.esc(ipHolder)}</b>
                  </div>` : ''}
                ${!ipLink && !ipAddr ? `<div class="text-rose-300 text-center text-[11px]">لم يتم إضافة رابط إنستا باي من الإدارة بعد.</div>` : ''}
              </div>
            </div>

            <!-- 3. BANK TRANSFER: Bank Name + Account Holder Name + Account Number + Optional IBAN -->
            <div id="dep-card-bank" class="${ch === 'bank' ? '' : 'hidden'} p-3 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-2">
              <div class="text-[10.5px] text-sky-300 font-black"><i class="fa-solid fa-building-columns me-1"></i> بيانات التحويل البنكي النشط</div>
              <div class="p-2.5 rounded-xl bg-slate-900 space-y-2 text-[11px]">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-slate-400">اسم البنك:</span>
                  <b class="text-amber-300">${app.esc(bankName || 'يُحدّد من الإدارة')}</b>
                </div>
                <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800">
                  <span class="text-slate-400">اسم صاحب الحساب البنكي:</span>
                  <b class="text-white text-end">${app.esc(bankHolder || 'يُحدّد من الإدارة')}</b>
                </div>
                <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800">
                  <div class="min-w-0">
                    <div class="text-[9.5px] text-slate-400">رقم الحساب البنكي:</div>
                    <div class="text-xs font-black text-emerald-300 tracking-wider break-all select-all">${app.esc(bankAccount)}</div>
                  </div>
                  <button type="button" onclick="navigator.clipboard.writeText('${app.esc(bankAccount)}'); DamanApp.toast('تم نسخ رقم الحساب البنكي ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px] shrink-0">نسخ الحساب</button>
                </div>
                ${bankIban ? `
                  <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800">
                    <div class="min-w-0">
                      <div class="text-[9.5px] text-slate-400">رقم IBAN:</div>
                      <div class="text-[10.5px] font-black text-sky-300 break-all select-all">${app.esc(bankIban)}</div>
                    </div>
                    <button type="button" onclick="navigator.clipboard.writeText('${app.esc(bankIban)}'); DamanApp.toast('تم نسخ الـ IBAN ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-black text-[10px] shrink-0">نسخ IBAN</button>
                  </div>` : ''}
              </div>
            </div>

            <form onsubmit="DamanWallet.submitDeposit(event)" class="space-y-2.5">
              <input id="dep-channel-hidden" type="hidden" value="${ch}" />

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10.5px] font-bold text-slate-300 mb-1">المبلغ (${app.fmtMoney(minDep)} – ${app.fmtMoney(maxDep)} ج.م) *</label>
                  <input id="dep-amount" type="number" min="${minDep}" max="${maxDep}" step="any" required value="${app.esc(prefillAmount)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
                </div>
                <div>
                  <label class="block text-[10.5px] font-bold text-slate-300 mb-1">رقم/حساب المحوّل منه *</label>
                  <input id="dep-sender" type="text" required value="${app.esc(app.profile?.phone || '')}" placeholder="01xxxxxxxxx أو اسم الحساب" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                </div>
              </div>

              <div>
                <label class="block text-[10.5px] font-bold text-amber-300 mb-1">الرقم المرجعي للعملية (Transaction Reference) *</label>
                <input id="dep-txref" type="text" required placeholder="رقم العملية من رسالة التأكيد أو إيصال التحويل" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-bold" />
              </div>

              <label class="block p-3 rounded-xl border border-dashed border-emerald-500/60 bg-slate-950 text-center cursor-pointer">
                <span class="font-black text-emerald-300"><i class="fa-solid fa-receipt me-1"></i> إرفاق صورة إيصال التحويل *</span>
                <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleReceiptPhoto(this)" />
                <div id="dep-receipt-prev" class="text-[9.5px] text-slate-500 mt-1">اضغط لرفع صورة واضحة للإيصال</div>
              </label>

              <button id="dep-submit-btn" type="submit" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-check-double me-1"></i> تأكيد وإرسال طلب الشحن
              </button>
            </form>
          </div>
        </div>`;
    },

    startDepositCountdown() {
      this.clearDepositTimer();
      this.depositTimer = setInterval(() => {
        this.depositSecondsLeft--;
        const lbl = document.getElementById('dep-countdown-lbl');
        if (this.depositSecondsLeft <= 0) {
          this.clearDepositTimer();
          this.depositExpired = true;
          if (lbl) lbl.textContent = '00:00';
          document.getElementById('dep-active-body')?.classList.add('hidden');
          document.getElementById('dep-expired-gate')?.classList.remove('hidden');
          return;
        }
        if (lbl) {
          const m = String(Math.floor(this.depositSecondsLeft / 60)).padStart(2, '0');
          const s = String(this.depositSecondsLeft % 60).padStart(2, '0');
          lbl.textContent = `${m}:${s}`;
        }
      }, 1000);
    },

    async handleReceiptPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this.tempReceiptBase64 = await window.DamanApp.compressImage(f, 760, 0.56);
        const p = document.getElementById('dep-receipt-prev');
        if (p) p.innerHTML = `<img src="${this.tempReceiptBase64}" class="max-h-28 mx-auto rounded-lg mt-1.5" />`;
      } catch (e) {}
    },

    async submitDeposit(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (this.depositExpired || this.depositSecondsLeft <= 0) {
        return app.toast('انتهت مهلة البيانات الحالية — حدّث الحسابات أولاً', 'error');
      }
      await app.withLock('submitDeposit', async () => {
        const cfg = this.freshAppConfig || app.appConfig || {};
        const channel = document.getElementById('dep-channel-hidden')?.value || this.selectedDepositChannel;
        const amount = Math.round((parseFloat(document.getElementById('dep-amount').value) || 0) * 100) / 100;
        const senderAccount = document.getElementById('dep-sender').value.trim();
        const txRef = document.getElementById('dep-txref').value.trim().toUpperCase();
        const minDep = Number(cfg.minDeposit || 100);
        const maxDep = Number(cfg.maxDeposit || 250000);

        if (amount < minDep) return app.toast(`الحد الأدنى للإيداع ${app.fmtMoney(minDep)} ج.م`, 'warning');
        if (amount > maxDep) return app.toast(`الحد الأقصى للعملية الواحدة ${app.fmtMoney(maxDep)} ج.م`, 'warning');
        if (!txRef || txRef.length < 4) return app.toast('أدخل الرقم المرجعي للعملية بشكل صحيح', 'warning');
        if (!this.tempReceiptBase64) return app.toast('يرجى إرفاق صورة إيصال التحويل', 'warning');

        const btn = document.getElementById('dep-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التحقق والرفع الآمن...'; }

        try {
          const refKey = txRef.replace(/[^A-Z0-9_-]/g, '').slice(0, 80);
          let isDupRef = false;
          if (refKey) {
            try {
              const idxRef = app.db.collection('txRefIndex').doc(refKey);
              const idxSnap = await idxRef.get();
              if (idxSnap.exists) {
                isDupRef = true;
                if (idxSnap.data()?.status === 'approved') {
                  if (btn) { btn.disabled = false; btn.textContent = 'تأكيد وإرسال طلب الشحن'; }
                  return app.toast('⚠️ هذا الرقم المرجعي تم استخدامه واعتماده مسبقاً! لا يمكن تكرار نفس الإيصال.', 'error');
                }
              } else {
                await idxRef.set({
                  txRef, status: 'pending', date: app.todayLocal(),
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
              }
            } catch (e) {}
          }

          const receiptMedia = await app.saveMedia(this.tempReceiptBase64, { kind: 'deposit_receipt' });
          const acc = cfg.paymentAccounts || {};
          const targetAccSnapshot = channel === 'vodafone_cash'
            ? `${acc.vodafoneCash || ''} (${acc.vodafoneHolder || ''})`
            : channel === 'instapay'
            ? `${acc.instaPay || acc.instaPayLink || ''} (${acc.instaPayHolder || ''})`
            : `${acc.bankName || ''} — ${acc.bankHolder || ''} — ${acc.bankAccount || acc.bankInfo || ''}`.trim();

          await app.db.collection('walletRequests').add({
            type: 'deposit',
            userId: app.user.uid,
            userName: app.profile?.companyName || app.profile?.name || '',
            userLegalName: app.profile?.legalName || '',
            userPhone: app.profile?.phone || '',
            channel,
            amount,
            requestedAmount: amount,
            senderAccount,
            txRef,
            targetAccountUsed: targetAccSnapshot,
            duplicateRefFlag: isDupRef,
            receiptMedia,
            status: 'pending',
            date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          await app.sendNotification(
            'ADMIN',
            isDupRef ? '⚠️ طلب شحن برقم مرجعي مكرر!' : 'طلب شحن محفظة جديد 💰',
            `${app.profile?.name} — ${app.fmtMoney(amount)} ج.م (${this.channelShort(channel)}) | مرجع: ${txRef}`
          );

          this.closeDepositModal();
          app.toast('تم إرسال طلب الشحن بنجاح! سيتم المراجعة وإضافة الرصيد قريباً ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'تأكيد وإرسال طلب الشحن'; }
          app.toast(err.message, 'error');
        }
      });
    },

    // ==================== 2-CHANNEL WITHDRAW MODAL ====================
    openWithdrawModal() {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) {
        app.toast('لا يمكن السحب قبل توثيق الحساب بالبطاقة والسيلفي', 'error');
        return this.openKycModal(true);
      }
      if (app.appConfig?.disableWithdrawals && !app.isAdmin()) {
        return app.toast('طلبات السحب متوقفة مؤقتاً للصيانة من الإدارة — حاول لاحقاً', 'warning');
      }
      if (this.requests.some((r) => r.type === 'withdraw' && r.status === 'pending')) {
        return app.toast('لديك طلب سحب قيد المراجعة بالفعل — انتظر تنفيذه أو ألغِه أولاً', 'warning');
      }

      const enabled = this.getEnabledWithdrawChannels(app.appConfig);
      const activeList = ['vodafone_cash', 'instapay', 'bank'].filter((k) => enabled[k]);
      if (!activeList.length) {
        return app.toast('وسائل السحب متوقفة مؤقتاً — تواصل مع الإدارة', 'error');
      }

      const avail = Number(app.profile.balanceAvailable || 0);
      const minW = Number(app.appConfig?.minWithdraw || 100);
      const maxDaily = Number(app.appConfig?.maxWithdrawDaily || 50000);
      const todayUsed = this.requests
        .filter((r) => r.type === 'withdraw' && r.date === app.todayLocal() && ['pending', 'approved'].includes(r.status))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const dailyLeft = Math.max(0, Math.round((maxDaily - todayUsed) * 100) / 100);

      if (avail < minW) {
        return app.toast(`رصيدك الكاش المتاح (${app.fmtMoney(avail)} ج.م) أقل من الحد الأدنى للسحب (${app.fmtMoney(minW)} ج.م). رصيد الهدايا غير قابل للسحب الكاش.`, 'warning');
      }
      if (dailyLeft < minW) {
        return app.toast(`لقد وصلت للحد الأقصى للسحب اليومي (${app.fmtMoney(maxDaily)} ج.م). حاول غداً.`, 'warning');
      }

      const maxAllowedNow = Math.min(avail, dailyLeft);
      const savedVf = localStorage.getItem('daman_last_wd_vf') || app.profile?.phone || '';
      const savedIp = localStorage.getItem('daman_last_wd_ip') || '';

      let m = document.getElementById('daman-withdraw-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-withdraw-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      const opts = [
        enabled.vodafone_cash ? '<option value="vodafone_cash">📱 محفظة إلكترونية (فودافون / اتصالات / أورنج / WE كاش)</option>' : '',
        enabled.instapay ? '<option value="instapay">⚡ إنستا باي (InstaPay)</option>' : '',
        enabled.bank ? '<option value="bank">🏦 تحويل بنكي</option>' : ''
      ].join('');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-money-bill-transfer me-1"></i> سحب رصيد كاش من المحفظة</h3>
            <button onclick="document.getElementById('daman-withdraw-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-[11px]">
            <div>المتاح للسحب: <b class="text-emerald-400">${app.fmtMoney(avail)} ج.م</b></div>
            <div>المتبقي من حد اليوم: <b class="text-sky-400">${app.fmtMoney(dailyLeft)} ج.م</b></div>
          </div>

          <form onsubmit="DamanWallet.submitWithdraw(event)" oninput="DamanWallet.updateWithdrawPreview()" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">وسيلة الاستلام (وسيلتين معتمدتين) *</label>
              <select id="wd-channel" onchange="DamanWallet.onWithdrawChannelChange('${app.esc(savedVf)}','${app.esc(savedIp)}')" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-bold">
                ${opts}
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">المبلغ المطلوب سحبه (${app.fmtMoney(minW)} – ${app.fmtMoney(maxAllowedNow)} ج.م) *</label>
              <input id="wd-amount" type="number" min="${minW}" max="${maxAllowedNow}" step="any" required value="${Math.min(maxAllowedNow, Math.max(minW, 500))}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black" />
            </div>

            <div>
              <label id="wd-dest-lbl" class="block text-[11px] font-bold text-slate-300 mb-1">رقم المحفظة المستلمة (يفضل نفس رقمك الموثّق) *</label>
              <input id="wd-dest" type="text" required value="${app.esc(activeList[0] === 'instapay' ? savedIp : savedVf)}" placeholder="01xxxxxxxxx أو username@instapay" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div id="wd-preview" class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 space-y-0.5"></div>

            <button id="wd-submit-btn" type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">
              تأكيد وحجز مبلغ السحب
            </button>
          </form>
        </div>`;

      this.updateWithdrawPreview();
    },

    onWithdrawChannelChange(savedVf, savedIp) {
      const ch = document.getElementById('wd-channel')?.value;
      const lbl = document.getElementById('wd-dest-lbl');
      const inp = document.getElementById('wd-dest');
      if (ch === 'instapay') {
        if (lbl) lbl.textContent = 'عنوان إنستا باي (username@instapay) أو رقم الموبايل المربوط *';
        if (inp) { inp.value = savedIp || ''; inp.placeholder = 'username@instapay أو 01xxxxxxxxx'; }
      } else if (ch === 'bank') {
        if (lbl) lbl.textContent = 'اسم البنك + اسم المستفيد + رقم الحساب / IBAN *';
        if (inp) { inp.value = ''; inp.placeholder = 'بنك مصر / CIB — رقم الحساب'; }
      } else {
        if (lbl) lbl.textContent = 'رقم المحفظة المستلمة (يفضل نفس رقمك الموثّق) *';
        if (inp) { inp.value = savedVf || ''; inp.placeholder = '01xxxxxxxxx'; }
      }
      this.updateWithdrawPreview();
    },

    calcWithdrawFee(amount, channel) {
      const app = window.DamanApp;
      const cfg = app.appConfig || {};
      const chFees = (cfg.channelWithdrawFees && cfg.channelWithdrawFees[channel]) || {};
      const pct = chFees.pct != null && chFees.pct !== '' ? Number(chFees.pct) : Number(cfg.withdrawFeePct || 0);
      const flat = chFees.flat != null && chFees.flat !== '' ? Number(chFees.flat) : Number(cfg.withdrawFeeFlat || 0);
      const fee = Math.round(((amount * pct) / 100 + flat) * 100) / 100;
      const net = Math.max(0, Math.round((amount - fee) * 100) / 100);
      return { fee, net, pct, flat };
    },

    updateWithdrawPreview() {
      const app = window.DamanApp;
      const ch = document.getElementById('wd-channel')?.value || 'vodafone_cash';
      const amt = parseFloat(document.getElementById('wd-amount')?.value) || 0;
      const { fee, net } = this.calcWithdrawFee(amt, ch);
      const box = document.getElementById('wd-preview');
      if (!box) return;
      box.innerHTML = `
        <div>المبلغ المطلوب سحبه: <b>${app.fmtMoney(amt)} ج.م</b></div>
        <div>رسوم التحويل (${this.channelShort(ch)}): <b>${app.fmtMoney(fee)} ج.م</b></div>
        <div class="text-emerald-300 font-black">الصافي الذي سيصلك: ${app.fmtMoney(net)} ج.م</div>
        <div class="text-[10px] text-slate-300 pt-0.5">يُحجز المبلغ فوراً في خانة «قيد السحب»، ويمكنك إلغاء الطلب قبل اعتماده من الإدارة.</div>`;
    },

    async submitWithdraw(e) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.withLock('submitWithdraw', async () => {
        const channel = document.getElementById('wd-channel').value;
        const amount = Math.round((parseFloat(document.getElementById('wd-amount').value) || 0) * 100) / 100;
        const destAccount = document.getElementById('wd-dest').value.trim();
        const minW = Number(app.appConfig?.minWithdraw || 100);
        const maxDaily = Number(app.appConfig?.maxWithdrawDaily || 50000);

        if (amount < minW) return app.toast(`الحد الأدنى للسحب ${app.fmtMoney(minW)} ج.م`, 'warning');
        if (!destAccount) return app.toast('أدخل بيانات الحساب المستلم', 'warning');

        if (channel === 'vodafone_cash') {
          const cleanDest = app.normalizePhone(destAccount);
          if (!/^01[0125]\d{8}$/.test(cleanDest)) return app.toast('أدخل رقم محفظة مصري صحيح (11 رقم)', 'error');
          localStorage.setItem('daman_last_wd_vf', cleanDest);
        } else if (channel === 'instapay') {
          localStorage.setItem('daman_last_wd_ip', destAccount);
        }

        const todayUsed = this.requests
          .filter((r) => r.type === 'withdraw' && r.date === app.todayLocal() && ['pending', 'approved'].includes(r.status))
          .reduce((s, r) => s + Number(r.amount || 0), 0);
        if (todayUsed + amount > maxDaily) {
          return app.toast(`تجاوزت الحد الأقصى للسحب اليومي (${app.fmtMoney(maxDaily)} ج.م)`, 'error');
        }

        const { fee, net } = this.calcWithdrawFee(amount, channel);
        if (net <= 0) return app.toast('صافي السحب بعد الرسوم يجب أن يكون أكبر من صفر', 'error');

        const userPhoneNorm = app.normalizePhone(app.profile?.phone || '');
        const phoneMismatchFlag = channel === 'vodafone_cash' && userPhoneNorm && app.normalizePhone(destAccount) !== userPhoneNorm;
        const lastDep = this.requests.find((r) => r.type === 'deposit' && r.status === 'approved');
        const hasRealWorkTx = this.transactions.some((t) => ['escrow_lock', 'daily_payout', 'advance_paid', 'milestone_payout', 'final_settlement', 'salary_in'].includes(t.type));
        const rapidFlipFlag = !!(lastDep && lastDep.channel !== channel && !hasRealWorkTx);

        const btn = document.getElementById('wd-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'جارٍ حجز المبلغ وإرسال الطلب...'; }

        const userRef = app.db.collection('users').doc(app.user.uid);
        const reqRef = app.db.collection('walletRequests').doc();
        const txRefDoc = app.db.collection('transactions').doc();

        try {
          await app.db.runTransaction(async (tx) => {
            const uDoc = await tx.get(userRef);
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            const curHold = Number((uDoc.data() || {}).balancePendingWithdraw || 0);
            if (curAvail < amount) throw new Error('رصيدك المتاح غير كافٍ لإتمام طلب السحب');

            const afterAvail = Math.round((curAvail - amount) * 100) / 100;
            tx.update(userRef, {
              balanceAvailable: afterAvail,
              balancePendingWithdraw: Math.round((curHold + amount) * 100) / 100
            });
            tx.set(reqRef, {
              type: 'withdraw',
              userId: app.user.uid,
              userName: app.profile?.companyName || app.profile?.name || '',
              userLegalName: app.profile?.legalName || '',
              userPhone: app.profile?.phone || '',
              channel,
              amount,
              withdrawFee: fee,
              netPayout: net,
              destAccount,
              phoneMismatchFlag,
              rapidFlipFlag,
              lastDepositChannel: lastDep ? lastDep.channel : '',
              status: 'pending',
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(txRefDoc, {
              userId: app.user.uid,
              type: 'withdraw_hold',
              amount: -amount,
              balanceBefore: curAvail,
              balanceAfter: afterAvail,
              note: `حجز طلب سحب (${this.channelShort(channel)} — ${destAccount})`,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });

          const flagTag = phoneMismatchFlag || rapidFlipFlag ? ' ⚠️ (مراجعة أمنية)' : '';
          await app.sendNotification('ADMIN', `طلب سحب رصيد جديد 💸${flagTag}`, `${app.profile?.name} — صافي التحويل: ${app.fmtMoney(net)} ج.م على ${destAccount}`);
          document.getElementById('daman-withdraw-modal').classList.add('hidden');
          app.toast('تم حجز المبلغ وإرسال طلب السحب للإدارة بنجاح ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'تأكيد وحجز مبلغ السحب'; }
          app.toast(err.message, 'error');
        }
      });
    },

    async cancelPendingWithdraw(reqId) {
      const app = window.DamanApp;
      const req = this.requests.find((r) => r.id === reqId);
      if (!req || req.type !== 'withdraw' || req.status !== 'pending') return;
      if (!window.confirm(`إلغاء طلب السحب (${app.fmtMoney(req.amount)} ج.م) وإعادة المبلغ فوراً إلى رصيدك المتاح؟`)) return;

      await app.withLock('cancelWd_' + reqId, async () => {
        const reqRef = app.db.collection('walletRequests').doc(reqId);
        const userRef = app.db.collection('users').doc(app.user.uid);
        const txRefDoc = app.db.collection('transactions').doc();

        try {
          await app.db.runTransaction(async (tx) => {
            const [rDoc, uDoc] = await Promise.all([tx.get(reqRef), tx.get(userRef)]);
            if (!rDoc.exists || rDoc.data().status !== 'pending') throw new Error('تمت معالجة الطلب بالفعل من الإدارة');
            const amt = Number(rDoc.data().amount || 0);
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            const curHold = Number((uDoc.data() || {}).balancePendingWithdraw || 0);
            const afterAvail = Math.round((curAvail + amt) * 100) / 100;

            tx.update(reqRef, { status: 'cancelled', adminNote: 'ألغاه المستخدم قبل التنفيذ', cancelledAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.update(userRef, {
              balanceAvailable: afterAvail,
              balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100)
            });
            tx.set(txRefDoc, {
              userId: app.user.uid,
              type: 'withdraw_cancel',
              amount: amt,
              balanceBefore: curAvail,
              balanceAfter: afterAvail,
              note: 'إلغاء طلب سحب بواسطة المستخدم وردّ المبلغ للمتاح',
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          app.toast('تم إلغاء الطلب وردّ المبلغ فوراً إلى رصيدك المتاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== VIP PACKAGES & PROMO CODES ====================
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
        if (window.confirm(`رصيدك غير كافٍ (السعر ${app.fmtMoney(price)} ج.م).\nهل تريد شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
          this.openDepositModal(diff);
        }
        return;
      }

      const willUseBonus = Math.min(bonus, price);
      const willUseCash = Math.round((price - willUseBonus) * 100) / 100;
      const breakdown = willUseBonus > 0
        ? `\n(سيتم خصم ${app.fmtMoney(willUseBonus)} ج.م من رصيد الهدايا + ${app.fmtMoney(willUseCash)} ج.م من المتاح)`
        : '';

      if (!window.confirm(`تأكيد الاشتراك في ${label} بمبلغ ${app.fmtMoney(price)} ج.م؟${breakdown}`)) return;

      await app.withLock('buyPkg', async () => {
        const userRef = app.db.collection('users').doc(app.user.uid);
        try {
          await app.db.runTransaction(async (tx) => {
            const uDoc = await tx.get(userRef);
            const d = uDoc.data() || {};
            const curAvail = Number(d.balanceAvailable || 0);
            const curBonus = Number(d.balanceBonus || 0);
            if (curAvail + curBonus < price) throw new Error('الرصيد غير كافٍ');

            const bonusUsed = Math.round(Math.min(curBonus, price) * 100) / 100;
            const cashPaid = Math.round((price - bonusUsed) * 100) / 100;
            const afterAvail = Math.round((curAvail - cashPaid) * 100) / 100;
            const afterBonus = Math.round((curBonus - bonusUsed) * 100) / 100;

            const baseExp = Math.max(Date.now(), Number(d.subscriptionExpiresAt || 0));
            const newExp = baseExp + 30 * 24 * 60 * 60 * 1000;

            tx.update(userRef, {
              balanceAvailable: afterAvail,
              balanceBonus: afterBonus,
              subscriptionPlan: planType,
              subscriptionExpiresAt: newExp
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid,
              type: 'subscription',
              amount: -price,
              cashPaid,
              bonusUsed,
              balanceBefore: curAvail,
              balanceAfter: afterAvail,
              note: `${label}${bonusUsed > 0 ? ` (كاش ${app.fmtMoney(cashPaid)} + هدايا ${app.fmtMoney(bonusUsed)})` : ''}`,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(app.db.collection('platformFees').doc(), {
              type: 'subscription',
              planType,
              userId: app.user.uid,
              userName: app.profile?.companyName || app.profile?.name || '',
              amount: cashPaid,
              cashPaid,
              bonusUsed,
              grossPrice: price,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
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
          let rewardText = '';
          await app.db.runTransaction(async (tx) => {
            const [cDoc, uDoc] = await Promise.all([tx.get(codeRef), tx.get(userRef)]);
            if (!cDoc.exists) throw new Error('كود الهدية غير صحيح');
            const c = cDoc.data();
            if (!c.active) throw new Error('هذا الكود متوقف حالياً');
            if (c.expiresAt && Number(c.expiresAt) < Date.now()) throw new Error('انتهت صلاحية هذا الكود');
            const usedBy = Array.isArray(c.usedBy) ? c.usedBy : [];
            if (usedBy.includes(app.user.uid)) throw new Error('لقد استخدمت هذا الكود من قبل');
            if (Number(c.maxUses || 1) <= usedBy.length) throw new Error('تم استنفاد العدد الأقصى لاستخدام الكود');

            const bonus = Number(c.amount || 0);
            const curBonus = Number((uDoc.data() || {}).balanceBonus || 0);
            const afterBonus = Math.round((curBonus + bonus) * 100) / 100;

            tx.update(codeRef, { usedBy: firebase.firestore.FieldValue.arrayUnion(app.user.uid) });
            tx.update(userRef, { balanceBonus: afterBonus });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid,
              type: 'promo_bonus',
              isBonus: true,
              amount: bonus,
              balanceBefore: curBonus,
              balanceAfter: afterBonus,
              note: `كود هدية (${code}) — يُستخدم للباقات وتمييز الإعلانات`,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            rewardText = `${app.fmtMoney(bonus)} ج.م`;
          });
          document.getElementById('promo-inp').value = '';
          app.toast(`مبروك! تمت إضافة ${rewardText} إلى رصيد الهدايا بنجاح 🎉`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== EXPORTS: A4 B&W STATEMENT + EXCEL CSV ====================
    getFilteredTransactions() {
      const app = window.DamanApp;
      const q = app.normalizeAr(this.txSearch);
      return this.transactions.filter((t) => {
        if (this.txFilter === 'in' && Number(t.amount || 0) <= 0) return false;
        if (this.txFilter === 'out' && Number(t.amount || 0) >= 0) return false;
        if (this.txFilter === 'escrow' && !String(t.type || '').includes('escrow') && !['daily_payout', 'advance_paid', 'milestone_payout', 'final_settlement'].includes(t.type)) return false;
        if (this.txFilter === 'bonus' && !t.isBonus && !String(t.type || '').includes('bonus') && !String(t.type || '').includes('gift')) return false;
        if (q && !app.normalizeAr(`${t.note} ${t.type} ${t.date}`).includes(q)) return false;
        return true;
      });
    },

    exportTransactionsCsv() {
      const app = window.DamanApp;
      const rows = this.getFilteredTransactions();
      if (!rows.length) return app.toast('لا توجد حركات للتصدير', 'info');
      const header = ['التاريخ', 'نوع الحركة', 'البيان', 'المبلغ (ج.م)', 'الرصيد قبل', 'الرصيد بعد'];
      const escCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const lines = [header.map(escCsv).join(',')].concat(
        rows.map((t) => [t.date || '', t.type || '', t.note || '', t.amount || 0, t.balanceBefore ?? '', t.balanceAfter ?? ''].map(escCsv).join(','))
      );
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `damansite-wallet-${app.todayLocal()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.toast('تم تصدير كشف الحساب بصيغة Excel/CSV ✅', 'success');
    },

    printWalletStatementA4() {
      const app = window.DamanApp;
      const p = app.profile || {};
      const list = this.getFilteredTransactions();
      const rows = list.map((t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${app.esc(t.date || '')}</td>
          <td>${app.esc(t.note || t.type || '')}</td>
          <td><b>${Number(t.amount || 0) >= 0 ? '+' : ''}${app.fmtMoney(t.amount)} ج.م</b></td>
          <td>${t.balanceAfter != null ? app.fmtMoney(t.balanceAfter) + ' ج.م' : '—'}</td>
        </tr>`).join('');

      const html = `
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:16px;">كشف حساب المحفظة المالية — ${app.esc(app.t('appName'))}</h2>
              <div style="font-size:11px;">كشف حركات رسمي معتمد</div>
            </div>
            <div style="text-align:left; font-size:11px;">
              <div><b>التاريخ:</b> ${app.todayLocal()}</div>
              <div><b>صاحب الحساب:</b> ${app.esc(p.legalName || p.name || '')}</div>
            </div>
          </div>

          <table style="margin-bottom:12px;">
            <tr>
              <th>الاسم القانوني</th><td>${app.esc(p.legalName || p.name || '—')}</td>
              <th>الرقم القومي</th><td>${app.esc(p.nationalId || '—')}</td>
            </tr>
            <tr>
              <th>الرصيد الكاش المتاح</th><td><b>${app.fmtMoney(p.balanceAvailable || 0)} ج.م</b></td>
              <th>المحجوز بالضمان</th><td><b>${app.fmtMoney(p.balanceEscrow || 0)} ج.م</b></td>
            </tr>
            <tr>
              <th>قيد السحب / المجمّد</th><td>${app.fmtMoney(p.balancePendingWithdraw || 0)} / ${app.fmtMoney(p.balanceFrozen || 0)} ج.م</td>
              <th>رصيد الهدايا (غير نقدي)</th><td>${app.fmtMoney(p.balanceBonus || 0)} ج.م</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr><th style="width:6%;">#</th><th style="width:16%;">التاريخ</th><th>البيان والحركة المالية</th><th style="width:17%;">المبلغ</th><th style="width:17%;">الرصيد بعد</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5" style="text-align:center;">لا توجد حركات مسجّلة حتى الآن</td></tr>'}
            </tbody>
          </table>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:24px; text-align:center; font-size:11px;">
            <div>توقيع صاحب الحساب<br/><br/>.....................................</div>
            <div>اعتماد الحسابات<br/><br/>.....................................</div>
          </div>
        </div>`;

      window.DamanPrint(html);
    },

    // ==================== RENDER WALLET TAB ====================
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
      const customComm = p.customCommissionRate != null && p.customCommissionRate !== '' ? Number(p.customCommissionRate) : null;
      const filteredTxs = this.getFilteredTransactions();

      container.innerHTML = `
        <div class="space-y-3.5">
          ${frozen > 0 ? `
            <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/60 text-xs text-rose-200 font-bold">
              🔒 يوجد مبلغ <b>${app.fmtMoney(frozen)} ج.م</b> مجمّد مؤقتاً من الإدارة${p.frozenReason ? ` — السبب: ${app.esc(p.frozenReason)}` : ''}.
            </div>` : ''}

          <div class="glass-card rounded-3xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/30 space-y-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="text-xs font-black text-emerald-400"><i class="fa-solid fa-wallet me-1"></i> محفظة ${app.esc(app.t('appName'))} المؤمّنة</div>
              <div class="flex items-center gap-1.5">
                <button onclick="DamanWallet.exportTransactionsCsv()" class="px-2.5 py-1 rounded-xl bg-slate-800 text-emerald-300 text-[10px] font-black">Excel</button>
                <button onclick="DamanWallet.printWalletStatementA4()" class="px-2.5 py-1 rounded-xl bg-white text-slate-950 text-[10px] font-black">
                  <i class="fa-solid fa-print me-1"></i> كشف A4
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-center">
              <div class="p-2.5 rounded-2xl bg-slate-950/90 border border-emerald-500/40">
                <div class="text-[9.5px] text-slate-400 font-bold">المتاح كاش (سحب وتعاقد)</div>
                <div class="text-base font-black text-emerald-400 mt-0.5">${app.fmtMoney(avail)} <span class="text-[10px]">ج.م</span></div>
              </div>
              <div class="p-2.5 rounded-2xl bg-slate-950/90 border border-amber-500/40">
                <div class="text-[9.5px] text-slate-400 font-bold">محجوز بالضمان</div>
                <div class="text-base font-black text-amber-400 mt-0.5">${app.fmtMoney(esc)} <span class="text-[10px]">ج.م</span></div>
              </div>
              <div class="p-2 rounded-2xl bg-slate-950/80 border border-sky-500/30">
                <div class="text-[9px] text-slate-400 font-bold">قيد السحب (معلّق)</div>
                <div class="text-xs font-black text-sky-400 mt-0.5">${app.fmtMoney(holdW)} ج.م</div>
              </div>
              <div class="p-2 rounded-2xl bg-slate-950/80 border border-purple-500/30">
                <div class="text-[9px] text-slate-400 font-bold">رصيد هدايا (باقات وتمييز)</div>
                <div class="text-xs font-black text-purple-300 mt-0.5">${app.fmtMoney(bonus)} ج.م</div>
              </div>
            </div>

            ${customComm !== null ? `
              <div class="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center text-[10.5px] text-amber-300 font-black">
                ★ عمولة الضمان الخاصة بحسابك المميّز: ${(customComm * 100).toFixed(2)}%
              </div>` : ''}

            <div class="grid grid-cols-2 gap-2">
              <button onclick="DamanWallet.openDepositModal()" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-plus-circle me-1"></i> شحن / إيداع (3 وسائل)
              </button>
              <button onclick="DamanWallet.openWithdrawModal()" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-arrow-up-from-bracket me-1"></i> سحب كاش (وسيلتين)
              </button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-extrabold">
            <button onclick="DamanWallet.setSubTab('overview')" class="py-2 rounded-lg ${this.subTab === 'overview' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">الحركات (${this.transactions.length})</button>
            <button onclick="DamanWallet.setSubTab('requests')" class="py-2 rounded-lg ${this.subTab === 'requests' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">الطلبات (${this.requests.length})</button>
            <button onclick="DamanWallet.setSubTab('packages')" class="py-2 rounded-lg ${this.subTab === 'packages' ? 'bg-purple-500 text-white' : 'text-slate-400'}">الباقات والهدايا</button>
          </div>

          ${this.subTab === 'overview' ? `
            <div class="space-y-2.5">
              <input type="text" value="${app.esc(this.txSearch)}" oninput="DamanWallet.txSearch=this.value; DamanWallet.rerender()" placeholder="بحث في الحركات بالتاريخ أو البيان..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white" />
              <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-extrabold">
                ${[['all', 'الكل'], ['in', 'وارد (+)'], ['out', 'صادر (-)'], ['escrow', 'ضمان وعقود'], ['bonus', 'هدايا']].map(([k, lbl]) => `
                  <button onclick="DamanWallet.setTxFilter('${k}')" class="shrink-0 px-2.5 py-1.5 rounded-xl ${this.txFilter === k ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
              </div>

              ${!filteredTxs.length
                ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد حركات مالية مطابقة.</div>`
                : filteredTxs.map((t) => `
                  <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                    <div class="min-w-0">
                      <div class="font-bold text-white truncate">${app.esc(t.note || t.type)}</div>
                      <div class="text-[10px] text-slate-400">
                        ${app.esc(t.date || '')}
                        ${t.balanceAfter != null ? ` • الرصيد بعد: <b class="text-slate-200">${app.fmtMoney(t.balanceAfter)} ج.م</b>` : ''}
                      </div>
                    </div>
                    <div class="font-black shrink-0 ${t.isBonus ? 'text-purple-300' : Number(t.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                      ${Number(t.amount || 0) >= 0 ? '+' : ''}${app.fmtMoney(t.amount)} ج.م
                    </div>
                  </div>`).join('')}
            </div>` : ''}

          ${this.subTab === 'requests' ? `
            <div class="space-y-2">
              ${!this.requests.length
                ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد طلبات إيداع أو سحب بعد.</div>`
                : this.requests.map((r) => `
                  <div class="glass-card rounded-2xl p-3 space-y-1.5 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="font-black ${r.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}">
                        ${r.type === 'deposit' ? '⬇️ إيداع' : '⬆️ سحب'} — ${app.fmtMoney(r.actualAmount || r.amount)} ج.م
                      </span>
                      ${this.statusBadge(r.status)}
                    </div>
                    <div class="text-[10.5px] text-slate-300">الوسيلة: ${this.channelShort(r.channel)} • ${app.esc(r.date || '')}</div>
                    ${r.txRef ? `<div class="text-[10px] text-amber-300">المرجع: <b>${app.esc(r.txRef)}</b></div>` : ''}
                    ${r.destAccount ? `<div class="text-[10px] text-sky-300">الحساب المستلم: ${app.esc(r.destAccount)} (الصافي: ${app.fmtMoney(r.netPayout || r.amount)} ج.م)</div>` : ''}
                    ${r.adminNote ? `<div class="p-2 rounded-lg bg-slate-950 text-[10px] text-rose-300">ملاحظة الإدارة: ${app.esc(r.adminNote)}</div>` : ''}
                    <div class="flex items-center flex-wrap gap-2 pt-0.5">
                      ${r.receiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.receiptMedia}','إيصال الإيداع')" class="text-[10px] text-emerald-300 underline font-bold"><i class="fa-solid fa-image me-1"></i>إيصال الإيداع</button>` : ''}
                      ${r.payoutReceiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.payoutReceiptMedia}','إيصال تحويل السحب من الإدارة')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-[10px]"><i class="fa-solid fa-file-invoice me-1"></i>إيصال التحويل من الإدارة</button>` : ''}
                      ${r.type === 'withdraw' && r.status === 'pending' ? `<button onclick="DamanWallet.cancelPendingWithdraw('${r.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px] ms-auto">إلغاء السحب وردّ المبلغ</button>` : ''}
                    </div>
                  </div>`).join('')}
            </div>` : ''}

          ${this.subTab === 'packages' ? `
            <div class="space-y-3 text-xs">
              ${subActive ? `
                <div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 font-bold text-center">
                  ★ باقتك الحالية مفعّلة حتى تاريخ: <b>${subExpDate}</b>
                </div>` : ''}

              <div class="grid grid-cols-1 gap-2.5">
                <div class="glass-card rounded-2xl p-4 border-amber-500/40 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="font-black text-amber-400">★ باقة الأفراد والمقاولين VIP</div>
                    <div class="text-sm font-black text-white">${app.fmtMoney(pkgs.individualMonthly || 150)} ج.م / شهر</div>
                  </div>
                  <p class="text-[11px] text-slate-300">شارة VIP على صفحتك وإعلاناتك، أولوية الظهور في السوق، ويمكن سدادها من رصيد الهدايا أو الكاش.</p>
                  <button onclick="DamanWallet.buyPackage('individual')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">اشتراك / تجديد الآن</button>
                </div>

                <div class="glass-card rounded-2xl p-4 border-purple-500/40 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="font-black text-purple-300">👑 باقة الشركات والموردين B2B</div>
                    <div class="text-sm font-black text-white">${app.fmtMoney(pkgs.companyMonthly || 450)} ج.م / شهر</div>
                  </div>
                  <p class="text-[11px] text-slate-300">منظومة إدارة مواقع المقاولات الكاملة (GPS، إضافي، مستخلصات، خصومات، جرد، صب خرسانة، عهدة، ورواتب A4).</p>
                  <button onclick="DamanWallet.buyPackage('company')" class="w-full py-2.5 rounded-xl bg-purple-500 text-white font-black">اشتراك / تجديد الآن</button>
                </div>
              </div>

              <form onsubmit="DamanWallet.redeemPromoCode(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
                <div class="font-black text-sky-300"><i class="fa-solid fa-gift me-1"></i> هل لديك كود هدية / برومو كود؟</div>
                <div class="flex gap-2">
                  <input id="promo-inp" type="text" required placeholder="أدخل الكود هنا..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white uppercase font-bold" />
                  <button type="submit" class="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-black">تفعيل</button>
                </div>
              </form>
            </div>` : ''}
        </div>`;
    }
  };

  window.DamanWallet = WalletMod;
  if (window.DamanApp) window.DamanApp.registerModule('wallet', WalletMod);
})();
