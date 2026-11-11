import type { TranslationKey } from "../i18n/dictionary";
import type { AudienceFilter, BookmarkId, FamilyLinkStatus, TierName } from "./types";

export function bookmarkNameKey(id: BookmarkId): TranslationKey {
  switch (id) {
    case "A":
      return "mb.bm.A.name";
    case "B":
      return "mb.bm.B.name";
    case "C":
      return "mb.bm.C.name";
    case "D":
      return "mb.bm.D.name";
    case "P":
      return "mb.bm.P.name";
    case "E":
      return "mb.bm.E.name";
  }
}

export function bookmarkShortKey(id: BookmarkId): TranslationKey {
  switch (id) {
    case "A":
      return "mb.bm.A.short";
    case "B":
      return "mb.bm.B.short";
    case "C":
      return "mb.bm.C.short";
    case "D":
      return "mb.bm.D.short";
    case "P":
      return "mb.bm.P.short";
    case "E":
      return "mb.bm.E.short";
  }
}

export function bookmarkHoverKey(id: BookmarkId): TranslationKey {
  switch (id) {
    case "A":
      return "mb.bm.A.hover";
    case "B":
      return "mb.bm.B.hover";
    case "C":
      return "mb.bm.C.hover";
    case "D":
      return "mb.bm.D.hover";
    case "P":
      return "mb.bm.P.hover";
    case "E":
      return "mb.bm.E.hover";
  }
}

export function audienceKey(filter: AudienceFilter): TranslationKey {
  switch (filter) {
    case "all":
      return "mb.audience.all";
    case "students":
      return "mb.audience.students";
    case "parents":
      return "mb.audience.parents";
    case "business":
      return "mb.audience.business";
  }
}

export function tierKey(tier: TierName): TranslationKey | null {
  if (tier === "Diamond Exec") {
    return "mb.tier.diamondExec";
  }
  return null;
}

export function familyStatusKey(status: FamilyLinkStatus): TranslationKey {
  switch (status) {
    case "cancelled":
      return "mb.fam.cancelled";
    case "declined":
      return "mb.fam.declined";
    case "revoked":
      return "mb.fam.revoked";
    case "authorized":
      return "mb.fam.authorized";
    case "linked_unauthorized":
      return "mb.fam.linked";
    case "pending":
      return "mb.fam.pending";
  }
}
