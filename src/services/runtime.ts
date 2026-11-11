import type { ReactNode } from "react";
import { t } from "./i18n";
import type { View } from "../types/domain";

export type DialogButton = {
  text: string;
  action: string;
  id?: string;
  light?: boolean;
};
export type DialogState = {
  title: string;
  body: ReactNode;
  buttons: DialogButton[];
  focusAction?: string;
  focusField?: string;
  rich?: boolean;
};

const listeners = new Set<() => void>();
let revision = 0;
let timer: ReturnType<typeof setTimeout>;
export let toastKey = "";
export let dialog: DialogState | null = null;
export function snapshot() {
  return revision;
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function render() {
  revision++;
  for (const listener of listeners) listener();
}
export function toast(key: string) {
  toastKey = key;
  clearTimeout(timer);
  if (key)
    timer = setTimeout(() => {
      toastKey = "";
      render();
    }, 4500);
  render();
}
export function modal(
  title: string,
  body: string,
  buttons: DialogButton[] = [
    { text: t("common.close"), action: "close-dialog" },
  ],
) {
  dialog = { title, body, buttons };
  render();
}
export function richModal(
  title: string,
  body: ReactNode,
  buttons: DialogButton[],
  focusAction?: string,
  focusField?: string,
) {
  dialog = { title, body, buttons, focusAction, focusField, rich: true };
  render();
}
export function updateDialogBody(body: ReactNode) {
  if (!dialog) return;
  dialog = { ...dialog, body };
  render();
}
export function closeModal() {
  if (!dialog) return;
  dialog = null;
  render();
}

let navigate: (view: View, step?: number, helper?: boolean) => void = () => {};
export function connectNavigation(listener: typeof navigate) {
  navigate = listener;
  return () => {
    if (navigate === listener) navigate = () => {};
  };
}
export function go(view: View, step?: number, helper?: boolean) {
  navigate(view, step, helper);
}
