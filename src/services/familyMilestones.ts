import demo from "../config/demo.json";
import { FAMILY_MILESTONES_DEMO, FAMILY_VISIT_PROMO_DEMO } from "../config/familyMilestones.demo";
import {
  FAMILY_MEMBER_ID,
  FAMILY_MILESTONE_TARGET,
  familyStudentId,
  familyDemoUnlinked,
  parentFamilyRecords,
  familyVisibleRecords,
  familyServiceEstablished,
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
  const byId = new Map<string, FamilyMilestoneRecord>();
  for (const record of records) {
    if (!record.id.trim()) continue;
    const previous = byId.get(record.id);
    // A cancelled/refunded copy takes precedence over stale completed copies.
    // Multiple family links or repeated snapshots never create extra moves.
    if (!previous || (previous.eligible && previous.status !== "cancelled" &&
        (!record.eligible || record.status === "cancelled" || record.status === "completed"))) {
      byId.set(record.id, record);
    }
  }
  const unique = [...byId.values()];
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
  // Only completed door-to-door service orders qualify. Refunds disqualify a
  // stale completed snapshot even if its status has not yet been reconciled.
  const records: FamilyMilestoneRecord[] = memberOrders.map((order) => ({
    id: order.id,
    status: order.status === "completed"
      ? "completed"
      : order.status === "cancelled" ? "cancelled" : "inProgress",
    eligible: order.status !== "cancelled" && !order.refunded && order.itemIds.length > 0,
    date: order.flight?.departure,
    flightNo: order.flight?.flightNo,
    order,
  }));
  return calculateFamilyMilestones(records, { source: "orders", linked });
}

// Future API integration belongs here (or feed normalized API records into
// calculateFamilyMilestones). UI consumes only the returned view model.
function milestoneFamilyMember() {
  // Both invitation directions refer to the same confirmed service relation.
  // Only relationships belonging to the current family viewer are considered.
  const members = familyVisibleRecords(false).filter(familyServiceEstablished);
  return members.find((link) => familyStudentId(link) === FAMILY_MEMBER_ID) ?? members[0] ?? null;
}

export function getFamilyMilestones(): FamilyMilestones {
  const member = milestoneFamilyMember();
  const studentId = member ? familyStudentId(member) : FAMILY_MEMBER_ID;
  const sample = FAMILY_MILESTONES_DEMO.family;
  const hasSavedRelationship = parentFamilyRecords().some((link) => link.status !== "draft") ||
    Object.values(state.passengerLinks).some((link) => link.status !== "draft");
  // Both cards may use the existing linked Demo family, but it cannot override
  // an explicit invitation, revoked/unlinked state, or another student's data.
  const demoEnabled = FAMILY_MILESTONES_DEMO.enabled && sample.linked && sample.studentId === studentId &&
    !familyDemoUnlinked(studentId) && (!hasSavedRelationship || !!member);
  return resolveFamilyMilestones({
    linked: !!member,
    travellerId: studentId,
    orders: state.orders,
    isDemo: state.flight.bookingId === demo.flight.bookingId,
    demoEnabled,
  });
}

export type FamilyVisitOffer = {
  eligible: boolean;
  code: string | null;
  source: FamilyMilestoneSource;
};

export function getFamilyVisitOffer(): FamilyVisitOffer {
  // Use exactly the same completed, non-refunded, deduplicated order result as
  // the left card; a newer unfinished order must not hide a completed move.
  const milestones = getFamilyMilestones();
  const member = milestoneFamilyMember();
  const studentId = member ? familyStudentId(member) : FAMILY_MEMBER_ID;
  const sample = FAMILY_MILESTONES_DEMO.family;
  const demoFamily = milestones.source === "demo";
  const relationship = member?.relationship ?? (demoFamily ? sample.relationship : null);
  const eligible = !!(member || demoFamily) && milestones.completed > 0 &&
    ["parent", "guardian"].includes(relationship);
  const issued = FAMILY_VISIT_PROMO_DEMO.issued;
  return {
    eligible,
    source: milestones.source,
    // A configured Demo code is visible only for its eligible family. A move,
    // a page render or an occasion switch can never create an issued code.
    code: eligible && issued?.studentId === studentId ? issued.code.trim() || null : null,
  };
}
