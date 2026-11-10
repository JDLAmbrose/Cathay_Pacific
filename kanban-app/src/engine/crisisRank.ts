import type { BoardHealth, HoldLoadView, HoldStatus } from "../types/kanban";

function crisisBand(status: HoldStatus): number {
  if (status === "OVER" || status === "CAUTION") {
    return 2;
  }
  if (status === "CARGO_UNK") {
    return 1;
  }
  return 0;
}

export function governingLoadRatio(load: Pick<HoldLoadView, "weightLoadRatio" | "volumeLoadRatio">): number {
  return Math.max(load.weightLoadRatio, load.volumeLoadRatio);
}

/** At-risk first, then sooner departure, then higher occupancy. */
export function compareCrisis(left: HoldLoadView, right: HoldLoadView): number {
  const bandDelta = crisisBand(right.status) - crisisBand(left.status);
  if (bandDelta !== 0) {
    return bandDelta;
  }
  if (left.hoursToDeparture !== right.hoursToDeparture) {
    return left.hoursToDeparture - right.hoursToDeparture;
  }
  const loadDelta = governingLoadRatio(right) - governingLoadRatio(left);
  if (loadDelta !== 0) {
    return loadDelta;
  }
  return left.flightId.localeCompare(right.flightId);
}

export function resolveBoardHealth(flights: readonly HoldLoadView[]): BoardHealth {
  const nearOver = flights.some((flight) => flight.status === "OVER" && flight.isNearDeparture);
  if (nearOver) {
    return "CRITICAL";
  }
  if (flights.some((flight) => flight.status === "OVER")) {
    return "STRESSED";
  }
  if (flights.some((flight) => flight.status === "CAUTION")) {
    return "WATCH";
  }
  return "CLEAR";
}
