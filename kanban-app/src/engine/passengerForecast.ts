import { DEFAULT_PAX_BAG_KG, DEFAULT_PAX_BAG_M3 } from "../config/thresholds";
import type { PaxBaggageForecast } from "../types/kanban";
import { InvalidFlightDataError } from "./errors";

export function forecastPaxBaggage(input: {
  seats: number;
  plumePax: number;
}): PaxBaggageForecast {
  if (input.seats < input.plumePax) {
    throw new InvalidFlightDataError(
      `seats (${input.seats}) must be >= plumePax (${input.plumePax})`,
    );
  }
  const nonPlumePax = input.seats - input.plumePax;
  return {
    kg: nonPlumePax * DEFAULT_PAX_BAG_KG,
    m3: nonPlumePax * DEFAULT_PAX_BAG_M3,
  };
}
