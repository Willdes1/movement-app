# Design token audit (Task 7, step 1)

Read-only inventory. **No files were changed to produce this.** Generated 2026-08-13
by scanning every `.tsx`, `.ts` and `.css` file outside `node_modules`, `.next` and
`app/api`, and counting style values that are written as literals rather than read
through `var(--...)`.

**Headline: 11,516 hardcoded style values.** Colour is roughly half-solved. Everything
else has no token layer at all.

---

## 1. The count

Values written as literals, by surface. A value already going through `var(--...)` is
not counted.

| | athlete | coach | admin | marketing | globals.css | **total** |
|---|---|---|---|---|---|---|
| hex colour | 257 | 227 | 543 | 49 | 29 | **1,105** |
| rgb / rgba | 243 | 88 | 287 | 22 | 44 | **684** |
| borderRadius | 536 | 320 | 615 | 0 | 0 | **1,471** |
| fontSize | 1,207 | 640 | 1,318 | 1 | 0 | **3,166** |
| fontWeight | 691 | 363 | 669 | 0 | 0 | **1,723** |
| fontFamily | 120 | 104 | 384 | 0 | 0 | **608** |
| boxShadow | 6 | 1 | 1 | 0 | 0 | **8** |
| padding | 679 | 382 | 704 | 24 | 12 | **1,801** |
| gap | 345 | 200 | 377 | 21 | 7 | **950** |
| **total** | **4,084** | **2,325** | **4,898** | **117** | **92** | **11,516** |

The marketing column looks clean only because the landing page keeps its palette in one
injected stylesheet namespaced under `.aplp`. It is centralised, but it is a *separate*
centralisation from the app.

---

## 2. Colour is split-brain, and this is the real finding

**Athlete and coach are already tokenised.** `app/globals.css` defines the full palette
(`--bg`, `--surface`, `--accent`, `--green`, `--text-dim`, and so on) plus four recovery
phase themes that reskin `--accent` by `[data-recovery]`. **74 component files** consume
those variables. This part of the codebase already does what Task 7 asks for.

**The admin portal does not participate at all.** 31 admin files each declare their own
local palette object:

```ts
const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  ...
}
```

**24 of those 31 are byte-identical.** Two are near-identical variants with a field
added or missing, and `#0b0f16` appears as a third, different palette in one file.

Worse than the duplication: it is a **different colour system**. The app is warm
near-black (`--bg: #0c0c0f`); the admin portal is GitHub blue-black (`#0d1117`). Changing
the brand today means editing `globals.css`, then 31 admin files, then the landing page
stylesheet, and the three will still not match.

This single finding accounts for most of the admin column above.

---

## 3. Everything that is not colour has no token layer whatsoever

There is no `--radius-*`, no `--space-*`, no `--text-*`, no `--weight-*`, no `--shadow-*`
anywhere in the codebase. Every one of these is typed as a number at each call site.

| category | instances | distinct values | realistically collapses to |
|---|---|---|---|
| fontSize | 3,166 | 48 | ~8 |
| padding | 1,801 | 320 | ~6 |
| fontWeight | 1,723 | 45 | ~4 |
| borderRadius | 1,471 | 30 | ~6 |
| gap | 950 | 57 | ~5 |

**padding at 320 distinct values is the clearest evidence** that these were picked
per-component rather than from a scale.

The radius values in use include `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24,
44, 50%, 99, 999` plus a handful of per-corner strings. `99` and `999` both mean "pill"
and differ for no reason. Font sizes run `7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12,
12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17...` in half-pixel steps, which is not a scale
anyone designed, it is accretion.

---

## 4. Two categories are already fine

**fontFamily needs almost nothing.** The 608 instances are only four real values:

| value | count |
|---|---|
| `'inherit'` | 375 |
| `'monospace'` | 198 |
| `MONO` (a local constant) | 20 |
| `'ui-monospace, monospace'` and three other stacks | 15 |

