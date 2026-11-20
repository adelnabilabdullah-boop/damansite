(function () {
  const CompanyMod = {
    subTab: 'team', // 'team' | 'contracts'
    members: [],
    myMemberships: [],
    companyContracts: [],
    attachedUid: null,
    unsubMembers: null,
    unsubMemberships: null,
    unsubContracts: null,

    ensureListeners(app) {
      if (!app.user || !app.profile) {
        this.detachListeners();
        return;
      }

      if (this.attachedUid === app.user.uid) return;
      this.detachListeners();
      this.attachedUid = app.user.uid;

      const email = (app.profile.email || app.user.email || '').toLowerCase();

      // 1. If user is a company owner, listen to their team members
      if (app.profile.accountType === 'company') {
        this.unsubMembers = app.db
          .collection('companyMembers')
          .where('companyUid', '==', app.user.uid)
          .onSnapshot(
            (snap) => {
              this.members = snap.docs
                .map((d) => Object.assign({ id: d.id }, d.data()))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
              if (app.activeTab === 'company') this.rerender();
            },
            (err) => console.error('companyMembers error:', err)
          );

        this.unsubContracts = app.db
          .collection('projects')
          .where('awardedTo', '==', app.user.uid)
          .limit(25)
          .onSnapshot(
            (snap) => {
              this.companyContracts = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
              if (app.activeTab === 'company' && this.subTab === 'contracts') this.rerender();
            },
            () => {}
          );
      }

      // 2. Listen if this user's email was granted Access by any company
      if (email) {
        this.unsubMemberships = app.db
          .collection('companyMembers')
          .where('memberEmail', '==', email)
          .onSnapshot(
            (snap) => {
              this.myMemberships = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
              if (app.activeTab === 'company') this.rerender();
            },
            () => {}
          );
      }
    },

    detachListeners() {
      if (this.unsubMembers) { this.unsubMembers(); this.unsubMembers = null; }
      if (this.unsubMemberships) { this.unsubMemberships(); this.unsubMemberships = null; }
      if (this.unsubContracts) { this.unsubContracts(); this.unsubContracts = null; }
      this.attachedUid = null;
      this.members = [];
      this.myMemberships = [];
      this.companyContracts = [];
    },

    rerender() {
      const main = document.getElementById('app-main');
      if (main && window.DamanApp && window.DamanApp.activeTab === 'company') {
        this.render(main, window.DamanApp);
      }
    },

    setSubTab(tab) {
      this.subTab = tab;
      this.rerender();
    },

    canGrantAccess(app) {
      const p = app.profile || {};
      const pkgs = app.getPackages();
      const minBal = Number(pkgs.minCompanyBalanceForAccess || 100);
      const isVerified = p.kycStatus === 'verified';
      const hasBalanceOrPlan = Number(p.balanceAvailable || 0) >= minBal || p.activePlanKey === 'company';
      return {
        allowed: isVerified && hasBalanceOrPlan,
        isVerified,
        hasBalanceOrPlan,
        minBal
      };
    },

    async addTeamMember(e) {
      e.preventDefault();
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      const check = this.canGrantAccess(app);
      if (!check.allowed && !app.isAdmin()) {
        return app.toast(isAr ? 'يجب استيفاء شرط التوثيق والرصيد أولاً لإضافة فريق العمل' : 'Verification & balance required first', 'error');
      }

      const memberName = document.getElementById('cm-name').value.trim();
      const memberEmail = document.getElementById('cm-email').value.trim().toLowerCase();
      const roleTitle = document.getElementById('cm-role').value.trim();

      if (memberEmail === (app.profile.email || '').toLowerCase()) {
        return app.toast(isAr ? 'هذا بريدك الشخصي كصاحب الشركة بالفعل' : 'This is already your owner email', 'warning');
      }

      const perms = [];
      if (document.getElementById('perm-post')?.checked) perms.push('post_projects');
      if (document.getElementById('perm-bid')?.checked) perms.push('submit_bids');
      if (document.getElementById('perm-chat')?.checked) perms.push('chat_clients');
      if (document.getElementById('perm-contracts')?.checked) perms.push('view_contracts');

      if (!perms.length) {
        return app.toast(isAr ? 'اختر صلاحية واحدة على الأقل للموظف' : 'Select at least one permission', 'warning');
      }

      const btn = document.getElementById('cm-submit-btn');
      if (btn) btn.disabled = true;

      try {
        await app.db.collection('companyMembers').add({
          companyUid: app.user.uid,
          companyName: app.profile.companyName || app.profile.name || '',
          ownerEmail: app.profile.email || app.user.email || '',
          memberName,
          memberEmail,
          roleTitle,
          permissions: perms,
          status: 'active',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        e.target.reset();
        app.toast(isAr ? `تم منح صلاحيات (Access) لـ ${memberName} بنجاح` : `Access granted to ${memberName}`, 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    },

    async toggleMemberStatus(docId, currentStatus) {
      const app = window.DamanApp;
      const next = currentStatus === 'active' ? 'suspended' : 'active';
      try {
        await app.db.collection('companyMembers').doc(docId).update({ status: next });
        app.toast(app.lang === 'ar' ? (next === 'active' ? 'تم إعادة تفعيل الصلاحية' : 'تم إيقاف صلاحية الموظف مؤقتاً') : 'Status updated', 'info');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    async removeMember(docId, name) {
      const app = window.DamanApp;
      const isAr = app.lang === 'ar';
      if (!window.confirm(isAr ? `تأكيد سحب صلاحية وحذف "${name}" من فريق الشركة؟` : `Remove "${name}" from team?`)) return;
      try {
        await app.db.collection('companyMembers').doc(docId).delete();
        app.toast(isAr ? 'تم سحب الصلاحية وحذف الموظف بنجاح' : 'Member removed', 'success');
      } catch (err) {
        app.toast(err.message, 'error');
      }
    },

    permLabel(key, isAr) {
      const map = {
        post_projects: isAr ? 'نشر مشاريع' : 'Post Projects',
        submit_bids: isAr ? 'تقديم عروض أسعار' : 'Submit Bids',
        chat_clients: isAr ? 'مراسلة العملاء' : 'Client Chat',
        view_contracts: isAr ? 'متابعة العقود' : 'View Contracts'
      };
      return map[key] || key;
    },

    renderTeamTab(app) {
      const isAr = app.lang === 'ar';
      const check = this.canGrantAccess(app);
      const unlocked = check.allowed || app.isAdmin();

      const gateHtml = !unlocked
        ? `
          <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/40 space-y-2.5">
            <div class="text-xs font-black text-rose-300"><i class="fa-solid fa-lock me-1"></i> ${isAr ? 'متطلبات فتح صلاحيات فريق العمل (Access):' : 'Requirements to Unlock Team Access:'}</div>
            <div class="space-y-1.5 text-[11px]">
              <div class="flex items-center justify-between">
                <span class="${check.isVerified ? 'text-emerald-300' : 'text-slate-200'}">
                  <i class="fa-solid ${check.isVerified ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-rose-400'} me-1"></i>
                  ${isAr ? '1. توثيق الشركة بالسجل التجاري والبطاقة الضريبية' : '1. Company KYC (CR & Tax Card)'}
                </span>
                ${!check.isVerified ? `<button onclick="DamanApp.switchTab('wallet'); setTimeout(()=>DamanWallet.openKycModal(),150)" class="px-2 py-1 rounded-lg bg-sky-500 text-slate-950 font-black text-[10px]">${isAr ? 'وثّق الآن' : 'Verify'}</button>` : ''}
              </div>
              <div class="flex items-center justify-between">
                <span class="${check.hasBalanceOrPlan ? 'text-emerald-300' : 'text-slate-200'}">
                  <i class="fa-solid ${check.hasBalanceOrPlan ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-rose-400'} me-1"></i>
                  ${isAr ? `2. وجود رصيد متاح (${app.fmtMoney(check.minBal)} ج.م على الأقل) أو باقة شركات` : `2. Min balance (${check.minBal} EGP) or Company Plan`}
                </span>
                ${!check.hasBalanceOrPlan ? `<button onclick="DamanWallet.setSubTab('deposit'); DamanApp.switchTab('wallet')" class="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px]">${isAr ? 'اشحن الآن' : 'Deposit'}</button>` : ''}
              </div>
            </div>
          </div>`
        : `
          <form onsubmit="DamanCompany.addTeamMember(event)" class="glass-card rounded-2xl p-3.5 space-y-2.5 border-sky-500/30">
            <h4 class="text-xs font-extrabold text-sky-400"><i class="fa-solid fa-user-plus me-1"></i> ${isAr ? 'إضافة مهندس أو مشرف ومنحه صلاحية (Access)' : 'Invite Team Member'}</h4>
            <input id="cm-name" type="text" required placeholder="${isAr ? 'اسم المهندس / الموظف' : 'Member Full Name'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cm-email" type="email" required placeholder="${isAr ? 'البريد الإلكتروني الخاص به (Email)' : 'Member Email Address'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <input id="cm-role" type="text" required placeholder="${isAr ? 'المسمى الوظيفي (مثال: مهندس موقع، مدير مشاريع)' : 'Job Title (e.g. Site Engineer)'}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />

            <div class="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div class="text-[10px] font-bold text-slate-400">${isAr ? 'حدد الصلاحيات المسموح بها (السحب المالي مقفول لصاحب الشركة فقط):' : 'Select Permissions (Withdrawals locked to Owner):'}</div>
              <div class="grid grid-cols-2 gap-1.5 text-[11px] text-slate-200">
                <label class="flex items-center gap-1.5"><input id="perm-post" type="checkbox" checked class="accent-sky-500" /> ${isAr ? 'نشر مشاريع' : 'Post Projects'}</label>
                <label class="flex items-center gap-1.5"><input id="perm-bid" type="checkbox" checked class="accent-sky-500" /> ${isAr ? 'تقديم عروض' : 'Submit Bids'}</label>
                <label class="flex items-center gap-1.5"><input id="perm-chat" type="checkbox" checked class="accent-sky-500" /> ${isAr ? 'مراسلة العملاء' : 'Client Chat'}</label>
                <label class="flex items-center gap-1.5"><input id="perm-contracts" type="checkbox" checked class="accent-sky-500" /> ${isAr ? 'متابعة العقود' : 'View Contracts'}</label>
              </div>
            </div>

            <button id="cm-submit-btn" type="submit" class="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs">
              <i class="fa-solid fa-key me-1"></i> ${isAr ? 'منح الصلاحية الآن' : 'Grant Access'}
            </button>
          </form>`;

      const listHtml = !this.members.length
        ? `<div class="text-center text-xs text-slate-400 py-5">${isAr ? 'لم تقم بإضافة أي موظفين أو مهندسين لفريق الشركة بعد' : 'No team members added yet'}</div>`
        : this.members.map((m) => `
            <div class="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-xs font-extrabold text-white truncate">${app.esc(m.memberName)} <span class="text-[10px] text-sky-400 font-bold">(${app.esc(m.roleTitle)})</span></div>
                  <div class="text-[10px] text-slate-400 truncate">${app.esc(m.memberEmail)}</div>
                </div>
                <span class="text-[9px] px-2 py-0.5 rounded-full font-bold ${m.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">${m.status === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'موقوف' : 'Paused')}</span>
              </div>
              <div class="flex flex-wrap gap-1">
                ${(m.permissions || []).map((pr) => `<span class="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">${this.permLabel(pr, isAr)}</span>`).join('')}
              </div>
              <div class="flex items-center gap-2 pt-1">
                <button onclick="DamanCompany.toggleMemberStatus('${m.id}','${m.status}')" class="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-bold">
                  ${m.status === 'active' ? (isAr ? 'إيقاف مؤقت' : 'Pause') : (isAr ? 'تفعيل' : 'Activate')}
                </button>
                <button onclick="DamanCompany.removeMember('${m.id}','${app.esc(m.memberName).replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>`).join('');

      return `
        <div class="space-y-3.5">
          ${gateHtml}
          <div class="glass-card rounded-2xl p-3.5 space-y-2.5">
            <h4 class="text-xs font-extrabold text-white"><i class="fa-solid fa-users-gear text-amber-400 me-1"></i> ${isAr ? 'فريق عمل الشركة' : 'Company Team'} (${this.members.length})</h4>
            ${listHtml}
          </div>
        </div>`;
    },

    renderContractsTab(app) {
      const isAr = app.lang === 'ar';
      if (!this.companyContracts.length) {
        return `<div class="glass-card rounded-2xl p-6 text-center text-xs text-slate-400">${isAr ? 'لا توجد عقود مسندة للشركة حتى الآن' : 'No company contracts yet'}</div>`;
      }
      return `
        <div class="space-y-2.5">
          ${this.companyContracts.map((c) => `
            <div onclick="DamanApp.switchTab('projects'); setTimeout(()=>DamanProjects.openProjectDetail('${c.id}'),150)" class="glass-card rounded-2xl p-3.5 space-y-1.5 cursor-pointer hover:border-amber-500/40">
              <div class="flex items-center justify-between text-xs font-extrabold">
                <span class="text-white truncate">${app.esc(c.title)}</span>
                <span class="text-emerald-400 shrink-0">${app.fmtMoney(c.contractAmount)} ${app.t('egp')}</span>
              </div>
              <div class="text-[10px] text-slate-400">${app.esc(c.contractNumber || '')} — ${app.esc(c.location || '')}</div>
            </div>`).join('')}
        </div>`;
    },

    renderInvitedMemberView(app) {
      const isAr = app.lang === 'ar';
      return `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-sky-900/50 to-slate-950 border border-sky-500/40 space-y-1">
            <div class="text-xs font-black text-sky-300"><i class="fa-solid fa-id-badge me-1"></i> ${isAr ? 'صلاحيات الشركات الممنوحة لك (Access)' : 'Your Company Access'}</div>
            <div class="text-[11px] text-slate-300">${isAr ? 'الشركات التي أضافت بريدك الإلكتروني لفريق العمل:' : 'Companies that granted your email team access:'}</div>
          </div>
          ${this.myMemberships.map((m) => `
            <div class="glass-card rounded-2xl p-3.5 space-y-2 border-sky-500/30">
              <div class="flex items-center justify-between">
                <div class="text-sm font-black text-white">${app.esc(m.companyName)}</div>
                <span class="text-[10px] px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} font-bold">${m.status === 'active' ? (isAr ? 'صلاحية نشطة' : 'Active') : (isAr ? 'موقوفة' : 'Paused')}</span>
              </div>
              <div class="text-xs text-sky-300 font-bold">${isAr ? 'المسمى الوظيفي:' : 'Role:'} ${app.esc(m.roleTitle)}</div>
              <div class="flex flex-wrap gap-1.5 pt-1">
                ${(m.permissions || []).map((pr) => `<span class="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-bold">${this.permLabel(pr, isAr)}</span>`).join('')}
              </div>
              ${m.status === 'active' ? `
                <div class="grid grid-cols-2 gap-2 pt-2">
                  <button onclick="DamanApp.switchTab('projects')" class="py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${isAr ? 'المشاريع والعروض' : 'Projects'}</button>
                  <button onclick="DamanApp.switchTab('chat')" class="py-2 rounded-xl bg-sky-500/20 text-sky-300 font-black text-xs">${isAr ? 'الدردشة' : 'Chats'}</button>
                </div>` : ''}
            </div>`).join('')}
        </div>`;
    },

    render(container, app) {
      this.ensureListeners(app);
      const isAr = app.lang === 'ar';

      if (!app.user || !app.profile) {
        container.innerHTML = `
          <div class="glass-card rounded-2xl p-6 text-center mt-6 space-y-3">
            <i class="fa-solid fa-building-shield text-4xl text-sky-400"></i>
            <h3 class="text-base font-extrabold text-white">${isAr ? 'سجّل الدخول لفتح لوحة الشركات' : 'Sign in for Company Panel'}</h3>
            <button onclick="DamanApp.openAuthModal('login')" class="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">${app.t('loginBtn')}</button>
          </div>`;
        return;
      }

      const p = app.profile;
      const isCompanyOwner = p.accountType === 'company';

      // If not a company owner, show invited memberships if any, else explain how to register as company
      if (!isCompanyOwner) {
        if (this.myMemberships.length) {
          container.innerHTML = this.renderInvitedMemberView(app);
          return;
        }
        container.innerHTML = `
          <div class="glass-card rounded-2xl p-6 text-center mt-6 space-y-3">
            <i class="fa-solid fa-building text-4xl text-sky-400"></i>
            <h3 class="text-sm font-black text-white">${isAr ? 'لوحة إدارة الشركات (B2B & Access)' : 'Company Management Panel'}</h3>
            <p class="text-xs text-slate-400 leading-relaxed">
              ${isAr
                ? 'هذه اللوحة مخصصة لحسابات الشركات والمكاتب الهندسية الموثّقة بالسجل التجاري والبطاقة الضريبية، أو للمهندسين والموظفين المضافين لفريق شركة.'
                : 'This panel is for verified Company accounts (CR & Tax Card) or invited team members.'}
            </p>
          </div>`;
        return;
      }

      container.innerHTML = `
        <div class="space-y-3.5">
          <div class="rounded-2xl p-4 bg-gradient-to-br from-sky-900/50 via-slate-900 to-slate-950 border border-sky-500/40 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-sm font-black text-white truncate"><i class="fa-solid fa-building-shield text-sky-400 me-1.5"></i>${app.esc(p.companyName || p.name)}</div>
                <div class="text-[10px] text-slate-300 mt-0.5">
                  ${p.commercialReg ? `${isAr ? 'س.ت:' : 'CR:'} ${app.esc(p.commercialReg)}` : ''}
                  ${p.taxCardNumber ? ` | ${isAr ? 'بطاقة ضريبية:' : 'Tax:'} ${app.esc(p.taxCardNumber)}` : ''}
                </div>
              </div>
              <span class="text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 ${p.kycStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                ${p.kycStatus === 'verified' ? app.t('verified') : app.t('unverified')}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button onclick="DamanCompany.setSubTab('team')" class="py-2 rounded-lg text-xs font-extrabold ${this.subTab === 'team' ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'فريق العمل (Access)' : 'Team Access'}</button>
            <button onclick="DamanCompany.setSubTab('contracts')" class="py-2 rounded-lg text-xs font-extrabold ${this.subTab === 'contracts' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}">${isAr ? 'عقود الشركة (B2B)' : 'B2B Contracts'}</button>
          </div>

          ${this.subTab === 'team' ? this.renderTeamTab(app) : this.renderContractsTab(app)}
        </div>`;
    }
  };

  window.DamanCompany = CompanyMod;
  if (window.DamanApp) window.DamanApp.registerModule('company', CompanyMod);
})();
