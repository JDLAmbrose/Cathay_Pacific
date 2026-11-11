import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOOKMARKS, bookmarkById } from "../src/members/config/bookmarks";
import { UnknownBookmarkError } from "../src/members/engine/errors";
import { evaluateMembers } from "../src/members/engine/evaluateMembers";
import { InvalidMemberSnapshotError } from "../src/members/engine/errors";
import { parseMemberSnapshot } from "../src/members/services/loadMemberSnapshot";
import type { AudienceFilter, BookmarkId, MemberBoardView, MemberSnapshot } from "../src/members/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(readFileSync(join(root, "public/data/member-snapshot.json"), "utf8")) as {
  meta: { schema_version: string; bookmarks: { id: string }[] };
  members: {
    member_id: string;
    persona: string;
    corridor: string;
    join_at: string | null;
    tier_at_join: string | null;
    tier_changes: { tier: string }[];
  }[];
  family_links: { inviter_id: string; invitee_id: string }[];
  flights: { sector: string }[];
  ticket_increment_weekly: { corridor: string; persona: string }[];
};
const snapshot = parseMemberSnapshot(raw);
const kpi = JSON.parse(readFileSync(join(root, "public/data/kpi-at-bookmarks.json"), "utf8")) as Record<
  string,
  {
    growth: { G1_cumulative_members: number; G2_join_conversion_reach_to_complete: number };
    tracking: {
      T2_service_booking_conversion: number;
      T1_days_join_to_first_paid_p50: number | null;
      T4_tier_counts: Record<string, number>;
      T4_tier_usage_rate: Record<string, number>;
    };
    commercial: { C1_service_revenue_hkd: number; C1_paid_orders: number };
  }
>;

function at(id: BookmarkId, audience: AudienceFilter = "all"): MemberBoardView {
  return evaluateMembers(snapshot, bookmarkById(id).at, { audience, corridor: "all" });
}

function tier(view: MemberBoardView, name: string) {
  return view.tiers.tiers.find((column) => column.tier === name);
}

