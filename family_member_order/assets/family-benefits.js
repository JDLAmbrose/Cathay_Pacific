/* Parent experience: family benefits. Shared brand, layout and type come from styles.css. */
'use strict';
(function () {
  let occasion = 'university';

  function visitMember(Family) {
    const members = Family.data.members || [];
    const preferred = Family.data.benefits?.visitMemberId || 'lin';
    return members.find(member => member.id === preferred) || members.find(member => member.id === 'lin') || {name: 'Lin Chen'};
  }

  function latestPaidOrder(Family) {
    const orders = typeof Family.getOrders === 'function' ? Family.getOrders() : [];
    if (!Array.isArray(orders)) return null;
    return orders.filter(order => ['paid_demo', 'completed'].includes(order.status) && !order.refunded)
      .reduce((latest, order) => {
        const date = Date.parse(order.createdAt) || 0;
        return !latest || date >= (Date.parse(latest.createdAt) || 0) ? order : latest;
      }, null);
  }

  function occasionText(Family) {
    const member = visitMember(Family);
    const name = member?.name || 'Lin Chen';
    const copy = {
      university: Family.t(`與 ${name} 一起飛往倫敦迎接入學週，或稍後幾天前往幫忙安頓。`, `Travel to London with ${name} for university, or visit a few days later to help them settle in.`),
      holiday: Family.t(`趁假期前往探望 ${name}，把相聚安排在彼此最期待的日子。`, `Visit ${name} during the holidays and make time for the moments you look forward to together.`),
      graduation: Family.t(`前往 ${name} 的就讀城市，一起慶祝畢業，分享這個重要里程碑。`, `Join ${name} in their university city to celebrate graduation and share an important milestone.`)
    };
    return copy[occasion];
  }

  function render(Family) {
    const { esc, icon } = Family;
    const tx = (zh, en) => esc(Family.t(zh, en));
    const parent = Family.data.parent || {};
    const member = visitMember(Family);
    const name = member?.name || 'Lin Chen';
    const rawCount = Number(Family.data.benefits?.completedCount ?? 1);
    const completed = Number.isFinite(rawCount) ? Math.min(3, Math.max(0, Math.floor(rawCount))) : 1;
    const order = latestPaidOrder(Family);
    const orderName = order ? (Family.memberName?.(order.travellerId) || Family.data.members?.find(member => member.id === order.travellerId)?.name || Family.t('家庭成員', 'Family member')) : '';
    const orderCount = Array.isArray(order?.itemIds) ? order.itemIds.length : 0;
    const orderComplete = order?.status === 'completed';
    const departure = order?.flight?.departure ? new Date(order.flight.departure) : null;
    const orderMonth = departure && Number.isFinite(departure.getTime()) ? new Intl.DateTimeFormat(Family.t('zh-HK', 'en-GB'), {timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long'}).format(departure) : Family.t('已預約行程', 'Booked journey');
    const orderHeading = order ? `${orderMonth}${order.flight?.flightNo ? ' · ' + order.flight.flightNo : ''}` : Family.t('下一次已預約搬運', 'Your next booked move');
    const orderDetail = order ? Family.t(`${orderName} · ${orderCount} 件 · Door-to-door`, `${orderName} · ${orderCount} ${orderCount === 1 ? 'item' : 'items'} · Door-to-door`) : Family.t('尚未有新的已付款訂單', 'No new paid order yet');
    const promoStatus = orderComplete ? Family.t('未發出 · 本次搬運待核對資格', 'Not issued · This move awaits an eligibility check') : order ? Family.t('未發出 · 本次搬運完成後核對資格', 'Not issued · Eligibility checked after this move') : Family.t('未發出 · 待合資格搬運完成', 'Not issued · Awaiting an eligible completed move');
    const tier = parent.tier || 'Silver';
    const proposed = `<span class="benefit-proposed">${tx('擬議', 'Proposed')}</span>`;
    const external = '<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8M8 4H4v13h13v-5"/></svg>';
    const tiers = [
      ['Green', 'green', '綠卡'],
      ['Silver', 'silver', '銀卡'],
      ['Gold', 'gold', '金卡'],
      ['Diamond', 'diamond', '鑽石卡'],
      ['Diamond Exec', 'exec', '鑽石尊尚卡']
    ];
    const benefits = [
      ['家庭總覽追蹤及提示', 'Family tracking and updates', [true, true, true, true, true]],
      ['合資格搬運後的同行優惠碼', 'Companion promo code after an eligible move', [true, true, true, true, true]],
      ['家庭里程碑獎賞', 'Family milestone rewards', [true, true, true, true, true]],
      ['優先收件時段', 'Priority collection windows', [false, false, true, true, true]]
    ];
    const questions = [
      ['我可以看到孩子的哪些資料？', 'What information can I see about my child?', '建立家庭關係後，你可以代填孩子的行李準備資料。孩子另外授權查看行李進度後，你才可以查看相關訂單、行李交接節點及配送進度；家庭互聯不代表開放整個會員賬戶。', 'Once your family connection is established, you can help prepare their luggage declaration. Viewing orders, baggage handover milestones and delivery progress requires their separate tracking permission. A family connection does not give access to their entire membership account.'],
      ['為甚麼需要孩子同意？', 'Why does my child need to consent?', '家庭關係及行李資料的分享由雙方共同確認。孩子接受互聯邀請後，關係才會建立；是否分享行李進度由孩子另行選擇，並可在授權管理中撤回。', 'Both members confirm the family connection. The relationship is established only after your child accepts the invitation. They choose separately whether to share luggage progress and can withdraw that permission.'],
      ['付款後訂單和行李狀態會怎樣變？', 'What happens to the order and luggage status after payment?', '完成結算後，訂單會顯示已預約。服務開始後，行程概覽按交接記錄更新機場到達、裝機及當地物流交接等節點。付款本身不會把行李標為已送達；全部服務行李送達、訂單完成後，才計入合資格搬運次數。', 'After checkout, the order is shown as booked. Once service begins, Journey overview updates airport arrival, loading and local logistics handover from the recorded events. Payment does not mark luggage as delivered. A move counts only after all service luggage has been delivered and the order is completed.'],
      ['行李遇到異常會怎樣？', 'What happens if there is a luggage issue?', '行程概覽會保留最近一次已確認的交接狀態，並提示需要跟進的項目。已獲授權的家長可以查看更新，並從該頁聯絡客服；後續配送安排以服務方確認為準。', 'Journey overview keeps the most recent confirmed handover status and highlights any item needing attention. Authorised parents can see the updates and contact support from that page. The service provider confirms any revised delivery arrangements.'],
      ['已確認的家庭關係可以自行更改嗎？', 'Can I change a confirmed family relationship myself?', '已確認的關係如需更改，必須提交人工審核。更改家庭關係與撤回行李進度授權是不同的操作；撤回查看授權不會自動刪除家庭關係。', 'A confirmed relationship can only be changed after manual review. Changing a family relationship and withdrawing tracking permission are separate actions; withdrawing permission does not automatically remove the family connection.'],
      ['同行優惠碼如何取得和使用？', 'How do companion promo codes work?', '這是擬議家庭權益。孩子完成合資格 Plume Light 搬運後，符合條件的家長將可在本頁及會員電郵收到優惠碼，並於 cathaypacific.com 預訂時輸入。適用航線、使用期限及優惠內容以日後正式公布的條款為準；目前展示的遮罩並非可使用的優惠碼。', 'This is a proposed family benefit. After an eligible Plume Light move is completed, qualifying parents would receive a code on this page and by membership email, then enter it when booking at cathaypacific.com. Eligible routes, validity and the offer are subject to future published terms. The masked placeholder shown here is not a usable promo code.']
    ];

    return `<div class="family-benefits">
      <div class="pagehead">
        <div><div class="eyebrow page-identity">${icon('miles')}<span>PLUME LIGHT / FAMILY BENEFITS</span></div>
          <h1>${tx('家庭權益', 'Family benefits')}</h1>
          <p>${tx('每一次安心抵達，都是家人下一次相聚的開始。查看搬運里程碑、同行優惠及你的會籍權益。', 'Every arrival brings the next family reunion closer. Explore your moving milestones, companion fares and membership benefits.')}</p>
        </div>
        <span class="pill benefit-membership">${icon('miles')} ${esc(tier)} · ${tx('你的會籍', 'Your membership')}</span>
      </div>

      <div class="grid2 benefit-overview">
        <section class="card benefit-milestones" aria-labelledby="familyMilestonesTitle">
          <div class="benefit-card-head"><div><div class="eyebrow">FAMILY MILESTONES</div><h2 id="familyMilestonesTitle">${tx(`3 次合資格行李搬運中已完成 ${completed} 次`, `${completed} of 3 eligible moves completed`)}</h2></div>${proposed}</div>
          <div class="milestone-meter" role="progressbar" aria-label="${tx('合資格行李搬運', 'Eligible moves')}" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${completed}" aria-valuetext="${tx(`已完成 ${completed} 次，共 3 次`, `${completed} of 3 completed`)}">${[1, 2, 3].map(n => `<span class="${n <= completed ? 'filled' : ''}"></span>`).join('')}</div>
          <p class="benefit-body">${tx('完成 3 次 Door-to-door 搬運，即可解鎖擬議家庭獎賞，例如家庭旅程的貴賓室使用券或選位。搬運在全部物品送達、訂單完成後才計算。', 'Complete 3 Door-to-door moves to unlock proposed family rewards, such as lounge access or seat selection for a family trip. A move counts after all items arrive and the order is completed.')}</p>
          <ol class="milestone-list">
            <li><div><strong>${tx('2025年9月 · 香港至倫敦', 'September 2025 · Hong Kong to London')}</strong><p>${tx('Lin Chen · 一年級入學搬運', 'Lin Chen · First-year university move')}</p></div><span class="pill"><span class="benefit-status-dot"></span>${tx('已計算', 'Counted')}</span></li>
            <li><div><strong>${esc(orderHeading)}</strong><p>${esc(orderDetail)}</p>${order ? `<p class="milestone-order-note">${orderComplete ? tx('訂單已完成，合資格次數待核對', 'Order completed; eligibility to be checked') : tx('訂單進行中，尚未計入完成次數', 'Order in progress; not yet counted')}</p>` : ''}</div><span class="pill${orderComplete ? '' : ' benefit-status-muted'}"><span class="benefit-status-dot${orderComplete ? '' : ' open'}"></span>${orderComplete ? tx('已完成', 'Completed') : order ? tx('進行中', 'In progress') : tx('未開始', 'Not started')}</span></li>
            <li><div><strong>${tx('下一次搬運', 'Your next move')}</strong><p>${tx('畢業或租約完結', 'Graduation or end of tenancy')}</p></div><span class="pill benefit-status-muted"><span class="benefit-status-dot open"></span>${tx('未開始', 'Not started')}</span></li>
          </ol>
        </section>

        <section class="card benefit-companion" aria-labelledby="familyCompanionTitle">
          <div class="benefit-card-head"><div><div class="eyebrow">FAMILY COMPANION FARES</div><h2 id="familyCompanionTitle">${tx(`在重要時刻探望 ${name}`, `Be there for ${name}`)}</h2></div>${proposed}</div>
          <div class="fare-tabs" role="group" aria-label="${tx('探望時機', 'Occasion for your visit')}">
            ${[['university', '大學入學', 'University'], ['holiday', '假期', 'Holidays'], ['graduation', '畢業', 'Graduation']].map(([key, zh, en]) => `<button type="button" class="fare-tab" data-fare-occasion="${key}" aria-pressed="${occasion === key}" aria-controls="fareOccasionCopy">${tx(zh, en)}</button>`).join('')}
          </div>
          <p class="benefit-body fare-occasion-copy" id="fareOccasionCopy" aria-live="polite">${esc(occasionText(Family))}</p>
          <div class="benefit-promo" aria-label="${tx('同行優惠碼狀態', 'Companion promo code status')}"><div><span class="eyebrow">PROMO CODE</span><strong>FAMILY-••••-••••</strong></div><span class="benefit-promo-state">${esc(promoStatus)}</span></div>
          <ol class="fare-howto">
            <li><span aria-hidden="true">1</span><p>${tx('孩子完成一次合資格的 Plume Light 搬運。', 'Your child completes an eligible Plume Light move.')}</p></li>
            <li><span aria-hidden="true">2</span><p>${tx('個人優惠碼會在這裡及以會員電郵發出。', 'Your personal promo code appears here and in your membership email.')}</p></li>
            <li><span aria-hidden="true">3</span><p>${tx('在 cathaypacific.com 預訂時，於「優惠碼」欄輸入。', 'Enter it in the promo code field when booking at cathaypacific.com.')}</p></li>
          </ol>
          <p class="benefit-eligibility"><strong>${tx('擬議資格：', 'Proposed eligibility:')}</strong> ${tx('已連接的家庭成員，其孩子已完成合資格 Plume Light 搬運，並乘搭國泰航班前往孩子的就讀城市。', 'Connected family members whose child has completed an eligible Plume Light move, travelling on a Cathay flight to the child’s university city.')}</p>
          <a class="btn benefit-book-flight" href="https://www.cathaypacific.com/" target="_blank" rel="noopener noreferrer">${tx('前往 cathaypacific.com 預訂機票', 'Book flights at cathaypacific.com')}${external}</a>
          <p class="benefit-external-note">${tx('將另開國泰官方預訂網站。Plume Light 不銷售機票。', 'Opens the official Cathay booking website in a new tab. Plume Light does not sell flights.')}</p>
        </section>
      </div>

      <section aria-labelledby="familyTierTitle" class="benefit-tiers">
        <div class="sectiontitle"><div><div class="benefit-heading-line">${proposed}<h2 id="familyTierTitle">${tx('Plume Light 家庭權益', 'Plume Light family benefits')}</h2></div><p>${tx('按照你的國泰會籍等級，了解擬議的家庭禮遇。', 'Explore the proposed family benefits for each Cathay membership tier.')}</p></div></div>
        <div class="benefit-table-scroll" tabindex="0" role="region" aria-label="${tx('五個會籍等級權益比較，可水平捲動', 'Five-tier benefit comparison; scroll horizontally')}" aria-describedby="benefitTierNote">
          <table class="benefit-table"><caption class="sr-only">${tx('Plume Light 家庭權益：五個會員等級比較', 'Plume Light family benefits: comparison across five membership tiers')}</caption>
            <thead><tr><th scope="col">${tx('權益', 'Benefits')}</th>${tiers.map(([name, key, zh]) => `<th scope="col" class="tier-${key}${tier === name ? ' tier-current' : ''}"><span class="tier-name">${esc(name)}</span><span class="tier-subtitle">${name === 'Diamond Exec' ? tx('2027 年起', 'From 2027') : tx(zh, '')}</span>${tier === name ? `<span class="tier-you">${tx('你', 'You')}</span>` : ''}</th>`).join('')}</tr></thead>
            <tbody>${benefits.map(([zh, en, availability]) => `<tr><th scope="row">${tx(zh, en)}</th>${availability.map((yes, i) => `<td class="${tiers[i][0] === tier ? 'tier-current' : ''}">${yes ? `<span class="benefit-table-proposed">${tx('擬議', 'Proposed')}</span>` : `<span class="benefit-unavailable" aria-label="${tx('不包括', 'Not included')}">—</span>`}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
        <p id="benefitTierNote" class="benefit-table-note">${tx('國泰 Hackathon 構思，以上均為擬議家庭權益，並非已確認或已推出的國泰會籍禮遇。Diamond Exec 欄為 2027 年起的等級展示。', 'Cathay Hackathon concept. These are proposed family benefits, not confirmed or launched Cathay membership benefits. Diamond Exec is shown as a tier from 2027.')}</p>
      </section>

      <section class="benefit-faq" aria-labelledby="familyFaqTitle">
        <div class="sectiontitle"><div><div class="eyebrow">FREQUENTLY ASKED QUESTIONS</div><h2 id="familyFaqTitle">${tx('常見問題', 'Frequently asked questions')}</h2><p>${tx('關於家庭互聯、行李授權及家庭權益，你可能想知道的事。', 'A few things to know about family connections, luggage permissions and family benefits.')}</p></div></div>
        <div class="benefit-faq-list">${questions.map(([zh, en, answerZh, answerEn]) => `<details><summary>${tx(zh, en)}<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg></summary><div class="benefit-faq-answer"><p>${tx(answerZh, answerEn)}</p></div></details>`).join('')}</div>
      </section>
    </div>`;
  }

  function afterRender(Family) {
    document.querySelectorAll('.family-benefits [data-fare-occasion]').forEach(button => {
      button.addEventListener('click', () => {
        const next = button.dataset.fareOccasion;
        if (!['university', 'holiday', 'graduation'].includes(next)) return;
        occasion = next;
        document.querySelectorAll('.family-benefits [data-fare-occasion]').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.fareOccasion === occasion)));
        const copy = document.getElementById('fareOccasionCopy');
        if (copy) copy.textContent = occasionText(Family);
      });
    });
  }

  window.FamilyBenefits = { render, afterRender };
})();
