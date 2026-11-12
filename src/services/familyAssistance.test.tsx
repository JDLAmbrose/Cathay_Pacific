import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import copy from "../config/copy.json";
import { cathayGuardianGuidanceUrl } from "../config/urls";
import {
  clone, exitFamilyDemo, familyInvitationId, familyKnownContact, familyOrder,
  familyPermission, familyPolicy, familyProgressAccess, familyServiceEstablished,
  familySessionPermission, helperContacts, initial, linkedFamilyMembers,
  linkedPassengerContacts, noFamilyPermissions, passengerFamilyLink, pay,
  pendingFamilyInvitations, persist, restoreBooking, respondFamilyInvite,
  revokeFamilyService, setFamilyDemoUnlinked, simulateFamilyLink, state,
  submitFamilyInvitation, updateFamilyPermissions,
} from "../engine/booking";
import { FamilyPage, familyEmailHTML } from "../pages/family";
import { JourneyPage } from "../pages/journey";
import { BookingPage } from "../pages/booking";
import type { FamilyLink, FamilyPermissions } from "../types/domain";
import { browserDataSource, setDataSource } from "./dataSource";
import { activateFamilyService, openFamilyInvite } from "./familyActions";
import { LOCALES, setLanguage, t } from "./i18n";
import { applyRoute } from "./navigation";
import { closeModal, dialog } from "./runtime";

const bookingOnly: FamilyPermissions = { booking: true, payment: false, progress: false };
const all: FamilyPermissions = { booking: true, payment: true, progress: true };
const studentConsent = { role: "student" as const, confirmed: true };
const guardianConsent = { role: "guardian" as const, confirmed: true };

beforeEach(() => {
  vi.useFakeTimers();
  restoreBooking(initial());
  setLanguage("zh-Hant");
  applyRoute({ page: "family", helper: false });
});
afterEach(() => {
  closeModal();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setLanguage("zh-Hant");
  setDataSource(browserDataSource);
});

function inviteFromFamily(studentId = "lin") {
  expect(submitFamilyInvitation(familyKnownContact(studentId, false), null)).toBeNull();
  return pendingFamilyInvitations(null)[0];
}
function establishAdult(permissions = bookingOnly) {
  const link = inviteFromFamily();
  expect(respondFamilyInvite(true, false, link, { ...studentConsent, permissions })).toBe(true);
  return link;
}
function mockConsent(permissions: FamilyPermissions) {
  vi.stubGlobal("document", { getElementById: (id: string) => id === "familyConsent" ? { checked: true } : id.startsWith("familyPermission-") ? { checked: permissions[id.slice("familyPermission-".length)] } : undefined });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
}

describe("minor students and external Cathay relationships", () => {
  it("scenario 1: reuses the recorded guardian and activates only explicitly selected permissions", () => {
    state.travellerId = "child";
    applyRoute({ page: "family", helper: false });
    const membership = clone(state.membership);
    const page = renderToStaticMarkup(<FamilyPage />);
    expect(page).toContain(t("service.official.linked"));
    expect(page).toContain(t("service.notAuthorized"));
    expect(page).toContain(t("link.memberCount", { n: "0" }));
    openFamilyInvite();
    expect(dialog.title).toBe(t("service.activate"));
    const body = renderToStaticMarkup(<>{dialog.body}</>);
    expect(body).not.toContain('data-family-field="surname"');
    expect(body).toContain(t("service.guardianExisting"));
    expect(linkedFamilyMembers()).toHaveLength(0);
    mockConsent(bookingOnly);
    activateFamilyService();
    const linked = linkedFamilyMembers();
    expect(linked).toHaveLength(1);
    expect(linked[0].service.confirmedBy).toBe("guardian");
    expect(linked[0].service.permissions).toEqual(bookingOnly);
    expect(state.membership).toEqual(membership);
  });

  it("scenario 2: guides an unconfirmed minor to the verified official FAQ without accepting ordinary invitations", () => {
    state.travellerId = "child";
    state.membership.eligibility.child.guardianStatus = "unknown";
    applyRoute({ page: "family", helper: false });
    const membership = clone(state.membership);
    openFamilyInvite();
    expect(dialog.buttons.map((button) => button.action)).toEqual(["close-dialog"]);
    const body = renderToStaticMarkup(<>{dialog.body}</>);
    expect(body).toContain(cathayGuardianGuidanceUrl("zh-Hant"));
    expect(body).toContain('target="_blank" rel="noopener noreferrer"');
    expect(body).toContain(t("service.externalDemo"));
    const contact = familyKnownContact("child", false);
    contact.relationship = "guardian";
    expect(submitFamilyInvitation(contact, null)).toBe("service.guardianRequired");
    contact.status = "pending";
    expect(respondFamilyInvite(true, true, contact, { ...guardianConsent, permissions: all })).toBe(false);
    expect(linkedFamilyMembers()).toHaveLength(0);
    expect(state.membership).toEqual(membership);
  });

  it("requires the specific recorded guardian and configurable service-consent result", () => {
    state.membership.eligibility.child.guardianMemberNo = "another-guardian";
    expect(submitFamilyInvitation(familyKnownContact("child", false), null)).toBe("service.guardianRequired");
    state.membership.eligibility.lin.serviceConsent = "unknown";
    expect(submitFamilyInvitation(familyKnownContact("lin", false), null)).toBe("service.eligibilityUnknown");
    expect(familyPolicy("unconfigured-student").serviceConsent).toBe("unknown");
    // Membership rules supply eligibility; student type has no fixed upper age.
    state.membership.eligibility.child = { serviceConsent: "self", guardianStatus: "notApplicable", policy: "configured-self-consent" };
    const link = inviteFromFamily("child");
    expect(respondFamilyInvite(true, false, link, { ...studentConsent, permissions: bookingOnly })).toBe(true);
  });
});

