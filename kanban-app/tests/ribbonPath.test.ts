import { describe, expect, it } from "vitest";
import { dashedLinkPath, rejectLinkPath, ribbonPath } from "../src/components/detail/ribbonPath";

describe("ribbonPath", () => {
  it("returns a non-empty SVG path starting with M", () => {
    const path = ribbonPath(20, 40, 80, 400, 30, 70);
    expect(path.length).toBeGreaterThan(0);
    expect(path.startsWith("M")).toBe(true);
    expect(path).toContain("C");
    expect(path.endsWith("Z")).toBe(true);
  });

  it("builds a dashed cubic for rejected candidates", () => {
    const path = dashedLinkPath(420, 80, 844, 48);
    expect(path.startsWith("M")).toBe(true);
    expect(path).toContain("C");
  });

  it("matches the wireframe cubic from the DEFER lane to a rejected card", () => {
    const path = rejectLinkPath(690, 200, 844, 48);
    expect(path).toBe("M690,200 C840,200 640,48 844,48");
  });
});
