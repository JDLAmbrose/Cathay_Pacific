import { useI18n } from "../../i18n/useI18n";
import { formatRate } from "../format";
import { tierKey } from "../labels";
import type { TierName, TierView } from "../types";
import { MemberCard } from "./MemberCard";
import styles from "./TierColumns.module.css";

const TIER_TONE: Record<TierName, string> = {
  Green: styles.green,
  Silver: styles.silver,
  Gold: styles.gold,
  Diamond: styles.diamond,
  "Diamond Exec": styles.exec,
};

export function TierColumns({ tiers }: { tiers: TierView }) {
  const { t } = useI18n();
  const mix = tiers.tiers.filter((column) => column.count > 0);
  const total = mix.reduce((sum, column) => sum + column.count, 0);

  return (
    <MemberCard questionKey="mb.q7" showScopeAll={false}>
      <p className={styles.kicker}>{t("mb.tier.people")}</p>
      <div className={styles.mix} aria-hidden="true">
        {total === 0
          ? null
          : mix.map((column) => (
              <i
                key={column.tier}
                className={TIER_TONE[column.tier]}
                style={{ width: `${(column.count / total) * 100}%` }}
              />
            ))}
      </div>
      <p className={styles.kicker}>{t("mb.tier.usage")}</p>
      <div className={styles.rows}>
        {tiers.tiers.map((column) => {
          const labelKey = tierKey(column.tier);
          const label = labelKey ? t(labelKey) : column.tier;
          const usage = column.usage.rate;
          return (
            <div
              key={column.tier}
              className={`${styles.row} ${TIER_TONE[column.tier]} ${column.notYetEffective ? styles.later : ""}`}
            >
              <i className={styles.swatch} />
              <span className={styles.name}>{label}</span>
              {column.notYetEffective ? (
                <span className={`${styles.pending} ${styles.note}`}>
                  {t("mb.tier.notYet")} · {t("mb.tier.execFrom")}
                </span>
              ) : (
                <>
                  <b className={styles.count}>{column.count}</b>
                  {usage == null ? (
                    <span className={styles.pending}>{t("mb.noSample")}</span>
                  ) : (
                    <>
                      <span className={styles.track}>
                        <i className={styles.line} />
                        <i className={styles.dot} style={{ left: `${usage * 100}%` }} />
                      </span>
                      <b className={styles.rate}>{formatRate(usage)}</b>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </MemberCard>
  );
}
