import { AIRCRAFT_SPECS } from "../config/aircraftSpecs";
import {
  CARGO_KG_PER_M3,
  CAUTION_RATIO,
  LOAD_CUTOFF_HOURS,
  OVER_RATIO,
} from "../config/thresholds";
import type {
  AircraftCapacitySpec,
  AircraftModel,
  HoldLoadView,
  HoldStatus,
  PlumeBag,
  PlumeSummary,
  RawFlight,
  RawKanbanSnapshot,
} from "../types/kanban";
import { InvalidFlightDataError, UnknownAircraftError } from "./errors";
import { forecastPaxBaggage } from "./passengerForecast";

const AIRCRAFT_MODELS: ReadonlySet<string> = new Set<AircraftModel>([
  "A350-900",
  "A350-1000",
  "777-300ER",
]);

export function hoursUntilDeparture(depIso: string, asOfIso: string): number {
  return (Date.parse(depIso) - Date.parse(asOfIso)) / 3_600_000;
}

export function resolveCapacity(
  flight: RawFlight,
  specs: RawKanbanSnapshot["aircraftSpecs"] = AIRCRAFT_SPECS,
): AircraftCapacitySpec {
  if (!AIRCRAFT_MODELS.has(flight.aircraft)) {
    throw new UnknownAircraftError(`Unknown aircraft model: ${flight.aircraft}`);
  }
  const spec = specs[flight.aircraft];
  const capacity: AircraftCapacitySpec = flight.capOverride
    ? { capKg: flight.capOverride.capKg, capM3: flight.capOverride.capM3, seats: spec.seats }
    : spec;
  if (capacity.capKg <= 0 || capacity.capM3 <= 0) {
    throw new InvalidFlightDataError(
      `capacityKg must be > 0, got ${capacity.capKg} kg / ${capacity.capM3} m³`,
    );
  }
  return capacity;
}

export function resolveCargoVolume(cargoKg: number | null, cargoM3: number | null): number | null {
  if (cargoKg === null) {
    return null;
  }
  if (cargoKg < 0) {
    throw new InvalidFlightDataError(`cargoKg must be >= 0, got ${cargoKg}`);
  }
  if (cargoM3 != null) {
    if (cargoM3 < 0) {
      throw new InvalidFlightDataError(`cargoM3 must be >= 0, got ${cargoM3}`);
    }
    return cargoM3;
  }
  return cargoKg / CARGO_KG_PER_M3;
}

export function summarizePlume(
  bags: readonly PlumeBag[],
  isPastLoadCutoff: boolean,
): PlumeSummary {
  let declaredKg = 0;
  let declaredM3 = 0;
  let onFlightKg = 0;
  let onFlightM3 = 0;
  let onFlightPieceCount = 0;
  let arrivedKg = 0;
  let arrivedM3 = 0;
  let arrivedPieceCount = 0;
  const deferrableBags: PlumeBag[] = [];

  for (const bag of bags) {
    if (bag.kg < 0 || bag.m3 < 0) {
      throw new InvalidFlightDataError(
        `bag ${bag.bagId} has negative mass or volume (${bag.kg} kg, ${bag.m3} m³)`,
      );
    }
    declaredKg += bag.kg;
    declaredM3 += bag.m3;
    if (bag.state === "arrived") {
      arrivedKg += bag.kg;
      arrivedM3 += bag.m3;
      arrivedPieceCount += 1;
      continue;
    }
    onFlightKg += bag.kg;
    onFlightM3 += bag.m3;
    onFlightPieceCount += 1;
    if (bag.mode === "cargo" && bag.state === "staged" && !isPastLoadCutoff) {
      deferrableBags.push(bag);
    }
  }

  return {
    declaredKg,
    declaredM3,
    declaredPieceCount: bags.length,
    onFlightKg,
    onFlightM3,
    onFlightPieceCount,
    arrivedKg,
    arrivedM3,
    arrivedPieceCount,
    deferrableKg: deferrableBags.reduce((sum, bag) => sum + bag.kg, 0),
    deferrableM3: deferrableBags.reduce((sum, bag) => sum + bag.m3, 0),
    deferrablePieceCount: deferrableBags.length,
    deferrableBags,
  };
}

