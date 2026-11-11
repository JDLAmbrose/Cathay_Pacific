import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyRoute } from "../services/navigation";
import {
  FAMILY_MEMBER_ID,
  activeOrder,
  baggagePlan,
  cancelOrder,
  checkApplicationDeadline,
  clone,
  draft,
  helperContacts,
  initial,
  linkedFamilyMembers,
  migrateBookingState,
  passengerFamilyLink,
  pay,
  pendingHelperRequest,
  preparePricingBoard,
  pricingLane,
  pricingQuote,
  quoteService,
  restoreBooking,
  saveDeclaration,
  selectHelper,
  selectedHelper,
  sendHelperRequest,
  setFamilyDemoUnlinked,
  setPricingLane,
  simulateFamilyLink,
  startNewHelperApplication,
  state,
  ticketAllowance,
  validateHelper,
  validateService,
} from "./booking";

beforeEach(() => {
  vi.useFakeTimers();
  restoreBooking(initial());
  applyRoute({ page: "passenger", helper: false });
});
afterEach(() => vi.useRealTimers());

describe("pricing and allowance", () => {
  it("counts only billable flight shortfalls and uses a shared pickup package", () => {
    expect(ticketAllowance().pieces).toBe(2);
    expect(quoteService()).toMatchObject({
      total: 240000,
      serviceFee: 120000,
      extraFee: 120000,
    });
    expect(validateService()).toBe("e.buyAllowance");
    expect(quoteService("cargo")).toMatchObject({
      total: 195000,
      cargoUnits: 3,
      chargeableWeight: 56,
    });
    state.extraBags.lin = 2;
    expect(validateService()).toBeNull();
    for (const count of [3, 2, 1]) {
      draft().items = draft().items.slice(0, count);
      expect(quoteService().serviceFee).toBe(120000);
    }
    expect(baggagePlan().purchased).toBe(0);
    expect(quoteService().extraFee).toBe(0);
    state.travellerId = "child";
    expect(ticketAllowance().pieces).toBe(1);
  });

  it.each([null, 7, 7.01, 20])(
    "rejects a cabin move at weight %s without changing the draft",
    (weight) => {
      preparePricingBoard();
      draft().items[0].weight = weight;
      const before = clone(draft());
      expect(setPricingLane("bag-1", "cabin")).toBe(false);
      expect(draft()).toEqual(before);
      draft().items[0].weight = 6.9;
      expect(setPricingLane("bag-1", "cabin")).toBe(true);
      expect(pricingLane(draft().items[0])).toBe("cabin");
    },
  );

  it("restores lane assignments and uses them in the paid snapshot", async () => {
    expect(preparePricingBoard()).toBe(true);
    expect(preparePricingBoard()).toBe(false);
    expect(pricingQuote().total).toBe(180000);
    expect(setPricingLane("bag-1", "cargo")).toBe(true);
    expect(pricingQuote()).toMatchObject({
      total: 145000,
      cargoUnits: 1,
      transport: "mixed",
    });
    expect(saveDeclaration(true)).toBe(true);
    restoreBooking(clone(state));
    expect(pricingLane(draft().items[0])).toBe("cargo");
    expect(state.declarations.lin.items[0].carriage).toBe("cargo");
    state.agreed = true;
    const payment = pay();
    await vi.advanceTimersByTimeAsync(650);
    await payment;
    expect(activeOrder()).toMatchObject({
      transport: "mixed",
      quote: { total: 145000 },
    });
    expect(setPricingLane("bag-1", "flight")).toBe(false);
  });

  it("flags invalid old cabin assignments and allows correcting them", () => {
    preparePricingBoard();
    draft().items.find((item) => item.id === "box-2").weight = 10;
    restoreBooking(clone(state));
    expect(pricingQuote().error).toBe("e.cabinWeightLimit");
    expect(setPricingLane("box-2", "flight")).toBe(true);
    expect(pricingQuote().valid).toBe(true);
  });

  it.each([
    ["hk", 24],
    ["gba", 48],
    ["mainland", 120],
  ])("honors the %s cutoff exactly", (region, hours) => {
    state.region = region;
    const deadline = Date.parse(state.flight.departure) - hours * 3600000;
    state.clock = new Date(deadline).toISOString();
    expect(checkApplicationDeadline().valid).toBe(true);
    state.clock = new Date(deadline + 1).toISOString();
    expect(checkApplicationDeadline().valid).toBe(false);
  });

  it("retains the imported allowance for known legacy tickets only", () => {
    const legacy = initial();
    delete legacy.flight.baggageAllowance;
    delete legacy.extraBags;
    restoreBooking(clone(legacy));
    expect(ticketAllowance().pieces).toBe(2);
    legacy.flight.bookingId = "unrecognized";
    restoreBooking(legacy);
    expect(ticketAllowance()).toBeNull();
    state.flight.destination = "MEL";
    migrateBookingState();
    expect(state.partner).toBe("Australia Post");
  });
});

