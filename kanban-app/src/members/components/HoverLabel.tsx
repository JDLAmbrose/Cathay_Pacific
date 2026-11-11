import { useState, type ReactNode } from "react";
import {
  FloatingPortal,
  safePolygon,
  useDismiss,
  useFloating,
  useHover,
  useId,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { floatingStyle, floatingUi } from "../../components/common/floating";
import popoverStyles from "../../components/common/InfoPopover.module.css";

export function HoverLabel({
  label,
  tip,
  className,
  onSelect,
  children,
}: {
  label: string;
  tip: ReactNode;
  className?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom",
    ...floatingUi,
  });
  const hover = useHover(context, { move: false, handleClose: safePolygon() });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);
  const tooltipId = useId();

  return (
    <>
      <button
        type="button"
        className={className}
        ref={refs.setReference}
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        {...getReferenceProps({ onClick: onSelect })}
      >
        {children}
      </button>
      {open ? (
        <FloatingPortal>
          <div
            id={tooltipId}
            role="tooltip"
            ref={refs.setFloating}
            style={floatingStyle(floatingStyles)}
            className={popoverStyles.tip}
            {...getFloatingProps()}
          >
            {tip}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
