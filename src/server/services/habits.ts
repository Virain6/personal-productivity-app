import { and, eq, desc, lte, gte } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Store } from "../db/connection";
import { habits, habitRevisions, habitRecords, settings } from "../db/schema";
import type { HabitCommand } from "./habit-validation";
import { DomainError } from "./validation";
import { localDate, validDate, weekStart, addDays } from "../../lib/dates";
import {
  homeHabits,
  summarizeHabitDays,
  type HabitCalendarData,
  type HabitsData,
} from "../../lib/habit-types";
function requireHabit(s: Store, id: string, version?: number) {
  const h = s.db.select().from(habits).where(eq(habits.id, id)).get();
  if (!h) throw new DomainError("Habit not found.", 404);
  if (version !== undefined && version !== h.version)
    throw new DomainError(
      "This habit changed. Refresh and review before saving again.",
      409,
    );
  return h;
}
function current(s: Store, id: string) {
  return s.db
    .select()
    .from(habitRevisions)
    .where(eq(habitRevisions.habitId, id))
    .orderBy(desc(habitRevisions.version))
    .get()!;
}
function revisionFor(s: Store, id: string, date: string) {
  return s.db
    .select()
    .from(habitRevisions)
    .where(
      and(
        eq(habitRevisions.habitId, id),
        lte(habitRevisions.effectiveDate, date),
      ),
    )
    .orderBy(desc(habitRevisions.version))
    .get();
}
export function mutateHabit(
  s: Store,
  c: HabitCommand,
  now: number,
  timezone: string,
) {
  const today = localDate(now, timezone);
  if (c.action === "habitCreate") {
    const id = crypto.randomUUID();
    s.db
      .insert(habits)
      .values({ id, createdDate: today, createdAt: now, updatedAt: now })
      .run();
    s.db
      .insert(habitRevisions)
      .values({
        id: crypto.randomUUID(),
        habitId: id,
        version: 1,
        effectiveDate: today,
        config: c.config,
      })
      .run();
    return id;
  }
  const h = requireHabit(s, c.id, c.version);
  const latest = current(s, h.id);
  const patch: Partial<typeof habits.$inferInsert> = {
    version: h.version + 1,
    updatedAt: now,
  };
  if (c.action === "habitEdit") {
    s.db
      .insert(habitRevisions)
      .values({
        id: crypto.randomUUID(),
        habitId: h.id,
        version: h.version + 1,
        effectiveDate: today,
        config: c.config,
      })
      .run();
    if (
      c.config.kind !== latest.config.kind ||
      JSON.stringify(c.config.rotation) !==
        JSON.stringify(latest.config.rotation)
    )
      Object.assign(patch, {
        nextIndex: 0,
        nextDate: null,
        cursorVersion: h.cursorVersion + 1,
      });
  } else if (c.action === "habitArchive") patch.archived = c.archived;
  else if (c.action === "habitNext") {
    if (h.archived || latest.config.kind !== "workout")
      throw new DomainError("Restore a workout habit before planning it.");
    if (c.nextIndex >= latest.config.rotation.length)
      throw new DomainError("Choose a workout in this rotation.");
    if (c.nextDate && c.nextDate < today)
      throw new DomainError(
        "Plan the next workout for today or a future date.",
      );
    Object.assign(patch, {
      nextIndex: c.nextIndex,
      nextDate: c.nextDate,
      cursorVersion: h.cursorVersion + 1,
    });
  } else {
    if (c.date > today || c.date < h.createdDate)
      throw new DomainError("Record a date between habit creation and today.");
    const old = s.db
      .select()
      .from(habitRecords)
      .where(and(eq(habitRecords.habitId, h.id), eq(habitRecords.date, c.date)))
      .get();
    if ((old?.version ?? 0) !== c.entryVersion)
      throw new DomainError(
        "This day changed. Refresh before correcting it.",
        409,
      );
    if (h.archived && !old)
      throw new DomainError("Restore the habit before adding new entries.");
    const revision = old
      ? s.db
          .select()
          .from(habitRevisions)
          .where(eq(habitRevisions.id, old.revisionId))
          .get()
      : revisionFor(s, h.id, c.date);
    if (!revision || revision.id !== c.revisionId)
      throw new DomainError(
        "The habit settings changed. Refresh this date.",
        409,
      );
    const config = revision.config;
    if (config.kind === "quantity") {
      if (c.state !== "done" && c.state !== "unlogged")
        throw new DomainError("Save a quantity or clear its record.");
      if (c.state === "done" && c.quantity === null)
        throw new DomainError(
          "Enter the quantity; zero is a valid recorded value.",
        );
    } else if (c.quantity !== null)
      throw new DomainError("Only quantity habits accept quantities.");
    if (c.state === "rest" && config.kind !== "workout")
      throw new DomainError("Rest applies only to workouts.");
    if (config.kind === "workout" && c.state === "done" && !c.workout)
      throw new DomainError("Enter the workout actually performed.");
    if (
      config.kind === "workout" &&
      c.state === "done" &&
      c.workout.toLowerCase() === "rest"
    )
      throw new DomainError(
        "Use Record rest for a rest day; it is not a completed workout.",
      );
    let advancedFrom = old?.advancedFrom ?? null,
      advanceCursor = old?.advanceCursor ?? null;
    if (advancedFrom !== null && c.state !== "done") {
      if (h.cursorVersion !== advanceCursor)
        throw new DomainError(
          "A later workout or plan change exists. Undo of this older rotation advance is not supported yet. You can still correct the actual workout label.",
          409,
        );
      Object.assign(patch, {
        nextIndex: advancedFrom,
        nextDate: null,
        cursorVersion: h.cursorVersion + 1,
      });
      advancedFrom = null;
      advanceCursor = null;
    }
    if (c.advance) {
      if (
        config.kind !== "workout" ||
        c.state !== "done" ||
        c.date !== today ||
        revision.id !== latest.id
      )
        throw new DomainError(
          "Only today's completion under current settings can advance the rotation.",
        );
      if (!old || old.state !== "done") {
        if (h.nextDate && h.nextDate > today)
          throw new DomainError(
            "This workout is planned for a later day. Move it to today or save without advancing.",
          );
        advancedFrom = h.nextIndex;
        advanceCursor = h.cursorVersion + 1;
        Object.assign(patch, {
          nextIndex: (h.nextIndex + 1) % config.rotation.length,
          nextDate: null,
          cursorVersion: advanceCursor,
        });
      }
    }
    const values = {
      revisionId: revision.id,
      state: c.state,
      quantityMilli:
        c.state === "done" && config.kind === "quantity"
          ? Math.round(c.quantity! * 1000)
          : null,
      workout: config.kind === "workout" && c.state === "done" ? c.workout : "",
      plannedWorkout:
        old?.plannedWorkout ??
        (config.kind === "workout" ? (config.rotation[h.nextIndex] ?? "") : ""),
      advancedFrom,
      advanceCursor,
      updatedAt: now,
    };
    if (old)
      s.db
        .update(habitRecords)
        .set({ ...values, version: old.version + 1 })
        .where(eq(habitRecords.id, old.id))
        .run();
    else
      s.db
        .insert(habitRecords)
        .values({
          ...values,
          id: crypto.randomUUID(),
          habitId: h.id,
          date: c.date,
        })
        .run();
  }
  s.db.update(habits).set(patch).where(eq(habits.id, h.id)).run();
  return h.id;
}
export function getHabits(
  s: Store,
  date: string,
  now = Date.now(),
): HabitsData {
  if (!validDate(date)) throw new DomainError("Choose a valid local date.");
  return s.sqlite.transaction(() => {
    const timezone = s.db.select().from(settings).get()!.timezone;
    const today = localDate(now, timezone);
    const from = weekStart(date),
      to = addDays(from, 6);
    const records = s.db
      .select()
      .from(habitRecords)
      .where(and(gte(habitRecords.date, from), lte(habitRecords.date, to)))
      .all();
    const revisions = s.db.select().from(habitRevisions).all();
    const list = s.db
      .select()
      .from(habits)
      .all()
      .map((h) => {
        const config = current(s, h.id).config;
        const record =
          records.find((r) => r.habitId === h.id && r.date === date) ?? null;
        const rev = record
          ? revisions.find((r) => r.id === record.revisionId)
          : revisionFor(s, h.id, date);
        const cfg = rev?.config;
        const expected =
          !!cfg &&
          (cfg.schedule === "daily" ||
            (cfg.schedule === "weekdays" &&
              cfg.weekdays.includes(DateTime.fromISO(date).weekday)));
        const weekSummary = summarizeHabitDays(
          Array.from({ length: 7 }, (_, i) => {
            const day = addDays(from, i);
            const entry =
              records.find((r) => r.habitId === h.id && r.date === day) ?? null;
            const revision = entry
              ? revisions.find((r) => r.id === entry.revisionId)
              : revisionFor(s, h.id, day);
            const dayConfig = revision?.config ?? null;
            return {
              date: day,
              config: dayConfig,
              record: entry,
              expected:
                !!dayConfig &&
                (dayConfig.schedule === "daily" ||
                  (dayConfig.schedule === "weekdays" &&
                    dayConfig.weekdays.includes(
                      DateTime.fromISO(day).weekday,
                    ))),
            };
          }),
          today,
        );
        return {
          ...h,
          config,
          dateConfig: cfg ?? null,
          revisionId: rev?.id ?? null,
          record,
          expected,
          weekLogged: weekSummary.loggedDays,
          weekSummary,
        };
      });
    return {
      date,
      today,
      timezone,
      habits: list,
      history: records
        .map((r) => ({
          ...r,
          config: revisions.find((v) => v.id === r.revisionId)!.config,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  })();
}

export function getHabitCalendar(
  s: Store,
  from: string,
  to: string,
  now = Date.now(),
): HabitCalendarData {
  if (!validDate(from) || !validDate(to) || to < from || to > addDays(from, 6))
    throw new DomainError("Choose a calendar range of one to seven days.");
  return s.sqlite.transaction(() => {
    const days: HabitCalendarData["days"] = [];
    const first = getHabits(s, from, now);
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const data = date === from ? first : getHabits(s, date, now);
      days.push({ date, habits: homeHabits(data) });
    }
    return { from, to, today: first.today, timezone: first.timezone, days };
  })();
}
