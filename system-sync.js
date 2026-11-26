(function () {
  const SystemSync = {
    _booted: false,
    _bootTimestamp: Date.now(),
    _lastNotifCount: -1,
    _lastChatCount: -1,
    _soundEnabled: true,

    // ==================== 1. SUBTLE WEB AUDIO CHIME ====================
    playChime(kind = 'notif') {
      if (!this._soundEnabled) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        const freqs = kind === 'chat' ? [660, 880] : [587.33, 880, 1046.5];

        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.085);
          gain.gain.setValueAtTime(0.001, now + idx * 0.085);
          gain.gain.exponentialRampToValueAtTime(0.08, now + idx * 0.085 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.085 + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.085);
          osc.stop(now + idx * 0.085 + 0.2);
        });

        setTimeout(() => { try { ctx.close(); } catch (e) {} }, 700);
      } catch (e) {}
    },

    // ==================== 2. FIX SHARE-QR CLICK HANDLERS & VERIFY MESSAGE ====================
    patchShareQR() {
      const QR = window.DamanShareQR;
      const app = window.DamanApp;
      if (!QR || !app || QR._syncFixedV38) return;
      QR._syncFixedV38 = true;

      QR.enhanceMarketCardsHtml = function (html, a) {
        if (!html || !html.includes('toggleFavorite(')) return html;
        const wrap = document.createElement('div');
        wrap.innerHTML = html;

        Array.from(wrap.children).forEach((card) => {
          if (card.querySelector('.daman-card-qr-btn')) return;
          const favBtn = card.querySelector('button[onclick*="DamanProjects.toggleFavorite"]');
          if (!favBtn) return;
          const m = (favBtn.getAttribute('onclick') || '').match(/toggleFavorite\('([^']+)'\)/);
          if (!m || !m[1]) return;
          const safePid = (a || app).esc(m[1]).replace(/'/g, "\\'");

          const group = document.createElement('div');
          group.className = 'flex items-center gap-2 shrink-0';

          const shBtn = document.createElement('button');
          shBtn.type = 'button';
          shBtn.title = 'مشاركة وQR الإعلان';
          shBtn.className = 'daman-card-qr-btn text-amber-400 hover:text-amber-300 text-xs';
          shBtn.setAttribute('onclick', `event.stopPropagation(); DamanShareQR.sharePost('${safePid}')`);
          shBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>';

          favBtn.parentNode.insertBefore(group, favBtn);
          group.appendChild(shBtn);
          group.appendChild(favBtn);
        });

        return wrap.innerHTML;
      };

      QR.enhanceContractCardHtml = function (html, ag, a) {
        if (!html || !ag || !ag.id) return html;
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        const card = wrap.firstElementChild;
        if (!card || card.querySelector('.daman-ct-qr-btn')) return html;

        const safeAgId = (a || app).esc(ag.id).replace(/'/g, "\\'");
        const topRow = card.firstElementChild;
        if (topRow) {
          const qrBtn = document.createElement('button');
          qrBtn.type = 'button';
          qrBtn.className = 'daman-ct-qr-btn px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[9.5px] font-black shrink-0';
          qrBtn.setAttribute('onclick', `event.stopPropagation(); DamanShareQR.shareContract('${safeAgId}')`);
          qrBtn.innerHTML = '<i class="fa-solid fa-qrcode me-0.5"></i> QR العقد';

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
      };

      const origVerify = QR.openContractVerifyModal.bind(QR);
      QR.openContractVerifyModal = async function (ticketNumber) {
        await origVerify(ticketNumber);
        if (!app.user) return;
        const modal = document.getElementById('daman-verify-ct-modal');
        if (!modal) return;
        const h3 = modal.querySelector('h3');
        if (h3 && h3.textContent.includes('يتطلب تسجيل الدخول')) {
          h3.textContent = `العقد ${String(ticketNumber || '').trim().toUpperCase()} خاص بأطرافه والإدارة فقط 🔒`;
        }
      };
    },

    // ==================== 3. FIX COMPANY PANEL MODALS NOTIFICATIONS & COMPANY ID DETECTION ====================
    patchCompanyEnhancements() {
      const CE = window.DamanCompanyEnh;
      const app = window.DamanApp;
      if (!CE || !app || CE._syncFixedV38) return;
      CE._syncFixedV38 = true;

      document.addEventListener('click', (ev) => {
        if (window.DamanApp?.activeTab === 'company' && ev.target.closest('.daman-modal')) {
          CE.lastActionAt = Date.now();
        }
      }, true);
      document.addEventListener('submit', (ev) => {
        if (window.DamanApp?.activeTab === 'company' && ev.target.closest('.daman-modal')) {
          CE.lastActionAt = Date.now();
        }
      }, true);

      const origResolve = CE.resolveActiveCompanyId.bind(CE);
      CE.resolveActiveCompanyId = function () {
        const direct = origResolve();
        if (direct) return direct;
        const comp = window.DamanCompany;
        if (comp && typeof comp === 'object') {
          if (comp.activeCompany?.id) return comp.activeCompany.id;
          if (comp.myCompany?.id) return comp.myCompany.id;
          if (Array.isArray(comp.companies) && comp.companies[0]?.id) return comp.companies[0].id;
          for (const v of Object.values(comp)) {
            if (v && typeof v === 'object' && !Array.isArray(v) && v.id && typeof v.code === 'string' && v.code.startsWith('CMP-')) {
              return v.id;
            }
          }
        }
        return this._fallbackCompanyId || null;
      };

      const origUpdate = CE.onCompanyScreenUpdated.bind(CE);
      CE.onCompanyScreenUpdated = function () {
        origUpdate();
        document.querySelectorAll('.daman-modal:not(.hidden)').forEach((m) => {
          try { this.injectHelpIcons(m); } catch (e) {}
        });
        if (!this.activeCompanyId && !this._fallbackQueried && app.user && app.db) {
          this._fallbackQueried = true;
          app.db.collection('companyMembers').where('userId', '==', app.user.uid).limit(1).get().then((snap) => {
            if (!snap.empty) {
              const cid = snap.docs[0].data()?.companyId;
              if (cid) {
                this._fallbackCompanyId = cid;
                this.attachCompanyWatchers(cid);
              }
            }
          }).catch(() => {});
        }
      };

      if (typeof MutationObserver !== 'undefined') {
        const bodyObs = new MutationObserver(() => {
          if (window.DamanApp?.activeTab !== 'company') return;
          document.querySelectorAll('.daman-modal:not(.hidden)').forEach((m) => {
            try { CE.injectHelpIcons(m); } catch (e) {}
          });
        });
        bodyObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
    },

    // ==================== 4. FIX ADMIN TABS + USER 360° KYC + WATCH BROKEN IMAGES ====================
    patchAdminIntegration() {
      const Adm = window.DamanAdmin;
      const app = window.DamanApp;
      if (!Adm || !app || Adm._syncPatchedV38) return;
      Adm._syncPatchedV38 = true;

      if (typeof Adm.setSubTab === 'function') {
        const prevSetTab = Adm.setSubTab.bind(Adm);
        Adm.setSubTab = function (t) {
          if (t === 'categories') this._viewingKycVaultTab = false;
          else if (t === 'kyc_vault') this._viewingCategoriesTab = false;
          else { this._viewingCategoriesTab = false; this._viewingKycVaultTab = false; }
          return prevSetTab(t);
        };
      }

      if (window.DamanCatAds && typeof DamanCatAds.openAdminCategoriesTab === 'function') {
        const origOpenCatTab = DamanCatAds.openAdminCategoriesTab.bind(DamanCatAds);
        DamanCatAds.openAdminCategoriesTab = function () {
          if (window.DamanAdmin) DamanAdmin._viewingKycVaultTab = false;
          return origOpenCatTab();
        };
      }

      if (typeof Adm.openUser360Modal === 'function') {
        const orig360 = Adm.openUser360Modal.bind(Adm);
        Adm.openUser360Modal = function (uid) {
          const res = orig360(uid);
          let tries = 0;
          const injectTimer = setInterval(() => {
            tries++;
            if (tries > 25) return clearInterval(injectTimer);
            const modal = document.getElementById('daman-u360-modal');
            if (!modal || modal.classList.contains('hidden')) return;
            const inner = modal.firstElementChild;
            if (!inner || inner.textContent.includes('جارٍ تحميل')) return;
            clearInterval(injectTimer);
            if (inner.querySelector('.daman-u360-kycv-btn') || !window.DamanKycVault) return;

            const safeUid = app.esc(uid).replace(/'/g, "\\'");
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'daman-u360-kycv-btn w-full py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 font-black text-[11px] flex items-center justify-center gap-1.5';
            btn.innerHTML = '<i class="fa-solid fa-id-card"></i><span>🪪 عرض البطاقة والسجل التجاري الموثّق</span>';
            btn.onclick = () => {
              modal.classList.add('hidden');
              DamanKycVault.openDocsModal(safeUid, false);
            };
            const headerRow = inner.firstElementChild;
            if (headerRow && headerRow.nextSibling) inner.insertBefore(btn, headerRow.nextSibling);
            else inner.appendChild(btn);
          }, 150);
          return res;
        };
      }

      if (typeof Adm._renderAdminWatchMsgs === 'function') {
        const origWatchRender = Adm._renderAdminWatchMsgs.bind(Adm);
        Adm._renderAdminWatchMsgs = function () {
          origWatchRender();
          const box = document.getElementById('adm-watch-msgs');
          if (!box) return;
          box.querySelectorAll('img').forEach((img) => {
            const rawSrc = img.getAttribute('src') || '';
            if (!rawSrc.trim()) {
              const oc = img.getAttribute('onclick') || '';
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-black text-[11px]';
              btn.setAttribute('onclick', oc);
              btn.innerHTML = '<i class="fa-solid fa-image me-1"></i> فتح الصورة المرفقة';
              img.parentNode.replaceChild(btn, img);
            }
          });
        };
      }

      if (typeof Adm.render === 'function') {
        const origAdmRender = Adm.render.bind(Adm);
        Adm.render = function (container, a) {
          origAdmRender(container, a);
          try {
            if (!a.isAdmin()) return;
            const tabBar = container.querySelector('.overflow-x-auto');
            if (!tabBar || tabBar.querySelector('[data-sync-health-btn]')) return;
            const hBtn = document.createElement('button');
            hBtn.type = 'button';
            hBtn.setAttribute('data-sync-health-btn', '1');
            hBtn.className = 'shrink-0 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/50 text-emerald-300 font-black';
            hBtn.textContent = '🩺 فحص الترابط';
            hBtn.onclick = () => SystemSync.openHealthReportModal();
            tabBar.appendChild(hBtn);
          } catch (e) {}
        };
      }
    },

    // ==================== 5. PERMANENT KYC VAULT LIGHTBOX FIX ====================
    patchKycVaultLightbox() {
      if (this._kycClickDelegated) return;
      this._kycClickDelegated = true;

      document.addEventListener('click', (ev) => {
        const btn = ev.target.closest('#daman-kycv-modal [id^="kycv-st-"] button');
        if (!btn) return;
        const stSpan = btn.closest('[id^="kycv-st-"]');
        const key = stSpan ? stSpan.id.replace('kycv-st-', '') : '';
        const img = key ? document.querySelector(`#kycv-img-${key} img`) : null;
        if (img && img.src && window.DamanLightbox) {
          ev.preventDefault();
          ev.stopPropagation();
          btn.removeAttribute('onclick');
          window.DamanLightbox.open(img.src, 'مستند التوثيق');
        }
      }, true);
    },

    // ==================== 6. MISSING ADMIN NOTIFICATIONS, CATEGORY COUNT & UI FIXES ====================
    patchProjectsAndUI() {
      const Proj = window.DamanProjects;
      const app = window.DamanApp;
      if (!Proj || !app || Proj._syncNotifPatchedV38) return;
      Proj._syncNotifPatchedV38 = true;

      const origCatLabel = Proj.catLabel.bind(Proj);
      Proj.catLabel = function (id) {
        if (window.DamanCatAds && typeof DamanCatAds.getCatById === 'function') {
          const c = DamanCatAds.getCatById(id);
          if (c) return app.lang === 'ar' ? c.ar : (c.en || c.ar);
        }
        return origCatLabel(id);
      };

      const origEditor = Proj.openPostEditorModal.bind(Proj);
      Proj.openPostEditorModal = function (existing) {
        origEditor(existing);
        const hBox = document.getElementById('fh-pm-ct');
        if (hBox && Array.isArray(app.CATEGORIES)) {
          hBox.textContent = hBox.textContent.replace('17 تخصص', `${app.CATEGORIES.length} قسم`);
        }
      };

      if (window.DamanPostContact && typeof DamanPostContact.requestExternalContact === 'function') {
        const origExtReq = DamanPostContact.requestExternalContact.bind(DamanPostContact);
        DamanPostContact.requestExternalContact = function (pid, mode) {
          origExtReq(pid, mode);
          const broken = document.querySelector('#daman-ext-contact-warn-modal i.fa-solid.fa-brands');
          if (broken) broken.classList.remove('fa-solid');
        };
      }

      if (typeof Proj.payInspectionRequest === 'function') {
        const origPayIns = Proj.payInspectionRequest.bind(Proj);
        Proj.payInspectionRequest = async function (reqId) {
          const before = this.inspectionReqs.find((x) => x.id === reqId);
          const wasQuoted = before && before.status === 'quoted';
          await origPayIns(reqId);
          if (wasQuoted) {
            try {
              const snap = await app.db.collection('vipRequests').doc(reqId).get();
              if (snap.exists && snap.data().status === 'paid') {
                await app.sendNotification('ADMIN', '💰 تم سداد استلام هندسي 3x', `${app.profile?.name || 'عميل'} سدد ${app.fmtMoney(before.quotedPrice)} ج.م — ${before.element} (${before.location})`);
              }
            } catch (e) {}
          }
        };
      }

      if (typeof Proj.fundVipLaborRequest === 'function') {
        const origFundVip = Proj.fundVipLaborRequest.bind(Proj);
        Proj.fundVipLaborRequest = async function (reqId) {
          const before = this.vipLaborReqs.find((x) => x.id === reqId);
          const wasQuoted = before && before.status === 'quoted';
          await origFundVip(reqId);
          if (wasQuoted) {
            try {
              const snap = await app.db.collection('vipLaborRequests').doc(reqId).get();
              if (snap.exists && snap.data().status === 'funded') {
                await app.sendNotification('ADMIN', '💰 تم حجز وسداد عمالة VIP', `${app.profile?.name || 'عميل'} حجز ${before.workersCount} ${before.trade} بمبلغ ${app.fmtMoney(before.totalQuoted || before.baseCost)} ج.م`);
              }
            } catch (e) {}
          }
        };
      }

      if (typeof Proj.cancelUserRequest === 'function') {
        const origCancel = Proj.cancelUserRequest.bind(Proj);
        Proj.cancelUserRequest = async function (colName, reqId) {
          const item = colName === 'vipRequests'
            ? this.inspectionReqs.find((x) => x.id === reqId)
            : this.vipLaborReqs.find((x) => x.id === reqId);
          await origCancel(colName, reqId);
          try {
            const snap = await app.db.collection(colName).doc(reqId).get();
            if (snap.exists && snap.data().status === 'cancelled') {
              const lbl = colName === 'vipRequests' ? `استلام 3x (${item?.element || ''})` : `عمالة VIP (${item?.trade || ''})`;
              await app.sendNotification('ADMIN', '❌ إلغاء طلب من العميل', `قام ${app.profile?.name || 'مستخدم'} بإلغاء طلب ${lbl}`);
            }
          } catch (e) {}
        };
      }

      if (typeof Proj.applyBoostPackage === 'function') {
        const origBoost = Proj.applyBoostPackage.bind(Proj);
        Proj.applyBoostPackage = async function (pid, pkgId) {
          const before = this.projects.find((x) => x.id === pid);
          const prevUntil = Number(before?.boostedUntil || 0);
          const bp = this.getBoostPackages(app).find((b) => b.id === pkgId);
          await origBoost(pid, pkgId);
          if (!app.isAdmin() && before && bp) {
            try {
              const snap = await app.db.collection('projects').doc(pid).get();
              if (snap.exists && Number(snap.data().boostedUntil || 0) > prevUntil) {
                await app.sendNotification('ADMIN', '★ تفعيل باقة تمييز إعلان', `${app.profile?.name || 'مستخدم'} فعّل ${bp.name} (${app.fmtMoney(bp.price)} ج.م) لإعلان: ${before.title}`);
              }
            } catch (e) {}
          }
        };
      }
    },

    // ==================== 7. SYNC MARKET SEARCH UI, DEPOSIT GRID & AUTO-STOP MIC ====================
    fixDepositChannelGrid() {
      const depModal = document.getElementById('daman-deposit-modal');
      if (!depModal || depModal.classList.contains('hidden')) return;
      const tabBtn = depModal.querySelector('[id^="dep-tab-"]');
      const grid = tabBtn ? tabBtn.parentElement : null;
      if (!grid || !grid.classList.contains('grid')) return;
      const count = Array.from(grid.children).filter((c) => !c.classList.contains('hidden')).length;
      if (count >= 1 && count <= 3) {
        grid.classList.remove('grid-cols-1', 'grid-cols-2', 'grid-cols-3');
        grid.classList.add(`grid-cols-${count}`);
      }
    },

    patchGlobalSafeguards() {
      const app = window.DamanApp;
      if (!app) return;

      if (typeof app.switchTab === 'function' && !app._syncTabPatched) {
        app._syncTabPatched = true;
        const origSwitch = app.switchTab.bind(app);
        app.switchTab = function (tab) {
          if (tab !== 'chat' && window.DamanChat?.voiceRec?.recording) {
            try { DamanChat.stopVoiceNote(true); } catch (e) {}
          }
          return origSwitch(tab);
        };
      }

      if (window.DamanSearch && typeof DamanSearch.onMarketLiveInput === 'function' && !DamanSearch._syncLabelFixedV38) {
        DamanSearch._syncLabelFixedV38 = true;
        const origInp = DamanSearch.onMarketLiveInput.bind(DamanSearch);
        DamanSearch.onMarketLiveInput = function (val) {
          const prevCat = window.DamanProjects?.selectedCategory;
          origInp(val);
          if (prevCat && prevCat !== 'all' && window.DamanProjects?.selectedCategory === 'all') {
            const lbl = document.querySelector('#daman-cats-enhanced-wrap .text-white');
            if (lbl) lbl.textContent = 'كل الأقسام';
            if (window.DamanCatAds && typeof DamanCatAds._updateMarketCatsCardsOnly === 'function') {
              DamanCatAds._updateMarketCatsCardsOnly();
            }
            const wrap = document.getElementById('daman-cats-enhanced-wrap');
            if (wrap && wrap.children.length > 1 && window.DamanCatAds) {
              while (wrap.children.length > 1) wrap.lastElementChild.remove();
              const html = DamanCatAds.renderCategoryAdsBlock('all', app);
              if (html) wrap.insertAdjacentHTML('beforeend', html);
            }
          }
        };
      }
    },

    // ==================== 8. CLICKABLE NOTIFICATIONS DEEP-LINK ROUTER (v57) ====================
    clickMatchingButtonInMain(keywords, attempt = 0) {
      if (!Array.isArray(keywords) || !keywords.length) return;
      const main = document.getElementById('app-main');
      if (!main) return;
      const btns = Array.from(main.querySelectorAll('button'));
      const found = btns.find((b) => {
        const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
        return keywords.some((kw) => t.includes(kw));
      });
      if (found) {
        try { found.click(); } catch (e) {}
      } else if (attempt < 5) {
        setTimeout(() => this.clickMatchingButtonInMain(keywords, attempt + 1), 160);
      }
    },

    navigateFromNotificationText(rawText) {
      const app = window.DamanApp;
      if (!app) return;
      const txt = String(rawText || '').replace(/\s+/g, ' ').trim();
      const low = txt.toLowerCase();
      const isAdm = typeof app.isAdmin === 'function' && app.isAdmin();

      document.querySelectorAll('.daman-modal:not(.hidden)').forEach((m) => {
        const h = (m.querySelector('h2, h3, h4')?.textContent || '');
        if ((m.id || '').toLowerCase().includes('notif') || h.includes('الإشعارات') || h.includes('التنبيهات') || h.toLowerCase().includes('notification')) {
          m.classList.add('hidden');
        }
      });

      // 1) Admin: Display Name Change / KYC requests
      if (isAdm && (txt.includes('تعديل اسم') || txt.includes('اسم ظاهر') || txt.includes('طلب توثيق') || txt.includes('مراجعة التوثيق') || txt.includes('بطاقة جديدة') || txt.includes('سجل تجاري'))) {
        app.switchTab('admin');
        setTimeout(() => this.clickMatchingButtonInMain(['التوثيق والأسماء', 'التوثيق', 'توثيق']), 140);
        return;
      }

      // 2) Admin: Wallet deposit/withdraw requests
      if (isAdm && (txt.includes('طلب شحن') || txt.includes('طلب إيداع') || txt.includes('طلب سحب') || txt.includes('مرجعي مكرر'))) {
        app.switchTab('admin');
        setTimeout(() => this.clickMatchingButtonInMain(['الشحن والسحب', 'طلبات الشحن', 'السحب']), 140);
        return;
      }

      // 3) Admin: AI escalation / support tickets / chat
      if (isAdm && (txt.includes('المساعد الذكي') || txt.includes('تذكرة دعم'))) {
        app.switchTab('admin');
        setTimeout(() => this.clickMatchingButtonInMain(['مراقبة الشات', 'الدعم']), 140);
        return;
      }

      // 4) Admin: Disputes / reports
      if (isAdm && (txt.includes('نزاع') || txt.includes('بلاغ') || txt.includes('شكوى'))) {
        app.switchTab('admin');
        setTimeout(() => this.clickMatchingButtonInMain(['العقود والنزاع', 'النزاعات', 'المستخدمين']), 140);
        return;
      }

      // 5) Admin: Market posts review / 3x / VIP Labor / Boost
      if (isAdm && (txt.includes('إعلان جديد') || txt.includes('تعديل إعلان') || txt.includes('إعادة فتح إعلان') || txt.includes('استلام هندسي') || txt.includes('3x') || low.includes('vip') || txt.includes('تمييز إعلان') || txt.includes('إلغاء طلب من العميل'))) {
        app.switchTab('admin');
        setTimeout(() => this.clickMatchingButtonInMain(['السوق والتمييز', '3x', 'VIP']), 140);
        return;
      }

      // 6) User: Display name approval/rejection
      if (txt.includes('تعديل اسمك') || txt.includes('تعديل الاسم')) {
        app.switchTab('profile');
        return;
      }

      // 7) Wallet (deposit, withdraw, balance, payout, gift, refund)
      if (txt.includes('إيداع') || txt.includes('شحن') || txt.includes('سحب') || txt.includes('رصيد') || txt.includes('محفظ') || txt.includes('هدية') || txt.includes('تحويل') || txt.includes('مستحق')) {
        app.switchTab('wallet');
        if (txt.includes('طلب')) {
          setTimeout(() => this.clickMatchingButtonInMain(['الطلبات']), 180);
        }
        return;
      }

      // 8) KYC for regular user
      if (txt.includes('توثيق') || txt.includes('البطاقة') || txt.includes('الهوية') || low.includes('kyc')) {
        app.switchTab('wallet');
        if (txt.includes('رفض') || txt.includes('إعادة') || txt.includes('استكمال')) {
          setTimeout(() => window.DamanWallet?.openKycModal?.(false), 260);
        }
        return;
      }

      // 9) Company / employees / payroll / custody / site attendance
      if (txt.includes('شركة') || txt.includes('موظف') || txt.includes('حضور') || txt.includes('انصراف') || txt.includes('عهدة') || txt.includes('مرتب') || txt.includes('راتب') || txt.includes('موقع العمل')) {
        app.switchTab('company');
        return;
      }

      // 10) Chat / messages / calls / contracts / escrow milestones
      if (txt.includes('رسالة') || txt.includes('شات') || txt.includes('دردش') || txt.includes('مكالمة') || txt.includes('عقد') || txt.includes('ضمان') || txt.includes('مستخلص') || txt.includes('دفعة') || txt.includes('مخالصة') || txt.includes('توقيع')) {
        app.switchTab('chat');
        return;
      }

      // 11) Market / projects / ads / 3x / VIP labor
      if (txt.includes('استلام') || txt.includes('3x') || low.includes('vip') || txt.includes('إعلان') || txt.includes('منشور') || txt.includes('مشروع') || txt.includes('السوق') || txt.includes('قسم') || txt.includes('عرض')) {
        app.switchTab('projects');
        if (txt.includes('3x') || txt.includes('استلام')) {
          setTimeout(() => this.clickMatchingButtonInMain(['3x', 'استلام']), 180);
        } else if (low.includes('vip') || txt.includes('عمالة')) {
          setTimeout(() => this.clickMatchingButtonInMain(['VIP', 'عمالة']), 180);
        }
        return;
      }

      // 12) Profile / rating / account / birthday
      if (txt.includes('تقييم') || txt.includes('ملفك') || txt.includes('صفحتك') || txt.includes('عيد ميلاد') || txt.includes('حسابك')) {
        app.switchTab('profile');
        return;
      }

      app.switchTab('home');
    },

    enhanceNotificationsModal(modal) {
      if (!modal || modal.classList.contains('hidden')) return;
      const id = (modal.id || '').toLowerCase();
      const head = (modal.querySelector('h2, h3, h4')?.textContent || '').trim();
      const isNotifModal = id.includes('notif') || head.includes('الإشعارات') || head.includes('التنبيهات') || head.toLowerCase().includes('notification');
      if (!isNotifModal) return;

      const candidates = Array.from(modal.querySelectorAll('.rounded-2xl, .rounded-xl, .glass-card, li')).filter((el) => {
        if (el === modal || el === modal.firstElementChild) return false;
        if (el.tagName === 'BUTTON' || el.closest('button')) return false;
        if (el.querySelector('form, input, textarea, select')) return false;
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt.length < 10 || txt.includes('لا توجد إشعارات') || txt.includes('No notifications')) return false;
        // Skip only outer wrappers that enclose multiple inner notification cards (allow small icon badges inside a card)
        const innerCards = Array.from(el.querySelectorAll('.rounded-2xl, .rounded-xl, .glass-card, li')).filter(
          (ch) => (ch.textContent || '').replace(/\s+/g, ' ').trim().length > 22
        );
        if (innerCards.length >= 1) return false;
        return true;
      });

      candidates.forEach((card) => {
        if (card.dataset.damanNotifLinkedV57) return;
        card.dataset.damanNotifLinkedV57 = '1';
        card.classList.add('cursor-pointer', 'hover:border-amber-400/70', 'transition');

        if (!card.querySelector('.daman-notif-open-hint')) {
          const hint = document.createElement('div');
          hint.className = 'daman-notif-open-hint mt-1.5 pt-1 border-t border-slate-800/80 text-[9.5px] font-black text-amber-400 flex items-center justify-end gap-1';
          hint.innerHTML = '<span>اضغط للانتقال مباشرة</span><i class="fa-solid fa-chevron-left text-[8px]"></i>';
          card.appendChild(hint);
        }

        card.addEventListener('click', (ev) => {
          if (ev.target && ev.target.closest('button, a')) return;
          this.navigateFromNotificationText(card.textContent || '');
        });
      });
    },

    patchNotificationDeepLinks() {
      const app = window.DamanApp;
      if (!app || this._notifLinksPatchedV57) return;
      this._notifLinksPatchedV57 = true;

      if (typeof app.openNotificationsModal === 'function') {
        const origOpen = app.openNotificationsModal.bind(app);
        app.openNotificationsModal = function () {
          const res = origOpen.apply(this, arguments);
          setTimeout(() => {
            document.querySelectorAll('.daman-modal:not(.hidden)').forEach((m) => SystemSync.enhanceNotificationsModal(m));
          }, 90);
          setTimeout(() => {
            document.querySelectorAll('.daman-modal:not(.hidden)').forEach((m) => SystemSync.enhanceNotificationsModal(m));
          }, 350);
          return res;
        };
      }

      if (typeof MutationObserver !== 'undefined') {
        const notifObs = new MutationObserver(() => {
          this.fixDepositChannelGrid();
          document.querySelectorAll('.daman-modal:not(.hidden)').forEach((m) => this.enhanceNotificationsModal(m));
        });
        notifObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
    },

    // ==================== 9. LIVE BADGE WATCHER (SOUND + CLICKABLE FOREGROUND ALERT) ====================
    makeLatestToastClickable(onTap) {
      setTimeout(() => {
        const box = document.getElementById('daman-toast-container');
        if (!box || !box.lastElementChild) return;
        const toastEl = box.lastElementChild;
        toastEl.classList.add('pointer-events-auto', 'cursor-pointer');
        toastEl.addEventListener('click', () => {
          try { toastEl.remove(); } catch (e) {}
          if (typeof onTap === 'function') onTap();
        });
      }, 30);
    },

    startLiveAlertWatcher() {
      if (this._badgeObsStarted || typeof MutationObserver === 'undefined') return;
      this._badgeObsStarted = true;

      const watchBadge = (elId, kind) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const readCount = () => (el.classList.contains('hidden') ? 0 : (parseInt(el.textContent, 10) || 0));

        if (kind === 'notif') this._lastNotifCount = readCount();
        else this._lastChatCount = readCount();

        const obs = new MutationObserver(() => {
          const cur = readCount();
          const prev = kind === 'notif' ? this._lastNotifCount : this._lastChatCount;
          if (kind === 'notif') this._lastNotifCount = cur;
          else this._lastChatCount = cur;

          if (Date.now() - this._bootTimestamp < 4000) return;
          if (cur > prev && prev >= 0) {
            this.playChime(kind);
            if (window.DamanApp && typeof DamanApp.toast === 'function') {
              if (kind === 'notif') {
                DamanApp.toast('🔔 وصلك إشعار جديد — اضغط هنا للمراجعة فوراً', 'info');
                this.makeLatestToastClickable(() => DamanApp.openNotificationsModal?.());
              } else if (DamanApp.activeTab !== 'chat') {
                DamanApp.toast('💬 لديك رسالة جديدة في الشات — اضغط هنا للفتح', 'info');
                this.makeLatestToastClickable(() => DamanApp.switchTab('chat'));
              }
            }
          }
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      };

      watchBadge('daman-notif-badge', 'notif');
      watchBadge('daman-chat-unread-badge', 'chat');
    },

    // ==================== 10. SYSTEM HEALTH DIAGNOSTIC MODAL (v57 - 23/23 CHECKS) ====================
    openHealthReportModal() {
      const app = window.DamanApp;
      if (!app) return;

      const checks = [
        ['النواة الأساسية (app-core)', !!window.DamanApp],
        ['المحفظة والتوثيق (wallet-kyc + ops)', !!window.DamanWallet],
        ['يوم عمل + رقم مرجعي اختياري (wallet-sla)', !!window.DamanWalletSLA],
        ['ترابط الإدارة والمحفظة + توحيد فحص العقد', !!window.DamanWalletMethods],
        ['المساعد الذكي AI + الترجمة EN + تعديل الاسم (v57)', !!(window.DamanAiI18n && DamanAiI18n._booted)],
        ['الشات والعقود والمكالمات (chat-support + extras)', !!window.DamanChat],
        ['المايك والملفات واللوكيشن (chat-media)', !!(window.DamanChat && DamanChat._mediaPluginAttached)],
        ['السوق + حذف ومراجعة المنشورات (projects-escrow v57)', !!(window.DamanProjects && typeof DamanProjects.deletePost === 'function')],
        ['لوحة الشركات (company-panel)', !!window.DamanCompany],
        ['إشعارات الشركات وعلامات (؟) (company-enhancements)', !!(window.DamanCompanyEnh && DamanCompanyEnh._syncFixedV38)],
        ['لوحة الإدارة 360° + مراجعة الأسماء (admin v57)', !!(window.DamanAdmin && DamanAdmin._ext1Ready && typeof DamanAdmin.approveNameChange === 'function')],
        ['صوت وملفات مراقبة الشات (admin-chat-media)', !!(window.DamanAdmin && DamanAdmin._watchMediaPatched)],
        ['الأقسام الديناميكية وإعلاناتها (categories-ads)', !!window.DamanCatAds],
        ['باقة الـ 62 قسم الشاملة (categories-pack)', !!(window.DamanCatAds && DamanCatAds._packV33Attached)],
        ['البحث الشامل (global-search)', !!window.DamanSearch],
        ['رقم المنشور وتحذير الأمان (post-contact-guard)', !!window.DamanPostContact],
        ['أرشيف البطاقات والسجلات (kyc-vault)', !!window.DamanKycVault],
        ['المشاركة وQR العقد والصفحة (share-qr)', !!(window.DamanShareQR && DamanShareQR._syncFixedV38)],
        ['كاميرا QR + كاميرا التوثيق + أعياد الميلاد (kyc-bday-qr)', !!(window.DamanKycBdayQR && DamanKycBdayQR._rulesResilientV41)],
        ['الإشعارات الجماعية + الحاسبة + انتهاء البطاقات (admin-growth-ops)', !!window.DamanGrowthOps],
        ['التحقق العام من العقود + الحظر والتجميد (security-verify-ban)', !!window.DamanSecurityMod],
        ['توجيه الإشعارات بالضغط والصوت (system-sync v57)', !!(this._booted && this._notifLinksPatchedV57)],
        ['اتصال Firebase Firestore + QRCode', !!(app.db && app.auth && typeof window.QRCode !== 'undefined')]
      ];

      const passed = checks.filter((c) => c[1]).length;
      const allOk = passed === checks.length;

      let m = document.getElementById('daman-health-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-health-modal';
        m.className = 'daman-modal fixed inset-0 z-[97] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 ${allOk ? 'border-emerald-500/60' : 'border-amber-500/60'} rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black ${allOk ? 'text-emerald-400' : 'text-amber-400'}">🩺 تقرير فحص ترابط المنظومة v57 (${passed}/${checks.length})</h3>
            <button type="button" onclick="document.getElementById('daman-health-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between">
            <span>عدد الأقسام الفعّالة حالياً: <b class="text-amber-300">${(app.CATEGORIES || []).length} قسم</b></span>
            <button type="button" onclick="DamanSync.playChime('notif')" class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-black text-[10px]">🔊 تجربة نغمة الإشعار</button>
          </div>
          <div class="space-y-1.5">
            ${checks.map(([label, ok]) => `
              <div class="p-2 rounded-xl bg-slate-950 border ${ok ? 'border-emerald-500/30' : 'border-rose-500/60'} flex items-center justify-between gap-2 text-[11px]">
                <span class="text-slate-200 font-bold">${label}</span>
                <span class="px-2 py-0.5 rounded-lg font-black text-[10px] shrink-0 ${ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${ok ? 'شغّال ✅' : 'ناقص ❌'}</span>
              </div>`).join('')}
          </div>
          <button type="button" onclick="document.getElementById('daman-health-modal').classList.add('hidden')" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">إغلاق</button>
        </div>`;
    },

    // Keep v57 23/23 health report active even if older helper files try to override it
    lockV57HealthReport() {
      this._healthV56Patched = true;
      this._healthV55Patched = true;
    },

    // ==================== BOOT ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.lockV57HealthReport();
      this.patchShareQR();
      this.patchCompanyEnhancements();
      this.patchAdminIntegration();
      this.patchKycVaultLightbox();
      this.patchProjectsAndUI();
      this.patchGlobalSafeguards();
      this.patchNotificationDeepLinks();
      this.startLiveAlertWatcher();

      setTimeout(() => {
        this.lockV57HealthReport();
        this.patchShareQR();
        this.patchCompanyEnhancements();
        this.patchAdminIntegration();
        this.patchProjectsAndUI();
        this.patchGlobalSafeguards();
        this.patchNotificationDeepLinks();
        if (['projects', 'chat', 'admin', 'company'].includes(app.activeTab)) app.renderCurrentTab();
      }, 650);
    }
  };

  window.DamanSync = SystemSync;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => SystemSync.boot(), 450));
  else setTimeout(() => SystemSync.boot(), 450);
})();
