(function () {
  const ChatMod = {
    subTab: 'chats', // 'chats' | 'ai' | 'tickets'
    chats: [],
    tickets: [],
    activeChatId: null,
    activeChatMeta: null,
    messages: [],
    agreements: [],
    aiHistory: [],
    attachedUid: null,
    unsubChats: null,
    unsubMsgs: null,
    unsubAgreements: null,
    unsubTickets: null,
    unsubCall: null,

    // Voice Note Recorder State
    isRecordingVoice: false,
    voiceRecorder: null,
    voiceChunks: [],
    voiceSeconds: 0,
    voiceTimer: null,

    // WebRTC Voice Call + Auto-Recording State
    callState: null, // { status: 'calling'|'incoming'|'connected', callId, isCaller, otherName }
    pc: null,
    localStream: null,
    remoteStream: null,
    callRecorder: null,
    callRecChunks: [],
    callStartTime: 0,

    initAiWelcome(isAr) {
      if (this.aiHistory.length) return;
      this.aiHistory.push({
        sender: 'ai',
        text: isAr
          ? 'أهلاً بك في الدعم الفني الذكي لـ «ضمان سايت» 🏗️\nاسألني عن الاستلام الهندسي بضمان 3 أضعاف (3x)، الضمان المالي 3.5%، العقد المطبوع نسختين، التأكيد اليومي، الإيداع والسحب، أو الـ HR والشركات.'
          : 'Welcome to DamanSite AI Support 🏗️\nAsk me about our 3x Engineering Guarantee, 3.5% Escrow, signed contracts, daily confirmations, wallet, or HR.'
      });
    },

    ensureListeners(app) {
      this.initAiWelcome(app.lang === 'ar');
      if (!app.user) {
        this.detachListeners();
        return;
      }
      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      const lookupIds = app.isAdmin() ? [app.user.uid, 'admin'] : [app.user.uid];

      this.unsubChats = app.db
        .collection('chats')
        .where('participants', 'array-contains-any', lookupIds)
        .limit(35)
        .onSnapshot(
          (snap) => {
            this.chats = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            if (app.activeTab === 'chat' && !this.activeChatId) this.rerender();
          },
          (err) => console.error('chats listener error:', err)
        );

      const ticketQuery = app.isAdmin()
        ? app.db.collection('supportTickets').limit(30)
        : app.db.collection('supportTickets').where('userId', '==', app.user.uid).limit(20);

      this.unsubTickets = ticketQuery.onSnapshot(
        (snap) => {
          this.tickets = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (app.activeTab === 'chat' && this.subTab === 'tickets') this.rerender();
        },
        () => {}
      );
    },

    detachListeners() {
      if (this.unsubChats) { this.unsubChats(); this.unsubChats = null; }
      if (this.unsubMsgs) { this.unsubMsgs(); this.unsubMsgs = null; }
      if (this.unsubAgreements) { this.unsubAgreements(); this.unsubAgreements = null; }
      if (this.unsubTickets) { this.unsubTickets(); this.unsubTickets = null; }
      if (this.unsubCall) { this.unsubCall(); this.unsubCall = null; }
      this.attachedUid = null;
      this.chats = [];
      this.tickets = [];
      this.messages = [];
      this.agreements = [];
      this.activeChatId = null;
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'chat') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) {
      this.subTab = tab;
      this.closeActiveChat(false);
      this.rerender();
    },

    async openDirectChat(targetUid, targetName, projectId = '', projectTitle = '') {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) {
        app.toast(isAr ? 'سجّل الدخول أولاً لبدء المحادثة' : 'Sign in first to start chatting', 'warning');
        return app.openAuthModal('login');
      }

      const myUid = app.user.uid;
      const cleanTarget = !targetUid || String(targetUid).startsWith('demo_') ? 'admin' : targetUid;
      if (cleanTarget === myUid) return app.toast(isAr ? 'لا يمكنك مراسلة نفسك' : 'Cannot chat with yourself', 'info');

      const pair = [myUid, cleanTarget].sort();
      const chatId = pair[0] + '_' + pair[1];
      const chatRef = app.db.collection('chats').doc(chatId);

      try {
        const snap = await chatRef.get();
        const myName = app.profile.companyName || app.profile.name || app.user.email;
        const otherLabel = cleanTarget === 'admin' ? (isAr ? 'إدارة ضمان سايت' : 'DamanSite Admin') : (targetName || 'User');

        if (!snap.exists) {
          const names = {};
          names[myUid] = myName;
          names[cleanTarget] = otherLabel;
          await chatRef.set({
            participants: pair,
            participantNames: names,
            projectId: projectId || '',
            projectTitle: projectTitle || '',
            lastMessage: projectTitle ? `${isAr ? 'استفسار بخصوص:' : 'Inquiry:'} ${projectTitle}` : '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else if (projectTitle) {
          await chatRef.update({
            projectId: projectId || snap.data().projectId || '',
            projectTitle,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        this.subTab = 'chats';
        app.switchTab('chat');
        this.openChatRoom(chatId, {
          id: chatId,
          otherUid: cleanTarget,
          otherName: otherLabel,
          projectTitle: projectTitle || (snap.exists ? snap.data().projectTitle : '')
        });
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    openChatRoom(chatId, meta) {
      const app = window.DamanApp;
      this.activeChatId = chatId;
      this.activeChatMeta = meta;
      this.messages = [];
      this.agreements = [];

      if (this.unsubMsgs) { this.unsubMsgs(); this.unsubMsgs = null; }
      if (this.unsubAgreements) { this.unsubAgreements(); this.unsubAgreements = null; }
      if (this.unsubCall) { this.unsubCall(); this.unsubCall = null; }

      this.unsubMsgs = app.db
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .limit(80)
        .onSnapshot(
          (snap) => {
            this.messages = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
            this.rerender();
            setTimeout(() => {
              const box = document.getElementById('chat-msgs-scroll');
              if (box) box.scrollTop = box.scrollHeight;
            }, 60);
          },
          (err) => console.error('messages error:', err)
        );

      this.unsubAgreements = app.db
        .collection('chatAgreements')
        .where('chatId', '==', chatId)
        .onSnapshot(
          (snap) => {
            this.agreements = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            this.rerender();
          },
          () => {}
        );

      // Listen for incoming WebRTC voice calls in this chat
      this.unsubCall = app.db
        .collection('chats')
        .doc(chatId)
        .collection('calls')
        .doc('active')
        .onSnapshot((snap) => {
          if (!snap.exists) {
            if (this.callState) this.cleanupCallLocal();
            return;
          }
          const data = snap.data();
          if (data.status === 'ringing' && data.callerId !== app.user.uid && !this.callState) {
            this.callState = { status: 'incoming', isCaller: false, otherName: data.callerName || meta.otherName };
            this.rerender();
          } else if (data.status === 'ended' && this.callState) {
            this.cleanupCallLocal();
          } else if (data.status === 'answered' && data.answer && this.pc && this.callState?.isCaller && !this.pc.currentRemoteDescription) {
            this.pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
            this.callState.status = 'connected';
            this.rerender();
          }
        });

      this.rerender();
    },

    closeActiveChat(shouldRender = true) {
      if (this.callState) this.endVoiceCall();
      this.activeChatId = null;
      this.activeChatMeta = null;
      this.messages = [];
      this.agreements = [];
      if (this.unsubMsgs) { this.unsubMsgs(); this.unsubMsgs = null; }
      if (this.unsubAgreements) { this.unsubAgreements(); this.unsubAgreements = null; }
      if (this.unsubCall) { this.unsubCall(); this.unsubCall = null; }
      if (shouldRender) this.rerender();
    },

    async notifyChatPeer(app, previewText) {
      const meta = this.activeChatMeta || {};
      const target = meta.otherUid === 'admin' ? 'ADMIN' : meta.otherUid;
      const myName = app.profile?.companyName || app.profile?.name || 'مستخدم ضمان سايت';
      if (target) {
        await app.sendNotification(target, `رسالة جديدة من ${myName}`, previewText);
      }
    },

    // ==================== TEXT, IMAGE, FILE, LOCATION ====================
    async sendChatMessage(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('chat-msg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.activeChatId || !app.user) return;
      inp.value = '';
      try {
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid,
          senderName: app.profile?.companyName || app.profile?.name || '',
          text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await chatRef.update({ lastMessage: text.slice(0, 90), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await this.notifyChatPeer(app, text.slice(0, 80));
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    compressChatImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Read error'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Image error'));
          img.onload = () => {
            const maxW = 720;
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', 0.56));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async sendChatImage(input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file || !this.activeChatId || !app.user) return;
      try {
        const b64 = await this.compressChatImage(file);
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid,
          senderName: app.profile?.companyName || app.profile?.name || '',
          imageBase64: b64,
          text: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await chatRef.update({ lastMessage: '📷 صورة مرفقة', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await this.notifyChatPeer(app, '📷 أرسل لك صورة جديدة');
      } catch (err) {
        app.toast('تعذر إرسال الصورة', 'error');
      }
      input.value = '';
    },

    sendLocation() {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!navigator.geolocation) return app.toast(isAr ? 'جهازك لا يدعم تحديد الموقع' : 'GPS not supported', 'error');
      app.toast(isAr ? 'جارٍ تحديد موقعك (GPS)...' : 'Getting location...', 'info');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          try {
            const chatRef = app.db.collection('chats').doc(this.activeChatId);
            await chatRef.collection('messages').add({
              senderId: app.user.uid,
              senderName: app.profile?.companyName || app.profile?.name || '',
              location: { lat, lng },
              text: isAr ? '📍 موقع الموقع / اللوكيشن الحالي' : '📍 Shared Location',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await chatRef.update({ lastMessage: '📍 موقع GPS', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            await this.notifyChatPeer(app, '📍 أرسل لك اللوكيشن (GPS)');
          } catch (e) { app.toast(e.message, 'error'); }
        },
        () => app.toast(isAr ? 'يرجى السماح بصلاحية الموقع (GPS) من المتصفح' : 'Allow GPS permission', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },

    // ==================== VOICE NOTES (MIC BUTTON) ====================
    async toggleVoiceNote() {
      const app = window.DamanApp;
      if (this.isRecordingVoice) {
        if (this.voiceRecorder && this.voiceRecorder.state !== 'inactive') {
          this.voiceRecorder.stop();
        }
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return app.toast('المتصفح لا يدعم تسجيل الصوت', 'error');
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.voiceChunks = [];
        this.voiceSeconds = 0;
        this.isRecordingVoice = true;

        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        this.voiceRecorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined);

        this.voiceRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) this.voiceChunks.push(ev.data);
        };

        this.voiceRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          clearInterval(this.voiceTimer);
          const dur = this.voiceSeconds;
          this.isRecordingVoice = false;
          this.rerender();

          if (!this.voiceChunks.length || dur < 1) return;
          const blob = new Blob(this.voiceChunks, { type: mime || 'audio/webm' });
          if (blob.size > 650000) return app.toast('الرسالة الصوتية طويلة جداً (الحد الأقصى 60 ثانية)', 'warning');

          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const chatRef = app.db.collection('chats').doc(this.activeChatId);
              await chatRef.collection('messages').add({
                senderId: app.user.uid,
                senderName: app.profile?.companyName || app.profile?.name || '',
                audioBase64: reader.result,
                audioDuration: dur,
                text: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              await chatRef.update({ lastMessage: `🎤 رسالة صوتية (${dur} ث)`, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
              await this.notifyChatPeer(app, `🎤 أرسل لك رسالة صوتية (${dur} ثانية)`);
            } catch (err) { app.toast(err.message, 'error'); }
          };
          reader.readAsDataURL(blob);
        };

        this.voiceRecorder.start();
        this.rerender();
        this.voiceTimer = setInterval(() => {
          this.voiceSeconds++;
          const lbl = document.getElementById('voice-rec-sec');
          if (lbl) lbl.textContent = this.voiceSeconds + 's';
          if (this.voiceSeconds >= 60 && this.voiceRecorder.state !== 'inactive') {
            this.voiceRecorder.stop();
          }
        }, 1000);
      } catch (err) {
        app.toast('يرجى السماح بصلاحية الميكروفون من المتصفح', 'error');
      }
    },

    // ==================== WEBRTC VOICE CALL + 30-DAY AUTO RECORDING ====================
    async startVoiceCall() {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        this.remoteStream = new MediaStream();
        this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));

        this.pc.ontrack = (e) => {
          e.streams[0].getTracks().forEach((t) => this.remoteStream.addTrack(t));
          const audioEl = document.getElementById('daman-remote-audio');
          if (audioEl) { audioEl.srcObject = this.remoteStream; audioEl.play().catch(() => {}); }
          this.startCallAutoRecording();
        };

        const callRef = app.db.collection('chats').doc(this.activeChatId).collection('calls').doc('active');
        this.pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            callRef.collection('callerCandidates').add(ev.candidate.toJSON()).catch(() => {});
          }
        };

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        await callRef.set({
          callerId: app.user.uid,
          callerName: app.profile?.companyName || app.profile?.name || '',
          offer: { type: offer.type, sdp: offer.sdp },
          status: 'ringing',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        callRef.collection('calleeCandidates').onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === 'added' && this.pc) {
              this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
            }
          });
        });

        this.callState = { status: 'calling', isCaller: true, otherName: this.activeChatMeta?.otherName || '' };
        this.callStartTime = Date.now();
        await this.notifyChatPeer(app, '📞 مكالمة صوتية واردة — افتح الدردشة للرد');
        this.rerender();
      } catch (err) {
        app.toast('تعذر بدء المكالمة — تأكد من سماح الميكروفون', 'error');
        this.cleanupCallLocal();
      }
    },

    async answerVoiceCall() {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      try {
        const callRef = app.db.collection('chats').doc(this.activeChatId).collection('calls').doc('active');
        const callSnap = await callRef.get();
        if (!callSnap.exists) return this.cleanupCallLocal();

        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        this.remoteStream = new MediaStream();
        this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));

        this.pc.ontrack = (e) => {
          e.streams[0].getTracks().forEach((t) => this.remoteStream.addTrack(t));
          const audioEl = document.getElementById('daman-remote-audio');
          if (audioEl) { audioEl.srcObject = this.remoteStream; audioEl.play().catch(() => {}); }
          this.startCallAutoRecording();
        };

        this.pc.onicecandidate = (ev) => {
          if (ev.candidate) callRef.collection('calleeCandidates').add(ev.candidate.toJSON()).catch(() => {});
        };

        await this.pc.setRemoteDescription(new RTCSessionDescription(callSnap.data().offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await callRef.update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'answered' });

        callRef.collection('callerCandidates').onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === 'added' && this.pc) {
              this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
            }
          });
        });

        this.callState = { status: 'connected', isCaller: false, otherName: this.activeChatMeta?.otherName || '' };
        this.callStartTime = Date.now();
        this.rerender();
      } catch (err) {
        app.toast('تعذر الرد على المكالمة', 'error');
        this.cleanupCallLocal();
      }
    },

    startCallAutoRecording() {
      if (this.callRecorder || !this.localStream) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(this.localStream).connect(dest);
        if (this.remoteStream && this.remoteStream.getAudioTracks().length) {
          ctx.createMediaStreamSource(this.remoteStream).connect(dest);
        }
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        this.callRecChunks = [];
        this.callRecorder = new MediaRecorder(dest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : undefined);
        this.callRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) this.callRecChunks.push(ev.data);
        };
        this.callRecorder.onstop = () => {
          const app = window.DamanApp;
          if (!this.callRecChunks.length || !this.activeChatId) return;
          const blob = new Blob(this.callRecChunks, { type: mime || 'audio/webm' });
          if (blob.size > 850000) return; // safety cap under 1MB
          const reader = new FileReader();
          reader.onloadend = () => {
            const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // Auto-delete after 30 days
            app.db.collection('callRecordings').add({
              chatId: this.activeChatId,
              callerName: app.profile?.name || '',
              otherName: this.activeChatMeta?.otherName || '',
              durationSec: Math.max(1, Math.round((Date.now() - this.callStartTime) / 1000)),
              audioBase64: reader.result,
              expiresAt,
              pinned: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
          };
          reader.readAsDataURL(blob);
        };
        this.callRecorder.start();
      } catch (e) {}
    },

    async endVoiceCall() {
      const app = window.DamanApp;
      if (this.activeChatId) {
        try {
          await app.db.collection('chats').doc(this.activeChatId).collection('calls').doc('active').update({ status: 'ended' });
        } catch (e) {}
      }
      this.cleanupCallLocal();
    },

    cleanupCallLocal() {
      if (this.callRecorder && this.callRecorder.state !== 'inactive') {
        try { this.callRecorder.stop(); } catch (e) {}
      }
      this.callRecorder = null;
      if (this.localStream) { this.localStream.getTracks().forEach((t) => t.stop()); this.localStream = null; }
      if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
      this.callState = null;
      this.rerender();
    },

    // ==================== IN-CHAT AGREEMENT, DAILY CONFIRMATION & SIGNED CONTRACT ====================
    openAgreementModal() {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      let modal = document.getElementById('daman-chat-agree-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-chat-agree-modal';
        modal.className = 'fixed inset-0 z-[65] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 max-h-[92vh] overflow-y-auto space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-extrabold text-amber-400"><i class="fa-solid fa-file-signature me-1"></i> ${isAr ? 'إرسال اتفاق / يوميات رسمي' : 'Send Formal Agreement'}</h3>
            <button onclick="document.getElementById('daman-chat-agree-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanChat.submitAgreement(event)" class="space-y-2.5">
            <select id="ag-type" onchange="document.getElementById('ag-daily-box').classList.toggle('hidden', this.value!=='daily')" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-xs font-bold text-white">
              <option value="daily">${isAr ? 'نظام يوميات وعمالة (بمصاريف يومية وتصفية أسبوعية)' : 'Daily Wages & Labor'}</option>
              <option value="lump">${isAr ? 'مقطوعية / عقد مقاولة كامل' : 'Lump-Sum Contract'}</option>
            </select>
            <input id="ag-title" type="text" required placeholder="${isAr ? 'بند العمل (مثال: توريد 5 نجارين لمدة 5 أيام)' : 'Work Scope Title'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <div id="ag-daily-box" class="space-y-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div class="grid grid-cols-2 gap-2">
                <input id="ag-workers" type="number" min="1" value="1" placeholder="${isAr ? 'عدد العمال' : 'Workers'}" class="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
                <input id="ag-days" type="number" min="1" value="5" placeholder="${isAr ? 'عدد الأيام' : 'Days'}" class="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input id="ag-rate" type="number" min="50" value="350" placeholder="${isAr ? 'يومية العامل (ج.م)' : 'Daily Rate'}" class="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
                <input id="ag-expense" type="number" min="0" value="100" placeholder="${isAr ? 'مصاريف يومية (ج.م)' : 'Daily Expense'}" class="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
              </div>
              <input id="ag-settle" type="text" value="${isAr ? 'يوم الخميس' : 'Thursday'}" placeholder="${isAr ? 'يوم التصفية (مثلاً الخميس)' : 'Settlement Day'}" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white" />
            </div>
            <input id="ag-total" type="number" min="100" step="any" placeholder="${isAr ? 'إجمالي الاتفاق (يُحسب تلقائياً لليوميات أو اكتبه للمقطوعية)' : 'Total Amount (EGP)'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs font-bold text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'إرسال تذكرة الاتفاق في الشات' : 'Send Agreement Ticket'}</button>
          </form>
        </div>`;
    },

    async submitAgreement(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const type = document.getElementById('ag-type').value;
      const title = document.getElementById('ag-title').value.trim();
      const workers = parseInt(document.getElementById('ag-workers').value, 10) || 1;
      const days = parseInt(document.getElementById('ag-days').value, 10) || 1;
      const dailyRate = parseFloat(document.getElementById('ag-rate').value) || 0;
      const dailyExpense = parseFloat(document.getElementById('ag-expense').value) || 0;
      const settlementDay = document.getElementById('ag-settle').value.trim();
      const manualTotal = parseFloat(document.getElementById('ag-total').value) || 0;

      const dailyCost = type === 'daily' ? workers * dailyRate : 0;
      const totalAmount = manualTotal > 0 ? manualTotal : (type === 'daily' ? dailyCost * days : 0);
      if (totalAmount <= 0) return app.toast('أدخل قيمة صحيحة للاتفاق', 'error');

      const rate = app.getCommissionRate();
      const fee = Math.round(totalAmount * rate * 100) / 100;
      const ticketNumber = 'TKT-' + Date.now().toString().slice(-6);

      try {
        await app.db.collection('chatAgreements').add({
          chatId: this.activeChatId,
          ticketNumber,
          type,
          title,
          workers,
          totalDays: days,
          dailyRate,
          dailyCost,
          dailyExpense,
          settlementDay,
          totalAmount,
          commissionFee: fee,
          grandTotalWithFee: Math.round((totalAmount + fee) * 100) / 100,
          createdBy: app.user.uid,
          createdByName: app.profile?.companyName || app.profile?.name || '',
          createdByNationalId: app.profile?.nationalId || '',
          otherUid: this.activeChatMeta?.otherUid || '',
          otherName: this.activeChatMeta?.otherName || '',
          status: 'proposed', // proposed | active | completed
          confirmedDays: 0,
          pendingDayConfirmBy: '',
          expensesPaid: 0,
          signedContractBase64: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('daman-chat-agree-modal').classList.add('hidden');
        await this.notifyChatPeer(app, `📄 تذكرة اتفاق جديدة (${ticketNumber}): ${title} — ${app.fmtMoney(totalAmount)} ج.م`);
        app.toast('تم إرسال تذكرة الاتفاق داخل المحادثة', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async acceptAgreement(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const needed = Number(ag.grandTotalWithFee || ag.totalAmount);
      const avail = Number(app.profile?.balanceAvailable || 0);

      if (avail < needed) {
        const diff = Math.round((needed - avail) * 100) / 100;
        if (window.confirm(`رصيدك المتاح (${app.fmtMoney(avail)} ج.م) أقل من إجمالي الاتفاق بالعمولة (${app.fmtMoney(needed)} ج.م).\nهل تريد الانتقال لشحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
        }
        return;
      }

      if (!window.confirm(`تأكيد الموافقة وحجز ${app.fmtMoney(needed)} ج.م (شامل عمولة ضمان سايت 3.5%)؟\nملاحظة: يجب طباعة العقد نسختين وتوقيعهما ورفع صورة العقد هنا لتفعيل الضمان.`)) return;

      const userRef = app.db.collection('users').doc(app.user.uid);
      const agRef = app.db.collection('chatAgreements').doc(agId);

      try {
        await app.db.runTransaction(async (tx) => {
          const uDoc = await tx.get(userRef);
          const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
          const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
          if (curAvail < needed) throw new Error('الرصيد المتاح غير كافٍ');

          tx.update(userRef, {
            balanceAvailable: Math.round((curAvail - needed) * 100) / 100,
            balanceEscrow: Math.round((curEsc + needed) * 100) / 100
          });
          tx.update(agRef, {
            status: 'active',
            payerUid: app.user.uid,
            payerName: app.profile?.companyName || app.profile?.name || '',
            payerNationalId: app.profile?.nationalId || '',
            lockedAmount: needed,
            remainingEscrow: ag.totalAmount,
            acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });

        const contractNotice = 'تم حجز الضمان بنجاح! يُرجى طباعة العقد نسختين، التوقيع وتبادل النسخ، ثم رفع صورة العقد الموقّع داخل الشات لتفعيل شرط الضمان.';
        await app.sendNotification(ag.createdBy, `تم اعتماد الاتفاق ${ag.ticketNumber}`, contractNotice);
        await app.sendNotification(app.user.uid, `تم اعتماد الاتفاق ${ag.ticketNumber}`, contractNotice);
        app.toast('تم حجز الضمان بنجاح! اطبع العقد نسختين وارفع النسخة الموقّعة', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async uploadSignedContract(agId, input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const b64 = await this.compressChatImage(file);
        await app.db.collection('chatAgreements').doc(agId).update({
          signedContractBase64: b64,
          signedUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.notifyChatPeer(app, '✅ تم رفع صورة العقد الموقّع من الطرفين داخل الشات');
        await app.sendNotification('ADMIN', 'عقد موقّع جديد تم رفعه', `تم رفع صورة عقد موقّع للاتفاق ${agId}`);
        app.toast('تم رفع صورة العقد الموقّع وتوثيق شرط الضمان بنجاح', 'success');
      } catch (e) { app.toast('تعذر رفع الصورة', 'error'); }
    },

    // Daily Dual Confirmation + Coverage Counter & Auto "Stop Work" Alert
    async workerConfirmDay(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingDayConfirmBy: app.user.uid
        });
        await app.sendNotification(ag.payerUid || ag.otherUid, `تأكيد حضور يوم عمل (${ag.confirmedDays + 1}/${ag.totalDays})`, `أكّد ${app.profile?.name} حضوره اليوم للعمل — يرجى الدخول للتأكيد.`);
        app.toast('تم إرسال تأكيد حضورك اليوم للمهندس/صاحب العمل', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async clientConfirmDay(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const nextDays = Number(ag.confirmedDays || 0) + 1;
      const dailyCost = Number(ag.dailyCost || 0);
      const newRem = Math.max(0, Math.round((Number(ag.remainingEscrow || 0) - dailyCost) * 100) / 100);

      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          confirmedDays: nextDays,
          remainingEscrow: newRem,
          pendingDayConfirmBy: ''
        });
        await app.sendNotification(ag.createdBy, `تم اعتماد يوم العمل (${nextDays}/${ag.totalDays})`, `اعتمد المهندس يوم العمل رسمياً في سجل ضمان سايت.`);

        // Auto "Stop Work" alert if remaining balance does not cover tomorrow
        if (dailyCost > 0 && newRem < dailyCost && nextDays < ag.totalDays) {
          await app.sendNotification(ag.createdBy, '⚠️ تنبيه وقف عمل من ضمان سايت', `الرصيد المتبقي لا يكفي لتغطية يومية الغد — يرجى وقف العمل مؤقتاً لحين إيداع مبلغ جديد في حساب العميل.`);
          await app.sendNotification(app.user.uid, '⚠️ تنبيه شحن رصيد عاجل', `رصيد الاتفاق (${ag.ticketNumber}) لا يكفي ليومية الغد — يرجى الشحن فوراً لاستمرار العمل.`);
          app.toast('تنبيه: الرصيد المتبقي لا يكفي ليومية الغد! تم إرسال إشعار وقف عمل مؤقت للمقاول', 'warning');
        } else {
          app.toast(`تم اعتماد يوم العمل (${nextDays}/${ag.totalDays}) بنجاح`, 'success');
        }
      } catch (e) { app.toast(e.message, 'error'); }
    },

    printAgreementA4(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      const d = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>عقد ضمان سايت ${ag.ticketNumber}</title><style>@page{size:A4 portrait;margin:14mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:12px;line-height:1.6;}.box{border:2px solid #000;padding:16px 20px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:12px;}table{width:100%;border-collapse:collapse;margin-bottom:10px;}th,td{border:1px solid #000;padding:6px 8px;text-align:right;}th{background:#f2f2f2;}.note{border:1px dashed #000;padding:8px;margin:10px 0;font-weight:700;}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;text-align:center;}.sig{border:1px solid #000;padding:10px 8px 46px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة نسختين (A4 PDF)</button><div class="box"><div class="hdr"><div><h2 style="margin:0">عقد اتفاق وتذكرة ضمان — ضمان سايت</h2><div>DamanSite Official Escrow Agreement</div></div><div><div><b>رقم التذكرة:</b> ${ag.ticketNumber}</div><div><b>التاريخ:</b> ${d}</div></div></div><table><tr><th>الطرف الأول (صاحب العمل)</th><td>${app.esc(ag.payerName || ag.otherName)}</td><th>الرقم القومي</th><td>${app.esc(ag.payerNationalId || 'مسجّل بالتوثيق')}</td></tr><tr><th>الطرف الثاني (المنفّذ / المقاول)</th><td>${app.esc(ag.createdByName)}</td><th>الرقم القومي</th><td>${app.esc(ag.createdByNationalId || 'مسجّل بالتوثيق')}</td></tr></table><table><tr><th>بند العمل</th><td colspan="3"><b>${app.esc(ag.title)}</b></td></tr><tr><th>النظام</th><td>${ag.type === 'daily' ? `يوميات (${ag.workers} عمال × ${ag.totalDays} أيام)` : 'مقطوعية'}</td><th>يوم التصفية</th><td>${app.esc(ag.settlementDay || '-')}</td></tr><tr><th>إجمالي الاتفاق</th><td><b>${app.fmtMoney(ag.totalAmount)} ج.م</b></td><th>عمولة الضمان (3.5%)</th><td>${app.fmtMoney(ag.commissionFee)} ج.م</td></tr></table><div class="note">شرط أساسي لتفعيل الضمان: يُطبع هذا العقد نسختين، ويوقّع الطرفان ويتبادلا النسخ، ثم تُرفع صورة واضحة من العقد الموقّع داخل المحادثة في تطبيق ضمان سايت.</div><div class="sigs"><div class="sig">توقيع الطرف الأول (صاحب العمل)</div><div class="sig">توقيع الطرف الثاني (المقاول / العامل)</div></div></div></body></html>`);
      win.document.close();
    },

    // ==================== FREE AI SUPPORT ====================
    getAiReply(rawText, isAr) {
      const q = (rawText || '').toLowerCase();
      if (/3x|ثلاث|أضعاف|اضعاف|استلام|شدة|شدات|سقف|محارة/.test(q)) {
        return {
          text: isAr
            ? '🛡️ **الاستلام الهندسي بضمان مادي 3 أضعاف (3x):**\n• نستلم كمهندس استشاري: الشدات، الأسقف، المحارة، التشطيبات، أو نمسك مشروعك كامل.\n• نمنحك ضماناً مادياً يصل لـ **3 أضعاف قيمة الخدمة المدفوعة** على البنود المستلمة والمعتمدة.'
            : '🛡️ **3x Engineering Guarantee:** We inspect shoring, slabs, plastering, or full projects with a 3x financial warranty.',
          action: { label: isAr ? 'اطلب استلام هندسي الآن' : 'Request Inspection', fn: "if(window.DamanProjects) DamanProjects.setSubTab('inspection'); DamanApp.switchTab('projects')" }
        };
      }
      if (/عقد|نسختين|توقيع|يوميات|وقف عمل/.test(q)) {
        return {
          text: isAr
            ? '📄 **العقد المطبوع والتأكيد اليومي:**\n• بعد الاتفاق في الشات، يُطبع العقد نسختين ويوقّع الطرفان وترفع صورة العقد الموقّع داخل الشات.\n• في اليوميات: العامل والمهندس يؤكدان يوم العمل يومياً، وعند نفاد التغطية يصدر إشعار **وقف عمل** تلقائياً.'
            : '📄 Print 2 contract copies, sign, and upload a photo in chat. Daily work uses dual confirmation & auto stop-work alerts.',
          action: null
        };
      }
      if (/سحب|إيداع|ايداع|انستا|محفظة/.test(q)) {
        return {
          text: isAr
            ? '💰 **المحفظة (يوم عمل واحد):**\n• الإيداع: محفظة إلكترونية، رابط إنستا باي المباشر، أو بنك.\n• السحب: محفظة إلكترونية أو حساب بنكي فقط بنفس اسم صاحب الحساب.'
            : '💰 Deposits via E-Wallet, InstaPay Link, or Bank. Withdrawals via E-Wallet or Bank only (same legal name, 1 business day).',
          action: { label: isAr ? 'افتح المحفظة' : 'Open Wallet', fn: "DamanApp.switchTab('wallet')" }
        };
      }
      return {
        text: isAr
          ? 'تقدر تسألني عن الضمان 3 أضعاف، العقد المطبوع نسختين، المحفظة، أو تضغط بالأسفل للتواصل المباشر مع **إدارة ضمان سايت**.'
          : 'Ask about 3x Guarantee, contracts, wallet, or tap below to chat with Admin.',
        action: { label: isAr ? 'كلّم الإدارة مباشرة' : 'Chat with Admin', fn: "DamanChat.openDirectChat('admin','إدارة ضمان سايت')" }
      };
    },

    askAi(presetText) {
      const app = window.DamanApp;
      const inp = document.getElementById('ai-chat-input');
      const text = presetText || (inp ? inp.value.trim() : '');
      if (!text) return;
      if (inp) inp.value = '';
      this.aiHistory.push({ sender: 'user', text });
      const reply = this.getAiReply(text, app.lang === 'ar');
      this.aiHistory.push({ sender: 'ai', text: reply.text, action: reply.action });
      this.rerender();
    },

    async submitTicket(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      try {
        await app.db.collection('supportTickets').add({
          userId: app.user.uid,
          userName: app.profile.companyName || app.profile.name || '',
          userEmail: app.profile.email || app.user.email || '',
          subject: document.getElementById('tk-subject').value.trim(),
          message: document.getElementById('tk-message').value.trim(),
          status: 'open',
          adminReply: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', 'تذكرة دعم جديدة', document.getElementById('tk-subject').value.trim());
        e.target.reset();
        app.toast('تم إرسال تذكرة الدعم للإدارة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== RENDER UI ====================
    renderCallBanner(app) {
      if (!this.callState) return '';
      const st = this.callState.status;
      return `
        <div class="p-3 rounded-2xl bg-gradient-to-r from-emerald-900/90 to-slate-900 border border-emerald-500/60 space-y-2 shadow-xl">
          <div class="text-[10px] text-amber-300 font-bold bg-black/40 px-2.5 py-1 rounded-lg">
            <i class="fa-solid fa-circle-dot text-rose-500 animate-pulse me-1"></i>
            هذه المكالمة مسجّلة لضمان الجودة وحفظ الحقوق، ويتم الاحتفاظ بالتسجيل لمدة 30 يوماً ثم يُحذف تلقائياً.
          </div>
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-black text-white">
              <i class="fa-solid fa-phone-volume text-emerald-400 me-1.5"></i>
              ${st === 'incoming' ? 'مكالمة صوتية واردة من ' : st === 'calling' ? 'جارٍ الاتصال بـ ' : 'مكالمة صوتية متصلة — '}${app.esc(this.callState.otherName)}
            </div>
            <div class="flex items-center gap-1.5">
              ${st === 'incoming' ? `<button onclick="DamanChat.answerVoiceCall()" class="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">رد</button>` : ''}
              <button onclick="DamanChat.endVoiceCall()" class="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-black text-xs">إنهاء</button>
            </div>
          </div>
          <audio id="daman-remote-audio" autoplay playsinline class="hidden"></audio>
        </div>`;
    },

    renderAgreementsBar(app) {
      if (!this.agreements.length) return '';
      const ag = this.agreements[0]; // Show latest active/proposed agreement pinned at top of chat
      const myUid = app.user?.uid;
      const isCreator = ag.createdBy === myUid;
      const isPayer = ag.payerUid === myUid || (!ag.payerUid && !isCreator);
      const daysCovered = ag.dailyCost > 0 ? Math.floor(Number(ag.remainingEscrow || 0) / ag.dailyCost) : 0;

      return `
        <div class="p-3 rounded-2xl bg-slate-900/95 border border-amber-500/50 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="font-black text-amber-400 truncate"><i class="fa-solid fa-ticket me-1"></i>${app.esc(ag.ticketNumber)} — ${app.esc(ag.title)}</span>
            <span class="text-[10px] font-black text-emerald-400 shrink-0">${app.fmtMoney(ag.totalAmount)} ج.م</span>
          </div>

          ${ag.status === 'active' && ag.type === 'daily' ? `
            <div class="flex items-center justify-between text-[10px] p-2 rounded-xl ${daysCovered < 1 ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40' : 'bg-emerald-500/10 text-emerald-300'}">
              <span>الأيام المعتمدة: <b>${ag.confirmedDays || 0} / ${ag.totalDays}</b></span>
              <span>${daysCovered < 1 ? '⚠️ الرصيد لا يغطي الغد (وقف عمل)' : `الرصيد يغطي: ${daysCovered} يوم`}</span>
            </div>` : ''}

          <div class="flex flex-wrap items-center gap-1.5">
            ${ag.status === 'proposed' && !isCreator ? `
              <button onclick="DamanChat.acceptAgreement('${ag.id}')" class="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة وحجز (${app.fmtMoney(ag.grandTotalWithFee)} ج.م)</button>` : ''}
            <button onclick="DamanChat.printAgreementA4('${ag.id}')" class="py-1.5 px-2.5 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>عقد A4 نسختين</button>
            ${ag.status === 'active' ? `
              <label class="py-1.5 px-2.5 rounded-lg ${ag.signedContractBase64 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'} font-black text-[10px] cursor-pointer">
                <i class="fa-solid fa-upload me-1"></i>${ag.signedContractBase64 ? 'تم رفع العقد الموقّع ✓' : 'رفع العقد الموقّع'}
                <input type="file" accept="image/*" class="hidden" onchange="DamanChat.uploadSignedContract('${ag.id}', this)" />
              </label>` : ''}
          </div>

          ${ag.status === 'active' && ag.type === 'daily' && (ag.confirmedDays || 0) < ag.totalDays ? `
            <div class="pt-1 border-t border-slate-800 flex gap-1.5">
              ${isCreator && !ag.pendingDayConfirmBy ? `<button onclick="DamanChat.workerConfirmDay('${ag.id}')" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">✓ تأكيد حضوري للعمل اليوم (${(ag.confirmedDays || 0) + 1}/${ag.totalDays})</button>` : ''}
              ${isPayer && ag.pendingDayConfirmBy ? `<button onclick="DamanChat.clientConfirmDay('${ag.id}')" class="w-full py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">✓ اعتماد المهندس ليوم العمل (${(ag.confirmedDays || 0) + 1}/${ag.totalDays})</button>` : ''}
            </div>` : ''}
        </div>`;
    },

    renderChatRoom(app) {
      const isAr = app.lang === 'ar';
      const meta = this.activeChatMeta || {};
      return `
        <div class="space-y-2.5">
          <div class="glass-card rounded-2xl p-2.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <button onclick="DamanChat.closeActiveChat()" class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                <i class="fa-solid fa-arrow-${isAr ? 'right' : 'left'}"></i>
              </button>
              <div class="min-w-0">
                <div class="text-xs font-black text-white truncate">${app.esc(meta.otherName || 'Chat')}</div>
                ${meta.projectTitle ? `<div class="text-[10px] text-amber-300 truncate">${app.esc(meta.projectTitle)}</div>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="DamanChat.openAgreementModal()" title="إرسال اتفاق / يوميات" class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black"><i class="fa-solid fa-file-signature me-1"></i>اتفاق</button>
              <button onclick="DamanChat.startVoiceCall()" title="مكالمة صوتية" class="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center"><i class="fa-solid fa-phone"></i></button>
            </div>
          </div>

          ${this.renderCallBanner(app)}
          ${this.renderAgreementsBar(app)}

          <div id="chat-msgs-scroll" class="glass-card rounded-2xl p-3 space-y-2 h-[300px] overflow-y-auto">
            ${!this.messages.length
              ? `<div class="text-center text-xs text-slate-400 py-10">${isAr ? 'ابدأ المحادثة الآن...' : 'Start chatting...'}</div>`
              : this.messages.map((m) => {
                  const mine = app.user && m.senderId === app.user.uid;
                  return `
                    <div class="flex ${mine ? 'justify-end' : 'justify-start'}">
                      <div class="max-w-[84%] rounded-2xl px-3 py-2 text-xs space-y-1 ${mine ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-white border border-slate-700'}">
                        ${!mine ? `<div class="text-[9px] text-amber-300 font-extrabold">${app.esc(m.senderName || '')}</div>` : ''}
                        ${m.imageBase64 ? `<img src="${m.imageBase64}" onclick="window.open('${m.imageBase64}','_blank')" class="max-h-44 rounded-xl border border-black/20 cursor-pointer" />` : ''}
                        ${m.audioBase64 ? `<audio controls src="${m.audioBase64}" class="w-48 h-8"></audio>` : ''}
                        ${m.location ? `<a href="https://maps.google.com/?q=${m.location.lat},${m.location.lng}" target="_blank" class="inline-flex items-center gap-1 underline font-black"><i class="fa-solid fa-location-dot"></i> فتح الموقع على خرائط جوجل</a>` : ''}
                        ${m.text ? `<div class="leading-relaxed whitespace-pre-line">${app.esc(m.text)}</div>` : ''}
                      </div>
                    </div>`;
                }).join('')}
          </div>

          <form onsubmit="DamanChat.sendChatMessage(event)" class="flex items-center gap-1.5">
            <label class="w-9 h-9 shrink-0 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center cursor-pointer" title="صورة">
              <i class="fa-solid fa-image"></i>
              <input type="file" accept="image/*" class="hidden" onchange="DamanChat.sendChatImage(this)" />
            </label>
            <button type="button" onclick="DamanChat.sendLocation()" class="w-9 h-9 shrink-0 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center" title="لوكيشن GPS">
              <i class="fa-solid fa-location-dot"></i>
            </button>
            <button type="button" onclick="DamanChat.toggleVoiceNote()" class="w-9 h-9 shrink-0 rounded-xl ${this.isRecordingVoice ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-emerald-400'} flex items-center justify-center" title="رسالة صوتية">
              <i class="fa-solid ${this.isRecordingVoice ? 'fa-stop' : 'fa-microphone'}"></i>
              ${this.isRecordingVoice ? `<span id="voice-rec-sec" class="text-[9px] ms-0.5">${this.voiceSeconds}s</span>` : ''}
            </button>
            <input id="chat-msg-input" type="text" placeholder="${isAr ? 'اكتب رسالتك...' : 'Message...'}" class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    renderChatsListTab(app) {
      const isAr = app.lang === 'ar';
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
      if (this.activeChatId) return this.renderChatRoom(app);

      return `
        <div class="space-y-3">
          ${!app.isAdmin() ? `
            <button onclick="DamanChat.openDirectChat('admin','إدارة ضمان سايت')" class="w-full p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs font-extrabold text-amber-300">
              <span><i class="fa-solid fa-crown me-1.5"></i> ${isAr ? 'مراسلة إدارة ضمان سايت مباشرة' : 'Message DamanSite Admin'}</span>
              <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'}"></i>
            </button>` : ''}
          ${!this.chats.length
            ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">${isAr ? 'لا توجد محادثات بعد.' : 'No chats yet.'}</div>`
            : `<div class="space-y-2">${this.chats.map((c) => {
                const otherUid = (c.participants || []).find((id) => id !== app.user.uid) || 'admin';
                const otherName = (c.participantNames && c.participantNames[otherUid]) || (otherUid === 'admin' ? 'إدارة ضمان سايت' : 'مستخدم');
                return `
                  <div onclick="DamanChat.openChatRoom('${c.id}',{id:'${c.id}',otherUid:'${otherUid}',otherName:'${app.esc(otherName).replace(/'/g, "\\'")}',projectTitle:'${app.esc(c.projectTitle || '').replace(/'/g, "\\'")}'})"
                    class="glass-card rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:border-amber-500/40">
                    <div class="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center font-black text-sm shrink-0">${app.esc(otherName.charAt(0).toUpperCase())}</div>
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-extrabold text-white truncate">${app.esc(otherName)}</div>
                      <div class="text-[11px] text-slate-400 truncate mt-0.5">${app.esc(c.lastMessage || '')}</div>
                    </div>
                  </div>`;
              }).join('')}</div>`}
        </div>`;
    },

    renderAiTab(app) {
      const isAr = app.lang === 'ar';
      const quickChips = isAr ? ['الضمان المادي 3 أضعاف', 'العقد المطبوع نسختين', 'الإيداع والسحب', 'كلّم الإدارة'] : ['3x Guarantee', 'Signed Contract', 'Wallet', 'Admin'];
      return `
        <div class="space-y-3">
          <div class="glass-card rounded-2xl p-3 space-y-2.5 h-[300px] overflow-y-auto">
            ${this.aiHistory.map((m) => `
              <div class="flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${m.sender === 'user' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-100 border border-slate-700'}">
                  ${app.esc(m.text).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
                  ${m.action ? `<div class="mt-2"><button onclick="${m.action.fn}" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">${app.esc(m.action.label)}</button></div>` : ''}
                </div>
              </div>`).join('')}
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
            ${quickChips.map((q) => `<button type="button" onclick="DamanChat.askAi('${q}')" class="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-200">${q}</button>`).join('')}
          </div>
          <form onsubmit="event.preventDefault(); DamanChat.askAi();" class="flex gap-2">
            <input id="ai-chat-input" type="text" placeholder="${isAr ? 'اكتب سؤالك هنا...' : 'Ask...'}" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-4 py-2.5 rounded-xl bg-purple-500 text-white font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    renderTicketsTab(app) {
      const isAr = app.lang === 'ar';
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
      return `
        <div class="space-y-3">
          <form onsubmit="DamanChat.submitTicket(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-sky-400">${isAr ? 'فتح تذكرة دعم رسمية للإدارة' : 'Open Support Ticket'}</h4>
            <input id="tk-subject" type="text" required placeholder="${isAr ? 'عنوان المشكلة' : 'Subject'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="tk-message" rows="3" required placeholder="${isAr ? 'تفاصيل المشكلة...' : 'Details...'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">${isAr ? 'إرسال التذكرة' : 'Submit'}</button>
          </form>
          ${this.tickets.map((t) => `
            <div class="glass-card rounded-2xl p-3 space-y-1">
              <div class="flex justify-between text-xs font-extrabold"><span class="text-white">${app.esc(t.subject)}</span><span class="text-[10px] text-amber-300">${app.esc(t.status)}</span></div>
              <p class="text-[11px] text-slate-300">${app.esc(t.message)}</p>
              ${t.adminReply ? `<div class="p-2 rounded-lg bg-emerald-500/10 text-[11px] text-emerald-200"><b>رد الإدارة:</b> ${app.esc(t.adminReply)}</div>` : ''}
            </div>`).join('')}
        </div>`;
    },

    render(container, app) {
      this.ensureListeners(app);
      const isAr = app.lang === 'ar';
      const body = this.subTab === 'ai' ? this.renderAiTab(app) : this.subTab === 'tickets' ? this.renderTicketsTab(app) : this.renderChatsListTab(app);
      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanChat.setSubTab('chats')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'chats' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'المحادثات' : 'Chats'}</button>
            <button onclick="DamanChat.setSubTab('ai')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'ai' ? 'bg-purple-500 text-white' : 'text-slate-400'}">${isAr ? 'الدعم الذكي AI' : 'AI Support'}</button>
            <button onclick="DamanChat.setSubTab('tickets')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'tickets' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'التذاكر' : 'Tickets'}</button>
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanChat = ChatMod;
  if (window.DamanApp) window.DamanApp.registerModule('chat', ChatMod);
})();
