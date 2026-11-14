import demo from "../config/demo.json";
import { readAssistantStream, validateAssistantReply } from "./assistantStream";
import type {
  BookingState,
  DataSource,
  TrackingRecord,
} from "../types/domain";

export const BOOKING_KEY = "plume-light-multipage-v2";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => {
    throw new Error("provider_unavailable");
  });
  if (!response.ok)
    throw new Error(
      typeof data?.error === "string" ? data.error : "provider_unavailable",
    );
  return data as T;
}

function post(body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  };
}

export const browserDataSource: DataSource = {
  loadDemo: () => structuredClone(demo) as BookingState,
  readBooking: () =>
    typeof window === "undefined"
      ? null
      : JSON.parse(window.localStorage.getItem(BOOKING_KEY) ?? "null"),
  saveBooking: (state) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(BOOKING_KEY, JSON.stringify(state));
  },
  assistantStatus: (signal) => request("/api/assistant/status", { signal }),
  askAssistant: async (input, signal, onProgress) => {
    const response = await fetch("/api/assistant/chat", {
      ...post(input, signal),
      headers: { "Content-Type": "application/json", Accept: onProgress ? "text/event-stream" : "application/json" },
    });
    if (response.ok && onProgress && response.headers.get("Content-Type")?.includes("text/event-stream"))
      return readAssistantStream(response, onProgress, signal);
    const data = await response.json().catch(() => { throw new Error("provider_unavailable"); });
    if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "provider_unavailable");
    return validateAssistantReply(data);
  },
  lookupTracking: async (input, signal) => {
    const data = await request<TrackingRecord>(
      "/api/handover/tracking",
      post(input, signal),
    );
    if (
      data.status === "pending" ||
      (data.status === "ready" &&
        typeof data.trackingNumber === "string" &&
        typeof data.carrierName === "string")
    )
      return data;
    throw new Error("Invalid tracking response");
  },
};

export let dataSource = browserDataSource;
export function setDataSource(source: DataSource) {
  dataSource = source;
}
