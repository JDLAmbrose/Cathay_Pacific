import { useEffect, useRef, useState } from "react";
import { language } from "../services/i18n";
import { cssVars } from "../components/primitives";
import { state, activeOrder } from "../engine/booking";
import { ROOT_PREFIX, href } from "../config/routes";
import { cx, asset, keyed } from "../components/primitives";
import {
  icon,
  productName,
  productLogo,
  productMark,
  link,
  text,
  T,
  V,
} from "../components/shared";

function renderHome(storyIndex = 0, automatic = false) {
  const order = activeOrder(),
    flight = order?.flight || state.flight;
  return (
    <>
      <section
        className={cx("hero reveal")}
        data-booking-state={order ? "booked" : "unbooked"}
      >
        <div className={cx("herocopy")}>
          <div className={cx("hero-brand")}>{productLogo(true)}</div>
          <div className={cx("eyebrow")}>
            {T(order ? "home.bookedKicker" : "home.kicker")}
          </div>
          <h1>
            {T(order ? "home.bookedTitle1" : "home.title1")}
            <em>{T(order ? "home.bookedTitle2" : "home.title2")}</em>
          </h1>
          <p>{T(order ? "home.bookedDescription" : "home.description")}</p>
          <div className={cx("actions")}>
            {order
              ? link("journey", T("home.overview"), "btn gold")
              : link("book", T("home.start"), "btn gold")}
            {link("agent", T("home.ask"), "btn ghost")}
          </div>
          <div className={cx("audience")}>{T("home.audience")}</div>
        </div>
        <div className={cx("heroart")} data-hero-art={""}>
          <div className={cx("orbital")} aria-hidden={"true"} />
          <div className={cx("ticket")}>
            <div className={cx("ticket-top")}>
              <span>{"CATHAY PACIFIC"}</span>
              <span className={cx("pill")}>{text(flight.flightNo)}</span>
            </div>
            <div className={cx("airports")}>
              <div>
                <b>{text(flight.origin)}</b>
                <small>{T("banner.hk")}</small>
              </div>
              {icon("plane", "ticket-plane")}
              <div>
                <b>{text(flight.destination)}</b>
                <small>{T("banner.london")}</small>
              </div>
            </div>
            <div className={cx("ticket-line")}>
              {order ? (
                <>
                  <small>{T("home.destination")}</small>
                  <strong>{V(order.destination)}</strong>
                </>
              ) : (
                <>
                  <small>{T("home.ticket")}</small>
                  <strong>{T("home.beforeBooking")}</strong>
                </>
              )}
            </div>
            <div className={cx("barcode")} aria-hidden={"true"} />
          </div>
          {order ? (
            <div className={cx("luggage-tag")}>
              {productMark()}
              <b>{text(String(order.itemIds.length).padStart(2, "0"))}</b>
              <span>
                {T("home.prepared")}
                <br />
                {T("home.less")}
              </span>
            </div>
          ) : (
            <div className={cx("luggage-tag tag-preview")} aria-hidden={"true"}>
              {productMark()}
              <span className={cx("tag-preview-icon")}>{icon("bag")}</span>
            </div>
          )}
        </div>
      </section>
      {order ? (
        <div className={cx("welcome")}>
          <span className={cx("welcome-icon")}>{icon("check")}</span>
          <div>
            <strong>{T("home.bookedNotice")}</strong>
            <p>
              {T("home.pickupNotice", {
                time: order.pickup.replace("T", " "),
              })}
            </p>
          </div>
          {link("journey", T("home.overview"), "btn slim light")}
        </div>
      ) : (
        ""
      )}
      {homeServicesHTML(order)}
      {storiesHTML(storyIndex, automatic)}
    </>
  );
}
function homeServicesHTML(order) {
  return (
    <section className={cx("home-services")} aria-labelledby={"familyTitle"}>
      <div className={cx("family-care")}>
        <div className={cx("eyebrow")}>{T("family.kicker")}</div>
        <h2 id={"familyTitle"}>
          {T("family.title1")}
          <em>{T("family.title2")}</em>
        </h2>
        <p className={cx("family-intro")}>{T("family.intro")}</p>
        <div className={cx("family-options")}>
          {keyed(
            [
              ["child", "plane"],
              ["senior", "bag"],
            ].map(([type, ic], i) => (
              <article className={cx("family-option")}>
                <div className={cx("family-option-top")}>
                  <span className={cx("family-symbol")} data-home-icon={""}>
                    {icon(ic)}
                  </span>
                  <span className={cx("eyebrow muted")}>
                    {"0"}
                    {i + 1}
                  </span>
                </div>
                <h3>{T("family." + type + "Title")}</h3>
                <p>{T("family." + type + "Text")}</p>
              </article>
            )),
          )}
        </div>
        <div className={cx("family-footer")}>
          <p>
            {icon("home")}
            <span>{T("family.fromHome")}</span>
          </p>
          {order ? (
            link("journey", T("home.overview"), "btn light")
          ) : (
            <a className={cx("btn")} href={href("book")}>
              {T("family.start")}
              {icon("arrow", "arrow")}
            </a>
          )}
        </div>
      </div>
      <aside
        className={cx("home-features")}
        aria-labelledby={"homeFeaturesTitle"}
      >
        <div className={cx("eyebrow muted")}>
          {text(productName())}
          {" / 01—04"}
        </div>
        <h2 id={"homeFeaturesTitle"}>{T("home.features")}</h2>
        <p className={cx("feature-intro")}>{T("home.featureSub")}</p>
        <div className={cx("feature-list")}>
          {keyed(
            [
              ["report", "bag", "book", 3],
              ["rules", "spark", "agent", 0],
              ["delivery", "home", "book", 2],
              ["miles", "miles", "book", 5],
            ].map(([key, ic, view, step]) => (
              <article className={cx("feature-compact")}>
                <span className={cx("feature-icon")} data-home-icon={""}>
                  {icon(ic)}
                </span>
                <div>
                  <h3>
                    <a href={href(String(view), step || undefined)}>
                      {T("feature." + key)}
                      {icon("arrow", "arrow")}
                    </a>
                  </h3>
                  <p>{T("feature." + key + "Short")}</p>
                </div>
              </article>
            )),
          )}
        </div>
      </aside>
    </section>
  );
}
function storiesHTML(storyIndex: number, automatic = false) {
  const types = ["student", "child", "access"];
  return (
    <section className={cx("story-section")} aria-labelledby={"storiesTitle"}>
      <div className={cx("story-heading")}>
        <div>
          <div className={cx("eyebrow")}>{T("stories.kicker")}</div>
          <h2 id={"storiesTitle"}>{T("stories.title")}</h2>
          <p>{T("stories.sub")}</p>
        </div>
        <div className={cx("slider-controls")}>
          <span
            className={cx("slider-count")}
            id={"storyCount"}
            aria-live={automatic ? "off" : "polite"}
          >
            {String(storyIndex + 1).padStart(2, "0")} / 03
          </span>
          <button
            className={cx("roundbtn")}
            data-action={"story-prev"}
            aria-label={T("stories.previous")}
          >
            {icon("back", "arrow")}
          </button>
          <button
            className={cx("roundbtn")}
            data-action={"story-next"}
            aria-label={T("stories.next")}
          >
            {icon("arrow", "arrow")}
          </button>
        </div>
      </div>
      <div
        className={cx("story-viewport")}
        id={"storyViewport"}
        tabIndex={0}
        role={"region"}
        aria-label={T("stories.title")}
      >
        <div
          className={cx("story-track")}
          id={"storyTrack"}
          style={cssVars({ "--story-offset": `${-storyIndex * 100}%` })}
        >
          {keyed(
            types.map((type, i) => (
              <article
                className={cx("story-slide")}
                aria-hidden={i !== storyIndex}
                {...(i !== storyIndex ? { inert: true } : {})}
              >
                <div className={cx("story-portrait " + String(type))}>
                  <div className={cx("portrait-caption")}>
                    <div className={cx("eyebrow")}>
                      {text(productName())}
                      {" / 0"}
                      {i + 1}
                    </div>
                  </div>
                  <img
                    className={cx("story-photo")}
                    src={asset(
                      String(ROOT_PREFIX) +
                        "assets/traveller-" +
                        String(type) +
                        ".png",
                    )}
                    alt={T("story." + type + ".photo")}
                    width={1024}
                    height={1536}
                    loading={i === storyIndex ? "eager" : "lazy"}
                    decoding={"async"}
                  />
                </div>
                <div className={cx("story-body")}>
                  <span className={cx("pill white")}>
                    {"0"}
                    {i + 1}
                    {" / 03"}
                  </span>
                  <h3>{T("story." + type + ".title")}</h3>
                  <p className={cx("story-person")}>
                    {T("story." + type + ".person")}
                  </p>
                  <div className={cx("story-detail-grid")}>
                    {keyed(
                      [
                        ["background", "background"],
                        ["route", "route"],
                        ["need", "need"],
                        ["outcome", "outcome"],
                      ].map(([key, label]) => (
                        <div className={cx("detail " + String(key))}>
                          <h4>{T("stories." + label)}</h4>
                          <p>{T("story." + type + "." + key)}</p>
                        </div>
                      )),
                    )}
                  </div>
                  <blockquote>
                    {T("story." + type + ".quote")}
                    <footer>{T("stories.quote")}</footer>
                  </blockquote>
                </div>
              </article>
            )),
          )}
        </div>
      </div>
      <div className={cx("story-dots")}>
        {keyed(
          types.map((_, i) => (
            <button
              className={cx("story-dot")}
              data-action={"story-select"}
              data-index={i}
              aria-label={T("stories.select", { n: i + 1 })}
              aria-pressed={i === storyIndex}
            />
          )),
        )}
      </div>
      <p className={cx("story-disclaimer")}>{T("stories.disclaimer")}</p>
    </section>
  );
}

