import type {
  AircraftCapacitySpec,
  AircraftModel,
  BagMode,
  BagState,
  PlumeBag,
  RawFlight,
  RawKanbanSnapshot,
} from "../types/kanban";
import { InvalidSnapshotError, UnknownAircraftError } from "../engine/errors";

const AIRCRAFT_MODELS: readonly AircraftModel[] = ["A350-900", "A350-1000", "777-300ER"];
const BAG_MODES: ReadonlySet<string> = new Set<BagMode>(["on_flight", "cargo"]);
const BAG_STATES: ReadonlySet<string> = new Set<BagState>(["staged", "loaded", "arrived"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidSnapshotError(`${label} must be a non-empty string`);
  }
  return value;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidSnapshotError(`${label} must be a finite number`);
  }
  return value;
}

function readNullableNumber(value: unknown, label: string): number | null {
  if (value === null) {
    return null;
  }
  return readNumber(value, label);
}

function parseSpec(value: unknown, model: AircraftModel): AircraftCapacitySpec {
  if (!isRecord(value)) {
    throw new InvalidSnapshotError(`${model} spec must be an object`);
  }
  return {
    capKg: readNumber(value.capKg, `${model}.capKg`),
    capM3: readNumber(value.capM3, `${model}.capM3`),
    seats: readNumber(value.seats, `${model}.seats`),
  };
}

function parseBag(value: unknown, flightId: string): PlumeBag {
  if (!isRecord(value)) {
    throw new InvalidSnapshotError(`${flightId} plumeBags entries must be objects`);
  }
  const bagId = readString(value.bagId, `${flightId} bagId`);
  const kg = readNumber(value.kg, `${bagId} kg`);
  const m3 = readNumber(value.m3, `${bagId} m3`);
  if (kg < 0 || m3 < 0) {
    throw new InvalidSnapshotError(`${bagId} kg and m3 must be >= 0`);
  }
  const mode = readString(value.mode, `${bagId} mode`);
  const state = readString(value.state, `${bagId} state`);
  if (!BAG_MODES.has(mode)) {
    throw new InvalidSnapshotError(`${bagId} has unknown mode ${mode}`);
  }
  if (!BAG_STATES.has(state)) {
    throw new InvalidSnapshotError(`${bagId} has unknown state ${state}`);
  }
  return {
    bagId,
    kg,
    m3,
    mode: mode as BagMode,
    state: state as BagState,
  };
}

function parseFlight(value: unknown): RawFlight {
  if (!isRecord(value)) {
    throw new InvalidSnapshotError("flight entries must be objects");
  }
  const id = readString(value.id, "flight.id");
  const aircraft = readString(value.aircraft, `${id} aircraft`);
  if (!AIRCRAFT_MODELS.includes(aircraft as AircraftModel)) {
    throw new UnknownAircraftError(`Unknown aircraft model: ${aircraft}`);
  }
  const seats = readNumber(value.seats, `${id} seats`);
  const plumePax = readNumber(value.plumePax, `${id} plumePax`);
  if (seats < 0 || plumePax < 0) {
    throw new InvalidSnapshotError(`${id} seats and plumePax must be >= 0`);
  }
  if (!Array.isArray(value.plumeBags)) {
    throw new InvalidSnapshotError(`${id} plumeBags must be an array`);
  }
  let capOverride: RawFlight["capOverride"] = null;
  if (value.capOverride !== null && value.capOverride !== undefined) {
    if (!isRecord(value.capOverride)) {
      throw new InvalidSnapshotError(`${id} capOverride must be an object or null`);
    }
    capOverride = {
      capKg: readNumber(value.capOverride.capKg, `${id} capOverride.capKg`),
      capM3: readNumber(value.capOverride.capM3, `${id} capOverride.capM3`),
    };
  }
  return {
    id,
    sector: readString(value.sector, `${id} sector`),
    dep: readString(value.dep, `${id} dep`),
    aircraft: aircraft as AircraftModel,
    seats,
    capOverride,
    cargoKg: readNullableNumber(value.cargoKg, `${id} cargoKg`),
    cargoM3: readNullableNumber(value.cargoM3, `${id} cargoM3`),
    plumePax,
    plumeBags: value.plumeBags.map((bag) => parseBag(bag, id)),
  };
}

export function parseKanbanSnapshot(value: unknown): RawKanbanSnapshot {
  if (!isRecord(value)) {
    throw new InvalidSnapshotError("snapshot must be an object");
  }
  if (!isRecord(value.aircraftSpecs)) {
    throw new InvalidSnapshotError("aircraftSpecs must be an object");
  }
  if (!Array.isArray(value.flights) || value.flights.length === 0) {
    throw new InvalidSnapshotError("flights must be a non-empty array");
  }
  const aircraftSpecs = {
    "A350-900": parseSpec(value.aircraftSpecs["A350-900"], "A350-900"),
    "A350-1000": parseSpec(value.aircraftSpecs["A350-1000"], "A350-1000"),
    "777-300ER": parseSpec(value.aircraftSpecs["777-300ER"], "777-300ER"),
  };
  const flights = value.flights.map(parseFlight);
  const ids = new Set(flights.map((flight) => flight.id));
  if (ids.size !== flights.length) {
    throw new InvalidSnapshotError("flight ids must be unique");
  }
  return {
    asOf: readString(value.asOf, "asOf"),
    sector: readString(value.sector, "sector"),
    windowDays: readNumber(value.windowDays, "windowDays"),
    nearHours: readNumber(value.nearHours, "nearHours"),
    aircraftSpecs,
    flights,
  };
}
