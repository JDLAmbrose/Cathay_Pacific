import { formatSectorCode } from "../../config/sectors";
import { formatDep, formatKg, formatPct } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { DeferralPlan, HoldLoadView } from "../../types/kanban";
import { StatusBadge } from "../common/StatusBadge";
import styles from "./FlightManifestTable.module.css";

function RoutingBar({ load, plan }: { load: HoldLoadView; plan: DeferralPlan }) {
  const total = Math.max(load.plumeDeclaredKg, 1);
  const onFlight = Math.max(0, load.plumeOnFlightKg - plan.deferKg);
  return (
    <span className={styles.mini} aria-hidden="true">
      <i style={{ width: `${(onFlight / total) * 100}%`, background: "var(--seg-plume)" }} />
      <i style={{ width: `${(load.plumeArrivedKg / total) * 100}%`, background: "var(--off)" }} />
      <i style={{ width: `${(plan.deferKg / total) * 100}%`, background: "repeating-linear-gradient(45deg,#2f6fb5 0 3px,#fff 3px 6px)" }} />
    </span>
  );
}

export function FlightManifestTable({
  flights,
  plans,
  selectedFlightId,
  onSelectFlight,
}: {
  flights: HoldLoadView[];
  plans: Record<string, DeferralPlan>;
  selectedFlightId: string | null;
  onSelectFlight: (flightId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section className={styles.card}>
      <h3>{t("kb.table.title")}</h3>
      <table>
        <thead>
          <tr>
            <th>{t("kb.table.flight")}</th>
            <th>{t("kb.table.sector")}</th>
            <th>{t("kb.table.dep")}</th>
            <th>{t("kb.table.acft")}</th>
            <th className={styles.num}>{t("kb.table.seats")}</th>
            <th className={styles.num}>{t("kb.table.cap")}</th>
            <th className={styles.num}>{t("kb.table.cargo")}</th>
            <th className={styles.num}>{t("kb.table.pax")}</th>
            <th className={styles.num}>{t("kb.table.plume")}</th>
            <th className={styles.num}>{t("kb.table.wt")}</th>
            <th className={styles.num}>{t("kb.table.vol")}</th>
            <th>{t("kb.table.status")}</th>
            <th>{t("kb.table.routing")}</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((load) => (
            <tr
              key={load.flightId}
              className={selectedFlightId === load.flightId ? styles.sel : undefined}
              onClick={() => onSelectFlight(load.flightId)}
            >
              <td><b>{load.flightId}</b></td>
              <td>{formatSectorCode(load.sector)}</td>
              <td>{formatDep(load.dep)}</td>
              <td>{load.aircraft}</td>
              <td className={styles.num}>{load.seats}</td>
              <td className={styles.num}>{formatKg(load.capacityKg)}</td>
              <td className={styles.num}>
                {load.commercialCargoKg == null ? t("kb.unk") : formatKg(load.commercialCargoKg)}
              </td>
              <td className={styles.num}>{formatKg(load.estimatedPaxBaggageKg)}</td>
              <td className={styles.num}>
                {formatKg(load.plumeOnFlightKg)} ({formatPct(load.plumeShare)})
              </td>
              <td className={styles.num}>{formatPct(load.weightLoadRatio)}</td>
              <td className={styles.num}>
                {formatPct(load.volumeLoadRatio)}
                {load.hasVolumeBottleneck ? " ▲" : ""}
              </td>
              <td><StatusBadge status={load.status} /></td>
              <td><RoutingBar load={load} plan={plans[load.flightId]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
