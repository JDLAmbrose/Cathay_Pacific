import { publicUrl } from "../../config/publicUrl";
import { useI18n } from "../../i18n/useI18n";
import type { MapView } from "../types";
import styles from "./RouteMap.module.css";

const HKG = { x: 816.4, y: 178.7 };
const LHR = { x: 498.7, y: 85.1 };
const ARC = "M816.4,178.7 Q657.6,61.9 498.7,85.1";

function strokeWidth(count: number, widest: number): number {
  if (count <= 0 || widest <= 0) {
    return 1.4;
  }
  return 1.8 + (count / widest) * 7.2;
}

export function RouteMap({
  map,
  showScopeAll,
}: {
  map: MapView;
  showScopeAll: boolean;
}) {
  const { t } = useI18n();
  const widest = Math.max(...map.corridors.map((row) => row.activeMembers), 1);

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2>
          {t("mb.map.title")}
          {showScopeAll ? <span className={styles.badge}>{t("mb.scopeAll")}</span> : null}
        </h2>
        <p className={styles.total}>
          <b>{map.paidMembers}</b>
          <small>{t("mb.map.paidMembers")}</small>
        </p>
      </div>
      <svg className={styles.map} viewBox="430 28 430 196" role="img" aria-label={t("mb.map.title")}>
        <image href={publicUrl("maps/world-outline.svg")} x="0" y="0" width="1000" height="430" />
        {map.corridors.map((row) => (
          <path
            key={row.corridor}
            d={ARC}
            fill="none"
            stroke="#02544f"
            strokeWidth={strokeWidth(row.activeMembers, widest)}
            strokeLinecap="round"
            className={styles.arc}
          />
        ))}
        <circle cx={HKG.x} cy={HKG.y} r="5.5" fill="#02544f" />
        <text x={HKG.x - 10} y={HKG.y - 12} textAnchor="end" className={styles.city}>HKG</text>
        <circle cx={LHR.x} cy={LHR.y} r="4.5" fill="#043f39" />
        <text x={LHR.x - 8} y={LHR.y - 12} textAnchor="end" className={styles.city}>LHR</text>
      </svg>
      <div className={styles.routes}>
        {map.corridors.map((row) => (
          <div key={row.corridor} className={`${styles.route} ${styles.on}`}>
            <div className={styles.identity}>
              <em>{row.corridor}</em>
              <strong>{row.activeMembers}</strong>
              <span>{t("mb.map.inUse")}</span>
            </div>
            <div className={styles.counts}>
              <span>{t("mb.map.students")} {row.students}</span>
              <span>{t("mb.map.parents")} {row.parents}</span>
              <span>{t("mb.map.business")} {row.business}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
