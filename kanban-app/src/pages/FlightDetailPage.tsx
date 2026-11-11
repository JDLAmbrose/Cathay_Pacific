import { DeferralFlowChart } from "../components/detail/DeferralFlowChart";
import { FlightHeaderBanner } from "../components/detail/FlightHeaderBanner";
import { HoldOccupancyCard } from "../components/detail/HoldOccupancyCard";
import { PlumeAssessmentCard } from "../components/detail/PlumeAssessmentCard";
import type { SnapshotViewModel } from "../types/kanban";
import styles from "./FlightDetailPage.module.css";

export function FlightDetailPage({
  viewModel,
  flightId,
  onBack,
}: {
  viewModel: SnapshotViewModel;
  flightId: string;
  onBack: () => void;
}) {
  const load = viewModel.flights.find((flight) => flight.flightId === flightId);
  const plan = viewModel.deferralPlans[flightId];
  if (!load || !plan) {
    return (
      <div className={styles.page}>
        <button type="button" onClick={onBack}>
          ◀
        </button>
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <FlightHeaderBanner load={load} sector={load.sector} onBack={onBack} asOf={viewModel.asOf} />
      <div className={styles.grid}>
        <HoldOccupancyCard load={load} plan={plan} />
        <PlumeAssessmentCard load={load} plan={plan} windowDays={viewModel.windowDays} />
      </div>
      <DeferralFlowChart
        load={load}
        plan={plan}
        windowDays={viewModel.windowDays}
        sector={load.sector}
      />
    </div>
  );
}
