import type { Page, Route, View } from "../types/domain.ts";

export const PAGE_FILES: Record<Page, string> = {
  home: "index.html",
  passenger: "pages/prepare.html",
  info: "pages/information.html",
  baggage: "pages/baggage.html",
  pricing: "pages/pricing.html",
  checkout: "pages/checkout.html",
  agent: "pages/assistant.html",
  journey: "pages/journey.html",
  family: "pages/family.html",
  benefits: "pages/benefits.html",
  ops: "pages/operations.html",
};
export const BOOK_PAGES: Page[] = [
  "passenger",
  "info",
  "baggage",
  "pricing",
  "checkout",
];
export const FAMILY_PAGES: Page[] = ["family", "benefits"];
export const ROOT_PREFIX = "";

export function href(
  view: View | string,
  step: number | string = 1,
  helper = false,
) {
  const page =
    view === "book" ? (BOOK_PAGES[Number(step) - 1] ?? "passenger") : view;
  return (
    import.meta.env.BASE_URL +
    (PAGE_FILES[page as Page] ?? PAGE_FILES.home) +
    (page === "family" && helper ? "?for=helper" : "")
  );
}

export function readRoute(url: URL): Route {
  const name = url.pathname.replace(/\/+$/, "").split("/").at(-1);
  const page = (Object.entries(PAGE_FILES).find(
    ([, file]) => file.split("/").at(-1) === name,
  )?.[0] ?? "home") as Page;
  return {
    page,
    helper: page === "family" && url.searchParams.get("for") === "helper",
  };
}

export function isAppPath(pathname: string) {
  const base = import.meta.env.BASE_URL;
  return (
    pathname === base ||
    pathname === base + "pages/index.html" ||
    // The operations URL redirects to the independently built kanban app.
    Object.entries(PAGE_FILES).some(([page, path]) => page !== "ops" && pathname === base + path)
  );
}
