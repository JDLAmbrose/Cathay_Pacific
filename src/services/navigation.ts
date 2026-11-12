import { BOOK_PAGES, readRoute } from "../config/routes";
import {
  FAMILY_MEMBER_ID,
  familyKnownContact,
  state,
} from "../engine/booking";
import type { Page, Route } from "../types/domain";

export let page: Page = "home";
export let helperFamilyPage = false;
export let helperPassengerId = "lin";
export let familyInvitePassengerId: string | null = null;
export let familyDemoTravellerId = FAMILY_MEMBER_ID;
export const familyPageLink = () =>
  helperFamilyPage ? state.passengerLinks[helperPassengerId] ?? familyKnownContact(helperPassengerId, true) : state.familyLink;

export function applyRoute(route: Route) {
  page = route.page;
  helperFamilyPage = route.helper;
  helperPassengerId = state.travellerId;
  familyInvitePassengerId = route.helper ? helperPassengerId : null;
  familyDemoTravellerId = state.travellerId;
  const step = BOOK_PAGES.indexOf(page) + 1;
  state.view = step ? "book" : page;
  if (step) state.step = step;
  if (page === "passenger") state.family = false;
}

export function initialRoute() {
  return readRoute(new URL(window.location.href));
}
