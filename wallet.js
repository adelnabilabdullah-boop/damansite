(function () {
  const WalletMod = {
    subTab: 'deposit',
    depositMethod: 'ewallet',
    withdrawMethod: 'ewallet',
    receiptBase64: '',
    kycPhotos: { front: '', back: '', selfie: '', cr: '', tax: '' },
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

    openDepositWithAmount(amount) {
      this.subTab = 'deposit';
      window.DamanApp.switchTab('wallet');
      setTimeout(() => {
        const el = document.getElementById('dep-amount');
        if (el && amount) el.value = Math.ceil(Number(amount));
      }, 150);
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

    compressImage(file, maxW = 720, quality = 0.55) {
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
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
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
        this.receiptBase64 = await this.compressImage(file, 820, 0.6);
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
        // Keep each KYC photo compact so 3-5 photos stay safely under Firestore 1MB limit
        this.kycPhotos[kind] = await this.compressImage(file, 600, 0.48);
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
      const isCompany = p.accountType === 'company';

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
              <i class="fa-solid ${isCompany ? 'fa-building-shield' : 'fa-id-card'} me-1"></i>
              ${isCompany
                ? (isAr ? 'توثيق الشركة (سجل تجاري + ضريبية)' : 'Company Verification (CR & Tax Card)')
                : (isAr ? 'توثيق الحساب بالبطاقة والسيلفي' : 'Identity Verification (KYC)')}
            </h3>
            <button onclick="document.getElementById('daman-kyc-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed mb-3">
            <i class="fa-solid fa-shield-halved me-1"></i>
            ${isCompany
              ? (isAr
                  ? 'لتفعيل حساب الشركة وإعطاء صلاحيات (Access) لفريق العمل، يلزم رفع السجل التجاري والبطاقة الضريبية وبطاقة المفوّض وسيلفي.'
                  : 'To activate company features and team Access, upload Commercial Register, Tax Card, and Authorized Person ID + Selfie.')
              : (isAr
                  ? 'بيانات البطاقة وصورة السيلفي سرّية تماماً ولا يراها إلا إدارة المنصة لتأمين حسابك ومطابقة اسمك عند الإيداع والسحب.'
                  : 'Your ID and selfie are confidential and reviewed only by admin to secure deposits & withdrawals.')}
          </div>

          <form onsubmit="DamanWallet.submitKyc(event)" class="space-y-2.5">
            ${isCompany ? `
              <input id="kyc-comp-name" type="text" required value="${app.esc(p.companyName || '')}"
                placeholder="${isAr ? 'اسم الشركة الرسمي كما بالسجل التجاري' : 'Official Company Name'}"
                class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/40 text-xs text-white" />
              <input id="kyc-cr-num" type="text" required value="${app.esc(p.commercialReg || '')}"
                placeholder="${isAr ? 'رقم السجل التجاري (إلزامي)' : 'Commercial Register Number (Required)'}"
                class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              <input id="kyc-tax-num" type="text" required value="${app.esc(p.taxCardNumber || '')}"
                placeholder="${isAr ? 'رقم البطاقة الضريبية (إلزامي)' : 'Tax Card Number (Required)'}"
                class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

              <label class="block p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950/70 cursor-pointer">
                <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span><i class="fa-solid fa-file-contract text-sky-400 me-1.5"></i> ${isAr ? 'صورة السجل التجاري (إلزامي)' : 'Commercial Register Photo'}</span>
                  <span class="text-[10px] text-sky-400">${isAr ? 'اختر صورة' : 'Upload'}</span>
                </div>
                <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('cr', this)" />
                <div id="kyc-prev-cr">${this.kycPhotos.cr ? `<img src="${this.kycPhotos.cr}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
              </label>

              <label class="block p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950/70 cursor-pointer">
                <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span><i class="fa-solid fa-file-invoice text-sky-400 me-1.5"></i> ${isAr ? 'صورة البطاقة الضريبية (إلزامي)' : 'Tax Card Photo'}</span>
                  <span class="text-[10px] text-sky-400">${isAr ? 'اختر صورة' : 'Upload'}</span>
                </div>
                <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('tax', this)" />
                <div id="kyc-prev-tax">${this.kycPhotos.tax ? `<img src="${this.kycPhotos.tax}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
              </label>
            ` : ''}

            <input id="kyc-fullname" type="text" required value="${app.esc(p.kycFullName || p.name || '')}"
              placeholder="${isCompany ? (isAr ? 'اسم المفوّض / صاحب الشركة الرباعي' : 'Authorized Person Full Name') : (isAr ? 'الاسم الرباعي كما هو مكتوب في البطاقة' : 'Full Legal Name as on ID')}"
              class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <input id="kyc-id-num" type="tel" inputmode="numeric" maxlength="14" required value="${app.esc(p.nationalId || '')}"
              placeholder="${isAr ? 'الرقم القومي (14 رقم بالظبط)' : 'National ID Number (14 Digits)'}"
              class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white tracking-wider" />

            <label class="block p-2.5 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 cursor-pointer">
              <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                <span><i class="fa-solid fa-address-card text-amber-400 me-1.5"></i> ${isAr ? 'صورة وجه البطاقة (الأمام)' : 'National ID Front'}</span>
                <span class="text-[10px] text-sky-400">${isAr ? 'اختر صورة' : 'Upload'}</span>
              </div>
              <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('front', this)" />
              <div id="kyc-prev-front">${this.kycPhotos.front ? `<img src="${this.kycPhotos.front}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
            </label>

            ${!isCompany ? `
              <label class="block p-2.5 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 cursor-pointer">
                <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span><i class="fa-regular fa-address-card text-amber-400 me-1.5"></i> ${isAr ? 'صورة ظهر البطاقة (الخلف)' : 'National ID Back'}</span>
                  <span class="text-[10px] text-sky-400">${isAr ? 'اختر صورة' : 'Upload'}</span>
                </div>
                <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('back', this)" />
                <div id="kyc-prev-back">${this.kycPhotos.back ? `<img src="${this.kycPhotos.back}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
              </label>` : ''}

            <label class="block p-2.5 rounded-xl border border-dashed border-sky-500/50 bg-slate-950/70 cursor-pointer">
              <div class="flex items-center justify-between text-xs font-bold text-slate-200">
                <span><i class="fa-solid fa-camera-retro text-sky-400 me-1.5"></i> ${isAr ? 'صورة سيلفي واضحة لك مع البطاقة' : 'Clear Selfie with ID'}</span>
                <span class="text-[10px] text-sky-400">${isAr ? 'التقط / اختر' : 'Capture / Upload'}</span>
              </div>
              <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleKycPhoto('selfie', this)" />
              <div id="kyc-prev-selfie">${this.kycPhotos.selfie ? `<img src="${this.kycPhotos.selfie}" class="w-full h-24 object-cover rounded-lg border border-emerald-500/50 mt-1.5" />` : ''}</div>
            </label>

            <button id="kyc-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs mt-1">
              <i class="fa-solid fa-shield-check me-1"></i> ${isAr ? 'إرسال بيانات التوثيق للمراجعة (مجاناً)' : 'Submit Verification (Free)'}
            </button>
          </form>
        </div>`;
    },

    async submitKyc(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const isCompany = app.profile?.accountType === 'company';

      const fullName = document.getElementById('kyc-fullname').value.trim();
      const nationalId = document.getElementById('kyc-id-num').value.replace(/\D/g, '');

      if (nationalId.length !== 14) {
        return app.toast(isAr ? 'يجب إدخال الرقم القومي مكوناً من 14 رقماً' : 'National ID must be 14 digits', 'error');
      }

      if (isCompany) {
        if (!this.kycPhotos.cr || !this.kycPhotos.tax || !this.kycPhotos.front || !this.kycPhotos.selfie) {
          return app.toast(isAr ? 'يرجى رفع صور السجل التجاري، البطاقة الضريبية، بطاقة المفوّض، والسيلفي' : 'Upload CR, Tax Card, ID & Selfie', 'error');
        }
      } else {
        if (!this.kycPhotos.front || !this.kycPhotos.back || !this.kycPhotos.selfie) {
          return app.toast(isAr ? 'يرجى رفع صور البطاقة (الأمام والخلف) وصورة السيلفي' : 'Upload ID front, back & selfie', 'error');
        }
      }

      const btn = document.getElementById('kyc-submit-btn');
      if (btn) btn.disabled = true;

      const compName = isCompany ? document.getElementById('kyc-comp-name').value.trim() : '';
      const crNum = isCompany ? document.getElementById('kyc-cr-num').value.trim() : '';
      const taxNum = isCompany ? document.getElementById('kyc-tax-num').value.trim() : '';

      try {
        await app.db.collection('kycRequests').doc(app.user.uid).set({
          userId: app.user.uid,
          userEmail: app.profile.email || app.user.email || '',
          accountType: app.profile.accountType || 'client',
          fullName,
          nationalId,
          companyName: compName,
          commercialReg: crNum,
          taxCardNumber: taxNum,
          crPhotoBase64: isCompany ? this.kycPhotos.cr : '',
          taxPhotoBase64: isCompany ? this.kycPhotos.tax : '',
          idFrontBase64: this.kycPhotos.front,
          idBackBase64: this.kycPhotos.back || '',
          selfieBase64: this.kycPhotos.selfie,
          status: 'pending',
          adminNote: '',
          submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const userPatch = { kycStatus: 'pending', kycFullName: fullName, nationalId };
        if (isCompany) {
          userPatch.companyName = compName;
          userPatch.commercialReg = crNum;
          userPatch.taxCardNumber = taxNum;
        }
        await app.db.collection('users').doc(app.user.uid).update(userPatch);

        this.kycPhotos = { front: '', back: '', selfie: '', cr: '', tax: '' };
        document.getElementById('daman-kyc-modal').classList.add('hidden');
        app.toast(isAr ? 'تم إرسال مستندات التوثيق للإدارة للمراجعة بنجاح' : 'Verification submitted successfully', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    renderKycBanner(app) {
      const isAr = app.lang === 'ar';
      const st = app.profile?.kycStatus || 'unverified';
      const isCompany = app.profile?.accountType === 'company';

      if (st === 'verified') {
        return `
          <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-[11px] text-emerald-300 font-bold">
            <span><i class="fa-solid fa-circle-check me-1"></i> ${isCompany ? (isAr ? 'شركة موثّقة (سجل تجاري وضريبية)' : 'Verified Company') : (isAr ? 'حساب موثّق بالبطاقة والسيلفي' : 'Verified Account')}</span>
            <span class="text-[10px] text-emerald-400 truncate max-w-[120px]">${app.esc(app.profile.companyName || app.profile.kycFullName || app.profile.name)}</span>
          </div>`;
      }
      if (st === 'pending') {
        return `
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 font-bold flex items-center gap-2">
            <i class="fa-solid fa-hourglass-half text-amber-400"></i>
            <span>${isAr ? 'تم استلام مستندات التوثيق وجارٍ مراجعتها من الإدارة.' : 'Your verification documents are under admin review.'}</span>
          </div>`;
      }
      return `
        <div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between gap-2">
          <div class="text-[11px] text-sky-200 leading-snug">
            <div class="font-extrabold text-white"><i class="fa-solid ${isCompany ? 'fa-building-shield' : 'fa-id-card'} text-sky-400 me-1"></i> ${isCompany ? (isAr ? 'وثّق شركتك بالسجل التجاري والضريبية' : 'Verify Company (CR & Tax)') : (isAr ? 'وثّق حسابك بالبطاقة والسيلفي (مجاناً)' : 'Verify Account (Free KYC)')}</div>
            <div class="text-[10px] text-slate-300 mt-0.5">${isCompany ? (isAr ? 'مطلوب لتفعيل لوحة الشركة وإعطاء صلاحيات Access.' : 'Required to unlock team Access.') : (isAr ? 'مطلوب لتأكيد هويتك وتفعيل السحب الآمن باسمك.' : 'Required for secure withdrawals.')}</div>
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

      if (this.depositMethod === 'ewallet') {
        if (!cfg.walletNumber) return this.missingConfigNotice(app);
        return `<div class="space-y-2">
          ${this.copyRow(isAr ? 'نوع المحفظة' : 'Wallet Provider', cfg.walletProvider || (isAr ? 'محفظة إلكترونية' : 'E-Wallet'), app)}
          ${this.copyRow(isAr ? 'رقم المحفظة للتحويل' : 'Wallet Number', cfg.walletNumber, app)}
          ${this.copyRow(isAr ? 'اسم صاحب المحفظة' : 'Wallet Owner Name', cfg.walletOwner, app)}
        </div>`;
      }

      if (this.depositMethod === 'bank') {
        if (!cfg.bankAccount) return this.missingConfigNotice(app);
        return `<div class="space-y-2">
          ${this.copyRow(isAr ? 'اسم البنك' : 'Bank Name', cfg.bankName, app)}
          ${this.copyRow(isAr ? 'رقم الحساب البنكي / IBAN' : 'Account Number / IBAN', cfg.bankAccount, app)}
          ${this.copyRow(isAr ? 'اسم صاحب الحساب' : 'Account Holder Name', cfg.bankOwner, app)}
        </div>`;
      }

      // InstaPay: Direct Payment Link Button + Owner Name
      if (!cfg.instapayLink && !cfg.instapayAddress) return this.missingConfigNotice(app);
      const link = cfg.instapayLink || '';
      const validUrl = link && /^https?:\/\//i.test(link) ? link : link ? 'https://' + link : '';
      return `
        <div class="space-y-2">
          ${validUrl ? `
            <a href="${app.esc(validUrl)}" target="_blank" rel="noopener"
              class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg">
              <i class="fa-solid fa-bolt"></i>
              <span>${isAr ? 'اضغط هنا للتحويل المباشر عبر إنستا باي (InstaPay)' : 'Tap to Pay Directly via InstaPay'}</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </a>` : ''}
          ${cfg.instapayAddress ? this.copyRow(isAr ? 'عنوان إنستا باي (IPA)' : 'InstaPay Address', cfg.instapayAddress, app) : ''}
          ${cfg.instapayOwner ? this.copyRow(isAr ? 'اسم صاحب حساب إنستا باي' : 'InstaPay Account Name', cfg.instapayOwner, app) : ''}
        </div>`;
    },

    missingConfigNotice(app) {
      const isAr = app.lang === 'ar';
      return `
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-2">
          <div><i class="fa-solid fa-circle-info me-1"></i> ${isAr ? 'بيانات الاستلام لهذه الوسيلة غير مُدخلة بعد من الإدارة.' : 'Receiving details not configured yet.'}</div>
          ${app.isAdmin() ? `<button type="button" onclick="DamanWallet.openConfigModal()" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[11px]">${isAr ? 'إدخال بيانات الاستلام الآن' : 'Configure Now'}</button>` : ''}
        </div>`;
    },

    renderMethodPills(kind, active, isAr) {
      const items =
        kind === 'deposit'
          ? [
              { id: 'ewallet', icon: 'fa-mobile-screen-button', ar: 'محفظة إلكترونية', en: 'E-Wallet' },
              { id: 'instapay', icon: 'fa-bolt', ar: 'إنستا باي (رابط)', en: 'InstaPay Link' },
              { id: 'bank', icon: 'fa-building-columns', ar: 'حساب بنكي', en: 'Bank Account' }
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
      const p = app.profile || {};
      const m = this.depositMethod;
      const legalName = p.kycFullName || p.name || '';
      let senderInputs = '';

      if (m === 'ewallet') {
        senderInputs = `
          <input id="dep-wallet-num" type="tel" required value="${app.esc(p.phone || '')}" placeholder="${isAr ? 'رقم المحفظة المحوَّل منها (رقمك المسجّل)' : 'Sender Wallet Number'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-wallet-owner" type="text" required value="${app.esc(legalName)}" placeholder="${isAr ? 'اسم صاحب المحفظة المحوَّل منها' : 'Sender Wallet Owner Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else if (m === 'bank') {
        senderInputs = `
          <input id="dep-bank-name" type="text" required placeholder="${isAr ? 'اسم البنك المحوَّل منه (إلزامي)' : 'Sender Bank Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-bank-acc" type="text" required placeholder="${isAr ? 'رقم الحساب المحوَّل منه (إلزامي)' : 'Sender Account Number'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-bank-owner" type="text" required value="${app.esc(legalName)}" placeholder="${isAr ? 'اسم صاحب الحساب البنكي' : 'Sender Account Holder Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else {
        senderInputs = `
          <input id="dep-insta-addr" type="text" required placeholder="${isAr ? 'عنوان أو رقم إنستا باي المحوَّل منه' : 'Sender InstaPay Address/Phone'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="dep-insta-owner" type="text" required value="${app.esc(legalName)}" placeholder="${isAr ? 'اسم صاحب حساب إنستا باي' : 'Sender InstaPay Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      }

      return `
        <div class="space-y-3">
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1 text-[11px] text-emerald-200 leading-relaxed">
            <div><i class="fa-solid fa-clock text-emerald-400 me-1"></i> ${isAr ? 'يتم مراجعة الإيداع وإضافة الرصيد <b>خلال يوم عمل واحد</b>.' : 'Deposits are verified and credited <b>within 1 business day</b>.'}</div>
            <div class="text-amber-200"><i class="fa-solid fa-user-check text-amber-400 me-1"></i> ${isAr ? 'تنويه: يجب أن يكون الإيداع من محفظة أو حساب بنكي أو إنستا باي <b>بنفس اسمك أو رقمك المسجّل</b>.' : 'Notice: Deposits must come from a wallet, bank, or InstaPay in your own name.'}</div>
          </div>

          <div class="glass-card rounded-2xl p-3.5 space-y-3">
            <div class="text-xs font-extrabold text-amber-400"><i class="fa-solid fa-1 me-1"></i> ${isAr ? 'اختر وسيلة الإيداع (محفظة / إنستا باي / بنك)' : '1. Choose Deposit Method'}</div>
            ${this.renderMethodPills('deposit', m, isAr)}
            ${this.renderReceivingDetails(app)}
          </div>

          <form onsubmit="DamanWallet.submitDeposit(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <div class="text-xs font-extrabold text-emerald-400"><i class="fa-solid fa-2 me-1"></i> ${isAr ? 'سجّل بيانات التحويل وارفع الإيصال' : '2. Enter Transfer Details & Receipt'}</div>

            <input id="dep-amount" type="number" min="10" step="any" required placeholder="${isAr ? 'المبلغ المحوَّل بالجنيه المصري (ج.م)' : 'Transferred Amount (EGP)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs font-bold text-white" />
            ${senderInputs}
            <input id="dep-ref" type="text" placeholder="${isAr ? 'رقم العملية المرجعي (اختياري)' : 'Transaction Reference (Optional)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <label class="block w-full p-3 rounded-xl border border-dashed border-amber-500/50 bg-slate-950/70 text-center cursor-pointer hover:bg-slate-900">
              <i class="fa-solid fa-cloud-arrow-up text-amber-400 text-lg"></i>
              <div class="text-xs font-bold text-white mt-1">${isAr ? 'اضغط لرفع صورة إيصال التحويل (إلزامي)' : 'Upload Transfer Receipt (Required)'}</div>
              <input type="file" accept="image/*" class="hidden" onchange="DamanWallet.handleReceiptPick(this)" />
            </label>
            <div id="dep-receipt-preview">
              ${this.receiptBase64 ? `<img src="${this.receiptBase64}" class="w-full max-h-44 object-contain rounded-xl border border-emerald-500/40 bg-slate-950" />` : ''}
            </div>

            <label class="flex items-start gap-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer">
              <input id="dep-same-name-check" type="checkbox" required checked class="mt-0.5 accent-emerald-500 w-4 h-4 shrink-0" />
              <span class="text-[11px] text-slate-200">${isAr ? 'أقر بأن التحويل تم من محفظة أو حساب باسمي/رقمي، وأعلم أن الإضافة خلال يوم عمل واحد.' : 'I confirm this transfer is from my own account (1 business day processing).'}</span>
            </label>

            <button id="dep-submit-btn" type="submit" class="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> ${isAr ? 'إرسال طلب الإيداع (خلال يوم عمل)' : 'Submit Deposit (1 Business Day)'}
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
          <input id="wd-wallet-num" type="tel" required value="${app.esc(p.phone || '')}" placeholder="${isAr ? 'رقم المحفظة الإلكترونية (إلزامي)' : 'E-Wallet Number (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-wallet-owner" type="text" required value="${app.esc(legalName)}" placeholder="${isAr ? 'اسم صاحب المحفظة (مطابق لاسم الحساب)' : 'Wallet Owner Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else {
        targetInputs = `
          <input id="wd-bank-name" type="text" required placeholder="${isAr ? 'اسم البنك (إلزامي)' : 'Bank Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-bank-acc" type="text" required placeholder="${isAr ? 'رقم الحساب البنكي أو IBAN (إلزامي)' : 'Account Number / IBAN'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-bank-owner" type="text" required value="${app.esc(legalName)}" placeholder="${isAr ? 'اسم صاحب الحساب البنكي (مطابق لاسم الحساب)' : 'Account Holder Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      }

      return `
        <form onsubmit="DamanWallet.submitWithdraw(event)" class="glass-card rounded-2xl p-3.5 space-y-3">
          <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-1 text-[11px] text-rose-100 leading-relaxed">
            <div class="font-extrabold text-rose-300"><i class="fa-solid fa-triangle-exclamation me-1"></i> ${isAr ? 'شروط السحب (خلال يوم عمل واحد):' : 'Withdrawal Rules (1 Business Day):'}</div>
            <div>• ${isAr ? 'السحب متاح على <b>المحفظة الإلكترونية</b> أو <b>الحساب البنكي</b> فقط.' : 'Available via <b>E-Wallet</b> or <b>Bank Account</b> only.'}</div>
            <div>• ${isAr ? `يُشترط أن يكون الحساب أو المحفظة <b>بنفس اسم صاحب الحساب (${app.esc(legalName)})</b>.` : `Must be registered in the account holder name (<b>${app.esc(legalName)}</b>).`}</div>
          </div>

          ${this.renderMethodPills('withdraw', m, isAr)}

          <input id="wd-amount" type="number" min="10" max="${avail}" step="any" required placeholder="${isAr ? `المبلغ المطلوب سحبه (المتاح: ${app.fmtMoney(avail)} ج.م)` : `Amount (Available: ${app.fmtMoney(avail)} EGP)`}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/40 text-xs font-bold text-white" />
          ${targetInputs}

          <label class="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer">
            <input id="wd-same-name-check" type="checkbox" required class="mt-0.5 accent-amber-500 w-4 h-4 shrink-0" />
            <span class="text-[11px] text-slate-200 leading-snug">${isAr ? 'أقر بأن المحفظة أو الحساب البنكي مسجّل باسمي الشخصي المطابق للبطاقة، وأوافق على أن التحويل يتم خلال يوم عمل واحد.' : 'I confirm this account is in my own legal name (1 business day processing).'}</span>
          </label>

          <button id="wd-submit-btn" type="submit" ${p.status === 'frozen' || avail < 10 ? 'disabled' : ''}
            class="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-black text-xs">
            <i class="fa-solid fa-money-bill-transfer me-1"></i> ${isAr ? 'تأكيد طلب السحب (خلال يوم عمل)' : 'Submit Withdrawal (1 Business Day)'}
          </button>
        </form>`;
    },

    renderPackagesTab(app) {
      const isAr = app.lang === 'ar';
      const pkgs = app.getPackages();
      const ind = pkgs.individual;
      const comp = pkgs.company;
      const feat = pkgs.featured;
      const p = app.profile || {};

      const activeSubBadge = p.activePlanName
        ? `<div class="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center justify-between">
             <span><i class="fa-solid fa-crown text-amber-400 me-1"></i> ${isAr ? 'باقتك الحالية:' : 'Active Plan:'} ${app.esc(p.activePlanName)}</span>
             <span class="text-[10px]">${app.esc(p.activePlanExpires || '')}</span>
           </div>`
        : '';

      const planGrid = (planKey, obj, accent) => `
        <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-${accent}-500/30">
          <h4 class="text-xs font-black text-${accent}-400">${isAr ? obj.titleAr : obj.titleEn}</h4>
          <div class="grid grid-cols-2 gap-2">
            ${[
              { dur: '1 شهر', days: 30, price: obj.m1, save: '' },
              { dur: '3 شهور', days: 90, price: obj.m3, save: isAr ? 'خصم' : 'Save' },
              { dur: '6 شهور', days: 180, price: obj.m6, save: isAr ? 'خصم أكبر' : 'Best Value' },
              { dur: 'سنة كاملة', days: 365, price: obj.m12, save: isAr ? 'أفضل سعر' : 'Top Deal' }
            ].map((item) => `
              <button type="button" onclick="DamanWallet.subscribePlan('${planKey}','${item.dur}',${item.days},${item.price})"
                class="p-2.5 rounded-xl bg-slate-950/90 hover:bg-slate-800 border border-slate-800 hover:border-${accent}-500/60 text-start space-y-1 transition-all">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-extrabold text-white">${item.dur}</span>
                  ${item.save ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-${accent}-500/20 text-${accent}-300 font-bold">${item.save}</span>` : ''}
                </div>
                <div class="text-sm font-black text-emerald-400">${app.fmtMoney(item.price)} <span class="text-[10px]">${app.t('egp')}</span></div>
              </button>`).join('')}
          </div>
        </div>`;

      return `
        <div class="space-y-3.5">
          ${activeSubBadge}
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
            <i class="fa-solid fa-gem text-amber-400 me-1"></i>
            ${isAr ? 'اختر الباقة والمدة المناسبة ليتم تفعيلها فوراً من رصيدك المتاح، أو اشحن الفرق في ثوانٍ.' : 'Select a plan to activate immediately from your available balance.'}
          </div>

          ${planGrid('individual', ind, 'amber')}
          ${planGrid('company', comp, 'sky')}

          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-purple-500/30">
            <h4 class="text-xs font-black text-purple-400"><i class="fa-solid fa-star me-1"></i> ${isAr ? feat.titleAr : feat.titleEn}</h4>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" onclick="DamanWallet.subscribePlan('featured','أسبوع (7 أيام)',7,${feat.week})" class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-purple-500/60 text-start">
                <div class="text-[11px] font-extrabold text-white">${isAr ? 'أسبوع (7 أيام)' : '1 Week'}</div>
                <div class="text-sm font-black text-emerald-400 mt-1">${app.fmtMoney(feat.week)} ${app.t('egp')}</div>
              </button>
              <button type="button" onclick="DamanWallet.subscribePlan('featured','شهر (30 يوم)',30,${feat.month})" class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-purple-500/60 text-start">
                <div class="text-[11px] font-extrabold text-white">${isAr ? 'شهر (30 يوم)' : '1 Month'}</div>
                <div class="text-sm font-black text-emerald-400 mt-1">${app.fmtMoney(feat.month)} ${app.t('egp')}</div>
              </button>
            </div>
          </div>
        </div>`;
    },

    async subscribePlan(planKey, durLabel, days, price) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const avail = Number(app.profile?.balanceAvailable || 0);

      if (avail < price) {
        const diff = price - avail;
        const go = window.confirm(
          isAr
            ? `رصيدك المتاح (${app.fmtMoney(avail)} ج.م) أقل من سعر الباقة (${app.fmtMoney(price)} ج.م).\nهل تريد الانتقال لشحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`
            : `Available balance (${app.fmtMoney(avail)}) is less than plan price (${app.fmtMoney(price)}). Deposit ${app.fmtMoney(diff)} EGP now?`
        );
        if (go) this.openDepositWithAmount(diff);
        return;
      }

      const planTitle = `${planKey === 'company' ? 'باقة الشركات' : planKey === 'featured' ? 'تمييز إعلان' : 'باقة الأفراد VIP'} (${durLabel})`;
      if (!window.confirm(isAr ? `تأكيد خصم ${app.fmtMoney(price)} ج.م من رصيدك المتاح وتفعيل ${planTitle}؟` : `Confirm activating ${planTitle} for ${price} EGP?`)) return;

      const userRef = app.db.collection('users').doc(app.user.uid);
      const expDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      try {
        await app.db.runTransaction(async (tx) => {
          const uDoc = await tx.get(userRef);
          const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
          if (curAvail < price) throw new Error(isAr ? 'الرصيد المتاح غير كافٍ' : 'Insufficient balance');

          const patch = { balanceAvailable: Math.round((curAvail - price) * 100) / 100 };
          if (planKey === 'featured') {
            patch.featuredCredits = firebase.firestore.FieldValue.increment(1);
          } else {
            patch.activePlanKey = planKey;
            patch.activePlanName = planTitle;
            patch.activePlanExpires = expDate;
          }
          tx.update(userRef, patch);

          tx.set(app.db.collection('transactions').doc(), {
            userId: app.user.uid,
            type: 'package_subscription',
            title: planTitle,
            note: isAr ? `صالح حتى ${expDate}` : `Valid until ${expDate}`,
            amount: -price,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        app.toast(isAr ? `مبروك! تم تفعيل ${planTitle} بنجاح` : `Activated ${planTitle}`, 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    statusBadge(status, isAr) {
      const map = {
        pending: { cls: 'bg-amber-500/20 text-amber-300', ar: 'قيد المراجعة', en: 'Pending' },
        approved: { cls: 'bg-emerald-500/20 text-emerald-300', ar: 'تمت الموافقة', en: 'Approved' },
        rejected: { cls: 'bg-rose-500/20 text-rose-300', ar: 'مرفوض', en: 'Rejected' },
        reversed: { cls: 'bg-purple-500/20 text-purple-300', ar: 'تم التراجع', en: 'Reversed' }
      };
      const st = map[status] || map.pending;
      return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}">${isAr ? st.ar : st.en}</span>`;
    },

    methodSummary(req, isAr) {
      const app = window.DamanApp;
      if (req.method === 'ewallet') {
        const num = req.type === 'deposit' ? req.senderWalletNumber : req.targetWalletNumber;
        const own = req.type === 'deposit' ? req.senderWalletOwner : req.targetWalletOwner;
        return `${isAr ? 'محفظة:' : 'Wallet:'} ${app.esc(num || '-')} (${app.esc(own || '-')})`;
      }
      if (req.method === 'bank') {
        const bank = req.type === 'deposit' ? req.senderBankName : req.targetBankName;
        const acc = req.type === 'deposit' ? req.senderAccountNumber : req.targetAccountNumber;
        const own = req.type === 'deposit' ? req.senderAccountOwner : req.targetAccountOwner;
        return `${app.esc(bank || '-')} | ${app.esc(acc || '-')} (${app.esc(own || '-')})`;
      }
      const addr = req.type === 'deposit' ? req.senderInstapay : req.targetInstapay;
      const own = req.type === 'deposit' ? req.senderInstapayOwner : req.targetInstapayOwner;
      return `InstaPay: ${app.esc(addr || '-')} (${app.esc(own || '-')})`;
    },

    renderHistoryTab(app) {
      const isAr = app.lang === 'ar';
      const reqHtml = !this.requests.length
        ? `<div class="text-center text-xs text-slate-400 py-5">${isAr ? 'لا توجد طلبات إيداع أو سحب بعد' : 'No requests yet'}</div>`
        : this.requests.map((r) => `
            <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-extrabold ${r.type === 'deposit' ? 'text-emerald-400' : 'text-sky-400'}">
                  <i class="fa-solid ${r.type === 'deposit' ? 'fa-arrow-down' : 'fa-arrow-up'} me-1"></i>
                  ${r.type === 'deposit' ? (isAr ? 'إيداع' : 'Deposit') : (isAr ? 'سحب' : 'Withdraw')} — ${app.fmtMoney(r.amount)} ${app.t('egp')}
                </span>
                ${this.statusBadge(r.status, isAr)}
              </div>
              <div class="text-[11px] text-slate-300">${this.methodSummary(r, isAr)}</div>
              ${r.status === 'pending' ? `<div class="text-[10px] text-amber-300/90"><i class="fa-regular fa-clock me-1"></i>${isAr ? 'التنفيذ خلال يوم عمل واحد' : 'Processed within 1 business day'}</div>` : ''}
              ${r.adminNote ? `<div class="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg">${isAr ? 'ملاحظة الإدارة:' : 'Admin:'} ${app.esc(r.adminNote)}</div>` : ''}
            </div>`).join('');

      const txHtml = !this.transactions.length
        ? `<div class="text-center text-xs text-slate-400 py-5">${isAr ? 'لا توجد حركات مالية بعد' : 'No transactions yet'}</div>`
        : this.transactions.map((t) => `
            <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-bold text-white truncate">${app.esc(t.title || t.type)}</div>
                <div class="text-[10px] text-slate-400 truncate">${app.esc(t.note || '')}</div>
              </div>
              <div class="text-xs font-black shrink-0 ${Number(t.amount) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                ${Number(t.amount) >= 0 ? '+' : ''}${app.fmtMoney(t.amount)} ${app.t('egp')}
              </div>
            </div>`).join('');

      return `
        <div class="space-y-4">
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-white"><i class="fa-solid fa-clock-rotate-left text-amber-400 me-1"></i> ${isAr ? 'طلبات الإيداع والسحب' : 'Deposit & Withdrawal Requests'}</h4>
            ${reqHtml}
          </div>
          <div class="glass-card rounded-2xl p-3.5 space-y-2">
            <h4 class="text-xs font-extrabold text-white"><i class="fa-solid fa-receipt text-emerald-400 me-1"></i> ${isAr ? 'سجل المعاملات والضمان والباقات' : 'Ledger Transactions'}</h4>
            ${txHtml}
          </div>
        </div>`;
    },

    async submitDeposit(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');

      const amount = parseFloat(document.getElementById('dep-amount').value);
      if (!amount || amount < 10) return app.toast(isAr ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid amount', 'error');
      if (!this.receiptBase64) return app.toast(isAr ? 'يرجى رفع صورة إيصال التحويل أولاً' : 'Upload receipt first', 'error');

      const btn = document.getElementById('dep-submit-btn');
      if (btn) btn.disabled = true;

      const payload = {
        type: 'deposit',
        userId: app.user.uid,
        userName: app.profile.kycFullName || app.profile.name || '',
        userEmail: app.profile.email || app.user.email || '',
        accountType: app.profile.accountType || 'client',
        amount,
        method: this.depositMethod,
        sameNameConfirmed: true,
        slaText: '1 business day',
        referenceNumber: (document.getElementById('dep-ref')?.value || '').trim(),
        receiptBase64: this.receiptBase64,
        status: 'pending',
        adminNote: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (this.depositMethod === 'ewallet') {
        payload.senderWalletNumber = document.getElementById('dep-wallet-num').value.trim();
        payload.senderWalletOwner = document.getElementById('dep-wallet-owner').value.trim();
      } else if (this.depositMethod === 'bank') {
        payload.senderBankName = document.getElementById('dep-bank-name').value.trim();
        payload.senderAccountNumber = document.getElementById('dep-bank-acc').value.trim();
        payload.senderAccountOwner = document.getElementById('dep-bank-owner').value.trim();
      } else {
        payload.senderInstapay = document.getElementById('dep-insta-addr').value.trim();
        payload.senderInstapayOwner = document.getElementById('dep-insta-owner').value.trim();
      }

      try {
        await app.db.collection('walletRequests').add(payload);
        this.receiptBase64 = '';
        app.toast(isAr ? 'تم إرسال طلب الإيداع — سيتم المراجعة والإضافة خلال يوم عمل واحد' : 'Deposit submitted (1 business day)', 'success');
        this.subTab = 'history';
        this.rerender();
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    async submitWithdraw(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (app.profile.status === 'frozen') return app.toast(app.t('frozenNotice'), 'error');

      const avail = Number(app.profile.balanceAvailable || 0);
      const amount = parseFloat(document.getElementById('wd-amount').value);
      if (!amount || amount < 10) return app.toast(isAr ? 'أدخل مبلغاً صحيحاً' : 'Enter a valid amount', 'error');
      if (amount > avail) return app.toast(isAr ? 'المبلغ المطلوب أكبر من الرصيد المتاح للسحب' : 'Exceeds available balance', 'error');

      const btn = document.getElementById('wd-submit-btn');
      if (btn) btn.disabled = true;

      const m = this.withdrawMethod === 'bank' ? 'bank' : 'ewallet';
      const payload = {
        type: 'withdraw',
        userId: app.user.uid,
        userName: app.profile.kycFullName || app.profile.name || '',
        userEmail: app.profile.email || app.user.email || '',
        accountType: app.profile.accountType || 'client',
        kycStatusAtRequest: app.profile.kycStatus || 'unverified',
        sameNameConfirmed: true,
        slaText: '1 business day',
        amount,
        method: m,
        status: 'pending',
        adminNote: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (m === 'ewallet') {
        payload.targetWalletNumber = document.getElementById('wd-wallet-num').value.trim();
        payload.targetWalletOwner = document.getElementById('wd-wallet-owner').value.trim();
      } else {
        payload.targetBankName = document.getElementById('wd-bank-name').value.trim();
        payload.targetAccountNumber = document.getElementById('wd-bank-acc').value.trim();
        payload.targetAccountOwner = document.getElementById('wd-bank-owner').value.trim();
      }

      try {
        await app.db.collection('walletRequests').add(payload);
        app.toast(isAr ? 'تم إرسال طلب السحب — سيتم التحويل خلال يوم عمل واحد' : 'Withdrawal submitted (1 business day)', 'success');
        this.subTab = 'history';
        this.rerender();
      } catch (err) {
        app.toast(err.message, 'error');
        if (btn) btn.disabled = false;
      }
    },

    openConfigModal() {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const cfg = this.paymentConfig || {};
      let modal = document.getElementById('wallet-admin-config-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'wallet-admin-config-modal';
        modal.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-extrabold text-amber-400"><i class="fa-solid fa-crown me-1"></i> إعداد بيانات الاستلام (الإدارة)</h3>
            <button onclick="document.getElementById('wallet-admin-config-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanWallet.saveAdminConfig(event)" class="space-y-2.5">
            <div class="text-[11px] font-extrabold text-emerald-400">1. المحفظة الإلكترونية</div>
            <input id="cfg-w-prov" value="${app.esc(cfg.walletProvider || 'فودافون كاش')}" placeholder="نوع المحفظة (مثلاً فودافون كاش)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-w-num" value="${app.esc(cfg.walletNumber || '')}" placeholder="رقم المحفظة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-w-own" value="${app.esc(cfg.walletOwner || '')}" placeholder="اسم صاحب المحفظة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <div class="text-[11px] font-extrabold text-purple-400 pt-1">2. إنستا باي (رابط الدفع المباشر)</div>
            <input id="cfg-i-link" value="${app.esc(cfg.instapayLink || '')}" placeholder="رابط الدفع المباشر لإنستا باي (https://ipn.eg/...)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-xs text-white" />
            <input id="cfg-i-addr" value="${app.esc(cfg.instapayAddress || '')}" placeholder="عنوان إنستا باي (اختياري)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-i-own" value="${app.esc(cfg.instapayOwner || '')}" placeholder="اسم صاحب حساب إنستا باي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <div class="text-[11px] font-extrabold text-sky-400 pt-1">3. الحساب البنكي</div>
            <input id="cfg-b-name" value="${app.esc(cfg.bankName || '')}" placeholder="اسم البنك" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-b-acc" value="${app.esc(cfg.bankAccount || '')}" placeholder="رقم الحساب البنكي / IBAN" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-b-own" value="${app.esc(cfg.bankOwner || '')}" placeholder="اسم صاحب الحساب البنكي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs mt-2">حفظ البيانات فوراً</button>
          </form>
        </div>`;
    },

    async saveAdminConfig(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      try {
        await app.db.collection('settings').doc('payment').set(
          {
            walletProvider: document.getElementById('cfg-w-prov').value.trim(),
            walletNumber: document.getElementById('cfg-w-num').value.trim(),
            walletOwner: document.getElementById('cfg-w-own').value.trim(),
            instapayLink: document.getElementById('cfg-i-link').value.trim(),
            instapayAddress: document.getElementById('cfg-i-addr').value.trim(),
            instapayOwner: document.getElementById('cfg-i-own').value.trim(),
            bankName: document.getElementById('cfg-b-name').value.trim(),
            bankAccount: document.getElementById('cfg-b-acc').value.trim(),
            bankOwner: document.getElementById('cfg-b-own').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        document.getElementById('wallet-admin-config-modal').classList.add('hidden');
        app.toast('تم حفظ بيانات الاستلام بنجاح وظهرت للمستخدمين فوراً', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    render(container, app) {
      this.ensureListeners(app);
      const isAr = app.lang === 'ar';

      if (!app.user || !app.profile) {
        container.innerHTML = `
          <div class="glass-card rounded-2xl p-6 text-center mt-6 space-y-3">
            <i class="fa-solid fa-wallet text-4xl text-amber-400"></i>
            <h3 class="text-base font-extrabold text-white">${isAr ? 'سجّل الدخول لفتح محفظتك والباقات' : 'Sign in for Wallet & Plans'}</h3>
            <button onclick="DamanApp.openAuthModal('login')" class="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs">${app.t('loginBtn')}</button>
          </div>`;
        return;
      }

      const p = app.profile;
      const bodyHtml =
        this.subTab === 'deposit'
          ? this.renderDepositTab(app)
          : this.subTab === 'withdraw'
          ? this.renderWithdrawTab(app)
          : this.subTab === 'packages'
          ? this.renderPackagesTab(app)
          : this.renderHistoryTab(app);

      container.innerHTML = `
        <div class="space-y-4">
          ${this.renderKycBanner(app)}

          <div class="rounded-2xl p-4 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-amber-500/30 shadow-lg space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold text-amber-400"><i class="fa-solid fa-shield-halved me-1"></i> ${isAr ? 'محفظة الضمان المالي' : 'Escrow Wallet'}</span>
              ${app.isAdmin() ? `<button onclick="DamanWallet.openConfigModal()" class="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300"><i class="fa-solid fa-gear me-1"></i>${isAr ? 'بيانات الاستلام' : 'Receiving Info'}</button>` : ''}
            </div>
            <div>
              <div class="text-[11px] text-slate-400">${app.t('availableBal')}</div>
              <div class="text-2xl font-black text-emerald-400 mt-0.5">${app.fmtMoney(p.balanceAvailable)} <span class="text-xs font-bold">${app.t('egp')}</span></div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <div class="p-2.5 rounded-xl bg-slate-950/70">
                <div class="text-[10px] text-slate-400">${app.t('escrowBal')}</div>
                <div class="text-xs font-extrabold text-amber-400 mt-0.5">${app.fmtMoney(p.balanceEscrow)} ${app.t('egp')}</div>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-950/70">
                <div class="text-[10px] text-slate-400">${app.t('heldBal')}</div>
                <div class="text-xs font-extrabold text-rose-400 mt-0.5">${app.fmtMoney(p.balanceHeld)} ${app.t('egp')}</div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanWallet.setSubTab('deposit')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'deposit' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'إيداع' : 'Deposit'}</button>
            <button onclick="DamanWallet.setSubTab('withdraw')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'withdraw' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'سحب' : 'Withdraw'}</button>
            <button onclick="DamanWallet.setSubTab('packages')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'packages' ? 'bg-purple-500 text-white' : 'text-slate-400'}">${isAr ? 'الباقات' : 'Plans'}</button>
            <button onclick="DamanWallet.setSubTab('history')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'history' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'السجل' : 'History'}</button>
          </div>

          ${bodyHtml}
        </div>`;
    }
  };

  window.DamanWallet = WalletMod;
  if (window.DamanApp) window.DamanApp.registerModule('wallet', WalletMod);
})();
