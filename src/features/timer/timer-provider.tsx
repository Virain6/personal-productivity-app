"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@/lib/planner-types";
import { loadJson, sendCommand } from "@/lib/api";
import { clockDuration } from "@/lib/dates";
import { Pause, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
type Running = Session & { title: string; taskVersion: number };
type Clock = {
  running: Running | null;
  now: number;
  error: string;
  busy: boolean;
  start: (id: string) => Promise<void>;
  pause: () => Promise<void>;
  finish: () => void;
};
const TimerContext = createContext<Clock | null>(null);
export function useTimer() {
  const value = useContext(TimerContext);
  if (!value) throw new Error("TimerProvider missing");
  return value;
}
export function TimerProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<{
    running: Running | null;
    serverNow: number;
    received: number;
  } | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [finishTarget, setFinishTarget] = useState<Running | null>(null);
  const [switchTarget, setSwitchTarget] = useState<{
    sessionId: string;
    id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    let active = true;
    let seq = 0;
    const controller = new AbortController();
    async function refresh() {
      const ticket = ++seq;
      try {
        const value = await loadJson<{
          running: Running | null;
          serverNow: number;
        }>("/api/planner?view=timer", controller.signal);
        if (active && seq === ticket) {
          setSnapshot({ ...value, received: performance.now() });
          setNow(value.serverNow);
          setConnectionError("");
        }
      } catch (e) {
        if (active && seq === ticket)
          setConnectionError(
            e instanceof Error ? e.message : "Timer is disconnected.",
          );
      }
    }
    const refreshEvent = () => void refresh();
    void refresh();
    const poll = setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refreshEvent);
    window.addEventListener("online", refreshEvent);
    window.addEventListener("planner:changed", refreshEvent);
    return () => {
      active = false;
      controller.abort();
      clearInterval(poll);
      window.removeEventListener("focus", refreshEvent);
      window.removeEventListener("online", refreshEvent);
      window.removeEventListener("planner:changed", refreshEvent);
    };
  }, []);
  useEffect(() => {
    if (!snapshot?.running) return;
    const interval = setInterval(
      () => setNow(snapshot.serverNow + performance.now() - snapshot.received),
      1000,
    );
    return () => clearInterval(interval);
  }, [snapshot]);
  async function action(command: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await sendCommand(command);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Timer change was not saved.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const running = snapshot?.running ?? null;
  async function start(id: string) {
    if (running && running.taskId !== id) {
      setError("");
      setSwitchTarget({ sessionId: running.id, id });
      return;
    }
    await action({ action: "start", id });
  }
  async function pause() {
    if (running) await action({ action: "stop", sessionId: running.id });
  }
  function finish() {
    setError("");
    setFinishTarget(running);
    setSummary("");
    setComplete(false);
    setFinishOpen(true);
  }
  async function save() {
    if (!finishTarget) return;
    try {
      await action({
        action: "stop",
        sessionId: finishTarget.id,
        summary,
        complete,
        version: finishTarget.taskVersion,
      });
      setFinishOpen(false);
    } catch {}
  }
  return (
    <TimerContext.Provider
      value={{
        running,
        now,
        error: error || connectionError,
        busy,
        start,
        pause,
        finish,
      }}
    >
      {children}
      {(running || error || connectionError) && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-3 right-3 z-20 rounded-xl border border-accent/35 bg-surface p-3 shadow-lg md:bottom-5 md:left-auto md:w-[440px]">
          <div className="flex items-center gap-3">
            <Timer size={18} className="shrink-0 text-accent-hover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">{running?.title ?? "Timer"}</p>
              {running && (
                <p className="numeric mt-1 text-lg font-medium">
                  {clockDuration(now - running.startedAt)}
                </p>
              )}
            </div>
            {running && (
              <>
                <Button
                  disabled={busy}
                  onClick={() => void pause().catch(() => {})}
                  aria-label="Pause active timer"
                >
                  <Pause size={16} />
                </Button>
                <Button
                  disabled={busy}
                  onClick={finish}
                  aria-label="Finish active timer"
                >
                  <Square size={15} />
                </Button>
              </>
            )}
          </div>
          {running && now - running.startedAt > 8 * 3600000 && (
            <p className="mt-2 text-xs text-warning">
              This timer has run over 8 hours. Review the recorded time before
              using it in your totals.
            </p>
          )}
          {(error || connectionError) && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error || connectionError}
              {error && (
                <Button variant="ghost" onClick={() => setError("")}>
                  Dismiss
                </Button>
              )}
            </p>
          )}
        </div>
      )}
      <Dialog
        open={finishOpen}
        onOpenChange={(open) => {
          if (!busy) setFinishOpen(open);
        }}
        title="Finish your session"
        description="Review your time. Saving does not automatically complete the activity."
      >
        <p className="numeric mb-4 text-2xl">
          {finishTarget && running?.id === finishTarget.id
            ? clockDuration(now - finishTarget.startedAt)
            : "Session already stopped"}
        </p>
        <p className="mb-3 text-sm">{finishTarget?.title}</p>
        <label>
          What did you work on?
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </label>
        <label className="my-4 flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={complete}
            onChange={(e) => setComplete(e.target.checked)}
          />
          Also mark the activity complete
        </label>
        {error && (
          <p role="alert" className="mb-3 text-danger">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          disabled={busy || !finishTarget}
          onClick={() => void save()}
        >
          Save session
        </Button>
      </Dialog>
      <Dialog
        open={switchTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSwitchTarget(null);
        }}
        title="Switch your focus?"
        description="Save the current session and start the selected activity. Neither activity is marked complete."
      >
        {error && (
          <p role="alert" className="mb-3 text-danger">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            if (switchTarget)
              void action({ action: "switch", ...switchTarget })
                .then(() => setSwitchTarget(null))
                .catch(() => {});
          }}
        >
          Stop current and start selected
        </Button>
      </Dialog>
    </TimerContext.Provider>
  );
}
