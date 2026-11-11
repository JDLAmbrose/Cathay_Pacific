import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Keep the independently built operations boards, and the static chooser in front of them.
const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
await cp(
  fileURLToPath(new URL("pages/hold-pressure/", root)),
  fileURLToPath(new URL("pages/hold-pressure/", dist)),
  { recursive: true },
);
await mkdir(fileURLToPath(new URL("pages/", dist)), { recursive: true });
await cp(
  fileURLToPath(new URL("pages/operations.html", root)),
  fileURLToPath(new URL("pages/operations.html", dist)),
);
await mkdir(fileURLToPath(new URL("assets/boards/", dist)), { recursive: true });
for (const file of [
  "assets/boards.css",
  "assets/boards-lang.js",
  "assets/boards/cargo-bear.webp",
  "assets/boards/member-bears.webp",
  "assets/plume_light_icon.svg",
  "assets/plume_light_logo_horizontal_reversed.svg",
  "assets/cathay-brushwing-white.png",
]) {
  await cp(
    fileURLToPath(new URL(file, root)),
    fileURLToPath(new URL(file, dist)),
  );
}
