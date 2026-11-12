import type { ReactNode } from "react";
import type { FamilyLink } from "../types/domain";
import {
  fmt,
  hk,
  PEOPLE,
  ticketAllowance,
  FAMILY_METHODS,
  FAMILY_FIELDS,
  FAMILY_PARENT,
  MEMBERSHIP_TIERS,
  familyInvitationId,
  familyIdentifier,
  familyMemberName,
  familyDemoUnlinked,
  familyBenefitMember,
  familyLinked,
  familyProgressAccess,
  familyPromoCode,
  state,
  familyKnownContact,
  familyPolicy,
  familyStudentId,
  familyServiceEstablished,
  familyPermission,
  familyVisibleRecords,
} from "../engine/booking";
import { t, language } from "../services/i18n";
import {
  page,
  helperFamilyPage,
  familyInvitePassengerId,
  familyDemoTravellerId,
} from "../services/navigation";
import { href } from "../config/routes";
import { cathayGuardianGuidanceUrl, cathayMembershipSignUpUrl } from "../config/urls";
import { cx, keyed, Input, Select, Option } from "../components/primitives";
import { FamilyMilestonesCard } from "../components/FamilyMilestones";
import {
  icon,
  productName,
  productMark,
  link,
  row,
  text,
  T,
  V,
} from "../components/shared";

const FAMILY_INPUTS: Record<
  string,
  [string, import("react").InputHTMLAttributes<HTMLInputElement>]
