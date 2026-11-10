/* Parent-facing adapter. The four booking screens and journey cards remain the
 * original Plume Light implementation; relationship/consent live in Family. */
'use strict';
(function () {
  const originalScreens = {2: informationHTML, 3: baggageHTML, 4: pricingHTML, 5: checkoutHTML};
  const originalJourney = journeyHTML;

  const tx = (F, zh, en) => F.esc(F.t(zh, en));
  const linked = member => member && member.status === 'linked';
  const ownTraveller = (member, F) => linked(member) && state.travellerId === member.id && F.hasTrip(member);
  const memberHref = (F, view, member, step) => {
    const url = F.href(view, step);
    return url + (url.includes('?') ? '&' : '?') + 'member=' + encodeURIComponent(member.id);
  };

  function emptyCard(F, titleZh, titleEn, bodyZh, bodyEn, action) {
    return `<section class="card family-booking-empty"><span class="family-booking-symbol">${F.icon('bag')}</span><h2>${tx(F, titleZh, titleEn)}</h2><p>${tx(F, bodyZh, bodyEn)}</p>${action || ''}</section>`;
  }

  function connectionsLink(F) {
    return `<a class="btn light" href="${F.esc(F.href('connections'))}">${tx(F, '前往家庭互聯', 'Manage family connections')}${F.icon('arrow')}</a>`;
  }

  function bookingGuard(F) {
    const member = F.currentMember();
    if (!linked(member)) return emptyCard(F,
      '先建立家庭關係', 'Connect with your family first',
      '對方接受家庭互聯邀請後，你便可以協助填寫行李資料及安排取送服務。',
      'Once your family member accepts the connection invitation, you can help prepare their luggage details and arrange collection and delivery.',
      connectionsLink(F));
    if (!ownTraveller(member, F)) return emptyCard(F,
      '尚未有可代填的行程', 'No journey available to prepare yet',
      '家庭關係已建立。待此成員的機票及行程連結至帳戶後，即可開始代填行李資料。',
      'Your family connection is established. You can prepare luggage once this member’s ticket and journey have been linked to their account.',
      connectionsLink(F));
    return '';
  }

  function renderBooking(F) {
    const guard = bookingGuard(F);
    if (guard) return guard;
    const member = F.currentMember();
    const step = [2, 3, 4, 5].includes(Number(state.step)) ? Number(state.step) : 2;
    const order = activeOrder();
    if (order) return emptyCard(F,
      '這段旅程已安排服務', 'This journey is already booked',
      '已確認訂單會保留結算時的資料。若需要更改行李或取送安排，請聯絡服務方；獲授權後可查看行李進度。',
      'Your confirmed order retains the details agreed at checkout. Contact the service team for changes to luggage or collection and delivery; journey updates are available with the traveller’s permission.',
      `<div class="actions"><a class="btn" href="${F.esc(memberHref(F, 'journey', member))}">${tx(F, '查看行程概覽', 'View journey overview')}${F.icon('arrow')}</a><button class="btn light" data-action="contact">${tx(F, '聯絡服務方', 'Contact service team')}</button></div>`);

    const labels = [
      ['信息預留', 'Collection & delivery'],
      ['行李預報', 'Luggage declaration'],
      ['價格計算', 'Price calculation'],
      ['確認結算', 'Confirm & pay']
    ];
    const navigation = labels.map(([zh, en], i) => {
      const value = i + 2;
      return `<a class="step ${value < step ? 'done' : ''}" href="${F.esc(F.href('book', value))}" data-step="${value}" ${value === step ? 'aria-current="step"' : ''}><i>${value < step ? '✓' : i + 1}</i><span>${tx(F, zh, en)}</span></a>`;
    }).join('');
    const back = `<a class="btn light" href="${F.esc(F.href(step === 2 ? 'connections' : 'book', step === 2 ? undefined : step - 1))}">${F.icon('back')}${tx(F, step === 2 ? '返回家庭互聯' : '上一步', step === 2 ? 'Back to family connections' : 'Back')}</a>`;
    let forward = '';
    if (step === 4 && pricingQuote().valid && pricingQuote().count === 0) {
      forward = `<button class="btn" data-action="finish-declaration">${T('pricing.finishWithoutService')}${F.icon('arrow')}</button>`;
    } else if (step < 5) {
      forward = `<button class="btn" data-action="next">${tx(F, step === 3 ? '保存並繼續' : '繼續', step === 3 ? 'Save & continue' : 'Continue')}${F.icon('arrow')}</button>`;
    }
    return `<div class="booking-workspace family-booking-workspace reveal ${step === 4 ? 'pricing-workspace' : ''}"><div class="card"><div class="family-booking-context"><span>${F.icon('person')}${tx(F, '正在代填', 'Preparing for')} <strong>${F.esc(member.name)}</strong></span><span class="pill">${F.icon('check')}${tx(F, '關係已建立', 'Connected')}</span></div><nav class="steps" aria-label="${tx(F, '行李代填步驟', 'Luggage preparation steps')}">${navigation}</nav>${originalScreens[step]()}<div class="formfooter">${back}${forward}</div></div></div>`;
  }

  function renderJourney(F) {
    const member = F.currentMember();
    if (!linked(member)) return emptyCard(F,
      '先建立家庭關係', 'Connect with your family first',
      '家庭互聯邀請獲接受後，成員可另外授權你查看行李進度。',
      'After accepting the family invitation, your family member can separately allow you to view luggage updates.',
      connectionsLink(F));

    // Check consent BEFORE invoking the original journey renderer. This prevents
    // hidden or CSS-obscured shipment details from entering the document.
    if (!member.trackingGranted) return emptyCard(F,
      '等待成員授權查看行李進度', 'Permission is needed to view luggage updates',
      '家庭關係已建立。查看行李進度需要成員另外同意；代填或付款不會自動開啟這項權限。',
      'Your family connection is established. Viewing luggage updates needs the member’s separate consent; preparing or paying for luggage does not grant it automatically.',
      `<div class="actions"><button class="btn" data-family-action="request-tracking" data-id="${F.esc(member.id)}">${tx(F, '請求查看授權', 'Request permission')}${F.icon('arrow')}</button>${connectionsLink(F)}</div>`);

    if (!ownTraveller(member, F)) return emptyCard(F,
      '尚未有已連結的行程', 'No linked journey yet',
      '成員已授權查看行李進度。待有行程及服務訂單後，相關交接進度便會在這裡顯示。',
      'Your family member has granted permission. Luggage handover updates will appear here once a journey and service order are available.',
      connectionsLink(F));

    const order = activeOrder();
    if (!order) return emptyCard(F,
      '服務尚未開始', 'Your service has not started yet',
      '目前未有已確認的取送訂單。你可以先代填行李資料，完成結算後再查看服務安排與交接進度。',
      'There is no confirmed collection and delivery order yet. Prepare the luggage details and complete checkout to view service arrangements and handover updates.',
      `<a class="btn" href="${F.esc(memberHref(F, 'book', member, 2))}">${tx(F, '開始行李代填', 'Prepare luggage')}${F.icon('arrow')}</a>`);

    const template = document.createElement('template');
    template.innerHTML = originalJourney();
    template.content.querySelectorAll('.pagehead, .controlbar, [data-action="cancel-order"], [data-action="confirm-cancel"], [data-action="event"], [data-action="complete-service"]').forEach(node => node.remove());
    const note = template.content.querySelector('.note');
    if (note) note.textContent = F.t(
      '行李進度由交接方更新。家長可在成員授權範圍內查看；如需更改已確認訂單，請聯絡服務方。',
      'Luggage updates are recorded by the handover partners and shared within the member’s permission. Contact the service team to change a confirmed order.');
    return `<div class="family-journey-consent"><span class="pill">${F.icon('check')}${tx(F, '成員已授權查看', 'Shared with permission')}</span><span>${tx(F, '交接進度由服務方更新', 'Updates are recorded by the service team')}</span></div>${template.innerHTML}`;
  }

  function allowNext(next, F) {
    const member = F.currentMember();
    if (!ownTraveller(member, F)) {
      F.toast(F.t('請先選擇已建立關係及已有行程的家庭成員。', 'Select a connected family member with an available journey first.'));
      return false;
    }
    if (state.processing) { toast('e.processing'); return false; }
    if (!Number.isInteger(next) || next < 2 || next > 5) return false;
    if (next <= state.step) return true;
    // Validate all prerequisites, including when a numbered step is clicked.
    // The original handler validates only the page being left.
    if (next >= 3) {
      const error = validateInformation();
      if (error) { toast(error); return false; }
    }
    if (next >= 4) {
      const error = validateDeclaration(draft());
      if (error) { toast(error); return false; }
      preparePricingBoard();
      if (!saveDeclaration(true)) return false;
    }
    if (next === 5) {
      const quote = pricingQuote();
      const error = !quote.valid ? quote.error : quote.count === 0 ? 'e.serviceBags' : validateService();
      if (error) { toast(error); return false; }
      if (!saveDeclaration(true)) return false;
    }
    return true;
  }

  function seed(F) {
    if (state.familyBookingSeed === 1) return;
    if (!state.drafts?.child || !Array.isArray(state.orders)) return;
    // A separate, already paid example makes tracking available without locking
    // Lin's new booking. The original Lin draft, tariffs and allowance stay intact.
    if (!state.orders.some(order => order.travellerId === 'child')) {
      const saved = Object.fromEntries(['travellerId', 'profile', 'contact', 'recipient', 'recipientPhone', 'pickup', 'destinationAddress', 'flight', 'transport', 'family'].map(key => [key, clone(state[key])]));
      state.travellerId = 'child';
      state.profile = 'child';
      state.contact = F.data.parent?.name || 'May Chen';
      state.recipient = 'Alex Chen';
      state.recipientPhone = '+44 7700 900123';
      state.pickup = '2026-11-08T09:00';
      state.destinationAddress = 'Family home, Richmond, London';
      state.flight = {...clone(saved.flight), legId: 'CX257-20261110', departure: '2026-11-10T09:30:00+08:00'};
      state.family = false;
      state.transport = 'flight';
      const quote = quoteService();
      if (quote.valid) {
        const declaration = clone(draft());
        state.declarations.child = {...declaration, version: 1, legId: state.flight.legId, status: 'submitted', updatedAt: '2026-11-06T09:00:00+08:00'};
        const order = {
          id: 'PL-FAMILY-DEMO-002', travellerId: 'child', declaration,
          flight: clone(state.flight), quote: clone(quote), payment: 'cash',
          extraPieces: quote.plan.purchased, allowance: clone(quote.plan.allowance),
          contact: state.contact, phone: state.phone, pickup: state.pickup,
          pickupAddress: state.pickupAddress, destination: state.destinationAddress,
          recipient: state.recipient, partner: state.partner, pickupPartner: state.pickupPartner,
          recipientPhone: state.recipientPhone, transport: 'flight', region: state.region,
          itemIds: checked(draft()).filter(item => item.service).map(item => item.id),
          status: 'paid_demo', earned: false, refunded: false, createdAt: '2026-11-06T09:30:00+08:00'
        };
        state.orders.push(order);
        for (const [type, time] of [['airport', '06:00'], ['loaded', '08:00']]) {
          state.events.push({eventId: `${order.id}:${type}:${order.itemIds.join(',')}`, orderId: order.id, type, itemIds: clone(order.itemIds), legId: order.flight.legId, confirmedAt: `2026-11-10T${time}:00+08:00`});
        }
      }
      Object.assign(state, saved);
    }
    state.familyBookingSeed = 1;
    persist();
  }

  function afterRender(F) {
    // The static parent prototype does not invent a carrier tracking number.
    // The original renderer creates this slot only once every bag is handed over.
    const slot = document.getElementById('handoverTracking');
    if (slot && linked(F.currentMember()) && F.currentMember().trackingGranted) {
      slot.textContent = F.t('承運商提供查件連結後，會在這裡顯示。', 'The tracking link will appear here when supplied by the carrier.');
    }
  }

  window.FamilyBooking = {render: renderBooking, renderJourney, afterRender, seed, allowStep: allowNext};
})();
