(function () {
  const WalletMethodsCtrl = {
    _booted: false,
    _obs: null,
    _timer: null,
    config: {
      deposit: {
        wallet: true,
        instapay: true,
        bank: true
      },
      withdraw: {
        wallet: true,
        instapay: true,
        bank: true
      }
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

    // ==================== 1. LOAD & SAVE CONFIG IN FIRESTORE ====================
    async loadConfig() {
      const app = window.DamanApp;
      if (!app || !app.db) return;
      try {
        const snap = await app.db.collection('settings').doc('paymentMethodsControl').get();
        if (snap.exists) {
          const data = snap.data() || {};
          if (data.deposit) this.config.deposit = Object.assign({}, this.config.deposit, data.deposit);
          if (data.withdraw) this.config.withdraw = Object.assign({}, this.config.withdraw, data.withdraw);
        }
      } catch (e) {}
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
        await app.logAudit('payment_methods_ctrl', `تحديث وسائل الدفع: الإيداع (${depCnt}/3) — السحب (${wdCnt}/3)`);
        app.toast(`تم حفظ وتفعيل وسائل الإيداع (${depCnt}) والسحب (${wdCnt}) بنجاح ✅`, 'success');
      });
    },

    // ==================== 2. ADMIN CONTROL CARD INSIDE "💳 محوّل الحسابات" ====================
    renderAdminControlBox(app) {
      const d = this.config.deposit;
      const w = this.config.withdraw;
      return `
        <form id="daman-pmc-admin-box" onsubmit="DamanWalletMethods.saveConfigFromAdmin(event)" class="glass-card rounded-2xl p-3.5 border-2 border-emerald-500/50 space-y-3 text-xs mb-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-black text-emerald-400">🎛️ التحكم الكامل في وسائل الإيداع والسحب</h3>
              <p class="text-[10px] text-slate-300">تحكّم في تفعيل أو إيقاف كل وسيلة للإيداع وللسحب (بما فيها التحويل البنكي في السحب).</p>
            </div>
            <span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black shrink-0">تحكم مباشر</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <!-- Deposit Methods Control -->
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

            <!-- Withdraw Methods Control -->
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
      if (!app || !app.isAdmin()) return;
      if (document.getElementById('daman-pmc-admin-box')) return;

      // Check if we are currently viewing the Accounts Switcher sub-tab in Admin
      const isAccountsSubTab =
        window.DamanAdmin?.subTab === 'accounts' ||
        (container && (container.textContent || '').includes('محوّل الحسابات') && (container.querySelector('input[id*="instapay" i], input[id*="bank" i], input[id*="wallet" i]')));

      if (!isAccountsSubTab) return;
      const tabBar = container.querySelector('.overflow-x-auto');
      if (tabBar && tabBar.nextElementSibling) {
        tabBar.nextElementSibling.insertAdjacentHTML('afterbegin', this.renderAdminControlBox(app));
      }
    },

    // ==================== 3. ENHANCE DEPOSIT MODAL (DYNAMIC 1..3 METHODS) ====================
    classifyOptionValue(opt) {
      const v = (opt.value || '').toLowerCase();
      const t = (opt.textContent || '').toLowerCase();
      if (v.includes('insta') || t.includes('إنستا') || t.includes('انستا') || t.includes('instapay')) return 'instapay';
      if (v.includes('bank') || t.includes('بنك') || t.includes('iban')) return 'bank';
      if (v.includes('wallet') || v.includes('vodafone') || v.includes('cash') || t.includes('محفظ') || t.includes('فودافون') || t.includes('كاش')) return 'wallet';
      return '';
    },

    applyDepositMethodsToModal(modal) {
      const form = modal.querySelector('form');
      if (!form) return;
      const sel = form.querySelector('select');
      if (!sel) return;

      const enabledMap = this.config.deposit;
      let firstEnabledVal = '';
      Array.from(sel.options).forEach((opt) => {
        const kind = this.classifyOptionValue(opt);
        if (!kind) return;
        const allowed = enabledMap[kind] !== false;
        opt.hidden = !allowed;
        opt.disabled = !allowed;
        if (allowed && !firstEnabledVal) firstEnabledVal = opt.value;
      });

      const curOpt = sel.options[sel.selectedIndex];
      if (curOpt && curOpt.disabled && firstEnabledVal) {
        sel.value = firstEnabledVal;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },

    // ==================== 4. ENHANCE WITHDRAW MODAL (ADD BANK ACCOUNT + STRUCTURED FIELDS) ====================
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

    applyWithdrawMethodsToModal(modal) {
      const app = window.DamanApp;
      const form = modal.querySelector('form');
      if (!form || !app) return;
      const sel = form.querySelector('select');
      if (!sel) return;

      // 1. Ensure "🏦 تحويل إلى حساب بنكي" option exists in the Withdraw <select>
      let bankOpt = Array.from(sel.options).find((o) => this.classifyOptionValue(o) === 'bank');
      if (!bankOpt) {
        bankOpt = document.createElement('option');
        bankOpt.value = 'bank';
        bankOpt.textContent = '🏦 تحويل إلى حساب بنكي (IBAN / رقم حساب)';
        sel.appendChild(bankOpt);
      }

      // 2. Apply Admin enable/disable settings to all 3 withdraw options
      const enabledMap = this.config.withdraw;
      let firstEnabledVal = '';
      Array.from(sel.options).forEach((opt) => {
        const kind = this.classifyOptionValue(opt);
        if (!kind) return;
        const allowed = enabledMap[kind] !== false;
        opt.hidden = !allowed;
        opt.disabled = !allowed;
        if (allowed && !firstEnabledVal) firstEnabledVal = opt.value;
      });

      const curOpt = sel.options[sel.selectedIndex];
      if (curOpt && curOpt.disabled && firstEnabledVal) {
        sel.value = firstEnabledVal;
      }

      // 3. Inject structured Bank Account fields right below the standard target account input
      const accInp = this.findWithdrawAccountInput(form);
      if (!accInp) return;

      let bankBox = document.getElementById('daman-wd-bank-fields');
      if (!bankBox) {
        bankBox = document.createElement('div');
        bankBox.id = 'daman-wd-bank-fields';
        bankBox.className = 'hidden p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2 text-xs';
        bankBox.innerHTML = `
          <div class="font-black text-emerald-300 text-[11px]">🏦 بيانات الحساب البنكي المستلم للتحويل:</div>
          <div>
            <label class="block text-[10px] text-slate-300 mb-1">اسم البنك *</label>
            <select id="daman-wd-bank-name" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold">
              ${this.EGYPT_BANKS.map((b) => `<option value="${app.esc(b)}">${app.esc(b)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[10px] text-slate-300 mb-1">اسم صاحب الحساب بالكامل (كما في البنك) *</label>
            <input id="daman-wd-bank-holder" type="text" placeholder="الاسم ثلاثي أو رباعي" value="${app.esc(app.profile?.legalName || app.profile?.name || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold" />
          </div>
          <div>
            <label class="block text-[10px] text-slate-300 mb-1">رقم الحساب البنكي أو رقم الـ IBAN *</label>
            <input id="daman-wd-bank-iban" type="text" dir="ltr" placeholder="EG00 0000 0000 0000 0000 0000 000" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-black" />
          </div>`;

        const anchor = accInp.parentElement && accInp.parentElement !== form ? accInp.parentElement : accInp;
        anchor.insertAdjacentElement('afterend', bankBox);

        const syncToHiddenAcc = () => {
          if (this.classifyOptionValue(sel.options[sel.selectedIndex]) !== 'bank') return;
          const bName = (document.getElementById('daman-wd-bank-name')?.value || '').trim();
          const bHolder = (document.getElementById('daman-wd-bank-holder')?.value || '').trim();
          const bIban = (document.getElementById('daman-wd-bank-iban')?.value || '').trim();
          accInp.value = `🏦 ${bName} | الاسم: ${bHolder} | حساب/IBAN: ${bIban}`;
          accInp.dataset.bankSynced = '1';
        };

        bankBox.addEventListener('input', syncToHiddenAcc);
        bankBox.addEventListener('change', syncToHiddenAcc);
      }

      const toggleBankMode = () => {
        const selectedKind = this.classifyOptionValue(sel.options[sel.selectedIndex]);
        const isBank = selectedKind === 'bank';
        const accWrapper = accInp.parentElement && accInp.parentElement !== form ? accInp.parentElement : accInp;

        if (isBank) {
          bankBox.classList.remove('hidden');
          accWrapper.classList.add('hidden');
          accInp.required = false;
          document.getElementById('daman-wd-bank-holder').required = true;
          document.getElementById('daman-wd-bank-iban').required = true;
          const bName = (document.getElementById('daman-wd-bank-name')?.value || '').trim();
          const bHolder = (document.getElementById('daman-wd-bank-holder')?.value || '').trim();
          const bIban = (document.getElementById('daman-wd-bank-iban')?.value || '').trim();
          accInp.value = `🏦 ${bName} | الاسم: ${bHolder} | حساب/IBAN: ${bIban}`;
          accInp.dataset.bankSynced = '1';
        } else {
          bankBox.classList.add('hidden');
          accWrapper.classList.remove('hidden');
          accInp.required = true;
          document.getElementById('daman-wd-bank-holder').required = false;
          document.getElementById('daman-wd-bank-iban').required = false;
          if (accInp.dataset.bankSynced === '1') {
            accInp.value = '';
            delete accInp.dataset.bankSynced;
          }
        }
      };

      if (!sel.dataset.wdBankModeBound) {
        sel.dataset.wdBankModeBound = '1';
        sel.addEventListener('change', toggleBankMode);
      }
      toggleBankMode();

      if (!form.dataset.wdBankSubmitBound) {
        form.dataset.wdBankSubmitBound = '1';
        form.addEventListener('submit', (ev) => {
          if (this.classifyOptionValue(sel.options[sel.selectedIndex]) !== 'bank') return;
          const bName = (document.getElementById('daman-wd-bank-name')?.value || '').trim();
          const bHolder = (document.getElementById('daman-wd-bank-holder')?.value || '').trim();
          const bIban = (document.getElementById('daman-wd-bank-iban')?.value || '').trim();
          if (!bHolder || bHolder.length < 4) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return app.toast('يرجى كتابة اسم صاحب الحساب البنكي بالكامل', 'error');
          }
          if (!bIban || bIban.length < 8) {
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
        const kind = window.DamanWalletSLA?.detectModalKind ? DamanWalletSLA.detectModalKind(modal) : '';
        if (kind === 'deposit') this.applyDepositMethodsToModal(modal);
        else if (kind === 'withdraw') this.applyWithdrawMethodsToModal(modal);
      });
    },

    // ==================== 5. UPDATE HEALTH DIAGNOSTIC TO 22/22 ====================
    patchHealthDiagnostic() {
      const app = window.DamanApp;
      if (!app || !window.DamanSync || DamanSync._healthV44Patched) return;
      DamanSync._healthV44Patched = true;

      DamanSync.openHealthReportModal = function () {
        const checks = [
          ['النواة الأساسية (app-core)', !!window.DamanApp],
          ['المحفظة والتوثيق (wallet-kyc + ops)', !!window.DamanWallet],
          ['يوم عمل + رقم مرجعي اختياري (wallet-sla)', !!window.DamanWalletSLA],
          ['تحكم وسائل الإيداع والسحب + السحب البنكي (v44)', !!window.DamanWalletMethods],
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
              <h3 class="text-sm font-black ${allOk ? 'text-emerald-400' : 'text-amber-400'}">🩺 تقرير فحص المنظومة الشامل v44 (${passed}/${checks.length})</h3>
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

    // ==================== BOOT ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.loadConfig().then(() => this.scanOpenModals());
      this.patchHealthDiagnostic();

      if (window.DamanAdmin && typeof DamanAdmin.render === 'function' && !DamanAdmin._pmcHooked) {
        DamanAdmin._pmcHooked = true;
        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          setTimeout(() => this.injectAdminAccountsControl(container, a), 40);
        };
      }

      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(() => {
          clearTimeout(this._timer);
          this._timer = setTimeout(() => this.scanOpenModals(), 70);
        });
        this._obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      setTimeout(() => {
        this.patchHealthDiagnostic();
        this.scanOpenModals();
        if (app.activeTab === 'admin') {
          const main = document.getElementById('app-main');
          if (main) this.injectAdminAccountsControl(main, app);
        }
      }, 700);
    }
  };

  window.DamanWalletMethods = WalletMethodsCtrl;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => WalletMethodsCtrl.boot(), 720));
  else setTimeout(() => WalletMethodsCtrl.boot(), 720);
})();
