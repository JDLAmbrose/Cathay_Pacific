/** Display constants. The cost ratio is read from the snapshot, not from here. */
export const LAG_BIN_EDGES_DAYS = [0, 15, 30, 45, 60, 75, 90, 120, 180] as const;

export const DIAMOND_EXEC_EFFECTIVE_AT = "2027-01-01T00:00:00+08:00";

export const DEMO_UNIT_PRICE_HKD = {
  pickup: 1200,
  extraBag: 600,
  cargoUnit: 250,
} as const;

export const FAMILY_PROMO_CODES = ["PLUME-ENROL", "PLUME-HOLIDAY", "PLUME-GRAD"] as const;

export const OFFICIAL_PROMO_CODES = ["HKSTUDENT"] as const;

export const BASE_TIERS = ["Green", "Silver", "Gold", "Diamond"] as const;
