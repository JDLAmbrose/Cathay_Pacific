import type { ReactNode } from "react";
import {
  fmt,
  hk,
  PEOPLE,
  ticketAllowance,
  FAMILY_METHODS,
  FAMILY_FIELDS,
  FAMILY_PARENT,
  MEMBERSHIP_TIERS,
  familyTravellerId,
  familyMemberId,
  linkedFamilyMembers,
  linkedPassengerContacts,
  pendingFamilyInvitations,
  familyInvitationId,
  familyIdentifier,
  familyMemberName,
  familyDemoUnlinked,
  familyBenefitMember,
  familyLinked,
  familyProgressAccess,
  familyPromoCode,
  state,
} from "../engine/booking";
import { t, language } from "../services/i18n";
import {
  page,
  helperFamilyPage,
  helperPassengerId,
  familyInvitePassengerId,
  familyDemoTravellerId,
} from "../services/navigation";
import { href } from "../config/routes";
import { cx, keyed, Input } from "../components/primitives";
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
      <p className={cx("dialog-lead")}>{T("link.formSub")}</p>{" "}
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
        ""
      ) : (
        <div className={cx("note")}>{T("link.privacyNote")}</div>
      )}{" "}
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
function familyMemberCard(fam, isHelper = false) {
  const name = familyMemberName(fam),
    id = familyMemberId(fam),
    traveller = familyTravellerId(fam),
    hasTicket = !!(
      traveller &&
      state.drafts[traveller] &&
      ticketAllowance(traveller)
    );
  const access = isHelper ? "" : familyProgressAccess(fam);
  const progressLabel = {
    denied: "link.progressDenied",
    requested: "link.progressRequested",
    waiting: "link.progressAllowed",
    ready: "link.progressAllowed",
  }[access];
  const status = isHelper ? (
    ""
  ) : (
    <div className={cx("member-permissions")}>
      <span>
        {icon(hasTicket ? "check" : "clock")}
        {T(hasTicket ? "link.proxyAllowed" : "link.memberNoTicket")}
      </span>
      <span>
        {icon(fam.shareProgress ? "check" : "shield")}
        {T(progressLabel)}
      </span>
    </div>
  );
  const proxy = hasTicket ? (
    <a
      className={cx("btn slim light")}
      href={href("book", 2)}
      data-family-proxy={text(id)}
    >
      {T("link.proxyCta", { name: inlineName(familyGivenName(fam)) })}
      {icon("arrow")}
    </a>
  ) : (
    ""
  );
  const progress =
    access === "ready" ? (
      <a
        className={cx("textbtn")}
        href={href("journey")}
        data-family-proxy={text(id)}
        data-family-progress={""}
      >
        {T("link.progressCta")}
        {icon("arrow")}
      </a>
    ) : access === "waiting" ? (
      <small className={cx("muted")}>{T("link.progressWaiting")}</small>
    ) : (
      <button
        type={"button"}
        className={cx("textbtn")}
        data-action={
          access === "requested"
            ? "family-progress-preview"
            : "family-progress-request"
        }
        data-id={text(id)}
      >
        {T(
          access === "requested"
            ? "link.progressPreview"
            : "link.progressRequest",
        )}
        {icon("arrow")}
      </button>
    );
  return (
    <article className={cx("family-member card")} key={id}>
      <header className={cx("family-member-top")}>
        <span className={cx("member-initials")} aria-hidden={"true"}>
          {text(familyInitials(fam))}
        </span>
        <div>
          <h3>{text(name)}</h3>
          <p>
            {T("link.relationshipValue", {
              relationship: t("link.rel." + fam.relationship),
            })}
            {" · "}
            <bdi>{text(maskedFamilyAccount(fam))}</bdi>
          </p>
        </div>
        <span className={cx("pill")}>
          {icon("check")}
          {T("link.statusLinked")}
        </span>
      </header>{" "}
      {status}
      {isHelper ? (
        <div className={cx("actions member-review")}>
          <span className={cx("pill")}>{T("helper.title")}</span>
          {helperFamilyPage
            ? ""
            : link("book", T("helper.select"), "textbtn")}
          {familyChangeHTML(fam, "helper:" + id)}
        </div>
      ) : (
        <>
          <div className={cx("actions")}>
            {proxy}
            {progress}
          </div>
          <div className={cx("member-review")}>{familyChangeHTML(fam, id)}</div>
        </>
      )}
    </article>
  );
}
function familyRosterHTML(members, helpers) {
  const count = members.length + helpers.length;
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
      {count ? (
        <>
          <div className={cx("family-member-grid")}>
            {keyed(members.map((member) => familyMemberCard(member)))}
            {keyed(helpers.map((member) => familyMemberCard(member, true)))}
          </div>
          {members.length ? (
            <p className={cx("prototype-note")}>{T("link.lockedNote")}</p>
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
      {...(helperFamilyPage ? {} : { "data-family-proxy": "" })}
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
      {unlinked ? (
        <button
          type={"button"}
          className={cx("textbtn")}
          data-action={"family-demo-exit"}
        >
          {T("link.demoExit")}
        </button>
      ) : (
        ""
      )}
    </div>
  );
}
function FamilyPage() {
  const unlinked = familyDemoUnlinked(familyDemoTravellerId);
  const members = helperFamilyPage ? [] : linkedFamilyMembers();
  const helpers = unlinked
    ? []
    : linkedPassengerContacts(familyInvitePassengerId ?? state.travellerId);
  const invitations = unlinked
    ? []
    : pendingFamilyInvitations(familyInvitePassengerId);
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
          <div className={cx("actions")}>
            <button
              type={"button"}
              className={cx("btn")}
              data-action={"family-add"}
            >
              {icon("person")}
              {T("link.addMember")}
            </button>
            {helperFamilyPage || unlinked || members.length || helpers.length
              ? familyDemoPassengerLink()
              : ""}
          </div>
        </div>
        {familyRosterHTML(members, helpers)}
        {familyPendingHTML(invitations)}
      </div>
    </>
  );
}
function familyEmailHTML(fam) {
  const sender = helperFamilyPage
      ? (PEOPLE.find((p) => p.id === helperPassengerId) || PEOPLE[0]).name
      : FAMILY_PARENT.name,
    to =
      fam.method === "email"
        ? maskEmail(familyIdentifier(fam))
        : t("link.emailToValue");
  return (
    <>
      <article className={cx("email-preview")}>
        <dl className={cx("email-meta")}>
          <div>
            <dt>{T("link.emailFrom")}</dt>
            <dd>{T("link.emailFromValue")}</dd>
          </div>
          <div>
            <dt>{T("link.emailTo")}</dt>
            <dd>
              <bdi>{text(to)}</bdi>
            </dd>
          </div>
          <div>
            <dt>{T("link.emailSubjectLabel")}</dt>
            <dd>{T("link.emailSubject", { parent: sender })}</dd>
          </div>
        </dl>
        <div className={cx("email-body")}>
          {productMark()}
          <p>
            <strong>
              {T("link.emailGreeting", { name: familyGivenName(fam) })}
            </strong>
          </p>
          <p>
            {T(helperFamilyPage ? "helper.linkEmailBody" : "link.emailBody", {
              parent: sender,
            })}
          </p>
          <div className={cx("email-details")}>
            {row("link.emailRequester", text(sender))}
            {row("link.emailRelationship", T("link.rel." + fam.relationship))}
          </div>
          {helperFamilyPage ? (
            ""
          ) : (
            <label className={cx("check family-share")}>
              <Input type={"checkbox"} id={"familyShare"} />
              <span>
                <strong>{T("link.emailShare")}</strong>
                <small>{T("link.emailShareHint")}</small>
              </span>
            </label>
          )}
        </div>
      </article>
      <p className={cx("prototype-note")}>{T("link.emailDemo")}</p>
    </>
  );
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
