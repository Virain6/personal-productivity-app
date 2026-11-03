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

## Learning integration

Home study cards show one muted, truncated secondary topic line within the existing title control. Activity details use the existing native select and buttons for optional session topics and a separate explicit Save activity topic action. Topic editing never changes time or completion. History shows preserved labels; Learning uses compact per-step time text and a collapsible history. Keep inactive/absent topics neutral and preserve existing mobile Day/swipe behavior.

## Learning workspace — Sprint 6.5

Learning keeps Midnight Focus tokens, Geist typography, restrained borders and 44px action targets. It may be more expressive than Home: a three-cell summary, responsive roadmap-card grid, category icons, subtle category colors and thin teal progress tracks. Custom categories use the neutral purple book icon. Cards show stored completion and linked study time; use a clear empty state instead of sample progress. Search and native category filters appear when multiple active roadmaps exist.

Modules form a vertical path with a subtle connecting line and numbered/completed nodes. The current module has an accent border; completed steps use a faint success surface, Needs review uses amber plus text, and In progress uses accent plus text. Native details/summary supports keyboard collapse and free navigation. Step title buttons open details; completion buttons are separate siblings. Module editing and ordering live in a compact actions disclosure. No locked progression or decorative animation.

Step details use a right-hand panel up to 512px wide on desktop and a full-width, full-height sheet below 768px. Reuse Radix focus trapping, accessible titles, Escape/close, internal scrolling and mobile safe-area padding. Errors and reload/retry actions remain inside the panel. Status is explicit, never inferred from hours. The panel offers existing activities for starting a linked timer, and discloses that time and mastery are separate. The standard centered editor supports descriptions, objectives, custom category suggestions and an optional date. Existing Home/Habits dialogs keep their default layout.

Learning-only progress styling normalizes native browser tracks with rounded 5px teal bars. Reduced-motion preferences disable card transitions. A 390px browser check verified overview/detail widths, full-screen panel, editing, archive/restore and completion/undo. Physical iPhone keyboard, safe-area/PWA and VoiceOver checks remain manual.

## Dedicated module workspace

Module headers retain compact mastery/current-topic context and direct study/edit/archive actions. The focused learning path avoids repeating the module title, objective and progress above its steps. At wide desktop widths, main learning content sits beside a restrained sidebar containing recorded totals, scope-labeled schedule and monthly calendar. Below 1100px the sidebar follows the learning content in a single column.

Use native labeled weekday checkboxes and date/time/duration inputs; keep saved errors visible and drafts intact. The existing step sheet starts the existing timer. Calendar cells expose full date, state, scheduled/completed counts and actual duration in accessible labels: teal completed, amber missed, purple future, neutral rest/today; a separate dot denotes recorded study. Selected-day details explain the records. Color never substitutes for text. Today/future dates are never labeled missed. Monthly consistency includes its denominator and timezone explanation.

Desktop and 390px automated checks covered navigation, schedules, native date/time submission and timer logging without horizontal overflow. Real Safari/PWA keyboard and VoiceOver checks remain part of release review.

## Sprint 6.6 — roadmap identity and colors

Learning shows roadmaps directly with search only: no category badge, category filter or category input. Use Create Roadmap and a native labeled Accent color select. The palette is Purple #AA9AF3, Blue #86B8DC, Green #70C9A5, Orange #E8AD78, Pink #E5A3C7, Cyan #78CBD4, Red #F59B9B and Yellow #DFCF7C. These restrained accents decorate card borders/icons, progress, path markers and Home study edges; neutral dark surfaces and semantic completion/status colors remain readable.

Schedule forms ask only for weekdays, optional time, duration and pause state. Roadmap and module controls explicitly explain that module schedules add separate sessions. Home roadmap task details show a roadmap link instead of a category selector. Ordinary task dialogs retain their categories. Calendar future-state legends say Accent rather than assuming purple.

## Roadmap-only scheduling correction