> = {
  member: [
    "text",
    { inputMode: "numeric", autoComplete: "off", maxLength: 20 },
  ],
  mobile: ["tel", { autoComplete: "off", maxLength: 24 }],
  email: ["email", { autoComplete: "off", maxLength: 120, spellCheck: false }],
};
const FAMILY_EDITABLE = [
  "method",
  "memberNo",
  "mobile",
  "email",
  "surname",
  "givenName",
  "relationship",
];
const FAMILY_BENEFIT_ROWS: [string, number[]][] = [
  ["overview", [1, 1, 1, 1, 1]],
  ["companion", [1, 1, 1, 1, 1]],
  ["milestones", [1, 1, 1, 1, 1]],
  ["priority", [0, 0, 1, 1, 1]],
  ["manager", [0, 0, 0, 0, 1]],
];
let familyOccasion = "enrol";
export function setFamilyOccasion(occasion: string) {
  familyOccasion = ["enrol", "holiday", "graduation"].includes(occasion)
    ? occasion
    : "enrol";
}
// Chinese copy has no spaces around names; Latin names still need them.
function inlineName(name) {
  name = String(name ?? "").trim();
  return language === "zh-Hant" && /^[A-Za-z0-9]|[A-Za-z0-9]$/.test(name)
    ? ` ${name} `
    : name;
}
function familyGivenName(fam = familyBenefitMember()) {
  return String(fam.givenName || "").trim() || familyMemberName(fam);
}
function familyInitials(fam) {
  const surname = String(fam.surname || "").trim(),
    given = String(fam.givenName || "").trim();
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(surname)
    ? surname[0]
    : ((given[0] || "") + (surname[0] || "")).toUpperCase();
}
function maskEmail(value) {
  const [user, domain] = String(value).split("@");
  return domain
    ? `${user[0] || ""}•••${user.length > 1 ? user.at(-1) : ""}@${domain}`
    : String(value);
}
function familyHead(title, sub) {
  return (
    <div className={cx("pagehead reveal")}>
      <div>
        <div className={cx("eyebrow page-identity")}>
          {productMark()}
          <span>
            {text(productName())}
            {page === "benefits" ? " / FAMILY" : ""}
          </span>
        </div>
        <h1>{T(title)}</h1>
        <p>{T(sub)}</p>
      </div>
    </div>
  );
}
function familyStepsHTML(current) {
  return (
    <ol className={cx("steps family-steps")} aria-label={T("link.progress")}>
      {keyed(
        ["link.step1", "link.step2"].map((key, i) => (
          <li
            className={cx("step" + String(i + 1 < current ? " done" : ""))}
            {...(i + 1 === current ? { "aria-current": "step" } : {})}
          >
            <i>{i + 1 < current ? "✓" : i + 1}</i>
            <span>{T(key)}</span>
          </li>
        )),
      )}
    </ol>
  );
}
function familyChoiceHTML(
  field,
  value,
  current,
  ic,
  label,
  invalidField?: string,
) {
  return (
    <label className={cx("carriage-option family-choice")}>
      <Input
        type={"radio"}
        name={"family-" + String(field)}
        value={value}
        data-family-field={field}
        aria-invalid={invalidField === field || undefined}
        checked={current === value}
      />
      <span className={cx("carriage-top")}>
        {icon(ic)}
        <span className={cx("carriage-radio")} aria-hidden={"true"} />
      </span>
      <strong>{T(label)}</strong>
      {helperFamilyPage && field === "relationship" ? (
        ""
      ) : (
        <small>{T(label + "Hint")}</small>
      )}
    </label>
  );
}
function familyIdentifierHTML(fam, method = fam.method, invalidField?: string) {
  const [type, extra] = FAMILY_INPUTS[method] || FAMILY_INPUTS.member,
    key = FAMILY_FIELDS[method] || "memberNo";
  return (
    <label className={cx("field " + String(helperFamilyPage ? "" : "full"))}>
      <span>{T("link.input." + method)}</span>
      <Input
        className={cx("input")}
        id={
          helperFamilyPage ? "familyIdentifier-" + method : "familyIdentifier"
        }
        type={type}
        dir={"ltr"}
        data-family-field={key}
        aria-invalid={invalidField === key || undefined}
        value={V(fam[key])}
        {...extra}
      />
    </label>
  );
}
function familyPanelHead(n, id, title, sub) {
  return (
    <div className={cx("address-panel-heading")}>
      <span className={cx("panel-number")}>
        {"0"}
        {n}
      </span>
      <div>
        <h3 id={id}>{T(title)}</h3>
        <p>{T(sub)}</p>
      </div>
    </div>
  );
}
function familyFormHTML(fam, error?: string, invalidField?: string) {
  return (
    <form id={"familyInviteForm"} noValidate>
      {familyStepsHTML(1)}
      {familyStudentChoiceHTML(familyStudentId(fam))}
      <p className={cx("dialog-lead")}>{T("link.formSub")}</p>{" "}
      <a className={cx("textbtn")} href={href("family", 1, !helperFamilyPage)} data-family-direction="">
        {T(helperFamilyPage ? "service.switchFamily" : "service.switchStudent")}
      </a>
      <section
        className={cx("address-panel family-panel")}
        aria-labelledby={"familyNameTitle"}
      >
        {familyPanelHead(
          1,
          "familyNameTitle",
          "link.nameTitle",
          "link.nameSub",
        )}
        <div className={cx("fields")}>
          {keyed(
            [
              ["surname", "link.surname"],
              ["givenName", "link.givenName"],
            ].map(([key, label]) => (
              <label className={cx("field")}>
                <span>{T(label)}</span>
                <Input
                  className={cx("input")}
                  data-family-field={key}
                  aria-invalid={invalidField === key || undefined}
                  value={V(fam[key])}
                  maxLength={60}
                  autoComplete={"off"}
                />
              </label>
            )),
          )}
        </div>
      </section>{" "}
      <fieldset
        className={cx("address-panel family-panel")}
        aria-labelledby={"familyAccountTitle"}
      >
        {familyPanelHead(
          2,
          "familyAccountTitle",
          "link.accountTitle",
          helperFamilyPage ? "helper.contactAccountSub" : "link.accountSub",
        )}
        {helperFamilyPage ? (
          ""
        ) : (
          <div className={cx("carriage-grid family-choices")}>
            {keyed(
              [
                ["member", "card"],
                ["mobile", "phone"],
                ["email", "mail"],
              ].map(([method, ic]) =>
                familyChoiceHTML(
                  "method",
                  method,
                  fam.method,
                  ic,
                  "link.method." + method,
                  invalidField,
                ),
              ),
            )}
          </div>
        )}
        <div className={cx("fields")}>
          {keyed(
            (helperFamilyPage ? FAMILY_METHODS : [fam.method]).map((method) =>
              familyIdentifierHTML(fam, method, invalidField),
            ),
          )}
        </div>
      </fieldset>{" "}
      <fieldset
        className={cx("address-panel family-panel")}
        aria-labelledby={"familyRelationshipTitle"}
      >
        {familyPanelHead(
          3,
          "familyRelationshipTitle",
          helperFamilyPage ? "helper.relationship" : "link.relationshipTitle",
          "link.relationshipSub",
        )}
        <div className={cx("carriage-grid family-choices")}>
          {keyed(
            [
              ["parent", "parent"],
              ["guardian", "shield"],
              ["other", "home"],
            ].map(([relationship, ic]) =>
              familyChoiceHTML(
                "relationship",
                relationship,
                fam.relationship,
                ic,
                "link.rel." + relationship,
                invalidField,
              ),
            ),
          )}
        </div>
      </fieldset>{" "}
      {helperFamilyPage ? (
        <>
          {familyPermissionControls(fam, "draft")}
          {familyConsentHTML("student", true, fam)}
        </>
      ) : (
        <div className={cx("note")}>{T("link.privacyNote")}</div>
      )}{" "}
      <p className={cx("prototype-note")}>{T("service.memberDemo")}</p>
      <a href={cathayMembershipSignUpUrl(language)} target="_blank" rel="noopener noreferrer" className={cx("textbtn")}>{T("service.register")}</a>
      <p
        className={cx("notice error")}
        id={"familyFormError"}
        role={"alert"}
        tabIndex={-1}
        hidden={!error}
      >
        {error ? T(error) : null}
      </p>
      <button type={"submit"} hidden />
    </form>
  );
}
export function familyStudentChoiceHTML(studentId = state.travellerId) {
  return <label className={cx("field family-subject")}>
    <span>{T("service.student")}</span>
    {helperFamilyPage ? <strong>{text(PEOPLE.find((p) => p.id === studentId)?.name)}</strong> :
      <Select className={cx("input")} data-family-student="">
        {PEOPLE.map((p) => <Option key={p.id} value={p.id} selected={p.id === studentId}>{p.name}</Option>)}
      </Select>}
  </label>;
}
export function familyRelationshipStatusHTML(fam: FamilyLink) {
  const policy = familyPolicy(familyStudentId(fam));
  return <p className={cx("family-official-status")}>
    {T("service.officialLabel")} · {T("service.official." + policy.guardianStatus)} · {T("common.demo")}
  </p>;
}
export function familyPermissionControls(fam: FamilyLink, mode: "draft" | "consent" | "manage", editable = true) {
  return <fieldset className={cx("family-permission-options")}>
    <legend>{T("service.permissions")}</legend>
    {(["booking", "payment", "progress"] as const).map((permission) =>
      <label className={cx("check family-permission")} key={permission}>
        <Input type="checkbox" id={"familyPermission-" + permission}
          {...(mode === "draft" ? { checked: !!fam.service?.permissions[permission], "data-family-permission": permission }
            : { defaultChecked: !!fam.service?.permissions[permission] })}
          disabled={!editable} />
        <span><strong>{T("service.permission." + permission)}</strong><small>{T("service.permissionHint." + permission)}</small></span>
      </label>)}
    <small className={cx("muted")}>{T("service.scope", { journey: fam.service?.journey?.legId ?? state.flight.legId })}</small>
  </fieldset>;
}
export function familyConsentHTML(role: "student" | "guardian" | "family", draft = false, fam?: FamilyLink) {
  return <label className={cx("check family-share")}>
    <Input type="checkbox" id="familyConsent" {...(draft ? { checked: !!fam?.service?.studentConfirmed, "data-family-confirm": "" } : {})} />
    <span><strong>{T("service.consent." + role)}</strong><small>{T("service.consentDemo")}</small></span>
  </label>;
}
export function familyGuardianGuidanceHTML(studentId: string) {
  return <>
    {familyStudentChoiceHTML(studentId)}
    <div className={cx("notice family-warning")}>{icon("shield")}<span>{T("service.guardianRequired")}</span></div>
    <p className={cx("dialog-lead")}>{T("service.guardianSteps")}</p>
    <a className={cx("btn light")} href={cathayGuardianGuidanceUrl(language)} target="_blank" rel="noopener noreferrer">{T("service.guardianOfficial")}{icon("arrow")}</a>
    <p className={cx("prototype-note")}>{T("service.externalDemo")}</p>
  </>;
}
function familySummaryHTML(fam, extra: ReactNode = null) {
  return (
    <div className={cx("family-summary")}>
      {row("link.summary.member", text(familyMemberName(fam)))}
      {row(
        "link.summary.method",
        <>
          {T("link.method." + fam.method)}
          {" · "}
          <bdi dir={"ltr"}>{text(familyIdentifier(fam))}</bdi>
        </>,
      )}
      {row("link.summary.relationship", T("link.rel." + fam.relationship))}
      {familyRelationshipStatusHTML(fam)}
      {extra}
    </div>
  );
}
function familyChangeHTML(fam, id = "") {
  if (fam.changeRequest?.status !== "pending") {
    return (
      <button
        type={"button"}
        className={cx("textbtn")}
        data-action={"family-change"}
        data-id={text(id)}
      >
        {T("link.changeRequest")}
      </button>
    );
  }
  return (
    <div className={cx("actions")}>
      <span className={cx("pill gold")}>
        {icon("clock")}
        {T("link.changePending", { time: hk(fam.changeRequest.submittedAt) })}
      </span>
      <button
        type={"button"}
        className={cx("textbtn")}
        data-action={"family-change-preview"}
        data-id={text(id)}
      >
        {T("link.changePreview")}
      </button>
    </div>
  );
}
function familyPendingHTML(invitations) {
  if (!invitations.length) return "";
  return (
    <section
      className={cx("card family-invite-list")}
      aria-labelledby={"familyPendingTitle"}
    >
      <div className={cx("subhead")}>
        <div>
          <h2 id={"familyPendingTitle"} tabIndex={-1}>
            {T("link.invitationsPending")}
          </h2>
          <p>{T("link.pendingSub")}</p>
        </div>
        <span className={cx("pill gold")}>
          {T("link.pendingCount", { n: fmt(invitations.length) })}
        </span>
      </div>{" "}
      {keyed(
        invitations.map((fam) => {
          const id = text(familyInvitationId(fam));
          return (
            <article className={cx("family-status")}>
              <span className={cx("feature-icon")} aria-hidden={"true"}>
                {icon("mail")}
              </span>
              <div className={cx("family-invite-item")}>
                <strong>
                  {text(familyMemberName(fam))}
                  {" · "}
                  {T("link.statusPending")}
                </strong>
                <p>
                  {T("link.method." + fam.method)}
                  {" · "}
                  <bdi dir={"ltr"}>{text(maskedFamilyAccount(fam))}</bdi>
                  {" · "}
                  {T("link.rel." + fam.relationship)}
                </p>{" "}
                {familyRelationshipStatusHTML(fam)}
                <p>{T(fam.service?.initiatedBy === "family" ? "service.awaitStudent" : "service.awaitFamily")}</p>
                <div className={cx("actions")}>
                  <button
                    type={"button"}
                    className={cx("textbtn")}
                    data-action={"family-preview"}
                    data-id={id}
                  >
                    {T("link.previewEmail")}
                  </button>
                  <button
                    type={"button"}
                    className={cx("textbtn")}
                    data-action={"family-cancel-invite"}
                    data-id={id}
                  >
                    {T("link.cancelInvite")}
                  </button>
                </div>
              </div>
            </article>
          );
        }),
      )}
      <p className={cx("prototype-note")}>{T("link.previewNote")}</p>
    </section>
  );
}
function maskedFamilyAccount(fam) {
  const value = familyIdentifier(fam);
  return fam.method === "email"
    ? maskEmail(value)
    : "•••• " + value.replace(/\D/g, "").slice(-4);
}
function familyMemberCard(fam: FamilyLink, isHelper = false) {
  const studentId = familyStudentId(fam), id = familyInvitationId(fam);
  const display = isHelper === (fam.service?.initiatedBy === "student") ? fam : familyKnownContact(studentId, isHelper);
  const established = familyServiceEstablished(fam), revoked = fam.status === "revoked";
  const hasTicket = !!state.drafts[studentId] && !!ticketAllowance(studentId);
  const access = familyProgressAccess(fam);
  return <article className={cx("family-member card")} key={id}>
    <header className={cx("family-member-top")}>
      <span className={cx("member-initials")} aria-hidden="true">{text(familyInitials(display))}</span>
      <div><h3>{text(familyMemberName(display))}</h3><p>{T("link.rel." + fam.relationship)} · <bdi>{text(maskedFamilyAccount(display))}</bdi></p></div>
      <span className={cx("pill", established ? "" : "gold")}>{T(established ? "service.established" : revoked ? "service.revoked" : "service.notAuthorized")}</span>
    </header>
    {familyRelationshipStatusHTML(fam)}
    <div className={cx("member-permissions")}>
      {(["booking", "payment", "progress"] as const).map((permission) =>
        <span key={permission}>{icon(familyPermission(fam, permission) ? "check" : "shield")}{T(familyPermission(fam, permission) ? "service.permission." + permission : "service.denied." + permission)}</span>)}
    </div>
    <div className={cx("actions")}>
      {!isHelper && hasTicket && familyPermission(fam, "booking") &&
        <a className={cx("btn slim light")} href={href("book", 2)} data-family-proxy={id}>{T("link.proxyCta", { name: inlineName(familyGivenName(display)) })}{icon("arrow")}</a>}
      {!isHelper && hasTicket && familyPermission(fam, "payment") &&
        <a className={cx("textbtn")} href={href("book", 5)} data-family-proxy={id} data-family-payment="">{T("service.payCta")}{icon("arrow")}</a>}
      {!isHelper && access === "ready" &&
        <a className={cx("textbtn")} href={href("journey")} data-family-proxy={id} data-family-progress="">{T("link.progressCta")}{icon("arrow")}</a>}
      {!isHelper && access === "waiting" && <small className={cx("muted")}>{T("link.progressWaiting")}</small>}
      {established || fam.status === "linked" ?
        <button type="button" className={cx("textbtn")} data-action="family-permissions" data-id={id}>{T("service.manage")}</button> :
        <button type="button" className={cx("textbtn")} data-action="family-add" data-student-id={studentId}>{T(revoked ? "service.inviteAgain" : "service.activate")}</button>}
      {established && <button type="button" className={cx("textbtn")} data-action="family-revoke" data-id={id}>{T("service.revoke")}</button>}
    </div>
    {isHelper && <p className={cx("prototype-note")}>{T("service.studentManage")}</p>}
  </article>;
}
function familyRosterHTML(members, helpers) {
  const count = [...members, ...helpers].filter(familyServiceEstablished).length;
  return (
    <section
      className={cx("family-roster card")}
      aria-labelledby={"familyMembersTitle"}
    >
      <div className={cx("subhead")}>
        <div>
          <h2 id={"familyMembersTitle"} tabIndex={-1}>
            {T("link.memberLabel")}
          </h2>
        </div>
        <span className={cx("pill")}>
          {T("link.memberCount", { n: fmt(count) })}
        </span>
      </div>{" "}
      {members.length + helpers.length ? (
        <>
          <div className={cx("family-member-grid")}>
            {keyed(members.map((member) => familyMemberCard(member)))}
            {keyed(helpers.map((member) => familyMemberCard(member, true)))}
          </div>
          {members.length ? (
            <p className={cx("prototype-note")}>{T("service.separateRelations")}</p>
          ) : (
            ""
          )}
        </>
      ) : (
        <div className={cx("family-roster-empty")}>
          {icon("parent")}
          <div>
            <strong>{T("helper.noContactsTitle")}</strong>
            <p>{T("link.membersEmpty")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
function familyDemoPassengerLink() {
  return (
    <a
      className={cx("btn light")}
      href={href("book")}
      data-family-self=""
    >
      {T("link.viewPassenger")}
      {icon("arrow", "arrow")}
    </a>
  );
}
function familyDemoControls(unlinked) {
  return (
    <div className={cx("actions family-demo-actions")}>
      <button
        type={"button"}
        className={cx("btn slim light")}
        data-action={"family-demo-link"}
      >
        {T("link.demoLink")}
      </button>{" "}
      <button
        type={"button"}
        className={cx("btn slim light")}
        data-action={"family-demo-unlink"}
        {...(unlinked ? { disabled: true } : {})}
      >
        {T("link.demoUnlink")}
      </button>{" "}
      {unlinked || state.familyDemo ? (
        <button
          type={"button"}
          className={cx("textbtn")}
          data-action={"family-demo-exit"}
        >
          {T(unlinked ? "link.demoExit" : "service.demoExitLinked")}
        </button>
      ) : (
        ""
      )}
    </div>
  );
}
function FamilyPage() {
  const unlinked = familyDemoUnlinked(familyDemoTravellerId);
  const records = unlinked ? [] : familyVisibleRecords(helperFamilyPage);
  const members = helperFamilyPage ? [] : records.filter((member) => member.status !== "pending");
  const helpers = helperFamilyPage ? records.filter((member) => member.status !== "pending") : [];
  const subject = state.travellerId;
  const policy = familyPolicy(subject);
  if (!unlinked && policy.serviceConsent === "guardian" && policy.guardianStatus === "linked" &&
      ![...members, ...helpers].some((member) => familyStudentId(member) === subject)) {
    (helperFamilyPage ? helpers : members).push(familyKnownContact(subject, helperFamilyPage));
  }
  const invitations = records.filter((member) => member.status === "pending");
  return (
    <>
      {familyHead(
        "link.title",
        helperFamilyPage ? "helper.linkSub" : "link.sub",
      )}
      <div className={cx("family-workspace reveal")}>
        <div className={cx("card")}>
          {familyDemoControls(unlinked)}{" "}
          {unlinked ? (
            <p className={cx("dialog-lead")}>{T("link.demoUnlinkedBody")}</p>
          ) : (
            ""
          )}{" "}
          {state.familyDemo && <p className={cx("prototype-note")}>{T("service.demoOverlay")}</p>}
          <div className={cx("family-hints")}>
            <p>{T("service.minorHint")}</p><p>{T("service.adultHint")}</p>
          </div>
          <div className={cx("actions")}>
            <button
              type={"button"}
              className={cx("btn")}
              data-action={"family-add"}
            >
              {icon("person")}
              {T("link.addMember")}
            </button>
            {familyDemoPassengerLink()}
          </div>
        </div>
        {familyRosterHTML(members, helpers)}
        {familyPendingHTML(invitations)}
      </div>
    </>
  );
}
function familyEmailHTML(fam: FamilyLink) {
  const student = PEOPLE.find((p) => p.id === familyStudentId(fam));
  const fromStudent = fam.service?.initiatedBy === "student";
  const role = familyPolicy(familyStudentId(fam)).serviceConsent === "self" ? (fromStudent ? "family" : "student") : "guardian";
  return <>
    <article className={cx("email-preview")}>
      <div className={cx("email-meta")}>
        <strong>{T("service.recipientPreview", { name: fromStudent ? familyMemberName(fam) : student?.name ?? familyMemberName(fam) })}</strong>
        <p>{T("service.invitedBy", { name: fromStudent ? student?.name ?? "" : FAMILY_PARENT.name })}</p>
      </div>
      <div className={cx("email-body")}>
        {productMark()}
        <p>{T(role === "guardian" ? "service.guardianExisting" : fromStudent ? "service.studentInvitation" : "service.familyInvitation")}</p>
        {familySummaryHTML(fam)}
        {familyPermissionControls(fam, "consent", !fromStudent)}
        {familyConsentHTML(role)}
      </div>
    </article>
    <p className={cx("prototype-note")}>{T("service.externalDemo")}</p>
  </>;
}
function proposedBadge() {
  return <span className={cx("proposed-badge")}>{T("benefit.proposed")}</span>;
}
function milestoneCardHTML() {
  return <FamilyMilestonesCard />;
}
function occasionText() {
  return T("benefit.occasionText." + familyOccasion, {
    name: inlineName(
      familyLinked() ? familyGivenName() : t("benefit.familyFallback"),
    ),
  });
}
function companionCardHTML() {
  const linked = familyLinked(),
    code = familyPromoCode(),
    promoKey = !linked
      ? "benefit.promoNeedsLink"
      : code
        ? "benefit.promoIssued"
        : "benefit.promoNotIssued";
  return (
    <article
      className={cx("card benefit-card companion-card")}
      aria-labelledby={"companionTitle"}
    >
      <h2 id={"companionTitle"}>
        {linked
          ? T("benefit.companionTitle", {
              name: inlineName(familyGivenName()),
            })
          : T("benefit.companionTitleAnon")}
      </h2>
      <div
        className={cx("occasion-tabs")}
        role={"group"}
        aria-label={T("benefit.occasionLabel")}
      >
        {keyed(
          ["enrol", "holiday", "graduation"].map((occasion) => (
            <button
              type={"button"}
              data-action={"family-occasion"}
              data-occasion={occasion}
              aria-pressed={familyOccasion === occasion}
            >
              {T("benefit.occasion." + occasion)}
            </button>
          )),
        )}
      </div>
      <p
        className={cx("benefit-text")}
        id={"occasionText"}
        aria-live={"polite"}
      >
        {occasionText()}
      </p>
      <div className={cx("promo-box" + String(code ? " issued" : ""))}>
        <div>
          <span className={cx("eyebrow")}>{T("benefit.promoLabel")}</span>
          <strong dir={"ltr"}>{code ? text(code) : "FAMILY-••••-••••"}</strong>
        </div>
        <span className={cx("promo-state")}>{T(promoKey)}</span>
      </div>
      {code ? (
        <p className={cx("promo-note")}>{T("benefit.promoDemoNote")}</p>
      ) : (
        ""
      )}
      <ol className={cx("promo-steps")}>
        {keyed(
          [1, 2, 3].map((n) => (
            <li>
              <span>{n}</span>
              <p>{T("benefit.promoStep" + n)}</p>
            </li>
          )),
        )}
      </ol>
      <p className={cx("eligibility")}>
        <strong>{T("benefit.eligibilityLabel")}</strong>
        {language === "zh-Hant" ? "" : " "}
        {T("benefit.eligibility")}
      </p>
      <a
        className={cx("btn")}
        href={"https://www.cathaypacific.com/"}
        target={"_blank"}
        rel={"noopener noreferrer"}
      >
        {T("benefit.bookCta")}
        {icon("external")}
        <span className={cx("sr-only")}>{T("benefit.newWindow")}</span>
      </a>
      <p className={cx("benefit-fine")}>{T("benefit.bookNote")}</p>
    </article>
  );
}
function tierTableHTML() {
  const you = FAMILY_PARENT.tier;
  return (
    <section
      className={cx("tier-section reveal")}
      aria-labelledby={"tierTitle"}
    >
      <div className={cx("sectiontitle")}>
        <div>
          <div className={cx("tier-heading")}>
            {proposedBadge()}
            <h2 id={"tierTitle"}>{T("benefit.tableTitle")}</h2>
          </div>
          <p>{T("benefit.tableSub")}</p>
        </div>
      </div>
      <div
        className={cx("tablewrap tier-wrap")}
        role={"region"}
        aria-labelledby={"tierTitle"}
        tabIndex={0}
      >
        <table className={cx("tier-table")}>
          <thead>
            <tr>
              <th scope={"col"} className={cx("tier-label")}>
                {T("benefit.col.benefit")}
              </th>
              {keyed(
                MEMBERSHIP_TIERS.map((tier) => (
                  <th
                    scope={"col"}
                    className={cx(
                      "tier-head " +
                        String(tier) +
                        String(tier === you ? " you" : ""),
                    )}
                  >
                    <span className={cx("tier-name")}>
                      {T("tier." + tier)}
                      {tier === you ? (
                        <span className={cx("tier-you")}>
                          {" · "}
                          {T("tier.you")}
                        </span>
                      ) : (
                        ""
                      )}
                    </span>
                    {tier === "diamondExec" ? (
                      <small>{T("tier.from2027")}</small>
                    ) : (
                      ""
                    )}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {keyed(
              FAMILY_BENEFIT_ROWS.map(([key, values]) => (
                <tr>
                  <th scope={"row"}>{T("benefit.row." + key)}</th>
                  {keyed(
                    values.map((value, i) => (
                      <td
                        className={
                          i === MEMBERSHIP_TIERS.indexOf(you)
                            ? cx("you")
                            : undefined
                        }
                      >
                        {value ? (
                          <span className={cx("tier-proposed")}>
                            {T("benefit.proposed")}
                          </span>
                        ) : (
                          <>
                            <span
                              className={cx("tier-none")}
                              aria-hidden={"true"}
                            >
                              {"—"}
                            </span>
                            <span className={cx("sr-only")}>
                              {T("benefit.notIncluded")}
                            </span>
                          </>
                        )}
                      </td>
                    )),
                  )}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className={cx("tier-note")}>{T("benefit.tableNote")}</p>
    </section>
  );
}
function faqHTML() {
  return (
    <section className={cx("faq-section reveal")} aria-labelledby={"faqTitle"}>
      <div className={cx("sectiontitle")}>
        <div>
          <h2 id={"faqTitle"}>{T("faq.title")}</h2>
          <p>{T("faq.sub")}</p>
        </div>
      </div>
      <div className={cx("faq-list")}>
        {keyed(
          [1, 2, 3, 4, 5, 6].map((n) => (
            <details className={cx("faq-item")}>
              <summary>
                <span>{T("faq.q" + n)}</span>
                {icon("chevron")}
              </summary>
              <div className={cx("faq-answer")}>
                <p>{T("faq.a" + n)}</p>
              </div>
            </details>
          )),
        )}
      </div>
    </section>
  );
}
function BenefitsPage() {
  return (
    <>
      {familyHead("benefit.title", "benefit.sub")}
      <div className={cx("benefit-grid reveal")}>
        {milestoneCardHTML()}
        {companionCardHTML()}
      </div>
      {tierTableHTML()}
      {faqHTML()}
    </>
  );
}

export {
  FAMILY_INPUTS,
  FAMILY_EDITABLE,
  FAMILY_BENEFIT_ROWS,
  familyOccasion,
  inlineName,
  familyGivenName,
  familyInitials,
  maskEmail,
  familyHead,
  familyStepsHTML,
  familyChoiceHTML,
  familyIdentifierHTML,
  familyPanelHead,
  familyFormHTML,
  familySummaryHTML,
  familyChangeHTML,
  familyPendingHTML,
  maskedFamilyAccount,
  familyMemberCard,
  familyRosterHTML,
  familyDemoPassengerLink,
  familyDemoControls,
  FamilyPage,
  familyEmailHTML,
  proposedBadge,
  milestoneCardHTML,
  occasionText,
  companionCardHTML,
  tierTableHTML,
  faqHTML,
  BenefitsPage,
};
