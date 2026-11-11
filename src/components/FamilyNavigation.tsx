import { useEffect, useRef, useState } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import { FAMILY_PAGES, href } from "../config/routes";
import { t } from "../services/i18n";
import type { Page } from "../types/domain";
import { cx } from "./primitives";
import { icon } from "./shared";

export function FamilyNavigation({
  page,
  helper,
}: {
  page: Page;
  helper: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableWidth, availableHeight, elements }) {
          elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
        },
      }),
    ],
  });
  const hover = useHover(context, {
    mouseOnly: true,
    move: false,
    handleClose: safePolygon(),
  });
  const click = useClick(context, { ignoreMouse: true });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "menu" });
  const navigation = useListNavigation(context, {
    listRef: itemsRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    hover,
    click,
    dismiss,
    role,
    navigation,
  ]);

  useEffect(() => {
    setOpen(false);
  }, [page, helper]);

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={cx("tab family-nav-trigger")}
        data-active={FAMILY_PAGES.includes(page)}
        {...getReferenceProps()}
      >
        {t("nav.family")}
        {icon("chevron")}
      </button>
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className={cx("family-nav-menu")}
              {...getFloatingProps({ "aria-label": t("familyTabs.label") })}
            >
              {([
                ["family", "link"],
                ["benefits", "benefits"],
              ] as const).map(([view, key], index) => (
                <a
                  key={view}
                  ref={(node) => {
                    itemsRef.current[index] = node;
                  }}
                  href={href(view, 1, helper && view === "family")}
                  role="menuitem"
                  tabIndex={activeIndex === index ? 0 : -1}
                  aria-current={page === view ? "page" : undefined}
                  {...getItemProps({ onClick: () => setOpen(false) })}
                >
                  {t("familyTabs." + key)}
                </a>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
