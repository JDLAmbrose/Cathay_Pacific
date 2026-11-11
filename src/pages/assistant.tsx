import type { ReactNode } from "react";
import {
  fmt,
  money,
  hk,
  REGIONS,
  state,
  draft,
  displayValue,
  agentRuntime,
  liveAgent,
} from "../engine/booking";
import { t } from "../services/i18n";
import { cx, keyed, Input, Select, Option } from "../components/primitives";
import { useQuery } from "@tanstack/react-query";
import { assistantStatusOptions } from "../services/query";
import {
  icon,
  productMark,
  link,
  option,
  row,
  head,
  fareRowsHTML,
  text,
  T,
} from "../components/shared";

const RULE_QUESTIONS = [
  "ai.qClothes",
  "ai.qBattery",
  "ai.qEquipment",
  "qa.qLiquids",
  "qa.qMedicine",
  "qa.qFood",
  "qa.qFragile",
];
const SERVICE_QUESTIONS = [
  "qa.qDeadline",
  "qa.qPrice",
  "qa.qMiles",
  "qa.qTracking",
  "qa.qFamily",
  "qa.qDelivery",
];
function questionButton(key, cls = "quick") {
  return (
    <button className={cx(cls)} data-question={key}>
      {T(key)}
    </button>
  );
}
function questionLibraryHTML(embedded) {
  return (
    <details
      className={cx("question-library")}
      {...(embedded ? {} : { open: true })}
    >
      <summary>
        {T("qa.more")} <span>{"13"}</span>
      </summary>
      <div className={cx("question-groups")}>
        {keyed(
          (
            [
              ["qa.rulesGroup", RULE_QUESTIONS],
              ["qa.serviceGroup", SERVICE_QUESTIONS],
            ] as [string, string[]][]
          ).map(([label, keys]) => (
            <section>
              <h4>{T(label)}</h4>
              <div className={cx("question-grid")}>
                {keyed(keys.map((k) => questionButton(k, "question-card")))}
              </div>
            </section>
          )),
        )}
      </div>
    </details>
  );
}
function followupHTML(ans) {
  let keys =
    ans?.kind === "service"
      ? ans.topic === "miles" || ans.topic === "price"
        ? ["qa.qDeadline", "qa.qDelivery", "qa.qTracking"]
        : ["qa.qPrice", "qa.qMiles", "qa.qFamily"]
      : ans?.category === "battery"
        ? ["qa.qLiquids", "qa.qMedicine", "qa.qDeadline"]
        : ["ai.qBattery", "qa.qFood", "qa.qDelivery"];
  return (
    <div className={cx("followups")}>
      <span>{T("qa.followups")}</span>
      <div className={cx("quickquestions")}>
        {keyed(keys.map((k) => questionButton(k)))}
      </div>
    </div>
  );
}
function serviceAnswerHTML(ans) {
  const q = ans.quote,
    topic = ans.topic,
    suffix = topic[0].toUpperCase() + topic.slice(1),
    dl = ans.deadline;
  let content: ReactNode = null,
    cta = "book",
    step = 2;
  if (topic === "deadline")
    content = (
      <>
        <p>{T("qa.deadlineIntro")}</p>
        <div className={cx("notice")}>
          {T("qa.deadlineDetail", {
            region: t(
              "region." + (REGIONS[ans.region] ? ans.region : "unsupported"),
            ),
            date: dl?.deadline ? hk(dl.deadline) : t("common.pending"),
          })}
        </div>
      </>
    );
  if (topic === "price") {
    step = 4;
    content = q?.valid ? (
      <>
        <p>
          {T("qa.priceDetail", {
            count: fmt(q.count),
            weight: fmt(q.weight),
            total: money(q.total),
          })}
        </p>
        {row("service.packageFee", text(money(q.serviceFee)))}
        {fareRowsHTML(q)}
        {row("checkout.total", text(money(q.total)), "total")}
      </>
    ) : (
      <div className={cx("notice")}>{T(q?.error || "e.fullSpecs")}</div>
    );
    content = (
      <>
        {content}
        <div className={cx("note")}>{T("book.feeNote")}</div>
      </>
    );
  }
  if (topic === "miles") {
    step = 5;
    content = q?.valid ? (
      <p>
        {T("qa.milesDetail", {
          redeem: fmt(q.miles),
          balance: fmt(ans.balance),
          earn: fmt(q.earn),
        })}
      </p>
    ) : (
      <div className={cx("notice")}>{T(q?.error || "e.fullSpecs")}</div>
    );
    content = (
      <>
        {content}
        <div className={cx("note")}>{T("checkout.policy")}</div>
      </>
    );
  }
  if (topic === "tracking") {
    cta = "journey";
    step = undefined;
    content = (
      <>
        <p>{T("qa.trackingDetail")}</p>
        <div className={cx("answer-milestones")}>
          {keyed(
            ["airport", "loaded", "handover"].map((k, i) => (
              <div>
                <span>
                  {"0"}
                  {i + 1}
                </span>
                {T("node." + k)}
              </div>
            )),
          )}
        </div>
      </>
    );
  }
  if (topic === "family") {
    step = 1;
    content = <p>{T("qa.familyDetail")}</p>;
  }
  if (topic === "delivery")
    content = (
      <p>
        {T("qa.deliveryDetail", {
          destination: displayValue(ans.destination),
        })}
      </p>
    );
  return (
    <>
      <div className={cx("answer service-answer")}>
        {state.agent.stale ? (
          <div className={cx("notice error")}>{T("ai.stale")}</div>
        ) : (
          ""
        )}
        <span className={cx("pill")}>{T("qa.serviceLabel")}</span>
        <h3 className={cx("marginTop-14px")}>{T("qa.title" + suffix)}</h3>
        <div className={cx("service-answer-body")}>{content}</div>
        <div className={cx("actions", "marginTop-18px")}>
          {link(
            cta,
            T(cta === "journey" ? "home.overview" : "step." + step),
            "btn slim light",
            step,
          )}
        </div>
      </div>
      {followupHTML(ans)}
    </>
  );
}
function rulesAnswerHTML(ans) {
  const category = ans.category || "unknown",
    titles = {
      ordinary: "ai.titleOrdinary",
      battery: "ai.titleBattery",
      equipment: "ai.titleEquipment",
      liquids: "qa.titleLiquids",
      medicine: "qa.titleMedicine",
      food: "qa.titleFood",
      fragile: "qa.titleFragile",
    },
    pairs = {
      liquids: ["qa.liquidsCabin", "qa.liquidsChecked"],
      medicine: ["qa.medicineCabin", "qa.medicineChecked"],
      food: ["qa.foodCabin", "qa.foodChecked"],
      fragile: ["qa.fragileCabin", "qa.fragileChecked"],
    },
    labels = ["ai.customs", "ai.cabin", "ai.checked"],
    route = ans.route || state.agent.route,
    routeKey =
      route === "AU"
        ? "qa.au"
        : route === "IN"
          ? "qa.in"
          : route === "FR"
            ? "ai.fr"
            : "ai.gb";
  const conclusions = ans.reason
    ? ["common.pending", "common.pending", "common.pending"]
    : category === "ordinary"
      ? ["ai.ordinaryCustoms", "ai.ordinaryCarrier", "ai.ordinaryCarrier"]
      : [
          "qa.customsCheck",
          ...(pairs[category] || ["ai.specialCabin", "ai.specialChecked"]),
        ];
  const checklist = {
    liquids: "qa.listLiquids",
    medicine: "qa.listMedicine",
    food: "qa.listFood",
    fragile: "qa.listFragile",
  }[category];
  return (
    <>
      <div className={cx("answer")}>
        {state.agent.stale ? (
          <div className={cx("notice error")}>{T("ai.stale")}</div>
        ) : (
          ""
        )}
        <h3>
          {T(
            ans.reason
              ? "ai.titleUnknown"
              : titles[category] || "ai.titleUnknown",
          )}
        </h3>
        <p className={cx("small muted", "marginTop-8px")}>
          {T(routeKey)}
          {" · "}
          {text(hk(ans.retrievedAt))}
          {" HKT"}
        </p>
        <p className={cx("small muted")}>
          {ans.energy ? T("ai.spec", { n: ans.energy }) : text(ans.attributes)}
        </p>
        <div className={cx("answergrid")}>
          {keyed(
            labels.map((label, i) => (
              <div>
                <strong>{T(label)}</strong>
                {T(conclusions[i])}
              </div>
            )),
          )}
        </div>
        {checklist && !ans.reason ? (
          <div className={cx("packing-checklist")}>
            <strong>{T("qa.checklist")}</strong>
            <p>{T(checklist)}</p>
          </div>
        ) : (
          ""
        )}
        <p className={cx("small muted")}>
          {ans.reason ? T(ans.reason) + " " + T("ai.gapNote") : T("ai.note")}
        </p>
        <div className={cx("sources")}>
          {keyed(
            ans.sourceIds.map((id) => (
              <button data-action={"source"} data-id={id}>
                {T("source." + id)}
              </button>
            )),
          )}
        </div>
        {ans.advice && !state.agent.stale ? (
          <button
            className={cx("btn slim light", "marginTop-17px")}
            data-action={"review-advice"}
          >
            {T("ai.advice")}
            {icon("arrow", "arrow")}
          </button>
        ) : (
          ""
        )}
        {!ans.sourceIds.length ? (
          <p className={cx("small", "marginTop-15px")}>
            <a
              href={"https://www.cathaypacific.com/"}
              target={"_blank"}
              rel={"noopener"}
            >
              {T("ai.officialCathay")}
              {" ↗"}
            </a>
            {" · "}
            <a href={"https://www.gov.uk/"} target={"_blank"} rel={"noopener"}>
              {T("ai.officialGov")}
              {" ↗"}
            </a>
            <br />
            <span className={cx("muted")}>{T("ai.linksNote")}</span>
          </p>
        ) : (
          ""
        )}
      </div>
      {followupHTML(ans)}
    </>
  );
}
function agentMessageHTML(m) {
  const tools = {
    get_trip_context: "agent.toolTrip",
    get_baggage_context: "agent.toolBaggage",
    get_price_context: "agent.toolPrice",
    get_service_guide: "agent.toolGuide",
  };
  return (
    <div className={cx("message " + String(m.role === "user" ? "user" : ""))}>
      {m.role === "assistant" ? (
        <small className={cx("message-source")}>
          {T(m.mode === "live" ? "agent.liveLabel" : "agent.localLabel")}
        </small>
      ) : (
        ""
      )}
      <div className={cx("message-text")}>
        {m.key ? T(m.key) : text(m.text)}
      </div>
      {m.tools?.length ? (
        <small className={cx("message-source")}>
          {T("agent.consulted")}{" "}
          {m.tools
            .filter((k) => tools[k])
            .map((k) => T(tools[k]))
            .join(" · ")}
        </small>
      ) : (
        ""
      )}
    </div>
  );
}
function AssistantPage({ embedded = false }: { embedded?: boolean }) {
  const a = state.agent,
    ans = a.answer,
    live = liveAgent(),
    busy = agentRuntime.pending,
    pendingReplies = {
      battery: "qa.replyBattery",
      liquids: "qa.replyLiquids",
      medicine: "qa.replyMedicine",
      food: "qa.replyFood",
    },
    replyKey = pendingReplies[a.pending?.type];
  const status = useQuery({ ...assistantStatusOptions(), enabled: live });
  const statusKey = !live
    ? "agent.localLabel"
    : status.isError
      ? "agent.unavailable"
      : status.isPending
        ? "agent.checking"
        : status.data?.configured
          ? "agent.ready"
          : "agent.notConfigured";
  return (
    <>
      {embedded ? (
        <div className={cx("subhead")}>
          <div>
            <h2>{T("ai.title")}</h2>
            <p>{T("agent.subtitle")}</p>
          </div>
        </div>
      ) : (
        head("ai.title", "agent.subtitle")
      )}
      <div className={cx(embedded ? "" : "card reveal")}>
        <div className={cx("chatlayout")}>
          <div>
            <div className={cx("agent-toolbar")}>
              <span className={cx("pill gold")} role={"status"}>
                {T(statusKey)}
              </span>
              <button
                className={cx("textbtn")}
                type={"button"}
                data-agent-action={"clear"}
              >
                {T("agent.clear")}
              </button>
            </div>{" "}
            <div className={cx("assistant-avatar")}>{productMark()}</div>{" "}
            <div
              className={cx("chatmessages")}
              id={"chatMessages"}
              role={"log"}
              aria-label={T("ai.conversation")}
              aria-live={"polite"}
              aria-busy={busy}
            >
              {a.messages.length ? (
                keyed(a.messages.map(agentMessageHTML))
              ) : (
                <div className={cx("message")}>
                  {T(live ? "agent.welcome" : "ai.welcome")}
                </div>
              )}
              {busy ? (
                <div className={cx("message agent-loading")}>
                  {T("agent.thinking")}
                </div>
              ) : (
                ""
              )}
            </div>{" "}
            {agentRuntime.error && live ? (
              <div className={cx("notice error")} role={"alert"}>
                {T(agentRuntime.error)}{" "}
                <button
                  type={"button"}
                  className={cx("textbtn")}
                  data-agent-action={"retry"}
                >
                  {T("agent.retry")}
                </button>
              </div>
            ) : (
              ""
            )}{" "}
            {replyKey && !live ? (
              <div className={cx("example-reply")}>
                <span>{T("qa.example")}</span>
                <button className={cx("quick")} data-reply={replyKey}>
                  {T(replyKey)} {icon("arrow", "arrow")}
                </button>
              </div>
            ) : (
              ""
            )}{" "}
            {ans && !live
              ? ans.kind === "service"
                ? serviceAnswerHTML(ans)
                : rulesAnswerHTML(ans)
              : ""}{" "}
            <form id={"chatForm"} className={cx("chatinput")}>
              <label className={cx("sr-only")} htmlFor={"chatQuestion"}>
                {T("ai.input")}
              </label>
              <Input
                id={"chatQuestion"}
                name={"question"}
                className={cx("input")}
                maxLength={2000}
                placeholder={T("ai.placeholder")}
                value={text(a.questionDraft || "")}
                required
                autoComplete={"off"}
                {...(busy ? { disabled: true } : {})}
              />
              <button
                className={cx("btn")}
                type={"submit"}
                {...(busy ? { disabled: true } : {})}
              >
                {T("ai.send")}
                {icon("arrow", "arrow")}
              </button>
              {busy ? (
                <button
                  type={"button"}
                  className={cx("textbtn")}
                  data-agent-action={"cancel"}
                >
                  {T("common.cancel")}
                </button>
              ) : (
                ""
              )}
            </form>{" "}
            <div className={cx("note")}>
              {T(live ? "agent.privacy" : "ai.coverage")}
            </div>
            {questionLibraryHTML(embedded)}
          </div>{" "}
          <aside className={cx("context")}>
            <h3>{T("ai.context")}</h3>{" "}
            <label className={cx("field")}>
              <span>{T("agent.mode")}</span>
              <Select className={cx("input")} data-field={"agent.mode"}>
                <Option value={"live"} {...(live ? { selected: true } : {})}>
                  {T("agent.liveLabel")}
                </Option>
                <Option value={"local"} {...(!live ? { selected: true } : {})}>
                  {T("agent.localLabel")}
                </Option>
              </Select>
            </label>{" "}
            <label className={cx("field")}>
              <span>{T("ai.destination")}</span>
              <Select className={cx("input")} data-field={"agent.route"}>
                {keyed(
                  [
                    ["GB", "ai.gb"],
                    ["AU", "qa.au"],
                    ["IN", "qa.in"],
                    ["FR", "ai.fr"],
                    ["", "common.unknown"],
                  ].map(([id, key]) => option(id, t(key), a.route)),
                )}
              </Select>
            </label>{" "}
            <label className={cx("field")}>
              <span>{T("ai.linked")}</span>
              <Select className={cx("input")} data-field={"agent.itemId"}>
                {option("", t("ai.unlinked"), a.itemId)}
                {keyed(
                  draft().items.map((i) =>
                    option(i.id, displayValue(i.name), a.itemId),
                  ),
                )}
              </Select>
            </label>{" "}
            <div className={cx("note")}>{T("agent.contextNote")}</div>
            <div className={cx("agent-next-steps")}>
              {link("book", T("step.3"), "btn slim light", 3)}
              {link("book", T("step.4"), "btn slim light", 4)}
              {link("journey", T("home.overview"), "btn slim light")}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

export {
  RULE_QUESTIONS,
  SERVICE_QUESTIONS,
  questionButton,
  questionLibraryHTML,
  followupHTML,
  serviceAnswerHTML,
  rulesAnswerHTML,
  agentMessageHTML,
  AssistantPage,
};
