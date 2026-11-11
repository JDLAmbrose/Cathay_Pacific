import { formatCountdown, formatKg, formatIntPct } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { ActionQueueItem } from "../../types/kanban";
import { AssessmentBadge } from "../common/AssessmentBadge";
import { StatusBadge } from "../common/StatusBadge";
import styles from "./ActionQueuePanel.module.css";

export function ActionQueuePanel({
  items,
  selectedFlightId,
  onSelectFlight,
}: {
  items: ActionQueueItem[];
  selectedFlightId: string | null;
  onSelectFlight: (flightId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section className={styles.card}>
      <h3>
        {t("kb.queue.title")} <span className={styles.note}>{t("kb.queue.sort")}</span>
      </h3>
      <div className={styles.list}>
        {items.map((item) => (
          <button
            key={item.flightId}
            type="button"
            className={`${styles.row} ${selectedFlightId === item.flightId ? styles.sel : ""}`}
            onClick={() => onSelectFlight(item.flightId)}
          >
            <div className={styles.head}>
              <b>{item.flightId}</b>
              <StatusBadge status={item.status} loadRatio={item.weightLoadRatio} />
              <span className={styles.tag}>{formatCountdown(item.hoursToDeparture)}</span>
              <span className={styles.grow} />
              <AssessmentBadge assessment={item.assessment} />
            </div>
            <div className={styles.note}>
              {item.assessment === "MONITOR"
                ? `${formatIntPct(item.weightLoadRatio)} · ${t("kb.assess.monitor")}`
                : `${t("kb.metric.deficit")} ${formatKg(item.deficitKg)} kg · ${t("kb.metric.defer")} ${formatKg(item.deferKg)} kg${item.targetFlightId ? ` → ${item.targetFlightId}` : ""} · ${t("kb.metric.residual")} ${formatKg(item.residualKg)} kg`}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
