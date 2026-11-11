import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Keep main's independently built operations board in the combined release.
const root = new URL("../", import.meta.url);
await cp(
  fileURLToPath(new URL("pages/hold-pressure/", root)),
  fileURLToPath(new URL("dist/pages/hold-pressure/", root)),
  { recursive: true },
);
