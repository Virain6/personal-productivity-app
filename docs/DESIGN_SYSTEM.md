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

Desktop >=768px: collapsible sidebar. Mobile: Home/Learning/Habits/More bottom navigation with safe-area padding; More opens all destinations. Home week view defaults at >=1024px; smaller screens default to day. A week on narrow screens uses a seven-day selector plus one agenda, never seven cramped columns. Explicit day/week choice can override the default. Horizontal gestures on agenda background only; retain vertical scrolling and date buttons.

Loading, empty, unavailable sections and failed writes must be honest. No fabricated metrics. Completion independent of timer stop. Error messages use role=alert; routine timer ticks do not announce to screen readers. Dialog edits persist only on successful server response, with stale-version conflict feedback. No standalone notes feature: a short activity summary belongs to a task/session.
