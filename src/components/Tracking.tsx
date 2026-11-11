import { useQuery } from "@tanstack/react-query";
import { state, partnerName } from "../engine/booking";
import { t } from "../services/i18n";
import { trackingOptions } from "../services/query";
import type { Order, TrackingInput } from "../types/domain";
import { cx } from "./primitives";
import { icon } from "./shared";

function carrierUrl(value?: string) {
  try {
    const url = new URL(value ?? "");
    if (url.protocol === "https:") return url.href;
  } catch {
    return undefined;
  }
}

export function HandoverTracking({ order }: { order: Order }) {
  const legId = order.flight.legId;
  const input: TrackingInput = {
    order: {
      id: order.id,
      legId,
      createdAt: order.createdAt || order.flight.departure,
      status: order.status,
      carrier: partnerName(order.partner),
      itemIds: order.itemIds,
    },
    handoverEvents: state.events
      .filter(
        (event) =>
          event.type === "handover" &&
          event.orderId === order.id &&
          event.legId === legId,
      )
      .map(({ type, orderId, legId, itemIds, confirmedAt }) => ({
        type,
        orderId,
        legId,
        itemIds,
        confirmedAt,
      })),
  };
  const query = useQuery(trackingOptions(input));
  const record = query.data;
  const url =
    record?.status === "ready" ? carrierUrl(record.trackingUrl) : undefined;
  return (
    <div
      id="handoverTracking"
      className={cx("handover-tracking")}
      aria-live="polite"
      aria-busy={query.isFetching}
    >
      {query.isPending ? (
        t("tracking.loading")
      ) : query.isError ? (
        <>
          <p className={cx("tracking-note")}>{t("tracking.error")}</p>
          <button
            type="button"
            className={cx("textbtn")}
            onClick={() => void query.refetch()}
          >
            {t("tracking.retry")}
          </button>
        </>
      ) : record?.status === "ready" ? (
        <>
          <div className={cx("tracking-label")}>
            <span>{t("tracking.number")}</span>
            {record.demo && (
              <span className={cx("pill gold")}>{t("common.demo")}</span>
            )}
          </div>
          <code dir="ltr">{record.trackingNumber}</code>
          <p className={cx("tracking-carrier")}>{record.carrierName}</p>
          {url ? (
            <a
              className={cx("btn slim light")}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("tracking.open")}
              {icon("arrow", "arrow")}
            </a>
          ) : (
            <p className={cx("tracking-note")}>{t("tracking.linkPending")}</p>
          )}
          {record.demo && (
            <p className={cx("tracking-note")}>{t("tracking.demoNote")}</p>
          )}
        </>
      ) : (
        t("tracking.pending")
      )}
    </div>
  );
}
