import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Dialog } from "./components/Dialog";

import { PricingInteraction } from "./components/PricingInteraction";
import {
  SiteHeader,
  FlightBanner,
  SiteFooter,
  DemoControls,
} from "./components/layout";
import { cx } from "./components/primitives";
import { BOOK_PAGES, FAMILY_PAGES, href, readRoute } from "./config/routes";
import {
  persist,
  preparePricingBoard,
  restoreBooking,
  state,
} from "./engine/booking";
import { AssistantPage } from "./pages/assistant";
import { BookingPage } from "./pages/booking";
import { BenefitsPage, FamilyPage } from "./pages/family";
import { HomePage } from "./pages/home";
import { JourneyPage } from "./pages/journey";
import { OperationsPage } from "./pages/operations";
import { onChange, onClick, onSubmit } from "./services/actions";
import { BOOKING_KEY, dataSource } from "./services/dataSource";
import { LANGUAGE_KEY, language, setLanguage, t } from "./services/i18n";
import { applyRoute, initialRoute } from "./services/navigation";
import {
  closeModal,
  connectNavigation,
  render,
  snapshot,
  subscribe,
  toast,
  toastKey,
} from "./services/runtime";
import type { Route } from "./types/domain";

function enterRoute(route: Route) {
  applyRoute(route);
  if (route.page === "pricing") preparePricingBoard();
  return route;
}

function PageContent({ page }: { page: Route["page"] }) {
  switch (page) {
    case "home":
      return <HomePage />;
    case "agent":
      return <AssistantPage />;
    case "journey":
      return <JourneyPage />;
    case "family":
      return <FamilyPage />;
    case "benefits":
      return <BenefitsPage />;
    case "ops":
      return <OperationsPage />;
    case "pricing":
      return (
        <PricingInteraction>
          {(gesture) => <BookingPage gesture={gesture} />}
        </PricingInteraction>
      );
    default:
      return <BookingPage />;
  }
}

export function App() {
  const [route, setRoute] = useState(() => enterRoute(initialRoute()));
  const revision = useSyncExternalStore(subscribe, snapshot, snapshot);
  const { page } = route;

  useLayoutEffect(() => {
    function visit(next: Route) {
      closeModal();
      setRoute(enterRoute(next));
      persist();
    }
    const disconnect = connectNavigation((view, step, helper) => {
      if (state.processing) {
        toast("e.processing");
        return;
      }
      const url = new URL(href(view, step, helper), window.location.href);
      if (view === "ops") {
        window.location.assign(url);
        return;
      }
      if (url.href !== window.location.href) history.pushState(null, "", url);
      visit(readRoute(url));
      window.scrollTo(0, 0);
    });
    const onPopState = () => visit(initialRoute());
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      readBooking();
      visit(initialRoute());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY && event.newValue) {
        setLanguage(event.newValue);
        render();
      }
      if (event.key === BOOKING_KEY && event.newValue && !state.processing) {
        readBooking();
        render();
      }
    };
    function readBooking() {
      try {
        restoreBooking(dataSource.readBooking());
      } catch {
        /* Keep the active draft if storage is unavailable. */
      }
    }
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    return () => {
      disconnect();
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    persist();
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle(cx("large"), state.large);
    document.body.dataset.page = page;
    const title = BOOK_PAGES.includes(page)
      ? "step." + state.step
      : page === "family"
        ? "familyTabs.link"
        : page === "benefits"
          ? "familyTabs.benefits"
          : "nav." + page;
    document.title = `Plume Light · ${t(title)}`;
  }, [page, revision]);

  return (
    <div onClick={onClick} onChange={onChange} onSubmit={onSubmit}>
      <div id="siteHeader">
        <SiteHeader />
      </div>
      <div className={cx("shell")}>
        <section
          className={cx("flight-banner")}
          id="tripbar"
          aria-label="CX257"
          hidden={page === "family" || page === "benefits" || page === "ops"}
        >
          <FlightBanner />
        </section>
        <main id="main" tabIndex={-1} key={page + String(route.helper)}>
          <PageContent page={page} />
        </main>
        <div id="controls">
          {!FAMILY_PAGES.includes(page) && <DemoControls />}
        </div>
        <footer className={cx("site-footer")} id="siteFooter">
          <SiteFooter />
        </footer>
      </div>
      <div className={cx("toast")} id="toast" role="status" aria-live="polite">
        {toastKey ? t(toastKey) : ""}
      </div>
      <Dialog />
    </div>
  );
}
