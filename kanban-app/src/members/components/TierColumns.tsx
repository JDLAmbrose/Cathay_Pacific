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
  const tallest = Math.max(...tiers.tiers.map((column) => column.count), 1);

  return (
    <MemberCard questionKey="mb.q7" showScopeAll={false}>
      <div className={styles.tiers} style={{ gridTemplateColumns: `repeat(${tiers.tiers.length}, 1fr)` }}>
        {tiers.tiers.map((column) => {
          const usage = column.usage.rate;
          const showFill = usage != null && usage > 0;
          const labelKey = tierKey(column.tier);
          const barHeight = column.count === 0 ? 36 : Math.max((column.count / tallest) * 160, 8);
          return (
            <div key={column.tier} className={`${styles.tier} ${TIER_TONE[column.tier]}`}>
              <strong>{column.count}</strong>
              <div
                className={`${styles.col} ${column.count === 0 ? styles.empty : ""}`}
                style={{ height: `${barHeight}px` }}
              >
                {showFill ? (
                  <i className={styles.fill} style={{ height: `${usage * 100}%` }} />
                ) : null}
              </div>
              <em>{labelKey ? t(labelKey) : column.tier}</em>
              <span>
                {column.notYetEffective ? (
                  <>
                    {t("mb.tier.notYet")}
                    <br />
                    {t("mb.tier.execFrom")}
                  </>
                ) : (
                  <>
                    {t("mb.tier.usage")}
                    <br />
                    {usage == null ? t("mb.noSample") : formatRate(usage)}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </MemberCard>
  );
}
