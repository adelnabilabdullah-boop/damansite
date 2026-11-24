(function () {
  const KycBdayQR = {
    _booted: false,
    _qrStream: null,
    _qrScanTimer: null,
    _camStream: null,
    _camTargetInputId: null,
    _camFacing: 'environment',
    _bdayCheckedForUid: null,
    _expiryCheckedForUid: null,
    bdayConfig: {
      enabled: true,
      message: '🎂 كل سنة وأنت طيب وبألف خير يا {name}! أسرة ضمان سايت تتمنى لك عاماً مليئاً بالنجاح والرزق الوفير والتوفيق الدائم.',
      giftType: 'none', // 'none' | 'wallet' | 'vip_days'
      giftValue: 0
    },
    allUsersForBday: [],

    // ==================== 1. LIVE CAMERA QR SCANNER FOR CONTRACT VERIFICATION ====================
    ensureJsQrLoaded() {
      return new Promise((resolve) => {
        if (window.jsQR) return resolve(true);
        const existing = document.getElementById('daman-jsqr-cdn');
        if (existing) {
          existing.addEventListener('load', () => resolve(!!window.jsQR));
          return;
        }
        const s = document.createElement('script');
        s.id = 'daman-jsqr-cdn';
        s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
        s.onload = () => resolve(!!window.jsQR);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });
    },

    extractContractTicket(rawText) {
      const txt = String(rawText || '').trim();
      if (!txt) return '';
      try {
        if (txt.includes('verify=')) {
          const u = new URL(txt);
          const v = u.searchParams.get('verify');
          if (v) return v.trim().toUpperCase();
        }
      } catch (e) {
        const mUrl = txt.match(/[?&]verify=([^&#\s]+)/i);
        if (mUrl && mUrl[1]) return decodeURIComponent(mUrl[1]).trim().toUpperCase();
      }
      const mTkt = txt.match(/TKT-[A-Z0-9-]+/i);
      if (mTkt) return mTkt[0].toUpperCase();
      return txt.toUpperCase();
    },

    stopQrScanner() {
      if (this._qrScanTimer) {
        clearInterval(this._qrScanTimer);
        this._qrScanTimer = null;
      }
      if (this._qrStream) {
        try { this._qrStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
        this._qrStream = null;
      }
    },

    closeQrScannerModal() {
      this.stopQrScanner();
      document.getElementById('daman-qr-scanner-modal')?.classList.add('hidden');
    },

    openContractScannerModal() {
      const app = window.DamanApp;
      if (!app) return;
      this.stopQrScanner();

      let m = document.getElementById('daman-qr-scanner-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-qr-scanner-modal';
        m.className = 'daman-modal fixed inset-0 z-[96] bg-black/94 backdrop-blur-md flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'qrScanner' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-emerald-500/60 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-emerald-400">
              <i class="fa-solid fa-qrcode me-1"></i> التحقق الرسمي من العقد (QR أو الكود)
            </h3>
            <button type="button" onclick="DamanKycBdayQR.closeQrScannerModal()" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-200"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <!-- 1. Live Camera QR Scanner -->
          <div class="p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2 text-center">
            <div class="flex items-center justify-between">
              <span class="font-black text-emerald-300 text-[11px]"><i class="fa-solid fa-camera me-1"></i> 1. مسح رمز QR بالكاميرا</span>
              <button type="button" id="daman-qr-cam-toggle" onclick="DamanKycBdayQR.startCameraQrScan()" class="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10px]">تشغيل الكاميرا</button>
            </div>
            <div id="daman-qr-video-wrap" class="hidden relative rounded-2xl overflow-hidden border border-emerald-400/60 bg-black">
              <video id="daman-qr-video" autoplay playsinline muted class="w-full h-56 object-cover"></video>
              <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div class="w-40 h-40 border-2 border-amber-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"></div>
              </div>
              <div class="absolute bottom-2 inset-x-2 text-[10px] font-black text-amber-300 bg-black/70 py-1 rounded-lg">وجّه الكاميرا نحو رمز QR المطبوع على العقد</div>
            </div>
            <div id="daman-qr-scan-status" class="text-[10.5px] text-slate-400">اضغط «تشغيل الكاميرا» لمسح كود العقد مباشرة</div>
          </div>

          <!-- 2. Scan QR from Image File -->
          <label class="block p-2.5 rounded-2xl bg-slate-950 border border-dashed border-sky-500/50 text-center cursor-pointer">
            <span class="font-black text-sky-300 text-[11px]"><i class="fa-solid fa-image me-1"></i> 2. أو اختر صورة / لقطة شاشة لرمز QR</span>
            <input type="file" accept="image/*" class="hidden" onchange="DamanKycBdayQR.scanQrFromImageFile(this)" />
          </label>

          <!-- 3. Manual Ticket Code Input -->
          <form onsubmit="DamanKycBdayQR.submitManualTicket(event)" class="p-3 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-2">
            <label class="block font-black text-amber-300 text-[11px]"><i class="fa-solid fa-keyboard me-1"></i> 3. أو اكتب كود العقد يدوياً</label>
            <div class="flex gap-1.5">
              <input id="daman-manual-tkt-inp" type="text" required placeholder="مثال: TKT-123456" dir="ltr" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-black uppercase text-center tracking-wider" />
              <button type="submit" class="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shrink-0">تحقق الآن</button>
            </div>
          </form>
        </div>`;

      // Auto-start camera right away on open
      setTimeout(() => this.startCameraQrScan(), 120);
    },

    async startCameraQrScan() {
      const app = window.DamanApp;
      const statusEl = document.getElementById('daman-qr-scan-status');
      const wrapEl = document.getElementById('daman-qr-video-wrap');
      const videoEl = document.getElementById('daman-qr-video');
      if (!videoEl || !wrapEl) return;

      this.stopQrScanner();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusEl) statusEl.textContent = 'المتصفح لا يدعم فتح الكاميرا — استخدم مسح الصورة أو كتابة الكود بالأسفل.';
        return;
      }

      if (statusEl) statusEl.textContent = 'جارٍ فتح الكاميرا الخلفية...';
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        this._qrStream = stream;
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
        wrapEl.classList.remove('hidden');
        if (statusEl) statusEl.textContent = '🔍 الكاميرا تعمل الآن — جاري البحث عن رمز QR...';

        const hasNative = 'BarcodeDetector' in window;
        let detector = null;
        if (hasNative) {
          try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }
        }
        if (!detector) await this.ensureJsQrLoaded();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        this._qrScanTimer = setInterval(async () => {
          if (!videoEl || videoEl.readyState < 2) return;
          try {
            let foundRaw = '';
            if (detector) {
              const codes = await detector.detect(videoEl);
              if (codes && codes.length && codes[0].rawValue) foundRaw = codes[0].rawValue;
            } else if (window.jsQR) {
              const w = Math.min(videoEl.videoWidth || 480, 520);
              const h = Math.min(videoEl.videoHeight || 480, 520);
              if (w > 0 && h > 0) {
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(videoEl, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const code = window.jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
                if (code && code.data) foundRaw = code.data;
              }
            }

            if (foundRaw) {
              const ticket = this.extractContractTicket(foundRaw);
              if (ticket) {
                this.closeQrScannerModal();
                app.toast(`تم التقاط كود العقد: ${ticket} ✅`, 'success');
                if (window.DamanShareQR) DamanShareQR.openContractVerifyModal(ticket);
              }
            }
          } catch (e) {}
        }, 350);
      } catch (err) {
        wrapEl.classList.add('hidden');
        if (statusEl) statusEl.textContent = 'تعذر فتح الكاميرا (تأكد من السماح بصلاحية الكاميرا) — يمكنك كتابة الكود بالأسفل.';
      }
    },

    async scanQrFromImageFile(input) {
      const f = input.files && input.files[0];
      const app = window.DamanApp;
      if (!f) return;
      input.value = '';
      app.toast('جارٍ قراءة رمز QR من الصورة...', 'info');
      await this.ensureJsQrLoaded();

      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = async () => {
        try {
          let foundRaw = '';
          if ('BarcodeDetector' in window) {
            try {
              const det = new window.BarcodeDetector({ formats: ['qr_code'] });
              const res = await det.detect(img);
              if (res && res.length) foundRaw = res[0].rawValue;
            } catch (e) {}
          }
          if (!foundRaw && window.jsQR) {
            const c = document.createElement('canvas');
            const scale = Math.min(1, 900 / Math.max(img.width, img.height));
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, c.width, c.height);
            const data = ctx.getImageData(0, 0, c.width, c.height);
            const qr = window.jsQR(data.data, c.width, c.height);
            if (qr && qr.data) foundRaw = qr.data;
          }
          URL.revokeObjectURL(url);
          const ticket = this.extractContractTicket(foundRaw);
          if (!ticket) return app.toast('لم يتم العثور على رمز QR واضح في هذه الصورة', 'error');
          this.closeQrScannerModal();
          if (window.DamanShareQR) DamanShareQR.openContractVerifyModal(ticket);
        } catch (e) {
          URL.revokeObjectURL(url);
          app.toast('تعذر قراءة الصورة', 'error');
        }
      };
      img.src = url;
    },

    submitManualTicket(e) {
      e.preventDefault();
      const raw = document.getElementById('daman-manual-tkt-inp')?.value || '';
      const ticket = this.extractContractTicket(raw);
      if (!ticket) return;
      this.closeQrScannerModal();
      if (window.DamanShareQR) DamanShareQR.openContractVerifyModal(ticket);
    },

    // ==================== 2. KYC LIVE CAMERA CAPTURE + ID EXPIRY DATE VALIDATION ====================
    closeInAppCamera() {
      if (this._camStream) {
        try { this._camStream.getTracks().forEach((t) => t.stop()); } catch (e) {}
        this._camStream = null;
      }
      document.getElementById('daman-kyc-livecam-modal')?.classList.add('hidden');
    },

    async openInAppCameraForInput(inputId, facing = 'environment', title = 'التقاط صورة مباشرة بالكاميرا') {
      const app = window.DamanApp;
      const targetInp = document.getElementById(inputId);
      if (!targetInp) return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        targetInp.setAttribute('capture', facing);
        targetInp.click();
        return;
      }

      this.closeInAppCamera();
      this._camTargetInputId = inputId;
      this._camFacing = facing;

      let m = document.getElementById('daman-kyc-livecam-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-kyc-livecam-modal';
        m.className = 'daman-modal fixed inset-0 z-[98] bg-black/95 flex flex-col p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      m.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <span class="font-black text-amber-400">📸 ${app.esc(title)}</span>
          <button type="button" onclick="DamanKycBdayQR.closeInAppCamera()" class="w-8 h-8 rounded-xl bg-rose-500 text-white"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="flex-1 flex flex-col items-center justify-center gap-3 py-2">
          <video id="daman-kyc-cam-vid" autoplay playsinline muted class="w-full max-w-md max-h-[68vh] rounded-2xl border-2 border-amber-500/60 bg-black object-cover"></video>
          <div class="text-[11px] text-slate-300 text-center">تأكد من وضوح البيانات والإضاءة الجيدة ثم اضغط التقاط</div>
          <button type="button" onclick="DamanKycBdayQR.snapInAppCameraPhoto()" class="w-full max-w-md py-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-black text-sm shadow-xl">
            <i class="fa-solid fa-camera me-1"></i> التقاط الصورة الآن
          </button>
        </div>`;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false
        });
        this._camStream = stream;
        const vid = document.getElementById('daman-kyc-cam-vid');
        if (vid) {
          vid.srcObject = stream;
          await vid.play().catch(() => {});
        }
      } catch (err) {
        this.closeInAppCamera();
        app.toast('تعذر فتح الكاميرا — افتح الكاميرا من زر التصوير المباشر', 'warning');
        targetInp.setAttribute('capture', facing);
        targetInp.click();
      }
    },

    snapInAppCameraPhoto() {
      const vid = document.getElementById('daman-kyc-cam-vid');
      const targetInp = this._camTargetInputId ? document.getElementById(this._camTargetInputId) : null;
      if (!vid || !targetInp) return;

      const c = document.createElement('canvas');
      c.width = vid.videoWidth || 1024;
      c.height = vid.videoHeight || 768;
      const ctx = c.getContext('2d');
      ctx.drawImage(vid, 0, 0, c.width, c.height);

      c.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `kyc-live-${Date.now()}.jpg`, { type: 'image/jpeg' });
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          targetInp.files = dt.files;
        } catch (e) {}
        targetInp.dispatchEvent(new Event('change', { bubbles: true }));
        this.closeInAppCamera();
        window.DamanApp.toast('تم التقاط الصورة بالكاميرا بنجاح ✅', 'success');
      }, 'image/jpeg', 0.88);
    },

    enhanceKycModalDOM() {
      const app = window.DamanApp;
      const modal = document.getElementById('daman-kyc-modal');
      if (!modal || modal.classList.contains('hidden')) return;
      const form = modal.querySelector('form');
      if (!form) return;

      // 1. Force Camera Capture (no old gallery uploads) on all KYC file inputs
      const fileInputs = Array.from(form.querySelectorAll('input[type="file"]'));
      fileInputs.forEach((inp, idx) => {
        if (inp.dataset.liveCamEnforced) return;
        inp.dataset.liveCamEnforced = '1';
        if (!inp.id) inp.id = `kyc-live-inp-${idx}`;

        const lblText = (inp.parentElement?.textContent || '').trim();
        const isSelfie = lblText.includes('سيلفي') || lblText.toLowerCase().includes('selfie');
        const facing = isSelfie ? 'user' : 'environment';

        inp.setAttribute('accept', 'image/*');
        inp.setAttribute('capture', facing);

        const camBtn = document.createElement('button');
        camBtn.type = 'button';
        camBtn.className = 'mt-1.5 w-full py-1.5 px-2.5 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 font-black text-[10.5px] flex items-center justify-center gap-1';
        camBtn.innerHTML = `<i class="fa-solid fa-camera"></i><span>${isSelfie ? '📸 تصوير سيلفي مباشر بالكاميرا' : '📸 تصوير المستند بالكاميرا مباشرة'}</span>`;
        camBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          this.openInAppCameraForInput(inp.id, facing, lblText || 'تصوير مستند التوثيق');
        };
        if (inp.parentElement) inp.parentElement.appendChild(camBtn);
      });

      // 2. Inject National ID Expiry Date input + Camera-Only Security Notice
      if (!document.getElementById('kyc-id-expiry')) {
        const notice = document.createElement('div');
        notice.className = 'p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/50 text-[10.5px] text-amber-200 font-bold leading-relaxed';
        notice.innerHTML = '📸 <b>التوثيق بالكاميرا المباشرة فقط:</b> يُشترط تصوير البطاقة والسيلفي والسجل التجاري مباشرة بالكاميرا، وأن تكون البطاقة سارية غير منتهية.';
        form.insertBefore(notice, form.firstElementChild);

        const expWrap = document.createElement('div');
        expWrap.className = 'p-2.5 rounded-2xl bg-slate-950 border border-rose-500/40 space-y-1';
        expWrap.innerHTML = `
          <label class="block text-[10.5px] font-black text-rose-300">
            📅 تاريخ انتهاء البطاقة الشخصية (مدوّن بظهر البطاقة) *
          </label>
          <input id="kyc-id-expiry" type="date" required value="${app.esc(app.profile?.idExpiryDate || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold" />
          <div class="text-[9.5px] text-slate-400">لن يُقبل توثيق الحساب إذا كانت البطاقة منتهية، وسيصلك تنبيه تلقائي عند انتهائها مستقبلاً لتجديدها.</div>`;

        const firstFileParent = fileInputs[0]?.parentElement;
        if (firstFileParent && firstFileParent.parentNode === form) {
          form.insertBefore(expWrap, firstFileParent);
        } else {
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) form.insertBefore(expWrap, submitBtn);
          else form.appendChild(expWrap);
        }
      }

      // 3. Capture-phase submit validator: block expired ID + save idExpiryDate
      if (!form.dataset.expiryGuardBound) {
        form.dataset.expiryGuardBound = '1';
        form.addEventListener('submit', (ev) => {
          const expInp = document.getElementById('kyc-id-expiry');
          const expVal = (expInp?.value || '').trim();
          const today = app.todayLocal();

          if (!expVal) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return app.toast('يرجى إدخال تاريخ انتهاء البطاقة الشخصية أولاً', 'error');
          }
          if (expVal <= today) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            return app.toast('❌ عذراً، البطاقة الشخصية منتهية الصلاحية! يرجى تجديد البطاقة أولاً ثم إعادة التصوير.', 'error');
          }

          // Persist idExpiryDate after original submit handler saves KYC
          setTimeout(async () => {
            if (!app.user || !app.db) return;
            try {
              await Promise.all([
                app.db.collection('kycRequests').doc(app.user.uid).set({ idExpiryDate: expVal }, { merge: true }).catch(() => {}),
                app.db.collection('users').doc(app.user.uid).set({ idExpiryDate: expVal, idExpiryExpired: false }, { merge: true }).catch(() => {})
              ]);
            } catch (e) {}
          }, 900);
        }, true);
      }
    },

    // ==================== 3. AUTO CHECK EXPIRED NATIONAL ID & SEND RENEWAL ALERT ====================
    async checkUserNationalIdExpiry() {
      const app = window.DamanApp;
      if (!app || !app.user || !app.profile || !app.db) return;
      const uid = app.user.uid;
      if (this._expiryCheckedForUid === uid) return;

      let expDate = app.profile.idExpiryDate || '';
      if (!expDate) {
        try {
          const kSnap = await app.db.collection('kycRequests').doc(uid).get();
          if (kSnap.exists && kSnap.data().idExpiryDate) {
            expDate = kSnap.data().idExpiryDate;
            await app.db.collection('users').doc(uid).set({ idExpiryDate: expDate }, { merge: true }).catch(() => {});
          }
        } catch (e) {}
      }

      if (!expDate) return;
      this._expiryCheckedForUid = uid;
      const today = app.todayLocal();
      if (expDate > today) return;

      // ID IS EXPIRED!
      this._isCurrentUserIdExpired = true;
      this.injectExpiredIdWarningBanner(expDate);

      const notifMarkKey = `daman_id_exp_notif_${uid}`;
      const lastNotified = localStorage.getItem(notifMarkKey) || app.profile.lastIdExpiryAlertDate || '';
      if (lastNotified !== today) {
        localStorage.setItem(notifMarkKey, today);
        try {
          await app.sendNotification(
            uid,
            '🪪 تنبيه هام: انتهاء صلاحية البطاقة الشخصية',
            `انتهت صلاحية بطاقتك الشخصية بتاريخ (${expDate}). يرجى تجديد تصوير البطاقة الشخصية السارية فوراً من صفحة التوثيق للحفاظ على حالة التوثيق.`
          );
          await app.db.collection('users').doc(uid).set({
            idExpiryExpired: true,
            lastIdExpiryAlertDate: today
          }, { merge: true }).catch(() => {});
        } catch (e) {}
      }
    },

    injectExpiredIdWarningBanner(expDate) {
      const main = document.getElementById('app-main');
      if (!main || document.getElementById('daman-expired-id-alert')) return;
      const div = document.createElement('div');
      div.id = 'daman-expired-id-alert';
      div.className = 'mb-3 p-3 rounded-2xl bg-rose-600/20 border-2 border-rose-500 text-xs space-y-2 shadow-lg';
      div.innerHTML = `
        <div class="flex items-start gap-2 text-rose-200">
          <i class="fa-solid fa-id-card-clip text-rose-400 text-base mt-0.5"></i>
          <div>
            <div class="font-black text-rose-300">⚠️ انتهت صلاحية بطاقتك الشخصية (${window.DamanApp.esc(expDate)})</div>
            <div class="text-[11px] leading-relaxed">يرجى تجديد رفع صورة البطاقة الشخصية السارية بالكاميرا الآن للاستمرار في التوثيق الكامل والعقود المضمونة.</div>
          </div>
        </div>
        <button type="button" onclick="if(window.DamanWallet) DamanWallet.openKycModal(false)" class="w-full py-2 rounded-xl bg-rose-500 text-white font-black text-[11px]">
          📸 تجديد تصوير البطاقة الشخصية الآن
        </button>`;
      main.insertBefore(div, main.firstElementChild);
    },

    // ==================== 4. BIRTHDAY GREETINGS, GIFTS & ADMIN CONTROL PANEL ====================
    async loadBirthdayConfig() {
      const app = window.DamanApp;
      if (!app || !app.db) return;
      try {
        const snap = await app.db.collection('settings').doc('birthdayConfig').get();
        if (snap.exists) {
          this.bdayConfig = Object.assign({}, this.bdayConfig, snap.data());
        }
      } catch (e) {}
    },

    async checkAndCelebrateUserBirthday() {
      const app = window.DamanApp;
      if (!app || !app.user || !app.profile || !app.db) return;
      const uid = app.user.uid;
      if (this._bdayCheckedForUid === uid) return;

      let bdate = app.profile.birthDate || '';
      if (!bdate) {
        try {
          const kSnap = await app.db.collection('kycRequests').doc(uid).get();
          if (kSnap.exists && kSnap.data().birthDate) {
            bdate = kSnap.data().birthDate;
            await app.db.collection('users').doc(uid).set({ birthDate: bdate }, { merge: true }).catch(() => {});
          }
        } catch (e) {}
      }

      if (!bdate || bdate.length < 10) return;
      this._bdayCheckedForUid = uid;

      const today = app.todayLocal(); // YYYY-MM-DD
      if (bdate.slice(5, 10) !== today.slice(5, 10)) return;

      const yearStr = today.slice(0, 4);
      const localKey = `daman_bday_celebrated_${uid}_${yearStr}`;
      if (localStorage.getItem(localKey) || String(app.profile.lastBirthdayGiftYear || '') === yearStr) return;

      await this.loadBirthdayConfig();
      if (this.bdayConfig.enabled === false) return;

      localStorage.setItem(localKey, '1');
      const userName = app.profile.name || app.profile.companyName || 'شريكنا العزيز';
      const msgBody = String(this.bdayConfig.message || '').replace(/\{name\}/g, userName);
      const giftType = this.bdayConfig.giftType || 'none';
      const giftVal = Number(this.bdayConfig.giftValue || 0);

      let giftSummary = '';
      try {
        const userUpd = { lastBirthdayGiftYear: yearStr };
        if (giftType === 'wallet' && giftVal > 0) {
          userUpd.walletBalance = firebase.firestore.FieldValue.increment(giftVal);
          giftSummary = `🎁 هدية عيد ميلادك: تم إضافة ${app.fmtMoney(giftVal)} ج.م إلى محفظتك مجاناً!`;
          await app.db.collection('walletTransactions').add({
            userId: uid,
            userName,
            type: 'gift',
            amount: giftVal,
            status: 'approved',
            method: 'birthday_gift',
            note: `🎂 هدية عيد الميلاد من إدارة ضمان سايت (${yearStr})`,
            date: today,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        } else if (giftType === 'vip_days' && giftVal > 0) {
          const baseTs = Math.max(Date.now(), Number(app.profile.vipUntil || 0));
          userUpd.vipUntil = baseTs + giftVal * 86400000;
          giftSummary = `👑 هدية عيد ميلادك: تم تفعيل باقة VIP مجاناً لمدة ${giftVal} يوم!`;
        }

        await app.db.collection('users').doc(uid).set(userUpd, { merge: true });
        await app.sendNotification(uid, '🎂 كل سنة وأنت طيب يا بطل!', `${msgBody}${giftSummary ? '\n' + giftSummary : ''}`);
        this.showBirthdayCelebrationModal(userName, msgBody, giftSummary);
      } catch (e) {}
    },

    showBirthdayCelebrationModal(name, message, giftSummary) {
      const app = window.DamanApp;
      let m = document.getElementById('daman-bday-celebrate-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-bday-celebrate-modal';
        m.className = 'daman-modal fixed inset-0 z-[98] bg-black/90 backdrop-blur-md flex items-center justify-center p-4';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      m.innerHTML = `
        <div class="w-full max-w-sm bg-gradient-to-br from-amber-950 via-slate-900 to-purple-950 border-2 border-amber-400 rounded-3xl p-5 text-center space-y-3 shadow-2xl text-xs">
          <div class="text-4xl">🎂🎉🎁</div>
          <h3 class="text-base font-black text-amber-300">عيد ميلاد سعيد يا ${app.esc(name)}!</h3>
          <p class="text-[11.5px] text-slate-100 leading-relaxed">${app.esc(message)}</p>
          ${giftSummary ? `<div class="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-black text-[11px]">${app.esc(giftSummary)}</div>` : ''}
          <button type="button" onclick="document.getElementById('daman-bday-celebrate-modal').classList.add('hidden')" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs">شكراً أسرة ضمان سايت ❤️</button>
        </div>`;
    },

    // ==================== ADMIN BIRTHDAY & GIFT CONTROL PANEL ====================
    async saveBirthdaySettings(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;

      this.bdayConfig = {
        enabled: document.getElementById('bdc-enabled')?.checked !== false,
        message: (document.getElementById('bdc-msg')?.value || '').trim(),
        giftType: document.getElementById('bdc-type')?.value || 'none',
        giftValue: Math.max(0, parseFloat(document.getElementById('bdc-val')?.value) || 0)
      };

      await app.db.collection('settings').doc('birthdayConfig').set(
        Object.assign({}, this.bdayConfig, { updatedAt: firebase.firestore.FieldValue.serverTimestamp() }),
        { merge: true }
      );
      await app.logAudit('birthday_config_save', `تحديث إعدادات أعياد الميلاد: ${this.bdayConfig.giftType} (${this.bdayConfig.giftValue})`);
      app.toast('تم حفظ إعدادات أعياد الميلاد والهدايا بنجاح ✅', 'success');
    },

    async sendManualGiftToUser(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.isAdmin()) return;
      const uid = document.getElementById('bdg-uid')?.value;
      const giftType = document.getElementById('bdg-type')?.value || 'wallet';
      const giftVal = Math.max(0, parseFloat(document.getElementById('bdg-val')?.value) || 0);
      const customMsg = (document.getElementById('bdg-msg')?.value || '').trim();
      if (!uid) return app.toast('اختر العضو المستلم أولاً', 'warning');

      const target = this.allUsersForBday.find((u) => u.id === uid);
      const tName = target?.name || target?.companyName || 'عضو';
      const today = app.todayLocal();

      await app.withLock('sendManualGift', async () => {
        const upd = {};
        let giftTxt = '';
        if (giftType === 'wallet' && giftVal > 0) {
          upd.walletBalance = firebase.firestore.FieldValue.increment(giftVal);
          giftTxt = `🎁 تم إضافة هدية رصيد بقيمة ${app.fmtMoney(giftVal)} ج.م إلى محفظتك!`;
          await app.db.collection('walletTransactions').add({
            userId: uid,
            userName: tName,
            type: 'gift',
            amount: giftVal,
            status: 'approved',
            method: 'admin_gift',
            note: customMsg || '🎁 هدية خاصة من إدارة ضمان سايت',
            date: today,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        } else if (giftType === 'vip_days' && giftVal > 0) {
          const baseTs = Math.max(Date.now(), Number(target?.vipUntil || 0));
          upd.vipUntil = baseTs + giftVal * 86400000;
          giftTxt = `👑 تم إهداؤك اشتراك VIP مجاني لمدة ${giftVal} يوم!`;
        }

        if (Object.keys(upd).length) {
          await app.db.collection('users').doc(uid).set(upd, { merge: true });
        }

        const finalBody = [customMsg || `🎂 كل سنة وأنت طيب يا ${tName}!`, giftTxt].filter(Boolean).join('\n');
        await app.sendNotification(uid, '🎁 تهنئة وهدية خاصة من إدارة ضمان سايت', finalBody);
        await app.logAudit('admin_send_gift', `إرسال هدية إلى ${tName}: ${giftType} (${giftVal})`);
        app.toast(`تم إرسال التهنئة والهدية إلى ${tName} بنجاح 🎉`, 'success');
      });
    },

    quickFillGiftRecipient(uid, name) {
      const sel = document.getElementById('bdg-uid');
      const msg = document.getElementById('bdg-msg');
      if (sel) sel.value = uid;
      if (msg && !msg.value.trim()) {
        msg.value = `🎂 كل سنة وأنت طيب وبألف خير يا ${name}! أسرة ضمان سايت تتمنى لك عاماً سعيداً ومليئاً بالنجاح.`;
      }
      sel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    async loadAdminBirthdayData() {
      const app = window.DamanApp;
      if (!app || !app.isAdmin()) return;
      await this.loadBirthdayConfig();
      try {
        const snap = await app.db.collection('users').limit(300).get();
        this.allUsersForBday = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      } catch (e) {}
      this.renderAdminBirthdayPanelBody();
    },

    renderAdminBirthdayPanelBody() {
      const app = window.DamanApp;
      const slot = document.getElementById('daman-adm-bday-body');
      if (!slot) return;

      const today = app.todayLocal();
      const todayMD = today.slice(5, 10);
      const thisMonth = today.slice(5, 7);

      const bdayToday = this.allUsersForBday.filter((u) => u.birthDate && u.birthDate.slice(5, 10) === todayMD);
      const bdayMonth = this.allUsersForBday.filter((u) => u.birthDate && u.birthDate.slice(5, 7) === thisMonth);

      slot.innerHTML = `
        <div class="space-y-4 text-xs">
          <!-- 1. Today's Birthdays -->
          <div class="glass-card rounded-2xl p-3.5 border-amber-500/50 space-y-2">
            <div class="font-black text-amber-400">🎂 أعياد ميلاد اليوم (${bdayToday.length}) — ${today}</div>
            ${!bdayToday.length ? `<div class="p-3 rounded-xl bg-slate-950 text-center text-slate-400">لا يوجد أعضاء عيد ميلادهم اليوم.</div>` : bdayToday.map((u) => `
              <div class="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <b class="text-white block truncate">${app.esc(u.name || u.companyName || 'عضو')}</b>
                  <span class="text-[10px] text-emerald-300">تاريخ الميلاد: ${app.esc(u.birthDate)}</span>
                </div>
                <button type="button" onclick="DamanKycBdayQR.quickFillGiftRecipient('${app.esc(u.id)}','${app.esc(u.name || 'صديقنا').replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] shrink-0">🎁 إرسال هدية</button>
              </div>`).join('')}
          </div>

          <!-- 2. Manual Gift & Greeting Sender -->
          <form onsubmit="DamanKycBdayQR.sendManualGiftToUser(event)" class="glass-card rounded-2xl p-3.5 border-emerald-500/40 space-y-2.5">
            <div class="font-black text-emerald-400">🎁 إرسال هدية وتهنئة يدوية لأي عضو</div>
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">اختر العضو المستلم *</label>
              <select id="bdg-uid" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">
                <option value="">-- اختر العضو --</option>
                ${this.allUsersForBday.map((u) => `<option value="${app.esc(u.id)}">${app.esc(u.name || u.companyName || u.email || u.id)}${u.birthDate ? ` (${u.birthDate})` : ''}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">نوع الهدية</label>
                <select id="bdg-type" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold">
                  <option value="wallet">💰 رصيد في المحفظة (ج.م)</option>
                  <option value="vip_days">👑 أيام باقة VIP مجانية</option>
                  <option value="none">💌 تهنئة بدون رصيد</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">قيمة الهدية (جنيه أو أيام)</label>
                <input id="bdg-val" type="number" min="0" value="50" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-black text-center" />
              </div>
            </div>
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">رسالة التهنئة *</label>
              <textarea id="bdg-msg" rows="2" required placeholder="اكتب كلمتين حلوين للعضو..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">🎉 إرسال التهنئة والهدية فوراً</button>
          </form>

          <!-- 3. Automatic Birthday Greeting & Gift Settings -->
          <form onsubmit="DamanKycBdayQR.saveBirthdaySettings(event)" class="glass-card rounded-2xl p-3.5 border-purple-500/40 space-y-2.5">
            <div class="font-black text-purple-300">⚙️ إعدادات التهنئة والهدية التلقائية في أعياد الميلاد</div>
            <label class="flex items-center gap-2 text-[11px] font-bold text-white cursor-pointer">
              <input id="bdc-enabled" type="checkbox" ${this.bdayConfig.enabled !== false ? 'checked' : ''} class="accent-amber-500" />
              <span>تفعيل إشعار التهنئة التلقائي يوم عيد ميلاد كل عضو</span>
            </label>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">الهدية التلقائية</label>
                <select id="bdc-type" class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-purple-200 font-bold">
                  <option value="none" ${this.bdayConfig.giftType === 'none' ? 'selected' : ''}>💌 تهنئة بكلام حلو فقط</option>
                  <option value="wallet" ${this.bdayConfig.giftType === 'wallet' ? 'selected' : ''}>💰 رصيد محفظة تلقائي</option>
                  <option value="vip_days" ${this.bdayConfig.giftType === 'vip_days' ? 'selected' : ''}>👑 أيام VIP مجانية</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] text-slate-300 mb-1">القيمة (جنيه / يوم)</label>
                <input id="bdc-val" type="number" min="0" value="${Number(this.bdayConfig.giftValue || 0)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-black text-center" />
              </div>
            </div>
            <div>
              <label class="block text-[10px] text-slate-300 mb-1">نص رسالة عيد الميلاد (استخدم {name} لاسم العضو)</label>
              <textarea id="bdc-msg" rows="3" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc(this.bdayConfig.message || '')}</textarea>
            </div>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-purple-600 text-white font-black">حفظ إعدادات أعياد الميلاد</button>
          </form>

          <!-- 4. This Month Birthdays -->
          <div class="glass-card rounded-2xl p-3.5 space-y-1.5">
            <div class="font-black text-sky-300">📅 أعياد ميلاد هذا الشهر (${bdayMonth.length})</div>
            ${!bdayMonth.length ? `<div class="text-slate-500">لا يوجد أعضاء مسجّلين بتاريخ ميلاد في هذا الشهر.</div>` : bdayMonth.map((u) => `
              <div class="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                <span class="text-white font-bold truncate">${app.esc(u.name || u.companyName || 'عضو')}</span>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-amber-300 font-bold">${app.esc(u.birthDate)}</span>
                  <button type="button" onclick="DamanKycBdayQR.quickFillGiftRecipient('${app.esc(u.id)}','${app.esc(u.name || 'صديقنا').replace(/'/g, "\\'")}')" class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-[10px]">هدية</button>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    },

    // ==================== 5. BOOT & HOOKS ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      // 1. Replace promptVerifyContractCode with full Camera QR Scanner + Manual Code Modal
      if (window.DamanShareQR) {
        DamanShareQR.promptVerifyContractCode = () => this.openContractScannerModal();

        // Also add "📷 مسح QR بالكاميرا" button inside Share Contract modal
        const origShareCt = DamanShareQR.shareContract.bind(DamanShareQR);
        DamanShareQR.shareContract = (agId) => {
          origShareCt(agId);
          setTimeout(() => {
            const modal = document.getElementById('daman-share-qr-modal');
            const card = modal && modal.firstElementChild;
            if (!card || card.querySelector('.daman-open-qr-cam-btn')) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'daman-open-qr-cam-btn w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-black text-[11px]';
            btn.innerHTML = '<i class="fa-solid fa-camera me-1"></i> فتح كاميرا مسح QR للتحقق من أي عقد';
            btn.onclick = () => {
              modal.classList.add('hidden');
              this.openContractScannerModal();
            };
            card.appendChild(btn);
          }, 50);
        };
      }

      // 2. Hook DamanWallet.openKycModal & observe #daman-kyc-modal for Live Camera + Expiry Date
      if (window.DamanWallet && typeof DamanWallet.openKycModal === 'function' && !DamanWallet._liveCamHooked) {
        DamanWallet._liveCamHooked = true;
        const origKycModal = DamanWallet.openKycModal.bind(DamanWallet);
        DamanWallet.openKycModal = function () {
          const r = origKycModal.apply(this, arguments);
          setTimeout(() => KycBdayQR.enhanceKycModalDOM(), 50);
          return r;
        };
      }

      if (typeof MutationObserver !== 'undefined') {
        const obs = new MutationObserver(() => {
          const m = document.getElementById('daman-kyc-modal');
          if (m && !m.classList.contains('hidden')) {
            this.enhanceKycModalDOM();
          }
          if (this._isCurrentUserIdExpired && app.profile?.idExpiryDate) {
            this.injectExpiredIdWarningBanner(app.profile.idExpiryDate);
          }
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      // 3. Hook Admin Panel to add "🎂 أعياد الميلاد والهدايا" tab cleanly without colliding with other dynamic tabs
      if (window.DamanAdmin && !DamanAdmin._bdayTabHooked) {
        DamanAdmin._bdayTabHooked = true;
        const prevSetTab = DamanAdmin.setSubTab.bind(DamanAdmin);
        DamanAdmin.setSubTab = function (t) {
          if (t === 'birthdays') {
            if (!window.DamanApp.isAdmin()) return window.DamanApp.toast('للأدمن الرئيسي فقط', 'error');
            this._viewingCategoriesTab = false;
            this._viewingKycVaultTab = false;
            this._viewingBdayTab = true;
            this.rerender();
            return;
          }
          this._viewingBdayTab = false;
          return prevSetTab(t);
        };

        const origAdmRender = DamanAdmin.render.bind(DamanAdmin);
        DamanAdmin.render = (container, a) => {
          origAdmRender(container, a);
          try {
            if (!a.isAdmin()) return;
            const tabBar = container.querySelector('.overflow-x-auto');
            if (!tabBar) return;

            const isBdayActive = !!DamanAdmin._viewingBdayTab;
            if (isBdayActive) {
              Array.from(tabBar.querySelectorAll('button')).forEach((b) => {
                b.className = 'shrink-0 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300';
              });
            }

            let btn = tabBar.querySelector('[data-adm-bday-tab]');
            if (!btn) {
              btn = document.createElement('button');
              btn.setAttribute('data-adm-bday-tab', '1');
              btn.onclick = () => DamanAdmin.setSubTab('birthdays');
              btn.textContent = '🎂 أعياد الميلاد والهدايا';
              tabBar.appendChild(btn);
            }
            btn.className = `shrink-0 px-3 py-2 rounded-xl ${isBdayActive ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 border border-slate-800 text-slate-300'}`;

            if (isBdayActive) {
              while (tabBar.nextElementSibling) tabBar.nextElementSibling.remove();
              const slot = document.createElement('div');
              slot.id = 'daman-adm-bday-body';
              slot.innerHTML = `<div class="p-6 text-center text-amber-300 font-bold">جارٍ تحميل بيانات أعياد الميلاد والهدايا...</div>`;
              tabBar.parentNode.appendChild(slot);
              this.loadAdminBirthdayData();
            }
          } catch (e) {}
        };
      }

      // 4. Periodic check once user profile loads (ID Expiry + Birthday Celebration)
      const profWatcher = setInterval(() => {
        if (app.user && app.profile) {
          this.checkUserNationalIdExpiry();
          this.checkAndCelebrateUserBirthday();
          if (this._expiryCheckedForUid === app.user.uid && this._bdayCheckedForUid === app.user.uid) {
            clearInterval(profWatcher);
          }
        }
      }, 1500);
    }
  };

  window.DamanKycBdayQR = KycBdayQR;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => KycBdayQR.boot(), 520));
  else setTimeout(() => KycBdayQR.boot(), 520);
})();
