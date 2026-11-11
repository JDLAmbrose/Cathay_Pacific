import {
  fmt,
  money,
  hk,
  partnerName,
  state,
  draft,
  person,
  activeOrder,
  checked,
  demand,
  eventCounts,
} from "../engine/booking";
import { cx, keyed } from "../components/primitives";
import { HandoverTracking } from "../components/Tracking";
import {
  icon,
  link,
  row,
  head,
  fareRowsHTML,
  allowanceSummaryHTML,
  text,
  T,
  V,
} from "../components/shared";

function JourneyPage() {
  const o = activeOrder(),
    last = state.orders
      .filter((o) => o.travellerId === state.travellerId)
      .at(-1),
    d = demand(o?.declaration || draft()),
    c = eventCounts(o),
    n = o?.itemIds.length || checked(draft()).filter((i) => i.service).length;
  return (
    <>
      {head("journey.title", "journey.sub")}
      <div className={cx("grid2 reveal")}>
        <div className={cx("card")}>
          <span className={cx("eyebrow", "color-var-green")}>
            {"CATHAY PACIFIC / CX257"}
          </span>
          <div className={cx("airports", "maxWidth-430px-margin-26px-0")}>
            <div>
              <b>{"HKG"}</b>
              <small>{T("banner.hk")}</small>
            </div>
            {icon("plane")}
            <div>
              <b>{"LHR"}</b>
              <small>{T("banner.london")}</small>
            </div>
          </div>
          <p className={cx("small muted")}>
            {text(hk(o?.flight.departure || state.flight.departure))}
            {" HKT · "}
            {T("common.demo")}
          </p>
          {o?.destination ? (
            <>
              <div className={cx("divider")} />
              <small className={cx("muted")}>{T("home.destination")}</small>
              <h3 className={cx("marginTop-5px")}>{V(o.destination)}</h3>
            </>
          ) : (
            ""
          )}
          <div className={cx("actions", "marginTop-20px")}>
            <span className={cx("pill")}>{text(person().name)}</span>
            <span className={cx("pill gold")}>
              {d.count == null
                ? T("common.unknown")
                : T("common.pieces", { n: fmt(d.count) })}
            </span>
          </div>
        </div>
        <div className={cx("card")}>
          <div className={cx("subhead")}>
            <h3>{T("journey.service")}</h3>
            <span className={cx("pill " + String(o ? "" : "gold"))}>
              {T(
                o
                  ? o.status === "completed"
                    ? "journey.completed"
                    : "journey.booked"
                  : last?.status === "cancelled"
                    ? "journey.cancelled"
                    : "journey.notBooked",
              )}
            </span>
          </div>
          {o ? (
            <>
              {row("journey.order", text(o.id))}
              {row(
                "checkout.pickup",
                text(o.pickup.replace("T", " ")) + " HKT",
              )}
              {row("service.partner", text(partnerName(o.partner)))}
              {row(
                "service.transport",
                T("service." + (o.transport || "flight")),
              )}
              {allowanceSummaryHTML(o.quote)}
              {o.quote.serviceFee != null
                ? row("service.packageFee", text(money(o.quote.serviceFee)))
                : ""}
              {fareRowsHTML(o.quote)}
              {row(
                "journey.paid",
                o.payment === "cash"
                  ? text(money(o.quote.total))
                  : T("common.miles", { n: fmt(o.quote.miles) }),
              )}
              {row(
                o.earned ? "journey.earned" : "journey.expected",
                T("common.miles", {
                  n: fmt(o.payment === "cash" ? o.quote.earn : 0),
                }),
              )}
              <div className={cx("actions", "marginTop-19px")}>
                <button className={cx("textbtn")} data-action={"contact"}>
                  {T("journey.contact")}
                </button>
                <button
                  className={cx("textbtn")}
                  data-action={"cancel-order"}
                  data-id={o.id}
                >
                  {T("journey.cancel")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className={cx("small muted")}>
                {T(last ? "journey.refunded" : "journey.empty")}
              </p>
              <div className={cx("marginTop-25px")}>
                {link("book", T("home.start"))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className={cx("sectiontitle")}>
        <div>
          <h2>{T("journey.nodes")}</h2>
          <p>{T("journey.nodeSub")}</p>
        </div>
        <span className={cx("pill gold")}>{T("common.demo")}</span>
      </div>
      <div className={cx("nodegrid")}>
        {keyed(
          ["airport", "loaded", "handover"].map((type, i) => {
            const done = o && c[type] === n && n > 0,
              lastEvent = state.events
                .filter((e) => e.orderId === o?.id && e.type === type)
                .at(-1);
            return (
              <article className={cx("node " + String(done ? "done" : ""))}>
                <span className={cx("nodeicon")}>
                  {done ? icon("check") : "0" + (i + 1)}
                </span>
                <h3>{T("node." + type)}</h3>
                <strong>{T("node.count", { n: c[type], total: n })}</strong>
                <p>
                  {type === "handover"
                    ? "LHR T3 · " +
                      (o?.transport === "cargo" ? "Cathay Cargo" : "Cathay") +
                      " → " +
                      text(partnerName(o?.partner || state.partner))
                    : T(
                        type === "loaded" && o?.transport === "cargo"
                          ? "node.cargoLoadedDesc"
                          : "node." + type + "Desc",
                      )}
                </p>
                <p>
                  {done
                    ? T("node.confirmedAt", {
                        time: hk(lastEvent.confirmedAt),
                      })
                    : T("node.waiting")}
                </p>
                {type === "handover" && done ? (
                  <HandoverTracking order={o} />
                ) : (
                  ""
                )}
              </article>
            );
          }),
        )}
      </div>
      {o ? (
        <details className={cx("controlbar")}>
          <summary>{T("demo.events")}</summary>
          <div className={cx("actions", "marginTop-18px")}>
            {keyed(
              ["airport", "partial", "loaded", "handover"].map((kind) => (
                <button
                  className={cx("btn slim light")}
                  data-action={"event"}
                  data-kind={kind}
                >
                  {T("demo." + kind)}
                </button>
              )),
            )}
            <button className={cx("btn slim")} data-action={"complete-service"}>
              {T("demo.complete")}
            </button>
          </div>
          <p className={cx("small muted", "marginTop-14px")}>
            {T("demo.internal")}
          </p>
        </details>
      ) : (
        ""
      )}
      <div className={cx("note")}>{T("journey.snapshot")}</div>
    </>
  );
}

export { JourneyPage };
