import { formatKg, formatPct } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { KpiSummary } from "../../types/kanban";
import { InfoPopover } from "../common/InfoPopover";
import { HealthRing } from "./HealthRing";
import { KpiCard } from "./KpiCard";
import styles from "./KpiSummaryRow.module.css";

export function KpiSummaryRow({ kpi }: { kpi: KpiSummary }) {
  const { t } = useI18n();
  return (
    <div className={styles.hero}>
      <HealthRing kpi={kpi} />
      <div className={styles.row}>
        <KpiCard
          title={t("kb.kpi.flights")}
          value={kpi.flightCount}
          sub={`${kpi.cargoUnknownCount} ${t("kb.kpi.flightsSub")}`}
        />
        <KpiCard
          title={t("kb.kpi.deficit")}
          hint={<InfoPopover label={t("kb.kpi.deficitHint")}>{t("kb.kpi.deficitHint")}</InfoPopover>}
          value={
            <>
              {formatKg(kpi.totalDeficitKg)} <span className={styles.unit}>kg</span>
            </>
          }
          sub={`DEFER ${formatKg(kpi.totalDeferKg)} kg · ${kpi.overFlightCount} ${t("kb.kpi.deferLine")}`}
        />
        <KpiCard
          title={t("kb.kpi.plume")}
          hint={<InfoPopover label={t("kb.kpi.plumeHint")}>{t("kb.kpi.plumeHint")}</InfoPopover>}
          value={formatPct(kpi.plumeShareRatio)}
          sub={`${formatKg(kpi.plumeOnFlightKg)} / ${formatKg(kpi.totalCapacityKg)} kg`}
        />
      </div>
    </div>
  );
}
