import { beforeEach, describe, expect, it } from "vitest";
import { FAMILY_MILESTONES_DEMO } from "../config/familyMilestones.demo";
import { initial, restoreBooking, state } from "../engine/booking";
import type { Order } from "../types/domain";
import {
  calculateFamilyMilestones,
  getFamilyMilestones,
  resolveFamilyMilestones,
  type FamilyMilestoneRecord,
} from "./familyMilestones";

beforeEach(() => restoreBooking(initial()));

function order(status: string, id = "order-1", travellerId = "lin"): Order {
  const seed = initial();
  return {
    id,
    status,
    travellerId,
    flight: structuredClone(seed.flight),
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
    itemIds: seed.drafts.lin.items.filter((item) => item.service).map((item) => item.id),
    earned: false,
    refunded: false,
    createdAt: seed.clock,
  };
}

describe("family milestone progress", () => {
  it.each([0, 1, 2, 3])("derives %i/3, badges and unlock from the same records", (count) => {
    const records: FamilyMilestoneRecord[] = Array.from({ length: 3 }, (_, index) => ({
      id: `move-${index}`,
      eligible: true,
      status: index < count ? "completed" : "notStarted",
    }));
    const result = calculateFamilyMilestones(records, { source: "demo", linked: true });
    expect(result.completed).toBe(count);
    expect(result.progress).toBe(count / 3);
    expect(result.unlocked).toBe(count === 3);
    expect(result.moves.filter((move) => move.status === "counted")).toHaveLength(count);
  });

  it("counts eligible completed moves only and never counts the same ID twice", () => {
    const records: FamilyMilestoneRecord[] = [
      { id: "complete", status: "completed", eligible: true },
      { id: "complete", status: "completed", eligible: true },
      { id: "ineligible", status: "completed", eligible: false },
      { id: "cancelled", status: "cancelled", eligible: true },
      { id: "active", status: "inProgress", eligible: true },
    ];
    const result = calculateFamilyMilestones(records, { source: "orders", linked: true });
    expect(result.completed).toBe(1);
    expect(result.unlocked).toBe(false);
    expect(result.moves.map((move) => move.status)).toEqual(["counted", "inProgress", "notStarted"]);
    expect(result.moves.map((move) => move.id)).not.toContain("ineligible");
  });

  it("caps completed history at the existing three-move threshold", () => {
    const records: FamilyMilestoneRecord[] = Array.from({ length: 5 }, (_, index) => ({
      id: `move-${index}`,
      eligible: true,
      status: "completed",
    }));
    expect(calculateFamilyMilestones(records, { source: "orders", linked: true }))
      .toMatchObject({ completed: 3, progress: 1, unlocked: true });
    expect(calculateFamilyMilestones(records, { source: "orders", linked: false }))
      .toMatchObject({ completed: 0, progress: 0, unlocked: false });
  });
});

describe("isolated demo and order data", () => {
  it("defaults the empty demo to 1/3 without creating orders, links or fare codes", () => {
    const before = JSON.stringify(state);
    expect(getFamilyMilestones()).toMatchObject({
      source: "demo", completed: 1, progress: 1 / 3, unlocked: false,
    });
    expect(JSON.stringify(state)).toBe(before);
    expect(FAMILY_MILESTONES_DEMO.records[0].order).toBeUndefined();
  });

  it.each(["paid", "completed", "cancelled"])("actual %s history suppresses sample progress", (status) => {
    const actual = order(status);
    const before = JSON.stringify(actual);
    const result = resolveFamilyMilestones({
      linked: true, travellerId: "lin", orders: [actual], isDemo: true,
    });
    expect(result.source).toBe("orders");
    expect(result.completed).toBe(status === "completed" ? 1 : 0);
    expect(result.unlocked).toBe(false);
    expect(JSON.stringify(actual)).toBe(before);
  });

  it("uses immutable order itinerary values and all completed order history", () => {
    const orders = [order("completed", "one"), order("completed", "two"), order("completed", "three")];
    orders[0].flight.departure = "2025-08-03T09:30:00+08:00";
    orders[0].flight.flightNo = "CX999";
    const result = resolveFamilyMilestones({
      linked: true, travellerId: "lin", orders, isDemo: false,
    });
    expect(result).toMatchObject({ source: "orders", completed: 3, unlocked: true });
    expect(result.moves[0]).toMatchObject({ date: orders[0].flight.departure, flightNo: "CX999", order: orders[0] });
  });

  it("never displays real order progress while unlinked, including cancelled history", () => {
    for (const status of ["completed", "cancelled"]) {
      expect(resolveFamilyMilestones({
        linked: false, travellerId: "lin", orders: [order(status)], isDemo: true,
      })).toMatchObject({ source: "unlinked", completed: 0, unlocked: false });
    }
  });

  it("does not seed non-demo bookings, disabled samples or another member’s order history", () => {
    expect(resolveFamilyMilestones({
      linked: false, travellerId: "lin", orders: [], isDemo: false,
    })).toMatchObject({ source: "unlinked", completed: 0, unlocked: false });
    expect(resolveFamilyMilestones({
      linked: true, travellerId: "lin", orders: [], isDemo: true, demoEnabled: false,
    })).toMatchObject({ source: "orders", completed: 0, unlocked: false });
    expect(resolveFamilyMilestones({
      linked: true, travellerId: "lin", orders: [order("completed", "other", "child")],
      isDemo: false,
    })).toMatchObject({ source: "orders", completed: 0, unlocked: false });
  });
});
