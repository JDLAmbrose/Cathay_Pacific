import { boardsHubHref, publicUrl, siteHomeHref } from "../../config/publicUrl";
import { useI18n } from "../../i18n/useI18n";
import type { Locale } from "../../i18n/dictionary";
import { SyncIndicator } from "../common/SyncIndicator";
import styles from "./TopHeader.module.css";

export function TopHeader({
  live,
  board,
  onBoardChange,
}: {
  live: boolean;
  board: "cargo" | "members";
  onBoardChange: (board: "cargo" | "members") => void;
}) {
  const { t, locale, setLocale } = useI18n();
  const homeHref = siteHomeHref();
  const hubHref = boardsHubHref();
  return (
    <header className={styles.top}>
      <a className={styles.brand} href={homeHref} title={t("kb.homeHint")}>
        <img
          className={styles.logo}
          src={publicUrl("brand/plume_light_logo_horizontal_reversed.svg")}
          alt="Plume Light"
        />
      </a>
      <a className={styles.back} href={hubHref} title={t("kb.backHint")}>
        {t("kb.back")}
      </a>
      <a className={styles.home} href={homeHref} title={t("kb.homeHint")}>
        {t("kb.home")}
      </a>
      <span className={styles.staff}>{t("kb.staffOnly")}</span>
      <span className={styles.switch}>
        <button
          type="button"
          className={board === "cargo" ? styles.switchOn : ""}
          onClick={() => onBoardChange("cargo")}
        >
          {t("mb.board.cargo")}
        </button>
        <button
          type="button"
          className={board === "members" ? styles.switchOn : ""}
          onClick={() => onBoardChange("members")}
        >
          {t("mb.board.members")}
        </button>
      </span>
      {board === "members" ? <span className={styles.sim}>{t("mb.simulated")}</span> : null}
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