function resolveStatus(weightLoadRatio: number, volumeLoadRatio: number): HoldStatus {
  const governingRatio = Math.max(weightLoadRatio, volumeLoadRatio);
  if (governingRatio >= OVER_RATIO) {
    return "OVER";
  }
  if (governingRatio >= CAUTION_RATIO) {
    return "CAUTION";
  }
  return "NORMAL";
}

export function calculateHoldLoad(
  flight: RawFlight,
  asOf: string,
  nearHours: number,
  specs: RawKanbanSnapshot["aircraftSpecs"] = AIRCRAFT_SPECS,
): HoldLoadView {
  const capacity = resolveCapacity(flight, specs);
  if (flight.seats < flight.plumePax) {
    throw new InvalidFlightDataError(
      `seats (${flight.seats}) must be >= plumePax (${flight.plumePax}) on ${flight.id}`,
    );
  }

  const hoursToDeparture = hoursUntilDeparture(flight.dep, asOf);
  const isPastLoadCutoff = hoursToDeparture <= LOAD_CUTOFF_HOURS;
  const pax = forecastPaxBaggage({ seats: flight.seats, plumePax: flight.plumePax });
  const plume = summarizePlume(flight.plumeBags, isPastLoadCutoff);
  const commercialCargoM3 = resolveCargoVolume(flight.cargoKg, flight.cargoM3);
  const baggageKg = pax.kg + plume.onFlightKg;
  const baggageM3 = pax.m3 + plume.onFlightM3;
  const cargoKg = flight.cargoKg;
  const isCargoUnknown = cargoKg === null;
  const totalKg = cargoKg === null ? null : cargoKg + baggageKg;
  const totalM3 = isCargoUnknown || commercialCargoM3 === null ? null : commercialCargoM3 + baggageM3;
  const weightLoadRatio = isCargoUnknown
    ? baggageKg / capacity.capKg
    : (totalKg as number) / capacity.capKg;
  const volumeLoadRatio = isCargoUnknown
    ? baggageM3 / capacity.capM3
    : (totalM3 as number) / capacity.capM3;
  const status: HoldStatus = isCargoUnknown
    ? "CARGO_UNK"
    : resolveStatus(weightLoadRatio, volumeLoadRatio);

  return {
    flightId: flight.id,
    sector: flight.sector,
    dep: flight.dep,
    aircraft: flight.aircraft,
    seats: flight.seats,
    plumePax: flight.plumePax,
    capacityKg: capacity.capKg,
    capacityM3: capacity.capM3,
    commercialCargoKg: flight.cargoKg,
    commercialCargoM3,
    estimatedPaxBaggageKg: pax.kg,
    estimatedPaxBaggageM3: pax.m3,
    plumeOnFlightKg: plume.onFlightKg,
    plumeOnFlightM3: plume.onFlightM3,
    plumeArrivedKg: plume.arrivedKg,
    plumeArrivedM3: plume.arrivedM3,
    plumeDeclaredKg: plume.declaredKg,
    plumePieceCount: plume.declaredPieceCount,
    plumeOnFlightPieceCount: plume.onFlightPieceCount,
    plumeArrivedPieceCount: plume.arrivedPieceCount,
    plumeDeferrableKg: plume.deferrableKg,
    plumeDeferrablePieceCount: plume.deferrablePieceCount,
    totalKg,
    totalM3,
    baggageKg,
    baggageM3,
    weightLoadRatio,
    volumeLoadRatio,
    hasVolumeBottleneck: volumeLoadRatio > weightLoadRatio,
    status,
    deficitKg: isCargoUnknown ? 0 : Math.max(0, (totalKg as number) - capacity.capKg),
    plumeShare: plume.onFlightKg / capacity.capKg,
    hoursToDeparture,
    isPastLoadCutoff,
    isNearDeparture: hoursToDeparture <= nearHours,
  };
}
