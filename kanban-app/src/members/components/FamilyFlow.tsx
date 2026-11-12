import { useI18n } from "../../i18n/useI18n";
import { formatRatio } from "../format";
import { familyStatusKey } from "../labels";
import type { AudienceFilter, FamilyLinkStatus, FamilyView } from "../types";
import { MemberCard } from "./MemberCard";
import { FAMILY_FLOW, familyRibbons } from "./familyRibbon";
import styles from "./FamilyFlow.module.css";

const RIBBON_COLOR: Record<FamilyLinkStatus, string> = {
  cancelled: "#9aa5a3",
  declined: "#d6453d",
  revoked: "#9aa5a3",
  authorized: "#2f9e6b",
  linked_unauthorized: "#e4b46c",
  pending: "#8fb5b1",
};

export function FamilyFlow({ family, audience }: { family: FamilyView; audience: AudienceFilter }) {
  const { t } = useI18n();
  const noSample = t("mb.noSample");
  const counts = Object.fromEntries(family.statuses.map((status) => [status.status, status.count])) as Record<
    FamilyLinkStatus,
    number
  >;
  const ribbons = familyRibbons(counts);
  const authorized = family.statuses.find((status) => status.status === "authorized");
  const linked = family.statuses.find((status) => status.status === "linked_unauthorized");

  return (
    <MemberCard questionKey="mb.q4" showScopeAll={audience !== "all"}>
      <div className={styles.metrics}>
        <p>
          <small>{t("mb.fam.sent")}</small>
          <b>{family.sent}</b>
        </p>
        <p>
          <small>{t("mb.fam.linkRate")}</small>
          <b className={styles.mid}>{formatRatio(family.linkRate, noSample)}</b>
        </p>
        <p>
          <small>{t("mb.fam.successRate")}</small>
          <b className={styles.mid}>{formatRatio(family.successRate, noSample)}</b>
        </p>
        <p>
          <small>{t("mb.fam.studentPull")}</small>
          <b className={styles.mid}>{formatRatio(family.studentPull, noSample)}</b>
        </p>
      </div>
      <p className={styles.note}>
        {t("mb.fam.accepted")} {family.accepted}
        {" · "}
        {t("mb.fam.authOfSent")} {formatRatio(family.authorizationAmongSent, noSample)}
      </p>
      <div className={styles.layout}>
        <div className={styles.diagram}>
          <svg
            className={styles.flow}
            viewBox={`0 0 ${FAMILY_FLOW.laneX + 8} ${FAMILY_FLOW.height}`}
            role="img"
            aria-label={t("mb.fam.sent")}
          >
            <rect
              x={FAMILY_FLOW.sourceX}
              y={FAMILY_FLOW.top}
              width={FAMILY_FLOW.sourceWidth}
              height={FAMILY_FLOW.rowHeight * 6 - 8}
              rx="10"
              fill="#02544f"
            />
            <text x={FAMILY_FLOW.sourceX + 16} y={FAMILY_FLOW.top + 28} className={styles.sourceLabel}>
              {t("mb.fam.sent")}
            </text>
            <text x={FAMILY_FLOW.sourceX + 16} y={FAMILY_FLOW.top + 58} className={styles.sourceCount}>
              {family.sent}
            </text>
            {ribbons.map((ribbon) =>
              ribbon.path ? (
                <path key={ribbon.status} d={ribbon.path} fill={RIBBON_COLOR[ribbon.status]} opacity="0.45" className={styles.band} />
              ) : null,
            )}
          </svg>
          <ol className={styles.lanes}>
            {ribbons.map((ribbon, index) => (
              <li key={ribbon.status} style={{ gridRow: index + 2 }}>
                {t(familyStatusKey(ribbon.status))} {ribbon.count}
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.cards}>
          <article className={styles.cardOk}>
            <span>{t("mb.fam.authorized")}</span>
            <b>{authorized?.count ?? 0}</b>
            <small>{formatRatio(family.successRate, noSample)}</small>
          </article>
          <article className={styles.cardGold}>
            <span>{t("mb.fam.linked")}</span>
            <b>{linked?.count ?? 0}</b>
          </article>
        </div>
      </div>
      <p className={styles.note}>{t("mb.fam.separate")}</p>
      <div className={styles.gaps}>
        <p>
          <b>{family.paidUnauthorized}</b>
          <span>{t("mb.fam.gapPaid")}</span>
        </p>
        <p>
          <b>{family.authorizedUnpaid}</b>
          <span>{t("mb.fam.gapAuth")}</span>
        </p>
        <p>
          <b>{family.pendingNotJoined}</b>
          <span>{t("mb.fam.gapPending")}</span>
        </p>
      </div>
    </MemberCard>
  );
}