Only roadmap creation/detail exposes recurring weekdays. The create dialog starts with all days unchecked and explains that recurrence is optional; selecting a day reveals duration/start time. Module pages instead link back to the roadmap and retain study statistics.

Study Anytime is available on every active roadmap, including those without steps or schedules. Its compact responsive dialog has an optional step, date, time, optional duration and separate Start now/Schedule session actions. An explicit additional-session checkbox distinguishes intentional extra work from reuse of an existing open activity. Errors retain inputs; buttons disable during save. Roadmap colors and existing Home controls are unchanged.

## Analytics foundations — Sprint 7A.1

Use a quiet header, compact date controls and four summary cards, followed by a two-column chart layout on wide screens and one column below 1100px. At phone widths, cards use two columns, date arrows span the row and the mobile More menu exposes Analytics. No Home/Habits redesign.

Daily and eight-week bars use the existing purple accent, zero-baseline hour axes, subtle horizontal grid lines and no animation. Planned bars are neutral gray alongside recorded purple bars. Roadmap distribution rows use saved roadmap colors; selecting one reveals compact module time/current-mastery details and links. Do not encode task completion as recorded time or mastery. Real zero values stay zero; empty periods offer a Learning link rather than sample data.

Charts expose exact HH:MM:SS tooltips and native disclosure tables for keyboard/screen-reader access. Range buttons have accessible names/pressed states; custom dates have labels and inline errors. Preserve the last loaded data with an error/retry notice on refresh failures. Loading charts reserve their height. Bound chart overflow locally and keep touch controls at least 44px. No fabricated percentage changes, sparkline samples, punitive streak wording or decorative charts.

## Sprint 7A.2 — activity calendars

Extend existing roadmap drill-downs with compact mastery/consistency indicators, a selected-roadmap trend and Monday-first monthly heatmap. Use saved roadmap accents. Habit activity has a selector, compact counters, monthly calendar, weekly trends, actual workout distribution and quantity/goal lines. Desktop uses two columns; below 850px stack content. Month selection stays within the Analytics date range.

Cells are at least 44px tall, with full date/result accessible names, native keyboard controls, tooltips and announced selected-day details. Green means recorded goal met; red exceeded; solid amber explicitly below goal; dashed amber expected/unlogged; blue recorded without a goal or unscheduled study; patterned rest; neutral dashed future; muted unknown. Legends and text accompany colors. Quantity charts preserve zero, leave missing gaps and expose exact-value tables. No invented success or punitive streak language.

## Sprint 7A.3 — Weekly Review

Use a focused Analytics subpage with a quiet report header, clearly dated Monday–Sunday controls and three compact summary cards. Reuse the seven-day time chart and exact-value disclosure. Roadmap share bars use saved accents; task/habit progress is visually separate from recorded time. Keep the report to one chart and a compact roadmap/learning-activity panel. Future/no-data states use neutral explanatory text.

Reflections are a single main panel beside a compact saved-week history on desktop; stack both and the report columns on mobile. Textareas use 16px type, visible labels, character limits and existing focus treatment. Saved/unsaved/saving and errors are explicit. Week-change confirmation reuses the existing focus-trapped Dialog with Keep editing or Change week, keep draft actions. No AI-generated filler, gamification or standalone notes feature.

## Home Month view — Sprint 7B.1

Desktop adds Month beside Day/Week. Use a Monday-first seven-column grid, quiet surface cells, restrained borders, muted adjacent dates, a selected-date outline and accent circle for Today. Show up to three single-line activity previews with saved roadmap-color edges, completion/skipped/past-unfinished symbols, compact status counts and +N more. Habit indicators retain goal outcomes; future habits show planned, not failed. Avoid bright full-cell fills.

Every date is a keyboard-focusable button with its full date and activity counts; selecting it opens Day with existing details, timers and completion actions. Month returns to the selected date's month. Hover/focus remains visible. Mobile stays Day with existing touch navigation and no calendar mode toggle; an optional mobile month picker is deferred. Preview labels truncate, while hover titles and the Day agenda provide full text. Full iPhone/VoiceOver verification remains a manual release check.
