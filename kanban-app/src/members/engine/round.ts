/** Half-to-even, matching Python 3 `round` for the seed ratios. */
export function roundHalfEven(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction > 0.5 + 1e-9) {
    return floor + 1;
  }
  if (fraction < 0.5 - 1e-9) {
    return floor;
  }
  return floor % 2 === 0 ? floor : floor + 1;
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const nearest = Math.round(scaled);
  if (Math.abs(scaled - nearest) < 1e-6) {
    return nearest / factor;
  }
  return roundHalfEven(scaled) / factor;
}

export function toCents(value: number): number {
  return roundHalfEven(value * 100 + Math.sign(value) * 1e-8);
}
