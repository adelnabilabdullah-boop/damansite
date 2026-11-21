(function () {
  const WalletMod = {
    subTab: 'overview', // 'overview' | 'requests' | 'packages'
    requests: [],
    transactions: [],
    attachedUid: null,
    unsubReqs: null,
    unsubTxs: null,

    // 10-Minute Deposit Session State
    depositTimer: null,
    depositSecondsLeft: 0,
    depositExpired: false,
    freshPaymentAccounts: null,
    tempReceiptBase64: '',

    // KYC Temp Images
    kycPhotos: {
      idFront: '',
      idBack: '',
      selfie: '',
      crDoc: '',
      taxDoc: ''
    },

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
        .limit(40)
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
        .limit(60)
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

    setSubTab(t) {
      this.subTab = t;
      this.rerender();
    },

    channelLabel(ch) {
      const map = {
        vodafone_cash: 'محفظة إلكترونية (فودافون / اتصالات / أورنج كاش)',
        instapay: 'إنستا باي (InstaPay)',
        bank: 'تحويل بنكي'
      };
      return map[ch] || ch || '—';
    },

    statusBadge(st) {
      if (st === 'approved') return '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black">معتمد ✅</span>';
      if (st === 'rejected') return '<span class="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-black">مرفوض ❌</span>';
      return '<span class="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-black">قيد المراجعة ⏳</span>';
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
            <b>مهم للعقود الرسمية:</b> اكتب الاسم الرباعي والرقم القومي والعنوان <b>كما في بطاقة الرقم القومي بالضبط</b>. هذه البيانات تُستخدم داخل العقود القانونية فقط ولا تظهر للعامة، بينما يمكنك استخدام أي اسم عرض/شهرة في صفحتك.
          </div>

          <form onsubmit="DamanWallet.submitKyc(event)" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">${isCompany ? 'الاسم الرباعي للمسؤول القانوني (من البطاقة)' : 'الاسم الرباعي كما في البطاقة بالضبط'}</label>
              <input id="kyc-legal-name" type="text" required value="${app.esc(p.legalName || '')}" placeholder="مثال: عادل نبيل عبد الله محمد" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">الرقم القومي (14 رقم)</label>
              <input id="kyc-nid" type="text" inputmode="numeric" maxlength="14" required value="${app.esc(p.nationalId || '')}" oninput="DamanWallet.previewNidBirthDate(this.value)" placeholder="29801012101234" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black tracking-wider" />
              <div id="kyc-nid-info" class="text-[10px] mt-1 font-bold text-slate-400">سيتم استخراج تاريخ الميلاد والتحقق من السن (+18) تلقائياً</div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">العنوان المثبت بضهر البطاقة</label>
              <input id="kyc-address" type="text" required value="${app.esc(p.legalAddress || '')}" placeholder="المحافظة — المركز/الحي — الشارع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            ${isCompany ? `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/40 space-y-2">
                <div class="text-[11px] font-black text-sky-300">بيانات الشركة / المورّد</div>
                <input id="kyc-comp-name" type="text" required value="${app.esc(p.companyName || p.name || '')}" placeholder="الاسم الرسمي للشركة / المؤسسة" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
                <div class="grid grid-cols-2 gap-2">
                  <input id="kyc-cr" type="text" required value="${app.esc(p.commercialReg || '')}" placeholder="رقم السجل التجاري" class="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
                  <input id="kyc-tax" type="text" required value="${app.esc(p.taxCard || '')}" placeholder="رقم البطاقة الضريبية" class="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
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
          // 1. Check Blacklist
          const bl = await app.checkBlacklist({
            email: app.profile?.email,
            phone: app.profile?.phone,
            nationalId: parsed.nid,
            commercialReg
          });
          if (bl) {
            if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
            return app.toast(`تعذر التوثيق: ${bl}`, 'error');
          }

          // 2. Prevent Duplicate National ID across other accounts
          const dupNid = await app.db.collection('users').where('nationalId', '==', parsed.nid).limit(2).get();
          const conflict = dupNid.docs.find((d) => d.id !== app.user.uid);
          if (conflict) {
            if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
            return app.toast('هذا الرقم القومي موثّق ومسجّل بالفعل على حساب آخر!', 'error');
          }

          // 3. Upload heavy images to mediaVault (keeps Admin fast)
          const [idFrontMedia, idBackMedia, selfieMedia, crMedia, taxMedia] = await Promise.all([
            app.saveMedia(this.kycPhotos.idFront, { kind: 'kyc_id_front' }),
            app.saveMedia(this.kycPhotos.idBack, { kind: 'kyc_id_back' }),
            app.saveMedia(this.kycPhotos.selfie, { kind: 'kyc_selfie' }),
            isCompany ? app.saveMedia(this.kycPhotos.crDoc, { kind: 'kyc_cr' }) : Promise.resolve(''),
            isCompany ? app.saveMedia(this.kycPhotos.taxDoc, { kind: 'kyc_tax' }) : Promise.resolve('')
          ]);

          // 4. Write KYC Request (Admin will verify & lock final legal fields)
          await app.db.collection('kycRequests').doc(app.user.uid).set({
            userId: app.user.uid,
            displayName: app.profile?.companyName || app.profile?.name || '',
            accountType: app.profile?.accountType || 'individual',
            phone: app.profile?.phone || '',
            email: app.profile?.email || '',
            legalName,
            nationalId: parsed.nid,
            birthDate: parsed.birthDate,
            legalAddress,
            companyName,
            commercialReg,
            taxCard,
            idFrontMedia,
            idBackMedia,
            selfieMedia,
            crMedia,
            taxMedia,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // Mark user status pending (Note: users can only move themselves from none/rejected -> pending in Rules)
          await app.db.collection('users').doc(app.user.uid).update({
            kycStatus: 'pending',
            kycRejectionReason: ''
          });

          await app.sendNotification('ADMIN', 'طلب توثيق هوية جديد 🪪', `${legalName} (${parsed.nid}) — بانتظار مطابقة الصور والاعتماد.`);
          document.getElementById('daman-kyc-modal').classList.add('hidden');
          app.toast('تم إرسال مستندات التوثيق بنجاح! سيتم المراجعة والاعتماد سريعاً ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'إرسال مستندات التوثيق للإدارة'; }
          app.toast(err.message, 'error');
        }
      });
    },

    // ==================== 10-MINUTE EXPIRING DEPOSIT MODAL ====================
    clearDepositTimer() {
      if (this.depositTimer) {
        clearInterval(this.depositTimer);
        this.depositTimer = null;
      }
    },

    closeDepositModal() {
      this.clearDepositTimer();
      document.getElementById('daman-deposit-modal')?.classList.add('hidden');
    },

    openDepositWithAmount(neededAmount) {
      window.DamanApp.switchTab('wallet');
      setTimeout(() => this.openDepositModal(neededAmount), 120);
    },

    async openDepositModal(prefillAmount = '') {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) {
        app.toast('لا يمكن الإيداع قبل توثيق الحساب بالبطاقة والسيلفي', 'error');
        return this.openKycModal(true);
      }

      // Prevent duplicate pending deposits
      const hasPendingDep = this.requests.some((r) => r.type === 'deposit' && r.status === 'pending');
      if (hasPendingDep) {
        return app.toast('لديك طلب إيداع قيد المراجعة بالفعل — انتظر اعتماده قبل إرسال طلب جديد', 'warning');
      }

      // Fetch LIVE payment accounts straight from Firestore (never stale cache)
      let accounts = app.appConfig?.paymentAccounts || {};
      try {
        const cfgSnap = await app.db.collection('settings').doc('appConfig').get({ source: 'server' });
        if (cfgSnap.exists && cfgSnap.data().paymentAccounts) {
          accounts = cfgSnap.data().paymentAccounts;
        }
      } catch (e) {}
      this.freshPaymentAccounts = accounts;
      this.tempReceiptBase64 = '';
      this.depositExpired = false;
      this.depositSecondsLeft = 10 * 60; // 10 minutes exact

      let m = document.getElementById('daman-deposit-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-deposit-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      this.renderDepositModalContent(m, prefillAmount);
      this.startDepositCountdown(prefillAmount);
    },

    renderDepositModalContent(modal, prefillAmount = '') {
      const app = window.DamanApp;
      const acc = this.freshPaymentAccounts || app.appConfig?.paymentAccounts || {};
      const minDep = Number(app.appConfig?.minDeposit || 100);
      const mins = String(Math.floor(this.depositSecondsLeft / 60)).padStart(2, '0');
      const secs = String(this.depositSecondsLeft % 60).padStart(2, '0');

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-emerald-400"><i class="fa-solid fa-circle-arrow-down me-1"></i> شحن المحفظة (إيداع رسمي)</h3>
            <button onclick="DamanWallet.closeDepositModal()" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <!-- Mandatory 10-Minute Rotating Account Countdown Banner -->
          <div id="dep-timer-box" class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/60 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-black text-rose-300"><i class="fa-solid fa-stopwatch me-1"></i> صلاحية بيانات التحويل الحالية</span>
              <span id="dep-countdown-lbl" class="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white font-black text-sm tracking-widest">${mins}:${secs}</span>
            </div>
            <p class="text-[10.5px] text-rose-100 leading-relaxed">
              ⚠️ <b>تنبيه هام جداً:</b> تتغير حسابات الاستقبال دورياً عند اكتمال الحد الأقصى. يرجى التحويل وإرسال الإيصال خلال <b>10 دقائق فقط</b>، ولا تحوّل أبداً على رقم قديم محفوظ لديك.
            </p>
          </div>

          <div id="dep-expired-gate" class="hidden p-5 rounded-2xl bg-slate-950 border border-rose-500/60 text-center space-y-3">
            <i class="fa-solid fa-clock-rotate-left text-3xl text-rose-400"></i>
            <div class="text-sm font-black text-rose-300">انتهت مهلة الـ 10 دقائق لهذه البيانات!</div>
            <p class="text-[11px] text-slate-300">حرصاً على أموالك وتفادياً للتحويل على حساب متغير، تم إخفاء الأرقام السابقة. اضغط أدناه لجلب الحسابات النشطة حالياً.</p>
            <button onclick="DamanWallet.openDepositModal('${app.esc(prefillAmount)}')" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">
              <i class="fa-solid fa-rotate me-1"></i> تحديث وجلب الحسابات النشطة (10 دقائق جديدة)
            </button>
          </div>

          <div id="dep-active-body" class="space-y-3">
            <!-- Active Payment Channels -->
            <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
              <div class="font-black text-amber-400">حسابات الاستقبال النشطة الآن:</div>
              <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900">
                <div><div class="text-[9.5px] text-slate-400">فودافون / محافظ كاش</div><b class="text-white select-all">${app.esc(acc.vodafoneCash || 'غير محدد')}</b></div>
                <button type="button" onclick="navigator.clipboard.writeText('${app.esc(acc.vodafoneCash || '')}'); DamanApp.toast('تم نسخ الرقم','success')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">نسخ</button>
              </div>
              <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900">
                <div><div class="text-[9.5px] text-slate-400">إنستا باي (InstaPay)</div><b class="text-emerald-300 select-all">${app.esc(acc.instaPay || 'غير محدد')}</b></div>
                <button type="button" onclick="navigator.clipboard.writeText('${app.esc(acc.instaPay || '')}'); DamanApp.toast('تم نسخ العنوان','success')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 font-bold text-[10px]">نسخ</button>
              </div>
              <div class="p-2 rounded-xl bg-slate-900">
                <div class="text-[9.5px] text-slate-400">الحساب البنكي</div>
                <div class="text-white font-bold whitespace-pre-line select-all">${app.esc(acc.bankInfo || 'غير محدد')}</div>
              </div>
            </div>

            <form onsubmit="DamanWallet.submitDeposit(event)" class="space-y-2.5">
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">قناة التحويل</label>
                <select id="dep-channel" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="vodafone_cash">فودافون كاش / محفظة إلكترونية</option>
                  <option value="instapay">إنستا باي (InstaPay)</option>
                  <option value="bank">تحويل بنكي</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[11px] font-bold text-slate-300 mb-1">المبلغ المحوّل (الحد الأدنى ${app.fmtMoney(minDep)} ج.م)</label>
                  <input id="dep-amount" type="number" min="${minDep}" step="any" required value="${app.esc(prefillAmount)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-300 mb-1">رقم المحوّل منه / الحساب</label>
                  <input id="dep-sender" type="text" required placeholder="01xxxxxxxxx أو اسم الحساب" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-amber-300 mb-1">الرقم المرجعي للعملية (Transaction Reference) *</label>
                <input id="dep-txref" type="text" required placeholder="رقم العملية من رسالة التأكيد أو إيصال إنستا باي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-bold" />
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
        return app.toast('انتهت مهلة الـ 10 دقائق — حدّث بيانات الحسابات أولاً', 'error');
      }
      await app.withLock('submitDeposit', async () => {
        const channel = document.getElementById('dep-channel').value;
        const amount = Math.round((parseFloat(document.getElementById('dep-amount').value) || 0) * 100) / 100;
        const senderAccount = document.getElementById('dep-sender').value.trim();
        const txRef = document.getElementById('dep-txref').value.trim().toUpperCase();
        const minDep = Number(app.appConfig?.minDeposit || 100);

        if (amount < minDep) return app.toast(`الحد الأدنى للإيداع هو ${app.fmtMoney(minDep)} ج.م`, 'warning');
        if (!txRef || txRef.length < 4) return app.toast('أدخل الرقم المرجعي للعملية بشكل صحيح', 'warning');
        if (!this.tempReceiptBase64) return app.toast('يرجى إرفاق صورة إيصال التحويل', 'warning');

        const btn = document.getElementById('dep-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التحقق والإرسال...'; }

        try {
          // Check Duplicate Transaction Reference across previous requests
          const dupSnap = await app.db.collection('walletRequests').where('txRef', '==', txRef).limit(1).get();
          const isDupRef = !dupSnap.empty;
          if (isDupRef && dupSnap.docs[0].data().status === 'approved') {
            if (btn) { btn.disabled = false; btn.textContent = 'تأكيد وإرسال طلب الشحن'; }
            return app.toast('⚠️ هذا الرقم المرجعي تم استخدامه واعتماده مسبقاً! لا يمكن تكرار نفس الإيصال.', 'error');
          }

          const receiptMedia = await app.saveMedia(this.tempReceiptBase64, { kind: 'deposit_receipt' });
          const acc = this.freshPaymentAccounts || {};
          const targetAccSnapshot = channel === 'vodafone_cash' ? (acc.vodafoneCash || '') : channel === 'instapay' ? (acc.instaPay || '') : (acc.bankInfo || '');

          await app.db.collection('walletRequests').add({
            type: 'deposit',
            userId: app.user.uid,
            userName: app.profile?.companyName || app.profile?.name || '',
            userLegalName: app.profile?.legalName || '',
            userPhone: app.profile?.phone || '',
            channel,
            amount,
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
            `${app.profile?.name} — ${app.fmtMoney(amount)} ج.م (${this.channelLabel(channel)}) | مرجع: ${txRef}`
          );

          this.closeDepositModal();
          app.toast('تم إرسال طلب الشحن بنجاح! سيتم المراجعة وإضافة الرصيد قريباً ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'تأكيد وإرسال طلب الشحن'; }
          app.toast(err.message, 'error');
        }
      });
    },

    // ==================== WITHDRAW MODAL (WITH INSTANT HOLD LOCK + FEES) ====================
    openWithdrawModal() {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) {
        app.toast('لا يمكن السحب قبل توثيق الحساب بالبطاقة والسيلفي', 'error');
        return this.openKycModal(true);
      }
      if (this.requests.some((r) => r.type === 'withdraw' && r.status === 'pending')) {
        return app.toast('لديك طلب سحب قيد المراجعة بالفعل — انتظر تنفيذه أولاً', 'warning');
      }

      const avail = Number(app.profile.balanceAvailable || 0);
      const minW = Number(app.appConfig?.minWithdraw || 100);
      if (avail < minW) {
        return app.toast(`رصيدك المتاح (${app.fmtMoney(avail)} ج.م) أقل من الحد الأدنى للسحب (${app.fmtMoney(minW)} ج.م)`, 'warning');
      }

      let m = document.getElementById('daman-withdraw-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-withdraw-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-money-bill-transfer me-1"></i> سحب رصيد من المحفظة</h3>
            <button onclick="document.getElementById('daman-withdraw-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex justify-between">
            <span class="text-slate-400">رصيدك المتاح للسحب:</span>
            <b class="text-emerald-400">${app.fmtMoney(avail)} ج.م</b>
          </div>

          <form onsubmit="DamanWallet.submitWithdraw(event)" oninput="DamanWallet.updateWithdrawPreview()" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">قناة الاستلام</label>
              <select id="wd-channel" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                <option value="vodafone_cash">فودافون كاش / محفظة إلكترونية</option>
                <option value="instapay">إنستا باي (InstaPay)</option>
                <option value="bank">حساب بنكي</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">المبلغ المطلوب سحبه (الحد الأدنى ${app.fmtMoney(minW)} ج.م)</label>
              <input id="wd-amount" type="number" min="${minW}" max="${avail}" step="any" required value="${minW}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">رقم المحفظة / إنستا باي / الحساب البنكي المستلم</label>
              <input id="wd-dest" type="text" required value="${app.esc(app.profile?.phone || '')}" placeholder="01xxxxxxxxx أو user@instapay" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <div id="wd-preview" class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 space-y-0.5"></div>

            <button id="wd-submit-btn" type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">
              تأكيد وحجز مبلغ السحب
            </button>
          </form>
        </div>`;

      this.updateWithdrawPreview();
    },

    calcWithdrawFee(amount) {
      const app = window.DamanApp;
      const pct = Number(app.appConfig?.withdrawFeePct || 0);
      const flat = Number(app.appConfig?.withdrawFeeFlat || 0);
      const fee = Math.round(((amount * pct) / 100 + flat) * 100) / 100;
      const net = Math.max(0, Math.round((amount - fee) * 100) / 100);
      return { fee, net };
    },

    updateWithdrawPreview() {
      const app = window.DamanApp;
      const amt = parseFloat(document.getElementById('wd-amount')?.value) || 0;
      const { fee, net } = this.calcWithdrawFee(amt);
      const box = document.getElementById('wd-preview');
      if (!box) return;
      box.innerHTML = `
        <div>المبلغ المطلوب: <b>${app.fmtMoney(amt)} ج.م</b></div>
        <div>رسوم التحويل: <b>${app.fmtMoney(fee)} ج.م</b></div>
        <div class="text-emerald-300 font-black">الصافي الذي سيصلك: ${app.fmtMoney(net)} ج.م</div>
        <div class="text-[10px] text-slate-300 pt-0.5">سيتم حجز المبلغ مؤقتاً من رصيدك المتاح لحين إتمام التحويل من الإدارة.</div>`;
    },

    async submitWithdraw(e) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.withLock('submitWithdraw', async () => {
        const channel = document.getElementById('wd-channel').value;
        const amount = Math.round((parseFloat(document.getElementById('wd-amount').value) || 0) * 100) / 100;
        const destAccount = document.getElementById('wd-dest').value.trim();
        const minW = Number(app.appConfig?.minWithdraw || 100);

        if (amount < minW) return app.toast(`الحد الأدنى للسحب ${app.fmtMoney(minW)} ج.م`, 'warning');
        if (!destAccount) return app.toast('أدخل بيانات الحساب المستلم', 'warning');

        const { fee, net } = this.calcWithdrawFee(amount);
        if (net <= 0) return app.toast('صافي السحب بعد الرسوم يجب أن يكون أكبر من صفر', 'error');

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

            tx.update(userRef, {
              balanceAvailable: Math.round((curAvail - amount) * 100) / 100,
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
              status: 'pending',
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(txRefDoc, {
              userId: app.user.uid,
              type: 'withdraw_hold',
              amount: -amount,
              note: `حجز طلب سحب (${this.channelLabel(channel)} — ${destAccount})`,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });

          await app.sendNotification('ADMIN', 'طلب سحب رصيد جديد 💸', `${app.profile?.name} — صافي التحويل: ${app.fmtMoney(net)} ج.م على ${destAccount}`);
          document.getElementById('daman-withdraw-modal').classList.add('hidden');
          app.toast('تم حجز المبلغ وإرسال طلب السحب للإدارة بنجاح ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'تأكيد وحجز مبلغ السحب'; }
          app.toast(err.message, 'error');
        }
      });
    },

    // ==================== VIP PACKAGES (AUTO-LINKED TO ADMIN NET PROFIT TREASURY) ====================
    async buyPackage(planType) {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) return this.openKycModal(true);

      const pkgs = app.appConfig?.packages || {};
      const price = planType === 'company' ? Number(pkgs.companyMonthly || 450) : Number(pkgs.individualMonthly || 150);
      const label = planType === 'company' ? 'باقة الشركات والموردين VIP (30 يوم)' : 'باقة الأفراد والمقاولين VIP (30 يوم)';

      if (Number(app.profile.balanceAvailable || 0) < price) {
        if (window.confirm(`رصيدك المتاح غير كافٍ (السعر ${app.fmtMoney(price)} ج.م).\nهل تريد شحن المحفظة الآن؟`)) {
          this.openDepositModal(price);
        }
        return;
      }
      if (!window.confirm(`تأكيد الاشتراك في ${label} بمبلغ ${app.fmtMoney(price)} ج.م؟`)) return;

      await app.withLock('buyPkg', async () => {
        const userRef = app.db.collection('users').doc(app.user.uid);
        try {
          await app.db.runTransaction(async (tx) => {
            const uDoc = await tx.get(userRef);
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            if (curAvail < price) throw new Error('الرصيد المتاح غير كافٍ');

            const baseExp = Math.max(Date.now(), Number((uDoc.data() || {}).subscriptionExpiresAt || 0));
            const newExp = baseExp + 30 * 24 * 60 * 60 * 1000;

            tx.update(userRef, {
              balanceAvailable: Math.round((curAvail - price) * 100) / 100,
              subscriptionPlan: planType,
              subscriptionExpiresAt: newExp
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid,
              type: 'subscription',
              amount: -price,
              note: label,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            // Automatically credit Admin Profit Treasury
            tx.set(app.db.collection('platformFees').doc(), {
              type: 'subscription',
              planType,
              userId: app.user.uid,
              userName: app.profile?.companyName || app.profile?.name || '',
              amount: price,
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
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            tx.update(codeRef, { usedBy: firebase.firestore.FieldValue.arrayUnion(app.user.uid) });
            tx.update(userRef, { balanceAvailable: Math.round((curAvail + bonus) * 100) / 100 });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid,
              type: 'promo_bonus',
              amount: bonus,
              note: `كود هدية (${code})`,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            rewardText = `${app.fmtMoney(bonus)} ج.م`;
          });
          document.getElementById('promo-inp').value = '';
          app.toast(`مبروك! تمت إضافة ${rewardText} لمحفظتك بنجاح 🎉`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== INTERNAL A4 BLACK & WHITE STATEMENT PRINT (APK SAFE) ====================
    printWalletStatementA4() {
      const app = window.DamanApp;
      const p = app.profile || {};
      const rows = this.transactions.map((t, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${app.esc(t.date || '')}</td>
          <td>${app.esc(t.note || t.type || '')}</td>
          <td><b>${Number(t.amount || 0) >= 0 ? '+' : ''}${app.fmtMoney(t.amount)} ج.م</b></td>
        </tr>`).join('');

      const html = `
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:16px;">كشف حساب المحفظة — ضمان سايت</h2>
              <div style="font-size:11px;">DamanSite Financial Wallet Statement</div>
            </div>
            <div style="text-align:left; font-size:11px;">
              <div><b>التاريخ:</b> ${app.todayLocal()}</div>
              <div><b>الحساب:</b> ${app.esc(p.legalName || p.name || '')}</div>
            </div>
          </div>

          <table style="margin-bottom:12px;">
            <tr>
              <th>الاسم القانوني</th><td>${app.esc(p.legalName || p.name || '—')}</td>
              <th>الرقم القومي</th><td>${app.esc(p.nationalId || '—')}</td>
            </tr>
            <tr>
              <th>الرصيد المتاح</th><td><b>${app.fmtMoney(p.balanceAvailable || 0)} ج.م</b></td>
              <th>المحجوز بالضمان</th><td><b>${app.fmtMoney(p.balanceEscrow || 0)} ج.م</b></td>
            </tr>
            <tr>
              <th>قيد السحب</th><td>${app.fmtMoney(p.balancePendingWithdraw || 0)} ج.م</td>
              <th>رقم الموبايل</th><td>${app.esc(p.phone || '—')}</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr><th style="width:7%;">#</th><th style="width:18%;">التاريخ</th><th>البيان والحركة المالية</th><th style="width:20%;">المبلغ</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4" style="text-align:center;">لا توجد حركات مسجّلة حتى الآن</td></tr>'}
            </tbody>
          </table>
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
      const pkgs = app.appConfig?.packages || {};
      const subActive = app.isSubscriptionActive();
      const subExpDate = p.subscriptionExpiresAt ? new Date(Number(p.subscriptionExpiresAt)).toLocaleDateString('ar-EG') : '';

      container.innerHTML = `
        <div class="space-y-3.5">
          <!-- Main Wallet Card -->
          <div class="glass-card rounded-3xl p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/30 space-y-3">
            <div class="flex items-center justify-between">
              <div class="text-xs font-black text-emerald-400"><i class="fa-solid fa-wallet me-1"></i> محفظة ضمان سايت المؤمّنة</div>
              <button onclick="DamanWallet.printWalletStatementA4()" class="px-2.5 py-1 rounded-xl bg-white text-slate-950 text-[10px] font-black">
                <i class="fa-solid fa-print me-1"></i> كشف حساب A4
              </button>
            </div>

            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="p-2.5 rounded-2xl bg-slate-950/90 border border-emerald-500/30">
                <div class="text-[9.5px] text-slate-400 font-bold">المتاح</div>
                <div class="text-sm font-black text-emerald-400 mt-0.5">${app.fmtMoney(avail)}</div>
              </div>
              <div class="p-2.5 rounded-2xl bg-slate-950/90 border border-amber-500/30">
                <div class="text-[9.5px] text-slate-400 font-bold">بالضمان</div>
                <div class="text-sm font-black text-amber-400 mt-0.5">${app.fmtMoney(esc)}</div>
              </div>
              <div class="p-2.5 rounded-2xl bg-slate-950/90 border border-sky-500/30">
                <div class="text-[9.5px] text-slate-400 font-bold">قيد السحب</div>
                <div class="text-sm font-black text-sky-400 mt-0.5">${app.fmtMoney(holdW)}</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button onclick="DamanWallet.openDepositModal()" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-plus-circle me-1"></i> شحن / إيداع
              </button>
              <button onclick="DamanWallet.openWithdrawModal()" class="py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-arrow-up-from-bracket me-1"></i> سحب رصيد
              </button>
            </div>
          </div>

          <!-- Sub-Tabs -->
          <div class="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-extrabold">
            <button onclick="DamanWallet.setSubTab('overview')" class="py-2 rounded-lg ${this.subTab === 'overview' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">الحركات (${this.transactions.length})</button>
            <button onclick="DamanWallet.setSubTab('requests')" class="py-2 rounded-lg ${this.subTab === 'requests' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">طلبات الشحن/السحب (${this.requests.length})</button>
            <button onclick="DamanWallet.setSubTab('packages')" class="py-2 rounded-lg ${this.subTab === 'packages' ? 'bg-purple-500 text-white' : 'text-slate-400'}">الباقات والهدايا</button>
          </div>

          ${this.subTab === 'overview' ? `
            <div class="space-y-2">
              ${!this.transactions.length
                ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد حركات مالية بعد.</div>`
                : this.transactions.map((t) => `
                  <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
                    <div class="min-w-0">
                      <div class="font-bold text-white truncate">${app.esc(t.note || t.type)}</div>
                      <div class="text-[10px] text-slate-400">${app.esc(t.date || '')}</div>
                    </div>
                    <div class="font-black shrink-0 ${Number(t.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
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
                        ${r.type === 'deposit' ? '⬇️ إيداع' : '⬆️ سحب'} — ${app.fmtMoney(r.amount)} ج.م
                      </span>
                      ${this.statusBadge(r.status)}
                    </div>
                    <div class="text-[10.5px] text-slate-300">القناة: ${this.channelLabel(r.channel)} • ${app.esc(r.date || '')}</div>
                    ${r.txRef ? `<div class="text-[10px] text-amber-300">الرقم المرجعي: <b>${app.esc(r.txRef)}</b></div>` : ''}
                    ${r.destAccount ? `<div class="text-[10px] text-sky-300">الحساب المستلم: ${app.esc(r.destAccount)} (الصافي: ${app.fmtMoney(r.netPayout || r.amount)} ج.م)</div>` : ''}
                    ${r.adminNote ? `<div class="p-2 rounded-lg bg-slate-950 text-[10px] text-rose-300">ملاحظة الإدارة: ${app.esc(r.adminNote)}</div>` : ''}
                    ${r.receiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.receiptMedia}','إيصال التحويل')" class="text-[10px] text-emerald-300 underline font-bold"><i class="fa-solid fa-image me-1"></i>عرض صورة الإيصال</button>` : ''}
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
                  <p class="text-[11px] text-slate-300">شارة VIP على صفحتك وإعلاناتك، أولوية الظهور في السوق، وثقة أكبر أمام أصحاب المشاريع.</p>
                  <button onclick="DamanWallet.buyPackage('individual')" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">اشتراك / تجديد من المحفظة</button>
                </div>

                <div class="glass-card rounded-2xl p-4 border-purple-500/40 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="font-black text-purple-300">👑 باقة الشركات والموردين B2B</div>
                    <div class="text-sm font-black text-white">${app.fmtMoney(pkgs.companyMonthly || 450)} ج.م / شهر</div>
                  </div>
                  <p class="text-[11px] text-slate-300">إدارة غير محدودة للموظفين والمواقع بالـ GPS، تقارير يومية ورواتب A4، وأولوية في توريدات B2B.</p>
                  <button onclick="DamanWallet.buyPackage('company')" class="w-full py-2.5 rounded-xl bg-purple-500 text-white font-black">اشتراك / تجديد من المحفظة</button>
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
