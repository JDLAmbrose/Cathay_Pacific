import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ControlBar } from "./components/layout/ControlBar";
import { TopHeader } from "./components/layout/TopHeader";
import { DEFAULT_SECTOR } from "./config/sectors";
import { addHoursIso } from "./format/display";
import { I18nProvider } from "./i18n/I18nProvider";
import { useI18n } from "./i18n/useI18n";
import { MemberBoardPage } from "./members/pages/MemberBoardPage";
import { FlightDetailPage } from "./pages/FlightDetailPage";
import { OverviewPage } from "./pages/OverviewPage";
import { JsonDataSource } from "./services/dataSource";
import { useKanbanSnapshot } from "./services/useKanbanSnapshot";
import type { FeedbackEvent, LoadMetric } from "./types/kanban";
import styles from "./App.module.css";

const queryClient = new QueryClient();
const dataSource = new JsonDataSource();
const SEED_AS_OF = "2026-11-15T05:30:00+08:00";
const LIVE_TICK_HOURS = 0.25;
const LIVE_TICK_MS = 4000;

type BoardId = "cargo" | "members";

function readBoard(): BoardId {
  if (typeof window === "undefined") {
    return "cargo";
  }
  return new URLSearchParams(window.location.search).get("board") === "members" ? "members" : "cargo";
}

function KanbanShell() {
  const { t, locale } = useI18n();
  const [board, setBoard] = useState<BoardId>(readBoard);
  const [view, setView] = useState<"overview" | "detail">("overview");
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(SEED_AS_OF);
  const [windowDays, setWindowDays] = useState(2);
  const [nearHours, setNearHours] = useState(6);
  const [metric, setMetric] = useState<LoadMetric>("weight");
  const [sector, setSector] = useState<string>(DEFAULT_SECTOR);
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  const [live, setLive] = useState(true);

  useEffect(() => {
    document.title = board === "members" ? `Plume Light · ${t("mb.title")}` : t("kb.brand.title");
  }, [board, locale, t]);

  useEffect(() => {
    if (!live || board !== "cargo") {
      return;
    }
    const timer = window.setInterval(() => {
      setAsOf((current) => addHoursIso(current, LIVE_TICK_HOURS));
    }, LIVE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [live, board]);

  const selectBoard = (next: BoardId) => {
    setBoard(next);
    const url = new URL(window.location.href);
    if (next === "members") {
      url.searchParams.set("board", "members");
    } else {
      url.searchParams.delete("board");
    }
    window.history.replaceState({}, "", url);
  };
  const query = useMemo(
    () => ({ asOf, windowDays, nearHours, metric, sector, events }),
    [asOf, windowDays, nearHours, metric, sector, events],
  );
  const { viewModel, isPending, error } = useKanbanSnapshot(dataSource, query);
  const cargoFilled = events.some((event) => event.type === "CARGO_UPDATED" && event.flightId === "CX255");

  const selectFlight = (flightId: string) => {
    setSelectedFlightId(flightId);
    setView("detail");
  };

  return (
    <div className={styles.shell}>
      <TopHeader live={board === "cargo" && live} board={board} onBoardChange={selectBoard} />
      <div className={board === "members" ? styles.memberWrap : styles.wrap}>
        {board === "members" ? (
          <MemberBoardPage />
        ) : (
          <>
        <ControlBar
          asOf={asOf}
          sector={sector}
          availableSectors={viewModel?.availableSectors ?? [DEFAULT_SECTOR]}
          windowDays={windowDays}
          nearHours={nearHours}
          metric={metric}
          cargoFilled={cargoFilled}
          live={live}
          onLiveChange={setLive}
          onSectorChange={(next) => {
            setSector(next);
            setView("overview");
            setSelectedFlightId(null);
          }}
          onWindowDaysChange={setWindowDays}
          onNearHoursChange={setNearHours}
          onMetricChange={setMetric}
          onTimeStep={(hours) => setAsOf((current) => addHoursIso(current, hours))}
          onFillCargo={() =>
            setEvents((current) => [
              ...current,
              { type: "CARGO_UPDATED", flightId: "CX255", cargoKg: 14000, cargoM3: 87.5 },
            ])
          }
        />
        {error ? <p className={styles.error}>{error.message}</p> : null}
        {isPending || !viewModel ? (
          <p className={styles.note}>…</p>
        ) : view === "detail" && selectedFlightId ? (
          <FlightDetailPage
            viewModel={viewModel}
            flightId={selectedFlightId}
            onBack={() => setView("overview")}
          />
        ) : (
          <OverviewPage
            viewModel={viewModel}
            metric={metric}
            selectedFlightId={selectedFlightId}
            onSelectFlight={selectFlight}
            live={live}
          />
        )}
        <p className={styles.disclaimer}>
          {t("kb.staffOnly")} · {t("kb.noAutoSale")} · {t("kb.demo.data")}
        </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <KanbanShell />
      </I18nProvider>
    </QueryClientProvider>
  );
}
