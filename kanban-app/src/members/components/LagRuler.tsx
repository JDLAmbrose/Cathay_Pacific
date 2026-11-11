import { useI18n } from "../../i18n/useI18n";
import { formatDays } from "../format";
import type { LagView } from "../types";
import { MemberCard } from "./MemberCard";
import styles from "./LagRuler.module.css";

export function LagRuler({ lag }: { lag: LagView }) {
  const { t } = useI18n();
  const noSample = lag.sampleCount === 0 || lag.p50Days == null || lag.p90Days == null;
  const axisMax = Math.max(lag.p90Days ?? 0, lag.maxDays ?? 0, 1);
  const tallest = Math.max(...lag.bins.map((bin) => bin.count), 1);

  return (
    <MemberCard questionKey="mb.q6" showScopeAll={false}>
      <p className={styles.caption}>{t("mb.lag.caption")}</p>
      {noSample ? (
        <p className={styles.empty}>{t("mb.noSample")}</p>
      ) : (
        <div className={styles.metrics}>
          <p>
            <small>{t("mb.lag.p50")}</small>
            <b>{formatDays(lag.p50Days ?? 0)} {t("mb.lag.days")}</b>
          </p>
          <p>
            <small>{t("mb.lag.p90")}</small>
            <b>{formatDays(lag.p90Days ?? 0)} {t("mb.lag.days")}</b>
          </p>
          <p>
            <small>{t("mb.lag.sample")}</small>
            <b className={styles.mid}>{lag.sampleCount}</b>
          </p>
        </div>
      )}
      <div className={`${styles.ruler} ${noSample ? styles.blank : ""}`}>
        {noSample ? null : (
          <div className={styles.hist}>
            {lag.bins.map((bin) => (
              <span key={`${bin.startDay}-${bin.endDay ?? "open"}`} className={styles.tip}>
                {bin.count > 0 ? (
                  <i className={styles.face} style={{ height: `${(bin.count / tallest) * 100}%` }} />
                ) : (
                  <i className={styles.none} />
                )}
              </span>
            ))}
          </div>
        )}
        <i className={styles.axis} />
        {noSample || lag.p50Days == null ? null : (
          <i className={styles.tick} style={{ left: `${(lag.p50Days / axisMax) * 100}%` }}>
            <span>{t("mb.lag.p50")} {formatDays(lag.p50Days)}</span>
          </i>
        )}
        {noSample || lag.p90Days == null ? null : (
          <i className={styles.tick} style={{ left: `${(lag.p90Days / axisMax) * 100}%` }}>
            <span>{t("mb.lag.p90")} {formatDays(lag.p90Days)}</span>
          </i>
        )}
      </div>
      <div className={styles.ends}>
        <span>0 {t("mb.lag.days")}</span>
        {noSample ? (
          <span>{t("mb.noSample")}</span>
        ) : (
          <span>
            {t("mb.lag.min")} {formatDays(lag.minDays ?? 0)} · {t("mb.lag.max")} {formatDays(lag.maxDays ?? 0)}
          </span>
        )}
      </div>
    </MemberCard>
  );
}
