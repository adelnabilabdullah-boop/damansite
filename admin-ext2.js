(function () {
  const AdminExt2 = {
    // ==================== 1. COMPANIES 360° CONTROL ====================
    async toggleCompanyStatus(compId, curSt) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const comp = this.companies.find((c) => c.id === compId);
      const next = curSt === 'suspended' ? 'active' : 'suspended';
      await app.db.collection('companies').doc(compId).update({ status: next });
      await app.logAudit('company_status', `${comp?.name || compId} → ${next}`, compId);
      if (comp && comp.ownerId) {
        await app.sendNotification(
          comp.ownerId,
          next === 'suspended' ? '⚠️ تم إيقاف لوحة شركتك مؤقتاً' : '✅ تم إعادة تفعيل لوحة شركتك',
          `الشركة: ${comp.name}`
        );
      }
      app.toast(next === 'suspended' ? 'تم إيقاف الشركة مؤقتاً' : 'تم تفعيل الشركة ✅', 'info');
      this.loadTabData('companies');
    },

    async openCompanyControlModal(compId) {
      const app = window.DamanApp;
      let comp = this.companies.find((c) => c.id === compId);
      if (!comp) {
        const s = await app.db.collection('companies').doc(compId).get();
        if (s.exists) comp = Object.assign({ id: s.id }, s.data());
      }
      if (!comp) return;

      let m = document.getElementById('daman-admin-comp-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-admin-comp-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-5 text-center text-xs text-slate-300">جارٍ تحميل بيانات الشركة 360°...</div>`;

      const [memSnap, cusSnap, repSnap, opsSnap] = await Promise.all([
        app.db.collection('companyMembers').where('companyId', '==', compId).limit(100).get(),
        app.db.collection('companyCustody').where('companyId', '==', compId).limit(40).get(),
        app.db.collection('companyDailyReports').where('companyId', '==', compId).limit(20).get(),
        app.db.collection('companyOps').where('companyId', '==', compId).limit(40).get()
      ]);
      const mems = memSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      const custs = cusSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      const reps = repSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      const ops = opsSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-purple-300">👑 ${app.esc(comp.name)}</h3>
            <button onclick="document.getElementById('daman-admin-comp-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${app.isAdmin() ? `
            <form onsubmit="DamanAdmin.saveCompanyMetaEdit(event,'${compId}')" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div class="font-bold text-amber-300">تعديل بيانات الشركة</div>
              <div><label class="text-[9.5px] text-slate-400">اسم الشركة</label><input id="ac-name" type="text" required value="${app.esc(comp.name || '')}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div class="grid grid-cols-2 gap-1.5">
                <div><label class="text-[9.5px] text-slate-400">السجل التجاري</label><input id="ac-cr" type="text" value="${app.esc(comp.commercialReg || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                <div><label class="text-[9.5px] text-slate-400">البطاقة الضريبية</label><input id="ac-tax" type="text" value="${app.esc(comp.taxCard || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
              </div>
              <button type="submit" class="w-full py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black">حفظ بيانات الشركة</button>
            </form>` : ''}

          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            الكود: <b class="text-amber-300">${app.esc(comp.code)}</b> • المالك: <b>${app.esc(comp.ownerName || '—')}</b> • المواقع: <b>${(comp.sites || []).length}</b> • العمليات: <b>${ops.length}</b> • التقارير: <b>${reps.length}</b>
          </div>

          <form onsubmit="DamanAdmin.sendAdminCompanyMsg(event,'${compId}')" class="flex gap-1.5">
            <input id="adm-comp-msg" type="text" required placeholder="إرسال تنبيه رسمي لجروب الشركة..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white" />
            <button type="submit" class="px-3 py-2 rounded-xl bg-purple-500 text-white font-black">إرسال</button>
          </form>

          <div class="font-black text-amber-400">أعضاء الشركة (${mems.length})</div>
          ${mems.map((mem) => `
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div class="flex justify-between">
                <b class="text-white">${app.esc(mem.name)} (${app.esc(mem.jobTitle || '')})</b>
                <span class="text-emerald-400 font-bold">أساسي: ${app.fmtMoney(mem.baseSalary || 0)}</span>
              </div>
              <div class="flex gap-1.5">
                <button onclick="DamanAdmin.adminEditCompMemberSalary('${mem.id}','${compId}','${mem.userId || ''}',${Number(mem.baseSalary || 0)})" class="flex-1 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[10px]">تعديل الراتب</button>
                <button onclick="DamanAdmin.adminToggleCompMember('${mem.id}','${compId}','${mem.userId || ''}','${mem.status || 'active'}')" class="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">${mem.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button>
              </div>
            </div>`).join('') || '<div class="text-center text-slate-500 py-2">لا يوجد أعضاء</div>'}

          <div class="font-black text-sky-400">آخر حركات العهدة (${custs.length}) والتقارير (${reps.length})</div>
          ${custs.slice(0, 6).map((c) => `<div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-[10.5px]"><span>🧾 ${app.esc(c.holderName)}: ${app.esc(c.note)}</span><b class="text-amber-300">${app.fmtMoney(c.amount)} ج.م</b></div>`).join('')}
          ${reps.slice(0, 5).map((r) => `<div class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10.5px]"><b class="text-sky-300">📝 ${app.esc(r.siteName)} (${app.esc(r.date)})</b>: ${app.esc((r.workDone || '').slice(0, 80))}</div>`).join('')}
        </div>`;
    },

    async saveCompanyMetaEdit(e, compId) {
      e.preventDefault();
      await window.DamanApp.db.collection('companies').doc(compId).update({
        name: document.getElementById('ac-name').value.trim(),
        commercialReg: document.getElementById('ac-cr').value.trim(),
        taxCard: document.getElementById('ac-tax').value.trim()
      });
      await window.DamanApp.logAudit('admin_edit_company', `تعديل بيانات الشركة ${compId}`, compId);
      window.DamanApp.toast('تم حفظ بيانات الشركة ✅', 'success');
      this.loadTabData('companies');
      this.openCompanyControlModal(compId);
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

    async adminEditCompMemberSalary(memId, compId, targetUid, curSal) {
      const app = window.DamanApp;
      const nv = parseFloat(window.prompt('الراتب الأساسي الجديد (ج.م):', curSal));
      if (isNaN(nv) || nv < 0) return;
      await app.db.collection('companyMembers').doc(memId).update({ baseSalary: nv });
      if (targetUid) {
        await app.sendNotification(targetUid, '💰 تحديث الراتب الأساسي', `تم تحديث راتبك الأساسي إلى ${app.fmtMoney(nv)} ج.م.`);
      }
      app.toast('تم تحديث الراتب وإرسال إشعار للموظف ✅', 'success');
      this.openCompanyControlModal(compId);
    },

    async adminToggleCompMember(memId, compId, targetUid, curSt) {
      const app = window.DamanApp;
      const next = curSt === 'suspended' ? 'active' : 'suspended';
      await app.db.collection('companyMembers').doc(memId).update({ status: next });
      if (targetUid) {
        await app.sendNotification(targetUid, next === 'suspended' ? '⚠️ تم إيقاف عضويتك بالشركة' : '✅ تم تفعيل عضويتك بالشركة', 'تواصل مع إدارة الشركة للتفاصيل.');
      }
      this.openCompanyControlModal(compId);
    },

    renderCompaniesTab(app) {
      return `
        <div class="space-y-2.5 text-xs">
          <div class="font-black text-sky-400">🏢 السيطرة الشاملة على الشركات (${this.companies.length})</div>
          ${!this.companies.length ? `<div class="glass-card rounded-2xl p-6 text-center text-slate-400">لا توجد شركات مسجّلة بعد.</div>` : this.companies.map((c) => `
            <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 ${c.status === 'suspended' ? 'border-rose-500/50 opacity-75' : ''}">
              <div class="min-w-0">
                <div class="font-black text-white truncate">${app.esc(c.name)} ${c.status === 'suspended' ? '🚫' : ''}</div>
                <div class="text-[10px] text-amber-300">الكود: ${app.esc(c.code)} • ${app.esc(c.ownerName || '')} • مواقع: ${(c.sites || []).length}</div>
              </div>
              <div class="flex gap-1 shrink-0">
                <button onclick="DamanAdmin.openCompanyControlModal('${c.id}')" class="px-2.5 py-1.5 rounded-xl bg-purple-500 text-white font-black text-[10px]">تحكّم 360°</button>
                ${app.isAdmin() ? `<button onclick="DamanAdmin.toggleCompanyStatus('${c.id}','${c.status || 'active'}')" class="px-2 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[10px]">${c.status === 'suspended' ? 'تفعيل' : 'إيقاف'}</button>` : ''}
              </div>
            </div>`).join('')}
        </div>`;
    },

    // ==================== 2. USERS 360° (WITH INSTANT NOTIFICATIONS ON EVERY ACTION) ====================
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
        const [uDoc, kycDoc, txSnap, agSnap, wrSnap] = await Promise.all([
          app.db.collection('users').doc(uid).get(),
          app.db.collection('kycRequests').doc(uid).get().catch(() => null),
          app.db.collection('transactions').where('userId', '==', uid).limit(20).get(),
          app.db.collection('chatAgreements').where('participants', 'array-contains', uid).limit(15).get(),
          app.db.collection('walletRequests').where('userId', '==', uid).limit(15).get()
        ]);
        if (!uDoc.exists) return m.classList.add('hidden');
        const u = Object.assign({ id: uDoc.id }, uDoc.data());
        const kyc = kycDoc && kycDoc.exists ? kycDoc.data() : null;
        const txs = this.sortDesc(txSnap.docs.map((d) => d.data()));
        const ags = this.sortDesc(agSnap.docs.map((d) => d.data()));
        const wrs = this.sortDesc(wrSnap.docs.map((d) => d.data()));

        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-black text-amber-400">🔎 ملف 360°: ${app.esc(u.name)}</h3>
              <button onclick="document.getElementById('daman-user360-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div class="p-1.5 rounded-xl bg-slate-950 border border-emerald-500/40"><div class="text-slate-400">كاش</div><b class="text-emerald-400">${app.fmtMoney(u.balanceAvailable || 0)}</b></div>
              <div class="p-1.5 rounded-xl bg-slate-950 border border-amber-500/40"><div class="text-slate-400">ضمان</div><b class="text-amber-400">${app.fmtMoney(u.balanceEscrow || 0)}</b></div>
              <div class="p-1.5 rounded-xl bg-slate-950 border border-purple-500/40"><div class="text-slate-400">هدايا</div><b class="text-purple-300">${app.fmtMoney(u.balanceBonus || 0)}</b></div>
              <div class="p-1.5 rounded-xl bg-slate-950 border border-rose-500/40"><div class="text-slate-400">مجمّد</div><b class="text-rose-400">${app.fmtMoney(u.balanceFrozen || 0)}</b></div>
            </div>

            ${kyc ? `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-1.5">
                <div class="font-black text-amber-300">🪪 مستندات التوثيق المرفوعة:</div>
                <div class="flex flex-wrap gap-1.5">
                  ${kyc.idFrontMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.idFrontMedia}','وش البطاقة')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">وش البطاقة</button>` : ''}
                  ${kyc.idBackMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.idBackMedia}','ضهر البطاقة')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">ضهر البطاقة</button>` : ''}
                  ${kyc.selfieMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.selfieMedia}','سيلفي')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">سيلفي</button>` : ''}
                  ${kyc.crMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.crMedia}','السجل التجاري')" class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">سجل تجاري</button>` : ''}
                  ${kyc.taxMedia ? `<button onclick="DamanApp.openMediaLightbox('${kyc.taxMedia}','البطاقة الضريبية')" class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">بطاقة ضريبية</button>` : ''}
                </div>
              </div>` : ''}

            ${app.isAdmin() ? `
              <form onsubmit="DamanAdmin.saveUserFullProfileEdit(event,'${uid}')" class="p-3 rounded-2xl bg-slate-950 border border-sky-500/40 space-y-2">
                <div class="font-black text-sky-400">✏️ تعديل كل بيانات المستخدم والبيانات القانونية</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div><label class="text-[9.5px] text-slate-400">اسم العرض</label><input id="ue-name" type="text" value="${app.esc(u.name || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                  <div><label class="text-[9.5px] text-slate-400">رقم الموبايل</label><input id="ue-phone" type="text" value="${app.esc(u.phone || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                  <div><label class="text-[9.5px] text-slate-400">الاسم الرباعي (للعقود)</label><input id="ue-legal" type="text" value="${app.esc(u.legalName || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                  <div><label class="text-[9.5px] text-slate-400">الرقم القومي (14 رقم)</label><input id="ue-nid" type="text" maxlength="14" value="${app.esc(u.nationalId || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-amber-300 font-bold" /></div>
                  <div><label class="text-[9.5px] text-slate-400">تاريخ الميلاد</label><input id="ue-bday" type="date" value="${app.esc(u.birthDate || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                  <div><label class="text-[9.5px] text-slate-400">حالة التوثيق</label>
                    <select id="ue-kyc" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-300 font-bold">
                      <option value="verified" ${u.kycStatus === 'verified' ? 'selected' : ''}>موثّق ✅</option>
                      <option value="pending" ${u.kycStatus === 'pending' ? 'selected' : ''}>قيد المراجعة</option>
                      <option value="rejected" ${u.kycStatus === 'rejected' ? 'selected' : ''}>مرفوض</option>
                      <option value="none" ${!u.kycStatus || u.kycStatus === 'none' ? 'selected' : ''}>غير موثّق</option>
                    </select>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div><label class="text-[9.5px] text-slate-400">نوع الحساب</label>
                    <select id="ue-type" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold">
                      <option value="individual" ${u.accountType === 'individual' ? 'selected' : ''}>فرد / مقاول</option>
                      <option value="company" ${u.accountType === 'company' ? 'selected' : ''}>شركة مقاولات</option>
                      <option value="supplier" ${u.accountType === 'supplier' ? 'selected' : ''}>مورّد B2B</option>
                    </select>
                  </div>
                  <div><label class="text-[9.5px] text-slate-400">العنوان بالبطاقة</label><input id="ue-addr" type="text" value="${app.esc(u.legalAddress || '')}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                </div>
                <button type="submit" class="w-full py-2 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ تعديلات البيانات</button>
              </form>

              <form onsubmit="DamanAdmin.applyManualBalance(event,'${uid}')" class="p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2">
                <div class="font-black text-emerald-400">💰 تعديل / خصم / تجميد رصيد (بقيد مزدوج + إشعار فوري)</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div><label class="text-[9.5px] text-slate-400">نوع العملية</label>
                    <select id="mb-mode" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-[10px]">
                      <option value="bonus_add">+ إضافة رصيد هدايا (غير نقدي)</option>
                      <option value="cash_gift">+ إضافة كاش (من أرباح الإدارة)</option>
                      <option value="cash_vf">+ إيداع كاش يدوي (محفظة كاش)</option>
                      <option value="cash_ip">+ إيداع كاش يدوي (إنستا باي)</option>
                      <option value="cash_bk">+ إيداع كاش يدوي (البنك)</option>
                      <option value="cash_deduct">- خصم من الكاش (لخزنة الأرباح)</option>
                      <option value="freeze">🔒 تجميد مبلغ من المتاح</option>
                      <option value="unfreeze">🔓 فك تجميد وإرجاع للمتاح</option>
                    </select>
                  </div>
                  <div><label class="text-[9.5px] text-slate-400">المبلغ (ج.م)</label><input id="mb-amt" type="number" min="1" step="any" required placeholder="0" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-white font-black" /></div>
                </div>
                <input id="mb-note" type="text" required placeholder="السبب (يظهر للمستخدم في الإشعار وكشف الحساب)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                <button type="submit" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">تنفيذ القيد وإرسال إشعار</button>
              </form>

              <form onsubmit="DamanAdmin.saveUserGodSettings(event,'${uid}')" class="p-3 rounded-2xl bg-slate-950 border border-purple-500/40 space-y-2">
                <div class="font-black text-purple-300">👑 عمولة مخصصة + باقة VIP + ملاحظة سرية</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div><label class="block text-[9.5px] text-slate-400">عمولة مخصصة % (فارغ = افتراضي)</label><input id="u3-comm" type="number" step="0.1" value="${u.customCommissionRate != null && u.customCommissionRate !== '' ? (Number(u.customCommissionRate) * 100).toFixed(2) : ''}" placeholder="مثال: 2" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                  <div><label class="block text-[9.5px] text-slate-400">منح أيام VIP إضافية (0 بدون)</label><input id="u3-vip" type="number" min="0" value="0" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                </div>
                <input id="u3-crm" type="text" value="${app.esc(u.adminCrmNote || '')}" placeholder="ملاحظة سرية للإدارة فقط (لا يراها المستخدم)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-200" />
                <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">حفظ إعدادات الحساب</button>
              </form>` : ''}

            <div class="grid grid-cols-3 gap-1.5">
              <button onclick="DamanAdmin.sendDirectNotif('${uid}','${app.esc(u.name).replace(/'/g, "\\'")}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-[10px]">🔔 إشعار خاص</button>
              <button onclick="DamanAdmin.revokeUserKyc('${uid}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[10px]">إلغاء التوثيق</button>
              <button onclick="DamanAdmin.toggleBanUser('${uid}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">${u.status === 'banned' ? 'فك الحظر' : 'حظر'}</button>
            </div>

            <div class="font-bold text-slate-300">عقوده (${ags.length}) | طلباته (${wrs.length}) | حركاته (${txs.length})</div>
            <div class="space-y-1 max-h-40 overflow-y-auto">
              ${ags.map((a) => `<div class="p-1.5 rounded bg-slate-950 text-[10px] flex justify-between"><span>📄 ${app.esc(a.ticketNumber)} — ${app.esc(a.title)}</span><b class="text-amber-300">${app.fmtMoney(a.totalAmount)} (${this.statusAr(a.status)})</b></div>`).join('')}
              ${wrs.map((w) => `<div class="p-1.5 rounded bg-slate-950 text-[10px] flex justify-between"><span>${w.type === 'deposit' ? '⬇️ شحن' : '⬆️ سحب'} ${app.esc(w.date)}</span><b class="text-sky-300">${app.fmtMoney(w.actualAmount || w.amount)} (${this.statusAr(w.status)})</b></div>`).join('')}
              ${txs.slice(0, 10).map((t) => `<div class="p-1.5 rounded bg-slate-950 text-[10px] flex justify-between"><span>${app.esc(t.date)} ${app.esc(t.note || t.type)}</span><b class="${Number(t.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${app.fmtMoney(t.amount)}</b></div>`).join('')}
            </div>
          </div>`;
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async saveUserFullProfileEdit(e, uid) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const patch = {
        name: document.getElementById('ue-name').value.trim(),
        phone: app.normalizePhone(document.getElementById('ue-phone').value),
        legalName: document.getElementById('ue-legal').value.trim(),
        nationalId: document.getElementById('ue-nid').value.replace(/\D/g, ''),
        birthDate: document.getElementById('ue-bday').value,
        kycStatus: document.getElementById('ue-kyc').value,
        accountType: document.getElementById('ue-type').value,
        legalAddress: document.getElementById('ue-addr').value.trim()
      };
      await app.db.collection('users').doc(uid).update(patch);
      await app.logAudit('admin_edit_user', `تعديل بيانات المستخدم ${patch.name} (توثيق=${patch.kycStatus})`, uid);
      await app.sendNotification(uid, '📝 تحديث بيانات حسابك من الإدارة', `تم تحديث بياناتك وحالة التوثيق (${this.statusAr(patch.kycStatus)}).`);
      app.toast('تم حفظ بيانات المستخدم وإرسال إشعار ✅', 'success');
      this.openUser360Modal(uid);
      if (this.subTab === 'users') this.loadTabData('users');
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
      const notifTitles = {
        bonus_add: `🎁 تمت إضافة ${app.fmtMoney(amt)} ج.م لرصيد الهدايا`,
        cash_gift: `💰 تمت إضافة ${app.fmtMoney(amt)} ج.م لرصيدك المتاح`,
        cash_vf: `✅ إيداع معتمد (${app.fmtMoney(amt)} ج.م — محفظة كاش)`,
        cash_ip: `✅ إيداع معتمد (${app.fmtMoney(amt)} ج.م — إنستا باي)`,
        cash_bk: `✅ إيداع معتمد (${app.fmtMoney(amt)} ج.م — تحويل بنكي)`,
        cash_deduct: `⚠️ خصم إداري بمبلغ ${app.fmtMoney(amt)} ج.م من محفظتك`,
        freeze: `🔒 تم تجميد مبلغ ${app.fmtMoney(amt)} ج.م مؤقتاً من الإدارة`,
        unfreeze: `🔓 تم فك تجميد مبلغ ${app.fmtMoney(amt)} ج.م وردّه لرصيدك المتاح`
      };

      try {
        await app.db.runTransaction(async (tx) => {
          const u = (await tx.get(uRef)).data() || {};
          const curA = Number(u.balanceAvailable || 0);
          const curB = Number(u.balanceBonus || 0);
          const curF = Number(u.balanceFrozen || 0);

          if (mode === 'bonus_add') {
            const afterB = Math.round((curB + amt) * 100) / 100;
            tx.update(uRef, { balanceBonus: afterB });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_bonus', isBonus: true, amount: amt, balanceBefore: curB, balanceAfter: afterB, note: `هدية من الإدارة: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'cash_gift') {
            const afterA = Math.round((curA + amt) * 100) / 100;
            tx.update(uRef, { balanceAvailable: afterA });
            tx.set(app.db.collection('adminExpenses').doc(), { amount: amt, category: 'user_gift', channel: 'none', note: `تعويض/هدية كاش إلى ${u.name}: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_gift', amount: amt, balanceBefore: curA, balanceAfter: afterA, note: `إضافة من الإدارة: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'cash_deduct') {
            if (curA < amt) throw new Error('الرصيد المتاح لا يكفي للخصم');
            const afterA = Math.round((curA - amt) * 100) / 100;
            tx.update(uRef, { balanceAvailable: afterA });
            tx.set(app.db.collection('platformFees').doc(), { type: 'admin_adjustment', userId: uid, userName: u.name || '', amount: amt, cashPaid: amt, bonusUsed: 0, note, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_deduct', amount: -amt, balanceBefore: curA, balanceAfter: afterA, note: `خصم إداري: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode.startsWith('cash_')) {
            const ch = mode === 'cash_vf' ? 'vodafone_cash' : mode === 'cash_ip' ? 'instapay' : 'bank';
            const afterA = Math.round((curA + amt) * 100) / 100;
            tx.update(uRef, { balanceAvailable: afterA });
            tx.set(app.db.collection('walletRequests').doc(), { type: 'deposit', userId: uid, userName: u.name || '', channel: ch, amount: amt, actualAmount: amt, txRef: 'MANUAL-' + Date.now(), adminNote: note, status: 'approved', date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'deposit_approved', amount: amt, balanceBefore: curA, balanceAfter: afterA, note: `شحن يدوي معتمد (${this.channelAr(ch)}): ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'freeze') {
            if (curA < amt) throw new Error('الرصيد المتاح لا يكفي للتجميد');
            const afterA = Math.round((curA - amt) * 100) / 100;
            tx.update(uRef, { balanceAvailable: afterA, balanceFrozen: Math.round((curF + amt) * 100) / 100, frozenReason: note });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_freeze', amount: -amt, balanceBefore: curA, balanceAfter: afterA, note: `تجميد إداري: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          } else if (mode === 'unfreeze') {
            if (curF < amt) throw new Error('المبلغ المجمّد أقل من ذلك');
            const afterA = Math.round((curA + amt) * 100) / 100;
            const remFrz = Math.max(0, Math.round((curF - amt) * 100) / 100);
            tx.update(uRef, { balanceAvailable: afterA, balanceFrozen: remFrz, frozenReason: remFrz > 0 ? u.frozenReason : '' });
            tx.set(app.db.collection('transactions').doc(), { userId: uid, type: 'admin_unfreeze', amount: amt, balanceBefore: curA, balanceAfter: afterA, note: `فك تجميد: ${note}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          }
        });
        await app.logAudit('manual_balance', `${mode} بمبلغ ${amt} ج.م: ${note}`, uid);
        await app.sendNotification(uid, notifTitles[mode] || 'تحديث مالي من الإدارة', note);
        app.toast('تم تنفيذ القيد المالي وإرسال إشعار للمستخدم ✅', 'success');
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
        const curExp = Number(((await app.db.collection('users').doc(uid).get()).data() || {}).subscriptionExpiresAt || 0);
        patch.subscriptionExpiresAt = Math.max(Date.now(), curExp) + vipDays * 86400000;
      }
      await app.db.collection('users').doc(uid).update(patch);
      await app.logAudit('user_god_settings', `عمولة=${commRaw || 'افتراضي'} | VIP=+${vipDays}ي`, uid);
      if (vipDays > 0 || commRaw !== '') {
        const parts = [];
        if (vipDays > 0) parts.push(`تم منحك ${vipDays} يوم باقة VIP مجاناً ★`);
        if (commRaw !== '') parts.push(`تم تخصيص عمولة ضمان خاصة بحسابك (${commRaw}%)`);
        await app.sendNotification(uid, '👑 ترقية مميزة من إدارة ضمان سايت', parts.join(' — '));
      }
      app.toast('تم حفظ إعدادات الحساب ✅', 'success');
      this.openUser360Modal(uid);
    },

    async sendDirectNotif(uid, name) {
      const title = window.prompt(`إشعار خاص إلى ${name} — العنوان:`, 'رسالة من إدارة ضمان سايت');
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

    async sendBirthdayGift(uid, userName) {
      const app = window.DamanApp;
      const amt = parseFloat(window.prompt(`🎂 هدية عيد ميلاد (رصيد هدايا للباقات والتمييز) إلى ${userName} (0 للتهنئة فقط):`, '50'));
      if (isNaN(amt) || amt < 0) return;
      if (amt > 0) {
        const uRef = app.db.collection('users').doc(uid);
        await app.db.runTransaction(async (tx) => {
          const curB = Number(((await tx.get(uRef)).data() || {}).balanceBonus || 0);
          tx.update(uRef, { balanceBonus: Math.round((curB + amt) * 100) / 100 });
          tx.set(app.db.collection('transactions').doc(), {
            userId: uid, type: 'birthday_gift', isBonus: true, amount: amt,
            note: '🎂 هدية عيد ميلاد من إدارة ضمان سايت', date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
      }
      await app.sendNotification(uid, `🎂 كل سنة وأنت طيب يا ${userName}!`, amt > 0 ? `أهدتك الإدارة ${app.fmtMoney(amt)} ج.م في رصيد الهدايا 🎉` : 'كل عام وأنت بخير 🎉');
      app.toast('تم إرسال هدية وإشعار عيد الميلاد 🎂', 'success');
    },

    async sendBroadcastNotification(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const seg = document.getElementById('bc-seg').value;
      const title = document.getElementById('bc-title').value.trim();
      const body = document.getElementById('bc-body').value.trim();
      if (!title || !body) return;
      const targets = this.users.filter((u) => seg === 'all' || u.accountType === seg);
      if (!window.confirm(`إرسال هذا الإشعار الجماعي إلى ${targets.length} مستخدم؟`)) return;
      app.toast(`جارٍ الإرسال إلى ${targets.length} مستخدم...`, 'info');
      await Promise.all(targets.map((u) => app.sendNotification(u.id, title, body)));
      await app.logAudit('broadcast', `فئة ${seg} (${targets.length}): ${title}`);
      e.target.reset();
      app.toast(`تم الإرسال الجماعي إلى ${targets.length} مستخدم 📢`, 'success');
    },

    async toggleBanUser(uid) {
      const app = window.DamanApp;
      const u = this.users.find((x) => x.id === uid) || (await app.db.collection('users').doc(uid).get()).data();
      if (!u || (u.email || '').toLowerCase() === app.ADMIN_EMAIL) return;
      const ban = u.status !== 'banned';
      const reason = ban ? (window.prompt('سبب الحظر:', 'مخالفة شروط ضمان سايت') || 'مخالفة') : '';
      await app.db.collection('users').doc(uid).update({ status: ban ? 'banned' : 'active', banReason: reason });
      await app.logAudit(ban ? 'user_ban' : 'user_unban', `${u.name}: ${reason}`, uid);
      await app.sendNotification(uid, ban ? '🚫 تم إيقاف حسابك' : '✅ تم إعادة تفعيل حسابك', ban ? reason : 'يمكنك استخدام المنصة الآن.');
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
        expiresAt: Date.now() + 30 * 86400000,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      window.DamanApp.toast(`تم إنشاء الكود ${code} (رصيد هدايا) 🎁`, 'success');
      this.loadTabData('users');
    },

    async togglePromoCode(code, curActive) {
      await window.DamanApp.db.collection('promoCodes').doc(code).update({ active: !curActive });
      this.loadTabData('users');
    },

    async deletePromoCode(code) {
      if (!window.confirm(`حذف كود الهدية ${code}؟`)) return;
      await window.DamanApp.db.collection('promoCodes').doc(code).delete();
      this.loadTabData('users');
    },

    async resolveReport(id, st) {
      await window.DamanApp.db.collection('reports').doc(id).update({ status: st });
      this.loadTabData('users');
    },

    renderUsersTab(app) {
      const todayMD = app.todayLocal().slice(5, 10);
      const bdays = this.users.filter((u) => u.birthDate && String(u.birthDate).slice(5, 10) === todayMD);
      const q = app.normalizeAr(this.userSearch);
      const filtered = this.users.filter((u) => !q || app.normalizeAr(`${u.name} ${u.legalName} ${u.phone} ${u.nationalId} ${u.email}`).includes(q));
      const openReports = this.reports.filter((r) => r.status === 'open');

      return `
        <div class="space-y-3 text-xs">
          ${app.isAdmin() ? `
            <form onsubmit="DamanAdmin.sendBroadcastNotification(event)" class="glass-card rounded-2xl p-3.5 space-y-2 border-purple-500/40">
              <div class="font-black text-purple-300">📣 إرسال إشعار جماعي فوري (Broadcast)</div>
              <div class="grid grid-cols-2 gap-1.5">
                <div><label class="text-[9.5px] text-slate-400">الفئة المستهدفة</label><select id="bc-seg" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold"><option value="all">كل المستخدمين (${this.users.length})</option><option value="company">الشركات فقط</option><option value="supplier">الموردين B2B فقط</option><option value="individual">الأفراد والمقاولين</option></select></div>
                <div><label class="text-[9.5px] text-slate-400">عنوان الإشعار</label><input id="bc-title" type="text" required placeholder="العنوان" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              </div>
              <input id="bc-body" type="text" required placeholder="نص الرسالة الجماعية..." class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" />
              <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">إرسال الإشعار الجماعي</button>
            </form>` : ''}

          <div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-2">
            <div class="font-black text-amber-300">🎂 أعياد ميلاد اليوم (${bdays.length})</div>
            ${!bdays.length ? `<div class="text-[10.5px] text-slate-400">لا يوجد أعياد ميلاد اليوم.</div>` : bdays.map((u) => `<div class="flex items-center justify-between bg-slate-950/70 p-2 rounded-xl"><b class="text-white">${app.esc(u.legalName || u.name)}</b><button onclick="DamanAdmin.sendBirthdayGift('${u.id}','${app.esc(u.name || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">🎁 إرسال هدية</button></div>`).join('')}
          </div>

          ${openReports.length ? `<div class="space-y-1.5"><div class="font-black text-rose-400">🚨 بلاغات مفتوحة (${openReports.length})</div>${openReports.map((r) => `<div class="glass-card rounded-xl p-2.5 border-rose-500/40 flex justify-between items-center gap-2"><span class="text-white">${app.esc(r.targetTitle)} — ${app.esc(r.reason)}</span><button onclick="DamanAdmin.resolveReport('${r.id}','closed')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 font-bold text-[10px] shrink-0">إغلاق</button></div>`).join('')}</div>` : ''}

          <input type="text" value="${app.esc(this.userSearch)}" oninput="DamanAdmin.userSearch=this.value; DamanAdmin.rerender()" placeholder="بحث بالاسم / القومي / الموبايل / الإيميل..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          ${filtered.map((u) => `
            <div class="glass-card rounded-2xl p-3 space-y-1">
              <div class="flex justify-between"><b class="text-white">${app.esc(u.name)} ${u.kycStatus === 'verified' ? '✅' : ''} ${u.status === 'banned' ? '🚫' : ''}</b><span class="text-emerald-400 font-bold">كاش: ${app.fmtMoney(u.balanceAvailable || 0)} | ضمان: ${app.fmtMoney(u.balanceEscrow || 0)}</span></div>
              <div class="text-[10px] text-slate-400">${app.esc(u.phone || '')} • ${app.esc(u.email || '')} • قومي: ${app.esc(u.nationalId || '—')}</div>
              ${u.adminCrmNote ? `<div class="text-[10px] text-amber-300">📌 ملاحظة سرية: ${app.esc(u.adminCrmNote)}</div>` : ''}
              <div class="flex gap-1.5 pt-1">
                <button onclick="DamanAdmin.openUser360Modal('${u.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">🔎 ملف 360° وتعديل كامل</button>
                <button onclick="DamanApp.openPublicProfile('${u.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[10px]">صفحته</button>
                <button onclick="DamanAdmin.deleteUserSafely('${u.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
              </div>
            </div>`).join('')}
          <button onclick="DamanAdmin.loadMore('users')" class="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold">تحميل المزيد</button>

          <form onsubmit="DamanAdmin.addBlacklistEntry(event)" class="glass-card rounded-2xl p-3 space-y-2 border-rose-500/40">
            <div class="font-black text-rose-400">🚫 القائمة السوداء (${this.blacklist.length})</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[9.5px] text-slate-400">الرقم القومي / الموبايل / الإيميل</label><input id="bl-val" type="text" required class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">سبب الحظر</label><input id="bl-reason" type="text" placeholder="حظر دائم" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <button type="submit" class="w-full py-1.5 rounded-lg bg-rose-500 text-white font-black">إضافة للحظر الدائم</button>
            <div class="flex flex-wrap gap-1">${this.blacklist.map((b) => `<span class="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-rose-300">${app.esc(b.value)} <button type="button" onclick="DamanAdmin.removeBlacklist('${b.id}')" class="text-white ms-1">×</button></span>`).join('')}</div>
          </form>

          <form onsubmit="DamanAdmin.createPromoCode(event)" class="glass-card rounded-2xl p-3 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🎁 إنشاء وإدارة أكواد الهدايا (${this.promoCodes.length})</div>
            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="text-[9.5px] text-slate-400">كود الهدية</label><input id="pr-code" type="text" required placeholder="DAMAN50" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white uppercase font-bold" /></div>
              <div><label class="text-[9.5px] text-slate-400">قيمة الهدية (ج.م)</label><input id="pr-amt" type="number" min="5" required placeholder="50" class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[9.5px] text-slate-400">أقصى عدد مستخدمين</label><input id="pr-max" type="number" min="1" value="20" required class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <button type="submit" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black">إنشاء الكود</button>
            <div class="space-y-1 pt-1">
              ${this.promoCodes.map((pr) => `<div class="p-2 rounded-lg bg-slate-950 flex justify-between items-center text-[10.5px]"><span><b class="text-amber-300">${app.esc(pr.code || pr.id)}</b> — ${app.fmtMoney(pr.amount)} ج.م (${(pr.usedBy || []).length}/${pr.maxUses})</span><div class="flex gap-1"><button type="button" onclick="DamanAdmin.togglePromoCode('${app.esc(pr.id)}',${!!pr.active})" class="px-2 py-0.5 rounded bg-slate-800 ${pr.active ? 'text-emerald-400' : 'text-rose-400'} font-bold">${pr.active ? 'مفعّل' : 'موقوف'}</button><button type="button" onclick="DamanAdmin.deletePromoCode('${app.esc(pr.id)}')" class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">حذف</button></div></div>`).join('')}
            </div>
          </form>
        </div>`;
    },

    // ==================== 3. RBAC SECURITY & AUDIT LOG ====================
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
      await app.db.collection('settings').doc('appConfig').set({
        moderators: Array.from(new Set(curMods.concat([email]))),
        moderatorPerms: curMap
      }, { merge: true });
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

    renderSecurityTab(app) {
      const mods = Array.isArray(app.appConfig?.moderators) ? app.appConfig.moderators : [];
      const pMap = app.appConfig?.moderatorPerms || {};
      const ms = this.mediaStats || { total: 0, recordings: 0, receipts: 0, kyc: 0 };

      return `
        <div class="space-y-3.5 text-xs">
          <form onsubmit="DamanAdmin.saveModeratorRBAC(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5 border-purple-500/40">
            <div class="font-black text-purple-300">🛡️ صلاحيات المشرفين المساعدين (RBAC — بدون خزنة أو إعدادات)</div>
            <input id="rb-email" type="email" required placeholder="إيميل المشرف (example@gmail.com)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-1.5 text-[10.5px]">
              <label class="flex items-center gap-1.5"><input id="rb-kyc" type="checkbox" checked class="accent-purple-500" /> مراجعة التوثيق</label>
              <label class="flex items-center gap-1.5"><input id="rb-wallet" type="checkbox" class="accent-purple-500" /> الشحن والسحب</label>
              <label class="flex items-center gap-1.5"><input id="rb-contracts" type="checkbox" checked class="accent-purple-500" /> العقود والنزاعات</label>
              <label class="flex items-center gap-1.5"><input id="rb-market" type="checkbox" checked class="accent-purple-500" /> السوق والتمييز</label>
              <label class="flex items-center gap-1.5"><input id="rb-companies" type="checkbox" class="accent-purple-500" /> مراقبة الشركات</label>
              <label class="flex items-center gap-1.5"><input id="rb-users" type="checkbox" checked class="accent-purple-500" /> المستخدمين والبلاغات</label>
              <label class="flex items-center gap-1.5"><input id="rb-comms" type="checkbox" checked class="accent-purple-500" /> مراقبة الشات</label>
            </div>
            <button type="submit" class="w-full py-2 rounded-xl bg-purple-500 text-white font-black">حفظ / إضافة مشرف</button>
            ${mods.map((em) => {
              const pm = pMap[em.toLowerCase()];
              const activeP = pm ? Object.entries(pm).filter(([, v]) => v).map(([k]) => k).join(', ') : 'كل صلاحيات الإشراف';
              return `<div class="p-2 rounded-xl bg-slate-950 flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-white block truncate">${app.esc(em)}</b><span class="text-[9.5px] text-slate-400">${app.esc(activeP)}</span></div><button type="button" onclick="DamanAdmin.removeModerator('${app.esc(em)}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px]">حذف</button></div>`;
            }).join('')}
          </form>

          <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/40">
            <div class="font-black text-sky-400">🧹 مراقبة وتنظيف خزنة المرفقات (Media Vault)</div>
            <div class="text-[11px] text-slate-300">إجمالي الملفات: <b>${ms.total}</b> (بطاقات: ${ms.kyc} | إيصالات: ${ms.receipts} | تسجيلات: ${ms.recordings})</div>
            <button onclick="if(DamanAdmin.cleanupExpiredRecordings) DamanAdmin.cleanupExpiredRecordings()" class="w-full py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black">تنظيف تسجيلات المكالمات المنتهية (&gt;30 يوم)</button>
          </div>

          <div class="space-y-1.5">
            <div class="font-black text-amber-400">📜 سجل الرقابة والتدقيق الإداري (آخر ${this.auditLogs.length} عملية)</div>
            ${this.auditLogs.map((l) => `
              <div class="glass-card rounded-xl p-2.5 text-[10.5px] space-y-0.5">
                <div class="flex justify-between"><b class="text-amber-300">${app.esc(l.action)}</b><span class="text-slate-500">${app.esc(l.date)} ${app.esc(l.time || '')}</span></div>
                <div class="text-white">${app.esc(l.details)}</div>
                <div class="text-[9.5px] text-slate-400">بواسطة: ${app.esc(l.actorEmail || l.actorName)}</div>
              </div>`).join('') || '<div class="glass-card rounded-xl p-4 text-center text-slate-400">لا توجد عمليات مسجّلة بعد</div>'}
          </div>
        </div>`;
    },

    // ==================== 4. LIVE DB INSPECTOR ====================
    selectDbCollection(col) { this.dbCol = col; this.loadTabData('db'); },

    openDbDocEditor(docId) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const doc = this.dbDocs.find((d) => d.id === docId);
      if (!doc) return;
      const clean = {};
      Object.keys(doc).forEach((k) => {
        if (k === 'id') return;
        const v = doc[k];
        if (v && typeof v === 'object' && typeof v.seconds === 'number') return;
        clean[k] = v;
      });
      let m = document.getElementById('daman-db-ed-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-db-ed-modal';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-2.5 text-xs">
          <div class="flex justify-between items-center"><h3 class="text-sm font-black text-amber-400">🗄️ تعديل سجل: ${app.esc(this.dbCol)} / ${app.esc(docId)}</h3><button onclick="document.getElementById('daman-db-ed-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <textarea id="db-json-area" rows="13" dir="ltr" class="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-[11px]">${app.esc(JSON.stringify(clean, null, 2))}</textarea>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="DamanAdmin.saveDbDocJson('${app.esc(docId)}')" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">حفظ التعديلات</button>
            <button onclick="DamanAdmin.deleteDbDoc('${app.esc(docId)}')" class="py-2.5 rounded-xl bg-rose-600 text-white font-black">حذف السجل نهائياً</button>
          </div>
        </div>`;
    },

    async saveDbDocJson(docId) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      try {
        const parsed = JSON.parse(document.getElementById('db-json-area').value);
        await app.db.collection(this.dbCol).doc(docId).set(parsed, { merge: true });
        await app.logAudit('db_direct_edit', `تعديل مباشر في ${this.dbCol}/${docId}`, docId);
        document.getElementById('daman-db-ed-modal').classList.add('hidden');
        app.toast('تم حفظ التعديل المباشر ✅', 'success');
        this.loadTabData('db');
      } catch (err) { app.toast('صيغة JSON غير صحيحة: ' + err.message, 'error'); }
    },

    async deleteDbDoc(docId) {
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      if (['settings', 'auditLogs'].includes(this.dbCol)) return app.toast('ممنوع حذف الإعدادات أو سجل الرقابة', 'error');
      if (!window.confirm(`حذف السجل ${this.dbCol}/${docId} نهائياً؟`)) return;
      await app.db.collection(this.dbCol).doc(docId).delete();
      await app.logAudit('db_direct_delete', `حذف مباشر ${this.dbCol}/${docId}`, docId);
      document.getElementById('daman-db-ed-modal').classList.add('hidden');
      app.toast('تم حذف السجل', 'info');
      this.loadTabData('db');
    },

    renderDbTab(app) {
      const cols = [
        ['users', 'المستخدمين (users)'], ['projects', 'إعلانات السوق (projects)'],
        ['chatAgreements', 'العقود (chatAgreements)'], ['walletRequests', 'طلبات المحفظة (walletRequests)'],
        ['kycRequests', 'طلبات التوثيق (kycRequests)'], ['companies', 'الشركات (companies)'],
        ['companyOps', 'عمليات الشركات (companyOps)'], ['chats', 'المحادثات (chats)'],
        ['vipRequests', 'الاستلام 3x (vipRequests)'], ['vipLaborRequests', 'عمالة VIP (vipLaborRequests)'],
        ['platformFees', 'الأرباح (platformFees)'], ['adminExpenses', 'مصروفات الإدارة (adminExpenses)'],
        ['treasuryTransfers', 'التحويلات الداخلية (treasuryTransfers)'], ['disputes', 'النزاعات (disputes)'],
        ['promoCodes', 'أكواد الهدايا (promoCodes)'], ['blacklist', 'القائمة السوداء (blacklist)'],
        ['settings', 'الإعدادات (settings)']
      ];
      const q = app.normalizeAr(this.dbFilter);
      const list = this.dbDocs.filter((d) => !q || app.normalizeAr(JSON.stringify(d)).includes(q));

      return `
        <div class="space-y-3 text-xs">
          <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200">
            <b>🗄️ مستكشف وتعديل قاعدة البيانات المباشر:</b> اختر أي جدول لمشاهدة وتعديل أي سجل بالكامل.
          </div>
          <select onchange="DamanAdmin.selectDbCollection(this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-purple-500/40 text-purple-200 font-black">
            ${cols.map(([k, lbl]) => `<option value="${k}" ${this.dbCol === k ? 'selected' : ''}>${lbl}</option>`).join('')}
          </select>
          <input type="text" value="${app.esc(this.dbFilter)}" oninput="DamanAdmin.dbFilter=this.value; DamanAdmin.rerender()" placeholder="تصفية السجلات..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
          <div class="space-y-1.5">
            ${list.map((d) => {
              const title = d.name || d.title || d.ticketNumber || d.code || d.userName || d.subject || d.id;
              return `<div class="glass-card rounded-xl p-2.5 flex justify-between items-center gap-2"><div class="min-w-0"><b class="text-white block truncate">${app.esc(title)}</b><span class="text-[9.5px] text-slate-400">ID: ${app.esc(d.id)} ${d.status ? '• ' + this.statusAr(d.status) : ''}</span></div><button onclick="DamanAdmin.openDbDocEditor('${app.esc(d.id)}')" class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] shrink-0">عرض / تعديل</button></div>`;
            }).join('') || '<div class="glass-card rounded-xl p-5 text-center text-slate-400">لا توجد سجلات في هذا الجدول</div>'}
          </div>
        </div>`;
    },

    // ==================== 5. EMERGENCY KILL-SWITCHES & FULL BACKUP ====================
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
      const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `damansite-full-backup-${app.todayLocal()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      app.toast('تم تنزيل النسخة الاحتياطية الكاملة (JSON) ✅', 'success');
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
            <div><label class="text-[10px] text-slate-400">رسالة شاشة الصيانة</label><input id="ks-maint-msg" type="text" value="${app.esc(cfg.maintenanceMessage || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>

            <div class="font-black text-amber-400 pt-1">⚙️ العمولات، أسعار الباقات، الواتساب والـ TURN</div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-slate-400">عمولة الضمان %</label><input id="st-comm" type="number" step="0.1" value="${(Number(cfg.commissionRate || 0.035) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
              <div><label class="text-[10px] text-slate-400">عمولة عمالة VIP %</label><input id="st-vipcomm" type="number" step="0.5" value="${(Number(cfg.vipCommissionRate || 0.10) * 100).toFixed(1)}" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div><label class="text-[9.5px] text-slate-400">باقة أفراد (ج.م)</label><input id="st-pkg-ind" type="number" value="${Number(pkgs.individualMonthly || 150)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">باقة شركات (ج.م)</label><input id="st-pkg-comp" type="number" value="${Number(pkgs.companyMonthly || 450)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="text-[9.5px] text-slate-400">تمييز افتراضي (ج.م)</label><input id="st-pkg-boost" type="number" value="${Number(pkgs.boostAdPrice || 75)}" class="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            <div><label class="text-[10px] text-slate-400">رقم واتساب الدعم (بدون +)</label><input id="st-wa" type="text" value="${app.esc(cfg.supportWhatsapp || '201030374787')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <div><label class="text-[10px] text-slate-400">سيرفر TURN للمكالمات (اختياري)</label><input id="st-turn" type="text" value="${app.esc(cfg.turnServer || '')}" placeholder="url|user|pass" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">حفظ وتطبيق كل الإعدادات فوراً</button>
          </form>

          <div class="grid grid-cols-2 gap-2">
            <button onclick="DamanAdmin.triggerForceReloadAllDevices()" class="py-3 rounded-2xl bg-sky-600 text-white font-black text-[11px]"><i class="fa-solid fa-bolt me-1"></i> إجبار تحديث كل الأجهزة</button>
            <button onclick="DamanAdmin.exportFullBackup()" class="py-3 rounded-2xl bg-emerald-600 text-white font-black text-[11px]"><i class="fa-solid fa-database me-1"></i> نسخة احتياطية JSON</button>
          </div>
        </div>`;
    }
  };

  if (window.DamanAdmin && typeof window.DamanAdmin.registerExtension === 'function') {
    window.DamanAdmin.registerExtension(2, AdminExt2);
  } else {
    window.__damanAdminExtQueue = window.__damanAdminExtQueue || [];
    window.__damanAdminExtQueue.push([2, AdminExt2]);
  }
})();
