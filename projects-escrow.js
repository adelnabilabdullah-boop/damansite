(function () {
  const FUTURE_BOOST = Date.now() + 365 * 24 * 60 * 60 * 1000;

  // 20 Built-in Showcase Ads covering ALL 17 Categories (Projects + Contractors + B2B Suppliers + 5 Featured ★)
  const DEMO_SHOWCASE_POSTS = [
    {
      id: 'demo_01', isDemo: true, postType: 'project', category: 'concrete',
      title: 'مطلوب فرقة نجارة مسلحة لشدة أسقف 4 فيلات (تسليم استشاري)',
      description: 'مطلوب مقاول نجارة مسلحة بطاقم كامل (10 نجارين + 4 مساعدين) لشدة أسقف وأعمدة بكمبوند بالتجمع الخامس — التعاقد بالضمان المالي 100% وصرف أسبوعي منتظم.',
      budget: 145000, city: 'القاهرة الجديدة — التجمع الخامس',
      ownerId: 'demo_daman', ownerName: 'شركة الرواد للمقاولات العامة', ownerVerified: true, ownerVip: true,
      boostedUntil: FUTURE_BOOST, status: 'approved', views: 214, date: '2026-11-20'
    },
    {
      id: 'demo_02', isDemo: true, postType: 'supplier', category: 'materials',
      title: 'توريد حديد عز وأسمنت السويس والعسكري بأسعار المصنع للمواقع B2B',
      description: 'توريد مباشر يومياً بكميات من 5 طن حتى 200 طن بضمان الوزن والفاتورة الضريبية والدفع المؤمّن عبر ضمان سايت عند الاستلام بالموقع.',
      budget: 39500, city: 'القاهرة والجيزة والعاصمة الإدارية',
      ownerId: 'demo_daman', ownerName: 'مجموعة النيل لتوريدات مواد البناء', ownerVerified: true, ownerVip: true,
      boostedUntil: FUTURE_BOOST, status: 'approved', views: 342, date: '2026-11-21'
    },
    {
      id: 'demo_03', isDemo: true, postType: 'worker', category: 'plaster',
      title: 'مقاول محارة وبياض (بؤج وأوتار وميزان ليزر) بضمان الاستلام الهندسي',
      description: 'تنفيذ أعمال المحارة الداخلية والواجهات للعمارات والفيلات بأعلى دقة (طرطشة مسمارية + بؤج وأوتار + زاوية 90) بأطقم جاهزة للنزول الفوري.',
      budget: 65, city: '6 أكتوبر والشيخ زايد والجيزة',
      ownerId: 'demo_daman', ownerName: 'المعلم محمود أبو سيف للمحارة', ownerVerified: true, ownerVip: true,
      boostedUntil: FUTURE_BOOST, status: 'approved', views: 189, date: '2026-11-21'
    },
    {
      id: 'demo_04', isDemo: true, postType: 'supplier', category: 'equipment',
      title: 'تأجير شدات معدنية وسقالات وجاكات وألواح بليوود وأوناش رفع',
      description: 'إيجار يومي وشهري لأحدث الشدات المعدنية الإيطالية والأكرو والأخشاب (لتزانة وموسكي وبليوود فنلندي) مع خدمة التوصيل الفوري لأي موقع.',
      budget: 18000, city: 'القاهرة الكبرى ومدينة بدر والعبور',
      ownerId: 'demo_daman', ownerName: 'المتحدة للشدات والمعدات الهندسية', ownerVerified: true, ownerVip: true,
      boostedUntil: FUTURE_BOOST, status: 'approved', views: 276, date: '2026-11-20'
    },
    {
      id: 'demo_05', isDemo: true, postType: 'project', category: 'general',
      title: 'مطلوب شركة تشطيب كامل لفيلا 360 م² (نصف تشطيب ← الترا سوبر لوكس)',
      description: 'تشطيب كامل بالخامات أو مصنعية وإشراف مع جدول زمني 90 يوم ومستخلصات محجوزة 100% في ضمان سايت واستلام هندسي لكل بند.',
      budget: 850000, city: 'مدينتي — القاهرة الجديدة',
      ownerId: 'demo_daman', ownerName: 'م. كريم الشريف (مالك مشروع)', ownerVerified: true, ownerVip: true,
      boostedUntil: FUTURE_BOOST, status: 'approved', views: 318, date: '2026-11-22'
    },
    {
      id: 'demo_06', isDemo: true, postType: 'worker', category: 'steel',
      title: 'فرقة حدادة مسلحة محترفة (قواعد، لبشة، أعمدة، وأسقف فلات سلاب)',
      description: 'قراءة لوحات إنشائية بدقة وتنفيذ تقطيع وتشكيل الحديد بدون هالك مع ضمان استلام الاستشاري من أول مرة.',
      budget: 1400, city: 'القاهرة والجيزة والعاصمة الإدارية',
      ownerId: 'demo_daman', ownerName: 'أبو يوسف للحدادة المسلحة', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 124, date: '2026-11-19'
    },
    {
      id: 'demo_07', isDemo: true, postType: 'project', category: 'masonry',
      title: 'مطلوب مقاول مباني طوب أحمر وأسمنتي لكمبوند سكني (1200 متر)',
      description: 'مباني قصية ردم وحوائط داخلية وخارجية بميزان خيط وقدّة — التعاقد بالمتر ومستخلص أسبوعي مضمون بالمحفظة.',
      budget: 96000, city: 'الشيخ زايد الجديدة',
      ownerId: 'demo_daman', ownerName: 'شركة المعمار الحديث للتطوير', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 141, date: '2026-11-19'
    },
    {
      id: 'demo_08', isDemo: true, postType: 'worker', category: 'plumbing',
      title: 'تأسيس وتشطيب سباكة (BR / بانينجر / جروهي دفن) باختبار ضغط معتمد',
      description: 'تأسيس حمامات ومطابخ وصرف معلق وخطوط تغذية مع اختبار كبس الشركة وشهادة ضمان 10 سنوات.',
      budget: 18500, city: 'المعادي ومدينة نصر والتجمع',
      ownerId: 'demo_daman', ownerName: 'فريق الهندسة للتأسيس الصحي', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 98, date: '2026-11-18'
    },
    {
      id: 'demo_09', isDemo: true, postType: 'worker', category: 'electrical',
      title: 'تأسيس كهرباء ولوحات توزيع وسمارت هوم (سلك السويدي الأصلي)',
      description: 'توزيع أحمال هندسي، مسارات تيار خفيف (نت، كاميرات، إنتركم، ساوند سيستم) وتقفيل لوحات باحترافية.',
      budget: 24000, city: 'القاهرة الجديدة والرحاب والشروق',
      ownerId: 'demo_daman', ownerName: 'م. طارق عبد الرحمن — كهرباء سمارت', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 112, date: '2026-11-18'
    },
    {
      id: 'demo_10', isDemo: true, postType: 'project', category: 'ceramic',
      title: 'مطلوب صنايعية تركيب بورسلين 60×120 بالمادة ورخام درج (650 م²)',
      description: 'تركيب أرضيات بورسلين بكلبسات التسوية الليزر ورخام تريستا وجلالة للمداخل والسلالم بمشروع إداري.',
      budget: 78000, city: 'العاصمة الإدارية الجديدة',
      ownerId: 'demo_daman', ownerName: 'مكتب إعمار للتشطيبات', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 165, date: '2026-11-18'
    },
    {
      id: 'demo_11', isDemo: true, postType: 'worker', category: 'gypsum',
      title: 'تنفيذ أسقف جبسمبورد كناوف وبيوت نور مخفي ومكتبات شاشة',
      description: 'تركيب ألواح كناوف الأخضر والأبيض بصاج 0.45 أصلي وتشطيب معجون وشريط فايبر جاهز على الدهان.',
      budget: 290, city: 'الجيزة والهرم وفيصل وأكتوبر',
      ownerId: 'demo_daman', ownerName: 'ديكور بلس للجبسمبورد', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 87, date: '2026-11-17'
    },
    {
      id: 'demo_12', isDemo: true, postType: 'worker', category: 'painting',
      title: 'فريق نقاشة ودهانات جوتن وجي إل سي (سحب سكاكين واستلام على الكشاف)',
      description: 'تأسيس سيلر مائي و3 سكاكين معجون وبطانة ووشين فينيش جوتن بالكمبيوتر بأفضل سعر للمتر.',
      budget: 55, city: 'القاهرة والجيزة',
      ownerId: 'demo_daman', ownerName: 'الأمانة للدهانات والديكور', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 94, date: '2026-11-17'
    },
    {
      id: 'demo_13', isDemo: true, postType: 'supplier', category: 'carpentry',
      title: 'تصنيع وتركيب أبواب شقق مصفحة وأبواب غرف قشرة أرو ومطابخ HPL',
      description: 'ورشة نجارة متكاملة لتوريد أبواب المشروعات السكنية والفيلات بمفصلات إيطالي ودهانات أستر ودوكو فرن.',
      budget: 12500, city: 'مدينة بدر والعاشر والقاهرة',
      ownerId: 'demo_daman', ownerName: 'مصنع الأندلس للأعمال الخشبية', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 79, date: '2026-11-16'
    },
    {
      id: 'demo_14', isDemo: true, postType: 'supplier', category: 'aluminum',
      title: 'توريد وتركيب شبابيك ألوميتال PS وجامبو وتانجو وواجهات زجاج سيكوريت',
      description: 'زجاج دبل عازل للصوت والحرارة وإكسسوارات أصلية مع رفع المقاسات مجاناً والتركيب خلال 10 أيام.',
      budget: 4800, city: 'القاهرة والجيزة والساحل',
      ownerId: 'demo_daman', ownerName: 'الماسة للألوميتال والواجهات', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 103, date: '2026-11-16'
    },
    {
      id: 'demo_15', isDemo: true, postType: 'project', category: 'insulation',
      title: 'مطلوب شركة عزل أسطح وحمامات (أنسومات 4مم + سيكا 107) مساحة 900 متر',
      description: 'عزل رطوبة وحرارة لسطح عمارة و16 حمام مع اختبار الغمر بالمياه 48 ساعة قبل صرف المستخلص.',
      budget: 115000, city: 'حدائق أكتوبر',
      ownerId: 'demo_daman', ownerName: 'شركة البنيان للتطوير العقاري', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 88, date: '2026-11-15'
    },
    {
      id: 'demo_16', isDemo: true, postType: 'supplier', category: 'hvac',
      title: 'تأسيس مواسير نحاس جنوب أفريقي وتوريد وتركيب تكييفات كونسيلد وسبليت',
      description: 'تأسيس صرف التكييف والنحاس المعزول + توريد وتركيب كاريير وميديا وشرب بضمان الوكيل.',
      budget: 34000, city: 'القاهرة الجديدة والمعادي وزايد',
      ownerId: 'demo_daman', ownerName: 'كول تك للتكييف المركزي', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 76, date: '2026-11-15'
    },
    {
      id: 'demo_17', isDemo: true, postType: 'project', category: 'landscape',
      title: 'مطلوب تنفيذ لاندسكيب وشبكة ري وحمام سباحة أوفر فلو لفيلا خاصة',
      description: 'تنفيذ هارد سكيب وبرجولة خشب ومشايات بازلت وحمام سباحة 4×8 متر كامل بالميكانيكا والفلاتر.',
      budget: 420000, city: 'المستقبل سيتي — القاهرة الجديدة',
      ownerId: 'demo_daman', ownerName: 'م. شريف حافظ', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 132, date: '2026-11-15'
    },
    {
      id: 'demo_18', isDemo: true, postType: 'supplier', category: 'materials',
      title: 'توريد رمل حرش وسن 1 و2 وطوب أحمر طفلي بعربيات مقطورة 24 ساعة',
      description: 'تشوين فوري للمواقع بضمان الكيل والمقاس وتوريد خرسانة جاهزة بمضخة (C25 / C30 / C35) بأفضل سعر للمتر.',
      budget: 8500, city: 'البدرشين والجيزة وأكتوبر والقاهرة',
      ownerId: 'demo_daman', ownerName: 'أولاد الحاج للتشوينات والمحاجر B2B', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 158, date: '2026-11-14'
    },
    {
      id: 'demo_19', isDemo: true, postType: 'worker', category: 'concrete',
      title: 'مقاول شدات خشبية ومعدنية وصَب خرسانات (فيلات + عمارات + أسوار)',
      description: 'تنفيذ القواعد المسلحة والأعمدة والأسقف الكمرية والفلات سلاب مع إشراف ميداني كامل والتزام تام بالمواعيد.',
      budget: 650, city: 'القاهرة والجيزة والمدن الجديدة',
      ownerId: 'demo_daman', ownerName: 'فريق التميز للخرسانات والشدات', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 147, date: '2026-11-14'
    },
    {
      id: 'demo_20', isDemo: true, postType: 'project', category: 'general',
      title: 'مطلوب مقاول باطن لأعمال ترميم وتدعيم واجهات مبنى إداري (5 أدوار)',
      description: 'صنفرة حديد ودهان كيمابوكسي وتلبيش جراوت وتشطيب واجهة جرافيتو مع التزام كامل بتعليمات السلامة.',
      budget: 210000, city: 'وسط البلد والمهندسين — الجيزة',
      ownerId: 'demo_daman', ownerName: 'المجموعة الهندسية للمشروعات', ownerVerified: true, ownerVip: false,
      boostedUntil: 0, status: 'approved', views: 119, date: '2026-11-13'
    }
  ];

  const ProjectsMod = {
    subTab: 'market', // 'market' | 'ledger' | 'inspection' | 'viplabor'
    marketFilter: 'all', // 'all' | 'project' | 'worker' | 'supplier' | 'favorites'
    selectedCategory: 'all',
    searchQuery: '',

    projects: [],
    ledgerEntries: [],
    inspectionReqs: [],
    vipLaborReqs: [],

    attachedUid: null,
    unsubProjects: null,
    unsubLedger: null,
    unsubInspect: null,
    unsubVipLabor: null,

    viewedSession: new Set(),
    tempPostPhoto: '',

    getAllMarketPosts(app) {
      const a = app || window.DamanApp;
      const hideDemo = !!(a && a.appConfig && a.appConfig.hideDemoPosts);
      const combined = hideDemo ? [...this.projects] : [...this.projects, ...DEMO_SHOWCASE_POSTS];
      return combined.sort((x, y) => {
        const xb = Number(x.boostedUntil || 0) > Date.now() ? 1 : 0;
        const yb = Number(y.boostedUntil || 0) > Date.now() ? 1 : 0;
        if (yb !== xb) return yb - xb;
        const xr = x.isDemo ? 0 : 1;
        const yr = y.isDemo ? 0 : 1;
        if (yr !== xr) return yr - xr;
        return (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0);
      });
    },

    getFeaturedPosts(limit = 5) {
      const all = this.getAllMarketPosts(window.DamanApp);
      return all.filter((p) => p.status === 'approved' && Number(p.boostedUntil || 0) > Date.now()).slice(0, limit);
    },

    ensureListeners(app) {
      if (!this.unsubProjects) {
        this.unsubProjects = app.db
          .collection('projects')
          .limit(120)
          .onSnapshot(
            (snap) => {
              this.projects = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
              if (app.activeTab === 'projects' && this.subTab === 'market') this.rerender();
              if (app.activeTab === 'home') app.renderCurrentTab();
            },
            () => {}
          );
      }

      const curUid = app.user ? app.user.uid : null;
      if (this.attachedUid === curUid) return;
      this.detachUserListeners();
      this.attachedUid = curUid;
      if (!curUid) return;

      this.unsubLedger = app.db.collection('siteLedger').where('ownerId', '==', curUid).limit(150).onSnapshot((snap) => {
        this.ledgerEntries = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'projects' && this.subTab === 'ledger') this.rerender();
      }, () => {});

      this.unsubInspect = app.db.collection('vipRequests').where('userId', '==', curUid).limit(40).onSnapshot((snap) => {
        this.inspectionReqs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'projects' && this.subTab === 'inspection') this.rerender();
      }, () => {});

      this.unsubVipLabor = app.db.collection('vipLaborRequests').where('userId', '==', curUid).limit(40).onSnapshot((snap) => {
        this.vipLaborReqs = snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (app.activeTab === 'projects' && this.subTab === 'viplabor') this.rerender();
      }, () => {});
    },

    detachUserListeners() {
      ['unsubLedger', 'unsubInspect', 'unsubVipLabor'].forEach((k) => {
        if (this[k]) { try { this[k](); } catch (e) {} this[k] = null; }
      });
      this.attachedUid = null;
      this.ledgerEntries = [];
      this.inspectionReqs = [];
      this.vipLaborReqs = [];
    },

    detachListeners() {
      this.detachUserListeners();
      if (this.unsubProjects) { try { this.unsubProjects(); } catch (e) {} this.unsubProjects = null; }
      this.projects = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'projects') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(t) { this.subTab = t; this.rerender(); },
    setMarketFilter(f) { this.marketFilter = f; this.rerender(); },
    setCategory(c) { this.selectedCategory = c; this.rerender(); },

    onSearchInput(val) {
      this.searchQuery = val || '';
      const box = document.getElementById('daman-market-list-slot');
      if (box) box.innerHTML = this.renderMarketCards(window.DamanApp);
    },

    catLabel(id) {
      const c = (window.DamanApp.CATEGORIES || []).find((x) => x.id === id);
      return c ? (window.DamanApp.lang === 'ar' ? c.ar : c.en) : (id || 'عام');
    },

    postTypeLabel(t) {
      if (t === 'supplier') return '🚚 توريد خامات B2B';
      if (t === 'worker') return '👷 مقاول / فني';
      return '🏗️ مطلوب تنفيذ / مشروع';
    },

    // ==================== CREATE / EDIT / CLOSE / BOOST (BONUS FIRST) / FAVORITE ====================
    openPostModal() {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      if (!app.isKycVerified()) return app.toast('يجب توثيق الحساب أولاً', 'warning');
      if (app.appConfig?.disableMarketPosting && !app.isAdmin()) {
        return app.toast('نشر الإعلانات الجديدة متوقف مؤقتاً للصيانة من الإدارة', 'warning');
      }
      this.openPostEditorModal(null);
    },

    openEditPostModal(pid) {
      const post = this.projects.find((x) => x.id === pid);
      if (post) return this.openPostEditorModal(post);
      window.DamanApp.db.collection('projects').doc(pid).get().then((s) => {
        if (s.exists) this.openPostEditorModal(Object.assign({ id: s.id }, s.data()));
      }).catch(() => {});
    },

    openPostEditorModal(existing) {
      const app = window.DamanApp;
      this.tempPostPhoto = existing?.imageBase64 || '';
      let m = document.getElementById('daman-post-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-post-modal';
        m.className = 'daman-modal fixed inset-0 z-[88] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const catsOpt = app.CATEGORIES.map((c) => `<option value="${c.id}" ${existing?.category === c.id ? 'selected' : ''}>${app.esc(c.ar)}</option>`).join('');
      const defType = existing?.postType || (app.profile?.accountType === 'supplier' ? 'supplier' : 'project');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-amber-400">${existing ? 'تعديل الإعلان' : 'نشر إعلان / مشروع / عرض توريد B2B'}</h3>
            <button onclick="document.getElementById('daman-post-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form onsubmit="DamanProjects.savePost(event,'${existing ? existing.id : ''}')" class="space-y-2.5">
            <div class="grid grid-cols-2 gap-2">
              <select id="pm-type" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold">
                <option value="project" ${defType === 'project' ? 'selected' : ''}>مطلوب تنفيذ / عمالة</option>
                <option value="worker" ${defType === 'worker' ? 'selected' : ''}>مقاول / فني متاح</option>
                <option value="supplier" ${defType === 'supplier' ? 'selected' : ''}>توريد خامات ومعدات B2B</option>
              </select>
              <select id="pm-cat" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold">${catsOpt}</select>
            </div>
            <input id="pm-title" type="text" required value="${app.esc(existing?.title || '')}" placeholder="عنوان الإعلان" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="pm-budget" type="number" min="0" step="any" value="${existing?.budget || ''}" placeholder="الميزانية / السعر (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="pm-city" type="text" required value="${app.esc(existing?.city || app.profile?.city || '')}" placeholder="المدينة / الموقع" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <textarea id="pm-desc" rows="3" required placeholder="تفاصيل العمل والكميات والمواصفات..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white">${app.esc(existing?.description || '')}</textarea>
            <label class="block p-2.5 rounded-xl border border-dashed border-emerald-500/50 bg-slate-950 text-center cursor-pointer">
              <span class="font-bold text-emerald-300"><i class="fa-solid fa-image me-1"></i> صورة (اختياري)</span>
              <input type="file" accept="image/*" class="hidden" onchange="DamanProjects.handlePostPhoto(this)" />
              <div id="pm-photo-prev">${this.tempPostPhoto ? `<img src="${this.tempPostPhoto}" class="max-h-24 mx-auto rounded mt-1.5" />` : ''}</div>
            </label>
            ${app.isAdmin() ? `<label class="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 font-bold"><input id="pm-admin-boost" type="checkbox" checked class="accent-amber-500" /> تثبيت كإعلان مميز ★ مجاناً (صلاحية الإدارة)</label>` : ''}
            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black">${existing ? 'حفظ التعديلات' : 'نشر الإعلان الآن'}</button>
          </form>
        </div>`;
    },

    async handlePostPhoto(input) {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        this.tempPostPhoto = await window.DamanApp.compressImage(f, 580, 0.52);
        const p = document.getElementById('pm-photo-prev');
        if (p) p.innerHTML = `<img src="${this.tempPostPhoto}" class="max-h-24 mx-auto rounded mt-1.5" />`;
      } catch (e) {}
    },

    async savePost(e, existingId) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!existingId && app.appConfig?.disableMarketPosting && !app.isAdmin()) {
        return app.toast('نشر الإعلانات متوقف مؤقتاً من الإدارة', 'warning');
      }
      await app.withLock('savePost', async () => {
        const adminBoost = app.isAdmin() && document.getElementById('pm-admin-boost')?.checked;
        const payload = {
          postType: document.getElementById('pm-type').value,
          category: document.getElementById('pm-cat').value,
          title: document.getElementById('pm-title').value.trim(),
          budget: parseFloat(document.getElementById('pm-budget').value) || 0,
          city: document.getElementById('pm-city').value.trim(),
          description: document.getElementById('pm-desc').value.trim(),
          imageBase64: this.tempPostPhoto || '',
          status: app.hasAdminAccess() ? 'approved' : 'pending_review',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (adminBoost) payload.boostedUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;

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
              boostedUntil: adminBoost ? Date.now() + 30 * 24 * 60 * 60 * 1000 : 0,
              date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await app.db.collection('projects').add(payload);
            if (!app.hasAdminAccess()) await app.sendNotification('ADMIN', 'إعلان جديد للمراجعة 📢', payload.title);
            app.toast(app.hasAdminAccess() ? 'تم نشر الإعلان مباشرة ✅' : 'تم الإرسال لمراجعة الإدارة ✅', 'success');
          }
          document.getElementById('daman-post-modal').classList.add('hidden');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async toggleClosePost(pid) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      if (!p) return;
      const next = p.status === 'closed' ? (app.hasAdminAccess() ? 'approved' : 'pending_review') : 'closed';
      if (!window.confirm(next === 'closed' ? 'إغلاق الإعلان؟' : 'إعادة فتح الإعلان؟')) return;
      await app.db.collection('projects').doc(pid).update({ status: next });
      app.toast('تم التحديث ✅', 'success');
    },

    async toggleFavorite(pid) {
      const app = window.DamanApp;
      if (!app.user || !app.profile) return app.openAuthModal('login');
      const favs = Array.isArray(app.profile.favorites) ? app.profile.favorites : [];
      const exists = favs.includes(pid);
      await app.db.collection('users').doc(app.user.uid).update({
        favorites: exists ? firebase.firestore.FieldValue.arrayRemove(pid) : firebase.firestore.FieldValue.arrayUnion(pid)
      });
      app.toast(exists ? 'تمت الإزالة من المفضلة' : 'تم الحفظ في المفضلة ❤️', 'info');
    },

    // Uses Bonus Balance FIRST, then Cash Available — Clean Cash/Bonus Trial Balance Accounting
    async boostPost(pid) {
      const app = window.DamanApp;
      const p = this.projects.find((x) => x.id === pid);
      if (!p || !app.user) return;
      if (app.isAdmin()) {
        await app.db.collection('projects').doc(pid).update({ boostedUntil: Date.now() + 30 * 24 * 60 * 60 * 1000 });
        return app.toast('تم تمييز الإعلان مجاناً بصلاحية الإدارة ★', 'success');
      }

      const price = Number(app.appConfig?.packages?.boostAdPrice || 75);
      const avail = Number(app.profile?.balanceAvailable || 0);
      const bonus = Number(app.profile?.balanceBonus || 0);
      if (avail + bonus < price) {
        const diff = Math.round((price - (avail + bonus)) * 100) / 100;
        if (window.confirm(`تمييز الإعلان لمدة 7 أيام بـ ${app.fmtMoney(price)} ج.م — شحن الفرق (${app.fmtMoney(diff)} ج.م) الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(diff);
        }
        return;
      }

      const willBonus = Math.min(bonus, price);
      const willCash = Math.round((price - willBonus) * 100) / 100;
      const noteEx = willBonus > 0 ? `\n(سيتم خصم ${app.fmtMoney(willBonus)} ج.م من رصيد الهدايا + ${app.fmtMoney(willCash)} ج.م من المتاح)` : '';
      if (!window.confirm(`تأكيد تمييز الإعلان لمدة 7 أيام بـ ${app.fmtMoney(price)} ج.م؟${noteEx}`)) return;

      await app.withLock('boost_' + pid, async () => {
        const uRef = app.db.collection('users').doc(app.user.uid);
        const pRef = app.db.collection('projects').doc(pid);
        try {
          await app.db.runTransaction(async (tx) => {
            const uDoc = await tx.get(uRef);
            const d = uDoc.data() || {};
            const curAvail = Number(d.balanceAvailable || 0);
            const curBonus = Number(d.balanceBonus || 0);
            if (curAvail + curBonus < price) throw new Error('الرصيد غير كافٍ');

            const bonusUsed = Math.round(Math.min(curBonus, price) * 100) / 100;
            const cashPaid = Math.round((price - bonusUsed) * 100) / 100;
            const afterAvail = Math.round((curAvail - cashPaid) * 100) / 100;
            const afterBonus = Math.round((curBonus - bonusUsed) * 100) / 100;

            tx.update(uRef, { balanceAvailable: afterAvail, balanceBonus: afterBonus });
            tx.update(pRef, { boostedUntil: Date.now() + 7 * 24 * 60 * 60 * 1000 });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'ad_boost', amount: -price, cashPaid, bonusUsed,
              balanceBefore: curAvail, balanceAfter: afterAvail,
              note: `تمييز إعلان: ${p.title}`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(app.db.collection('platformFees').doc(), {
              type: 'ad_boost', projectId: pid, userId: app.user.uid, userName: app.profile?.name || '',
              amount: cashPaid, cashPaid, bonusUsed, grossPrice: price,
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          app.toast('تم تمييز إعلانك وتثبيته بأعلى السوق والصفحة الرئيسية ★', 'success');
        } catch (e) { app.toast(e.message, 'error'); }
      });
    },

    openPostDetails(pid) {
      const app = window.DamanApp;
      const p = this.getAllMarketPosts(app).find((x) => x.id === pid);
      if (!p) return;

      if (!p.isDemo && !this.viewedSession.has(pid) && app.user && p.ownerId !== app.user.uid) {
        this.viewedSession.add(pid);
        app.db.collection('projects').doc(pid).update({ views: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
      }

      let m = document.getElementById('daman-post-detail-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-post-detail-modal';
        m.className = 'daman-modal fixed inset-0 z-[86] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');
      const isOwner = !p.isDemo && app.user && p.ownerId === app.user.uid;
      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-4 max-h-[90vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex items-center justify-between gap-2">
            <span class="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 font-black text-[10px]">${this.postTypeLabel(p.postType)}</span>
            <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <h3 class="text-sm font-black text-white">${app.esc(p.title)}</h3>
          ${p.imageBase64 ? `<img src="${p.imageBase64}" onclick="DamanApp.openMediaLightbox('${p.imageBase64}','${app.esc(p.title)}')" class="w-full max-h-56 object-cover rounded-2xl border border-slate-700 cursor-pointer" />` : ''}
          <p class="text-slate-200 leading-relaxed whitespace-pre-line">${app.esc(p.description || '')}</p>
          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
            <div>التخصص: <b class="text-amber-300">${app.esc(this.catLabel(p.category))}</b></div>
            <div>الموقع: <b class="text-white">${app.esc(p.city || '—')}</b></div>
            <div>السعر/الميزانية: <b class="text-emerald-400">${p.budget ? app.fmtMoney(p.budget) + ' ج.م' : 'بالاتفاق'}</b></div>
            <div>المشاهدات: <b class="text-slate-300">${Number(p.views || 0)}</b></div>
          </div>
          <div ${!p.isDemo ? `onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); DamanApp.openPublicProfile('${p.ownerId}')"` : ''} class="p-2.5 rounded-xl bg-slate-800/80 flex items-center justify-between ${!p.isDemo ? 'cursor-pointer' : ''}">
            <div>
              <div class="font-black text-white">${app.esc(p.ownerName || 'مستخدم')} ${p.ownerVerified ? '<i class="fa-solid fa-circle-check text-emerald-400 ms-1"></i>' : ''}</div>
              <div class="text-[10px] text-amber-300">${p.isDemo ? 'بإشراف وضمان إدارة ضمان سايت' : 'اضغط لزيارة الصفحة وسابقة الأعمال'}</div>
            </div>
            <i class="fa-solid fa-shield-halved text-amber-400"></i>
          </div>
          <div class="flex gap-2">
            ${!isOwner ? `
              <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); if(window.DamanChat) DamanChat.openDirectChat('${p.ownerId}','${app.esc(p.ownerName || '').replace(/'/g, "\\'")}','${p.id}','${app.esc(p.title).replace(/'/g, "\\'")}')" class="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">
                <i class="fa-solid fa-comments me-1"></i> مراسلة واتفاق بالضمان
              </button>
              ${!p.isDemo ? `<button onclick="DamanApp.reportUserOrPost('project','${p.id}','${app.esc(p.title).replace(/'/g, "\\'")}')" class="px-3.5 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold"><i class="fa-solid fa-flag"></i></button>` : ''}` : `
              <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); DamanProjects.openEditPostModal('${p.id}')" class="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">تعديل</button>
              <button onclick="document.getElementById('daman-post-detail-modal').classList.add('hidden'); DamanProjects.boostPost('${p.id}')" class="flex-1 py-2.5 rounded-xl bg-purple-500 text-white font-black">★ تمييز</button>`}
          </div>
        </div>`;
    },

    // ==================== SITE LEDGER, 3x INSPECTION & VIP LABOR ====================
    async submitLedgerEntry(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user) return app.openAuthModal('login');
      const workerName = document.getElementById('ld-worker').value.trim();
      const entryType = document.getElementById('ld-type').value;
      const amount = Math.round((parseFloat(document.getElementById('ld-amt').value) || 0) * 100) / 100;
      const siteName = document.getElementById('ld-site').value.trim();
      const note = document.getElementById('ld-note').value.trim();
      if (!workerName || amount <= 0) return;
      await app.db.collection('siteLedger').add({
        ownerId: app.user.uid, workerName, entryType, amount, siteName, note, date: app.todayLocal(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      e.target.reset();
      app.toast('تم التسجيل في دفتر الموقع ✅', 'success');
    },

    async deleteLedgerEntry(id) {
      if (!window.confirm('حذف هذا القيد؟')) return;
      await window.DamanApp.db.collection('siteLedger').doc(id).delete();
    },

    ledgerTypeLabel(t) {
      return { wage: 'يومية (+)', overtime: 'إضافي/سهر (+)', advance: 'سلفة (-)', deduction: 'خصم (-)', custody: 'عهدة موقع' }[t] || t;
    },

    printLedgerA4() {
      const app = window.DamanApp;
      const byWorker = {};
      this.ledgerEntries.forEach((x) => {
        const k = x.workerName || 'غير مسمى';
        if (!byWorker[k]) byWorker[k] = { wages: 0, advances: 0, deductions: 0, custody: 0 };
        if (x.entryType === 'wage' || x.entryType === 'overtime') byWorker[k].wages += Number(x.amount || 0);
        else if (x.entryType === 'advance') byWorker[k].advances += Number(x.amount || 0);
        else if (x.entryType === 'deduction') byWorker[k].deductions += Number(x.amount || 0);
        else if (x.entryType === 'custody') byWorker[k].custody += Number(x.amount || 0);
      });
      const summaryRows = Object.entries(byWorker).map(([name, s], i) => `<tr><td>${i + 1}</td><td><b>${app.esc(name)}</b></td><td>${app.fmtMoney(s.wages)}</td><td>${app.fmtMoney(s.advances)}</td><td>${app.fmtMoney(s.deductions)}</td><td>${app.fmtMoney(s.custody)}</td><td><b>${app.fmtMoney(Math.round((s.wages - s.advances - s.deductions) * 100) / 100)} ج.م</b></td></tr>`).join('');
      const detailRows = this.ledgerEntries.map((x, i) => `<tr><td>${i + 1}</td><td>${app.esc(x.date || '')}</td><td>${app.esc(x.workerName)}</td><td>${this.ledgerTypeLabel(x.entryType)}</td><td>${app.esc(x.siteName || '—')}</td><td>${app.esc(x.note || '—')}</td><td><b>${app.fmtMoney(x.amount)} ج.م</b></td></tr>`).join('');
      window.DamanPrint(`
        <div style="border:2px solid #000; padding:14px 16px;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
            <div><h2 style="margin:0; font-size:16px;">تصفية حساب العمال واليوميات والعهدة — ضمان سايت</h2></div>
            <div style="font-size:11px;"><b>التاريخ:</b> ${app.todayLocal()}</div>
          </div>
          <table style="margin-bottom:12px;"><thead><tr><th>#</th><th>الاسم</th><th>يوميات وإضافي</th><th>السلف</th><th>الخصومات</th><th>عهدة</th><th>الصافي</th></tr></thead><tbody>${summaryRows || '<tr><td colspan="7" style="text-align:center;">لا توجد قيود</td></tr>'}</tbody></table>
          <table><thead><tr><th>#</th><th>التاريخ</th><th>الاسم</th><th>النوع</th><th>الموقع</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>${detailRows || '<tr><td colspan="7" style="text-align:center;">لا توجد قيود</td></tr>'}</tbody></table>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-top:24px; text-align:center; font-size:11px;">
            <div><b>مشرف التنفيذ</b><br/><br/>..........................</div>
            <div><b>مهندس التنفيذ</b><br/><br/>..........................</div>
            <div><b>مدير المشروع</b><br/><br/>..........................</div>
          </div>
        </div>`);
    },

    async submitInspectionRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      await app.withLock('inspReq', async () => {
        const element = document.getElementById('ins-elem').value;
        const location = document.getElementById('ins-loc').value.trim();
        const area = document.getElementById('ins-area').value.trim();
        const preferredDate = document.getElementById('ins-date').value;
        const notes = document.getElementById('ins-notes').value.trim();
        await app.db.collection('vipRequests').add({
          userId: app.user.uid, userName: app.profile?.companyName || app.profile?.name || '', userPhone: app.profile?.phone || '',
          element, location, area, preferredDate, notes, quotedPrice: 0, status: 'pending', date: app.todayLocal(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', 'طلب استلام هندسي 3x 🛡️', `${app.profile?.name} — ${element} (${location})`);
        e.target.reset();
        app.toast('تم إرسال طلب الاستلام الهندسي 3x ✅', 'success');
      });
    },

    async payInspectionRequest(reqId) {
      const app = window.DamanApp;
      const req = this.inspectionReqs.find((x) => x.id === reqId);
      if (!req || req.status !== 'quoted' || Number(req.quotedPrice || 0) <= 0) return;
      const price = Number(req.quotedPrice);
      const avail = Number(app.profile?.balanceAvailable || 0);
      if (avail < price) {
        if (window.confirm(`رسوم الاستلام ${app.fmtMoney(price)} ج.م — شحن الفرق الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(price - avail);
        }
        return;
      }
      if (!window.confirm(`تأكيد دفع ${app.fmtMoney(price)} ج.م من المحفظة؟`)) return;
      await app.withLock('payIns_' + reqId, async () => {
        const uRef = app.db.collection('users').doc(app.user.uid);
        const rRef = app.db.collection('vipRequests').doc(reqId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [uDoc, rDoc] = await Promise.all([tx.get(uRef), tx.get(rRef)]);
            if (rDoc.data().status !== 'quoted') throw new Error('حالة الطلب تغيرت');
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            if (curAvail < price) throw new Error('الرصيد غير كافٍ');
            const afterAvail = Math.round((curAvail - price) * 100) / 100;

            tx.update(uRef, { balanceAvailable: afterAvail });
            tx.update(rRef, { status: 'paid', paidAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'inspection_3x', amount: -price,
              balanceBefore: curAvail, balanceAfter: afterAvail,
              note: `استلام هندسي 3x (${req.element})`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            tx.set(app.db.collection('platformFees').doc(), {
              type: 'inspection_3x', requestId: reqId, userId: app.user.uid, userName: app.profile?.name || '',
              amount: price, cashPaid: price, bonusUsed: 0,
              date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          });
          app.toast('تم الدفع وتأكيد موعد الاستلام الهندسي 3x ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    async submitVipLaborRequest(e) {
      e.preventDefault();
      const app = window.DamanApp;
      if (!app.user || !app.isKycVerified()) return;
      await app.withLock('vipLabReq', async () => {
        const trade = document.getElementById('vl-trade').value.trim();
        const workersCount = parseInt(document.getElementById('vl-count').value, 10) || 1;
        const days = parseInt(document.getElementById('vl-days').value, 10) || 1;
        const location = document.getElementById('vl-loc').value.trim();
        const notes = document.getElementById('vl-notes').value.trim();
        await app.db.collection('vipLaborRequests').add({
          userId: app.user.uid, userName: app.profile?.companyName || app.profile?.name || '', userPhone: app.profile?.phone || '',
          trade, workersCount, days, location, notes, baseCost: 0, vipFee: 0, totalQuoted: 0, status: 'pending',
          date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await app.sendNotification('ADMIN', 'طلب عمالة VIP جديد 👷', `${app.profile?.name}: ${workersCount} ${trade}`);
        e.target.reset();
        app.toast('تم إرسال طلب عمالة VIP ✅', 'success');
      });
    },

    async fundVipLaborRequest(reqId) {
      const app = window.DamanApp;
      const req = this.vipLaborReqs.find((x) => x.id === reqId);
      if (!req || req.status !== 'quoted') return;
      const baseCost = Math.round(Number(req.baseCost || 0) * 100) / 100;
      const vipFee = Math.round(Number(req.vipFee || baseCost * app.getVipCommissionRate()) * 100) / 100;
      const total = Math.round((baseCost + vipFee) * 100) / 100;
      const avail = Number(app.profile?.balanceAvailable || 0);
      if (avail < total) {
        if (window.confirm(`إجمالي الحجز ${app.fmtMoney(total)} ج.م — شحن الفرق الآن؟`)) {
          if (window.DamanWallet) window.DamanWallet.openDepositWithAmount(total - avail);
        }
        return;
      }
      if (!window.confirm(`تأكيد حجز عمالة VIP بمبلغ ${app.fmtMoney(total)} ج.م؟`)) return;
      await app.withLock('fundVip_' + reqId, async () => {
        const uRef = app.db.collection('users').doc(app.user.uid);
        const rRef = app.db.collection('vipLaborRequests').doc(reqId);
        try {
          await app.db.runTransaction(async (tx) => {
            const [uDoc, rDoc] = await Promise.all([tx.get(uRef), tx.get(rRef)]);
            if (rDoc.data().status !== 'quoted') throw new Error('حالة الطلب تغيرت');
            const curAvail = Number((uDoc.data() || {}).balanceAvailable || 0);
            const curEsc = Number((uDoc.data() || {}).balanceEscrow || 0);
            if (curAvail < total) throw new Error('الرصيد غير كافٍ');
            const afterAvail = Math.round((curAvail - total) * 100) / 100;

            tx.update(uRef, { balanceAvailable: afterAvail, balanceEscrow: Math.round((curEsc + baseCost) * 100) / 100 });
            tx.update(rRef, { status: 'funded', lockedBaseCost: baseCost, paidVipFee: vipFee, totalPaid: total, fundedAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.set(app.db.collection('transactions').doc(), {
              userId: app.user.uid, type: 'vip_labor_lock', amount: -total,
              balanceBefore: curAvail, balanceAfter: afterAvail,
              note: `حجز عمالة VIP (${req.trade})`, date: app.todayLocal(),
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (vipFee > 0) {
              tx.set(app.db.collection('platformFees').doc(), {
                type: 'vip_labor_fee', requestId: reqId, userId: app.user.uid, userName: app.profile?.name || '',
                amount: vipFee, cashPaid: vipFee, bonusUsed: 0,
                date: app.todayLocal(), createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          });
          app.toast('تم حجز عمالة VIP بنجاح ✅', 'success');
        } catch (err) { app.toast(err.message, 'error'); }
      });
    },

    // ==================== RENDER MARKET & SUB-TABS ====================
    renderMarketCards(app) {
      const myUid = app.user?.uid;
      const favs = Array.isArray(app.profile?.favorites) ? app.profile.favorites : [];
      const qNorm = app.normalizeAr(this.searchQuery);

      const list = this.getAllMarketPosts(app).filter((p) => {
        const isOwn = !p.isDemo && myUid && p.ownerId === myUid;
        if (p.status !== 'approved' && !isOwn && !app.hasAdminAccess()) return false;
        if (this.marketFilter === 'favorites') {
          if (!favs.includes(p.id)) return false;
        } else if (this.marketFilter !== 'all' && p.postType !== this.marketFilter) {
          return false;
        }
        if (this.selectedCategory !== 'all' && p.category !== this.selectedCategory) return false;
        if (qNorm) {
          const hay = app.normalizeAr(`${p.title} ${p.description} ${p.city} ${p.ownerName} ${this.catLabel(p.category)}`);
          if (!hay.includes(qNorm)) return false;
        }
        return true;
      });

      if (!list.length) {
        return `<div class="glass-card rounded-2xl p-7 text-center text-xs text-slate-400">لا توجد إعلانات مطابقة للبحث في هذا القسم.</div>`;
      }

      return list.map((p) => {
        const isOwn = !p.isDemo && myUid && p.ownerId === myUid;
        const isFav = favs.includes(p.id);
        const boosted = Number(p.boostedUntil || 0) > Date.now();
        return `
          <div class="glass-card rounded-2xl p-3.5 space-y-2 ${boosted ? 'border-amber-400 bg-amber-500/5 shadow-lg shadow-amber-500/5' : ''}">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center flex-wrap gap-1.5">
                ${boosted ? `<span class="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 text-[9.5px] font-black">★ إعلان مميز</span>` : ''}
                <span class="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 text-[9.5px] font-bold">${this.postTypeLabel(p.postType)}</span>
                <span class="px-2 py-0.5 rounded-lg bg-slate-950 text-slate-300 text-[9.5px]">${app.esc(this.catLabel(p.category))}</span>
                ${p.status !== 'approved' ? `<span class="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 text-[9px] font-black">${app.esc(p.status)}</span>` : ''}
              </div>
              <button onclick="DamanProjects.toggleFavorite('${p.id}')" class="text-sm ${isFav ? 'text-rose-500' : 'text-slate-500'}">
                <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
              </button>
            </div>

            <div onclick="DamanProjects.openPostDetails('${p.id}')" class="cursor-pointer space-y-1.5">
              <h4 class="text-xs font-black text-white">${app.esc(p.title)}</h4>
              ${p.imageBase64 ? `<img src="${p.imageBase64}" class="w-full h-36 object-cover rounded-xl border border-slate-800" />` : ''}
              <p class="text-[11px] text-slate-300 line-clamp-2">${app.esc(p.description || '')}</p>
            </div>

            <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
              <button onclick="${p.isDemo ? `DamanProjects.openPostDetails('${p.id}')` : `DamanApp.openPublicProfile('${p.ownerId}')`}" class="font-bold text-sky-300 hover:underline truncate max-w-[55%]">
                <i class="fa-solid fa-user me-1"></i>${app.esc(p.ownerName || 'مستخدم')} ${p.ownerVerified ? '✅' : ''}
              </button>
              <div class="flex items-center gap-2 shrink-0">
                <span><i class="fa-solid fa-location-dot me-0.5"></i>${app.esc(p.city || '')}</span>
                ${p.budget ? `<b class="text-emerald-400">${app.fmtMoney(p.budget)} ج.م</b>` : ''}
              </div>
            </div>

            <div class="flex items-center gap-1.5 pt-0.5">
              ${!isOwn ? `
                <button onclick="if(window.DamanChat) DamanChat.openDirectChat('${p.ownerId}','${app.esc(p.ownerName || '').replace(/'/g, "\\'")}','${p.id}','${app.esc(p.title).replace(/'/g, "\\'")}')" class="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">
                  <i class="fa-solid fa-comments me-1"></i> مراسلة واتفاق
                </button>
                <button onclick="DamanProjects.openPostDetails('${p.id}')" class="px-3 py-2 rounded-xl bg-slate-800 text-white font-bold text-[10.5px]">التفاصيل</button>` : `
                <button onclick="DamanProjects.openEditPostModal('${p.id}')" class="flex-1 py-1.5 rounded-xl bg-slate-800 text-amber-300 font-bold text-[10.5px]">تعديل</button>
                <button onclick="DamanProjects.boostPost('${p.id}')" class="flex-1 py-1.5 rounded-xl bg-purple-500/25 text-purple-200 border border-purple-500/40 font-black text-[10.5px]">★ تمييز</button>
                <button onclick="DamanProjects.toggleClosePost('${p.id}')" class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold text-[10.5px]">${p.status === 'closed' ? 'فتح' : 'إغلاق'}</button>`}
            </div>
          </div>`;
      }).join('');
    },

    renderMarketTab(app) {
      const catOpts = `<option value="all">كل التخصصات (17 تخصص)</option>` + app.CATEGORIES.map((c) => `<option value="${c.id}" ${this.selectedCategory === c.id ? 'selected' : ''}>${app.esc(c.ar)}</option>`).join('');
      return `
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <input type="text" value="${app.esc(this.searchQuery)}" oninput="DamanProjects.onSearchInput(this.value)" placeholder="ابحث عن صنايعي، مشروع، مورد حديد/أسمنت، مدينة..." class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white" />
            <button onclick="DamanProjects.openPostModal()" class="px-3.5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shrink-0"><i class="fa-solid fa-plus me-1"></i> نشر</button>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
            ${[['all', 'الكل'], ['project', '🏗️ مشاريع'], ['worker', '👷 مقاولين وفنيين'], ['supplier', '🚚 موردين B2B'], ['favorites', '❤️ المفضلة']].map(([k, lbl]) => `
              <button onclick="DamanProjects.setMarketFilter('${k}')" class="shrink-0 px-3 py-1.5 rounded-xl ${this.marketFilter === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 border border-slate-800 text-slate-300'}">${lbl}</button>`).join('')}
          </div>
          <select onchange="DamanProjects.setCategory(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-bold">${catOpts}</select>
          <div id="daman-market-list-slot" class="space-y-2.5">${this.renderMarketCards(app)}</div>
        </div>`;
    },

    renderLedgerTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
      return `
        <div class="space-y-3 text-xs">
          <div class="flex items-center justify-between"><h3 class="font-black text-amber-400">دفتر عمال ويوميات وعهدة الموقع</h3><button onclick="DamanProjects.printLedgerA4()" class="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-[10.5px]">تصفية A4</button></div>
          <form onsubmit="DamanProjects.submitLedgerEntry(event)" class="glass-card rounded-2xl p-3.5 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <input id="ld-worker" type="text" required placeholder="اسم العامل / المقاول" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <select id="ld-type" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold"><option value="wage">يومية (+)</option><option value="overtime">إضافي/سهر (+)</option><option value="advance">سلفة (-)</option><option value="deduction">خصم (-)</option><option value="custody">عهدة مشتريات</option></select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="ld-amt" type="number" min="1" step="any" required placeholder="المبلغ (ج.م)" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-white font-black" />
              <input id="ld-site" type="text" placeholder="اسم الموقع" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>
            <input id="ld-note" type="text" placeholder="ملاحظات..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <button type="submit" class="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black">إضافة للدفتر</button>
          </form>
          <div class="space-y-2">${this.ledgerEntries.map((x) => `<div class="glass-card rounded-2xl p-3 flex justify-between gap-2"><div><div class="font-black text-white">${app.esc(x.workerName)} • <span class="text-amber-300">${this.ledgerTypeLabel(x.entryType)}</span></div><div class="text-[10px] text-slate-400">${app.esc(x.date || '')} ${app.esc(x.siteName || '')} ${app.esc(x.note || '')}</div></div><div class="flex items-center gap-2 shrink-0"><b class="${['advance', 'deduction'].includes(x.entryType) ? 'text-rose-400' : 'text-emerald-400'}">${app.fmtMoney(x.amount)} ج.م</b><button onclick="DamanProjects.deleteLedgerEntry('${x.id}')" class="text-rose-400"><i class="fa-solid fa-trash-can"></i></button></div></div>`).join('') || '<div class="glass-card rounded-2xl p-5 text-center text-slate-400">لا توجد قيود بعد</div>'}</div>
        </div>`;
    },

    renderInspectionTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
      return `
        <div class="space-y-3 text-xs">
          <div class="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 space-y-1">
            <div class="font-black text-emerald-300">🛡️ الاستلام الهندسي بضمان 3 أضعاف (3x) — باقة 3 زيارات للسقف</div>
            <p class="text-[11px] text-slate-200 leading-relaxed">فحص واستلام الشدات الخشبية والمعدنية والحدادة والصب والمحارة والتشطيبات بتقرير هندسي معتمد وضمان مادي 3 أضعاف.</p>
          </div>
          <form onsubmit="DamanProjects.submitInspectionRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <select id="ins-elem" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-bold">
              <option value="باقة 3 زيارات استلام سقف (خامات + شدة وحدادة + صب)">باقة 3 زيارات استلام سقف (خامات + شدة وحدادة + صب)</option>
              <option value="استلام شدة خشبية ومعدنية وحدادة قبل الصب">استلام شدة خشبية ومعدنية وحدادة قبل الصب</option>
              <option value="استلام مباني ومحارة وبؤج وأوتار">استلام مباني ومحارة وبؤج وأوتار</option>
              <option value="استلام تأسيس سباكة وكهرباء وعزل">استلام تأسيس سباكة وكهرباء وعزل</option>
              <option value="استلام تشطيب كامل (فيلا / شقة)">استلام تشطيب كامل (فيلا / شقة)</option>
            </select>
            <div class="grid grid-cols-2 gap-2"><input id="ins-loc" type="text" required placeholder="عنوان الموقع" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /><input id="ins-area" type="text" required placeholder="المساحة م²" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" /></div>
            <input id="ins-date" type="date" required value="${app.todayLocal()}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="ins-notes" rows="2" placeholder="ملاحظات أو موعد الصب..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">طلب تسعير واستلام هندسي 3x</button>
          </form>
          ${this.inspectionReqs.map((r) => `
            <div class="glass-card rounded-2xl p-3 space-y-1.5">
              <div class="flex justify-between"><b class="text-white">${app.esc(r.element)}</b><span class="text-amber-300 font-bold">${app.esc(r.status)}</span></div>
              <div class="text-[10.5px] text-slate-400">${app.esc(r.location)} • ${app.esc(r.preferredDate || '')}</div>
              ${r.adminNote ? `<div class="text-[10.5px] text-emerald-300">ملاحظة الإدارة: ${app.esc(r.adminNote)}</div>` : ''}
              ${r.status === 'quoted' && Number(r.quotedPrice || 0) > 0 ? `<div class="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500 flex justify-between items-center"><b class="text-emerald-300">${app.fmtMoney(r.quotedPrice)} ج.م</b><button onclick="DamanProjects.payInspectionRequest('${r.id}')" class="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة ودفع</button></div>` : ''}
              ${r.reportMedia ? `<button onclick="DamanApp.openMediaLightbox('${r.reportMedia}','التقرير الهندسي المعتمد 3x')" class="w-full py-2 rounded-xl bg-sky-500/20 border border-sky-500/50 text-sky-300 font-black text-[11px]"><i class="fa-solid fa-file-contract me-1"></i> عرض وتحميل التقرير الهندسي المعتمد</button>` : ''}
            </div>`).join('')}
        </div>`;
    },

    renderVipLaborTab(app) {
      if (!app.user) return `<div class="glass-card rounded-2xl p-6 text-center"><button onclick="DamanApp.openAuthModal('login')" class="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">تسجيل الدخول</button></div>`;
      const vipPct = (app.getVipCommissionRate() * 100).toFixed(0);
      return `
        <div class="space-y-3 text-xs">
          <div class="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-500/40 space-y-1">
            <div class="font-black text-purple-300">👷 توريد عمالة VIP مختبرة بضمان المنصة (عمولة ${vipPct}%)</div>
            <p class="text-[11px] text-slate-200">فرق نجارين، حدادين، بنائين، محارة، وتشطيبات جاهزة للنزول الفوري بضمان الالتزام والجودة.</p>
          </div>
          <form onsubmit="DamanProjects.submitVipLaborRequest(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <input id="vl-trade" type="text" required placeholder="التخصص المطلوب (مثال: نجارين مسلح / حدادين)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-white" />
            <div class="grid grid-cols-2 gap-2"><input id="vl-count" type="number" min="1" value="6" required class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /><input id="vl-days" type="number" min="1" value="5" required class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" /></div>
            <input id="vl-loc" type="text" required placeholder="موقع المشروع" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            <textarea id="vl-notes" rows="2" placeholder="تفاصيل العمل وموعد النزول..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"></textarea>
            <button type="submit" class="w-full py-2.5 rounded-xl bg-purple-500 text-white font-black">إرسال طلب عمالة VIP</button>
          </form>
          ${this.vipLaborReqs.map((r) => `<div class="glass-card rounded-2xl p-3 space-y-1.5"><div class="flex justify-between"><b class="text-white">${app.esc(r.trade)} (${r.workersCount} × ${r.days} يوم)</b><span class="text-purple-300 font-bold">${app.esc(r.status)}</span></div>${r.status === 'quoted' && Number(r.baseCost || 0) > 0 ? `<div class="p-2 rounded-xl bg-purple-500/15 border border-purple-500 space-y-1"><div class="text-[11px] text-purple-200">التكلفة ${app.fmtMoney(r.baseCost)} + عمولة ${app.fmtMoney(r.vipFee)} = <b>${app.fmtMoney(r.totalQuoted)} ج.م</b></div><button onclick="DamanProjects.fundVipLaborRequest('${r.id}')" class="w-full py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black">موافقة وحجز 100%</button></div>` : ''}</div>`).join('')}
        </div>`;
    },

    render(container, app) {
      this.ensureListeners(app);
      const body = this.subTab === 'ledger' ? this.renderLedgerTab(app)
        : this.subTab === 'inspection' ? this.renderInspectionTab(app)
        : this.subTab === 'viplabor' ? this.renderVipLaborTab(app)
        : this.renderMarketTab(app);
      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-extrabold">
            <button onclick="DamanProjects.setSubTab('market')" class="py-2 rounded-lg ${this.subTab === 'market' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">السوق B2B</button>
            <button onclick="DamanProjects.setSubTab('ledger')" class="py-2 rounded-lg ${this.subTab === 'ledger' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">دفتر الموقع</button>
            <button onclick="DamanProjects.setSubTab('inspection')" class="py-2 rounded-lg ${this.subTab === 'inspection' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}">استلام 3x</button>
            <button onclick="DamanProjects.setSubTab('viplabor')" class="py-2 rounded-lg ${this.subTab === 'viplabor' ? 'bg-purple-500 text-white' : 'text-slate-400'}">عمالة VIP</button>
          </div>
          ${body}
        </div>`;
    }
  };

  window.DamanProjects = ProjectsMod;
  if (window.DamanApp) window.DamanApp.registerModule('projects', ProjectsMod);
})();
