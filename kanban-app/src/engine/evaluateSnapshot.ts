import { DEFAULT_SECTOR, listBoardSectors } from "../config/sectors";
import type {
  ActionQueueItem,
  HoldLoadView,
  KpiSummary,
  RawKanbanSnapshot,
  SnapshotViewModel,
} from "../types/kanban";
import { compareCrisis, resolveBoardHealth } from "./crisisRank";
import { buildLoadMap, planDeferral } from "./deferralPlan";

function buildKpi(flights: readonly HoldLoadView[], totalDeferKg: number): KpiSummary {
  const overCount = flights.filter((flight) => flight.status === "OVER").length;
  const cautionCount = flights.filter((flight) => flight.status === "CAUTION").length;
  const normalCount = flights.filter((flight) => flight.status === "NORMAL").length;
  const cargoUnknownCount = flights.filter((flight) => flight.status === "CARGO_UNK").length;
  const totalDeficitKg = flights.reduce((sum, flight) => sum + flight.deficitKg, 0);
  const plumeOnFlightKg = flights.reduce((sum, flight) => sum + flight.plumeOnFlightKg, 0);
  const totalCapacityKg = flights.reduce((sum, flight) => sum + flight.capacityKg, 0);
  const known = flights.filter((flight) => flight.totalKg != null);
  const knownOccupiedKg = known.reduce((sum, flight) => sum + (flight.totalKg as number), 0);
  const knownCapacityKg = known.reduce((sum, flight) => sum + flight.capacityKg, 0);
  return {
    flightCount: flights.length,
    cargoUnknownCount,
    overCount,
    cautionCount,
    normalCount,
    totalDeficitKg,
    totalDeferKg,
    overFlightCount: overCount,
    plumeShareRatio: totalCapacityKg === 0 ? 0 : plumeOnFlightKg / totalCapacityKg,
    plumeOnFlightKg,
    totalCapacityKg,
    knownOccupiedKg,
    knownCapacityKg,
    fleetLoadRatio: knownCapacityKg === 0 ? 0 : knownOccupiedKg / knownCapacityKg,
    health: resolveBoardHealth(flights),
  };
}

function isActionable(flight: HoldLoadView): boolean {
  if (flight.status === "OVER") {
    return true;
  }
  return flight.status === "CAUTION" && flight.isNearDeparture;
}

export function evaluateSnapshot(
  snapshot: RawKanbanSnapshot,
  asOf: string = snapshot.asOf,
  sector: string = snapshot.sector || DEFAULT_SECTOR,
): SnapshotViewModel {
  const loadsById = buildLoadMap(snapshot, asOf);
  const flights = snapshot.flights.map((flight) => loadsById.get(flight.id) as HoldLoadView);
  const deferralPlans: SnapshotViewModel["deferralPlans"] = {};

  for (const flight of snapshot.flights) {
    deferralPlans[flight.id] = planDeferral(flight, snapshot, loadsById);
  }

  const visible = flights.filter((flight) => flight.sector === sector);
  const rankedFlights = [...(visible.length > 0 ? visible : flights)].sort(compareCrisis);
  const actionQueue: ActionQueueItem[] = rankedFlights
    .filter(isActionable)
    .map((flight) => {
      const plan = deferralPlans[flight.flightId];
      const targetFlightId =
        plan.candidates.find((candidate) => candidate.allocatedKg > 0)?.flightId ?? null;
      return {
        flightId: flight.flightId,
        status: flight.status,
        weightLoadRatio: flight.weightLoadRatio,
        hoursToDeparture: flight.hoursToDeparture,
        deficitKg: plan.deficitKg,
        deferKg: plan.deferKg,
        residualKg: plan.residualKg,
        targetFlightId,
        assessment: plan.assessment,
      };
    });

  const totalDeferKg = rankedFlights.reduce(
    (sum, flight) => sum + deferralPlans[flight.flightId].deferKg,
    0,
  );

  return {
    asOf,
    sector,
    availableSectors: listBoardSectors(snapshot.flights.map((flight) => flight.sector)),
    windowDays: snapshot.windowDays,
    nearHours: snapshot.nearHours,
    flights: rankedFlights,
    deferralPlans,
    actionQueue,
    kpi: buildKpi(rankedFlights, totalDeferKg),
  };
}
