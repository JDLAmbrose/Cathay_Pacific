import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  initial,
  restoreBooking,
} from "../engine/booking";
import {
  calculateFamilyMilestones,
  resolveFamilyMilestones,
  type FamilyMilestoneRecord,
} from "../services/familyMilestones";
import { LOCALES, setLanguage, t } from "../services/i18n";
import { applyRoute } from "../services/navigation";
import type { Order } from "../types/domain";
import { FamilyMilestonesCard } from "./FamilyMilestones";

beforeEach(() => {
  restoreBooking(initial());
  setLanguage("en");
  applyRoute({ page: "benefits", helper: false });
});

afterEach(() => {
  setLanguage("zh-Hant");
});

const escaped = (value: string) => renderToStaticMarkup(<>{value}</>);

function actualOrder(status = "completed"): Order {
  const seed = initial();
  return {
    id: "PL-ORDER-2042",
    status,
    travellerId: "lin",
    flight: {
      ...structuredClone(seed.flight),
      departure: "2025-08-03T09:30:00+08:00",
      flightNo: "CX999",
    },
    declaration: structuredClone(seed.drafts.lin),
    quote: { valid: true },
    payment: seed.payment,
    extraPieces: 0,
    allowance: null,
    contact: seed.contact,
    phone: seed.phone,
    pickup: seed.pickup,
    pickupAddress: seed.pickupAddress,
    destination: seed.destinationAddress,
    recipient: seed.recipient,
    partner: seed.partner,
    pickupPartner: seed.pickupPartner,
    recipientPhone: seed.recipientPhone,
    transport: seed.transport,
    region: seed.region,
    itemIds: ["bag-1"],
    earned: false,
    refunded: false,
    createdAt: seed.clock,
  };
}

it.each([0, 1, 2, 3, 5])("renders %i completed moves with consistent, capped progress and next-reward copy", (completed) => {
  const count = Math.min(3, completed);
  const records: FamilyMilestoneRecord[] = Array.from({ length: Math.max(3, completed) }, (_, index) => ({
    id: `sample-${index}`,
    eligible: true,
    status: index < completed ? "completed" : "notStarted",
  }));
  const milestones = calculateFamilyMilestones(records, { source: "demo", linked: true });
  const html = renderToStaticMarkup(<FamilyMilestonesCard milestones={milestones} />);
  const arc = html.match(/<path\b[^>]*data-milestone-arc="true"[^>]*>/)?.[0];
  expect(arc).toContain(`stroke-dashoffset="${1 - count / 3}"`);
  expect(html.match(/data-milestone-node="counted"/g) ?? []).toHaveLength(count);
  expect(html.match(/data-milestone-check="true"/g) ?? []).toHaveLength(count);
  const progress = html.match(/<div\b[^>]*role="progressbar"[^>]*>/)?.[0];
  expect(progress).toContain(`aria-valuenow="${count}"`);
  expect(progress).toContain('aria-valuemax="3"');
  expect(html.match(/role="progressbar"/g)).toHaveLength(1);
  expect(html).not.toContain("milestone-meter");
  const state = count === 3 ? "unlocked" : "locked";
  const reward = html.match(new RegExp(`<div\\b[^>]*data-reward-state="${state}"[^>]*>([\\s\\S]*?)</div>`));
  expect(reward).not.toBeNull();
  expect(reward![1]).toContain(`<strong>${escaped(t(`benefit.nextMilestone.${count}.title`))}</strong>`);
  expect(reward![1]).toContain(`<p>${escaped(t(`benefit.nextMilestone.${count}.description`))}</p>`);
  expect(reward![1].match(/<p>/g)).toHaveLength(1);
  expect(reward![1]).not.toContain("<button");
  expect(html).toContain(escaped(t("benefit.rewardConcept")));
});

it("renders all supported languages without unresolved labels or placeholders", () => {
  for (const locale of LOCALES) {
    setLanguage(locale);
    const html = renderToStaticMarkup(<FamilyMilestonesCard />);
    for (const key of [
      "benefit.milestoneHeading",
      "benefit.completedMoves",
      "benefit.milestoneSubtitle",
      "benefit.rewardConcept",
      "benefit.status.counted",
      "benefit.milestonePending",
      "benefit.nextMilestone.1.title",
      "benefit.nextMilestone.1.description",
    ]) {
      expect(html).toContain(escaped(t(key)));
      expect(html).not.toContain(key);
    }
    for (const key of ["benefit.demoMilestones", "benefit.milestonesKicker"])
      expect(html).not.toContain(escaped(t(key)));
    expect(html).not.toContain(`>${escaped(t("benefit.proposed"))}</span>`);
    expect(html).not.toMatch(/\{(?:n|total|date|flight)\}/);
    expect(html.match(/data-milestone-node=/g)).toHaveLength(3);
    expect(html).toContain('aria-valuenow="1"');
  }
});

it("uses order history for progress without displaying flight, month or scenario descriptions", () => {
  const order = actualOrder();
  const milestones = resolveFamilyMilestones({
    linked: true,
    travellerId: "lin",
    orders: [order],
    isDemo: true,
  });
  const html = renderToStaticMarkup(<FamilyMilestonesCard milestones={milestones} />);
  expect(html).toContain('aria-valuenow="1"');
  expect(html).not.toContain("CX999");
  expect(html).not.toContain("August 2025");
  expect(html).not.toContain("CX257");
  expect(html).not.toContain(escaped(t("benefit.demoMilestones")));
  for (const key of ["benefit.moveFirstText", "benefit.move2Text", "benefit.move3Text"])
    expect(html).not.toContain(escaped(t(key)));
  const stages = html.match(/<ol\b[^>]*>[\s\S]*?<\/ol>/)![0];
  expect(stages.match(/<h3>/g)).toHaveLength(3);
  const nodeCopy = stages.match(/<div class="[^"]*milestone-stage-copy[^"]*">[\s\S]*?<\/div>/g)!;
  expect(nodeCopy).toHaveLength(3);
  for (const copy of nodeCopy) expect(copy).not.toContain("<p>");
});

it("keeps a paid, unfinished first order at zero with the first-milestone hint", () => {
  const milestones = resolveFamilyMilestones({ linked: true, travellerId: "lin", orders: [actualOrder("paid_demo")], isDemo: true });
  const html = renderToStaticMarkup(<FamilyMilestonesCard milestones={milestones} />);
  expect(html).toContain('aria-valuenow="0"');
  expect(html).not.toContain('data-milestone-check="true"');
  expect(html).toContain(escaped(t("benefit.nextMilestone.0.description")));
  expect(html).not.toContain(escaped(t("benefit.status.inProgress")));
});
