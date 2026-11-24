(function () {
  const WalletSLA = {
    _booted: false,
    _obs: null,
    _timer: null,
    slaConfig: {
      durationText: 'يوم عمل واحد (24 ساعة عمل)',
      depositNote: 'يتم مراجعة إيصال التحويل وإضافة الرصيد إلى محفظتك خلال يوم عمل واحد (24 ساعة عمل) من وقت إرسال الطلب.',
      withdrawNote: 'يتم مراجعة طلب السحب وتحويل المبلغ إلى حسابك خلال يوم عمل واحد (24 ساعة عمل). يرجى التأكد من صحة رقم المحفظة أو حساب إنستا باي أو البنك قبل التأكيد.'
    },

    async loadConfig() {
      const app = window.DamanApp;
      if (!app || !app.db) return;
      try {
        const snap = await app.db.collection('settings').doc('walletSlaConfig').get();
        if (snap.exists) {
          this.slaConfig = Object.assign({}, this.slaConfig, snap.data());
        }
      } catch (e) {}
    },

    async editSlaConfigAdmin() {
      const app = window.DamanApp;
      if (!app || !app.isAdmin()) return;
      const nextDur = window.prompt('مدة تنفيذ الإيداع والسحب (مثال: يوم عمل واحد (24 ساعة عمل)):', this.slaConfig.durationText);
      if (!nextDur || !nextDur.trim()) return;

      const clean = nextDur.trim();
      this.slaConfig.durationText = clean;
      this.slaConfig.depositNote = `يتم مراجعة إيصال التحويل وإضافة الرصيد إلى محفظتك خلال ${clean} من وقت إرسال الطلب.`;
      this.slaConfig.withdrawNote = `يتم مراجعة طلب السحب وتحويل المبلغ إلى حسابك خلال ${clean}. يرجى التأكد من صحة رقم المحفظة أو حساب إنستا باي أو البنك قبل التأكيد.`;

      await app.db.collection('settings').doc('walletSlaConfig').set(
        Object.assign({}, this.slaConfig, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }),
        { merge: true }
      );
      await app.logAudit('wallet_sla_update', `تحديث مدة تنفيذ الإيداع والسحب إلى: ${clean}`);
      app.toast('تم تحديث تنبيه مدة التنفيذ في التطبيق بالكامل ✅', 'success');
      document.getElementById('daman-wallet-sla-banner')?.remove();
      this.enhanceWalletTab();
    },

    // ==================== 1. WALLET TAB SLA BANNER & PENDING BADGES ====================
    enhanceWalletTab() {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'wallet') return;
      const main = document.getElementById('app-main');
      if (!main) return;

      if (!document.getElementById('daman-wallet-sla-banner')) {
        const root = main.firstElementChild || main;
        const box = document.createElement('div');
        box.id = 'daman-wallet-sla-banner';
        box.className = 'mb-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-xs flex items-start justify-between gap-2';
        box.innerHTML = `
          <div class="flex items-start gap-2 min-w-0">
            <i class="fa-solid fa-clock text-amber-400 text-sm mt-0.5 shrink-0"></i>
            <div class="space-y-0.5 leading-relaxed">
              <div class="font-black text-amber-300">⏱️ مدة تنفيذ الإيداع والسحب: خلال ${app.esc(this.slaConfig.durationText)}</div>
              <div class="text-[10.5px] text-slate-200">تُراجع جميع طلبات شحن المحفظة وسحب الأرباح وتُنفّذ رسمياً خلال <b>${app.esc(this.slaConfig.durationText)}</b> (عدا الإجازات الرسمية).</div>
            </div>
          </div>
          ${app.isAdmin() ? `<button type="button" onclick="DamanWalletSLA.editSlaConfigAdmin()" class="px-2 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 text-[9.5px] font-black shrink-0">تعديل</button>` : ''}`;

        const calcBar = document.getElementById('daman-wallet-calc-bar');
        if (calcBar && calcBar.parentNode === root) root.insertBefore(box, calcBar.nextSibling);
        else root.insertBefore(box, root.firstElementChild);
      }

      const candidates = main.querySelectorAll('span, div');
      candidates.forEach((el) => {
        if (el.children.length > 0 || el.dataset.slaTagged) return;
        const txt = (el.textContent || '').trim();
        if (!txt || txt.length > 35) return;
        if (txt.includes('قيد المراجعة') || txt === 'معلّق' || txt === 'قيد التنفيذ') {
          const parentCard = el.closest('.glass-card, .rounded-xl, .rounded-2xl');
          if (!parentCard || parentCard.id === 'daman-wallet-sla-banner' || parentCard.querySelector('.daman-pending-sla-chip')) return;
          el.dataset.slaTagged = '1';
          const chip = document.createElement('div');
          chip.className = 'daman-pending-sla-chip mt-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black inline-flex items-center gap-1';
          chip.innerHTML = `<i class="fa-solid fa-hourglass-half"></i><span>يتم التنفيذ خلال ${app.esc(this.slaConfig.durationText)}</span>`;
          parentCard.appendChild(chip);
        }
      });
    },

    // ==================== 2. DEPOSIT & WITHDRAW MODALS SLA NOTICE ====================
    detectModalKind(modal) {
      if (!modal) return '';
      const id = (modal.id || '').toLowerCase();
      if (id.includes('deposit') || id.includes('topup') || id.includes('charge')) return 'deposit';
      if (id.includes('withdraw') || id.includes('payout')) return 'withdraw';

      if (id.includes('kyc') || id.includes('post') || id.includes('admin') || id.includes('u360') || id.includes('calc') || id.includes('qr') || id.includes('bday')) {
        return '';
      }

      const header = modal.querySelector('h2, h3, h4');
      const form = modal.querySelector('form');
      if (!header || !form) return '';
      const hTxt = (header.textContent || '').trim();
      const hasAmount = !!form.querySelector('input[type="number"]');
      if (!hasAmount) return '';

      if (hTxt.includes('إيداع') || hTxt.includes('شحن المحفظة') || hTxt.includes('شحن رصيد')) return 'deposit';
      if (hTxt.includes('سحب') || hTxt.includes('تحويل أرباح')) return 'withdraw';
      return '';
    },

    enhanceOpenWalletModals() {
      const app = window.DamanApp;
      if (!app) return;

      document.querySelectorAll('.daman-modal:not(.hidden)').forEach((modal) => {
        const kind = this.detectModalKind(modal);
        if (!kind) return;
        const form = modal.querySelector('form');
        if (!form) return;

        if (!form.querySelector('.daman-modal-sla-notice')) {
          const isDeposit = kind === 'deposit';
          const notice = document.createElement('div');
          notice.className = `daman-modal-sla-notice p-3 rounded-2xl border text-[11px] leading-relaxed space-y-1 ${
            isDeposit
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-100'
              : 'bg-rose-500/15 border-rose-500/50 text-rose-100'
          }`;
          notice.innerHTML = `
            <div class="font-black ${isDeposit ? 'text-amber-300' : 'text-rose-300'} flex items-center gap-1.5">
              <i class="fa-solid fa-clock"></i>
              <span>⏱️ تنبيه هام: يتم تنفيذ الطلب خلال ${app.esc(this.slaConfig.durationText)}</span>
            </div>
            <p class="text-[10.5px]">${app.esc(isDeposit ? this.slaConfig.depositNote : this.slaConfig.withdrawNote)}</p>`;

          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn && submitBtn.parentNode === form) {
            form.insertBefore(notice, submitBtn);
          } else {
            form.appendChild(notice);
          }
        }

        // Wait up to 15s for modal to actually close after receipt upload finishes
        if (!form.dataset.slaSubmitBound) {
          form.dataset.slaSubmitBound = '1';
          form.addEventListener('submit', () => {
            let checks = 0;
            const t = setInterval(() => {
              checks++;
              if (checks > 35) return clearInterval(t);
              if (modal.classList.contains('hidden')) {
                clearInterval(t);
                app.toast(`⏱️ تم استلام طلبك — يتم المراجعة والتنفيذ خلال ${this.slaConfig.durationText} ✅`, 'info');
              }
            }, 400);
          });
        }
      });
    },

    // ==================== 3. FIX KYC EXPIRY SAVE TIMING & BIRTHDAY RULES RESILIENCE ====================
    patchKycAndBirthdayReliability() {
      const app = window.DamanApp;
      if (!app) return;

      // Fix 1: Save idExpiryDate AFTER #daman-kyc-modal closes (never overwritten by slow image uploads)
      if (!this._kycExpiryReliableBound) {
        this._kycExpiryReliableBound = true;
        document.addEventListener('submit', (ev) => {
          const modal = ev.target && ev.target.closest && ev.target.closest('#daman-kyc-modal');
          if (!modal || ev.defaultPrevented) return;
          const expVal = (document.getElementById('kyc-id-expiry')?.value || '').trim();
          const uid = app.user?.uid;
          if (!expVal || !uid || expVal <= app.todayLocal()) return;

          let tries = 0;
          const waitClose = setInterval(() => {
            tries++;
            if (tries > 75) return clearInterval(waitClose); // up to 30s for slow connections
            if (modal.classList.contains('hidden')) {
              clearInterval(waitClose);
              setTimeout(async () => {
                try {
                  await Promise.all([
                    app.db.collection('kycRequests').doc(uid).set({ idExpiryDate: expVal }, { merge: true }).catch(() => {}),
                    app.db.collection('users').doc(uid).set({ idExpiryDate: expVal, idExpiryExpired: false }, { merge: true }).catch(() => {})
                  ]);
                } catch (e) {}
              }, 350);
            }
          }, 400);
        });
      }

      // Fix 2: Separate Birthday Greeting from Wallet Self-Credit (resilient against strict Firestore Rules)
      if (window.DamanKycBdayQR && !DamanKycBdayQR._rulesResilientV41) {
        DamanKycBdayQR._rulesResilientV41 = true;
        DamanKycBdayQR.checkAndCelebrateUserBirthday = async function () {
          if (!app.user || !app.profile || !app.db) return;
          const uid = app.user.uid;
          if (this._bdayCheckedForUid === uid) return;

          let bdate = app.profile.birthDate || '';
          if (!bdate) {
            try {
              const kSnap = await app.db.collection('kycRequests').doc(uid).get();
              if (kSnap.exists && kSnap.data().birthDate) {
                bdate = kSnap.data().birthDate;
                await app.db.collection('users').doc(uid).set({ birthDate: bdate }, { merge: true }).catch(() => {});
              }
            } catch (e) {}
          }
          if (!bdate || bdate.length < 10) return;
          this._bdayCheckedForUid = uid;

          const today = app.todayLocal();
          if (bdate.slice(5, 10) !== today.slice(5, 10)) return;

          const yearStr = today.slice(0, 4);
          const localKey = `daman_bday_celebrated_${uid}_${yearStr}`;
          if (localStorage.getItem(localKey) || String(app.profile.lastBirthdayGiftYear || '') === yearStr) return;

          await this.loadBirthdayConfig();
          if (this.bdayConfig.enabled === false) return;

          localStorage.setItem(localKey, '1');
          const userName = app.profile.name || app.profile.companyName || 'شريكنا العزيز';
          const msgBody = String(this.bdayConfig.message || '').replace(/\{name\}/g, userName);
          const giftType = this.bdayConfig.giftType || 'none';
          const giftVal = Number(this.bdayConfig.giftValue || 0);

          let giftSummary = '';
          if (giftType === 'wallet' && giftVal > 0) {
            try {
              await app.db.collection('users').doc(uid).set({
                walletBalance: firebase.firestore.FieldValue.increment(giftVal),
                lastBirthdayGiftYear: yearStr
              }, { merge: true });
              await app.db.collection('walletTransactions').add({
                userId: uid, userName, type: 'gift', amount: giftVal, status: 'approved',
                method: 'birthday_gift', note: `🎂 هدية عيد الميلاد (${yearStr})`, date: today,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              }).catch(() => {});
              giftSummary = `🎁 هدية عيد ميلادك: تم إضافة ${app.fmtMoney(giftVal)} ج.م إلى محفظتك مجاناً!`;
            } catch (err) {
              // Firestore rules prevented self-credit -> notify Admin to grant in 1 click!
              giftSummary = `🎁 هدية عيد ميلادك (${app.fmtMoney(giftVal)} ج.م) جاري تفعيلها فوراً من الإدارة!`;
              await app.sendNotification('ADMIN', '🎂 عيد ميلاد عضو اليوم — يستحق هديته', `اليوم عيد ميلاد ${userName} — الهدية المقررة: ${app.fmtMoney(giftVal)} ج.م (من لوحة أعياد الميلاد والهدايا).`).catch(() => {});
            }
          } else if (giftType === 'vip_days' && giftVal > 0) {
            try {
              const baseTs = Math.max(Date.now(), Number(app.profile.vipUntil || 0));
              await app.db.collection('users').doc(uid).set({
                vipUntil: baseTs + giftVal * 86400000,
                lastBirthdayGiftYear: yearStr
              }, { merge: true });
              giftSummary = `👑 هدية عيد ميلادك: تم تفعيل باقة VIP مجاناً لمدة ${giftVal} يوم!`;
            } catch (err) {
              giftSummary = `👑 هدية عيد ميلادك (${giftVal} يوم VIP) جاري تفعيلها فوراً من الإدارة!`;
              await app.sendNotification('ADMIN', '🎂 عيد ميلاد عضو اليوم — يستحق هدية VIP', `اليوم عيد ميلاد ${userName} — الهدية المقررة: ${giftVal} يوم VIP.`).catch(() => {});
            }
          }

          await app.db.collection('users').doc(uid).set({ lastBirthdayGiftYear: yearStr }, { merge: true }).catch(() => {});
          await app.sendNotification(uid, '🎂 كل سنة وأنت طيب يا بطل!', `${msgBody}${giftSummary ? '\n' + giftSummary : ''}`).catch(() => {});
          this.showBirthdayCelebrationModal(userName, msgBody, giftSummary);
        };
      }
    },

    // ==================== 4. FIX BROADCAST TAB RESET, HEALTH BUTTON STYLE & 21/21 DIAGNOSTIC ====================
    patchSystemIntegrations() {
      const app = window.DamanApp;
      if (!app) return;

      if (window.DamanCatAds && typeof DamanCatAds.openAdminCategoriesTab === 'function' && !DamanCatAds._bcastResetFixedV41) {
        DamanCatAds._bcastResetFixedV41 = true;
        const origOpenCat = DamanCatAds.openAdminCategoriesTab.bind(DamanCatAds);
        DamanCatAds.openAdminCategoriesTab = function () {
          if (window.DamanAdmin) {
            DamanAdmin._viewingKycVaultTab = false;
            DamanAdmin._viewingBdayTab = false;
            DamanAdmin._viewingBroadcastTab = false;
          }
          return origOpenCat();
        };
      }

      // Preserve green badge styling on "🩺 فحص الترابط" across all dynamic admin tabs
      if (window.DamanAdmin && typeof DamanAdmin.render === 'function' && !DamanAdmin._healthStylePreservedV41) {
        DamanAdmin._healthStylePreservedV41 = true;
        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          const hBtn = container.querySelector('[data-sync-health-btn]');
          if (hBtn) {
            hBtn.className = 'shrink-0 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-black';
          }
        };
      }

      if (window.DamanSync && typeof DamanSync.openHealthReportModal === 'function' && !DamanSync._healthV41Patched) {
        DamanSync._healthV41Patched = true;
        DamanSync.openHealthReportModal = function () {
          const checks = [
            ['النواة الأساسية (app-core)', !!window.DamanApp],
            ['المحفظة والتوثيق (wallet-kyc + ops)', !!window.DamanWallet],
            ['تنبيه يوم عمل + حماية التوقيت (wallet-sla v41)', !!window.DamanWalletSLA],
            ['الشات والعقود والمكالمات (chat-support + extras)', !!window.DamanChat],
            ['المايك والملفات واللوكيشن (chat-media)', !!(window.DamanChat && DamanChat._mediaPluginAttached)],
            ['السوق والـ 3x وعمالة VIP (projects-escrow)', !!window.DamanProjects],
            ['لوحة الشركات (company-panel)', !!window.DamanCompany],
            ['إشعارات الشركات وعلامات (؟) للمودال (company-enhancements)', !!(window.DamanCompanyEnh && DamanCompanyEnh._syncFixedV38)],
            ['لوحة الإدارة 360° (admin + ext + ext2)', !!(window.DamanAdmin && DamanAdmin._ext1Ready)],
            ['صوت وملفات مراقبة الشات (admin-chat-media)', !!(window.DamanAdmin && DamanAdmin._watchMediaPatched)],
            ['الأقسام الديناميكية وإعلاناتها (categories-ads)', !!window.DamanCatAds],
            ['باقة الـ 60 قسم الشاملة (categories-pack)', !!(window.DamanCatAds && DamanCatAds._packV33Attached)],
            ['البحث الشامل (global-search)', !!window.DamanSearch],
            ['رقم المنشور وتحذير الأمان (post-contact-guard)', !!window.DamanPostContact],
            ['أرشيف البطاقات والسجلات (kyc-vault)', !!window.DamanKycVault],
            ['المشاركة وQR العقد والصفحة (share-qr)', !!(window.DamanShareQR && DamanShareQR._syncFixedV38)],
            ['كاميرا QR + كاميرا التوثيق + أعياد الميلاد (kyc-bday-qr)', !!(window.DamanKycBdayQR && DamanKycBdayQR._rulesResilientV41)],
            ['الإشعارات الجماعية + الحاسبة + انتهاء البطاقات (admin-growth-ops)', !!window.DamanGrowthOps],
            ['ربط الإشعارات والصوت والتكامل (system-sync)', !!this._booted],
            ['مكتبة رسم الـ QRCode', typeof window.QRCode !== 'undefined'],
            ['اتصال Firebase Firestore', !!(app.db && app.auth)]
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
                <h3 class="text-sm font-black ${allOk ? 'text-emerald-400' : 'text-amber-400'}">🩺 تقرير فحص المنظومة الشامل v41 (${passed}/${checks.length})</h3>
                <button type="button" onclick="document.getElementById('daman-health-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between">
                <span>عدد الأقسام الفعّالة: <b class="text-amber-300">${(app.CATEGORIES || []).length} قسم</b></span>
                <button type="button" onclick="DamanSync.playChime('notif')" class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">🔊 تجربة النغمة</button>
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
      }
    },

    // ==================== BOOT ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.loadConfig().then(() => {
        if (app.activeTab === 'wallet') this.enhanceWalletTab();
      });

      this.patchKycAndBirthdayReliability();
      this.patchSystemIntegrations();

      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(() => {
          clearTimeout(this._timer);
          this._timer = setTimeout(() => {
            if (window.DamanApp?.activeTab === 'wallet') this.enhanceWalletTab();
            this.enhanceOpenWalletModals();
          }, 80);
        });
        this._obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      if (typeof app.renderCurrentTab === 'function' && !app._slaTabHooked) {
        app._slaTabHooked = true;
        const origRender = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRender();
          if (app.activeTab === 'wallet') setTimeout(() => this.enhanceWalletTab(), 80);
        };
      }

      setTimeout(() => {
        this.patchKycAndBirthdayReliability();
        this.patchSystemIntegrations();
        if (app.activeTab === 'wallet') this.enhanceWalletTab();
        this.enhanceOpenWalletModals();
      }, 650);
    }
  };

  window.DamanWalletSLA = WalletSLA;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => WalletSLA.boot(), 620));
  else setTimeout(() => WalletSLA.boot(), 620);
})();
