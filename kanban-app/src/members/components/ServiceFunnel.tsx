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

const FILLS = ["#02544f", "#0e6a63", "#146860"];

function halfPercent(count: number, widest: number): number {
  if (count <= 0 || widest <= 0) {
    return 0;
  }
  return (count / widest) * 50;
}

function funnelClip(top: number, bottom: number): string {
  const topLeft = 50 - top;
  const topRight = 50 + top;
  const bottomRight = 50 + bottom;
  const bottomLeft = 50 - bottom;
  return `polygon(${topLeft}% 0, ${topRight}% 0, ${bottomRight}% 100%, ${bottomLeft}% 100%)`;
}

export function ServiceFunnel({ service }: { service: ServiceView }) {
  const { t } = useI18n();
  const noSample = t("mb.noSample");
  const widest = Math.max(...service.layers.map((layer) => layer.members), 1);
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
        {service.layers.map((layer, index) => {
          const next = service.layers[index + 1]?.members ?? layer.members;
          const bottomCount = next > 0 ? next : layer.members;
          const blank = empty || layer.members <= 0;
          const drop = index > 0 ? service.dropoffs[index - 1] : 0;
          const topHalf = halfPercent(layer.members, widest);
          const bottomHalf = halfPercent(bottomCount, widest);
          const inset = 50 - Math.min(topHalf, bottomHalf);
          const gutter = `max(16px, calc(${inset}% + 14px))`;
          return (
            <div
              key={layer.step}
              className={`${styles.band} ${blank ? styles.bandEmpty : ""}`}
              style={blank ? undefined : {
                background: FILLS[index],
                clipPath: funnelClip(topHalf, bottomHalf),
                paddingLeft: gutter,
                paddingRight: gutter,
              }}
            >
              <span>{t(STEP_KEY[layer.step])}</span>
              <b>
                {layer.members}
                {drop > 0 ? (
                  <em>
                    {t("mb.svc.drop")} {drop}
                  </em>
                ) : null}
              </b>
            </div>
          );
        })}
      </div>
    </MemberCard>
  );
}
