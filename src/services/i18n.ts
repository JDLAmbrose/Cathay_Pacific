import copy from "../config/copy.json";
import type { Locale } from "../types/domain";

export const LOCALES: Locale[] = ["zh-Hant", "en", "fr", "es", "ar"];
export const LOCALE_NAMES = [
  "繁體中文",
  "English",
  "Français",
  "Español",
  "العربية",
];
export const LANGUAGE_KEY = "plume-light-language";
export let language: Locale = "zh-Hant";

try {
  const saved =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(LANGUAGE_KEY);
  if (LOCALES.includes(saved as Locale)) language = saved as Locale;
} catch {
  // Browser storage can be disabled.
}

export function t(
  key: string,
  args: Record<string, string | number> = {},
): string {
  const values = (copy as Record<string, string[]>)[key];
  if (!values) return key;
  return values[LOCALES.indexOf(language)]
    .replace(/\\n/g, "\n")
    .replace(/\{(\w+)\}/g, (_, name: string) =>
      String(args[name] ?? "{" + name + "}"),
    );
}

export function setLanguage(next: string) {
  if (!LOCALES.includes(next as Locale)) return;
  language = next as Locale;
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    /* Preference is still applied. */
  }
}
