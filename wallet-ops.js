(function () {
  const WalletOps = {
    normalizeUrl(raw) {
      const s = String(raw || '').trim();
      if (!s) return '';
      if (/^https?:\/\//i.test(s)) return s;
      return 'https://' + s;
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
        bank: c.bank !== false
      };
    },

    safeChannelShort(ch) {
      if (ch === 'bank') return '🏦 تحويل بنكي';
      if (ch === 'instapay') return 'إنستا باي';
      if (ch === 'vodafone_cash') return 'محفظة إلكترونية';
      return typeof this.channelShort === 'function' ? this.channelShort(ch) : ch;
    },

    closeDepositModal() {
      this.clearDepositTimer();
      document.getElementById('daman-deposit-modal')?.classList.add('hidden');
    },

    // ==================== 1. DEPOSIT MODAL (3 CHANNELS + OPTIONAL TXREF + 10 MIN TIMER) ====================
    async _openDepositModalImpl(prefillAmount = '') {
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
        if (cfgSnap.exists) {
          liveCfg = Object.assign({}, liveCfg, cfgSnap.data());
          app.appConfig = Object.assign({}, app.appConfig || {}, cfgSnap.data());
        }
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
      const ipLink = this.normalizeUrl(acc.instaPayLink || '');
      const bankName = acc.bankName || '';
      const bankHolder = acc.bankHolder || '';
      const bankAccount = acc.bankAccount || acc.bankInfo || 'غير محدد';
      const bankIban = acc.bankIban || '';

      const escJs = (s) => app.esc(String(s || '')).replace(/'/g, "\\'");

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-emerald-400"><i class="fa-solid fa-circle-arrow-down me-1"></i> إيداع</h3>
            <button onclick="DamanWallet.closeDepositModal()" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/60 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-black text-rose-300"><i class="fa-solid fa-stopwatch me-1"></i> صلاحية أرقام الاستقبال الحالية</span>
              <span id="dep-countdown-lbl" class="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white font-black text-sm tracking-widest">${mins}:${secs}</span>
            </div>
            <p class="text-[10.5px] text-rose-100 leading-relaxed">
              ⚠️ <b>هام جداً:</b> حوّل وارفع الإيصال خلال <b>${minsCfg} دقائق</b> فقط، ولا تحوّل أبداً على رقم قديم محفوظ لديك. اضغط <b>(؟)</b> جنب أي خانة لمعرفة شرحها.
            </p>
          </div>

          <div id="dep-expired-gate" class="hidden p-5 rounded-2xl bg-slate-950 border border-rose-500/60 text-center space-y-3">
            <i class="fa-solid fa-clock-rotate-left text-3xl text-rose-400"></i>
            <div class="text-sm font-black text-rose-300">انتهت مهلة البيانات الحالية!</div>
            <p class="text-[11px] text-slate-300">حمايةً لأموالك، تم إخفاء الأرقام السابقة. اضغط أدناه لجلب الحسابات النشطة لحظياً.</p>
            <button onclick="DamanWallet.openDepositModal('${escJs(prefillAmount)}')" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">
              <i class="fa-solid fa-rotate me-1"></i> تحديث وجلب الحسابات النشطة الآن
            </button>
          </div>

          <div id="dep-active-body" class="space-y-3">
            <div>
              <div class="text-[10.5px] font-bold text-slate-300 mb-1">اختر وسيلة التحويل المناسبة لك: ${this.hBtn('d-ch')}</div>
              ${this.hBox('d-ch', 'اختر الوسيلة التي ستحوّل منها (محفظة إلكترونية، أو رابط إنستا باي المباشر، أو تحويل بنكي) لتظهر لك بيانات الحساب النشط حالياً.')}
              <div class="grid grid-cols-3 gap-1.5">
                ${enabled.vodafone_cash ? `<button id="dep-tab-vodafone_cash" type="button" onclick="DamanWallet.selectDepositChannel('vodafone_cash')" class="py-2 px-1.5 rounded-xl text-[10.5px] font-black border ${ch === 'vodafone_cash' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700'}">📱 محافظ كاش</button>` : ''}
                ${enabled.instapay ? `<button id="dep-tab-instapay" type="button" onclick="DamanWallet.selectDepositChannel('instapay')" class="py-2 px-1.5 rounded-xl text-[10.5px] font-black border ${ch === 'instapay' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700'}">⚡ إنستا باي</button>` : ''}
                ${enabled.bank ? `<button id="dep-tab-bank" type="button" onclick="DamanWallet.selectDepositChannel('bank')" class="py-2 px-1.5 rounded-xl text-[10.5px] font-black border ${ch === 'bank' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-slate-300 border-slate-700'}">🏦 تحويل بنكي</button>` : ''}
              </div>
            </div>

            <!-- 1. E-WALLET: Wallet Number + Holder Name -->
            <div id="dep-card-vodafone_cash" class="${ch === 'vodafone_cash' ? '' : 'hidden'} p-3 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2">
              <div class="text-[10.5px] text-amber-300 font-black"><i class="fa-solid fa-mobile-screen-button me-1"></i> بيانات المحفظة الإلكترونية النشطة</div>
              <div class="p-2.5 rounded-xl bg-slate-900 space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class="text-[9.5px] text-slate-400">رقم المحفظة (فودافون / اتصالات / أورنج / WE):</div>
                    <div class="text-sm font-black text-white tracking-wider select-all">${app.esc(vfNum)}</div>
                  </div>
                  <button type="button" onclick="navigator.clipboard.writeText('${escJs(vfNum)}'); DamanApp.toast('تم نسخ رقم المحفظة ✅','success')" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px] shrink-0">نسخ الرقم</button>
                </div>
                <div class="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span class="text-slate-400">اسم صاحب المحفظة:</span>
                  <b class="text-emerald-300">${app.esc(vfHolder)}</b>
                </div>
              </div>
            </div>

            <!-- 2. INSTAPAY: Direct Clickable Link + IPA & Holder -->
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
                      <div class="text-xs font-black text-emerald-300 truncate select-all" dir="ltr">${app.esc(ipAddr)}</div>
                    </div>
                    <button type="button" onclick="navigator.clipboard.writeText('${escJs(ipAddr)}'); DamanApp.toast('تم نسخ عنوان إنستا باي ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] shrink-0">نسخ</button>
                  </div>` : ''}
                ${ipHolder ? `
                  <div class="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span class="text-slate-400">اسم صاحب الحساب:</span>
                    <b class="text-white">${app.esc(ipHolder)}</b>
                  </div>` : ''}
                ${!ipLink && !ipAddr ? `<div class="text-rose-300 text-center text-[11px]">لم يتم إضافة رابط إنستا باي من الإدارة بعد.</div>` : ''}
              </div>
            </div>

            <!-- 3. BANK TRANSFER: Bank Name + Account Holder + Account Number + Optional IBAN -->
            <div id="dep-card-bank" class="${ch === 'bank' ? '' : 'hidden'} p-3 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-2">
              <div class="text-[10.5px] text-sky-300 font-black"><i class="fa-solid fa-building-columns me-1"></i> بيانات الحساب البنكي النشط</div>
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
                    <div class="text-xs font-black text-emerald-300 tracking-wider break-all select-all" dir="ltr">${app.esc(bankAccount)}</div>
                  </div>
                  <button type="button" onclick="navigator.clipboard.writeText('${escJs(bankAccount)}'); DamanApp.toast('تم نسخ رقم الحساب البنكي ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px] shrink-0">نسخ الحساب</button>
                </div>
                ${bankIban ? `
                  <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800">
                    <div class="min-w-0">
                      <div class="text-[9.5px] text-slate-400">رقم IBAN:</div>
                      <div class="text-[10.5px] font-black text-sky-300 break-all select-all" dir="ltr">${app.esc(bankIban)}</div>
                    </div>
                    <button type="button" onclick="navigator.clipboard.writeText('${escJs(bankIban)}'); DamanApp.toast('تم نسخ الـ IBAN ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-black text-[10px] shrink-0">نسخ IBAN</button>
                  </div>` : ''}
              </div>
            </div>

            <form onsubmit="DamanWallet.submitDeposit(event)" class="space-y-2.5">
              <input id="dep-channel-hidden" type="hidden" value="${ch}" />

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10.5px] font-bold text-slate-300 mb-1">المبلغ (${app.fmtMoney(minDep)} – ${app.fmtMoney(maxDep)}) * ${this.hBtn('d-amt')}</label>
                  <input id="dep-amount" type="number" min="${minDep}" max="${maxDep}" step="any" required value="${app.esc(prefillAmount)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
                </div>
                <div>
                  <label class="block text-[10.5px] font-bold text-slate-300 mb-1">المحوّل منه * ${this.hBtn('d-snd')}</label>
                  <input id="dep-sender" type="text" required value="${app.esc(app.profile?.phone || '')}" placeholder="01xxxxxxxxx أو اسم الحساب" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                </div>
              </div>
              ${this.hBox('d-amt', 'اكتب المبلغ الصافي بالجنيه المصري الذي حوّلته فعلياً إلى حساب المنصة بدون كسور غير دقيقة.')}
              ${this.hBox('d-snd', 'اكتب رقم المحفظة أو اسم صاحب الحساب البنكي أو عنوان إنستا باي الذي تم التحويل منه لتسهيل مطابقة التحويل سريعاً.')}

              <div>
                <label class="block text-[10.5px] font-bold text-amber-300 mb-1">الرقم المرجعي للعملية <span class="text-emerald-400">(اختياري)</span> ${this.hBtn('d-ref')}</label>
                ${this.hBox('d-ref', 'رقم العملية المكتوب في رسالة SMS أو إيصال إنستا باي أو إيصال الإيداع البنكي (اختياري — يمكنك تركه فارغاً إذا لم يتوفر).')}
                <input id="dep-txref" type="text" placeholder="رقم العملية من الإيصال (اختياري — يمكنك تركه فارغاً)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-bold" />
              </div>

              <div>
                <div class="text-[10.5px] font-bold text-emerald-300 mb-1">صورة إيصال التحويل * ${this.hBtn('d-pic')}</div>
                ${this.hBox('d-pic', 'ارفع لقطة شاشة (Screenshot) واضحة من تطبيق المحفظة أو إنستا باي أو صورة إيصال البنك موضح بها المبلغ والتاريخ.')}
                <label class="block p-3 rounded-xl border border-dashed border-emerald-500/60 bg-slate-950 text-center cursor-pointer">
                  <span class="font-black text-emerald-300"><i class="fa-solid fa-receipt me-1"></i> اضغط لرفع صورة إيصال التحويل *</span>
                  <input type="file" accept="image/*" required class="hidden" onchange="DamanWallet.handleReceiptPhoto(this)" />
                  <div id="dep-receipt-prev" class="text-[9.5px] text-slate-500 mt-1">مطلوب صورة واضحة للإيصال</div>
                </label>
              </div>

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
        const rawTxRef = (document.getElementById('dep-txref')?.value || '').trim().toUpperCase();
        const txRef = rawTxRef || 'بدون رقم مرجعي';
        const minDep = Number(cfg.minDeposit || 100);
        const maxDep = Number(cfg.maxDeposit || 250000);

        if (amount < minDep) return app.toast(`الحد الأدنى للإيداع ${app.fmtMoney(minDep)} ج.م`, 'warning');
        if (amount > maxDep) return app.toast(`الحد الأقصى للعملية الواحدة ${app.fmtMoney(maxDep)} ج.م`, 'warning');
        if (rawTxRef && rawTxRef.length < 3) return app.toast('الرقم المرجعي قصير جداً — اكتب الرقم الصحيح أو اتركه فارغاً', 'warning');
        if (!this.tempReceiptBase64) return app.toast('يرجى إرفاق صورة إيصال التحويل', 'warning');

        const btn = document.getElementById('dep-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التحقق والرفع الآمن...'; }

        try {
          const refKey = rawTxRef ? rawTxRef.replace(/[^A-Z0-9_-]/g, '').slice(0, 80) : '';
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
                  txRef: rawTxRef, status: 'pending', date: app.todayLocal(),
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
            channel, amount, requestedAmount: amount, senderAccount, txRef,
            targetAccountUsed: targetAccSnapshot, duplicateRefFlag: isDupRef,
            sameOwnerConfirmed: true,
            receiptMedia, status: 'pending', date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          await app.sendNotification(
            'ADMIN',
            isDupRef ? '⚠️ طلب شحن برقم مرجعي مكرر!' : 'طلب شحن محفظة جديد 💰',
            `${app.profile?.name} — ${app.fmtMoney(amount)} ج.م (${this.safeChannelShort(channel)}) | مرجع: ${txRef}`
          );

          this.closeDepositModal();
          app.toast('تم إرسال طلب الشحن بنجاح! سيتم المراجعة وإضافة الرصيد قريباً ✅', 'success');
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'تأكيد وإرسال طلب الشحن'; }
          app.toast(err.message, 'error');
        }
      });
    },

    // ==================== 2. WITHDRAW MODAL (UP TO 3 CHANNELS INCLUDING BANK + LIVE SERVER SYNC) ====================
    async _openWithdrawModalImpl() {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (app.profile?.status === 'frozen' || app.profile?.frozen) {
        return app.toast('❄️ حسابك مجمّد مؤقتاً — لا يمكن السحب لحين انتهاء المراجعة الإدارية', 'error');
      }
      if (!app.isKycVerified()) {
        app.toast('لا يمكن السحب قبل توثيق الحساب بالبطاقة والسيلفي', 'error');
        return this.openKycModal(true);
      }

      let liveCfg = Object.assign({}, app.appConfig || {});
      try {
        const cfgSnap = await app.db.collection('settings').doc('appConfig').get({ source: 'server' });
        if (cfgSnap.exists) {
          liveCfg = Object.assign({}, liveCfg, cfgSnap.data());
          app.appConfig = Object.assign({}, app.appConfig || {}, cfgSnap.data());
        }
      } catch (e) {}

      if (liveCfg.disableWithdrawals && !app.isAdmin()) {
        return app.toast('طلبات السحب متوقفة مؤقتاً للصيانة من الإدارة — حاول لاحقاً', 'warning');
      }
      if (this.requests.some((r) => r.type === 'withdraw' && r.status === 'pending')) {
        return app.toast('لديك طلب سحب قيد المراجعة بالفعل — انتظر تنفيذه أو ألغِه أولاً', 'warning');
      }

      const enabled = this.getEnabledWithdrawChannels(liveCfg);
      const activeList = ['vodafone_cash', 'instapay', 'bank'].filter((k) => enabled[k]);
      if (!activeList.length) return app.toast('وسائل السحب متوقفة مؤقتاً — تواصل مع الإدارة', 'error');

      const avail = Number(app.profile.balanceAvailable || 0);
      const minW = Number(liveCfg.minWithdraw || 100);
      const maxDaily = Number(liveCfg.maxWithdrawDaily || 50000);
      const todayUsed = this.requests
        .filter((r) => r.type === 'withdraw' && r.date === app.todayLocal() && ['pending', 'approved'].includes(r.status))
        .reduce((s, r) => s + Number(r.amount || 0), 0);
      const dailyLeft = Math.max(0, Math.round((maxDaily - todayUsed) * 100) / 100);

      if (avail < minW) {
        return app.toast(`رصيدك الكاش المتاح (${app.fmtMoney(avail)} ج.م) أقل من الحد الأدنى للسحب (${app.fmtMoney(minW)} ج.م).`, 'warning');
      }
      if (dailyLeft < minW) {
        return app.toast(`لقد وصلت للحد الأقصى للسحب اليومي (${app.fmtMoney(maxDaily)} ج.م). حاول غداً.`, 'warning');
      }

      const maxAllowedNow = Math.min(avail, dailyLeft);
      const savedVf = localStorage.getItem('daman_last_wd_vf') || app.profile?.phone || '';
      const savedIp = localStorage.getItem('daman_last_wd_ip') || '';
      const escJs = (s) => app.esc(String(s || '')).replace(/'/g, "\\'");

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
        enabled.bank ? '<option value="bank">🏦 تحويل إلى حساب بنكي (IBAN / رقم حساب)</option>' : ''
      ].join('');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-money-bill-transfer me-1"></i> سحب</h3>
            <button onclick="document.getElementById('daman-withdraw-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-[11px]">
            <div>المتاح للسحب: <b class="text-emerald-400">${app.fmtMoney(avail)} ج.م</b></div>
            <div>المتبقي من حد اليوم: <b class="text-sky-400">${app.fmtMoney(dailyLeft)} ج.م</b></div>
          </div>

          <form onsubmit="DamanWallet.submitWithdraw(event)" oninput="DamanWallet.updateWithdrawPreview()" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">وسيلة الاستلام * ${this.hBtn('wd-ch')}</label>
              ${this.hBox('wd-ch', 'اختر الطريقة التي تريد أن تحوّل لك الإدارة الفلوس عليها (محفظة كاش أو إنستا باي أو حساب بنكي).')}
              <select id="wd-channel" onchange="DamanWallet.onWithdrawChannelChange('${escJs(savedVf)}','${escJs(savedIp)}')" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-bold">
                ${opts}
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">المبلغ المطلوب سحبه (${app.fmtMoney(minW)} – ${app.fmtMoney(maxAllowedNow)} ج.م) * ${this.hBtn('wd-amt')}</label>
              ${this.hBox('wd-amt', 'أدخل المبلغ الذي تريد سحبه من رصيدك الكاش المتاح فقط (رصيد الهدايا لا يُسحب نقداً). يُحجز المبلغ فوراً حتى يتم التحويل.')}
              <input id="wd-amount" type="number" min="${minW}" max="${maxAllowedNow}" step="any" required value="${Math.min(maxAllowedNow, Math.max(minW, 500))}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1"><span id="wd-dest-lbl">رقم المحفظة المستلمة *</span> ${this.hBtn('wd-dst')}</label>
              ${this.hBox('wd-dst', 'اكتب رقم المحفظة المصرية (11 رقم) أو عنوان إنستا باي أو بيانات حسابك البنكي المسجّل باسمك الشخصي.')}
              <input id="wd-dest" type="text" required value="${app.esc(activeList[0] === 'instapay' ? savedIp : activeList[0] === 'bank' ? '' : savedVf)}" placeholder="01xxxxxxxxx أو username@instapay" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
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
        if (lbl) lbl.textContent = 'عنوان إنستا باي (username@instapay) أو رقم الموبايل *';
        if (inp) { inp.value = savedIp || ''; inp.placeholder = 'username@instapay أو 01xxxxxxxxx'; }
      } else if (ch === 'bank') {
        if (lbl) lbl.textContent = 'اسم البنك + اسم المستفيد + رقم الحساب / IBAN *';
        if (inp) { inp.placeholder = 'البنك الأهلي / مصر — رقم الحساب أو IBAN'; }
      } else {
        if (lbl) lbl.textContent = 'رقم المحفظة المستلمة (يفضل رقمك الموثّق) *';
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
        <div>رسوم التحويل (${this.safeChannelShort(ch)}): <b>${app.fmtMoney(fee)} ج.م</b></div>
        <div class="text-emerald-300 font-black">الصافي الذي سيصلك: ${app.fmtMoney(net)} ج.م</div>
        <div class="text-[10px] text-slate-300 pt-0.5">يُحجز المبلغ فوراً في خانة «قيد السحب»، ويمكنك إلغاء الطلب قبل اعتماده.</div>`;
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
        if (todayUsed + amount > maxDaily) return app.toast(`تجاوزت الحد الأقصى للسحب اليومي (${app.fmtMoney(maxDaily)} ج.م)`, 'error');

        const { fee, net } = this.calcWithdrawFee(amount, channel);
        if (net <= 0) return app.toast('صافي السحب يجب أن يكون أكبر من صفر', 'error');

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
            if (curAvail < amount) throw new Error('رصيدك المتاح غير كافٍ');

            const afterAvail = Math.round((curAvail - amount) * 100) / 100;
            tx.update(userRef, {
              balanceAvailable: afterAvail,
              balancePendingWithdraw: Math.round((curHold + amount) * 100) / 100
            });
            tx.set(reqRef, {
              type: 'withdraw', userId: app.user.uid,
              userName: app.profile?.companyName || app.profile?.name || '',
              userLegalName: app.profile?.legalName || '', userPhone: app.profile?.phone || '',
              channel, amount, withdrawFee: fee, netPayout: net, destAccount,
              phoneMismatchFlag, rapidFlipFlag, lastDepositChannel: lastDep ? lastDep.channel : '',
              sameOwnerConfirmed: true,
              status: 'pending', date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(txRefDoc, {
              userId: app.user.uid, type: 'withdraw_hold', amount: -amount,
              balanceBefore: curAvail, balanceAfter: afterAvail,
              note: `حجز طلب سحب (${this.safeChannelShort(channel)} — ${destAccount})`,
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
              userId: app.user.uid, type: 'withdraw_cancel', amount: amt,
              balanceBefore: curAvail, balanceAfter: afterAvail,
              note: 'إلغاء طلب سحب بواسطة المستخدم وردّ المبلغ للمتاح',
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          app.toast('تم إلغاء الطلب وردّ المبلغ فوراً إلى رصيدك المتاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    }
  };

  if (window.DamanWallet && typeof window.DamanWallet.registerOps === 'function') {
    window.DamanWallet.registerOps(WalletOps);
  } else {
    window.__damanWalletOpsPending = WalletOps;
  }
})();
