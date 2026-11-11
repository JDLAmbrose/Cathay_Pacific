import { state, storageOK, person, localHK } from "../engine/booking";
import { t, language, LOCALES, LOCALE_NAMES } from "../services/i18n";
import { page, helperFamilyPage } from "../services/navigation";
import { BOOK_PAGES, FAMILY_PAGES, href } from "../config/routes";
import { asset, cssVars, cx, keyed, Input, Select } from "../components/primitives";
import { FamilyNavigation } from "./FamilyNavigation";
import {
  icon,
  productName,
  productLogo,
  field,
  option,
  text,
  T,
} from "../components/shared";

function SiteHeader() {
  return (
    <>
      <a className={cx("skip")} href={"#main"}>
        {T("skip")}
      </a>
      <div className={cx("topline")}>
        <span>{T("brand.line")}</span>
        <span>{text(productName())}</span>
      </div>
      <header className={cx("site-header")}>
        <div className={cx("nav")}>
          <a
            className={cx(
              "brand" +
                String(language === "zh-Hant" ? " brand-with-tagline" : ""),
            )}
            href={href("home")}
          >
            {productLogo()}
            {language === "zh-Hant" ? (
              <span className={cx("brand-tagline")}>{"泰易送，翼隨行"}</span>
            ) : (
              ""
            )}
          </a>
          <nav className={cx("main-nav")} aria-label={T("nav.main")}>
            {keyed(
              [
                ["home", "home"],
                ["book", "book"],
                ["agent", "agent"],
                ["journey", "journey"],
                ["family", "family"],
                ["ops", "ops"],
              ].map(([view, key]) =>
                key === "family" ? (
                  <FamilyNavigation page={page} helper={helperFamilyPage} />
                ) : (
                  <a
                    className={cx("tab")}
                    href={href(view)}
                    aria-current={state.view === view ? "page" : undefined}
                  >
                    {T("nav." + key)}
                  </a>
                ),
              ),
            )}
          </nav>
          <div className={cx("header-tools")}>
            <div className={cx("header-language")} dir="ltr">
              <img
                className={cx("cathay-logo")}
                src={asset("assets/cathay_logo.png")}
                alt="Cathay Pacific"
                width={1552}
                height={1891}
              />
              <label className={cx("language-control")}>
                {icon("globe")}
                <span className={cx("sr-only")}>{T("nav.language")}</span>
                <Select
                  id={"languageSelect"}
                  dir={language === "ar" ? "rtl" : undefined}
                  aria-label={T("nav.language")}
                  data-language={""}
                >
                  {keyed(
                    LOCALES.map((l, i) => option(l, LOCALE_NAMES[i], language)),
                  )}
                </Select>
              </label>
            </div>
            <button
              className={cx("fontbtn")}
              data-action={"font"}
              aria-label={T("nav.font")}
              aria-pressed={state.large}
            >
              {"Aa"}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
function FlightBanner() {
  const departure = new Date(state.flight.departure),
    arrival = new Date(departure.getTime() + 14.5 * 3600000),
    date = (d, tz) =>
      new Intl.DateTimeFormat(language === "zh-Hant" ? "zh-HK" : language, {
        timeZone: tz,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(d);
  const progress = 0;
  return (
    <div className={cx("flight-main")}>
      <div className={cx("flight-end")}>
        <div className={cx("flight-location")}>
          {T("banner.hk")}
          <span className={cx("flight-number")}>{" · CX257"}</span>
        </div>
        <div className={cx("flight-date")}>
          {text(date(departure, "Asia/Hong_Kong"))}
        </div>
        <div className={cx("flight-date-label")}>{T("banner.departure")}</div>
      </div>
      <div className={cx("flight-center")}>
        <div className={cx("flight-person")}>
          <strong>{text(person().name)}</strong>
          <span className={cx("separator")}>{"·"}</span>
          {T("banner.cabin")}
          <span className={cx("separator")}>{"·"}</span>
          {T(state.travellerId === "child" ? "banner.child" : "banner.adult")}
        </div>
        <div
          className={cx("flight-track")}
          style={cssVars({ "--flight-progress": String(progress) + "%" })}
        >
          <span className={cx("flight-plane")}>{icon("plane")}</span>
        </div>
        <div className={cx("flight-progress")}>
          {T("banner.progress")}{" "}
          <b>
            {progress}
            {"%"}
          </b>
          {" · "}
          {T("banner.ontime")}
        </div>
      </div>
      <div className={cx("flight-end")}>
        <div className={cx("flight-location")}>{T("banner.london")}</div>
        <div className={cx("flight-date")}>
          {text(date(arrival, "Europe/London"))}
        </div>
        <div className={cx("flight-date-label")}>{T("banner.arrival")}</div>
      </div>
    </div>
  );
}
function SiteFooter() {
  return (
    <>
      <a
        className={cx("footer-brand")}
        href={href("home")}
        aria-label={text(productName())}
      >
        {productLogo()}
      </a>
      <div className={cx("footer-copy")}>
        <p>{T("footer.line")}</p>
        <p>
          {T("footer.demo")}
          {" · CX257 · PRD 1.3"}
        </p>
      </div>
      {page === "home" ||
      BOOK_PAGES.includes(page) ||
      FAMILY_PAGES.includes(page) ? (
        <div className={cx("privacy-statement")}>
          <strong>{T("privacy.title")}</strong>
          <p>{T("privacy.text")}</p>
        </div>
      ) : (
        ""
      )}
    </>
  );
}
function DemoControls() {
  return (
    <details className={cx("controlbar")}>
      <summary>
        {T("demo.title")}
        {" · "}
        {T("demo.sub")}
      </summary>
      <div className={cx("controlgrid")}>
        {field("demo.clock", "clock", localHK(state.clock), "datetime-local")}
        {field(
          "demo.departure",
          "flight.departure",
          localHK(state.flight.departure),
          "datetime-local",
        )}
        <label className={cx("field")}>
          <span>{T("demo.quality")}</span>
          <Select className={cx("input")} data-field={"agent.quality"}>
            {keyed(
              ["current", "missing", "expired", "conflict"].map((q) =>
                option(q, t("demo." + q), state.agent.quality),
              ),
            )}
          </Select>
        </label>
        {field("demo.balance", "milesBalance", state.milesBalance, "number", {
          min: "0",
          step: "1",
        })}
      </div>
      <label className={cx("check")}>
        <Input
          type={"checkbox"}
          data-field={"forceFail"}
          checked={state.forceFail}
        />
        <span>{T("demo.fail")}</span>
      </label>
      <div className={cx("actions")}>
        {keyed(
          ["student", "family", "late", "unknown"].map((s) => (
            <button
              className={cx("btn slim light")}
              data-action={"scenario"}
              data-scenario={s}
            >
              {T("demo." + s)}
            </button>
          )),
        )}
      </div>
      <div className={cx("note")}>
        {T(storageOK ? "demo.storage" : "demo.storageOff")}
      </div>
    </details>
  );
}

export { SiteHeader, FlightBanner, SiteFooter, DemoControls };
