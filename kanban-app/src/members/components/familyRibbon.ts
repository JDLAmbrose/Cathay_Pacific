import { FAMILY_STATUS_ORDER } from "../engine/familyStatus";
import type { FamilyLinkStatus } from "../types";

export const FAMILY_STATUS_COLOR: Record<FamilyLinkStatus, string> = {
  cancelled: "#9aa5a3",
  declined: "#e08a84",
  revoked: "#9aa5a3",
  authorized: "#2f9e6b",
  linked_unauthorized: "#e4b46c",
  pending: "#8fb5b1",
};

const BRANCH_LANES = ["cancelled", "declined", "revoked", "pending"] as const;
const LANE_ORDER = ["cancelled", "declined", "revoked", "accepted", "pending"] as const;

const LAYOUT = {
  width: 1000,
  lanesTop: 18,
  lanePitch: 56,
  sourceX: 16,
  sourceW: 136,
  nodeX: 408,
  nodeW: 156,
  nodeH: 64,
  barW: 10,
  cardX: 748,
  cardW: 232,
  cardH: 86,
  cardGap: 12,
  maxThick: 40,
  minThick: 8,
  sliceGap: 5,
  sourcePad: 18,
} as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export interface FamilyBranch {
  status: (typeof BRANCH_LANES)[number];
  count: number;
  centerY: number;
  path: string | null;
  bar: Box | null;
}

export interface FamilyContinuation {
  status: "authorized" | "linked_unauthorized";
  count: number;
  path: string | null;
  card: Box;
  chip: Point | null;
}

export interface FamilyDiagram {
  width: number;
  height: number;
  source: Box;
  labelX: number;
  arrivalX: number;
  barWidth: number;
  trunk: { path: string; chip: Point; thickness: number } | null;
  accepted: { count: number; node: Box };
  branches: FamilyBranch[];
  continuations: [FamilyContinuation, FamilyContinuation];
  ribbons: FamilyRibbon[];
}

export interface FamilyRibbon {
  status: FamilyLinkStatus;
  count: number;
  path: string | null;
  y: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function laneCenter(index: number): number {
  return LAYOUT.lanesTop + index * LAYOUT.lanePitch + LAYOUT.lanePitch / 2;
}

function thickness(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) {
    return 0;
  }
  return Math.max(LAYOUT.minThick, (count / maxCount) * LAYOUT.maxThick);
}

function areaPath(sourceTop: number, sourceBottom: number, laneTop: number, laneBottom: number, x1: number, x2: number): string {
  const mid = (x1 + x2) / 2;
  const y = [sourceTop, sourceBottom, laneTop, laneBottom].map(round);
  return `M${round(x1)},${y[0]} C${round(mid)},${y[0]} ${round(mid)},${y[2]} ${round(x2)},${y[2]} L${round(x2)},${y[3]} C${round(mid)},${y[3]} ${round(mid)},${y[1]} ${round(x1)},${y[1]} Z`;
}

function span(top: number, bottom: number, startRatio: number, endRatio: number): { top: number; bottom: number } {
  const height = bottom - top;
  return { top: top + height * startRatio, bottom: top + height * endRatio };
}

/**
 * Invites leave one source. Terminal statuses keep their own lane.
 * Authorised and linked travel together as the accepted trunk, then split into the two cards.
 */
