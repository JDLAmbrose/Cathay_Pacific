export type HoldStatus = "OVER" | "CAUTION" | "NORMAL" | "CARGO_UNK";
export type DeferralAssessment = "CLEAR" | "PARTIAL" | "NO_GO" | "MONITOR";
export type BagMode = "on_flight" | "cargo";
export type BagState = "staged" | "loaded" | "arrived";
export type AircraftModel = "A350-900" | "A350-1000" | "777-300ER";
export type LoadMetric = "weight" | "volume";
export type CandidateDecision = "ACCEPT" | "NO_GO";
export type CandidateRejectReason = "OVER" | "CARGO_UNK" | "CAUTION_VOL" | "INSUFFICIENT";
export type BoardHealth = "CRITICAL" | "STRESSED" | "WATCH" | "CLEAR";

export interface AircraftCapacitySpec {
  capKg: number;
  capM3: number;
  seats: number;
}

export interface CapacityOverride {
  capKg: number;
  capM3: number;
}

export interface PlumeBag {
  bagId: string;
  kg: number;
  m3: number;
  mode: BagMode;
  state: BagState;
}

export interface RawFlight {
  id: string;
  sector: string;
  dep: string;
  aircraft: AircraftModel;
  seats: number;
  capOverride: CapacityOverride | null;
  cargoKg: number | null;
  cargoM3: number | null;
  plumePax: number;
  plumeBags: PlumeBag[];
}

export interface RawKanbanSnapshot {
  asOf: string;
  sector: string;
  windowDays: number;
  nearHours: number;
  aircraftSpecs: Readonly<Record<AircraftModel, AircraftCapacitySpec>>;
  flights: RawFlight[];
}

export interface PaxBaggageForecast {
  kg: number;
  m3: number;
}

export interface PlumeSummary {
  declaredKg: number;
  declaredM3: number;
  declaredPieceCount: number;
  onFlightKg: number;
  onFlightM3: number;
  onFlightPieceCount: number;
  arrivedKg: number;
  arrivedM3: number;
  arrivedPieceCount: number;
  deferrableKg: number;
  deferrableM3: number;
  deferrablePieceCount: number;
  deferrableBags: PlumeBag[];
}

export interface HoldLoadView {
  flightId: string;
  sector: string;
  dep: string;
  aircraft: AircraftModel;
  seats: number;
  plumePax: number;
  capacityKg: number;
  capacityM3: number;
  commercialCargoKg: number | null;
  commercialCargoM3: number | null;
  estimatedPaxBaggageKg: number;
  estimatedPaxBaggageM3: number;
  plumeOnFlightKg: number;
  plumeOnFlightM3: number;
  plumeArrivedKg: number;
  plumeArrivedM3: number;
  plumeDeclaredKg: number;
  plumePieceCount: number;
  plumeOnFlightPieceCount: number;
  plumeArrivedPieceCount: number;
  plumeDeferrableKg: number;
  plumeDeferrablePieceCount: number;
  totalKg: number | null;
  totalM3: number | null;
  baggageKg: number;
  baggageM3: number;
  weightLoadRatio: number;
  volumeLoadRatio: number;
  hasVolumeBottleneck: boolean;
  status: HoldStatus;
  deficitKg: number;
  plumeShare: number;
  hoursToDeparture: number;
  isPastLoadCutoff: boolean;
  isNearDeparture: boolean;
}

export interface DeferralAllocation {
  bagId: string;
  kg: number;
  m3: number;
  targetFlightId: string;
}

export interface CandidateFlightView {
  flightId: string;
  dep: string;
  decision: CandidateDecision;
  reason: CandidateRejectReason | null;
  acceptKg: number;
  acceptM3: number;
  allocatedKg: number;
  allocatedPieceCount: number;
  loadRatioBefore: number;
  volumeLoadRatio: number;
  loadRatioAfter: number | null;
}

export interface DeferralPlan {
  flightId: string;
  assessment: DeferralAssessment;
  deficitKg: number;
  deferKg: number;
  residualKg: number;
  deferPieceCount: number;
  allocations: DeferralAllocation[];
  candidates: CandidateFlightView[];
  loadRatioBefore: number;
  loadRatioAfter: number;
}

export interface ActionQueueItem {
  flightId: string;
  status: HoldStatus;
  weightLoadRatio: number;
  hoursToDeparture: number;
  deficitKg: number;
  deferKg: number;
  residualKg: number;
  targetFlightId: string | null;
  assessment: DeferralAssessment;
}

export interface KpiSummary {
  flightCount: number;
  cargoUnknownCount: number;
  overCount: number;
  cautionCount: number;
  normalCount: number;
  totalDeficitKg: number;
  totalDeferKg: number;
  overFlightCount: number;
  plumeShareRatio: number;
  plumeOnFlightKg: number;
  totalCapacityKg: number;
  knownOccupiedKg: number;
  knownCapacityKg: number;
  fleetLoadRatio: number;
  health: BoardHealth;
}

export interface SnapshotViewModel {
  asOf: string;
  sector: string;
  availableSectors: string[];
  windowDays: number;
  nearHours: number;
  flights: HoldLoadView[];
  deferralPlans: Record<string, DeferralPlan>;
  actionQueue: ActionQueueItem[];
  kpi: KpiSummary;
}

export interface SnapshotQueryParams {
  sector?: string;
  asOf?: string;
  windowDays?: number;
  nearHours?: number;
}

export interface CapacityOverrideInput {
  capKg: number;
  capM3: number;
}

export type FeedbackEvent =
  | { type: "TIME_TICK"; asOf: string }
  | { type: "PLUME_DECLARED"; flightId: string; bag: PlumeBag }
  | { type: "BAG_ARRIVED_EARLY"; flightId: string; bagId: string }
  | { type: "CARGO_UPDATED"; flightId: string; cargoKg: number; cargoM3: number | null }
  | { type: "CAP_OVERRIDDEN"; flightId: string; override: CapacityOverrideInput };

export interface KanbanDataSource {
  fetchSnapshot(params: SnapshotQueryParams): Promise<RawKanbanSnapshot>;
  overrideFlightCapacity(flightId: string, override: CapacityOverrideInput): Promise<void>;
  subscribeFeedback(onEvent: (event: FeedbackEvent) => void): () => void;
}
