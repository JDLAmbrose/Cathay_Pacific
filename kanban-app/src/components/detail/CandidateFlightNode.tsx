import { formatDep, formatIntPct, formatKg } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { CandidateFlightView, CandidateRejectReason } from "../../types/kanban";
import type { TranslationKey } from "../../i18n/dictionary";
import styles from "./CandidateFlightNode.module.css";

function reasonKey(reason: CandidateRejectReason | null): TranslationKey {
  switch (reason) {
    case "OVER":
      return "kb.reason.over";
    case "CARGO_UNK":
      return "kb.reason.cargoUnk";
    case "CAUTION_VOL":
      return "kb.reason.cautionVol";
    default:
      return "kb.reason.insufficient";
  }
}

export function CandidateFlightNode({ candidate }: { candidate: CandidateFlightView }) {
  const { t } = useI18n();
  const accepted = candidate.decision === "ACCEPT";
  const why = accepted
    ? candidate.allocatedKg > 0
      ? `+${candidate.allocatedPieceCount} pcs · ${formatKg(candidate.allocatedKg)} kg · LOAD ${formatIntPct(candidate.loadRatioBefore)} → ${formatIntPct(candidate.loadRatioAfter ?? candidate.loadRatioBefore)}`
      : `LOAD ${formatIntPct(candidate.loadRatioBefore)}`
    : `${candidate.reason ?? "NO_GO"} · ${t(reasonKey(candidate.reason))}`;
  return (
    <div className={`${styles.node} ${accepted ? styles.accept : styles.nogo}`}>
      <b>{candidate.flightId}</b>
      <span className={styles.dep}>{formatDep(candidate.dep)}</span>
      <span className={`${styles.tag} ${accepted ? styles.ok : styles.bad}`}>
        {accepted ? t("kb.candidate.accept") : t("kb.candidate.nogo")}
      </span>
      <span className={styles.why}>{why}</span>
    </div>
  );
}
