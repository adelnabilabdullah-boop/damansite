(function () {
  const DepositWithdrawEngine = {
    _booted: false,
    _receiptDataUrl: '',
    _depositTimerId: null,
    _depositSecondsLeft: 600,
    config: {
      deposit: { wallet: true, instapay: true, bank: true },
      withdraw: { wallet: true, instapay: true, bank: true }
    },
    accountsInfo: {},
    domSnapshot: {
      walletNumber: '',
      walletHolder: '',
      instapayLink: '',
      instapayAddress: '',
      instapayHolder: '',
      instapayPhone: '',
      bankName: '',
      bankAccount: '',
      bankIban: '',
      bankHolder: ''
    },

    EGYPT_BANKS: [
      'البنك الأهلي المصري (NBE)',
      'بنك مصر (Banque Misr)',
      'البنك التجاري الدولي (CIB)',
      'بنك القاهرة (Banque du Caire)',
      'بنك الإسكندرية (AlexBank)',
      'بنك قطر الوطني (QNB)',
      'بنك فيصل الإسلامي',
      'مصرف أبوظبي الإسلامي (ADIB)',
      'البنك العربي الأفريقي (AAIB)',
      'بنك التعمير والإسكان',
      'بنك أخرى'
    ],

    getHolderName(app) {
      const a = app || window.DamanApp;
      if (!a || !a.profile) return 'صاحب الحساب المسجّل';
      return (a.profile.legalName || a.profile.name || a.profile.companyName || 'صاحب الحساب المسجّل').trim();
    },

    getSlaDuration() {
      return window.DamanWalletSLA?.slaConfig?.durationText || 'يوم عمل واحد (24 ساعة عمل)';
    },

    cleanDepositWithdrawButtons() {
      const app = window.DamanApp;
      const main = document.getElementById('app-main');
      if (!main) return;
      const isEn = app && app.lang === 'en';

      main.querySelectorAll('button').forEach((btn) => {
        if (btn.closest('.daman-modal')) return;
        const oc = btn.getAttribute('onclick') || '';
        const txt = (btn.textContent || '').trim();

        if (oc.includes('openDepositModal') || txt.includes('شحن / إيداع') || /إيداع\s*\(/.test(txt)) {
          const targetLabel = isEn ? 'Deposit' : 'إيداع';
          if (txt !== targetLabel) {
            btn.innerHTML = `<i class="fa-solid fa-circle-plus me-1"></i> ${targetLabel}`;
          }
        } else if (oc.includes('openWithdrawModal') || txt.includes('سحب كاش') || /سحب\s*\(/.test(txt)) {
          const targetLabel = isEn ? 'Withdraw' : 'سحب';
          if (txt !== targetLabel) {
            btn.innerHTML = `<i class="fa-solid fa-arrow-up-from-bracket me-1"></i> ${targetLabel}`;
          }
        }
      });
    },

    // Capture live values from Admin "محوّل الحسابات" inputs/textareas in DOM
    harvestAccountsFromAdminDOM() {
      const main = document.getElementById('app-main');
      if (!main) return;

      const fields = Array.from(main.querySelectorAll('input[type="text"], input[type="tel"], input[type="url"], input[type="number"], input:not([type]), textarea'));
      if (!fields.length) return;

      const getContext = (el) => {
        const lbl = el.id ? main.querySelector(`label[for="${el.id}"]`) : null;
        const prevLbl = el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL' ? el.previousElementSibling : null;
        const parentLbl = el.parentElement ? (el.parentElement.querySelector('label')?.textContent || '') : '';
        const card = el.closest('.glass-card, .rounded-2xl, .rounded-xl, div');
        const cardHead = card ? (card.querySelector('h1,h2,h3,h4,.font-black')?.textContent || '') : '';
        return `${el.id || ''} ${el.name || ''} ${el.placeholder || ''} ${(lbl || prevLbl)?.textContent || ''} ${parentLbl} ${cardHead}`.toLowerCase();
      };

      const freshSnap = {
        walletNumber: '',
        walletHolder: '',
        instapayLink: '',
        instapayAddress: '',
        instapayHolder: '',
        instapayPhone: '',
        bankName: '',
        bankAccount: '',
        bankIban: '',
        bankHolder: ''
      };
      let sawAdminAccountsScreen = false;

      fields.forEach((el) => {
        const ctx = getContext(el);
        const val = String(el.value !== undefined && el.value !== null ? el.value : '').trim();

        if (ctx.includes('محفظ') || ctx.includes('wallet') || ctx.includes('كاش')) {
          if (!ctx.includes('احتياط')) sawAdminAccountsScreen = true;
          if (!val || ctx.includes('احتياط')) return;
          if (ctx.includes('اسم') || ctx.includes('صاحب') || ctx.includes('holder') || ctx.includes('name')) {
            if (!freshSnap.walletHolder) freshSnap.walletHolder = val;
          } else if (!freshSnap.walletNumber) {
            freshSnap.walletNumber = val;
          }
        } else if (ctx.includes('إنستا') || ctx.includes('انستا') || ctx.includes('instapay') || ctx.includes('ipa')) {
          sawAdminAccountsScreen = true;
          if (!val) return;
          if (val.startsWith('http') || ctx.includes('رابط') || ctx.includes('لينك') || ctx.includes('link')) {
            if (!freshSnap.instapayLink) freshSnap.instapayLink = val;
          } else if (ctx.includes('اسم') || ctx.includes('صاحب') || ctx.includes('holder') || ctx.includes('name')) {
            if (!freshSnap.instapayHolder) freshSnap.instapayHolder = val;
          } else if (ctx.includes('موبايل') || ctx.includes('هاتف') || ctx.includes('phone')) {
            if (!freshSnap.instapayPhone) freshSnap.instapayPhone = val;
          } else if (!freshSnap.instapayAddress) {
            freshSnap.instapayAddress = val;
          }
        } else if (ctx.includes('بنك') || ctx.includes('bank') || ctx.includes('iban') || ctx.includes('حساب')) {
          sawAdminAccountsScreen = true;
          if (!val) return;
          if (ctx.includes('iban')) {
            if (!freshSnap.bankIban) freshSnap.bankIban = val;
          } else if (ctx.includes('اسم البنك') || (ctx.includes('بنك') && !ctx.includes('صاحب') && !ctx.includes('رقم') && !ctx.includes('حساب'))) {
            if (!freshSnap.bankName) freshSnap.bankName = val;
          } else if (ctx.includes('اسم') || ctx.includes('صاحب') || ctx.includes('holder')) {
            if (!freshSnap.bankHolder) freshSnap.bankHolder = val;
          } else if (!freshSnap.bankAccount) {
            freshSnap.bankAccount = val;
          }
        }
      });

      if (sawAdminAccountsScreen) {
        this.domSnapshot = freshSnap;
      }
    },

    flattenObject(obj, prefix = '', out = {}) {
      if (!obj || typeof obj !== 'object') return out;
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => this.flattenObject(item, `${prefix}[${idx}]`, out));
        return out;
      }
      Object.keys(obj).forEach((k) => {
        const val = obj[k];
        const path = prefix ? `${prefix}.${k}` : k;
        if (val !== null && val !== undefined && typeof val !== 'object') {
          out[path] = val;
          if (!(k in out) || out[k] === '') out[k] = val;
        } else if (val && typeof val === 'object') {
          this.flattenObject(val, path, out);
        }
      });
      return out;
    },

    async loadAllSettings() {
      this.harvestAccountsFromAdminDOM();
      const app = window.DamanApp;
      const flat = {};

      [app?.appConfig, window.DamanWallet?.accounts, window.DamanAdmin?.accounts].forEach((src) => {
        if (src && typeof src === 'object') this.flattenObject(src, '', flat);
      });

      if (app && app.db) {
        try {
          const settingsSnap = await app.db.collection('settings').get();
          if (settingsSnap && !settingsSnap.empty) {
            settingsSnap.docs.forEach((doc) => {
              const d = doc.data() || {};
              if (doc.id === 'paymentMethodsControl') {
                if (d.deposit) this.config.deposit = Object.assign({}, this.config.deposit, d.deposit);
                if (d.withdraw) this.config.withdraw = Object.assign({}, this.config.withdraw, d.withdraw);
              } else {
                this.flattenObject(d, doc.id, flat);
              }
            });
          }
        } catch (e) {}
      }
      this.accountsInfo = flat;
    },

    findValueByKeyPatterns(flatObj, exactKeys, includeTokens, excludeTokens = []) {
      for (const k of exactKeys) {
        const v = flatObj[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      for (const [path, val] of Object.entries(flatObj)) {
        if (val === undefined || val === null || typeof val === 'object') continue;
        const sVal = String(val).trim();
        if (!sVal) continue;
        const lowPath = path.toLowerCase();
        if (excludeTokens.some((ex) => lowPath.includes(ex))) continue;
        if (includeTokens.every((inc) => lowPath.includes(inc))) return sVal;
      }
      return '';
    },

    getReceivingAccountDetails(method) {
      this.harvestAccountsFromAdminDOM();
      const flat = this.flattenObject(window.DamanApp?.appConfig || {}, '', Object.assign({}, this.accountsInfo));
      const snap = this.domSnapshot;

      if (method === 'wallet') {
        let num = snap.walletNumber || this.findValueByKeyPatterns(
          flat,
          ['vodafoneCash', 'vodafoneNumber', 'walletNumber', 'cashNumber', 'depositWallet', 'etisalatCash', 'orangeCash', 'wePay', 'mobileWallet', 'walletPhone', 'receiveWallet', 'activeWallet'],
          ['wallet'],
          ['name', 'holder', 'owner', 'support', 'whatsapp', 'enable', 'active', 'min', 'max', 'fee']
        );
        if (!num) {
          for (const [k, v] of Object.entries(flat)) {
            if (typeof v === 'string' && /^01[0125]\d{8}$/.test(v.trim()) && !k.toLowerCase().includes('support') && !k.toLowerCase().includes('whatsapp')) {
              num = v.trim();
              break;
            }
          }
        }
        const name = snap.walletHolder
          || this.findValueByKeyPatterns(flat, ['walletHolderName', 'vodafoneName', 'walletName', 'walletOwner', 'walletAccountName'], ['wallet', 'name'], [])
          || this.findValueByKeyPatterns(flat, ['receiverName', 'accountHolderName'], ['holder'], []);

        return {
          title: '📱 بيانات المحفظة الإلكترونية المعتمدة للإيداع',
          rows: [
            { label: 'اسم صاحب المحفظة', value: name, copy: !!name },
            { label: 'رقم المحفظة', value: num, copy: !!num }
          ]
        };
      }

      if (method === 'instapay') {
        // Strictly preserve exact value (even if short or numeric like "10" or an IPA)
        const hasSnapInsta = !!(snap.instapayAddress || snap.instapayLink || snap.instapayHolder || snap.instapayPhone);
        const link = hasSnapInsta
          ? snap.instapayLink
          : this.findValueByKeyPatterns(flat, ['instapayLink', 'instapayUrl', 'ipnLink'], ['insta', 'link'], []);
        const ipa = hasSnapInsta
          ? snap.instapayAddress
          : this.findValueByKeyPatterns(
              flat,
              ['instapayAddress', 'instapay', 'instapayId', 'instapayUser', 'depositInstapay', 'ipa', 'ipaAddress', 'instapayPhone', 'activeInstapay'],
              ['insta'],
              ['name', 'holder', 'owner', 'link', 'url', 'enable', 'active', 'min', 'max']
            );
        const name = hasSnapInsta
          ? snap.instapayHolder
          : (this.findValueByKeyPatterns(flat, ['instapayName', 'instapayHolder', 'instapayOwner', 'instapayAccountName'], ['insta', 'name'], [])
            || this.findValueByKeyPatterns(flat, ['receiverName', 'accountHolderName'], ['holder'], []));
        const phone = hasSnapInsta
          ? snap.instapayPhone
          : this.findValueByKeyPatterns(flat, ['instapayPhone', 'instapayMobile'], ['insta', 'phone'], []);

        return {
          title: '⚡ بيانات إنستا باي (InstaPay) المعتمدة للإيداع',
          link,
          rows: [
            { label: 'اسم صاحب الحساب', value: name, copy: !!name },
            { label: 'عنوان إنستا باي (IPA)', value: ipa, copy: !!ipa },
            { label: 'رابط التحويل المباشر', value: link, copy: !!link },
            { label: 'رقم الموبايل المربوط', value: phone, copy: !!phone }
          ]
        };
      }

      const bankName = snap.bankName || this.findValueByKeyPatterns(flat, ['bankName', 'depositBankName', 'activeBankName'], ['bank', 'name'], ['holder', 'owner', 'user']);
      let bankAcc = snap.bankAccount || this.findValueByKeyPatterns(flat, ['bankAccount', 'bankAccountNumber', 'accountNumber', 'depositBank', 'bankAcc', 'activeBankAccount'], ['bank', 'acc'], ['name', 'holder', 'owner', 'enable']);
      const iban = snap.bankIban || this.findValueByKeyPatterns(flat, ['bankIban', 'iban', 'ibanNumber'], ['iban'], []);
      if (!bankAcc && !iban) {
        for (const v of Object.values(flat)) {
          if (typeof v === 'string' && (/^EG\d{20,}/i.test(v.replace(/\s+/g, '')) || /^\d{12,24}$/.test(v.replace(/\s+/g, '')))) {
            bankAcc = v.trim();
            break;
          }
        }
      }
      const bankHolder = snap.bankHolder
        || this.findValueByKeyPatterns(flat, ['bankHolderName', 'bankHolder', 'bankAccountName', 'bankOwner', 'companyLegalName'], ['bank', 'holder'], [])
        || this.findValueByKeyPatterns(flat, ['receiverName', 'accountHolderName'], ['holder'], []);

      return {
        title: '🏦 بيانات الحساب البنكي المعتمد للإيداع',
        rows: [
          { label: 'اسم صاحب الحساب البنكي', value: bankHolder, copy: !!bankHolder },
          { label: 'اسم البنك', value: bankName, copy: !!bankName },
          { label: 'رقم الحساب البنكي', value: bankAcc, copy: !!bankAcc },
          { label: 'رقم الـ IBAN', value: iban, copy: !!iban }
        ]
      };
    },

    stopDepositCountdown() {
      if (this._depositTimerId) {
        clearInterval(this._depositTimerId);
        this._depositTimerId = null;
      }
    },

    closeDepositModal() {
      this.stopDepositCountdown();
      document.getElementById('daman-deposit-modal')?.classList.add('hidden');
    },

    startDepositCountdown() {
      this.stopDepositCountdown();
      this._depositSecondsLeft = 10 * 60;

      const tick = () => {
        const modal = document.getElementById('daman-deposit-modal');
        if (!modal || modal.classList.contains('hidden')) {
          this.stopDepositCountdown();
          return;
        }
        const timerEl = document.getElementById('daman-dep-countdown-val');
        const boxEl = document.getElementById('daman-dep-countdown-box');
        const mins = Math.floor(this._depositSecondsLeft / 60);
        const secs = this._depositSecondsLeft % 60;
        if (timerEl) timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (boxEl && this._depositSecondsLeft <= 120) {
          boxEl.classList.remove('bg-amber-500/15', 'border-amber-500/50', 'text-amber-200');
          boxEl.classList.add('bg-rose-500/20', 'border-rose-500', 'text-rose-200');
        }

        if (this._depositSecondsLeft <= 0) {
          this.closeDepositModal();
          window.DamanApp?.toast('⏳ انتهت مدة الـ 10 دقائق — أعد فتح نافذة الإيداع للمتابعة.', 'warning');
          return;
        }
        this._depositSecondsLeft -= 1;
      };

      tick();
      this._depositTimerId = setInterval(tick, 1000);
    },

    updateDepositMethodUI() {
      const app = window.DamanApp;
      const method = document.getElementById('daman-dep-method')?.value || 'wallet';
      const box = document.getElementById('daman-dep-target-box');
      if (!box || !app) return;

      const info = this.getReceivingAccountDetails(method);
      const validRows = info.rows.filter((r) => r.value !== undefined && r.value !== null && String(r.value).trim() !== '');

      if (!validRows.length) {
        box.innerHTML = `
          <div class="text-[10.5px] font-black text-amber-300">${app.esc(info.title)}</div>
          <div class="text-[11px] font-bold text-rose-300 pt-1">⚠️ لم يتم حفظ بيانات الحساب واسم المستلم بعد — راجع الإدارة ← محوّل الحسابات.</div>`;
        return;
      }

      const linkBtn = info.link && /^https?:\/\//i.test(info.link)
        ? `<a href="${app.esc(info.link)}" target="_blank" rel="noopener noreferrer" class="mt-1.5 w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1.5"><i class="fa-solid fa-arrow-up-right-from-square"></i> فتح رابط التحويل المباشر في إنستا باي</a>`
        : '';

      box.innerHTML = `
        <div class="text-[10.5px] font-black text-amber-300 pb-1 border-b border-slate-800">${app.esc(info.title)}</div>
        <div class="space-y-1.5 pt-1.5">
          ${validRows.map((r) => `
            <div class="flex items-center justify-between gap-2 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <div class="min-w-0">
                <div class="text-[9.5px] text-slate-400">${app.esc(r.label)}:</div>
                <div class="text-xs font-black text-white select-all break-all" ${r.copy ? 'dir="ltr"' : ''}>${app.esc(String(r.value))}</div>
              </div>
              ${r.copy ? `
                <button type="button" onclick="navigator.clipboard.writeText('${app.esc(String(r.value)).replace(/'/g, "\\'")}'); DamanApp.toast('تم النسخ بنجاح ✅','success')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] shrink-0">
                  <i class="fa-regular fa-copy me-1"></i> نسخ
                </button>` : ''}
            </div>`).join('')}
        </div>
        ${linkBtn}`;
    },

    async openDepositModal() {
      const app = window.DamanApp;
      if (!app) return;
      if (!app.user) return app.openAuthModal?.();

      this.harvestAccountsFromAdminDOM();
      const holderName = this.getHolderName(app);
      const slaText = this.getSlaDuration();
      const d = this.config.deposit;

      const options = [];
      if (d.wallet !== false) options.push('<option value="wallet">📱 محفظة إلكترونية (فودافون / اتصالات / أورنج / وي كاش)</option>');
      if (d.instapay !== false) options.push('<option value="instapay">⚡ إنستا باي (InstaPay)</option>');
      if (d.bank !== false) options.push('<option value="bank">🏦 تحويل إلى حساب بنكي (IBAN / رقم حساب)</option>');

      let m = document.getElementById('daman-deposit-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-deposit-modal';
        m.className = 'daman-modal fixed inset-0 z-[95] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      this._receiptDataUrl = '';
      try { history.pushState({ damanModal: 'depositModal' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-circle-arrow-down me-1"></i> إيداع</h3>
            <button type="button" onclick="DamanWalletMethods.closeDepositModal()" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div id="daman-dep-countdown-box" class="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-amber-200 flex items-center justify-between gap-2">
            <div class="text-[10.5px] font-bold leading-snug">
              ⏳ هذه الصفحة مفتوحة لمدة <b>10 دقائق فقط</b> لإتمام التحويل وتأكيد الإيداع
            </div>
            <span id="daman-dep-countdown-val" dir="ltr" class="px-2.5 py-1 rounded-xl bg-slate-950 border border-amber-400/50 text-amber-300 font-black text-xs shrink-0">10:00</span>
          </div>

          <form onsubmit="DamanWalletMethods.submitDeposit(event)" class="space-y-3">
            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">1. اختر وسيلة الإيداع *</label>
              <select id="daman-dep-method" onchange="DamanWalletMethods.updateDepositMethodUI()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black">
                ${options.join('')}
              </select>
            </div>

            <div id="daman-dep-target-box" class="p-3 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-1">
              <div class="text-[10.5px] text-amber-300 font-bold">جارٍ تحميل بيانات الحساب واسم المستلم...</div>
            </div>

            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">2. المبلغ المحوّل (ج.م) *</label>
              <input id="daman-dep-amount" type="number" min="10" step="1" required placeholder="أدخل المبلغ بالجنيه المصري" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-black text-base text-center" />
              <div class="daman-quick-amts flex items-center gap-1 overflow-x-auto pt-1.5">
                ${[500, 1000, 5000, 10000, 25000].map((v) => `
                  <button type="button" onclick="document.getElementById('daman-dep-amount').value=${v}" class="shrink-0 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-amber-400 text-amber-300 font-black text-[10px]">+${v.toLocaleString('en-US')}</button>`).join('')}
              </div>
            </div>

            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">3. الرقم أو الحساب المحوّل منه *</label>
              <input id="daman-dep-sender" type="text" required placeholder="رقم المحفظة / حساب إنستا باي / رقم حسابك البنكي" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">4. الرقم المرجعي للعملية <span class="text-emerald-400">(اختياري)</span></label>
              <input id="daman-dep-ref" type="text" placeholder="اكتب الرقم المرجعي إن وجد أو اتركه فارغاً" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">5. صورة إيصال / لقطة شاشة التحويل *</label>
              <input id="daman-dep-receipt-file" type="file" accept="image/*" required onchange="DamanWalletMethods.handleReceiptFileChange(this)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-dashed border-amber-500/50 text-slate-300 text-[11px]" />
              <div id="daman-dep-receipt-preview" class="mt-1.5"></div>
            </div>

            <div class="p-3 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 text-[11px] leading-relaxed space-y-2">
              <div class="font-black text-rose-300 flex items-center gap-1.5">
                <i class="fa-solid fa-user-check"></i>
                <span>🛡️ تنبيه إلزامي: الإيداع بنفس اسم صاحب الحساب فقط</span>
              </div>
              <p class="text-[10.5px] text-slate-100">
                يجب أن يتم التحويل من محفظة إلكترونية أو حساب إنستا باي أو حساب بنكي مسجّل <b>باسم صاحب هذا الحساب (${app.esc(holderName)})</b> فقط. يُرفض أي إيداع محوّل من حساب شخص آخر.
              </p>
              <label class="flex items-start gap-2 pt-1.5 border-t border-rose-500/35 text-[10.5px] font-black text-amber-200 cursor-pointer">
                <input type="checkbox" required class="accent-amber-500 mt-0.5 shrink-0" />
                <span>أقرّ بأن التحويل تم من رقم أو حساب مسجّل باسمي الشخصي (${app.esc(holderName)}) وليس من حساب شخص آخر.</span>
              </label>
            </div>

            <div class="daman-modal-sla-notice p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-[10.5px] text-amber-100 leading-relaxed">
              <b class="text-amber-300">⏱️ مدة التنفيذ:</b> يتم مراجعة إيصال التحويل وإضافة الرصيد إلى محفظتك خلال <b>${app.esc(slaText)}</b>.
            </div>

            <button type="submit" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20">
              <i class="fa-solid fa-paper-plane me-1"></i> إرسال طلب الإيداع
            </button>
          </form>
        </div>`;

      this.startDepositCountdown();
      this.updateDepositMethodUI();
      await this.loadAllSettings();
      this.updateDepositMethodUI();
    },

    compressReceiptImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('ملف الصورة غير صالح'));
          img.onload = () => {
            const maxSide = 1100;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.78));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async handleReceiptFileChange(inp) {
      const app = window.DamanApp;
      const file = inp.files && inp.files[0];
      const previewBox = document.getElementById('daman-dep-receipt-preview');
      if (!file) {
        this._receiptDataUrl = '';
        if (previewBox) previewBox.innerHTML = '';
        return;
      }
      try {
        if (previewBox) previewBox.innerHTML = `<div class="text-amber-300 text-[10.5px] font-bold">جارٍ تجهيز صورة الإيصال...</div>`;
        const dataUrl = await this.compressReceiptImage(file);
        this._receiptDataUrl = dataUrl;
        if (previewBox) {
          previewBox.innerHTML = `
            <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40">
              <span class="text-emerald-300 font-black text-[10.5px]">✅ تم إرفاق صورة الإيصال بنجاح</span>
              <button type="button" onclick="DamanLightbox.open(DamanWalletMethods._receiptDataUrl, 'معاينة إيصال التحويل')" class="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 text-[10px] font-black">معاينة</button>
            </div>`;
        }
      } catch (err) {
        this._receiptDataUrl = '';
        if (previewBox) previewBox.innerHTML = '';
        app.toast(err.message || 'تعذر معالجة صورة الإيصال', 'error');
      }
    },

    async submitDeposit(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app || !app.user) return;
      if (this._depositSecondsLeft <= 0) {
        this.closeDepositModal();
        return app.toast('⏳ انتهت مدة الـ 10 دقائق للجلسة — أعد فتح نافذة الإيداع.', 'warning');
      }

      const method = document.getElementById('daman-dep-method')?.value || 'wallet';
      const amount = Math.round((parseFloat(document.getElementById('daman-dep-amount')?.value) || 0) * 100) / 100;
      const sender = (document.getElementById('daman-dep-sender')?.value || '').trim();
      const rawRef = (document.getElementById('daman-dep-ref')?.value || '').trim();
      const minDep = Number(app.appConfig?.minDeposit || 10);

      if (amount < minDep) return app.toast(`الحد الأدنى للإيداع هو ${app.fmtMoney(minDep)} ج.م`, 'error');
      if (!sender || sender.length < 4) return app.toast('يرجى إدخال الرقم أو الحساب المحوّل منه', 'error');
      if (!this._receiptDataUrl) return app.toast('يرجى إرفاق صورة إيصال التحويل أولاً', 'error');

      await app.withLock('submitDepositV49', async () => {
        try {
          const cleanRef = rawRef ? rawRef.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : '';
          if (cleanRef) {
            const refDoc = await app.db.collection('txRefIndex').doc(cleanRef).get().catch(() => null);
            if (refDoc && refDoc.exists) {
              return app.toast('⚠️ هذا الرقم المرجعي مستخدم من قبل! تأكد من الرقم أو اتركه فارغاً.', 'error');
            }
            await app.db.collection('txRefIndex').doc(cleanRef).set({
              userId: app.user.uid,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
          }

          const mediaRef = await app.db.collection('mediaVault').add({
            ownerId: app.user.uid,
            kind: 'deposit_receipt',
            base64: this._receiptDataUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          const methodLabels = { wallet: 'محفظة إلكترونية', instapay: 'إنستا باي', bank: '🏦 حساب بنكي' };
          const holderName = this.getHolderName(app);
          const today = app.todayLocal();

          await app.db.collection('walletRequests').add({
            userId: app.user.uid,
            userName: holderName,
            userPhone: app.profile?.phone || '',
            type: 'deposit',
            method,
            methodLabel: methodLabels[method] || method,
            amount,
            senderAccount: sender,
            targetAccount: sender,
            txRef: cleanRef || 'بدون رقم مرجعي',
            receiptMediaId: mediaRef.id,
            receiptBase64: this._receiptDataUrl,
            sameOwnerConfirmed: true,
            status: 'pending',
            date: today,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          await app.sendNotification(
            'ADMIN',
            '📥 طلب إيداع جديد بانتظار المراجعة',
            `${holderName} أرسل طلب إيداع بمبلغ ${app.fmtMoney(amount)} ج.م عبر ${methodLabels[method] || method}.`
          ).catch(() => {});

          this.closeDepositModal();
          this._receiptDataUrl = '';
          app.toast(`تم إرسال طلب الإيداع (${app.fmtMoney(amount)} ج.م) — يتم التنفيذ خلال ${this.getSlaDuration()} ✅`, 'success');
          if (app.activeTab === 'wallet') app.renderCurrentTab();
        } catch (err) {
          app.toast('حدث خطأ أثناء إرسال الإيداع: ' + err.message, 'error');
        }
      });
    },

    updateWithdrawMethodUI() {
      const method = document.getElementById('daman-wd-method')?.value || 'wallet';
      const standardBox = document.getElementById('daman-wd-standard-box');
      const bankBox = document.getElementById('daman-wd-bank-box');
      const stdInp = document.getElementById('daman-wd-target');
      const stdLbl = document.getElementById('daman-wd-target-lbl');
      const holderInp = document.getElementById('daman-wd-bank-holder');
      const ibanInp = document.getElementById('daman-wd-bank-iban');

      if (!standardBox || !bankBox) return;

      if (method === 'bank') {
        standardBox.classList.add('hidden');
        bankBox.classList.remove('hidden');
        if (stdInp) stdInp.required = false;
        if (holderInp) holderInp.required = true;
        if (ibanInp) ibanInp.required = true;
      } else {
        bankBox.classList.add('hidden');
        standardBox.classList.remove('hidden');
        if (stdInp) stdInp.required = true;
        if (holderInp) holderInp.required = false;
        if (ibanInp) ibanInp.required = false;

        if (stdLbl && stdInp) {
          if (method === 'instapay') {
            stdLbl.textContent = '2. عنوان أو رقم حساب إنستا باي (IPA / رقم الموبايل المربوط) *';
            stdInp.placeholder = 'مثال: username@instapay أو 010xxxxxxxx';
          } else {
            stdLbl.textContent = '2. رقم المحفظة الإلكترونية المستلمة *';
            stdInp.placeholder = 'مثال: 010xxxxxxxx (11 رقم)';
          }
        }
      }
    },

    async openWithdrawModal() {
      const app = window.DamanApp;
      if (!app) return;
      if (!app.user) return app.openAuthModal?.();

      const isFrozen = app.profile?.status === 'frozen' || !!app.profile?.frozen;
      if (isFrozen) {
        return app.toast('❄️ حسابك مجمّد مؤقتاً — لا يمكن السحب لحين انتهاء المراجعة الإدارية.', 'error');
      }

      if (app.appConfig?.requireKycForWithdraw && app.profile?.kycStatus !== 'verified') {
        app.toast('يرجى توثيق الحساب بالبطاقة الشخصية أولاً قبل طلب السحب.', 'warning');
        return window.DamanWallet?.openKycModal?.(false);
      }

      await this.loadAllSettings();

      const avail = Number(app.profile?.balanceAvailable || 0);
      const minWd = Number(app.appConfig?.minWithdraw || 50);
      const holderName = this.getHolderName(app);
      const slaText = this.getSlaDuration();
      const w = this.config.withdraw;

      const options = [];
      if (w.wallet !== false) options.push('<option value="wallet">📱 محفظة إلكترونية (فودافون / اتصالات / أورنج / وي كاش)</option>');
      if (w.instapay !== false) options.push('<option value="instapay">⚡ إنستا باي (InstaPay)</option>');
      if (w.bank !== false) options.push('<option value="bank">🏦 تحويل إلى حساب بنكي (IBAN / رقم حساب)</option>');

      let m = document.getElementById('daman-withdraw-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-withdraw-modal';
        m.className = 'daman-modal fixed inset-0 z-[95] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'withdrawModal' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-sky-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-sky-400"><i class="fa-solid fa-circle-arrow-up me-1"></i> سحب</h3>
            <button type="button" onclick="document.getElementById('daman-withdraw-modal').classList.add('hidden')" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between">
            <span class="text-slate-300 font-bold">الرصيد المتاح للسحب حالياً:</span>
            <b class="text-sm text-emerald-400">${app.fmtMoney(avail)} ج.م</b>
          </div>

          <form onsubmit="DamanWalletMethods.submitWithdraw(event)" class="space-y-3">
            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">1. اختر وسيلة السحب المستلمة *</label>
              <select id="daman-wd-method" onchange="DamanWalletMethods.updateWithdrawMethodUI()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-black">
                ${options.join('')}
              </select>
            </div>

            <div id="daman-wd-standard-box">
              <label id="daman-wd-target-lbl" class="block text-[10.5px] text-slate-300 font-bold mb-1">2. رقم المحفظة الإلكترونية المستلمة *</label>
              <input id="daman-wd-target" type="text" required value="${app.esc(app.profile?.phone || '')}" placeholder="010xxxxxxxx" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div id="daman-wd-bank-box" class="hidden p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2">
              <div class="font-black text-emerald-300 text-[11px]">🏦 بيانات الحساب البنكي المستلم (باسم صاحب الحساب فقط):</div>
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">اسم البنك *</label>
                <select id="daman-wd-bank-name" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold">
                  ${this.EGYPT_BANKS.map((b) => `<option value="${app.esc(b)}">${app.esc(b)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">اسم صاحب الحساب البنكي بالكامل (مطابق لاسمك في التطبيق) *</label>
                <input id="daman-wd-bank-holder" type="text" value="${app.esc(holderName)}" placeholder="الاسم ثلاثي أو رباعي" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">رقم الحساب البنكي أو رقم الـ IBAN *</label>
                <input id="daman-wd-bank-iban" type="text" dir="ltr" placeholder="EG00 0000 0000 0000 0000 0000 000" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-black" />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-[10.5px] text-slate-300 font-bold">3. المبلغ المطلوب سحبه (ج.م) *</label>
                ${avail >= minWd ? `<button type="button" onclick="document.getElementById('daman-wd-amount').value=${Math.floor(avail)}" class="text-[10px] font-black text-emerald-400">سحب الكل</button>` : ''}
              </div>
              <input id="daman-wd-amount" type="number" min="${minWd}" max="${Math.floor(avail)}" step="1" required placeholder="الحد الأدنى ${minWd} ج.م" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-black text-base text-center" />
            </div>

            <div class="p-3 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 text-[11px] leading-relaxed space-y-2">
              <div class="font-black text-rose-300 flex items-center gap-1.5">
                <i class="fa-solid fa-user-check"></i>
                <span>🛡️ تنبيه إلزامي: السحب بنفس اسم صاحب الحساب فقط</span>
              </div>
              <p class="text-[10.5px] text-slate-100">
                يجب أن يكون رقم المحفظة أو حساب إنستا باي أو الحساب البنكي المستلم مسجّلاً <b>باسم صاحب هذا الحساب (${app.esc(holderName)})</b> فقط. لا يُسمح بالتحويل لحسابات أطراف أخرى.
              </p>
              <label class="flex items-start gap-2 pt-1.5 border-t border-rose-500/35 text-[10.5px] font-black text-amber-200 cursor-pointer">
                <input type="checkbox" required class="accent-amber-500 mt-0.5 shrink-0" />
                <span>أقرّ بأن الرقم أو الحساب البنكي المكتوب صحيح 100% ومسجّل باسمي الشخصي (${app.esc(holderName)}) وليس باسم شخص آخر.</span>
              </label>
            </div>

            <div class="daman-modal-sla-notice p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-[10.5px] text-amber-100 leading-relaxed">
              <b class="text-amber-300">⏱️ مدة التنفيذ:</b> يتم مراجعة طلب السحب وتحويل المبلغ إلى حسابك خلال <b>${app.esc(slaText)}</b>.
            </div>

            <button type="submit" class="w-full py-3 rounded-2xl bg-sky-500 text-slate-950 font-black text-xs shadow-lg shadow-sky-500/20">
              <i class="fa-solid fa-paper-plane me-1"></i> تأكيد وإرسال طلب السحب
            </button>
          </form>
        </div>`;

      this.updateWithdrawMethodUI();
    },

    async submitWithdraw(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app || !app.user) return;

      const method = document.getElementById('daman-wd-method')?.value || 'wallet';
      const amount = Math.round((parseFloat(document.getElementById('daman-wd-amount')?.value) || 0) * 100) / 100;
      const avail = Number(app.profile?.balanceAvailable || 0);
      const minWd = Number(app.appConfig?.minWithdraw || 50);

      if (amount < minWd) return app.toast(`الحد الأدنى للسحب هو ${app.fmtMoney(minWd)} ج.م`, 'error');
      if (amount > avail) return app.toast('الرصيد المتاح في محفظتك غير كافٍ لإتمام هذا السحب', 'error');

      let targetAccount = '';
      let bankName = '';
      let bankHolderName = '';
      let bankIban = '';

      if (method === 'bank') {
        bankName = (document.getElementById('daman-wd-bank-name')?.value || '').trim();
        bankHolderName = (document.getElementById('daman-wd-bank-holder')?.value || '').trim();
        bankIban = (document.getElementById('daman-wd-bank-iban')?.value || '').trim();
        if (bankHolderName.length < 4) return app.toast('يرجى كتابة اسم صاحب الحساب البنكي بالكامل', 'error');
        if (bankIban.length < 8) return app.toast('يرجى كتابة رقم الحساب البنكي أو الـ IBAN بشكل صحيح', 'error');
        targetAccount = `🏦 ${bankName} | الاسم: ${bankHolderName} | حساب/IBAN: ${bankIban}`;
      } else {
        targetAccount = (document.getElementById('daman-wd-target')?.value || '').trim();
        if (targetAccount.length < 5) return app.toast('يرجى كتابة رقم المحفظة أو حساب إنستا باي بشكل صحيح', 'error');
      }

      await app.withLock('submitWithdrawV49', async () => {
        try {
          const holderName = this.getHolderName(app);
          const today = app.todayLocal();
          const methodLabels = { wallet: 'محفظة إلكترونية', instapay: 'إنستا باي', bank: '🏦 حساب بنكي' };

          const batch = app.db.batch();
          const userRef = app.db.collection('users').doc(app.user.uid);
          const reqRef = app.db.collection('walletRequests').doc();
          const txRef = app.db.collection('transactions').doc();

          batch.update(userRef, {
            balanceAvailable: firebase.firestore.FieldValue.increment(-amount),
            balancePendingWithdraw: firebase.firestore.FieldValue.increment(amount)
          });

          batch.set(reqRef, {
            userId: app.user.uid,
            userName: holderName,
            userPhone: app.profile?.phone || '',
            type: 'withdraw',
            method,
            methodLabel: methodLabels[method] || method,
            amount,
            targetAccount,
            bankName,
            bankHolderName,
            bankIban,
            sameOwnerConfirmed: true,
            status: 'pending',
            date: today,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          batch.set(txRef, {
            userId: app.user.uid,
            type: 'withdraw_request',
            amount: -amount,
            status: 'pending',
            note: `طلب سحب (${methodLabels[method] || method}) — ${targetAccount}`,
            date: today,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          await batch.commit();

          await app.sendNotification(
            'ADMIN',
            '📤 طلب سحب جديد',
            `${holderName} طلب سحب ${app.fmtMoney(amount)} ج.م عبر ${methodLabels[method] || method} (${targetAccount}).`
          ).catch(() => {});

          document.getElementById('daman-withdraw-modal')?.classList.add('hidden');
          app.toast(`تم إرسال طلب السحب (${app.fmtMoney(amount)} ج.م) — يتم التحويل خلال ${this.getSlaDuration()} ✅`, 'success');
          if (app.activeTab === 'wallet') app.renderCurrentTab();
        } catch (err) {
          app.toast('تعذر إرسال طلب السحب: ' + err.message, 'error');
        }
      });
    },

    injectWalletScreenOwnershipNotice() {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'wallet') return;
      const main = document.getElementById('app-main');
      if (!main) return;

      this.cleanDepositWithdrawButtons();

      if (!document.getElementById('daman-wallet-owner-rule-banner')) {
        const root = main.firstElementChild || main;
        const holderName = this.getHolderName(app);

        const card = document.createElement('div');
        card.id = 'daman-wallet-owner-rule-banner';
        card.className = 'mb-3 p-3 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 text-xs space-y-1 shadow-lg';
        card.innerHTML = `
          <div class="font-black text-rose-300 flex items-center gap-1.5">
            <i class="fa-solid fa-user-shield text-sm"></i>
            <span>🛡️ شرط أساسي للإيداع والسحب (نفس صاحب الحساب فقط)</span>
          </div>
          <p class="text-[10.5px] text-slate-100 leading-relaxed">
            يُشترط أن يتم <b>الإيداع أو السحب</b> من وإلى محفظة إلكترونية أو حساب إنستا باي أو حساب بنكي مسجّل <b>باسم صاحب الحساب نفسه (${app.esc(holderName)})</b>. يُرفض أي تحويل من أو إلى رقم أو حساب يخص شخصاً آخر.
          </p>`;

        const slaBanner = document.getElementById('daman-wallet-sla-banner');
        if (slaBanner && slaBanner.parentNode === root) root.insertBefore(card, slaBanner.nextSibling);
        else root.insertBefore(card, root.firstElementChild);
      }
    },

    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.loadAllSettings();

      if (window.DamanWallet) {
        DamanWallet.openDepositModal = () => this.openDepositModal();
        DamanWallet.openWithdrawModal = () => this.openWithdrawModal();
      }

      document.addEventListener('click', (ev) => {
        const btn = ev.target && ev.target.closest && ev.target.closest('button');
        if (!btn || btn.closest('.daman-modal')) return;
        const oc = btn.getAttribute('onclick') || '';
        if (oc.includes('openDepositModal')) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          this.openDepositModal();
        } else if (oc.includes('openWithdrawModal')) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          this.openWithdrawModal();
        }
      }, true);

      if (typeof app.renderCurrentTab === 'function' && !app._pmcWalletTabHooked) {
        app._pmcWalletTabHooked = true;
        const origRenderTab = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRenderTab();
          setTimeout(() => {
            this.cleanDepositWithdrawButtons();
            this.harvestAccountsFromAdminDOM();
            if (app.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
          }, 80);
        };
      }

      const mainEl = document.getElementById('app-main');
      if (mainEl && typeof MutationObserver !== 'undefined') {
        const obs = new MutationObserver(() => {
          this.cleanDepositWithdrawButtons();
          this.harvestAccountsFromAdminDOM();
        });
        obs.observe(mainEl, { childList: true, subtree: true });
      }

      setTimeout(() => {
        if (window.DamanWallet) {
          DamanWallet.openDepositModal = () => this.openDepositModal();
          DamanWallet.openWithdrawModal = () => this.openWithdrawModal();
        }
        this.cleanDepositWithdrawButtons();
        this.harvestAccountsFromAdminDOM();
        if (app.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
      }, 650);
    }
  };

  window.DamanWalletMethods = DepositWithdrawEngine;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => DepositWithdrawEngine.boot(), 650));
  else setTimeout(() => DepositWithdrawEngine.boot(), 650);
})();
