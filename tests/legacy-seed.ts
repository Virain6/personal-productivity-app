// Explicit historical fixtures for regression tests; never imported by application code.
import { eq } from "drizzle-orm";
import type { Store } from "../src/server/db/connection";
import { settings, templates } from "../src/server/db/schema";
import { localDate, DEFAULT_ZONE } from "../src/lib/dates";
import type { Category } from "../src/lib/planner-types";
export { ensureOccurrences } from "../src/server/services/scheduling";
export function seed(store: Store, now = Date.now()) {
  store.sqlite
    .transaction(() => {
      store.db
        .insert(settings)
        .values({
          id: 1,
          timezone: DEFAULT_ZONE,
          onboardingDate: localDate(now),
        })
        .onConflictDoNothing()
        .run();
      const config = store.db
        .select()
        .from(settings)
        .where(eq(settings.id, 1))
        .get()!;
      const rows: {
        id: string;
        title: string;
        category: Category;
        weekday: number;
        targetMinutes: number;
        optional: boolean;
        effectiveFrom: string;
      }[] = [];
      function add(
        weekday: number,
        key: string,
        title: string,
        category: Category,
        targetMinutes: number,
        optional = false,
      ) {
        rows.push({
          id: `default-${weekday}-${key}`,
          title,
          category,
          weekday,
          targetMinutes,
          optional,
          effectiveFrom: config.onboardingDate,
        });
      }
      for (let day = 1; day <= 5; day++) {
        add(day, "dsa", "DSA practice", "DSA", 90);
        add(day, "project", "Project work", "Project", 120);
      }
      add(1, "focus", "Computer Science Fundamentals", "Fundamentals", 90);
      add(2, "focus", "Databases & SQL", "Databases", 90);
      add(3, "focus", "Mock Interview", "Interviews", 90);
      add(
        4,
        "focus",
        "System Design & Architecture + Backend Engineering",
        "System/Backend",
        90,
      );
      add(5, "focus", "Testing, Debugging & DevOps", "Testing/DevOps", 90);
      add(
        3,
        "specialization",
        "Learn on the specialization topic",
        "Specialization",
        60,
      );
      add(
        5,
        "specialization",
        "Review and practice activity",
        "Specialization",
        60,
      );
      for (const day of [2, 4])
        add(day, "jobs", "Job applications", "Applications", 90);
      add(6, "dsa", "DSA review", "DSA", 60);
      add(6, "focus", "Review weak areas", "Fundamentals", 60);
      add(6, "project", "Project work", "Project", 120);
      add(7, "dsa", "Optional DSA", "DSA", 60, true);
      add(7, "project", "Optional project work", "Project", 120, true);
      for (const row of rows)
        store.db.insert(templates).values(row).onConflictDoNothing().run();
    })
    .immediate();
}
