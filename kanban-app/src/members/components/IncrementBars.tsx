import { useI18n } from "../../i18n/useI18n";
import { formatHkd } from "../format";
import type { IncrementView } from "../types";
import { MemberCard } from "./MemberCard";
import meter from "./meter.module.css";
import styles from "./IncrementBars.module.css";

export function IncrementBars({ increment }: { increment: IncrementView }) {
  const { t } = useI18n();
  const rows = [
    { label: t("mb.inc.students"), slice: increment.students },
    { label: t("mb.inc.parents"), slice: increment.parents },
    { label: t("mb.inc.business"), slice: increment.business },
  ];
  const max = Math.max(
    ...rows.map((row) => row.slice.completedHkd + row.slice.weekToDateHkd),
    1,
  );

  return (
    <MemberCard questionKey="mb.q5" showScopeAll={false}>
      <div className={styles.metrics}>
        <p>
          <small>{t("mb.inc.completed")}</small>
          <b>{formatHkd(increment.completedHkd)}</b>
        </p>
        <p>
          <small>{t("mb.inc.partial")}</small>
          <b className={styles.mid}>{formatHkd(increment.weekToDateHkd)}</b>
        </p>
      </div>
      <div className={meter.rows}>
        {rows.map((row) => (
          <div key={row.label}>
            <div className={meter.top}>
              <span>{row.label}</span>
              <b>
                {formatHkd(row.slice.completedHkd)} + {formatHkd(row.slice.weekToDateHkd)}
              </b>
            </div>
            <div className={meter.track}>
              <i style={{ width: `${(row.slice.completedHkd / max) * 100}%` }} />
              <i className={meter.hatch} style={{ width: `${(row.slice.weekToDateHkd / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className={styles.key}>
        <span><i className={meter.swatch} />{t("mb.inc.completed")}</span>
        <span><i className={`${meter.swatch} ${meter.hatch}`} />{t("mb.inc.partial")}</span>
      </div>
      <p className={styles.note}>{t("mb.inc.note")}</p>
    </MemberCard>
  );
}
