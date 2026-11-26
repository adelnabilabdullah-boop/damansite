(function () {
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  const KycGateOcr = {
    _booted: false,
    _obs: null,
    _timer: null,
    _runningPass: false,
    _lastToastAt: 0,
    _lastToastAction: '',
    _tesseractPromise: null,
    _docType: 'national_id', // 'national_id' | 'passport'
    _photos: { front: '', back: '', selfie: '', cr: '', tax: '' },
    _ocrState: {
      status: 'idle', // 'idle' | 'running' | 'done' | 'failed'
      rawText: '',
      extracted: { legalName: '', docNumber: '', birthDate: '', expiryDate: '', legalAddress: '' }
    },

    esc(str) {
      if (window.DamanApp && typeof DamanApp.esc === 'function') return DamanApp.esc(str);
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    isVerifiedOrAdmin() {
      const app = window.DamanApp;
      if (!app || !app.user) return false;
      if (typeof app.isAdmin === 'function' && app.isAdmin()) return true;
      if (typeof app.hasAdminAccess === 'function' && app.hasAdminAccess()) return true;
      return typeof app.isKycVerified === 'function' ? app.isKycVerified() : app.profile?.kycStatus === 'verified';
    },

    isAdminOrSupportChat(chatId) {
      const cid = String(chatId || '').toLowerCase();
      if (!cid) return false;
      if (cid.includes('admin') || cid.includes('support')) return true;
      const chats = window.DamanChat?.chats;
      if (Array.isArray(chats)) {
        const c = chats.find((x) => x.id === chatId);
        if (c) {
          if (c.isAdminChat || c.isSupport) return true;
          const names = Object.values(c.participantNames || {}).join(' ');
          if (names.includes('إدارة') || names.toLowerCase().includes('admin')) return true;
          if (Array.isArray(c.participants) && c.participants.includes('admin')) return true;
        }
      }
      const mainTxt = (document.getElementById('app-main')?.textContent || '');
      if (mainTxt.includes('إدارة ضمان سايت') && window.DamanChat?.activeChatId === chatId) return true;
      return false;
    },

    notifyOnce(msg, type = 'warning') {
      const app = window.DamanApp;
      if (!app || typeof app.toast !== 'function') return;
      const now = Date.now();
      if (this._lastToastAction === msg && now - this._lastToastAt < 1800) return;
      this._lastToastAction = msg;
      this._lastToastAt = now;
      app.toast(msg, type);
    },

    requireVerifiedForAction(actionLabel) {
      const app = window.DamanApp;
      if (!app) return false;

      if (!app.user || !app.profile) {
        this.notifyOnce(`سجّل الدخول أولاً لإتمام ${actionLabel}`, 'warning');
        setTimeout(() => app.openAuthModal?.('login'), 20);
        return false;
      }

      if (this.isVerifiedOrAdmin()) return true;

      if (app.profile?.kycStatus === 'pending') {
        this.notifyOnce(`⏳ مستندات التوثيق قيد المراجعة — سيتاح لك ${actionLabel} فور الاعتماد`, 'info');
        return false;
      }

      this.notifyOnce(`🪪 وثّق حسابك (بطاقة أو جواز سفر) لـ${actionLabel}`, 'warning');
      const modalEl = document.getElementById('daman-kyc-modal');
      if (!modalEl || modalEl.classList.contains('hidden')) {
        setTimeout(() => this.openKycModal(), 30);
      }
      return false;
    },

    // ==================== 1. BROWSE-ONLY GATE (VIEW EVERYTHING & SUPPORT, LOCK ACTIONS & PHONES) ====================
    maskVisiblePhonesForUnverified() {
      const app = window.DamanApp;
      if (!app || this.isVerifiedOrAdmin()) return;
      if (app.activeTab === 'profile' && (!app.viewingPublicUid || app.viewingPublicUid === app.user?.uid)) return;
      if (app.activeTab === 'wallet' || app.activeTab === 'admin') return;

      const main = document.getElementById('app-main');
      if (!main) return;
      const myPhone = String(app.profile?.phone || '').replace(/\D/g, '');
      const officialWa = String(app.appConfig?.supportWhatsapp || app.appConfig?.whatsappNumber || '').replace(/\D/g, '');

      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
          if (p.closest('.daman-modal') || p.closest('#daman-kyc-browse-banner')) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue || !/(?:\+?2)?01[0125]\d{8}/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const toMask = [];
      let n = walker.nextNode();
      while (n) { toMask.push(n); n = walker.nextNode(); }

      toMask.forEach((txtNode) => {
        const val = txtNode.nodeValue || '';
        const replaced = val.replace(/(?:\+?2)?(01[0125]\d{8})/g, (full, num) => {
          const digits = num.replace(/\D/g, '');
          if ((myPhone && digits === myPhone) || (officialWa && officialWa.endsWith(digits))) return full;
          return `${num.slice(0, 3)}•••••••• (وثّق لإظهار الرقم)`;
        });
        if (replaced !== val) txtNode.nodeValue = replaced;
      });
    },

    injectSoftBrowseBanner() {
      const app = window.DamanApp;
      if (!app || !app.user || this.isVerifiedOrAdmin()) {
        const existing = document.getElementById('daman-kyc-browse-banner');
        if (existing) existing.remove();
        return;
      }
      const main = document.getElementById('app-main');
      if (!main || !['home', 'projects'].includes(app.activeTab)) return;
      if (document.getElementById('daman-kyc-browse-banner')) return;

      const isPending = app.profile?.kycStatus === 'pending';
      const bar = document.createElement('div');
      bar.id = 'daman-kyc-browse-banner';
      bar.className = `mb-3 p-2.5 rounded-2xl border flex items-center justify-between gap-2 text-[10.5px] ${
        isPending ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' : 'bg-sky-500/15 border-sky-500/40 text-sky-100'
      }`;
      bar.innerHTML = isPending
        ? `<span class="font-bold">⏳ مستندات التوثيق قيد المراجعة — يمكنك التصفّح والتواصل مع الدعم بحرية لحين الاعتماد.</span>`
        : `<span class="font-bold">👀 تتصفّح التطبيق بحرية — وثّق بالبطاقة أو جواز السفر عند الإيداع أو السحب أو النشر أو الشراء أو التواصل.</span>
           <button type="button" onclick="DamanKycGate.openKycModal()" class="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] shrink-0">وثّق الآن</button>`;

      const root = main.firstElementChild || main;
      root.insertBefore(bar, root.firstElementChild);
    },

    patchModuleActionGates() {
      const app = window.DamanApp;
      if (!app) return;

      // 1) Wallet Deposit / Withdraw / Buy Package / KYC modal override
      if (window.DamanWallet && !DamanWallet._kycOcrOverriddenV61) {
        DamanWallet._kycOcrOverriddenV61 = true;

        if (typeof DamanWallet.openDepositModal === 'function') {
          const origDep = DamanWallet.openDepositModal.bind(DamanWallet);
          DamanWallet.openDepositModal = (...args) => {
            if (!this.requireVerifiedForAction('الإيداع في المحفظة')) return;
            return origDep(...args);
          };
        }

        if (typeof DamanWallet.openWithdrawModal === 'function') {
          const origWd = DamanWallet.openWithdrawModal.bind(DamanWallet);
          DamanWallet.openWithdrawModal = (...args) => {
            if (!this.requireVerifiedForAction('السحب من المحفظة')) return;
            return origWd(...args);
          };
        }

        if (typeof DamanWallet.buyPackage === 'function') {
          const origBuyPkg = DamanWallet.buyPackage.bind(DamanWallet);
          DamanWallet.buyPackage = (...args) => {
            if (!this.requireVerifiedForAction('شراء الباقات')) return;
            return origBuyPkg(...args);
          };
        }

        DamanWallet.openKycModal = (forced = false) => {
          if (forced && !this.isVerifiedOrAdmin()) {
            return this.requireVerifiedForAction('إتمام العملية');
          }
          this.openKycModal();
        };
      }

      // 2) Chat direct open, messages & calls gate (Admin & Support & AI ALWAYS allowed!)
      if (window.DamanChat && !DamanChat._kycGatePatchedV61) {
        DamanChat._kycGatePatchedV61 = true;

        if (typeof DamanChat.openDirectChat === 'function') {
          const origOpenChat = DamanChat.openDirectChat.bind(DamanChat);
          DamanChat.openDirectChat = (targetUid, targetName, ...rest) => {
            const uidLow = String(targetUid || '').toLowerCase();
            const nameStr = String(targetName || '');
            const isAdminTarget = uidLow === 'admin' || uidLow === 'support' || nameStr.includes('إدارة');
            if (!isAdminTarget && !this.requireVerifiedForAction('المراسلة والتواصل مع الأعضاء')) return;
            return origOpenChat(targetUid, targetName, ...rest);
          };
        }

        if (typeof DamanChat.startCall === 'function') {
          const origCall = DamanChat.startCall.bind(DamanChat);
          DamanChat.startCall = (...args) => {
            if (!this.requireVerifiedForAction('إجراء المكالمات')) return;
            return origCall(...args);
          };
        }

        if (typeof DamanChat.sendMessage === 'function') {
          const origSend = DamanChat.sendMessage.bind(DamanChat);
          DamanChat.sendMessage = (...args) => {
            if (!this.isAdminOrSupportChat(DamanChat.activeChatId) && !this.requireVerifiedForAction('إرسال الرسائل للأعضاء')) return;
            return origSend(...args);
          };
        }
      }

      // 3) External contact / phone reveal gate on ads & profiles
      if (window.DamanPostContact && typeof DamanPostContact.requestExternalContact === 'function' && !DamanPostContact._kycGatePatchedV61) {
        DamanPostContact._kycGatePatchedV61 = true;
        const origExt = DamanPostContact.requestExternalContact.bind(DamanPostContact);
        DamanPostContact.requestExternalContact = (...args) => {
          if (!this.requireVerifiedForAction('إظهار رقم المعلن والتواصل معه')) return;
          return origExt(...args);
        };
      }

      // 4) Projects / Market actions gate (Post, Boost/Purchase, 3x Inspection, VIP Labor)
      if (window.DamanProjects && !DamanProjects._kycGatePatchedV61) {
        DamanProjects._kycGatePatchedV61 = true;

        if (typeof DamanProjects.openPostModal === 'function') {
          const origPost = DamanProjects.openPostModal.bind(DamanProjects);
          DamanProjects.openPostModal = (...args) => {
            if (!this.requireVerifiedForAction('نشر إعلان في السوق')) return;
            return origPost(...args);
          };
        }

        if (typeof DamanProjects.openBoostModal === 'function') {
          const origBoostModal = DamanProjects.openBoostModal.bind(DamanProjects);
          DamanProjects.openBoostModal = (...args) => {
            if (!this.requireVerifiedForAction('شراء وتمييز الإعلان')) return;
            return origBoostModal(...args);
          };
        }

        if (typeof DamanProjects.applyBoostPackage === 'function') {
          const origApplyBoost = DamanProjects.applyBoostPackage.bind(DamanProjects);
          DamanProjects.applyBoostPackage = (...args) => {
            if (!this.requireVerifiedForAction('شراء باقة التمييز')) return;
            return origApplyBoost(...args);
          };
        }

        if (typeof DamanProjects.submitInspectionRequest === 'function') {
          const origInsp = DamanProjects.submitInspectionRequest.bind(DamanProjects);
          DamanProjects.submitInspectionRequest = (e) => {
            if (!this.isVerifiedOrAdmin()) {
              e?.preventDefault?.();
              return this.requireVerifiedForAction('طلب استلام هندسي 3x');
            }
            return origInsp(e);
          };
        }

        if (typeof DamanProjects.submitVipLaborRequest === 'function') {
          const origVip = DamanProjects.submitVipLaborRequest.bind(DamanProjects);
          DamanProjects.submitVipLaborRequest = (e) => {
            if (!this.isVerifiedOrAdmin()) {
              e?.preventDefault?.();
              return this.requireVerifiedForAction('طلب عمالة VIP');
            }
            return origVip(e);
          };
        }
      }
    },

    attachClickAndLinkGate() {
      if (this._gateListenersBound) return;
      this._gateListenersBound = true;

      document.addEventListener('click', (ev) => {
        const app = window.DamanApp;
        if (!app) return;

        const target = ev.target;
        if (!target || typeof target.closest !== 'function') return;

        // Manual click on any "توثيق الحساب" button always opens our upgraded modal
        const kycBtn = target.closest('button[onclick*="openKycModal"], button[onclick*="openKycSafe"]');
        if (kycBtn && !kycBtn.closest('#daman-kyc-modal')) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          this.openKycModal();
          return;
        }

        if (this.isVerifiedOrAdmin()) return;
        if (target.closest('#daman-kyc-modal') || target.closest('#daman-ai-support-modal')) return;

        // Intercept action buttons (deposit / withdraw / buy / boost / post / chat) safely without loop
        const actionBtn = target.closest('button');
        if (actionBtn) {
          const oc = (actionBtn.getAttribute('onclick') || '').toLowerCase();
          const bTxt = (actionBtn.textContent || '').replace(/\s+/g, ' ').trim();
          if (oc.includes('opendepositmodal')) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            this.requireVerifiedForAction('الإيداع في المحفظة');
            return;
          }
          if (oc.includes('openwithdrawmodal')) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            this.requireVerifiedForAction('السحب من المحفظة');
            return;
          }
          if (oc.includes('buypackage') || oc.includes('openboostmodal') || oc.includes('applyboostpackage') || bTxt.includes('اشتراك / تجديد') || bTxt.includes('شراء')) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            this.requireVerifiedForAction('الشراء والاشتراك');
            return;
          }
          if (oc.includes('openpostmodal') || bTxt.includes('نشر إعلان') || bTxt.includes('+ نشر')) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            this.requireVerifiedForAction('نشر إعلان في السوق');
            return;
          }
        }

        // Block tel: and non-platform wa.me links inside ads/profiles (allow official support WhatsApp!)
        const link = target.closest('a[href]');
        if (link) {
          const href = (link.getAttribute('href') || '').toLowerCase();
          const officialWa = String(app.appConfig?.supportWhatsapp || '201030374787').replace(/\D/g, '');
          const isPlatformSupportWa = officialWa && href.includes(officialWa);
          if ((href.startsWith('tel:') || href.includes('wa.me') || href.includes('whatsapp.com')) && !isPlatformSupportWa) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            this.requireVerifiedForAction('إظهار الرقم والتواصل الخارجي');
            return;
          }
        }

        const elTxt = (target.textContent || '');
        if (elTxt.includes('(وثّق لإظهار الرقم)')) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          this.requireVerifiedForAction('إظهار رقم الهاتف');
        }
      }, true);
    },

    // ==================== 2. CLIENT-SIDE OCR ENGINE (TESSERACT.JS + MRZ + EGYPTIAN ID) ====================
    loadTesseract() {
      if (window.Tesseract) return Promise.resolve(window.Tesseract);
      if (this._tesseractPromise) return this._tesseractPromise;
      this._tesseractPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = TESSERACT_CDN;
        s.async = true;
        s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract unavailable')));
        s.onerror = () => reject(new Error('تعذر تحميل محرك القراءة التلقائية'));
        document.head.appendChild(s);
      });
      return this._tesseractPromise;
    },

    normalizeDigits(s) {
      return String(s || '')
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    },

    preprocessImageForOcr(dataUrl) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onerror = () => resolve(dataUrl);
        img.onload = () => {
          try {
            const maxW = 1400;
            const scale = Math.min(1.4, maxW / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = imgData.data;
            const contrast = 1.25;
            const intercept = 128 * (1 - contrast);
            for (let i = 0; i < d.length; i += 4) {
              const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              const v = Math.max(0, Math.min(255, g * contrast + intercept));
              d[i] = d[i + 1] = d[i + 2] = v;
            }
            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
          } catch (e) {
            resolve(dataUrl);
          }
        };
        img.src = dataUrl;
      });
    },

    parseMrzDate(yymmdd, isExpiry = false) {
      if (!/^\d{6}$/.test(yymmdd)) return '';
      const yy = parseInt(yymmdd.slice(0, 2), 10);
      const mm = yymmdd.slice(2, 4);
      const dd = yymmdd.slice(4, 6);
      const curYY = new Date().getFullYear() % 100;
      const year = isExpiry ? 2000 + yy : (yy > curYY ? 1900 + yy : 2000 + yy);
      if (parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12 || parseInt(dd, 10) < 1 || parseInt(dd, 10) > 31) return '';
      return `${year}-${mm}-${dd}`;
    },

    parsePassportOcr(rawText) {
      const out = { legalName: '', docNumber: '', birthDate: '', expiryDate: '', legalAddress: '' };
      const cleanLines = String(rawText || '')
        .split('\n')
        .map((l) => l.trim().replace(/\s+/g, ''))
        .filter(Boolean);

      const mrzLine1 = cleanLines.find((l) => /^P[<A-Z][A-Z<]{2}[A-Z<]{10,}/.test(l.toUpperCase()));
      const mrzLine2 = cleanLines.find((l) => /^[A-Z0-9<]{9}\d[A-Z<]{3}\d{6}\d[MF<]\d{6}/.test(l.toUpperCase()));

      if (mrzLine1) {
        const up = mrzLine1.toUpperCase();
        const body = up.slice(5);
        const parts = body.split('<<');
        const surname = (parts[0] || '').replace(/</g, ' ').replace(/[^A-Z\s]/g, '').trim();
        const given = (parts[1] || '').replace(/</g, ' ').replace(/[^A-Z\s]/g, '').trim();
        const combined = `${given} ${surname}`.replace(/\s+/g, ' ').trim();
        if (combined.length >= 4) out.legalName = combined;
      }

      if (mrzLine2) {
        const up = mrzLine2.toUpperCase();
        const pNum = up.slice(0, 9).replace(/</g, '').trim();
        if (pNum.length >= 6) out.docNumber = pNum;
        const dob = this.parseMrzDate(up.slice(13, 19), false);
        const exp = this.parseMrzDate(up.slice(21, 27), true);
        if (dob) out.birthDate = dob;
        if (exp) out.expiryDate = exp;
      }

      if (!out.docNumber) {
        const norm = this.normalizeDigits(rawText).toUpperCase();
        const m = norm.match(/\b([A-Z]\d{7,8})\b/) || norm.match(/\b([A-Z]{1,2}\d{6,8})\b/);
        if (m) out.docNumber = m[1];
      }

      return out;
    },

    parseEgyptianIdOcr(rawText) {
      const out = { legalName: '', docNumber: '', birthDate: '', expiryDate: '', legalAddress: '' };
      const norm = this.normalizeDigits(rawText);

      const spacedMatch = norm.match(/[23](?:[\s\-]*\d){13}/);
      if (spacedMatch) {
        const digits = spacedMatch[0].replace(/\D/g, '');
        if (digits.length === 14) {
          out.docNumber = digits;
          const parsed = window.DamanApp?.parseEgyptianNationalId?.(digits);
          if (parsed && parsed.valid && parsed.birthDate) {
            out.birthDate = parsed.birthDate;
          }
        }
      }

      const ignoreWords = ['جمهوريه', 'جمهورية', 'مصر', 'العربيه', 'العربية', 'بطاقه', 'بطاقة', 'تحقيق', 'الشخصيه', 'الشخصية', 'وزاره', 'وزارة', 'الداخليه', 'الداخلية', 'الاحوال', 'المدنيه'];
      const arLines = String(rawText || '')
        .split('\n')
        .map((l) => l.replace(/[^\u0600-\u06FF0-9\s\-/]/g, ' ').replace(/\s+/g, ' ').trim())
        .filter((l) => {
          const arOnly = (l.match(/[\u0600-\u06FF]/g) || []).length;
          if (arOnly < 4) return false;
          const low = l.toLowerCase();
          return !ignoreWords.some((w) => low.includes(w));
        });

      const pureNameLines = arLines.filter((l) => !/\d/.test(l) && l.length <= 42);
      if (pureNameLines.length >= 2) {
        out.legalName = `${pureNameLines[0]} ${pureNameLines[1]}`.replace(/\s+/g, ' ').trim();
      } else if (pureNameLines.length === 1) {
        out.legalName = pureNameLines[0];
      }

      const remaining = arLines.filter((l) => !out.legalName.includes(l));
      if (remaining.length) {
        out.legalAddress = remaining.slice(0, 2).join(' - ').slice(0, 120);
      }

      return out;
    },

    async runOcrOnDocument(dataUrl) {
      const statusBox = document.getElementById('kyc-ocr-status');
      this._ocrState.status = 'running';

      if (statusBox) {
        statusBox.className = 'p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/50 text-sky-200 text-[10.5px] font-bold flex items-center gap-2';
        statusBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-sky-300"></i><span>🤖 جارٍ قراءة بيانات ${this._docType === 'passport' ? 'جواز السفر' : 'البطاقة الشخصية'} تلقائياً وتعبئة الخانات...</span>`;
      }

      try {
        const Tesseract = await this.loadTesseract();
        const preImg = await this.preprocessImageForOcr(dataUrl);
        const lang = this._docType === 'passport' ? 'eng' : 'ara+eng';
        const res = await Tesseract.recognize(preImg, lang);
        const rawText = (res && res.data && res.data.text) ? res.data.text : '';
        const extracted = this._docType === 'passport'
          ? this.parsePassportOcr(rawText)
          : this.parseEgyptianIdOcr(rawText);

        this._ocrState = {
          status: 'done',
          rawText: rawText.slice(0, 1200),
          extracted
        };

        const fillField = (id, val) => {
          const el = document.getElementById(id);
          if (el && val) {
            el.value = val;
            el.dataset.ocrInitial = val;
          }
        };

        fillField('kyc-f-name', extracted.legalName);
        fillField('kyc-f-docnum', extracted.docNumber);
        fillField('kyc-f-bday', extracted.birthDate);
        fillField('kyc-f-exp', extracted.expiryDate);
        fillField('kyc-f-addr', extracted.legalAddress);

        this.refreshFieldEditBadges();

        const foundCount = [extracted.legalName, extracted.docNumber, extracted.birthDate, extracted.legalAddress].filter(Boolean).length;
        if (statusBox) {
          if (foundCount > 0) {
            statusBox.className = 'p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-200 text-[10.5px] font-bold leading-relaxed';
            statusBox.innerHTML = `✅ <b>تمت القراءة التلقائية (${foundCount} حقول):</b> راجع البيانات المكتوبة وعدّل أي حرف غير دقيق (سيصل للإدارة تقرير بأي تعديل يدوي).`;
          } else {
            statusBox.className = 'p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-200 text-[10.5px] font-bold leading-relaxed';
            statusBox.innerHTML = `⚠️ لم تتضح النصوص آلياً بسبب الإضاءة — يمكنك كتابة بياناتك يدوياً بدقة ومطابقتها مع الصورة.`;
          }
        }
      } catch (err) {
        this._ocrState.status = 'failed';
        if (statusBox) {
          statusBox.className = 'p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-200 text-[10.5px] font-bold';
          statusBox.innerHTML = `ℹ️ تعذرت القراءة الآلية حالياً — أدخل البيانات يدوياً كما في المستند.`;
        }
      }
    },

    normalizeCompare(v) {
      return this.normalizeDigits(String(v || ''))
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
    },

    onFormInput() {
      if (this._docType === 'national_id') {
        const docInp = document.getElementById('kyc-f-docnum');
        const bdayInp = document.getElementById('kyc-f-bday');
        if (docInp && bdayInp && !bdayInp.value) {
          const digits = this.normalizeDigits(docInp.value).replace(/\D/g, '');
          if (digits.length === 14) {
            const parsed = window.DamanApp?.parseEgyptianNationalId?.(digits);
            if (parsed && parsed.valid && parsed.birthDate) {
              bdayInp.value = parsed.birthDate;
            }
          }
        }
      }
      this.refreshFieldEditBadges();
    },

    computeOcrDiffs() {
      const ex = this._ocrState.extracted || {};
      const map = [
        ['legalName', 'الاسم الكامل', document.getElementById('kyc-f-name')?.value || '', ex.legalName || ''],
        ['docNumber', this._docType === 'passport' ? 'رقم جواز السفر' : 'الرقم القومي', document.getElementById('kyc-f-docnum')?.value || '', ex.docNumber || ''],
        ['birthDate', 'تاريخ الميلاد', document.getElementById('kyc-f-bday')?.value || '', ex.birthDate || ''],
        ['legalAddress', 'العنوان', document.getElementById('kyc-f-addr')?.value || '', ex.legalAddress || '']
      ];
      if (this._docType === 'passport') {
        map.push(['expiryDate', 'تاريخ الانتهاء', document.getElementById('kyc-f-exp')?.value || '', ex.expiryDate || '']);
      }

      const diffs = [];
      map.forEach(([field, label, userVal, ocrVal]) => {
        const uNorm = this.normalizeCompare(userVal);
        const oNorm = this.normalizeCompare(ocrVal);
        if (oNorm && uNorm !== oNorm) {
          diffs.push({ field, label, ocrValue: String(ocrVal).trim(), userValue: String(userVal).trim() });
        }
      });
      return diffs;
    },

    refreshFieldEditBadges() {
      const diffs = this.computeOcrDiffs();
      const diffSet = new Set(diffs.map((d) => d.field));
      const ids = [
        ['legalName', 'kyc-ed-tag-name'],
        ['docNumber', 'kyc-ed-tag-docnum'],
        ['birthDate', 'kyc-ed-tag-bday'],
        ['expiryDate', 'kyc-ed-tag-exp'],
        ['legalAddress', 'kyc-ed-tag-addr']
      ];
      ids.forEach(([field, tagId]) => {
        const el = document.getElementById(tagId);
        if (el) el.classList.toggle('hidden', !diffSet.has(field));
      });
    },

    // ==================== 3. UPGRADED KYC MODAL (NATIONAL ID OR PASSPORT + OCR + ANTI-DUPLICATE) ====================
    switchDocType(type) {
      this._docType = type === 'passport' ? 'passport' : 'national_id';
      this._photos.front = '';
      this._photos.back = '';
      this._ocrState = {
        status: 'idle',
        rawText: '',
        extracted: { legalName: '', docNumber: '', birthDate: '', expiryDate: '', legalAddress: '' }
      };
      this.renderKycModalContent();
    },

    async handleDocPhoto(slot, input) {
      const f = input.files && input.files[0];
      if (!f) return;
      const app = window.DamanApp;
      try {
        const prev = document.getElementById('kyc-prev-' + slot);
        if (prev) prev.innerHTML = `<span class="text-amber-300 text-[10px]">جارٍ تجهيز الصورة...</span>`;
        const b64 = await app.compressImage(f, 1100, 0.72);
        this._photos[slot] = b64;
        if (prev) prev.innerHTML = `<img src="${b64}" class="max-h-24 mx-auto rounded-lg mt-1 border border-emerald-500/50" />`;

        if (slot === 'front') {
          this.runOcrOnDocument(b64);
        }
      } catch (err) {
        app?.toast('تعذر قراءة الصورة: ' + err.message, 'error');
      }
    },

    openKycModal() {
      const app = window.DamanApp;
      if (!app || !app.user || !app.profile) return app?.openAuthModal?.('login');

      this._docType = app.profile.kycDocType === 'passport' ? 'passport' : 'national_id';
      this._photos = { front: '', back: '', selfie: '', cr: '', tax: '' };
      this._ocrState = {
        status: 'idle',
        rawText: '',
        extracted: { legalName: '', docNumber: '', birthDate: '', expiryDate: '', legalAddress: '' }
      };

      let m = document.getElementById('daman-kyc-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-kyc-modal';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'kycModal' }, ''); } catch (e) {}
      this.renderKycModalContent();
    },

    renderKycModalContent() {
      const app = window.DamanApp;
      const m = document.getElementById('daman-kyc-modal');
      if (!m || !app) return;

      const p = app.profile || {};
      const isPass = this._docType === 'passport';
      const isComp = p.accountType === 'company' || p.accountType === 'supplier';
      const rejReason = p.kycStatus === 'rejected' && p.kycRejectionReason ? p.kycRejectionReason : '';

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-id-card me-1"></i> توثيق الحساب (بطاقة أو جواز سفر)</h3>
              <div class="text-[10px] text-slate-400">التصفح والدعم متاح بحرية — التوثيق مطلوب فقط للتعاملات المالية والتواصل</div>
            </div>
            <button type="button" onclick="document.getElementById('daman-kyc-modal').classList.add('hidden')" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 shrink-0"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${rejReason ? `<div class="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/50 text-rose-200 text-[11px]"><b>سبب الرفض السابق:</b> ${this.esc(rejReason)}</div>` : ''}

          <div class="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button type="button" onclick="DamanKycGate.switchDocType('national_id')" class="py-2 rounded-xl font-black text-[11px] transition ${!isPass ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}">🪪 بطاقة شخصية</button>
            <button type="button" onclick="DamanKycGate.switchDocType('passport')" class="py-2 rounded-xl font-black text-[11px] transition ${isPass ? 'bg-sky-500 text-slate-950' : 'text-slate-300'}">🛂 جواز سفر</button>
          </div>

          <form onsubmit="DamanKycGate.submitKyc(event)" oninput="DamanKycGate.onFormInput()" class="space-y-2.5">
            <div class="space-y-2">
              <div class="text-[10.5px] font-black text-amber-300">1. صوّر المستند (سيتم قراءة البيانات وتعبئتها تلقائياً 🤖):</div>
              <div class="grid ${isPass ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5">
                <label class="p-2.5 rounded-xl border border-dashed border-amber-500/60 bg-slate-950 text-center cursor-pointer block">
                  <div class="font-black text-amber-300 text-[10.5px]">${isPass ? '🛂 صفحة الجواز *' : '🪪 وش البطاقة *'}</div>
                  <div class="text-[9px] text-slate-400 mt-0.5">قراءة آلية OCR</div>
                  <input type="file" accept="image/*" capture="environment" data-allow-native-capture="1" class="hidden" onchange="DamanKycGate.handleDocPhoto('front', this)" />
                  <div id="kyc-prev-front">${this._photos.front ? `<img src="${this._photos.front}" class="max-h-20 mx-auto rounded mt-1" />` : ''}</div>
                </label>

                ${!isPass ? `
                  <label class="p-2.5 rounded-xl border border-dashed border-amber-500/60 bg-slate-950 text-center cursor-pointer block">
                    <div class="font-black text-amber-300 text-[10.5px]">🪪 ضهر البطاقة *</div>
                    <div class="text-[9px] text-slate-400 mt-0.5">صورة واضحة</div>
                    <input type="file" accept="image/*" capture="environment" data-allow-native-capture="1" class="hidden" onchange="DamanKycGate.handleDocPhoto('back', this)" />
                    <div id="kyc-prev-back">${this._photos.back ? `<img src="${this._photos.back}" class="max-h-20 mx-auto rounded mt-1" />` : ''}</div>
                  </label>` : ''}

                <label class="p-2.5 rounded-xl border border-dashed border-emerald-500/60 bg-slate-950 text-center cursor-pointer block">
                  <div class="font-black text-emerald-300 text-[10.5px]">🤳 سيلفي مباشر *</div>
                  <div class="text-[9px] text-slate-400 mt-0.5">مع المستند</div>
                  <input type="file" accept="image/*" capture="user" data-allow-native-capture="1" class="hidden" onchange="DamanKycGate.handleDocPhoto('selfie', this)" />
                  <div id="kyc-prev-selfie">${this._photos.selfie ? `<img src="${this._photos.selfie}" class="max-h-20 mx-auto rounded mt-1" />` : ''}</div>
                </label>
              </div>
            </div>

            <div id="kyc-ocr-status" class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
              🤖 بمجرد تصوير ${isPass ? 'صفحة بيانات جواز السفر' : 'وش البطاقة الشخصية'} ستتعبأ الخانات تلقائياً ويمكنك مراجعتها وتعديلها.
            </div>

            <div class="space-y-2 p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div class="text-[10.5px] font-black text-emerald-300">2. البيانات القانونية (للتحويلات والعقود):</div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] font-bold text-slate-300">الاسم الكامل كما في ${isPass ? 'جواز السفر' : 'البطاقة (رباعي/خماسي)'} *</label>
                  <span id="kyc-ed-tag-name" class="hidden px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">✏️ معدّل يدوياً</span>
                </div>
                <input id="kyc-f-name" type="text" required value="${this.esc(p.legalName || '')}" placeholder="${isPass ? 'الاسم الكامل كما في الجواز' : 'الاسم الرباعي كما في البطاقة'}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold" />
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[10px] font-bold text-amber-300">${isPass ? 'رقم جواز السفر *' : 'الرقم القومي (14 رقم) *'}</label>
                    <span id="kyc-ed-tag-docnum" class="hidden px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">✏️ معدّل</span>
                  </div>
                  <input id="kyc-f-docnum" type="text" required dir="ltr" maxlength="${isPass ? 16 : 14}" value="${this.esc(p.nationalId || '')}" placeholder="${isPass ? 'A12345678' : '29801010101234'}" class="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 font-black" />
                </div>

                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[10px] font-bold text-slate-300">تاريخ الميلاد ${isPass ? '*' : ''}</label>
                    <span id="kyc-ed-tag-bday" class="hidden px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">✏️ معدّل</span>
                  </div>
                  <input id="kyc-f-bday" type="date" ${isPass ? 'required' : ''} value="${this.esc(p.birthDate || '')}" class="w-full px-2 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
                </div>
              </div>

              ${isPass ? `
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[10px] font-bold text-slate-300">تاريخ انتهاء الجواز (اختياري)</label>
                    <span id="kyc-ed-tag-exp" class="hidden px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">✏️ معدّل</span>
                  </div>
                  <input id="kyc-f-exp" type="date" class="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
                </div>` : ''}

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] font-bold text-slate-300">العنوان بالتفصيل *</label>
                  <span id="kyc-ed-tag-addr" class="hidden px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">✏️ معدّل يدوياً</span>
                </div>
                <input id="kyc-f-addr" type="text" required value="${this.esc(p.legalAddress || p.city || '')}" placeholder="المحافظة — المدينة — العنوان" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" />
              </div>

              ${isComp ? `
                <div class="pt-2 border-t border-slate-800 space-y-2">
                  <div class="text-[10px] font-black text-sky-300">📄 مستندات الشركة / المورّد (اختياري):</div>
                  <input id="kyc-f-comp" type="text" value="${this.esc(p.companyName || '')}" placeholder="اسم الشركة القانوني" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                  <div class="grid grid-cols-2 gap-1.5">
                    <input id="kyc-f-cr" type="text" value="${this.esc(p.commercialReg || '')}" placeholder="رقم السجل التجاري" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                    <input id="kyc-f-tax" type="text" value="${this.esc(p.taxCard || '')}" placeholder="رقم البطاقة الضريبية" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white" />
                  </div>
                  <div class="grid grid-cols-2 gap-1.5">
                    <label class="p-2 rounded-xl border border-dashed border-sky-500/50 bg-slate-900 text-center cursor-pointer text-[10px] text-sky-300 font-bold">📄 صورة السجل<input type="file" accept="image/*" data-allow-native-capture="1" class="hidden" onchange="DamanKycGate.handleDocPhoto('cr', this)" /><div id="kyc-prev-cr"></div></label>
                    <label class="p-2 rounded-xl border border-dashed border-sky-500/50 bg-slate-900 text-center cursor-pointer text-[10px] text-sky-300 font-bold">📄 صورة الضريبية<input type="file" accept="image/*" data-allow-native-capture="1" class="hidden" onchange="DamanKycGate.handleDocPhoto('tax', this)" /><div id="kyc-prev-tax"></div></label>
                  </div>
                </div>` : ''}
            </div>

            <div class="flex gap-2">
              <button id="kyc-submit-v58-btn" type="submit" class="flex-1 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs">
                <i class="fa-solid fa-paper-plane me-1"></i> إرسال للتوثيق والمراجعة
              </button>
              <button type="button" onclick="document.getElementById('daman-kyc-modal').classList.add('hidden')" class="px-3.5 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-[11px]">
                لاحقاً
              </button>
            </div>
          </form>
        </div>`;
    },

    async submitKyc(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app || !app.user) return;

      const isPass = this._docType === 'passport';
      const legalName = (document.getElementById('kyc-f-name')?.value || '').trim().replace(/\s+/g, ' ');
      const rawDocNum = this.normalizeDigits(document.getElementById('kyc-f-docnum')?.value || '').trim().toUpperCase();
      let birthDate = (document.getElementById('kyc-f-bday')?.value || '').trim();
      const expiryDate = (document.getElementById('kyc-f-exp')?.value || '').trim();
      const legalAddress = (document.getElementById('kyc-f-addr')?.value || '').trim();
      const commercialReg = (document.getElementById('kyc-f-cr')?.value || app.profile?.commercialReg || '').trim();

      if (legalName.split(/\s+/).length < (isPass ? 2 : 3)) {
        return app.toast(isPass ? 'يرجى كتابة الاسم الكامل كما في جواز السفر' : 'يرجى كتابة الاسم الرباعي بالكامل كما في البطاقة', 'warning');
      }
      if (!this._photos.front) {
        return app.toast(isPass ? 'يرجى تصوير صفحة بيانات جواز السفر' : 'يرجى تصوير وش البطاقة الشخصية', 'warning');
      }
      if (!isPass && !this._photos.back) {
        return app.toast('يرجى تصوير ضهر البطاقة الشخصية', 'warning');
      }
      if (!this._photos.selfie) {
        return app.toast('يرجى تصوير صورة سيلفي واضحة مع المستند', 'warning');
      }

      let cleanDocNum = rawDocNum;
      if (!isPass) {
        const parsed = app.parseEgyptianNationalId(rawDocNum);
        if (!parsed.valid) return app.toast(parsed.error || 'الرقم القومي غير صحيح (14 رقم)', 'error');
        cleanDocNum = parsed.nid;
        if (!birthDate && parsed.birthDate) birthDate = parsed.birthDate;
      } else {
        cleanDocNum = rawDocNum.replace(/[^A-Z0-9]/g, '');
        if (cleanDocNum.length < 6 || cleanDocNum.length > 15) {
          return app.toast('رقم جواز السفر يجب أن يكون بين 6 و15 حرف/رقم', 'error');
        }
      }

      await app.withLock('submitKycV61', async () => {
        const btn = document.getElementById('kyc-submit-v58-btn');
        const resetBtn = () => {
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> إرسال للتوثيق والمراجعة'; }
        };
        if (btn) { btn.disabled = true; btn.textContent = 'جارٍ التحقق الأمني والرفع...'; }

        try {
          const bl = await app.checkBlacklist({
            email: app.profile?.email,
            phone: app.profile?.phone,
            nationalId: cleanDocNum,
            commercialReg
          });
          if (bl) {
            resetBtn();
            return app.toast(`تعذر التوثيق: ${bl}`, 'error');
          }

          const [dupNidSnap, dupPassSnap, verifiedUsersSnap] = await Promise.all([
            app.db.collection('users').where('nationalId', '==', cleanDocNum).limit(2).get(),
            app.db.collection('users').where('passportNumber', '==', cleanDocNum).limit(2).get(),
            app.db.collection('users').where('kycStatus', '==', 'verified').limit(300).get()
          ]);

          if (dupNidSnap.docs.some((d) => d.id !== app.user.uid) || dupPassSnap.docs.some((d) => d.id !== app.user.uid)) {
            resetBtn();
            return app.toast(
              isPass
                ? '⚠️ رقم جواز السفر هذا مسجّل وموثّق بالفعل لحساب آخر! لا يمكن إنشاء حسابين بنفس الهوية.'
                : '⚠️ هذا الرقم القومي مسجّل وموثّق بالفعل لحساب آخر! لا يمكن إنشاء حسابين ببطاقة واحدة.',
              'error'
            );
          }

          const normSubmittedName = app.normalizeAr(legalName).replace(/\s+/g, ' ').trim();
          const hasDupLegalName = verifiedUsersSnap.docs.some((d) => {
            if (d.id === app.user.uid) return false;
            const existingNorm = app.normalizeAr(d.data()?.legalName || '').replace(/\s+/g, ' ').trim();
            return existingNorm && existingNorm === normSubmittedName;
          });
          if (hasDupLegalName) {
            resetBtn();
            return app.toast('⚠️ هذا الاسم القانوني الكامل مسجّل وموثّق بالفعل على حساب آخر! تواصل مع الدعم الفني لو كان تشابه أسماء.', 'error');
          }

          const [idFrontMedia, idBackMedia, selfieMedia, crMedia, taxMedia] = await Promise.all([
            app.saveMedia(this._photos.front, { kind: 'kyc_id_front' }),
            this._photos.back ? app.saveMedia(this._photos.back, { kind: 'kyc_id_back' }) : Promise.resolve(''),
            app.saveMedia(this._photos.selfie, { kind: 'kyc_selfie' }),
            this._photos.cr ? app.saveMedia(this._photos.cr, { kind: 'kyc_cr' }) : Promise.resolve(''),
            this._photos.tax ? app.saveMedia(this._photos.tax, { kind: 'kyc_tax' }) : Promise.resolve('')
          ]);

          const ocrDiffs = this.computeOcrDiffs();
          const ocrEdited = ocrDiffs.length > 0;
          const payload = {
            uid: app.user.uid,
            displayName: app.profile?.name || '',
            phone: app.profile?.phone || '',
            accountType: app.profile?.accountType || 'individual',
            docType: this._docType,
            legalName,
            nationalId: cleanDocNum,
            passportNumber: isPass ? cleanDocNum : '',
            birthDate,
            docExpiryDate: expiryDate,
            legalAddress,
            companyName: (document.getElementById('kyc-f-comp')?.value || app.profile?.companyName || '').trim(),
            commercialReg,
            taxCard: (document.getElementById('kyc-f-tax')?.value || app.profile?.taxCard || '').trim(),
            idFrontMedia,
            idBackMedia,
            selfieMedia,
            crMedia,
            taxMedia,
            ocrStatus: this._ocrState.status,
            ocrExtracted: this._ocrState.extracted || {},
            ocrEdited,
            ocrDiffs,
            status: 'pending',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          await app.db.collection('kycRequests').doc(app.user.uid).set(payload, { merge: true });
          await app.db.collection('users').doc(app.user.uid).update({ kycStatus: 'pending', kycDocType: this._docType });

          const docTag = isPass ? '🛂 جواز سفر' : '🪪 بطاقة شخصية';
          const editTag = ocrEdited ? ' ⚠️ (عدّل بيانات القراءة الآلية)' : '';
          await app.sendNotification(
            'ADMIN',
            `طلب توثيق جديد (${docTag})${editTag}`,
            `${legalName} — رقم: ${cleanDocNum} (${app.profile?.phone || ''})`
          ).catch(() => {});

          document.getElementById('daman-kyc-modal')?.classList.add('hidden');
          app.toast('تم إرسال مستندات التوثيق للمراجعة بنجاح ✅ يمكنك استكمال التصفح الآن.', 'success');
          if (app.activeTab) app.renderCurrentTab();
        } catch (err) {
          resetBtn();
          app.toast('تعذر إرسال التوثيق: ' + err.message, 'error');
        }
      });
    },

    // ==================== 4. LOOP-SAFE BOOT ====================
    runPass() {
      if (this._runningPass) return;
      this._runningPass = true;
      try {
        this.patchModuleActionGates();
        this.injectSoftBrowseBanner();
        this.maskVisiblePhonesForUnverified();
      } finally {
        setTimeout(() => { this._runningPass = false; }, 60);
      }
    },

    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.attachClickAndLinkGate();
      this.patchModuleActionGates();

      if (typeof app.renderCurrentTab === 'function' && !app._kycGateTabHookedV61) {
        app._kycGateTabHookedV61 = true;
        const origRender = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRender();
          setTimeout(() => this.runPass(), 120);
        };
      }

      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver((mutations) => {
          if (this._runningPass) return;
          const meaningful = mutations.some((m) => {
            if (m.type === 'childList') {
              return Array.from(m.addedNodes || []).some((n) => n.nodeType === 1 && n.id !== 'daman-toast-container' && n.id !== 'daman-kyc-browse-banner');
            }
            if (m.type === 'attributes' && m.target && m.target.classList && m.target.classList.contains('daman-modal')) {
              return true;
            }
            return false;
          });
          if (!meaningful) return;
          clearTimeout(this._timer);
          this._timer = setTimeout(() => this.runPass(), 220);
        });
        this._obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      setTimeout(() => this.runPass(), 650);
    }
  };

  window.DamanKycGate = KycGateOcr;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => KycGateOcr.boot(), 500));
  else setTimeout(() => KycGateOcr.boot(), 500);
})();
