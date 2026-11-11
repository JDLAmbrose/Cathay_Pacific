import type { PricingGesture } from "../components/PricingInteraction";
import {
  fmt,
  money,
  hk,
  REGIONS,
  TRANSPORT_RATES,
  partnerName,
  ticketAllowance,
  serviceRoute,
  itemCategories,
  helperContacts,
  selectedHelper,
  pendingHelperRequest,
  state,
  draft,
  person,
  activeOrder,
  displayValue,
  checkApplicationDeadline,
  quoteService,
  PRICING_LANES,
  pricingItems,
  pricingLane,
  pricingQuote,
  validateService,
} from "../engine/booking";
import { t } from "../services/i18n";
import { BOOK_PAGES, href } from "../config/routes";
import { cssVars, cx, keyed, Input, Select } from "../components/primitives";
import { CategoryPicker } from "../components/Popover";
import {
  icon,
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
} from "../components/shared";
import { maskEmail } from "../pages/family";
import { modal } from "../services/runtime";
import type { Bag } from "../types/domain";

function passengerHTML() {
  const allowance = ticketAllowance(),
    request = state.family ? pendingHelperRequest() : null;
  return (
    <>
      <div className={cx("subhead")}>
        <div>
          <h2>{T("passenger.title")}</h2>
          <p>{T("passenger.autoSub")}</p>
        </div>
        <span className={cx("pill")}>
          {icon("check")}
          {T("passenger.imported")}
        </span>
      </div>{" "}
      <section
        className={cx("imported-passenger")}
        aria-labelledby={"importedPassengerTitle"}
      >
        <div className={cx("imported-passenger-top")}>
          <span className={cx("person-symbol")}>{icon("person")}</span>
          <div>
            <span className={cx("eyebrow muted")}>{T("common.passenger")}</span>
            <h3 id={"importedPassengerTitle"}>{text(person().name)}</h3>
          </div>
          <span className={cx("pill")}>{text(state.flight.flightNo)}</span>
        </div>
        <div className={cx("readonly-grid")}>
          {readOnlyDetail(
            "passenger.ticketReference",
            text(state.flight.bookingId),
          )}
          {readOnlyDetail(
            "passenger.flightRoute",
            text(state.flight.origin) + " → " + text(state.flight.destination),
          )}
        </div>{" "}
        <div className={cx("included-allowance")}>
          <span className={cx("allowance-symbol")}>{icon("bag")}</span>
          <div>
            <span>{T("passenger.includedAllowance")}</span>
            <strong>
              {allowance
                ? T("fare.allowance", {
                    n: fmt(allowance.pieces),
                    kg: fmt(allowance.kgPerPiece),
                  })
                : T("e.allowance")}
            </strong>
            <p>{T("passenger.autoAllowance")}</p>
          </div>
        </div>
      </section>{" "}
      <label className={cx("check helper-toggle")}>
        <Input
          type={"checkbox"}
          autoComplete={"off"}
          data-helper-toggle={""}
          checked={state.family}
          {...(request ? { disabled: true } : {})}
        />
        <span>{T("helper.toggle")}</span>
      </label>{" "}
      {request ? (
        <div
          className={cx("notice")}
          role={"status"}
          tabIndex={-1}
          id={"helperRequestStatus"}
        >
          <strong>{T("helper.waiting")}</strong>
          <p>
            {T("helper.requestRecorded", {
              email: request.recipient
                ? maskEmail(request.recipient)
                : t("link.emailToValue"),
            })}
          </p>
        </div>
      ) : state.family ? (
        helperHTML()
      ) : (
        ""
      )}
    </>
  );
}
function helperHTML() {
  const contacts = helperContacts(),
    contact = selectedHelper();
  const details = contact ? (
    <div className={cx("readonly-grid")}>
      {readOnlyDetail(
        "link.method.member",
        text(contact.memberNo || t("common.missing")),
      )}
      {readOnlyDetail(
        "link.method.mobile",
        <bdi dir={"ltr"}>{text(contact.mobile || t("common.missing"))}</bdi>,
      )}
      {readOnlyDetail(
        "helper.relationship",
        T("link.rel." + contact.relationship),
      )}
    </div>
  ) : (
    ""
  );
  return (
    <section className={cx("helper-panel")} aria-labelledby={"helperTitle"}>
      <div className={cx("panel-kicker")}>
        {icon("person")}
        <h3 id={"helperTitle"}>{T("helper.title")}</h3>
      </div>{" "}
      {contacts.length ? (
        <>
          <div className={cx("fields")}>
            <label className={cx("field full")}>
              <span>{T("helper.select")}</span>
              <Select className={cx("input")} data-helper-contact={""}>
                {option("", t("helper.selectPlaceholder"), contact?.id || "")}
                {keyed(
                  contacts.map((entry) =>
                    option(entry.id, entry.name, contact?.id),
                  ),
                )}
              </Select>
            </label>
          </div>
          {details}
          <p className={cx("prototype-note")}>{T("helper.requestDemo")}</p>
        </>
      ) : (
        <>
          <p className={cx("note")}>{T("helper.noContactsBody")}</p>
          <button
            className={cx("btn light")}
            data-action={"helper-add-contact"}
          >
            {T("helper.openFamily")}
            {icon("arrow", "arrow")}
          </button>
        </>
      )}
    </section>
  );
}
function helperNoContacts() {
  modal(t("helper.noContactsTitle"), t("helper.noContactsBody"), [
    { text: t("helper.openFamily"), action: "helper-add-contact" },
    { text: t("common.cancel"), action: "close-dialog", light: true },
  ]);
}
function locationHTML(area) {
  return (
    <div className={cx("route-location")}>
      {icon("globe")}
      <div>
        <span>{T("information.linkedToTicket")}</span>
        <strong>
          {area.label
            ? T(area.label)
            : area.country
              ? text(area.country)
              : T("common.pending")}
        </strong>
      </div>
      {area.country ? (
        <span className={cx("pill")}>{text(area.country)}</span>
      ) : (
        ""
      )}
    </div>
  );
}
function providerHTML(name, values, current) {
  return (
    <fieldset className={cx("provider-field")}>
      <legend>{T("information.provider")}</legend>
      <div className={cx("provider-options")}>
        {keyed(
          values.map((p) => (
            <label className={cx("provider-option")}>
              <Input
                type={"radio"}
                name={name}
                data-field={name}
                value={text(p)}
                checked={current === p}
              />
              <span className={cx("provider-mark")}>
                {text(
                  p === "SF Express"
                    ? "SF"
                    : p === "EMS"
                      ? "EMS"
                      : p.split(" ")[0],
                )}
              </span>
              <strong>
                {T(
                  p === "SF Express"
                    ? "information.sf"
                    : p === "EMS"
                      ? "information.ems"
                      : p === "EBC UK"
                        ? "information.ebc"
                        : "information.providerName",
                  { name: p },
                )}
              </strong>
              {icon("check")}
            </label>
          )),
        )}
      </div>
      {values.length ? (
        ""
      ) : (
        <p className={cx("notice error")}>{T("e.routeProviders")}</p>
      )}
    </fieldset>
  );
}
function collectionRegionOptionsHTML() {
  return keyed(
    serviceRoute().origin.regions.map((r) =>
      option(
        r,
        t("information.regionOption", {
          region: t("region." + r),
          h: REGIONS[r].hours,
        }),
        state.region,
      ),
    ),
  );
}
function applicationWindowsHTML() {
  const regions = serviceRoute().origin.regions,
    d = checkApplicationDeadline();
  return (
    <section
      className={cx("application-windows")}
      aria-labelledby={"applicationWindowsTitle"}
    >
      <div className={cx("application-windows-heading")}>
        {icon("clock")}
        <div>
          <h3 id={"applicationWindowsTitle"}>
            {T("information.orderDeadlineTitle")}
          </h3>
          <p>{T("information.orderDeadlineSub")}</p>
        </div>
      </div>
      <div
        className={cx("application-window-grid")}
        style={cssVars({ "--windows": regions.length })}
      >
        {keyed(
          regions.map((r) => {
            const window = checkApplicationDeadline(r);
            return (
              <div
                className={cx(
                  "application-window " +
                    String(r === state.region ? "selected" : ""),
                )}
              >
                <span>{T("region." + r)}</span>
                <strong>{T("service.hours", { h: window.hours })}</strong>
                <small>
                  {window.deadline
                    ? text(hk(window.deadline)) + " HKT"
                    : T("common.pending")}
                </small>
              </div>
            );
          }),
        )}
      </div>
      <p
        className={cx(
          "application-selected " + String(d.valid ? "" : "expired"),
        )}
      >
        {d.deadline
          ? T("information.selectedOrderDeadline", { time: hk(d.deadline) })
          : T("region.unsupported")}
        {!d.valid ? " · " + T("service.closed") : ""}
      </p>
    </section>
  );
}
function informationHTML() {
  const route = serviceRoute();
  return (
    <>
      <div className={cx("subhead")}>
        <div>
          <h2>{T("information.title")}</h2>
          <p>{T("information.sub")}</p>
        </div>
      </div>
      {applicationWindowsHTML()}{" "}
      <section className={cx("address-panel")} aria-labelledby={"pickupTitle"}>
        <div className={cx("address-panel-heading")}>
          <span className={cx("panel-number")}>{"01"}</span>
          <div>
            <h3 id={"pickupTitle"}>{T("information.pickupTitle")}</h3>
            <p>{T("information.pickupSub")}</p>
          </div>
        </div>
        {locationHTML(route.origin)}
        <div className={cx("fields")}>
          <label className={cx("field")}>
            <span>{T("service.region")}</span>
            <Select className={cx("input")} data-field={"region"}>
              {collectionRegionOptionsHTML()}
            </Select>
          </label>
          {field("service.pickup", "pickup", state.pickup, "datetime-local")}
          {field("passenger.contact", "contact", state.contact, "text", {
            maxLength: "80",
          })}
          {field("passenger.phone", "phone", state.phone, "tel", {
            maxLength: "40",
          })}
          {field(
            "service.address",
            "pickupAddress",
            state.pickupAddress,
            "text",
            { maxLength: "250" },
            true,
          )}
        </div>
        {providerHTML(
          "pickupPartner",
          route.origin.providers,
          state.pickupPartner,
        )}
      </section>{" "}
      <section
        className={cx("address-panel")}
        aria-labelledby={"deliveryTitle"}
      >
        <div className={cx("address-panel-heading")}>
          <span className={cx("panel-number")}>{"02"}</span>
          <div>
            <h3 id={"deliveryTitle"}>{T("information.deliveryTitle")}</h3>
            <p>{T("information.deliverySub")}</p>
          </div>
        </div>
        {locationHTML(route.destination)}
        <div className={cx("fields")}>
          {field("passenger.recipient", "recipient", state.recipient, "text", {
            maxLength: "80",
          })}
          {field(
            "information.recipientPhone",
            "recipientPhone",
            state.recipientPhone,
            "tel",
            { maxLength: "40" },
          )}
          {field(
            "home.destination",
            "destinationAddress",
            state.destinationAddress,
            "text",
            { maxLength: "250" },
            true,
          )}
        </div>
        {providerHTML("partner", route.destination.providers, state.partner)}
      </section>
    </>
  );
}
const CATEGORY_ICONS = {
  clothes: "shirt",
  books: "book",
  electronics: "laptop",
  battery: "battery",
  liquids: "bottle",
  medicine: "medicine",
  food: "food",
  fragile: "fragile",
  valuables: "miles",
  sports: "ball",
  equipment: "access",
  other: "box",
};
function categorySelectionHTML(item) {
  const categories = itemCategories(item);
  return categories.length ? (
    keyed(
      categories.map((k) => (
        <span className={cx("selected-category")}>
          {icon(CATEGORY_ICONS[k])}
          {T("bag." + k)}
        </span>
      )),
    )
  ) : (
    <span className={cx("muted")}>{T("bag.chooseCategories")}</span>
  );
}
function categoryPickerHTML(item: Bag, n: number) {
  return (
    <CategoryPicker
      item={item}
      n={n}
      iconFor={(category) => icon(CATEGORY_ICONS[category])}
      summary={categorySelectionHTML(item)}
    />
  );
}
function baggageHTML() {
  const d = draft(),
    count = d.zero ? 0 : d.items.length;
  return (
    <>
      <div className={cx("subhead")}>
        <div>
          <h2>{T("bag.title")}</h2>
          <p>{T("bag.newSub")}</p>
        </div>
        <span className={cx("pill")}>
          {d.countUnknown
            ? T("common.unknown")
            : T("common.pieces", { n: fmt(count) })}
        </span>
      </div>
      <div className={cx("actions")}>
        <button className={cx("btn slim light")} data-action={"add-item"}>
          {icon("bag")}
          {T("bag.add")}
        </button>
        <button
          className={cx("btn slim light")}
          data-action={"save-declaration"}
        >
          {T("common.save")}
        </button>
      </div>
      <div className={cx("bag-declaration-options")}>
        <label className={cx("check")}>
          <Input type={"checkbox"} data-field={"zero"} checked={d.zero} />
          <span>{T("bag.zero")}</span>
        </label>
        <label className={cx("check")}>
          <Input
            type={"checkbox"}
            data-field={"countUnknown"}
            checked={d.countUnknown}
          />
          <span>{T("bag.unknownCount")}</span>
        </label>
      </div>
      {d.zero ? (
        <div className={cx("notice")}>{T("bag.zeroNote")}</div>
      ) : d.countUnknown ? (
        <div className={cx("notice")}>{T("bag.unknownNote")}</div>
      ) : (
        keyed(
          d.items.map((i, index) => (
            <article className={cx("itemcard declared-bag")} key={i.id}>
              <div className={cx("itemtop")}>
                <strong>
                  {T("bag.number", { n: index + 1 })}
                  {" · "}
                  {text(person().name)}
                </strong>
                <button
                  className={cx("textbtn")}
                  data-action={"remove-item"}
                  data-id={text(i.id)}
                >
                  {T("bag.remove")}
                </button>
              </div>
              <div className={cx("fields")}>
                <label className={cx("field")}>
                  <span>{T("bag.name")}</span>
                  <Input
                    className={cx("input")}
                    data-item-field={"name"}
                    data-id={text(i.id)}
                    value={V(i.name)}
                    maxLength={80}
                  />
                </label>
                {categoryPickerHTML(i, index + 1)}
              </div>
              <div className={cx("itemfields")}>
                {keyed(
                  [
                    ["weight", "weight"],
                    ["l", "length"],
                    ["w", "width"],
                    ["h", "height"],
                  ].map(([key, label]) => (
                    <label className={cx("field")}>
                      <span>{T("bag." + label)}</span>
                      <Input
                        className={cx("input")}
                        type={"number"}
                        min={"0.01"}
                        step={"any"}
                        placeholder={T("common.unknown")}
                        data-item-field={key}
                        data-id={text(i.id)}
                        value={i[key] ?? ""}
                        aria-label={
                          String(T("bag.number", { n: index + 1 })) +
                          " · " +
                          String(T("bag." + label))
                        }
                      />
                    </label>
                  )),
                )}
              </div>
              <div className={cx("itembottom")}>
                <button
                  className={cx("textbtn")}
                  data-action={"ask-item"}
                  data-id={text(i.id)}
                >
                  {T("bag.ask")}
                  {icon("arrow", "arrow")}
                </button>
                {i.review ? (
                  <span className={cx("pill gold")}>{T("bag.review")}</span>
                ) : (
                  ""
                )}
              </div>
            </article>
          )),
        )
      )}
      <div className={cx("note")}>{T("bag.note")}</div>
      <div className={cx("notice")}>
        <strong>{T("bag.accuracyNoticeTitle")}</strong>
        <p>{T("bag.accuracyNotice")}</p>
      </div>
    </>
  );
}
function pricingBagHTML(item: Bag, n: number, gesture?: PricingGesture) {
  const lane = pricingLane(item),
    locked = !!activeOrder(),
    categories = itemCategories(item),
    dimensions = [item.l, item.w, item.h].some((v) => v == null)
      ? T("common.pending")
      : text([item.l, item.w, item.h].join(" × ")) + " cm";
  return (
    <article
      className={cx(
        "pricing-bag",
        gesture?.bagId === item.id && !gesture.keyboard
          ? "dragging"
          : undefined,
      )}
      data-pricing-bag={text(item.id)}
      draggable={!locked}
      aria-label={String(T("bag.number", { n })) + " · " + String(V(item.name))}
      key={item.id}
    >
      <div className={cx("pricing-bag-heading")}>
        <span className={cx("pricing-bag-icon")}>
          {icon(lane === "cabin" ? "bag" : lane === "flight" ? "plane" : "box")}
        </span>
        <div>
          <small>{T("bag.number", { n })}</small>
          <h4>{V(item.name)}</h4>
        </div>
        <button
          className={cx("drag-handle")}
          data-drag-handle={text(item.id)}
          aria-pressed={!!(gesture?.keyboard && gesture.bagId === item.id)}
          type={"button"}
          aria-label={T("pricing.dragBag", { name: displayValue(item.name) })}
          aria-describedby={"pricingInstructions"}
          {...(locked ? { disabled: true } : {})}
        >
          {icon("grip")}
        </button>
      </div>
      <div className={cx("pricing-bag-specs")}>
        <strong>
          {item.weight == null
            ? T("common.unknown")
            : text(fmt(item.weight, 16)) + " kg"}
        </strong>
        <span>{dimensions}</span>
      </div>
      <div className={cx("pricing-bag-categories")}>
        {keyed(categories.slice(0, 2).map((c) => <span>{T("bag." + c)}</span>))}
        {categories.length > 2 ? (
          <span>
            {"+"}
            {categories.length - 2}
          </span>
        ) : (
          ""
        )}
      </div>
    </article>
  );
}
function pricingHTML(gesture?: PricingGesture) {
  const q = pricingQuote(),
    items = pricingItems(),
    missing = q.valid ? q.plan.missing : 0;
  return (
    <>
      <div className={cx("subhead")}>
        <div>
          <div className={cx("eyebrow muted pricing-kicker")}>
            {T("pricing.kicker")}
          </div>
          <h2>{T("pricing.title")}</h2>
          <p>{T("pricing.sub")}</p>
        </div>
        <span className={cx("pill gold")}>{T("common.simulated")}</span>
      </div>
      <p className={cx("pricing-instructions")} id={"pricingInstructions"}>
        {icon("grip")}
        {T("pricing.instructions")}
      </p>
      {activeOrder() ? (
        <div className={cx("notice")}>{T("e.orderChange")}</div>
      ) : (
        ""
      )}
      {!q.valid ? (
        <div className={cx("notice error")} role={"status"}>
          {T(q.error)}
        </div>
      ) : (
        ""
      )}
      <div className={cx("pricing-board")}>
        {keyed(
          PRICING_LANES.map((lane) => {
            const bags = items.filter((i) => pricingLane(i) === lane);
            return (
              <section
                className={cx(
                  "pricing-lane",
                  lane,
                  gesture?.lane === lane ? "drag-over" : undefined,
                )}
                data-drop-lane={lane}
                aria-labelledby={"pricingLane-" + String(lane)}
              >
                <div className={cx("pricing-lane-heading")}>
                  <span className={cx("pricing-lane-icon")}>
                    {icon(
                      lane === "cabin"
                        ? "bag"
                        : lane === "flight"
                          ? "plane"
                          : "box",
                    )}
                  </span>
                  <span className={cx("pricing-lane-count")}>
                    {String(bags.length).padStart(2, "0")}
                  </span>
                </div>
                <h3 id={"pricingLane-" + String(lane)}>
                  {T("pricing.lane." + lane)}
                </h3>
                <p className={cx("pricing-lane-description")}>
                  {T("pricing.lane." + lane + "Text")}
                  {lane === "cabin"
                    ? ""
                    : " " + T("bag.carriage." + lane + "Text")}
                </p>
                <div className={cx("pricing-lane-bags")}>
                  {bags.length ? (
                    keyed(
                      bags.map((item) =>
                        pricingBagHTML(item, items.indexOf(item) + 1, gesture),
                      ),
                    )
                  ) : (
                    <div className={cx("pricing-lane-empty")}>
                      {icon("bag")}
                      <span>{T("pricing.dropHere")}</span>
                    </div>
                  )}
                </div>
                {lane === "flight" && missing
                  ? pricingAllowanceActionHTML(missing)
                  : ""}
              </section>
            );
          }),
        )}
      </div>
      <p className={cx("pricing-rules-note")}>{T("pricing.rulesNote")}</p>
      <div
        className={cx("sr-only")}
        id={"pricingStatus"}
        role={"status"}
        aria-live={"polite"}
      >
        {gesture?.announcement}
      </div>
    </>
  );
}
function pricingAllowanceActionHTML(missing) {
  return (
    <div className={cx("pricing-lane-extra")}>
      <span>{T("fare.pending", { n: fmt(missing) })}</span>
      <button className={cx("btn slim light")} data-action={"buy-required"}>
        {T("fare.buyNeeded", {
          n: fmt(missing),
          price: money(missing * TRANSPORT_RATES.extraPiece),
        })}
      </button>
    </div>
  );
}
function checkoutHTML() {
  const q = quoteService(),
    error = validateService(),
    o = activeOrder();
  return (
    <>
      <div className={cx("subhead")}>
        <div>
          <h2>{T("checkout.title")}</h2>
          <p>{T("checkout.sub")}</p>
        </div>
        <span className={cx("pill gold")}>{T("common.simulated")}</span>
      </div>
      {o ? (
        <>
          <div className={cx("notice")}>
            {T("checkout.existing")} {text(o.id)}
          </div>
          {link("journey", T("home.overview"))}
        </>
      ) : (
        ""
      )}
      {servicePricingHTML()}
      {row("common.passenger", text(person().name))}
      {row("checkout.pickup", V(state.pickupAddress))}
      {row("checkout.delivery", V(state.destinationAddress))}
      {row("checkout.contacts", V(state.contact) + " / " + V(state.recipient))}
      {row("service.partner", text(partnerName(state.partner)))}
      {row(
        "service.transport",
        T("service." + (q.transport || state.transport)),
      )}
      {allowanceSummaryHTML(q)}
      <div className={cx("divider")} />
      {q.valid ? (
        <>
          {row("service.packageFee", text(money(q.serviceFee)))}
          {fareRowsHTML(q)}
          {row("checkout.total", text(money(q.total)), "total")}
          <div className={cx("payoptions")}>
            <label className={cx("payoption")}>
              <Input
                type={"radio"}
                name={"payment"}
                data-field={"payment"}
                value={"cash"}
                checked={state.payment === "cash"}
              />{" "}
              {T("checkout.cash")}
              <strong>{text(money(q.total))}</strong>
              <small>{T("checkout.earn", { n: fmt(q.earn) })}</small>
            </label>
            <label className={cx("payoption")}>
              <Input
                type={"radio"}
                name={"payment"}
                data-field={"payment"}
                value={"miles"}
                checked={state.payment === "miles"}
              />{" "}
              {T("checkout.miles")}
              <strong>{T("common.miles", { n: fmt(q.miles) })}</strong>
              <small>
                {T("checkout.balance", { n: fmt(state.milesBalance) })}
              </small>
            </label>
          </div>
        </>
      ) : (
        <div className={cx("notice error")}>{T(q.error)}</div>
      )}
      <div className={cx("note")}>
        {T("checkout.policy")}
        <br />
        {T("book.feeNote")}
      </div>
      {draft().items.some((i) => i.review) ? (
        <div className={cx("notice")}>{T("checkout.review")}</div>
      ) : (
        ""
      )}
      {error ? (
        <div className={cx("notice error")} role={"alert"}>
          {T(error)}
        </div>
      ) : (
        ""
      )}
      <label className={cx("check", "marginTop-20px")}>
        <Input type={"checkbox"} data-field={"agreed"} checked={state.agreed} />
        <span>{T("checkout.agree")}</span>
      </label>
      <button
        className={cx("btn")}
        data-action={"pay"}
        {...(!q.valid || !!error || !state.agreed || state.processing || !!o
          ? { disabled: true }
          : {})}
      >
        {T(
          state.processing
            ? "checkout.processing"
            : state.payment === "cash"
              ? "checkout.payCash"
              : "checkout.payMiles",
        )}{" "}
        {q.valid && !state.processing
          ? "· " +
            (state.payment === "cash"
              ? text(money(q.total))
              : T("common.miles", { n: fmt(q.miles) }))
          : ""}
        {icon("arrow", "arrow")}
      </button>
    </>
  );
}
function bookingStepHTML(view, index, waiting) {
  const n = index + 1,
    step = state.step;
  const content = (
    <>
      <i>{n < step ? "✓" : n}</i>
      <span>{T("step." + n)}</span>
    </>
  );
  if (waiting && n > step)
    return (
      <span className={cx("step")} aria-disabled={"true"}>
        {content}
      </span>
    );
  return (
    <a
      className={cx("step " + String(n < step ? "done" : ""))}
      href={href(view)}
      data-step={n}
      {...(n === step ? { "aria-current": "step" } : {})}
    >
      {content}
    </a>
  );
}
function BookingPage({ gesture }: { gesture?: PricingGesture }) {
  const step = state.step,
    waiting = step === 1 && state.family && !!pendingHelperRequest();
  return (
    <>
      {head("book.title", "book.sub", "passenger.imported")}
      <div
        className={cx(
          "booking-workspace reveal " +
            String(step === 4 ? "pricing-workspace" : ""),
        )}
      >
        <div className={cx("card")}>
          <nav className={cx("steps")} aria-label={T("nav.book")}>
            {keyed(
              BOOK_PAGES.map((view, index) =>
                bookingStepHTML(view, index, waiting),
              ),
            )}
          </nav>
          {step === 4
            ? pricingHTML(gesture)
            : [
                passengerHTML,
                informationHTML,
                baggageHTML,
                pricingHTML,
                checkoutHTML,
              ][step - 1]()}
          <div className={cx("formfooter")}>
            <a
              className={cx("btn light")}
              href={href(
                step === 1 ? "home" : "book",
                step === 1 ? undefined : step - 1,
              )}
            >
              {icon("back", "arrow")}
              {T(step === 1 ? "common.home" : "common.back")}
            </a>
            {waiting ? (
              <button
                type={"button"}
                className={cx("btn light")}
                data-action={"helper-start-new"}
              >
                {T("helper.startNew")}
              </button>
            ) : step === 4 &&
              pricingQuote().valid &&
              pricingQuote().count === 0 ? (
              <button className={cx("btn")} data-action={"finish-declaration"}>
                {T("pricing.finishWithoutService")}
                {icon("arrow", "arrow")}
              </button>
            ) : step === 1 && state.family ? (
              selectedHelper() ? (
                <button className={cx("btn")} data-action={"helper-send"}>
                  {T("helper.send")}
                  {icon("mail")}
                </button>
              ) : (
                ""
              )
            ) : step < BOOK_PAGES.length ? (
              <button className={cx("btn")} data-action={"next"}>
                {T(step === 3 ? "bag.saveContinue" : "common.continue")}
                {icon("arrow", "arrow")}
              </button>
            ) : (
              link("journey", T("home.overview"), "textbtn")
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export {
  passengerHTML,
  helperHTML,
  helperNoContacts,
  locationHTML,
  providerHTML,
  collectionRegionOptionsHTML,
  applicationWindowsHTML,
  informationHTML,
  CATEGORY_ICONS,
  categorySelectionHTML,
  categoryPickerHTML,
  baggageHTML,
  pricingBagHTML,
  pricingHTML,
  pricingAllowanceActionHTML,
  checkoutHTML,
  bookingStepHTML,
  BookingPage,
};
