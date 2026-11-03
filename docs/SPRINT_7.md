# Sprint 7 — Analytics, Weekly Review & Calendar Improvements

Planner is now running on my Ubuntu home server, and the Learning system has been redesigned around roadmaps.

I want to implement the next major sprint with two milestones:

1. **Sprint 7A — Analytics & Weekly Review**
2. **Sprint 7B — Calendar Improvements**

The goal is to make Planner more insightful, visually polished, and intuitive while preserving the existing functionality.

**Visual design is a major priority.** Use meaningful charts, graphs, progress indicators, heatmaps, color coding, and interactive visualizations wherever they genuinely improve usability.

Do not build a generic admin dashboard full of unrelated statistics.

The UI should remain consistent with the Midnight Focus dark theme.

---

# 1. Review the Existing Project

Before implementing anything:

- Read `AGENTS.md` and `PROJECT_PLAN.md`.
- Read `docs/TASKS.md`, `docs/PROGRESS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, and `docs/DECISIONS.md`.
- Inspect Git status and preserve any uncommitted changes.
- Review the current Home calendar, Learning roadmaps, Habits, timer, task scheduling, and database implementation.
- Identify which existing services and UI components can be reused.

Use the existing codebase as the source of truth.

Do not rebuild functionality that already exists.

# PART A — Analytics & Weekly Review

## 2. Dedicated Analytics Page

Create a new Analytics page accessible from the main navigation.

It should have a modern, visually polished dashboard layout.

At the top, include:

- Date range selector.
- Previous/next period navigation.
- Quick filters such as This Week, Last Week, This Month, and custom date range.
- Clear summary statistics.

Use the existing America/Toronto timezone conventions to keep daily and weekly statistics accurate.

### Summary Cards

Display:

- Total tracked study time.
- Total productive time, if distinguishable from study time.
- Completed tasks.
- Task completion rate.
- Habit completion rate.
- Total study sessions.

Make these cards visually informative rather than just showing large numbers.

Where useful, include:

- Comparison with the previous period.
- Small trend indicators.
- Subtle sparklines.
- Relevant icons and category colors.

Do not invent comparisons when historical data is unavailable.

## 3. Study Time Analytics

Build interactive charts from actual recorded timer and manual-log data.

### A. Weekly Study Hours

Use a bar chart showing study time for each day of the selected week.

Requirements:

- X-axis: Monday through Sunday.
- Y-axis: study duration.
- Clear tooltips showing precise duration.
- Meaningful hover and selected states.
- Responsive chart sizing.

### B. Study Time by Roadmap

Use a horizontal bar chart or donut chart showing how time is distributed across learning roadmaps.

Use each roadmap's saved accent color.

For example:

- DSA Practice: Purple.
- Computer Science: Blue.
- Databases & SQL: Green.

These are illustrative names and colors. Use actual user-created roadmaps and their saved colors.

Allow selecting a roadmap to explore its detailed analytics.

### C. Planned vs. Actual Study Time

Compare scheduled study duration against actual recorded study time.

Use a grouped bar chart or another clear comparison visualization.

Distinguish:

- Planned duration.
- Actual tracked duration.
- Completed, skipped, and missed sessions.

Avoid treating missing time logs as automatically completed work.

Avoid double-counting timer sessions and manual entries.

Explain what the comparison represents.

### D. Study Trends

Include a compact line or bar chart for study time over multiple weeks.

Allow users to recognize whether they are becoming more consistent.

Avoid misleading chart scales or exaggerated trend indicators.

## 4. Learning Roadmap Analytics

Create a Learning Analytics section showing:

- Total study time by roadmap.
- Total completed learning steps.
- Roadmap mastery progress.
- Modules currently in progress.
- Time spent in individual modules.
- Study consistency.
- Last studied date.
- Learning activity over time.

Use intuitive progress visuals.

Examples:

- Progress bars for roadmap completion.
- Small charts for time distribution.
- Heatmap calendar for study activity.
- Simple trends for historical study time.

Keep mastery completion separate from recorded study hours.

A completed calendar task must not automatically mean a learning step was mastered.

## 5. Habit Analytics

Build a Habit Analytics section using existing habit history.

Support:

- Binary habits.
- Quantity habits.
- Workout rotation habits.
- Build, limit, and avoid habit types.

Provide:

### Habit Completion Overview

- Overall completion rate.
- Completion by individual habit.
- Completed versus missed eligible days.
- Current streak where meaningful.
- Longest streak where meaningful.

### Habit Activity Heatmap

Create a visually clear monthly activity heatmap.

Use distinct appearances for:

- Completed.
- Missed.
- Not scheduled.
- Future.
- No entry / unknown, where applicable.

For quantity habits, respect their configured goal semantics.

For avoidance habits, do not treat zero as failure when zero represents success.

### Habit Trends

Use charts appropriate to the habit type.

Examples:

- Binary habit: completion over time.
- Quantity habit: actual quantity versus goal.
- Workout rotation: workout frequency and distribution.

Do not force every habit into the same visualization if its metrics are different.

## 6. Weekly Review

Create a dedicated Weekly Review section within Analytics.

This should summarize the selected week.

### Automated Weekly Summary

Show:

- Total study hours.
- Study hours by roadmap.
- Tasks completed.
- Scheduled sessions completed or missed.
- Habit completion.
- Most active study day.
- Comparison against the previous week when data exists.

Use a concise, readable layout.

### Weekly Reflection

Add three editable fields:

1. **Wins** — What went well?
2. **Challenges** — What was difficult?
3. **Next Week's Priorities** — What should I focus on?

Save these notes to the database.

Requirements:

- One review per calendar week.
- Editable at any time.
- Navigate to past reviews.
- Preserve previous reviews.
- Display saved notes when returning to a week.

Do not introduce an LLM dependency or automatically generated AI coaching.

### Visual Weekly Summary

Include a compact weekly visualization such as a seven-day activity strip or bar chart.

I should be able to quickly see which days were productive and which days had little activity.

Use recorded data, not arbitrary productivity scores.

## 7. Analytics Interaction and Design

Use charts only when they clarify the data.

Preferred visual patterns:

- Bar charts for daily and weekly comparisons.
- Line charts for trends.
- Donut charts for distributions with few categories.
- Heatmaps for consistency.
- Progress bars for completion.
- Small sparklines for summary trends.
- Compact, meaningful stat cards.

Use a chart library that integrates well with the existing stack, if a suitable library is not already installed.

Requirements:

- Responsive desktop and mobile charts.
- Readable labels and legends.
- Accessible colors and sufficient contrast.
- Tooltips for exact values.
- Good loading and empty states.
- No excessive gradients or decorative animations.
- No fake data in production UI.
- Avoid charts that duplicate the same information unnecessarily.

Use roadmap colors consistently.

Make sure analytics remain useful even with only a few days of activity.

---

# PART B — Calendar Improvements

## 8. Monthly Calendar View

Add a full Month view to the existing Home calendar.

On desktop, support:

- Day.
- Week.
- Month.

Keep the current mobile-first daily experience.

### Month View

Display a conventional calendar grid with:

- Monday-first weeks.
- Previous and next month navigation.
- Today shortcut.
- Current date highlighting.
- Compact daily activity indicators.
- Roadmap-specific colors.
- Habit indicators.
- Completed task indicators.
- Clear differentiation between scheduled and completed activity.

Avoid overcrowding calendar cells.

For dates with many activities, show the most relevant items and a "+N more" indicator or compact summary.

Clicking a day should open its daily activities or switch to Day view.

Use the existing task occurrence system.

Do not introduce another calendar data model.

## 9. Calendar Colors and Visual Hierarchy

The calendar should clearly distinguish:

- Learning roadmap sessions.
- Personal or generic tasks.
- Habits.
- Completed activities.
- Skipped or missed activities.

Learning sessions must use their roadmap's saved accent color.

Do not recreate predefined learning categories or default learning tasks.

Only user-created roadmaps with active recurring schedules or explicitly scheduled one-off sessions should generate learning activities.

Keep the distinction between a learning step's mastery and a calendar task's completion.

Prefer subtle colored borders, dots, and accents rather than filling entire activity cards with saturated colors.

## 10. Easier Task Rescheduling

Improve rescheduling interactions.

### Desktop

Where practical, support dragging an existing calendar occurrence to another date.

Requirements:

- Clear drag feedback.
- Valid drop targets.
- Confirmation or undo for accidental movement.
- Preserve task identity and history.
- Do not silently change an entire recurring series.

### Mobile

Provide a simple Move to Date action.

Use a touch-friendly date picker.

Do not rely on drag-and-drop as the only rescheduling method.

### Recurring Activities

Clearly distinguish:

- Move this occurrence only.
- Edit the recurring schedule for future occurrences.

Do not unexpectedly modify historical occurrences.

Reuse existing recurrence handling.

## 11. Quick Add and Task Creation

Improve the ability to add activities directly from Home.

Provide a compact Quick Add action.

Support:

- One-off generic tasks.
- Recurring generic tasks.
- One-off study sessions attached to an existing roadmap.

For learning sessions:

- Select the roadmap.
- Inherit its name and accent color.
- Optionally select a learning step.
- Choose date, time, and duration.

Do not introduce separate learning categories or require duplicate learning task definitions.

A roadmap without recurrence should still be available for manually scheduled sessions.

## 12. Mobile Calendar UX

Improve the iPhone experience without disrupting the existing PWA.

Requirements:

- Keep Day view as the primary mobile layout.
- Swipe horizontally between days.
- Provide a compact monthly date picker or month overview.
- Add an easy Today shortcut.
- Make Quick Add accessible.
- Use touch-friendly controls.
- Keep calendar cards compact.
- Preserve existing task completion, skip, reschedule, and timer actions.
- Avoid horizontal overflow and long dialogs.

Month view does not need to display the same amount of detail on mobile as desktop.

Prioritize speed and readability.

---

# PART C — Architecture, Testing and Delivery

## 13. Data Integrity and Analytics Calculations

Analytics must use actual persisted records.

Define clear calculation rules for:

- Planned duration versus actual duration.
- Multiple sessions on one day.
- Timer logs and manual logs.
- Completed versus skipped tasks.
- Missed recurring occurrences.
- Habit eligibility and completion.
- Archived roadmaps and habits.
- Historical roadmap associations.
- Timezone boundaries.
- Weeks spanning months or years.

Avoid double-counting.

Aggregate efficiently rather than loading unlimited historical records into the browser.

Use shared aggregation services where appropriate.

Do not introduce unnecessary stored summary counters that may drift out of sync with source records.

## 14. Database Changes

Use the existing SQLite and Drizzle setup.

New database structures should be minimal.

Weekly reviews may require a new table.

Prefer deriving analytics from existing records.

Use safe, versioned migrations.

Preserve:

- Roadmaps and learning steps.
- Study history and timers.
- Tasks and recurring schedules.
- Habits and workout history.
- Existing Home behavior.

Do not reset databases or automatically seed example data.

## 15. Implementation Milestones

Implement this sprint incrementally.

### Milestone 7A.1 — Analytics Foundations

- Shared analytics calculations.
- Date range handling.
- Overview cards.
- Study-time charts.
- Roadmap breakdowns.

### Milestone 7A.2 — Habits and Weekly Review

- Habit analytics.
- Activity heatmaps.
- Weekly summary.
- Saved weekly reflection notes.
- Weekly review history.

### Milestone 7B.1 — Calendar Month View

- Month navigation.
- Color-coded activities.
- Day selection.
- Responsive layout.

### Milestone 7B.2 — Calendar Interactions

- Improved rescheduling.
- Quick Add.
- Mobile navigation.
- Drag-and-drop if feasible without compromising reliability.

After each milestone:

- Run relevant tests.
- Verify the UI.
- Update progress documentation.
- Leave the codebase in a working state.

If time or context is limited, stop after a fully verified milestone rather than implementing everything partially.

## 16. Testing and Verification

Add comprehensive tests for:

### Analytics

- Date-range calculations.
- Daily and weekly study totals.
- Timer/manual-log aggregation.
- Planned versus actual duration.
- Roadmap time distributions.
- Habit completion and avoidance logic.
- Heatmap data.
- Weekly review persistence.
- Timezone boundaries and daylight-saving transitions.
- No-data and partial-data scenarios.

### Calendar

- Month boundaries.
- Recurring roadmap occurrences.
- One-off roadmap sessions.
- Color consistency.
- Occurrence-only rescheduling.
- Recurring schedule updates.
- No duplicate events.
- Quick Add.
- Mobile date navigation.
- Existing task/timer functionality.

Run:

- Full automated test suite.
- Lint.
- Typecheck.
- Formatting.
- Production build.
- Responsive browser checks at desktop and approximately 375px mobile width.

Verify that Home, Learning, Habits, and timers still work.

## 17. Production Safety

Planner is already deployed on my Ubuntu home server with persistent SQLite storage and private Tailscale access.

This sprint is local development only.

Do not:

- Connect to or modify production.
- Reset or delete production data.
- Apply production migrations.
- Commit automatically.
- Push automatically.
- Deploy automatically.

Document migration and deployment considerations for a later controlled release.

## 18. Documentation

Update:

- `PROJECT_PLAN.md`.
- `docs/TASKS.md`.
- `docs/PROGRESS.md`.
- `docs/ARCHITECTURE.md`.
- `docs/DESIGN_SYSTEM.md`.
- `docs/DECISIONS.md`, where relevant.
- `docs/DEPLOYMENT.md`, if schema or release procedures change.

## 19. Final Report

At the end, report:

1. Features implemented.
2. Which milestones are complete.
3. Charts and visualizations added.
4. Calendar interactions implemented.
5. Database changes.
6. Test results.
7. Remaining limitations.
8. Whether the sprint is ready for release review.
9. Suggested Git commit message.

Do not automatically commit, push, or deploy.

**Overall goal:** Create an intuitive, visually polished productivity experience where Calendar makes it easy to plan activities and Analytics makes it easy to understand how time, learning, tasks, and habits are progressing.

Use visualizations thoughtfully. The user should understand their progress at a glance without needing to interpret complicated reports.
