import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n/dictionary";
import { formatRatio } from "../format";
import type { ServiceView } from "../types";
import { MemberCard } from "./MemberCard";
import styles from "./ServiceFunnel.module.css";

const STEP_KEY: Record<ServiceView["layers"][number]["step"], TranslationKey> = {
  start_prepare: "mb.svc.learn",
  reach_checkout: "mb.svc.checkout",
  payment_success: "mb.svc.paid",
};

export function ServiceFunnel({ service }: { service: ServiceView }) {
  const { t } = useI18n();
  const noSample = t("mb.noSample");
  const widest = Math.max(service.layers[0]?.members ?? 0, 1);
  const empty = service.layers.every((layer) => layer.members === 0);

  return (
    <MemberCard questionKey="mb.q3" showScopeAll={false}>
      <div className={styles.metrics}>
        <p>
          <small>{t("mb.svc.paidOfJoined")}</small>
          <b>{formatRatio(service.bookingConversion, noSample)}</b>
        </p>
        <p>
          <small>{t("mb.svc.paidOfLearn")}</small>
          <b className={styles.mid}>{formatRatio(service.learnedThenPaid, noSample)}</b>
        </p>
      </div>
      {service.marksDemoAlignment ? <p className={styles.note}>{t("mb.demoAligned")}</p> : null}
      <div className={styles.funnel}>
        {service.layers.map((layer, index) => (
          <div key={layer.step}>
            <div className={styles.step}>
              <span>{t(STEP_KEY[layer.step])}</span>
              <span className={`${styles.track} ${empty ? styles.empty : ""}`}>
                <span
                  className={styles.fill}
                  style={{ width: empty ? "0%" : `${(layer.members / widest) * 100}%` }}
                />
              </span>
              <b>{layer.members}</b>
            </div>
            {index < service.dropoffs.length ? (
              <p className={styles.drop}>
                {t("mb.svc.drop")} {service.dropoffs[index]}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </MemberCard>
  );
}
