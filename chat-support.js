(function () {
  const CHAT_VER = '28';

  if (!window.DamanToggleHelp) {
    window.DamanToggleHelp = function (id) {
      const el = document.getElementById('fh-' + id);
      if (el) el.classList.toggle('hidden');
    };
  }

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

    _extrasReady: false,
    _extrasLoading: false,

    tempPayoutPhoto: '',
    tempAddonPhoto: '',
    draftContractAddons: [],

    callState: {
      active: false, chatId: null, callId: null, otherUid: null, otherName: '',
      role: null, pc: null, localStream: null, mediaRecorder: null, recordedChunks: [],
      startedAt: 0, timerInt: null, unsubCallDoc: null, unsubRemoteCands: null, muted: false
    },

    // ==================== INTERACTIVE ? HELP TOOLTIP & EXTRAS LOADER ====================
    hBtn(id) {
      return `<button type="button" onclick="window.DamanToggleHelp('${id}')" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/25 border border-sky-400/70 text-sky-300 text-[9.5px] font-black ms-1 align-middle" title="شرح الخانة">؟</button>`;
    },

    hBox(id, text) {
      return `<div id="fh-${id}" class="hidden mt-1 mb-1.5 p-2.5 rounded-xl bg-sky-950/95 border border-sky-400/60 text-[11px] text-sky-100 leading-relaxed font-semibold shadow-lg">💡 ${text}</div>`;
    },

    registerExtras(extObj) {
      Object.assign(this, extObj);
      this._extrasReady = true;
      this._extrasLoading = false;
    },

    ensureExtrasLoaded(cb) {
      if (this._extrasReady) { if (cb) cb(); return; }
      if (this._extrasLoading) {
        if (cb) setTimeout(() => { if (this._extrasReady) cb(); }, 700);
        return;
      }
      this._extrasLoading = true;
      const sc = document.createElement('script');
      sc.src = `chat-extras.js?v=${CHAT_VER}&t=${Date.now()}`;
      sc.onload = () => {
        this._extrasLoading = false;
        if (this._extrasReady && cb) cb();
      };
      sc.onerror = () => {
        this._extrasLoading = false;
        if (window.DamanApp) window.DamanApp.toast('تأكد من رفع ملف chat-extras.js على GitHub', 'error');
      };
      document.body.appendChild(sc);
    },

    runExtra(fnName, ...args) {
      if (this._extrasReady && typeof this[fnName] === 'function') {
        return this[fnName](...args);
      }
      if (window.DamanApp) window.DamanApp.toast('جارٍ تحميل أدوات العقد...', 'info');
      this.ensureExtrasLoaded(() => {
        if (typeof this[fnName] === 'function') this[fnName](...args);
      });
    },

    openCreateContractModal() { return this.runExtra('_openCreateContractModalImpl'); },
    openAddAddonModal(agId) { return this.runExtra('_openAddAddonModalImpl', agId); },
    openRequestPayoutModal(agId) { return this.runExtra('_openRequestPayoutModalImpl', agId); },
    openContractHistoryModal(agId) { return this.runExtra('_openContractHistoryModalImpl', agId); },
    openSignatureModal(agId) { return this.runExtra('_openSignatureModalImpl', agId); },
    printContractA4(agId) { return this.runExtra('_printContractA4Impl', agId); },
    openReviewModal(agId) { return this.runExtra('_openReviewModalImpl', agId); },

    // ==================== LIFECYCLE & LISTENERS ====================
    ensureListeners(app) {
      this.ensureExtrasLoaded();
      if (!app.user) { this.detachListeners(); return; }
      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      const uid = app.user.uid;
      const db = app.db;

      this.unsubChats = db.collection('chats').where('participants', 'array-contains', uid).limit(60).onSnapshot((snap) => {
        this.chats = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        this.updateUnreadBadge(app);
        if (app.activeTab === 'chat' && !this.activeChatId && this.subTab === 'chats') this.rerender();
      }, () => {});

      this.unsubAgs = db.collection('chatAgreements').where('participants', 'array-contains', uid).limit(60).onSnapshot((snap) => {
        this.agreements = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'chat') this.rerender();
      }, () => {});

      this.unsubTickets = db.collection('supportTickets').where('userId', '==', uid).limit(30).onSnapshot((snap) => {
        this.tickets = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'chat' && this.subTab === 'tickets') this.rerender();
      }, () => {});

      this.unsubIncomingCall = db.collection('incomingCalls').doc(uid).onSnapshot((snap) => {
        if (!snap.exists) { this.hideIncomingCallBanner(); return; }
        const data = snap.data();
        if (data && data.status === 'ringing' && !this.callState.active) {
          if (Date.now() - Number(data.sentAtMs || 0) < 65000) this.showIncomingCallBanner(data);
        } else {
          this.hideIncomingCallBanner();
        }
      }, () => {});
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

    addonCategoryLabel(c) {
      return {
        vehicle: '🚗 سيارة / نقل',
        equipment: '🏗️ معدة / ونش / شدة',
        materials: '🧱 خامات ومواد إضافية',
        accommodation: '🏠 سكن / إقامة / إعاشة',
        other: '➕ إضافة أخرى'
      }[c] || '➕ إضافة';
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

    // ==================== DIRECT CHAT ROOMS & MESSAGING ====================
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

      this.unsubMsgs = app.db.collection('chats').doc(chatId).collection('messages').limit(120).onSnapshot((snap) => {
        this.activeMessages = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        this.rerender();
        setTimeout(() => {
          const box = document.getElementById('daman-chat-scroll');
          if (box) box.scrollTop = box.scrollHeight;
        }, 60);
      }, () => {});

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
      if (this.activeChatMeta?.frozen && !app.hasAdminAccess()) return app.toast('هذه المحادثة مجمّدة حالياً من الإدارة 🔒', 'error');
      const inp = document.getElementById('daman-msg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text) return;
      inp.value = '';

      const isAdminInt = app.hasAdminAccess() && !(this.chats.find((c) => c.id === this.activeChatId)?.participants || []).includes(app.user.uid);
      const senderName = isAdminInt ? '👑 إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || 'مستخدم');
      const chatRef = app.db.collection('chats').doc(this.activeChatId);

      try {
        await chatRef.collection('messages').add({
          senderId: app.user.uid, senderName, isAdmin: isAdminInt,
          type: 'text', text, date: app.todayLocal(),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const upd = { lastMessage: text.slice(0, 90), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (this.activeChatMeta?.otherUid) upd[`unreadBy.${this.activeChatMeta.otherUid}`] = firebase.firestore.FieldValue.increment(1);
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
        if (this.activeChatMeta?.otherUid) upd[`unreadBy.${this.activeChatMeta.otherUid}`] = firebase.firestore.FieldValue.increment(1);
        await chatRef.update(upd).catch(() => {});
      } catch (e) { app.toast('تعذر إرسال الصورة', 'error'); }
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

    // ==================== CONTRACT CARD (SHOWS VEHICLES/ADDONS + PAYOUTS + DEDUCTIONS) ====================
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
      const addons = Array.isArray(a.addons) ? a.addons : [];
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

          ${addons.length ? `
            <div class="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1 text-[10px]">
              <div class="font-black text-purple-300">🚗 سيارات وإضافات ملحقة بالعقد (${addons.length}):</div>
              ${addons.slice(0, 3).map((ad) => `
                <div class="flex items-center justify-between gap-1 text-slate-200">
                  <span class="truncate">• ${this.addonCategoryLabel(ad.category)}: <b>${app.esc(ad.title)}</b>${ad.plateNumber ? ` [${app.esc(ad.plateNumber)}]` : ''}</span>
                  ${Number(ad.cost || 0) > 0 ? `<b class="text-amber-300 shrink-0">${app.fmtMoney(ad.cost)} ج.م</b>` : '<span class="text-emerald-400 shrink-0">ضمن العقد</span>'}
                </div>`).join('')}
              ${addons.length > 3 ? `<div class="text-[9.5px] text-purple-200">+ ${addons.length - 3} إضافات أخرى (اضغط سجل العقد للعرض)</div>` : ''}
            </div>` : ''}

          <div class="text-[10px] text-slate-300">
            صاحب العمل: <b>${app.esc(a.payerLegalName || a.payerName)}</b> | المنفّذ: <b>${app.esc(a.providerLegalName || a.providerName)}</b>
          </div>

          ${a.status === 'funded' && a.pendingPayoutReq ? `
            <div class="p-2.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500 space-y-1.5">
              <div class="font-black text-emerald-300 text-[11px]">🔔 ${a.pendingPayoutReq.isFinalHandover ? 'طلب استلام وتصفية نهائية' : 'طلب صرف من المنفّذ'}: ${app.fmtMoney(a.pendingPayoutReq.netAmount)} ج.م</div>
              <div class="text-[10.5px] text-white">${app.esc(a.pendingPayoutReq.note)}${a.pendingPayoutReq.days ? ` (${a.pendingPayoutReq.days} يوم — تأمين محتجز: ${app.fmtMoney(a.pendingPayoutReq.retentionHeld || 0)} ج.م)` : ''}</div>
              ${a.pendingPayoutReq.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${a.pendingPayoutReq.photoMedia}','صورة إثبات الشغل')" class="text-[10px] text-sky-300 underline font-bold">👁️ معاينة صورة الشغل</button>` : ''}
              ${isPayer ? `
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                  <button onclick="DamanChat.runExtra('approvePayoutRequest','${a.id}')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">✅ اعتماد وصرف</button>
                  <button onclick="DamanChat.runExtra('rejectPayoutRequest','${a.id}')" class="py-1.5 rounded-lg bg-rose-500 text-white font-black text-[10.5px]">❌ رفض الطلب</button>
                </div>` : '<div class="text-[10px] text-amber-300 font-bold">⏳ بانتظار موافقة صاحب العمل على الصرف...</div>'}
            </div>` : ''}

          ${a.status === 'funded' && a.pendingDeduction ? `
            <div class="p-2.5 rounded-xl bg-rose-500/15 border-2 border-rose-500 space-y-1.5">
              <div class="font-black text-rose-300 text-[11px]">⚠️ إشعار خصم مقترح: ${app.fmtMoney(a.pendingDeduction.amount)} ج.م</div>
              <div class="text-[10.5px] text-white">السبب: ${app.esc(a.pendingDeduction.reason)}</div>
              ${isProv ? `
                <div class="grid grid-cols-2 gap-1.5 pt-1">
                  <button onclick="DamanChat.runExtra('respondDeduction','${a.id}',true)" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">موافقة على الخصم</button>
                  <button onclick="DamanChat.runExtra('respondDeduction','${a.id}',false)" class="py-1.5 rounded-lg bg-rose-600 text-white font-black text-[10.5px]">رفض الخصم</button>
                </div>` : '<div class="text-[10px] text-amber-300 font-bold">⏳ بانتظار رد المنفّذ على إشعار الخصم...</div>'}
            </div>` : ''}

          ${a.status === 'draft' ? `
            <div class="space-y-1.5">
              <div class="flex gap-1.5">
                ${isPayer ? `<button onclick="DamanChat.runExtra('fundContract','${a.id}')" class="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">حجز الضمان 100% الآن</button>` : `<div class="flex-1 py-2 text-center text-[10.5px] text-amber-300 font-bold">بانتظار حجز الضمان من صاحب العمل</div>`}
                <button onclick="DamanChat.openAddAddonModal('${a.id}')" class="px-2.5 py-2 rounded-xl bg-purple-500/25 border border-purple-500/50 text-purple-200 font-black text-[10px]">🚗 سيارة/ملحق</button>
                <button onclick="DamanChat.runExtra('cancelDraftContract','${a.id}')" class="px-2.5 py-2 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[10px]">إلغاء</button>
              </div>
            </div>` : ''}

          ${a.status === 'funded' ? `
            <div class="space-y-1.5">
              <div class="grid grid-cols-4 gap-1">
                <button onclick="DamanChat.openSignatureModal('${a.id}')" class="py-1.5 rounded-xl bg-slate-800 text-amber-300 font-bold text-[9.5px]">✍️ توقيع ${(isPayer && a.payerSigBase64) || (isProv && a.providerSigBase64) ? '✅' : ''}</button>
                <button onclick="DamanChat.printContractA4('${a.id}')" class="py-1.5 rounded-xl bg-white text-slate-950 font-black text-[9.5px]">🖨️ A4</button>
                <button onclick="DamanChat.openAddAddonModal('${a.id}')" class="py-1.5 rounded-xl bg-purple-500/25 text-purple-200 border border-purple-500/40 font-black text-[9.5px]">🚗 إضافة</button>
                <button onclick="DamanChat.openContractHistoryModal('${a.id}')" class="py-1.5 rounded-xl bg-slate-800 text-sky-300 font-bold text-[9.5px]">📜 السجل (${logsCount + addons.length})</button>
              </div>

              ${a.contractStatus !== 'approved' ? `
                <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-2">
                  <span class="text-[10px] text-amber-200 font-bold">${a.contractStatus === 'pending_admin' ? '⏳ العقد الموقّع قيد اعتماد الإدارة' : 'ارفع صورة العقد الموقّع لتفعيل الصرف'}</span>
                  <label class="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] cursor-pointer shrink-0">
                    رفع الصورة
                    <input type="file" accept="image/*" class="hidden" onchange="DamanChat.runExtra('uploadSignedContractPhoto',this,'${a.id}')" />
                  </label>
                </div>` : `
                <div class="text-[10px] text-emerald-400 font-black">✅ العقد الموقّع معتمد من الإدارة — أزرار التشغيل مفعّلة</div>
                ${isProv && !a.pendingPayoutReq ? `
                  <button onclick="DamanChat.openRequestPayoutModal('${a.id}')" class="w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">
                    ${a.paymentModel === 'daily_wages' ? '💸 طلب صرف يوميات عمل' : isLump ? '🏁 إشعار جاهزية للاستلام والتصفية' : '💸 طلب صرف دفعة / مستخلص'}
                  </button>` : ''}
                ${isPayer ? `
                  <div class="grid grid-cols-2 gap-1.5">
                    ${!isLump ? `<button onclick="DamanChat.runExtra('disburseFromContract','${a.id}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10.5px]">💸 صرف دفعة/يومية</button>` : ''}
                    <button onclick="DamanChat.runExtra('settleContractFinal','${a.id}')" class="${isLump ? 'col-span-2' : ''} py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">🏁 استلام وتصفية 100%</button>
                    <button onclick="DamanChat.runExtra('extendContract','${a.id}')" class="py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 font-black text-[10px]">📅 تمديد / زيادة</button>
                    <button onclick="DamanChat.runExtra('openProposeDeductionModal','${a.id}')" class="py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[10px]">⚠️ إشعار خصم</button>
                  </div>` : ''}
                <button onclick="DamanChat.runExtra('openDispute','${a.id}')" class="w-full py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-[10px]">⚖️ فتح نزاع رسمي للتحكيم</button>`}
            </div>` : ''}

          ${a.status === 'completed' ? `
            <div class="flex gap-1.5">
              <button onclick="DamanChat.openContractHistoryModal('${a.id}')" class="px-3 py-1.5 rounded-xl bg-slate-800 text-sky-300 font-bold text-[10.5px]">📜 السجل (${logsCount + addons.length})</button>
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
                ? `<div class="glass-card rounded-2xl p-7 text-center text-xs text-slate-400">لا توجد عقود رسمية بعد — افتح أي محادثة واضغط زر «عقد».</div>`
                : this.agreements.map((a) => this.renderContractCard(a, app)).join('')}
            </div>` : ''}

          ${this.subTab === 'tickets' ? `
            <div class="space-y-3 text-xs">
              <form onsubmit="DamanChat.submitSupportTicket(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
                <div class="font-black text-sky-400">فتح تذكرة دعم فني / شكوى</div>
                <div>
                  <label class="block text-[10px] text-slate-400 mb-1">عنوان التذكرة * ${this.hBtn('tk-s')}</label>
                  ${this.hBox('tk-s', 'اكتب عنواناً مختصراً لمشكلتك أو استفسارك (مثال: استفسار عن شحن المحفظة أو عقد رقم TKT-123456).')}
                  <input id="tk-subj" type="text" required placeholder="مثال: استفسار عن عقد أو شحن" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
                </div>
                <div>
                  <label class="block text-[10px] text-slate-400 mb-1">التفاصيل * ${this.hBtn('tk-m')}</label>
                  ${this.hBox('tk-m', 'اشرح التفاصيل كاملة واذكر رقم العقد أو رقم العملية المرجعي لكي ترد عليك الإدارة بأسرع وقت.')}
                  <textarea id="tk-msg" rows="3" required placeholder="اشرح المشكلة بالتفصيل..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
                </div>
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
  if (window.__damanChatExtrasPending) {
    ChatMod.registerExtras(window.__damanChatExtrasPending);
    window.__damanChatExtrasPending = null;
  }
  if (window.DamanApp) window.DamanApp.registerModule('chat', ChatMod);
})();
