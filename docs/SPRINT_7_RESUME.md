# Resume Interrupted Sprint 7 — Analytics & Calendar Improvements

My previous Codex session was interrupted because I ran out of credits.

Continue implementing **Sprint 7 — Analytics, Weekly Review & Calendar Improvements** from where the previous session stopped.

**Important: Do not restart the sprint, duplicate completed features, or overwrite existing work.**

## 1. Recover Project Context

Before changing anything:

1. Read `AGENTS.md` and `PROJECT_PLAN.md`.
2. Read `docs/TASKS.md` and `docs/PROGRESS.md`.
3. Review `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/DECISIONS.md`, and `docs/DEPLOYMENT.md` where relevant.
4. Inspect Git status, uncommitted changes, and recent commits.
5. Inspect the existing Analytics, Home Calendar, Learning, Habits, timer, and scheduling implementations.
6. Identify partially completed features, migrations, untracked files, and unfinished tests.

Treat the codebase and project documentation as the source of truth.

Before continuing, briefly summarize:

- What is already implemented.
- What is partially implemented.
- What remains unfinished.
- Any problems that need resolving.

Preserve all existing work.

## 2. Resume Sprint 7A — Analytics & Weekly Review

Complete whichever of the following requirements are still unfinished.

### Analytics Dashboard

Create or finish a dedicated Analytics page with:

- Date range selection.
- Weekly and monthly navigation.
- Total tracked study time.
- Completed tasks and completion rates.
- Habit completion rates.
- Total study sessions.
- Comparisons with previous periods where data exists.

### Interactive Charts

Use meaningful, intuitive visualizations:

- Bar chart for daily study hours.
- Donut or horizontal bar chart for study time by roadmap.
- Grouped bar chart for planned versus actual study time.
- Line or bar chart for study trends.
- Progress bars for roadmap completion.
- Activity heatmaps for learning and habits.

Use each learning roadmap's saved accent color.

Include clear tooltips, labels, legends, and responsive layouts.

All charts must use actual stored records. Do not fabricate statistics.

### Learning Analytics

Show:

- Time spent per roadmap and module.
- Completed learning steps.
- Roadmap progress.
- Study consistency.
- Last studied date.
- Historical trends.

Keep mastery progress separate from recorded study time.

### Habit Analytics

Support all existing habit types, including binary, quantity, workout, and avoidance habits.

Show:

- Habit completion rates.
- Completion trends.
- Monthly activity heatmaps.
- Streaks where meaningful.
- Quantity versus goal where applicable.

Respect existing habit semantics, particularly successful zero values for avoidance habits.

### Weekly Review

Implement or finish:

- Automated weekly summary.
- Weekly study and task statistics.
- Habit performance overview.
- Weekly activity visualization.
- Editable Wins, Challenges, and Next Week's Priorities.
- Saving and revisiting historical weekly reviews.

Use the existing SQLite/Drizzle architecture.

Avoid adding AI-generated reviews or unrelated features.

## 3. Resume Sprint 7B — Calendar Improvements

Complete any unfinished calendar work.

### Monthly Calendar

Add or finish:

- Desktop Day, Week, and Month views.
- Monday-first month layout.
- Previous/next month navigation.
- Today shortcut.
- Color-coded roadmap activities.
- Habit and task indicators.
- Completion and skipped states.
- Compact handling of busy days.
- Clicking a date to open its daily activities.

### Rescheduling

Support:

- Moving one task occurrence without changing the recurring series.
- A clear option for editing future recurring schedules.
- A simple Move to Date action on mobile.
- Desktop drag-and-drop if feasible and reliable.
- Undo or confirmation for accidental rescheduling.

Preserve historical records and existing recurrence rules.

### Quick Add

Allow creating:

- One-off generic tasks.
- Recurring generic tasks.
- One-off learning sessions associated with an existing roadmap.

Learning sessions should automatically inherit their roadmap's name and color.

Do not introduce independent learning categories or default learning routines.

### Mobile Improvements

Keep the mobile Day view as the primary experience.

Improve:

- Swipe navigation between dates.
- Compact date picker or month overview.
- Today shortcut.
- Quick Add access.
- Touch-friendly rescheduling.
- Responsive activity cards.
- Efficient navigation without excessive scrolling.

Preserve existing PWA behavior.

## 4. Visual Design Requirements

