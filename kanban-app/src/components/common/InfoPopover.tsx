import { useState, type ReactNode } from "react";
import {
  FloatingPortal,
  safePolygon,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useId,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { floatingStyle, floatingUi } from "./floating";
import styles from "./InfoPopover.module.css";

export function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    ...floatingUi,
  });
  const hover = useHover(context, { move: false, handleClose: safePolygon() });
  const focus = useFocus(context);
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    click,
    dismiss,
    role,
  ]);
  const tooltipId = useId();

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        ref={refs.setReference}
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        {...getReferenceProps()}
      >
        i
      </button>
      {open ? (
        <FloatingPortal>
          <div
            id={tooltipId}
            role="tooltip"
            ref={refs.setFloating}
            style={floatingStyle(floatingStyles)}
            className={styles.tip}
            {...getFloatingProps()}
          >
            {children}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
