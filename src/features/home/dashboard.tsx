"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DateTime } from "luxon";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  CheckCheck,
  Clock3,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "./task-dialog";
import { TaskTimer } from "@/features/timer/task-timer";
import { SessionLog } from "@/features/timer/session-log";
import { TaskCard } from "./task-card";
import { addDays, weekStart, localDate, formatDuration } from "@/lib/dates";
import { loadJson, sendCommand } from "@/lib/api";
import type { HomeData, Task } from "@/lib/planner-types";
function subscribeView(callback: () => void) {
  window.addEventListener("resize", callback);
  window.addEventListener("storage", callback);
  window.addEventListener("planner:view", callback);
  return () => {
    window.removeEventListener("resize", callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener("planner:view", callback);
  };
}
function viewSnapshot(): "day" | "week" {
  try {
    const saved = localStorage.getItem("planner.view.v1");
    if (saved === "day" || saved === "week") return saved;
  } catch {}
  return window.matchMedia("(min-width:1024px)").matches ? "week" : "day";
}
export function Dashboard() {
  const [date, setDate] = useState(() => localDate());
  const view = useSyncExternalStore(subscribeView, viewSnapshot, () => "day");
  const [loaded, setLoaded] = useState<{
    start: string;
    data: HomeData;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Task | null | undefined>(undefined);
  const start = weekStart(date);
  const end = addDays(start, 6);
  const data = loaded?.start === start ? loaded.data : null;
  const loading = !data && !error;
  const touch = useRef<{ x: number; y: number } | null>(null);
  function reload() {
    window.dispatchEvent(new Event("planner:changed"));
  }
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const controller = new AbortController();
    async function refresh() {
      const ticket = ++sequence;
      try {
        const result = await loadJson<HomeData>(
          `/api/planner?from=${start}&to=${end}`,
          controller.signal,
        );
        if (active && ticket === sequence) {
          setLoaded({ start, data: result });
          setError("");
        }
      } catch (e) {
        if (active && ticket === sequence)
          setError(e instanceof Error ? e.message : "Could not connect.");
      }
    }
    void refresh();
    const refreshEvent = () => void refresh();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    window.addEventListener("focus", refreshEvent);
    window.addEventListener("online", refreshEvent);
    window.addEventListener("planner:changed", refreshEvent);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", refreshEvent);
      window.removeEventListener("online", refreshEvent);
      window.removeEventListener("planner:changed", refreshEvent);
    };
  }, [start, end]);
  async function complete(task: Task) {
    setBusy(true);
    setError("");
    try {
      await sendCommand({
        action: "status",
        id: task.id,
        version: task.version,
        status: task.status === "done" ? "pending" : "done",
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  function changeView(v: "day" | "week") {
    try {
      localStorage.setItem("planner.view.v1", v);
    } catch {}
    window.dispatchEvent(new Event("planner:view"));
  }
  function navigate(direction: number) {
    setDate((d) => addDays(d, direction * (view === "week" ? 7 : 1)));
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = data?.today ?? localDate();
  const selectedStats = data?.metrics.days.find((d) => d.date === date);
  const percent = selectedStats?.required
    ? Math.round((selectedStats.done / selectedStats.required) * 100)
    : 0;
  function agenda(day: string) {
    const list =
      data?.tasks
        .filter((t) => t.plannedDate === day)
        .sort(
          (a, b) =>
            Number(a.status === "done" || a.status === "skipped") -
              Number(b.status === "done" || b.status === "skipped") ||
            (a.suggestedTime ?? "99").localeCompare(b.suggestedTime ?? "99") ||
            a.category.localeCompare(b.category),
        ) ?? [];
    return (
      <div className="space-y-2">
        {list.length ? (
          list.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              timezone={data!.timezone}
              onOpen={() => setSelected(task)}
              busy={busy}
              onComplete={() => void complete(task)}
            >
              <TaskTimer task={task} />
            </TaskCard>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border px-3 py-7 text-center text-xs leading-relaxed text-muted">
            Room to breathe.
            <br />
            No activities planned.
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[.16em] text-muted">
            Make space for progress
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your week, at your pace.
          </h1>
          <p className="mt-2 text-sm text-muted">
            A plan to guide you. Flexibility to make it yours.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setSelected(null)}
          disabled={!data}
        >
          <Plus size={16} />
          Add activity
        </Button>
      </div>
      <section aria-label="Planner">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              aria-label={`Previous ${view}`}
            >
              <ChevronLeft size={17} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(1)}
              aria-label={`Next ${view}`}
            >
              <ChevronRight size={17} />
            </Button>
            <h2 className="min-w-36 text-sm font-medium">
              {view === "week"
                ? `${DateTime.fromISO(start).toFormat("MMM d")} – ${DateTime.fromISO(end).toFormat("MMM d, yyyy")}`
                : DateTime.fromISO(date).toFormat("ccc, MMM d, yyyy")}
            </h2>
            <Button onClick={() => setDate(today)}>Today</Button>
          </div>
          <div
            role="group"
            aria-label="Calendar view"
            className="flex rounded-lg border border-border p-1"
          >
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className={`min-h-9 rounded-md px-4 text-xs capitalize ${view === v ? "bg-elevated text-foreground" : "text-muted"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4 flex items-center gap-2 text-xs text-muted">
          <CalendarDays size={14} />
          <span>
            {data?.timezone ?? "America/Toronto"} · Suggested times are flexible
          </span>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-surface p-3 text-danger"
          >
            <span>{error} Your last saved data is preserved.</span>
            <Button onClick={() => void reload()}>Retry</Button>
          </div>
        )}
        {loading && !data ? (
          <div
            role="status"
            className="rounded-xl border border-border p-10 text-muted"
          >
            Loading your schedule…
          </div>
        ) : (
          data && (
            <>
              <div className={view === "week" ? "hidden lg:block" : "hidden"}>
                <div className="calendar gap-2">
                  {days.map((day) => (
                    <section
                      key={day}
                      aria-label={day}
                      className={`min-w-0 rounded-xl p-1.5 ${day === today ? "bg-accent/5 ring-1 ring-accent/25" : ""}`}
                    >
                      <div className="mb-4 flex items-center justify-between px-1">
                        <span className="text-[11px] uppercase tracking-wider text-muted">
                          {DateTime.fromISO(day).toFormat("ccc")}
                        </span>
                        <span
                          className={`numeric flex size-7 items-center justify-center rounded-full text-sm ${day === today ? "bg-accent text-background font-semibold" : "text-muted"}`}
                        >
                          {DateTime.fromISO(day).day}
                        </span>
                      </div>
                      {agenda(day)}
                    </section>
                  ))}
                </div>
              </div>
              <div className={view === "week" ? "lg:hidden" : ""}>
                <div className="mb-4 grid grid-cols-7 gap-1">
                  {days.map((day) => (
                    <button
                      key={day}
                      onClick={() => setDate(day)}
                      aria-label={DateTime.fromISO(day).toFormat(
                        "cccc, MMMM d",
                      )}
                      aria-pressed={day === date}
                      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs ${day === date ? "bg-accent/20 text-accent-hover" : "text-muted hover:bg-elevated"}`}
                    >
                      <span>{DateTime.fromISO(day).toFormat("ccc")}</span>
                      <span className="numeric">
                        {DateTime.fromISO(day).day}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-medium">
                    {DateTime.fromISO(date).toFormat("cccc, MMMM d")}
                  </h3>
                  <span className="text-xs text-muted">
                    {selectedStats?.done ?? 0}/{selectedStats?.required ?? 0}{" "}
                    required · {percent}%
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted">
                  {formatDuration(selectedStats?.trackedMs ?? 0)} recorded this
                  day
                </p>
                <progress
                  aria-label="Daily completion"
                  value={percent}
                  max={100}
                  className="mb-5 h-1 w-full accent-accent"
                />
                <div
                  style={{ touchAction: "pan-y" }}
                  onTouchStart={(event) => {
                    if (
                      (event.target as HTMLElement).closest(
                        "button,a,input,select,textarea",
                      )
                    )
                      return;
                    touch.current = {
                      x: event.touches[0].clientX,
                      y: event.touches[0].clientY,
                    };
                  }}
                  onTouchEnd={(event) => {
                    if (!touch.current) return;
                    const dx =
                      event.changedTouches[0].clientX - touch.current.x;
                    const dy =
                      event.changedTouches[0].clientY - touch.current.y;
                    touch.current = null;
                    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5)
                      setDate((d) => addDays(d, dx < 0 ? 1 : -1));
                  }}
                >
                  {agenda(date)}
                </div>
              </div>
            </>
          )
        )}
      </section>
      {data && (
        <section
          aria-label="This week at a glance"
          className="mt-8 border-t border-border pt-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">This week at a glance</h2>
            <span className="text-xs text-muted">Saved activity only</span>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              {
                label: "Completed",
                value: String(data.metrics.completed),
                detail: "activities this week",
                icon: CheckCheck,
              },
              {
                label: "Recorded time",
                value: formatDuration(data.metrics.trackedMs),
                detail: "closed sessions this week",
                icon: Clock3,
              },
              {
                label: "Required progress",
                value: data.metrics.required
                  ? `${Math.round((data.metrics.requiredDone / data.metrics.required) * 100)}%`
                  : "—",
                detail: "through today · optional excluded",
                icon: Target,
              },
              {
                label: "Planned / recorded",
                value: `${formatDuration(data.metrics.plannedMinutes * 60000)} / ${formatDuration(data.metrics.trackedMs)}`,
                detail: "required plan / all recorded time",
                icon: CalendarDays,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-border bg-surface/50 p-4"
              >
                <div className="flex items-center gap-2 text-xs text-muted">
                  <metric.icon size={14} />
                  {metric.label}
                </div>
                <p className="numeric mt-3 text-xl font-medium">
                  {metric.value}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>
          {data.metrics.trackedMs === 0 && (
            <p className="mt-4 text-xs text-muted">
              Your first recorded session will start your time history.
            </p>
          )}
          <div className="mt-6 rounded-lg border border-dashed border-border p-4 text-xs text-muted">
            Habits and longer-term trends will join this space in a later
            sprint.
          </div>
        </section>
      )}
      {selected !== undefined && (
        <TaskDialog
          key={selected?.id ?? "new"}
          task={selected}
          date={date}
          timezone={data?.timezone ?? "America/Toronto"}
          onClose={() => {
            setSelected(undefined);
            void reload();
          }}
        >
          {selected && data && (
            <SessionLog
              task={data.tasks.find((t) => t.id === selected.id) ?? selected}
              sessions={data.sessions.filter((s) => s.taskId === selected.id)}
              timezone={data.timezone}
              onSaved={reload}
            />
          )}
        </TaskDialog>
      )}
    </>
  );
}
