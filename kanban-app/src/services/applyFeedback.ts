import type { FeedbackEvent, RawFlight, RawKanbanSnapshot } from "../types/kanban";

function replaceFlight(
  snapshot: RawKanbanSnapshot,
  flightId: string,
  update: (flight: RawFlight) => RawFlight,
): RawKanbanSnapshot {
  return {
    ...snapshot,
    flights: snapshot.flights.map((flight) => (flight.id === flightId ? update(flight) : flight)),
  };
}

export function applyFeedback(
  snapshot: RawKanbanSnapshot,
  event: FeedbackEvent,
): RawKanbanSnapshot {
  switch (event.type) {
    case "TIME_TICK":
      return { ...snapshot, asOf: event.asOf };
    case "PLUME_DECLARED":
      return replaceFlight(snapshot, event.flightId, (flight) => {
        const remaining = flight.plumeBags.filter((bag) => bag.bagId !== event.bag.bagId);
        return { ...flight, plumeBags: [...remaining, event.bag] };
      });
    case "BAG_ARRIVED_EARLY":
      return replaceFlight(snapshot, event.flightId, (flight) => ({
        ...flight,
        plumeBags: flight.plumeBags.map((bag) =>
          bag.bagId === event.bagId ? { ...bag, state: "arrived" } : bag,
        ),
      }));
    case "CARGO_UPDATED":
      return replaceFlight(snapshot, event.flightId, (flight) => ({
        ...flight,
        cargoKg: event.cargoKg,
        cargoM3: event.cargoM3,
      }));
    case "CAP_OVERRIDDEN":
      return replaceFlight(snapshot, event.flightId, (flight) => ({
        ...flight,
        capOverride: { capKg: event.override.capKg, capM3: event.override.capM3 },
      }));
  }
}

export function applyFeedbackEvents(
  snapshot: RawKanbanSnapshot,
  events: readonly FeedbackEvent[],
): RawKanbanSnapshot {
  return events.reduce(applyFeedback, snapshot);
}
