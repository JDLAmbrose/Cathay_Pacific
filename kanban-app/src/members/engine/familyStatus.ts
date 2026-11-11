import type { FamilyLinkRecord, FamilyLinkStatus } from "../types";

export const FAMILY_STATUS_ORDER: readonly FamilyLinkStatus[] = [
  "cancelled",
  "declined",
  "revoked",
  "authorized",
  "linked_unauthorized",
  "pending",
];

/**
 * Same order as `link_status` in generate_member_snapshot.py.
 * A payment does not change the status; this function never reads orders.
 */
export function linkStatus(link: FamilyLinkRecord, tMs: number): FamilyLinkStatus | "not_yet_invited" {
  const at = (value: number | null) => value != null && value <= tMs;
  if (at(link.cancelledAtMs)) {
    return "cancelled";
  }
  if (at(link.declinedAtMs)) {
    return "declined";
  }
  if (at(link.revokedAtMs)) {
    if (at(link.acceptedAtMs)) {
      return "linked_unauthorized";
    }
    return "revoked";
  }
  if (at(link.authorizedAtMs)) {
    return "authorized";
  }
  if (at(link.acceptedAtMs)) {
    return "linked_unauthorized";
  }
  if (link.invitedAtMs <= tMs) {
    return "pending";
  }
  return "not_yet_invited";
}
