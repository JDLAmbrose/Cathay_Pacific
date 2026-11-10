import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculateHoldLoad } from "../src/engine/holdLoad";
import { InvalidFlightDataError, UnknownAircraftError } from "../src/engine/errors";
import { forecastPaxBaggage } from "../src/engine/passengerForecast";
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

describe("forecastPaxBaggage", () => {
  it("uses seats minus Plume pax times 23 kg / 0.227 m³", () => {
    expect(forecastPaxBaggage({ seats: 368, plumePax: 28 })).toEqual({
      kg: 7820,
      m3: 77.18,
    });
  });

  it("rejects seats < plumePax", () => {
    expect(() => forecastPaxBaggage({ seats: 10, plumePax: 12 })).toThrow(InvalidFlightDataError);
  });
});

describe("calculateHoldLoad against Plan §7", () => {
  it("CX251 is OVER with deficit 1056 kg and 1046 kg Plume on-flight", () => {
    const load = calculateHoldLoad(flight("CX251"), snapshot.asOf, snapshot.nearHours);
    expect(load.status).toBe("OVER");
    expect(load.deficitKg).toBe(1056);
    expect(load.plumeOnFlightKg).toBe(1046);
    expect(load.plumePieceCount).toBe(66);
    expect(load.plumeOnFlightPieceCount).toBe(60);
    expect(load.plumeArrivedKg).toBe(134);
    expect(load.estimatedPaxBaggageKg).toBe(7820);
    expect(load.weightLoadRatio).toBeCloseTo(1.039, 3);
    expect(load.plumeDeferrableKg).toBe(386);
    expect(load.plumeDeferrablePieceCount).toBe(18);
  });

  it("CX253 is OVER with deficit 332 kg", () => {
    const load = calculateHoldLoad(flight("CX253"), snapshot.asOf, snapshot.nearHours);
    expect(load.status).toBe("OVER");
    expect(load.deficitKg).toBe(332);
    expect(load.plumeOnFlightKg).toBe(1460);
    expect(load.estimatedPaxBaggageKg).toBe(6072);
  });

  it("CX257 is CAUTION and near departure", () => {
    const load = calculateHoldLoad(flight("CX257"), snapshot.asOf, snapshot.nearHours);
    expect(load.status).toBe("CAUTION");
    expect(load.isNearDeparture).toBe(true);
    expect(load.deficitKg).toBe(0);
    expect(load.plumeOnFlightKg).toBe(950);
    expect(load.weightLoadRatio).toBeCloseTo(0.959, 3);
  });

  it("CX255 / CX263 are CARGO_UNK and report BAG % not a deficit", () => {
    const cx255 = calculateHoldLoad(flight("CX255"), snapshot.asOf, snapshot.nearHours);
    const cx263 = calculateHoldLoad(flight("CX263"), snapshot.asOf, snapshot.nearHours);
    expect(cx255.status).toBe("CARGO_UNK");
    expect(cx263.status).toBe("CARGO_UNK");
    expect(cx255.deficitKg).toBe(0);
    expect(cx255.weightLoadRatio).toBeCloseTo(0.268, 3);
    expect(cx263.weightLoadRatio).toBeCloseTo(0.298, 3);
  });

  it("CX259 is volume-bottleneck CAUTION and cannot take extra cargo headroom", () => {
    const load = calculateHoldLoad(flight("CX259"), snapshot.asOf, snapshot.nearHours);
    expect(load.hasVolumeBottleneck).toBe(true);
    expect(load.status).toBe("CAUTION");
    expect(load.volumeLoadRatio).toBeGreaterThan(0.9);
    expect(load.weightLoadRatio).toBeLessThan(0.9);
  });

  it("CX261 is NORMAL under 90%", () => {
    const load = calculateHoldLoad(flight("CX261"), snapshot.asOf, snapshot.nearHours);
    expect(load.status).toBe("NORMAL");
    expect(load.weightLoadRatio).toBeCloseTo(0.799, 3);
  });

  it("throws on unknown aircraft and non-positive capacity", () => {
    const unknown = { ...flight("CX261"), aircraft: "747-8F" as RawFlight["aircraft"] };
    expect(() => calculateHoldLoad(unknown, snapshot.asOf, snapshot.nearHours)).toThrow(
      UnknownAircraftError,
    );
    const badCap = {
      ...flight("CX261"),
      capOverride: { capKg: 0, capM3: 10 },
    };
    expect(() => calculateHoldLoad(badCap, snapshot.asOf, snapshot.nearHours)).toThrow(
      InvalidFlightDataError,
    );
  });
});
