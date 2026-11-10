import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PLUME_BAG_M3 = 0.19;

function sum(weights) {
  return weights.reduce((total, kg) => total + kg, 0);
}

function assertSum(label, weights, expected) {
  const actual = sum(weights);
  if (actual !== expected) {
    throw new Error(`${label} sums to ${actual}, expected ${expected}`);
  }
}

function fill(kg, count) {
  return Array.from({ length: count }, () => kg);
}

/** Round-robin merge so identical weights are not adjacent. */
function mix(...groups) {
  const queues = groups.map((group) => [...group]);
  const out = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const queue of queues) {
      if (queue.length > 0) {
        out.push(queue.shift());
        progressed = true;
      }
    }
  }
  return out;
}

function bags(prefix, weights, mode, state, volumes) {
  return weights.map((kg, index) => ({
    bagId: `${prefix}-${String(index + 1).padStart(3, "0")}`,
    kg,
    m3: volumes?.[index] ?? DEFAULT_PLUME_BAG_M3,
    mode,
    state,
  }));
}

const cx251Arrived = [28, 26, 23, 21, 19, 17];
const cx251Defer = [32, 29, 27, 26, 24, 23, 22, 21, 20, 20, 19, 19, 18, 18, 17, 17, 17, 17];
const cx251OnFlight = mix(fill(14, 12), fill(15, 10), fill(16, 8), fill(17, 6), fill(18, 4), fill(20, 2));
assertSum("CX251 arrived", cx251Arrived, 134);
assertSum("CX251 defer", cx251Defer, 386);
assertSum("CX251 on-flight", cx251OnFlight, 660);

const cx253DeferHead = [31, 29, 28, 27, 26, 25, 25, 24, 24, 23, 23, 23, 22, 22];
const cx253DeferTail = mix(fill(16, 2), fill(17, 2), fill(18, 4), fill(19, 10), fill(20, 14));
const cx253OnFlight = mix(fill(21, 4), fill(25, 11), fill(27, 3), fill(30, 2));
assertSum("CX253 defer head", cx253DeferHead, 352);
assertSum("CX253 defer tail", cx253DeferTail, 608);
assertSum("CX253 on-flight", cx253OnFlight, 500);

const cx257Arrived = [26, 23, 21, 19, 17, 14];
const cx257OnFlight = mix(
  fill(16, 6),
  fill(17, 4),
  fill(18, 10),
  fill(19, 12),
  fill(20, 8),
  fill(21, 6),
  fill(23, 4),
);
assertSum("CX257 arrived", cx257Arrived, 120);
assertSum("CX257 on-flight", cx257OnFlight, 950);

const cx255Arrived = [24, 22, 18, 16];
const cx255OnFlight = mix(fill(16, 4), fill(18, 3), fill(20, 11), fill(22, 5), fill(24, 3));
assertSum("CX255 arrived", cx255Arrived, 80);
assertSum("CX255 on-flight", cx255OnFlight, 520);

const cx259OnFlight = mix(fill(17, 5), [18], fill(19, 6), fill(21, 5), fill(24, 3), fill(28, 2));
assertSum("CX259 on-flight", cx259OnFlight, 450);

const cx261Arrived = [24, 21, 18, 15, 12];
const cx261OnFlight = mix(fill(16, 2), fill(18, 9), fill(20, 8), fill(22, 5), fill(24, 4));
assertSum("CX261 arrived", cx261Arrived, 90);
assertSum("CX261 on-flight", cx261OnFlight, 560);

const cx263OnFlight = mix(fill(16, 4), fill(18, 5), fill(20, 4), fill(22, 4), fill(26, 3));
assertSum("CX263 on-flight", cx263OnFlight, 400);

const cx105Arrived = [22, 18];
const cx105Defer = [28, 26, 24, 23, 22, 21, 20, 19, 18, 19];
const cx105OnFlight = [24, 22, 21, 18, 16, 15, 14, 10];
assertSum("CX105 arrived", cx105Arrived, 40);
assertSum("CX105 defer", cx105Defer, 220);
assertSum("CX105 on-flight", cx105OnFlight, 140);

