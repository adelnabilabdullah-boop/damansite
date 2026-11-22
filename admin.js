(function () {
  const AdminMod = {
    subTab: 'treasury', // 'treasury' | 'kyc' | 'wallet' | 'contracts' | 'market' | 'ads' | 'companies' | 'users' | 'comms' | 'settings'
    loading: false,
    userSearch: '',
    lastErrors: [],
    pageLimits: { kyc: 15, wallet: 15, users: 25, comms: 15 },

    users: [],
    kycReqs: [],
    walletReqs: [],
    platformFees: [],
    adminExpenses: [],
    agreements: [],
    disputes: [],
    projects: [],
    inspections: [],
    vipLabors: [],
    companies: [],
    reports: [],
    blacklist: [],
    promoCodes: [],
    chats: [],
    callRecordings: [],
    tickets: [],

    initialized: false,

    detachListeners() {
      this.initialized = false;
      this.loading = false;
      this.lastErrors = [];
      this.users = [];
      this.kycReqs = [];
      this.walletReqs = [];
      this.platformFees = [];
      this.adminExpenses = [];
      this.agreements = [];
      this.disputes = [];
      this.projects = [];
      this.inspections = [];
      this.vipLabors = [];
      this.companies = [];
      this.reports = [];
      this.blacklist = [];
      this.promoCodes = [];
      this.chats = [];
      this.callRecordings = [];
      this.tickets = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'admin') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) {
      this.subTab = t;
      this.loadTabData(t);
    },

    loadMore(key) {
      this.pageLimits[key] = (this.pageLimits[key] || 15) + 15;
      this.loadTabData(this.subTab);
    },

    // Fault-tolerant query helper: never lets 1 collection freeze the Admin Panel
    async safeDocs(queryPromise, label) {
      try {
        const snap = await queryPromise;
        return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      } catch (err) {
        this.lastErrors.push(`${label}: ${err.message || err.code || 'خطأ صلاحيات'}`);
        return [];
      }
    },

    sortDesc(arr) {
      return arr.sort((a, b) => {
        const ta = a.createdAt?.seconds || a.submittedAt?.seconds || a.updatedAt?.seconds || 0;
        const tb = b.createdAt?.seconds || b.submittedAt?.seconds || b.updatedAt?.seconds || 0;
        return tb - ta;
      });
    },

    async loadTabData(tab) {
      const app = window.DamanApp;
      if (!app || !app.hasAdminAccess()) return;
      this.loading = true;
      this.lastErrors = [];
      this.initialized = true;
      this.rerender();

      const db = app.db;
      try {
        if (tab === 'treasury') {
          const [u, f, e, w] = await Promise.all([
            this.safeDocs(db.collection('users').limit(300).get(), 'المستخدمين'),
            this.safeDocs(db.collection('platformFees').limit(300).get(), 'الأرباح'),
            this.safeDocs(db.collection('adminExpenses').limit(150).get(), 'المصروفات'),
            this.safeDocs(db.collection('walletRequests').limit(300).get(), 'طلبات المحفظة')
          ]);
          this.users = u;
          this.platformFees = this.sortDesc(f);
          this.adminExpenses = this.sortDesc(e);
          this.walletReqs = this.sortDesc(w);
        } else if (tab === 'kyc') {
          this.kycReqs = this.sortDesc(await this.safeDocs(db.collection('kycRequests').limit(this.pageLimits.kyc || 15).get(), 'التوثيق'));
        } else if (tab === 'wallet') {
          this.walletReqs = this.sortDesc(await this.safeDocs(db.collection('walletRequests').limit(this.pageLimits.wallet || 15).get(), 'المحفظة'));
        } else if (tab === 'contracts') {
          const [a, d] = await Promise.all([
            this.safeDocs(db.collection('chatAgreements').limit(80).get(), 'العقود'),
            this.safeDocs(db.collection('disputes').limit(60).get(), 'النزاعات')
          ]);
          this.agreements = this.sortDesc(a);
          this.disputes = this.sortDesc(d);
        } else if (tab === 'market') {
          const [p, i, v] = await Promise.all([
            this.safeDocs(db.collection('projects').limit(100).get(), 'السوق'),
            this.safeDocs(db.collection('vipRequests').limit(60).get(), 'الاستلام 3x'),
            this.safeDocs(db.collection('vipLaborRequests').limit(60).get(), 'عمالة VIP')
          ]);
          this.projects = this.sortDesc(p);
          this.inspections = this.sortDesc(i);
          this.vipLabors = this.sortDesc(v);
        } else if (tab === 'companies') {
          this.companies = this.sortDesc(await this.safeDocs(db.collection('companies').limit(80).get(), 'الشركات'));
        } else if (tab === 'users') {
          const [u, r, b, p] = await Promise.all([
            this.safeDocs(db.collection('users').limit(this.pageLimits.users || 25).get(), 'المستخدمين'),
            this.safeDocs(db.collection('reports').limit(40).get(), 'البلاغات'),
            this.safeDocs(db.collection('blacklist').limit(100).get(), 'القائمة السوداء'),
            this.safeDocs(db.collection('promoCodes').limit(50).get(), 'أكواد الهدايا')
          ]);
          this.users = this.sortDesc(u);
          this.reports = this.sortDesc(r);
          this.blacklist = this.sortDesc(b);
          this.promoCodes = p;
        } else if (tab === 'comms') {
          const [c, r, t] = await Promise.all([
            this.safeDocs(db.collection('chats').limit(this.pageLimits.comms || 15).get(), 'المحادثات'),
            this.safeDocs(db.collection('callRecordings').limit(this.pageLimits.comms || 15).get(), 'التسجيلات'),
            this.safeDocs(db.collection('supportTickets').limit(40).get(), 'التذاكر')
          ]);
          this.chats = this.sortDesc(c);
          this.callRecordings = this.sortDesc(r);
          this.tickets = this.sortDesc(t);
        }
      } finally {
        this.loading = false;
        this.rerender();
      }
    },

    // ==================== 1. TREASURY ====================
    async recordAdminExpense(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return app.toast('متاح للأدمن الرئيسي فقط', 'error');
      const amount = Math.round((parseFloat(document.getElementById('ae-amt').value) || 0) * 100) / 100;
      const category = document.getElementById('ae-cat').value;
      const note = document.getElementById('ae-note').value.trim();
      if (amount <= 0 || !note) return;
      try {
        await app.db.collection('adminExpenses').add({
          amount, category, note, date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast('تم الخصم من خزنة الأرباح الصافية ✅', 'success');
        this.loadTabData('treasury');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== 2. KYC VERIFICATION ====================
    async approveKyc(uid) {
      const app = window.DamanApp;
      await app.withLock('appKyc_' + uid, async () => {
        const legalName = (document.getElementById('kyc-ed-name-' + uid)?.value || '').trim();
        const nidRaw = (document.getElementById('kyc-ed-nid-' + uid)?.value || '').trim();
        const legalAddress = (document.getElementById('kyc-ed-addr-' + uid)?.value || '').trim();
        const compName = (document.getElementById('kyc-ed-comp-' + uid)?.value || '').trim();
        const cr = (document.getElementById('kyc-ed-cr-' + uid)?.value || '').trim();
        const tax = (document.getElementById('kyc-ed-tax-' + uid)?.value || '').trim();

        const parsed = app.parseEgyptianNationalId(nidRaw);
        if (!parsed.valid) return app.toast(parsed.error, 'error');
        if (legalName.split(/\s+/).length < 3) return app.toast('اكتب الاسم الرباعي بالكامل مطابقاً للبطاقة', 'warning');

        try {
          const dupSnap = await app.db.collection('users').where('nationalId', '==', parsed.nid).limit(2).get();
          const conflict = dupSnap.docs.find((d) => d.id !== uid);
          if (conflict) return app.toast('⚠️ هذا الرقم القومي موثّق بالفعل لحساب آخر!', 'error');

          const patch = {
            kycStatus: 'verified', kycRejectionReason: '', legalName,
            nationalId: parsed.nid, birthDate: parsed.birthDate, legalAddress, kycVerifiedAt: Date.now()
          };
          if (compName) patch.companyName = compName;
          if (cr) patch.commercialReg = cr;
          if (tax) patch.taxCard = tax;

          await app.db.collection('users').doc(uid).update(patch);
          await app.db.collection('kycRequests').doc(uid).update({
            status: 'approved', legalName, nationalId: parsed.nid, birthDate: parsed.birthDate,
            legalAddress, reviewedAt: firebase.firestore.FieldValue.serverTimestamp(), reviewedBy: app.user.email
          });
          await app.sendNotification(uid, '✅ تم توثيق حسابك وتثبيت بياناتك القانونية!', 'يمكنك الآن استخدام المحفظة، السوق، والعقود المضمونة.');
          app.toast('تم اعتماد التوثيق وقفل البيانات القانونية بنجاح ✅', 'success');
          this.loadTabData('kyc');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async rejectKyc(uid) {
      const app = window.DamanApp;
      const reason = window.prompt('سبب رفض التوثيق:', 'صور البطاقة أو السيلفي غير واضحة — يرجى إعادة التصوير');
      if (!reason) return;
      try {
        await app.db.collection('users').doc(uid).update({ kycStatus: 'rejected', kycRejectionReason: reason.trim() });
        await app.db.collection('kycRequests').doc(uid).update({ status: 'rejected', rejectionReason: reason.trim() });
        await app.sendNotification(uid, '❌ تم رفض مستندات التوثيق', reason.trim());
        app.toast('تم رفض الطلب وإبلاغ المستخدم', 'info');
        this.loadTabData('kyc');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== 3. WALLET DEPOSIT & WITHDRAW ====================
    async handleWalletReq(reqId, action) {
      const app = window.DamanApp;
      const req = this.walletReqs.find((r) => r.id === reqId);
      if (!req) return;
      let adminNote = '';
      if (action === 'reject') {
        adminNote = window.prompt('سبب الرفض:', 'بيانات التحويل غير مطابقة');
        if (adminNote === null) return;
      } else {
        const confirmTxt = req.type === 'deposit'
          ? `تأكيد اعتماد إيداع ${app.fmtMoney(req.amount)} ج.م لحساب ${req.userName}؟`
          : `تأكيد تحويل صافي السحب (${app.fmtMoney(req.netPayout || req.amount)} ج.م) إلى ${req.destAccount}؟`;
        if (!window.confirm(confirmTxt)) return;
      }

      await app.withLock('wReq_' + reqId, async () => {
        const reqRef = app.db.collection('walletRequests').doc(reqId);
        const userRef = app.db.collection('users').doc(req.userId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [rDoc, uDoc] = await Promise.all([tx.get(reqRef), tx.get(userRef)]);
            if (!rDoc.exists) throw new Error('الطلب غير موجود');
            const r = rDoc.data();
            if (r.status !== 'pending') throw new Error('تمت معالجة هذا الطلب مسبقاً!');
            const u = uDoc.data() || {};
            const curAvail = Number(u.balanceAvailable || 0);
            const curHold = Number(u.balancePendingWithdraw || 0);
            const amt = Number(r.amount || 0);

            if (r.type === 'deposit') {
              if (action === 'approve') {
                tx.update(userRef, { balanceAvailable: Math.round((curAvail + amt) * 100) / 100 });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'deposit_approved', amount: amt,
                  note: `شحن محفظة معتمد (${r.channel} — مرجع ${r.txRef || ''})`, date: app.todayLocal(),
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
            } else {
              if (action === 'approve') {
                if (curHold < amt - 0.01) throw new Error('الرصيد المحجوز للسحب لا يكفي');
                tx.update(userRef, { balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100) });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'withdraw_paid', amount: 0,
                  note: `تم تحويل السحب (${app.fmtMoney(r.netPayout || amt)} ج.م على ${r.destAccount})`, date: app.todayLocal(),
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                const wFee = Number(r.withdrawFee || 0);
                if (wFee > 0) {
                  tx.set(app.db.collection('platformFees').doc(), {
                    type: 'withdraw_fee', requestId: reqId, userId: r.userId, userName: r.userName || '',
                    amount: wFee, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                }
              } else {
                tx.update(userRef, {
                  balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100),
                  balanceAvailable: Math.round((curAvail + amt) * 100) / 100
                });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'withdraw_refund', amount: amt,
                  note: `رد مبلغ سحب مرفوض: ${adminNote}`, date: app.todayLocal(),
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
            }
            tx.update(reqRef, {
              status: action === 'approve' ? 'approved' : 'rejected',
              adminNote, processedBy: app.user.email, processedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(
            req.userId,
            action === 'approve' ? (req.type === 'deposit' ? '✅ تم شحن محفظتك' : '✅ تم تحويل السحب') : '❌ تم رفض طلب المحفظة',
            action === 'approve' ? `المبلغ: ${app.fmtMoney(req.amount)} ج.م` : adminNote
          );
          app.toast('تم تنفيذ العملية بنجاح ✅', 'success');
          this.loadTabData('wallet');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 4. CONTRACTS & DISPUTES ====================
    async reviewSignedContract(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          contractStatus: approve ? 'approved' : 'rejected',
          contractReviewedBy: app.user.email,
          contractReviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification(ag.payerUid, approve ? `✅ تم اعتماد العقد (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'أزرار الصرف واليوميات مفعّلة الآن.' : 'يرجى رفع صورة واضحة.');
        await app.sendNotification(ag.providerUid, approve ? `✅ تم اعتماد العقد (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'يمكنكم بدء التشغيل الآن.' : 'يرجى إعادة رفع صورة العقد.');
        app.toast(approve ? 'تم اعتماد العقد الموقّع ✅' : 'تم رفض الصورة', 'success');
        this.loadTabData('contracts');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async resolveDispute(disputeId, decision) {
      const app = window.DamanApp;
      const d = this.disputes.find((x) => x.id === disputeId);
      if (!d || d.status !== 'open') return;
      const agRef = app.db.collection('chatAgreements').doc(d.agreementId);
      const dispRef = app.db.collection('disputes').doc(disputeId);

      let customWorkerShare = null;
      if (decision === 'split') {
        const agSnap = await agRef.get();
        const rem = Number((agSnap.data() || {}).remainingEscrow || 0);
        const inp = parseFloat(window.prompt(`المتبقي بالضمان: ${app.fmtMoney(rem)} ج.م.\nالمبلغ المحكوم به للمنفّذ:`, String(Math.round(rem / 2))));
        if (isNaN(inp) || inp < 0 || inp > rem) return app.toast('مبلغ غير صالح', 'error');
        customWorkerShare = Math.round(inp * 100) / 100;
      }
      const note = window.prompt('حيثيات قرار التحكيم:', 'تم الفصل بناءً على الأدلة والمحادثات');
      if (note === null) return;

      await app.withLock('resDisp_' + disputeId, async () => {
        try {
          await app.db.runTransaction(async (tx) => {
            const [dDoc, aDoc] = await Promise.all([tx.get(dispRef), tx.get(agRef)]);
            if (dDoc.data().status !== 'open') throw new Error('تم الفصل بالفعل');
            const a = aDoc.data();
            const payerRef = app.db.collection('users').doc(a.payerUid);
            const provRef = app.db.collection('users').doc(a.providerUid);
            const [pDoc, wDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef)]);

            const rem = Number(a.remainingEscrow || 0);
            const lockedFee = Number(a.lockedFee || 0);
            const totalEscrowHeld = Math.round((rem + lockedFee) * 100) / 100;
            const workerShare = decision === 'provider' ? rem : decision === 'client' ? 0 : Math.min(rem, customWorkerShare);
            const clientPrincipalBack = Math.max(0, Math.round((rem - workerShare) * 100) / 100);
            const executedTotal = Math.round((Number(a.paidSoFar || 0) + workerShare) * 100) / 100;
            const earnedFee = Math.min(lockedFee, Math.round(executedTotal * app.getCommissionRate() * 100) / 100);
            const unusedFeeBack = Math.max(0, Math.round((lockedFee - earnedFee) * 100) / 100);
            const totalClientBack = Math.round((clientPrincipalBack + unusedFeeBack) * 100) / 100;

            tx.update(payerRef, {
              balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - totalEscrowHeld) * 100) / 100),
              balanceAvailable: Math.round((Number((pDoc.data() || {}).balanceAvailable || 0) + totalClientBack) * 100) / 100
            });
            if (workerShare > 0) {
              tx.update(provRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + workerShare) * 100) / 100 });
            }
            if (earnedFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                agreementId: d.agreementId, type: 'dispute_fee', ticketNumber: a.ticketNumber, amount: earnedFee,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(agRef, { status: workerShare > 0 ? 'completed' : 'cancelled', remainingEscrow: 0, lockedFee: 0, paidSoFar: Math.round((Number(a.paidSoFar || 0) + workerShare) * 100) / 100 });
            tx.update(dispRef, { status: 'resolved', decision, workerShare, clientRefund: totalClientBack, adminNote: note, resolvedBy: app.user.email, resolvedAt: firebase.firestore.FieldValue.serverTimestamp() });
          });
          await app.sendNotification(d.clientId, `⚖️ قرار التحكيم (${d.contractNumber})`, note);
          await app.sendNotification(d.providerId, `⚖️ قرار التحكيم (${d.contractNumber})`, note);
          app.toast('تم الفصل في النزاع وتصفية الضمان ✅', 'success');
          this.loadTabData('contracts');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 5. MARKET, 3x & VIP LABOR ====================
    async moderateProject(pid, status) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      try {
        await app.db.collection('projects').doc(pid).update({ status });
        if (p) await app.sendNotification(p.ownerId, status === 'approved' ? '✅ تم نشر إعلانك' : '❌ تم رفض إعلانك', p.title);
        app.toast('تم التحديث ✅', 'success');
        this.loadTabData('market');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async quoteInspection(reqId) {
      const app = window.DamanApp;
      const r = this.inspections.find((x) => x.id === reqId);
      if (!r) return;
      const price = parseFloat(window.prompt(`تسعير الاستلام الهندسي 3x (${r.element}):`, r.quotedPrice || '1500'));
      if (!price || price <= 0) return;
      const note = window.prompt('ملاحظة الإدارة:', 'تم التسعير — اضغط موافقة ودفع من المحفظة لتأكيد الزيارة') || '';
      try {
        await app.db.collection('vipRequests').doc(reqId).update({ quotedPrice: price, adminNote: note, status: 'quoted' });
        await app.sendNotification(r.userId, `تم تسعير طلب الاستلام 3x (${app.fmtMoney(price)} ج.م)`, note);
        app.toast('تم إرسال التسعيرة ✅', 'success');
        this.loadTabData('market');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async completeInspection(reqId) {
      await window.DamanApp.db.collection('vipRequests').doc(reqId).update({ status: 'completed' });
      window.DamanApp.toast('تم إغلاق الطلب كمكتمل ✅', 'success');
      this.loadTabData('market');
    },

    async quoteVipLabor(reqId) {
      const app = window.DamanApp;
      const r = this.vipLabors.find((x) => x.id === reqId);
      if (!r) return;
      const baseCost = parseFloat(window.prompt(`التكلفة الصافية للعمالة (${r.workersCount} ${r.trade} × ${r.days} يوم):`, r.baseCost || '5000'));
      if (!baseCost || baseCost <= 0) return;
      const rate = app.getVipCommissionRate();
      const vipFee = Math.round(baseCost * rate * 100) / 100;
      const totalQuoted = Math.round((baseCost + vipFee) * 100) / 100;
      const note = window.prompt('ملاحظة الإدارة:', `التكلفة ${app.fmtMoney(baseCost)} + عمولة VIP ${app.fmtMoney(vipFee)}`) || '';
      try {
        await app.db.collection('vipLaborRequests').doc(reqId).update({ baseCost, vipFee, totalQuoted, adminNote: note, status: 'quoted' });
        await app.sendNotification(r.userId, `تم تسعير عمالة VIP (${app.fmtMoney(totalQuoted)} ج.م)`, note);
        app.toast('تم إرسال التسعيرة ✅', 'success');
        this.loadTabData('market');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async settleVipLabor(reqId, mode) {
      const app = window.DamanApp;
      const r = this.vipLabors.find((x) => x.id === reqId);
      if (!r || r.status !== 'funded') return;
      const amt = Number(r.lockedBaseCost || r.baseCost || 0);
      if (!window.confirm(mode === 'settle' ? `إتمام وتسوية الضمان (${app.fmtMoney(amt)} ج.م)؟` : `رد الضمان (${app.fmtMoney(amt)} ج.م) للعميل؟`)) return;
      await app.withLock('setVip_' + reqId, async () => {
        const uRef = app.db.collection('users').doc(r.userId);
        const rRef = app.db.collection('vipLaborRequests').doc(reqId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [uDoc, reqDoc] = await Promise.all([tx.get(uRef), tx.get(rRef)]);
            if (reqDoc.data().status !== 'funded') throw new Error('تمت التسوية مسبقاً');
            const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            const uPatch = { balanceEscrow: Math.max(0, Math.round((curEsc - amt) * 100) / 100) };
            if (mode === 'refund') uPatch.balanceAvailable = Math.round((curAvail + amt) * 100) / 100;
            tx.update(uRef, uPatch);
            tx.update(rRef, { status: mode === 'settle' ? 'settled' : 'refunded', settledAt: firebase.firestore.FieldValue.serverTimestamp() });
          });
          app.toast('تمت التسوية بنجاح ✅', 'success');
          this.loadTabData('market');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 6. HOME BANNERS & DEMO SHOWCASE ADS CONTROL ====================
    async toggleDemoPosts(hide) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      try {
        await app.db.collection('settings').doc('appConfig').set({ hideDemoPosts: !!hide }, { merge: true });
        app.toast(hide ? 'تم إخفاء المنشورات التوضيحية من السوق' : 'تم إظهار المنشورات التوضيحية في كل الأقسام ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async addCustomHomeBanner(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const badge = document.getElementById('hb-badge').value.trim() || 'عرض ضمان سايت';
      const title = document.getElementById('hb-title').value.trim();
      const subtitle = document.getElementById('hb-sub').value.trim();
      const ctaText = document.getElementById('hb-cta').value.trim() || 'تواصل الآن';
      const action = document.getElementById('hb-act').value;
      const theme = document.getElementById('hb-theme').value;
      if (!title) return;

      const cur = Array.isArray(app.appConfig?.customHomeBanners) ? app.appConfig.customHomeBanners : [];
      const updated = cur.concat([{ id: 'bn_' + Date.now(), badge, title, subtitle, ctaText, action, theme }]);
      try {
        await app.db.collection('settings').doc('appConfig').set({ customHomeBanners: updated }, { merge: true });
        e.target.reset();
        app.toast('تمت إضافة الإعلان للصفحة الرئيسية فوراً ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async deleteCustomHomeBanner(id) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const cur = Array.isArray(app.appConfig?.customHomeBanners) ? app.appConfig.customHomeBanners : [];
      const updated = cur.filter((x) => x.id !== id);
      try {
        await app.db.collection('settings').doc('appConfig').set({ customHomeBanners: updated }, { merge: true });
        app.toast('تم حذف الإعلان', 'info');
      } catch (e) {}
    },

    // ==================== 7. COMPANIES CONTROL ====================
    async openCompanyControlModal(compId) {
      const app = window.DamanApp;
      const comp = this.companies.find((c) => c.id === compId);
      if (!comp) return;
      let m = document.getElementById('daman-admin-comp-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-admin-comp-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-5 text-center text-xs text-slate-300">جارٍ التحميل...</div>`;
      try {
        const [memSnap, cusSnap] = await Promise.all([
          app.db.collection('companyMembers').where('companyId', '==', compId).limit(100).get(),
          app.db.collection('companyCustody').where('companyId', '==', compId).limit(40).get()
        ]);
        const mems = memSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        const custs = cusSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
            <div class="flex items-center justify-between"><h3 class="text-sm font-black text-purple-300">👑 ${app.esc(comp.name)}</h3><button onclick="document.getElementById('daman-admin-comp-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">الكود: <b class="text-amber-300">${app.esc(comp.code)}</b> • المالك: <b>${app.esc(comp.ownerName || '—')}</b></div>
            <form onsubmit="DamanAdmin.sendAdminCompanyMsg(event,'${compId}')" class="flex gap-1.5">
              <input id="adm-comp-msg" type="text" required placeholder="إرسال تنبيه لجروب الشركة..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white" />
              <button type="submit" class="px-3 py-2 rounded-xl bg-purple-500 text-white font-black">إرسال</button>
            </form>
            <div class="font-black text-amber-400">أعضاء الشركة (${mems.length})</div>
            ${mems.map((mem) => `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div class="flex justify-between"><b class="text-white">${app.esc(mem.name)} (${app.esc(mem.jobTitle || '')})</b><span class="text-emerald-400">أساسي: ${app.fmtMoney(mem.baseSalary || 0)}</span></div>
                <div class="flex gap-1.5">
                  <button onclick="DamanAdmin.adminEditCompMemberSalary('${mem.id}','${compId}',${Number(mem.baseSalary || 0)})" class="flex-1 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">تعديل الراتب</button>
                  <button onclick="DamanAdmin.adminToggleCompMember('${mem.id}','${compId}','${mem.status || 'active'}')" class="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">${mem.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button>
                </div>
              </div>`).join('')}
            <div class="font-black text-sky-400">حركات العهدة (${custs.length})</div>
            ${custs.slice(0, 8).map((c) => `<div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-[10.5px]"><span>${app.esc(c.holderName)}: ${app.esc(c.note)}</span><b class="text-amber-300">${app.fmtMoney(c.amount)} ج.م</b></div>`).join('') || '<div class="text-slate-500">لا توجد عهدة</div>'}
          </div>`;
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async sendAdminCompanyMsg(e, compId) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('adm-comp-msg');
      const text = inp?.value.trim();
      if (!text) return;
      await app.db.collection('companyMessages').add({
        companyId: compId, senderId: app.user.uid, senderName: '👑 إدارة ضمان سايت',
        isPlatformAdmin: true, text, date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      inp.value = '';
      app.toast('تم إرسال الرسالة لجروب الشركة ✅', 'success');
    },

    async adminEditCompMemberSalary(memId, compId, curSal) {
      const nv = parseFloat(window.prompt('الراتب الأساسي الجديد:', curSal));
      if (isNaN(nv) || nv < 0) return;
      await window.DamanApp.db.collection('companyMembers').doc(memId).update({ baseSalary: nv });
      this.openCompanyControlModal(compId);
    },

    async adminToggleCompMember(memId, compId, curSt) {
      await window.DamanApp.db.collection('companyMembers').doc(memId).update({ status: curSt === 'suspended' ? 'active' : 'suspended' });
      this.openCompanyControlModal(compId);
    },

    // ==================== 8. USERS, BIRTHDAYS, BLACKLIST, PROMOS, REPORTS ====================
    async sendBirthdayGift(uid, userName) {
      const app = window.DamanApp;
      const amt = parseFloat(window.prompt(`🎂 هدية عيد ميلاد إلى ${userName} (0 للتهنئة فقط):`, '50'));
      if (isNaN(amt) || amt < 0) return;
      try {
        if (amt > 0) {
          const uRef = app.db.collection('users').doc(uid);
          await app.db.runTransaction(async (tx) => {
            const uDoc = await tx.get(uRef);
            tx.update(uRef, { balanceAvailable: Math.round((Number((uDoc.data() || {}).balanceAvailable || 0) + amt) * 100) / 100 });
            tx.set(app.db.collection('transactions').doc(), {
              userId: uid, type: 'birthday_gift', amount: amt,
              note: '🎂 هدية عيد ميلاد من إدارة ضمان سايت', date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
        }
        await app.sendNotification(uid, `🎂 كل سنة وأنت طيب يا ${userName}!`, amt > 0 ? `أهدتك الإدارة ${app.fmtMoney(amt)} ج.م في محفظتك 🎉` : 'كل عام وأنت بخير 🎉');
        app.toast('تم إرسال هدية عيد الميلاد 🎂', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async toggleBanUser(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      const ban = u.status !== 'banned';
      const reason = ban ? (window.prompt('سبب الحظر:', 'مخالفة شروط ضمان سايت') || 'مخالفة') : '';
      await app.db.collection('users').doc(uid).update({ status: ban ? 'banned' : 'active', banReason: reason });
      app.toast(ban ? 'تم الحظر' : 'تم فك الحظر ✅', 'info');
      this.loadTabData('users');
    },

    async deleteUserSafely(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      if (Number(u.balanceAvailable || 0) > 0 || Number(u.balanceEscrow || 0) > 0 || Number(u.balancePendingWithdraw || 0) > 0) {
        return app.toast('❌ ممنوع حذف مستخدم لديه رصيد متاح أو ضمان!', 'error');
      }
      if (!window.confirm(`حذف سجل «${u.name}» نهائياً؟`)) return;
      await app.db.collection('users').doc(uid).delete();
      app.toast('تم الحذف', 'info');
      this.loadTabData('users');
    },

    async addBlacklistEntry(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const value = document.getElementById('bl-val').value.trim();
      const reason = document.getElementById('bl-reason').value.trim() || 'حظر دائم';
      if (!value) return;
      await app.db.collection('blacklist').add({ value, reason, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      e.target.reset();
      app.toast('تمت الإضافة للقائمة السوداء 🚫', 'success');
      this.loadTabData('users');
    },

    async removeBlacklist(id) {
      await window.DamanApp.db.collection('blacklist').doc(id).delete();
      this.loadTabData('users');
    },

    async createPromoCode(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const code = document.getElementById('pr-code').value.trim().toUpperCase();
      const amount = parseFloat(document.getElementById('pr-amt').value) || 0;
      const maxUses = parseInt(document.getElementById('pr-max').value, 10) || 10;
      if (!code || amount <= 0) return;
      await app.db.collection('promoCodes').doc(code).set({
        code, amount, maxUses, usedBy: [], active: true,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast(`تم إنشاء الكود ${code} 🎁`, 'success');
      this.loadTabData('users');
    },

    async resolveReport(id, st) {
      await window.DamanApp.db.collection('reports').doc(id).update({ status: st });
      this.loadTabData('users');
    },

    // ==================== 9. COMMS & SETTINGS ====================
    async toggleFreezeChat(chatId, curFrozen) {
      await window.DamanApp.db.collection('chats').doc(chatId).update({ frozen: !curFrozen });
      this.loadTabData('comms');
    },

    async playCallRecording(recId, mediaId) {
      const slot = document.getElementById('rec-player-' + recId);
      if (!slot) return;
      slot.innerHTML = `<span class="text-[10px] text-amber-300">جارٍ التحميل...</span>`;
      const src = await window.DamanApp.fetchMedia(mediaId);
      slot.innerHTML = src ? `<audio controls autoplay src="${src}" class="w-full h-8 mt-1"></audio>` : `<span class="text-[10px] text-rose-400">غير متاح</span>`;
    },

    async togglePinRecording(recId, curPinned) {
      await window.DamanApp.db.collection('callRecordings').doc(recId).update({ pinned: !curPinned });
      this.loadTabData('comms');
    },

    async cleanupExpiredRecordings() {
      const app = window.DamanApp;
      const expired = this.callRecordings.filter((r) => !r.pinned && Number(r.expiresAt || 0) < Date.now());
      if (!expired.length) return app.toast('لا توجد تسجيلات منتهية (>30 يوم)', 'info');
      if (!window.confirm(`حذف ${expired.length} تسجيل منتهي؟`)) return;
      for (const r of expired) {
        if (r.audioMedia) await app.db.collection('mediaVault').doc(r.audioMedia).delete().catch(() => {});
        await app.db.collection('callRecordings').doc(r.id).delete().catch(() => {});
      }
      this.loadTabData('comms');
    },

    async replyTicket(tid, userId) {
      const reply = window.prompt('رد الإدارة على التذكرة:');
      if (!reply) return;
      await window.DamanApp.db.collection('supportTickets').doc(tid).update({ adminReply: reply.trim(), status: 'closed' });
      await window.DamanApp.sendNotification(userId, 'تم الرد على تذكرتك', reply.trim());
      this.loadTabData('comms');
    },

    async saveSettings(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return app.toast('متاح للأدمن الرئيسي فقط', 'error');
      const modsRaw = (document.getElementById('st-mods')?.value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const cfg = {
        paymentAccounts: {
          vodafoneCash: document.getElementById('st-vf').value.trim(),
          instaPay: document.getElementById('st-ip').value.trim(),
          bankInfo: document.getElementById('st-bank').value.trim()
        },
        commissionRate: (parseFloat(document.getElementById('st-comm').value) || 3.5) / 100,
        vipCommissionRate: (parseFloat(document.getElementById('st-vipcomm').value) || 10) / 100,
        minDeposit: parseFloat(document.getElementById('st-mindep').value) || 100,
        minWithdraw: parseFloat(document.getElementById('st-minwd').value) || 100,
        withdrawFeePct: parseFloat(document.getElementById('st-wfpct').value) || 0,
        withdrawFeeFlat: parseFloat(document.getElementById('st-wfflat').value) || 0,
        packages: {
          individualMonthly: parseFloat(document.getElementById('st-pkg-ind').value) || 150,
          companyMonthly: parseFloat(document.getElementById('st-pkg-comp').value) || 450,
          boostAdPrice: parseFloat(document.getElementById('st-pkg-boost').value) || 75
        },
        supportWhatsapp: document.getElementById('st-wa').value.trim(),
        turnServer: document.getElementById('st-turn').value.trim(),
        moderators: modsRaw,
        maintenanceMode: document.getElementById('st-maint').checked,
        disableCalls: document.getElementById('st-nocalls').checked
      };
      try {
        await app.db.collection('settings').doc('appConfig').set(cfg, { merge: true });
        app.toast('تم حفظ إعدادات المنصة وتحديث حسابات الإيداع فوراً ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async exportFullBackup() {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      app.toast('جارٍ تجهيز النسخة الاحتياطية...', 'info');
      const cols = ['users', 'walletRequests', 'platformFees', 'adminExpenses', 'chatAgreements', 'disputes', 'projects', 'companies', 'companyMembers', 'vipRequests', 'vipLaborRequests', 'blacklist', 'promoCodes', 'settings'];
      const dump = { exportedAt: new Date().toISOString(), app: 'DamanSite', collections: {} };
      for (const c of cols) {
        dump.collections[c] = await this.safeDocs(app.db.collection(c).limit(500).get(), c);
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `damansite-backup-${app.todayLocal()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.toast('تم تنزيل النسخة الاحتياطية ✅', 'success');
    },

    // ==================== RENDER SUB-TABS ====================
    renderTreasuryTab(app) {
      let usersAvail = 0, usersEscrow = 0, usersHoldW = 0;
      this.users.forEach((u) => {
        usersAvail += Number(u.balanceAvailable || 0);
        usersEscrow += Number(u.balanceEscrow || 0);
        usersHoldW += Number(u.balancePendingWithdraw || 0);
      });
      const totalUsersTrust = Math.round((usersAvail + usersEscrow + usersHoldW) * 100) / 100;
      let grossProfit = 0;
      this.platformFees.forEach((f) => { grossProfit += Number(f.amount || 0); });
      let totalExpenses = 0;
      this.adminExpenses.forEach((x) => { totalExpenses += Number(x.amount || 0); });
      const netProfit = Math.round((grossProfit - totalExpenses) * 100) / 100;

      const channels = { vodafone_cash: { in: 0, out: 0 }, instapay: { in: 0, out: 0 }, bank: { in: 0, out: 0 } };
      this.walletReqs.forEach((r) => {
        if (r.status !== 'approved') return;
        const ch = channels[r.channel] ? r.channel : 'vodafone_cash';
        if (r.type === 'deposit') channels[ch].in += Number(r.amount || 0);
        else channels[ch].out += Number(r.netPayout || r.amount || 0);
      });

      return `
        <div class="space-y-3 text-xs">
          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500 space-y-1">
              <div class="text-[10px] text-emerald-300 font-black">💰 خزنة أرباحك الصافية</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(netProfit)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">أرباح: ${app.fmtMoney(grossProfit)} | مصروف: ${app.fmtMoney(totalExpenses)}</div>
            </div>
            <div class="p-3.5 rounded-2xl bg-amber-500/15 border-2 border-amber-500 space-y-1">
              <div class="text-[10px] text-amber-300 font-black">🛡️ أمانات المستخدمين</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(totalUsersTrust)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">متاح: ${app.fmtMoney(usersAvail)} | ضمان: ${app.fmtMoney(usersEscrow)} | سحب: ${app.fmtMoney(usersHoldW)}</div>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">الجرد الفعلي لقنوات الدفع (إيداعات − مسحوبات)</div>
            <div class="grid grid-cols-3 gap-2 text-center">
              ${[['vodafone_cash', 'فودافون كاش'], ['instapay', 'إنستا باي'], ['bank', 'البنك']].map(([k, lbl]) => `
                <div class="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div class="text-[10px] text-slate-400 font-bold">${lbl}</div>
                  <div class="text-xs font-black text-emerald-400 mt-0.5">${app.fmtMoney(Math.round((channels[k].in - channels[k].out) * 100) / 100)} ج.م</div>
                  <div class="text-[9px] text-slate-500">+${app.fmtMoney(channels[k].in)} / -${app.fmtMoney(channels[k].out)}</div>
                </div>`).join('')}
            </div>
          </div>

          ${app.isAdmin() ? `
            <form onsubmit="DamanAdmin.recordAdminExpense(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
              <div class="font-black text-purple-300">سحب أرباح / تسجيل مصروفات تشغيل من خزنتك</div>
              <div class="grid grid-cols-2 gap-2">
                <input id="ae-amt" type="number" min="1" step="any" required placeholder="المبلغ (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white font-black" />
                <select id="ae-cat" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="profit_withdraw">سحب أرباح شخصية</option>
                  <option value="marketing">تسويق وإعلانات</option>
                  <option value="operations">تشغيل ومرتبات</option>
                </select>
              </div>
              <input id="ae-note" type="text" required placeholder="البيان..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">تسجيل الخصم من الأرباح</button>
            </form>` : ''}

          <div class="font-black text-slate-300">آخر مصادر الأرباح (${this.platformFees.length})</div>
          <div class="space-y-1.5">
            ${this.platformFees.slice(0, 15).map((f) => `<div class="glass-card rounded-xl p-2.5 flex justify-between"><span><b class="text-white">${app.esc(f.type)}</b> • ${app.esc(f.date || '')}</span><b class="text-emerald-400">+${app.fmtMoney(f.amount)} ج.م</b></div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد أرباح مسجّلة بعد</div>'}
          </div>
        </div>`;
    },

    renderAdsTab(app) {
      const hideDemos = !!app.appConfig?.hideDemoPosts;
      const customBanners = Array.isArray(app.appConfig?.customHomeBanners) ? app.appConfig.customHomeBanners : [];
      return `
        <div class="space-y-3.5 text-xs">
          <!-- Toggle Built-in 20 Demo Showcase Posts across 17 categories -->
          <div class="glass-card rounded-2xl p-3.5 border-amber-500/40 flex items-center justify-between gap-2">
            <div>
              <div class="font-black text-amber-400">المنشورات التوضيحية والنماذج في السوق (20 إعلان في الـ 17 قسم)</div>
              <div class="text-[10.5px] text-slate-300">الحالة الآن: <b class="${hideDemos ? 'text-rose-400' : 'text-emerald-400'}">${hideDemos ? 'مخفية' : 'ظاهرة ومفعّلة ✅'}</b> (أي مراسلة عليها تتحوّل لإدارتك)</div>
            </div>
            <button onclick="DamanAdmin.toggleDemoPosts(${!hideDemos})" class="px-3 py-2 rounded-xl ${hideDemos ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'} font-black text-[10.5px] shrink-0">
              ${hideDemos ? 'إظهارها' : 'إخفاؤها'}
            </button>
          </div>

          <!-- Add New Custom Banner on Home Page -->
          <form onsubmit="DamanAdmin.addCustomHomeBanner(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-emerald-500/40">
            <div class="font-black text-emerald-400"><i class="fa-solid fa-bullhorn me-1"></i> إضافة إعلان / عرض جديد خاص بك على الصفحة الرئيسية</div>
            <div class="grid grid-cols-2 gap-2">
              <input id="hb-badge" type="text" placeholder="شارة فوق (مثال: عرض خاص 🔥)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="hb-theme" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold">
                <option value="amber">لون ذهبي (ضمان سايت)</option>
                <option value="emerald">لون أخضر (استلام 3x)</option>
                <option value="purple">لون بنفسجي (عمالة VIP)</option>
                <option value="sky">لون أزرق (شركات B2B)</option>
              </select>
            </div>
            <input id="hb-title" type="text" required placeholder="عنوان الإعلان الرئيسي (مثال: خصم 20% على استلام الأسقف هذا الشهر)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-bold" />
            <textarea id="hb-sub" rows="2" required placeholder="تفاصيل العرض والضمان..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <div class="grid grid-cols-2 gap-2">
              <input id="hb-cta" type="text" value="اطلب الآن" placeholder="نص الزرار" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="hb-act" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                <option value="admin_chat">يفتح شات الإدارة مباشرة</option>
                <option value="inspection">يفتح قسم الاستلام 3x</option>
                <option value="viplabor">يفتح قسم عمالة VIP</option>
                <option value="market">يفتح السوق B2B</option>
                <option value="company">يفتح إدارة الشركات</option>
                <option value="whatsapp">يفتح واتساب الإدارة</option>
              </select>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">نشر الإعلان على الصفحة الرئيسية فوراً</button>
          </form>

          <div class="font-black text-slate-300">إعلاناتك المضافة على الرئيسية (${customBanners.length})</div>
          ${!customBanners.length
            ? `<div class="glass-card rounded-2xl p-4 text-center text-slate-400">حالياً تظهر الـ 6 إعلانات الرسمية المدمجة لضمان سايت على الرئيسية — أضف أي عروض إضافية من النموذج أعلاه لتظهر فوقها فوراً.</div>`
            : customBanners.map((b) => `
              <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-[10px] text-amber-400 font-black">${app.esc(b.badge)}</div>
                  <div class="font-black text-white truncate">${app.esc(b.title)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${app.esc(b.subtitle)}</div>
                </div>
                <button onclick="DamanAdmin.deleteCustomHomeBanner('${b.id}')" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-black text-[10px] shrink-0">حذف</button>
              </div>`).join('')}
        </div>`;
    },

    renderKycTab(app) {
      const pending = this.kycReqs.filter((k) => k.status === 'pending');
      const others = this.kycReqs.filter((k) => k.status !== 'pending');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-amber-400">طلبات التوثيق المعلّقة (${pending.length})</div>
          ${!pending.length ? `<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد طلبات توثيق معلّقة حالياً ✅</div>` : pending.map((k) => {
            const isComp = k.accountType === 'company' || k.accountType === 'supplier';
            return `
              <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-amber-500/50">
                <div class="flex justify-between"><b class="text-white">${app.esc(k.displayName || k.legalName)}</b><span class="text-sky-300">${app.esc(k.phone || '')}</span></div>
                <div class="flex flex-wrap gap-1.5">
                  <button onclick="DamanApp.openMediaLightbox('${k.idFrontMedia}','وش البطاقة')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 وش البطاقة</button>
                  <button onclick="DamanApp.openMediaLightbox('${k.idBackMedia}','ضهر البطاقة')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 ضهر البطاقة</button>
                  <button onclick="DamanApp.openMediaLightbox('${k.selfieMedia}','سيلفي')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-[10px]">🤳 سيلفي</button>
                  ${k.crMedia ? `<button onclick="DamanApp.openMediaLightbox('${k.crMedia}','السجل التجاري')" class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">📄 سجل</button>` : ''}
                  ${k.taxMedia ? `<button onclick="DamanApp.openMediaLightbox('${k.taxMedia}','البطاقة الضريبية')" class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">📄 ضريبية</button>` : ''}
                </div>
                <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <input id="kyc-ed-name-${k.id}" type="text" value="${app.esc(k.legalName || '')}" placeholder="الاسم الرباعي" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
                  <input id="kyc-ed-nid-${k.id}" type="text" maxlength="14" value="${app.esc(k.nationalId || '')}" placeholder="الرقم القومي" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-black" />
                  <input id="kyc-ed-addr-${k.id}" type="text" value="${app.esc(k.legalAddress || '')}" placeholder="العنوان" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                  ${isComp ? `<input id="kyc-ed-comp-${k.id}" type="text" value="${app.esc(k.companyName || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /><div class="grid grid-cols-2 gap-1.5"><input id="kyc-ed-cr-${k.id}" type="text" value="${app.esc(k.commercialReg || '')}" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /><input id="kyc-ed-tax-${k.id}" type="text" value="${app.esc(k.taxCard || '')}" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>` : ''}
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <button onclick="DamanAdmin.approveKyc('${k.id}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد</button>
                  <button onclick="DamanAdmin.rejectKyc('${k.id}')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
                </div>
              </div>`;
          }).join('')}
          ${others.slice(0, 8).map((k) => `<div class="glass-card rounded-xl p-2.5 flex justify-between text-[11px]"><span>${app.esc(k.legalName)} (${app.esc(k.nationalId)})</span><b class="${k.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}">${app.esc(k.status)}</b></div>`).join('')}
        </div>`;
    },

    renderWalletTab(app) {
      const pending = this.walletReqs.filter((r) => r.status === 'pending');
      const done = this.walletReqs.filter((r) => r.status !== 'pending');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-emerald-400">طلبات الشحن والسحب المعلّقة (${pending.length})</div>
          ${!pending.length ? `<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد طلبات معلّقة ✅</div>` : pending.map((r) => `
            <div class="glass-card rounded-2xl p-3.5 space-y-2 ${r.duplicateRefFlag ? 'border-2 border-rose-500' : 'border-amber-500/40'}">
              ${r.duplicateRefFlag ? `<div class="p-1 rounded bg-rose-600 text-white font-black text-center text-[10px]">⚠️ رقم مرجعي مكرر!</div>` : ''}
              <div class="flex justify-between"><b class="${r.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}">${r.type === 'deposit' ? '⬇️ شحن' : '⬆️ سحب'} — ${app.fmtMoney(r.amount)} ج.م</b><span class="text-slate-400">${app.esc(r.date || '')}</span></div>
              <div class="text-[11px] text-slate-200">${app.esc(r.userLegalName || r.userName)} (${app.esc(r.userPhone || '')}) • ${app.esc(r.channel)}</div>
              ${r.txRef ? `<div class="text-[10.5px] text-amber-300">المرجع: <b>${app.esc(r.txRef)}</b></div>` : ''}
              ${r.destAccount ? `<div class="text-[11px] text-emerald-300 font-black">إلى: ${app.esc(r.destAccount)} (صافي: ${app.fmtMoney(r.netPayout || r.amount)})</div>` : ''}
              ${r.receiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.receiptMedia}','إيصال التحويل')" class="px-3 py-1 rounded-lg bg-slate-800 text-amber-300 font-black text-[10px]">عرض الإيصال</button>` : ''}
              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','approve')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد</button>
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','reject')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
              </div>
            </div>`).join('')}
          ${done.slice(0, 10).map((r) => `<div class="glass-card rounded-xl p-2.5 flex justify-between text-[11px]"><span>${r.type === 'deposit' ? '⬇️' : '⬆️'} ${app.esc(r.userName)} — ${app.fmtMoney(r.amount)} ج.م</span><b class="${r.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}">${app.esc(r.status)}</b></div>`).join('')}
        </div>`;
    },

    renderContractsTab(app) {
      const pendingSigned = this.agreements.filter((a) => a.contractStatus === 'pending_admin');
      const openDisputes = this.disputes.filter((d) => d.status === 'open');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-amber-400">📄 عقود موقّعة بانتظار الاعتماد (${pendingSigned.length})</div>
          ${!pendingSigned.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد عقود معلّقة</div>` : pendingSigned.map((a) => `
            <div class="glass-card rounded-2xl p-3 space-y-2 border-amber-500/50">
              <div class="flex justify-between"><b class="text-white">${app.esc(a.ticketNumber)} • ${app.esc(a.title)}</b><b class="text-emerald-400">${app.fmtMoney(a.totalAmount)} ج.م</b></div>
              <button onclick="DamanApp.openMediaLightbox('${a.signedContractMedia}','العقد الموقّع')" class="w-full py-1.5 rounded-lg bg-slate-800 text-amber-300 font-black">👁️ فحص العقد الموقّع</button>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanAdmin.reviewSignedContract('${a.id}',true)" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد</button>
                <button onclick="DamanAdmin.reviewSignedContract('${a.id}',false)" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
              </div>
            </div>`).join('')}

          <div class="font-black text-rose-400 pt-2">⚖️ النزاعات المفتوحة (${openDisputes.length})</div>
          ${!openDisputes.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد نزاعات مفتوحة ✅</div>` : openDisputes.map((d) => `
            <div class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/60">
              <div class="flex justify-between"><b class="text-white">${app.esc(d.contractNumber)} — ${app.esc(d.projectTitle)}</b><b class="text-amber-300">${app.fmtMoney(d.contractAmount)} ج.م</b></div>
              <p class="text-[11px] text-rose-200">${app.esc(d.reason)}</p>
              <div class="grid grid-cols-3 gap-1.5">
                <button onclick="DamanAdmin.resolveDispute('${d.id}','client')" class="py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px]">للعميل 100%</button>
                <button onclick="DamanAdmin.resolveDispute('${d.id}','provider')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10px]">للمنفّذ 100%</button>
                <button onclick="DamanAdmin.resolveDispute('${d.id}','split')" class="py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]">تقسيم</button>
              </div>
            </div>`).join('')}
        </div>`;
    },

    renderMarketTab(app) {
      const pendingPosts = this.projects.filter((p) => p.status === 'pending_review');
      return `
        <div class="space-y-4 text-xs">
          <div class="space-y-2">
            <div class="font-black text-amber-400">📢 إعلانات المستخدمين بانتظار الموافقة (${pendingPosts.length})</div>
            ${!pendingPosts.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد إعلانات معلّقة</div>` : pendingPosts.map((p) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5 border-amber-500/40">
                <div class="font-black text-white">${app.esc(p.title)} (${app.esc(p.ownerName)})</div>
                <p class="text-[11px] text-slate-300">${app.esc(p.description)}</p>
                <div class="grid grid-cols-2 gap-2">
                  <button onclick="DamanAdmin.moderateProject('${p.id}','approved')" class="py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ نشر</button>
                  <button onclick="DamanAdmin.moderateProject('${p.id}','rejected')" class="py-1.5 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
                </div>
              </div>`).join('')}
          </div>

          <div class="space-y-2">
            <div class="font-black text-emerald-400">🛡️ طلبات الاستلام الهندسي 3x (${this.inspections.length})</div>
            ${this.inspections.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.element)} — ${app.esc(r.userName)}</b><span class="text-amber-300 font-bold">${app.esc(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.location)} • ${app.esc(r.userPhone || '')}</div>
                <div class="flex gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteInspection('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px]">تسعير الطلب</button>` : ''}
                  ${r.status === 'paid' ? `<button onclick="DamanAdmin.completeInspection('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">تأكيد إتمام الاستلام</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد طلبات</div>'}
          </div>

          <div class="space-y-2">
            <div class="font-black text-purple-300">👷 طلبات عمالة VIP (${this.vipLabors.length})</div>
            ${this.vipLabors.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.trade)} (${r.workersCount} × ${r.days} يوم)</b><span class="text-purple-300 font-bold">${app.esc(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.userName)} • ${app.esc(r.location)}</div>
                <div class="flex gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteVipLabor('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-purple-500 text-white font-black text-[10.5px]">تسعير (+ VIP)</button>` : ''}
                  ${r.status === 'funded' ? `<button onclick="DamanAdmin.settleVipLabor('${r.id}','settle')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">✅ تسوية</button><button onclick="DamanAdmin.settleVipLabor('${r.id}','refund')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10.5px]">ردّ الضمان</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد طلبات</div>'}
          </div>
        </div>`;
    },

    renderCompaniesTab(app) {
      return `
        <div class="space-y-2.5 text-xs">
          <div class="font-black text-sky-400">🏢 الشركات المسجّلة (${this.companies.length})</div>
          ${!this.companies.length ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد شركات مسجّلة بعد.</div>` : this.companies.map((c) => `
            <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
              <div><div class="font-black text-white">${app.esc(c.name)}</div><div class="text-[10px] text-amber-300">الكود: ${app.esc(c.code)} • ${app.esc(c.ownerName || '')}</div></div>
              <button onclick="DamanAdmin.openCompanyControlModal('${c.id}')" class="px-3 py-2 rounded-xl bg-purple-500 text-white font-black text-[10.5px]">تحكّم</button>
            </div>`).join('')}
        </div>`;
    },

    renderUsersTab(app) {
      const todayMD = app.todayLocal().slice(5, 10);
      const bdays = this.users.filter((u) => u.birthDate && String(u.birthDate).slice(5, 10) === todayMD);
      const q = app.normalizeAr(this.userSearch);
      const filtered = this.users.filter((u) => !q || app.normalizeAr(`${u.name} ${u.legalName} ${u.phone} ${u.nationalId} ${u.email}`).includes(q));
      const openReports = this.reports.filter((r) => r.status === 'open');

      return `
        <div class="space-y-3 text-xs">
          <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2">
            <div class="font-black text-amber-300">🎂 أعياد ميلاد اليوم (${bdays.length})</div>
            ${!bdays.length ? `<div class="text-[10.5px] text-slate-400">لا يوجد أعياد ميلاد اليوم.</div>` : bdays.map((u) => `<div class="flex items-center justify-between bg-slate-950/70 p-2 rounded-xl"><span><b class="text-white">${app.esc(u.legalName || u.name)}</b></span><button onclick="DamanAdmin.sendBirthdayGift('${u.id}','${app.esc(u.name || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">🎁 هدية</button></div>`).join('')}
          </div>

          ${openReports.length ? `<div class="space-y-1.5"><div class="font-black text-rose-400">🚨 بلاغات مفتوحة (${openReports.length})</div>${openReports.map((r) => `<div class="glass-card rounded-xl p-2.5 border-rose-500/40 space-y-1"><div class="font-bold text-white">${app.esc(r.targetTitle)} — ${app.esc(r.reason)}</div><button onclick="DamanAdmin.resolveReport('${r.id}','closed')" class="px-3 py-1 rounded-lg bg-slate-800 text-emerald-300 font-bold text-[10px]">إغلاق</button></div>`).join('')}</div>` : ''}

          <input type="text" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالاسم / القومي / الموبايل..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          ${filtered.map((u) => `
            <div class="glass-card rounded-2xl p-3 space-y-1">
              <div class="flex justify-between"><b class="text-white">${app.esc(u.name)} ${u.kycStatus === 'verified' ? '✅' : ''}</b><span class="text-emerald-400 font-bold">متاح: ${app.fmtMoney(u.balanceAvailable || 0)} | ضمان: ${app.fmtMoney(u.balanceEscrow || 0)}</span></div>
              <div class="text-[10px] text-slate-400">${app.esc(u.phone || '')} • ${app.esc(u.email || '')} • قومي: ${app.esc(u.nationalId || '—')}</div>
              <div class="flex gap-1.5 pt-1">
                <button onclick="DamanApp.openPublicProfile('${u.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">صفحته</button>
                <button onclick="DamanAdmin.toggleBanUser('${u.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">${u.status === 'banned' ? 'فك الحظر' : 'حظر'}</button>
                <button onclick="DamanAdmin.deleteUserSafely('${u.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
              </div>
            </div>`).join('')}

          <form onsubmit="DamanAdmin.addBlacklistEntry(event)" class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/40">
            <div class="font-black text-rose-400">🚫 القائمة السوداء</div>
            <div class="grid grid-cols-2 gap-2"><input id="bl-val" type="text" required placeholder="رقم قومي / موبايل / إيميل" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /><input id="bl-reason" type="text" placeholder="السبب" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            <button type="submit" class="w-full py-1.5 rounded-lg bg-rose-500 text-white font-black">إضافة للحظر</button>
          </form>

          <form onsubmit="DamanAdmin.createPromoCode(event)" class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🎁 إنشاء كود هدية</div>
            <div class="grid grid-cols-3 gap-1.5"><input id="pr-code" type="text" required placeholder="DAMAN50" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white uppercase font-bold" /><input id="pr-amt" type="number" min="5" required placeholder="المبلغ" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /><input id="pr-max" type="number" min="1" value="20" required class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            <button type="submit" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black">إنشاء الكود</button>
          </form>
        </div>`;
    },

    renderCommsTab(app) {
      return `
        <div class="space-y-4 text-xs">
          <div class="space-y-2">
            <div class="flex justify-between items-center"><span class="font-black text-amber-400">🎙️ تسجيلات المكالمات (${this.callRecordings.length})</span><button onclick="DamanAdmin.cleanupExpiredRecordings()" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">تنظيف المنتهي</button></div>
            ${this.callRecordings.map((r) => `<div class="glass-card rounded-xl p-2.5 space-y-1.5"><div class="flex justify-between"><b class="text-white">${app.esc(r.callerName)} ⇄ ${app.esc(r.otherName)} (${r.durationSec || 0}ث)</b><span class="text-slate-400">${app.esc(r.date || '')}</span></div><div class="flex gap-1.5"><button onclick="DamanAdmin.playCallRecording('${r.id}','${r.audioMedia || ''}')" class="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">▶ تشغيل</button><button onclick="DamanAdmin.togglePinRecording('${r.id}',${!!r.pinned})" class="px-3 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">${r.pinned ? '📌 مثبّت' : 'تثبيت'}</button></div><div id="rec-player-${r.id}"></div></div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد تسجيلات</div>'}
          </div>
          <div class="space-y-2">
            <div class="font-black text-sky-400">💬 المحادثات (${this.chats.length})</div>
            ${this.chats.map((c) => `<div class="glass-card rounded-xl p-2.5 flex justify-between gap-2"><div class="min-w-0"><div class="font-bold text-white truncate">${app.esc(Object.values(c.participantNames || {}).join(' ⇄ '))}</div><div class="text-[10px] text-slate-400 truncate">${app.esc(c.lastMessage || '')}</div></div><div class="flex gap-1 shrink-0"><button onclick="DamanApp.switchTab('chat'); if(window.DamanChat) DamanChat.openChatRoom('${c.id}',{id:'${c.id}',otherName:'مراقبة',frozen:${!!c.frozen}})" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">دخول</button><button onclick="DamanAdmin.toggleFreezeChat('${c.id}',${!!c.frozen})" class="px-2 py-1 rounded-lg bg-slate-800 text-rose-300 text-[10px]">${c.frozen ? 'فك' : 'تجميد'}</button></div></div>`).join('')}
          </div>
          <div class="space-y-2">
            <div class="font-black text-purple-300">🎫 التذاكر المفتوحة</div>
            ${this.tickets.filter((t) => t.status === 'open').map((t) => `<div class="glass-card rounded-xl p-3 space-y-1"><div class="font-black text-white">${app.esc(t.subject)} — ${app.esc(t.userName)}</div><div class="text-[11px] text-slate-300">${app.esc(t.message)}</div><button onclick="DamanAdmin.replyTicket('${t.id}','${t.userId}')" class="px-3 py-1 rounded-lg bg-purple-500 text-white font-black text-[10px]">رد وإغلاق</button></div>`).join('') || '<div class="text-slate-400 text-center">لا توجد تذاكر مفتوحة ✅</div>'}
          </div>
        </div>`;
    },

    renderSettingsTab(app) {
      const cfg = app.appConfig || {};
      const acc = cfg.paymentAccounts || {};
      const pkgs = cfg.packages || {};
      if (!app.isAdmin()) return `<div class="glass-card rounded-2xl p-6 text-center text-rose-300 text-xs">للأدمن الرئيسي فقط.</div>`;
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanAdmin.saveSettings(event)" class="glass-card rounded-2xl p-4 space-y-3 border-amber-500/40">
            <div class="font-black text-amber-400">💳 حسابات الإيداع النشطة (مهلة 10 دقائق)</div>
            <div><label class="block text-[10px] text-slate-400 mb-1">فودافون كاش</label><input id="st-vf" type="text" value="${app.esc(acc.vodafoneCash || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">إنستا باي</label><input id="st-ip" type="text" value="${app.esc(acc.instaPay || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">الحساب البنكي</label><textarea id="st-bank" rows="2" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc(acc.bankInfo || '')}</textarea></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">عمولة الضمان %</label><input id="st-comm" type="number" step="0.1" value="${(Number(cfg.commissionRate || 0.035) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">عمولة VIP %</label><input id="st-vipcomm" type="number" step="0.5" value="${(Number(cfg.vipCommissionRate || 0.10) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">حد أدنى إيداع</label><input id="st-mindep" type="number" value="${Number(cfg.minDeposit || 100)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">حد أدنى سحب</label><input id="st-minwd" type="number" value="${Number(cfg.minWithdraw || 100)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">رسوم سحب %</label><input id="st-wfpct" type="number" step="0.1" value="${Number(cfg.withdrawFeePct || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">رسوم سحب ثابتة</label><input id="st-wfflat" type="number" step="any" value="${Number(cfg.withdrawFeeFlat || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div><label class="block text-[9.5px] text-slate-400 mb-1">باقة أفراد</label><input id="st-pkg-ind" type="number" value="${Number(pkgs.individualMonthly || 150)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[9.5px] text-slate-400 mb-1">باقة شركات</label><input id="st-pkg-comp" type="number" value="${Number(pkgs.companyMonthly || 450)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[9.5px] text-slate-400 mb-1">تمييز إعلان</label><input id="st-pkg-boost" type="number" value="${Number(pkgs.boostAdPrice || 75)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div><label class="block text-[10px] text-slate-400 mb-1">واتساب الدعم</label><input id="st-wa" type="text" value="${app.esc(cfg.supportWhatsapp || '201030374787')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">إيميلات المشرفين المساعدين</label><input id="st-mods" type="text" value="${app.esc((cfg.moderators || []).join(', '))}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">سيرفر TURN للمكالمات (اختياري)</label><input id="st-turn" type="text" value="${app.esc(cfg.turnServer || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40">
              <label class="flex items-center gap-2 font-bold text-rose-300"><input id="st-maint" type="checkbox" ${cfg.maintenanceMode ? 'checked' : ''} class="accent-rose-500" /> وضع الصيانة</label>
              <label class="flex items-center gap-2 font-bold text-amber-300"><input id="st-nocalls" type="checkbox" ${cfg.disableCalls ? 'checked' : ''} class="accent-amber-500" /> إيقاف المكالمات</label>
            </div>
            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">حفظ وتطبيق الإعدادات</button>
          </form>
          <button onclick="DamanAdmin.exportFullBackup()" class="w-full py-3 rounded-2xl bg-emerald-600 text-white font-black"><i class="fa-solid fa-database me-1.5"></i> تنزيل نسخة احتياطية (JSON)</button>
        </div>`;
    },

    render(container, app) {
      if (!app.hasAdminAccess()) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-400 font-bold text-xs">صلاحية الإدارة مطلوبة.</div>`;
        return;
      }

      const tabs = [
        ['treasury', '💰 الخزنة والجرد'],
        ['ads', '📢 إعلانات الرئيسية'],
        ['kyc', '🪪 التوثيق'],
        ['wallet', '💳 الشحن/السحب'],
        ['contracts', '📄 العقود والنزاع'],
        ['market', '🏗️ السوق و3x وVIP'],
        ['companies', '🏢 الشركات'],
        ['users', '👥 المستخدمين 🎂'],
        ['comms', '🎙️ الشات والمكالمات'],
        ['settings', '⚙️ الإعدادات']
      ];

      let body = '';
      try {
        if (this.loading) {
          body = `<div class="glass-card rounded-2xl p-8 text-center text-xs text-amber-400 font-bold animate-pulse">جارٍ تحميل بيانات لوحة السيطرة...</div>`;
        } else if (this.subTab === 'ads') body = this.renderAdsTab(app);
        else if (this.subTab === 'kyc') body = this.renderKycTab(app);
        else if (this.subTab === 'wallet') body = this.renderWalletTab(app);
        else if (this.subTab === 'contracts') body = this.renderContractsTab(app);
        else if (this.subTab === 'market') body = this.renderMarketTab(app);
        else if (this.subTab === 'companies') body = this.renderCompaniesTab(app);
        else if (this.subTab === 'users') body = this.renderUsersTab(app);
        else if (this.subTab === 'comms') body = this.renderCommsTab(app);
        else if (this.subTab === 'settings') body = this.renderSettingsTab(app);
        else body = this.renderTreasuryTab(app);
      } catch (e) {
        body = `<div class="p-4 rounded-2xl bg-rose-500/20 border border-rose-500 text-xs text-rose-200">خطأ عرض: ${app.esc(e.message)}</div>`;
      }

      const errBox = this.lastErrors.length ? `
        <div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/50 text-[10.5px] text-rose-200 space-y-0.5">
          <div class="font-black">⚠️ تنبيه صلاحيات قاعدة البيانات (تأكد من نشر Firestore Rules):</div>
          ${this.lastErrors.map((er) => `<div>• ${app.esc(er)}</div>`).join('')}
        </div>` : '';

      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-black text-purple-300"><i class="fa-solid fa-crown me-1 text-amber-400"></i> لوحة سيطرة إدارة ضمان سايت</h2>
            <button onclick="DamanAdmin.loadTabData(DamanAdmin.subTab)" class="px-3 py-1 rounded-xl bg-slate-800 text-amber-300 text-[10px] font-black"><i class="fa-solid fa-rotate me-1"></i>تحديث</button>
          </div>
          <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
            ${tabs.map(([k, lbl]) => `
              <button onclick="DamanAdmin.setSubTab('${k}')" class="shrink-0 px-3 py-2 rounded-xl ${this.subTab === k ? 'bg-purple-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
          </div>
          ${errBox}
          ${body}
        </div>`;

      // Trigger first data load AFTER painting shell so Admin NEVER renders blank
      if (!this.initialized && !this.loading) {
        setTimeout(() => this.loadTabData(this.subTab), 10);
      }
    }
  };

  window.DamanAdmin = AdminMod;
  if (window.DamanApp) window.DamanApp.registerModule('admin', AdminMod);
})();
