import { useLayoutEffect, useRef } from "react";
import { closeModal, dialog } from "../services/runtime";
import { cx } from "./primitives";

export function Dialog() {
  const element = useRef<HTMLDialogElement>(null);
  const current = dialog;
  const title = current?.title;

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    if (title && !node.open) node.showModal();
    if (!title && node.open) node.close();
    if (title && current.focusAction)
      node
        .querySelector<HTMLElement>(`[data-action="${current.focusAction}"]`)
        ?.focus();
    if (title && current.focusField)
      node
        .querySelector<HTMLElement>(
          `[data-family-field="${current.focusField}"]`,
        )
        ?.focus();
  }, [title, current?.focusAction, current?.focusField]);

  return (
    <dialog
      ref={element}
      id="dialog"
      aria-labelledby="dialogTitle"
      onCancel={(event) => {
        event.preventDefault();
        closeModal();
      }}
    >
      {current && (
        <>
          <h2 id="dialogTitle">{current.title}</h2>
          <div
            id="dialogBody"
            className={cx("body", current.rich ? "rich" : undefined)}
          >
            {current.body}
          </div>
          <div id="dialogActions" className={cx("actions")}>
            {current.buttons.map((button) => (
              <button
                type="button"
                className={cx("btn", button.light ? "light" : undefined)}
                data-action={button.action}
                data-id={button.id}
                key={button.action}
              >
                {button.text}
              </button>
            ))}
          </div>
        </>
      )}
    </dialog>
  );
}
