import type { Ratio } from "./types";

export function formatRatio(ratio: Ratio, noSample: string): string {
  if (ratio.rate == null) {
    return noSample;
  }
  return `${formatRate(ratio.rate)} · ${formatPair(ratio.numerator, ratio.denominator)}`;
}

export function formatHkd(value: number): string {
  const cents = Math.round(Math.abs(value) * 100);
  const hasCents = cents % 100 !== 0;
  const digits = hasCents ? 2 : 0;
  return `HK$${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatRate(rate: number): string {
  if (rate === 0) {
    return "0";
  }
  return `${(rate * 100).toFixed(2)}%`;
}

export function formatPair(numerator: number, denominator: number): string {
  return `${numerator} / ${denominator}`;
}

export function formatDays(value: number): string {
  return value.toFixed(2);
}

export function formatMonthDay(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
}
