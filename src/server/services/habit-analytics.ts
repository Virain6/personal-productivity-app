import { and, gte, lte, asc } from "drizzle-orm";
import type { Store } from "../db/connection";
import { habits, habitRecords, habitRevisions } from "../db/schema";
import { addDays } from "../../lib/dates";
import {
  expectedHabitDate,
  summarizeHabitActivity,
} from "../../lib/activity-analytics";
import type { AnalyticsRange } from "../../lib/analytics-types";
export function getHabitAnalytics(
  store: Store,
  range: AnalyticsRange,
  today: string,
) {
  const list = store.db.select().from(habits).all();
  const revisions = store.db
    .select()
    .from(habitRevisions)
    .orderBy(asc(habitRevisions.version))
    .all();
  const records = store.db
    .select()
    .from(habitRecords)
    .where(
      and(gte(habitRecords.date, range.from), lte(habitRecords.date, range.to)),
    )
    .all();
  const revisionById = new Map(revisions.map((r) => [r.id, r]));
  return list.map((habit) => {
    const configs = revisions.filter((r) => r.habitId === habit.id);
    const entries = new Map(
      records.filter((r) => r.habitId === habit.id).map((r) => [r.date, r]),
    );
    const days = [];
    for (let date = range.from; date <= range.to; date = addDays(date, 1)) {
      const record = entries.get(date) ?? null;
      const revision = record
        ? revisionById.get(record.revisionId)
        : configs.findLast((r) => r.effectiveDate <= date);
      const config =
        date < habit.createdDate ? null : (revision?.config ?? null);
      days.push({
        date,
        record,
        config,
        expected: !!config && expectedHabitDate(config, date),
      });
    }
    return summarizeHabitActivity(
      habit.id,
      configs.at(-1)!.config.name,
      habit.archived,
      days,
      today,
    );
  });
}
