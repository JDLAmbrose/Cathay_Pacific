import { ActionQueuePanel } from "../components/overview/ActionQueuePanel";
import { FlightManifestTable } from "../components/overview/FlightManifestTable";
import { HoldLoadBarChart } from "../components/overview/HoldLoadBarChart";
import { KpiSummaryRow } from "../components/overview/KpiSummaryRow";
import type { LoadMetric, SnapshotViewModel } from "../types/kanban";
import styles from "./OverviewPage.module.css";

export function OverviewPage({
  viewModel,
  metric,
  selectedFlightId,
  onSelectFlight,
  live,
}: {
  viewModel: SnapshotViewModel;
  metric: LoadMetric;
  selectedFlightId: string | null;
  onSelectFlight: (flightId: string) => void;
  live: boolean;
}) {
  return (
    <div className={`${styles.page} ${live ? styles.live : ""}`}>
      <KpiSummaryRow kpi={viewModel.kpi} />
      <div className={styles.main}>
        <HoldLoadBarChart
          flights={viewModel.flights}
          plans={viewModel.deferralPlans}
          metric={metric}
          selectedFlightId={selectedFlightId}
          onSelectFlight={onSelectFlight}
        />
        <ActionQueuePanel
          items={viewModel.actionQueue}
          selectedFlightId={selectedFlightId}
          onSelectFlight={onSelectFlight}
        />
      </div>
      <FlightManifestTable
        flights={viewModel.flights}
        plans={viewModel.deferralPlans}
        selectedFlightId={selectedFlightId}
        onSelectFlight={onSelectFlight}
      />
    </div>
  );
}
