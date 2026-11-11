import { useI18n } from "../../i18n/useI18n";
import { formatMonthDay, formatRatio } from "../format";
import { bookmarkNameKey } from "../labels";
import type { JoinView } from "../types";
import { MemberCard } from "./MemberCard";
import styles from "./JoinSpark.module.css";

export function JoinSpark({ join }: { join: JoinView }) {
  const { t } = useI18n();
  const noSample = t("mb.noSample");
  const maxCumulative = Math.max(...join.sparkline.map((point) => point.cumulative), 1);
  const points = join.sparkline.map((point, index) => {
    const x = 16 + (index / Math.max(join.sparkline.length - 1, 1)) * 300;
    const y = 68 - (point.cumulative / maxCumulative) * 52;
    return { ...point, x, y };
  });
  const solid = points.filter((point) => point.isOnOrBeforeDemo);
  const futureStart = Math.max(solid.length - 1, 0);
  const line = (rows: typeof points) => rows.map((point) => `${point.x},${point.y}`).join(" ");
  const active = [...solid].reverse().find((point) => point.isOnOrBeforeDemo) ?? points[0];
  const funnel = [
    { label: t("mb.join.funnel.reach"), count: join.reach },
    { label: t("mb.join.funnel.start"), count: join.startJoin },
    { label: t("mb.join.funnel.complete"), count: join.completeJoin },
  ];
  const funnelMax = Math.max(join.reach, 1);

  return (
    <MemberCard questionKey="mb.q2" showScopeAll={false}>
      <div className={styles.metrics}>
        <p>
          <small>{t("mb.join.cumulative")}</small>
          <b>{join.cumulative}</b>
        </p>
        <p>
          <small>{t("mb.join.today")}</small>
          <b className={styles.sub}>{join.today}</b>
        </p>
        <p>
          <small>{t("mb.join.week")}</small>
          <b className={styles.sub}>{join.thisWeek}</b>
        </p>
        <p>
          <small>{t("mb.join.conversion")}</small>
          <b className={styles.sub}>{formatRatio(join.conversion, noSample)}</b>
        </p>
      </div>
      <p className={styles.pair}>
        {t("mb.join.started")} {formatRatio(join.started, noSample)}
      </p>
      <p className={styles.rates}>
        <span>{t("mb.join.studentRate")} {formatRatio(join.students.conversion, noSample)}</span>
        <span>{t("mb.join.parentRate")} {formatRatio(join.parents.conversion, noSample)}</span>
        <span>{t("mb.join.businessRate")} {formatRatio(join.business.conversion, noSample)}</span>
      </p>
      <div className={styles.funnel}>
        {funnel.map((step) => (
          <div key={step.label} className={styles.step}>
            <span>{step.label}</span>
            <span className={styles.track}>
              <span
                className={styles.fill}
                style={{ width: join.reach === 0 ? "0%" : `${(step.count / funnelMax) * 100}%` }}
              />
            </span>
            <b>{step.count}</b>
          </div>
        ))}
      </div>
      <svg className={styles.spark} viewBox="0 0 332 96" role="img" aria-label={t("mb.join.cumulative")}>
        {solid.length > 1 ? (
          <polyline points={line(solid)} fill="none" stroke="#02544f" strokeWidth="2.4" />
        ) : null}
        {points.length > futureStart ? (
          <polyline
            points={line(points.slice(futureStart))}
            fill="none"
            stroke="#9aa5a3"
            strokeWidth="2"
            opacity="0.7"
          />
        ) : null}
        {points.map((point) => (
          <g key={point.bookmarkId} opacity={point.isOnOrBeforeDemo ? 1 : 0.4}>
            <circle cx={point.x} cy={point.y} r="3.2" fill={point.isOnOrBeforeDemo ? "#02544f" : "#9aa5a3"} />
            <text x={point.x} y="88" textAnchor="middle" className={styles.tick}>
              {formatMonthDay(point.at)}
            </text>
          </g>
        ))}
        {active ? <line x1={active.x} x2={active.x} y1="8" y2="72" stroke="#c5923e" strokeWidth="1.4" /> : null}
      </svg>
      <p className={styles.caption}>{active ? t(bookmarkNameKey(active.bookmarkId)) : null}</p>
    </MemberCard>
  );
}
