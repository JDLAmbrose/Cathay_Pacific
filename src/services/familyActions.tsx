import {
  FAMILY_FIELDS,
  FAMILY_PARENT,
  clone,
  linkedFamilyMember,
  linkedPassengerContacts,
  state,
  familyMemberId,
  familyInvitationId,
  familyMemberName,
  pendingFamilyInvitation,
  validateFamilyInvitation,
  familyTravellerId,
  familyKnownContact,
  familyStudentId,
  familyPolicy,
  familyServiceRecord,
  familyConnectionRecords,
  parentFamilyRecords,
  submitFamilyInvitation,
  respondFamilyInvite,
  updateFamilyPermissions,
  revokeFamilyService,
  familyVisibleRecords,
} from "../engine/booking";
import {
  familyInvitePassengerId,
  helperFamilyPage,
} from "./navigation";
import { closeModal, modal, richModal, updateDialogBody, toast, render } from "./runtime";
import { t } from "./i18n";
import { cx } from "../components/primitives";
import { icon } from "../components/shared";
import {
  FAMILY_EDITABLE,
  familyEmailHTML,
  familyFormHTML,
  familyStepsHTML,
  familySummaryHTML,
  familyGuardianGuidanceHTML,
  familyStudentChoiceHTML,
  familyPermissionControls,
  familyConsentHTML,
} from "../pages/family";
import type { FamilyLink, FamilyPermissions, FamilyConsent } from "../types/domain";

export let familyInviteDraft: FamilyLink;
let error: string;
const buttons = () => [
  { text: t("common.cancel"), action: "close-dialog", light: true },
  { text: t("link.reviewInvite"), action: "family-confirm" },
];

export function focusFamilyHeading() {
  requestAnimationFrame(() =>
    document.getElementById("familyMembersTitle")?.focus(),
  );
}

export function openFamilyInvite(studentId = state.travellerId) {
  familyInviteDraft = familyKnownContact(studentId, helperFamilyPage);
  const policy = familyPolicy(studentId);
  if (policy.serviceConsent === "unknown") {
    richModal(t("service.eligibilityTitle"), <>{familyStudentChoiceHTML(studentId)}<p className={cx("notice")}>{t("service.eligibilityUnknown")}</p><p className={cx("prototype-note")}>{t("service.externalDemo")}</p></>, [{ text: t("common.close"), action: "close-dialog", light: true }]);
    return;
  }
  if (policy.serviceConsent === "guardian" && policy.guardianStatus !== "linked") {
    richModal(t("service.guardianTitle"), familyGuardianGuidanceHTML(studentId), [{ text: t("common.close"), action: "close-dialog", light: true }]);
    return;
  }
  if (policy.serviceConsent === "guardian") {
    const records = familyVisibleRecords(helperFamilyPage, studentId);
    const existing = records.find((member) => familyStudentId(member) === studentId && member.status === "linked");
    if (existing) {
      familyPermissionsDialog(familyInvitationId(existing));
      return;
    }
    const pending = records.find((member) => familyStudentId(member) === studentId && member.status === "pending");
    if (pending) { familyPreview(familyInvitationId(pending)); return; }
    richModal(t("service.activate"), <>
      {familyStudentChoiceHTML(studentId)}
      <p className={cx("dialog-lead")}>{t("service.guardianExisting")}</p>
      {familySummaryHTML(familyInviteDraft)}
      {familyPermissionControls(familyInviteDraft, "consent")}
      {familyConsentHTML("guardian")}
      <p className={cx("prototype-note")}>{t("service.externalDemo")}</p>
    </>, [{ text: t("common.cancel"), action: "close-dialog", light: true }, { text: t("service.activate"), action: "family-activate" }]);
    return;
  }
  editFamilyInvite();
}

function fieldForError(message: string) {
  return {
    "e.familyMethod": "method",
    "e.familyMember": "memberNo",
    "e.familyMobile": "mobile",
    "e.familyEmail": "email",
    "e.familyName": familyInviteDraft.surname.trim() ? "givenName" : "surname",
    "e.familyRelationship": "relationship",
    "e.familyDuplicate": FAMILY_FIELDS[familyInviteDraft.method],
    "e.familyInvitePending": FAMILY_FIELDS[familyInviteDraft.method],
  }[message];
}

