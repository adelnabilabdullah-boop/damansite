window.DAMAN_CONFIG = {
  adminEmail: 'adelnabilabdullah@gmail.com',
  commissionRate: 0.035,
  appVersion: '4.0.0',
  firebaseConfig: {
    apiKey: "AIzaSyDSkWNxg9B5Ot_jIDdao2OIFCboMl_yRxU",
    authDomain: "daman-site-36583.firebaseapp.com",
    projectId: "daman-site-36583"
  }
};

window.DAMAN_CATEGORIES = [
  {
    id: 'construction',
    icon: 'fa-building-columns',
    color: 'from-amber-500 to-orange-600',
    ar: 'الإنشاءات والمباني',
    en: 'Construction & Structure',
    descAr: 'حفر، خرسانة، نجارة، حدادة، ومباني',
    descEn: 'Excavation, concrete, carpentry, rebar & masonry',
    subs: [
      { id: 'excavation', icon: 'fa-tractor', ar: 'الحفر والأساسات', en: 'Excavation & Foundations' },
      { id: 'carpentry', icon: 'fa-hammer', ar: 'النجارة المسلحة والشدات', en: 'Reinforced Carpentry & Shoring' },
      { id: 'rebar', icon: 'fa-bars-staggered', ar: 'الحدادة المسلحة', en: 'Steel Rebar Works' },
      { id: 'concrete', icon: 'fa-truck-moving', ar: 'صب الخرسانة الجاهزة', en: 'Concrete Pouring' },
      { id: 'masonry', icon: 'fa-cubes', ar: 'المباني والطوب', en: 'Masonry & Brickwork' }
    ]
  },
  {
    id: 'finishing',
    icon: 'fa-paint-roller',
    color: 'from-emerald-500 to-teal-600',
    ar: 'التشطيبات والديكور',
    en: 'Finishing & Interiors',
    descAr: 'محارة، سباكة، كهرباء، سيراميك، نقاشة، جبس، ألوميتال',
    descEn: 'Plaster, plumbing, electrical, tiles, paint & aluminum',
    subs: [
      { id: 'plastering', icon: 'fa-trowel', ar: 'المحارة والبياض', en: 'Plastering Works' },
      { id: 'plumbing', icon: 'fa-faucet-drip', ar: 'السباكة والتغذية والصرف', en: 'Plumbing & Sanitary' },
      { id: 'electrical', icon: 'fa-bolt', ar: 'الكهرباء والسمارت هوم', en: 'Electrical & Smart Home' },
      { id: 'tiling', icon: 'fa-border-all', ar: 'السيراميك والبورسلين والرخام', en: 'Tiles, Porcelain & Marble' },
      { id: 'painting', icon: 'fa-brush', ar: 'النقاشة والدهانات', en: 'Painting & Coatings' },
      { id: 'gypsum', icon: 'fa-layer-group', ar: 'الجبس بورد والأسقف', en: 'Gypsum Board & Ceilings' },
      { id: 'aluminum', icon: 'fa-door-open', ar: 'الألوميتال والأبواب والشبابيك', en: 'Aluminum, Doors & Windows' }
    ]
  },
  {
    id: 'engineering',
    icon: 'fa-compass-drafting',
    color: 'from-sky-500 to-blue-600',
    ar: 'الهندسة والمعاينات والضمان',
    en: 'Engineering & Inspection',
    descAr: 'تصميم هندسي، استلام ومعاينات، وعزل مائي وحراري',
    descEn: 'Design, site inspection, warranty & waterproofing',
    subs: [
      { id: 'design', icon: 'fa-ruler-combined', ar: 'الاستشارات والتصميم الهندسي', en: 'Engineering Consulting & Design' },
      { id: 'inspection', icon: 'fa-clipboard-check', ar: 'معاينات وضمان التنفيذ', en: 'Site Inspection & Warranty' },
      { id: 'insulation', icon: 'fa-shield-halved', ar: 'العزل المائي والحراري', en: 'Waterproofing & Insulation' }
    ]
  },
  {
    id: 'supplies',
    icon: 'fa-boxes-stacked',
    color: 'from-purple-500 to-indigo-600',
    ar: 'التوريدات والصيانة',
    en: 'Supplies & Maintenance',
    descAr: 'توريد مواد البناء والترميم والصيانة الشاملة',
    descEn: 'Building materials supply & general renovation',
    subs: [
      { id: 'materials', icon: 'fa-dolly', ar: 'توريد مواد البناء والخرسانة', en: 'Building Materials Supply' },
      { id: 'maintenance', icon: 'fa-screwdriver-wrench', ar: 'الصيانة الشاملة والترميم', en: 'Maintenance & Renovation' }
    ]
  }
];

window.DAMAN_DEFAULT_ADS = [
  {
    id: 'default-1',
    badgeAr: 'ضمان مالي 100%',
    badgeEn: '100% Financial Protection',
    titleAr: 'فلوسك في أمان لحد الاستلام الهندسي',
    titleEn: 'Your funds stay safe until engineering handover',
    descAr: 'نظام الضمان (Escrow) بعمولة 3.5% فقط يحمي المالك والمقاول والشركات بضوابط واضحة.',
    descEn: '3.5% Escrow protection securing clients, contractors, and contracting firms.',
    gradient: 'from-amber-600 via-amber-500 to-yellow-600',
    actionTab: 'about'
  },
  {
    id: 'default-2',
    badgeAr: 'حسابات الشركات B2B',
    badgeEn: 'Corporate Accounts B2B',
    titleAr: 'إدارة كاملة لشركات المقاولات والمكاتب الهندسية',
    titleEn: 'Full workspace for contracting firms & engineering offices',
    descAr: 'وثّق شركتك، أضف فريق الإشراف، وقدم عروض أسعار رسمية وتعاقدات مضمونة.',
    descEn: 'Verify your company, manage your supervision team, and bid on secured projects.',
    gradient: 'from-slate-800 via-blue-900 to-slate-900',
    actionTab: 'company'
  },
  {
    id: 'default-3',
    badgeAr: 'معاينات الموقع',
    badgeEn: 'Site Inspections',
    titleAr: 'اطلب معاينة هندسية قبل الصب أو الاستلام',
    titleEn: 'Book an engineering inspection before pouring or handover',
    descAr: 'تقارير فنية موثقة وفحص للشدات والحدادة والتشطيبات لضمان أعلى جودة تنفيذ.',
    descEn: 'Documented technical reports inspecting shoring, steel, and finishing quality.',
    gradient: 'from-emerald-800 via-teal-800 to-slate-900',
    actionTab: 'projects'
  }
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
    mainCategories: 'الأقسام الرئيسية',
    tapCategoryHint: 'اضغط على القسم لفتح التخصصات الفرعية',
    subCategories: 'التخصصات الفرعية',
    browseProjects: 'تصفح المشاريع',
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
    phasePendingDesc: 'هيتم تفعيل الشاشة دي بالكامل تلقائياً بمجرد رفع ملف المرحلة الخاصة بيها في المستودع.'
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
    mainCategories: 'Main Categories',
    tapCategoryHint: 'Tap a category to explore sub-specialties',
    subCategories: 'Sub-Specialties',
    browseProjects: 'Browse Projects',
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
    phasePendingDesc: 'This section will activate automatically as soon as its phase file is added to the repository.'
  }
};
