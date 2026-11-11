import { fmt, money, displayValue } from "../engine/booking";
import { t } from "../services/i18n";
import { ROOT_PREFIX, href } from "../config/routes";
import { cx, asset, Input, Option } from "../components/primitives";

const paths: Record<string, string> = {
  arrow: "M4 10h12m-5-5 5 5-5 5",
  back: "M16 10H4m5-5-5 5 5 5",
  globe:
    "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM2 10h16M10 2c-4 4-4 12 0 16 4-4 4-12 0-16Z",
  bag: "M6 5V3h8v2M4 5h12v13H4ZM7 8v7m3-7v7m3-7v7M6 18v1m8-1v1",
  spark:
    "m10 2 2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5ZM17 2v3m-1.5-1.5h3",
  home: "m2 9 8-7 8 7M4 8v10h12V8M8 18v-6h4v6",
  miles: "m10 2 8 8-8 8-8-8Z M10 6l4 4-4 4-4-4Z",
  check: "m4 10 4 4 8-8",
  plane: "M10 1 8 8 2 11v2l6-1v5l-2 1v1l4-1 4 1v-1l-2-1v-5l6 1v-2l-6-3-2-7Z",
  clock: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM10 5v5l3 2",
  chevron: "m7 5 5 5-5 5",
};
Object.assign(paths, {
  person: "M13 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 18v-2a6 6 0 0 1 12 0v2",
  upload: "M10 13V2m-4 4 4-4 4 4M3 12v5h14v-5",
  document: "M5 2h7l4 4v12H5ZM12 2v5h4M8 11h5m-5 3h5",
  shirt: "m6 3 4 2 4-2 4 5-3 2v7H5v-7L2 8Z",
  book: "M3 3h6l1 2 1-2h6v14h-6l-1 1-1-1H3ZM10 5v13",
  laptop: "M4 3h12v10H4ZM2 16h16l-2-3H4Z",
  battery: "M7 2h6v3h3v13H4V5h3ZM10 7l-2 4h4l-2 4",
  bottle: "M8 2h4v4l2 3v9H6V9l2-3ZM6 11h8",
  medicine: "m5 5 7 7m-9 2L13 4a4 4 0 0 1 5 5L8 19a4 4 0 0 1-5-5Z",
  food: "M4 4h12l-1 13H5ZM3 4h14M7 4V2m6 2v2M7 10h6",
  fragile: "M5 2h10v4a5 5 0 0 1-10 0ZM10 11v7m-4 0h8M10 2 8 5l3 2-2 3",
  ball: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM7 7l6 6m0-6-6 6M3 6c4 0 7 3 7 11M10 3c0 7 3 11 7 11",
  access:
    "M12 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM10 6v6h5l3 5M10 8h5M7 9a5 5 0 1 0 7 7",
  box: "M3 6l7-4 7 4v11H3ZM3 6h14M10 2v7",
});
paths.grip = "M7 4h.01M13 4h.01M7 10h.01M13 10h.01M7 16h.01M13 16h.01";
Object.assign(paths, {
  card: "M2 5h16v11H2ZM2 9h16M5 13h4",
  phone: "M6 2h8v16H6ZM9 15h2",
  mail: "M2 4h16v12H2ZM2 5l8 6 8-6",
  shield: "M10 2 3 5v5c0 4.2 3 7 7 8 4-1 7-3.8 7-8V5ZM7 10l2 2 4-4",
  parent:
    "M8.5 5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM2 18v-3a4 4 0 0 1 8 0v3M16.5 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM11.5 18v-2a3 3 0 0 1 6 0v2",
  external: "M11 3h6v6M17 3l-8 8M14 12v5H3V6h5",
});
function icon(name, cls = "") {
  return (
    <svg
      className={cx("icon " + String(cls))}
      viewBox={"0 0 20 20"}
      aria-hidden={"true"}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
function productName() {
  return "Plume Light";
}
function productLogo(reversed = false) {
  return (
    <img
      className={cx(
        "brand-logo" + String(reversed ? " brand-logo-reversed" : ""),
      )}
      src={asset(
        String(ROOT_PREFIX) +
          "assets/plume_light_logo_horizontal" +
          String(reversed ? "_reversed" : "") +
          ".svg",
      )}
      alt={"Plume Light"}
      width={reversed ? "840" : "770"}
      height={reversed ? "269" : "200"}
      decoding={"async"}
    />
  );
}
function productMark(cls = "") {
  return (
    <img
      className={cx("product-mark " + String(cls))}
      src={asset(String(ROOT_PREFIX) + "assets/plume_light_icon.svg")}
      alt={""}
      aria-hidden={"true"}
      width={208}
      height={200}
      decoding={"async"}
    />
  );
}
function link(view, label, cls = "btn", step?: number | string) {
  return (
    <a className={cx(cls)} href={href(view, step)}>
      {label}
      {icon("arrow", "arrow")}
    </a>
  );
}
function field(key, name, value, type = "text", extra = {}, full = false) {
  return (
    <label className={cx("field " + String(full ? "full" : ""))}>
      <span>{T(key)}</span>
      <Input
        className={cx("input")}
        type={type}
        data-field={name}
        value={V(value)}
        {...extra}
      />
    </label>
  );
}
function option(value, label, current) {
  return (
    <Option
      value={text(value)}
      {...(value === current ? { selected: true } : {})}
    >
      {text(label)}
    </Option>
  );
}
function row(key, value, cls = "") {
  return (
    <div className={cx("row " + String(cls))}>
      <span className={cx("muted")}>{T(key)}</span>
      <strong>{value}</strong>
    </div>
  );
}
function head(title, sub, badge?: string) {
  return (
    <div className={cx("pagehead reveal")}>
      <div>
        <div className={cx("eyebrow page-identity")}>
          {productMark()}
          <span>
            {text(productName())}
            {" / CX257"}
          </span>
        </div>
        <h1>{T(title)}</h1>
        <p>{T(sub)}</p>
      </div>
      {badge ? <span className={cx("pill")}>{T(badge)}</span> : ""}
    </div>
  );
}
function readOnlyDetail(label, value) {
  return (
    <div className={cx("readonly-detail")}>
      <span>{T(label)}</span>
      <strong>{value}</strong>
    </div>
  );
}
function fareRowsHTML(q) {
  if (!q?.valid) return "";
  return (
    <>
      {q.priority ? row("fare.priority", text(money(q.priority))) : ""}
      {q.extraFee
        ? row(
            "fare.extraFee",
            T("common.pieces", { n: fmt(q.plan.quoted) }) +
              " · " +
              text(money(q.extraFee)),
          )
        : q.transport === "flight" || q.plan?.items.length
          ? row("fare.extraFee", text(money(0)))
          : ""}
      {q.cargoFee ? row("fare.cargoFee", text(money(q.cargoFee))) : ""}
    </>
  );
}
function allowanceSummaryHTML(q) {
  const plan = q?.plan;
  if (!plan?.allowance || !plan.items.length) return "";
  return (
    <>
      {row(
        "fare.included",
        T("fare.allowance", {
          n: fmt(plan.allowance.pieces),
          kg: fmt(plan.allowance.kgPerPiece),
        }),
      )}
      {row("fare.confirmed", T("common.pieces", { n: fmt(plan.purchased) }))}
    </>
  );
}
function servicePricingHTML() {
  return (
    <section className={cx("allowance-panel")}>
      <h3>{T("service.packagePrice")}</h3>
      <p>{T("service.packageSaving")}</p>
      <p className={cx("small muted")}>{T("service.packageScope")}</p>
    </section>
  );
}

function text(value: unknown) {
  return String(value ?? "");
}
const T = t,
  V = displayValue;

export {
  paths,
  icon,
  productName,
  productLogo,
  productMark,
  link,
  field,
  option,
  row,
  head,
  readOnlyDetail,
  fareRowsHTML,
  allowanceSummaryHTML,
  servicePricingHTML,
  text,
  T,
  V,
};
