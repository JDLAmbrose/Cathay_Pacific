import { describe, expect, it } from "vitest";
import { familyDiagram, familyRibbons } from "../src/members/components/familyRibbon";
import { linkStatus } from "../src/members/engine/familyStatus";
import type { FamilyLinkRecord, FamilyLinkStatus } from "../src/members/types";

const T = Date.parse("2026-11-10T09:30:00+08:00");

function link(partial: Partial<FamilyLinkRecord>): FamilyLinkRecord {
  return {
    inviteeIndex: 0,
    invitedAtMs: Date.parse("2026-08-01T10:00:00+08:00"),
    acceptedAtMs: null,
    declinedAtMs: null,
    cancelledAtMs: null,
    authorizedAtMs: null,
    revokedAtMs: null,
    ...partial,
  };
}

describe("linkStatus", () => {
  it("follows the python order and ignores payment", () => {
    expect(linkStatus(link({ cancelledAtMs: Date.parse("2026-09-01T00:00:00+08:00"), authorizedAtMs: T }), T)).toBe(
      "cancelled",
    );
    expect(linkStatus(link({ declinedAtMs: Date.parse("2026-09-01T00:00:00+08:00") }), T)).toBe("declined");
    expect(
      linkStatus(
        link({
          acceptedAtMs: Date.parse("2026-08-02T00:00:00+08:00"),
          revokedAtMs: Date.parse("2026-09-01T00:00:00+08:00"),
        }),
        T,
      ),
    ).toBe("linked_unauthorized");
    expect(linkStatus(link({ revokedAtMs: Date.parse("2026-09-01T00:00:00+08:00") }), T)).toBe("revoked");
    expect(linkStatus(link({ authorizedAtMs: Date.parse("2026-09-01T00:00:00+08:00"), acceptedAtMs: Date.parse("2026-08-02T00:00:00+08:00") }), T)).toBe(
      "authorized",
    );
    expect(linkStatus(link({ acceptedAtMs: Date.parse("2026-08-02T00:00:00+08:00") }), T)).toBe("linked_unauthorized");
    expect(linkStatus(link({}), T)).toBe("pending");
    expect(linkStatus(link({ invitedAtMs: Date.parse("2026-12-01T00:00:00+08:00") }), T)).toBe("not_yet_invited");
  });

  it("does not apply a timestamp that is still in the future", () => {
    expect(linkStatus(link({ cancelledAtMs: Date.parse("2026-12-01T00:00:00+08:00") }), T)).toBe("pending");
  });
});

describe("familyRibbons", () => {
  const counts: Record<FamilyLinkStatus, number> = {
    cancelled: 3,
    declined: 7,
    revoked: 1,
    authorized: 29,
    linked_unauthorized: 26,
    pending: 2,
  };

  it("returns a closed area path for every positive status", () => {
    const ribbons = familyRibbons(counts);
    expect(ribbons).toHaveLength(6);
    for (const ribbon of ribbons) {
      expect(ribbon.path).toBeTruthy();
      expect(ribbon.path?.startsWith("M")).toBe(true);
      expect(ribbon.path?.endsWith("Z")).toBe(true);
    }
  });

  it("draws the accepted count as one trunk that is thicker than the other lanes", () => {
    const diagram = familyDiagram(counts);
    const trunk = diagram.trunk;
    expect(trunk?.path.startsWith("M")).toBe(true);
    expect(trunk?.path.endsWith("Z")).toBe(true);
    const tallestBranch = Math.max(...diagram.branches.map((branch) => branch.bar?.height ?? 0));
    expect(trunk?.thickness).toBeGreaterThan(tallestBranch);
    expect(diagram.accepted.count).toBe(counts.authorized + counts.linked_unauthorized);
    expect(diagram.continuations.map((item) => item.count)).toEqual([counts.authorized, counts.linked_unauthorized]);
    expect(diagram.continuations.every((item) => item.path?.endsWith("Z"))).toBe(true);
  });

  it("does not draw an area for a zero count", () => {
    const ribbons = familyRibbons({ ...counts, revoked: 0 });
    const revoked = ribbons.find((ribbon) => ribbon.status === "revoked");
    expect(revoked?.count).toBe(0);
    expect(revoked?.path).toBeNull();
    expect(ribbons.filter((ribbon) => ribbon.path).length).toBe(5);
  });
});
