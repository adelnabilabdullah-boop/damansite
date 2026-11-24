(function () {
  const WalletMethodsSync = {
    _booted: false,
    _obs: null,
    _timer: null,
    _unsubConfig: null,
    config: {
      deposit: { wallet: true, instapay: true, bank: true },
      withdraw: { wallet: true, instapay: true, bank: true }
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
      'بنك المشرق',
      'بنك آخر'
    ],

    getHolderName(app) {
      const a = app || window.DamanApp;
      if (!a || !a.profile) return 'صاحب الحساب المسجّل';
      return (a.profile.legalName || a.profile.name || a.profile.companyName || 'صاحب الحساب المسجّل').trim();
    },

    clearLegacyBackups() {
      try {
        localStorage.removeItem('damansite_insta_backup_v52');
        localStorage.removeItem('damansite_insta_backup_v53');
      } catch (e) {}
    },

    // ==================== 1. REAL-TIME SYNC WITH FIRESTORE & ADMIN TOGGLES ====================
    startConfigListener() {
      const app = window.DamanApp;
      if (!app || !app.db) return;

      if (this._unsubConfig) {
        try { this._unsubConfig(); } catch (e) {}
      }

      this._unsubConfig = app.db
        .collection('settings')
        .doc('paymentMethodsControl')
        .onSnapshot(
          (snap) => {
            if (snap.exists) {
              const d = snap.data() || {};
              if (d.deposit) this.config.deposit = Object.assign({}, this.config.deposit, d.deposit);
              if (d.withdraw) this.config.withdraw = Object.assign({}, this.config.withdraw, d.withdraw);
              this.syncAdminCheckboxesFromConfig();
              this.scanOpenModals();
            }
          },
          () => {}
        );
    },

    async persistConfigToFirestore(silent = false) {
      const app = window.DamanApp;
      if (!app || !app.db || !app.isAdmin || !app.isAdmin()) return;

      const d = this.config.deposit;
      const w = this.config.withdraw;

      if (!d.wallet && !d.instapay && !d.bank) {
        d.wallet = true;
        this.syncAdminCheckboxesFromConfig();
        return app.toast('يجب إبقاء وسيلة إيداع واحدة مفعّلة على الأقل!', 'error');
      }
      if (!w.wallet && !w.instapay && !w.bank) {
        w.wallet = true;
        this.syncAdminCheckboxesFromConfig();
        return app.toast('يجب إبقاء وسيلة سحب واحدة مفعّلة على الأقل!', 'error');
      }

      try {
        await app.db.collection('settings').doc('paymentMethodsControl').set(
          {
            deposit: { wallet: !!d.wallet, instapay: !!d.instapay, bank: !!d.bank },
            withdraw: { wallet: !!w.wallet, instapay: !!w.instapay, bank: !!w.bank },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: app.user?.uid || ''
          },
          { merge: true }
        );

        // Also mirror into appConfig so original admin-ext / wallet-ops stay aligned
        await app.db.collection('settings').doc('appConfig').set(
          {
            enableDepositCash: !!d.wallet,
            enableDepositInstapay: !!d.instapay,
            enableDepositBank: !!d.bank,
            enableWithdrawCash: !!w.wallet,
            enableWithdrawInstapay: !!w.instapay,
            enableWithdrawBank: !!w.bank,
            depositMethods: { wallet: !!d.wallet, instapay: !!d.instapay, bank: !!d.bank },
            withdrawMethods: { wallet: !!w.wallet, instapay: !!w.instapay, bank: !!w.bank }
          },
          { merge: true }
        ).catch(() => {});

        if (!silent) {
          const depCnt = Object.values(d).filter(Boolean).length;
          const wdCnt = Object.values(w).filter(Boolean).length;
          app.toast(`تم ربط وتحديث وسائل الإيداع (${depCnt}) والسحب (${wdCnt}) بنجاح ✅`, 'success');
        }
      } catch (e) {}
    },

    // Map the 6 existing checkboxes inside Admin "محوّل الحسابات"
    findAdminToggleCheckboxes() {
      const main = document.getElementById('app-main');
      if (!main) return null;

      const map = {
        depWallet: null,
        depInstapay: null,
        depBank: null,
        wdWallet: null,
        wdInstapay: null,
        wdBank: null
      };

      let foundAny = false;
      main.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        const container = cb.closest('label') || cb.parentElement;
        if (!container) return;
        const txt = (container.textContent || '').replace(/\s+/g, ' ').trim();

        if (txt.includes('إيداع كاش') || txt.includes('ايداع كاش') || txt.includes('إيداع محفظ')) {
          map.depWallet = cb; foundAny = true;
        } else if (txt.includes('إيداع إنستا') || txt.includes('إيداع انستا') || txt.includes('ايداع انستا')) {
          map.depInstapay = cb; foundAny = true;
        } else if (txt.includes('إيداع بنك') || txt.includes('ايداع بنك')) {
          map.depBank = cb; foundAny = true;
        } else if (txt.includes('سحب كاش') || txt.includes('سحب محفظ')) {
          map.wdWallet = cb; foundAny = true;
        } else if (txt.includes('سحب إنستا') || txt.includes('سحب انستا')) {
          map.wdInstapay = cb; foundAny = true;
        } else if (txt.includes('سحب بنك')) {
          map.wdBank = cb; foundAny = true;
        }
      });

      return foundAny ? map : null;
    },

    syncAdminCheckboxesFromConfig() {
      const map = this.findAdminToggleCheckboxes();
      if (!map) return;
      if (map.depWallet) map.depWallet.checked = this.config.deposit.wallet !== false;
      if (map.depInstapay) map.depInstapay.checked = this.config.deposit.instapay !== false;
      if (map.depBank) map.depBank.checked = this.config.deposit.bank !== false;
      if (map.wdWallet) map.wdWallet.checked = this.config.withdraw.wallet !== false;
      if (map.wdInstapay) map.wdInstapay.checked = this.config.withdraw.instapay !== false;
      if (map.wdBank) map.wdBank.checked = this.config.withdraw.bank !== false;
    },

    wireAdminAccountsToggles() {
      const app = window.DamanApp;
      if (!app || !app.isAdmin || !app.isAdmin()) return;

      const main = document.getElementById('app-main');
      if (!main) return;

      // Clean "(3) والسحب (2)" header inside محوّل الحسابات
      main.querySelectorAll('h1, h2, h3, h4, div, span').forEach((el) => {
        if (el.children.length === 0) {
          const t = (el.textContent || '').trim();
          if (t.includes('تشغيل / إيقاف وسائل الإيداع') && t.includes('(2)')) {
            el.textContent = '🎛️ تشغيل / إيقاف وسائل الإيداع والسحب';
          }
        }
      });

      const map = this.findAdminToggleCheckboxes();
      if (!map) return;

      const entries = [
        [map.depWallet, 'deposit', 'wallet'],
        [map.depInstapay, 'deposit', 'instapay'],
        [map.depBank, 'deposit', 'bank'],
        [map.wdWallet, 'withdraw', 'wallet'],
        [map.wdInstapay, 'withdraw', 'instapay'],
        [map.wdBank, 'withdraw', 'bank']
      ];

      let newlyBound = false;
      entries.forEach(([cb, group, key]) => {
        if (!cb || cb.dataset.pmcSyncedV54) return;
        cb.dataset.pmcSyncedV54 = '1';
        newlyBound = true;

        cb.addEventListener('change', () => {
          this.config[group][key] = !!cb.checked;
          this.persistConfigToFirestore(false);
        });
      });

      if (newlyBound) {
        this.syncAdminCheckboxesFromConfig();
      }
    },

    // ==================== 2. CLEAN BUTTON LABELS: STRICTLY "إيداع" & "سحب" ====================
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

    // ==================== 3. WALLET SCREEN SAME-OWNER BANNER & BANK HISTORY LABEL ====================
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

      this.fixBankLabelsInDOM(main);
    },

    fixBankLabelsInDOM(rootEl) {
      if (!rootEl) return;
      rootEl.querySelectorAll('.glass-card, .rounded-xl, .rounded-2xl').forEach((card) => {
        if (card.dataset.bankLabelFixed) return;
        const txt = card.textContent || '';
        if (txt.includes('حساب/IBAN:') && txt.includes('إنستا باي')) {
          card.dataset.bankLabelFixed = '1';
          card.querySelectorAll('span, div, b').forEach((el) => {
            if (el.children.length === 0 && el.textContent.trim() === 'إنستا باي') {
              el.textContent = '🏦 حساب بنكي';
            }
          });
        }
      });
    },

    // ==================== 4. ENHANCE ORIGINAL DEPOSIT & WITHDRAW MODALS (NON-DESTRUCTIVE) ====================
    detectModalKind(modal) {
      if (!modal) return '';
      const id = (modal.id || '').toLowerCase();
      if (id.includes('kyc') || id.includes('post') || id.includes('admin') || id.includes('u360') || id.includes('calc') || id.includes('qr') || id.includes('bday') || id.includes('health') || id.includes('notif') || id.includes('auth')) {
        return '';
      }
      if (id.includes('deposit') || id.includes('topup') || id.includes('charge')) return 'deposit';
      if (id.includes('withdraw') || id.includes('payout')) return 'withdraw';

      if (window.DamanWalletSLA && typeof DamanWalletSLA.detectModalKind === 'function') {
        const k = DamanWalletSLA.detectModalKind(modal);
        if (k) return k;
      }

      const header = modal.querySelector('h2, h3, h4');
      const form = modal.querySelector('form');
      if (!header || !form || !form.querySelector('input[type="number"]')) return '';
      const hTxt = (header.textContent || '').trim();
      if (hTxt.includes('إيداع') || hTxt.includes('شحن')) return 'deposit';
      if (hTxt.includes('سحب')) return 'withdraw';
      return '';
    },

    classifyMethodText(val, txt) {
      const v = String(val || '').toLowerCase();
      const t = String(txt || '').toLowerCase();
      if (v.includes('insta') || t.includes('إنستا') || t.includes('انستا') || t.includes('instapay')) return 'instapay';
      if (v.includes('bank') || t.includes('بنك') || t.includes('iban')) return 'bank';
      if (v.includes('wallet') || v.includes('vodafone') || v.includes('cash') || t.includes('محفظ') || t.includes('فودافون') || t.includes('كاش')) return 'wallet';
      return '';
    },

    injectModalOwnershipNotice(form, kind) {
      const app = window.DamanApp;
      if (!app || !form) return;
      const holderName = this.getHolderName(app);
      const isDeposit = kind === 'deposit';

      if (!form.querySelector('.daman-same-owner-box')) {
        const box = document.createElement('div');
        box.className = 'daman-same-owner-box p-3 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 text-[11px] leading-relaxed space-y-2';
        box.innerHTML = `
          <div class="font-black text-rose-300 flex items-center gap-1.5">
            <i class="fa-solid fa-user-check"></i>
            <span>🛡️ تنبيه إلزامي: ${isDeposit ? 'الإيداع' : 'السحب'} بنفس اسم صاحب الحساب فقط</span>
          </div>
          <p class="text-[10.5px] text-slate-100">
            ${isDeposit
              ? `يجب أن يتم التحويل من محفظة إلكترونية أو حساب إنستا باي أو حساب بنكي مسجّل <b>باسم صاحب هذا الحساب (${app.esc(holderName)})</b> فقط. يُرفض أي إيداع محوّل من حساب شخص آخر.`
              : `يجب أن يكون رقم المحفظة أو حساب إنستا باي أو الحساب البنكي المستلم مسجّلاً <b>باسم صاحب هذا الحساب (${app.esc(holderName)})</b> فقط. لا يُسمح بالتحويل لحسابات أطراف أخرى.`}
          </p>
          <label class="flex items-start gap-2 pt-1.5 border-t border-rose-500/35 text-[10.5px] font-black text-amber-200 cursor-pointer">
            <input type="checkbox" required class="accent-amber-500 mt-0.5 shrink-0" />
            <span>
              ${isDeposit
                ? `أقرّ بأن التحويل تم من رقم أو حساب مسجّل باسمي الشخصي (${app.esc(holderName)}) وليس من حساب شخص آخر.`
                : `أقرّ بأن الرقم أو الحساب البنكي المكتوب صحيح 100% ومسجّل باسمي الشخصي (${app.esc(holderName)}) وليس باسم شخص آخر.`}
            </span>
          </label>`;

        const slaNotice = form.querySelector('.daman-modal-sla-notice');
        const submitBtn = form.querySelector('button[type="submit"]');
        if (slaNotice && slaNotice.parentNode === form) form.insertBefore(box, slaNotice);
        else if (submitBtn && submitBtn.parentNode === form) form.insertBefore(box, submitBtn);
        else form.appendChild(box);
      }

      if (!isDeposit) {
        const dupChk = form.querySelector('.daman-modal-sla-notice label');
        if (dupChk) dupChk.remove();
      }
    },

    applyMethodsToModal(modal, kind) {
      const form = modal.querySelector('form');
      if (!form) return;

      this.injectModalOwnershipNotice(form, kind);

      const enabledMap = kind === 'deposit' ? this.config.deposit : this.config.withdraw;

      // 1) Handle <select> dropdown if used by original modal
      const sel = form.querySelector('select');
      if (sel) {
        if (kind === 'withdraw') {
          this.ensureWithdrawBankOption(modal, form, sel);
        }

        let firstEnabledVal = '';
        Array.from(sel.options).forEach((opt) => {
          const mKind = this.classifyMethodText(opt.value, opt.textContent);
          if (!mKind) return;
          const allowed = enabledMap[mKind] !== false;
          opt.hidden = !allowed;
          opt.disabled = !allowed;
          if (allowed && !firstEnabledVal) firstEnabledVal = opt.value;
        });

        const curOpt = sel.options[sel.selectedIndex];
        if (curOpt && curOpt.disabled && firstEnabledVal) {
          sel.value = firstEnabledVal;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // 2) Handle method switcher buttons (if original modal uses buttons instead of <select>)
      modal.querySelectorAll('button[type="button"]').forEach((btn) => {
        if (btn.closest('.daman-quick-amts') || btn.closest('#daman-wd-bank-fields')) return;
        const oc = (btn.getAttribute('onclick') || '').toLowerCase();
        const txt = (btn.textContent || '').trim();
        if (txt.includes('نسخ') || txt.includes('سحب الكل') || txt.includes('إغلاق') || txt.includes('معاينة') || txt.includes('فتح')) return;
        if (!oc.includes('method') && !oc.includes('deposit') && !oc.includes('withdraw') && !btn.dataset.method) return;

        const mKind = this.classifyMethodText(btn.dataset.method || oc, txt);
        if (!mKind) return;
        const allowed = enabledMap[mKind] !== false;
        btn.classList.toggle('hidden', !allowed);
      });
    },

    findWithdrawAccountInput(form) {
      const inputs = Array.from(form.querySelectorAll('input[type="text"], input[type="tel"], input:not([type])'));
      for (const inp of inputs) {
        if (inp.closest('#daman-wd-bank-fields')) continue;
        const hay = `${inp.id || ''} ${inp.name || ''} ${inp.placeholder || ''}`.toLowerCase();
        if (hay.includes('acc') || hay.includes('target') || hay.includes('wallet') || hay.includes('phone') || hay.includes('ipa') || hay.includes('حساب') || hay.includes('رقم') || hay.includes('محفظ')) {
          return inp;
        }
      }
      return inputs.find((i) => !i.closest('#daman-wd-bank-fields')) || null;
    },

    ensureWithdrawBankOption(modal, form, sel) {
      const app = window.DamanApp;
      if (!app) return;

      let bankOpt = Array.from(sel.options).find((o) => this.classifyMethodText(o.value, o.textContent) === 'bank');
      if (!bankOpt) {
        bankOpt = document.createElement('option');
        bankOpt.value = 'bank';
        bankOpt.textContent = '🏦 تحويل إلى حساب بنكي (IBAN / رقم حساب)';
        sel.appendChild(bankOpt);
      }

      const accInp = this.findWithdrawAccountInput(form);
      if (!accInp) return;

      const holderName = this.getHolderName(app);
      let bankBox = form.querySelector('#daman-wd-bank-fields');

      if (!bankBox) {
        bankBox = document.createElement('div');
        bankBox.id = 'daman-wd-bank-fields';
        bankBox.className = 'hidden p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2 text-xs';
        bankBox.innerHTML = `
          <div class="font-black text-emerald-300 text-[11px]">🏦 بيانات الحساب البنكي المستلم (باسم صاحب الحساب فقط):</div>
          <div>
            <label class="block text-[10px] text-slate-300 mb-1">اسم البنك *</label>
            <select id="daman-wd-bank-name" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold">
              ${this.EGYPT_BANKS.map((b) => `<option value="${app.esc(b)}">${app.esc(b)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] text-slate-300 mb-1">اسم صاحب الحساب البنكي بالكامل (مطابق لاسمك في التطبيق) *</label>
            <input id="daman-wd-bank-holder" type="text" placeholder="الاسم ثلاثي أو رباعي" value="${app.esc(holderName)}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold" />
          </div>
          <div>
            <label class="block text-[10px] text-slate-300 mb-1">رقم الحساب البنكي أو رقم الـ IBAN *</label>
            <input id="daman-wd-bank-iban" type="text" dir="ltr" placeholder="EG00 0000 0000 0000 0000 0000 000" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-black" />
          </div>`;

        const anchor = accInp.parentElement && accInp.parentElement !== form ? accInp.parentElement : accInp;
        anchor.insertAdjacentElement('afterend', bankBox);

        const syncToHiddenAcc = () => {
          const curSel = sel.options[sel.selectedIndex];
          if (!curSel || this.classifyMethodText(curSel.value, curSel.textContent) !== 'bank') return;
          const bName = (form.querySelector('#daman-wd-bank-name')?.value || '').trim();
          const bHolder = (form.querySelector('#daman-wd-bank-holder')?.value || '').trim();
          const bIban = (form.querySelector('#daman-wd-bank-iban')?.value || '').trim();
          accInp.value = `🏦 ${bName} | الاسم: ${bHolder} | حساب/IBAN: ${bIban}`;
          accInp.dataset.bankSynced = '1';
        };

        bankBox.addEventListener('input', syncToHiddenAcc);
        bankBox.addEventListener('change', syncToHiddenAcc);
      }

      const toggleBankMode = () => {
        const curSel = sel.options[sel.selectedIndex];
        const isBank = !!(curSel && this.classifyMethodText(curSel.value, curSel.textContent) === 'bank');
        const accWrapper = accInp.parentElement && accInp.parentElement !== form ? accInp.parentElement : accInp;
        const hInp = form.querySelector('#daman-wd-bank-holder');
        const iInp = form.querySelector('#daman-wd-bank-iban');

        if (isBank) {
          bankBox.classList.remove('hidden');
          accWrapper.classList.add('hidden');
          accInp.required = false;
          if (hInp) hInp.required = true;
          if (iInp) iInp.required = true;
          const bName = (form.querySelector('#daman-wd-bank-name')?.value || '').trim();
          const bHolder = (hInp?.value || '').trim();
          const bIban = (iInp?.value || '').trim();
          accInp.value = `🏦 ${bName} | الاسم: ${bHolder} | حساب/IBAN: ${bIban}`;
          accInp.dataset.bankSynced = '1';
        } else {
          bankBox.classList.add('hidden');
          accWrapper.classList.remove('hidden');
          accInp.required = true;
          if (hInp) hInp.required = false;
          if (iInp) iInp.required = false;
          if (accInp.dataset.bankSynced === '1') {
            accInp.value = '';
            delete accInp.dataset.bankSynced;
          }
        }
      };

      if (!sel.dataset.wdBankModeBoundV54) {
        sel.dataset.wdBankModeBoundV54 = '1';
        sel.addEventListener('change', toggleBankMode);
      }
      toggleBankMode();

      if (!form.dataset.wdBankSubmitBoundV54) {
        form.dataset.wdBankSubmitBoundV54 = '1';
        form.addEventListener('submit', (ev) => {
          const curSel = sel.options[sel.selectedIndex];
          if (!curSel || this.classifyMethodText(curSel.value, curSel.textContent) !== 'bank') return;
          const bName = (form.querySelector('#daman-wd-bank-name')?.value || '').trim();
          const bHolder = (form.querySelector('#daman-wd-bank-holder')?.value || '').trim();
          const bIban = (form.querySelector('#daman-wd-bank-iban')?.value || '').trim();
          if (bHolder.length < 4) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return app.toast('يرجى كتابة اسم صاحب الحساب البنكي بالكامل', 'error');
          }
          if (bIban.length < 8) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return app.toast('يرجى كتابة رقم الحساب البنكي أو الـ IBAN بشكل صحيح', 'error');
          }
          accInp.value = `🏦 ${bName} | الاسم: ${bHolder} | حساب/IBAN: ${bIban}`;
        }, true);
      }
    },

    scanOpenModals() {
      document.querySelectorAll('.daman-modal:not(.hidden)').forEach((modal) => {
        const kind = this.detectModalKind(modal);
        if (kind === 'deposit' || kind === 'withdraw') {
          this.applyMethodsToModal(modal, kind);
        }
      });
    },

    // ==================== 5. BOOT ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.clearLegacyBackups();
      this.startConfigListener();

      if (window.DamanAdmin && typeof DamanAdmin.render === 'function' && !DamanAdmin._pmcHookedV54) {
        DamanAdmin._pmcHookedV54 = true;
        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          setTimeout(() => {
            this.wireAdminAccountsToggles();
            this.fixBankLabelsInDOM(container);
          }, 50);
        };
      }

      if (typeof app.renderCurrentTab === 'function' && !app._pmcTabHookedV54) {
        app._pmcTabHookedV54 = true;
        const origRenderTab = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRenderTab();
          setTimeout(() => {
            this.cleanDepositWithdrawButtons();
            if (app.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
            if (app.activeTab === 'admin') this.wireAdminAccountsToggles();
          }, 80);
        };
      }

      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(() => {
          clearTimeout(this._timer);
          this._timer = setTimeout(() => {
            this.cleanDepositWithdrawButtons();
            if (window.DamanApp?.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
            if (window.DamanApp?.activeTab === 'admin') this.wireAdminAccountsToggles();
            this.scanOpenModals();
          }, 70);
        });
        this._obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      setTimeout(() => {
        this.cleanDepositWithdrawButtons();
        if (app.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
        if (app.activeTab === 'admin') this.wireAdminAccountsToggles();
        this.scanOpenModals();
      }, 650);
    }
  };

  window.DamanWalletMethods = WalletMethodsSync;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => WalletMethodsSync.boot(), 650));
  else setTimeout(() => WalletMethodsSync.boot(), 650);
})();
