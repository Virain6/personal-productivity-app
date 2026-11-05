"use client";
import { useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { monthGrid, monthTaskColor, moveCalendar } from "@/lib/month-calendar";
import { usePlannerQuery } from "@/lib/use-planner-query";
import type { HomeData } from "@/lib/planner-types";
export function MonthPicker({
  date,
  today,
  onSelect,
  onClose,
}: {
  date: string;
  today: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(date);
  const grid = monthGrid(month);
  const { data, error, reload } = usePlannerQuery<HomeData>(
    `/api/planner?from=${grid.from}&to=${grid.to}`,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Choose a date"
      description="Select a day to see its activities."
      layout="calendar"
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <Button
          aria-label="Previous month"
          variant="ghost"
          onClick={() => setMonth(moveCalendar(month, "month", -1))}
        >
          <ChevronLeft size={18} />
        </Button>
        <h3 aria-live="polite" className="text-sm font-medium">
          {DateTime.fromISO(month).toFormat("MMMM yyyy")}
        </h3>
        <Button
          aria-label="Next month"
          variant="ghost"
          onClick={() => setMonth(moveCalendar(month, "month", 1))}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <div className="grid grid-cols-7" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="py-2 text-center text-xs text-muted">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7" aria-label="Choose calendar day">
        {grid.days.map((day) => {
          const tasks = data?.tasks.filter((t) => t.plannedDate === day) ?? [];
          const colors = [...new Set(tasks.map(monthTaskColor))].slice(0, 3);
          return (
            <button
              key={day}
              type="button"
              aria-label={`${DateTime.fromISO(day).toFormat("cccc, MMMM d, yyyy")}${data ? ` · ${tasks.length} activities` : ""}`}
              aria-pressed={day === date}
              aria-current={day === today ? "date" : undefined}
              onClick={() => onSelect(day)}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg text-sm ${day === date ? "bg-accent/20 text-accent-hover ring-1 ring-inset ring-accent" : "hover:bg-elevated"} ${!day.startsWith(grid.month) ? "text-muted" : ""}`}
            >
              <span
                className={
                  day === today
                    ? "font-semibold underline decoration-accent decoration-2 underline-offset-4"
                    : ""
                }
              >
                {DateTime.fromISO(day).day}
              </span>
              <span aria-hidden="true" className="mt-1 flex h-1 gap-1">
                {colors.map((color) => (
                  <span
                    key={color}
                    className="size-1 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          Activity indicators unavailable.{" "}
          <Button onClick={reload}>Retry</Button>
        </p>
      ) : (
        <p role="status" className="mt-3 text-xs text-muted">
          {data
            ? "Dots show scheduled activities in their roadmap colors."
            : "Loading activity indicators…"}
        </p>
      )}
      <Button className="mt-3 w-full" onClick={() => onSelect(today)}>
        Go to today
      </Button>
    </Dialog>
  );
}
