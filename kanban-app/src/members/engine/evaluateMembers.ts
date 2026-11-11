import { matchesAudience, isBusinessPersona, isParentPersona, isStudentPersona } from "../config/audiences";
import { BOOKMARKS } from "../config/bookmarks";
import {
  BASE_TIERS,
  DIAMOND_EXEC_EFFECTIVE_AT,
  FAMILY_PROMO_CODES,
  LAG_BIN_EDGES_DAYS,
  OFFICIAL_PROMO_CODES,
} from "../config/presentation";
import type {
  AudienceJoin,
  Corridor,
  CorridorUsage,
  FamilyLinkStatus,
  FamilyView,
  IncrementSlice,
  LagBin,
  MemberBoardView,
  MemberFilter,
  MemberRecord,
  MemberSnapshot,
  Ratio,
  ServiceOrderRecord,
  TierName,
} from "../types";
import { isTierName } from "../types";
import { InvalidMemberSnapshotError } from "./errors";
import { FAMILY_STATUS_ORDER, linkStatus } from "./familyStatus";
import { addIsoDays, hktDateIso, hktDayStartMs, hktWeekStartMs } from "./hkt";
import { roundTo, toCents } from "./round";

const DEMO_ALIGNMENT_AT = "2026-11-10T09:30:00+08:00";
const CORRIDOR_ORDER: readonly Corridor[] = ["HKG-LHR"];

function ratio(numerator: number, denominator: number): Ratio {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : roundTo(numerator / denominator, 4),
  };
}

function sumMoney(values: number[]): number {
  const cents = values.reduce((total, value) => total + toCents(value), 0);
  return cents / 100;
}

function currentTier(member: MemberRecord, tMs: number, execEffectiveMs: number): TierName | null {
  if (member.joinAtMs == null || member.joinAtMs > tMs) {
    return null;
  }
  let tier = member.tierAtJoin;
  for (const change of member.tierChanges) {
    if (change.changedAtMs > tMs) {
      continue;
    }
    if (change.tier === "Diamond Exec" && tMs < execEffectiveMs) {
      continue;
    }
    tier = change.tier;
  }
  if (tier == null) {
    throw new InvalidMemberSnapshotError("tier_at_join");
  }
  if (!isTierName(tier)) {
    throw new InvalidMemberSnapshotError(`tier:${tier}`);
  }
  return tier;
}

function eventMembers(
  snapshot: MemberSnapshot,
  tMs: number,
  eventType: string,
  include: (member: MemberRecord) => boolean,
): number {
  const seen = new Set<number>();
  for (const event of snapshot.funnelEvents) {
    if (event.eventType !== eventType || event.eventAtMs > tMs) {
      continue;
    }
    const member = snapshot.members[event.memberIndex];
    if (!member || !include(member)) {
      continue;
    }
    seen.add(event.memberIndex);
  }
  return seen.size;
}

function audienceJoin(
  snapshot: MemberSnapshot,
  tMs: number,
  dayStart: number,
  weekStart: number,
  include: (member: MemberRecord) => boolean,
): AudienceJoin {
  let cumulative = 0;
  let today = 0;
  let thisWeek = 0;
  for (const member of snapshot.members) {
    if (!include(member) || member.joinAtMs == null || member.joinAtMs > tMs) {
      continue;
    }
    cumulative += 1;
    if (member.joinAtMs >= dayStart) {
      today += 1;
    }
    if (member.joinAtMs >= weekStart) {
      thisWeek += 1;
    }
  }
  const reach = eventMembers(snapshot, tMs, "reach", include);
  const complete = eventMembers(snapshot, tMs, "complete_join", include);
  return {
    cumulative,
    today,
    thisWeek,
    conversion: ratio(complete, reach),
  };
}

function emptySlice(): IncrementSlice {
  return { completedHkd: 0, weekToDateHkd: 0 };
}

function addSlice(slice: IncrementSlice, amount: number, weekComplete: boolean): void {
  if (weekComplete) {
    slice.completedHkd = sumMoney([slice.completedHkd, amount]);
  } else {
    slice.weekToDateHkd = sumMoney([slice.weekToDateHkd, amount]);
  }
}

function lagBins(lags: number[]): LagBin[] {
  const edges = LAG_BIN_EDGES_DAYS;
  const counts = edges.map(() => 0);
  for (const lag of lags) {
    let index = -1;
    for (let edge = 0; edge < edges.length - 1; edge += 1) {
      if (lag >= edges[edge] && lag < edges[edge + 1]) {
        index = edge;
        break;
      }
    }
    if (lag >= edges[edges.length - 1]) {
      index = edges.length - 1;
    }
    if (index >= 0) {
      counts[index] += 1;
    }
  }
  return edges.map((startDay, index) => ({
    startDay,
    endDay: index === edges.length - 1 ? null : edges[index + 1],
    count: counts[index],
  }));
}

