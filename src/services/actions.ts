import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import type { BookingState } from "../types/domain";
import { BOOK_PAGES, isAppPath, readRoute } from "../config/routes";
import {
  agentRuntime,
  answerRouteScope,
  baggagePlan,
  cancelFamilyInvitation,
  cancelOrder,
  checked,
  clearAgentConversation,
  completeService,
  draft,
  hk,
  initial,
  invalidateAgent,
  familyProgressAccess,
  familyMemberName,
  migrateBookingState,
  pay,
  pendingFamilyInvitation,
  pendingHelperRequest,
  helperContacts,
  persist,
  person,
  preparePricingBoard,
  pricingQuote,
  refreshTransport,
  recordHandover,
  requestFamilyChange,
  reviewFamilyChange,
  resetDemo,
  respondFamilyInvite,
  retryAgentQuestion,
  reviewAdvice,
  applyAdvice,
  saveDeclaration,
  selectHelper,
  sendHelperRequest,
  sendQuestion,
  setFamilyProgress,
  setFamilyDemoUnlinked,
  simulateFamilyLink,
  startNewHelperApplication,
  state,
  submitFamilyInvitation,
  ticketAllowance,
  familyPermission,
  familyServiceRecord,
  familyStudentId,
  familyInvitationId,
  familyKnownContact,
  exitFamilyDemo,
  familySessionPermission,
  validateHelper,
  validateInformation,
  validateService,
} from "../engine/booking";
import {
  familyDemoTravellerId,
  familyInvitePassengerId,
  familyPageLink,
  helperFamilyPage,
} from "./navigation";
import { setLanguage, t } from "./i18n";
import { closeModal, go, modal, render, toast } from "./runtime";
import { helperNoContacts } from "../pages/booking";
import { setFamilyOccasion } from "../pages/family";
import {
  confirmCancelFamilyInvitation,
  editFamilyInvite,
  familyActionRecord,
  familyChangeDialog,
  familyConfirm,
  familyInviteDraft,
  familyPreview,
  familyProgressDialog,
  focusFamilyHeading,
  openFamilyInvite,
  setFamilyField,
  setFamilyDraftPermission,
  activateFamilyService,
  readFamilyConsent,
  familyPermissionsDialog,
  saveFamilyPermissions,
} from "./familyActions";

