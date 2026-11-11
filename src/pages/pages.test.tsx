import { QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FlightBanner } from "../components/layout";
import { BOOK_PAGES, href, readRoute } from "../config/routes";
import {
  activeOrder,
  initial,
  pay,
  restoreBooking,
  state,
} from "../engine/booking";
import { LOCALES, setLanguage } from "../services/i18n";
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
