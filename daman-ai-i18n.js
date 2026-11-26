(function () {
  const AiI18nMod = {
    _booted: false,
    _obs: null,
    _timer: null,
    _translating: false,
    _origTextMap: new WeakMap(),
    _aiHistory: [],
    _aiUnmatchedCount: 0,
    _lastAdminChatMsgId: '',

    esc(str) {
      if (window.DamanApp && typeof DamanApp.esc === 'function') return DamanApp.esc(str);
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    norm(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, '')
        .replace(/[^\u0600-\u06FFa-z0-9\s%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    isEn() {
      return !!(window.DamanApp && window.DamanApp.lang === 'en');
    },

    // ==================== 1. CLIENT-SIDE AI ASSISTANT + ADMIN ESCALATION ====================
    getLiveFacts() {
      const app = window.DamanApp || {};
      const cfg = app.appConfig || {};
      const commPct = typeof app.getCommissionRate === 'function' ? (app.getCommissionRate() * 100).toFixed(1) : '3.5';
      const vipPct = typeof app.getVipCommissionRate === 'function' ? (app.getVipCommissionRate() * 100).toFixed(0) : '10';
      const minDep = Number(cfg.minDeposit || 100);
      const minWd = Number(cfg.minWithdraw || 100);
      const maxWd = Number(cfg.maxWithdrawDaily || 50000);
      const sla = window.DamanWalletSLA?.slaConfig?.durationText || 'يوم عمل واحد (24 ساعة عمل)';
      const mins = Number(cfg.depositSessionMinutes || 10);
      return { commPct, vipPct, minDep, minWd, maxWd, sla, mins };
    },

    buildAiKnowledge() {
      const f = this.getLiveFacts();
      return [
        {
          id: 'escalate',
          escalate: true,
          keys: ['موظف', 'بشري', 'اداره', 'الاداره', 'اكلم حد', 'خدمه عملاء', 'دعم فني', 'شكوي', 'مشكله كبيره', 'مسئول', 'تواصل مباشر', 'human', 'agent', 'admin', 'support', 'manager', 'complaint'],
          ar: 'أكيد! يمكنك التحدث مع إدارة ضمان سايت مباشرة الآن — اضغط على زر «👨‍💼 تحويل المحادثة للإدارة البشرية» بالأسفل وسيتم فتح الشات المباشر مع الإدارة وإرسال استفسارك لهم فوراً.',
          en: 'Sure! You can speak directly with DamanSite Management now — tap the "👨‍💼 Transfer to Human Admin" button below to open live chat and notify our team immediately.'
        },
        {
          id: 'greeting',
          keys: ['سلام', 'اهلا', 'مرحبا', 'ازيك', 'صباح', 'مساء', 'الو', 'هاي', 'hello', 'hi', 'hey', 'welcome'],
          ar: 'أهلاً بك في ضمان سايت! 👋 أنا المساعد الذكي للمنصة، جاهز أجاوبك فوراً على أي سؤال يخص المحفظة، الإيداع والسحب، العقود والضمان المالي، التوثيق، الاستلام الهندسي 3x، عمالة VIP، السوق، أو الشركات. اكتب سؤالك أو اختر من الأزرار السريعة بالأسفل.',
          en: 'Welcome to DamanSite! 👋 I am your smart assistant. Ask me anything about the wallet, deposits/withdrawals, escrow contracts, KYC verification, 3x inspection, VIP labor, marketplace, or companies.'
        },
        {
          id: 'deposit',
          keys: ['ايداع', 'شحن', 'اشحن', 'انستا', 'انستاباي', 'فودافون', 'محفظه', 'تحويل بنكي', 'رقم مرجعي', 'ايصال', 'عداد', 'deposit', 'topup', 'instapay', 'vodafone', 'receipt'],
          ar: `💰 **طريقة الإيداع وشحن المحفظة:**\n1. افتح تبويب «المحفظة» ← اضغط **إيداع**.\n2. اختر الوسيلة المتاحة (محافظ كاش / إنستا باي / تحويل بنكي) وستظهر لك بيانات الحساب النشط وعداد **${f.mins} دقائق**.\n3. حوّل المبلغ (الحد الأدنى **${f.minDep} ج.م**) من حساب مسجّل **باسمك الشخصي فقط**.\n4. ارفع صورة الإيصال (والرقم المرجعي اختياري).\n⏱️ مدة المراجعة وإضافة الرصيد: **${f.sla}**.`,
          en: `💰 **How to Deposit:**\n1. Open **Wallet** → tap **Deposit**.\n2. Choose an enabled channel (Cash Wallet / InstaPay / Bank Transfer) to view active details with a **${f.mins}-min** timer.\n3. Transfer from an account registered **in your own name only** (min **${f.minDep} EGP**).\n4. Upload the receipt screenshot (reference number is optional).\n⏱️ Processing SLA: **1 business day (24 working hours)**.`
        },
        {
          id: 'withdraw',
          keys: ['سحب', 'اسحب', 'فلوسي', 'سحب بنك', 'iban', 'ايبان', 'سحب كاش', 'مدة السحب', 'withdraw', 'payout', 'cashout', 'bank'],
          ar: `💸 **طريقة السحب من المحفظة:**\n1. من تبويب «المحفظة» ← اضغط **سحب**.\n2. اختر الوسيلة (محفظة إلكترونية / إنستا باي / تحويل بنكي بـ IBAN).\n3. الحد الأدنى للسحب **${f.minWd} ج.م** والحد اليومي **${f.maxWd.toLocaleString('en-US')} ج.م** (من الرصيد الكاش المتاح فقط).\n🛡️ شرط إلزامي: الحساب المستلم يجب أن يكون **باسم صاحب الحساب بالبطاقة فقط**.\n⏱️ مدة التحويل: **${f.sla}**، ويمكنك إلغاء الطلب قبل اعتماده.`,
          en: `💸 **How to Withdraw:**\n1. Open **Wallet** → tap **Withdraw**.\n2. Select your channel (E-Wallet / InstaPay / Bank Transfer IBAN).\n3. Min withdrawal: **${f.minWd} EGP**, daily limit: **${f.maxWd.toLocaleString('en-US')} EGP** (available cash balance only).\n🛡️ Mandatory rule: Receiving account must be registered **in your verified legal name**.\n⏱️ Processing SLA: **1 business day**.`
        },
        {
          id: 'same_owner',
          keys: ['نفس الاسم', 'شخص اخر', 'حساب غيري', 'اخويا', 'مراتي', 'صاحبي', 'اسم صاحب الحساب', 'same owner', 'another person'],
          ar: '🛡️ **شرط نفس صاحب الحساب (قاعدة أمان إلزامية):**\nجميع عمليات الإيداع والسحب يجب أن تتم من وإلى محفظة أو حساب إنستا باي أو حساب بنكي مسجّل **باسمك الشخصي المطابق للبطاقة** فقط. أي تحويل من أو إلى حساب طرف ثالث يُرفض تلقائياً حمايةً لأموالك ومنعاً للاحتيال.',
          en: '🛡️ **Same-Owner Rule:** All deposits and withdrawals must be made from/to a wallet, InstaPay, or bank account registered strictly in your verified legal name. Third-party transfers are rejected for fraud protection.'
        },
        {
          id: 'kyc',
          keys: ['توثيق', 'بطاقه', 'سيلفي', 'سجل تجاري', 'ضريبيه', 'هويه', 'رقم قومي', 'kyc', 'verify', 'verification', 'national id'],
          ar: '🪪 **توثيق الحساب (KYC):**\nلتفعيل الإيداع والسحب ونشر الإعلانات وتوقيع العقود الرسمية، افتح **المحفظة** أو **صفحتي** ← اضغط **توثيق الحساب**، وارفع صور (وش البطاقة + ضهر البطاقة + سيلفي واضح) — وللشركات والموردين يُضاف السجل التجاري والبطاقة الضريبية. تراجعه الإدارة وتعتمد بياناتك القانونية.',
          en: '🪪 **Account Verification (KYC):**\nTo unlock deposits, withdrawals, ads, and escrow contracts, go to **Wallet** or **Profile** → **Verify Account**, upload Front ID, Back ID, and a clear Selfie (plus Commercial Reg / Tax Card for companies).'
        },
        {
          id: 'name_change',
          keys: ['تعديل الاسم', 'تغيير الاسم', 'اغير اسمي', 'اسم التطبيق', 'اسم البطاقه', 'change name', 'display name', 'rename'],
          ar: '✏️ **تعديل الاسم الظاهر بالتطبيق:**\nيمكنك تعديل اسمك الظاهر للمستخدمين في أي وقت من تبويب **«صفحتي»** ← زر **«✏️ طلب تعديل الاسم الظاهر»**.\n• يُرسل الاسم الجديد لمراجعة الإدارة أولاً، وبمجرد الموافقة يتحدث فوراً.\n• اسمك القانوني الرباعي/الخماسي بالبطاقة يظل محفوظاً لدى الإدارة لضمان دقة التحويلات والعقود.',
          en: '✏️ **Changing Display Name:**\nYou can request a new display name anytime from **Profile** → **"Request Display Name Change"**. It goes to Admin review first; once approved it updates immediately while keeping your legal ID name secured for transfers & contracts.'
        },
        {
          id: 'escrow_contracts',
          keys: ['عقد', 'عقود', 'ضمان مالي', 'عموله', 'حجز', 'مستخلص', 'دفعه', 'توقيع', 'مخالصه', 'escrow', 'contract', 'commission', 'milestone'],
          ar: `🛡️ **العقود الرسمية والضمان المالي:**\n1. اتفق مع الطرف الآخر داخل **الشات** وأنشئ عقد ضمان مالي بالمواصفات والمواعيد والمبلغ.\n2. يتم حجز قيمة العقد 100% بأمان داخل المنصة (عمولة الضمان المالي **${f.commPct}%**).\n3. يوقّع الطرفان ويرفعان العقد الموقّع لاعتماده من الإدارة، ثم تُصرف الدفعات/المستخلصات بعد الاستلام.\n4. يمكنك طباعة العقد رسمياً بصيغة A4 مع رمز **QR** للتحقق الفوري.`,
          en: `🛡️ **Escrow Contracts:**\n1. Agree inside **Chat** and create an official Escrow Contract with scope, dates, and amount.\n2. 100% of funds are safely locked in escrow (platform fee **${f.commPct}%**).\n3. Sign & upload for Admin approval, then release milestones upon handover.\n4. Print official A4 contracts with instant **QR** verification.`
        },
        {
          id: 'verify_qr',
          keys: ['فحص عقد', 'كود العقد', 'تحقق', 'qr', 'باركود', 'كاميرا', 'تكت', 'tkt', 'verify contract', 'scan'],
          ar: '🔍 **فحص والتحقق من أي عقد رسمي:**\nمن أسفل الشاشة الرئيسية اضغط على كارت **«فحص عقد رسمي»** — يمكنك مسح رمز **QR** بالكاميرا مباشرة أو كتابة رقم العقد (`TKT-...`) للتأكد من صحته وحالته والدخول لصفحة العقد.',
          en: '🔍 **Verify Official Contract:**\nTap **"Verify Official Contract"** at the bottom of the Home screen to scan the contract **QR** via camera or enter the contract code (`TKT-...`) to verify authenticity and view details.'
        },
        {
          id: 'inspection_3x',
          keys: ['استلام', '3x', 'سقف', 'شده', 'حداده', 'صب', 'مهندس', 'تقرير هندسي', 'ثلاث اضعاف', '3 اضعاف', 'inspection', 'engineer'],
          ar: '🏗️ **الاستلام الهندسي بضمان 3 أضعاف (3x):**\nمن تبويب **السوق ← استلام 3x** اختر البند (مثل باقة 3 زيارات استلام سقف: خامات + شدة وحدادة + إشراف صب) واكتب العنوان والمساحة والتاريخ. تسعّره الإدارة وتدفع من المحفظة ليصلك المهندس ويرفع لك تقريراً هندسياً معتمداً بضمان مادي 3 أضعاف.',
          en: '🏗️ **3x Engineering Inspection:**\nGo to **Market → 3x Inspection**, select the inspection scope, site address, area, and preferred date. Once quoted by Admin, pay from your wallet to confirm the site visit and receive an official engineering report with 3x warranty.'
        },
        {
          id: 'vip_labor',
          keys: ['عماله', 'عمالة', 'vip', 'صنايعي', 'نجار', 'حداد', 'بناء', 'محاره', 'توريد عمال', 'labor', 'workers'],
          ar: `👷 **توريد عمالة VIP بضمان المنصة:**\nمن تبويب **السوق ← عمالة VIP** حدّد التخصص، عدد العمال، عدد الأيام، الوردية، والموقع. تقوم الإدارة بتسعير الطلب (عمولة ضمان VIP **${f.vipPct}%**) وبعد موافقتك يُحجز المبلغ بالضمان حتى إتمام العمل بنجاح.`,
          en: `👷 **VIP Verified Labor:**\nGo to **Market → VIP Labor**, specify trade, worker count, days, shift, and location. Admin sends a quote (${f.vipPct}% VIP warranty fee) and funds stay locked in escrow until work completion.`
        },
        {
          id: 'posts_market',
          keys: ['منشور', 'اعلان', 'نشر', 'حذف', 'امسح', 'تعديل اعلان', 'تمييز', 'باقه', 'السوق', 'مرفوض', 'post', 'ad', 'delete', 'edit', 'boost', 'market'],
          ar: '📢 **نشر وتعديل وحذف وتمييز الإعلانات:**\n• **النشر:** من تبويب «السوق» ← **+ نشر** (يُرسل لمراجعة الإدارة ثم يُنشر فور الموافقة).\n• **التعديل:** يمكنك تعديل إعلانك في أي وقت، ويعود تلقائياً لمراجعة الإدارة قبل نشره مجدداً.\n• **الحذف:** يمكنك حذف إعلانك نهائياً في أي وقت من زرار **حذف** على الإعلان.\n• **التمييز:** يمكنك اختيار باقة تمييز (فضي / ذهبي / ماسي VIP) لتثبيت إعلانك أعلى السوق والرئيسية.',
          en: '📢 **Marketplace Ads (Post / Edit / Delete / Boost):**\n• **Post:** Go to **Market** → **+ Post** (reviewed by Admin before going live).\n• **Edit:** Editing an ad sends it back for quick Admin review.\n• **Delete:** Delete your ad permanently anytime via the **Delete** button.\n• **Boost:** Choose Silver, Gold, or Diamond VIP packages to pin your ad at the top.'
        },
        {
          id: 'company',
          keys: ['شركه', 'شركات', 'موظف', 'حضور', 'انصراف', 'gps', 'رواتب', 'مرتب', 'عهده', 'دفتر الموقع', 'يوميات', 'company', 'payroll', 'attendance', 'ledger'],
          ar: '🏢 **إدارة الشركات ودفتر الموقع:**\n• **الشركات:** أنشئ شركتك، أضف الموظفين والمواقع، تابع الحضور والانصراف بالـ GPS، العُهد، الإضافي، والمرتبات مع كشوف A4.\n• **دفتر الموقع:** من **السوق ← دفتر الموقع** سجّل يوميات العمال والسلف والخصومات والعُهد واطبع كشف تصفية A4 بضغطة واحدة.',
          en: '🏢 **Company Panel & Site Ledger:**\n• **Companies:** Manage sites, employees, GPS attendance, custody, overtime, and payroll.\n• **Site Ledger:** Go to **Market → Site Ledger** to record daily wages, advances, deductions, and print A4 settlement sheets.'
        },
        {
          id: 'dispute',
          keys: ['نزاع', 'تحكيم', 'نصب', 'خلاف', 'مش عايز يدفع', 'بلاغ', 'ابلاغ', 'تجميد', 'حظر', 'dispute', 'report', 'scam', 'freeze', 'ban'],
          ar: '⚖️ **النزاعات والتحكيم والبلاغات:**\n• لو حدث خلاف في عقد مضمون، افتح **نزاع** من داخل العقد في الشات، وستفحص الإدارة العقد والمحادثات والمرفقات وتفصل فيه بالعدل.\n• للإبلاغ عن أي إعلان أو مستخدم مخالف اضغط أيقونة العلم (🚩) على الإعلان أو صفحته.',
          en: '⚖️ **Disputes & Reports:**\n• For any conflict on an active escrow contract, open a **Dispute** from the contract view so Admin can arbitrate based on evidence and chat logs.\n• Use the flag icon (🚩) on any listing or profile to report violations.'
        },
        {
          id: 'lang_cache',
          keys: ['انجليزي', 'لغه', 'عربي', 'تحديث', 'كاش', 'مهنج', 'لوجو', 'english', 'language', 'cache', 'update', 'bug'],
          ar: '🌐 **اللغة والتحديث:**\n• لتبديل اللغة بين العربية والإنجليزية اضغط زر **EN / AR** في الشريط العلوي.\n• لو لاحظت أي تأخر في تحميل نسخة جديدة، اعمل إعادة تحميل للصفحة أو امسح الكاش من إعدادات المتصفح.',
          en: '🌐 **Language & Updates:**\n• Tap **EN / AR** in the top header to switch languages anytime.\n• Refresh the page if a new update banner appears.'
        }
      ];
    },

    generateAiReply(userMsg) {
      const q = this.norm(userMsg);
      const en = this.isEn();
      if (!q) {
        return {
          text: en ? 'Please write your question clearly.' : 'اكتب سؤالك بوضوح وسأساعدك فوراً.',
          escalate: false
        };
      }

      const kb = this.buildAiKnowledge();
      let best = null;
      let bestScore = 0;

      for (const item of kb) {
        let score = 0;
        for (const kw of item.keys) {
          const nkw = this.norm(kw);
          if (!nkw) continue;
          if (q === nkw) score += 6;
          else if (q.includes(nkw)) score += nkw.length >= 4 ? 3 : 2;
        }
        if (score > bestScore) {
          bestScore = score;
          best = item;
        }
      }

      if (best && bestScore >= 2) {
        if (best.escalate) {
          this._aiUnmatchedCount = 0;
          return { text: en ? best.en : best.ar, escalate: true };
        }
        this._aiUnmatchedCount = 0;
        return { text: en ? best.en : best.ar, escalate: false };
      }

      this._aiUnmatchedCount += 1;
      return {
        text: en
          ? 'I could not find an exact automatic answer for this specific request. Tap **"👨‍💼 Transfer to Human Admin"** below and your message will be forwarded directly to DamanSite Management!'
          : 'لم أجد إجابة آلية دقيقة لهذا الاستفسار تحديداً، والأفضل أن تتابعه مع الإدارة مباشرة. اضغط على زر **«👨‍💼 تحويل المحادثة للإدارة البشرية الآن»** بالأسفل وسيتم فتح الشات المباشر مع الإدارة وإبلاغهم بسؤالك فوراً.',
        escalate: true
      };
    },

    async escalateToHumanAdmin(customSummary = '') {
      const app = window.DamanApp;
      const modal = document.getElementById('daman-ai-support-modal');
      if (modal) modal.classList.add('hidden');

      const lastUserMsg =
        customSummary ||
        [...this._aiHistory].reverse().find((m) => m.role === 'user')?.text ||
        'استفسار محوّل من المساعد الذكي';

      if (!app || !app.user) {
        app?.toast(this.isEn() ? 'Please log in to chat directly with Admin' : 'سجّل الدخول أولاً للتحدث مباشرة مع إدارة المنصة', 'warning');
        return app?.openAuthModal?.('login');
      }

      await app.sendNotification(
        'ADMIN',
        '🤖 طلب تحويل من المساعد الذكي للإدارة',
        `${app.profile?.name || 'مستخدم'} (${app.profile?.phone || ''}): ${lastUserMsg.slice(0, 140)}`
      ).catch(() => {});

      if (window.DamanChat && typeof DamanChat.openDirectChat === 'function') {
        DamanChat.openDirectChat('admin', 'إدارة ضمان سايت', '', `🤖 محوّل من المساعد الذكي: ${lastUserMsg.slice(0, 90)}`);
        app.toast(this.isEn() ? 'Connected to Human Admin ✅' : 'تم تحويلك لشات الإدارة البشرية وإبلاغهم فوراً ✅', 'success');
      } else {
        app.switchTab('chat');
      }
    },

    renderAiMessages() {
      const box = document.getElementById('daman-ai-msgs');
      if (!box) return;
      const en = this.isEn();

      const formatText = (txt) => this.esc(txt).replace(/\*\*([^*]+)\*\*/g, '<b class="text-amber-300">$1</b>').replace(/\n/g, '<br/>');

      box.innerHTML = this._aiHistory.map((m) => `
        <div class="flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[88%] p-2.5 rounded-2xl text-[11.5px] leading-relaxed space-y-2 ${
            m.role === 'user'
              ? 'bg-amber-500 text-slate-950 font-bold rounded-ee-sm'
              : 'bg-slate-800/95 border border-sky-500/35 text-slate-100 rounded-es-sm'
          }">
            ${m.role === 'ai' ? `<div class="text-[9.5px] font-black text-sky-300 flex items-center gap-1"><i class="fa-solid fa-robot"></i><span>${en ? 'DamanSite AI Assistant' : 'مساعد ضمان سايت الذكي (AI)'}</span></div>` : ''}
            <div>${formatText(m.text)}</div>
            ${m.escalate ? `
              <button type="button" onclick="DamanAiI18n.escalateToHumanAdmin()" class="w-full py-2 px-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-headset"></i>
                <span>${en ? 'Transfer to Human Admin Now' : '👨‍💼 تحويل المحادثة للإدارة البشرية الآن'}</span>
              </button>` : ''}
          </div>
        </div>`).join('');

      box.scrollTop = box.scrollHeight;
    },

    askAiQuick(qText) {
      const inp = document.getElementById('daman-ai-input');
      if (inp) inp.value = qText;
      this.handleAiSubmit(null, qText);
    },

    handleAiSubmit(e, presetText = '') {
      if (e) e.preventDefault();
      const inp = document.getElementById('daman-ai-input');
      const txt = (presetText || inp?.value || '').trim();
      if (!txt) return;
      if (inp) inp.value = '';

      this._aiHistory.push({ role: 'user', text: txt, escalate: false });
      const res = this.generateAiReply(txt);
      this._aiHistory.push({ role: 'ai', text: res.text, escalate: !!res.escalate });
      this.renderAiMessages();
    },

    openAiModal(initialQuestion = '') {
      const en = this.isEn();
      let m = document.getElementById('daman-ai-support-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-ai-support-modal';
        m.className = 'daman-modal fixed inset-0 z-[96] bg-black/92 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'aiSupport' }, ''); } catch (e) {}

      if (!this._aiHistory.length) {
        this._aiHistory.push({
          role: 'ai',
          text: en
            ? 'Welcome to DamanSite AI Support! 🤖 Ask me anything about deposits, withdrawals, escrow contracts, 3x inspection, VIP labor, verification, or listings. You can also transfer to Human Admin anytime.'
            : 'أهلاً بك في الدعم الذكي لمنصة ضمان سايت! 🤖 اسألني عن أي حاجة (الإيداع والسحب، العقود والضمان، التوثيق، تعديل الاسم، الاستلام 3x، عمالة VIP، الإعلانات أو الشركات) وهجاوبك فوراً — وتقدر تحوّل المحادثة للإدارة البشرية في أي لحظة.',
          escalate: false
        });
      }

      const quickTopics = en
        ? ['How to deposit?', 'How to withdraw?', 'Escrow & fees', 'Verify account KYC', 'Change display name', '3x Inspection', 'Post / delete ad']
        : ['طريقة الإيداع', 'طريقة السحب', 'العقود والعمولة', 'توثيق الحساب', 'تعديل الاسم', 'الاستلام 3x', 'نشر وحذف إعلان'];

      m.innerHTML = `
        <div class="w-full max-w-md h-[88vh] bg-slate-900 border-2 border-sky-500/50 rounded-3xl p-3.5 flex flex-col gap-2.5 text-xs shadow-2xl">
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-slate-950 flex items-center justify-center text-base font-black shrink-0"><i class="fa-solid fa-robot"></i></div>
              <div class="min-w-0">
                <div class="text-sm font-black text-white truncate">${en ? 'DamanSite AI Support' : 'المساعد الذكي — ضمان سايت'}</div>
                <div class="text-[10px] text-emerald-400 font-bold">${en ? 'Instant 24/7 Answers + Admin Handoff' : '🟢 رد فوري 24/7 + تحويل مباشر للإدارة'}</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" onclick="DamanAiI18n.escalateToHumanAdmin()" class="px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]"><i class="fa-solid fa-headset me-1"></i>${en ? 'Admin' : 'للإدارة'}</button>
              <button type="button" onclick="document.getElementById('daman-ai-support-modal').classList.add('hidden')" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </div>

          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
            ${quickTopics.map((q) => `
              <button type="button" onclick="DamanAiI18n.askAiQuick('${this.esc(q).replace(/'/g, "\\'")}')" class="shrink-0 px-2.5 py-1 rounded-xl bg-slate-950 border border-sky-500/40 text-sky-300 font-bold text-[10px] hover:border-amber-400">${this.esc(q)}</button>`).join('')}
          </div>

          <div id="daman-ai-msgs" class="flex-1 overflow-y-auto space-y-2.5 p-2 rounded-2xl bg-slate-950 border border-slate-800"></div>

          <form onsubmit="DamanAiI18n.handleAiSubmit(event)" class="flex gap-1.5 shrink-0">
            <input id="daman-ai-input" type="text" required placeholder="${en ? 'Type your question here...' : 'اكتب سؤالك هنا (إيداع، سحب، عقد، توثيق، إعلان)...'}" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/50 text-white" />
            <button type="submit" class="px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;

      this.renderAiMessages();
      if (initialQuestion) this.askAiQuick(initialQuestion);
    },

    injectChatAndHomeAiEntries() {
      const app = window.DamanApp;
      const main = document.getElementById('app-main');
      if (!app || !main) return;
      const en = this.isEn();

      if (app.activeTab === 'chat') {
        const activeId = window.DamanChat?.activeChatId || '';
        const isInAdminChat = activeId && (activeId.includes('admin') || (main.textContent || '').includes('إدارة ضمان سايت'));

        if (!activeId && !document.getElementById('daman-chat-ai-card')) {
          const card = document.createElement('div');
          card.id = 'daman-chat-ai-card';
          card.className = 'mb-3 p-3 rounded-2xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-400/50 flex items-center justify-between gap-2 cursor-pointer';
          card.onclick = () => this.openAiModal();
          card.innerHTML = `
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-sky-500 text-slate-950 flex items-center justify-center text-lg font-black shrink-0"><i class="fa-solid fa-robot"></i></div>
              <div class="min-w-0">
                <div class="text-xs font-black text-white truncate">${en ? 'DamanSite AI Assistant (Instant 24/7)' : '🤖 مساعد ضمان سايت الذكي (رد فوري 24/7)'}</div>
                <div class="text-[10px] text-sky-200 truncate">${en ? 'Answers all questions + transfers to Human Admin' : 'يجيب على كل استفساراتك ويحوّلك للإدارة عند الحاجة'}</div>
              </div>
            </div>
            <span class="px-2.5 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-black text-[10px] shrink-0">${en ? 'Ask AI' : 'اسأل الآن'}</span>`;
          const root = main.firstElementChild || main;
          root.insertBefore(card, root.firstElementChild);
        } else if (isInAdminChat && !app.isAdmin() && !document.getElementById('daman-admin-chat-ai-bar')) {
          const bar = document.createElement('div');
          bar.id = 'daman-admin-chat-ai-bar';
          bar.className = 'mb-2 p-2 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-between gap-2 text-[10.5px]';
          bar.innerHTML = `
            <span class="text-sky-200 font-bold truncate">🤖 ${en ? 'Need an instant answer while waiting for Admin?' : 'محتاج رد فوري قبل ما ترد الإدارة؟ اسأل المساعد الذكي'}</span>
            <button type="button" onclick="DamanAiI18n.openAiModal()" class="px-2.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px] shrink-0">${en ? 'AI Helper' : 'المساعد الذكي'}</button>`;
          const root = main.firstElementChild || main;
          root.insertBefore(bar, root.firstElementChild);
        }
      }
    },

    // ==================== 2. DISPLAY NAME CHANGE REQUEST (FOR ADMIN REVIEW) ====================
    openNameChangeModal() {
      const app = window.DamanApp;
      if (!app || !app.user || !app.profile) return app?.openAuthModal?.('login');
      const en = this.isEn();
      const curName = app.profile.name || '';
      const legalName = app.profile.legalName || '';
      const pendingName = app.profile.pendingDisplayNameStatus === 'pending' ? (app.profile.pendingDisplayName || '') : '';

      let m = document.getElementById('daman-name-change-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-name-change-modal';
        m.className = 'daman-modal fixed inset-0 z-[94] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      try { history.pushState({ damanModal: 'nameChange' }, ''); } catch (e) {}

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border-2 border-sky-500/50 rounded-3xl p-4 space-y-3 text-xs">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-black text-sky-300"><i class="fa-solid fa-pen-to-square me-1"></i> ${en ? 'Request Display Name Change' : 'طلب تعديل الاسم الظاهر بالتطبيق'}</h3>
            <button type="button" onclick="document.getElementById('daman-name-change-modal').classList.add('hidden')" class="w-8 h-8 rounded-xl bg-slate-800 text-slate-300"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px]">
            <div class="flex justify-between gap-2"><span class="text-slate-400">${en ? 'Current App Name:' : 'الاسم الظاهر حالياً:'}</span><b class="text-white">${this.esc(curName || '—')}</b></div>
            <div class="flex justify-between gap-2 pt-1 border-t border-slate-800"><span class="text-slate-400">${en ? 'Legal ID Name (for transfers):' : '🪪 الاسم بالبطاقة (للتحويلات):'}</span><b class="text-emerald-300">${this.esc(legalName || (en ? 'Not verified yet' : 'لم يُوثّق بعد'))}</b></div>
          </div>

          ${pendingName ? `
            <div class="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-200 text-[11px]">
              ⏳ ${en ? `Pending Admin review: "${this.esc(pendingName)}"` : `لديك طلب معلّق حالياً لتغيير الاسم إلى «<b>${this.esc(pendingName)}</b>» — يمكنك تعديله وإعادة الإرسال.`}
            </div>` : ''}

          <form onsubmit="DamanAiI18n.submitNameChangeRequest(event)" class="space-y-3">
            <div>
              <label class="block text-[10.5px] font-bold text-slate-300 mb-1">${en ? 'New Desired Display Name *' : 'الاسم الجديد الذي تريد ظهوره في التطبيق *'}</label>
              <input id="daman-new-display-name" type="text" required minlength="2" maxlength="45" value="${this.esc(pendingName || curName)}" placeholder="${en ? 'e.g. Ahmed / Eng. Adel' : 'مثال: أحمد / م. عادل / شركة النور'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-sky-500/50 text-white font-bold" />
            </div>

            <div class="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/40 text-[10.5px] text-sky-100 leading-relaxed">
              🛡️ ${en
                ? 'Your new display name will be reviewed by Admin before appearing publicly. Your verified legal ID name remains securely stored for transfers and contracts.'
                : 'يتم مراجعة الاسم الجديد من الإدارة قبل ظهوره للتأكد من لياقته. اسمك الكامل المسجّل بالبطاقة يظل محفوظاً لدى الإدارة لضمان دقة التحويلات والعقود.'}
            </div>

            <button type="submit" class="w-full py-2.5 rounded-2xl bg-sky-500 text-slate-950 font-black">
              ${app.isAdmin() ? (en ? 'Update Name Immediately' : 'تحديث الاسم فوراً (إدارة)') : (en ? 'Submit for Admin Review' : 'إرسال الاسم الجديد لمراجعة الإدارة')}
            </button>
          </form>
        </div>`;
    },

    async submitNameChangeRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app || !app.user) return;

      const newName = (document.getElementById('daman-new-display-name')?.value || '').trim().replace(/\s+/g, ' ');
      if (newName.length < 2 || newName.length > 45) {
        return app.toast('الاسم يجب أن يكون بين حرفين و45 حرفاً', 'warning');
      }
      if (newName === (app.profile?.name || '').trim()) {
        return app.toast('اكتب اسماً مختلفاً عن اسمك الحالي', 'warning');
      }

      await app.withLock('reqNameChg', async () => {
        try {
          if (app.isAdmin()) {
            await app.db.collection('users').doc(app.user.uid).update({
              name: newName,
              pendingDisplayName: '',
              pendingDisplayNameStatus: 'approved'
            });
            document.getElementById('daman-name-change-modal')?.classList.add('hidden');
            app.toast('تم تحديث اسمك فوراً ✅', 'success');
            return;
          }

          await app.db.collection('users').doc(app.user.uid).update({
            pendingDisplayName: newName,
            pendingDisplayNameStatus: 'pending',
            pendingDisplayNameReason: '',
            pendingDisplayNameAt: Date.now()
          });

          await app.sendNotification(
            'ADMIN',
            '✏️ طلب تعديل اسم ظاهر للمراجعة',
            `الاسم الحالي: ${app.profile?.name || '—'} ← المطلوب: ${newName} | البطاقة: ${app.profile?.legalName || 'غير موثّق'}`
          ).catch(() => {});

          document.getElementById('daman-name-change-modal')?.classList.add('hidden');
          app.toast('تم إرسال الاسم الجديد لمراجعة الإدارة — سيتحدّث فور الموافقة ⏳', 'success');
          if (app.activeTab === 'profile') app.renderCurrentTab();
        } catch (err) {
          app.toast('تعذر إرسال الطلب: ' + err.message, 'error');
        }
      });
    },

    injectProfileNameWidget() {
      const app = window.DamanApp;
      if (!app || app.activeTab !== 'profile' || !app.user || !app.profile) return;
      if (app.viewingPublicUid && app.viewingPublicUid !== app.user.uid) return;
      const main = document.getElementById('app-main');
      if (!main || document.getElementById('daman-profile-name-review-card')) return;

      const en = this.isEn();
      const p = app.profile;
      const pending = p.pendingDisplayNameStatus === 'pending' && p.pendingDisplayName;
      const rejected = p.pendingDisplayNameStatus === 'rejected' && p.pendingDisplayNameReason;

      const card = document.createElement('div');
      card.id = 'daman-profile-name-review-card';
      card.className = 'mb-3 p-3 rounded-2xl bg-slate-900/95 border border-sky-500/40 space-y-2 text-xs';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 space-y-0.5">
            <div class="text-[10.5px] text-slate-400">${en ? 'App Display Name:' : '👤 الاسم الظاهر بالتطبيق:'} <b class="text-white">${this.esc(p.name || '—')}</b></div>
            <div class="text-[10.5px] text-slate-400">${en ? 'Legal ID Name (Transfers):' : '🪪 الاسم بالبطاقة (للتحويلات):'} <b class="text-emerald-300">${this.esc(p.legalName || (en ? 'Not verified yet' : 'لم يُوثّق بعد'))}</b></div>
          </div>
          <button type="button" onclick="DamanAiI18n.openNameChangeModal()" class="px-3 py-2 rounded-xl bg-sky-500/20 border border-sky-400/60 text-sky-300 font-black text-[10.5px] shrink-0">
            <i class="fa-solid fa-pen me-1"></i>${en ? 'Edit Name' : 'تعديل الاسم'}
          </button>
        </div>
        ${pending ? `<div class="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[10.5px] text-amber-200">⏳ ${en ? `Name change to "${this.esc(p.pendingDisplayName)}" is pending Admin approval.` : `طلب تغيير الاسم إلى «<b>${this.esc(p.pendingDisplayName)}</b>» قيد مراجعة الإدارة.`}</div>` : ''}
        ${rejected ? `<div class="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-[10.5px] text-rose-200">❌ ${en ? `Previous name request rejected: ${this.esc(p.pendingDisplayNameReason)}` : `تم رفض الاسم المطلوب سابقاً: ${this.esc(p.pendingDisplayNameReason)}`}</div>` : ''}`;

      const root = main.firstElementChild || main;
      root.insertBefore(card, root.firstElementChild);

      main.querySelectorAll('form').forEach((form) => {
        if (form.dataset.damanNameGuardV57) return;
        const nameInp = Array.from(form.querySelectorAll('input[type="text"], input:not([type])')).find((inp) => {
          const hay = `${inp.id || ''} ${inp.name || ''} ${inp.placeholder || ''}`.toLowerCase();
          return (hay.includes('name') || hay.includes('اسم')) && !hay.includes('company') && !hay.includes('شرك') && !hay.includes('bank') && !hay.includes('بنك');
        });
        if (!nameInp || app.isAdmin()) return;
        form.dataset.damanNameGuardV57 = '1';
        nameInp.readOnly = true;
        nameInp.classList.add('opacity-75', 'cursor-pointer');
        nameInp.title = 'اضغط لطلب تعديل الاسم بمراجعة الإدارة';
        nameInp.addEventListener('click', () => this.openNameChangeModal());
      });
    },

    // ==================== 3. UNIVERSAL (?) FIELD HELP TOOLTIPS ====================
    getSmartFieldHelpText(labelTxt, placeholderTxt) {
      const ctx = this.norm(`${labelTxt} ${placeholderTxt}`);
      const en = this.isEn();
      const rules = [
        [['موبايل', 'هاتف', 'تليفون', 'جوال', 'phone', 'mobile'], 'أدخل رقم موبايل مصري صحيح (11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015) لسهولة التواصل والتوثيق.', 'Enter a valid 11-digit Egyptian mobile number for verification and contact.'],
        [['بريد', 'ايميل', 'email'], 'أدخل بريدك الإلكتروني الصحيح لتأمين الدخول واستعادة كلمة المرور.', 'Enter a valid email address for secure login and recovery.'],
        [['كلمه المرور', 'كلمه السر', 'باسورد', 'password'], 'اختر كلمة مرور قوية (6 أحرف أو أرقام على الأقل) واحتفظ بها بسرية.', 'Choose a strong password (at least 6 characters).'],
        [['رقم قومي', 'البطاقه', 'national id'], 'أدخل الرقم القومي المصري المكون من 14 رقماً بدقة كما هو مكتوب على البطاقة.', 'Enter your exact 14-digit Egyptian National ID number.'],
        [['سجل تجاري', 'commercial'], 'أدخل رقم السجل التجاري الساري الخاص بشركتك أو مؤسستك.', 'Enter your valid Commercial Registration number.'],
        [['ضريبيه', 'tax'], 'أدخل رقم البطاقة الضريبية المعتمد للمنشأة.', 'Enter your official Tax Card number.'],
        [['مبلغ', 'سعر', 'ميزانيه', 'قيمه', 'amount', 'price', 'budget'], 'أدخل القيمة الصحيحة بالجنيه المصري (أرقام فقط بدون حروف).', 'Enter the exact amount in Egyptian Pounds (EGP).'],
        [['مرجعي', 'reference', 'txref'], 'رقم العملية الموجود في إيصال التحويل أو رسالة SMS (اختياري ويمكنك تركه فارغاً).', 'Transaction reference number from your transfer receipt (optional).'],
        [['ايبان', 'iban', 'حساب بنكي'], 'أدخل رقم الحساب البنكي أو الـ IBAN الصحيح (يبدأ بـ EG) المسجّل باسمك الشخصي.', 'Enter your exact Bank Account Number or IBAN registered in your own name.'],
        [['بنك', 'bank'], 'اختر أو اكتب اسم البنك التابع له حسابك البنكي بدقة.', 'Select or enter the exact name of your bank.'],
        [['انستا', 'ipa', 'instapay'], 'أدخل عنوان إنستا باي الخاص بك (مثل name@instapay) أو رقم الموبايل المربوط.', 'Enter your InstaPay IPA address (e.g. name@instapay) or linked phone.'],
        [['محفظ', 'كاش', 'wallet'], 'أدخل رقم المحفظة الإلكترونية (فودافون / اتصالات / أورنج / WE كاش) المسجّل باسمك.', 'Enter your mobile cash wallet number registered in your name.'],
        [['موقع', 'مدينه', 'عنوان', 'محافظه', 'city', 'location', 'address'], 'اكتب المدينة والمنطقة أو عنوان الموقع بالتفصيل لسهولة الوصول والتنسيق.', 'Enter the city, area, or site location clearly.'],
        [['تاريخ', 'موعد', 'بدايه', 'تسليم', 'date'], 'اختر التاريخ الدقيق المطلوب للتنفيذ أو الزيارة أو التسليم.', 'Select the exact target date.'],
        [['مساحه', 'كميه', 'عدد', 'area', 'count', 'qty'], 'اكتب المساحة أو الكمية أو العدد التقريبي بدقة لحساب التكلفة الصحيحة.', 'Enter the approximate area, quantity, or count accurately.'],
        [['تفاصيل', 'وصف', 'مواصفات', 'ملاحظ', 'بيان', 'desc', 'note', 'scope'], 'اكتب كل التفاصيل والمواصفات والشروط بوضوح لتجنب أي خلاف لاحقاً.', 'Provide clear details, specs, and terms to avoid any misunderstanding.'],
        [['اسم', 'عنوان الاعلان', 'title', 'name'], 'اكتب الاسم أو العنوان بشكل واضح ومختصر يعبّر عن المطلوب بدقة.', 'Enter a clear, concise name or title.']
      ];

      for (const [tokens, arMsg, enMsg] of rules) {
        if (tokens.some((tk) => ctx.includes(this.norm(tk)))) {
          return en ? enMsg : arMsg;
        }
      }
      const cleanLbl = String(labelTxt || '').replace(/[*؟:]/g, '').trim();
      return en
        ? `Fill in "${cleanLbl || 'this field'}" accurately${placeholderTxt ? ` (e.g. ${placeholderTxt})` : ''}.`
        : `أدخل «${cleanLbl || 'هذه الخانة'}» بدقة ووضوح${placeholderTxt ? ` (مثال: ${placeholderTxt})` : ''}.`;
    },

    injectMissingFieldHelp(root) {
      if (!root) return;
      const labels = root.querySelectorAll('label');
      let counter = 0;

      labels.forEach((lbl) => {
        if (lbl.dataset.damanHelpChecked) return;
        if (lbl.querySelector('input[type="checkbox"], input[type="radio"], input[type="file"]')) {
          lbl.dataset.damanHelpChecked = '1';
          return;
        }
        if (lbl.querySelector('[onclick*="DamanToggleHelp"], .daman-auto-help-btn')) {
          lbl.dataset.damanHelpChecked = '1';
          return;
        }

        const field =
          (lbl.htmlFor ? document.getElementById(lbl.htmlFor) : null) ||
          (lbl.nextElementSibling?.matches?.('input, select, textarea') ? lbl.nextElementSibling : null) ||
          lbl.parentElement?.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea');

        if (!field || field.closest('#daman-ai-support-modal')) {
          lbl.dataset.damanHelpChecked = '1';
          return;
        }

        lbl.dataset.damanHelpChecked = '1';
        const lblText = (lbl.textContent || '').trim();
        if (lblText.length < 2 || lblText.length > 90) return;

        counter += 1;
        const hid = `auto_${Date.now().toString(36)}_${counter}_${Math.floor(Math.random() * 999)}`;
        const helpMsg = this.getSmartFieldHelpText(lblText, field.getAttribute('placeholder') || '');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'daman-auto-help-btn inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/25 border border-sky-400/70 text-sky-300 text-[9.5px] font-black ms-1 align-middle';
        btn.title = this.isEn() ? 'Field help' : 'شرح الخانة';
        btn.textContent = this.isEn() ? '?' : '؟';
        btn.setAttribute('onclick', `event.preventDefault(); event.stopPropagation(); window.DamanToggleHelp('${hid}')`);
        lbl.appendChild(btn);

        const box = document.createElement('div');
        box.id = 'fh-' + hid;
        box.className = 'hidden mt-1 mb-1.5 p-2 rounded-xl bg-sky-950/95 border border-sky-400/60 text-[10.5px] text-sky-100 leading-relaxed font-semibold shadow-lg';
        box.textContent = '💡 ' + helpMsg;
        lbl.insertAdjacentElement('afterend', box);
      });
    },

    // ==================== 4. COMPLETE ARABIC <-> ENGLISH TRANSLATION ENGINE ====================
    EXACT_DICT: {
      'ضمان سايت': 'DamanSite',
      'الضمان المالي والمقاولات B2B': 'Escrow & Construction B2B',
      'الرئيسية': 'Home',
      'السوق': 'Market',
      'السوق B2B': 'B2B Market',
      'الشات': 'Chat',
      'الشركات': 'Companies',
      'المحفظة': 'Wallet',
      'صفحتي': 'Profile',
      'الإدارة': 'Admin',
      'دخول': 'Login',
      'خروج': 'Logout',
      'تسجيل الدخول': 'Login',
      'إنشاء حساب': 'Register',
      'تثبيت': 'Install',
      'بحث': 'Search',
      'تحديث': 'Refresh',
      'تحديث الآن': 'Update Now',
      'إغلاق': 'Close',
      'إلغاء': 'Cancel',
      'حفظ': 'Save',
      'تعديل': 'Edit',
      'حذف': 'Delete',
      'نسخ': 'Copy',
      'نسخ الرقم': 'Copy Number',
      'نسخ الحساب': 'Copy Account',
      'نسخ المبلغ': 'Copy Amount',
      'إرسال': 'Send',
      'نشر': 'Post',
      'الكل': 'All',
      'التفاصيل': 'Details',
      'إيداع': 'Deposit',
      'سحب': 'Withdraw',
      'موثّق ✅': 'Verified ✅',
      'موثق ✅': 'Verified ✅',
      'غير موثّق': 'Unverified',
      'الرصيد الكاش المتاح': 'Available Cash Balance',
      'محجوز بالضمان': 'Locked in Escrow',
      'قيد السحب': 'Pending Withdrawal',
      'رصيد الهدايا': 'Bonus Balance',
      'تواصل مع إدارة المنصة': 'Contact Platform Management',
      'واتساب': 'WhatsApp',
      'فحص عقد رسمي': 'Verify Official Contract',
      'تحقق بكود العقد أو QR': 'Verify via Contract Code or QR',
      'كاميرا QR أو رقم العقد + دخول العقد': 'QR Camera or Code + Open Contract',
      'شارك صفحتك': 'Share Your Profile',
      'رابط مباشر + QR Code': 'Direct Link + QR Code',
      'السوق والموردين B2B': 'B2B Market & Suppliers',
      'مشاريع، صنايعية، وموردي خامات': 'Projects, Contractors & Suppliers',
      'استلام هندسي بضمان 3x': '3x Engineering Inspection',
      'استلام شدات وأسقف بضمان 3 أضعاف': 'Formwork & Slab Inspection (3x Warranty)',
      'توريد عمالة VIP': 'VIP Labor Supply',
      'فرق فنية مختبرة بضمان المنصة': 'Verified Technical Teams by Platform',
      'إدارة الشركات والمواقع': 'Companies & Sites Management',
      'GPS، مستخلصات، إضافي، جرد ورواتب': 'GPS, Invoices, Overtime, Inventory & Payroll',
      'دفتر الموقع': 'Site Ledger',
      'استلام 3x': '3x Inspection',
      'عمالة VIP': 'VIP Labor',
      '🏗️ مشاريع': '🏗️ Projects',
      '👷 مقاولين وفنيين': '👷 Contractors',
      '🚚 موردين B2B': '🚚 B2B Suppliers',
      '❤️ المفضلة': '❤️ Favorites',
      'مراسلة واتفاق': 'Chat & Deal',
      'مراسلة واتفاق بالضمان': 'Chat & Escrow Deal',
      '★ تمييز': '★ Boost',
      '★ باقات التمييز': '★ Boost Packages',
      'فتح': 'Open',
      'تصفية A4': 'A4 Settlement',
      'طباعة A4': 'Print A4',
      'منشور ✅': 'Published ✅',
      'قيد المراجعة ⏳': 'Pending Review ⏳',
      'مرفوض ❌': 'Rejected ❌',
      'مغلق 🔒': 'Closed 🔒',
      'معتمد ✅': 'Approved ✅',
      'ملغى ❌': 'Cancelled ❌',
      'مكتمل 🏁': 'Completed 🏁',
      '💰 الخزنة والميزان': '💰 Treasury & Balance',
      '💳 محوّل الحسابات': '💳 Accounts Switchboard',
      '💸 الشحن والسحب': '💸 Deposits & Withdrawals',
      '🪪 التوثيق والأسماء': '🪪 KYC & Names',
      '📄 العقود والنزاع': '📄 Contracts & Disputes',
      '🏗️ السوق والتمييز': '🏗️ Market & Boosts',
      '📢 النصوص والبانرات': '📢 Texts & Banners',
      '🏢 الشركات': '🏢 Companies',
      '👥 المستخدمين 360°': '👥 Users 360°',
      '👁️ مراقبة الشات': '👁️ Chat Monitor',
      '🛡️ المشرفين والسجل': '🛡️ Mods & Audit',
      '🗄️ قاعدة البيانات': '🗄️ Database',
      '⚙️ الطوارئ والنسخ': '⚙️ Emergency & Backup',
      '🩺 فحص الترابط': '🩺 Health Check',
      '🧹 كاش': '🧹 Cache',
      '📱 محافظ كاش': '📱 Cash Wallets',
      '⚡ إنستا باي': '⚡ InstaPay',
      '🏦 تحويل بنكي': '🏦 Bank Transfer',
      'تأكيد وإرسال طلب الشحن': 'Confirm & Submit Deposit',
      'تأكيد وحجز مبلغ السحب': 'Confirm & Lock Withdrawal',
      '✅ اعتماد': '✅ Approve',
      '❌ رفض': '❌ Reject',
      '✅ موافقة': '✅ Approve',
      '✅ نشر': '✅ Publish',
      '🗑️ حذف': '🗑️ Delete',
      'معاينة الصورة': 'Image Preview',
      'لا توجد إعلانات مطابقة للبحث في هذا القسم.': 'No matching listings found in this category.',
      'جارٍ التحميل...': 'Loading...',
      'جارٍ تشغيل ضمان سايت...': 'Starting DamanSite...',
      'جاري الاتصال الآمن بقاعدة البيانات': 'Connecting securely to database...'
    },

    PHRASE_REPLACEMENTS: [
      ['لوحة سيطرة الإدارة الشاملة (خزنة، حسابات، تمييز، مراقبة شات، طوارئ)', 'Full Admin Control Panel (Treasury, Accounts, Boosts, Chat Monitor, Emergency)'],
      ['أهلاً بك في ضمان سايت', 'Welcome to DamanSite'],
      ['عروض وخدمات ضمان سايت', 'DamanSite Offers & Services'],
      ['دليل الأقسام والخدمات', 'Categories & Services Directory'],
      ['عرض كل الأقسام', 'Show All Categories'],
      ['إنشاءات ومقاولات', 'Construction & Contracting'],
      ['تشطيبات وديكور', 'Finishing & Decor'],
      ['شرط أساسي للإيداع والسحب (نفس صاحب الحساب فقط)', 'Mandatory Deposit & Withdrawal Rule (Same Account Owner Only)'],
      ['تنبيه إلزامي: الإيداع بنفس اسم صاحب الحساب فقط', 'Mandatory Notice: Deposit Under Same Account Owner Only'],
      ['تنبيه إلزامي: السحب بنفس اسم صاحب الحساب فقط', 'Mandatory Notice: Withdraw Under Same Account Owner Only'],
      ['صلاحية أرقام الاستقبال الحالية', 'Current Receiving Details Validity'],
      ['بيانات المحفظة الإلكترونية النشطة', 'Active E-Wallet Details'],
      ['التحويل المباشر عبر إنستا باي (InstaPay)', 'Direct InstaPay Transfer'],
      ['اضغط هنا للتحويل مباشرة عبر إنستا باي', 'Tap Here to Transfer via InstaPay'],
      ['بيانات الحساب البنكي النشط', 'Active Bank Account Details'],
      ['عنوان إنستا باي (IPA):', 'InstaPay Address (IPA):'],
      ['اسم صاحب الحساب:', 'Account Holder Name:'],
      ['اسم صاحب المحفظة:', 'Wallet Holder Name:'],
      ['اسم صاحب الحساب البنكي:', 'Bank Account Holder:'],
      ['رقم المحفظة', 'Wallet Number'],
      ['اسم البنك:', 'Bank Name:'],
      ['رقم الحساب البنكي:', 'Bank Account Number:'],
      ['الرقم المرجعي للعملية', 'Transaction Reference'],
      ['صورة إيصال التحويل', 'Transfer Receipt Screenshot'],
      ['اضغط لرفع صورة إيصال التحويل', 'Tap to Upload Transfer Receipt'],
      ['المتاح للسحب:', 'Available to Withdraw:'],
      ['المتبقي من حد اليوم:', 'Daily Limit Left:'],
      ['وسيلة الاستلام', 'Receiving Method'],
      ['المبلغ المطلوب سحبه', 'Withdrawal Amount'],
      ['رسوم التحويل', 'Transfer Fee'],
      ['الصافي الذي سيصلك:', 'Net Payout You Receive:'],
      ['طلب تعديل الاسم الظاهر بالتطبيق', 'Request Display Name Change'],
      ['طلبات تعديل الاسم الظاهر بالتطبيق', 'Display Name Change Requests'],
      ['طلبات الشحن والسحب المعلّقة', 'Pending Deposit & Withdrawal Requests'],
      ['طلبات التوثيق بالبطاقة المعلّقة', 'Pending KYC Verification Requests'],
      ['إعلانات بانتظار الموافقة', 'Listings Pending Approval'],
      ['كل إعلانات السوق', 'All Market Listings'],
      ['لوحة سيطرة الإدارة', 'Admin Control Panel'],
      ['المستخدمين', 'Users'],
      ['مشاهدة', 'views'],
      ['بالاتفاق', 'Negotiable'],
      ['اختياري', 'Optional'],
      ['مطلوب تنفيذ / مشروع', 'Project Needed'],
      ['مقاول / فني', 'Contractor / Technician'],
      ['توريد خامات B2B', 'B2B Materials Supply'],
      ['كل التخصصات', 'All Categories'],
      ['قسم', 'Categories'],
      ['ج.م', 'EGP'],
      ['ملف 360°', '360° Profile'],
      ['تم النسخ بنجاح', 'Copied Successfully'],
      ['اضغط للانتقال مباشرة', 'Tap to Open Directly'],
      ['المساعد الذكي', 'AI Assistant'],
      ['تشغيل / إيقاف وسائل الإيداع والسحب', 'Enable / Disable Deposit & Withdrawal Methods']
    ],

    translateStringToEn(raw) {
      if (!raw || typeof raw !== 'string') return raw;
      const trimmed = raw.trim();
      if (!trimmed || !/[\u0600-\u06FF]/.test(trimmed)) return raw;

      if (this.EXACT_DICT[trimmed]) {
        return raw.replace(trimmed, this.EXACT_DICT[trimmed]);
      }

      const cats = window.DamanApp?.CATEGORIES;
      if (Array.isArray(cats)) {
        const hitCat = cats.find((c) => c.ar && c.ar.trim() === trimmed && c.en);
        if (hitCat) return raw.replace(trimmed, hitCat.en);
      }

      let out = raw;
      for (const [ar, en] of this.PHRASE_REPLACEMENTS) {
        if (out.includes(ar)) out = out.split(ar).join(en);
      }
      return out;
    },

    applyLanguageToTree(root) {
      if (!root || this._translating) return;
      const en = this.isEn();
      this._translating = true;

      try {
        document.documentElement.lang = en ? 'en' : 'ar';
        document.documentElement.dir = en ? 'ltr' : 'rtl';

        const langBtn = document.getElementById('daman-lang-btn');
        if (langBtn) langBtn.textContent = en ? 'AR' : 'EN';

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            const p = node.parentElement;
            if (!p) return NodeFilter.FILTER_REJECT;
            const tag = p.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'CODE' || tag === 'NOSCRIPT') {
              return NodeFilter.FILTER_REJECT;
            }
            if (p.closest('#daman-print-area')) return NodeFilter.FILTER_REJECT;
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let cur = walker.nextNode();
        while (cur) {
          if (en) {
            if (!this._origTextMap.has(cur)) {
              this._origTextMap.set(cur, cur.nodeValue);
            }
            const orig = this._origTextMap.get(cur);
            const tr = this.translateStringToEn(orig);
            if (tr !== cur.nodeValue) cur.nodeValue = tr;
          } else if (this._origTextMap.has(cur)) {
            const orig = this._origTextMap.get(cur);
            if (cur.nodeValue !== orig) cur.nodeValue = orig;
          }
          cur = walker.nextNode();
        }

        root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
          if (en) {
            if (el.dataset.origPlaceholder === undefined) {
              el.dataset.origPlaceholder = el.getAttribute('placeholder') || '';
            }
            const tr = this.translateStringToEn(el.dataset.origPlaceholder);
            if (el.getAttribute('placeholder') !== tr) el.setAttribute('placeholder', tr);
          } else if (el.dataset.origPlaceholder !== undefined) {
            if (el.getAttribute('placeholder') !== el.dataset.origPlaceholder) {
              el.setAttribute('placeholder', el.dataset.origPlaceholder);
            }
          }
        });
      } finally {
        this._translating = false;
      }
    },

    patchLangAndToast() {
      const app = window.DamanApp;
      if (!app || app._aiI18nPatchedV57) return;
      app._aiI18nPatchedV57 = true;

      if (typeof app.toggleLang === 'function') {
        const origToggle = app.toggleLang.bind(app);
        app.toggleLang = () => {
          origToggle();
          setTimeout(() => this.applyLanguageToTree(document.body), 60);
          setTimeout(() => this.applyLanguageToTree(document.body), 260);
        };
      }

      if (typeof app.toast === 'function') {
        const origToast = app.toast.bind(app);
        app.toast = (msg, type) => {
          const finalMsg = this.isEn() ? this.translateStringToEn(String(msg || '')) : msg;
          return origToast(finalMsg, type);
        };
      }
    },

    // ==================== 5. INTERCEPT HOME "تواصل مع إدارة المنصة" FOR AI FIRST ====================
    attachGlobalInterceptors() {
      if (this._clickBound) return;
      this._clickBound = true;

      document.addEventListener('click', (ev) => {
        const target = ev.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest('.daman-modal')) return;

        const btn = target.closest('button, a, div[onclick]');
        if (!btn) return;
        const txt = (btn.textContent || '').replace(/\s+/g, ' ').trim();
        if ((txt.includes('تواصل مع إدارة المنصة') || txt.includes('Contact Platform Management')) && !window.DamanApp?.isAdmin?.()) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          this.openAiModal();
        }
      }, true);
    },

    // ==================== 6. RUN PASS & BOOT ====================
    runPass() {
      const app = window.DamanApp;
      if (!app) return;
      const main = document.getElementById('app-main');

      this.injectChatAndHomeAiEntries();
      this.injectProfileNameWidget();

      if (main) this.injectMissingFieldHelp(main);
      document.querySelectorAll('.daman-modal:not(.hidden)').forEach((m) => this.injectMissingFieldHelp(m));

      if (this.isEn()) {
        this.applyLanguageToTree(document.body);
      }
    },

    boot() {
      if (this._booted) return;
      const app = window.DamanApp;
      if (!app) return setTimeout(() => this.boot(), 250);
      this._booted = true;

      this.patchLangAndToast();
      this.attachGlobalInterceptors();

      if (typeof app.renderCurrentTab === 'function' && !app._aiTabHookedV57) {
        app._aiTabHookedV57 = true;
        const origRender = app.renderCurrentTab.bind(app);
        app.renderCurrentTab = () => {
          origRender();
          setTimeout(() => this.runPass(), 90);
          setTimeout(() => this.runPass(), 320);
        };
      }

      if (typeof MutationObserver !== 'undefined') {
        this._obs = new MutationObserver(() => {
          if (this._translating) return;
          clearTimeout(this._timer);
          this._timer = setTimeout(() => this.runPass(), 110);
        });
        this._obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }

      setTimeout(() => this.runPass(), 700);
    }
  };

  window.DamanAiI18n = AiI18nMod;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(() => AiI18nMod.boot(), 550));
  else setTimeout(() => AiI18nMod.boot(), 550);
})();