`'inherit'` is arguably correct as-is. This category is a rename, not a refactor, and it
is the lowest value item in the task.

**boxShadow is 8 instances total.** Effectively a non-issue.

---

## 5. Breakpoints have no shared scale

Directly relevant to step 4 of the spec, the responsive audit.

| breakpoint | where |
|---|---|
| `min-width: 768px` (×5) | app shell, coach shell, sidebar, safe-area blocks |
| `min-width: 600px` | coach grids only |
| `max-width: 480, 720, 760, 800, 840, 900, 920, 960` | landing page only |

The app has effectively **one** breakpoint (768px) with a single 600px exception. The
marketing site has **eight**, on a completely different scale, and none of them align
with the app's. The spec asks for verification at six widths; today there is no shared
definition of what those widths are.

**Technical constraint worth knowing up front:** CSS custom properties **cannot** be used
inside `@media` conditions. `@media (min-width: var(--bp-tablet))` does not work in any
browser. So breakpoints cannot become tokens in the same way colours can. They have to be
a documented constant set that we apply by convention, or move to a build step. I would
document the set and keep plain numbers.

---

## 6. Proposed token layer

Semantic names, per the spec. Values are the **current** most-common values, chosen so
that adopting them changes nothing visually.

```css
/* radius */
--radius-chip: 4px; --radius-input: 8px; --radius-card: 12px;
--radius-panel: 16px; --radius-modal: 20px; --radius-pill: 999px;

/* spacing */
--space-tight: 6px; --space-inline: 8px; --space-row: 12px;
--space-card: 16px; --space-section: 24px; --space-page: 40px;

/* type scale */
--text-micro: 10px; --text-caption: 11px; --text-meta: 12px;
--text-body: 14px; --text-subhead: 16px; --text-title: 20px; --text-display: 28px;

/* weight */
--weight-regular: 400; --weight-medium: 500;
--weight-semibold: 600; --weight-bold: 700;

/* elevation */
--shadow-card; --shadow-modal; --shadow-accent-glow;
```

### The one place the spec conflicts with itself

Step 3 says all four surfaces should consume the same tokens. Step 5 says nothing may
move visually. **The admin portal is genuinely a different colour scheme**, so pointing it
at `--bg` would repaint the entire admin portal, which breaks step 5.

The resolution is one token *system* with a surface scope, so the names are shared and
the values stay per-surface:

```css
:root            { --surface-page: #0c0c0f; }   /* athlete + coach, unchanged */
[data-surface="admin"] { --surface-page: #0d1117; }   /* admin, unchanged */
```

Same semantic names everywhere, identical pixels everywhere, one file to edit when the
brand changes. That satisfies both rules. **This is the main decision I need from you
before writing any code.**

---

## 7. Not in scope

- **`lib/data.ts` (1,115 colour literals).** These are 81 embedded SVG illustrations for
  the recovery and anatomy screens. Artwork, not styling. Recolouring them would change
  visuals, so they are excluded. Counting them would have inflated the athlete column by
  27%.
- **Tailwind.** `globals.css` imports it, but the codebase styles with inline objects by
  convention. No utility-class migration here.
- **The `[data-recovery]` phase themes.** They already work correctly through `--accent`
  and are a good example of the pattern to extend.

---

## 8. One thing to decide separately

`app/admin/mockup-a/page.tsx` holds **250 hardcoded values** and **nothing in the codebase
links to it**. It is reachable only by typing the URL. Before spending effort tokenising
a page no one can navigate to, it is worth confirming whether it is a leftover mockup and
deleting it instead.

---

## Suggested order of work

1. **Admin palette first.** 31 files to 1. Biggest single reduction, zero visual risk,
   because 24 of them are already identical.
2. **Radius and spacing.** Mechanical, high volume, easy to diff.
3. **Type scale.** Highest count, needs the most care because of the half-pixel sizes.
4. **Breakpoints and the responsive audit** (step 4), which is really its own task.
5. **fontFamily and shadows** last. Barely worth doing.
