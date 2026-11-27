(function () {
  function attachChatMedia() {
    if (!window.DamanChat || window.DamanChat._mediaPluginAttached) return;
    const Chat = window.DamanChat;
    Chat._mediaPluginAttached = true;

    const MAX_FILE_BYTES = 680 * 1024; // ~680KB raw (~900KB base64 inside Firestore 1MB limit)
    const MAX_VOICE_SEC = 60;

    Chat.voiceRec = {
      recording: false,
      stream: null,
      recorder: null,
      chunks: [],
      startedAt: 0,
      timerInt: null,
      cancelled: false,
      mimeType: 'audio/webm'
    };

    Chat._chatMediaHelpers = {
      fmtDuration(sec) {
        const s = Math.max(0, Math.floor(Number(sec || 0)));
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      },
      fmtBytes(bytes) {
        const b = Number(bytes || 0);
        if (b < 1024) return `${b} B`;
        return `${Math.round(b / 1024)} KB`;
      },
      fileIcon(name) {
        const n = String(name || '').toLowerCase();
        if (n.endsWith('.pdf')) return 'fa-file-pdf text-rose-400';
        if (n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return 'fa-file-excel text-emerald-400';
        if (n.endsWith('.doc') || n.endsWith('.docx')) return 'fa-file-word text-sky-400';
        if (n.endsWith('.zip') || n.endsWith('.rar')) return 'fa-file-zipper text-amber-400';
        return 'fa-file-lines text-slate-300';
      },
      pickSupportedAudioMime() {
        if (typeof MediaRecorder === 'undefined') return '';
        const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        for (const m of list) {
          try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
        }
        return '';
      },
      async pushRichMessage(payload, lastMsgPreview) {
        const app = window.DamanApp;
        if (!Chat.activeChatId || !app.user) return;
        const chatRef = app.db.collection('chats').doc(Chat.activeChatId);
        const isAdminInt = app.hasAdminAccess() && !(Chat.chats.find((c) => c.id === Chat.activeChatId)?.participants || []).includes(app.user.uid);
        const senderName = isAdminInt ? '👑 إدارة ضمان سايت' : (app.profile?.companyName || app.profile?.name || 'مستخدم');

        await chatRef.collection('messages').add(Object.assign({
          senderId: app.user.uid,
          senderName,
          isAdmin: isAdminInt,
          date: app.todayLocal(),
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, payload));

        const upd = {
          lastMessage: String(lastMsgPreview || payload.text || '').slice(0, 90),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (Chat.activeChatMeta?.otherUid) {
          upd[`unreadBy.${Chat.activeChatMeta.otherUid}`] = firebase.firestore.FieldValue.increment(1);
        }
        await chatRef.update(upd).catch(() => {});
      }
    };

    // ==================== 1. VOICE NOTES (MIC - BLOCKED IN ADMIN CHAT) ====================
    Chat.startVoiceNote = async function () {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      if (typeof this.isAdminChatRoom === 'function' && this.isAdminChatRoom()) {
        return app.toast('الرسائل الصوتية (المايك) غير متاحة في محادثة الإدارة — استخدم الرسائل والصور والملفات فقط', 'warning');
      }
      if (this.activeChatMeta?.frozen && !app.hasAdminAccess()) return app.toast('المحادثة مجمّدة من الإدارة 🔒', 'error');
      if (this.callState?.active) return app.toast('الميكروفون مستخدم حالياً في المكالمة الصوتية', 'warning');
      if (this.voiceRec.recording) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
        return app.toast('جهازك أو المتصفح لا يدعم تسجيل الرسائل الصوتية', 'error');
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = this._chatMediaHelpers.pickSupportedAudioMime();
        const opts = mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 };
        let recorder;
        try { recorder = new MediaRecorder(stream, opts); } catch (e) { recorder = new MediaRecorder(stream); }

        this.voiceRec = {
          recording: true,
          stream,
          recorder,
          chunks: [],
          startedAt: Date.now(),
          timerInt: null,
          cancelled: false,
          mimeType: recorder.mimeType || mime || 'audio/webm'
        };

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) this.voiceRec.chunks.push(ev.data);
        };

        recorder.onstop = async () => {
          const rec = this.voiceRec;
          if (rec.timerInt) { clearInterval(rec.timerInt); rec.timerInt = null; }
          if (rec.stream) rec.stream.getTracks().forEach((t) => t.stop());
          const wasCancelled = rec.cancelled;
          const chunks = rec.chunks.slice();
          const durSec = Math.max(1, Math.round((Date.now() - rec.startedAt) / 1000));
          const mimeOut = rec.mimeType || 'audio/webm';

          this.voiceRec.recording = false;
          this.voiceRec.stream = null;
          this.voiceRec.recorder = null;
          this.voiceRec.chunks = [];
          this._syncMediaToolbarUI();

          if (wasCancelled || !chunks.length) return;
          const blob = new Blob(chunks, { type: mimeOut });
          if (blob.size > MAX_FILE_BYTES) {
            return app.toast('الرسالة الصوتية كبيرة جداً — اجعلها أقل من 60 ثانية', 'warning');
          }

          app.toast('جارٍ إرسال الرسالة الصوتية...', 'info');
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const mediaId = await app.saveMedia(reader.result, { kind: 'chat_voice' });
              const durTxt = this._chatMediaHelpers.fmtDuration(durSec);
              await this._chatMediaHelpers.pushRichMessage({
                type: 'voice',
                mediaId,
                durationSec: durSec,
                text: `🎤 رسالة صوتية (${durTxt})`
              }, `🎤 رسالة صوتية (${durTxt})`);
            } catch (err) {
              app.toast('تعذر إرسال الرسالة الصوتية', 'error');
            }
          };
          reader.readAsDataURL(blob);
        };

        recorder.start(500);
        this._syncMediaToolbarUI();

        this.voiceRec.timerInt = setInterval(() => {
          const sec = Math.floor((Date.now() - this.voiceRec.startedAt) / 1000);
          const lbl = document.getElementById('daman-vrec-timer');
          if (lbl) lbl.textContent = this._chatMediaHelpers.fmtDuration(sec);
          if (sec >= MAX_VOICE_SEC) this.stopVoiceNote(false);
        }, 500);
      } catch (err) {
        app.toast('يرجى السماح بصلاحية الميكروفون لتسجيل رسالة صوتية', 'error');
      }
    };

    Chat.stopVoiceNote = function (cancel = false) {
      if (!this.voiceRec.recording) return;
      this.voiceRec.cancelled = !!cancel;
      if (this.voiceRec.timerInt) { clearInterval(this.voiceRec.timerInt); this.voiceRec.timerInt = null; }
      try {
        if (this.voiceRec.recorder && this.voiceRec.recorder.state !== 'inactive') {
          this.voiceRec.recorder.stop();
        }
      } catch (e) {
        if (this.voiceRec.stream) this.voiceRec.stream.getTracks().forEach((t) => t.stop());
        this.voiceRec.recording = false;
        this._syncMediaToolbarUI();
      }
    };

    Chat.playVoiceMessage = async function (msgId, mediaId) {
      const slot = document.getElementById('daman-vmsg-' + msgId);
      if (!slot || !mediaId) return;
      slot.innerHTML = `<span class="text-[10px] opacity-80">جارٍ تحميل الصوت...</span>`;
      const src = await window.DamanApp.fetchMedia(mediaId);
      if (!src) {
        slot.innerHTML = `<span class="text-[10px] text-rose-300">تعذر تشغيل الرسالة الصوتية</span>`;
        return;
      }
      slot.innerHTML = `<audio controls autoplay playsinline src="${src}" class="w-full max-w-[230px] h-8 mt-1"></audio>`;
    };

    // ==================== 2. FILE UPLOAD (PDF / WORD / EXCEL / ETC.) ====================
    Chat.sendChatFile = async function (input) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      if (!f || !this.activeChatId || !app.user) return;
      if (this.activeChatMeta?.frozen && !app.hasAdminAccess()) { input.value = ''; return app.toast('المحادثة مجمّدة 🔒', 'error'); }

      if (f.type && f.type.startsWith('image/')) {
        return this.sendChatImage(input);
      }
      input.value = '';

      if (f.size > MAX_FILE_BYTES) {
        return app.toast('الحد الأقصى لحجم الملف في الشات 680 كيلوبايت — يمكنك ضغط الملف أو تصويره كصورة', 'warning');
      }

      app.toast('جارٍ رفع وإرسال الملف...', 'info');
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const mediaId = await app.saveMedia(reader.result, { kind: 'chat_file' });
          await this._chatMediaHelpers.pushRichMessage({
            type: 'file',
            mediaId,
            fileName: f.name || 'ملف مرفق',
            fileSize: f.size || 0,
            fileMime: f.type || 'application/octet-stream',
            text: `📎 ملف: ${f.name || 'مستند'}`
          }, `📎 ملف: ${f.name || 'مستند'}`);
          app.toast('تم إرسال الملف بنجاح ✅', 'success');
        } catch (err) {
          app.toast('تعذر إرسال الملف', 'error');
        }
      };
      reader.readAsDataURL(f);
    };

    Chat.downloadChatFile = async function (mediaId, fileName) {
      const app = window.DamanApp;
      if (!mediaId) return;
      app.toast('جارٍ تجهيز الملف...', 'info');
      const dataUrl = await app.fetchMedia(mediaId);
      if (!dataUrl) return app.toast('تعذر تحميل الملف', 'error');
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'damansite-file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
      } catch (e) {
        window.open(dataUrl, '_blank');
      }
    };

    // ==================== 3. GPS LOCATION SHARING ====================
    Chat.sendChatLocation = function () {
      const app = window.DamanApp;
      if (!this.activeChatId || !app.user) return;
      if (this.activeChatMeta?.frozen && !app.hasAdminAccess()) return app.toast('المحادثة مجمّدة 🔒', 'error');
      if (!navigator.geolocation) return app.toast('جهازك لا يدعم تحديد الموقع الجغرافي (GPS)', 'error');

      app.toast('جارٍ تحديد موقعك الحالي (GPS)...', 'info');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy || 0);
          const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
          try {
            await this._chatMediaHelpers.pushRichMessage({
              type: 'location',
              lat,
              lng,
              accuracy,
              mapsUrl,
              text: `📍 موقع جغرافي (GPS): ${mapsUrl}`
            }, '📍 موقع جغرافي (GPS)');
            app.toast('تم إرسال موقعك الجغرافي بنجاح 📍', 'success');
          } catch (err) {
            app.toast('تعذر إرسال الموقع', 'error');
          }
        },
        (err) => {
          const msg = err.code === 1
            ? 'يرجى السماح للتطبيق بصلاحية الموقع (Location / GPS) من إعدادات الهاتف'
            : 'تعذر تحديد الموقع حالياً — تأكد من تشغيل الـ GPS وحاول مرة أخرى';
          app.toast(msg, 'error');
        },
        { enableHighAccuracy: true, timeout: 14000, maximumAge: 10000 }
      );
    };

    // ==================== 4. NON-INVASIVE UI ENHANCEMENT ====================
    Chat._syncMediaToolbarUI = function () {
      const bar = document.getElementById('daman-chat-media-bar');
      if (!bar) return;
      const app = window.DamanApp;
      const locked = this.activeChatMeta?.frozen && !app.hasAdminAccess();
      if (locked) { bar.innerHTML = ''; return; }

      const isAdmChat = typeof this.isAdminChatRoom === 'function' && this.isAdminChatRoom();

      if (this.voiceRec.recording && !isAdmChat) {
        const elapsed = this._chatMediaHelpers.fmtDuration(Math.floor((Date.now() - this.voiceRec.startedAt) / 1000));
        bar.innerHTML = `
          <div class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-600/20 border border-rose-500 text-xs">
            <div class="flex items-center gap-2 text-rose-300 font-black">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span>جارٍ تسجيل صوت...</span>
              <span id="daman-vrec-timer" class="px-2 py-0.5 rounded bg-rose-600 text-white tracking-wider">${elapsed}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="DamanChat.stopVoiceNote(true)" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold text-[10.5px]">إلغاء</button>
              <button type="button" onclick="DamanChat.stopVoiceNote(false)" class="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px]"><i class="fa-solid fa-paper-plane me-1"></i>إرسال</button>
            </div>
          </div>`;
        return;
      }

      if (isAdmChat) {
        bar.innerHTML = `
          <div class="grid grid-cols-2 gap-1.5 text-[10.5px] font-black">
            <button type="button" onclick="DamanChat._triggerNativeImgPick()" class="py-1.5 px-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 flex items-center justify-center gap-1 active:scale-95">
              <i class="fa-solid fa-image"></i><span>رفع صورة</span>
            </button>
            <label class="py-1.5 px-2 rounded-xl bg-slate-900 border border-slate-700 text-sky-300 flex items-center justify-center gap-1 cursor-pointer active:scale-95">
              <i class="fa-solid fa-paperclip"></i><span>رفع ملف</span>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,image/*" class="hidden" onchange="DamanChat.sendChatFile(this)" />
            </label>
          </div>`;
        return;
      }

      bar.innerHTML = `
        <div class="grid grid-cols-4 gap-1.5 text-[10.5px] font-black">
          <button type="button" onclick="DamanChat._triggerNativeImgPick()" class="py-1.5 px-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 flex items-center justify-center gap-1 active:scale-95">
            <i class="fa-solid fa-image"></i><span>صورة</span>
          </button>
          <label class="py-1.5 px-2 rounded-xl bg-slate-900 border border-slate-700 text-sky-300 flex items-center justify-center gap-1 cursor-pointer active:scale-95">
            <i class="fa-solid fa-paperclip"></i><span>ملف</span>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,image/*" class="hidden" onchange="DamanChat.sendChatFile(this)" />
          </label>
          <button type="button" onclick="DamanChat.sendChatLocation()" class="py-1.5 px-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 flex items-center justify-center gap-1 active:scale-95">
            <i class="fa-solid fa-location-dot"></i><span>لوكيشن</span>
          </button>
          <button type="button" onclick="DamanChat.startVoiceNote()" class="py-1.5 px-2 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-300 flex items-center justify-center gap-1 active:scale-95">
            <i class="fa-solid fa-microphone"></i><span>مايك</span>
          </button>
        </div>`;
    };

    Chat._triggerNativeImgPick = function () {
      const form = document.querySelector('#app-main form[onsubmit*="DamanChat.sendMessage"]');
      const inp = form ? form.querySelector('input[type="file"]') : null;
      if (inp) inp.click();
    };

    Chat._enhanceChatRoomDOM = function (container, app) {
      if (!this.activeChatId) return;

      const isAdmChat = typeof this.isAdminChatRoom === 'function' && this.isAdminChatRoom();

      // 1. Inject Media Toolbar right above the send form
      const form = container.querySelector('form[onsubmit*="DamanChat.sendMessage"]');
      if (form && !document.getElementById('daman-chat-media-bar')) {
        const oldImgLbl = form.querySelector('label');
        if (oldImgLbl) oldImgLbl.classList.add('hidden');

        const bar = document.createElement('div');
        bar.id = 'daman-chat-media-bar';
        form.parentNode.insertBefore(bar, form);
        this._syncMediaToolbarUI();

        // Add quick mic icon inside form ONLY for normal user-to-user chats (NOT Admin chat)
        if (!isAdmChat && !(this.activeChatMeta?.frozen && !app.hasAdminAccess())) {
          const micBtn = document.createElement('button');
          micBtn.type = 'button';
          micBtn.title = 'تسجيل رسالة صوتية';
          micBtn.className = 'w-10 h-10 rounded-xl bg-slate-900 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0';
          micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
          micBtn.onclick = () => (this.voiceRec.recording ? this.stopVoiceNote(false) : this.startVoiceNote());
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) form.insertBefore(micBtn, submitBtn);
        }
      }

      // 2. Enhance voice / file / location message bubbles
      const scrollBox = document.getElementById('daman-chat-scroll');
      if (!scrollBox || !this.activeMessages.length) return;

      this.activeMessages.forEach((m, idx) => {
        const row = scrollBox.children[idx];
        const bubble = row && row.firstElementChild;
        if (!bubble || bubble.dataset.mediaEnhanced) return;

        if (m.type === 'voice' && m.mediaId) {
          bubble.dataset.mediaEnhanced = '1';
          const mine = m.senderId === app.user?.uid;
          const durTxt = this._chatMediaHelpers.fmtDuration(m.durationSec || 0);
          const el = document.createElement('div');
          el.id = 'daman-vmsg-' + m.id;
          el.className = 'pt-1';
          el.innerHTML = `
            <button type="button" onclick="DamanChat.playVoiceMessage('${m.id}','${app.esc(m.mediaId)}')" class="w-full px-3 py-2 rounded-xl ${mine ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-950 text-emerald-300 border border-emerald-500/40'} flex items-center gap-2 font-black text-[11px]">
              <i class="fa-solid fa-play"></i>
              <span>تشغيل الرسالة الصوتية</span>
              <span class="ms-auto opacity-80">${durTxt}</span>
            </button>`;
          bubble.insertBefore(el, bubble.lastElementChild);
        } else if (m.type === 'file' && m.mediaId) {
          bubble.dataset.mediaEnhanced = '1';
          const mine = m.senderId === app.user?.uid;
          const safeName = app.esc(m.fileName || 'ملف مرفق');
          const el = document.createElement('div');
          el.className = `mt-1 p-2 rounded-xl ${mine ? 'bg-slate-950/15 text-slate-950' : 'bg-slate-950 text-white border border-slate-700'} space-y-1.5`;
          el.innerHTML = `
            <div class="flex items-center gap-2">
              <i class="fa-solid ${this._chatMediaHelpers.fileIcon(m.fileName)} text-lg shrink-0"></i>
              <div class="min-w-0 flex-1">
                <div class="text-[11px] font-black truncate">${safeName}</div>
                <div class="text-[9.5px] opacity-75">${this._chatMediaHelpers.fmtBytes(m.fileSize)}</div>
              </div>
            </div>
            <button type="button" onclick="DamanChat.downloadChatFile('${app.esc(m.mediaId)}','${safeName.replace(/'/g, "\\'")}')" class="w-full py-1.5 rounded-lg ${mine ? 'bg-slate-950 text-amber-400' : 'bg-sky-500 text-slate-950'} font-black text-[10.5px]">
              <i class="fa-solid fa-download me-1"></i> تحميل / فتح الملف
            </button>`;
          bubble.insertBefore(el, bubble.lastElementChild);
        } else if (m.type === 'location' && m.lat != null && m.lng != null) {
          bubble.dataset.mediaEnhanced = '1';
          const mine = m.senderId === app.user?.uid;
          const mapsUrl = m.mapsUrl || `https://www.google.com/maps?q=${m.lat},${m.lng}`;
          const el = document.createElement('div');
          el.className = `mt-1 p-2.5 rounded-xl ${mine ? 'bg-slate-950/15 text-slate-950' : 'bg-slate-950 text-white border border-emerald-500/40'} space-y-1.5`;
          el.innerHTML = `
            <div class="flex items-center gap-1.5 font-black text-[11px]">
              <i class="fa-solid fa-map-location-dot ${mine ? 'text-slate-950' : 'text-emerald-400'}"></i>
              <span>موقع جغرافي مباشر (GPS)</span>
            </div>
            <div class="text-[9.5px] opacity-80" dir="ltr">${m.lat}, ${m.lng}${m.accuracy ? ` (±${m.accuracy}m)` : ''}</div>
            <div class="flex gap-1.5">
              <a href="${app.esc(mapsUrl)}" target="_blank" rel="noopener noreferrer" class="flex-1 py-1.5 px-2 rounded-lg ${mine ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500 text-slate-950'} font-black text-[10.5px] text-center">
                🗺️ افتح على خرائط جوجل
              </a>
              <button type="button" onclick="navigator.clipboard.writeText('${app.esc(mapsUrl)}'); DamanApp.toast('تم نسخ رابط الموقع ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-[10px]">نسخ</button>
            </div>`;
          bubble.insertBefore(el, bubble.lastElementChild);
        }
      });
    };

    const origRender = Chat.render.bind(Chat);
    Chat.render = function (container, app) {
      origRender(container, app);
      try { this._enhanceChatRoomDOM(container, app); } catch (e) {}
    };

    const origClose = Chat.closeActiveChat.bind(Chat);
    Chat.closeActiveChat = function () {
      if (this.voiceRec.recording) this.stopVoiceNote(true);
      return origClose.apply(this, arguments);
    };

    if (window.DamanApp && window.DamanApp.activeTab === 'chat' && Chat.activeChatId) {
      Chat.rerender();
    }
  }

  if (window.DamanChat) attachChatMedia();
  else setTimeout(attachChatMedia, 300);
})();
