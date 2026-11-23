(function () {
  const ChatExtras = {
    // ==================== 1. CREATE CONTRACT MODAL (WITH ? HELP + VEHICLES/ADDONS BUILDER) ====================
    async _openCreateContractModalImpl() {
      const app = window.DamanApp;
      if (!this.activeChatId || !this.activeChatMeta?.otherUid) return app.toast('افتح محادثة مع الطرف الآخر أولاً', 'warning');
      if (!app.isKycVerified()) return app.toast('يجب توثيق الحساب بالبطاقة أولاً', 'error');
      if (app.appConfig?.disableNewContracts && !app.isAdmin()) {
        return app.toast('إنشاء العقود الجديدة متوقف مؤقتاً للصيانة من الإدارة', 'warning');
      }

      const otherUid = this.activeChatMeta.otherUid;
      let otherProf = null;
      try {
        const s = await app.db.collection('users').doc(otherUid).get();
        if (s.exists) otherProf = s.data();
      } catch (e) {}

      if (!otherProf || (otherProf.kycStatus !== 'verified' && (otherProf.email || '').toLowerCase() !== app.ADMIN_EMAIL)) {
        return app.toast('⚠️ الطرف الآخر لم يكمل توثيق هويته بالبطاقة بعد — لا يمكن إبرام عقد رسمي معه قبل التوثيق.', 'error');
      }

      this._contractOtherProf = otherProf;
      this.draftContractAddons = [];
      const commPct = (app.getCommissionRate(app.profile) * 100).toFixed(2);
      const today = app.todayLocal();
      const defEnd = app.addDaysLocal(today, 15);

      let m = document.getElementById('daman-contract-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-contract-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-file-contract me-1"></i> إنشاء عقد رسمي بالضمان المالي</h3>
            <button onclick="document.getElementById('daman-contract-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-[10.5px] space-y-1 text-emerald-100">
            <div class="font-black text-emerald-300">✅ بيانات البطاقة الموثّقة للطرفين (اضغط «؟» جنب أي خانة لشرحها):</div>
            <div>• أنت: <b>${app.esc(app.profile.legalName || app.profile.name)}</b> (قومي: ${app.maskNationalId(app.profile.nationalId)})</div>
            <div>• الطرف الآخر: <b>${app.esc(otherProf.legalName || otherProf.name)}</b> (قومي: ${app.maskNationalId(otherProf.nationalId)})</div>
          </div>

          <form onsubmit="DamanChat.submitCreateContract(event)" oninput="DamanChat.updateContractCostPreview()" class="space-y-2.5">
            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">صفتك في هذا العقد * ${this.hBtn('ct-rl')}</label>
              ${this.hBox('ct-rl', 'اختر «صاحب العمل / المشتري» إذا كنت أنت من سيدفع ويحجز الفلوس في الضمان، أو «المنفّذ / المورّد» إذا كنت ستنفّذ الشغل أو تورّد الخامات أو السيارة.')}
              <select id="ct-role" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                <option value="payer">أنا صاحب العمل / المشتري (سأحجز المبلغ في الضمان)</option>
                <option value="provider">أنا المقاول / الفني / المورّد (سأنفّذ العمل أو التوريد)</option>
              </select>
            </div>

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">عنوان البند / المشروع * ${this.hBtn('ct-tt')}</label>
              ${this.hBox('ct-tt', 'اكتب اسم الشغلانة أو التوريد بوضوح (مثال: شدة خشبية وحدادة سقف فيلا 14، أو نقل خامات بسيارة جامبو).')}
              <input id="ct-title" type="text" required placeholder="مثال: شدة خشبية وحدادة سقف فيلا 14" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10.5px] font-bold text-emerald-300 mb-1">إجمالي قيمة العقد (ج.م) * ${this.hBtn('ct-am')}</label>
                <input id="ct-amount" type="number" min="100" step="any" required placeholder="50000" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
              </div>
              <div>
                <label class="block text-[10.5px] font-bold text-sky-300 mb-1">نظام وميعاد الصرف * ${this.hBtn('ct-pm')}</label>
                <select id="ct-paytype" onchange="DamanChat.onContractModelChange()" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-sky-300 font-bold">
                  <option value="milestones">دفعات / مستخلصات حسب الإنجاز</option>
                  <option value="daily_wages">يوميات (يومي / أسبوعي + تأمين)</option>
                  <option value="lump_sum">مقطوعية (100% عند الاستلام)</option>
                  <option value="b2b_supply">توريد خامات B2B (عند الاستلام)</option>
                </select>
              </div>
            </div>
            ${this.hBox('ct-am', 'اكتب المبلغ الإجمالي المتفق عليه للعقد بالجنيه المصري (بدون العمولة — النظام يحسب عمولة الضمان تلقائياً).')}
            ${this.hBox('ct-pm', 'حدّد متى تُصرف الفلوس من الضمان: باليوميات، أو بدفعات ومستخلصات عند كل مرحلة، أو 100% دفعة واحدة عند الاستلام النهائي فقط.')}

            <div id="ct-model-info" class="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[10.5px] text-sky-100 leading-relaxed">
              💡 <b>متى تُصرف الفلوس؟</b> يرسل المنفّذ «طلب صرف دفعة/مستخلص» بصورة الإنجاز، ولا يُصرف جنيه إلا بعد ضغط صاحب العمل «اعتماد وصرف».
            </div>

            <div id="ct-daily-box" class="hidden p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2">
              <div class="font-black text-amber-300 text-[10.5px]">⚙️ إعدادات الصرف باليوميات ${this.hBtn('ct-dl')}</div>
              ${this.hBox('ct-dl', 'حدّد أجر اليومية الواحدة ونسبة التأمين التي تبقى محجوزة بالضمان حتى التسليم النهائي (يمكن جعلها 0% لو بدون تأمين) وميعاد الصرف.')}
              <div class="grid grid-cols-3 gap-1.5">
                <div><label class="block text-[9.5px] text-slate-400 mb-0.5">قيمة اليومية</label><input id="ct-daily-rate" type="number" min="50" step="any" placeholder="500" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                <div><label class="block text-[9.5px] text-slate-400 mb-0.5">تأمين محتجز %</label><input id="ct-ret-pct" type="number" min="0" max="50" value="10" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-center" /></div>
                <div><label class="block text-[9.5px] text-slate-400 mb-0.5">ميعاد الصرف</label>
                  <select id="ct-payout-sched" class="w-full px-1.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-[10px]">
                    <option value="daily">يومياً</option>
                    <option value="weekly" selected>أسبوعياً (خميس)</option>
                    <option value="on_request">عند الطلب</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-1.5">
              <div><label class="block text-[10px] font-bold text-amber-300 mb-1">تاريخ البداية * ${this.hBtn('ct-dt')}</label><input id="ct-start" type="date" required value="${today}" onchange="DamanChat.syncContractEndDate()" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" /></div>
              <div><label class="block text-[10px] font-bold text-amber-300 mb-1">المدة (يوم) *</label><input id="ct-days" type="number" min="1" max="730" required value="15" oninput="DamanChat.syncContractEndDate()" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-black text-center" /></div>
              <div><label class="block text-[10px] font-bold text-amber-300 mb-1">تاريخ التسليم *</label><input id="ct-end" type="date" required value="${defEnd}" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" /></div>
            </div>
            ${this.hBox('ct-dt', 'حدّد تاريخ بدء العمل وعدد أيام التنفيذ — يُحسب تاريخ التسليم النهائي تلقائياً ويُثبت في العقد الـ A4.')}

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">موقع التنفيذ / عنوان التسليم * ${this.hBtn('ct-lc')}</label>
              ${this.hBox('ct-lc', 'اكتب العنوان الدقيق لمكان الشغل أو مكان تنزيل الخامات (المدينة / الكمبوند / رقم العمارة أو الفيلا).')}
              <input id="ct-loc" type="text" required placeholder="المدينة / الكمبوند / رقم العمارة أو الفيلا" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] font-bold text-slate-300 mb-1">غرامة تأخير/يوم (ج.م) ${this.hBtn('ct-pn')}</label><input id="ct-penalty" type="number" min="0" value="0" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] font-bold text-slate-300 mb-1">ضمان الأعمال (يوم) ${this.hBtn('ct-wr')}</label><input id="ct-warranty" type="number" min="0" value="90" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>
            ${this.hBox('ct-pn', 'قيمة الغرامة اليومية في حالة تأخر المنفّذ عن تاريخ التسليم بدون عذر مقبول (اكتب 0 إذا لم يوجد غرامة).')}
            ${this.hBox('ct-wr', 'عدد أيام ضمان المنفّذ لجودة الأعمال بعد التسليم النهائي (مثلاً 90 يوم أو 365 يوم).')}

            <!-- VEHICLES & OTHER CONTRACT ADDONS BUILDER -->
            <div class="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/40 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-black text-purple-300 text-[11px]">🚗 إضافة سيارة أو معدات أو إضافات للعقد ${this.hBtn('ct-ad')}</span>
              </div>
              ${this.hBox('ct-ad', 'يمكنك هنا إضافة أي سيارة نقل (ربع نقل، جامبو، خلاطة، ونش، ملاكي برقم اللوحة واسم السائق) أو معدات أو خامات أو سكن أو أي بند إضافي — ستُثبت كلها في العقد الرسمي الـ A4.')}
              <div class="grid grid-cols-2 gap-1.5">
                <select id="dra-cat" onchange="DamanChat.toggleDraftAddonVehicleFields()" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-purple-500/40 text-purple-200 font-bold text-[10.5px]">
                  <option value="vehicle">🚗 سيارة / نقل</option>
                  <option value="equipment">🏗️ معدة / ونش / شدة</option>
                  <option value="materials">🧱 خامات ومواد</option>
                  <option value="accommodation">🏠 سكن / إعاشة</option>
                  <option value="other">➕ إضافة أخرى</option>
                </select>
                <input id="dra-cost" type="number" min="0" step="any" placeholder="تكلفة إضافية (0=ضمن العقد)" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-[10.5px]" />
              </div>
              <input id="dra-title" type="text" placeholder="الوصف (مثال: سيارة ربع نقل دبابه لنقل الأخشاب)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-[11px]" />
              <div id="dra-veh-fields" class="grid grid-cols-2 gap-1.5">
                <input id="dra-plate" type="text" placeholder="رقم اللوحة (اختياري)" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 text-[10.5px]" />
                <input id="dra-driver" type="text" placeholder="اسم السائق (اختياري)" class="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-[10.5px]" />
              </div>
              <button type="button" onclick="DamanChat.addDraftAddonItem()" class="w-full py-1.5 rounded-xl bg-purple-600 text-white font-black text-[10.5px]">+ تثبيت هذه الإضافة في العقد</button>
              <div id="dra-list" class="space-y-1"></div>
            </div>

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">المواصفات الفنية، الكميات، وشروط الاستلام * ${this.hBtn('ct-sc')}</label>
              ${this.hBox('ct-sc', 'اكتب كل تفاصيل الشغل والمقاسات ونوع الخامات وشروط الاستلام بوضوح — هذا النص هو المرجع القانوني الأول عند أي خلاف.')}
              <textarea id="ct-scope" rows="3" required placeholder="اكتب كل البنود والمقاسات والخامات وشروط الاستلام بوضوح..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            </div>

            <div id="ct-cost-prev" class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200">
              عمولة الضمان المالي (${commPct}%) تُحسب تلقائياً عند إدخال القيمة.
            </div>

            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">
              إرسال مسودة العقد للطرف الآخر
            </button>
          </form>
        </div>`;
    },

    toggleDraftAddonVehicleFields() {
      const cat = document.getElementById('dra-cat')?.value;
      const box = document.getElementById('dra-veh-fields');
      if (box) box.classList.toggle('hidden', cat !== 'vehicle');
    },

    addDraftAddonItem() {
      const app = window.DamanApp;
      const category = document.getElementById('dra-cat')?.value || 'vehicle';
      const title = (document.getElementById('dra-title')?.value || '').trim();
      const cost = Math.max(0, Math.round((parseFloat(document.getElementById('dra-cost')?.value) || 0) * 100) / 100);
      const plateNumber = category === 'vehicle' ? (document.getElementById('dra-plate')?.value || '').trim() : '';
      const driverName = category === 'vehicle' ? (document.getElementById('dra-driver')?.value || '').trim() : '';

      if (!title) return app.toast('اكتب وصف السيارة أو الإضافة أولاً', 'warning');
      this.draftContractAddons.push({
        id: 'ad_' + Date.now(), category, title, cost, plateNumber, driverName,
        addedByName: app.profile?.name || '', date: app.todayLocal()
      });

      document.getElementById('dra-title').value = '';
      document.getElementById('dra-cost').value = '';
      if (document.getElementById('dra-plate')) document.getElementById('dra-plate').value = '';
      if (document.getElementById('dra-driver')) document.getElementById('dra-driver').value = '';

      this.renderDraftAddonsList();
      this.updateContractCostPreview();
    },

    removeDraftAddonItem(idx) {
      this.draftContractAddons.splice(idx, 1);
      this.renderDraftAddonsList();
      this.updateContractCostPreview();
    },

    renderDraftAddonsList() {
      const app = window.DamanApp;
      const box = document.getElementById('dra-list');
      if (!box) return;
      box.innerHTML = this.draftContractAddons.map((ad, i) => `
        <div class="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[10px]">
          <div class="min-w-0">
            <b class="text-white">${this.addonCategoryLabel(ad.category)}: ${app.esc(ad.title)}</b>
            ${ad.plateNumber || ad.driverName ? `<div class="text-slate-400">لوحة: ${app.esc(ad.plateNumber || '—')} | سائق: ${app.esc(ad.driverName || '—')}</div>` : ''}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <b class="text-amber-300">${ad.cost > 0 ? '+' + app.fmtMoney(ad.cost) + ' ج.م' : 'ضمن العقد'}</b>
            <button type="button" onclick="DamanChat.removeDraftAddonItem(${i})" class="text-rose-400 font-black">×</button>
          </div>
        </div>`).join('');
    },

    onContractModelChange() {
      const m = document.getElementById('ct-paytype')?.value;
      const box = document.getElementById('ct-daily-box');
      const info = document.getElementById('ct-model-info');
      if (box) box.classList.toggle('hidden', m !== 'daily_wages');
      if (!info) return;
      if (m === 'daily_wages') {
        info.innerHTML = '💡 <b>متى تُصرف الفلوس؟</b> يرفع المنفّذ طلب صرف يوميات (يومياً أو أسبوعياً)، وعند موافقة صاحب العمل يُصرف الصافي فوراً وتبقى نسبة التأمين محجوزة حتى التسليم النهائي.';
      } else if (m === 'lump_sum' || m === 'b2b_supply') {
        info.innerHTML = '💡 <b>متى تُصرف الفلوس؟</b> يبقى 100% من المبلغ محجوزاً بالضمان بالكامل ولا يُصرف منه جنيه إلا عند الاستلام النهائي والتصفية من صاحب العمل.';
      } else {
        info.innerHTML = '💡 <b>متى تُصرف الفلوس؟</b> يرسل المنفّذ «طلب صرف دفعة/مستخلص» بصورة الإنجاز، ولا يُصرف جنيه إلا بعد ضغط صاحب العمل «اعتماد وصرف».';
      }
    },

    syncContractEndDate() {
      const start = document.getElementById('ct-start')?.value;
      const days = parseInt(document.getElementById('ct-days')?.value, 10) || 1;
      const endInp = document.getElementById('ct-end');
      if (start && endInp) endInp.value = window.DamanApp.addDaysLocal(start, days);
    },

    updateContractCostPreview() {
      const app = window.DamanApp;
      const baseAmt = parseFloat(document.getElementById('ct-amount')?.value) || 0;
      const addonsCost = (this.draftContractAddons || []).reduce((s, x) => s + Number(x.cost || 0), 0);
      const amt = Math.round((baseAmt + addonsCost) * 100) / 100;
      const role = document.getElementById('ct-role')?.value || 'payer';
      const payerProf = role === 'payer' ? app.profile : this._contractOtherProf;
      const rate = app.getCommissionRate(payerProf);
      const fee = Math.round(amt * rate * 100) / 100;
      const total = Math.round((amt + fee) * 100) / 100;
      const box = document.getElementById('ct-cost-prev');
      if (!box) return;
      box.innerHTML = `
        <div>قيمة العقد${addonsCost > 0 ? ` (${app.fmtMoney(baseAmt)} + إضافات ${app.fmtMoney(addonsCost)})` : ''}: <b>${app.fmtMoney(amt)} ج.م</b></div>
        <div>عمولة الضمان (${(rate * 100).toFixed(2)}%): <b>${app.fmtMoney(fee)} ج.م</b></div>
        <div class="text-emerald-300 font-black">الإجمالي المطلوب حجزه من صاحب العمل (100%): ${app.fmtMoney(total)} ج.م</div>`;
    },

    async submitCreateContract(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const otherProf = this._contractOtherProf;
      const otherUid = this.activeChatMeta?.otherUid;
      if (!otherProf || !otherUid || !this.activeChatId) return;

      await app.withLock('createContract', async () => {
        const myRole = document.getElementById('ct-role').value;
        const title = document.getElementById('ct-title').value.trim();
        const baseAmount = Math.round((parseFloat(document.getElementById('ct-amount').value) || 0) * 100) / 100;
        const addons = [...(this.draftContractAddons || [])];
        const addonsCost = addons.reduce((s, x) => s + Number(x.cost || 0), 0);
        const totalAmount = Math.round((baseAmount + addonsCost) * 100) / 100;

        const paymentModel = document.getElementById('ct-paytype').value;
        const dailyRate = paymentModel === 'daily_wages' ? (parseFloat(document.getElementById('ct-daily-rate')?.value) || 0) : 0;
        const retentionPct = paymentModel === 'daily_wages' ? Math.max(0, Math.min(50, parseFloat(document.getElementById('ct-ret-pct')?.value) || 0)) : 0;
        const payoutSchedule = paymentModel === 'daily_wages' ? (document.getElementById('ct-payout-sched')?.value || 'weekly') : (paymentModel === 'milestones' ? 'on_request' : 'on_delivery');

        const startDate = document.getElementById('ct-start').value;
        const durationDays = parseInt(document.getElementById('ct-days').value, 10) || 1;
        const endDate = document.getElementById('ct-end').value;
        const location = document.getElementById('ct-loc').value.trim();
        const delayPenaltyPerDay = parseFloat(document.getElementById('ct-penalty').value) || 0;
        const warrantyDays = parseInt(document.getElementById('ct-warranty').value, 10) || 0;
        const scopeDetails = document.getElementById('ct-scope').value.trim();

        if (totalAmount < 100) return app.toast('الحد الأدنى لقيمة العقد 100 ج.م', 'warning');

        const isMePayer = myRole === 'payer';
        const payerUid = isMePayer ? app.user.uid : otherUid;
        const providerUid = isMePayer ? otherUid : app.user.uid;
        const payerP = isMePayer ? app.profile : otherProf;
        const provP = isMePayer ? otherProf : app.profile;

        const commissionRate = app.getCommissionRate(payerP);
        const lockedFee = Math.round(totalAmount * commissionRate * 100) / 100;
        const ticketNumber = 'TKT-' + Math.floor(100000 + Math.random() * 900000);

        const docData = {
          ticketNumber, chatId: this.activeChatId, participants: [payerUid, providerUid], createdByUid: app.user.uid,
          title, paymentModel, dailyRate, retentionPct, payoutSchedule, location, scopeDetails,
          date: app.todayLocal(), startDate, durationDays, endDate, delayPenaltyPerDay, warrantyDays,
          addons,

          payerUid, payerName: payerP.companyName || payerP.name || '', payerLegalName: payerP.legalName || payerP.name || '',
          payerNationalId: payerP.nationalId || '', payerAddress: payerP.legalAddress || payerP.city || '',
          payerPhone: payerP.phone || '', payerCR: payerP.commercialReg || '',

          providerUid, providerName: provP.companyName || provP.name || '', providerLegalName: provP.legalName || provP.name || '',
          providerNationalId: provP.nationalId || '', providerAddress: provP.legalAddress || provP.city || '',
          providerPhone: provP.phone || '', providerCR: provP.commercialReg || '',

          totalAmount, commissionRate, lockedFee, remainingEscrow: totalAmount, paidSoFar: 0, totalDeductions: 0,
          payoutLogs: [], pendingPayoutReq: null, pendingDeduction: null,
          payerSigBase64: '', providerSigBase64: '', signedContractMedia: '',
          contractStatus: 'unsigned', status: 'draft', ratedByPayer: false, ratedByProvider: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          const agRef = await app.db.collection('chatAgreements').add(docData);
          await agRef.collection('events').add({
            type: 'created', byName: app.profile.name || '',
            note: `إنشاء مسودة العقد ${ticketNumber} بقيمة ${app.fmtMoney(totalAmount)} ج.م${addons.length ? ` (+ ${addons.length} سيارات/إضافات)` : ''}`,
            date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('chats').doc(this.activeChatId).collection('messages').add({
            senderId: app.user.uid, senderName: app.profile.companyName || app.profile.name || '',
            type: 'contract', agreementId: agRef.id,
            text: `📄 عقد رسمي جديد (${ticketNumber}): ${title} — ${app.fmtMoney(totalAmount)} ج.م${addons.length ? ` | شامل ${addons.length} سيارات/إضافات` : ''}`,
            date: app.todayLocal(), time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.sendNotification(otherUid, `📄 عقد رسمي جديد (${ticketNumber})`, `${title} — بقيمة ${app.fmtMoney(totalAmount)} ج.م`);
          this.draftContractAddons = [];
          document.getElementById('daman-contract-modal').classList.add('hidden');
          app.toast(`تم إنشاء العقد ${ticketNumber} بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 2. ADD VEHICLE / OTHER ADDON TO EXISTING CONTRACT ====================
    _openAddAddonModalImpl(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !['draft', 'funded'].includes(ag.status)) return;
      const isPayer = ag.payerUid === app.user?.uid;
      this.tempAddonPhoto = '';

      let m = document.getElementById('daman-addon-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-addon-modal';
        m.className = 'daman-modal fixed inset-0 z-[91] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-purple-500/50 rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-purple-300">🚗 إضافة سيارة أو ملحق للعقد (${app.esc(ag.ticketNumber)})</h3>
            <button onclick="document.getElementById('daman-addon-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form onsubmit="DamanChat.submitContractAddon(event,'${agId}')" class="space-y-2.5">
            <div>
              <label class="block text-[10.5px] font-bold text-purple-300 mb-1">نوع الإضافة * ${this.hBtn('ad-cat')}</label>
              ${this.hBox('ad-cat', 'اختر «سيارة / نقل» لإضافة عربية ربع نقل أو جامبو أو خلاطة أو ونش ببياناتها، أو اختر معدات أو خامات أو سكن أو أي إضافة أخرى.')}
              <select id="ad-cat" onchange="DamanChat.toggleAddonVehBox()" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-purple-200 font-bold">
                <option value="vehicle">🚗 سيارة / نقل (ربع نقل / جامبو / خلاطة / ملاكي)</option>
                <option value="equipment">🏗️ معدة / ونش / شدة معدنية</option>
                <option value="materials">🧱 خامات ومواد بناء إضافية</option>
                <option value="accommodation">🏠 سكن / إقامة / إعاشة للعمال</option>
                <option value="other">➕ إضافة أخرى</option>
              </select>
            </div>

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">وصف السيارة أو الإضافة * ${this.hBtn('ad-ttl')}</label>
              ${this.hBox('ad-ttl', 'اكتب نوع وموديل السيارة أو اسم المعدة أو الإضافة والمهمة المطلوبة منها بالتحديد.')}
              <input id="ad-title" type="text" required placeholder="مثال: سيارة شيفروليه دبابه لنقل الشدة الخشبية" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div id="ad-veh-box" class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-amber-300 mb-1">رقم لوحة السيارة ${this.hBtn('ad-plt')}</label>
                <input id="ad-plate" type="text" placeholder="مثال: أ ب ج 1234" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold" />
              </div>
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">اسم السائق / المسؤول</label>
                <input id="ad-driver" type="text" placeholder="اسم السائق ورقمه" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              </div>
            </div>
            ${this.hBox('ad-plt', 'اكتب حروف وأرقام لوحة السيارة لتثبيتها قانونياً في ملحق العقد الرسمي الـ A4.')}

            <div>
              <label class="block text-[10.5px] font-bold text-emerald-300 mb-1">التكلفة الإضافية (ج.م) — اكتب 0 إذا كانت ضمن العقد ${this.hBtn('ad-cst')}</label>
              ${this.hBox('ad-cst', 'إذا كانت السيارة أو الإضافة مشمولة داخل سعر العقد الأصلي اكتب 0. وإذا لها تكلفة زائدة اكتب قيمتها (ويمكن لصاحب العمل حجزها فوراً بالضمان).')}
              <input id="ad-cost" type="number" min="0" step="any" value="0" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
            </div>

            ${ag.status === 'funded' && isPayer ? `
              <label class="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 cursor-pointer">
                <input id="ad-lock-esc" type="checkbox" class="mt-0.5 accent-emerald-500" />
                <span class="text-[10.5px] text-emerald-200 font-bold">حجز التكلفة الإضافية + عمولة الضمان فوراً من رصيدي المتاح وإضافتها لإجمالي العقد</span>
              </label>` : ''}

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">ملاحظات / شروط التسليم (اختياري) ${this.hBtn('ad-nt')}</label>
              ${this.hBox('ad-nt', 'أي شروط خاصة مثل: البنزين أو السولار على من؟ ساعات العمل، أو حالة السيارة عند الاستلام.')}
              <textarea id="ad-notes" rows="2" placeholder="تفاصيل إضافية (مثال: السولار على صاحب العمل، 8 ساعات يومياً)..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            </div>

            <label class="block p-2.5 rounded-xl border border-dashed border-purple-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-purple-300"><i class="fa-solid fa-camera me-1"></i> صورة السيارة / الرخصة / الإضافة (اختياري)</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanChat.handleTempAddonPhoto(this)" />
              <div id="ad-photo-prev"></div>
            </label>

            <button type="submit" class="w-full py-3 rounded-2xl bg-purple-600 text-white font-black">تثبيت الإضافة داخل العقد الرسمي</button>
          </form>
        </div>`;
    },

    toggleAddonVehBox() {
      const cat = document.getElementById('ad-cat')?.value;
      document.getElementById('ad-veh-box')?.classList.toggle('hidden', cat !== 'vehicle');
    },

    async handleTempAddonPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempAddonPhoto = await window.DamanApp.compressImage(f, 700, 0.56);
      const p = document.getElementById('ad-photo-prev');
      if (p) p.innerHTML = `<img src="${this.tempAddonPhoto}" class="max-h-20 mx-auto rounded mt-1" />`;
    },

    async submitContractAddon(e, agId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;

      await app.withLock('addon_' + agId, async () => {
        const category = document.getElementById('ad-cat').value;
        const title = document.getElementById('ad-title').value.trim();
        const plateNumber = category === 'vehicle' ? (document.getElementById('ad-plate')?.value || '').trim() : '';
        const driverName = category === 'vehicle' ? (document.getElementById('ad-driver')?.value || '').trim() : '';
        const cost = Math.max(0, Math.round((parseFloat(document.getElementById('ad-cost')?.value) || 0) * 100) / 100);
        const notes = (document.getElementById('ad-notes')?.value || '').trim();
        const lockNow = !!(document.getElementById('ad-lock-esc')?.checked) && cost > 0 && ag.status === 'funded' && ag.payerUid === app.user.uid;

        const photoMedia = this.tempAddonPhoto ? await app.saveMedia(this.tempAddonPhoto, { kind: 'contract_addon' }) : '';
        const addonObj = {
          id: 'ad_' + Date.now(), category, title, plateNumber, driverName, cost, notes, photoMedia,
          fundedExtra: lockNow, addedByUid: app.user.uid, addedByName: app.profile?.name || '', date: app.todayLocal()
        };

        const aRef = app.db.collection('chatAgreements').doc(agId);
        const otherUid = ag.payerUid === app.user.uid ? ag.providerUid : ag.payerUid;

        try {
          if (lockNow) {
            const rate = Number(ag.commissionRate || app.getCommissionRate());
            const extraFee = Math.round(cost * rate * 100) / 100;
            const totalLock = Math.round((cost + extraFee) * 100) / 100;
            const pRef = app.db.collection('users').doc(ag.payerUid);

            await app.db.runTransaction(async (tx) => {
              const [aDoc, pDoc] = await Promise.all([tx.get(aRef), tx.get(pRef)]);
              const a = aDoc.data();
              const curA = Number((pDoc.data() || {}).balanceAvailable || 0);
              const curE = Number((pDoc.data() || {}).balanceEscrow || 0);
              if (curA < totalLock) throw new Error(`رصيدك المتاح لا يكفي لحجز الإضافة (${app.fmtMoney(totalLock)} ج.م)`);
              const afterA = Math.round((curA - totalLock) * 100) / 100;

              tx.update(pRef, { balanceAvailable: afterA, balanceEscrow: Math.round((curE + totalLock) * 100) / 100 });
              tx.update(aRef, {
                addons: (Array.isArray(a.addons) ? a.addons : []).concat([addonObj]),
                totalAmount: Math.round((Number(a.totalAmount || 0) + cost) * 100) / 100,
                remainingEscrow: Math.round((Number(a.remainingEscrow || 0) + cost) * 100) / 100,
                lockedFee: Math.round((Number(a.lockedFee || 0) + extraFee) * 100) / 100
              });
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.payerUid, type: 'escrow_lock', amount: -totalLock, balanceBefore: curA, balanceAfter: afterA,
                note: `حجز إضافة للعقد ${ag.ticketNumber}: ${title}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            });
          } else {
            const curAddons = Array.isArray(ag.addons) ? ag.addons : [];
            const upd = { addons: curAddons.concat([addonObj]) };
            if (ag.status === 'draft' && cost > 0) {
              const newTot = Math.round((Number(ag.totalAmount || 0) + cost) * 100) / 100;
              upd.totalAmount = newTot;
              upd.remainingEscrow = newTot;
              upd.lockedFee = Math.round(newTot * Number(ag.commissionRate || app.getCommissionRate()) * 100) / 100;
            }
            await aRef.update(upd);
          }

          if (ag.chatId) {
            await app.db.collection('chats').doc(ag.chatId).collection('messages').add({
              senderId: app.user.uid, senderName: app.profile?.companyName || app.profile?.name || '',
              type: 'text',
              text: `📌 تم إرفاق إضافة للعقد (${ag.ticketNumber}): ${this.addonCategoryLabel(category)} — ${title}${plateNumber ? ` [لوحة: ${plateNumber}]` : ''}${cost > 0 ? ` (${app.fmtMoney(cost)} ج.م)` : ' (ضمن العقد)'}`,
              date: app.todayLocal(), time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
          await app.sendNotification(otherUid, `🚗 إضافة جديدة على العقد ${ag.ticketNumber}`, `${this.addonCategoryLabel(category)}: ${title}`);
          this.tempAddonPhoto = '';
          document.getElementById('daman-addon-modal').classList.add('hidden');
          app.toast('تم تثبيت الإضافة داخل العقد بنجاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== 3. FUND, PAYOUT REQUESTS, DEDUCTIONS, SETTLEMENT & DISPUTES ====================
    async fundContract(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'draft' || ag.payerUid !== app.user?.uid) return;

      const totalRequired = Math.round((Number(ag.totalAmount) + Number(ag.lockedFee)) * 100) / 100;
      const avail = Number(app.profile?.balanceAvailable || 0);
      if (avail < totalRequired) {
        const diff = Math.round((totalRequired - avail) * 100) / 100;
        if (window.confirm(`الإجمالي المطلوب لحجز الضمان 100%: ${app.fmtMoney(totalRequired)} ج.م.\nشحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
        }
        return;
      }

      if (!window.confirm(`تأكيد حجز مبلغ الضمان 100% للعقد ${ag.ticketNumber}؟\n• قيمة الأعمال: ${app.fmtMoney(ag.totalAmount)} ج.م\n• عمولة الضمان: ${app.fmtMoney(ag.lockedFee)} ج.م\n• الإجمالي المحجوز: ${app.fmtMoney(totalRequired)} ج.م`)) return;

      await app.withLock('fundAg_' + agId, async () => {
        const uRef = app.db.collection('users').doc(app.user.uid);
        const aRef = app.db.collection('chatAgreements').doc(agId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [uDoc, aDoc] = await Promise.all([tx.get(uRef), tx.get(aRef)]);
            if (aDoc.data().status !== 'draft') throw new Error('تم تمويل أو إلغاء هذا العقد بالفعل');
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
            if (curAvail < totalRequired) throw new Error('رصيدك المتاح غير كافٍ');

            const afterAvail = Math.round((curAvail - totalRequired) * 100) / 100;
            tx.update(uRef, { balanceAvailable: afterAvail, balanceEscrow: Math.round((curEsc + totalRequired) * 100) / 100 });
            tx.update(aRef, { status: 'funded', fundedAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'escrow_lock', amount: -totalRequired,
              balanceBefore: curAvail, balanceAfter: afterAvail,
              note: `حجز ضمان عقد ${ag.ticketNumber}: ${ag.title}`,
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(ag.providerUid, `💰 تم حجز الضمان المالي للعقد ${ag.ticketNumber}`, `المبلغ محجوز 100% — يرجى التوقيع ورفع صورة العقد الموقّع للبدء.`);
          app.toast('تم حجز الضمان المالي 100% بنجاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async cancelDraftContract(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'draft') return;
      if (!window.confirm('إلغاء مسودة هذا العقد؟')) return;
      await app.db.collection('chatAgreements').doc(agId).update({ status: 'cancelled' });
      app.toast('تم إلغاء المسودة', 'info');
    },

    _openRequestPayoutModalImpl(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.providerUid !== app.user?.uid) return;
      if (ag.contractStatus !== 'approved') return app.toast('يجب اعتماد صورة العقد الموقّع من الإدارة أولاً', 'warning');
      if (ag.pendingPayoutReq) return app.toast('يوجد طلب صرف معلّق بالفعل بانتظار رد صاحب العمل', 'warning');

      this.tempPayoutPhoto = '';
      const isDaily = ag.paymentModel === 'daily_wages';
      const isLump = ag.paymentModel === 'lump_sum' || ag.paymentModel === 'b2b_supply';
      const rem = Number(ag.remainingEscrow || 0);

      let m = document.getElementById('daman-req-pay-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-req-pay-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-emerald-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-black text-emerald-400">${isDaily ? '💸 طلب صرف يوميات' : isLump ? '🏁 طلب استلام نهائي وتصفية' : '💸 طلب صرف دفعة / مستخلص'}</h3>
            <button onclick="document.getElementById('daman-req-pay-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            المتبقي بالضمان: <b class="text-amber-300">${app.fmtMoney(rem)} ج.م</b>
            ${isDaily && ag.dailyRate ? ` | اليومية: <b>${app.fmtMoney(ag.dailyRate)} ج.م</b> | تأمين: <b>${ag.retentionPct || 0}%</b>` : ''}
          </div>
          <form onsubmit="DamanChat.submitPayoutRequest(event,'${agId}')" oninput="DamanChat.updatePayoutReqPreview('${agId}')" class="space-y-2.5">
            ${isDaily ? `
              <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-[10px] text-slate-300 mb-1">عدد أيام العمل * ${this.hBtn('rp-dy')}</label><input id="rp-days" type="number" min="0.5" step="0.5" value="1" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black text-center" /></div>
                <div><label class="block text-[10px] text-slate-300 mb-1">قيمة اليومية *</label><input id="rp-rate" type="number" min="50" step="any" value="${Number(ag.dailyRate || 500)}" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-center" /></div>
              </div>
              ${this.hBox('rp-dy', 'أدخل عدد الأيام التي نفّذتها (مثال: 1 يوم أو 6 أيام للأسبوع). سيحسب النظام الصافي بعد استقطاع نسبة التأمين المتفق عليها تلقائياً.')}` : `
              <div>
                <label class="block text-[10.5px] font-bold text-emerald-300 mb-1">المبلغ المطلوب صرفه الآن (ج.م) * ${this.hBtn('rp-am')}</label>
                ${this.hBox('rp-am', 'اكتب قيمة الدفعة أو المستخلص الذي تطلب من صاحب العمل صرفه الآن من الضمان إلى محفظتك.')}
                <input id="rp-amt" type="number" min="1" max="${rem}" step="any" value="${isLump ? rem : Math.min(rem, Math.round(rem / 2))}" ${isLump ? 'readonly' : ''} required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
              </div>`}
            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">بيان الأعمال المنفذة * ${this.hBtn('rp-nt')}</label>
              ${this.hBox('rp-nt', 'اذكر ما تم إنجازه بالتفصيل ليراجعه صاحب العمل ويوافق على الصرف فوراً.')}
              <input id="rp-note" type="text" required placeholder="${isDaily ? 'يوميات الأسبوع الأول' : 'إنجاز المرحلة الأولى / مستخلص 1'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <label class="block p-2.5 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-emerald-300"><i class="fa-solid fa-camera me-1"></i> صورة إثبات من الشغل (اختياري)</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanChat.handleTempPayoutPhoto(this)" />
              <div id="rp-photo-prev"></div>
            </label>
            <div id="rp-calc-prev" class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10.5px] text-emerald-200"></div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">إرسال طلب الصرف لصاحب العمل</button>
          </form>
        </div>`;
      this.updatePayoutReqPreview(agId);
    },

    async handleTempPayoutPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      this.tempPayoutPhoto = await window.DamanApp.compressImage(f, 700, 0.56);
      const p = document.getElementById('rp-photo-prev');
      if (p) p.innerHTML = `<img src="${this.tempPayoutPhoto}" class="max-h-20 mx-auto rounded mt-1" />`;
    },

    updatePayoutReqPreview(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      const box = document.getElementById('rp-calc-prev');
      if (!ag || !box) return;
      const rem = Number(ag.remainingEscrow || 0);
      if (ag.paymentModel === 'daily_wages') {
        const days = parseFloat(document.getElementById('rp-days')?.value) || 0;
        const rate = parseFloat(document.getElementById('rp-rate')?.value) || 0;
        const gross = Math.round(days * rate * 100) / 100;
        const retPct = Number(ag.retentionPct || 0);
        const retAmt = Math.round(gross * (retPct / 100) * 100) / 100;
        const net = Math.min(rem, Math.max(0, Math.round((gross - retAmt) * 100) / 100));
        box.innerHTML = `إجمالي اليوميات: <b>${app.fmtMoney(gross)} ج.م</b> | تأمين يبقى بالضمان (${retPct}%): <b>${app.fmtMoney(retAmt)} ج.م</b><br/><b>الصافي المطلوب صرفه الآن: ${app.fmtMoney(net)} ج.م</b>`;
      } else {
        const amt = parseFloat(document.getElementById('rp-amt')?.value) || 0;
        box.innerHTML = `سيُطلب من صاحب العمل اعتماد صرف مبلغ <b>${app.fmtMoney(amt)} ج.م</b> من الضمان مباشرة إلى محفظتك.`;
      }
    },

    async submitPayoutRequest(e, agId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const rem = Number(ag.remainingEscrow || 0);
      const note = document.getElementById('rp-note').value.trim();

      let days = 0, gross = 0, retentionHeld = 0, netAmount = 0;
      if (ag.paymentModel === 'daily_wages') {
        days = parseFloat(document.getElementById('rp-days').value) || 0;
        const rate = parseFloat(document.getElementById('rp-rate').value) || 0;
        gross = Math.round(days * rate * 100) / 100;
        retentionHeld = Math.round(gross * (Number(ag.retentionPct || 0) / 100) * 100) / 100;
        netAmount = Math.round((gross - retentionHeld) * 100) / 100;
      } else {
        netAmount = Math.round((parseFloat(document.getElementById('rp-amt').value) || 0) * 100) / 100;
        gross = netAmount;
      }

      if (netAmount <= 0 || netAmount > rem) return app.toast('المبلغ المطلوب غير صالح أو أكبر من المتبقي بالضمان', 'error');

      await app.withLock('reqPay_' + agId, async () => {
        const photoMedia = this.tempPayoutPhoto ? await app.saveMedia(this.tempPayoutPhoto, { kind: 'payout_proof' }) : '';
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingPayoutReq: {
            id: 'pr_' + Date.now(), days, gross, retentionHeld, netAmount, note, photoMedia,
            isFinalHandover: ag.paymentModel === 'lump_sum' || ag.paymentModel === 'b2b_supply',
            date: app.todayLocal()
          }
        });
        await app.sendNotification(ag.payerUid, `💸 طلب صرف جديد على العقد ${ag.ticketNumber}`, `${ag.providerName} يطلب صرف ${app.fmtMoney(netAmount)} ج.م — ${note}`);
        this.tempPayoutPhoto = '';
        document.getElementById('daman-req-pay-modal').classList.add('hidden');
        app.toast('تم إرسال طلب الصرف لصاحب العمل ✅', 'success');
      });
    },

    async approvePayoutRequest(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingPayoutReq || ag.payerUid !== app.user?.uid) return;
      const pr = ag.pendingPayoutReq;
      if (pr.isFinalHandover) return this.settleContractFinal(agId);

      const amt = Number(pr.netAmount || 0);
      if (!window.confirm(`اعتماد وصرف مبلغ ${app.fmtMoney(amt)} ج.م فوراً من الضمان لمحفظة ${ag.providerName}؟\nالبيان: ${pr.note}`)) return;

      await app.withLock('appPayReq_' + agId, async () => {
        const aRef = app.db.collection('chatAgreements').doc(agId);
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        try {
          await app.db.runTransaction(async (tx) => {
            const [aDoc, pDoc, wDoc] = await Promise.all([tx.get(aRef), tx.get(payerRef), tx.get(provRef)]);
            const a = aDoc.data();
            if (a.status !== 'funded' || !a.pendingPayoutReq) throw new Error('الطلب لم يعد متاحاً');
            if (Number(a.remainingEscrow || 0) < amt) throw new Error('المتبقي بالضمان لا يكفي');
            const pEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);
            const wAfter = Math.round((wAvail + amt) * 100) / 100;

            const logEntry = {
              date: app.todayLocal(), amount: amt, days: pr.days || 0,
              retentionHeld: pr.retentionHeld || 0, note: pr.note, photoMedia: pr.photoMedia || '',
              kind: a.paymentModel === 'daily_wages' ? 'daily_payout' : 'milestone_payout'
            };
            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - amt) * 100) / 100) });
            tx.update(provRef, { balanceAvailable: wAfter });
            tx.update(aRef, {
              remainingEscrow: Math.round((Number(a.remainingEscrow) - amt) * 100) / 100,
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + amt) * 100) / 100,
              payoutLogs: (Array.isArray(a.payoutLogs) ? a.payoutLogs : []).concat([logEntry]),
              pendingPayoutReq: null
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.providerUid, type: logEntry.kind, amount: amt, balanceBefore: wAvail, balanceAfter: wAfter,
              note: `صرف معتمد (${ag.ticketNumber}): ${pr.note}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(ag.providerUid, `✅ تم صرف ${app.fmtMoney(amt)} ج.م لمحفظتك`, `العقد ${ag.ticketNumber}: ${pr.note}`);
          app.toast(`تم اعتماد وصرف ${app.fmtMoney(amt)} ج.م بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async rejectPayoutRequest(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingPayoutReq || ag.payerUid !== app.user?.uid) return;
      const reason = window.prompt('سبب رفض طلب الصرف (سيظهر للمنفّذ):', 'لم يكتمل البند المطلوب بعد');
      if (reason === null) return;
      await app.db.collection('chatAgreements').doc(agId).update({ pendingPayoutReq: null });
      await app.sendNotification(ag.providerUid, `❌ تم رفض طلب الصرف (${ag.ticketNumber})`, reason || 'تواصل مع صاحب العمل في الشات');
      app.toast('تم رفض طلب الصرف وإبلاغ المنفّذ', 'info');
    },

    async openProposeDeductionModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.payerUid !== app.user?.uid || ag.contractStatus !== 'approved') return;
      if (ag.pendingDeduction) return app.toast('يوجد إشعار خصم معلّق بالفعل', 'warning');

      const rem = Number(ag.remainingEscrow || 0);
      const amt = Math.round((parseFloat(window.prompt(`إشعار خصم رسمي على المنفّذ (${ag.providerName}).\nالمتبقي بالضمان: ${app.fmtMoney(rem)} ج.م\nأدخل قيمة الخصم:`)) || 0) * 100) / 100;
      if (amt <= 0 || amt > rem) return app.toast('قيمة غير صالحة', 'error');
      const reason = window.prompt('سبب الخصم بالتفصيل:');
      if (!reason || !reason.trim()) return;

      await app.db.collection('chatAgreements').doc(agId).update({ pendingDeduction: { amount: amt, reason: reason.trim(), date: app.todayLocal() } });
      await app.sendNotification(ag.providerUid, `⚠️ إشعار خصم على العقد ${ag.ticketNumber}`, `مقترح خصم ${app.fmtMoney(amt)} ج.م — السبب: ${reason.trim()}`);
      app.toast('تم إرسال إشعار الخصم للمنفّذ للموافقة ✅', 'success');
    },

    async respondDeduction(agId, accept) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingDeduction || ag.providerUid !== app.user?.uid) return;
      const ded = ag.pendingDeduction;

      if (!accept) {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingDeduction: null });
        await app.sendNotification(ag.payerUid, `❌ رفض المنفّذ إشعار الخصم (${ag.ticketNumber})`, 'يمكنكم التفاهم في الشات أو فتح نزاع تحكيم.');
        return app.toast('تم رفض إشعار الخصم وإبلاغ صاحب العمل', 'info');
      }

      if (!window.confirm(`موافقتك ستخصم ${app.fmtMoney(ded.amount)} ج.م من متبقي العقد وتُعيدها لصاحب العمل. متأكد؟`)) return;
      await app.withLock('accDed_' + agId, async () => {
        const aRef = app.db.collection('chatAgreements').doc(agId);
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        try {
          await app.db.runTransaction(async (tx) => {
            const [aDoc, pDoc] = await Promise.all([tx.get(aRef), tx.get(payerRef)]);
            const a = aDoc.data();
            const dAmt = Number(a.pendingDeduction?.amount || 0);
            if (!dAmt || Number(a.remainingEscrow || 0) < dAmt) throw new Error('الخصم غير صالح');

            const rate = Number(a.commissionRate || app.getCommissionRate());
            const feeRefund = Math.min(Number(a.lockedFee || 0), Math.round(dAmt * rate * 100) / 100);
            const totalBackToPayer = Math.round((dAmt + feeRefund) * 100) / 100;
            const pAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
            const pEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            const pAfterAvail = Math.round((pAvail + totalBackToPayer) * 100) / 100;

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - totalBackToPayer) * 100) / 100), balanceAvailable: pAfterAvail });
            tx.update(aRef, {
              remainingEscrow: Math.round((Number(a.remainingEscrow) - dAmt) * 100) / 100,
              lockedFee: Math.max(0, Math.round((Number(a.lockedFee || 0) - feeRefund) * 100) / 100),
              totalDeductions: Math.round((Number(a.totalDeductions || 0) + dAmt) * 100) / 100,
              payoutLogs: (Array.isArray(a.payoutLogs) ? a.payoutLogs : []).concat([{ date: app.todayLocal(), amount: -dAmt, note: `خصم معتمد بالتراضي: ${ded.reason}`, kind: 'deduction' }]),
              pendingDeduction: null
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.payerUid, type: 'contract_deduction_refund', amount: totalBackToPayer,
              balanceBefore: pAvail, balanceAfter: pAfterAvail,
              note: `رد خصم متفق عليه (${ag.ticketNumber}): ${ded.reason}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(ag.payerUid, `✅ وافق المنفّذ على الخصم (${ag.ticketNumber})`, `تم رد ${app.fmtMoney(ded.amount)} ج.م + فرق العمولة إلى رصيدك المتاح.`);
          app.toast('تم تطبيق الخصم بالتراضي ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async disburseFromContract(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.payerUid !== app.user?.uid) return;
      if (ag.contractStatus !== 'approved') return app.toast('يجب اعتماد صورة العقد الموقّع من الإدارة أولاً', 'warning');

      const rem = Number(ag.remainingEscrow || 0);
      const amt = Math.round((parseFloat(window.prompt(`صرف دفعة مباشرة للمنفّذ (${ag.providerName}).\nالمتبقي بالضمان: ${app.fmtMoney(rem)} ج.م\nالمبلغ:`, String(Math.min(rem, 1000)))) || 0) * 100) / 100;
      if (amt <= 0 || amt > rem) return app.toast('مبلغ غير صالح', 'error');
      const note = window.prompt('بيان الصرف:', 'دفعة من حساب الأعمال المنفذة') || 'دفعة مستحقة';

      await app.withLock('disb_' + agId, async () => {
        const aRef = app.db.collection('chatAgreements').doc(agId);
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        try {
          await app.db.runTransaction(async (tx) => {
            const [aDoc, pDoc, wDoc] = await Promise.all([tx.get(aRef), tx.get(payerRef), tx.get(provRef)]);
            const a = aDoc.data();
            if (a.status !== 'funded' || Number(a.remainingEscrow || 0) < amt) throw new Error('المتبقي بالضمان لا يكفي');
            const pEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);
            const wAfter = Math.round((wAvail + amt) * 100) / 100;

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - amt) * 100) / 100) });
            tx.update(provRef, { balanceAvailable: wAfter });
            tx.update(aRef, {
              remainingEscrow: Math.round((Number(a.remainingEscrow) - amt) * 100) / 100,
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + amt) * 100) / 100,
              payoutLogs: (Array.isArray(a.payoutLogs) ? a.payoutLogs : []).concat([{ date: app.todayLocal(), amount: amt, note, kind: 'milestone_payout' }])
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.providerUid, type: 'milestone_payout', amount: amt, balanceBefore: wAvail, balanceAfter: wAfter,
              note: `دفعة من العقد ${ag.ticketNumber}: ${note}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(ag.providerUid, `💸 تم صرف ${app.fmtMoney(amt)} ج.م لحسابك`, `العقد ${ag.ticketNumber}: ${note}`);
          app.toast(`تم صرف ${app.fmtMoney(amt)} ج.م بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async extendContract(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.payerUid !== app.user?.uid) return;
      if (ag.contractStatus !== 'approved') return app.toast('يجب اعتماد العقد من الإدارة أولاً', 'warning');

      const extraDays = parseInt(window.prompt(`تمديد مدة العقد ${ag.ticketNumber}.\nعدد الأيام الإضافية (0 بدون تمديد وقت):`, '7'), 10) || 0;
      const extraAmount = Math.round((parseFloat(window.prompt('زيادة قيمة العقد بأعمال إضافية (ج.م):', '0')) || 0) * 100) / 100;
      if (extraDays <= 0 && extraAmount <= 0) return;

      const rate = Number(ag.commissionRate || app.getCommissionRate());
      const extraFee = Math.round(extraAmount * rate * 100) / 100;
      const totalLock = Math.round((extraAmount + extraFee) * 100) / 100;
      if (totalLock > Number(app.profile?.balanceAvailable || 0)) return app.toast(`رصيدك المتاح لا يكفي (${app.fmtMoney(totalLock)} ج.م)`, 'error');

      const newEnd = extraDays > 0 ? app.addDaysLocal(ag.endDate || app.todayLocal(), extraDays) : ag.endDate;
      if (!window.confirm(`تأكيد ملحق تعديل العقد ${ag.ticketNumber}؟\n• التسليم الجديد: ${newEnd}\n• زيادة: ${app.fmtMoney(extraAmount)} + عمولة ${app.fmtMoney(extraFee)} ج.م`)) return;

      await app.withLock('ext_' + agId, async () => {
        const aRef = app.db.collection('chatAgreements').doc(agId);
        const pRef = app.db.collection('users').doc(ag.payerUid);
        try {
          await app.db.runTransaction(async (tx) => {
            const [aDoc, pDoc] = await Promise.all([tx.get(aRef), tx.get(pRef)]);
            const a = aDoc.data();
            const curAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
            const curEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            if (curAvail < totalLock) throw new Error('الرصيد المتاح غير كافٍ');
            if (totalLock > 0) {
              const afterAvail = Math.round((curAvail - totalLock) * 100) / 100;
              tx.update(pRef, { balanceAvailable: afterAvail, balanceEscrow: Math.round((curEsc + totalLock) * 100) / 100 });
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.payerUid, type: 'escrow_lock', amount: -totalLock, balanceBefore: curAvail, balanceAfter: afterAvail,
                note: `ملحق زيادة العقد ${ag.ticketNumber}`, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(aRef, {
              endDate: newEnd, durationDays: Number(a.durationDays || 0) + extraDays,
              totalAmount: Math.round((Number(a.totalAmount || 0) + extraAmount) * 100) / 100,
              remainingEscrow: Math.round((Number(a.remainingEscrow || 0) + extraAmount) * 100) / 100,
              lockedFee: Math.round((Number(a.lockedFee || 0) + extraFee) * 100) / 100
            });
          });
          await app.sendNotification(ag.providerUid, `📅 تم تحديث/تمديد العقد ${ag.ticketNumber}`, `تاريخ التسليم الجديد: ${newEnd}`);
          app.toast('تم حفظ ملحق التمديد بنجاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async settleContractFinal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.payerUid !== app.user?.uid) return;
      if (ag.contractStatus !== 'approved') return app.toast('يجب اعتماد العقد الموقّع من الإدارة أولاً', 'warning');

      const rem = Number(ag.remainingEscrow || 0);
      const fee = Number(ag.lockedFee || 0);
      if (!window.confirm(`تأكيد الاستلام النهائي وإغلاق العقد ${ag.ticketNumber}؟\n• تحويل المتبقي (${app.fmtMoney(rem)} ج.م) لمحفظة المنفّذ.\n• تسوية عمولة الضمان (${app.fmtMoney(fee)} ج.م).`)) return;

      await app.withLock('settle_' + agId, async () => {
        const aRef = app.db.collection('chatAgreements').doc(agId);
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        try {
          await app.db.runTransaction(async (tx) => {
            const [aDoc, pDoc, wDoc] = await Promise.all([tx.get(aRef), tx.get(payerRef), tx.get(provRef)]);
            const a = aDoc.data();
            if (a.status !== 'funded') throw new Error('حالة العقد تغيرت بالفعل');
            const rEsc = Number(a.remainingEscrow || 0), lFee = Number(a.lockedFee || 0);
            const totalRelease = Math.round((rEsc + lFee) * 100) / 100;
            const pEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);
            const wAfter = Math.round((wAvail + rEsc) * 100) / 100;

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - totalRelease) * 100) / 100) });
            if (rEsc > 0) {
              tx.update(provRef, { balanceAvailable: wAfter });
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.providerUid, type: 'final_settlement', amount: rEsc, balanceBefore: wAvail, balanceAfter: wAfter,
                note: `تصفية نهائية للعقد ${ag.ticketNumber}: ${ag.title}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            if (lFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                type: 'escrow_commission', agreementId: agId, ticketNumber: ag.ticketNumber,
                userId: ag.payerUid, userName: ag.payerName || '', amount: lFee, cashPaid: lFee, bonusUsed: 0,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(aRef, {
              status: 'completed', remainingEscrow: 0, lockedFee: 0, pendingPayoutReq: null, pendingDeduction: null,
              payoutLogs: (Array.isArray(a.payoutLogs) ? a.payoutLogs : []).concat(rEsc > 0 ? [{ date: app.todayLocal(), amount: rEsc, note: 'التصفية النهائية ورد التأمين عند الاستلام', kind: 'final_settlement' }] : []),
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + rEsc) * 100) / 100,
              completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(ag.providerUid, `🏁 تم الاستلام والتصفية النهائية (${ag.ticketNumber})`, `تم تحويل المتبقي (${app.fmtMoney(rem)} ج.م) لمحفظتك.`);
          app.toast('تمت التصفية النهائية وإغلاق العقد بنجاح 🏁', 'success');
          this.openReviewModal(agId);
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async openDispute(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded') return;
      const reason = window.prompt(`فتح نزاع رسمي للتحكيم الإداري على العقد ${ag.ticketNumber}.\nاكتب سبب النزاع:`);
      if (!reason || !reason.trim()) return;
      await app.withLock('disp_' + agId, async () => {
        await app.db.collection('disputes').add({
          agreementId: agId, contractNumber: ag.ticketNumber, projectTitle: ag.title,
          contractAmount: ag.totalAmount, remainingEscrow: ag.remainingEscrow,
          clientId: ag.payerUid, providerId: ag.providerUid, openedByUid: app.user.uid,
          openedByName: app.profile?.name || '', reason: reason.trim(), status: 'open',
          date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.db.collection('chatAgreements').doc(agId).update({ status: 'disputed' });
        await app.sendNotification('ADMIN', `⚖️ نزاع رسمي جديد (${ag.ticketNumber})`, `${app.profile?.name}: ${reason.trim()}`);
        app.toast('تم فتح النزاع وتجميد الصرف لحين قرار التحكيم ⚖️', 'warning');
      });
    },

    // ==================== 4. HISTORY (PAYOUTS + VEHICLES/ADDONS), SIGNATURE, A4 PRINT & REVIEW ====================
    _openContractHistoryModalImpl(agId) {
      const app = window.DamanApp;
      const a = this.agreements.find((x) => x.id === agId);
      if (!a) return;
      const logs = Array.isArray(a.payoutLogs) ? a.payoutLogs : [];
      const addons = Array.isArray(a.addons) ? a.addons : [];
      let m = document.getElementById('daman-ct-hist-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-ct-hist-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[88vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex justify-between items-center"><h3 class="text-sm font-black text-amber-400">📜 سجل العقد والإضافات (${app.esc(a.ticketNumber)})</h3><button onclick="document.getElementById('daman-ct-hist-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="grid grid-cols-3 gap-1.5 text-center p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10.5px]">
            <div>إجمالي العقد<br/><b class="text-white">${app.fmtMoney(a.totalAmount)}</b></div>
            <div>المنصرف<br/><b class="text-emerald-400">${app.fmtMoney(a.paidSoFar || 0)}</b></div>
            <div>المتبقي<br/><b class="text-amber-300">${app.fmtMoney(a.remainingEscrow || 0)}</b></div>
          </div>

          <div class="space-y-1.5">
            <div class="font-black text-purple-300">🚗 السيارات والإضافات الملحقة بالعقد (${addons.length})</div>
            ${!addons.length ? '<div class="text-center text-slate-500 py-2">لا توجد سيارات أو إضافات مرفقة.</div>' : addons.map((ad, i) => `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-purple-500/30 space-y-1">
                <div class="flex justify-between gap-2">
                  <b class="text-white">${i + 1}. ${this.addonCategoryLabel(ad.category)} — ${app.esc(ad.title)}</b>
                  <b class="text-amber-300 shrink-0">${Number(ad.cost || 0) > 0 ? app.fmtMoney(ad.cost) + ' ج.م' : 'ضمن العقد'}</b>
                </div>
                ${ad.plateNumber || ad.driverName ? `<div class="text-[10px] text-amber-200">لوحة: <b>${app.esc(ad.plateNumber || '—')}</b> | السائق: <b>${app.esc(ad.driverName || '—')}</b></div>` : ''}
                ${ad.notes ? `<div class="text-[10px] text-slate-300">${app.esc(ad.notes)}</div>` : ''}
                <div class="flex justify-between text-[9.5px] text-slate-500">
                  <span>بواسطة: ${app.esc(ad.addedByName || '—')} • ${app.esc(ad.date || '')}</span>
                  ${ad.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${ad.photoMedia}','صورة الملحق')" class="text-sky-300 underline font-bold">عرض الصورة</button>` : ''}
                </div>
              </div>`).join('')}
          </div>

          <div class="space-y-1.5">
            <div class="font-black text-emerald-400">💸 سجل الدفعات واليوميات (${logs.length})</div>
            ${!logs.length ? '<div class="text-center text-slate-500 py-2">لم يتم صرف أي دفعات بعد.</div>' : logs.map((l, i) => `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-white">${i + 1}. ${app.esc(l.note || 'دفعة')}</div>
                  <div class="text-[10px] text-slate-400">${app.esc(l.date || '')}${l.days ? ` • ${l.days} يوم` : ''}${l.retentionHeld ? ` • تأمين: ${app.fmtMoney(l.retentionHeld)} ج.م` : ''}</div>
                  ${l.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${l.photoMedia}','إثبات الدفعة')" class="text-[10px] text-sky-300 underline font-bold">صورة الشغل</button>` : ''}
                </div>
                <b class="${Number(l.amount || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'} shrink-0">${app.fmtMoney(l.amount)} ج.م</b>
              </div>`).join('')}
          </div>
        </div>`;
    },

    _openSignatureModalImpl(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !app.user) return;
      const isPayer = ag.payerUid === app.user.uid;
      const isProv = ag.providerUid === app.user.uid;
      if (!isPayer && !isProv) return;

      let m = document.getElementById('daman-sig-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-sig-modal';
        m.className = 'daman-modal fixed inset-0 z-[92] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">✍️ توقيع العقد (${app.esc(ag.ticketNumber)})</h3><button onclick="document.getElementById('daman-sig-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="text-[11px] text-slate-300">وقّع بإصبعك داخل المستطيل الأبيض (${isPayer ? 'الطرف الأول — صاحب العمل' : 'الطرف الثاني — المنفّذ'}):</div>
          <canvas id="daman-sig-canvas" width="320" height="160" class="sig-pad w-full bg-white rounded-2xl border-2 border-amber-500"></canvas>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" onclick="DamanChat.clearSignatureCanvas()" class="py-2 rounded-xl bg-slate-800 text-slate-200 font-bold">مسح</button>
            <button type="button" onclick="DamanChat.saveSignature('${agId}','${isPayer ? 'payer' : 'provider'}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">اعتماد التوقيع</button>
          </div>
        </div>`;
      setTimeout(() => this.initSigCanvas(), 50);
    },

    initSigCanvas() {
      const c = document.getElementById('daman-sig-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      let drawing = false; this._sigHasStrokes = false;
      const getPos = (e) => {
        const r = c.getBoundingClientRect();
        const pt = e.touches ? e.touches[0] : e;
        return { x: ((pt.clientX - r.left) * c.width) / r.width, y: ((pt.clientY - r.top) * c.height) / r.height };
      };
      const start = (e) => { drawing = true; this._sigHasStrokes = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); };
      const move = (e) => { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); };
      const end = () => { drawing = false; };
      c.onmousedown = start; c.onmousemove = move; window.onmouseup = end;
      c.ontouchstart = start; c.ontouchmove = move; c.ontouchend = end;
    },

    clearSignatureCanvas() {
      const c = document.getElementById('daman-sig-canvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      this._sigHasStrokes = false;
    },

    async saveSignature(agId, role) {
      if (!this._sigHasStrokes) return window.DamanApp.toast('وقّع داخل المستطيل الأبيض أولاً', 'warning');
      const dataUrl = document.getElementById('daman-sig-canvas').toDataURL('image/png');
      await window.DamanApp.db.collection('chatAgreements').doc(agId).update({ [role === 'payer' ? 'payerSigBase64' : 'providerSigBase64']: dataUrl });
      document.getElementById('daman-sig-modal').classList.add('hidden');
      window.DamanApp.toast('تم حفظ توقيعك الرسمي على العقد ✅', 'success');
    },

    _printContractA4Impl(agId) {
      const app = window.DamanApp;
      const a = this.agreements.find((x) => x.id === agId);
      if (!a) return;
      const verifyUrl = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(a.ticketNumber)}`;
      const logs = Array.isArray(a.payoutLogs) ? a.payoutLogs : [];
      const addons = Array.isArray(a.addons) ? a.addons : [];
      const addonRows = addons.map((ad, i) => `<tr><td>${i + 1}</td><td>${this.addonCategoryLabel(ad.category)}</td><td><b>${app.esc(ad.title)}</b>${ad.plateNumber ? ' — لوحة: ' + app.esc(ad.plateNumber) : ''}${ad.driverName ? ' — سائق: ' + app.esc(ad.driverName) : ''}${ad.notes ? '<br/>' + app.esc(ad.notes) : ''}</td><td><b>${Number(ad.cost || 0) > 0 ? app.fmtMoney(ad.cost) + ' ج.م' : 'ضمن العقد'}</b></td></tr>`).join('');
      const logRows = logs.map((l, i) => `<tr><td>${i + 1}</td><td>${app.esc(l.date || '')}</td><td>${app.esc(l.note || '')}</td><td><b>${app.fmtMoney(l.amount)} ج.م</b></td></tr>`).join('');

      const html = `
        <div style="border:2px solid #000; padding:12px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:8px;">
            <div>
              <h2 style="margin:0; font-size:16px;">عقد مقاولة / توريد رسمي بضمان مالي — ${app.esc(app.t('appName'))}</h2>
              <div style="font-size:10.5px;">وثيقة تعاقد إلكترونية موثّقة بالهوية والرقم القومي</div>
            </div>
            <div style="text-align:left; font-size:10.5px;">
              <div><b>كود العقد:</b> ${app.esc(a.ticketNumber)}</div>
              <div><b>التاريخ:</b> ${app.esc(a.date || app.todayLocal())}</div>
            </div>
          </div>

          <h4 style="margin:5px 0 3px;">أولاً: بيانات طرفي التعاقد (من بطاقات الرقم القومي الموثّقة)</h4>
          <table style="margin-bottom:8px;">
            <tr><th style="width:20%;">الطرف الأول (صاحب العمل)</th><td style="width:30%;"><b>${app.esc(a.payerLegalName || a.payerName)}</b>${a.payerCR ? '<br/>س.ت: ' + app.esc(a.payerCR) : ''}</td><th style="width:20%;">الرقم القومي</th><td style="width:30%;"><b>${app.esc(a.payerNationalId || '—')}</b></td></tr>
            <tr><th>العنوان</th><td>${app.esc(a.payerAddress || '—')}</td><th>الهاتف</th><td>${app.esc(a.payerPhone || '—')}</td></tr>
            <tr><th>الطرف الثاني (المنفّذ)</th><td><b>${app.esc(a.providerLegalName || a.providerName)}</b>${a.providerCR ? '<br/>س.ت: ' + app.esc(a.providerCR) : ''}</td><th>الرقم القومي</th><td><b>${app.esc(a.providerNationalId || '—')}</b></td></tr>
            <tr><th>العنوان</th><td>${app.esc(a.providerAddress || '—')}</td><th>الهاتف</th><td>${app.esc(a.providerPhone || '—')}</td></tr>
          </table>

          <h4 style="margin:5px 0 3px;">ثانياً: نطاق الأعمال، التواريخ، ونظام الصرف</h4>
          <table style="margin-bottom:8px;">
            <tr><th style="width:24%;">موضوع العقد</th><td colspan="3"><b>${app.esc(a.title)}</b></td></tr>
            <tr><th>موقع التنفيذ</th><td colspan="3">${app.esc(a.location || '—')}</td></tr>
            <tr><th>تاريخ البداية</th><td><b>${app.esc(a.startDate || a.date || '—')}</b></td><th>تاريخ التسليم</th><td><b>${app.esc(a.endDate || '—')} (${a.durationDays || '—'} يوم)</b></td></tr>
            <tr><th>إجمالي العقد</th><td><b>${app.fmtMoney(a.totalAmount)} ج.م</b></td><th>نظام الصرف</th><td><b>${this.paymentModelLabel(a.paymentModel)}</b></td></tr>
            <tr><th>ميعاد الصرف</th><td>${this.payoutScheduleLabel(a.payoutSchedule)}${a.dailyRate ? ` — اليومية: ${app.fmtMoney(a.dailyRate)} ج.م` : ''}</td><th>التأمين المحتجز</th><td>${a.retentionPct ? a.retentionPct + '% حتى التسليم' : 'لا يوجد'}</td></tr>
            <tr><th>غرامة التأخير</th><td>${a.delayPenaltyPerDay ? app.fmtMoney(a.delayPenaltyPerDay) + ' ج.م / يوم' : 'حسب التقييم'}</td><th>ضمان الأعمال</th><td>${a.warrantyDays ? a.warrantyDays + ' يوم' : 'حسب الأصول الفنية'}</td></tr>
            <tr><th>المواصفات والشروط</th><td colspan="3" style="white-space:pre-line;">${app.esc(a.scopeDetails || '—')}</td></tr>
          </table>

          ${addons.length ? `
            <h4 style="margin:5px 0 3px;">ثالثاً: السيارات والمعدات والإضافات الملحقة بالعقد</h4>
            <table style="margin-bottom:8px;">
              <thead><tr><th style="width:6%;">#</th><th style="width:20%;">النوع</th><th>البيان (اللوحة / السائق / التفاصيل)</th><th style="width:18%;">التكلفة</th></tr></thead>
              <tbody>${addonRows}</tbody>
            </table>` : ''}

          ${logs.length ? `
            <h4 style="margin:5px 0 3px;">كشف الدفعات واليوميات (المنصرف: ${app.fmtMoney(a.paidSoFar || 0)} ج.م | المتبقي: ${app.fmtMoney(a.remainingEscrow || 0)} ج.م)</h4>
            <table style="margin-bottom:8px;">
              <thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead>
              <tbody>${logRows}</tbody>
            </table>` : ''}

          <div style="border:1px solid #000; padding:6px 8px; font-size:10px; margin-bottom:8px;">
            1. يقر الطرفان بحجز 100% من قيمة هذا العقد في محفظة الضمان المالي لدى المنصة، ولا يُصرف أي مبلغ إلا بموافقة إلكترونية صريحة من صاحب العمل أو بقرار تحكيم إداري.<br/>
            2. في حالة النزاع، تُعدّ المحادثات وصور التنفيذ وتسجيلات المكالمات داخل التطبيق حجة قاطعة، ويكون قرار التحكيم الإداري ملزماً للطرفين.
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 105px; gap:10px; align-items:center; margin-top:10px; text-align:center;">
            <div style="border:1px solid #000; padding:5px;">
              <div style="font-weight:bold; font-size:10.5px;">توقيع الطرف الأول (صاحب العمل)</div>
              <div style="font-size:9.5px;">${app.esc(a.payerLegalName || a.payerName)}</div>
              <div style="height:50px; display:flex; align-items:center; justify-content:center;">${a.payerSigBase64 ? `<img src="${a.payerSigBase64}" style="max-height:46px; max-width:130px;" />` : '.......................'}</div>
            </div>
            <div style="border:1px solid #000; padding:5px;">
              <div style="font-weight:bold; font-size:10.5px;">توقيع الطرف الثاني (المنفّذ)</div>
              <div style="font-size:9.5px;">${app.esc(a.providerLegalName || a.providerName)}</div>
              <div style="height:50px; display:flex; align-items:center; justify-content:center;">${a.providerSigBase64 ? `<img src="${a.providerSigBase64}" style="max-height:46px; max-width:130px;" />` : '.......................'}</div>
            </div>
            <div style="text-align:center;"><div id="print-contract-qr" style="display:inline-block;"></div><div style="font-size:8px; margin-top:2px;">امسح للتحقق</div></div>
          </div>
        </div>`;

      window.DamanPrint(html, (area) => {
        const el = area.querySelector('#print-contract-qr');
        if (el && window.QRCode) new QRCode(el, { text: verifyUrl, width: 88, height: 88, colorDark: '#000', colorLight: '#fff' });
      });
    },

    async uploadSignedContractPhoto(input, agId) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      if (!f || !app.user) return;
      input.value = '';
      try {
        app.toast('جارٍ رفع صورة العقد الموقّع...', 'info');
        const b64 = await app.compressImage(f, 920, 0.62);
        const mediaId = await app.saveMedia(b64, { kind: 'signed_contract' });
        const ag = this.agreements.find((x) => x.id === agId);
        await app.db.collection('chatAgreements').doc(agId).update({
          signedContractMedia: mediaId, contractStatus: 'pending_admin',
          signedUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', `📄 عقد موقّع بانتظار الاعتماد (${ag?.ticketNumber || ''})`, `${ag?.title || ''} — ${app.fmtMoney(ag?.totalAmount || 0)} ج.م`);
        app.toast('تم رفع صورة العقد الموقّع وإرسالها للإدارة ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    _openReviewModalImpl(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !app.user) return;
      const isPayer = ag.payerUid === app.user.uid;
      const targetUid = isPayer ? ag.providerUid : ag.payerUid;
      const targetName = isPayer ? ag.providerName : ag.payerName;

      let m = document.getElementById('daman-rev-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-rev-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex justify-between items-center"><h3 class="text-sm font-black text-amber-400">⭐ تقييم التعامل مع ${app.esc(targetName)}</h3><button onclick="document.getElementById('daman-rev-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanChat.submitReview(event,'${agId}','${targetUid}',${isPayer})" class="space-y-2.5">
            <select id="rv-stars" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-black">
              <option value="5">⭐⭐⭐⭐⭐ ممتاز (5/5)</option>
              <option value="4">⭐⭐⭐⭐ جيد جداً (4/5)</option>
              <option value="3">⭐⭐⭐ جيد (3/5)</option>
              <option value="2">⭐⭐ مقبول (2/5)</option>
              <option value="1">⭐ ضعيف (1/5)</option>
            </select>
            <textarea id="rv-comment" rows="3" required placeholder="اكتب رأيك في الالتزام وجودة العمل..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إرسال التقييم</button>
          </form>
        </div>`;
    },

    async submitReview(e, agId, targetUid, isPayer) {
      e.preventDefault();
      const app = window.DamanApp;
      const rating = parseInt(document.getElementById('rv-stars').value, 10) || 5;
      const comment = document.getElementById('rv-comment').value.trim();
      try {
        await app.db.collection('reviews').add({
          agreementId: agId, targetUserId: targetUid, fromUid: app.user.uid,
          fromName: app.profile?.companyName || app.profile?.name || '',
          rating, comment, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const tRef = app.db.collection('users').doc(targetUid);
        await app.db.runTransaction(async (tx) => {
          const d = (await tx.get(tRef)).data() || {};
          const cnt = Number(d.ratingCount || 0), avg = Number(d.ratingAvg || 5), newCnt = cnt + 1;
          tx.update(tRef, { ratingCount: newCnt, ratingAvg: Math.round(((avg * cnt + rating) / newCnt) * 10) / 10 });
        });
        await app.db.collection('chatAgreements').doc(agId).update({ [isPayer ? 'ratedByPayer' : 'ratedByProvider']: true });
        document.getElementById('daman-rev-modal').classList.add('hidden');
        app.toast('شكراً لتقييمك ⭐', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    }
  };

  if (window.DamanChat && typeof window.DamanChat.registerExtras === 'function') {
    window.DamanChat.registerExtras(ChatExtras);
  } else {
    window.__damanChatExtrasPending = ChatExtras;
  }
})();
