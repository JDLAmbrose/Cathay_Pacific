import { FAMILY_STATUS_ORDER } from "../engine/familyStatus";
import type { FamilyLinkStatus } from "../types";

export const FAMILY_FLOW = {
  width: 980,
  height: 292,
  sourceX: 16,
  sourceWidth: 140,
  laneX: 400,
  top: 12,
  rowHeight: 44,
} as const;

export interface FamilyRibbon {
  status: FamilyLinkStatus;
  count: number;
  path: string | null;
  y: number;
}

function areaPath(sourceTop: number, sourceBottom: number, laneTop: number, laneBottom: number): string {
  const x1 = FAMILY_FLOW.sourceX + FAMILY_FLOW.sourceWidth;
  const x2 = FAMILY_FLOW.laneX;
  const mid = (x1 + x2) / 2;
  return `M${x1},${sourceTop} C${mid},${sourceTop} ${mid},${laneTop} ${x2},${laneTop} L${x2},${laneBottom} C${mid},${laneBottom} ${mid},${sourceBottom} ${x1},${sourceBottom} Z`;
}

/**
 * One lane per family status, in state-machine order.
 * A zero count keeps its lane label but does not get an area path.
 */
export function familyRibbons(counts: Record<FamilyLinkStatus, number>): FamilyRibbon[] {
  const positive = FAMILY_STATUS_ORDER.filter((status) => counts[status] > 0);
  const total = positive.reduce((sum, status) => sum + counts[status], 0);
  const sourceTop = FAMILY_FLOW.top + 8;
  const sourceHeight = FAMILY_FLOW.rowHeight * FAMILY_STATUS_ORDER.length - 24;
  let cursor = sourceTop;
  const sourceSpan = new Map<FamilyLinkStatus, { top: number; bottom: number }>();
  if (total > 0) {
    for (const status of positive) {
      const height = (counts[status] / total) * sourceHeight;
      sourceSpan.set(status, { top: cursor, bottom: cursor + height });
      cursor += height;
    }
  }

  return FAMILY_STATUS_ORDER.map((status, index) => {
    const count = counts[status];
    const y = FAMILY_FLOW.top + index * FAMILY_FLOW.rowHeight;
    const span = sourceSpan.get(status);
    const path =
      count > 0 && span
        ? areaPath(span.top, span.bottom, y + 8, y + FAMILY_FLOW.rowHeight - 10)
        : null;
    return { status, count, path, y };
  });
}
