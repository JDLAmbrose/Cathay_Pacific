import { describe, expect, it } from "vitest";
import { compareCrisis, resolveBoardHealth } from "../src/engine/crisisRank";
import type { HoldLoadView, HoldStatus } from "../src/types/kanban";

function stub(partial: {
  flightId: string;
  status: HoldStatus;
  hoursToDeparture: number;
  weightLoadRatio: number;
  isNearDeparture?: boolean;
}): HoldLoadView {
  return {
    flightId: partial.flightId,
    sector: "HKG-LHR",
    dep: "2026-11-15T12:00:00+08:00",
    aircraft: "A350-900",
    seats: 280,
    plumePax: 10,
    capacityKg: 22050,
    capacityM3: 172,
    commercialCargoKg: 10000,
    commercialCargoM3: 60,
    estimatedPaxBaggageKg: 5000,
    estimatedPaxBaggageM3: 50,
    plumeOnFlightKg: 200,
    plumeOnFlightM3: 2,
    plumeArrivedKg: 0,
    plumeArrivedM3: 0,
    plumeDeclaredKg: 200,
    plumePieceCount: 10,
    plumeOnFlightPieceCount: 10,
    plumeArrivedPieceCount: 0,
    plumeDeferrableKg: 0,
    plumeDeferrablePieceCount: 0,
    totalKg: 15200,
    totalM3: 112,
    baggageKg: 5200,
    baggageM3: 52,
    weightLoadRatio: partial.weightLoadRatio,
    volumeLoadRatio: partial.weightLoadRatio,
    hasVolumeBottleneck: false,
    status: partial.status,
    deficitKg: 0,
    plumeShare: 0.01,
    hoursToDeparture: partial.hoursToDeparture,
    isPastLoadCutoff: false,
    isNearDeparture: partial.isNearDeparture ?? partial.hoursToDeparture <= 6,
  };
}

describe("crisisRank", () => {
  it("puts a near CAUTION flight ahead of a later OVER flight", () => {
    const nearCaution = stub({
      flightId: "CX239",
      status: "CAUTION",
      hoursToDeparture: 2.75,
      weightLoadRatio: 0.93,
    });
    const laterOver = stub({
      flightId: "CX251",
      status: "OVER",
      hoursToDeparture: 18,
      weightLoadRatio: 1.04,
    });
    expect(compareCrisis(nearCaution, laterOver)).toBeLessThan(0);
  });

  it("among equally soon flights, ranks the higher load first", () => {
    const hotter = stub({
      flightId: "CX247",
      status: "OVER",
      hoursToDeparture: 10,
      weightLoadRatio: 1.07,
    });
    const milder = stub({
      flightId: "CX249",
      status: "OVER",
      hoursToDeparture: 10,
      weightLoadRatio: 1.01,
    });
    expect(compareCrisis(hotter, milder)).toBeLessThan(0);
  });

  it("marks health CRITICAL only when OVER is inside the near window", () => {
    const farOver = stub({
      flightId: "CX251",
      status: "OVER",
      hoursToDeparture: 18,
      weightLoadRatio: 1.04,
      isNearDeparture: false,
    });
    expect(resolveBoardHealth([farOver])).toBe("STRESSED");
    expect(resolveBoardHealth([{ ...farOver, isNearDeparture: true }])).toBe("CRITICAL");
  });
});