Visual quality is a priority throughout Sprint 7.

Follow the existing **Midnight Focus** design system.

I want the interface to feel like a polished modern productivity application.

Use:

- Meaningful charts and graphs.
- Interactive tooltips.
- Roadmap color accents.
- Compact summary cards.
- Subtle progress indicators.
- Heatmaps for activity and consistency.
- Clear hover, selected, and completion states.
- Thoughtful spacing and typography.

Avoid:

- Generic admin-dashboard styling.
- Oversized empty cards.
- Excessive gradients and animations.
- Cluttered charts.
- Redundant statistics.
- Fake sample data in production views.

Charts should help me understand my activity quickly, not exist merely for decoration.

Verify that they look good on both desktop and approximately 375px mobile screens.

## 5. Preserve Existing Planner Behavior

Do not break:

- Home daily and weekly calendars.
- Learning roadmaps and recurring sessions.
- Roadmap colors.
- Study Anytime sessions.
- Module and step management.
- Timers and manual time logs.
- Task completion, skipping, and rescheduling.
- Habit tracking and history.
- Existing PWA and Docker configuration.

The Learning system follows this structure:

**Roadmap → Module → Step**

Only roadmap schedules or explicitly created one-off sessions generate learning calendar activities.

Do not reintroduce category-based learning tasks or automatic learning presets.

## 6. Data Accuracy and Database Safety

All Analytics calculations must use persisted records.

Account for:

- Local dates and America/Toronto timezone.
- Daylight-saving transitions.
- Multiple sessions per day.
- Timer and manual logs.
- Scheduled versus actual duration.
- Completed, skipped, and missed occurrences.
- Archived roadmaps and habits.
- Historical session links.
- Future dates and unscheduled rest days.

Avoid double-counting activity.

Reuse existing aggregation and scheduling services where possible.

Prefer additive, backward-compatible database migrations.

Do not reset or overwrite databases.

## 7. Implementation Order

Resume from the first incomplete milestone based on the actual repository state:

1. Sprint 7A.1 — Analytics foundation and overview charts.
2. Sprint 7A.2 — Learning and habit analytics.
3. Sprint 7A.3 — Weekly Review and saved reflections.
4. Sprint 7B.1 — Monthly calendar.
5. Sprint 7B.2 — Rescheduling and Quick Add.
6. Sprint 7B.3 — Mobile polish and remaining interactions.
7. Regression testing and documentation.

Do not repeat completed milestones.

If the remaining work is too large, finish one coherent, tested milestone and document the next steps.

## 8. Testing

Add and update relevant tests.

Verify:

- Analytics totals and date ranges.
- Chart data aggregation.
- Weekly review persistence.
- Habit goal calculations.
- Planned versus actual study time.
- Calendar month boundaries.
- Roadmap activity colors.
- Recurring versus one-off events.
- Occurrence-only rescheduling.
- Duplicate prevention.
- Quick Add functionality.
- Timer and habit regressions.

Run:

- Full test suite.
- Lint.
- Typecheck.
- Formatting checks.
- Production build.
- Responsive desktop and mobile browser checks.

Fix regressions introduced by this work.

Do not claim functionality is complete if it has not been verified.

## 9. Production Safety

Planner is currently deployed on my Ubuntu home server.

This is **local development only**.

Do not:

- Connect to the production server.
- Modify production data.
- Apply production migrations.
- Commit automatically.
- Push automatically.
- Deploy automatically.

Keep any database changes safe and documented for a future deployment.

## 10. Documentation and Final Report

Update relevant files:

- `PROJECT_PLAN.md`
- `docs/TASKS.md`
- `docs/PROGRESS.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/DECISIONS.md`, if needed
- `docs/DEPLOYMENT.md`, if needed

At the end, provide:

1. What was already completed before resuming.
2. What was completed in this session.
3. Which Sprint 7 milestones are now complete.
4. Charts and UI improvements implemented.
5. Database changes and migrations.
6. Tests and verification results.
7. Remaining unfinished features.
8. Whether Sprint 7 is ready for release review.
9. Suggested Git commit message.

Do not automatically commit, push, or deploy.

**Overall goal:** Finish an intuitive, visually polished Analytics and Calendar experience where I can understand my productivity through meaningful charts, review my weekly progress, and manage my schedule efficiently across Mac and iPhone.
