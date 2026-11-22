(function () {
  const ChatMod = {
    subTab: 'chats', // 'chats' | 'contracts' | 'tickets'
    chats: [],
    agreements: [],
    tickets: [],
    activeChatId: null,
    activeChatMeta: null,
    activeMessages: [],

    attachedUid: null,
    unsubChats: null,
    unsubMsgs: null,
    unsubAgs: null,
    unsubTickets: null,
    unsubIncomingCall: null,
    cachedAdminUid: null,

    tempPayoutPhoto: '',
    tempDedPhoto: '',

    callState: {
      active: false,
      chatId: null,
      callId: null,
      otherUid: null,
      otherName: '',
      role: null,
      pc: null,
      localStream: null,
      mediaRecorder: null,
      recordedChunks: [],
      startedAt: 0,
      timerInt: null,
      unsubCallDoc: null,
      unsubRemoteCands: null,
      muted: false
    },

    // ==================== LIFECYCLE & LISTENERS ====================
    ensureListeners(app) {
      if (!app.user) {
        this.detachListeners();
        return;
      }
      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      const uid = app.user.uid;
      const db = app.db;

      this.unsubChats = db
        .collection('chats')
        .where('participants', 'array-contains', uid)
        .limit(60)
        .onSnapshot(
          (snap) => {
            this.chats = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            this.updateUnreadBadge(app);
            if (app.activeTab === 'chat' && !this.activeChatId && this.subTab === 'chats') this.rerender();
          },
          () => {}
        );

      this.unsubAgs = db
        .collection('chatAgreements')
        .where('participants', 'array-contains', uid)
        .limit(60)
        .onSnapshot(
          (snap) => {
            this.agreements = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'chat') this.rerender();
          },
          () => {}
        );

      this.unsubTickets = db
        .collection('supportTickets')
        .where('userId', '==', uid)
        .limit(30)
        .onSnapshot(
          (snap) => {
            this.tickets = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            if (app.activeTab === 'chat' && this.subTab === 'tickets') this.rerender();
          },
          () => {}
        );

      this.unsubIncomingCall = db
        .collection('incomingCalls')
        .doc(uid)
        .onSnapshot(
          (snap) => {
            if (!snap.exists) { this.hideIncomingCallBanner(); return; }
            const data = snap.data();
            if (data && data.status === 'ringing' && !this.callState.active) {
              if (Date.now() - Number(data.sentAtMs || 0) < 65000) this.showIncomingCallBanner(data);
            } else {
              this.hideIncomingCallBanner();
            }
          },
          () => {}
        );
    },

    detachListeners() {
      ['unsubChats', 'unsubMsgs', 'unsubAgs', 'unsubTickets', 'unsubIncomingCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      this.endActiveCall(true);
      this.attachedUid = null;
      this.chats = [];
      this.agreements = [];
      this.tickets = [];
      this.activeChatId = null;
      this.activeChatMeta = null;
      this.activeMessages = [];
      this.hideIncomingCallBanner();
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'chat') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) { this.subTab = t; this.rerender(); },

    paymentModelLabel(m) {
      return {
        daily_wages: 'يوميات وسُلف (صرف حسب الأيام بموافقة صاحب العمل)',
        milestones: 'دفعات ومستخلصات حسب نسب الإنجاز',
        lump_sum: 'مقطوعية كاملة (صرف 100% عند الاستلام النهائي فقط)',
        b2b_supply: 'توريد خامات B2B (صرف 100% عند الاستلام بالموقع)'
      }[m] || 'حسب الاتفاق';
    },

    payoutScheduleLabel(s) {
      return {
        daily: 'صرف يومي نهاية كل يوم عمل',
        weekly: 'صرف أسبوعي (كل خميس)',
        on_request: 'عند الطلب وبموافقة صاحب العمل',
        on_delivery: 'دفعة واحدة عند الاستلام النهائي'
      }[s] || 'بموافقة صاحب العمل';
    },

    updateUnreadBadge(app) {
      const badge = document.getElementById('daman-chat-unread-badge');
      if (!badge || !app.user) return;
      const uid = app.user.uid;
      let total = 0;
      this.chats.forEach((c) => {
        if (c.unreadBy && c.unreadBy[uid]) total += Number(c.unreadBy[uid] || 0);
      });
      if (total > 0) {
        badge.textContent = total > 9 ? '9+' : total;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    },

    async resolveAdminUid(app) {
      if (this.cachedAdminUid) return this.cachedAdminUid;
      try {
        const snap = await app.db.collection('users').where('email', '==', app.ADMIN_EMAIL).limit(1).get();
        if (!snap.empty) {
          this.cachedAdminUid = snap.docs[0].id;
          return this.cachedAdminUid;
        }
      } catch (e) {}
      return 'ADMIN_ROOM';
    },

    // ==================== OPEN / CREATE DIRECT CHAT ====================
    async openDirectChat(targetUid, targetName = 'مستخدم', projectId = '', contextTitle = '') {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) return app.toast('يجب توثيق الحساب قبل بدء المحادثات والعقود', 'warning');

      let realTargetUid = targetUid;
      let realTargetName = targetName;
      if (targetUid === 'admin' || targetUid === 'demo_daman') {
        realTargetUid = await this.resolveAdminUid(app);
        if (targetUid === 'admin') realTargetName = 'إدارة ضمان سايت';
      }

      if (realTargetUid === app.user.uid) {
        app.switchTab('chat');
        return app.toast('هذا حسابك الشخصي (أنت صاحب هذا الإعلان / الإدارة)', 'info');
      }

      const pair = [app.user.uid, realTargetUid].sort();
      const chatId = `${pair[0]}_${pair[1]}`;
      const myName = app.profile.companyName || app.profile.name || 'مستخدم';
      const chatRef = app.db.collection('chats').doc(chatId);

      try {
        const snap = await chatRef.get();
        if (!snap.exists) {
          await chatRef.set({
            participants: pair,
            participantNames: { [app.user.uid]: myName, [realTargetUid]: realTargetName || 'مستخدم' },
            projectId: projectId || '',
            contextTitle: contextTitle || '',
            lastMessage: contextTitle ? `استفسار بخصوص: ${contextTitle}` : 'بدأت المحادثة',
            unreadBy: { [realTargetUid]: 1, [app.user.uid]: 0 },
            frozen: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          if (contextTitle) {
            await chatRef.collection('messages').add({
              senderId: app.user.uid, senderName: myName,
              text: `مرحباً، أتواصل معك بخصوص: ${contextTitle}`,
              type: 'text', date: app.todayLocal(),
              time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        } else if (contextTitle) {
          await chatRef.collection('messages').add({
            senderId: app.user.uid, senderName: myName,
            text: `استفسار بخصوص: ${contextTitle}`,
            type: 'text', date: app.todayLocal(),
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await chatRef.update({
            lastMessage: `استفسار بخصوص: ${contextTitle}`,
            [`unreadBy.${realTargetUid}`]: firebase.firestore.FieldValue.increment(1),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        app.switchTab('chat');
        this.openChatRoom(chatId, {
          id: chatId, otherUid: realTargetUid, otherName: realTargetName,
          frozen: snap.exists ? !!snap.data().frozen : false
        });
      } catch (err) { app.toast(err.message, 'error'); }
    },

    openChatRoom(chatId, meta = {}) {
      const app = window.DamanApp;
      if (this.unsubMsgs) { try { this.unsubMsgs(); } catch (e) {} this.unsubMsgs = null; }

      const existing = this.chats.find((c) => c.id === chatId);
      let otherUid = meta.otherUid || '';
      let otherName = meta.otherName || '';
      if (existing && app.user) {
        const others = (existing.participants || []).filter((p) => p !== app.user.uid);
        if (!otherUid && others.length) otherUid = others[0];
        if (!otherName && existing.participantNames && otherUid) otherName = existing.participantNames[otherUid];
      }

      this.activeChatId = chatId;
      this.activeChatMeta = {
        id: chatId, otherUid, otherName: otherName || 'محادثة مضمونة',
        frozen: existing ? !!existing.frozen : !!meta.frozen
      };
      this.activeMessages = [];

      if (app.user) {
        app.db.collection('chats').doc(chatId).update({ [`unreadBy.${app.user.uid}`]: 0 }).catch(() => {});
      }

      this.unsubMsgs = app.db
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .limit(120)
        .onSnapshot(
          (snap) => {
            this.activeMessages = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            this.rerender();
            setTimeout(() => {
              const box = document.getElementById('daman-chat-scroll');
              if (box) box.scrollTop = box.scrollHeight;
            }, 60);
          },
          () => {}
        );

      try { history.pushState({ chatRoom: chatId }, ''); } catch (e) {}
      this.rerender();
    },

    closeActiveChat() {
      if (this.unsubMsgs) { try { this.unsubMsgs(); } catch (e) {} this.unsubMsgs = null; }
      this.activeChatId = null;
      this.activeChatMeta = null;
      this.activeMessages = [];
      this.rerender();
    },

    async sendMessage(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      if (this.activeChatMeta?.frozen && !app.hasAdminAccess()) {
        return app.toast('هذه المحادثة مجمّدة حالياً من الإدارة 🔒', 'error');
      }
      const inp = document.getElementById('daman-msg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text) return;
      inp.value = '';

      const isAdminIntervention = app.hasAdminAccess() && !(this.chats.find((c) => c.id === this.activeChatId)?.participants || []).includes(app.user.uid);
      const senderName = isAdminIntervention ? '👑 إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || 'مستخدم');
      const chatRef = app.db.collection('chats').doc(this.activeChatId);

      try {
        await chatRef.collection('messages').add({
          senderId: app.user.uid, senderName, isAdmin: isAdminIntervention,
          type: 'text', text, date: app.todayLocal(),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const upd = { lastMessage: text.slice(0, 90), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (this.activeChatMeta?.otherUid) {
          upd[`unreadBy.${this.activeChatMeta.otherUid}`] = firebase.firestore.FieldValue.increment(1);
        }
        await chatRef.update(upd).catch(() => {});
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async sendChatImage(input) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      if (!f || !this.activeChatId || !app.user) return;
      if (this.activeChatMeta?.frozen && !app.hasAdminAccess()) return app.toast('المحادثة مجمّدة 🔒', 'error');
      input.value = '';
      try {
        app.toast('جارٍ ضغط وإرسال الصورة...', 'info');
        const b64 = await app.compressImage(f, 760, 0.56);
        const mediaId = await app.saveMedia(b64, { kind: 'chat_img' });
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid, senderName: app.profile?.companyName || app.profile?.name || 'مستخدم',
          type: 'image', mediaId, thumbBase64: await app.compressImage(f, 280, 0.42),
          text: '📷 صورة مرفقة', date: app.todayLocal(),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const upd = { lastMessage: '📷 صورة مرفقة', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (this.activeChatMeta?.otherUid) {
          upd[`unreadBy.${this.activeChatMeta.otherUid}`] = firebase.firestore.FieldValue.increment(1);
        }
        await chatRef.update(upd).catch(() => {});
      } catch (e) { app.toast('تعذر إرسال الصورة', 'error'); }
    },

    // ==================== CREATE OFFICIAL CONTRACT WITH CLEAR DISBURSEMENT SCHEDULE ====================
    async openCreateContractModal() {
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
            <div class="font-black text-emerald-300">✅ سحب تلقائي لبيانات البطاقة الموثّقة للطرفين:</div>
            <div>• أنت: <b>${app.esc(app.profile.legalName || app.profile.name)}</b> (قومي: ${app.maskNationalId(app.profile.nationalId)})</div>
            <div>• الطرف الآخر: <b>${app.esc(otherProf.legalName || otherProf.name)}</b> (قومي: ${app.maskNationalId(otherProf.nationalId)})</div>
          </div>

          <form onsubmit="DamanChat.submitCreateContract(event)" oninput="DamanChat.updateContractCostPreview()" class="space-y-2.5">
            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">صفتك في هذا العقد *</label>
              <select id="ct-role" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                <option value="payer">أنا صاحب العمل / المشتري (سأحجز المبلغ في الضمان)</option>
                <option value="provider">أنا المقاول / الفني / المورّد (سأنفّذ العمل أو التوريد)</option>
              </select>
            </div>

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">عنوان البند / المشروع *</label>
              <input id="ct-title" type="text" required placeholder="مثال: شدة خشبية وحدادة سقف فيلا 14" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10.5px] font-bold text-emerald-300 mb-1">إجمالي قيمة العقد (ج.م) *</label>
                <input id="ct-amount" type="number" min="100" step="any" required placeholder="50000" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
              </div>
              <div>
                <label class="block text-[10.5px] font-bold text-sky-300 mb-1">نظام وميعاد صرف الفلوس *</label>
                <select id="ct-paytype" onchange="DamanChat.onContractModelChange()" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-sky-300 font-bold">
                  <option value="milestones">دفعات / مستخلصات حسب الإنجاز</option>
                  <option value="daily_wages">يوميات (يومي / أسبوعي + تأمين)</option>
                  <option value="lump_sum">مقطوعية (100% عند الاستلام)</option>
                  <option value="b2b_supply">توريد خامات B2B (عند الاستلام)</option>
                </select>
              </div>
            </div>

            <!-- Dynamic Payment Schedule Box -->
            <div id="ct-model-info" class="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[10.5px] text-sky-100 leading-relaxed">
              💡 <b>متى تُصرف الفلوس؟</b> يرسل المنفّذ «طلب صرف دفعة/مستخلص» بصورة الإنجاز، ولا يُصرف جنيه إلا بعد ضغط صاحب العمل «اعتماد وصرف».
            </div>

            <!-- Extra Daily Wages Configuration (Visible ONLY when daily_wages is selected) -->
            <div id="ct-daily-box" class="hidden p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2">
              <div class="font-black text-amber-300 text-[10.5px]">⚙️ إعدادات الصرف باليوميات:</div>
              <div class="grid grid-cols-3 gap-1.5">
                <div><label class="block text-[9.5px] text-slate-400 mb-0.5">قيمة اليومية (ج.م)</label><input id="ct-daily-rate" type="number" min="50" step="any" placeholder="500" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                <div><label class="block text-[9.5px] text-slate-400 mb-0.5">نسبة تأمين محتجزة %</label><input id="ct-ret-pct" type="number" min="0" max="50" value="10" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold text-center" /></div>
                <div><label class="block text-[9.5px] text-slate-400 mb-0.5">ميعاد الصرف</label>
                  <select id="ct-payout-sched" class="w-full px-1.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-[10px]">
                    <option value="daily">يومياً</option>
                    <option value="weekly" selected>أسبوعياً (كل خميس)</option>
                    <option value="on_request">عند الطلب</option>
                  </select>
                </div>
              </div>
              <div class="text-[9.5px] text-slate-400">عند صرف أي يوميات، يُحوَّل الصافي فوراً لمحفظة المنفّذ وتبقى نسبة التأمين محجوزة بالضمان لحين التسليم النهائي.</div>
            </div>

            <div class="grid grid-cols-3 gap-1.5">
              <div>
                <label class="block text-[10px] font-bold text-amber-300 mb-1">تاريخ البداية *</label>
                <input id="ct-start" type="date" required value="${today}" onchange="DamanChat.syncContractEndDate()" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-amber-300 mb-1">المدة (يوم) *</label>
                <input id="ct-days" type="number" min="1" max="730" required value="15" oninput="DamanChat.syncContractEndDate()" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-black text-center" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-amber-300 mb-1">تاريخ التسليم *</label>
                <input id="ct-end" type="date" required value="${defEnd}" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-[11px]" />
              </div>
            </div>

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">موقع التنفيذ / عنوان التسليم *</label>
              <input id="ct-loc" type="text" required placeholder="المدينة / الكمبوند / رقم العمارة أو الفيلا" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] font-bold text-slate-300 mb-1">غرامة تأخير يومية (ج.م)</label><input id="ct-penalty" type="number" min="0" value="0" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
              <div><label class="block text-[10px] font-bold text-slate-300 mb-1">مدة ضمان الأعمال (يوم)</label><input id="ct-warranty" type="number" min="0" value="90" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            </div>

            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">المواصفات الفنية، الكميات، وشروط الاستلام *</label>
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

    onContractModelChange() {
      const m = document.getElementById('ct-paytype')?.value;
      const box = document.getElementById('ct-daily-box');
      const info = document.getElementById('ct-model-info');
      if (box) box.classList.toggle('hidden', m !== 'daily_wages');
      if (!info) return;
      if (m === 'daily_wages') {
        info.innerHTML = '💡 <b>متى تُصرف الفلوس؟</b> يرفع المنفّذ طلب صرف يوميات (يومياً أو أسبوعياً حسب الاتفاق)، وعند موافقة صاحب العمل يُصرف الصافي فوراً وتبقى نسبة التأمين محجوزة حتى التسليم النهائي.';
      } else if (m === 'lump_sum' || m === 'b2b_supply') {
        info.innerHTML = '💡 <b>متى تُصرف الفلوس؟</b> يبقى 100% من المبلغ محجوزاً بالضمان بالكامل ولا يُصرف أي جزء منه إلا عند الاستلام النهائي والتصفية من صاحب العمل.';
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
      const amt = parseFloat(document.getElementById('ct-amount')?.value) || 0;
      const role = document.getElementById('ct-role')?.value || 'payer';
      const payerProf = role === 'payer' ? app.profile : this._contractOtherProf;
      const rate = app.getCommissionRate(payerProf);
      const fee = Math.round(amt * rate * 100) / 100;
      const total = Math.round((amt + fee) * 100) / 100;
      const box = document.getElementById('ct-cost-prev');
      if (!box) return;
      box.innerHTML = `
        <div>قيمة العقد: <b>${app.fmtMoney(amt)} ج.م</b> • عمولة الضمان (${(rate * 100).toFixed(2)}%): <b>${app.fmtMoney(fee)} ج.م</b></div>
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
        const totalAmount = Math.round((parseFloat(document.getElementById('ct-amount').value) || 0) * 100) / 100;
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
          ticketNumber,
          chatId: this.activeChatId,
          participants: [payerUid, providerUid],
          createdByUid: app.user.uid,
          title,
          paymentModel,
          dailyRate,
          retentionPct,
          payoutSchedule,
          location,
          scopeDetails,
          date: app.todayLocal(),
          startDate,
          durationDays,
          endDate,
          delayPenaltyPerDay,
          warrantyDays,

          payerUid,
          payerName: payerP.companyName || payerP.name || '',
          payerLegalName: payerP.legalName || payerP.name || '',
          payerNationalId: payerP.nationalId || '',
          payerAddress: payerP.legalAddress || payerP.city || '',
          payerPhone: payerP.phone || '',
          payerCR: payerP.commercialReg || '',

          providerUid,
          providerName: provP.companyName || provP.name || '',
          providerLegalName: provP.legalName || provP.name || '',
          providerNationalId: provP.nationalId || '',
          providerAddress: provP.legalAddress || provP.city || '',
          providerPhone: provP.phone || '',
          providerCR: provP.commercialReg || '',

          totalAmount,
          commissionRate,
          lockedFee,
          remainingEscrow: totalAmount,
          paidSoFar: 0,
          totalDeductions: 0,
          payoutLogs: [],
          pendingPayoutReq: null,
          pendingDeduction: null,

          payerSigBase64: '',
          providerSigBase64: '',
          signedContractMedia: '',
          contractStatus: 'unsigned',
          status: 'draft',
          ratedByPayer: false,
          ratedByProvider: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          const agRef = await app.db.collection('chatAgreements').add(docData);
          await agRef.collection('events').add({
            type: 'created', byName: app.profile.name || '',
            note: `إنشاء مسودة العقد ${ticketNumber} بقيمة ${app.fmtMoney(totalAmount)} ج.م (${this.paymentModelLabel(paymentModel)})`,
            date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('chats').doc(this.activeChatId).collection('messages').add({
            senderId: app.user.uid, senderName: app.profile.companyName || app.profile.name || '',
            type: 'contract', agreementId: agRef.id,
            text: `📄 عقد رسمي جديد (${ticketNumber}): ${title} — ${app.fmtMoney(totalAmount)} ج.م | ${this.paymentModelLabel(paymentModel)}`,
            date: app.todayLocal(), time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.sendNotification(otherUid, `📄 عقد رسمي جديد (${ticketNumber})`, `${title} — بقيمة ${app.fmtMoney(totalAmount)} ج.م`);
          document.getElementById('daman-contract-modal').classList.add('hidden');
          app.toast(`تم إنشاء العقد ${ticketNumber} بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== FUND CONTRACT (100% ESCROW + COMMISSION) ====================
    async fundContract(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'draft' || ag.payerUid !== app.user?.uid) return;

      const totalRequired = Math.round((Number(ag.totalAmount) + Number(ag.lockedFee)) * 100) / 100;
      const avail = Number(app.profile?.balanceAvailable || 0);
      if (avail < totalRequired) {
        const diff = Math.round((totalRequired - avail) * 100) / 100;
        if (window.confirm(`الإجمالي المطلوب لحجز الضمان 100%: ${app.fmtMoney(totalRequired)} ج.م.\nرصيدك المتاح لا يكفي — هل تريد شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
        }
        return;
      }

      if (!window.confirm(`تأكيد حجز مبلغ الضمان 100% للعقد ${ag.ticketNumber}؟\n• قيمة الأعمال: ${app.fmtMoney(ag.totalAmount)} ج.م\n• عمولة الضمان (${(Number(ag.commissionRate || 0.035) * 100).toFixed(2)}%): ${app.fmtMoney(ag.lockedFee)} ج.م\n• الإجمالي المحجوز: ${app.fmtMoney(totalRequired)} ج.م`)) return;

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
            tx.update(uRef, {
              balanceAvailable: afterAvail,
              balanceEscrow: Math.round((curEsc + totalRequired) * 100) / 100
            });
            tx.update(aRef, { status: 'funded', fundedAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'escrow_lock', amount: -totalRequired,
              balanceBefore: curAvail, balanceAfter: afterAvail,
              note: `حجز ضمان عقد ${ag.ticketNumber}: ${ag.title} (أصل ${app.fmtMoney(ag.totalAmount)} + عمولة ${app.fmtMoney(ag.lockedFee)})`,
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await aRef.collection('events').add({
            type: 'funded', byName: app.profile.name || '',
            note: `تم حجز 100% من قيمة العقد (${app.fmtMoney(totalRequired)} ج.م) في الضمان المالي`,
            date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.sendNotification(ag.providerUid, `💰 تم حجز الضمان المالي للعقد ${ag.ticketNumber}`, `المبلغ محجوز 100% — يرجى التوقيع ورفع صورة العقد الموقّع للبدء.`);
          app.toast('تم حجز الضمان المالي 100% بنجاح! وقّعوا العقد واطبعوه الآن ✅', 'success');
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

    // ==================== PROVIDER PAYOUT REQUEST (DAILY WAGES / MILESTONES / HANDOVER) ====================
    openRequestPayoutModal(agId) {
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
            ${isDaily && ag.dailyRate ? ` | اليومية: <b>${app.fmtMoney(ag.dailyRate)} ج.م</b> | تأمين محتجز: <b>${ag.retentionPct || 0}%</b>` : ''}
          </div>
          <form onsubmit="DamanChat.submitPayoutRequest(event,'${agId}')" oninput="DamanChat.updatePayoutReqPreview('${agId}')" class="space-y-2.5">
            ${isDaily ? `
              <div class="grid grid-cols-2 gap-2">
                <div><label class="block text-[10px] text-slate-300 mb-1">عدد أيام العمل *</label><input id="rp-days" type="number" min="0.5" step="0.5" value="1" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black text-center" /></div>
                <div><label class="block text-[10px] text-slate-300 mb-1">قيمة اليومية (ج.م) *</label><input id="rp-rate" type="number" min="50" step="any" value="${Number(ag.dailyRate || 500)}" required class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-center" /></div>
              </div>` : `
              <div>
                <label class="block text-[10.5px] font-bold text-emerald-300 mb-1">المبلغ المطلوب صرفه الآن (ج.م) *</label>
                <input id="rp-amt" type="number" min="1" max="${rem}" step="any" value="${isLump ? rem : Math.min(rem, Math.round(rem / 2))}" ${isLump ? 'readonly' : ''} required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
              </div>`}
            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">بيان الأعمال المنفذة *</label>
              <input id="rp-note" type="text" required placeholder="${isDaily ? 'مثال: يوميات عمل اليوم / الأسبوع الأول' : isLump ? 'تم إتمام الأعمال والتوريد جاهز للاستلام النهائي' : 'مثال: إنجاز المرحلة الأولى — مستخلص 1'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
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
        box.innerHTML = `إجمالي اليوميات (${days} × ${app.fmtMoney(rate)}): <b>${app.fmtMoney(gross)} ج.م</b><br/>تأمين يبقى بالضمان (${retPct}%): <b>${app.fmtMoney(retAmt)} ج.م</b><br/><b>الصافي المطلوب صرفه الآن: ${app.fmtMoney(net)} ج.م</b>`;
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
        const reqObj = {
          id: 'pr_' + Date.now(),
          days, gross, retentionHeld, netAmount, note, photoMedia,
          isFinalHandover: ag.paymentModel === 'lump_sum' || ag.paymentModel === 'b2b_supply',
          date: app.todayLocal()
        };
        await app.db.collection('chatAgreements').doc(agId).update({ pendingPayoutReq: reqObj });
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
            const logs = Array.isArray(a.payoutLogs) ? a.payoutLogs.concat([logEntry]) : [logEntry];

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - amt) * 100) / 100) });
            tx.update(provRef, { balanceAvailable: wAfter });
            tx.update(aRef, {
              remainingEscrow: Math.round((Number(a.remainingEscrow) - amt) * 100) / 100,
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + amt) * 100) / 100,
              payoutLogs: logs,
              pendingPayoutReq: null
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.providerUid, type: logEntry.kind, amount: amt,
              balanceBefore: wAvail, balanceAfter: wAfter,
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

    // ==================== MUTUAL DEDUCTION INSIDE CONTRACT ====================
    async openProposeDeductionModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.payerUid !== app.user?.uid || ag.contractStatus !== 'approved') return;
      if (ag.pendingDeduction) return app.toast('يوجد إشعار خصم معلّق بالفعل بانتظار رد المنفّذ', 'warning');

      const rem = Number(ag.remainingEscrow || 0);
      const amt = Math.round((parseFloat(window.prompt(`إشعار خصم رسمي على المنفّذ (${ag.providerName}).\nالمتبقي بالضمان: ${app.fmtMoney(rem)} ج.م\nأدخل قيمة الخصم المقترحة:`)) || 0) * 100) / 100;
      if (amt <= 0 || amt > rem) return app.toast('قيمة غير صالحة', 'error');
      const reason = window.prompt('سبب الخصم بالتفصيل (مثال: تلفيات / تأخير / إعادة أعمال):');
      if (!reason || !reason.trim()) return;

      await app.db.collection('chatAgreements').doc(agId).update({
        pendingDeduction: { amount: amt, reason: reason.trim(), date: app.todayLocal() }
      });
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

            const logs = (Array.isArray(a.payoutLogs) ? a.payoutLogs : []).concat([{
              date: app.todayLocal(), amount: -dAmt, note: `خصم معتمد بالتراضي: ${ded.reason}`, kind: 'deduction'
            }]);

            tx.update(payerRef, {
              balanceEscrow: Math.max(0, Math.round((pEsc - totalBackToPayer) * 100) / 100),
              balanceAvailable: pAfterAvail
            });
            tx.update(aRef, {
              remainingEscrow: Math.round((Number(a.remainingEscrow) - dAmt) * 100) / 100,
              lockedFee: Math.max(0, Math.round((Number(a.lockedFee || 0) - feeRefund) * 100) / 100),
              totalDeductions: Math.round((Number(a.totalDeductions || 0) + dAmt) * 100) / 100,
              payoutLogs: logs,
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

    // ==================== DIRECT PAYOUT BY PAYER, EXTENSION, SETTLEMENT, HISTORY & DISPUTE ====================
    async disburseFromContract(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.payerUid !== app.user?.uid) return;
      if (ag.contractStatus !== 'approved') return app.toast('يجب اعتماد صورة العقد الموقّع من الإدارة أولاً قبل صرف أي دفعة', 'warning');

      const rem = Number(ag.remainingEscrow || 0);
      const amt = Math.round((parseFloat(window.prompt(`صرف دفعة مباشرة للمنفّذ (${ag.providerName}).\nالمتبقي بالضمان: ${app.fmtMoney(rem)} ج.م\nأدخل المبلغ المطلوب صرفه الآن:`, String(Math.min(rem, 1000)))) || 0) * 100) / 100;
      if (amt <= 0 || amt > rem) return app.toast('مبلغ غير صالح أو أكبر من المتبقي بالضمان', 'error');
      const note = window.prompt('بيان الصرف (مثال: يوميات أسبوع 1 / مستخلص رقم 1):', 'دفعة من حساب الأعمال المنفذة') || 'دفعة مستحقة';

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

            const logs = (Array.isArray(a.payoutLogs) ? a.payoutLogs : []).concat([{
              date: app.todayLocal(), amount: amt, note, kind: a.paymentModel === 'daily_wages' ? 'daily_payout' : 'milestone_payout'
            }]);

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - amt) * 100) / 100) });
            tx.update(provRef, { balanceAvailable: wAfter });
            tx.update(aRef, {
              remainingEscrow: Math.round((Number(a.remainingEscrow) - amt) * 100) / 100,
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + amt) * 100) / 100,
              payoutLogs: logs
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.providerUid, type: 'milestone_payout', amount: amt,
              balanceBefore: wAvail, balanceAfter: wAfter,
              note: `دفعة من العقد ${ag.ticketNumber}: ${note}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(ag.providerUid, `💸 تم صرف ${app.fmtMoney(amt)} ج.م لحسابك`, `العقد ${ag.ticketNumber}: ${note}`);
          app.toast(`تم صرف ${app.fmtMoney(amt)} ج.م لمحفظة المنفّذ بنجاح ✅`, 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    openContractHistoryModal(agId) {
      const app = window.DamanApp;
      const a = this.agreements.find((x) => x.id === agId);
      if (!a) return;
      const logs = Array.isArray(a.payoutLogs) ? a.payoutLogs : [];
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
          <div class="flex justify-between items-center"><h3 class="text-sm font-black text-amber-400">📜 سجل الدفعات واليوميات (${app.esc(a.ticketNumber)})</h3><button onclick="document.getElementById('daman-ct-hist-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="grid grid-cols-3 gap-1.5 text-center p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10.5px]">
            <div>إجمالي العقد<br/><b class="text-white">${app.fmtMoney(a.totalAmount)}</b></div>
            <div>المنصرف<br/><b class="text-emerald-400">${app.fmtMoney(a.paidSoFar || 0)}</b></div>
            <div>المتبقي بالضمان<br/><b class="text-amber-300">${app.fmtMoney(a.remainingEscrow || 0)}</b></div>
          </div>
          <div class="space-y-1.5">
            ${!logs.length ? '<div class="text-center text-slate-400 py-6">لم يتم صرف أي دفعات أو يوميات على هذا العقد بعد.</div>' : logs.map((l, i) => `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center gap-2">
                <div class="min-w-0">
                  <div class="font-bold text-white">${i + 1}. ${app.esc(l.note || 'دفعة')}</div>
                  <div class="text-[10px] text-slate-400">${app.esc(l.date || '')}${l.days ? ` • ${l.days} يوم` : ''}${l.retentionHeld ? ` • تأمين محتجز: ${app.fmtMoney(l.retentionHeld)} ج.م` : ''}</div>
                  ${l.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${l.photoMedia}','صورة إثبات الدفعة')" class="text-[10px] text-sky-300 underline font-bold mt-0.5">عرض صورة الشغل</button>` : ''}
                </div>
                <b class="${Number(l.amount || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'} shrink-0">${app.fmtMoney(l.amount)} ج.م</b>
              </div>`).join('')}
          </div>
        </div>`;
    },

    async extendContract(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded' || ag.payerUid !== app.user?.uid) return;
      if (ag.contractStatus !== 'approved') return app.toast('يجب اعتماد العقد من الإدارة أولاً', 'warning');

      const extraDays = parseInt(window.prompt(`تمديد مدة العقد ${ag.ticketNumber} (تاريخ التسليم الحالي: ${ag.endDate || '—'}).\nعدد الأيام الإضافية (0 بدون تمديد وقت):`, '7'), 10) || 0;
      const extraAmount = Math.round((parseFloat(window.prompt('زيادة قيمة العقد بأعمال إضافية (ج.م) — اكتب 0 لتمديد الوقت فقط:', '0')) || 0) * 100) / 100;
      if (extraDays <= 0 && extraAmount <= 0) return;

      const rate = Number(ag.commissionRate || app.getCommissionRate());
      const extraFee = Math.round(extraAmount * rate * 100) / 100;
      const totalLock = Math.round((extraAmount + extraFee) * 100) / 100;
      if (totalLock > Number(app.profile?.balanceAvailable || 0)) {
        return app.toast(`رصيدك المتاح لا يكفي لحجز الزيادة (${app.fmtMoney(totalLock)} ج.م)`, 'error');
      }

      const newEnd = extraDays > 0 ? app.addDaysLocal(ag.endDate || app.todayLocal(), extraDays) : ag.endDate;
      if (!window.confirm(`تأكيد ملحق تعديل العقد ${ag.ticketNumber}؟\n• تاريخ التسليم الجديد: ${newEnd}\n• زيادة القيمة: ${app.fmtMoney(extraAmount)} ج.م + عمولة ${app.fmtMoney(extraFee)} ج.م`)) return;

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
                userId: ag.payerUid, type: 'escrow_lock', amount: -totalLock,
                balanceBefore: curAvail, balanceAfter: afterAvail,
                note: `ملحق زيادة قيمة العقد ${ag.ticketNumber} (+${app.fmtMoney(extraAmount)} + عمولة ${app.fmtMoney(extraFee)})`,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(aRef, {
              endDate: newEnd,
              durationDays: Number(a.durationDays || 0) + extraDays,
              totalAmount: Math.round((Number(a.totalAmount || 0) + extraAmount) * 100) / 100,
              remainingEscrow: Math.round((Number(a.remainingEscrow || 0) + extraAmount) * 100) / 100,
              lockedFee: Math.round((Number(a.lockedFee || 0) + extraFee) * 100) / 100
            });
          });
          await app.sendNotification(ag.providerUid, `📅 تم تحديث/تمديد العقد ${ag.ticketNumber}`, `تاريخ التسليم الجديد: ${newEnd}${extraAmount > 0 ? ' — زيادة محجوزة: ' + app.fmtMoney(extraAmount) + ' ج.م' : ''}`);
          app.toast('تم حفظ ملحق التمديد والزيادة بنجاح ✅', 'success');
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
      if (!window.confirm(`تأكيد الاستلام النهائي وإغلاق العقد ${ag.ticketNumber}؟\n• سيتم تحويل المتبقي والتأمين المحجوز (${app.fmtMoney(rem)} ج.م) فوراً إلى محفظة المنفّذ.\n• سيتم تسوية عمولة الضمان (${app.fmtMoney(fee)} ج.م) لصالح المنصة.`)) return;

      await app.withLock('settle_' + agId, async () => {
        const aRef = app.db.collection('chatAgreements').doc(agId);
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        try {
          await app.db.runTransaction(async (tx) => {
            const [aDoc, pDoc, wDoc] = await Promise.all([tx.get(aRef), tx.get(payerRef), tx.get(provRef)]);
            const a = aDoc.data();
            if (a.status !== 'funded') throw new Error('حالة العقد تغيرت بالفعل');
            const rEsc = Number(a.remainingEscrow || 0);
            const lFee = Number(a.lockedFee || 0);
            const totalRelease = Math.round((rEsc + lFee) * 100) / 100;

            const pEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);
            const wAfter = Math.round((wAvail + rEsc) * 100) / 100;

            const logs = (Array.isArray(a.payoutLogs) ? a.payoutLogs : []).concat(
              rEsc > 0 ? [{ date: app.todayLocal(), amount: rEsc, note: 'التصفية النهائية ورد التأمين عند الاستلام', kind: 'final_settlement' }] : []
            );

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - totalRelease) * 100) / 100) });
            if (rEsc > 0) {
              tx.update(provRef, { balanceAvailable: wAfter });
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.providerUid, type: 'final_settlement', amount: rEsc,
                balanceBefore: wAvail, balanceAfter: wAfter,
                note: `تصفية نهائية واستلام العقد ${ag.ticketNumber}: ${ag.title}`,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            if (lFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                type: 'escrow_commission', agreementId: agId, ticketNumber: ag.ticketNumber,
                userId: ag.payerUid, userName: ag.payerName || '',
                amount: lFee, cashPaid: lFee, bonusUsed: 0,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(aRef, {
              status: 'completed', remainingEscrow: 0, lockedFee: 0,
              pendingPayoutReq: null, pendingDeduction: null,
              payoutLogs: logs,
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + rEsc) * 100) / 100,
              completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await app.sendNotification(ag.providerUid, `🏁 تم الاستلام والتصفية النهائية (${ag.ticketNumber})`, `تم تحويل المتبقي (${app.fmtMoney(rem)} ج.م) لمحفظتك بنجاح.`);
          app.toast('تمت التصفية النهائية وإغلاق العقد بنجاح 🏁', 'success');
          this.openReviewModal(agId);
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async openDispute(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.status !== 'funded') return;
      const reason = window.prompt(`فتح نزاع رسمي للتحكيم الإداري على العقد ${ag.ticketNumber}.\nاكتب سبب النزاع بوضوح:`);
      if (!reason || !reason.trim()) return;
      await app.withLock('disp_' + agId, async () => {
        try {
          await app.db.collection('disputes').add({
            agreementId: agId, contractNumber: ag.ticketNumber, projectTitle: ag.title,
            contractAmount: ag.totalAmount, remainingEscrow: ag.remainingEscrow,
            clientId: ag.payerUid, providerId: ag.providerUid,
            openedByUid: app.user.uid, openedByName: app.profile?.name || '',
            reason: reason.trim(), status: 'open', date: app.todayLocal(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.db.collection('chatAgreements').doc(agId).update({ status: 'disputed' });
          await app.sendNotification('ADMIN', `⚖️ نزاع رسمي جديد (${ag.ticketNumber})`, `${app.profile?.name}: ${reason.trim()}`);
          app.toast('تم فتح النزاع وتجميد الصرف لحين قرار التحكيم الإداري ⚖️', 'warning');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== SIGNATURE PAD + OFFICIAL A4 PRINT ====================
    openSignatureModal(agId) {
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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">✍️ توقيع العقد الرسمي (${app.esc(ag.ticketNumber)})</h3><button onclick="document.getElementById('daman-sig-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <div class="text-[11px] text-slate-300">وقّع بإصبعك داخل المستطيل الأبيض (${isPayer ? 'الطرف الأول — صاحب العمل' : 'الطرف الثاني — المنفّذ'}):</div>
          <canvas id="daman-sig-canvas" width="320" height="160" class="sig-pad w-full bg-white rounded-2xl border-2 border-amber-500"></canvas>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" onclick="DamanChat.clearSignatureCanvas()" class="py-2 rounded-xl bg-slate-800 text-slate-200 font-bold">مسح التوقيع</button>
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

    printContractA4(agId) {
      const app = window.DamanApp;
      const a = this.agreements.find((x) => x.id === agId);
      if (!a) return;
      const verifyUrl = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(a.ticketNumber)}`;
      const logs = Array.isArray(a.payoutLogs) ? a.payoutLogs : [];
      const logRows = logs.map((l, i) => `<tr><td>${i + 1}</td><td>${app.esc(l.date || '')}</td><td>${app.esc(l.note || '')}</td><td><b>${app.fmtMoney(l.amount)} ج.م</b></td></tr>`).join('');

      const html = `
        <div style="border:2px solid #000; padding:14px 18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:17px;">عقد مقاولة / توريد رسمي بضمان مالي — ${app.esc(app.t('appName'))}</h2>
              <div style="font-size:11px;">وثيقة تعاقد إلكترونية موثّقة بالهوية والرقم القومي</div>
            </div>
            <div style="text-align:left; font-size:11px;">
              <div><b>كود العقد:</b> ${app.esc(a.ticketNumber)}</div>
              <div><b>تاريخ التحرير:</b> ${app.esc(a.date || app.todayLocal())}</div>
            </div>
          </div>

          <h4 style="margin:6px 0 4px;">أولاً: بيانات طرفي التعاقد (مسحوبة آلياً من بطاقات الرقم القومي الموثّقة)</h4>
          <table style="margin-bottom:10px;">
            <tr><th style="width:20%;">الطرف الأول (صاحب العمل)</th><td style="width:30%;"><b>${app.esc(a.payerLegalName || a.payerName)}</b>${a.payerCR ? '<br/>س.ت: ' + app.esc(a.payerCR) : ''}</td><th style="width:20%;">الرقم القومي</th><td style="width:30%;"><b>${app.esc(a.payerNationalId || '—')}</b></td></tr>
            <tr><th>العنوان بالبطاقة</th><td>${app.esc(a.payerAddress || '—')}</td><th>رقم الهاتف</th><td>${app.esc(a.payerPhone || '—')}</td></tr>
            <tr><th>الطرف الثاني (المنفّذ / المورّد)</th><td><b>${app.esc(a.providerLegalName || a.providerName)}</b>${a.providerCR ? '<br/>س.ت: ' + app.esc(a.providerCR) : ''}</td><th>الرقم القومي</th><td><b>${app.esc(a.providerNationalId || '—')}</b></td></tr>
            <tr><th>العنوان بالبطاقة</th><td>${app.esc(a.providerAddress || '—')}</td><th>رقم الهاتف</th><td>${app.esc(a.providerPhone || '—')}</td></tr>
          </table>

          <h4 style="margin:6px 0 4px;">ثانياً: نطاق الأعمال، التواريخ، ونظام ومواعيد الصرف</h4>
          <table style="margin-bottom:10px;">
            <tr><th style="width:24%;">موضوع العقد / البند</th><td colspan="3"><b>${app.esc(a.title)}</b></td></tr>
            <tr><th>موقع التنفيذ / التسليم</th><td colspan="3">${app.esc(a.location || '—')}</td></tr>
            <tr><th>تاريخ بداية التنفيذ</th><td><b>${app.esc(a.startDate || a.date || '—')}</b></td><th>تاريخ التسليم النهائي</th><td><b>${app.esc(a.endDate || '—')} (${a.durationDays || '—'} يوم)</b></td></tr>
            <tr><th>القيمة الإجمالية للعقد</th><td><b>${app.fmtMoney(a.totalAmount)} ج.م</b></td><th>نظام الصرف</th><td><b>${this.paymentModelLabel(a.paymentModel)}</b></td></tr>
            <tr><th>ميعاد ودورية الصرف</th><td>${this.payoutScheduleLabel(a.payoutSchedule)}${a.dailyRate ? ` — اليومية: ${app.fmtMoney(a.dailyRate)} ج.م` : ''}</td><th>نسبة التأمين المحتجزة</th><td>${a.retentionPct ? a.retentionPct + '% حتى التسليم النهائي' : 'لا يوجد استقطاع إضافي'}</td></tr>
            <tr><th>غرامة التأخير اليومية</th><td>${a.delayPenaltyPerDay ? app.fmtMoney(a.delayPenaltyPerDay) + ' ج.م / يوم' : 'حسب التقييم الهندسي'}</td><th>مدة ضمان الأعمال</th><td>${a.warrantyDays ? a.warrantyDays + ' يوم من التسليم' : 'حسب الأصول الفنية'}</td></tr>
            <tr><th>المواصفات والشروط الفنية</th><td colspan="3" style="white-space:pre-line;">${app.esc(a.scopeDetails || '—')}</td></tr>
          </table>

          ${logs.length ? `
            <h4 style="margin:6px 0 4px;">ثالثاً: كشف الدفعات واليوميات المنصرفة على العقد (المنصرف: ${app.fmtMoney(a.paidSoFar || 0)} ج.م | المتبقي: ${app.fmtMoney(a.remainingEscrow || 0)} ج.م)</h4>
            <table style="margin-bottom:10px;">
              <thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>المبلغ</th></tr></thead>
              <tbody>${logRows}</tbody>
            </table>` : ''}

          <div style="border:1px solid #000; padding:7px 9px; font-size:10.5px; margin-bottom:10px;">
            1. يقر الطرفان بحجز 100% من قيمة هذا العقد في محفظة الضمان المالي لدى المنصة، ولا يُصرف أي مبلغ إلا بموافقة إلكترونية صريحة من صاحب العمل أو بقرار تحكيم إداري.<br/>
            2. في حالة النزاع، تُعدّ المحادثات وصور التنفيذ وتسجيلات المكالمات داخل التطبيق حجة قاطعة، ويكون قرار التحكيم الإداري ملزماً للطرفين.
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 110px; gap:12px; align-items:center; margin-top:12px; text-align:center;">
            <div style="border:1px solid #000; padding:6px;">
              <div style="font-weight:bold; font-size:11px;">توقيع الطرف الأول (صاحب العمل)</div>
              <div style="font-size:10px;">${app.esc(a.payerLegalName || a.payerName)}</div>
              <div style="height:56px; display:flex; align-items:center; justify-content:center;">${a.payerSigBase64 ? `<img src="${a.payerSigBase64}" style="max-height:52px; max-width:140px;" />` : '...........................'}</div>
            </div>
            <div style="border:1px solid #000; padding:6px;">
              <div style="font-weight:bold; font-size:11px;">توقيع الطرف الثاني (المنفّذ / المورّد)</div>
              <div style="font-size:10px;">${app.esc(a.providerLegalName || a.providerName)}</div>
              <div style="height:56px; display:flex; align-items:center; justify-content:center;">${a.providerSigBase64 ? `<img src="${a.providerSigBase64}" style="max-height:52px; max-width:140px;" />` : '...........................'}</div>
            </div>
            <div style="text-align:center;"><div id="print-contract-qr" style="display:inline-block;"></div><div style="font-size:8.5px; margin-top:2px;">امسح للتحقق</div></div>
          </div>
        </div>`;

      window.DamanPrint(html, (area) => {
        const el = area.querySelector('#print-contract-qr');
        if (el && window.QRCode) new QRCode(el, { text: verifyUrl, width: 92, height: 92, colorDark: '#000', colorLight: '#fff' });
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
        app.toast('تم رفع صورة العقد الموقّع وإرسالها للإدارة للاعتماد ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    openReviewModal(agId) {
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
          agreementId: agId, targetUserId: targetUid,
          fromUid: app.user.uid, fromName: app.profile?.companyName || app.profile?.name || '',
          rating, comment, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const tRef = app.db.collection('users').doc(targetUid);
        await app.db.runTransaction(async (tx) => {
          const doc = await tx.get(tRef);
          const d = doc.data() || {};
          const cnt = Number(d.ratingCount || 0);
          const avg = Number(d.ratingAvg || 5);
          const newCnt = cnt + 1;
          tx.update(tRef, { ratingCount: newCnt, ratingAvg: Math.round(((avg * cnt + rating) / newCnt) * 10) / 10 });
        });
        await app.db.collection('chatAgreements').doc(agId).update({ [isPayer ? 'ratedByPayer' : 'ratedByProvider']: true });
        document.getElementById('daman-rev-modal').classList.add('hidden');
        app.toast('شكراً لتقييمك ⭐', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== WEBRTC VOICE CALLS + 30-DAY AUTO RECORDING ====================
    buildRtcConfig(app) {
      const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
      const rawTurn = String(app.appConfig?.turnServer || '').trim();
      if (rawTurn) {
        const [urls, username, credential] = rawTurn.split('|');
        if (urls) iceServers.push(username ? { urls, username, credential: credential || '' } : { urls });
      }
      return { iceServers };
    },

    async startVoiceCall() {
      const app = window.DamanApp;
      if (app.appConfig?.disableCalls && !app.isAdmin()) return app.toast('المكالمات الصوتية متوقفة مؤقتاً من الإدارة', 'warning');
      if (!this.activeChatId || !this.activeChatMeta?.otherUid) return;
      if (this.callState.active) return app.toast('يوجد مكالمة نشطة بالفعل', 'warning');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const callId = 'call_' + Date.now();
        const chatId = this.activeChatId;
        const otherUid = this.activeChatMeta.otherUid;
        const otherName = this.activeChatMeta.otherName;

        const pc = new RTCPeerConnection(this.buildRtcConfig(app));
        stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
        const callRef = app.db.collection('chats').doc(chatId).collection('calls').doc(callId);
        const callerCands = callRef.collection('callerCandidates');
        const calleeCands = callRef.collection('calleeCandidates');

        this.callState = {
          active: true, chatId, callId, otherUid, otherName, role: 'caller',
          pc, localStream: stream, mediaRecorder: null, recordedChunks: [],
          startedAt: Date.now(), timerInt: null, unsubCallDoc: null, unsubRemoteCands: null, muted: false
        };
        this.showCallOverlay(`جارٍ الاتصال بـ ${otherName}...`);

        pc.ontrack = (ev) => {
          const aud = document.getElementById('daman-remote-audio');
          if (aud && ev.streams[0]) { aud.srcObject = ev.streams[0]; aud.play().catch(() => {}); }
          this.startLocalRecording(stream, ev.streams[0]);
        };
        pc.onicecandidate = (ev) => { if (ev.candidate) callerCands.add(ev.candidate.toJSON()).catch(() => {}); };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await callRef.set({
          offer: { type: offer.type, sdp: offer.sdp }, callerUid: app.user.uid,
          callerName: app.profile?.name || '', calleeUid: otherUid, status: 'ringing',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.db.collection('incomingCalls').doc(otherUid).set({
          chatId, callId, callerUid: app.user.uid, callerName: app.profile?.companyName || app.profile?.name || 'مستخدم',
          status: 'ringing', sentAtMs: Date.now()
        });

        this.callState.unsubCallDoc = callRef.onSnapshot(async (snap) => {
          const d = snap.data();
          if (!d) return;
          if (d.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(d.answer)).catch(() => {});
            this.callState.startedAt = Date.now();
            this.startCallTimer();
          }
          if (d.status === 'ended' || d.status === 'rejected') this.endActiveCall(false);
        });
        this.callState.unsubRemoteCands = calleeCands.onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => { if (ch.type === 'added') pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {}); });
        });
      } catch (err) {
        app.toast('تعذر بدء المكالمة — تأكد من السماح بصلاحية الميكروفون', 'error');
        this.endActiveCall(true);
      }
    },

    showIncomingCallBanner(data) {
      let b = document.getElementById('daman-incoming-call-bar');
      if (!b) {
        b = document.createElement('div');
        b.id = 'daman-incoming-call-bar';
        b.className = 'fixed top-16 inset-x-3 z-[128] max-w-md mx-auto bg-emerald-600 border-2 border-emerald-300 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-2';
        document.body.appendChild(b);
      }
      this._pendingIncoming = data;
      b.classList.remove('hidden');
      b.innerHTML = `<div class="min-w-0"><div class="text-xs font-black animate-pulse">📞 مكالمة صوتية واردة (مسجّلة للضمان)</div><div class="text-[11px] font-bold truncate">${window.DamanApp.esc(data.callerName || 'مستخدم')}</div></div><div class="flex gap-1.5 shrink-0"><button onclick="DamanChat.acceptIncomingCall()" class="px-3 py-1.5 rounded-xl bg-white text-emerald-700 font-black text-xs">رد</button><button onclick="DamanChat.rejectIncomingCall()" class="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-xs">رفض</button></div>`;
    },

    hideIncomingCallBanner() { document.getElementById('daman-incoming-call-bar')?.classList.add('hidden'); },

    async rejectIncomingCall() {
      const app = window.DamanApp;
      const d = this._pendingIncoming;
      this.hideIncomingCallBanner();
      if (!d || !app.user) return;
      await app.db.collection('incomingCalls').doc(app.user.uid).delete().catch(() => {});
      await app.db.collection('chats').doc(d.chatId).collection('calls').doc(d.callId).update({ status: 'rejected' }).catch(() => {});
    },

    async acceptIncomingCall() {
      const app = window.DamanApp;
      const d = this._pendingIncoming;
      this.hideIncomingCallBanner();
      if (!d || !app.user) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const pc = new RTCPeerConnection(this.buildRtcConfig(app));
        stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
        const callRef = app.db.collection('chats').doc(d.chatId).collection('calls').doc(d.callId);
        const callerCands = callRef.collection('callerCandidates');
        const calleeCands = callRef.collection('calleeCandidates');

        this.callState = {
          active: true, chatId: d.chatId, callId: d.callId, otherUid: d.callerUid, otherName: d.callerName, role: 'callee',
          pc, localStream: stream, mediaRecorder: null, recordedChunks: [],
          startedAt: Date.now(), timerInt: null, unsubCallDoc: null, unsubRemoteCands: null, muted: false
        };
        this.showCallOverlay(`متصل مع ${d.callerName}`);
        this.startCallTimer();

        pc.ontrack = (ev) => { const aud = document.getElementById('daman-remote-audio'); if (aud && ev.streams[0]) { aud.srcObject = ev.streams[0]; aud.play().catch(() => {}); } };
        pc.onicecandidate = (ev) => { if (ev.candidate) calleeCands.add(ev.candidate.toJSON()).catch(() => {}); };

        const offer = (await callRef.get()).data()?.offer;
        if (!offer) return this.endActiveCall(true);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await callRef.update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'connected' });
        await app.db.collection('incomingCalls').doc(app.user.uid).delete().catch(() => {});

        this.callState.unsubRemoteCands = callerCands.onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => { if (ch.type === 'added') pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {}); });
        });
        this.callState.unsubCallDoc = callRef.onSnapshot((snap) => { if (snap.data()?.status === 'ended') this.endActiveCall(false); });
      } catch (e) { app.toast('تعذر فتح الميكروفون للرد', 'error'); this.endActiveCall(true); }
    },

    startLocalRecording(localStream, remoteStream) {
      if (this.callState.mediaRecorder || typeof MediaRecorder === 'undefined') return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const dest = ctx.createMediaStreamDestination();
        if (localStream) ctx.createMediaStreamSource(localStream).connect(dest);
        if (remoteStream) ctx.createMediaStreamSource(remoteStream).connect(dest);
        const mr = new MediaRecorder(dest.stream);
        this.callState.recordedChunks = [];
        mr.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) this.callState.recordedChunks.push(ev.data); };
        mr.start(3000);
        this.callState.mediaRecorder = mr;
      } catch (e) {}
    },

    showCallOverlay(statusTxt) {
      let ov = document.getElementById('daman-global-call-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'daman-global-call-overlay';
        ov.className = 'fixed top-16 inset-x-3 z-[126] max-w-md mx-auto bg-slate-900 border-2 border-emerald-500 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-2 text-xs';
        document.body.appendChild(ov);
      }
      ov.classList.remove('hidden');
      ov.innerHTML = `<div class="min-w-0"><div class="font-black text-emerald-400 truncate"><i class="fa-solid fa-phone-volume me-1 animate-pulse"></i> ${window.DamanApp.esc(statusTxt)}</div><div id="daman-call-timer" class="text-[10px] text-amber-300 font-bold">🔴 مسجّلة تلقائياً لحفظ الحقوق</div></div><div class="flex items-center gap-1.5 shrink-0"><button onclick="DamanChat.toggleMuteCall()" id="daman-mute-btn" class="w-8 h-8 rounded-xl bg-slate-800 text-white"><i class="fa-solid fa-microphone"></i></button><button onclick="DamanChat.endActiveCall(false)" class="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black">إنهاء</button></div>`;
    },

    startCallTimer() {
      if (this.callState.timerInt) clearInterval(this.callState.timerInt);
      this.callState.timerInt = setInterval(() => {
        const el = document.getElementById('daman-call-timer');
        if (!el) return;
        const sec = Math.floor((Date.now() - this.callState.startedAt) / 1000);
        el.textContent = `🔴 ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')} — مسجّلة للضمان`;
      }, 1000);
    },

    toggleMuteCall() {
      if (!this.callState.localStream) return;
      this.callState.muted = !this.callState.muted;
      this.callState.localStream.getAudioTracks().forEach((t) => { t.enabled = !this.callState.muted; });
      const b = document.getElementById('daman-mute-btn');
      if (b) b.innerHTML = this.callState.muted ? '<i class="fa-solid fa-microphone-slash text-rose-400"></i>' : '<i class="fa-solid fa-microphone"></i>';
    },

    async endActiveCall(silent = false) {
      const app = window.DamanApp;
      const cs = this.callState;
      if (!cs.active) return;
      cs.active = false;
      if (cs.timerInt) clearInterval(cs.timerInt);
      if (cs.unsubCallDoc) { try { cs.unsubCallDoc(); } catch (e) {} }
      if (cs.unsubRemoteCands) { try { cs.unsubRemoteCands(); } catch (e) {} }

      const durationSec = Math.max(1, Math.round((Date.now() - cs.startedAt) / 1000));
      if (cs.mediaRecorder && cs.mediaRecorder.state !== 'inactive') {
        try {
          cs.mediaRecorder.onstop = async () => {
            if (!cs.recordedChunks.length || durationSec < 2) return;
            const blob = new Blob(cs.recordedChunks, { type: 'audio/webm' });
            if (blob.size > 650000) return;
            const r = new FileReader();
            r.onloadend = async () => {
              try {
                const audioMedia = await app.saveMedia(r.result, { kind: 'call_audio' });
                await app.db.collection('callRecordings').add({
                  chatId: cs.chatId, callId: cs.callId,
                  callerUid: app.user?.uid || '', callerName: app.profile?.name || '',
                  otherUid: cs.otherUid || '', otherName: cs.otherName || '',
                  durationSec, audioMedia, pinned: false,
                  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
                  date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              } catch (e) {}
            };
            r.readAsDataURL(blob);
          };
          cs.mediaRecorder.stop();
        } catch (e) {}
      }
      if (cs.localStream) cs.localStream.getTracks().forEach((t) => t.stop());
      if (cs.pc) { try { cs.pc.close(); } catch (e) {} }
      if (!silent && cs.chatId && cs.callId && app) {
        app.db.collection('chats').doc(cs.chatId).collection('calls').doc(cs.callId).update({ status: 'ended' }).catch(() => {});
        if (cs.otherUid) app.db.collection('incomingCalls').doc(cs.otherUid).delete().catch(() => {});
      }
      document.getElementById('daman-global-call-overlay')?.classList.add('hidden');
    },

    // ==================== SUPPORT TICKETS ====================
    async submitSupportTicket(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user) return;
      const subject = document.getElementById('tk-subj').value.trim();
      const message = document.getElementById('tk-msg').value.trim();
      if (!subject || !message) return;
      await app.db.collection('supportTickets').add({
        userId: app.user.uid, userName: app.profile?.name || '', userPhone: app.profile?.phone || '',
        subject, message, status: 'open', adminReply: '', date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await app.sendNotification('ADMIN', '🎫 تذكرة دعم فني جديدة', `${app.profile?.name}: ${subject}`);
      e.target.reset();
      app.toast('تم إرسال تذكرة الدعم بنجاح ✅', 'success');
    },

    // ==================== RENDER CONTRACT CARD (WITH CLEAR PAYOUT SCHEDULE & REQUESTS) ====================
    renderContractCard(a, app) {
      const uid = app.user?.uid;
      const isPayer = a.payerUid === uid;
      const isProv = a.providerUid === uid;
      const stLabels = {
        draft: '<span class="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 text-[9.5px] font-black">مسودة — بانتظار الحجز</span>',
        funded: '<span class="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[9.5px] font-black">محجوز 100% ✅</span>',
        disputed: '<span class="px-2 py-0.5 rounded-lg bg-rose-500/25 text-rose-300 text-[9.5px] font-black">⚖️ قيد التحكيم</span>',
        completed: '<span class="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-[9.5px] font-black">🏁 مكتمل ومُصفّى</span>',
        cancelled: '<span class="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[9.5px] font-black">ملغى</span>'
      };
      const canRate = a.status === 'completed' && ((isPayer && !a.ratedByPayer) || (isProv && !a.ratedByProvider));
      const logsCount = Array.isArray(a.payoutLogs) ? a.payoutLogs.length : 0;
      const isLump = a.paymentModel === 'lump_sum' || a.paymentModel === 'b2b_supply';

      return `
        <div class="glass-card rounded-2xl p-3.5 space-y-2 border-amber-500/40 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="font-black text-amber-400">${app.esc(a.ticketNumber)}</span>
            ${stLabels[a.status] || ''}
          </div>
          <div class="font-black text-white">${app.esc(a.title)}</div>

          <div class="grid grid-cols-2 gap-1.5 text-[10.5px] p-2 rounded-xl bg-slate-950 border border-slate-800">
            <div>إجمالي العقد: <b class="text-emerald-400">${app.fmtMoney(a.totalAmount)} ج.م</b></div>
            <div>المتبقي بالضمان: <b class="text-amber-300">${app.fmtMoney(a.remainingEscrow || 0)} ج.م</b></div>
            <div>البداية: <b class="text-white">${app.esc(a.startDate || a.date || '—')}</b></div>
            <div>التسليم: <b class="text-white">${app.esc(a.endDate || '—')}</b></div>
            <div class="col-span-2 pt-1 border-t border-slate-800 text-[10px] text-sky-300">
              <b>نظام الصرف:</b> ${this.paymentModelLabel(a.paymentModel)}${a.dailyRate ? ` (${app.fmtMoney(a.dailyRate)} ج.م/يوم • تأمين ${a.retentionPct || 0}%)` : ''}
            </div>
          </div>

          <div class="text-[10px] text-slate-300">
            صاحب العمل: <b>${app.esc(a.payerLegalName || a.payerName)}</b> | المنفّذ: <b>${app.esc(a.providerLegalName || a.providerName)}</b>
          </div>

          <!-- Pending Payout Request Banner -->
          ${a.status === 'funded' && a.pendingPayoutReq ? `
            <div class="p-2.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500 space-y-1.5">
              <div class="font-black text-emerald-300 text-[11px]">
                🔔 ${a.pendingPayoutReq.isFinalHandover ? 'طلب استلام وتصفية نهائية' : 'طلب صرف من المنفّذ'}: ${app.fmtMoney(a.pendingPayoutReq.netAmount)} ج.م
              </div>
              <div class="text-[10.5px] text-white">${app.esc(a.pendingPayoutReq.note)}${a.pendingPayoutReq.days ? ` (${a.pendingPayoutReq.days} يوم — تأمين محتجز: ${app.fmtMoney(a.pendingPayoutReq.retentionHeld || 0)} ج.م)` : ''}</div>
              ${a.pendingPayoutReq.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${a.pendingPayoutReq.photoMedia}','صورة إثبات الشغل')" class="text-[10px] text-sky-300 underline font-bold">👁️ معاينة صورة الشغل المرفقة</button>` : ''}
              ${isPayer ? `
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                  <button onclick="DamanChat.approvePayoutRequest('${a.id}')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">✅ اعتماد وصرف الآن</button>
                  <button onclick="DamanChat.rejectPayoutRequest('${a.id}')" class="py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10.5px]">❌ رفض الطلب</button>
                </div>` : '<div class="text-[10px] text-amber-300 font-bold">⏳ بانتظار موافقة صاحب العمل على الصرف...</div>'}
            </div>` : ''}

          <!-- Pending Mutual Deduction Banner -->
          ${a.status === 'funded' && a.pendingDeduction ? `
            <div class="p-2.5 rounded-xl bg-rose-500/15 border-2 border-rose-500 space-y-1.5">
              <div class="font-black text-rose-300 text-[11px]">⚠️ إشعار خصم مقترح: ${app.fmtMoney(a.pendingDeduction.amount)} ج.م</div>
              <div class="text-[10.5px] text-white">السبب: ${app.esc(a.pendingDeduction.reason)}</div>
              ${isProv ? `
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                  <button onclick="DamanChat.respondDeduction('${a.id}',true)" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">موافقة على الخصم</button>
                  <button onclick="DamanChat.respondDeduction('${a.id}',false)" class="py-1.5 rounded-lg bg-rose-600 text-white font-black text-[10.5px]">رفض الخصم</button>
                </div>` : '<div class="text-[10px] text-amber-300 font-bold">⏳ بانتظار رد المنفّذ على إشعار الخصم...</div>'}
            </div>` : ''}

          <!-- Draft Actions -->
          ${a.status === 'draft' ? `
            <div class="flex gap-1.5">
              ${isPayer ? `<button onclick="DamanChat.fundContract('${a.id}')" class="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">حجز الضمان 100% الآن</button>` : `<div class="flex-1 py-2 text-center text-[10.5px] text-amber-300 font-bold">بانتظار حجز الضمان من صاحب العمل</div>`}
              <button onclick="DamanChat.cancelDraftContract('${a.id}')" class="px-3 py-2 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[10.5px]">إلغاء</button>
            </div>` : ''}

          <!-- Funded Contract Actions -->
          ${a.status === 'funded' ? `
            <div class="space-y-1.5">
              <div class="grid grid-cols-3 gap-1.5">
                <button onclick="DamanChat.openSignatureModal('${a.id}')" class="py-1.5 rounded-xl bg-slate-800 text-amber-300 font-bold text-[10px]">✍️ توقيع ${(isPayer && a.payerSigBase64) || (isProv && a.providerSigBase64) ? '✅' : ''}</button>
                <button onclick="DamanChat.printContractA4('${a.id}')" class="py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10px]">🖨️ طباعة A4</button>
                <button onclick="DamanChat.openContractHistoryModal('${a.id}')" class="py-1.5 rounded-xl bg-slate-800 text-sky-300 font-bold text-[10px]">📜 الدفعات (${logsCount})</button>
              </div>

              ${a.contractStatus !== 'approved' ? `
                <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-2">
                  <span class="text-[10px] text-amber-200 font-bold">${a.contractStatus === 'pending_admin' ? '⏳ العقد الموقّع قيد اعتماد الإدارة' : 'ارفع صورة العقد الموقّع لتفعيل الصرف'}</span>
                  <label class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] cursor-pointer shrink-0">
                    رفع الصورة
                    <input type="file" accept="image/*" class="hidden" onchange="DamanChat.uploadSignedContractPhoto(this,'${a.id}')" />
                  </label>
                </div>` : `
                <div class="text-[10px] text-emerald-400 font-black">✅ العقد الموقّع معتمد من الإدارة — أزرار التشغيل مفعّلة</div>
                ${isProv && !a.pendingPayoutReq ? `
                  <button onclick="DamanChat.openRequestPayoutModal('${a.id}')" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">
                    ${a.paymentModel === 'daily_wages' ? '💸 طلب صرف يوميات عمل' : isLump ? '🏁 إشعار جاهزية للاستلام والتصفية' : '💸 طلب صرف دفعة / مستخلص'}
                  </button>` : ''}
                ${isPayer ? `
                  <div class="grid grid-cols-2 gap-1.5">
                    ${!isLump ? `<button onclick="DamanChat.disburseFromContract('${a.id}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10.5px]">💸 صرف دفعة/يومية</button>` : ''}
                    <button onclick="DamanChat.settleContractFinal('${a.id}')" class="${isLump ? 'col-span-2' : ''} py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">🏁 استلام وتصفية نهائية 100%</button>
                    <button onclick="DamanChat.extendContract('${a.id}')" class="py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 font-black text-[10px]">📅 تمديد / زيادة</button>
                    <button onclick="DamanChat.openProposeDeductionModal('${a.id}')" class="py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[10px]">⚠️ إشعار خصم</button>
                  </div>` : ''}
                <button onclick="DamanChat.openDispute('${a.id}')" class="w-full py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-[10px]">⚖️ فتح نزاع رسمي للتحكيم</button>`}
            </div>` : ''}

          ${a.status === 'completed' ? `
            <div class="flex gap-1.5">
              <button onclick="DamanChat.openContractHistoryModal('${a.id}')" class="px-3 py-1.5 rounded-xl bg-slate-800 text-sky-300 font-bold text-[10.5px]">📜 الدفعات (${logsCount})</button>
              <button onclick="DamanChat.printContractA4('${a.id}')" class="flex-1 py-1.5 rounded-xl bg-slate-800 text-white font-bold text-[10.5px]">طباعة A4</button>
              ${canRate ? `<button onclick="DamanChat.openReviewModal('${a.id}')" class="flex-1 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">⭐ تقييم</button>` : ''}
            </div>` : ''}
        </div>`;
    },

    // ==================== MAIN RENDER ====================
    render(container, app) {
      this.ensureListeners(app);
      if (!app.user || !app.profile) {
        container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">سجّل الدخول لفتح المحادثات والعقود</button></div>`;
        return;
      }

      if (this.activeChatId) {
        const roomAgs = this.agreements.filter((a) => a.chatId === this.activeChatId && ['draft', 'funded', 'disputed'].includes(a.status));
        container.innerHTML = `
          <div class="flex flex-col h-[calc(100vh-145px)] space-y-2">
            <div class="glass-card rounded-2xl p-2.5 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <button onclick="DamanChat.closeActiveChat()" class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0"><i class="fa-solid fa-arrow-right"></i></button>
                <div class="min-w-0">
                  <div class="text-xs font-black text-white truncate">${app.esc(this.activeChatMeta?.otherName || 'محادثة')}</div>
                  <div class="text-[9.5px] text-emerald-400 font-bold">محادثة وعقود محمية بضمان سايت</div>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="DamanChat.openCreateContractModal()" class="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]"><i class="fa-solid fa-file-contract me-1"></i> عقد</button>
                <button onclick="DamanChat.startVoiceCall()" class="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center"><i class="fa-solid fa-phone"></i></button>
              </div>
            </div>

            ${roomAgs.length ? `<div class="max-h-56 overflow-y-auto space-y-2">${roomAgs.map((a) => this.renderContractCard(a, app)).join('')}</div>` : ''}

            <div id="daman-chat-scroll" class="flex-1 overflow-y-auto space-y-2 p-2 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs">
              ${!this.activeMessages.length ? `<div class="text-center text-slate-500 py-10">ابدأ الاتفاق الآمن بالرسائل أو اضغط «عقد» لإبرام اتفاق رسمي مضمون.</div>` : this.activeMessages.map((m) => {
                const mine = m.senderId === app.user.uid;
                return `
                  <div class="flex ${mine ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[82%] rounded-2xl px-3 py-2 space-y-1 ${m.isAdmin ? 'bg-purple-800/90 border border-amber-400 text-amber-100' : mine ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-white'}">
                      ${!mine || m.isAdmin ? `<div class="text-[9.5px] font-black opacity-80">${app.esc(m.senderName || '')}</div>` : ''}
                      ${m.type === 'image' && m.thumbBase64 ? `<img src="${m.thumbBase64}" onclick="DamanApp.openMediaLightbox('${m.mediaId || m.thumbBase64}','صورة محادثة')" class="max-h-44 rounded-xl cursor-pointer" />` : ''}
                      <div class="whitespace-pre-line leading-relaxed">${app.esc(m.text || '')}</div>
                      <div class="text-[9px] opacity-70 text-end">${app.esc(m.time || m.date || '')}</div>
                    </div>
                  </div>`;
              }).join('')}
            </div>

            <form onsubmit="DamanChat.sendMessage(event)" class="flex items-center gap-1.5">
              <label class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center cursor-pointer shrink-0">
                <i class="fa-solid fa-image"></i>
                <input type="file" accept="image/*" class="hidden" onchange="DamanChat.sendChatImage(this)" />
              </label>
              <input id="daman-msg-input" type="text" placeholder="${this.activeChatMeta?.frozen ? 'المحادثة مجمّدة من الإدارة' : 'اكتب رسالتك هنا...'}" ${this.activeChatMeta?.frozen && !app.hasAdminAccess() ? 'disabled' : ''} class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
              <button type="submit" class="px-4 h-10 rounded-xl bg-amber-500 text-slate-950 font-black"><i class="fa-solid fa-paper-plane"></i></button>
            </form>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="space-y-3">
          <div class="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-extrabold">
            <button onclick="DamanChat.setSubTab('chats')" class="py-2 rounded-lg ${this.subTab === 'chats' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">المحادثات (${this.chats.length})</button>
            <button onclick="DamanChat.setSubTab('contracts')" class="py-2 rounded-lg ${this.subTab === 'contracts' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">عقودي (${this.agreements.length})</button>
            <button onclick="DamanChat.setSubTab('tickets')" class="py-2 rounded-lg ${this.subTab === 'tickets' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">الدعم (${this.tickets.length})</button>
          </div>

          ${this.subTab === 'chats' ? `
            <div class="space-y-2">
              <button onclick="DamanChat.openDirectChat('admin','إدارة ضمان سايت')" class="w-full p-3 rounded-2xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-between text-xs font-black text-purple-200">
                <span><i class="fa-solid fa-headset me-1.5 text-amber-400"></i> محادثة مباشرة مع إدارة ضمان سايت</span>
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              ${!this.chats.length
                ? `<div class="glass-card rounded-2xl p-7 text-center text-xs text-slate-400">لا توجد محادثات بعد — تصفح السوق واضغط «مراسلة واتفاق» على أي إعلان.</div>`
                : this.chats.map((c) => {
                    const otherUid = (c.participants || []).find((u) => u !== app.user.uid) || '';
                    const otherName = (c.participantNames && c.participantNames[otherUid]) || 'مستخدم';
                    const unread = Number((c.unreadBy && c.unreadBy[app.user.uid]) || 0);
                    return `
                      <div onclick="DamanChat.openChatRoom('${c.id}',{otherUid:'${otherUid}',otherName:'${app.esc(otherName).replace(/'/g, "\\'")}',frozen:${!!c.frozen}})" class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2 cursor-pointer hover:border-amber-500/40">
                        <div class="min-w-0">
                          <div class="text-xs font-black text-white truncate">${app.esc(otherName)} ${c.frozen ? '🔒' : ''}</div>
                          <div class="text-[11px] text-slate-400 truncate mt-0.5">${app.esc(c.lastMessage || '')}</div>
                        </div>
                        ${unread > 0 ? `<span class="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">${unread}</span>` : '<i class="fa-solid fa-chevron-left text-slate-600 text-xs"></i>'}
                      </div>`;
                  }).join('')}
            </div>` : ''}

          ${this.subTab === 'contracts' ? `
            <div class="space-y-2.5">
              ${!this.agreements.length
                ? `<div class="glass-card rounded-2xl p-7 text-center text-xs text-slate-400">لا توجد عقود رسمية بعد — افتح أي محادثة واضغط زر «عقد» لإنشاء عقد رسمي بالرقم القومي.</div>`
                : this.agreements.map((a) => this.renderContractCard(a, app)).join('')}
            </div>` : ''}

          ${this.subTab === 'tickets' ? `
            <div class="space-y-3 text-xs">
              <form onsubmit="DamanChat.submitSupportTicket(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
                <div class="font-black text-sky-400">فتح تذكرة دعم فني / شكوى</div>
                <div><label class="block text-[10px] text-slate-400 mb-1">عنوان التذكرة *</label><input id="tk-subj" type="text" required placeholder="مثال: استفسار عن عقد أو شحن" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
                <div><label class="block text-[10px] text-slate-400 mb-1">التفاصيل *</label><textarea id="tk-msg" rows="3" required placeholder="اشرح المشكلة بالتفصيل..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea></div>
                <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">إرسال للإدارة</button>
              </form>
              ${this.tickets.map((t) => `
                <div class="glass-card rounded-2xl p-3 space-y-1">
                  <div class="flex justify-between"><b class="text-white">${app.esc(t.subject)}</b><span class="text-[10px] font-bold ${t.status === 'closed' ? 'text-emerald-400' : 'text-amber-300'}">${t.status === 'closed' ? 'تم الرد ✅' : 'مفتوحة ⏳'}</span></div>
                  <div class="text-[11px] text-slate-300">${app.esc(t.message)}</div>
                  ${t.adminReply ? `<div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200"><b>رد الإدارة:</b> ${app.esc(t.adminReply)}</div>` : ''}
                </div>`).join('')}
            </div>` : ''}
        </div>`;
    }
  };

  window.DamanChat = ChatMod;
  if (window.DamanApp) window.DamanApp.registerModule('chat', ChatMod);
})();