export function familyDiagram(counts: Record<FamilyLinkStatus, number>): FamilyDiagram {
  const authorized = counts.authorized;
  const linked = counts.linked_unauthorized;
  const accepted = authorized + linked;
  const laneCount = (status: (typeof LANE_ORDER)[number]) => (status === "accepted" ? accepted : counts[status]);
  const maxCount = Math.max(...LANE_ORDER.map((status) => laneCount(status)), 0);
  const acceptedIndex = LANE_ORDER.indexOf("accepted");
  const acceptedCenter = laneCenter(acceptedIndex);

  const slices: { status: (typeof LANE_ORDER)[number]; top: number; bottom: number }[] = [];
  let cursor = 0;
  for (const status of LANE_ORDER) {
    const count = laneCount(status);
    if (count <= 0) {
      continue;
    }
    const height = thickness(count, maxCount);
    slices.push({ status, top: cursor, bottom: cursor + height });
    cursor += height + LAYOUT.sliceGap;
  }
  const stackHeight = slices.length === 0 ? 0 : cursor - LAYOUT.sliceGap;
  const acceptedSlice = slices.find((slice) => slice.status === "accepted");
  const columnCenter = LAYOUT.lanesTop + (LANE_ORDER.length * LAYOUT.lanePitch) / 2;
  let stackTop = acceptedSlice
    ? acceptedCenter - (acceptedSlice.top + acceptedSlice.bottom) / 2
    : columnCenter - stackHeight / 2;
  let sourceY = stackTop - LAYOUT.sourcePad;
  let sourceH = Math.max(96, stackHeight + LAYOUT.sourcePad * 2);
  if (slices.length === 0) {
    sourceY = acceptedCenter - sourceH / 2;
    stackTop = sourceY + LAYOUT.sourcePad;
  }
  if (sourceY < 8) {
    const shift = 8 - sourceY;
    sourceY += shift;
    stackTop += shift;
  }

  const source: Box = { x: LAYOUT.sourceX, y: round(sourceY), width: LAYOUT.sourceW, height: round(sourceH) };
  const sourceRight = source.x + source.width;
  const node: Box = {
    x: LAYOUT.nodeX,
    y: round(acceptedCenter - LAYOUT.nodeH / 2),
    width: LAYOUT.nodeW,
    height: LAYOUT.nodeH,
  };
  const trunkThick = thickness(accepted, maxCount);
  const trunkTop = acceptedCenter - trunkThick / 2;
  const trunkBottom = acceptedCenter + trunkThick / 2;
  const acceptedAbsolute = acceptedSlice
    ? { top: stackTop + acceptedSlice.top, bottom: stackTop + acceptedSlice.bottom }
    : null;
  const trunkPath =
    acceptedAbsolute && trunkThick > 0
      ? areaPath(acceptedAbsolute.top, acceptedAbsolute.bottom, trunkTop, trunkBottom, sourceRight - 2, node.x + 8)
      : null;

  const labelX = LAYOUT.nodeX + LAYOUT.barW + 8;
  const branches: FamilyBranch[] = BRANCH_LANES.map((status) => {
    const count = counts[status];
    const centerY = laneCenter(LANE_ORDER.indexOf(status));
    const slice = slices.find((item) => item.status === status);
    const barHeight = thickness(count, maxCount);
    const bar =
      count > 0
        ? {
            x: LAYOUT.nodeX,
            y: round(centerY - barHeight / 2),
            width: LAYOUT.barW,
            height: round(barHeight),
          }
        : null;
    const path =
      slice && bar
        ? areaPath(stackTop + slice.top, stackTop + slice.bottom, bar.y, bar.y + bar.height, sourceRight - 2, bar.x + bar.width)
        : null;
    return { status, count, centerY, path, bar };
  });

  const cardBlock = LAYOUT.cardH * 2 + LAYOUT.cardGap;
  const cardTop = acceptedCenter - cardBlock / 2;
  const cards: [Box, Box] = [0, 1].map((index) => ({
    x: LAYOUT.cardX,
    y: round(cardTop + index * (LAYOUT.cardH + LAYOUT.cardGap)),
    width: LAYOUT.cardW,
    height: LAYOUT.cardH,
  })) as [Box, Box];

  const exitGap = trunkThick > 18 ? 4 : 0;
  const exitUsable = Math.max(trunkThick - exitGap, 0);
  const authRatio = accepted > 0 ? authorized / accepted : 0;
  const exits = [
    { status: "authorized" as const, count: authorized, card: cards[0] },
    { status: "linked_unauthorized" as const, count: linked, card: cards[1] },
  ];
  let exitCursor = trunkTop;
  const continuations = exits.map((exit) => {
    const exitHeight = accepted > 0 && exit.count > 0 ? exitUsable * (exit.count / accepted) : 0;
    const top = exitCursor;
    exitCursor += exitHeight + (exit.status === "authorized" && authorized > 0 && linked > 0 ? exitGap : 0);
    const cardCenter = exit.card.y + exit.card.height / 2;
    const targetHeight = Math.min(Math.max(exitHeight, 8), exit.card.height - 20);
    const targetTop = cardCenter - targetHeight / 2;
    const path =
      exitHeight > 0
        ? areaPath(top, top + exitHeight, targetTop, targetTop + targetHeight, node.x + node.width - 8, exit.card.x)
        : null;
    const chip =
      path == null
        ? null
        : {
            x: round((node.x + node.width + exit.card.x) / 2),
            y: round((top + exitHeight / 2 + cardCenter) / 2),
          };
    return { status: exit.status, count: exit.count, path, card: exit.card, chip: exit.status === "authorized" ? chip : null };
  }) as [FamilyContinuation, FamilyContinuation];

  const slicePaths = new Map<FamilyLinkStatus, { path: string; y: number }>();
  for (const branch of branches) {
    if (branch.path) {
      slicePaths.set(branch.status, { path: branch.path, y: branch.centerY });
    }
  }
  if (acceptedAbsolute && trunkThick > 0 && accepted > 0) {
    const parts: { status: FamilyLinkStatus; ratioStart: number; ratioEnd: number }[] = [
      { status: "authorized", ratioStart: 0, ratioEnd: authRatio },
      { status: "linked_unauthorized", ratioStart: authRatio, ratioEnd: 1 },
    ];
    for (const part of parts) {
      if (counts[part.status] <= 0) {
        continue;
      }
      const from = span(acceptedAbsolute.top, acceptedAbsolute.bottom, part.ratioStart, part.ratioEnd);
      const to = span(trunkTop, trunkBottom, part.ratioStart, part.ratioEnd);
      slicePaths.set(part.status, {
        path: areaPath(from.top, from.bottom, to.top, to.bottom, sourceRight - 2, node.x + 8),
        y: (to.top + to.bottom) / 2,
      });
    }
  }

  const ribbons = FAMILY_STATUS_ORDER.map((status) => {
    const slice = slicePaths.get(status);
    return {
      status,
      count: counts[status],
      path: slice?.path ?? null,
      y: slice?.y ?? 0,
    };
  });
  const laneBottom = LAYOUT.lanesTop + LANE_ORDER.length * LAYOUT.lanePitch;
  const height = Math.max(laneBottom + 16, cards[1].y + cards[1].height + 16, source.y + source.height + 16);

  return {
    width: LAYOUT.width,
    height: round(height),
    source,
    labelX,
    arrivalX: LAYOUT.nodeX,
    barWidth: LAYOUT.barW,
    trunk: trunkPath
      ? {
          path: trunkPath,
          thickness: trunkThick,
          chip: { x: round((sourceRight + node.x) / 2), y: round(acceptedCenter) },
        }
      : null,
    accepted: { count: accepted, node },
    branches,
    continuations,
    ribbons,
  };
}

export function familyRibbons(counts: Record<FamilyLinkStatus, number>): FamilyRibbon[] {
  return familyDiagram(counts).ribbons;
}
