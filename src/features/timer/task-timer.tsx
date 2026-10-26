"use client";
import { Play, Pause } from "lucide-react";
import type { Task } from "@/lib/planner-types";
import { useTimer } from "./timer-provider";
export function TaskTimer({ task }: { task: Task }) {
  const timer = useTimer();
  const active = timer.running?.taskId === task.id;
  return (
    <button
      className={`flex size-11 items-center justify-center rounded-lg hover:bg-elevated disabled:opacity-40 ${active ? "text-success" : "text-accent-hover"}`}
      disabled={
        timer.busy || task.status === "done" || task.status === "skipped"
      }
      aria-label={`${active ? "Pause" : "Start timer for"} ${task.title}`}
      onClick={() =>
        void (active ? timer.pause() : timer.start(task.id)).catch(() => {})
      }
    >
      {active ? <Pause size={16} /> : <Play size={16} />}
    </button>
  );
}