describe("adult invitations and consent", () => {
  it("scenario 3: a family recipient accepts only the adult student's preselected permissions; the student may edit or revoke them", () => {
    applyRoute({ page: "family", helper: true });
    const contact = familyKnownContact("lin", true);
    contact.service.permissions = { ...bookingOnly };
    expect(submitFamilyInvitation(contact, "lin")).toBe("service.confirmRequired");
    contact.service.studentConfirmed = true;
    expect(submitFamilyInvitation(contact, "lin")).toBeNull();
    const link = pendingFamilyInvitations("lin")[0];
    expect(helperContacts()).toHaveLength(0);
    expect(linkedPassengerContacts("lin")).toHaveLength(0);
    expect(respondFamilyInvite(true, true, link, { role: "family", confirmed: true, permissions: all })).toBe(true);
    expect(link.service.permissions).toEqual(bookingOnly);
    expect(helperContacts()).toHaveLength(1);
    // The family view projects the same record, so the recipient can use the existing booking flow.
    applyRoute({ page: "family", helper: false });
    const familyView = renderToStaticMarkup(<FamilyPage />);
    expect(familyView).toContain("Lin Chen");
    expect(familyView).toContain('data-family-proxy="' + familyInvitationId(link) + '"');
    applyRoute({ page: "family", helper: true });
    expect(updateFamilyPermissions(link, all, { role: "family", confirmed: true })).toBe(false);
    expect(updateFamilyPermissions(link, all, studentConsent)).toBe(true);
    expect(revokeFamilyService(link, studentConsent)).toBe(true);
    expect(link.status).toBe("revoked");
    expect(link.service.permissions).toEqual(noFamilyPermissions());
    expect(linkedPassengerContacts("lin")).toHaveLength(0);
    expect(helperContacts()).toHaveLength(0);
    expect(renderToStaticMarkup(<FamilyPage />)).toContain(t("service.revoked"));
  });

  it("scenario 4: a family-initiated invitation stays pending until the adult student explicitly confirms", () => {
    const contact = familyKnownContact("lin", false);
    contact.service.permissions = { ...all };
    expect(submitFamilyInvitation(contact, null)).toBeNull();
    const link = pendingFamilyInvitations(null)[0];
    expect(link.service.permissions).toEqual(noFamilyPermissions());
    expect(linkedFamilyMembers()).toHaveLength(0);
    expect(renderToStaticMarkup(<FamilyPage />)).toContain(t("link.memberCount", { n: "0" }));
    expect(respondFamilyInvite(true, true, link)).toBe(false);
    expect(respondFamilyInvite(true, true, link, { role: "family", confirmed: true })).toBe(false);
    expect(respondFamilyInvite(true, true, link, { role: "student", confirmed: false })).toBe(false);
    applyRoute({ page: "family", helper: true });
    expect(renderToStaticMarkup(<FamilyPage />)).toContain(t("link.statusPending"));
    expect(respondFamilyInvite(true, true, link, studentConsent)).toBe(true);
    expect(familyServiceEstablished(link)).toBe(true);
    expect(link.service.permissions).toEqual(noFamilyPermissions());
    expect(linkedFamilyMembers()).toHaveLength(1);
    expect(renderToStaticMarkup(<FamilyPage />)).toContain("Mei Chen");
  });

  it("prevents duplicate links across invitation directions and rejects unknown members or self invitations", () => {
    establishAdult();
    const reverse = familyKnownContact("lin", true);
    reverse.service.studentConfirmed = true;
    expect(submitFamilyInvitation(reverse, "lin")).toBe("e.familyDuplicate");
    const unknown = familyKnownContact("lin", false);
    unknown.memberNo = "1111111111";
    expect(submitFamilyInvitation(unknown, null)).toBe("service.memberUnknown");
    const self = familyKnownContact("lin", false);
    self.service.studentConfirmed = true;
    expect(submitFamilyInvitation(self, "lin")).toBe("service.selfInvite");
  });
});

