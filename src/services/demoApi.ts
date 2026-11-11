import {
  aggregateBaggage,
  baggagePlan,
  checkApplicationDeadline,
  clone,
  completeService,
  demand,
  familyMilestones,
  familyProgressAccess,
  forecastCapacity,
  quoteService,
  recordHandover,
  resetDemo,
  respondFamilyInvite,
  saveDeclaration,
  sendFamilyInvite,
  state,
  ticketAllowance,
  validateDeclaration,
  validateFamilyLink,
  validateService,
} from "../engine/booking";
import { language, setLanguage } from "./i18n";
import { render } from "./runtime";

const demoApi = {
  getState: () => clone(state),
  demand,
  validateDeclaration,
  aggregateBaggage,
  forecastCapacity,
  quoteService,
  ticketAllowance,
  baggagePlan,
  checkApplicationDeadline,
  validateService,
  saveDeclaration,
  recordHandover,
  completeService,
  resetDemo,
  validateFamilyLink,
  sendFamilyInvite,
  respondFamilyInvite,
  familyProgressAccess,
  familyMilestones,
  setLanguage(next: string) {
    setLanguage(next);
    render();
  },
  getLanguage: () => language,
};

declare global {
  interface Window {
    PlumeLight: typeof demoApi;
  }
}

export function exposeDemoApi() {
  window.PlumeLight = demoApi;
}
