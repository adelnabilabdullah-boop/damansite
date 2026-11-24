(function () {
  if (!window.DamanToggleHelp) {
    window.DamanToggleHelp = function (id) {
      const el = document.getElementById('fh-' + id);
      if (el) el.classList.toggle('hidden');
    };
  }

  const FIELD_HINTS = [
    [['كود الشركة', 'company code', 'انضمام'], 'أدخل كود الشركة (مثال: CMP-123456) الذي استلمته من مدير الشركة للانضمام فوراً لفريق العمل.'],
    [['اسم الشركة'], 'اكتب الاسم الرسمي لشركة المقاولات كما سيظهر في التقارير اليومية وكشوف الرواتب الـ A4.'],
    [['سجل تجاري', 'ضريبية'], 'أرقام السجل التجاري والبطاقة الضريبية (اختياري) لإظهارها في الترويسة الرسمية لمطبوعات الشركة.'],
    [['اسم الموقع', 'المشروع', 'فلتر الموقع'], 'حدد اسم الموقع أو الكمبوند (مثال: مشروع سعادة) لفصل حضور العمال والمستخلصات والتقارير لكل موقع لوحده.'],
    [['الوردية', 'بداية', 'نهاية', 'ساعات العمل'], 'حدد مواعيد بداية ونهاية الوردية لحساب التأخير وساعات العمل الإضافي تلقائياً بدقة.'],
    [['gps', 'إحداثيات', 'نطاق', 'المسافة'], 'يتم التحقق من وجود الموظف داخل نطاق الموقع الجغرافي المحدد قبل تسجيل الحضور والانصراف.'],
    [['إضافي', 'سهر', 'أوفرتايم', 'ساعات'], 'سجل عدد ساعات الإضافي أو السهر والملاحظة — عند الاعتماد يُضاف أجرها تلقائياً لكشف الراتب ويصل إشعار فوري للموظف.'],
    [['خصم', 'جزاء', 'غرامة'], 'أدخل قيمة الخصم وسببه بالتفصيل ليُخصم من صافي الراتب أو المستخلص ويصل به إشعار رسمي للموظف فوراً.'],
    [['سلفة', 'سلف'], 'سجل قيمة السلفة المصروفة للموظف ليتم خصمها تلقائياً عند تصفية كشف الرواتب الشهري.'],
    [['راتب', 'أساسي', 'يومية', 'أجر'], 'أدخل الراتب الشهري أو أجر اليومية الأساسي الذي يُحسب عليه صافي المستحق والإضافي والخصومات.'],
    [['مقاول', 'باطن', 'مستخلص'], 'سجل بيانات مقاول الباطن والبند والكمية والسعر لاستخراج مستخلص A4 رسمي وحساب الصافي بعد الخصومات.'],
    [['مخزن', 'خامات', 'توريد', 'كمية', 'صنف'], 'سجل اسم الخامة والكمية الواردة أو المنصرفة ورقم البون/العربية لمتابعة رصيد المخزن بدقة.'],
    [['صب', 'خرسانة', 'متر مكعب', 'إجهاد'], 'وثّق كمية الخرسانة بالمتر المكعب ونوع الإجهاد واسم المحطة والعنصر المصبوب في سجل الموقع.'],
    [['معدة', 'معدات', 'ونش', 'سيارة'], 'سجل نوع المعدة وعدد ساعات التشغيل أو الإيجار اليومي واسم المشغّل.'],
    [['وحدة', 'فيلا', 'عمارة', 'نسبة', 'إنجاز', 'استشاري'], 'تابع نسبة إنجاز كل فيلا أو وحدة وسجل ملاحظات الاستشاري بالصور (قبل وبعد التنفيذ) حتى الإغلاق.'],
    [['عهدة', 'مصروف', 'فاتورة'], 'سجل المبلغ المسلم كعهدة أو المصروف مع إرفاق صورة الفاتورة لتسهيل تصفية العهدة بالـ A4.'],
    [['تقرير', 'يومي', 'أعمال', 'منفذة', 'عمالة'], 'لخّص الأعمال المنفذة اليوم وعدد العمال والمعدات والمعوقات لإصدار التقرير اليومي الموقّع من المشرف والمهندس ومدير المشروع.'],
    [['ميزانية', 'مهمة', 'مهام', 'أولوية'], 'حدد الميزانية التقديرية أو المهمة المطلوبة وتاريخ التسليم لمتابعة الانحرافات والتنفيذ.'],
    [['إجازة', 'أيام', 'سبب'], 'حدد نوع الإجازة وعدد أيامها والسبب — عند موافقة المدير أو رفضه يصل إشعار فوري لصاحب الطلب.'],
    [['الموظف', 'العامل', 'المستلم', 'المسؤول'], 'اختر الموظف أو العامل المعني بهذه الحركة من قائمة أعضاء الشركة المسجّلين.'],
    [['المبلغ', 'القيمة', 'السعر', 'التكلفة'], 'أدخل القيمة المالية بالجنيه المصري بدقة ليتم احتسابها في الكشوفات والتقارير المالية.'],
    [['التاريخ', 'من تاريخ', 'إلى تاريخ'], 'اختر التاريخ الدقيق لتنفيذ الحركة أو الفترة المحاسبية المطلوبة.'],
    [['ملاحظ', 'بيان', 'تفاصيل', 'وصف'], 'اكتب توضيحاً مختصراً ودقيقاً للبيان — يظهر هذا النص في الإشعارات وفي النسخة المطبوعة A4.']
  ];

  const CompanyEnh = {
    activeCompanyId: null,
    activeCompanyName: '',
    members: [],
    unsubMembers: null,
    unsubOps: null,
    unsubCustody: null,
    lastActionAt: 0,
    sentKeys: new Set(),
    _helpCounter: 0,
    _obs: null,
    _enhanceTimer: null,
    _booted: false,

    findHint(text) {
      const norm = (window.DamanApp && DamanApp.normalizeAr)
        ? DamanApp.normalizeAr(text)
        : String(text || '').toLowerCase();
      if (!norm) return '';
      for (const [keys, hint] of FIELD_HINTS) {
        if (keys.some((k) => norm.includes((window.DamanApp && DamanApp.normalizeAr) ? DamanApp.normalizeAr(k) : k))) {
          return hint;
        }
      }
      return '';
    },

    injectHelpIcons(root) {
      if (!root) return;
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'company') return;

      const labels = root.querySelectorAll('form label');
      labels.forEach((lbl) => {
        if (lbl.dataset.chHelpDone) return;
        if (lbl.querySelector('input[type="checkbox"], input[type="radio"], input[type="file"]')) return;
        const txt = (lbl.textContent || '').trim();
        if (!txt || txt.length < 2) return;
        const hint = this.findHint(txt);
        if (!hint) return;

        lbl.dataset.chHelpDone = '1';
        const hid = 'cmp_' + (++this._helpCounter);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'شرح الخانة';
        btn.className = 'inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/25 border border-sky-400/70 text-sky-300 text-[9.5px] font-black ms-1 align-middle';
        btn.textContent = '؟';
        btn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          window.DamanToggleHelp(hid);
        };
        lbl.appendChild(btn);

        const box = document.createElement('div');
        box.id = 'fh-' + hid;
        box.className = 'hidden mt-1 mb-1.5 p-2 rounded-xl bg-sky-950/95 border border-sky-400/60 text-[10.5px] text-sky-100 leading-relaxed font-semibold shadow-lg';
        box.textContent = '💡 ' + hint;
        lbl.insertAdjacentElement('afterend', box);
      });

      // Fallback for inputs/selects inside forms that have placeholder but no <label>
      const fields = root.querySelectorAll('form input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), form select, form textarea');
      fields.forEach((el) => {
        if (el.dataset.chHelpDone) return;
        const parent = el.parentElement;
        if (!parent || parent.querySelector('label[data-ch-help-done="1"]')) return;
        const ph = el.getAttribute('placeholder') || el.getAttribute('aria-label') || '';
        const hint = this.findHint(ph);
        if (!hint) return;

        el.dataset.chHelpDone = '1';
        const hid = 'cmpi_' + (++this._helpCounter);
        const wrap = document.createElement('div');
        wrap.className = 'flex items-center justify-between text-[9.5px] text-slate-400 font-bold mb-0.5 px-0.5';
        wrap.innerHTML = `<span class="truncate">${app.esc(ph.slice(0, 34))}</span>`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/25 border border-sky-400/70 text-sky-300 text-[9px] font-black shrink-0';
        btn.textContent = '؟';
        btn.onclick = (ev) => { ev.preventDefault(); window.DamanToggleHelp(hid); };
        wrap.appendChild(btn);

        const box = document.createElement('div');
        box.id = 'fh-' + hid;
        box.className = 'hidden mb-1 p-2 rounded-xl bg-sky-950/95 border border-sky-400/60 text-[10.5px] text-sky-100 leading-relaxed font-semibold';
        box.textContent = '💡 ' + hint;

        el.parentNode.insertBefore(wrap, el);
        el.parentNode.insertBefore(box, el);
      });
    },

    // ==================== QUICK MANUAL NOTIFICATION BAR FOR MANAGERS ====================
    injectNotifyBar(root) {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'company' || !this.activeCompanyId) return;
      if (document.getElementById('daman-comp-notif-bar')) return;
      const firstChild = root.firstElementChild;
      if (!firstChild) return;

      const bar = document.createElement('div');
      bar.id = 'daman-comp-notif-bar';
      bar.className = 'glass-card rounded-2xl p-2.5 border-sky-500/40 flex items-center justify-between gap-2 text-[11px] mb-2';
      bar.innerHTML = `
        <div class="min-w-0">
          <div class="font-black text-sky-300 truncate"><i class="fa-solid fa-bell me-1"></i> إشعارات الموظفين التلقائية مفعّلة ✅</div>
          <div class="text-[9.5px] text-slate-400 truncate">إضافي، خصومات، سلف، رواتب، عهدة، وإجازات + شرح (؟) لكل خانة</div>
        </div>
        <button type="button" onclick="DamanCompanyEnh.openQuickNotifyModal()" class="px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px] shrink-0">إرسال تنبيه</button>`;
      firstChild.insertBefore(bar, firstChild.firstElementChild);
    },

    openQuickNotifyModal() {
      const app = window.DamanApp;
      if (!this.members.length) return app.toast('لا يوجد أعضاء مسجّلين في الشركة بعد', 'info');
      let m = document.getElementById('daman-comp-qnotif-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-comp-qnotif-modal';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const others = this.members.filter((x) => x.userId && x.userId !== app.user?.uid);
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-black text-sky-400">🔔 إرسال إشعار فوري لفريق الشركة</h3>
            <button type="button" onclick="document.getElementById('daman-comp-qnotif-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanCompanyEnh.sendManualCompanyNotif(event)" class="space-y-2.5">
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">المستلم *</label>
              <select id="cqn-to" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-bold">
                <option value="ALL">📢 جميع أعضاء الشركة (${others.length})</option>
                ${others.map((mem) => `<option value="${app.esc(mem.userId)}">${app.esc(mem.name)} (${app.esc(mem.jobTitle || 'عضو')})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">عنوان الإشعار *</label>
              <input id="cqn-title" type="text" required placeholder="مثال: تعليمات موقع / موعد صرف الرواتب" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">نص الرسالة *</label>
              <textarea id="cqn-body" rows="3" required placeholder="اكتب التفاصيل هنا..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">إرسال الإشعار الآن</button>
          </form>
        </div>`;
    },

    async sendManualCompanyNotif(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const to = document.getElementById('cqn-to')?.value;
      const title = document.getElementById('cqn-title')?.value.trim();
      const body = document.getElementById('cqn-body')?.value.trim();
      if (!title || !body) return;

      const targets = to === 'ALL'
        ? this.members.map((m) => m.userId).filter((u) => u && u !== app.user?.uid)
        : [to];
      if (!targets.length) return app.toast('لا يوجد مستلمين', 'warning');

      await Promise.all(targets.map((uid) => app.sendNotification(uid, `🏢 ${title}`, body)));
      document.getElementById('daman-comp-qnotif-modal')?.classList.add('hidden');
      app.toast(`تم إرسال الإشعار إلى ${targets.length} عضو بنجاح 🔔`, 'success');
    },

    // ==================== AUTOMATIC REAL-TIME EMPLOYEE NOTIFICATIONS ====================
    resolveActiveCompanyId() {
      const comp = window.DamanCompany;
      if (!comp) return null;
      return comp.activeCompanyId || comp.selectedCompanyId || comp.companyId || comp.company?.id || comp.currentCompany?.id || null;
    },

    resolveTargetUid(doc) {
      const direct = doc.targetUid || doc.employeeUid || doc.memberUid || doc.holderUid || doc.assignedToUid || doc.userId;
      if (direct && this.members.some((m) => m.userId === direct)) return direct;
      if (doc.memberId) {
        const byMid = this.members.find((m) => m.id === doc.memberId);
        if (byMid?.userId) return byMid.userId;
      }
      const nameVal = doc.employeeName || doc.memberName || doc.workerName || doc.holderName || doc.userName || doc.name || '';
      if (nameVal && window.DamanApp) {
        const n = DamanApp.normalizeAr(nameVal);
        const byName = this.members.find((m) => DamanApp.normalizeAr(m.name) === n);
        if (byName?.userId) return byName.userId;
      }
      return direct || '';
    },

    buildNotificationFromDoc(colName, changeType, doc) {
      const app = window.DamanApp;
      const amt = Number(doc.amount || doc.netSalary || doc.netPay || doc.value || 0);
      const amtTxt = amt > 0 ? `${app.fmtMoney(amt)} ج.م` : '';
      const rawKind = String(doc.opType || doc.type || doc.kind || doc.category || '').toLowerCase();
      const st = String(doc.status || '').toLowerCase();
      const note = doc.reason || doc.note || doc.description || doc.title || '';
      const site = doc.siteName ? ` — موقع: ${doc.siteName}` : '';

      if (colName === 'companyCustody') {
        if (changeType === 'added') {
          return {
            title: `🧾 حركة عهدة جديدة${amtTxt ? ` (${amtTxt})` : ''}`,
            body: `${note || 'تم تسجيل حركة عهدة على حسابك'}${site}`
          };
        }
        if (st === 'approved' || st === 'settled') {
          return { title: `✅ تم اعتماد وتصفية العهدة${amtTxt ? ` (${amtTxt})` : ''}`, body: `${note || 'تمت مراجعة العهدة بنجاح'}${site}` };
        }
        if (st === 'rejected') {
          return { title: '❌ تم رفض حركة العهدة', body: note || 'راجع مدير الشركة للتفاصيل' };
        }
        return null;
      }

      if (colName === 'companyMembers' && changeType === 'modified') {
        if (st === 'suspended') return { title: '⚠️ تم إيقاف عضويتك بالشركة مؤقتاً', body: 'تواصل مع إدارة الشركة لمزيد من التفاصيل.' };
        if (st === 'active') return { title: '✅ تم تحديث بيانات عضويتك بالشركة', body: doc.baseSalary ? `الراتب الأساسي المسجّل: ${app.fmtMoney(doc.baseSalary)} ج.م` : 'تم تحديث ملفك الوظيفي.' };
        return null;
      }

      // companyOps (overtime, deduction, advance, payroll/salary, leave, task)
      if (rawKind.includes('overtime') || rawKind.includes('extra') || rawKind.includes('سهر') || rawKind.includes('إضاف')) {
        const hrs = doc.hours ? `${doc.hours} ساعة` : '';
        if (st === 'approved') return { title: `✅ تمت الموافقة على الإضافي/السهر${hrs ? ` (${hrs})` : ''}`, body: `${amtTxt ? 'القيمة: ' + amtTxt + ' • ' : ''}${note || 'أُضيف إلى كشف راتبك'}${site}` };
        if (st === 'rejected') return { title: '❌ تم رفض طلب الإضافي/السهر', body: note || 'راجع مدير الموقع للتفاصيل' };
        if (changeType === 'added') return { title: `⏱️ تسجيل ساعات إضافي/سهر${hrs ? ` (${hrs})` : ''}`, body: `${amtTxt ? 'القيمة: ' + amtTxt + ' • ' : ''}${note}${site}` };
      }

      if (rawKind.includes('deduct') || rawKind.includes('penalty') || rawKind.includes('خصم') || rawKind.includes('جزاء')) {
        return { title: `⚠️ تم تسجيل خصم مالي${amtTxt ? ` (${amtTxt})` : ''}`, body: `${note || 'خصم مسجّل من إدارة الشركة'}${site}` };
      }

      if (rawKind.includes('advance') || rawKind.includes('loan') || rawKind.includes('سلف')) {
        if (st === 'rejected') return { title: '❌ تم رفض طلب السلفة', body: note || 'راجع إدارة الشركة' };
        return { title: `💵 تسجيل/اعتماد سلفة${amtTxt ? ` (${amtTxt})` : ''}`, body: `${note || 'سُجّلت السلفة على حساب راتبك'}${site}` };
      }

      if (rawKind.includes('salary') || rawKind.includes('payroll') || rawKind.includes('راتب') || rawKind.includes('مرتب')) {
        return { title: `💰 تم صرف/اعتماد الراتب${amtTxt ? ` (${amtTxt})` : ''}`, body: `${note || 'راجع كشف راتبك داخل لوحة الشركة'}${site}` };
      }

      if (rawKind.includes('leave') || rawKind.includes('vacation') || rawKind.includes('إجاز')) {
        if (st === 'approved') return { title: '✅ تمت الموافقة على طلب الإجازة', body: `${doc.days ? doc.days + ' يوم • ' : ''}${note || 'إجازة سعيدة'}` };
        if (st === 'rejected') return { title: '❌ تم رفض طلب الإجازة', body: note || 'تواصل مع مديرك المباشر' };
      }

      if (rawKind.includes('task') || rawKind.includes('مهم')) {
        return { title: `📋 مهمة عمل جديدة${site}`, body: note || 'تم إسناد مهمة جديدة إليك في لوحة الشركة' };
      }

      if (st === 'approved' || st === 'paid') {
        return { title: `✅ تم اعتماد طلبك في الشركة${amtTxt ? ` (${amtTxt})` : ''}`, body: `${note || 'تمت الموافقة من الإدارة'}${site}` };
      }
      if (st === 'rejected') {
        return { title: '❌ تم رفض طلبك في الشركة', body: `${note || 'راجع إدارة الشركة للتفاصيل'}${site}` };
      }
      return null;
    },

    detachCompanyWatchers() {
      ['unsubMembers', 'unsubOps', 'unsubCustody'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      this.activeCompanyId = null;
      this.members = [];
    },

    attachCompanyWatchers(cid) {
      const app = window.DamanApp;
      if (!app || !app.db || !app.user || !cid) return;
      if (this.activeCompanyId === cid) return;
      this.detachCompanyWatchers();
      this.activeCompanyId = cid;

      let memReady = false;
      this.unsubMembers = app.db.collection('companyMembers').where('companyId', '==', cid).limit(120).onSnapshot((snap) => {
        this.members = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
        if (!memReady) { memReady = true; return; }
        this.handleDocChanges('companyMembers', snap.docChanges());
      }, () => {});

      let opsReady = false;
      this.unsubOps = app.db.collection('companyOps').where('companyId', '==', cid).limit(100).onSnapshot((snap) => {
        if (!opsReady) { opsReady = true; return; }
        this.handleDocChanges('companyOps', snap.docChanges());
      }, () => {});

      let cusReady = false;
      this.unsubCustody = app.db.collection('companyCustody').where('companyId', '==', cid).limit(80).onSnapshot((snap) => {
        if (!cusReady) { cusReady = true; return; }
        this.handleDocChanges('companyCustody', snap.docChanges());
      }, () => {});
    },

    handleDocChanges(colName, changes) {
      const app = window.DamanApp;
      if (!app || !app.user || app.activeTab !== 'company') return;
      // Only send notifications when this user just triggered a click/submit in the Company Panel
      if (Date.now() - this.lastActionAt > 12000) return;

      changes.forEach((ch) => {
        if (ch.type !== 'added' && ch.type !== 'modified') return;
        const doc = Object.assign({ id: ch.doc.id }, ch.doc.data());
        const targetUid = this.resolveTargetUid(doc);
        if (!targetUid || targetUid === app.user.uid) return;

        const dedupKey = `${colName}_${doc.id}_${ch.type}_${doc.status || ''}_${doc.amount || doc.baseSalary || ''}`;
        if (this.sentKeys.has(dedupKey)) return;

        const payload = this.buildNotificationFromDoc(colName, ch.type, doc);
        if (!payload) return;

        this.sentKeys.add(dedupKey);
        if (this.sentKeys.size > 200) this.sentKeys.clear();
        app.sendNotification(targetUid, payload.title, payload.body).catch(() => {});
      });
    },

    onCompanyScreenUpdated() {
      const main = document.getElementById('app-main');
      const app = window.DamanApp;
      if (!main || !app || app.activeTab !== 'company') return;

      const cid = this.resolveActiveCompanyId();
      if (cid) this.attachCompanyWatchers(cid);
      this.injectNotifyBar(main);
      this.injectHelpIcons(main);
    },

    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      // Track manager actions inside Company Panel to fire employee notifications cleanly without duplicates
      document.addEventListener('click', (ev) => {
        if (window.DamanApp?.activeTab === 'company' && ev.target.closest('#app-main')) {
          this.lastActionAt = Date.now();
        }
      }, true);
      document.addEventListener('submit', (ev) => {
        if (window.DamanApp?.activeTab === 'company' && ev.target.closest('#app-main')) {
          this.lastActionAt = Date.now();
        }
      }, true);

      const main = document.getElementById('app-main');
      if (main && typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(() => {
          if (window.DamanApp?.activeTab !== 'company') return;
          clearTimeout(this._enhanceTimer);
          this._enhanceTimer = setTimeout(() => this.onCompanyScreenUpdated(), 90);
        });
        this._obs.observe(main, { childList: true, subtree: true });
      }

      if (window.DamanCompany && typeof DamanCompany.render === 'function' && !DamanCompany._enhHooked) {
        DamanCompany._enhHooked = true;
        const origRender = DamanCompany.render.bind(DamanCompany);
        DamanCompany.render = (container, a) => {
          origRender(container, a);
          setTimeout(() => this.onCompanyScreenUpdated(), 40);
        };
      }

      if (app.activeTab === 'company') this.onCompanyScreenUpdated();
    }
  };

  window.DamanCompanyEnh = CompanyEnh;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => CompanyEnh.boot(), 280));
  else setTimeout(() => CompanyEnh.boot(), 280);
})();
