import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  activeOrder,
  cabinWeightError,
  displayValue,
  draft,
  PRICING_LANES,
  setPricingLane,
  state,
} from "../engine/booking";
import { language, t } from "../services/i18n";
import { modal, render, toast } from "../services/runtime";
import { cssVars, cx } from "./primitives";

export type PricingGesture = {
  lane: string;
  bagId: string;
  keyboard: boolean;
  announcement: string;
};
const idle: PricingGesture = {
  lane: "",
  bagId: "",
  keyboard: false,
  announcement: "",
};

function targetLane(target: EventTarget | null) {
  return target instanceof Element
    ? (target.closest<HTMLElement>("[data-drop-lane]")?.dataset.dropLane ?? "")
    : "";
}

function bagHandle(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>("[data-drag-handle]")
    : null;
}

type TouchDrag = {
  id: string;
  pointer: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
};

export function PricingInteraction({
  children,
}: {
  children: (gesture: PricingGesture) => ReactNode;
}) {
  const [gesture, setGesture] = useState(idle);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number }>(
    null,
  );
  const current = useRef(idle);
  const touch = useRef<TouchDrag>(null);
  const scrollFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);
  function update(next: PricingGesture) {
    current.current = next;
    setGesture(next);
  }

  function scrollWhileDragging() {
    const drag = touch.current;
    if (!drag?.active) return;
    const scroll = drag.y < 70 ? -12 : drag.y > innerHeight - 70 ? 12 : 0;
    if (scroll) {
      window.scrollBy({ top: scroll, behavior: "instant" });
      const lane = targetLane(document.elementFromPoint(drag.x, drag.y));
      if (lane !== current.current.lane) update({ ...current.current, lane });
    }
    scrollFrame.current = requestAnimationFrame(scrollWhileDragging);
  }

  function stopTouchDrag() {
    touch.current = null;
    cancelAnimationFrame(scrollFrame.current);
    setGhost(null);
  }

  function move(id: string, lane: string) {
    const item = draft().items.find((bag) => bag.id === id);
    update(idle);
    if (!item || !lane) return;
    if (!setPricingLane(id, lane)) {
      const error =
        lane === "cabin" && !state.processing && !activeOrder()
          ? cabinWeightError(item)
          : null;
      if (error) modal(t("pricing.cabinBlocked"), t(error));
      else toast(activeOrder() ? "e.orderChange" : "e.processing");
      return;
    }
    update({
      ...idle,
      announcement: t("pricing.moved", {
        name: displayValue(item.name),
        lane: t("pricing.lane." + lane),
      }),
    });
    render();
    requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLElement>("[data-drag-handle]"))
        .find((handle) => handle.dataset.dragHandle === id)
        ?.focus({ preventScroll: true });
    });
  }

  return (
    <div
      onDragStart={(event) => {
        const card = (event.target as Element).closest<HTMLElement>(
          "[data-pricing-bag]",
        );
        if (!card || activeOrder()) {
          event.preventDefault();
          return;
        }
        const id = card.dataset.pricingBag;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
        update({ ...idle, bagId: id, lane: targetLane(card) });
      }}
      onDragOver={(event) => {
        const lane = targetLane(event.target);
        const previous = current.current;
        if (!lane || !previous.bagId || previous.keyboard || touch.current)
          return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (lane !== previous.lane) update({ ...previous, lane });
      }}
      onDrop={(event) => {
        if (!current.current.bagId) return;
        event.preventDefault();
        move(current.current.bagId, targetLane(event.target));
      }}
      onDragEnd={() => {
        if (current.current.bagId && !current.current.keyboard) update(idle);
      }}
      onKeyDown={(event) => {
        const handle = bagHandle(event.target);
        if (!handle || activeOrder()) return;
        const id = handle.dataset.dragHandle;
        const previous = current.current;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (previous.keyboard && previous.bagId === id)
            move(id, previous.lane);
          else
            update({
              bagId: id,
              lane: targetLane(handle),
              keyboard: true,
              announcement: t("pricing.keyboardHint"),
            });
          return;
        }
        if (!previous.keyboard || previous.bagId !== id) return;
        if (event.key === "Escape") {
          event.preventDefault();
          update(idle);
          return;
        }
        if (
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        let direction = ["ArrowRight", "ArrowDown"].includes(event.key)
          ? 1
          : -1;
        if (
          language === "ar" &&
          ["ArrowLeft", "ArrowRight"].includes(event.key)
        )
          direction *= -1;
        const index =
          (PRICING_LANES.indexOf(previous.lane) +
            direction +
            PRICING_LANES.length) %
          PRICING_LANES.length;
        const lane = PRICING_LANES[index];
        update({ ...previous, lane, announcement: t("pricing.lane." + lane) });
      }}
      onBlur={(event) => {
        if (current.current.keyboard && bagHandle(event.target)) update(idle);
      }}
      onPointerDown={(event) => {
        const handle = bagHandle(event.target);
        if (!handle || event.pointerType === "mouse" || activeOrder()) return;
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        touch.current = {
          id: handle.dataset.dragHandle,
          pointer: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          active: false,
        };
      }}
      onPointerMove={(event) => {
        const drag = touch.current;
        if (!drag || drag.pointer !== event.pointerId) return;
        if (
          !drag.active &&
          Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
            8
        )
          return;
        drag.x = event.clientX;
        drag.y = event.clientY;
        if (!drag.active) {
          drag.active = true;
          scrollFrame.current = requestAnimationFrame(scrollWhileDragging);
        }
        setGhost({ id: drag.id, x: drag.x, y: drag.y });
        update({
          ...idle,
          bagId: drag.id,
          lane: targetLane(document.elementFromPoint(drag.x, drag.y)),
        });
      }}
      onPointerUp={(event) => {
        const drag = touch.current;
        if (!drag || drag.pointer !== event.pointerId) return;
        stopTouchDrag();
        if (drag.active)
          move(
            drag.id,
            targetLane(document.elementFromPoint(event.clientX, event.clientY)),
          );
      }}
      onPointerCancel={() => {
        if (!touch.current) return;
        stopTouchDrag();
        update(idle);
      }}
    >
      {children(gesture)}
      {ghost &&
        createPortal(
          <div
            className={cx("pricing-drag-ghost", "card")}
            style={cssVars({
              "--drag-x": `${ghost.x}px`,
              "--drag-y": `${ghost.y}px`,
            })}
            aria-hidden="true"
          >
            {displayValue(
              draft().items.find((item) => item.id === ghost.id)?.name,
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
