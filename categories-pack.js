(function () {
  const CATEGORY_GROUPS = [
    { id: 'all', ar: 'الكل', icon: '🌐' },
    { id: 'construction', ar: 'إنشاءات ومقاولات', icon: '🏗️' },
    { id: 'finishing', ar: 'تشطيبات وديكور', icon: '🎨' },
    { id: 'mep', ar: 'كهرباء وميكانيكا', icon: '⚡' },
    { id: 'services', ar: 'أمن ونظافة ومواقع', icon: '🛡️' },
    { id: 'supply', ar: 'نقل ومعدات وخامات', icon: '🚚' },
    { id: 'engineering', ar: 'هندسة ومكتب فني', icon: '📐' },
    { id: 'tech_biz', ar: 'برمجة ومحاسبة وأعمال', icon: '💼' }
  ];

  const FULL_CATEGORIES_PACK = [
    // ==================== 1. إنشاءات ومقاولات (13 قسم) ====================
    { id: 'construction', group: 'construction', ar: 'إنشاءات ومباني وهيكل خرساني', en: 'Construction & Structure', icon: '🏗️', active: true },
    { id: 'concrete', group: 'construction', ar: 'خرسانات وشدات خشبية ومعدنية', en: 'Concrete & Formwork', icon: '🏛️', active: true },
    { id: 'concrete_pumps', group: 'construction', ar: 'خرسانة جاهزة ومضخات صب (بامب)', en: 'Ready-Mix Concrete & Pumps', icon: '🚛', active: true },
    { id: 'steel', group: 'construction', ar: 'حدادة مسلحة', en: 'Rebar & Steel', icon: '🔩', active: true },
    { id: 'masonry', group: 'construction', ar: 'مباني وطوب أحمر وأسمنتي', en: 'Masonry & Bricks', icon: '🧱', active: true },
    { id: 'excavation', group: 'construction', ar: 'حفر وردم وإحلال وجسات', en: 'Excavation & Backfilling', icon: '🚜', active: true },
    { id: 'piling_dewatering', group: 'construction', ar: 'خوازيق وسند جوانب حفر ونزح مياه', en: 'Piling, Shoring & Dewatering', icon: '🕳️', active: true },
    { id: 'demolition_core', group: 'construction', ar: 'هدم وتكسير وقص خرسانة (كور)', en: 'Demolition & Core Cutting', icon: '🔨', active: true },
    { id: 'steel_structures', group: 'construction', ar: 'منشآت معدنية وهناجر وجمالونات', en: 'Steel Structures & Hangars', icon: '🏭', active: true },
    { id: 'roads_asphalt', group: 'construction', ar: 'طرق وأسفلت وإنترلوك وبردورات', en: 'Roads, Asphalt & Interlock', icon: '🛣️', active: true },
    { id: 'infra_utilities', group: 'construction', ar: 'بنية تحتية وشبكات مياه وصرف', en: 'Infrastructure & Utilities', icon: '🚧', active: true },
    { id: 'retrofitting', group: 'construction', ar: 'تدعيم وترميم منشآت وحقن خرسانة', en: 'Structural Repair & Retrofitting', icon: '🩹', active: true },
    { id: 'general', group: 'construction', ar: 'مقاولات عامة وتشطيب كامل', en: 'General Contracting', icon: '🏢', active: true },

    // ==================== 2. تشطيبات وديكور (13 قسم) ====================
    { id: 'plaster', group: 'finishing', ar: 'محارة وبياض وبؤج وأوتار', en: 'Plastering', icon: '🪣', active: true },
    { id: 'ceramic', group: 'finishing', ar: 'سيراميك وبورسلين ورخام وجرانيت', en: 'Ceramics & Marble', icon: '⬜', active: true },
    { id: 'gypsum', group: 'finishing', ar: 'جبسمبورد وديكورات أسقف معلقة', en: 'Gypsum Board & Ceilings', icon: '✨', active: true },
    { id: 'painting', group: 'finishing', ar: 'نقاشة ودهانات وديكور', en: 'Painting & Decor', icon: '🎨', active: true },
    { id: 'facades_cladding', group: 'finishing', ar: 'واجهات كلادينج وGRC وحجر هاشمي ومايكا', en: 'Facades, Cladding, GRC & Stone', icon: '🏰', active: true },
    { id: 'epoxy_floors', group: 'finishing', ar: 'أرضيات إيبوكسي وهليكوبتر وخرسانة مطبوعة', en: 'Epoxy & Helicopter Floors', icon: '✨', active: true },
    { id: 'carpentry', group: 'finishing', ar: 'نجارة باب وشباك ومطابخ وأثاث', en: 'Carpentry & Kitchens', icon: '🪵', active: true },
    { id: 'aluminum', group: 'finishing', ar: 'ألوميتال وUPVC وواجهات زجاج سيكوريت', en: 'Aluminum, UPVC & Glass', icon: '🪟', active: true },
    { id: 'metal_smithing', group: 'finishing', ar: 'حدادة كريتال وأبواب مصفحة وفورفورجيه', en: 'Ornamental Metal & Armored Doors', icon: '🚪', active: true },
    { id: 'insulation', group: 'finishing', ar: 'عزل مائي وحراري وصوتي', en: 'Waterproofing & Insulation', icon: '💧', active: true },
    { id: 'curtains_blinds', group: 'finishing', ar: 'شيش حصيرة ومظلات وبرجولات وتندات', en: 'Shutters, Pergolas & Shades', icon: '⛱️', active: true },
    { id: 'landscape', group: 'finishing', ar: 'لاندسكيب وحمامات سباحة وشبكات ري', en: 'Landscape & Pools', icon: '🌴', active: true },
    { id: 'interior_3d', group: 'finishing', ar: 'تصميم داخلي وديكور 3D وفرش وتجهيز', en: 'Interior Design 3D & Fit-out', icon: '🛋️', active: true },

    // ==================== 3. كهرباء وميكانيكا وأنظمة (9 أقسام) ====================
    { id: 'electrical', group: 'mep', ar: 'كهرباء ولوحات توزيع وسمارت هوم', en: 'Electrical & Smart Home', icon: '⚡', active: true },
    { id: 'plumbing', group: 'mep', ar: 'سباكة وتأسيس صحي وصرف', en: 'Plumbing & Sanitary', icon: '🚰', active: true },
    { id: 'hvac', group: 'mep', ar: 'تكييف مركزي وسبليت وتهوية (HVAC)', en: 'HVAC & Ventilation', icon: '❄️', active: true },
    { id: 'water_tanks_pumps', group: 'mep', ar: 'خزانات مياه ومواتير وطلمبات رفع وفلاتر', en: 'Water Tanks & Booster Pumps', icon: '🛢️', active: true },
    { id: 'solar_energy', group: 'mep', ar: 'طاقة شمسية ومولدات كهرباء', en: 'Solar & Generators', icon: '☀️', active: true },
    { id: 'elevators', group: 'mep', ar: 'مصاعد وسلالم كهربائية', en: 'Elevators & Escalators', icon: '🛗', active: true },
    { id: 'fire_safety', group: 'mep', ar: 'إنذار ومكافحة حريق وشبكات إطفاء', en: 'Fire Fighting & Alarm', icon: '🧯', active: true },
    { id: 'cctv_networks', group: 'mep', ar: 'كاميرات مراقبة وإنتركم وتيار خفيف', en: 'CCTV & Low Current', icon: '📹', active: true },
    { id: 'natural_gas_bms', group: 'mep', ar: 'تمديدات غاز وأنظمة إدارة مباني BMS', en: 'Gas Systems & BMS', icon: '🔥', active: true },

    // ==================== 4. أمن ونظافة وصيانة وخدمات مواقع (8 أقسام) ====================
    { id: 'security', group: 'services', ar: 'أمن وحراسة مواقع ومنشآت', en: 'Site Security & Guarding', icon: '🛡️', active: true },
    { id: 'cleaning', group: 'services', ar: 'نظافة مواقع وما بعد التشطيب والواجهات', en: 'Site & Post-Construction Cleaning', icon: '🧹', active: true },
    { id: 'maintenance', group: 'services', ar: 'صيانة عامة وتشغيل منشآت ومرافق', en: 'Facility Maintenance', icon: '🔧', active: true },
    { id: 'hse_safety', group: 'services', ar: 'سلامة وصحة مهنية HSE ومهمات وقاية', en: 'HSE Safety & PPE Supply', icon: '🦺', active: true },
    { id: 'catering_housing', group: 'services', ar: 'إعاشة وتغذية عمال وسكن مواقع', en: 'Site Catering & Worker Housing', icon: '🍽️', active: true },
    { id: 'site_fencing', group: 'services', ar: 'أسوار مؤقتة ولوحات إرشادية وبوابات مواقع', en: 'Site Fencing & Signage', icon: '🚧', active: true },
    { id: 'pest_control', group: 'services', ar: 'مكافحة حشرات وتعقيم', en: 'Pest Control & Sanitization', icon: '🧴', active: true },
    { id: 'gardening', group: 'services', ar: 'زراعة وتنسيق وصيانة حدائق', en: 'Gardening & Care', icon: '🌿', active: true },

    // ==================== 5. نقل ومعدات وتوريدات مواقع (8 أقسام) ====================
    { id: 'materials', group: 'supply', ar: 'توريد خامات ومواد بناء B2B (حديد/أسمنت/رمل)', en: 'B2B Building Materials', icon: '🧱', active: true },
    { id: 'timber_scaffolding', group: 'supply', ar: 'أخشاب شدات (لتزانة/موسكي/بليوود) وسقالات', en: 'Formwork Timber & Scaffolding', icon: '🪵', active: true },
    { id: 'equipment', group: 'supply', ar: 'تأجير معدات وشدات معدنية وأوناش رفع', en: 'Equipment & Crane Rental', icon: '🏗️', active: true },
    { id: 'heavy_machinery', group: 'supply', ar: 'معدات ثقيلة (حفارات، لوادر، هراسات، تريلات)', en: 'Heavy Machinery & Loaders', icon: '🚜', active: true },
    { id: 'transport', group: 'supply', ar: 'نقل وسيارات مواقع (ربع نقل / جامبو / نقل ثقيل)', en: 'Site Transport & Trucks', icon: '🚚', active: true },
    { id: 'water_fuel_supply', group: 'supply', ar: 'توريد مياه مواقع (فناطيس) وسولار وزيوت', en: 'Site Water Tankers & Fuel', icon: '⛽', active: true },
    { id: 'rubble_removal', group: 'supply', ar: 'رفع مخلفات البناء والرتش', en: 'Rubble & Waste Removal', icon: '♻️', active: true },
    { id: 'caravans', group: 'supply', ar: 'كرفانات ومكاتب مواقع وحمامات متنقلة', en: 'Site Caravans & Cabins', icon: '🏠', active: true },

    // ==================== 6. هندسة ومكتب فني وعمالة (5 أقسام) ====================
    { id: 'engineering_survey', group: 'engineering', ar: 'استشارات وتصميم هندسي وأعمال مساحة', en: 'Engineering & Surveying', icon: '📐', active: true },
    { id: 'technical_office', group: 'engineering', ar: 'مكتب فني وحصر كميات ومستخلصات ومناقصات', en: 'Technical Office, QS & Tenders', icon: '📋', active: true },
    { id: 'site_supervision', group: 'engineering', ar: 'إشراف تنفيذ وإدارة مشروعات ومراقبين مواقع', en: 'Site Supervision & Management', icon: '👷', active: true },
    { id: 'soil_concrete_labs', group: 'engineering', ar: 'معامل تربة واختبارات خرسانة وجودة', en: 'Soil & Concrete Testing Labs', icon: '🧪', active: true },
    { id: 'labor_helpers', group: 'engineering', ar: 'عمالة ومساعدين وعتالة وتشوين', en: 'General Labor & Helpers', icon: '💪', active: true },

    // ==================== 7. برمجة ومحاسبة وإدارة أعمال (6 أقسام) ====================
    { id: 'programming', group: 'tech_biz', ar: 'برمجة وتطوير مواقع وتطبيقات وذكاء اصطناعي', en: 'Programming, Apps & AI', icon: '💻', active: true },
    { id: 'accounting', group: 'tech_biz', ar: 'محاسبة ومراجعة وضرائب وإدارة مالية', en: 'Accounting, Audit & Tax', icon: '🧮', active: true },
    { id: 'marketing_design', group: 'tech_biz', ar: 'تسويق إلكتروني وسوشيال ميديا وتصميم جرافيك', en: 'Marketing & Graphic Design', icon: '📣', active: true },
    { id: 'legal_hr', group: 'tech_biz', ar: 'استشارات قانونية وعقود وموارد بشرية HR', en: 'Legal, Contracts & HR', icon: '⚖️', active: true },
    { id: 'video_ai', group: 'tech_biz', ar: 'مونتاج وفيديو وتصوير وإنتاج إعلامي', en: 'Video Editing & Media', icon: '🎬', active: true },
    { id: 'it_support', group: 'tech_biz', ar: 'دعم فني وشبكات وصيانة كمبيوتر وسيرفرات', en: 'IT Support & Servers', icon: '🖥️', active: true }
  ];

  const GROUP_BY_ID = {};
  FULL_CATEGORIES_PACK.forEach((c) => { GROUP_BY_ID[c.id] = c.group; });

  const ICON_CHOICES = [
    '🏗️', '🏛️', '🚛', '🔩', '🧱', '🚜', '🔨', '🏭', '🛣️', '🚧',
    '🏢', '🪣', '⬜', '✨', '🎨', '🏰', '🪵', '🪟', '🚪', '💧',
    '⛱️', '🌴', '🛋️', '⚡', '🚰', '❄️', '🛢️', '☀️', '🛗', '🧯',
    '📹', '🔥', '🛡️', '🧹', '🔧', '🦺', '🍽️', '🧴', '🌿', '🚚',
    '⛽', '♻️', '🏠', '📐', '📋', '👷', '🧪', '💪', '💻', '🧮',
    '📣', '⚖️', '🎬', '🖥️', '🚗', '📦', '🔑', '📌'
  ];

  function attachCategoriesPack() {
    if (!window.DamanCatAds || !window.DamanApp) {
      setTimeout(attachCategoriesPack, 250);
      return;
    }
    if (window.DamanCatAds._packV33Attached) return;

    const Cat = window.DamanCatAds;
    const app = window.DamanApp;
    Cat._packV33Attached = true;

    Cat.GROUPS = CATEGORY_GROUPS;
    Cat.FULL_PACK = FULL_CATEGORIES_PACK;
    Cat.homeGroup = 'all';
    Cat.homeCatSearch = '';
    Cat.homeExpanded = false;
    Cat.marketGroup = 'all';
    Cat.marketCatSearch = '';
    Cat.adminGroup = 'all';
    Cat.adminCatSearch = '';
    Cat._packExplicitlySaved = false;

    Cat.getGroupMeta = function (gid) {
      return CATEGORY_GROUPS.find((g) => g.id === gid) || CATEGORY_GROUPS[0];
    };

    Cat.resolveCatGroup = function (c) {
      return (c && (c.group || GROUP_BY_ID[c.id])) || 'construction';
    };

    Cat.mergeFullPackInMemory = function (forceAll = false) {
      const existingMap = {};
      (this.allCategories || []).forEach((c) => {
        existingMap[c.id] = Object.assign({}, c, { group: this.resolveCatGroup(c) });
      });

      if (forceAll || !this._packExplicitlySaved) {
        const merged = [];
        const seen = new Set();
        FULL_CATEGORIES_PACK.forEach((def) => {
          seen.add(def.id);
          if (existingMap[def.id]) {
            merged.push(Object.assign({}, def, existingMap[def.id], { group: existingMap[def.id].group || def.group }));
          } else {
            merged.push(Object.assign({}, def));
          }
        });
        (this.allCategories || []).forEach((c) => {
          if (!seen.has(c.id)) merged.push(Object.assign({}, c, { group: this.resolveCatGroup(c) }));
        });
        this.allCategories = merged;
      } else {
        this.allCategories = (this.allCategories || []).map((c) => Object.assign({}, c, { group: this.resolveCatGroup(c) }));
      }
      this.syncGlobalCategories(app);
    };

    Cat.persistConfig = async function () {
      if (!app.isAdmin()) return;
      this._packExplicitlySaved = true;
      await app.db.collection('settings').doc('categoriesConfig').set({
        categories: this.allCategories,
        categoryAds: this.categoryAds,
        packMergedV33: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    };

    Cat.restoreFullPackAndSave = async function () {
      if (!app.isAdmin()) return;
      if (!window.confirm(`تفعيل وحفظ باقة الـ ${FULL_CATEGORIES_PACK.length} قسم الشاملة (كل مجالات المقاولات، المواقع، التشطيبات، المعدات، الأمن، النظافة، المكتب الفني، البرمجة والمحاسبة) مع الاحتفاظ بأقسامك وإعلاناتك؟`)) return;
      this.mergeFullPackInMemory(true);
      await this.persistConfig();
      await app.logAudit('categories_pack_restore', `تفعيل باقة الـ ${this.allCategories.length} قسم الشاملة`);
      app.toast(`تم حفظ وتفعيل كل الـ ${this.allCategories.length} قسم بنجاح ✅`, 'success');
      if (['home', 'projects', 'admin'].includes(app.activeTab)) app.renderCurrentTab();
    };

    // ==================== EASY CATEGORY EDITOR MODAL (USABLE FROM HOME, MARKET & ADMIN) ====================
    Cat.openCategoryEditorModal = function (editId = '', preselectGroup = '') {
      if (!app.isAdmin()) return app.toast('إضافة الأقسام متاحة للإدارة فقط', 'error');
      const ex = editId ? this.allCategories.find((c) => c.id === editId) : null;
      const curG = ex ? this.resolveCatGroup(ex) : (preselectGroup && preselectGroup !== 'all' ? preselectGroup : 'construction');

      let m = document.getElementById('daman-cat-ed-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'daman-cat-ed-modal';
        m.className = 'daman-modal fixed inset-0 z-[95] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3';
        document.body.appendChild(m);
      }
      m.classList.remove('hidden');

      m.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-amber-500/60 rounded-3xl p-4 max-h-[92vh] overflow-y-auto space-y-3 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-black text-amber-400">${ex ? '✏️ تعديل القسم' : '⚡ إضافة قسم جديد بسهولة'}</h3>
            <button type="button" onclick="document.getElementById('daman-cat-ed-modal').classList.add('hidden')" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <form onsubmit="DamanCatAds.saveCategoryFull(event,'${app.esc(editId)}')" class="space-y-2.5">
            <div>
              <label class="block text-[10.5px] text-emerald-300 font-bold mb-1">1. اختر المجموعة الرئيسية *</label>
              <select id="ce-group" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-300 font-black">
                ${CATEGORY_GROUPS.filter((g) => g.id !== 'all').map((g) => `<option value="${g.id}" ${curG === g.id ? 'selected' : ''}>${g.icon} ${g.ar}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10.5px] text-white font-bold mb-1">2. اسم القسم بالعربي *</label>
              <input id="ce-ar" type="text" required value="${app.esc(ex?.ar || '')}" placeholder="مثال: توريد وتأجير أوناش برجية / مقاولات طرق..." class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-bold" />
            </div>

            <div>
              <label class="block text-[10px] text-slate-400 mb-1">الاسم بالإنجليزية (اختياري)</label>
              <input id="ce-en" type="text" value="${app.esc(ex?.en || '')}" placeholder="اختياري — يُملأ تلقائياً لو فارغ" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white" />
            </div>

            <div>
              <label class="block text-[10.5px] text-amber-300 font-bold mb-1">3. اختر أيقونة القسم *</label>
              <input id="ce-icon" type="text" required value="${app.esc(ex?.icon || '🏗️')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white text-center text-lg font-bold" />
              <div class="grid grid-cols-10 gap-1 pt-2 max-h-28 overflow-y-auto">
                ${ICON_CHOICES.map((ic) => `<button type="button" onclick="document.getElementById('ce-icon').value='${ic}'" class="h-7 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-400 text-sm flex items-center justify-center">${ic}</button>`).join('')}
              </div>
            </div>

            <button type="submit" class="w-full py-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs">
              ${ex ? 'حفظ تعديل القسم' : '+ إضافة وتفعيل القسم فوراً في التطبيق'}
            </button>
          </form>
        </div>`;
    };

    Cat.saveCategoryFull = async function (e, editId) {
      e.preventDefault();
      if (!app.isAdmin()) return;
      const group = document.getElementById('ce-group')?.value || 'construction';
      const ar = (document.getElementById('ce-ar')?.value || '').trim();
      const en = (document.getElementById('ce-en')?.value || '').trim() || ar;
      const icon = (document.getElementById('ce-icon')?.value || '').trim() || '📌';
      if (!ar) return app.toast('اكتب اسم القسم أولاً', 'warning');

      if (editId) {
        this.allCategories = this.allCategories.map((c) => (c.id === editId ? Object.assign({}, c, { group, ar, en, icon }) : c));
      } else {
        const dup = this.allCategories.some((c) => app.normalizeAr(c.ar) === app.normalizeAr(ar));
        if (dup) return app.toast('هذا القسم موجود بالفعل', 'warning');
        this.allCategories.unshift({ id: 'cat_' + Date.now(), group, ar, en, icon, active: true });
      }

      this.syncGlobalCategories(app);
      await this.persistConfig();
      await app.logAudit('category_save', `${editId ? 'تعديل' : 'إضافة'} قسم: ${ar} (${group})`);
      document.getElementById('daman-cat-ed-modal')?.classList.add('hidden');
      app.toast(`تم ${editId ? 'تعديل' : 'إضافة'} قسم «${ar}» وتفعيله فوراً ✅`, 'success');
      if (['home', 'projects', 'admin'].includes(app.activeTab)) app.renderCurrentTab();
    };

    Cat.quickAddCustomCategory = async function (e) {
      e.preventDefault();
      if (!app.isAdmin()) return;
      const ar = (document.getElementById('qcat-ar')?.value || '').trim();
      const group = document.getElementById('qcat-grp')?.value || 'construction';
      const icon = (document.getElementById('qcat-ic')?.value || '').trim() || '🏗️';
      if (!ar) return app.toast('اكتب اسم القسم أولاً', 'warning');

      if (this.allCategories.some((c) => app.normalizeAr(c.ar) === app.normalizeAr(ar))) {
        return app.toast('هذا القسم موجود بالفعل', 'warning');
      }

      this.allCategories.unshift({ id: 'cat_' + Date.now(), group, ar, en: ar, icon, active: true });
      this.syncGlobalCategories(app);
      await this.persistConfig();
      await app.logAudit('category_quick_add', `إضافة قسم: ${ar} (${group})`);
      e.target.reset();
      app.toast(`تمت إضافة قسم «${ar}» فوراً ✅`, 'success');
      if (window.DamanAdmin) DamanAdmin.rerender();
    };

    // Re-attach Firestore listener so v33 merges all 60 categories cleanly
    if (Cat.unsubDoc) { try { Cat.unsubDoc(); } catch (e) {} }
    Cat.unsubDoc = app.db.collection('settings').doc('categoriesConfig').onSnapshot((snap) => {
      if (snap.exists) {
        const d = snap.data() || {};
        Cat._packExplicitlySaved = !!d.packMergedV33;
        if (Array.isArray(d.categories) && d.categories.length) Cat.allCategories = d.categories;
        if (Array.isArray(d.categoryAds)) Cat.categoryAds = d.categoryAds;
      } else {
        Cat._packExplicitlySaved = false;
      }
      Cat.mergeFullPackInMemory(false);
      if (['home', 'projects', 'admin'].includes(app.activeTab)) app.renderCurrentTab();
    }, () => {});

    // ==================== FILTER & COUNT HELPERS ====================
    Cat._filterCats = function (groupId, searchTxt, includeInactive = false) {
      const q = app.normalizeAr(searchTxt || '');
      const base = includeInactive ? this.allCategories : this.getActiveCategories();
      return base.filter((c) => {
        if (groupId && groupId !== 'all' && this.resolveCatGroup(c) !== groupId) return false;
        if (q && !app.normalizeAr(`${c.ar} ${c.en || ''} ${this.getGroupMeta(this.resolveCatGroup(c)).ar}`).includes(q)) return false;
        return true;
      });
    };

    Cat._groupCounts = function (includeInactive = false) {
      const base = includeInactive ? this.allCategories : this.getActiveCategories();
      const map = { all: base.length };
      base.forEach((c) => {
        const g = this.resolveCatGroup(c);
        map[g] = (map[g] || 0) + 1;
      });
      return map;
    };

    Cat._renderGroupPillsHTML = function (scope, activeGid, includeInactive = false) {
      const fn = scope === 'home' ? 'DamanCatAds.setHomeGroup'
        : scope === 'admin' ? 'DamanCatAds.setAdminGroup'
        : 'DamanCatAds.setMarketGroup';
      const gCounts = this._groupCounts(includeInactive);
      return CATEGORY_GROUPS.map((g) => `
        <button type="button" onclick="${fn}('${g.id}')" class="shrink-0 px-2.5 py-1.5 rounded-xl border text-[10.5px] font-black transition ${activeGid === g.id ? 'bg-amber-500 text-slate-950 border-amber-400 shadow' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-amber-500/40'}">
          ${g.icon} ${g.ar} <span class="opacity-75 text-[9.5px]">(${gCounts[g.id] || 0})</span>
        </button>`).join('');
    };

    // ==================== 1. CLEAR HOME CATEGORIES HUB ====================
    Cat.setHomeGroup = function (gid) {
      this.homeGroup = gid;
      const bar = document.getElementById('daman-home-grp-bar');
      if (bar) bar.innerHTML = this._renderGroupPillsHTML('home', this.homeGroup);
      this._updateHomeCatsCardsOnly();
    };

    Cat.onHomeCatSearch = function (val) {
      this.homeCatSearch = val || '';
      this._updateHomeCatsCardsOnly();
    };

    Cat.toggleHomeCatsExpand = function () {
      this.homeExpanded = !this.homeExpanded;
      this._updateHomeCatsCardsOnly();
    };

    Cat.openFromHomeToCat = function (catId) {
      const c = this.getCatById(catId);
      if (c) this.marketGroup = this.resolveCatGroup(c);
      app.openCategoryFromHome(catId);
    };

    Cat._updateHomeCatsCardsOnly = function () {
      const slot = document.getElementById('daman-home-cats-grid');
      if (!slot) return;
      const filtered = this._filterCats(this.homeGroup, this.homeCatSearch);
      const counts = this.countPostsByCategory(app);
      const showLimit = this.homeExpanded || this.homeGroup !== 'all' || this.homeCatSearch ? filtered.length : 8;
      const visible = filtered.slice(0, showLimit);

      if (!visible.length) {
        slot.innerHTML = `<div class="p-4 rounded-xl bg-slate-950 text-center text-[11px] text-slate-400">لا يوجد قسم بهذا الاسم — جرّب: بامب، خوازيق، أمن، نظافة، برمجة، محاسبة، مكتب فني.</div>`;
        return;
      }

      slot.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          ${visible.map((c) => {
            const hasAd = this.getAdsForCategory(c.id).some((a) => a.categoryId === c.id);
            const gMeta = this.getGroupMeta(this.resolveCatGroup(c));
            return `
              <button type="button" onclick="DamanCatAds.openFromHomeToCat('${app.esc(c.id)}')" class="p-2.5 rounded-2xl bg-slate-950/95 border ${hasAd ? 'border-amber-500/60 bg-amber-500/5' : 'border-slate-800'} hover:border-amber-400 text-start flex items-center justify-between gap-2 transition active:scale-[0.98]">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-base shrink-0">${app.esc(c.icon || '📌')}</span>
                  <div class="min-w-0">
                    <div class="text-[11px] font-black text-white leading-tight line-clamp-2">${app.esc(c.ar)}</div>
                    <div class="text-[9px] text-slate-400 truncate mt-0.5">${gMeta.ar}${hasAd ? ' • 🔥 عرض' : ''}</div>
                  </div>
                </div>
                <span class="px-1.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 text-[10px] font-black shrink-0">${counts[c.id] || 0}</span>
              </button>`;
          }).join('')}
        </div>
        ${filtered.length > 8 && this.homeGroup === 'all' && !this.homeCatSearch ? `
          <button type="button" onclick="DamanCatAds.toggleHomeCatsExpand()" class="w-full mt-2 py-2.5 rounded-xl bg-slate-800/90 border border-amber-500/40 text-amber-300 font-black text-[11px]">
            ${this.homeExpanded ? '▲ إظهار أقل' : `▼ عرض كل الأقسام (${filtered.length} قسم شامل كل تخصصات المقاولات والأعمال)`}
          </button>` : ''}`;
    };

    Cat.enhanceHomeDOM = function (container) {
      const catBtns = container.querySelectorAll('button[onclick^="DamanApp.openCategoryFromHome"]');
      if (!catBtns.length) return;
      const section = catBtns[0].parentNode && catBtns[0].parentNode.parentNode;
      if (!section) return;

      const activeCount = this.getActiveCategories().length;
      section.id = 'daman-home-cats-hub';
      section.className = 'glass-card rounded-3xl p-3.5 border-amber-500/40 space-y-2.5';
      section.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-xs font-black text-amber-400"><i class="fa-solid fa-layer-group me-1"></i> دليل الأقسام والخدمات (${activeCount} قسم)</div>
            <div class="text-[10px] text-slate-400 truncate">إنشاءات، تشطيبات، معدات، أمن، نظافة، مكتب فني، برمجة ومحاسبة</div>
          </div>
          ${app.isAdmin() ? `
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" onclick="DamanCatAds.openCategoryEditorModal('',DamanCatAds.homeGroup)" class="px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 text-[10px] font-black">+ قسم</button>
              <button type="button" onclick="DamanCatAds.openAdminCategoriesTab()" class="px-2 py-1 rounded-xl bg-purple-600/30 border border-purple-400/50 text-purple-200 text-[10px] font-black">إدارة</button>
            </div>` : ''}
        </div>

        <div class="relative">
          <i class="fa-solid fa-magnifying-glass absolute top-2.5 start-3 text-slate-400 text-xs"></i>
          <input type="text" value="${app.esc(this.homeCatSearch)}" oninput="DamanCatAds.onHomeCatSearch(this.value)" placeholder="ابحث عن أي قسم: بامب، خوازيق، كلادينج، أمن، نظافة، برمجة، محاسبة..." class="w-full ps-8 pe-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold" />
        </div>

        <div id="daman-home-grp-bar" class="flex items-center gap-1.5 overflow-x-auto pb-1">
          ${this._renderGroupPillsHTML('home', this.homeGroup)}
        </div>

        <div id="daman-home-cats-grid"></div>`;

      this._updateHomeCatsCardsOnly();
    };

    // ==================== 2. CLEAR MARKET CATEGORIES HUB ====================
    Cat.setMarketGroup = function (gid) {
      this.marketGroup = gid;
      const bar = document.getElementById('daman-mkt-grp-bar');
      if (bar) bar.innerHTML = this._renderGroupPillsHTML('market', this.marketGroup);
      this._updateMarketCatsCardsOnly();
    };

    Cat.onMarketCatSearch = function (val) {
      this.marketCatSearch = val || '';
      this._updateMarketCatsCardsOnly();
    };

    Cat._updateMarketCatsCardsOnly = function () {
      const slot = document.getElementById('daman-mkt-cats-cards');
      if (!slot) return;
      const selCat = (window.DamanProjects && DamanProjects.selectedCategory) || 'all';
      const filtered = this._filterCats(this.marketGroup, this.marketCatSearch);
      const counts = this.countPostsByCategory(app);

      if (this.showGridInMarket || this.marketCatSearch) {
        slot.innerHTML = `
          <div class="grid grid-cols-2 gap-1.5 pt-1 max-h-72 overflow-y-auto">
            <button type="button" onclick="DamanCatAds.selectMarketCat('all')" class="p-2 rounded-xl border text-start flex items-center justify-between gap-1 text-[10.5px] ${selCat === 'all' ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-950 border-slate-800 text-slate-200 font-bold'}">
              <span>🌐 كل الأقسام</span><span class="px-1.5 py-0.5 rounded bg-black/20 text-[9.5px]">${counts.all || 0}</span>
            </button>
            ${filtered.map((c) => {
              const hasAd = this.getAdsForCategory(c.id).some((a) => a.categoryId === c.id);
              return `
                <button type="button" onclick="DamanCatAds.selectMarketCat('${app.esc(c.id)}')" class="p-2 rounded-xl border text-start flex items-center justify-between gap-1 text-[10.5px] ${selCat === c.id ? 'bg-amber-500 text-slate-950 border-amber-400 font-black' : 'bg-slate-950 border-slate-800 text-slate-200 font-bold'}">
                  <span class="truncate">${app.esc(c.icon || '📌')} ${app.esc(c.ar)}${hasAd ? ' 🔥' : ''}</span>
                  <span class="px-1.5 py-0.5 rounded bg-black/20 text-[9.5px] shrink-0">${counts[c.id] || 0}</span>
                </button>`;
            }).join('')}
          </div>`;
        return;
      }

      slot.innerHTML = `
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px] font-extrabold">
          <button type="button" onclick="DamanCatAds.selectMarketCat('all')" class="shrink-0 px-3 py-1.5 rounded-xl border ${selCat === 'all' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-800 text-slate-300'}">
            🌐 الكل (${counts.all || 0})
          </button>
          ${filtered.map((c) => {
            const hasAd = this.getAdsForCategory(c.id).some((a) => a.categoryId === c.id);
            return `
              <button type="button" onclick="DamanCatAds.selectMarketCat('${app.esc(c.id)}')" class="shrink-0 px-3 py-1.5 rounded-xl border ${selCat === c.id ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-800 text-slate-300'}">
                ${app.esc(c.icon || '📌')} ${app.esc(c.ar)} (${counts[c.id] || 0})${hasAd ? ' ★' : ''}
              </button>`;
          }).join('')}
        </div>`;
    };

    Cat.enhanceMarketDOM = function (container) {
      if (!window.DamanProjects || DamanProjects.subTab !== 'market') return;
      const listSlot = document.getElementById('daman-market-list-slot');
      if (!listSlot) return;

      const oldSel = container.querySelector('select[onchange*="DamanProjects.setCategory"]');
      if (oldSel) oldSel.classList.add('hidden');

      let wrap = document.getElementById('daman-cats-enhanced-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'daman-cats-enhanced-wrap';
        wrap.className = 'space-y-2.5';
        listSlot.parentNode.insertBefore(wrap, listSlot);
      }

      const selCat = DamanProjects.selectedCategory || 'all';
      const activeCats = this.getActiveCategories();

      wrap.innerHTML = `
        <div class="glass-card rounded-2xl p-3 border-amber-500/40 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] font-black text-amber-400 truncate">
              🗂️ القسم الحالي: <span class="text-white">${app.esc(this.getCatName(selCat))}</span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              ${app.isAdmin() ? `<button type="button" onclick="DamanCatAds.openCategoryEditorModal('',DamanCatAds.marketGroup)" class="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[10px] font-black">+ قسم</button>` : ''}
              <button type="button" onclick="DamanCatAds.toggleMarketGrid()" class="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/50 text-amber-300 text-[10px] font-black">
                ${this.showGridInMarket ? 'إغلاق ×' : `⊞ الكل (${activeCats.length})`}
              </button>
            </div>
          </div>

          <div id="daman-mkt-grp-bar" class="flex items-center gap-1 overflow-x-auto pb-0.5">
            ${this._renderGroupPillsHTML('market', this.marketGroup)}
          </div>

          <input type="text" value="${app.esc(this.marketCatSearch)}" oninput="DamanCatAds.onMarketCatSearch(this.value)" placeholder="ابحث عن أي قسم: بامب، خوازيق، كلادينج، أمن، نظافة، برمجة، محاسبة..." class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-white" />

          <div id="daman-mkt-cats-cards"></div>
        </div>
        ${this.renderCategoryAdsBlock(selCat, app)}`;

      this._updateMarketCatsCardsOnly();
    };

    // ==================== 3. CLEAN ADMIN CATEGORIES & ADS MANAGER (WITH GROUP FILTER + SEARCH) ====================
    Cat.setAdminGroup = function (gid) {
      this.adminGroup = gid;
      const bar = document.getElementById('daman-adm-grp-bar');
      if (bar) bar.innerHTML = this._renderGroupPillsHTML('admin', this.adminGroup, true);
      this._updateAdminCatsListOnly();
    };

    Cat.onAdminCatSearch = function (val) {
      this.adminCatSearch = val || '';
      this._updateAdminCatsListOnly();
    };

    Cat._updateAdminCatsListOnly = function () {
      const slot = document.getElementById('daman-adm-cats-list');
      if (!slot) return;
      const counts = this.countPostsByCategory(app);
      const filtered = this._filterCats(this.adminGroup, this.adminCatSearch, true);

      if (!filtered.length) {
        slot.innerHTML = `<div class="p-4 rounded-xl bg-slate-950 text-center text-slate-400">لا توجد أقسام مطابقة للبحث.</div>`;
        return;
      }

      slot.innerHTML = filtered.map((c) => {
        const realIdx = this.allCategories.findIndex((x) => x.id === c.id);
        const gMeta = this.getGroupMeta(this.resolveCatGroup(c));
        const adsCnt = this.categoryAds.filter((a) => a.categoryId === c.id).length;
        return `
          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 ${c.active === false ? 'opacity-55' : ''}">
            <div class="min-w-0">
              <b class="text-white block truncate">${app.esc(c.icon || '📌')} ${app.esc(c.ar)}</b>
              <span class="text-[9.5px] text-slate-400">${gMeta.icon} ${gMeta.ar} • إعلانات: <b class="text-emerald-400">${counts[c.id] || 0}</b> • بانرات: <b class="text-purple-300">${adsCnt}</b></span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button type="button" onclick="DamanCatAds.moveCategoryOrder(${realIdx},-1)" class="px-1.5 py-1 rounded bg-slate-800 text-slate-300 text-[10px]" title="أعلى">↑</button>
              <button type="button" onclick="DamanCatAds.moveCategoryOrder(${realIdx},1)" class="px-1.5 py-1 rounded bg-slate-800 text-slate-300 text-[10px]" title="أسفل">↓</button>
              <button type="button" onclick="DamanCatAds.openCategoryEditorModal('${app.esc(c.id)}')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">تعديل</button>
              <button type="button" onclick="DamanCatAds.toggleCategoryActive('${app.esc(c.id)}')" class="px-2 py-1 rounded bg-slate-800 ${c.active !== false ? 'text-emerald-400' : 'text-rose-400'} text-[10px]">${c.active !== false ? 'ظاهر' : 'مخفي'}</button>
              <button type="button" onclick="DamanCatAds.deleteCategory('${app.esc(c.id)}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[10px]">حذف</button>
            </div>
          </div>`;
      }).join('');
    };

    Cat.renderAdminCategoriesPanel = function (a) {
      const now = Date.now();
      setTimeout(() => this._updateAdminCatsListOnly(), 10);

      return `
        <div class="space-y-4 text-xs">
          <!-- 1. One-Click Save / Restore Full 60-Category Pack -->
          <div class="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/50 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-black text-emerald-300">✨ الباقة الشاملة (${FULL_CATEGORIES_PACK.length} قسم في 7 مجموعات)</div>
              <div class="text-[10px] text-slate-300">إنشاءات + بامب + خوازيق + تشطيبات + معدات + أمن + نظافة + مكتب فني + برمجة ومحاسبة</div>
            </div>
            <button type="button" onclick="DamanCatAds.restoreFullPackAndSave()" class="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-[10px] shrink-0">حفظ/استعادة الكل</button>
          </div>

          <!-- 2. Super-Fast Quick Add Any Category -->
          <form onsubmit="DamanCatAds.quickAddCustomCategory(event)" class="glass-card rounded-2xl p-3.5 border-sky-500/40 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-black text-sky-300">⚡ إضافة سريعة لأي قسم جديد من التطبيق</span>
              <button type="button" onclick="DamanCatAds.openCategoryEditorModal('')" class="text-[10px] text-amber-300 underline font-bold">فتح نافذة الأيقونات</button>
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              <input id="qcat-ar" type="text" required placeholder="اكتب اسم القسم الجديد هنا..." class="col-span-3 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold" />
              <input id="qcat-ic" type="text" value="🏗️" placeholder="أيقونة" class="px-2 py-2 rounded-xl bg-slate-950 border border-amber-500/40 text-white text-center text-sm" />
            </div>
            <div class="flex gap-1.5">
              <select id="qcat-grp" class="flex-1 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold">
                ${CATEGORY_GROUPS.filter((g) => g.id !== 'all').map((g) => `<option value="${g.id}">${g.icon} ${g.ar}</option>`).join('')}
              </select>
              <button type="submit" class="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-black shrink-0">+ إضافة فورية</button>
            </div>
          </form>

          <!-- 3. Category Ads Management -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-purple-500/40">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black text-purple-300">📢 إعلانات وبانرات الأقسام (${this.categoryAds.length})</span>
              <button type="button" onclick="DamanCatAds.openCategoryAdModal('')" class="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-black text-[10.5px]">+ إعلان لقسم</button>
            </div>
            ${!this.categoryAds.length ? `<div class="p-3.5 rounded-xl bg-slate-950 text-center text-slate-500">لا توجد بانرات مخصصة للأقسام بعد — اضغط «+ إعلان لقسم».</div>` : this.categoryAds.map((ad) => {
              const expired = ad.expiresAt && Number(ad.expiresAt) > 0 && Number(ad.expiresAt) < now;
              return `
                <div class="p-3 rounded-xl bg-slate-950 border ${ad.active !== false && !expired ? 'border-purple-500/40' : 'border-slate-800 opacity-70'} flex justify-between items-start gap-2">
                  <div class="min-w-0">
                    <span class="text-[10px] font-black text-amber-300">${a.esc(this.getCatName(ad.categoryId))}</span>
                    <div class="font-black text-white truncate">${a.esc(ad.title)}</div>
                    <div class="text-[9.5px] text-slate-400">${ad.priceText ? a.esc(ad.priceText) + ' • ' : ''}${expired ? '⏰ منتهي' : ad.expiresAt ? 'حتى ' + new Date(ad.expiresAt).toLocaleDateString('ar-EG') : 'دائم'}</div>
                  </div>
                  <div class="flex gap-1 shrink-0">
                    <button type="button" onclick="DamanCatAds.openCategoryAdModal('${a.esc(ad.id)}')" class="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">تعديل</button>
                    <button type="button" onclick="DamanCatAds.toggleCategoryAd('${a.esc(ad.id)}')" class="px-2 py-1 rounded bg-slate-800 ${ad.active !== false ? 'text-emerald-400' : 'text-rose-400'} font-bold text-[10px]">${ad.active !== false ? 'مفعّل' : 'موقوف'}</button>
                    <button type="button" onclick="DamanCatAds.deleteCategoryAd('${a.esc(ad.id)}')" class="px-2 py-1 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">حذف</button>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- 4. Filterable Categories Manager (All 60+ Categories) -->
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5 border-amber-500/40">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black text-amber-400">🗂️ كل الأقسام (${this.allCategories.length} قسم)</span>
              <button type="button" onclick="DamanCatAds.openCategoryEditorModal('',DamanCatAds.adminGroup)" class="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-[10.5px]">+ قسم جديد</button>
            </div>
            <div id="daman-adm-grp-bar" class="flex items-center gap-1 overflow-x-auto pb-1">
              ${this._renderGroupPillsHTML('admin', this.adminGroup, true)}
            </div>
            <input type="text" value="${a.esc(this.adminCatSearch)}" oninput="DamanCatAds.onAdminCatSearch(this.value)" placeholder="ابحث داخل الأقسام للتعديل أو الإخفاء أو الترتيب..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-white" />
            <div id="daman-adm-cats-list" class="space-y-1.5"></div>
          </div>
        </div>`;
    };

    // Apply immediately!
    Cat.mergeFullPackInMemory(false);
    if (['home', 'projects', 'admin'].includes(app.activeTab)) app.renderCurrentTab();
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(attachCategoriesPack, 260));
  else setTimeout(attachCategoriesPack, 260);
})();
