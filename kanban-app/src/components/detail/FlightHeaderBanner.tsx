import { formatSectorCode } from "../../config/sectors";
import { formatCountdown, formatDep, formatKg } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { HoldLoadView } from "../../types/kanban";
import { InfoPopover } from "../common/InfoPopover";
import { StatusBadge } from "../common/StatusBadge";
import styles from "./FlightHeaderBanner.module.css";

export function FlightHeaderBanner({
  load,
  sector,
  onBack,
  asOf,
}: {
  load: HoldLoadView;
  sector: string;
  onBack: () => void;
  asOf: string;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className={styles.nav}>
        <button type="button" onClick={onBack}>
          ◀ {t("kb.detail.back")} › <b>{load.flightId}</b>
        </button>
        <span>
          {t("kb.detail.lastUpdate")}：{asOf.slice(0, 16).replace("T", " ")} HKT
        </span>
      </div>
      <section className={`${styles.banner} ${load.status === "OVER" ? styles.over : ""}`}>
        <div className={styles.flight}>
          <b>{load.flightId}</b>
          <StatusBadge status={load.status} loadRatio={load.weightLoadRatio} />
        </div>
        <div>
          <div className={styles.k}>{t("kb.detail.sector")}</div>
          <b>{formatSectorCode(sector)}</b>
        </div>
        <div>
          <div className={styles.k}>{t("kb.detail.dep")}</div>
          <b>{formatDep(load.dep)}</b>
        </div>
        <div>
          <div className={styles.k}>{t("kb.detail.acft")}</div>
          <b>{load.aircraft}</b>
        </div>
        <div>
          <div className={styles.k}>{t("kb.detail.seatsPlume")}</div>
          <b>
            {load.seats} / {load.plumePax}
          </b>
        </div>
        <div>
          <div className={styles.k}>
            {t("kb.metric.cap")}
            <InfoPopover label={t("kb.detail.capHint")}>{t("kb.detail.capHint")}</InfoPopover>
          </div>
          <b>
            {formatKg(load.capacityKg)} kg · {load.capacityM3} m³
          </b>
        </div>
        <div className={styles.count}>
          <div className={styles.k}>{t("kb.detail.countdown")}</div>
          <b>{formatCountdown(load.hoursToDeparture)}</b>
        </div>
      </section>
    </div>
  );
}
