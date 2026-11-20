window.DAMAN_CONFIG = {
  adminEmail: 'adelnabilabdullah@gmail.com',
  commissionRate: 0.035,
  appVersion: '5.0.0',
  firebaseConfig: {
    apiKey: "AIzaSyDSkWNxg9B5Ot_jIDdao2OIFCboMl_yRxU",
    authDomain: "daman-site-36583.firebaseapp.com",
    projectId: "daman-site-36583"
  }
};

window.DAMAN_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'العاصمة الإدارية', 'التجمع والقاهرة الجديدة',
  '6 أكتوبر والشيخ زايد', 'الساحل الشمالي', 'القليوبية', 'الشرقية', 'الدقهلية',
  'الغربية', 'المنوفية', 'البحيرة', 'الإسماعيلية', 'بورسعيد', 'السويس',
  'البحر الأحمر', 'جنوب سيناء', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'مطروح'
];

window.DAMAN_CATEGORIES = [
  { id: 'construction', icon: 'fa-building-columns', color: 'from-amber-500 to-orange-600', ar: 'الإنشاءات والمقاولات العامة', en: 'Construction & Contracting' },
  { id: 'finishing', icon: 'fa-paint-roller', color: 'from-emerald-500 to-teal-600', ar: 'التشطيبات والديكور', en: 'Finishing & Interiors' },
  { id: 'landscape', icon: 'fa-tree', color: 'from-green-500 to-emerald-700', ar: 'اللاند سكيب وحمامات السباحة', en: 'Landscape & Pools' },
  { id: 'engineering', icon: 'fa-compass-drafting', color: 'from-sky-500 to-blue-600', ar: 'الهندسة والاستشارات', en: 'Engineering & Consulting' },
  { id: 'surveying', icon: 'fa-map-location-dot', color: 'from-cyan-500 to-blue-700', ar: 'المساحة ونظم المعلومات', en: 'Surveying & GIS' },
  { id: 'suppliers', icon: 'fa-boxes-stacked', color: 'from-purple-500 to-indigo-600', ar: 'الموردين (شامل)', en: 'Suppliers (All-in-One)' },
  { id: 'heavy_equip', icon: 'fa-tractor', color: 'from-yellow-500 to-amber-700', ar: 'المعدات الثقيلة والأوناش', en: 'Heavy Equipment & Cranes' },
  { id: 'mep', icon: 'fa-screwdriver-wrench', color: 'from-slate-500 to-slate-700', ar: 'الصيانة والتشغيل (MEP)', en: 'Maintenance & MEP' },
  { id: 'security', icon: 'fa-shield-halved', color: 'from-red-500 to-rose-700', ar: 'الأمن والحراسة والكاميرات', en: 'Security & CCTV' },
  { id: 'admin_hr', icon: 'fa-user-tie', color: 'from-indigo-500 to-violet-700', ar: 'السكرتارية والإدارة وHR', en: 'Secretarial, Admin & HR' },
  { id: 'hospitality', icon: 'fa-hotel', color: 'from-pink-500 to-rose-600', ar: 'الفنادق والضيافة والسياحة', en: 'Hotels & Hospitality' },
  { id: 'hse', icon: 'fa-helmet-safety', color: 'from-orange-500 to-red-600', ar: 'السلامة والصحة المهنية (HSE)', en: 'Safety & Fire Systems' },
  { id: 'cleaning', icon: 'fa-broom', color: 'from-teal-500 to-cyan-600', ar: 'النظافة وإدارة المنشآت', en: 'Cleaning & Facility Mgmt' },
  { id: 'realestate', icon: 'fa-city', color: 'from-blue-500 to-indigo-700', ar: 'العقارات والتطوير العقاري', en: 'Real Estate & Development' },
  { id: 'legal_acc', icon: 'fa-scale-balanced', color: 'from-stone-500 to-stone-700', ar: 'القانونية والمحاسبية والتراخيص', en: 'Legal, Accounting & Permits' },
  { id: 'solar_power', icon: 'fa-solar-panel', color: 'from-amber-400 to-yellow-600', ar: 'الطاقة الشمسية والمولدات', en: 'Solar Energy & Generators' },
  { id: 'it_smart', icon: 'fa-wifi', color: 'from-sky-400 to-indigo-600', ar: 'الشبكات والسمارت هوم (IT)', en: 'IT, Networks & Smart Home' },
  { id: 'factories', icon: 'fa-industry', color: 'from-zinc-500 to-zinc-700', ar: 'المصانع والورش الصناعية', en: 'Factories & Workshops' },
  { id: 'furniture', icon: 'fa-couch', color: 'from-amber-600 to-rose-700', ar: 'الأثاث والمفروشات والمطابخ', en: 'Furniture & Kitchens' },
  { id: 'insulation', icon: 'fa-droplet-slash', color: 'from-cyan-600 to-teal-700', ar: 'العزل المائي والحراري والترميم', en: 'Insulation & Renovation' },
  { id: 'logistics', icon: 'fa-truck-fast', color: 'from-emerald-600 to-green-800', ar: 'النقل واللوجستيات والتخزين', en: 'Transport & Logistics' },
  { id: 'shipping', icon: 'fa-box-open', color: 'from-violet-500 to-purple-700', ar: 'الشحن والتغليف والتخليص', en: 'Shipping & Packaging' },
  { id: 'advertising', icon: 'fa-bullhorn', color: 'from-fuchsia-500 to-pink-600', ar: 'الدعاية والإعلان واللافتات', en: 'Advertising & Signage' },
  { id: 'other', icon: 'fa-layer-group', color: 'from-slate-600 to-slate-800', ar: 'خدمات وتخصصات أخرى', en: 'Other Services' }
];

