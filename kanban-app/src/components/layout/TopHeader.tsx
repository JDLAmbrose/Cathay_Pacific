import { publicUrl, siteHomeHref } from "../../config/publicUrl";
import { useI18n } from "../../i18n/useI18n";
import type { Locale } from "../../i18n/dictionary";
import { SyncIndicator } from "../common/SyncIndicator";
import styles from "./TopHeader.module.css";

export function TopHeader({ live }: { live: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const homeHref = siteHomeHref();
  return (
    <header className={styles.top}>
      <a className={styles.brand} href={homeHref} title={t("kb.homeHint")}>
        <img
          className={styles.logo}
          src={publicUrl("brand/plume_light_logo_horizontal_reversed.svg")}
          alt="Plume Light"
        />
      </a>
      <a className={styles.home} href={homeHref} title={t("kb.homeHint")}>
        {t("kb.home")}
      </a>
      <span className={styles.staff}>{t("kb.staffOnly")}</span>
      <SyncIndicator live={live} />
      <span className={styles.spacer} />
      <img className={styles.brush} src={publicUrl("brand/cathay-brushwing-white.png")} alt="" />
      {(["zh-Hant", "en"] as Locale[]).map((item) => (
        <button
          key={item}
          type="button"
          className={`${styles.lang} ${locale === item ? styles.on : ""}`}
          onClick={() => setLocale(item)}
        >
          {item === "zh-Hant" ? t("kb.lang.zh") : t("kb.lang.en")}
        </button>
      ))}
    </header>
  );
}
