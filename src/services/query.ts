import {
  MutationObserver,
  QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { dataSource } from "./dataSource";
import type {
  AssistantInput,
  AssistantReply,
  TrackingInput,
} from "../types/domain";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export const assistantStatusOptions = () =>
  queryOptions({
    queryKey: ["assistant", "status"],
    queryFn: ({ signal }) =>
      dataSource.assistantStatus(
        AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      ),
    staleTime: 30_000,
  });

export const trackingOptions = (input: TrackingInput) =>
  queryOptions({
    queryKey: ["handover", input],
    queryFn: ({ signal }) => dataSource.lookupTracking(input, signal),
    staleTime: 30_000,
  });

export function requestAssistantReply(
  input: AssistantInput,
  signal: AbortSignal,
) {
  const request = new MutationObserver<AssistantReply, Error, AssistantInput>(
    queryClient,
    {
      mutationFn: (payload) => dataSource.askAssistant(payload, signal),
    },
  );
  return request.mutate(input);
}
