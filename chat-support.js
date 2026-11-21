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
    selectedAgId: null,
    aiHistory: [],
    replyingTo: null,
    attachedUid: null,

    // Firestore Unsubscribers
    unsubChats: null,
    unsubChatDoc: null,
    unsubPeer: null,
    unsubMsgs: null,
    unsubAgreements: null,
    unsubTickets: null,
    unsubCall: null,
    unsubGlobalCall: null,
    unsubGlobalCallAdmin: null,
    unsubIceCand: null,

    presenceTimer: null,
    typingTimeout: null,
    lastMsgCount: 0,

    // Ringtone & Sound Engine
    ringInterval: null,
    ringTimeout: null,
    audioCtx: null,

    // Voice Note Recorder
    isRecordingVoice: false,
    voiceRecorder: null,
    voiceChunks: [],
    voiceSeconds: 0,
    voiceTimer: null,

    // WebRTC Voice Call State
    callState: null, // { callId, status, isCaller, otherName, muted }
    incomingGlobalCall: null,
    pc: null,
    localStream: null,
    remoteStream: null,
    callRecorder: null,
    callRecChunks: [],
    callStartTime: 0,

    // Temp Modal Photos
    tempDayPhoto: '',
    tempInvoicePhoto: '',
    tempDeductPhoto: '',

    // ==================== SOUND ENGINE ====================
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

    playTone(f1, f2, durMs) {
      try {
        const ctx = this.getAudioCtx();
        if (!ctx) return;
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.frequency.value = f1;
        o2.frequency.value = f2;
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
          this.playTone(523, 659, 300);
          setTimeout(() => this.playTone(523, 659, 300), 400);
        } else {
          this.playTone(440, 480, 700);
        }
      };
      beat();
      this.ringInterval = setInterval(beat, 2200);
    },

    stopRingtone() {
      if (this.ringInterval) { clearInterval(this.ringInterval); this.ringInterval = null; }
      if (this.ringTimeout) { clearTimeout(this.ringTimeout); this.ringTimeout = null; }
    },

    playMsgDing() {
      this.playTone(880, 1175, 110);
    },

    // ==================== GLOBAL BOOT (PRESENCE + FLOATING CALLS INCLUDING ADMIN) ====================
    initAiWelcome() {
      if (this.aiHistory.length) return;
      this.aiHistory.push({
        sender: 'ai',
        text: 'أهلاً بك في الدعم الذكي لـ «ضمان سايت» 🏗️\nاسألني عن الضمان المالي 100%، تمديد العقود، توريد الموردين B2B، الاستلام الهندسي بضمان 3 أضعاف (3x)، أو التواصل مع الإدارة.'
      });
    },

    ensureListeners(app) {
      this.initAiWelcome();
      if (!app.user) {
        this.detachListeners();
        return;
      }
      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      // 1. Presence Heartbeat
      const beatPresence = () => {
        if (app.user) {
          app.db.collection('users').doc(app.user.uid).update({ lastSeen: Date.now() }).catch(() => {});
        }
      };
      beatPresence();
      this.presenceTimer = setInterval(beatPresence, 60000);

      // 2. Global Incoming Call Listener (User UID + 'ADMIN' if admin)
      const handleIncomingSnap = (snap, docKey) => {
        if (!snap.exists) {
          if (this.incomingGlobalCall && this.incomingGlobalCall._docKey === docKey) {
            this.incomingGlobalCall = null;
            this.stopRingtone();
            this.renderGlobalCallOverlay();
          }
          return;
        }
        const d = snap.data();
        const ageMs = Date.now() - Number(d.startedAtMs || Date.now());
        if (d.status === 'ringing' && d.callerId !== app.user.uid && !this.callState && ageMs < 45000) {
          this.incomingGlobalCall = Object.assign({ _docKey: docKey }, d);
          this.startRingtone(true);
          this.renderGlobalCallOverlay();
        } else if (this.incomingGlobalCall && this.incomingGlobalCall._docKey === docKey) {
          this.incomingGlobalCall = null;
          this.stopRingtone();
          this.renderGlobalCallOverlay();
        }
      };

      this.unsubGlobalCall = app.db.collection('incomingCalls').doc(app.user.uid)
        .onSnapshot((s) => handleIncomingSnap(s, app.user.uid), () => {});

      if (app.isAdmin()) {
        this.unsubGlobalCallAdmin = app.db.collection('incomingCalls').doc('ADMIN')
          .onSnapshot((s) => handleIncomingSnap(s, 'ADMIN'), () => {});
      }

      // 3. Chats List
      const lookupIds = app.hasAdminAccess() ? [app.user.uid, 'admin'] : [app.user.uid];
      this.unsubChats = app.db
        .collection('chats')
        .where('participants', 'array-contains-any', lookupIds)
        .limit(45)
        .onSnapshot((snap) => {
          this.chats = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
          this.updateChatNavBadge(app);
          if (app.activeTab === 'chat' && !this.activeChatId) this.rerender();
        }, () => {});

      // 4. Support Tickets
      const tq = app.hasAdminAccess()
        ? app.db.collection('supportTickets').limit(40)
        : app.db.collection('supportTickets').where('userId', '==', app.user.uid).limit(20);

      this.unsubTickets = tq.onSnapshot((snap) => {
        this.tickets = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'chat' && this.subTab === 'tickets') this.rerender();
      }, () => {});
    },

    updateChatNavBadge(app) {
      const badge = document.getElementById('daman-chat-unread-badge');
      if (!badge || !app.user) return;
      const unread = this.chats.filter((c) => c.lastSenderId && c.lastSenderId !== app.user.uid && !c.lastReadByPeer).length;
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
        box.className = 'fixed inset-x-3 top-3 z-[122] max-w-md mx-auto bg-gradient-to-r from-emerald-900 to-slate-900 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-2xl';
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
              <div class="text-[10px] text-amber-300">مكالمة مسجّلة لحفظ الحقوق (30 يوم)</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="DamanChat.acceptGlobalCall()" class="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">رد</button>
            <button onclick="DamanChat.rejectGlobalCall()" class="px-3 py-2 rounded-xl bg-rose-500 text-white font-black text-xs">رفض</button>
          </div>
        </div>`;
    },

    // Immediate getUserMedia inside click gesture (prevents mobile browser mic block!)
    async acceptGlobalCall() {
      const c = this.incomingGlobalCall;
      if (!c) return;
      const app = window.DamanApp;
      this.stopRingtone();
      this.incomingGlobalCall = null;
      this.renderGlobalCallOverlay();

      let preStream = null;
      try {
        preStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        return app.toast('يرجى السماح بصلاحية الميكروفون للرد على المكالمة', 'error');
      }

      app.db.collection('incomingCalls').doc(c._docKey || app.user.uid).delete().catch(() => {});
      this.subTab = 'chats';
      app.switchTab('chat');
      this.openChatRoom(c.chatId, { id: c.chatId, otherUid: c.callerId, otherName: c.callerName });
      await this.answerVoiceCall(preStream);
    },

    async rejectGlobalCall() {
      const app = window.DamanApp;
      const c = this.incomingGlobalCall;
      this.stopRingtone();
      this.incomingGlobalCall = null;
      this.renderGlobalCallOverlay();
      if (c && app.user) {
        app.db.collection('incomingCalls').doc(c._docKey || app.user.uid).delete().catch(() => {});
        app.db.collection('chats').doc(c.chatId).collection('calls').doc('active').update({ status: 'ended' }).catch(() => {});
      }
    },

    detachListeners() {
      ['unsubChats', 'unsubChatDoc', 'unsubPeer', 'unsubMsgs', 'unsubAgreements', 'unsubTickets', 'unsubCall', 'unsubGlobalCall', 'unsubGlobalCallAdmin', 'unsubIceCand'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      if (this.presenceTimer) { clearInterval(this.presenceTimer); this.presenceTimer = null; }
      this.stopRingtone();
      this.cleanupCallLocal(false);
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

    // ==================== OPEN & MANAGE CHAT ROOM (NO KEYBOARD CLOSING!) ====================
    async openDirectChat(targetUid, targetName, projectId = '', projectTitle = '') {
      const app = window.DamanApp;
      if (!app.user || !app.profile) {
        app.toast('سجّل الدخول أولاً لبدء المحادثة', 'warning');
        return app.openAuthModal('login');
      }
      if (!app.isKycVerified()) {
        app.toast('يجب توثيق الحساب بالبطاقة والسيلفي أولاً', 'warning');
        return;
      }

      const myUid = app.user.uid;
      const cleanTarget = !targetUid || String(targetUid).startsWith('demo_') ? 'admin' : targetUid;
      if (cleanTarget === myUid) return app.toast('لا يمكنك مراسلة نفسك', 'info');

      const pair = [myUid, cleanTarget].sort();
      const chatId = pair[0] + '_' + pair[1];
      const chatRef = app.db.collection('chats').doc(chatId);

      try {
        const snap = await chatRef.get();
        const myName = app.profile.companyName || app.profile.name || app.user.email;
        const otherLabel = cleanTarget === 'admin' ? 'إدارة ضمان سايت' : (targetName || 'مستخدم ضمان سايت');

        if (!snap.exists) {
          const names = {};
          names[myUid] = myName;
          names[cleanTarget] = otherLabel;
          await chatRef.set({
            participants: pair,
            participantNames: names,
            isAdminSupportChat: cleanTarget === 'admin',
            projectId: projectId || '',
            projectTitle: projectTitle || '',
            frozen: false,
            blockedBy: [],
            hasActiveDeal: false,
            lastMessage: projectTitle ? `استفسار بخصوص: ${projectTitle}` : '',
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
          isAdminSupportChat: cleanTarget === 'admin',
          projectTitle: projectTitle || (snap.exists ? snap.data().projectTitle : ''),
          frozen: snap.exists ? !!snap.data().frozen : false
        });
      } catch (err) { app.toast(err.message, 'error'); }
    },

    isPureSupportChat() {
      const app = window.DamanApp;
      if (this.activeChatDoc?.isAdminSupportChat) return true;
      if (this.activeChatMeta?.otherUid === 'admin') return true;
      if (this.activeChatId && this.activeChatId.includes('admin_')) return true;
      if (app.isAdmin() && this.activeChatDoc && (this.activeChatDoc.participants || []).includes('admin')) return true;
      return false;
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
      this.selectedAgId = null;
      this.lastMsgCount = 0;

      ['unsubChatDoc', 'unsubPeer', 'unsubMsgs', 'unsubAgreements', 'unsubCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });

      try { history.pushState({ chatRoom: chatId }, ''); } catch (e) {}

      // Render shell ONCE (subsequent updates patch inner slots without destroying input/keyboard)
      this.rerender();

      this.unsubChatDoc = app.db.collection('chats').doc(chatId).onSnapshot((snap) => {
        if (!snap.exists) return;
        const d = snap.data();
        this.activeChatDoc = d;
        this.activeChatMeta.frozen = !!d.frozen;
        const other = (d.participants || []).find((x) => x !== app.user.uid && !(app.isAdmin() && x === 'admin')) || 'admin';
        this.activeChatMeta.otherUid = other;
        if (!this.activeChatMeta.otherName && d.participantNames) {
          this.activeChatMeta.otherName = d.participantNames[other] || (other === 'admin' ? 'إدارة ضمان سايت' : other);
        }
        if (other && other !== 'admin' && !this.unsubPeer) {
          this.unsubPeer = app.db.collection('users').doc(other).onSnapshot((uSnap) => {
            if (uSnap.exists) {
              this.peerProfile = uSnap.data();
              this.updatePeerStatusDOM();
            }
          }, () => {});
        }
        if (d.lastSenderId && d.lastSenderId !== app.user.uid && !d.lastReadByPeer) {
          app.db.collection('chats').doc(chatId).update({ lastReadByPeer: true }).catch(() => {});
        }
        this.updatePeerStatusDOM();
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

          newMsgs.filter((m) => m.senderId !== app.user.uid && !m.read).forEach((m) => {
            app.db.collection('chats').doc(chatId).collection('messages').doc(m.id).update({ read: true }).catch(() => {});
          });
          this.updateMessagesDOM();
        }, () => {});

      this.unsubAgreements = app.db
        .collection('chatAgreements').where('chatId', '==', chatId)
        .onSnapshot((snap) => {
          this.agreements = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (!this.selectedAgId || !this.agreements.some((a) => a.id === this.selectedAgId)) {
            const activeOne = this.agreements.find((a) => ['active', 'proposed_funded', 'proposed', 'disputed', 'retention_hold'].includes(a.status));
            this.selectedAgId = activeOne ? activeOne.id : (this.agreements[0]?.id || null);
          }
          this.updateAgreementsDOM();
        }, () => {});

      this.unsubCall = app.db
        .collection('chats').doc(chatId).collection('calls').doc('active')
        .onSnapshot((snap) => {
          if (!snap.exists) {
            if (this.callState) this.cleanupCallLocal(true);
            return;
          }
          const data = snap.data();
          if (data.status === 'ringing' && data.callerId !== app.user.uid && !this.callState) {
            const age = Date.now() - Number(data.startedAtMs || Date.now());
            if (age < 45000) {
              this.callState = { callId: data.callId, status: 'incoming', isCaller: false, otherName: data.callerName || this.activeChatMeta.otherName, muted: false };
              this.startRingtone(true);
              this.updateCallBannerDOM();
            }
          } else if (data.status === 'ended' && this.callState && (!data.callId || data.callId === this.callState.callId)) {
            this.cleanupCallLocal(true);
          } else if (data.status === 'answered' && data.answer && this.pc && this.callState?.isCaller && data.callId === this.callState.callId && !this.pc.currentRemoteDescription) {
            this.stopRingtone();
            this.pc.setRemoteDescription(new RTCSessionDescription(data.answer)).catch(() => {});
            this.callState.status = 'connected';
            this.updateCallBannerDOM();
          }
        }, () => {});
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
      this.selectedAgId = null;
      ['unsubChatDoc', 'unsubPeer', 'unsubMsgs', 'unsubAgreements', 'unsubCall'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      if (shouldRender) this.rerender();
    },

    // Partial DOM Patchers (Keep keyboard open!)
    updatePeerStatusDOM() {
      const el = document.getElementById('chat-peer-status');
      if (el) el.textContent = this.formatPeerStatus();
      const nm = document.getElementById('chat-peer-name');
      if (nm && this.activeChatMeta?.otherName) nm.textContent = this.activeChatMeta.otherName;
    },

    updateMessagesDOM() {
      const box = document.getElementById('chat-msgs-scroll');
      if (!box) return;
      const app = window.DamanApp;
      box.innerHTML = !this.messages.length
        ? `<div class="text-center text-xs text-slate-400 py-10">ابدأ المحادثة...</div>`
        : this.messages.map((m) => {
            const mine = app.user && m.senderId === app.user.uid;
            const adminMsg = !!m.isAdminIntervention;
            return `
              <div class="flex ${adminMsg ? 'justify-center' : mine ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[85%] rounded-2xl px-3 py-2 text-xs space-y-1 ${adminMsg ? 'bg-purple-900/80 border border-amber-400 text-amber-100' : mine ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-white border border-slate-700'}">
                  <div class="flex items-center justify-between gap-2">
                    ${adminMsg ? `<span class="text-[9px] text-amber-300 font-black">👑 تدخل الإدارة</span>` : (!mine ? `<span class="text-[9px] text-amber-300 font-extrabold">${app.esc(m.senderName || '')}</span>` : '<span></span>')}
                    <button onclick="DamanChat.setReply('${m.id}')" class="text-[9px] opacity-60 hover:opacity-100" title="رد"><i class="fa-solid fa-reply"></i></button>
                  </div>
                  ${m.replyTo ? `<div class="p-1.5 rounded-lg bg-black/20 border-s-2 border-white/60 text-[10px] opacity-90 truncate"><b>${app.esc(m.replyTo.senderName)}:</b> ${app.esc(m.replyTo.text)}</div>` : ''}
                  ${m.imageBase64 ? `<img src="${m.imageBase64}" onclick="DamanLightbox.open('${m.imageBase64}','صورة من المحادثة')" class="max-h-44 rounded-xl border border-black/20 cursor-pointer" />` : ''}
                  ${m.videoBase64 ? `<video controls src="${m.videoBase64}" class="max-h-44 rounded-xl w-full"></video>` : ''}
                  ${m.fileBase64 ? `<a href="${m.fileBase64}" download="${app.esc(m.fileName || 'file')}" class="inline-flex items-center gap-1.5 p-2 rounded-xl bg-black/20 underline font-black text-[11px]"><i class="fa-solid fa-file-arrow-down"></i> ${app.esc(m.fileName || 'ملف مرفق')}</a>` : ''}
                  ${m.audioBase64 ? `<audio controls src="${m.audioBase64}" class="w-48 h-8"></audio>` : ''}
                  ${m.location ? `<a href="https://maps.google.com/?q=${m.location.lat},${m.location.lng}" target="_blank" class="inline-flex items-center gap-1 underline font-black"><i class="fa-solid fa-location-dot"></i> فتح الموقع على الخريطة</a>` : ''}
                  ${m.text ? `<div class="leading-relaxed whitespace-pre-line">${app.esc(m.text)}</div>` : ''}
                  ${mine ? `<div class="text-end text-[9px] ${m.read ? 'text-sky-900 font-black' : 'opacity-60'}">${m.read ? '✓✓ تم القراءة' : '✓'}</div>` : ''}
                </div>
              </div>`;
          }).join('');
      setTimeout(() => { box.scrollTop = box.scrollHeight; }, 40);
    },

    updateAgreementsDOM() {
      const el = document.getElementById('chat-agreements-slot');
      if (el) el.innerHTML = this.renderAgreementsBar(window.DamanApp);
    },

    updateCallBannerDOM() {
      const el = document.getElementById('chat-call-slot');
      if (el) el.innerHTML = this.renderCallBanner(window.DamanApp);
    },

    updateReplyBarDOM() {
      const el = document.getElementById('chat-reply-slot');
      if (!el) return;
      const app = window.DamanApp;
      el.innerHTML = this.replyingTo ? `
        <div class="px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-between text-[10px] text-slate-300">
          <span class="truncate"><i class="fa-solid fa-reply text-amber-400 me-1"></i>الرد على <b>${app.esc(this.replyingTo.senderName)}:</b> ${app.esc(this.replyingTo.text)}</span>
          <button onclick="DamanChat.replyingTo=null; DamanChat.updateReplyBarDOM()" class="text-rose-400 ms-2"><i class="fa-solid fa-xmark"></i></button>
        </div>` : '';
    },

    formatPeerStatus() {
      if (this.isPureSupportChat()) return 'إدارة ضمان سايت — متاح للرد';
      const otherUid = this.activeChatMeta?.otherUid;
      const typingMap = this.activeChatDoc?.typing || {};
      if (otherUid && typingMap[otherUid] && Date.now() - typingMap[otherUid] < 4500) return '✍️ يكتب الآن...';
      const ls = this.peerProfile?.lastSeen;
      if (!ls) return 'غير متصل حالياً';
      const diffSec = Math.floor((Date.now() - ls) / 1000);
      if (diffSec < 120) return '🟢 نشط الآن';
      if (diffSec < 3600) return `آخر ظهور منذ ${Math.floor(diffSec / 60)} دقيقة`;
      return `آخر ظهور ${new Date(ls).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    },

    onTypingInput() {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user || this.typingTimeout) return;
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
      this.updateReplyBarDOM();
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
          blockedBy: iBlocked ? firebase.firestore.FieldValue.arrayRemove(app.user.uid) : firebase.firestore.FieldValue.arrayUnion(app.user.uid)
        });
        app.toast(iBlocked ? 'تم فك الحظر' : 'تم حظر المستخدم', 'info');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    isChatBlocked() {
      return (this.activeChatDoc?.blockedBy || []).length > 0;
    },

    async notifyChatPeer(app, previewText) {
      const target = this.isPureSupportChat() && !app.isAdmin() ? 'ADMIN' : this.activeChatMeta?.otherUid;
      const myName = app.isAdmin() ? 'إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || 'مستخدم ضمان سايت');
      if (target && target !== app.user?.uid) {
        await app.sendNotification(target, `رسالة جديدة من ${myName}`, previewText);
      }
    },

    // ==================== SEND MESSAGES, IMAGES, FILES, LOCATION, VOICE ====================
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
      this.updateReplyBarDOM();
      try {
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid,
          senderName: app.isAdmin() ? 'إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || ''),
          isAdminIntervention: app.isAdmin() && !this.isPureSupportChat(),
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

    async sendChatImage(input) {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة', 'error');
      const file = input.files && input.files[0];
      if (!file || !this.activeChatId || !app.user) return;
      try {
        const b64 = await app.compressImage(file, 760, 0.56);
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
        return app.toast('الحد الأقصى لحجم الملف أو الفيديو القصير 700 كيلوبايت', 'warning');
      }
      const isVideo = (file.type || '').startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const chatRef = app.db.collection('chats').doc(this.activeChatId);
          const payload = { senderId: app.user.uid, senderName: app.profile?.companyName || app.profile?.name || '', text: '', read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
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
              senderId: app.user.uid, senderName: app.profile?.companyName || app.profile?.name || '',
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude }, text: '📍 الموقع الحالي (GPS)', read: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await chatRef.update({ lastMessage: '📍 موقع GPS', lastSenderId: app.user.uid, lastReadByPeer: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
            await this.notifyChatPeer(app, '📍 أرسل لك اللوكيشن (GPS)');
          } catch (e) { app.toast(e.message, 'error'); }
        },
        () => app.toast('يرجى السماح بصلاحية الموقع (GPS)', 'error'),
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
        const btn = document.getElementById('voice-rec-btn');
        if (btn) btn.className = 'w-8 h-8 shrink-0 rounded-xl bg-rose-500 text-white animate-pulse flex items-center justify-center';
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
        this.voiceRecorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined);
        this.voiceRecorder.ondataavailable = (ev) => { if (ev.data?.size > 0) this.voiceChunks.push(ev.data); };
        this.voiceRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          clearInterval(this.voiceTimer);
          const dur = this.voiceSeconds;
          this.isRecordingVoice = false;
          const b = document.getElementById('voice-rec-btn');
          if (b) { b.className = 'w-8 h-8 shrink-0 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center'; b.innerHTML = '<i class="fa-solid fa-microphone text-xs"></i>'; }
          if (!this.voiceChunks.length || dur < 1) return;
          const blob = new Blob(this.voiceChunks, { type: mime || 'audio/webm' });
          if (blob.size > 650000) return app.toast('الرسالة الصوتية طويلة (الحد الأقصى 60 ثانية)', 'warning');
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const chatRef = app.db.collection('chats').doc(this.activeChatId);
              await chatRef.collection('messages').add({
                senderId: app.user.uid, senderName: app.profile?.companyName || app.profile?.name || '',
                audioBase64: reader.result, audioDuration: dur, text: '', read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              await chatRef.update({ lastMessage: `🎤 رسالة صوتية (${dur} ث)`, lastSenderId: app.user.uid, lastReadByPeer: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
              await this.notifyChatPeer(app, `🎤 أرسل لك رسالة صوتية (${dur} ثانية)`);
            } catch (err) { app.toast(err.message, 'error'); }
          };
          reader.readAsDataURL(blob);
        };
        this.voiceRecorder.start();
        this.voiceTimer = setInterval(() => {
          this.voiceSeconds++;
          const b = document.getElementById('voice-rec-btn');
          if (b) b.innerHTML = `<span class="text-[9px] font-black">${this.voiceSeconds}s</span>`;
          if (this.voiceSeconds >= 60 && this.voiceRecorder.state !== 'inactive') this.voiceRecorder.stop();
        }, 1000);
      } catch (err) { app.toast('يرجى السماح بصلاحية الميكروفون', 'error'); }
    },

    // ==================== FIXED WEBRTC VOICE CALLS (PERSISTENT AUDIO + UNIQUE CALL ID + 35s TIMEOUT) ====================
    buildIceServers(app) {
      const servers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ];
      const rawTurn = String(app.appConfig?.turnServer || '').trim();
      if (rawTurn) {
        const parts = rawTurn.split('|');
        if (parts.length === 3) {
          servers.push({ urls: parts[0].trim(), username: parts[1].trim(), credential: parts[2].trim() });
        } else {
          servers.push({ urls: rawTurn });
        }
      }
      return { iceServers: servers };
    },

    attachRemoteAudio(stream) {
      const audioEl = document.getElementById('daman-remote-audio');
      if (!audioEl) return;
      audioEl.srcObject = stream;
      audioEl.volume = 1.0;
      audioEl.muted = false;
      audioEl.play().catch(() => {
        window.DamanApp.toast('اضغط زر «تنشيط السماعة» في شريط المكالمة لسماع الصوت', 'warning');
      });
    },

    forcePlayRemoteAudio() {
      const audioEl = document.getElementById('daman-remote-audio');
      if (audioEl) {
        audioEl.muted = false;
        audioEl.volume = 1.0;
        audioEl.play().then(() => window.DamanApp.toast('تم تنشيط الصوت ✅', 'success')).catch(() => {});
      }
    },

    toggleMuteMic() {
      if (!this.localStream || !this.callState) return;
      const next = !this.callState.muted;
      this.localStream.getAudioTracks().forEach((t) => { t.enabled = !next; });
      this.callState.muted = next;
      this.updateCallBannerDOM();
    },

    async startVoiceCall() {
      const app = window.DamanApp;
      if (app.appConfig?.disableCalls && !app.isAdmin()) return app.toast('المكالمات متوقفة مؤقتاً من الإدارة', 'warning');
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة', 'error');
      if (this.isChatBlocked() && !app.isAdmin()) return app.toast('المحادثة محظورة', 'error');
      if (!this.activeChatId || !app.user || this.callState) return;

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.pc = new RTCPeerConnection(this.buildIceServers(app));
        this.remoteStream = new MediaStream();
        this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));

        this.pc.ontrack = (e) => {
          (e.streams[0] ? e.streams[0].getTracks() : [e.track]).forEach((t) => {
            if (!this.remoteStream.getTracks().some((x) => x.id === t.id)) this.remoteStream.addTrack(t);
          });
          this.attachRemoteAudio(this.remoteStream);
          this.startCallAutoRecording();
        };

        const callId = 'c_' + Date.now();
        const callRef = app.db.collection('chats').doc(this.activeChatId).collection('calls').doc('active');
        const pendingCandidates = [];
        let docWritten = false;

        this.pc.onicecandidate = (ev) => {
          if (!ev.candidate) return;
          const json = ev.candidate.toJSON();
          if (docWritten) callRef.collection('caller_' + callId).add(json).catch(() => {});
          else pendingCandidates.push(json);
        };

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        const myName = app.isAdmin() ? 'إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || '');

        await callRef.set({
          callId,
          callerId: app.user.uid,
          callerName: myName,
          offer: { type: offer.type, sdp: offer.sdp },
          status: 'ringing',
          startedAtMs: Date.now(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        docWritten = true;
        pendingCandidates.forEach((c) => callRef.collection('caller_' + callId).add(c).catch(() => {}));

        // Notify Peer (INCLUDING Admin via 'ADMIN' doc)
        const targetIncomingKey = this.isPureSupportChat() && !app.isAdmin() ? 'ADMIN' : this.activeChatMeta?.otherUid;
        if (targetIncomingKey) {
          await app.db.collection('incomingCalls').doc(targetIncomingKey).set({
            callId,
            chatId: this.activeChatId,
            callerId: app.user.uid,
            callerName: myName,
            status: 'ringing',
            startedAtMs: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        if (this.unsubIceCand) { try { this.unsubIceCand(); } catch (e) {} }
        this.unsubIceCand = callRef.collection('callee_' + callId).onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === 'added' && this.pc) {
              this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
            }
          });
        }, () => {});

        this.callState = { callId, status: 'calling', isCaller: true, otherName: this.activeChatMeta?.otherName || '', muted: false };
        this.callStartTime = Date.now();
        this.startRingtone(false);
        this.updateCallBannerDOM();
        await this.notifyChatPeer(app, '📞 مكالمة صوتية واردة — افتح التطبيق للرد');

        // Auto-timeout after 35 seconds if unanswered
        this.ringTimeout = setTimeout(async () => {
          if (this.callState && this.callState.status === 'calling') {
            app.toast('لم يرد الطرف الآخر (انتهت مهلة الرنين)', 'info');
            try {
              await app.db.collection('chats').doc(this.activeChatId).collection('messages').add({
                senderId: app.user.uid, senderName: myName, text: '📞 مكالمة فائتة (لم يتم الرد)', read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            } catch (e) {}
            this.endVoiceCall();
          }
        }, 35000);
      } catch (err) {
        app.toast('تعذر بدء المكالمة — تأكد من صلاحية الميكروفون', 'error');
        this.cleanupCallLocal(true);
      }
    },

    async answerVoiceCall(preAcquiredStream = null) {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      this.stopRingtone();
      app.db.collection('incomingCalls').doc(app.user.uid).delete().catch(() => {});
      if (app.isAdmin()) app.db.collection('incomingCalls').doc('ADMIN').delete().catch(() => {});

      try {
        const callRef = app.db.collection('chats').doc(this.activeChatId).collection('calls').doc('active');
        const callSnap = await callRef.get();
        if (!callSnap.exists || callSnap.data().status !== 'ringing') {
          if (preAcquiredStream) preAcquiredStream.getTracks().forEach((t) => t.stop());
          return this.cleanupCallLocal(true);
        }
        const cData = callSnap.data();
        const callId = cData.callId || 'legacy';

        this.localStream = preAcquiredStream || (await navigator.mediaDevices.getUserMedia({ audio: true }));
        this.pc = new RTCPeerConnection(this.buildIceServers(app));
        this.remoteStream = new MediaStream();
        this.localStream.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));

        this.pc.ontrack = (e) => {
          (e.streams[0] ? e.streams[0].getTracks() : [e.track]).forEach((t) => {
            if (!this.remoteStream.getTracks().some((x) => x.id === t.id)) this.remoteStream.addTrack(t);
          });
          this.attachRemoteAudio(this.remoteStream);
          this.startCallAutoRecording();
        };

        this.pc.onicecandidate = (ev) => {
          if (ev.candidate) callRef.collection('callee_' + callId).add(ev.candidate.toJSON()).catch(() => {});
        };

        await this.pc.setRemoteDescription(new RTCSessionDescription(cData.offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        await callRef.update({ answer: { type: answer.type, sdp: answer.sdp }, status: 'answered' });

        if (this.unsubIceCand) { try { this.unsubIceCand(); } catch (e) {} }
        this.unsubIceCand = callRef.collection('caller_' + callId).onSnapshot((snap) => {
          snap.docChanges().forEach((ch) => {
            if (ch.type === 'added' && this.pc) {
              this.pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
            }
          });
        }, () => {});

        this.callState = { callId, status: 'connected', isCaller: false, otherName: cData.callerName || this.activeChatMeta?.otherName || '', muted: false };
        this.callStartTime = Date.now();
        this.updateCallBannerDOM();
      } catch (err) {
        app.toast('تعذر الرد على المكالمة', 'error');
        this.cleanupCallLocal(true);
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
          reader.onloadend = async () => {
            try {
              const audioMedia = await app.saveMedia(reader.result, { kind: 'call_rec' });
              await app.db.collection('callRecordings').add({
                chatId: this.activeChatId,
                callerName: app.profile?.name || '',
                otherName: this.activeChatMeta?.otherName || '',
                durationSec: Math.max(1, Math.round((Date.now() - this.callStartTime) / 1000)),
                audioMedia,
                expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
                pinned: false,
                date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            } catch (e) {}
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
      const otherKey = this.isPureSupportChat() && !app.isAdmin() ? 'ADMIN' : this.activeChatMeta?.otherUid;
      if (otherKey) app.db.collection('incomingCalls').doc(otherKey).delete().catch(() => {});
      if (app.user) app.db.collection('incomingCalls').doc(app.user.uid).delete().catch(() => {});
      if (app.isAdmin()) app.db.collection('incomingCalls').doc('ADMIN').delete().catch(() => {});
      this.cleanupCallLocal(true);
    },

    cleanupCallLocal(shouldPatch = true) {
      this.stopRingtone();
      if (this.unsubIceCand) { try { this.unsubIceCand(); } catch (e) {} this.unsubIceCand = null; }
      if (this.callRecorder && this.callRecorder.state !== 'inactive') { try { this.callRecorder.stop(); } catch (e) {} }
      this.callRecorder = null;
      if (this.localStream) { this.localStream.getTracks().forEach((t) => t.stop()); this.localStream = null; }
      if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
      const audioEl = document.getElementById('daman-remote-audio');
      if (audioEl) { audioEl.srcObject = null; }
      this.callState = null;
      if (shouldPatch) this.updateCallBannerDOM();
    },

    // ==================== AGREEMENTS ENGINE (100% LOCK + LEGAL IDs + EXTENSIONS + EVENTS SUBCOLLECTION) ====================
    typeLabel(t) {
      const map = { supply: 'توريد خامات / بضاعة (B2B)', daily: 'يومية وعمالة', lump: 'مقطوعية', meter: 'بالمتر ومستخلصات', monthly: 'راتب شهري / دائم', weekly: 'اتفاق أسبوعي' };
      return map[t] || t;
    },

    payModeLabel(m) {
      const map = {
        daily_pay: 'يومية تُصرف يومياً بعد الاعتماد', expenses_thursday: 'مصاريف يومية + تصفية الخميس', every_15_days: 'تصفية كل 15 يوم',
        split_50_50: '50% مقدم و50% عند التسليم', milestones: 'دفعات بنسب مئوية', on_completion: '100% عند الاستلام والفحص',
        supply_advance: 'دفعة تجهيز/شحن + الباقي عند الاستلام', monthly_pay: 'راتب شهري ثابت'
      };
      return map[m] || m;
    },

    async logAgreementEvent(agId, ev) {
      const app = window.DamanApp;
      await app.db.collection('chatAgreements').doc(agId).collection('events').add(
        Object.assign({ date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp() }, ev)
      );
      await app.db.collection('chatAgreements').doc(agId).update({
        eventsCount: firebase.firestore.FieldValue.increment(1)
      }).catch(() => {});
    },

    async syncChatActiveDealFlag(chatId) {
      const app = window.DamanApp;
      const snap = await app.db.collection('chatAgreements').where('chatId', '==', chatId).get();
      const anyActive = snap.docs.some((d) => ['active', 'proposed_funded', 'disputed', 'retention_hold'].includes(d.data().status));
      await app.db.collection('chats').doc(chatId).update({ hasActiveDeal: anyActive }).catch(() => {});
    },

    openAgreementModal() {
      const app = window.DamanApp;
      if (this.activeChatMeta?.frozen && !app.isAdmin()) return app.toast('المحادثة مجمدة من الإدارة', 'error');
      if (!app.isKycVerified()) return app.toast('التوثيق الإجباري مطلوب قبل إنشاء أي اتفاق', 'warning');

      let modal = document.getElementById('daman-chat-agree-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-chat-agree-modal';
        modal.className = 'daman-modal fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-file-signature me-1"></i> إنشاء اتفاق وعقد رسمي مموّل 100%</h3>
            <button onclick="document.getElementById('daman-chat-agree-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form onsubmit="DamanChat.submitAgreement(event)" oninput="DamanChat.updateAgreementPreview()" class="space-y-2.5">
            <!-- Mandatory Role Selector -->
            <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/50 space-y-1">
              <label class="block text-[11px] font-black text-amber-300">1. حدد دورك في هذا العقد *</label>
              <select id="ag-role" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black">
                <option value="payer">أنا صاحب العمل / المشتري (سأحجز 100% من المبلغ الآن)</option>
                <option value="provider">أنا المقاول / المنفّذ / المورّد (أرسل عرض سعر للعميل ليحجز المبلغ)</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">2. نوع الاتفاق</label>
              <select id="ag-type" onchange="DamanChat.toggleAgreementFields()" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 font-bold text-amber-300">
                <option value="daily">👷 يومية وعمالة</option>
                <option value="supply">🚚 توريد خامات أو بضاعة (B2B)</option>
                <option value="lump">🏗️ مقطوعية</option>
                <option value="meter">📐 بالمتر ومستخلصات</option>
                <option value="monthly">💼 راتب شهري ثابت</option>
                <option value="weekly">📅 اتفاق أسبوعي</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">3. وصف الشغل أو الصنف المطلوب</label>
              <input id="ag-title" type="text" required placeholder="مثال: شدة سقف فيلا 3 أيام / توريد 50 طن أسمنت" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <div id="ag-box-daily" class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-1.5">
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">عدد العمال</label><input id="ag-workers" type="number" min="1" value="5" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">يومية الفرد</label><input id="ag-daily-rate" type="number" min="10" value="400" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">عدد الأيام</label><input id="ag-days" type="number" min="1" value="3" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
            </div>

            <div id="ag-box-supply" class="hidden p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2">
              <div class="grid grid-cols-3 gap-1.5">
                <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">الكمية</label><input id="ag-sup-qty" type="number" min="1" step="any" value="10" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
                <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">الوحدة</label><input id="ag-sup-unit" type="text" value="طن" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
                <div><label class="block text-[10px] text-emerald-300 font-bold mb-1">سعر الوحدة</label><input id="ag-sup-price" type="number" min="1" step="any" value="2500" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              </div>
              <input id="ag-sup-loc" type="text" placeholder="موقع التسليم وموعده" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
            </div>

            <div id="ag-box-meter" class="hidden p-2.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">سعر المتر (ج.م)</label><input id="ag-meter-price" type="number" min="1" step="any" value="35" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">إجمالي الأمتار</label><input id="ag-meter-qty" type="number" min="1" step="any" value="500" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
            </div>

            <div id="ag-box-lump" class="hidden p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <label class="block text-[10px] text-amber-300 font-bold mb-1">إجمالي المقطوعية (ج.م)</label>
              <input id="ag-lump-total" type="number" min="50" step="any" value="5000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/40 text-white font-bold" />
            </div>

            <div id="ag-box-monthly" class="hidden p-2.5 rounded-xl bg-slate-950 border border-sky-500/40 grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-sky-300 font-bold mb-1">الراتب الشهري (ج.م)</label><input id="ag-month-sal" type="number" min="500" value="12000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-sky-300 font-bold mb-1">يوم الصرف</label><input id="ag-month-day" type="text" value="يوم 1 من كل شهر" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white" /></div>
            </div>

            <div id="ag-box-weekly" class="hidden p-2.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-2">
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">قيمة الأسبوع</label><input id="ag-week-rate" type="number" min="100" value="5000" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
              <div><label class="block text-[10px] text-amber-300 font-bold mb-1">عدد الأسابيع</label><input id="ag-weeks" type="number" min="1" value="2" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold" /></div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-bold text-sky-300 mb-1">نظام الصرف</label>
                <select id="ag-pay-mode" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="daily_pay">يومية تُصرف يومياً</option>
                  <option value="expenses_thursday">تصفية الخميس</option>
                  <option value="on_completion">100% عند التسليم</option>
                  <option value="split_50_50">50% مقدم و50% تسليم</option>
                  <option value="every_15_days">كل 15 يوم</option>
                  <option value="monthly_pay">راتب شهري</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-purple-300 mb-1">تأمين أعمال اختياري (Retention %)</label>
                <select id="ag-retention" class="w-full px-2 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                  <option value="0">0% (بدون حجز تأمين)</option>
                  <option value="5">5% ضمان عيوب (14 يوم)</option>
                  <option value="10">10% ضمان عيوب (30 يوم)</option>
                </select>
              </div>
            </div>

            <div id="ag-calc-preview" class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-[11px] text-emerald-200 space-y-0.5"></div>

            <button id="ag-submit-btn" type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-lock me-1"></i> إرسال وحفظ الاتفاق
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
        unitName = (document.getElementById('ag-sup-unit')?.value || 'وحدة').trim();
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
      const role = document.getElementById('ag-role')?.value || 'payer';
      const avail = Number(app.profile?.balanceAvailable || 0);
      const prev = document.getElementById('ag-calc-preview');
      if (!prev) return;
      const short = role === 'payer' && avail < calc.grand;
      prev.innerHTML = `
        <div>قيمة الاتفاق: <b>${app.fmtMoney(calc.total)} ج.م</b> | عمولة الضمان (${(app.getCommissionRate() * 100).toFixed(1)}%): <b>${app.fmtMoney(calc.fee)} ج.م</b></div>
        <div class="text-amber-300 font-black">إجمالي الحجز الإجباري (100%): ${app.fmtMoney(calc.grand)} ج.م</div>
        ${short
          ? `<div class="text-rose-300 font-black pt-1">❌ رصيدك المتاح (${app.fmtMoney(avail)} ج.م) لا يكفي! ينقصك ${app.fmtMoney(calc.grand - avail)} ج.م. لا يمكن إنشاء العقد قبل الشحن.</div>`
          : `<div class="text-[10px] text-slate-300 pt-0.5">${role === 'payer' ? '✅ رصيدك يكفي — سيتم حجز 100% من المبلغ فوراً ولن يُصرف جنيه قبل رفع العقد الموقّع واعتماد الإدارة.' : 'سيُرسل كعرض سعر مبدئي، ولن يُصدر عقد أو يبدأ العمل قبل أن يحجز صاحب العمل 100% من المبلغ.'}</div>`}`;
    },

    async submitAgreement(e) {
      e.preventDefault();
      const app = window.DamanApp;
      await app.withLock('createAg', async () => {
        const calc = this.computeModalTotals();
        if (calc.total <= 0) return app.toast('أدخل قيماً صحيحة للاتفاق', 'error');

        const role = document.getElementById('ag-role').value;
        const title = document.getElementById('ag-title').value.trim();
        const payMode = document.getElementById('ag-pay-mode').value;
        const retentionPct = parseInt(document.getElementById('ag-retention')?.value, 10) || 0;
        const otherUid = this.activeChatMeta?.otherUid;
        if (!otherUid || otherUid === 'admin') return app.toast('لا يمكن إنشاء عقد في شات الإدارة', 'error');

        const payerUid = role === 'payer' ? app.user.uid : otherUid;
        const providerUid = role === 'provider' ? app.user.uid : otherUid;

        // Strict 100% Balance Check if Payer is creating the agreement
        if (role === 'payer') {
          const avail = Number(app.profile?.balanceAvailable || 0);
          if (avail < calc.grand) {
            const diff = Math.round((calc.grand - avail) * 100) / 100;
            if (window.confirm(`لا يمكن إنشاء عقد بدون رصيد كامل 100%!\nالمطلوب: ${app.fmtMoney(calc.grand)} ج.م\nالمتاح لديك: ${app.fmtMoney(avail)} ج.م\nهل تريد شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
              document.getElementById('daman-chat-agree-modal').classList.add('hidden');
              if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
            }
            return;
          }
        }

        // Snapshot BOTH parties' Verified Legal Data from their IDs
        let payerSnap = {}, providerSnap = {};
        try {
          const [p1, p2] = await Promise.all([
            app.db.collection('users').doc(payerUid).get(),
            app.db.collection('users').doc(providerUid).get()
          ]);
          payerSnap = p1.exists ? p1.data() : {};
          providerSnap = p2.exists ? p2.data() : {};
        } catch (err) {}

        const ticketNumber = 'TKT-' + Date.now().toString().slice(-6);
        const agRef = app.db.collection('chatAgreements').doc();

        const baseDoc = {
          chatId: this.activeChatId,
          ticketNumber,
          type: calc.t,
          payMode,
          title,
          retentionPct,
          unitPrice: calc.unitPrice,
          unitQty: calc.unitQty,
          unitName: calc.unitName,
          supplyLocation: (document.getElementById('ag-sup-loc')?.value || '').trim(),
          workers: calc.workers,
          totalDays: calc.days,
          dailyRate: calc.t === 'daily' ? calc.unitPrice : 0,
          dailyCost: calc.dailyCost,
          totalAmount: calc.total,
          commissionFee: calc.fee,
          grandTotalWithFee: calc.grand,
          lockedAmount: role === 'payer' ? calc.grand : 0,
          lockedFee: role === 'payer' ? calc.fee : 0,
          remainingEscrow: role === 'payer' ? calc.total : 0,
          paidSoFar: 0,
          confirmedDays: 0,
          confirmedEarnedTotal: 0,
          approvedDeductions: 0,
          createdBy: app.user.uid,
          payerUid,
          providerUid,
          // Display names
          payerName: payerSnap.companyName || payerSnap.name || '',
          providerName: providerSnap.companyName || providerSnap.name || '',
          // VERIFIED LEGAL ID DATA (for Official A4 Contract ONLY)
          payerLegal: {
            legalName: payerSnap.legalName || payerSnap.name || '',
            nationalId: payerSnap.nationalId || '',
            legalAddress: payerSnap.legalAddress || '',
            accountType: payerSnap.accountType || 'individual',
            companyName: payerSnap.companyName || '',
            commercialReg: payerSnap.commercialReg || '',
            taxCard: payerSnap.taxCard || ''
          },
          providerLegal: {
            legalName: providerSnap.legalName || providerSnap.name || '',
            nationalId: providerSnap.nationalId || '',
            legalAddress: providerSnap.legalAddress || '',
            accountType: providerSnap.accountType || 'individual',
            companyName: providerSnap.companyName || '',
            commercialReg: providerSnap.commercialReg || '',
            taxCard: providerSnap.taxCard || ''
          },
          status: role === 'payer' ? 'proposed_funded' : 'proposed',
          contractStatus: 'not_uploaded',
          signedContractMedia: '',
          payerSignature: '',
          providerSignature: '',
          pendingDayLog: null,
          pendingAdvance: null,
          pendingExtension: null,
          pendingDeduction: null,
          pendingAbstract: null,
          pendingTermination: null,
          eventsCount: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
          if (role === 'payer') {
            // Lock 100% immediately in transaction
            const payerRef = app.db.collection('users').doc(payerUid);
            await app.db.runTransaction(async (tx) => {
              const uDoc = await tx.get(payerRef);
              const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
              const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
              if (curAvail < calc.grand) throw new Error('رصيدك المتاح غير كافٍ لحجز 100% من الاتفاق + العمولة');
              tx.update(payerRef, {
                balanceAvailable: Math.round((curAvail - calc.grand) * 100) / 100,
                balanceEscrow: Math.round((curEsc + calc.grand) * 100) / 100
              });
              tx.set(agRef, baseDoc);
              tx.set(app.db.collection('transactions').doc(), {
                userId: payerUid, type: 'escrow_lock', amount: -calc.grand,
                note: `حجز ضمان 100% للاتفاق ${ticketNumber} (${title})`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            });
            await this.logAgreementEvent(agRef.id, { kind: 'lock', label: 'حجز كامل مبلغ الضمان (100% + 3.5%) من صاحب العمل', amount: calc.grand, by: app.profile?.name || '' });
            await this.syncChatActiveDealFlag(this.activeChatId);
            await this.notifyChatPeer(app, `🔒 عرض عقد مموّل 100% (${ticketNumber}): ${title} — اضغط للموافقة وبدء طباعة العقد`);
          } else {
            await agRef.set(baseDoc);
            await this.notifyChatPeer(app, `📄 عرض سعر مبدئي (${ticketNumber}): ${title} بمبلغ ${app.fmtMoney(calc.total)} ج.م`);
          }

          this.selectedAgId = agRef.id;
          document.getElementById('daman-chat-agree-modal').classList.add('hidden');
          app.toast(role === 'payer' ? 'تم حجز 100% من المبلغ وإرسال العرض المموّل ✅' : 'تم إرسال عرض السعر المبدئي بنجاح', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // Accept Proposal (Either Payer funds 100% OR Provider accepts already-funded proposal)
    async acceptAgreement(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;

      await app.withLock('acceptAg_' + agId, async () => {
        // Case A: Already funded by Payer -> Provider accepts
        if (ag.status === 'proposed_funded' && app.user.uid === ag.providerUid) {
          if (!window.confirm(`الموافقة على الاتفاق المموّل (${ag.ticketNumber}) بقيمة ${app.fmtMoney(ag.totalAmount)} ج.م؟\nبعد الموافقة اطبعا العقد ووقّعاه وارفعاه لاعتماد الإدارة.`)) return;
          try {
            await app.db.collection('chatAgreements').doc(agId).update({
              status: 'active',
              acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.logAgreementEvent(agId, { kind: 'accepted', label: 'موافقة المنفّذ وتفعيل العقد — بانتظار رفع النسخة الموقّعة', amount: 0, by: app.profile?.name || '' });
            await app.sendNotification(ag.payerUid, `تمت الموافقة على الاتفاق ${ag.ticketNumber}`, 'يرجى طباعة العقد وتوقيعه ورفع صورته لتفعيل الصرف.');
            app.toast('تم تفعيل العقد! الخطوة التالية: طباعة وتوقيع ورفع العقد للإدارة', 'success');
          } catch (e) { app.toast(e.message, 'error'); }
          return;
        }

        // Case B: Proposed by Provider -> Payer MUST fund 100% + 3.5%
        if (ag.status === 'proposed' && app.user.uid === ag.payerUid) {
          const needed = Number(ag.grandTotalWithFee || 0);
          const avail = Number(app.profile?.balanceAvailable || 0);
          if (avail < needed) {
            const diff = Math.round((needed - avail) * 100) / 100;
            if (window.confirm(`لا يمكن قبول العقد بدون رصيد كامل 100%!\nالمطلوب: ${app.fmtMoney(needed)} ج.م (شامل 3.5%)\nالمتاح: ${app.fmtMoney(avail)} ج.م\nهل تريد شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
              if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
            }
            return;
          }
          if (!window.confirm(`تأكيد الموافقة وحجز 100% من المبلغ (${app.fmtMoney(needed)} ج.م شامل عمولة 3.5%) في الضمان؟`)) return;

          const payerRef = app.db.collection('users').doc(ag.payerUid);
          const agRef = app.db.collection('chatAgreements').doc(agId);
          try {
            await app.db.runTransaction(async (tx) => {
              const [uDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(agRef)]);
              if (aDoc.data().status !== 'proposed') throw new Error('حالة العرض تغيرت بالفعل');
              const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
              const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
              if (curAvail < needed) throw new Error('الرصيد المتاح غير كافٍ');

              tx.update(payerRef, {
                balanceAvailable: Math.round((curAvail - needed) * 100) / 100,
                balanceEscrow: Math.round((curEsc + needed) * 100) / 100
              });
              tx.update(agRef, {
                status: 'active',
                lockedAmount: needed,
                lockedFee: Number(ag.commissionFee || 0),
                remainingEscrow: Number(ag.totalAmount || 0),
                acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.payerUid, type: 'escrow_lock', amount: -needed,
                note: `حجز ضمان 100% للاتفاق ${ag.ticketNumber}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            });
            await this.logAgreementEvent(agId, { kind: 'lock', label: 'موافقة وحجز 100% من الضمان (+ 3.5%)', amount: needed, by: app.profile?.name || '' });
            await this.syncChatActiveDealFlag(this.activeChatId);
            await app.sendNotification(ag.providerUid, `تم حجز 100% من الاتفاق ${ag.ticketNumber} ✅`, 'يرجى طباعة العقد وتوقيعه ورفع نسخته للاعتماد.');
            app.toast('تم حجز 100% من الضمان! اطبعا العقد وارفعاه الآن ✅', 'success');
          } catch (e) { app.toast(e.message, 'error'); }
        }
      });
    },

    // Reject or Cancel Proposal (Refunds 100% if already funded)
    async rejectOrCancelAgreement(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;

      const isPreApprovalRefund = ag.status === 'active' && ag.contractStatus !== 'approved' && Number(ag.paidSoFar || 0) === 0;
      const msg = ag.status === 'proposed'
        ? 'إلغاء / رفض عرض السعر المبدئي؟'
        : isPreApprovalRefund
        ? 'إلغاء العقد قبل اعتماده وردّ 100% من المبلغ المحجوز فوراً لمحفظة صاحب العمل؟'
        : 'إلغاء العرض المموّل وردّ 100% من المبلغ المحجوز لمحفظة صاحب العمل؟';
      if (!window.confirm(msg)) return;

      await app.withLock('cancelAg_' + agId, async () => {
        const agRef = app.db.collection('chatAgreements').doc(agId);
        try {
          if (ag.status === 'proposed') {
            await agRef.delete();
            app.toast('تم إلغاء العرض', 'info');
            return;
          }
          const refundTotal = Math.round((Number(ag.remainingEscrow || 0) + Number(ag.lockedFee || 0)) * 100) / 100;
          const payerRef = app.db.collection('users').doc(ag.payerUid);
          await app.db.runTransaction(async (tx) => {
            const [pDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(agRef)]);
            const st = aDoc.data().status;
            if (!['proposed_funded', 'active'].includes(st)) throw new Error('لا يمكن إلغاء العقد في حالته الحالية');
            const curAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
            const curEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            tx.update(payerRef, {
              balanceAvailable: Math.round((curAvail + refundTotal) * 100) / 100,
              balanceEscrow: Math.max(0, Math.round((curEsc - refundTotal) * 100) / 100)
            });
            tx.update(agRef, { status: 'cancelled', remainingEscrow: 0, lockedFee: 0 });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.payerUid, type: 'escrow_refund', amount: refundTotal,
              note: `استرداد كامل الضمان — إلغاء الاتفاق ${ag.ticketNumber} قبل التشغيل`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await this.syncChatActiveDealFlag(this.activeChatId);
          app.toast('تم الإلغاء وردّ 100% من المبلغ للمحفظة ✅', 'success');
        } catch (e) { app.toast(e.message, 'error'); }
      });
    },

    // ==================== TOUCH SIGNATURE PAD & UPLOAD SIGNED CONTRACT ====================
    openSignatureModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const isPayer = app.user.uid === ag.payerUid;
      let m = document.getElementById('daman-sig-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-sig-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">✍️ التوقيع الإلكتروني باللمس (${isPayer ? 'الطرف الأول' : 'الطرف الثاني'})</h3>
            <button onclick="document.getElementById('daman-sig-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <p class="text-[10.5px] text-slate-300">وقّع بإصبعك داخل المربع الأبيض أدناه؛ سيُدرج توقيعك تلقائياً داخل العقد الرسمي A4.</p>
          <canvas id="daman-sig-canvas" width="320" height="160" class="sig-pad w-full bg-white rounded-xl border-2 border-amber-500"></canvas>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" onclick="DamanChat.clearSigCanvas()" class="py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">مسح</button>
            <button type="button" onclick="DamanChat.saveSignature('${agId}')" class="py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">حفظ التوقيع</button>
          </div>
        </div>`;

      const cv = document.getElementById('daman-sig-canvas');
      const ctx = cv.getContext('2d');
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      let drawing = false;
      const getPos = (ev) => {
        const r = cv.getBoundingClientRect();
        const t = ev.touches ? ev.touches[0] : ev;
        return { x: ((t.clientX - r.left) * cv.width) / r.width, y: ((t.clientY - r.top) * cv.height) / r.height };
      };
      const start = (ev) => { ev.preventDefault(); drawing = true; const p = getPos(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
      const move = (ev) => { if (!drawing) return; ev.preventDefault(); const p = getPos(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); };
      const end = () => { drawing = false; };
      cv.onmousedown = start; cv.onmousemove = move; window.onmouseup = end;
      cv.ontouchstart = start; cv.ontouchmove = move; cv.ontouchend = end;
    },

    clearSigCanvas() {
      const cv = document.getElementById('daman-sig-canvas');
      if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    },

    async saveSignature(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      const cv = document.getElementById('daman-sig-canvas');
      if (!ag || !cv) return;
      const dataUrl = cv.toDataURL('image/png');
      const field = app.user.uid === ag.payerUid ? 'payerSignature' : 'providerSignature';
      const patch = {};
      patch[field] = dataUrl;
      try {
        await app.db.collection('chatAgreements').doc(agId).update(patch);
        document.getElementById('daman-sig-modal').classList.add('hidden');
        app.toast('تم حفظ توقيعك داخل العقد بنجاح ✍️', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async uploadSignedContract(agId, input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        app.toast('جارٍ رفع نسخة العقد الموقّع للإدارة...', 'info');
        const b64 = await app.compressImage(file, 900, 0.58);
        const mediaId = await app.saveMedia(b64, { kind: 'signed_contract' });
        await app.db.collection('chatAgreements').doc(agId).update({
          signedContractMedia: mediaId,
          contractStatus: 'pending_admin',
          signedUploadedBy: app.profile?.name || '',
          signedUploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.logAgreementEvent(agId, { kind: 'contract_upload', label: 'رفع صورة العقد الموقّع لاعتماد الإدارة', amount: 0, photoMedia: mediaId, by: app.profile?.name || '' });
        await this.notifyChatPeer(app, '📄 تم رفع نسخة العقد الموقّع — بانتظار اعتماد إدارة ضمان سايت');
        await app.sendNotification('ADMIN', 'عقد موقّع جديد بانتظار الاعتماد 📄', `يرجى مراجعة واعتماد العقد المرفوع (${agId})`);
        app.toast('تم رفع نسخة العقد للإدارة بنجاح ✅', 'success');
      } catch (e) { app.toast('تعذر رفع الصورة', 'error'); }
      input.value = '';
    },

    // ==================== FUNDED CONTRACT EXTENSION / OVERTIME (100% UPFRONT LOCK) ====================
    openExtensionModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      if (ag.contractStatus !== 'approved') return app.toast('يجب اعتماد العقد الأساسي من الإدارة أولاً قبل التمديد', 'warning');

      let m = document.getElementById('daman-ext-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-ext-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const isDaily = ag.type === 'daily';
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-calendar-plus me-1"></i> تمديد العقد / إضافة إضافي وسهر مموّل</h3>
            <button onclick="document.getElementById('daman-ext-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <p class="text-[10.5px] text-slate-300">لا يُعتمد أي تمديد أو إضافي إلا بعد حجز <b>100% من قيمته + عمولة 3.5%</b> من محفظة صاحب العمل.</p>
          <form onsubmit="DamanChat.submitExtension(event,'${agId}')" oninput="DamanChat.updateExtPreview('${agId}')" class="space-y-2.5">
            ${isDaily ? `
              <div><label class="block text-[11px] font-bold text-slate-300 mb-1">عدد الأيام الإضافية (أو 0 لو سهرة/إضافي فقط)</label><input id="ext-days" type="number" min="0" value="3" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>` : ''}
            <div>
              <label class="block text-[11px] font-bold text-emerald-300 mb-1">قيمة التمديد / الإضافي الصافية (ج.م)</label>
              <input id="ext-amt" type="number" min="50" step="any" required value="${isDaily ? Math.round((ag.dailyCost || 1000) * 3) : 1000}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">البيان / سبب التمديد أو السهرة</label>
              <input id="ext-note" type="text" required placeholder="مثال: تمديد 3 أيام إضافية / سهرة صب خرسانة" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <div id="ext-prev" class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200"></div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إرسال / تفعيل ملحق التمديد</button>
          </form>
        </div>`;
      this.updateExtPreview(agId);
    },

    updateExtPreview(agId) {
      const app = window.DamanApp;
      const amt = parseFloat(document.getElementById('ext-amt')?.value) || 0;
      const fee = Math.round(amt * app.getCommissionRate() * 100) / 100;
      const grand = Math.round((amt + fee) * 100) / 100;
      const p = document.getElementById('ext-prev');
      if (p) p.innerHTML = `القيمة: <b>${app.fmtMoney(amt)} ج.م</b> + عمولة (3.5%): <b>${app.fmtMoney(fee)} ج.م</b><br/><b class="text-emerald-300">المطلوب حجزه 100%: ${app.fmtMoney(grand)} ج.م</b>`;
    },

    async submitExtension(e, agId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const extraDays = parseInt(document.getElementById('ext-days')?.value, 10) || 0;
      const amount = Math.round((parseFloat(document.getElementById('ext-amt').value) || 0) * 100) / 100;
      const note = document.getElementById('ext-note').value.trim();
      if (amount <= 0) return;

      const fee = Math.round(amount * app.getCommissionRate() * 100) / 100;
      const grand = Math.round((amount + fee) * 100) / 100;
      const isPayer = app.user.uid === ag.payerUid;

      if (isPayer) {
        const avail = Number(app.profile?.balanceAvailable || 0);
        if (avail < grand) {
          const diff = Math.round((grand - avail) * 100) / 100;
          if (window.confirm(`رصيدك غير كافٍ لتمديد العقد (المطلوب ${app.fmtMoney(grand)} ج.م).\nهل تريد شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
            document.getElementById('daman-ext-modal').classList.add('hidden');
            if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
          }
          return;
        }
      }

      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingExtension: {
            extraDays, amount, fee, grand, note,
            proposedByUid: app.user.uid, proposedByName: app.profile?.name || '',
            date: app.todayLocal()
          }
        });
        document.getElementById('daman-ext-modal').classList.add('hidden');
        const peer = isPayer ? ag.providerUid : ag.payerUid;
        await app.sendNotification(peer, `طلب تمديد/إضافي للعقد ${ag.ticketNumber}`, `${note} — بقيمة ${app.fmtMoney(amount)} ج.م`);
        app.toast('تم إرسال طلب ملحق التمديد للطرف الآخر للموافقة ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async respondExtension(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingExtension) return;
      const ext = ag.pendingExtension;

      if (!approve) {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingExtension: null });
        return app.toast('تم رفض طلب التمديد', 'info');
      }

      await app.withLock('respExt_' + agId, async () => {
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const agRef = app.db.collection('chatAgreements').doc(agId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [pDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(agRef)]);
            const curAvail = Number((pDoc.data() || {}).balanceAvailable || 0);
            const curEsc = Number((pDoc.data() || {}).balanceEscrow || 0);
            if (curAvail < ext.grand) throw new Error(`رصيد صاحب العمل المتاح لا يكفي لحجز 100% من التمديد (${app.fmtMoney(ext.grand)} ج.م)`);

            const a = aDoc.data();
            tx.update(payerRef, {
              balanceAvailable: Math.round((curAvail - ext.grand) * 100) / 100,
              balanceEscrow: Math.round((curEsc + ext.grand) * 100) / 100
            });
            tx.update(agRef, {
              totalDays: Number(a.totalDays || 0) + Number(ext.extraDays || 0),
              totalAmount: Math.round((Number(a.totalAmount || 0) + ext.amount) * 100) / 100,
              commissionFee: Math.round((Number(a.commissionFee || 0) + ext.fee) * 100) / 100,
              grandTotalWithFee: Math.round((Number(a.grandTotalWithFee || 0) + ext.grand) * 100) / 100,
              lockedAmount: Math.round((Number(a.lockedAmount || 0) + ext.grand) * 100) / 100,
              lockedFee: Math.round((Number(a.lockedFee || 0) + ext.fee) * 100) / 100,
              remainingEscrow: Math.round((Number(a.remainingEscrow || 0) + ext.amount) * 100) / 100,
              pendingExtension: null
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.payerUid, type: 'escrow_extension', amount: -ext.grand,
              note: `تمديد/إضافي مموّل للعقد ${ag.ticketNumber}: ${ext.note}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await this.logAgreementEvent(agId, { kind: 'extension', label: `اعتماد ملحق تمديد/إضافي مموّل (+${ext.extraDays} أيام): ${ext.note}`, amount: ext.amount, by: app.profile?.name || '' });
          app.toast('تم حجز مبلغ التمديد وتحديث العقد بنجاح ✅', 'success');
        } catch (e) {
          app.toast(e.message, 'error');
          if (app.user.uid === ag.payerUid && e.message.includes('لا يكفي') && window.DamanWallet) {
            window.DamanWallet.openDepositWithAmount(ext.grand);
          }
        }
      });
    },

    // ==================== DAILY ACTUAL WORKERS, ADVANCES, DEDUCTIONS, CUSTODY (عهدة), FINAL SETTLEMENT ====================
    requireApprovedContract(ag) {
      if (ag.contractStatus !== 'approved') {
        window.DamanApp.toast('⚠️ لا يمكن صرف أي مبلغ قبل رفع صورة العقد الموقّع واعتمادها من إدارة ضمان سايت', 'warning');
        return false;
      }
      return true;
    },

    openDailyLogModal(agId) {
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !this.requireApprovedContract(ag)) return;
      this.tempDayPhoto = '';
      let m = document.getElementById('daman-day-log-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-day-log-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-sky-400">تأكيد حضور العمال الفعلي اليوم</h3><button onclick="document.getElementById('daman-day-log-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanChat.submitDailyLog(event,'${agId}')" class="space-y-2.5">
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">عدد العمال الفعلي اليوم (المتفق عليه: ${ag.workers || 1})</label><input id="dl-count" type="number" min="1" required value="${ag.workers || 1}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 text-white font-bold" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">ما تم إنجازه اليوم</label><input id="dl-note" type="text" required placeholder="مثال: شدة سقف الدور الأرضي" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <label class="block p-2.5 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer"><span class="font-bold text-emerald-300"><i class="fa-solid fa-camera me-1"></i> صورة إثبات الإنجاز (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanChat.handleTempPhoto(this,'day')" /><div id="dl-photo-prev"></div></label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">إرسال لصاحب العمل للاعتماد</button>
          </form>
        </div>`;
    },

    async handleTempPhoto(input, target) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        const b64 = await window.DamanApp.compressImage(f, 700, 0.56);
        if (target === 'day') { this.tempDayPhoto = b64; const p = document.getElementById('dl-photo-prev'); if (p) p.innerHTML = `<img src="${b64}" class="max-h-24 mx-auto rounded mt-1.5" />`; }
        else if (target === 'inv') { this.tempInvoicePhoto = b64; const p = document.getElementById('mv-photo-prev'); if (p) p.innerHTML = `<img src="${b64}" class="max-h-24 mx-auto rounded mt-1.5" />`; }
        else { this.tempDeductPhoto = b64; const p = document.getElementById('dd-photo-prev'); if (p) p.innerHTML = `<img src="${b64}" class="max-h-24 mx-auto rounded mt-1.5" />`; }
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
        const photoMedia = this.tempDayPhoto ? await app.saveMedia(this.tempDayPhoto, { kind: 'day_log' }) : '';
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingDayLog: { date: app.todayLocal(), actualWorkers, note, photoMedia, byUid: app.user.uid, byName: app.profile?.name || '' }
        });
        document.getElementById('daman-day-log-modal').classList.add('hidden');
        await app.sendNotification(ag.payerUid, `تأكيد حضور اليوم (${actualWorkers} عامل)`, note);
        app.toast('تم إرسال تأكيد الحضور لصاحب العمل ✅', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async clientApproveActualDay(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingDayLog || !this.requireApprovedContract(ag)) return;
      const confirmedCount = parseInt(window.prompt(`اعتماد العدد الفعلي للعمال اليوم (المسجّل: ${ag.pendingDayLog.actualWorkers}):`, ag.pendingDayLog.actualWorkers), 10);
      if (!confirmedCount || confirmedCount <= 0) return;

      const dayCost = Math.round(confirmedCount * Number(ag.dailyRate || 0) * 100) / 100;
      const payNow = ag.payMode === 'daily_pay' && dayCost > 0;

      await app.withLock('appDay_' + agId, async () => {
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        const agRef = app.db.collection('chatAgreements').doc(agId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef), tx.get(agRef)]);
            const a = aDoc.data();
            const curRem = Number(a.remainingEscrow || 0);
            if (payNow && curRem < dayCost) throw new Error('الرصيد المتبقي بالضمان لا يكفي لصرف يومية اليوم — استخدم زر تمديد العقد');

            const patch = {
              confirmedDays: Number(a.confirmedDays || 0) + 1,
              confirmedEarnedTotal: Math.round((Number(a.confirmedEarnedTotal || 0) + dayCost) * 100) / 100,
              pendingDayLog: null
            };
            if (payNow) {
              tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - dayCost) * 100) / 100) });
              tx.update(provRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + dayCost) * 100) / 100 });
              patch.remainingEscrow = Math.round((curRem - dayCost) * 100) / 100;
              patch.paidSoFar = Math.round((Number(a.paidSoFar || 0) + dayCost) * 100) / 100;
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.providerUid, type: 'daily_payout', amount: dayCost,
                note: `صرف يومية (${confirmedCount} عامل) — عقد ${ag.ticketNumber}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            tx.update(agRef, patch);
          });
          await this.logAgreementEvent(agId, {
            kind: 'day_confirmed',
            label: `اعتماد يوم (${confirmedCount} عامل — مستحق ${app.fmtMoney(dayCost)} ج.م)${payNow ? ' + صرف فوري' : ''}`,
            amount: dayCost,
            photoMedia: ag.pendingDayLog.photoMedia || '',
            by: app.profile?.name || ''
          });
          app.toast(`تم اعتماد يوم العمل (${confirmedCount} عامل) بنجاح ✅`, 'success');
        } catch (e) { app.toast(e.message, 'error'); }
      });
    },

    // Formal Deduction / Penalty Request (Provider approves or escalates to Admin)
    openDeductionModal(agId) {
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !this.requireApprovedContract(ag)) return;
      this.tempDeductPhoto = '';
      let m = document.getElementById('daman-deduct-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-deduct-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-rose-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-rose-400">تسجيل خصم / جزاء رسمي موثّق</h3><button onclick="document.getElementById('daman-deduct-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanChat.submitDeduction(event,'${agId}')" class="space-y-2.5">
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">قيمة الخصم / الجزاء (ج.م)</label><input id="dd-amt" type="number" min="10" max="${ag.remainingEscrow}" step="any" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-rose-500/40 text-white font-black" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">سبب الخصم (تلفيات / عدم مطابقة)</label><input id="dd-reason" type="text" required placeholder="مثال: تلف أخشاب شدة / إعادة تكسير" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <label class="block p-2.5 rounded-xl border border-dashed border-rose-500/50 bg-slate-950 text-center cursor-pointer"><span class="font-bold text-rose-300"><i class="fa-solid fa-camera me-1"></i> صورة إثبات المخالفة / التلف</span><input type="file" accept="image/*" class="hidden" onchange="DamanChat.handleTempPhoto(this,'deduct')" /><div id="dd-photo-prev"></div></label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-rose-500 text-white font-black">إرسال إشعار الخصم للطرف الآخر</button>
          </form>
        </div>`;
    },

    async submitDeduction(e, agId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const amount = Math.round((parseFloat(document.getElementById('dd-amt').value) || 0) * 100) / 100;
      const reason = document.getElementById('dd-reason').value.trim();
      if (amount <= 0 || amount > Number(ag.remainingEscrow || 0)) return app.toast('قيمة الخصم أكبر من المتبقي بالضمان', 'error');
      try {
        const photoMedia = this.tempDeductPhoto ? await app.saveMedia(this.tempDeductPhoto, { kind: 'deduction' }) : '';
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingDeduction: { amount, reason, photoMedia, date: app.todayLocal(), byName: app.profile?.name || '' }
        });
        document.getElementById('daman-deduct-modal').classList.add('hidden');
        await app.sendNotification(ag.providerUid, `إشعار خصم/جزاء (${app.fmtMoney(amount)} ج.م)`, reason);
        app.toast('تم إرسال طلب الخصم للمقاول للموافقة أو التحكيم', 'info');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    async respondDeduction(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingDeduction) return;
      const dd = ag.pendingDeduction;

      if (!approve) {
        if (!window.confirm('رفض الخصم وتحويله للتحكيم أمام إدارة ضمان سايت؟')) return;
        await this.openDisputeOnAgreement(agId, `اعتراض على خصم بقيمة ${app.fmtMoney(dd.amount)} ج.م — السبب: ${dd.reason}`);
        await app.db.collection('chatAgreements').doc(agId).update({ pendingDeduction: null }).catch(() => {});
        return;
      }

      const payerRef = app.db.collection('users').doc(ag.payerUid);
      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        await app.db.runTransaction(async (tx) => {
          const [pDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(agRef)]);
          const curRem = Number(aDoc.data().remainingEscrow || 0);
          if (curRem < dd.amount) throw new Error('المتبقي لا يكفي');
          tx.update(payerRef, {
            balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - dd.amount) * 100) / 100),
            balanceAvailable: Math.round((Number((pDoc.data() || {}).balanceAvailable || 0) + dd.amount) * 100) / 100
          });
          tx.update(agRef, {
            remainingEscrow: Math.round((curRem - dd.amount) * 100) / 100,
            approvedDeductions: Math.round((Number(aDoc.data().approvedDeductions || 0) + dd.amount) * 100) / 100,
            pendingDeduction: null
          });
        });
        await this.logAgreementEvent(agId, { kind: 'deduction', label: `خصم/جزاء معتمد: ${dd.reason}`, amount: dd.amount, photoMedia: dd.photoMedia || '', by: app.profile?.name || '' });
        app.toast('تم اعتماد الخصم وردّه لرصيد صاحب العمل', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async requestAdvance(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !this.requireApprovedContract(ag)) return;
      const amount = parseFloat(window.prompt(`مبلغ السلفة المطلوبة (المتبقي بالضمان: ${app.fmtMoney(ag.remainingEscrow)} ج.م):`, '500'));
      if (!amount || amount <= 0 || amount > Number(ag.remainingEscrow || 0)) return app.toast('أدخل مبلغاً صحيحاً في حدود المتبقي', 'warning');
      const reason = window.prompt('سبب السلفة:', 'سلفة تشغيل / مصاريف موقع') || 'سلفة';
      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingAdvance: { amount, reason, byUid: app.user.uid, byName: app.profile?.name || '', date: app.todayLocal() }
        });
        await app.sendNotification(ag.payerUid, `طلب سلفة (${app.fmtMoney(amount)} ج.م)`, reason);
        app.toast('تم إرسال طلب السلفة لصاحب العمل', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async respondAdvance(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingAdvance || !this.requireApprovedContract(ag)) return;
      const adv = ag.pendingAdvance;
      if (!approve) {
        await app.db.collection('chatAgreements').doc(agId).update({ pendingAdvance: null });
        return app.toast('تم رفض السلفة', 'info');
      }
      await app.withLock('adv_' + agId, async () => {
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        const agRef = app.db.collection('chatAgreements').doc(agId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef), tx.get(agRef)]);
            const curRem = Number(aDoc.data().remainingEscrow || 0);
            if (curRem < adv.amount) throw new Error('الرصيد المتبقي بالضمان غير كافٍ');
            tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - adv.amount) * 100) / 100) });
            tx.update(provRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + adv.amount) * 100) / 100 });
            tx.update(agRef, {
              remainingEscrow: Math.round((curRem - adv.amount) * 100) / 100,
              paidSoFar: Math.round((Number(aDoc.data().paidSoFar || 0) + adv.amount) * 100) / 100,
              pendingAdvance: null
            });
            tx.set(app.db.collection('transactions').doc(), {
              userId: ag.providerUid, type: 'advance_paid', amount: adv.amount,
              note: `سلفة من العقد ${ag.ticketNumber}: ${adv.reason}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          await this.logAgreementEvent(agId, { kind: 'advance_paid', label: `صرف سلفة (${adv.reason})`, amount: adv.amount, by: app.profile?.name || '' });
          app.toast('تم صرف السلفة لمحفظة المنفّذ ✅', 'success');
        } catch (e) { app.toast(e.message, 'error'); }
      });
    },

    openMovementModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !this.requireApprovedContract(ag)) return;
      this.tempInvoicePhoto = '';
      let m = document.getElementById('daman-chat-move-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-chat-move-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const isPayer = ag.payerUid === app.user.uid;
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-sky-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="text-sm font-black text-sky-400">توثيق عهدة خامات / دفعة صرف</h3><button onclick="document.getElementById('daman-chat-move-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button></div>
          <form onsubmit="DamanChat.submitMovement(event,'${agId}')" class="space-y-2.5">
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">النوع</label><select id="mv-kind" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-sky-500/40 font-bold text-white"><option value="custody">عهدة شراء خامات / فواتير موقع</option>${isPayer ? `<option value="payout">صرف دفعة / مستخلص من الضمان للمنفّذ</option>` : ''}</select></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">المبلغ (ج.م)</label><input id="mv-amt" type="number" min="1" step="any" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 font-bold text-white" /></div>
            <div><label class="block text-[11px] font-bold text-slate-300 mb-1">البيان</label><input id="mv-note" type="text" required placeholder="مثال: فاتورة مسامير وسلك رباط / مستخلص 1" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <label class="block p-2.5 rounded-xl border border-dashed border-amber-500/50 bg-slate-950 text-center cursor-pointer"><span class="font-bold text-amber-300"><i class="fa-solid fa-receipt me-1"></i> صورة الفاتورة (اختياري)</span><input type="file" accept="image/*" class="hidden" onchange="DamanChat.handleTempPhoto(this,'inv')" /><div id="mv-photo-prev"></div></label>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black">حفظ وتوثيق</button>
          </form>
        </div>`;
    },

    async submitMovement(e, agId) {
      e.preventDefault();
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const kind = document.getElementById('mv-kind').value;
      const amount = Math.round((parseFloat(document.getElementById('mv-amt').value) || 0) * 100) / 100;
      const note = document.getElementById('mv-note').value.trim();
      if (amount <= 0) return;

      await app.withLock('mv_' + agId, async () => {
        try {
          const photoMedia = this.tempInvoicePhoto ? await app.saveMedia(this.tempInvoicePhoto, { kind: 'contract_invoice' }) : '';
          if (kind === 'payout' && ag.payerUid === app.user.uid) {
            const payerRef = app.db.collection('users').doc(ag.payerUid);
            const provRef = app.db.collection('users').doc(ag.providerUid);
            const agRef = app.db.collection('chatAgreements').doc(agId);
            await app.db.runTransaction(async (tx) => {
              const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef), tx.get(agRef)]);
              const curRem = Number(aDoc.data().remainingEscrow || 0);
              if (curRem < amount) throw new Error('الرصيد المتبقي بالضمان غير كافٍ');
              tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - amount) * 100) / 100) });
              tx.update(provRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + amount) * 100) / 100 });
              tx.update(agRef, {
                remainingEscrow: Math.round((curRem - amount) * 100) / 100,
                paidSoFar: Math.round((Number(aDoc.data().paidSoFar || 0) + amount) * 100) / 100
              });
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.providerUid, type: 'milestone_payout', amount,
                note: `دفعة/مستخلص من العقد ${ag.ticketNumber}: ${note}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            });
          }
          await this.logAgreementEvent(agId, {
            kind,
            label: `${kind === 'payout' ? 'صرف دفعة/مستخلص' : 'توثيق عهدة وفاتورة خامات'}: ${note}`,
            amount, photoMedia, by: app.profile?.name || ''
          });
          document.getElementById('daman-chat-move-modal').classList.add('hidden');
          app.toast('تم التوثيق بنجاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== PROVIDER COMPLETION NOTICE & DIRECT DISPUTE ====================
    async notifyWorkCompleted(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      await app.db.collection('chatAgreements').doc(agId).update({
        workCompletedNoticeAt: Date.now()
      });
      await this.logAgreementEvent(agId, { kind: 'notice', label: 'إشعار رسمي من المنفّذ بإتمام العمل وطلب الاستلام والتحرير', amount: 0, by: app.profile?.name || '' });
      await app.sendNotification(ag.payerUid, `إشعار إتمام العمل (${ag.ticketNumber})`, `أبلغ ${app.profile?.name} بإتمام العمل — يرجى المعاينة وتأكيد الاستلام النهائي.`);
      app.toast('تم إرسال إشعار إتمام العمل لصاحب العمل ✅', 'success');
    },

    async openDisputeOnAgreement(agId, presetReason = '') {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const reason = presetReason || window.prompt('اكتب سبب رفع النزاع لإدارة ضمان سايت بالتفصيل:');
      if (!reason || !reason.trim()) return;
      try {
        await app.db.collection('chatAgreements').doc(agId).update({ status: 'disputed' });
        await app.db.collection('disputes').add({
          agreementId: agId,
          chatId: this.activeChatId,
          contractNumber: ag.ticketNumber,
          projectTitle: ag.title,
          contractAmount: Number(ag.remainingEscrow || 0),
          lockedFee: Number(ag.lockedFee || 0),
          clientId: ag.payerUid,
          providerId: ag.providerUid,
          openedByUid: app.user.uid,
          reason: reason.trim(),
          status: 'open',
          date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await this.logAgreementEvent(agId, { kind: 'dispute', label: `رفع نزاع رسمي للإدارة: ${reason.trim()}`, amount: 0, by: app.profile?.name || '' });
        await app.sendNotification('ADMIN', `نزاع رسمي جديد ⚖️ (${ag.ticketNumber})`, reason.trim());
        app.toast('تم تجميد الرصيد ورفع النزاع رسمياً لإدارة ضمان سايت ⚖️', 'warning');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== MUTUAL TERMINATION (PROPORTIONAL 3.5% FEE) ====================
    async requestTermination(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      const rem = Number(ag.remainingEscrow || 0);
      const reason = window.prompt('سبب طلب فسخ العقد:', 'إنهاء العمل بالتراضي');
      if (!reason) return;
      const workerShare = parseFloat(window.prompt(`المتبقي بالضمان: ${app.fmtMoney(rem)} ج.م.\nالمبلغ المقترح صرفه للمنفّذ من المتبقي (والباقي + فرق العمولة يرجع لصاحب العمل):`, '0'));
      if (isNaN(workerShare) || workerShare < 0 || workerShare > rem) return app.toast('أدخل مبلغاً صحيحاً', 'error');
      const clientRefund = Math.round((rem - workerShare) * 100) / 100;
      try {
        await app.db.collection('chatAgreements').doc(agId).update({
          pendingTermination: { reason: reason.trim(), workerShare, clientRefund, proposedByUid: app.user.uid, proposedByName: app.profile?.name || '', date: app.todayLocal() }
        });
        const peer = app.user.uid === ag.payerUid ? ag.providerUid : ag.payerUid;
        await app.sendNotification(peer, `طلب فسخ العقد (${ag.ticketNumber})`, `للمنفّذ: ${app.fmtMoney(workerShare)} | لصاحب العمل: ${app.fmtMoney(clientRefund)}`);
        app.toast('تم إرسال طلب فسخ العقد للطرف الآخر', 'info');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    async respondTermination(agId, approve) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || !ag.pendingTermination) return;
      const tm = ag.pendingTermination;

      if (!approve) {
        if (!window.confirm('رفض شروط الفسخ وتحويل العقد لنزاع أمام الإدارة؟')) return;
        await app.db.collection('chatAgreements').doc(agId).update({ pendingTermination: null });
        return this.openDisputeOnAgreement(agId, `خلاف على شروط فسخ العقد: ${tm.reason}`);
      }

      // Proportional 3.5% Fee on ACTUAL executed work only; refund unused principal + unused fee!
      const executedTotal = Math.round((Number(ag.paidSoFar || 0) + tm.workerShare) * 100) / 100;
      const rate = app.getCommissionRate();
      const earnedFee = Math.min(Number(ag.lockedFee || 0), Math.round(executedTotal * rate * 100) / 100);
      const unusedFeeRefund = Math.max(0, Math.round((Number(ag.lockedFee || 0) - earnedFee) * 100) / 100);
      const totalClientBack = Math.round((tm.clientRefund + unusedFeeRefund) * 100) / 100;

      if (!window.confirm(`تأكيد فسخ العقد وتصفيته؟\n• يُصرف للمنفّذ: ${app.fmtMoney(tm.workerShare)} ج.م\n• يُرد لصاحب العمل (مع فرق العمولة): ${app.fmtMoney(totalClientBack)} ج.م\n• عمولة المنصة على المنفّذ فقط: ${app.fmtMoney(earnedFee)} ج.م`)) return;

      await app.withLock('term_' + agId, async () => {
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        const agRef = app.db.collection('chatAgreements').doc(agId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef), tx.get(agRef)]);
            const a = aDoc.data();
            const totalEscrowHeld = Math.round((Number(a.remainingEscrow || 0) + Number(a.lockedFee || 0)) * 100) / 100;
            tx.update(payerRef, {
              balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - totalEscrowHeld) * 100) / 100),
              balanceAvailable: Math.round((Number((pDoc.data() || {}).balanceAvailable || 0) + totalClientBack) * 100) / 100
            });
            if (tm.workerShare > 0) {
              tx.update(provRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + tm.workerShare) * 100) / 100 });
            }
            tx.update(agRef, { status: 'cancelled', remainingEscrow: 0, lockedFee: 0, pendingTermination: null });
            if (earnedFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                agreementId: agId, type: 'escrow_35_partial', ticketNumber: a.ticketNumber, amount: earnedFee,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          await this.logAgreementEvent(agId, { kind: 'cancelled', label: `فسخ بالتراضي (${tm.reason}) — للمنفّذ ${app.fmtMoney(tm.workerShare)} | رُدّ للعميل ${app.fmtMoney(totalClientBack)}`, amount: tm.workerShare, by: app.profile?.name || '' });
          await this.syncChatActiveDealFlag(this.activeChatId);
          app.toast('تم فسخ العقد وتصفية المستحقات بدقة ✅', 'success');
        } catch (e) { app.toast(e.message, 'error'); }
      });
    },

    // ==================== FINAL HANDOVER (ABSENT WORKERS REFUND + RETENTION %) ====================
    async confirmFinalHandover(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.payerUid !== app.user.uid || !this.requireApprovedContract(ag)) return;

      const rem = Number(ag.remainingEscrow || 0);
      let workerPayout = rem;

      // For Daily contracts with confirmed attendance, protect Payer from paying for absent workers!
      if (ag.type === 'daily' && Number(ag.confirmedEarnedTotal || 0) > 0) {
        const netEarnedRemaining = Math.max(0, Math.round((Number(ag.confirmedEarnedTotal || 0) - Number(ag.paidSoFar || 0) - Number(ag.approvedDeductions || 0)) * 100) / 100);
        const suggested = Math.min(rem, netEarnedRemaining);
        const inp = parseFloat(window.prompt(
          `تسوية عقد اليومية (${ag.ticketNumber}):\n• المستحق الفعلي المتبقي حسب الحضور المؤكد: ${app.fmtMoney(suggested)} ج.م\n• إجمالي المتبقي بالضمان: ${app.fmtMoney(rem)} ج.م\n(أي فرق غير مستحق يرجع لمحفظتك تلقائياً)\n\nأدخل المبلغ النهائي المراد صرفه للمنفّذ:`,
          suggested
        ));
        if (isNaN(inp) || inp < 0 || inp > rem) return app.toast('أدخل مبلغاً صحيحاً', 'error');
        workerPayout = Math.round(inp * 100) / 100;
      }

      const retPct = Number(ag.retentionPct || 0);
      const retentionHold = retPct > 0 ? Math.round((workerPayout * retPct) / 100 * 100) / 100 : 0;
      const immediateWorkerPay = Math.round((workerPayout - retentionHold) * 100) / 100;
      const unusedPrincipalBack = Math.max(0, Math.round((rem - workerPayout) * 100) / 100);

      const executedTotal = Math.round((Number(ag.paidSoFar || 0) + workerPayout) * 100) / 100;
      const earnedFee = Math.min(Number(ag.lockedFee || 0), Math.round(executedTotal * app.getCommissionRate() * 100) / 100);
      const unusedFeeBack = Math.max(0, Math.round((Number(ag.lockedFee || 0) - earnedFee) * 100) / 100);
      const totalClientRefund = Math.round((unusedPrincipalBack + unusedFeeBack) * 100) / 100;

      const summaryMsg = `تأكيد الاستلام النهائي للعقد ${ag.ticketNumber}:\n• يُصرف للمنفّذ فوراً: ${app.fmtMoney(immediateWorkerPay)} ج.م`
        + (retentionHold > 0 ? `\n• يُحجز تأمين أعمال (${retPct}%): ${app.fmtMoney(retentionHold)} ج.م` : '')
        + (totalClientRefund > 0 ? `\n• يُرد لمحفظتك (فائض + فرق العمولة): ${app.fmtMoney(totalClientRefund)} ج.م` : '');
      if (!window.confirm(summaryMsg)) return;

      await app.withLock('handover_' + agId, async () => {
        const payerRef = app.db.collection('users').doc(ag.payerUid);
        const provRef = app.db.collection('users').doc(ag.providerUid);
        const agRef = app.db.collection('chatAgreements').doc(agId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [pDoc, wDoc, aDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef), tx.get(agRef)]);
            const a = aDoc.data();
            const escRelease = Math.round((Number(a.remainingEscrow || 0) + Number(a.lockedFee || 0) - retentionHold) * 100) / 100;
            tx.update(payerRef, {
              balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - escRelease) * 100) / 100),
              balanceAvailable: Math.round((Number((pDoc.data() || {}).balanceAvailable || 0) + totalClientRefund) * 100) / 100
            });
            if (immediateWorkerPay > 0) {
              tx.update(provRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + immediateWorkerPay) * 100) / 100 });
            }
            tx.update(agRef, {
              status: retentionHold > 0 ? 'retention_hold' : 'completed',
              remainingEscrow: retentionHold,
              lockedFee: 0,
              paidSoFar: Math.round((Number(a.paidSoFar || 0) + immediateWorkerPay) * 100) / 100,
              completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (immediateWorkerPay > 0) {
              tx.set(app.db.collection('transactions').doc(), {
                userId: ag.providerUid, type: 'final_settlement', amount: immediateWorkerPay,
                note: `تصفية واستلام نهائي للعقد ${a.ticketNumber}`, date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
            if (earnedFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                agreementId: agId, type: 'escrow_35', ticketNumber: a.ticketNumber, amount: earnedFee,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          await this.logAgreementEvent(agId, { kind: 'completed', label: `استلام نهائي وتصفية (للمنفّذ ${app.fmtMoney(immediateWorkerPay)} ج.م)`, amount: immediateWorkerPay, by: app.profile?.name || '' });
          await this.syncChatActiveDealFlag(this.activeChatId);
          await app.sendNotification(ag.providerUid, `تم الاستلام النهائي للعقد ${ag.ticketNumber} ✅`, `تم تحويل ${app.fmtMoney(immediateWorkerPay)} ج.م لمحفظتك.`);
          app.toast('تم الاستلام النهائي وتصفية الحساب بنجاح ✅', 'success');
          this.openAutoRatingModal(ag.providerUid, ag.providerName, ag.title);
        } catch (e) { app.toast(e.message, 'error'); }
      });
    },

    async releaseRetention(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag || ag.payerUid !== app.user.uid) return;
      const amt = Number(ag.remainingEscrow || 0);
      if (!window.confirm(`تحرير مبلغ تأمين الأعمال (${app.fmtMoney(amt)} ج.م) وإغلاق العقد نهائياً؟`)) return;
      const payerRef = app.db.collection('users').doc(ag.payerUid);
      const provRef = app.db.collection('users').doc(ag.providerUid);
      const agRef = app.db.collection('chatAgreements').doc(agId);
      try {
        await app.db.runTransaction(async (tx) => {
          const [pDoc, wDoc] = await Promise.all([tx.get(payerRef), tx.get(provRef)]);
          tx.update(payerRef, { balanceEscrow: Math.max(0, Math.round((Number((pDoc.data() || {}).balanceEscrow || 0) - amt) * 100) / 100) });
          tx.update(provRef, { balanceAvailable: Math.round((Number((wDoc.data() || {}).balanceAvailable || 0) + amt) * 100) / 100 });
          tx.update(agRef, { status: 'completed', remainingEscrow: 0 });
        });
        await this.syncChatActiveDealFlag(this.activeChatId);
        app.toast('تم تحرير تأمين الأعمال وإغلاق العقد بالكامل ✅', 'success');
      } catch (e) { app.toast(e.message, 'error'); }
    },

    // ==================== AUTO-RATING MODAL ====================
    openAutoRatingModal(targetUid, targetName, title) {
      let m = document.getElementById('daman-rate-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-rate-modal';
        m.className = 'daman-modal fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <h3 class="text-sm font-black text-amber-400 text-center">⭐ قيّم تجربتك مع ${window.DamanApp.esc(targetName)}</h3>
          <p class="text-[11px] text-slate-300 text-center">${window.DamanApp.esc(title)}</p>
          <form onsubmit="DamanChat.submitRating(event,'${targetUid}')" class="space-y-2.5">
            <select id="rt-stars" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-400 font-black text-center">
              <option value="5">★★★★★ (5 - ممتاز جداً)</option>
              <option value="4">★★★★☆ (4 - جيد جداً)</option>
              <option value="3">★★★☆☆ (3 - مقبول)</option>
              <option value="2">★★☆☆☆ (2 - ضعيف)</option>
              <option value="1">★☆☆☆☆ (1 - سيء)</option>
            </select>
            <textarea id="rt-comment" rows="2" required placeholder="اكتب رأيك في الالتزام والجودة..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
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
          rating, comment, date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        const uRef = app.db.collection('users').doc(targetUid);
        await app.db.runTransaction(async (tx) => {
          const uDoc = await tx.get(uRef);
          if (!uDoc.exists) return;
          const d = uDoc.data();
          const newC = Number(d.ratingCount || 0) + 1;
          const newAvg = Math.round(((Number(d.ratingAvg || 5) * Number(d.ratingCount || 0) + rating) / newC) * 10) / 10;
          tx.update(uRef, { ratingCount: newC, ratingAvg: newAvg });
        });
        document.getElementById('daman-rate-modal').classList.add('hidden');
        app.toast('شكراً لتقييمك ⭐', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== EVENTS TIMELINE MODAL (SUBCOLLECTION) ====================
    async openTimelineModal(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;
      let m = document.getElementById('daman-chat-tl-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-chat-tl-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-5 text-center text-xs text-slate-300">جارٍ تحميل سجل العقد...</div>`;

      let events = [];
      try {
        const snap = await app.db.collection('chatAgreements').doc(agId).collection('events').limit(80).get();
        events = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-4 max-h-[88vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">سجل العقد (${app.esc(ag.ticketNumber)})</h3>
            <button onclick="document.getElementById('daman-chat-tl-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          ${ag.signedContractMedia ? `<button onclick="DamanApp.openMediaLightbox('${ag.signedContractMedia}','العقد الموقّع ${app.esc(ag.ticketNumber)}')" class="w-full py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black"><i class="fa-solid fa-file-contract me-1"></i> عرض صورة العقد الموقّع</button>` : ''}
          <div class="space-y-2">
            ${!events.length
              ? '<div class="text-center text-slate-400 py-5">لا توجد حركات مسجّلة بعد</div>'
              : events.map((ev) => `
                <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div class="flex justify-between gap-2">
                    <div>
                      <div class="font-bold text-white">${app.esc(ev.label)}</div>
                      <div class="text-[10px] text-slate-400">${app.esc(ev.date || '')} — ${app.esc(ev.by || '')}</div>
                    </div>
                    ${ev.amount ? `<span class="font-black text-emerald-400 shrink-0">${app.fmtMoney(ev.amount)} ج.م</span>` : ''}
                  </div>
                  ${ev.photoMedia ? `<button onclick="DamanApp.openMediaLightbox('${ev.photoMedia}','مرفق العقد')" class="text-[10px] text-amber-300 underline font-bold"><i class="fa-solid fa-image me-1"></i> عرض الصورة المرفقة</button>` : ''}
                </div>`).join('')}
          </div>
        </div>`;
    },

    // ==================== INTERNAL A4 LEGAL CONTRACT PRINT (APK SAFE + LEGAL IDs + QR + SIGNATURES) ====================
    printAgreementA4(agId) {
      const app = window.DamanApp;
      const ag = this.agreements.find((a) => a.id === agId);
      if (!ag) return;

      // STRICT RULE: Cannot print official contract before 100% funding is locked!
      if (ag.status === 'proposed') {
        return app.toast('لا يمكن طباعة العقد الرسمي قبل حجز 100% من المبلغ + 3.5% في الضمان', 'error');
      }

      const p1 = ag.payerLegal || {};
      const p2 = ag.providerLegal || {};
      const party1Desc = p1.accountType && p1.accountType !== 'individual'
        ? `<b>${app.esc(p1.companyName || ag.payerName)}</b> (سجل تجاري: ${app.esc(p1.commercialReg || '—')} / ضريبية: ${app.esc(p1.taxCard || '—')}) — ويمثلها قانوناً: <b>${app.esc(p1.legalName || '—')}</b>`
        : `<b>${app.esc(p1.legalName || ag.payerName)}</b>`;
      const party2Desc = p2.accountType && p2.accountType !== 'individual'
        ? `<b>${app.esc(p2.companyName || ag.providerName)}</b> (سجل تجاري: ${app.esc(p2.commercialReg || '—')} / ضريبية: ${app.esc(p2.taxCard || '—')}) — ويمثلها قانوناً: <b>${app.esc(p2.legalName || '—')}</b>`
        : `<b>${app.esc(p2.legalName || ag.providerName)}</b>`;

      const specDetail = ag.type === 'supply'
        ? `توريد خامات: ${ag.unitQty} ${app.esc(ag.unitName || 'وحدة')} × ${app.fmtMoney(ag.unitPrice)} ج.م`
        : ag.type === 'meter' ? `بالمتر: ${ag.unitQty} متر × ${app.fmtMoney(ag.unitPrice)} ج.م`
        : ag.type === 'daily' ? `باليومية: ${ag.workers} عمال × ${app.fmtMoney(ag.dailyRate)} ج.م × ${ag.totalDays} أيام`
        : this.typeLabel(ag.type);

      const verifyUrl = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(ag.ticketNumber)}`;

      const html = `
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:16px;">عقد اتفاق وتعاقد رسمي — ضمان سايت</h2>
              <div style="font-size:11px;">DamanSite Official Escrow-Backed Contract (Funded 100%)</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="font-size:11px; text-align:left;">
                <div><b>كود العقد:</b> ${app.esc(ag.ticketNumber)}</div>
                <div><b>التاريخ:</b> ${app.todayLocal()}</div>
                <div><b>الضمان:</b> محجوز 100%</div>
              </div>
              <div id="print-contract-qr" style="width:68px; height:68px;"></div>
            </div>
          </div>

          <table style="margin-bottom:10px;">
            <tr><th style="width:22%;">الطرف الأول (صاحب العمل)</th><td colspan="3">${party1Desc}</td></tr>
            <tr><th>الرقم القومي (14 رقم)</th><td><b>${app.esc(p1.nationalId || 'موثّق بالإدارة')}</b></td><th>العنوان بالبطاقة</th><td>${app.esc(p1.legalAddress || '—')}</td></tr>
            <tr><th>الطرف الثاني (المنفّذ / المورّد)</th><td colspan="3">${party2Desc}</td></tr>
            <tr><th>الرقم القومي (14 رقم)</th><td><b>${app.esc(p2.nationalId || 'موثّق بالإدارة')}</b></td><th>العنوان بالبطاقة</th><td>${app.esc(p2.legalAddress || '—')}</td></tr>
          </table>

          <table style="margin-bottom:10px;">
            <tr><th style="width:22%;">بند العمل / التوريد</th><td colspan="3"><b>${app.esc(ag.title)}</b></td></tr>
            <tr><th>التفاصيل والكمية</th><td colspan="3">${specDetail}</td></tr>
            <tr><th>نظام الصرف</th><td>${this.payModeLabel(ag.payMode)}</td><th>تأمين الأعمال</th><td>${Number(ag.retentionPct || 0)}%</td></tr>
            <tr><th>إجمالي قيمة التعاقد</th><td><b>${app.fmtMoney(ag.totalAmount)} ج.م</b></td><th>عمولة الضمان (3.5%)</th><td>${app.fmtMoney(ag.commissionFee)} ج.م</td></tr>
          </table>

          <div style="border:1px solid #000; padding:7px 10px; margin-bottom:12px; font-size:10.5px;">
            <b>الشروط القانونية الملزمة:</b><br/>
            1. تم حجز 100% من إجمالي قيمة العقد والعمولة في حساب الضمان المالي بمنصة ضمان سايت، ولا يُصرف أي مبلغ إلا بعد رفع نسخة هذا العقد موقّعة من الطرفين واعتمادها من الإدارة.<br/>
            2. تُعتمد بيانات البطاقة القومية المثبتة أعلاه كبيانات قانونية ملزمة للطرفين، وتُعد تقارير الحضور والإنجاز والخصومات والملاحق المموّلة داخل المنصة جزءاً لا يتجزأ من هذا العقد.<br/>
            3. للتحقق من سريان هذا العقد وقيمته الفعلية، يُمسح كود الـ QR أعلاه أو يُدخل الكود (${app.esc(ag.ticketNumber)}) داخل تطبيق ضمان سايت.
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; text-align:center;">
            <div style="border:1px solid #000; padding:8px; min-height:92px;">
              <b>توقيع الطرف الأول (صاحب العمل)</b><br/>
              <span style="font-size:10px;">${app.esc(p1.legalName || '')}</span>
              ${ag.payerSignature ? `<div><img src="${ag.payerSignature}" style="max-height:54px; margin:4px auto 0;" /></div>` : '<div style="height:44px;"></div>'}
            </div>
            <div style="border:1px solid #000; padding:8px; min-height:92px;">
              <b>توقيع الطرف الثاني (المنفّذ / المورّد)</b><br/>
              <span style="font-size:10px;">${app.esc(p2.legalName || '')}</span>
              ${ag.providerSignature ? `<div><img src="${ag.providerSignature}" style="max-height:54px; margin:4px auto 0;" /></div>` : '<div style="height:44px;"></div>'}
            </div>
          </div>
        </div>`;

      window.DamanPrint(html, (area) => {
        const qrEl = area.querySelector('#print-contract-qr');
        if (qrEl && window.QRCode) {
          new QRCode(qrEl, { text: verifyUrl, width: 66, height: 66, colorDark: '#000000', colorLight: '#ffffff' });
        }
      });
    },

    // ==================== AI & TICKETS ====================
    getAiReply(rawText) {
      const q = (rawText || '').toLowerCase();
      if (/تمديد|اضافي|سهر/.test(q)) return { text: '📅 لتمديد العقد أو إضافة سهرة، اضغط زرار **«تمديد / إضافي»** جوه العقد النشط؛ بيتحجز 100% من قيمته + 3.5% أوتوماتيك وينزل كملحق رسمي.', action: null };
      if (/3x|استلام|شدة|سقف/.test(q)) return { text: '🛡️ نستلم الشدات والأسقف والمحارة بضمان مادي يصل لـ **3 أضعاف قيمة الخدمة**.', action: { label: 'اطلب استلام 3x', fn: "if(window.DamanProjects) DamanProjects.setSubTab('inspection'); DamanApp.switchTab('projects')" } };
      return { text: 'تقدر تسألني عن الضمان المالي 100%، تمديد العقود، الموردين B2B، أو تتواصل مباشرة مع **إدارة ضمان سايت**.', action: { label: 'كلّم الإدارة مباشرة', fn: "DamanChat.openDirectChat('admin','إدارة ضمان سايت')" } };
    },

    askAi(preset) {
      const inp = document.getElementById('ai-chat-input');
      const text = preset || (inp ? inp.value.trim() : '');
      if (!text) return;
      if (inp) inp.value = '';
      this.aiHistory.push({ sender: 'user', text });
      const rep = this.getAiReply(text);
      this.aiHistory.push({ sender: 'ai', text: rep.text, action: rep.action });
      this.rerender();
    },

    async submitTicket(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const subj = document.getElementById('tk-subject').value.trim();
      try {
        await app.db.collection('supportTickets').add({
          userId: app.user.uid, userName: app.profile.companyName || app.profile.name || '',
          userEmail: app.profile.email || app.user.email || '', subject: subj,
          message: document.getElementById('tk-message').value.trim(), status: 'open', adminReply: '',
          date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', 'تذكرة دعم جديدة', subj);
        e.target.reset();
        app.toast('تم إرسال تذكرة الدعم بنجاح', 'success');
      } catch (err) { app.toast(err.message, 'error'); }
    },

    // ==================== UI RENDERERS ====================
    renderCallBanner(app) {
      if (!this.callState) return '';
      const st = this.callState.status;
      return `
        <div class="p-3 rounded-2xl bg-gradient-to-r from-emerald-900/90 to-slate-900 border border-emerald-500/60 space-y-2 shadow-xl">
          <div class="text-[10px] text-amber-300 font-bold bg-black/40 px-2.5 py-1 rounded-lg">
            <i class="fa-solid fa-circle-dot text-rose-500 animate-pulse me-1"></i>
            هذه المكالمة مسجّلة لحفظ الحقوق وتُحذف تلقائياً بعد 30 يوماً.
          </div>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="text-xs font-black text-white">
              <i class="fa-solid fa-phone-volume text-emerald-400 me-1.5"></i>
              ${st === 'incoming' ? 'واردة من ' : st === 'calling' ? 'جارٍ الاتصال بـ ' : 'متصل — '}${app.esc(this.callState.otherName)}
            </div>
            <div class="flex items-center gap-1.5">
              ${st === 'incoming' ? `<button onclick="DamanChat.answerVoiceCall()" class="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">رد</button>` : ''}
              ${st === 'connected' ? `
                <button onclick="DamanChat.toggleMuteMic()" class="px-2.5 py-1.5 rounded-xl ${this.callState.muted ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-white'} font-bold text-[10px]">
                  <i class="fa-solid ${this.callState.muted ? 'fa-microphone-slash' : 'fa-microphone'}"></i>
                </button>
                <button onclick="DamanChat.forcePlayRemoteAudio()" class="px-2.5 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px]" title="تنشيط السماعة">
                  <i class="fa-solid fa-volume-high"></i>
                </button>` : ''}
              <button onclick="DamanChat.endVoiceCall()" class="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-black text-xs">إنهاء</button>
            </div>
          </div>
        </div>`;
    },

    renderAgreementsBar(app) {
      if (this.isPureSupportChat() || !this.agreements.length) return '';
      const ag = this.agreements.find((a) => a.id === this.selectedAgId) || this.agreements[0];
      const myUid = app.user?.uid;
      const isPayer = ag.payerUid === myUid;
      const isProvider = ag.providerUid === myUid;
      const approved = ag.contractStatus === 'approved';
      const lastDayAlert = ag.status === 'active' && ag.type === 'daily' && Number(ag.totalDays || 0) > 0 && Number(ag.confirmedDays || 0) >= Number(ag.totalDays) - 1;

      const tabsHtml = this.agreements.length > 1 ? `
        <div class="flex items-center gap-1 overflow-x-auto pb-1">
          ${this.agreements.map((x) => `
            <button onclick="DamanChat.selectedAgId='${x.id}'; DamanChat.updateAgreementsDOM()" class="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black ${x.id === ag.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}">${app.esc(x.ticketNumber)}</button>`).join('')}
        </div>` : '';

      const csHtml = approved
        ? `<span class="text-[10px] font-black text-emerald-300">✅ العقد الموقّع معتمد من الإدارة — الصرف والتشغيل مفعّلان</span>`
        : ag.contractStatus === 'pending_admin'
        ? `<span class="text-[10px] font-bold text-amber-300">⏳ تم رفع العقد الموقّع — بانتظار اعتماد الإدارة لفتح الصرف</span>`
        : ag.contractStatus === 'rejected'
        ? `<span class="text-[10px] font-bold text-rose-300">❌ رُفضت صورة العقد — يرجى إعادة رفع نسخة واضحة وموقّعة</span>`
        : `<span class="text-[10px] font-bold text-amber-200">📄 شرط التشغيل: وقّعا العقد إلكترونياً أو اطبعاه وارفعوا النسخة الموقّعة للإدارة</span>`;

      return `
        <div class="p-3 rounded-2xl bg-slate-900/95 border border-amber-500/50 space-y-2 text-xs">
          ${tabsHtml}
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-black text-amber-400 truncate">${app.esc(ag.ticketNumber)} • ${this.typeLabel(ag.type)}</div>
              <div class="text-[11px] font-bold text-white truncate">${app.esc(ag.title)}</div>
            </div>
            <div class="text-end shrink-0">
              <div class="font-black text-emerald-400">${app.fmtMoney(ag.totalAmount)} ج.م</div>
              <div class="text-[9.5px] text-slate-400">المتبقي بالضمان: ${app.fmtMoney(ag.remainingEscrow)} ج.م</div>
            </div>
          </div>

          ${ag.status === 'proposed' ? `
            <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[10px] text-amber-200">
              عرض سعر مبدئي غير ملزم — لن يُصدر العقد الرسمي إلا بعد حجز <b>100% من القيمة + 3.5% (${app.fmtMoney(ag.grandTotalWithFee)} ج.م)</b>.
            </div>
            <div class="flex gap-1.5">
              ${isPayer ? `<button onclick="DamanChat.acceptAgreement('${ag.id}')" class="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10.5px]">موافقة وحجز 100% (${app.fmtMoney(ag.grandTotalWithFee)} ج.م)</button>` : ''}
              <button onclick="DamanChat.rejectOrCancelAgreement('${ag.id}')" class="${isPayer ? 'px-3' : 'flex-1'} py-2 rounded-xl bg-rose-500/20 text-rose-300 font-black text-[10.5px]">${isPayer ? 'رفض' : 'إلغاء العرض'}</button>
            </div>` : ''}

          ${ag.status === 'proposed_funded' ? `
            <div class="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-[10px] text-emerald-200 font-bold">
              🔒 تم حجز 100% من المبلغ (${app.fmtMoney(ag.grandTotalWithFee)} ج.م) من صاحب العمل — بانتظار موافقة المنفّذ.
            </div>
            <div class="flex gap-1.5">
              ${isProvider ? `<button onclick="DamanChat.acceptAgreement('${ag.id}')" class="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10.5px]">موافقة وتفعيل العقد</button>` : ''}
              <button onclick="DamanChat.rejectOrCancelAgreement('${ag.id}')" class="${isProvider ? 'px-3' : 'flex-1'} py-2 rounded-xl bg-rose-500/20 text-rose-300 font-black text-[10.5px]">${isProvider ? 'رفض وردّ المبلغ' : 'إلغاء واسترداد 100%'}</button>
            </div>` : ''}

          ${ag.status === 'active' ? `
            ${lastDayAlert ? `<div class="p-2 rounded-xl bg-amber-500/20 border border-amber-400 text-[10px] text-amber-200 font-black">⏰ تنبيه آخر يوم بالعقد (${ag.confirmedDays}/${ag.totalDays} أيام): اضغط «تمديد/إضافي» لحجز أيام جديدة، أو «استلام نهائي».</div>` : ''}

            <div class="p-2 rounded-xl bg-slate-950 border border-slate-700 space-y-1.5">
              <div>${csHtml}</div>
              <div class="grid grid-cols-3 gap-1">
                <button onclick="DamanChat.openSignatureModal('${ag.id}')" class="py-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 font-black text-[9.5px]">✍️ توقيع باللمس</button>
                <button onclick="DamanChat.printAgreementA4('${ag.id}')" class="py-1.5 rounded-lg bg-white text-slate-950 font-black text-[9.5px]"><i class="fa-solid fa-print me-0.5"></i>طباعة A4</button>
                <label class="py-1.5 rounded-lg ${ag.signedContractMedia ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500 text-slate-950'} font-black text-[9.5px] text-center cursor-pointer">
                  <i class="fa-solid fa-upload me-0.5"></i>${ag.signedContractMedia ? 'تحديث العقد' : 'رفع العقد'}
                  <input type="file" accept="image/*" class="hidden" onchange="DamanChat.uploadSignedContract('${ag.id}', this)" />
                </label>
              </div>
              ${!approved && Number(ag.paidSoFar || 0) === 0 ? `<button onclick="DamanChat.rejectOrCancelAgreement('${ag.id}')" class="w-full py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[9.5px] font-bold">إلغاء قبل بدء العمل واسترداد 100%</button>` : ''}
            </div>

            ${ag.pendingExtension ? `<div class="p-2 rounded-xl bg-purple-500/15 border border-purple-500 space-y-1 text-[10px]"><div class="font-black text-purple-200">📅 طلب تمديد/إضافي: ${app.esc(ag.pendingExtension.note)} (+${app.fmtMoney(ag.pendingExtension.amount)} ج.م | الإجمالي 100%: ${app.fmtMoney(ag.pendingExtension.grand)})</div>${ag.pendingExtension.proposedByUid !== myUid ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondExtension('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة وحجز 100%</button><button onclick="DamanChat.respondExtension('${ag.id}',false)" class="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black">رفض</button></div>` : `<div class="text-slate-300">بانتظار موافقة الطرف الآخر...</div>`}</div>` : ''}
            ${ag.pendingDeduction ? `<div class="p-2 rounded-xl bg-rose-500/15 border border-rose-500 space-y-1 text-[10px]"><div class="font-black text-rose-200">⚠️ إشعار خصم/جزاء: ${app.fmtMoney(ag.pendingDeduction.amount)} ج.م — ${app.esc(ag.pendingDeduction.reason)}</div>${isProvider ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondDeduction('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black">موافقة على الخصم</button><button onclick="DamanChat.respondDeduction('${ag.id}',false)" class="flex-1 py-1.5 rounded-lg bg-rose-600 text-white font-black">رفض وتحكيم الإدارة</button></div>` : `<div class="text-slate-300">بانتظار رد المنفّذ...</div>`}</div>` : ''}
            ${ag.pendingTermination ? `<div class="p-2 rounded-xl bg-rose-950/70 border border-rose-500 space-y-1 text-[10px]"><div class="font-black text-rose-300">طلب فسخ: ${app.esc(ag.pendingTermination.reason)} (للمنفّذ ${app.fmtMoney(ag.pendingTermination.workerShare)})</div>${ag.pendingTermination.proposedByUid !== myUid ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondTermination('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة وتصفية</button><button onclick="DamanChat.respondTermination('${ag.id}',false)" class="flex-1 py-1.5 rounded-lg bg-rose-500 text-white font-black">تحويل لنزاع</button></div>` : `<div class="text-slate-300">بانتظار الرد...</div>`}</div>` : ''}
            ${ag.pendingAdvance ? `<div class="p-2 rounded-xl bg-amber-500/15 border border-amber-500 space-y-1 text-[10px]"><div class="font-bold text-amber-200">💰 طلب سلفة (${app.fmtMoney(ag.pendingAdvance.amount)} ج.م): ${app.esc(ag.pendingAdvance.reason)}</div>${isPayer ? `<div class="flex gap-1.5"><button onclick="DamanChat.respondAdvance('${ag.id}',true)" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة وصرف</button><button onclick="DamanChat.respondAdvance('${ag.id}',false)" class="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-black">رفض</button></div>` : `<div class="text-slate-300">بانتظار الموافقة...</div>`}</div>` : ''}
            ${ag.pendingDayLog ? `<div class="p-2 rounded-xl bg-sky-500/15 border border-sky-500 space-y-1 text-[10px]"><div class="font-bold text-sky-200">👷 حضور اليوم: <b>${ag.pendingDayLog.actualWorkers} عامل</b> — ${app.esc(ag.pendingDayLog.note)}</div>${isPayer ? `<div class="flex gap-1.5"><button onclick="DamanChat.clientApproveActualDay('${ag.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">اعتماد الحضور</button><button onclick="DamanApp.db.collection('chatAgreements').doc('${ag.id}').update({pendingDayLog:null})" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold">مراجعة</button></div>` : `<div class="text-slate-300">بانتظار اعتماد صاحب العمل...</div>`}</div>` : ''}

            ${approved ? `
              <div class="grid grid-cols-3 gap-1">
                ${isProvider && ag.type === 'daily' && !ag.pendingDayLog ? `<button onclick="DamanChat.openDailyLogModal('${ag.id}')" class="py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[9.5px]">تأكيد عمال اليوم</button>` : ''}
                ${isProvider && !ag.pendingAdvance ? `<button onclick="DamanChat.requestAdvance('${ag.id}')" class="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 font-black text-[9.5px]">طلب سلفة</button>` : ''}
                ${!ag.pendingExtension ? `<button onclick="DamanChat.openExtensionModal('${ag.id}')" class="py-1.5 rounded-lg bg-purple-500/25 text-purple-200 font-black text-[9.5px]">+ تمديد / إضافي</button>` : ''}
                <button onclick="DamanChat.openMovementModal('${ag.id}')" class="py-1.5 rounded-lg bg-slate-800 text-sky-300 font-bold text-[9.5px]">عهدة / صرف</button>
                ${isPayer && !ag.pendingDeduction ? `<button onclick="DamanChat.openDeductionModal('${ag.id}')" class="py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[9.5px]">خصم / جزاء</button>` : ''}
                <button onclick="DamanChat.openTimelineModal('${ag.id}')" class="py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold text-[9.5px]">السجل (${Number(ag.eventsCount || 0)})</button>
                ${!ag.pendingTermination ? `<button onclick="DamanChat.requestTermination('${ag.id}')" class="py-1.5 rounded-lg bg-rose-500/15 text-rose-300 font-bold text-[9.5px]">فسخ العقد</button>` : ''}
                <button onclick="DamanChat.openDisputeOnAgreement('${ag.id}')" class="py-1.5 rounded-lg bg-rose-600/30 text-rose-200 font-black text-[9.5px]">⚖️ رفع نزاع</button>
                ${isProvider ? `<button onclick="DamanChat.notifyWorkCompleted('${ag.id}')" class="py-1.5 rounded-lg bg-emerald-500/25 text-emerald-300 font-black text-[9.5px]">أتممت العمل</button>` : ''}
                ${isPayer ? `<button onclick="DamanChat.confirmFinalHandover('${ag.id}')" class="col-span-3 py-2 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]">✓ تأكيد الاستلام النهائي وتصفية الحساب</button>` : ''}
              </div>` : ''}
          ` : ''}

          ${ag.status === 'retention_hold' ? `
            <div class="p-2 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-between gap-2 text-[10px]">
              <span class="text-purple-200 font-bold">🛡️ محجوز تأمين أعمال: ${app.fmtMoney(ag.remainingEscrow)} ج.م</span>
              ${isPayer ? `<button onclick="DamanChat.releaseRetention('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black">تحرير التأمين</button>` : ''}
            </div>` : ''}

          ${ag.status === 'completed' ? `<div class="flex justify-between text-[10px] text-emerald-300 font-bold"><span>✅ عقد مكتمل ومصفّى بالكامل</span><button onclick="DamanChat.openTimelineModal('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white">السجل</button></div>` : ''}
          ${ag.status === 'cancelled' ? `<div class="flex justify-between text-[10px] text-rose-300 font-bold"><span>❌ عقد ملغى / مفسوخ</span><button onclick="DamanChat.openTimelineModal('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white">السجل</button></div>` : ''}
          ${ag.status === 'disputed' ? `<div class="flex justify-between text-[10px] text-amber-300 font-bold"><span>⚖️ العقد قيد الفصل أمام الإدارة</span><button onclick="DamanChat.openTimelineModal('${ag.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-white">السجل</button></div>` : ''}
        </div>`;
    },

    renderChatRoomShell(app) {
      const meta = this.activeChatMeta || {};
      const isSupportChat = this.isPureSupportChat();
      const iBlocked = (this.activeChatDoc?.blockedBy || []).includes(app.user?.uid);

      return `
        <div id="chat-room-shell" class="space-y-2">
          <div class="glass-card rounded-2xl p-2.5 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <button onclick="DamanChat.closeActiveChat()" class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                <i class="fa-solid fa-arrow-right"></i>
              </button>
              <div class="min-w-0 cursor-pointer" onclick="${!isSupportChat && meta.otherUid ? `DamanApp.openPublicProfile('${meta.otherUid}')` : ''}">
                <div id="chat-peer-name" class="text-xs font-black text-white truncate">${app.esc(meta.otherName || 'محادثة')}</div>
                <div id="chat-peer-status" class="text-[9.5px] text-emerald-400 font-bold truncate">${this.formatPeerStatus()}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${!isSupportChat ? `<button onclick="DamanChat.openAgreementModal()" class="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black"><i class="fa-solid fa-file-signature me-1"></i>اتفاق</button>` : ''}
              <button onclick="DamanChat.startVoiceCall()" class="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center"><i class="fa-solid fa-phone"></i></button>
              ${!isSupportChat ? `<button onclick="DamanChat.toggleBlockPeer()" title="حظر" class="w-8 h-8 rounded-xl ${iBlocked ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'} flex items-center justify-center"><i class="fa-solid fa-ban text-xs"></i></button>` : ''}
            </div>
          </div>

          <div id="chat-call-slot">${this.renderCallBanner(app)}</div>
          <div id="chat-agreements-slot">${this.renderAgreementsBar(app)}</div>

          <div id="chat-msgs-scroll" class="glass-card rounded-2xl p-3 space-y-2 h-[290px] overflow-y-auto"></div>

          <div id="chat-reply-slot"></div>

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
            <button id="voice-rec-btn" type="button" onclick="DamanChat.toggleVoiceNote()" class="w-8 h-8 shrink-0 rounded-xl bg-slate-800 text-emerald-400 flex items-center justify-center" title="رسالة صوتية">
              <i class="fa-solid fa-microphone text-xs"></i>
            </button>
            <input id="chat-msg-input" oninput="DamanChat.onTypingInput()" type="text" placeholder="اكتب رسالتك..." class="flex-1 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    renderChatsListTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
      if (this.activeChatId) return this.renderChatRoomShell(app);
      return `
        <div class="space-y-3">
          ${!app.isAdmin() ? `
            <button onclick="DamanChat.openDirectChat('admin','إدارة ضمان سايت')" class="w-full p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs font-extrabold text-amber-300">
              <span><i class="fa-solid fa-crown me-1.5"></i> مراسلة إدارة ضمان سايت مباشرة</span>
              <i class="fa-solid fa-chevron-left"></i>
            </button>` : ''}
          ${!this.chats.length
            ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">لا توجد محادثات بعد.</div>`
            : `<div class="space-y-2">${this.chats.map((c) => {
                const otherUid = (c.participants || []).find((id) => id !== app.user.uid && !(app.isAdmin() && id === 'admin')) || 'admin';
                const otherName = (c.participantNames && c.participantNames[otherUid]) || (otherUid === 'admin' ? 'إدارة ضمان سايت' : 'مستخدم');
                const isUnread = c.lastSenderId && c.lastSenderId !== app.user.uid && !c.lastReadByPeer;
                return `
                  <div onclick="DamanChat.openChatRoom('${c.id}',{id:'${c.id}',otherUid:'${otherUid}',otherName:'${app.esc(otherName).replace(/'/g, "\\'")}',isAdminSupportChat:${!!c.isAdminSupportChat || otherUid === 'admin'},frozen:${!!c.frozen}})"
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
      const chips = ['تمديد العقد والإضافي', 'الاستلام الهندسي 3x', 'كلّم الإدارة'];
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
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">${chips.map((q) => `<button type="button" onclick="DamanChat.askAi('${q}')" class="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-200">${q}</button>`).join('')}</div>
          <form onsubmit="event.preventDefault(); DamanChat.askAi();" class="flex gap-2">
            <input id="ai-chat-input" type="text" placeholder="اكتب سؤالك هنا..." class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-4 py-2.5 rounded-xl bg-purple-500 text-white font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    renderTicketsTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
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
      if (this.activeChatId) {
        this.updateMessagesDOM();
        this.updateReplyBarDOM();
      }
    }
  };

  window.DamanChat = ChatMod;
  if (window.DamanApp) window.DamanApp.registerModule('chat', ChatMod);

  setInterval(() => {
    if (window.DamanApp && window.DamanApp.user && ChatMod.attachedUid !== window.DamanApp.user.uid) {
      ChatMod.ensureListeners(window.DamanApp);
    }
  }, 2000);
})();
