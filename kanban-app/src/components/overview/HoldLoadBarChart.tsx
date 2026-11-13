import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  FloatingPortal,
  safePolygon,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useId,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useI18n } from "../../i18n/useI18n";
import type { DeferralPlan, HoldLoadView, LoadMetric } from "../../types/kanban";
import { floatingStyle, floatingUi } from "../common/floating";
import { InfoPopover } from "../common/InfoPopover";
import { CHART_Y_MAX, chartStyle } from "./chartScale";
import { FlightBarColumn } from "./FlightBarColumn";
import { FlightBarTooltip } from "./FlightBarTooltip";
import styles from "./HoldLoadBarChart.module.css";

function BarWithTip({
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
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "right-start",
    ...floatingUi,
  });
  const hover = useHover(context, { move: false, handleClose: safePolygon() });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);
  const tooltipId = useId();

  return (
    <div className={styles.slot}>
      <div className={styles.hit} ref={refs.setReference} {...getReferenceProps()}>
        <FlightBarColumn
          load={load}
          plan={plan}
          metric={metric}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
      {open ? (
        <FloatingPortal>
          <div
            id={tooltipId}
            role="tooltip"
            ref={refs.setFloating}
            style={floatingStyle(floatingStyles)}
            {...getFloatingProps()}
          >
            <FlightBarTooltip load={load} plan={plan} />
          </div>
        </FloatingPortal>
      ) : null}
    </div>
  );
}

const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2];
const AXIS_W = 46;
const COL_MIN = 112;
const COL_GAP = 10;

function chartLayout(plotWidth: number): { cols: number; caps: boolean } {
  const grid = Math.max(0, plotWidth - AXIS_W);
  const need = (count: number, gutter: number) => count * COL_MIN + Math.max(0, count - 1) * COL_GAP + gutter;
  if (grid >= need(5, 104)) return { cols: 5, caps: true };
  if (grid >= need(5, 16)) return { cols: 5, caps: false };
  if (grid >= need(3, 16)) return { cols: 3, caps: false };
  if (grid >= need(2, 16)) return { cols: 2, caps: false };
  return { cols: 1, caps: false };
}

function useChartLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(() =>
    chartLayout(typeof window === "undefined" ? 1200 : window.innerWidth - 80),
  );
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const apply = (width: number) => {
      const next = chartLayout(width);
      setLayout((current) => (current.cols === next.cols && current.caps === next.caps ? current : next));
    };
    apply(node.clientWidth);
    const observer = new ResizeObserver((entries) => apply(entries[0].contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, ...layout };
}

function tickBottom(tick: number): string {
  return `calc(${tick} / ${CHART_Y_MAX} * var(--chart-plot) + var(--chart-footer))`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function PlotRow({
  flights,
  plans,
  metric,
  selectedFlightId,
  onSelectFlight,
  cap90,
  cap100,
}: {
  flights: HoldLoadView[];
  plans: Record<string, DeferralPlan>;
  metric: LoadMetric;
  selectedFlightId: string | null;
  onSelectFlight: (flightId: string) => void;
  cap90: string;
  cap100: string;
}) {
  return (
    <div className={styles.plot}>
      <div className={styles.axis}>
        {TICKS.map((tick) => (
          <span key={tick} style={{ bottom: tickBottom(tick) }}>
            {Math.round(tick * 100)}%
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {TICKS.map((tick) => (
          <i key={tick} style={{ bottom: tickBottom(tick) }} />
        ))}
        <b className={styles.line90} />
        <b className={styles.line100} />
        <em className={styles.cap90}>{cap90}</em>
        <em className={styles.cap100}>{cap100}</em>
        <div className={styles.cols}>
          {flights.map((load) => (
            <BarWithTip
              key={load.flightId}
              load={load}
              plan={plans[load.flightId]}
              metric={metric}
              selected={selectedFlightId === load.flightId}
              onSelect={onSelectFlight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HoldLoadBarChart({
  flights,
  plans,
  metric,
  selectedFlightId,
  onSelectFlight,
}: {
  flights: HoldLoadView[];
  plans: Record<string, DeferralPlan>;
  metric: LoadMetric;
  selectedFlightId: string | null;
  onSelectFlight: (flightId: string) => void;
}) {
  const { t } = useI18n();
  const { ref, cols, caps } = useChartLayout();
  const rows = chunk(flights, cols);
  return (
    <section
      className={`${styles.card} ${caps ? styles.withCaps : ""}`}
      style={{ ...chartStyle, "--chart-cols": String(cols) } as CSSProperties}
    >
      <div className={styles.head}>
        <h3>{t("kb.chart.title")}</h3>
        <span className={styles.note}>{t("kb.chart.sort")}</span>
      </div>
      <div className={styles.plots} ref={ref}>
        {rows.map((row, index) => (
          <PlotRow
            key={row.map((load) => load.flightId).join("-")}
            flights={row}
            plans={plans}
            metric={metric}
            selectedFlightId={selectedFlightId}
            onSelectFlight={onSelectFlight}
            cap90={caps && index === 0 ? t("kb.line.90") : ""}
            cap100={caps && index === 0 ? t("kb.line.100") : ""}
          />
        ))}
      </div>
      <div className={styles.legend}>
        <span><i className={styles.cargo} />{t("kb.legend.cargo")}
          <InfoPopover label={t("kb.legend.cargoHint")}>{t("kb.legend.cargoHint")}</InfoPopover>
        </span>
        <span><i className={styles.pax} />{t("kb.legend.pax")}</span>
        <span><i className={styles.plume} />{t("kb.legend.plume")}</span>
        <span><i className={styles.defer} />{t("kb.legend.defer")}</span>
        {caps ? null : (
          <>
            <span><b className={styles.rule100} />{t("kb.line.100")}</span>
            <span><b className={styles.rule90} />{t("kb.line.90")}</span>
          </>
        )}
        <span className={styles.note}>{t("kb.legend.volTighter")}</span>
      </div>
    </section>
  );
}
