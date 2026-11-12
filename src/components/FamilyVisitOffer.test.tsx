import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it } from "vitest";
import copy from "../config/copy.json";
import { FAMILY_MILESTONES_DEMO, FAMILY_VISIT_PROMO_DEMO } from "../config/familyMilestones.demo";
import {
  familyKnownContact, initial, pendingFamilyInvitations, respondFamilyInvite,
  restoreBooking, setFamilyDemoUnlinked, simulateFamilyLink, state, submitFamilyInvitation,
} from "../engine/booking";
import { BenefitsPage, companionCardHTML, setFamilyOccasion } from "../pages/family";
import { getFamilyMilestones, getFamilyVisitOffer } from "../services/familyMilestones";
import { LOCALES, setLanguage, t } from "../services/i18n";
import { applyRoute } from "../services/navigation";
import type { Order } from "../types/domain";

const originalDemo = structuredClone(FAMILY_MILESTONES_DEMO);
const originalIssued = structuredClone(FAMILY_VISIT_PROMO_DEMO.issued);
const escaped = (value: string) => renderToStaticMarkup(<>{value}</>);
const rightCard = () => renderToStaticMarkup(companionCardHTML());

beforeEach(() => {
  restoreBooking(initial());
  setLanguage("zh-Hant");
  applyRoute({ page: "benefits", helper: false });
  // Most cases exercise eligibility without any issuance record. Tests of the
  // product's pre-issued Demo state restore that explicit fixture themselves.
  FAMILY_VISIT_PROMO_DEMO.issued = null;
});
afterEach(() => {
  Object.assign(FAMILY_MILESTONES_DEMO, structuredClone(originalDemo));
  FAMILY_VISIT_PROMO_DEMO.issued = structuredClone(originalIssued);
  setLanguage("zh-Hant");
  setFamilyOccasion("enrol");
});

function linkFamily(relationship = "parent", studentId = "lin") {
  simulateFamilyLink(state.familyLink, studentId);
  const member = state.familyDemo.records[0];
  member.relationship = relationship;
  return member;
}
function order(status = "completed", id = "first-move", travellerId = "lin"): Order {
  const seed = initial();
  return {
    id, status, travellerId, flight: structuredClone(seed.flight),
    declaration: structuredClone(seed.drafts.lin), quote: { valid: true },
    payment: seed.payment, extraPieces: 0, allowance: null,
    contact: seed.contact, phone: seed.phone, pickup: seed.pickup,
    pickupAddress: seed.pickupAddress, destination: seed.destinationAddress,
    recipient: seed.recipient, partner: seed.partner,
    pickupPartner: seed.pickupPartner, recipientPhone: seed.recipientPhone,
    transport: seed.transport, region: seed.region, itemIds: ["bag-1"],
    earned: false, refunded: false, createdAt: seed.clock,
  };
}

it("shows the explicit issued Demo code for the existing eligible 1/3 family without masks or pending text", () => {
  FAMILY_VISIT_PROMO_DEMO.issued = structuredClone(originalIssued);
  const before = JSON.stringify(state);
  expect(getFamilyMilestones()).toMatchObject({ completed: 1, source: "demo" });
  expect(getFamilyVisitOffer()).toEqual({ eligible: true, code: "PLUMEFAM2026", source: "demo" });
  const html = rightCard();
  expect(html).toContain(t("benefit.visitUnlocked"));
  expect(html).toContain(t("benefit.visitCompleted"));
  expect(html).toContain("PLUMEFAM2026");
  expect(html).toContain('data-promo-issued="true"');
  expect(html).toContain(t("benefit.promoDemoLabel"));
  expect(html).toContain(t("benefit.promoUsage"));
  expect(html).not.toContain("••••");
  expect(html).not.toContain("待發放");
  expect(html).not.toContain("Pending issuance");
  expect(html).toContain("visit-check");
  expect(html).toContain(t("benefit.promoIssued"));
  expect(FAMILY_VISIT_PROMO_DEMO.issued).toEqual(originalIssued);
  expect(JSON.stringify(state)).toBe(before);
});