function quantile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const raw = roundTo(p * (sorted.length - 1), 0);
  const index = Math.min(sorted.length - 1, Math.max(0, raw));
  return roundTo(sorted[index], 2);
}

export function evaluateMembers(
  snapshot: MemberSnapshot,
  tDemo: string,
  filter: MemberFilter,
): MemberBoardView {
  const tMs = Date.parse(tDemo);
  if (Number.isNaN(tMs)) {
    throw new InvalidMemberSnapshotError("t_demo");
  }
  const dayStart = hktDayStartMs(tMs);
  const weekStart = hktWeekStartMs(tMs);
  const tDate = hktDateIso(tMs);
  const execEffectiveMs = Date.parse(DIAMOND_EXEC_EFFECTIVE_AT);
  const inAudience = (member: MemberRecord) => matchesAudience(member.persona, filter.audience);

  const sectorBySchedule = new Map<string, Corridor>();
  for (const flight of snapshot.flights) {
    sectorBySchedule.set(flight.scheduleInstanceKey, flight.sector);
  }

  const paidOrders: ServiceOrderRecord[] = [];
  const hasOrder = new Set<number>();
  const hasPaid = new Set<number>();
  const firstPaidMs = new Map<number, number>();
  for (const order of snapshot.serviceOrders) {
    if (order.createdAtMs <= tMs) {
      hasOrder.add(order.memberIndex);
    }
    if (order.paidAtMs == null || order.paidAtMs > tMs) {
      continue;
    }
    paidOrders.push(order);
    hasPaid.add(order.memberIndex);
    const previous = firstPaidMs.get(order.memberIndex);
    if (previous == null || order.paidAtMs < previous) {
      firstPaidMs.set(order.memberIndex, order.paidAtMs);
    }
  }

  const membersByCorridor = new Map<Corridor, Set<number>>(
    CORRIDOR_ORDER.map((corridor) => [corridor, new Set<number>()]),
  );
  for (const order of paidOrders) {
    const sector = sectorBySchedule.get(order.scheduleInstanceKey);
    if (!sector) {
      throw new InvalidMemberSnapshotError("schedule_instance_key");
    }
    membersByCorridor.get(sector)?.add(order.memberIndex);
  }
  const paidMemberIndexes = new Set<number>();
  for (const indexes of membersByCorridor.values()) {
    for (const index of indexes) {
      paidMemberIndexes.add(index);
    }
  }

  const corridors: CorridorUsage[] = CORRIDOR_ORDER.map((corridor) => {
    const indexes = membersByCorridor.get(corridor) ?? new Set<number>();
    let students = 0;
    let parents = 0;
    let business = 0;
    for (const index of indexes) {
      const persona = snapshot.members[index]?.persona;
      if (!persona) {
        throw new InvalidMemberSnapshotError("members");
      }
      if (isStudentPersona(persona)) {
        students += 1;
      } else if (isParentPersona(persona)) {
        parents += 1;
      } else if (isBusinessPersona(persona)) {
        business += 1;
      }
    }
    return {
      corridor,
      activeMembers: indexes.size,
      students,
      parents,
      business,
    };
  });

  const revenueHkd = sumMoney(paidOrders.map((order) => order.revenueHkd));
  const contributionProfitHkd = sumMoney(paidOrders.map((order) => order.contributionProfitHkd));
  const revenue: MemberBoardView["revenue"] = {
    ignoresAudienceFilter: true,
    revenueHkd,
    contributionProfitHkd,
    paidOrders: paidOrders.length,
    averageRevenueHkd: paidOrders.length === 0 ? null : roundTo(revenueHkd / paidOrders.length, 2),
    averageProfitHkd: paidOrders.length === 0 ? null : roundTo(contributionProfitHkd / paidOrders.length, 2),
    pickupHkd: sumMoney(paidOrders.map((order) => order.pickupHkd)),
    extraBagHkd: sumMoney(paidOrders.map((order) => order.extraBagHkd)),
    cargoHkd: sumMoney(paidOrders.map((order) => order.cargoHkd)),
    costAssumptionLocked: snapshot.meta.costAssumptionLocked,
    tempCostRatio: snapshot.meta.tempCostRatio,
  };

  const joinFilter = (member: MemberRecord) => inAudience(member);
  const studentsFilter = (member: MemberRecord) => joinFilter(member) && isStudentPersona(member.persona);
  const parentsFilter = (member: MemberRecord) => joinFilter(member) && isParentPersona(member.persona);
  const businessFilter = (member: MemberRecord) => joinFilter(member) && isBusinessPersona(member.persona);
  const reach = eventMembers(snapshot, tMs, "reach", joinFilter);
  const startJoin = eventMembers(snapshot, tMs, "start_join", joinFilter);
  const completeJoin = eventMembers(snapshot, tMs, "complete_join", joinFilter);
  const headline = audienceJoin(snapshot, tMs, dayStart, weekStart, joinFilter);
  const sparkline = BOOKMARKS.map((bookmark) => {
    const atMs = Date.parse(bookmark.at);
    let cumulative = 0;
    for (const member of snapshot.members) {
      if (member.joinAtMs != null && member.joinAtMs <= atMs && joinFilter(member)) {
        cumulative += 1;
      }
    }
    return {
      bookmarkId: bookmark.id,
      at: bookmark.at,
      cumulative,
      isOnOrBeforeDemo: atMs <= tMs,
    };
  });

  const joinedIndexes: number[] = [];
  snapshot.members.forEach((member, index) => {
    if (member.joinAtMs != null && member.joinAtMs <= tMs && joinFilter(member)) {
      joinedIndexes.push(index);
    }
  });
  const paidAmongJoined = joinedIndexes.filter((index) => hasPaid.has(index)).length;
  const prepare = eventMembers(snapshot, tMs, "start_prepare", joinFilter);
  const checkout = eventMembers(snapshot, tMs, "reach_checkout", joinFilter);
  const payment = eventMembers(snapshot, tMs, "payment_success", joinFilter);

  const statusCounts = new Map<FamilyLinkStatus, number>(FAMILY_STATUS_ORDER.map((status) => [status, 0]));
  let studentPullLinks = 0;
  const studentInvitees = new Set<number>();
  let paidUnauthorized = 0;
  let authorizedUnpaid = 0;
  let pendingNotJoined = 0;
  for (const link of snapshot.familyLinks) {
    if (link.invitedAtMs > tMs) {
      continue;
    }
    const status = linkStatus(link, tMs);
    if (status === "not_yet_invited") {
      continue;
    }
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    const invitee = snapshot.members[link.inviteeIndex];
    if (!invitee) {
      throw new InvalidMemberSnapshotError("family_links");
    }
    const accepted = status === "authorized" || status === "linked_unauthorized";
    if (accepted && isStudentPersona(invitee.persona)) {
      studentPullLinks += 1;
      studentInvitees.add(link.inviteeIndex);
    }
    if (status === "linked_unauthorized" && hasPaid.has(link.inviteeIndex)) {
      paidUnauthorized += 1;
    }
    if (status === "authorized" && hasOrder.has(link.inviteeIndex) && !hasPaid.has(link.inviteeIndex)) {
      authorizedUnpaid += 1;
    }
    const notJoined = invitee.joinAtMs == null || invitee.joinAtMs > tMs;
    if (status === "pending" && notJoined) {
      pendingNotJoined += 1;
    }
  }
  const sent = FAMILY_STATUS_ORDER.reduce((total, status) => total + (statusCounts.get(status) ?? 0), 0);
  const authorized = statusCounts.get("authorized") ?? 0;
  const linkedUnauthorized = statusCounts.get("linked_unauthorized") ?? 0;
  const accepted = authorized + linkedUnauthorized;
  const family: FamilyView = {
    ignoresAudienceFilter: true,
    sent,
    accepted,
    linkRate: ratio(accepted, sent),
    successRate: ratio(authorized, accepted),
    authorizationAmongSent: ratio(authorized, sent),
    studentPull: ratio(studentPullLinks, studentInvitees.size),
    statuses: FAMILY_STATUS_ORDER.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    paidUnauthorized,
    authorizedUnpaid,
    pendingNotJoined,
  };

  const completed = emptySlice();
  const parents = emptySlice();
  const students = emptySlice();
  const business = emptySlice();
  for (const week of snapshot.ticketIncrementWeekly) {
    if (week.weekStart > tDate) {
      continue;
    }
    if (!matchesAudience(week.persona, filter.audience)) {
      continue;
    }
    if (filter.corridor !== "all" && week.corridor !== filter.corridor) {
      continue;
    }
    const weekComplete = addIsoDays(week.weekStart, 6) <= tDate;
    addSlice(completed, week.incrementalRevenueHkd, weekComplete);
    if (isParentPersona(week.persona)) {
      addSlice(parents, week.incrementalRevenueHkd, weekComplete);
    } else if (isStudentPersona(week.persona)) {
      addSlice(students, week.incrementalRevenueHkd, weekComplete);
    } else if (isBusinessPersona(week.persona)) {
      addSlice(business, week.incrementalRevenueHkd, weekComplete);
    }
  }

  const lags: number[] = [];
  for (const index of joinedIndexes) {
    const paidAt = firstPaidMs.get(index);
    const joinAt = snapshot.members[index]?.joinAtMs;
    if (paidAt == null || joinAt == null) {
      continue;
    }
    lags.push((paidAt - joinAt) / 86_400_000);
  }
  const sortedLags = [...lags].sort((left, right) => left - right);
  const p50Days = quantile(sortedLags, 0.5);
  const p90Days = quantile(sortedLags, 0.9);

  const tierCounts = new Map<TierName, number>();
  const tierUsed = new Map<TierName, number>();
  for (const index of joinedIndexes) {
    const member = snapshot.members[index];
    if (!member) {
      continue;
    }
    const tier = currentTier(member, tMs, execEffectiveMs);
    if (!tier) {
      continue;
    }
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
    if (hasPaid.has(index)) {
      tierUsed.set(tier, (tierUsed.get(tier) ?? 0) + 1);
    }
  }
  const tierNames: TierName[] = [...BASE_TIERS, "Diamond Exec"];
  const tiers = tierNames.map((tier) => {
    const count = tierCounts.get(tier) ?? 0;
    return {
      tier,
      count,
      usage: ratio(tierUsed.get(tier) ?? 0, count),
      notYetEffective: tier === "Diamond Exec" && tMs < execEffectiveMs,
    };
  });

  const familyCodeOrders = new Map<string, number>(FAMILY_PROMO_CODES.map((code) => [code, 0]));
  const officialCodeOrders = new Map<string, number>(OFFICIAL_PROMO_CODES.map((code) => [code, 0]));
  let familyRevenue = 0;
  let promoOrders = 0;
  for (const order of paidOrders) {
    if (order.promoCode == null || order.promoCode === "CXFAMILY") {
      continue;
    }
    promoOrders += 1;
    if (familyCodeOrders.has(order.promoCode)) {
      familyCodeOrders.set(order.promoCode, (familyCodeOrders.get(order.promoCode) ?? 0) + 1);
      familyRevenue = sumMoney([familyRevenue, order.revenueHkd]);
    } else if (officialCodeOrders.has(order.promoCode)) {
      officialCodeOrders.set(order.promoCode, (officialCodeOrders.get(order.promoCode) ?? 0) + 1);
    }
  }
  const familyOrders = FAMILY_PROMO_CODES.reduce((total, code) => total + (familyCodeOrders.get(code) ?? 0), 0);
  const officialOrders = OFFICIAL_PROMO_CODES.reduce((total, code) => total + (officialCodeOrders.get(code) ?? 0), 0);

  return {
    tDemo,
    audience: filter.audience,
    corridor: filter.corridor,
    map: {
      ignoresAudienceFilter: true,
      paidMembers: paidMemberIndexes.size,
      corridors,
    },
    revenue,
    join: {
      ignoresAudienceFilter: false,
      cumulative: headline.cumulative,
      today: headline.today,
      thisWeek: headline.thisWeek,
      conversion: ratio(completeJoin, reach),
      started: ratio(startJoin, reach),
      students: audienceJoin(snapshot, tMs, dayStart, weekStart, studentsFilter),
      parents: audienceJoin(snapshot, tMs, dayStart, weekStart, parentsFilter),
      business: audienceJoin(snapshot, tMs, dayStart, weekStart, businessFilter),
      reach,
      startJoin,
      completeJoin,
      sparkline,
    },
    service: {
      ignoresAudienceFilter: false,
      bookingConversion: ratio(paidAmongJoined, joinedIndexes.length),
      learnedThenPaid: ratio(payment, prepare),
      layers: [
        { step: "start_prepare", members: prepare },
        { step: "reach_checkout", members: checkout },
        { step: "payment_success", members: payment },
      ],
      dropoffs: [prepare - checkout, checkout - payment],
      marksDemoAlignment: tDemo === DEMO_ALIGNMENT_AT,
    },
    family,
    increment: {
      ignoresAudienceFilter: false,
      completedHkd: completed.completedHkd,
      weekToDateHkd: completed.weekToDateHkd,
      parents,
      students,
      business,
    },
    lag: {
      ignoresAudienceFilter: false,
      sampleCount: lags.length,
      p50Days,
      p90Days,
      minDays: sortedLags.length === 0 ? null : roundTo(sortedLags[0], 2),
      maxDays: sortedLags.length === 0 ? null : roundTo(sortedLags[sortedLags.length - 1], 2),
      bins: lagBins(lags),
    },
    tiers: {
      ignoresAudienceFilter: false,
      tiers,
    },
    promo: {
      ignoresAudienceFilter: true,
      usage: ratio(promoOrders, paidOrders.length),
      familyOrders,
      familyRevenueHkd: familyRevenue,
      familyCodes: FAMILY_PROMO_CODES.map((code) => ({ code, orders: familyCodeOrders.get(code) ?? 0 })),
      officialOrders,
      officialCodes: OFFICIAL_PROMO_CODES.map((code) => ({ code, orders: officialCodeOrders.get(code) ?? 0 })),
      roi: null,
      isCostAssumptionLocked: snapshot.meta.costAssumptionLocked,
    },
  };
}
