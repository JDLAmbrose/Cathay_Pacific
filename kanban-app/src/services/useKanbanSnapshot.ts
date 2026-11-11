import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { evaluateSnapshot } from "../engine/evaluateSnapshot";
import type {
  FeedbackEvent,
  LoadMetric,
  RawKanbanSnapshot,
  SnapshotViewModel,
} from "../types/kanban";
import { applyFeedbackEvents } from "./applyFeedback";
import type { KanbanDataSource } from "./dataSource";

export interface KanbanQueryState {
  asOf: string;
  windowDays: number;
  nearHours: number;
  metric: LoadMetric;
  sector: string;
  events: readonly FeedbackEvent[];
}

export interface KanbanSnapshotHookResult {
  viewModel: SnapshotViewModel | null;
  rawSnapshot: RawKanbanSnapshot | null;
  isPending: boolean;
  error: Error | null;
}

export function useKanbanSnapshot(
  dataSource: KanbanDataSource,
  query: KanbanQueryState,
): KanbanSnapshotHookResult {
  const result = useQuery({
    queryKey: ["kanban-snapshot"],
    queryFn: () => dataSource.fetchSnapshot({}),
  });
  const viewModel = useMemo(() => {
    if (!result.data) {
      return null;
    }
    const withEvents = applyFeedbackEvents(result.data, query.events);
    const snapshot: RawKanbanSnapshot = {
      ...withEvents,
      asOf: query.asOf,
      windowDays: query.windowDays,
      nearHours: query.nearHours,
    };
    return evaluateSnapshot(snapshot, query.asOf, query.sector);
  }, [result.data, query.asOf, query.windowDays, query.nearHours, query.sector, query.events]);

  return {
    viewModel,
    rawSnapshot: result.data ?? null,
    isPending: result.isPending,
    error: result.error instanceof Error ? result.error : result.error ? new Error("snapshot failed") : null,
  };
}
