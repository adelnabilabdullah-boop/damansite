(function () {
  const CompanyMod = {
    subTab: 'attendance', // 'attendance' | 'overtime' | 'subcontractors' | 'ops' | 'progress' | 'custody' | 'payroll' | 'reports' | 'pnl' | 'team' | 'leaves' | 'group'
    opsSubTab: 'inventory', // 'inventory' | 'concrete' | 'mr' | 'equipment'
    selectedSiteId: 'all',

    company: null,
    members: [],
    sites: [],
    attendance: [],
    payrollLogs: [],
    custodies: [],
    dailyReports: [],
    leaves: [],
    groupMsgs: [],
    ops: [], // Unified fast collection: overtime, subcontractor, sub_tx, inventory, concrete, mr, equipment, unit, snag, task, advance

    attachedUid: null,
    attachedCompId: null,
    unsubs: [],

    tempSelfieBase64: '',
    tempBulkPhoto: '',
    tempCustodyPhoto: '',
    tempDedPhoto: '',
    tempSnagBefore: '',
    tempReportPhoto: '',

    // ==================== LIFECYCLE & LISTENERS (ZERO COMPOSITE INDEXES) ====================
    ensureListeners(app) {
      if (!app.user || !app.profile) {
        this.detachListeners();
        return;
      }
      const compId = app.profile.companyId || '';
      if (this.attachedUid === app.user.uid && this.attachedCompId === compId) return;

      this.detachListeners();
      this.attachedUid = app.user.uid;
      this.attachedCompId = compId;
      if (!compId) return;

      const db = app.db;
      const pushUnsub = (u) => { if (u) this.unsubs.push(u); };
      const sortDesc = (arr) => arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      pushUnsub(
        db.collection('companies').doc(compId).onSnapshot((snap) => {
          this.company = snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
          this.sites = Array.isArray(this.company?.sites) ? this.company.sites : [];
          if (app.activeTab === 'company') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyMembers').where('companyId', '==', compId).limit(150).onSnapshot((snap) => {
          this.members = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyAttendance').where('companyId', '==', compId).limit(200).onSnapshot((snap) => {
          this.attendance = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && this.subTab === 'attendance') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyPayroll').where('companyId', '==', compId).limit(120).onSnapshot((snap) => {
          this.payrollLogs = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && ['payroll', 'pnl'].includes(this.subTab)) this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyCustody').where('companyId', '==', compId).limit(150).onSnapshot((snap) => {
          this.custodies = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && ['custody', 'pnl'].includes(this.subTab)) this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyDailyReports').where('companyId', '==', compId).limit(80).onSnapshot((snap) => {
          this.dailyReports = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && this.subTab === 'reports') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyLeaves').where('companyId', '==', compId).limit(80).onSnapshot((snap) => {
          this.leaves = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && this.subTab === 'leaves') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyMessages').where('companyId', '==', compId).limit(80).onSnapshot((snap) => {
          this.groupMsgs = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
          if (app.activeTab === 'company' && this.subTab === 'group') this.rerender();
        }, () => {})
      );

      // Single fast listener for all Construction ERP Site Operations
      pushUnsub(
        db.collection('companyOps').where('companyId', '==', compId).limit(400).onSnapshot((snap) => {
          this.ops = sortDesc(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company') this.rerender();
        }, () => {})
      );
    },

    detachListeners() {
      this.unsubs.forEach((u) => { try { u(); } catch (e) {} });
      this.unsubs = [];
      this.attachedUid = null;
      this.attachedCompId = null;
      this.company = null;
      this.members = [];
      this.sites = [];
      this.attendance = [];
      this.payrollLogs = [];
      this.custodies = [];
      this.dailyReports = [];
      this.leaves = [];
      this.groupMsgs = [];
      this.ops = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'company') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) { this.subTab = t; this.rerender(); },
    setOpsSubTab(t) { this.opsSubTab = t; this.rerender(); },
    setSelectedSite(sid) { this.selectedSiteId = sid || 'all'; this.rerender(); },

    // ==================== ROLES, SITE ACCESS & HELPERS ====================
    getMyMember() {
      const uid = window.DamanApp?.user?.uid;
      return this.members.find((m) => m.userId === uid) || null;
    },

    isManager() {
      const app = window.DamanApp;
      if (!app.user || !this.company) return false;
      if (app.isAdmin() || this.company.ownerId === app.user.uid) return true;
      const me = this.getMyMember();
      return !!(me && me.status === 'active' && ['owner', 'manager', 'hr'].includes(me.role));
    },

    canSupervise() {
      if (this.isManager()) return true;
      const me = this.getMyMember();
      return !!(me && me.status === 'active' && ['engineer', 'supervisor'].includes(me.role));
    },

    getAllowedSites() {
      if (this.isManager()) return this.sites;
      const me = this.getMyMember();
      const assigned = Array.isArray(me?.assignedSites) ? me.assignedSites : [];
      if (!assigned.length) return this.sites;
      return this.sites.filter((s) => assigned.includes(s.id));
    },

    filterBySite(arr) {
      const allowedIds = this.getAllowedSites().map((s) => s.id);
      const restrict = !this.isManager() && this.sites.length > 0 && allowedIds.length < this.sites.length;
      return (arr || []).filter((item) => {
        if (restrict && item.siteId && !allowedIds.includes(item.siteId)) return false;
        if (this.selectedSiteId === 'all') return true;
        const stObj = this.sites.find((s) => s.id === this.selectedSiteId);
        return item.siteId === this.selectedSiteId || (stObj && item.siteName === stObj.name);
      });
    },

    getOps(type) {
      return this.filterBySite(this.ops.filter((o) => o.opType === type));
    },

    siteSelectOptions(selectedId = '') {
      const app = window.DamanApp;
      const list = this.getAllowedSites();
      if (!list.length) return '';
      const def = selectedId || (this.selectedSiteId !== 'all' ? this.selectedSiteId : '');
      return list.map((s) => `<option value="${s.id}" ${s.id === def ? 'selected' : ''}>${app.esc(s.name)}</option>`).join('');
    },

    resolveSiteFromInput(selId, txtId) {
      const sid = document.getElementById(selId)?.value || '';
      const sObj = this.sites.find((s) => s.id === sid);
      if (sObj) return { siteId: sObj.id, siteName: sObj.name };
      const txt = (document.getElementById(txtId)?.value || '').trim();
      return { siteId: '', siteName: txt || 'عام' };
    },

    roleLabel(r) {
      return {
        owner: 'مالك الشركة', manager: 'مدير مشروع', hr: 'محاسب / HR',
        engineer: 'مهندس تنفيذ', supervisor: 'مشرف تنفيذ', employee: 'موظف / فني'
      }[r] || r;
    },

    sigBlockHtml(left = 'مشرف التنفيذ', mid = 'مهندس التنفيذ', right = 'مدير المشروع') {
      return `
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:24px; text-align:center; font-size:11px;">
          <div><b>${left}</b><br/><br/>..........................</div>
          <div><b>${mid}</b><br/><br/>..........................</div>
          <div><b>${right}</b><br/><br/>..........................</div>
        </div>`;
    },

    // ==================== CREATE / JOIN COMPANY ====================
    async createCompanyWorkspace(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      const name = document.getElementById('nc-name').value.trim();
      const cr = document.getElementById('nc-cr').value.trim();
      const tax = document.getElementById('nc-tax').value.trim();
      if (!name) return;

      await app.withLock('createComp', async () => {
        const compCode = 'CMP-' + Math.floor(100000 + Math.random() * 900000);
        const compRef = app.db.collection('companies').doc();
        try {
          await compRef.set({
            name, code: compCode,
            ownerId: app.user.uid,
            ownerName: app.profile?.legalName || app.profile?.name || '',
            commercialReg: cr || app.profile?.commercialReg || '',
            taxCard: tax || app.profile?.taxCard || '',
            sites: [], status: 'active', date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('companyMembers').doc(`${compRef.id}_${app.user.uid}`).set({
            companyId: compRef.id, userId: app.user.uid,
            name: app.profile?.name || '', legalName: app.profile?.legalName || app.profile?.name || '',
            phone: app.profile?.phone || '', jobTitle: 'المدير العام / المالك', role: 'owner',
            assignedSites: [], baseSalary: 0, allowances: 0, overtimeAmount: 0,
            advances: 0, deductions: 0, approvedAbsentDays: 0,
            status: 'active', joinedDate: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('users').doc(app.user.uid).update({
            companyId: compRef.id, companyCode: compCode, companyName: name
          });
          app.toast(`تم إنشاء مساحة الشركة بنجاح! الكود: ${compCode}`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async joinCompanyByCode(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      const code = document.getElementById('jc-code').value.trim().toUpperCase();
      const jobTitle = document.getElementById('jc-title').value.trim() || 'مشرف تنفيذ';
      if (!code) return;

      await app.withLock('joinComp', async () => {
        try {
          const snap = await app.db.collection('companies').where('code', '==', code).limit(1).get();
          if (snap.empty) return app.toast('كود الشركة غير صحيح — راجع مدير الشركة', 'error');
          const compDoc = snap.docs[0];
          const comp = compDoc.data();
          if (comp.status === 'suspended') return app.toast('هذه الشركة موقوفة حالياً من الإدارة', 'error');

          await app.db.collection('companyMembers').doc(`${compDoc.id}_${app.user.uid}`).set({
            companyId: compDoc.id, userId: app.user.uid,
            name: app.profile?.name || '', legalName: app.profile?.legalName || app.profile?.name || '',
            phone: app.profile?.phone || '', jobTitle, role: 'supervisor',
            assignedSites: [], baseSalary: 0, allowances: 0, overtimeAmount: 0,
            advances: 0, deductions: 0, approvedAbsentDays: 0,
            status: 'active', joinedDate: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          await app.db.collection('users').doc(app.user.uid).update({
            companyId: compDoc.id, companyCode: comp.code, companyName: comp.name
          });
          await app.sendNotification(comp.ownerId, 'انضمام موظف جديد 👷', `انضم ${app.profile?.name} (${jobTitle}) لشركتك.`);
          app.toast(`تم الانضمام لشركة «${comp.name}» بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== SITES (GPS, SHIFT TIMES, BUDGET) ====================
    haversineMeters(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    },

    openAddSiteModal() {
      if (!this.isManager()) return;
      let m = document.getElementById('daman-comp-site-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-comp-site-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/50 rounded-3xl p-4 space-y-3 text-xs max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-sky-400"><i class="fa-solid fa-map-location-dot me-1"></i> إضافة موقع / مشروع جديد</h3>
            <button onclick="document.getElementById('daman-comp-site-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanCompany.saveCompanySite(event)" class="space-y-2.5">
            <input id="cs-name" type="text" required placeholder="اسم الموقع (مثال: مشروع سعادة - قطاع الفيلات)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">بداية الوردية</label><input id="cs-start" type="time" value="08:00" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] text-slate-400 mb-1">نهاية الوردية</label><input id="cs-end" type="time" value="17:00" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">نطاق GPS (متر)</label><input id="cs-rad" type="number" min="50" max="5000" value="250" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-emerald-300 mb-1">ميزانية/عقد الموقع (ج.م)</label><input id="cs-budget" type="number" min="0" step="any" value="0" placeholder="اختياري" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="cs-lat" type="number" step="any" placeholder="خط العرض Lat" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" />
              <input id="cs-lng" type="number" step="any" placeholder="خط الطول Lng" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" />
            </div>
            <button type="button" onclick="DamanCompany.captureSiteGps()" class="w-full py-2 rounded-xl bg-sky-500/20 border border-sky-500/50 text-sky-300 font-black">
              <i class="fa-solid fa-crosshairs me-1"></i> التقاط إحداثيات موقعي الحالي (GPS)
            </button>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ الموقع</button>
          </form>
        </div>`;
    },

    captureSiteGps() {
      const app = window.DamanApp;
      if (!navigator.geolocation) return app.toast('جهازك لا يدعم GPS', 'error');
      app.toast('جارٍ التقاط الإحداثيات...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('cs-lat').value = pos.coords.latitude.toFixed(6);
          document.getElementById('cs-lng').value = pos.coords.longitude.toFixed(6);
          app.toast('تم تثبيت الإحداثيات ✅', 'success');
        },
        () => app.toast('فعّل صلاحية GPS أولاً', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },

    async saveCompanySite(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company) return;
      const newSite = {
        id: 'st_' + Date.now(),
        name: document.getElementById('cs-name').value.trim(),
        shiftStart: document.getElementById('cs-start').value || '08:00',
        shiftEnd: document.getElementById('cs-end').value || '17:00',
        radiusMeters: parseInt(document.getElementById('cs-rad').value, 10) || 250,
        budget: parseFloat(document.getElementById('cs-budget').value) || 0,
        lat: parseFloat(document.getElementById('cs-lat').value) || null,
        lng: parseFloat(document.getElementById('cs-lng').value) || null
      };
      if (!newSite.name) return;
      await app.db.collection('companies').doc(this.company.id).update({ sites: this.sites.concat([newSite]) });
      document.getElementById('daman-comp-site-modal').classList.add('hidden');
      app.toast(`تم تثبيت الموقع «${newSite.name}» ✅`, 'success');
    },

    async removeCompanySite(siteId) {
      if (!this.isManager() || !this.company) return;
      if (!window.confirm('حذف هذا الموقع من القائمة الثابتة؟')) return;
      await window.DamanApp.db.collection('companies').doc(this.company.id).update({
        sites: this.sites.filter((s) => s.id !== siteId)
      });
      if (this.selectedSiteId === siteId) this.selectedSiteId = 'all';
      window.DamanApp.toast('تم حذف الموقع', 'info');
    },

    // ==================== 1. ATTENDANCE (GPS + LATE CALC + BULK WORKERS + A4 SHEET) ====================
    async handleAttendanceSelfie(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempSelfieBase64 = await window.DamanApp.compressImage(f, 520, 0.55);
      const p = document.getElementById('att-selfie-prev');
      if (p) p.innerHTML = `<img src="${this.tempSelfieBase64}" class="max-h-20 mx-auto rounded-lg mt-1.5" />`;
    },

    async handleBulkPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempBulkPhoto = await window.DamanApp.compressImage(f, 640, 0.55);
      const p = document.getElementById('bulk-att-prev');
      if (p) p.innerHTML = `<img src="${this.tempBulkPhoto}" class="max-h-20 mx-auto rounded-lg mt-1.5" />`;
    },

    calcLateMinutes(shiftStart) {
      if (!shiftStart || !shiftStart.includes(':')) return 0;
      const [h, m] = shiftStart.split(':').map((x) => parseInt(x, 10));
      const now = new Date();
      const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m);
      return diff > 10 ? diff : 0; // 10 min grace period
    },

    async recordAttendance(kind) {
      const app = window.DamanApp;
      if (!this.company || !app.user) return;
      const me = this.getMyMember();
      if (me && me.status !== 'active') return app.toast('حسابك غير نشط في الشركة', 'error');

      const today = app.todayLocal();
      const myToday = this.attendance.filter((a) => !a.isBulk && a.userId === app.user.uid && a.date === today);
      const hasIn = myToday.some((a) => a.kind === 'in');
      const hasOut = myToday.some((a) => a.kind === 'out');

      if (kind === 'in' && hasIn) return app.toast('لقد سجّلت حضورك اليوم بالفعل ✅', 'warning');
      if (kind === 'out' && !hasIn) return app.toast('⚠️ لا يمكن تسجيل الانصراف قبل تسجيل الحضور أولاً في نفس اليوم!', 'error');
      if (kind === 'out' && hasOut) return app.toast('لقد سجّلت انصرافك اليوم بالفعل', 'warning');
      if (!this.tempSelfieBase64) return app.toast('يرجى التقاط صورة سيلفي من الموقع أولاً', 'warning');

      const { siteId, siteName } = this.resolveSiteFromInput('att-site-select', 'att-site-custom');
      const siteObj = this.sites.find((s) => s.id === siteId) || null;
      if (!siteName || siteName === 'عام') return app.toast('اختر الموقع أو اكتب اسمه أولاً', 'warning');

      await app.withLock('att_' + kind, async () => {
        app.toast('جارٍ التحقق من الـ GPS والوردية...', 'info');
        const coords = await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });

        let distanceMeters = null;
        let geoStatus = 'no_pin';
        if (!coords) geoStatus = 'no_gps';
        else if (siteObj && siteObj.lat != null && siteObj.lng != null) {
          distanceMeters = this.haversineMeters(coords.lat, coords.lng, Number(siteObj.lat), Number(siteObj.lng));
          geoStatus = distanceMeters <= Number(siteObj.radiusMeters || 250) ? 'inside' : 'outside';
        }

        const lateMinutes = kind === 'in' && siteObj ? this.calcLateMinutes(siteObj.shiftStart) : 0;
        const selfieMedia = await app.saveMedia(this.tempSelfieBase64, { kind: 'hr_selfie' });
        const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        await app.db.collection('companyAttendance').add({
          companyId: this.company.id, userId: app.user.uid,
          userName: app.profile?.name || '', jobTitle: me?.jobTitle || '',
          kind, isBulk: false, date: today, time: timeStr,
          siteId: siteObj?.id || '', siteName, coords, distanceMeters, geoStatus, lateMinutes, selfieMedia,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this.tempSelfieBase64 = '';
        app.toast(geoStatus === 'outside' ? `تم التسجيل — ⚠️ خارج النطاق (${distanceMeters}م)` : `تم تسجيل ${kind === 'in' ? 'الحضور' : 'الانصراف'} بنجاح ✅`, geoStatus === 'outside' ? 'warning' : 'success');
      });
    },

    async submitBulkWorkerAttendance(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company || !this.canSupervise()) return;
      const { siteId, siteName } = this.resolveSiteFromInput('ba-site-sel', 'ba-site-txt');
      const workersRaw = document.getElementById('ba-names').value.trim();
      const statusType = document.getElementById('ba-status').value;
      const trade = document.getElementById('ba-trade').value.trim() || 'عمالة موقع';
      if (!workersRaw) return;

      await app.withLock('bulkAtt', async () => {
        const namesList = workersRaw.split(/[\n،,]+/).map((s) => s.trim()).filter(Boolean);
        const photoMedia = this.tempBulkPhoto ? await app.saveMedia(this.tempBulkPhoto, { kind: 'bulk_att' }) : '';
        await app.db.collection('companyAttendance').add({
          companyId: this.company.id, userId: app.user.uid,
          userName: app.profile?.name || '', isBulk: true,
          siteId, siteName, trade, statusType,
          workersCount: namesList.length, workersList: namesList,
          selfieMedia: photoMedia, date: app.todayLocal(),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this.tempBulkPhoto = '';
        e.target.reset();
        app.toast(`تم تحضير ${namesList.length} عامل بالموقع بنجاح ✅`, 'success');
      });
    },

    printAttendanceA4() {
      const app = window.DamanApp;
      const logs = this.filterBySite(this.attendance);
      const rows = logs.slice(0, 80).map((a, i) => {
        if (a.isBulk) {
          return `<tr><td>${i + 1}</td><td>${app.esc(a.date)}</td><td>تحضير جماعي (${a.workersCount} — ${app.esc(a.trade)})</td><td>${app.esc(a.siteName)}</td><td>${app.esc(a.statusType)}</td><td>${app.esc((a.workersList || []).join('، '))}</td></tr>`;
        }
        const geo = a.geoStatus === 'inside' ? `داخل النطاق (${a.distanceMeters}م)` : a.geoStatus === 'outside' ? `خارج النطاق (${a.distanceMeters}م)` : '—';
        return `<tr><td>${i + 1}</td><td>${app.esc(a.date)} (${app.esc(a.time || '')})</td><td><b>${app.esc(a.userName)}</b></td><td>${app.esc(a.siteName)}</td><td>${a.kind === 'in' ? 'حضور' : 'انصراف'}${a.lateMinutes ? ` (تأخير ${a.lateMinutes}د)` : ''}</td><td>${geo}</td></tr>`;
      }).join('');

      window.DamanPrint(`
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">كشف الحضور والانصراف — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table>
            <thead><tr><th>#</th><th>التاريخ / الوقت</th><th>الاسم / الفرقة</th><th>الموقع</th><th>الحالة</th><th>ملاحظات / GPS</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">لا توجد سجلات</td></tr>'}</tbody>
          </table>
          ${this.sigBlockHtml()}
        </div>`);
    },

    // ==================== 2. OVERTIME APPROVALS (إذونات السهر والإضافي) ====================
    async submitOvertimeRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company || !app.user) return;
      const { siteId, siteName } = this.resolveSiteFromInput('ot-site-sel', 'ot-site-txt');
      const memberId = document.getElementById('ot-member')?.value || '';
      const targetName = document.getElementById('ot-names').value.trim();
      const element = document.getElementById('ot-elem').value.trim();
      const hours = parseFloat(document.getElementById('ot-hours').value) || 0;
      const amount = Math.round((parseFloat(document.getElementById('ot-amt').value) || 0) * 100) / 100;
      const reason = document.getElementById('ot-reason').value.trim();
      if (!targetName || !element || hours <= 0) return;

      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'overtime', siteId, siteName,
        memberId, targetName, element, hours, amount, reason,
        requestedByUid: app.user.uid, requestedByName: app.profile?.name || '',
        status: this.isManager() ? 'approved' : 'pending',
        date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (this.isManager() && memberId && amount > 0) {
        await app.db.collection('companyMembers').doc(memberId).update({
          overtimeAmount: firebase.firestore.FieldValue.increment(amount)
        }).catch(() => {});
      }
      e.target.reset();
      app.toast('تم حفظ إذن السهر / العمل الإضافي ✅', 'success');
    },

    async respondOvertime(opId, approve) {
      if (!this.isManager()) return;
      const op = this.ops.find((x) => x.id === opId);
      if (!op || op.status !== 'pending') return;
      await window.DamanApp.db.collection('companyOps').doc(opId).update({ status: approve ? 'approved' : 'rejected' });
      if (approve && op.memberId && Number(op.amount || 0) > 0) {
        await window.DamanApp.db.collection('companyMembers').doc(op.memberId).update({
          overtimeAmount: firebase.firestore.FieldValue.increment(Number(op.amount))
        }).catch(() => {});
      }
      window.DamanApp.toast(approve ? 'تم اعتماد الإضافي وترحيله للراتب ✅' : 'تم رفض الطلب', 'info');
    },

    printOvertimeA4(opId) {
      const app = window.DamanApp;
      const o = this.ops.find((x) => x.id === opId);
      if (!o) return;
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div><h2 style="margin:0; font-size:16px;">نموذج اعتماد عمل إضافي / سهر — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.esc(o.date)}</div>
          </div>
          <table>
            <tr><th style="width:28%;">الموقع / المشروع</th><td><b>${app.esc(o.siteName)}</b></td></tr>
            <tr><th>الأسماء / الفرقة</th><td>${app.esc(o.targetName)}</td></tr>
            <tr><th>البند / العنصر المنفّذ</th><td>${app.esc(o.element)}</td></tr>
            <tr><th>عدد ساعات الإضافي</th><td><b>${o.hours} ساعة</b></td></tr>
            <tr><th>القيمة المعتمدة</th><td><b>${app.fmtMoney(o.amount)} ج.م</b></td></tr>
            <tr><th>المبرر الفني للعمل الإضافي</th><td>${app.esc(o.reason || '—')}</td></tr>
            <tr><th>الحالة</th><td><b>${o.status === 'approved' ? 'معتمد' : o.status === 'rejected' ? 'مرفوض' : 'تحت الاعتماد'}</b></td></tr>
          </table>
          ${this.sigBlockHtml()}
        </div>`);
    },

    // ==================== 3. SUBCONTRACTORS, DEDUCTIONS & ABSTRACTS ====================
    async handleDedPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempDedPhoto = await window.DamanApp.compressImage(f, 700, 0.56);
      const p = document.getElementById('sub-ded-prev');
      if (p) p.innerHTML = `<img src="${this.tempDedPhoto}" class="max-h-20 mx-auto rounded mt-1" />`;
    },

    async addSubcontractor(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('sc-site-sel', 'sc-site-txt');
      const name = document.getElementById('sc-name').value.trim();
      const trade = document.getElementById('sc-trade').value.trim();
      const unitRate = parseFloat(document.getElementById('sc-rate').value) || 0;
      const unitName = document.getElementById('sc-unit').value.trim() || 'متر';
      if (!name || !trade) return;
      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'subcontractor', siteId, siteName,
        name, trade, unitRate, unitName, date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast(`تم تسجيل مقاول الباطن «${name}» ✅`, 'success');
    },

    async submitSubTx(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const subId = document.getElementById('stx-sub').value;
      const sub = this.ops.find((x) => x.id === subId);
      if (!sub) return;
      const txKind = document.getElementById('stx-kind').value; // 'payment' | 'deduction' | 'work'
      const qty = parseFloat(document.getElementById('stx-qty').value) || 0;
      let amount = Math.round((parseFloat(document.getElementById('stx-amt').value) || 0) * 100) / 100;
      if (txKind === 'work' && amount <= 0 && qty > 0) amount = Math.round(qty * Number(sub.unitRate || 0) * 100) / 100;
      const reason = document.getElementById('stx-reason').value.trim();
      if (amount <= 0) return app.toast('أدخل القيمة أو الكمية بشكل صحيح', 'warning');

      await app.withLock('subTx', async () => {
        const photoMedia = this.tempDedPhoto ? await app.saveMedia(this.tempDedPhoto, { kind: 'sub_deduction' }) : '';
        await app.db.collection('companyOps').add({
          companyId: this.company.id, opType: 'sub_tx',
          siteId: sub.siteId || '', siteName: sub.siteName || 'عام',
          subId, subName: sub.name, subTrade: sub.trade,
          txKind, qty, amount, reason, photoMedia,
          createdByName: app.profile?.name || '', date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this.tempDedPhoto = '';
        e.target.reset();
        app.toast('تم تسجيل الحركة بحساب المقاول ✅', 'success');
      });
    },

    printDeductionNoticeA4(txId) {
      const app = window.DamanApp;
      const t = this.ops.find((x) => x.id === txId);
      if (!t) return;
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div><h2 style="margin:0; font-size:16px;">إشعار خصم مقاول باطن — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.esc(t.date)}</div>
          </div>
          <table>
            <tr><th style="width:28%;">الموقع / المشروع</th><td><b>${app.esc(t.siteName)}</b></td></tr>
            <tr><th>اسم المقاول</th><td><b>${app.esc(t.subName)} (${app.esc(t.subTrade)})</b></td></tr>
            <tr><th>قيمة الخصم</th><td><b style="font-size:14px;">${app.fmtMoney(t.amount)} ج.م</b></td></tr>
            <tr><th>سبب وتفاصيل الخصم</th><td style="white-space:pre-line;">${app.esc(t.reason)}</td></tr>
            <tr><th>المُحرّر</th><td>${app.esc(t.createdByName || '')}</td></tr>
          </table>
          <div style="margin-top:10px; font-size:10.5px;">يُخصم هذا المبلغ مباشرة من مستخلص المقاول الجاري وفقاً لشروط التعاقد ومعاينة الموقع.</div>
          ${this.sigBlockHtml()}
        </div>`);
    },

    printSubAbstractA4(subId) {
      const app = window.DamanApp;
      const sub = this.ops.find((x) => x.id === subId);
      if (!sub) return;
      const txs = this.ops.filter((x) => x.opType === 'sub_tx' && x.subId === subId);
      let totalWork = 0, totalPay = 0, totalDed = 0;
      const rows = txs.map((t, i) => {
        if (t.txKind === 'work') totalWork += Number(t.amount || 0);
        else if (t.txKind === 'payment') totalPay += Number(t.amount || 0);
        else totalDed += Number(t.amount || 0);
        const lbl = t.txKind === 'work' ? `أعمال منفذة (${t.qty || ''})` : t.txKind === 'payment' ? 'دفعة منصرفة (-)' : 'إشعار خصم (-)';
        return `<tr><td>${i + 1}</td><td>${app.esc(t.date)}</td><td>${lbl}</td><td>${app.esc(t.reason || '—')}</td><td><b>${app.fmtMoney(t.amount)} ج.م</b></td></tr>`;
      }).join('');
      const net = Math.round((totalWork - totalPay - totalDed) * 100) / 100;

      window.DamanPrint(`
        <div style="border:2px solid #000; padding:16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">مستخلص وتصفية حساب مقاول باطن — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table style="margin-bottom:10px;">
            <tr><th>اسم المقاول</th><td><b>${app.esc(sub.name)}</b></td><th>التخصص / الفئة</th><td>${app.esc(sub.trade)} (${app.fmtMoney(sub.unitRate)} / ${app.esc(sub.unitName)})</td></tr>
            <tr><th>إجمالي الأعمال المنفذة</th><td><b>${app.fmtMoney(totalWork)} ج.م</b></td><th>إجمالي الدفعات + الخصومات</th><td>دفعات ${app.fmtMoney(totalPay)} | خصومات ${app.fmtMoney(totalDed)}</td></tr>
            <tr><th colspan="2">صافي المستحق للمقاول</th><th colspan="2" style="font-size:14px;">${app.fmtMoney(net)} ج.م</th></tr>
          </table>
          <table>
            <thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>البيان</th><th>القيمة</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5" style="text-align:center;">لا توجد حركات</td></tr>'}</tbody>
          </table>
          ${this.sigBlockHtml('توقيع المقاول', 'مهندس التنفيذ / المكتب الفني', 'اعتماد مدير المشروع')}
        </div>`);
    },

    // ==================== 4. SITE OPS: INVENTORY, CONCRETE, MATERIAL REQUESTS, EQUIPMENT ====================
    async submitInventoryMove(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('inv-site-sel', 'inv-site-txt');
      const itemName = document.getElementById('inv-item').value.trim();
      const unit = document.getElementById('inv-unit').value.trim() || 'عدد';
      const moveType = document.getElementById('inv-type').value; // 'in' | 'out' | 'damaged'
      const qty = parseFloat(document.getElementById('inv-qty').value) || 0;
      const note = document.getElementById('inv-note').value.trim();
      if (!itemName || qty <= 0) return;

      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'inventory', siteId, siteName,
        itemName, unit, moveType, qty, note, byName: app.profile?.name || '',
        date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast('تم قيد حركة المخزن والجرد ✅', 'success');
    },

    printInventoryA4() {
      const app = window.DamanApp;
      const list = this.getOps('inventory');
      const summary = {};
      list.forEach((x) => {
        const k = `${x.itemName} (${x.unit})`;
        if (!summary[k]) summary[k] = { in: 0, out: 0, dmg: 0 };
        if (x.moveType === 'in') summary[k].in += Number(x.qty || 0);
        else if (x.moveType === 'out') summary[k].out += Number(x.qty || 0);
        else summary[k].dmg += Number(x.qty || 0);
      });
      const rows = Object.entries(summary).map(([name, s], i) => `
        <tr><td>${i + 1}</td><td><b>${app.esc(name)}</b></td><td>${s.in}</td><td>${s.out}</td><td>${s.dmg}</td><td><b>${Math.round((s.in - s.out - s.dmg) * 100) / 100}</b></td></tr>`).join('');
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:15px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">محضر جرد أخشاب ومعدات وخامات الموقع — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table>
            <thead><tr><th>#</th><th>الصنف والوحدة</th><th>وارد (+)</th><th>منصرف (-)</th><th>تالف / هالك (-)</th><th>الرصيد الفعلي</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">لا توجد أصناف</td></tr>'}</tbody>
          </table>
          ${this.sigBlockHtml()}
        </div>`);
    },

    async submitConcretePour(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('cn-site-sel', 'cn-site-txt');
      const element = document.getElementById('cn-elem').value.trim();
      const designQty = parseFloat(document.getElementById('cn-design').value) || 0;
      const pouredQty = parseFloat(document.getElementById('cn-poured').value) || 0;
      const supplier = document.getElementById('cn-supp').value.trim();
      const grade = document.getElementById('cn-grade').value.trim() || 'C30';
      const note = document.getElementById('cn-note').value.trim();
      if (!element || pouredQty <= 0) return;
      const diff = Math.round((pouredQty - designQty) * 100) / 100;
      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'concrete', siteId, siteName,
        element, designQty, pouredQty, diff, supplier, grade, note,
        byName: app.profile?.name || '', date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast('تم تسجيل صبة الخرسانة ومقارنة الكمية ✅', 'success');
    },

    printConcreteA4() {
      const app = window.DamanApp;
      const list = this.getOps('concrete');
      let tDes = 0, tPour = 0;
      const rows = list.map((c, i) => {
        tDes += Number(c.designQty || 0); tPour += Number(c.pouredQty || 0);
        return `<tr><td>${i + 1}</td><td>${app.esc(c.date)}</td><td>${app.esc(c.siteName)} — <b>${app.esc(c.element)}</b></td><td>${app.esc(c.grade)}</td><td>${c.designQty} م³</td><td><b>${c.pouredQty} م³</b></td><td>${c.diff > 0 ? '+' + c.diff : c.diff} م³</td><td>${app.esc(c.supplier || '—')}</td></tr>`;
      }).join('');
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:15px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">سجل صب الخرسانة ومقارنة الكميات — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table>
            <thead><tr><th>#</th><th>التاريخ</th><th>الموقع والعنصر</th><th>الرتبة</th><th>هندسي</th><th>مصبوب فعلي</th><th>الفرق</th><th>المحطة/المورّد</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="8" style="text-align:center;">لا توجد صبات</td></tr>'}
              <tr><th colspan="4">الإجمالي</th><th>${Math.round(tDes * 100) / 100} م³</th><th>${Math.round(tPour * 100) / 100} م³</th><th colspan="2">الفرق: ${Math.round((tPour - tDes) * 100) / 100} م³</th></tr>
            </tbody>
          </table>
          ${this.sigBlockHtml()}
        </div>`);
    },

    async submitMaterialRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('mr-site-sel', 'mr-site-txt');
      const itemName = document.getElementById('mr-item').value.trim();
      const qty = parseFloat(document.getElementById('mr-qty').value) || 0;
      const unit = document.getElementById('mr-unit').value.trim() || 'طن / عدد';
      const neededDate = document.getElementById('mr-date').value;
      const note = document.getElementById('mr-note').value.trim();
      if (!itemName || qty <= 0) return;

      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'mr', siteId, siteName,
        itemName, qty, unit, neededDate, note,
        status: this.isManager() ? 'approved' : 'pending',
        byName: app.profile?.name || '', date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast('تم رفع طلب توريد الخامات ✅', 'success');
    },

    async updateMaterialReq(id, nextStatus) {
      const app = window.DamanApp;
      const mr = this.ops.find((x) => x.id === id);
      if (!mr) return;
      await app.db.collection('companyOps').doc(id).update({ status: nextStatus });
      if (nextStatus === 'delivered') {
        // Automatically add received materials to Site Inventory!
        await app.db.collection('companyOps').add({
          companyId: this.company.id, opType: 'inventory',
          siteId: mr.siteId || '', siteName: mr.siteName || 'عام',
          itemName: mr.itemName, unit: mr.unit, moveType: 'in', qty: Number(mr.qty || 0),
          note: `توريد مستلم تلقائياً من أمر توريد (${mr.date})`,
          byName: app.profile?.name || '', date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        app.toast('تم الاستلام وترحيل الكمية تلقائياً إلى جرد المخزن ✅', 'success');
      } else {
        app.toast('تم تحديث حالة طلب التوريد ✅', 'info');
      }
    },

    async submitEquipment(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('eq-site-sel', 'eq-site-txt');
      const eqName = document.getElementById('eq-name').value.trim();
      const supplier = document.getElementById('eq-supp').value.trim();
      const dailyRate = parseFloat(document.getElementById('eq-rate').value) || 0;
      const days = parseFloat(document.getElementById('eq-days').value) || 1;
      const totalCost = Math.round(dailyRate * days * 100) / 100;
      if (!eqName || dailyRate <= 0) return;
      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'equipment', siteId, siteName,
        eqName, supplier, dailyRate, days, totalCost, status: 'active',
        date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast('تم تسجيل المعدة / الإيجار ✅', 'success');
    },

    printEquipmentA4() {
      const app = window.DamanApp;
      const list = this.getOps('equipment');
      let sum = 0;
      const rows = list.map((e, i) => {
        sum += Number(e.totalCost || 0);
        return `<tr><td>${i + 1}</td><td>${app.esc(e.date)}</td><td>${app.esc(e.siteName)}</td><td><b>${app.esc(e.eqName)}</b></td><td>${app.esc(e.supplier || '—')}</td><td>${app.fmtMoney(e.dailyRate)} × ${e.days}</td><td><b>${app.fmtMoney(e.totalCost)} ج.م</b></td></tr>`;
      }).join('');
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:15px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">كشف حصر ومستحقات المعدات والإيجارات — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table>
            <thead><tr><th>#</th><th>التاريخ</th><th>الموقع</th><th>المعدة</th><th>المورّد</th><th>الفئة × المدة</th><th>الإجمالي</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;">لا توجد معدات</td></tr>'}
              <tr><th colspan="6">إجمالي مستحقات المعدات</th><th>${app.fmtMoney(sum)} ج.م</th></tr>
            </tbody>
          </table>
          ${this.sigBlockHtml()}
        </div>`);
    },

    // ==================== 5. UNITS PROGRESS & CONSULTANT SNAG LIST (BEFORE/AFTER) ====================
    async submitUnitProgress(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('un-site-sel', 'un-site-txt');
      const unitCode = document.getElementById('un-code').value.trim();
      const stage = document.getElementById('un-stage').value;
      const pct = Math.max(0, Math.min(100, parseInt(document.getElementById('un-pct').value, 10) || 0));
      const note = document.getElementById('un-note').value.trim();
      if (!unitCode) return;

      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'unit', siteId, siteName,
        unitCode, stage, pct, note, updatedBy: app.profile?.name || '',
        date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast('تم تحديث نسبة إنجاز الوحدة ✅', 'success');
    },

    async updateUnitPct(id, curPct) {
      const nv = parseInt(window.prompt('أدخل نسبة الإنجاز الجديدة (0 إلى 100):', String(curPct)), 10);
      if (isNaN(nv) || nv < 0 || nv > 100) return;
      await window.DamanApp.db.collection('companyOps').doc(id).update({ pct: nv, date: window.DamanApp.todayLocal() });
      window.DamanApp.toast(`تم التحديث إلى ${nv}% ✅`, 'success');
    },

    async handleSnagBeforePhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempSnagBefore = await window.DamanApp.compressImage(f, 700, 0.56);
      const p = document.getElementById('snag-bef-prev');
      if (p) p.innerHTML = `<img src="${this.tempSnagBefore}" class="max-h-20 mx-auto rounded mt-1" />`;
    },

    async submitSnagItem(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('sn-site-sel', 'sn-site-txt');
      const unitCode = document.getElementById('sn-unit').value.trim();
      const description = document.getElementById('sn-desc').value.trim();
      const assignee = document.getElementById('sn-assignee').value.trim();
      if (!description) return;
      const beforeMedia = this.tempSnagBefore ? await app.saveMedia(this.tempSnagBefore, { kind: 'snag_before' }) : '';
      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'snag', siteId, siteName,
        unitCode, description, assignee, beforeMedia, afterMedia: '', status: 'open',
        date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.tempSnagBefore = '';
      e.target.reset();
      app.toast('تم تسجيل ملاحظة الاستشاري ✅', 'success');
    },

    async uploadSnagAfterPhoto(input, snagId) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      if (!f) return;
      input.value = '';
      const b64 = await app.compressImage(f, 700, 0.56);
      const afterMedia = await app.saveMedia(b64, { kind: 'snag_after' });
      await app.db.collection('companyOps').doc(snagId).update({ afterMedia, status: 'fixed', fixedDate: app.todayLocal() });
      app.toast('تم رفع صورة بعد التلافي وتحديث الحالة ✅', 'success');
    },

    async approveSnag(snagId) {
      await window.DamanApp.db.collection('companyOps').doc(snagId).update({ status: 'approved' });
      window.DamanApp.toast('تم اعتماد التلافي وإغلاق الملاحظة ✅', 'success');
    },

    printProgressAndSnagsA4() {
      const app = window.DamanApp;
      const units = this.getOps('unit');
      const snags = this.getOps('snag');
      const uRows = units.map((u, i) => `<tr><td>${i + 1}</td><td>${app.esc(u.siteName)}</td><td><b>${app.esc(u.unitCode)}</b></td><td>${app.esc(u.stage)}</td><td><b>${u.pct}%</b></td><td>${app.esc(u.note || '—')}</td></tr>`).join('');
      const sRows = snags.map((s, i) => `<tr><td>${i + 1}</td><td>${app.esc(s.date)}</td><td>${app.esc(s.unitCode || s.siteName)}</td><td>${app.esc(s.description)}</td><td>${app.esc(s.assignee || '—')}</td><td><b>${s.status === 'approved' ? 'معتمد ومغلق' : s.status === 'fixed' ? 'تم التلافي' : 'مفتوح'}</b></td></tr>`).join('');
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:15px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">تقرير الموقف التنفيذي وملاحظات الاستشاري — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <h4 style="margin:4px 0;">أولاً: نسب إنجاز الوحدات / الفيلات</h4>
          <table style="margin-bottom:12px;"><thead><tr><th>#</th><th>الموقع</th><th>الوحدة</th><th>البند</th><th>الإنجاز</th><th>ملاحظات</th></tr></thead><tbody>${uRows || '<tr><td colspan="6" style="text-align:center;">لا توجد وحدات</td></tr>'}</tbody></table>
          <h4 style="margin:4px 0;">ثانياً: ملاحظات الاستشاري والتلافي</h4>
          <table><thead><tr><th>#</th><th>التاريخ</th><th>الوحدة/الموقع</th><th>الملاحظة</th><th>المسؤول</th><th>الحالة</th></tr></thead><tbody>${sRows || '<tr><td colspan="6" style="text-align:center;">لا توجد ملاحظات</td></tr>'}</tbody></table>
          ${this.sigBlockHtml()}
        </div>`);
    },

    // ==================== 6. CUSTODY (العهدة) ====================
    async handleCustodyPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempCustodyPhoto = await window.DamanApp.compressImage(f, 760, 0.56);
      const p = document.getElementById('cu-photo-prev');
      if (p) p.innerHTML = `<img src="${this.tempCustodyPhoto}" class="max-h-20 mx-auto rounded mt-1" />`;
    },

    async submitCustodyRecord(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company || !app.user) return;
      const { siteId, siteName } = this.resolveSiteFromInput('cu-site-sel', 'cu-site-txt');
      const kind = document.getElementById('cu-kind').value;
      const holderName = document.getElementById('cu-holder').value.trim();
      const amount = Math.round((parseFloat(document.getElementById('cu-amt').value) || 0) * 100) / 100;
      const note = document.getElementById('cu-note').value.trim();
      if (!holderName || amount <= 0) return;

      await app.withLock('custodySave', async () => {
        const photoMedia = this.tempCustodyPhoto ? await app.saveMedia(this.tempCustodyPhoto, { kind: 'custody_inv' }) : '';
        await app.db.collection('companyCustody').add({
          companyId: this.company.id, userId: app.user.uid, kind, holderName, amount,
          siteId, siteName, note, photoMedia,
          status: this.isManager() ? 'approved' : 'pending',
          date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this.tempCustodyPhoto = '';
        e.target.reset();
        app.toast('تم تسجيل حركة العهدة بنجاح ✅', 'success');
      });
    },

    async approveCustody(id, st) {
      if (!this.isManager()) return;
      await window.DamanApp.db.collection('companyCustody').doc(id).update({ status: st });
      window.DamanApp.toast(st === 'approved' ? 'تم اعتماد العهدة ✅' : 'تم رفض البند', 'info');
    },

    printCustodyA4() {
      const app = window.DamanApp;
      const list = this.filterBySite(this.custodies);
      let totalIssued = 0, totalSpent = 0;
      const rows = list.map((c, i) => {
        if (c.status !== 'rejected') {
          if (c.kind === 'issue') totalIssued += Number(c.amount || 0);
          else totalSpent += Number(c.amount || 0);
        }
        return `<tr><td>${i + 1}</td><td>${app.esc(c.date || '')}</td><td>${app.esc(c.holderName)}</td><td>${c.kind === 'issue' ? 'صرف عهدة (+)' : 'مصروف بفاتورة (-)'}</td><td>${app.esc(c.siteName || '—')}</td><td>${app.esc(c.note || '')}</td><td><b>${app.fmtMoney(c.amount)} ج.م</b></td></tr>`;
      }).join('');
      const rem = Math.round((totalIssued - totalSpent) * 100) / 100;
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:15px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">تصفية كشف العهدة والمصروفات — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table style="margin-bottom:10px;">
            <tr><th>إجمالي العهدة المنصرفة</th><td><b>${app.fmtMoney(totalIssued)} ج.م</b></td><th>إجمالي المصروفات</th><td><b>${app.fmtMoney(totalSpent)} ج.م</b></td><th>صافي المتبقي بالعهدة</th><td><b>${app.fmtMoney(rem)} ج.م</b></td></tr>
          </table>
          <table>
            <thead><tr><th>#</th><th>التاريخ</th><th>حامل العهدة</th><th>النوع</th><th>الموقع</th><th>البيان</th><th>المبلغ</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;">لا توجد حركات عهدة</td></tr>'}</tbody>
          </table>
          ${this.sigBlockHtml('حامل العهدة', 'المراجعة والحسابات', 'اعتماد الإدارة')}
        </div>`);
    },

    // ==================== 7. TEAM, PAYROLL, ADVANCES & OFFBOARDING ====================
    calcMemberNetSalary(m) {
      const base = Number(m.baseSalary || 0);
      const allow = Number(m.allowances || 0);
      const ot = Number(m.overtimeAmount || 0);
      const adv = Number(m.advances || 0);
      const ded = Number(m.deductions || 0);
      const absentDays = Math.max(0, Number(m.approvedAbsentDays || 0));
      const absentCut = Math.round(((base / 30) * absentDays) * 100) / 100;
      const net = Math.max(0, Math.round((base + allow + ot - adv - ded - absentCut) * 100) / 100);
      return { base, allow, ot, adv, ded, absentDays, absentCut, net };
    },

    openEditMemberModal(memberId) {
      if (!this.isManager()) return;
      const app = window.DamanApp;
      const m = this.members.find((x) => x.id === memberId);
      if (!m) return;
      const assigned = Array.isArray(m.assignedSites) ? m.assignedSites : [];

      let modal = document.getElementById('daman-comp-mem-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-comp-mem-modal';
        modal.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">إدارة الموظف: ${app.esc(m.name)}</h3>
            <button onclick="document.getElementById('daman-comp-mem-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanCompany.saveMemberChanges(event,'${m.id}')" class="space-y-2.5">
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">المسمى الوظيفي</label><input id="em-title" type="text" value="${app.esc(m.jobTitle || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-1">الصلاحية</label>
                <select id="em-role" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="employee" ${m.role === 'employee' ? 'selected' : ''}>موظف / فني</option>
                  <option value="supervisor" ${m.role === 'supervisor' ? 'selected' : ''}>مشرف تنفيذ</option>
                  <option value="engineer" ${m.role === 'engineer' ? 'selected' : ''}>مهندس تنفيذ</option>
                  <option value="hr" ${m.role === 'hr' ? 'selected' : ''}>محاسب / HR</option>
                  <option value="manager" ${m.role === 'manager' ? 'selected' : ''}>مدير مشروع</option>
                  ${m.role === 'owner' ? '<option value="owner" selected>مالك الشركة</option>' : ''}
                </select>
              </div>
            </div>
            ${this.sites.length ? `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div class="text-[10px] text-sky-300 font-bold">تخصيص المواقع المسموح برؤيتها (اتركه فارغاً لكل المواقع):</div>
                <div class="flex flex-wrap gap-2">${this.sites.map((s) => `<label class="flex items-center gap-1 text-[10.5px]"><input type="checkbox" class="em-site-cb accent-sky-500" value="${s.id}" ${assigned.includes(s.id) ? 'checked' : ''} /> ${app.esc(s.name)}</label>`).join('')}</div>
              </div>` : ''}
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">الراتب الأساسي</label><input id="em-base" type="number" min="0" step="any" value="${Number(m.baseSalary || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
              <div><label class="block text-[10px] text-sky-300 font-bold mb-1">البدلات (+)</label><input id="em-allow" type="number" min="0" step="any" value="${Number(m.allowances || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">إضافي معتمد (+)</label><input id="em-ot" type="number" min="0" step="any" value="${Number(m.overtimeAmount || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-rose-300 font-bold mb-1">أيام غياب معتمدة</label><input id="em-abs" type="number" min="0" max="30" step="0.5" value="${Number(m.approvedAbsentDays || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-rose-300 font-bold mb-1">سُلف الشهر (-)</label><input id="em-adv" type="number" min="0" step="any" value="${Number(m.advances || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-rose-300 font-bold mb-1">خصومات/جزاءات (-)</label><input id="em-ded" type="number" min="0" step="any" value="${Number(m.deductions || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ التعديلات</button>
          </form>
        </div>`;
    },

    async saveMemberChanges(e, memberId) {
      e.preventDefault();
      const assignedSites = Array.from(document.querySelectorAll('.em-site-cb:checked')).map((el) => el.value);
      await window.DamanApp.db.collection('companyMembers').doc(memberId).update({
        jobTitle: document.getElementById('em-title').value.trim(),
        role: document.getElementById('em-role').value,
        assignedSites,
        baseSalary: parseFloat(document.getElementById('em-base').value) || 0,
        allowances: parseFloat(document.getElementById('em-allow').value) || 0,
        overtimeAmount: parseFloat(document.getElementById('em-ot').value) || 0,
        approvedAbsentDays: parseFloat(document.getElementById('em-abs').value) || 0,
        advances: parseFloat(document.getElementById('em-adv').value) || 0,
        deductions: parseFloat(document.getElementById('em-ded').value) || 0
      });
      document.getElementById('daman-comp-mem-modal').classList.add('hidden');
      window.DamanApp.toast('تم تحديث بيانات وصلاحيات الموظف ✅', 'success');
    },

    async toggleMemberStatus(memberId) {
      if (!this.isManager()) return;
      const m = this.members.find((x) => x.id === memberId);
      if (!m || m.role === 'owner') return;
      const next = m.status === 'suspended' ? 'active' : 'suspended';
      await window.DamanApp.db.collection('companyMembers').doc(memberId).update({ status: next });
      window.DamanApp.toast(next === 'suspended' ? 'تم إيقاف الموظف' : 'تم تفعيل الموظف ✅', 'info');
    },

    async offboardMember(memberId) {
      if (!this.isManager()) return;
      const app = window.DamanApp;
      const m = this.members.find((x) => x.id === memberId);
      if (!m || m.role === 'owner') return;
      if (!window.confirm(`إنهاء خدمة وفصل الموظف «${m.name}» من الشركة؟\n(سيُفصل حسابه عن الشركة مع الاحتفاظ بسجل رواتبه وعهدته في الأرشيف)`)) return;
      await app.db.collection('companyMembers').doc(memberId).update({ status: 'terminated', terminatedDate: app.todayLocal() });
      await app.db.collection('users').doc(m.userId).update({ companyId: '', companyCode: '' }).catch(() => {});
      await app.sendNotification(m.userId, 'إنهاء ارتباطك بالشركة', `تم إنهاء خدمتك وإغلاق صلاحيتك في شركة ${this.company.name}.`);
      app.toast('تم إنهاء خدمة الموظف وفصله عن الشركة', 'info');
    },

    async submitAdvanceRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const me = this.getMyMember();
      if (!me) return;
      const amount = Math.round((parseFloat(document.getElementById('adv-amt').value) || 0) * 100) / 100;
      const reason = document.getElementById('adv-reason').value.trim();
      if (amount <= 0) return;
      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'advance', memberId: me.id,
        userId: app.user.uid, userName: app.profile?.name || '', amount, reason,
        status: 'pending', date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await app.sendNotification(this.company.ownerId, 'طلب سلفة جديد 💵', `${app.profile?.name} طلب سلفة بمبلغ ${app.fmtMoney(amount)} ج.م`);
      e.target.reset();
      app.toast('تم إرسال طلب السلفة للإدارة ✅', 'success');
    },

    async respondAdvance(opId, approve) {
      if (!this.isManager()) return;
      const op = this.ops.find((x) => x.id === opId);
      if (!op || op.status !== 'pending') return;
      await window.DamanApp.db.collection('companyOps').doc(opId).update({ status: approve ? 'approved' : 'rejected' });
      if (approve && op.memberId) {
        await window.DamanApp.db.collection('companyMembers').doc(op.memberId).update({
          advances: firebase.firestore.FieldValue.increment(Number(op.amount || 0))
        }).catch(() => {});
      }
      await window.DamanApp.sendNotification(op.userId, approve ? '✅ تمت الموافقة على السلفة' : '❌ تم رفض طلب السلفة', `${window.DamanApp.fmtMoney(op.amount)} ج.م`);
      window.DamanApp.toast(approve ? 'تمت الموافقة وترحيل السلفة للراتب ✅' : 'تم الرفض', 'info');
    },

    async payMemberSalary(memberId, method) {
      const app = window.DamanApp;
      if (!this.isManager()) return;
      const m = this.members.find((x) => x.id === memberId);
      if (!m) return;
      const calc = this.calcMemberNetSalary(m);
      if (calc.net <= 0) return app.toast('صافي الراتب صفر', 'warning');
      const month = app.todayLocal().slice(0, 7);
      if (!window.confirm(`تأكيد صرف راتب ${m.name} لشهر ${month} بمبلغ ${app.fmtMoney(calc.net)} ج.م (${method === 'wallet' ? 'محفظة ضمان سايت' : 'نقداً'})؟`)) return;

      await app.withLock('paySal_' + memberId, async () => {
        const payDocRef = app.db.collection('companyPayroll').doc();
        const memRef = app.db.collection('companyMembers').doc(memberId);
        try {
          if (method === 'wallet') {
            const payerRef = app.db.collection('users').doc(app.user.uid);
            const empRef = app.db.collection('users').doc(m.userId);
            await app.db.runTransaction(async (tx) => {
              const [pDoc, eDoc] = await Promise.all([tx.get(payerRef), tx.get(empRef)]);
              const pCur = Number((pDoc.data() || {}).balanceAvailable || 0);
              const eCur = Number((eDoc.data() || {}).balanceAvailable || 0);
              if (pCur < calc.net) throw new Error('رصيدك المتاح بالمحفظة لا يكفي لصرف الراتب');
              const pAfter = Math.round((pCur - calc.net) * 100) / 100;
              const eAfter = Math.round((eCur + calc.net) * 100) / 100;
              tx.update(payerRef, { balanceAvailable: pAfter });
              tx.update(empRef, { balanceAvailable: eAfter });
              tx.set(app.db.collection('transactions').doc(), {
                userId: app.user.uid, type: 'salary_out', amount: -calc.net, balanceBefore: pCur, balanceAfter: pAfter,
                note: `صرف راتب ${m.name} (${month})`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              tx.set(app.db.collection('transactions').doc(), {
                userId: m.userId, type: 'salary_in', amount: calc.net, balanceBefore: eCur, balanceAfter: eAfter,
                note: `راتب شهر ${month} من ${this.company.name}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              tx.set(payDocRef, Object.assign({
                companyId: this.company.id, memberId, userId: m.userId, employeeName: m.legalName || m.name,
                jobTitle: m.jobTitle || '', month, method: 'wallet', date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              }, calc));
              tx.update(memRef, { overtimeAmount: 0, advances: 0, deductions: 0, approvedAbsentDays: 0 });
            });
          } else {
            await payDocRef.set(Object.assign({
              companyId: this.company.id, memberId, userId: m.userId, employeeName: m.legalName || m.name,
              jobTitle: m.jobTitle || '', month, method: 'cash', date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, calc));
            await memRef.update({ overtimeAmount: 0, advances: 0, deductions: 0, approvedAbsentDays: 0 });
          }
          await app.sendNotification(m.userId, `تم صرف راتب شهر ${month} 💰`, `صافي الراتب: ${app.fmtMoney(calc.net)} ج.م`);
          app.toast(`تم صرف راتب ${m.name} بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    printPayrollSheetA4() {
      const app = window.DamanApp;
      let totalNet = 0;
      const activeMems = this.members.filter((m) => m.status !== 'terminated');
      const rows = activeMems.map((m, i) => {
        const c = this.calcMemberNetSalary(m);
        totalNet += c.net;
        return `<tr><td>${i + 1}</td><td><b>${app.esc(m.legalName || m.name)}</b><br/><span style="font-size:10px;">${app.esc(m.jobTitle || '')}</span></td><td>${app.fmtMoney(c.base)}</td><td>${app.fmtMoney(c.allow)}</td><td>${app.fmtMoney(c.ot)}</td><td>${c.absentDays}ي (${app.fmtMoney(c.absentCut)})</td><td>${app.fmtMoney(c.adv)}</td><td>${app.fmtMoney(c.ded)}</td><td><b>${app.fmtMoney(c.net)} ج.م</b></td><td style="width:12%;"></td></tr>`;
      }).join('');
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">كشف رواتب الموظفين — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>الشهر:</b> ${app.todayLocal().slice(0, 7)} | <b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table>
            <thead><tr><th>#</th><th>الاسم والوظيفة</th><th>الأساسي</th><th>بدلات</th><th>إضافي</th><th>غياب معتمد</th><th>سُلف</th><th>خصومات</th><th>الصافي</th><th>التوقيع</th></tr></thead>
            <tbody>${rows}<tr><th colspan="8">إجمالي الرواتب المستحقة</th><th colspan="2">${app.fmtMoney(totalNet)} ج.م</th></tr></tbody>
          </table>
          ${this.sigBlockHtml('الحسابات / HR', 'المراجع المالي', 'المدير العام')}
        </div>`);
    },

    printPayslipA4(logId) {
      const app = window.DamanApp;
      const p = this.payrollLogs.find((x) => x.id === logId);
      if (!p) return;
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div><h2 style="margin:0; font-size:16px;">قسيمة راتب رسمية — ${app.esc(this.company?.name || '')}</h2></div>
            <div style="font-size:11px;"><b>شهر:</b> ${app.esc(p.month)} | <b>الصرف:</b> ${app.esc(p.date)}</div>
          </div>
          <table style="margin-bottom:10px;">
            <tr><th>اسم الموظف</th><td><b>${app.esc(p.employeeName)}</b></td><th>الوظيفة</th><td>${app.esc(p.jobTitle)}</td></tr>
          </table>
          <table>
            <tr><th>الأساسي</th><td>${app.fmtMoney(p.base)} ج.م</td><th>غياب معتمد (${p.absentDays || 0} يوم)</th><td>- ${app.fmtMoney(p.absentCut || 0)} ج.م</td></tr>
            <tr><th>بدلات</th><td>+ ${app.fmtMoney(p.allow)} ج.م</td><th>سُلف</th><td>- ${app.fmtMoney(p.adv)} ج.م</td></tr>
            <tr><th>إضافي</th><td>+ ${app.fmtMoney(p.ot)} ج.م</td><th>خصومات</th><td>- ${app.fmtMoney(p.ded)} ج.م</td></tr>
            <tr><th colspan="2">صافي الراتب المصروف (${p.method === 'wallet' ? 'محفظة' : 'نقداً'})</th><th colspan="2" style="font-size:14px;">${app.fmtMoney(p.net)} ج.م</th></tr>
          </table>
          ${this.sigBlockHtml('توقيع المستلم', 'الحسابات', 'اعتماد الإدارة')}
        </div>`);
    },

    // ==================== 8. DAILY REPORTS, TASKS, SITE P&L, LEAVES, GROUP ====================
    async handleReportPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempReportPhoto = await window.DamanApp.compressImage(f, 700, 0.56);
      const p = document.getElementById('dr-photo-prev');
      if (p) p.innerHTML = `<img src="${this.tempReportPhoto}" class="max-h-20 mx-auto rounded mt-1" />`;
    },

    async submitDailyReport(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('dr-site-sel', 'dr-site-txt');
      const workDone = document.getElementById('dr-work').value.trim();
      if (!workDone) return;
      const photoMedia = this.tempReportPhoto ? await app.saveMedia(this.tempReportPhoto, { kind: 'daily_rep' }) : '';
      await app.db.collection('companyDailyReports').add({
        companyId: this.company.id, authorUid: app.user.uid,
        authorName: app.profile?.legalName || app.profile?.name || '',
        date: app.todayLocal(), siteId, siteName,
        workforceSummary: document.getElementById('dr-workforce').value.trim(),
        workDone, materials: document.getElementById('dr-mat').value.trim(),
        obstacles: document.getElementById('dr-obs').value.trim(),
        tomorrowPlan: document.getElementById('dr-plan').value.trim(),
        photoMedia, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.tempReportPhoto = '';
      e.target.reset();
      app.toast('تم حفظ التقرير اليومي للموقع ✅', 'success');
    },

    printDailyReportA4(repId) {
      const app = window.DamanApp;
      const r = this.dailyReports.find((x) => x.id === repId);
      if (!r) return;
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:15px 18px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div><h2 style="margin:0; font-size:16px;">التقرير اليومي لأعمال الموقع</h2><div style="font-size:12px;"><b>${app.esc(this.company?.name || '')}</b></div></div>
            <div style="font-size:11px; text-align:left;"><div><b>التاريخ:</b> ${app.esc(r.date)}</div><div><b>إعداد:</b> ${app.esc(r.authorName)}</div></div>
          </div>
          <table>
            <tr><th style="width:24%;">الموقع / المشروع</th><td><b>${app.esc(r.siteName)}</b></td></tr>
            <tr><th>بيان العمالة</th><td style="white-space:pre-line;">${app.esc(r.workforceSummary || '—')}</td></tr>
            <tr><th>الأعمال المنفذة اليوم</th><td style="white-space:pre-line;">${app.esc(r.workDone)}</td></tr>
            <tr><th>الخامات والتوريدات</th><td style="white-space:pre-line;">${app.esc(r.materials || '—')}</td></tr>
            <tr><th>المعوقات والملاحظات</th><td style="white-space:pre-line;">${app.esc(r.obstacles || 'لا توجد معوقات')}</td></tr>
            <tr><th>خطة العمل لليوم التالي</th><td style="white-space:pre-line;">${app.esc(r.tomorrowPlan || '—')}</td></tr>
          </table>
          ${this.sigBlockHtml()}
        </div>`);
    },

    async submitTask(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const { siteId, siteName } = this.resolveSiteFromInput('tk-site-sel', 'tk-site-txt');
      const title = document.getElementById('ctk-title').value.trim();
      const assigneeName = document.getElementById('ctk-assignee').value.trim();
      const dueDate = document.getElementById('ctk-due').value;
      if (!title) return;
      await app.db.collection('companyOps').add({
        companyId: this.company.id, opType: 'task', siteId, siteName,
        title, assigneeName, dueDate, status: 'open', proofMedia: '',
        createdByName: app.profile?.name || '', date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast('تم إسناد المهمة بنجاح ✅', 'success');
    },

    async completeTaskWithPhoto(input, taskId) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      let proofMedia = '';
      if (f) {
        const b64 = await app.compressImage(f, 700, 0.56);
        proofMedia = await app.saveMedia(b64, { kind: 'task_proof' });
      }
      await app.db.collection('companyOps').doc(taskId).update({ status: 'done', proofMedia, doneDate: app.todayLocal() });
      app.toast('تم إغلاق المهمة بنجاح ✅', 'success');
    },

    calcSitePnL() {
      const siteObj = this.selectedSiteId !== 'all' ? this.sites.find((s) => s.id === this.selectedSiteId) : null;
      const budget = siteObj ? Number(siteObj.budget || 0) : this.sites.reduce((s, x) => s + Number(x.budget || 0), 0);
      const custodySpent = this.filterBySite(this.custodies)
        .filter((c) => c.kind === 'expense' && c.status !== 'rejected')
        .reduce((s, c) => s + Number(c.amount || 0), 0);
      const overtimeApproved = this.getOps('overtime')
        .filter((o) => o.status === 'approved')
        .reduce((s, o) => s + Number(o.amount || 0), 0);
      const subPayments = this.getOps('sub_tx')
        .filter((t) => t.txKind === 'payment')
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const equipCosts = this.getOps('equipment')
        .reduce((s, e) => s + Number(e.totalCost || 0), 0);
      const payrollTotal = this.selectedSiteId === 'all'
        ? this.payrollLogs.reduce((s, p) => s + Number(p.net || 0), 0)
        : 0;
      const totalSpent = Math.round((custodySpent + overtimeApproved + subPayments + equipCosts + payrollTotal) * 100) / 100;
      const variance = Math.round((budget - totalSpent) * 100) / 100;
      return { siteLabel: siteObj ? siteObj.name : 'كل مواقع الشركة', budget, custodySpent, overtimeApproved, subPayments, equipCosts, payrollTotal, totalSpent, variance };
    },

    printSitePnLA4() {
      const app = window.DamanApp;
      const p = this.calcSitePnL();
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div><h2 style="margin:0; font-size:16px;">الموقف المالي وتكاليف الموقع — ${app.esc(this.company?.name || '')}</h2><div>النطاق: <b>${app.esc(p.siteLabel)}</b></div></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table>
            <tr><th style="width:45%;">ميزانية / قيمة عقد الموقع</th><td><b>${app.fmtMoney(p.budget)} ج.م</b></td></tr>
            <tr><th>مصروفات العهدة والفواتير</th><td>${app.fmtMoney(p.custodySpent)} ج.م</td></tr>
            <tr><th>دفعات مقاولي الباطن</th><td>${app.fmtMoney(p.subPayments)} ج.م</td></tr>
            <tr><th>إيجارات المعدات والشدات</th><td>${app.fmtMoney(p.equipCosts)} ج.م</td></tr>
            <tr><th>العمل الإضافي والسهر المعتمد</th><td>${app.fmtMoney(p.overtimeApproved)} ج.م</td></tr>
            <tr><th>الرواتب المصروفة (للشركة)</th><td>${app.fmtMoney(p.payrollTotal)} ج.م</td></tr>
            <tr><th>إجمالي التكاليف الفعلية</th><td><b>${app.fmtMoney(p.totalSpent)} ج.م</b></td></tr>
            <tr><th>صافي المتبقي / الوفر (الميزانية − التكاليف)</th><td><b style="font-size:14px;">${app.fmtMoney(p.variance)} ج.م</b></td></tr>
          </table>
          ${this.sigBlockHtml('الحسابات', 'مهندس المكتب الفني', 'مدير المشروع / المالك')}
        </div>`);
    },

    async submitLeaveRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.db.collection('companyLeaves').add({
        companyId: this.company.id, userId: app.user.uid, userName: app.profile?.name || '',
        leaveType: document.getElementById('lv-type').value,
        fromDate: document.getElementById('lv-from').value,
        days: parseInt(document.getElementById('lv-days').value, 10) || 1,
        reason: document.getElementById('lv-reason').value.trim(),
        status: 'pending', date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await app.sendNotification(this.company.ownerId, 'طلب إجازة جديد', `${app.profile?.name} قدّم طلب إجازة.`);
      e.target.reset();
      app.toast('تم إرسال طلب الإجازة ✅', 'success');
    },

    async respondLeave(id, st) {
      if (!this.isManager()) return;
      const lv = this.leaves.find((x) => x.id === id);
      await window.DamanApp.db.collection('companyLeaves').doc(id).update({ status: st });
      if (lv) await window.DamanApp.sendNotification(lv.userId, st === 'approved' ? '✅ موافقة على الإجازة' : '❌ رفض الإجازة', lv.reason || '');
      window.DamanApp.toast('تم التحديث', 'success');
    },

    async sendGroupMessage(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('cg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.company || !app.user) return;
      inp.value = '';
      await app.db.collection('companyMessages').add({
        companyId: this.company.id, senderId: app.user.uid,
        senderName: app.isAdmin() ? '👑 إدارة ضمان سايت' : (app.profile?.name || ''),
        isPlatformAdmin: app.isAdmin(), text, date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    },

    // ==================== RENDER SUB-TABS ====================
    renderSitePickerField(selId, txtId) {
      const opts = this.siteSelectOptions();
      return opts
        ? `<select id="${selId}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">${opts}</select>`
        : `<input id="${txtId}" type="text" placeholder="اسم الموقع / المشروع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />`;
    },

    renderOnboarding(app) {
      return `
        <div class="space-y-3.5 text-xs">
          <div class="glass-card rounded-3xl p-4 border-sky-500/40 space-y-2">
            <h2 class="text-sm font-black text-sky-400"><i class="fa-solid fa-building-user me-1"></i> منظومة إدارة شركات ومواقع المقاولات (Construction ERP)</h2>
            <p class="text-[11px] text-slate-300 leading-relaxed">حضور GPS بالورديات، تحضير جماعي للعمال، إذونات إضافي، مستخلصات وإشعارات خصم مقاولي الباطن، جرد المخزن والصب، العهدة، والرواتب — بكل نماذجها A4.</p>
          </div>
          <form onsubmit="DamanCompany.createCompanyWorkspace(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-amber-500/40">
            <h3 class="font-black text-amber-400">1. إنشاء مساحة شركة جديدة</h3>
            <input id="nc-name" type="text" required value="${app.esc(app.profile?.companyName || '')}" placeholder="اسم الشركة / المكتب الهندسي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="nc-cr" type="text" value="${app.esc(app.profile?.commercialReg || '')}" placeholder="السجل التجاري" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="nc-tax" type="text" value="${app.esc(app.profile?.taxCard || '')}" placeholder="البطاقة الضريبية" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إنشاء الشركة وتوليد كود الانضمام</button>
          </form>
          <form onsubmit="DamanCompany.joinCompanyByCode(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-emerald-500/40">
            <h3 class="font-black text-emerald-400">2. الانضمام لشركة قائمة بكود الشركة</h3>
            <input id="jc-code" type="text" required placeholder="كود الشركة (مثال: CMP-123456)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white uppercase font-black" />
            <input id="jc-title" type="text" required placeholder="المسمى الوظيفي (مثال: مشرف تنفيذ / مهندس موقع)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">انضمام للشركة الآن</button>
          </form>
        </div>`;
    },

    renderAttendanceTab(app) {
      const isMgr = this.isManager();
      const logs = this.filterBySite(this.attendance);
      return `
        <div class="space-y-3 text-xs">
          ${isMgr ? `
            <div class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
              <div class="flex items-center justify-between">
                <span class="font-black text-sky-300">📍 مواقع الشركة الثابتة (${this.sites.length})</span>
                <div class="flex gap-1.5">
                  <button onclick="DamanCompany.printAttendanceA4()" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">شيت A4</button>
                  <button onclick="DamanCompany.openAddSiteModal()" class="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">+ موقع GPS</button>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">${this.sites.map((s) => `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-[10px]"><b class="text-white">${app.esc(s.name)}</b> (${s.shiftStart || '08:00'}) <button onclick="DamanCompany.removeCompanySite('${s.id}')" class="text-rose-400">×</button></span>`).join('') || '<span class="text-slate-400 text-[10px]">أضف مواقعك لتفعيل كشف الـ GPS والورديات.</span>'}</div>
            </div>` : ''}

          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-emerald-500/40">
            <div class="font-black text-emerald-400">🟢 تسجيل حضور وانصراف فردي (GPS + سيلفي)</div>
            ${this.renderSitePickerField('att-site-select', 'att-site-custom')}
            <label class="block p-2.5 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-black text-emerald-300"><i class="fa-solid fa-camera me-1"></i> سيلفي مباشر من الموقع *</span>
              <input type="file" accept="image/*" capture="user" class="hidden" onchange="DamanCompany.handleAttendanceSelfie(this)" />
              <div id="att-selfie-prev"></div>
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button onclick="DamanCompany.recordAttendance('in')" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">🟢 تسجيل حضور</button>
              <button onclick="DamanCompany.recordAttendance('out')" class="py-2.5 rounded-xl bg-rose-500 text-white font-black">🔴 تسجيل انصراف</button>
            </div>
          </div>

          ${this.canSupervise() ? `
            <form onsubmit="DamanCompany.submitBulkWorkerAttendance(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-amber-500/40">
              <div class="font-black text-amber-400">👷 تحضير جماعي سريع لعمال اليومية (بدون موبايلات)</div>
              ${this.renderSitePickerField('ba-site-sel', 'ba-site-txt')}
              <div class="grid grid-cols-2 gap-2">
                <input id="ba-trade" type="text" placeholder="المهنة (نجارين / حدادين / عمال)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                <select id="ba-status" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                  <option value="حضور يوم كامل">حضور يوم كامل</option>
                  <option value="نص يوم">نص يوم</option>
                  <option value="حضور + سهر">حضور + سهر</option>
                  <option value="غياب">غياب</option>
                </select>
              </div>
              <textarea id="ba-names" rows="2" required placeholder="اكتب أسماء العمال مفصولة بفاصلة أو سطر جديد..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
              <label class="block p-2 rounded-xl border border-dashed border-amber-500/40 bg-slate-950 text-center cursor-pointer"><span class="text-amber-300 font-bold">📷 صورة جماعية للموقع (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanCompany.handleBulkPhoto(this)" /><div id="bulk-att-prev"></div></label>
              <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ تحضير الفرقة</button>
            </form>` : ''}

          <div class="space-y-2">
            ${logs.slice(0, 35).map((a) => a.isBulk ? `
              <div class="glass-card rounded-2xl p-3 space-y-1">
                <div class="flex justify-between"><b class="text-amber-300">👷 تحضير جماعي (${a.workersCount} ${app.esc(a.trade)}) — ${app.esc(a.statusType)}</b><span class="text-[10px] text-slate-400">${app.esc(a.date)}</span></div>
                <div class="text-[10.5px] text-slate-300">${app.esc(a.siteName)} • بواسطة ${app.esc(a.userName)}</div>
                <div class="text-[10px] text-white">${app.esc((a.workersList || []).join('، '))}</div>
                ${a.selfieMedia ? `<button onclick="DamanApp.openMediaLightbox('${a.selfieMedia}','صورة تحضير الفرقة')" class="text-[10px] text-sky-300 underline font-bold">عرض صورة الموقع</button>` : ''}
              </div>` : `
              <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
                <div class="min-w-0 space-y-0.5">
                  <div class="font-black text-white">${a.kind === 'in' ? '🟢 حضور' : '🔴 انصراف'} — ${app.esc(a.userName)} ${a.lateMinutes ? `<span class="text-rose-400 text-[10px]">(تأخير ${a.lateMinutes}د)</span>` : ''}</div>
                  <div class="text-[10px] text-slate-300">${app.esc(a.siteName)} • ${app.esc(a.date)} (${app.esc(a.time || '')})</div>
                  <div class="text-[10px]">${a.geoStatus === 'inside' ? `<span class="text-emerald-400 font-bold">✅ داخل النطاق (${a.distanceMeters}م)</span>` : a.geoStatus === 'outside' ? `<span class="text-rose-400 font-black">⚠️ خارج الموقع (${a.distanceMeters}م)</span>` : '<span class="text-slate-400">بدون نطاق GPS</span>'}</div>
                </div>
                <div class="flex gap-1.5 shrink-0">
                  ${a.coords ? `<a href="https://maps.google.com/?q=${a.coords.lat},${a.coords.lng}" target="_blank" class="px-2 py-1 rounded-lg bg-slate-800 text-sky-300 text-[10px] font-bold">GPS</a>` : ''}
                  ${a.selfieMedia ? `<button onclick="DamanApp.openMediaLightbox('${a.selfieMedia}','سيلفي ${app.esc(a.userName)}')" class="px-2 py-1 rounded-lg bg-slate-800 text-amber-300 text-[10px] font-bold">سيلفي</button>` : ''}
                </div>
              </div>`).join('') || '<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد سجلات حضور بعد.</div>'}
          </div>
        </div>`;
    },

    renderOvertimeTab(app) {
      const isMgr = this.isManager();
      const list = this.getOps('overtime');
      const memOpts = '<option value="">بدون ربط بموظف (فرقة/مقاول)</option>' + this.members.filter((m) => m.status === 'active').map((m) => `<option value="${m.id}">${app.esc(m.name)}</option>`).join('');
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanCompany.submitOvertimeRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-amber-500/40">
            <div class="font-black text-amber-400">⏱️ رفع إذن عمل إضافي / سهر بالموقع</div>
            ${this.renderSitePickerField('ot-site-sel', 'ot-site-txt')}
            <select id="ot-member" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-bold">${memOpts}</select>
            <input id="ot-names" type="text" required placeholder="الأسماء / اسم المقاول والفرقة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <input id="ot-elem" type="text" required placeholder="البند / العنصر (مثال: تجهيز شدة سقف فيلا 22 للصب)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="ot-hours" type="number" step="0.5" min="0.5" required placeholder="عدد الساعات" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="ot-amt" type="number" step="any" min="0" required placeholder="القيمة (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
            </div>
            <input id="ot-reason" type="text" required placeholder="مبرر العمل الإضافي..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ وطلب الاعتماد</button>
          </form>

          ${list.map((o) => `
            <div class="glass-card rounded-2xl p-3 space-y-1.5">
              <div class="flex justify-between"><b class="text-white">${app.esc(o.targetName)} — ${o.hours} ساعة</b><b class="text-emerald-400">${app.fmtMoney(o.amount)} ج.م</b></div>
              <div class="text-[10.5px] text-amber-300">${app.esc(o.siteName)} • ${app.esc(o.element)} (${app.esc(o.date)})</div>
              <div class="text-[10.5px] text-slate-300">${app.esc(o.reason)}</div>
              <div class="flex gap-1.5 pt-1">
                <button onclick="DamanCompany.printOvertimeA4('${o.id}')" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">نموذج A4</button>
                ${isMgr && o.status === 'pending' ? `<button onclick="DamanCompany.respondOvertime('${o.id}',true)" class="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد</button><button onclick="DamanCompany.respondOvertime('${o.id}',false)" class="px-3 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>` : `<span class="text-[10px] px-2 py-1 rounded bg-slate-800 font-bold text-slate-200">${app.esc(o.status)}</span>`}
              </div>
            </div>`).join('') || '<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد إذونات إضافي بعد.</div>'}
        </div>`;
    },

    renderSubcontractorsTab(app) {
      const subs = this.getOps('subcontractor');
      const txs = this.getOps('sub_tx');
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanCompany.addSubcontractor(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🤝 تسجيل مقاول باطن جديد</div>
            ${this.renderSitePickerField('sc-site-sel', 'sc-site-txt')}
            <div class="grid grid-cols-2 gap-2">
              <input id="sc-name" type="text" required placeholder="اسم المقاول" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="sc-trade" type="text" required placeholder="التخصص (نجارة/حدادة/محارة)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="sc-rate" type="number" step="any" min="0" placeholder="الفئة / سعر الوحدة (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="sc-unit" type="text" value="متر مكعب" placeholder="الوحدة (م³ / م² / مقطوعية)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black">إضافة المقاول</button>
          </form>

          ${subs.length ? `
            <form onsubmit="DamanCompany.submitSubTx(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-rose-500/40">
              <div class="font-black text-amber-400">📄 قيد أعمال / دفعة / إشعار خصم مقاول</div>
              <div class="grid grid-cols-2 gap-2">
                <select id="stx-sub" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">${subs.map((s) => `<option value="${s.id}">${app.esc(s.name)} (${app.esc(s.trade)})</option>`).join('')}</select>
                <select id="stx-kind" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-amber-300 font-bold">
                  <option value="deduction">⚠️ إشعار خصم على المقاول (-)</option>
                  <option value="payment">💸 دفعة منصرفة للمقاول (-)</option>
                  <option value="work">✅ حصر أعمال منفذة للمستخلص (+)</option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input id="stx-qty" type="number" step="any" min="0" placeholder="الكمية (للأعمال)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                <input id="stx-amt" type="number" step="any" min="0" placeholder="القيمة ج.م (تلقائي لو كمية)" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
              </div>
              <input id="stx-reason" type="text" required placeholder="البيان / سبب الخصم أو رقم المستخلص..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <label class="block p-2 rounded-xl border border-dashed border-rose-500/40 bg-slate-950 text-center cursor-pointer"><span class="text-rose-300 font-bold">📷 إرفاق صورة إثبات للخصم (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanCompany.handleDedPhoto(this)" /><div id="sub-ded-prev"></div></label>
              <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ القيد بحساب المقاول</button>
            </form>` : ''}

          <div class="space-y-2">
            ${subs.map((s) => {
              const sTxs = txs.filter((t) => t.subId === s.id);
              const w = sTxs.filter((t) => t.txKind === 'work').reduce((a, b) => a + Number(b.amount || 0), 0);
              const p = sTxs.filter((t) => t.txKind === 'payment').reduce((a, b) => a + Number(b.amount || 0), 0);
              const d = sTxs.filter((t) => t.txKind === 'deduction').reduce((a, b) => a + Number(b.amount || 0), 0);
              return `
                <div class="glass-card rounded-2xl p-3 space-y-1.5">
                  <div class="flex justify-between items-center">
                    <div><b class="text-white">${app.esc(s.name)}</b> <span class="text-amber-300 text-[10px]">(${app.esc(s.trade)})</span></div>
                    <button onclick="DamanCompany.printSubAbstractA4('${s.id}')" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">مستخلص A4</button>
                  </div>
                  <div class="text-[10.5px] text-slate-300">أعمال: <b class="text-emerald-400">${app.fmtMoney(w)}</b> | دفعات: ${app.fmtMoney(p)} | خصومات: <b class="text-rose-400">${app.fmtMoney(d)}</b> | الصافي: <b class="text-amber-300">${app.fmtMoney(Math.round((w - p - d) * 100) / 100)} ج.م</b></div>
                </div>`;
            }).join('')}

            ${txs.filter((t) => t.txKind === 'deduction').slice(0, 12).map((t) => `
              <div class="glass-card rounded-xl p-2.5 border-rose-500/40 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-black text-rose-300 truncate">خصم على ${app.esc(t.subName)}: ${app.fmtMoney(t.amount)} ج.م</div>
                  <div class="text-[10px] text-slate-300 truncate">${app.esc(t.reason)} • ${app.esc(t.date)}</div>
                </div>
                <div class="flex gap-1 shrink-0">
                  ${t.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${t.photoMedia}','إثبات خصم')" class="px-2 py-1 rounded bg-slate-800 text-sky-300 text-[10px]">صورة</button>` : ''}
                  <button onclick="DamanCompany.printDeductionNoticeA4('${t.id}')" class="px-2 py-1 rounded bg-white text-slate-950 font-black text-[10px]">إشعار A4</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderOpsTab(app) {
      const st = this.opsSubTab;
      const pills = [['inventory', '📦 الجرد والمخزن'], ['concrete', '🧱 صب الخرسانة'], ['mr', '📋 طلبات التوريد'], ['equipment', '🚜 المعدات']];
      let content = '';

      if (st === 'inventory') {
        const list = this.getOps('inventory');
        content = `
          <div class="flex justify-between items-center"><span class="font-black text-amber-400">جرد الأخشاب والمعدات والخامات</span><button onclick="DamanCompany.printInventoryA4()" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">محضر جرد A4</button></div>
          <form onsubmit="DamanCompany.submitInventoryMove(event)" class="glass-card rounded-2xl p-3 space-y-2">
            ${this.renderSitePickerField('inv-site-sel', 'inv-site-txt')}
            <div class="grid grid-cols-2 gap-2">
              <input id="inv-item" type="text" required placeholder="الصنف (بليوود / لتزانة / جاكات / أسمنت)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="inv-unit" type="text" value="لوح / عدد" placeholder="الوحدة" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <select id="inv-type" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold"><option value="in">وارد للمخزن (+)</option><option value="out">منصرف للتنفيذ (-)</option><option value="damaged">تالف / هالك (-)</option></select>
              <input id="inv-qty" type="number" step="any" min="0.1" required placeholder="الكمية" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
            </div>
            <input id="inv-note" type="text" placeholder="ملاحظة / اسم المستلم..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black">قيد الحركة بالمخزن</button>
          </form>
          ${list.slice(0, 20).map((x) => `<div class="glass-card rounded-xl p-2.5 flex justify-between"><div><b class="text-white">${app.esc(x.itemName)}</b> <span class="text-slate-400 text-[10px]">(${app.esc(x.siteName)} • ${app.esc(x.date)})</span></div><b class="${x.moveType === 'in' ? 'text-emerald-400' : 'text-rose-400'}">${x.moveType === 'in' ? '+' : '-'}${x.qty} ${app.esc(x.unit)}</b></div>`).join('')}`;
      } else if (st === 'concrete') {
        const list = this.getOps('concrete');
        content = `
          <div class="flex justify-between items-center"><span class="font-black text-sky-400">سجل صب الخرسانة ومقارنة الهالك</span><button onclick="DamanCompany.printConcreteA4()" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">تقرير صب A4</button></div>
          <form onsubmit="DamanCompany.submitConcretePour(event)" class="glass-card rounded-2xl p-3 space-y-2">
            ${this.renderSitePickerField('cn-site-sel', 'cn-site-txt')}
            <div class="grid grid-cols-2 gap-2">
              <input id="cn-elem" type="text" required placeholder="العنصر (سقف فيلا 14 / أعمدة)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="cn-grade" type="text" value="C30" placeholder="الرتبة (C25/C30)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="cn-design" type="number" step="0.5" min="0" required placeholder="الكمية الهندسية م³" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="cn-poured" type="number" step="0.5" min="0.5" required placeholder="المصبوب فعلياً م³" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="cn-supp" type="text" placeholder="محطة الخلط / المورّد" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="cn-note" type="text" placeholder="ملاحظات فنية" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black">تسجيل الصبة</button>
          </form>
          ${list.map((c) => `<div class="glass-card rounded-xl p-2.5 flex justify-between"><div><b class="text-white">${app.esc(c.element)} (${app.esc(c.grade)})</b><div class="text-[10px] text-slate-400">${app.esc(c.siteName)} • هندسي ${c.designQty}م³ / فعلي ${c.pouredQty}م³</div></div><b class="${c.diff > 0 ? 'text-rose-400' : 'text-emerald-400'}">فرق ${c.diff > 0 ? '+' : ''}${c.diff}م³</b></div>`).join('')}`;
      } else if (st === 'mr') {
        const list = this.getOps('mr');
        content = `
          <form onsubmit="DamanCompany.submitMaterialRequest(event)" class="glass-card rounded-2xl p-3 space-y-2 border-emerald-500/40">
            <div class="font-black text-emerald-400">📋 طلب توريد خامات للموقع (MR)</div>
            ${this.renderSitePickerField('mr-site-sel', 'mr-site-txt')}
            <input id="mr-item" type="text" required placeholder="الخامة المطلوبة (حديد 16مم / أسمنت / رمل)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-3 gap-1.5">
              <input id="mr-qty" type="number" step="any" min="0.5" required placeholder="الكمية" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="mr-unit" type="text" value="طن" placeholder="الوحدة" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="mr-date" type="date" value="${app.todayLocal()}" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[10px]" />
            </div>
            <input id="mr-note" type="text" placeholder="ملاحظات التوريد..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">رفع طلب التوريد</button>
          </form>
          ${list.map((m) => `
            <div class="glass-card rounded-xl p-3 space-y-1.5">
              <div class="flex justify-between"><b class="text-white">${app.esc(m.itemName)} (${m.qty} ${app.esc(m.unit)})</b><span class="text-amber-300 font-bold text-[10px]">${app.esc(m.status)}</span></div>
              <div class="text-[10px] text-slate-400">${app.esc(m.siteName)} • مطلوب ليوم: ${app.esc(m.neededDate || '')}</div>
              <div class="flex gap-1.5">
                ${this.isManager() && m.status === 'pending' ? `<button onclick="DamanCompany.updateMaterialReq('${m.id}','approved')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">اعتماد</button>` : ''}
                ${m.status === 'approved' ? `<button onclick="DamanCompany.updateMaterialReq('${m.id}','delivered')" class="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">✅ تم الاستلام (إضافة للمخزن)</button>` : ''}
              </div>
            </div>`).join('')}`;
      } else {
        const list = this.getOps('equipment');
        content = `
          <div class="flex justify-between items-center"><span class="font-black text-purple-300">حصر المعدات والإيجارات</span><button onclick="DamanCompany.printEquipmentA4()" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">كشف A4</button></div>
          <form onsubmit="DamanCompany.submitEquipment(event)" class="glass-card rounded-2xl p-3 space-y-2">
            ${this.renderSitePickerField('eq-site-sel', 'eq-site-txt')}
            <div class="grid grid-cols-2 gap-2">
              <input id="eq-name" type="text" required placeholder="المعدة (لودر / حفار / هزاز / ونش)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="eq-supp" type="text" placeholder="المورّد / المالك" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="eq-rate" type="number" step="any" min="1" required placeholder="سعر اليوم/الساعة (ج.م)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="eq-days" type="number" step="0.5" min="0.5" value="1" required placeholder="عدد الأيام/الساعات" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">تسجيل المعدة</button>
          </form>
          ${list.map((e) => `<div class="glass-card rounded-xl p-2.5 flex justify-between"><div><b class="text-white">${app.esc(e.eqName)}</b> <span class="text-[10px] text-slate-400">(${app.esc(e.supplier || '')} • ${app.esc(e.siteName)})</span></div><b class="text-amber-300">${app.fmtMoney(e.totalCost)} ج.م</b></div>`).join('')}`;
      }

      return `
        <div class="space-y-3 text-xs">
          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-extrabold">
            ${pills.map(([k, lbl]) => `<button onclick="DamanCompany.setOpsSubTab('${k}')" class="py-1.5 rounded-lg ${st === k ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${lbl}</button>`).join('')}
          </div>
          ${content}
        </div>`;
    },

    renderProgressTab(app) {
      const units = this.getOps('unit');
      const snags = this.getOps('snag');
      return `
        <div class="space-y-3.5 text-xs">
          <div class="flex justify-between items-center"><span class="font-black text-emerald-400">📊 نسب إنجاز الوحدات وملاحظات الاستشاري</span><button onclick="DamanCompany.printProgressAndSnagsA4()" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">تقرير A4</button></div>

          <form onsubmit="DamanCompany.submitUnitProgress(event)" class="glass-card rounded-2xl p-3 space-y-2 border-emerald-500/40">
            <div class="font-black text-emerald-300">تحديث موقف وحدة / فيلا</div>
            ${this.renderSitePickerField('un-site-sel', 'un-site-txt')}
            <div class="grid grid-cols-3 gap-1.5">
              <input id="un-code" type="text" required placeholder="فيلا 14 / عمارة 3" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <select id="un-stage" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="حفر وأساسات">حفر وأساسات</option><option value="أعمدة وشدات">أعمدة وشدات</option><option value="أسقف وصب">أسقف وصب</option><option value="مباني">مباني</option><option value="محارة">محارة</option><option value="تشطيبات">تشطيبات</option></select>
              <input id="un-pct" type="number" min="0" max="100" value="50" required placeholder="%" class="px-2 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-black text-center" />
            </div>
            <input id="un-note" type="text" placeholder="ملاحظة تنفيذية..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">حفظ الموقف</button>
          </form>

          ${units.map((u) => `
            <div class="glass-card rounded-xl p-2.5 space-y-1">
              <div class="flex justify-between items-center"><b class="text-white">${app.esc(u.unitCode)} — ${app.esc(u.stage)}</b><button onclick="DamanCompany.updateUnitPct('${u.id}',${u.pct})" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black">${u.pct}% ✎</button></div>
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-emerald-500" style="width:${u.pct}%"></div></div>
            </div>`).join('')}

          <form onsubmit="DamanCompany.submitSnagItem(event)" class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/40">
            <div class="font-black text-rose-300">🔍 تسجيل ملاحظة استشاري (قبل / بعد التلافي)</div>
            ${this.renderSitePickerField('sn-site-sel', 'sn-site-txt')}
            <div class="grid grid-cols-2 gap-2">
              <input id="sn-unit" type="text" placeholder="رقم الفيلا / العنصر" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="sn-assignee" type="text" placeholder="المقاول / المشرف المسؤول" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <input id="sn-desc" type="text" required placeholder="وصف الملاحظة الفنية..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <label class="block p-2 rounded-xl border border-dashed border-rose-500/40 bg-slate-950 text-center cursor-pointer"><span class="text-rose-300 font-bold">📷 صورة الملاحظة «قبل التلافي»</span><input type="file" accept="image/*" class="hidden" onchange="DamanCompany.handleSnagBeforePhoto(this)" /><div id="snag-bef-prev"></div></label>
            <button type="submit" class="w-full py-2 rounded-xl bg-rose-500 text-white font-black">حفظ الملاحظة</button>
          </form>

          ${snags.map((s) => `
            <div class="glass-card rounded-xl p-3 space-y-1.5">
              <div class="flex justify-between"><b class="text-white">${app.esc(s.unitCode || s.siteName)}: ${app.esc(s.description)}</b><span class="text-[10px] font-black ${s.status === 'approved' ? 'text-emerald-400' : 'text-amber-300'}">${app.esc(s.status)}</span></div>
              <div class="flex flex-wrap gap-1.5">
                ${s.beforeMedia ? `<button onclick="DamanApp.openMediaLightbox('${s.beforeMedia}','قبل التلافي')" class="px-2 py-1 rounded bg-slate-800 text-rose-300 text-[10px]">صورة قبل</button>` : ''}
                ${s.afterMedia ? `<button onclick="DamanApp.openMediaLightbox('${s.afterMedia}','بعد التلافي')" class="px-2 py-1 rounded bg-slate-800 text-emerald-300 text-[10px]">صورة بعد</button>` : ''}
                ${s.status === 'open' ? `<label class="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-black text-[10px] cursor-pointer">رفع صورة بعد التلافي<input type="file" accept="image/*" class="hidden" onchange="DamanCompany.uploadSnagAfterPhoto(this,'${s.id}')" /></label>` : ''}
                ${this.isManager() && s.status === 'fixed' ? `<button onclick="DamanCompany.approveSnag('${s.id}')" class="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد الإغلاق ✅</button>` : ''}
              </div>
            </div>`).join('')}
        </div>`;
    },

    renderCustodyTab(app) {
      const isMgr = this.isManager();
      const list = this.filterBySite(this.custodies);
      const holders = {};
      list.filter((c) => c.status !== 'rejected').forEach((c) => {
        const k = c.holderName || 'غير مسمى';
        holders[k] = (holders[k] || 0) + (c.kind === 'issue' ? Number(c.amount || 0) : -Number(c.amount || 0));
      });
      return `
        <div class="space-y-3 text-xs">
          <div class="flex items-center justify-between"><span class="font-black text-amber-400">🧾 العهدة وتصفية الفواتير</span><button onclick="DamanCompany.printCustodyA4()" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10.5px]">تصفية عهدة A4</button></div>
          ${Object.keys(holders).length ? `<div class="flex flex-wrap gap-1.5">${Object.entries(holders).map(([n, bal]) => `<span class="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-[10.5px]">${app.esc(n)}: <b class="${bal >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${app.fmtMoney(Math.round(bal * 100) / 100)} ج.م</b></span>`).join('')}</div>` : ''}
          <form onsubmit="DamanCompany.submitCustodyRecord(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            ${this.renderSitePickerField('cu-site-sel', 'cu-site-txt')}
            <div class="grid grid-cols-2 gap-2">
              <select id="cu-kind" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold"><option value="expense">مصروف من العهدة بفاتورة (-)</option>${isMgr ? '<option value="issue">صرف عهدة جديدة (+)</option>' : ''}</select>
              <input id="cu-amt" type="number" min="1" step="any" required placeholder="المبلغ (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
            </div>
            <input id="cu-holder" type="text" required value="${app.esc(app.profile?.name || '')}" placeholder="اسم حامل العهدة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <input id="cu-note" type="text" required placeholder="البيان (سلك رباط / مسامير / مشال / خامات)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <label class="block p-2 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer"><span class="font-bold text-amber-300">📷 صورة الفاتورة (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanCompany.handleCustodyPhoto(this)" /><div id="cu-photo-prev"></div></label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ حركة العهدة</button>
          </form>
          ${list.map((c) => `
            <div class="glass-card rounded-2xl p-3 space-y-1">
              <div class="flex justify-between"><span class="font-black ${c.kind === 'issue' ? 'text-emerald-400' : 'text-amber-300'}">${c.kind === 'issue' ? '+ صرف عهدة' : '- مصروف عهدة'}: ${app.fmtMoney(c.amount)} ج.م</span><span class="text-[10px] text-slate-300 font-bold">${app.esc(c.status)}</span></div>
              <div class="text-[10.5px] text-slate-400">${app.esc(c.holderName)} • ${app.esc(c.siteName || '')} • ${app.esc(c.date)}</div>
              <div class="text-[11px] text-white">${app.esc(c.note)}</div>
              <div class="flex gap-2 pt-0.5">${c.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${c.photoMedia}','فاتورة عهدة')" class="text-[10px] text-sky-300 underline font-bold">عرض الفاتورة</button>` : ''}${isMgr && c.status === 'pending' ? `<button onclick="DamanCompany.approveCustody('${c.id}','approved')" class="px-2.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد</button><button onclick="DamanCompany.approveCustody('${c.id}','rejected')" class="px-2.5 py-0.5 rounded bg-rose-500 text-white font-black text-[10px]">رفض</button>` : ''}</div>
            </div>`).join('')}
        </div>`;
    },

    renderPayrollTab(app) {
      const isMgr = this.isManager();
      const advs = this.ops.filter((x) => x.opType === 'advance');
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanCompany.submitAdvanceRequest(event)" class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-300">💵 تقديم طلب سلفة (تُخصم تلقائياً من الراتب عند الاعتماد)</div>
            <div class="grid grid-cols-2 gap-2">
              <input id="adv-amt" type="number" min="50" step="any" required placeholder="مبلغ السلفة (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-black" />
              <input id="adv-reason" type="text" required placeholder="السبب" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black">إرسال طلب السلفة</button>
          </form>

          ${advs.filter((a) => a.status === 'pending').map((a) => `
            <div class="glass-card rounded-xl p-2.5 border-amber-500/40 flex justify-between items-center gap-2">
              <div><b class="text-white">سلفة: ${app.esc(a.userName)} — ${app.fmtMoney(a.amount)} ج.م</b><div class="text-[10px] text-slate-400">${app.esc(a.reason)}</div></div>
              ${isMgr ? `<div class="flex gap-1"><button onclick="DamanCompany.respondAdvance('${a.id}',true)" class="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد</button><button onclick="DamanCompany.respondAdvance('${a.id}',false)" class="px-2.5 py-1 rounded bg-rose-500 text-white font-black text-[10px]">رفض</button></div>` : '<span class="text-[10px] text-amber-300">معلّق</span>'}
            </div>`).join('')}

          ${isMgr ? `
            <div class="flex items-center justify-between pt-1"><span class="font-black text-amber-400">شيت الرواتب والصرف</span><button onclick="DamanCompany.printPayrollSheetA4()" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10.5px]">شيت الرواتب A4</button></div>
            ${this.members.filter((m) => m.status === 'active').map((m) => {
              const c = this.calcMemberNetSalary(m);
              return `
                <div class="glass-card rounded-2xl p-3 space-y-2">
                  <div class="flex justify-between"><b class="text-white">${app.esc(m.name)}</b><b class="text-emerald-400">الصافي: ${app.fmtMoney(c.net)} ج.م</b></div>
                  <div class="text-[10px] text-slate-400">أساسي ${app.fmtMoney(c.base)} | بدلات ${app.fmtMoney(c.allow)} | إضافي ${app.fmtMoney(c.ot)} | غياب ${c.absentDays}ي (-${app.fmtMoney(c.absentCut)}) | سُلف -${app.fmtMoney(c.adv)} | خصم -${app.fmtMoney(c.ded)}</div>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button onclick="DamanCompany.openEditMemberModal('${m.id}')" class="py-1.5 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">تعديل البنود</button>
                    <button onclick="DamanCompany.payMemberSalary('${m.id}','wallet')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">صرف بالمحفظة</button>
                    <button onclick="DamanCompany.payMemberSalary('${m.id}','cash')" class="py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">تسجيل نقداً</button>
                  </div>
                </div>`;
            }).join('')}` : ''}

          <div class="font-black text-slate-300 pt-1">قسائم الرواتب المصروفة (${this.payrollLogs.length})</div>
          ${this.payrollLogs.map((p) => `<div class="glass-card rounded-xl p-2.5 flex justify-between items-center"><div><b class="text-white">${app.esc(p.employeeName)} (${app.esc(p.month)})</b><div class="text-[10px] text-slate-400">${p.method === 'wallet' ? 'محفظة' : 'نقداً'} • ${app.esc(p.date)}</div></div><div class="flex items-center gap-2"><b class="text-emerald-400">${app.fmtMoney(p.net)} ج.م</b><button onclick="DamanCompany.printPayslipA4('${p.id}')" class="px-2 py-1 rounded bg-white text-slate-950 font-black text-[10px]">قسيمة A4</button></div></div>`).join('')}
        </div>`;
    },

    renderReportsTab(app) {
      const list = this.filterBySite(this.dailyReports);
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanCompany.submitDailyReport(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <h4 class="font-black text-sky-400">📝 إعداد التقرير اليومي للموقع (A4 PDF)</h4>
            ${this.renderSitePickerField('dr-site-sel', 'dr-site-txt')}
            <input id="dr-workforce" type="text" placeholder="بيان العمالة (مثال: 6 نجارين، 4 حدادين، 2 عمال)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="dr-work" rows="3" required placeholder="الأعمال المنفذة اليوم بالتفصيل..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <textarea id="dr-mat" rows="2" placeholder="الخامات الواردة والمستهلكة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <input id="dr-obs" type="text" placeholder="معوقات أو ملاحظات فنية / سلامة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <input id="dr-plan" type="text" placeholder="خطة العمل للغد..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <label class="block p-2 rounded-xl border border-dashed border-sky-500/40 bg-slate-950 text-center cursor-pointer"><span class="text-sky-300 font-bold">📷 صورة من تقدم الأعمال اليوم (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanCompany.handleReportPhoto(this)" /><div id="dr-photo-prev"></div></label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ التقرير اليومي</button>
          </form>
          ${list.map((r) => `
            <div class="glass-card rounded-2xl p-3 space-y-1.5">
              <div class="flex justify-between gap-2"><div><b class="text-white">${app.esc(r.siteName)} — ${app.esc(r.date)}</b><div class="text-[10px] text-slate-400">إعداد: ${app.esc(r.authorName)}</div></div><div class="flex gap-1 shrink-0">${r.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.photoMedia}','صورة التقرير')" class="px-2 py-1 rounded-lg bg-slate-800 text-sky-300 text-[10px]">صورة</button>` : ''}<button onclick="DamanCompany.printDailyReportA4('${r.id}')" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">طباعة A4</button></div></div>
              <p class="text-[11px] text-slate-300 line-clamp-2">${app.esc(r.workDone)}</p>
            </div>`).join('')}
        </div>`;
    },

    renderPnLAndTasksTab(app) {
      const pnl = this.calcSitePnL();
      const tasks = this.getOps('task');
      return `
        <div class="space-y-3.5 text-xs">
          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-emerald-500/40">
            <div class="flex justify-between items-center"><span class="font-black text-emerald-400">📈 ميزانية وتكاليف: ${app.esc(pnl.siteLabel)}</span><button onclick="DamanCompany.printSitePnLA4()" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">تقرير A4</button></div>
            <div class="grid grid-cols-2 gap-2 text-center">
              <div class="p-2 rounded-xl bg-slate-950 border border-slate-800"><div class="text-[10px] text-slate-400">ميزانية الموقع</div><div class="text-sm font-black text-sky-400">${app.fmtMoney(pnl.budget)} ج.م</div></div>
              <div class="p-2 rounded-xl bg-slate-950 border border-slate-800"><div class="text-[10px] text-slate-400">إجمالي المصروف الفعلي</div><div class="text-sm font-black text-amber-400">${app.fmtMoney(pnl.totalSpent)} ج.م</div></div>
            </div>
            <div class="text-[10.5px] text-slate-300">العهدة: ${app.fmtMoney(pnl.custodySpent)} | مقاولين: ${app.fmtMoney(pnl.subPayments)} | معدات: ${app.fmtMoney(pnl.equipCosts)} | إضافي: ${app.fmtMoney(pnl.overtimeApproved)} | رواتب: ${app.fmtMoney(pnl.payrollTotal)}</div>
            <div class="p-2 rounded-xl bg-slate-950 text-center font-black ${pnl.variance >= 0 ? 'text-emerald-400' : 'text-rose-400'}">صافي المتبقي / الوفر: ${app.fmtMoney(pnl.variance)} ج.م</div>
          </div>

          <form onsubmit="DamanCompany.submitTask(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-purple-500/40">
            <div class="font-black text-purple-300">✅ توزيع المهام اليومية على الفريق</div>
            ${this.renderSitePickerField('tk-site-sel', 'tk-site-txt')}
            <input id="ctk-title" type="text" required placeholder="وصف المهمة المطلوبة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="ctk-assignee" type="text" required placeholder="المسؤول عن التنفيذ" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="ctk-due" type="date" value="${app.todayLocal()}" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">إسناد المهمة</button>
          </form>

          ${tasks.map((t) => `
            <div class="glass-card rounded-xl p-3 space-y-1.5">
              <div class="flex justify-between"><b class="text-white">${app.esc(t.title)}</b><span class="text-[10px] font-black ${t.status === 'done' ? 'text-emerald-400' : 'text-amber-300'}">${t.status === 'done' ? 'مكتملة ✅' : 'جارية ⏳'}</span></div>
              <div class="text-[10px] text-slate-400">${app.esc(t.siteName)} • المسؤول: ${app.esc(t.assigneeName)} • تسليم: ${app.esc(t.dueDate)}</div>
              <div class="flex gap-1.5">
                ${t.proofMedia ? `<button onclick="DamanApp.openMediaLightbox('${t.proofMedia}','إثبات التنفيذ')" class="px-2 py-1 rounded bg-slate-800 text-emerald-300 text-[10px]">صورة التنفيذ</button>` : ''}
                ${t.status !== 'done' ? `<label class="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-black text-[10px] cursor-pointer">إغلاق بصورة إثبات<input type="file" accept="image/*" class="hidden" onchange="DamanCompany.completeTaskWithPhoto(this,'${t.id}')" /></label>` : ''}
              </div>
            </div>`).join('')}
        </div>`;
    },

    renderTeamTab(app) {
      const isMgr = this.isManager();
      return `
        <div class="space-y-2.5 text-xs">
          ${this.members.map((m) => {
            const c = this.calcMemberNetSalary(m);
            return `
              <div class="glass-card rounded-2xl p-3 space-y-1.5 ${m.status !== 'active' ? 'border-rose-500/40 opacity-75' : ''}">
                <div class="flex justify-between gap-2">
                  <div>
                    <div class="font-black text-white">${app.esc(m.name)} <span class="text-[10px] text-sky-300">(${this.roleLabel(m.role)})</span></div>
                    <div class="text-[10px] text-amber-300">${app.esc(m.jobTitle || '')} • ${app.esc(m.phone || '')} ${m.status !== 'active' ? `• [${m.status}]` : ''}</div>
                  </div>
                  <div class="text-end"><div class="font-black text-emerald-400">${app.fmtMoney(c.net)} ج.م</div><div class="text-[9.5px] text-slate-400">صافي الراتب</div></div>
                </div>
                ${isMgr && m.status !== 'terminated' ? `
                  <div class="flex gap-1.5 pt-1">
                    <button onclick="DamanCompany.openEditMemberModal('${m.id}')" class="flex-1 py-1.5 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">راتب وصلاحية ومواقع</button>
                    ${m.role !== 'owner' ? `<button onclick="DamanCompany.toggleMemberStatus('${m.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">${m.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button><button onclick="DamanCompany.offboardMember('${m.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">فصل</button>` : ''}
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>`;
    },

    renderLeavesTab(app) {
      const isMgr = this.isManager();
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanCompany.submitLeaveRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <h4 class="font-black text-amber-400">تقديم طلب إجازة</h4>
            <div class="grid grid-cols-3 gap-2">
              <select id="lv-type" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"><option value="اعتيادية">اعتيادية</option><option value="عارضة">عارضة</option><option value="مرضية">مرضية</option></select>
              <input id="lv-from" type="date" required value="${app.todayLocal()}" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="lv-days" type="number" min="1" value="1" required class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>
            <input id="lv-reason" type="text" required placeholder="سبب الإجازة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black">إرسال الطلب</button>
          </form>
          ${this.leaves.map((l) => `<div class="glass-card rounded-2xl p-3 space-y-1"><div class="flex justify-between"><b class="text-white">${app.esc(l.userName)} (${app.esc(l.leaveType)} — ${l.days} يوم)</b><span class="text-[10px] text-amber-300 font-bold">${app.esc(l.status)}</span></div><div class="text-[10.5px] text-slate-300">من ${app.esc(l.fromDate)} • ${app.esc(l.reason)}</div>${isMgr && l.status === 'pending' ? `<div class="flex gap-1.5 pt-1"><button onclick="DamanCompany.respondLeave('${l.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة</button><button onclick="DamanCompany.respondLeave('${l.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button></div>` : ''}</div>`).join('')}
        </div>`;
    },

    renderGroupTab(app) {
      return `
        <div class="space-y-2.5 text-xs">
          <div class="glass-card rounded-2xl p-3 h-[300px] overflow-y-auto space-y-2">
            ${!this.groupMsgs.length ? `<div class="text-center text-slate-400 py-10">جروب الشركة الداخلي</div>` : this.groupMsgs.map((m) => `<div class="p-2.5 rounded-xl ${m.isPlatformAdmin ? 'bg-purple-900/70 border border-amber-400' : m.senderId === app.user?.uid ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-800 border border-slate-700'}"><div class="text-[10px] font-black ${m.isPlatformAdmin ? 'text-amber-300' : 'text-sky-300'}">${app.esc(m.senderName)} <span class="text-slate-500 font-normal">• ${app.esc(m.date || '')}</span></div><div class="text-white mt-0.5 whitespace-pre-line">${app.esc(m.text)}</div></div>`).join('')}
          </div>
          <form onsubmit="DamanCompany.sendGroupMessage(event)" class="flex gap-2">
            <input id="cg-input" type="text" required placeholder="اكتب تعليمات لفريق الشركة..." class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white" />
            <button type="submit" class="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    render(container, app) {
      this.ensureListeners(app);
      if (!app.user || !app.profile) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">سجّل الدخول لإدارة الشركات</button></div>`;
        return;
      }
      if (!app.profile.companyId || !this.company) {
        container.innerHTML = this.renderOnboarding(app);
        return;
      }
      if (this.company.status === 'suspended' && !app.isAdmin()) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center text-rose-300 text-xs font-bold">تم إيقاف مساحة هذه الشركة مؤقتاً من إدارة ضمان سايت.</div>`;
        return;
      }

      const tabs = [
        ['attendance', '📍 الحضور GPS'],
        ['overtime', '⏱️ الإضافي'],
        ['subcontractors', '🤝 المقاولين'],
        ['ops', '📦 مخزن وصب ومعدات'],
        ['progress', '📊 الإنجاز والتلافي'],
        ['custody', '🧾 العهدة'],
        ['payroll', '💰 الرواتب والسُلف'],
        ['reports', '📝 التقرير اليومي'],
        ['pnl', '📈 الميزانية والمهام'],
        ['team', `👥 الفريق (${this.members.length})`],
        ['leaves', '🏖️ الإجازات'],
        ['group', '💬 الجروب']
      ];

      let body = '';
      if (this.subTab === 'overtime') body = this.renderOvertimeTab(app);
      else if (this.subTab === 'subcontractors') body = this.renderSubcontractorsTab(app);
      else if (this.subTab === 'ops') body = this.renderOpsTab(app);
      else if (this.subTab === 'progress') body = this.renderProgressTab(app);
      else if (this.subTab === 'custody') body = this.renderCustodyTab(app);
      else if (this.subTab === 'payroll') body = this.renderPayrollTab(app);
      else if (this.subTab === 'reports') body = this.renderReportsTab(app);
      else if (this.subTab === 'pnl') body = this.renderPnLAndTasksTab(app);
      else if (this.subTab === 'team') body = this.renderTeamTab(app);
      else if (this.subTab === 'leaves') body = this.renderLeavesTab(app);
      else if (this.subTab === 'group') body = this.renderGroupTab(app);
      else body = this.renderAttendanceTab(app);

      const allowedSites = this.getAllowedSites();

      container.innerHTML = `
        <div class="space-y-3">
          <div class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-black text-white truncate"><i class="fa-solid fa-building text-sky-400 me-1"></i>${app.esc(this.company.name)}</div>
                <div class="text-[10px] text-amber-300 font-bold">كود الانضمام: <span class="select-all">${app.esc(this.company.code)}</span></div>
              </div>
              <button onclick="navigator.clipboard.writeText('${app.esc(this.company.code)}'); DamanApp.toast('تم نسخ كود الشركة ✅','success')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 text-amber-300 text-[10px] font-black shrink-0">نسخ الكود</button>
            </div>
            ${allowedSites.length ? `
              <select onchange="DamanCompany.setSelectedSite(this.value)" class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-sky-500/40 text-sky-300 text-[11px] font-black">
                <option value="all" ${this.selectedSiteId === 'all' ? 'selected' : ''}>🌐 فلتر الموقع: عرض كل المواقع (${allowedSites.length})</option>
                ${allowedSites.map((s) => `<option value="${s.id}" ${this.selectedSiteId === s.id ? 'selected' : ''}>📍 موقع: ${app.esc(s.name)}</option>`).join('')}
              </select>` : ''}
          </div>

          <div class="flex items-center gap-1 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
            ${tabs.map(([k, lbl]) => `
              <button onclick="DamanCompany.setSubTab('${k}')" class="shrink-0 px-3 py-2 rounded-xl ${this.subTab === k ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
          </div>

          ${body}
        </div>`;
    }
  };

  window.DamanCompany = CompanyMod;
  if (window.DamanApp) window.DamanApp.registerModule('company', CompanyMod);
})();