export function editFamilyInvite(message?: string) {
  error = message;
  richModal(
    t("link.inviteMember"),
    familyFormHTML(
      familyInviteDraft,
      error,
      message ? fieldForError(message) : undefined,
    ),
    buttons(),
    undefined,
    message ? fieldForError(message) : "surname",
  );
}

export function setFamilyField(element: HTMLInputElement) {
  const key = element.dataset.familyField as keyof FamilyLink;
  if (
    !familyInviteDraft ||
    !FAMILY_EDITABLE.includes(key) ||
    (element.type === "radio" && !element.checked)
  )
    return;
  Object.assign(familyInviteDraft, { [key]: element.value });
  if (!helperFamilyPage) familyInviteDraft.service.studentId = familyTravellerId(familyInviteDraft);
  error = undefined;
  updateDialogBody(familyFormHTML(familyInviteDraft));
}

export function setFamilyDraftPermission(element: HTMLInputElement) {
  if (!familyInviteDraft?.service) return;
  const key = element.dataset.familyPermission as keyof FamilyPermissions;
  if (["booking", "payment", "progress"].includes(key)) familyInviteDraft.service.permissions[key] = element.checked;
  else if (element.hasAttribute("data-family-confirm")) familyInviteDraft.service.studentConfirmed = element.checked;
  updateDialogBody(familyFormHTML(familyInviteDraft));
}

export function readFamilyPermissions(): FamilyPermissions {
  const checked = (key: string) => !!document.getElementById("familyPermission-" + key) && (document.getElementById("familyPermission-" + key) as HTMLInputElement).checked;
  return { booking: checked("booking"), payment: checked("payment"), progress: checked("progress") };
}
export function readFamilyConsent(link: FamilyLink, recipient = false): FamilyConsent {
  const role = familyPolicy(familyStudentId(link)).serviceConsent === "self"
    ? recipient && link.service?.initiatedBy === "student" ? "family" : "student" : "guardian";
  return { role, confirmed: !!(document.getElementById("familyConsent") as HTMLInputElement)?.checked, permissions: readFamilyPermissions() };
}
export function activateFamilyService() {
  const consent = readFamilyConsent(familyInviteDraft);
  if (!consent.confirmed) { toast("service.confirmRequired"); return; }
  const error = submitFamilyInvitation(familyInviteDraft, familyInvitePassengerId);
  if (error) { toast(error); return; }
  const link = (helperFamilyPage ? familyConnectionRecords(familyInvitePassengerId) : parentFamilyRecords()).find((member) => member.status === "pending" && familyStudentId(member) === familyStudentId(familyInviteDraft));
  if (link && respondFamilyInvite(true, false, link, consent)) {
    closeModal(); render(); toast("notice.familyLinked"); focusFamilyHeading();
  }
}
export function familyPermissionsDialog(id: string, revoke = false) {
  const member = familyServiceRecord(id);
  if (!member || member.status !== "linked") return;
  const role = familyPolicy(familyStudentId(member)).serviceConsent === "self" ? "student" : "guardian";
  const preview = clone(member);
  preview.service.journey = { bookingId: state.flight.bookingId, legId: state.flight.legId };
  richModal(t(revoke ? "service.revoke" : "service.manage"), <>
    <p className={cx("dialog-lead")}>{t(revoke ? "service.revokeBody" : "service.manageBody")}</p>
    {familySummaryHTML(member)}
    {!revoke && familyPermissionControls(preview, "manage")}
    {familyConsentHTML(role)}
  </>, [{ text: t("common.cancel"), action: "close-dialog", light: true }, { text: t(revoke ? "service.revoke" : "service.save"), action: revoke ? "family-revoke-confirm" : "family-permissions-save", id }]);
}
export function saveFamilyPermissions(id: string, revoke = false) {
  const member = familyServiceRecord(id);
  if (!member) return;
  const consent = readFamilyConsent(member);
  const changed = revoke ? revokeFamilyService(member, consent) : updateFamilyPermissions(member, readFamilyPermissions(), consent);
  if (!changed) { toast("service.confirmRequired"); return; }
  closeModal(); render(); toast(revoke ? "service.revoked" : "service.saved"); focusFamilyHeading();
}