export { renderHome, homeServicesHTML, storiesHTML };

export function HomePage() {
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number }>(null);
  const [story, setStory] = useState({ index: 0, automatic: false });
  const advance = (delta: number, automatic = false) =>
    setStory((previous) => ({
      index: (previous.index + delta + 3) % 3,
      automatic,
    }));

  useEffect(() => {
    const art = root.current?.querySelector<HTMLElement>("[data-hero-art]");
    if (!art) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const schedule = () => {
      if (frame || reduced.matches) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const { top, height } = art.getBoundingClientRect();
        const start = window.innerHeight * 0.55;
        const progress = Math.max(
          0,
          Math.min(1, (start - top) / (start + height)),
        );
        art.style.setProperty("--home-scroll", String(progress));
      });
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    const visible = cx("home-icon-visible");
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries, obs) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add(visible);
                obs.unobserve(entry.target);
              }
            },
            { threshold: 0.3 },
          )
        : null;
    root.current
      ?.querySelectorAll("[data-home-icon]")
      .forEach((icon) => observer?.observe(icon));
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const section =
      root.current?.querySelector<HTMLElement>("#storyViewport")?.parentElement;
    const viewport = section?.querySelector("#storyViewport");
    if (!section || !viewport) return;
    let timer: ReturnType<typeof setInterval>;
    let distance = 0;
    let lastWheel = 0;
    let switched = false;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => {
        if (
          !document.hidden &&
          !section.matches(":hover") &&
          !section.contains(document.activeElement)
        )
          advance(1, true);
      }, 8000);
    };
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            ([entry]) => {
              if (
                entry.isIntersecting &&
                !matchMedia("(prefers-reduced-motion: reduce)").matches
              )
                start();
              else clearInterval(timer);
            },
            { threshold: 0.1 },
          )
        : null;
    observer?.observe(viewport);
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      const shifted = event.shiftKey && Math.abs(event.deltaX) < 0.1;
      const delta = shifted ? event.deltaY : event.deltaX;
      if (
        !delta ||
        (!shifted && Math.abs(delta) <= Math.abs(event.deltaY) * 1.15)
      )
        return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 180) {
        distance = 0;
        switched = false;
      }
      lastWheel = now;
      if (switched) return;
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? section.clientWidth
            : 1;
      distance += delta * unit;
      if (Math.abs(distance) >= 48) {
        switched = true;
        advance(Math.sign(distance) * (language === "ar" ? -1 : 1));
      }
    };
    section.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer?.disconnect();
      clearInterval(timer);
      section.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <div
      ref={root}
      onClick={(event) => {
        const button = (event.target as Element).closest<HTMLElement>(
          '[data-action^="story-"]',
        );
        if (button?.dataset.action === "story-prev") advance(-1);
        if (button?.dataset.action === "story-next") advance(1);
        if (button?.dataset.action === "story-select")
          setStory({ index: Number(button.dataset.index), automatic: false });
      }}
      onKeyDown={(event) => {
        if (
          (event.target as Element).id !== "storyViewport" ||
          !["ArrowLeft", "ArrowRight"].includes(event.key)
        )
          return;
        event.preventDefault();
        advance(
          (event.key === "ArrowRight" ? 1 : -1) * (language === "ar" ? -1 : 1),
        );
      }}
      onTouchStart={(event) => {
        if ((event.target as Element).closest("#storyViewport"))
          touch.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          };
      }}
      onTouchEnd={(event) => {
        if (!touch.current) return;
        const dx = event.changedTouches[0].clientX - touch.current.x;
        const dy = event.changedTouches[0].clientY - touch.current.y;
        touch.current = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3)
          advance((dx < 0 ? 1 : -1) * (language === "ar" ? -1 : 1));
      }}
    >
      {renderHome(story.index, story.automatic)}
    </div>
  );
}
