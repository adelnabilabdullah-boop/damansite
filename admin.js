(function () {
  const AdminMod = {
    subTab: 'overview', // overview | profits | chats | contracts | posts | wallet | kyc | vip | users | companies | security | settings
    stats: { users: 0, companies: 0, suppliers: 0, avail: 0, escrow: 0, held: 0, fees: 0, pendingPosts: 0, pendingWallet: 0, pendingKyc: 0, pendingContracts: 0, openDisputes: 0, openTickets: 0 },
    feesList: [],
    expensesList: [],
    posts: [],
    walletReqs: [],
    kycReqs: [],
    inspReqs: [],
    vipLaborReqs: [],
    disputes: [],
    tickets: [],
    recordings: [],
    allChats: [],
    activeInspectChat: null,
    inspectChatMsgs: [],
    unsubInspectMsgs: null,
    agreements: [],
    ledgers: [],
    users: [],
    reviews: [],
    blacklist: [],
    promos: [],
    companiesData: [],
    selectedCompanyHr: null,
    logs: [],
    userSearch: '',
    chatSearch: '',
    loaded: false,

    isSuper(app) {
      return app && typeof app.isAdmin === 'function' && app.isAdmin();
    },

    hasAccess(app) {
      return this.isSuper(app) || (app && typeof app.isModerator === 'function' && app.isModerator());
    },

    async logAction(app, action, details) {
      try {
        await app.db.collection('adminLogs').add({
          adminEmail: app.user?.email || '',
          action,
          details: String(details || ''),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {}
    },

    async loadTabData(app, force = false) {
      if (!this.hasAccess(app)) return;
      const db = app.db;
      try {
        if (this.subTab === 'overview' || this.subTab === 'profits' || force) {
          const [uSnap, pSnap, wSnap, kSnap, aSnap, dSnap, tSnap, fSnap, expSnap] = await Promise.all([
            db.collection('users').limit(180).get(),
            db.collection('projects').limit(120).get(),
            db.collection('walletRequests').limit(80).get(),
            db.collection('kycRequests').limit(60).get(),
            db.collection('chatAgreements').limit(80).get(),
            db.collection('disputes').limit(50).get(),
            db.collection('supportTickets').limit(50).get(),
            this.isSuper(app) ? db.collection('platformFees').limit(150).get() : Promise.resolve({ docs: [] }),
            this.isSuper(app) ? db.collection('platformExpenses').limit(100).get() : Promise.resolve({ docs: [] })
          ]);
          const uArr = uSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.users = uArr;
          this.agreements = aSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.feesList = fSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          this.expensesList = expSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

          this.stats = {
            users: uArr.length,
            companies: uArr.filter((u) => u.accountType === 'company').length,
            suppliers: uArr.filter((u) => u.accountType === 'supplier').length,
            avail: uArr.reduce((s, u) => s + Number(u.balanceAvailable || 0), 0),
            escrow: uArr.reduce((s, u) => s + Number(u.balanceEscrow || 0), 0),
            held: uArr.reduce((s, u) => s + Number(u.balanceHeld || 0), 0),
            fees: this.feesList.reduce((s, f) => s + Number(f.amount || 0), 0),
            pendingPosts: pSnap.docs.filter((d) => d.data().status === 'pending_review').length,
            pendingWallet: wSnap.docs.filter((d) => d.data().status === 'pending').length,
            pendingKyc: kSnap.docs.filter((d) => d.data().status === 'pending').length,
            pendingContracts: this.agreements.filter((a) => a.contractStatus === 'pending_admin').length,
            openDisputes: dSnap.docs.filter((d) => d.data().status === 'open').length,
            openTickets: tSnap.docs.filter((d) => d.data().status === 'open').length
          };
        }

        if (this.subTab === 'chats' || force) {
          const [cSnap, rSnap] = await Promise.all([
            db.collection('chats').limit(60).get(),
            db.collection('callRecordings').limit(50).get()
          ]);
          this.allChats = cSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
          const now = Date.now();
          const validRecs = [];
          for (const d of rSnap.docs) {
            const data = d.data();
            if (data.expiresAt && data.expiresAt < now && !data.pinned) {
              db.collection('callRecordings').doc(d.id).delete().catch(() => {});
            } else {
              validRecs.push(Object.assign({ id: d.id }, data));
            }
          }
          this.recordings = validRecs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        }

        if (this.subTab === 'contracts' || force) {
          const [aSnap, lSnap] = await Promise.all([
            db.collection('chatAgreements').limit(60).get(),
            db.collection('siteLedger').limit(60).get()
          ]);
          this.agreements = aSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          this.ledgers = lSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''));
        }

        if (this.subTab === 'posts' || force) {
          const [pSnap, revSnap] = await Promise.all([
            db.collection('projects').limit(60).get(),
            db.collection('reviews').limit(50).get()
          ]);
          this.posts = pSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          this.reviews = revSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }

        if (this.subTab === 'wallet' || force) {
          const [wSnap, aSnap] = await Promise.all([
            db.collection('walletRequests').limit(60).get(),
            db.collection('chatAgreements').limit(80).get()
          ]);
          this.walletReqs = wSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          this.agreements = aSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }

        if (this.subTab === 'kyc' || force) {
          const snap = await db.collection('kycRequests').limit(60).get();
          this.kycReqs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }

        if (this.subTab === 'vip' || force) {
          const [iSnap, vSnap, dSnap, tSnap] = await Promise.all([
            db.collection('vipRequests').limit(40).get(),
            db.collection('vipLaborRequests').limit(40).get(),
            db.collection('disputes').limit(40).get(),
            db.collection('supportTickets').limit(40).get()
          ]);
          this.inspReqs = iSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.vipLaborReqs = vSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.disputes = dSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.tickets = tSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }

        if (this.subTab === 'users' || force) {
          const snap = await db.collection('users').limit(150).get();
          this.users = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        }

        if (this.subTab === 'companies' || force) {
          const [uSnap, mSnap] = await Promise.all([
            db.collection('users').where('accountType', 'in', ['company', 'supplier']).limit(80).get(),
            db.collection('companyMembers').limit(150).get()
          ]);
          const allMembers = mSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.companiesData = uSnap.docs.map((d) => {
            const c = Object.assign({ id: d.id }, d.data());
            c.members = allMembers.filter((m) => m.companyUid === d.id);
            return c;
          });
        }

        if (this.subTab === 'security' || force) {
          const [bSnap, prSnap, logSnap] = await Promise.all([
            db.collection('blacklist').limit(80).get(),
            db.collection('promoCodes').limit(40).get(),
            this.isSuper(app) ? db.collection('adminLogs').orderBy('createdAt', 'desc').limit(35).get() : Promise.resolve({ docs: [] })
          ]);
          this.blacklist = bSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.promos = prSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          this.logs = logSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
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
      if (this.unsubInspectMsgs) { try { this.unsubInspectMsgs(); } catch (e) {} this.unsubInspectMsgs = null; }
      this.activeInspectChat = null;
      this.selectedCompanyHr = null;
      this.subTab = tab;
      this.rerender();
      this.loadTabData(window.DamanApp);
    },

    // ==================== PROFIT VAULT (أرباحك لوحدك vs فلوس الناس) ====================
    calcProfitBreakdown() {
      let escrow35 = 0, vip10 = 0, subs = 0, featured = 0, insp3x = 0, other = 0;
      this.feesList.forEach((f) => {
        const a = Number(f.amount || 0);
        const t = String(f.type || '');
        if (t === 'vip_labor_10pct') vip10 += a;
        else if (t === 'subscription') subs += a;
        else if (t === 'featured_ad') featured += a;
        else if (t === 'inspection_3x') insp3x += a;
        else if (f.agreementId || t === 'escrow_35') escrow35 += a;
        else other += a;
      });
      const grossProfit = escrow35 + vip10 + subs + featured + insp3x + other;
      const totalExpenses = this.expensesList.filter((e) => e.kind === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
      const ownerWithdrawals = this.expensesList.filter((e) => e.kind === 'owner_withdraw').reduce((s, e) => s + Number(e.amount || 0), 0);
      const netAvailableProfit = Math.round((grossProfit - totalExpenses - ownerWithdrawals) * 100) / 100;
      return { escrow35, vip10, subs, featured, insp3x, other, grossProfit, totalExpenses, ownerWithdrawals, netAvailableProfit };
    },

    async addProfitExpenseOrWithdraw(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('صلاحية مالية لمدير المنصة فقط', 'error');
      const kind = document.getElementById('pv-kind').value; // expense | owner_withdraw | manual_revenue
      const amount = parseFloat(document.getElementById('pv-amt').value) || 0;
      const note = document.getElementById('pv-note').value.trim();
      if (amount <= 0) return;

      try {
        if (kind === 'manual_revenue') {
          await app.db.collection('platformFees').add({
            type: document.getElementById('pv-rev-type')?.value || 'subscription',
            amount, note, date: new Date().toISOString().slice(0, 10),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          app.toast('تم إضافة الإيراد لخزنة أرباحك ✅', 'success');
        } else {
          await app.db.collection('platformExpenses').add({
            kind, amount, note, date: new Date().toISOString().slice(0, 10),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          app.toast(kind === 'owner_withdraw' ? 'تم تسجيل سحب من أرباحك الصافية ✅' : 'تم تسجيل المصروف التشغيلي ✅', 'success');
        }
        e.target.reset();
        await this.logAction(app, 'PROFIT_VAULT_' + kind.toUpperCase(), `${amount} EGP - ${note}`);
        this.loadTabData(app, true);
      } catch (err) { app.toast(err.message, 'error'); }
    },

    printProfitVaultA4() {
      const app = window.DamanApp;
      const b = this.calcProfitBreakdown();
      const s = this.stats;
      const usersTrustTotal = s.avail + s.escrow + s.held;
      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>كشف فصل الخزنة والأرباح — ضمان سايت</title><style>@page{size:A4 portrait;margin:14mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;font-size:12px;}.box{border:2px solid #000;padding:18px;}h2{margin:0 0 6px;border-bottom:2px solid #000;padding-bottom:8px;}h3{margin:14px 0 6px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:7px;text-align:right;}th{background:#f0f0f0;width:55%;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة / حفظ كشف الأرباح PDF (A4)</button><div class="box"><h2>كشف فصل الخزنة: أمانات الناس vs أرباح ضمان سايت</h2><div>تاريخ الكشف: ${new Date().toLocaleString('ar-EG')}</div><h3>أولاً: خزنة أمانات المستخدمين (فلوس الناس — لا تُمس)</h3><table><tr><th>الأرصدة المتاحة للمستخدمين</th><td>${app.fmtMoney(s.avail)} ج.م</td></tr><tr><th>أرصدة الضمان النشطة (Escrow)</th><td>${app.fmtMoney(s.escrow)} ج.م</td></tr><tr><th>الأرصدة المحجوزة إدارياً</th><td>${app.fmtMoney(s.held)} ج.م</td></tr><tr><th>إجمالي أمانات الناس</th><td><b>${app.fmtMoney(usersTrustTotal)} ج.م</b></td></tr></table><h3>ثانياً: خزنة أرباح المنصة (أرباحك الصافية)</h3><table><tr><th>عمولات الضمان (3.5%)</th><td>${app.fmtMoney(b.escrow35)} ج.م</td></tr><tr><th>عمولات عمالة VIP (10%)</th><td>${app.fmtMoney(b.vip10)} ج.م</td></tr><tr><th>أرباح الاستلام الهندسي (3x)</th><td>${app.fmtMoney(b.insp3x)} ج.م</td></tr><tr><th>اشتراكات الباقات وتمييز الإعلانات</th><td>${app.fmtMoney(b.subs + b.featured + b.other)} ج.م</td></tr><tr><th>إجمالي الأرباح قبل المصاريف</th><td><b>${app.fmtMoney(b.grossProfit)} ج.م</b></td></tr><tr><th>مصروفات المنصة (إعلانات وتشغيل)</th><td>-${app.fmtMoney(b.totalExpenses)} ج.م</td></tr><tr><th>مسحوباتك السابقة من الأرباح</th><td>-${app.fmtMoney(b.ownerWithdrawals)} ج.م</td></tr><tr style="background:#e5e5e5"><th>صافي أرباحك المتاحة حالياً</th><td><b>${app.fmtMoney(b.netAvailableProfit)} ج.م</b></td></tr></table></div></body></html>`);
      win.document.close();
    },

    // ==================== 1. CSV EXPORT & A4 FINANCIAL REPORT ====================
    exportCsv(kind) {
      const app = window.DamanApp;
      let rows = [];
      let filename = 'damansite_export.csv';
      if (kind === 'users') {
        filename = 'damansite_users.csv';
        rows = [['Name', 'Company', 'Type', 'Phone', 'Email', 'KYC', 'Status', 'Available', 'Escrow', 'Held', 'Referrals']];
        this.users.forEach((u) => rows.push([u.name || '', u.companyName || '', u.accountType || '', u.phone || '', u.email || '', u.kycStatus || '', u.status || 'active', u.balanceAvailable || 0, u.balanceEscrow || 0, u.balanceHeld || 0, u.referralsCount || 0]));
      } else if (kind === 'wallet') {
        filename = 'damansite_wallet_requests.csv';
        rows = [['Type', 'User', 'Email', 'Amount', 'Method', 'Status', 'Note']];
        this.walletReqs.forEach((r) => rows.push([r.type, r.userName || '', r.userEmail || '', r.amount || 0, r.method || '', r.status || '', r.adminNote || '']));
      } else if (kind === 'agreements') {
        filename = 'damansite_contracts.csv';
        rows = [['Ticket', 'Title', 'Type', 'Total', 'Commission', 'Coverage%', 'Status', 'ContractStatus']];
        this.agreements.forEach((a) => rows.push([a.ticketNumber || '', a.title || '', a.type || '', a.totalAmount || 0, a.commissionFee || 0, a.coveragePercent || 0, a.status || '', a.contractStatus || '']));
      }
      const csv = '\uFEFF' + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      app.toast('تم تنزيل ملف Excel (CSV) بنجاح', 'success');
    },

    // ==================== 2. SURVEILLANCE: INSPECT ANY CHAT, INTERVENE, DELETE, FREEZE ====================
    inspectChat(chatId) {
      const app = window.DamanApp;
      const chat = this.allChats.find((c) => c.id === chatId);
      if (!chat) return;
      this.activeInspectChat = chat;
      this.inspectChatMsgs = [];
      if (this.unsubInspectMsgs) { try { this.unsubInspectMsgs(); } catch (e) {} }
      this.unsubInspectMsgs = app.db.collection('chats').doc(chatId).collection('messages').orderBy('createdAt', 'asc').limit(100).onSnapshot((snap) => {
        this.inspectChatMsgs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        this.rerender();
      });
      this.rerender();
    },

    async sendAdminIntervention(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('adm-chat-intervene');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.activeInspectChat) return;
      inp.value = '';
      try {
        const cid = this.activeInspectChat.id;
        await app.db.collection('chats').doc(cid).collection('messages').add({
          senderId: app.user.uid, senderName: 'إدارة ضمان سايت', isAdminIntervention: true, text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.db.collection('chats').doc(cid).update({ lastMessage: '👑 الإدارة: ' + text.slice(0, 70), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        for (const pUid of (this.activeInspectChat.participants || [])) {
          if (pUid && pUid !== 'admin' && pUid !== app.user.uid) {
            await app.sendNotification(pUid, 'تنبيه من إدارة ضمان سايت داخل المحادثة', text.slice(0, 90));
          }
        }
        await this.logAction(app, 'CHAT_INTERVENE', `${cid}: ${text.slice(0, 50)}`);
        app.toast('تم إرسال تدخل الإدارة للطرفين بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async deleteChatMessage(chatId, msgId) {
      if (!window.confirm('حذف هذه الرسالة نهائياً من المحادثة؟')) return;
      try {
        await window.DamanApp.db.collection('chats').doc(chatId).collection('messages').doc(msgId).delete();
        await this.logAction(window.DamanApp, 'DELETE_MSG', `${chatId}/${msgId}`);
        window.DamanApp.toast('تم حذف الرسالة', 'info');
      } catch (e) { window.DamanApp.toast(e.message, 'error'); }
    },

    async toggleFreezeChat(chatId, currentFrozen) {
      const app = window.DamanApp;
      try {
        await app.db.collection('chats').doc(chatId).update({ frozen: !currentFrozen });
        if (this.activeInspectChat && this.activeInspectChat.id === chatId) this.activeInspectChat.frozen = !currentFrozen;
        await this.logAction(app, 'FREEZE_CHAT', `${chatId} -> ${!currentFrozen}`);
        app.toast(!currentFrozen ? 'تم تجميد المحادثة 🔒' : 'تم فك تجميد المحادثة', 'info');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async togglePinRecording(id, current) {
      const app = window.DamanApp;
      try {
        await app.db.collection('callRecordings').doc(id).update({ pinned: !current });
        app.toast(!current ? 'تم تثبيت التسجيل (محمي من الحذف بعد 30 يوم)' : 'تم إلغاء التثبيت', 'info');
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

    // ==================== 3. CONTRACTS, POSTS, REVIEWS ====================
    async handleContractReview(agId, decision) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const note = decision === 'rejected' ? (window.prompt('سبب رفض صورة العقد:', 'الصورة غير واضحة أو التوقيع ناقص') || '') : '';
      try {
        await app.db.collection('chatAgreements').doc(agId).update({ contractStatus: decision, adminContractNote: note });
        const title = decision === 'approved' ? `تم اعتماد العقد الموقّع وتفعيل الضمان ✅ (${ag.ticketNumber})` : `تم رفض صورة العقد الموقّع (${ag.ticketNumber})`;
        const body = decision === 'approved' ? 'العقد الموقّع معتمد الآن من إدارة ضمان سايت.' : note;
        if (ag.createdBy) await app.sendNotification(ag.createdBy, title, body);
        if (ag.payerUid) await app.sendNotification(ag.payerUid, title, body);
        await this.logAction(app, 'CONTRACT_' + decision.toUpperCase(), ag.ticketNumber);
        app.toast('تم تحديث حالة العقد وإشعار الطرفين', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async adminStopWorkOrder(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const reason = window.prompt('سبب أمر وقف العمل / التوريد الفوري من الإدارة:', 'عدم كفاية الرصيد أو وجود مراجعة فنية/مالية');
      if (!reason) return;
      try {
        if (ag.createdBy) await app.sendNotification(ag.createdBy, `⚠️ أمر وقف عمل/توريد فوري من الإدارة (${ag.ticketNumber})`, reason);
        if (ag.payerUid) await app.sendNotification(ag.payerUid, `⚠️ أمر وقف عمل/توريد فوري من الإدارة (${ag.ticketNumber})`, reason);
        await app.db.collection('chatAgreements').doc(agId).update({
          timeline: firebase.firestore.FieldValue.arrayUnion({
            date: new Date().toISOString().slice(0, 10), kind: 'admin_stop', label: 'أمر وقف عمل/توريد إداري: ' + reason, amount: 0, by: 'إدارة ضمان سايت'
          })
        });
        await this.logAction(app, 'ADMIN_STOP_WORK', `${ag.ticketNumber}: ${reason}`);
        app.toast('تم إرسال أمر الوقف الفوري للطرفين', 'warning');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async adminAgreementForceSettle(agId, target) {
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('صلاحية مالية لمدير المنصة فقط', 'error');
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const rem = Number(ag.remainingEscrow || 0);
      if (rem <= 0) return app.toast('لا يوجد رصيد متبقي في هذا الاتفاق', 'info');
      const uid = target === 'worker' ? ag.createdBy : ag.payerUid;
      if (!uid || !window.confirm(`تحويل باقي الضمان (${app.fmtMoney(rem)} ج.م) إدارياً إلى ${target === 'worker' ? 'المنفّذ / المورّد' : 'صاحب العمل / المشتري'}؟`)) return;
      try {
        await app.db.collection('users').doc(uid).update({ balanceAvailable: firebase.firestore.FieldValue.increment(rem) });
        if (ag.payerUid) await app.db.collection('users').doc(ag.payerUid).update({ balanceEscrow: firebase.firestore.FieldValue.increment(-rem) });
        await app.db.collection('chatAgreements').doc(agId).update({ status: 'completed', remainingEscrow: 0 });
        await app.sendNotification(uid, `تحويل إداري من الاتفاق ${ag.ticketNumber}`, `تم إضافة ${app.fmtMoney(rem)} ج.م لمحفظتك بقرار إدارة ضمان سايت.`);
        await this.logAction(app, 'ADMIN_SETTLE_AGREEMENT', `${ag.ticketNumber} -> ${target} (${rem})`);
        app.toast('تم تنفيذ التحويل الإداري بنجاح', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async approvePost(postId) {
      const app = window.DamanApp;
      const p = this.posts.find((x) => x.id === postId);
      const selCat = document.getElementById('adm-cat-' + postId);
      const selType = document.getElementById('adm-ptype-' + postId);
      const patch = { status: 'open' };
      if (selCat) patch.mainCategory = selCat.value;
      if (selType) patch.postType = selType.value;
      try {
        await app.db.collection('projects').doc(postId).update(patch);
        if (p?.clientId) await app.sendNotification(p.clientId, 'تمت الموافقة على منشورك ونشره ✅', p.title || '');
        await this.logAction(app, 'APPROVE_POST', postId);
        app.toast('تم اعتماد المنشور وإشعار صاحبه', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async editPostQuick(postId) {
      const app = window.DamanApp;
      const p = this.posts.find((x) => x.id === postId);
      if (!p) return;
      const title = window.prompt('تعديل عنوان المنشور:', p.title || '');
      if (title === null) return;
      const budget = parseFloat(window.prompt('تعديل الميزانية / السعر (ج.م):', p.budget || 0));
      try {
        await app.db.collection('projects').doc(postId).update({ title: title.trim() || p.title, budget: isNaN(budget) ? p.budget : budget });
        await this.logAction(app, 'EDIT_POST', postId);
        app.toast('تم تعديل المنشور بنجاح', 'success');
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

    async deletePost(postId) {
      if (!window.confirm('حذف هذا المنشور نهائياً؟')) return;
      try {
        await window.DamanApp.db.collection('projects').doc(postId).delete();
        await this.logAction(window.DamanApp, 'DELETE_POST', postId);
        window.DamanApp.toast('تم حذف المنشور نهائياً', 'info');
        this.loadTabData(window.DamanApp);
      } catch (e) { window.DamanApp.toast(e.message, 'error'); }
    },

    async deleteReview(revId) {
      if (!window.confirm('حذف هذا التقييم نهائياً؟')) return;
      try {
        await window.DamanApp.db.collection('reviews').doc(revId).delete();
        await this.logAction(window.DamanApp, 'DELETE_REVIEW', revId);
        window.DamanApp.toast('تم حذف التقييم', 'info');
        this.loadTabData(window.DamanApp);
      } catch (e) { window.DamanApp.toast(e.message, 'error'); }
    },

    // ==================== 4. WALLET, KYC, DISPUTES, VIP 10% & 3X COLLECTION ====================
    async handleWalletReq(reqId, decision) {
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('الموافقات المالية مقصورة على مدير المنصة فقط', 'error');
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
        app.toast('تم التنفيذ وإشعار المستخدم', 'success');
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
        await this.logAction(app, 'KYC_' + status.toUpperCase(), uid);
        app.toast('تم التحديث وإشعار المستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async resolveDispute(dispId, mode) {
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('الفصل المالي مقصور على مدير المنصة فقط', 'error');
      const d = this.disputes.find((x) => x.id === dispId);
      if (!d) return;
      const total = Number(d.contractAmount || 0);
      let clientPct = mode === 'client' ? 100 : mode === 'provider' ? 0 : parseInt(window.prompt('أدخل نسبة العميل/المشتري (%) والباقي يذهب للمنفّذ/المورّد (مثال 60):', '50'), 10);
      if (isNaN(clientPct) || clientPct < 0 || clientPct > 100) return;
      const providerPct = 100 - clientPct;
      const clientAmt = Math.round((total * clientPct) / 100);
      const provAmt = Math.round((total * providerPct) / 100);
      if (!window.confirm(`تأكيد الفصل في النزاع:\n• للعميل: ${clientPct}% (${app.fmtMoney(clientAmt)} ج.م)\n• للمنفّذ/المورّد: ${providerPct}% (${app.fmtMoney(provAmt)} ج.م)`)) return;

      try {
        if (d.clientId && clientAmt > 0) await app.db.collection('users').doc(d.clientId).update({ balanceAvailable: firebase.firestore.FieldValue.increment(clientAmt) });
        if (d.providerId && provAmt > 0) await app.db.collection('users').doc(d.providerId).update({ balanceAvailable: firebase.firestore.FieldValue.increment(provAmt) });
        await app.db.collection('disputes').doc(dispId).update({ status: 'resolved', resolution: `عميل ${clientPct}% / منفذ ${providerPct}%` });
        const msg = `تم الفصل في نزاع ${d.contractNumber}: للعميل ${clientPct}% (${app.fmtMoney(clientAmt)} ج.م) وللمنفّذ ${providerPct}% (${app.fmtMoney(provAmt)} ج.م).`;
        if (d.clientId) await app.sendNotification(d.clientId, 'قرار الإدارة في النزاع', msg);
        if (d.providerId) await app.sendNotification(d.providerId, 'قرار الإدارة في النزاع', msg);
        await this.logAction(app, 'RESOLVE_DISPUTE', `${d.contractNumber}: ${clientPct}/${providerPct}`);
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

    async quoteInspection(reqId, userId) {
      const app = window.DamanApp;
      const price = parseFloat(window.prompt('السعر المحدد للاستلام الهندسي 3x (ج.م):', ''));
      if (!price || price <= 0) return;
      const note = window.prompt('ملاحظة أو موعد للعميل:', '') || '';
      try {
        await app.db.collection('vipRequests').doc(reqId).update({ quotedPrice: price, adminNote: note, status: 'quoted' });
        await app.sendNotification(userId, 'تم تسعير طلب الاستلام الهندسي 3x', `السعر: ${app.fmtMoney(price)} ج.م ${note ? '— ' + note : ''}`);
        app.toast('تم إرسال السعر وإشعار العميل', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async collectInspectionFee(reqId) {
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('للمدير العام فقط', 'error');
      const r = this.inspReqs.find((x) => x.id === reqId);
      if (!r || !r.quotedPrice) return app.toast('سعّر الطلب أولاً', 'warning');
      if (!window.confirm(`تأكيد تحصيل مبلغ ${app.fmtMoney(r.quotedPrice)} ج.م وإضافته إلى خزنة أرباحك (بند الاستلام الهندسي 3x)؟`)) return;
      try {
        await app.db.collection('vipRequests').doc(reqId).update({ status: 'collected' });
        await app.db.collection('platformFees').add({
          type: 'inspection_3x',
          amount: Number(r.quotedPrice),
          note: `${r.packageLabel} — ${r.userName}`,
          date: new Date().toISOString().slice(0, 10),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.logAction(app, 'COLLECT_3X_FEE', `${r.quotedPrice} EGP`);
        app.toast('تم إضافة المبلغ إلى خزنة أرباحك بنجاح ✅', 'success');
        this.loadTabData(app, true);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async replyVipLabor(reqId, userId) {
      const app = window.DamanApp;
      const baseCost = parseFloat(window.prompt('أدخل تكلفة العمالة الأساسية (ج.م):', ''));
      if (!baseCost || baseCost <= 0) return;
      const vipCommission = Math.round(baseCost * 0.10 * 100) / 100;
      const totalPrice = Math.round((baseCost + vipCommission) * 100) / 100;
      const note = window.prompt(
        `التكلفة: ${app.fmtMoney(baseCost)} ج.م + عمولة VIP (10%): ${app.fmtMoney(vipCommission)} ج.م\nالإجمالي للعميل: ${app.fmtMoney(totalPrice)} ج.م\n\nاكتب ملاحظة أو موعد التوفير للعميل:`,
        'العمالة جاهزة للنزول فور حجز المبلغ من المحفظة'
      ) || '';
      try {
        await app.db.collection('vipLaborRequests').doc(reqId).update({ baseCost, vipCommission, totalPrice, adminNote: note, status: 'quoted' });
        await app.sendNotification(userId, 'تم تسعير طلب عمالة VIP ✅', `التكلفة: ${app.fmtMoney(baseCost)} + عمولة 10% (${app.fmtMoney(vipCommission)}) = الإجمالي ${app.fmtMoney(totalPrice)} ج.م — ادخل للموافقة والحجز.`);
        await this.logAction(app, 'QUOTE_VIP_LABOR', `${reqId}: ${totalPrice} EGP (10% = ${vipCommission})`);
        app.toast('تم إرسال التسعيرة بعمولة 10% وإشعار العميل ✅', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 5. FULL USER, COMPANY, SECURITY & SETTINGS ====================
    async editUserBalances3(uid) {
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('صلاحية مالية لمدير المنصة فقط', 'error');
      const u = this.users.find((x) => x.id === uid);
      if (!u) return;
      const avail = parseFloat(window.prompt('الرصيد المتاح الجديد (ج.م):', u.balanceAvailable || 0));
      if (isNaN(avail)) return;
      const esc = parseFloat(window.prompt('رصيد الضمان (Escrow) الجديد (ج.م):', u.balanceEscrow || 0));
      if (isNaN(esc)) return;
      const held = parseFloat(window.prompt('الرصيد المحجوز إدارياً الجديد (ج.م):', u.balanceHeld || 0));
      if (isNaN(held)) return;
      const reason = window.prompt('السبب (يظهر للمستخدم في الإشعار):', 'تحديث مالي إداري') || 'تحديث مالي إداري';
      try {
        await app.db.collection('users').doc(uid).update({ balanceAvailable: avail, balanceEscrow: esc, balanceHeld: held });
        await app.sendNotification(uid, 'تحديث رصيد محفظتك من الإدارة', `المتاح: ${app.fmtMoney(avail)} | الضمان: ${app.fmtMoney(esc)} | المحجوز: ${app.fmtMoney(held)} — ${reason}`);
        await this.logAction(app, 'EDIT_BALANCES', `${u.name}: ${avail}/${esc}/${held}`);
        app.toast('تم تحديث الأرصدة الـ 3 وإشعار المستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async toggleUserKycQuick(uid, current) {
      const app = window.DamanApp;
      const next = current === 'verified' ? 'unverified' : 'verified';
      try {
        await app.db.collection('users').doc(uid).update({ kycStatus: next });
        await app.sendNotification(uid, next === 'verified' ? 'تم توثيق حسابك إدارياً ✅' : 'تم سحب شارة التوثيق', next === 'verified' ? 'حسابك موثّق الآن.' : 'يرجى التواصل مع الإدارة.');
        await this.logAction(app, 'QUICK_KYC', `${uid} -> ${next}`);
        app.toast('تم تحديث حالة التوثيق', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async changeUserRole(uid) {
      const app = window.DamanApp;
      const r = window.prompt('اكتب النوع الجديد: client (عميل) أو contractor (مقاول) أو company (شركة) أو supplier (مورّد B2B):', 'supplier');
      if (!['client', 'contractor', 'company', 'supplier'].includes(r)) return;
      try {
        const patch = { accountType: r };
        if (r === 'company' || r === 'supplier') patch.companyCode = 'CMP-' + Math.floor(1000 + Math.random() * 9000);
        await app.db.collection('users').doc(uid).update(patch);
        await app.sendNotification(uid, 'تم تحديث نوع حسابك من الإدارة', `نوع الحساب الحالي: ${r}`);
        app.toast('تم تغيير نوع الحساب بنجاح', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async grantCustomPlan(uid) {
      const app = window.DamanApp;
      const planType = window.prompt('اكتب company (باقة شركات/موردين) أو individual (باقة أفراد) أو cancel لإلغاء الباقة:', 'company');
      if (!planType) return;
      if (planType === 'cancel') {
        await app.db.collection('users').doc(uid).update({ activePlanKey: '', activePlanName: '', activePlanExpires: '' });
        await app.sendNotification(uid, 'تم إلغاء الباقة المفعّلة إدارياً', 'تواصل مع الإدارة لأي استفسار.');
        app.toast('تم إلغاء الباقة', 'info');
        return this.loadTabData(app);
      }
      const days = parseInt(window.prompt('مدة الباقة بالأيام (مثلاً 30 أو 90 أو 365):', '30'), 10) || 30;
      const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const name = planType === 'company' ? 'باقة الشركات (هدية إدارة)' : 'باقة الأفراد VIP (هدية إدارة)';
      try {
        await app.db.collection('users').doc(uid).update({ activePlanKey: planType === 'company' ? 'company' : 'individual', activePlanName: name, activePlanExpires: exp });
        await app.sendNotification(uid, 'مبروك! حصلت على باقة هدية 🎁', `تم تفعيل ${name} لمدة ${days} يوماً حتى ${exp}`);
        await this.logAction(app, 'GRANT_PLAN', `${uid} -> ${planType} (${days}d)`);
        app.toast('تم تفعيل الباقة وإشعار المستخدم فوراً', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async sendPrivateNotif(uid, name) {
      const app = window.DamanApp;
      const msg = window.prompt(`اكتب رسالة الإشعار الخاص إلى (${name}):`, '');
      if (!msg) return;
      await app.sendNotification(uid, 'رسالة خاصة من إدارة ضمان سايت', msg);
      app.toast('تم إرسال الإشعار الخاص بنجاح', 'success');
    },

    async setUserStatus(uid, status) {
      const app = window.DamanApp;
      if (!window.confirm(`تغيير حالة الحساب إلى (${status})؟`)) return;
      try {
        await app.db.collection('users').doc(uid).update({ status });
        await app.sendNotification(uid, 'تحديث حالة الحساب من الإدارة', status === 'active' ? 'تم إعادة تفعيل حسابك ✅' : 'تم تجميد/حظر الحساب — تواصل مع الدعم.');
        await this.logAction(app, 'USER_STATUS', `${uid} -> ${status}`);
        app.toast('تم التحديث وإشعار المستخدم', 'success');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async deleteUserDoc(uid, name) {
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('للمدير العام فقط', 'error');
      if (!window.confirm(`حذف ملف المستخدم (${name}) نهائياً من قاعدة البيانات؟`)) return;
      try {
        await app.db.collection('users').doc(uid).delete();
        await this.logAction(app, 'DELETE_USER', `${uid} (${name})`);
        app.toast('تم حذف المستخدم', 'info');
        this.loadTabData(app);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async inspectCompanyHr(companyUid, companyName) {
      const app = window.DamanApp;
      try {
        const [aSnap, pSnap, cSnap, gSnap] = await Promise.all([
          app.db.collection('companyAttendance').where('companyUid', '==', companyUid).limit(30).get(),
          app.db.collection('companyPayrolls').where('companyUid', '==', companyUid).limit(30).get(),
          app.db.collection('companyCustody').where('companyUid', '==', companyUid).limit(30).get(),
          app.db.collection('companyChats').doc(companyUid).collection('messages').orderBy('createdAt', 'desc').limit(25).get()
        ]);
        this.selectedCompanyHr = {
          companyUid, companyName,
          attendance: aSnap.docs.map((d) => d.data()),
          payrolls: pSnap.docs.map((d) => d.data()),
          custody: cSnap.docs.map((d) => d.data()),
          groupMsgs: gSnap.docs.map((d) => d.data()).reverse()
        };
        this.rerender();
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async addBlacklistItem(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('للمدير العام فقط', 'error');
      const val = document.getElementById('bl-val').value.trim();
      const reason = document.getElementById('bl-reason').value.trim();
      if (!val) return;
      try {
        await app.db.collection('blacklist').add({ value: val, reason, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        e.target.reset();
        await this.logAction(app, 'ADD_BLACKLIST', `${val} (${reason})`);
        app.toast('تم الإضافة للقائمة السوداء بنجاح', 'success');
        this.loadTabData(app);
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async deleteBlacklistItem(id) {
      if (!this.isSuper(window.DamanApp)) return;
      try { await window.DamanApp.db.collection('blacklist').doc(id).delete(); this.loadTabData(window.DamanApp); } catch (e) {}
    },

    async addPromoCode(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('للمدير العام فقط', 'error');
      const code = document.getElementById('pr-code').value.trim().toUpperCase();
      const rewardType = document.getElementById('pr-type').value;
      const value = parseFloat(document.getElementById('pr-val').value) || 0;
      const maxUses = parseInt(document.getElementById('pr-max').value, 10) || 100;
      if (!code) return;
      try {
        await app.db.collection('promoCodes').doc(code).set({ code, rewardType, value, maxUses, usedCount: 0, usedBy: [], active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        e.target.reset();
        app.toast(`تم إنشاء كود الهدية (${code}) بنجاح`, 'success');
        this.loadTabData(app);
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async deletePromoCode(code) {
      if (!this.isSuper(window.DamanApp)) return;
      try { await window.DamanApp.db.collection('promoCodes').doc(code).delete(); this.loadTabData(window.DamanApp); } catch (e) {}
    },

    async addSliderAd(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('للمدير العام فقط', 'error');
      const ads = (app.appConfig?.ads && app.appConfig.ads.length ? app.appConfig.ads : window.DAMAN_DEFAULT_ADS).slice();
      ads.unshift({ id: 'ad_' + Date.now(), badgeAr: document.getElementById('ad-badge').value.trim() || 'إعلان مميز', titleAr: document.getElementById('ad-title').value.trim(), descAr: document.getElementById('ad-desc').value.trim(), linkUrl: document.getElementById('ad-link').value.trim(), actionTab: 'projects', gradient: 'from-amber-600 via-orange-600 to-amber-800', active: true });
      try {
        await app.db.collection('settings').doc('appConfig').set({ ads }, { merge: true });
        await app.loadAppConfig(true);
        e.target.reset();
        app.toast('تم إضافة الإعلان لسلايدر الرئيسية فوراً ✅', 'success');
        this.rerender();
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async deleteSliderAd(idx) {
      const app = window.DamanApp;
      if (!this.isSuper(app)) return;
      const ads = (app.appConfig?.ads && app.appConfig.ads.length ? app.appConfig.ads : window.DAMAN_DEFAULT_ADS).slice();
      ads.splice(idx, 1);
      await app.db.collection('settings').doc('appConfig').set({ ads }, { merge: true });
      await app.loadAppConfig(true);
      app.toast('تم حذف الإعلان', 'info');
      this.rerender();
    },

    async addDailyNotifItem(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('للمدير العام فقط', 'error');
      const list = (app.appConfig?.dailyNotifs && app.appConfig.dailyNotifs.length ? app.appConfig.dailyNotifs : window.DAMAN_DAILY_NOTIFS).slice();
      list.unshift({ title: document.getElementById('dn-title').value.trim(), body: document.getElementById('dn-body').value.trim() });
      await app.db.collection('settings').doc('appConfig').set({ dailyNotifs: list }, { merge: true });
      await app.loadAppConfig(true);
      e.target.reset();
      app.toast('تم إضافة الإشعار اليومي بنجاح', 'success');
      this.rerender();
    },

    async saveGlobalSettings(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.isSuper(app)) return app.toast('للمدير العام فقط', 'error');
      const rate = (parseFloat(document.getElementById('set-comm').value) || 3.5) / 100;
      const modsRaw = (document.getElementById('set-mods').value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

      const patch = {
        commissionRate: rate,
        maintenanceMode: document.getElementById('set-maint').checked,
        maintenanceMsg: document.getElementById('set-maint-msg').value.trim() || 'التطبيق تحت التحديث والصيانة حالياً، سنعود خلال دقائق.',
        disableCalls: document.getElementById('set-no-calls').checked,
        disableWithdrawals: document.getElementById('set-no-with').checked,
        disableDeposits: document.getElementById('set-no-dep').checked,
        disableRegistration: document.getElementById('set-no-reg').checked,
        disablePosting: document.getElementById('set-no-post').checked,
        hideDemoAds: document.getElementById('set-hide-demo').checked,
        supportWhatsapp: document.getElementById('set-wa').value.trim(),
        guarantee3xText: document.getElementById('set-g3x').value.trim(),
        moderators: modsRaw,
        packages: {
          individual: { titleAr: 'باقة الأفراد VIP', titleEn: 'Individual VIP', m1: +document.getElementById('set-ind-m1').value || 150, m3: +document.getElementById('set-ind-m3').value || 400, m6: +document.getElementById('set-ind-m6').value || 750, m12: +document.getElementById('set-ind-m12').value || 1350 },
          company: { titleAr: 'باقة الشركات', titleEn: 'Company Plan', m1: +document.getElementById('set-cmp-m1').value || 250, m3: +document.getElementById('set-cmp-m3').value || 650, m6: +document.getElementById('set-cmp-m6').value || 1200, m12: +document.getElementById('set-cmp-m12').value || 2200 },
          featured: { titleAr: 'تمييز إعلان', titleEn: 'Featured Ad', week: +document.getElementById('set-feat-w').value || 75, month: +document.getElementById('set-feat-m').value || 200 },
          minCompanyBalanceForAccess: +document.getElementById('set-min-bal').value || 100
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      try {
        await app.db.collection('settings').doc('appConfig').set(patch, { merge: true });
        await app.loadAppConfig(true);
        await this.logAction(app, 'SAVE_GLOBAL_SETTINGS', `Maint:${patch.maintenanceMode}, Comm:${(rate * 100).toFixed(1)}%`);
        app.toast('تم حفظ كل إعدادات ومفاتيح السيطرة فوراً ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async sendBroadcast(e) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.sendNotification('ALL', document.getElementById('bc-title').value.trim(), document.getElementById('bc-body').value.trim());
      e.target.reset();
      await this.logAction(app, 'BROADCAST', 'Sent to ALL');
      app.toast('تم إرسال الإشعار الجماعي لجميع المستخدمين ✅', 'success');
    },

    // ==================== RENDER TABS ====================
    renderOverviewTab(app) {
      const s = this.stats;
      const b = this.calcProfitBreakdown();
      const usersTrust = s.avail + s.escrow + s.held;

      // Smart Leads: Users who deposited money (>0) but have 0 agreements yet
      const activeUids = new Set();
      this.agreements.forEach((a) => { if (a.createdBy) activeUids.add(a.createdBy); if (a.payerUid) activeUids.add(a.payerUid); });
      const hotLeads = this.users.filter((u) => Number(u.balanceAvailable || 0) > 0 && !activeUids.has(u.id)).slice(0, 6);

      // Top Performers: Highest rated / most active contractors & suppliers
      const topPerformers = this.users.filter((u) => u.accountType === 'contractor' || u.accountType === 'supplier' || u.accountType === 'company')
        .sort((a, b2) => (b2.ratingAvg || 0) - (a.ratingAvg || 0) || (b2.referralsCount || 0) - (a.referralsCount || 0)).slice(0, 5);

      return `
        <div class="space-y-3">
          <!-- SEPARATED VAULTS SUMMARY -->
          <div class="grid grid-cols-2 gap-2 text-center">
            <div onclick="DamanAdmin.setSubTab('profits')" class="p-3 rounded-2xl bg-gradient-to-br from-amber-900/50 to-slate-950 border border-amber-500/60 cursor-pointer">
              <div class="text-[10px] text-amber-200 font-bold">💰 خزنة أرباحك الصافية</div>
              <div class="text-sm font-black text-amber-400 mt-0.5">${app.fmtMoney(b.netAvailableProfit)} ج.م</div>
              <div class="text-[9px] text-slate-300">اضغط للتفاصيل والسحب</div>
            </div>
            <div class="p-3 rounded-2xl bg-slate-950 border border-sky-500/40">
              <div class="text-[10px] text-sky-300 font-bold">🏦 أمانات المستخدمين (فلوس الناس)</div>
              <div class="text-sm font-black text-white mt-0.5">${app.fmtMoney(usersTrust)} ج.م</div>
              <div class="text-[9px] text-slate-400">متاح ${app.fmtMoney(s.avail)} | ضمان ${app.fmtMoney(s.escrow)}</div>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-3 space-y-2 text-xs">
            <div class="font-black text-amber-400">مهام بانتظار قرارك الآن (${s.users} مستخدم • ${s.companies} شركة • ${s.suppliers} مورّد):</div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <button onclick="DamanAdmin.setSubTab('contracts')" class="p-2 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-200 font-bold">عقود موقّعة<br/><b class="text-sm">${s.pendingContracts}</b></button>
              <button onclick="DamanAdmin.setSubTab('wallet')" class="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 font-bold">طلبات محفظة<br/><b class="text-sm">${s.pendingWallet}</b></button>
              <button onclick="DamanAdmin.setSubTab('posts')" class="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 font-bold">منشورات<br/><b class="text-sm">${s.pendingPosts}</b></button>
              <button onclick="DamanAdmin.setSubTab('kyc')" class="p-2 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-200 font-bold">توثيق KYC<br/><b class="text-sm">${s.pendingKyc}</b></button>
              <button onclick="DamanAdmin.setSubTab('vip')" class="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 font-bold">نزاعات<br/><b class="text-sm">${s.openDisputes}</b></button>
              <button onclick="DamanAdmin.setSubTab('vip')" class="p-2 rounded-xl bg-slate-800 text-slate-200 font-bold">تذاكر دعم<br/><b class="text-sm">${s.openTickets}</b></button>
            </div>
          </div>

          ${hotLeads.length ? `
            <div class="glass-card rounded-2xl p-3 space-y-1.5 text-xs border-emerald-500/30">
              <div class="font-black text-emerald-400"><i class="fa-solid fa-fire me-1"></i> عملاء ساخنون (شحنوا رصيد ولم يبدؤوا اتفاقاً بعد):</div>
              ${hotLeads.map((u) => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-950 text-[11px]">
                  <div><b>${app.esc(u.companyName || u.name)}</b> <span class="text-emerald-400">(${app.fmtMoney(u.balanceAvailable)} ج.م)</span></div>
                  <button onclick="DamanAdmin.sendPrivateNotif('${u.id}','${app.esc(u.name || '').replace(/'/g, "\\'")}')" class="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">متابعة</button>
                </div>`).join('')}
            </div>` : ''}

          ${topPerformers.length ? `
            <div class="glass-card rounded-2xl p-3 space-y-1.5 text-xs">
              <div class="font-black text-amber-300"><i class="fa-solid fa-trophy me-1"></i> أفضل المقاولين والموردين بالمنصة:</div>
              ${topPerformers.map((u, idx) => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-950 text-[11px]">
                  <span>${idx + 1}. <b>${app.esc(u.companyName || u.name)}</b> (${app.getRoleLabel(u.accountType)})</span>
                  <button onclick="DamanAdmin.grantCustomPlan('${u.id}')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">مكافأة 🎁</button>
                </div>`).join('')}
            </div>` : ''}

          <div class="glass-card rounded-2xl p-3 space-y-2">
            <div class="text-xs font-black text-white">تصدير التقارير (Excel CSV / PDF):</div>
            <div class="grid grid-cols-2 gap-1.5 text-[10px]">
              <button onclick="DamanAdmin.printProfitVaultA4()" class="py-2 rounded-xl bg-white text-slate-950 font-black"><i class="fa-solid fa-print me-1"></i>كشف الأرباح A4</button>
              <button onclick="DamanAdmin.exportCsv('users')" class="py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-black">المستخدمين Excel</button>
              <button onclick="DamanAdmin.exportCsv('wallet')" class="py-2 rounded-xl bg-sky-500/20 text-sky-300 font-black">المحفظة Excel</button>
              <button onclick="DamanAdmin.exportCsv('agreements')" class="py-2 rounded-xl bg-amber-500/20 text-amber-300 font-black">العقود Excel</button>
            </div>
          </div>
        </div>`;
    },

    renderProfitsTab(app) {
      if (!this.isSuper(app)) return `<div class="p-6 text-center text-xs text-rose-400">خزنة الأرباح مقصورة على مدير المنصة فقط</div>`;
      const b = this.calcProfitBreakdown();
      const s = this.stats;
      const usersTrust = s.avail + s.escrow + s.held;

      return `
        <div class="space-y-3.5 text-xs">
          <!-- BOX 1: USERS TRUST VAULT -->
          <div class="p-3.5 rounded-2xl bg-slate-950 border border-sky-500/50 space-y-2">
            <div class="flex justify-between items-center">
              <span class="font-black text-sky-300"><i class="fa-solid fa-vault me-1"></i> 1. خزنة أمانات الناس (لا تُمس)</span>
              <span class="text-sm font-black text-white">${app.fmtMoney(usersTrust)} ج.م</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div class="p-2 rounded-xl bg-slate-900">متاح للناس<br/><b class="text-emerald-400">${app.fmtMoney(s.avail)}</b></div>
              <div class="p-2 rounded-xl bg-slate-900">ضمان Escrow<br/><b class="text-amber-400">${app.fmtMoney(s.escrow)}</b></div>
              <div class="p-2 rounded-xl bg-slate-900">محجوز إدارياً<br/><b class="text-rose-400">${app.fmtMoney(s.held)}</b></div>
            </div>
          </div>

          <!-- BOX 2: PLATFORM PROFIT VAULT -->
          <div class="p-3.5 rounded-2xl bg-gradient-to-br from-amber-900/40 via-slate-900 to-slate-950 border border-amber-500/60 space-y-2.5">
            <div class="flex justify-between items-center">
              <span class="font-black text-amber-400"><i class="fa-solid fa-coins me-1"></i> 2. خزنة أرباحك الصافية (فلوسك لوحدك)</span>
              <button onclick="DamanAdmin.printProfitVaultA4()" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>كشف A4</button>
            </div>
            <div class="grid grid-cols-2 gap-1.5 text-[11px]">
              <div class="p-2 rounded-xl bg-slate-950/80 flex justify-between"><span>عمولة الضمان 3.5%:</span><b class="text-emerald-400">${app.fmtMoney(b.escrow35)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950/80 flex justify-between"><span>عمالة VIP 10%:</span><b class="text-emerald-400">${app.fmtMoney(b.vip10)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950/80 flex justify-between"><span>الاستلام الهندسي 3x:</span><b class="text-emerald-400">${app.fmtMoney(b.insp3x)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950/80 flex justify-between"><span>باقات وتمييز:</span><b class="text-emerald-400">${app.fmtMoney(b.subs + b.featured + b.other)}</b></div>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] pt-1 border-t border-slate-800">
              <div class="p-2 rounded-xl bg-slate-950">مصروفات تشغيل<br/><b class="text-rose-400">-${app.fmtMoney(b.totalExpenses)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950">مسحوباتك<br/><b class="text-sky-400">-${app.fmtMoney(b.ownerWithdrawals)}</b></div>
              <div class="p-2 rounded-xl bg-amber-500/20 border border-amber-500/50">الصافي المتاح ليك<br/><b class="text-amber-300 text-xs">${app.fmtMoney(b.netAvailableProfit)} ج.م</b></div>
            </div>
          </div>

          <!-- ADD EXPENSE / OWNER WITHDRAWAL / MANUAL REVENUE -->
          <form onsubmit="DamanAdmin.addProfitExpenseOrWithdraw(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="font-black text-white">تسجيل حركة على خزنة أرباحك:</div>
            <select id="pv-kind" onchange="document.getElementById('pv-rev-type').classList.toggle('hidden', this.value!=='manual_revenue')" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 font-bold text-white">
              <option value="owner_withdraw">💸 سحب مبلغ من أرباحي الصافية لنفسي (-)</option>
              <option value="expense">📢 مصروف تشغيل / إعلانات فيسبوك / رواتب (-)</option>
              <option value="manual_revenue">➕ إضافة إيراد يدوي (اشتراك / تمييز / استشارة) (+)</option>
            </select>
            <select id="pv-rev-type" class="hidden w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 font-bold text-emerald-300">
              <option value="subscription">اشتراك باقة أفراد / شركات</option>
              <option value="featured_ad">تمييز إعلان ★</option>
              <option value="inspection_3x">استلام هندسي 3x</option>
              <option value="vip_labor_10pct">عمولة عمالة VIP 10%</option>
            </select>
            <div class="grid grid-cols-2 gap-2">
              <input id="pv-amt" type="number" min="1" step="any" required placeholder="المبلغ (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="pv-note" type="text" required placeholder="البيان (مثال: حملة فيسبوك)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ في خزنة الأرباح</button>
          </form>

          <div class="glass-card rounded-2xl p-3 space-y-1.5">
            <div class="font-bold text-slate-300">آخر حركات المصروفات ومسحوباتك (${this.expensesList.length}):</div>
            ${!this.expensesList.length ? '<div class="text-slate-500 text-center py-2">لا توجد حركات بعد</div>' : this.expensesList.slice(0, 15).map((e) => `
              <div class="p-2 rounded-lg bg-slate-950 flex justify-between text-[11px]">
                <span>${e.kind === 'owner_withdraw' ? '💸 سحب أرباح' : '📢 مصروف'} — ${app.esc(e.note)} <small class="text-slate-500">(${app.esc(e.date || '')})</small></span>
                <b class="text-rose-400">-${app.fmtMoney(e.amount)} ج.م</b>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderChatsAndCallsTab(app) {
      if (this.activeInspectChat) {
        const c = this.activeInspectChat;
        const names = Object.values(c.participantNames || {}).join(' ↔ ');
        return `
          <div class="space-y-2.5">
            <div class="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-between gap-2 text-xs">
              <button onclick="DamanAdmin.activeInspectChat=null; DamanAdmin.rerender()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold">← رجوع</button>
              <div class="font-black text-amber-300 truncate">${app.esc(names || c.id)}</div>
              <button onclick="DamanAdmin.toggleFreezeChat('${c.id}',${!!c.frozen})" class="px-2.5 py-1 rounded-lg ${c.frozen ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'} font-black text-[10px]">${c.frozen ? 'فك التجميد' : 'تجميد 🔒'}</button>
            </div>
            <div class="glass-card rounded-2xl p-3 space-y-2 h-[290px] overflow-y-auto text-xs">
              ${!this.inspectChatMsgs.length ? '<div class="text-center text-slate-400 py-8">لا توجد رسائل</div>' : this.inspectChatMsgs.map((m) => `
                <div class="p-2.5 rounded-xl ${m.isAdminIntervention ? 'bg-purple-900/50 border border-amber-400' : 'bg-slate-950 border border-slate-800'} space-y-1">
                  <div class="flex justify-between text-[10px]">
                    <span class="font-black text-amber-300">${app.esc(m.senderName || m.senderId)}</span>
                    <button onclick="DamanAdmin.deleteChatMessage('${c.id}','${m.id}')" class="text-rose-400"><i class="fa-solid fa-trash"></i></button>
                  </div>
                  ${m.imageBase64 ? `<img src="${m.imageBase64}" onclick="window.open('${m.imageBase64}','_blank')" class="max-h-36 rounded cursor-pointer" />` : ''}
                  ${m.audioBase64 ? `<audio controls src="${m.audioBase64}" class="w-full h-8"></audio>` : ''}
                  ${m.location ? `<a href="https://maps.google.com/?q=${m.location.lat},${m.location.lng}" target="_blank" class="text-sky-400 underline">📍 فتح اللوكيشن</a>` : ''}
                  ${m.text ? `<div class="text-white">${app.esc(m.text)}</div>` : ''}
                </div>`).join('')}
            </div>
            <form onsubmit="DamanAdmin.sendAdminIntervention(event)" class="flex gap-1.5">
              <input id="adm-chat-intervene" type="text" required placeholder="اكتب رسالة تدخل رسمية كإدارة ضمان سايت..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/50 text-xs text-white" />
              <button type="submit" class="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تدخّل</button>
            </form>
          </div>`;
      }

      const q = this.chatSearch.toLowerCase();
      const filtered = this.allChats.filter((c) => !q || (JSON.stringify(c.participantNames || {}) + ' ' + (c.lastMessage || '')).toLowerCase().includes(q));

      return `
        <div class="space-y-4">
          <div class="space-y-2">
            <h4 class="text-xs font-black text-amber-400"><i class="fa-solid fa-eye me-1"></i> مراقبة كل محادثات المستخدمين والموردين (${this.allChats.length})</h4>
            <input type="search" value="${app.esc(this.chatSearch)}" oninput="DamanAdmin.chatSearch=this.value; DamanAdmin.rerender()" placeholder="بحث باسم الطرفين أو نص الرسالة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            ${filtered.slice(0, 25).map((c) => `
              <div onclick="DamanAdmin.inspectChat('${c.id}')" class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-amber-500/50 cursor-pointer flex items-center justify-between gap-2 text-xs">
                <div class="min-w-0">
                  <div class="font-extrabold text-white truncate">${app.esc(Object.values(c.participantNames || {}).join(' ↔ ') || c.id)} ${c.frozen ? '🔒' : ''}</div>
                  <div class="text-[10px] text-slate-400 truncate">${app.esc(c.lastMessage || '')}</div>
                </div>
                <span class="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px] shrink-0">دخول ومراقبة</span>
              </div>`).join('') || '<div class="text-center text-xs text-slate-400 py-4">لا توجد محادثات</div>'}
          </div>

          <div class="space-y-2 pt-2 border-t border-slate-800">
            <h4 class="text-xs font-black text-emerald-400"><i class="fa-solid fa-microphone-lines me-1"></i> تسجيلات المكالمات (حذف تلقائي بعد 30 يوم) — (${this.recordings.length})</h4>
            ${!this.recordings.length ? '<div class="text-center text-xs text-slate-400 py-4">لا توجد تسجيلات حالياً</div>' : this.recordings.map((r) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border ${r.pinned ? 'border-amber-500/60' : 'border-slate-800'} space-y-2 text-xs">
                <div class="flex justify-between font-bold"><span class="text-white">${app.esc(r.callerName)} ↔ ${app.esc(r.otherName)}</span><span class="text-[10px] text-emerald-400">${r.durationSec || 0} ثانية</span></div>
                <audio controls src="${r.audioBase64}" class="w-full h-9"></audio>
                <div class="flex gap-1.5">
                  <button onclick="DamanAdmin.togglePinRecording('${r.id}',${!!r.pinned})" class="flex-1 py-1.5 rounded-lg ${r.pinned ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-300'} font-black text-[10px]">${r.pinned ? 'مثبّت (محمي)' : 'تثبيت لنزاع'}</button>
                  <button onclick="DamanAdmin.deleteRecording('${r.id}')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderContractsTab(app) {
      return `
        <div class="space-y-4">
          <div class="space-y-2">
            <h4 class="text-xs font-black text-amber-400">الاتفاقات والعقود الموقّعة والتوريدات B2B (${this.agreements.length})</h4>
            ${!this.agreements.length ? '<div class="text-center text-xs text-slate-400 py-4">لا توجد اتفاقات بعد</div>' : this.agreements.map((a) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border ${a.contractStatus === 'pending_admin' ? 'border-amber-500' : 'border-slate-800'} space-y-2 text-xs">
                <div class="flex justify-between font-black">
                  <span class="text-amber-300">${app.esc(a.ticketNumber)} • ${app.esc(a.type)} — ${app.esc(a.title)}</span>
                  <span class="text-emerald-400 shrink-0">${app.fmtMoney(a.totalAmount)} ج.م</span>
                </div>
                <div class="text-[10px] text-slate-300">المنفّذ/المورّد: ${app.esc(a.createdByName)} ↔ العميل: ${app.esc(a.payerName || a.otherName)} | تغطية: <b>${a.coveragePercent || 0}%</b> | متبقي بالضمان: <b>${app.fmtMoney(a.remainingEscrow)} ج.م</b></div>
                ${a.signedContractBase64 ? `
                  <div class="space-y-1">
                    <div class="text-[10px] text-sky-300 font-bold">صورة العقد الموقّع (${app.esc(a.contractStatus)}):</div>
                    <img src="${a.signedContractBase64}" onclick="window.open('${a.signedContractBase64}','_blank')" class="w-full max-h-36 object-contain rounded border border-slate-700 cursor-pointer" />
                    <div class="flex gap-1.5">
                      <button onclick="DamanAdmin.handleContractReview('${a.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد العقد وتفعيل الضمان ✅</button>
                      <button onclick="DamanAdmin.handleContractReview('${a.id}','rejected')" class="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>
                    </div>
                  </div>` : '<div class="text-[10px] text-slate-500">لم تُرفع صورة العقد الموقّع بعد</div>'}
                <div class="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800">
                  <button onclick="DamanAdmin.adminStopWorkOrder('${a.id}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[9px]">⚠️ أمر وقف عمل</button>
                  <button onclick="DamanAdmin.adminAgreementForceSettle('${a.id}','worker')" class="py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-[9px]">تحرير للمنفّذ</button>
                  <button onclick="DamanAdmin.adminAgreementForceSettle('${a.id}','payer')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[9px]">رد للعميل</button>
                </div>
              </div>`).join('')}
          </div>

          <div class="space-y-2 pt-2 border-t border-slate-800">
            <h4 class="text-xs font-black text-sky-400">مراقبة سجلات العمال (Site Ledger) (${this.ledgers.length})</h4>
            ${this.ledgers.slice(0, 20).map((l) => `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-[11px]">
                <div><b>${app.esc(l.workerName)}</b> (${app.esc(l.siteName)})<div class="text-[10px] text-slate-400">${app.esc(l.entryDate)} • ${app.esc(l.entryType)} — ${app.esc(l.notes || '')}</div></div>
                <span class="font-black text-amber-300">${app.fmtMoney(l.total)} ج.م</span>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderPostsTab(app) {
      return `
        <div class="space-y-4">
          <div class="space-y-2.5">
            ${this.posts.slice(0, 30).map((p) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border ${p.status === 'pending_review' ? 'border-purple-500' : 'border-slate-800'} space-y-2 text-xs">
                <div class="flex justify-between font-extrabold"><span class="text-white truncate">${app.esc(p.title)}</span><span class="text-[10px] text-amber-300 shrink-0">${app.esc(p.status)}</span></div>
                <div class="grid grid-cols-2 gap-1.5">
                  <select id="adm-cat-${p.id}" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-white">${window.DAMAN_CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === p.mainCategory ? 'selected' : ''}>${c.ar}</option>`).join('')}</select>
                  <select id="adm-ptype-${p.id}" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] text-white">
                    <option value="hiring" ${(p.postType || 'hiring') === 'hiring' ? 'selected' : ''}>صاحب عمل</option>
                    <option value="seeking" ${p.postType === 'seeking' ? 'selected' : ''}>باحث عن عمل</option>
                    <option value="supplier" ${p.postType === 'supplier' ? 'selected' : ''}>مورّد B2B</option>
                  </select>
                </div>
                <div class="grid grid-cols-4 gap-1">
                  <button onclick="DamanAdmin.approvePost('${p.id}')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد</button>
                  <button onclick="DamanAdmin.editPostQuick('${p.id}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">تعديل</button>
                  <button onclick="DamanAdmin.toggleFeatured('${p.id}',${!!p.isFeatured})" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">★ تمييز</button>
                  <button onclick="DamanAdmin.deletePost('${p.id}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
                </div>
              </div>`).join('')}
          </div>

          <div class="space-y-2 pt-2 border-t border-slate-800">
            <h4 class="text-xs font-black text-rose-400">مراقبة التقييمات (حذف التقييمات الكيدية) (${this.reviews.length})</h4>
            ${this.reviews.map((r) => `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center gap-2 text-xs">
                <div><div class="font-bold text-white">${app.esc(r.fromName || '')} — <span class="text-amber-400">${'★'.repeat(r.rating || 5)}</span></div><div class="text-[10px] text-slate-400">${app.esc(r.comment || '')}</div></div>
                <button onclick="DamanAdmin.deleteReview('${r.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold">حذف</button>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderWalletTab(app) {
      const activeUids = new Set();
      this.agreements.forEach((a) => { if (a.createdBy) activeUids.add(a.createdBy); if (a.payerUid) activeUids.add(a.payerUid); });

      return `<div class="space-y-2.5">${this.walletReqs.map((r) => {
        const fraudFlag = r.type === 'withdraw' && r.status === 'pending' && !activeUids.has(r.userId);
        return `
        <div class="p-3 rounded-xl bg-slate-950/90 border ${fraudFlag ? 'border-rose-500' : 'border-slate-800'} space-y-2 text-xs">
          ${fraudFlag ? `<div class="text-[10px] font-black text-rose-300 bg-rose-500/15 px-2 py-1 rounded-lg">⚠️ تنبيه أمان مالي: طلب سحب لحساب لم يُنفّذ أي اتفاقات بعد — راجعه جيداً</div>` : ''}
          <div class="flex justify-between font-black"><span class="${r.type === 'deposit' ? 'text-emerald-400' : 'text-sky-400'}">${r.type === 'deposit' ? 'إيداع' : 'سحب'} — ${app.fmtMoney(r.amount)} ج.م</span><span class="text-[10px] text-amber-300">${app.esc(r.status)}</span></div>
          <div class="text-[10px] text-slate-400">${app.esc(r.userName)} | ${app.esc(r.method)}</div>
          ${r.receiptBase64 ? `<img src="${r.receiptBase64}" onclick="window.open('${r.receiptBase64}','_blank')" class="w-full max-h-32 object-contain rounded border border-slate-700 cursor-pointer" />` : ''}
          <div class="flex gap-1.5">
            ${r.status === 'pending' ? `<button onclick="DamanAdmin.handleWalletReq('${r.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة</button><button onclick="DamanAdmin.handleWalletReq('${r.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>` : ''}
            ${r.status === 'approved' ? `<button onclick="DamanAdmin.handleWalletReq('${r.id}','reversed')" class="w-full py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-black text-[10px]">تراجع (Reverse)</button>` : ''}
          </div>
        </div>`;
      }).join('') || '<div class="text-center text-xs text-slate-400 py-5">لا توجد طلبات</div>'}</div>`;
    },

    renderKycTab(app) {
      return `<div class="space-y-2.5">${this.kycReqs.map((k) => `
        <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between font-extrabold"><span class="text-white">${app.esc(k.companyName || k.fullName)}</span><span class="text-[10px] text-sky-300">${app.esc(k.status)}</span></div>
          <div class="text-[10px] text-slate-400">قومي: ${app.esc(k.nationalId)} ${k.commercialReg ? '| س.ت: ' + app.esc(k.commercialReg) : ''} ${k.taxCardNumber ? '| ضريبية: ' + app.esc(k.taxCardNumber) : ''}</div>
          <div class="grid grid-cols-3 gap-1">${[k.idFrontBase64, k.selfieBase64, k.crPhotoBase64 || k.idBackBase64, k.taxPhotoBase64].filter(Boolean).map((img) => `<img src="${img}" onclick="window.open('${img}','_blank')" class="h-14 w-full object-cover rounded border border-slate-700 cursor-pointer" />`).join('')}</div>
          ${k.status === 'pending' ? `<div class="flex gap-1.5"><button onclick="DamanAdmin.handleKyc('${k.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد</button><button onclick="DamanAdmin.handleKyc('${k.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button></div>` : ''}
        </div>`).join('') || '<div class="text-center text-xs text-slate-400 py-5">لا توجد طلبات توثيق</div>'}</div>`;
    },

    renderVipTab(app) {
      return `
        <div class="space-y-4">
          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-rose-400">النزاعات (فصل كامل أو بنسبة مئوية) (${this.disputes.length})</h4>
            ${this.disputes.map((d) => `<div class="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-1.5 text-xs"><div class="font-bold text-white">${app.esc(d.projectTitle)} (${app.fmtMoney(d.contractAmount)} ج.م)</div><div class="text-[10px] text-rose-200">${app.esc(d.reason)}</div>${d.status === 'open' ? `<div class="grid grid-cols-3 gap-1"><button onclick="DamanAdmin.resolveDispute('${d.id}','client')" class="py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[9px]">100% عميل</button><button onclick="DamanAdmin.resolveDispute('${d.id}','split')" class="py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[9px]">تقسيم %</button><button onclick="DamanAdmin.resolveDispute('${d.id}','provider')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[9px]">100% منفّذ</button></div>` : `<div class="text-[10px] text-emerald-300">تم الفصل (${app.esc(d.resolution)})</div>`}</div>`).join('')}
          </div>

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-emerald-400">الاستلام الهندسي 3x (${this.inspReqs.length})</h4>
            ${this.inspReqs.map((r) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
                <div class="flex justify-between font-bold"><span class="text-white">${app.esc(r.packageLabel)}</span><span class="text-[10px] text-emerald-400">${r.status === 'collected' ? 'تم التحصيل للأرباح ✅' : app.esc(r.status)}</span></div>
                <div class="text-[10px] text-slate-400">${app.esc(r.area)} | ${app.esc(r.location)} | ${app.esc(r.phone)}</div>
                <div class="flex gap-1.5">
                  <button onclick="DamanAdmin.quoteInspection('${r.id}','${r.userId}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">تسعير (${r.quotedPrice ? app.fmtMoney(r.quotedPrice) + ' ج.م' : 'جديد'})</button>
                  ${r.quotedPrice && r.status !== 'collected' ? `<button onclick="DamanAdmin.collectInspectionFee('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">تحصيل وإضافة لأرباحي</button>` : ''}
                </div>
              </div>`).join('')}
          </div>

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-amber-400">عمالة VIP (عمولة 10%) (${this.vipLaborReqs.length})</h4>
            ${this.vipLaborReqs.map((r) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border ${r.status === 'funded' ? 'border-emerald-500/60' : 'border-slate-800'} space-y-1.5 text-xs">
                <div class="flex justify-between font-bold">
                  <span class="text-white">${app.esc(r.trade)} (${r.workersCount} عامل)</span>
                  <span class="text-[10px] ${r.status === 'funded' ? 'text-emerald-400' : 'text-amber-300'}">${r.status === 'funded' ? 'تم الحجز والدفع ✅' : r.status === 'quoted' ? 'بانتظار موافقة العميل' : 'طلب جديد'}</span>
                </div>
                <div class="text-[10px] text-slate-400">${app.esc(r.location)} | ${app.esc(r.duration)} | ${app.esc(r.phone)}</div>
                ${r.totalPrice ? `<div class="text-[10px] text-emerald-300 font-bold">أساسي: ${app.fmtMoney(r.baseCost)} + عمولتك 10%: ${app.fmtMoney(r.vipCommission)} = <b>${app.fmtMoney(r.totalPrice)} ج.م</b></div>` : ''}
                ${r.status !== 'funded' ? `<button onclick="DamanAdmin.replyVipLabor('${r.id}','${r.userId}')" class="w-full py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">${r.totalPrice ? 'تعديل التسعيرة (10%)' : 'تسعير الطلب وإضافة عمولة 10%'}</button>` : ''}
              </div>`).join('')}
          </div>

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-sky-400">تذاكر الدعم (${this.tickets.length})</h4>
            ${this.tickets.map((t) => `<div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-xs"><div class="font-bold text-white">${app.esc(t.subject)}</div><div class="text-[10px] text-slate-400">${app.esc(t.userName)}: ${app.esc(t.message)}</div><button onclick="DamanAdmin.replyTicket('${t.id}','${t.userId}')" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">رد وإغلاق</button></div>`).join('')}
          </div>
        </div>`;
    },

    renderUsersTab(app) {
      const q = this.userSearch.toLowerCase();
      const filtered = this.users.filter((u) => !q || (u.email + ' ' + u.name + ' ' + (u.phone || '') + ' ' + (u.companyName || '') + ' ' + (u.nationalId || '')).toLowerCase().includes(q));
      return `
        <div class="space-y-3">
          <input type="search" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالاسم أو الموبايل أو الإيميل أو الرقم القومي..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
          ${filtered.map((u) => `
            <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
              <div class="flex justify-between gap-2">
                <button onclick="DamanApp.openPublicProfile('${u.id}')" class="text-start min-w-0">
                  <div class="font-extrabold text-amber-300 underline truncate">${app.esc(u.companyName || u.name)} ${u.kycStatus === 'verified' ? '✅' : ''}</div>
                  <div class="text-[10px] text-slate-400 truncate">${app.getRoleLabel(u.accountType)} | ${app.esc(u.phone || '')} | ${app.esc(u.email)}</div>
                </button>
                <span class="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 shrink-0">${app.esc(u.status || 'active')}</span>
              </div>
              <div class="text-[10px] text-emerald-400 font-bold">متاح: ${app.fmtMoney(u.balanceAvailable)} | ضمان: ${app.fmtMoney(u.balanceEscrow)} | محجوز: ${app.fmtMoney(u.balanceHeld)} | دعوات: ${u.referralsCount || 0}</div>
              <div class="grid grid-cols-4 gap-1">
                <button onclick="DamanAdmin.editUserBalances3('${u.id}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[9px]">تعديل أرصدة</button>
                <button onclick="DamanAdmin.toggleUserKycQuick('${u.id}','${u.kycStatus || ''}')" class="py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[9px]">${u.kycStatus === 'verified' ? 'سحب توثيق' : 'توثيق فوري'}</button>
                <button onclick="DamanAdmin.grantCustomPlan('${u.id}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[9px]">باقة/هدية</button>
                <button onclick="DamanAdmin.changeUserRole('${u.id}')" class="py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-bold text-[9px]">نوع الحساب</button>
                <button onclick="DamanAdmin.sendPrivateNotif('${u.id}','${app.esc(u.name || '').replace(/'/g, "\\'")}')" class="py-1.5 rounded-lg bg-slate-800 text-amber-200 font-bold text-[9px]">إشعار خاص</button>
                <button onclick="DamanAdmin.setUserStatus('${u.id}','${u.status === 'frozen' ? 'active' : 'frozen'}')" class="py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold text-[9px]">${u.status === 'frozen' ? 'فك تجميد' : 'تجميد'}</button>
                <button onclick="DamanAdmin.setUserStatus('${u.id}','${u.status === 'banned' ? 'active' : 'banned'}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[9px]">${u.status === 'banned' ? 'فك حظر' : 'حظر'}</button>
                <button onclick="DamanAdmin.deleteUserDoc('${u.id}','${app.esc(u.name || '').replace(/'/g, "\\'")}')" class="py-1.5 rounded-lg bg-rose-900/50 text-rose-200 font-bold text-[9px]">حذف</button>
              </div>
            </div>`).join('')}
        </div>`;
    },

    renderCompaniesTab(app) {
      if (this.selectedCompanyHr) {
        const h = this.selectedCompanyHr;
        return `
          <div class="space-y-3 text-xs">
            <button onclick="DamanAdmin.selectedCompanyHr=null; DamanAdmin.rerender()" class="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-bold">← رجوع لقائمة الشركات والموردين</button>
            <h4 class="font-black text-sky-400">مراقبة HR والرواتب والعُهد وجروب: ${app.esc(h.companyName)}</h4>
            <div class="space-y-1.5">
              <div class="font-bold text-emerald-400">الحضور والانصراف (${h.attendance.length}):</div>
              ${h.attendance.map((a) => `<div class="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">${a.checkInSelfie ? `<img src="${a.checkInSelfie}" onclick="window.open('${a.checkInSelfie}','_blank')" class="w-8 h-8 rounded object-cover cursor-pointer" />` : ''}<div><b>${app.esc(a.memberName)}</b> (${app.esc(a.date)} • ${app.esc(a.siteName || '')}) — حضور ${a.checkInTime || '-'} / انصراف ${a.checkOutTime || '-'}</div></div>`).join('') || '<div class="text-slate-400">لا يوجد</div>'}
            </div>
            <div class="space-y-1.5">
              <div class="font-bold text-sky-300">كشوف الرواتب المصروفة (${h.payrolls.length}):</div>
              ${h.payrolls.map((p) => `<div class="p-2 rounded-lg bg-slate-950 border border-slate-800 flex justify-between"><span>${app.esc(p.memberName)} (${app.esc(p.monthKey)}) — ${app.esc(p.method)}</span><b class="text-emerald-400">${app.fmtMoney(p.netSalary)} ج.م</b></div>`).join('') || '<div class="text-slate-400">لا يوجد</div>'}
            </div>
            <div class="space-y-1.5">
              <div class="font-bold text-amber-400">سجل العُهد والفواتير (${h.custody.length}):</div>
              ${h.custody.map((c) => `<div class="p-2 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center"><span>${app.esc(c.notes)} (${app.esc(c.byName)}) ${c.invoiceBase64 ? `<a href="${c.invoiceBase64}" target="_blank" class="text-sky-400 underline ms-1">فاتورة</a>` : ''}</span><b>${app.fmtMoney(c.amount)} ج.م</b></div>`).join('') || '<div class="text-slate-400">لا يوجد</div>'}
            </div>
            <div class="space-y-1.5">
              <div class="font-bold text-purple-300">آخر رسائل جروب الشركة الداخلي (${h.groupMsgs.length}):</div>
              ${h.groupMsgs.map((m) => `<div class="p-2 rounded-lg bg-slate-950 border border-slate-800"><b class="text-amber-300">${app.esc(m.senderName)}:</b> ${app.esc(m.text)}</div>`).join('') || '<div class="text-slate-400">لا توجد رسائل</div>'}
            </div>
          </div>`;
      }
      return `
        <div class="space-y-2.5">
          <h4 class="text-xs font-black text-sky-400">الشركات والموردين (B2B) ومراقبة الـ HR (${this.companiesData.length})</h4>
          ${this.companiesData.map((c) => `
            <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
              <div class="flex justify-between font-black">
                <span class="text-white">${app.esc(c.companyName || c.name)} <span class="text-[9px] text-amber-300">(${app.getRoleLabel(c.accountType)})</span></span>
                <span class="text-sky-300 shrink-0">${(c.members || []).length} موظف</span>
              </div>
              <div class="text-[10px] text-slate-400">كود: ${app.esc(c.companyCode || '-')} | س.ت: ${app.esc(c.commercialReg || '-')} | هاتف: ${app.esc(c.phone || '')}</div>
              <button onclick="DamanAdmin.inspectCompanyHr('${c.id}','${app.esc(c.companyName || c.name).replace(/'/g, "\\'")}')" class="w-full py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">مراقبة الـ HR والرواتب والعُهد والجروب</button>
            </div>`).join('') || '<div class="text-center text-xs text-slate-400 py-5">لا توجد شركات أو موردين</div>'}
        </div>`;
    },

    renderSecurityTab(app) {
      return `
        <div class="space-y-4">
          <form onsubmit="DamanAdmin.addBlacklistItem(event)" class="glass-card rounded-2xl p-3 space-y-2 text-xs">
            <h4 class="font-black text-rose-400"><i class="fa-solid fa-ban me-1"></i> القائمة السوداء (حظر بالموبايل أو الرقم القومي أو السجل التجاري)</h4>
            <input id="bl-val" type="text" required placeholder="رقم الموبايل / الرقم القومي / السجل التجاري / الإيميل" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-white" />
            <input id="bl-reason" type="text" required placeholder="سبب الإدراج في القائمة السوداء" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-rose-500 text-white font-black">إضافة للقائمة السوداء</button>
          </form>
          ${this.blacklist.map((b) => `<div class="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex justify-between items-center text-xs"><div><b class="text-white">${app.esc(b.value)}</b><div class="text-[10px] text-rose-200">${app.esc(b.reason)}</div></div><button onclick="DamanAdmin.deleteBlacklistItem('${b.id}')" class="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px]">إزالة</button></div>`).join('')}

          <form onsubmit="DamanAdmin.addPromoCode(event)" class="glass-card rounded-2xl p-3 space-y-2 text-xs">
            <h4 class="font-black text-emerald-400"><i class="fa-solid fa-gift me-1"></i> أكواد الهدايا والتسويق (Promo Codes)</h4>
            <div class="grid grid-cols-2 gap-1.5">
              <input id="pr-code" type="text" required placeholder="الكود (مثال DAMAN30)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white uppercase font-bold" />
              <select id="pr-type" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"><option value="balance">رصيد هدية (ج.م)</option><option value="plan_individual">باقة أفراد (أيام)</option><option value="plan_company">باقة شركات (أيام)</option></select>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              <input id="pr-val" type="number" min="1" required placeholder="القيمة (مبلغ أو أيام)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="pr-max" type="number" min="1" value="100" placeholder="أقصى عدد مستخدمين" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">إنشاء كود هدية</button>
          </form>
          ${this.promos.map((p) => `<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-xs"><div><b class="text-emerald-300">${app.esc(p.code)}</b> (${app.esc(p.rewardType)}: ${p.value}) — استُخدم ${p.usedCount || 0}/${p.maxUses}</div><button onclick="DamanAdmin.deletePromoCode('${p.code}')" class="text-rose-400">حذف</button></div>`).join('')}

          <div class="glass-card rounded-2xl p-3 space-y-1.5">
            <h4 class="text-xs font-black text-slate-300">سجل عمليات الإدارة (Audit Log)</h4>
            ${this.logs.map((l) => `<div class="text-[10px] text-slate-400 border-b border-slate-800 pb-1"><b class="text-amber-300">${app.esc(l.action)}</b> — ${app.esc(l.details)}</div>`).join('') || '<div class="text-[10px] text-slate-500">لا توجد سجلات</div>'}
          </div>
        </div>`;
    },

    renderSettingsTab(app) {
      const cfg = app.appConfig || {};
      const pkgs = app.getPackages();
      const ratePct = (app.getCommissionRate() * 100).toFixed(1);
      const ads = (cfg.ads && cfg.ads.length ? cfg.ads : window.DAMAN_DEFAULT_ADS);

      return `
        <div class="space-y-4">
          <button onclick="DamanWallet.openConfigModal()" class="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-xs">تعديل بيانات الاستلام (المحفظة + رابط إنستا باي + البنك)</button>

          <form onsubmit="DamanAdmin.sendBroadcast(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <h4 class="text-xs font-extrabold text-amber-400">إرسال إشعار جماعي لكل المستخدمين الآن</h4>
            <input id="bc-title" type="text" required placeholder="عنوان الإشعار" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="bc-body" rows="2" required placeholder="نص الرسالة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">إرسال للجميع</button>
          </form>

          <form onsubmit="DamanAdmin.addSliderAd(event)" class="glass-card rounded-2xl p-3.5 space-y-2 text-xs">
            <h4 class="font-extrabold text-purple-400">إدارة سلايدر إعلانات الصفحة الرئيسية (${ads.length})</h4>
            <input id="ad-badge" type="text" placeholder="الشارة (مثال: عرض خاص)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <input id="ad-title" type="text" required placeholder="عنوان الإعلان" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <input id="ad-desc" type="text" required placeholder="وصف مختصر" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <input id="ad-link" type="url" placeholder="رابط خارجي (اختياري)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">إضافة إعلان للرئيسية</button>
            <div class="space-y-1 pt-1">${ads.map((a, i) => `<div class="flex justify-between items-center text-[10px] bg-slate-950 p-2 rounded-lg"><span class="truncate">${app.esc(a.titleAr || a.title)}</span><button type="button" onclick="DamanAdmin.deleteSliderAd(${i})" class="text-rose-400 font-bold">حذف</button></div>`).join('')}</div>
          </form>

          <form onsubmit="DamanAdmin.addDailyNotifItem(event)" class="glass-card rounded-2xl p-3.5 space-y-2 text-xs">
            <h4 class="font-extrabold text-amber-300">إضافة إشعار يومي (يتغير كل 24 ساعة)</h4>
            <input id="dn-title" type="text" required placeholder="عنوان النصيحة / التنبيه" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <input id="dn-body" type="text" required placeholder="النص..." class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-slate-800 text-amber-300 font-black">إضافة لقائمة الإشعارات اليومية</button>
          </form>

          <form onsubmit="DamanAdmin.saveGlobalSettings(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5 text-xs">
            <h4 class="font-black text-rose-400"><i class="fa-solid fa-power-off me-1"></i> مفاتيح الطوارئ والسيطرة الكاملة</h4>
            <label class="flex items-center justify-between text-rose-200 font-bold"><span>وضع الصيانة (إغلاق التطبيق مؤقتاً على الجميع غيرك)</span><input id="set-maint" type="checkbox" ${cfg.maintenanceMode ? 'checked' : ''} class="accent-rose-500 w-4 h-4" /></label>
            <input id="set-maint-msg" type="text" value="${app.esc(cfg.maintenanceMsg || 'التطبيق تحت التحديث والصيانة حالياً، سنعود خلال دقائق.')}" placeholder="رسالة الصيانة" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-200">
              <label><input id="set-no-calls" type="checkbox" ${cfg.disableCalls ? 'checked' : ''} class="accent-amber-500 me-1" />إيقاف المكالمات</label>
              <label><input id="set-no-with" type="checkbox" ${cfg.disableWithdrawals ? 'checked' : ''} class="accent-amber-500 me-1" />إيقاف السحب</label>
              <label><input id="set-no-dep" type="checkbox" ${cfg.disableDeposits ? 'checked' : ''} class="accent-amber-500 me-1" />إيقاف الإيداع</label>
              <label><input id="set-no-reg" type="checkbox" ${cfg.disableRegistration ? 'checked' : ''} class="accent-amber-500 me-1" />إيقاف التسجيل</label>
              <label><input id="set-no-post" type="checkbox" ${cfg.disablePosting ? 'checked' : ''} class="accent-amber-500 me-1" />إيقاف النشر</label>
              <label><input id="set-hide-demo" type="checkbox" ${cfg.hideDemoAds ? 'checked' : ''} class="accent-amber-500 me-1" />إخفاء الإعلانات المبدئية</label>
            </div>

            <div class="pt-2 border-t border-slate-800 space-y-2">
              <label class="block text-[11px] text-sky-300 font-bold">المشرفون الفرعيون (Sub-Admins — إيميلات مفصولة بفاصلة):</label>
              <input id="set-mods" type="text" value="${app.esc((cfg.moderators || []).join(', '))}" placeholder="mod1@gmail.com, mod2@gmail.com" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <label class="block text-[11px] text-emerald-300 font-bold">رقم واتساب الدعم الرسمي:</label>
              <input id="set-wa" type="text" value="${app.esc(cfg.supportWhatsapp || '201030374787')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <label class="block text-[11px] text-amber-300 font-bold">وصف خدمة الضمان 3x (يظهر في الرئيسية):</label>
              <textarea id="set-g3x" rows="2" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(cfg.guarantee3xText || 'نستلم الشدات، الأسقف، المحارة، التشطيبات، أو نمسك مشروعك كامل استشارات وإشراف هندسي بضمان مادي 3 أضعاف القيمة.')}</textarea>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div><label class="text-slate-400">العمولة (%)</label><input id="set-comm" type="number" step="0.1" value="${ratePct}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-slate-400">أقل رصيد لـ Access</label><input id="set-min-bal" type="number" value="${pkgs.minCompanyBalanceForAccess || 100}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div class="grid grid-cols-4 gap-1.5"><input id="set-ind-m1" type="number" value="${pkgs.individual.m1}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /><input id="set-ind-m3" type="number" value="${pkgs.individual.m3}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /><input id="set-ind-m6" type="number" value="${pkgs.individual.m6}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /><input id="set-ind-m12" type="number" value="${pkgs.individual.m12}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /></div>
            <div class="grid grid-cols-4 gap-1.5"><input id="set-cmp-m1" type="number" value="${pkgs.company.m1}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /><input id="set-cmp-m3" type="number" value="${pkgs.company.m3}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /><input id="set-cmp-m6" type="number" value="${pkgs.company.m6}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /><input id="set-cmp-m12" type="number" value="${pkgs.company.m12}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /></div>
            <div class="grid grid-cols-2 gap-2"><input id="set-feat-w" type="number" value="${pkgs.featured.week}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /><input id="set-feat-m" type="number" value="${pkgs.featured.month}" class="px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white" /></div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">حفظ كل الإعدادات ومفاتيح السيطرة</button>
          </form>
        </div>`;
    },

    render(container, app) {
      if (!this.hasAccess(app)) return (container.innerHTML = `<div class="p-6 text-center text-xs text-rose-400">غير مصرح بالدخول</div>`);
      if (!this.loaded) { this.loaded = true; this.loadTabData(app); }

      const tabs = [
        { id: 'overview', label: 'الإحصائيات' },
        { id: 'profits', label: 'خزنة الأرباح' },
        { id: 'chats', label: 'شات ومكالمات' },
        { id: 'contracts', label: 'العقود والسجل' },
        { id: 'posts', label: 'المنشورات' },
        { id: 'wallet', label: 'المحفظة' },
        { id: 'kyc', label: 'التوثيق' },
        { id: 'vip', label: 'ضمان ونزاعات' },
        { id: 'users', label: 'المستخدمين' },
        { id: 'companies', label: 'شركات وموردين' },
        { id: 'security', label: 'أمان وهدايا' },
        { id: 'settings', label: 'السيطرة' }
      ];

      const body =
        this.subTab === 'overview' ? this.renderOverviewTab(app)
        : this.subTab === 'profits' ? this.renderProfitsTab(app)
        : this.subTab === 'chats' ? this.renderChatsAndCallsTab(app)
        : this.subTab === 'contracts' ? this.renderContractsTab(app)
        : this.subTab === 'posts' ? this.renderPostsTab(app)
        : this.subTab === 'wallet' ? this.renderWalletTab(app)
        : this.subTab === 'kyc' ? this.renderKycTab(app)
        : this.subTab === 'vip' ? this.renderVipTab(app)
        : this.subTab === 'users' ? this.renderUsersTab(app)
        : this.subTab === 'companies' ? this.renderCompaniesTab(app)
        : this.subTab === 'security' ? this.renderSecurityTab(app)
        : this.renderSettingsTab(app);

      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-black text-amber-400"><i class="fa-solid fa-crown me-1.5"></i> ${this.isSuper(app) ? 'لوحة الإدارة العليا الشاملة' : 'لوحة المشرف الفرعي'}</h2>
            <button onclick="DamanAdmin.loadTabData(DamanApp, true)" class="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-white"><i class="fa-solid fa-rotate"></i></button>
          </div>
          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            ${tabs.map((t) => `<button onclick="DamanAdmin.setSubTab('${t.id}')" class="py-1.5 rounded-lg text-[9.5px] font-extrabold ${this.subTab === t.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${t.label}</button>`).join('')}
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanAdmin = AdminMod;
  if (window.DamanApp) window.DamanApp.registerModule('admin', AdminMod);
})();