export function familyConfirm() {
  if (!helperFamilyPage && familyPolicy(familyTravellerId(familyInviteDraft)).serviceConsent === "guardian") {
    openFamilyInvite(familyTravellerId(familyInviteDraft)); return;
  }
  const message = validateFamilyInvitation(
    familyInviteDraft,
    familyInvitePassengerId,
  );
  if (message) {
    error = message;
    updateDialogBody(
      familyFormHTML(
        familyInviteDraft,
        error,
        message ? fieldForError(message) : undefined,
      ),
    );
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLElement>(
        `#familyInviteForm [data-family-field="${fieldForError(error)}"]`,
      );
      (input ?? document.getElementById("familyFormError"))?.focus();
    });
    return;
  }
  richModal(
    t("link.confirmTitle"),
    <>
      {familyStepsHTML(2)}
      <p className={cx("dialog-lead")}>{t("link.confirmIntro")}</p>
      {familySummaryHTML(familyInviteDraft)}
      <div className={cx("notice family-warning")}>
        {icon("shield")}
        <span>{t("link.confirmWarning")}</span>
      </div>
      <p className={cx("prototype-note")}>{t("link.previewNote")}</p>
    </>,
    [
      {
        text: t("link.confirmBack"),
        action: "family-invite-edit",
        light: true,
      },
      { text: t("link.confirmSend"), action: "family-send" },
    ],
    "family-invite-edit",
  );
}

export function confirmCancelFamilyInvitation(id: string) {
  if (!pendingFamilyInvitation(familyInvitePassengerId, id)) return;
  modal(t("link.cancelInviteTitle"), t("link.cancelInviteBody"), [
    { text: t("common.back"), action: "close-dialog", light: true },
    { text: t("link.cancelInvite"), action: "family-cancel-confirm", id },
  ]);
}

export function familyPreview(id: string) {
  const member = pendingFamilyInvitation(familyInvitePassengerId, id);
  if (!member) return;
  richModal(t("link.emailTitle"), familyEmailHTML(member), [
    { text: t("link.emailAccept"), action: "family-accept", id },
    { text: t("link.emailDecline"), action: "family-decline", id, light: true },
  ]);
}

export function familyActionRecord(id: string) {
  if (id.startsWith("helper:")) {
    return linkedPassengerContacts(
      familyInvitePassengerId ?? state.travellerId,
    ).find((link) => familyMemberId(link) === id.slice("helper:".length));
  }
  return linkedFamilyMember(id);
}

export function familyChangeDialog(id: string, preview = false) {
  const member = familyActionRecord(id);
  if (!member || (preview && member.changeRequest?.status !== "pending"))
    return;
  const buttons = preview
    ? [
        { text: t("link.changeApprove"), action: "family-change-approve", id },
        {
          text: t("link.changeDecline"),
          action: "family-change-decline",
          id,
          light: true,
        },
        { text: t("common.close"), action: "close-dialog", light: true },
      ]
    : [
        { text: t("link.changeSubmit"), action: "family-change-submit", id },
        { text: t("common.cancel"), action: "close-dialog", light: true },
      ];
  richModal(
    t(preview ? "link.changePreview" : "link.changeTitle"),
    <>
      <p className={cx("dialog-lead")}>
        {t(preview ? "link.changeReviewBody" : "link.changeBody")}
      </p>
      {familySummaryHTML(member)}
    </>,
    buttons,
    "close-dialog",
  );
}

export function familyProgressDialog(id: string, preview = false) {
  const member = familyServiceRecord(id);
  if (!member || !member.progressRequested || member.shareProgress) return;
  if (preview) { familyPermissionsDialog(id); return; }
  const args = { name: familyMemberName(member), parent: FAMILY_PARENT.name };
  const buttons = preview
    ? [
        { text: t("link.progressGrant"), action: "family-progress-grant", id },
        {
          text: t("link.progressDecline"),
          action: "family-progress-decline",
          id,
          light: true,
        },
      ]
    : [
        {
          text: t("link.progressPreview"),
          action: "family-progress-preview",
          id,
        },
        { text: t("common.close"), action: "close-dialog", light: true },
      ];
  richModal(
    t(preview ? "link.progressConsent" : "link.progressRequested"),
    <>
      <p className={cx("dialog-lead")}>
        {t(
          preview ? "link.progressConsentBody" : "link.progressRequestBody",
          args,
        )}
      </p>
      <p className={cx("prototype-note")}>{t("link.progressDemo")}</p>
    </>,
    buttons,
  );
}

export { closeModal };