const cx139OnFlight = [32, 28, 27, 26, 24, 23];
assertSum("CX139 on-flight", cx139OnFlight, 160);

const cx163Arrived = [20, 16];
const cx163OnFlight = [24, 22, 21, 19, 18, 17, 16, 13];
assertSum("CX163 arrived", cx163Arrived, 36);
assertSum("CX163 on-flight", cx163OnFlight, 150);

const cx165OnFlight = mix(fill(16, 1), fill(18, 5), fill(20, 3), fill(22, 2), [30]);
assertSum("CX165 on-flight", cx165OnFlight, 240);

const cx161Arrived = [21, 17];
const cx161OnFlight = [28, 24, 22, 20, 18, 16];
assertSum("CX161 arrived", cx161Arrived, 38);
assertSum("CX161 on-flight", cx161OnFlight, 128);

const cx111Arrived = [24, 19, 17];
const cx111Defer = [32, 29, 27, 26, 24, 23, 22, 21, 20, 26];
const cx111OnFlight = [24, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 21];
assertSum("CX111 arrived", cx111Arrived, 60);
assertSum("CX111 defer", cx111Defer, 250);
assertSum("CX111 on-flight", cx111OnFlight, 220);

const cx101Arrived = [22, 18];
const cx101OnFlight = [24, 22, 21, 19, 18, 17, 16, 15, 16];
assertSum("CX101 arrived", cx101Arrived, 40);
assertSum("CX101 on-flight", cx101OnFlight, 168);

