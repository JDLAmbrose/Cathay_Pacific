import type { ReactNode } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/dictionary";
import styles from "./MemberCard.module.css";

export function MemberCard({
  questionKey,
  showScopeAll,
  children,
}: {
  questionKey: TranslationKey;
  showScopeAll: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className={styles.card}>
      <h2>
        <span className={styles.question}>{t(questionKey)}</span>
        {showScopeAll ? <span className={styles.badge}>{t("mb.scopeAll")}</span> : null}
      </h2>
      {children}
    </section>
  );
}
