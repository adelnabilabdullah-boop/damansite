(function () {
  if (!firebase.apps.length) {
    firebase.initializeApp(window.DAMAN_CONFIG.firebaseConfig);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  const savedLang = localStorage.getItem('daman_lang');
  const autoLang = (navigator.language || 'ar').toLowerCase().startsWith('ar') ? 'ar' : 'en';

  const App = {
    auth,
    db,
    user: null,
    profile: null,
    unsubProfile: null,
    unsubNotifs: null,
    notifications: [],
    appConfig: null,
    lang: savedLang || autoLang,
    activeTab: 'home',
    selectedMainCat: 'all',
    selectedGov: 'all',
    searchQuery: '',
    showAllCats: false,
    ads: window.DAMAN_DEFAULT_ADS.slice(),
    adIndex: 0,
    adTimer: null,
    dailyBanner: null,
    modules: {},

    isAdmin() {
      return !!(
        this.user &&
        this.user.email &&
        this.user.email.trim().toLowerCase() === window.DAMAN_CONFIG.adminEmail
      );
    },

    isModerator() {
      if (!this.user || !this.user.email) return false;
      const email = this.user.email.trim().toLowerCase();
      const mods = (this.appConfig && Array.isArray(this.appConfig.moderators)) ? this.appConfig.moderators : [];
      return mods.map((m) => String(m).trim().toLowerCase()).includes(email);
    },

    hasAdminAccess() {
      return this.isAdmin() || this.isModerator();
    },

    t(key) {
      const dict = window.DAMAN_I18N[this.lang] || window.DAMAN_I18N.ar;
      return dict[key] || key;
    },

    esc(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    fmtMoney(val) {
      const n = Number(val || 0);
      return n.toLocaleString(this.lang === 'ar' ? 'ar-EG' : 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    },

    toAuthEmail(identifier) {
      const raw = String(identifier || '').trim();
      if (raw.includes('@')) return raw.toLowerCase();
      const digits = raw.replace(/\D/g, '');
      if (digits.length < 8) return '';
      return `${digits}@phone.damansite.app`;
    },

    generateCode(prefix) {
      return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    },

    async sendNotification(targetUid, title, body) {
      if (!targetUid) return;
      try {
        await db.collection('notifications').add({
          userId: targetUid,
          title: String(title || ''),
          body: String(body || ''),
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.error('sendNotification error:', e);
      }
    },

    async isBlacklisted(values) {
      const clean = (values || []).map((v) => String(v || '').trim().toLowerCase()).filter((v) => v.length >= 4);
      if (!clean.length) return null;
      try {
        const snap = await db.collection('blacklist').limit(100).get();
        for (const d of snap.docs) {
          const item = d.data();
          const bv = String(item.value || '').trim().toLowerCase();
          if (bv && clean.some((c) => c === bv || c.includes(bv) || bv.includes(c))) {
            return item.reason || 'حساب مدرج بالقائمة السوداء';
          }
        }
      } catch (e) {}
      return null;
    },

    getPackages() {
      return (this.appConfig && this.appConfig.packages) || window.DAMAN_DEFAULT_PACKAGES;
    },

    getCommissionRate() {
      return (this.appConfig && Number(this.appConfig.commissionRate)) || window.DAMAN_CONFIG.commissionRate;
    },

    toast(message, type = 'info') {
      const box = document.getElementById('toast-container');
      if (!box) return;
      const colors = {
        success: 'bg-emerald-600 border-emerald-400 text-white',
        error: 'bg-rose-600 border-rose-400 text-white',
        warning: 'bg-amber-600 border-amber-400 text-white',
        info: 'bg-slate-800 border-slate-600 text-slate-100'
      };
      const el = document.createElement('div');
      el.className = `px-4 py-3 rounded-xl border shadow-xl text-xs font-bold flex items-center gap-2 transition-all duration-300 ${colors[type] || colors.info}`;
      el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i><span>${this.esc(message)}</span>`;
      box.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px)';
        setTimeout(() => el.remove(), 300);
      }, 3400);
    },

    registerModule(name, moduleObj) {
      this.modules[name] = moduleObj;
      if (this.activeTab === name) this.renderCurrentTab();
    },

    shareOnWhatsApp(title, details) {
      const url = window.location.href.split('#')[0];
      const msg = `🏗️ *ضمان سايت | DamanSite*\n📌 ${title}\n${details ? details + '\n' : ''}🔗 ${url}`;
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    },

    shareReferral() {
      if (!this.profile) return;
      const code = this.profile.referralCode || ('DMN-' + this.user.uid.slice(0, 5).toUpperCase());
      const url = window.location.href.split('#')[0];
      const msg = `🏗️ انضم لمنصة *ضمان سايت | DamanSite* للمقاولات والتوريدات والاستلام الهندسي بضمان 3 أضعاف!\n🎁 استخدم كود الدعوة الخاص بي: *${code}*\n🔗 ${url}`;
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    },

    openOfficialWhatsapp() {
      const wa = (this.appConfig && this.appConfig.supportWhatsapp) || '201030374787';
      window.open(`https://wa.me/${String(wa).replace(/[^\d]/g, '')}`, '_blank');
    },

    // ==================== CONTRACT VERIFICATION TOOL (كود التحقق من صحة العقد) ====================
    openVerifyContractModal() {
      const isAr = this.lang === 'ar';
      let modal = document.getElementById('daman-verify-contract-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-verify-contract-modal';
        modal.className = 'fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-emerald-400"><i class="fa-solid fa-qrcode me-1"></i> ${isAr ? 'التحقق من صحة عقد رسمي' : 'Verify Official Contract'}</h3>
            <button onclick="document.getElementById('daman-verify-contract-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <p class="text-[11px] text-slate-300 leading-relaxed">${isAr ? 'أدخل رقم تذكرة العقد المطبوع (مثال: TKT-482910) للتأكد من أنه عقد رسمي وموثّق على منصة ضمان سايت.' : 'Enter the contract ticket number to verify authenticity.'}</p>
          <form onsubmit="DamanApp.runContractVerify(event)" class="flex gap-1.5">
            <input id="vc-code-input" type="text" required placeholder="TKT-XXXXXX" class="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white uppercase font-bold" />
            <button type="submit" class="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black">تحقق</button>
          </form>
          <div id="vc-result-box"></div>
        </div>`;
    },

    async runContractVerify(e) {
      e.preventDefault();
      const code = (document.getElementById('vc-code-input')?.value || '').trim().toUpperCase();
      const box = document.getElementById('vc-result-box');
      if (!code || !box) return;
      box.innerHTML = `<div class="text-center py-3 text-slate-400"><i class="fa-solid fa-spinner fa-spin me-1"></i> جارٍ الفحص...</div>`;
      try {
        const snap = await db.collection('chatAgreements').where('ticketNumber', '==', code).limit(1).get();
        if (snap.empty) {
          box.innerHTML = `<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 font-bold text-center">❌ لا يوجد عقد رسمي مسجّل بهذا الرقم (${this.esc(code)})</div>`;
          return;
        }
        const a = snap.docs[0].data();
        const stMap = { proposed: 'بانتظار التفعيل', active: 'عقد ساري ونشط ✅', completed: 'عقد مكتمل ومصفّى ✅' };
        const csMap = { approved: 'العقد الموقّع معتمد من الإدارة ✅', pending_admin: 'بانتظار مراجعة الإدارة', not_uploaded: 'لم تُرفع صورة التوقيع بعد', rejected: 'مطلوب إعادة رفع صورة العقد' };
        box.innerHTML = `
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 space-y-1.5">
            <div class="font-black text-emerald-300"><i class="fa-solid fa-shield-check me-1"></i> عقد رسمي موثّق — ضمان سايت</div>
            <div class="text-white font-bold">${this.esc(a.title)}</div>
            <div class="text-[11px] text-slate-300">الطرف الأول: <b>${this.esc(a.payerName || a.otherName || '-')}</b></div>
            <div class="text-[11px] text-slate-300">الطرف الثاني: <b>${this.esc(a.createdByName || '-')}</b></div>
            <div class="text-[11px] text-amber-300">قيمة العقد: <b>${this.fmtMoney(a.totalAmount)} ج.م</b> | التغطية: <b>${a.coveragePercent || 0}%</b></div>
            <div class="text-[10px] text-sky-300 font-bold">الحالة: ${stMap[a.status] || a.status} • ${csMap[a.contractStatus] || ''}</div>
          </div>`;
      } catch (err) {
        box.innerHTML = `<div class="p-2.5 rounded-xl bg-rose-500/15 text-rose-300 text-center">تعذر الفحص: يرجى تسجيل الدخول أولاً</div>`;
      }
    },

    // ==================== PROMO CODE & REFERRAL REDEMPTION ====================
    async redeemPromoCodePrompt() {
      if (!this.user || !this.profile) return this.openAuthModal('login');
      const code = (window.prompt('أدخل كود الهدية أو الخصم (Promo Code):', '') || '').trim().toUpperCase();
      if (!code) return;

      const promoRef = db.collection('promoCodes').doc(code);
      const userRef = db.collection('users').doc(this.user.uid);

      try {
        let rewardText = '';
        await db.runTransaction(async (tx) => {
          const [pDoc, uDoc] = await Promise.all([tx.get(promoRef), tx.get(userRef)]);
          if (!pDoc.exists) throw new Error('كود الهدية غير صحيح أو منتهي الصلاحية');
          const pr = pDoc.data();
          if (pr.active === false) throw new Error('هذا الكود غير نشط حالياً');
          if (Number(pr.usedCount || 0) >= Number(pr.maxUses || 0)) throw new Error('تم استنفاد الحد الأقصى لاستخدام هذا الكود');
          const usedBy = Array.isArray(pr.usedBy) ? pr.usedBy : [];
          if (usedBy.includes(this.user.uid)) throw new Error('لقد استخدمت هذا الكود من قبل');

          const u = uDoc.data() || {};
          const val = Number(pr.value || 0);
          if (pr.rewardType === 'balance') {
            tx.update(userRef, { balanceAvailable: Math.round((Number(u.balanceAvailable || 0) + val) * 100) / 100 });
            rewardText = `تم إضافة ${this.fmtMoney(val)} ج.م رصيد هدية إلى محفظتك!`;
          } else {
            const isComp = pr.rewardType === 'plan_company';
            const exp = new Date(Date.now() + val * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const pName = isComp ? 'باقة الشركات (كود هدية)' : 'باقة الأفراد VIP (كود هدية)';
            tx.update(userRef, {
              activePlanKey: isComp ? 'company' : 'individual',
              activePlanName: pName,
              activePlanExpires: exp
            });
            rewardText = `تم تفعيل ${pName} مجاناً لمدة ${val} يوماً حتى ${exp}!`;
          }
          tx.update(promoRef, {
            usedCount: firebase.firestore.FieldValue.increment(1),
            usedBy: firebase.firestore.FieldValue.arrayUnion(this.user.uid)
          });
        });

        await this.sendNotification(this.user.uid, `مبروك! تم تفعيل كود الهدية ${code} 🎁`, rewardText);
        this.toast(rewardText, 'success');
      } catch (err) {
        this.toast(err.message, 'error');
      }
    },

    revealPhoneWithAdvice(phone, ownerName) {
      if (!this.user) {
        this.toast(this.lang === 'ar' ? 'سجّل الدخول أولاً لإظهار رقم الهاتف والتواصل' : 'Sign in first to view phone number', 'warning');
        return this.openAuthModal('login');
      }
      const isAr = this.lang === 'ar';
      let modal = document.getElementById('daman-phone-advice-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-phone-advice-modal';
        modal.className = 'fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      const cleanPhone = String(phone || '').replace(/[^\d+]/g, '');
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-extrabold text-amber-400"><i class="fa-solid fa-phone-volume me-1"></i> ${isAr ? 'بيانات التواصل' : 'Contact Details'}</h3>
            <button onclick="document.getElementById('daman-phone-advice-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-[11px] text-amber-200 leading-relaxed">
            <div class="font-extrabold text-amber-300 mb-1"><i class="fa-solid fa-shield-halved me-1"></i> ${isAr ? 'نصيحة ضمان سايت الهامة:' : 'DamanSite Safety Advice:'}</div>
            ${isAr
              ? 'تواصل بحرية، لكن لحماية حقك المالي والهندسي، اجعل التعاقد وحجز الدفعات داخل محفظة الضمان (3.5%) واطبع العقد نسختين وارفع النسخة الموقّعة داخل الشات.'
              : 'Communicate freely, but keep contracts and payments inside DamanSite 3.5% Escrow and upload the signed contract in chat.'}
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
            <div class="text-xs text-slate-400">${this.esc(ownerName || '')}</div>
            <div class="text-lg font-black text-emerald-400 tracking-wider" dir="ltr">${this.esc(phone || '-')}</div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <a href="tel:${cleanPhone}" class="py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs text-center"><i class="fa-solid fa-phone me-1"></i> ${isAr ? 'اتصال مباشر' : 'Call Now'}</a>
            <a href="https://wa.me/${cleanPhone.replace(/^0/, '20')}" target="_blank" class="py-2.5 rounded-xl bg-green-600 text-white font-black text-xs text-center"><i class="fa-brands fa-whatsapp me-1"></i> ${isAr ? 'واتساب' : 'WhatsApp'}</a>
          </div>
        </div>`;
    },

    async openPublicProfile(uid, fallbackData = {}) {
      const isAr = this.lang === 'ar';
      let modal = document.getElementById('daman-public-profile-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-public-profile-modal';
        modal.className = 'fixed inset-0 z-[65] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      modal.innerHTML = `<div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center text-xs text-slate-300"><i class="fa-solid fa-spinner fa-spin text-amber-400 text-xl mb-2"></i><div>${isAr ? 'جارٍ تحميل الملف والتقييمات...' : 'Loading profile...'}</div></div>`;

      let uData = Object.assign({}, fallbackData);
      let reviews = [];
      let posts = [];

      if (uid && !String(uid).startsWith('demo_')) {
        try {
          const [uSnap, rSnap, pSnap] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('reviews').where('targetUserId', '==', uid).limit(20).get(),
            db.collection('projects').where('clientId', '==', uid).limit(15).get()
          ]);
          if (uSnap.exists) uData = Object.assign(uData, uSnap.data());
          reviews = rSnap.docs.map((d) => d.data());
          posts = pSnap.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((p) => p.status !== 'pending_review');
        } catch (e) {
          console.error('openPublicProfile error:', e);
        }
      } else if (fallbackData.demoReviews) {
        reviews = fallbackData.demoReviews;
        posts = fallbackData.demoPosts || [];
      }

      const avg = Number(uData.ratingAvg || 0);
      const count = Number(uData.ratingCount || reviews.length || 0);
      const stars = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
      const displayName = uData.companyName || uData.name || (isAr ? 'مستخدم ضمان سايت' : 'DamanSite User');

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 max-h-[90vh] overflow-y-auto space-y-3.5">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center text-lg font-black">
                ${this.esc(displayName.charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h3 class="text-sm font-black text-white truncate">${this.esc(displayName)}</h3>
                  ${uData.kycStatus === 'verified' ? `<i class="fa-solid fa-circle-check text-sky-400 text-xs"></i>` : ''}
                  ${uData.activePlanName ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">VIP</span>` : ''}
                </div>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">${this.getRoleLabel(uData.accountType)}</span>
                  <span class="text-xs text-amber-400">${stars} <span class="text-[10px] text-slate-400">(${avg.toFixed(1)} / ${count})</span></span>
                </div>
              </div>
            </div>
            <button onclick="document.getElementById('daman-public-profile-modal').classList.add('hidden')" class="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 shrink-0"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${uData.commercialReg ? `<div class="text-[11px] text-sky-300 bg-sky-500/10 border border-sky-500/30 px-3 py-1.5 rounded-xl"><i class="fa-solid fa-building-shield me-1"></i> ${isAr ? 'سجل تجاري:' : 'CR:'} ${this.esc(uData.commercialReg)}</div>` : ''}

          <div class="grid grid-cols-2 gap-2">
            ${uData.phone ? `<button onclick="DamanApp.revealPhoneWithAdvice('${this.esc(uData.phone)}','${this.esc(displayName).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs"><i class="fa-solid fa-phone me-1"></i> ${isAr ? 'إظهار الهاتف' : 'Show Phone'}</button>` : ''}
            <button onclick="DamanApp.openChatWith('${this.esc(uid || 'admin')}','${this.esc(displayName).replace(/'/g, "\\'")}')" class="py-2 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 font-extrabold text-xs ${!uData.phone ? 'col-span-2' : ''}"><i class="fa-solid fa-comments me-1"></i> ${isAr ? 'مراسلة واتفاق' : 'Chat & Deal'}</button>
          </div>

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-amber-400"><i class="fa-solid fa-star me-1"></i> ${isAr ? 'التقييمات والمراجعات' : 'Reviews'} (${reviews.length})</h4>
            ${!reviews.length
              ? `<div class="text-center text-[11px] text-slate-400 py-3 bg-slate-950/60 rounded-xl">${isAr ? 'لا توجد تقييمات مكتوبة بعد' : 'No reviews yet'}</div>`
              : reviews.map((r) => `
                  <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div class="flex items-center justify-between text-[11px]">
                      <span class="font-bold text-white">${this.esc(r.fromName || 'عميل ضمان سايت')}</span>
                      <span class="text-amber-400">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</span>
                    </div>
                    <p class="text-[11px] text-slate-300">${this.esc(r.comment || '')}</p>
                  </div>`).join('')}
          </div>

          <div class="space-y-2">
            <h4 class="text-xs font-extrabold text-white"><i class="fa-solid fa-bullhorn text-emerald-400 me-1"></i> ${isAr ? 'المنشورات والعروض' : 'Posts'} (${posts.length})</h4>
            ${!posts.length
              ? `<div class="text-center text-[11px] text-slate-400 py-3 bg-slate-950/60 rounded-xl">${isAr ? 'لا توجد منشورات سابقة' : 'No posts'}</div>`
              : posts.map((p) => `
                  <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-white truncate">${this.esc(p.title)}</div>
                      <div class="text-[10px] text-slate-400">${this.esc(p.location || '')}</div>
                    </div>
                    <span class="text-[11px] font-black text-emerald-400 shrink-0">${this.fmtMoney(p.budget || p.contractAmount)} ${this.t('egp')}</span>
                  </div>`).join('')}
          </div>
        </div>`;
    },

    openChatWith(targetUid, targetName, projectId = '', projectTitle = '') {
      const m = document.getElementById('daman-public-profile-modal');
      if (m) m.classList.add('hidden');
      if (window.DamanChat && typeof window.DamanChat.openDirectChat === 'function') {
        window.DamanChat.openDirectChat(targetUid, targetName, projectId, projectTitle);
      } else {
        this.switchTab('chat');
      }
    },

    openEditProfileModal() {
      if (!this.user || !this.profile) return;
      const isAr = this.lang === 'ar';
      const p = this.profile;
      let modal = document.getElementById('daman-edit-profile-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'daman-edit-profile-modal';
        modal.className = 'fixed inset-0 z-[65] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      const isBiz = p.accountType === 'company' || p.accountType === 'supplier';
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-extrabold text-amber-400"><i class="fa-solid fa-user-pen me-1"></i> ${isAr ? 'تعديل بيانات الحساب' : 'Edit Profile'}</h3>
            <button onclick="document.getElementById('daman-edit-profile-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanApp.saveProfileEdit(event)" class="space-y-2.5">
            <input id="ep-name" type="text" required value="${this.esc(p.name || '')}" placeholder="${isAr ? 'الاسم الكامل' : 'Full Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="ep-phone" type="tel" required value="${this.esc(p.phone || '')}" placeholder="${isAr ? 'رقم الهاتف' : 'Phone Number'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="ep-email-disp" type="email" value="${this.esc(p.contactEmail || (p.email && !p.email.endsWith('@phone.damansite.app') ? p.email : ''))}" placeholder="${isAr ? 'البريد الإلكتروني للتواصل (Gmail)' : 'Contact Email'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            ${isBiz ? `<input id="ep-comp" type="text" value="${this.esc(p.companyName || '')}" placeholder="${isAr ? 'اسم الشركة / المورّد' : 'Company / Supplier Name'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />` : ''}
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'حفظ التعديلات' : 'Save Changes'}</button>
          </form>
        </div>`;
    },

    async saveProfileEdit(e) {
      e.preventDefault();
      if (!this.user) return;
      const patch = {
        name: document.getElementById('ep-name').value.trim(),
        phone: document.getElementById('ep-phone').value.trim(),
        contactEmail: document.getElementById('ep-email-disp').value.trim().toLowerCase()
      };
      const compEl = document.getElementById('ep-comp');
      if (compEl) patch.companyName = compEl.value.trim();
      try {
        await db.collection('users').doc(this.user.uid).update(patch);
        document.getElementById('daman-edit-profile-modal').classList.add('hidden');
        this.toast(this.lang === 'ar' ? 'تم تحديث بيانات حسابك بنجاح' : 'Profile updated', 'success');
      } catch (err) {
        this.toast(err.message, 'error');
      }
    },

    async forgotPasswordPrompt() {
      const isAr = this.lang === 'ar';
      const val = window.prompt(
        isAr
          ? 'أدخل بريدك الإلكتروني (Gmail) لإرسال رابط استعادة كلمة السر مجاناً:\n(لو مسجّل برقم الموبايل فقط، تواصل مع الإدارة لإعادة تعيينها)'
          : 'Enter your Gmail address for a free password reset link:',
        ''
      );
      if (!val || !val.trim()) return;
      if (!val.includes('@')) {
        return this.toast(isAr ? 'لاستعادة كلمة سر حساب برقم الموبايل فقط، تواصل مع الدعم الفني أو الإدارة' : 'For phone-only accounts, contact Admin', 'warning');
      }
      try {
        await auth.sendPasswordResetEmail(val.trim());
        this.toast(isAr ? 'تم إرسال رابط استعادة كلمة السر على بريدك الإلكتروني بنجاح' : 'Password reset email sent', 'success');
      } catch (err) {
        this.toast(err.message, 'error');
      }
    },

    applyLanguage() {
      const html = document.documentElement;
      html.lang = this.lang;
      html.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      localStorage.setItem('daman_lang', this.lang);
      const langBtn = document.getElementById('lang-btn-text');
      if (langBtn) langBtn.textContent = this.lang === 'ar' ? 'EN' : 'عربي';
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = this.t(el.getAttribute('data-i18n'));
      });
    },

    toggleLanguage() {
      this.lang = this.lang === 'ar' ? 'en' : 'ar';
      this.applyLanguage();
      this.renderHeaderState();
      this.renderCurrentTab();
    },

    async loadAppConfig(force = false) {
      const cacheKey = 'daman_app_config_v7';
      if (!force) {
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (cached && Date.now() - cached.ts < 3 * 60 * 1000) {
            this.appConfig = cached.data;
            this.applyAppConfig();
            return;
          }
        } catch (e) {}
      }
      try {
        const snap = await db.collection('settings').doc('appConfig').get();
        this.appConfig = snap.exists ? snap.data() : {};
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: this.appConfig }));
      } catch (e) {
        this.appConfig = {};
      }
      this.applyAppConfig();
    },

    applyAppConfig() {
      if (this.appConfig && Array.isArray(this.appConfig.ads) && this.appConfig.ads.length) {
        this.ads = this.appConfig.ads.filter((a) => a.active !== false);
      } else {
        this.ads = window.DAMAN_DEFAULT_ADS.slice();
      }
      this.checkDailyNotification();
      this.startAdAutoplay();
      this.renderHeaderState();
      this.renderCurrentTab();
    },

    checkDailyNotification() {
      const pool =
        this.appConfig && Array.isArray(this.appConfig.dailyNotifs) && this.appConfig.dailyNotifs.length
          ? this.appConfig.dailyNotifs
          : window.DAMAN_DAILY_NOTIFS;
      if (!pool.length) return;
      const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % pool.length;
      const todayItem = pool[dayIndex];
      const dismissedDay = localStorage.getItem('daman_daily_dismissed_day');
      const todayKey = new Date().toISOString().slice(0, 10);
      if (dismissedDay !== todayKey) this.dailyBanner = todayItem;
    },

    dismissDailyBanner() {
      this.dailyBanner = null;
      localStorage.setItem('daman_daily_dismissed_day', new Date().toISOString().slice(0, 10));
      if (this.activeTab === 'home') this.renderHome();
    },

    init() {
      this.applyLanguage();
      this.loadAppConfig();
      this.bindAuthForms();

      auth.onAuthStateChanged((user) => {
        this.user = user;
        if (this.unsubProfile) { this.unsubProfile(); this.unsubProfile = null; }
        if (this.unsubNotifs) { this.unsubNotifs(); this.unsubNotifs = null; }

        if (!user) {
          this.profile = null;
          this.notifications = [];
          this.renderHeaderState();
          this.renderCurrentTab();
          return;
        }

        this.unsubProfile = db.collection('users').doc(user.uid).onSnapshot(
          (snap) => {
            if (!snap.exists) {
              this.openOnboardingModal();
              return;
            }
            this.profile = Object.assign({ uid: user.uid }, snap.data());

            // Auto-assign referralCode for existing accounts that don't have one
            if (!this.profile.referralCode) {
              const code = this.generateCode('DMN');
              db.collection('users').doc(user.uid).update({ referralCode: code }).catch(() => {});
              this.profile.referralCode = code;
            }

            this.closeModal('onboarding-modal');
            this.closeModal('auth-modal');
            this.renderHeaderState();
            this.renderCurrentTab();

            if (this.profile.kycStatus === 'unverified' && !this.hasAdminAccess() && !sessionStorage.getItem('daman_kyc_prompted')) {
              sessionStorage.setItem('daman_kyc_prompted', '1');
              setTimeout(() => {
                if (window.DamanWallet && typeof window.DamanWallet.openKycModal === 'function') {
                  window.DamanWallet.openKycModal();
                }
              }, 700);
            }
          },
          (err) => console.error('Profile error:', err)
        );

        const targets = this.hasAdminAccess() ? [user.uid, 'ALL', 'ADMIN'] : [user.uid, 'ALL'];
        this.unsubNotifs = db
          .collection('notifications')
          .where('userId', 'in', targets)
          .limit(35)
          .onSnapshot(
            (snap) => {
              this.notifications = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              this.renderNotifBadge();
            },
            () => {}
          );
      });

      this.renderHeaderState();
      this.renderCurrentTab();
    },

    startAdAutoplay() {
      if (this.adTimer) clearInterval(this.adTimer);
      this.adTimer = setInterval(() => {
        if (this.activeTab === 'home' && this.ads.length > 1) {
          this.adIndex = (this.adIndex + 1) % this.ads.length;
          const wrap = document.getElementById('home-ad-slider');
          if (wrap) wrap.innerHTML = this.buildAdSlideHtml();
        }
      }, 4500);
    },

    stepAd(delta) {
      if (!this.ads.length) return;
      this.adIndex = (this.adIndex + delta + this.ads.length) % this.ads.length;
      const wrap = document.getElementById('home-ad-slider');
      if (wrap) wrap.innerHTML = this.buildAdSlideHtml();
    },

    renderNotifBadge() {
      const lastBroadcastSeen = Number(localStorage.getItem('daman_last_bc_seen') || 0);
      const unread = this.notifications.filter((n) => {
        if (n.userId === 'ALL') return (n.createdAt?.seconds || 0) > lastBroadcastSeen;
        return !n.read;
      }).length;
      const badge = document.getElementById('notif-badge');
      if (!badge) return;
      if (unread > 0) {
        badge.textContent = unread > 9 ? '9+' : unread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    },

    renderHeaderState() {
      const adminBtn = document.getElementById('header-admin-btn');
      const authBtn = document.getElementById('header-auth-btn');
      const notifBtn = document.getElementById('header-notif-btn');

      if (adminBtn) adminBtn.classList.toggle('hidden', !this.hasAdminAccess());
      if (authBtn) authBtn.classList.toggle('hidden', !!this.user);
      if (notifBtn) notifBtn.classList.toggle('hidden', !this.user);

      document.querySelectorAll('.nav-btn').forEach((btn) => {
        const t = btn.getAttribute('data-tab');
        btn.classList.toggle('text-amber-400', t === this.activeTab);
        btn.classList.toggle('text-slate-400', t !== this.activeTab);
      });
    },

    switchTab(tab) {
      if (tab === 'admin' && !this.hasAdminAccess()) {
        this.toast(this.lang === 'ar' ? 'صلاحية الإدارة مقصورة على مدير المنصة والمشرفين فقط' : 'Admin access restricted', 'error');
        return;
      }
      this.activeTab = tab;
      this.renderHeaderState();
      this.renderCurrentTab();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    openCategory(catId) {
      this.selectedMainCat = catId;
      this.switchTab('projects');
    },

    handleHomeSearch(e) {
      e.preventDefault();
      const inp = document.getElementById('home-search-input');
      this.searchQuery = inp ? inp.value.trim() : '';
      this.selectedMainCat = 'all';
      this.switchTab('projects');
    },

    toggleShowAllCats() {
      this.showAllCats = !this.showAllCats;
      this.renderHome();
    },

    renderCurrentTab() {
      const main = document.getElementById('app-main');
      if (!main) return;

      // Global Maintenance Mode Gate (Admins bypass it; logged-out admins can still sign in)
      if (this.appConfig && this.appConfig.maintenanceMode && !this.hasAdminAccess()) {
        main.innerHTML = `
          <div class="p-6 text-center mt-10 bg-slate-900 border border-amber-500/50 rounded-2xl space-y-3">
            <i class="fa-solid fa-screwdriver-wrench text-4xl text-amber-400"></i>
            <h2 class="text-base font-black text-white">التطبيق في وضع الصيانة والتحديث</h2>
            <p class="text-xs text-slate-300 leading-relaxed">${this.esc(this.appConfig.maintenanceMsg || 'نقوم بتحديثات لتحسين الخدمة، سنعود خلال دقائق.')}</p>
            <div class="flex justify-center gap-2 pt-2">
              <button onclick="DamanApp.openOfficialWhatsapp()" class="px-4 py-2 rounded-xl bg-green-600 text-white font-bold text-xs"><i class="fa-brands fa-whatsapp me-1"></i>واتساب الدعم</button>
              ${!this.user ? `<button onclick="DamanApp.openAuthModal('login')" class="px-4 py-2 rounded-xl bg-slate-800 text-amber-300 font-bold text-xs">دخول الإدارة</button>` : ''}
            </div>
          </div>`;
        return;
      }

      if (this.profile && this.profile.status === 'banned' && !this.isAdmin()) {
        main.innerHTML = `
          <div class="p-6 text-center mt-10 bg-rose-950/50 border border-rose-500/40 rounded-2xl space-y-3">
            <i class="fa-solid fa-ban text-4xl text-rose-400"></i>
            <h2 class="text-lg font-extrabold text-white">${this.lang === 'ar' ? 'تم إيقاف الحساب' : 'Account Suspended'}</h2>
            <p class="text-xs text-slate-300 leading-relaxed">${this.t('frozenNotice')}</p>
            <div class="flex justify-center gap-2">
              <button onclick="DamanApp.openOfficialWhatsapp()" class="px-4 py-2 rounded-xl bg-green-600 text-xs font-bold text-white">تواصل مع الإدارة</button>
              <button onclick="DamanApp.logout()" class="px-5 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white">${this.t('logout')}</button>
            </div>
          </div>`;
        return;
      }

      if (this.activeTab === 'home') return this.renderHome();
      if (this.activeTab === 'about') return this.renderAbout();
      if (this.activeTab === 'profile') return this.renderProfile();

      const mod = this.modules[this.activeTab];
      if (mod && typeof mod.render === 'function') {
        mod.render(main, this);
      } else {
        this.renderPhasePlaceholder(main, this.activeTab);
      }
    },

    buildAdSlideHtml() {
      const ad = this.ads[this.adIndex] || this.ads[0];
      if (!ad) return '';
      const isAr = this.lang === 'ar';
      const badge = isAr ? (ad.badgeAr || ad.badge || 'إعلان مميز') : (ad.badgeEn || ad.badgeAr || 'Featured');
      const title = isAr ? (ad.titleAr || ad.title) : (ad.titleEn || ad.titleAr);
      const desc = isAr ? (ad.descAr || ad.desc) : (ad.descEn || ad.descAr);
      const grad = ad.gradient || 'from-amber-600 via-orange-600 to-amber-800';
      const clickAttr = ad.linkUrl
        ? `window.open('${this.esc(ad.linkUrl)}','_blank')`
        : `DamanApp.switchTab('${this.esc(ad.actionTab || 'projects')}')`;

      return `
        <div onclick="${clickAttr}" class="relative overflow-hidden rounded-2xl p-4 cursor-pointer bg-gradient-to-br ${grad} border border-white/15 shadow-lg min-h-[138px] flex flex-col justify-between">
          ${ad.imageBase64 ? `<img src="${ad.imageBase64}" class="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none" />` : ''}
          <div class="relative z-10 flex items-center justify-between">
            <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-black/40 text-amber-200 border border-white/15">${this.esc(badge)}</span>
            <div class="flex items-center gap-1" onclick="event.stopPropagation()">
              <button onclick="DamanApp.stepAd(-1)" class="w-6 h-6 rounded-full bg-black/35 text-white text-[10px] flex items-center justify-center"><i class="fa-solid fa-chevron-${isAr ? 'right' : 'left'}"></i></button>
              <button onclick="DamanApp.stepAd(1)" class="w-6 h-6 rounded-full bg-black/35 text-white text-[10px] flex items-center justify-center"><i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'}"></i></button>
            </div>
          </div>
          <div class="relative z-10 mt-2">
            <h3 class="text-sm font-black text-white leading-snug">${this.esc(title)}</h3>
            <p class="text-[11px] text-white/90 mt-1 leading-relaxed line-clamp-2">${this.esc(desc)}</p>
          </div>
          <div class="relative z-10 flex justify-center gap-1.5 mt-3">
            ${this.ads.map((_, idx) => `<span class="h-1.5 rounded-full transition-all ${idx === this.adIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}"></span>`).join('')}
          </div>
        </div>`;
    },

    renderHome() {
      const main = document.getElementById('app-main');
      const isAr = this.lang === 'ar';
      const catsToShow = this.showAllCats ? window.DAMAN_CATEGORIES : window.DAMAN_CATEGORIES.slice(0, 8);
      const g3xDesc = (this.appConfig && this.appConfig.guarantee3xText) ||
        'نستلم الشدات، الأسقف، المحارة، التشطيبات، أو نمسك مشروعك كامل استشارات وإشراف هندسي بضمان مادي 3 أضعاف القيمة.';

      const dailyHtml = this.dailyBanner
        ? `
          <div class="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 flex items-start justify-between gap-2">
            <div class="flex items-start gap-2">
              <i class="fa-solid fa-bell text-amber-400 mt-0.5"></i>
              <div>
                <div class="text-[11px] font-black text-amber-300">${this.esc(this.dailyBanner.title)}</div>
                <div class="text-[11px] text-slate-200 leading-snug mt-0.5">${this.esc(this.dailyBanner.body)}</div>
              </div>
            </div>
            <button onclick="DamanApp.dismissDailyBanner()" class="text-slate-400 hover:text-white text-xs"><i class="fa-solid fa-xmark"></i></button>
          </div>`
        : '';

      const userCard = this.profile
        ? `
          <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-extrabold text-white truncate">${this.esc(this.profile.companyName || this.profile.name)}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">${this.getRoleLabel(this.profile.accountType)}</span>
                ${this.profile.kycStatus === 'verified' ? `<i class="fa-solid fa-circle-check text-sky-400 text-xs"></i>` : ''}
                ${this.profile.activePlanName ? `<span class="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black"><i class="fa-solid fa-crown me-0.5"></i>${this.esc(this.profile.activePlanName)}</span>` : ''}
              </div>
              <div class="flex items-center gap-3 mt-1 text-[11px]">
                <span class="text-emerald-400 font-bold">${this.t('availableBal')}: ${this.fmtMoney(this.profile.balanceAvailable)} ${this.t('egp')}</span>
                <span class="text-amber-300 font-bold">${this.t('escrowBal')}: ${this.fmtMoney(this.profile.balanceEscrow)} ${this.t('egp')}</span>
              </div>
            </div>
            <button onclick="DamanApp.switchTab('wallet')" class="shrink-0 px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-wallet"></i></button>
          </div>`
        : `
          <div class="glass-card rounded-2xl p-3.5 flex items-center justify-between gap-2">
            <div>
              <h2 class="text-xs font-black text-white">${isAr ? 'أهلاً بك في ضمان سايت' : 'Welcome to DamanSite'}</h2>
              <p class="text-[10px] text-slate-400 mt-0.5">${isAr ? 'استلام هندسي بضمان 3 أضعاف • مقاولات وموردين B2B • نظام HR' : '3x Engineering Guarantee • B2B Suppliers • HR & Escrow'}</p>
            </div>
            <button onclick="DamanApp.openAuthModal('register')" class="shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${this.t('loginBtn')}</button>
          </div>`;

      main.innerHTML = `
        <div class="space-y-4">
          ${dailyHtml}
          ${userCard}

          <form onsubmit="DamanApp.handleHomeSearch(event)" class="relative">
            <input id="home-search-input" type="search" value="${this.esc(this.searchQuery)}"
              placeholder="${isAr ? 'ابحث في 24 قسم ومورّدين (مثال: شدة، أسمنت، محارة، التجمع...)' : 'Search 24 sectors, suppliers, companies...'}"
              class="w-full ps-10 pe-16 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 focus:border-amber-500 outline-none text-xs text-white" />
            <i class="fa-solid fa-magnifying-glass text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 text-xs"></i>
            <button type="submit" class="absolute top-1/2 -translate-y-1/2 end-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]">${isAr ? 'بحث' : 'Go'}</button>
          </form>

          <!-- Highlighted 3x Engineering Guarantee Card -->
          <div onclick="DamanApp.switchTab('about')" class="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/70 via-slate-900 to-slate-950 border border-emerald-500/50 cursor-pointer space-y-2 shadow-lg">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950"><i class="fa-solid fa-shield-halved me-1"></i>${isAr ? 'ضمان مادي 3 أضعاف القيمة (3x)' : '3x Financial Guarantee'}</span>
              <span class="text-[10px] text-emerald-300 font-bold">${isAr ? 'التفاصيل والطلب ←' : 'Details →'}</span>
            </div>
            <h3 class="text-sm font-black text-white leading-snug">${isAr ? 'استلام هندسي استشاري لشداتك وأسقفك ومحارتك بضمان مادي 3 أضعاف!' : 'Consultant Engineering Handover with 3x Warranty!'}</h3>
            <p class="text-[11px] text-slate-300 leading-relaxed">${this.esc(g3xDesc)}</p>
          </div>

          <div id="home-ad-slider">${this.buildAdSlideHtml()}</div>

          <!-- Quick Services Grid (5 Shortcuts including Suppliers & Verify Contract) -->
          <div class="grid grid-cols-4 gap-2">
            <button onclick="if(window.DamanProjects) DamanProjects.setPostTypeFilter('supplier'); DamanApp.switchTab('projects')" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-amber-500/50">
              <span class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center"><i class="fa-solid fa-boxes-stacked"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${isAr ? 'الموردين B2B' : 'Suppliers'}</span>
            </button>
            <button onclick="DamanApp.switchTab('company')" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-sky-500/50">
              <span class="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center"><i class="fa-solid fa-users-gear"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${isAr ? 'الشركات وHR' : 'HR & Teams'}</span>
            </button>
            <button onclick="DamanApp.openVerifyContractModal()" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-emerald-500/50">
              <span class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><i class="fa-solid fa-qrcode"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${isAr ? 'فحص عقد' : 'Verify Deal'}</span>
            </button>
            <button onclick="DamanApp.switchTab('chat')" class="glass-card rounded-xl p-2.5 flex flex-col items-center gap-1.5 hover:border-purple-500/50">
              <span class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center"><i class="fa-solid fa-robot"></i></span>
              <span class="text-[10px] font-bold text-slate-200 text-center">${this.t('aiSupport')}</span>
            </button>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-black text-white">${this.t('mainCategories')}</h3>
              <button onclick="DamanApp.toggleShowAllCats()" class="text-[11px] font-extrabold text-amber-400">
                ${this.showAllCats ? (isAr ? 'عرض أقل' : 'Show Less') : (isAr ? 'عرض كل الـ 24 قسم' : 'View All 24')}
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              ${catsToShow.map((cat) => `
                <button onclick="DamanApp.openCategory('${cat.id}')" class="glass-card rounded-2xl p-3 flex items-center gap-2.5 text-start hover:border-amber-500/50 transition-all">
                  <span class="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br ${cat.color} text-white flex items-center justify-center text-sm shadow">
                    <i class="fa-solid ${cat.icon}"></i>
                  </span>
                  <span class="text-[11px] font-extrabold text-white leading-snug">${isAr ? cat.ar : cat.en}</span>
                </button>`).join('')}
            </div>
            ${!this.showAllCats ? `
              <button onclick="DamanApp.toggleShowAllCats()" class="w-full mt-2.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 text-xs font-extrabold">
                <i class="fa-solid fa-angles-down me-1"></i> ${isAr ? 'إظهار باقي الأقسام (16 قسم إضافي)' : 'Show Remaining 16 Sectors'}
              </button>` : ''}
          </div>
        </div>`;
    },

    renderAbout() {
      const main = document.getElementById('app-main');
      const isAr = this.lang === 'ar';
      main.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-2xl p-5 bg-gradient-to-br from-emerald-900/60 via-slate-900 to-slate-950 border border-emerald-500/40 text-center space-y-2">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center text-2xl shadow-lg">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
            <h2 class="text-base font-black text-white">${isAr ? 'ضمان سايت — استلام هندسي 3x وضمان تعاملات B2B' : 'DamanSite — 3x Engineering & B2B Escrow'}</h2>
            <p class="text-xs text-slate-300 leading-relaxed">${this.esc((this.appConfig && this.appConfig.guarantee3xText) || 'نستلم الشدات، الأسقف، المحارة، التشطيبات، أو ندير مشروعك بالكامل بضمان مادي يصل إلى 3 أضعاف قيمة الخدمة، مع حماية كاملة لتعاملات المقاولين والشركات والموردين.')}</p>
            <div class="flex justify-center gap-2 pt-1">
              <button onclick="if(window.DamanProjects) DamanProjects.setSubTab('inspection'); DamanApp.switchTab('projects');" class="px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs">اطلب استلام 3x</button>
              <button onclick="DamanApp.openOfficialWhatsapp()" class="px-4 py-2.5 rounded-xl bg-green-600 text-white font-black text-xs"><i class="fa-brands fa-whatsapp me-1"></i>واتساب الدعم</button>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-4 space-y-2.5 text-xs text-slate-300 leading-relaxed">
            <h3 class="text-sm font-black text-amber-400"><i class="fa-solid fa-scale-balanced me-1"></i> بنود وقواعد العمل الرسمية في ضمان سايت:</h3>
            <p>• <b>الضمان المادي 3 أضعاف (3x):</b> يغطي البنود الهندسية المستلمة والمعتمدة من مهندسي ضمان سايت بتعويض يصل لـ 3 أضعاف قيمة الخدمة.</p>
            <p>• <b>الضمان المالي (3.5% Escrow):</b> يحمي تعاملات المقاولات واليوميات والرواتب وتوريدات الموردين (B2B) بحجز المبلغ حتى الاستلام الفعلي.</p>
            <p>• <b>العقد المطبوع نسختين:</b> يُطبع العقد A4 بكود التحقق الرسمي نسختين ويوقّع الطرفان وتُرفع صورته داخل الشات لاعتماده من الإدارة.</p>
            <p>• <b>التأكيد اليومي ووقف العمل الأوتوماتيك:</b> تأكيد الحضور الفعلي للعمالة يومياً، وعند عدم كفاية التغطية يصدر إشعار وقف عمل تلقائي لحين الشحن.</p>
            <p>• <b>الرقابة وجودة التعامل:</b> المحادثات والمكالمات (المحتفظ بتسجيلها 30 يوماً) خاضعة لمراجعة إدارة ضمان سايت عند اللزوم لحل النزاعات وحفظ الحقوق.</p>
          </div>
          <button onclick="DamanApp.switchTab('home')" class="w-full py-3 rounded-xl bg-slate-800 text-xs font-extrabold text-white">العودة للرئيسية</button>
        </div>`;
    },

    renderProfile() {
      const main = document.getElementById('app-main');
      if (!this.user || !this.profile) {
        main.innerHTML = `
          <div class="glass-card rounded-2xl p-6 text-center mt-6 space-y-3">
            <i class="fa-solid fa-user-shield text-4xl text-amber-400"></i>
            <h3 class="text-base font-extrabold text-white">${this.lang === 'ar' ? 'سجّل الدخول لإدارة حسابك' : 'Sign in to manage your profile'}</h3>
            <button onclick="DamanApp.openAuthModal('login')" class="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs">${this.t('loginBtn')}</button>
          </div>`;
        return;
      }

      const p = this.profile;
      const isAr = this.lang === 'ar';
      const stars = '★'.repeat(Math.round(p.ratingAvg || 0)) + '☆'.repeat(5 - Math.round(p.ratingAvg || 0));
      const refCode = p.referralCode || ('DMN-' + this.user.uid.slice(0, 5).toUpperCase());

      main.innerHTML = `
        <div class="space-y-4">
          <div class="glass-card rounded-2xl p-4 space-y-3">
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center text-xl font-black">
                ${this.esc((p.companyName || p.name || 'U').charAt(0).toUpperCase())}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h3 class="text-sm font-extrabold text-white truncate">${this.esc(p.companyName || p.name)}</h3>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">${this.getRoleLabel(p.accountType)}</span>
                </div>
                <p class="text-[11px] text-slate-400 truncate mt-0.5">${this.esc(p.phone || '')} ${p.contactEmail || (p.email && !p.email.endsWith('@phone.damansite.app')) ? '• ' + this.esc(p.contactEmail || p.email) : ''}</p>
                <div class="flex items-center gap-2 mt-1 text-xs flex-wrap">
                  <span class="text-amber-400">${stars}</span>
                  <span class="text-[10px] text-slate-400">(${p.ratingCount || 0})</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full ${p.kycStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'}">
                    ${p.kycStatus === 'verified' ? this.t('verified') : p.kycStatus === 'pending' ? this.t('pendingKyc') : this.t('unverified')}
                  </span>
                </div>
              </div>
            </div>

            ${p.activePlanName ? `
              <div class="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 flex items-center justify-between text-xs font-bold text-amber-300">
                <span><i class="fa-solid fa-crown me-1"></i> ${this.esc(p.activePlanName)}</span>
                <span class="text-[10px] text-slate-200">${isAr ? 'حتى' : 'Until'} ${this.esc(p.activePlanExpires || '')}</span>
              </div>` : ''}

            <div class="grid grid-cols-2 gap-2">
              <button onclick="DamanApp.openPublicProfile('${this.user.uid}')" class="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-amber-300"><i class="fa-solid fa-eye me-1"></i> صفحتي العامة</button>
              <button onclick="DamanApp.openEditProfileModal()" class="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-sky-300"><i class="fa-solid fa-user-pen me-1"></i> تعديل بياناتي</button>
            </div>
          </div>

          <!-- Referral & Promo Code Card -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-emerald-500/30">
            <div class="flex items-center justify-between text-xs">
              <div>
                <div class="text-[10px] text-slate-400">كود الدعوة الخاص بك (شارك التطبيق واكسب مكافآت):</div>
                <div class="text-sm font-black text-emerald-400 tracking-wider">${this.esc(refCode)} <span class="text-[10px] text-slate-400 font-normal">(${p.referralsCount || 0} دعوة)</span></div>
              </div>
              <button onclick="DamanApp.shareReferral()" class="px-3 py-1.5 rounded-xl bg-green-600 text-white font-black text-[10px]"><i class="fa-brands fa-whatsapp me-1"></i>دعوة</button>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <button onclick="DamanApp.redeemPromoCodePrompt()" class="py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 font-black text-[11px]"><i class="fa-solid fa-gift me-1"></i>تفعيل كود هدية</button>
              <button onclick="DamanApp.openVerifyContractModal()" class="py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-black text-[11px]"><i class="fa-solid fa-qrcode me-1"></i>التحقق من عقد</button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div class="glass-card rounded-xl p-3 text-center"><div class="text-[10px] text-slate-400">${this.t('availableBal')}</div><div class="text-xs font-extrabold text-emerald-400 mt-1">${this.fmtMoney(p.balanceAvailable)}</div></div>
            <div class="glass-card rounded-xl p-3 text-center"><div class="text-[10px] text-slate-400">${this.t('escrowBal')}</div><div class="text-xs font-extrabold text-amber-400 mt-1">${this.fmtMoney(p.balanceEscrow)}</div></div>
            <div class="glass-card rounded-xl p-3 text-center"><div class="text-[10px] text-slate-400">${this.t('heldBal')}</div><div class="text-xs font-extrabold text-rose-400 mt-1">${this.fmtMoney(p.balanceHeld)}</div></div>
          </div>

          <div class="glass-card rounded-2xl divide-y divide-slate-800 overflow-hidden">
            <button onclick="DamanApp.switchTab('company')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-white hover:bg-slate-800/60">
              <span class="flex items-center gap-2.5"><i class="fa-solid fa-building-shield text-sky-400 w-4"></i>لوحة الشركات ونظام الـ HR والرواتب</span>
              <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'} text-slate-500"></i>
            </button>
            ${this.hasAdminAccess() ? `
              <button onclick="DamanApp.switchTab('admin')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-amber-400 hover:bg-slate-800/60">
                <span class="flex items-center gap-2.5"><i class="fa-solid fa-crown w-4"></i>${this.isAdmin() ? 'لوحة الإدارة العليا (Super Admin)' : 'لوحة المشرف (Moderator)'}</span>
                <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'} text-slate-500"></i>
              </button>` : ''}
            <button onclick="DamanApp.openOfficialWhatsapp()" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-emerald-400 hover:bg-slate-800/60">
              <span class="flex items-center gap-2.5"><i class="fa-brands fa-whatsapp w-4"></i>واتساب الدعم الرسمي</span>
              <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'} text-slate-500"></i>
            </button>
            <button onclick="DamanApp.switchTab('about')" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-white hover:bg-slate-800/60">
              <span class="flex items-center gap-2.5"><i class="fa-solid fa-shield-halved text-emerald-400 w-4"></i>خدمات الضمان 3x وبنود العمل</span>
              <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'} text-slate-500"></i>
            </button>
            <button onclick="DamanApp.logout()" class="w-full p-3.5 flex items-center justify-between text-xs font-bold text-rose-400 hover:bg-rose-950/30">
              <span class="flex items-center gap-2.5"><i class="fa-solid fa-right-from-bracket w-4"></i>${this.t('logout')}</span>
            </button>
          </div>
        </div>`;
    },

    renderPhasePlaceholder(container, tabName) {
      container.innerHTML = `<div class="glass-card rounded-2xl p-6 text-center mt-6 text-xs text-slate-400">${tabName}</div>`;
    },

    getRoleLabel(type) {
      if (type === 'contractor') return this.t('roleContractor');
      if (type === 'company') return this.t('roleCompany');
      if (type === 'supplier') return this.lang === 'ar' ? 'مورّد خامات ومعدات' : 'Supplier (B2B)';
      return this.t('roleClient');
    },

    openModal(id) { document.getElementById(id)?.classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id)?.classList.add('hidden'); },
    openAuthModal(mode = 'login') { this.setAuthMode(mode); this.openModal('auth-modal'); },

    setAuthMode(mode) {
      const loginForm = document.getElementById('login-form');
      const regForm = document.getElementById('register-form');
      const tLogin = document.getElementById('tab-login-btn');
      const tReg = document.getElementById('tab-reg-btn');
      if (mode === 'register') {
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
        tReg.className = 'flex-1 py-2 text-xs font-extrabold rounded-lg bg-amber-500 text-slate-950';
        tLogin.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-400';
      } else {
        regForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        tLogin.className = 'flex-1 py-2 text-xs font-extrabold rounded-lg bg-amber-500 text-slate-950';
        tReg.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-400';
      }
    },

    toggleCompanyFields(selectId, boxId) {
      const sel = document.getElementById(selectId);
      const box = document.getElementById(boxId);
      if (sel && box) {
        const show = sel.value === 'company' || sel.value === 'supplier';
        box.classList.toggle('hidden', !show);
      }
    },

    openOnboardingModal() {
      const nameInput = document.getElementById('ob-name');
      if (nameInput && this.user) nameInput.value = this.user.displayName || '';
      this.openModal('onboarding-modal');
    },

    openNotifications() {
      const list = document.getElementById('notif-list');
      localStorage.setItem('daman_last_bc_seen', String(Math.floor(Date.now() / 1000)));
      if (list) {
        if (!this.notifications.length) {
          list.innerHTML = `<div class="text-center text-xs text-slate-400 py-8">${this.lang === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}</div>`;
        } else {
          list.innerHTML = this.notifications
            .map((n) => `
              <div class="p-3 rounded-xl ${n.read ? 'bg-slate-900/60' : 'bg-amber-500/10 border border-amber-500/30'}">
                <div class="text-xs font-bold text-white">${this.esc(n.title || '')}</div>
                <div class="text-[11px] text-slate-300 mt-0.5 leading-relaxed">${this.esc(n.body || '')}</div>
              </div>`)
            .join('');
          this.notifications
            .filter((n) => !n.read && n.userId !== 'ALL')
            .forEach((n) => db.collection('notifications').doc(n.id).update({ read: true }).catch(() => {}));
        }
      }
      this.renderNotifBadge();
      this.openModal('notifications-modal');
    },

    bindAuthForms() {
      // Inject 4th Role: "Supplier (مورّد خامات ومعدات)" into both role dropdowns automatically
      ['reg-role', 'ob-role'].forEach((id) => {
        const sel = document.getElementById(id);
        if (sel && !sel.querySelector('option[value="supplier"]')) {
          const opt = document.createElement('option');
          opt.value = 'supplier';
          opt.textContent = this.lang === 'ar' ? 'مورّد خامات ومعدات (B2B)' : 'Materials & Equipment Supplier';
          sel.appendChild(opt);
        }
      });

      const loginEmail = document.getElementById('login-email');
      if (loginEmail) {
        loginEmail.type = 'text';
        loginEmail.placeholder = this.lang === 'ar' ? 'رقم الموبايل أو البريد الإلكتروني (Gmail)' : 'Phone Number or Email';
      }
      const regEmail = document.getElementById('reg-email');
      if (regEmail) {
        regEmail.type = 'text';
        regEmail.placeholder = this.lang === 'ar' ? 'البريد الإلكتروني (Gmail) أو رقم الموبايل' : 'Email or Phone Number';
      }

      const loginForm = document.getElementById('login-form');
      if (loginForm) {
        if (!document.getElementById('daman-forgot-btn')) {
          const btn = document.createElement('button');
          btn.id = 'daman-forgot-btn';
          btn.type = 'button';
          btn.className = 'w-full text-center text-[11px] text-amber-400 font-bold pt-1 hover:underline';
          btn.textContent = this.lang === 'ar' ? 'نسيت كلمة السر؟' : 'Forgot Password?';
          btn.onclick = () => this.forgotPasswordPrompt();
          loginForm.appendChild(btn);
        }

        loginForm.onsubmit = async (e) => {
          e.preventDefault();
          const authEmail = this.toAuthEmail(document.getElementById('login-email').value);
          if (!authEmail) return this.toast('أدخل رقم موبايل أو بريد إلكتروني صحيح', 'error');
          try {
            await auth.signInWithEmailAndPassword(authEmail, document.getElementById('login-pass').value);
            this.toast('تم تسجيل الدخول بنجاح', 'success');
          } catch (err) {
            this.toast(err.message, 'error');
          }
        };
      }

      const regForm = document.getElementById('register-form');
      if (regForm) {
        // Inject optional Referral Code field
        if (!document.getElementById('reg-ref-code')) {
          const refInp = document.createElement('input');
          refInp.id = 'reg-ref-code';
          refInp.type = 'text';
          refInp.placeholder = 'كود الدعوة من صديق (اختياري - مثل DMN-1234)';
          refInp.className = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white uppercase';
          const subBtn = regForm.querySelector('button[type="submit"]');
          if (subBtn) regForm.insertBefore(refInp, subBtn);
        }

        regForm.onsubmit = async (e) => {
          e.preventDefault();
          if (this.appConfig && this.appConfig.disableRegistration) {
            return this.toast('التسجيل الجديد متوقف مؤقتاً من قِبل الإدارة', 'warning');
          }
          const rawId = document.getElementById('reg-email').value.trim();
          const phoneVal = document.getElementById('reg-phone').value.trim();
          const authEmail = this.toAuthEmail(rawId || phoneVal);
          if (!authEmail) return this.toast('أدخل بريد إلكتروني أو رقم موبايل صحيح', 'error');

          const accountType = document.getElementById('reg-role').value;
          const isBiz = accountType === 'company' || accountType === 'supplier';
          const crVal = isBiz ? (document.getElementById('reg-company-cr')?.value.trim() || '') : '';
          const invitedByCode = (document.getElementById('reg-ref-code')?.value || '').trim().toUpperCase();

          // Blacklist Check before creating account
          const blReason = await this.isBlacklisted([phoneVal, rawId, crVal]);
          if (blReason) return this.toast('لا يمكن إنشاء الحساب: ' + blReason, 'error');

          try {
            const cred = await auth.createUserWithEmailAndPassword(authEmail, document.getElementById('reg-pass').value);
            await db.collection('users').doc(cred.user.uid).set({
              uid: cred.user.uid,
              email: authEmail,
              contactEmail: rawId.includes('@') ? rawId.toLowerCase() : '',
              name: document.getElementById('reg-name').value.trim(),
              phone: phoneVal,
              accountType,
              companyName: isBiz ? (document.getElementById('reg-company-name')?.value.trim() || '') : '',
              commercialReg: crVal,
              companyCode: isBiz ? this.generateCode('CMP') : '',
              referralCode: this.generateCode('DMN'),
              invitedByCode,
              referralsCount: 0,
              kycStatus: 'unverified',
              status: 'active',
              balanceAvailable: 0,
              balanceEscrow: 0,
              balanceHeld: 0,
              ratingAvg: 0,
              ratingCount: 0,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (invitedByCode) {
              db.collection('users').where('referralCode', '==', invitedByCode).limit(1).get().then((snap) => {
                if (!snap.empty) {
                  const inviter = snap.docs[0];
                  db.collection('users').doc(inviter.id).update({ referralsCount: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
                  this.sendNotification(inviter.id, 'مبروك! سجّل مستخدم جديد بكود دعوتك 🎉', 'تم احتساب دعوة جديدة في حسابك.');
                }
              }).catch(() => {});
            }

            this.toast('تم إنشاء الحساب! يرجى استكمال التوثيق الإلزامي الآن', 'success');
          } catch (err) {
            this.toast(err.message, 'error');
          }
        };
      }

      const obForm = document.getElementById('onboarding-form');
      if (obForm) {
        obForm.onsubmit = async (e) => {
          e.preventDefault();
          if (!this.user) return;
          const accountType = document.getElementById('ob-role').value;
          const isBiz = accountType === 'company' || accountType === 'supplier';
          const phoneVal = document.getElementById('ob-phone').value.trim();
          const crVal = isBiz ? (document.getElementById('ob-company-cr')?.value.trim() || '') : '';

          const blReason = await this.isBlacklisted([phoneVal, this.user.email, crVal]);
          if (blReason) return this.toast('لا يمكن استكمال الحساب: ' + blReason, 'error');

          try {
            await db.collection('users').doc(this.user.uid).set({
              uid: this.user.uid,
              email: (this.user.email || '').toLowerCase(),
              contactEmail: (this.user.email || '').toLowerCase(),
              name: document.getElementById('ob-name').value.trim(),
              phone: phoneVal,
              accountType,
              companyName: isBiz ? (document.getElementById('ob-company-name')?.value.trim() || '') : '',
              commercialReg: crVal,
              companyCode: isBiz ? this.generateCode('CMP') : '',
              referralCode: this.generateCode('DMN'),
              referralsCount: 0,
              kycStatus: 'unverified',
              status: 'active',
              balanceAvailable: 0,
              balanceEscrow: 0,
              balanceHeld: 0,
              ratingAvg: 0,
              ratingCount: 0,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.toast('تم حفظ بياناتك! يرجى استكمال التوثيق الإلزامي', 'success');
          } catch (err) {
            this.toast(err.message, 'error');
          }
        };
      }
    },

    async googleSignIn() {
      if (this.appConfig && this.appConfig.disableRegistration) {
        this.toast('تنبيه: التسجيل الجديد متوقف مؤقتاً للمستخدمين الجدد', 'info');
      }
      try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (err) {
        this.toast(err.message, 'error');
      }
    },

    async logout() {
      await auth.signOut();
      sessionStorage.removeItem('daman_kyc_prompted');
      this.activeTab = 'home';
      this.toast(this.lang === 'ar' ? 'تم تسجيل الخروج' : 'Signed out', 'info');
    }
  };

  window.DamanApp = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
