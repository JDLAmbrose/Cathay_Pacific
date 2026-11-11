import { language, t } from "../services/i18n";
import { dataSource } from "../services/dataSource";
import { requestAssistantReply } from "../services/query";
import { closeModal, go, modal, render, toast } from "../services/runtime";
import type {
  BookingState,
  Draft,
  FamilyLink,
  PaymentSnapshot,
  Quote,
  View,
  Bag,
} from "../types/domain";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const fmt = (n, d = 0) =>
  Number(n).toLocaleString(language === "zh-Hant" ? "zh-HK" : language, {
    maximumFractionDigits: d,
  });
const money = (n) => "HKD " + fmt(n / 100, 2),
  iso = (t) => new Date(t).toISOString();
const hk = (date) =>
  new Intl.DateTimeFormat(language === "zh-Hant" ? "zh-HK" : language, {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
const REGIONS = {
  hk: { hours: 24, pickupLead: 12, factor: 1 },
  gba: { hours: 48, pickupLead: 24, factor: 1.4 },
  mainland: { hours: 120, pickupLead: 72, factor: 1.8 },
};
const PEOPLE = [
  { id: "lin", name: "Lin Chen", type: "student" },
  { id: "child", name: "Alex Chen", type: "child" },
];
// Demo ticket entitlements and tariffs, independent of live Cathay fare rules.
const DEMO_BAGGAGE_ALLOWANCE = {
  bookingId: "PL-CX257-DEMO",
  travellers: {
    lin: { pieces: 2, kgPerPiece: 23 },
    child: { pieces: 1, kgPerPiece: 23 },
  },
};
const SERVICE_RATES = { version: 3, base: 120000 };
const TRANSPORT_RATES = {
  extraPiece: 60000,
  cargoUnit: 25000,
  cargoUnitKg: 23,
  volumeDivisor: 6000,
};
// Normalize legacy partner names in saved demo orders without changing their charges.
function partnerName(value) {
  return String(value ?? "").replace(/\bDPD\s+UK\b/g, "EBC UK");
}
function migratePartnerNames() {
  if (typeof state.partner === "string")
    state.partner = partnerName(state.partner);
  for (const order of state.orders || []) {
    if (typeof order.partner === "string")
      order.partner = partnerName(order.partner);
    if (typeof order.quote?.signature === "string")
      order.quote.signature = partnerName(order.quote.signature);
  }
  for (const event of state.events || [])
    if (typeof event.direction === "string")
      event.direction = partnerName(event.direction);
}
function migratePricingState() {
  migratePartnerNames();
  state.extraBags ??= {};
  if (
    state.agent?.answer?.kind === "service" &&
    state.agent.answer.quote?.valid &&
    state.agent.answer.quote.pricingVersion !== SERVICE_RATES.version
  ) {
    state.agent.stale = true;
    state.agent.answer.stale = true;
  }
  if (
    state.flight?.bookingId === DEMO_BAGGAGE_ALLOWANCE.bookingId &&
    !Object.prototype.hasOwnProperty.call(state.flight, "baggageAllowance")
  )
    state.flight.baggageAllowance = clone(DEMO_BAGGAGE_ALLOWANCE);
}
function ticketAllowance(travellerId = state.travellerId) {
  const data = state.flight.baggageAllowance,
    a = data?.travellers?.[travellerId];
  return data?.bookingId === state.flight.bookingId &&
    a &&
    Number.isInteger(a.pieces) &&
    a.pieces >= 0 &&
    Number.isFinite(a.kgPerPiece) &&
    a.kgPerPiece > 0
    ? clone(a)
    : null;
}
const BAG_CATEGORIES = [
  "clothes",
  "books",
  "electronics",
  "battery",
  "liquids",
  "medicine",
  "food",
  "fragile",
  "valuables",
  "sports",
  "equipment",
  "other",
];
// Country is the only location inferred for collection/delivery. Cities stay in the itinerary.
const AIRPORT_COUNTRIES = {
  HKG: "CN",
  MFM: "CN",
  SZX: "CN",
  PEK: "CN",
  PKX: "CN",
  PVG: "CN",
  SHA: "CN",
  CAN: "CN",
  CTU: "CN",
  TFU: "CN",
  LHR: "GB",
  LGW: "GB",
  MAN: "GB",
  MEL: "AU",
  SYD: "AU",
  CTS: "JP",
  HND: "JP",
  NRT: "JP",
  DEL: "IN",
  BOM: "IN",
  CDG: "FR",
  ORY: "FR",
};
const COUNTRY_SERVICE_AREAS = {
  CN: { label: "country.cn", providers: ["SF Express", "EMS"] },
  GB: {
    label: "country.gb",
    providers: ["EBC UK", "DHL eCommerce UK", "Parcelforce Worldwide"],
  },
  AU: { label: "country.au", providers: ["Australia Post", "DHL"] },
  JP: { label: "country.jp", providers: ["Japan Post", "Yamato Transport"] },
  IN: { label: "country.in", providers: ["India Post", "DHL"] },
  FR: { label: "country.fr", providers: ["La Poste", "DHL"] },
};
function flightCountry(airport, explicit) {
  const code = String(
    explicit?.code || explicit || AIRPORT_COUNTRIES[airport] || "",
  ).toUpperCase();
  return ["CN", "HK", "MO"].includes(code) ? "CN" : code;
}
function serviceRoute() {
  const area = (airport, explicit) => {
    const country = flightCountry(airport, explicit),
      data = COUNTRY_SERVICE_AREAS[country];
    return {
      country,
      label: data?.label || null,
      regions: country === "CN" ? ["hk", "gba", "mainland"] : ["mainland"],
      providers: data?.providers || [],
    };
  };
  return {
    origin: area(state.flight.origin, state.flight.originCountry),
    destination: area(
      state.flight.destination,
      state.flight.destinationCountry,
    ),
  };
}
// Family hub. The demo directory maps only the two supplied sample accounts to booked travellers.
const FAMILY_METHODS = ["member", "mobile", "email"],
  FAMILY_RELATIONSHIPS = ["parent", "guardian", "other"],
  FAMILY_STATUSES = ["draft", "pending", "linked", "declined", "cancelled"];
const FAMILY_FIELDS = { member: "memberNo", mobile: "mobile", email: "email" },
  FAMILY_MEMBER_ID = "lin",
  FAMILY_PARENT = {
    name: "Mei Chen",
    tier: "silver",
    memberNo: "9876543210",
    mobile: "+852 0000 0001",
    email: "mei.chen@example.com",
  };
const MEMBERSHIP_TIERS = ["green", "silver", "gold", "diamond", "diamondExec"],
  FAMILY_MILESTONE_TARGET = 3;
function newFamilyLink(): FamilyLink {
  return {
    method: "member",
    memberNo: "1234567890",
    mobile: "+852 0000 0000",
    email: "lin.chen@example.com",
    surname: "Chen",
    givenName: "Lin",
    relationship: "parent",
    status: "draft",
    shareProgress: false,
    invitedAt: null,
    respondedAt: null,
    changeRequest: null,
  };
}
function newFamilyContact(method = "member") {
  return {
    ...newFamilyLink(),
    method,
    memberNo: "",
    mobile: "",
    email: "",
    surname: "",
    givenName: "",
  };
}
function passengerFamilyLink(travellerId) {
  return (state.passengerLinks[travellerId] ??= newFamilyContact("email"));
}
function alexFamilyLink() {
  return {
    ...newFamilyLink(),
    memberNo: "1600654321",
    mobile: "+852 59876543",
    email: "alex.chen@example.com",
    givenName: "Alex",
  };
}
function familyAccountKey(method, value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return method === "email" ? text : text.replace(/[\s()-]/g, "");
}
function familyTravellerId(link) {
  const method = link.method,
    key = FAMILY_FIELDS[method],
    identifier = familyAccountKey(method, link[key]);
  if (!identifier) return null;
  const samples: [string, FamilyLink][] = [
    [FAMILY_MEMBER_ID, newFamilyLink()],
    ["child", alexFamilyLink()],
  ];
  for (const [id, sample] of samples) {
    if (identifier === familyAccountKey(method, sample[key])) return id;
  }
  if (
    (method === "member" && identifier === "1600123456") ||
    (method === "mobile" && identifier === "+85251234567")
  )
    return FAMILY_MEMBER_ID;
  return null;
}
function familyMemberId(link) {
  return (
    familyTravellerId(link) ||
    link.method + ":" + familyAccountKey(link.method, familyIdentifier(link))
  );
}
function familyConnectionRecords(passengerId = null) {
  const archived = state.familyInvitationArchive
    .filter((entry) => entry.passengerId === passengerId)
    .map((entry) => entry.link);
  const current =
    passengerId === null ? state.familyLink : state.passengerLinks[passengerId];
  return current ? [...archived, current] : archived;
}
function parentFamilyRecords() {
  return [...familyConnectionRecords().reverse(), ...state.familyMembers];
}
function linkedFamilyMembers() {
  return familyDemoUnlinked(FAMILY_MEMBER_ID)
    ? []
    : parentFamilyRecords().filter((link) => link.status === "linked");
}
function linkedFamilyMember(id) {
  return linkedFamilyMembers().find((link) => familyMemberId(link) === id);
}
function linkedPassengerContacts(passengerId) {
  if (familyDemoUnlinked(passengerId)) return [];
  return familyConnectionRecords(passengerId).filter(
    (link) => link.status === "linked",
  );
}
function pendingFamilyInvitations(passengerId) {
  return familyConnectionRecords(passengerId)
    .filter((link) => link.status === "pending")
    .reverse();
}
function familyInvitationId(link) {
  return link.invitationId || "legacy:" + familyMemberId(link);
}
function pendingFamilyInvitation(passengerId, id) {
  return pendingFamilyInvitations(passengerId).find(
    (link) => familyInvitationId(link) === id,
  );
}
function familyLinkedRecord(link) {
  return link?.status === "linked" && !familyDemoUnlinked(FAMILY_MEMBER_ID);
}
function setFamilyProgress(id, action) {
  const link = linkedFamilyMember(id);
  if (!link || link.shareProgress) return false;
  if (action === "request") link.progressRequested = true;
  else {
    if (!link.progressRequested) return false;
    link.progressRequested = false;
    link.shareProgress = action === "grant";
  }
  persist();
  return true;
}
function migrateFamilyState() {
  state.passengerLinks ??= {};
  state.familyInvitationArchive ??= [];
  if (!Array.isArray(state.familyMembers)) state.familyMembers = [];
  const saved = state.familyLink,
    fresh = newFamilyLink();
  state.familyLink =
    saved && typeof saved === "object" ? { ...fresh, ...saved } : fresh;
  if (!FAMILY_STATUSES.includes(state.familyLink.status))
    state.familyLink = { ...fresh };
}
function familyIdentifier(link = state.familyLink) {
  return String(link[FAMILY_FIELDS[link.method]] ?? "").trim();
}
function familyMemberName(link = state.familyLink) {
  const surname = String(link.surname || "").trim(),
    given = String(link.givenName || "").trim();
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(surname + given)
    ? surname + given
    : [given, surname].filter(Boolean).join(" ");
}
function validateFamilyLink(link = state.familyLink, allContacts = false) {
  if (
    !String(link.surname || "").trim() ||
    !String(link.givenName || "").trim()
  )
    return "e.familyName";
  if (!FAMILY_METHODS.includes(link.method)) return "e.familyMethod";
  const memberNo = String(link.memberNo ?? "").trim(),
    mobile = String(link.mobile ?? "").trim(),
    email = String(link.email ?? "").trim();
  if (
    (allContacts || link.method === "member") &&
    !/^\d{8,12}$/.test(memberNo.replace(/[\s-]/g, ""))
  )
    return "e.familyMember";
  if (
    (allContacts || link.method === "mobile") &&
    (!/^\+[\d\s()-]+$/.test(mobile) ||
      !/^\d{8,15}$/.test(mobile.replace(/\D/g, "")))
  )
    return "e.familyMobile";
  if (
    (allContacts || link.method === "email") &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  )
    return "e.familyEmail";
  if (!FAMILY_RELATIONSHIPS.includes(link.relationship))
    return "e.familyRelationship";
  if (link === state.familyLink && link.status === "draft")
    return validateFamilyInvitationDuplicate(link, null);
  return null;
}
function validateFamilyInvitationDuplicate(link, passengerId) {
  const records =
    passengerId === null
      ? parentFamilyRecords()
      : familyConnectionRecords(passengerId);
  const id = familyMemberId(link);
  const matches = records.filter((record) => familyMemberId(record) === id);
  if (matches.some((record) => record.status === "linked"))
    return "e.familyDuplicate";
  if (matches.some((record) => record.status === "pending"))
    return "e.familyInvitePending";
  return null;
}
function validateFamilyInvitation(link, passengerId) {
  return (
    validateFamilyLink(link, passengerId !== null) ||
    validateFamilyInvitationDuplicate(link, passengerId)
  );
}
function markFamilyInvitationPending(link, fromParent) {
  state.nextFamilyInvitation = (state.nextFamilyInvitation || 0) + 1;
  const invitationId =
    globalThis.crypto?.randomUUID?.() || "invite-" + state.nextFamilyInvitation;
  Object.assign(link, {
    invitationId,
    status: "pending",
    invitedAt: iso(state.clock),
    respondedAt: null,
    changeRequest: null,
    shareProgress: false,
  });
  if (fromParent) link.owner = { ...FAMILY_PARENT };
}
// Retain the original model entry point for callers submitting the active draft.
function sendFamilyInvite(link = state.familyLink, allContacts = false) {
  if (link.status !== "draft") return "e.familyLocked";
  const error = validateFamilyLink(link, allContacts);
  if (error) return error;
  markFamilyInvitationPending(link, link === state.familyLink);
  persist();
  return null;
}
function submitFamilyInvitation(draft, passengerId) {
  const error = validateFamilyInvitation(draft, passengerId);
  if (error) return error;
  const fromParent = passengerId === null;
  const current = fromParent
    ? state.familyLink
    : state.passengerLinks[passengerId];
  if (current && current.status !== "draft")
    state.familyInvitationArchive.push({ passengerId, link: current });
  const link = { ...draft };
  markFamilyInvitationPending(link, fromParent);
  if (fromParent) state.familyLink = link;
  else state.passengerLinks[passengerId] = link;
  if (state.familyDemoUnlinked)
    delete state.familyDemoUnlinked[passengerId ?? FAMILY_MEMBER_ID];
  persist();
  return null;
}
function cancelFamilyInvitation(link) {
  if (link?.status !== "pending") return false;
  link.status = "cancelled";
  link.respondedAt = iso(state.clock);
  persist();
  return true;
}
function respondFamilyInvite(
  accepted: boolean,
  share = true,
  link = state.familyLink,
) {
  if (link.status !== "pending") return false;
  Object.assign(link, {
    status: accepted ? "linked" : "declined",
    shareProgress: !!(accepted && share),
    respondedAt: iso(state.clock),
  });
  persist();
  return true;
}
function requestFamilyChange(link = state.familyLink) {
  if (
    !["pending", "linked"].includes(link.status) ||
    link.changeRequest?.status === "pending"
  )
    return false;
  link.changeRequest = { status: "pending", submittedAt: iso(state.clock) };
  persist();
  return true;
}
function reviewFamilyChange(link, approved: boolean) {
  if (link?.status !== "linked" || link.changeRequest?.status !== "pending")
    return false;
  if (approved) {
    for (const [passengerId, trip] of Object.entries(state.helper || {})) {
      if (
        trip?.contactId === "member" &&
        familyConnectionRecords(passengerId)[0] === link
      )
        trip.contactId = "";
    }
    if (state.familyLink === link) state.familyLink = newFamilyContact();
    for (const [passengerId, contact] of Object.entries(
      state.passengerLinks || {},
    )) {
      if (contact === link) delete state.passengerLinks[passengerId];
    }
    state.familyInvitationArchive = state.familyInvitationArchive.filter(
      (entry) => entry.link !== link,
    );
    state.familyMembers = state.familyMembers.filter(
      (member) => member !== link,
    );
  } else {
    link.changeRequest = null;
  }
  persist();
  return true;
}
function familyDemoUnlinked(travellerId) {
  return state.familyDemoUnlinked?.[travellerId] === true;
}
function setFamilyDemoUnlinked(travellerId, active) {
  state.familyDemoUnlinked ??= {};
  if (active) state.familyDemoUnlinked[travellerId] = true;
  else delete state.familyDemoUnlinked[travellerId];
  persist();
}
function addDemoAlex(now) {
  const hasAlex = parentFamilyRecords().some(
    (member) =>
      ["linked", "pending"].includes(member.status) &&
      familyTravellerId(member) === "child",
  );
  if (hasAlex) return;
  state.familyMembers.push({
    ...alexFamilyLink(),
    owner: { ...FAMILY_PARENT },
    status: "linked",
    shareProgress: true,
    invitedAt: now,
    respondedAt: now,
  });
}
function simulateFamilyLink(link, travellerId) {
  const fromParent = link === state.familyLink;
  const passengerId = fromParent ? null : travellerId;
  const records = fromParent
    ? parentFamilyRecords()
    : familyConnectionRecords(passengerId);
  const hasMembers = records.some((member) => member.status === "linked");
  const now = iso(state.clock);
  if (hasMembers) {
    if (
      fromParent &&
      familyLinkedRecord(link) &&
      familyTravellerId(link) === FAMILY_MEMBER_ID
    )
      addDemoAlex(now);
  } else {
    const sample = fromParent
      ? newFamilyLink()
      : {
          ...newFamilyContact("email"),
          memberNo: FAMILY_PARENT.memberNo,
          mobile: FAMILY_PARENT.mobile,
          email: FAMILY_PARENT.email,
          surname: "Chen",
          givenName: "Mei",
        };
    const pendingSample = records.find(
      (record) =>
        record.status === "pending" &&
        familyMemberId(record) === familyMemberId(sample),
    );
    if (pendingSample) {
      pendingSample.status = "linked";
      pendingSample.respondedAt = now;
    } else {
      if (link.status !== "draft")
        state.familyInvitationArchive.push({ passengerId, link });
      const connected = {
        ...sample,
        status: "linked",
        invitedAt: now,
        respondedAt: now,
      };
      if (fromParent) {
        connected.owner = { ...FAMILY_PARENT };
        state.familyLink = connected;
      } else {
        state.passengerLinks[travellerId] = connected;
      }
    }
    if (fromParent) addDemoAlex(now);
  }
  setFamilyDemoUnlinked(travellerId, false);
  return true;
}
function familyBenefitMember() {
  const members = linkedFamilyMembers();
  return (
    members.find((link) => familyTravellerId(link) === FAMILY_MEMBER_ID) ||
    members[0]
  );
}
const familyLinked = () => !!familyBenefitMember();
function familyOrder(link = familyBenefitMember()) {
  const id = link && familyTravellerId(link);
  return id
    ? state.orders
        .filter(
          (order) => order.travellerId === id && order.status !== "cancelled",
        )
        .at(-1) || null
    : null;
}
// Sharing permission is separate from the family connection and any service order.
function familyProgressAccess(link = familyBenefitMember()) {
  if (!familyLinkedRecord(link)) return "unlinked";
  if (!link.shareProgress)
    return link.progressRequested ? "requested" : "denied";
  return familyOrder(link) ? "ready" : "waiting";
}
function familyMilestones() {
  const order = familyLinked() ? familyOrder() : null,
    current =
      order?.status === "completed"
        ? "counted"
        : order
          ? "inProgress"
          : "notBooked";
  return {
    target: FAMILY_MILESTONE_TARGET,
    completed: current === "counted" ? 1 : 0,
    order,
    moves: [
      { key: "current", status: current },
      { key: "next", status: "notStarted" },
      { key: "final", status: "notStarted" },
    ],
  };
}
// A move counts only after the order completes; the code is a fixed demo value, never a live offer.
function familyPromoCode() {
  const order = familyLinked() ? familyOrder() : null;
  if (order?.status !== "completed") return null;
  const link = familyBenefitMember(),
    initials =
      (String(link.givenName).trim()[0] || "F") +
      (String(link.surname).trim()[0] || "M");
  return `FAMILY-${/^[A-Za-z]{2}$/.test(initials) ? initials.toUpperCase() : "PL"}${String(order.flight?.flightNo || "").slice(-2)}-${(order.id.split("-").at(-1).replace(/\D/g, "") || "1").padStart(4, "0").slice(-4)}`;
}
function itemCategories(item: Bag): string[] {
  return [
    ...new Set<string>(
      (Array.isArray(item.categories)
        ? item.categories
        : [item.category || "other"]
      ).filter((c) => BAG_CATEGORIES.includes(c)),
    ),
  ];
}
function carriageFor(item) {
  return !item.service || item.mode === "cabin"
    ? "self"
    : item.carriage === "flight" || item.carriage === "cargo"
      ? item.carriage
      : state.transport === "cargo"
        ? "cargo"
        : "flight";
}
function refreshTransport() {
  const modes = [
    ...new Set(
      checked(draft())
        .filter((i) => i.service)
        .map(carriageFor),
    ),
  ];
  state.transport = modes.length > 1 ? "mixed" : modes[0] || "flight";
}
function migrateBookingState() {
  if (
    !state.helper ||
    typeof state.helper !== "object" ||
    "review" in state.helper
  )
    state.helper = {};
  migrateFamilyState();
  state.recipientPhone ??= state.phone || "";
  const previous = state.routeLink,
    route = serviceRoute();
  const oldOrigin = previous
      ? flightCountry(previous.origin, previous.originCountry)
      : null,
    oldDestination = previous
      ? flightCountry(previous.destination, previous.destinationCountry)
      : null;
  if (previous && oldOrigin !== route.origin.country) {
    state.region =
      route.origin.country === "CN" ? "mainland" : route.origin.regions[0];
    state.pickupPartner = route.origin.providers[0] || "";
    state.pickupAddress = "";
  }
  if (previous && oldDestination !== route.destination.country) {
    state.partner = route.destination.providers[0] || "";
    state.destinationAddress = "";
  }
  if (!route.origin.regions.includes(state.region))
    state.region = route.origin.regions[0];
  if (!route.origin.providers.includes(state.pickupPartner))
    state.pickupPartner = route.origin.providers[0] || "";
  if (!route.destination.providers.includes(state.partner))
    state.partner = route.destination.providers[0] || "";
  state.routeLink = {
    origin: state.flight.origin,
    destination: state.flight.destination,
    originCountry: route.origin.country,
    destinationCountry: route.destination.country,
  };
  for (const declaration of [
    ...Object.values(state.drafts || {}),
    ...Object.values(state.declarations || {}),
  ])
    for (const item of declaration.items || [])
      item.categories = itemCategories(item);
}
function helperContacts() {
  if (familyDemoUnlinked(state.travellerId)) return [];
  const records = familyConnectionRecords(state.travellerId);
  const members = linkedFamilyMembers();
  const linkedIds = new Set<string>();
  const contacts: {
    id: string;
    name: string;
    email?: string;
    memberNo?: string;
    mobile?: string;
    relationship?: string;
  }[] = records.flatMap((link, index) => {
    if (link.status !== "linked") return [];
    const memberId = familyMemberId(link);
    linkedIds.add(memberId);
    return [
      {
        ...link,
        id: index === 0 ? "member" : "member:" + memberId,
        name: familyMemberName(link),
      },
    ];
  });
  const passengerLink = members.find(
    (link) => familyTravellerId(link) === state.travellerId,
  );
  if (passengerLink) {
    const owner = passengerLink.owner || FAMILY_PARENT;
    if (!contacts.some((contact) => contact.email === owner.email))
      contacts.push({
        ...owner,
        id: "parent",
        relationship: passengerLink.relationship,
      });
  }
  for (const member of members) {
    const memberId = familyMemberId(member);
    const account = familyAccountKey("member", member.memberNo);
    const email = familyAccountKey("email", member.email);
    if (
      linkedIds.has(memberId) ||
      contacts.some(
        (contact) =>
          (account &&
            familyAccountKey("member", contact.memberNo) === account) ||
          (email && familyAccountKey("email", contact.email) === email),
      )
    )
      continue;
    linkedIds.add(memberId);
    contacts.push({
      ...member,
      id: "roster:" + memberId,
      name: familyMemberName(member),
    });
  }
  return contacts;
}
function helperTrip() {
  const trip = state.helper[state.travellerId];
  return trip &&
    trip.bookingId === state.flight.bookingId &&
    trip.legId === state.flight.legId
    ? trip
    : null;
}
function selectedHelper() {
  const id = helperTrip()?.contactId;
  return helperContacts().find((contact) => contact.id === id);
}
function selectHelper(id: string) {
  if (!state.family || pendingHelperRequest()) return;
  const contact = helperContacts().find((entry) => entry.id === id);
  state.helper[state.travellerId] = {
    bookingId: state.flight.bookingId,
    legId: state.flight.legId,
    requests: helperTrip()?.requests || [],
    contactId: contact?.id || "",
  };
  persist();
}
function pendingHelperRequest() {
  return Object.values(helperTrip()?.requests || {})
    .filter((request) => request.status !== "superseded")
    .at(-1);
}
function startNewHelperApplication() {
  if (!pendingHelperRequest()) return false;
  const trip = helperTrip();
  for (const request of Object.values(trip.requests))
    request.status = "superseded";
  trip.contactId = "";
  state.family = false;
  state.agreed = false;
  persist();
  return true;
}
function validateHelper() {
  if (!state.family) return null;
  if (pendingHelperRequest()) return "helper.waiting";
  if (!helperContacts().length) return "helper.noContactsTitle";
  if (!selectedHelper()) return "helper.select";
  return "helper.send";
}
function sendHelperRequest() {
  if (!state.family || pendingHelperRequest()) return false;
  const contact = selectedHelper();
  if (!contact) return false;
  const trip = helperTrip();
  trip.requests = [
    ...Object.values(trip.requests),
    {
      contactId: contact.id,
      recipient: String(contact.email).trim(),
      requestedAt: iso(state.clock),
      status: "pending",
    },
  ];
  persist();
  return true;
}
function validateInformation() {
  const r = serviceRoute();
  if (
    !r.origin.regions.includes(state.region) ||
    !r.origin.providers.includes(state.pickupPartner) ||
    !r.destination.providers.includes(state.partner)
  )
    return "e.routeProviders";
  if (
    [
      state.pickupAddress,
      state.destinationAddress,
      state.contact,
      state.phone,
      state.recipient,
      state.recipientPhone,
    ].some((v) => !String(v || "").trim())
  )
    return "e.contacts";
  if (!checkApplicationDeadline().valid) return "e.deadline";
  const pickup = new Date(state.pickup + ":00+08:00").getTime(),
    latest =
      new Date(state.flight.departure).getTime() -
      REGIONS[state.region].pickupLead * 3600000;
  return !Number.isFinite(pickup) ||
    pickup < new Date(state.clock).getTime() ||
    pickup > latest
    ? "e.pickup"
    : null;
}
function baggagePlan(transport?: string) {
  const d = draft(),
    items = checked(d).filter(
      (i) => !i.service || (transport || carriageFor(i)) !== "cargo",
    ),
    allowance = ticketAllowance();
  const required = allowance ? Math.max(0, items.length - allowance.pieces) : 0,
    requested = items.length ? (state.extraBags?.[state.travellerId] ?? 0) : 0;
  // Only the shortfall is billable; old add-ons cannot create a charge after bags are removed.
  const purchased =
    Number.isSafeInteger(requested) && requested >= 0
      ? Math.min(requested, required)
      : 0;
  return {
    allowance,
    items: clone(items),
    required,
    requested,
    purchased,
    quoted: required,
    missing: Math.max(0, required - purchased),
    weight: items.reduce((n, i) => n + (Number(i.weight) || 0), 0),
  };
}

function initial() {
  return dataSource.loadDemo();
}

let state: BookingState,
  storageOK = true;
try {
  const saved = dataSource.readBooking();
  state = saved?.schema === 1 ? saved : initial();
  if (!state.drafts?.lin || !state.agent || !Array.isArray(state.orders))
    throw Error("invalid");
  state.processing = false;
  state.pendingPayment = null;
  state.frozenMiles = 0;
} catch {
  state = initial();
}
// Existing saved bookings predate the transport choice and used the passenger flight.
if (state.transport == null) state.transport = "flight";
migratePricingState();
migrateBookingState();
// Assistance is opt-in for each visit to the passenger page.
state.family = false;
function persist() {
  try {
    dataSource.saveBooking({ ...state, family: false });
  } catch {
    storageOK = false;
  }
}
const draft = () => state.drafts[state.travellerId],
  person = () => PEOPLE.find((p) => p.id === state.travellerId) || PEOPLE[0],
  activeOrder = () =>
    state.orders.find(
      (o) => o.travellerId === state.travellerId && o.status !== "cancelled",
    );
const checked = (d: Draft) =>
  d.zero || d.countUnknown ? [] : d.items.filter((i) => i.mode === "checked");
const displayValue = (value) =>
  typeof value === "string" && value.startsWith("@sample.")
    ? t(value.slice(1))
    : String(value ?? "");
function localHK(t) {
  const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(t)),
    v = (k) => parts.find((p) => p.type === k).value;
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}
function demand(d) {
  if (!d || d.countUnknown)
    return { count: null, weight: 30, imputed: 30, volume: null, review: 0 };
  let known = 0,
    imputed = 0,
    volume = 0,
    missing = false;
  const items = checked(d);
  for (const i of items) {
    if (i.weight == null) imputed += 20;
    else known += Number(i.weight);
    if ([i.l, i.w, i.h].some((v) => v == null)) missing = true;
    else volume += (i.l * i.w * i.h) / 1e6;
  }
  return {
    count: items.length,
    weight: known + imputed,
    imputed,
    volume: missing ? null : volume,
    review: items.filter((i) => i.review).length,
  };
}
function validateDeclaration(d) {
  if (d.zero || d.countUnknown) return null;
  if (!d.items.length) return "e.addBaggage";
  for (const i of d.items) {
    if (!i.name.trim()) return "e.itemName";
    for (const k of ["weight", "l", "w", "h"])
      if (i[k] != null && (!Number.isFinite(Number(i[k])) || Number(i[k]) <= 0))
        return "e.positive";
  }
  return null;
}
function aggregateBaggage() {
  const records = Object.values(state.declarations).filter(
      (d) =>
        d.legId === state.flight.legId &&
        d.status === "submitted" &&
        !d.countUnknown,
    ),
    reported = 79 + records.length,
    unreported = 100 - reported;
  let known = 1140,
    imputed = unreported * 30,
    pieces = 114,
    volume = 7 + unreported * 0.15,
    missing = false,
    reviews = 0;
  for (const d of records) {
    const q = demand(d);
    known += q.weight - q.imputed;
    imputed += q.imputed;
    pieces += q.count;
    reviews += q.review;
    if (q.volume == null) missing = true;
    else volume += q.volume;
  }
  return {
    reported,
    unreported,
    coverage: reported,
    known,
    imputed,
    weight: known + imputed,
    pieces,
    volume: missing ? null : volume,
    reviews,
  };
}
function forecastCapacity() {
  const a = aggregateBaggage(),
    o = state.ops;
  return {
    ...a,
    weightRemaining: [o.budget, o.otherWeight, o.buffer].some((v) => v == null)
      ? null
      : o.budget - a.weight - o.otherWeight - o.buffer,
    spaceRemaining: [o.spaceBudget, o.otherSpace, o.spaceBuffer, a.volume].some(
      (v) => v == null,
    )
      ? null
      : o.spaceBudget - a.volume - o.otherSpace - o.spaceBuffer,
    expired: o.expired,
  };
}
function checkApplicationDeadline(
  region = state.region,
  departure = state.flight.departure,
  now = state.clock,
) {
  const r = REGIONS[region],
    dep = new Date(departure).getTime(),
    n = new Date(now).getTime();
  if (!r || !Number.isFinite(dep) || !Number.isFinite(n))
    return { valid: false, deadline: null, hours: null };
  return {
    valid: n <= dep - r.hours * 3600000,
    deadline: iso(dep - r.hours * 3600000),
    hours: r.hours,
  };
}
function quoteService(transport?: string): Quote {
  const override = transport,
    d = draft(),
    items = d.items.filter(
      (i) => !d.zero && !d.countUnknown && i.mode === "checked" && i.service,
    ),
    plan = baggagePlan(override);
  const modes = [...new Set(items.map((i) => override || carriageFor(i)))];
  transport = modes.length > 1 ? "mixed" : modes[0] || state.transport;
  if (
    (override && !["flight", "cargo"].includes(override)) ||
    !["flight", "cargo", "mixed"].includes(transport)
  )
    return { valid: false, error: "e.transport" };
  if (!REGIONS[state.region]) return { valid: false, error: "e.region" };
  if (!items.length) return { valid: false, error: "e.serviceBags" };
  if (
    items.some((i) =>
      [i.weight, i.l, i.w, i.h].some(
        (v) => v == null || !Number.isFinite(Number(v)) || Number(v) <= 0,
      ),
    )
  )
    return { valid: false, error: "e.fullSpecs" };
  if (plan.items.length && !plan.allowance)
    return { valid: false, error: "e.allowance" };
  if (!Number.isSafeInteger(plan.requested) || plan.requested < 0)
    return { valid: false, error: "e.extraQuantity" };
  if (
    plan.items.some(
      (i) =>
        i.weight == null ||
        !Number.isFinite(Number(i.weight)) ||
        Number(i.weight) <= 0,
    )
  )
    return { valid: false, error: "e.flightWeight" };
  if (plan.items.some((i) => Number(i.weight) > plan.allowance.kgPerPiece))
    return { valid: false, error: "e.pieceWeight" };
  const weight = items.reduce((n, i) => n + Number(i.weight), 0);
  const serviceFee = Math.round(
    SERVICE_RATES.base * REGIONS[state.region].factor,
  );
  const priority = 0,
    extraFee = plan.required * TRANSPORT_RATES.extraPiece;
  const cargoItems = items.filter(
    (i) => (override || carriageFor(i)) === "cargo",
  );
  const chargeableWeight = cargoItems.reduce(
    (n, i) =>
      n +
      Math.max(
        Number(i.weight),
        (i.l * i.w * i.h) / TRANSPORT_RATES.volumeDivisor,
      ),
    0,
  );
  const cargoUnits = cargoItems.reduce(
    (n, i) =>
      n +
      Math.ceil(
        Math.max(
          Number(i.weight),
          (i.l * i.w * i.h) / TRANSPORT_RATES.volumeDivisor,
        ) / TRANSPORT_RATES.cargoUnitKg,
      ),
    0,
  );
  const cargoFee = cargoUnits * TRANSPORT_RATES.cargoUnit,
    total = serviceFee + priority + extraFee + cargoFee;
  if (!Number.isSafeInteger(total) || !Number.isFinite(chargeableWeight))
    return { valid: false, error: "e.fullSpecs" };
  return {
    valid: true,
    pricingVersion: SERVICE_RATES.version,
    transport,
    serviceFee,
    priority,
    extraFee,
    cargoFee,
    cargoUnits,
    chargeableWeight,
    plan,
    total,
    miles: Math.ceil((total / 100) * 25),
    earn: Math.floor(total / 1000),
    count: items.length,
    weight,
    signature: JSON.stringify({
      flight: state.flight,
      travellerId: state.travellerId,
      region: state.region,
      items,
      airlineItems: plan.items,
      extraPieces: plan.purchased,
      requestedExtraPieces: plan.requested,
      rates: TRANSPORT_RATES,
      serviceRates: SERVICE_RATES,
      partner: state.partner,
      pickupPartner: state.pickupPartner,
      transport,
      pickup: state.pickup,
      pickupAddress: state.pickupAddress,
      destination: state.destinationAddress,
      contact: state.contact,
      recipient: state.recipient,
      phone: state.phone,
      recipientPhone: state.recipientPhone,
    }),
  };
}

const PRICING_LANES = ["cabin", "flight", "cargo"],
  CABIN_WEIGHT_LIMIT_KG = 7;
function cabinWeightError(item: Bag) {
  const weight = Number(item.weight);
  if (!Number.isFinite(weight) || weight <= 0) return "e.cabinWeightMissing";
  return weight >= CABIN_WEIGHT_LIMIT_KG ? "e.cabinWeightLimit" : null;
}
function savedCabinWeightError() {
  if (activeOrder()) return null;
  for (const item of pricingItems()) {
    if (item.mode !== "cabin") continue;
    const error = cabinWeightError(item);
    if (error) return error;
  }
  return null;
}
function pricingItems() {
  const d = draft();
  return d.zero || d.countUnknown ? [] : d.items;
}
function pricingLane(item: Bag) {
  return item.mode === "cabin" || !item.service ? "cabin" : carriageFor(item);
}
function preparePricingBoard() {
  // Older drafts allowed self-handled checked bags. This board has exactly three lanes.
  let changed = false;
  for (const item of pricingItems())
    if (!item.service && item.mode !== "cabin") {
      item.mode = "cabin";
      item.carriage = "self";
      changed = true;
    }
  if (changed) {
    refreshTransport();
    state.agreed = false;
    invalidateAgent();
    persist();
  }
  return changed;
}
function setPricingLane(id: string, lane: string) {
  if (
    state.processing ||
    activeOrder() ||
    !PRICING_LANES.includes(lane) ||
    draft().zero ||
    draft().countUnknown
  )
    return false;
  const item = draft().items.find((i) => i.id === id);
  if (!item || (lane === "cabin" && cabinWeightError(item))) return false;
  item.mode = lane === "cabin" ? "cabin" : "checked";
  item.service = lane !== "cabin";
  item.carriage = lane === "cabin" ? "self" : lane;
  refreshTransport();
  state.agreed = false;
  invalidateAgent();
  persist();
  return true;
}
function pricingQuote(): Quote {
  const d = draft();
  if (d.countUnknown) return { valid: false, error: "pricing.unknownCount" };
  if (!d.zero && !d.items.length)
    return { valid: false, error: "e.addBaggage" };
  const cabinError = savedCabinWeightError();
  if (cabinError) return { valid: false, error: cabinError };
  if (!pricingItems().some((i) => i.service && i.mode === "checked"))
    return {
      valid: true,
      transport: "cabin",
      count: 0,
      weight: 0,
      serviceFee: 0,
      priority: 0,
      extraFee: 0,
      cargoFee: 0,
      cargoUnits: 0,
      chargeableWeight: 0,
      total: 0,
      miles: 0,
      earn: 0,
      plan: baggagePlan(),
    };
  return quoteService();
}

function isDirty() {
  const s = state.declarations[state.travellerId];
  return (
    !s ||
    s.legId !== state.flight.legId ||
    JSON.stringify({
      items: s.items,
      zero: s.zero,
      countUnknown: s.countUnknown,
    }) !== JSON.stringify(draft())
  );
}
function invalidateAgent() {
  if (state.agent.answer) {
    state.agent.stale = true;
    state.agent.answer.stale = true;
  }
}
function saveDeclaration(silent = false) {
  const error = validateDeclaration(draft());
  if (error) {
    toast(error);
    return false;
  }
  if (!isDirty()) {
    if (!silent) toast("notice.same");
    return true;
  }
  const old = state.declarations[state.travellerId];
  state.declarations[state.travellerId] = {
    ...clone(draft()),
    version: (old?.version || 0) + 1,
    legId: state.flight.legId,
    status: "submitted",
    updatedAt: iso(state.clock),
  };
  state.lastSavedAt = iso(state.clock);
  persist();
  if (!silent) toast("notice.saved");
  return true;
}
function validateService() {
  if (!["flight", "cargo", "mixed"].includes(state.transport))
    return "e.transport";
  const q = quoteService();
  if (!q.valid) return q.error;
  if (q.plan.missing) return "e.buyAllowance";
  return (
    validateDeclaration(draft()) ||
    savedCabinWeightError() ||
    validateInformation()
  );
}
function eventCounts(o) {
  const ids = o?.itemIds || [],
    events = state.events.filter((e) => e.orderId === o?.id),
    counts: Record<string, number> = {};
  for (const type of ["airport", "loaded", "handover"])
    counts[type] = new Set(
      events
        .filter((e) => e.type === type)
        .flatMap((e) => e.itemIds)
        .filter((id) => ids.includes(id)),
    ).size;
  return counts;
}
const DEMO_RULE_ROUTES = ["GB", "AU", "IN"];
function serviceIntent(text) {
  const checks: [string, RegExp][] = [
    ["miles", /里數|里数|万里通|萬里通|\bmiles\b|millas|أميال/i],
    [
      "deadline",
      /截止|提前|期限|deadline|how early|before.{0,20}(?:flight|departure)|délai|antelación|plazo|مسبق|موعد/i,
    ],
    [
      "price",
      /價格|价格|費用|费用|收費|收费|報價|报价|多少錢|多少钱|\bprice\b|\bcost\b|tarif|combien|precio|cuesta|تكلف|سعر/i,
    ],
    [
      "tracking",
      /追蹤|追踪|進度|进度|狀態|状态|tracking|updates|track.{0,12}(?:bag|luggage)|suivi|étapes|seguimiento|actualizaciones|تتبع|تحديثات/i,
    ],
    [
      "family",
      /家人|兒童|儿童|小孩|\bchild\b|family|enfant|famille|menor|familia|طفل|الأسرة/i,
    ],
    [
      "delivery",
      /取件|送達|送达|宿舍|配送|送到|pickup|delivery|collect|livraison|collecte|entrega|recogida|استلام|التوصيل/i,
    ],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || null;
}
function ruleCategory(text) {
  const checks: [string, RegExp][] = [
    [
      "battery",
      /電池|电池|充電|充电|battery|batterie|batería|bateria|power\s*bank|بطاري|شاحن|\bwh\b/i,
    ],
    [
      "liquids",
      /液體|液体|洗護|洗护|洗髮|洗发|香水|噴霧|喷雾|liquid|toiletr|shampoo|liquide|toilette|líquido|champú|سوائل|شامبو|عطر/i,
    ],
    [
      "medicine",
      /藥|药|處方|处方|medicin|prescription|tablet|médicament|ordonnance|medicamento|receta|أدوي|دواء|وصفة/i,
    ],
    [
      "food",
      /食品|零食|茶葉|茶叶|鮮|鲜|food|snack|\btea\b|aliment|\bthé\b|aperitiv|comida|أطعم|طعام|الشاي|شاي/i,
    ],
    [
      "fragile",
      /易碎|相機|相机|電腦|电脑|camera|laptop|fragile|ordinateur|photo|portátil|frágil|cámara|كاميرا|حواسيب|الكسر/i,
    ],
    [
      "equipment",
      /輪椅|轮椅|輔助|辅助|設備|设备|wheelchair|equipment|mobility|fauteuil|équipement|silla|equipo|كرسي|معدات/i,
    ],
    [
      "ordinary",
      /衣|書|书|clothes|books?|vêtement|livre|ropa|libro|ملابس|كتب/i,
    ],
  ];
  return checks.find(([, pattern]) => pattern.test(text))?.[0] || "unknown";
}
function answerRouteScope(route) {
  return route === "AU"
    ? "CX105 · HKG → MEL"
    : route === "IN"
      ? "HKG → DEL"
      : "CX257 · HKG → LHR T3";
}
function sendLocalQuestion(question) {
  const a = state.agent,
    text = String(question).trim();
  if (!text) return;
  a.messages.push({ role: "user", text });
  a.messages = a.messages.slice(-24);
  a.stale = false;
  const service = serviceIntent(text);
  if (service) {
    a.pending = null;
    a.answer = {
      kind: "service",
      topic: service,
      quote: clone(quoteService()),
      region: state.region,
      deadline: checkApplicationDeadline(),
      balance: state.milesBalance,
      destination: state.destinationAddress,
      retrievedAt: iso(state.clock),
      sourceIds: [],
      advice: null,
    };
    a.messages.push({ role: "assistant", key: "qa.serviceMessage" });
    persist();
    render();
    return;
  }
  if (!a.route) {
    a.pending = { type: "route" };
    a.answer = null;
    a.messages.push({ role: "assistant", key: "ai.clarifyRoute" });
    persist();
    render();
    return;
  }
  const normal = text
    .replace(/[٠-٩۰-۹]/g, (c) =>
      String(c.charCodeAt(0) - (c >= "۰" ? 1776 : 1632)),
    )
    .replace(/٫/g, ".");
  let category = ruleCategory(text);
  const energy = normal.match(/(\d+(?:[.,]\d+)?)\s*wh/i),
    quantity = normal.match(/\d/);
  // Short attribute replies continue the pending topic; a new named topic starts a new enquiry.
  if (
    a.pending &&
    category === "unknown" &&
    ["battery", "liquids", "medicine", "food"].includes(a.pending.type)
  )
    category = a.pending.type;
  const unknown =
    /不知道|未知|不清楚|unknown|don.t know|inconnu|ne sais|no (?:lo )?s[eé]|desconoc|لا [أا]عرف|غير معروف/i.test(
      text,
    );
  const needsClarify =
    (category === "battery" && !energy && !unknown) ||
    (category === "liquids" && !quantity && !unknown) ||
    (category === "medicine" && !quantity && !unknown) ||
    (category === "food" &&
      !a.pending &&
      (/可以|can I|puis-je|puedo|هل/i.test(text) || text.length < 12));
  if (needsClarify) {
    a.pending = { type: category };
    a.answer = null;
    a.messages.push({
      role: "assistant",
      key:
        category === "battery"
          ? "ai.clarifyBattery"
          : "qa.clarify" + category[0].toUpperCase() + category.slice(1),
    });
    persist();
    render();
    return;
  }
  const reason = !DEMO_RULE_ROUTES.includes(a.route)
    ? "ai.gapRoute"
    : a.quality === "expired"
      ? "ai.gapExpired"
      : a.quality === "conflict"
        ? "ai.gapConflict"
        : a.quality === "missing"
          ? "ai.gapMissing"
          : category === "unknown"
            ? "ai.gapItem"
            : null;
  const item = draft().items.find((i) => i.id === a.itemId);
  a.answer = {
    kind: "rules",
    category,
    route: a.route,
    reason,
    attributes: text,
    energy: energy?.[1] || null,
    sourceIds: reason ? [] : ["ENTRY", "CARRIER", "SECURITY"],
    retrievedAt: iso(state.clock),
    advice:
      !reason && item && a.route === "GB"
        ? {
            itemId: item.id,
            type:
              category === "battery" && itemCategories(item).includes("battery")
                ? "cabin"
                : "review",
          }
        : null,
  };
  a.pending = null;
  a.messages.push({ role: "assistant", key: "ai.resultMessage" });
  persist();
  render();
}
function reviewAdvice() {
  const advice = state.agent.answer?.advice;
  if (!advice || state.agent.stale) return;
  const item = draft().items.find((i) => i.id === advice.itemId);
  if (!item) return;
  modal(
    t("ai.adviceTitle"),
    t(advice.type === "cabin" ? "ai.adviceCabin" : "ai.adviceReview", {
      name: displayValue(item.name),
    }),
    [
      { text: t("ai.apply"), action: "apply-advice" },
      { text: t("common.cancel"), action: "close-dialog", light: true },
    ],
  );
}
function applyAdvice() {
  const a = state.agent.answer;
  if (!a?.advice || state.agent.stale) return;
  const item = draft().items.find((i) => i.id === a.advice.itemId);
  if (!item) return;
  if (activeOrder()) {
    toast("e.orderChange");
    return;
  }
  item.review = true;
  if (a.advice.type === "cabin") {
    item.mode = "cabin";
    item.service = false;
    refreshTransport();
  }
  state.agreed = false;
  if (!saveDeclaration(true)) return;
  a.advice = null;
  closeModal();
  persist();
  render();
  toast("notice.applied");
}
async function pay() {
  if (state.processing || activeOrder()) return;
  const error = validateService(),
    q = quoteService();
  if (error || !q.valid) {
    toast(error || q.error);
    return;
  }
  if (!state.agreed) {
    toast("e.agree");
    return;
  }
  if (state.payment === "miles" && state.milesBalance < q.miles) {
    toast("e.miles");
    return;
  }
  if (!saveDeclaration(true)) return;
  const snapshot: PaymentSnapshot = {
    travellerId: state.travellerId,
    declaration: clone(draft()),
    flight: clone(state.flight),
    quote: clone(q),
    payment: state.payment,
    extraPieces: q.plan.purchased,
    allowance: clone(q.plan.allowance),
    contact: state.contact,
    phone: state.phone,
    pickup: state.pickup,
    pickupAddress: state.pickupAddress,
    destination: state.destinationAddress,
    recipient: state.recipient,
    partner: state.partner,
    pickupPartner: state.pickupPartner,
    recipientPhone: state.recipientPhone,
    transport: q.transport,
    region: state.region,
    itemIds: checked(draft())
      .filter((i) => i.service)
      .map((i) => i.id),
  };
  state.processing = true;
  state.pendingPayment = snapshot;
  state.frozenMiles = state.payment === "miles" ? q.miles : 0;
  persist();
  render();
  await new Promise((r) => setTimeout(r, 650));
  if (!state.processing || state.pendingPayment !== snapshot) return;
  const changed =
      quoteService().signature !== q.signature ||
      state.travellerId !== snapshot.travellerId ||
      state.payment !== snapshot.payment,
    insufficient = snapshot.payment === "miles" && state.milesBalance < q.miles;
  if (
    state.forceFail ||
    changed ||
    insufficient ||
    !checkApplicationDeadline().valid
  ) {
    state.processing = false;
    state.pendingPayment = null;
    state.frozenMiles = 0;
    state.forceFail = false;
    persist();
    render();
    toast("notice.failed");
    return;
  }
  if (snapshot.payment === "miles") state.milesBalance -= q.miles;
  state.orders.push({
    ...snapshot,
    id: "PL-20261115-" + String(state.nextOrder++).padStart(3, "0"),
    status: "paid_demo",
    earned: false,
    refunded: false,
    createdAt: iso(state.clock),
  });
  state.processing = false;
  state.pendingPayment = null;
  state.frozenMiles = 0;
  state.agreed = false;
  persist();
  go("journey");
}
function recordHandover(kind: string) {
  const o = activeOrder();
  if (!o) {
    toast("e.orderFirst");
    return;
  }
  let type = kind,
    ids = o.itemIds;
  const c = eventCounts(o),
    n = ids.length;
  if (kind === "partial") {
    type = "loaded";
    ids = ids.slice(0, Math.max(0, n - 1));
  }
  if (type === "loaded" && c.airport < n) {
    toast("e.airportFirst");
    return;
  }
  if (type === "handover" && c.loaded < n) {
    toast("e.loadedFirst");
    return;
  }
  if (!ids.length) {
    toast("e.partial");
    return;
  }
  const eventId = o.id + ":" + type + ":" + ids.join(",");
  if (state.events.some((e) => e.eventId === eventId)) {
    toast("notice.duplicate");
    return;
  }
  state.events.push({
    eventId,
    orderId: o.id,
    type,
    itemIds: clone(ids),
    legId: o.flight.legId,
    confirmedAt: iso(state.clock),
  });
  persist();
  render();
  toast("notice.event");
}
function completeService() {
  const o = activeOrder();
  if (!o) return;
  if (o.status === "completed") {
    toast("notice.duplicate");
    return;
  }
  if (eventCounts(o).handover < o.itemIds.length) {
    toast("e.localFirst");
    return;
  }
  o.status = "completed";
  if (o.payment === "cash" && !o.earned) {
    state.milesBalance += o.quote.earn;
    o.earned = true;
  }
  persist();
  render();
  toast("notice.complete");
}
function cancelOrder(id: string, confirmed = false) {
  const o = state.orders.find((o) => o.id === id);
  if (!o || o.refunded) return;
  if (!confirmed) {
    modal(t("dialog.cancelTitle"), t("dialog.cancelBody", { id }), [
      { text: t("dialog.cancelConfirm"), action: "confirm-cancel", id },
      { text: t("common.cancel"), action: "close-dialog", light: true },
    ]);
    return;
  }
  if (o.earned && state.milesBalance < o.quote.earn) {
    toast("e.reverse");
    return;
  }
  if (o.payment === "miles") state.milesBalance += o.quote.miles;
  if (o.earned) {
    state.milesBalance -= o.quote.earn;
    o.earned = false;
  }
  o.refunded = true;
  o.status = "cancelled";
  o.cancelledAt = iso(state.clock);
  persist();
  closeModal();
  render();
  toast("notice.cancelled");
}
function resetDemo(scenario: string) {
  if (state.processing) {
    toast("e.processing");
    return;
  }
  const oldLarge = state.large;
  state = initial();
  migrateBookingState();
  state.large = oldLarge;
  let target: View = "home",
    step = 1;
  if (scenario === "family") {
    state.travellerId = "child";
    state.profile = "child";
    state.contact = "@sample.parent";
    target = "book";
  }
  if (scenario === "late") {
    state.clock = "2026-11-14T09:30:01+08:00";
    target = "book";
    step = 2;
  }
  if (scenario === "unknown") {
    state.drafts.lin.items[0].weight = null;
    state.drafts.lin.items[0].l = null;
    saveDeclaration(true);
    target = "ops";
  }
  persist();
  go(target, step);
}

// GLM UI state is transient: a refresh must never restore a stuck request.
const agentRuntime: {
  pending: boolean;
  error: string | null;
  controller: AbortController | null;
  requestId: number;
} = { pending: false, error: null, controller: null, requestId: 0 };
function liveAgent() {
  return (
    state.agent.mode !== "local" &&
    !(typeof location !== "undefined" && location.protocol === "file:")
  );
}
function agentQuote(q) {
  const result: Record<string, unknown> = { valid: !!q?.valid };
  if (!q?.valid) {
    result.error = t(q?.error || "e.fullSpecs");
    return result;
  }
  for (const key of [
    "transport",
    "miles",
    "earn",
    "count",
    "weight",
    "cargoUnits",
    "chargeableWeight",
  ])
    if (q[key] != null) result[key] = q[key];
  for (const key of ["serviceFee", "extraFee", "cargoFee", "total"])
    if (q[key] != null) result[key] = q[key] / 100;
  if (q.plan) {
    result.allowance = q.plan.allowance;
    result.extraPieces = q.plan.required;
    result.unconfirmedExtraPieces = q.plan.missing;
  }
  return result;
}
function agentContext() {
  const order = activeOrder(),
    d = draft();
  // Explicit projection: do not send full state, contacts, identity, proof files or addresses.
  return {
    trip: {
      flight: Object.fromEntries(
        ["flightNo", "origin", "destination", "departure", "terminal"].map(
          (k) => [k, state.flight[k]],
        ),
      ),
      enquiryDestination: state.agent.route || "",
      demoClock: state.clock,
      region: state.region,
      order: order
        ? {
            status: order.status,
            transport: order.transport,
            flight: Object.fromEntries(
              [
                "flightNo",
                "origin",
                "destination",
                "departure",
                "terminal",
              ].map((k) => [k, order.flight?.[k]]),
            ),
            quote: agentQuote(order.quote),
            bagCount: order.itemIds.length,
            events: eventCounts(order),
          }
        : null,
    },
    baggage: {
      selectedItemId: state.agent.itemId || "",
      ruleQuality: state.agent.quality,
      allowance: ticketAllowance(),
      countUnknown: d.countUnknown,
      zero: d.zero,
      items: d.items.slice(0, 50).map((i) => ({
        id: i.id,
        name: displayValue(i.name).slice(0, 300),
        categories: itemCategories(i),
        weight: i.weight == null ? null : Number(i.weight),
        l: i.l == null ? null : Number(i.l),
        w: i.w == null ? null : Number(i.w),
        h: i.h == null ? null : Number(i.h),
        mode: i.mode,
        carriage: carriageFor(i),
        service: !!i.service,
      })),
    },
    pricing: {
      current: agentQuote(pricingQuote()),
      allFlight: agentQuote(quoteService("flight")),
      allCargo: agentQuote(quoteService("cargo")),
      deadline: checkApplicationDeadline(),
      milesBalance: state.milesBalance,
    },
  };
}

function clearAgentConversation(renderAfter = true) {
  agentRuntime.requestId++;
  agentRuntime.controller?.abort();
  agentRuntime.controller = null;
  agentRuntime.pending = false;
  agentRuntime.error = null;
  Object.assign(state.agent, {
    messages: [],
    answer: null,
    pending: null,
    questionDraft: "",
    stale: false,
  });
  persist();
  if (renderAfter) render();
}
function agentErrorKey(code) {
  return (
    {
      not_configured: "agent.notConfigured",
      invalid_configuration: "agent.notConfigured",
      provider_auth: "agent.authError",
      provider_subscription_expired: "agent.expired",
      provider_quota: "agent.quota",
      provider_rate_limit: "agent.rateLimit",
      rate_limit: "agent.rateLimit",
      busy: "agent.rateLimit",
      provider_timeout: "agent.timeout",
      incomplete_response: "agent.incomplete",
      context_changed: "agent.contextChanged",
      cancelled: "agent.cancelled",
    }[code] || "agent.connectionError"
  );
}
async function sendQuestion(question: string, retry = false) {
  const text = String(question).trim();
  if (!text || agentRuntime.pending) return;
  if (!liveAgent()) {
    sendLocalQuestion(text);
    return;
  }
  if (text.length > 2000) return;
  const a = state.agent,
    context = agentContext(),
    snapshot = JSON.stringify(context),
    requestId = ++agentRuntime.requestId;
  a.questionDraft = "";
  a.answer = null;
  a.pending = null;
  a.stale = false;
  if (
    !retry ||
    a.messages.at(-1)?.role !== "user" ||
    a.messages.at(-1)?.text !== text
  )
    a.messages.push({ role: "user", text });
  a.messages = a.messages.slice(-24);
  const messages = a.messages
    .filter((m) => m.text && !m.key && !m.failed)
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.text }));
  // Keep complete recent turns within the server history budget.
  while (
    messages.length > 1 &&
    messages.reduce((n, m) => n + m.content.length, 0) > 40000
  )
    messages.shift();
  agentRuntime.pending = true;
  agentRuntime.error = null;
  const controller = new AbortController();
  agentRuntime.controller = controller;
  const timeout = setTimeout(() => controller.abort("timeout"), 90000);
  persist();
  render();
  try {
    const data = await requestAssistantReply(
      { messages, context, language },
      controller.signal,
    );
    if (requestId !== agentRuntime.requestId || state.agent !== a) return;
    if (JSON.stringify(agentContext()) !== snapshot)
      throw Error("context_changed");
    a.messages.push({
      role: "assistant",
      text: data.reply,
      mode: "live",
      tools: Array.isArray(data.tools)
        ? data.tools.filter((k) =>
            [
              "get_trip_context",
              "get_baggage_context",
              "get_price_context",
              "get_service_guide",
            ].includes(k),
          )
        : [],
    });
    a.messages = a.messages.slice(-24);
  } catch (error) {
    if (requestId === agentRuntime.requestId && state.agent === a)
      agentRuntime.error = agentErrorKey(
        controller.signal.aborted
          ? controller.signal.reason === "timeout"
            ? "provider_timeout"
            : "cancelled"
          : (error as Error).message,
      );
  } finally {
    clearTimeout(timeout);
    if (requestId === agentRuntime.requestId) {
      agentRuntime.pending = false;
      agentRuntime.controller = null;
      persist();
      render();
    }
  }
}
function retryAgentQuestion() {
  const last = [...state.agent.messages]
    .reverse()
    .find((m) => m.role === "user");
  if (last) sendQuestion(last.text, true);
}

