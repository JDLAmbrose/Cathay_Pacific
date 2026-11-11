import { useI18n } from "../../i18n/useI18n";
import { InfoPopover } from "./InfoPopover";
import styles from "./SyncIndicator.module.css";

export function SyncIndicator({ live }: { live: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`${styles.sync} ${live ? styles.live : ""}`}>
      <i className={styles.pulse} />
      {live ? t("kb.sync.live") : t("kb.sync.json")}
      <InfoPopover label={t("kb.sync.hint")}>{t("kb.sync.hint")}</InfoPopover>
    </span>
  );
}
