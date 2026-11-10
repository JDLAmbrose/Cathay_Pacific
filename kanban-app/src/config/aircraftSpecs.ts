import type { AircraftCapacitySpec, AircraftModel } from "../types/kanban";

export const AIRCRAFT_SPECS: Readonly<Record<AircraftModel, AircraftCapacitySpec>> = {
  "A350-900": { capKg: 22050, capM3: 172.0, seats: 280 },
  "A350-1000": { capKg: 26660, capM3: 208.0, seats: 334 },
  "777-300ER": { capKg: 27410, capM3: 213.8, seats: 368 },
};
