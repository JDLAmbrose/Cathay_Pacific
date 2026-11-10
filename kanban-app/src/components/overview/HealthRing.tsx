import { formatIntPct, formatKg } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { BoardHealth, KpiSummary } from "../../types/kanban";
import type { TranslationKey } from "../../i18n/dictionary";
import { InfoPopover } from "../common/InfoPopover";
import styles from "./HealthRing.module.css";

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function healthLabelKey(health: BoardHealth): TranslationKey {
  switch (health) {
    case "CRITICAL":
      return "kb.health.critical";
    case "STRESSED":
      return "kb.health.stressed";
    case "WATCH":
      return "kb.health.watch";
    case "CLEAR":
      return "kb.health.clear";
  }
}

function healthTone(health: BoardHealth): string {
  switch (health) {
    case "CRITICAL":
      return styles.critical;
    case "STRESSED":
      return styles.stressed;
    case "WATCH":
      return styles.watch;
    case "CLEAR":
      return styles.clear;
  }
}

export function HealthRing({ kpi }: { kpi: KpiSummary }) {
  const { t } = useI18n();
  const slices = [
    { key: "over", count: kpi.overCount, color: "var(--bad)" },
    { key: "caution", count: kpi.cautionCount, color: "var(--warn)" },
    { key: "unk", count: kpi.cargoUnknownCount, color: "var(--off)" },
    { key: "normal", count: kpi.normalCount, color: "var(--ok)" },
  ].filter((slice) => slice.count > 0);
  let offset = 0;
  return (
    <section className={`${styles.card} ${healthTone(kpi.health)}`}>
      <div className={styles.title}>
        {t("kb.health.title")}
        <InfoPopover label={t("kb.health.hint")}>{t("kb.health.hint")}</InfoPopover>
      </div>
      <div className={styles.body}>
        <svg viewBox="0 0 140 140" className={styles.svg} role="img" aria-label={t("kb.health.title")}>
          <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="#e6eceb" strokeWidth="14" />
          {slices.map((slice) => {
            const length = (slice.count / kpi.flightCount) * CIRCUMFERENCE;
            const circle = (
              <circle
                key={slice.key}
                cx="70"
                cy="70"
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth="14"
                strokeLinecap="butt"
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                className={styles.slice}
              />
            );
            offset += length;
            return circle;
          })}
          <text x="70" y="64" textAnchor="middle" className={styles.pct}>
            {formatIntPct(kpi.fleetLoadRatio)}
          </text>
          <text x="70" y="82" textAnchor="middle" className={styles.cap}>
            LOAD
          </text>
        </svg>
        <div>
          <div className={styles.health}>{t(healthLabelKey(kpi.health))}</div>
          <div className={styles.meta}>
            {formatKg(kpi.knownOccupiedKg)} / {formatKg(kpi.knownCapacityKg)} kg
          </div>
          <div className={styles.legend}>
            <span><i className={styles.over} />OVER {kpi.overCount}</span>
            <span><i className={styles.caution} />CAUTION {kpi.cautionCount}</span>
            <span><i className={styles.ok} />NORMAL {kpi.normalCount}</span>
            <span><i className={styles.unk} />UNK {kpi.cargoUnknownCount}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
