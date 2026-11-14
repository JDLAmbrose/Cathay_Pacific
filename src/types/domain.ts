export type Locale = "zh-Hant" | "en" | "fr" | "es" | "ar";
export type Page =
  | "home"
  | "passenger"
  | "info"
  | "baggage"
  | "pricing"
  | "checkout"
  | "agent"
  | "journey"
  | "family"
  | "benefits"
  | "ops";
export type View = Page | "book";
export type Route = { page: Page; helper: boolean };

export type Bag = {
  id: string;
  name: string;
  category: string;
  categories?: string[];
  weight: number | null;
  l: number | null;
  w: number | null;
  h: number | null;
  mode: string;
  carriage?: string;
  service: boolean;
  review: boolean;
};
export type Draft = { items: Bag[]; zero: boolean; countUnknown: boolean };
export type Declaration = Draft & {
  version: number;
  legId: string;
  status: string;
  updatedAt: string;
};
export type Allowance = { pieces: number; kgPerPiece: number };
export type Flight = {
  bookingId: string;
  legId: string;
  flightNo: string;
  departure: string;
  origin: string;
  destination: string;
  terminal: string;
  baggageAllowance?: {
    bookingId: string;
    travellers: Record<string, Allowance>;
  };
  originCountry?: string;
  destinationCountry?: string;
};

export type Quote = {
  valid: boolean;
  error?: string;
  pricingVersion?: number;
  transport?: string;
  serviceFee?: number;
  priority?: number;
  extraFee?: number;
  cargoFee?: number;
  cargoUnits?: number;
  chargeableWeight?: number;
  total?: number;
  miles?: number;
  earn?: number;
  count?: number;
  weight?: number;
  signature?: string;
  plan?: {
    allowance: Allowance | null;
    items: Bag[];
    required: number;
    requested: number;
    purchased: number;
    quoted: number;
    missing: number;
    weight: number;
  };
};
export type PaymentSnapshot = {
  travellerId: string;
  flight: Flight;
  declaration: Draft;
  quote: Quote;
  payment: string;
  extraPieces: number;
  allowance: Allowance | null;
  contact: string;
  phone: string;
  pickup: string;
  pickupAddress: string;
  destination: string;
  recipient: string;
  partner: string;
  pickupPartner: string;
  recipientPhone: string;
  transport: string;
  region: string;
  itemIds: string[];
};
export type Order = PaymentSnapshot & {
  id: string;
  status: string;
  earned: boolean;
  refunded: boolean;
  createdAt: string;
  cancelledAt?: string;
};
export type HandoverEvent = {
  eventId: string;
  type: string;
  orderId: string;
  legId: string;
  itemIds: string[];
  confirmedAt: string;
  direction?: string;
};

export type FamilyPermissions = { booking: boolean; payment: boolean; progress: boolean };
export type FamilyConsent = {
  role: "student" | "guardian" | "family";
  confirmed: boolean;
  permissions?: FamilyPermissions;
};
export type FamilyService = {
  studentId: string;
  initiatedBy: "student" | "family";
  permissions: FamilyPermissions;
  journey: { bookingId: string; legId: string };
  studentConfirmed?: boolean;
  confirmedBy?: "student" | "guardian";
  confirmedAt?: string;
  revokedAt?: string;
};
// A read-only mock of external membership results, without duplicating member identities.
export type MembershipSnapshot = {
  source: "demo";
  eligibility: Record<string, {
    serviceConsent: "self" | "guardian" | "unknown";
    guardianStatus: "linked" | "unknown" | "notApplicable";
    guardianMemberNo?: string;
    policy: string;
  }>;
};
export type FamilyLink = {
  method: string;
  memberNo: string;
  mobile: string;
  email: string;
  surname: string;
  givenName: string;
  relationship: string;
  status: string;
  shareProgress: boolean;
  service?: FamilyService;
  invitationId?: string;
  invitedAt: string | null;
  respondedAt: string | null;
  changeRequest?: { status: string; submittedAt: string } | null;
  progressRequested?: boolean;
  owner?: {
    name: string;
    tier: string;
    memberNo: string;
    mobile: string;
    email: string;
  };
};
export type HelperRequest = {
  contactId?: string;
  recipient: string;
  requestedAt: string;
  status?: string;
};
export type HelperTrip = {
  bookingId: string;
  legId: string;
  contactId: string;
  requests: HelperRequest[] | Record<string, HelperRequest>;
};
export type Message = {
  role: "user" | "assistant";
  text?: string;
  key?: string;
  mode?: string;
  tools?: string[];
  failed?: boolean;
  imageCount?: number;
};
export type AssistantAnswer = {
  kind: string;
  topic?: string;
  category?: string;
  route?: string;
  reason?: string;
  stale?: boolean;
  attributes?: string;
  energy?: string;
  retrievedAt: string;
  quote?: Quote;
  region?: string;
  deadline?: { deadline?: string };
  balance?: number;
  destination?: string;
  sourceIds: string[];
  advice?: { itemId: string; type: string } | null;
};
export type AssistantState = {
  route: string;
  itemId: string;
  quality: string;
  mode?: string;
  messages: Message[];
  pending: { type: string } | null;
  answer: AssistantAnswer | null;
  questionDraft?: string;
  stale: boolean;
};

