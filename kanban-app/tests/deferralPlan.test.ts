import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  acceptanceHeadroom,
  buildLoadMap,
  listCandidateFlights,
  planDeferral,
} from "../src/engine/deferralPlan";
import type { RawFlight, RawKanbanSnapshot } from "../src/types/kanban";

const snapshot = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "kanban-snapshot.json"),
    "utf8",
  ),
) as RawKanbanSnapshot;

function flight(id: string): RawFlight {
  const match = snapshot.flights.find((item) => item.id === id);
  if (!match) {
    throw new Error(`missing seed flight ${id}`);
  }
  return match;
}

describe("deferral planning against Plan §7", () => {
  it("lists later same-sector flights inside the window", () => {
    const candidates = listCandidateFlights(flight("CX251"), snapshot).map((item) => item.id);
    expect(candidates).toEqual(["CX253", "CX255", "CX259", "CX261"]);
    expect(candidates).not.toContain("CX105");
    expect(candidates).not.toContain("CX111");
  });

  it("keeps Melbourne deferral on HKG-MEL", () => {
    const candidates = listCandidateFlights(flight("CX105"), snapshot).map((item) => item.id);
    expect(candidates).toEqual(["CX139", "CX163", "CX165"]);
    expect(candidates.every((id) => flight(id).sector === "HKG-MEL")).toBe(true);
  });

  it("CX251 defers 386 kg to CX261 and stays PARTIAL", () => {
    const loads = buildLoadMap(snapshot, snapshot.asOf);
    const plan = planDeferral(flight("CX251"), snapshot, loads);
    expect(plan.deficitKg).toBe(1056);
    expect(plan.deferKg).toBe(386);
    expect(plan.residualKg).toBe(670);
    expect(plan.assessment).toBe("PARTIAL");
    expect(plan.deferPieceCount).toBe(18);
    const byId = Object.fromEntries(plan.candidates.map((item) => [item.flightId, item]));
    expect(byId.CX253.decision).toBe("NO_GO");
    expect(byId.CX253.reason).toBe("OVER");
    expect(byId.CX255.decision).toBe("NO_GO");
    expect(byId.CX255.reason).toBe("CARGO_UNK");
    expect(byId.CX259.decision).toBe("NO_GO");
    expect(byId.CX259.reason).toBe("CAUTION_VOL");
    expect(byId.CX261.decision).toBe("ACCEPT");
    expect(byId.CX261.allocatedKg).toBe(386);
    expect(plan.loadRatioAfter).toBeCloseTo(1.024, 3);
  });

  it("CX253 defers 352 kg to CX261 and is CLEAR", () => {
    const loads = buildLoadMap(snapshot, snapshot.asOf);
    const plan = planDeferral(flight("CX253"), snapshot, loads);
    expect(plan.deficitKg).toBe(332);
    expect(plan.deferKg).toBe(352);
    expect(plan.assessment).toBe("CLEAR");
    expect(plan.deferPieceCount).toBe(14);
    const target = plan.candidates.find((item) => item.flightId === "CX261");
    expect(target?.allocatedKg).toBe(352);
  });

  it("CX255 and CX263 are not acceptors", () => {
    const loads = buildLoadMap(snapshot, snapshot.asOf);
    expect(acceptanceHeadroom(loads.get("CX255")!).reason).toBe("CARGO_UNK");
    expect(acceptanceHeadroom(loads.get("CX263")!).reason).toBe("CARGO_UNK");
    expect(acceptanceHeadroom(loads.get("CX259")!).reason).toBe("CAUTION_VOL");
  });

  it("does not mutate the snapshot flights array", () => {
    const originalOrder = snapshot.flights.map((item) => item.id);
    const loads = buildLoadMap(snapshot, snapshot.asOf);
    planDeferral(flight("CX251"), snapshot, loads);
    expect(snapshot.flights.map((item) => item.id)).toEqual(originalOrder);
  });
});
