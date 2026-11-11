import { isPersona } from "../config/audiences";
import { InvalidMemberSnapshotError } from "../engine/errors";
import { publicUrl } from "../../config/publicUrl";
import type {
  FamilyLinkRecord,
  FlightRecord,
  FunnelEventRecord,
  MemberRecord,
  MemberSnapshot,
  ServiceOrderRecord,
  TicketWeekRecord,
} from "../types";
import { isCorridor } from "../types";

const REQUIRED_KEYS = [
  "members",
  "funnel_events",
  "family_links",
  "service_orders",
  "ticket_increment_weekly",
  "flights",
  "meta",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(key: string): never {
  throw new InvalidMemberSnapshotError(key);
}

function required(record: Record<string, unknown>, key: string, where: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    fail(where ? `${where}.${key}` : key);
  }
  return record[key];
}

function stringValue(value: unknown, key: string): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(key);
  }
  return value;
}

function nullableString(value: unknown, key: string): string | null {
  if (value == null) {
    return null;
  }
  return stringValue(value, key);
}

function numberValue(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(key);
  }
  return value;
}

function booleanValue(value: unknown, key: string): boolean {
  if (typeof value !== "boolean") {
    fail(key);
  }
  return value;
}

function instantMs(value: string, key: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    fail(key);
  }
  return ms;
}

function nullableInstant(value: unknown, key: string): number | null {
  const text = nullableString(value, key);
  if (text == null) {
    return null;
  }
  return instantMs(text, key);
}

function arrayValue(value: unknown, key: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(key);
  }
  return value;
}

