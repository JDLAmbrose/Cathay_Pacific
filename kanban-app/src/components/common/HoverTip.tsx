import { useState, type CSSProperties, type ReactNode } from "react";
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
import popoverStyles from "./InfoPopover.module.css";

export function HoverTip({
  label,
  content,
  className,
  style,
}: {
  label: string;
  content: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "top",
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
        className={className}
        style={style}
        ref={refs.setReference}
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        {...getReferenceProps()}
      />
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
            {content}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