const snapshot = {
  asOf: "2026-11-15T05:30:00+08:00",
  sector: "HKG-LHR",
  windowDays: 2,
  nearHours: 6,
  aircraftSpecs: {
    "A350-900": { capKg: 22050, capM3: 172.0, seats: 280 },
    "A350-1000": { capKg: 26660, capM3: 208.0, seats: 334 },
    "777-300ER": { capKg: 27410, capM3: 213.8, seats: 368 },
  },
  flights: [
    {
      id: "CX257",
      sector: "HKG-LHR",
      dep: "2026-11-15T09:30:00+08:00",
      aircraft: "A350-1000",
      seats: 334,
      capOverride: null,
      cargoKg: 17400,
      cargoM3: 108.75,
      plumePax: 20,
      plumeBags: [
        ...bags("PL-257-A", cx257Arrived, "on_flight", "arrived"),
        ...bags("PL-257-F", cx257OnFlight, "on_flight", "staged"),
      ],
    },
    {
      id: "CX251",
      sector: "HKG-LHR",
      dep: "2026-11-15T23:40:00+08:00",
      aircraft: "777-300ER",
      seats: 368,
      capOverride: null,
      cargoKg: 19600,
      cargoM3: 122.5,
      plumePax: 28,
      plumeBags: [
        ...bags("PL-251-A", cx251Arrived, "cargo", "arrived"),
        ...bags("PL-251-D", cx251Defer, "cargo", "staged"),
        ...bags("PL-251-F", cx251OnFlight, "on_flight", "staged"),
      ],
    },
    {
      id: "CX253",
      sector: "HKG-LHR",
      dep: "2026-11-16T09:30:00+08:00",
      aircraft: "A350-900",
      seats: 280,
      capOverride: null,
      cargoKg: 14850,
      cargoM3: 92.8125,
      plumePax: 16,
      plumeBags: [
        ...bags("PL-253-D", [...cx253DeferHead, ...cx253DeferTail], "cargo", "staged"),
        ...bags("PL-253-F", cx253OnFlight, "on_flight", "staged"),
      ],
    },
    {
      id: "CX255",
      sector: "HKG-LHR",
      dep: "2026-11-16T23:55:00+08:00",
      aircraft: "A350-1000",
      seats: 300,
      capOverride: null,
      cargoKg: null,
      cargoM3: null,
      plumePax: 12,
      plumeBags: [
        ...bags("PL-255-A", cx255Arrived, "cargo", "arrived"),
        ...bags("PL-255-F", cx255OnFlight, "on_flight", "staged"),
      ],
    },
    {
      id: "CX259",
      sector: "HKG-LHR",
      dep: "2026-11-17T09:30:00+08:00",
      aircraft: "A350-900",
      seats: 260,
      capOverride: null,
      cargoKg: 13200,
      cargoM3: 100.7,
      plumePax: 10,
      plumeBags: bags("PL-259-F", cx259OnFlight, "on_flight", "staged"),
    },
    {
      id: "CX261",
      sector: "HKG-LHR",
      dep: "2026-11-17T23:40:00+08:00",
      aircraft: "777-300ER",
      seats: 294,
      capOverride: null,
      cargoKg: 14900,
      cargoM3: 93.125,
      plumePax: 14,
      plumeBags: [
        ...bags("PL-261-A", cx261Arrived, "cargo", "arrived"),
        ...bags("PL-261-F", cx261OnFlight, "on_flight", "staged"),
      ],
    },
    {
      id: "CX263",
      sector: "HKG-LHR",
      dep: "2026-11-18T09:30:00+08:00",
      aircraft: "A350-1000",
      seats: 334,
      capOverride: null,
      cargoKg: null,
      cargoM3: null,
      plumePax: 6,
      plumeBags: bags("PL-263-F", cx263OnFlight, "on_flight", "staged"),
    },
    {
      id: "CX239",
      sector: "HKG-LHR",
      dep: "2026-11-15T08:15:00+08:00",
      aircraft: "A350-900",
      seats: 280,
      capOverride: null,
      cargoKg: 14100,
      cargoM3: 86.2,
      plumePax: 8,
      plumeBags: [
        ...bags("PL-239-A", [23, 19], "cargo", "arrived", [0.21, 0.16]),
        ...bags("PL-239-F", [31, 17, 22, 14, 26, 18], "on_flight", "staged", [0.24, 0.14, 0.19, 0.12, 0.22, 0.16]),
      ],
    },
    {
      id: "CX237",
      sector: "HKG-LHR",
      dep: "2026-11-15T14:20:00+08:00",
      aircraft: "777-300ER",
      seats: 312,
      capOverride: null,
      cargoKg: 14800,
      cargoM3: 96.8,
      plumePax: 15,
      plumeBags: [
        ...bags("PL-237-A", [24, 21, 18, 16], "cargo", "arrived", [0.22, 0.18, 0.16, 0.14]),
        ...bags(
          "PL-237-F",
          [32, 28, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 23, 27],
          "on_flight",
          "staged",
          [0.26, 0.23, 0.2, 0.19, 0.18, 0.17, 0.16, 0.16, 0.15, 0.14, 0.13, 0.12, 0.2, 0.22],
        ),
      ],
    },
    {
      id: "CX249",
      sector: "HKG-LHR",
      dep: "2026-11-15T21:10:00+08:00",
      aircraft: "A350-1000",
      seats: 334,
      capOverride: null,
      cargoKg: 19250,
      cargoM3: 118.7,
      plumePax: 17,
      plumeBags: [
        ...bags("PL-249-A", [25, 22, 18], "cargo", "arrived", [0.22, 0.19, 0.15]),
        ...bags("PL-249-D", [29, 27, 24, 23, 22, 21, 20, 19, 18, 16], "cargo", "staged", [0.24, 0.23, 0.21, 0.2, 0.19, 0.18, 0.17, 0.16, 0.16, 0.14]),
        ...bags("PL-249-F", [32, 26, 23, 21, 20, 19, 18, 17, 15, 14, 13], "on_flight", "staged", [0.27, 0.22, 0.2, 0.18, 0.17, 0.16, 0.16, 0.15, 0.14, 0.13, 0.12]),
      ],
    },
    {
      id: "CX105",
      sector: "HKG-MEL",
      dep: "2026-11-15T19:05:00+08:00",
      aircraft: "A350-1000",
      seats: 334,
      capOverride: null,
      cargoKg: 19400,
      cargoM3: 118.4,
      plumePax: 11,
      plumeBags: [
        ...bags("PL-105-A", cx105Arrived, "cargo", "arrived", [0.2, 0.16]),
        ...bags("PL-105-D", cx105Defer, "cargo", "staged", [0.24, 0.23, 0.21, 0.2, 0.19, 0.18, 0.17, 0.16, 0.16, 0.16]),
        ...bags("PL-105-F", cx105OnFlight, "on_flight", "staged", [0.21, 0.19, 0.18, 0.16, 0.15, 0.14, 0.13, 0.12]),
      ],
    },
    {
      id: "CX139",
      sector: "HKG-MEL",
      dep: "2026-11-16T08:40:00+08:00",
      aircraft: "A350-900",
      seats: 280,
      capOverride: null,
      cargoKg: 14200,
      cargoM3: 94.2,
      plumePax: 6,
      plumeBags: bags("PL-139-F", cx139OnFlight, "on_flight", "staged"),
    },
    {
      id: "CX163",
      sector: "HKG-MEL",
      dep: "2026-11-16T20:20:00+08:00",
      aircraft: "777-300ER",
      seats: 312,
      capOverride: null,
      cargoKg: 14600,
      cargoM3: 94.8,
      plumePax: 8,
      plumeBags: [
        ...bags("PL-163-A", cx163Arrived, "cargo", "arrived", [0.18, 0.14]),
        ...bags("PL-163-F", cx163OnFlight, "on_flight", "staged"),
      ],
    },
    {
      id: "CX165",
      sector: "HKG-MEL",
      dep: "2026-11-17T08:40:00+08:00",
      aircraft: "A350-900",
      seats: 280,
      capOverride: null,
      cargoKg: null,
      cargoM3: null,
      plumePax: 5,
      plumeBags: bags("PL-165-F", cx165OnFlight, "on_flight", "staged"),
    },
    {
      id: "CX161",
      sector: "HKG-SYD",
      dep: "2026-11-15T09:55:00+08:00",
      aircraft: "A350-900",
      seats: 280,
      capOverride: null,
      cargoKg: 14080,
      cargoM3: 86.4,
      plumePax: 7,
      plumeBags: [
        ...bags("PL-161-A", cx161Arrived, "cargo", "arrived", [0.19, 0.15]),
        ...bags("PL-161-F", cx161OnFlight, "on_flight", "staged", [0.23, 0.21, 0.19, 0.17, 0.16, 0.14]),
      ],
    },
    {
      id: "CX111",
      sector: "HKG-SYD",
      dep: "2026-11-15T21:40:00+08:00",
      aircraft: "777-300ER",
      seats: 368,
      capOverride: null,
      cargoKg: 19210,
      cargoM3: 119.5,
      plumePax: 14,
      plumeBags: [
        ...bags("PL-111-A", cx111Arrived, "cargo", "arrived", [0.21, 0.17, 0.15]),
        ...bags("PL-111-D", cx111Defer, "cargo", "staged", [0.26, 0.24, 0.23, 0.22, 0.21, 0.2, 0.19, 0.18, 0.17, 0.22]),
        ...bags("PL-111-F", cx111OnFlight, "on_flight", "staged"),
      ],
    },
    {
      id: "CX101",
      sector: "HKG-SYD",
      dep: "2026-11-16T20:55:00+08:00",
      aircraft: "A350-1000",
      seats: 300,
      capOverride: null,
      cargoKg: 15200,
      cargoM3: 98.1,
      plumePax: 9,
      plumeBags: [
        ...bags("PL-101-A", cx101Arrived, "cargo", "arrived", [0.2, 0.16]),
        ...bags("PL-101-F", cx101OnFlight, "on_flight", "staged"),
      ],
    },
  ],
};

const root = dirname(fileURLToPath(import.meta.url));
const outPath = join(root, "..", "public", "data", "kanban-snapshot.json");
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${outPath}`);
