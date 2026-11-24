(function () {
  const DamanSystemUnifier = {
    _booted: false,
    _obs: null,
    _timer: null,
    _unsubConfig: null,
    _hasSavedPmcDoc: false,
    _topVerifyTriggerEl: null,
    _topVerifyOnclick: '',
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

    // ==================== 1. UNIFY CONTRACT VERIFY (HIDE TOP BANNER -> POWER BOTTOM CARD) ====================
    findTopVerifyBanner(main) {
      if (!main) return null;
      const existing = main.querySelector('[data-daman-hidden-top-verify="1"]');
      if (existing) return existing;

      const candidates = Array.from(main.querySelectorAll('div, section, button'));
      let best = null;
      let bestLen = Infinity;

      for (const el of candidates) {
        if (el.id === 'app-main' || el.closest('.daman-modal')) continue;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt.length > 260) continue;
        const hasTitle = txt.includes('فحص والتحقق من أي عقد رسمي') || (txt.includes('كاميرا QR') && txt.includes('فحص الآن'));
        if (hasTitle && txt.length < bestLen) {
          best = el;
          bestLen = txt.length;
        }
      }
      return best;
    },

    syncHomeContractVerifyWiring() {
      const main = document.getElementById('app-main');
      if (!main) return;

      // 1) Find and hide the top verify banner while preserving its exact trigger
      const topBanner = this.findTopVerifyBanner(main);
      if (topBanner) {
        const triggerBtn =
          Array.from(topBanner.querySelectorAll('button, a')).find((b) => (b.textContent || '').includes('فحص الآن')) ||
          topBanner.querySelector('button[onclick]') ||
          (topBanner.tagName === 'BUTTON' || topBanner.getAttribute('onclick') ? topBanner : null);

        if (triggerBtn) {
          this._topVerifyTriggerEl = triggerBtn;
          const oc = triggerBtn.getAttribute('onclick') || topBanner.getAttribute('onclick') || '';
          if (oc) this._topVerifyOnclick = oc;
        }

        topBanner.dataset.damanHiddenTopVerify = '1';
        topBanner.style.setProperty('display', 'none', 'important');
        topBanner.setAttribute('aria-hidden', 'true');
      }

      // 2) Upgrade the bottom "فحص عقد رسمي" card text & mark it for unified rich modal
      const bottomTriggers = Array.from(main.querySelectorAll('button, a, div[onclick], .cursor-pointer'));
      for (const el of bottomTriggers) {
        if (el.closest('[data-daman-hidden-top-verify="1"]') || el.closest('.daman-modal')) continue;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt.length > 140) continue;
        if (txt.includes('فحص عقد رسمي') && !txt.includes('فحص والتحقق من أي عقد رسمي')) {
          el.dataset.damanBottomVerifyCard = '1';
          // Upgrade subtitle to clearly reflect full capabilities (QR Camera + Contract Code + Direct Entry)
          el.querySelectorAll('div, span, p').forEach((sub) => {
            if (sub.children.length === 0) {
              const st = (sub.textContent || '').trim();
              if (st === 'تحقق بكود العقد أو QR') {
                sub.textContent = 'كاميرا QR أو رقم العقد + دخول العقد';
              }
            }
          });
        }
      }
    },

    openUnifiedContractVerify() {
      // Priority 1: Invoke the exact preserved trigger from security-verify-ban.js (keeps all listeners & full UI)
      if (this._topVerifyTriggerEl && document.body.contains(this._topVerifyTriggerEl)) {
        try {
          this._topVerifyTriggerEl.click();
          return;
        } catch (e) {}
      }

      // Priority 2: Execute captured onclick handler from the top verify banner
      if (this._topVerifyOnclick) {
        try {
          new Function(this._topVerifyOnclick)();
          return;
        } catch (e) {}
      }

      // Priority 3: Dynamically locate and call the rich verify modal method on DamanSecurityMod
      const secMod = window.DamanSecurityMod;
      if (secMod && typeof secMod === 'object') {
        const preferred = [
          'openPublicVerifyModal',
          'openVerifyContractModal',
          'openContractVerifyModal',
          'openVerifyModal',
          'openVerificationModal',
          'openContractCheckerModal'
        ];
        const fnKey =
          preferred.find((k) => typeof secMod[k] === 'function') ||
          Object.keys(secMod).find((k) => typeof secMod[k] === 'function' && /open/i.test(k) && /(verify|contract|check|qr)/i.test(k));

        if (fnKey) {
          secMod[fnKey]();
          return;
        }
      }

      // Priority 4: Fallback to ShareQR / QR Scanner if SecurityMod isn't loaded
      if (window.DamanShareQR && typeof DamanShareQR.openVerifyModal === 'function') {
        DamanShareQR.openVerifyModal();
      } else if (window.DamanKycBdayQR && typeof DamanKycBdayQR.openQrScannerModal === 'function') {
        DamanKycBdayQR.openQrScannerModal();
      }
    },

    // ==================== 2. REAL-TIME SYNC WITH FIRESTORE & ADMIN 6 TOGGLES ====================
    startConfigListener() {
      const app = window.DamanApp;
      if (!app || !app.db) return;

      // Seed initial values from existing appConfig if present
      const ac = app.appConfig || {};
      if (typeof ac.enableDepositCash === 'boolean') this.config.deposit.wallet = ac.enableDepositCash;
      if (typeof ac.enableDepositInstapay === 'boolean') this.config.deposit.instapay = ac.enableDepositInstapay;
      if (typeof ac.enableDepositBank === 'boolean') this.config.deposit.bank = ac.enableDepositBank;
      if (typeof ac.enableWithdrawCash === 'boolean') this.config.withdraw.wallet = ac.enableWithdrawCash;
      if (typeof ac.enableWithdrawInstapay === 'boolean') this.config.withdraw.instapay = ac.enableWithdrawInstapay;
      if (typeof ac.enableWithdrawBank === 'boolean') this.config.withdraw.bank = ac.enableWithdrawBank;

      if (this._unsubConfig) {
        try { this._unsubConfig(); } catch (e) {}
      }

      this._unsubConfig = app.db
        .collection('settings')
        .doc('paymentMethodsControl')
        .onSnapshot(
          (snap) => {
            if (snap.exists) {
              this._hasSavedPmcDoc = true;
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
        this._hasSavedPmcDoc = true;
        await app.db.collection('settings').doc('paymentMethodsControl').set(
          {
            deposit: { wallet: !!d.wallet, instapay: !!d.instapay, bank: !!d.bank },
            withdraw: { wallet: !!w.wallet, instapay: !!w.instapay, bank: !!w.bank },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: app.user?.uid || ''
          },
          { merge: true }
        );

        await app.db.collection('settings').doc('appConfig').set(
          {
            enableDepositCash: !!d.wallet,
            enableDepositInstapay: !!d.instapay,
            enableDepositBank: !!d.bank,
            enableWithdrawCash: !!w.wallet,
            enableWithdrawInstapay: !!w.instapay,
            enableWithdrawBank: !!w.bank
          },
          { merge: true }
        ).catch(() => {});

        if (!silent) {
          const depCnt = Object.values(d).filter(Boolean).length;
          const wdCnt = Object.values(w).filter(Boolean).length;
          app.toast(`تم حفظ وتفعيل وسائل الإيداع (${depCnt}) والسحب (${wdCnt}) ✅`, 'success');
        }
      } catch (e) {}
    },

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
      if (!this._hasSavedPmcDoc) return;
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
        if (!cb || cb.dataset.pmcSyncedV55) return;
        cb.dataset.pmcSyncedV55 = '1';
        newlyBound = true;

        if (!this._hasSavedPmcDoc) {
          this.config[group][key] = !!cb.checked;
        }

        cb.addEventListener('change', () => {
          this.config[group][key] = !!cb.checked;
          this.persistConfigToFirestore(false);
        });
      });

      // Also hook the parent form submit in "محوّل الحسابات" to mirror all 6 toggles on Save
      const parentForm = (map.depWallet || map.wdBank)?.closest('form');
      if (parentForm && !parentForm.dataset.pmcFormSyncedV55) {
        parentForm.dataset.pmcFormSyncedV55 = '1';
        parentForm.addEventListener('submit', () => {
          entries.forEach(([cb, group, key]) => {
            if (cb) this.config[group][key] = !!cb.checked;
          });
          this.persistConfigToFirestore(true);
        });
      }

      if (newlyBound && this._hasSavedPmcDoc) {
        this.syncAdminCheckboxesFromConfig();
      }
    },

    // ==================== 3. CLEAN BUTTON LABELS: STRICTLY "إيداع" & "سحب" ====================
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

    // ==================== 4. WALLET SCREEN SAME-OWNER BANNER & BANK LABELS ====================
    injectWalletScreenOwnershipNotice() {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'wallet') return;
      const main = document.getElementById('app-main');
      if (!main) return;

      this.cleanDepositWithdrawButtons();

      const existingBanners = main.querySelectorAll('#daman-wallet-owner-rule-banner');
      if (existingBanners.length > 1) {
        existingBanners.forEach((b, idx) => { if (idx > 0) b.remove(); });
      } else if (existingBanners.length === 0) {
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
        if (txt.includes('حساب/IBAN:') && (txt.includes('إنستا باي') || txt.includes('محفظة إلكترونية'))) {
          card.dataset.bankLabelFixed = '1';
          card.querySelectorAll('span, div, b').forEach((el) => {
            if (el.children.length === 0) {
              const t = el.textContent.trim();
              if (t === 'إنستا باي' || t === 'محفظة إلكترونية') {
                el.textContent = '🏦 حساب بنكي';
              }
            }
          });
        }
      });
    },

    // ==================== 5. ENHANCE ORIGINAL DEPOSIT & WITHDRAW MODALS + DEDUP GUARD ====================
    detectModalKind(modal) {
      if (!modal) return '';
      const id = (modal.id || '').toLowerCase();
      if (id.includes('kyc') || id.includes('post') || id.includes('admin') || id.includes('u360') || id.includes('calc') || id.includes('qr') || id.includes('bday') || id.includes('health') || id.includes('notif') || id.includes('auth') || id.includes('verify')) {
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

    deduplicateModalElements(form) {
      if (!form) return;
      ['.daman-quick-amts', '.daman-same-owner-box', '.daman-modal-sla-notice'].forEach((selector) => {
        const list = form.querySelectorAll(selector);
        if (list.length > 1) {
          list.forEach((el, idx) => { if (idx > 0) el.remove(); });
        }
      });
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
      this.deduplicateModalElements(form);
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

    buildWithdrawBankFieldsBox(form, accInp) {
      const app = window.DamanApp;
      let bankBox = form.querySelector('#daman-wd-bank-fields');
      if (bankBox || !app) return bankBox;

      const holderName = this.getHolderName(app);
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

      const syncVal = () => {
        if (form.dataset.damanWdBankActive !== '1') return;
        const bName = (form.querySelector('#daman-wd-bank-name')?.value || '').trim();
        const bHolder = (form.querySelector('#daman-wd-bank-holder')?.value || '').trim();
        const bIban = (form.querySelector('#daman-wd-bank-iban')?.value || '').trim();
        accInp.value = `🏦 ${bName} | الاسم: ${bHolder} | حساب/IBAN: ${bIban}`;
        accInp.dataset.bankSynced = '1';
      };

      bankBox.addEventListener('input', syncVal);
      bankBox.addEventListener('change', syncVal);

      if (!form.dataset.wdBankSubmitBoundV55) {
        form.dataset.wdBankSubmitBoundV55 = '1';
        form.addEventListener('submit', (ev) => {
          if (form.dataset.damanWdBankActive !== '1') return;
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

      return bankBox;
    },

    setWithdrawBankMode(form, accInp, bankBox, isBank) {
      if (!form || !accInp || !bankBox) return;
      const accWrapper = accInp.parentElement && accInp.parentElement !== form ? accInp.parentElement : accInp;
      const hInp = form.querySelector('#daman-wd-bank-holder');
      const iInp = form.querySelector('#daman-wd-bank-iban');
      form.dataset.damanWdBankActive = isBank ? '1' : '0';

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
    },

    applyMethodsToModal(modal, kind) {
      const form = modal.querySelector('form');
      if (!form) return;

      this.injectModalOwnershipNotice(form, kind);

      const enabledMap = kind === 'deposit' ? this.config.deposit : this.config.withdraw;
      const sel = form.querySelector('select:not(#daman-wd-bank-name)');

      // Case A: Original modal uses a <select> dropdown
      if (sel) {
        let accInp = null;
        let bankBox = null;

        if (kind === 'withdraw') {
          let bankOpt = Array.from(sel.options).find((o) => this.classifyMethodText(o.value, o.textContent) === 'bank');
          if (!bankOpt) {
            bankOpt = document.createElement('option');
            bankOpt.value = 'bank';
            bankOpt.textContent = '🏦 تحويل إلى حساب بنكي (IBAN / رقم حساب)';
            sel.appendChild(bankOpt);
          }
          accInp = this.findWithdrawAccountInput(form);
          if (accInp) bankBox = this.buildWithdrawBankFieldsBox(form, accInp);
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

        if (kind === 'withdraw' && accInp && bankBox) {
          const syncMode = () => {
            const cOpt = sel.options[sel.selectedIndex];
            const isBank = !!(cOpt && this.classifyMethodText(cOpt.value, cOpt.textContent) === 'bank');
            this.setWithdrawBankMode(form, accInp, bankBox, isBank);
          };
          if (!sel.dataset.wdBankModeBoundV55) {
            sel.dataset.wdBankModeBoundV55 = '1';
            sel.addEventListener('change', syncMode);
          }
          syncMode();
        }
      }

      // Case B: Original modal uses method switcher buttons (e.g. Cash / InstaPay tabs)
      const methodBtns = Array.from(modal.querySelectorAll('button[type="button"]')).filter((btn) => {
        if (btn.closest('.daman-quick-amts') || btn.closest('#daman-wd-bank-fields')) return false;
        const txt = (btn.textContent || '').trim();
        if (txt.includes('نسخ') || txt.includes('سحب الكل') || txt.includes('إغلاق') || txt.includes('معاينة') || txt.includes('فتح')) return false;
        const oc = (btn.getAttribute('onclick') || '').toLowerCase();
        const mKind = this.classifyMethodText(btn.dataset.method || oc, txt);
        return !!mKind && (oc.includes('method') || oc.includes('deposit') || oc.includes('withdraw') || !!btn.dataset.method || btn.parentElement?.className.includes('grid'));
      });

      if (methodBtns.length >= 2) {
        const btnParent = methodBtns[0].parentElement;
        let accInp = kind === 'withdraw' ? this.findWithdrawAccountInput(form) : null;
        let bankBox = accInp ? this.buildWithdrawBankFieldsBox(form, accInp) : null;

        if (kind === 'withdraw' && btnParent && !btnParent.querySelector('[data-method="bank"]') && !methodBtns.some((b) => this.classifyMethodText(b.dataset.method || b.getAttribute('onclick'), b.textContent) === 'bank')) {
          const bankBtn = document.createElement('button');
          bankBtn.type = 'button';
          bankBtn.dataset.method = 'bank';
          bankBtn.className = 'px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-black text-[11px]';
          bankBtn.textContent = '🏦 حساب بنكي';
          btnParent.appendChild(bankBtn);
          methodBtns.push(bankBtn);

          bankBtn.addEventListener('click', () => {
            methodBtns.forEach((b) => b.classList.remove('border-emerald-400', 'bg-emerald-500/20', 'text-emerald-300'));
            bankBtn.classList.add('border-emerald-400', 'bg-emerald-500/20', 'text-emerald-300');
            if (accInp && bankBox) this.setWithdrawBankMode(form, accInp, bankBox, true);
          });

          methodBtns.forEach((b) => {
            if (b === bankBtn || b.dataset.wdNonBankBoundV55) return;
            b.dataset.wdNonBankBoundV55 = '1';
            b.addEventListener('click', () => {
              bankBtn.classList.remove('border-emerald-400', 'bg-emerald-500/20', 'text-emerald-300');
              if (accInp && bankBox) this.setWithdrawBankMode(form, accInp, bankBox, false);
            });
          });
        }

        methodBtns.forEach((btn) => {
          const mKind = this.classifyMethodText(btn.dataset.method || btn.getAttribute('onclick'), btn.textContent);
          if (!mKind) return;
          btn.classList.toggle('hidden', enabledMap[mKind] === false);
        });
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

    // ==================== 6. HEALTH DIAGNOSTIC REPORT (v55 - 22/22 CHECKS) ====================
    patchHealthDiagnostic() {
      const app = window.DamanApp;
      if (!app || !window.DamanSync || DamanSync._healthV55Patched) return;
      DamanSync._healthV55Patched = true;

      DamanSync.openHealthReportModal = function () {
        const checks = [
          ['النواة الأساسية (app-core)', !!window.DamanApp],
          ['المحفظة والتوثيق (wallet-kyc + ops)', !!window.DamanWallet],
          ['يوم عمل + رقم مرجعي اختياري (wallet-sla)', !!window.DamanWalletSLA],
          ['ترابط الإدارة والمحفظة + توحيد فحص العقد السفلي (v55)', !!window.DamanWalletMethods],
          ['الشات والعقود والمكالمات (chat-support + extras)', !!window.DamanChat],
          ['المايك والملفات واللوكيشن (chat-media)', !!(window.DamanChat && DamanChat._mediaPluginAttached)],
          ['السوق والـ 3x وعمالة VIP (projects-escrow)', !!window.DamanProjects],
          ['لوحة الشركات (company-panel)', !!window.DamanCompany],
          ['إشعارات الشركات وعلامات (؟) (company-enhancements)', !!(window.DamanCompanyEnh && DamanCompanyEnh._syncFixedV38)],
          ['لوحة الإدارة 360° (admin + ext + ext2)', !!(window.DamanAdmin && DamanAdmin._ext1Ready)],
          ['صوت وملفات مراقبة الشات (admin-chat-media)', !!(window.DamanAdmin && DamanAdmin._watchMediaPatched)],
          ['الأقسام الديناميكية وإعلاناتها (categories-ads)', !!window.DamanCatAds],
          ['باقة الـ 62 قسم الشاملة (categories-pack)', !!(window.DamanCatAds && DamanCatAds._packV33Attached)],
          ['البحث الشامل (global-search)', !!window.DamanSearch],
          ['رقم المنشور وتحذير الأمان (post-contact-guard)', !!window.DamanPostContact],
          ['أرشيف البطاقات والسجلات (kyc-vault)', !!window.DamanKycVault],
          ['المشاركة وQR العقد والصفحة (share-qr)', !!(window.DamanShareQR && DamanShareQR._syncFixedV38)],
          ['كاميرا QR + كاميرا التوثيق + أعياد الميلاد (kyc-bday-qr)', !!(window.DamanKycBdayQR && DamanKycBdayQR._rulesResilientV41)],
          ['الإشعارات الجماعية + الحاسبة + انتهاء البطاقات (admin-growth-ops)', !!window.DamanGrowthOps],
          ['التحقق العام من العقود + الحظر والتجميد (security-verify-ban)', !!window.DamanSecurityMod],
          ['ربط الإشعارات والصوت والتكامل (system-sync)', !!this._booted],
          ['اتصال Firebase Firestore + QRCode', !!(app.db && app.auth && typeof window.QRCode !== 'undefined')]
        ];

        const passed = checks.filter((c) => c[1]).length;
        const allOk = passed === checks.length;

        let m = document.getElementById('daman-health-modal');
        if (!m) {
          m = document.createElement('div');
          m.id = 'daman-health-modal';
          m.className = 'daman-modal fixed inset-0 z-[97] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
          document.body.appendChild(m);
        }
        m.classList.remove('hidden');

        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border-2 ${allOk ? 'border-emerald-500/60' : 'border-amber-500/60'} rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-black ${allOk ? 'text-emerald-400' : 'text-amber-400'}">🩺 تقرير فحص المنظومة الشامل v55 (${passed}/${checks.length})</h3>
              <button type="button" onclick="document.getElementById('daman-health-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="space-y-1.5">
              ${checks.map(([label, ok]) => `
                <div class="p-2 rounded-xl bg-slate-950 border ${ok ? 'border-emerald-500/30' : 'border-rose-500/60'} flex items-center justify-between gap-2 text-[11px]">
                  <span class="text-slate-200 font-bold">${label}</span>
                  <span class="px-2 py-0.5 rounded-lg font-black text-[10px] shrink-0 ${ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${ok ? 'شغّال ✅' : 'ناقص ❌'}</span>
                </div>`).join('')}
            </div>
            <button type="button" onclick="document.getElementById('daman-health-modal').classList.add('hidden')" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">إغلاق</button>
          </div>`;
      };
    },

    // ==================== 7. BOOT & GLOBAL WIRING ====================
    runPass() {
      const app = window.DamanApp;
      if (!app) return;
      this.syncHomeContractVerifyWiring();
      this.cleanDepositWithdrawButtons();
      if (app.activeTab === 'wallet') this.injectWalletScreenOwnershipNotice();
      if (app.activeTab === 'admin') this.wireAdminAccountsToggles();
      this.scanOpenModals();
    },

    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.clearLegacyBackups();
      this.startConfigListener();
      this.patchHealthDiagnostic();

      // Intercept clicks on the bottom "فحص عقد رسمي" card to launch the rich verifier (QR + Contract Code + Entry)
      document.addEventListener('click', (ev) => {
        const target = ev.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest('[data-daman-hidden-top-verify="1"]') || target.closest('.daman-modal')) return;

        const bottomCard = target.closest('[data-daman-bottom-verify-card="1"]');
        if (bottomCard) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          this.openUnifiedContractVerify();
        }
      }, true);

      if (window.DamanAdmin && typeof DamanAdmin.render === 'function' && !DamanAdmin._pmcHookedV55) {
        DamanAdmin._pmcHookedV55 = true;
        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          setTimeout(() => {
            this.wireAdminAccountsToggles();
            this.fixBankLabelsInDOM(container);
          }, 50);
        };
      }

      if (typeof app.renderCurrentTab === 'function' && !app._pmcTabHookedV55) {
        app._pmcTabHookedV55 = true;
        const origRenderTab = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRenderTab();
          setTimeout(() => this.runPass(), 80);
          setTimeout(() => this.runPass(), 320);
        };
      }

      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(() => {
          clearTimeout(this._timer);
          this._timer = setTimeout(() => this.runPass(), 70);
        });
        this._obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      setTimeout(() => {
        this.patchHealthDiagnostic();
        this.runPass();
      }, 650);
    }
  };

  window.DamanWalletMethods = DamanSystemUnifier;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => DamanSystemUnifier.boot(), 650));
  else setTimeout(() => DamanSystemUnifier.boot(), 650);
})();
