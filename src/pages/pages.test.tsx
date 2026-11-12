import { QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FlightBanner, SiteHeader } from "../components/layout";
import { cx } from "../components/primitives";
import { BOOK_PAGES, href, readRoute } from "../config/routes";
import {
  activeOrder,
  initial,
  pay,
  restoreBooking,
  state,
} from "../engine/booking";
import { LOCALES, setLanguage, t } from "../services/i18n";
import { applyRoute } from "../services/navigation";
import { queryClient } from "../services/query";
import { AssistantPage } from "./assistant";
import { BookingPage } from "./booking";
import { BenefitsPage, FamilyPage } from "./family";
import { renderHome } from "./home";
import { JourneyPage } from "./journey";
import { OperationsPage } from "./operations";

beforeEach(() => {
  restoreBooking(initial());
  applyRoute({ page: "home", helper: false });
});
afterEach(() => {
  vi.useRealTimers();
  setLanguage("zh-Hant");
});

it("recognizes direct entry, navigation links and helper invite entry", () => {
  expect(href("book", 4)).toBe("/pages/pricing.html");
  expect(
    readRoute(new URL("http://localhost" + href("family", 1, true))),
  ).toEqual({ page: "family", helper: true });
  expect(readRoute(new URL("http://localhost/pages/index.html"))).toEqual({
    page: "home",
    helper: false,
  });
});

it("renders every application page in every supported language", () => {
  for (const locale of LOCALES) {
    setLanguage(locale);
    expect(renderToStaticMarkup(renderHome(0, false))).toContain(
      'data-booking-state="unbooked"',
    );
    for (const page of BOOK_PAGES) {
      applyRoute({ page, helper: false });
      expect(renderToStaticMarkup(<BookingPage />)).toMatch(/<h1[ >]/);
    }
    for (const [page, Component] of [
      ["benefits", BenefitsPage],
      ["family", FamilyPage],
      ["journey", JourneyPage],
      ["ops", OperationsPage],
    ] as const) {
      applyRoute({ page, helper: false });
      expect(renderToStaticMarkup(<Component />)).toMatch(/<h1[ >]/);
    }
    applyRoute({ page: "agent", helper: false });
    expect(
      renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <AssistantPage />
        </QueryClientProvider>,
      ),
    ).toContain("chatForm");
  }
});

it("keeps all three pricing lanes while omitting fee summaries", () => {
  applyRoute({ page: "pricing", helper: false });
  const html = renderToStaticMarkup(<BookingPage />);
  for (const lane of ["cabin", "flight", "cargo"])
    expect(html).toContain(`data-drop-lane="${lane}"`);
  expect(html).not.toContain("費用明細");
  expect(html).not.toContain("預計總價");
  expect(html).not.toContain("運輸費，不含共用取送套餐");
});

it("moves family navigation to the header and removes the page switcher in all languages", () => {
  for (const locale of LOCALES) {
    setLanguage(locale);
    for (const [page, Component] of [
      ["family", FamilyPage],
      ["benefits", BenefitsPage],
    ] as const) {
      applyRoute(readRoute(new URL(href(page), "https://preview.example")));
      const header = renderToStaticMarkup(<SiteHeader />);
      expect(header).toContain('aria-haspopup="menu"');
      expect(header).toContain('aria-expanded="false"');
      expect(header).toContain('data-active="true"');
      expect(header).toContain(t("nav.family"));
      for (const key of ["familyTabs.link", "familyTabs.benefits"])
        expect(t(key)).not.toBe(key);
      const content = renderToStaticMarkup(<Component />);
      expect(content).not.toContain(`aria-label="${t("familyTabs.label")}"`);
      expect(content).not.toContain(cx("family-tabs"));
    }
    applyRoute({ page: "home", helper: false });
    expect(renderToStaticMarkup(<SiteHeader />)).toContain('data-active="false"');
  }
});

it("preserves family and baggage data across direct family routes and helper entry", () => {
  const familyLink = state.familyLink;
  const drafts = state.drafts;
  for (const url of [href("family"), href("benefits"), href("family", 1, true)]) {
    const route = readRoute(new URL(url, "https://preview.example"));
    applyRoute(route);
    expect(state.view).toBe(route.page);
    expect(state.familyLink).toBe(familyLink);
    expect(state.drafts).toBe(drafts);
  }
});

it("shows zero flight progress and gates delivery destination on payment", async () => {
  vi.useFakeTimers();
  for (const page of ["home", "journey"] as const) {
    applyRoute({ page, helper: false });
    expect(renderToStaticMarkup(<FlightBanner />)).toContain(
      "--flight-progress:0%",
    );
  }
  expect(renderToStaticMarkup(<JourneyPage />)).not.toContain(
    "LSE Student Dormitory 6",
  );
  expect(renderToStaticMarkup(renderHome(0, false))).toContain(
    'data-booking-state="unbooked"',
  );
  state.extraBags.lin = 2;
  state.agreed = true;
  const payment = pay();
  expect(renderToStaticMarkup(<JourneyPage />)).not.toContain(
    "LSE Student Dormitory 6",
  );
  await vi.advanceTimersByTimeAsync(650);
  await payment;
  expect(activeOrder()).toBeDefined();
  expect(renderToStaticMarkup(<JourneyPage />)).toContain(
    "LSE Student Dormitory 6",
  );
  expect(renderToStaticMarkup(renderHome(0, false))).toContain(
    'data-booking-state="booked"',
  );
  state.destinationAddress = "Changed draft";
  expect(renderToStaticMarkup(<JourneyPage />)).not.toContain("Changed draft");
});
