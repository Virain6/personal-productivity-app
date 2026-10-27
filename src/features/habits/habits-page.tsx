"use client";
import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHabits } from "./use-habits";
import { localDate, addDays, weekStart } from "@/lib/dates";
import { habitResult, type HabitView } from "@/lib/habit-types";
import { HabitEditor } from "./habit-editor";
import { HabitCard } from "./habit-card";
export function HabitsPage() {
  const [date, setDate] = useState(localDate);
  const { data, error, reload } = useHabits(date);
  const [archived, setArchived] = useState(false);
  const [editor, setEditor] = useState<HabitView | null | undefined>(undefined);
  const list = data?.habits.filter((h) => h.archived === archived) ?? [];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[.16em] text-muted">
            Small actions, your pace
          </p>
          <h1 className="text-2xl font-semibold">Habits</h1>
          <p className="mt-2 text-sm text-muted">
            Record what happened. Shape a routine that fits.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={!data}
          onClick={() => setEditor(null)}
        >
          <Plus size={16} />
          Create habit
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Button
          aria-label="Previous habit day"
          onClick={() => setDate((d) => addDays(d, -1))}
        >
          <ChevronLeft size={16} />
        </Button>
        <label className="min-w-0">
          Record date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <Button
          aria-label="Next habit day"
          onClick={() => setDate((d) => addDays(d, 1))}
        >
          <ChevronRight size={16} />
        </Button>
        <Button onClick={() => setDate(data?.today ?? localDate())}>
          Today
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted">
        {data?.timezone ?? "America/Toronto"} · Entries belong to the selected
        local date.
      </p>
      <div role="group" aria-label="Habit list" className="mb-4 flex gap-2">
        <Button aria-pressed={!archived} onClick={() => setArchived(false)}>
          Active
        </Button>
        <Button aria-pressed={archived} onClick={() => setArchived(true)}>
          Archived
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger/40 p-3 text-danger"
        >
          {error} Saved records are preserved.{" "}
          <Button onClick={() => reload()}>Retry</Button>
        </div>
      )}
      {!data && !error && (
        <p role="status" className="p-8 text-muted">
          Loading habits…
        </p>
      )}
      {data && (
        <>
          {date > data.today && (
            <p className="mb-4 text-sm text-muted">
              Future date · plan ahead, then record progress when the day
              arrives.
            </p>
          )}
          {list.length ? (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {list.map((h) => (
                <HabitCard
                  key={`${h.id}:${date}`}
                  habit={h}
                  date={date}
                  today={data.today}
                  onEdit={() => setEditor(h)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
              {archived
                ? "No archived habits. Archived records remain available here."
                : "No active habits yet. Create your first habit to get started."}
            </div>
          )}
          <section
            className="mt-8 border-t border-border pt-5"
            aria-label="Habit history"
          >
            <h2 className="text-base font-medium">
              History · week of {weekStart(date)}
            </h2>
            <p className="mt-2 text-xs text-muted">
              Choose any date above to record or correct it. Saved entries
              retain the settings used when recorded.
            </p>
            <ul className="mt-4 space-y-2">
              {data.history.length ? (
                data.history.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 break-words rounded-lg bg-surface p-3"
                  >
                    <div>
                      <p className="text-sm">
                        {r.config.name} · {r.date}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {habitResult(r.config, r)}
                        {r.workout ? ` · Actual: ${r.workout}` : ""}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setDate(r.date);
                        setArchived(
                          data.habits.find((h) => h.id === r.habitId)
                            ?.archived ?? false,
                        );
                      }}
                    >
                      View day
                    </Button>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted">No records in this week.</li>
              )}
            </ul>
          </section>
        </>
      )}
      {editor !== undefined && (
        <HabitEditor
          habit={editor}
          onClose={() => {
            setEditor(undefined);
            reload();
          }}
        />
      )}
    </>
  );
}
