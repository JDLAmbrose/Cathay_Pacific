import { formatSectorCode, sectorLabelKey } from "../../config/sectors";
import { formatKg, formatPct } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { DeferralPlan, HoldLoadView } from "../../types/kanban";
import { StatusBadge } from "../common/StatusBadge";
import styles from "./FlightBarTooltip.module.css";

export function FlightBarTooltip({
  load,
  plan,
}: {
  load: HoldLoadView;
  plan: DeferralPlan;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.tip}>
      <div className={styles.row}>
        <b>
          {load.flightId} · {load.aircraft}
        </b>
        <StatusBadge status={load.status} loadRatio={load.weightLoadRatio} />
      </div>
      <div className={styles.meta}>
        {formatSectorCode(load.sector)} · {t(sectorLabelKey(load.sector))} · {load.seats}{" "}
        {t("kb.tip.seats")} · CAP {formatKg(load.capacityKg)} kg
      </div>
      <hr />
      <div className={styles.row}>
        <span>{t("kb.tip.cargo")}</span>
        <b>{load.commercialCargoKg == null ? t("kb.unk") : `${formatKg(load.commercialCargoKg)} kg`}</b>
      </div>
      <div className={styles.row}>
        <span>{t("kb.tip.pax")}</span>
        <b>{formatKg(load.estimatedPaxBaggageKg)} kg</b>
      </div>
      <div className={`${styles.row} ${styles.plume}`}>
        <span>
          {t("kb.tip.plume")}（{load.plumePax}
          {t("kb.tip.paxShort")}/{load.plumeOnFlightPieceCount}
          {t("kb.tip.pcs")}）
        </span>
        <b>
          {formatKg(load.plumeOnFlightKg)} kg ({formatPct(load.plumeShare)})
        </b>
      </div>
      <div className={`${styles.row} ${styles.defer}`}>
        <span>{t("kb.tip.deferrable")}</span>
        <b>
          {formatKg(load.plumeDeferrableKg)} kg ({load.plumeDeferrablePieceCount}
          {t("kb.tip.pcs")})
        </b>
      </div>
      <hr />
      <div className={styles.row}>
        <span>
          WT {formatPct(load.weightLoadRatio)} · VOL {formatPct(load.volumeLoadRatio)}
        </span>
        <b className={load.deficitKg > 0 ? styles.bad : undefined}>
          {t("kb.metric.deficit")} {formatKg(plan.deficitKg)} kg
        </b>
      </div>
    </div>
  );
}
