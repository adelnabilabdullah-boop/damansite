(function () {
  const PostContactGuard = {
    _booted: false,

    toWesternDigits(str) {
      return String(str || '')
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    },

    cleanPhone(raw) {
      const w = this.toWesternDigits(raw).trim();
      const plus = w.startsWith('+') ? '+' : '';
      const digits = w.replace(/\D/g, '');
      return digits ? plus + digits : '';
    },

    toWhatsappNumber(raw) {
      const digits = this.toWesternDigits(raw).replace(/\D/g, '');
      if (!digits) return '';
      if (digits.startsWith('00')) return digits.slice(2);
      if (digits.startsWith('01') && digits.length === 11) return '2' + digits;
      return digits;
    },

    maskPhone(raw) {
      const d = this.toWesternDigits(raw).replace(/\D/g, '');
      if (d.length < 7) return d;
      return `${d.slice(0, 3)}••••${d.slice(-3)}`;
    },

    hBtn(id) {
      return `<button type="button" onclick="window.DamanToggleHelp && window.DamanToggleHelp('${id}')" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/25 border border-sky-400/70 text-sky-300 text-[9.5px] font-black ms-1 align-middle" title="شرح الخانة">؟</button>`;
    },

    hBox(id, text) {
      return `<div id="fh-${id}" class="hidden mt-1 mb-1.5 p-2.5 rounded-xl bg-sky-950/95 border border-sky-400/60 text-[11px] text-sky-100 leading-relaxed font-semibold shadow-lg">💡 ${text}</div>`;
    },

    fillMyProfilePhone() {
      const app = window.DamanApp;
      const inp = document.getElementById('pm-contact-phone');
      if (!inp) return;
      const ph = this.cleanPhone(app?.profile?.phone || '');
      if (!ph) return app.toast('لا يوجد رقم هاتف مسجّل في ملفك الشخصي بعد', 'warning');
      inp.value = ph;
    },

    // ==================== 1. INJECT PHONE & WHATSAPP INPUTS INTO POST MODAL ====================
    injectEditorFields(existing) {
      const app = window.DamanApp;
      const form = document.querySelector('#daman-post-modal form');
      if (!form || document.getElementById('pm-contact-phone')) return;

      const curPhone = existing?.contactPhone || '';
      const curWa = existing ? existing.contactWhatsapp !== false : true;

      const block = document.createElement('div');
      block.className = 'p-3 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-2';
      block.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <label class="text-[10.5px] font-black text-emerald-300">
            📞 رقم الهاتف / واتساب للتواصل (اختياري) ${this.hBtn('pm-cph')}
          </label>
          <button type="button" onclick="DamanPostContact.fillMyProfilePhone()" class="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 text-[9.5px] font-bold shrink-0">رقمي المسجّل</button>
        </div>
        ${this.hBox('pm-cph', 'يمكنك إضافة رقم هاتفك أو واتساب ليظهر في المنشور (أو اتركه فارغاً للتواصل عبر الشات الداخلي فقط). عند ضغط أي شخص على الرقم أو واتساب سيظهر له تحذير أمان تلقائي بأن التعامل خارج التطبيق على مسؤوليته.')}
        <input id="pm-contact-phone" type="tel" dir="ltr" value="${app.esc(curPhone)}" placeholder="010xxxxxxxx (اتركه فارغاً لو دردشة فقط)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-end" />
        <label class="flex items-center gap-2 text-[10.5px] text-slate-200 font-bold cursor-pointer">
          <input id="pm-contact-wa" type="checkbox" ${curWa ? 'checked' : ''} class="accent-emerald-500" />
          <span>تفعيل زر واتساب على هذا الرقم أيضاً</span>
        </label>`;

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) form.insertBefore(block, submitBtn);
      else form.appendChild(block);
    },

    // ==================== 2. WARNING MODAL BEFORE EXTERNAL CALL / WHATSAPP ====================
    findPost(pid) {
      const app = window.DamanApp;
      if (!window.DamanProjects || typeof DamanProjects.getAllMarketPosts !== 'function') return null;
      return DamanProjects.getAllMarketPosts(app).find((x) => x.id === pid) || null;
    },

    requestExternalContact(pid, mode) {
      const app = window.DamanApp;
      const p = this.findPost(pid);
      if (!p || !p.contactPhone) return;

      const isWa = mode === 'whatsapp';
      const channelAr = isWa ? 'واتساب' : 'الاتصال الهاتفي';
      const isOwner = !p.isDemo && app.user && p.ownerId === app.user.uid;

      let m = document.getElementById('daman-ext-contact-warn-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-ext-contact-warn-modal';
        m.className = 'daman-modal fixed inset-0 z-[96] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'extWarn' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-rose-500/70 rounded-3xl p-4 space-y-3 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-rose-400">
              <i class="fa-solid fa-triangle-exclamation me-1"></i> تحذير أمان قبل التواصل عبر ${channelAr}
            </h3>
            <button type="button" onclick="document.getElementById('daman-ext-contact-warn-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/50 text-rose-100 space-y-1.5 leading-relaxed">
            <div class="font-black text-rose-300">⚠️ انتبه قبل الخروج من التطبيق:</div>
            <p class="text-[11px]">
              1. أي تواصل أو اتفاق أو تحويل أموال عبر <b>${channelAr}</b> يتم <b>خارج رقابة وضمان منصة ضمان سايت</b> وعلى مسؤوليتك الشخصية بالكامل.
            </p>
            <p class="text-[11px]">
              2. المنصة غير مسؤولة عن أي خلاف أو نصب أو عدم التزام في أي تعامل يتم بدون <b>عقد ضمان رسمي داخل التطبيق</b>.
            </p>
            <p class="text-[11px] text-emerald-300 font-bold">
              🛡️ الأفضل والأضمن: اتفق داخل «الدردشة المضمونة» بالتطبيق واعمل عقد بالضمان المالي يحفظ حقك 100%.
            </p>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
            الإعلان: <b class="text-white">${app.esc(p.title)}</b><br/>
            المعلن: <b class="text-amber-300">${app.esc(p.ownerName || 'مستخدم')}</b>
          </div>

          <div id="daman-ext-confirm-area" class="space-y-2">
            ${!isOwner ? `
              <button type="button" onclick="DamanPostContact.openSafeChat('${app.esc(pid)}')" class="w-full py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20">
                <i class="fa-solid fa-shield-halved me-1"></i> الأفضل: فتح الدردشة المضمونة داخل التطبيق
              </button>` : ''}

            <button type="button" onclick="DamanPostContact.proceedExternal('${app.esc(pid)}','${isWa ? 'whatsapp' : 'call'}')" class="w-full py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/60 text-rose-200 font-black text-[11px]">
              <i class="fa-solid ${isWa ? 'fa-brands fa-whatsapp' : 'fa-phone'} me-1"></i> أفهم التحذير — متابعة إلى ${channelAr} على مسؤوليتي
            </button>

            <button type="button" onclick="document.getElementById('daman-ext-contact-warn-modal').classList.add('hidden')" class="w-full py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-[11px]">
              إلغاء
            </button>
          </div>
        </div>`;
    },

    openSafeChat(pid) {
      const p = this.findPost(pid);
      document.getElementById('daman-ext-contact-warn-modal')?.classList.add('hidden');
      document.getElementById('daman-post-detail-modal')?.classList.add('hidden');
      if (p && window.DamanChat) {
        DamanChat.openDirectChat(p.ownerId, p.ownerName || 'مستخدم', p.id, p.title || '');
      }
    },

    proceedExternal(pid, mode) {
      const app = window.DamanApp;
      const p = this.findPost(pid);
      if (!p || !p.contactPhone) return;

      const phone = this.cleanPhone(p.contactPhone);
      const waNum = this.toWhatsappNumber(p.contactPhone);
      const isWa = mode === 'whatsapp';
      const targetUrl = isWa
        ? `https://wa.me/${waNum}?text=${encodeURIComponent(`مرحباً، أتواصل معك بخصوص إعلانك على ضمان سايت: ${p.title}`)}`
        : `tel:${phone}`;

      const area = document.getElementById('daman-ext-confirm-area');
      if (area) {
        area.innerHTML = `
          <div class="p-3 rounded-2xl bg-slate-950 border border-amber-500/50 text-center space-y-2">
            <div class="text-[10.5px] text-slate-400">رقم التواصل في الإعلان:</div>
            <div class="text-base font-black text-amber-300 tracking-wider select-all" dir="ltr">${app.esc(phone)}</div>
            <div class="grid grid-cols-2 gap-1.5">
              <a href="${app.esc(targetUrl)}" ${isWa ? 'target="_blank" rel="noopener noreferrer"' : ''} class="py-2 rounded-xl ${isWa ? 'bg-emerald-500 text-slate-950' : 'bg-sky-500 text-slate-950'} font-black text-[11px]">
                ${isWa ? '💬 فتح واتساب الآن' : '📞 اتصال الآن'}
              </a>
              <button type="button" onclick="navigator.clipboard.writeText('${app.esc(phone)}'); DamanApp.toast('تم نسخ الرقم ✅','success')" class="py-2 rounded-xl bg-slate-800 text-white font-bold text-[11px]">
                📋 نسخ الرقم
              </button>
            </div>
          </div>
          <button type="button" onclick="document.getElementById('daman-ext-contact-warn-modal').classList.add('hidden')" class="w-full py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-[11px]">إغلاق</button>`;
      }

      if (isWa) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = targetUrl;
      }
    },

    // ==================== 3. RENDER CONTACT BUTTONS ON CARDS & POST DETAILS ====================
    buildContactStripHTML(p, app) {
      if (!p || !p.contactPhone) return '';
      const masked = this.maskPhone(p.contactPhone);
      const showWa = p.contactWhatsapp !== false;
      return `
        <div class="daman-post-contact-strip grid ${showWa ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5 pt-1">
          <button type="button" onclick="DamanPostContact.requestExternalContact('${app.esc(p.id)}','call')" class="py-1.5 px-2 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-300 font-black text-[10.5px] flex items-center justify-center gap-1">
            <i class="fa-solid fa-phone"></i>
            <span>اتصال</span>
            <span dir="ltr" class="opacity-80 text-[9.5px]">${app.esc(masked)}</span>
          </button>
          ${showWa ? `
            <button type="button" onclick="DamanPostContact.requestExternalContact('${app.esc(p.id)}','whatsapp')" class="py-1.5 px-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-black text-[10.5px] flex items-center justify-center gap-1">
              <i class="fa-brands fa-whatsapp text-xs"></i>
              <span>واتساب</span>
            </button>` : ''}
        </div>`;
    },

    enhanceCardsHTML(html, app) {
      if (!html || !html.includes('openPostDetails(')) return html;
      const wrap = document.createElement('div');
      wrap.innerHTML = html;

      Array.from(wrap.children).forEach((card) => {
        if (card.querySelector('.daman-post-contact-strip')) return;
        const m = card.innerHTML.match(/DamanProjects\.openPostDetails\('([^']+)'\)/);
        if (!m || !m[1]) return;
        const p = this.findPost(m[1]);
        if (!p || !p.contactPhone) return;

        const stripHtml = this.buildContactStripHTML(p, app);
        if (!stripHtml) return;
        const tmp = document.createElement('div');
        tmp.innerHTML = stripHtml.trim();
        card.appendChild(tmp.firstElementChild);
      });

      return wrap.innerHTML;
    },

    enhancePostDetailModal(pid) {
      const app = window.DamanApp;
      const p = this.findPost(pid);
      if (!p || !p.contactPhone) return;

      const modal = document.getElementById('daman-post-detail-modal');
      const card = modal && modal.firstElementChild;
      if (!card || card.querySelector('.daman-post-contact-strip')) return;

      const box = document.createElement('div');
      box.className = 'p-2.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5';
      box.innerHTML = `
        <div class="flex items-center justify-between text-[10px]">
          <span class="font-black text-slate-300">تواصل خارجي (مع تنبيه أمان):</span>
          <span class="text-rose-300 font-bold">خارج الضمان ⚠️</span>
        </div>
        ${this.buildContactStripHTML(p, app)}`;

      const lastRow = card.lastElementChild;
      if (lastRow) card.insertBefore(box, lastRow);
      else card.appendChild(box);
    },

    // ==================== 4. BOOT & CLEAN WRAPPERS ====================
    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      const Proj = window.DamanProjects;
      if (!app || !Proj) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      // 1. Wrap openPostEditorModal to add Phone & WhatsApp fields
      const origOpenEditor = Proj.openPostEditorModal.bind(Proj);
      Proj.openPostEditorModal = (existing) => {
        origOpenEditor(existing);
        try { this.injectEditorFields(existing); } catch (e) {}
      };

      // 2. Wrap savePost cleanly to persist contactPhone & contactWhatsapp in the same write
      Proj.savePost = async function (e, existingId) {
        e.preventDefault();
        if (!existingId && app.appConfig?.disableMarketPosting && !app.isAdmin()) {
          return app.toast('نشر الإعلانات متوقف مؤقتاً', 'warning');
        }

        const rawPhone = document.getElementById('pm-contact-phone')?.value || '';
        const contactPhone = PostContactGuard.cleanPhone(rawPhone);
        if (contactPhone && contactPhone.replace(/\D/g, '').length < 8) {
          return app.toast('أدخل رقم هاتف صحيح أو اتركه فارغاً للتواصل عبر الدردشة فقط', 'warning');
        }
        const contactWhatsapp = !!(contactPhone && (document.getElementById('pm-contact-wa')?.checked !== false));

        await app.withLock('savePost', async () => {
          const tierId = app.isAdmin() ? (document.getElementById('pm-admin-tier')?.value || '') : '';
          const tierObj = tierId ? this.getBoostPackages(app).find((b) => b.id === tierId) : null;

          const payload = {
            postType: document.getElementById('pm-type').value,
            category: document.getElementById('pm-cat').value,
            title: document.getElementById('pm-title').value.trim(),
            budget: parseFloat(document.getElementById('pm-budget').value) || 0,
            city: document.getElementById('pm-city').value.trim(),
            description: document.getElementById('pm-desc').value.trim(),
            imageBase64: this.tempPostPhoto || '',
            contactPhone,
            contactWhatsapp,
            status: app.hasAdminAccess() ? 'approved' : 'pending_review',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          if (tierObj) {
            payload.boostedUntil = Date.now() + Number(tierObj.days || 7) * 86400000;
            payload.boostTierId = tierObj.id;
            payload.boostBadge = tierObj.badge || '★ إعلان مميز';
            payload.boostColor = tierObj.color || 'amber';
            payload.boostPriority = Number(tierObj.priority || 2);
            payload.showOnHome = tierObj.showOnHome !== false;
          }

          try {
            if (existingId) {
              await app.db.collection('projects').doc(existingId).update(payload);
              app.toast('تم تحديث الإعلان ✅', 'success');
            } else {
              Object.assign(payload, {
                ownerId: app.user.uid,
                ownerName: app.profile?.companyName || app.profile?.name || '',
                ownerType: app.profile?.accountType || 'individual',
                ownerVerified: app.profile?.kycStatus === 'verified',
                ownerVip: app.isSubscriptionActive(),
                views: 0,
                boostedUntil: payload.boostedUntil || 0,
                date: app.todayLocal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
              await app.db.collection('projects').add(payload);
              if (!app.hasAdminAccess()) await app.sendNotification('ADMIN', 'إعلان جديد للمراجعة 📢', payload.title);
              app.toast(app.hasAdminAccess() ? 'تم نشر الإعلان مباشرة ✅' : 'تم الإرسال لمراجعة الإدارة ✅', 'success');
            }
            document.getElementById('daman-post-modal')?.classList.add('hidden');
          } catch (err) {
            app.toast(err.message, 'error');
          }
        });
      };

      // 3. Wrap renderMarketCards to append Call / WhatsApp buttons with guard
      const origRenderCards = Proj.renderMarketCards.bind(Proj);
      Proj.renderMarketCards = (a) => {
        const html = origRenderCards(a);
        try { return this.enhanceCardsHTML(html, a || app); } catch (e) { return html; }
      };

      // 4. Wrap openPostDetails to also show Call / WhatsApp buttons inside Details modal
      const origOpenDetails = Proj.openPostDetails.bind(Proj);
      Proj.openPostDetails = (pid) => {
        origOpenDetails(pid);
        try { this.enhancePostDetailModal(pid); } catch (e) {}
      };

      if (app.activeTab === 'projects') Proj.rerender();
    }
  };

  window.DamanPostContact = PostContactGuard;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => PostContactGuard.boot(), 300));
  else setTimeout(() => PostContactGuard.boot(), 300);
})();
