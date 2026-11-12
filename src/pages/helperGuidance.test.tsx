import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it } from "vitest";
import copy from "../config/copy.json";
import { cathayMembershipSignUpUrl } from "../config/urls";
import {
  draft,
  helperContacts,
  initial,
  passengerFamilyLink,
  persist,
  restoreBooking,
  selectHelper,
  selectedHelper,
  simulateFamilyLink,
  state,
  validateHelper,
} from "../engine/booking";
import { browserDataSource, setDataSource } from "../services/dataSource";
import { LOCALES, setLanguage, t } from "../services/i18n";
import { applyRoute } from "../services/navigation";
import { BookingPage, passengerHTML } from "./booking";
import { FamilyPage } from "./family";

const signupEnglish =
  "https://www.cathaypacific.com/cx/en_HK/membership/sign-up.html";
const signupTraditionalChinese =
  "https://www.cathaypacific.com/cx/zh_HK/membership/sign-up.html";

beforeEach(() => {
  restoreBooking(initial());
  applyRoute({ page: "passenger", helper: false });
});

afterEach(() => {
  setLanguage("zh-Hant");
  setDataSource(browserDataSource);
});

it("shows guidance only while opting in to helper selection", () => {
  for (const enabled of [false, true, false]) {
    state.family = enabled;
    const html = renderToStaticMarkup(<BookingPage />);
    for (const entry of [
      'aria-labelledby="helperGuidanceTitle"',
      "membership/sign-up.html",
      'data-action="helper-add-contact"',
    ]) {
      expect(html.includes(entry)).toBe(enabled);
    }
    if (enabled) {
      expect(html.match(/data-action="helper-add-contact"/g)).toHaveLength(1);
      expect(validateHelper()).toBe("helper.noContactsTitle");
    }
  }
});

it("updates all guidance and the external URL with the selected site language", () => {
  state.family = true;
  for (const locale of [...LOCALES, "zh-Hant"] as const) {
    setLanguage(locale);
    const html = renderToStaticMarkup(passengerHTML());
    const expectedUrl =
      locale === "zh-Hant" ? signupTraditionalChinese : signupEnglish;
    expect(html).toContain(`href="${expectedUrl}"`);
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toMatch(
      /<button type="button"[^>]*data-action="helper-add-contact"/,
    );
    for (const [key, values] of Object.entries(copy).filter(([key]) =>
      /^helper\.(guidanceTitle|membershipReminder|registerStep|registerBody|register|linkStep|linkBody|openFamily)$/.test(key),
    )) {
      expect(values).toHaveLength(LOCALES.length);
      expect(values[LOCALES.indexOf(locale)].trim()).not.toBe("");
      const translated = t(key, {
        family: t("nav.family"),
        link: t("familyTabs.link"),
      });
      expect(translated).not.toBe(key);
      expect(translated).not.toMatch(/\{(?:family|link)\}/);
      expect(html).toContain(renderToStaticMarkup(<>{translated}</>));
    }
  }
});

it.each(["en", "fr", "es", "ar", "zh-Hans", "zh-CN", "zh-TW", "unknown", ""])(
  "uses the English signup page for any locale other than zh-Hant: %s",
  (locale) => {
    expect(cathayMembershipSignUpUrl(locale)).toBe(signupEnglish);
  },
);

it("keeps the selected helper and draft through the existing linking route and persistence", () => {
  simulateFamilyLink(passengerFamilyLink("lin"), "lin");
  state.family = true;
  selectHelper(helperContacts()[0].id);
  const selected = selectedHelper();
  draft().items[0].name = "My edited bag";
  state.contact = "Edited contact";
  state.phone = "+852 98765432";
  const savedDraft = structuredClone(draft());
  let saved: typeof state;
  setDataSource({
    ...browserDataSource,
    saveBooking: (booking) => {
      saved = structuredClone(booking);
    },
  });
  const html = renderToStaticMarkup(<BookingPage />);
  expect(html).toContain('data-helper-contact=""');
  expect(html).toContain(`value="${selected.id}" selected=""`);
  expect(html).toContain('data-action="helper-send"');
  expect(html).toContain("helperGuidanceTitle");
  expect(validateHelper()).toBe("helper.send");

  applyRoute({ page: "family", helper: true });
  persist();
  expect(renderToStaticMarkup(<FamilyPage />)).toContain(t("familyTabs.link"));
  restoreBooking(saved);
  applyRoute({ page: "passenger", helper: false });
  expect(draft()).toEqual(savedDraft);
  expect(state.contact).toBe("Edited contact");
  expect(state.phone).toBe("+852 98765432");
  expect(selectedHelper()).toEqual(selected);
  // The existing opt-in resets on return; the chosen helper remains available.
  expect(state.family).toBe(false);
  state.family = true;
  expect(validateHelper()).toBe("helper.send");
});
