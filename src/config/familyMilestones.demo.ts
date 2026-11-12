import type { FamilyMilestoneRecord } from "../services/familyMilestones";

// Presentation-only sample history. Never persisted as orders or used for fares.
// Set enabled to false to disable the sample, or edit these records to preview
// 0/3, 1/3, 2/3 and 3/3. Live/non-demo bookings never use this fallback.
export const FAMILY_MILESTONES_DEMO: {
  enabled: boolean;
  family: { studentId: string; linked: boolean; relationship: string };
  records: FamilyMilestoneRecord[];
} = {
  enabled: true,
  // The existing 1/3 presentation sample represents this linked Demo family.
  // It never creates or confirms a relationship in saved membership data.
  family: { studentId: "lin", linked: true, relationship: "parent" },
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

// Issuance is independent of eligibility. No code is generated on completion.
// An explicitly supplied sample here is still invalid for real flight bookings.
export const FAMILY_VISIT_PROMO_DEMO: {
  issued: { studentId: string; code: string } | null;
} = { issued: { studentId: "lin", code: "PLUMEFAM2026" } };