window.DAMAN_DEFAULT_PACKAGES = {
  individual: {
    titleAr: 'باقة الأفراد والمقاولين (نشر + توثيق VIP)',
    titleEn: 'Individual & Contractor VIP Package',
    m1: 150, m3: 400, m6: 750, m12: 1350
  },
  company: {
    titleAr: 'باقة الشركات والمكاتب (إدارة فريق Access + B2B)',
    titleEn: 'Corporate & Engineering Office Package',
    m1: 250, m3: 650, m6: 1200, m12: 2200
  },
  featured: {
    titleAr: 'تمييز إعلان / مشروع (Featured Ad)',
    titleEn: 'Featured Ad Boost',
    week: 75, month: 200
  },
  minCompanyBalanceForAccess: 100
};

window.DAMAN_DEFAULT_ADS = [
  {
    id: 'ad-1',
    badgeAr: 'ضمان مالي 3.5%',
    badgeEn: '3.5% Financial Escrow',
    titleAr: 'فلوسك في أمان كامل لحد الاستلام الهندسي',
    titleEn: 'Your money stays protected until final handover',
    descAr: 'احجز دفعات مشروعك داخل محفظة ضمان سايت بعمولة 3.5% فقط، مع عقد إلكتروني رسمي A4.',
    descEn: 'Lock your project payments safely in Escrow with official A4 contracts.',
    gradient: 'from-amber-600 via-orange-600 to-amber-800',
    actionTab: 'about'
  },
  {
    id: 'ad-2',
    badgeAr: 'باقات مخفضة',
    badgeEn: 'Discounted Plans',
    titleAr: 'وثّق حسابك وميّز إعلانك بخصومات تصل لـ 800 ج.م',
    titleEn: 'Verify & boost your ads with huge multi-month discounts',
    descAr: 'باقات الأفراد تبدأ من 150 ج.م والشركات من 250 ج.م مع خصومات الـ 3 و 6 و 12 شهر.',
    descEn: 'Individual plans from 150 EGP and Corporate from 250 EGP.',
    gradient: 'from-emerald-700 via-teal-700 to-slate-900',
    actionTab: 'wallet'
  },
  {
    id: 'ad-3',
    badgeAr: 'عمالة VIP مضمونة',
    badgeEn: 'Guaranteed VIP Labor',
    titleAr: 'اطلب عمالة ومقاولين VIP مباشرة من ضمان سايت',
    titleEn: 'Request vetted VIP labor directly from DamanSite',
    descAr: 'نوفر لك فرق عمل متخصصة في الإنشاءات والتشطيبات والأمن والضيافة بإشراف كامل.',
    descEn: 'Vetted teams across construction, finishing, security & hospitality.',
    gradient: 'from-sky-700 via-blue-800 to-slate-900',
    actionTab: 'projects'
  },
  {
    id: 'ad-4',
    badgeAr: 'معاينات ضمان سايت',
    badgeEn: 'Engineering Inspections',
    titleAr: 'باقات معاينة السقف والمباني والتشطيبات حسب المساحة',
    titleEn: 'Roof, Building & Finishing Inspection Packages',
    descAr: 'اختر باقة السقف الكامل أو الـ 4 زيارات أو المبنى الكامل وسعّر مشروعك مع إدارتنا الهندسية.',
    descEn: 'Choose your inspection package and get tailored pricing from our engineers.',
    gradient: 'from-purple-700 via-indigo-800 to-slate-900',
    actionTab: 'projects'
  }
];

