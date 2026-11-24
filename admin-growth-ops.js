(function () {
  const AdminGrowthOps = {
    _booted: false,

    // ==================== 1. FIX CAMERA BLOB FALLBACK + TAB SYNC ====================
    patchCameraAndTabs() {
      const app = window.DamanApp;
      if (!app) return;

      // Fix WebView DataTransfer fallback on Live KYC Camera
      if (window.DamanKycBdayQR && !DamanKycBdayQR._camFallbackFixed) {
        DamanKycBdayQR._camFallbackFixed = true;
        DamanKycBdayQR.snapInAppCameraPhoto = function () {
          const vid = document.getElementById('daman-kyc-cam-vid');
          const targetInp = this._camTargetInputId ? document.getElementById(this._camTargetInputId) : null;
          if (!vid || !targetInp) return;

          const c = document.createElement('canvas');
          c.width = vid.videoWidth || 1024;
          c.height = vid.videoHeight || 768;
          const ctx = c.getContext('2d');
          ctx.drawImage(vid, 0, 0, c.width, c.height);

          c.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], `kyc-live-${Date.now()}.jpg`, { type: 'image/jpeg' });
            let assigned = false;
            try {
              const dt = new DataTransfer();
              dt.items.add(file);
              targetInp.files = dt.files;
              assigned = !!(targetInp.files && targetInp.files.length);
            } catch (e) {}

            if (assigned) {
              targetInp.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              const handler = targetInp.onchange || window.DamanWallet?.handleKycFile;
              if (typeof handler === 'function') {
                handler.call(targetInp, { target: { files: [file] }, files: [file] });
              }
            }
            this.closeInAppCamera();
            app.toast('تم التقاط الصورة بالكاميرا بنجاح ✅', 'success');
          }, 'image/jpeg', 0.88);
        };
      }

      // Reset _viewingBdayTab when jumping directly to Categories tab
      if (window.DamanCatAds && typeof DamanCatAds.openAdminCategoriesTab === 'function' && !DamanCatAds._bdayResetFixed) {
        DamanCatAds._bdayResetFixed = true;
        const origOpenCat = DamanCatAds.openAdminCategoriesTab.bind(DamanCatAds);
        DamanCatAds.openAdminCategoriesTab = function () {
          if (window.DamanAdmin) {
            DamanAdmin._viewingKycVaultTab = false;
            DamanAdmin._viewingBdayTab = false;
          }
          return origOpenCat();
        };
      }
    },

    // ==================== 2. ENHANCE KYC VAULT WITH ID EXPIRY FILTER & ADMIN RENEWAL ALERT ====================
    isExpiringOrExpired(expDateStr) {
      if (!expDateStr) return null;
      const app = window.DamanApp;
      const today = app ? app.todayLocal() : new Date().toISOString().slice(0, 10);
      if (expDateStr <= today) return 'expired';
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      if (expDateStr <= in30) return 'soon';
      return 'valid';
    },

    async sendIdRenewalReminder(uid, name) {
      const app = window.DamanApp;
      if (!app || !app.hasAdminAccess() || !uid) return;
      await app.sendNotification(
        uid,
        '🪪 تنبيه من الإدارة: تجديد البطاقة الشخصية',
        `مرحباً ${name || ''}، يرجى تجديد تصوير البطاقة الشخصية السارية من صفحة التوثيق في التطبيق لضمان استمرار صلاحية حسابك وعقودك المضمونة.`
      );
      await app.logAudit('kyc_renewal_alert', `إرسال تنبيه تجديد بطاقة إلى ${name || uid}`);
      app.toast(`تم إرسال إشعار تجديد البطاقة إلى ${name || 'المستخدم'} 🔔`, 'success');
    },

    async editUserIdExpiryDate(uid, currentExp) {
      const app = window.DamanApp;
      if (!app || !app.isAdmin() || !uid) return;
      const nextVal = window.prompt('أدخل تاريخ انتهاء البطاقة الجديد (YYYY-MM-DD):', currentExp || '2030-01-01');
      if (!nextVal || !/^\d{4}-\d{2}-\d{2}$/.test(nextVal.trim())) {
        if (nextVal !== null) app.toast('صيغة التاريخ يجب أن تكون YYYY-MM-DD (مثال: 2030-05-15)', 'warning');
        return;
      }
      const cleanDate = nextVal.trim();
      const expired = cleanDate <= app.todayLocal();
      await Promise.all([
        app.db.collection('kycRequests').doc(uid).set({ idExpiryDate: cleanDate }, { merge: true }).catch(() => {}),
        app.db.collection('users').doc(uid).set({ idExpiryDate: cleanDate, idExpiryExpired: expired }, { merge: true }).catch(() => {})
      ]);
      await app.logAudit('kyc_expiry_edit', `تعديل تاريخ انتهاء بطاقة ${uid} إلى ${cleanDate}`);
      app.toast('تم تحديث تاريخ انتهاء البطاقة ✅', 'success');
      if (window.DamanKycVault) {
        DamanKycVault.loadArchive(true);
        DamanKycVault.openDocsModal(uid, false);
      }
    },

    patchKycVaultExpiryControls() {
      const Vault = window.DamanKycVault;
      const app = window.DamanApp;
      if (!Vault || !app || Vault._expiryAdminPatched) return;
      Vault._expiryAdminPatched = true;

      const origFilters = Vault.renderFilterButtonsHTML.bind(Vault);
      Vault.renderFilterButtonsHTML = function () {
        const expCnt = (this.docs || []).filter((d) => {
          const st = AdminGrowthOps.isExpiringOrExpired(d.idExpiryDate);
          return st === 'expired' || st === 'soon';
        }).length;
        const base = origFilters();
        return base + `<button type="button" onclick="DamanKycVault.setFilter('expiring')" class="shrink-0 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-black ${this.filterStatus === 'expiring' ? 'bg-rose-500 text-white border-rose-400' : 'bg-slate-950 border-rose-500/40 text-rose-300'}">⚠️ منتهية/قاربت (${expCnt})</button>`;
      };

      const origList = Vault.renderArchiveListOnly.bind(Vault);
      Vault.renderArchiveListOnly = function () {
        if (this.filterStatus === 'expiring') {
          const el = document.getElementById('daman-kycv-list');
          const bar = document.getElementById('daman-kycv-filters');
          if (bar) bar.innerHTML = this.renderFilterButtonsHTML();
          if (!el) return;
          const list = (this.docs || []).filter((d) => {
            const st = AdminGrowthOps.isExpiringOrExpired(d.idExpiryDate);
            return st === 'expired' || st === 'soon';
          });
          if (!list.length) {
            el.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-emerald-300 font-bold">✅ جميع البطاقات المسجّلة بتاريخ انتهاء سارية حالياً!</div>`;
            return;
          }
          el.innerHTML = list.map((d) => {
            const uid = d.userId || d.id;
            const expSt = AdminGrowthOps.isExpiringOrExpired(d.idExpiryDate);
            return `
              <div class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/50">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="font-black text-white truncate">${app.esc(d.legalName || d.displayName || 'مستخدم')}</div>
                    <div class="text-[10px] text-rose-300 font-black">انتهاء البطاقة: ${app.esc(d.idExpiryDate)} (${expSt === 'expired' ? 'منتهية ❌' : 'تنتهي خلال 30 يوم ⏳'})</div>
                  </div>
                  ${this.statusBadge(d.status)}
                </div>
                <div class="flex gap-1.5">
                  <button type="button" onclick="DamanKycVault.openDocsModal('${app.esc(uid)}',false)" class="flex-1 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">عرض المستندات</button>
                  <button type="button" onclick="DamanGrowthOps.sendIdRenewalReminder('${app.esc(uid)}','${app.esc(d.legalName || d.displayName || '').replace(/'/g, "\\'")}')" class="px-3 py-2 rounded-xl bg-rose-500 text-white font-black text-[10.5px]">🔔 تنبيه تجديد</button>
                </div>
              </div>`;
          }).join('');
          return;
        }

        origList();
        // Append expiry date badge to rendered cards
        const el = document.getElementById('daman-kycv-list');
        if (!el) return;
        Array.from(el.children).forEach((card) => {
          if (card.dataset.expBadged) return;
          card.dataset.expBadged = '1';
          const btn = card.querySelector('button[onclick*="DamanKycVault.openDocsModal"]');
          const m = btn && (btn.getAttribute('onclick') || '').match(/openDocsModal\('([^']+)'/);
          if (!m || !m[1]) return;
          const doc = (this.docs || []).find((x) => (x.userId || x.id) === m[1]);
          if (!doc || !doc.idExpiryDate) return;
          const st = AdminGrowthOps.isExpiringOrExpired(doc.idExpiryDate);
          const tag = document.createElement('div');
          tag.className = `text-[10px] font-black ${st === 'expired' ? 'text-rose-400' : st === 'soon' ? 'text-amber-300' : 'text-emerald-300'}`;
          tag.textContent = `📅 انتهاء البطاقة: ${doc.idExpiryDate} ${st === 'expired' ? '(منتهية ❌)' : st === 'soon' ? '(تنتهي قريباً ⏳)' : '(سارية ✅)'}`;
          card.insertBefore(tag, card.lastElementChild);
        });
      };

      const origOpenModal = Vault.openDocsModal.bind(Vault);
      Vault.openDocsModal = async function (uid, isSelf) {
        await origOpenModal(uid, isSelf);
        const modal = document.getElementById('daman-kycv-modal');
        const inner = modal && modal.firstElementChild;
        if (!inner || inner.querySelector('.daman-kycv-exp-bar')) return;

        let expDate = '';
        try {
          const kSnap = await app.db.collection('kycRequests').doc(uid).get();
          if (kSnap.exists) expDate = kSnap.data().idExpiryDate || '';
        } catch (e) {}

        const st = AdminGrowthOps.isExpiringOrExpired(expDate);
        const bar = document.createElement('div');
        bar.className = 'daman-kycv-exp-bar p-2.5 rounded-2xl bg-slate-950 border border-amber-500/40 flex items-center justify-between gap-2 text-[10.5px]';
        bar.innerHTML = `
          <div>
            <span class="text-slate-400">تاريخ انتهاء البطاقة:</span>
            <b class="${st === 'expired' ? 'text-rose-400' : 'text-emerald-300'} ms-1">${app.esc(expDate || 'غير مسجّل')}</b>
            ${st === 'expired' ? '<span class="text-rose-400 font-black"> (منتهية ❌)</span>' : ''}
          </div>
          ${!isSelf && app.isAdmin() ? `
            <div class="flex gap-1 shrink-0">
              <button type="button" onclick="DamanGrowthOps.editUserIdExpiryDate('${app.esc(uid)}','${app.esc(expDate)}')" class="px-2 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">تعديل</button>
              <button type="button" onclick="DamanGrowthOps.sendIdRenewalReminder('${app.esc(uid)}','')" class="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">🔔 تجديد</button>
            </div>` : ''}`;

        const header = inner.firstElementChild;
        if (header && header.nextSibling) inner.insertBefore(bar, header.nextSibling);
      };
    },

    // ==================== 3. ADMIN BROADCAST CENTER (MASS NOTIFICATIONS) ====================
    async sendBroadcastNotifications(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app || !app.isAdmin()) return;

      const segment = document.getElementById('bcast-seg')?.value || 'all';
      const title = (document.getElementById('bcast-title')?.value || '').trim();
      const body = (document.getElementById('bcast-body')?.value || '').trim();
      if (!title || !body) return;

      await app.withLock('sendBroadcast', async () => {
        const snap = await app.db.collection('users').limit(450).get();
        const now = Date.now();
        const today = app.todayLocal();

        const targets = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((u) => {
            if (u.status === 'banned') return false;
            if (segment === 'contractors') return (u.accountType || 'individual') === 'individual';
            if (segment === 'companies') return u.accountType === 'company' || u.accountType === 'supplier';
            if (segment === 'vip') return Number(u.vipUntil || 0) > now;
            if (segment === 'unverified') return u.kycStatus !== 'verified' || (u.idExpiryDate && u.idExpiryDate <= today);
            return true;
          });

        if (!targets.length) return app.toast('لا يوجد مستخدمون في هذه الفئة حالياً', 'warning');
        if (!window.confirm(`إرسال هذا الإشعار الفوري إلى ${targets.length} مستخدم؟`)) return;

        // Fast Firestore batch write (up to 450 docs in 1 network round-trip)
        const batch = app.db.batch();
        targets.forEach((u) => {
          const ref = app.db.collection('notifications').doc();
          batch.set(ref, {
            userId: u.id,
            title,
            body,
            read: false,
            date: today,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
        await app.logAudit('admin_broadcast', `إشعار جماعي (${segment}) إلى ${targets.length} مستخدم: ${title}`);
        e.target.reset();
        app.toast(`تم إرسال الإشعار إلى ${targets.length} مستخدم بنجاح 📢`, 'success');
      });
    },

    renderBroadcastPanel(app) {
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanGrowthOps.sendBroadcastNotifications(event)" class="glass-card rounded-2xl p-4 border-sky-500/40 space-y-3">
            <div>
              <h3 class="text-sm font-black text-sky-300">📢 مركز الإشعارات الجماعية والعروض</h3>
              <p class="text-[10.5px] text-slate-400">أرسل إشعاراً فورياً يظهر في جرس التنبيهات وبنغمة تنبيه لجميع الأعضاء أو لفئة محددة.</p>
            </div>

            <div>
              <label class="block text-[10.5px] text-amber-300 font-bold mb-1">الفئة المستهدفة *</label>
              <select id="bcast-seg" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black">
                <option value="all">🌐 جميع مستخدمي المنصة</option>
                <option value="contractors">👷 المقاولين والفنيين (الأفراد)</option>
                <option value="companies">🏢 الشركات والمورّدين B2B</option>
                <option value="vip">👑 المشتركين في باقة VIP</option>
                <option value="unverified">🪪 غير الموثّقين أو أصحاب البطاقات المنتهية</option>
              </select>
            </div>

            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">عنوان الإشعار *</label>
              <input id="bcast-title" type="text" required placeholder="مثال: عرض خاص على الاستلام الهندسي 3x أو تحديث جديد" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div>
              <label class="block text-[10.5px] text-slate-300 font-bold mb-1">نص الرسالة *</label>
              <textarea id="bcast-body" rows="3" required placeholder="اكتب تفاصيل العرض أو التنبيه الرسمي هنا..." class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            </div>

            <button type="submit" class="w-full py-3 rounded-2xl bg-sky-500 text-slate-950 font-black text-xs shadow-lg shadow-sky-500/20">
              <i class="fa-solid fa-paper-plane me-1"></i> إرسال الإشعار الجماعي الآن
            </button>
          </form>
        </div>`;
    },

    // ==================== 4. ESCROW & COMMISSION CALCULATOR FOR USERS & CONTRACTORS ====================
    openCommissionCalculator() {
      const app = window.DamanApp;
      if (!app) return;
      const feePct = Number(app.appConfig?.escrowFeePercent ?? 3.5);

      let m = document.getElementById('daman-calc-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-calc-modal';
        m.className = 'daman-modal fixed inset-0 z-[96] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'calcModal' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-emerald-500/50 rounded-3xl p-4 space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-emerald-400"><i class="fa-solid fa-calculator me-1"></i> حاسبة الضمان المالي والأرباح</h3>
            <button type="button" onclick="document.getElementById('daman-calc-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div>
            <label class="block text-[10.5px] text-slate-300 font-bold mb-1">أدخل إجمالي قيمة العقد / العملية (ج.م)</label>
            <input id="dcalc-amt" type="number" min="100" value="50000" oninput="DamanGrowthOps.recalcCommission()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/50 text-amber-300 font-black text-base text-center" />
          </div>

          <div id="dcalc-result" class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-[11px]"></div>

          <button type="button" onclick="document.getElementById('daman-calc-modal').classList.add('hidden'); DamanApp.switchTab('chat')" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">
            🛡️ ابدأ عقداً مضموناً الآن في الشات
          </button>
        </div>`;

      this.recalcCommission();
    },

    recalcCommission() {
      const app = window.DamanApp;
      const box = document.getElementById('dcalc-result');
      if (!box || !app) return;
      const amt = Math.max(0, parseFloat(document.getElementById('dcalc-amt')?.value) || 0);
      const pct = Number(app.appConfig?.escrowFeePercent ?? 3.5);
      const fee = Math.round((amt * pct) / 100);
      const net = Math.max(0, amt - fee);

      box.innerHTML = `
        <div class="flex justify-between"><span>إجمالي مبلغ العقد المحجوز:</span><b class="text-white">${app.fmtMoney(amt)} ج.م</b></div>
        <div class="flex justify-between"><span>رسوم الضمان المالي (${pct}%):</span><b class="text-amber-300">${app.fmtMoney(fee)} ج.م</b></div>
        <div class="flex justify-between pt-2 border-t border-slate-800 text-xs"><span>صافي المستحق للمنفّذ عند التسليم:</span><b class="text-emerald-400">${app.fmtMoney(net)} ج.م</b></div>`;
    },

    // ==================== 5. ADMIN PHONE MODERATION ON POSTS ====================
    async removePostContactPhone(pid) {
      const app = window.DamanApp;
      if (!app || !app.hasAdminAccess() || !pid) return;
      if (!window.confirm('حذف رقم الهاتف الخارجي من هذا المنشور والإبقاء على الدردشة الداخلية فقط؟')) return;
      await app.db.collection('projects').doc(pid).update({
        contactPhone: '',
        contactWhatsapp: false
      });
      await app.logAudit('post_remove_phone', `حذف رقم هاتف خارجي من المنشور ${pid}`);
      app.toast('تم حذف الرقم من المنشور ✅', 'success');
    },

    // ==================== 6. BOOT & HOOKS ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.patchCameraAndTabs();
      this.patchKycVaultExpiryControls();

      // Inject Broadcast tab in Admin Panel cleanly
      if (window.DamanAdmin && !DamanAdmin._bcastTabHooked) {
        DamanAdmin._bcastTabHooked = true;
        const prevSetTab = DamanAdmin.setSubTab.bind(DamanAdmin);
        DamanAdmin.setSubTab = function (t) {
          if (t === 'broadcast') {
            if (!window.DamanApp.isAdmin()) return window.DamanApp.toast('للأدمن الرئيسي فقط', 'error');
            this._viewingCategoriesTab = false;
            this._viewingKycVaultTab = false;
            this._viewingBdayTab = false;
            this._viewingBroadcastTab = true;
            this.rerender();
            return;
          }
          this._viewingBroadcastTab = false;
          return prevSetTab(t);
        };

        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          try {
            if (!a.isAdmin()) return;
            const tabBar = container.querySelector('.overflow-x-auto');
            if (!tabBar) return;

            const isBcastActive = !!DamanAdmin._viewingBroadcastTab;
            if (isBcastActive) {
              Array.from(tabBar.querySelectorAll('button')).forEach((b) => {
                b.className = 'shrink-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300';
              });
            }

            let btn = tabBar.querySelector('[data-adm-bcast-tab]');
            if (!btn) {
              btn = document.createElement('button');
              btn.setAttribute('data-adm-bcast-tab', '1');
              btn.onclick = () => DamanAdmin.setSubTab('broadcast');
              btn.textContent = '📢 إشعار جماعي';
              tabBar.appendChild(btn);
            }
            btn.className = `shrink-0 px-3 py-2 rounded-xl ${isBcastActive ? 'bg-sky-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-800 text-slate-300'}`;

            if (isBcastActive) {
              while (tabBar.nextElementSibling) tabBar.nextElementSibling.remove();
              const slot = document.createElement('div');
              slot.innerHTML = this.renderBroadcastPanel(a);
              tabBar.parentNode.appendChild(slot);
            }
          } catch (e) {}
        };
      }

      // Add "🧮 حاسبة الضمان" button inside Wallet Tab
      if (typeof app.renderCurrentTab === 'function' && !app._calcWalletHooked) {
        app._calcWalletHooked = true;
        const origRenderTab = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRenderTab();
          if (app.activeTab === 'wallet') {
            setTimeout(() => {
              const main = document.getElementById('app-main');
              if (!main || document.getElementById('daman-wallet-calc-bar')) return;
              const root = main.firstElementChild || main;
              const btn = document.createElement('button');
              btn.id = 'daman-wallet-calc-bar';
              btn.type = 'button';
              btn.className = 'w-full mb-3 py-2.5 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-black text-xs flex items-center justify-center gap-2';
              btn.innerHTML = '<i class="fa-solid fa-calculator"></i><span>حاسبة عمولة الضمان المالي وصافي العقد</span>';
              btn.onclick = () => this.openCommissionCalculator();
              root.insertBefore(btn, root.firstElementChild);
            }, 60);
          }
        };
      }

      // Show full phone + Remove Phone button for Admin inside Post Details Modal
      if (window.DamanProjects && typeof DamanProjects.openPostDetails === 'function' && !DamanProjects._admPhoneModHooked) {
        DamanProjects._admPhoneModHooked = true;
        const origDet = DamanProjects.openPostDetails.bind(DamanProjects);
        DamanProjects.openPostDetails = (pid) => {
          origDet(pid);
          if (!app.hasAdminAccess()) return;
          const p = DamanProjects.getAllMarketPosts(app).find((x) => x.id === pid);
          if (!p || !p.contactPhone) return;
          const modal = document.getElementById('daman-post-detail-modal');
          const card = modal && modal.firstElementChild;
          if (!card || card.querySelector('.daman-adm-phone-mod')) return;
          const div = document.createElement('div');
          div.className = 'daman-adm-phone-mod p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-between gap-2 text-[10.5px]';
          div.innerHTML = `
            <span class="text-rose-200 font-bold" dir="ltr">👑 رقم المعلن: ${app.esc(p.contactPhone)}</span>
            <button type="button" onclick="DamanGrowthOps.removePostContactPhone('${app.esc(pid)}'); document.getElementById('daman-post-detail-modal').classList.add('hidden')" class="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-[10px]">حذف الرقم</button>`;
          card.appendChild(div);
        };
      }

      setTimeout(() => {
        this.patchCameraAndTabs();
        this.patchKycVaultExpiryControls();
      }, 650);
    }
  };

  window.DamanGrowthOps = AdminGrowthOps;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => AdminGrowthOps.boot(), 580));
  else setTimeout(() => AdminGrowthOps.boot(), 580);
})();
