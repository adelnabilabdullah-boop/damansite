(function () {
  const AdminMod = {
    subTab: 'treasury',
    loading: false,
    initialized: false,
    lastErrors: [],

    periodFilter: 'all',
    userSearch: '',
    omniQuery: '',
    omniResults: null,
    pageLimits: { kyc: 20, wallet: 25, users: 30, comms: 25 },

    counts: { kyc: 0, dep: 0, wd: 0, signed: 0, disputes: 0, posts: 0, reports: 0, tickets: 0 },

    users: [],
    kycReqs: [],
    walletReqs: [],
    platformFees: [],
    adminExpenses: [],
    treasuryTransfers: [],
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
    auditLogs: [],
    mediaStats: null,

    dbCol: 'users',
    dbDocs: [],
    dbFilter: '',
    tempPayoutReceipts: {},
    unsubAdminChatWatch: null,

    detachListeners() {
      if (this.unsubAdminChatWatch) {
        try { this.unsubAdminChatWatch(); } catch (e) {}
        this.unsubAdminChatWatch = null;
      }
      this.initialized = false;
      this.loading = false;
      this.lastErrors = [];
      this.omniResults = null;
      this.users = [];
      this.kycReqs = [];
      this.walletReqs = [];
      this.platformFees = [];
      this.adminExpenses = [];
      this.treasuryTransfers = [];
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
      this.auditLogs = [];
      this.dbDocs = [];
      this.tempPayoutReceipts = {};
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'admin') {
        this.render(main, window.DamanApp);
      }
    },

    statusAr(st) {
      const map = {
        pending: 'قيد المراجعة ⏳', pending_review: 'قيد المراجعة ⏳', pending_admin: 'بانتظار اعتماد الإدارة ⏳',
        approved: 'معتمد ✅', verified: 'موثّق ✅', rejected: 'مرفوض ❌', cancelled: 'ملغى ↩️',
        draft: 'مسودة', funded: 'محجوز 100% ✅', paid: 'مدفوع ✅', quoted: 'تم التسعير 💰',
        settled: 'تمت التسوية 🏁', refunded: 'تم رد الضمان ↩️', completed: 'مكتمل 🏁',
        disputed: 'قيد النزاع ⚖️', open: 'مفتوح 🚨', closed: 'مغلق ✅', resolved: 'تم الفصل ⚖️',
        active: 'نشط ✅', banned: 'محظور 🚫', suspended: 'موقوف 🚫', none: 'غير موثّق'
      };
      return map[st] || st || '—';
    },

    channelAr(ch) {
      return { vodafone_cash: 'محفظة إلكترونية', instapay: 'إنستا باي', bank: 'تحويل بنكي' }[ch] || ch || '—';
    },

    setSubTab(t) {
      const app = window.DamanApp;
      if (['treasury', 'payments', 'settings', 'security', 'db', 'ads'].includes(t) && !app.isAdmin()) {
        return app.toast('هذا القسم للأدمن الرئيسي فقط', 'error');
      }
      if (!app.canMod(t) && !['ads', 'db'].includes(t)) {
        return app.toast('ليس لديك صلاحية لهذا القسم', 'error');
      }
      this.subTab = t;
      this.loadTabData(t);
    },

    loadMore(key) {
      this.pageLimits[key] = (this.pageLimits[key] || 20) + 20;
      this.loadTabData(this.subTab);
    },

    async safeDocs(queryPromise, label) {
      try {
        const snap = await queryPromise;
        return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      } catch (err) {
        this.lastErrors.push(`${label}: ${err.message || err.code || 'صلاحيات'}`);
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

    async refreshActionCounts(db) {
      try {
        const [k, w, a, d, p, r, t] = await Promise.all([
          this.safeDocs(db.collection('kycRequests').where('status', '==', 'pending').limit(50).get(), 'cnt_kyc'),
          this.safeDocs(db.collection('walletRequests').where('status', '==', 'pending').limit(60).get(), 'cnt_w'),
          this.safeDocs(db.collection('chatAgreements').where('contractStatus', '==', 'pending_admin').limit(40).get(), 'cnt_ag'),
          this.safeDocs(db.collection('disputes').where('status', '==', 'open').limit(40).get(), 'cnt_d'),
          this.safeDocs(db.collection('projects').where('status', '==', 'pending_review').limit(40).get(), 'cnt_p'),
          this.safeDocs(db.collection('reports').where('status', '==', 'open').limit(40).get(), 'cnt_r'),
          this.safeDocs(db.collection('supportTickets').where('status', '==', 'open').limit(40).get(), 'cnt_t')
        ]);
        this.counts = {
          kyc: k.length,
          dep: w.filter((x) => x.type === 'deposit').length,
          wd: w.filter((x) => x.type === 'withdraw').length,
          signed: a.length,
          disputes: d.length,
          posts: p.length,
          reports: r.length,
          tickets: t.length
        };
      } catch (e) {}
    },

    async loadTabData(tab) {
      const app = window.DamanApp;
      if (!app || !app.hasAdminAccess()) return;
      if (!app.isAdmin() && ['treasury', 'payments', 'settings', 'security', 'db', 'ads'].includes(tab)) {
        tab = 'kyc';
        this.subTab = 'kyc';
      }

      this.loading = true;
      this.lastErrors = [];
      this.initialized = true;
      this.rerender();

      const db = app.db;
      try {
        await this.refreshActionCounts(db);

        if (tab === 'treasury' || tab === 'payments') {
          const [u, f, e, w, tr] = await Promise.all([
            this.safeDocs(db.collection('users').limit(400).get(), 'المستخدمين'),
            this.safeDocs(db.collection('platformFees').limit(400).get(), 'الأرباح'),
            this.safeDocs(db.collection('adminExpenses').limit(250).get(), 'المصروفات'),
            this.safeDocs(db.collection('walletRequests').limit(450).get(), 'طلبات المحفظة'),
            this.safeDocs(db.collection('treasuryTransfers').limit(150).get(), 'التحويلات الداخلية')
          ]);
          this.users = u;
          this.platformFees = this.sortDesc(f);
          this.adminExpenses = this.sortDesc(e);
          this.walletReqs = this.sortDesc(w);
          this.treasuryTransfers = this.sortDesc(tr);
        } else if (tab === 'kyc') {
          this.kycReqs = this.sortDesc(await this.safeDocs(db.collection('kycRequests').limit(this.pageLimits.kyc || 20).get(), 'التوثيق'));
        } else if (tab === 'wallet') {
          this.walletReqs = this.sortDesc(await this.safeDocs(db.collection('walletRequests').limit(this.pageLimits.wallet || 25).get(), 'طلبات المحفظة'));
        } else if (tab === 'contracts') {
          const [a, d] = await Promise.all([
            this.safeDocs(db.collection('chatAgreements').limit(100).get(), 'العقود'),
            this.safeDocs(db.collection('disputes').limit(60).get(), 'النزاعات')
          ]);
          this.agreements = this.sortDesc(a);
          this.disputes = this.sortDesc(d);
        } else if (tab === 'market') {
          const [p, i, v] = await Promise.all([
            this.safeDocs(db.collection('projects').limit(120).get(), 'السوق'),
            this.safeDocs(db.collection('vipRequests').limit(60).get(), 'الاستلام 3x'),
            this.safeDocs(db.collection('vipLaborRequests').limit(60).get(), 'عمالة VIP')
          ]);
          this.projects = this.sortDesc(p);
          this.inspections = this.sortDesc(i);
          this.vipLabors = this.sortDesc(v);
        } else if (tab === 'companies') {
          this.companies = this.sortDesc(await this.safeDocs(db.collection('companies').limit(100).get(), 'الشركات'));
        } else if (tab === 'users') {
          const [u, r, b, p] = await Promise.all([
            this.safeDocs(db.collection('users').limit(this.pageLimits.users || 30).get(), 'المستخدمين'),
            this.safeDocs(db.collection('reports').limit(50).get(), 'البلاغات'),
            this.safeDocs(db.collection('blacklist').limit(120).get(), 'القائمة السوداء'),
            this.safeDocs(db.collection('promoCodes').limit(60).get(), 'أكواد الهدايا')
          ]);
          this.users = this.sortDesc(u);
          this.reports = this.sortDesc(r);
          this.blacklist = this.sortDesc(b);
          this.promoCodes = p;
        } else if (tab === 'comms') {
          const [c, r, t] = await Promise.all([
            this.safeDocs(db.collection('chats').limit(this.pageLimits.comms || 25).get(), 'المحادثات'),
            this.safeDocs(db.collection('callRecordings').limit(this.pageLimits.comms || 25).get(), 'التسجيلات'),
            this.safeDocs(db.collection('supportTickets').limit(50).get(), 'التذاكر')
          ]);
          this.chats = this.sortDesc(c);
          this.callRecordings = this.sortDesc(r);
          this.tickets = this.sortDesc(t);
        } else if (tab === 'security') {
          const [al, mv] = await Promise.all([
            this.safeDocs(db.collection('auditLogs').limit(80).get(), 'سجل الرقابة'),
            this.safeDocs(db.collection('mediaVault').limit(200).get(), 'خزنة المرفقات')
          ]);
          this.auditLogs = this.sortDesc(al);
          this.mediaStats = {
            total: mv.length,
            recordings: mv.filter((x) => x.kind === 'call_audio').length,
            receipts: mv.filter((x) => String(x.kind || '').includes('receipt')).length,
            kyc: mv.filter((x) => String(x.kind || '').startsWith('kyc_')).length
          };
        } else if (tab === 'db') {
          this.dbDocs = this.sortDesc(await this.safeDocs(db.collection(this.dbCol).limit(60).get(), this.dbCol));
        }
      } finally {
        this.loading = false;
        this.rerender();
      }
    },

    // ==================== OMNI-SEARCH ====================
    async runOmniSearch(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const q = (document.getElementById('adm-omni-q')?.value || '').trim();
      this.omniQuery = q;
      if (!q) { this.omniResults = null; return this.rerender(); }

      const db = app.db;
      const qUp = q.toUpperCase();
      const qNorm = app.normalizeAr(q);
      app.toast('جارٍ البحث الشامل...', 'info');

      try {
        const [uSnap, wSnap, aSnap, cSnap] = await Promise.all([
          db.collection('users').limit(250).get(),
          db.collection('walletRequests').limit(200).get(),
          db.collection('chatAgreements').limit(150).get(),
          db.collection('companies').limit(100).get()
        ]);

        const users = uSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((u) => app.normalizeAr(`${u.name} ${u.legalName} ${u.phone} ${u.nationalId} ${u.email}`).includes(qNorm)).slice(0, 6);
        const wallets = wSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((w) => String(w.txRef || '').toUpperCase().includes(qUp) || app.normalizeAr(`${w.userName} ${w.senderAccount} ${w.destAccount}`).includes(qNorm)).slice(0, 6);
        const contracts = aSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((a) => String(a.ticketNumber || '').toUpperCase().includes(qUp) || app.normalizeAr(`${a.title} ${a.payerName} ${a.providerName}`).includes(qNorm)).slice(0, 6);
        const companies = cSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()))
          .filter((c) => String(c.code || '').toUpperCase().includes(qUp) || app.normalizeAr(`${c.name} ${c.ownerName}`).includes(qNorm)).slice(0, 5);

        this.omniResults = { users, wallets, contracts, companies };
        this.rerender();
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== 1. TREASURY & TRIAL BALANCE ====================
    inPeriod(dateStr) {
      if (this.periodFilter === 'all' || !dateStr) return true;
      const today = window.DamanApp.todayLocal();
      if (this.periodFilter === 'today') return dateStr === today;
      const diffDays = Math.floor((new Date(today + 'T12:00:00') - new Date(dateStr + 'T12:00:00')) / 86400000);
      if (this.periodFilter === '7d') return diffDays >= 0 && diffDays <= 7;
      if (this.periodFilter === '30d') return diffDays >= 0 && diffDays <= 30;
      return true;
    },

    calcAccountingSummary(app) {
      const opening = app.appConfig?.openingBalances || {};
      const today = app.todayLocal();

      let usersAvail = 0, usersEscrow = 0, usersHoldW = 0, usersFrozen = 0, usersBonus = 0;
      this.users.forEach((u) => {
        usersAvail += Number(u.balanceAvailable || 0);
        usersEscrow += Number(u.balanceEscrow || 0);
        usersHoldW += Number(u.balancePendingWithdraw || 0);
        usersFrozen += Number(u.balanceFrozen || 0);
        usersBonus += Number(u.balanceBonus || 0);
      });
      const totalUsersTrust = Math.round((usersAvail + usersEscrow + usersHoldW + usersFrozen) * 100) / 100;

      let grossCashProfitAll = 0;
      this.platformFees.forEach((f) => {
        grossCashProfitAll += f.cashPaid != null ? Number(f.cashPaid) : Number(f.amount || 0);
      });

      let totalExpensesAll = 0;
      const channels = {
        vodafone_cash: { open: Number(opening.vodafone_cash || 0), dep: 0, wd: 0, exp: 0, trIn: 0, trOut: 0, todayIn: 0 },
        instapay: { open: Number(opening.instapay || 0), dep: 0, wd: 0, exp: 0, trIn: 0, trOut: 0, todayIn: 0 },
        bank: { open: Number(opening.bank || 0), dep: 0, wd: 0, exp: 0, trIn: 0, trOut: 0, todayIn: 0 }
      };

      this.adminExpenses.forEach((x) => {
        const amt = Number(x.amount || 0);
        totalExpensesAll += amt;
        if (x.channel && channels[x.channel]) channels[x.channel].exp += amt;
      });

      this.walletReqs.forEach((r) => {
        if (r.status !== 'approved') return;
        const ch = channels[r.channel] ? r.channel : 'vodafone_cash';
        if (r.type === 'deposit') {
          const val = Number(r.actualAmount != null ? r.actualAmount : r.amount || 0);
          channels[ch].dep += val;
          if (r.date === today) channels[ch].todayIn += val;
        } else if (r.type === 'withdraw') {
          channels[ch].wd += Number(r.netPayout != null ? r.netPayout : r.amount || 0);
        }
      });

      this.treasuryTransfers.forEach((tr) => {
        const amt = Number(tr.amount || 0);
        if (channels[tr.fromChannel]) channels[tr.fromChannel].trOut += amt;
        if (channels[tr.toChannel]) channels[tr.toChannel].trIn += amt;
      });

      let actualChannelsTotal = 0;
      ['vodafone_cash', 'instapay', 'bank'].forEach((k) => {
        const c = channels[k];
        c.net = Math.round((c.open + c.dep - c.wd - c.exp + c.trIn - c.trOut) * 100) / 100;
        actualChannelsTotal += c.net;
      });
      actualChannelsTotal = Math.round(actualChannelsTotal * 100) / 100;

      const totalOpening = Math.round((channels.vodafone_cash.open + channels.instapay.open + channels.bank.open) * 100) / 100;
      const netCashProfitAll = Math.round((grossCashProfitAll - totalExpensesAll) * 100) / 100;
      const expectedTotalCash = Math.round((totalOpening + totalUsersTrust + netCashProfitAll) * 100) / 100;
      const trialDiff = Math.round((actualChannelsTotal - expectedTotalCash) * 100) / 100;

      const periodFees = this.platformFees.filter((f) => this.inPeriod(f.date))
        .reduce((s, f) => s + (f.cashPaid != null ? Number(f.cashPaid) : Number(f.amount || 0)), 0);
      const periodExp = this.adminExpenses.filter((x) => this.inPeriod(x.date))
        .reduce((s, x) => s + Number(x.amount || 0), 0);
      const periodDep = this.walletReqs.filter((r) => r.status === 'approved' && r.type === 'deposit' && this.inPeriod(r.date))
        .reduce((s, r) => s + Number(r.actualAmount != null ? r.actualAmount : r.amount || 0), 0);
      const periodWd = this.walletReqs.filter((r) => r.status === 'approved' && r.type === 'withdraw' && this.inPeriod(r.date))
        .reduce((s, r) => s + Number(r.netPayout != null ? r.netPayout : r.amount || 0), 0);

      return {
        usersAvail, usersEscrow, usersHoldW, usersFrozen, usersBonus, totalUsersTrust,
        grossCashProfitAll, totalExpensesAll, netCashProfitAll,
        channels, actualChannelsTotal, expectedTotalCash, trialDiff,
        periodDep: Math.round(periodDep * 100) / 100,
        periodWd: Math.round(periodWd * 100) / 100,
        periodNet: Math.round((periodFees - periodExp) * 100) / 100
      };
    },

    async recordAdminExpense(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const amount = Math.round((parseFloat(document.getElementById('ae-amt').value) || 0) * 100) / 100;
      const category = document.getElementById('ae-cat').value;
      const channel = document.getElementById('ae-ch').value;
      const note = document.getElementById('ae-note').value.trim();
      if (amount <= 0 || !note) return;

      await app.db.collection('adminExpenses').add({
        amount, category, channel, note, date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await app.logAudit('admin_expense', `${category} بمبلغ ${amount} ج.م من ${channel}: ${note}`);
      e.target.reset();
      app.toast('تم الخصم من خزنة الأرباح وجرد القناة بنجاح ✅', 'success');
      this.loadTabData('treasury');
    },

    async recordTreasuryTransfer(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const fromChannel = document.getElementById('tt-from').value;
      const toChannel = document.getElementById('tt-to').value;
      const amount = Math.round((parseFloat(document.getElementById('tt-amt').value) || 0) * 100) / 100;
      const fee = Math.round((parseFloat(document.getElementById('tt-fee').value) || 0) * 100) / 100;
      const note = document.getElementById('tt-note').value.trim() || 'تحويل داخلي بين حسابات المنصة';
      if (fromChannel === toChannel) return app.toast('اختر قناتين مختلفتين للتحويل', 'warning');
      if (amount <= 0) return;

      await app.db.collection('treasuryTransfers').add({
        fromChannel, toChannel, amount, fee, note, date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (fee > 0) {
        await app.db.collection('adminExpenses').add({
          amount: fee, category: 'transfer_fee', channel: fromChannel,
          note: `رسوم تحويل داخلي (${fromChannel} → ${toChannel})`, date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      await app.logAudit('treasury_transfer', `تحويل داخلي ${amount} ج.م من ${fromChannel} إلى ${toChannel}`);
      e.target.reset();
      app.toast('تم تسجيل التحويل الداخلي وضبط جرد القنوات ✅', 'success');
      this.loadTabData('treasury');
    },

    printFinancialReportA4() {
      const app = window.DamanApp;
      const s = this.calcAccountingSummary(app);
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div><h2 style="margin:0; font-size:16px;">التقرير المالي وميزان المراجعة — ${app.esc(app.t('appName'))}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table style="margin-bottom:12px;">
            <tr><th>متاح المستخدمين</th><td>${app.fmtMoney(s.usersAvail)} ج.م</td><th>محجوز بالضمان</th><td>${app.fmtMoney(s.usersEscrow)} ج.م</td></tr>
            <tr><th>قيد السحب / المجمّد</th><td>${app.fmtMoney(s.usersHoldW)} / ${app.fmtMoney(s.usersFrozen)} ج.م</td><th>إجمالي أمانات الناس</th><td><b>${app.fmtMoney(s.totalUsersTrust)} ج.م</b></td></tr>
            <tr><th>إجمالي أرباح الكاش</th><td>${app.fmtMoney(s.grossCashProfitAll)} ج.م</td><th>مصروفات ومسحوبات الإدارة</th><td>${app.fmtMoney(s.totalExpensesAll)} ج.م</td></tr>
            <tr><th>صافي خزنة الأرباح</th><td><b>${app.fmtMoney(s.netCashProfitAll)} ج.م</b></td><th>حالة ميزان المراجعة</th><td><b>${Math.abs(s.trialDiff) < 1 ? 'مطابق 100%' : 'فرق: ' + app.fmtMoney(s.trialDiff) + ' ج.م'}</b></td></tr>
          </table>
          <table>
            <thead><tr><th>القناة</th><th>افتتاحي</th><th>إيداعات (+)</th><th>سحوبات (-)</th><th>مصروفات (-)</th><th>تحويل داخلي</th><th>الصافي الفعلي</th></tr></thead>
            <tbody>
              ${[['vodafone_cash', 'محافظ كاش'], ['instapay', 'إنستا باي'], ['bank', 'التحويل البنكي']].map(([k, lbl]) => {
                const c = s.channels[k];
                return `<tr><td><b>${lbl}</b></td><td>${app.fmtMoney(c.open)}</td><td>${app.fmtMoney(c.dep)}</td><td>${app.fmtMoney(c.wd)}</td><td>${app.fmtMoney(c.exp)}</td><td>${app.fmtMoney(c.trIn - c.trOut)}</td><td><b>${app.fmtMoney(c.net)} ج.م</b></td></tr>`;
              }).join('')}
              <tr><th colspan="6">إجمالي النقدية الفعلية في القنوات</th><th>${app.fmtMoney(s.actualChannelsTotal)} ج.م</th></tr>
            </tbody>
          </table>
        </div>`);
    },

    exportAccountingCsv() {
      const app = window.DamanApp;
      const escCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const lines = [['التاريخ', 'النوع', 'القناة', 'المستخدم/البيان', 'المبلغ (ج.م)', 'الحالة'].map(escCsv).join(',')];
      this.walletReqs.forEach((r) => lines.push([r.date || '', r.type, r.channel, `${r.userName} (${r.txRef || r.destAccount || ''})`, r.actualAmount || r.amount, r.status].map(escCsv).join(',')));
      this.platformFees.forEach((f) => lines.push([f.date || '', 'profit_' + f.type, 'vault', f.userName || f.ticketNumber || '', f.cashPaid != null ? f.cashPaid : f.amount, 'approved'].map(escCsv).join(',')));
      this.adminExpenses.forEach((e) => lines.push([e.date || '', 'expense_' + e.category, e.channel || 'none', e.note, -Math.abs(Number(e.amount || 0)), 'approved'].map(escCsv).join(',')));
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `damansite-accounting-${app.todayLocal()}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.toast('تم تصدير دفتر الحسابات Excel/CSV ✅', 'success');
    },

    // ==================== 2. DETAILED PAYMENT SWITCHBOARD ====================
    async savePaymentSwitchboard(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;

      const parseLines = (id) => (document.getElementById(id)?.value || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const bankName = document.getElementById('sw-bk-name').value.trim();
      const bankHolder = document.getElementById('sw-bk-holder').value.trim();
      const bankAccount = document.getElementById('sw-bk-acc').value.trim();
      const bankIban = document.getElementById('sw-bk-iban').value.trim();

      const patch = {
        depositChannels: {
          vodafone_cash: document.getElementById('sw-dep-vf').checked,
          instapay: document.getElementById('sw-dep-ip').checked,
          bank: document.getElementById('sw-dep-bk').checked
        },
        withdrawChannels: {
          vodafone_cash: document.getElementById('sw-wd-vf').checked,
          instapay: document.getElementById('sw-wd-ip').checked,
          bank: document.getElementById('sw-wd-bk').checked
        },
        paymentAccounts: {
          vodafoneCash: document.getElementById('sw-vf-num').value.trim(),
          vodafoneHolder: document.getElementById('sw-vf-holder').value.trim(),
          instaPayLink: document.getElementById('sw-ip-link').value.trim(),
          instaPay: document.getElementById('sw-ip-addr').value.trim(),
          instaPayHolder: document.getElementById('sw-ip-holder').value.trim(),
          bankName,
          bankHolder,
          bankAccount,
          bankIban,
          bankInfo: `${bankName} — ${bankHolder} — ${bankAccount}`.trim()
        },
        backupAccounts: {
          vodafoneCash: parseLines('sw-bkup-vf'),
          instaPay: parseLines('sw-bkup-ip'),
          bank: parseLines('sw-bkup-bk')
        },
        openingBalances: {
          vodafone_cash: parseFloat(document.getElementById('sw-open-vf').value) || 0,
          instapay: parseFloat(document.getElementById('sw-open-ip').value) || 0,
          bank: parseFloat(document.getElementById('sw-open-bk').value) || 0
        },
        depositSessionMinutes: parseInt(document.getElementById('sw-mins').value, 10) || 10,
        minDeposit: parseFloat(document.getElementById('sw-mindep').value) || 100,
        maxDeposit: parseFloat(document.getElementById('sw-maxdep').value) || 250000,
        minWithdraw: parseFloat(document.getElementById('sw-minwd').value) || 100,
        maxWithdrawDaily: parseFloat(document.getElementById('sw-maxwd').value) || 50000,
        channelWithdrawFees: {
          vodafone_cash: { pct: document.getElementById('sw-fee-vf-p').value, flat: document.getElementById('sw-fee-vf-f').value },
          instapay: { pct: document.getElementById('sw-fee-ip-p').value, flat: document.getElementById('sw-fee-ip-f').value },
          bank: { pct: document.getElementById('sw-fee-bk-p').value, flat: document.getElementById('sw-fee-bk-f').value }
        }
      };

      await app.db.collection('settings').doc('appConfig').set(patch, { merge: true });
      await app.logAudit('payment_switchboard', `تحديث حسابات الدفع: VF=${patch.paymentAccounts.vodafoneCash}, Bank=${bankName}`);
      app.toast('تم تحديث حسابات الدفع (المحفظة + البنك + لينك إنستا باي) فوراً ✅', 'success');
    },

    async quickActivateBackup(channelKey, val) {
      const app = window.DamanApp;
      if (!app.isAdmin() || !val) return;
      const curAcc = Object.assign({}, app.appConfig?.paymentAccounts || {});
      if (channelKey === 'vodafoneCash') curAcc.vodafoneCash = val;
      else if (channelKey === 'instaPay') {
        if (val.startsWith('http')) curAcc.instaPayLink = val;
        else curAcc.instaPay = val;
      } else curAcc.bankAccount = val;
      await app.db.collection('settings').doc('appConfig').set({ paymentAccounts: curAcc }, { merge: true });
      await app.logAudit('quick_rotate_account', `تبديل سريع (${channelKey}) → ${val}`);
      app.toast(`تم تفعيل الحساب النشط فوراً: ${val} ✅`, 'success');
    },

    // ==================== 3. WALLET REQUESTS ====================
    async handlePayoutReceiptFile(input, reqId) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this.tempPayoutReceipts[reqId] = await window.DamanApp.compressImage(f, 760, 0.56);
        const slot = document.getElementById('adm-pout-prev-' + reqId);
        if (slot) slot.innerHTML = `<span class="text-emerald-400 font-bold">✅ تم إرفاق إيصال التحويل</span>`;
      } catch (e) {}
    },

    async handleWalletReq(reqId, action) {
      const app = window.DamanApp;
      const req = this.walletReqs.find((r) => r.id === reqId);
      if (!req) return;

      let adminNote = '';
      let actualAmount = Number(req.amount || 0);
      let transferCost = 0;

      if (action === 'reject') {
        adminNote = window.prompt('سبب الرفض (سيظهر للمستخدم):', 'بيانات التحويل غير مطابقة أو لم يصل المبلغ');
        if (adminNote === null) return;
      } else if (req.type === 'deposit') {
        const inpVal = parseFloat(document.getElementById('adm-act-amt-' + reqId)?.value);
        actualAmount = !isNaN(inpVal) && inpVal > 0 ? Math.round(inpVal * 100) / 100 : Number(req.amount || 0);
        const diffMsg = actualAmount !== Number(req.amount) ? `\n⚠️ تم تعديل المبلغ الواصل إلى ${app.fmtMoney(actualAmount)} ج.م` : '';
        if (!window.confirm(`تأكيد اعتماد إيداع ${app.fmtMoney(actualAmount)} ج.م لحساب ${req.userName}؟${diffMsg}`)) return;
      } else {
        transferCost = Math.max(0, Math.round((parseFloat(document.getElementById('adm-tr-cost-' + reqId)?.value) || 0) * 100) / 100);
        if (!window.confirm(`تأكيد أنك حوّلت صافي السحب (${app.fmtMoney(req.netPayout || req.amount)} ج.م) إلى ${req.destAccount}؟`)) return;
      }

      await app.withLock('wReq_' + reqId, async () => {
        const reqRef = app.db.collection('walletRequests').doc(reqId);
        const userRef = app.db.collection('users').doc(req.userId);
        try {
          let payoutReceiptMedia = '';
          if (action === 'approve' && req.type === 'withdraw' && this.tempPayoutReceipts[reqId]) {
            payoutReceiptMedia = await app.saveMedia(this.tempPayoutReceipts[reqId], { kind: 'payout_receipt' });
          }

          await app.db.runTransaction(async (tx) => {
            const [rDoc, uDoc] = await Promise.all([tx.get(reqRef), tx.get(userRef)]);
            if (!rDoc.exists || rDoc.data().status !== 'pending') throw new Error('تمت معالجة هذا الطلب مسبقاً!');
            const r = rDoc.data();
            const u = uDoc.data() || {};
            const curAvail = Number(u.balanceAvailable || 0);
            const curHold = Number(u.balancePendingWithdraw || 0);
            const amt = Number(r.amount || 0);

            if (r.type === 'deposit') {
              if (action === 'approve') {
                const afterAvail = Math.round((curAvail + actualAmount) * 100) / 100;
                tx.update(userRef, { balanceAvailable: afterAvail });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'deposit_approved', amount: actualAmount,
                  balanceBefore: curAvail, balanceAfter: afterAvail,
                  note: `شحن محفظة معتمد (${this.channelAr(r.channel)} — مرجع ${r.txRef || ''})`,
                  date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
              tx.update(reqRef, {
                status: action === 'approve' ? 'approved' : 'rejected',
                actualAmount: action === 'approve' ? actualAmount : amt,
                adminNote: actualAmount !== amt && action === 'approve' ? `تم اعتماد المبلغ الواصل فعلياً (${app.fmtMoney(actualAmount)} ج.م)` : adminNote,
                processedBy: app.user.email, processedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            } else {
              if (action === 'approve') {
                if (curHold < amt - 0.01) throw new Error('الرصيد المحجوز للسحب لا يكفي!');
                tx.update(userRef, { balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100) });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'withdraw_paid', amount: 0, balanceBefore: curAvail, balanceAfter: curAvail,
                  note: `تم تحويل السحب (${app.fmtMoney(r.netPayout || amt)} ج.م إلى ${r.destAccount})`,
                  date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                const wFee = Number(r.withdrawFee || 0);
                if (wFee > 0) {
                  tx.set(app.db.collection('platformFees').doc(), {
                    type: 'withdraw_fee', requestId: reqId, userId: r.userId, userName: r.userName || '',
                    amount: wFee, cashPaid: wFee, bonusUsed: 0, date: app.todayLocal(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                }
                if (transferCost > 0) {
                  tx.set(app.db.collection('adminExpenses').doc(), {
                    amount: transferCost, category: 'transfer_fee', channel: r.channel || 'vodafone_cash',
                    note: `رسوم تحويل سحب للمستخدم ${r.userName}`, date: app.todayLocal(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                  });
                }
              } else {
                const afterAvail = Math.round((curAvail + amt) * 100) / 100;
                tx.update(userRef, { balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100), balanceAvailable: afterAvail });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'withdraw_refund', amount: amt, balanceBefore: curAvail, balanceAfter: afterAvail,
                  note: `رد مبلغ سحب مرفوض: ${adminNote}`, date: app.todayLocal(),
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
              tx.update(reqRef, {
                status: action === 'approve' ? 'approved' : 'rejected',
                adminTransferCost: transferCost, payoutReceiptMedia, adminNote,
                processedBy: app.user.email, processedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });

          if (req.type === 'deposit' && req.txRef) {
            const refKey = String(req.txRef).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 80);
            if (refKey) {
              app.db.collection('txRefIndex').doc(refKey).set({ txRef: req.txRef, status: action === 'approve' ? 'approved' : 'rejected' }, { merge: true }).catch(() => {});
            }
          }

          delete this.tempPayoutReceipts[reqId];
          await app.logAudit(`wallet_${req.type}_${action}`, `${req.userName} — ${app.fmtMoney(actualAmount)} ج.م`, reqId);
          await app.sendNotification(req.userId, action === 'approve' ? '✅ تم تنفيذ طلب المحفظة' : '❌ تم رفض طلب المحفظة', action === 'approve' ? `المبلغ: ${app.fmtMoney(req.type === 'deposit' ? actualAmount : (req.netPayout || req.amount))} ج.م` : adminNote);
          app.toast('تم تنفيذ العملية بدقة ✅', 'success');
          this.loadTabData('wallet');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 4. KYC & 5. CONTRACTS / DISPUTES ====================
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
        if (legalName.split(/\s+/).length < 3) return app.toast('اكتب الاسم الرباعي بالكامل', 'warning');

        const dupSnap = await app.db.collection('users').where('nationalId', '==', parsed.nid).limit(2).get();
        if (dupSnap.docs.some((d) => d.id !== uid)) return app.toast('⚠️ هذا الرقم القومي موثّق بالفعل لحساب آخر!', 'error');

        const patch = { kycStatus: 'verified', kycRejectionReason: '', legalName, nationalId: parsed.nid, birthDate: parsed.birthDate, legalAddress, kycVerifiedAt: Date.now() };
        if (compName) patch.companyName = compName;
        if (cr) patch.commercialReg = cr;
        if (tax) patch.taxCard = tax;

        await app.db.collection('users').doc(uid).update(patch);
        await app.db.collection('kycRequests').doc(uid).update({ status: 'approved', legalName, nationalId: parsed.nid, birthDate: parsed.birthDate, legalAddress, reviewedAt: firebase.firestore.FieldValue.serverTimestamp(), reviewedBy: app.user.email });
        await app.logAudit('kyc_approve', `توثيق ${legalName} (${parsed.nid})`, uid);
        await app.sendNotification(uid, '✅ تم توثيق حسابك وتثبيت بياناتك القانونية!', 'يمكنك الآن استخدام المحفظة والسوق والعقود.');
        app.toast('تم اعتماد التوثيق ✅', 'success');
        this.loadTabData('kyc');
      });
    },

    async rejectKyc(uid) {
      const app = window.DamanApp;
      const reason = window.prompt('سبب الرفض:', 'صور البطاقة أو السيلفي غير واضحة');
      if (!reason) return;
      await app.db.collection('users').doc(uid).update({ kycStatus: 'rejected', kycRejectionReason: reason.trim() });
      await app.db.collection('kycRequests').doc(uid).update({ status: 'rejected', rejectionReason: reason.trim() });
      await app.logAudit('kyc_reject', reason.trim(), uid);
      await app.sendNotification(uid, '❌ تم رفض مستندات التوثيق', reason.trim());
      app.toast('تم الرفض', 'info');
      this.loadTabData('kyc');
    },

    openContractAdminModal(agId) {
      const app = window.DamanApp;
      const a = this.agreements.find((x) => x.id === agId);
      if (!a) return;
      let m = document.getElementById('daman-adm-ct-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-adm-ct-modal';
        m.className = 'daman-modal fixed inset-0 z-[92] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">📄 إدارة وتعديل العقد: ${app.esc(a.ticketNumber)}</h3><button onclick="document.getElementById('daman-adm-ct-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
            <div>صاحب العمل: <b class="text-white">${app.esc(a.payerLegalName || a.payerName)}</b> (قومي: ${app.esc(a.payerNationalId || '—')})</div>
            <div>المنفّذ: <b class="text-white">${app.esc(a.providerLegalName || a.providerName)}</b> (قومي: ${app.esc(a.providerNationalId || '—')})</div>
            <div>القيمة: <b class="text-emerald-400">${app.fmtMoney(a.totalAmount)} ج.م</b> | المتبقي: <b class="text-amber-300">${app.fmtMoney(a.remainingEscrow || 0)} ج.م</b></div>
          </div>
          <form onsubmit="DamanAdmin.saveContractAdminEdit(event,'${a.id}')" class="space-y-2">
            <div><label class="text-[10px] text-slate-400">عنوان البند</label><input id="act-title" type="text" required value="${app.esc(a.title || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-slate-400">تاريخ البداية</label><input id="act-start" type="date" value="${app.esc(a.startDate || a.date || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[10px] text-slate-400">تاريخ التسليم</label><input id="act-end" type="date" value="${app.esc(a.endDate || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div><label class="text-[10px] text-slate-400">موقع التنفيذ</label><input id="act-loc" type="text" value="${app.esc(a.location || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="text-[10px] text-slate-400">حالة اعتماد النسخة الموقّعة</label>
              <select id="act-cstat" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                <option value="unsigned" ${a.contractStatus === 'unsigned' ? 'selected' : ''}>غير مرفوع بعد</option>
                <option value="pending_admin" ${a.contractStatus === 'pending_admin' ? 'selected' : ''}>قيد مراجعة الإدارة</option>
                <option value="approved" ${a.contractStatus === 'approved' ? 'selected' : ''}>معتمد ومفعّل ✅</option>
                <option value="rejected" ${a.contractStatus === 'rejected' ? 'selected' : ''}>مرفوض ❌</option>
              </select>
            </div>
            <div><label class="text-[10px] text-slate-400">المواصفات والشروط الفنية</label><textarea id="act-scope" rows="3" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(a.scopeDetails || '')}</textarea></div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ تعديلات العقد</button>
          </form>
          <div class="grid grid-cols-2 gap-1.5">
            ${a.signedContractMedia ? `<button onclick="DamanApp.openMediaLightbox('${a.signedContractMedia}','صورة العقد الموقّع')" class="py-2 rounded-xl bg-slate-800 text-sky-300 font-bold text-[10.5px]">👁️ العقد الموقّع</button>` : ''}
            <button onclick="DamanAdmin.printAnyContractA4('${a.id}')" class="py-2 rounded-xl bg-white text-slate-950 font-black text-[10.5px]">🖨️ طباعة A4</button>
          </div>
        </div>`;
    },

    async saveContractAdminEdit(e, agId) {
      e.preventDefault();
      await window.DamanApp.db.collection('chatAgreements').doc(agId).update({
        title: document.getElementById('act-title').value.trim(),
        startDate: document.getElementById('act-start').value,
        endDate: document.getElementById('act-end').value,
        location: document.getElementById('act-loc').value.trim(),
        contractStatus: document.getElementById('act-cstat').value,
        scopeDetails: document.getElementById('act-scope').value.trim()
      });
      await window.DamanApp.logAudit('admin_edit_contract', `تعديل العقد ${agId}`, agId);
      document.getElementById('daman-adm-ct-modal').classList.add('hidden');
      window.DamanApp.toast('تم حفظ تعديلات العقد ✅', 'success');
      this.loadTabData('contracts');
    },

    printAnyContractA4(agId) {
      const a = this.agreements.find((x) => x.id === agId);
      if (!a || !window.DamanChat) return;
      const prev = window.DamanChat.agreements;
      window.DamanChat.agreements = [a];
      window.DamanChat.printContractA4(agId);
      setTimeout(() => { window.DamanChat.agreements = prev; }, 500);
    },

    async reviewSignedContract(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      await app.db.collection('chatAgreements').doc(agId).update({
        contractStatus: approve ? 'approved' : 'rejected',
        contractReviewedBy: app.user.email, contractReviewedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await app.logAudit(approve ? 'contract_approve' : 'contract_reject', `${ag.ticketNumber}`, agId);
      await app.sendNotification(ag.payerUid, approve ? `✅ تم اعتماد العقد (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'أزرار الصرف مفعّلة الآن.' : 'ارفع صورة واضحة.');
      await app.sendNotification(ag.providerUid, approve ? `✅ تم اعتماد العقد (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'يمكنكم البدء الآن.' : 'يرجى إعادة الرفع.');
      app.toast(approve ? 'تم اعتماد العقد ✅' : 'تم رفض الصورة', 'success');
      this.loadTabData('contracts');
    },

    async resolveDispute(disputeId, decision) {
      const app = window.DamanApp;
      const d = this.disputes.find((x) => x.id === disputeId);
      if (!d || d.status !== 'open') return;
      const agRef = app.db.collection('chatAgreements').doc(d.agreementId);
      const dispRef = app.db.collection('disputes').doc(disputeId);

      let customWorkerShare = null;
      if (decision === 'split') {
        const rem = Number(((await agRef.get()).data() || {}).remainingEscrow || 0);
        const inp = parseFloat(window.prompt(`المتبقي بالضمان: ${app.fmtMoney(rem)} ج.م.\nالمبلغ المحكوم به للمنفّذ:`, String(Math.round(rem / 2))));
        if (isNaN(inp) || inp < 0 || inp > rem) return app.toast('مبلغ غير صالح', 'error');
        customWorkerShare = Math.round(inp * 100) / 100;
      }
      const note = window.prompt('حيثيات قرار التحكيم:', 'تم الفصل بناءً على العقد والمحادثات والأدلة');
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
            const rate = Number(a.commissionRate || app.getCommissionRate());
            const earnedFee = Math.min(lockedFee, Math.round(executedTotal * rate * 100) / 100);
            const totalClientBack = Math.round((clientPrincipalBack + Math.max(0, Math.round((lockedFee - earnedFee) * 100) / 100)) * 100) / 100;

            const pAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
            const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);
            const pAfter = Math.round((pAvail + totalClientBack) * 100) / 100;
            const wAfter = Math.round((wAvail + workerShare) * 100) / 100;

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - totalEscrowHeld) * 100) / 100), balanceAvailable: pAfter });
            if (workerShare > 0) tx.update(provRef, { balanceAvailable: wAfter });
            if (earnedFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), { agreementId: d.agreementId, type: 'dispute_fee', ticketNumber: a.ticketNumber, amount: earnedFee, cashPaid: earnedFee, bonusUsed: 0, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
            tx.update(agRef, { status: workerShare > 0 ? 'completed' : 'cancelled', remainingEscrow: 0, lockedFee: 0, paidSoFar: executedTotal });
            tx.update(dispRef, { status: 'resolved', decision, workerShare, clientRefund: totalClientBack, adminNote: note, resolvedBy: app.user.email, resolvedAt: firebase.firestore.FieldValue.serverTimestamp() });
            if (totalClientBack > 0) tx.set(app.db.collection('transactions').doc(), { userId: a.payerUid, type: 'dispute_refund', amount: totalClientBack, balanceBefore: pAvail, balanceAfter: pAfter, note: `قرار تحكيم ${a.ticketNumber}: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            if (workerShare > 0) tx.set(app.db.collection('transactions').doc(), { userId: a.providerUid, type: 'dispute_payout', amount: workerShare, balanceBefore: wAvail, balanceAfter: wAfter, note: `قرار تحكيم ${a.ticketNumber}: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          });
          await app.logAudit('dispute_resolved', `${d.contractNumber} (${decision})`, disputeId);
          await app.sendNotification(d.clientId, `⚖️ قرار التحكيم (${d.contractNumber})`, note);
          await app.sendNotification(d.providerId, `⚖️ قرار التحكيم (${d.contractNumber})`, note);
          app.toast('تم الفصل في النزاع ✅', 'success');
          this.loadTabData('contracts');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async forceRefundActiveContract(agId) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const a = this.agreements.find((x) => x.id === agId);
      if (!a || a.status !== 'funded') return;
      const reason = window.prompt(`فسخ طارئ للعقد ${a.ticketNumber} ورد المتبقي لصاحب العمل — السبب:`);
      if (!reason) return;
      const agRef = app.db.collection('chatAgreements').doc(agId);
      const pRef = app.db.collection('users').doc(a.payerUid);
      try {
        await app.db.runTransaction(async (tx) => {
          const [aDoc, pDoc] = await Promise.all([tx.get(agRef), tx.get(pRef)]);
          const ad = aDoc.data();
          if (ad.status !== 'funded') throw new Error('حالة العقد تغيرت');
          const back = Math.round((Number(ad.remainingEscrow || 0) + Number(ad.lockedFee || 0)) * 100) / 100;
          const curAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
          const curEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
          const afterAvail = Math.round((curAvail + back) * 100) / 100;
          tx.update(pRef, { balanceAvailable: afterAvail, balanceEscrow: Math.max(0, Math.round((curEsc - back) * 100) / 100) });
          tx.update(agRef, { status: 'cancelled', remainingEscrow: 0, lockedFee: 0, cancelReason: reason });
          tx.set(app.db.collection('transactions').doc(), { userId: a.payerUid, type: 'admin_contract_refund', amount: back, balanceBefore: curAvail, balanceAfter: afterAvail, note: `فسخ إداري للعقد ${a.ticketNumber}: ${reason}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        await app.logAudit('force_cancel_contract', `${a.ticketNumber}: ${reason}`, agId);
        app.toast('تم فسخ العقد وردّ الضمان ✅', 'success');
        this.loadTabData('contracts');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== CORE TABS RENDERERS ====================
    renderTreasuryTab(app) {
      const s = this.calcAccountingSummary(app);
      const balanced = Math.abs(s.trialDiff) < 1;
      return `
        <div class="space-y-3 text-xs">
          <div class="p-3 rounded-2xl border-2 ${balanced ? 'bg-emerald-500/15 border-emerald-500' : 'bg-rose-500/20 border-rose-500'} space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black ${balanced ? 'text-emerald-300' : 'text-rose-300'}">${balanced ? '✅ ميزان المراجعة مطابق 100%' : `⚠️ فرق ميزان المراجعة: ${app.fmtMoney(s.trialDiff)} ج.م`}</span>
              <div class="flex gap-1"><button onclick="DamanAdmin.exportAccountingCsv()" class="px-2 py-1 rounded-lg bg-slate-900 text-emerald-300 font-black text-[10px]">Excel</button><button onclick="DamanAdmin.printFinancialReportA4()" class="px-2 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">تقرير A4</button></div>
            </div>
            <div class="text-[10px] text-slate-200">المفروض بالقنوات: <b>${app.fmtMoney(s.expectedTotalCash)} ج.م</b> | الجرد الفعلي: <b>${app.fmtMoney(s.actualChannelsTotal)} ج.م</b></div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500 space-y-1">
              <div class="text-[10px] text-emerald-300 font-black">💰 خزنة أرباحك الصافية</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(s.netCashProfitAll)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">أرباح: ${app.fmtMoney(s.grossCashProfitAll)} | مصروف: ${app.fmtMoney(s.totalExpensesAll)}</div>
            </div>
            <div class="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500 space-y-1">
              <div class="text-[10px] text-amber-300 font-black">🛡️ أمانات المستخدمين</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(s.totalUsersTrust)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">متاح ${app.fmtMoney(s.usersAvail)} | ضمان ${app.fmtMoney(s.usersEscrow)} | سحب ${app.fmtMoney(s.usersHoldW)}</div>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-3 space-y-2">
            <div class="flex items-center justify-between"><span class="font-black text-amber-400">📊 الحركة حسب الفترة</span>
              <div class="flex gap-1 text-[10px] font-bold">${[['today', 'اليوم'], ['7d', '7 أيام'], ['30d', '30 يوم'], ['all', 'الكل']].map(([k, lbl]) => `<button onclick="DamanAdmin.periodFilter='${k}'; DamanAdmin.rerender()" class="px-2 py-0.5 rounded-lg ${this.periodFilter === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">${lbl}</button>`).join('')}</div>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10.5px]">
              <div class="p-2 rounded-xl bg-slate-950"><div class="text-slate-400">إيداعات</div><b class="text-emerald-400">+${app.fmtMoney(s.periodDep)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950"><div class="text-slate-400">مسحوبات</div><b class="text-rose-400">-${app.fmtMoney(s.periodWd)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950"><div class="text-slate-400">صافي الربح</div><b class="text-amber-300">${app.fmtMoney(s.periodNet)}</b></div>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">⚖️ الجرد الفعلي للقنوات الثلاث + وارد اليوم</div>
            <div class="grid grid-cols-3 gap-2 text-center">
              ${[['vodafone_cash', 'محافظ كاش'], ['instapay', 'إنستا باي'], ['bank', 'البنك']].map(([k, lbl]) => {
                const c = s.channels[k];
                return `<div class="p-2 rounded-xl bg-slate-950 border border-slate-800"><div class="text-[10px] text-slate-400 font-bold">${lbl}</div><div class="text-xs font-black text-emerald-400">${app.fmtMoney(c.net)} ج.م</div><div class="text-[9px] text-amber-300">اليوم: ${app.fmtMoney(c.todayIn)}</div></div>`;
              }).join('')}
            </div>
          </div>

          <form onsubmit="DamanAdmin.recordTreasuryTransfer(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/30">
            <div class="font-black text-sky-300">🔁 تحويل داخلي بين قنواتك</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[9.5px] text-slate-400">من قناة</label><select id="tt-from" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="vodafone_cash">محافظ كاش</option><option value="instapay">إنستا باي</option><option value="bank">البنك</option></select></div>
              <div><label class="text-[9.5px] text-slate-400">إلى قناة</label><select id="tt-to" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="bank">البنك</option><option value="instapay">إنستا باي</option><option value="vodafone_cash">محافظ كاش</option></select></div>
              <div><label class="text-[9.5px] text-slate-400">المبلغ (ج.م)</label><input id="tt-amt" type="number" min="1" step="any" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-black" /></div>
              <div><label class="text-[9.5px] text-slate-400">رسوم التحويل (ج.م)</label><input id="tt-fee" type="number" min="0" step="any" value="0" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <input id="tt-note" type="text" placeholder="ملاحظة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black">تسجيل التحويل الداخلي</button>
          </form>

          <form onsubmit="DamanAdmin.recordAdminExpense(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-purple-500/40">
            <div class="font-black text-purple-300">💸 سحب أرباح / مصروف تشغيل</div>
            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="text-[9.5px] text-slate-400">المبلغ</label><input id="ae-amt" type="number" min="1" step="any" required class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white font-black" /></div>
              <div><label class="text-[9.5px] text-slate-400">القناة</label><select id="ae-ch" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"><option value="vodafone_cash">محافظ كاش</option><option value="instapay">إنستا باي</option><option value="bank">البنك</option></select></div>
              <div><label class="text-[9.5px] text-slate-400">التصنيف</label><select id="ae-cat" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="profit_withdraw">سحب أرباح</option><option value="marketing">إعلانات</option><option value="operations">تشغيل</option></select></div>
            </div>
            <input id="ae-note" type="text" required placeholder="البيان..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">تسجيل الخصم</button>
          </form>
        </div>`;
    },

    renderPaymentsTab(app) {
      const cfg = app.appConfig || {};
      const acc = cfg.paymentAccounts || {};
      const dc = cfg.depositChannels || {};
      const wc = cfg.withdrawChannels || {};
      const bkup = cfg.backupAccounts || {};
      const open = cfg.openingBalances || {};
      const chF = cfg.channelWithdrawFees || {};

      return `
        <form onsubmit="DamanAdmin.savePaymentSwitchboard(event)" class="space-y-3 text-xs">
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-emerald-500/40">
            <div class="font-black text-emerald-400">🔌 تشغيل / إيقاف وسائل الإيداع (3) والسحب (2)</div>
            <div class="grid grid-cols-3 gap-1.5 text-[10.5px] font-bold">
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="sw-dep-vf" type="checkbox" ${dc.vodafone_cash !== false ? 'checked' : ''} class="accent-emerald-500" /> إيداع كاش</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="sw-dep-ip" type="checkbox" ${dc.instapay !== false ? 'checked' : ''} class="accent-emerald-500" /> إيداع إنستا</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="sw-dep-bk" type="checkbox" ${dc.bank !== false ? 'checked' : ''} class="accent-emerald-500" /> إيداع بنك</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="sw-wd-vf" type="checkbox" ${wc.vodafone_cash !== false ? 'checked' : ''} class="accent-amber-500" /> سحب كاش</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="sw-wd-ip" type="checkbox" ${wc.instapay !== false ? 'checked' : ''} class="accent-amber-500" /> سحب إنستا</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="sw-wd-bk" type="checkbox" ${wc.bank === true ? 'checked' : ''} class="accent-amber-500" /> سحب بنك</label>
            </div>
          </div>

          <!-- 1. Wallet Details -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-amber-500/40">
            <div class="font-black text-amber-400">📱 1. بيانات المحفظة الإلكترونية النشطة</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-300 mb-1">رقم المحفظة *</label><input id="sw-vf-num" type="text" value="${app.esc(acc.vodafoneCash || '')}" placeholder="010xxxxxxxx" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black" /></div>
              <div><label class="block text-[10px] text-slate-300 mb-1">اسم صاحب المحفظة *</label><input id="sw-vf-holder" type="text" value="${app.esc(acc.vodafoneHolder || '')}" placeholder="الاسم بالكامل" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            ${(bkup.vodafoneCash || []).length ? `<div class="flex flex-wrap gap-1 pt-1">${bkup.vodafoneCash.map((v) => `<button type="button" onclick="DamanAdmin.quickActivateBackup('vodafoneCash','${app.esc(v).replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-[10px] font-bold">تفعيل: ${app.esc(v)}</button>`).join('')}</div>` : ''}
          </div>

          <!-- 2. InstaPay Direct Link -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-purple-500/40">
            <div class="font-black text-purple-300">⚡ 2. بيانات إنستا باي (لينك التحويل المباشر)</div>
            <div><label class="block text-[10px] text-purple-200 mb-1">رابط / لينك التحويل المباشر في إنستا باي (يدوس عليه يحوّله مباشرة) *</label><input id="sw-ip-link" type="url" value="${app.esc(acc.instaPayLink || '')}" placeholder="https://ipn.eg/S/username/instapay/..." class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-purple-500/50 text-emerald-300 font-bold" dir="ltr" /></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-300 mb-1">عنوان إنستا باي (IPA)</label><input id="sw-ip-addr" type="text" value="${app.esc(acc.instaPay || '')}" placeholder="name@instapay" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-300 mb-1">اسم صاحب الحساب</label><input id="sw-ip-holder" type="text" value="${app.esc(acc.instaPayHolder || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            ${(bkup.instaPay || []).length ? `<div class="flex flex-wrap gap-1 pt-1">${bkup.instaPay.map((v) => `<button type="button" onclick="DamanAdmin.quickActivateBackup('instaPay','${app.esc(v).replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-purple-500 text-[10px] font-bold">تفعيل: ${app.esc(v)}</button>`).join('')}</div>` : ''}
          </div>

          <!-- 3. Bank Account Separate Fields -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🏦 3. بيانات الحساب البنكي النشط</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-300 mb-1">اسم البنك *</label><input id="sw-bk-name" type="text" value="${app.esc(acc.bankName || '')}" placeholder="مثال: البنك الأهلي المصري / CIB" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-slate-300 mb-1">اسم صاحب الحساب البنكي *</label><input id="sw-bk-holder" type="text" value="${app.esc(acc.bankHolder || '')}" placeholder="الاسم كما في البنك" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-bold" /></div>
            </div>
            <div><label class="block text-[10px] text-slate-300 mb-1">رقم الحساب البنكي *</label><input id="sw-bk-acc" type="text" value="${app.esc(acc.bankAccount || '')}" placeholder="رقم الحساب البنكي" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-black" /></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">رقم IBAN (اختياري)</label><input id="sw-bk-iban" type="text" value="${app.esc(acc.bankIban || '')}" placeholder="EG..." class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
          </div>

          <div class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="font-black text-slate-200">🔄 قوائم الحسابات الاحتياطية (كل رقم/لينك في سطر)</div>
            <textarea id="sw-bkup-vf" rows="2" placeholder="أرقام محافظ احتياطية..." class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc((bkup.vodafoneCash || []).join('\n'))}</textarea>
            <textarea id="sw-bkup-ip" rows="2" placeholder="لينكات أو عناوين إنستا باي احتياطية..." class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc((bkup.instaPay || []).join('\n'))}</textarea>
            <textarea id="sw-bkup-bk" rows="2" placeholder="أرقام حسابات بنكية احتياطية..." class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc((bkup.bank || []).join('\n'))}</textarea>
          </div>

          <div class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="font-black text-slate-200">⏱️ الحدود، العدّاد، رسوم السحب لكل وسيلة، والأرصدة الافتتاحية</div>
            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="text-[9.5px] text-slate-400">عدّاد الإيداع (دقيقة)</label><input id="sw-mins" type="number" min="2" max="30" value="${Number(cfg.depositSessionMinutes || 10)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[9.5px] text-slate-400">أدنى إيداع</label><input id="sw-mindep" type="number" value="${Number(cfg.minDeposit || 100)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">أقصى إيداع</label><input id="sw-maxdep" type="number" value="${Number(cfg.maxDeposit || 250000)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">أدنى سحب</label><input id="sw-minwd" type="number" value="${Number(cfg.minWithdraw || 100)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div class="col-span-2"><label class="text-[9.5px] text-slate-400">أقصى سحب يومي للمستخدم (ج.م)</label><input id="sw-maxwd" type="number" value="${Number(cfg.maxWithdrawDaily || 50000)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <div class="p-2 rounded-xl bg-slate-950 space-y-1"><div class="text-[9.5px] text-amber-300 font-bold">رسوم سحب كاش</div><input id="sw-fee-vf-p" type="number" step="0.1" value="${app.esc(chF.vodafone_cash?.pct ?? '')}" placeholder="نسبة %" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /><input id="sw-fee-vf-f" type="number" step="any" value="${app.esc(chF.vodafone_cash?.flat ?? '')}" placeholder="ثابت ج.م" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
              <div class="p-2 rounded-xl bg-slate-950 space-y-1"><div class="text-[9.5px] text-purple-300 font-bold">رسوم سحب إنستا</div><input id="sw-fee-ip-p" type="number" step="0.1" value="${app.esc(chF.instapay?.pct ?? '')}" placeholder="نسبة %" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /><input id="sw-fee-ip-f" type="number" step="any" value="${app.esc(chF.instapay?.flat ?? '')}" placeholder="ثابت ج.م" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
              <div class="p-2 rounded-xl bg-slate-950 space-y-1"><div class="text-[9.5px] text-sky-300 font-bold">رسوم سحب بنك</div><input id="sw-fee-bk-p" type="number" step="0.1" value="${app.esc(chF.bank?.pct ?? '')}" placeholder="نسبة %" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /><input id="sw-fee-bk-f" type="number" step="any" value="${app.esc(chF.bank?.flat ?? '')}" placeholder="ثابت ج.م" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="text-[9.5px] text-slate-400">افتتاحي كاش</label><input id="sw-open-vf" type="number" step="any" value="${Number(open.vodafone_cash || 0)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">افتتاحي إنستا</label><input id="sw-open-ip" type="number" step="any" value="${Number(open.instapay || 0)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">افتتاحي البنك</label><input id="sw-open-bk" type="number" step="any" value="${Number(open.bank || 0)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
          </div>

          <button type="submit" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black">حفظ وتطبيق محوّل الحسابات فوراً</button>
        </form>`;
    },

    renderWalletTab(app) {
      const pending = this.walletReqs.filter((r) => r.status === 'pending');
      const done = this.walletReqs.filter((r) => r.status !== 'pending');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-emerald-400">طلبات الشحن والسحب المعلّقة (${pending.length})</div>
          ${!pending.length ? `<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد طلبات معلّقة ✅</div>` : pending.map((r) => `
            <div class="glass-card rounded-2xl p-3.5 space-y-2 ${r.duplicateRefFlag || r.phoneMismatchFlag || r.rapidFlipFlag ? 'border-2 border-rose-500 bg-rose-500/5' : 'border-amber-500/40'}">
              ${r.duplicateRefFlag ? `<div class="p-1.5 rounded bg-rose-600 text-white font-black text-center text-[10px]">⚠️ الرقم المرجعي مكرر!</div>` : ''}
              ${r.phoneMismatchFlag ? `<div class="p-1.5 rounded bg-amber-600 text-white font-black text-center text-[10px]">⚠️ رقم المحفظة مختلف عن رقم المستخدم!</div>` : ''}
              <div class="flex justify-between items-center">
                <b class="${r.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}">${r.type === 'deposit' ? '⬇️ شحن / إيداع' : '⬆️ سحب كاش'} — ${app.fmtMoney(r.amount)} ج.م</b>
                <button onclick="DamanAdmin.openUser360Modal('${r.userId}')" class="px-2 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px] font-bold">ملف 360°</button>
              </div>
              <div class="text-[11px] text-slate-200">${app.esc(r.userLegalName || r.userName)} (${app.esc(r.userPhone || '')}) • ${this.channelAr(r.channel)} • ${app.esc(r.date || '')}</div>
              ${r.txRef ? `<div class="text-[10.5px] text-amber-300">المرجع: <b class="select-all">${app.esc(r.txRef)}</b> | من: ${app.esc(r.senderAccount || '')}</div>` : ''}
              ${r.destAccount ? `<div class="text-[11px] text-emerald-300 font-black">تحويل إلى: <span class="select-all">${app.esc(r.destAccount)}</span> (الصافي: ${app.fmtMoney(r.netPayout || r.amount)} ج.م)</div>` : ''}
              ${r.type === 'deposit' ? `
                <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-emerald-500/30">
                  <span class="text-[10px] text-emerald-300 font-bold shrink-0">المبلغ الواصل:</span>
                  <input id="adm-act-amt-${r.id}" type="number" step="any" value="${Number(r.amount || 0)}" class="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-black" />
                  ${r.receiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.receiptMedia}','إيصال إيداع')" class="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-black text-[10px] shrink-0">الإيصال</button>` : ''}
                </div>` : `
                <div class="space-y-1.5 p-2 rounded-xl bg-slate-950 border border-amber-500/30">
                  <div class="flex items-center gap-2"><span class="text-[10px] text-amber-300 font-bold">رسوم التحويل عليك (ج.م):</span><input id="adm-tr-cost-${r.id}" type="number" min="0" step="any" value="0" class="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                  <label class="block p-1.5 rounded-lg border border-dashed border-emerald-500/50 text-center cursor-pointer text-[10px] text-emerald-300 font-bold">📷 إرفاق إيصال التحويل للمستخدم<input type="file" accept="image/*" class="hidden" onchange="DamanAdmin.handlePayoutReceiptFile(this,'${r.id}')" /><div id="adm-pout-prev-${r.id}"></div></label>
                </div>`}
              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','approve')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد</button>
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','reject')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
              </div>
            </div>`).join('')}
          <div class="font-bold text-slate-400 pt-2">المنفّذة (${done.length})</div>
          ${done.slice(0, 12).map((r) => `<div class="glass-card rounded-xl p-2.5 flex justify-between text-[11px]"><span>${r.type === 'deposit' ? '⬇️' : '⬆️'} ${app.esc(r.userName)} — ${app.fmtMoney(r.actualAmount || r.amount)} ج.م</span><b class="${r.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}">${this.statusAr(r.status)}</b></div>`).join('')}
        </div>`;
    },

    renderKycTab(app) {
      const pending = this.kycReqs.filter((k) => k.status === 'pending');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-amber-400">طلبات التوثيق المعلّقة (${pending.length})</div>
          ${!pending.length ? `<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد طلبات توثيق معلّقة ✅</div>` : pending.map((k) => {
            const isComp = k.accountType === 'company' || k.accountType === 'supplier';
            return `
              <div class="glass-card rounded-2xl p-3.5 space-y-2 border-amber-500/50">
                <div class="flex justify-between"><b class="text-white">${app.esc(k.displayName || k.legalName)}</b><span class="text-sky-300">${app.esc(k.phone || '')}</span></div>
                <div class="flex flex-wrap gap-1.5">
                  <button onclick="DamanApp.openMediaLightbox('${k.idFrontMedia}','وش البطاقة')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 وش</button>
                  <button onclick="DamanApp.openMediaLightbox('${k.idBackMedia}','ضهر البطاقة')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 ضهر</button>
                  <button onclick="DamanApp.openMediaLightbox('${k.selfieMedia}','سيلفي')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-[10px]">🤳 سيلفي</button>
                  ${k.crMedia ? `<button onclick="DamanApp.openMediaLightbox('${k.crMedia}','السجل التجاري')" class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">📄 سجل</button>` : ''}
                  ${k.taxMedia ? `<button onclick="DamanApp.openMediaLightbox('${k.taxMedia}','البطاقة الضريبية')" class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">📄 ضريبية</button>` : ''}
                </div>
                <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div><label class="text-[9.5px] text-slate-400">الاسم الرباعي</label><input id="kyc-ed-name-${k.id}" type="text" value="${app.esc(k.legalName || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                  <div><label class="text-[9.5px] text-slate-400">الرقم القومي</label><input id="kyc-ed-nid-${k.id}" type="text" maxlength="14" value="${app.esc(k.nationalId || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-black" /></div>
                  <div><label class="text-[9.5px] text-slate-400">العنوان</label><input id="kyc-ed-addr-${k.id}" type="text" value="${app.esc(k.legalAddress || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                  ${isComp ? `<input id="kyc-ed-comp-${k.id}" type="text" value="${app.esc(k.companyName || '')}" placeholder="الشركة" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /><div class="grid grid-cols-2 gap-1.5"><input id="kyc-ed-cr-${k.id}" type="text" value="${app.esc(k.commercialReg || '')}" placeholder="سجل" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /><input id="kyc-ed-tax-${k.id}" type="text" value="${app.esc(k.taxCard || '')}" placeholder="ضريبية" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>` : ''}
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <button onclick="DamanAdmin.approveKyc('${k.id}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد</button>
                  <button onclick="DamanAdmin.rejectKyc('${k.id}')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
                </div>
              </div>`;
          }).join('')}
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
              <div class="grid grid-cols-2 gap-2"><button onclick="DamanAdmin.reviewSignedContract('${a.id}',true)" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد</button><button onclick="DamanAdmin.reviewSignedContract('${a.id}',false)" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button></div>
            </div>`).join('')}

          <div class="font-black text-rose-400 pt-2">⚖️ النزاعات المفتوحة (${openDisputes.length})</div>
          ${!openDisputes.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد نزاعات مفتوحة ✅</div>` : openDisputes.map((d) => `
            <div class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/60">
              <div class="flex justify-between"><b class="text-white">${app.esc(d.contractNumber)} — ${app.esc(d.projectTitle)}</b><b class="text-amber-300">${app.fmtMoney(d.contractAmount)} ج.م</b></div>
              <p class="text-[11px] text-rose-200">${app.esc(d.reason)}</p>
              <div class="grid grid-cols-3 gap-1.5"><button onclick="DamanAdmin.resolveDispute('${d.id}','client')" class="py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px]">للعميل 100%</button><button onclick="DamanAdmin.resolveDispute('${d.id}','provider')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10px]">للمنفّذ 100%</button><button onclick="DamanAdmin.resolveDispute('${d.id}','split')" class="py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]">تقسيم</button></div>
            </div>`).join('')}

          <div class="font-black text-sky-400 pt-2">🛡️ كل العقود (${this.agreements.length})</div>
          ${this.agreements.slice(0, 25).map((a) => `
            <div class="glass-card rounded-xl p-2.5 flex justify-between items-center gap-2">
              <div class="min-w-0"><b class="text-white truncate block">${app.esc(a.ticketNumber)} — ${app.esc(a.title)}</b><span class="text-[10px] text-slate-400">${this.statusAr(a.status)} • متبقي: ${app.fmtMoney(a.remainingEscrow || 0)} ج.م</span></div>
              <div class="flex gap-1 shrink-0"><button onclick="DamanAdmin.openContractAdminModal('${a.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">فحص/تعديل</button>${app.isAdmin() && a.status === 'funded' ? `<button onclick="DamanAdmin.forceRefundActiveContract('${a.id}')" class="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px]">فسخ</button>` : ''}</div>
            </div>`).join('')}
        </div>`;
    },

    // ==================== MAIN ADMIN SHELL ROUTER ====================
    render(container, app) {
      if (!app.hasAdminAccess()) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-400 font-bold text-xs">صلاحية الإدارة مطلوبة.</div>`;
        return;
      }

      const isMain = app.isAdmin();
      const tabs = [
        isMain ? ['treasury', '💰 الخزنة والميزان'] : null,
        isMain ? ['payments', '💳 محوّل الحسابات'] : null,
        app.canMod('wallet') ? ['wallet', '💸 الشحن والسحب'] : null,
        app.canMod('kyc') ? ['kyc', '🪪 التوثيق'] : null,
        app.canMod('contracts') ? ['contracts', '📄 العقود والنزاع'] : null,
        app.canMod('market') ? ['market', '🏗️ السوق والتمييز'] : null,
        isMain ? ['ads', '📢 النصوص والبانرات'] : null,
        app.canMod('companies') ? ['companies', '🏢 الشركات'] : null,
        app.canMod('users') ? ['users', '👥 المستخدمين 360°'] : null,
        app.canMod('comms') ? ['comms', '👁️ مراقبة الشات'] : null,
        isMain ? ['security', '🛡️ المشرفين والسجل'] : null,
        isMain ? ['db', '🗄️ قاعدة البيانات'] : null,
        isMain ? ['settings', '⚙️ الطوارئ والنسخ'] : null
      ].filter(Boolean);

      if (!tabs.some(([k]) => k === this.subTab) && tabs.length) this.subTab = tabs[0][0];

      const c = this.counts;
      const pills = [
        c.kyc ? `<button onclick="DamanAdmin.setSubTab('kyc')" class="px-2 py-1 rounded-lg bg-rose-600 text-white font-black text-[10px]">توثيق: ${c.kyc}</button>` : '',
        c.dep ? `<button onclick="DamanAdmin.setSubTab('wallet')" class="px-2 py-1 rounded-lg bg-emerald-600 text-white font-black text-[10px]">شحن: ${c.dep}</button>` : '',
        c.wd ? `<button onclick="DamanAdmin.setSubTab('wallet')" class="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">سحب: ${c.wd}</button>` : '',
        c.signed ? `<button onclick="DamanAdmin.setSubTab('contracts')" class="px-2 py-1 rounded-lg bg-sky-600 text-white font-black text-[10px]">عقود: ${c.signed}</button>` : '',
        c.disputes ? `<button onclick="DamanAdmin.setSubTab('contracts')" class="px-2 py-1 rounded-lg bg-rose-700 text-white font-black text-[10px]">نزاع: ${c.disputes}</button>` : '',
        c.posts ? `<button onclick="DamanAdmin.setSubTab('market')" class="px-2 py-1 rounded-lg bg-purple-600 text-white font-black text-[10px]">إعلانات: ${c.posts}</button>` : '',
        c.reports ? `<button onclick="DamanAdmin.setSubTab('users')" class="px-2 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px]">بلاغات: ${c.reports}</button>` : '',
        c.tickets ? `<button onclick="DamanAdmin.setSubTab('comms')" class="px-2 py-1 rounded-lg bg-indigo-600 text-white font-black text-[10px]">تذاكر: ${c.tickets}</button>` : ''
      ].filter(Boolean);

      const omniBox = this.omniResults ? `
        <div class="glass-card rounded-2xl p-3 border-amber-500/50 space-y-2 text-[11px]">
          <div class="flex justify-between"><b class="text-amber-400">نتائج البحث: "${app.esc(this.omniQuery)}"</b><button onclick="DamanAdmin.omniResults=null; DamanAdmin.rerender()" class="text-rose-400 font-bold">إغلاق ×</button></div>
          ${this.omniResults.users.map((u) => `<div onclick="DamanAdmin.openUser360Modal('${u.id}')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>👤 ${app.esc(u.name)} (${app.esc(u.phone || '')})</span><b class="text-sky-300">ملف 360°</b></div>`).join('')}
          ${this.omniResults.wallets.map((w) => `<div onclick="DamanAdmin.setSubTab('wallet')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>💳 ${app.esc(w.userName)}</span><b class="text-emerald-400">${app.fmtMoney(w.amount)} (${this.statusAr(w.status)})</b></div>`).join('')}
          ${this.omniResults.contracts.map((a) => `<div onclick="DamanAdmin.openContractAdminModal('${a.id}')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>📄 ${app.esc(a.ticketNumber)} — ${app.esc(a.title)}</span><b class="text-amber-300">${app.fmtMoney(a.totalAmount)}</b></div>`).join('')}
          ${this.omniResults.companies.map((co) => `<div onclick="DamanAdmin.openCompanyControlModal('${co.id}')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>🏢 ${app.esc(co.name)} (${app.esc(co.code)})</span><b class="text-purple-300">تحكّم</b></div>`).join('')}
        </div>` : '';

      let body = '';
      try {
        if (this.loading) body = `<div class="glass-card rounded-2xl p-8 text-center text-xs text-amber-400 font-bold animate-pulse">جارٍ التحميل...</div>`;
        else if (this.subTab === 'payments') body = this.renderPaymentsTab(app);
        else if (this.subTab === 'wallet') body = this.renderWalletTab(app);
        else if (this.subTab === 'kyc') body = this.renderKycTab(app);
        else if (this.subTab === 'contracts') body = this.renderContractsTab(app);
        else if (this.subTab === 'market') body = this.renderMarketTab ? this.renderMarketTab(app) : '<div class="text-center text-amber-300 p-6">ارفع ملف admin-ext.js</div>';
        else if (this.subTab === 'ads') body = this.renderAdsAndBrandingTab ? this.renderAdsAndBrandingTab(app) : '';
        else if (this.subTab === 'companies') body = this.renderCompaniesTab ? this.renderCompaniesTab(app) : '';
        else if (this.subTab === 'users') body = this.renderUsersTab ? this.renderUsersTab(app) : '';
        else if (this.subTab === 'comms') body = this.renderCommsTab ? this.renderCommsTab(app) : '';
        else if (this.subTab === 'security') body = this.renderSecurityTab ? this.renderSecurityTab(app) : '';
        else if (this.subTab === 'db') body = this.renderDbTab ? this.renderDbTab(app) : '';
        else if (this.subTab === 'settings') body = this.renderSettingsTab ? this.renderSettingsTab(app) : '';
        else body = this.renderTreasuryTab(app);
      } catch (e) {
        body = `<div class="p-4 rounded-2xl bg-rose-500/20 border border-rose-500 text-xs text-rose-200">خطأ عرض: ${app.esc(e.message)}</div>`;
      }

      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-black text-purple-300"><i class="fa-solid fa-crown me-1 text-amber-400"></i> لوحة سيطرة الإدارة الشاملة</h2>
            <button onclick="DamanAdmin.loadTabData(DamanAdmin.subTab)" class="px-3 py-1 rounded-xl bg-slate-800 text-amber-300 text-[10px] font-black"><i class="fa-solid fa-rotate me-1"></i>تحديث</button>
          </div>
          ${pills.length ? `<div class="flex flex-wrap gap-1.5 p-2 rounded-2xl bg-slate-900/90 border border-rose-500/40">${pills.join('')}</div>` : ''}
          <form onsubmit="DamanAdmin.runOmniSearch(event)" class="flex gap-1.5 text-xs">
            <input id="adm-omni-q" type="text" value="${app.esc(this.omniQuery)}" placeholder="بحث شامل: TKT- / CMP- / مرجع / رقم قومي / موبايل..." class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            <button type="submit" class="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black"><i class="fa-solid fa-magnifying-glass"></i></button>
          </form>
          ${omniBox}
          <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
            ${tabs.map(([k, lbl]) => `<button onclick="DamanAdmin.setSubTab('${k}')" class="shrink-0 px-3 py-2 rounded-xl ${this.subTab === k ? 'bg-purple-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
          </div>
          ${this.lastErrors.length ? `<div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/50 text-[10px] text-rose-200">⚠️ صلاحيات: ${app.esc(this.lastErrors.join(' | '))}</div>` : ''}
          ${body}
        </div>`;

      if (!this.initialized && !this.loading) {
        setTimeout(() => this.loadTabData(this.subTab), 10);
      }
    }
  };

  window.DamanAdmin = AdminMod;
  if (window.DamanApp) window.DamanApp.registerModule('admin', AdminMod);
})();
