(function () {
  const AdminMod = {
    subTab: 'posts', // 'posts' | 'wallet' | 'kyc' | 'vip' | 'calls' | 'users' | 'settings'
    posts: [],
    walletReqs: [],
    kycReqs: [],
    inspReqs: [],
    vipLaborReqs: [],
    disputes: [],
    tickets: [],
    recordings: [],
    users: [],
    logs: [],
    userSearch: '',
    loaded: false,

    async logAction(app, action, details) {
      try {
        await app.db.collection('adminLogs').add({
          adminEmail: app.user.email, action, details,
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
          const [iSnap, vSnap, dSnap, tSnap] = await Promise.all([
            db.collection('vipRequests').limit(30).get(),
            db.collection('vipLaborRequests').limit(30).get(),
            db.collection('disputes').limit(30).get(),
            db.collection('supportTickets').limit(30).get()
          ]);
          this.inspReqs = iSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.vipLaborReqs = vSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.disputes = dSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.tickets = tSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }
        if (this.subTab === 'calls' || force) {
          const snap = await db.collection('callRecordings').limit(40).get();
          const now = Date.now();
          const valid = [];
          for (const d of snap.docs) {
            const data = d.data();
            // Auto-Delete recordings older than 30 days unless pinned
            if (data.expiresAt && data.expiresAt < now && !data.pinned) {
              db.collection('callRecordings').doc(d.id).delete().catch(() => {});
            } else {
              valid.push(Object.assign({ id: d.id }, data));
            }
          }
          this.recordings = valid.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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
      } catch (err) { app.toast(err.message, 'error'); }
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'admin') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) { this.subTab = tab; this.rerender(); this.loadTabData(window.DamanApp); },

    async approvePost(postId) {
      const app = window.DamanApp;
      const p = this.posts.find((x) => x.id === postId);
      const sel = document.getElementById('adm-cat-' + postId);
      const patch = { status: 'open' };
      if (sel) patch.mainCategory = sel.value;
      try {
        await app.db.collection('projects').doc(postId).update(patch);
        if (p?.clientId) await app.sendNotification(p.clientId, 'تمت الموافقة على منشورك ونشره ✅', p.title || '');
        await this.logAction(app, 'APPROVE_POST', postId);
        app.toast('تم اعتماد المنشور وإشعار صاحبه', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async toggleFeatured(postId, current) {
      const app = window.DamanApp;
      const p = this.posts.find((x) => x.id === postId);
      try {
        await app.db.collection('projects').doc(postId).update({ isFeatured: !current });
        if (p?.clientId && !current) await app.sendNotification(p.clientId, 'تم تمييز إعلانك ★', p.title || '');
        app.toast(!current ? 'تم تمييز الإعلان ★' : 'تم إلغاء التمييز', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async suspendPost(postId) {
      const app = window.DamanApp;
      const p = this.posts.find((x) => x.id === postId);
      if (!window.confirm('إيقاف هذا المنشور؟')) return;
      try {
        await app.db.collection('projects').doc(postId).update({ status: 'suspended' });
        if (p?.clientId) await app.sendNotification(p.clientId, 'تم إيقاف منشورك من الإدارة', p.title || '');
        app.toast('تم إيقاف المنشور', 'info');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async handleWalletReq(reqId, decision) {
      const app = window.DamanApp;
      const req = this.walletReqs.find((r) => r.id === reqId);
      if (!req) return;
      const note = window.prompt(decision === 'approved' ? 'ملاحظة (اختياري):' : 'سبب الرفض/التراجع:', '') || '';
      const reqRef = app.db.collection('walletRequests').doc(reqId);
      const userRef = app.db.collection('users').doc(req.userId);
      const amt = Number(req.amount || 0);

      try {
        await app.db.runTransaction(async (tx) => {
          const [rDoc, uDoc] = await Promise.all([tx.get(reqRef), tx.get(userRef)]);
          const rData = rDoc.data();
          const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
          if (decision === 'approved') {
            if (rData.status !== 'pending') throw new Error('تمت المعالجة مسبقاً');
            tx.update(userRef, { balanceAvailable: Math.max(0, Math.round((rData.type === 'deposit' ? curAvail + amt : curAvail - amt) * 100) / 100) });
            tx.update(reqRef, { status: 'approved', adminNote: note });
          } else if (decision === 'rejected') {
            tx.update(reqRef, { status: 'rejected', adminNote: note });
          } else if (decision === 'reversed') {
            if (rData.status !== 'approved') throw new Error('للمعتمد فقط');
            tx.update(userRef, { balanceAvailable: Math.max(0, Math.round((rData.type === 'deposit' ? curAvail - amt : curAvail + amt) * 100) / 100) });
            tx.update(reqRef, { status: 'reversed', adminNote: 'تراجع: ' + note });
          }
        });
        const msgTitle = decision === 'approved'
          ? (req.type === 'deposit' ? 'تم إيداع المبلغ في محفظتك ✅' : 'تم تحويل مبلغ السحب بنجاح ✅')
          : decision === 'reversed' ? 'تراجع إداري عن عملية مالية' : 'تم رفض طلب المحفظة';
        await app.sendNotification(req.userId, msgTitle, `${app.fmtMoney(amt)} ج.م ${note ? '— ' + note : ''}`);
        await this.logAction(app, 'WALLET_' + decision.toUpperCase(), `${req.type} ${amt}`);
        app.toast('تم التنفيذ وإرسال الإشعار للمستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async handleKyc(uid, status) {
      const app = window.DamanApp;
      const note = status === 'rejected' ? (window.prompt('سبب الرفض:', '') || '') : '';
      try {
        await app.db.collection('kycRequests').doc(uid).update({ status, adminNote: note });
        await app.db.collection('users').doc(uid).update({ kycStatus: status === 'approved' ? 'verified' : 'unverified' });
        await app.sendNotification(uid, status === 'approved' ? 'تم توثيق حسابك بنجاح ✅' : 'تم رفض التوثيق', status === 'approved' ? 'حصلت على شارة التوثيق المعتمد.' : note);
        app.toast('تم التحديث وإشعار المستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async resolveDispute(dispId, winner) {
      const app = window.DamanApp;
      const d = this.disputes.find((x) => x.id === dispId);
      if (!d || !window.confirm(`تأكيد الفصل في النزاع لصالح ${winner === 'client' ? 'العميل (رد المبلغ)' : 'المنفّذ (تحرير المبلغ)'}؟`)) return;
      try {
        const amt = Number(d.contractAmount || 0);
        const targetUid = winner === 'client' ? d.clientId : d.providerId;
        if (targetUid && amt > 0) {
          await app.db.collection('users').doc(targetUid).update({ balanceAvailable: firebase.firestore.FieldValue.increment(amt) });
        }
        await app.db.collection('disputes').doc(dispId).update({ status: 'resolved', resolution: winner });
        await app.sendNotification(d.clientId, 'قرار الإدارة في النزاع', `تم الفصل في نزاع ${d.contractNumber} لصالح ${winner === 'client' ? 'العميل' : 'المنفّذ'}`);
        await app.sendNotification(d.providerId, 'قرار الإدارة في النزاع', `تم الفصل في نزاع ${d.contractNumber} لصالح ${winner === 'client' ? 'العميل' : 'المنفّذ'}`);
        app.toast('تم الفصل في النزاع وإشعار الطرفين', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async replyTicket(tkId, userId) {
      const app = window.DamanApp;
      const reply = window.prompt('اكتب رد الإدارة على التذكرة:', '');
      if (!reply) return;
      try {
        await app.db.collection('supportTickets').doc(tkId).update({ adminReply: reply, status: 'resolved' });
        await app.sendNotification(userId, 'رد الإدارة على تذكرة الدعم', reply);
        app.toast('تم إرسال الرد وإغلاق التذكرة', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async togglePinRecording(id, current) {
      const app = window.DamanApp;
      try {
        await app.db.collection('callRecordings').doc(id).update({ pinned: !current });
        app.toast(!current ? 'تم تثبيت التسجيل (لن يُحذف بعد 30 يوم)' : 'تم إلغاء التثبيت', 'info');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async deleteRecording(id) {
      if (!window.confirm('حذف تسجيل المكالمة نهائياً؟')) return;
      try {
        await window.DamanApp.db.collection('callRecordings').doc(id).delete();
        window.DamanApp.toast('تم الحذف', 'info');
        this.loadTabData(window.DamanApp);
      } catch (e) { window.DamanApp.toast(e.message, 'error'); }
    },

    async setUserStatus(uid, status) {
      const app = window.DamanApp;
      if (!window.confirm(`تغيير حالة الحساب إلى (${status})؟`)) return;
      try {
        await app.db.collection('users').doc(uid).update({ status });
        await app.sendNotification(uid, 'تحديث حالة الحساب من الإدارة', status === 'active' ? 'تم إعادة تفعيل حسابك بنجاح' : 'تم تجميد/إيقاف حسابك مؤقتاً — تواصل مع الدعم.');
        app.toast('تم التحديث وإشعار المستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async holdUserFunds(uid) {
      const app = window.DamanApp;
      const amt = parseFloat(window.prompt('المبلغ المراد حجزه إدارياً (أو سالب لفك الحجز):', ''));
      if (!amt) return;
      const uRef = app.db.collection('users').doc(uid);
      try {
        await app.db.runTransaction(async (tx) => {
          const d = (await tx.get(uRef)).data() || {};
          tx.update(uRef, {
            balanceAvailable: Math.max(0, Math.round((Number(d.balanceAvailable || 0) - amt) * 100) / 100),
            balanceHeld: Math.max(0, Math.round((Number(d.balanceHeld || 0) + amt) * 100) / 100)
          });
        });
        await app.sendNotification(uid, amt > 0 ? 'تم حجز مبلغ إدارياً في محفظتك' : 'تم فك حجز مبلغ في محفظتك', `القيمة: ${app.fmtMoney(Math.abs(amt))} ج.م`);
        app.toast('تم تحديث الحجز الإداري وإشعار المستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async adjustUserBalance(uid) {
      const app = window.DamanApp;
      const amt = parseFloat(window.prompt('أدخل المبلغ لإضافته للرصيد المتاح (أو سالب للخصم):', ''));
      if (!amt) return;
      const reason = window.prompt('السبب (يظهر للمستخدم في الإشعار):', 'تعديل إداري') || 'تعديل إداري';
      try {
        await app.db.collection('users').doc(uid).update({ balanceAvailable: firebase.firestore.FieldValue.increment(amt) });
        await app.sendNotification(uid, amt > 0 ? 'تم إضافة رصيد لمحفظتك ✅' : 'تم خصم رصيد من محفظتك', `${app.fmtMoney(Math.abs(amt))} ج.م — ${reason}`);
        app.toast('تم تعديل الرصيد وإشعار المستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async grantFreePlan(uid) {
      const app = window.DamanApp;
      const planType = window.prompt('اكتب company لباقة الشركات أو individual لباقة الأفراد:', 'company');
      if (!planType) return;
      const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const name = planType === 'company' ? 'باقة الشركات (هدية إدارة)' : 'باقة الأفراد VIP (هدية إدارة)';
      try {
        await app.db.collection('users').doc(uid).update({
          activePlanKey: planType === 'company' ? 'company' : 'individual',
          activePlanName: name,
          activePlanExpires: exp
        });
        await app.sendNotification(uid, 'مبروك! حصلت على باقة هدية من إدارة ضمان سايت 🎁', `تم تفعيل ${name} مجاناً حتى ${exp}`);
        app.toast('تم تفعيل الباقة الهدية وإرسال إشعار فوري للمستخدم ✅', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async quoteInspection(reqId, userId) {
      const app = window.DamanApp;
      const price = parseFloat(window.prompt('السعر المحدد للاستلام الهندسي (ج.م):', ''));
      if (!price || price <= 0) return;
      const note = window.prompt('ملاحظة للعميل:', '') || '';
      try {
        await app.db.collection('vipRequests').doc(reqId).update({ quotedPrice: price, adminNote: note, status: 'quoted' });
        await app.sendNotification(userId, 'تم تسعير طلب الاستلام الهندسي 3x', `السعر: ${app.fmtMoney(price)} ج.م ${note ? '— ' + note : ''}`);
        app.toast('تم إرسال السعر وإشعار العميل', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async replyVipLabor(reqId, userId) {
      const app = window.DamanApp;
      const note = window.prompt('رد الإدارة على طلب عمالة VIP:', '');
      if (!note) return;
      try {
        await app.db.collection('vipLaborRequests').doc(reqId).update({ adminNote: note, status: 'replied' });
        await app.sendNotification(userId, 'رد الإدارة على طلب عمالة VIP', note);
        app.toast('تم إرسال الرد وإشعار العميل', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async saveGlobalSettings(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const rate = (parseFloat(document.getElementById('set-comm').value) || 3.5) / 100;
      const hideDemoAds = document.getElementById('set-hide-demo').checked;
      const packages = {
        individual: { titleAr: 'باقة الأفراد VIP', titleEn: 'Individual VIP', m1: +document.getElementById('set-ind-m1').value || 150, m3: +document.getElementById('set-ind-m3').value || 400, m6: +document.getElementById('set-ind-m6').value || 750, m12: +document.getElementById('set-ind-m12').value || 1350 },
        company: { titleAr: 'باقة الشركات', titleEn: 'Company Plan', m1: +document.getElementById('set-cmp-m1').value || 250, m3: +document.getElementById('set-cmp-m3').value || 650, m6: +document.getElementById('set-cmp-m6').value || 1200, m12: +document.getElementById('set-cmp-m12').value || 2200 },
        featured: { titleAr: 'تمييز إعلان', titleEn: 'Featured Ad', week: +document.getElementById('set-feat-w').value || 75, month: +document.getElementById('set-feat-m').value || 200 },
        minCompanyBalanceForAccess: +document.getElementById('set-min-bal').value || 100
      };
      try {
        await app.db.collection('settings').doc('appConfig').set({ commissionRate: rate, hideDemoAds, packages, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await app.loadAppConfig(true);
        app.toast('تم حفظ الإعدادات بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async sendBroadcast(e) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.sendNotification('ALL', document.getElementById('bc-title').value.trim(), document.getElementById('bc-body').value.trim());
      e.target.reset();
      app.toast('تم إرسال الإشعار الجماعي لجميع المستخدمين ✅', 'success');
    },

    renderCallsTab(app) {
      return `
        <div class="space-y-3">
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
            <i class="fa-solid fa-clock-rotate-left me-1"></i> يتم حذف التسجيلات غير المثبتة تلقائياً بعد مرور <b>30 يوماً</b> للحفاظ على المساحة المجانية.
          </div>
          ${!this.recordings.length ? '<div class="text-center text-xs text-slate-400 py-6">لا توجد تسجيلات مكالمات حالياً</div>' : this.recordings.map((r) => `
            <div class="p-3 rounded-xl bg-slate-950/90 border ${r.pinned ? 'border-amber-500/60' : 'border-slate-800'} space-y-2 text-xs">
              <div class="flex justify-between font-bold">
                <span class="text-white">${app.esc(r.callerName)} ↔ ${app.esc(r.otherName)}</span>
                <span class="text-[10px] text-emerald-400">${r.durationSec || 0} ثانية</span>
              </div>
              <audio controls src="${r.audioBase64}" class="w-full h-9"></audio>
              <div class="flex gap-1.5">
                <button onclick="DamanAdmin.togglePinRecording('${r.id}',${!!r.pinned})" class="flex-1 py-1.5 rounded-lg ${r.pinned ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-300'} font-black text-[10px]">${r.pinned ? 'مثبّت (محمي من المسح)' : 'تثبيت لنزاع'}</button>
                <button onclick="DamanAdmin.deleteRecording('${r.id}')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
              </div>
            </div>`).join('')}
        </div>`;
    },

    renderPostsTab(app) {
      const card = (p) => `
        <div class="p-3 rounded-xl bg-slate-950/90 border ${p.status === 'pending_review' ? 'border-purple-500/60' : 'border-slate-800'} space-y-2">
          <div class="flex justify-between text-xs font-extrabold"><span class="text-white truncate">${app.esc(p.title)}</span><span class="text-[10px] text-amber-300">${app.esc(p.status)}</span></div>
          <select id="adm-cat-${p.id}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-white">${window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === p.mainCategory ? 'selected' : ''}>${c.ar}</option>`).join('')}</select>
          <div class="flex gap-1.5">
            <button onclick="DamanAdmin.approvePost('${p.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد ونشر</button>
            <button onclick="DamanAdmin.toggleFeatured('${p.id}',${!!p.isFeatured})" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">★ تمييز</button>
            <button onclick="DamanAdmin.suspendPost('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">إيقاف</button>
          </div>
        </div>`;
      return `<div class="space-y-2.5">${this.posts.slice(0, 25).map(card).join('') || '<div class="text-center text-xs text-slate-400 py-5">لا توجد منشورات</div>'}</div>`;
    },

    renderWalletTab(app) {
      return `<div class="space-y-2.5">${this.walletReqs.map((r) => `
        <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between font-black"><span class="${r.type === 'deposit' ? 'text-emerald-400' : 'text-sky-400'}">${r.type === 'deposit' ? 'إيداع' : 'سحب'} — ${app.fmtMoney(r.amount)} ج.م</span><span class="text-[10px] text-amber-300">${app.esc(r.status)}</span></div>
          <div class="text-[10px] text-slate-400">${app.esc(r.userName)} | ${app.esc(r.method)}</div>
          ${r.receiptBase64 ? `<img src="${r.receiptBase64}" onclick="window.open('${r.receiptBase64}','_blank')" class="w-full max-h-32 object-contain rounded border border-slate-700 cursor-pointer" />` : ''}
          <div class="flex gap-1.5">
            ${r.status === 'pending' ? `<button onclick="DamanAdmin.handleWalletReq('${r.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة</button><button onclick="DamanAdmin.handleWalletReq('${r.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>` : ''}
            ${r.status === 'approved' ? `<button onclick="DamanAdmin.handleWalletReq('${r.id}','reversed')" class="w-full py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-black text-[10px]">تراجع (Reverse)</button>` : ''}
          </div>
        </div>`).join('') || '<div class="text-center text-xs text-slate-400 py-5">لا توجد طلبات</div>'}</div>`;
    },

    renderKycTab(app) {
      return `<div class="space-y-2.5">${this.kycReqs.map((k) => `
        <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between font-extrabold"><span class="text-white">${app.esc(k.companyName || k.fullName)}</span><span class="text-[10px] text-sky-300">${app.esc(k.status)}</span></div>
          <div class="text-[10px] text-slate-400">قومي: ${app.esc(k.nationalId)} ${k.commercialReg ? '| س.ت: ' + app.esc(k.commercialReg) : ''} ${k.taxCardNumber ? '| ضريبية: ' + app.esc(k.taxCardNumber) : ''}</div>
          <div class="grid grid-cols-3 gap-1">${[k.idFrontBase64, k.selfieBase64, k.crPhotoBase64 || k.idBackBase64, k.taxPhotoBase64].filter(Boolean).map((img) => `<img src="${img}" class="h-14 w-full object-cover rounded border border-slate-700" />`).join('')}</div>
          ${k.status === 'pending' ? `<div class="flex gap-1.5"><button onclick="DamanAdmin.handleKyc('${k.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد</button><button onclick="DamanAdmin.handleKyc('${k.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button></div>` : ''}
        </div>`).join('') || '<div class="text-center text-xs text-slate-400 py-5">لا توجد طلبات توثيق</div>'}</div>`;
    },

    renderVipTab(app) {
      return `
        <div class="space-y-4">
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-emerald-400">طلبات الاستلام الهندسي 3x (${this.inspReqs.length})</h4>
            ${this.inspReqs.map((r) => `<div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-xs"><div class="font-bold text-white">${app.esc(r.packageLabel)}</div><div class="text-[10px] text-slate-400">${app.esc(r.area)} | ${app.esc(r.location)} | ${app.esc(r.phone)}</div><button onclick="DamanAdmin.quoteInspection('${r.id}','${r.userId}')" class="w-full py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">تسعير (${r.quotedPrice ? app.fmtMoney(r.quotedPrice) + ' ج.م' : 'بانتظار السعر'})</button></div>`).join('')}
          </div>
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-amber-400">عمالة VIP (${this.vipLaborReqs.length})</h4>
            ${this.vipLaborReqs.map((r) => `<div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-xs"><div class="font-bold text-white">${app.esc(r.trade)} (${r.workersCount} عامل)</div><div class="text-[10px] text-slate-400">${app.esc(r.location)} | ${app.esc(r.phone)}</div><button onclick="DamanAdmin.replyVipLabor('${r.id}','${r.userId}')" class="w-full py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">رد الإدارة</button></div>`).join('')}
          </div>
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-rose-400">النزاعات (${this.disputes.length})</h4>
            ${this.disputes.map((d) => `<div class="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-1.5 text-xs"><div class="font-bold text-white">${app.esc(d.projectTitle)} (${app.fmtMoney(d.contractAmount)} ج.م)</div><div class="text-[10px] text-rose-200">${app.esc(d.reason)}</div>${d.status === 'open' ? `<div class="flex gap-1.5"><button onclick="DamanAdmin.resolveDispute('${d.id}','client')" class="flex-1 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">رد للعميل</button><button onclick="DamanAdmin.resolveDispute('${d.id}','provider')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">تحرير للمنفّذ</button></div>` : `<div class="text-[10px] text-emerald-300">تم الفصل (${app.esc(d.resolution)})</div>`}</div>`).join('')}
          </div>
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-sky-400">تذاكر الدعم (${this.tickets.length})</h4>
            ${this.tickets.map((t) => `<div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-xs"><div class="font-bold text-white">${app.esc(t.subject)}</div><div class="text-[10px] text-slate-400">${app.esc(t.userName)}: ${app.esc(t.message)}</div><button onclick="DamanAdmin.replyTicket('${t.id}','${t.userId}')" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">رد وإغلاق التذكرة</button></div>`).join('')}
          </div>
        </div>`;
    },

    renderUsersTab(app) {
      const q = this.userSearch.toLowerCase();
      const filtered = this.users.filter((u) => !q || (u.email + ' ' + u.name + ' ' + (u.phone || '') + ' ' + (u.companyName || '')).toLowerCase().includes(q));
      return `
        <div class="space-y-3">
          <input type="search" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالإيميل أو الموبايل أو الاسم..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          ${filtered.map((u) => `
            <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
              <div class="flex justify-between gap-2">
                <button onclick="DamanApp.openPublicProfile('${u.id}')" class="text-start min-w-0">
                  <div class="font-extrabold text-amber-300 underline truncate">${app.esc(u.companyName || u.name)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${app.esc(u.phone || '')} | ${app.esc(u.email)}</div>
                </button>
                <span class="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 shrink-0">${app.esc(u.status || 'active')}</span>
              </div>
              <div class="text-[10px] text-emerald-400 font-bold">متاح: ${app.fmtMoney(u.balanceAvailable)} | ضمان: ${app.fmtMoney(u.balanceEscrow)} | محجوز: ${app.fmtMoney(u.balanceHeld)}</div>
              <div class="grid grid-cols-5 gap-1">
                <button onclick="DamanAdmin.adjustUserBalance('${u.id}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[9px]">رصيد ±</button>
                <button onclick="DamanAdmin.holdUserFunds('${u.id}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[9px]">حجز</button>
                <button onclick="DamanAdmin.grantFreePlan('${u.id}')" class="py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[9px]">باقة هدية</button>
                <button onclick="DamanAdmin.setUserStatus('${u.id}','${u.status === 'frozen' ? 'active' : 'frozen'}')" class="py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold text-[9px]">تجميد</button>
                <button onclick="DamanAdmin.setUserStatus('${u.id}','${u.status === 'banned' ? 'active' : 'banned'}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[9px]">حظر</button>
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
          <button onclick="DamanWallet.openConfigModal()" class="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs">تعديل بيانات الاستلام (المحفظة + رابط إنستا باي + البنك)</button>
          <form onsubmit="DamanAdmin.sendBroadcast(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <h4 class="text-xs font-extrabold text-amber-400">إرسال إشعار جماعي لكل المستخدمين الآن</h4>
            <input id="bc-title" type="text" required placeholder="عنوان الإشعار" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="bc-body" rows="2" required placeholder="نص الرسالة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">إرسال للجميع</button>
          </form>
          <form onsubmit="DamanAdmin.saveGlobalSettings(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-sky-400">الأسعار والعمولة والإعلانات المبدئية</h4>
            <label class="flex items-center justify-between text-xs text-slate-200"><span>إخفاء الإعلانات المبدئية</span><input id="set-hide-demo" type="checkbox" ${hideDemo ? 'checked' : ''} class="accent-amber-500 w-4 h-4" /></label>
            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div><label class="text-slate-400">العمولة (%)</label><input id="set-comm" type="number" step="0.1" value="${ratePct}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-slate-400">أقل رصيد لـ Access</label><input id="set-min-bal" type="number" value="${pkgs.minCompanyBalanceForAccess || 100}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
              <input id="set-ind-m1" type="number" value="${pkgs.individual.m1}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-ind-m3" type="number" value="${pkgs.individual.m3}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-ind-m6" type="number" value="${pkgs.individual.m6}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-ind-m12" type="number" value="${pkgs.individual.m12}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
              <input id="set-cmp-m1" type="number" value="${pkgs.company.m1}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-cmp-m3" type="number" value="${pkgs.company.m3}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-cmp-m6" type="number" value="${pkgs.company.m6}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-cmp-m12" type="number" value="${pkgs.company.m12}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <input id="set-feat-w" type="number" value="${pkgs.featured.week}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <input id="set-feat-m" type="number" value="${pkgs.featured.month}" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">حفظ الإعدادات</button>
          </form>
        </div>`;
    },

    render(container, app) {
      if (!app.isAdmin()) return (container.innerHTML = `<div class="p-6 text-center text-xs text-rose-400">غير مصرح</div>`);
      if (!this.loaded) { this.loaded = true; this.loadTabData(app); }
      const tabs = [
        { id: 'posts', label: 'المنشورات' },
        { id: 'wallet', label: 'المحفظة' },
        { id: 'kyc', label: 'التوثيق' },
        { id: 'vip', label: 'ضمان ونزاعات' },
        { id: 'calls', label: 'المكالمات' },
        { id: 'users', label: 'المستخدمين' },
        { id: 'settings', label: 'الإعدادات' }
      ];
      const body =
        this.subTab === 'posts' ? this.renderPostsTab(app)
        : this.subTab === 'wallet' ? this.renderWalletTab(app)
        : this.subTab === 'kyc' ? this.renderKycTab(app)
        : this.subTab === 'vip' ? this.renderVipTab(app)
        : this.subTab === 'calls' ? this.renderCallsTab(app)
        : this.subTab === 'users' ? this.renderUsersTab(app)
        : this.renderSettingsTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-black text-amber-400"><i class="fa-solid fa-crown me-1.5"></i> لوحة الإدارة العليا</h2>
            <button onclick="DamanAdmin.loadTabData(DamanApp, true)" class="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-white"><i class="fa-solid fa-rotate"></i></button>
          </div>
          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            ${tabs.map((t) => `<button onclick="DamanAdmin.setSubTab('${t.id}')" class="py-1.5 rounded-lg text-[10px] font-extrabold ${this.subTab === t.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${t.label}</button>`).join('')}
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanAdmin = AdminMod;
  if (window.DamanApp) window.DamanApp.registerModule('admin', AdminMod);
})();
