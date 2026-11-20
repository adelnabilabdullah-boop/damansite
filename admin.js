(function () {
  const AdminMod = {
    subTab: 'posts', // 'posts' | 'wallet' | 'kyc' | 'vip' | 'users' | 'settings'
    posts: [],
    walletReqs: [],
    kycReqs: [],
    inspReqs: [],
    vipLaborReqs: [],
    disputes: [],
    users: [],
    logs: [],
    userSearch: '',
    loaded: false,

    async logAction(app, action, details) {
      try {
        await app.db.collection('adminLogs').add({
          adminEmail: app.user.email,
          action,
          details,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {}
    },

    async loadTabData(app, force = false) {
      if (!app.isAdmin()) return;
      const db = app.db;
      try {
        if (this.subTab === 'posts' || force) {
          const snap = await db.collection('projects').orderBy('createdAt', 'desc').limit(40).get();
          this.posts = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }
        if (this.subTab === 'wallet' || force) {
          const snap = await db.collection('walletRequests').orderBy('createdAt', 'desc').limit(40).get();
          this.walletReqs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }
        if (this.subTab === 'kyc' || force) {
          const snap = await db.collection('kycRequests').limit(40).get();
          this.kycReqs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }
        if (this.subTab === 'vip' || force) {
          const [iSnap, vSnap, dSnap] = await Promise.all([
            db.collection('vipRequests').limit(30).get(),
            db.collection('vipLaborRequests').limit(30).get(),
            db.collection('disputes').limit(30).get()
          ]);
          this.inspReqs = iSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.vipLaborReqs = vSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.disputes = dSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }
        if (this.subTab === 'users' || force) {
          const snap = await db.collection('users').limit(60).get();
          this.users = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }
        if (this.subTab === 'settings' || force) {
          const snap = await db.collection('adminLogs').orderBy('createdAt', 'desc').limit(25).get();
          this.logs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }
        this.loaded = true;
        this.rerender();
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'admin') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) {
      this.subTab = tab;
      this.rerender();
      this.loadTabData(window.DamanApp);
    },

    // ==================== 1. POSTS REVIEW & CATEGORY FIX ====================
    async approvePost(postId) {
      const app = window.DamanApp;
      const sel = document.getElementById('adm-cat-' + postId);
      const newCat = sel ? sel.value : null;
      const patch = { status: 'open' };
      if (newCat) patch.mainCategory = newCat;
      try {
        await app.db.collection('projects').doc(postId).update(patch);
        await this.logAction(app, 'APPROVE_POST', `Post ${postId} -> ${newCat || 'same'}`);
        app.toast('تم اعتماد ونشر المنشور بنجاح', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async toggleFeatured(postId, current) {
      const app = window.DamanApp;
      try {
        await app.db.collection('projects').doc(postId).update({ isFeatured: !current });
        await this.logAction(app, 'TOGGLE_FEATURED', `Post ${postId} -> ${!current}`);
        app.toast(!current ? 'تم تمييز الإعلان ★' : 'تم إلغاء التمييز', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async suspendPost(postId) {
      const app = window.DamanApp;
      if (!window.confirm('إيقاف وإخفاء هذا المنشور؟')) return;
      try {
        await app.db.collection('projects').doc(postId).update({ status: 'suspended' });
        await this.logAction(app, 'SUSPEND_POST', postId);
        app.toast('تم إيقاف المنشور', 'info');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 2. WALLET APPROVALS & REVERSAL ====================
    async handleWalletReq(reqId, decision) {
      const app = window.DamanApp;
      const req = this.walletReqs.find((r) => r.id === reqId);
      if (!req) return;
      const note = window.prompt(decision === 'approved' ? 'ملاحظة للمستخدم (اختياري):' : 'سبب الرفض أو التراجع:', '') || '';

      const reqRef = app.db.collection('walletRequests').doc(reqId);
      const userRef = app.db.collection('users').doc(req.userId);
      const amt = Number(req.amount || 0);

      try {
        await app.db.runTransaction(async (tx) => {
          const [rDoc, uDoc] = await Promise.all([tx.get(reqRef), tx.get(userRef)]);
          const rData = rDoc.data();
          const uData = uDoc.data() || {};
          const curAvail = Number(uData.balanceAvailable || 0);

          if (decision === 'approved') {
            if (rData.status !== 'pending') throw new Error('الطلب تمت معالجته مسبقاً');
            const newAvail = rData.type === 'deposit' ? curAvail + amt : Math.max(0, curAvail - amt);
            tx.update(userRef, { balanceAvailable: Math.round(newAvail * 100) / 100 });
            tx.update(reqRef, { status: 'approved', adminNote: note, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: req.userId,
              type: rData.type === 'deposit' ? 'deposit_approved' : 'withdraw_approved',
              title: rData.type === 'deposit' ? 'إيداع معتمد في المحفظة' : 'سحب معتمد من المحفظة',
              note: note || rData.method,
              amount: rData.type === 'deposit' ? amt : -amt,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          } else if (decision === 'rejected') {
            tx.update(reqRef, { status: 'rejected', adminNote: note, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (decision === 'reversed') {
            if (rData.status !== 'approved') throw new Error('التراجع متاح للطلبات المعتمدة فقط');
            const newAvail = rData.type === 'deposit' ? Math.max(0, curAvail - amt) : curAvail + amt;
            tx.update(userRef, { balanceAvailable: Math.round(newAvail * 100) / 100 });
            tx.update(reqRef, { status: 'reversed', adminNote: 'تراجع إداري: ' + note, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: req.userId,
              type: 'admin_reversal',
              title: 'تراجع إداري عن عملية سابقة',
              note: note || reqId,
              amount: rData.type === 'deposit' ? -amt : amt,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }

          tx.set(app.db.collection('notifications').doc(), {
            userId: req.userId,
            title: decision === 'approved' ? 'تمت الموافقة على طلب المحفظة' : decision === 'reversed' ? 'تراجع إداري عن عملية' : 'تم رفض طلب المحفظة',
            body: `${app.fmtMoney(amt)} ج.م ${note ? '— ' + note : ''}`,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        await this.logAction(app, 'WALLET_' + decision.toUpperCase(), `${req.type} ${amt} EGP (${req.userEmail})`);
        app.toast('تم تنفيذ العملية المالية بنجاح', 'success');
        this.loadTabData(app);
      } catch (e) {
        app.toast(e.message, 'error');
      }
    },

    // ==================== 3. KYC APPROVALS ====================
    async handleKyc(uid, status) {
      const app = window.DamanApp;
      const note = status === 'rejected' ? (window.prompt('سبب رفض التوثيق:', '') || '') : '';
      try {
        await app.db.collection('kycRequests').doc(uid).update({ status, adminNote: note });
        await app.db.collection('users').doc(uid).update({ kycStatus: status === 'approved' ? 'verified' : 'unverified' });
        await app.db.collection('notifications').add({
          userId: uid,
          title: status === 'approved' ? 'مبروك! تم توثيق حسابك بنجاح' : 'تم رفض طلب التوثيق',
          body: status === 'approved' ? 'حصلت الآن على شارة التوثيق المعتمد.' : (note || 'يرجى إعادة رفع صور واضحة.'),
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.logAction(app, 'KYC_' + status.toUpperCase(), uid);
        app.toast(status === 'approved' ? 'تم اعتماد التوثيق' : 'تم رفض التوثيق', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 4. INSPECTIONS & VIP LABOR QUOTING ====================
    async quoteInspection(reqId, userId) {
      const app = window.DamanApp;
      const price = parseFloat(window.prompt('أدخل السعر المحدد للمعاينة (ج.م):', ''));
      if (!price || price <= 0) return;
      const note = window.prompt('ملاحظة أو موعد مقترح للعميل:', '') || '';
      try {
        await app.db.collection('vipRequests').doc(reqId).update({ quotedPrice: price, adminNote: note, status: 'quoted' });
        await app.db.collection('notifications').add({
          userId,
          title: 'تم تسعير طلب المعاينة الهندسية',
          body: `السعر المحدد: ${app.fmtMoney(price)} ج.م ${note ? '— ' + note : ''}`,
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.logAction(app, 'QUOTE_INSPECTION', `${reqId} -> ${price} EGP`);
        app.toast('تم إرسال السعر للعميل بنجاح', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async replyVipLabor(reqId, userId) {
      const app = window.DamanApp;
      const note = window.prompt('أدخل رد الإدارة أو السعر والتفاصيل للعميل:', '');
      if (!note) return;
      try {
        await app.db.collection('vipLaborRequests').doc(reqId).update({ adminNote: note, status: 'replied' });
        await app.db.collection('notifications').add({
          userId,
          title: 'رد الإدارة على طلب عمالة VIP',
          body: note,
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.logAction(app, 'REPLY_VIP_LABOR', reqId);
        app.toast('تم إرسال الرد بنجاح', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 5. USERS CONTROL ====================
    async setUserStatus(uid, status) {
      const app = window.DamanApp;
      if (!window.confirm(`تأكيد تغيير حالة الحساب إلى (${status})؟`)) return;
      try {
        await app.db.collection('users').doc(uid).update({ status });
        await this.logAction(app, 'USER_STATUS', `${uid} -> ${status}`);
        app.toast('تم تحديث حالة الحساب', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async holdUserFunds(uid) {
      const app = window.DamanApp;
      const amt = parseFloat(window.prompt('المبلغ المراد حجزه إدارياً من الرصيد المتاح (أو أدخل رقم سالب لفك الحجز):', ''));
      if (!amt) return;
      const uRef = app.db.collection('users').doc(uid);
      try {
        await app.db.runTransaction(async (tx) => {
          const doc = await tx.get(uRef);
          const d = doc.data() || {};
          const avail = Number(d.balanceAvailable || 0);
          const held = Number(d.balanceHeld || 0);
          tx.update(uRef, {
            balanceAvailable: Math.max(0, Math.round((avail - amt) * 100) / 100),
            balanceHeld: Math.max(0, Math.round((held + amt) * 100) / 100)
          });
        });
        await this.logAction(app, 'ADMIN_HOLD', `${uid} -> ${amt} EGP`);
        app.toast('تم تحديث الحجز الإداري بنجاح', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async grantFreePlan(uid) {
      const app = window.DamanApp;
      const planType = window.prompt('اكتب company لباقة الشركات أو individual لباقة الأفراد:', 'company');
      if (!planType) return;
      const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      try {
        await app.db.collection('users').doc(uid).update({
          activePlanKey: planType === 'company' ? 'company' : 'individual',
          activePlanName: planType === 'company' ? 'باقة الشركات (هدية إدارة)' : 'باقة الأفراد VIP (هدية إدارة)',
          activePlanExpires: exp
        });
        await this.logAction(app, 'GRANT_FREE_PLAN', `${uid} -> ${planType}`);
        app.toast('تم تفعيل الباقة مجاناً لمدة شهر', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 6. GLOBAL SETTINGS & BROADCAST ====================
    async saveGlobalSettings(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const rate = (parseFloat(document.getElementById('set-comm').value) || 3.5) / 100;
      const hideDemoAds = document.getElementById('set-hide-demo').checked;
      const packages = {
        individual: {
          titleAr: 'باقة الأفراد والمقاولين (نشر + توثيق VIP)',
          titleEn: 'Individual & Contractor VIP Package',
          m1: Number(document.getElementById('set-ind-m1').value) || 150,
          m3: Number(document.getElementById('set-ind-m3').value) || 400,
          m6: Number(document.getElementById('set-ind-m6').value) || 750,
          m12: Number(document.getElementById('set-ind-m12').value) || 1350
        },
        company: {
          titleAr: 'باقة الشركات والمكاتب (إدارة فريق Access + B2B)',
          titleEn: 'Corporate & Engineering Office Package',
          m1: Number(document.getElementById('set-cmp-m1').value) || 250,
          m3: Number(document.getElementById('set-cmp-m3').value) || 650,
          m6: Number(document.getElementById('set-cmp-m6').value) || 1200,
          m12: Number(document.getElementById('set-cmp-m12').value) || 2200
        },
        featured: {
          titleAr: 'تمييز إعلان / مشروع (Featured Ad)',
          titleEn: 'Featured Ad Boost',
          week: Number(document.getElementById('set-feat-w').value) || 75,
          month: Number(document.getElementById('set-feat-m').value) || 200
        },
        minCompanyBalanceForAccess: Number(document.getElementById('set-min-bal').value) || 100
      };

      try {
        await app.db.collection('settings').doc('appConfig').set(
          { commissionRate: rate, hideDemoAds, packages, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
        await app.loadAppConfig(true);
        await this.logAction(app, 'UPDATE_SETTINGS', `Rate: ${(rate * 100).toFixed(1)}%, HideDemo: ${hideDemoAds}`);
        app.toast('تم حفظ إعدادات المنصة والأسعار فوراً', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async sendBroadcast(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const title = document.getElementById('bc-title').value.trim();
      const body = document.getElementById('bc-body').value.trim();
      if (!title || !body) return;
      try {
        await app.db.collection('notifications').add({
          userId: 'ALL',
          title,
          body,
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        await this.logAction(app, 'BROADCAST', title);
        app.toast('تم إرسال الإشعار الجماعي لكل المستخدمين بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== RENDER SECTIONS ====================
    renderPostsTab(app) {
      const pending = this.posts.filter((p) => p.status === 'pending_review');
      const others = this.posts.filter((p) => p.status !== 'pending_review');
      const card = (p) => `
        <div class="p-3 rounded-xl bg-slate-950/90 border ${p.status === 'pending_review' ? 'border-purple-500/60' : 'border-slate-800'} space-y-2">
          <div class="flex items-center justify-between gap-2 text-xs font-extrabold">
            <span class="text-white truncate">${app.esc(p.title)}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 shrink-0">${app.esc(p.status)}</span>
          </div>
          <div class="text-[10px] text-slate-400">${app.esc(p.clientName)} (${app.esc(p.clientEmail || '')}) — ${app.esc(p.location)}</div>
          <select id="adm-cat-${p.id}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-white">
            ${window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === p.mainCategory ? 'selected' : ''}>${c.ar}</option>`).join('')}
          </select>
          <div class="flex items-center gap-1.5">
            <button onclick="DamanAdmin.approvePost('${p.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">${p.status === 'pending_review' ? 'اعتماد ونشر' : 'حفظ القسم'}</button>
            <button onclick="DamanAdmin.toggleFeatured('${p.id}',${!!p.isFeatured})" class="px-2.5 py-1.5 rounded-lg ${p.isFeatured ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-300'} font-black text-[10px]">★ تمييز</button>
            <button onclick="DamanAdmin.suspendPost('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">إيقاف</button>
          </div>
        </div>`;
      return `
        <div class="space-y-3">
          <div class="text-xs font-extrabold text-purple-300">بانتظار المراجعة (${pending.length})</div>
          ${pending.length ? pending.map(card).join('') : '<div class="text-center text-xs text-slate-400 py-3">لا توجد منشورات معلقة</div>'}
          <div class="text-xs font-extrabold text-slate-300 pt-2">المنشورات الحالية (${others.length})</div>
          ${others.slice(0, 15).map(card).join('')}
        </div>`;
    },

    renderWalletTab(app) {
      if (!this.walletReqs.length) return '<div class="text-center text-xs text-slate-400 py-6">لا توجد طلبات إيداع أو سحب</div>';
      return `<div class="space-y-2.5">${this.walletReqs.map((r) => `
        <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-xs font-black">
            <span class="${r.type === 'deposit' ? 'text-emerald-400' : 'text-sky-400'}">${r.type === 'deposit' ? 'إيداع' : 'سحب'} — ${app.fmtMoney(r.amount)} ج.م</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300">${app.esc(r.status)}</span>
          </div>
          <div class="text-[10px] text-slate-300">${app.esc(r.userName)} | ${app.esc(r.userEmail)}</div>
          <div class="text-[10px] text-slate-400">${app.esc(r.method)} — ${app.esc(r.senderWalletNumber || r.targetWalletNumber || r.senderAccountNumber || r.targetAccountNumber || r.senderInstapay || '')} (${app.esc(r.senderWalletOwner || r.targetWalletOwner || r.senderAccountOwner || r.targetAccountOwner || r.senderInstapayOwner || '')})</div>
          ${r.receiptBase64 ? `<img src="${r.receiptBase64}" onclick="window.open('${r.receiptBase64}','_blank')" class="w-full max-h-36 object-contain rounded-lg border border-slate-700 cursor-pointer" />` : ''}
          <div class="flex items-center gap-1.5">
            ${r.status === 'pending' ? `
              <button onclick="DamanAdmin.handleWalletReq('${r.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة</button>
              <button onclick="DamanAdmin.handleWalletReq('${r.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>` : ''}
            ${r.status === 'approved' ? `
              <button onclick="DamanAdmin.handleWalletReq('${r.id}','reversed')" class="w-full py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-black text-[10px]">تراجع عن الموافقة (Reverse)</button>` : ''}
          </div>
        </div>`).join('')}</div>`;
    },

    renderKycTab(app) {
      if (!this.kycReqs.length) return '<div class="text-center text-xs text-slate-400 py-6">لا توجد طلبات توثيق</div>';
      return `<div class="space-y-2.5">${this.kycReqs.map((k) => `
        <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-xs font-extrabold">
            <span class="text-white">${app.esc(k.companyName || k.fullName)}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-300">${app.esc(k.status)}</span>
          </div>
          <div class="text-[10px] text-slate-400">${app.esc(k.userEmail)} | قومي: ${app.esc(k.nationalId)} ${k.commercialReg ? '| س.ت: ' + app.esc(k.commercialReg) : ''} ${k.taxCardNumber ? '| ضريبية: ' + app.esc(k.taxCardNumber) : ''}</div>
          <div class="grid grid-cols-3 gap-1.5">
            ${k.idFrontBase64 ? `<img src="${k.idFrontBase64}" class="h-16 w-full object-cover rounded border border-slate-700" />` : ''}
            ${k.selfieBase64 ? `<img src="${k.selfieBase64}" class="h-16 w-full object-cover rounded border border-slate-700" />` : ''}
            ${k.crPhotoBase64 ? `<img src="${k.crPhotoBase64}" class="h-16 w-full object-cover rounded border border-sky-500" />` : (k.idBackBase64 ? `<img src="${k.idBackBase64}" class="h-16 w-full object-cover rounded border border-slate-700" />` : '')}
            ${k.taxPhotoBase64 ? `<img src="${k.taxPhotoBase64}" class="h-16 w-full object-cover rounded border border-sky-500" />` : ''}
          </div>
          ${k.status === 'pending' ? `
            <div class="flex gap-1.5">
              <button onclick="DamanAdmin.handleKyc('${k.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد التوثيق</button>
              <button onclick="DamanAdmin.handleKyc('${k.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>
            </div>` : ''}
        </div>`).join('')}</div>`;
    },

    renderVipTab(app) {
      return `
        <div class="space-y-4">
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-emerald-400">طلبات المعاينة الهندسية (${this.inspReqs.length})</h4>
            ${!this.inspReqs.length ? '<div class="text-xs text-slate-400">لا توجد طلبات</div>' : this.inspReqs.map((r) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
                <div class="font-bold text-white">${app.esc(r.packageLabel)}</div>
                <div class="text-[10px] text-slate-300">المساحة: ${app.esc(r.area || '-')} | الموقع: ${app.esc(r.location)} | هاتف: ${app.esc(r.phone)}</div>
                <button onclick="DamanAdmin.quoteInspection('${r.id}','${r.userId}')" class="w-full py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">تحديد وإرسال السعر (${r.quotedPrice ? app.fmtMoney(r.quotedPrice) + ' ج.م' : 'لم يُسعّر'})</button>
              </div>`).join('')}
          </div>

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-amber-400">طلبات عمالة VIP (${this.vipLaborReqs.length})</h4>
            ${!this.vipLaborReqs.length ? '<div class="text-xs text-slate-400">لا توجد طلبات</div>' : this.vipLaborReqs.map((r) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
                <div class="font-bold text-white">${app.esc(r.trade)} (${r.workersCount} عامل — ${app.esc(r.duration)})</div>
                <div class="text-[10px] text-slate-300">${app.esc(r.location)} | هاتف: ${app.esc(r.phone)}</div>
                <button onclick="DamanAdmin.replyVipLabor('${r.id}','${r.userId}')" class="w-full py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">إرسال رد الإدارة</button>
              </div>`).join('')}
          </div>

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-rose-400">النزاعات المفتوحة (${this.disputes.length})</h4>
            ${!this.disputes.length ? '<div class="text-xs text-slate-400">لا توجد نزاعات</div>' : this.disputes.map((d) => `
              <div class="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs space-y-1">
                <div class="font-bold text-white">${app.esc(d.projectTitle)} (${app.esc(d.contractNumber)})</div>
                <div class="text-[10px] text-rose-200">${app.esc(d.reason)}</div>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderUsersTab(app) {
      const q = this.userSearch.toLowerCase();
      const filtered = this.users.filter((u) => !q || (u.email + ' ' + u.name + ' ' + (u.companyName || '')).toLowerCase().includes(q));
      return `
        <div class="space-y-3">
          <input type="search" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالإيميل أو الاسم أو الشركة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          ${filtered.map((u) => `
            <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <button onclick="DamanApp.openPublicProfile('${u.id}')" class="text-start min-w-0">
                  <div class="text-xs font-extrabold text-amber-300 underline truncate">${app.esc(u.companyName || u.name)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${app.esc(u.email)} | ★ ${Number(u.ratingAvg || 0).toFixed(1)} (${u.ratingCount || 0})</div>
                </button>
                <span class="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 shrink-0">${app.esc(u.status || 'active')}</span>
              </div>
              <div class="text-[10px] text-emerald-400 font-bold">متاح: ${app.fmtMoney(u.balanceAvailable)} | ضمان: ${app.fmtMoney(u.balanceEscrow)} | محجوز: ${app.fmtMoney(u.balanceHeld)}</div>
              <div class="grid grid-cols-4 gap-1">
                <button onclick="DamanAdmin.holdUserFunds('${u.id}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">حجز مالي</button>
                <button onclick="DamanAdmin.grantFreePlan('${u.id}')" class="py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">باقة هدية</button>
                <button onclick="DamanAdmin.setUserStatus('${u.id}','${u.status === 'frozen' ? 'active' : 'frozen'}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">${u.status === 'frozen' ? 'فك تجميد' : 'تجميد'}</button>
                <button onclick="DamanAdmin.setUserStatus('${u.id}','${u.status === 'banned' ? 'active' : 'banned'}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">${u.status === 'banned' ? 'فك حظر' : 'حظر'}</button>
              </div>
            </div>`).join('')}
        </div>`;
    },

    renderSettingsTab(app) {
      const pkgs = app.getPackages();
      const ratePct = (app.getCommissionRate() * 100).toFixed(1);
      const hideDemo = !!(app.appConfig && app.appConfig.hideDemoAds);
      return `
        <div class="space-y-4">
          <button onclick="DamanWallet.openConfigModal()" class="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs">
            <i class="fa-solid fa-money-check-dollar me-1"></i> تعديل بيانات الاستلام (المحفظة + رابط إنستا باي + البنك)
          </button>

          <form onsubmit="DamanAdmin.sendBroadcast(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <h4 class="text-xs font-extrabold text-amber-400"><i class="fa-solid fa-bullhorn me-1"></i> إرسال إشعار جماعي لكل المستخدمين الآن</h4>
            <input id="bc-title" type="text" required placeholder="عنوان الإشعار" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="bc-body" rows="2" required placeholder="نص الرسالة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">إرسال للجميع</button>
          </form>

          <form onsubmit="DamanAdmin.saveGlobalSettings(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-sky-400"><i class="fa-solid fa-sliders me-1"></i> التحكم في الأسعار والعمولة والإعلانات المبدئية</h4>
            <label class="flex items-center justify-between text-xs text-slate-200">
              <span>إخفاء الإعلانات المبدئية (الوهمية) في الأقسام</span>
              <input id="set-hide-demo" type="checkbox" ${hideDemo ? 'checked' : ''} class="accent-amber-500 w-4 h-4" />
            </label>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div><label class="text-slate-400">عمولة الضمان (%)</label><input id="set-comm" type="number" step="0.1" value="${ratePct}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-slate-400">أقل رصيد لـ Access الشركات</label><input id="set-min-bal" type="number" value="${pkgs.minCompanyBalanceForAccess || 100}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div class="text-[11px] font-bold text-amber-300 pt-1">أسعار باقة الأفراد (شهر / 3 / 6 / سنة)</div>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
              <input id="set-ind-m1" type="number" value="${pkgs.individual.m1}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-ind-m3" type="number" value="${pkgs.individual.m3}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-ind-m6" type="number" value="${pkgs.individual.m6}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-ind-m12" type="number" value="${pkgs.individual.m12}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="text-[11px] font-bold text-sky-300 pt-1">أسعار باقة الشركات (شهر / 3 / 6 / سنة)</div>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
              <input id="set-cmp-m1" type="number" value="${pkgs.company.m1}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-cmp-m3" type="number" value="${pkgs.company.m3}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-cmp-m6" type="number" value="${pkgs.company.m6}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-cmp-m12" type="number" value="${pkgs.company.m12}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="text-[11px] font-bold text-purple-300 pt-1">تمييز إعلان (أسبوع / شهر)</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <input id="set-feat-w" type="number" value="${pkgs.featured.week}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-feat-m" type="number" value="${pkgs.featured.month}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs mt-1">حفظ كل الإعدادات فوراً</button>
          </form>

          <div class="glass-card rounded-2xl p-3.5 space-y-1.5">
            <h4 class="text-xs font-extrabold text-slate-300">سجل عمليات الإدارة (Audit Log)</h4>
            ${this.logs.map((l) => `<div class="text-[10px] text-slate-400 border-b border-slate-800 pb-1"><b class="text-amber-300">${app.esc(l.action)}</b> — ${app.esc(l.details)}</div>`).join('')}
          </div>
        </div>`;
    },

    render(container, app) {
      if (!app.isAdmin()) {
        container.innerHTML = `<div class="p-6 text-center text-xs text-rose-400">غير مصرح بالدخول</div>`;
        return;
      }
      if (!this.loaded) {
        this.loaded = true;
        this.loadTabData(app);
      }

      const tabs = [
        { id: 'posts', label: 'المنشورات' },
        { id: 'wallet', label: 'المحفظة' },
        { id: 'kyc', label: 'التوثيق' },
        { id: 'vip', label: 'معاينة وVIP' },
        { id: 'users', label: 'المستخدمين' },
        { id: 'settings', label: 'الإعدادات' }
      ];

      const body =
        this.subTab === 'posts' ? this.renderPostsTab(app)
        : this.subTab === 'wallet' ? this.renderWalletTab(app)
        : this.subTab === 'kyc' ? this.renderKycTab(app)
        : this.subTab === 'vip' ? this.renderVipTab(app)
        : this.subTab === 'users' ? this.renderUsersTab(app)
        : this.renderSettingsTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-black text-amber-400"><i class="fa-solid fa-crown me-1.5"></i> لوحة الإدارة العليا (DamanSite)</h2>
            <button onclick="DamanAdmin.loadTabData(DamanApp, true)" class="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-white"><i class="fa-solid fa-rotate"></i></button>
          </div>
          <div class="grid grid-cols-3 gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
            ${tabs.map((t) => `
              <button onclick="DamanAdmin.setSubTab('${t.id}')" class="py-1.5 rounded-lg text-[11px] font-extrabold ${this.subTab === t.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${t.label}</button>`).join('')}
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanAdmin = AdminMod;
  if (window.DamanApp) window.DamanApp.registerModule('admin', AdminMod);
})();
