(function () {
  const WalletMod = {
    subTab: 'deposit',
    depositMethod: 'ewallet',
    withdrawMethod: 'ewallet',
    receiptBase64: '',
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

    compressImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Invalid image'));
          img.onload = () => {
            const maxW = 900;
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
            resolve(canvas.toDataURL('image/jpeg', 0.65));
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
        this.receiptBase64 = await this.compressImage(file);
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

      if (!rows || (this.depositMethod === 'ewallet' && !cfg.walletNumber) || (this.depositMethod === 'bank' && !cfg.bankAccount) || (this.depositMethod === 'instapay' && !cfg.instapayAddress)) {
        return `
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-2">
            <div><i class="fa-solid fa-circle-info me-1"></i> ${isAr ? 'بيانات الاستلام لهذه الوسيلة غير مُدخلة بعد من قِبل الإدارة.' : 'Receiving details for this method are not configured yet.'}</div>
            ${app.isAdmin() ? `<button type="button" onclick="DamanWallet.openConfigModal()" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[11px]">${isAr ? 'إدخال بيانات الاستلام الآن' : 'Configure Now'}</button>` : ''}
          </div>`;
      }

      return `<div class="space-y-2">${rows}</div>`;
    },

    renderMethodPills(kind, active, isAr) {
      const items = [
        { id: 'ewallet', icon: 'fa-mobile-screen-button', ar: 'محفظة إلكترونية', en: 'E-Wallet' },
        { id: 'bank', icon: 'fa-building-columns', ar: 'حساب بنكي', en: 'Bank Account' },
        { id: 'instapay', icon: 'fa-bolt', ar: 'إنستا باي', en: 'InstaPay' }
      ];
      return `
        <div class="grid grid-cols-3 gap-1.5">
          ${items.map((it) => `
            <button type="button" onclick="DamanWallet.setMethod('${kind}','${it.id}')"
              class="py-2 px-1.5 rounded-xl border text-[11px] font-extrabold flex flex-col items-center gap-1 transition-all ${active === it.id ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900/70 border-slate-800 text-slate-400'}">
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
          <div class="glass-card rounded-2xl p-3.5 space-y-3">
            <div class="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
              <i class="fa-solid fa-1"></i> ${isAr ? 'اختر وسيلة التحويل وانسخ بيانات الاستلام' : '1. Choose method & copy receiving details'}
            </div>
            ${this.renderMethodPills('deposit', m, isAr)}
            ${this.renderReceivingDetails(app)}
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
              <i class="fa-solid fa-paper-plane me-1"></i> ${isAr ? 'إرسال طلب الإيداع للمراجعة' : 'Submit Deposit Request'}
            </button>
          </form>
        </div>`;
    },

    renderWithdrawTab(app) {
      const isAr = app.lang === 'ar';
      const p = app.profile || {};
      const avail = Number(p.balanceAvailable || 0);
      const m = this.withdrawMethod;
      let targetInputs = '';

      if (m === 'ewallet') {
        targetInputs = `
          <input id="wd-wallet-num" type="tel" required placeholder="${isAr ? 'رقم المحفظة المستلمة (إلزامي)' : 'Recipient Wallet Number (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-wallet-owner" type="text" required placeholder="${isAr ? 'اسم صاحب المحفظة بالكامل (إلزامي)' : 'Wallet Owner Full Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else if (m === 'bank') {
        targetInputs = `
          <input id="wd-bank-name" type="text" required placeholder="${isAr ? 'اسم البنك (إلزامي)' : 'Bank Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-bank-acc" type="text" required placeholder="${isAr ? 'رقم الحساب البنكي أو IBAN (إلزامي)' : 'Account Number or IBAN (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-bank-owner" type="text" required placeholder="${isAr ? 'اسم صاحب الحساب البنكي (إلزامي)' : 'Account Holder Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      } else {
        targetInputs = `
          <input id="wd-insta-addr" type="text" required placeholder="${isAr ? 'عنوان أو رقم إنستا باي (إلزامي)' : 'InstaPay Address / Phone (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          <input id="wd-insta-owner" type="text" required placeholder="${isAr ? 'اسم صاحب حساب إنستا باي (إلزامي)' : 'InstaPay Account Name (Required)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />`;
      }

      return `
        <form onsubmit="DamanWallet.submitWithdraw(event)" class="glass-card rounded-2xl p-3.5 space-y-3">
          <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs">
            <span class="text-slate-400">${isAr ? 'المتاح للسحب الآن:' : 'Available to withdraw:'}</span>
            <span class="font-black text-emerald-400">${app.fmtMoney(avail)} ${app.t('egp')}</span>
          </div>
          <div class="text-[10px] text-slate-400 leading-relaxed">
            <i class="fa-solid fa-lock text-amber-400 me-1"></i>
            ${isAr ? 'الرصيد المحجوز في عقود الضمان أو المحجوز إدارياً لا يمكن سحبه إلا بعد تحريره.' : 'Escrow and admin-held balances cannot be withdrawn until released.'}
          </div>

          ${this.renderMethodPills('withdraw', m, isAr)}

          <input id="wd-amount" type="number" min="10" max="${avail}" step="any" required placeholder="${isAr ? 'المبلغ المطلوب سحبه (ج.م)' : 'Withdrawal Amount (EGP)'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/40 text-xs font-bold text-white" />
          ${targetInputs}

          <button id="wd-submit-btn" type="submit" ${p.status === 'frozen' || avail < 10 ? 'disabled' : ''}
            class="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-black text-xs">
            <i class="fa-solid fa-money-bill-transfer me-1"></i> ${isAr ? 'تأكيد طلب السحب' : 'Submit Withdrawal Request'}
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
        ? `<div class="text-center text-xs text-slate-400 py-5">${isAr ? 'لا توجد طلبات إيداع أو سحب بعد' : 'No deposit/withdrawal requests yet'}</div>`
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
              ${r.referenceNumber ? `<div class="text-[10px] text-slate-400">${isAr ? 'المرجع:' : 'Ref:'} ${app.esc(r.referenceNumber)}</div>` : ''}
              ${r.adminNote ? `<div class="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg">${isAr ? 'ملاحظة الإدارة:' : 'Admin Note:'} ${app.esc(r.adminNote)}</div>` : ''}
            </div>`).join('');

      const txHtml = !this.transactions.length
        ? `<div class="text-center text-xs text-slate-400 py-5">${isAr ? 'لا توجد حركات مالية مسجلة بعد' : 'No ledger transactions yet'}</div>`
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
            <h4 class="text-xs font-extrabold text-white"><i class="fa-solid fa-receipt text-emerald-400 me-1"></i> ${isAr ? 'سجل المعاملات والضمان (3.5%)' : 'Ledger & Escrow Transactions'}</h4>
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
      if (!this.receiptBase64) return app.toast(isAr ? 'يرجى رفع صورة إيصال التحويل أولاً' : 'Please upload receipt image first', 'error');

      const btn = document.getElementById('dep-submit-btn');
      if (btn) btn.disabled = true;

      const payload = {
        type: 'deposit',
        userId: app.user.uid,
        userName: app.profile.name || '',
        userEmail: app.profile.email || app.user.email || '',
        accountType: app.profile.accountType || 'client',
        amount,
        method: this.depositMethod,
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
        app.toast(isAr ? 'تم إرسال طلب الإيداع بنجاح وجارٍ مراجعته من الإدارة' : 'Deposit request submitted', 'success');
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
      if (amount > avail) return app.toast(isAr ? 'المبلغ المطلوب أكبر من الرصيد المتاح للسحب' : 'Amount exceeds available balance', 'error');

      const btn = document.getElementById('wd-submit-btn');
      if (btn) btn.disabled = true;

      const payload = {
        type: 'withdraw',
        userId: app.user.uid,
        userName: app.profile.name || '',
        userEmail: app.profile.email || app.user.email || '',
        accountType: app.profile.accountType || 'client',
        amount,
        method: this.withdrawMethod,
        status: 'pending',
        adminNote: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (this.withdrawMethod === 'ewallet') {
        payload.targetWalletNumber = document.getElementById('wd-wallet-num').value.trim();
        payload.targetWalletOwner = document.getElementById('wd-wallet-owner').value.trim();
      } else if (this.withdrawMethod === 'bank') {
        payload.targetBankName = document.getElementById('wd-bank-name').value.trim();
        payload.targetAccountNumber = document.getElementById('wd-bank-acc').value.trim();
        payload.targetAccountOwner = document.getElementById('wd-bank-owner').value.trim();
      } else {
        payload.targetInstapay = document.getElementById('wd-insta-addr').value.trim();
        payload.targetInstapayOwner = document.getElementById('wd-insta-owner').value.trim();
      }

      try {
        await app.db.collection('walletRequests').add(payload);
        app.toast(isAr ? 'تم إرسال طلب السحب للإدارة بنجاح' : 'Withdrawal request submitted', 'success');
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

            <div class="text-[11px] font-extrabold text-sky-400 pt-1">2. الحساب البنكي</div>
            <input id="cfg-b-name" value="${app.esc(cfg.bankName || '')}" placeholder="اسم البنك (مثلاً البنك الأهلي المصري)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-b-acc" value="${app.esc(cfg.bankAccount || '')}" placeholder="رقم الحساب البنكي / IBAN" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-b-own" value="${app.esc(cfg.bankOwner || '')}" placeholder="اسم صاحب الحساب البنكي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <div class="text-[11px] font-extrabold text-purple-400 pt-1">3. إنستا باي (InstaPay)</div>
            <input id="cfg-i-addr" value="${app.esc(cfg.instapayAddress || '')}" placeholder="عنوان أو رقم إنستا باي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cfg-i-own" value="${app.esc(cfg.instapayOwner || '')}" placeholder="اسم صاحب حساب إنستا باي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

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
            bankName: document.getElementById('cfg-b-name').value.trim(),
            bankAccount: document.getElementById('cfg-b-acc').value.trim(),
            bankOwner: document.getElementById('cfg-b-own').value.trim(),
            instapayAddress: document.getElementById('cfg-i-addr').value.trim(),
            instapayOwner: document.getElementById('cfg-i-own').value.trim(),
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
            <h3 class="text-base font-extrabold text-white">${isAr ? 'سجّل الدخول لفتح محفظتك' : 'Sign in to access your wallet'}</h3>
            <p class="text-xs text-slate-400">${isAr ? 'أدر رصيدك المتاح، مبالغ الضمان (3.5%)، وطلبات الإيداع والسحب.' : 'Manage your available funds, 3.5% escrow balance, deposits & withdrawals.'}</p>
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
          : this.renderHistoryTab(app);

      container.innerHTML = `
        <div class="space-y-4">
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

          <div class="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanWallet.setSubTab('deposit')" class="py-2 rounded-lg text-xs font-extrabold ${this.subTab === 'deposit' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'إيداع' : 'Deposit'}</button>
            <button onclick="DamanWallet.setSubTab('withdraw')" class="py-2 rounded-lg text-xs font-extrabold ${this.subTab === 'withdraw' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'سحب' : 'Withdraw'}</button>
            <button onclick="DamanWallet.setSubTab('history')" class="py-2 rounded-lg text-xs font-extrabold ${this.subTab === 'history' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'السجل' : 'History'}</button>
          </div>

          ${bodyHtml}
        </div>`;
    }
  };

  window.DamanWallet = WalletMod;
  if (window.DamanApp) window.DamanApp.registerModule('wallet', WalletMod);
})();
