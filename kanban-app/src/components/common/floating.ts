import type { CSSProperties } from "react";
import { autoUpdate, flip, offset, shift } from "@floating-ui/react";

export const FLOATING_Z_INDEX = 12000;

export const floatingUi = {
  strategy: "fixed" as const,
  middleware: [
    offset(10),
    flip({ padding: 16, fallbackAxisSideDirection: "start" }),
    shift({ padding: 16 }),
  ],
  whileElementsMounted: autoUpdate,
};

export function floatingStyle(floatingStyles: CSSProperties): CSSProperties {
  return { ...floatingStyles, zIndex: FLOATING_Z_INDEX };
}