describe("separate journey and payment permissions", () => {
  it("scenario 5: booking permission never grants progress, even by direct Journey Overview entry", async () => {
    const link = establishAdult();
    state.extraBags.lin = 2;
    state.agreed = true;
    const payment = pay();
    await vi.advanceTimersByTimeAsync(650);
    await payment;
    const order = state.orders[0];
    expect(order).toBeDefined();
    state.familyAccess = { linkId: familyInvitationId(link), studentId: "lin" };
    // Legacy share flags must not override the explicit permission.
    link.shareProgress = true;
    expect(familyProgressAccess(link)).toBe("denied");
    expect(familySessionPermission("booking")).toBe(true);
    expect(familySessionPermission("progress")).toBe(false);
    const denied = renderToStaticMarkup(<JourneyPage />);
    expect(denied).toContain(t("service.progressDenied"));
    expect(denied).not.toContain(order.id);
    expect(denied).not.toContain(order.destination);
    expect(renderToStaticMarkup(<FamilyPage />)).not.toContain('data-family-progress=""');
    expect(updateFamilyPermissions(link, { ...bookingOnly, progress: true }, studentConsent)).toBe(true);
    expect(familyProgressAccess(link)).toBe("ready");
    expect(renderToStaticMarkup(<JourneyPage />)).toContain(order.id);
    state.orders.unshift({ ...clone(order), id: "another-trip", flight: { ...order.flight, legId: "another-leg" } });
    expect(familyOrder(link).id).toBe(order.id);
    expect(renderToStaticMarkup(<JourneyPage />)).toContain(order.id);
    expect(renderToStaticMarkup(<JourneyPage />)).not.toContain("another-trip");
    expect(renderToStaticMarkup(<JourneyPage />)).not.toContain('data-action="cancel-order"');
    state.flight.legId = "another-leg";
    expect(familyProgressAccess(link)).toBe("denied");
    expect(renderToStaticMarkup(<JourneyPage />)).not.toContain("another-trip");
  });

  it("blocks delegated payment without payment consent and blocks booking for payment-only helpers", async () => {
    const link = establishAdult();
    state.familyAccess = { linkId: familyInvitationId(link), studentId: "lin" };
    state.extraBags.lin = 2;
    state.agreed = true;
    await pay();
    expect(state.orders).toHaveLength(0);
    expect(updateFamilyPermissions(link, { booking: false, payment: true, progress: false }, studentConsent)).toBe(true);
    state.step = 2;
    expect(renderToStaticMarkup(<BookingPage />)).toContain(t("service.bookingDenied"));
    expect(helperContacts()).toHaveLength(0);
    state.step = 5;
    expect(renderToStaticMarkup(<BookingPage />)).not.toContain(t("service.paymentDenied"));
    const payment = pay();
    await vi.advanceTimersByTimeAsync(650);
    await payment;
    expect(state.orders).toHaveLength(1);
    expect(familySessionPermission("progress")).toBe(false);
  });

  it("rechecks payment consent before completing an in-flight Demo payment", async () => {
    const link = establishAdult(all);
    state.familyAccess = { linkId: familyInvitationId(link), studentId: "lin" };
    state.extraBags.lin = 2;
    state.agreed = true;
    const payment = pay();
    revokeFamilyService(link, studentConsent);
    await vi.advanceTimersByTimeAsync(650);
    await payment;
    expect(state.orders).toHaveLength(0);
    expect(state.processing).toBe(false);
    expect(familyPermission(link, "booking")).toBe(false);
  });
});

