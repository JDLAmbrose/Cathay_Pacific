import { useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { formatHkd, formatRatio } from "../format";
import type { AudienceFilter, PromoView } from "../types";
import { MemberCard } from "./MemberCard";
import meter from "./meter.module.css";
import styles from "./PromoSplit.module.css";

export function PromoSplit({ promo, audience }: { promo: PromoView; audience: AudienceFilter }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const widest = Math.max(promo.familyOrders, promo.officialOrders, 1);

  return (
    <MemberCard questionKey="mb.q8" showScopeAll={audience !== "all"}>
      <p className={styles.usage}>
        <small>{t("mb.promo.usage")}</small>
        <b>{formatRatio(promo.usage, t("mb.noSample"))}</b>
      </p>
      <div className={meter.rows}>
        <div>
          <div className={meter.top}>
            <span>{t("mb.promo.family")}</span>
            <b>
              {promo.familyOrders} {t("mb.promo.orders")} · {formatHkd(promo.familyRevenueHkd)}
            </b>
          </div>
          <div className={meter.track}>
            <i style={{ width: `${(promo.familyOrders / widest) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className={meter.top}>
            <span>{t("mb.promo.official")}</span>
            <b>
              {promo.officialOrders} {t("mb.promo.orders")}
            </b>
          </div>
          <div className={meter.track}>
            <i className={meter.soft} style={{ width: `${(promo.officialOrders / widest) * 100}%` }} />
          </div>
        </div>
      </div>
      <button type="button" className={styles.toggle} onClick={() => setOpen((current) => !current)}>
        {open ? t("mb.promo.collapse") : t("mb.promo.expand")}
      </button>
      {open ? (
        <ul className={styles.codes}>
          {[...promo.familyCodes, ...promo.officialCodes].map((code) => (
            <li key={code.code}>
              <span>{code.code}</span>
              <b>
                {code.orders} {t("mb.promo.orders")}
              </b>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.lock}>{t("mb.roiLocked")}</p>
    </MemberCard>
  );
}
