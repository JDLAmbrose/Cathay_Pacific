import {
  FAMILY_FIELDS,
  FAMILY_PARENT,
  clone,
  linkedFamilyMember,
  linkedPassengerContacts,
  familyMemberId,
  familyMemberName,
  newFamilyContact,
  pendingFamilyInvitation,
  validateFamilyInvitation,
} from "../engine/booking";
import {
  familyInvitePassengerId,
  familyPageLink,
  helperFamilyPage,
} from "./navigation";
import { closeModal, modal, richModal, updateDialogBody } from "./runtime";
import { t } from "./i18n";
import { cx } from "../components/primitives";
import { icon } from "../components/shared";
import {
  FAMILY_EDITABLE,
  familyEmailHTML,
  familyFormHTML,
  familyStepsHTML,
  familySummaryHTML,
} from "../pages/family";
import type { FamilyLink } from "../types/domain";

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

export function openFamilyInvite() {
  const current = familyPageLink();
  familyInviteDraft = ["draft", "declined", "cancelled"].includes(
    current.status,
  )
    ? clone(current)
    : newFamilyContact(helperFamilyPage ? "email" : "member");
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
  error = undefined;
  updateDialogBody(familyFormHTML(familyInviteDraft));
}

export function familyConfirm() {
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
  return helperFamilyPage
    ? linkedPassengerContacts(familyInvitePassengerId).find(
        (link) => familyMemberId(link) === id,
      )
    : linkedFamilyMember(id);
}

export function familyChangeDialog(id: string) {
  const member = familyActionRecord(id);
  if (!member) return;
  richModal(
    t("link.changeTitle"),
    <>
      <p className={cx("dialog-lead")}>{t("link.changeBody")}</p>
      {familySummaryHTML(member)}
    </>,
    [
      { text: t("link.changeSubmit"), action: "family-change-submit", id },
      { text: t("common.cancel"), action: "close-dialog", light: true },
    ],
    "close-dialog",
  );
}

export function familyProgressDialog(id: string, preview = false) {
  const member = linkedFamilyMember(id);
  if (!member || !member.progressRequested || member.shareProgress) return;
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
