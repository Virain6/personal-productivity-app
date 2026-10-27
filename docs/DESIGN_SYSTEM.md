# Midnight Focus

Dark-first, compact and calm: clear hierarchy, subtle borders and useful information rather than decorative cards. Charcoal surfaces, restrained violet accent, no gradients or glass. Light mode is future work.

## Tokens

| Token            | Color             |
| ---------------- | ----------------- |
| background       | #101114           |
| surface          | #1B1D22           |
| elevated         | #252730           |
| accent / hover   | #8875EB / #9C8AF2 |
| success          | #48B892           |
| foreground       | #F4F4F6           |
| muted            | #A5A6B0           |
| border           | #303137           |
| danger / warning | #F59B9B / #DFBD7C |

CSS variables in src/app/globals.css are authoritative. Primary buttons use dark text on violet for contrast. Category-learning is violet #AA9AF3, category-project blue #86B8DC, category-jobs amber #DFBD7C; status always has text/icon as well as color.

## Typography and spacing

Locally bundled Geist (400/500/600); no external font request. Body 14px, supporting copy 12px, page title 24px. Tabular numerals for metrics/timers. Spacing follows 4/8/12/16/24/32px. Controls radius 8px, cards/dialogs 12px. Touch controls minimum 44px. No purely decorative animation; reduced-motion respected.

## Components

Local Button variants (primary, secondary, ghost, danger); native labeled inputs/selects/checkboxes and progress bars; Radix accessible Dialog with portal, focus trap, Escape/close button and labeled title/description. This follows the small composed primitive approach used by shadcn/ui without importing an unused component catalog. Use native selects for simple dropdowns. Status labels and category tokens are shared by task cards. Introduce additional components only as real interactions require them.

## Layout and interaction

Desktop >=768px: collapsible sidebar. Mobile: Home/Learning/Habits/More bottom navigation with safe-area padding; More opens all destinations. Home week view defaults at >=1024px; smaller screens default to day. A week on narrow screens uses a seven-day selector plus one agenda, never seven cramped columns. At mobile widths below 768px, Day is mandatory and the toggle is hidden; desktop preferences are retained. Horizontal gestures on agenda background only; retain vertical scrolling and date buttons.

Loading, empty, unavailable sections and failed writes must be honest. No fabricated metrics. Completion independent of timer stop. Error messages use role=alert; routine timer ticks do not announce to screen readers. Dialog edits persist only on successful server response, with stale-version conflict feedback. No standalone notes feature: a short activity summary belongs to a task/session.

## Calendar habits and logging dialogs

Habits use the existing compact charcoal/bordered calendar-card proportions with a small teal/success leaf and “Habit” category label. Keep study/project/job tokens intact. Show name and neutral status, optional planned workout, flexible-weekly label and future-date hint. The name is a keyboard-accessible, minimum-44px logging button. Do not fill cards with bright colors or place logging forms in every calendar column.

Open the existing Radix dialog for the clicked date. Use labeled native fields, saved-status text, Save and close, Cancel and an explicit discard choice for unsaved edits. Binary negative habits describe whether the named activity occurred; do not invert the stored observation. Explicit zero differs from blank. Rest stays neutral. Errors keep drafts and use role=alert; saved confirmation uses role=status. Future dates remain inspectable with disabled logging controls. Mobile dialogs fit within 90dvh and scroll internally; retain the calendar's existing swipe exclusions around interactive elements.

## Sprint 4 — compact Home and quick controls

Home uses a compact breadcrumb and date toolbar, reduced section gaps, 8px card padding and a simple task-only summary. Omit motivational filler. Task and habit completion share a filled teal check, subtle success background/border and readable muted title. Keep explicit status text; unlogged/rest are neutral, exceeded limits have warning treatment, while Avoid occurrences use the danger red surface, border and indicator. Color alone never conveys completion.

Card title/body opens details; quick actions are separate sibling buttons with date-specific accessible labels and minimum 44px touch targets. Binary controls complete/undo. Workout labels disclose advancement and show actual performed type after saving. Quantities offer configurable +/- and explicit Log 0 for negative goals; an unknown starting value opens details. Controls wrap in narrow columns. No nested buttons. Pending/saved-refresh states disable writes; errors retain a Retry save and Review entry path. Existing mobile date navigation and interactive-element swipe exclusions are unchanged.

Daily progress uses four thin success-colored pill segments, each representing 25% with partial fills, followed by a thin accent time bar and recorded/planned label. Use existing task metrics; cap visual fills at 100% and keep zero-denominator states empty.
