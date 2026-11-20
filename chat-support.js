(function () {
  const ChatMod = {
    subTab: 'ai', // 'ai' | 'chats' | 'tickets'
    chats: [],
    tickets: [],
    activeChatId: null,
    activeChatMeta: null,
    messages: [],
    aiHistory: [],
    attachedUid: null,
    unsubChats: null,
    unsubMsgs: null,
    unsubTickets: null,

    initAiWelcome(isAr) {
      if (this.aiHistory.length) return;
      this.aiHistory.push({
        sender: 'ai',
        text: isAr
          ? 'أهلاً بك في الدعم الفني الذكي لـ «ضمان سايت» 🏗️\nاسألني عن أي حاجة (الضمان 3.5%، الإيداع والسحب، التوثيق، الباقات، المعاينات، أو عمالة VIP) وهرد عليك فوراً، ولو عندك مشكلة خاصة هحوّلك للإدارة بضغطة زر.'
          : 'Welcome to DamanSite AI Support 🏗️\nAsk me anything about 3.5% Escrow, deposits/withdrawals, KYC, plans, inspections, or VIP labor, or escalate to Admin anytime.'
      });
    },

    ensureListeners(app) {
      this.initAiWelcome(app.lang === 'ar');

      if (!app.user) {
        this.detachListeners();
        return;
      }

      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      const lookupIds = app.isAdmin() ? [app.user.uid, 'admin'] : [app.user.uid];

      this.unsubChats = app.db
        .collection('chats')
        .where('participants', 'array-contains-any', lookupIds)
        .limit(35)
        .onSnapshot(
          (snap) => {
            this.chats = snap.docs
              .map((d) => Object.assign({ id: d.id }, d.data()))
              .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            if (app.activeTab === 'chat' && !this.activeChatId) this.rerender();
          },
          (err) => console.error('chats listener error:', err)
        );

      const ticketQuery = app.isAdmin()
        ? app.db.collection('supportTickets').limit(30)
        : app.db.collection('supportTickets').where('userId', '==', app.user.uid).limit(20);

      this.unsubTickets = ticketQuery.onSnapshot(
        (snap) => {
          this.tickets = snap.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          if (app.activeTab === 'chat' && this.subTab === 'tickets') this.rerender();
        },
        () => {}
      );
    },

    detachListeners() {
      if (this.unsubChats) { this.unsubChats(); this.unsubChats = null; }
      if (this.unsubMsgs) { this.unsubMsgs(); this.unsubMsgs = null; }
      if (this.unsubTickets) { this.unsubTickets(); this.unsubTickets = null; }
      this.attachedUid = null;
      this.chats = [];
      this.tickets = [];
      this.messages = [];
      this.activeChatId = null;
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'chat') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) {
      this.subTab = tab;
      this.closeActiveChat(false);
      this.rerender();
    },

    // Called from Projects / Public Profile / Anywhere
    async openDirectChat(targetUid, targetName, projectId = '', projectTitle = '') {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) {
        app.toast(isAr ? 'سجّل الدخول أولاً لبدء المحادثة' : 'Sign in first to start chatting', 'warning');
        return app.openAuthModal('login');
      }

      const myUid = app.user.uid;
      const cleanTarget = !targetUid || String(targetUid).startsWith('demo_') ? 'admin' : targetUid;
      if (cleanTarget === myUid) {
        return app.toast(isAr ? 'لا يمكنك مراسلة نفسك' : 'Cannot chat with yourself', 'info');
      }

      const pair = [myUid, cleanTarget].sort();
      const chatId = pair[0] + '_' + pair[1];
      const chatRef = app.db.collection('chats').doc(chatId);

      try {
        const snap = await chatRef.get();
        const myName = app.profile.companyName || app.profile.name || app.user.email;
        const otherLabel = cleanTarget === 'admin' ? (isAr ? 'إدارة ضمان سايت' : 'DamanSite Admin') : (targetName || 'User');

        if (!snap.exists) {
          const names = {};
          names[myUid] = myName;
          names[cleanTarget] = otherLabel;
          await chatRef.set({
            participants: pair,
            participantNames: names,
            projectId: projectId || '',
            projectTitle: projectTitle || '',
            lastMessage: projectTitle ? `${isAr ? 'استفسار بخصوص:' : 'Inquiry:'} ${projectTitle}` : '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else if (projectTitle) {
          await chatRef.update({
            projectId: projectId || snap.data().projectId || '',
            projectTitle,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        this.subTab = 'chats';
        app.switchTab('chat');
        this.openChatRoom(chatId, {
          id: chatId,
          otherUid: cleanTarget,
          otherName: otherLabel,
          projectTitle: projectTitle || (snap.exists ? snap.data().projectTitle : '')
        });
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    openChatRoom(chatId, meta) {
      const app = window.DamanApp;
      this.activeChatId = chatId;
      this.activeChatMeta = meta;
      this.messages = [];

      if (this.unsubMsgs) { this.unsubMsgs(); this.unsubMsgs = null; }
      this.unsubMsgs = app.db
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('createdAt', 'asc')
        .limit(60)
        .onSnapshot(
          (snap) => {
            this.messages = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
            this.rerender();
            setTimeout(() => {
              const box = document.getElementById('chat-msgs-scroll');
              if (box) box.scrollTop = box.scrollHeight;
            }, 60);
          },
          (err) => console.error('messages listener error:', err)
        );

      this.rerender();
    },

    closeActiveChat(shouldRender = true) {
      this.activeChatId = null;
      this.activeChatMeta = null;
      this.messages = [];
      if (this.unsubMsgs) { this.unsubMsgs(); this.unsubMsgs = null; }
      if (shouldRender) this.rerender();
    },

    compressChatImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Read error'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Image error'));
          img.onload = () => {
            const maxW = 720;
            let w = img.width;
            let h = img.height;
            if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', 0.58));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    },

    async sendChatMessage(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const inp = document.getElementById('chat-msg-input');
      const text = inp ? inp.value.trim() : '';
      if (!text || !this.activeChatId || !app.user) return;

      inp.value = '';
      try {
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid,
          senderName: app.profile?.companyName || app.profile?.name || '',
          text,
          imageBase64: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await chatRef.update({
          lastMessage: text.slice(0, 90),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    async sendChatImage(input) {
      const app = window.DamanApp;
      const file = input.files && input.files[0];
      if (!file || !this.activeChatId || !app.user) return;
      try {
        const b64 = await this.compressChatImage(file);
        const chatRef = app.db.collection('chats').doc(this.activeChatId);
        await chatRef.collection('messages').add({
          senderId: app.user.uid,
          senderName: app.profile?.companyName || app.profile?.name || '',
          text: '',
          imageBase64: b64,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await chatRef.update({
          lastMessage: app.lang === 'ar' ? '📷 صورة مرفقة' : '📷 Photo',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        app.toast(app.lang === 'ar' ? 'تعذر إرسال الصورة' : 'Failed to send photo', 'error');
      }
      input.value = '';
    },

    // ==================== FREE SMART AI SUPPORT ENGINE ====================
    getAiReply(rawText, isAr) {
      const q = (rawText || '').toLowerCase();

      if (/سحب|اسحب|withdraw|فلوسي/.test(q)) {
        return {
          text: isAr
            ? '💰 **قواعد السحب في ضمان سايت:**\n• السحب متاح على **المحفظة الإلكترونية** أو **الحساب البنكي** فقط (لا يوجد سحب على إنستا باي).\n• يُشترط أن يكون الحساب أو المحفظة **بنفس اسم صاحب الحساب** المطابق للبطاقة.\n• يتم مراجعة وتحويل المبلغ **خلال يوم عمل واحد** من الرصيد المتاح فقط.'
            : '💰 **Withdrawals:** Available via E-Wallet or Bank Account ONLY (same legal name matching your ID), processed within 1 business day.',
          action: { label: isAr ? 'افتح شاشة السحب' : 'Open Withdraw', fn: "DamanWallet.setSubTab('withdraw'); DamanApp.switchTab('wallet')" }
        };
      }

      if (/ايداع|إيداع|اشحن|شحن|انستا|إنستا|instapay|deposit/.test(q)) {
        return {
          text: isAr
            ? '💳 **قواعد الإيداع والشحن:**\n• متاح عبر 3 وسائل: **محفظة إلكترونية**، **رابط إنستا باي المباشر**، أو **حساب بنكي**.\n• يجب أن يكون التحويل من رقم/حساب باسمك مع رفع صورة الإيصال.\n• يتم المراجعة وإضافة الرصيد **خلال يوم عمل واحد**.'
            : '💳 **Deposits:** Available via E-Wallet, InstaPay Direct Link, or Bank Transfer. Upload your receipt and funds credit within 1 business day.',
          action: { label: isAr ? 'افتح شاشة الإيداع' : 'Open Deposit', fn: "DamanWallet.setSubTab('deposit'); DamanApp.switchTab('wallet')" }
        };
      }

      if (/ضمان|عمولة|عموله|عقد|escrow|3\.5|حجز/.test(q)) {
        return {
          text: isAr
            ? '🛡️ **نظام الضمان المالي (Escrow 3.5%):**\n• عند قبول عرض السعر، يتم حجز قيمة العقد بأمان في محفظة الضمان (أو «حجز مبدئي» لو محتاج تشحن الفرق).\n• يتولّد **عقد إلكتروني رسمي A4** قابل للطباعة والحفظ PDF.\n• لا يُصرف أي مبلغ إلا بعد تأكيد الاستلام، وتُخصم عمولة **3.5%** فقط عند تحرير الدفعة.'
            : '🛡️ **3.5% Escrow:** Funds lock safely upon proposal acceptance with a printable A4 contract. 3.5% fee applies only on milestone release.',
          action: { label: isAr ? 'تصفح المشاريع' : 'Browse Projects', fn: "DamanApp.switchTab('projects')" }
        };
      }

      if (/توثيق|بطاقة|بطاقه|سيلفي|سجل تجاري|ضريبية|kyc/.test(q)) {
        return {
          text: isAr
            ? '🪪 **توثيق الحساب (مجاني 100%):**\n• **الأفراد والمقاولين:** الرقم القومي (14 رقم) + وش وظهر البطاقة + صورة سيلفي.\n• **الشركات والمكاتب:** السجل التجاري + البطاقة الضريبية + بطاقة المفوّض وسيلفي (ومطلوب لفتح صلاحيات فريق العمل Access).'
            : '🪪 **Free KYC:** Individuals upload National ID + Selfie. Companies upload Commercial Register + Tax Card + Authorized ID/Selfie.',
          action: { label: isAr ? 'وثّق حسابك الآن' : 'Verify Now', fn: "DamanApp.switchTab('wallet'); setTimeout(()=>DamanWallet.openKycModal(),200)" }
        };
      }

      if (/باقة|باقات|سعر|اسعار|أسعار|مميز|اشتراك|plan|package/.test(q)) {
        return {
          text: isAr
            ? '💎 **باقات ضمان سايت المخفّضة:**\n• **الأفراد والمقاولين VIP:** تبدأ من 150 ج.م/شهر (وخصومات كبيرة لـ 3 و 6 و 12 شهر).\n• **الشركات والمكاتب:** تبدأ من 250 ج.م/شهر.\n• **تمييز إعلان (Featured):** 75 ج.م للأسبوع أو 200 ج.م للشهر.'
            : '💎 **Plans:** Individual VIP from 150 EGP/mo, Companies from 250 EGP/mo, Featured Ads 75 EGP/week or 200 EGP/month.',
          action: { label: isAr ? 'عرض الباقات' : 'View Plans', fn: "DamanWallet.setSubTab('packages'); DamanApp.switchTab('wallet')" }
        };
      }

      if (/معاينة|معاينه|سقف|زيارات|عمالة|عماله|vip/.test(q)) {
        return {
          text: isAr
            ? '👷 **باقات المعاينة الهندسية وعمالة VIP:**\n• **المعاينات:** باقة سقف كامل، 4 زيارات، مبنى كامل، أو تشطيبات — بتكتب المساحة والموقع والإدارة بتحددلك السعر المناسب.\n• **عمالة VIP:** اطلب عدد العمال والتخصص والمحافظة وإدارتنا بتوفرلك فريق مضمون.'
            : '👷 **Inspections & VIP Labor:** Submit your site area or worker requirements from the Projects tab and our admin team will quote & assign.',
          action: { label: isAr ? 'المعاينات وعمالة VIP' : 'Open Inspections', fn: "DamanProjects.setSubTab('inspection'); DamanApp.switchTab('projects')" }
        };
      }

      if (/شركة|شركه|موظف|صلاحيات|access|فريق/.test(q)) {
        return {
          text: isAr
            ? '🏢 **حسابات الشركات وصلاحيات (Access):**\n• صاحب الشركة يقدر يضيف مهندسين ومشرفين بالإيميل ويحدد صلاحية كل واحد.\n• يُشترط لتفعيل لوحة الفريق توثيق الشركة بالسجل التجاري والبطاقة الضريبية ووجود رصيد في محفظة الشركة.'
            : '🏢 **Company Panel:** Verified companies (CR & Tax Card + wallet balance) can invite team members by email with custom Access permissions.',
          action: { label: isAr ? 'لوحة الشركة' : 'Company Panel', fn: "DamanApp.switchTab('company')" }
        };
      }

      if (/منشور|مراجعة|مراجعه|قسم|اتحذف|نزاع|شكوى|مشكلة|مشكله|ادارة|إدارة/.test(q)) {
        return {
          text: isAr
            ? '📩 **المراجعة والشكاوى:**\n• أي منشور جديد بيتراجع من الإدارة الأول عشان نتأكد إنه في القسم الصح قبل النشر.\n• لو عندك مشكلة مالية، نزاع، أو استفسار خاص تقدر تكلم الإدارة مباشرة أو تفتح تذكرة دعم الآن.'
            : '📩 **Admin Review & Complaints:** New posts are reviewed before publishing. For disputes or private issues, contact Admin directly.',
          action: { label: isAr ? 'مراسلة الإدارة مباشرة' : 'Chat with Admin', fn: "DamanChat.openDirectChat('admin','إدارة ضمان سايت')" }
        };
      }

      return {
        text: isAr
          ? 'فهمت سؤالك! لو بتستفسر عن موضوع خاص بحسابك أو محتاج مساعدة مباشرة من فريقنا، اضغط على الزر بالأسفل للتواصل المباشر مع **إدارة ضمان سايت** أو فتح تذكرة دعم.'
          : 'Got it! For account-specific help, tap below to message DamanSite Admin directly or open a support ticket.',
        action: { label: isAr ? 'تحويل المحادثة للإدارة' : 'Escalate to Admin', fn: "DamanChat.openDirectChat('admin','إدارة ضمان سايت')" }
      };
    },

    askAi(presetText) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const inp = document.getElementById('ai-chat-input');
      const text = presetText || (inp ? inp.value.trim() : '');
      if (!text) return;
      if (inp) inp.value = '';

      this.aiHistory.push({ sender: 'user', text });
      const reply = this.getAiReply(text, isAr);
      this.aiHistory.push({ sender: 'ai', text: reply.text, action: reply.action });
      this.rerender();
      setTimeout(() => {
        const box = document.getElementById('ai-msgs-scroll');
        if (box) box.scrollTop = box.scrollHeight;
      }, 60);
    },

    async submitTicket(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const subject = document.getElementById('tk-subject').value.trim();
      const message = document.getElementById('tk-message').value.trim();
      try {
        await app.db.collection('supportTickets').add({
          userId: app.user.uid,
          userName: app.profile.companyName || app.profile.name || '',
          userEmail: app.profile.email || app.user.email || '',
          subject,
          message,
          status: 'open',
          adminReply: '',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast(isAr ? 'تم إرسال تذكرة الدعم للإدارة بنجاح' : 'Support ticket submitted', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    renderAiTab(app) {
      const isAr = app.lang === 'ar';
      const quickChips = isAr
        ? ['إزاي أسحب فلوسي؟', 'طرق الإيداع وإنستا باي', 'نظام الضمان 3.5%', 'توثيق الأفراد والشركات', 'أسعار الباقات', 'المعاينات وعمالة VIP']
        : ['How to withdraw?', 'Deposit & InstaPay', '3.5% Escrow', 'KYC Verification', 'Plans & Pricing', 'Inspections & VIP'];

      return `
        <div class="space-y-3">
          <div class="p-3 rounded-2xl bg-gradient-to-r from-purple-900/50 to-slate-900 border border-purple-500/40 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center text-base"><i class="fa-solid fa-robot"></i></span>
              <div>
                <div class="text-xs font-black text-white">${isAr ? 'المساعد الذكي (AI مجاني 24/7)' : 'Free AI Assistant 24/7'}</div>
                <div class="text-[10px] text-purple-200">${isAr ? 'رد فوري على كل استفسارات ضمان سايت' : 'Instant answers on all DamanSite rules'}</div>
              </div>
            </div>
            <button onclick="DamanChat.openDirectChat('admin','إدارة ضمان سايت')" class="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px]">
              ${isAr ? 'كلّم الإدارة' : 'Admin Chat'}
            </button>
          </div>

          <div id="ai-msgs-scroll" class="glass-card rounded-2xl p-3 space-y-2.5 h-[300px] overflow-y-auto">
            ${this.aiHistory.map((m) => `
              <div class="flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${m.sender === 'user' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-100 border border-slate-700'}">
                  ${app.esc(m.text).replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}
                  ${m.action ? `<div class="mt-2"><button onclick="${m.action.fn}" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">${app.esc(m.action.label)}</button></div>` : ''}
                </div>
              </div>`).join('')}
          </div>

          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            ${quickChips.map((q) => `
              <button type="button" onclick="DamanChat.askAi('${q}')" class="shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-purple-400 text-[10px] font-bold text-slate-200">${q}</button>`).join('')}
          </div>

          <form onsubmit="event.preventDefault(); DamanChat.askAi();" class="flex gap-2">
            <input id="ai-chat-input" type="text" placeholder="${isAr ? 'اكتب سؤالك هنا...' : 'Ask your question...'}" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    renderChatRoom(app) {
      const isAr = app.lang === 'ar';
      const meta = this.activeChatMeta || {};
      return `
        <div class="space-y-2.5">
          <div class="glass-card rounded-2xl p-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <button onclick="DamanChat.closeActiveChat()" class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
                <i class="fa-solid fa-arrow-${isAr ? 'right' : 'left'}"></i>
              </button>
              <div class="min-w-0">
                <div class="text-xs font-black text-white truncate">${app.esc(meta.otherName || 'Chat')}</div>
                ${meta.projectTitle ? `<div class="text-[10px] text-amber-300 truncate">${app.esc(meta.projectTitle)}</div>` : ''}
              </div>
            </div>
            <span class="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold shrink-0">${isAr ? 'متصل' : 'Live'}</span>
          </div>

          <div class="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-200">
            <i class="fa-solid fa-shield-halved me-1"></i> ${isAr ? 'لضمان حقك المالي، احجز قيمة الاتفاق عبر محفظة الضمان (3.5%) داخل التطبيق.' : 'Protect your payment by using DamanSite 3.5% Escrow.'}
          </div>

          <div id="chat-msgs-scroll" class="glass-card rounded-2xl p-3 space-y-2 h-[330px] overflow-y-auto">
            ${!this.messages.length
              ? `<div class="text-center text-xs text-slate-400 py-10">${isAr ? 'ابدأ المحادثة الآن...' : 'Start the conversation...'}</div>`
              : this.messages.map((m) => {
                  const mine = app.user && m.senderId === app.user.uid;
                  return `
                    <div class="flex ${mine ? 'justify-end' : 'justify-start'}">
                      <div class="max-w-[82%] rounded-2xl px-3 py-2 text-xs space-y-1 ${mine ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-white border border-slate-700'}">
                        ${!mine ? `<div class="text-[9px] text-amber-300 font-extrabold">${app.esc(m.senderName || '')}</div>` : ''}
                        ${m.imageBase64 ? `<img src="${m.imageBase64}" class="max-h-44 rounded-xl border border-black/20" />` : ''}
                        ${m.text ? `<div class="leading-relaxed whitespace-pre-line">${app.esc(m.text)}</div>` : ''}
                      </div>
                    </div>`;
                }).join('')}
          </div>

          <form onsubmit="DamanChat.sendChatMessage(event)" class="flex items-center gap-1.5">
            <label class="w-10 h-10 shrink-0 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 flex items-center justify-center cursor-pointer">
              <i class="fa-solid fa-image"></i>
              <input type="file" accept="image/*" class="hidden" onchange="DamanChat.sendChatImage(this)" />
            </label>
            <input id="chat-msg-input" type="text" placeholder="${isAr ? 'اكتب رسالتك...' : 'Type a message...'}" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button type="submit" class="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>`;
    },

    renderChatsListTab(app) {
      const isAr = app.lang === 'ar';
      if (!app.user) {
        return `<div class="glass-card rounded-2xl p-6 text-center space-y-3"><div class="text-xs text-slate-300">${isAr ? 'سجّل الدخول لعرض محادثاتك المباشرة' : 'Sign in to view your chats'}</div><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
      }
      if (this.activeChatId) return this.renderChatRoom(app);

      return `
        <div class="space-y-3">
          ${!app.isAdmin() ? `
            <button onclick="DamanChat.openDirectChat('admin','إدارة ضمان سايت')" class="w-full p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs font-extrabold text-amber-300">
              <span><i class="fa-solid fa-crown me-1.5"></i> ${isAr ? 'مراسلة إدارة ضمان سايت مباشرة' : 'Message DamanSite Admin'}</span>
              <i class="fa-solid fa-chevron-${isAr ? 'left' : 'right'}"></i>
            </button>` : ''}

          ${!this.chats.length
            ? `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">${isAr ? 'لا توجد محادثات بعد. اضغط «دردشة» على أي مشروع أو إعلان للبدء.' : 'No chats yet.'}</div>`
            : `<div class="space-y-2">
                ${this.chats.map((c) => {
                  const otherUid = (c.participants || []).find((id) => id !== app.user.uid) || 'admin';
                  const otherName = (c.participantNames && c.participantNames[otherUid]) || (otherUid === 'admin' ? 'إدارة ضمان سايت' : 'مستخدم');
                  return `
                    <div onclick="DamanChat.openChatRoom('${c.id}',{id:'${c.id}',otherUid:'${otherUid}',otherName:'${app.esc(otherName).replace(/'/g, "\\'")}',projectTitle:'${app.esc(c.projectTitle || '').replace(/'/g, "\\'")}'})"
                      class="glass-card rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:border-amber-500/40">
                      <div class="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center font-black text-sm shrink-0">${app.esc(otherName.charAt(0).toUpperCase())}</div>
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-extrabold text-white truncate">${app.esc(otherName)}</div>
                        ${c.projectTitle ? `<div class="text-[10px] text-amber-300 truncate">${app.esc(c.projectTitle)}</div>` : ''}
                        <div class="text-[11px] text-slate-400 truncate mt-0.5">${app.esc(c.lastMessage || '')}</div>
                      </div>
                    </div>`;
                }).join('')}
              </div>`}
        </div>`;
    },

    renderTicketsTab(app) {
      const isAr = app.lang === 'ar';
      if (!app.user) {
        return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button></div>`;
      }
      return `
        <div class="space-y-3.5">
          <form onsubmit="DamanChat.submitTicket(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-sky-400"><i class="fa-solid fa-ticket me-1"></i> ${isAr ? 'فتح تذكرة دعم رسمية للإدارة' : 'Open Support Ticket'}</h4>
            <input id="tk-subject" type="text" required placeholder="${isAr ? 'عنوان المشكلة أو الاستفسار' : 'Subject'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <textarea id="tk-message" rows="3" required placeholder="${isAr ? 'اكتب تفاصيل مشكلتك وسيرد عليك فريق الإدارة...' : 'Describe your issue...'}" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 text-slate-950 font-black text-xs">${isAr ? 'إرسال التذكرة' : 'Submit Ticket'}</button>
          </form>

          <div class="space-y-2">
            ${!this.tickets.length
              ? `<div class="text-center text-xs text-slate-400 py-4">${isAr ? 'لا توجد تذاكر دعم مفتوحة' : 'No support tickets'}</div>`
              : this.tickets.map((t) => `
                  <div class="glass-card rounded-2xl p-3 space-y-1.5">
                    <div class="flex items-center justify-between text-xs font-extrabold">
                      <span class="text-white">${app.esc(t.subject)}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full ${t.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">${t.status === 'resolved' ? (isAr ? 'تم الحل' : 'Resolved') : (isAr ? 'مفتوحة' : 'Open')}</span>
                    </div>
                    <p class="text-[11px] text-slate-300">${app.esc(t.message)}</p>
                    ${t.adminReply ? `<div class="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200"><b>${isAr ? 'رد الإدارة:' : 'Admin:'}</b> ${app.esc(t.adminReply)}</div>` : ''}
                  </div>`).join('')}
          </div>
        </div>`;
    },

    render(container, app) {
      this.ensureListeners(app);
      const isAr = app.lang === 'ar';
      const body =
        this.subTab === 'ai' ? this.renderAiTab(app)
        : this.subTab === 'chats' ? this.renderChatsListTab(app)
        : this.renderTicketsTab(app);

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanChat.setSubTab('ai')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'ai' ? 'bg-purple-500 text-white' : 'text-slate-400'}">${isAr ? 'الدعم الذكي AI' : 'AI Support'}</button>
            <button onclick="DamanChat.setSubTab('chats')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'chats' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'المحادثات' : 'Chats'}</button>
            <button onclick="DamanChat.setSubTab('tickets')" class="py-2 rounded-lg text-[11px] font-extrabold ${this.subTab === 'tickets' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'التذاكر' : 'Tickets'}</button>
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanChat = ChatMod;
  if (window.DamanApp) window.DamanApp.registerModule('chat', ChatMod);
})();
