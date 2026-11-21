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
    unsubChatDoc: null,
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

    // WebRTC Voice Call + 30-Day Auto-Recording State
    callState: null,
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
          ? 'أهلاً بك في الدعم الفني الذكي لـ «ضمان سايت» 🏗️\nاسألني عن الاستلام الهندسي بضمان 3 أضعاف (3x)، الاتفاقات بالمتر واليومية والدفعات، التأكيد اليومي للعمال، العقد المطبوع نسختين، أو المحفظة.'
          : 'Welcome to DamanSite AI Support 🏗️\nAsk about our 3x Engineering Guarantee, agreements, milestones, daily attendance, signed contracts, or wallet.'
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
        .limit(40)
        .onSnapshot(
          (snap) => {
            this.chats = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            if (app.activeTab === 'chat' && !this.activeChatId) this.rerender();
          },
          (err) => console.error('chats error:', err)
        );

      const ticketQuery = app.isAdmin()
        ? app.db.collection('supportTickets').limit(35)
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
      ['unsubChats', 'unsubChatDoc', 'unsubMsgs', 'unsubAgreements', 'unsubTickets', 'unsubCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
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
        app.toast(isAr ? 'سجّل الدخول أولاً لبدء المحادثة' : 'Sign in first', 'warning');
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
            frozen: false,
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
          projectTitle: projectTitle || (snap.exists ? snap.data().projectTitle : ''),
          frozen: snap.exists ? !!snap.data().frozen : false
        });
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    openChatRoom(chatId, meta) {
      const app = window.DamanApp;
      this.activeChatId = chatId;
      this.activeChatMeta = meta || { id: chatId };
      this.messages = [];
      this.agreements = [];

      ['unsubChatDoc', 'unsubMsgs', 'unsubAgreements', 'unsubCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });

      this.unsubChatDoc = app.db.collection('chats').doc(chatId).onSnapshot((snap) => {
        if (snap.exists) {
          const d = snap.data();
          this.activeChatMeta.frozen = !!d.frozen;
          if (!this.activeChatMeta.otherName && d.participantNames) {
            const other = (d.participants || []).find((x) => x !== app.user.uid) || 'admin';
            this.activeChatMeta.otherUid = other;
            this.activeChatMeta.otherName = d.participantNames[other] || other;
          }
          this.rerender();
        }
      }, () => {});

      this.unsubMsgs = app.db
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .limit(90)
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
            this.callState = { status: 'incoming', isCaller: false, otherName: data.callerName || this.activeChatMeta.otherName };
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
      ['unsubChatDoc', 'unsubMsgs', 'unsubAgreements', 'unsubCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
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

    // ==================== TEXT, IMAGE, LOCATION, VOICE NOTE ====================
    async sendChatMessage(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة مؤقتاً من قِبل الإدارة', 'error');
      const inp = document.getElementById('chat-msg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.activeChatId || !app.user) return;
      inp.value = '';
      try {
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid,
          senderName: app.isAdmin() ? 'إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || ''),
          isAdminIntervention: app.isAdmin() && !(this.activeChatMeta?.otherUid === 'admin'),
          text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await chatRef.update({ lastMessage: text.slice(0, 90), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await this.notifyChatPeer(app, text.slice(0, 80));
      } catch (err) { app.toast(err.message, 'error'); }
    },

    compressChatImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Read error'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Image error'));
          img.onload = () => {
            const maxW = 760;
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
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
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
      } catch (err) { app.toast('تعذر إرسال الصورة', 'error'); }
      input.value = '';
    },

    sendLocation() {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
      if (!navigator.geolocation) return app.toast('جهازك لا يدعم تحديد الموقع', 'error');
      app.toast('جارٍ تحديد موقعك (GPS)...', 'info');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const chatRef = app.db.collection('chats').doc(this.activeChatId);
            await chatRef.collection('messages').add({
              senderId: app.user.uid,
              senderName: app.profile?.companyName || app.profile?.name || '',
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              text: '📍 اللوكيشن الحالي (GPS)',
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await chatRef.update({ lastMessage: '📍 موقع GPS', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            await this.notifyChatPeer(app, '📍 أرسل لك اللوكيشن (GPS)');
          } catch (e) { app.toast(e.message, 'error'); }
        },
        () => app.toast('يرجى السماح بصلاحية الموقع (GPS) من المتصفح', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },

    async toggleVoiceNote() {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
      if (this.isRecordingVoice) {
        if (this.voiceRecorder && this.voiceRecorder.state !== 'inactive') this.voiceRecorder.stop();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) return app.toast('المتصفح لا يدعم تسجيل الصوت', 'error');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.voiceChunks = [];
        this.voiceSeconds = 0;
        this.isRecordingVoice = true;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        this.voiceRecorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined);
        this.voiceRecorder.ondataavailable = (ev) => { if (ev.data?.size > 0) this.voiceChunks.push(ev.data); };
        this.voiceRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          clearInterval(this.voiceTimer);
          const dur = this.voiceSeconds;
          this.isRecordingVoice = false;
          this.rerender();
          if (!this.voiceChunks.length || dur < 1) return;
          const blob = new Blob(this.voiceChunks, { type: mime || 'audio/webm' });
          if (blob.size > 650000) return app.toast('الرسالة الصوتية طويلة (الحد الأقصى 60 ثانية)', 'warning');
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
          if (this.voiceSeconds >= 60 && this.voiceRecorder.state !== 'inactive') this.voiceRecorder.stop();
        }, 1000);
      } catch (err) { app.toast('يرجى السماح بصلاحية الميكروفون من المتصفح', 'error'); }
    },

    // ==================== WEBRTC VOICE CALLS + 30-DAY AUTO-RECORDING ====================
    async startVoiceCall() {
      const app = window.DamanApp;
      if (app.appConfig?.disableCalls && !app.isAdmin()) return app.toast('المكالمات الصوتية متوقفة مؤقتاً من الإدارة', 'warning');
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
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
          if (ev.candidate) callRef.collection('callerCandidates').add(ev.candidate.toJSON()).catch(() => {});
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
            if (ch.type === 'added' && this.pc) this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
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
            if (ch.type === 'added' && this.pc) this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
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
        if (this.remoteStream?.getAudioTracks().length) ctx.createMediaStreamSource(this.remoteStream).connect(dest);
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        this.callRecChunks = [];
        this.callRecorder = new MediaRecorder(dest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : undefined);
        this.callRecorder.ondataavailable = (ev) => { if (ev.data?.size > 0) this.callRecChunks.push(ev.data); };
        this.callRecorder.onstop = () => {
          const app = window.DamanApp;
          if (!this.callRecChunks.length || !this.activeChatId) return;
          const blob = new Blob(this.callRecChunks, { type: mime || 'audio/webm' });
          if (blob.size > 850000) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            app.db.collection('callRecordings').add({
              chatId: this.activeChatId,
              callerName: app.profile?.name || '',
              otherName: this.activeChatMeta?.otherName || '',
              durationSec: Math.max(1, Math.round((Date.now() - this.callStartTime) / 1000)),
              audioBase64: reader.result,
              expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
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
        try { await app.db.collection('chats').doc(this.activeChatId).collection('calls').doc('active').update({ status: 'ended' }); } catch (e) {}
      }
      this.cleanupCallLocal();
    },

    cleanupCallLocal() {
      if (this.callRecorder && this.callRecorder.state !== 'inactive') { try { this.callRecorder.stop(); } catch (e) {} }
      this.callRecorder = null;
      if (this.localStream) { this.localStream.getTracks().forEach((t) => t.stop()); this.localStream = null; }
      if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
      this.callState = null;
      this.rerender();
    },

    // ==================== COMPLETE 5-TYPE AGREEMENT & MILESTONES ENGINE ====================
    typeLabel(t) {
      const map = {
        meter: 'اتفاق بالمتر',
        lump: 'اتفاق بالمقطوعية',
        daily: 'اتفاق باليومية والعمال',
        weekly: 'اتفاق أسبوعي',
        permanent: 'اتفاق دائم'
      };
      return map[t] || t;
    },

    payModeLabel(m) {
      const map = {
        milestones: 'دفعات بنسب مئوية ومواعيد',
        daily_pay: 'صرف يومي',
        weekly_pay: 'صرف أسبوعي',
        on_completion: 'عند انتهاء واستلام الشغل'
      };
      return map[m] || m;
    },

    openAgreementModal() {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
      let modal = document.getElementById('daman-chat-agree-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-chat-agree-modal';
        modal.className = 'fixed inset-0 z-[65] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');

      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-2xl p-4 max-h-[92vh] overflow-y-auto space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-file-signature me-1"></i> إنشاء اتفاق وعقد رسمي</h3>
            <button onclick="document.getElementById('daman-chat-agree-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form onsubmit="DamanChat.submitAgreement(event)" oninput="DamanChat.updateAgreementPreview()" class="space-y-2.5 text-xs">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">1. نوع الاتفاق</label>
              <select id="ag-type" onchange="DamanChat.toggleAgreementFields()" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 font-bold text-white">
                <option value="meter">اتفاق بالمتر (سعر المتر × الكمية)</option>
                <option value="lump">اتفاق بالمقطوعية (مبلغ إجمالي للبند)</option>
                <option value="daily">اتفاق باليومية (عدد عمال × يومية × أيام)</option>
                <option value="weekly">اتفاق أسبوعي (قيمة الأسبوع × أسابيع)</option>
                <option value="permanent">اتفاق دائم (راتب / قيمة ثابتة)</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">2. وصف بند العمل</label>
              <input id="ag-title" type="text" required placeholder="مثال: محارة 1000 متر / توريد 10 نجارين شدة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <!-- METER FIELDS -->
            <div id="ag-box-meter" class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-amber-300 font-bold mb-1">سعر المتر الواحد (ج.م)</label>
                <input id="ag-meter-price" type="number" min="1" step="any" value="20" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
              </div>
              <div>
                <label class="block text-[10px] text-amber-300 font-bold mb-1">إجمالي الأمتار (م² / م.ط)</label>
                <input id="ag-meter-qty" type="number" min="1" step="any" value="1000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
              </div>
            </div>

            <!-- DAILY FIELDS -->
            <div id="ag-box-daily" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
              <div class="grid grid-cols-3 gap-1.5">
                <div>
                  <label class="block text-[10px] text-amber-300 font-bold mb-1">عدد العمال</label>
                  <input id="ag-workers" type="number" min="1" value="10" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
                </div>
                <div>
                  <label class="block text-[10px] text-amber-300 font-bold mb-1">يومية الفرد (ج.م)</label>
                  <input id="ag-daily-rate" type="number" min="10" value="350" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
                </div>
                <div>
                  <label class="block text-[10px] text-amber-300 font-bold mb-1">عدد الأيام</label>
                  <input id="ag-days" type="number" min="1" value="6" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
                </div>
              </div>
            </div>

            <!-- WEEKLY FIELDS -->
            <div id="ag-box-weekly" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-amber-300 font-bold mb-1">مبلغ الصرف الأسبوعي (ج.م)</label>
                <input id="ag-week-rate" type="number" min="100" value="5000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
              </div>
              <div>
                <label class="block text-[10px] text-amber-300 font-bold mb-1">عدد الأسابيع</label>
                <input id="ag-weeks" type="number" min="1" value="4" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
              </div>
            </div>

            <!-- LUMP / PERMANENT FIELDS -->
            <div id="ag-box-manual" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <label class="block text-[10px] text-amber-300 font-bold mb-1">المبلغ الإجمالي المتفق عليه (ج.م)</label>
              <input id="ag-manual-total" type="number" min="50" step="any" value="1000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/40 text-white font-bold" />
            </div>

            <!-- PAYOUT SCHEDULE & PERCENTAGES -->
            <div class="p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/30 space-y-2">
              <label class="block text-[11px] font-bold text-sky-300">3. نظام الصرف والدفعات</label>
              <select id="ag-pay-mode" onchange="DamanChat.toggleAgreementFields()" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold">
                <option value="milestones">دفعات بنسب مئوية ومواعيد (مثل 20% الآن + 20% بعد أسبوع/شهر)</option>
                <option value="daily_pay">صرف يومي (مصاريف أو يومية كل يوم)</option>
                <option value="weekly_pay">صرف أسبوعي (تصفية أسبوعية مثلاً يوم الخميس)</option>
                <option value="on_completion">صرف كامل المبلغ عند انتهاء واستلام الشغل</option>
              </select>

              <div id="ag-milestones-box" class="space-y-2 pt-1">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[10px] text-slate-300 mb-1">الدفعة الأولى الآن (%)</label>
                    <input id="ag-m1-pct" type="number" min="0" max="100" value="20" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
                  </div>
                  <div>
                    <label class="block text-[10px] text-slate-300 mb-1">الدفعة الثانية (%)</label>
                    <input id="ag-m2-pct" type="number" min="0" max="100" value="20" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" />
                  </div>
                </div>
                <div>
                  <label class="block text-[10px] text-slate-300 mb-1">موعد الدفعة الثانية (مثال: بعد أسبوع / بعد شهر / عند 50%)</label>
                  <input id="ag-m2-when" type="text" value="بعد أسبوع من بدء العمل" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                </div>
                <div id="ag-m3-info" class="text-[10px] text-emerald-300 font-bold">الباقي عند الاستلام النهائي: 60%</div>
              </div>

              <div class="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label class="block text-[10px] text-slate-400 mb-1">صرف/مصاريف يومية (اختياري - ج.م)</label>
                  <input id="ag-daily-exp" type="number" min="0" value="0" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                </div>
                <div>
                  <label class="block text-[10px] text-slate-400 mb-1">يوم التصفية (مثلاً الخميس)</label>
                  <input id="ag-settle-day" type="text" value="يوم الخميس" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                </div>
              </div>
            </div>

            <div id="ag-calc-preview" class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-[11px] text-emerald-200 space-y-0.5"></div>

            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> إرسال تذكرة الاتفاق والعقد في الشات
            </button>
          </form>
        </div>`;

      this.toggleAgreementFields();
      this.updateAgreementPreview();
    },

    toggleAgreementFields() {
      const t = document.getElementById('ag-type')?.value || 'meter';
      const pm = document.getElementById('ag-pay-mode')?.value || 'milestones';
      document.getElementById('ag-box-meter')?.classList.toggle('hidden', t !== 'meter');
      document.getElementById('ag-box-daily')?.classList.toggle('hidden', t !== 'daily');
      document.getElementById('ag-box-weekly')?.classList.toggle('hidden', t !== 'weekly');
      document.getElementById('ag-box-manual')?.classList.toggle('hidden', !(t === 'lump' || t === 'permanent'));
      document.getElementById('ag-milestones-box')?.classList.toggle('hidden', pm !== 'milestones');
      this.updateAgreementPreview();
    },

    computeModalTotals() {
      const t = document.getElementById('ag-type')?.value || 'meter';
      let total = 0, dailyCost = 0, unitPrice = 0, unitQty = 0, workers = 1, days = 1;
      if (t === 'meter') {
        unitPrice = parseFloat(document.getElementById('ag-meter-price')?.value) || 0;
        unitQty = parseFloat(document.getElementById('ag-meter-qty')?.value) || 0;
        total = unitPrice * unitQty;
      } else if (t === 'daily') {
        workers = parseInt(document.getElementById('ag-workers')?.value, 10) || 1;
        unitPrice = parseFloat(document.getElementById('ag-daily-rate')?.value) || 0;
        days = parseInt(document.getElementById('ag-days')?.value, 10) || 1;
        dailyCost = workers * unitPrice;
        total = dailyCost * days;
      } else if (t === 'weekly') {
        unitPrice = parseFloat(document.getElementById('ag-week-rate')?.value) || 0;
        unitQty = parseInt(document.getElementById('ag-weeks')?.value, 10) || 1;
        total = unitPrice * unitQty;
      } else {
        total = parseFloat(document.getElementById('ag-manual-total')?.value) || 0;
      }
      total = Math.round(total * 100) / 100;
      const rate = window.DamanApp.getCommissionRate();
      const fee = Math.round(total * rate * 100) / 100;
      const grand = Math.round((total + fee) * 100) / 100;
      return { t, total, fee, grand, dailyCost, unitPrice, unitQty, workers, days };
    },

    updateAgreementPreview() {
      const app = window.DamanApp;
      const calc = this.computeModalTotals();
      const m1 = Math.min(100, Math.max(0, parseFloat(document.getElementById('ag-m1-pct')?.value) || 0));
      const m2 = Math.min(100 - m1, Math.max(0, parseFloat(document.getElementById('ag-m2-pct')?.value) || 0));
      const m3 = Math.max(0, Math.round((100 - m1 - m2) * 10) / 10);
      const m3El = document.getElementById('ag-m3-info');
      if (m3El) m3El.textContent = `الباقي عند الاستلام النهائي: ${m3}% (${app.fmtMoney((calc.total * m3) / 100)} ج.م)`;

      const prev = document.getElementById('ag-calc-preview');
      if (prev) {
        prev.innerHTML = `
          <div>إجمالي قيمة الاتفاق: <b>${app.fmtMoney(calc.total)} ج.م</b></div>
          <div>عمولة ضمان سايت (${(app.getCommissionRate() * 100).toFixed(1)}%): <b>${app.fmtMoney(calc.fee)} ج.م</b></div>
          <div class="text-amber-300 font-black">الإجمالي شامل الضمان: ${app.fmtMoney(calc.grand)} ج.م</div>`;
      }
    },

    async submitAgreement(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const calc = this.computeModalTotals();
      if (calc.total <= 0) return app.toast('أدخل قيماً صحيحة للاتفاق', 'error');

      const title = document.getElementById('ag-title').value.trim();
      const payMode = document.getElementById('ag-pay-mode').value;
      const m1Pct = parseFloat(document.getElementById('ag-m1-pct')?.value) || 0;
      const m2Pct = parseFloat(document.getElementById('ag-m2-pct')?.value) || 0;
      const m2When = (document.getElementById('ag-m2-when')?.value || '').trim();
      const m3Pct = Math.max(0, 100 - m1Pct - m2Pct);
      const dailyExpense = parseFloat(document.getElementById('ag-daily-exp')?.value) || 0;
      const settlementDay = (document.getElementById('ag-settle-day')?.value || '').trim();
      const ticketNumber = 'TKT-' + Date.now().toString().slice(-6);

      const milestones = payMode === 'milestones' ? [
        { label: `الدفعة الأولى (الآن - ${m1Pct}%)`, pct: m1Pct, amount: Math.round((calc.total * m1Pct) / 100), when: 'فوراً عند الاعتماد', paid: false },
        ...(m2Pct > 0 ? [{ label: `الدفعة الثانية (${m2Pct}%)`, pct: m2Pct, amount: Math.round((calc.total * m2Pct) / 100), when: m2When || 'لاحقاً', paid: false }] : []),
        ...(m3Pct > 0 ? [{ label: `الباقي عند الاستلام (${m3Pct}%)`, pct: m3Pct, amount: Math.round((calc.total * m3Pct) / 100), when: 'عند انتهاء واستلام الشغل', paid: false }] : [])
      ] : [];

      try {
        await app.db.collection('chatAgreements').add({
          chatId: this.activeChatId,
          ticketNumber,
          type: calc.t,
          payMode,
          title,
          unitPrice: calc.unitPrice,
          unitQty: calc.unitQty,
          workers: calc.workers,
          totalDays: calc.days,
          dailyRate: calc.t === 'daily' ? calc.unitPrice : 0,
          dailyCost: calc.dailyCost,
          dailyExpense,
          settlementDay,
          milestones,
          totalAmount: calc.total,
          commissionFee: calc.fee,
          grandTotalWithFee: calc.grand,
          lockedAmount: 0,
          remainingEscrow: 0,
          coveragePercent: 0,
          createdBy: app.user.uid,
          createdByName: app.profile?.companyName || app.profile?.name || '',
          createdByNationalId: app.profile?.nationalId || '',
          otherUid: this.activeChatMeta?.otherUid || '',
          otherName: this.activeChatMeta?.otherName || '',
          status: 'proposed', // proposed | active | completed
          contractStatus: 'not_uploaded', // not_uploaded | pending_admin | approved | rejected
          signedContractBase64: '',
          confirmedDays: 0,
          pendingDayLog: null,
          timeline: [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('daman-chat-agree-modal').classList.add('hidden');
        await this.notifyChatPeer(app, `📄 تذكرة اتفاق جديدة (${ticketNumber}): ${title} — ${app.fmtMoney(calc.total)} ج.م`);
        app.toast('تم إرسال تذكرة الاتفاق في المحادثة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // Accept Agreement (Full 100% OR Partial Coverage % with Automatic Low-Balance Notice)
    async acceptAgreement(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;

      const needed = Number(ag.grandTotalWithFee || ag.totalAmount);
      const avail = Number(app.profile?.balanceAvailable || 0);

      if (avail <= 0) {
        if (window.confirm(`رصيدك المتاح حالياً 0 ج.م والمطلوب ${app.fmtMoney(needed)} ج.م.\nهل تريد الانتقال لشحن المحفظة الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(needed);
        }
        return;
      }

      let lockNow = needed;
      let isPartial = false;
      if (avail < needed) {
        const pct = Math.max(1, Math.floor((avail / needed) * 100));
        const okPartial = window.confirm(
          `⚠️ رصيدك المتاح (${app.fmtMoney(avail)} ج.م) يغطي ${pct}% فقط من إجمالي الاتفاق (${app.fmtMoney(needed)} ج.م).\n\nاضغط OK لبدء العمل بتغطية جزئية (${pct}%) وإرسال تنبيه للطرفين، أو Cancel لشحن الفرق الآن.`
        );
        if (!okPartial) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(Math.round((needed - avail) * 100) / 100);
          return;
        }
        lockNow = avail;
        isPartial = true;
      } else {
        if (!window.confirm(`تأكيد اعتماد الاتفاق وحجز ${app.fmtMoney(needed)} ج.م (شامل عمولة ضمان سايت 3.5%)؟\nملاحظة: يجب طباعة العقد نسختين وتوقيعه ورفع صورته هنا لتفعيل الضمان.`)) return;
      }

      const covPct = Math.min(100, Math.round((lockNow / needed) * 100));
      const escrowNet = Math.round((lockNow / (1 + app.getCommissionRate())) * 100) / 100;
      const userRef = app.db.collection('users').doc(app.user.uid);
      const agRef = app.db.collection('chatAgreements').doc(agId);

      try {
        await app.db.runTransaction(async (tx) => {
          const uDoc = await tx.get(userRef);
          const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
          const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
          if (curAvail < lockNow) throw new Error('الرصيد المتاح غير كافٍ');

          tx.update(userRef, {
            balanceAvailable: Math.round((curAvail - lockNow) * 100) / 100,
            balanceEscrow: Math.round((curEsc + lockNow) * 100) / 100
          });
          tx.update(agRef, {
            status: 'active',
            payerUid: app.user.uid,
            payerName: app.profile?.companyName || app.profile?.name || '',
            payerNationalId: app.profile?.nationalId || '',
            lockedAmount: lockNow,
            remainingEscrow: escrowNet,
            coveragePercent: covPct,
            acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
            timeline: firebase.firestore.FieldValue.arrayUnion({
              date: new Date().toISOString().slice(0, 10),
              kind: 'lock',
              label: isPartial ? `تغطية جزئية مبدئية (${covPct}%)` : 'حجز كامل الضمان (100%)',
              amount: lockNow,
              by: app.profile?.name || ''
            })
          });
        });

        const msg = isPartial
          ? `⚠️ تم تفعيل الاتفاق ${ag.ticketNumber} بتغطية جزئية (${covPct}% فقط — رصيد غير كافٍ لكامل البند). يُرجى طباعة العقد نسختين ورفع الصورة الموقّعة هنا.`
          : `✅ تم حجز كامل الضمان للاتفاق ${ag.ticketNumber} (100%). يُرجى طباعة العقد نسختين وتوقيعه ورفع صورته هنا لتفعيل الضمان.`;
        await app.sendNotification(ag.createdBy, `اعتماد الاتفاق ${ag.ticketNumber}`, msg);
        await app.sendNotification(app.user.uid, `اعتماد الاتفاق ${ag.ticketNumber}`, msg);
        app.toast(isPartial ? `تم الحجز بنسبة تغطية ${covPct}% وإرسال إشعار للطرفين` : 'تم حجز الضمان 100% بنجاح!', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async topUpAgreementCoverage(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const missing = Math.max(0, Math.round((Number(ag.grandTotalWithFee || 0) - Number(ag.lockedAmount || 0)) * 100) / 100);
      const amt = parseFloat(window.prompt(`المبلغ المراد إضافته لرفع التغطية (المتبقي لاكتمال 100%: ${app.fmtMoney(missing)} ج.م):`, missing));
      if (!amt || amt <= 0) return;
      if (Number(app.profile?.balanceAvailable || 0) < amt) {
        if (window.confirm('رصيدك المتاح غير كافٍ، هل تريد شحن المحفظة الآن؟')) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(amt);
        }
        return;
      }

      const userRef = app.db.collection('users').doc(app.user.uid);
      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        await app.db.runTransaction(async (tx) => {
          const [uDoc, aDoc] = await Promise.all([tx.get(userRef), tx.get(agRef)]);
          const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
          const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
          if (curAvail < amt) throw new Error('الرصيد غير كافٍ');
          const a = aDoc.data();
          const newLocked = Math.round((Number(a.lockedAmount || 0) + amt) * 100) / 100;
          const addNet = Math.round((amt / (1 + app.getCommissionRate())) * 100) / 100;
          const newRem = Math.round((Number(a.remainingEscrow || 0) + addNet) * 100) / 100;
          const newCov = Math.min(100, Math.round((newLocked / Number(a.grandTotalWithFee || 1)) * 100));

          tx.update(userRef, {
            balanceAvailable: Math.round((curAvail - amt) * 100) / 100,
            balanceEscrow: Math.round((curEsc + amt) * 100) / 100
          });
          tx.update(agRef, {
            lockedAmount: newLocked,
            remainingEscrow: newRem,
            coveragePercent: newCov,
            timeline: firebase.firestore.FieldValue.arrayUnion({
              date: new Date().toISOString().slice(0, 10),
              kind: 'topup',
              label: `تعزيز رصيد التغطية (وصلت لـ ${newCov}%)`,
              amount: amt,
              by: app.profile?.name || ''
            })
          });
        });
        await app.sendNotification(ag.createdBy, `تم تعزيز رصيد الاتفاق ${ag.ticketNumber}`, `أضاف صاحب العمل ${app.fmtMoney(amt)} ج.م لضمان استمرار العمل.`);
        app.toast('تم رفع تغطية الرصيد بنجاح', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // Upload Signed 2-Copy Contract directly in Chat
    async uploadSignedContract(agId, input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const b64 = await this.compressChatImage(file);
        await app.db.collection('chatAgreements').doc(agId).update({
          signedContractBase64: b64,
          contractStatus: 'pending_admin',
          signedUploadedBy: app.profile?.name || '',
          signedUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.notifyChatPeer(app, '📄 تم رفع صورة العقد الموقّع من الطرفين — بانتظار اعتماد الإدارة');
        await app.sendNotification('ADMIN', 'عقد موقّع جديد بانتظار الاعتماد', `تم رفع صورة عقد موقّع (نسختين) للاتفاق ${agId}`);
        app.toast('تم رفع صورة العقد الموقّع بنجاح وأُرسلت للإدارة للاعتماد', 'success');
      } catch (e) { app.toast('تعذر رفع الصورة', 'error'); }
      input.value = '';
    },

    // ==================== DAILY VARIABLE HEADCOUNT CONFIRMATION (9 of 10, 8 of 10...) ====================
    async workerLogActualDay(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const actualWorkers = parseInt(window.prompt(`كم عدد العمال الذين حضروا اليوم فعلياً؟ (المتفق عليه: ${ag.workers || 1})`, ag.workers || 1), 10);
      if (!actualWorkers || actualWorkers <= 0) return;
      const note = window.prompt('ملاحظة عن شغل اليوم (اختياري):', '') || '';
      const today = new Date().toISOString().slice(0, 10);

      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingDayLog: {
            date: today,
            actualWorkers,
            note,
            byUid: app.user.uid,
            byName: app.profile?.name || ''
          }
        });
        await app.sendNotification(ag.payerUid || ag.otherUid, `تأكيد حضور عمال اليوم (${actualWorkers} فرد)`, `سجّل ${app.profile?.name} حضور ${actualWorkers} عامل اليوم — ادخل للاعتماد.`);
        app.toast(`تم إرسال تأكيد حضور (${actualWorkers} فرد) للمهندس/صاحب العمل`, 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async clientApproveActualDay(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingDayLog) return;

      const confirmedCount = parseInt(
        window.prompt(`اعتماد العدد الفعلي لحضور اليوم (المسجّل من المقاول: ${ag.pendingDayLog.actualWorkers} فرد — يمكنك تعديله قبل الاعتماد):`, ag.pendingDayLog.actualWorkers),
        10
      );
      if (!confirmedCount || confirmedCount <= 0) return;

      const ratePerWorker = Number(ag.dailyRate || 0);
      const dayCost = ag.type === 'daily' ? Math.round(confirmedCount * ratePerWorker * 100) / 100 : 0;
      const newRem = Math.max(0, Math.round((Number(ag.remainingEscrow || 0) - dayCost) * 100) / 100);
      const nextDays = Number(ag.confirmedDays || 0) + 1;

      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          confirmedDays: nextDays,
          remainingEscrow: newRem,
          pendingDayLog: null,
          timeline: firebase.firestore.FieldValue.arrayUnion({
            date: ag.pendingDayLog.date || new Date().toISOString().slice(0, 10),
            kind: 'day_confirmed',
            label: `اعتماد يوم عمل (${confirmedCount} فرد)${ag.pendingDayLog.note ? ' — ' + ag.pendingDayLog.note : ''}`,
            amount: dayCost,
            by: app.profile?.name || ''
          })
        });

        await app.sendNotification(ag.createdBy, `تم اعتماد يوم العمل (${confirmedCount} فرد)`, `اعتمد المهندس حضور ${confirmedCount} عامل اليوم${dayCost ? ' بقيمة ' + app.fmtMoney(dayCost) + ' ج.م' : ''}.`);

        // Auto Stop-Work Alert if remaining funds cannot cover tomorrow
        const tomorrowEstimate = Number(ag.dailyCost || dayCost || 0);
        if (tomorrowEstimate > 0 && newRem < tomorrowEstimate) {
          await app.sendNotification(ag.createdBy, '⚠️ أمر وقف عمل مؤقت من ضمان سايت', `الرصيد المتبقي (${app.fmtMoney(newRem)} ج.م) لا يكفي لتغطية يومية الغد — يرجى وقف العمل لحين شحن حساب العميل.`);
          await app.sendNotification(app.user.uid, '⚠️ تنبيه شحن رصيد عاجل', `رصيد الاتفاق ${ag.ticketNumber} لا يكفي ليومية الغد — يرجى تعزيز الرصيد الآن لاستمرار العمل.`);
          app.toast('⚠️ تنبيه: الرصيد لا يكفي ليومية الغد! تم إرسال إشعار وقف عمل مؤقت للطرفين', 'warning');
        } else {
          app.toast(`تم اعتماد اليوم (${confirmedCount} فرد) بنجاح`, 'success');
        }
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async clientRejectActualDay(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const reason = window.prompt('سبب طلب مراجعة عدد العمال اليوم:', 'العدد الفعلي مختلف في الموقع') || '';
      try {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingDayLog: null });
        await app.sendNotification(ag.createdBy, `طلب مراجعة حضور اليوم (${ag.ticketNumber})`, reason);
        app.toast('تم إعادة الطلب للمقاول للمراجعة', 'info');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== FINANCIAL MOVEMENTS (ADVANCE / MATERIALS / PAYOUT / DEDUCTION) ====================
    openMovementModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      let modal = document.getElementById('daman-chat-move-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-chat-move-modal';
        modal.className = 'fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      const isPayer = ag.payerUid === app.user.uid;

      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/50 rounded-2xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-sky-400"><i class="fa-solid fa-money-bill-transfer me-1"></i> تسجيل حركة مالية على الاتفاق</h3>
            <button onclick="document.getElementById('daman-chat-move-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanChat.submitMovement(event,'${agId}')" class="space-y-2.5">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">نوع الحركة المالية</label>
              <select id="mv-kind" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 font-bold text-white">
                <option value="advance">سلفة / دفعة نقدية (مثال: 1000 ج.م)</option>
                <option value="materials">مبلغ شراء خامات / بضاعة للموقع</option>
                ${isPayer ? `<option value="payout">تحرير وصرف دفعة من الضمان لمحفظة المقاول فوراً</option>` : ''}
                <option value="deduction">خصم / جزاء / تلفيات (مع ذكر السبب)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">المبلغ (ج.م)</label>
              <input id="mv-amt" type="number" min="1" step="any" required placeholder="أدخل المبلغ بالجنيه" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 font-bold text-white" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">التفاصيل / السبب (مثال: شراء أسمنت أو دفعة 20%)</label>
              <input id="mv-note" type="text" required placeholder="اكتب وصفاً واضحاً للحركة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ وتوثيق الحركة</button>
          </form>
        </div>`;
    },

    async submitMovement(e, agId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const kind = document.getElementById('mv-kind').value;
      const amount = parseFloat(document.getElementById('mv-amt').value) || 0;
      const note = document.getElementById('mv-note').value.trim();
      if (amount <= 0) return;

      const labels = {
        advance: 'سلفة / دفعة نقدية',
        materials: 'مبلغ شراء خامات / بضاعة',
        payout: 'صرف دفعة من الضمان للمحفظة',
        deduction: 'خصم / جزاء / تلفيات'
      };

      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        if (kind === 'payout' && ag.payerUid === app.user.uid) {
          if (Number(ag.remainingEscrow || 0) < amount) {
            return app.toast('المبلغ أكبر من الرصيد المحجوز المتبقي في الضمان', 'error');
          }
          const payerRef = app.db.collection('users').doc(ag.payerUid);
          const workerRef = app.db.collection('users').doc(ag.createdBy);
          await app.db.runTransaction(async (tx) => {
            const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef), tx.get(agRef)]);
            const pEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);
            const curRem = Number((aDoc.data() || {}).remainingEscrow || 0);
            if (curRem < amount) throw new Error('الرصيد المتبقي في الضمان غير كافٍ');

            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - amount) * 100) / 100) });
            tx.update(workerRef, { balanceAvailable: Math.round((wAvail + amount) * 100) / 100 });
            tx.update(agRef, {
              remainingEscrow: Math.round((curRem - amount) * 100) / 100,
              timeline: firebase.firestore.FieldValue.arrayUnion({
                date: new Date().toISOString().slice(0, 10),
                kind,
                label: `${labels[kind]} — ${note}`,
                amount,
                by: app.profile?.name || ''
              })
            });
          });
          await app.sendNotification(ag.createdBy, `تم صرف دفعة في محفظتك ✅`, `تم تحويل ${app.fmtMoney(amount)} ج.م من الاتفاق ${ag.ticketNumber} (${note})`);
        } else {
          await agRef.update({
            timeline: firebase.firestore.FieldValue.arrayUnion({
              date: new Date().toISOString().slice(0, 10),
              kind,
              label: `${labels[kind]} — ${note}`,
              amount,
              by: app.profile?.name || ''
            })
          });
          await this.notifyChatPeer(app, `💰 ${labels[kind]}: ${app.fmtMoney(amount)} ج.م — ${note}`);
        }
        document.getElementById('daman-chat-move-modal').classList.add('hidden');
        app.toast('تم توثيق الحركة المالية بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async confirmFinalHandover(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.payerUid !== app.user.uid) return;
      const rem = Number(ag.remainingEscrow || 0);
      if (!window.confirm(`تأكيد الاستلام النهائي للشغل وتحرير باقي المستحق (${app.fmtMoney(rem)} ج.م) لمحفظة المنفّذ وإغلاق الاتفاق؟`)) return;

      const payerRef = app.db.collection('users').doc(ag.payerUid);
      const workerRef = app.db.collection('users').doc(ag.createdBy);
      const agRef = app.db.collection('chatAgreements').doc(agId);

      try {
        await app.db.runTransaction(async (tx) => {
          const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef), tx.get(agRef)]);
          const a = aDoc.data();
          const curRem = Number(a.remainingEscrow || 0);
          const feeToDeduct = Math.round((Number(a.lockedAmount || 0) - Number(a.totalAmount || 0)) * 100) / 100;
          const totalEscrowOut = Math.max(curRem, curRem + Math.max(0, feeToDeduct));
          const pEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
          const wAvail = Number((wDoc.data() || {}).balanceAvailable || 0);

          tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((pEsc - totalEscrowOut) * 100) / 100) });
          tx.update(workerRef, { balanceAvailable: Math.round((wAvail + curRem) * 100) / 100 });
          tx.update(agRef, {
            status: 'completed',
            remainingEscrow: 0,
            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
            timeline: firebase.firestore.FieldValue.arrayUnion({
              date: new Date().toISOString().slice(0, 10),
              kind: 'completed',
              label: 'تأكيد الاستلام النهائي وتصفية باقي الحساب',
              amount: curRem,
              by: app.profile?.name || ''
            })
          });
          if (Number(a.commissionFee || 0) > 0) {
            tx.set(app.db.collection('platformFees').doc(), {
              agreementId: agId,
              ticketNumber: a.ticketNumber,
              amount: Number(a.commissionFee || 0),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        });
        await app.sendNotification(ag.createdBy, `تم الاستلام النهائي وتصفية الاتفاق ${ag.ticketNumber} ✅`, `تم تحويل باقي المستحق (${app.fmtMoney(rem)} ج.م) إلى محفظتك.`);
        app.toast('تم الاستلام النهائي وتحرير المستحقات بنجاح ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    openTimelineModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      let modal = document.getElementById('daman-chat-tl-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-chat-tl-modal';
        modal.className = 'fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      const tl = ag.timeline || [];
      const ms = ag.milestones || [];

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">سجل الاتفاق والدفعات (${app.esc(ag.ticketNumber)})</h3>
            <button onclick="document.getElementById('daman-chat-tl-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${ms.length ? `
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div class="font-extrabold text-sky-300 mb-1">جدول الدفعات والنسب المتفق عليها:</div>
              ${ms.map((m) => `<div class="flex justify-between text-[11px]"><span>• ${app.esc(m.label)} (${app.esc(m.when)})</span><b class="text-emerald-400">${app.fmtMoney(m.amount)} ج.م</b></div>`).join('')}
            </div>` : ''}

          ${ag.signedContractBase64 ? `
            <div class="p-2 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-1">
              <div class="text-[11px] font-bold text-emerald-300">صورة العقد الموقّع المرفوعة:</div>
              <img src="${ag.signedContractBase64}" onclick="window.open('${ag.signedContractBase64}','_blank')" class="w-full max-h-40 object-contain rounded cursor-pointer" />
            </div>` : ''}

          <div class="space-y-1.5">
            <div class="font-extrabold text-white">سجل الحركات والأيام المعتمدة (${tl.length}):</div>
            ${!tl.length ? '<div class="text-center text-slate-400 py-4">لا توجد حركات مسجلة بعد</div>' : tl.slice().reverse().map((it) => `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex justify-between gap-2">
                <div>
                  <div class="font-bold text-white">${app.esc(it.label)}</div>
                  <div class="text-[10px] text-slate-400">${app.esc(it.date)} — بواسطة ${app.esc(it.by || '')}</div>
                </div>
                <span class="font-black ${it.kind === 'deduction' ? 'text-rose-400' : 'text-emerald-400'} shrink-0">${it.amount ? app.fmtMoney(it.amount) + ' ج.م' : ''}</span>
              </div>`).join('')}
          </div>
        </div>`;
    },

    // Auto-Generated A4 Legal Contract from Agreement Terms
    printAgreementA4(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      const d = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      const specDetail = ag.type === 'meter'
        ? `بالمتر: ${ag.unitQty} متر × ${app.fmtMoney(ag.unitPrice)} ج.م للمتر`
        : ag.type === 'daily'
        ? `باليومية: ${ag.workers} عمال × ${app.fmtMoney(ag.dailyRate)} ج.م × ${ag.totalDays} أيام (مع التأكيد اليومي للعدد الفعلي)`
        : ag.type === 'weekly'
        ? `أسبوعي: ${ag.unitQty} أسابيع × ${app.fmtMoney(ag.unitPrice)} ج.م للأسبوع`
        : this.typeLabel(ag.type);

      const msHtml = (ag.milestones && ag.milestones.length)
        ? `<tr><th>جدول الدفعات والنسب</th><td colspan="3">${ag.milestones.map((m) => `• ${app.esc(m.label)} (${app.fmtMoney(m.amount)} ج.م) — ${app.esc(m.when)}`).join('<br/>')}</td></tr>`
        : '';

      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>عقد ضمان سايت ${ag.ticketNumber}</title><style>@page{size:A4 portrait;margin:13mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11.5px;line-height:1.6;}.box{border:2px solid #000;padding:16px 18px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}table{width:100%;border-collapse:collapse;margin-bottom:10px;}th,td{border:1px solid #000;padding:5px 7px;text-align:right;}th{background:#f2f2f2;width:22%;}.clauses{border:1px solid #000;padding:8px 10px;margin:10px 0;font-size:11px;}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;text-align:center;}.sig{border:1px solid #000;padding:8px 8px 44px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة العقد نسختين (A4 PDF)</button><div class="box"><div class="hdr"><div><h2 style="margin:0">عقد اتفاق وتعاقد رسمي — ضمان سايت</h2><div>DamanSite Official Escrow & Engineering Contract</div></div><div><div><b>رقم التذكرة:</b> ${ag.ticketNumber}</div><div><b>التاريخ:</b> ${d}</div></div></div><table><tr><th>الطرف الأول (صاحب العمل)</th><td>${app.esc(ag.payerName || ag.otherName)}</td><th>الرقم القومي</th><td>${app.esc(ag.payerNationalId || 'مسجّل بالتوثيق')}</td></tr><tr><th>الطرف الثاني (المنفّذ / المقاول)</th><td>${app.esc(ag.createdByName)}</td><th>الرقم القومي</th><td>${app.esc(ag.createdByNationalId || 'مسجّل بالتوثيق')}</td></tr></table><table><tr><th>بند العمل</th><td colspan="3"><b>${app.esc(ag.title)}</b></td></tr><tr><th>تفاصيل المحاسبة</th><td colspan="3">${specDetail}</td></tr><tr><th>نظام الصرف</th><td>${this.payModeLabel(ag.payMode)}</td><th>يوم التصفية / المصاريف</th><td>${app.esc(ag.settlementDay || '-')} ${ag.dailyExpense ? '| مصاريف يومية: ' + app.fmtMoney(ag.dailyExpense) + ' ج.م' : ''}</td></tr>${msHtml}<tr><th>إجمالي الاتفاق</th><td><b>${app.fmtMoney(ag.totalAmount)} ج.م</b></td><th>عمولة الضمان (3.5%)</th><td>${app.fmtMoney(ag.commissionFee)} ج.م</td></tr></table><div class="clauses"><b>بنود وشروط ضمان سايت الملزمة للطرفين:</b><br/>1. يُطبع هذا العقد <b>نسختين أصليتين</b>، ويوقّع الطرفان ويتبادلا النسخ، وتُرفع صورة واضحة من العقد الموقّع داخل المحادثة في تطبيق ضمان سايت لاعتماد وتفعيل الضمان.<br/>2. تخضع الحضور اليومية للعمالة للتأكيد المزدوج الفعلي داخل التطبيق، وفي حال عدم كفاية الرصيد المحجوز لتغطية العمل يلتزم الطرفان بإشعار وقف العمل المؤقت لحين الشحن.<br/>3. أي سُلف أو مبالغ شراء خامات أو خصومات تُوثّق داخل سجل الاتفاق في المحادثة وتُخصم أو تُضاف عند التصفية.<br/>4. المحادثات والمكالمات خاضعة لمراجعة إدارة ضمان سايت عند النزاع للفصل العادل وحفظ حقوق الطرفين.</div><div class="sigs"><div class="sig">توقيع الطرف الأول (صاحب العمل)<br/><small>الاسم / الرقم القومي / التوقيع</small></div><div class="sig">توقيع الطرف الثاني (المقاول / المنفّذ)<br/><small>الاسم / الرقم القومي / التوقيع</small></div></div></div></body></html>`);
      win.document.close();
    },

    // ==================== AI SUPPORT & TICKETS ====================
    getAiReply(rawText, isAr) {
      const q = (rawText || '').toLowerCase();
      if (/3x|ثلاث|أضعاف|اضعاف|استلام|شدة|شدات|سقف|محارة/.test(q)) {
        return {
          text: isAr
            ? '🛡️ **الاستلام الهندسي بضمان مادي 3 أضعاف (3x):**\n• نستلم الشدات والأسقف والمحارة والتشطيبات كمهندس استشاري، ونمنحك ضماناً مادياً يصل لـ **3 أضعاف قيمة الخدمة المدفوعة**.'
            : '🛡️ 3x Financial Warranty on Consultant Engineering Handovers.',
          action: { label: isAr ? 'اطلب استلام هندسي الآن' : 'Request Inspection', fn: "if(window.DamanProjects) DamanProjects.setSubTab('inspection'); DamanApp.switchTab('projects')" }
        };
      }
      if (/عقد|نسختين|دفعات|متر|يوميات|وقف عمل/.test(q)) {
        return {
          text: isAr
            ? '📄 **الاتفاقات والعقد المطبوع نسختين:**\n• جوه أي محادثة اضغط **«اتفاق»** واختر (بالمتر، مقطوعية، يومية، أسبوعي، أو دائم) وحدد نسب الدفعات (مثلاً 20% الآن و20% بعد أسبوع).\n• يُطبع العقد نسختين وتُرفع صورة العقد الموقّع في نفس الشات لتفعيل الضمان.'
            : '📄 Tap Agreement inside any chat to configure meter/lump/daily/weekly rates and milestone percentages.',
          action: null
        };
      }
      return {
        text: isAr
          ? 'تقدر تسألني عن الضمان 3 أضعاف، الاتفاقات والدفعات، المحفظة، أو تضغط بالأسفل للتواصل مع **إدارة ضمان سايت**.'
          : 'Ask about 3x Guarantee, contracts, wallet, or chat with Admin.',
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
      const subj = document.getElementById('tk-subject').value.trim();
      try {
        await app.db.collection('supportTickets').add({
          userId: app.user.uid,
          userName: app.profile.companyName || app.profile.name || '',
          userEmail: app.profile.email || app.user.email || '',
          subject: subj,
          message: document.getElementById('tk-message').value.trim(),
          status: 'open',
          adminReply: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', 'تذكرة دعم جديدة', subj);
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
              ${st === 'incoming' ? 'مكالمة واردة من ' : st === 'calling' ? 'جارٍ الاتصال بـ ' : 'مكالمة متصلة — '}${app.esc(this.callState.otherName)}
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
      const ag = this.agreements[0];
      const myUid = app.user?.uid;
      const isCreator = ag.createdBy === myUid;
      const isPayer = ag.payerUid === myUid || (!ag.payerUid && !isCreator);
      const covPct = Number(ag.coveragePercent || 0);

      let covDetail = '';
      if (ag.status === 'active') {
        if (ag.type === 'meter' && ag.unitPrice > 0) {
          const coveredMeters = Math.min(ag.unitQty, Math.floor(Number(ag.remainingEscrow || 0) / ag.unitPrice));
          covDetail = `تغطية الرصيد: ${covPct}% (${coveredMeters} من ${ag.unitQty} متر)`;
        } else if (ag.type === 'daily' && ag.dailyCost > 0) {
          const coveredDays = Math.floor(Number(ag.remainingEscrow || 0) / ag.dailyCost);
          covDetail = coveredDays < 1 ? '⚠️ الرصيد لا يغطي الغد — وقف عمل لحين الشحن' : `تغطية الرصيد: ${covPct}% (يغطي ${coveredDays} يوم)`;
        } else {
          covDetail = `تغطية الرصيد: ${covPct}% (المتبقي بالضمان: ${app.fmtMoney(ag.remainingEscrow)} ج.م)`;
        }
      }

      const contractStatusHtml =
        ag.contractStatus === 'approved'
          ? `<span class="text-[10px] font-black text-emerald-300"><i class="fa-solid fa-shield-check me-1"></i>العقد الموقّع معتمد والضمان مفعّل ✅</span>`
          : ag.contractStatus === 'pending_admin'
          ? `<span class="text-[10px] font-bold text-amber-300"><i class="fa-solid fa-clock me-1"></i>تم رفع العقد الموقّع — بانتظار اعتماد الإدارة</span>`
          : ag.contractStatus === 'rejected'
          ? `<span class="text-[10px] font-bold text-rose-300"><i class="fa-solid fa-triangle-exclamation me-1"></i>تم رفض صورة العقد — يرجى إعادة رفع صورة واضحة</span>`
          : `<span class="text-[10px] font-bold text-amber-200"><i class="fa-solid fa-file-contract me-1"></i>شرط الضمان: اطبع العقد نسختين، وقّعهما، وارفع الصورة هنا</span>`;

      return `
        <div class="p-3 rounded-2xl bg-slate-900/95 border border-amber-500/50 space-y-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-black text-amber-400 truncate">${app.esc(ag.ticketNumber)} • ${this.typeLabel(ag.type)}</div>
              <div class="text-[11px] font-bold text-white truncate">${app.esc(ag.title)}</div>
            </div>
            <div class="text-end shrink-0">
              <div class="font-black text-emerald-400">${app.fmtMoney(ag.totalAmount)} ج.م</div>
              <div class="text-[9px] text-slate-400">${this.payModeLabel(ag.payMode)}</div>
            </div>
          </div>

          ${ag.status === 'active' ? `
            <div class="p-2 rounded-xl text-[10px] font-bold flex items-center justify-between gap-2 ${covPct < 100 || covDetail.includes('⚠️') ? 'bg-rose-500/15 border border-rose-500/40 text-rose-200' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'}">
              <span>${covDetail}</span>
              ${isPayer && covPct < 100 ? `<button onclick="DamanChat.topUpAgreementCoverage('${ag.id}')" class="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black shrink-0">+ تعزيز الرصيد</button>` : ''}
            </div>

            <!-- PROMINENT SIGNED CONTRACT UPLOAD BOX -->
            <div class="p-2 rounded-xl bg-slate-950/90 border border-slate-700 space-y-1.5">
              <div>${contractStatusHtml}</div>
              <div class="grid grid-cols-2 gap-1.5">
                <button onclick="DamanChat.printAgreementA4('${ag.id}')" class="py-1.5 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>طباعة العقد (نسختين)</button>
                <label class="py-1.5 rounded-lg ${ag.signedContractBase64 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500 text-slate-950'} font-black text-[10px] text-center cursor-pointer">
                  <i class="fa-solid fa-upload me-1"></i>${ag.signedContractBase64 ? 'تحديث صورة العقد' : 'رفع العقد الموقّع هنا'}
                  <input type="file" accept="image/*" class="hidden" onchange="DamanChat.uploadSignedContract('${ag.id}', this)" />
                </label>
              </div>
            </div>

            <!-- DAILY ACTUAL HEADCOUNT CONFIRMATION -->
            ${ag.pendingDayLog ? `
              <div class="p-2 rounded-xl bg-sky-500/15 border border-sky-500/40 space-y-1.5 text-[10px]">
                <div class="font-bold text-sky-200">طلب تأكيد حضور اليوم (${app.esc(ag.pendingDayLog.date)}): <b>${ag.pendingDayLog.actualWorkers} عامل</b> ${ag.pendingDayLog.note ? '— ' + app.esc(ag.pendingDayLog.note) : ''}</div>
                ${isPayer ? `
                  <div class="flex gap-1.5">
                    <button onclick="DamanChat.clientApproveActualDay('${ag.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">✓ اعتماد العدد واليوم</button>
                    <button onclick="DamanChat.clientRejectActualDay('${ag.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold">مراجعة</button>
                  </div>` : `<div class="text-slate-300">بانتظار اعتماد المهندس/صاحب العمل...</div>`}
              </div>` : ''}

            <!-- ACTION BUTTONS -->
            <div class="grid grid-cols-3 gap-1.5">
              ${isCreator && !ag.pendingDayLog ? `<button onclick="DamanChat.workerLogActualDay('${ag.id}')" class="py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">تأكيد عمال اليوم</button>` : ''}
              <button onclick="DamanChat.openMovementModal('${ag.id}')" class="py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-[10px]">سلفة / خامات / دفع</button>
              <button onclick="DamanChat.openTimelineModal('${ag.id}')" class="py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold text-[10px]">سجل الحركات (${(ag.timeline || []).length})</button>
              ${isPayer ? `<button onclick="DamanChat.confirmFinalHandover('${ag.id}')" class="col-span-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">✓ تأكيد الاستلام النهائي وتصفية باقي الحساب</button>` : ''}
            </div>
          ` : ag.status === 'proposed' ? `
            <div class="flex gap-1.5">
              ${!isCreator ? `<button onclick="DamanChat.acceptAgreement('${ag.id}')" class="flex-1 py-2 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة وحجز الضمان (${app.fmtMoney(ag.grandTotalWithFee)} ج.م)</button>` : `<div class="flex-1 text-[10px] text-amber-300 py-1">بانتظار موافقة الطرف الآخر وحجز الضمان...</div>`}
              <button onclick="DamanChat.printAgreementA4('${ag.id}')" class="px-3 py-2 rounded-lg bg-white text-slate-950 font-black text-[10px]">معاينة العقد</button>
            </div>
          ` : `
            <div class="flex items-center justify-between text-[10px] text-emerald-300 font-bold">
              <span>✅ تم تنفيذ وتصفية الاتفاق بالكامل</span>
              <button onclick="DamanChat.openTimelineModal('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white">عرض السجل</button>
            </div>
          `}
        </div>`;
    },

    renderChatRoom(app) {
      const isAr = app.lang === 'ar';
      const meta = this.activeChatMeta || {};
      const isFrozen = !!meta.frozen;
      return `
        <div class="space-y-2">
          <div class="glass-card rounded-2xl p-2.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <button onclick="DamanChat.closeActiveChat()" class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                <i class="fa-solid fa-arrow-${isAr ? 'right' : 'left'}"></i>
              </button>
              <div class="min-w-0">
                <div class="text-xs font-black text-white truncate">${app.esc(meta.otherName || 'Chat')}</div>
                <div class="text-[9px] text-slate-400 truncate">خاضعة لمراجعة الإدارة عند النزاع لحفظ الحقوق</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="DamanChat.openAgreementModal()" class="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black"><i class="fa-solid fa-file-signature me-1"></i>اتفاق</button>
              <button onclick="DamanChat.startVoiceCall()" class="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center"><i class="fa-solid fa-phone"></i></button>
            </div>
          </div>

          ${isFrozen ? `<div class="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-center text-[11px] font-bold text-rose-200"><i class="fa-solid fa-lock me-1"></i> تم تجميد هذه المحادثة من قِبل الإدارة</div>` : ''}
          ${this.renderCallBanner(app)}
          ${this.renderAgreementsBar(app)}

          <div id="chat-msgs-scroll" class="glass-card rounded-2xl p-3 space-y-2 h-[290px] overflow-y-auto">
            ${!this.messages.length
              ? `<div class="text-center text-xs text-slate-400 py-10">ابدأ المحادثة أو اضغط «اتفاق» لإرسال عرض رسمي...</div>`
              : this.messages.map((m) => {
                  const mine = app.user && m.senderId === app.user.uid;
                  const adminMsg = !!m.isAdminIntervention;
                  return `
                    <div class="flex ${adminMsg ? 'justify-center' : mine ? 'justify-end' : 'justify-start'}">
                      <div class="max-w-[85%] rounded-2xl px-3 py-2 text-xs space-y-1 ${adminMsg ? 'bg-purple-900/80 border border-amber-400 text-amber-100' : mine ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-white border border-slate-700'}">
                        ${adminMsg ? `<div class="text-[9px] text-amber-300 font-black"><i class="fa-solid fa-crown me-1"></i>تدخل إدارة ضمان سايت</div>` : (!mine ? `<div class="text-[9px] text-amber-300 font-extrabold">${app.esc(m.senderName || '')}</div>` : '')}
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
            <input id="chat-msg-input" type="text" placeholder="اكتب رسالتك..." class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
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
              <span><i class="fa-solid fa-crown me-1.5"></i> مراسلة إدارة ضمان سايت مباشرة</span>
              <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'}"></i>
            </button>` : ''}
          ${!this.chats.length
            ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد محادثات بعد.</div>`
            : `<div class="space-y-2">${this.chats.map((c) => {
                const otherUid = (c.participants || []).find((id) => id !== app.user.uid) || 'admin';
                const otherName = (c.participantNames && c.participantNames[otherUid]) || (otherUid === 'admin' ? 'إدارة ضمان سايت' : 'مستخدم');
                return `
                  <div onclick="DamanChat.openChatRoom('${c.id}',{id:'${c.id}',otherUid:'${otherUid}',otherName:'${app.esc(otherName).replace(/'/g, "\\'")}',projectTitle:'${app.esc(c.projectTitle || '').replace(/'/g, "\\'")}',frozen:${!!c.frozen}})"
                    class="glass-card rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:border-amber-500/40">
                    <div class="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center font-black text-sm shrink-0">${app.esc(otherName.charAt(0).toUpperCase())}</div>
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-extrabold text-white truncate">${app.esc(otherName)} ${c.frozen ? '🔒' : ''}</div>
                      <div class="text-[11px] text-slate-400 truncate mt-0.5">${app.esc(c.lastMessage || '')}</div>
                    </div>
                  </div>`;
              }).join('')}</div>`}
        </div>`;
    },

    renderAiTab(app) {
      const quickChips = ['الضمان المادي 3 أضعاف', 'الاتفاقات والدفعات', 'العقد المطبوع نسختين', 'كلّم الإدارة'];
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
            <input id="ai-chat-input" type="text" placeholder="اكتب سؤالك هنا..." class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-4 py-2.5 rounded-xl bg-purple-500 text-white font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    renderTicketsTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
      return `
        <div class="space-y-3">
          <form onsubmit="DamanChat.submitTicket(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-sky-400">فتح تذكرة دعم رسمية للإدارة</h4>
            <input id="tk-subject" type="text" required placeholder="عنوان المشكلة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="tk-message" rows="3" required placeholder="تفاصيل المشكلة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">إرسال التذكرة</button>
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
      const body = this.subTab === 'ai' ? this.renderAiTab(app) : this.subTab === 'tickets' ? this.renderTicketsTab(app) : this.renderChatsListTab(app);
      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanChat.setSubTab('chats')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'chats' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">المحادثات</button>
            <button onclick="DamanChat.setSubTab('ai')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'ai' ? 'bg-purple-500 text-white' : 'text-slate-400'}">الدعم الذكي AI</button>
            <button onclick="DamanChat.setSubTab('tickets')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'tickets' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">التذاكر</button>
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanChat = ChatMod;
  if (window.DamanApp) window.DamanApp.registerModule('chat', ChatMod);
})();
