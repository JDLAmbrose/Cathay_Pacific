import { formatKg, formatPct } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { DeferralPlan, HoldLoadView } from "../../types/kanban";
import { AssessmentBadge } from "../common/AssessmentBadge";
import { InfoPopover } from "../common/InfoPopover";
import { KpiCard } from "../overview/KpiCard";
import styles from "./PlumeAssessmentCard.module.css";

export function PlumeAssessmentCard({
  load,
  plan,
  windowDays,
}: {
  load: HoldLoadView;
  plan: DeferralPlan;
  windowDays: number;
}) {
  const { t } = useI18n();
  const denom = Math.max(plan.deficitKg, 1);
  return (
    <section className={styles.card}>
      <h3>{t("kb.plume.title")}</h3>
      <div className={styles.kpis}>
        <KpiCard title={t("kb.plume.pax")} value={load.plumePax} sub="" />
        <KpiCard title={t("kb.plume.pcs")} value={load.plumePieceCount} sub="" />
        <KpiCard
          title={t("kb.plume.onFlight")}
          value={
            <>
              {formatKg(load.plumeOnFlightKg)}
              <span className={styles.unit}> kg</span>
            </>
          }
          sub=""
        />
        <KpiCard
          title={t("kb.plume.share")}
          hint={<InfoPopover label={t("kb.plume.shareHint")}>{t("kb.plume.shareHint")}</InfoPopover>}
          value={formatPct(load.plumeShare)}
          sub=""
        />
      </div>
      <div className={styles.assess}>
        <div className={styles.head}>
          <b>{t("kb.assess.title")}</b>
          <AssessmentBadge assessment={plan.assessment} />
          <span className={styles.grow} />
          <span className={styles.note}>
            {t("kb.assess.window")} {windowDays}D
            <InfoPopover label={t("kb.assess.windowHint")}>{t("kb.assess.windowHint")}</InfoPopover>
          </span>
        </div>
        <div className={styles.note}>
          {t("kb.metric.deficit")} <b>{formatKg(plan.deficitKg)} kg</b>
        </div>
        <div className={styles.bar}>
          {plan.deferKg > 0 ? (
            <div className={styles.defer} style={{ width: `${(plan.deferKg / denom) * 100}%` }}>
              DEFER {formatKg(plan.deferKg)} kg
            </div>
          ) : null}
          {plan.residualKg > 0 ? (
            <div className={styles.residual} style={{ width: `${(plan.residualKg / denom) * 100}%` }}>
              <span>RESIDUAL {formatKg(plan.residualKg)} kg</span>
            </div>
          ) : null}
        </div>
        <div className={styles.foot}>
          <span>
            LOAD <b>{formatPct(plan.loadRatioBefore)}</b> → <b>{formatPct(plan.loadRatioAfter)}</b>
          </span>
          <span className={styles.note}>{t("kb.assess.planning")}</span>
        </div>
      </div>
    </section>
  );
}