export function parseMemberSnapshot(raw: unknown): MemberSnapshot {
  if (!isRecord(raw)) {
    fail("meta");
  }
  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) {
      fail(key);
    }
  }
  const metaRaw = required(raw, "meta", "");
  if (!isRecord(metaRaw)) {
    fail("meta");
  }
  const meta = {
    dataClass: stringValue(required(metaRaw, "data_class", "meta"), "meta.data_class"),
    generatorSeed: numberValue(required(metaRaw, "generator_seed", "meta"), "meta.generator_seed"),
    costAssumptionLocked: booleanValue(
      required(metaRaw, "cost_assumption_locked", "meta"),
      "meta.cost_assumption_locked",
    ),
    tempCostRatio: numberValue(required(metaRaw, "temp_cost_ratio", "meta"), "meta.temp_cost_ratio"),
  };

  const memberRows = arrayValue(raw.members, "members");
  const memberIndex = new Map<string, number>();
  const members: MemberRecord[] = memberRows.map((row, index) => {
    if (!isRecord(row)) {
      fail("members");
    }
    const memberId = stringValue(required(row, "member_id", "members"), "members.member_id");
    const personaRaw = stringValue(required(row, "persona", "members"), "members.persona");
    if (!isPersona(personaRaw)) {
      fail("members.persona");
    }
    if (!Object.prototype.hasOwnProperty.call(row, "join_at") || !Object.prototype.hasOwnProperty.call(row, "tier_at_join")) {
      fail("members.join_at");
    }
    const changesRaw = arrayValue(required(row, "tier_changes", "members"), "members.tier_changes");
    const tierChanges = changesRaw.map((change) => {
      if (!isRecord(change)) {
        fail("members.tier_changes");
      }
      const changedAt = stringValue(required(change, "changed_at", "members.tier_changes"), "members.tier_changes.changed_at");
      return {
        changedAtMs: instantMs(changedAt, "members.tier_changes.changed_at"),
        tier: stringValue(required(change, "tier", "members.tier_changes"), "members.tier_changes.tier"),
      };
    });
    memberIndex.set(memberId, index);
    const joinAt = nullableString(row.join_at, "members.join_at");
    return {
      persona: personaRaw,
      joinAtMs: joinAt == null ? null : instantMs(joinAt, "members.join_at"),
      tierAtJoin: nullableString(row.tier_at_join, "members.tier_at_join"),
      tierChanges,
    };
  });

  const indexOf = (memberId: string, key: string): number => {
    const index = memberIndex.get(memberId);
    if (index == null) {
      fail(key);
    }
    return index;
  };

  const funnelEvents: FunnelEventRecord[] = arrayValue(raw.funnel_events, "funnel_events").map((row) => {
    if (!isRecord(row)) {
      fail("funnel_events");
    }
    const memberId = stringValue(required(row, "member_id", "funnel_events"), "funnel_events.member_id");
    const eventAt = stringValue(required(row, "event_at", "funnel_events"), "funnel_events.event_at");
    return {
      memberIndex: indexOf(memberId, "funnel_events.member_id"),
      eventType: stringValue(required(row, "event_type", "funnel_events"), "funnel_events.event_type"),
      eventAtMs: instantMs(eventAt, "funnel_events.event_at"),
    };
  });

  const familyLinks: FamilyLinkRecord[] = arrayValue(raw.family_links, "family_links").map((row) => {
    if (!isRecord(row)) {
      fail("family_links");
    }
    const inviteeId = stringValue(required(row, "invitee_id", "family_links"), "family_links.invitee_id");
    const invitedAt = stringValue(required(row, "invited_at", "family_links"), "family_links.invited_at");
    return {
      inviteeIndex: indexOf(inviteeId, "family_links.invitee_id"),
      invitedAtMs: instantMs(invitedAt, "family_links.invited_at"),
      acceptedAtMs: nullableInstant(required(row, "accepted_at", "family_links"), "family_links.accepted_at"),
      declinedAtMs: nullableInstant(required(row, "declined_at", "family_links"), "family_links.declined_at"),
      cancelledAtMs: nullableInstant(required(row, "cancelled_at", "family_links"), "family_links.cancelled_at"),
      authorizedAtMs: nullableInstant(required(row, "authorized_at", "family_links"), "family_links.authorized_at"),
      revokedAtMs: nullableInstant(required(row, "revoked_at", "family_links"), "family_links.revoked_at"),
    };
  });

  const serviceOrders: ServiceOrderRecord[] = arrayValue(raw.service_orders, "service_orders").map((row) => {
    if (!isRecord(row)) {
      fail("service_orders");
    }
    const lanes = required(row, "lanes", "service_orders");
    if (!isRecord(lanes)) {
      fail("service_orders.lanes");
    }
    const memberId = stringValue(required(row, "member_id", "service_orders"), "service_orders.member_id");
    const createdAt = stringValue(required(row, "created_at", "service_orders"), "service_orders.created_at");
    return {
      memberIndex: indexOf(memberId, "service_orders.member_id"),
      scheduleInstanceKey: stringValue(
        required(row, "schedule_instance_key", "service_orders"),
        "service_orders.schedule_instance_key",
      ),
      createdAtMs: instantMs(createdAt, "service_orders.created_at"),
      paidAtMs: nullableInstant(required(row, "paid_at", "service_orders"), "service_orders.paid_at"),
      revenueHkd: numberValue(required(row, "revenue_hkd", "service_orders"), "service_orders.revenue_hkd"),
      contributionProfitHkd: numberValue(
        required(row, "contribution_profit_hkd", "service_orders"),
        "service_orders.contribution_profit_hkd",
      ),
      pickupHkd: numberValue(required(lanes, "pickup_hkd", "service_orders.lanes"), "service_orders.lanes.pickup_hkd"),
      extraBagHkd: numberValue(
        required(lanes, "extra_bag_hkd", "service_orders.lanes"),
        "service_orders.lanes.extra_bag_hkd",
      ),
      cargoHkd: numberValue(required(lanes, "cargo_hkd", "service_orders.lanes"), "service_orders.lanes.cargo_hkd"),
      promoCode: nullableString(required(row, "promo_code", "service_orders"), "service_orders.promo_code"),
      promoFamily: stringValue(required(row, "promo_family", "service_orders"), "service_orders.promo_family"),
    };
  });

  const ticketIncrementWeekly: TicketWeekRecord[] = arrayValue(
    raw.ticket_increment_weekly,
    "ticket_increment_weekly",
  ).map((row) => {
    if (!isRecord(row)) {
      fail("ticket_increment_weekly");
    }
    const corridor = stringValue(required(row, "corridor", "ticket_increment_weekly"), "ticket_increment_weekly.corridor");
    const persona = stringValue(required(row, "persona", "ticket_increment_weekly"), "ticket_increment_weekly.persona");
    if (!isCorridor(corridor)) {
      fail("ticket_increment_weekly.corridor");
    }
    if (!isPersona(persona)) {
      fail("ticket_increment_weekly.persona");
    }
    return {
      weekStart: stringValue(required(row, "week_start", "ticket_increment_weekly"), "ticket_increment_weekly.week_start"),
      corridor,
      persona,
      incrementalRevenueHkd: numberValue(
        required(row, "incremental_revenue_hkd", "ticket_increment_weekly"),
        "ticket_increment_weekly.incremental_revenue_hkd",
      ),
    };
  });

  const flights: FlightRecord[] = arrayValue(raw.flights, "flights").map((row) => {
    if (!isRecord(row)) {
      fail("flights");
    }
    const sector = stringValue(required(row, "sector", "flights"), "flights.sector");
    if (!isCorridor(sector)) {
      fail("flights.sector");
    }
    return {
      scheduleInstanceKey: stringValue(
        required(row, "schedule_instance_key", "flights"),
        "flights.schedule_instance_key",
      ),
      sector,
    };
  });

  return {
    meta,
    members,
    funnelEvents,
    familyLinks,
    serviceOrders,
    ticketIncrementWeekly,
    flights,
  };
}

export async function loadMemberSnapshot(): Promise<MemberSnapshot> {
  const response = await fetch(publicUrl("data/member-snapshot.json"));
  if (!response.ok) {
    throw new InvalidMemberSnapshotError(`member-snapshot.json ${response.status}`);
  }
  const raw: unknown = await response.json();
  return parseMemberSnapshot(raw);
}
