import type { FamilyMilestoneRecord } from "../services/familyMilestones";

// Presentation-only sample history. Never persisted as orders or used for fares.
// Set enabled to false to disable the sample, or edit these records to preview
// 0/3, 1/3, 2/3 and 3/3. Live/non-demo bookings never use this fallback.
export const FAMILY_MILESTONES_DEMO: {
  enabled: boolean;
  records: FamilyMilestoneRecord[];
} = {
  enabled: true,
  records: [
    {
      id: "sample-family-move-1",
      status: "completed",
      eligible: true,
      date: "2026-11-01T09:30:00+08:00",
      flightNo: "CX257",
    },
    { id: "sample-family-move-2", status: "notStarted", eligible: true },
    { id: "sample-family-move-3", status: "notStarted", eligible: true },
  ],
};
