(function () {
  const SystemSync = {
    _booted: false,
    _bootTimestamp: Date.now(),
    _lastNotifCount: -1,
    _lastChatCount: -1,
    _soundEnabled: true,

    // ==================== 1. SUBTLE WEB AUDIO CHIME (NO EXTERNAL MP3) ====================
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

    // ==================== 2. FIX SHARE-QR CLICK HANDLERS (CRITICAL BUG FIX) ====================
    patchShareQR() {
      const QR = window.DamanShareQR;
      if (!QR || QR._syncFixed) return;
      QR._syncFixed = true;

      QR.enhanceMarketCardsHtml = function (html, app) {
        if (!html || !html.includes('toggleFavorite(')) return html;
        const wrap = document.createElement('div');
        wrap.innerHTML = html;

        Array.from(wrap.children).forEach((card) => {
          if (card.querySelector('.daman-card-qr-btn')) return;
          const favBtn = card.querySelector('button[onclick*="DamanProjects.toggleFavorite"]');
          if (!favBtn) return;
          const m = (favBtn.getAttribute('onclick') || '').match(/toggleFavorite\('([^']+)'\)/);
          if (!m || !m[1]) return;
          const safePid = app.esc(m[1]).replace(/'/g, "\\'");

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

      QR.enhanceContractCardHtml = function (html, ag, app) {
        if (!html || !ag || !ag.id) return html;
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        const card = wrap.firstElementChild;
        if (!card || card.querySelector('.daman-ct-qr-btn')) return html;

        const safeAgId = app.esc(ag.id).replace(/'/g, "\\'");
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
    },

    // ==================== 3. FIX ADMIN TAB CONFLICT + USER 360° KYC SHORTCUT + HEALTH BUTTON ====================
    patchAdminIntegration() {
      const Adm = window.DamanAdmin;
      const app = window.DamanApp;
      if (!Adm || !app || Adm._syncPatched) return;
      Adm._syncPatched = true;

      // Resolve conflict between Categories tab and KYC Vault tab
      if (typeof Adm.setSubTab === 'function') {
        const prevSetTab = Adm.setSubTab.bind(Adm);
        Adm.setSubTab = function (t) {
          if (t === 'categories') {
            this._viewingKycVaultTab = false;
          } else if (t === 'kyc_vault') {
            this._viewingCategoriesTab = false;
          } else {
            this._viewingCategoriesTab = false;
            this._viewingKycVaultTab = false;
          }
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

      // Inject "🪪 البطاقة والسجل التجاري" button inside User 360° Modal automatically
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

      // Inject "🩺 فحص الترابط" quick button in Admin panel tab bar
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

    // ==================== 4. FIX KYC VAULT LIGHTBOX INLINE BASE64 ====================
    patchKycVaultLightbox() {
      const Vault = window.DamanKycVault;
      if (!Vault || Vault._syncLbFixed) return;
      Vault._syncLbFixed = true;

      const origOpen = Vault.openDocsModal.bind(Vault);
      Vault.openDocsModal = async function (uid, isSelf) {
        await origOpen(uid, isSelf);
        // Cleanly bind zoom buttons to read from rendered <img> without giant inline Base64 onclick strings
        setTimeout(() => {
          const modal = document.getElementById('daman-kycv-modal');
          if (!modal) return;
          ['idFront', 'idBack', 'selfie', 'cr', 'tax'].forEach((k) => {
            const stEl = document.getElementById('kycv-st-' + k);
            const imgWrap = document.getElementById('kycv-img-' + k);
            if (!stEl || !imgWrap) return;
            const btn = stEl.querySelector('button');
            if (btn) {
              btn.removeAttribute('onclick');
              btn.onclick = () => {
                const img = imgWrap.querySelector('img');
                if (img && img.src && window.DamanLightbox) {
                  window.DamanLightbox.open(img.src, 'مستند التوثيق');
                }
              };
            }
          });
        }, 1200);
      };
    },

    // ==================== 5. MISSING ADMIN NOTIFICATIONS + HIDDEN CATEGORY LABELS ====================
    patchProjectsNotificationsAndLabels() {
      const Proj = window.DamanProjects;
      const app = window.DamanApp;
      if (!Proj || !app || Proj._syncNotifPatched) return;
      Proj._syncNotifPatched = true;

      // Fix hidden/custom category label lookup
      const origCatLabel = Proj.catLabel.bind(Proj);
      Proj.catLabel = function (id) {
        if (window.DamanCatAds && typeof DamanCatAds.getCatById === 'function') {
          const c = DamanCatAds.getCatById(id);
          if (c) return app.lang === 'ar' ? c.ar : (c.en || c.ar);
        }
        return origCatLabel(id);
      };

      // Notify Admin when user pays Inspection 3x quote
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

      // Notify Admin when user funds VIP Labor quote
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

      // Notify Admin when user cancels an Inspection or VIP Labor request
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

      // Notify Admin when user activates a paid Ad Boost package
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

    // ==================== 6. SYNC MARKET SEARCH LABEL & AUTO-STOP MIC ON TAB LEAVE ====================
    patchGlobalSafeguards() {
      const app = window.DamanApp;
      if (!app) return;

      // Auto-cancel active voice recording if user leaves Chat tab
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

      // Keep "القسم الحالي" header synced when Market search switches to 'all'
      if (window.DamanSearch && typeof DamanSearch.onMarketLiveInput === 'function' && !DamanSearch._syncLabelFixed) {
        DamanSearch._syncLabelFixed = true;
        const origInp = DamanSearch.onMarketLiveInput.bind(DamanSearch);
        DamanSearch.onMarketLiveInput = function (val) {
          const prevCat = window.DamanProjects?.selectedCategory;
          origInp(val);
          if (prevCat && prevCat !== 'all' && window.DamanProjects?.selectedCategory === 'all') {
            const lbl = document.querySelector('#daman-cats-enhanced-wrap .text-white');
            if (lbl) lbl.textContent = 'كل الأقسام';
          }
        };
      }
    },

    // ==================== 7. LIVE BADGE WATCHER (SOUND + FOREGROUND ALERT) ====================
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

          // Ignore initial load burst during first 4 seconds
          if (Date.now() - this._bootTimestamp < 4000) return;
          if (cur > prev && prev >= 0) {
            this.playChime(kind);
            if (window.DamanApp && typeof DamanApp.toast === 'function') {
              if (kind === 'notif') DamanApp.toast('🔔 وصلك إشعار جديد — اضغط على الجرس للمراجعة', 'info');
              else if (DamanApp.activeTab !== 'chat') DamanApp.toast('💬 لديك رسالة جديدة في الشات', 'info');
            }
          }
        });
        obs.observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      };

      watchBadge('daman-notif-badge', 'notif');
      watchBadge('daman-chat-unread-badge', 'chat');
    },

    // ==================== 8. SYSTEM HEALTH DIAGNOSTIC MODAL ====================
    openHealthReportModal() {
      const app = window.DamanApp;
      if (!app) return;

      const checks = [
        ['النواة الأساسية (app-core)', !!window.DamanApp],
        ['المحفظة والتوثيق (wallet-kyc + ops)', !!window.DamanWallet],
        ['الشات والعقود والمكالمات (chat-support + extras)', !!window.DamanChat],
        ['المايك والملفات واللوكيشن (chat-media)', !!(window.DamanChat && DamanChat._mediaPluginAttached)],
        ['السوق والـ 3x وعمالة VIP (projects-escrow)', !!window.DamanProjects],
        ['لوحة الشركات (company-panel)', !!window.DamanCompany],
        ['إشعارات الشركات وعلامات (؟) (company-enhancements)', !!window.DamanCompanyEnh],
        ['لوحة الإدارة 360° (admin + ext + ext2)', !!(window.DamanAdmin && DamanAdmin._ext1Ready)],
        ['صوت وملفات مراقبة الشات (admin-chat-media)', !!(window.DamanAdmin && DamanAdmin._watchMediaPatched)],
        ['الأقسام الديناميكية وإعلاناتها (categories-ads)', !!window.DamanCatAds],
        ['باقة الـ 60 قسم الشاملة (categories-pack)', !!(window.DamanCatAds && DamanCatAds._packV33Attached)],
        ['البحث الشامل (global-search)', !!window.DamanSearch],
        ['رقم المنشور وتحذير الأمان (post-contact-guard)', !!window.DamanPostContact],
        ['أرشيف البطاقات والسجلات (kyc-vault)', !!window.DamanKycVault],
        ['المشاركة وQR العقد والصفحة (share-qr)', !!(window.DamanShareQR && DamanShareQR._syncFixed)],
        ['ربط الإشعارات والصوت والتكامل (system-sync)', !!this._booted],
        ['مكتبة رسم الـ QRCode', typeof window.QRCode !== 'undefined'],
        ['اتصال Firebase Firestore', !!(app.db && app.auth)]
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
            <h3 class="text-sm font-black ${allOk ? 'text-emerald-400' : 'text-amber-400'}">🩺 تقرير فحص ترابط المنظومة (${passed}/${checks.length})</h3>
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

    // ==================== BOOT ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.patchShareQR();
      this.patchAdminIntegration();
      this.patchKycVaultLightbox();
      this.patchProjectsNotificationsAndLabels();
      this.patchGlobalSafeguards();
      this.startLiveAlertWatcher();

      // Re-verify late-booting plugins after 600ms
      setTimeout(() => {
        this.patchShareQR();
        this.patchAdminIntegration();
        this.patchKycVaultLightbox();
        this.patchGlobalSafeguards();
        if (['projects', 'chat', 'admin'].includes(app.activeTab)) app.renderCurrentTab();
      }, 600);
    }
  };

  window.DamanSync = SystemSync;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => SystemSync.boot(), 450));
  else setTimeout(() => SystemSync.boot(), 450);
})();
