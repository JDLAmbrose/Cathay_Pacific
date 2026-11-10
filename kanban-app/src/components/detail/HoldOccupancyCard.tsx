import type { ReactNode } from "react";
import { formatKg, formatM3, formatPct } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { DeferralPlan, HoldLoadView } from "../../types/kanban";
import { HoverTip } from "../common/HoverTip";
import { InfoPopover } from "../common/InfoPopover";
import styles from "./HoldOccupancyCard.module.css";

function ratioTone(ratio: number): string | undefined {
  if (ratio >= 1) {
    return styles.bad;
  }
  if (ratio >= 0.9) {
    return styles.warn;
  }
  return undefined;
}

function ratioTag(ratio: number): string {
  if (ratio >= 1) {
    return " OVER";
  }
  if (ratio >= 0.9) {
    return " CAUTION";
  }
  return "";
}

function StackBar({
  segments,
  cap,
}: {
  segments: Array<{ value: number; className: string; label: string; tip: ReactNode }>;
  cap: number;
}) {
  const max = cap * 1.1;
  return (
    <div className={styles.hb}>
      {segments.map((segment, index) => {
        if (segment.value <= 0) {
          return null;
        }
        const left = segments.slice(0, index).reduce((sum, item) => sum + item.value, 0);
        return (
          <HoverTip
            key={segment.className}
            label={segment.label}
            content={segment.tip}
            className={`${styles.seg} ${segment.className}`}
            style={{ left: `${(left / max) * 100}%`, width: `${(segment.value / max) * 100}%` }}
          />
        );
      })}
      <b className={styles.l90} style={{ left: `${((0.9 * cap) / max) * 100}%` }} />
      <b className={styles.l100} style={{ left: `${(cap / max) * 100}%` }} />
      <span className={styles.cap90} style={{ left: `${((0.9 * cap) / max) * 100}%` }}>
        90%
      </span>
      <span className={styles.cap100} style={{ left: `${(cap / max) * 100}%` }}>
        100% CAP
      </span>
    </div>
  );
}

