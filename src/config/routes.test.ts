import { expect, it } from "vitest";
import { href, isAppPath, PAGE_FILES, readRoute } from "./routes";

it("keeps React deep links within the configured deployment base", () => {
  const base = import.meta.env.BASE_URL;
  for (const [page, file] of Object.entries(PAGE_FILES)) {
    expect(href(page)).toBe(base + file);
    expect(readRoute(new URL(base + file, "https://preview.example")).page).toBe(page);
    if (page !== "ops") expect(isAppPath(base + file)).toBe(true);
  }
  expect(href("family", 1, true)).toBe(base + "pages/family.html?for=helper");
});

it("lets the browser load the independently built operations board", () => {
  expect(isAppPath(href("ops"))).toBe(false);
  expect(isAppPath(import.meta.env.BASE_URL + "pages/hold-pressure/")).toBe(false);
});