describe("Demo isolation, migration and translations", () => {
  it("scenario 6: all three existing Demo actions preserve saved operations and survive reload", () => {
    establishAdult(all);
    state.drafts.lin.items[0].name = "Saved personal draft";
    state.contact = "Saved booking contact";
    state.helper.lin = { bookingId: state.flight.bookingId, legId: state.flight.legId, contactId: "parent", requests: [] };
    const before = clone(state);
    let saved = clone(state);
    setDataSource({ ...browserDataSource, saveBooking: (booking) => { saved = clone(booking); } });
    simulateFamilyLink(state.familyLink, "lin");
    const overlayLink = linkedFamilyMembers()[0];
    expect(overlayLink).not.toBe(state.familyLink);
    expect(overlayLink.service.permissions).toEqual(bookingOnly);
    updateFamilyPermissions(overlayLink, noFamilyPermissions(), studentConsent);
    setFamilyDemoUnlinked("lin", true);
    expect(linkedFamilyMembers()).toHaveLength(0);
    persist();
    restoreBooking(saved);
    expect(linkedFamilyMembers()).toHaveLength(0);
    exitFamilyDemo();
    expect(linkedFamilyMembers()).toHaveLength(1);
    for (const key of ["familyLink", "passengerLinks", "familyInvitationArchive", "familyMembers", "membership", "helper", "drafts", "declarations", "orders", "events", "contact", "nextFamilyInvitation"] as const)
      expect(state[key], key).toEqual(before[key]);
  });

  it("keeps student-side overlay invitations out of saved records and never converts an invitation to official guardianship", () => {
    const contact = passengerFamilyLink("lin");
    const original = clone(state.passengerLinks);
    const membership = clone(state.membership);
    simulateFamilyLink(contact, "lin");
    revokeFamilyService(linkedPassengerContacts("lin")[0], studentConsent);
    const draft = familyKnownContact("lin", true);
    draft.service.studentConfirmed = true;
    expect(submitFamilyInvitation(draft, "lin")).toBeNull();
    expect(pendingFamilyInvitations("lin")).toHaveLength(1);
    expect(state.passengerLinks).toEqual(original);
    exitFamilyDemo();
    expect(pendingFamilyInvitations("lin")).toHaveLength(0);
    expect(state.passengerLinks).toEqual(original);
    expect(state.membership).toEqual(membership);
  });

  it("migrates old linked records without silently granting service permissions", () => {
    const old = initial();
    old.familyLink.status = "linked";
    old.familyLink.shareProgress = true;
    delete old.membership;
    restoreBooking(old);
    expect(state.membership.source).toBe("demo");
    expect(state.familyLink.service.permissions).toEqual(noFamilyPermissions());
    expect(linkedFamilyMembers()).toHaveLength(0);
    expect(familyProgressAccess(state.familyLink)).toBe("unlinked");
    expect(renderToStaticMarkup(<FamilyPage />)).toContain(t("service.notAuthorized"));
  });

  it("keeps Demo changes isolated when switching invitation direction", () => {
    const before = clone(state);
    simulateFamilyLink(state.familyLink, "lin");
    revokeFamilyService(linkedFamilyMembers()[0], studentConsent);
    applyRoute({ page: "family", helper: true });
    const draft = familyKnownContact("lin", true);
    draft.service.studentConfirmed = true;
    expect(submitFamilyInvitation(draft, "lin")).toBeNull();
    expect(pendingFamilyInvitations("lin")).toHaveLength(1);
    expect(renderToStaticMarkup(<FamilyPage />)).toContain(t("link.statusPending"));
    exitFamilyDemo();
    expect(state.passengerLinks).toEqual(before.passengerLinks);
    expect(state.familyLink).toEqual(before.familyLink);
    expect(state.nextFamilyInvitation).toEqual(before.nextFamilyInvitation);
  });

  it("renders the page, invitation and minor flows in all five languages without missing copy", () => {
    const link = inviteFromFamily();
    for (const locale of LOCALES) {
      setLanguage(locale);
      for (const [key, values] of Object.entries(copy).filter(([key]) => key.startsWith("service."))) {
        expect(values, key).toHaveLength(LOCALES.length);
        expect(values[LOCALES.indexOf(locale)].trim(), key).not.toBe("");
        expect(t(key), key).not.toBe(key);
      }
      for (const html of [renderToStaticMarkup(<FamilyPage />), renderToStaticMarkup(familyEmailHTML(link))])
        expect(html).not.toMatch(/(?:service|link)\.[a-zA-Z]+(?:\.[a-zA-Z]+)?/);
      state.travellerId = "child";
      openFamilyInvite();
      expect(renderToStaticMarkup(<>{dialog.body}</>)).not.toMatch(/service\.[a-zA-Z]+/);
      closeModal();
      state.membership.eligibility.child.guardianStatus = "unknown";
      openFamilyInvite();
      expect(renderToStaticMarkup(<>{dialog.body}</>)).toContain(cathayGuardianGuidanceUrl(locale));
      closeModal();
      state.membership.eligibility.child.guardianStatus = "linked";
      state.travellerId = "lin";
    }
  });
});
