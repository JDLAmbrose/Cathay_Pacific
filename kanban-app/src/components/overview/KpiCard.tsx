import type { ReactNode } from "react";
import styles from "./KpiCard.module.css";

export function KpiCard({
  title,
  hint,
  value,
  sub,
  children,
}: {
  title: string;
  hint?: ReactNode;
  value: ReactNode;
  sub: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.title}>
        {title}
        {hint}
      </div>
      {value != null && value !== "" ? <div className={styles.value}>{value}</div> : null}
      {children}
      {sub !== "" ? <div className={styles.sub}>{sub}</div> : null}
    </section>
  );
}
