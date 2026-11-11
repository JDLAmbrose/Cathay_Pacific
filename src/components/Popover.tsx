import { useState, type ReactNode } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import {
  BAG_CATEGORIES,
  invalidateAgent,
  itemCategories,
  persist,
  state,
} from "../engine/booking";
import { t } from "../services/i18n";
import { render } from "../services/runtime";
import type { Bag } from "../types/domain";
import { cx } from "./primitives";

type CategoryPickerProps = {
  item: Bag;
  n: number;
  iconFor: (category: string) => ReactNode;
  summary: ReactNode;
};

export function CategoryPicker({
  item,
  n,
  iconFor,
  summary,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableWidth, elements }) {
          elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
        },
      }),
    ],
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);
  const selected = itemCategories(item);
  function change(category: string, checked: boolean) {
    const categories = new Set(selected);
    if (checked) categories.add(category);
    else categories.delete(category);
    item.categories = BAG_CATEGORIES.filter((key) => categories.has(key));
    item.category = item.categories[0] || "other";
    state.agreed = false;
    invalidateAgent();
    persist();
    render();
  }

  return (
    <div className={cx("field category-field")}>
      <span>
        {t("bag.category")}{" "}
        <small className={cx("muted")}>{t("bag.multiple")}</small>
      </span>
      <div className={cx("category-picker")} data-category-picker>
        <button
          ref={refs.setReference}
          type="button"
          className={cx("category-trigger")}
          {...getReferenceProps({
            "aria-label": t("bag.category") + " · " + t("bag.number", { n }),
          })}
        >
          <span className={cx("category-selection")}>{summary}</span>
        </button>
        {open && (
          <FloatingPortal>
            <FloatingFocusManager context={context} modal={false}>
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                {...getFloatingProps({ "aria-label": t("bag.category") })}
                className={cx("category-menu")}
              >
                <p>{t("bag.categoryHint")}</p>
                <div className={cx("category-grid")}>
                  {BAG_CATEGORIES.map((category) => (
                    <label className={cx("category-choice")} key={category}>
                      <input
                        type="checkbox"
                        data-item-category={category}
                        checked={selected.includes(category)}
                        onChange={(event) =>
                          change(category, event.target.checked)
                        }
                        aria-label={t("bag." + category)}
                      />
                      {iconFor(category)}
                      <span>{t("bag." + category)}</span>
                    </label>
                  ))}
                </div>
                <button
                  className={cx("textbtn")}
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  {t("bag.doneCategories")}
                </button>
              </div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </div>
    </div>
  );
}
