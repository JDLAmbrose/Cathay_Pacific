import { useI18n } from "../../i18n/useI18n";
import { DEMO_UNIT_PRICE_HKD } from "../config/presentation";
import { formatHkd } from "../format";
import type { AudienceFilter, RevenueView } from "../types";
import { MemberCard } from "./MemberCard";
import styles from "./RevenueComposition.module.css";

export function RevenueComposition({
  revenue,
  audience,
}: {
  revenue: RevenueView;
  audience: AudienceFilter;
}) {
  const { t } = useI18n();
  const noSample = t("mb.noSample");
  const total = revenue.revenueHkd;
  const width = (amount: number) => (total === 0 ? "0%" : `${(amount / total) * 100}%`);
  const profitShare = Math.max(0, 1 - revenue.tempCostRatio);
  const lanes = [
    { label: t("mb.rev.pickup"), amount: revenue.pickupHkd, className: styles.pickup, price: `HK$${DEMO_UNIT_PRICE_HKD.pickup} ${t("mb.unit.order")}` },
    { label: t("mb.rev.extra"), amount: revenue.extraBagHkd, className: styles.extra, price: `HK$${DEMO_UNIT_PRICE_HKD.extraBag} ${t("mb.unit.piece")}` },
    { label: t("mb.rev.cargo"), amount: revenue.cargoHkd, className: styles.cargo, price: `HK$${DEMO_UNIT_PRICE_HKD.cargoUnit} ${t("mb.unit.kg")}` },
  ];

  return (
    <MemberCard questionKey="mb.q1" showScopeAll={audience !== "all"}>
      <div className={styles.layout}>
        <div className={styles.metrics}>
          <p className={styles.lead}>
            <small>{t("mb.rev.profit")}</small>
            <b>{formatHkd(revenue.contributionProfitHkd)}</b>
          </p>
          <p className={styles.accent}>
            <small>{t("mb.rev.avgProfit")}</small>
            <b>{revenue.averageProfitHkd == null ? noSample : formatHkd(revenue.averageProfitHkd)}</b>
          </p>
          <p>
            <small>{t("mb.rev.revenue")}</small>
            <b className={styles.support}>{formatHkd(revenue.revenueHkd)}</b>
          </p>
          <p>
            <small>{t("mb.rev.orders")}</small>
            <b className={styles.support}>{revenue.paidOrders}</b>
          </p>
        </div>
        <div className={styles.composition}>
          <p className={styles.note}>
            {t("mb.rev.avgRevenue")} {revenue.averageRevenueHkd == null ? noSample : formatHkd(revenue.averageRevenueHkd)}
            {" · "}
            {t("mb.rev.notOfficial")}
          </p>
          <div className={styles.bar} aria-hidden={total === 0}>
            {lanes.map((lane) => (
              <i key={lane.label} className={`${styles.seg} ${lane.className}`} style={{ width: width(lane.amount) }} />
            ))}
          </div>
          <div className={styles.key}>
            {lanes.map((lane) => (
              <span key={lane.label}>
                <i className={lane.className} />
                {lane.label} {formatHkd(lane.amount)}
                <em>{lane.price}</em>
              </span>
            ))}
          </div>
          <div className={styles.hatchline}>
            <i className={styles.gain} style={{ width: `${profitShare * 100}%` }} />
            <i className={styles.cost} style={{ width: `${revenue.tempCostRatio * 100}%` }} />
          </div>
          <div className={styles.key}>
            <span><i className={styles.gain} />{t("mb.rev.profit")}</span>
            <span><i className={styles.cost} />{t("mb.rev.estimatedCost")}</span>
          </div>
          <p className={styles.note}>{t("mb.costPlaceholder")}</p>
        </div>
      </div>
    </MemberCard>
  );
}
