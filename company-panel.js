(function () {
  const CompanyMod = {
    subTab: 'team', // 'team' | 'hr' | 'custody' | 'leaves' | 'chat'
    members: [],
    myMemberships: [],
    attendance: [],
    payrolls: [],
    custodyList: [],
    leaves: [],
    groupMsgs: [],
    activeCompanyUid: null,
    activeCompanyName: '',
    isOwnerView: false,
    foundUser: null,
    tempCustodyPhoto: '',
    attachedUid: null,
    unsubs: [],

    clearSubs() {
      this.unsubs.forEach((u) => { try { u(); } catch (e) {} });
      this.unsubs = [];
    },

    copySafe(text, label) {
      if (window.DamanWallet && typeof window.DamanWallet.copyText === 'function') {
        return window.DamanWallet.copyText(text, label);
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => window.DamanApp.toast(`تم نسخ ${label}`, 'success')).catch(() => {});
      }
    },

    ensureListeners(app) {
      if (!app.user || !app.profile) {
        this.clearSubs();
        this.attachedUid = null;
        return;
      }
      if (this.attachedUid === app.user.uid) return;
      this.clearSubs();
      this.attachedUid = app.user.uid;

      const p = app.profile;
      const email = (p.email || app.user.email || '').toLowerCase();
      const phone = (p.phone || '').trim();
      const isBiz = p.accountType === 'company' || p.accountType === 'supplier';

      if (isBiz) {
        this.isOwnerView = true;
        this.activeCompanyUid = app.user.uid;
        this.activeCompanyName = p.companyName || p.name || '';
        if (!p.companyCode) {
          const code = 'CMP-' + Math.floor(1000 + Math.random() * 9000);
          app.db.collection('users').doc(app.user.uid).update({ companyCode: code }).catch(() => {});
        }
        this.bindCompanyStreams(app, app.user.uid);
      } else {
        this.isOwnerView = false;
        const q = email && !email.endsWith('@phone.damansite.app')
          ? app.db.collection('companyMembers').where('memberEmail', '==', email)
          : app.db.collection('companyMembers').where('memberPhone', '==', phone);

        this.unsubs.push(
          q.onSnapshot((snap) => {
            this.myMemberships = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
            const active = this.myMemberships.find((m) => m.status === 'active');
            if (active && this.activeCompanyUid !== active.companyUid) {
              this.activeCompanyUid = active.companyUid;
              this.activeCompanyName = active.companyName || '';
              this.bindCompanyStreams(app, active.companyUid);
            }
            if (app.activeTab === 'company') this.rerender();
          }, () => {})
        );
      }
    },

    bindCompanyStreams(app, companyUid) {
      if (!companyUid) return;
      const db = app.db;

      this.unsubs.push(
        db.collection('companyMembers').where('companyUid', '==', companyUid).onSnapshot((snap) => {
          this.members = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          if (app.activeTab === 'company') this.rerender();
        }, () => {})
      );

      this.unsubs.push(
        db.collection('companyAttendance').where('companyUid', '==', companyUid).limit(140).onSnapshot((snap) => {
          this.attendance = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (app.activeTab === 'company' && this.subTab === 'hr') this.rerender();
        }, () => {})
      );

      this.unsubs.push(
        db.collection('companyPayrolls').where('companyUid', '==', companyUid).limit(80).onSnapshot((snap) => {
          this.payrolls = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (app.activeTab === 'company' && this.subTab === 'hr') this.rerender();
        }, () => {})
      );

      this.unsubs.push(
        db.collection('companyCustody').where('companyUid', '==', companyUid).limit(80).onSnapshot((snap) => {
          this.custodyList = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (app.activeTab === 'company' && this.subTab === 'custody') this.rerender();
        }, () => {})
      );

      this.unsubs.push(
        db.collection('companyLeaves').where('companyUid', '==', companyUid).limit(50).onSnapshot((snap) => {
          this.leaves = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (app.activeTab === 'company' && this.subTab === 'leaves') this.rerender();
        }, () => {})
      );

      this.unsubs.push(
        db.collection('companyChats').doc(companyUid).collection('messages').orderBy('createdAt', 'asc').limit(60).onSnapshot((snap) => {
          this.groupMsgs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          if (app.activeTab === 'company' && this.subTab === 'chat') this.rerender();
        }, () => {})
      );
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'company') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) { this.subTab = tab; this.rerender(); },

    canGrantAccess(app) {
      const p = app.profile || {};
      const minBal = Number(app.getPackages().minCompanyBalanceForAccess || 100);
      const isVerified = p.kycStatus === 'verified';
      const hasBalanceOrPlan = Number(p.balanceAvailable || 0) >= minBal || p.activePlanKey === 'company';
      return { allowed: isVerified && hasBalanceOrPlan, isVerified, hasBalanceOrPlan, minBal };
    },

    // ==================== 1. TEAM SEARCH, JOIN BY CODE & PERMISSIONS ====================
    async searchEmployee() {
      const app = window.DamanApp;
      const q = (document.getElementById('cm-search-input')?.value || '').trim();
      if (!q) return;
      this.foundUser = null;
      try {
        const snap = q.includes('@')
          ? await app.db.collection('users').where('email', '==', q.toLowerCase()).limit(1).get()
          : await app.db.collection('users').where('phone', '==', q).limit(1).get();
        if (snap.empty) {
          app.toast('لم يتم العثور على حساب بهذا الرقم أو الإيميل — يمكنك إضافته يدوياً بالأسفل', 'info');
        } else {
          this.foundUser = Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
          app.toast(`تم العثور على: ${this.foundUser.name}`, 'success');
        }
        this.rerender();
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async joinByCompanyCode(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const code = (document.getElementById('join-comp-code')?.value || '').trim().toUpperCase();
      if (!code) return;
      try {
        const snap = await app.db.collection('users').where('companyCode', '==', code).limit(1).get();
        if (snap.empty) return app.toast('كود الشركة غير صحيح', 'error');
        const comp = snap.docs[0].data();
        await app.db.collection('companyMembers').add({
          companyUid: snap.docs[0].id,
          companyName: comp.companyName || comp.name || '',
          memberUid: app.user.uid,
          memberName: app.profile.name || '',
          memberEmail: (app.profile.email || app.user.email || '').toLowerCase(),
          memberPhone: app.profile.phone || '',
          roleTitle: document.getElementById('join-comp-role').value.trim() || 'مهندس / موظف',
          permissions: ['chat_clients', 'approve_supply'],
          monthlySalary: 0,
          allowances: 0,
          overtimePay: 0,
          workDaysPerMonth: 26,
          deductions: 0,
          rating: 5,
          ratingNote: '',
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification(snap.docs[0].id, 'طلب انضمام موظف جديد للشركة', `${app.profile.name} طلب الانضمام بكود الشركة ${code}`);
        app.toast('تم إرسال طلب الانضمام لمدير الشركة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async addTeamMember(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const check = this.canGrantAccess(app);
      if (!check.allowed && !app.isAdmin()) return app.toast('يجب استيفاء شرط التوثيق والرصيد أولاً', 'error');

      const memberName = document.getElementById('cm-name').value.trim();
      const memberEmail = document.getElementById('cm-email').value.trim().toLowerCase();
      const memberPhone = document.getElementById('cm-phone').value.trim();
      const roleTitle = document.getElementById('cm-role').value.trim();
      const monthlySalary = parseFloat(document.getElementById('cm-salary').value) || 0;
      const allowances = parseFloat(document.getElementById('cm-allow').value) || 0;

      const perms = [];
      if (document.getElementById('perm-post')?.checked) perms.push('post_projects');
      if (document.getElementById('perm-bid')?.checked) perms.push('submit_bids');
      if (document.getElementById('perm-chat')?.checked) perms.push('chat_clients');
      if (document.getElementById('perm-supply')?.checked) perms.push('approve_supply');
      if (document.getElementById('perm-vip')?.checked) perms.push('request_vip_labor');

      try {
        await app.db.collection('companyMembers').add({
          companyUid: app.user.uid,
          companyName: app.profile.companyName || app.profile.name || '',
          memberUid: this.foundUser?.id || '',
          memberName,
          memberEmail,
          memberPhone,
          roleTitle,
          permissions: perms,
          monthlySalary,
          allowances,
          overtimePay: 0,
          workDaysPerMonth: 26,
          deductions: 0,
          rating: 5,
          ratingNote: '',
          status: 'active',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (this.foundUser?.id) {
          await app.sendNotification(this.foundUser.id, `تم إضافتك لفريق ${app.profile.companyName || app.profile.name}`, `الوظيفة: ${roleTitle} — افتح لوحة الشركات وHR الآن.`);
        }
        this.foundUser = null;
        e.target.reset();
        app.toast(`تم إضافة ${memberName} للفريق بنجاح`, 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async updateMemberStatus(docId, memberUid, status) {
      const app = window.DamanApp;
      try {
        await app.db.collection('companyMembers').doc(docId).update({ status });
        if (memberUid) await app.sendNotification(memberUid, 'تحديث صلاحيات الشركة', status === 'active' ? 'تم تفعيل صلاحياتك بالفريق ✅' : 'تم إيقاف صلاحياتك مؤقتاً');
        app.toast('تم التحديث', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async editSalaryAndRating(docId) {
      const app = window.DamanApp;
      const m = this.members.find((x) => x.id === docId);
      if (!m) return;
      const sal = parseFloat(window.prompt('الراتب الشهري الأساسي (ج.م):', m.monthlySalary || 0));
      if (isNaN(sal)) return;
      const allow = parseFloat(window.prompt('البدلات الشهرية (انتقالات / إقامة - ج.م):', m.allowances || 0)) || 0;
      const ot = parseFloat(window.prompt('إجمالي الإضافي / المكافآت هذا الشهر (ج.م):', m.overtimePay || 0)) || 0;
      const ded = parseFloat(window.prompt('إجمالي السُلف والخصومات هذا الشهر (ج.م):', m.deductions || 0)) || 0;
      const rat = Math.min(5, Math.max(1, parseInt(window.prompt('تقييم الأداء (من 1 إلى 5 نجوم):', m.rating || 5), 10) || 5));
      const note = window.prompt('ملاحظة التقييم:', m.ratingNote || '') || '';
      try {
        await app.db.collection('companyMembers').doc(docId).update({
          monthlySalary: sal,
          allowances: allow,
          overtimePay: ot,
          deductions: ded,
          rating: rat,
          ratingNote: note
        });
        app.toast('تم تحديث بيانات الراتب والتقييم بنجاح', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 2. HR ATTENDANCE (SELFIE + GPS + SITE NAME) & PAYROLL PAYOUT ====================
    compressImage(file, maxW = 540) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Read error'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Image error'));
          img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', 0.52));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async recordAttendance(kind, input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file || !this.activeCompanyUid) return;
      const siteName = (document.getElementById('hr-site-name')?.value || '').trim() || 'الموقع الرئيسي';
      app.toast('جارٍ تسجيل السيلفي واللوكيشن (GPS)...', 'info');

      try {
        const selfieBase64 = await this.compressImage(file, 420);
        const pos = await new Promise((res) => {
          if (!navigator.geolocation) return res(null);
          navigator.geolocation.getCurrentPosition(
            (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => res(null),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 5);
        const docId = `${this.activeCompanyUid}_${app.user.uid}_${dateStr}`;
        const ref = app.db.collection('companyAttendance').doc(docId);
        const existing = await ref.get();

        if (kind === 'in') {
          await ref.set({
            companyUid: this.activeCompanyUid,
            memberUid: app.user.uid,
            memberName: app.profile.name || '',
            siteName,
            date: dateStr,
            checkInTime: timeStr,
            checkInMs: Date.now(),
            checkInSelfie: selfieBase64,
            checkInLoc: pos,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          await app.sendNotification(this.activeCompanyUid, 'تسجيل حضور موظف', `${app.profile.name} حضر في (${siteName}) الساعة ${timeStr}`);
          app.toast(`تم تسجيل الحضور في (${siteName}) الساعة ${timeStr}`, 'success');
        } else {
          const inMs = existing.exists ? existing.data().checkInMs : Date.now();
          const hours = Math.max(0.5, Math.round(((Date.now() - inMs) / 3600000) * 10) / 10);
          await ref.set({
            companyUid: this.activeCompanyUid,
            memberUid: app.user.uid,
            memberName: app.profile.name || '',
            siteName: (existing.exists && existing.data().siteName) || siteName,
            date: dateStr,
            checkOutTime: timeStr,
            checkOutSelfie: selfieBase64,
            checkOutLoc: pos,
            hoursWorked: hours
          }, { merge: true });
          await app.sendNotification(this.activeCompanyUid, 'تسجيل انصراف موظف', `${app.profile.name} انصرف الساعة ${timeStr} (${hours} ساعة)`);
          app.toast(`تم تسجيل الانصراف (${hours} ساعة عمل)`, 'success');
        }
      } catch (err) { app.toast(err.message, 'error'); }
      input.value = '';
    },

    calcPayrollRow(m) {
      const monthKey = new Date().toISOString().slice(0, 7);
      const recs = this.attendance.filter((a) => (a.memberUid === m.memberUid || a.memberName === m.memberName) && (a.date || '').startsWith(monthKey));
      const daysPresent = recs.length;
      const totalHours = Math.round(recs.reduce((s, r) => s + Number(r.hoursWorked || 8), 0) * 10) / 10;
      const targetDays = Number(m.workDaysPerMonth || 26);
      const dayOfMonth = Math.min(targetDays, new Date().getDate());
      const daysAbsent = Math.max(0, dayOfMonth - daysPresent);
      const base = Number(m.monthlySalary || 0);
      const allowances = Number(m.allowances || 0);
      const overtimePay = Number(m.overtimePay || 0);
      const deductions = Number(m.deductions || 0);
      const dailyVal = targetDays > 0 ? base / targetDays : 0;
      const absenceDeduct = Math.round(daysAbsent * dailyVal);
      const netSalary = Math.max(0, Math.round(base + allowances + overtimePay - absenceDeduct - deductions));
      const paidRecord = this.payrolls.find((pr) => pr.memberDocId === m.id && pr.monthKey === monthKey);
      return { monthKey, daysPresent, daysAbsent, totalHours, base, allowances, overtimePay, absenceDeduct, deductions, netSalary, paidRecord };
    },

    async disburseSalary(memberDocId, method) {
      const app = window.DamanApp;
      const m = this.members.find((x) => x.id === memberDocId);
      if (!m) return;
      const pr = this.calcPayrollRow(m);
      if (pr.paidRecord) return app.toast('تم صرف راتب هذا الشهر لهذا الموظف بالفعل', 'info');
      if (pr.netSalary <= 0) return app.toast('صافي الراتب 0 ج.م — عدّل الراتب الأساسي أولاً', 'warning');

      if (method === 'wallet') {
        let targetUid = m.memberUid;
        if (!targetUid && m.memberPhone) {
          const uSnap = await app.db.collection('users').where('phone', '==', m.memberPhone).limit(1).get();
          if (!uSnap.empty) targetUid = uSnap.docs[0].id;
        }
        if (!targetUid) return app.toast('هذا الموظف غير مربوط بحساب على التطبيق — استخدم الصرف النقدي/البنكي أو اطلب منه التسجيل بنفس رقم الموبايل', 'warning');

        if (Number(app.profile?.balanceAvailable || 0) < pr.netSalary) {
          if (window.confirm(`رصيد محفظة الشركة المتاح (${app.fmtMoney(app.profile?.balanceAvailable)} ج.م) أقل من صافي الراتب (${app.fmtMoney(pr.netSalary)} ج.م).\nهل تريد شحن المحفظة الآن؟`)) {
            if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(pr.netSalary);
          }
          return;
        }

        if (!window.confirm(`تأكيد تحويل راتب شهر (${pr.monthKey}) بمبلغ ${app.fmtMoney(pr.netSalary)} ج.م مباشرة من محفظة الشركة إلى محفظة ${m.memberName}؟`)) return;

        const compRef = app.db.collection('users').doc(app.user.uid);
        const empRef = app.db.collection('users').doc(targetUid);
        const payRef = app.db.collection('companyPayrolls').doc(`${this.activeCompanyUid}_${m.id}_${pr.monthKey}`);

        try {
          await app.db.runTransaction(async (tx) => {
            const [cDoc, eDoc] = await Promise.all([tx.get(compRef), tx.get(empRef)]);
            const curComp = Number((cDoc.data() || {}).balanceAvailable || 0);
            if (curComp < pr.netSalary) throw new Error('رصيد الشركة غير كافٍ');
            tx.update(compRef, { balanceAvailable: Math.round((curComp - pr.netSalary) * 100) / 100 });
            tx.update(empRef, { balanceAvailable: Math.round((Number((eDoc.data() || {}).balanceAvailable || 0) + pr.netSalary) * 100) / 100 });
            tx.set(payRef, {
              companyUid: this.activeCompanyUid, companyName: this.activeCompanyName,
              memberDocId: m.id, memberUid: targetUid, memberName: m.memberName, roleTitle: m.roleTitle,
              monthKey: pr.monthKey, base: pr.base, allowances: pr.allowances, overtimePay: pr.overtimePay,
              absenceDeduct: pr.absenceDeduct, deductions: pr.deductions, netSalary: pr.netSalary,
              method: 'محفظة ضمان سايت', paidDate: new Date().toISOString().slice(0, 10),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(targetUid, `تم صرف راتبك الشهري (${pr.monthKey}) ✅`, `حوّلت شركة ${this.activeCompanyName} مبلغ ${app.fmtMoney(pr.netSalary)} ج.م إلى محفظتك.`);
          app.toast(`تم تحويل الراتب (${app.fmtMoney(pr.netSalary)} ج.م) لمحفظة الموظف بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      } else {
        if (!window.confirm(`تسجيل صرف راتب ${m.memberName} (${app.fmtMoney(pr.netSalary)} ج.م) نقداً / تحويلاً بنكياً خارجياً لشهر ${pr.monthKey}؟`)) return;
        try {
          await app.db.collection('companyPayrolls').doc(`${this.activeCompanyUid}_${m.id}_${pr.monthKey}`).set({
            companyUid: this.activeCompanyUid, companyName: this.activeCompanyName,
            memberDocId: m.id, memberUid: m.memberUid || '', memberName: m.memberName, roleTitle: m.roleTitle,
            monthKey: pr.monthKey, base: pr.base, allowances: pr.allowances, overtimePay: pr.overtimePay,
            absenceDeduct: pr.absenceDeduct, deductions: pr.deductions, netSalary: pr.netSalary,
            method: 'نقدي / بنكي', paidDate: new Date().toISOString().slice(0, 10),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          if (m.memberUid) await app.sendNotification(m.memberUid, `تم تسجيل صرف راتبك (${pr.monthKey})`, `صافي الراتب: ${app.fmtMoney(pr.netSalary)} ج.م (نقدي/بنكي) — يمكنك طباعة قسيمة الراتب الآن.`);
          app.toast('تم توثيق صرف الراتب وإصدار القسيمة بنجاح', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      }
    },

    printPayslipA4(memberDocId) {
      const app = window.DamanApp;
      const m = this.members.find((x) => x.id === memberDocId);
      if (!m) return;
      const pr = this.calcPayrollRow(m);
      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>قسيمة راتب — ${app.esc(m.memberName)}</title><style>@page{size:A4 portrait;margin:14mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:12px;line-height:1.6;}.sheet{border:2px solid #000;padding:18px 20px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:14px;}table{width:100%;border-collapse:collapse;margin-bottom:14px;}th,td{border:1px solid #000;padding:7px 9px;text-align:right;}th{background:#f2f2f2;width:40%;}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px;text-align:center;}.sig{border:1px solid #000;padding:10px 8px 46px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة / حفظ قسيمة الراتب PDF (A4)</button><div class="sheet"><div class="hdr"><div><h2 style="margin:0">قسيمة راتب ومفردات مرتب (Payslip)</h2><div>الشركة: <b>${app.esc(this.activeCompanyName)}</b></div></div><div><div><b>عن شهر:</b> ${pr.monthKey}</div><div><b>حالة الصرف:</b> ${pr.paidRecord ? 'تم الصرف (' + pr.paidRecord.method + ')' : 'مستحق الصرف'}</div></div></div><table><tr><th>اسم الموظف</th><td><b>${app.esc(m.memberName)}</b></td></tr><tr><th>المسمى الوظيفي</th><td>${app.esc(m.roleTitle)}</td></tr><tr><th>أيام الحضور / الغياب / الساعات</th><td>حضور: ${pr.daysPresent} يوم | غياب: ${pr.daysAbsent} يوم | ساعات: ${pr.totalHours} س</td></tr><tr><th>الراتب الأساسي</th><td>${app.fmtMoney(pr.base)} ج.م</td></tr><tr><th>البدلات الشهرية (+)</th><td>+${app.fmtMoney(pr.allowances)} ج.م</td></tr><tr><th>الإضافي والمكافآت (+)</th><td>+${app.fmtMoney(pr.overtimePay)} ج.م</td></tr><tr><th>خصم الغياب (-)</th><td>-${app.fmtMoney(pr.absenceDeduct)} ج.م</td></tr><tr><th>السُلف والخصومات (-)</th><td>-${app.fmtMoney(pr.deductions)} ج.م</td></tr><tr><th style="background:#e5e5e5">صافي الراتب المستحق</th><td style="background:#e5e5e5"><b>${app.fmtMoney(pr.netSalary)} ج.م</b></td></tr></table><div class="sigs"><div class="sig">توقيع الموظف بالاستلام</div><div class="sig">اعتماد إدارة الشركة</div></div></div></body></html>`);
      win.document.close();
    },

    printHrPayrollA4() {
      const app = window.DamanApp;
      const activeMembers = this.members.filter((m) => m.status === 'active');
      if (!activeMembers.length) return app.toast('لا يوجد موظفون نشطون للطباعة', 'warning');
      const monthStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
      let grandTotal = 0;

      const rows = activeMembers.map((m, i) => {
        const p = this.calcPayrollRow(m);
        grandTotal += p.netSalary;
        return `<tr><td>${i + 1}</td><td><b>${app.esc(m.memberName)}</b><br/><small>${app.esc(m.roleTitle)}</small></td><td>${app.fmtMoney(p.base)}</td><td>+${app.fmtMoney(p.allowances + p.overtimePay)}</td><td>${p.daysPresent} / ${p.daysAbsent}</td><td>-${app.fmtMoney(p.absenceDeduct + p.deductions)}</td><td>${p.paidRecord ? 'مدفوع' : 'معلق'}</td><td><b>${app.fmtMoney(p.netSalary)} ج.م</b></td></tr>`;
      }).join('');

      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>شيت الرواتب والحضور — ${app.esc(this.activeCompanyName)}</title><style>@page{size:A4 landscape;margin:12mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11px;}.sheet{border:2px solid #000;padding:14px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:5px;text-align:right;}th{background:#f0f0f0;}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px;text-align:center;}.sig{border:1px solid #000;padding:8px 6px 36px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة / حفظ شيت الرواتب PDF (A4)</button><div class="sheet"><div class="hdr"><div><h2 style="margin:0">كشف الحضور والانصراف والرواتب الشهرية</h2><div>الشركة: <b>${app.esc(this.activeCompanyName)}</b></div></div><div><div><b>الشهر:</b> ${monthStr}</div><div><b>إجمالي الرواتب:</b> ${app.fmtMoney(grandTotal)} ج.م</div></div></div><table><thead><tr><th>#</th><th>الموظف والوظيفة</th><th>الأساسي</th><th>بدلات+إضافي</th><th>حضور/غياب</th><th>خصم غياب+سُلف</th><th>الحالة</th><th>صافي المستحق</th></tr></thead><tbody>${rows}</tbody></table><div class="sigs"><div class="sig">إعداد الـ HR</div><div class="sig">المدير المالي</div><div class="sig">اعتماد مدير الشركة</div></div></div></body></html>`);
      win.document.close();
    },

    // ==================== 3. CUSTODY (WITH INVOICE PHOTOS + A4 LIQUIDATION) & LEAVES & CHAT ====================
    async handleCustodyPhoto(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        this.tempCustodyPhoto = await this.compressImage(file, 640);
        const prev = document.getElementById('cus-photo-prev');
        if (prev) prev.innerHTML = `<img src="${this.tempCustodyPhoto}" class="max-h-24 mx-auto rounded mt-1.5 border border-amber-500/40" />`;
      } catch (e) {}
    },

    async addCustodyItem(e) {
      e.preventDefault();
      const app = window.DamanApp;
      try {
        await app.db.collection('companyCustody').add({
          companyUid: this.activeCompanyUid,
          byName: app.profile.name || '',
          kind: document.getElementById('cus-kind').value,
          amount: parseFloat(document.getElementById('cus-amt').value) || 0,
          notes: document.getElementById('cus-notes').value.trim(),
          invoiceBase64: this.tempCustodyPhoto || '',
          date: new Date().toISOString().slice(0, 10),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        this.tempCustodyPhoto = '';
        e.target.reset();
        const prev = document.getElementById('cus-photo-prev');
        if (prev) prev.innerHTML = '';
        app.toast('تم تسجيل العُهدة / الفاتورة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    printCustodyA4() {
      const app = window.DamanApp;
      if (!this.custodyList.length) return app.toast('لا توجد بيانات عُهد للطباعة', 'warning');
      let totalIn = 0, totalOut = 0;
      const rows = this.custodyList.map((c, i) => {
        if (c.kind === 'custody') totalIn += Number(c.amount || 0);
        else totalOut += Number(c.amount || 0);
        return `<tr><td>${i + 1}</td><td>${app.esc(c.date)}</td><td>${app.esc(c.byName)}</td><td>${c.kind === 'custody' ? 'استلام عُهدة (+)' : 'مصروف (-)'}</td><td>${app.esc(c.notes)}</td><td><b>${app.fmtMoney(c.amount)} ج.م</b></td></tr>`;
      }).join('');

      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>تصفية عُهدة — ${app.esc(this.activeCompanyName)}</title><style>@page{size:A4 portrait;margin:13mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11.5px;}.sheet{border:2px solid #000;padding:16px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}table{width:100%;border-collapse:collapse;margin-bottom:12px;}th,td{border:1px solid #000;padding:5px 7px;text-align:right;}th{background:#f0f0f0;}.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;}.sbox{border:1px solid #000;padding:7px;}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:24px;text-align:center;}.sig{border:1px solid #000;padding:8px 6px 40px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة كشف تصفية العُهد PDF (A4)</button><div class="sheet"><div class="hdr"><div><h2 style="margin:0">كشف تصفية العُهد والمصاريف</h2><div>الشركة: <b>${app.esc(this.activeCompanyName)}</b></div></div><div>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</div></div><table><thead><tr><th>#</th><th>التاريخ</th><th>بواسطة</th><th>النوع</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>${rows}</tbody></table><div class="sum"><div class="sbox">إجمالي العُهد<br/><b>${app.fmtMoney(totalIn)} ج.م</b></div><div class="sbox">إجمالي المصاريف<br/><b>${app.fmtMoney(totalOut)} ج.م</b></div><div class="sbox" style="background:#eee">المتبقي<br/><b>${app.fmtMoney(totalIn - totalOut)} ج.م</b></div></div><div class="sigs"><div class="sig">توقيع المسؤول عن العُهدة</div><div class="sig">اعتماد المدير المالي</div></div></div></body></html>`);
      win.document.close();
    },

    async submitLeave(e) {
      e.preventDefault();
      const app = window.DamanApp;
      try {
        await app.db.collection('companyLeaves').add({
          companyUid: this.activeCompanyUid,
          memberUid: app.user.uid,
          memberName: app.profile.name || '',
          leaveType: document.getElementById('lv-type').value,
          leaveDate: document.getElementById('lv-date').value,
          reason: document.getElementById('lv-reason').value.trim(),
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification(this.activeCompanyUid, 'طلب إجازة / إذن جديد', `${app.profile.name} قدّم طلب إجازة`);
        e.target.reset();
        app.toast('تم إرسال طلب الإجازة للإدارة', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async handleLeaveDecision(id, memberUid, status) {
      const app = window.DamanApp;
      try {
        await app.db.collection('companyLeaves').doc(id).update({ status });
        if (memberUid) await app.sendNotification(memberUid, 'رد الشركة على طلب الإجازة', status === 'approved' ? 'تمت الموافقة على طلبك ✅' : 'تم رفض طلب الإجازة');
        app.toast('تم تحديث حالة الطلب', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async sendGroupMsg(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('comp-chat-inp');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.activeCompanyUid) return;
      inp.value = '';
      try {
        await app.db.collection('companyChats').doc(this.activeCompanyUid).collection('messages').add({
          senderId: app.user.uid,
          senderName: app.profile.name || '',
          text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== RENDER SUB-TABS ====================
    renderTeamTab(app) {
      const check = this.canGrantAccess(app);
      const unlocked = check.allowed || app.isAdmin();
      const p = app.profile || {};
      const compCode = p.companyCode || ('CMP-' + app.user.uid.slice(0, 4).toUpperCase());

      return `
        <div class="space-y-3.5">
          ${this.isOwnerView ? `
            <div class="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-xs">
              <div>
                <div class="text-[10px] text-slate-400">كود دعوة الشركة / المورّد (أعطه لفريقك للانضمام):</div>
                <div class="text-sm font-black text-sky-300 tracking-widest">${app.esc(compCode)}</div>
              </div>
              <button onclick="DamanCompany.copySafe('${app.esc(compCode)}','كود الشركة')" class="px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px]">نسخ الكود</button>
            </div>

            ${!unlocked ? `
              <div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-[11px] text-rose-200 space-y-1">
                <div class="font-black text-rose-300"><i class="fa-solid fa-lock me-1"></i> لفتح إضافة الموظفين (Access):</div>
                <div>• ${check.isVerified ? '✅ تم التوثيق بالسجل التجاري والضريبية' : '❌ وثّق الحساب بالسجل التجاري والبطاقة الضريبية من المحفظة'}</div>
                <div>• ${check.hasBalanceOrPlan ? '✅ الرصيد/الباقة مفعّلة' : `❌ اشحن رصيدك (${check.minBal} ج.م على الأقل) أو فعّل باقة الشركات`}</div>
              </div>` : `
              <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-sky-500/30">
                <div class="flex gap-1.5">
                  <input id="cm-search-input" type="text" placeholder="ابحث عن موظف برقم الموبايل أو الجيميل..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
                  <button type="button" onclick="DamanCompany.searchEmployee()" class="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">بحث</button>
                </div>
                <form onsubmit="DamanCompany.addTeamMember(event)" class="space-y-2 text-xs">
                  <div class="grid grid-cols-2 gap-2">
                    <input id="cm-name" type="text" required value="${app.esc(this.foundUser?.name || '')}" placeholder="اسم الموظف / المهندس" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                    <input id="cm-role" type="text" required placeholder="الوظيفة (مهندس موقع / أمين مخزن)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <input id="cm-phone" type="tel" required value="${app.esc(this.foundUser?.phone || '')}" placeholder="رقم الموبايل" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                    <input id="cm-email" type="email" value="${app.esc(this.foundUser?.email || '')}" placeholder="الإيميل (اختياري)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <input id="cm-salary" type="number" min="0" placeholder="الراتب الأساسي (ج.م)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-bold" />
                    <input id="cm-allow" type="number" min="0" value="0" placeholder="البدلات الشهرية (ج.م)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                  </div>
                  <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                    <label><input id="perm-post" type="checkbox" checked class="accent-sky-500 me-1" />نشر مشاريع وعروض</label>
                    <label><input id="perm-bid" type="checkbox" checked class="accent-sky-500 me-1" />تقديم عروض أسعار</label>
                    <label><input id="perm-chat" type="checkbox" checked class="accent-sky-500 me-1" />دردشة العملاء والموردين</label>
                    <label><input id="perm-supply" type="checkbox" checked class="accent-emerald-500 me-1" />اعتماد استلام توريدات B2B</label>
                    <label><input id="perm-vip" type="checkbox" checked class="accent-sky-500 me-1" />طلب عمالة VIP</label>
                  </div>
                  <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">إضافة الموظف ومنح الصلاحيات</button>
                </form>
              </div>`}` : ''}

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-white">أعضاء الفريق (${this.members.length})</h4>
            ${this.members.map((m) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-extrabold text-white">${app.esc(m.memberName)} <span class="text-[10px] text-sky-400">(${app.esc(m.roleTitle)})</span></div>
                    <div class="text-[10px] text-slate-400">${app.esc(m.memberPhone || '')} | أساسي: ${app.fmtMoney(m.monthlySalary)} + بدلات: ${app.fmtMoney(m.allowances || 0)} | ★ ${m.rating || 5}</div>
                  </div>
                  <span class="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">${app.esc(m.status)}</span>
                </div>
                ${this.isOwnerView ? `
                  <div class="flex gap-1.5 pt-1">
                    ${m.status === 'pending' ? `<button onclick="DamanCompany.updateMemberStatus('${m.id}','${m.memberUid}','active')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">قبول الانضمام</button>` : ''}
                    <button onclick="DamanCompany.editSalaryAndRating('${m.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">الراتب والبدلات والتقييم</button>
                    <button onclick="DamanCompany.updateMemberStatus('${m.id}','${m.memberUid}','${m.status === 'active' ? 'suspended' : 'active'}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px]">${m.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                  </div>` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderHrTab(app) {
      const activeMembers = this.members.filter((m) => m.status === 'active');
      const myMemberRow = !this.isOwnerView ? activeMembers.find((m) => m.memberUid === app.user.uid || m.memberPhone === app.profile?.phone) : null;

      return `
        <div class="space-y-3.5">
          <!-- Check-In / Check-Out with Site Name + Selfie + GPS -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-emerald-500/40">
            <div class="text-xs font-black text-emerald-400"><i class="fa-solid fa-camera-retro me-1"></i> تسجيل الحضور والانصراف اليومي (سيلفي + GPS + اسم الموقع)</div>
            <input id="hr-site-name" type="text" placeholder="اسم المشروع / الموقع الحالي (مثال: مشروع سعادة - التجمع)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <div class="grid grid-cols-2 gap-2">
              <label class="py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs text-center cursor-pointer">
                <i class="fa-solid fa-right-to-bracket me-1"></i> تسجيل حضور
                <input type="file" accept="image/*" capture="user" class="hidden" onchange="DamanCompany.recordAttendance('in', this)" />
              </label>
              <label class="py-3 rounded-xl bg-rose-500 text-white font-black text-xs text-center cursor-pointer">
                <i class="fa-solid fa-right-from-bracket me-1"></i> تسجيل انصراف
                <input type="file" accept="image/*" capture="user" class="hidden" onchange="DamanCompany.recordAttendance('out', this)" />
              </label>
            </div>
          </div>

          <!-- Employee own Payslip button -->
          ${myMemberRow ? `
            <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs">
              <div>
                <div class="font-black text-amber-300">قسيمة راتبي للشهر الحالي</div>
                <div class="text-[10px] text-slate-200">صافي المستحق حتى الآن: <b>${app.fmtMoney(this.calcPayrollRow(myMemberRow).netSalary)} ج.م</b></div>
              </div>
              <button onclick="DamanCompany.printPayslipA4('${myMemberRow.id}')" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>قسيمة A4</button>
            </div>` : ''}

          <!-- Owner Monthly Payroll Sheet & Disbursement -->
          ${this.isOwnerView ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2.5">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-black text-amber-400"><i class="fa-solid fa-file-invoice-dollar me-1"></i> شيت وصرف الرواتب الشهرية</h4>
                <button onclick="DamanCompany.printHrPayrollA4()" class="px-2.5 py-1.5 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>شيت A4 PDF</button>
              </div>
              ${!activeMembers.length ? '<div class="text-center text-xs text-slate-400 py-3">أضف موظفين من تبويب الفريق أولاً</div>' : activeMembers.map((m) => {
                const pr = this.calcPayrollRow(m);
                return `
                  <div class="p-2.5 rounded-xl bg-slate-950/90 border ${pr.paidRecord ? 'border-emerald-500/50' : 'border-slate-800'} text-xs space-y-1.5">
                    <div class="flex justify-between font-extrabold">
                      <span class="text-white">${app.esc(m.memberName)}</span>
                      <span class="text-emerald-400">صافي: ${app.fmtMoney(pr.netSalary)} ج.م</span>
                    </div>
                    <div class="text-[10px] text-slate-400">حضور: ${pr.daysPresent} | غياب: ${pr.daysAbsent} (-${app.fmtMoney(pr.absenceDeduct)}) | بدلات+إضافي: +${app.fmtMoney(pr.allowances + pr.overtimePay)} | سُلف: -${app.fmtMoney(pr.deductions)}</div>
                    <div class="grid grid-cols-3 gap-1 pt-1">
                      ${pr.paidRecord
                        ? `<div class="col-span-2 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-[10px] text-center">✓ تم الصرف (${app.esc(pr.paidRecord.method)})</div>`
                        : `<button onclick="DamanCompany.disburseSalary('${m.id}','wallet')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[9.5px]">تحويل بالمحفظة</button>
                           <button onclick="DamanCompany.disburseSalary('${m.id}','cash')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[9.5px]">صرف نقدي/بنكي</button>`}
                      <button onclick="DamanCompany.printPayslipA4('${m.id}')" class="py-1.5 rounded-lg bg-white text-slate-950 font-black text-[9.5px]">قسيمة A4</button>
                    </div>
                  </div>`;
              }).join('')}
            </div>` : ''}

          <div class="glass-card rounded-2xl p-3.5 space-y-2">
            <h4 class="text-xs font-extrabold text-white">سجل الحضور الأخير (بالسيلفي والموقع والـ GPS)</h4>
            ${!this.attendance.length ? '<div class="text-xs text-slate-400 text-center py-3">لا يوجد سجل حضور بعد</div>' : this.attendance.slice(0, 15).map((a) => `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  ${a.checkInSelfie ? `<img src="${a.checkInSelfie}" onclick="window.open('${a.checkInSelfie}','_blank')" class="w-10 h-10 rounded-lg object-cover border border-emerald-500/40 shrink-0 cursor-pointer" />` : ''}
                  <div class="min-w-0">
                    <div class="font-bold text-white truncate">${app.esc(a.memberName)} — ${app.esc(a.date)}</div>
                    <div class="text-[10px] text-sky-300 truncate">${app.esc(a.siteName || 'الموقع')}</div>
                    <div class="text-[10px] text-slate-400">حضور: ${a.checkInTime || '-'} | انصراف: ${a.checkOutTime || '-'} ${a.hoursWorked ? `(${a.hoursWorked} س)` : ''}</div>
                  </div>
                </div>
                ${a.checkInLoc ? `<a href="https://maps.google.com/?q=${a.checkInLoc.lat},${a.checkInLoc.lng}" target="_blank" class="px-2 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-[10px] font-bold shrink-0"><i class="fa-solid fa-location-dot"></i></a>` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderCustodyTab(app) {
      let totalIn = 0, totalOut = 0;
      this.custodyList.forEach((c) => { if (c.kind === 'custody') totalIn += Number(c.amount || 0); else totalOut += Number(c.amount || 0); });
      return `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black text-amber-400">سجل العُهد والفواتير وتصفية الموقع</h4>
            <button onclick="DamanCompany.printCustodyA4()" class="px-2.5 py-1.5 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>كشف A4 PDF</button>
          </div>
          <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><div class="text-slate-400">إجمالي العُهد</div><div class="text-xs font-black text-emerald-400">${app.fmtMoney(totalIn)}</div></div>
            <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><div class="text-slate-400">المصاريف</div><div class="text-xs font-black text-rose-400">${app.fmtMoney(totalOut)}</div></div>
            <div class="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40"><div class="text-amber-200">المتبقي</div><div class="text-xs font-black text-amber-300">${app.fmtMoney(totalIn - totalOut)}</div></div>
          </div>
          <form onsubmit="DamanCompany.addCustodyItem(event)" class="glass-card rounded-2xl p-3 space-y-2 text-xs">
            <div class="grid grid-cols-2 gap-2">
              <select id="cus-kind" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-white"><option value="custody">استلام عُهدة (+)</option><option value="expense">مصروف بفاتورة (-)</option></select>
              <input id="cus-amt" type="number" min="1" required placeholder="المبلغ (ج.م)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-bold" />
            </div>
            <input id="cus-notes" type="text" required placeholder="البيان (مثلاً: عهدة م. أحمد / فاتورة خامات)" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <label class="block p-2 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-amber-300"><i class="fa-solid fa-receipt me-1"></i> إرفاق صورة الفاتورة (اختياري)</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanCompany.handleCustodyPhoto(this)" />
              <div id="cus-photo-prev"></div>
            </label>
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black">تسجيل في سجل العُهد</button>
          </form>
          ${this.custodyList.map((c) => `
            <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
              <div class="flex justify-between">
                <div><div class="font-bold text-white">${app.esc(c.notes)}</div><div class="text-[10px] text-slate-400">${app.esc(c.byName)} • ${app.esc(c.date)}</div></div>
                <span class="font-black ${c.kind === 'custody' ? 'text-emerald-400' : 'text-rose-400'}">${c.kind === 'custody' ? '+' : '-'}${app.fmtMoney(c.amount)}</span>
              </div>
              ${c.invoiceBase64 ? `<img src="${c.invoiceBase64}" onclick="window.open('${c.invoiceBase64}','_blank')" class="max-h-28 rounded border border-slate-700 cursor-pointer" />` : ''}
            </div>`).join('')}
        </div>`;
    },

    renderLeavesTab(app) {
      return `
        <div class="space-y-3">
          <form onsubmit="DamanCompany.submitLeave(event)" class="glass-card rounded-2xl p-3 space-y-2 text-xs">
            <div class="grid grid-cols-2 gap-2">
              <select id="lv-type" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-white"><option value="إجازة يوم">إجازة يوم</option><option value="إذن تأخير / انصراف">إذن تأخير / انصراف</option><option value="إجازة مرضي">إجازة مرضي</option></select>
              <input id="lv-date" type="date" required value="${new Date().toISOString().slice(0, 10)}" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <input id="lv-reason" type="text" required placeholder="السبب..." class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black">تقديم طلب إجازة / إذن</button>
          </form>
          ${this.leaves.map((l) => `
            <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
              <div class="flex justify-between font-bold"><span class="text-white">${app.esc(l.memberName)} — ${app.esc(l.leaveType)}</span><span class="text-[10px] text-amber-300">${app.esc(l.status)}</span></div>
              <div class="text-[10px] text-slate-400">${app.esc(l.leaveDate)} | ${app.esc(l.reason)}</div>
              ${this.isOwnerView && l.status === 'pending' ? `
                <div class="flex gap-1.5 pt-1">
                  <button onclick="DamanCompany.handleLeaveDecision('${l.id}','${l.memberUid}','approved')" class="flex-1 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة</button>
                  <button onclick="DamanCompany.handleLeaveDecision('${l.id}','${l.memberUid}','rejected')" class="flex-1 py-1 rounded-lg bg-rose-500 text-white font-black text-[10px]">رفض</button>
                </div>` : ''}
            </div>`).join('')}
        </div>`;
    },

    renderGroupChatTab(app) {
      return `
        <div class="space-y-2.5">
          <div class="glass-card rounded-2xl p-3 space-y-2 h-[300px] overflow-y-auto">
            ${!this.groupMsgs.length ? '<div class="text-center text-xs text-slate-400 py-10">جروب الشركة الداخلي — ابدأ التواصل مع فريقك</div>' : this.groupMsgs.map((m) => `
              <div class="flex ${m.senderId === app.user.uid ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[84%] rounded-2xl px-3 py-2 text-xs ${m.senderId === app.user.uid ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-800 text-white'}">
                  <div class="text-[9px] opacity-75 font-extrabold">${app.esc(m.senderName)}</div>
                  <div>${app.esc(m.text)}</div>
                </div>
              </div>`).join('')}
          </div>
          <form onsubmit="DamanCompany.sendGroupMsg(event)" class="flex gap-1.5">
            <input id="comp-chat-inp" type="text" placeholder="رسالة لفريق الشركة..." class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    render(container, app) {
      this.ensureListeners(app);
      if (!app.user || !app.profile) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center mt-6"><button onclick="DamanApp.openAuthModal('login')" class="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
        return;
      }

      if (!this.activeCompanyUid) {
        container.innerHTML = `
          <div class="space-y-4 mt-4">
            <div class="glass-card rounded-2xl p-5 text-center space-y-2">
              <i class="fa-solid fa-building-user text-3xl text-sky-400"></i>
              <h3 class="text-sm font-black text-white">انضم لفريق شركتك بكود الشركة (HR & Access)</h3>
              <p class="text-[11px] text-slate-400">أدخل كود الشركة اللي أخدته من مديرك عشان تسجّل حضورك وانصرافك وتستلم قسيمة راتبك وتشتغل مع الفريق.</p>
              <form onsubmit="DamanCompany.joinByCompanyCode(event)" class="space-y-2 pt-2 text-start">
                <input id="join-comp-code" type="text" required placeholder="كود الشركة (مثال: CMP-4821)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/40 text-xs text-white font-bold uppercase" />
                <input id="join-comp-role" type="text" required placeholder="وظيفتك (مثال: مهندس موقع / مشرف)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
                <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">إرسال طلب انضمام للشركة</button>
              </form>
            </div>
          </div>`;
        return;
      }

      const tabs = [
        { id: 'team', label: 'الفريق' },
        { id: 'hr', label: 'HR والرواتب' },
        { id: 'custody', label: 'العُهد' },
        { id: 'leaves', label: 'الإجازات' },
        { id: 'chat', label: 'جروب الشركة' }
      ];
      const body =
        this.subTab === 'hr' ? this.renderHrTab(app)
        : this.subTab === 'custody' ? this.renderCustodyTab(app)
        : this.subTab === 'leaves' ? this.renderLeavesTab(app)
        : this.subTab === 'chat' ? this.renderGroupChatTab(app)
        : this.renderTeamTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-3.5 bg-gradient-to-br from-sky-900/50 to-slate-950 border border-sky-500/40 flex items-center justify-between">
            <div>
              <div class="text-sm font-black text-white"><i class="fa-solid fa-building-shield text-sky-400 me-1"></i> ${app.esc(this.activeCompanyName)}</div>
              <div class="text-[10px] text-sky-300">${this.isOwnerView ? 'وضع مدير الشركة / المورّد (تحكم كامل)' : 'وضع موظف / مهندس بالفريق'}</div>
            </div>
          </div>
          <div class="grid grid-cols-5 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            ${tabs.map((t) => `<button onclick="DamanCompany.setSubTab('${t.id}')" class="py-1.5 rounded-lg text-[10px] font-extrabold ${this.subTab === t.id ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${t.label}</button>`).join('')}
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanCompany = CompanyMod;
  if (window.DamanApp) window.DamanApp.registerModule('company', CompanyMod);
})();