function restoreBooking(saved: BookingState) {
  if (
    saved?.schema !== 1 ||
    !saved.drafts?.lin ||
    !saved.agent ||
    !Array.isArray(saved.orders) ||
    state.processing
  )
    return;
  const { view, step, family } = state;
  state = saved;
  state.transport ??= "flight";
  migratePricingState();
  migrateBookingState();
  Object.assign(state, {
    view,
    step,
    family,
    processing: false,
    pendingPayment: null,
    frozenMiles: 0,
  });
}
export {
  clone,
  fmt,
  money,
  iso,
  hk,
  REGIONS,
  PEOPLE,
  DEMO_BAGGAGE_ALLOWANCE,
  SERVICE_RATES,
  TRANSPORT_RATES,
  partnerName,
  migratePartnerNames,
  migratePricingState,
  ticketAllowance,
  BAG_CATEGORIES,
  AIRPORT_COUNTRIES,
  COUNTRY_SERVICE_AREAS,
  flightCountry,
  serviceRoute,
  FAMILY_METHODS,
  FAMILY_RELATIONSHIPS,
  FAMILY_STATUSES,
  FAMILY_FIELDS,
  FAMILY_MEMBER_ID,
  FAMILY_PARENT,
  MEMBERSHIP_TIERS,
  FAMILY_MILESTONE_TARGET,
  newFamilyLink,
  newFamilyContact,
  passengerFamilyLink,
  alexFamilyLink,
  familyAccountKey,
  familyTravellerId,
  familyMemberId,
  familyConnectionRecords,
  parentFamilyRecords,
  linkedFamilyMembers,
  linkedFamilyMember,
  linkedPassengerContacts,
  pendingFamilyInvitations,
  familyInvitationId,
  pendingFamilyInvitation,
  familyLinkedRecord,
  setFamilyProgress,
  migrateFamilyState,
  familyIdentifier,
  familyMemberName,
  validateFamilyLink,
  validateFamilyInvitationDuplicate,
  validateFamilyInvitation,
  markFamilyInvitationPending,
  sendFamilyInvite,
  submitFamilyInvitation,
  cancelFamilyInvitation,
  respondFamilyInvite,
  requestFamilyChange,
  reviewFamilyChange,
  familyDemoUnlinked,
  setFamilyDemoUnlinked,
  addDemoAlex,
  simulateFamilyLink,
  familyBenefitMember,
  familyLinked,
  familyOrder,
  familyProgressAccess,
  familyMilestones,
  familyPromoCode,
  itemCategories,
  carriageFor,
  refreshTransport,
  migrateBookingState,
  helperContacts,
  helperTrip,
  selectedHelper,
  selectHelper,
  pendingHelperRequest,
  startNewHelperApplication,
  validateHelper,
  sendHelperRequest,
  validateInformation,
  baggagePlan,
  initial,
  state,
  storageOK,
  persist,
  draft,
  person,
  activeOrder,
  checked,
  displayValue,
  localHK,
  demand,
  validateDeclaration,
  aggregateBaggage,
  forecastCapacity,
  checkApplicationDeadline,
  quoteService,
  PRICING_LANES,
  CABIN_WEIGHT_LIMIT_KG,
  cabinWeightError,
  savedCabinWeightError,
  pricingItems,
  pricingLane,
  preparePricingBoard,
  setPricingLane,
  pricingQuote,
  isDirty,
  invalidateAgent,
  saveDeclaration,
  validateService,
  eventCounts,
  DEMO_RULE_ROUTES,
  serviceIntent,
  ruleCategory,
  answerRouteScope,
  sendLocalQuestion,
  reviewAdvice,
  applyAdvice,
  pay,
  recordHandover,
  completeService,
  cancelOrder,
  resetDemo,
  agentRuntime,
  liveAgent,
  agentQuote,
  agentContext,
  clearAgentConversation,
  agentErrorKey,
  sendQuestion,
  retryAgentQuestion,
  restoreBooking,
};
