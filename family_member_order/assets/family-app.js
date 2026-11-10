'use strict';
/* The parent shell reuses the original rendering and booking model. */
(() => {
  if (!window.Family) return;
  const F = window.Family, tx = F.t;
  const originalGo = go;
  const originalAllowStep = allowStep;
  const originalPersist = persist;
  const rootMain = document.getElementById('main');
  let pendingForm = null;
  const titles = {
    connections: ['家庭互聯', 'Family connections'], booking: ['行李代填', 'Prepare family luggage'],
    journey: ['行程概覽', 'Journey overview'], benefits: ['家庭權益', 'Family benefits'],
    invitation: ['家庭邀請', 'Family invitation'], authorization: ['行李進度分享', 'Luggage progress sharing'], assistant: ['AI 出行助手', 'AI travel assistant']
  };
  paths.familyLink = 'M6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 9c0 4 8-2 8 2';
  paths.lock = 'M5 9h10v9H5ZM7 9V6a3 3 0 0 1 6 0v3M10 12v3';
  paths.mail = 'M2 4h16v12H2ZM2 4l8 7 8-7';
  paths.close = 'm5 5 10 10M15 5 5 15';

  href = (target, step) => F.href(target, step);
  go = (target, step) => {
    if (state.processing) { toast('e.processing'); return; }
    if (target === 'journey') {
      F.data.journeyMemberId = F.data.activeMemberId;
      if(F.view==='booking' && state.step===5 && activeOrder()) F.data.lastBookingConfirmation={memberId:F.data.activeMemberId,orderId:activeOrder().id};
      F.save();
    }
    originalGo(target, target === 'book' ? Math.max(2, step || 2) : step);
  };
  allowStep = next => window.FamilyBooking ? FamilyBooking.allowStep(next, F) : originalAllowStep(next);
  persist = () => {
    if (state.familyProfiles?.[state.travellerId]) {
      const keys = ['flight', 'region', 'pickup', 'pickupAddress', 'destinationAddress', 'contact', 'phone', 'recipient', 'recipientPhone', 'partner', 'pickupPartner', 'routeLink', 'transport', 'agent'];
      keys.forEach(k => { if (state[k] !== undefined) state.familyProfiles[state.travellerId][k] = clone(state[k]); });
    }
    originalPersist();
  };

  function pageHead(title, subtitle, badge = '') {
    return `<div class="pagehead family-head"><div><div class="eyebrow page-identity">${productMark()}<span>PLUME LIGHT / FAMILY</span></div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${badge ? `<span class="pill">${esc(badge)}</span>` : ''}</div>`;
  }
  function drawHeader() {
    // Same markup, class names, asset, typography and spacing as renderHeader().
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
    document.body.classList.toggle('large', state.large);
    const active = F.view;
    document.title = 'Plume Light · ' + tx(...titles[active]);
    document.getElementById('siteHeader').innerHTML = `<a class="skip" href="#main">${T('skip')}</a><div class="topline"><span>${T('brand.line')}</span><span>${esc(productName())}</span></div><header class="site-header"><div class="nav"><a class="brand${language === 'zh-Hant' ? ' brand-with-tagline' : ''}" href="${F.href('connections')}">${productLogo()}${language === 'zh-Hant' ? '<span class="brand-tagline">泰易送，翼隨行</span>' : ''}</a><nav class="main-nav" aria-label="${T('nav.main')}">${[['connections','家庭互聯','Family connections'],['booking','行李代填','Prepare luggage'],['journey','行程概覽','Journey overview'],['benefits','家庭權益','Family benefits']].map(([v,zh,en]) => `<a class="tab" href="${F.href(v)}" ${active === v ? 'aria-current="page"' : ''}>${esc(tx(zh,en))}</a>`).join('')}</nav><div class="header-tools"><label class="language-control">${icon('globe')}<span class="sr-only">${T('nav.language')}</span><select id="languageSelect" aria-label="${T('nav.language')}" data-language>${['zh-Hant','en'].map((l,i) => option(l,['繁體中文','English'][i],language)).join('')}</select></label><button class="fontbtn" data-action="font" aria-label="${T('nav.font')}" aria-pressed="${state.large}">Aa</button></div></div></header>`;
    const member = F.currentMember();
    const canShowTrip = F.hasTrip(member) && member.status === 'linked' && (active === 'booking' || active === 'assistant' || active === 'journey' && member.trackingGranted);
    const tripbar = document.getElementById('tripbar');
    tripbar.hidden = !canShowTrip;
    if (canShowTrip) {
      const flight = activeOrder()?.flight || state.flight;
      const departure = new Date(flight.departure), arrival = new Date(departure.getTime() + 14.5 * 3600000);
      const date = (d,tz) => new Intl.DateTimeFormat(language === 'zh-Hant' ? 'zh-HK' : 'en',{ timeZone:tz, year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).format(d);
      tripbar.innerHTML = `<div class="flight-main"><div class="flight-end"><div class="flight-location">${T('banner.hk')}<span class="flight-number"> · ${esc(flight.flightNo)}</span></div><div class="flight-date">${esc(date(departure,'Asia/Hong_Kong'))}</div><div class="flight-date-label">${T('banner.departure')}</div></div><div class="flight-center"><div class="flight-person"><strong>${esc(member.name)}</strong><span class="separator">·</span>${T('banner.cabin')}<span class="separator">·</span>${T(member.id === 'child' ? 'banner.child' : 'banner.adult')}</div><div class="flight-track"><span class="flight-plane">${icon('plane')}</span></div><div class="flight-progress">${esc(tx(active === 'journey' ? '已獲成員授權查看' : '正在為家庭成員準備行李',active === 'journey' ? 'Shared with permission' : 'Preparing for a family member'))}</div></div><div class="flight-end"><div class="flight-location">${T('banner.london')}</div><div class="flight-date">${esc(date(arrival,'Europe/London'))}</div><div class="flight-date-label">${T('banner.arrival')}</div></div></div>`;
    } else tripbar.innerHTML = '';
    document.getElementById('siteFooter').innerHTML = `<a class="footer-brand" href="${F.href('connections')}" aria-label="${esc(productName())}">${productLogo()}</a><div class="footer-copy"><p>${T('footer.line')}</p><p>${T('footer.demo')} · ${esc(tx('家庭服務','Family services'))}</p></div><div class="privacy-statement"><strong>${T('privacy.title')}</strong><p>${T('privacy.text')}</p></div>`;
  }

  function memberCard(member) {
    const granted = member.trackingGranted;
    return `<article class="card family-member"><div class="family-member-top"><div class="family-avatar" aria-hidden="true">${esc(member.firstName.charAt(0) + member.lastName.charAt(0))}</div><div><h3>${esc(member.name)}</h3><p>${esc(tx('關係：','Relationship: '))}${esc(F.relation(member.relationship))} · ${esc(F.mask(member.memberNo || member.email || member.phone))}</p></div><span class="pill">${icon('check')}${esc(tx('已建立','Connected'))}</span></div><div class="member-permissions"><span>${icon('check')}${esc(tx('可以協助填寫行李','Luggage assistance available'))}</span><span>${icon(granted ? 'check' : 'lock')}${esc(granted ? tx('已授權查看進度','Progress sharing enabled') : member.trackingRequested ? tx('等待進度分享授權','Sharing permission requested') : tx('進度分享未授權','Progress sharing not enabled'))}</span></div><div class="actions"><a class="btn light" href="${F.href('book',2)}?member=${encodeURIComponent(member.id)}">${esc(tx('代填行李','Prepare luggage'))}${icon('arrow')}</a>${granted ? `<a class="textbtn" href="${F.href('journey')}?member=${encodeURIComponent(member.id)}">${esc(tx('查看行李進度','View luggage progress'))}${icon('arrow')}</a>` : `<button class="textbtn" data-family-action="request-tracking" data-id="${esc(member.id)}">${esc(member.trackingRequested ? tx('查看授權請求','View sharing request') : tx('請求查看授權','Request progress sharing'))}${icon('arrow')}</button>`}</div></article>`;
  }
  function identityField() {
    const form = F.data.form, method = form.method;
    const types = { memberNo: 'text', phone: 'tel', email: 'email' };
    const hints = { memberNo: tx('請填寫對方的國泰會籍號碼。','Enter the family member’s Cathay membership number.'), phone: tx('須為對方會員賬戶已登記的手提電話號碼，請包含國際區號。','Use the mobile number registered to their membership, including country code.'), email: tx('須為對方會員賬戶已登記的電郵地址。','Use the email address registered to their membership.') };
    return `<label class="field" for="familyIdentifier"><span>${esc(F.methodLabel(method))}<span class="family-field-required" aria-hidden="true">*</span></span><input class="input" id="familyIdentifier" name="identifier" type="${types[method]}" inputmode="${method === 'memberNo' ? 'numeric' : method === 'phone' ? 'tel' : 'email'}" required maxlength="120" value="${esc(form[method])}" data-family-field="${method}" aria-describedby="identifierHint" autocomplete="off"><small class="family-field-hint" id="identifierHint">${esc(hints[method])}</small></label>`;
  }
  function pendingInvites() {
    const rows = F.data.invites.filter(i => i.status === 'pending');
    if (!rows.length) return '';
    return `<section class="family-section" aria-labelledby="pendingTitle"><div class="family-section-heading"><div><h2 id="pendingTitle">${esc(tx('等待回覆的邀請','Invitations awaiting a response'))}</h2><p>${esc(tx('成員接受邀請後，家庭關係才會建立。','The connection is established only after your family member accepts.'))}</p></div><span class="pill gold">${rows.length} ${esc(tx('個待接受','pending'))}</span></div><div class="family-pending-list">${rows.map(i => `<article class="family-pending"><span class="family-avatar">${icon('mail')}</span><div><h3>${esc(i.firstName+' '+i.lastName)} <span class="pill gold">${esc(tx('待接受','Pending'))}</span></h3><p>${esc(F.methodLabel(i.method))} · ${esc(F.mask(i.identifier))} · ${esc(F.relation(i.relationship))}</p><p>${esc(tx('示範邀請已建立，尚未寄出真實電郵。','Demo invitation created. No email has been sent.'))}</p></div><div class="actions"><a class="textbtn" href="${F.invitationUrl(i)}">${esc(tx('預覽邀請內容','Preview invitation'))}${icon('arrow')}</a><button class="textbtn" data-family-action="cancel-invite" data-id="${esc(i.id)}">${esc(tx('取消邀請','Cancel invitation'))}</button></div></article>`).join('')}</div></section>`;
  }
  function connectionsHTML() {
    const form = F.data.form;
    const connected = F.data.members.filter(m => m.status === 'linked');
    return `${pageHead(tx('家庭互聯','Family connections'),tx('與家人連結會員賬戶，一起準備下一段旅程。家庭關係與行李進度分享，由成員分別確認。','Connect your membership accounts and prepare for the next journey together. Family connections and luggage sharing are confirmed separately.'))}<section aria-labelledby="familyMembersTitle"><div class="family-section-heading"><div><h2 id="familyMembersTitle">${esc(tx('已互聯的家庭成員','Your connected family'))}</h2></div><span class="pill">${connected.length} ${esc(tx('位成員','members'))}</span></div><div class="family-overview">${connected.map(memberCard).join('')}</div></section>${pendingInvites()}<section class="family-section" aria-labelledby="connectTitle"><div class="family-section-heading"><div><h2 id="connectTitle">${esc(tx('邀請家庭成員','Invite a family member'))}</h2><p>${esc(tx('輸入對方會員資料，邀請會送往其賬戶登記的電郵地址。','Enter their membership details. The invitation is intended for the email registered to their account.'))}</p></div></div><div class="card family-connect-card"><div class="family-form-steps" aria-label="${esc(tx('邀請步驟','Invitation steps'))}"><div class="family-form-step active"><b>1</b>${esc(tx('填寫成員資料','Member details'))}</div><div class="family-form-step"><b>2</b>${esc(tx('確認並發送邀請','Confirm and invite'))}</div></div><form id="familyInviteForm"><fieldset class="family-fieldset" style="margin-top:0"><legend>${esc(tx('使用以下其中一項尋找家庭成員','Find your family member using one of the following'))}</legend><div class="family-choice-grid">${[['memberNo','miles'],['phone','person'],['email','mail']].map(([method,ic]) => `<label class="family-choice"><input type="radio" name="method" value="${method}" data-family-method ${form.method === method ? 'checked' : ''}><span>${esc(F.methodLabel(method))}</span>${icon(ic)}</label>`).join('')}</div></fieldset><div class="family-input-panel" id="familyIdentityField">${identityField()}</div><div class="fields"><label class="field" for="familyLastName"><span>${esc(tx('成員姓氏','Family name / surname'))}<span class="family-field-required" aria-hidden="true">*</span></span><input class="input" id="familyLastName" name="lastName" value="${esc(form.lastName)}" data-family-field="lastName" required maxlength="60" autocomplete="off"><small class="family-field-hint">${esc(tx('請按會員賬戶填寫。','As shown in their membership account.'))}</small></label><label class="field" for="familyFirstName"><span>${esc(tx('成員名字','Given name'))}<span class="family-field-required" aria-hidden="true">*</span></span><input class="input" id="familyFirstName" name="firstName" value="${esc(form.firstName)}" data-family-field="firstName" required maxlength="60" autocomplete="off"><small class="family-field-hint">${esc(tx('請按會員賬戶填寫。','As shown in their membership account.'))}</small></label></div><fieldset class="family-fieldset"><legend>${esc(tx('你與這位成員的關係','Your relationship to this family member'))}</legend><div class="family-choice-grid">${['parent','guardian','other'].map(relation => `<label class="family-choice"><input type="radio" name="relationship" value="${relation}" data-family-field="relationship" ${form.relationship === relation ? 'checked' : ''}><span>${esc(tx('我是其','I am their '))}${esc(F.relation(relation))}</span></label>`).join('')}</div></fieldset><div class="family-form-notice">${icon('familyLink')}<div>${esc(tx('關係建立後，你可以協助填寫行李資料。查看服務進度仍需對方另行授權。','Once connected, you can help prepare their luggage. Viewing service progress requires their separate permission.'))}</div></div><div id="familyFormError" class="family-form-error" role="alert" hidden></div><div class="family-formfooter"><p>${esc(tx('請確認資料與會員賬戶一致。家庭關係建立後，如需更改須經人工審核。','Please match their membership details. Changes to an established relationship require manual review.'))}</p><button type="submit" class="btn">${esc(tx('確認資料','Review details'))}${icon('arrow')}</button></div><p class="family-demo-note">${esc(tx('概念演示：已預填虛構會員資料。邀請僅在此瀏覽器示範，不會查詢真實會員賬戶或寄出電郵。','Concept demo with fictional prefilled members. Invitations are demonstrated in this browser; no live account lookup or email delivery takes place.'))}</p></form></div></section><div class="family-info-band">${icon('miles')}<p><strong>${esc(tx('把每次搬運，連成家庭的里程碑。','Turn every move into a family milestone.'))}</strong><br>${esc(tx('了解家庭同行優惠碼及不同會籍的擬議權益。','Explore proposed companion promo codes and membership benefits.'))}</p><a class="textbtn" href="${F.href('benefits')}">${esc(tx('查看家庭權益','Explore family benefits'))}${icon('arrow')}</a></div>`;
  }
  function memberSelector() {
    const members = F.data.members.filter(m => m.status === 'linked');
    const current = F.currentMember();
    return `<div class="family-selector"><label class="field" for="familyMemberSelect"><span>${esc(tx('選擇家庭成員','Choose a family member'))}</span><select class="input" id="familyMemberSelect" data-family-member>${members.map(m => `<option value="${esc(m.id)}" ${m.id === current?.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label><div class="family-selector-info">${esc(tx('關係已建立','Family connection established'))}<span class="pill ${current?.trackingGranted ? '' : 'gold'}">${esc(current?.trackingGranted ? tx('進度分享已授權','Progress sharing enabled') : tx('進度分享未授權','Progress sharing not enabled'))}</span></div>${current?.demoTrip ? `<p class="family-demo-note" style="flex-basis:100%;margin:0">${esc(tx('此成員已預填獨立演示機票與行李，方便體驗代填流程；並非從真實會員賬戶匯入。','This member has a separate sample ticket and luggage for the demonstration. No real membership data has been imported.'))}</p>` : ''}</div>`;
  }
  function reviewRows(invite) {
    return `<div class="family-review-rows"><div class="family-review-row"><span>${esc(tx('家庭成員','Family member'))}</span><strong>${esc(invite.firstName+' '+invite.lastName)}</strong></div><div class="family-review-row"><span>${esc(F.methodLabel(invite.method))}</span><strong>${esc(invite.identifier)}</strong></div><div class="family-review-row"><span>${esc(tx('你的關係','Your relationship'))}</span><strong>${esc(F.relation(invite.relationship))}</strong></div></div>`;
  }
  function showDialog(title, body, actions) {
    document.getElementById('dialogTitle').textContent = title;
    document.getElementById('dialogBody').innerHTML = body;
    document.getElementById('dialogActions').innerHTML = actions;
    const dialog = document.getElementById('dialog');
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('button')?.focus();
  }
  const closeButton = label => `<button class="btn light" data-action="close-dialog">${esc(label || tx('返回修改','Back to edit'))}</button>`;
  function validateInvite() {
    const form = F.data.form;
    const value = String(form[form.method] || '').trim();
    if (!form.firstName.trim() || !form.lastName.trim()) return tx('請填寫成員的姓氏和名字。','Enter both the family name and given name.');
    if (form.method === 'memberNo' && !/^\d{8,12}$/.test(value.replace(/\s/g,''))) return tx('請填寫 8–12 位數字會籍號碼（演示格式）。','Enter 8–12 digits for the demo membership number.');
    if (form.method === 'phone' && (!/^\+[\d\s()-]{8,24}$/.test(value) || value.replace(/\D/g,'').length < 8)) return tx('請填寫有效手提電話號碼，以 + 及國際區號開始。','Enter a valid mobile number starting with + and country code.');
    if (form.method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return tx('請填寫有效電郵地址。','Enter a valid email address.');
    const normal = F.normalize(form.method,value);
    if (F.data.members.some(m => m.status === 'linked' && F.normalize(form.method,m[form.method] || '') === normal)) return tx('這位家庭成員已與你互聯。','This family member is already connected.');
    if (F.data.invites.some(i => i.status === 'pending' && i.method === form.method && F.normalize(i.method,i.identifier) === normal)) return tx('已有邀請等待這位成員接受。你可以在上方預覽或取消邀請。','An invitation is already awaiting this member. Preview or cancel it above.');
    if (!['parent','guardian','other'].includes(form.relationship)) return tx('請選擇你與成員的關係。','Select your relationship.');
    return null;
  }
  function confirmInvite() {
    const problem = validateInvite();
    const error = document.getElementById('familyFormError');
    if (problem) { error.hidden=false; error.textContent=problem; error.scrollIntoView({block:'nearest',behavior:'smooth'}); return; }
    error.hidden = true;
    const form = F.data.form;
    pendingForm = { method:form.method,identifier:form[form.method].trim(),lastName:form.lastName.trim(),firstName:form.firstName.trim(),relationship:form.relationship };
    showDialog(tx('確認家庭關係','Confirm family relationship'), `<div class="family-confirm-content"><p>${esc(tx('請核對以下資料，再發送邀請。','Please review these details before creating the invitation.'))}</p>${reviewRows(pendingForm)}<div class="notice">${esc(tx('該家庭關係一旦建立，如需更改，須經人工審核。','Once established, any change to this family relationship requires manual review.'))}</div><p>${esc(tx('邀請將送往對方會員賬戶登記的電郵地址。只有對方接受後，關係才會顯示為「已建立」。','The invitation is intended for the email registered to their membership account. The connection will be established only after they accept.'))}</p><p class="family-demo-note">${esc(tx('目前為本機流程演示，不會寄出真實電郵。','This is a local demonstration. No email will be sent.'))}</p></div>`, `${closeButton()}<button class="btn" data-family-action="send-invite">${esc(tx('確認並發送邀請','Confirm and send invitation'))}${icon('arrow')}</button>`);
  }
  function sendInvite() {
    if (!pendingForm || validateInvite()) return;
    const invite = { ...pendingForm,id:F.id(),token:F.id(),status:'pending',createdAt:new Date().toISOString() };
    F.data.invites.push(invite);
    F.save(); pendingForm = null; closeModal(); render();
    document.getElementById('pendingTitle')?.scrollIntoView({block:'center',behavior:'smooth'});
    F.toast(tx('示範邀請已建立，等待對方接受；尚未寄出電郵。','Demo invitation created, awaiting acceptance. No email sent.'));
  }
  function invitationHTML() {
    const token = new URLSearchParams(location.search).get('invite');
    const invite = F.data.invites.find(i => i.token === token);
    if (!invite || invite.status === 'cancelled') return emptyInvitation(tx('邀請連結無效或已取消','Invitation unavailable'), tx('請聯絡邀請你的家庭成員取得新的邀請。示範連結須在同一瀏覽器開啟。','Ask your family member for a new invitation. Demo links work in the same browser.'));
    const accepted = invite.status === 'accepted', rejected = invite.status === 'declined';
    const member = F.data.members.find(m => m.id === invite.memberId);
    return `<article class="card family-invite"><div class="family-mail-heading">${productLogo()}<span class="pill gold">${esc(tx('邀請內容預覽','Invitation preview'))}</span></div><div class="eyebrow muted">FAMILY INVITATION</div><h1 style="margin-top:12px">${esc(accepted ? tx('你們已建立家庭關係','You are now connected') : rejected ? tx('你已婉拒此邀請','Invitation declined') : tx('家人的旅程，一起參與。','Be part of each other’s journey.'))}</h1><p class="mail-intro">${esc(accepted ? tx('家庭互聯已完成。行李進度分享仍由你獨立決定。','Your family connection is established. Progress sharing remains your choice.') : rejected ? tx('此邀請未建立任何家庭關係或分享授權。','No family connection or sharing permission was created.') : `${F.data.parent.name} ${tx('邀請你與她建立家庭關係。','has invited you to connect your family accounts.')}`)}</p><div class="family-review-rows"><div class="family-review-row"><span>${esc(tx('收件成員','Recipient'))}</span><strong>${esc(invite.firstName+' '+invite.lastName)}</strong></div><div class="family-review-row"><span>${esc(tx('邀請人','Invited by'))}</span><strong>${esc(F.data.parent.name)}</strong></div><div class="family-review-row"><span>${esc(tx('邀請人是你的','They are your'))}</span><strong>${esc(F.relation(invite.relationship))}</strong></div><div class="family-review-row"><span>${esc(tx('收件電郵','Delivery address'))}</span><strong>${esc(invite.method === 'email' ? invite.identifier : tx('會員賬戶登記電郵（正式接入後查詢）','Registered account email (resolved by the production service)'))}</strong></div></div>${accepted ? `<div class="notice">${esc(member?.trackingGranted ? tx('你已授權 May Chen 查看行李服務進度。','You have enabled progress sharing with May Chen.') : tx('你尚未授權查看行李服務進度。對方仍可協助填寫行李。','Progress sharing is not enabled. They can still assist with luggage preparation.'))}</div>` : rejected ? '' : `<div class="notice">${esc(tx('接受後，對方可以協助填寫你的行李資料。家庭關係如需更改，須經人工審核。','After acceptance, they may help prepare your luggage. Relationship changes require manual review.'))}</div><div class="family-consent"><label class="check"><input type="checkbox" id="inviteTrackingConsent" ${invite.consentDraft ? 'checked' : ''}><span>${esc(tx('另外授權對方查看我的行李進度（選填）','Also allow them to view my luggage progress (optional)'))}</span></label><p>${esc(tx('不勾選也可以接受家庭邀請。只分享相關服務進度，不開放全部賬戶資料。','You can accept without selecting this. Only relevant service progress is shared, not your full account.'))}</p></div>`}<div class="actions">${!accepted && !rejected ? `<button class="btn" data-family-action="accept-invite" data-id="${esc(invite.id)}">${esc(tx('接受家庭邀請','Accept family invitation'))}${icon('check')}</button><button class="btn light" data-family-action="decline-invite" data-id="${esc(invite.id)}">${esc(tx('婉拒邀請','Decline invitation'))}</button>` : ''}${accepted && member ? `<a class="btn light" href="${F.authorizationUrl(member)}">${esc(tx('管理行李進度分享','Manage luggage progress sharing'))}</a>` : ''}<a class="${accepted || rejected ? 'btn' : 'textbtn'}" href="${F.href('connections')}">${esc(tx('返回家庭互聯','Back to family connections'))}${icon('arrow')}</a></div><p class="family-demo-note">${esc(tx('受邀成員視角示範：本頁未執行會員登入、身份驗證或真實電郵發送。正式服務必須由受邀成員登入確認。','Recipient-view demo. No member sign-in, identity verification or email delivery occurs here. The production service must verify the recipient’s account.'))}</p></article>`;
  }
  function emptyInvitation(title, message) {
    return `<div class="card family-empty"><span class="feature-icon">${icon('lock')}</span><h1 style="font-size:29px">${esc(title)}</h1><p>${esc(message)}</p><a class="btn" href="${F.href('connections')}">${esc(tx('返回家庭互聯','Back to family connections'))}${icon('arrow')}</a></div>`;
  }
  function requestTracking(memberId) {
    const member=F.data.members.find(m=>m.id===memberId && m.status==='linked');
    if(!member) return;
    member.trackingRequested = true;
    member.authorizationToken ||= F.id();
    F.save();
    showDialog(tx('等待成員分享授權','Waiting for sharing permission'),`<div class="family-confirm-content"><p>${esc(member.name)} ${esc(tx('需要在自己的賬戶確認，才會向你開放行李服務進度。關係互聯不會自動開啟分享。','must confirm from their own account before luggage service progress is shared. A family connection does not automatically enable sharing.'))}</p><p class="family-demo-note">${esc(tx('概念演示：請求已保存在此瀏覽器，未寄出電郵；可預覽成員的確認畫面。','Concept demo: the request is stored in this browser; no email is sent. You can preview the member’s confirmation page.'))}</p></div>`,`${closeButton(tx('關閉','Close'))}<a class="btn" href="${F.authorizationUrl(member)}">${esc(tx('預覽成員授權頁','Preview member confirmation'))}${icon('arrow')}</a>`);
  }
  function authorizationHTML() {
    const params=new URLSearchParams(location.search);
    const member=F.data.members.find(m=>m.id===params.get('member') && m.status==='linked' && m.authorizationToken && m.authorizationToken===params.get('token'));
    if(!member) return emptyInvitation(tx('授權連結無效','Sharing request unavailable'),tx('請由家庭互聯頁重新建立授權請求。','Create a sharing request from Family connections.'));
    return `<article class="card family-invite"><div class="family-mail-heading">${productLogo()}<span class="pill gold">${esc(tx('成員確認頁預覽','Member confirmation preview'))}</span></div><div class="eyebrow muted">YOUR SHARING CHOICE</div><h1 style="margin-top:12px">${esc(tx('讓家人安心，由你決定。','Keep family informed. You decide.'))}</h1><p class="mail-intro">${esc(member.name)}，${esc(F.data.parent.name)} ${esc(tx('希望查看你的行李服務進度。','would like to view your luggage service progress.'))}</p><div class="family-review-rows"><div class="family-review-row"><span>${esc(tx('分享對象','Share with'))}</span><strong>${esc(F.data.parent.name)}</strong></div><div class="family-review-row"><span>${esc(tx('分享範圍','Scope'))}</span><strong>${esc(tx('行李服務訂單、取送進度與交接狀態','Luggage service order, delivery progress and handover status'))}</strong></div><div class="family-review-row"><span>${esc(tx('目前設定','Current setting'))}</span><strong>${esc(member.trackingGranted ? tx('已授權分享','Sharing enabled') : tx('尚未授權分享','Sharing disabled'))}</strong></div></div><p class="small muted">${esc(tx('你可以拒絕或隨時關閉進度分享，家庭關係及行李代填不受影響。','You may decline or turn off progress sharing at any time. Your family connection and luggage assistance remain available.'))}</p><div class="actions"><button class="btn" data-family-action="${member.trackingGranted ? 'revoke-tracking' : 'grant-tracking'}" data-id="${esc(member.id)}">${esc(member.trackingGranted ? tx('關閉進度分享','Turn off progress sharing') : tx('同意分享行李進度','Allow luggage progress sharing'))}${icon(member.trackingGranted ? 'lock' : 'check')}</button><a class="btn light" href="${F.href('connections')}">${esc(tx('返回家庭互聯','Back to family connections'))}</a></div><p class="family-demo-note">${esc(tx('目前為受邀成員的確認流程演示。正式服務須登入並由後端驗證成員身份及每次資料存取。','This demonstrates the member’s confirmation flow. A production service must authenticate the member and enforce access on the server.'))}</p></article>`;
  }

  renderHeader = drawHeader;
  render = () => {
    const selected=F.currentMember();
    if(selected?.status==='linked' && F.hasTrip(selected) && state.travellerId!==selected.id && !state.processing) F.selectMember(selected.id,false);
    drawHeader();
    const view = F.view;
    if (view === 'connections') rootMain.innerHTML=connectionsHTML();
    else if (view === 'benefits') { rootMain.innerHTML=FamilyBenefits.render(F); FamilyBenefits.afterRender(F); }
    else if (view === 'invitation') rootMain.innerHTML=invitationHTML();
    else if (view === 'authorization') rootMain.innerHTML=authorizationHTML();
    else if (view === 'booking') {
      rootMain.innerHTML=pageHead(tx('為家人準備行李','Prepare luggage for your family'),tx('家庭關係已建立。由信息預留開始，完成四個步驟，即可安排上門收取及目的地配送。','Your family connection is established. Follow four steps to arrange collection and delivery to the final address.'))+memberSelector()+FamilyBooking.render(F);
      FamilyBooking.afterRender(F);
    } else if (view === 'journey') {
      const receipt=F.data.lastBookingConfirmation?.memberId===F.currentMember()?.id && !F.currentMember()?.trackingGranted ? `<div class="family-form-notice" style="margin:0 0 22px">${icon('check')}<span>${esc(tx('你的模擬預約已確認。查看後續行李進度，仍需成員另行授權。','Your simulated booking is confirmed. Your family member’s separate permission is still needed for progress updates.'))}</span></div>` : '';
      rootMain.innerHTML=pageHead(tx('家人的行程概覽','Your family’s journey'),tx('在成員授權的範圍內，了解行李由出發到送達的服務進度。','View luggage service progress from departure to delivery, with your family member’s permission.'))+receipt+memberSelector()+FamilyBooking.renderJourney(F);
      FamilyBooking.afterRender(F);
    } else if (view === 'assistant') {
      const member=F.currentMember();
      rootMain.innerHTML=member?.status==='linked' && F.hasTrip(member) && state.travellerId===member.id ? agentHTML() : emptyInvitation(tx('先選擇已互聯的家庭成員','Select a connected family member'),tx('請先從行李代填頁選擇成員及行程。','Choose a family member and journey from the luggage preparation page first.'));
    }
    document.getElementById('controls').innerHTML='';
    if(toastKey) document.getElementById('toast').textContent=t(toastKey);
  };

  document.addEventListener('input',event=>{
    const el=event.target;
    if(el.dataset.familyField && !['radio','checkbox'].includes(el.type)) { F.data.form[el.dataset.familyField]=el.value; F.save(); }
  });
  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='inviteTrackingConsent') { const token=new URLSearchParams(location.search).get('invite'); const invitation=F.data.invites.find(i=>i.token===token); if(invitation?.status==='pending') { invitation.consentDraft=el.checked; F.save(); } }
    if(el.hasAttribute('data-family-method')) { F.data.form.method=el.value; F.save(); document.getElementById('familyIdentityField').innerHTML=identityField(); document.getElementById('familyFormError').hidden=true; }
    if(el.dataset.familyField && el.type==='radio') { F.data.form[el.dataset.familyField]=el.value; F.save(); }
    if(el.hasAttribute('data-family-member')) { if(F.selectMember(el.value)) render(); }
  });
  document.addEventListener('submit',event=>{ if(event.target.id==='familyInviteForm') { event.preventDefault(); confirmInvite(); } });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-family-action]');
    if(!button || button.disabled) return;
    const action=button.dataset.familyAction, identifier=button.dataset.id;
    if(action==='send-invite') { button.disabled=true; sendInvite(); }
    if(action==='cancel-invite') {
      const invite=F.data.invites.find(i=>i.id===identifier);
      if(invite?.status==='pending') showDialog(tx('取消家庭邀請？','Cancel family invitation?'),`<p>${esc(tx('取消後，這個邀請連結將無法接受。','Once cancelled, this invitation link can no longer be accepted.'))}</p>`,`${closeButton(tx('保留邀請','Keep invitation'))}<button class="btn" data-family-action="confirm-cancel-invite" data-id="${esc(identifier)}">${esc(tx('確認取消','Cancel invitation'))}</button>`);
    }
    if(action==='confirm-cancel-invite') { const invite=F.data.invites.find(i=>i.id===identifier); if(invite?.status==='pending') invite.status='cancelled'; F.save(); closeModal(); render(); }
    if(['accept-invite','decline-invite'].includes(action)) {
      const invite=F.data.invites.find(i=>i.id===identifier);
      if(!invite || invite.status!=='pending') return;
      if(action==='accept-invite') {
        const granted=!!document.getElementById('inviteTrackingConsent')?.checked;
        const member={ id:'member-'+F.id(),name:invite.firstName+' '+invite.lastName,firstName:invite.firstName,lastName:invite.lastName,relationship:invite.relationship,status:'linked',trackingGranted:granted,trackingRequested:false,authorizationToken:F.id(),linkedAt:new Date().toISOString(),[invite.method]:invite.identifier };
        F.data.members.push(member); F.ensureDemoTrip(member); invite.memberId=member.id; invite.status='accepted';
      } else { invite.status='declined'; invite.consentDraft=false; }
      invite.respondedAt=new Date().toISOString(); F.save(); render(); window.scrollTo({top:0,behavior:'smooth'});
    }
    if(action==='request-tracking') requestTracking(identifier || F.currentMember()?.id);
    if(['grant-tracking','revoke-tracking'].includes(action)) {
      const member=F.data.members.find(m=>m.id===identifier);
      const params=new URLSearchParams(location.search);
      if(F.view!=='authorization' || !member || !member.authorizationToken || member.authorizationToken!==params.get('token')) return;
      member.trackingGranted=action==='grant-tracking'; member.trackingRequested=false; F.save(); render();
      F.toast(member.trackingGranted ? tx('行李進度分享已開啟。','Progress sharing enabled.') : tx('行李進度分享已關閉。','Progress sharing disabled.'));
    }
  });
  window.addEventListener('storage',event=>{ if(event.key===F.storageKey) { F.reload(); render(); } });
  window.addEventListener('pageshow',event=>{ if(event.persisted) { F.reload(); render(); } });
  FamilyBooking.seed(F);
  F.initialize();
  persist(); render();
})();
