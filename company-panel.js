(function () {
  const CompanyMod = {
    subTab: 'attendance', // 'attendance' | 'team' | 'payroll' | 'custody' | 'reports' | 'leaves' | 'group'
    company: null,
    members: [],
    sites: [],
    attendance: [],
    payrollLogs: [],
    custodies: [],
    dailyReports: [],
    leaves: [],
    groupMsgs: [],

    attachedUid: null,
    attachedCompId: null,
    unsubs: [],

    tempSelfieBase64: '',
    tempCustodyPhoto: '',

    // ==================== LIFECYCLE & LISTENERS (NO COMPOSITE INDEX ERRORS) ====================
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
      const sortByTime = (arr) => arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      pushUnsub(
        db.collection('companies').doc(compId).onSnapshot((snap) => {
          this.company = snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
          this.sites = Array.isArray(this.company?.sites) ? this.company.sites : [];
          if (app.activeTab === 'company') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyMembers').where('companyId', '==', compId).limit(120).onSnapshot((snap) => {
          this.members = sortByTime(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyAttendance').where('companyId', '==', compId).limit(150).onSnapshot((snap) => {
          this.attendance = sortByTime(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && this.subTab === 'attendance') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyPayroll').where('companyId', '==', compId).limit(100).onSnapshot((snap) => {
          this.payrollLogs = sortByTime(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && this.subTab === 'payroll') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyCustody').where('companyId', '==', compId).limit(100).onSnapshot((snap) => {
          this.custodies = sortByTime(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && this.subTab === 'custody') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyDailyReports').where('companyId', '==', compId).limit(80).onSnapshot((snap) => {
          this.dailyReports = sortByTime(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
          if (app.activeTab === 'company' && this.subTab === 'reports') this.rerender();
        }, () => {})
      );

      pushUnsub(
        db.collection('companyLeaves').where('companyId', '==', compId).limit(80).onSnapshot((snap) => {
          this.leaves = sortByTime(snap.docs.map((d) => Object.assign({ id: d.id }, d.data())));
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
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'company') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) {
      this.subTab = t;
      this.rerender();
    },

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
            name,
            code: compCode,
            ownerId: app.user.uid,
            ownerName: app.profile?.legalName || app.profile?.name || '',
            commercialReg: cr || app.profile?.commercialReg || '',
            taxCard: tax || app.profile?.taxCard || '',
            sites: [],
            status: 'active',
            date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('companyMembers').doc(`${compRef.id}_${app.user.uid}`).set({
            companyId: compRef.id,
            userId: app.user.uid,
            name: app.profile?.name || '',
            legalName: app.profile?.legalName || app.profile?.name || '',
            phone: app.profile?.phone || '',
            jobTitle: 'المدير العام / المالك',
            role: 'owner',
            baseSalary: 0,
            allowances: 0,
            overtimeAmount: 0,
            advances: 0,
            deductions: 0,
            approvedAbsentDays: 0,
            status: 'active',
            joinedDate: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('users').doc(app.user.uid).update({
            companyId: compRef.id,
            companyCode: compCode,
            companyName: name
          });
          app.toast(`تم إنشاء مساحة الشركة بنجاح! كود الشركة: ${compCode}`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async joinCompanyByCode(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      const code = document.getElementById('jc-code').value.trim().toUpperCase();
      const jobTitle = document.getElementById('jc-title').value.trim() || 'مهندس / مشرف موقع';
      if (!code) return;

      await app.withLock('joinComp', async () => {
        try {
          const snap = await app.db.collection('companies').where('code', '==', code).limit(1).get();
          if (snap.empty) return app.toast('كود الشركة غير صحيح — تأكد من الكود مع مدير الشركة', 'error');
          const compDoc = snap.docs[0];
          const comp = compDoc.data();

          await app.db.collection('companyMembers').doc(`${compDoc.id}_${app.user.uid}`).set({
            companyId: compDoc.id,
            userId: app.user.uid,
            name: app.profile?.name || '',
            legalName: app.profile?.legalName || app.profile?.name || '',
            phone: app.profile?.phone || '',
            jobTitle,
            role: 'employee',
            baseSalary: 0,
            allowances: 0,
            overtimeAmount: 0,
            advances: 0,
            deductions: 0,
            approvedAbsentDays: 0,
            status: 'active',
            joinedDate: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          await app.db.collection('users').doc(app.user.uid).update({
            companyId: compDoc.id,
            companyCode: comp.code,
            companyName: comp.name
          });

          await app.sendNotification(comp.ownerId, 'انضمام موظف جديد للشركة 👷', `انضم ${app.profile?.name} (${jobTitle}) باستخدام كود الشركة.`);
          app.toast(`تم الانضمام لشركة «${comp.name}» بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== FIXED SITES & GPS GEO-FENCING ====================
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
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-sky-400"><i class="fa-solid fa-map-location-dot me-1"></i> إضافة موقع ثابت بـ GPS</h3>
            <button onclick="document.getElementById('daman-comp-site-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanCompany.saveCompanySite(event)" class="space-y-2.5">
            <input id="cs-name" type="text" required placeholder="اسم الموقع (مثال: كمبوند سعادة - قطاع الفيلات)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div>
              <label class="block text-[10px] text-slate-400 mb-1">النطاق المسموح للحضور (بالمتر)</label>
              <input id="cs-rad" type="number" min="50" max="5000" value="250" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="cs-lat" type="number" step="any" placeholder="خط العرض Lat" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" />
              <input id="cs-lng" type="number" step="any" placeholder="خط الطول Lng" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" />
            </div>
            <button type="button" onclick="DamanCompany.captureSiteGps()" class="w-full py-2 rounded-xl bg-sky-500/20 border border-sky-500/50 text-sky-300 font-black">
              <i class="fa-solid fa-crosshairs me-1"></i> تثبيت إحداثيات موقعي الحالي (GPS)
            </button>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ الموقع في القائمة الثابتة</button>
          </form>
        </div>`;
    },

    captureSiteGps() {
      const app = window.DamanApp;
      if (!navigator.geolocation) return app.toast('جهازك لا يدعم GPS', 'error');
      app.toast('جارٍ التقاط الإحداثيات الدقيقة...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('cs-lat').value = pos.coords.latitude.toFixed(6);
          document.getElementById('cs-lng').value = pos.coords.longitude.toFixed(6);
          app.toast('تم التقاط إحداثيات الموقع بنجاح ✅', 'success');
        },
        () => app.toast('يرجى تفعيل صلاحية الموقع GPS', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },

    async saveCompanySite(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company) return;
      const name = document.getElementById('cs-name').value.trim();
      const radiusMeters = parseInt(document.getElementById('cs-rad').value, 10) || 250;
      const lat = parseFloat(document.getElementById('cs-lat').value) || null;
      const lng = parseFloat(document.getElementById('cs-lng').value) || null;
      if (!name) return;

      const newSite = { id: 'st_' + Date.now(), name, radiusMeters, lat, lng };
      const updated = this.sites.concat([newSite]);
      try {
        await app.db.collection('companies').doc(this.company.id).update({ sites: updated });
        document.getElementById('daman-comp-site-modal').classList.add('hidden');
        app.toast(`تم تثبيت الموقع «${name}» بنجاح ✅`, 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async removeCompanySite(siteId) {
      if (!this.isManager() || !this.company) return;
      if (!window.confirm('حذف هذا الموقع من قائمة مواقع الشركة؟')) return;
      const updated = this.sites.filter((s) => s.id !== siteId);
      try {
        await window.DamanApp.db.collection('companies').doc(this.company.id).update({ sites: updated });
        window.DamanApp.toast('تم حذف الموقع', 'info');
      } catch (e) {}
    },

    // ==================== ATTENDANCE (SELFIE + GEO-FENCING + PREVENT CHECK-OUT BEFORE CHECK-IN) ====================
    async handleAttendanceSelfie(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this.tempSelfieBase64 = await window.DamanApp.compressImage(f, 520, 0.55);
        const p = document.getElementById('att-selfie-prev');
        if (p) p.innerHTML = `<img src="${this.tempSelfieBase64}" class="max-h-20 mx-auto rounded-lg mt-1.5 border border-emerald-500/40" />`;
      } catch (e) {}
    },

    async recordAttendance(kind) {
      const app = window.DamanApp;
      if (!this.company || !app.user) return;
      const me = this.getMyMember();
      if (me && me.status === 'suspended') return app.toast('حسابك موقوف مؤقتاً من إدارة الشركة', 'error');

      const today = app.todayLocal();
      const myTodayLogs = this.attendance.filter((a) => a.userId === app.user.uid && a.date === today);
      const hasCheckInToday = myTodayLogs.some((a) => a.kind === 'in');
      const hasCheckOutToday = myTodayLogs.some((a) => a.kind === 'out');

      if (kind === 'in' && hasCheckInToday) {
        return app.toast('لقد سجّلت حضورك اليوم بالفعل ✅', 'warning');
      }
      if (kind === 'out' && !hasCheckInToday) {
        return app.toast('⚠️ لا يمكن تسجيل الانصراف قبل تسجيل الحضور أولاً في نفس اليوم!', 'error');
      }
      if (kind === 'out' && hasCheckOutToday) {
        return app.toast('لقد سجّلت انصرافك اليوم بالفعل', 'warning');
      }
      if (!this.tempSelfieBase64) {
        return app.toast('يرجى التقاط صورة سيلفي مباشرة من الموقع أولاً', 'warning');
      }

      const siteSel = document.getElementById('att-site-select');
      const customInp = document.getElementById('att-site-custom');
      const chosenSiteId = siteSel ? siteSel.value : '';
      const siteObj = this.sites.find((s) => s.id === chosenSiteId) || null;
      const siteName = siteObj ? siteObj.name : (customInp?.value || '').trim();
      if (!siteName) return app.toast('اختر الموقع أو اكتب اسمه أولاً', 'warning');

      await app.withLock('att_' + kind, async () => {
        app.toast('جارٍ التحقق من موقع الـ GPS وحفظ التسجيل...', 'info');
        const getCoords = () =>
          new Promise((resolve) => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => resolve(null),
              { enableHighAccuracy: true, timeout: 10000 }
            );
          });

        const coords = await getCoords();
        let distanceMeters = null;
        let geoStatus = 'no_pin'; // 'inside' | 'outside' | 'no_pin' | 'no_gps'
        if (!coords) {
          geoStatus = 'no_gps';
        } else if (siteObj && siteObj.lat != null && siteObj.lng != null) {
          distanceMeters = this.haversineMeters(coords.lat, coords.lng, Number(siteObj.lat), Number(siteObj.lng));
          const rad = Number(siteObj.radiusMeters || 250);
          geoStatus = distanceMeters <= rad ? 'inside' : 'outside';
        }

        try {
          const selfieMedia = await app.saveMedia(this.tempSelfieBase64, { kind: 'hr_selfie' });
          const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
          await app.db.collection('companyAttendance').add({
            companyId: this.company.id,
            userId: app.user.uid,
            userName: app.profile?.name || '',
            jobTitle: me?.jobTitle || '',
            kind,
            date: today,
            time: timeStr,
            siteId: siteObj?.id || '',
            siteName,
            coords,
            distanceMeters,
            geoStatus,
            selfieMedia,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          this.tempSelfieBase64 = '';
          const msg = geoStatus === 'outside'
            ? `تم التسجيل — ⚠️ ملاحظة: موقعك يبعد ${distanceMeters >= 1000 ? (distanceMeters / 1000).toFixed(1) + ' كم' : distanceMeters + ' متر'} عن نطاق الموقع`
            : `تم تسجيل ${kind === 'in' ? 'الحضور' : 'الانصراف'} بنجاح ✅`;
          app.toast(msg, geoStatus === 'outside' ? 'warning' : 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== TEAM & PAYROLL (FAIR ABSENCE FORMULA + WALLET/CASH + A4 PRINT) ====================
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
            <h3 class="text-sm font-black text-amber-400">تعديل بيانات وراتب: ${app.esc(m.name)}</h3>
            <button onclick="document.getElementById('daman-comp-mem-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanCompany.saveMemberChanges(event,'${m.id}')" class="space-y-2.5">
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-slate-400 mb-1">المسمى الوظيفي</label><input id="em-title" type="text" value="${app.esc(m.jobTitle || '')}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-1">الصلاحية</label>
                <select id="em-role" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="employee" ${m.role === 'employee' ? 'selected' : ''}>موظف / مشرف</option>
                  <option value="hr" ${m.role === 'hr' ? 'selected' : ''}>محاسب / HR</option>
                  <option value="manager" ${m.role === 'manager' ? 'selected' : ''}>مدير مشاريع</option>
                  ${m.role === 'owner' ? '<option value="owner" selected>مالك الشركة</option>' : ''}
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">الراتب الأساسي (ج.م)</label><input id="em-base" type="number" min="0" step="any" value="${Number(m.baseSalary || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" /></div>
              <div><label class="block text-[10px] text-sky-300 font-bold mb-1">بدلات (انتقال/موقع)</label><input id="em-allow" type="number" min="0" step="any" value="${Number(m.allowances || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">إضافي / مكافآت (+)</label><input id="em-ot" type="number" min="0" step="any" value="${Number(m.overtimeAmount || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-rose-300 font-bold mb-1">أيام غياب معتمدة (بدون الجمعة)</label><input id="em-abs" type="number" min="0" max="30" step="0.5" value="${Number(m.approvedAbsentDays || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-rose-300 font-bold mb-1">سُلف الشهر (-)</label><input id="em-adv" type="number" min="0" step="any" value="${Number(m.advances || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-rose-300 font-bold mb-1">خصومات / جزاءات (-)</label><input id="em-ded" type="number" min="0" step="any" value="${Number(m.deductions || 0)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ التعديلات</button>
          </form>
        </div>`;
    },

    async saveMemberChanges(e, memberId) {
      e.preventDefault();
      try {
        await window.DamanApp.db.collection('companyMembers').doc(memberId).update({
          jobTitle: document.getElementById('em-title').value.trim(),
          role: document.getElementById('em-role').value,
          baseSalary: parseFloat(document.getElementById('em-base').value) || 0,
          allowances: parseFloat(document.getElementById('em-allow').value) || 0,
          overtimeAmount: parseFloat(document.getElementById('em-ot').value) || 0,
          approvedAbsentDays: parseFloat(document.getElementById('em-abs').value) || 0,
          advances: parseFloat(document.getElementById('em-adv').value) || 0,
          deductions: parseFloat(document.getElementById('em-ded').value) || 0
        });
        document.getElementById('daman-comp-mem-modal').classList.add('hidden');
        window.DamanApp.toast('تم تحديث بيانات الموظف والراتب بنجاح ✅', 'success');
      } catch (err) { window.DamanApp.toast(err.message, 'error'); }
    },

    async toggleMemberStatus(memberId) {
      if (!this.isManager()) return;
      const m = this.members.find((x) => x.id === memberId);
      if (!m || m.role === 'owner') return;
      const next = m.status === 'suspended' ? 'active' : 'suspended';
      if (!window.confirm(next === 'suspended' ? `إيقاف الموظف ${m.name} مؤقتاً؟` : `إعادة تفعيل الموظف ${m.name}؟`)) return;
      try {
        await window.DamanApp.db.collection('companyMembers').doc(memberId).update({ status: next });
        window.DamanApp.toast(next === 'suspended' ? 'تم إيقاف الموظف' : 'تم إعادة تفعيل الموظف ✅', 'info');
      } catch (e) {}
    },

    async payMemberSalary(memberId, method) {
      const app = window.DamanApp;
      if (!this.isManager()) return;
      const m = this.members.find((x) => x.id === memberId);
      if (!m) return;
      const calc = this.calcMemberNetSalary(m);
      if (calc.net <= 0) return app.toast('صافي الراتب صفر — عدّل الراتب الأساسي أولاً', 'warning');

      const month = app.todayLocal().slice(0, 7);
      const lbl = method === 'wallet' ? 'عبر محفظة ضمان سايت' : 'نقداً (تسجيل فقط)';
      if (!window.confirm(`تأكيد صرف صافي راتب ${m.name} لشهر ${month} بمبلغ ${app.fmtMoney(calc.net)} ج.م (${lbl})؟\nسيتم تصفير سُلف وإضافي وغياب الشهر تلقائياً بعد الصرف.`)) return;

      await app.withLock('paySal_' + memberId, async () => {
        const payDocRef = app.db.collection('companyPayroll').doc();
        const memRef = app.db.collection('companyMembers').doc(memberId);

        try {
          if (method === 'wallet') {
            const payerRef = app.db.collection('users').doc(app.user.uid);
            const empRef = app.db.collection('users').doc(m.userId);
            await app.db.runTransaction(async (tx) => {
              const [pDoc, eDoc] = await Promise.all([tx.get(payerRef), tx.get(empRef)]);
              const curAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
              if (curAvail < calc.net) throw new Error('رصيدك المتاح في المحفظة لا يكفي لصرف الراتب');
              tx.update(payerRef, { balanceAvailable: Math.round((curAvail - calc.net) * 100) / 100 });
              tx.update(empRef, { balanceAvailable: Math.round((Number((eDoc.data() || {}).balanceAvailable || 0) + calc.net) * 100) / 100 });
              tx.set(app.db.collection('transactions').doc(), {
                userId: app.user.uid, type: 'salary_out', amount: -calc.net,
                note: `صرف راتب ${m.name} (${month})`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              tx.set(app.db.collection('transactions').doc(), {
                userId: m.userId, type: 'salary_in', amount: calc.net,
                note: `راتب شهر ${month} من ${this.company.name}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              tx.set(payDocRef, Object.assign({
                companyId: this.company.id, memberId, userId: m.userId,
                employeeName: m.legalName || m.name, jobTitle: m.jobTitle || '',
                month, method: 'wallet', date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              }, calc));
              tx.update(memRef, { overtimeAmount: 0, advances: 0, deductions: 0, approvedAbsentDays: 0 });
            });
          } else {
            await payDocRef.set(Object.assign({
              companyId: this.company.id, memberId, userId: m.userId,
              employeeName: m.legalName || m.name, jobTitle: m.jobTitle || '',
              month, method: 'cash', date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, calc));
            await memRef.update({ overtimeAmount: 0, advances: 0, deductions: 0, approvedAbsentDays: 0 });
          }

          await app.sendNotification(m.userId, `تم صرف راتب شهر ${month} 💰`, `صافي الراتب: ${app.fmtMoney(calc.net)} ج.م (${lbl})`);
          app.toast(`تم صرف راتب ${m.name} بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    printPayrollSheetA4() {
      const app = window.DamanApp;
      if (!this.company) return;
      let totalNet = 0;
      const rows = this.members.map((m, i) => {
        const c = this.calcMemberNetSalary(m);
        totalNet += c.net;
        return `
          <tr>
            <td>${i + 1}</td>
            <td><b>${app.esc(m.legalName || m.name)}</b><br/><span style="font-size:10px;">${app.esc(m.jobTitle || '')}</span></td>
            <td>${app.fmtMoney(c.base)}</td>
            <td>${app.fmtMoney(c.allow)}</td>
            <td>${app.fmtMoney(c.ot)}</td>
            <td>${c.absentDays} يوم (${app.fmtMoney(c.absentCut)})</td>
            <td>${app.fmtMoney(c.adv)}</td>
            <td>${app.fmtMoney(c.ded)}</td>
            <td><b>${app.fmtMoney(c.net)} ج.م</b></td>
            <td style="width:12%;"></td>
          </tr>`;
      }).join('');

      const html = `
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:16px;">كشف رواتب الموظفين — ${app.esc(this.company.name)}</h2>
              <div style="font-size:11px;">إدارة الموارد البشرية — ضمان سايت</div>
            </div>
            <div style="font-size:11px;"><b>الشهر:</b> ${app.todayLocal().slice(0, 7)}<br/><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>الاسم والوظيفة</th><th>الأساسي</th><th>بدلات</th><th>إضافي</th><th>غياب معتمد</th><th>سُلف</th><th>خصومات</th><th>الصافي</th><th>التوقيع</th></tr>
            </thead>
            <tbody>
              ${rows}
              <tr><th colspan="8" style="text-align:left;">إجمالي الرواتب المستحقة:</th><th colspan="2">${app.fmtMoney(totalNet)} ج.م</th></tr>
            </tbody>
          </table>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:22px; text-align:center; font-size:11px;">
            <div>إعداد الحسابات / HR<br/><br/>.....................................</div>
            <div>اعتماد المدير العام<br/><br/>.....................................</div>
          </div>
        </div>`;
      window.DamanPrint(html);
    },

    printPayslipA4(logId) {
      const app = window.DamanApp;
      const p = this.payrollLogs.find((x) => x.id === logId);
      if (!p || !this.company) return;
      const html = `
        <div style="border:2px solid #000; padding:16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div><h2 style="margin:0; font-size:16px;">قسيمة راتب رسمية (Payslip)</h2><div>${app.esc(this.company.name)}</div></div>
            <div style="font-size:11px;"><b>شهر:</b> ${app.esc(p.month)}<br/><b>تاريخ الصرف:</b> ${app.esc(p.date)}</div>
          </div>
          <table style="margin-bottom:12px;">
            <tr><th>اسم الموظف</th><td><b>${app.esc(p.employeeName)}</b></td><th>الوظيفة</th><td>${app.esc(p.jobTitle)}</td></tr>
            <tr><th>طريقة الصرف</th><td colspan="3">${p.method === 'wallet' ? 'تحويل عبر محفظة ضمان سايت' : 'صرف نقدي'}</td></tr>
          </table>
          <table>
            <tr><th>الراتب الأساسي</th><td>${app.fmtMoney(p.base)} ج.م</td><th>أيام الغياب المعتمدة (${p.absentDays || 0})</th><td>- ${app.fmtMoney(p.absentCut || 0)} ج.م</td></tr>
            <tr><th>البدلات</th><td>+ ${app.fmtMoney(p.allow)} ج.م</td><th>السُلف</th><td>- ${app.fmtMoney(p.adv)} ج.م</td></tr>
            <tr><th>الإضافي والمكافآت</th><td>+ ${app.fmtMoney(p.ot)} ج.م</td><th>الخصومات / الجزاءات</th><td>- ${app.fmtMoney(p.ded)} ج.م</td></tr>
            <tr><th colspan="2">صافي الراتب المصروف</th><th colspan="2" style="font-size:14px;">${app.fmtMoney(p.net)} ج.م</th></tr>
          </table>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:26px; text-align:center; font-size:11px;">
            <div>توقيع المستلم<br/><br/>.....................................</div>
            <div>اعتماد الإدارة<br/><br/>.....................................</div>
          </div>
        </div>`;
      window.DamanPrint(html);
    },

    // ==================== CUSTODY (عهدة / العهدة) ====================
    async handleCustodyPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this.tempCustodyPhoto = await window.DamanApp.compressImage(f, 760, 0.56);
        const p = document.getElementById('cu-photo-prev');
        if (p) p.innerHTML = `<img src="${this.tempCustodyPhoto}" class="max-h-20 mx-auto rounded mt-1" />`;
      } catch (e) {}
    },

    async submitCustodyRecord(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company || !app.user) return;
      const kind = document.getElementById('cu-kind').value; // 'issue' | 'expense'
      const holderName = document.getElementById('cu-holder').value.trim();
      const amount = Math.round((parseFloat(document.getElementById('cu-amt').value) || 0) * 100) / 100;
      const siteName = document.getElementById('cu-site').value.trim();
      const note = document.getElementById('cu-note').value.trim();
      if (!holderName || amount <= 0) return;

      await app.withLock('custodySave', async () => {
        try {
          const photoMedia = this.tempCustodyPhoto ? await app.saveMedia(this.tempCustodyPhoto, { kind: 'custody_inv' }) : '';
          await app.db.collection('companyCustody').add({
            companyId: this.company.id,
            userId: app.user.uid,
            kind,
            holderName,
            amount,
            siteName,
            note,
            photoMedia,
            status: this.isManager() ? 'approved' : 'pending',
            date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          this.tempCustodyPhoto = '';
          e.target.reset();
          app.toast('تم تسجيل حركة العهدة بنجاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async approveCustody(id, st) {
      if (!this.isManager()) return;
      try {
        await window.DamanApp.db.collection('companyCustody').doc(id).update({ status: st });
        window.DamanApp.toast(st === 'approved' ? 'تم اعتماد العهدة ✅' : 'تم رفض البند', 'info');
      } catch (e) {}
    },

    printCustodyA4() {
      const app = window.DamanApp;
      if (!this.company) return;
      let totalIssued = 0, totalSpent = 0;
      const rows = this.custodies.map((c, i) => {
        if (c.status !== 'rejected') {
          if (c.kind === 'issue') totalIssued += Number(c.amount || 0);
          else totalSpent += Number(c.amount || 0);
        }
        return `
          <tr>
            <td>${i + 1}</td>
            <td>${app.esc(c.date || '')}</td>
            <td>${app.esc(c.holderName)}</td>
            <td>${c.kind === 'issue' ? 'صرف عهدة (+)' : 'مصروف بفاتورة (-)'}</td>
            <td>${app.esc(c.siteName || '—')}</td>
            <td>${app.esc(c.note || '')}</td>
            <td><b>${app.fmtMoney(c.amount)} ج.م</b></td>
          </tr>`;
      }).join('');

      const remaining = Math.round((totalIssued - totalSpent) * 100) / 100;
      const html = `
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">تصفية كشف العهدة والمصروفات — ${app.esc(this.company.name)}</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table style="margin-bottom:10px;">
            <tr><th>إجمالي العهدة المنصرفة</th><td><b>${app.fmtMoney(totalIssued)} ج.م</b></td><th>إجمالي المصروفات بالفواتير</th><td><b>${app.fmtMoney(totalSpent)} ج.م</b></td><th>صافي المتبقي بالعهدة</th><td><b>${app.fmtMoney(remaining)} ج.م</b></td></tr>
          </table>
          <table>
            <thead><tr><th>#</th><th>التاريخ</th><th>حامل العهدة</th><th>النوع</th><th>الموقع</th><th>البيان</th><th>المبلغ</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;">لا توجد حركات عهدة</td></tr>'}</tbody>
          </table>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:22px; text-align:center; font-size:11px;">
            <div>توقيع حامل العهدة<br/><br/>.....................................</div>
            <div>اعتماد مدير الحسابات / الإدارة<br/><br/>.....................................</div>
          </div>
        </div>`;
      window.DamanPrint(html);
    },

    // ==================== DAILY SITE REPORT (A4 B&W PRINTABLE) ====================
    async submitDailyReport(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company || !app.user) return;
      const report = {
        companyId: this.company.id,
        authorUid: app.user.uid,
        authorName: app.profile?.legalName || app.profile?.name || '',
        date: app.todayLocal(),
        siteName: document.getElementById('dr-site').value.trim(),
        workforceSummary: document.getElementById('dr-workforce').value.trim(),
        workDone: document.getElementById('dr-work').value.trim(),
        materials: document.getElementById('dr-mat').value.trim(),
        obstacles: document.getElementById('dr-obs').value.trim(),
        tomorrowPlan: document.getElementById('dr-plan').value.trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!report.siteName || !report.workDone) return;
      try {
        await app.db.collection('companyDailyReports').add(report);
        e.target.reset();
        app.toast('تم حفظ التقرير اليومي للموقع بنجاح ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    printDailyReportA4(repId) {
      const app = window.DamanApp;
      const r = this.dailyReports.find((x) => x.id === repId);
      if (!r || !this.company) return;
      const html = `
        <div style="border:2px solid #000; padding:15px 18px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
            <div>
              <h2 style="margin:0; font-size:16px;">التقرير اليومي لأعمال الموقع</h2>
              <div style="font-size:12px;"><b>${app.esc(this.company.name)}</b></div>
            </div>
            <div style="font-size:11px; text-align:left;">
              <div><b>التاريخ:</b> ${app.esc(r.date)}</div>
              <div><b>إعداد:</b> ${app.esc(r.authorName)}</div>
            </div>
          </div>

          <table style="margin-bottom:12px;">
            <tr><th style="width:24%;">الموقع / المشروع</th><td><b>${app.esc(r.siteName)}</b></td></tr>
            <tr><th>بيان العمالة والحضور</th><td style="white-space:pre-line;">${app.esc(r.workforceSummary || '—')}</td></tr>
            <tr><th>الأعمال المنفذة اليوم</th><td style="white-space:pre-line; min-height:70px;">${app.esc(r.workDone)}</td></tr>
            <tr><th>الخامات والتوريدات والمعدات</th><td style="white-space:pre-line;">${app.esc(r.materials || '—')}</td></tr>
            <tr><th>المعوقات والملاحظات الفنية</th><td style="white-space:pre-line;">${app.esc(r.obstacles || 'لا توجد معوقات')}</td></tr>
            <tr><th>خطة العمل لليوم التالي</th><td style="white-space:pre-line;">${app.esc(r.tomorrowPlan || '—')}</td></tr>
          </table>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:26px; text-align:center; font-size:11px;">
            <div>مشرف التنفيذ<br/><br/>..........................</div>
            <div>مهندس التنفيذ<br/><br/>..........................</div>
            <div>مدير المشروع<br/><br/>..........................</div>
          </div>
        </div>`;
      window.DamanPrint(html);
    },

    // ==================== LEAVES & COMPANY GROUP CHAT ====================
    async submitLeaveRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.company || !app.user) return;
      try {
        await app.db.collection('companyLeaves').add({
          companyId: this.company.id,
          userId: app.user.uid,
          userName: app.profile?.name || '',
          leaveType: document.getElementById('lv-type').value,
          fromDate: document.getElementById('lv-from').value,
          days: parseInt(document.getElementById('lv-days').value, 10) || 1,
          reason: document.getElementById('lv-reason').value.trim(),
          status: 'pending',
          date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification(this.company.ownerId, 'طلب إجازة جديد', `${app.profile?.name} طلب إجازة.`);
        e.target.reset();
        app.toast('تم إرسال طلب الإجازة للمدير ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async respondLeave(id, st) {
      if (!this.isManager()) return;
      const lv = this.leaves.find((x) => x.id === id);
      try {
        await window.DamanApp.db.collection('companyLeaves').doc(id).update({ status: st });
        if (lv) await window.DamanApp.sendNotification(lv.userId, st === 'approved' ? 'تمت الموافقة على إجازتك ✅' : 'تم رفض طلب الإجازة', lv.reason || '');
        window.DamanApp.toast('تم التحديث', 'success');
      } catch (e) {}
    },

    async sendGroupMessage(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('cg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.company || !app.user) return;
      inp.value = '';
      try {
        await app.db.collection('companyMessages').add({
          companyId: this.company.id,
          senderId: app.user.uid,
          senderName: app.isAdmin() ? '👑 إدارة ضمان سايت' : (app.profile?.name || ''),
          isPlatformAdmin: app.isAdmin(),
          text,
          date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== RENDER SUB-TABS ====================
    renderOnboarding(app) {
      return `
        <div class="space-y-3.5 text-xs">
          <div class="glass-card rounded-3xl p-4 border-sky-500/40 space-y-2">
            <h2 class="text-sm font-black text-sky-400"><i class="fa-solid fa-building-user me-1"></i> منظومة إدارة شركات المقاولات والموظفين (HR)</h2>
            <p class="text-[11px] text-slate-300 leading-relaxed">سجّل حضور ومواقع فريقك بالسيلفي والـ GPS، احسب الرواتب والعهدة بدقة، واطبع التقارير اليومية وكشوف الرواتب A4.</p>
          </div>

          <form onsubmit="DamanCompany.createCompanyWorkspace(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-amber-500/40">
            <h3 class="font-black text-amber-400">1. إنشاء مساحة شركة جديدة (للملاك والشركات والموردين)</h3>
            <input id="nc-name" type="text" required value="${app.esc(app.profile?.companyName || '')}" placeholder="اسم الشركة / المكتب الهندسي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="nc-cr" type="text" value="${app.esc(app.profile?.commercialReg || '')}" placeholder="السجل التجاري (اختياري)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="nc-tax" type="text" value="${app.esc(app.profile?.taxCard || '')}" placeholder="البطاقة الضريبية (اختياري)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إنشاء الشركة وتوليد كود الانضمام</button>
          </form>

          <form onsubmit="DamanCompany.joinCompanyByCode(event)" class="glass-card rounded-2xl p-4 space-y-2.5 border-emerald-500/40">
            <h3 class="font-black text-emerald-400">2. الانضمام لشركة قائمة (للمشرفين والمهندسين والموظفين)</h3>
            <input id="jc-code" type="text" required placeholder="أدخل كود الشركة (مثال: CMP-123456)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white uppercase font-black" />
            <input id="jc-title" type="text" required placeholder="المسمى الوظيفي (مثال: مشرف تنفيذ / مهندس موقع)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">انضمام للشركة الآن</button>
          </form>
        </div>`;
    },

    renderAttendanceTab(app) {
      const isMgr = this.isManager();
      const siteOptions = this.sites.map((s) => `<option value="${s.id}">${app.esc(s.name)} (نطاق ${s.radiusMeters || 250}م)</option>`).join('');

      return `
        <div class="space-y-3 text-xs">
          ${isMgr ? `
            <div class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
              <div class="flex items-center justify-between">
                <span class="font-black text-sky-300"><i class="fa-solid fa-map-pin me-1"></i> مواقع الشركة الثابتة (${this.sites.length})</span>
                <button onclick="DamanCompany.openAddSiteModal()" class="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">+ تثبيت موقع GPS</button>
              </div>
              ${this.sites.length ? `<div class="flex flex-wrap gap-1.5">${this.sites.map((s) => `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-[10px]">
                  <b class="text-white">${app.esc(s.name)}</b> ${s.lat ? '📍' : ''}
                  <button onclick="DamanCompany.removeCompanySite('${s.id}')" class="text-rose-400">×</button>
                </span>`).join('')}</div>` : `<div class="text-[10px] text-slate-400">أضف مواقع شركتك بإحداثيات GPS لكشف الحضور خارج الموقع تلقائياً.</div>`}
            </div>` : ''}

          <!-- Check-In / Check-Out Panel -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-emerald-500/40">
            <div class="font-black text-emerald-400"><i class="fa-solid fa-fingerprint me-1"></i> تسجيل الحضور والانصراف اليومي (${app.todayLocal()})</div>
            ${this.sites.length
              ? `<select id="att-site-select" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">${siteOptions}</select>`
              : `<input id="att-site-custom" type="text" placeholder="اكتب اسم الموقع (مثال: كمبوند سعادة - فيلا 14)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />`}

            <label class="block p-2.5 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-black text-emerald-300"><i class="fa-solid fa-camera me-1"></i> التقاط سيلفي من الموقع *</span>
              <input type="file" accept="image/*" capture="user" class="hidden" onchange="DamanCompany.handleAttendanceSelfie(this)" />
              <div id="att-selfie-prev"></div>
            </label>

            <div class="grid grid-cols-2 gap-2">
              <button onclick="DamanCompany.recordAttendance('in')" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">🟢 تسجيل حضور</button>
              <button onclick="DamanCompany.recordAttendance('out')" class="py-2.5 rounded-xl bg-rose-500 text-white font-black">🔴 تسجيل انصراف</button>
            </div>
          </div>

          <!-- Attendance Logs -->
          <div class="space-y-2">
            ${!this.attendance.length
              ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد سجلات حضور بعد.</div>`
              : this.attendance.slice(0, 40).map((a) => {
                  const geoBadge = a.geoStatus === 'inside'
                    ? `<span class="text-emerald-400 font-black">✅ داخل النطاق (${a.distanceMeters}م)</span>`
                    : a.geoStatus === 'outside'
                    ? `<span class="text-rose-400 font-black">⚠️ خارج الموقع (${a.distanceMeters >= 1000 ? (a.distanceMeters / 1000).toFixed(1) + ' كم' : a.distanceMeters + 'م'})</span>`
                    : `<span class="text-slate-400">بدون نطاق GPS</span>`;
                  return `
                    <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
                      <div class="min-w-0 space-y-0.5">
                        <div class="font-black text-white">${a.kind === 'in' ? '🟢 حضور' : '🔴 انصراف'} — ${app.esc(a.userName)}</div>
                        <div class="text-[10px] text-slate-300">${app.esc(a.siteName)} • ${app.esc(a.date)} (${app.esc(a.time || '')})</div>
                        <div class="text-[10px]">${geoBadge}</div>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        ${a.coords ? `<a href="https://maps.google.com/?q=${a.coords.lat},${a.coords.lng}" target="_blank" class="px-2 py-1 rounded-lg bg-slate-800 text-sky-300 text-[10px] font-bold">GPS</a>` : ''}
                        ${a.selfieMedia ? `<button onclick="DamanApp.openMediaLightbox('${a.selfieMedia}','سيلفي ${app.esc(a.userName)}')" class="px-2 py-1 rounded-lg bg-slate-800 text-amber-300 text-[10px] font-bold">سيلفي</button>` : ''}
                      </div>
                    </div>`;
                }).join('')}
          </div>
        </div>`;
    },

    renderTeamTab(app) {
      const isMgr = this.isManager();
      return `
        <div class="space-y-2.5 text-xs">
          ${this.members.map((m) => {
            const c = this.calcMemberNetSalary(m);
            return `
              <div class="glass-card rounded-2xl p-3 space-y-1.5 ${m.status === 'suspended' ? 'border-rose-500/50 opacity-75' : ''}">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class="font-black text-white">${app.esc(m.name)} ${m.status === 'suspended' ? '<span class="text-rose-400">(موقوف)</span>' : ''}</div>
                    <div class="text-[10px] text-amber-300">${app.esc(m.jobTitle || '')} • ${app.esc(m.phone || '')}</div>
                  </div>
                  <div class="text-end">
                    <div class="font-black text-emerald-400">${app.fmtMoney(c.net)} ج.م</div>
                    <div class="text-[9.5px] text-slate-400">صافي الراتب</div>
                  </div>
                </div>
                ${isMgr ? `
                  <div class="flex gap-1.5 pt-1">
                    <button onclick="DamanCompany.openEditMemberModal('${m.id}')" class="flex-1 py-1.5 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10.5px]">تعديل الراتب والصلاحية</button>
                    ${m.role !== 'owner' ? `<button onclick="DamanCompany.toggleMemberStatus('${m.id}')" class="px-3 py-1.5 rounded-lg ${m.status === 'suspended' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} font-bold text-[10.5px]">${m.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button>` : ''}
                  </div>` : ''}
              </div>`;
          }).join('')}
        </div>`;
    },

    renderPayrollTab(app) {
      const isMgr = this.isManager();
      return `
        <div class="space-y-3 text-xs">
          ${isMgr ? `
            <div class="flex items-center justify-between">
              <span class="font-black text-amber-400">إدارة وصرف الرواتب (معادلة غياب معتمدة)</span>
              <button onclick="DamanCompany.printPayrollSheetA4()" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10.5px]"><i class="fa-solid fa-print me-1"></i> شيت الرواتب A4</button>
            </div>
            <div class="space-y-2">
              ${this.members.filter((m) => m.status !== 'suspended').map((m) => {
                const c = this.calcMemberNetSalary(m);
                return `
                  <div class="glass-card rounded-2xl p-3 space-y-2">
                    <div class="flex justify-between">
                      <b class="text-white">${app.esc(m.name)}</b>
                      <b class="text-emerald-400">الصافي: ${app.fmtMoney(c.net)} ج.م</b>
                    </div>
                    <div class="text-[10px] text-slate-400">أساسي ${app.fmtMoney(c.base)} | بدلات ${app.fmtMoney(c.allow)} | إضافي ${app.fmtMoney(c.ot)} | غياب معتمد ${c.absentDays} يوم (-${app.fmtMoney(c.absentCut)}) | سُلف -${app.fmtMoney(c.adv)} | خصم -${app.fmtMoney(c.ded)}</div>
                    <div class="grid grid-cols-3 gap-1.5">
                      <button onclick="DamanCompany.openEditMemberModal('${m.id}')" class="py-1.5 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">تعديل البنود</button>
                      <button onclick="DamanCompany.payMemberSalary('${m.id}','wallet')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">صرف بالمحفظة</button>
                      <button onclick="DamanCompany.payMemberSalary('${m.id}','cash')" class="py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">تسجيل نقداً</button>
                    </div>
                  </div>`;
              }).join('')}
            </div>` : ''}

          <div class="font-black text-slate-300 pt-1">سجل قسائم الرواتب المصروفة (${this.payrollLogs.length})</div>
          <div class="space-y-2">
            ${this.payrollLogs.map((p) => `
              <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
                <div>
                  <div class="font-black text-white">${app.esc(p.employeeName)} — شهر ${app.esc(p.month)}</div>
                  <div class="text-[10px] text-slate-400">${p.method === 'wallet' ? 'محفظة ضمان سايت' : 'نقداً'} • ${app.esc(p.date)}</div>
                </div>
                <div class="flex items-center gap-2">
                  <b class="text-emerald-400">${app.fmtMoney(p.net)} ج.م</b>
                  <button onclick="DamanCompany.printPayslipA4('${p.id}')" class="px-2.5 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]">قسيمة A4</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderCustodyTab(app) {
      const isMgr = this.isManager();
      return `
        <div class="space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-black text-amber-400"><i class="fa-solid fa-receipt me-1"></i> العهدة وتصفية فواتير المواقع</span>
            <button onclick="DamanCompany.printCustodyA4()" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10.5px]"><i class="fa-solid fa-print me-1"></i> تصفية عهدة A4</button>
          </div>

          <form onsubmit="DamanCompany.submitCustodyRecord(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <select id="cu-kind" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                <option value="expense">مصروف من العهدة بفاتورة (-)</option>
                ${isMgr ? '<option value="issue">صرف عهدة جديدة لموظف (+)</option>' : ''}
              </select>
              <input id="cu-amt" type="number" min="1" step="any" required placeholder="المبلغ (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="cu-holder" type="text" required value="${app.esc(app.profile?.name || '')}" placeholder="اسم حامل العهدة" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <input id="cu-site" type="text" placeholder="اسم الموقع" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <input id="cu-note" type="text" required placeholder="البيان (مثال: شراء سلك رباط / مسامير / نقل خامات)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <label class="block p-2 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-amber-300"><i class="fa-solid fa-camera me-1"></i> إرفاق صورة الفاتورة (اختياري)</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanCompany.handleCustodyPhoto(this)" />
              <div id="cu-photo-prev"></div>
            </label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">حفظ حركة العهدة</button>
          </form>

          <div class="space-y-2">
            ${this.custodies.map((c) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex justify-between">
                  <span class="font-black ${c.kind === 'issue' ? 'text-emerald-400' : 'text-amber-300'}">${c.kind === 'issue' ? '+ صرف عهدة' : '- مصروف عهدة'}: ${app.fmtMoney(c.amount)} ج.م</span>
                  <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold">${app.esc(c.status)}</span>
                </div>
                <div class="text-[10.5px] text-slate-300">${app.esc(c.holderName)} ${c.siteName ? '• ' + app.esc(c.siteName) : ''} • ${app.esc(c.date)}</div>
                <div class="text-[11px] text-white">${app.esc(c.note)}</div>
                <div class="flex items-center gap-2 pt-1">
                  ${c.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${c.photoMedia}','فاتورة عهدة')" class="text-[10px] text-sky-300 underline font-bold">عرض الفاتورة</button>` : ''}
                  ${isMgr && c.status === 'pending' ? `
                    <button onclick="DamanCompany.approveCustody('${c.id}','approved')" class="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">اعتماد</button>
                    <button onclick="DamanCompany.approveCustody('${c.id}','rejected')" class="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderReportsTab(app) {
      return `
        <div class="space-y-3 text-xs">
          <form onsubmit="DamanCompany.submitDailyReport(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <h4 class="font-black text-sky-400"><i class="fa-solid fa-file-lines me-1"></i> إعداد التقرير اليومي للموقع (A4 PDF)</h4>
            <input id="dr-site" type="text" required placeholder="اسم الموقع / رقم الفيلا" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <input id="dr-workforce" type="text" placeholder="بيان العمالة (مثال: 6 نجارين، 4 حدادين، 2 عمال)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="dr-work" rows="3" required placeholder="الأعمال المنفذة اليوم بالتفصيل..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <textarea id="dr-mat" rows="2" placeholder="الخامات الواردة والمستهلكة والمعدات..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <input id="dr-obs" type="text" placeholder="معوقات أو ملاحظات فنية / سلامة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <input id="dr-plan" type="text" placeholder="خطة العمل للغد..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ التقرير اليومي</button>
          </form>

          <div class="space-y-2">
            ${this.dailyReports.map((r) => `
              <div class="glass-card rounded-2xl p-3 space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <div class="font-black text-white">${app.esc(r.siteName)} — ${app.esc(r.date)}</div>
                    <div class="text-[10px] text-slate-400">إعداد: ${app.esc(r.authorName)}</div>
                  </div>
                  <button onclick="DamanCompany.printDailyReportA4('${r.id}')" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10px] shrink-0"><i class="fa-solid fa-print me-1"></i> طباعة A4</button>
                </div>
                <p class="text-[11px] text-slate-300 line-clamp-2">${app.esc(r.workDone)}</p>
              </div>`).join('')}
          </div>
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
              <input id="lv-days" type="number" min="1" value="1" required placeholder="أيام" class="px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>
            <input id="lv-reason" type="text" required placeholder="سبب الإجازة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black">إرسال الطلب</button>
          </form>

          ${this.leaves.map((l) => `
            <div class="glass-card rounded-2xl p-3 space-y-1">
              <div class="flex justify-between"><b class="text-white">${app.esc(l.userName)} (${app.esc(l.leaveType)} — ${l.days} يوم)</b><span class="text-[10px] text-amber-300 font-bold">${app.esc(l.status)}</span></div>
              <div class="text-[10.5px] text-slate-300">من ${app.esc(l.fromDate)} • ${app.esc(l.reason)}</div>
              ${isMgr && l.status === 'pending' ? `<div class="flex gap-1.5 pt-1"><button onclick="DamanCompany.respondLeave('${l.id}','approved')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة</button><button onclick="DamanCompany.respondLeave('${l.id}','rejected')" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button></div>` : ''}
            </div>`).join('')}
        </div>`;
    },

    renderGroupTab(app) {
      return `
        <div class="space-y-2.5 text-xs">
          <div class="glass-card rounded-2xl p-3 h-[300px] overflow-y-auto space-y-2">
            ${!this.groupMsgs.length
              ? `<div class="text-center text-slate-400 py-10">جروب الشركة الداخلي — ابدأ التنسيق مع فريقك</div>`
              : this.groupMsgs.map((m) => `
                <div class="p-2.5 rounded-xl ${m.isPlatformAdmin ? 'bg-purple-900/70 border border-amber-400 text-amber-100' : m.senderId === app.user?.uid ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-slate-800 border border-slate-700'}">
                  <div class="text-[10px] font-black ${m.isPlatformAdmin ? 'text-amber-300' : 'text-sky-300'}">${app.esc(m.senderName)} <span class="text-slate-500 font-normal">• ${app.esc(m.date || '')}</span></div>
                  <div class="text-white mt-0.5 whitespace-pre-line">${app.esc(m.text)}</div>
                </div>`).join('')}
          </div>
          <form onsubmit="DamanCompany.sendGroupMessage(event)" class="flex gap-2">
            <input id="cg-input" type="text" required placeholder="اكتب تعليمات أو رسالة لفريق الشركة..." class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white" />
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

      const tabs = [
        ['attendance', 'الحضور GPS'],
        ['team', `الفريق (${this.members.length})`],
        ['payroll', 'الرواتب'],
        ['custody', 'العهدة'],
        ['reports', 'التقرير اليومي'],
        ['leaves', 'الإجازات'],
        ['group', 'الجروب']
      ];

      let body = '';
      if (this.subTab === 'team') body = this.renderTeamTab(app);
      else if (this.subTab === 'payroll') body = this.renderPayrollTab(app);
      else if (this.subTab === 'custody') body = this.renderCustodyTab(app);
      else if (this.subTab === 'reports') body = this.renderReportsTab(app);
      else if (this.subTab === 'leaves') body = this.renderLeavesTab(app);
      else if (this.subTab === 'group') body = this.renderGroupTab(app);
      else body = this.renderAttendanceTab(app);

      container.innerHTML = `
        <div class="space-y-3">
          <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 border-sky-500/40">
            <div class="min-w-0">
              <div class="text-xs font-black text-white truncate"><i class="fa-solid fa-building text-sky-400 me-1"></i>${app.esc(this.company.name)}</div>
              <div class="text-[10px] text-amber-300 font-bold">كود الانضمام: <span class="select-all">${app.esc(this.company.code)}</span></div>
            </div>
            <button onclick="navigator.clipboard.writeText('${app.esc(this.company.code)}'); DamanApp.toast('تم نسخ كود الشركة ✅','success')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 text-amber-300 text-[10px] font-black shrink-0">نسخ الكود</button>
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