it.each([0, 1, 2, 3])("shares the milestone result at %i/3 without issuing a promo code", (count) => {
  FAMILY_MILESTONES_DEMO.records = Array.from({ length: 3 }, (_, index) => ({
    id: "sample-" + index, status: index < count ? "completed" : "notStarted", eligible: true,
  }));
  expect(getFamilyMilestones().completed).toBe(count);
  expect(getFamilyVisitOffer().eligible).toBe(count >= 1);
  const page = renderToStaticMarkup(<BenefitsPage />);
  expect(page).toContain(`aria-valuenow="${count}"`);
  expect(page).toContain(`data-visit-eligible="${count >= 1}"`);
  expect(page).toContain(t(count >= 1 ? "benefit.visitUnlocked" : "benefit.visitLocked"));
  expect(getFamilyVisitOffer().code).toBeNull();
});

it.each(["unpaid", "paid_demo", "in_transit", "cancelled"])("does not unlock for a %s first order", (status) => {
  linkFamily();
  state.orders.push(order(status));
  expect(getFamilyMilestones().completed).toBe(0);
  expect(getFamilyVisitOffer()).toMatchObject({ eligible: false, code: null });
  const html = rightCard();
  expect(html).toContain(t("benefit.visitLocked"));
  expect(html).not.toContain(t("benefit.visitUnlocked"));
  expect(html).not.toContain("visit-check");
});

it.each(["parent", "guardian"])("unlocks for a confirmed %s without inventing an issuance record", (relationship) => {
  linkFamily(relationship);
  state.orders.push(order());
  expect(getFamilyVisitOffer()).toMatchObject({ eligible: true, code: null, source: "orders" });
  // Later unfinished moves do not erase the first eligible completed move.
  state.orders.push(order("paid_demo", "next-move"));
  expect(getFamilyVisitOffer().eligible).toBe(true);
  expect(getFamilyMilestones().completed).toBe(1);
});

it("recognises a parent who accepted the student's invitation without creating a second family relation", () => {
  const contact = familyKnownContact("lin", true);
  contact.service.studentConfirmed = true;
  expect(submitFamilyInvitation(contact, "lin")).toBeNull();
  const pending = pendingFamilyInvitations("lin")[0];
  expect(respondFamilyInvite(true, false, pending, { role: "family", confirmed: true })).toBe(true);
  state.orders.push(order());
  const before = JSON.stringify(state);
  expect(getFamilyMilestones()).toMatchObject({ completed: 1, source: "orders" });
  expect(getFamilyVisitOffer()).toEqual({ eligible: true, code: null, source: "orders" });
  expect(JSON.stringify(state)).toBe(before);
});

it("excludes refunds, empty services and cancelled duplicates regardless of snapshot order", () => {
  linkFamily();
  for (const orders of [
    [{ ...order(), refunded: true }],
    [{ ...order(), itemIds: [] }],
    [order(), order("cancelled")],
    [order("cancelled"), order()],
  ]) {
    state.orders = orders;
    expect(getFamilyMilestones().completed).toBe(0);
    expect(getFamilyVisitOffer()).toMatchObject({ eligible: false, code: null });
  }
});

it.each(["pending", "revoked", "declined"])("requires a confirmed family link, not a %s relationship", (status) => {
  const member = linkFamily();
  member.status = status;
  state.orders.push(order());
  expect(getFamilyVisitOffer().eligible).toBe(false);
  // An explicit pending/revoked relationship also overrides the linked Demo sample.
  state.orders = [];
  expect(getFamilyVisitOffer().eligible).toBe(false);
  expect(getFamilyMilestones().completed).toBe(0);
});

