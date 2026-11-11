/** Resolve a file under Vite `public/` for both `npm run dev` and nested static builds. */
export function publicUrl(path: string): string {
  const normalized = path.replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}

/**
 * Site home from the nested `pages/hold-pressure/` mount (two levels up = repo root).
 * Override with `VITE_SITE_HOME` when previewing the Vite app alone.
 */
export function siteHomeHref(): string {
  const configured = import.meta.env.VITE_SITE_HOME;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return "../../index.html";
}
