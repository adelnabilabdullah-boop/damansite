(function () {
  const CompanyMod = {
    subTab: 'team', // 'team' | 'hr' | 'custody' | 'leaves' | 'chat'
    members: [],
    myMemberships: [],
    attendance: [],
    custodyList: [],
    leaves: [],
    groupMsgs: [],
    activeCompanyUid: null,
    activeCompanyName: '',
    isOwnerView: false,
    foundUser: null,
    attachedUid: null,
    unsubs: [],

    clearSubs() {
      this.unsubs.forEach((u) => { try { u(); } catch (e) {} });
      this.unsubs = [];
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

      if (p.accountType === 'company') {
        this.isOwnerView = true;
        this.activeCompanyUid = app.user.uid;
        this.activeCompanyName = p.companyName || p.name || '';
        this.bindCompanyStreams(app, app.user.uid);
      } else {
        this.isOwnerView = false;
        const q = email
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
        db.collection('companyAttendance').where('companyUid', '==', companyUid).limit(120).onSnapshot((snap) => {
          this.attendance = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (app.activeTab === 'company' && this.subTab === 'hr') this.rerender();
        }, () => {})
      );

      this.unsubs.push(
        db.collection('companyCustody').where('companyUid', '==', companyUid).limit(60).onSnapshot((snap) => {
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

    // ==================== 1. SEARCH EMPLOYEES & JOIN BY COMPANY CODE ====================
    async searchEmployee() {
      const app = window.DamanApp;
      const q = (document.getElementById('cm-search-input')?.value || '').trim();
      if (!q) return;
      this.foundUser = null;
      try {
        let snap;
        if (q.includes('@')) {
          snap = await app.db.collection('users').where('email', '==', q.toLowerCase()).limit(1).get();
        } else {
          snap = await app.db.collection('users').where('phone', '==', q).limit(1).get();
        }
        if (snap.empty) {
          app.toast('لم يتم العثور على حساب بهذا الرقم أو الإيميل — يمكنك إضافته مباشرة بالأسفل', 'info');
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
          roleTitle: document.getElementById('join-comp-role').value.trim() || 'موظف / مهندس',
          permissions: ['chat_clients', 'view_contracts'],
          monthlySalary: 0,
          workDaysPerMonth: 26,
          overtimeRate: 0,
          absencePenalty: 0,
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

      const perms = [];
      if (document.getElementById('perm-post')?.checked) perms.push('post_projects');
      if (document.getElementById('perm-bid')?.checked) perms.push('submit_bids');
      if (document.getElementById('perm-chat')?.checked) perms.push('chat_clients');
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
          workDaysPerMonth: 26,
          overtimeRate: Math.round((monthlySalary / 26 / 8) * 1.5) || 50,
          absencePenalty: Math.round(monthlySalary / 26) || 0,
          deductions: 0,
          rating: 5,
          ratingNote: '',
          status: 'active',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (this.foundUser?.id) {
          await app.sendNotification(this.foundUser.id, `تم إضافتك لفريق ${app.profile.companyName || app.profile.name}`, `المسمى الوظيفي: ${roleTitle} — افتح لوحة الشركات وHR الآن.`);
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
        if (memberUid) await app.sendNotification(memberUid, 'تحديث صلاحيات الشركة', status === 'active' ? 'تم تفعيل صلاحياتك في الشركة' : 'تم إيقاف صلاحياتك مؤقتاً');
        app.toast('تم التحديث', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async editSalaryAndRating(docId) {
      const app = window.DamanApp;
      const m = this.members.find((x) => x.id === docId);
      if (!m) return;
      const sal = parseFloat(window.prompt('الراتب الشهري الأساسي (ج.م):', m.monthlySalary || 0));
      if (isNaN(sal)) return;
      const ded = parseFloat(window.prompt('إجمالي الخصومات / السُلف هذا الشهر (ج.م):', m.deductions || 0)) || 0;
      const rat = Math.min(5, Math.max(1, parseInt(window.prompt('تقييم الموظف (من 1 إلى 5 نجوم):', m.rating || 5), 10) || 5));
      const note = window.prompt('ملاحظة التقييم:', m.ratingNote || '') || '';
      try {
        await app.db.collection('companyMembers').doc(docId).update({
          monthlySalary: sal,
          absencePenalty: Math.round(sal / (m.workDaysPerMonth || 26)),
          deductions: ded,
          rating: rat,
          ratingNote: note
        });
        app.toast('تم تحديث الراتب والتقييم بنجاح', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== 2. HR ATTENDANCE (SELFIE + GPS) & PAYROLL SHEET ====================
    compressSelfie(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Read error'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Image error'));
          img.onload = () => {
            const maxW = 420;
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', 0.5));
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
      app.toast('جارٍ تسجيل السيلفي واللوكيشن (GPS)...', 'info');

      try {
        const selfieBase64 = await this.compressSelfie(file);
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
            date: dateStr,
            checkInTime: timeStr,
            checkInMs: Date.now(),
            checkInSelfie: selfieBase64,
            checkInLoc: pos,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          await app.sendNotification(this.activeCompanyUid, 'تسجيل حضور موظف', `${app.profile.name} سجّل حضوره الساعة ${timeStr}`);
          app.toast(`تم تسجيل الحضور الساعة ${timeStr} بنجاح`, 'success');
        } else {
          const inMs = existing.exists ? existing.data().checkInMs : Date.now();
          const hours = Math.max(0.5, Math.round(((Date.now() - inMs) / 3600000) * 10) / 10);
          await ref.set({
            companyUid: this.activeCompanyUid,
            memberUid: app.user.uid,
            memberName: app.profile.name || '',
            date: dateStr,
            checkOutTime: timeStr,
            checkOutSelfie: selfieBase64,
            checkOutLoc: pos,
            hoursWorked: hours
          }, { merge: true });
          await app.sendNotification(this.activeCompanyUid, 'تسجيل انصراف موظف', `${app.profile.name} انصرف الساعة ${timeStr} (${hours} ساعة)`);
          app.toast(`تم تسجيل الانصراف (${hours} ساعة عمل) بنجاح`, 'success');
        }
      } catch (err) { app.toast(err.message, 'error'); }
      input.value = '';
    },

    calcPayrollRow(m) {
      const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
      const recs = this.attendance.filter((a) => (a.memberUid === m.memberUid || a.memberName === m.memberName) && (a.date || '').startsWith(monthPrefix));
      const daysPresent = recs.length;
      const totalHours = Math.round(recs.reduce((s, r) => s + Number(r.hoursWorked || 8), 0) * 10) / 10;
      const targetDays = Number(m.workDaysPerMonth || 26);
      const dayOfMonth = Math.min(targetDays, new Date().getDate());
      const daysAbsent = Math.max(0, dayOfMonth - daysPresent);
      const base = Number(m.monthlySalary || 0);
      const dailyVal = targetDays > 0 ? base / targetDays : 0;
      const earned = Math.round(daysPresent * dailyVal);
      const netSalary = Math.max(0, Math.round(earned - Number(m.deductions || 0)));
      return { daysPresent, daysAbsent, totalHours, base, earned, netSalary };
    },

    printHrPayrollA4() {
      const app = window.DamanApp;
      const activeMembers = this.members.filter((m) => m.status === 'active');
      if (!activeMembers.length) return app.toast('لا يوجد موظفون نشطون للطباعة', 'warning');
      const monthStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });

      const rows = activeMembers.map((m, i) => {
        const p = this.calcPayrollRow(m);
        return `<tr><td>${i + 1}</td><td><b>${app.esc(m.memberName)}</b><br/><small>${app.esc(m.roleTitle)}</small></td><td>${app.fmtMoney(p.base)} ج.م</td><td>${p.daysPresent} يوم</td><td>${p.daysAbsent} يوم</td><td>${p.totalHours} س</td><td>-${app.fmtMoney(m.deductions || 0)}</td><td>${m.rating || 5} / 5</td><td><b>${app.fmtMoney(p.netSalary)} ج.م</b></td></tr>`;
      }).join('');

      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>شيت الحضور والرواتب — ${app.esc(this.activeCompanyName)}</title><style>@page{size:A4 landscape;margin:12mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11px;}.sheet{border:2px solid #000;padding:14px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:5px;text-align:right;}th{background:#f0f0f0;}.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px;text-align:center;}.sig{border:1px solid #000;padding:8px 6px 36px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة / حفظ شيت الرواتب PDF (A4)</button><div class="sheet"><div class="hdr"><div><h2 style="margin:0">كشف الحضور والانصراف وحسبة الرواتب (HR)</h2><div>الشركة: <b>${app.esc(this.activeCompanyName)}</b></div></div><div><div><b>الشهر:</b> ${monthStr}</div><div>منصة ضمان سايت | DamanSite</div></div></div><table><thead><tr><th>#</th><th>الموظف والوظيفة</th><th>الأساسي</th><th>أيام الحضور</th><th>الغياب</th><th>الساعات</th><th>خصومات/سُلف</th><th>التقييم</th><th>صافي المستحق</th></tr></thead><tbody>${rows}</tbody></table><div class="sigs"><div class="sig">إعداد الـ HR</div><div class="sig">المدير المالي</div><div class="sig">اعتماد مدير الشركة</div></div></div></body></html>`);
      win.document.close();
    },

    // ==================== 3. CUSTODY (العُهد) & LEAVES (الإجازات) & GROUP CHAT ====================
    async addCustodyItem(e) {
      e.preventDefault();
      const app = window.DamanApp;
      try {
        await app.db.collection('companyCustody').add({
          companyUid: this.activeCompanyUid,
          byName: app.profile.name || '',
          kind: document.getElementById('cus-kind').value, // custody | expense
          amount: parseFloat(document.getElementById('cus-amt').value) || 0,
          notes: document.getElementById('cus-notes').value.trim(),
          date: new Date().toISOString().slice(0, 10),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast('تم تسجيل العهدة / المصروف بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
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
        if (memberUid) await app.sendNotification(memberUid, 'رد الشركة على طلب الإجازة', status === 'approved' ? 'تمت الموافقة على طلبك' : 'تم رفض طلب الإجازة');
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

      return `
        <div class="space-y-3.5">
          ${this.isOwnerView ? `
            <div class="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-xs">
              <div>
                <div class="text-[10px] text-slate-400">كود دعوة الشركة (أعطه لموظفيك للانضمام):</div>
                <div class="text-sm font-black text-sky-300 tracking-widest">${app.esc(p.companyCode || 'CMP-' + app.user.uid.slice(0, 4).toUpperCase())}</div>
              </div>
              <button onclick="DamanWallet.copyText('${app.esc(p.companyCode || '')}','كود الشركة')" class="px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px]">نسخ الكود</button>
            </div>

            ${!unlocked ? `
              <div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-[11px] text-rose-200 space-y-1">
                <div class="font-black text-rose-300"><i class="fa-solid fa-lock me-1"></i> لفتح إضافة الموظفين (Access):</div>
                <div>• ${check.isVerified ? '✅ تم توثيق الشركة' : '❌ وثّق الشركة بالسجل التجاري والبطاقة الضريبية من المحفظة'}</div>
                <div>• ${check.hasBalanceOrPlan ? '✅ الرصيد/الباقة مفعّلة' : `❌ اشحن رصيدك (${check.minBal} ج.م على الأقل) أو فعّل باقة الشركات`}</div>
              </div>` : `
              <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-sky-500/30">
                <div class="flex gap-1.5">
                  <input id="cm-search-input" type="text" placeholder="ابحث عن موظف برقم الموبايل أو الجيميل..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
                  <button type="button" onclick="DamanCompany.searchEmployee()" class="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">بحث</button>
                </div>
                <form onsubmit="DamanCompany.addTeamMember(event)" class="space-y-2">
                  <div class="grid grid-cols-2 gap-2">
                    <input id="cm-name" type="text" required value="${app.esc(this.foundUser?.name || '')}" placeholder="اسم الموظف / المهندس" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
                    <input id="cm-role" type="text" required placeholder="الوظيفة (مهندس موقع)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <input id="cm-phone" type="tel" required value="${app.esc(this.foundUser?.phone || '')}" placeholder="رقم الموبايل" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
                    <input id="cm-email" type="email" value="${app.esc(this.foundUser?.email || '')}" placeholder="الإيميل (اختياري)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
                  </div>
                  <input id="cm-salary" type="number" min="0" placeholder="الراتب الشهري الأساسي (ج.م) لحسبة الـ HR" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs text-white font-bold" />
                  <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                    <label><input id="perm-post" type="checkbox" checked class="accent-sky-500 me-1" />نشر مشاريع</label>
                    <label><input id="perm-bid" type="checkbox" checked class="accent-sky-500 me-1" />تقديم عروض</label>
                    <label><input id="perm-chat" type="checkbox" checked class="accent-sky-500 me-1" />دردشة العملاء</label>
                    <label><input id="perm-vip" type="checkbox" checked class="accent-sky-500 me-1" />طلب عمالة VIP</label>
                  </div>
                  <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">إضافة الموظف ومنح الصلاحيات</button>
                </form>
              </div>`}` : ''}

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-white">أعضاء فريق الشركة (${this.members.length})</h4>
            ${this.members.map((m) => `
              <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-extrabold text-white">${app.esc(m.memberName)} <span class="text-[10px] text-sky-400">(${app.esc(m.roleTitle)})</span></div>
                    <div class="text-[10px] text-slate-400">${app.esc(m.memberPhone || '')} | راتب: ${app.fmtMoney(m.monthlySalary)} ج.م | ★ ${m.rating || 5}</div>
                  </div>
                  <span class="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">${app.esc(m.status)}</span>
                </div>
                ${this.isOwnerView ? `
                  <div class="flex gap-1.5 pt-1">
                    ${m.status === 'pending' ? `<button onclick="DamanCompany.updateMemberStatus('${m.id}','${m.memberUid}','active')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">قبول الانضمام</button>` : ''}
                    <button onclick="DamanCompany.editSalaryAndRating('${m.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">الراتب والتقييم</button>
                    <button onclick="DamanCompany.updateMemberStatus('${m.id}','${m.memberUid}','${m.status === 'active' ? 'suspended' : 'active'}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px]">${m.status === 'active' ? 'إيقاف' : 'تفعيل'}</button>
                  </div>` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    },

    renderHrTab(app) {
      const activeMembers = this.members.filter((m) => m.status === 'active');
      return `
        <div class="space-y-3.5">
          <!-- Employee Check-In / Check-Out with Selfie + GPS -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-emerald-500/40">
            <div class="text-xs font-black text-emerald-400"><i class="fa-solid fa-camera-retro me-1"></i> تسجيل الحضور والانصراف اليومي (سيلفي + لوكيشن GPS)</div>
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

          ${this.isOwnerView ? `
            <div class="glass-card rounded-2xl p-3.5 space-y-2.5">
              <div class="flex items-center justify-between">
                <h4 class="text-xs font-black text-amber-400"><i class="fa-solid fa-file-invoice-dollar me-1"></i> شيت الرواتب والحضور (الشهر الحالي)</h4>
                <button onclick="DamanCompany.printHrPayrollA4()" class="px-2.5 py-1.5 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>شيت A4 PDF</button>
              </div>
              ${activeMembers.map((m) => {
                const pr = this.calcPayrollRow(m);
                return `
                  <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-1">
                    <div class="flex justify-between font-extrabold"><span class="text-white">${app.esc(m.memberName)}</span><span class="text-emerald-400">صافي: ${app.fmtMoney(pr.netSalary)} ج.م</span></div>
                    <div class="text-[10px] text-slate-400">حضور: ${pr.daysPresent} يوم | غياب: ${pr.daysAbsent} يوم | ساعات: ${pr.totalHours} س | خصومات: ${app.fmtMoney(m.deductions || 0)}</div>
                  </div>`;
              }).join('')}
            </div>` : ''}

          <div class="glass-card rounded-2xl p-3.5 space-y-2">
            <h4 class="text-xs font-extrabold text-white">سجل الحضور الأخير (بالسيلفي واللوكيشن)</h4>
            ${!this.attendance.length ? '<div class="text-xs text-slate-400 text-center py-3">لا يوجد سجل حضور بعد</div>' : this.attendance.slice(0, 15).map((a) => `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  ${a.checkInSelfie ? `<img src="${a.checkInSelfie}" class="w-10 h-10 rounded-lg object-cover border border-emerald-500/40 shrink-0" />` : ''}
                  <div class="min-w-0">
                    <div class="font-bold text-white truncate">${app.esc(a.memberName)} — ${app.esc(a.date)}</div>
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
          <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><div class="text-slate-400">إجمالي العُهد</div><div class="text-xs font-black text-emerald-400">${app.fmtMoney(totalIn)}</div></div>
            <div class="p-2 rounded-xl bg-slate-900 border border-slate-800"><div class="text-slate-400">المصاريف</div><div class="text-xs font-black text-rose-400">${app.fmtMoney(totalOut)}</div></div>
            <div class="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40"><div class="text-amber-200">المتبقي</div><div class="text-xs font-black text-amber-300">${app.fmtMoney(totalIn - totalOut)}</div></div>
          </div>
          <form onsubmit="DamanCompany.addCustodyItem(event)" class="glass-card rounded-2xl p-3 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <select id="cus-kind" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"><option value="custody">استلام عُهدة (+)</option><option value="expense">مصروف موقع (-)</option></select>
              <input id="cus-amt" type="number" min="1" required placeholder="المبلغ (ج.م)" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-white font-bold" />
            </div>
            <input id="cus-notes" type="text" required placeholder="البيان (مثلاً: عهدة م. أحمد / شراء مسامير)" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل في سجل العُهد</button>
          </form>
          ${this.custodyList.map((c) => `
            <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex justify-between text-xs">
              <div><div class="font-bold text-white">${app.esc(c.notes)}</div><div class="text-[10px] text-slate-400">${app.esc(c.byName)} • ${app.esc(c.date)}</div></div>
              <span class="font-black ${c.kind === 'custody' ? 'text-emerald-400' : 'text-rose-400'}">${c.kind === 'custody' ? '+' : '-'}${app.fmtMoney(c.amount)}</span>
            </div>`).join('')}
        </div>`;
    },

    renderLeavesTab(app) {
      return `
        <div class="space-y-3">
          <form onsubmit="DamanCompany.submitLeave(event)" class="glass-card rounded-2xl p-3 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <select id="lv-type" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"><option value="إجازة يوم">إجازة يوم</option><option value="إذن تأخير / انصراف">إذن تأخير / انصراف</option><option value="إجازة مرضي">إجازة مرضي</option></select>
              <input id="lv-date" type="date" required value="${new Date().toISOString().slice(0, 10)}" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <input id="lv-reason" type="text" required placeholder="السبب..." class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">تقديم طلب إجازة / إذن</button>
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
              <p class="text-[11px] text-slate-400">أدخل كود الشركة اللي أخدته من مديرك عشان تسجّل حضورك وانصرافك وتشتغل مع الفريق.</p>
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
              <div class="text-[10px] text-sky-300">${this.isOwnerView ? 'وضع مدير الشركة (تحكم كامل)' : 'وضع موظف / مهندس بالفريق'}</div>
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
