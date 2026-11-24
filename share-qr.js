(function () {
  const ShareQR = {
    _booted: false,
    _deepLinkHandled: false,
    _activePayload: null,

    baseUrl() {
      return window.location.origin + window.location.pathname;
    },

    buildUrl(param, value) {
      return `${this.baseUrl()}?${encodeURIComponent(param)}=${encodeURIComponent(value)}`;
    },

    // ==================== 1. UNIFIED SHARE & QR MODAL ====================
    openModal(payload) {
      const app = window.DamanApp;
      if (!app || !payload || !payload.url) return;
      this._activePayload = payload;

      let m = document.getElementById('daman-share-qr-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-share-qr-modal';
        m.className = 'daman-modal fixed inset-0 z-[96] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'shareQr' }, ''); } catch (e) {}

      const waText = encodeURIComponent(`${payload.shareText || payload.title}\n${payload.url}`);
      const waHref = `https://wa.me/?text=${waText}`;

      m.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-amber-400 truncate">
              <i class="fa-solid fa-qrcode me-1"></i> ${app.esc(payload.header || 'مشاركة ورمز QR')}
            </h3>
            <button type="button" onclick="document.getElementById('daman-share-qr-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2.5">
            ${payload.badge ? `<span class="inline-block px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-black">${app.esc(payload.badge)}</span>` : ''}
            <div class="font-black text-white text-xs leading-snug">${app.esc(payload.title || '')}</div>
            ${payload.subtitle ? `<div class="text-[10.5px] text-slate-400">${app.esc(payload.subtitle)}</div>` : ''}

            <div class="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-xl mx-auto">
              <div id="daman-qr-render-box"></div>
            </div>

            <div class="text-[10px] text-emerald-300 font-bold">امسح الكود بالكاميرا للفتح أو التحقق الفوري</div>
          </div>

          <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5">
            <input id="daman-qr-url-inp" type="text" readonly value="${app.esc(payload.url)}" dir="ltr" class="flex-1 bg-transparent text-[10px] text-slate-300 outline-none truncate" />
            <button type="button" onclick="DamanShareQR.copyActiveLink()" class="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] shrink-0">نسخ الرابط</button>
          </div>

          <div class="grid grid-cols-3 gap-1.5">
            <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1">
              <i class="fa-brands fa-whatsapp text-sm"></i><span>واتساب</span>
            </a>
            <button type="button" onclick="DamanShareQR.downloadQrCard()" class="py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1">
              <i class="fa-solid fa-download"></i><span>حفظ QR</span>
            </button>
            <button type="button" onclick="DamanShareQR.nativeShare()" class="py-2.5 rounded-xl bg-purple-600 text-white font-black text-[11px] flex items-center justify-center gap-1">
              <i class="fa-solid fa-share-nodes"></i><span>مشاركة</span>
            </button>
          </div>

          ${payload.extraBtnHtml || ''}
        </div>`;

      setTimeout(() => {
        const box = document.getElementById('daman-qr-render-box');
        if (!box) return;
        box.innerHTML = '';
        if (window.QRCode) {
          new QRCode(box, {
            text: payload.url,
            width: 184,
            height: 184,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        } else {
          box.innerHTML = `<div class="p-4 text-slate-900 font-bold text-[10px]">مكتبة QR غير محمّلة حالياً</div>`;
        }
      }, 40);
    },

    copyActiveLink() {
      const url = this._activePayload?.url;
      if (!url) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => window.DamanApp.toast('تم نسخ الرابط بنجاح ✅', 'success')).catch(() => {});
      } else {
        const inp = document.getElementById('daman-qr-url-inp');
        if (inp) { inp.select(); document.execCommand('copy'); window.DamanApp.toast('تم نسخ الرابط ✅', 'success'); }
      }
    },

    async nativeShare() {
      const p = this._activePayload;
      if (!p) return;
      if (navigator.share) {
        try {
          await navigator.share({ title: p.title || 'ضمان سايت', text: p.shareText || p.title, url: p.url });
          return;
        } catch (e) {}
      }
      this.copyActiveLink();
    },

    downloadQrCard() {
      const app = window.DamanApp;
      const box = document.getElementById('daman-qr-render-box');
      if (!box) return;
      const qrCanvas = box.querySelector('canvas');
      const qrImg = box.querySelector('img');
      const source = qrCanvas || qrImg;
      if (!source) return app.toast('انتظر لحظة حتى يكتمل رسم الـ QR', 'warning');

      try {
        const out = document.createElement('canvas');
        out.width = 420;
        out.height = 500;
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, out.width - 20, out.height - 20);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px Cairo, Tahoma, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ضمان سايت | DamanSite', out.width / 2, 54);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 14px Cairo, Tahoma, Arial';
        const subLine = String(this._activePayload?.badge || this._activePayload?.header || '').slice(0, 38);
        ctx.fillText(subLine, out.width / 2, 82);

        ctx.drawImage(source, 85, 105, 250, 250);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 15px Cairo, Tahoma, Arial';
        const titleLine = String(this._activePayload?.title || '').slice(0, 38);
        ctx.fillText(titleLine, out.width / 2, 398);

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 13px Cairo, Tahoma, Arial';
        ctx.fillText('امسح الرمز للفتح أو التحقق الرسمي', out.width / 2, 434);

        const a = document.createElement('a');
        a.href = out.toDataURL('image/png');
        a.download = `damansite-qr-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        app.toast('تم حفظ بطاقة الـ QR على جهازك ✅', 'success');
      } catch (e) {
        app.toast('تعذر حفظ الصورة، يمكنك أخذ لقطة شاشة للرمز', 'warning');
      }
    },

    // ==================== 2. CONTRACT QR + LIVE VERIFICATION ====================
    shareContract(agId) {
      const app = window.DamanApp;
      const ag = (window.DamanChat && Array.isArray(DamanChat.agreements))
        ? DamanChat.agreements.find((a) => a.id === agId)
        : null;
      if (!ag) return app.toast('العقد غير متاح حالياً', 'warning');

      const url = this.buildUrl('verify', ag.ticketNumber);
      const stMap = { draft: 'مسودة', funded: 'محجوز بالضمان 100%', disputed: 'قيد التحكيم', completed: 'مكتمل ومُصفّى', cancelled: 'ملغى' };
      this.openModal({
        header: 'رمز QR للتحقق من العقد الرسمي',
        badge: `كود العقد: ${ag.ticketNumber} • ${stMap[ag.status] || ag.status}`,
        title: ag.title || 'عقد رسمي بالضمان المالي',
        subtitle: `القيمة: ${app.fmtMoney(ag.totalAmount)} ج.م | ${ag.payerName || ''} ⇄ ${ag.providerName || ''}`,
        url,
        shareText: `📄 عقد رسمي مضمون عبر ضمان سايت (${ag.ticketNumber}): ${ag.title} — رابط التحقق المباشر:`,
        extraBtnHtml: `
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            <button type="button" onclick="document.getElementById('daman-share-qr-modal').classList.add('hidden'); DamanShareQR.openContractVerifyModal('${app.esc(ag.ticketNumber)}')" class="py-2 rounded-xl bg-slate-800 text-emerald-300 font-black text-[10.5px]">✅ معاينة شهادة التحقق</button>
            <button type="button" onclick="document.getElementById('daman-share-qr-modal').classList.add('hidden'); if(window.DamanChat) DamanChat.printContractA4('${app.esc(ag.id)}')" class="py-2 rounded-xl bg-white text-slate-950 font-black text-[10.5px]">🖨️ طباعة العقد A4</button>
          </div>`
      });
    },

    promptVerifyContractCode() {
      const code = window.prompt('أدخل كود العقد للتحقق الرسمي (مثال: TKT-123456):', 'TKT-');
      if (!code || !code.trim()) return;
      this.openContractVerifyModal(code.trim().toUpperCase());
    },

    async openContractVerifyModal(ticketNumber) {
      const app = window.DamanApp;
      if (!app || !ticketNumber) return;
      const cleanCode = String(ticketNumber).trim().toUpperCase();

      let m = document.getElementById('daman-verify-ct-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-verify-ct-modal';
        m.className = 'daman-modal fixed inset-0 z-[97] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'verifyContract' }, ''); } catch (e) {}

      m.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 text-center text-xs text-amber-300 font-bold">جارٍ التحقق الرسمي من العقد (${app.esc(cleanCode)})...</div>`;

      let ag = (window.DamanChat && Array.isArray(DamanChat.agreements))
        ? DamanChat.agreements.find((a) => String(a.ticketNumber || '').toUpperCase() === cleanCode)
        : null;

      let permDenied = false;
      if (!ag && app.db) {
        try {
          const snap = await app.db.collection('chatAgreements').where('ticketNumber', '==', cleanCode).limit(1).get();
          if (!snap.empty) ag = Object.assign({ id: snap.docs[0].id }, snap.docs[0].data());
        } catch (err) {
          permDenied = true;
        }
      }

      if (!ag) {
        m.innerHTML = `
          <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 space-y-3 text-xs text-center">
            <div class="text-2xl">${permDenied ? '🔒' : '❌'}</div>
            <h3 class="text-sm font-black ${permDenied ? 'text-amber-400' : 'text-rose-400'}">
              ${permDenied ? `التحقق من العقد ${app.esc(cleanCode)} يتطلب تسجيل الدخول` : `لم يتم العثور على عقد بكود ${app.esc(cleanCode)}`}
            </h3>
            <p class="text-[11px] text-slate-300 leading-relaxed">
              ${permDenied
                ? 'حفاظاً على سرية بيانات العقود والأرقام القومية، يُعرض ملف التحقق الكامل لأطراف العقد أو إدارة ضمان سايت بعد تسجيل الدخول.'
                : 'تأكد من صحة كود العقد المكتوب على النسخة المطبوعة (مثال: TKT-123456).'}
            </p>
            <div class="flex gap-2">
              ${permDenied && !app.user ? `<button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden'); DamanApp.openAuthModal('login')" class="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">تسجيل الدخول للتحقق</button>` : ''}
              <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden')" class="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold">إغلاق</button>
            </div>
          </div>`;
        return;
      }

      const stMap = {
        draft: { txt: 'مسودة — لم يُحجز الضمان بعد', cls: 'bg-amber-500/20 text-amber-300' },
        funded: { txt: 'عقد سارٍ ومضمون مالياً 100% ✅', cls: 'bg-emerald-500/20 text-emerald-300' },
        disputed: { txt: 'قيد التحكيم الإداري ⚖️', cls: 'bg-rose-500/20 text-rose-300' },
        completed: { txt: 'مكتمل ومُصفّى بالكامل 🏁', cls: 'bg-sky-500/20 text-sky-300' },
        cancelled: { txt: 'ملغى ❌', cls: 'bg-slate-800 text-slate-400' }
      };
      const st = stMap[ag.status] || { txt: ag.status || '—', cls: 'bg-slate-800 text-slate-300' };
      const addonsCount = Array.isArray(ag.addons) ? ag.addons.length : 0;

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-4 space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-emerald-400"><i class="fa-solid fa-certificate me-1"></i> شهادة تحقق رسمي من عقد ضمان سايت</h3>
            <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-center space-y-1">
            <div class="text-base font-black text-white tracking-wider">${app.esc(ag.ticketNumber)}</div>
            <span class="inline-block px-3 py-1 rounded-xl ${st.cls} text-[11px] font-black">${st.txt}</span>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
            <div class="font-black text-amber-300 text-xs">${app.esc(ag.title)}</div>
            <div class="grid grid-cols-2 gap-1.5 pt-1">
              <div>إجمالي القيمة: <b class="text-emerald-400">${app.fmtMoney(ag.totalAmount)} ج.م</b></div>
              <div>المتبقي بالضمان: <b class="text-amber-300">${app.fmtMoney(ag.remainingEscrow || 0)} ج.م</b></div>
              <div>تاريخ البداية: <b class="text-white">${app.esc(ag.startDate || ag.date || '—')}</b></div>
              <div>تاريخ التسليم: <b class="text-white">${app.esc(ag.endDate || '—')}</b></div>
            </div>
            <div class="pt-1.5 border-t border-slate-800 space-y-0.5 text-[10.5px] text-slate-300">
              <div>الطرف الأول (صاحب العمل): <b class="text-white">${app.esc(ag.payerLegalName || ag.payerName)}</b></div>
              <div>الطرف الثاني (المنفّذ): <b class="text-white">${app.esc(ag.providerLegalName || ag.providerName)}</b></div>
              <div>موقع التنفيذ: <b>${app.esc(ag.location || '—')}</b></div>
              <div>اعتماد العقد الموقّع: <b class="${ag.contractStatus === 'approved' ? 'text-emerald-400' : 'text-amber-300'}">${ag.contractStatus === 'approved' ? 'معتمد رسمياً من الإدارة ✅' : 'بانتظار الاعتماد ⏳'}</b></div>
              ${addonsCount ? `<div>السيارات والإضافات الملحقة: <b class="text-purple-300">${addonsCount} ملحق مسجّل</b></div>` : ''}
            </div>
          </div>

          <button type="button" onclick="document.getElementById('daman-verify-ct-modal').classList.add('hidden')" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">إغلاق</button>
        </div>`;
    },

    // ==================== 3. POST & PROFILE SHARE ====================
    sharePost(pid) {
      const app = window.DamanApp;
      const p = (window.DamanProjects && DamanProjects.getAllMarketPosts)
        ? DamanProjects.getAllMarketPosts(app).find((x) => x.id === pid)
        : null;
      if (!p) return;

      const url = this.buildUrl('post', p.id);
      this.openModal({
        header: 'مشاركة الإعلان ورمز QR',
        badge: p.budget ? `السعر/الميزانية: ${app.fmtMoney(p.budget)} ج.م` : 'إعلان موثّق على ضمان سايت',
        title: p.title,
        subtitle: `📍 ${p.city || 'مصر'} • ${p.ownerName || ''}`,
        url,
        shareText: `🏗️ إعلان على منصة ضمان سايت:\n${p.title}\n📍 ${p.city || ''}${p.budget ? `\n💰 ${app.fmtMoney(p.budget)} ج.م` : ''}\nشاهد التفاصيل واتفق بالضمان:`
      });
    },

    async shareProfile(uid) {
      const app = window.DamanApp;
      if (!app || !uid) return;
      let name = '';
      let sub = 'حساب موثّق على منصة ضمان سايت';

      if (app.user && uid === app.user.uid && app.profile) {
        name = app.profile.companyName || app.profile.name || 'حسابي';
        sub = [app.profile.specialty || '', app.profile.city || ''].filter(Boolean).join(' • ') || sub;
      } else {
        try {
          const s = await app.db.collection('users').doc(uid).get();
          if (s.exists) {
            const d = s.data();
            name = d.companyName || d.name || 'مستخدم ضمان سايت';
            sub = [d.specialty || '', d.city || ''].filter(Boolean).join(' • ') || sub;
          }
        } catch (e) {}
      }

      const url = this.buildUrl('u', uid);
      this.openModal({
        header: 'بطاقة QR ومشاركة الصفحة',
        badge: 'ملف تعريفي موثّق — ضمان سايت',
        title: name || 'عضو ضمان سايت',
        subtitle: sub,
        url,
        shareText: `🛡️ تواصل معي واطّلع على سابقة أعمالي وتعاقد بالضمان المالي عبر ضمان سايت (${name}):`
      });
    },

    // ==================== 4. DEEP-LINK ROUTER ON LOAD (?verify= / ?post= / ?u=) ====================
    async handleIncomingDeepLinks() {
      if (this._deepLinkHandled) return;
      const app = window.DamanApp;
      if (!app || !app.db) return;

      const params = new URLSearchParams(window.location.search);
      const verifyCode = params.get('verify');
      const postId = params.get('post');
      const userId = params.get('u');
      if (!verifyCode && !postId && !userId) return;

      this._deepLinkHandled = true;

      if (verifyCode) {
        setTimeout(() => this.openContractVerifyModal(verifyCode), 700);
        return;
      }

      if (userId) {
        setTimeout(() => {
          if (typeof app.openPublicProfile === 'function') app.openPublicProfile(userId);
        }, 700);
        return;
      }

      if (postId) {
        setTimeout(async () => {
          app.switchTab('projects');
          if (window.DamanProjects) {
            let found = DamanProjects.getAllMarketPosts(app).find((x) => x.id === postId);
            if (!found) {
              try {
                const snap = await app.db.collection('projects').doc(postId).get();
                if (snap.exists) {
                  found = Object.assign({ id: snap.id }, snap.data());
                  DamanProjects.projects.unshift(found);
                }
              } catch (e) {}
            }
            if (found) DamanProjects.openPostDetails(postId);
            else app.toast('هذا الإعلان غير متاح أو تم حذفه', 'warning');
          }
        }, 750);
      }
    },

    // ==================== 5. NON-INVASIVE UI INJECTIONS ====================
    injectProfileShareCard() {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'profile') return;
      const targetUid = app.viewingPublicUid || app.user?.uid;
      if (!targetUid) return;

      const main = document.getElementById('app-main');
      if (!main || document.getElementById('daman-prof-share-qr-bar')) return;

      const root = main.firstElementChild || main;
      const bar = document.createElement('div');
      bar.id = 'daman-prof-share-qr-bar';
      bar.className = 'grid grid-cols-2 gap-2 mb-3 text-xs';
      bar.innerHTML = `
        <button type="button" onclick="DamanShareQR.shareProfile('${app.esc(targetUid)}')" class="py-2.5 px-3 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-amber-300 font-black text-[11px] flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-qrcode"></i>
          <span>${app.viewingPublicUid ? 'مشاركة وQR الصفحة' : 'مشاركة صفحتي وQR'}</span>
        </button>
        <button type="button" onclick="DamanShareQR.promptVerifyContractCode()" class="py-2.5 px-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-black text-[11px] flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-certificate"></i>
          <span>التحقق من كود عقد</span>
        </button>`;
      root.insertBefore(bar, root.firstElementChild);
    },

    enhanceMarketCardsHtml(html, app) {
      if (!html || !html.includes('toggleFavorite(')) return html;
      const wrap = document.createElement('div');
      wrap.innerHTML = html;

      Array.from(wrap.children).forEach((card) => {
        if (card.querySelector('.daman-card-qr-btn')) return;
        const favBtn = card.querySelector('button[onclick*="DamanProjects.toggleFavorite"]');
        if (!favBtn) return;
        const m = (favBtn.getAttribute('onclick') || '').match(/toggleFavorite\('([^']+)'\)/);
        if (!m || !m[1]) return;
        const pid = m[1];

        const group = document.createElement('div');
        group.className = 'flex items-center gap-2 shrink-0';

        const shBtn = document.createElement('button');
        shBtn.type = 'button';
        shBtn.title = 'مشاركة وQR الإعلان';
        shBtn.className = 'daman-card-qr-btn text-amber-400 hover:text-amber-300 text-xs';
        shBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';
        shBtn.onclick = (ev) => { ev.stopPropagation(); this.sharePost(pid); };

        favBtn.parentNode.insertBefore(group, favBtn);
        group.appendChild(shBtn);
        group.appendChild(favBtn);
      });

      return wrap.innerHTML;
    },

    enhancePostDetailModal(pid) {
      const modal = document.getElementById('daman-post-detail-modal');
      const card = modal && modal.firstElementChild;
      if (!card || card.querySelector('.daman-detail-share-btn')) return;

      const headerRow = card.firstElementChild;
      const closeBtn = headerRow && headerRow.querySelector('button');
      if (headerRow && closeBtn) {
        const rightWrap = document.createElement('div');
        rightWrap.className = 'flex items-center gap-1.5 shrink-0';

        const shBtn = document.createElement('button');
        shBtn.type = 'button';
        shBtn.className = 'daman-detail-share-btn px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-black text-[10px]';
        shBtn.innerHTML = '<i class="fa-solid fa-qrcode me-1"></i>مشاركة / QR';
        shBtn.onclick = () => this.sharePost(pid);

        headerRow.insertBefore(rightWrap, closeBtn);
        rightWrap.appendChild(shBtn);
        rightWrap.appendChild(closeBtn);
      }
    },

    enhanceContractCardHtml(html, ag, app) {
      if (!html || !ag || !ag.id) return html;
      const wrap = document.createElement('div');
      wrap.innerHTML = html.trim();
      const card = wrap.firstElementChild;
      if (!card || card.querySelector('.daman-ct-qr-btn')) return html;

      const topRow = card.firstElementChild;
      if (topRow) {
        const qrBtn = document.createElement('button');
        qrBtn.type = 'button';
        qrBtn.className = 'daman-ct-qr-btn px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[9.5px] font-black shrink-0';
        qrBtn.innerHTML = '<i class="fa-solid fa-qrcode me-0.5"></i> QR العقد';
        qrBtn.onclick = () => this.shareContract(ag.id);

        const rightBox = document.createElement('div');
        rightBox.className = 'flex items-center gap-1.5 shrink-0';
        const statusEl = topRow.lastElementChild;
        if (statusEl && statusEl !== topRow.firstElementChild) {
          topRow.insertBefore(rightBox, statusEl);
          rightBox.appendChild(qrBtn);
          rightBox.appendChild(statusEl);
        } else {
          topRow.appendChild(qrBtn);
        }
      }

      return wrap.innerHTML;
    },

    // ==================== 6. BOOT & HOOKS ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      // 1. Hook DamanChat.renderContractCard -> adds live "QR العقد" button to every contract
      if (window.DamanChat && typeof DamanChat.renderContractCard === 'function' && !DamanChat._qrHooked) {
        DamanChat._qrHooked = true;
        const origCtCard = DamanChat.renderContractCard.bind(DamanChat);
        DamanChat.renderContractCard = (a, ap) => {
          const html = origCtCard(a, ap);
          try { return this.enhanceContractCardHtml(html, a, ap || app); } catch (e) { return html; }
        };
      }

      // 2. Hook DamanProjects market cards & details modal
      if (window.DamanProjects && !DamanProjects._qrHooked) {
        DamanProjects._qrHooked = true;
        const origCards = DamanProjects.renderMarketCards.bind(DamanProjects);
        DamanProjects.renderMarketCards = (ap) => {
          const html = origCards(ap);
          try { return this.enhanceMarketCardsHtml(html, ap || app); } catch (e) { return html; }
        };

        const origDet = DamanProjects.openPostDetails.bind(DamanProjects);
        DamanProjects.openPostDetails = (pid) => {
          origDet(pid);
          try { this.enhancePostDetailModal(pid); } catch (e) {}
        };
      }

      // 3. Hook Profile Tab -> adds Profile QR Share & Contract Code Verifier
      if (typeof app.renderCurrentTab === 'function' && !app._qrProfHooked) {
        app._qrProfHooked = true;
        const origRenderTab = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRenderTab();
          if (app.activeTab === 'profile') setTimeout(() => this.injectProfileShareCard(), 70);
        };
      }

      this.handleIncomingDeepLinks();
      if (['projects', 'chat', 'profile'].includes(app.activeTab)) app.renderCurrentTab();
    }
  };

  window.DamanShareQR = ShareQR;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => ShareQR.boot(), 380));
  else setTimeout(() => ShareQR.boot(), 380);
})();