const FAMILY_BOOKING_FIELDS: (keyof BookingState)[] = [
  "region",
  "pickup",
  "pickupPartner",
  "pickupAddress",
  "destinationAddress",
  "partner",
  "contact",
  "recipient",
  "phone",
  "recipientPhone",
  "transport",
  "payment",
];
function familyProxy(anchor: HTMLAnchorElement) {
  const id = anchor.dataset.familyProxy,
    member = id && familyServiceRecord(id),
    traveller = member && familyStudentId(member);
  if (!traveller || !state.drafts[traveller]) return false;
  if (
    id &&
    (anchor.hasAttribute("data-family-progress")
      ? familyProgressAccess(member) !== "ready"
      : !familyPermission(member, anchor.hasAttribute("data-family-payment") ? "payment" : "booking") || !ticketAllowance(traveller))
  )
    return false;
  state.familyAccess = { linkId: familyInvitationId(member), studentId: traveller };
  if (state.travellerId === traveller) return true;
  state.familyBookingProfiles ??= {};
  state.familyBookingProfiles[state.travellerId] = Object.fromEntries(
    FAMILY_BOOKING_FIELDS.map((key) => [key, state[key]]),
  );
  const defaults = initial();
  Object.assign(
    state,
    state.familyBookingProfiles[traveller] ||
      Object.fromEntries(
        FAMILY_BOOKING_FIELDS.map((key) => [key, defaults[key]]),
      ),
  );
  if (!state.familyBookingProfiles[traveller] && member) {
    const student = familyKnownContact(traveller, false);
    state.recipient = familyMemberName(student);
    state.recipientPhone = student.mobile;
  }
  state.travellerId = traveller;
  state.profile = person().type;
  state.agent.itemId = draft().items[0]?.id || "";
  state.agent.pending = null;
  invalidateAgent();
  state.agreed = false;
  migrateBookingState();
  return true;
}
function setField(el: HTMLInputElement | HTMLSelectElement) {
  const key = el.dataset.field;
  const value =
    el instanceof HTMLInputElement && el.type === "checkbox"
      ? el.checked
      : el.value;
  if (key === "agent.mode") {
    clearAgentConversation(false);
    state.agent.mode = String(value);
  } else if (key === "travellerId") {
    state.travellerId = String(value);
    state.profile = person().type;
    state.agent.itemId = draft().items[0]?.id || "";
    state.agent.pending = null;
    invalidateAgent();
    state.agreed = false;
  } else if (key === "transport") {
    state.transport = String(value);
    for (const item of checked(draft()))
      if (item.service) item.carriage = String(value);
    state.agreed = false;
    invalidateAgent();
  } else if (["zero", "countUnknown"].includes(key)) {
    draft()[key] = value;
    if (value) draft()[key === "zero" ? "countUnknown" : "zero"] = false;
    state.agreed = false;
    invalidateAgent();
  } else if (key === "extraPieces") {
    state.extraBags ??= {};
    state.extraBags[state.travellerId] = Number(value);
    state.agreed = false;
    invalidateAgent();
  } else if (key.startsWith("ops.")) {
    state.ops[key.split(".")[1]] =
      key === "ops.expired"
        ? value
        : value === ""
          ? null
          : Math.max(0, Number(value));
  } else if (key.startsWith("agent.")) {
    state.agent[key.split(".")[1]] = value;
    state.agent.pending = null;
    invalidateAgent();
  } else if (key === "clock" || key === "flight.departure") {
    const date = new Date(String(value) + ":00+08:00");
    if (!Number.isFinite(date.getTime())) return;
    if (key === "clock") state.clock = date.toISOString();
    else {
      state.flight.departure = date.toISOString();
      state.flight.legId = "CX257-" + String(value).slice(0, 10);
      Object.values(state.declarations).forEach(
        (d) => (d.legId = state.flight.legId),
      );
      state.agreed = false;
      invalidateAgent();
    }
  } else if (key === "milesBalance") {
    if (state.processing) return;
    state.milesBalance = Math.max(0, Math.floor(Number(value) || 0));
  } else {
    state[key] = value;
    if (!["agreed", "payment", "forceFail"].includes(key)) {
      state.agreed = false;
      invalidateAgent();
    }
  }
  persist();
}
function setItemField(el: HTMLInputElement) {
  const item = draft().items.find((i) => i.id === el.dataset.id);
  if (!item) return;
  const key = el.dataset.itemField;
  if (key === "carriage") {
    item.carriage = el.value;
    item.service = el.value !== "self";
    if (item.service) item.mode = "checked";
    refreshTransport();
  } else if (key === "service") item.service = el.checked;
  else if (["weight", "l", "w", "h"].includes(key))
    item[key] = el.value === "" ? null : Number(el.value);
  else item[key] = el.value;
  if (key === "mode" && item.mode === "cabin") item.service = false;
  state.agreed = false;
  invalidateAgent();
  persist();
}
function allowStep(next: number) {
  if (!familySessionPermission(next === 5 ? "payment" : "booking")) {
    toast(next === 5 ? "service.paymentDenied" : "service.bookingDenied"); return false;
  }
  if (state.processing) {
    toast("e.processing");
    return false;
  }
  if (next <= state.step) return true;
  if (state.step === 1) {
    const error = validateHelper();
    if (error) {
      toast(error);
      return false;
    }
  }
  if (state.step === 2) {
    const error = validateInformation();
    if (error) {
      toast(error);
      return false;
    }
  }
  if (state.step === 3) {
    if (next >= 4) preparePricingBoard();
    if (!saveDeclaration(true)) return false;
  }
  if (state.step === 4) {
    const q = pricingQuote();
    if (!q.valid) {
      toast(q.error);
      return false;
    }
    if (!saveDeclaration(true)) return false;
  }
  if (next === BOOK_PAGES.length) {
    const error = validateService();
    if (error) {
      toast(error);
      return false;
    }
    if (!saveDeclaration(true)) return false;
  }
  if (state.step === 1 && !state.family) startNewHelperApplication();
  return true;
}
export function onClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
  if (
    anchor &&
    !anchor.target &&
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    const url = new URL(anchor.href, window.location.href);
    if (
      url.origin === window.location.origin &&
      isAppPath(url.pathname) &&
      !url.hash
    ) {
      event.preventDefault();
      if (state.processing) {
        toast("e.processing");
        return;
      }
      if (anchor.dataset.step && !allowStep(Number(anchor.dataset.step)))
        return;
      if (anchor.hasAttribute("data-family-proxy") && !familyProxy(anchor))
        return;
      if (anchor.hasAttribute("data-family-self")) delete state.familyAccess;
      if (anchor.hasAttribute("data-family-direction")) {
        closeModal();
        const route = readRoute(url);
        go(route.page, undefined, route.helper);
        openFamilyInvite();
        return;
      }
      const route = readRoute(url);
      go(route.page, undefined, route.helper);
      return;
    }
  }
  const b = event.target.closest<HTMLButtonElement>("button");
  if (!b || b.disabled) return;
  if (b.dataset.agentAction) {
    if (b.dataset.agentAction === "clear") clearAgentConversation();
    if (b.dataset.agentAction === "retry") retryAgentQuestion();
    if (b.dataset.agentAction === "cancel") agentRuntime.controller?.abort();
    return;
  }
  if (b.dataset.reply) {
    state.agent.questionDraft = "";
    sendQuestion(t(b.dataset.reply));
    return;
  }
  if (b.dataset.question) {
    state.agent.questionDraft = "";
    state.agent.pending = null;
    sendQuestion(t(b.dataset.question));
    return;
  }
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case "finish-declaration":
      if (
        pricingQuote().valid &&
        pricingQuote().count === 0 &&
        saveDeclaration(true)
      )
        go("home");
      break;
    case "buy-required": {
      state.extraBags ??= {};
      state.extraBags[state.travellerId] = baggagePlan().required;
      state.agreed = false;
      invalidateAgent();
      persist();
      render();
      break;
    }
    case "helper-add-contact":
      closeModal();
      go("family", undefined, true);
      break;
    case "helper-send":
      if (sendHelperRequest()) {
        render();
        requestAnimationFrame(() =>
          document.getElementById("helperRequestStatus")?.focus(),
        );
      }
      break;
    case "helper-start-new":
      if (startNewHelperApplication()) {
        render();
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>("[data-helper-toggle]")?.focus(),
        );
      }
      break;
    case "font":
      state.large = !state.large;
      persist();
      render();
      break;
    case "next":
      if (allowStep(state.step + 1)) go("book", state.step + 1);
      break;
    case "add-item":
      draft().zero = false;
      draft().countUnknown = false;
      draft().items.push({
        id: "bag-" + Date.now() + "-" + draft().items.length,
        name: "@sample.newBag",
        category: "other",
        categories: ["other"],
        weight: null,
        l: null,
        w: null,
        h: null,
        mode: "checked",
        service: true,
        review: false,
      });
      state.agreed = false;
      invalidateAgent();
      persist();
      render();
      break;
    case "remove-item":
      draft().items = draft().items.filter((i) => i.id !== id);
      if (state.agent.itemId === id) state.agent.itemId = "";
      state.agreed = false;
      invalidateAgent();
      persist();
      render();
      break;
    case "save-declaration":
      if (saveDeclaration()) render();
      break;
    case "ask-item":
      state.agent.itemId = id;
      state.agent.pending = null;
      invalidateAgent();
      go("agent");
      break;
    case "source":
      modal(
        t("source." + id),
        t("source.details", {
          time: hk(state.agent.answer?.retrievedAt || state.clock),
          scope: answerRouteScope(
            state.agent.answer?.route || state.agent.route,
          ),
        }),
      );
      break;
    case "review-advice":
      reviewAdvice();
      break;
    case "apply-advice":
      applyAdvice();
      break;
    case "close-dialog":
      closeModal();
      break;
    case "pay":
      pay();
      break;
    case "event":
      recordHandover(b.dataset.kind);
      break;
    case "complete-service":
      completeService();
      break;
    case "cancel-order":
      cancelOrder(id);
      break;
    case "confirm-cancel":
      cancelOrder(id, true);
      break;
    case "contact":
      modal(t("journey.contact"), t("dialog.contactBody"));
      break;
    case "scenario":
      modal(t("dialog.resetTitle"), t("dialog.resetBody"), [
        {
          text: t("common.confirm"),
          action: "confirm-reset",
          id: b.dataset.scenario,
        },
        { text: t("common.cancel"), action: "close-dialog", light: true },
      ]);
      break;
    case "confirm-reset":
      closeModal();
      resetDemo(id);
      break;
    case "family-demo-link":
      if (simulateFamilyLink(familyPageLink(), familyDemoTravellerId)) {
        render();
        toast("link.statusLinked");
        focusFamilyHeading();
      }
      break;
    case "family-demo-unlink":
    case "family-demo-exit":
      if (b.dataset.action === "family-demo-exit") exitFamilyDemo();
      else setFamilyDemoUnlinked(familyDemoTravellerId, true, familyInvitePassengerId);
      toast("");
      render();
      focusFamilyHeading();
      break;
    case "family-add":
      openFamilyInvite(b.dataset.studentId || state.travellerId);
      break;
    case "family-activate":
      activateFamilyService();
      break;
    case "family-permissions":
    case "family-revoke":
      familyPermissionsDialog(id, b.dataset.action === "family-revoke");
      break;
    case "family-permissions-save":
    case "family-revoke-confirm":
      saveFamilyPermissions(id, b.dataset.action === "family-revoke-confirm");
      break;
    case "family-confirm":
      familyConfirm();
      break;
    case "family-invite-edit":
      editFamilyInvite();
      break;
    case "family-send": {
      const error = submitFamilyInvitation(
        familyInviteDraft,
        familyInvitePassengerId,
      );
      if (error) {
        editFamilyInvite(error);
        break;
      }
      closeModal();
      render();
      toast("notice.familyInvite");
      requestAnimationFrame(() =>
        document.getElementById("familyPendingTitle")?.focus(),
      );
      break;
    }
    case "family-preview":
      familyPreview(id);
      break;
    case "family-cancel-invite":
      confirmCancelFamilyInvitation(id);
      break;
    case "family-cancel-confirm": {
      const link = pendingFamilyInvitation(familyInvitePassengerId, id);
      if (cancelFamilyInvitation(link)) {
        closeModal();
        render();
        toast("notice.familyInviteCancelled");
        focusFamilyHeading();
      }
      break;
    }
    case "family-accept":
    case "family-decline": {
      const link = pendingFamilyInvitation(familyInvitePassengerId, id);
      const accepted = b.dataset.action === "family-accept";
      if (link && respondFamilyInvite(accepted, false, link, readFamilyConsent(link, true))) {
        closeModal();
        render();
        toast(accepted ? "notice.familyLinked" : "notice.familyDeclined");
        focusFamilyHeading();
      } else if (accepted) toast("service.confirmRequired");
      break;
    }
    case "family-change":
      familyChangeDialog(id);
      break;
    case "family-change-submit": {
      const fam = familyActionRecord(id),
        done = fam && requestFamilyChange(fam);
      closeModal();
      render();
      if (done) toast("notice.familyChange");
      break;
    }
    case "family-change-preview":
      familyChangeDialog(id, true);
      break;
    case "family-change-approve":
    case "family-change-decline": {
      const approved = b.dataset.action === "family-change-approve";
      if (reviewFamilyChange(familyActionRecord(id), approved)) {
        closeModal();
        render();
        toast(
          approved
            ? "notice.familyChangeApproved"
            : "notice.familyChangeDeclined",
        );
        focusFamilyHeading();
      }
      break;
    }
    case "family-progress-request":
      if (setFamilyProgress(id, "request")) {
        render();
        familyProgressDialog(id);
      }
      break;
    case "family-progress-preview":
      familyProgressDialog(id, true);
      break;
    case "family-progress-grant":
      familyPermissionsDialog(id);
      break;
    case "family-progress-decline":
      if (
        setFamilyProgress(
          id,
          "decline",
        )
      ) {
        closeModal();
        render();
      }
      break;
    case "family-occasion":
      setFamilyOccasion(b.dataset.occasion);
      render();
      break;
  }
}

