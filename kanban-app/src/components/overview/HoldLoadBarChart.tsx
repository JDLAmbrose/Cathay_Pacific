import { useState } from "react";
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
      <div ref={refs.setReference} {...getReferenceProps()}>
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

const COLS_PER_ROW = 5;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2];

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
          <span key={tick} style={{ bottom: `${(tick / 1.2) * 250 + 46}px` }}>
            {Math.round(tick * 100)}%
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {TICKS.map((tick) => (
          <i key={tick} style={{ bottom: `${(tick / 1.2) * 250 + 46}px` }} />
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
  const rows = chunk(flights, COLS_PER_ROW);
  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h3>{t("kb.chart.title")}</h3>
        <span className={styles.note}>{t("kb.chart.sort")}</span>
      </div>
      <div className={styles.plots}>
        {rows.map((row, index) => (
          <PlotRow
            key={row.map((load) => load.flightId).join("-")}
            flights={row}
            plans={plans}
            metric={metric}
            selectedFlightId={selectedFlightId}
            onSelectFlight={onSelectFlight}
            cap90={index === 0 ? t("kb.line.90") : ""}
            cap100={index === 0 ? t("kb.line.100") : ""}
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
        <span className={styles.note}>{t("kb.legend.volTighter")}</span>
      </div>
    </section>
  );
}
