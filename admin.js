(function () {
  const AdminMod = {
    subTab: 'treasury', // 'treasury' | 'kyc' | 'wallet' | 'contracts' | 'market' | 'companies' | 'users' | 'comms' | 'settings'
    loading: false,
    userSearch: '',
    pageLimits: { kyc: 15, wallet: 15, users: 25, comms: 15 },

    // Data Stores (Loaded on-demand & paginated for top speed)
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

    async loadTabData(tab) {
      const app = window.DamanApp;
      if (!app || !app.hasAdminAccess()) return;
      this.loading = true;
      this.rerender();

      const db = app.db;
      const sortDesc = (arr) => arr.sort((a, b) => (b.createdAt?.seconds || b.submittedAt?.seconds || b.updatedAt?.seconds || 0) - (a.createdAt?.seconds || a.submittedAt?.seconds || a.updatedAt?.seconds || 0));

      try {
        if (tab === 'treasury') {
          const [uSnap, fSnap, eSnap, wSnap] = await Promise.all([
            db.collection('users').limit(300).get(),
            db.collection('platformFees').limit(300).get(),
            db.collection('adminExpenses').limit(150).get(),
            db.collection('walletRequests').where('status', '==', 'approved').limit(400).get()
          ]);
          this.users = uSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.platformFees = sortDesc(fSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.adminExpenses = sortDesc(eSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.walletReqs = sortDesc(wSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
        } else if (tab === 'kyc') {
          const snap = await db.collection('kycRequests').limit(this.pageLimits.kyc || 15).get();
          this.kycReqs = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
        } else if (tab === 'wallet') {
          const snap = await db.collection('walletRequests').limit(this.pageLimits.wallet || 15).get();
          this.walletReqs = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
        } else if (tab === 'contracts') {
          const [aSnap, dSnap] = await Promise.all([
            db.collection('chatAgreements').limit(80).get(),
            db.collection('disputes').limit(60).get()
          ]);
          this.agreements = sortDesc(aSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.disputes = sortDesc(dSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
        } else if (tab === 'market') {
          const [pSnap, iSnap, vSnap] = await Promise.all([
            db.collection('projects').limit(100).get(),
            db.collection('vipRequests').limit(60).get(),
            db.collection('vipLaborRequests').limit(60).get()
          ]);
          this.projects = sortDesc(pSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.inspections = sortDesc(iSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.vipLabors = sortDesc(vSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
        } else if (tab === 'companies') {
          const snap = await db.collection('companies').limit(80).get();
          this.companies = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
        } else if (tab === 'users') {
          const [uSnap, rSnap, bSnap, pSnap] = await Promise.all([
            db.collection('users').limit(this.pageLimits.users || 25).get(),
            db.collection('reports').limit(40).get(),
            db.collection('blacklist').limit(100).get(),
            db.collection('promoCodes').limit(50).get()
          ]);
          this.users = sortDesc(uSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.reports = sortDesc(rSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.blacklist = sortDesc(bSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.promoCodes = pSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        } else if (tab === 'comms') {
          const [cSnap, rSnap, tSnap] = await Promise.all([
            db.collection('chats').limit(this.pageLimits.comms || 15).get(),
            db.collection('callRecordings').limit(this.pageLimits.comms || 15).get(),
            db.collection('supportTickets').limit(40).get()
          ]);
          this.chats = sortDesc(cSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.callRecordings = sortDesc(rSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          this.tickets = sortDesc(tSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
        }
      } catch (e) {
        app.toast('خطأ في تحميل بيانات الإدارة: ' + e.message, 'error');
      } finally {
        this.loading = false;
        this.initialized = true;
        this.rerender();
      }
    },

    // ==================== 1. TREASURY, NET PROFITS & CHANNEL RECONCILIATION ====================
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

    // ==================== 2. KYC VERIFICATION (EDIT & LOCK LEGAL ID DATA) ====================
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
        if (legalName.split(/\s+/).length < 3) return app.toast('تأكد من كتابة الاسم الرباعي بالكامل مطابقاً للبطاقة', 'warning');

        try {
          // Ensure National ID is not already verified for someone else
          const dupSnap = await app.db.collection('users').where('nationalId', '==', parsed.nid).limit(2).get();
          const conflict = dupSnap.docs.find((d) => d.id !== uid);
          if (conflict) return app.toast('⚠️ هذا الرقم القومي موثّق بالفعل لحساب آخر!', 'error');

          const patch = {
            kycStatus: 'verified',
            kycRejectionReason: '',
            legalName,
            nationalId: parsed.nid,
            birthDate: parsed.birthDate,
            legalAddress,
            kycVerifiedAt: Date.now()
          };
          if (compName) patch.companyName = compName;
          if (cr) patch.commercialReg = cr;
          if (tax) patch.taxCard = tax;

          await app.db.collection('users').doc(uid).update(patch);
          await app.db.collection('kycRequests').doc(uid).update({
            status: 'approved',
            legalName,
            nationalId: parsed.nid,
            birthDate: parsed.birthDate,
            legalAddress,
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: app.user.email
          });

          await app.sendNotification(uid, '✅ تم توثيق حسابك وتثبيت بياناتك القانونية!', 'يمكنك الآن استخدام المحفظة، النشر في السوق، وإنشاء العقود المضمونة في ضمان سايت.');
          app.toast('تم اعتماد التوثيق وقفل البيانات القانونية بنجاح ✅', 'success');
          this.loadTabData('kyc');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async rejectKyc(uid) {
      const app = window.DamanApp;
      const reason = window.prompt('سبب رفض التوثيق (سيظهر للمستخدم):', 'صور البطاقة أو السيلفي غير واضحة — يرجى إعادة التصوير بإضاءة جيدة');
      if (!reason) return;
      try {
        await app.db.collection('users').doc(uid).update({ kycStatus: 'rejected', kycRejectionReason: reason.trim() });
        await app.db.collection('kycRequests').doc(uid).update({ status: 'rejected', rejectionReason: reason.trim() });
        await app.sendNotification(uid, '❌ تم رفض مستندات التوثيق', reason.trim());
        app.toast('تم رفض الطلب وإبلاغ المستخدم', 'info');
        this.loadTabData('kyc');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== 3. WALLET DEPOSIT & WITHDRAW (STRICT TRANSACTION LOCK) ====================
    async handleWalletReq(reqId, action) {
      const app = window.DamanApp;
      const req = this.walletReqs.find((r) => r.id === reqId);
      if (!req) return;

      let adminNote = '';
      if (action === 'reject') {
        adminNote = window.prompt('سبب الرفض:', 'بيانات التحويل غير مطابقة أو لم يصل المبلغ');
        if (adminNote === null) return;
      } else {
        const confirmTxt = req.type === 'deposit'
          ? `تأكيد اعتماد إيداع ${app.fmtMoney(req.amount)} ج.م لحساب ${req.userName}؟\n(المرجع: ${req.txRef || '—'})`
          : `تأكيد أنك قمت بتحويل صافي السحب (${app.fmtMoney(req.netPayout || req.amount)} ج.م) إلى ${req.destAccount}؟`;
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
            // TRANSACTION LOCK: Prevents double-crediting even on double clicks or slow internet!
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
              tx.update(reqRef, { status: action === 'approve' ? 'approved' : 'rejected', adminNote, processedBy: app.user.email, processedAt: firebase.firestore.FieldValue.serverTimestamp() });
            } else {
              // WITHDRAWAL
              if (action === 'approve') {
                if (curHold < amt - 0.01) throw new Error('خطأ مالي: الرصيد المحجوز للسحب لا يكفي! راجع حساب المستخدم.');
                tx.update(userRef, { balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100) });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'withdraw_paid', amount: 0,
                  note: `تم تحويل السحب بنجاح (${app.fmtMoney(r.netPayout || amt)} ج.م على ${r.destAccount})`, date: app.todayLocal(),
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
                // Reject withdrawal -> Return held balance back to available
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
              tx.update(reqRef, { status: action === 'approve' ? 'approved' : 'rejected', adminNote, processedBy: app.user.email, processedAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
          });

          await app.sendNotification(
            req.userId,
            action === 'approve' ? (req.type === 'deposit' ? '✅ تم شحن محفظتك بنجاح' : '✅ تم تحويل السحب بنجاح') : '❌ تم رفض طلب المحفظة',
            action === 'approve' ? `المبلغ: ${app.fmtMoney(req.amount)} ج.م` : (adminNote || 'راجع الإدارة')
          );
          app.toast('تم تنفيذ العملية بنجاح ✅', 'success');
          this.loadTabData('wallet');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 4. SIGNED CONTRACTS APPROVAL & DISPUTE RESOLUTION (EXACT ESCROW DEDUCTION) ====================
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
        await app.sendNotification(ag.payerUid, approve ? `✅ تم اعتماد العقد الموقّع (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'أزرار الصرف واليوميات والتمديد مفعّلة الآن.' : 'يرجى رفع صورة واضحة وموقّعة من الطرفين.');
        await app.sendNotification(ag.providerUid, approve ? `✅ تم اعتماد العقد الموقّع (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'يمكنكم بدء التشغيل وطلب اليوميات والسُلف الآن.' : 'يرجى إعادة رفع صورة العقد.');
        app.toast(approve ? 'تم اعتماد العقد الموقّع بنجاح ✅' : 'تم رفض صورة العقد', 'success');
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
        const inp = parseFloat(window.prompt(`المتبقي بالضمان: ${app.fmtMoney(rem)} ج.م.\nأدخل المبلغ المحكوم به للمنفّذ (والباقي + فرق العمولة يرجع لصاحب العمل):`, String(Math.round(rem / 2))));
        if (isNaN(inp) || inp < 0 || inp > rem) return app.toast('مبلغ غير صالح', 'error');
        customWorkerShare = Math.round(inp * 100) / 100;
      }

      const note = window.prompt('حيثيات قرار التحكيم الإداري:', 'تم الفصل بناءً على الصور والمحادثات وتسجيلات المكالمات');
      if (note === null) return;

      await app.withLock('resDisp_' + disputeId, async () => {
        try {
          await app.db.runTransaction(async (tx) => {
            const [dDoc, aDoc] = await Promise.all([tx.get(dispRef), tx.get(agRef)]);
            if (dDoc.data().status !== 'open') throw new Error('تم الفصل في هذا النزاع بالفعل');
            const a = aDoc.data();
            const payerRef = app.db.collection('users').doc(a.payerUid);
            const provRef = app.db.collection('users').doc(a.providerUid);
            const [pDoc, wDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef)]);

            const rem = Number(a.remainingEscrow || 0);
            const lockedFee = Number(a.lockedFee || 0);
            const totalEscrowHeld = Math.round((rem + lockedFee) * 100) / 100;

            let workerShare = 0;
            if (decision === 'provider') workerShare = rem;
            else if (decision === 'client') workerShare = 0;
            else workerShare = Math.min(rem, customWorkerShare);

            const clientPrincipalBack = Math.max(0, Math.round((rem - workerShare) * 100) / 100);
            const executedTotal = Math.round((Number(a.paidSoFar || 0) + workerShare) * 100) / 100;
            const earnedFee = Math.min(lockedFee, Math.round(executedTotal * app.getCommissionRate() * 100) / 100);
            const unusedFeeBack = Math.max(0, Math.round((lockedFee - earnedFee) * 100) / 100);
            const totalClientBack = Math.round((clientPrincipalBack + unusedFeeBack) * 100) / 100;

            // EXACT ESCROW DEDUCTION FROM PAYER!
            tx.update(payerRef, {
              balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - totalEscrowHeld) * 100) / 100),
              balanceAvailable: Math.round((Number((pDoc.data() || {}).balanceAvailable || 0) + totalClientBack) * 100) / 100
            });
            if (workerShare > 0) {
              tx.update(provRef, {
                balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + workerShare) * 100) / 100
              });
            }
            if (earnedFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                agreementId: d.agreementId, type: 'dispute_fee', ticketNumber: a.ticketNumber, amount: earnedFee,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(agRef, {
              status: workerShare > 0 ? 'completed' : 'cancelled',
              remainingEscrow: 0,
              lockedFee: 0,
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + workerShare) * 100) / 100
            });
            tx.update(dispRef, {
              status: 'resolved', decision, workerShare, clientRefund: totalClientBack, adminNote: note,
              resolvedBy: app.user.email, resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (totalClientBack > 0) {
              tx.set(app.db.collection('transactions').doc(), {
                userId: a.payerUid, type: 'dispute_refund', amount: totalClientBack,
                note: `قرار تحكيم العقد ${a.ticketNumber}: ${note}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            if (workerShare > 0) {
              tx.set(app.db.collection('transactions').doc(), {
                userId: a.providerUid, type: 'dispute_payout', amount: workerShare,
                note: `قرار تحكيم العقد ${a.ticketNumber}: ${note}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          await app.sendNotification(d.clientId, `⚖️ صدر قرار التحكيم في العقد ${d.contractNumber}`, note);
          await app.sendNotification(d.providerId, `⚖️ صدر قرار التحكيم في العقد ${d.contractNumber}`, note);
          app.toast('تم الفصل في النزاع وتصفية الضمان بدقة ✅', 'success');
          this.loadTabData('contracts');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 5. MARKET, 3x INSPECTION & VIP LABOR (10%) ====================
    async moderateProject(pid, status) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      try {
        await app.db.collection('projects').doc(pid).update({ status });
        if (p) await app.sendNotification(p.ownerId, status === 'approved' ? '✅ تم نشر إعلانك في السوق' : '❌ تم رفض إعلانك', p.title);
        app.toast('تم التحديث ✅', 'success');
        this.loadTabData('market');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async quoteInspection(reqId) {
      const app = window.DamanApp;
      const r = this.inspections.find((x) => x.id === reqId);
      if (!r) return;
      const price = parseFloat(window.prompt(`تسعير طلب الاستلام الهندسي 3x (${r.element} — ${r.location}):`, r.quotedPrice || '1500'));
      if (!price || price <= 0) return;
      const note = window.prompt('ملاحظة / موعد المهندس:', 'تم التسعير — اضغط موافقة ودفع من المحفظة لتأكيد الزيارة') || '';
      try {
        await app.db.collection('vipRequests').doc(reqId).update({ quotedPrice: price, adminNote: note, status: 'quoted' });
        await app.sendNotification(r.userId, `تم تسعير طلب الاستلام 3x (${app.fmtMoney(price)} ج.م)`, note);
        app.toast('تم إرسال التسعيرة للعميل ✅', 'success');
        this.loadTabData('market');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async completeInspection(reqId) {
      try {
        await window.DamanApp.db.collection('vipRequests').doc(reqId).update({ status: 'completed' });
        window.DamanApp.toast('تم إغلاق طلب الاستلام 3x كمكتمل ✅', 'success');
        this.loadTabData('market');
      } catch (e) {}
    },

    async quoteVipLabor(reqId) {
      const app = window.DamanApp;
      const r = this.vipLabors.find((x) => x.id === reqId);
      if (!r) return;
      const baseCost = parseFloat(window.prompt(`أدخل التكلفة الصافية للعمالة (${r.workersCount} ${r.trade} × ${r.days} أيام):`, r.baseCost || '5000'));
      if (!baseCost || baseCost <= 0) return;
      const rate = app.getVipCommissionRate();
      const vipFee = Math.round(baseCost * rate * 100) / 100;
      const totalQuoted = Math.round((baseCost + vipFee) * 100) / 100;
      const note = window.prompt('ملاحظات الإدارة:', `تم التجهيز — التكلفة ${app.fmtMoney(baseCost)} + عمولة VIP (${(rate * 100).toFixed(0)}%) ${app.fmtMoney(vipFee)}`) || '';
      try {
        await app.db.collection('vipLaborRequests').doc(reqId).update({ baseCost, vipFee, totalQuoted, adminNote: note, status: 'quoted' });
        await app.sendNotification(r.userId, `تم تسعير طلب عمالة VIP (${app.fmtMoney(totalQuoted)} ج.م)`, note);
        app.toast('تم إرسال تسعيرة عمالة VIP بنجاح ✅', 'success');
        this.loadTabData('market');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async settleVipLabor(reqId, mode) {
      const app = window.DamanApp;
      const r = this.vipLabors.find((x) => x.id === reqId);
      if (!r || r.status !== 'funded') return;
      const amt = Number(r.lockedBaseCost || r.baseCost || 0);
      const msg = mode === 'settle'
        ? `تأكيد إتمام شغل عمالة VIP وتسوية الضمان المحجوز (${app.fmtMoney(amt)} ج.م) لصرف مستحقات الفرقة؟`
        : `إلغاء الطلب وردّ الضمان المحجوز (${app.fmtMoney(amt)} ج.م) لمحفظة العميل؟`;
      if (!window.confirm(msg)) return;

      await app.withLock('setVip_' + reqId, async () => {
        const uRef = app.db.collection('users').doc(r.userId);
        const rRef = app.db.collection('vipLaborRequests').doc(reqId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [uDoc, reqDoc] = await Promise.all([tx.get(uRef), tx.get(rRef)]);
            if (reqDoc.data().status !== 'funded') throw new Error('تمت تسوية الطلب مسبقاً');
            const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            const uPatch = { balanceEscrow: Math.max(0, Math.round((curEsc - amt) * 100) / 100) };
            if (mode === 'refund') uPatch.balanceAvailable = Math.round((curAvail + amt) * 100) / 100;
            tx.update(uRef, uPatch);
            tx.update(rRef, { status: mode === 'settle' ? 'settled' : 'refunded', settledAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: r.userId, type: mode === 'settle' ? 'vip_labor_settled' : 'vip_labor_refund',
              amount: mode === 'refund' ? amt : 0,
              note: mode === 'settle' ? `إتمام وتسوية طلب عمالة VIP (${r.trade})` : `رد ضمان طلب عمالة VIP ملغى (${r.trade})`,
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(r.userId, mode === 'settle' ? '✅ تم إتمام وتسوية طلب عمالة VIP' : '↩️ تم رد ضمان طلب عمالة VIP لمحفظتك', r.trade);
          app.toast('تمت التسوية بنجاح ✅', 'success');
          this.loadTabData('market');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 6. FULL ADMIN CONTROL OVER COMPANIES ====================
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
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-5 text-center text-xs text-slate-300">جارٍ تحميل بيانات الشركة...</div>`;

      try {
        const [memSnap, cusSnap] = await Promise.all([
          app.db.collection('companyMembers').where('companyId', '==', compId).limit(100).get(),
          app.db.collection('companyCustody').where('companyId', '==', compId).limit(40).get()
        ]);
        const mems = memSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        const custs = cusSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-black text-purple-300">👑 السيطرة على شركة: ${app.esc(comp.name)}</h3>
              <button onclick="document.getElementById('daman-admin-comp-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-0.5">
              <div>كود الشركة: <b class="text-amber-300">${app.esc(comp.code)}</b> | المالك: <b>${app.esc(comp.ownerName || '—')}</b></div>
              <div>السجل التجاري: <b>${app.esc(comp.commercialReg || '—')}</b> | الضريبية: <b>${app.esc(comp.taxCard || '—')}</b></div>
            </div>

            <!-- Admin Direct Message into Company Group -->
            <form onsubmit="DamanAdmin.sendAdminCompanyMsg(event,'${compId}')" class="flex gap-1.5">
              <input id="adm-comp-msg" type="text" required placeholder="إرسال رسالة/تنبيه رسمي لجروب الشركة..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white" />
              <button type="submit" class="px-3 py-2 rounded-xl bg-purple-500 text-white font-black">إرسال</button>
            </form>

            <!-- Members Control -->
            <div class="font-black text-amber-400">أعضاء وفريق الشركة (${mems.length})</div>
            <div class="space-y-1.5">
              ${mems.map((mem) => `
                <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div class="flex justify-between">
                    <b class="text-white">${app.esc(mem.name)} (${app.esc(mem.jobTitle || '')})</b>
                    <span class="text-emerald-400 font-bold">أساسي: ${app.fmtMoney(mem.baseSalary || 0)}</span>
                  </div>
                  <div class="flex gap-1.5">
                    <button onclick="DamanAdmin.adminEditCompMemberSalary('${mem.id}','${compId}',${Number(mem.baseSalary || 0)})" class="flex-1 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">تعديل الراتب</button>
                    <button onclick="DamanAdmin.adminToggleCompMember('${mem.id}','${compId}','${mem.status || 'active'}')" class="px-3 py-1 rounded-lg ${mem.status === 'suspended' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} font-bold text-[10px]">${mem.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button>
                  </div>
                </div>`).join('')}
            </div>

            <div class="font-black text-sky-400">آخر حركات العهدة (${custs.length})</div>
            <div class="space-y-1">
              ${custs.slice(0, 8).map((c) => `
                <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-[10.5px]">
                  <span>${app.esc(c.holderName)}: ${app.esc(c.note)}</span>
                  <b class="${c.kind === 'issue' ? 'text-emerald-400' : 'text-amber-300'}">${app.fmtMoney(c.amount)} ج.م</b>
                </div>`).join('') || '<div class="text-slate-500">لا توجد حركات عهدة</div>'}
            </div>
          </div>`;
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async sendAdminCompanyMsg(e, compId) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('adm-comp-msg');
      const text = inp?.value.trim();
      if (!text) return;
      try {
        await app.db.collection('companyMessages').add({
          companyId: compId, senderId: app.user.uid, senderName: '👑 إدارة ضمان سايت',
          isPlatformAdmin: true, text, date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        inp.value = '';
        app.toast('تم إرسال الرسالة لجروب الشركة ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async adminEditCompMemberSalary(memId, compId, curSal) {
      const nv = parseFloat(window.prompt('الراتب الأساسي الجديد للموظف (ج.م):', curSal));
      if (isNaN(nv) || nv < 0) return;
      await window.DamanApp.db.collection('companyMembers').doc(memId).update({ baseSalary: nv });
      window.DamanApp.toast('تم تعديل الراتب ✅', 'success');
      this.openCompanyControlModal(compId);
    },

    async adminToggleCompMember(memId, compId, curSt) {
      const next = curSt === 'suspended' ? 'active' : 'suspended';
      await window.DamanApp.db.collection('companyMembers').doc(memId).update({ status: next });
      window.DamanApp.toast('تم تحديث حالة الموظف', 'info');
      this.openCompanyControlModal(compId);
    },

    // ==================== 7. USERS, BIRTHDAYS GIFT 🎂, BLACKLIST, PROMOS, REPORTS ====================
    async sendBirthdayGift(uid, userName) {
      const app = window.DamanApp;
      const amt = parseFloat(window.prompt(`🎂 إرسال هدية عيد ميلاد فورية إلى ${userName} (أدخل المبلغ بالجنيه — 0 للتهنئة فقط):`, '50'));
      if (isNaN(amt) || amt < 0) return;
      try {
        if (amt > 0) {
          const uRef = app.db.collection('users').doc(uid);
          await app.db.runTransaction(async (tx) => {
            const uDoc = await tx.get(uRef);
            const cur = Number((uDoc.data() || {}).balanceAvailable || 0);
            tx.update(uRef, { balanceAvailable: Math.round((cur + amt) * 100) / 100 });
            tx.set(app.db.collection('transactions').doc(), {
              userId: uid, type: 'birthday_gift', amount: amt,
              note: '🎂 هدية عيد ميلاد من إدارة ضمان سايت', date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
        }
        await app.sendNotification(uid, `🎂 كل سنة وأنت طيب يا ${userName}!`, amt > 0 ? `أهدتك إدارة ضمان سايت مبلغ ${app.fmtMoney(amt)} ج.م في محفظتك بمناسبة عيد ميلادك 🎉` : 'تتمنى لك إدارة ضمان سايت عاماً سعيداً ومليئاً بالتوفيق 🎉');
        app.toast('تم إرسال تهنئة/هدية عيد الميلاد بنجاح 🎂', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async toggleBanUser(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      const ban = u.status !== 'banned';
      const reason = ban ? (window.prompt('سبب إيقاف الحساب:', 'مخالفة شروط ضمان سايت') || 'مخالفة') : '';
      try {
        await app.db.collection('users').doc(uid).update({ status: ban ? 'banned' : 'active', banReason: reason });
        app.toast(ban ? 'تم حظر المستخدم' : 'تم فك الحظر ✅', 'info');
        this.loadTabData('users');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async deleteUserSafely(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      if (Number(u.balanceAvailable || 0) > 0 || Number(u.balanceEscrow || 0) > 0 || Number(u.balancePendingWithdraw || 0) > 0) {
        return app.toast('❌ ممنوع حذف مستخدم لديه رصيد متاح أو ضمان أو سحب معلّق! صفّي حسابه أولاً.', 'error');
      }
      if (!window.confirm(`حذف سجل المستخدم «${u.name}» نهائياً من قاعدة البيانات؟`)) return;
      try {
        await app.db.collection('users').doc(uid).delete();
        app.toast('تم الحذف بنجاح', 'info');
        this.loadTabData('users');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async addBlacklistEntry(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const value = document.getElementById('bl-val').value.trim();
      const reason = document.getElementById('bl-reason').value.trim() || 'حظر دائم';
      if (!value) return;
      try {
        await app.db.collection('blacklist').add({ value, reason, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        e.target.reset();
        app.toast('تمت الإضافة للقائمة السوداء 🚫', 'success');
        this.loadTabData('users');
      } catch (err) { app.toast(err.message, 'error'); }
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
      try {
        await app.db.collection('promoCodes').doc(code).set({
          code, amount, maxUses, usedBy: [], active: true,
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast(`تم إنشاء كود الهدية ${code} بنجاح 🎁`, 'success');
        this.loadTabData('users');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async resolveReport(id, st) {
      await window.DamanApp.db.collection('reports').doc(id).update({ status: st });
      this.loadTabData('users');
    },

    // ==================== 8. COMMS (CHATS, 30-DAY RECORDINGS, TICKETS) ====================
    async toggleFreezeChat(chatId, curFrozen) {
      await window.DamanApp.db.collection('chats').doc(chatId).update({ frozen: !curFrozen });
      window.DamanApp.toast(curFrozen ? 'تم فك تجميد الشات' : 'تم تجميد الشات 🔒', 'info');
      this.loadTabData('comms');
    },

    async playCallRecording(recId, mediaId) {
      const app = window.DamanApp;
      const slot = document.getElementById('rec-player-' + recId);
      if (!slot) return;
      slot.innerHTML = `<span class="text-[10px] text-amber-300">جارٍ تحميل التسجيل...</span>`;
      const src = await app.fetchMedia(mediaId);
      if (src) slot.innerHTML = `<audio controls autoplay src="${src}" class="w-full h-8 mt-1"></audio>`;
      else slot.innerHTML = `<span class="text-[10px] text-rose-400">التسجيل غير متاح أو تم حذفه</span>`;
    },

    async togglePinRecording(recId, curPinned) {
      await window.DamanApp.db.collection('callRecordings').doc(recId).update({ pinned: !curPinned });
      this.loadTabData('comms');
    },

    async cleanupExpiredRecordings() {
      const app = window.DamanApp;
      const expired = this.callRecordings.filter((r) => !r.pinned && Number(r.expiresAt || 0) < Date.now());
      if (!expired.length) return app.toast('لا توجد تسجيلات منتهية الصلاحية (>30 يوم)', 'info');
      if (!window.confirm(`حذف ${expired.length} تسجيل مكالمات مرّ عليها أكثر من 30 يوماً؟`)) return;
      for (const r of expired) {
        if (r.audioMedia) await app.db.collection('mediaVault').doc(r.audioMedia).delete().catch(() => {});
        await app.db.collection('callRecordings').doc(r.id).delete().catch(() => {});
      }
      app.toast(`تم تنظيف ${expired.length} تسجيل بنجاح ✅`, 'success');
      this.loadTabData('comms');
    },

    async replyTicket(tid, userId) {
      const reply = window.prompt('اكتب رد الإدارة على التذكرة:');
      if (!reply) return;
      await window.DamanApp.db.collection('supportTickets').doc(tid).update({ adminReply: reply.trim(), status: 'closed' });
      await window.DamanApp.sendNotification(userId, 'تم الرد على تذكرة الدعم', reply.trim());
      window.DamanApp.toast('تم إرسال الرد وإغلاق التذكرة ✅', 'success');
      this.loadTabData('comms');
    },

    // ==================== 9. SETTINGS & FULL JSON BACKUP ====================
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
      app.toast('جارٍ تجهيز النسخة الاحتياطية الكاملة...', 'info');
      const cols = ['users', 'walletRequests', 'platformFees', 'adminExpenses', 'chatAgreements', 'disputes', 'projects', 'companies', 'companyMembers', 'vipRequests', 'vipLaborRequests', 'blacklist', 'promoCodes', 'settings'];
      const dump = { exportedAt: new Date().toISOString(), app: 'DamanSite', collections: {} };
      try {
        for (const c of cols) {
          const s = await app.db.collection(c).limit(500).get();
          dump.collections[c] = s.docs.map((d) => Object.assign({ _id: d.id }, d.data()));
        }
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `damansite-backup-${app.todayLocal()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        app.toast('تم تنزيل النسخة الاحتياطية (JSON) بنجاح ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
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

      // Channel Reconciliation (Vodafone Cash vs InstaPay vs Bank)
      const channels = { vodafone_cash: { in: 0, out: 0 }, instapay: { in: 0, out: 0 }, bank: { in: 0, out: 0 } };
      this.walletReqs.forEach((r) => {
        if (r.status !== 'approved') return;
        const ch = channels[r.channel] ? r.channel : 'vodafone_cash';
        if (r.type === 'deposit') channels[ch].in += Number(r.amount || 0);
        else channels[ch].out += Number(r.netPayout || r.amount || 0);
      });

      return `
        <div class="space-y-3 text-xs">
          <!-- Separated Vaults: Admin Net Profits vs Users Trust Money -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500 space-y-1">
              <div class="text-[10px] text-emerald-300 font-black">💰 خزنة أرباحك الصافية</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(netProfit)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">إجمالي الأرباح: ${app.fmtMoney(grossProfit)} | مسحوب/مصروف: ${app.fmtMoney(totalExpenses)}</div>
            </div>
            <div class="p-3.5 rounded-2xl bg-amber-500/15 border-2 border-amber-500 space-y-1">
              <div class="text-[10px] text-amber-300 font-black">🛡️ أمانات المستخدمين (فلوس الناس)</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(totalUsersTrust)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">متاح: ${app.fmtMoney(usersAvail)} | ضمان: ${app.fmtMoney(usersEscrow)} | سحب: ${app.fmtMoney(usersHoldW)}</div>
            </div>
          </div>

          <!-- Daily Channel Reconciliation -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400"><i class="fa-solid fa-scale-balanced me-1"></i> الجرد الفعلي لقنوات الدفع (إيداعات − مسحوبات معتمدة)</div>
            <div class="grid grid-cols-3 gap-2 text-center">
              ${[
                ['vodafone_cash', 'فودافون كاش'],
                ['instapay', 'إنستا باي'],
                ['bank', 'البنك']
              ].map(([k, lbl]) => {
                const netCh = Math.round((channels[k].in - channels[k].out) * 100) / 100;
                return `
                  <div class="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <div class="text-[10px] text-slate-400 font-bold">${lbl}</div>
                    <div class="text-xs font-black text-emerald-400 mt-0.5">${app.fmtMoney(netCh)} ج.م</div>
                    <div class="text-[9px] text-slate-500">+${app.fmtMoney(channels[k].in)} / -${app.fmtMoney(channels[k].out)}</div>
                  </div>`;
              }).join('')}
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
                  <option value="operations">تشغيل وسيرفرات ومرتبات</option>
                </select>
              </div>
              <input id="ae-note" type="text" required placeholder="البيان..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">تسجيل الخصم من الأرباح</button>
            </form>` : ''}

          <div class="font-black text-slate-300">آخر مصادر الأرباح (${this.platformFees.length})</div>
          <div class="space-y-1.5">
            ${this.platformFees.slice(0, 20).map((f) => `
              <div class="glass-card rounded-xl p-2.5 flex justify-between">
                <div><b class="text-white">${app.esc(f.type)}</b> ${f.ticketNumber ? `(${app.esc(f.ticketNumber)})` : ''} <span class="text-slate-400">• ${app.esc(f.date || '')}</span></div>
                <b class="text-emerald-400">+${app.fmtMoney(f.amount)} ج.م</b>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderKycTab(app) {
      const pending = this.kycReqs.filter((k) => k.status === 'pending');
      const others = this.kycReqs.filter((k) => k.status !== 'pending');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-amber-400">طلبات التوثيق المعلّقة (${pending.length}) — راجع الصورة وعدّل أي حرف قبل الاعتماد</div>
          ${!pending.length ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد طلبات توثيق معلّقة حالياً ✅</div>` : ''}
          ${pending.map((k) => {
            const isComp = k.accountType === 'company' || k.accountType === 'supplier';
            return `
              <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-amber-500/50">
                <div class="flex justify-between items-center">
                  <b class="text-white">${app.esc(k.displayName || k.legalName)} (${app.esc(k.accountType)})</b>
                  <span class="text-[10px] text-sky-300">${app.esc(k.phone || '')}</span>
                </div>

                <!-- Lazy-Loaded High-Speed Media Buttons -->
                <div class="flex flex-wrap gap-1.5">
                  <button onclick="DamanApp.openMediaLightbox('${k.idFrontMedia}','وش البطاقة — ${app.esc(k.legalName)}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 وش البطاقة</button>
                  <button onclick="DamanApp.openMediaLightbox('${k.idBackMedia}','ضهر البطاقة — ${app.esc(k.legalName)}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 ضهر البطاقة</button>
                  <button onclick="DamanApp.openMediaLightbox('${k.selfieMedia}','سيلفي — ${app.esc(k.legalName)}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-[10px]">🤳 سيلفي</button>
                  ${k.crMedia ? `<button onclick="DamanApp.openMediaLightbox('${k.crMedia}','السجل التجاري')" class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">📄 السجل التجاري</button>` : ''}
                  ${k.taxMedia ? `<button onclick="DamanApp.openMediaLightbox('${k.taxMedia}','البطاقة الضريبية')" class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">📄 البطاقة الضريبية</button>` : ''}
                </div>

                <!-- Admin Editable & Lockable Legal Fields -->
                <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div class="text-[10px] text-emerald-300 font-bold">بيانات البطاقة التي ستُقفل وتُطبع في العقود الرسمية:</div>
                  <input id="kyc-ed-name-${k.id}" type="text" value="${app.esc(k.legalName || '')}" placeholder="الاسم الرباعي من البطاقة" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
                  <input id="kyc-ed-nid-${k.id}" type="text" maxlength="14" value="${app.esc(k.nationalId || '')}" placeholder="الرقم القومي (14 رقم)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-black" />
                  <input id="kyc-ed-addr-${k.id}" type="text" value="${app.esc(k.legalAddress || '')}" placeholder="العنوان من ضهر البطاقة" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                  ${isComp ? `
                    <input id="kyc-ed-comp-${k.id}" type="text" value="${app.esc(k.companyName || '')}" placeholder="اسم الشركة" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                    <div class="grid grid-cols-2 gap-1.5">
                      <input id="kyc-ed-cr-${k.id}" type="text" value="${app.esc(k.commercialReg || '')}" placeholder="السجل التجاري" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                      <input id="kyc-ed-tax-${k.id}" type="text" value="${app.esc(k.taxCard || '')}" placeholder="البطاقة الضريبية" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                    </div>` : ''}
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <button onclick="DamanAdmin.approveKyc('${k.id}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد وتثبيت البيانات</button>
                  <button onclick="DamanAdmin.rejectKyc('${k.id}')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض وإعادة رفع</button>
                </div>
              </div>`;
          }).join('')}

          ${others.length ? `<div class="font-bold text-slate-400 pt-2">طلبات تمت مراجعتها (${others.length})</div>` + others.slice(0, 10).map((k) => `
            <div class="glass-card rounded-xl p-2.5 flex justify-between text-[11px]">
              <span>${app.esc(k.legalName)} (${app.esc(k.nationalId)})</span>
              <b class="${k.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}">${app.esc(k.status)}</b>
            </div>`).join('') : ''}

          <button onclick="DamanAdmin.loadMore('kyc')" class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">تحميل المزيد</button>
        </div>`;
    },

    renderWalletTab(app) {
      const pending = this.walletReqs.filter((r) => r.status === 'pending');
      const done = this.walletReqs.filter((r) => r.status !== 'pending');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-emerald-400">طلبات الشحن والسحب المعلّقة (${pending.length})</div>
          ${!pending.length ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد طلبات معلّقة حالياً ✅</div>` : ''}
          ${pending.map((r) => `
            <div class="glass-card rounded-2xl p-3.5 space-y-2 ${r.duplicateRefFlag ? 'border-2 border-rose-500 bg-rose-500/10' : 'border-amber-500/40'}">
              ${r.duplicateRefFlag ? `<div class="p-1.5 rounded-lg bg-rose-600 text-white font-black text-center text-[10.5px]">⚠️ تحذير: هذا الرقم المرجعي ظهر في طلب سابق — افحص جيداً قبل الاعتماد!</div>` : ''}
              <div class="flex justify-between">
                <b class="${r.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}">${r.type === 'deposit' ? '⬇️ شحن / إيداع' : '⬆️ سحب رصيد'} — ${app.fmtMoney(r.amount)} ج.م</b>
                <span class="text-[10px] text-slate-400">${app.esc(r.date || '')}</span>
              </div>
              <div class="text-[11px] text-slate-200">المستخدم: <b>${app.esc(r.userLegalName || r.userName)}</b> (${app.esc(r.userPhone || '')})</div>
              <div class="text-[10.5px] text-slate-300">القناة: <b>${app.esc(r.channel)}</b> ${r.txRef ? `| المرجع: <b class="text-amber-300">${app.esc(r.txRef)}</b>` : ''}</div>
              ${r.senderAccount ? `<div class="text-[10.5px] text-sky-300">المحوّل منه: ${app.esc(r.senderAccount)} ← إلى: ${app.esc(r.targetAccountUsed || '')}</div>` : ''}
              ${r.destAccount ? `<div class="text-[11px] text-emerald-300 font-black">التحويل إلى: ${app.esc(r.destAccount)} (الصافي بعد الرسوم: ${app.fmtMoney(r.netPayout || r.amount)} ج.م)</div>` : ''}
              ${r.receiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.receiptMedia}','إيصال ${app.esc(r.userName)}')" class="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 font-black text-[10px]"><i class="fa-solid fa-receipt me-1"></i> عرض صورة الإيصال</button>` : ''}
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','approve')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد وتنفيذ</button>
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','reject')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
              </div>
            </div>`).join('')}

          <div class="font-bold text-slate-400 pt-2">آخر العمليات المنفّذة (${done.length})</div>
          ${done.slice(0, 12).map((r) => `
            <div class="glass-card rounded-xl p-2.5 flex justify-between text-[11px]">
              <span>${r.type === 'deposit' ? '⬇️' : '⬆️'} ${app.esc(r.userName)} — ${app.fmtMoney(r.amount)} ج.م (${app.esc(r.channel)})</span>
              <b class="${r.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}">${app.esc(r.status)}</b>
            </div>`).join('')}
          <button onclick="DamanAdmin.loadMore('wallet')" class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">تحميل المزيد</button>
        </div>`;
    },

    renderContractsTab(app) {
      const pendingSigned = this.agreements.filter((a) => a.contractStatus === 'pending_admin');
      const openDisputes = this.disputes.filter((d) => d.status === 'open');
      return `
        <div class="space-y-3.5 text-xs">
          <!-- Signed Contracts Pending Admin Approval -->
          <div class="font-black text-amber-400">📄 عقود موقّعة بانتظار اعتمادك (${pendingSigned.length})</div>
          ${!pendingSigned.length ? `<div class="glass-card rounded-2xl p-4 text-center text-slate-400">لا توجد عقود موقّعة معلّقة</div>` : pendingSigned.map((a) => `
            <div class="glass-card rounded-2xl p-3.5 space-y-2 border-amber-500/50">
              <div class="flex justify-between"><b class="text-white">${app.esc(a.ticketNumber)} • ${app.esc(a.title)}</b><b class="text-emerald-400">${app.fmtMoney(a.totalAmount)} ج.م</b></div>
              <div class="text-[10.5px] text-slate-300">صاحب العمل: ${app.esc(a.payerName)} | المنفّذ: ${app.esc(a.providerName)}</div>
              <button onclick="DamanApp.openMediaLightbox('${a.signedContractMedia}','العقد الموقّع ${app.esc(a.ticketNumber)}')" class="w-full py-2 rounded-xl bg-slate-800 text-amber-300 font-black">👁️ فحص صورة العقد الموقّع</button>
              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanAdmin.reviewSignedContract('${a.id}',true)" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد العقد وفتح الصرف</button>
                <button onclick="DamanAdmin.reviewSignedContract('${a.id}',false)" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض الصورة</button>
              </div>
            </div>`).join('')}

          <!-- Open Disputes -->
          <div class="font-black text-rose-400 pt-2">⚖️ النزاعات المفتوحة (${openDisputes.length})</div>
          ${!openDisputes.length ? `<div class="glass-card rounded-2xl p-4 text-center text-slate-400">لا توجد نزاعات مفتوحة ✅</div>` : openDisputes.map((d) => `
            <div class="glass-card rounded-2xl p-3.5 space-y-2 border-rose-500/60">
              <div class="flex justify-between"><b class="text-white">${app.esc(d.contractNumber)} — ${app.esc(d.projectTitle)}</b><b class="text-amber-300">${app.fmtMoney(d.contractAmount)} ج.م</b></div>
              <p class="text-[11px] text-rose-200">${app.esc(d.reason)}</p>
              <div class="grid grid-cols-3 gap-1.5">
                <button onclick="DamanAdmin.resolveDispute('${d.id}','client')" class="py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px]">لصاحب العمل 100%</button>
                <button onclick="DamanAdmin.resolveDispute('${d.id}','provider')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10px]">للمنفّذ 100%</button>
                <button onclick="DamanAdmin.resolveDispute('${d.id}','split')" class="py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]">تقسيم مخصص</button>
              </div>
            </div>`).join('')}
        </div>`;
    },

    renderMarketTab(app) {
      const pendingPosts = this.projects.filter((p) => p.status === 'pending_review');
      return `
        <div class="space-y-4 text-xs">
          <!-- Pending Market Posts -->
          <div class="space-y-2">
            <div class="font-black text-amber-400">📢 إعلانات السوق بانتظار الموافقة (${pendingPosts.length})</div>
            ${!pendingPosts.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد إعلانات معلّقة</div>` : pendingPosts.map((p) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5 border-amber-500/40">
                <div class="font-black text-white">${app.esc(p.title)} <span class="text-amber-300">(${app.esc(p.ownerName)})</span></div>
                <p class="text-[11px] text-slate-300">${app.esc(p.description)}</p>
                <div class="grid grid-cols-2 gap-2">
                  <button onclick="DamanAdmin.moderateProject('${p.id}','approved')" class="py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ نشر</button>
                  <button onclick="DamanAdmin.moderateProject('${p.id}','rejected')" class="py-1.5 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
                </div>
              </div>`).join('')}
          </div>

          <!-- 3x Inspection Requests -->
          <div class="space-y-2">
            <div class="font-black text-emerald-400">🛡️ طلبات الاستلام الهندسي 3x (${this.inspections.length})</div>
            ${this.inspections.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.element)} — ${app.esc(r.userName)}</b><span class="text-amber-300 font-bold">${app.esc(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.location)} • ${app.esc(r.userPhone || '')} • مساحة ${app.esc(r.area)}</div>
                <div class="flex gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteInspection('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10.5px]">تسعير الطلب</button>` : ''}
                  ${r.status === 'paid' ? `<button onclick="DamanAdmin.completeInspection('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">تأكيد إتمام الاستلام</button>` : ''}
                </div>
              </div>`).join('')}
          </div>

          <!-- VIP Labor 10% Requests -->
          <div class="space-y-2">
            <div class="font-black text-purple-300">👷 طلبات توريد عمالة VIP (${this.vipLabors.length})</div>
            ${this.vipLabors.slice(0, 15).map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between"><b class="text-white">${app.esc(r.trade)} (${r.workersCount} × ${r.days} يوم) — ${app.esc(r.userName)}</b><span class="text-purple-300 font-bold">${app.esc(r.status)}</span></div>
                <div class="text-[10.5px] text-slate-400">${app.esc(r.location)} • ${app.esc(r.userPhone || '')}</div>
                <div class="flex gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteVipLabor('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-purple-500 text-white font-black text-[10.5px]">تسعير (+ عمولة VIP)</button>` : ''}
                  ${r.status === 'funded' ? `
                    <button onclick="DamanAdmin.settleVipLabor('${r.id}','settle')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">✅ إتمام وتسوية الضمان (${app.fmtMoney(r.lockedBaseCost)})</button>
                    <button onclick="DamanAdmin.settleVipLabor('${r.id}','refund')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10.5px]">ردّ الضمان</button>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderCompaniesTab(app) {
      return `
        <div class="space-y-2.5 text-xs">
          <div class="font-black text-sky-400">🏢 السيطرة الشاملة على الشركات المسجّلة (${this.companies.length})</div>
          ${!this.companies.length ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد شركات مسجّلة بعد.</div>` : this.companies.map((c) => `
            <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
              <div>
                <div class="font-black text-white">${app.esc(c.name)}</div>
                <div class="text-[10px] text-amber-300">الكود: ${app.esc(c.code)} • المالك: ${app.esc(c.ownerName || '')}</div>
              </div>
              <button onclick="DamanAdmin.openCompanyControlModal('${c.id}')" class="px-3 py-2 rounded-xl bg-purple-500 text-white font-black text-[10.5px]">إدارة وتحكّم</button>
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
        <div class="space-y-3.5 text-xs">
          <!-- Birthdays Today Card 🎂 -->
          <div class="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-purple-500/15 border border-amber-500/40 space-y-2">
            <div class="font-black text-amber-300">🎂 أعياد ميلاد اليوم (${bdays.length})</div>
            ${!bdays.length ? `<div class="text-[10.5px] text-slate-400">لا يوجد أعياد ميلاد مسجّلة اليوم.</div>` : bdays.map((u) => `
              <div class="flex items-center justify-between bg-slate-950/70 p-2 rounded-xl">
                <span><b class="text-white">${app.esc(u.legalName || u.name)}</b> (${app.esc(u.birthDate)})</span>
                <button onclick="DamanAdmin.sendBirthdayGift('${u.id}','${app.esc(u.name || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">🎁 إرسال هدية</button>
              </div>`).join('')}
          </div>

          <!-- Open Reports 🚨 -->
          ${openReports.length ? `
            <div class="space-y-1.5">
              <div class="font-black text-rose-400">🚨 بلاغات المستخدمين المفتوحة (${openReports.length})</div>
              ${openReports.map((r) => `
                <div class="glass-card rounded-xl p-2.5 border-rose-500/40 space-y-1">
                  <div class="font-bold text-white">${app.esc(r.targetTitle)} (${app.esc(r.targetType)}) — من ${app.esc(r.reporterName)}</div>
                  <div class="text-[10.5px] text-rose-200">${app.esc(r.reason)}</div>
                  <button onclick="DamanAdmin.resolveReport('${r.id}','closed')" class="px-3 py-1 rounded-lg bg-slate-800 text-emerald-300 font-bold text-[10px]">إغلاق البلاغ</button>
                </div>`).join('')}
            </div>` : ''}

          <!-- Users Search & Management -->
          <input type="text" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالاسم / الرباعي / الرقم القومي / الموبايل..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          <div class="space-y-2">
            ${filtered.map((u) => `
              <div class="glass-card rounded-2xl p-3 space-y-1">
                <div class="flex justify-between">
                  <b class="text-white">${app.esc(u.name)} ${u.kycStatus === 'verified' ? '✅' : ''} ${u.status === 'banned' ? '🚫' : ''}</b>
                  <span class="text-emerald-400 font-bold">متاح: ${app.fmtMoney(u.balanceAvailable || 0)} | ضمان: ${app.fmtMoney(u.balanceEscrow || 0)}</span>
                </div>
                <div class="text-[10px] text-slate-300">الرباعي: ${app.esc(u.legalName || '—')} | قومي: ${app.esc(u.nationalId || '—')} | ميلاد: ${app.esc(u.birthDate || '—')}</div>
                <div class="text-[10px] text-slate-400">${app.esc(u.phone || '')} • ${app.esc(u.email || '')}</div>
                <div class="flex gap-1.5 pt-1">
                  <button onclick="DamanApp.openPublicProfile('${u.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">صفحته</button>
                  <button onclick="DamanAdmin.toggleBanUser('${u.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">${u.status === 'banned' ? 'فك الحظر' : 'حظر'}</button>
                  <button onclick="DamanAdmin.deleteUserSafely('${u.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف آمن</button>
                </div>
              </div>`).join('')}
            <button onclick="DamanAdmin.loadMore('users')" class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">تحميل المزيد من المستخدمين</button>
          </div>

          <!-- Blacklist & Promo Codes -->
          <div class="grid grid-cols-1 gap-3 pt-2">
            <form onsubmit="DamanAdmin.addBlacklistEntry(event)" class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/40">
              <div class="font-black text-rose-400">🚫 القائمة السوداء (رقم قومي / موبايل / إيميل / سجل)</div>
              <div class="grid grid-cols-2 gap-2">
                <input id="bl-val" type="text" required placeholder="القيمة المحظورة" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
                <input id="bl-reason" type="text" placeholder="السبب" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              </div>
              <button type="submit" class="w-full py-1.5 rounded-lg bg-rose-500 text-white font-black">إضافة للحظر الدائم</button>
              <div class="flex flex-wrap gap-1">${this.blacklist.map((b) => `<span class="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-rose-300">${app.esc(b.value)} <button type="button" onclick="DamanAdmin.removeBlacklist('${b.id}')" class="text-white ms-1">×</button></span>`).join('')}</div>
            </form>

            <form onsubmit="DamanAdmin.createPromoCode(event)" class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
              <div class="font-black text-sky-400">🎁 إنشاء كود هدية (Promo Code)</div>
              <div class="grid grid-cols-3 gap-1.5">
                <input id="pr-code" type="text" required placeholder="DAMAN50" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white uppercase font-bold" />
                <input id="pr-amt" type="number" min="5" required placeholder="القيمة ج.م" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" />
                <input id="pr-max" type="number" min="1" value="20" required placeholder="عدد الاستخدام" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" />
              </div>
              <button type="submit" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black">إنشاء الكود</button>
            </form>
          </div>
        </div>`;
    },

    renderCommsTab(app) {
      return `
        <div class="space-y-4 text-xs">
          <!-- Call Recordings (30-Day Auto Retention + Lazy Load) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-black text-amber-400">🎙️ تسجيلات المكالمات (30 يوم) (${this.callRecordings.length})</span>
              <button onclick="DamanAdmin.cleanupExpiredRecordings()" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">تنظيف المنتهي (&gt;30 يوم)</button>
            </div>
            ${this.callRecordings.map((r) => `
              <div class="glass-card rounded-xl p-2.5 space-y-1.5">
                <div class="flex justify-between">
                  <b class="text-white">${app.esc(r.callerName)} ⇄ ${app.esc(r.otherName)} (${r.durationSec || 0}ث)</b>
                  <span class="text-[10px] text-slate-400">${app.esc(r.date || '')}</span>
                </div>
                <div class="flex gap-1.5">
                  <button onclick="DamanAdmin.playCallRecording('${r.id}','${r.audioMedia || ''}')" class="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">▶ تشغيل</button>
                  <button onclick="DamanAdmin.togglePinRecording('${r.id}',${!!r.pinned})" class="px-3 py-1 rounded-lg ${r.pinned ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'} font-bold text-[10px]">${r.pinned ? '📌 مثبّت' : 'تثبيت للنزاع'}</button>
                </div>
                <div id="rec-player-${r.id}"></div>
              </div>`).join('')}
          </div>

          <!-- Chats Monitoring -->
          <div class="space-y-2">
            <div class="font-black text-sky-400">💬 مراقبة المحادثات والتدخل المباشر (${this.chats.length})</div>
            ${this.chats.map((c) => `
              <div class="glass-card rounded-xl p-2.5 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-white truncate">${app.esc(Object.values(c.participantNames || {}).join(' ⇄ '))}</div>
                  <div class="text-[10px] text-slate-400 truncate">${app.esc(c.lastMessage || '')}</div>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button onclick="DamanApp.switchTab('chat'); if(window.DamanChat) DamanChat.openChatRoom('${c.id}',{id:'${c.id}',otherName:'مراقبة محادثة',frozen:${!!c.frozen}})" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">دخول</button>
                  <button onclick="DamanAdmin.toggleFreezeChat('${c.id}',${!!c.frozen})" class="px-2 py-1 rounded-lg bg-slate-800 text-rose-300 font-bold text-[10px]">${c.frozen ? 'فك' : 'تجميد'}</button>
                </div>
              </div>`).join('')}
          </div>

          <!-- Support Tickets -->
          <div class="space-y-2">
            <div class="font-black text-purple-300">🎫 تذاكر الدعم (${this.tickets.length})</div>
            ${this.tickets.filter((t) => t.status === 'open').map((t) => `
              <div class="glass-card rounded-xl p-3 space-y-1 border-purple-500/40">
                <div class="font-black text-white">${app.esc(t.subject)} — ${app.esc(t.userName)}</div>
                <div class="text-[11px] text-slate-300">${app.esc(t.message)}</div>
                <button onclick="DamanAdmin.replyTicket('${t.id}','${t.userId}')" class="px-3 py-1 rounded-lg bg-purple-500 text-white font-black text-[10px]">رد وإغلاق</button>
              </div>`).join('') || '<div class="text-slate-400 text-center">لا توجد تذاكر مفتوحة ✅</div>'}
          </div>
        </div>`;
    },

    renderSettingsTab(app) {
      const cfg = app.appConfig || {};
      const acc = cfg.paymentAccounts || {};
      const pkgs = cfg.packages || {};
      if (!app.isAdmin()) return `<div class="glass-card rounded-2xl p-6 text-center text-rose-300 text-xs">الإعدادات والنسخ الاحتياطي للأدمن الرئيسي فقط.</div>`;

      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanAdmin.saveSettings(event)" class="glass-card rounded-2xl p-4 space-y-3 border-amber-500/40">
            <div class="font-black text-amber-400">💳 حسابات الإيداع النشطة (تظهر فوراً بمهلة الـ 10 دقائق)</div>
            <div><label class="block text-[10px] text-slate-400 mb-1">رقم فودافون كاش / المحفظة النشط</label><input id="st-vf" type="text" value="${app.esc(acc.vodafoneCash || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">عنوان إنستا باي (InstaPay) النشط</label><input id="st-ip" type="text" value="${app.esc(acc.instaPay || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">بيانات الحساب البنكي النشط</label><textarea id="st-bank" rows="2" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc(acc.bankInfo || '')}</textarea></div>

            <div class="font-black text-sky-400 pt-1">⚙️ العمولات، الحدود، رسوم السحب والباقات</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">عمولة الضمان (%)</label><input id="st-comm" type="number" step="0.1" value="${(Number(cfg.commissionRate || 0.035) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">عمولة عمالة VIP (%)</label><input id="st-vipcomm" type="number" step="0.5" value="${(Number(cfg.vipCommissionRate || 0.10) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">الحد الأدنى للإيداع (ج.م)</label><input id="st-mindep" type="number" value="${Number(cfg.minDeposit || 100)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">الحد الأدنى للسحب (ج.م)</label><input id="st-minwd" type="number" value="${Number(cfg.minWithdraw || 100)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">رسوم السحب نسبة (%)</label><input id="st-wfpct" type="number" step="0.1" value="${Number(cfg.withdrawFeePct || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">رسوم سحب ثابتة (ج.م)</label><input id="st-wfflat" type="number" step="any" value="${Number(cfg.withdrawFeeFlat || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div><label class="block text-[9.5px] text-slate-400 mb-1">باقة أفراد</label><input id="st-pkg-ind" type="number" value="${Number(pkgs.individualMonthly || 150)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[9.5px] text-slate-400 mb-1">باقة شركات</label><input id="st-pkg-comp" type="number" value="${Number(pkgs.companyMonthly || 450)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[9.5px] text-slate-400 mb-1">تمييز إعلان</label><input id="st-pkg-boost" type="number" value="${Number(pkgs.boostAdPrice || 75)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>

            <div><label class="block text-[10px] text-slate-400 mb-1">رقم واتساب الدعم (بكود الدولة بدون +)</label><input id="st-wa" type="text" value="${app.esc(cfg.supportWhatsapp || '201030374787')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">إيميلات المشرفين المساعدين (مفصولة بفاصلة ,)</label><input id="st-mods" type="text" value="${app.esc((cfg.moderators || []).join(', '))}" placeholder="mod1@gmail.com, mod2@gmail.com" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">سيرفر TURN للمكالمات (اختياري: url|user|pass)</label><input id="st-turn" type="text" value="${app.esc(cfg.turnServer || '')}" placeholder="turn:host:3478|username|password" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>

            <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40">
              <label class="flex items-center gap-2 font-bold text-rose-300"><input id="st-maint" type="checkbox" ${cfg.maintenanceMode ? 'checked' : ''} class="accent-rose-500" /> وضع الصيانة</label>
              <label class="flex items-center gap-2 font-bold text-amber-300"><input id="st-nocalls" type="checkbox" ${cfg.disableCalls ? 'checked' : ''} class="accent-amber-500" /> إيقاف المكالمات</label>
            </div>

            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">حفظ وتطبيق الإعدادات فوراً</button>
          </form>

          <button onclick="DamanAdmin.exportFullBackup()" class="w-full py-3 rounded-2xl bg-emerald-600 text-white font-black">
            <i class="fa-solid fa-database me-1.5"></i> تنزيل نسخة احتياطية كاملة (JSON Backup)
          </button>
        </div>`;
    },

    render(container, app) {
      if (!app.hasAdminAccess()) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-400 font-bold text-xs">صلاحية الإدارة مطلوبة.</div>`;
        return;
      }
      if (!this.initialized && !this.loading) {
        this.loadTabData(this.subTab);
        return;
      }

      const tabs = [
        ['treasury', '💰 الخزنة والجرد'],
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
      if (this.loading) {
        body = `<div class="glass-card rounded-2xl p-8 text-center text-xs text-amber-400 font-bold animate-pulse">جارٍ تحميل بيانات لوحة السيطرة...</div>`;
      } else if (this.subTab === 'kyc') body = this.renderKycTab(app);
      else if (this.subTab === 'wallet') body = this.renderWalletTab(app);
      else if (this.subTab === 'contracts') body = this.renderContractsTab(app);
      else if (this.subTab === 'market') body = this.renderMarketTab(app);
      else if (this.subTab === 'companies') body = this.renderCompaniesTab(app);
      else if (this.subTab === 'users') body = this.renderUsersTab(app);
      else if (this.subTab === 'comms') body = this.renderCommsTab(app);
      else if (this.subTab === 'settings') body = this.renderSettingsTab(app);
      else body = this.renderTreasuryTab(app);

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
          ${body}
        </div>`;
    }
  };

  window.DamanAdmin = AdminMod;
  if (window.DamanApp) window.DamanApp.registerModule('admin', AdminMod);
})();
