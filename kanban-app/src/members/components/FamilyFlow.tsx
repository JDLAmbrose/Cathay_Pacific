import { useId } from "react";
import { useI18n } from "../../i18n/useI18n";
import { formatRate, formatRatio } from "../format";
import { familyStatusKey } from "../labels";
import type { AudienceFilter, FamilyLinkStatus, FamilyView } from "../types";
import { MemberCard } from "./MemberCard";
import { FAMILY_STATUS_COLOR, familyDiagram, type FamilyContinuation } from "./familyRibbon";
import styles from "./FamilyFlow.module.css";

function FlowChip({ x, y, text }: { x: number; y: number; text: string }) {
  const width = Math.max(52, text.length * 6.6 + 16);
  return (
    <g className={styles.chip}>
      <rect x={x - width / 2} y={y - 11} width={width} height={22} rx={11} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </g>
  );
}

function OutcomeCard({
  continuation,
  title,
  detail,
}: {
  continuation: FamilyContinuation;
  title: string;
  detail: string | null;
}) {
  const { card } = continuation;
  return (
    <g>
      <rect
        x={card.x}
        y={card.y}
        width={card.width}
        height={card.height}
        rx={14}
        className={continuation.status === "authorized" ? styles.cardOk : styles.cardGold}
      />
      <text x={card.x + 16} y={card.y + 22} className={styles.cardName}>
        {title}
      </text>
      <text x={card.x + 16} y={card.y + 52} className={styles.cardCount}>
        {continuation.count}
      </text>
      {detail ? (
        <text x={card.x + 16} y={card.y + 72} className={styles.cardRate}>
          {detail}
        </text>
      ) : null}
    </g>
  );
}

export function FamilyFlow({ family, audience }: { family: FamilyView; audience: AudienceFilter }) {
  const { t } = useI18n();
  const gradId = `fam-${useId().replace(/:/g, "")}`;
  const noSample = t("mb.noSample");
  const counts = Object.fromEntries(family.statuses.map((status) => [status.status, status.count])) as Record<
    FamilyLinkStatus,
    number
  >;
  const diagram = familyDiagram(counts);
  const linkLabel = family.linkRate.rate == null ? null : formatRate(family.linkRate.rate);
  const successLabel = family.successRate.rate == null ? null : formatRate(family.successRate.rate);
  const summary = [
    `${t("mb.fam.sent")} ${family.sent}`,
    `${t("mb.fam.accepted")} ${diagram.accepted.count}`,
    ...diagram.branches.map((branch) => `${t(familyStatusKey(branch.status))} ${branch.count}`),
    ...diagram.continuations.map((item) => `${t(familyStatusKey(item.status))} ${item.count}`),
  ].join(", ");

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
      <div className={styles.scroller}>
        <svg className={styles.flow} viewBox={`0 0 ${diagram.width} ${diagram.height}`} role="img" aria-label={summary}>
          <defs>
            <linearGradient id={`${gradId}-trunk`} x1="0" x2="1">
              <stop offset="0%" stopColor="#02544f" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#2f9e6b" stopOpacity="0.78" />
            </linearGradient>
            {diagram.branches.map((branch) =>
              branch.path ? (
                <linearGradient key={branch.status} id={`${gradId}-${branch.status}`} x1="0" x2="1">
                  <stop offset="0%" stopColor="#02544f" stopOpacity="0.28" />
                  <stop offset="100%" stopColor={FAMILY_STATUS_COLOR[branch.status]} stopOpacity="0.9" />
                </linearGradient>
              ) : null,
            )}
          </defs>
          {diagram.branches.map((branch) =>
            branch.path ? (
              <path key={branch.status} d={branch.path} fill={`url(#${gradId}-${branch.status})`} />
            ) : null,
          )}
          {diagram.trunk ? <path d={diagram.trunk.path} fill={`url(#${gradId}-trunk)`} /> : null}
          {diagram.continuations.map((item) =>
            item.path ? (
              <path
                key={item.status}
                d={item.path}
                fill={FAMILY_STATUS_COLOR[item.status]}
                opacity={item.status === "authorized" ? 0.78 : 0.92}
              />
            ) : null,
          )}
          <rect x={diagram.source.x} y={diagram.source.y} width={diagram.source.width} height={diagram.source.height} rx={16} className={styles.source} />
          <text
            x={diagram.source.x + diagram.source.width / 2}
            y={diagram.source.y + diagram.source.height / 2 - 16}
            textAnchor="middle"
            dominantBaseline="central"
            className={styles.sourceLabel}
          >
            {t("mb.fam.sent")}
          </text>
          <text
            x={diagram.source.x + diagram.source.width / 2}
            y={diagram.source.y + diagram.source.height / 2 + 14}
            textAnchor="middle"
            dominantBaseline="central"
            className={styles.sourceCount}
          >
            {family.sent}
          </text>
          {diagram.branches.map((branch) =>
            branch.bar ? (
              <rect
                key={branch.status}
                x={branch.bar.x}
                y={branch.bar.y}
                width={branch.bar.width}
                height={branch.bar.height}
                rx={branch.bar.width / 2}
                fill={FAMILY_STATUS_COLOR[branch.status]}
              />
            ) : (
              <circle
                key={branch.status}
                cx={diagram.arrivalX + diagram.barWidth / 2}
                cy={branch.centerY}
                r={3.5}
                className={styles.emptyDot}
              />
            ),
          )}
          <rect
            x={diagram.accepted.node.x}
            y={diagram.accepted.node.y}
            width={diagram.accepted.node.width}
            height={diagram.accepted.node.height}
            rx={14}
            className={diagram.accepted.count > 0 ? styles.node : styles.nodeEmpty}
          />
          <text
            x={diagram.accepted.node.x + diagram.accepted.node.width / 2}
            y={diagram.accepted.node.y + 22}
            textAnchor="middle"
            dominantBaseline="central"
            className={styles.nodeLabel}
          >
            {t("mb.fam.accepted")}
          </text>
          <text
            x={diagram.accepted.node.x + diagram.accepted.node.width / 2}
            y={diagram.accepted.node.y + 44}
            textAnchor="middle"
            dominantBaseline="central"
            className={styles.nodeCount}
          >
            {diagram.accepted.count}
          </text>
          {diagram.branches.map((branch) => (
            <text
              key={`${branch.status}-label`}
              x={diagram.labelX}
              y={branch.centerY}
              dominantBaseline="central"
              className={branch.count > 0 ? styles.laneName : styles.laneMuted}
            >
              {t(familyStatusKey(branch.status))} {branch.count}
            </text>
          ))}
          <OutcomeCard
            continuation={diagram.continuations[0]}
            title={t("mb.fam.authorized")}
            detail={formatRatio(family.successRate, noSample)}
          />
          <OutcomeCard continuation={diagram.continuations[1]} title={t("mb.fam.linked")} detail={null} />
          {diagram.trunk && linkLabel ? <FlowChip x={diagram.trunk.chip.x} y={diagram.trunk.chip.y} text={linkLabel} /> : null}
          {diagram.continuations[0].chip && successLabel ? (
            <FlowChip x={diagram.continuations[0].chip.x} y={diagram.continuations[0].chip.y} text={successLabel} />
          ) : null}
        </svg>
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
