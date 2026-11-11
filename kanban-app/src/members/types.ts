export type BookmarkId = "A" | "B" | "C" | "D" | "P" | "E";

export type Persona = "student" | "parent" | "business";

export type AudienceFilter = "all" | "students" | "parents" | "business";

export type Corridor = "HKG-LHR";

export type FamilyLinkStatus =
  | "cancelled"
  | "declined"
  | "revoked"
  | "authorized"
  | "linked_unauthorized"
  | "pending";

export type TierName = "Green" | "Silver" | "Gold" | "Diamond" | "Diamond Exec";

export type Ratio = {
  rate: number | null;
  numerator: number;
  denominator: number;
};

export interface MemberFilter {
  audience: AudienceFilter;
  corridor: Corridor | "all";
}

export interface MemberMeta {
  dataClass: string;
  generatorSeed: number;
  costAssumptionLocked: boolean;
  tempCostRatio: number;
}

export interface MemberRecord {
  persona: Persona;
  joinAtMs: number | null;
  tierAtJoin: string | null;
  tierChanges: { changedAtMs: number; tier: string }[];
}

export interface FunnelEventRecord {
  memberIndex: number;
  eventType: string;
  eventAtMs: number;
}

export interface FamilyLinkRecord {
  inviteeIndex: number;
  invitedAtMs: number;
  acceptedAtMs: number | null;
  declinedAtMs: number | null;
  cancelledAtMs: number | null;
  authorizedAtMs: number | null;
  revokedAtMs: number | null;
}

export interface ServiceOrderRecord {
  memberIndex: number;
  scheduleInstanceKey: string;
  createdAtMs: number;
  paidAtMs: number | null;
  revenueHkd: number;
  contributionProfitHkd: number;
  pickupHkd: number;
  extraBagHkd: number;
  cargoHkd: number;
  promoCode: string | null;
  promoFamily: string;
}

export interface TicketWeekRecord {
  weekStart: string;
  corridor: Corridor;
  persona: Persona;
  incrementalRevenueHkd: number;
}

export interface FlightRecord {
  scheduleInstanceKey: string;
  sector: Corridor;
}

export interface MemberSnapshot {
  meta: MemberMeta;
  members: MemberRecord[];
  funnelEvents: FunnelEventRecord[];
  familyLinks: FamilyLinkRecord[];
  serviceOrders: ServiceOrderRecord[];
  ticketIncrementWeekly: TicketWeekRecord[];
  flights: FlightRecord[];
}

export interface CorridorUsage {
  corridor: Corridor;
  activeMembers: number;
  students: number;
  parents: number;
  business: number;
}

export interface MapView {
  ignoresAudienceFilter: true;
  paidMembers: number;
  corridors: CorridorUsage[];
}

export interface RevenueView {
  ignoresAudienceFilter: true;
  revenueHkd: number;
  contributionProfitHkd: number;
  paidOrders: number;
  averageRevenueHkd: number | null;
  averageProfitHkd: number | null;
  pickupHkd: number;
  extraBagHkd: number;
  cargoHkd: number;
  costAssumptionLocked: boolean;
  tempCostRatio: number;
}

export interface AudienceJoin {
  cumulative: number;
  today: number;
  thisWeek: number;
  conversion: Ratio;
}

export interface JoinSparkPoint {
  bookmarkId: BookmarkId;
  at: string;
  cumulative: number;
  isOnOrBeforeDemo: boolean;
}

export interface JoinView {
  ignoresAudienceFilter: false;
  cumulative: number;
  today: number;
  thisWeek: number;
  conversion: Ratio;
  started: Ratio;
  students: AudienceJoin;
  parents: AudienceJoin;
  business: AudienceJoin;
  reach: number;
  startJoin: number;
  completeJoin: number;
  sparkline: JoinSparkPoint[];
}

export interface ServiceLayer {
  step: "start_prepare" | "reach_checkout" | "payment_success";
  members: number;
}

export interface ServiceView {
  ignoresAudienceFilter: false;
  bookingConversion: Ratio;
  learnedThenPaid: Ratio;
  layers: ServiceLayer[];
  dropoffs: [number, number];
  marksDemoAlignment: boolean;
}

export interface FamilyStatusCount {
  status: FamilyLinkStatus;
  count: number;
}

export interface FamilyView {
  ignoresAudienceFilter: true;
  sent: number;
  accepted: number;
  linkRate: Ratio;
  successRate: Ratio;
  authorizationAmongSent: Ratio;
  studentPull: Ratio;
  statuses: FamilyStatusCount[];
  paidUnauthorized: number;
  authorizedUnpaid: number;
  pendingNotJoined: number;
}

export interface IncrementSlice {
  completedHkd: number;
  weekToDateHkd: number;
}

export interface IncrementView {
  ignoresAudienceFilter: false;
  completedHkd: number;
  weekToDateHkd: number;
  parents: IncrementSlice;
  students: IncrementSlice;
  business: IncrementSlice;
}

export interface LagBin {
  startDay: number;
  endDay: number | null;
  count: number;
}

export interface LagView {
  ignoresAudienceFilter: false;
  sampleCount: number;
  p50Days: number | null;
  p90Days: number | null;
  minDays: number | null;
  maxDays: number | null;
  bins: LagBin[];
}

export interface TierColumn {
  tier: TierName;
  count: number;
  usage: Ratio;
  notYetEffective: boolean;
}

export interface TierView {
  ignoresAudienceFilter: false;
  tiers: TierColumn[];
}

export interface PromoCodeCount {
  code: string;
  orders: number;
}

export interface PromoView {
  ignoresAudienceFilter: true;
  usage: Ratio;
  familyOrders: number;
  familyRevenueHkd: number;
  familyCodes: PromoCodeCount[];
  officialOrders: number;
  officialCodes: PromoCodeCount[];
  roi: null;
  isCostAssumptionLocked: boolean;
}

export interface MemberBoardView {
  tDemo: string;
  audience: AudienceFilter;
  corridor: Corridor | "all";
  map: MapView;
  revenue: RevenueView;
  join: JoinView;
  service: ServiceView;
  family: FamilyView;
  increment: IncrementView;
  lag: LagView;
  tiers: TierView;
  promo: PromoView;
}

export function isCorridor(value: string): value is Corridor {
  return value === "HKG-LHR";
}

export function isTierName(value: string): value is TierName {
  return (
    value === "Green" ||
    value === "Silver" ||
    value === "Gold" ||
    value === "Diamond" ||
    value === "Diamond Exec"
  );
}
