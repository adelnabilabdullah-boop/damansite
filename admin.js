(function () {
  const AdminMod = {
    subTab: 'treasury', // 'treasury' | 'payments' | 'wallet' | 'kyc' | 'contracts' | 'market' | 'ads' | 'companies' | 'users' | 'comms' | 'security' | 'settings'
    loading: false,
    initialized: false,
    lastErrors: [],

    // Filters & Search
    periodFilter: 'all', // 'all' | 'today' | '7d' | '30d'
    userSearch: '',
    omniQuery: '',
    omniResults: null,
    pageLimits: { kyc: 20, wallet: 25, users: 30, comms: 20 },

    // Live Pending Counters (Action Center)
    counts: { kyc: 0, dep: 0, wd: 0, signed: 0, disputes: 0, posts: 0, reports: 0, tickets: 0 },

    // Data Stores
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

    // Temp upload buffers
    tempPayoutReceipts: {},

    detachListeners() {
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
      this.tempPayoutReceipts = {};
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'admin') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) {
      const app = window.DamanApp;
      if (['treasury', 'payments', 'settings', 'security'].includes(t) && !app.isAdmin()) {
        return app.toast('هذا القسم للأدمن الرئيسي فقط', 'error');
      }
      if (!app.canMod(t) && !['ads'].includes(t)) {
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
      if (!app.isAdmin() && ['treasury', 'payments', 'settings', 'security'].includes(tab)) {
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
            this.safeDocs(db.collection('chats').limit(this.pageLimits.comms || 20).get(), 'المحادثات'),
            this.safeDocs(db.collection('callRecordings').limit(this.pageLimits.comms || 20).get(), 'التسجيلات'),
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
        }
      } finally {
        this.loading = false;
        this.rerender();
      }
    },

    // ==================== OMNI-SEARCH (CONTRACTS / TXREF / NID / PHONE / COMPANIES) ====================
    async runOmniSearch(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const q = (document.getElementById('adm-omni-q')?.value || '').trim();
      this.omniQuery = q;
      if (!q) { this.omniResults = null; return this.rerender(); }

      const db = app.db;
      const qUp = q.toUpperCase();
      const qNorm = app.normalizeAr(q);
      app.toast('جارٍ البحث الشامل في قواعد البيانات...', 'info');

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

    // ==================== 1. DOUBLE-ENTRY ACCOUNTING & TRIAL BALANCE ENGINE ====================
    inPeriod(dateStr) {
      if (this.periodFilter === 'all' || !dateStr) return true;
      const today = window.DamanApp.todayLocal();
      if (this.periodFilter === 'today') return dateStr === today;
      const d = new Date(dateStr + 'T12:00:00');
      const now = new Date(today + 'T12:00:00');
      const diffDays = Math.floor((now - d) / (24 * 60 * 60 * 1000));
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

      // All-time Trial Balance (Must be All-Time to reconcile physical cash!)
      let grossCashProfitAll = 0, bonusUsedAll = 0;
      this.platformFees.forEach((f) => {
        grossCashProfitAll += f.cashPaid != null ? Number(f.cashPaid) : Number(f.amount || 0);
        bonusUsedAll += Number(f.bonusUsed || 0);
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

      // Filtered Period KPIs
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
        grossCashProfitAll, bonusUsedAll, totalExpensesAll, netCashProfitAll,
        channels, actualChannelsTotal, totalOpening, expectedTotalCash, trialDiff,
        periodFees: Math.round(periodFees * 100) / 100,
        periodExp: Math.round(periodExp * 100) / 100,
        periodNet: Math.round((periodFees - periodExp) * 100) / 100,
        periodDep: Math.round(periodDep * 100) / 100,
        periodWd: Math.round(periodWd * 100) / 100
      };
    },

    async recordAdminExpense(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return app.toast('متاح للأدمن الرئيسي فقط', 'error');
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
      await app.logAudit('treasury_transfer', `تحويل داخلي ${amount} ج.م من ${fromChannel} إلى ${toChannel} (رسوم ${fee})`);
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
          <h4 style="margin:4px 0;">أولاً: أمانات المستخدمين وخزنة الأرباح</h4>
          <table style="margin-bottom:12px;">
            <tr><th>متاح المستخدمين</th><td>${app.fmtMoney(s.usersAvail)} ج.م</td><th>محجوز بالضمان</th><td>${app.fmtMoney(s.usersEscrow)} ج.م</td></tr>
            <tr><th>قيد السحب / المجمّد</th><td>${app.fmtMoney(s.usersHoldW)} / ${app.fmtMoney(s.usersFrozen)} ج.م</td><th>إجمالي أمانات الناس</th><td><b>${app.fmtMoney(s.totalUsersTrust)} ج.م</b></td></tr>
            <tr><th>إجمالي أرباح الكاش</th><td>${app.fmtMoney(s.grossCashProfitAll)} ج.م</td><th>مصروفات ومسحوبات الإدارة</th><td>${app.fmtMoney(s.totalExpensesAll)} ج.م</td></tr>
            <tr><th>صافي خزنة الأرباح</th><td><b>${app.fmtMoney(s.netCashProfitAll)} ج.م</b></td><th>حالة ميزان المراجعة</th><td><b>${Math.abs(s.trialDiff) < 1 ? 'مطابق 100%' : 'فرق: ' + app.fmtMoney(s.trialDiff) + ' ج.م'}</b></td></tr>
          </table>
          <h4 style="margin:4px 0;">ثانياً: الجرد الفعلي لقنوات الدفع الثلاث</h4>
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
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:24px; text-align:center; font-size:11px;">
            <div>المراجع المالي<br/><br/>.....................................</div>
            <div>اعتماد المدير العام<br/><br/>.....................................</div>
          </div>
        </div>`);
    },

    exportAccountingCsv() {
      const app = window.DamanApp;
      const header = ['التاريخ', 'النوع', 'القناة', 'المستخدم/البيان', 'المبلغ (ج.م)', 'الحالة'];
      const escCsv = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const lines = [header.map(escCsv).join(',')];
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

    // ==================== 2. PAYMENT SWITCHBOARD (3 DEPOSIT / 2 WITHDRAW + BACKUP POOLS) ====================
    async savePaymentSwitchboard(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;

      const parseLines = (id) => (document.getElementById(id)?.value || '').split('\n').map((s) => s.trim()).filter(Boolean);
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
          instaPay: document.getElementById('sw-ip-addr').value.trim(),
          instaPayHolder: document.getElementById('sw-ip-holder').value.trim(),
          bankInfo: document.getElementById('sw-bk-info').value.trim(),
          bankIban: document.getElementById('sw-bk-iban').value.trim()
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
      await app.logAudit('payment_switchboard', `تحديث حسابات وقنوات الدفع: VF=${patch.paymentAccounts.vodafoneCash}, IP=${patch.paymentAccounts.instaPay}`);
      app.toast('تم تحديث محوّل حسابات الدفع فوراً على كل الموبايلات ✅', 'success');
    },

    async quickActivateBackup(channelKey, val) {
      const app = window.DamanApp;
      if (!app.isAdmin() || !val) return;
      const curAcc = Object.assign({}, app.appConfig?.paymentAccounts || {});
      if (channelKey === 'vodafoneCash') curAcc.vodafoneCash = val;
      else if (channelKey === 'instaPay') curAcc.instaPay = val;
      else curAcc.bankInfo = val;
      await app.db.collection('settings').doc('appConfig').set({ paymentAccounts: curAcc }, { merge: true });
      await app.logAudit('quick_rotate_account', `تبديل سريع للحساب النشط (${channelKey}) → ${val}`);
      app.toast(`تم تفعيل الحساب النشط فوراً: ${val} ✅`, 'success');
    },

    // ==================== 3. WALLET REQUESTS (ACTUAL RECEIVED AMOUNT + PAYOUT RECEIPT + TRANSFER COST) ====================
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
        const diffMsg = actualAmount !== Number(req.amount) ? `\n⚠️ تم تعديل المبلغ الواصل من ${app.fmtMoney(req.amount)} إلى ${app.fmtMoney(actualAmount)} ج.م` : '';
        if (!window.confirm(`تأكيد اعتماد إيداع ${app.fmtMoney(actualAmount)} ج.م لحساب ${req.userName}؟${diffMsg}`)) return;
      } else {
        transferCost = Math.max(0, Math.round((parseFloat(document.getElementById('adm-tr-cost-' + reqId)?.value) || 0) * 100) / 100);
        if (!window.confirm(`تأكيد أنك حوّلت صافي السحب (${app.fmtMoney(req.netPayout || req.amount)} ج.م) إلى ${req.destAccount}؟\n(تكلفة التحويل التي دفعتها الإدارة: ${app.fmtMoney(transferCost)} ج.م)`)) return;
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
            if (!rDoc.exists) throw new Error('الطلب غير موجود');
            const r = rDoc.data();
            if (r.status !== 'pending') throw new Error('تمت معالجة هذا الطلب مسبقاً!');

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
                  note: `شحن محفظة معتمد (${r.channel} — مرجع ${r.txRef || ''})${actualAmount !== amt ? ' [تم التصحيح حسب المبلغ الواصل]' : ''}`,
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
                if (curHold < amt - 0.01) throw new Error('الرصيد المحجوز للسحب لا يكفي! راجع ملف المستخدم.');
                tx.update(userRef, { balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100) });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'withdraw_paid', amount: 0,
                  balanceBefore: curAvail, balanceAfter: curAvail,
                  note: `تم تحويل السحب (${app.fmtMoney(r.netPayout || amt)} ج.م إلى ${r.destAccount})`,
                  date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                const wFee = Number(r.withdrawFee || 0);
                if (wFee > 0) {
                  tx.set(app.db.collection('platformFees').doc(), {
                    type: 'withdraw_fee', requestId: reqId, userId: r.userId, userName: r.userName || '',
                    amount: wFee, cashPaid: wFee, bonusUsed: 0,
                    date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
                tx.update(userRef, {
                  balancePendingWithdraw: Math.max(0, Math.round((curHold - amt) * 100) / 100),
                  balanceAvailable: afterAvail
                });
                tx.set(app.db.collection('transactions').doc(), {
                  userId: r.userId, type: 'withdraw_refund', amount: amt,
                  balanceBefore: curAvail, balanceAfter: afterAvail,
                  note: `رد مبلغ سحب مرفوض: ${adminNote}`, date: app.todayLocal(),
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
              tx.update(reqRef, {
                status: action === 'approve' ? 'approved' : 'rejected',
                adminTransferCost: transferCost,
                payoutReceiptMedia,
                adminNote, processedBy: app.user.email, processedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });

          delete this.tempPayoutReceipts[reqId];
          await app.logAudit(`wallet_${req.type}_${action}`, `${req.userName} — ${app.fmtMoney(actualAmount)} ج.م (${req.channel})`, reqId);
          await app.sendNotification(
            req.userId,
            action === 'approve' ? (req.type === 'deposit' ? '✅ تم شحن محفظتك بنجاح' : '✅ تم تحويل السحب لحسابك') : '❌ تم رفض طلب المحفظة',
            action === 'approve' ? `المبلغ المعتمد: ${app.fmtMoney(req.type === 'deposit' ? actualAmount : (req.netPayout || req.amount))} ج.م` : (adminNote || 'راجع الإدارة')
          );
          app.toast('تم تنفيذ العملية بدقة ✅', 'success');
          this.loadTabData('wallet');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 4. KYC VERIFICATION ====================
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

        const dupSnap = await app.db.collection('users').where('nationalId', '==', parsed.nid).limit(2).get();
        if (dupSnap.docs.some((d) => d.id !== uid)) return app.toast('⚠️ هذا الرقم القومي موثّق بالفعل لحساب آخر!', 'error');

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
        await app.logAudit('kyc_approve', `توثيق ${legalName} (${parsed.nid})`, uid);
        await app.sendNotification(uid, '✅ تم توثيق حسابك وتثبيت بياناتك القانونية!', 'يمكنك الآن استخدام المحفظة، السوق، والعقود المضمونة.');
        app.toast('تم اعتماد التوثيق وقفل البيانات القانونية ✅', 'success');
        this.loadTabData('kyc');
      });
    },

    async rejectKyc(uid) {
      const app = window.DamanApp;
      const reason = window.prompt('سبب الرفض:', 'صور البطاقة أو السيلفي غير واضحة — يرجى إعادة التصوير');
      if (!reason) return;
      await app.db.collection('users').doc(uid).update({ kycStatus: 'rejected', kycRejectionReason: reason.trim() });
      await app.db.collection('kycRequests').doc(uid).update({ status: 'rejected', rejectionReason: reason.trim() });
      await app.logAudit('kyc_reject', reason.trim(), uid);
      await app.sendNotification(uid, '❌ تم رفض مستندات التوثيق', reason.trim());
      app.toast('تم رفض الطلب وإبلاغ المستخدم', 'info');
      this.loadTabData('kyc');
    },

    // ==================== 5. CONTRACTS & DISPUTES (INCLUDING EMERGENCY FORCE CANCEL) ====================
    async reviewSignedContract(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      await app.db.collection('chatAgreements').doc(agId).update({
        contractStatus: approve ? 'approved' : 'rejected',
        contractReviewedBy: app.user.email, contractReviewedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await app.logAudit(approve ? 'contract_approve' : 'contract_reject', `${ag.ticketNumber}: ${ag.title}`, agId);
      await app.sendNotification(ag.payerUid, approve ? `✅ تم اعتماد العقد (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'أزرار الصرف والتمديد مفعّلة الآن.' : 'يرجى رفع صورة واضحة.');
      await app.sendNotification(ag.providerUid, approve ? `✅ تم اعتماد العقد (${ag.ticketNumber})` : `❌ رُفضت صورة العقد (${ag.ticketNumber})`, approve ? 'يمكنكم البدء الآن.' : 'يرجى إعادة رفع الصورة.');
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
        const agSnap = await agRef.get();
        const rem = Number((agSnap.data() || {}).remainingEscrow || 0);
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
            const unusedFeeBack = Math.max(0, Math.round((lockedFee - earnedFee) * 100) / 100);
            const totalClientBack = Math.round((clientPrincipalBack + unusedFeeBack) * 100) / 100;

            const pAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
            const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);
            const pAfter = Math.round((pAvail + totalClientBack) * 100) / 100;
            const wAfter = Math.round((wAvail + workerShare) * 100) / 100;

            tx.update(payerRef, {
              balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - totalEscrowHeld) * 100) / 100),
              balanceAvailable: pAfter
            });
            if (workerShare > 0) tx.update(provRef, { balanceAvailable: wAfter });
            if (earnedFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                agreementId: d.agreementId, type: 'dispute_fee', ticketNumber: a.ticketNumber,
                amount: earnedFee, cashPaid: earnedFee, bonusUsed: 0,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(agRef, { status: workerShare > 0 ? 'completed' : 'cancelled', remainingEscrow: 0, lockedFee: 0, paidSoFar: executedTotal });
            tx.update(dispRef, { status: 'resolved', decision, workerShare, clientRefund: totalClientBack, adminNote: note, resolvedBy: app.user.email, resolvedAt: firebase.firestore.FieldValue.serverTimestamp() });
            if (totalClientBack > 0) {
              tx.set(app.db.collection('transactions').doc(), {
                userId: a.payerUid, type: 'dispute_refund', amount: totalClientBack, balanceBefore: pAvail, balanceAfter: pAfter,
                note: `قرار تحكيم ${a.ticketNumber}: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            if (workerShare > 0) {
              tx.set(app.db.collection('transactions').doc(), {
                userId: a.providerUid, type: 'dispute_payout', amount: workerShare, balanceBefore: wAvail, balanceAfter: wAfter,
                note: `قرار تحكيم ${a.ticketNumber}: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          await app.logAudit('dispute_resolved', `${d.contractNumber} (${decision}): ${note}`, disputeId);
          await app.sendNotification(d.clientId, `⚖️ قرار التحكيم (${d.contractNumber})`, note);
          await app.sendNotification(d.providerId, `⚖️ قرار التحكيم (${d.contractNumber})`, note);
          app.toast('تم الفصل في النزاع وتصفية الضمان ✅', 'success');
          this.loadTabData('contracts');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async forceRefundActiveContract(agId) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const a = this.agreements.find((x) => x.id === agId);
      if (!a || a.status !== 'funded') return;
      const reason = window.prompt(`فسخ طارئ للعقد ${a.ticketNumber} ورد المتبقي (${app.fmtMoney(a.remainingEscrow)} + عمولة ${app.fmtMoney(a.lockedFee)}) لصاحب العمل.\nاكتب السبب:`);
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
          tx.set(app.db.collection('transactions').doc(), {
            userId: a.payerUid, type: 'admin_contract_refund', amount: back, balanceBefore: curAvail, balanceAfter: afterAvail,
            note: `فسخ إداري للعقد ${a.ticketNumber}: ${reason}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        await app.logAudit('force_cancel_contract', `${a.ticketNumber}: ${reason}`, agId);
        app.toast('تم فسخ العقد وردّ الضمان لصاحب العمل ✅', 'success');
        this.loadTabData('contracts');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 6. MARKET, 3x INSPECTION (+ REPORT UPLOAD) & VIP LABOR ====================
    async moderateProject(pid, status) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      await app.db.collection('projects').doc(pid).update({ status });
      if (p) await app.sendNotification(p.ownerId, status === 'approved' ? '✅ تم نشر إعلانك' : '❌ تم رفض إعلانك', p.title);
      await app.logAudit('market_moderate', `${status}: ${p?.title || pid}`, pid);
      app.toast('تم التحديث ✅', 'success');
      this.loadTabData('market');
    },

    async toggleBoostProject(pid, curBoosted) {
      await window.DamanApp.db.collection('projects').doc(pid).update({
        boostedUntil: curBoosted ? 0 : Date.now() + 30 * 24 * 60 * 60 * 1000
      });
      window.DamanApp.toast(curBoosted ? 'تم إلغاء التمييز' : 'تم تمييز الإعلان ★', 'success');
      this.loadTabData('market');
    },

    async deleteProjectAdmin(pid) {
      if (!window.confirm('حذف هذا الإعلان نهائياً من السوق؟')) return;
      await window.DamanApp.db.collection('projects').doc(pid).delete();
      this.loadTabData('market');
    },

    async quoteInspection(reqId) {
      const app = window.DamanApp;
      const r = this.inspections.find((x) => x.id === reqId);
      if (!r) return;
      const price = parseFloat(window.prompt(`تسعير طلب الاستلام 3x (${r.element}):`, r.quotedPrice || '9000'));
      if (!price || price <= 0) return;
      const note = window.prompt('ملاحظة وموعد المهندس:', 'تم التسعير — اضغط موافقة ودفع لتأكيد الزيارة') || '';
      await app.db.collection('vipRequests').doc(reqId).update({ quotedPrice: price, adminNote: note, status: 'quoted' });
      await app.sendNotification(r.userId, `تم تسعير الاستلام الهندسي 3x (${app.fmtMoney(price)} ج.م)`, note);
      app.toast('تم إرسال التسعيرة ✅', 'success');
      this.loadTabData('market');
    },

    async uploadInspectionReport(input, reqId) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      if (!f) return;
      input.value = '';
      const b64 = await app.compressImage(f, 920, 0.62);
      const reportMedia = await app.saveMedia(b64, { kind: 'inspection_report' });
      const r = this.inspections.find((x) => x.id === reqId);
      await app.db.collection('vipRequests').doc(reqId).update({ reportMedia, status: 'completed', completedAt: firebase.firestore.FieldValue.serverTimestamp() });
      if (r) await app.sendNotification(r.userId, '📄 تم رفع التقرير الهندسي للاستلام 3x!', 'افتح قسم استلام 3x لمعاينة وتحميل التقرير المعتمد.');
      app.toast('تم رفع التقرير الهندسي وإغلاق الطلب كمكتمل ✅', 'success');
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
      const note = window.prompt('ملاحظات الإدارة:', `التكلفة ${app.fmtMoney(baseCost)} + عمولة VIP ${app.fmtMoney(vipFee)}`) || '';
      await app.db.collection('vipLaborRequests').doc(reqId).update({ baseCost, vipFee, totalQuoted, adminNote: note, status: 'quoted' });
      await app.sendNotification(r.userId, `تم تسعير عمالة VIP (${app.fmtMoney(totalQuoted)} ج.م)`, note);
      app.toast('تم إرسال التسعيرة ✅', 'success');
      this.loadTabData('market');
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

    // ==================== 7. ADS, ANNOUNCEMENT BAR & DYNAMIC BRANDING (EVERY WORD IN APP) ====================
    async saveAnnouncementAndBranding(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const patch = {
        announcement: {
          enabled: document.getElementById('an-en').checked,
          text: document.getElementById('an-txt').value.trim(),
          color: document.getElementById('an-col').value,
          action: document.getElementById('an-act').value
        },
        branding: {
          appNameAr: document.getElementById('br-ar').value.trim() || 'ضمان سايت',
          appNameEn: document.getElementById('br-en').value.trim() || 'DamanSite',
          taglineAr: document.getElementById('br-tag-ar').value.trim(),
          taglineEn: document.getElementById('br-tag-en').value.trim(),
          heroWelcome: document.getElementById('br-hw').value.trim(),
          heroGuestTitle: document.getElementById('br-ht').value.trim(),
          heroGuestDesc: document.getElementById('br-hd').value.trim(),
          privacyText: document.getElementById('br-priv').value.trim()
        },
        hideDemoPosts: document.getElementById('ad-hide-demo').checked,
        hideOfficialBanners: document.getElementById('ad-hide-off').checked
      };
      await app.db.collection('settings').doc('appConfig').set(patch, { merge: true });
      await app.logAudit('branding_update', 'تحديث نصوص التطبيق والشريط العاجل');
      app.toast('تم تطبيق التعديلات على كل شاشات التطبيق فوراً ✅', 'success');
    },

    async addCustomHomeBanner(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const badge = document.getElementById('hb-badge').value.trim() || 'عرض ضمان سايت';
      const title = document.getElementById('hb-title').value.trim();
      const subtitle = document.getElementById('hb-sub').value.trim();
      const ctaText = document.getElementById('hb-cta').value.trim() || 'اطلب الآن';
      const action = document.getElementById('hb-act').value;
      const theme = document.getElementById('hb-theme').value;
      if (!title) return;
      const cur = Array.isArray(app.appConfig?.customHomeBanners) ? app.appConfig.customHomeBanners : [];
      await app.db.collection('settings').doc('appConfig').set({
        customHomeBanners: cur.concat([{ id: 'bn_' + Date.now(), badge, title, subtitle, ctaText, action, theme }])
      }, { merge: true });
      e.target.reset();
      app.toast('تم نشر الإعلان على الرئيسية فوراً ✅', 'success');
    },

    async deleteCustomHomeBanner(id) {
      const app = window.DamanApp;
      const cur = Array.isArray(app.appConfig?.customHomeBanners) ? app.appConfig.customHomeBanners : [];
      await app.db.collection('settings').doc('appConfig').set({ customHomeBanners: cur.filter((x) => x.id !== id) }, { merge: true });
      app.toast('تم حذف الإعلان', 'info');
    },

    // ==================== 8. COMPANIES FULL CONTROL ====================
    async toggleCompanyStatus(compId, curSt) {
      if (!window.DamanApp.isAdmin()) return;
      const next = curSt === 'suspended' ? 'active' : 'suspended';
      await window.DamanApp.db.collection('companies').doc(compId).update({ status: next });
      await window.DamanApp.logAudit('company_status', `${compId} → ${next}`, compId);
      window.DamanApp.toast(next === 'suspended' ? 'تم إيقاف الشركة مؤقتاً' : 'تم تفعيل الشركة ✅', 'info');
      this.loadTabData('companies');
    },

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
      const [memSnap, cusSnap] = await Promise.all([
        app.db.collection('companyMembers').where('companyId', '==', compId).limit(100).get(),
        app.db.collection('companyCustody').where('companyId', '==', compId).limit(40).get()
      ]);
      const mems = memSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      const custs = cusSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-purple-300">👑 ${app.esc(comp.name)}</h3><button onclick="document.getElementById('daman-admin-comp-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">الكود: <b class="text-amber-300">${app.esc(comp.code)}</b> • المالك: <b>${app.esc(comp.ownerName || '—')}</b> • المواقع: <b>${(comp.sites || []).length}</b></div>
          <form onsubmit="DamanAdmin.sendAdminCompanyMsg(event,'${compId}')" class="flex gap-1.5">
            <input id="adm-comp-msg" type="text" required placeholder="إرسال تنبيه رسمي لجروب الشركة..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white" />
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
          <div class="font-black text-sky-400">آخر حركات العهدة (${custs.length})</div>
          ${custs.slice(0, 8).map((c) => `<div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-[10.5px]"><span>${app.esc(c.holderName)}: ${app.esc(c.note)}</span><b class="text-amber-300">${app.fmtMoney(c.amount)} ج.م</b></div>`).join('') || '<div class="text-slate-500">لا توجد عهدة</div>'}
        </div>`;
    },

    async sendAdminCompanyMsg(e, compId) {
      e.preventDefault();
      const inp = document.getElementById('adm-comp-msg');
      const text = inp?.value.trim();
      if (!text) return;
      await window.DamanApp.db.collection('companyMessages').add({
        companyId: compId, senderId: window.DamanApp.user.uid, senderName: '👑 إدارة ضمان سايت',
        isPlatformAdmin: true, text, date: window.DamanApp.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      inp.value = '';
      window.DamanApp.toast('تم إرسال الرسالة لجروب الشركة ✅', 'success');
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

    // ==================== 9. USER 360° GOD-MODE DOSSIER + DOUBLE-ENTRY MANUAL BALANCE + BROADCAST ====================
    async openUser360Modal(uid) {
      const app = window.DamanApp;
      let m = document.getElementById('daman-user360-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-user360-modal';
        m.className = 'daman-modal fixed inset-0 z-[92] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-6 text-center text-xs text-amber-300">جارٍ تحميل الملف الشامل 360°...</div>`;

      try {
        const [uDoc, txSnap, agSnap] = await Promise.all([
          app.db.collection('users').doc(uid).get(),
          app.db.collection('transactions').where('userId', '==', uid).limit(20).get(),
          app.db.collection('chatAgreements').where('participants', 'array-contains', uid).limit(15).get()
        ]);
        if (!uDoc.exists) return m.classList.add('hidden');
        const u = Object.assign({ id: uDoc.id }, uDoc.data());
        const txs = this.sortDesc(txSnap.docs.map((d) => d.data()));
        const ags = this.sortDesc(agSnap.docs.map((d) => d.data()));

        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-black text-amber-400">🔎 ملف 360°: ${app.esc(u.name)}</h3>
              <button onclick="document.getElementById('daman-user360-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-0.5">
              <div>الرباعي: <b class="text-white">${app.esc(u.legalName || '—')}</b> | القومي: <b class="text-emerald-400">${app.esc(u.nationalId || '—')}</b></div>
              <div>الميلاد: <b>${app.esc(u.birthDate || '—')}</b> | الموبايل: <b>${app.esc(u.phone || '—')}</b></div>
              <div>الإيميل: <b>${app.esc(u.email || '—')}</b> | الحالة: <b class="text-amber-300">${app.esc(u.kycStatus)} / ${app.esc(u.status)}</b></div>
            </div>

            <div class="grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div class="p-1.5 rounded-xl bg-slate-950 border border-emerald-500/40"><div class="text-slate-400">كاش</div><b class="text-emerald-400">${app.fmtMoney(u.balanceAvailable || 0)}</b></div>
              <div class="p-1.5 rounded-xl bg-slate-950 border border-amber-500/40"><div class="text-slate-400">ضمان</div><b class="text-amber-400">${app.fmtMoney(u.balanceEscrow || 0)}</b></div>
              <div class="p-1.5 rounded-xl bg-slate-950 border border-purple-500/40"><div class="text-slate-400">هدايا</div><b class="text-purple-300">${app.fmtMoney(u.balanceBonus || 0)}</b></div>
              <div class="p-1.5 rounded-xl bg-slate-950 border border-rose-500/40"><div class="text-slate-400">مجمّد</div><b class="text-rose-400">${app.fmtMoney(u.balanceFrozen || 0)}</b></div>
            </div>

            ${app.isAdmin() ? `
              <!-- Double-Entry Manual Balance Adjustment -->
              <form onsubmit="DamanAdmin.applyManualBalance(event,'${uid}')" class="p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2">
                <div class="font-black text-emerald-400">💰 تعديل / تجميد رصيد يدوي (بقيد محاسبي مزدوج)</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <select id="mb-mode" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-[10.5px]">
                    <option value="bonus_add">+ إضافة رصيد هدايا (غير نقدي)</option>
                    <option value="cash_gift">+ إضافة كاش (من أرباح الإدارة)</option>
                    <option value="cash_vf">+ إيداع كاش يدوي (محفظة كاش)</option>
                    <option value="cash_ip">+ إيداع كاش يدوي (إنستا باي)</option>
                    <option value="cash_bk">+ إيداع كاش يدوي (البنك)</option>
                    <option value="cash_deduct">- خصم من الكاش (لخزنة الأرباح)</option>
                    <option value="freeze">🔒 تجميد مبلغ من المتاح</option>
                    <option value="unfreeze">🔓 فك تجميد وإرجاع للمتاح</option>
                  </select>
                  <input id="mb-amt" type="number" min="1" step="any" required placeholder="المبلغ (ج.م)" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-white font-black" />
                </div>
                <input id="mb-note" type="text" required placeholder="السبب (يظهر بكشف الحساب وسجل الرقابة)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                <button type="submit" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">تنفيذ القيد المالي</button>
              </form>

              <!-- VIP, Custom Commission & Secret CRM Note -->
              <form onsubmit="DamanAdmin.saveUserGodSettings(event,'${uid}')" class="p-3 rounded-2xl bg-slate-950 border border-purple-500/40 space-y-2">
                <div class="font-black text-purple-300">👑 عمولة مخصصة + باقة VIP + ملاحظة سرية</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div><label class="block text-[9.5px] text-slate-400">عمولة مخصصة % (فارغ = الافتراضي)</label><input id="u3-comm" type="number" step="0.1" value="${u.customCommissionRate != null && u.customCommissionRate !== '' ? (Number(u.customCommissionRate) * 100).toFixed(2) : ''}" placeholder="مثال: 2" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                  <div><label class="block text-[9.5px] text-slate-400">منح أيام VIP إضافية (0 بدون تغيير)</label><input id="u3-vip" type="number" min="0" value="0" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                </div>
                <input id="u3-crm" type="text" value="${app.esc(u.adminCrmNote || '')}" placeholder="ملاحظة سرية للإدارة فقط (لا يراها المستخدم)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-200" />
                <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">حفظ إعدادات الحساب</button>
              </form>` : ''}

            <div class="grid grid-cols-3 gap-1.5">
              <button onclick="DamanAdmin.sendDirectNotif('${uid}','${app.esc(u.name).replace(/'/g, "\\'")}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">🔔 إشعار خاص</button>
              <button onclick="DamanAdmin.revokeUserKyc('${uid}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">إلغاء التوثيق</button>
              <button onclick="DamanAdmin.toggleBanUser('${uid}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">${u.status === 'banned' ? 'فك الحظر' : 'حظر'}</button>
            </div>

            <div class="font-bold text-slate-300">آخر العقود (${ags.length}) والحركات (${txs.length})</div>
            <div class="space-y-1 max-h-36 overflow-y-auto">
              ${ags.map((a) => `<div class="p-1.5 rounded bg-slate-950 text-[10px] flex justify-between"><span>📄 ${app.esc(a.ticketNumber)} — ${app.esc(a.title)}</span><b class="text-amber-300">${app.fmtMoney(a.totalAmount)} (${a.status})</b></div>`).join('')}
              ${txs.slice(0, 10).map((t) => `<div class="p-1.5 rounded bg-slate-950 text-[10px] flex justify-between"><span>${app.esc(t.date)} ${app.esc(t.note || t.type)}</span><b class="${Number(t.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${app.fmtMoney(t.amount)}</b></div>`).join('')}
            </div>
          </div>`;
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async applyManualBalance(e, uid) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const mode = document.getElementById('mb-mode').value;
      const amt = Math.round((parseFloat(document.getElementById('mb-amt').value) || 0) * 100) / 100;
      const note = document.getElementById('mb-note').value.trim();
      if (amt <= 0 || !note) return;

      const uRef = app.db.collection('users').doc(uid);
      try {
        await app.db.runTransaction(async (tx) => {
          const uDoc = await tx.get(uRef);
          const u = uDoc.data() || {};
          const curAvail = Number(u.balanceAvailable || 0);
          const curBonus = Number(u.balanceBonus || 0);
          const curFrozen = Number(u.balanceFrozen || 0);

          if (mode === 'bonus_add') {
            const afterB = Math.round((curBonus + amt) * 100) / 100;
            tx.update(uRef, { balanceBonus: afterB });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_bonus', isBonus: true, amount: amt, balanceBefore: curBonus, balanceAfter: afterB, note: `هدية من الإدارة: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'cash_gift') {
            const afterA = Math.round((curAvail + amt) * 100) / 100;
            tx.update(uRef, { balanceAvailable: afterA });
            tx.set(app.db.collection('adminExpenses').doc(), { amount: amt, category: 'user_gift', channel: 'none', note: `تعويض/هدية كاش إلى ${u.name}: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_gift', amount: amt, balanceBefore: curAvail, balanceAfter: afterA, note: `إضافة من الإدارة: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode.startsWith('cash_')) {
            if (mode === 'cash_deduct') {
              if (curAvail < amt) throw new Error('الرصيد المتاح لا يكفي للخصم');
              const afterA = Math.round((curAvail - amt) * 100) / 100;
              tx.update(uRef, { balanceAvailable: afterA });
              tx.set(app.db.collection('platformFees').doc(), { type: 'admin_adjustment', userId: uid, userName: u.name || '', amount: amt, cashPaid: amt, bonusUsed: 0, note, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
              tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_deduct', amount: -amt, balanceBefore: curAvail, balanceAfter: afterA, note: `خصم إداري: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            } else {
              const ch = mode === 'cash_vf' ? 'vodafone_cash' : mode === 'cash_ip' ? 'instapay' : 'bank';
              const afterA = Math.round((curAvail + amt) * 100) / 100;
              tx.update(uRef, { balanceAvailable: afterA });
              tx.set(app.db.collection('walletRequests').doc(), { type: 'deposit', userId: uid, userName: u.name || '', channel: ch, amount: amt, actualAmount: amt, txRef: 'MANUAL-' + Date.now(), adminNote: note, status: 'approved', date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
              tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'deposit_approved', amount: amt, balanceBefore: curAvail, balanceAfter: afterA, note: `شحن يدوي معتمد (${ch}): ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            }
          } else if (mode === 'freeze') {
            if (curAvail < amt) throw new Error('الرصيد المتاح لا يكفي للتجميد');
            const afterA = Math.round((curAvail - amt) * 100) / 100;
            tx.update(uRef, { balanceAvailable: afterA, balanceFrozen: Math.round((curFrozen + amt) * 100) / 100, frozenReason: note });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_freeze', amount: -amt, balanceBefore: curAvail, balanceAfter: afterA, note: `تجميد إداري: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'unfreeze') {
            if (curFrozen < amt) throw new Error('المبلغ المجمّد أقل من ذلك');
            const afterA = Math.round((curAvail + amt) * 100) / 100;
            const remFrz = Math.max(0, Math.round((curFrozen - amt) * 100) / 100);
            tx.update(uRef, { balanceAvailable: afterA, balanceFrozen: remFrz, frozenReason: remFrz > 0 ? u.frozenReason : '' });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_unfreeze', amount: amt, balanceBefore: curAvail, balanceAfter: afterA, note: `فك تجميد: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          }
        });
        await app.logAudit('manual_balance', `${mode} بمبلغ ${amt} ج.م: ${note}`, uid);
        await app.sendNotification(uid, 'تحديث مالي من الإدارة', `${note} (${app.fmtMoney(amt)} ج.م)`);
        app.toast('تم تنفيذ القيد المالي بنجاح (الميزان متطابق 100%) ✅', 'success');
        this.openUser360Modal(uid);
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async saveUserGodSettings(e, uid) {
      e.preventDefault();
      const app = window.DamanApp;
      const commRaw = document.getElementById('u3-comm').value.trim();
      const vipDays = parseInt(document.getElementById('u3-vip').value, 10) || 0;
      const adminCrmNote = document.getElementById('u3-crm').value.trim();
      const patch = {
        customCommissionRate: commRaw !== '' ? Number(commRaw) / 100 : '',
        adminCrmNote
      };
      if (vipDays > 0) {
        const uSnap = await app.db.collection('users').doc(uid).get();
        const baseExp = Math.max(Date.now(), Number((uSnap.data() || {}).subscriptionExpiresAt || 0));
        patch.subscriptionExpiresAt = baseExp + vipDays * 24 * 60 * 60 * 1000;
      }
      await app.db.collection('users').doc(uid).update(patch);
      await app.logAudit('user_god_settings', `عمولة=${commRaw || 'افتراضي'} | VIP=+${vipDays}ي`, uid);
      app.toast('تم حفظ إعدادات المستخدم بنجاح ✅', 'success');
      this.openUser360Modal(uid);
    },

    async sendDirectNotif(uid, name) {
      const title = window.prompt(`إرسال إشعار خاص إلى ${name} — العنوان:`, 'رسالة من إدارة ضمان سايت');
      if (!title) return;
      const body = window.prompt('نص الإشعار:');
      if (!body) return;
      await window.DamanApp.sendNotification(uid, title.trim(), body.trim());
      window.DamanApp.toast('تم إرسال الإشعار ✅', 'success');
    },

    async revokeUserKyc(uid) {
      const reason = window.prompt('إلغاء توثيق الحساب وطلب إعادة رفع البطاقة — السبب:', 'يرجى تحديث صور البطاقة');
      if (!reason) return;
      await window.DamanApp.db.collection('users').doc(uid).update({ kycStatus: 'rejected', kycRejectionReason: reason });
      await window.DamanApp.sendNotification(uid, '⚠️ يرجى إعادة توثيق حسابك', reason);
      window.DamanApp.toast('تم إلغاء التوثيق وإبلاغ المستخدم', 'info');
    },

    async sendBroadcastNotification(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const segment = document.getElementById('bc-seg').value; // 'all' | 'company' | 'supplier' | 'individual'
      const title = document.getElementById('bc-title').value.trim();
      const body = document.getElementById('bc-body').value.trim();
      if (!title || !body) return;

      const targets = this.users.filter((u) => segment === 'all' || u.accountType === segment);
      if (!window.confirm(`إرسال هذا الإشعار الجماعي إلى ${targets.length} مستخدم؟`)) return;
      app.toast(`جارٍ إرسال الإشعار إلى ${targets.length} مستخدم...`, 'info');
      await Promise.all(targets.map((u) => app.sendNotification(u.id, title, body)));
      await app.logAudit('broadcast', `فئة ${segment} (${targets.length}): ${title}`);
      e.target.reset();
      app.toast(`تم الإرسال الجماعي إلى ${targets.length} مستخدم بنجاح 📢`, 'success');
    },

    async sendBirthdayGift(uid, userName) {
      const app = window.DamanApp;
      const amt = parseFloat(window.prompt(`🎂 هدية عيد ميلاد (رصيد هدايا للباقات والتمييز) إلى ${userName} (0 للتهنئة فقط):`, '50'));
      if (isNaN(amt) || amt < 0) return;
      if (amt > 0) {
        const uRef = app.db.collection('users').doc(uid);
        await app.db.runTransaction(async (tx) => {
          const uDoc = await tx.get(uRef);
          const curB = Number((uDoc.data() || {}).balanceBonus || 0);
          tx.update(uRef, { balanceBonus: Math.round((curB + amt) * 100) / 100 });
          tx.set(app.db.collection('transactions').doc(), {
            userId: uid, type: 'birthday_gift', isBonus: true, amount: amt,
            note: '🎂 هدية عيد ميلاد من إدارة ضمان سايت', date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
      }
      await app.sendNotification(uid, `🎂 كل سنة وأنت طيب يا ${userName}!`, amt > 0 ? `أهدتك الإدارة ${app.fmtMoney(amt)} ج.م في رصيد الهدايا 🎉` : 'كل عام وأنت بخير 🎉');
      app.toast('تم إرسال هدية عيد الميلاد 🎂', 'success');
    },

    async toggleBanUser(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      const ban = u.status !== 'banned';
      const reason = ban ? (window.prompt('سبب الحظر:', 'مخالفة شروط ضمان سايت') || 'مخالفة') : '';
      await app.db.collection('users').doc(uid).update({ status: ban ? 'banned' : 'active', banReason: reason });
      await app.logAudit(ban ? 'user_ban' : 'user_unban', `${u.name}: ${reason}`, uid);
      app.toast(ban ? 'تم الحظر' : 'تم فك الحظر ✅', 'info');
      this.loadTabData('users');
    },

    async deleteUserSafely(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid);
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      if (Number(u.balanceAvailable || 0) > 0 || Number(u.balanceEscrow || 0) > 0 || Number(u.balancePendingWithdraw || 0) > 0 || Number(u.balanceFrozen || 0) > 0) {
        return app.toast('❌ ممنوع حذف مستخدم لديه أي رصيد مالي!', 'error');
      }
      if (!window.confirm(`حذف سجل «${u.name}» نهائياً؟`)) return;
      await app.db.collection('users').doc(uid).delete();
      await app.logAudit('user_delete', u.name || uid, uid);
      this.loadTabData('users');
    },

    async addBlacklistEntry(e) {
      e.preventDefault();
      const value = document.getElementById('bl-val').value.trim();
      const reason = document.getElementById('bl-reason').value.trim() || 'حظر دائم';
      if (!value) return;
      await window.DamanApp.db.collection('blacklist').add({ value, reason, date: window.DamanApp.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      e.target.reset();
      window.DamanApp.toast('تمت الإضافة للقائمة السوداء 🚫', 'success');
      this.loadTabData('users');
    },

    async removeBlacklist(id) {
      await window.DamanApp.db.collection('blacklist').doc(id).delete();
      this.loadTabData('users');
    },

    async createPromoCode(e) {
      e.preventDefault();
      const code = document.getElementById('pr-code').value.trim().toUpperCase();
      const amount = parseFloat(document.getElementById('pr-amt').value) || 0;
      const maxUses = parseInt(document.getElementById('pr-max').value, 10) || 10;
      if (!code || amount <= 0) return;
      await window.DamanApp.db.collection('promoCodes').doc(code).set({
        code, amount, maxUses, usedBy: [], active: true,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      window.DamanApp.toast(`تم إنشاء الكود ${code} (رصيد هدايا) 🎁`, 'success');
      this.loadTabData('users');
    },

    async resolveReport(id, st) {
      await window.DamanApp.db.collection('reports').doc(id).update({ status: st });
      this.loadTabData('users');
    },

    // ==================== 10. COMMS, RBAC MODERATORS, MEDIA CLEANER & KILL-SWITCHES ====================
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
      const snap = await app.db.collection('callRecordings').limit(100).get();
      const expired = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((r) => !r.pinned && Number(r.expiresAt || 0) < Date.now());
      if (!expired.length) return app.toast('لا توجد تسجيلات منتهية (>30 يوم)', 'info');
      if (!window.confirm(`حذف ${expired.length} تسجيل مكالمات منتهي الصلاحية؟`)) return;
      for (const r of expired) {
        if (r.audioMedia) await app.db.collection('mediaVault').doc(r.audioMedia).delete().catch(() => {});
        await app.db.collection('callRecordings').doc(r.id).delete().catch(() => {});
      }
      await app.logAudit('media_cleanup', `حذف ${expired.length} تسجيل منتهي`);
      app.toast(`تم تنظيف ${expired.length} تسجيل ✅`, 'success');
      this.loadTabData(this.subTab);
    },

    async replyTicket(tid, userId) {
      const reply = window.prompt('رد الإدارة على التذكرة:');
      if (!reply) return;
      await window.DamanApp.db.collection('supportTickets').doc(tid).update({ adminReply: reply.trim(), status: 'closed' });
      await window.DamanApp.sendNotification(userId, 'تم الرد على تذكرة الدعم', reply.trim());
      this.loadTabData('comms');
    },

    async saveModeratorRBAC(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const email = document.getElementById('rb-email').value.trim().toLowerCase();
      if (!email || !email.includes('@')) return app.toast('أدخل بريد إلكتروني صحيح', 'error');

      const perms = {
        kyc: document.getElementById('rb-kyc').checked,
        wallet: document.getElementById('rb-wallet').checked,
        contracts: document.getElementById('rb-contracts').checked,
        market: document.getElementById('rb-market').checked,
        companies: document.getElementById('rb-companies').checked,
        users: document.getElementById('rb-users').checked,
        comms: document.getElementById('rb-comms').checked
      };
      const curMods = Array.isArray(app.appConfig?.moderators) ? app.appConfig.moderators : [];
      const curMap = Object.assign({}, app.appConfig?.moderatorPerms || {});
      curMap[email] = perms;
      const nextMods = Array.from(new Set(curMods.concat([email])));
      await app.db.collection('settings').doc('appConfig').set({ moderators: nextMods, moderatorPerms: curMap }, { merge: true });
      await app.logAudit('rbac_add', `إضافة/تحديث مشرف: ${email}`);
      e.target.reset();
      app.toast(`تم حفظ صلاحيات المشرف ${email} ✅`, 'success');
    },

    async removeModerator(email) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const nextMods = (app.appConfig?.moderators || []).filter((x) => x.toLowerCase() !== email.toLowerCase());
      const nextMap = Object.assign({}, app.appConfig?.moderatorPerms || {});
      delete nextMap[email.toLowerCase()];
      await app.db.collection('settings').doc('appConfig').set({ moderators: nextMods, moderatorPerms: nextMap }, { merge: true });
      await app.logAudit('rbac_remove', `حذف مشرف: ${email}`);
      app.toast('تم إزالة المشرف', 'info');
    },

    async saveEmergencyAndGeneralSettings(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const cfg = {
        commissionRate: (parseFloat(document.getElementById('st-comm').value) || 3.5) / 100,
        vipCommissionRate: (parseFloat(document.getElementById('st-vipcomm').value) || 10) / 100,
        packages: {
          individualMonthly: parseFloat(document.getElementById('st-pkg-ind').value) || 150,
          companyMonthly: parseFloat(document.getElementById('st-pkg-comp').value) || 450,
          boostAdPrice: parseFloat(document.getElementById('st-pkg-boost').value) || 75
        },
        supportWhatsapp: document.getElementById('st-wa').value.trim(),
        turnServer: document.getElementById('st-turn').value.trim(),
        maintenanceMode: document.getElementById('ks-maint').checked,
        maintenanceMessage: document.getElementById('ks-maint-msg').value.trim(),
        disableRegistrations: document.getElementById('ks-noreg').checked,
        disableDeposits: document.getElementById('ks-nodep').checked,
        disableWithdrawals: document.getElementById('ks-nowd').checked,
        disableCalls: document.getElementById('ks-nocalls').checked,
        disableNewContracts: document.getElementById('ks-noct').checked,
        disableMarketPosting: document.getElementById('ks-nopost').checked,
        requireKycForActions: document.getElementById('ks-reqkyc').checked
      };
      await app.db.collection('settings').doc('appConfig').set(cfg, { merge: true });
      await app.logAudit('settings_save', `تحديث الإعدادات ومفاتيح الطوارئ (صيانة=${cfg.maintenanceMode})`);
      app.toast('تم حفظ وتطبيق كل الإعدادات ومفاتيح الطوارئ فوراً ✅', 'success');
    },

    async triggerForceReloadAllDevices() {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      if (!window.confirm('إرسال أمر مسح الكاش وإعادة التحميل الفوري لجميع الموبايلات والـ APK المفتوحة؟')) return;
      const ver = Date.now();
      localStorage.setItem('daman_force_ver', String(ver));
      await app.db.collection('settings').doc('appConfig').set({ forceReloadVersion: ver }, { merge: true });
      await app.logAudit('force_reload', `إجبار تحديث الأجهزة (${ver})`);
      app.toast('تم إرسال أمر التحديث الإجباري لجميع الأجهزة 🚀', 'success');
    },

    async exportFullBackup() {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      app.toast('جارٍ تجهيز النسخة الاحتياطية الشاملة...', 'info');
      const cols = ['users', 'walletRequests', 'platformFees', 'adminExpenses', 'treasuryTransfers', 'chatAgreements', 'disputes', 'projects', 'companies', 'companyMembers', 'companyOps', 'vipRequests', 'vipLaborRequests', 'blacklist', 'promoCodes', 'auditLogs', 'settings'];
      const dump = { exportedAt: new Date().toISOString(), app: 'DamanSite', version: app.APP_VERSION, collections: {} };
      for (const c of cols) dump.collections[c] = await this.safeDocs(app.db.collection(c).limit(500).get(), c);
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `damansite-full-backup-${app.todayLocal()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.toast('تم تنزيل النسخة الاحتياطية الكاملة (JSON) ✅', 'success');
    },

    // ==================== RENDER SUB-TABS ====================
    renderTreasuryTab(app) {
      const s = this.calcAccountingSummary(app);
      const balanced = Math.abs(s.trialDiff) < 1;

      return `
        <div class="space-y-3 text-xs">
          <!-- Trial Balance Status Banner -->
          <div class="p-3 rounded-2xl border-2 ${balanced ? 'bg-emerald-500/15 border-emerald-500' : 'bg-rose-500/20 border-rose-500'} space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black ${balanced ? 'text-emerald-300' : 'text-rose-300'}">
                ${balanced ? '✅ ميزان المراجعة مطابق 100.00%' : `⚠️ تنبيه فرق في ميزان المراجعة: ${app.fmtMoney(s.trialDiff)} ج.م`}
              </span>
              <div class="flex gap-1">
                <button onclick="DamanAdmin.exportAccountingCsv()" class="px-2 py-1 rounded-lg bg-slate-900 text-emerald-300 font-black text-[10px]">Excel</button>
                <button onclick="DamanAdmin.printFinancialReportA4()" class="px-2 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">تقرير A4</button>
              </div>
            </div>
            <div class="text-[10px] text-slate-200">
              المفروض بالقنوات (افتتاحي + أمانات + أرباح): <b>${app.fmtMoney(s.expectedTotalCash)} ج.م</b> | الجرد الفعلي للقنوات: <b>${app.fmtMoney(s.actualChannelsTotal)} ج.م</b>
            </div>
          </div>

          <!-- Separated Vaults -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500 space-y-1">
              <div class="text-[10px] text-emerald-300 font-black">💰 خزنة أرباحك الصافية (كاش)</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(s.netCashProfitAll)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">أرباح: ${app.fmtMoney(s.grossCashProfitAll)} | مصروف/سحب: ${app.fmtMoney(s.totalExpensesAll)}</div>
            </div>
            <div class="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500 space-y-1">
              <div class="text-[10px] text-amber-300 font-black">🛡️ أمانات المستخدمين (كاش)</div>
              <div class="text-lg font-black text-white">${app.fmtMoney(s.totalUsersTrust)} <span class="text-[10px]">ج.م</span></div>
              <div class="text-[9.5px] text-slate-300">متاح: ${app.fmtMoney(s.usersAvail)} | ضمان: ${app.fmtMoney(s.usersEscrow)} | سحب: ${app.fmtMoney(s.usersHoldW)} | مجمّد: ${app.fmtMoney(s.usersFrozen)}</div>
            </div>
          </div>
          <div class="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[10.5px] text-purple-200 text-center">
            🎁 إجمالي رصيد الهدايا عند المستخدمين (غير قابل للسحب ولا يؤثر على الكاش): <b>${app.fmtMoney(s.usersBonus)} ج.م</b>
          </div>

          <!-- Period Filter KPIs -->
          <div class="glass-card rounded-2xl p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-black text-amber-400">📊 ملخص الحركة حسب الفترة</span>
              <div class="flex gap-1 text-[10px] font-bold">
                ${[['today', 'اليوم'], ['7d', '7 أيام'], ['30d', '30 يوم'], ['all', 'الكل']].map(([k, lbl]) => `
                  <button onclick="DamanAdmin.periodFilter='${k}'; DamanAdmin.rerender()" class="px-2 py-0.5 rounded-lg ${this.periodFilter === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
              </div>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10.5px]">
              <div class="p-2 rounded-xl bg-slate-950"><div class="text-slate-400">إيداعات</div><b class="text-emerald-400">+${app.fmtMoney(s.periodDep)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950"><div class="text-slate-400">مسحوبات</div><b class="text-rose-400">-${app.fmtMoney(s.periodWd)}</b></div>
              <div class="p-2 rounded-xl bg-slate-950"><div class="text-slate-400">صافي الربح</div><b class="text-amber-300">${app.fmtMoney(s.periodNet)}</b></div>
            </div>
          </div>

          <!-- 3-Channel Reconciliation + Today's Inflow Limit Monitor -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">⚖️ الجرد الفعلي لقنوات الدفع الثلاث + وارد اليوم (لمتابعة السقف اليومي)</div>
            <div class="grid grid-cols-3 gap-2 text-center">
              ${[['vodafone_cash', 'محافظ كاش'], ['instapay', 'إنستا باي'], ['bank', 'البنك']].map(([k, lbl]) => {
                const c = s.channels[k];
                return `
                  <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-0.5">
                    <div class="text-[10px] text-slate-400 font-bold">${lbl}</div>
                    <div class="text-xs font-black text-emerald-400">${app.fmtMoney(c.net)} ج.م</div>
                    <div class="text-[9px] text-amber-300">وارد اليوم: ${app.fmtMoney(c.todayIn)}</div>
                    <div class="text-[8.5px] text-slate-500">+${app.fmtMoney(c.dep)} / -${app.fmtMoney(c.wd + c.exp)}</div>
                  </div>`;
              }).join('')}
            </div>
          </div>

          <!-- Internal Treasury Transfer Between Channels -->
          <form onsubmit="DamanAdmin.recordTreasuryTransfer(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/30">
            <div class="font-black text-sky-300">🔁 تحويل داخلي بين قنواتك (مثلاً من فودافون كاش للبنك)</div>
            <div class="grid grid-cols-2 gap-2">
              <select id="tt-from" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="vodafone_cash">من: محافظ كاش</option><option value="instapay">من: إنستا باي</option><option value="bank">من: البنك</option></select>
              <select id="tt-to" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="bank">إلى: البنك</option><option value="instapay">إلى: إنستا باي</option><option value="vodafone_cash">إلى: محافظ كاش</option></select>
              <input id="tt-amt" type="number" min="1" step="any" required placeholder="المبلغ المحوّل (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-black" />
              <input id="tt-fee" type="number" min="0" step="any" value="0" placeholder="رسوم التحويل (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <input id="tt-note" type="text" placeholder="ملاحظة التحويل..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black">تسجيل التحويل الداخلي</button>
          </form>

          <!-- Record Admin Profit Withdrawal / Expense -->
          <form onsubmit="DamanAdmin.recordAdminExpense(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-purple-500/40">
            <div class="font-black text-purple-300">💸 سحب أرباح / تسجيل مصروف تشغيل من قناة محددة</div>
            <div class="grid grid-cols-3 gap-1.5">
              <input id="ae-amt" type="number" min="1" step="any" required placeholder="المبلغ ج.م" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white font-black" />
              <select id="ae-ch" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"><option value="vodafone_cash">من: محافظ كاش</option><option value="instapay">من: إنستا باي</option><option value="bank">من: البنك</option></select>
              <select id="ae-cat" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="profit_withdraw">سحب أرباح</option><option value="marketing">إعلانات</option><option value="operations">تشغيل</option></select>
            </div>
            <input id="ae-note" type="text" required placeholder="البيان..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">تسجيل الخصم من الأرباح والقناة</button>
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
          <!-- Instant Enable/Disable Toggles -->
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

          <!-- Active Accounts + 1-Click Backup Rotator -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-amber-500/40">
            <div class="font-black text-amber-400">📱 الحسابات النشطة حالياً (تظهر بمهلة العدّاد)</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">رقم المحفظة النشط</label><input id="sw-vf-num" type="text" value="${app.esc(acc.vodafoneCash || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">اسم صاحب المحفظة</label><input id="sw-vf-holder" type="text" value="${app.esc(acc.vodafoneHolder || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">عنوان إنستا باي النشط</label><input id="sw-ip-addr" type="text" value="${app.esc(acc.instaPay || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white font-black" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">اسم مستفيد إنستا باي</label><input id="sw-ip-holder" type="text" value="${app.esc(acc.instaPayHolder || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div><label class="block text-[10px] text-slate-400 mb-1">بيانات الحساب البنكي النشط</label><textarea id="sw-bk-info" rows="2" class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-sky-500/40 text-white">${app.esc(acc.bankInfo || '')}</textarea></div>
            <div><label class="block text-[10px] text-slate-400 mb-1">رقم IBAN (اختياري)</label><input id="sw-bk-iban" type="text" value="${app.esc(acc.bankIban || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>

            <!-- 1-Click Backup Switch Buttons -->
            ${(bkup.vodafoneCash || []).length ? `<div class="space-y-1"><div class="text-[10px] text-amber-300 font-bold">تبديل سريع لأرقام المحافظ الاحتياطية:</div><div class="flex flex-wrap gap-1">${bkup.vodafoneCash.map((v) => `<button type="button" onclick="DamanAdmin.quickActivateBackup('vodafoneCash','${app.esc(v).replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-[10px] font-bold">${app.esc(v)}</button>`).join('')}</div></div>` : ''}
            ${(bkup.instaPay || []).length ? `<div class="space-y-1"><div class="text-[10px] text-purple-300 font-bold">تبديل سريع لعناوين إنستا باي الاحتياطية:</div><div class="flex flex-wrap gap-1">${bkup.instaPay.map((v) => `<button type="button" onclick="DamanAdmin.quickActivateBackup('instaPay','${app.esc(v).replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-purple-500 text-[10px] font-bold">${app.esc(v)}</button>`).join('')}</div></div>` : ''}
          </div>

          <!-- Backup Pools Editor -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="font-black text-sky-400">🔄 قوائم الحسابات الاحتياطية (اكتب كل رقم في سطر)</div>
            <textarea id="sw-bkup-vf" rows="2" placeholder="أرقام فودافون/كاش احتياطية (كل رقم بسطر)" class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc((bkup.vodafoneCash || []).join('\n'))}</textarea>
            <textarea id="sw-bkup-ip" rows="2" placeholder="عناوين إنستا باي احتياطية (كل عنوان بسطر)" class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc((bkup.instaPay || []).join('\n'))}</textarea>
            <textarea id="sw-bkup-bk" rows="2" placeholder="حسابات بنكية احتياطية (كل حساب بسطر)" class="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc((bkup.bank || []).join('\n'))}</textarea>
          </div>

          <!-- Limits, Countdown, Per-Channel Withdraw Fees & Opening Balances -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <div class="font-black text-slate-200">⏱️ الحدود، العدّاد، رسوم السحب لكل وسيلة، والأرصدة الافتتاحية</div>
            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="text-[9.5px] text-slate-400">عدّاد الإيداع (دقيقة)</label><input id="sw-mins" type="number" min="2" max="30" value="${Number(cfg.depositSessionMinutes || 10)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[9.5px] text-slate-400">أدنى إيداع</label><input id="sw-mindep" type="number" value="${Number(cfg.minDeposit || 100)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">أقصى إيداع</label><input id="sw-maxdep" type="number" value="${Number(cfg.maxDeposit || 250000)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">أدنى سحب</label><input id="sw-minwd" type="number" value="${Number(cfg.minWithdraw || 100)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div class="col-span-2"><label class="text-[9.5px] text-slate-400">الحد الأقصى للسحب اليومي للمستخدم (ج.م)</label><input id="sw-maxwd" type="number" value="${Number(cfg.maxWithdrawDaily || 50000)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>

            <div class="grid grid-cols-3 gap-1.5 pt-1">
              <div class="p-2 rounded-xl bg-slate-950 space-y-1"><div class="text-[9.5px] text-amber-300 font-bold">رسوم سحب كاش</div><input id="sw-fee-vf-p" type="number" step="0.1" value="${app.esc(chF.vodafone_cash?.pct ?? '')}" placeholder="نسبة %" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /><input id="sw-fee-vf-f" type="number" step="any" value="${app.esc(chF.vodafone_cash?.flat ?? '')}" placeholder="ثابت ج.م" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
              <div class="p-2 rounded-xl bg-slate-950 space-y-1"><div class="text-[9.5px] text-purple-300 font-bold">رسوم سحب إنستا</div><input id="sw-fee-ip-p" type="number" step="0.1" value="${app.esc(chF.instapay?.pct ?? '')}" placeholder="نسبة %" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /><input id="sw-fee-ip-f" type="number" step="any" value="${app.esc(chF.instapay?.flat ?? '')}" placeholder="ثابت ج.م" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
              <div class="p-2 rounded-xl bg-slate-950 space-y-1"><div class="text-[9.5px] text-sky-300 font-bold">رسوم سحب بنك</div><input id="sw-fee-bk-p" type="number" step="0.1" value="${app.esc(chF.bank?.pct ?? '')}" placeholder="نسبة %" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /><input id="sw-fee-bk-f" type="number" step="any" value="${app.esc(chF.bank?.flat ?? '')}" placeholder="ثابت ج.م" class="w-full px-2 py-1 rounded bg-slate-900 text-white" /></div>
            </div>

            <div class="grid grid-cols-3 gap-1.5 pt-1">
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
          ${!pending.length ? `<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد طلبات معلّقة حالياً ✅</div>` : pending.map((r) => `
            <div class="glass-card rounded-2xl p-3.5 space-y-2 ${r.duplicateRefFlag || r.phoneMismatchFlag || r.rapidFlipFlag ? 'border-2 border-rose-500 bg-rose-500/5' : 'border-amber-500/40'}">
              ${r.duplicateRefFlag ? `<div class="p-1.5 rounded bg-rose-600 text-white font-black text-center text-[10px]">⚠️ تحذير: الرقم المرجعي ظهر سابقاً — افحص قبل الاعتماد!</div>` : ''}
              ${r.phoneMismatchFlag ? `<div class="p-1.5 rounded bg-amber-600 text-white font-black text-center text-[10px]">⚠️ تنبيه: رقم محفظة الاستلام مختلف عن رقم موبايل المستخدم الموثّق!</div>` : ''}
              ${r.rapidFlipFlag ? `<div class="p-1.5 rounded bg-purple-600 text-white font-black text-center text-[10px]">⚠️ تنبيه: سحب سريع على قناة مختلفة عن الإيداع بدون تعاملات!</div>` : ''}

              <div class="flex justify-between items-center">
                <b class="${r.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'}">${r.type === 'deposit' ? '⬇️ شحن / إيداع' : '⬆️ سحب كاش'} — ${app.fmtMoney(r.amount)} ج.م</b>
                <button onclick="DamanAdmin.openUser360Modal('${r.userId}')" class="px-2 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px] font-bold">ملف 360°</button>
              </div>
              <div class="text-[11px] text-slate-200">${app.esc(r.userLegalName || r.userName)} (${app.esc(r.userPhone || '')}) • ${app.esc(r.channel)} • ${app.esc(r.date || '')}</div>
              ${r.txRef ? `<div class="text-[10.5px] text-amber-300">المرجع: <b class="select-all">${app.esc(r.txRef)}</b> | من: ${app.esc(r.senderAccount || '')}</div>` : ''}
              ${r.targetAccountUsed ? `<div class="text-[10px] text-slate-400">الحساب المستلم وقت الطلب: ${app.esc(r.targetAccountUsed)}</div>` : ''}
              ${r.destAccount ? `<div class="text-[11px] text-emerald-300 font-black">تحويل إلى: <span class="select-all">${app.esc(r.destAccount)}</span> (الصافي: ${app.fmtMoney(r.netPayout || r.amount)} ج.م)</div>` : ''}

              ${r.type === 'deposit' ? `
                <div class="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-emerald-500/30">
                  <span class="text-[10px] text-emerald-300 font-bold shrink-0">المبلغ الواصل فعلياً:</span>
                  <input id="adm-act-amt-${r.id}" type="number" step="any" value="${Number(r.amount || 0)}" class="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-black" />
                  ${r.receiptMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.receiptMedia}','إيصال إيداع')" class="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-black text-[10px] shrink-0">الإيصال</button>` : ''}
                </div>` : `
                <div class="space-y-1.5 p-2 rounded-xl bg-slate-950 border border-amber-500/30">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-amber-300 font-bold shrink-0">رسوم التحويل عليك (ج.م):</span>
                    <input id="adm-tr-cost-${r.id}" type="number" min="0" step="any" value="0" class="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold" />
                  </div>
                  <label class="block p-1.5 rounded-lg border border-dashed border-emerald-500/50 text-center cursor-pointer text-[10px] text-emerald-300 font-bold">
                    📷 إرفاق سكرين إيصال التحويل للمستخدم (اختياري)
                    <input type="file" accept="image/*" class="hidden" onchange="DamanAdmin.handlePayoutReceiptFile(this,'${r.id}')" />
                    <div id="adm-pout-prev-${r.id}"></div>
                  </label>
                </div>`}

              <div class="grid grid-cols-2 gap-2">
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','approve')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد وتنفيذ</button>
                <button onclick="DamanAdmin.handleWalletReq('${r.id}','reject')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
              </div>
            </div>`).join('')}

          <div class="font-bold text-slate-400 pt-2">آخر العمليات المنفّذة (${done.length})</div>
          ${done.slice(0, 15).map((r) => `<div class="glass-card rounded-xl p-2.5 flex justify-between text-[11px]"><span>${r.type === 'deposit' ? '⬇️' : '⬆️'} ${app.esc(r.userName)} — ${app.fmtMoney(r.actualAmount || r.amount)} ج.م (${app.esc(r.channel)})</span><b class="${r.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}">${app.esc(r.status)}</b></div>`).join('')}
          <button onclick="DamanAdmin.loadMore('wallet')" class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">تحميل المزيد</button>
        </div>`;
    },

    renderKycTab(app) {
      const pending = this.kycReqs.filter((k) => k.status === 'pending');
      const others = this.kycReqs.filter((k) => k.status !== 'pending');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-amber-400">طلبات التوثيق المعلّقة (${pending.length})</div>
          ${!pending.length ? `<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد طلبات توثيق معلّقة ✅</div>` : pending.map((k) => {
            const isComp = k.accountType === 'company' || k.accountType === 'supplier';
            return `
              <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-amber-500/50">
                <div class="flex justify-between"><b class="text-white">${app.esc(k.displayName || k.legalName)}</b><span class="text-sky-300">${app.esc(k.phone || '')}</span></div>
                <div class="flex flex-wrap gap-1.5">
                  <button onclick="DamanApp.openMediaLightbox('${k.idFrontMedia}','وش البطاقة')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 وش</button>
                  <button onclick="DamanApp.openMediaLightbox('${k.idBackMedia}','ضهر البطاقة')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[10px]">🪪 ضهر</button>
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
                  <button onclick="DamanAdmin.approveKyc('${k.id}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">✅ اعتماد وتثبيت</button>
                  <button onclick="DamanAdmin.rejectKyc('${k.id}')" class="py-2 rounded-xl bg-rose-500 text-white font-black">❌ رفض</button>
                </div>
              </div>`;
          }).join('')}
          ${others.slice(0, 10).map((k) => `<div class="glass-card rounded-xl p-2.5 flex justify-between text-[11px]"><span>${app.esc(k.legalName)} (${app.esc(k.nationalId)})</span><b class="${k.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'}">${app.esc(k.status)}</b></div>`).join('')}
        </div>`;
    },

    renderContractsTab(app) {
      const pendingSigned = this.agreements.filter((a) => a.contractStatus === 'pending_admin');
      const activeFunded = this.agreements.filter((a) => a.status === 'funded');
      const openDisputes = this.disputes.filter((d) => d.status === 'open');
      return `
        <div class="space-y-3 text-xs">
          <div class="font-black text-amber-400">📄 عقود موقّعة بانتظار الاعتماد (${pendingSigned.length})</div>
          ${!pendingSigned.length ? `<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد عقود معلّقة</div>` : pendingSigned.map((a) => `
            <div class="glass-card rounded-2xl p-3 space-y-2 border-amber-500/50">
              <div class="flex justify-between"><b class="text-white">${app.esc(a.ticketNumber)} • ${app.esc(a.title)}</b><b class="text-emerald-400">${app.fmtMoney(a.totalAmount)} ج.م</b></div>
              <div class="text-[10.5px] text-slate-300">${app.esc(a.payerLegalName || a.payerName)} ⇄ ${app.esc(a.providerLegalName || a.providerName)} | ${app.esc(a.startDate || '')} → ${app.esc(a.endDate || '')}</div>
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

          <div class="font-black text-sky-400 pt-2">🛡️ العقود النشطة المموّلة (${activeFunded.length})</div>
          ${activeFunded.slice(0, 15).map((a) => `
            <div class="glass-card rounded-xl p-2.5 flex justify-between items-center gap-2">
              <div class="min-w-0"><b class="text-white truncate block">${app.esc(a.ticketNumber)} — ${app.esc(a.title)}</b><span class="text-[10px] text-slate-400">متبقي: ${app.fmtMoney(a.remainingEscrow)} ج.م • تسليم: ${app.esc(a.endDate || '')}</span></div>
              ${app.isAdmin() ? `<button onclick="DamanAdmin.forceRefundActiveContract('${a.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px] shrink-0">فسخ طارئ</button>` : ''}
            </div>`).join('')}
        </div>`;
    },

    renderMarketTab(app) {
      const pendingPosts = this.projects.filter((p) => p.status === 'pending_review');
      return `
        <div class="space-y-4 text-xs">
          <div class="space-y-2">
            <div class="font-black text-amber-400">📢 إعلانات بانتظار الموافقة (${pendingPosts.length})</div>
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
                <div class="flex flex-wrap gap-1.5">
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteInspection('${r.id}')" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">تسعير الطلب</button>` : ''}
                  ${r.status === 'paid' ? `<label class="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] cursor-pointer">📄 رفع التقرير الهندسي وإغلاق<input type="file" accept="image/*" class="hidden" onchange="DamanAdmin.uploadInspectionReport(this,'${r.id}')" /></label>` : ''}
                  ${r.reportMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.reportMedia}','التقرير الهندسي')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">عرض التقرير</button>` : ''}
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
                  ${['pending', 'quoted'].includes(r.status) ? `<button onclick="DamanAdmin.quoteVipLabor('${r.id}')" class="flex-1 py-1.5 rounded-lg bg-purple-500 text-white font-black text-[10px]">تسعير (+ VIP)</button>` : ''}
                  ${r.status === 'funded' ? `<button onclick="DamanAdmin.settleVipLabor('${r.id}','settle')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">✅ تسوية</button><button onclick="DamanAdmin.settleVipLabor('${r.id}','refund')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">ردّ</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد طلبات</div>'}
          </div>

          <div class="space-y-1.5">
            <div class="font-black text-slate-300">إدارة كل إعلانات المستخدمين (${this.projects.length})</div>
            ${this.projects.slice(0, 15).map((p) => {
              const boosted = Number(p.boostedUntil || 0) > Date.now();
              return `<div class="glass-card rounded-xl p-2.5 flex justify-between items-center gap-2"><span class="truncate text-white font-bold">${boosted ? '★ ' : ''}${app.esc(p.title)}</span><div class="flex gap-1 shrink-0"><button onclick="DamanAdmin.toggleBoostProject('${p.id}',${boosted})" class="px-2 py-1 rounded bg-purple-500/20 text-purple-200 text-[10px] font-bold">${boosted ? 'إلغاء ★' : 'تمييز ★'}</button><button onclick="DamanAdmin.deleteProjectAdmin('${p.id}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px]">حذف</button></div></div>`;
            }).join('')}
          </div>
        </div>`;
    },

    renderAdsAndBrandingTab(app) {
      const cfg = app.appConfig || {};
      const br = cfg.branding || {};
      const ann = cfg.announcement || {};
      const customBanners = Array.isArray(cfg.customHomeBanners) ? cfg.customHomeBanners : [];

      return `
        <div class="space-y-3.5 text-xs">
          <!-- Global Announcement Bar + Dynamic Branding Texts -->
          <form onsubmit="DamanAdmin.saveAnnouncementAndBranding(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-amber-500/40">
            <div class="font-black text-amber-400">📣 الشريط العاجل أعلى التطبيق + التحكم في كل حرف بالتطبيق</div>
            <label class="flex items-center gap-2 p-2 rounded-xl bg-slate-950 font-bold text-amber-300"><input id="an-en" type="checkbox" ${ann.enabled ? 'checked' : ''} class="accent-amber-500" /> تفعيل شريط التنبيه العاجل فوق التطبيق</label>
            <input id="an-txt" type="text" value="${app.esc(ann.text || '')}" placeholder="نص الشريط العاجل (مثال: خصم 20% على استلام الأسقف 3x هذا الأسبوع!)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <select id="an-col" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="amber" ${ann.color === 'amber' ? 'selected' : ''}>لون ذهبي</option><option value="emerald" ${ann.color === 'emerald' ? 'selected' : ''}>لون أخضر</option><option value="rose" ${ann.color === 'rose' ? 'selected' : ''}>لون أحمر عاجل</option><option value="sky" ${ann.color === 'sky' ? 'selected' : ''}>لون أزرق</option></select>
              <select id="an-act" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="none">بدون انتقال</option><option value="inspection" ${ann.action === 'inspection' ? 'selected' : ''}>يفتح استلام 3x</option><option value="viplabor" ${ann.action === 'viplabor' ? 'selected' : ''}>يفتح عمالة VIP</option><option value="market" ${ann.action === 'market' ? 'selected' : ''}>يفتح السوق</option><option value="whatsapp" ${ann.action === 'whatsapp' ? 'selected' : ''}>يفتح واتساب</option></select>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <div><label class="text-[10px] text-slate-400">اسم التطبيق (عربي)</label><input id="br-ar" type="text" value="${app.esc(br.appNameAr || 'ضمان سايت')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[10px] text-slate-400">اسم التطبيق (إنجليزي)</label><input id="br-en" type="text" value="${app.esc(br.appNameEn || 'DamanSite')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[10px] text-slate-400">الشعار الفرعي (عربي)</label><input id="br-tag-ar" type="text" value="${app.esc(br.taglineAr || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[10px] text-slate-400">الشعار الفرعي (EN)</label><input id="br-tag-en" type="text" value="${app.esc(br.taglineEn || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <input id="br-hw" type="text" value="${app.esc(br.heroWelcome || '')}" placeholder="سطر الترحيب بالرئيسية" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <input id="br-ht" type="text" value="${app.esc(br.heroGuestTitle || '')}" placeholder="العنوان الرئيسي للزوار" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
            <textarea id="br-hd" rows="2" placeholder="الوصف للزوار..." class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(br.heroGuestDesc || '')}</textarea>
            <div><label class="text-[10px] text-slate-400">نص سياسة الخصوصية والشروط الكامل:</label><textarea id="br-priv" rows="3" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white">${app.esc(br.privacyText || '')}</textarea></div>
            <div class="grid grid-cols-2 gap-2 text-[10.5px] font-bold">
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ad-hide-demo" type="checkbox" ${cfg.hideDemoPosts ? 'checked' : ''} class="accent-rose-500" /> إخفاء الـ 20 منشور توضيحي</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ad-hide-off" type="checkbox" ${cfg.hideOfficialBanners ? 'checked' : ''} class="accent-rose-500" /> إخفاء الـ 6 بانرات الرسمية</label>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ وتطبيق النصوص والشريط فوراً</button>
          </form>

          <!-- Add Custom Home Banner -->
          <form onsubmit="DamanAdmin.addCustomHomeBanner(event)" class="glass-card rounded-2xl p-4 space-y-2 border-emerald-500/40">
            <div class="font-black text-emerald-400">+ إضافة إعلان / بانر جديد خاص بك على الرئيسية</div>
            <div class="grid grid-cols-2 gap-2">
              <input id="hb-badge" type="text" placeholder="شارة فوق (عرض خاص 🔥)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="hb-theme" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"><option value="amber">ذهبي</option><option value="emerald">أخضر</option><option value="purple">بنفسجي</option><option value="sky">أزرق</option></select>
            </div>
            <input id="hb-title" type="text" required placeholder="عنوان الإعلان" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-bold" />
            <textarea id="hb-sub" rows="2" required placeholder="تفاصيل الإعلان..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <div class="grid grid-cols-2 gap-2">
              <input id="hb-cta" type="text" value="اطلب الآن" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="hb-act" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="admin_chat">شات الإدارة</option><option value="inspection">استلام 3x</option><option value="viplabor">عمالة VIP</option><option value="market">السوق</option><option value="company">الشركات</option><option value="whatsapp">واتساب</option></select>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">نشر الإعلان على الرئيسية</button>
          </form>

          ${customBanners.map((b) => `<div class="glass-card rounded-xl p-3 flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-white block truncate">${app.esc(b.title)}</b><span class="text-[10px] text-slate-400 truncate block">${app.esc(b.subtitle)}</span></div><button onclick="DamanAdmin.deleteCustomHomeBanner('${b.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px]">حذف</button></div>`).join('')}
        </div>`;
    },

    renderCompaniesTab(app) {
      return `
        <div class="space-y-2.5 text-xs">
          <div class="font-black text-sky-400">🏢 السيطرة الشاملة على الشركات (${this.companies.length})</div>
          ${!this.companies.length ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد شركات مسجّلة بعد.</div>` : this.companies.map((c) => `
            <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 ${c.status === 'suspended' ? 'border-rose-500/50 opacity-75' : ''}">
              <div class="min-w-0"><div class="font-black text-white truncate">${app.esc(c.name)} ${c.status === 'suspended' ? '🚫' : ''}</div><div class="text-[10px] text-amber-300">الكود: ${app.esc(c.code)} • ${app.esc(c.ownerName || '')} • مواقع: ${(c.sites || []).length}</div></div>
              <div class="flex gap-1 shrink-0">
                <button onclick="DamanAdmin.openCompanyControlModal('${c.id}')" class="px-2.5 py-1.5 rounded-xl bg-purple-500 text-white font-black text-[10px]">تحكّم</button>
                ${app.isAdmin() ? `<button onclick="DamanAdmin.toggleCompanyStatus('${c.id}','${c.status || 'active'}')" class="px-2 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[10px]">${c.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button>` : ''}
              </div>
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
          <!-- Broadcast Form -->
          ${app.isAdmin() ? `
            <form onsubmit="DamanAdmin.sendBroadcastNotification(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-purple-500/40">
              <div class="font-black text-purple-300">📣 إرسال إشعار جماعي فوري (Broadcast)</div>
              <div class="grid grid-cols-2 gap-1.5">
                <select id="bc-seg" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold"><option value="all">كل المستخدمين (${this.users.length})</option><option value="company">الشركات فقط</option><option value="supplier">الموردين B2B فقط</option><option value="individual">الأفراد والمقاولين</option></select>
                <input id="bc-title" type="text" required placeholder="عنوان الإشعار" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              </div>
              <input id="bc-body" type="text" required placeholder="نص الرسالة الجماعية..." class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">إرسال الإشعار الجماعي</button>
            </form>` : ''}

          <!-- Birthdays Today -->
          <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2">
            <div class="font-black text-amber-300">🎂 أعياد ميلاد اليوم (${bdays.length})</div>
            ${!bdays.length ? `<div class="text-[10.5px] text-slate-400">لا يوجد أعياد ميلاد اليوم.</div>` : bdays.map((u) => `<div class="flex items-center justify-between bg-slate-950/70 p-2 rounded-xl"><b class="text-white">${app.esc(u.legalName || u.name)}</b><button onclick="DamanAdmin.sendBirthdayGift('${u.id}','${app.esc(u.name || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">🎁 هدية</button></div>`).join('')}
          </div>

          ${openReports.length ? `<div class="space-y-1.5"><div class="font-black text-rose-400">🚨 بلاغات مفتوحة (${openReports.length})</div>${openReports.map((r) => `<div class="glass-card rounded-xl p-2.5 border-rose-500/40 space-y-1"><div class="font-bold text-white">${app.esc(r.targetTitle)} — ${app.esc(r.reason)}</div><button onclick="DamanAdmin.resolveReport('${r.id}','closed')" class="px-3 py-1 rounded-lg bg-slate-800 text-emerald-300 font-bold text-[10px]">إغلاق</button></div>`).join('')}</div>` : ''}

          <input type="text" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالاسم / القومي / الموبايل / الإيميل..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          ${filtered.map((u) => `
            <div class="glass-card rounded-2xl p-3 space-y-1">
              <div class="flex justify-between"><b class="text-white">${app.esc(u.name)} ${u.kycStatus === 'verified' ? '✅' : ''} ${u.status === 'banned' ? '🚫' : ''}</b><span class="text-emerald-400 font-bold">كاش: ${app.fmtMoney(u.balanceAvailable || 0)} | ضمان: ${app.fmtMoney(u.balanceEscrow || 0)}</span></div>
              <div class="text-[10px] text-slate-400">${app.esc(u.phone || '')} • ${app.esc(u.email || '')} • قومي: ${app.esc(u.nationalId || '—')}</div>
              ${u.adminCrmNote ? `<div class="text-[10px] text-amber-300">📌 ملاحظة سرية: ${app.esc(u.adminCrmNote)}</div>` : ''}
              <div class="flex gap-1.5 pt-1">
                <button onclick="DamanAdmin.openUser360Modal('${u.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">🔎 ملف 360° وتحكم مالي</button>
                <button onclick="DamanApp.openPublicProfile('${u.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">صفحته</button>
                <button onclick="DamanAdmin.deleteUserSafely('${u.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
              </div>
            </div>`).join('')}
          <button onclick="DamanAdmin.loadMore('users')" class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">تحميل المزيد</button>

          <form onsubmit="DamanAdmin.addBlacklistEntry(event)" class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/40">
            <div class="font-black text-rose-400">🚫 القائمة السوداء (${this.blacklist.length})</div>
            <div class="grid grid-cols-2 gap-2"><input id="bl-val" type="text" required placeholder="رقم قومي / موبايل / إيميل" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /><input id="bl-reason" type="text" placeholder="السبب" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            <button type="submit" class="w-full py-1.5 rounded-lg bg-rose-500 text-white font-black">إضافة للحظر الدائم</button>
            <div class="flex flex-wrap gap-1">${this.blacklist.map((b) => `<span class="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-rose-300">${app.esc(b.value)} <button type="button" onclick="DamanAdmin.removeBlacklist('${b.id}')" class="text-white ms-1">×</button></span>`).join('')}</div>
          </form>

          <form onsubmit="DamanAdmin.createPromoCode(event)" class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🎁 إنشاء كود هدية (يضاف لرصيد الهدايا فقط)</div>
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

    renderSecurityTab(app) {
      const mods = Array.isArray(app.appConfig?.moderators) ? app.appConfig.moderators : [];
      const pMap = app.appConfig?.moderatorPerms || {};
      const ms = this.mediaStats || { total: 0, recordings: 0, receipts: 0, kyc: 0 };

      return `
        <div class="space-y-3.5 text-xs">
          <!-- Granular RBAC Moderators -->
          <form onsubmit="DamanAdmin.saveModeratorRBAC(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5 border-purple-500/40">
            <div class="font-black text-purple-300">🛡️ صلاحيات المشرفين المساعدين (RBAC — بدون خزنة أو إعدادات)</div>
            <input id="rb-email" type="email" required placeholder="إيميل المشرف (example@gmail.com)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-1.5 text-[10.5px]">
              <label class="flex items-center gap-1.5"><input id="rb-kyc" type="checkbox" checked class="accent-purple-500" /> مراجعة التوثيق</label>
              <label class="flex items-center gap-1.5"><input id="rb-wallet" type="checkbox" class="accent-purple-500" /> الشحن والسحب</label>
              <label class="flex items-center gap-1.5"><input id="rb-contracts" type="checkbox" checked class="accent-purple-500" /> العقود والنزاعات</label>
              <label class="flex items-center gap-1.5"><input id="rb-market" type="checkbox" checked class="accent-purple-500" /> السوق و3x وVIP</label>
              <label class="flex items-center gap-1.5"><input id="rb-companies" type="checkbox" class="accent-purple-500" /> مراقبة الشركات</label>
              <label class="flex items-center gap-1.5"><input id="rb-users" type="checkbox" checked class="accent-purple-500" /> المستخدمين والبلاغات</label>
              <label class="flex items-center gap-1.5"><input id="rb-comms" type="checkbox" checked class="accent-purple-500" /> الشات والتذاكر</label>
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">حفظ / إضافة مشرف</button>
            ${mods.map((em) => {
              const pm = pMap[em.toLowerCase()];
              const activeP = pm ? Object.entries(pm).filter(([, v]) => v).map(([k]) => k).join(', ') : 'كل صلاحيات الإشراف';
              return `<div class="p-2 rounded-xl bg-slate-950 flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-white block truncate">${app.esc(em)}</b><span class="text-[9.5px] text-slate-400">${app.esc(activeP)}</span></div><button type="button" onclick="DamanAdmin.removeModerator('${app.esc(em)}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px]">حذف</button></div>`;
            }).join('')}
          </form>

          <!-- Media Vault Storage Monitor -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🧹 مراقبة وتنظيف خزنة المرفقات (Media Vault)</div>
            <div class="text-[11px] text-slate-300">إجمالي الملفات: <b>${ms.total}</b> (بطاقات: ${ms.kyc} | إيصالات: ${ms.receipts} | تسجيلات: ${ms.recordings})</div>
            <button onclick="DamanAdmin.cleanupExpiredRecordings()" class="w-full py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black">تنظيف تسجيلات المكالمات المنتهية (&gt;30 يوم)</button>
          </div>

          <!-- Immutable Audit Log -->
          <div class="space-y-1.5">
            <div class="font-black text-amber-400">📜 سجل الرقابة والتدقيق الإداري (Audit Log — آخر ${this.auditLogs.length} عملية)</div>
            ${this.auditLogs.map((l) => `
              <div class="glass-card rounded-xl p-2.5 text-[10.5px] space-y-0.5">
                <div class="flex justify-between"><b class="text-amber-300">${app.esc(l.action)}</b><span class="text-slate-500">${app.esc(l.date)} ${app.esc(l.time || '')}</span></div>
                <div class="text-white">${app.esc(l.details)}</div>
                <div class="text-[9.5px] text-slate-400">بواسطة: ${app.esc(l.actorEmail || l.actorName)}</div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد عمليات مسجّلة بعد</div>'}
          </div>
        </div>`;
    },

    renderSettingsTab(app) {
      const cfg = app.appConfig || {};
      const pkgs = cfg.packages || {};
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanAdmin.saveEmergencyAndGeneralSettings(event)" class="glass-card rounded-2xl p-4 space-y-3 border-rose-500/40">
            <div class="font-black text-rose-400">🚨 مفاتيح الطوارئ والسيطرة الفورية (7 Kill-Switches)</div>
            <div class="grid grid-cols-2 gap-1.5 text-[10.5px] font-bold">
              <label class="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center gap-1.5 text-rose-200"><input id="ks-maint" type="checkbox" ${cfg.maintenanceMode ? 'checked' : ''} class="accent-rose-500" /> وضع الصيانة العام</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ks-noreg" type="checkbox" ${cfg.disableRegistrations ? 'checked' : ''} class="accent-rose-500" /> إيقاف التسجيل الجديد</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ks-nodep" type="checkbox" ${cfg.disableDeposits ? 'checked' : ''} class="accent-rose-500" /> إيقاف الإيداعات</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ks-nowd" type="checkbox" ${cfg.disableWithdrawals ? 'checked' : ''} class="accent-rose-500" /> إيقاف السحب</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ks-nocalls" type="checkbox" ${cfg.disableCalls ? 'checked' : ''} class="accent-amber-500" /> إيقاف المكالمات</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ks-noct" type="checkbox" ${cfg.disableNewContracts ? 'checked' : ''} class="accent-amber-500" /> إيقاف العقود الجديدة</label>
              <label class="p-2 rounded-xl bg-slate-950 flex items-center gap-1.5"><input id="ks-nopost" type="checkbox" ${cfg.disableMarketPosting ? 'checked' : ''} class="accent-amber-500" /> إيقاف النشر بالسوق</label>
              <label class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1.5 text-emerald-300"><input id="ks-reqkyc" type="checkbox" ${cfg.requireKycForActions !== false ? 'checked' : ''} class="accent-emerald-500" /> توثيق البطاقة إجباري</label>
            </div>
            <input id="ks-maint-msg" type="text" value="${app.esc(cfg.maintenanceMessage || '')}" placeholder="رسالة شاشة الصيانة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />

            <div class="font-black text-amber-400 pt-1">⚙️ العمولات، أسعار الباقات، الواتساب والـ TURN</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-slate-400">عمولة الضمان %</label><input id="st-comm" type="number" step="0.1" value="${(Number(cfg.commissionRate || 0.035) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[10px] text-slate-400">عمولة عمالة VIP %</label><input id="st-vipcomm" type="number" step="0.5" value="${(Number(cfg.vipCommissionRate || 0.10) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div><label class="text-[9.5px] text-slate-400">باقة أفراد</label><input id="st-pkg-ind" type="number" value="${Number(pkgs.individualMonthly || 150)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">باقة شركات</label><input id="st-pkg-comp" type="number" value="${Number(pkgs.companyMonthly || 450)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">تمييز إعلان</label><input id="st-pkg-boost" type="number" value="${Number(pkgs.boostAdPrice || 75)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <input id="st-wa" type="text" value="${app.esc(cfg.supportWhatsapp || '201030374787')}" placeholder="رقم واتساب الدعم بدون +" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <input id="st-turn" type="text" value="${app.esc(cfg.turnServer || '')}" placeholder="سيرفر TURN للمكالمات (اختياري: url|user|pass)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">حفظ وتطبيق كل الإعدادات فوراً</button>
          </form>

          <div class="grid grid-cols-2 gap-2">
            <button onclick="DamanAdmin.triggerForceReloadAllDevices()" class="py-3 rounded-2xl bg-sky-600 text-white font-black text-[11px]"><i class="fa-solid fa-bolt me-1"></i> إجبار تحديث كل الأجهزة</button>
            <button onclick="DamanAdmin.exportFullBackup()" class="py-3 rounded-2xl bg-emerald-600 text-white font-black text-[11px]"><i class="fa-solid fa-database me-1"></i> نسخة احتياطية JSON</button>
          </div>
        </div>`;
    },

    // ==================== MAIN ADMIN RENDER ====================
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
        app.canMod('market') ? ['market', '🏗️ السوق و3x وVIP'] : null,
        isMain ? ['ads', '📢 الإعلانات والنصوص'] : null,
        app.canMod('companies') ? ['companies', '🏢 الشركات'] : null,
        app.canMod('users') ? ['users', '👥 المستخدمين 360°'] : null,
        app.canMod('comms') ? ['comms', '🎙️ الشات والتذاكر'] : null,
        isMain ? ['security', '🛡️ المشرفين والسجل'] : null,
        isMain ? ['settings', '⚙️ الطوارئ والنسخ'] : null
      ].filter(Boolean);

      if (!tabs.some(([k]) => k === this.subTab) && tabs.length) this.subTab = tabs[0][0];

      // Action Center Red Counters
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
          <div class="flex justify-between"><b class="text-amber-400">نتائج البحث الشامل: "${app.esc(this.omniQuery)}"</b><button onclick="DamanAdmin.omniResults=null; DamanAdmin.rerender()" class="text-rose-400 font-bold">إغلاق ×</button></div>
          ${this.omniResults.users.map((u) => `<div onclick="DamanAdmin.openUser360Modal('${u.id}')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>👤 ${app.esc(u.name)} (${app.esc(u.phone || '')})</span><b class="text-sky-300">ملف 360°</b></div>`).join('')}
          ${this.omniResults.wallets.map((w) => `<div onclick="DamanAdmin.setSubTab('wallet')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>💳 ${app.esc(w.userName)} (${app.esc(w.txRef || w.destAccount || '')})</span><b class="text-emerald-400">${app.fmtMoney(w.amount)} (${w.status})</b></div>`).join('')}
          ${this.omniResults.contracts.map((a) => `<div onclick="DamanAdmin.setSubTab('contracts')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>📄 ${app.esc(a.ticketNumber)} — ${app.esc(a.title)}</span><b class="text-amber-300">${app.fmtMoney(a.totalAmount)}</b></div>`).join('')}
          ${this.omniResults.companies.map((co) => `<div onclick="DamanAdmin.setSubTab('companies')" class="p-1.5 rounded bg-slate-950 cursor-pointer flex justify-between"><span>🏢 ${app.esc(co.name)} (${app.esc(co.code)})</span><b class="text-purple-300">شركة</b></div>`).join('')}
          ${!this.omniResults.users.length && !this.omniResults.wallets.length && !this.omniResults.contracts.length && !this.omniResults.companies.length ? '<div class="text-slate-400 text-center">لا توجد نتائج مطابقة</div>' : ''}
        </div>` : '';

      let body = '';
      try {
        if (this.loading) body = `<div class="glass-card rounded-2xl p-8 text-center text-xs text-amber-400 font-bold animate-pulse">جارٍ تحميل بيانات لوحة السيطرة...</div>`;
        else if (this.subTab === 'payments') body = this.renderPaymentsTab(app);
        else if (this.subTab === 'wallet') body = this.renderWalletTab(app);
        else if (this.subTab === 'kyc') body = this.renderKycTab(app);
        else if (this.subTab === 'contracts') body = this.renderContractsTab(app);
        else if (this.subTab === 'market') body = this.renderMarketTab(app);
        else if (this.subTab === 'ads') body = this.renderAdsAndBrandingTab(app);
        else if (this.subTab === 'companies') body = this.renderCompaniesTab(app);
        else if (this.subTab === 'users') body = this.renderUsersTab(app);
        else if (this.subTab === 'comms') body = this.renderCommsTab(app);
        else if (this.subTab === 'security') body = this.renderSecurityTab(app);
        else if (this.subTab === 'settings') body = this.renderSettingsTab(app);
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

          <!-- Omni-Search -->
          <form onsubmit="DamanAdmin.runOmniSearch(event)" class="flex gap-1.5 text-xs">
            <input id="adm-omni-q" type="text" value="${app.esc(this.omniQuery)}" placeholder="بحث شامل: TKT- / CMP- / رقم مرجعي / رقم قومي / موبايل..." class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            <button type="submit" class="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black"><i class="fa-solid fa-magnifying-glass"></i></button>
          </form>
          ${omniBox}

          <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
            ${tabs.map(([k, lbl]) => `
              <button onclick="DamanAdmin.setSubTab('${k}')" class="shrink-0 px-3 py-2 rounded-xl ${this.subTab === k ? 'bg-purple-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
          </div>

          ${this.lastErrors.length ? `<div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/50 text-[10px] text-rose-200">⚠️ تنبيه صلاحيات: ${app.esc(this.lastErrors.join(' | '))}</div>` : ''}
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