describe("evaluateMembers", () => {
  it("rejects a snapshot that is missing a required key", () => {
    expect(() => parseMemberSnapshot({ meta: {} })).toThrow(InvalidMemberSnapshotError);
  });

  it("rejects an unknown bookmark, including the cargo clock", () => {
    expect(() => bookmarkById("CARGO")).toThrow(UnknownBookmarkError);
    expect(() => bookmarkById("M")).toThrow(UnknownBookmarkError);
    expect(() => bookmarkById("S")).toThrow(UnknownBookmarkError);
  });

  it("keeps the snapshot on the London line", () => {
    const text = JSON.stringify(raw);
    for (const needle of ["HKG-MEL", "HKG-SYD", "student_au", "parent_victoria", "GBASTU", "Victoria", "赴澳", "維州"]) {
      expect(text).not.toContain(needle);
    }
    expect(raw.meta.schema_version).toBe("2026-11-11.2");
    expect(raw.meta.bookmarks.map((bookmark) => bookmark.id)).toEqual(["A", "B", "C", "D", "P", "E"]);
    expect(BOOKMARKS.map((bookmark) => bookmark.id)).toEqual(["A", "B", "C", "D", "P", "E"]);
    const byId = new Map(raw.members.map((member) => [member.member_id, member]));
    for (const member of raw.members) {
      expect(member.corridor).toBe("HKG-LHR");
      expect(["student", "parent", "business"]).toContain(member.persona);
    }
    for (const flight of raw.flights) {
      expect(flight.sector).toBe("HKG-LHR");
    }
    for (const week of raw.ticket_increment_weekly) {
      expect(week.corridor).toBe("HKG-LHR");
      expect(["student", "parent", "business"]).toContain(week.persona);
    }
    for (const link of raw.family_links) {
      expect(byId.get(link.inviter_id)?.persona).toBe("parent");
      expect(byId.get(link.invitee_id)?.persona).toBe("student");
    }
    const execs = raw.members.filter((member) => member.tier_at_join === "Diamond Exec");
    expect(execs).toHaveLength(8);
    for (const member of execs) {
      expect(member.persona).toBe("business");
      expect(member.tier_changes).toEqual([]);
      expect(member.join_at! >= "2027-01-01").toBe(true);
    }
    expect(raw.members.some((member) => member.tier_changes.some((change) => change.tier === "Diamond Exec"))).toBe(false);
  });

  it("agrees with kpi-at-bookmarks and keeps one route", () => {
    for (const id of ["A", "P", "E"] as const) {
      const view = at(id);
      expect(view.join.cumulative).toBe(kpi[id].growth.G1_cumulative_members);
      expect(view.join.conversion.rate).toBe(kpi[id].growth.G2_join_conversion_reach_to_complete);
      expect(view.service.bookingConversion.rate).toBe(kpi[id].tracking.T2_service_booking_conversion);
      expect(view.lag.p50Days).toBe(kpi[id].tracking.T1_days_join_to_first_paid_p50);
      expect(view.revenue.revenueHkd).toBe(kpi[id].commercial.C1_service_revenue_hkd);
      expect(view.revenue.paidOrders).toBe(kpi[id].commercial.C1_paid_orders);
      expect(view.map.corridors.map((row) => row.corridor)).toEqual(["HKG-LHR"]);
      const route = view.map.corridors[0];
      expect(route.students + route.parents + route.business).toBe(route.activeMembers);
      expect(view.map.paidMembers).toBe(route.activeMembers);
    }
    const demo = at("P");
    expect(demo.join.sparkline.map((point) => point.bookmarkId)).toEqual(["A", "B", "C", "D", "P", "E"]);
    expect(demo.join.sparkline.map((point) => point.cumulative)).toEqual(
      ["A", "B", "C", "D", "P", "E"].map((id) => kpi[id].growth.G1_cumulative_members),
    );
    expect(demo.promo.officialCodes.map((code) => code.code)).toEqual(["HKSTUDENT"]);
    expect(JSON.stringify(demo)).not.toContain("CXFAMILY");
    expect(JSON.stringify(demo)).not.toContain("Diamond Plus");
  });

  it("keeps Diamond Exec visible when the current members do not hold it", () => {
    const before = tier(at("P"), "Diamond Exec");
    expect(before?.count).toBe(0);
    expect(before?.notYetEffective).toBe(true);
    expect(kpi.P.tracking.T4_tier_counts["Diamond Exec"]).toBeUndefined();
    const returned = at("E");
    const exec = tier(returned, "Diamond Exec");
    expect(exec?.notYetEffective).toBe(false);
    expect(exec?.count).toBe(8);
    expect(exec?.usage.rate).toBeGreaterThan(0);
    expect(exec?.usage.rate).toBeLessThan(1);
    expect(exec?.usage.rate).toBe(kpi.E.tracking.T4_tier_usage_rate["Diamond Exec"]);
    expect(returned.tiers.tiers.map((column) => column.tier)).toEqual([
      "Green",
      "Silver",
      "Gold",
      "Diamond",
      "Diamond Exec",
    ]);
    expect(at("P").tiers.tiers.map((column) => column.tier)).toEqual(returned.tiers.tiers.map((column) => column.tier));
    expect(returned.tiers.tiers.reduce((sum, column) => sum + column.count, 0)).toBe(returned.join.cumulative);
    expect(tier(at("E", "students"), "Diamond Exec")?.count).toBe(0);
    expect(tier(at("E", "parents"), "Diamond Exec")?.count).toBe(0);
    expect(tier(at("E", "business"), "Diamond Exec")?.count).toBe(8);
  });

  it("filters one audience without moving the full-population blocks", () => {
    const all = at("P");
    const parents = at("P", "parents");
    expect(parents.join.cumulative).toBe(parents.join.parents.cumulative);
    expect(parents.join.students.cumulative).toBe(0);
    expect(parents.join.business.cumulative).toBe(0);
    expect(parents.increment.students).toEqual({ completedHkd: 0, weekToDateHkd: 0 });
    expect(parents.increment.business).toEqual({ completedHkd: 0, weekToDateHkd: 0 });
    expect(parents.revenue).toEqual(all.revenue);
    expect(parents.family).toEqual(all.family);
    expect(parents.promo).toEqual(all.promo);
    expect(parents.map).toEqual(all.map);
    expect(parents.family.paidUnauthorized).toBeGreaterThan(0);
    expect(parents.family.authorizedUnpaid).toBeGreaterThan(0);
    expect(parents.family.pendingNotJoined).toBeGreaterThan(0);
  });

  it("keeps the three audience totals aligned", () => {
    const view = at("P");
    expect(view.join.students.cumulative + view.join.parents.cumulative + view.join.business.cumulative).toBe(
      view.join.cumulative,
    );
    const increment = [view.increment.parents, view.increment.students, view.increment.business].reduce(
      (total, slice) => total + slice.completedHkd + slice.weekToDateHkd,
      0,
    );
    expect(increment).toBe(view.increment.completedHkd + view.increment.weekToDateHkd);
    expect(view.tiers.tiers.reduce((sum, column) => sum + column.count, 0)).toBe(view.join.cumulative);
  });

  it("drops names and member ids before the view model", () => {
    const encoded = JSON.stringify(at("P"));
    expect(encoded).not.toContain("May Chen");
    expect(encoded).not.toContain("Lin Chen");
    expect(encoded).not.toContain("Alex Chen");
    expect(encoded).not.toContain("Emily Chen");
    expect(encoded).not.toContain("member_id");
    expect(encoded).not.toContain("memberId");
  });

  it("does not import React from the member engine", () => {
    const dir = join(root, "src/members/engine");
    for (const file of readdirSync(dir)) {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source).not.toMatch(/from ["']react/);
      expect(source).not.toMatch(/from ["']react-dom/);
    }
  });
});

void snapshot satisfies MemberSnapshot;
