import type { CSSProperties } from "react";

/** Shared geometry for the hold-load axis and each flight bar. 1 viewBox unit = 1px. */
export const CHART_Y_MAX = 1.2;
export const CHART_PLOT_H = 250;
export const CHART_TOP = 28;
export const CHART_FOOTER = 72;
export const CHART_SVG_H = CHART_TOP + CHART_PLOT_H;
export const CHART_VB_W = 100;

export function chartY(ratio: number): number {
  return CHART_TOP + CHART_PLOT_H - (ratio / CHART_Y_MAX) * CHART_PLOT_H;
}

export const chartStyle = {
  "--chart-ymax": String(CHART_Y_MAX),
  "--chart-plot": `${CHART_PLOT_H}px`,
  "--chart-footer": `${CHART_FOOTER}px`,
  "--chart-svg": `${CHART_SVG_H}px`,
} as CSSProperties;