it("honours explicit unlinked Demo mode, the sample link state and parental eligibility", () => {
  setFamilyDemoUnlinked("lin", true);
  expect(getFamilyVisitOffer().eligible).toBe(false);
  expect(getFamilyMilestones().completed).toBe(0);
  restoreBooking(initial());
  FAMILY_MILESTONES_DEMO.family.linked = false;
  expect(getFamilyVisitOffer().eligible).toBe(false);
  expect(getFamilyMilestones().completed).toBe(0);
  linkFamily("other");
  state.orders.push(order());
  expect(getFamilyMilestones().completed).toBe(1);
  expect(getFamilyVisitOffer().eligible).toBe(false);
});

it("never applies the Lin sample move to another linked student's eligibility", () => {
  linkFamily("parent", "child");
  expect(getFamilyMilestones()).toMatchObject({ completed: 0, source: "orders" });
  expect(getFamilyVisitOffer()).toEqual({ eligible: false, code: null, source: "orders" });
});

it("does not mix unrelated members or expose their configured Demo code", () => {
  FAMILY_MILESTONES_DEMO.enabled = false;
  linkFamily();
  state.orders.push(order("completed", "another-family", "child"));
  FAMILY_VISIT_PROMO_DEMO.issued = { studentId: "child", code: "DEMO-OTHER-FAMILY" };
  expect(getFamilyVisitOffer()).toMatchObject({ eligible: false, code: null });
  state.orders.push(order());
  expect(getFamilyVisitOffer()).toMatchObject({ eligible: true, code: null });
});

it("shows only an explicitly issued Demo sample and hides it if qualification is withdrawn", () => {
  linkFamily();
  state.orders.push(order());
  FAMILY_VISIT_PROMO_DEMO.issued = { studentId: "lin", code: "DEMO-PARENT-VISIT" };
  expect(getFamilyVisitOffer().code).toBe("DEMO-PARENT-VISIT");
  const html = rightCard();
  expect(html).toContain("DEMO-PARENT-VISIT");
  expect(html).toContain(t("benefit.promoIssued"));
  expect(html).toContain(escaped(t("benefit.promoDemoNote")));
  state.orders[0].refunded = true;
  expect(getFamilyVisitOffer()).toMatchObject({ eligible: false, code: null });
  expect(rightCard()).toContain(t("benefit.promoUnavailable"));
  expect(rightCard()).not.toContain("DEMO-PARENT-VISIT");
});

it.each(LOCALES)("keeps all three occasion switches, concise copy and the official booking link in %s", (locale) => {
  setLanguage(locale);
  FAMILY_VISIT_PROMO_DEMO.issued = structuredClone(originalIssued);
  for (const occasion of ["enrol", "holiday", "graduation"]) {
    setFamilyOccasion(occasion);
    const html = rightCard();
    expect(html).toContain(`data-occasion="${occasion}" aria-pressed="true"`);
    expect(html).toContain(escaped(t("benefit.occasionText." + occasion, { name: t("benefit.familyFallback") })));
    expect(html).toContain('href="https://www.cathaypacific.com/" target="_blank" rel="noopener noreferrer"');
    for (const key of ["benefit.visitUnlocked", "benefit.visitCompleted", "benefit.promoDemoLabel", "benefit.promoUsage", "benefit.bookCta"]) {
      expect(copy[key]).toHaveLength(LOCALES.length);
      expect(html).toContain(escaped(t(key)));
      expect(html).not.toContain(key);
    }
    expect(html).not.toContain("promo-steps");
    expect(html).not.toContain(escaped(t("benefit.eligibility")));
    expect(html).not.toContain(escaped(t("benefit.bookNote")));
    expect(html).not.toContain("••••");
    expect(html).not.toContain("benefit.promoPendingDemo");
    const afterCode = html.slice(html.indexOf("PLUMEFAM2026"));
    expect(afterCode.match(/<p\b/g)).toHaveLength(1);
    expect(getFamilyVisitOffer().code).toBe("PLUMEFAM2026");
  }
  expect(FAMILY_VISIT_PROMO_DEMO.issued).toEqual(originalIssued);
});
