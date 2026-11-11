import { UnknownBookmarkError } from "../engine/errors";
import type { BookmarkId } from "../types";

export interface Bookmark {
  id: BookmarkId;
  at: string;
}

export const BOOKMARKS: readonly Bookmark[] = [
  { id: "A", at: "2026-06-17T09:30:00+08:00" },
  { id: "B", at: "2026-08-12T09:30:00+08:00" },
  { id: "C", at: "2026-09-16T09:30:00+08:00" },
  { id: "D", at: "2026-10-21T09:30:00+08:00" },
  { id: "P", at: "2026-11-10T09:30:00+08:00" },
  { id: "E", at: "2027-01-13T09:30:00+08:00" },
];

export const DEFAULT_BOOKMARK_ID: BookmarkId = "P";

const BOOKMARK_IDS = new Set<string>(BOOKMARKS.map((bookmark) => bookmark.id));

export function isBookmarkId(value: string): value is BookmarkId {
  return BOOKMARK_IDS.has(value);
}

export function bookmarkById(id: string): Bookmark {
  const bookmark = BOOKMARKS.find((item) => item.id === id);
  if (!bookmark) {
    throw new UnknownBookmarkError(id);
  }
  return bookmark;
}
