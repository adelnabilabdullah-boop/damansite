(function () {
  const ChatMod = {
    subTab: 'chats', // 'chats' | 'ai' | 'tickets'
    chats: [],
    tickets: [],
    activeChatId: null,
    activeChatMeta: null,
    activeChatDoc: null,
    peerProfile: null,
    messages: [],
    agreements: [],
    aiHistory: [],
    replyingTo: null,
    attachedUid: null,
    unsubChats: null,
    unsubChatDoc: null,
    unsubPeer: null,
    unsubMsgs: null,
    unsubAgreements: null,
    unsubTickets: null,
    unsubCall: null,
    unsubGlobalCall: null,
    presenceTimer: null,
    typingTimeout: null,
    lastMsgCount: 0,

    // Ringtone AudioContext
    ringInterval: null,
    audioCtx: null,

    // Voice Note Recorder State
    isRecordingVoice: false,
    voiceRecorder: null,
    voiceChunks: [],
    voiceSeconds: 0,
    voiceTimer: null,

    // WebRTC Voice Call + 30-Day Auto-Recording State
    callState: null,
    incomingGlobalCall: null,
    pc: null,
    localStream: null,
    remoteStream: null,
    callRecorder: null,
    callRecChunks: [],
    callStartTime: 0,

    tempDayPhoto: '',
    tempInvoicePhoto: '',

    // ==================== SOUND ENGINE (RINGTONE & MESSAGE DING) ====================
    getAudioCtx() {
      if (!this.audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.audioCtx = new AC();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    },

    playTone(freq1, freq2, durMs) {
      try {
        const ctx = this.getAudioCtx();
        if (!ctx) return;
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.frequency.value = freq1;
        o2.frequency.value = freq2;
        g.gain.value = 0.08;
        o1.connect(g);
        o2.connect(g);
        g.connect(ctx.destination);
        o1.start();
        o2.start();
        setTimeout(() => {
          try { o1.stop(); o2.stop(); } catch (e) {}
        }, durMs);
      } catch (e) {}
    },

    startRingtone(isIncoming) {
      this.stopRingtone();
      const beat = () => {
        if (isIncoming) {
          this.playTone(523, 659, 320);
          setTimeout(() => this.playTone(523, 659, 320), 420);
        } else {
          this.playTone(440, 480, 750);
        }
      };
      beat();
      this.ringInterval = setInterval(beat, 2200);
    },

    stopRingtone() {
      if (this.ringInterval) {
        clearInterval(this.ringInterval);
        this.ringInterval = null;
      }
    },

    playMsgDing() {
      this.playTone(880, 1175, 110);
    },

    // ==================== GLOBAL BOOT (PRESENCE + FLOATING INCOMING CALLS) ====================
    initAiWelcome(isAr) {
      if (this.aiHistory.length) return;
      this.aiHistory.push({
        sender: 'ai',
        text: isAr
          ? 'أهلاً بك في الدعم الفني الذكي لـ «ضمان سايت» 🏗️\nاسألني عن اتفاقات الموردين (B2B)، الاستلام الهندسي بضمان 3 أضعاف (3x)، اليوميات، المستخلصات، السلف، أو فسخ العقد.'
          : 'Welcome to DamanSite AI Support 🏗️\nAsk about B2B Supply Escrow, 3x Engineering Guarantee, Settlements, or Contract Termination.'
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

      // 1. Online Presence Heartbeat (every 60s)
      const beatPresence = () => {
        if (app.user) {
          app.db.collection('users').doc(app.user.uid).update({ lastSeen: Date.now() }).catch(() => {});
        }
      };
      beatPresence();
      this.presenceTimer = setInterval(beatPresence, 60000);

      // 2. Global Incoming Call Listener (works on ANY tab!)
      this.unsubGlobalCall = app.db.collection('incomingCalls').doc(app.user.uid).onSnapshot((snap) => {
        if (!snap.exists) {
          if (this.incomingGlobalCall) {
            this.incomingGlobalCall = null;
            this.stopRingtone();
            this.renderGlobalCallOverlay();
          }
          return;
        }
        const d = snap.data();
        if (d.status === 'ringing' && d.callerId !== app.user.uid && !this.callState) {
          this.incomingGlobalCall = d;
          this.startRingtone(true);
          this.renderGlobalCallOverlay();
        } else {
          this.incomingGlobalCall = null;
          this.stopRingtone();
          this.renderGlobalCallOverlay();
        }
      }, () => {});

      // 3. Chats List & Unread Badge
      const lookupIds = app.hasAdminAccess() ? [app.user.uid, 'admin'] : [app.user.uid];
      this.unsubChats = app.db
        .collection('chats')
        .where('participants', 'array-contains-any', lookupIds)
        .limit(40)
        .onSnapshot(
          (snap) => {
            this.chats = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            this.updateChatNavBadge(app);
            if (app.activeTab === 'chat' && !this.activeChatId) this.rerender();
          },
          (err) => console.error('chats error:', err)
        );

      const ticketQuery = app.hasAdminAccess()
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

    updateChatNavBadge(app) {
      const btn = document.querySelector('.nav-btn[data-tab="chat"]');
      if (!btn || !app.user) return;
      const unread = this.chats.filter((c) => c.lastSenderId && c.lastSenderId !== app.user.uid && !c.lastReadByPeer).length;
      let badge = document.getElementById('daman-chat-unread-badge');
      if (!badge) {
        btn.style.position = 'relative';
        badge = document.createElement('span');
        badge.id = 'daman-chat-unread-badge';
        badge.className = 'hidden absolute top-0.5 end-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center';
        btn.appendChild(badge);
      }
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    },

    renderGlobalCallOverlay() {
      let box = document.getElementById('daman-global-call-overlay');
      if (!this.incomingGlobalCall) {
        if (box) box.remove();
        return;
      }
      if (!box) {
        box = document.createElement('div');
        box.id = 'daman-global-call-overlay';
        box.className = 'fixed inset-x-3 top-3 z-[90] max-w-md mx-auto bg-gradient-to-r from-emerald-900 to-slate-900 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-2xl space-y-2';
        document.body.appendChild(box);
      }
      const c = this.incomingGlobalCall;
      const app = window.DamanApp;
      box.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-10 h-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center animate-bounce shrink-0"><i class="fa-solid fa-phone-volume"></i></span>
            <div class="min-w-0">
              <div class="text-xs font-black text-white truncate">مكالمة واردة من ${app.esc(c.callerName || 'مستخدم')}</div>
              <div class="text-[10px] text-amber-300">مسجّلة لحفظ الحقوق (30 يوم)</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="DamanChat.acceptGlobalCall()" class="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">رد</button>
            <button onclick="DamanChat.rejectGlobalCall()" class="px-3 py-2 rounded-xl bg-rose-500 text-white font-black text-xs">رفض</button>
          </div>
        </div>`;
    },

    async acceptGlobalCall() {
      const c = this.incomingGlobalCall;
      if (!c) return;
      this.stopRingtone();
      this.incomingGlobalCall = null;
      this.renderGlobalCallOverlay();
      const app = window.DamanApp;
      this.subTab = 'chats';
      app.switchTab('chat');
      this.openChatRoom(c.chatId, { id: c.chatId, otherUid: c.callerId, otherName: c.callerName });
      setTimeout(() => this.answerVoiceCall(), 350);
    },

    async rejectGlobalCall() {
      const app = window.DamanApp;
      const c = this.incomingGlobalCall;
      this.stopRingtone();
      this.incomingGlobalCall = null;
      this.renderGlobalCallOverlay();
      if (c && app.user) {
        app.db.collection('incomingCalls').doc(app.user.uid).delete().catch(() => {});
        app.db.collection('chats').doc(c.chatId).collection('calls').doc('active').update({ status: 'ended' }).catch(() => {});
      }
    },

    detachListeners() {
      ['unsubChats', 'unsubChatDoc', 'unsubPeer', 'unsubMsgs', 'unsubAgreements', 'unsubTickets', 'unsubCall', 'unsubGlobalCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      if (this.presenceTimer) { clearInterval(this.presenceTimer); this.presenceTimer = null; }
      this.stopRingtone();
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
            blockedBy: [],
            hasActiveDeal: false,
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
      } catch (err) { app.toast(err.message, 'error'); }
    },

    openChatRoom(chatId, meta) {
      const app = window.DamanApp;
      this.activeChatId = chatId;
      this.activeChatMeta = meta || { id: chatId };
      this.activeChatDoc = null;
      this.peerProfile = null;
      this.replyingTo = null;
      this.messages = [];
      this.agreements = [];
      this.lastMsgCount = 0;

      ['unsubChatDoc', 'unsubPeer', 'unsubMsgs', 'unsubAgreements', 'unsubCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });

      this.unsubChatDoc = app.db.collection('chats').doc(chatId).onSnapshot((snap) => {
        if (snap.exists) {
          const d = snap.data();
          this.activeChatDoc = d;
          this.activeChatMeta.frozen = !!d.frozen;
          const other = (d.participants || []).find((x) => x !== app.user.uid) || 'admin';
          this.activeChatMeta.otherUid = other;
          if (!this.activeChatMeta.otherName && d.participantNames) {
            this.activeChatMeta.otherName = d.participantNames[other] || other;
          }
          if (other && other !== 'admin' && !this.unsubPeer) {
            this.unsubPeer = app.db.collection('users').doc(other).onSnapshot((uSnap) => {
              if (uSnap.exists) {
                this.peerProfile = uSnap.data();
                this.rerender();
              }
            }, () => {});
          }
          if (d.lastSenderId && d.lastSenderId !== app.user.uid && !d.lastReadByPeer) {
            app.db.collection('chats').doc(chatId).update({ lastReadByPeer: true }).catch(() => {});
          }
          this.rerender();
        }
      }, () => {});

      this.unsubMsgs = app.db
        .collection('chats').doc(chatId).collection('messages')
        .orderBy('createdAt', 'asc').limit(90)
        .onSnapshot((snap) => {
          const newMsgs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
          if (this.lastMsgCount > 0 && newMsgs.length > this.lastMsgCount) {
            const latest = newMsgs[newMsgs.length - 1];
            if (latest && latest.senderId !== app.user.uid) this.playMsgDing();
          }
          this.lastMsgCount = newMsgs.length;
          this.messages = newMsgs;

          // Mark unread peer messages as read (✓✓ blue)
          newMsgs.filter((m) => m.senderId !== app.user.uid && !m.read).forEach((m) => {
            app.db.collection('chats').doc(chatId).collection('messages').doc(m.id).update({ read: true }).catch(() => {});
          });

          this.rerender();
          setTimeout(() => {
            const box = document.getElementById('chat-msgs-scroll');
            if (box) box.scrollTop = box.scrollHeight;
          }, 60);
        }, () => {});

      this.unsubAgreements = app.db
        .collection('chatAgreements').where('chatId', '==', chatId)
        .onSnapshot((snap) => {
          this.agreements = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          this.rerender();
        }, () => {});

      this.unsubCall = app.db
        .collection('chats').doc(chatId).collection('calls').doc('active')
        .onSnapshot((snap) => {
          if (!snap.exists) {
            if (this.callState) this.cleanupCallLocal();
            return;
          }
          const data = snap.data();
          if (data.status === 'ringing' && data.callerId !== app.user.uid && !this.callState) {
            this.callState = { status: 'incoming', isCaller: false, otherName: data.callerName || this.activeChatMeta.otherName };
            this.startRingtone(true);
            this.rerender();
          } else if (data.status === 'ended' && this.callState) {
            this.cleanupCallLocal();
          } else if (data.status === 'answered' && data.answer && this.pc && this.callState?.isCaller && !this.pc.currentRemoteDescription) {
            this.stopRingtone();
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
      this.activeChatDoc = null;
      this.peerProfile = null;
      this.replyingTo = null;
      this.messages = [];
      this.agreements = [];
      ['unsubChatDoc', 'unsubPeer', 'unsubMsgs', 'unsubAgreements', 'unsubCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      if (shouldRender) this.rerender();
    },

    formatPeerStatus() {
      const otherUid = this.activeChatMeta?.otherUid;
      if (otherUid === 'admin') return 'إدارة ضمان سايت — متاح للرد';
      const typingMap = this.activeChatDoc?.typing || {};
      if (otherUid && typingMap[otherUid] && Date.now() - typingMap[otherUid] < 4500) {
        return '✍️ يكتب الآن...';
      }
      const ls = this.peerProfile?.lastSeen;
      if (!ls) return 'غير متصل حالياً';
      const diffSec = Math.floor((Date.now() - ls) / 1000);
      if (diffSec < 120) return '🟢 نشط الآن';
      if (diffSec < 3600) return `آخر ظهور منذ ${Math.floor(diffSec / 60)} دقيقة`;
      return `آخر ظهور ${new Date(ls).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    },

    onTypingInput() {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      if (this.typingTimeout) return;
      const patch = {};
      patch[`typing.${app.user.uid}`] = Date.now();
      app.db.collection('chats').doc(this.activeChatId).update(patch).catch(() => {});
      this.typingTimeout = setTimeout(() => { this.typingTimeout = null; }, 2500);
    },

    setReply(msgId) {
      const m = this.messages.find((x) => x.id === msgId);
      if (!m) return;
      this.replyingTo = {
        id: m.id,
        senderName: m.senderName || '',
        text: m.text || (m.imageBase64 ? '📷 صورة' : m.videoBase64 ? '🎬 فيديو' : m.fileName ? '📎 ' + m.fileName : m.audioBase64 ? '🎤 رسالة صوتية' : '📍 موقع')
      };
      this.rerender();
      document.getElementById('chat-msg-input')?.focus();
    },

    async toggleBlockPeer() {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      const blocked = Array.isArray(this.activeChatDoc?.blockedBy) ? this.activeChatDoc.blockedBy : [];
      const iBlocked = blocked.includes(app.user.uid);
      if (!window.confirm(iBlocked ? 'فك الحظر عن هذا المستخدم؟' : 'حظر هذا المستخدم ومنعه من مراسلتك؟')) return;
      try {
        await app.db.collection('chats').doc(this.activeChatId).update({
          blockedBy: iBlocked
            ? firebase.firestore.FieldValue.arrayRemove(app.user.uid)
            : firebase.firestore.FieldValue.arrayUnion(app.user.uid)
        });
        app.toast(iBlocked ? 'تم فك الحظر' : 'تم حظر المستخدم بنجاح', 'info');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async notifyChatPeer(app, previewText) {
      const meta = this.activeChatMeta || {};
      const target = meta.otherUid === 'admin' ? 'ADMIN' : meta.otherUid;
      const myName = app.profile?.companyName || app.profile?.name || 'مستخدم ضمان سايت';
      if (target) await app.sendNotification(target, `رسالة جديدة من ${myName}`, previewText);
    },

    // ==================== TEXT, IMAGE, FILE, VIDEO, LOCATION, VOICE NOTE ====================
    isChatBlocked() {
      const arr = this.activeChatDoc?.blockedBy || [];
      return arr.length > 0;
    },

    async sendChatMessage(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة بين الطرفين', 'error');
      const inp = document.getElementById('chat-msg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.activeChatId || !app.user) return;
      inp.value = '';
      const replyObj = this.replyingTo;
      this.replyingTo = null;
      try {
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid,
          senderName: app.isAdmin() ? 'إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || ''),
          isAdminIntervention: app.isAdmin() && !(this.activeChatMeta?.otherUid === 'admin'),
          text,
          replyTo: replyObj || null,
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await chatRef.update({
          lastMessage: text.slice(0, 90),
          lastSenderId: app.user.uid,
          lastReadByPeer: false,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.notifyChatPeer(app, text.slice(0, 80));
      } catch (err) { app.toast(err.message, 'error'); }
    },

    compressChatImage(file, maxW = 760) {
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
            resolve(c.toDataURL('image/jpeg', 0.56));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async sendChatImage(input) {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة', 'error');
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
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await chatRef.update({ lastMessage: '📷 صورة مرفقة', lastSenderId: app.user.uid, lastReadByPeer: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await this.notifyChatPeer(app, '📷 أرسل لك صورة جديدة');
      } catch (err) { app.toast('تعذر إرسال الصورة', 'error'); }
      input.value = '';
    },

    async sendChatFileOrVideo(input) {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة', 'error');
      const file = input.files && input.files[0];
      if (!file || !this.activeChatId || !app.user) return;
      if (file.size > 720 * 1024) {
        input.value = '';
        return app.toast('الحد الأقصى لحجم الملف أو الفيديو حالياً 700 كيلوبايت (اضغط الفيديو أو أرسل ملفاً أصغر)', 'warning');
      }
      const isVideo = (file.type || '').startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const chatRef = app.db.collection('chats').doc(this.activeChatId);
          const payload = {
            senderId: app.user.uid,
            senderName: app.profile?.companyName || app.profile?.name || '',
            text: '',
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          if (isVideo) payload.videoBase64 = reader.result;
          else { payload.fileBase64 = reader.result; payload.fileName = file.name; }
          await chatRef.collection('messages').add(payload);
          const preview = isVideo ? '🎬 فيديو مرفق' : `📎 ملف: ${file.name}`;
          await chatRef.update({ lastMessage: preview, lastSenderId: app.user.uid, lastReadByPeer: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          await this.notifyChatPeer(app, preview);
        } catch (err) { app.toast('تعذر إرسال الملف', 'error'); }
      };
      reader.readAsDataURL(file);
      input.value = '';
    },

    sendLocation() {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة', 'error');
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
              read: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await chatRef.update({ lastMessage: '📍 موقع GPS', lastSenderId: app.user.uid, lastReadByPeer: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            await this.notifyChatPeer(app, '📍 أرسل لك اللوكيشن (GPS)');
          } catch (e) { app.toast(e.message, 'error'); }
        },
        () => app.toast('يرجى السماح بصلاحية الموقع (GPS) من المتصفح', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },

    async toggleVoiceNote() {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة', 'error');
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
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              await chatRef.update({ lastMessage: `🎤 رسالة صوتية (${dur} ث)`, lastSenderId: app.user.uid, lastReadByPeer: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
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

    // ==================== WEBRTC VOICE CALLS + REAL RING + 30-DAY AUTO-RECORDING ====================
    async startVoiceCall() {
      const app = window.DamanApp;
      if (app.appConfig?.disableCalls && !app.isAdmin()) return app.toast('المكالمات الصوتية متوقفة مؤقتاً من الإدارة', 'warning');
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة', 'error');
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
        this.pc.onicecandidate = (ev) => { if (ev.candidate) callRef.collection('callerCandidates').add(ev.candidate.toJSON()).catch(() => {}); };

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        const myName = app.profile?.companyName || app.profile?.name || '';
        await callRef.set({
          callerId: app.user.uid, callerName: myName,
          offer: { type: offer.type, sdp: offer.sdp }, status: 'ringing',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Trigger Global Floating Call Overlay on Peer's screen
        const otherUid = this.activeChatMeta?.otherUid;
        if (otherUid && otherUid !== 'admin') {
          await app.db.collection('incomingCalls').doc(otherUid).set({
            chatId: this.activeChatId, callerId: app.user.uid, callerName: myName, status: 'ringing',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        callRef.collection('calleeCandidates').onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => { if (ch.type === 'added' && this.pc) this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {}); });
        });

        this.callState = { status: 'calling', isCaller: true, otherName: this.activeChatMeta?.otherName || '' };
        this.callStartTime = Date.now();
        this.startRingtone(false);
        await this.notifyChatPeer(app, '📞 مكالمة صوتية واردة — افتح التطبيق للرد');
        this.rerender();
      } catch (err) {
        app.toast('تعذر بدء المكالمة — تأكد من سماح الميكروفون', 'error');
        this.cleanupCallLocal();
      }
    },

    async answerVoiceCall() {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      this.stopRingtone();
      app.db.collection('incomingCalls').doc(app.user.uid).delete().catch(() => {});
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

        this.pc.onicecandidate = (ev) => { if (ev.candidate) callRef.collection('calleeCandidates').add(ev.candidate.toJSON()).catch(() => {}); };

        await this.pc.setRemoteDescription(new RTCSessionDescription(callSnap.data().offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await callRef.update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'answered' });

        callRef.collection('callerCandidates').onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => { if (ch.type === 'added' && this.pc) this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {}); });
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
      const otherUid = this.activeChatMeta?.otherUid;
      if (otherUid && otherUid !== 'admin') app.db.collection('incomingCalls').doc(otherUid).delete().catch(() => {});
      if (app.user) app.db.collection('incomingCalls').doc(app.user.uid).delete().catch(() => {});
      this.cleanupCallLocal();
    },

    cleanupCallLocal() {
      this.stopRingtone();
      if (this.callRecorder && this.callRecorder.state !== 'inactive') { try { this.callRecorder.stop(); } catch (e) {} }
      this.callRecorder = null;
      if (this.localStream) { this.localStream.getTracks().forEach((t) => t.stop()); this.localStream = null; }
      if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
      this.callState = null;
      this.rerender();
    },

    // ==================== 6-TEMPLATE AGREEMENT ENGINE ====================
    typeLabel(t) {
      const map = { supply: 'توريد خامات / بضاعة (B2B)', daily: 'يومية وعمالة', lump: 'مقطوعية', meter: 'بالمتر ومستخلصات', monthly: 'راتب شهري / دائم', weekly: 'اتفاق أسبوعي' };
      return map[t] || t;
    },

    payModeLabel(m) {
      const map = {
        daily_pay: 'يومية تُصرف كل يوم', expenses_thursday: 'مصاريف يومية + تصفية الخميس', every_15_days: 'تصفية كل 15 يوم بتواريخ محددة',
        split_50_50: '50% مقدم و50% عند التسليم', milestones: 'دفعات بنسب مئوية ومواعيد', on_completion: '100% عند الاستلام والفحص',
        supply_advance: 'دفعة تجهيز/شحن + الباقي عند الاستلام', monthly_pay: 'صرف راتب شهري ثابت'
      };
      return map[m] || m;
    },

    openAgreementModal() {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
      if (app.appConfig?.requireKycForActions && app.profile?.kycStatus !== 'verified' && !app.isAdmin()) {
        app.toast('يجب توثيق حسابك بالبطاقة/السجل التجاري أولاً قبل إنشاء اتفاق رسمي', 'warning');
        if (window.DamanWallet) window.DamanWallet.openKycModal();
        return;
      }

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
              <label class="block text-[11px] font-bold text-slate-300 mb-1">1. اختر نوع الاتفاق</label>
              <select id="ag-type" onchange="DamanChat.toggleAgreementFields()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/50 font-black text-amber-300">
                <option value="daily">👷 يومية وعمالة (صرف يومي / خميس / كل 15 يوم)</option>
                <option value="supply">🚚 توريد خامات أو بضاعة (مورّدين وشركات B2B)</option>
                <option value="lump">🏗️ مقطوعية (50/50 أو نسب أو بعد الانتهاء)</option>
                <option value="meter">📐 بالمتر ومستخلصات جارية (سعر المتر × الكمية)</option>
                <option value="monthly">💼 راتب شهري ثابت / اتفاق دائم</option>
                <option value="weekly">📅 اتفاق أسبوعي (قيمة الأسبوع × أسابيع)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">2. وصف الشغل أو الصنف المطلوب</label>
              <input id="ag-title" type="text" required placeholder="مثال: توريد 50 طن أسمنت / 10 نجارين / محارة فيلا" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <div id="ag-box-daily" class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
              <div class="grid grid-cols-3 gap-1.5">
                <div><label class="block text-[10px] text-amber-300 font-bold mb-1">عدد العمال</label><input id="ag-workers" type="number" min="1" value="10" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                <div><label class="block text-[10px] text-amber-300 font-bold mb-1">يومية الفرد (ج.م)</label><input id="ag-daily-rate" type="number" min="10" value="350" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                <div><label class="block text-[10px] text-amber-300 font-bold mb-1">عدد الأيام</label><input id="ag-days" type="number" min="1" value="6" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              </div>
              <div><label class="block text-[10px] text-slate-300 font-bold mb-1">مصاريف تشغيل يومية (اختياري - ج.م)</label><input id="ag-daily-exp" type="number" min="0" value="0" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
            </div>

            <div id="ag-box-supply" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2">
              <div class="grid grid-cols-3 gap-1.5">
                <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">الكمية</label><input id="ag-sup-qty" type="number" min="1" step="any" value="10" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">الوحدة</label><input id="ag-sup-unit" type="text" value="طن / شيكارة" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">سعر الوحدة (ج.م)</label><input id="ag-sup-price" type="number" min="1" step="any" value="2500" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div><label class="block text-[10px] text-slate-300 font-bold mb-1">مكان التسليم</label><input id="ag-sup-loc" type="text" placeholder="مثال: موقع التجمع" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                <div><label class="block text-[10px] text-slate-300 font-bold mb-1">تاريخ التسليم</label><input id="ag-sup-date" type="date" value="${new Date().toISOString().slice(0, 10)}" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
              </div>
            </div>

            <div id="ag-box-meter" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">سعر المتر الواحد (ج.م)</label><input id="ag-meter-price" type="number" min="1" step="any" value="20" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">إجمالي الأمتار (م² / م.ط)</label><input id="ag-meter-qty" type="number" min="1" step="any" value="1000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
            </div>

            <div id="ag-box-lump" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <label class="block text-[10px] text-amber-300 font-bold mb-1">إجمالي مبلغ المقطوعية (ج.م)</label>
              <input id="ag-lump-total" type="number" min="50" step="any" value="1000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/40 text-white font-bold" />
            </div>

            <div id="ag-box-monthly" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/40 grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-sky-300 font-bold mb-1">الراتب الشهري الثابت (ج.م)</label><input id="ag-month-sal" type="number" min="500" value="12000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-sky-300 font-bold mb-1">يوم الصرف بالشهر</label><input id="ag-month-day" type="text" value="يوم 1 من كل شهر" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
            </div>

            <div id="ag-box-weekly" class="hidden p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">مبلغ الأسبوع (ج.م)</label><input id="ag-week-rate" type="number" min="100" value="5000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">عدد الأسابيع</label><input id="ag-weeks" type="number" min="1" value="4" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
            </div>

            <div class="p-2.5 rounded-xl bg-slate-950/90 border border-sky-500/30 space-y-2">
              <label class="block text-[11px] font-bold text-sky-300">3. نظام الصرف والتصفية</label>
              <select id="ag-pay-mode" onchange="DamanChat.togglePayModeSubfields()" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold">
                <option value="daily_pay">يومية تُصرف كل يوم بعد التأكيد</option>
                <option value="expenses_thursday">مصاريف يومية + تصفية يوم الخميس</option>
                <option value="every_15_days">تصفية كل 15 يوم بتواريخ محددة</option>
                <option value="split_50_50">50% مقدم و50% عند التسليم</option>
                <option value="milestones">نسب مئوية ومواعيد (مثل 20% الآن + 20% بعد أسبوع)</option>
                <option value="supply_advance">دفعة تجهيز/شحن (%) + الباقي عند استلام البضاعة</option>
                <option value="on_completion">100% عند انتهاء واستلام الشغل/التوريد</option>
                <option value="monthly_pay">صرف راتب شهري ثابت</option>
              </select>
              <div id="ag-sub-15d" class="hidden"><label class="block text-[10px] text-amber-300 font-bold mb-1">تواريخ التصفية (كل 15 يوم)</label><input id="ag-15d-dates" type="text" value="يوم 1 ويوم 15 من كل شهر" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
              <div id="ag-sub-ms" class="hidden space-y-2 pt-1">
                <div class="grid grid-cols-2 gap-2">
                  <div><label class="block text-[10px] text-slate-300 mb-1">الدفعة الأولى الآن (%)</label><input id="ag-m1-pct" type="number" min="0" max="100" value="20" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                  <div><label class="block text-[10px] text-slate-300 mb-1">الدفعة الثانية (%)</label><input id="ag-m2-pct" type="number" min="0" max="100" value="20" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                </div>
                <div><label class="block text-[10px] text-slate-300 mb-1">موعد الدفعة الثانية</label><input id="ag-m2-when" type="text" value="بعد أسبوع من البدء" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                <div id="ag-m3-info" class="text-[10px] text-emerald-300 font-bold"></div>
              </div>
            </div>

            <div id="ag-calc-preview" class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-[11px] text-emerald-200 space-y-0.5"></div>

            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-paper-plane me-1"></i> إرسال تذكرة الاتفاق والعقد في الشات
            </button>
          </form>
        </div>`;

      this.toggleAgreementFields();
    },

    toggleAgreementFields() {
      const t = document.getElementById('ag-type')?.value || 'daily';
      ['daily', 'supply', 'meter', 'lump', 'monthly', 'weekly'].forEach((k) => {
        document.getElementById('ag-box-' + k)?.classList.toggle('hidden', t !== k);
      });
      const pmSel = document.getElementById('ag-pay-mode');
      if (pmSel) {
        if (t === 'daily') pmSel.value = 'expenses_thursday';
        else if (t === 'supply') pmSel.value = 'on_completion';
        else if (t === 'lump') pmSel.value = 'split_50_50';
        else if (t === 'meter') pmSel.value = 'milestones';
        else if (t === 'monthly') pmSel.value = 'monthly_pay';
        else if (t === 'weekly') pmSel.value = 'expenses_thursday';
      }
      this.togglePayModeSubfields();
    },

    togglePayModeSubfields() {
      const pm = document.getElementById('ag-pay-mode')?.value || '';
      document.getElementById('ag-sub-15d')?.classList.toggle('hidden', pm !== 'every_15_days');
      document.getElementById('ag-sub-ms')?.classList.toggle('hidden', !(pm === 'milestones' || pm === 'supply_advance'));
      this.updateAgreementPreview();
    },

    computeModalTotals() {
      const t = document.getElementById('ag-type')?.value || 'daily';
      let total = 0, dailyCost = 0, unitPrice = 0, unitQty = 0, workers = 1, days = 1, unitName = '';
      if (t === 'daily') {
        workers = parseInt(document.getElementById('ag-workers')?.value, 10) || 1;
        unitPrice = parseFloat(document.getElementById('ag-daily-rate')?.value) || 0;
        days = parseInt(document.getElementById('ag-days')?.value, 10) || 1;
        dailyCost = workers * unitPrice;
        total = dailyCost * days;
      } else if (t === 'supply') {
        unitQty = parseFloat(document.getElementById('ag-sup-qty')?.value) || 0;
        unitName = (document.getElementById('ag-sup-unit')?.value || '').trim();
        unitPrice = parseFloat(document.getElementById('ag-sup-price')?.value) || 0;
        total = unitQty * unitPrice;
      } else if (t === 'meter') {
        unitPrice = parseFloat(document.getElementById('ag-meter-price')?.value) || 0;
        unitQty = parseFloat(document.getElementById('ag-meter-qty')?.value) || 0;
        unitName = 'متر';
        total = unitPrice * unitQty;
      } else if (t === 'lump') {
        total = parseFloat(document.getElementById('ag-lump-total')?.value) || 0;
      } else if (t === 'monthly') {
        total = parseFloat(document.getElementById('ag-month-sal')?.value) || 0;
      } else if (t === 'weekly') {
        unitPrice = parseFloat(document.getElementById('ag-week-rate')?.value) || 0;
        unitQty = parseInt(document.getElementById('ag-weeks')?.value, 10) || 1;
        total = unitPrice * unitQty;
      }
      total = Math.round(total * 100) / 100;
      const rate = window.DamanApp.getCommissionRate();
      const fee = Math.round(total * rate * 100) / 100;
      const grand = Math.round((total + fee) * 100) / 100;
      return { t, total, fee, grand, dailyCost, unitPrice, unitQty, unitName, workers, days };
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
        prev.innerHTML = `<div>إجمالي قيمة الاتفاق: <b>${app.fmtMoney(calc.total)} ج.م</b></div><div>عمولة ضمان سايت (${(app.getCommissionRate() * 100).toFixed(1)}%): <b>${app.fmtMoney(calc.fee)} ج.م</b></div><div class="text-amber-300 font-black">الإجمالي شامل الضمان: ${app.fmtMoney(calc.grand)} ج.م</div>`;
      }
    },

    async submitAgreement(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const calc = this.computeModalTotals();
      if (calc.total <= 0) return app.toast('أدخل قيماً صحيحة للاتفاق', 'error');

      const title = document.getElementById('ag-title').value.trim();
      const payMode = document.getElementById('ag-pay-mode').value;
      const dailyExpense = parseFloat(document.getElementById('ag-daily-exp')?.value) || 0;
      const settlementSchedule = payMode === 'every_15_days'
        ? (document.getElementById('ag-15d-dates')?.value.trim() || 'يوم 1 ويوم 15')
        : calc.t === 'monthly' ? (document.getElementById('ag-month-day')?.value.trim() || 'يوم 1 من كل شهر') : 'يوم الخميس';

      let milestones = [];
      if (payMode === 'split_50_50') {
        const half = Math.round(calc.total / 2);
        milestones = [
          { label: 'الدفعة المقدمة (50%)', pct: 50, amount: half, when: 'عند بدء العمل', paid: false },
          { label: 'الباقي عند التسليم (50%)', pct: 50, amount: calc.total - half, when: 'عند الاستلام النهائي', paid: false }
        ];
      } else if (payMode === 'milestones' || payMode === 'supply_advance') {
        const m1 = parseFloat(document.getElementById('ag-m1-pct')?.value) || 0;
        const m2 = parseFloat(document.getElementById('ag-m2-pct')?.value) || 0;
        const m2When = (document.getElementById('ag-m2-when')?.value || '').trim();
        const m3 = Math.max(0, 100 - m1 - m2);
        if (m1 > 0) milestones.push({ label: payMode === 'supply_advance' ? `دفعة تجهيز/شحن (${m1}%)` : `الدفعة الأولى الآن (${m1}%)`, pct: m1, amount: Math.round((calc.total * m1) / 100), when: 'فوراً عند الاعتماد', paid: false });
        if (m2 > 0) milestones.push({ label: `الدفعة الثانية (${m2}%)`, pct: m2, amount: Math.round((calc.total * m2) / 100), when: m2When || 'لاحقاً', paid: false });
        if (m3 > 0) milestones.push({ label: `الباقي عند الاستلام (${m3}%)`, pct: m3, amount: Math.round((calc.total * m3) / 100), when: 'عند الاستلام والفحص', paid: false });
      }

      const ticketNumber = 'TKT-' + Date.now().toString().slice(-6);
      try {
        await app.db.collection('chatAgreements').add({
          chatId: this.activeChatId, ticketNumber, type: calc.t, payMode, title,
          unitPrice: calc.unitPrice, unitQty: calc.unitQty, unitName: calc.unitName,
          supplyLocation: (document.getElementById('ag-sup-loc')?.value || '').trim(),
          supplyDate: (document.getElementById('ag-sup-date')?.value || '').trim(),
          workers: calc.workers, totalDays: calc.days, dailyRate: calc.t === 'daily' ? calc.unitPrice : 0,
          dailyCost: calc.dailyCost, dailyExpense, settlementSchedule, milestones,
          totalAmount: calc.total, commissionFee: calc.fee, grandTotalWithFee: calc.grand,
          lockedAmount: 0, remainingEscrow: 0, coveragePercent: 0,
          createdBy: app.user.uid, createdByName: app.profile?.companyName || app.profile?.name || '', createdByNationalId: app.profile?.nationalId || '',
          otherUid: this.activeChatMeta?.otherUid || '', otherName: this.activeChatMeta?.otherName || '',
          status: 'proposed', contractStatus: 'not_uploaded', signedContractBase64: '',
          confirmedDays: 0, pendingDayLog: null, pendingAdvance: null, pendingAmendment: null, pendingAbstract: null, pendingTermination: null,
          timeline: [], createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('daman-chat-agree-modal').classList.add('hidden');
        await this.notifyChatPeer(app, `📄 تذكرة اتفاق جديدة (${ticketNumber}): ${title} — ${app.fmtMoney(calc.total)} ج.م`);
        app.toast('تم إرسال تذكرة الاتفاق في المحادثة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async cancelProposedAgreement(agId) {
      if (!window.confirm('هل تريد إلغاء وسحب هذا العرض المقترح؟')) return;
      try {
        await window.DamanApp.db.collection('chatAgreements').doc(agId).delete();
        window.DamanApp.toast('تم إلغاء العرض بنجاح', 'info');
      } catch (e) { window.DamanApp.toast(e.message, 'error'); }
    },

    async acceptAgreement(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const needed = Number(ag.grandTotalWithFee || ag.totalAmount);
      const avail = Number(app.profile?.balanceAvailable || 0);

      if (avail <= 0) {
        if (window.confirm(`رصيدك المتاح 0 ج.م والمطلوب ${app.fmtMoney(needed)} ج.م.\nهل تريد الانتقال لشحن المحفظة الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(needed);
        }
        return;
      }

      let lockNow = needed, isPartial = false;
      if (avail < needed) {
        const pct = Math.max(1, Math.floor((avail / needed) * 100));
        if (!window.confirm(`⚠️ رصيدك المتاح (${app.fmtMoney(avail)} ج.م) يغطي ${pct}% فقط من الاتفاق.\nاضغط OK للبدء بتغطية جزئية (${pct}%) أو Cancel لشحن الفرق.`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(Math.round((needed - avail) * 100) / 100);
          return;
        }
        lockNow = avail; isPartial = true;
      } else {
        if (!window.confirm(`تأكيد الموافقة وحجز ${app.fmtMoney(needed)} ج.م (شامل عمولة الضمان 3.5%)؟\nيُرجى طباعة العقد نسختين وتوقيعه ورفع صورته هنا لتفعيل الضمان.`)) return;
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

          tx.update(userRef, { balanceAvailable: Math.round((curAvail - lockNow) * 100) / 100, balanceEscrow: Math.round((curEsc + lockNow) * 100) / 100 });
          tx.update(agRef, {
            status: 'active', payerUid: app.user.uid, payerName: app.profile?.companyName || app.profile?.name || '', payerNationalId: app.profile?.nationalId || '',
            lockedAmount: lockNow, remainingEscrow: escrowNet, coveragePercent: covPct,
            acceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
            timeline: firebase.firestore.FieldValue.arrayUnion({ date: new Date().toISOString().slice(0, 10), kind: 'lock', label: isPartial ? `تغطية جزئية (${covPct}%)` : 'حجز كامل مبلغ الضمان (100%)', amount: lockNow, by: app.profile?.name || '' })
          });
        });
        await app.db.collection('chats').doc(this.activeChatId).update({ hasActiveDeal: true }).catch(() => {});
        const msg = isPartial ? `⚠️ تم تفعيل الاتفاق ${ag.ticketNumber} بتغطية جزئية (${covPct}%).` : `✅ تم حجز كامل الضمان للاتفاق ${ag.ticketNumber}.`;
        await app.sendNotification(ag.createdBy, `اعتماد الاتفاق ${ag.ticketNumber}`, msg);
        await app.sendNotification(app.user.uid, `اعتماد الاتفاق ${ag.ticketNumber}`, msg);
        app.toast(isPartial ? `تم الحجز بنسبة تغطية ${covPct}%` : 'تم حجز الضمان بنجاح!', 'success');
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

          tx.update(userRef, { balanceAvailable: Math.round((curAvail - amt) * 100) / 100, balanceEscrow: Math.round((curEsc + amt) * 100) / 100 });
          tx.update(agRef, {
            lockedAmount: newLocked, remainingEscrow: newRem, coveragePercent: newCov,
            timeline: firebase.firestore.FieldValue.arrayUnion({ date: new Date().toISOString().slice(0, 10), kind: 'topup', label: `تعزيز رصيد التغطية (وصلت لـ ${newCov}%)`, amount: amt, by: app.profile?.name || '' })
          });
        });
        await app.sendNotification(ag.createdBy, `تم تعزيز رصيد الاتفاق ${ag.ticketNumber}`, `أضاف صاحب العمل ${app.fmtMoney(amt)} ج.م.`);
        app.toast('تم رفع تغطية الرصيد بنجاح', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async uploadSignedContract(agId, input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const b64 = await this.compressChatImage(file);
        await app.db.collection('chatAgreements').doc(agId).update({
          signedContractBase64: b64, contractStatus: 'pending_admin',
          signedUploadedBy: app.profile?.name || '', signedUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.notifyChatPeer(app, '📄 تم رفع صورة العقد الموقّع (نسختين) — بانتظار اعتماد الإدارة');
        await app.sendNotification('ADMIN', 'عقد موقّع جديد بانتظار الاعتماد', `تم رفع صورة عقد موقّع للاتفاق ${agId}`);
        app.toast('تم رفع صورة العقد الموقّع بنجاح وأُرسلت للإدارة', 'success');
      } catch (e) { app.toast('تعذر رفع الصورة', 'error'); }
      input.value = '';
    },

    async requestTermination(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const rem = Number(ag.remainingEscrow || 0);
      const reason = window.prompt('سبب طلب إنهاء العمل / فسخ العقد:', 'إنهاء العمل بالتراضي');
      if (!reason) return;
      const workerShare = parseFloat(window.prompt(`المتبقي في الضمان: ${app.fmtMoney(rem)} ج.م.\nأدخل المبلغ المقترح صرفه للمنفّذ (والباقي يرجع لصاحب العمل):`, '0'));
      if (isNaN(workerShare) || workerShare < 0 || workerShare > rem) return app.toast('أدخل مبلغاً صحيحاً', 'error');
      const clientRefund = Math.round((rem - workerShare) * 100) / 100;
      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingTermination: { reason: reason.trim(), workerShare, clientRefund, proposedByUid: app.user.uid, proposedByName: app.profile?.name || '', date: new Date().toISOString().slice(0, 10) }
        });
        const peer = app.user.uid === ag.createdBy ? ag.payerUid : ag.createdBy;
        if (peer) await app.sendNotification(peer, `طلب فسخ العقد (${ag.ticketNumber})`, `${reason} — للمنفّذ: ${app.fmtMoney(workerShare)} | للعميل: ${app.fmtMoney(clientRefund)}`);
        app.toast('تم إرسال طلب فسخ العقد للطرف الآخر', 'info');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async respondTermination(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingTermination) return;
      const tm = ag.pendingTermination;

      if (!approve) {
        if (!window.confirm('رفض شروط الفسخ وتحويل العقد لنزاع رسمي تفصل فيه إدارة ضمان سايت؟')) return;
        try {
          await app.db.collection('chatAgreements').doc(agId).update({ status: 'disputed', pendingTermination: null });
          await app.db.collection('disputes').add({
            agreementId: agId, contractNumber: ag.ticketNumber, projectTitle: ag.title, contractAmount: Number(ag.remainingEscrow || 0),
            clientId: ag.payerUid || '', providerId: ag.createdBy || '', reason: `خلاف على فسخ العقد: ${tm.reason}`, status: 'open', createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          await app.sendNotification('ADMIN', `نزاع فسخ عقد جديد (${ag.ticketNumber})`, ag.title);
          app.toast('تم تحويل العقد لنزاع رسمي أمام الإدارة', 'warning');
        } catch (e) { app.toast(e.message, 'error'); }
        return;
      }

      if (!window.confirm(`تأكيد فسخ العقد؟\n• للمنفّذ: ${app.fmtMoney(tm.workerShare)} ج.م\n• يُرد للعميل: ${app.fmtMoney(tm.clientRefund)} ج.م`)) return;
      const payerRef = app.db.collection('users').doc(ag.payerUid);
      const workerRef = app.db.collection('users').doc(ag.createdBy);
      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        await app.db.runTransaction(async (tx) => {
          const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef), tx.get(agRef)]);
          const curRem = Number((aDoc.data() || {}).remainingEscrow || 0);
          tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - curRem) * 100) / 100), balanceAvailable: Math.round((Number((pDoc.data() || {}).balanceAvailable || 0) + tm.clientRefund) * 100) / 100 });
          if (tm.workerShare > 0) tx.update(workerRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + tm.workerShare) * 100) / 100 });
          tx.update(agRef, { status: 'cancelled', remainingEscrow: 0, pendingTermination: null, timeline: firebase.firestore.FieldValue.arrayUnion({ date: tm.date, kind: 'cancelled', label: `فسخ العقد بالتراضي (${tm.reason})`, amount: tm.workerShare, by: app.profile?.name || '' }) });
        });
        await app.db.collection('chats').doc(this.activeChatId).update({ hasActiveDeal: false }).catch(() => {});
        app.toast('تم فسخ العقد وتصفية المستحقات بالتراضي ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async requestAdvance(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const amount = parseFloat(window.prompt(`مبلغ السلفة المطلوبة (المتبقي بالضمان: ${app.fmtMoney(ag.remainingEscrow)} ج.م):`, '500'));
      if (!amount || amount <= 0) return;
      const reason = window.prompt('سبب السلفة:', 'سلفة تشغيل / مصاريف') || 'سلفة';
      try {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingAdvance: { amount, reason, byUid: app.user.uid, byName: app.profile?.name || '', date: new Date().toISOString().slice(0, 10) } });
        await app.sendNotification(ag.payerUid, `طلب سلفة (${app.fmtMoney(amount)} ج.م)`, `${app.profile?.name}: ${reason}`);
        app.toast('تم إرسال طلب السلفة للموافقة', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async respondAdvance(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingAdvance) return;
      const adv = ag.pendingAdvance;
      if (!approve) {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingAdvance: null });
        return app.toast('تم رفض طلب السلفة', 'info');
      }
      if (Number(ag.remainingEscrow || 0) < Number(adv.amount)) return app.toast('الرصيد المتبقي غير كافٍ', 'error');
      const payerRef = app.db.collection('users').doc(ag.payerUid);
      const workerRef = app.db.collection('users').doc(ag.createdBy);
      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        await app.db.runTransaction(async (tx) => {
          const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef), tx.get(agRef)]);
          const curRem = Number((aDoc.data() || {}).remainingEscrow || 0);
          if (curRem < adv.amount) throw new Error('الرصيد غير كافٍ');
          tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - adv.amount) * 100) / 100) });
          tx.update(workerRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + adv.amount) * 100) / 100 });
          tx.update(agRef, { remainingEscrow: Math.round((curRem - adv.amount) * 100) / 100, pendingAdvance: null, timeline: firebase.firestore.FieldValue.arrayUnion({ date: adv.date, kind: 'advance_paid', label: `صرف سلفة (${adv.reason})`, amount: adv.amount, by: app.profile?.name || '' }) });
        });
        await app.sendNotification(ag.createdBy, 'تم صرف السلفة ✅', `${app.fmtMoney(adv.amount)} ج.م`);
        app.toast('تم صرف السلفة لمحفظة المنفّذ ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async proposeAmendment(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const newTotal = parseFloat(window.prompt(`السعر الإجمالي الجديد (الحالي: ${app.fmtMoney(ag.totalAmount)} ج.م):`, ag.totalAmount));
      if (!newTotal || newTotal <= 0) return;
      const note = window.prompt('تفاصيل التعديل المطلوب:', '');
      if (!note) return;
      try {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingAmendment: { newTotal, note: note.trim(), proposedByUid: app.user.uid, proposedByName: app.profile?.name || '', date: new Date().toISOString().slice(0, 10) } });
        app.toast('تم إرسال طلب تعديل الاتفاق للطرف الآخر', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async respondAmendment(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingAmendment) return;
      const am = ag.pendingAmendment;
      if (!approve) {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingAmendment: null });
        return app.toast('تم رفض التعديل', 'info');
      }
      const rate = app.getCommissionRate();
      const newFee = Math.round(am.newTotal * rate * 100) / 100;
      const newGrand = Math.round((am.newTotal + newFee) * 100) / 100;
      const newCov = Math.min(100, Math.round((Number(ag.lockedAmount || 0) / newGrand) * 100));
      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          totalAmount: am.newTotal, commissionFee: newFee, grandTotalWithFee: newGrand, coveragePercent: newCov, pendingAmendment: null,
          timeline: firebase.firestore.FieldValue.arrayUnion({ date: am.date, kind: 'amendment', label: `ملحق تعديل معتمد: ${am.note}`, amount: am.newTotal, by: app.profile?.name || '' })
        });
        app.toast('تم اعتماد ملحق التعديل وتحديث العقد ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    openDailyLogModal(agId) {
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      this.tempDayPhoto = '';
      let modal = document.getElementById('daman-day-log-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-day-log-modal';
        modal.className = 'fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-2xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-sky-400">تأكيد حضور العمال والإنجاز اليومي</h3><button onclick="document.getElementById('daman-day-log-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanChat.submitDailyLog(event,'${agId}')" class="space-y-2.5">
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">عدد العمال الفعلي الذين حضروا اليوم (المتفق عليه: ${ag.workers || 1})</label><input id="dl-count" type="number" min="1" required value="${ag.workers || 1}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-bold" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">ملاحظة عن ما تم إنجازه اليوم</label><input id="dl-note" type="text" placeholder="مثال: شدة سقف الدور الثاني" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <label class="block p-2.5 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer"><span class="font-bold text-emerald-300"><i class="fa-solid fa-camera me-1"></i> صورة إثبات الإنجاز (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanChat.handleTempPhoto(this,'day')" /><div id="dl-photo-prev"></div></label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">إرسال للمهندس للاعتماد</button>
          </form>
        </div>`;
    },

    async handleTempPhoto(input, target) {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const b64 = await this.compressChatImage(file, 640);
        if (target === 'day') { this.tempDayPhoto = b64; const p = document.getElementById('dl-photo-prev'); if (p) p.innerHTML = `<img src="${b64}" class="max-h-28 mx-auto rounded mt-2" />`; }
        else { this.tempInvoicePhoto = b64; const p = document.getElementById('mv-photo-prev'); if (p) p.innerHTML = `<img src="${b64}" class="max-h-28 mx-auto rounded mt-2" />`; }
      } catch (e) {}
    },

    async submitDailyLog(e, agId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const actualWorkers = parseInt(document.getElementById('dl-count').value, 10) || 1;
      const note = document.getElementById('dl-note').value.trim();
      try {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingDayLog: { date: new Date().toISOString().slice(0, 10), actualWorkers, note, photoBase64: this.tempDayPhoto || '', byUid: app.user.uid, byName: app.profile?.name || '' } });
        document.getElementById('daman-day-log-modal').classList.add('hidden');
        await app.sendNotification(ag.payerUid || ag.otherUid, `تأكيد حضور اليوم (${actualWorkers} عامل)`, `سجّل ${app.profile?.name} حضور ${actualWorkers} فرد اليوم.`);
        app.toast('تم إرسال تأكيد اليوم للمهندس/صاحب العمل', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async clientApproveActualDay(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingDayLog) return;
      const confirmedCount = parseInt(window.prompt(`اعتماد العدد الفعلي لعمال اليوم (المسجّل: ${ag.pendingDayLog.actualWorkers}):`, ag.pendingDayLog.actualWorkers), 10);
      if (!confirmedCount || confirmedCount <= 0) return;
      const dayCost = ag.type === 'daily' ? Math.round(confirmedCount * Number(ag.dailyRate || 0) * 100) / 100 : 0;
      const payNow = ag.payMode === 'daily_pay' && dayCost > 0;
      const newRem = Math.max(0, Math.round((Number(ag.remainingEscrow || 0) - dayCost) * 100) / 100);
      try {
        if (payNow && Number(ag.remainingEscrow || 0) >= dayCost) {
          const payerRef = app.db.collection('users').doc(ag.payerUid);
          const workerRef = app.db.collection('users').doc(ag.createdBy);
          await app.db.runTransaction(async (tx) => {
            const [pDoc, wDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef)]);
            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - dayCost) * 100) / 100) });
            tx.update(workerRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + dayCost) * 100) / 100 });
          });
        }
        await app.db.collection('chatAgreements').doc(agId).update({
          confirmedDays: Number(ag.confirmedDays || 0) + 1, remainingEscrow: newRem, pendingDayLog: null,
          timeline: firebase.firestore.FieldValue.arrayUnion({ date: ag.pendingDayLog.date, kind: 'day_confirmed', label: `اعتماد يوم (${confirmedCount} عامل)${payNow ? ' + صرف فوري' : ''}`, amount: dayCost, photoBase64: ag.pendingDayLog.photoBase64 || '', by: app.profile?.name || '' })
        });
        const tomorrowEst = Number(ag.dailyCost || dayCost || 0);
        if (tomorrowEst > 0 && newRem < tomorrowEst) {
          await app.sendNotification(ag.createdBy, '⚠️ أمر وقف عمل مؤقت من ضمان سايت', `الرصيد المتبقي لا يكفي ليومية الغد — يرجى وقف العمل لحين الشحن.`);
          app.toast('⚠️ تنبيه: الرصيد لا يكفي ليومية الغد! تم إرسال إشعار وقف عمل مؤقت', 'warning');
        } else {
          app.toast(`تم اعتماد يوم العمل (${confirmedCount} فرد) بنجاح`, 'success');
        }
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async clientRejectActualDay(agId) {
      await window.DamanApp.db.collection('chatAgreements').doc(agId).update({ pendingDayLog: null });
      window.DamanApp.toast('تم إعادة الطلب للمراجعة', 'info');
    },

    async submitRunningAbstractOrSupply(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const isSupply = ag.type === 'supply';
      const qty = parseFloat(window.prompt(isSupply ? `الكمية المورّدة (${ag.unitName || 'وحدة'}):` : 'الأمتار المنفّذة في المستخلص:', ag.unitQty || 1));
      if (!qty || qty <= 0) return;
      const amount = parseFloat(window.prompt('القيمة المطلوب صرفها (ج.م):', Math.round(qty * Number(ag.unitPrice || 0)) || ag.remainingEscrow));
      if (!amount || amount <= 0) return;
      const note = window.prompt(isSupply ? 'رقم البوليصة / ملاحظة التوريد:' : 'رقم المستخلص والبيان:', isSupply ? 'تم الشحن والتسليم' : 'مستخلص جاري رقم 1') || '';
      try {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingAbstract: { qty, amount, note, isSupply, date: new Date().toISOString().slice(0, 10), byName: app.profile?.name || '' } });
        await app.sendNotification(ag.payerUid, isSupply ? 'إشعار تسليم بضاعة وتوريد' : 'مستخلص جاري جديد', `${note} — ${app.fmtMoney(amount)} ج.م`);
        app.toast('تم الإرسال للفحص والاعتماد', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async respondAbstractOrSupply(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingAbstract) return;
      const ab = ag.pendingAbstract;
      if (!approve) {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingAbstract: null });
        return app.toast('تم إرسال الملاحظة للطرف الآخر', 'info');
      }
      if (Number(ag.remainingEscrow || 0) < Number(ab.amount)) return app.toast('الرصيد المتبقي بالضمان غير كافٍ', 'error');
      const payerRef = app.db.collection('users').doc(ag.payerUid);
      const workerRef = app.db.collection('users').doc(ag.createdBy);
      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        await app.db.runTransaction(async (tx) => {
          const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef), tx.get(agRef)]);
          const curRem = Number((aDoc.data() || {}).remainingEscrow || 0);
          if (curRem < ab.amount) throw new Error('الرصيد غير كافٍ');
          tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - ab.amount) * 100) / 100) });
          tx.update(workerRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + ab.amount) * 100) / 100 });
          tx.update(agRef, { remainingEscrow: Math.round((curRem - ab.amount) * 100) / 100, pendingAbstract: null, timeline: firebase.firestore.FieldValue.arrayUnion({ date: ab.date, kind: 'abstract_paid', label: `${ab.isSupply ? 'اعتماد توريد' : 'اعتماد مستخلص'}: ${ab.note}`, amount: ab.amount, by: app.profile?.name || '' }) });
        });
        app.toast('تم الاعتماد وتحرير المبلغ ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    openMovementModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      this.tempInvoicePhoto = '';
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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-sky-400">تسجيل حركة مالية / فاتورة خامات</h3><button onclick="document.getElementById('daman-chat-move-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanChat.submitMovement(event,'${agId}')" class="space-y-2.5">
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">نوع الحركة</label><select id="mv-kind" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 font-bold text-white"><option value="materials">عُهدة شراء خامات / بضاعة + إرفاق فاتورة</option>${isPayer ? `<option value="payout">صرف دفعة / راتب من الضمان لمحفظة المنفّذ</option>` : ''}<option value="deduction">تسجيل خصم / جزاء / تلفيات</option></select></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">المبلغ (ج.م)</label><input id="mv-amt" type="number" min="1" step="any" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 font-bold text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">البيان / السبب</label><input id="mv-note" type="text" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <label class="block p-2 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer"><span class="font-bold text-amber-300"><i class="fa-solid fa-receipt me-1"></i> صورة الفاتورة (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanChat.handleTempPhoto(this,'inv')" /><div id="mv-photo-prev"></div></label>
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
      const labels = { materials: 'شراء خامات / فاتورة', payout: 'صرف دفعة من الضمان', deduction: 'خصم / جزاء' };
      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        if (kind === 'payout' && ag.payerUid === app.user.uid) {
          if (Number(ag.remainingEscrow || 0) < amount) return app.toast('الرصيد المتبقي غير كافٍ', 'error');
          const payerRef = app.db.collection('users').doc(ag.payerUid);
          const workerRef = app.db.collection('users').doc(ag.createdBy);
          await app.db.runTransaction(async (tx) => {
            const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef), tx.get(agRef)]);
            const curRem = Number((aDoc.data() || {}).remainingEscrow || 0);
            if (curRem < amount) throw new Error('الرصيد غير كافٍ');
            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - amount) * 100) / 100) });
            tx.update(workerRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + amount) * 100) / 100 });
            tx.update(agRef, { remainingEscrow: Math.round((curRem - amount) * 100) / 100, timeline: firebase.firestore.FieldValue.arrayUnion({ date: new Date().toISOString().slice(0, 10), kind, label: `${labels[kind]} — ${note}`, amount, photoBase64: this.tempInvoicePhoto || '', by: app.profile?.name || '' }) });
          });
        } else {
          await agRef.update({ timeline: firebase.firestore.FieldValue.arrayUnion({ date: new Date().toISOString().slice(0, 10), kind, label: `${labels[kind]} — ${note}`, amount, photoBase64: this.tempInvoicePhoto || '', by: app.profile?.name || '' }) });
        }
        document.getElementById('daman-chat-move-modal').classList.add('hidden');
        app.toast('تم توثيق الحركة بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async confirmFinalHandover(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.payerUid !== app.user.uid) return;
      const rem = Number(ag.remainingEscrow || 0);
      if (!window.confirm(`تأكيد الاستلام النهائي وتحرير باقي المستحق (${app.fmtMoney(rem)} ج.م) وإغلاق الاتفاق؟`)) return;

      const payerRef = app.db.collection('users').doc(ag.payerUid);
      const workerRef = app.db.collection('users').doc(ag.createdBy);
      const agRef = app.db.collection('chatAgreements').doc(agId);

      try {
        await app.db.runTransaction(async (tx) => {
          const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(workerRef), tx.get(agRef)]);
          const a = aDoc.data();
          const curRem = Number(a.remainingEscrow || 0);
          const feeDiff = Math.max(0, Math.round((Number(a.lockedAmount || 0) - Number(a.totalAmount || 0)) * 100) / 100);
          tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - (curRem + feeDiff)) * 100) / 100) });
          tx.update(workerRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + curRem) * 100) / 100 });
          tx.update(agRef, { status: 'completed', remainingEscrow: 0, completedAt: firebase.firestore.FieldValue.serverTimestamp(), timeline: firebase.firestore.FieldValue.arrayUnion({ date: new Date().toISOString().slice(0, 10), kind: 'completed', label: 'تأكيد الاستلام النهائي وتصفية الحساب', amount: curRem, by: app.profile?.name || '' }) });
          if (Number(a.commissionFee || 0) > 0) {
            tx.set(app.db.collection('platformFees').doc(), { agreementId: agId, type: 'escrow_35', ticketNumber: a.ticketNumber, amount: Number(a.commissionFee || 0), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
          }
        });
        await app.db.collection('chats').doc(this.activeChatId).update({ hasActiveDeal: false }).catch(() => {});
        await app.sendNotification(ag.createdBy, `تم الاستلام النهائي وتصفية الاتفاق ${ag.ticketNumber} ✅`, `تم تحويل باقي المستحق (${app.fmtMoney(rem)} ج.م) لمحفظتك.`);
        app.toast('تم الاستلام النهائي وتحرير المستحقات ✅', 'success');
        // Open Auto-Rating Modal
        this.openAutoRatingModal(ag.createdBy, ag.createdByName, ag.title);
      } catch (e) { app.toast(e.message, 'error'); }
    },

    openAutoRatingModal(targetUid, targetName, title) {
      let modal = document.getElementById('daman-rate-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-rate-modal';
        modal.className = 'fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-2xl p-4 space-y-3 text-xs">
          <h3 class="text-sm font-black text-amber-400 text-center">⭐ قيّم تجربتك مع ${window.DamanApp.esc(targetName)}</h3>
          <p class="text-[11px] text-slate-300 text-center">بند العمل: ${window.DamanApp.esc(title)}</p>
          <form onsubmit="DamanChat.submitRating(event,'${targetUid}')" class="space-y-2.5">
            <select id="rt-stars" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-400 font-black text-center">
              <option value="5">★★★★★ (5 - ممتاز جداً)</option>
              <option value="4">★★★★☆ (4 - جيد جداً)</option>
              <option value="3">★★★☆☆ (3 - مقبول)</option>
              <option value="2">★★☆☆☆ (2 - ضعيف)</option>
              <option value="1">★☆☆☆☆ (1 - سيء)</option>
            </select>
            <textarea id="rt-comment" rows="2" required placeholder="اكتب رأيك في الجودة والالتزام بالمواعيد..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <div class="flex gap-2">
              <button type="submit" class="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إرسال التقييم</button>
              <button type="button" onclick="document.getElementById('daman-rate-modal').classList.add('hidden')" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold">تخطي</button>
            </div>
          </form>
        </div>`;
    },

    async submitRating(e, targetUid) {
      e.preventDefault();
      const app = window.DamanApp;
      const rating = parseInt(document.getElementById('rt-stars').value, 10) || 5;
      const comment = document.getElementById('rt-comment').value.trim();
      try {
        await app.db.collection('reviews').add({
          targetUserId: targetUid, fromUserId: app.user.uid, fromName: app.profile?.companyName || app.profile?.name || '',
          rating, comment, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const uRef = app.db.collection('users').doc(targetUid);
        await app.db.runTransaction(async (tx) => {
          const uDoc = await tx.get(uRef);
          if (!uDoc.exists) return;
          const d = uDoc.data();
          const oldC = Number(d.ratingCount || 0);
          const oldAvg = Number(d.ratingAvg || 0);
          const newC = oldC + 1;
          const newAvg = Math.round(((oldAvg * oldC + rating) / newC) * 10) / 10;
          tx.update(uRef, { ratingCount: newC, ratingAvg: newAvg });
        });
        document.getElementById('daman-rate-modal').classList.add('hidden');
        app.toast('شكراً لك! تم إضافة تقييمك بنجاح ⭐', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
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
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-amber-400">سجل الاتفاق (${app.esc(ag.ticketNumber)})</h3><button onclick="document.getElementById('daman-chat-tl-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          ${ms.length ? `<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1"><div class="font-extrabold text-sky-300">جدول الدفعات:</div>${ms.map((m) => `<div class="flex justify-between text-[11px]"><span>• ${app.esc(m.label)} (${app.esc(m.when)})</span><b class="text-emerald-400">${app.fmtMoney(m.amount)} ج.م</b></div>`).join('')}</div>` : ''}
          ${ag.signedContractBase64 ? `<div class="p-2 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-1"><div class="text-[11px] font-bold text-emerald-300">العقد الموقّع المرفوع:</div><img src="${ag.signedContractBase64}" onclick="window.open('${ag.signedContractBase64}','_blank')" class="w-full max-h-40 object-contain rounded cursor-pointer" /></div>` : ''}
          <div class="space-y-1.5">
            <div class="font-extrabold text-white">سجل الحركات (${tl.length}):</div>
            ${!tl.length ? '<div class="text-center text-slate-400 py-4">لا توجد حركات بعد</div>' : tl.slice().reverse().map((it) => `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                <div class="flex justify-between gap-2"><div><div class="font-bold text-white">${app.esc(it.label)}</div><div class="text-[10px] text-slate-400">${app.esc(it.date)} — ${app.esc(it.by || '')}</div></div><span class="font-black ${it.kind === 'deduction' || it.kind === 'cancelled' ? 'text-rose-400' : 'text-emerald-400'} shrink-0">${it.amount ? app.fmtMoney(it.amount) + ' ج.م' : ''}</span></div>
                ${it.photoBase64 ? `<img src="${it.photoBase64}" onclick="window.open('${it.photoBase64}','_blank')" class="max-h-32 rounded border border-slate-700 cursor-pointer" />` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    },

    printAgreementA4(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const win = window.open('', '_blank');
      if (!win) return app.toast('اسمح بالنوافذ المنبثقة للطباعة', 'warning');
      const d = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      const specDetail = ag.type === 'supply' ? `توريد: ${ag.unitQty} ${app.esc(ag.unitName || 'وحدة')} × ${app.fmtMoney(ag.unitPrice)} ج.م` : ag.type === 'meter' ? `بالمتر: ${ag.unitQty} متر × ${app.fmtMoney(ag.unitPrice)} ج.م` : ag.type === 'daily' ? `باليومية: ${ag.workers} عمال × ${app.fmtMoney(ag.dailyRate)} ج.م × ${ag.totalDays} أيام` : this.typeLabel(ag.type);
      const msHtml = (ag.milestones && ag.milestones.length) ? `<tr><th>جدول الدفعات</th><td colspan="3">${ag.milestones.map((m) => `• ${app.esc(m.label)} (${app.fmtMoney(m.amount)} ج.م)`).join('<br/>')}</td></tr>` : '';
      win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>عقد ضمان سايت ${ag.ticketNumber}</title><style>@page{size:A4 portrait;margin:13mm;}body{font-family:'Cairo',Tahoma,Arial,sans-serif;color:#000;background:#fff;margin:0;font-size:11.5px;line-height:1.6;}.box{border:2px solid #000;padding:16px 18px;}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}table{width:100%;border-collapse:collapse;margin-bottom:10px;}th,td{border:1px solid #000;padding:5px 7px;text-align:right;}th{background:#f2f2f2;width:22%;}.clauses{border:1px solid #000;padding:8px 10px;margin:10px 0;font-size:11px;}.verify{border:1px dashed #000;padding:6px;text-align:center;font-weight:700;margin-bottom:10px;}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;text-align:center;}.sig{border:1px solid #000;padding:8px 8px 44px;font-weight:700;}.btn{display:block;margin:10px auto;padding:8px 24px;background:#000;color:#fff;border:none;font-weight:700;cursor:pointer;}@media print{.btn{display:none;}}</style></head><body><button class="btn" onclick="window.print()">طباعة العقد نسختين (A4 PDF)</button><div class="box"><div class="hdr"><div><h2 style="margin:0">عقد اتفاق وتعاقد رسمي — ضمان سايت</h2><div>DamanSite Official Contract</div></div><div><div><b>كود التحقق:</b> ${ag.ticketNumber}</div><div><b>التاريخ:</b> ${d}</div></div></div><div class="verify">للتحقق من صحة هذا العقد أدخل الكود (${ag.ticketNumber}) في أداة «فحص عقد» داخل تطبيق ضمان سايت</div><table><tr><th>الطرف الأول</th><td>${app.esc(ag.payerName || ag.otherName)}</td><th>الرقم القومي</th><td>${app.esc(ag.payerNationalId || 'موثّق')}</td></tr><tr><th>الطرف الثاني</th><td>${app.esc(ag.createdByName)}</td><th>الرقم القومي</th><td>${app.esc(ag.createdByNationalId || 'موثّق')}</td></tr></table><table><tr><th>بند العمل</th><td colspan="3"><b>${app.esc(ag.title)}</b></td></tr><tr><th>التفاصيل</th><td colspan="3">${specDetail}</td></tr>${msHtml}<tr><th>إجمالي الاتفاق</th><td><b>${app.fmtMoney(ag.totalAmount)} ج.م</b></td><th>عمولة الضمان (3.5%)</th><td>${app.fmtMoney(ag.commissionFee)} ج.م</td></tr></table><div class="clauses">1. يُطبع العقد نسختين وتُرفع صورة العقد الموقّع في الشات لتفعيل الضمان.<br/>2. أي تعديل أو فسخ يتم بموافقة الطرفين أو بفصل إدارة ضمان سايت عند النزاع.</div><div class="sigs"><div class="sig">توقيع الطرف الأول</div><div class="sig">توقيع الطرف الثاني</div></div></div></body></html>`);
      win.document.close();
    },

    // ==================== AI & TICKETS ====================
    getAiReply(rawText, isAr) {
      const q = (rawText || '').toLowerCase();
      if (/مورد|توريد|خامات|b2b/.test(q)) return { text: isAr ? '🚚 افتح محادثة مع المورّد واضغط **«اتفاق»** ← اختر **«توريد خامات / بضاعة»**.' : '🚚 Use B2B Supply Escrow inside any chat.', action: null };
      if (/3x|ثلاث|استلام|شدة|سقف/.test(q)) return { text: isAr ? '🛡️ نستلم الشدات والأسقف والمحارة بضمان مادي يصل لـ **3 أضعاف قيمة الخدمة**.' : '🛡️ 3x Financial Warranty.', action: { label: isAr ? 'اطلب استلام 3x' : 'Request 3x', fn: "if(window.DamanProjects) DamanProjects.setSubTab('inspection'); DamanApp.switchTab('projects')" } };
      return { text: isAr ? 'تقدر تسألني عن الموردين B2B، الضمان 3 أضعاف، اليوميات، أو تتواصل مع **إدارة ضمان سايت**.' : 'Ask about B2B Suppliers, 3x Guarantee, or chat with Admin.', action: { label: isAr ? 'كلّم الإدارة مباشرة' : 'Chat with Admin', fn: "DamanChat.openDirectChat('admin','إدارة ضمان سايت')" } };
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
        await app.db.collection('supportTickets').add({ userId: app.user.uid, userName: app.profile.companyName || app.profile.name || '', userEmail: app.profile.email || app.user.email || '', subject: subj, message: document.getElementById('tk-message').value.trim(), status: 'open', adminReply: '', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        await app.sendNotification('ADMIN', 'تذكرة دعم جديدة', subj);
        e.target.reset();
        app.toast('تم إرسال تذكرة الدعم بنجاح', 'success');
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
      // Hide agreements bar in pure Admin Support chats
      if (this.activeChatMeta?.otherUid === 'admin' || (app.isAdmin() && !this.agreements.length)) return '';
      if (!this.agreements.length) return '';
      const ag = this.agreements[0];
      const myUid = app.user?.uid;
      const isCreator = ag.createdBy === myUid;
      const isPayer = ag.payerUid === myUid || (!ag.payerUid && !isCreator);
      const covPct = Number(ag.coveragePercent || 0);

      let covDetail = '';
      if (ag.status === 'active') {
        if ((ag.type === 'meter' || ag.type === 'supply') && ag.unitPrice > 0) {
          const coveredUnits = Math.min(ag.unitQty, Math.floor(Number(ag.remainingEscrow || 0) / ag.unitPrice));
          covDetail = `تغطية الرصيد: ${covPct}% (${coveredUnits} من ${ag.unitQty} ${app.esc(ag.unitName || 'وحدة')})`;
        } else if (ag.type === 'daily' && ag.dailyCost > 0) {
          const coveredDays = Math.floor(Number(ag.remainingEscrow || 0) / ag.dailyCost);
          covDetail = coveredDays < 1 ? '⚠️ الرصيد لا يغطي الغد — وقف عمل لحين الشحن' : `تغطية الرصيد: ${covPct}% (يغطي ${coveredDays} يوم)`;
        } else {
          covDetail = `تغطية الرصيد: ${covPct}% (المتبقي بالضمان: ${app.fmtMoney(ag.remainingEscrow)} ج.م)`;
        }
      }

      const csHtml =
        ag.contractStatus === 'approved' ? `<span class="text-[10px] font-black text-emerald-300">✅ العقد الموقّع معتمد والضمان مفعّل</span>`
        : ag.contractStatus === 'pending_admin' ? `<span class="text-[10px] font-bold text-amber-300">⏳ تم رفع العقد الموقّع — بانتظار اعتماد الإدارة</span>`
        : ag.contractStatus === 'rejected' ? `<span class="text-[10px] font-bold text-rose-300">❌ تم رفض الصورة — يرجى إعادة رفع العقد الموقّع</span>`
        : `<span class="text-[10px] font-bold text-amber-200">📄 شرط الضمان: اطبع العقد نسختين، وقّعهما، وارفع الصورة هنا</span>`;

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
              ${isPayer && covPct < 100 ? `<button onclick="DamanChat.topUpAgreementCoverage('${ag.id}')" class="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black shrink-0">+ تعزيز</button>` : ''}
            </div>

            <div class="p-2 rounded-xl bg-slate-950/90 border border-slate-700 space-y-1.5">
              <div>${csHtml}</div>
              <div class="grid grid-cols-2 gap-1.5">
                <button onclick="DamanChat.printAgreementA4('${ag.id}')" class="py-1.5 rounded-lg bg-white text-slate-950 font-black text-[10px]"><i class="fa-solid fa-print me-1"></i>طباعة العقد (نسختين)</button>
                <label class="py-1.5 rounded-lg ${ag.signedContractBase64 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500 text-slate-950'} font-black text-[10px] text-center cursor-pointer">
                  <i class="fa-solid fa-upload me-1"></i>${ag.signedContractBase64 ? 'تحديث صورة العقد' : 'رفع العقد الموقّع'}
                  <input type="file" accept="image/*" class="hidden" onchange="DamanChat.uploadSignedContract('${ag.id}', this)" />
                </label>
              </div>
            </div>

            ${ag.pendingTermination ? `<div class="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500 space-y-1.5 text-[10px]"><div class="font-black text-rose-300">⚠️ طلب فسخ العقد من ${app.esc(ag.pendingTermination.proposedByName)}</div><div class="text-white">${app.esc(ag.pendingTermination.reason)} — للمنفّذ ${app.fmtMoney(ag.pendingTermination.workerShare)} | للعميل ${app.fmtMoney(ag.pendingTermination.clientRefund)}</div>${ag.pendingTermination.proposedByUid !== myUid ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondTermination('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة وتصفية</button><button onclick="DamanChat.respondTermination('${ag.id}',false)" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black">رفض وتحويل لنزاع</button></div>` : `<div class="text-slate-300">بانتظار رد الطرف الآخر...</div>`}</div>` : ''}
            ${ag.pendingAdvance ? `<div class="p-2 rounded-xl bg-amber-500/15 border border-amber-500/50 space-y-1.5 text-[10px]"><div class="font-bold text-amber-200">💰 طلب سلفة (${app.fmtMoney(ag.pendingAdvance.amount)} ج.م) — ${app.esc(ag.pendingAdvance.reason)}</div>${isPayer ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondAdvance('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة وصرف</button><button onclick="DamanChat.respondAdvance('${ag.id}',false)" class="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black">رفض</button></div>` : `<div class="text-slate-300">بانتظار الموافقة...</div>`}</div>` : ''}
            ${ag.pendingAmendment ? `<div class="p-2 rounded-xl bg-purple-500/15 border border-purple-500/50 space-y-1.5 text-[10px]"><div class="font-bold text-purple-200">📝 طلب تعديل: ${app.fmtMoney(ag.pendingAmendment.newTotal)} ج.م (${app.esc(ag.pendingAmendment.note)})</div>${ag.pendingAmendment.proposedByUid !== myUid ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondAmendment('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة</button><button onclick="DamanChat.respondAmendment('${ag.id}',false)" class="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black">رفض</button></div>` : `<div class="text-slate-300">بانتظار الموافقة...</div>`}</div>` : ''}
            ${ag.pendingAbstract ? `<div class="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/50 space-y-1.5 text-[10px]"><div class="font-bold text-emerald-200">${ag.pendingAbstract.isSupply ? '🚚 تسليم توريد' : '📑 مستخلص جاري'}: ${app.esc(ag.pendingAbstract.note)} (${app.fmtMoney(ag.pendingAbstract.amount)} ج.م)</div>${isPayer ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondAbstractOrSupply('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">اعتماد وصرف</button><button onclick="DamanChat.respondAbstractOrSupply('${ag.id}',false)" class="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black">نقص/رفض</button></div>` : `<div class="text-slate-300">بانتظار الفحص...</div>`}</div>` : ''}
            ${ag.pendingDayLog ? `<div class="p-2 rounded-xl bg-sky-500/15 border border-sky-500/40 space-y-1.5 text-[10px]"><div class="font-bold text-sky-200">👷 حضور اليوم: <b>${ag.pendingDayLog.actualWorkers} عامل</b></div>${isPayer ? `<div class="flex gap-1.5"><button onclick="DamanChat.clientApproveActualDay('${ag.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">اعتماد</button><button onclick="DamanChat.clientRejectActualDay('${ag.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold">مراجعة</button></div>` : `<div class="text-slate-300">بانتظار الاعتماد...</div>`}</div>` : ''}

            <div class="grid grid-cols-3 gap-1">
              ${isCreator && ag.type === 'daily' && !ag.pendingDayLog ? `<button onclick="DamanChat.openDailyLogModal('${ag.id}')" class="py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[9.5px]">تأكيد عمال اليوم</button>` : ''}
              ${isCreator && (ag.type === 'supply' || ag.type === 'meter') && !ag.pendingAbstract ? `<button onclick="DamanChat.submitRunningAbstractOrSupply('${ag.id}')" class="py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[9.5px]">${ag.type === 'supply' ? 'إشعار تسليم بضاعة' : 'رفع مستخلص جاري'}</button>` : ''}
              ${isCreator && !ag.pendingAdvance ? `<button onclick="DamanChat.requestAdvance('${ag.id}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[9.5px]">طلب سلفة</button>` : ''}
              <button onclick="DamanChat.openMovementModal('${ag.id}')" class="py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[9.5px]">فواتير / صرف</button>
              ${!ag.pendingAmendment ? `<button onclick="DamanChat.proposeAmendment('${ag.id}')" class="py-1.5 rounded-lg bg-purple-500/20 text-purple-300 font-bold text-[9.5px]">تعديل الاتفاق</button>` : ''}
              <button onclick="DamanChat.openTimelineModal('${ag.id}')" class="py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold text-[9.5px]">السجل (${(ag.timeline || []).length})</button>
              ${!ag.pendingTermination ? `<button onclick="DamanChat.requestTermination('${ag.id}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[9.5px]">إنهاء / فسخ العقد</button>` : ''}
              ${isPayer ? `<button onclick="DamanChat.confirmFinalHandover('${ag.id}')" class="col-span-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">✓ تأكيد الاستلام النهائي وتصفية باقي الحساب</button>` : ''}
            </div>
          ` : ag.status === 'proposed' ? `
            <div class="flex gap-1.5">
              ${!isCreator ? `<button onclick="DamanChat.acceptAgreement('${ag.id}')" class="flex-1 py-2 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">موافقة وحجز الضمان (${app.fmtMoney(ag.grandTotalWithFee)} ج.م)</button>` : `<button onclick="DamanChat.cancelProposedAgreement('${ag.id}')" class="flex-1 py-2 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px]">إلغاء العرض</button>`}
              <button onclick="DamanChat.printAgreementA4('${ag.id}')" class="px-3 py-2 rounded-lg bg-white text-slate-950 font-black text-[10px]">معاينة العقد</button>
            </div>
          ` : ag.status === 'cancelled' ? `
            <div class="flex items-center justify-between text-[10px] text-rose-300 font-bold"><span>❌ تم فسخ العقد وتصفية المستحقات</span><button onclick="DamanChat.openTimelineModal('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white">السجل</button></div>
          ` : ag.status === 'disputed' ? `
            <div class="flex items-center justify-between text-[10px] text-amber-300 font-bold"><span>⚖️ العقد قيد النزاع أمام الإدارة</span><button onclick="DamanChat.openTimelineModal('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white">السجل</button></div>
          ` : `
            <div class="flex items-center justify-between text-[10px] text-emerald-300 font-bold"><span>✅ تم تنفيذ وتصفية الاتفاق بالكامل</span><button onclick="DamanChat.openTimelineModal('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white">عرض السجل</button></div>
          `}
        </div>`;
    },

    renderChatRoom(app) {
      const isAr = app.lang === 'ar';
      const meta = this.activeChatMeta || {};
      const isFrozen = !!meta.frozen;
      const isSupportChat = meta.otherUid === 'admin';
      const iBlocked = (this.activeChatDoc?.blockedBy || []).includes(app.user?.uid);

      return `
        <div class="space-y-2">
          <div class="glass-card rounded-2xl p-2.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <button onclick="DamanChat.closeActiveChat()" class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                <i class="fa-solid fa-arrow-${isAr ? 'right' : 'left'}"></i>
              </button>
              <div class="min-w-0">
                <div class="text-xs font-black text-white truncate">${app.esc(meta.otherName || 'Chat')}</div>
                <div class="text-[9.5px] text-emerald-400 font-bold truncate">${this.formatPeerStatus()}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${!isSupportChat ? `<button onclick="DamanChat.openAgreementModal()" class="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black"><i class="fa-solid fa-file-signature me-1"></i>اتفاق</button>` : ''}
              <button onclick="DamanChat.startVoiceCall()" class="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center"><i class="fa-solid fa-phone"></i></button>
              ${!isSupportChat ? `<button onclick="DamanChat.toggleBlockPeer()" title="${iBlocked ? 'فك الحظر' : 'حظر'}" class="w-8 h-8 rounded-xl ${iBlocked ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'} flex items-center justify-center"><i class="fa-solid fa-ban text-xs"></i></button>` : ''}
            </div>
          </div>

          ${isFrozen ? `<div class="p-2 rounded-xl bg-rose-500/20 border border-rose-500/50 text-center text-[11px] font-bold text-rose-200"><i class="fa-solid fa-lock me-1"></i> تم تجميد هذه المحادثة من الإدارة</div>` : ''}
          ${this.renderCallBanner(app)}
          ${this.renderAgreementsBar(app)}

          <div id="chat-msgs-scroll" class="glass-card rounded-2xl p-3 space-y-2 h-[285px] overflow-y-auto">
            ${!this.messages.length
              ? `<div class="text-center text-xs text-slate-400 py-10">ابدأ المحادثة...</div>`
              : this.messages.map((m) => {
                  const mine = app.user && m.senderId === app.user.uid;
                  const adminMsg = !!m.isAdminIntervention;
                  return `
                    <div class="flex ${adminMsg ? 'justify-center' : mine ? 'justify-end' : 'justify-start'}">
                      <div class="max-w-[85%] rounded-2xl px-3 py-2 text-xs space-y-1 ${adminMsg ? 'bg-purple-900/80 border border-amber-400 text-amber-100' : mine ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-white border border-slate-700'}">
                        <div class="flex items-center justify-between gap-2">
                          ${adminMsg ? `<span class="text-[9px] text-amber-300 font-black">👑 تدخل الإدارة</span>` : (!mine ? `<span class="text-[9px] text-amber-300 font-extrabold">${app.esc(m.senderName || '')}</span>` : '<span></span>')}
                          <button onclick="DamanChat.setReply('${m.id}')" class="text-[9px] opacity-60 hover:opacity-100" title="رد على الرسالة"><i class="fa-solid fa-reply"></i></button>
                        </div>
                        ${m.replyTo ? `<div class="p-1.5 rounded-lg bg-black/20 border-s-2 border-white/60 text-[10px] opacity-90 truncate"><b>${app.esc(m.replyTo.senderName)}:</b> ${app.esc(m.replyTo.text)}</div>` : ''}
                        ${m.imageBase64 ? `<img src="${m.imageBase64}" onclick="window.open('${m.imageBase64}','_blank')" class="max-h-44 rounded-xl border border-black/20 cursor-pointer" />` : ''}
                        ${m.videoBase64 ? `<video controls src="${m.videoBase64}" class="max-h-44 rounded-xl w-full"></video>` : ''}
                        ${m.fileBase64 ? `<a href="${m.fileBase64}" download="${app.esc(m.fileName || 'file')}" class="inline-flex items-center gap-1.5 p-2 rounded-xl bg-black/20 underline font-black text-[11px]"><i class="fa-solid fa-file-arrow-down"></i> ${app.esc(m.fileName || 'ملف مرفق')}</a>` : ''}
                        ${m.audioBase64 ? `<audio controls src="${m.audioBase64}" class="w-48 h-8"></audio>` : ''}
                        ${m.location ? `<a href="https://maps.google.com/?q=${m.location.lat},${m.location.lng}" target="_blank" class="inline-flex items-center gap-1 underline font-black"><i class="fa-solid fa-location-dot"></i> فتح الموقع على خرائط جوجل</a>` : ''}
                        ${m.text ? `<div class="leading-relaxed whitespace-pre-line">${app.esc(m.text)}</div>` : ''}
                        ${mine ? `<div class="text-end text-[9px] ${m.read ? 'text-sky-900 font-black' : 'opacity-60'}">${m.read ? '✓✓ تم القراءة' : '✓'}</div>` : ''}
                      </div>
                    </div>`;
                }).join('')}
          </div>

          ${this.replyingTo ? `
            <div class="px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-between text-[10px] text-slate-300">
              <span class="truncate"><i class="fa-solid fa-reply text-amber-400 me-1"></i>الرد على <b>${app.esc(this.replyingTo.senderName)}:</b> ${app.esc(this.replyingTo.text)}</span>
              <button onclick="DamanChat.replyingTo=null; DamanChat.rerender()" class="text-rose-400 ms-2"><i class="fa-solid fa-xmark"></i></button>
            </div>` : ''}

          <form onsubmit="DamanChat.sendChatMessage(event)" class="flex items-center gap-1">
            <label class="w-8 h-8 shrink-0 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center cursor-pointer" title="صورة">
              <i class="fa-solid fa-image text-xs"></i>
              <input type="file" accept="image/*" class="hidden" onchange="DamanChat.sendChatImage(this)" />
            </label>
            <label class="w-8 h-8 shrink-0 rounded-xl bg-slate-800 text-purple-400 flex items-center justify-center cursor-pointer" title="ملف أو فيديو قصير">
              <i class="fa-solid fa-paperclip text-xs"></i>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,video/*" class="hidden" onchange="DamanChat.sendChatFileOrVideo(this)" />
            </label>
            <button type="button" onclick="DamanChat.sendLocation()" class="w-8 h-8 shrink-0 rounded-xl bg-slate-800 text-sky-400 flex items-center justify-center" title="لوكيشن GPS">
              <i class="fa-solid fa-location-dot text-xs"></i>
            </button>
            <button type="button" onclick="DamanChat.toggleVoiceNote()" class="w-8 h-8 shrink-0 rounded-xl ${this.isRecordingVoice ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800 text-emerald-400'} flex items-center justify-center" title="رسالة صوتية">
              <i class="fa-solid ${this.isRecordingVoice ? 'fa-stop' : 'fa-microphone'} text-xs"></i>
              ${this.isRecordingVoice ? `<span id="voice-rec-sec" class="text-[8px] ms-0.5">${this.voiceSeconds}s</span>` : ''}
            </button>
            <input id="chat-msg-input" oninput="DamanChat.onTypingInput()" type="text" placeholder="اكتب رسالتك..." class="flex-1 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
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
                const isUnread = c.lastSenderId && c.lastSenderId !== app.user.uid && !c.lastReadByPeer;
                return `
                  <div onclick="DamanChat.openChatRoom('${c.id}',{id:'${c.id}',otherUid:'${otherUid}',otherName:'${app.esc(otherName).replace(/'/g, "\\'")}',projectTitle:'${app.esc(c.projectTitle || '').replace(/'/g, "\\'")}',frozen:${!!c.frozen}})"
                    class="glass-card rounded-2xl p-3 flex items-center gap-3 cursor-pointer ${isUnread ? 'border-amber-500/70 bg-amber-500/5' : 'hover:border-amber-500/40'}">
                    <div class="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center font-black text-sm shrink-0">${app.esc(otherName.charAt(0).toUpperCase())}</div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-1">
                        <div class="text-xs font-extrabold text-white truncate">${app.esc(otherName)} ${c.frozen ? '🔒' : ''}</div>
                        <div class="flex items-center gap-1 shrink-0">
                          ${c.hasActiveDeal ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black">عقد نشط</span>` : ''}
                          ${isUnread ? `<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>` : ''}
                        </div>
                      </div>
                      <div class="text-[11px] ${isUnread ? 'text-white font-bold' : 'text-slate-400'} truncate mt-0.5">${app.esc(c.lastMessage || '')}</div>
                    </div>
                  </div>`;
              }).join('')}</div>`}
        </div>`;
    },

    renderAiTab(app) {
      const quickChips = ['توريد الموردين B2B', 'الضمان المادي 3 أضعاف', 'فسخ العقد والتصفية', 'كلّم الإدارة'];
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
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">${quickChips.map((q) => `<button type="button" onclick="DamanChat.askAi('${q}')" class="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-200">${q}</button>`).join('')}</div>
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
          ${this.tickets.map((t) => `<div class="glass-card rounded-2xl p-3 space-y-1"><div class="flex justify-between text-xs font-extrabold"><span class="text-white">${app.esc(t.subject)}</span><span class="text-[10px] text-amber-300">${app.esc(t.status)}</span></div><p class="text-[11px] text-slate-300">${app.esc(t.message)}</p>${t.adminReply ? `<div class="p-2 rounded-lg bg-emerald-500/10 text-[11px] text-emerald-200"><b>رد الإدارة:</b> ${app.esc(t.adminReply)}</div>` : ''}</div>`).join('')}
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

  // Auto-start global presence & incoming call listener as soon as user logs in
  setInterval(() => {
    if (window.DamanApp && window.DamanApp.user && ChatMod.attachedUid !== window.DamanApp.user.uid) {
      ChatMod.ensureListeners(window.DamanApp);
    }
  }, 2000);
})();
