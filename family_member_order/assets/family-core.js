'use strict';
/* Parent account state. Browser-only prototype; no email or member lookup API. */
(() => {
  const STORAGE_KEY = 'plume-light-family-links-v1';
  const view = document.body.dataset.familyView;
  if (!view) return;
  const translate = (zh, en) => language === 'en' ? en : zh;
  const defaults = () => ({
    version: 1,
    parent: { name: 'May Chen', tier: 'Silver' },
    activeMemberId: 'lin', bookingMemberId: 'lin', journeyMemberId: 'child',
    members: [
      { id: 'lin', name: 'Lin Chen', firstName: 'Lin', lastName: 'Chen', memberNo: '1600123456', email: 'lin.chen@example.com', phone: '+852 51234567', relationship: 'parent', status: 'linked', trackingGranted: false, linkedAt: '2026-10-28', trackingRequested: false },
      { id: 'child', name: 'Alex Chen', firstName: 'Alex', lastName: 'Chen', memberNo: '1600654321', email: 'alex.chen@example.com', phone: '+852 59876543', relationship: 'parent', status: 'linked', trackingGranted: true, linkedAt: '2026-10-30', trackingRequested: false }
    ],
    invites: [], benefits: { completedCount: 1 },
    form: { method: 'memberNo', memberNo: '1800899032', phone: '+852 52345678', email: 'emily.chen@example.com', lastName: 'Chen', firstName: 'Emily', relationship: 'parent' }
  });
  let data;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    data = saved?.version === 1 && Array.isArray(saved.members) && Array.isArray(saved.invites) ? saved : defaults();
  } catch (_) { data = defaults(); }
  if (!['zh-Hant', 'en'].includes(language)) setLanguage('zh-Hant');
  const profileFields = ['flight', 'region', 'pickup', 'pickupAddress', 'destinationAddress', 'contact', 'phone', 'recipient', 'recipientPhone', 'partner', 'pickupPartner', 'routeLink', 'transport', 'agent'];
  const profile = () => Object.fromEntries(profileFields.filter(k => state[k] !== undefined).map(k => [k, clone(state[k])]));
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
    catch (_) { return false; }
  };
  const fileFor = (target, step) => {
    if (target === 'book' || target === 'booking') return ['pages/information.html', 'pages/baggage.html', 'pages/pricing.html', 'pages/checkout.html'][Math.max(0, Math.min(3, (step || 2) - 2))];
    return { connections: 'index.html', home: 'index.html', benefits: 'pages/benefits.html', invitation: 'pages/invitation.html', authorization: 'pages/authorization.html', journey: 'pages/journey.html', info: 'pages/information.html', passenger: 'pages/information.html', baggage: 'pages/baggage.html', pricing: 'pages/pricing.html', checkout: 'pages/checkout.html', agent: 'pages/assistant.html', assistant: 'pages/assistant.html' }[target] || 'index.html';
  };
  const familyHref = (target, step) => ROOT_PREFIX + fileFor(target, step);
  const currentMember = () => data.members.find(m => m.id === data.activeMemberId) || null;
  const announce = message => {
    const slot = document.getElementById('toast');
    clearTimeout(window.familyToastTimer);
    slot.textContent = message;
    window.familyToastTimer = setTimeout(() => { slot.textContent = ''; }, 5000);
  };
  function selectMember(id, remember = true) {
    const member = data.members.find(m => m.id === id && m.status === 'linked');
    if (!member || state.processing) return false;
    const changed = state.travellerId !== id;
    state.familyProfiles ??= {};
    if (state.drafts?.[state.travellerId]) state.familyProfiles[state.travellerId] = profile();
    data.activeMemberId = id;
    if (view === 'booking') data.bookingMemberId = id;
    if (view === 'journey' || view === 'benefits') data.journeyMemberId = id;
    if (state.drafts[id]) {
      if (state.familyProfiles[id]) Object.assign(state, clone(state.familyProfiles[id]));
      else {
        const base = initial();
        profileFields.forEach(k => { if (base[k] !== undefined) state[k] = clone(base[k]); });
        state.contact = data.parent.name;
        state.recipient = member.name;
        state.recipientPhone = member.phone;
      }
      state.travellerId = id;
      state.profile = id === 'child' ? 'child' : 'student';
      state.family = false;
      if (!state.drafts[id].items.some(item => item.id === state.agent.itemId)) state.agent.itemId = state.drafts[id].items[0]?.id || '';
      if (changed) state.agreed = false;
      migrateBookingState();
      refreshTransport();
      state.familyProfiles[id] = profile();
    }
    if (remember) { save(); persist(); }
    return true;
  }
  const relation = key => ({ parent: translate('父母', 'Parent'), guardian: translate('法定監護人', 'Legal guardian'), other: translate('其他家庭成員', 'Other family member') }[key] || '');
  const mask = value => {
    const s = String(value || '');
    if (s.includes('@')) return s.slice(0, 2) + '•••@' + s.split('@')[1];
    return s.length > 4 ? '•••• ' + s.slice(-4) : s;
  };
  const id = () => (globalThis.crypto?.randomUUID?.() || 'family-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  const methodLabel = method => ({ memberNo: translate('國泰會籍號碼', 'Cathay membership number'), phone: translate('手提電話號碼', 'Mobile phone number'), email: translate('電郵地址', 'Email address') }[method]);
  const normalize = (method, value) => method === 'email' ? value.trim().toLowerCase() : value.replace(/[\s()-]/g, '').toLowerCase();
  function registerMember(member) {
    if (!PEOPLE.some(p => p.id === member.id)) PEOPLE.push({id:member.id,name:member.name,type:'student'});
  }
  function ensureDemoTrip(member) {
    registerMember(member);
    if (state.drafts[member.id]) return;
    const base = initial();
    const bookingId = 'PL-FAMILY-' + member.id.slice(-12).toUpperCase();
    base.flight.bookingId = bookingId;
    base.flight.baggageAllowance = {bookingId,travellers:{[member.id]:{pieces:2,kgPerPiece:23}}};
    base.contact = data.parent.name;
    base.recipient = member.name;
    base.recipientPhone = member.phone || '+44 7700 900123';
    const declaration = clone(base.drafts.lin);
    declaration.items.forEach((item,i) => { item.id=member.id+'-bag-'+(i+1); });
    base.agent.itemId = declaration.items[0]?.id || '';
    state.drafts[member.id] = declaration;
    state.familyProfiles ??= {};
    state.familyProfiles[member.id] = Object.fromEntries(profileFields.filter(k => base[k] !== undefined).map(k => [k,clone(base[k])]));
    member.demoTrip = true;
    persist();
  }
  window.Family = {
    data, view, t: translate, esc, icon, href: familyHref, currentMember, selectMember, save, toast: announce, relation, mask, methodLabel, id, normalize, ensureDemoTrip,
    invitationUrl(invite) { return familyHref('invitation') + '?invite=' + encodeURIComponent(invite.token); },
    authorizationUrl(member) { return familyHref('authorization') + '?member=' + encodeURIComponent(member.id) + '&token=' + encodeURIComponent(member.authorizationToken || ''); },
    hasTrip(member = currentMember()) { return !!member && !!state.drafts[member.id] && (['lin','child'].includes(member.id) || !!state.familyProfiles?.[member.id]?.flight); },
    getOrders: () => clone(state.orders),
    memberName: memberId => data.members.find(m=>m.id===memberId)?.name || '',
    initialize() {
      data.members.forEach(registerMember);
      const requested = new URLSearchParams(location.search).get('member');
      const chosen = requested || (['journey', 'benefits'].includes(view) ? data.journeyMemberId : data.bookingMemberId);
      const selected = data.members.find(m => m.id === chosen && m.status === 'linked') || data.members.find(m => m.status === 'linked');
      if (selected) selectMember(selected.id);
      state.family = false;
      if (view === 'booking') { state.view = 'book'; state.step = Math.max(2, BOOK_PAGES.indexOf(page) + 1); }
      else state.view = view === 'assistant' ? 'agent' : view;
      save(); persist();
    },
    reload() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved?.version === 1 && Array.isArray(saved.members)) {
          const active = data.activeMemberId;
          Object.keys(data).forEach(k => delete data[k]);
          Object.assign(data, saved);
          data.activeMemberId = active;
          data.members.forEach(registerMember);
        }
      } catch (_) {}
    },
    storageKey: STORAGE_KEY
  };
})();
