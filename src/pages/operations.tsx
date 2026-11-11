import {
  fmt,
  hk,
  PEOPLE,
  state,
  demand,
  forecastCapacity,
} from "../engine/booking";
import { t } from "../services/i18n";
import { ROOT_PREFIX } from "../config/routes";
import { cssVars, cx, asset, keyed, Input } from "../components/primitives";
import { icon, link, field, row, text, T } from "../components/shared";

function operationsAircraftHTML(f, o) {
  const measure = (value, unit, digits = 0) =>
    value == null ? T("common.missing") : text(fmt(value, digits)) + " " + unit;
  const zones = [
    [
      "bags",
      "ops.baggage",
      measure(f.weight, "kg"),
      T("ops.pieces") +
        " " +
        fmt(f.pieces) +
        " · " +
        measure(f.volume, "m³", 2),
    ],
    [
      "cargo",
      "ops.aircraftCargo",
      measure(o.otherWeight, "kg"),
      measure(o.otherSpace, "m³", 2),
    ],
    [
      "buffer",
      "ops.aircraftBuffer",
      measure(o.buffer, "kg"),
      measure(o.spaceBuffer, "m³", 2),
    ],
    [
      "headroom",
      "ops.aircraftHeadroom",
      f.expired || f.weightRemaining == null
        ? T("common.pending")
        : measure(f.weightRemaining, "kg"),
      f.expired ? T("common.pending") : measure(f.spaceRemaining, "m³", 2),
    ],
  ];
  return (
    <section className={cx("ops-aircraft")} aria-labelledby={"opsTitle"}>
      <div className={cx("ops-aircraft-stage")}>
        <div className={cx("ops-aircraft-heading")}>
          <div>
            <p className={cx("ops-aircraft-route")}>
              {icon("plane")}
              <bdi>
                {text(state.flight.flightNo)}
                {" · "}
                {text(state.flight.origin)}
                {" → "}
                {text(state.flight.destination)}
              </bdi>
            </p>{" "}
            <h1 id={"opsTitle"}>{T("ops.title")}</h1>
            <p className={cx("ops-aircraft-sub")}>{T("ops.sub")}</p>
          </div>{" "}
          <span className={cx("pill")}>{T("ops.badge")}</span>
        </div>{" "}
        <figure className={cx("ops-aircraft-figure")}>
          <img
            src={asset(String(ROOT_PREFIX) + "assets/operations-aircraft.svg")}
            width={1080}
            height={270}
            alt={T("ops.aircraftAlt")}
          />{" "}
          <figcaption>{T("ops.aircraftCaption")}</figcaption>
        </figure>
      </div>{" "}
      <dl className={cx("ops-aircraft-data")}>
        {keyed(
          zones.map(([kind, label, value, detail], index) => (
            <div className={cx("ops-aircraft-zone " + String(kind))}>
              <dt>
                <span className={cx("ops-aircraft-index")}>{index + 1}</span>
                {T(label)}
              </dt>
              <dd>
                <strong>{value}</strong>
                <small>{detail}</small>
              </dd>
            </div>
          )),
        )}
      </dl>
    </section>
  );
}
function OperationsPage() {
  const f = forecastCapacity(),
    o = state.ops,
    missing = f.weightRemaining == null || f.spaceRemaining == null,
    negative = f.weightRemaining < 0 || f.spaceRemaining < 0,
    baseline = [o.budget, o.otherWeight, o.buffer].some((x) => x == null)
      ? null
      : o.budget - 2400 - o.otherWeight - o.buffer;
  return (
    <>
      {operationsAircraftHTML(f, o)}
      <div className={cx("metrics reveal")}>
        {keyed(
          [
            [
              "ops.coverage",
              <>
                {fmt(f.coverage)}
                <small>{"%"}</small>
              </>,
              t("ops.reported", { n: f.reported, m: f.unreported }),
            ],
            [
              "ops.baggage",
              <>
                {fmt(f.weight)}
                <small>{"kg"}</small>
              </>,
              t("ops.known", { n: fmt(f.known), m: fmt(f.imputed) }),
            ],
            [
              "ops.remaining",
              f.weightRemaining == null || f.expired ? (
                T("common.pending")
              ) : (
                <>
                  {fmt(f.weightRemaining)}
                  <small>{"kg"}</small>
                </>
              ),
              t("ops.weightNote"),
            ],
            [
              "ops.space",
              f.spaceRemaining == null || f.expired ? (
                T("common.missing")
              ) : (
                <>
                  {fmt(f.spaceRemaining, 2)}
                  <small>{"m³"}</small>
                </>
              ),
              t("ops.spaceNote"),
            ],
          ].map(([label, value, note]) => (
            <div className={cx("metric")}>
              <label>{T(String(label))}</label>
              <div className={cx("value")}>{value}</div>
              <small>{text(note)}</small>
            </div>
          )),
        )}
      </div>
      {missing || negative || f.expired || f.reviews ? (
        <div className={cx("notice " + String(negative ? "error" : ""))}>
          {T(
            f.expired
              ? "ops.expired"
              : negative
                ? "ops.negative"
                : missing
                  ? "ops.missing"
                  : "ops.reviews",
            { n: f.reviews },
          )}{" "}
          {T("ops.noSale")}
        </div>
      ) : (
        ""
      )}
      <div className={cx("grid2", "marginTop-24px")}>
        <div className={cx("card")}>
          <h3>{T("ops.compare")}</h3>
          <p className={cx("small muted", "marginTop-9px")}>
            {T("ops.physical")}
          </p>
          <div className={cx("meter")} aria-hidden={"true"}>
            <span
              className={cx("width-var-width-background-var-green")}
              style={cssVars({
                "--width":
                  String(
                    Math.max(
                      0,
                      Math.min(100, (f.weight / (o.budget || 5000)) * 100),
                    ),
                  ) + "%",
              })}
            />
            <span
              className={cx("width-var-width-background-9eae9d")}
              style={cssVars({
                "--width":
                  String(
                    Math.max(
                      0,
                      Math.min(
                        100,
                        ((o.otherWeight || 0) / (o.budget || 5000)) * 100,
                      ),
                    ),
                  ) + "%",
              })}
            />
            <span
              className={cx("width-var-width-background-d9bf85")}
              style={cssVars({
                "--width":
                  String(
                    Math.max(
                      0,
                      Math.min(
                        100,
                        ((o.buffer || 0) / (o.budget || 5000)) * 100,
                      ),
                    ),
                  ) + "%",
              })}
            />
          </div>
          <div className={cx("legend")}>
            <span>
              <i />
              {T("step.3")}
            </span>
            <span>
              <i className={cx("background-9eae9d")} />
              {T("ops.otherWeight")}
            </span>
            <span>
              <i className={cx("background-d9bf85")} />
              {T("ops.bufferWeight")}
            </span>
          </div>
          <div className={cx("divider")} />
          {row("ops.baseline", "2,400 kg")}
          {row(
            "ops.before",
            baseline == null ? T("common.pending") : fmt(baseline) + " kg",
          )}
          {row("ops.baggage", fmt(f.weight) + " kg")}
          {row(
            "ops.after",
            f.weightRemaining == null || f.expired
              ? T("common.pending")
              : fmt(f.weightRemaining) + " kg",
            "total",
          )}
        </div>
        <div className={cx("card")}>
          <h3 className={cx("marginBottom-18px")}>{T("ops.calculation")}</h3>
          {row(
            "ops.budget",
            o.budget == null ? T("common.missing") : fmt(o.budget) + " kg",
          )}
          {row("ops.baggage", "− " + fmt(f.weight) + " kg")}
          {row(
            "ops.other",
            o.otherWeight == null
              ? T("common.missing")
              : fmt(o.otherWeight) + " kg",
          )}
          {row(
            "ops.buffer",
            o.buffer == null ? T("common.missing") : fmt(o.buffer) + " kg",
          )}
          <div className={cx("note")}>{T("ops.basis")}</div>
          <p className={cx("small muted", "marginTop-16px")}>
            {T("ops.pieces")}
            {": "}
            {fmt(f.pieces)}
            {" · "}
            {f.volume == null ? T("common.missing") : fmt(f.volume, 2) + " m³"}
            <br />
            {text(
              hk(
                state.lastSavedAt ||
                  state.declarations.lin?.updatedAt ||
                  state.clock,
              ),
            )}
            {" HKT"}
          </p>
        </div>
      </div>
      <div className={cx("card", "marginTop-24px")}>
        <div className={cx("subhead")}>
          <div>
            <h3>{T("ops.declarations")}</h3>
            <p>{T("ops.latest")}</p>
          </div>
          {link("book", T("ops.edit"), "btn slim light", 3)}
        </div>
        <div className={cx("tablewrap")}>
          <table>
            <thead>
              <tr>
                {keyed(
                  [
                    "common.passenger",
                    "common.version",
                    "ops.pieces",
                    "common.weight",
                    "ops.status",
                  ].map((k) => <th scope={"col"}>{T(k)}</th>),
                )}
              </tr>
            </thead>
            <tbody>
              {keyed(
                PEOPLE.map((p) => {
                  const d = state.declarations[p.id],
                    q = demand(d);
                  return (
                    <tr>
                      <td>{text(p.name)}</td>
                      <td>{d ? "v" + d.version : T("ops.unreported")}</td>
                      <td>{q.count ?? T("common.unknown")}</td>
                      <td>
                        {fmt(q.weight)}
                        {" kg"}
                      </td>
                      <td>
                        {T(q.imputed ? "ops.estimated" : "ops.userEstimate")}
                        {q.review ? " · " + T("bag.review") : ""}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </div>
      <details className={cx("controlbar")}>
        <summary>{T("ops.parameters")}</summary>
        <div className={cx("controlgrid")}>
          {field("ops.weightBudget", "ops.budget", o.budget ?? "", "number", {
            min: "0",
          })}
          {field(
            "ops.spaceBudget",
            "ops.spaceBudget",
            o.spaceBudget ?? "",
            "number",
            { min: "0", step: "any" },
          )}
          {field(
            "ops.otherWeight",
            "ops.otherWeight",
            o.otherWeight ?? "",
            "number",
            { min: "0" },
          )}
          {field("ops.bufferWeight", "ops.buffer", o.buffer ?? "", "number", {
            min: "0",
          })}
        </div>
        <label className={cx("check")}>
          <Input
            type={"checkbox"}
            data-field={"ops.expired"}
            checked={o.expired}
          />
          <span>{T("ops.expireCheck")}</span>
        </label>
      </details>
    </>
  );
}

export { operationsAircraftHTML, OperationsPage };
