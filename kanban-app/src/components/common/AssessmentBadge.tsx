import { assessmentLabelKey, assessmentTone } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { DeferralAssessment } from "../../types/kanban";
import styles from "./badge.module.css";

export function AssessmentBadge({ assessment }: { assessment: DeferralAssessment }) {
  const { t } = useI18n();
  return (
    <span className={`${styles.badge} ${styles[assessmentTone(assessment)]}`}>
      {t(assessmentLabelKey(assessment))}
    </span>
  );
}
