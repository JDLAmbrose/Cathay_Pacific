import { statusLabelKey, statusTone } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { HoldStatus } from "../../types/kanban";
import styles from "./badge.module.css";

export function StatusBadge({ status, loadRatio }: { status: HoldStatus; loadRatio?: number }) {
  const { t } = useI18n();
  const pct = loadRatio == null ? "" : ` ${Math.round(loadRatio * 100)}%`;
  return <span className={`${styles.badge} ${styles[statusTone(status)]}`}>{t(statusLabelKey(status))}{pct}</span>;
}
