(function () {
  function fmtDur(sec) {
    const s = Math.max(0, Math.floor(Number(sec || 0)));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function fmtSize(bytes) {
    const b = Number(bytes || 0);
    if (!b) return '';
    return b < 1024 ? `${b} B` : `${Math.round(b / 1024)} KB`;
  }

  function fileIconCls(name) {
    const n = String(name || '').toLowerCase();
    if (n.endsWith('.pdf')) return 'fa-file-pdf text-rose-400';
    if (n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return 'fa-file-excel text-emerald-400';
    if (n.endsWith('.doc') || n.endsWith('.docx')) return 'fa-file-word text-sky-400';
    if (n.endsWith('.zip') || n.endsWith('.rar')) return 'fa-file-zipper text-amber-400';
    return 'fa-file-lines text-slate-300';
  }

  function applyPatch() {
    const Adm = window.DamanAdmin;
    if (!Adm) return;

    Adm._watchMessagesCache = [];
    Adm._watchTitleCache = '';
    Adm._watchChatIdCache = '';
    Adm._watchSearchQuery = '';

    Adm.playAdminWatchVoice = async function (msgId, mediaId) {
      const slot = document.getElementById('adm-wvoice-' + msgId);
      if (!slot || !mediaId) return;
      slot.innerHTML = `<span class="text-[10px] text-amber-300">جارٍ تحميل الصوت...</span>`;
      const src = await window.DamanApp.fetchMedia(mediaId);
      if (!src) {
        slot.innerHTML = `<span class="text-[10px] text-rose-400">تعذر تشغيل التسجيل الصوتي</span>`;
        return;
      }
      slot.innerHTML = `<audio controls autoplay playsinline src="${src}" class="w-full h-8 mt-1"></audio>`;
    };

    Adm.downloadAdminWatchFile = async function (mediaId, fileName) {
      const app = window.DamanApp;
      if (!mediaId) return;
      app.toast('جارٍ تحميل الملف...', 'info');
      const dataUrl = await app.fetchMedia(mediaId);
      if (!dataUrl) return app.toast('الملف غير متاح أو تم حذفه', 'error');
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'chat-file';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
      } catch (e) {
        window.open(dataUrl, '_blank');
      }
    };

    Adm.printAdminChatEvidenceA4 = function () {
      const app = window.DamanApp;
      const msgs = this._watchMessagesCache || [];
      if (!msgs.length) return app.toast('لا توجد رسائل للطباعة', 'info');
      const rows = msgs.map((m, i) => {
        const kind = m.type === 'voice' ? `رسالة صوتية (${fmtDur(m.durationSec)})`
          : m.type === 'file' ? `ملف مرفق: ${m.fileName || ''}`
          : m.type === 'location' ? `موقع GPS: ${m.mapsUrl || (m.lat + ',' + m.lng)}`
          : m.type === 'image' ? 'صورة مرفقة'
          : 'نص';
        return `<tr><td>${i + 1}</td><td>${app.esc(m.date || '')} ${app.esc(m.time || '')}</td><td><b>${app.esc(m.senderName || m.senderId)}</b></td><td>${app.esc(kind)}</td><td style="white-space:pre-line;">${app.esc(m.text || '')}</td></tr>`;
      }).join('');

      window.DamanPrint(`
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div>
              <h2 style="margin:0; font-size:15px;">محضر تفريغ ومراجعة محادثة — ${app.esc(app.t('appName'))}</h2>
              <div style="font-size:11px;">الأطراف: <b>${app.esc(this._watchTitleCache)}</b></div>
            </div>
            <div style="font-size:10.5px; text-align:left;">
              <div><b>تاريخ الاستخراج:</b> ${app.todayLocal()}</div>
              <div><b>كود الغرفة:</b> ${app.esc(this._watchChatIdCache)}</div>
            </div>
          </div>
          <table>
            <thead><tr><th style="width:5%;">#</th><th style="width:16%;">التاريخ والوقت</th><th style="width:18%;">المرسل</th><th style="width:16%;">النوع</th><th>المحتوى</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:24px; text-align:center; font-size:11px;">
            <div>اعتماد لجنة التحكيم والإدارة<br/><br/>.....................................</div>
            <div>ختم المنصة<br/><br/>.....................................</div>
          </div>
        </div>`);
    };

    Adm._renderAdminWatchMsgs = function () {
      const app = window.DamanApp;
      const box = document.getElementById('adm-watch-msgs');
      if (!box) return;
      const q = app.normalizeAr(this._watchSearchQuery || '');
      const list = (this._watchMessagesCache || []).filter((m) =>
        !q || app.normalizeAr(`${m.senderName || ''} ${m.text || ''} ${m.fileName || ''} ${m.date || ''}`).includes(q)
      );

      if (!list.length) {
        box.innerHTML = `<div class="text-center text-slate-500 py-10">${q ? 'لا توجد رسائل مطابقة للبحث.' : 'لا توجد رسائل في هذه المحادثة بعد.'}</div>`;
        return;
      }

      box.innerHTML = list.map((msg) => {
        let rich = '';
        if (msg.type === 'image' && (msg.thumbBase64 || msg.mediaId)) {
          rich = `<img src="${msg.thumbBase64 || ''}" onclick="DamanApp.openMediaLightbox('${app.esc(msg.mediaId || msg.thumbBase64)}','مرفق محادثة')" class="max-h-36 rounded-lg cursor-pointer border border-slate-700" />`;
        } else if (msg.type === 'voice' && msg.mediaId) {
          rich = `
            <div id="adm-wvoice-${app.esc(msg.id)}" class="pt-1">
              <button type="button" onclick="DamanAdmin.playAdminWatchVoice('${app.esc(msg.id)}','${app.esc(msg.mediaId)}')" class="w-full px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-black text-[11px] flex items-center gap-2">
                <i class="fa-solid fa-play"></i>
                <span>تشغيل الرسالة الصوتية</span>
                <span class="ms-auto text-amber-300">${fmtDur(msg.durationSec)}</span>
              </button>
            </div>`;
        } else if (msg.type === 'file' && msg.mediaId) {
          const safeName = app.esc(msg.fileName || 'ملف مرفق');
          rich = `
            <div class="p-2 rounded-xl bg-slate-950 border border-sky-500/40 space-y-1.5">
              <div class="flex items-center gap-2">
                <i class="fa-solid ${fileIconCls(msg.fileName)} text-base shrink-0"></i>
                <div class="min-w-0 flex-1">
                  <div class="text-[11px] font-black text-white truncate">${safeName}</div>
                  <div class="text-[9.5px] text-slate-400">${fmtSize(msg.fileSize)}</div>
                </div>
              </div>
              <button type="button" onclick="DamanAdmin.downloadAdminWatchFile('${app.esc(msg.mediaId)}','${safeName.replace(/'/g, "\\'")}')" class="w-full py-1.5 rounded-lg bg-sky-500 text-slate-950 font-black text-[10.5px]">
                <i class="fa-solid fa-download me-1"></i> فتح / تحميل الملف
              </button>
            </div>`;
        } else if (msg.type === 'location' && msg.lat != null && msg.lng != null) {
          const mapsUrl = msg.mapsUrl || `https://www.google.com/maps?q=${msg.lat},${msg.lng}`;
          rich = `
            <div class="p-2 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-1.5">
              <div class="flex items-center justify-between text-[10.5px] text-emerald-300 font-black">
                <span><i class="fa-solid fa-location-dot me-1"></i> موقع جغرافي (GPS)</span>
                <span dir="ltr" class="text-[9.5px] text-slate-400">${msg.lat}, ${msg.lng}</span>
              </div>
              <div class="flex gap-1.5">
                <a href="${app.esc(mapsUrl)}" target="_blank" rel="noopener noreferrer" class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10.5px] text-center">🗺️ فتح على خرائط جوجل</a>
                <button type="button" onclick="navigator.clipboard.writeText('${app.esc(mapsUrl)}'); DamanApp.toast('تم نسخ رابط الموقع ✅','success')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white font-bold text-[10px]">نسخ</button>
              </div>
            </div>`;
        }

        return `
          <div class="p-2.5 rounded-xl ${msg.isAdmin ? 'bg-purple-900/70 border border-amber-400' : 'bg-slate-900 border border-slate-800'} space-y-1">
            <div class="flex justify-between text-[10px]">
              <b class="${msg.isAdmin ? 'text-amber-300' : 'text-sky-300'}">${app.esc(msg.senderName || msg.senderId)}</b>
              <span class="text-slate-500">${app.esc(msg.date || '')} ${app.esc(msg.time || '')}</span>
            </div>
            ${rich}
            ${msg.text ? `<div class="text-white whitespace-pre-line leading-relaxed text-[11px]">${app.esc(msg.text)}</div>` : ''}
          </div>`;
      }).join('');
      if (!q) box.scrollTop = box.scrollHeight;
    };

    Adm.openAdminChatWatchModal = function (chatId) {
      const app = window.DamanApp;
      const chat = (this.chats || []).find((c) => c.id === chatId);
      const title = chat ? Object.values(chat.participantNames || {}).join(' ⇄ ') : chatId;
      this._watchTitleCache = title;
      this._watchChatIdCache = chatId;
      this._watchSearchQuery = '';
      this._watchMessagesCache = [];

      if (this.unsubAdminChatWatch) { try { this.unsubAdminChatWatch(); } catch (e) {} this.unsubAdminChatWatch = null; }

      let m = document.getElementById('daman-adm-chat-watch');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-adm-chat-watch';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'adminWatch' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md h-[90vh] bg-slate-900 border-2 border-purple-500/60 rounded-3xl p-3.5 flex flex-col gap-2 text-xs">
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div class="min-w-0">
              <div class="text-sm font-black text-purple-300 truncate">👁️ مراقبة مباشرة: ${app.esc(title)}</div>
              <div class="text-[10px] text-slate-400">${chat?.frozen ? '🔒 مجمّدة' : '🟢 نشطة'} • دعم الصوت والملفات والـ GPS</div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" onclick="DamanAdmin.printAdminChatEvidenceA4()" class="px-2 py-1 rounded-lg bg-white text-slate-950 font-black text-[10px]" title="طباعة محضر A4">A4</button>
              <button type="button" onclick="DamanAdmin.toggleFreezeChat('${chatId}',${!!chat?.frozen}); DamanAdmin.closeAdminChatWatch()" class="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black text-[10px]">${chat?.frozen ? 'فك' : 'تجميد'}</button>
              <button type="button" onclick="DamanAdmin.closeAdminChatWatch()" class="w-7 h-7 rounded-lg bg-slate-800 text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </div>

          <input type="search" oninput="DamanAdmin._watchSearchQuery=this.value; DamanAdmin._renderAdminWatchMsgs()" placeholder="بحث داخل رسائل هذه المحادثة..." class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-white" />

          <div id="adm-watch-msgs" class="flex-1 overflow-y-auto space-y-2 p-2 rounded-2xl bg-slate-950 border border-slate-800">
            <div class="text-center text-amber-300 py-8">جارٍ تحميل الرسائل والمرفقات لحظياً...</div>
          </div>

          <form onsubmit="DamanAdmin.sendAdminInterventionMsg(event,'${chatId}')" class="flex gap-1.5">
            <input id="adm-int-input" type="text" required placeholder="تدخّل واكتب رسالة رسمية كـ (👑 إدارة ضمان سايت)..." class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/50 text-white" />
            <button type="submit" class="px-3.5 py-2 rounded-xl bg-purple-600 text-white font-black">إرسال</button>
          </form>
        </div>`;

      this.unsubAdminChatWatch = app.db.collection('chats').doc(chatId).collection('messages').limit(150).onSnapshot((snap) => {
        this._watchMessagesCache = snap.docs
          .map((d) => Object.assign({ id: d.id }, d.data()))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        this._renderAdminWatchMsgs();
      }, (err) => {
        const box = document.getElementById('adm-watch-msgs');
        if (box) box.innerHTML = `<div class="text-rose-400 text-center py-6">تعذر القراءة: ${app.esc(err.message)}</div>`;
      });
    };
  }

  function boot() {
    if (!window.DamanAdmin) return setTimeout(boot, 250);
    const Adm = window.DamanAdmin;
    if (Adm._watchMediaPatched) return;
    Adm._watchMediaPatched = true;

    const origReg = Adm.registerExtension.bind(Adm);
    Adm.registerExtension = function (slot, obj) {
      origReg(slot, obj);
      if (slot === 1) applyPatch();
    };

    if (Adm._ext1Ready || typeof Adm.openAdminChatWatchModal === 'function') {
      applyPatch();
    }
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(boot, 180));
  else setTimeout(boot, 180);
})();
