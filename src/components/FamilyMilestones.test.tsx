import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  familyPromoCode,
  initial,
  restoreBooking,
  simulateFamilyLink,
  state,
} from "../engine/booking";
import { BenefitsPage, setFamilyOccasion } from "../pages/family";
import {
  calculateFamilyMilestones,
  getFamilyMilestones,
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
  setFamilyOccasion("enrol");
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

it.each([0, 1, 2, 3])("renders %i/3 consistently across the arc, badges, progress and reward", (completed) => {
  const records: FamilyMilestoneRecord[] = Array.from({ length: 3 }, (_, index) => ({
    id: `sample-${index}`,
    eligible: true,
    status: index < completed ? "completed" : "notStarted",
  }));
  const milestones = calculateFamilyMilestones(records, { source: "demo", linked: true });
  const html = renderToStaticMarkup(<FamilyMilestonesCard milestones={milestones} />);
  const arc = html.match(/<path\b[^>]*data-milestone-arc="true"[^>]*>/)?.[0];
  expect(arc).toContain(`stroke-dashoffset="${1 - completed / 3}"`);
  expect(html.match(/data-milestone-node="counted"/g) ?? []).toHaveLength(completed);
  expect(html.match(/data-milestone-check="true"/g) ?? []).toHaveLength(completed);
  const progress = html.match(/<div\b[^>]*role="progressbar"[^>]*>/)?.[0];
  expect(progress).toContain(`aria-valuenow="${completed}"`);
  expect(progress).toContain('aria-valuemax="3"');
  const state = completed === 3 ? "unlocked" : "locked";
  const reward = html.match(new RegExp(`<div\\b[^>]*data-reward-state="${state}"[^>]*>([\\s\\S]*?)</div>`));
  expect(reward).not.toBeNull();
  expect(reward![0]).toContain(escaped(t(completed === 3 ? "benefit.rewardUnlocked" : "benefit.rewardLocked")));
  expect(reward![1].replace(/<[^>]*>/g, "").trim()).toBe(escaped(t("benefit.familyReward")));
});

it("renders all supported languages without unresolved labels or placeholders", () => {
  for (const locale of LOCALES) {
    setLanguage(locale);
    const html = renderToStaticMarkup(<FamilyMilestonesCard />);
    for (const key of [
      "benefit.milestoneHeading",
      "benefit.completedMoves",
      "benefit.familyReward",
      "benefit.status.counted",
      "benefit.status.notStarted",
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

it("displays the order snapshot itinerary instead of the current trip or sample flight", () => {
  const order = actualOrder();
  const milestones = resolveFamilyMilestones({
    linked: true,
    travellerId: "lin",
    orders: [order],
    isDemo: true,
  });
  const html = renderToStaticMarkup(<FamilyMilestonesCard milestones={milestones} />);
  expect(html).toContain("CX999");
  expect(html).toContain("August 2025");
  expect(html).not.toContain("CX257");
  expect(html).not.toContain(escaped(t("benefit.demoMilestones")));
});

it("keeps companion occasions and actual order qualification independent of sample milestones", () => {
  expect(getFamilyMilestones()).toMatchObject({ completed: 1, source: "demo" });
  expect(familyPromoCode()).toBeNull();
  const companion = () => renderToStaticMarkup(<BenefitsPage />)
    .match(/<article\b[^>]*aria-labelledby="companionTitle"[\s\S]*?<\/article>/)![0];
  for (const occasion of ["enrol", "holiday", "graduation"]) {
    setFamilyOccasion(occasion);
    const html = companion();
    expect(html).toContain(escaped(t("benefit.occasionText." + occasion, {
      name: t("benefit.familyFallback"),
    })));
    expect(html).toContain(`data-occasion="${occasion}" aria-pressed="true"`);
    expect(html).toContain(escaped(t("benefit.promoNeedsLink")));
    expect(html).toContain("FAMILY-••••-••••");
    expect(html).not.toContain(escaped(t("benefit.companionKicker")));
    expect(html).not.toContain(`>${escaped(t("benefit.proposed"))}</span>`);
  }
  simulateFamilyLink(state.familyLink, "lin");
  const order = actualOrder("paid");
  state.orders.push(order);
  expect(familyPromoCode()).toBeNull();
  expect(companion()).toContain(escaped(t("benefit.promoNotIssued")));
  order.status = "completed";
  const code = familyPromoCode();
  expect(code).not.toBeNull();
  expect(companion()).toContain(code!);
  expect(companion()).toContain(escaped(t("benefit.promoIssued")));
});
