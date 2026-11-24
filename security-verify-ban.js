(function () {
  const SecurityVerifyBan = {
    _booted: false,
    usersList: [],
    filterStatus: 'all', // 'all' | 'banned' | 'frozen' | 'active'
    searchQuery: '',
    _syncedTickets: new Set(),

    // ==================== 1. PUBLIC SAFE CONTRACT VERIFY MIRROR (NO SENSITIVE PII) ====================
    syncAgreementsToPublicVerify() {
      const app = window.DamanApp;
      const ags = window.DamanChat?.agreements;
      if (!app || !app.db || !app.user || !Array.isArray(ags) || !ags.length) return;

      ags.forEach((ag) => {
        const tkt = String(ag.ticketNumber || '').trim().toUpperCase();
        if (!tkt) return;
        const sig = `${tkt}_${ag.status}_${ag.contractStatus}_${ag.remainingEscrow}_${ag.totalAmount}`;
        if (this._syncedTickets.has(sig)) return;
        this._syncedTickets.add(sig);

        // Store ONLY non-sensitive public verification fields (no National IDs, no phones, no private notes)
        app.db.collection('contractVerify').doc(tkt).set({
          ticketNumber: tkt,
          title: ag.title || 'عقد رسمي بالضمان المالي',
          status: ag.status || 'draft',
          contractStatus: ag.contractStatus || 'pending',
          totalAmount: Number(ag.totalAmount || 0),
          remainingEscrow: Number(ag.remainingEscrow || 0),
          startDate: ag.startDate || ag.date || '',
          endDate: ag.endDate || '',
          location: ag.location || '',
          payerName: ag.payerName || ag.payerLegalName || 'الطرف الأول',
          providerName: ag.providerName || ag.providerLegalName || 'الطرف الثاني',
          addonsCount: Array.isArray(ag.addons) ? ag.addons.length : 0,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(() => {});
      });
    },

    patchPublicContractVerification() {
      const QR = window.DamanShareQR;
      const app = window.DamanApp;
      if (!QR || !app || QR._publicVerifyV43) return;
      QR._publicVerifyV43 = true;

      // Always open the 3-in-1 Camera QR + Image QR + Manual Code modal
      QR.promptVerifyContractCode = () => {
        if (window.DamanKycBdayQR && typeof DamanKycBdayQR.openContractScannerModal === 'function') {
          DamanKycBdayQR.openContractScannerModal();
        }
      };

      // Enhanced verify modal: works for ANY contract (own, admin, or third-party via public contractVerify)
      QR.openContractVerifyModal = async function (ticketNumber) {
        if (!ticketNumber) return;
        const cleanCode = String(ticketNumber).trim().toUpperCase();

        let m = document.getElementById('daman-verify-ct-modal');
        if (!m) {
          m = document.createElement('div');
          m.id = 'daman-verify-ct-modal';
          m.className = 'daman-modal fixed inset-0 z-[97] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
          document.body.appendChild(m);
        }
        m.classList.remove('hidden');
        try { history.pushState({ damanModal: 'verifyContract' }, ''); } catch (e) {}

        m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 text-center text-xs text-amber-300 font-bold">جارٍ التحقق الرسمي من العقد (${app.esc(cleanCode)})...</div>`;

        // 1. Check local cache first
        let ag = (window.DamanChat && Array.isArray(DamanChat.agreements))
          ? DamanChat.agreements.find((a) => String(a.ticketNumber || '').toUpperCase() === cleanCode)
          : null;

        // 2. Check full chatAgreements (works for parties & admin)
        if (!ag && app.db) {
          try {
            const snap = await app.db.collection('chatAgreements').where('ticketNumber', '==', cleanCode).limit(1).get();
            if (!snap.empty) ag = Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
          } catch (e) {}
        }

        // 3. Fallback to public safe verification doc (works for ANY user / third party / QR scan!)
        let isPublicDoc = false;
        let rulesBlocked = false;
        if (!ag && app.db) {
          try {
            const pubSnap = await app.db.collection('contractVerify').doc(cleanCode).get();
            if (pubSnap.exists) {
              ag = pubSnap.data();
              isPublicDoc = true;
            }
          } catch (err) {
            rulesBlocked = true;
          }
        }

        if (!ag) {
          m.innerHTML = `
            <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs text-center">
              <div class="text-2xl">${rulesBlocked ? '🔒' : '❌'}</div>
              <h3 class="text-sm font-black ${rulesBlocked ? 'text-amber-400' : 'text-rose-400'}">
                ${rulesBlocked ? `فحص عقود الآخرين يحتاج تفعيل قاعدة التحقق العامة` : `لم يتم العثور على عقد بكود ${app.esc(cleanCode)}`}
              </h3>
              <p class="text-[11px] text-slate-300 leading-relaxed">
                ${rulesBlocked
                  ? 'حالياً قواعد Firestore تسمح بقراءة العقد لأطرافه والإدارة فقط. لتفعيل فحص أي عقد بالـ QR أو الرقم لأي شخص، أضف قاعدة contractVerify في Firebase Rules.'
                  : 'تأكد من صحة رقم العقد (مثال: TKT-123456) أو أعد مسح رمز الـ QR المطبوع على العقد.'}
              </p>
              <div class="flex gap-2">
                <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden'); if(window.DamanKycBdayQR) DamanKycBdayQR.openContractScannerModal()" class="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">📷 مسح / فحص آخر</button>
                <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden')" class="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold">إغلاق</button>
              </div>
            </div>`;
          return;
        }

        const stMap = {
          draft: { txt: 'مسودة — لم يُحجز الضمان بعد', cls: 'bg-amber-500/20 text-amber-300' },
          funded: { txt: 'عقد سارٍ ومضمون مالياً 100% ✅', cls: 'bg-emerald-500/20 text-emerald-300' },
          disputed: { txt: 'قيد التحكيم الإداري ⚖️', cls: 'bg-rose-500/20 text-rose-300' },
          completed: { txt: 'مكتمل ومُصفّى بالكامل 🏁', cls: 'bg-sky-500/20 text-sky-300' },
          cancelled: { txt: 'ملغى ❌', cls: 'bg-slate-800 text-slate-400' }
        };
        const st = stMap[ag.status] || { txt: ag.status || '—', cls: 'bg-slate-800 text-slate-300' };
        const addonsCount = typeof ag.addonsCount === 'number' ? ag.addonsCount : (Array.isArray(ag.addons) ? ag.addons.length : 0);

        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-4 space-y-3 text-xs shadow-2xl">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-black text-emerald-400"><i class="fa-solid fa-certificate me-1"></i> شهادة تحقق رسمي — ضمان سايت</h3>
              <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-center space-y-1">
              <div class="text-base font-black text-white tracking-wider">${app.esc(ag.ticketNumber)}</div>
              <span class="inline-block px-3 py-1 rounded-xl ${st.cls} text-[11px] font-black">${st.txt}</span>
              ${isPublicDoc ? `<div class="text-[9.5px] text-slate-400 pt-0.5">شهادة تحقق عامة (البيانات الشخصية محمية 🔒)</div>` : ''}
            </div>

            <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
              <div class="font-black text-amber-300 text-xs">${app.esc(ag.title)}</div>
              <div class="grid grid-cols-2 gap-1.5 pt-1">
                <div>إجمالي القيمة: <b class="text-emerald-400">${app.fmtMoney(ag.totalAmount)} ج.م</b></div>
                <div>المتبقي بالضمان: <b class="text-amber-300">${app.fmtMoney(ag.remainingEscrow || 0)} ج.م</b></div>
                <div>تاريخ البداية: <b class="text-white">${app.esc(ag.startDate || ag.date || '—')}</b></div>
                <div>تاريخ التسليم: <b class="text-white">${app.esc(ag.endDate || '—')}</b></div>
              </div>
              <div class="pt-1.5 border-t border-slate-800 space-y-0.5 text-[10.5px] text-slate-300">
                <div>الطرف الأول: <b class="text-white">${app.esc(ag.payerName || ag.payerLegalName || '—')}</b></div>
                <div>الطرف الثاني: <b class="text-white">${app.esc(ag.providerName || ag.providerLegalName || '—')}</b></div>
                <div>موقع التنفيذ: <b>${app.esc(ag.location || '—')}</b></div>
                <div>اعتماد العقد الموقّع: <b class="${ag.contractStatus === 'approved' ? 'text-emerald-400' : 'text-amber-300'}">${ag.contractStatus === 'approved' ? 'معتمد رسمياً من الإدارة ✅' : 'بانتظار الاعتماد ⏳'}</b></div>
                ${addonsCount ? `<div>الملحقات والسيارات: <b class="text-purple-300">${addonsCount} ملحق مسجّل</b></div>` : ''}
              </div>
            </div>

            <div class="flex gap-2">
              <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden'); if(window.DamanKycBdayQR) DamanKycBdayQR.openContractScannerModal()" class="flex-1 py-2.5 rounded-xl bg-slate-800 text-amber-300 font-black">📷 فحص عقد آخر</button>
              <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden')" class="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">إغلاق</button>
            </div>
          </div>`;
      };
    },

    // Prominent Home Shortcut so any user/guest can scan QR or enter contract code in 1 tap
    injectHomeVerifyShortcut() {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'home') return;
      const main = document.getElementById('app-main');
      if (!main || document.getElementById('daman-home-qr-verify-bar')) return;
      const root = main.firstElementChild || main;

      const btn = document.createElement('button');
      btn.id = 'daman-home-qr-verify-bar';
      btn.type = 'button';
      btn.className = 'w-full mb-2.5 py-2.5 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-black text-xs flex items-center justify-between gap-2';
      btn.innerHTML = `
        <span class="flex items-center gap-2"><i class="fa-solid fa-qrcode text-base text-amber-400"></i><span>فحص والتحقق من أي عقد رسمي (كاميرا QR أو رقم العقد)</span></span>
        <span class="px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 text-[10px] font-black shrink-0">📷 فحص الآن</span>`;
      btn.onclick = () => {
        if (window.DamanKycBdayQR) DamanKycBdayQR.openContractScannerModal();
        else if (window.DamanShareQR) DamanShareQR.promptVerifyContractCode();
      };

      const searchWrap = document.getElementById('daman-home-gs-wrap');
      if (searchWrap && searchWrap.parentNode === root) root.insertBefore(btn, searchWrap.nextSibling);
      else root.insertBefore(btn, root.firstElementChild);
    },

    // ==================== 2. ADMIN BAN & FREEZE SYSTEM ====================
    async loadUsersForModeration(force = false) {
      const app = window.DamanApp;
      if (!app || !app.db || !app.hasAdminAccess()) return;
      if (!force && this.usersList.length) {
        this.renderBanPanelListOnly();
        return;
      }
      const listEl = document.getElementById('daman-ban-list');
      if (listEl) listEl.innerHTML = `<div class="p-6 text-center text-amber-300 font-bold">جارٍ تحميل قائمة الحسابات...</div>`;

      try {
        const snap = await app.db.collection('users').limit(350).get();
        this.usersList = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => {
            const rank = (u) => (u.status === 'banned' ? 0 : u.status === 'frozen' ? 1 : 2);
            return rank(a) - rank(b);
          });
      } catch (err) {
        app.toast('تعذر تحميل الحسابات: ' + err.message, 'error');
      }
      this.renderBanPanelListOnly();
    },

    async applyAccountStatus(uid, newStatus, userName) {
      const app = window.DamanApp;
      if (!app || !app.hasAdminAccess() || !uid) return;
      if (uid === app.user?.uid) return app.toast('لا يمكنك حظر أو تجميد حسابك الشخصي!', 'error');

      const target = this.usersList.find((u) => u.id === uid);
      if (target && target.role === 'admin') return app.toast('لا يمكن حظر حساب الأدمن الرئيسي', 'error');

      let reason = '';
      if (newStatus === 'banned') {
        const r = window.prompt(`سبب حظر حساب (${userName || uid}) نهائياً:`, 'مخالفة شروط الاستخدام وسياسة الأمان');
        if (r === null) return;
        reason = r.trim() || 'مخالفة شروط الاستخدام';
      } else if (newStatus === 'frozen') {
        const r = window.prompt(`سبب تجميد حساب ومحفظة (${userName || uid}) مؤقتاً:`, 'قيد المراجعة الأمنية والإدارية');
        if (r === null) return;
        reason = r.trim() || 'قيد المراجعة الإدارية';
      } else {
        if (!window.confirm(`فك التجميد/الحظر وإعادة تفعيل حساب (${userName || uid})؟`)) return;
      }

      await app.withLock('modStatus_' + uid, async () => {
        try {
          await app.db.collection('users').doc(uid).set({
            status: newStatus,
            frozen: newStatus === 'frozen',
            banReason: newStatus === 'active' ? '' : reason,
            statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusUpdatedBy: app.user.uid
          }, { merge: true });

          const notifMap = {
            banned: ['🚫 تم حظر حسابك', `تم حظر حسابك من قِبل إدارة ضمان سايت. السبب: ${reason}`],
            frozen: ['❄️ تم تجميد حسابك مؤقتاً', `تم تجميد حسابك ومحفظتك مؤقتاً لحين المراجعة. السبب: ${reason}`],
            active: ['✅ تم إعادة تفعيل حسابك', 'تم فك التجميد/الحظر وعاد حسابك للعمل بكامل الصلاحيات.']
          };
          const [nt, nb] = notifMap[newStatus] || notifMap.active;
          await app.sendNotification(uid, nt, nb).catch(() => {});
          await app.logAudit(`account_${newStatus}`, `${newStatus} للحساب ${userName || uid} — ${reason || 'تفعيل'}`);

          const idx = this.usersList.findIndex((u) => u.id === uid);
          if (idx >= 0) {
            this.usersList[idx].status = newStatus;
            this.usersList[idx].frozen = newStatus === 'frozen';
            this.usersList[idx].banReason = newStatus === 'active' ? '' : reason;
          }

          app.toast(newStatus === 'banned' ? 'تم حظر الحساب فوراً 🚫' : newStatus === 'frozen' ? 'تم تجميد الحساب مؤقتاً ❄️' : 'تم إعادة تفعيل الحساب بنجاح ✅', 'success');
          this.renderBanPanelListOnly();
        } catch (err) {
          app.toast('فشل تنفيذ الإجراء: ' + err.message, 'error');
        }
      });
    },

    renderBanFilterTabsHTML() {
      const cAll = this.usersList.length;
      const cBan = this.usersList.filter((u) => u.status === 'banned').length;
      const cFrz = this.usersList.filter((u) => u.status === 'frozen' || u.frozen).length;
      const cAct = this.usersList.filter((u) => u.status !== 'banned' && u.status !== 'frozen' && !u.frozen).length;

      return [
        ['all', `الكل (${cAll})`],
        ['banned', `🚫 محظور (${cBan})`],
        ['frozen', `❄️ مجمّد (${cFrz})`],
        ['active', `🟢 نشط (${cAct})`]
      ].map(([k, lbl]) => `
        <button type="button" onclick="DamanSecurityMod.filterStatus='${k}'; DamanSecurityMod.renderBanPanelListOnly()" class="shrink-0 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-black ${this.filterStatus === k ? 'bg-rose-500 text-white border-rose-400' : 'bg-slate-950 border-slate-800 text-slate-300'}">${lbl}</button>`).join('');
    },

    renderBanPanelListOnly() {
      const app = window.DamanApp;
      const fBar = document.getElementById('daman-ban-filters');
      const listEl = document.getElementById('daman-ban-list');
      if (fBar) fBar.innerHTML = this.renderBanFilterTabsHTML();
      if (!listEl) return;

      const q = app.normalizeAr(this.searchQuery || '');
      const list = this.usersList.filter((u) => {
        const isBan = u.status === 'banned';
        const isFrz = !isBan && (u.status === 'frozen' || !!u.frozen);
        if (this.filterStatus === 'banned' && !isBan) return false;
        if (this.filterStatus === 'frozen' && !isFrz) return false;
        if (this.filterStatus === 'active' && (isBan || isFrz)) return false;
        if (q) {
          const hay = `${u.name || ''} ${u.legalName || ''} ${u.companyName || ''} ${u.email || ''} ${u.phone || ''} ${u.nationalId || ''}`;
          if (!app.normalizeAr(hay).includes(q)) return false;
        }
        return true;
      });

      if (!list.length) {
        listEl.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد حسابات مطابقة.</div>`;
        return;
      }

      listEl.innerHTML = list.slice(0, 80).map((u) => {
        const isBan = u.status === 'banned';
        const isFrz = !isBan && (u.status === 'frozen' || !!u.frozen);
        const isMainAdm = u.id === app.user?.uid || u.role === 'admin';
        const disp = u.companyName || u.name || u.email || u.id;
        const safeName = app.esc(disp).replace(/'/g, "\\'");

        const badge = isBan
          ? '<span class="px-2 py-0.5 rounded-lg bg-rose-500/25 text-rose-300 text-[10px] font-black">🚫 محظور</span>'
          : isFrz
            ? '<span class="px-2 py-0.5 rounded-lg bg-sky-500/25 text-sky-300 text-[10px] font-black">❄️ مجمّد</span>'
            : '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black">🟢 نشط</span>';

        return `
          <div class="glass-card rounded-2xl p-3 space-y-2 ${isBan ? 'border-rose-500/60' : isFrz ? 'border-sky-500/60' : 'border-slate-800'}">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="font-black text-white truncate">${app.esc(disp)}</div>
                <div class="text-[10px] text-slate-400 truncate">${app.esc(u.phone || '—')} • ${app.esc(u.email || '')}</div>
              </div>
              ${badge}
            </div>
            ${u.banReason ? `<div class="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[10px] text-rose-200">السبب: <b>${app.esc(u.banReason)}</b></div>` : ''}
            <div class="flex flex-wrap gap-1.5 pt-0.5">
              ${!isMainAdm ? `
                ${(isBan || isFrz)
                  ? `<button type="button" onclick="DamanSecurityMod.applyAccountStatus('${app.esc(u.id)}','active','${safeName}')" class="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10.5px]">✅ فك الحظر / التجميد</button>`
                  : `<button type="button" onclick="DamanSecurityMod.applyAccountStatus('${app.esc(u.id)}','frozen','${safeName}')" class="flex-1 py-2 rounded-xl bg-sky-500/20 border border-sky-500/50 text-sky-300 font-black text-[10.5px]">❄️ تجميد مؤقت</button>`}
                ${!isBan ? `<button type="button" onclick="DamanSecurityMod.applyAccountStatus('${app.esc(u.id)}','banned','${safeName}')" class="flex-1 py-2 rounded-xl bg-rose-600 text-white font-black text-[10.5px]">🚫 حظر نهائي</button>` : ''}
              ` : '<span class="text-[10px] text-amber-300 font-bold">👑 حساب الإدارة الرئيسي (محمي)</span>'}
              ${window.DamanAdmin?.openUser360Modal ? `<button type="button" onclick="DamanAdmin.openUser360Modal('${app.esc(u.id)}')" class="px-2.5 py-2 rounded-xl bg-slate-800 text-amber-300 font-bold text-[10px]">360°</button>` : ''}
            </div>
          </div>`;
      }).join('');
    },

    renderBanAdminPanel(app) {
      setTimeout(() => this.loadUsersForModeration(false), 30);
      return `
        <div class="space-y-3 text-xs">
          <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/50 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-black text-rose-300">🚫 مركز حظر وتجميد الحسابات</div>
              <div class="text-[10px] text-slate-200">التجميد يوقف السحب والعقود والنشر مؤقتاً • الحظر يقفل التطبيق تماماً على العضو فوراً.</div>
            </div>
            <button type="button" onclick="DamanSecurityMod.loadUsersForModeration(true)" class="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-black text-[10px] shrink-0">تحديث</button>
          </div>

          <input type="search" value="${app.esc(this.searchQuery)}" oninput="DamanSecurityMod.searchQuery=this.value; DamanSecurityMod.renderBanPanelListOnly()" placeholder="ابحث باسم العضو، الموبايل، الإيميل، أو الرقم القومي..." class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-rose-500/40 text-xs text-white font-bold" />

          <div id="daman-ban-filters" class="flex items-center gap-1 overflow-x-auto pb-1">${this.renderBanFilterTabsHTML()}</div>
          <div id="daman-ban-list" class="space-y-2"></div>
        </div>`;
    },

    // ==================== 3. LIVE ENFORCEMENT FOR BANNED / FROZEN USERS ====================
    enforceCurrentUserStatus() {
      const app = window.DamanApp;
      if (!app || !app.user || !app.profile || app.isAdmin()) {
        document.getElementById('daman-banned-lockscreen')?.remove();
        document.getElementById('daman-frozen-banner')?.remove();
        return;
      }

      const st = app.profile.status;
      const isFrozen = st === 'frozen' || !!app.profile.frozen;
      const reason = app.profile.banReason || 'قيد المراجعة من إدارة ضمان سايت';

      // 1. FULL LOCKSCREEN FOR BANNED USERS
      if (st === 'banned') {
        if (!document.getElementById('daman-banned-lockscreen')) {
          const lock = document.createElement('div');
          lock.id = 'daman-banned-lockscreen';
          lock.className = 'fixed inset-0 z-[200] bg-slate-950/98 backdrop-blur-md flex items-center justify-center p-4 text-center';
          lock.innerHTML = `
            <div class="w-full max-w-sm bg-slate-900 border-2 border-rose-500 rounded-3xl p-5 space-y-3 text-xs shadow-2xl">
              <div class="text-4xl">🚫</div>
              <h2 class="text-base font-black text-rose-400">تم حظر هذا الحساب</h2>
              <p class="text-[11px] text-slate-200 leading-relaxed">تم إيقاف وصولك لمنصة ضمان سايت بقرار من الإدارة.</p>
              <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 font-bold">السبب: ${app.esc(reason)}</div>
              <button type="button" onclick="DamanApp.logout()" class="w-full py-3 rounded-2xl bg-rose-600 text-white font-black">تسجيل الخروج</button>
            </div>`;
          document.body.appendChild(lock);
        }
        return;
      }
      document.getElementById('daman-banned-lockscreen')?.remove();

      // 2. TOP BANNER + ACTION BLOCK FOR FROZEN USERS
      if (isFrozen) {
        const main = document.getElementById('app-main');
        if (main && !document.getElementById('daman-frozen-banner')) {
          const b = document.createElement('div');
          b.id = 'daman-frozen-banner';
          b.className = 'mb-3 p-3 rounded-2xl bg-sky-500/20 border-2 border-sky-400 text-xs space-y-2';
          b.innerHTML = `
            <div class="font-black text-sky-300">❄️ حسابك ومحفظتك مجمّدان مؤقتاً</div>
            <div class="text-[11px] text-slate-100">السبب: <b>${app.esc(reason)}</b> — السحب ونشر الإعلانات والعقود الجديدة متوقفة مؤقتاً لحين انتهاء المراجعة.</div>
            <button type="button" onclick="if(window.DamanChat) DamanChat.openSupportChat()" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-[11px]">💬 تواصل مع الإدارة والدعم الفني</button>`;
          main.insertBefore(b, main.firstElementChild);
        }
      } else {
        document.getElementById('daman-frozen-banner')?.remove();
      }
    },

    bindFrozenActionBlocker() {
      if (this._frozenBlockerBound) return;
      this._frozenBlockerBound = true;
      document.addEventListener('submit', (ev) => {
        const app = window.DamanApp;
        if (!app || !app.profile || app.isAdmin()) return;
        const isFrozen = app.profile.status === 'frozen' || !!app.profile.frozen;
        if (!isFrozen) return;
        // Allow support chat messages only; block posts, deposits/withdraws, contracts
        const form = ev.target;
        if (!form || form.closest('#daman-chat-area') || form.closest('#daman-global-search-modal')) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        app.toast('❄️ حسابك مجمّد مؤقتاً — تواصل مع إدارة ضمان سايت لفك التجميد', 'error');
      }, true);
    },

    // ==================== 4. BOOT & INTEGRATIONS ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.patchPublicContractVerification();
      this.bindFrozenActionBlocker();

      // Hook Admin Panel: add "🚫 الحظر والتجميد" tab + quick buttons in User 360°
      if (window.DamanAdmin && !DamanAdmin._banTabHookedV43) {
        DamanAdmin._banTabHookedV43 = true;

        const prevSetTab = DamanAdmin.setSubTab.bind(DamanAdmin);
        DamanAdmin.setSubTab = function (t) {
          if (t === 'ban_freeze') {
            if (!window.DamanApp.hasAdminAccess()) return window.DamanApp.toast('للإدارة فقط', 'error');
            this._viewingCategoriesTab = false;
            this._viewingKycVaultTab = false;
            this._viewingBdayTab = false;
            this._viewingBroadcastTab = false;
            this._viewingBanTab = true;
            this.rerender();
            return;
          }
          this._viewingBanTab = false;
          return prevSetTab(t);
        };

        if (window.DamanCatAds && typeof DamanCatAds.openAdminCategoriesTab === 'function') {
          const prevOpenCat = DamanCatAds.openAdminCategoriesTab.bind(DamanCatAds);
          DamanCatAds.openAdminCategoriesTab = function () {
            if (window.DamanAdmin) DamanAdmin._viewingBanTab = false;
            return prevOpenCat();
          };
        }

        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          try {
            if (!a.hasAdminAccess()) return;
            const tabBar = container.querySelector('.overflow-x-auto');
            if (!tabBar) return;

            const isBanActive = !!DamanAdmin._viewingBanTab;
            if (isBanActive) {
              Array.from(tabBar.querySelectorAll('button')).forEach((b) => {
                if (!b.hasAttribute('data-sync-health-btn')) {
                  b.className = 'shrink-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300';
                }
              });
            }

            let btn = tabBar.querySelector('[data-adm-ban-tab]');
            if (!btn) {
              btn = document.createElement('button');
              btn.setAttribute('data-adm-ban-tab', '1');
              btn.onclick = () => DamanAdmin.setSubTab('ban_freeze');
              btn.textContent = '🚫 الحظر والتجميد';
              tabBar.appendChild(btn);
            }
            btn.className = `shrink-0 px-3 py-2 rounded-xl ${isBanActive ? 'bg-rose-600 text-white font-black' : 'bg-slate-900 border border-rose-500/40 text-rose-300'}`;

            if (isBanActive) {
              while (tabBar.nextElementSibling) tabBar.nextElementSibling.remove();
              const slot = document.createElement('div');
              slot.innerHTML = this.renderBanAdminPanel(a);
              tabBar.parentNode.appendChild(slot);
            }
          } catch (e) {}
        };

        // Add quick Ban & Freeze buttons inside User 360° Modal
        if (typeof DamanAdmin.openUser360Modal === 'function') {
          const orig360 = DamanAdmin.openUser360Modal.bind(DamanAdmin);
          DamanAdmin.openUser360Modal = (uid) => {
            const r = orig360(uid);
            let tries = 0;
            const t = setInterval(() => {
              tries++;
              if (tries > 25) return clearInterval(t);
              const modal = document.getElementById('daman-u360-modal');
              if (!modal || modal.classList.contains('hidden')) return;
              const inner = modal.firstElementChild;
              if (!inner || inner.textContent.includes('جارٍ تحميل')) return;
              clearInterval(t);
              if (inner.querySelector('.daman-u360-ban-row')) return;
              const safeUid = app.esc(uid).replace(/'/g, "\\'");
              const row = document.createElement('div');
              row.className = 'daman-u360-ban-row grid grid-cols-3 gap-1.5';
              row.innerHTML = `
                <button type="button" onclick="DamanSecurityMod.applyAccountStatus('${safeUid}','frozen','هذا العضو')" class="py-2 rounded-xl bg-sky-500/20 border border-sky-500/50 text-sky-300 font-black text-[10px]">❄️ تجميد</button>
                <button type="button" onclick="DamanSecurityMod.applyAccountStatus('${safeUid}','banned','هذا العضو')" class="py-2 rounded-xl bg-rose-600 text-white font-black text-[10px]">🚫 حظر</button>
                <button type="button" onclick="DamanSecurityMod.applyAccountStatus('${safeUid}','active','هذا العضو')" class="py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-black text-[10px]">✅ فك</button>`;
              const kycBtn = inner.querySelector('.daman-u360-kycv-btn');
              if (kycBtn && kycBtn.parentNode === inner) inner.insertBefore(row, kycBtn.nextSibling);
              else inner.appendChild(row);
            }, 150);
            return r;
          };
        }
      }

      // Inject Home QR Verify shortcut & enforce ban/freeze on tab renders
      if (typeof app.renderCurrentTab === 'function' && !app._secModTabHooked) {
        app._secModTabHooked = true;
        const origRender = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRender();
          if (app.activeTab === 'home') setTimeout(() => this.injectHomeVerifyShortcut(), 60);
          setTimeout(() => this.enforceCurrentUserStatus(), 80);
        };
      }

      // Periodically sync public verification docs & check live ban/freeze status
      setInterval(() => {
        this.syncAgreementsToPublicVerify();
        this.enforceCurrentUserStatus();
      }, 3500);

      setTimeout(() => {
        this.patchPublicContractVerification();
        this.injectHomeVerifyShortcut();
        this.syncAgreementsToPublicVerify();
        this.enforceCurrentUserStatus();
      }, 700);
    }
  };

  window.DamanSecurityMod = SecurityVerifyBan;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => SecurityVerifyBan.boot(), 680));
  else setTimeout(() => SecurityVerifyBan.boot(), 680);
})();
