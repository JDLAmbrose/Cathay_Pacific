import { DEFAULT_PLUME_BAG_M3, TRAVELLER_STATE_KEY } from "../config/thresholds";
import type {
  CapacityOverrideInput,
  FeedbackEvent,
  KanbanDataSource as KanbanDataSourceContract,
  PlumeBag,
  RawKanbanSnapshot,
  SnapshotQueryParams,
} from "../types/kanban";
import { parseKanbanSnapshot } from "./schema";

export type { KanbanDataSourceContract as KanbanDataSource };


type TravellerItem = {
  id?: string;
  weight?: number | null;
  l?: number | null;
  w?: number | null;
  h?: number | null;
  mode?: string;
  carriage?: string;
  service?: boolean;
};

type TravellerDeclaration = {
  status?: string;
  legId?: string;
  flightNo?: string;
  countUnknown?: boolean;
  zero?: boolean;
  items?: TravellerItem[];
};

type TravellerState = {
  schema?: number;
  flight?: { flightNo?: string; legId?: string };
  declarations?: Record<string, TravellerDeclaration>;
  orders?: Array<{
    status?: string;
    flight?: { flightNo?: string; legId?: string };
    transport?: string;
    itemIds?: string[];
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTravellerState(): TravellerState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(TRAVELLER_STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schema !== 1) {
      return null;
    }
    return parsed as TravellerState;
  } catch {
    return null;
  }
}

function isCx257Declaration(declaration: TravellerDeclaration, state: TravellerState): boolean {
  const flightNo = declaration.flightNo ?? state.flight?.flightNo;
  const legId = declaration.legId ?? state.flight?.legId ?? "";
  return flightNo === "CX257" || legId.startsWith("CX257");
}

function cargoItemIds(state: TravellerState): Set<string> {
  const ids = new Set<string>();
  for (const order of state.orders ?? []) {
    if (order.status === "cancelled") {
      continue;
    }
    const flightNo = order.flight?.flightNo;
    const legId = order.flight?.legId ?? "";
    if (flightNo !== "CX257" && !legId.startsWith("CX257")) {
      continue;
    }
    if (order.transport === "cargo") {
      for (const itemId of order.itemIds ?? []) {
        ids.add(itemId);
      }
    }
  }
  return ids;
}

export function overlaySubmittedCx257Bags(snapshot: RawKanbanSnapshot): RawKanbanSnapshot {
  const state = readTravellerState();
  if (!state?.declarations) {
    return snapshot;
  }
  const cargoIds = cargoItemIds(state);
  const bags: PlumeBag[] = [];
  for (const declaration of Object.values(state.declarations)) {
    if (declaration.status !== "submitted" || declaration.countUnknown || declaration.zero) {
      continue;
    }
    if (!isCx257Declaration(declaration, state)) {
      continue;
    }
    for (const item of declaration.items ?? []) {
      if (item.mode !== "checked") {
        continue;
      }
      if (item.weight == null) {
        continue;
      }
      const hasSize = item.l != null && item.w != null && item.h != null;
      bags.push({
        bagId: String(item.id ?? `cx257-${bags.length + 1}`),
        kg: Number(item.weight),
        m3: hasSize ? (Number(item.l) * Number(item.w) * Number(item.h)) / 1e6 : DEFAULT_PLUME_BAG_M3,
        mode: item.carriage === "cargo" || cargoIds.has(String(item.id)) ? "cargo" : "on_flight",
        state: "staged",
      });
    }
  }
  if (bags.length === 0) {
    return snapshot;
  }
  return {
    ...snapshot,
    flights: snapshot.flights.map((flight) =>
      flight.id === "CX257" ? { ...flight, plumeBags: bags } : flight,
    ),
  };
}

export class JsonDataSource implements KanbanDataSourceContract {
  private readonly listeners = new Set<(event: FeedbackEvent) => void>();

  async fetchSnapshot(_params: SnapshotQueryParams): Promise<RawKanbanSnapshot> {
    const response = await fetch(`${import.meta.env.BASE_URL}data/kanban-snapshot.json`);
    if (!response.ok) {
      throw new Error(`Failed to load kanban snapshot (${response.status})`);
    }
    const parsed = parseKanbanSnapshot(await response.json());
    return overlaySubmittedCx257Bags(parsed);
  }

  async overrideFlightCapacity(flightId: string, override: CapacityOverrideInput): Promise<void> {
    this.emit({ type: "CAP_OVERRIDDEN", flightId, override });
  }

  subscribeFeedback(onEvent: (event: FeedbackEvent) => void): () => void {
    this.listeners.add(onEvent);
    return () => {
      this.listeners.delete(onEvent);
    };
  }

  emit(event: FeedbackEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

/*
 * Later M4: class DjangoApiDataSource implements KanbanDataSource {
 *   fetchSnapshot → GET /api/v1/kanban/snapshot
 *   overrideFlightCapacity → PATCH /api/v1/kanban/flights/{id}/capacity
 *   subscribeFeedback → GET /api/v1/kanban/stream (SSE)
 * }
 */
