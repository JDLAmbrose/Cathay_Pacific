import { CAUTION_RATIO } from "../config/thresholds";
import type {
  CandidateFlightView,
  CandidateRejectReason,
  DeferralAllocation,
  DeferralAssessment,
  DeferralPlan,
  HoldLoadView,
  PlumeBag,
  RawFlight,
  RawKanbanSnapshot,
} from "../types/kanban";
import { calculateHoldLoad, summarizePlume } from "./holdLoad";

export interface AcceptanceHeadroom {
  kg: number;
  m3: number;
  reason: CandidateRejectReason | null;
}

function milliseconds(iso: string): number {
  return Date.parse(iso);
}

function hktCalendarDay(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00+08:00`);
}

export function listCandidateFlights(
  origin: RawFlight,
  snapshot: RawKanbanSnapshot,
): RawFlight[] {
  const originDep = milliseconds(origin.dep);
  const windowEndDay =
    hktCalendarDay(origin.dep) + snapshot.windowDays * 24 * 60 * 60 * 1000;
  return [...snapshot.flights]
    .filter((flight) => {
      const dep = milliseconds(flight.dep);
      return (
        flight.id !== origin.id &&
        flight.sector === origin.sector &&
        dep > originDep &&
        hktCalendarDay(flight.dep) <= windowEndDay
      );
    })
    .sort((left, right) => milliseconds(left.dep) - milliseconds(right.dep));
}

export function acceptanceHeadroom(load: HoldLoadView): AcceptanceHeadroom {
  if (load.status === "CARGO_UNK" || load.totalKg === null || load.totalM3 === null) {
    return { kg: 0, m3: 0, reason: "CARGO_UNK" };
  }
  const kg = Math.max(0, CAUTION_RATIO * load.capacityKg - load.totalKg);
  const m3 = Math.max(0, CAUTION_RATIO * load.capacityM3 - load.totalM3);
  if (kg <= 0 && load.weightLoadRatio >= 1) {
    return { kg: 0, m3: 0, reason: "OVER" };
  }
  if (m3 <= 0 && load.hasVolumeBottleneck) {
    return { kg: 0, m3: 0, reason: "CAUTION_VOL" };
  }
  if (kg <= 0 || m3 <= 0) {
    return { kg: 0, m3: 0, reason: "INSUFFICIENT" };
  }
  return { kg, m3, reason: null };
}

function decideCandidate(load: HoldLoadView): CandidateFlightView {
  const headroom = acceptanceHeadroom(load);
  return {
    flightId: load.flightId,
    dep: load.dep,
    decision: headroom.reason === null ? "ACCEPT" : "NO_GO",
    reason: headroom.reason,
    acceptKg: headroom.kg,
    acceptM3: headroom.m3,
    allocatedKg: 0,
    allocatedPieceCount: 0,
    loadRatioBefore: load.weightLoadRatio,
    volumeLoadRatio: load.volumeLoadRatio,
    loadRatioAfter: null,
  };
}

function resolveAssessment(
  origin: HoldLoadView,
  deficitKg: number,
  deferKg: number,
): DeferralAssessment {
  if (origin.isNearDeparture) {
    return "MONITOR";
  }
  if (deferKg >= deficitKg && deficitKg > 0) {
    return "CLEAR";
  }
  if (deferKg > 0 && deferKg < deficitKg) {
    return "PARTIAL";
  }
  return "NO_GO";
}

export function planDeferral(
  origin: RawFlight,
  snapshot: RawKanbanSnapshot,
  loadsById: ReadonlyMap<string, HoldLoadView>,
): DeferralPlan {
  const originLoad = loadsById.get(origin.id);
  if (!originLoad) {
    throw new Error(`Hold load missing for ${origin.id}`);
  }

  const candidates = listCandidateFlights(origin, snapshot).map((flight) => {
    const load = loadsById.get(flight.id);
    if (!load) {
      throw new Error(`Hold load missing for candidate ${flight.id}`);
    }
    return { flight, view: decideCandidate(load), remainingKg: 0, remainingM3: 0 };
  });

  for (const candidate of candidates) {
    const headroom = acceptanceHeadroom(loadsById.get(candidate.flight.id) as HoldLoadView);
    candidate.remainingKg = headroom.kg;
    candidate.remainingM3 = headroom.m3;
  }

  const allocations: DeferralAllocation[] = [];
  const shouldDefer = !originLoad.isNearDeparture && originLoad.deficitKg > 0;
  const plume = summarizePlume(origin.plumeBags, originLoad.isPastLoadCutoff);
  const sortedBags: PlumeBag[] = shouldDefer
    ? [...plume.deferrableBags].sort((left, right) => right.kg - left.kg)
    : [];

  let deferredKg = 0;

  for (const bag of sortedBags) {
    if (deferredKg >= originLoad.deficitKg) {
      break;
    }
    const target = candidates.find(
      (candidate) =>
        candidate.view.decision === "ACCEPT" &&
        candidate.remainingKg >= bag.kg &&
        candidate.remainingM3 >= bag.m3,
    );
    if (!target) {
      continue;
    }
    allocations.push({
      bagId: bag.bagId,
      kg: bag.kg,
      m3: bag.m3,
      targetFlightId: target.flight.id,
    });
    target.remainingKg -= bag.kg;
    target.remainingM3 -= bag.m3;
    target.view.allocatedKg += bag.kg;
    target.view.allocatedPieceCount += 1;
    deferredKg += bag.kg;
  }

  for (const candidate of candidates) {
    if (candidate.view.allocatedKg > 0) {
      const load = loadsById.get(candidate.flight.id) as HoldLoadView;
      const totalAfter = (load.totalKg as number) + candidate.view.allocatedKg;
      candidate.view.loadRatioAfter = totalAfter / load.capacityKg;
    }
  }

  const loadRatioAfter =
    originLoad.totalKg === null
      ? originLoad.weightLoadRatio
      : (originLoad.totalKg - deferredKg) / originLoad.capacityKg;

  return {
    flightId: origin.id,
    assessment: resolveAssessment(originLoad, originLoad.deficitKg, deferredKg),
    deficitKg: originLoad.deficitKg,
    deferKg: deferredKg,
    residualKg: Math.max(0, originLoad.deficitKg - deferredKg),
    deferPieceCount: allocations.length,
    allocations,
    candidates: candidates.map((candidate) => candidate.view),
    loadRatioBefore: originLoad.weightLoadRatio,
    loadRatioAfter,
  };
}

export function buildLoadMap(
  snapshot: RawKanbanSnapshot,
  asOf: string,
): Map<string, HoldLoadView> {
  const loads = new Map<string, HoldLoadView>();
  for (const flight of snapshot.flights) {
    loads.set(
      flight.id,
      calculateHoldLoad(flight, asOf, snapshot.nearHours, snapshot.aircraftSpecs),
    );
  }
  return loads;
}
