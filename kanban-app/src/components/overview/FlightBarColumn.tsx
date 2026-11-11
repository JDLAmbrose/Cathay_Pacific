import { formatDep, formatIntPct } from "../../format/display";
import type { DeferralPlan, HoldLoadView, LoadMetric } from "../../types/kanban";
import { StatusBadge } from "../common/StatusBadge";
import styles from "./FlightBarColumn.module.css";

const Y_MAX = 1.2;
const PLOT_H = 250;
const PLOT_T = 8;

function y(ratio: number): number {
  return PLOT_T + PLOT_H - (ratio / Y_MAX) * PLOT_H;
}

export function FlightBarColumn({
  load,
  plan,
  metric,
  selected,
  onSelect,
}: {
  load: HoldLoadView;
  plan: DeferralPlan;
  metric: LoadMetric;
  selected: boolean;
  onSelect: (flightId: string) => void;
}) {
  const cap = metric === "weight" ? load.capacityKg : load.capacityM3;
  const cargo = metric === "weight" ? load.commercialCargoKg : load.commercialCargoM3;
  const pax = metric === "weight" ? load.estimatedPaxBaggageKg : load.estimatedPaxBaggageM3;
  const plume = metric === "weight" ? load.plumeOnFlightKg : load.plumeOnFlightM3;
  const defer = metric === "weight" ? plan.deferKg : plan.allocations.reduce((sum, item) => sum + item.m3, 0);
  const keep = Math.max(0, plume - defer);
  const cargoRatio = cargo == null ? 0 : cargo / cap;
  const paxRatio = pax / cap;
  const keepRatio = keep / cap;
  const deferRatio = defer / cap;
  const governing = metric === "weight" ? load.weightLoadRatio : load.volumeLoadRatio;
  const isUnk = load.status === "CARGO_UNK";
  const topLabel = isUnk
    ? `BAG ${formatIntPct(governing)}`
    : `${formatIntPct(governing)}${load.hasVolumeBottleneck ? " ▲" : ""}`;
  const stackTop = cargoRatio + paxRatio + keepRatio + deferRatio;
  const bw = 52;
  const x = 24;

  return (
    <button
      type="button"
      className={`${styles.col} ${selected ? styles.selected : ""} ${load.status === "OVER" ? styles.hot : ""}`}
      onClick={() => onSelect(load.flightId)}
    >
      <svg viewBox={`0 0 100 ${PLOT_T + PLOT_H + 4}`} className={styles.bar} aria-hidden="true">
        <defs>
          <pattern id={`defer-${load.flightId}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#fff" />
            <rect width="2.6" height="6" fill="#2f6fb5" />
          </pattern>
        </defs>
        {cargo != null ? (
          <rect x={x} y={y(cargoRatio)} width={bw} height={y(0) - y(cargoRatio)} fill="var(--seg-cargo)" />
        ) : null}
        <rect
          x={x}
          y={y(cargoRatio + paxRatio)}
          width={bw}
          height={y(cargoRatio) - y(cargoRatio + paxRatio)}
          fill="var(--seg-pax)"
        />
        <rect
          x={x}
          y={y(cargoRatio + paxRatio + keepRatio)}
          width={bw}
          height={y(cargoRatio + paxRatio) - y(cargoRatio + paxRatio + keepRatio)}
          fill="var(--seg-plume)"
        />
        {deferRatio > 0 ? (
          <rect
            x={x}
            y={y(stackTop)}
            width={bw}
            height={y(cargoRatio + paxRatio + keepRatio) - y(stackTop)}
            fill={`url(#defer-${load.flightId})`}
            stroke="#2f6fb5"
          />
        ) : null}
        {isUnk ? (
          <>
            <rect
              x={x}
              y={y(1)}
              width={bw}
              height={Math.max(0, y(stackTop) - y(1))}
              fill="#f6f8f8"
              stroke="#9aa5a3"
              strokeDasharray="4 3"
            />
            <text x="50" y={(y(1) + y(stackTop)) / 2 + 4} textAnchor="middle" fontSize="9" fill="#5d6f6d" fontWeight="600">
              CARGO UNK
            </text>
          </>
        ) : null}
        {stackTop > 1.0001 ? (
          <rect
            x={x - 1.5}
            y={y(stackTop) - 1.5}
            width={bw + 3}
            height={y(1) - y(stackTop) + 1.5}
            fill="none"
            stroke="#d6453d"
            strokeWidth="2.2"
          />
        ) : null}
        <rect x="22" y={y(Math.max(stackTop, isUnk ? 1 : stackTop)) - 20} width="56" height="16" rx="3" fill="#fff" />
        <text
          x="50"
          y={y(Math.max(stackTop, isUnk ? 1 : stackTop)) - 8}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={isUnk ? "#9aa5a3" : stackTop >= 1 ? "#d6453d" : load.status === "CAUTION" ? "#d99a12" : "#2f9e6b"}
        >
          {topLabel}
        </text>
      </svg>
      <div className={styles.flight}>{load.flightId}</div>
      <div className={styles.dep}>{formatDep(load.dep)}</div>
      <StatusBadge status={load.status} />
    </button>
  );
}
