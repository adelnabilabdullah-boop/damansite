(function () {
  const DepositWithdrawEngine = {
    _booted: false,
    _receiptDataUrl: '',
    config: {
      deposit: { wallet: true, instapay: true, bank: true },
      withdraw: { wallet: true, instapay: true, bank: true }
    },
    accountsInfo: {},

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
      'بنك آخر'
    ],

    getHolderName(app) {
      const a = app || window.DamanApp;
      if (!a || !a.profile) return 'صاحب الحساب المسجّل';
      return (a.profile.legalName || a.profile.name || a.profile.companyName || 'صاحب الحساب المسجّل').trim();
    },

    getSlaDuration() {
      return window.DamanWalletSLA?.slaConfig?.durationText || 'يوم عمل واحد (24 ساعة عمل)';
    },

    // ==================== CLEAN BUTTON LABELS: "إيداع" & "سحب" ONLY ====================
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

    // ==================== 1. SMART LOADER FOR ALL SETTINGS & RECEIVING ACCOUNTS ====================
    async loadAllSettings() {
      const app = window.DamanApp;
      if (!app || !app.db) return;
      try {
        // Read entire settings collection (only ~4 small docs) so we NEVER miss where Admin saved the accounts!
        const settingsSnap = await app.db.collection('settings').get().catch(() => null);
        const merged = Object.assign({}, app.appConfig || {}, window.DamanWallet?.accounts || {});

        if (settingsSnap && !settingsSnap.empty) {
          settingsSnap.docs.forEach((doc) => {
            const d = doc.data() || {};
            if (doc.id === 'paymentMethodsControl') {
              if (d.deposit) this.config.deposit = Object.assign({}, this.config.deposit, d.deposit);
              if (d.withdraw) this.config.withdraw = Object.assign({}, this.config.withdraw, d.withdraw);
            } else {
              Object.keys(d).forEach((k) => {
                if (d[k] !== '' && d[k] !== null && d[k] !== undefined) {
                  merged[k] = d[k];
                }
              });
            }
          });
        }

        // Also check admin-ext / wallet cached account objects in window
        [window.DamanAdmin, window.DamanWallet, window.DamanApp].forEach((obj) => {
          if (!obj || typeof obj !== 'object') return;
          ['accounts', 'receivingAccounts', 'paymentAccounts', 'bankConfig', 'appConfig'].forEach((prop) => {
            if (obj[prop] && typeof obj[prop] === 'object') {
              Object.assign(merged, obj[prop]);
            }
          });
        });

        this.accountsInfo = merged;
      } catch (e) {}
    },

    pickFirstNonEmpty(obj, keys) {
      for (const k of keys) {
        const val = obj[k];
        if (typeof val === 'string' && val.trim()) return val.trim();
        if (typeof val === 'number' && val > 0) return String(val);
      }
      return '';
    },

    getReceivingAccountDetails(method) {
      const c = Object.assign({}, this.accountsInfo, window.DamanApp?.appConfig || {});

      if (method === 'wallet') {
        let num = this.pickFirstNonEmpty(c, [
          'vodafoneCash', 'vodafoneNumber', 'walletNumber', 'cashNumber', 'depositWallet',
          'etisalatCash', 'orangeCash', 'wePay', 'mobileWallet', 'walletPhone', 'receiveWallet',
          'activeWallet', 'accountWallet'
        ]);
        // Fallback: scan all values in settings for an Egyptian 010/011/012/015 number
        if (!num) {
          for (const [k, v] of Object.entries(c)) {
            if (typeof v === 'string' && /^01[0125]\d{8}$/.test(v.trim()) && !k.toLowerCase().includes('support') && !k.toLowerCase().includes('whatsapp')) {
              num = v.trim();
              break;
            }
          }
        }
        const name = this.pickFirstNonEmpty(c, ['walletHolderName', 'vodafoneName', 'walletName', 'walletOwner', 'receiverName']);
        return {
          title: '📱 التحويل إلى المحفظة الإلكترونية (فودافون / اتصالات / أورنج / وي كاش)',
          value: num || 'غير مسجّل بعد — أدخله من الإدارة ← محوّل الحسابات',
          extra: name ? `اسم المستلم: ${name}` : '',
          copyVal: num || ''
        };
      }

      if (method === 'instapay') {
        let ipa = this.pickFirstNonEmpty(c, [
          'instapayAddress', 'instapay', 'instapayId', 'instapayUser', 'instapayLink',
          'depositInstapay', 'ipa', 'ipaAddress', 'instapayPhone', 'activeInstapay'
        ]);
        if (!ipa) {
          for (const v of Object.values(c)) {
            if (typeof v === 'string' && v.toLowerCase().includes('@instapay')) {
              ipa = v.trim();
              break;
            }
          }
        }
        const name = this.pickFirstNonEmpty(c, ['instapayName', 'instapayHolder', 'instapayOwner', 'receiverName']);
        return {
          title: '⚡ التحويل عبر إنستا باي (InstaPay)',
          value: ipa || 'غير مسجّل بعد — أدخله من الإدارة ← محوّل الحسابات',
          extra: name ? `اسم الحساب: ${name}` : '',
          copyVal: ipa || ''
        };
      }

      // Bank account
      const bankName = this.pickFirstNonEmpty(c, ['bankName', 'depositBankName', 'activeBankName']) || 'الحساب البنكي المعتمد';
      let bankAcc = this.pickFirstNonEmpty(c, [
        'bankAccount', 'bankIban', 'iban', 'bankAccountNumber', 'accountNumber',
        'depositBank', 'bankAcc', 'activeBankAccount'
      ]);
      if (!bankAcc) {
        for (const v of Object.values(c)) {
          if (typeof v === 'string' && (/^EG\d{20,}/i.test(v.replace(/\s+/g, '')) || /^\d{12,24}$/.test(v.replace(/\s+/g, '')))) {
            bankAcc = v.trim();
            break;
          }
        }
      }
      const bankHolder = this.pickFirstNonEmpty(c, ['bankHolderName', 'bankHolder', 'bankAccountName', 'companyLegalName', 'receiverName']);
      return {
        title: `🏦 التحويل البنكي (${bankName})`,
        value: bankAcc || 'غير مسجّل بعد — أدخله من الإدارة ← محوّل الحسابات',
        extra: bankHolder ? `اسم صاحب الحساب: ${bankHolder}` : '',
        copyVal: bankAcc || ''
      };
    },

    async saveConfigFromAdmin(e) {
      if (e) e.preventDefault();
      const app = window.DamanApp;
      if (!app || !app.isAdmin()) return;

      const dep = {
        wallet: !!document.getElementById('pmc-dep-wallet')?.checked,
        instapay: !!document.getElementById('pmc-dep-instapay')?.checked,
        bank: !!document.getElementById('pmc-dep-bank')?.checked
      };
      const wd = {
        wallet: !!document.getElementById('pmc-wd-wallet')?.checked,
        instapay: !!document.getElementById('pmc-wd-instapay')?.checked,
        bank: !!document.getElementById('pmc-wd-bank')?.checked
      };

      if (!dep.wallet && !dep.instapay && !dep.bank) {
        return app.toast('يجب تفعيل وسيلة إيداع واحدة على الأقل!', 'error');
      }
      if (!wd.wallet && !wd.instapay && !wd.bank) {
        return app.toast('يجب تفعيل وسيلة سحب واحدة على الأقل!', 'error');
      }

      this.config.deposit = dep;
      this.config.withdraw = wd;

      await app.withLock('savePaymentMethodsCtrl', async () => {
        await app.db.collection('settings').doc('paymentMethodsControl').set({
          deposit: dep,
          withdraw: wd,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: app.user.uid
        }, { merge: true });

        const depCnt = Object.values(dep).filter(Boolean).length;
        const wdCnt = Object.values(wd).filter(Boolean).length;
        await app.logAudit('payment_methods_ctrl', `تحديث وسائل الإيداع (${depCnt}/3) والسحب (${wdCnt}/3)`);
        app.toast('تم حفظ وتفعيل إعدادات الإيداع والسحب بنجاح ✅', 'success');
      });
    },

    // ==================== 2. COMPRESS RECEIPT IMAGE ====================
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

    // ==================== 3. DEPOSIT MODAL ====================
    updateDepositMethodUI() {
      const app = window.DamanApp;
      const method = document.getElementById('daman-dep-method')?.value || 'wallet';
      const box = document.getElementById('daman-dep-target-box');
      if (!box || !app) return;

      const info = this.getReceivingAccountDetails(method);
      box.innerHTML = `
        <div class="text-[10.5px] font-black text-amber-300">${app.esc(info.title)}</div>
        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="min-w-0">
            <div class="text-xs font-black ${info.copyVal ? 'text-white' : 'text-rose-300'} select-all break-all" dir="ltr">${app.esc(info.value)}</div>
            ${info.extra ? `<div class="text-[10px] text-slate-300 mt-0.5">${app.esc(info.extra)}</div>` : ''}
          </div>
          ${info.copyVal ? `
            <button type="button" onclick="navigator.clipboard.writeText('${app.esc(info.copyVal).replace(/'/g, "\\'")}'); DamanApp.toast('تم النسخ بنجاح ✅','success')" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px] shrink-0">
              <i class="fa-regular fa-copy me-1"></i> نسخ
            </button>` : ''}
        </div>`;
    },

    async openDepositModal() {
      const app = window.DamanApp;
      if (!app) return;
      if (!app.user) return app.openAuthModal?.();

      await this.loadAllSettings();
      this._receiptDataUrl = '';

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
      try { history.pushState({ damanModal: 'depositModal' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-circle-arrow-down me-1"></i> إيداع</h3>
            <button type="button" onclick="document.getElementById('daman-deposit-modal').classList.add('hidden')" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form onsubmit="DamanWalletMethods.submitDeposit(event)" class="space-y-3">
            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">1. اختر وسيلة الإيداع *</label>
              <select id="daman-dep-method" onchange="DamanWalletMethods.updateDepositMethodUI()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black">
                ${options.join('')}
              </select>
            </div>

            <div id="daman-dep-target-box" class="p-3 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-1"></div>

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

      this.updateDepositMethodUI();
    },

    async submitDeposit(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app || !app.user) return;

      const method = document.getElementById('daman-dep-method')?.value || 'wallet';
      const amount = Math.round((parseFloat(document.getElementById('daman-dep-amount')?.value) || 0) * 100) / 100;
      const sender = (document.getElementById('daman-dep-sender')?.value || '').trim();
      const rawRef = (document.getElementById('daman-dep-ref')?.value || '').trim();
      const minDep = Number(app.appConfig?.minDeposit || 10);

      if (amount < minDep) return app.toast(`الحد الأدنى للإيداع هو ${app.fmtMoney(minDep)} ج.م`, 'error');
      if (!sender || sender.length < 4) return app.toast('يرجى إدخال الرقم أو الحساب المحوّل منه', 'error');
      if (!this._receiptDataUrl) return app.toast('يرجى إرفاق صورة إيصال التحويل أولاً', 'error');

      await app.withLock('submitDepositV45', async () => {
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

          document.getElementById('daman-deposit-modal')?.classList.add('hidden');
          this._receiptDataUrl = '';
          app.toast(`تم إرسال طلب الإيداع (${app.fmtMoney(amount)} ج.م) — يتم التنفيذ خلال ${this.getSlaDuration()} ✅`, 'success');
          if (app.activeTab === 'wallet') app.renderCurrentTab();
        } catch (err) {
          app.toast('حدث خطأ أثناء إرسال الإيداع: ' + err.message, 'error');
        }
      });
    },

    // ==================== 4. WITHDRAW MODAL ====================
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

      await app.withLock('submitWithdrawV45', async () => {
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

    // ==================== 5. WALLET SCREEN BANNER & ADMIN CONTROL CARD ====================
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

      main.querySelectorAll('.glass-card, .rounded-xl, .rounded-2xl').forEach((card) => {
        if (card.dataset.bankLabelFixed) return;
        const txt = card.textContent || '';
        if (txt.includes('حساب/IBAN:') && txt.includes('إنستا باي')) {
          card.dataset.bankLabelFixed = '1';
          card.querySelectorAll('span, div, b').forEach((el) => {
            if (el.children.length === 0 && el.textContent.trim() === 'إنستا باي') el.textContent = '🏦 حساب بنكي';
          });
        }
      });
    },

    renderAdminControlBox() {
      const d = this.config.deposit;
      const w = this.config.withdraw;
      return `
        <form id="daman-pmc-admin-box" onsubmit="DamanWalletMethods.saveConfigFromAdmin(event)" class="glass-card rounded-2xl p-3.5 border-2 border-emerald-500/50 space-y-3 text-xs mb-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-black text-emerald-400">🎛️ التحكم الكامل في وسائل الإيداع والسحب</h3>
              <p class="text-[10px] text-slate-300">فعّل أو أوقف أي وسيلة للإيداع وللسحب (بما فيها الحساب البنكي في السحب).</p>
            </div>
            <span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black shrink-0">تحكم مباشر</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div class="p-2.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2">
              <div class="font-black text-amber-300 text-[11px]">📥 وسائل الإيداع المفعّلة للمستخدمين:</div>
              <label class="flex items-center justify-between gap-2 text-[11px] text-white cursor-pointer">
                <span>📱 محفظة إلكترونية (كاش)</span>
                <input id="pmc-dep-wallet" type="checkbox" ${d.wallet ? 'checked' : ''} class="accent-amber-500 w-4 h-4" />
              </label>
              <label class="flex items-center justify-between gap-2 text-[11px] text-white cursor-pointer">
                <span>⚡ إنستا باي (InstaPay)</span>
                <input id="pmc-dep-instapay" type="checkbox" ${d.instapay ? 'checked' : ''} class="accent-amber-500 w-4 h-4" />
              </label>
              <label class="flex items-center justify-between gap-2 text-[11px] text-white cursor-pointer">
                <span>🏦 حساب بنكي (تحويل بنكي)</span>
                <input id="pmc-dep-bank" type="checkbox" ${d.bank ? 'checked' : ''} class="accent-amber-500 w-4 h-4" />
              </label>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-2">
              <div class="font-black text-sky-300 text-[11px]">📤 وسائل السحب المفعّلة للمستخدمين:</div>
              <label class="flex items-center justify-between gap-2 text-[11px] text-white cursor-pointer">
                <span>📱 محفظة إلكترونية (كاش)</span>
                <input id="pmc-wd-wallet" type="checkbox" ${w.wallet ? 'checked' : ''} class="accent-sky-500 w-4 h-4" />
              </label>
              <label class="flex items-center justify-between gap-2 text-[11px] text-white cursor-pointer">
                <span>⚡ إنستا باي (InstaPay)</span>
                <input id="pmc-wd-instapay" type="checkbox" ${w.instapay ? 'checked' : ''} class="accent-sky-500 w-4 h-4" />
              </label>
              <label class="flex items-center justify-between gap-2 text-[11px] text-emerald-300 font-bold cursor-pointer">
                <span>🏦 حساب بنكي (IBAN / رقم حساب)</span>
                <input id="pmc-wd-bank" type="checkbox" ${w.bank ? 'checked' : ''} class="accent-emerald-500 w-4 h-4" />
              </label>
            </div>
          </div>

          <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20">
            💾 حفظ وتفعيل إعدادات الإيداع والسحب فوراً
          </button>
        </form>`;
    },

    injectAdminAccountsControl(container, app) {
      if (!app || !app.isAdmin() || !container) return;
      if (document.getElementById('daman-pmc-admin-box')) return;

      const Adm = window.DamanAdmin;
      if (Adm && (Adm._viewingCategoriesTab || Adm._viewingKycVaultTab || Adm._viewingBdayTab || Adm._viewingBroadcastTab || Adm._viewingBanTab)) {
        return;
      }

      const tabBar = container.querySelector('.overflow-x-auto');
      if (!tabBar) return;

      const activeBtn = Array.from(tabBar.querySelectorAll('button')).find((b) =>
        (b.className || '').includes('bg-amber-500') || (b.className || '').includes('bg-purple-600')
      );
      const activeTxt = activeBtn ? (activeBtn.textContent || '') : '';
      if (Adm?.subTab === 'accounts' || activeTxt.includes('محوّل') || activeTxt.includes('الحسابات')) {
        if (tabBar.nextElementSibling) {
          tabBar.nextElementSibling.insertAdjacentHTML('afterbegin', this.renderAdminControlBox());
        }
      }
    },

    // ==================== 6. BOOT & HOOK ALL DEPOSIT / WITHDRAW TRIGGERS ====================
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

      if (window.DamanAdmin && typeof DamanAdmin.render === 'function' && !DamanAdmin._pmcHooked) {
        DamanAdmin._pmcHooked = true;
        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          setTimeout(() => this.injectAdminAccountsControl(container, a), 40);
        };
      }

      if (typeof app.renderCurrentTab === 'function' && !app._pmcWalletTabHooked) {
        app._pmcWalletTabHooked = true;
        const origRenderTab = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRenderTab();
          setTimeout(() => {
            this.cleanDepositWithdrawButtons();
            if (app.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
          }, 80);
        };
      }

      const mainEl = document.getElementById('app-main');
      if (mainEl && typeof MutationObserver !== 'undefined') {
        const obs = new MutationObserver(() => this.cleanDepositWithdrawButtons());
        obs.observe(mainEl, { childList: true, subtree: true });
      }

      setTimeout(() => {
        if (window.DamanWallet) {
          DamanWallet.openDepositModal = () => this.openDepositModal();
          DamanWallet.openWithdrawModal = () => this.openWithdrawModal();
        }
        this.cleanDepositWithdrawButtons();
        if (app.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
        if (app.activeTab === 'admin' && mainEl) this.injectAdminAccountsControl(mainEl, app);
      }, 650);
    }
  };

  window.DamanWalletMethods = DepositWithdrawEngine;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => DepositWithdrawEngine.boot(), 650));
  else setTimeout(() => DepositWithdrawEngine.boot(), 650);
})();