export function onChange(event: ChangeEvent<HTMLElement>) {
  const el = event.target;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement))
    return;
  if (el.hasAttribute("data-family-student")) { openFamilyInvite(el.value); return; }
  if (el instanceof HTMLInputElement && (el.dataset.familyPermission || el.hasAttribute("data-family-confirm"))) {
    setFamilyDraftPermission(el); return;
  }
  if (el.dataset.familyField && el instanceof HTMLInputElement) {
    setFamilyField(el);
    return;
  }
  if (el.id === "chatQuestion") {
    state.agent.questionDraft = el.value;
    persist();
    render();
    return;
  }
  if (el.hasAttribute("data-helper-toggle") && el instanceof HTMLInputElement) {
    state.family = el.checked;
    state.agreed = false;
    persist();
    render();
    if (state.family && !pendingHelperRequest() && !helperContacts().length)
      helperNoContacts();
    return;
  }
  if (el.hasAttribute("data-helper-contact")) {
    selectHelper(el.value);
    render();
    return;
  }
  if (el.hasAttribute("data-language")) {
    setLanguage(el.value);
    closeModal();
    render();
    return;
  }
  if (el.dataset.field) {
    setField(el);
    render();
    return;
  }
  if (el.dataset.itemField && el instanceof HTMLInputElement) {
    setItemField(el);
    render();
  }
}

export function onSubmit(event: FormEvent<HTMLElement>) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "familyInviteForm") {
    event.preventDefault();
    familyConfirm();
  }
  if (form.id === "chatForm") {
    event.preventDefault();
    const question = String(new FormData(form).get("question") ?? "");
    state.agent.questionDraft = "";
    void sendQuestion(question);
  }
}
