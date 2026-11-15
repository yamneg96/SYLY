# WCAG 2.2 AA conformance report: SYLY `<db-assistant>`

**Draft, Sunday 15 Nov 2026.** Every result below that needs a person, a screen reader or a real device is marked **pending manual test**. What is filled in comes from automated checks only: `module/scripts/a11y-check.mjs` (Chrome headless + axe-core 4.10, keyboard flow, reflow at 640 px and 320 px) and an axe run on the jobs, helper and install pages. Automated checks find roughly a third of real problems (guide section 8).

Scope: the module (launcher, panel, inline mode, consent card, accommodation form) on the three Savanna starter pages, `demo/blank.html` and `savanna/pages/jobs.html`; our pages `demo/helper.html` and `demo/install.html`; the starter skip-link patch. The Savanna starter's own defects are out of scope (guide section 12).

| WCAG 2.2 AA criterion | Supports / Partly / Does not | Notes |
| --- | --- | --- |
| 1.1.1 Non-text content | Supports (automated) | Launcher icon is decorative beside visible text; screenshots and screen frames on the helper page have alt text. Pending manual test |
| 1.3.1 Info and relationships | Supports (automated) | Real labels, fieldsets with legends in the accommodation form, headings, lists; messages in a `role="log"` region. Pending manual test |
| 1.3.2 Meaningful sequence | Supports (automated) | Header → messages → status → composer. Pending manual test |
| 1.4.1 Use of colour | Supports (automated) | Toggle state shown by a check mark and `aria-pressed`; errors in words. Pending manual test |
| 1.4.3 Contrast (minimum) | Supports (automated) | Fixed text #111111 on #FFFFFF; host `--bs-primary` used only if 4.5:1 with white (Savanna's #db3e3e fails, so #002B56); install page refuses a custom colour below 4.5:1 |
| 1.4.4 Resize text | Supports (automated) | Sizes in rem. Pending manual test at 200% |
| 1.4.10 Reflow | Supports (automated) | No sideways scroll at 640 px and 320 px. Pending manual test |
| 1.4.11 Non-text contrast | Supports (automated) | Borders #767676; focus ring #F5A300 with a dark inner ring |
| 1.4.13 Content on hover or focus | Supports | No hover-only content |
| 2.1.1 Keyboard | Supports (automated) | Skip link → panel → ask → source link → Escape, all by keyboard. Pending manual test |
| 2.1.2 No keyboard trap | Supports (automated) | Escape always closes the panel (or stops screen sharing first) |
| 2.2.1 Timing adjustable | Supports | No time-outs |
| 2.2.2 Pause, stop, hide | Supports | Nothing moves by itself; no auto-playing audio |
| 2.4.3 Focus order | Supports (automated) | Focus into the question box (or the consent card) on open; back to the launcher on close. Pending manual test |
| 2.4.7 Focus visible | Supports (automated) | 3 px #F5A300 outline, 2 px offset, `:focus-visible` |
| 2.4.11 Focus not obscured (minimum) | Pending manual test | Launcher is a small pill on the side edge; check every starter control at 200% zoom |
| 2.5.7 Dragging movements | Supports | No dragging anywhere |
| 2.5.8 Target size (minimum) | Supports (automated) | Main controls at least 44 by 44 px |
| 3.1.1 / 3.1.2 Language of page / parts | Supports (automated) | `lang` and `dir="auto"` on every message; Amharic and Arabic marked. Pending manual test (screen reader voice switching) |
| 3.2.6 Consistent help | Supports | "Talk to a person" in the same place in every state |
| 3.3.1 Error identification | Supports (automated) | Accommodation form errors in words with `role="alert"` and `aria-invalid` |
| 3.3.2 Labels or instructions | Supports (automated) | Visible labels and hints on every field |
| 3.3.7 Redundant entry | Supports | The ticket carries the conversation, page and section; nothing asked twice |
| 3.3.8 Accessible authentication | Supports | No login for learners |
| 4.1.2 Name, role, value | Supports (automated) | Real `<button>`, `<select>`, `<textarea>`, `<dialog>`; axe: 0 violations on every page checked |
| 4.1.3 Status messages | Supports (automated) | `role="status"` line; answers and tutor replies announced by `role="log"`. Pending manual test |

## Who tested

| Who | Device and assistive technology | Result |
| --- | --- | --- |
| Automated (team) | Chrome headless, axe-core 4.10, 1280 / 640 / 320 px | All checks passed; 0 axe violations |
| Co-designer | pending manual test | |
| Team, TalkBack (Android, Chrome) | pending manual test | |
| Team, NVDA (Windows, Chrome/Firefox) | pending manual test | |
| Team, keyboard only + 200% zoom + sound off | pending manual test | |

## What they could not do

pending manual test