window.DAMAN_DAILY_NOTIFS = [
  { title: 'نصيحة ضمان سايت اليومية', body: 'احمي فلوسك! أي تعامل مالي داخل محفظة الضمان (3.5%) مضمون بالكامل بعقد رسمي A4.' },
  { title: 'وفّر مع الباقات السنوية', body: 'اشترك في باقة الأفراد أو الشركات لمدة 6 شهور أو سنة ووفّر حتى 800 ج.م مع أولوية الظهور.' },
  { title: 'محتاج عمالة VIP لموقعك؟', body: 'اطلب عمالة متخصصة ومضمونة مباشرة من تبويب المشاريع ← عمالة VIP.' },
  { title: 'وثّق حسابك مجاناً', body: 'ارفع البطاقة والسيلفي (أو السجل التجاري للشركات) للحصول على شارة التوثيق وتفعيل السحب الآمن.' },
  { title: 'معاينة هندسية قبل الصب', body: 'احجز باقة معاينة السقف الكامل أو الـ 4 زيارات لتأمين جودة التنفيذ قبل الصب.' },
  { title: 'ميّز إعلانك الآن', body: 'ثبّت إعلانك في أعلى الصفحة الرئيسية وفي قمة قسمك لمدة أسبوع بـ 75 ج.م فقط!' },
  { title: 'حسابات الشركات والمكاتب', body: 'وثّق شركتك بالسجل التجاري والبطاقة الضريبية وامنح صلاحيات (Access) لفريق مهندسيك بسهولة.' }
];

window.DAMAN_I18N = {
  ar: {
    appName: 'ضمان سايت',
    tagline: 'منصة العقود والضمان الهندسي والمالي',
    navHome: 'الرئيسية',
    navProjects: 'المشاريع',
    navWallet: 'المحفظة',
    navChat: 'الدردشة',
    navProfile: 'حسابي',
    adminBtn: 'الإدارة',
    loginBtn: 'دخول / تسجيل',
    logout: 'تسجيل الخروج',
    availableBal: 'الرصيد المتاح',
    escrowBal: 'محجوز بالضمان',
    heldBal: 'محجوز إدارياً',
    egp: 'ج.م',
    mainCategories: 'جميع الأقسام والقطاعات (24)',
    postProject: 'انشر مشروع',
    aboutApp: 'عن ضمان سايت',
    aiSupport: 'الدعم الذكي AI',
    companyPanel: 'إدارة الشركة',
    roleClient: 'عميل / مالك',
    roleContractor: 'مقاول / فني',
    roleCompany: 'شركة / مكتب هندسي',
    verified: 'حساب موثّق',
    unverified: 'غير موثّق',
    pendingKyc: 'التوثيق قيد المراجعة',
    frozenNotice: 'تم تجميد حسابك مؤقتاً من قِبل الإدارة. تواصل مع الدعم الفني لمراجعة الوضع.',
    phasePendingTitle: 'وحدة جاهزة للتفعيل',
    phasePendingDesc: 'هيتم تفعيل الشاشة دي بالكامل تلقائياً بمجرد رفع ملف الخطوة الخاصة بيها في المستودع.'
  },
  en: {
    appName: 'DamanSite',
    tagline: 'Engineering Escrow & Contracting Platform',
    navHome: 'Home',
    navProjects: 'Projects',
    navWallet: 'Wallet',
    navChat: 'Chat',
    navProfile: 'Profile',
    adminBtn: 'Admin',
    loginBtn: 'Sign In',
    logout: 'Sign Out',
    availableBal: 'Available',
    escrowBal: 'In Escrow',
    heldBal: 'Admin Hold',
    egp: 'EGP',
    mainCategories: 'All Sectors & Categories (24)',
    postProject: 'Post Project',
    aboutApp: 'About DamanSite',
    aiSupport: 'AI Support',
    companyPanel: 'Company Panel',
    roleClient: 'Client / Owner',
    roleContractor: 'Contractor / Tech',
    roleCompany: 'Company / Eng. Office',
    verified: 'Verified',
    unverified: 'Unverified',
    pendingKyc: 'KYC Pending',
    frozenNotice: 'Your account is temporarily frozen by administration. Please contact support.',
    phasePendingTitle: 'Module Ready to Activate',
    phasePendingDesc: 'This section will activate automatically as soon as its step file is added to the repository.'
  }
};
