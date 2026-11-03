import { eq, desc } from "drizzle-orm";
import type { Store } from "../db/connection";
import { settings, weeklyReviews } from "../db/schema";
import { addDays, localDate, weekStart } from "../../lib/dates";
import {
  isReviewWeek,
  type WeeklyReviewData,
  type ReflectionText,
} from "../../lib/weekly-review";
import { getAnalytics } from "./analytics";
import { DomainError } from "./validation";
export function getWeeklyReview(
  store: Store,
  requested?: string,
  now = Date.now(),
): WeeklyReviewData {
  const timezone = store.db.select().from(settings).get()!.timezone;
  const week = requested ?? weekStart(localDate(now, timezone));
  if (!isReviewWeek(week))
    throw new DomainError("Choose a valid Monday-start week.");
  return {
    analytics: getAnalytics(store, { from: week, to: addDays(week, 6) }, now),
    reflection:
      store.db
        .select()
        .from(weeklyReviews)
        .where(eq(weeklyReviews.week, week))
        .get() ?? null,
    history: store.db
      .select({ week: weeklyReviews.week, updatedAt: weeklyReviews.updatedAt })
      .from(weeklyReviews)
      .orderBy(desc(weeklyReviews.week))
      .all(),
  };
}
// Called within the existing immediate, retry-safe mutation transaction.
export function saveWeeklyReview(
  store: Store,
  input: ReflectionText & { week: string; version: number },
  now: number,
) {
  const old = store.db
    .select()
    .from(weeklyReviews)
    .where(eq(weeklyReviews.week, input.week))
    .get();
  if ((old?.version ?? 0) !== input.version)
    throw new DomainError(
      "This review changed elsewhere. Your draft is retained. Load the saved review before replacing it.",
      409,
    );
  if (
    !old &&
    ![input.wins, input.challenges, input.priorities].some((s) => s.trim())
  )
    throw new DomainError("Add a reflection before saving this week.");
  const values = {
    week: input.week,
    wins: input.wins,
    challenges: input.challenges,
    priorities: input.priorities,
    version: input.version + 1,
    updatedAt: now,
  };
  if (old)
    store.db
      .update(weeklyReviews)
      .set(values)
      .where(eq(weeklyReviews.week, input.week))
      .run();
  else store.db.insert(weeklyReviews).values(values).run();
  return input.week;
}