describe("payment", () => {
  it.each(["cash", "miles"])(
    "keeps the paid quote immutable and refunds %s payment",
    async (payment) => {
      state.extraBags.lin = 2;
      state.agreed = true;
      state.payment = payment;
      state.milesBalance = 100000;
      const confirmation = pay();
      expect(activeOrder()).toBeUndefined();
      await vi.advanceTimersByTimeAsync(650);
      await confirmation;
      const order = activeOrder();
      expect(order).toMatchObject({
        extraPieces: 2,
        allowance: { pieces: 2 },
        quote: { total: 240000 },
      });
      state.extraBags.lin = 5;
      expect(order.extraPieces).toBe(2);
      cancelOrder(order.id, true);
      expect(order.status).toBe("cancelled");
      expect(state.milesBalance).toBe(100000);
    },
  );

  it("abandons a payment when the quote changes mid-flight", async () => {
    state.extraBags.lin = 2;
    state.agreed = true;
    state.payment = "miles";
    state.milesBalance = 100000;
    const payment = pay();
    expect(state.frozenMiles).toBeGreaterThan(0);
    state.extraBags.lin = 3;
    await vi.advanceTimersByTimeAsync(650);
    await payment;
    expect(state.orders).toHaveLength(0);
    expect(state.frozenMiles).toBe(0);
  });
});

describe("family assistance", () => {
  it("resets opt-in on passenger entry without losing a pending request", () => {
    state.family = true;
    expect(validateHelper()).toBe("helper.noContactsTitle");
    expect(simulateFamilyLink(passengerFamilyLink("lin"), "lin")).toBe(true);
    expect(helperContacts()).toHaveLength(1);
    selectHelper(helperContacts()[0].id);
    expect(selectedHelper()).toMatchObject({
      memberNo: "9876543210",
      mobile: "+852 0000 0001",
      relationship: "parent",
    });
    expect(sendHelperRequest()).toBe(true);
    expect(sendHelperRequest()).toBe(false);
    const request = pendingHelperRequest();
    applyRoute({ page: "passenger", helper: false });
    expect(state.family).toBe(false);
    expect(pendingHelperRequest()).toEqual(request);
    state.family = true;
    expect(validateHelper()).toBe("helper.waiting");
    expect(startNewHelperApplication()).toBe(true);
    expect(pendingHelperRequest()).toBeUndefined();
    expect(state.family).toBe(false);
  });

  it("can hide and restore demo members independently of the parent page entry", () => {
    expect(linkedFamilyMembers()).toHaveLength(0);
    expect(simulateFamilyLink(state.familyLink, FAMILY_MEMBER_ID)).toBe(true);
    expect(linkedFamilyMembers().length).toBeGreaterThan(0);
    setFamilyDemoUnlinked(FAMILY_MEMBER_ID, true);
    expect(linkedFamilyMembers()).toHaveLength(0);
    setFamilyDemoUnlinked(FAMILY_MEMBER_ID, false);
    expect(linkedFamilyMembers().length).toBeGreaterThan(0);
  });
});
