(function () {
  const WalletMod = {
    subTab: 'deposit',
    depositMethod: 'ewallet',
    withdrawMethod: 'ewallet',
    receiptBase64: '',
    kycPhotos: { front: '', back: '', selfie: '' },
    paymentConfig: null,
    requests: [],
    transactions: [],
    attachedUid: null,
    unsubConfig: null,
    unsubReq: null,
    unsubTx: null,

    ensureListeners(app) {
      if (!this.unsubConfig) {
        this.unsubConfig = app.db.collection('settings').doc('payment').onSnapshot(
          (snap) => {
            this.paymentConfig = snap.exists ? snap.data() : {};
            if (app.activeTab === 'wallet') this.rerender();
          },
          () => {}
        );
      }

      if (!app.user) {
        this.detachUserListeners();
        return;
      }

      if (this.attachedUid === app.user.uid) return;
      this.detachUserListeners();
      this.attachedUid = app.user.uid;

      this.unsubReq = app.db
        .collection('walletRequests')
        .where('userId', '==', app.user.uid)
        .onSnapshot(
          (snap) => {
            this.requests = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'wallet') this.rerender();
          },
          (err) => console.error('walletRequests error:', err)
        );

      this.unsubTx = app.db
        .collection('transactions')
        .where('userId', '==', app.user.uid)
        .onSnapshot(
          (snap) => {
            this.transactions = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'wallet') this.rerender();
          },
          (err) => console.error('transactions error:', err)
        );
    },

    detachUserListeners() {
      if (this.unsubReq) { this.unsubReq(); this.unsubReq = null; }
      if (this.unsubTx) { this.unsubTx(); this.unsubTx = null; }
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

    setSubTab(tab) {
      this.subTab = tab;
      this.rerender();
    },

    setMethod(kind, method) {
      if (kind === 'deposit') this.depositMethod = method;
      else this.withdrawMethod = method;
      this.rerender();
    },

    copyText(text, label) {
      const app = window.DamanApp;
      if (!text) return;
      const done = () => app.toast((app.lang === 'ar' ? 'تم نسخ ' : 'Copied ') + label, 'success');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done));
      } else {
        this.fallbackCopy(text, done);
      }
    },

    fallbackCopy(text, cb) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
      cb();
    },

    compressImage(file, maxW = 800, quality = 0.6) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Invalid image'));
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
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async handleReceiptPick(input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        this.receiptBase64 = await this.compressImage(file, 850, 0.62);
        const preview = document.getElementById('dep-receipt-preview');
        if (preview) {
          preview.innerHTML = `
            <img src="${this.receiptBase64}" class="w-full max-h-44 object-contain rounded-xl border border-emerald-500/40 bg-slate-950" />
            <div class="text-[10px] text-emerald-400 font-bold mt-1 text-center">${app.lang === 'ar' ? 'تم ضغط صورة الإيصال وتجهيزها للرفع' : 'Receipt compressed & ready'}</div>`;
        }
      } catch (err) {
        app.toast(app.lang === 'ar' ? 'تعذر قراءة الصورة، جرب صورة أخرى' : 'Could not process image', 'error');
      }
    },

    async handleKycPhoto(kind, input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        this.kycPhotos[kind] = await this.compressImage(file, 680, 0.52);
        const preview = document.getElementById('kyc-prev-' + kind);
        if (preview) {
          preview.innerHTML = `<img src="${this.kycPhotos[kind]}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />`;
        }
      } catch (err) {
        app.toast(app.lang === 'ar' ? 'تعذر تحميل الصورة' : 'Could not load photo', 'error');
      }
    },

    openKycModal() {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const p = app.profile;

      let modal = document.getElementById('daman-kyc-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-kyc-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');

      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-2xl p-4 max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-extrabold text-sky-400">
              <i class="fa-solid fa-id-card me-1"></i> ${isAr ? 'توثيق الحساب بالبطاقة والسيلفي' : 'Identity Verification (KYC)'}
            </h3>
            <button onclick="document.getElementById('daman-kyc-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed mb-3">
            <i class="fa-solid fa-shield-halved me-1"></i>
            ${isAr
              ? 'بيانات البطاقة وصورة السيلفي سرّية تماماً ولا يراها إلا إدارة المنصة لتأمين حسابك ومطابقة اسمك عند السحب.'
              : 'Your ID and selfie are strictly confidential and reviewed only by administration to secure withdrawals.'}
          </div>

          <form onsubmit="DamanWallet.submitKyc(event)" class="space-y-2.5">
            <input id="kyc-fullname" type="text" required value="${app.esc(p.kycFullName || p.name || '')}"
              placeholder="${isAr ? 'الاسم الرباعي كما هو مكتوب في البطاقة' : 'Full Legal Name as on ID'}"
              class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <input id="kyc-id-num" type="tel" inputmode="numeric" maxlength="14" required value="${app.esc(p.nationalId || '')}"
              placeholder="${isAr ? 'الرقم القومي (14 رقم بالظبط)' : 'National ID Number (14 Digits)'}"
              class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white tracking-wider" />

            <label class="block p-2.5 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 cursor-pointer">
              <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                <span><i class="fa-solid fa-address-card text-amber-400 me-1.5"></i> ${isAr ? '1. صورة وجه البطاقة (الأمام)' : '1. National ID Front'}</span>
                <span class="text-[10px] text-sky-400">${isAr ? 'اختر صورة' : 'Upload'}</span>
              </div>
              <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('front', this)" />
              <div id="kyc-prev-front">${this.kycPhotos.front ? `<img src="${this.kycPhotos.front}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
            </label>

            <label class="block p-2.5 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 cursor-pointer">
              <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                <span><i class="fa-regular fa-address-card text-amber-400 me-1.5"></i> ${isAr ? '2. صورة ظهر البطاقة (الخلف)' : '2. National ID Back'}</span>
                <span class="text-[10px] text-sky-400">${isAr ? 'اختر صورة' : 'Upload'}</span>
              </div>
              <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('back', this)" />
              <div id="kyc-prev-back">${this.kycPhotos.back ? `<img src="${this.kycPhotos.back}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
            </label>

            <label class="block p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950/70 cursor-pointer">
              <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                <span><i class="fa-solid fa-camera-retro text-sky-400 me-1.5"></i> ${isAr ? '3. صورة سيلفي واضحة لك مع البطاقة' : '3. Clear Selfie Photo'}</span>
                <span class="text-[10px] text-sky-400">${isAr ? 'التقط / اختر' : 'Capture / Upload'}</span>
              </div>
              <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('selfie', this)" />
              <div id="kyc-prev-selfie">${this.kycPhotos.selfie ? `<img src="${this.kycPhotos.selfie}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
            </label>

            <button id="kyc-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs mt-1">
              <i class="fa-solid fa-shield-check me-1"></i> ${isAr ? 'إرسال بيانات التوثيق للمراجعة' : 'Submit Verification'}
            </button>
          </form>
        </div>`;
    },

    async submitKyc(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const fullName = document.getElementById('kyc-fullname').value.trim();
      const nationalId = document.getElementById('kyc-id-num').value.replace(/\D/g, '');

      if (nationalId.length !== 14) {
        return app.toast(isAr ? 'يجب إدخال الرقم القومي مكوناً من 14 رقماً' : 'National ID must be 14 digits', 'error');
      }
      if (!this.kycPhotos.front || !this.kycPhotos.back || !this.kycPhotos.selfie) {
        return app.toast(isAr ? 'يرجى رفع صور البطاقة (الأمام والخلف) وصورة السيلفي' : 'Please upload ID front, back & selfie', 'error');
      }

      const btn = document.getElementById('kyc-submit-btn');
      if (btn) btn.disabled = true;

      try {
        await app.db.collection('kycRequests').doc(app.user.uid).set({
          userId: app.user.uid,
          userEmail: app.profile.email || app.user.email || '',
          accountType: app.profile.accountType || 'client',
          fullName,
          nationalId,
          idFrontBase64: this.kycPhotos.front,
          idBackBase64: this.kycPhotos.back,
          selfieBase64: this.kycPhotos.selfie,
          status: 'pending',
          adminNote: '',
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await app.db.collection('users').doc(app.user.uid).update({
          kycStatus: 'pending',
          kycFullName: fullName,
          nationalId
        });

        this.kycPhotos = { front: '', back: '', selfie: '' };
        document.getElementById('daman-kyc-modal').classList.add('hidden');
        app.toast(isAr ? 'تم إرسال البطاقة والسيلفي للإدارة للمراجعة بنجاح' : 'Verification submitted successfully', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    renderKycBanner(app) {
      const isAr = app.lang === 'ar';
      const st = app.profile?.kycStatus || 'unverified';
      if (st === 'verified') {
        return `
          <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-300 font-bold">
            <span><i class="fa-solid fa-circle-check me-1"></i> ${isAr ? 'حسابك موثّق بالبطاقة الشخصية والسيلفي' : 'Identity Verified (ID & Selfie)'}</span>
            <span class="text-[10px] text-emerald-400">${app.esc(app.profile.kycFullName || app.profile.name)}</span>
          </div>`;
      }
      if (st === 'pending') {
        return `
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 font-bold flex items-center gap-2">
            <i class="fa-solid fa-hourglass-half text-amber-400"></i>
            <span>${isAr ? 'تم استلام البطاقة والسيلفي وجارٍ مراجعتها من الإدارة.' : 'Your ID & selfie are under admin review.'}</span>
          </div>`;
      }
      return `
        <div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between gap-2">
          <div class="text-[11px] text-sky-200 leading-snug">
            <div class="font-extrabold text-white"><i class="fa-solid fa-id-card text-sky-400 me-1"></i> ${isAr ? 'وثّق حسابك بالبطاقة والسيلفي' : 'Verify Account (ID & Selfie)'}</div>
            <div class="text-[10px] text-slate-300 mt-0.5">${isAr ? 'مطلوب لتأكيد هويتك وتفعيل السحب الآمن باسمك.' : 'Required to confirm your legal name for withdrawals.'}</div>
          </div>
          <button type="button" onclick="DamanWallet.openKycModal()" class="shrink-0 px-3 py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-[11px]">
            ${isAr ? 'توثيق الآن' : 'Verify'}
          </button>
        </div>`;
    },

    copyRow(label, value, app) {
      if (!value) return '';
      const safeVal = app.esc(value);
      const safeLbl = app.esc(label);
      return `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
          <div class="min-w-0">
            <div class="text-[10px] text-slate-400">${safeLbl}</div>
            <div class="text-xs font-extrabold text-white break-all mt-0.5">${safeVal}</div>
          </div>
          <button type="button" onclick="DamanWallet.copyText('${safeVal.replace(/'/g, "\\'")}','${safeLbl.replace(/'/g, "\\'")}')"
            class="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-extrabold flex items-center gap-1">
            <i class="fa-regular fa-copy"></i><span>${app.lang === 'ar' ? 'نسخ' : 'Copy'}</span>
          </button>
        </div>`;
    },

    renderReceivingDetails(app) {
      const isAr = app.lang === 'ar';
      const cfg = this.paymentConfig || {};
      let rows = '';

      if (this.depositMethod === 'ewallet') {
        rows += this.copyRow(isAr ? 'نوع المحفظة' : 'Wallet Provider', cfg.walletProvider || (isAr ? 'محفظة إلكترونية' : 'E-Wallet'), app);
        rows += this.copyRow(isAr ? 'رقم المحفظة للتحويل' : 'Wallet Number', cfg.walletNumber, app);
        rows += this.copyRow(isAr ? 'اسم صاحب المحفظة' : 'Wallet Owner Name', cfg.walletOwner, app);
      } else if (this.depositMethod === 'bank') {
        rows += this.copyRow(isAr ? 'اسم البنك' : 'Bank Name', cfg.bankName, app);
        rows += this.copyRow(isAr ? 'رقم الحساب البنكي / IBAN' : 'Account Number / IBAN', cfg.bankAccount, app);
        rows += this.copyRow(isAr ? 'اسم صاحب الحساب' : 'Account Holder Name', cfg.bankOwner, app);
      } else {
        rows += this.copyRow(isAr ? 'عنوان / رقم إنستا باي' : 'InstaPay Address / Phone', cfg.instapayAddress, app);
        rows += this.copyRow(isAr ? 'اسم صاحب حساب إنستا باي' : 'InstaPay Account Name', cfg.instapayOwner, app);
      }

      if (
        (this.depositMethod === 'ewallet' && !cfg.walletNumber) ||
        (this.depositMethod === 'bank' && !cfg.bankAccount) ||
        (this.depositMethod === 'instapay' && !cfg.instapayAddress)
      ) {
        return `
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-2">
            <div><i class="fa-solid fa-circle-info me-1"></i> ${isAr ? 'بيانات الاستلام لهذه الوسيلة غير مُدخلة بعد من قِبل الإدارة.' : 'Receiving details for this method are not configured yet.'}</div>
            ${app.isAdmin() ? `<button type="button" onclick="DamanWallet.openConfigModal()" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[11px]">${isAr ? 'إدخال بيانات الاستلام الآن' : 'Configure Now'}</button>` : ''}
          </div>`;
      }

      return `<div class="space-y-2">${rows}</div>`;
    },

    renderMethodPills(kind, active, isAr) {
      const items =
        kind === 'deposit'
          ? [
              { id: 'ewallet', icon: 'fa-mobile-screen-button', ar: 'محفظة إلكترونية', en: 'E-Wallet' },
              { id: 'bank', icon: 'fa-building-columns', ar: 'حساب بنكي', en: 'Bank Account' },
              { id: 'instapay', icon: 'fa-bolt', ar: 'إنستا باي', en: 'InstaPay' }
            ]
          : [
              { id: 'ewallet', icon: 'fa-mobile-screen-button', ar: 'محفظة إلكترونية', en: 'E-Wallet' },
              { id: 'bank', icon: 'fa-building-columns', ar: 'حساب بنكي', en: 'Bank Account' }
            ];

      return `
        <div class="grid ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2">
          ${items.map((it) => `
            <button type="button" onclick="DamanWallet.setMethod('${kind}','${it.id}')"
              class="py-2.5 px-2 rounded-xl border text-[11px] font-extrabold flex flex-col items-center gap-1 transition-all ${active === it.id ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900/70 border-slate-800 text-slate-400'}">
              <i class="fa-solid ${it.icon}"></i>
              <span>${isAr ? it.ar : it.en}</span>
            </button>`).join('')}
        </div>`;
    },

    renderDepositTab(app) {
      const isAr = app.lang === 'ar';
      const m = this.depositMethod;
      let senderInputs = '';

      if (m === 'ewallet') {
        senderInputs = `
          <input id="dep-wallet-num" type="tel" required placeholder="${isAr ? 'رقم المحفظة المحوَّل منها (إلزامي)' : 'Sender Wallet Number (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-wallet-owner" type="text" required placeholder="${isAr ? 'اسم صاحب المحفظة المحوَّل منها (إلزامي)' : 'Sender Wallet Owner Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else if (m === 'bank') {
        senderInputs = `
          <input id="dep-bank-name" type="text" required placeholder="${isAr ? 'اسم البنك المحوَّل منه (إلزامي)' : 'Sender Bank Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-bank-acc" type="text" required placeholder="${isAr ? 'رقم الحساب المحوَّل منه (إلزامي)' : 'Sender Account Number (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-bank-owner" type="text" required placeholder="${isAr ? 'اسم صاحب الحساب البنكي (إلزامي)' : 'Sender Account Holder Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else {
        senderInputs = `
          <input id="dep-insta-addr" type="text" required placeholder="${isAr ? 'عنوان أو رقم إنستا باي المحوَّل منه (إلزامي)' : 'Sender InstaPay Address/Phone'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-insta-owner" type="text" required placeholder="${isAr ? 'اسم صاحب حساب إنستا باي (إلزامي)' : 'Sender InstaPay Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      }

      return `
        <div class="space-y-3">
          <!-- 1 Business Day SLA Notice -->
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-[11px] text-emerald-200 leading-relaxed">
            <i class="fa-solid fa-clock text-emerald-400 text-base shrink-0"></i>
            <div>
              <span class="font-extrabold text-white">${isAr ? 'مدة تنفيذ الإيداع:' : 'Deposit Processing Time:'}</span>
              ${isAr ? ' يتم مراجعة الإيصال وإضافة الرصيد لمحفظتك <b>خلال يوم عمل واحد</b>.' : ' Receipts are verified and credited to your wallet <b>within 1 business day</b>.'}
            </div>
          </div>

          <div class="glass-card rounded-2xl p-3.5 space-y-3">
            <div class="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
              <i class="fa-solid fa-1"></i> ${isAr ? 'اختر وسيلة الإيداع (محفظة / بنك / إنستا باي)' : '1. Choose Deposit Method'}
            </div>
            ${this.renderMethodPills('deposit', m, isAr)}${this.renderReceivingDetails(app)}
          </div>

          <form onsubmit="DamanWallet.submitDeposit(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <div class="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
              <i class="fa-solid fa-2"></i> ${isAr ? 'سجّل بيانات التحويل وارفع صورة الإيصال' : '2. Enter transfer details & upload receipt'}
            </div>

            <input id="dep-amount" type="number" min="10" step="any" required placeholder="${isAr ? 'المبلغ المحوَّل بالجنيه المصري (ج.م)' : 'Transferred Amount (EGP)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs font-bold text-white" />
            ${senderInputs}
            <input id="dep-ref" type="text" placeholder="${isAr ? 'رقم العملية المرجعي (إن وجد)' : 'Transaction Reference (Optional)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <label class="block w-full p-3 rounded-xl border border-dashed border-amber-500/50 bg-slate-950/70 text-center cursor-pointer hover:bg-slate-900">
              <i class="fa-solid fa-cloud-arrow-up text-amber-400 text-lg"></i>
              <div class="text-xs font-bold text-white mt-1">${isAr ? 'اضغط لرفع صورة إيصال التحويل (إلزامي)' : 'Tap to upload transfer receipt (Required)'}</div>
              <div class="text-[10px] text-slate-400">${isAr ? 'يتم ضغط الصورة تلقائياً لضمان سرعة الحفظ' : 'Automatically compressed for fast saving'}</div>
              <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleReceiptPick(this)" />
            </label>
            <div id="dep-receipt-preview">
              ${this.receiptBase64 ? `<img src="${this.receiptBase64}" class="w-full max-h-44 object-contain rounded-xl border border-emerald-500/40 bg-slate-950" />` : ''}
            </div>

            <button id="dep-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> ${isAr ? 'إرسال طلب الإيداع (التنفيذ خلال يوم عمل)' : 'Submit Deposit (1 Business Day)'}
            </button>
          </form>
        </div>`;
    },

    renderWithdrawTab(app) {
      const isAr = app.lang === 'ar';
      const p = app.profile || {};
      const avail = Number(p.balanceAvailable || 0);
      const m = this.withdrawMethod === 'bank' ? 'bank' : 'ewallet';
      const legalName = p.kycFullName || p.name || '';
      let targetInputs = '';

      if (m === 'ewallet') {
        targetInputs = `
          <input id="wd-wallet-num" type="tel" required placeholder="${isAr ? 'رقم المحفظة الإلكترونية المسحوب عليها (إلزامي)' : 'Recipient E-Wallet Number (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-wallet-owner" type="text" required value="${app.esc(legalName)}" placeholder="${isAr ? 'اسم صاحب المحفظة (يجب أن يطابق اسم صاحب الحساب)' : 'Wallet Owner Name (Must match account name)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else {
        targetInputs = `
          <input id="wd-bank-name" type="text" required placeholder="${isAr ? 'اسم البنك (إلزامي)' : 'Bank Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-bank-acc" type="text" required placeholder="${isAr ? 'رقم الحساب البنكي أو IBAN (إلزامي)' : 'Account Number or IBAN (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-bank-owner" type="text" required value="${app.esc(legalName)}" placeholder="${isAr ? 'اسم صاحب الحساب البنكي (يجب أن يطابق اسم صاحب الحساب)' : 'Account Holder Name (Must match account name)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      }

      return `
        <form onsubmit="DamanWallet.submitWithdraw(event)" class="glass-card rounded-2xl p-3.5 space-y-3">
          <!-- 1 Business Day SLA Notice -->
          <div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-2.5 text-[11px] text-sky-200 leading-relaxed">
            <i class="fa-solid fa-clock text-sky-400 text-base shrink-0"></i>
            <div>
              <span class="font-extrabold text-white">${isAr ? 'مدة تنفيذ السحب:' : 'Withdrawal Processing Time:'}</span>
              ${isAr ? ' يتم مراجعة الطلب وتحويل المبلغ <b>خلال يوم عمل واحد</b>.' : ' Requests are reviewed and transferred <b>within 1 business day</b>.'}
            </div>
          </div>

          <!-- Prominent Same-Name Policy Disclaimer -->
          <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-1">
            <div class="text-xs font-extrabold text-rose-300 flex items-center gap-1.5">
              <i class="fa-solid fa-triangle-exclamation"></i>
              <span>${isAr ? 'تنويه هام وشرط إلزامي للسحب' : 'Important Withdrawal Rule'}</span>
            </div>
            <p class="text-[11px] text-rose-100/90 leading-relaxed">
              ${isAr
                ? `السحب متاح على <b>المحفظة الإلكترونية</b> أو <b>الحساب البنكي</b> فقط، ويُشترط أن تكون المحفظة أو الحساب البنكي <b>مسجّلة بنفس اسم صاحب الحساب (${app.esc(legalName)})</b> المطابق للبطاقة الشخصية. أي طلب سحب لاسم مختلف يتم رفضه تلقائياً.`
                : `Withdrawals are available via <b>E-Wallet</b> or <b>Bank Account</b> only, and MUST be registered under the exact account holder name (<b>${app.esc(legalName)}</b>) matching your National ID.`}
            </p>
          </div>

          <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs">
            <span class="text-slate-400">${isAr ? 'المتاح للسحب الآن:' : 'Available to withdraw:'}</span>
            <span class="font-black text-emerald-400">${app.fmtMoney(avail)}${app.t('egp')}</span>
          </div>

          ${this.renderMethodPills('withdraw', m, isAr)}

          <input id="wd-amount" type="number" min="10" max="${avail}" step="any" required placeholder="${isAr ? 'المبلغ المطلوب سحبه (ج.م)' : 'Withdrawal Amount (EGP)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/40 text-xs font-bold text-white" />
          ${targetInputs}

          <label class="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer">
            <input id="wd-same-name-check" type="checkbox" required class="mt-0.5 accent-amber-500 w-4 h-4 shrink-0" />
            <span class="text-[11px] text-slate-200 leading-snug">
              ${isAr
                ? 'أقر بأن المحفظة الإلكترونية أو الحساب البنكي مسجّل باسمي الشخصي المطابق للبطاقة الشخصية، وأوافق على أن التنفيذ يتم خلال يوم عمل واحد.'
                : 'I confirm this E-Wallet or Bank Account is in my own legal name matching my ID, and acknowledge 1 business day processing.'}
            </span>
          </label>

          <button id="wd-submit-btn" type="submit" ${p.status === 'frozen' || avail < 10 ? 'disabled' : ''}
            class="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-black text-xs">
            <i class="fa-solid fa-money-bill-transfer me-1"></i> ${isAr ? 'تأكيد طلب السحب (التنفيذ خلال يوم عمل)' : 'Submit Withdrawal (1 Business Day)'}
          </button>
        </form>`;
    },

    statusBadge(status, isAr) {
      const map = {
        pending: { cls: 'bg-amber-500/20 text-amber-300', ar: 'قيد المراجعة', en: 'Pending' },
        approved: { cls: 'bg-emerald-500/20 text-emerald-300', ar: 'تمت الموافقة', en: 'Approved' },
        rejected: { cls: 'bg-rose-500/20 text-rose-300', ar: 'مرفوض', en: 'Rejected' },
        reversed: { cls: 'bg-purple-500/20 text-purple-300', ar: 'تم السحب / التراجع', en: 'Reversed' }
      };
      const st = map[status] || map.pending;
      return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}">${isAr ? st.ar : st.en}</span>`;
    },

    methodSummary(req, isAr) {
      const app = window.DamanApp;
      if (req.method === 'ewallet') {
        const num = req.type === 'deposit' ? req.senderWalletNumber : req.targetWalletNumber;
        const own = req.type === 'deposit' ? req.senderWalletOwner : req.targetWalletOwner;
        return `${isAr ? 'محفظة:' : 'Wallet:'} ${app.esc(num || '-')} (${app.esc(own \vert{}\vert{} '-')})`; } if (req.method === 'bank') { const bank = req.type === 'deposit' ? req.senderBankName : req.targetBankName; const acc = req.type === 'deposit' ? req.senderAccountNumber : req.targetAccountNumber; const own = req.type === 'deposit' ? req.senderAccountOwner : req.targetAccountOwner; return `${app.esc(bank || '-')} | ${app.esc(acc \vert{}\vert{} '-')} (${app.esc(own || '-')})`;
      }
      const addr = req.type === 'deposit' ? req.senderInstapay : req.targetInstapay;
      const own = req.type === 'deposit' ? req.senderInstapayOwner : req.targetInstapayOwner;
      return `InstaPay: ${app.esc(addr \vert{}\vert{} '-')} (${app.esc(own || '-')})`;
    },

    renderHistoryTab(app) {
      const isAr = app.lang === 'ar';
      const reqHtml = !this.requests.length
        ? `<div class="text-center text-xs text-slate-400 py-5">${isAr ? 'لا توجد طلبات إيداع أو سحب بعد' : 'No deposit/withdrawal requests yet'}</div>`
        : this.requests.map((r) => `
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-extrabold ${r.type === 'deposit' ? 'text-emerald-400' : 'text-sky-400'}">
