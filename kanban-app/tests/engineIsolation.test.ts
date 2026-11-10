import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("engine isolation", () => {
  it("does not import react or react-dom", () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "engine");
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(join(dir, file), "utf8");
      expect(source).not.toMatch(/from ["']react(?:-dom)?["']/);
    }
  });
});