export function HoldOccupancyCard({
  load,
  plan,
}: {
  load: HoldLoadView;
  plan: DeferralPlan;
}) {
  const { t } = useI18n();
  const deferM3 = plan.allocations.reduce((sum, item) => sum + item.m3, 0);
  const keepKg = Math.max(0, load.plumeOnFlightKg - plan.deferKg);
  const keepM3 = Math.max(0, load.plumeOnFlightM3 - deferM3);
  const cargoKg = load.commercialCargoKg ?? 0;
  const cargoM3 = load.commercialCargoM3 ?? 0;
  const plumeTip = (
    <>
      <b>{t("kb.hold.tip.plume")}</b>
      {`：${formatKg(load.plumeOnFlightKg)} kg (${formatPct(load.plumeShare)}) · ${formatM3(load.plumeOnFlightM3)} m³`}
      <br />
      <span className={styles.tipDefer}>
        {t("kb.hold.tip.defer")}：{formatKg(plan.deferKg)} kg ({plan.deferPieceCount}
        {t("kb.tip.pcs")})
      </span>
    </>
  );
  return (
    <section className={styles.card}>
      <h3>
        {t("kb.hold.title")}
        <InfoPopover label={t("kb.hold.hint")}>{t("kb.hold.hint")}</InfoPopover>
      </h3>
      <div className={styles.rowh}>
        <b>{t("kb.hold.wt")}</b>
        <span>
          <b className={ratioTone(load.weightLoadRatio)}>
            {formatKg(load.totalKg ?? load.baggageKg)}
          </b>
          {" / "}
          {formatKg(load.capacityKg)} kg ·{" "}
          <b className={ratioTone(load.weightLoadRatio)}>
            {formatPct(load.weightLoadRatio)}
            {ratioTag(load.weightLoadRatio)}
          </b>
        </span>
      </div>
      <StackBar
        cap={load.capacityKg}
        segments={[
          {
            value: cargoKg,
            className: styles.segCargo,
            label: t("kb.legend.cargo"),
            tip: (
              <>
                {t("kb.tip.cargo")}：{load.commercialCargoKg == null ? t("kb.unk") : `${formatKg(cargoKg)} kg · ${formatM3(cargoM3)} m³`}
              </>
            ),
          },
          {
            value: load.estimatedPaxBaggageKg,
            className: styles.segPax,
            label: t("kb.legend.pax"),
            tip: (
              <>
                {t("kb.tip.pax")}：{formatKg(load.estimatedPaxBaggageKg)} kg · {formatM3(load.estimatedPaxBaggageM3)} m³
              </>
            ),
          },
          {
            value: keepKg,
            className: styles.segPlume,
            label: t("kb.hold.tip.plume"),
            tip: plumeTip,
          },
          {
            value: plan.deferKg,
            className: styles.segDefer,
            label: t("kb.legend.defer"),
            tip: plumeTip,
          },
        ]}
      />
      <div className={`${styles.rowh} ${styles.volRow}`}>
        <b>{t("kb.hold.vol")}</b>
        <span>
          <b className={ratioTone(load.volumeLoadRatio)}>{formatM3(load.totalM3 ?? load.baggageM3)}</b>
          {" / "}
          {load.capacityM3} m³ ·{" "}
          <b className={ratioTone(load.volumeLoadRatio)}>
            {formatPct(load.volumeLoadRatio)}
            {ratioTag(load.volumeLoadRatio)}
          </b>
        </span>
      </div>
      <StackBar
        cap={load.capacityM3}
        segments={[
          {
            value: cargoM3,
            className: styles.segCargo,
            label: t("kb.legend.cargo"),
            tip: (
              <>
                {t("kb.tip.cargo")}：{load.commercialCargoM3 == null ? t("kb.unk") : `${formatKg(cargoKg)} kg · ${formatM3(cargoM3)} m³`}
              </>
            ),
          },
          {
            value: load.estimatedPaxBaggageM3,
            className: styles.segPax,
            label: t("kb.legend.pax"),
            tip: (
              <>
                {t("kb.tip.pax")}：{formatKg(load.estimatedPaxBaggageKg)} kg · {formatM3(load.estimatedPaxBaggageM3)} m³
              </>
            ),
          },
          {
            value: keepM3,
            className: styles.segPlume,
            label: t("kb.hold.tip.plume"),
            tip: plumeTip,
          },
          {
            value: deferM3,
            className: styles.segDefer,
            label: t("kb.legend.defer"),
            tip: plumeTip,
          },
        ]}
      />
      <div className={styles.legend}>
        <span><i className={styles.cargo} />{t("kb.legend.cargo")}</span>
        <span><i className={styles.pax} />{t("kb.legend.pax")}</span>
        <span><i className={styles.plume} />{t("kb.legend.plume")}</span>
        <span><i className={styles.defer} />{t("kb.legend.defer")}</span>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th />
              <th className={styles.num}>CARGO</th>
              <th className={styles.num}>PAX EST</th>
              <th className={styles.num}>PLUME (SHARE)</th>
              <th className={styles.num}>TOTAL / CAP</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>WT kg</b></td>
              <td className={styles.num}>{load.commercialCargoKg == null ? t("kb.unk") : formatKg(cargoKg)}</td>
              <td className={styles.num}>{formatKg(load.estimatedPaxBaggageKg)}</td>
              <td className={styles.num}>
                <b>{formatKg(load.plumeOnFlightKg)}</b> ({formatPct(load.plumeShare)})
              </td>
              <td className={styles.num}>
                <b>{formatKg(load.totalKg ?? load.baggageKg)}</b> / {formatKg(load.capacityKg)}
              </td>
            </tr>
            <tr>
              <td><b>VOL m³</b></td>
              <td className={styles.num}>{load.commercialCargoM3 == null ? t("kb.unk") : formatM3(cargoM3)}</td>
              <td className={styles.num}>{formatM3(load.estimatedPaxBaggageM3)}</td>
              <td className={styles.num}>
                <b>{formatM3(load.plumeOnFlightM3)}</b> ({formatPct(load.plumeOnFlightM3 / load.capacityM3)})
              </td>
              <td className={styles.num}>
                <b>{formatM3(load.totalM3 ?? load.baggageM3)}</b> / {load.capacityM3}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
