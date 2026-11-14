import { useId } from "react";
import { useI18n } from "../../i18n/useI18n";
import { formatDays } from "../format";
import type { LagView } from "../types";
import { MemberCard } from "./MemberCard";
import styles from "./LagRuler.module.css";

const SAMPLES = 48;

function distributionSamples(lag: LagView): { samples: number[]; domain: number } | null {
  if (lag.sampleCount === 0 || lag.p50Days == null || lag.p90Days == null) {
    return null;
  }
  const domain = Math.max(lag.maxDays ?? 0, lag.p90Days, 1);
  const bins = lag.bins.map((bin) => ({
    start: bin.startDay,
    end: Math.min(bin.endDay ?? domain, domain),
    count: bin.count,
  }));
  const heightAt = (day: number) => {
    const bin = bins.find(
      (item) => item.end > item.start && day >= item.start && (day < item.end || (day === domain && item.end === domain)),
    );
    return bin?.count ?? 0;
  };
  const raw = Array.from({ length: SAMPLES }, (_, index) => heightAt((index / (SAMPLES - 1)) * domain));
  const samples = raw.map((_, index) => {
    let total = 0;
    let count = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const value = raw[index + offset];
      if (value == null) {
        continue;
      }
      total += value;
      count += 1;
    }
    return total / count;
  });
  return { samples, domain };
}

function labelAnchor(percent: number): "start" | "middle" | "end" {
  if (percent < 18) {
    return "start";
  }
  if (percent > 82) {
    return "end";
  }
  return "middle";
}

export function LagRuler({ lag }: { lag: LagView }) {
  const { t } = useI18n();
  const fillId = `lag-fill-${useId().replace(/:/g, "")}`;
  const distribution = distributionSamples(lag);
  const peak = Math.max(...(distribution?.samples ?? [0]), 1);
  const pins = distribution
    ? [
        { day: lag.p50Days ?? 0, label: `${t("mb.lag.p50")} ${formatDays(lag.p50Days ?? 0)}` },
        { day: lag.p90Days ?? 0, label: `${t("mb.lag.p90")} ${formatDays(lag.p90Days ?? 0)}` },
      ]
    : [];

  const curve = distribution
    ? distribution.samples
        .map((value, index) => {
          const x = (index / (distribution.samples.length - 1)) * 100;
          const y = 100 - (value / peak) * 84;
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(" ")
    : "";

  return (
    <MemberCard questionKey="mb.q6" showScopeAll={false}>
      <p className={styles.caption}>{t("mb.lag.caption")}</p>
      {distribution ? (
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
      ) : (
        <p className={styles.empty}>{t("mb.noSample")}</p>
      )}
      {distribution ? (
        <div className={styles.plot} aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#02544f" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#02544f" stopOpacity="0.06" />
              </linearGradient>
            </defs>
            <path d={`M 0,100 L ${curve.split(" ").join(" L ")} L 100,100 Z`} fill={`url(#${fillId})`} />
            <polyline points={curve} fill="none" stroke="#02544f" strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
            <line x1="0" y1="100" x2="100" y2="100" stroke="#d5e2dc" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          {pins.map((pin) => {
            const percent = (pin.day / distribution.domain) * 100;
            return (
              <span
                key={pin.label}
                className={`${styles.pin} ${styles[labelAnchor(percent)]}`}
                style={{ left: `${percent}%` }}
              >
                <i />
                <em>{pin.label}</em>
              </span>
            );
          })}
        </div>
      ) : null}
      <div className={styles.ends}>
        <span>0 {t("mb.lag.days")}</span>
        {distribution ? (
          <span>
            {t("mb.lag.min")} {formatDays(lag.minDays ?? 0)} · {t("mb.lag.max")} {formatDays(lag.maxDays ?? 0)}
          </span>
        ) : (
          <span>{t("mb.noSample")}</span>
        )}
      </div>
    </MemberCard>
  );
}
