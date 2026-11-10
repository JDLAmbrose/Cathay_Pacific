import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateSnapshot } from "../src/engine/evaluateSnapshot";
import { applyFeedback } from "../src/services/applyFeedback";
import type { RawKanbanSnapshot } from "../src/types/kanban";

const snapshot = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "kanban-snapshot.json"),
    "utf8",
  ),
) as RawKanbanSnapshot;

describe("applyFeedback", () => {
  it("CARGO_UPDATED turns CX255 into an acceptor", () => {
    const updated = applyFeedback(snapshot, {
      type: "CARGO_UPDATED",
      flightId: "CX255",
      cargoKg: 14000,
      cargoM3: 87.5,
    });
    const view = evaluateSnapshot(updated, updated.asOf);
    const load = view.flights.find((flight) => flight.flightId === "CX255");
    expect(load?.status).not.toBe("CARGO_UNK");
    const candidate = view.deferralPlans.CX251.candidates.find((item) => item.flightId === "CX255");
    expect(candidate?.decision).toBe("ACCEPT");
  });

  it("BAG_ARRIVED_EARLY lowers on-flight Plume kg", () => {
    const target = snapshot.flights
      .find((flight) => flight.id === "CX251")
      ?.plumeBags.find((bag) => bag.mode === "on_flight" && bag.state === "staged");
    if (!target) {
      throw new Error("expected a staged on-flight bag on CX251");
    }
    const before = evaluateSnapshot(snapshot, snapshot.asOf).flights.find(
      (flight) => flight.flightId === "CX251",
    );
    const updated = applyFeedback(snapshot, {
      type: "BAG_ARRIVED_EARLY",
      flightId: "CX251",
      bagId: target.bagId,
    });
    const after = evaluateSnapshot(updated, snapshot.asOf).flights.find(
      (flight) => flight.flightId === "CX251",
    );
    expect(after?.plumeOnFlightKg).toBe((before?.plumeOnFlightKg ?? 0) - target.kg);
    expect(snapshot.flights.find((flight) => flight.id === "CX251")?.plumeBags).toEqual(
      snapshot.flights.find((flight) => flight.id === "CX251")?.plumeBags,
    );
  });

  it("TIME_TICK only changes asOf", () => {
    const next = applyFeedback(snapshot, {
      type: "TIME_TICK",
      asOf: "2026-11-15T07:30:00+08:00",
    });
    expect(next.asOf).toBe("2026-11-15T07:30:00+08:00");
    expect(next.flights).toBe(snapshot.flights);
  });
});
