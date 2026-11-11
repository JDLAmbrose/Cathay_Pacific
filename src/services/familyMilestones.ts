import demo from "../config/demo.json";
import { FAMILY_MILESTONES_DEMO } from "../config/familyMilestones.demo";
import {
  FAMILY_MEMBER_ID,
  FAMILY_MILESTONE_TARGET,
  familyBenefitMember,
  familyTravellerId,
  state,
} from "../engine/booking";
import type { Order } from "../types/domain";

export type FamilyMilestoneRecord = {
  id: string;
  status: "completed" | "inProgress" | "notStarted" | "cancelled";
  eligible: boolean;
  date?: string;
  flightNo?: string;
  order?: Order;
};
export type FamilyMilestoneSource = "demo" | "orders" | "unlinked";
export type FamilyMilestoneMove = {
  id: string;
  key: "current" | "next" | "final";
  status: "counted" | "inProgress" | "notStarted" | "notBooked";
  eligible: boolean;
  date?: string;
  flightNo?: string;
  order?: Order;
};
export type FamilyMilestones = {
  source: FamilyMilestoneSource;
  target: number;
  completed: number;
  progress: number;
  unlocked: boolean;
  moves: FamilyMilestoneMove[];
};

// The proposed threshold remains the existing three completed eligible moves.
// Reward terms are still proposed; this derives presentation state, never a
// redeemable offer or a companion-fare code.
export function calculateFamilyMilestones(
  records: readonly FamilyMilestoneRecord[],
  { source, linked }: { source: FamilyMilestoneSource; linked: boolean },
): FamilyMilestones {
  const target = FAMILY_MILESTONE_TARGET;
  const unique = [...new Map(records.map((record) => [record.id, record])).values()];
  const eligible = linked
    ? unique.filter((record) => record.eligible && record.status !== "cancelled")
    : [];
  const counted = eligible.filter((record) => record.status === "completed");
  const pending = eligible.filter((record) => record.status !== "completed");
  const display = [...counted, ...pending].slice(0, target);
  const completed = Math.min(target, counted.length);
  const keys = ["current", "next", "final"] as const;
  return {
    source,
    target,
    completed,
    progress: completed / target,
    unlocked: linked && completed === target,
    moves: keys.map((key, index) => {
      const record = display[index];
      return {
        id: record?.id ?? `family-milestone-${index + 1}`,
        key,
        status: record?.status === "completed"
          ? "counted"
          : record?.status === "inProgress"
            ? "inProgress"
            : "notStarted",
        eligible: record?.eligible ?? false,
        ...(record?.date ? { date: record.date } : {}),
        ...(record?.flightNo ? { flightNo: record.flightNo } : {}),
        ...(record?.order ? { order: record.order } : {}),
      };
    }),
  };
}

export type FamilyMilestoneInput = {
  linked: boolean;
  travellerId: string | null;
  orders: readonly Order[];
  isDemo: boolean;
  demoEnabled?: boolean;
  demoRecords?: readonly FamilyMilestoneRecord[];
};

export function resolveFamilyMilestones({
  linked,
  travellerId,
  orders,
  isDemo,
  demoEnabled = FAMILY_MILESTONES_DEMO.enabled,
  demoRecords = FAMILY_MILESTONES_DEMO.records,
}: FamilyMilestoneInput): FamilyMilestones {
  const memberOrders = orders.filter((order) => order.travellerId === travellerId);
  // Even cancelled or incomplete actual history suppresses sample progress.
  if (isDemo && demoEnabled && memberOrders.length === 0) {
    // This sample represents a linked demo family, independent of real access.
    return calculateFamilyMilestones(demoRecords, { source: "demo", linked: true });
  }
  if (!linked) {
    return calculateFamilyMilestones([], { source: "unlinked", linked: false });
  }
  // Existing Orders are door-to-door service orders. As in the booking engine,
  // a completed order qualifies; no new membership or transport rules are added.
  const records: FamilyMilestoneRecord[] = memberOrders.map((order) => ({
    id: order.id,
    status: order.status === "completed"
      ? "completed"
      : order.status === "cancelled" ? "cancelled" : "inProgress",
    eligible: order.status !== "cancelled",
    date: order.flight?.departure,
    flightNo: order.flight?.flightNo,
    order,
  }));
  return calculateFamilyMilestones(records, { source: "orders", linked });
}

// Future API integration belongs here (or feed normalized API records into
// calculateFamilyMilestones). UI consumes only the returned view model.
export function getFamilyMilestones(): FamilyMilestones {
  const member = familyBenefitMember();
  return resolveFamilyMilestones({
    linked: !!member,
    travellerId: member ? familyTravellerId(member) : FAMILY_MEMBER_ID,
    orders: state.orders,
    isDemo: state.flight.bookingId === demo.flight.bookingId,
  });
}