export type OperationsState = {
  budget: number | null;
  spaceBudget: number | null;
  otherWeight: number | null;
  buffer: number | null;
  otherSpace: number | null;
  spaceBuffer: number | null;
  expired: boolean;
};

export type BookingState = {
  schema: number;
  view: View;
  step: number;
  large: boolean;
  travellerId: string;
  profile: string;
  family: boolean;
  region: string;
  clock: string;
  pickup: string;
  pickupAddress: string;
  pickupPartner: string;
  destinationAddress: string;
  contact: string;
  recipient: string;
  phone: string;
  recipientPhone: string;
  assistance: string;
  partner: string;
  transport: string;
  payment: string;
  agreed: boolean;
  milesBalance: number;
  frozenMiles: number;
  nextOrder: number;
  processing: boolean;
  forceFail: boolean;
  ops: OperationsState;
  flight: Flight;
  drafts: Record<string, Draft>;
  declarations: Record<string, Declaration>;
  orders: Order[];
  events: HandoverEvent[];
  agent: AssistantState;
  pendingPayment: PaymentSnapshot | null;
  lastSavedAt: string | null;
  extraBags: Record<string, number>;
  helper: Record<string, HelperTrip>;
  passengerLinks: Record<string, FamilyLink>;
  familyLink: FamilyLink;
  membership?: MembershipSnapshot;
  familyDemo?: {
    passengerId: string | null;
    travellerId: string;
    mode: "linked" | "unlinked";
    records: FamilyLink[];
  };
  familyAccess?: { linkId: string; studentId: string };
  familyMembers?: FamilyLink[];
  familyInvitationArchive?: { passengerId: string | null; link: FamilyLink }[];
  nextFamilyInvitation?: number;
  familyDemoUnlinked?: Record<string, boolean>;
  familyBookingProfiles?: Record<string, Partial<BookingState>>;
  routeLink?: {
    origin: string;
    destination: string;
    originCountry: string;
    destinationCountry: string;
  };
};

export type TrackingInput = {
  order: {
    id: string;
    legId: string;
    createdAt: string;
    status: string;
    carrier: string;
    itemIds: string[];
  };
  handoverEvents: Omit<HandoverEvent, "eventId" | "direction">[];
};
export type TrackingRecord =
  | { status: "pending" }
  | {
      status: "ready";
      trackingNumber: string;
      carrierName: string;
      trackingUrl?: string;
      demo?: boolean;
    };
export type AssistantInput = {
  messages: { role: string; content: string; images?: string[] }[];
  language: Locale;
  context: object;
};
export type AssistantReply = { reply: string; tools?: string[] };
export type AssistantProgress =
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "status"; stage: "thinking" | "reading_image" | "checking" | "tool"; tool?: string };
export interface DataSource {
  loadDemo(): BookingState;
  readBooking(): BookingState | null;
  saveBooking(state: BookingState): void;
  assistantStatus(signal?: AbortSignal): Promise<{ configured: boolean }>;
  askAssistant(
    input: AssistantInput,
    signal?: AbortSignal,
    onProgress?: (event: AssistantProgress) => void,
  ): Promise<AssistantReply>;
  lookupTracking(
    input: TrackingInput,
    signal?: AbortSignal,
  ): Promise<TrackingRecord>;
}
