export function ribbonPath(
  x1: number,
  y1a: number,
  y1b: number,
  x2: number,
  y2a: number,
  y2b: number,
): string {
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1a} C${mid},${y1a} ${mid},${y2a} ${x2},${y2a} L${x2},${y2b} C${mid},${y2b} ${mid},${y1b} ${x1},${y1b} Z`;
}

export function dashedLinkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
}

/** Cubic used by the wireframe from the DEFER lane to a rejected candidate. */
export function rejectLinkPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  return `M${sourceX},${sourceY} C${sourceX + 150},${sourceY} ${targetX - 204},${targetY} ${targetX},${targetY}`;
}
