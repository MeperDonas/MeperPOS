# Feature: dashboard-redesign

Redesign of `/dashboard` and its sidebar shell, adapting selected ideas from a reference mockup
onto the existing dashboard. Supersedes the closed SDD `dashboard-coherence`.

Branch: `feat/dashboard-redesign` (from `master`)

## Objective

Answer "what happened today, what needs my attention, and how is the business trending" on one
screen, with a denser and better-organised layout, without duplicating the full historical analysis
of `/reports`.

## Why this exists

The current dashboard (`QuickActions` + `TodayStats` + `CategoryStackedChart` + `AlertPanels`) was
the shipped result of the `dashboard-coherence` SDD. Three of that SDD's confirmed decisions are
now deliberately revised by the user:

1. **D4 of the old SDD** said "NO recharts — heavy dependency for a single chart". The redesign
   grows to ~4 chart surfaces (stacked bars, sparklines, donut, ranking), so a library is now the
   cheaper option. **Reversal is deliberate and confirmed.**
2. **The old SDD's core intent** was that `/dashboard` must not duplicate `/reports`. The redesign
   adds three report-shaped widgets (payment methods, top-selling products, recent sales) as a
   **range-limited operational snapshot**, not the full analysis. **Confirmed evolution.**
3. **The old SDD fixed misleading "Hoy/Ayer" labels.** Any delta shown must be derived from real
   `useDailySales` data, never decorative.

## Scope

### In scope (frontend only)

- **A. Sidebar — 4 blocks** (`frontend/src/components/layout/Sidebar.tsx`):
  1. Brand: logo + "MeperPOS" at the same visual weight (today logo 32px vs text 16px).
  2. Date + time (moves up; today it sits at the bottom of the user card).
  3. Navigation (unchanged).
  4. User block: name + theme toggle + logout, grouped and ordered.
- **B. Section 2 — 8 KPI cards, 4 + 4**:
  - Row 1 (real sparkline + delta vs yesterday, from `useDailySales`): Ventas hoy, Salidas hoy,
    Transacciones, **Ticket promedio** (new; `computeTodayMetrics` already returns `ticket`).
  - Row 2 (accumulated, no sparkline/delta): Ventas completadas, Productos totales, Clientes
    totales, Stock crítico.
  - "Stock crítico" absorbs the **Reordenar** action; the standalone low-stock panel is removed.
  - `QuickActions` is removed (losing Nuevo producto / Nueva venta / Nuevo gasto shortcuts).
- **C. Sections 3+4 — one piece at 60/40 with fixed height**:
  - Left: category stacked bar chart, **rebuilt with Recharts**.
  - Right: two stacked cards — "Métodos de pago" (donut, **3 methods only**; there is no "Otros")
    and "Productos más vendidos" (**top 5, no thumbnails** — the endpoint returns no image).
  - **One shared range selector** for the whole piece: 7 días (default) / 15 días / 1 mes.
  - Chart title and axis labels must follow the selected range (currently hardcoded to the month).
- **D. Section 5 — mini "Ventas recientes"**: 5 rows, no scroll. Columns: `#` / hora / cliente /
  método de pago / total / estado, plus a "Ver todas" link. Reuses `useSales` (no backend).
- **E. Final panels**: remove the low-stock panel; keep "Gastos por pagar" and "Tareas abiertas",
  compacted so the page does not grow unbounded.

### Out of scope

- Top bar (global search / notifications / branch chip) — explicitly rejected by the user.
- Backend changes of any kind. Top products ship without images; payment methods show 3, not 4.
- The `INVENTORY_USER` dashboard role gap (pre-existing bug, tracked separately below).

## Constraints

- Reuse existing hooks/endpoints. No new backend routes.
- Chart library: `recharts@3.3.0` (peer-dep React 19 `^19.0.0`, Next App Router via `'use client'`).
- Fixed heights for the 60/40 piece so the two right cards never resize against the chart.
- The page cannot be made completely scroll-free at 1080p with 8 cards + 3 charts + a table + 2
  panels; "no scroll" means **compact and bounded**, verified on screen.

## Task checklist

- [x] **T1 — Recharts foundation**: `recharts@3.3.0` installed (commit `a1a68a7`). No wrapper was
      needed — Recharts takes colour props directly, so theme mapping is inline per chart. Blocks
      T4, T5, T6.
- [x] **T2 — Sidebar 4 blocks**: restructure `Sidebar.tsx`; keep `OrganizationSwitcher` (it renders
      `null` for single-org users by design — no reserved space). Commit `3ea93f0`.
- [x] **T3 — Section 2 KPIs**: 8 cards in a 4+4 grid; row 1 carries a real sparkline and a real delta
      vs yesterday; Ticket promedio added (reusing `computeTodayMetrics`); Reordenar moved into the
      Stock crítico card; `QuickActions` deleted. Commit `3429cf3`, corrected by `c3690e5`.
- [x] **T4 — Sections 3+4 piece**: 60/40 fixed-height grid; single shared range selector
      (7d default / 15d / 1m). Commit `885fd92`.
- [x] **T5 — Stacked bar chart on Recharts**: title and axis follow the range; Recharts' own tooltip
      replaces the hand-rolled binary flip. Commit `885fd92`.
- [x] **T6 — Payment methods (donut) + top-selling products (top 5, no thumbnails)**. Commit `c2bb8c1`.
- [x] **T7 — Recent sales mini table** (5 rows) via `useSales`. Commit `88d2b9a`.
- [x] **T8 — Final panels**: drop low stock; compact gastos + tareas. Commit `88d2b9a`.
- [x] **T9 — Verification**: full frontend suite 611/611, build green, lint at baseline. On-screen
      check still pending (needs a browser — see progress).

## Acceptance criteria

- Sidebar shows the four blocks in the specified order; brand reads as one unit.
- Section 2 renders 8 cards in two rows of 4, with real sparkline/delta only on row 1.
- The 60/40 piece keeps a constant height across all three range options.
- The three cards in the piece always move together on the same range.
- No fake/derived-only metric is displayed; no thumbnail is faked for top products.
- The mini recent-sales table never scrolls internally.

## Delivery strategy

**`stacked-to-main`** (chosen by the user on 2026-10-11). Each PR targets the previous PR's branch and
merges to master in order, so a reviewer sees only that slice's diff. Proposed slices:

| PR | Content | Commits |
|----|---------|---------|
| 1 | Sidebar in four blocks | `3ea93f0` |
| 2 | Recharts + Section 2 (8 KPIs) | `a1a68a7`, `3429cf3`, `c3690e5` |
| 3 | Range helpers + payment/top-product cards | `a31dc29`, `c2bb8c1` |
| 4 | 60/40 revenue piece + Recharts chart | `885fd92`, `136c16e` |
| 5 | Recent sales + final panels | `88d2b9a`, `5b70c0a` |

Pushing to the remote requires explicit user authorization (not yet granted).

## Progress / evidence

- 2026-10-11 — feature document created. No source writes yet.- 2026-10-11 — **T2 done**, commit `3ea93f0` `feat(dashboard): restructure sidebar into four blocks`
  (+99/−48 across `Sidebar.tsx` and `Sidebar.test.tsx`). Sidebar now renders brand → clock → nav →
  user, with the wordmark at `text-2xl` so it reads as one lockup with the 32px logo.
  - Evidence: `npx vitest run src/components/layout/Sidebar.test.tsx` → **11 passed (11)** with a
    FRESH `localStorage` file, reproduced twice. ESLint clean.
  - **Correction (my earlier diagnosis was wrong):** the first run reported `1 failed | 10 passed`
    and I attributed it to a pre-existing base failure. The independent verifier showed the real
    cause: the shared `--localstorage-file` **persists** `selectedOrganizationId=org-a` between runs,
    so the SuperAdmin scope-change test fails on ANY revision with a polluted file and passes on any
    revision with a fresh one (base 9/9, HEAD 11/11). It is a **test-isolation artifact**, not a base
    bug and not a regression.
  - Environment caveat (repo-wide, pre-existing): frontend vitest cannot run bare because Node v26
    exposes a global `localStorage` that jsdom cannot override. Working command, with a **unique** file
    per run to avoid the pollution above:
    `NODE_OPTIONS="--localstorage-file=/tmp/opencode/vitest-ls-<unique>.json"`. Proper fix would be one
    line in `frontend/vitest.setup.ts` — outside this plan's scope.
- 2026-10-11 — **RDD blocker**: `gentle-ai review assess` returns `risk: high` / reason `unassessable`
  — "the active runtime is not eligible for immutable receipt review; supported immutable review
  runtimes: claude-code, codex". The native review cannot run on the OpenCode runtime, so every
  commit reports `review_due: high_risk` permanently. **User decision: keep RDD on and use the
  independent-verifier fallback for every unit.**
- 2026-10-11 — **T1 done**, commit `a1a68a7` `chore(dashboard): add recharts dependency`. Installed
  `recharts@3.3.0` (peer `react ^19.0.0` confirmed). Only `package.json` + `package-lock.json`.
- 2026-10-11 — **T3 done**, commit `3429cf3` `feat(dashboard): rebuild the KPI section as eight cards
  in two rows` (+495/−227, 10 files incl. 2 deletions).
  - Row 1 (real sparkline + delta): Ventas hoy, Salidas hoy, Transacciones, Ticket promedio.
    Deltas come from `computeDelta(today, yesterday)` over the real daily series; a zero/absent
    yesterday yields `percentage: null` → "Sin base". No delta is ever invented.
  - Row 2 (totals, no sparkline/delta): Ventas completadas, Productos totales, Clientes totales,
    Stock crítico (now hosting Reordenar → `/inventory?filter=lowStock`).
  - `MetricCard` extended additively (`sparkline?`, `action?`); `/reports` unchanged (verified:
    its 7 evidence tests still pass).
  - Evidence: vitest on TodayStats + MetricCard + lib/dashboard + page.evidence → **54 passed (54)**;
    eslint clean; `tsc --noEmit` clean.
  - Independent verification: `verified_with_caveats`, **no faked/invented metric found**. Two
    caveats: (a) the window was 8 days when yesterday already sat inside 7; (b) the "Sin base" pill
    rendered a green up-arrow.
- 2026-10-11 — **T3 correction**, commit `c3690e5` `fix(dashboard): stop the "Sin base" delta pill
  from implying growth` — neutral pill with no arrow when there is no baseline; KPI window trimmed to
  7 days. Evidence: vitest on the 5 affected suites → **61 passed (61)**; tsc + eslint clean.
  (This one was fixed inline by the orchestrator and verified by the parent, not by a fresh verifier.)
- 2026-10-11 — **Environment finding**: Recharts 3.3's `ResponsiveContainer` needs `ResizeObserver`,
  which jsdom lacks. The sparkline sets a percentage width directly on the chart instead, which
  routes through Recharts' `ReadSizeOnceDiv` and renders safely under vitest.

## Progress (T4–T6)

- 2026-10-11 — **T4+T5+T6 done** as two commits, `c2bb8c1` + `885fd92` (~982 authored additions,
  12 files: 6 modified, 6 created).
  - The full-width "Ingresos de {mes}" card is replaced by `<RevenueSection />`: a 60/40 piece with
    the stacked chart left and the payment-methods + top-products cards stacked right.
  - **One shared range selector** (7 días default / 15 días / 1 mes) hands the same start/end to all
    three cards, so they can never disagree.
  - Height pinned at `lg:h-[26rem]` with `h-full` + `min-h-0` + `overflow-hidden` children, so
    changing the range changes only the bar count and never resizes the piece.
  - `CategoryStackedChart` rebuilt on Recharts; the month-hardcoded title/axis and the hand-rolled
    two-position tooltip are **deleted** (grep for `tooltipTranslate` / `isRightSide` → no matches).
  - Payment methods: exactly 3 slices (CASH/CARD/TRANSFER), **no "Otros"**. Top products: top 5,
    **no thumbnails**. Nothing fabricated.
  - `1 mes` is a **rolling 30-day window**, consistent with the rolling 7/15-day options.
  - Evidence: vitest on the 6 affected suites → **58 passed (58)**; eslint clean; `tsc --noEmit` clean.
  - Independent verification: `verified_with_caveats`, **no fabricated data found**. Caveats are
    wording only: (a) the two right cards are each ~half the left card's height, so it is the right
    *column* that matches the left card; (b) the card title is static ("Ingresos por categoría") and
    what follows the range is the "Últimos N días" badge plus the axis.
  - Caveat the user may want to overturn: `1 mes` = rolling 30 days, not the calendar month.

## Progress (T7–T9)

- 2026-10-11 — **T7+T8 done**, commit `88d2b9a` `feat(dashboard): add recent sales and compact the
  final panels` (6 files: 4 modified, 2 created).
  - `RecentSalesCard`: the last 5 sales (`useSales({ limit: 5 })`, plus a `.slice(0,5)` guard) in a
    minimum-column table (#, hora, cliente, pago, total, estado) with a "Ver todas" link to `/sales`.
    The list has no overflow utility anywhere in its chain, so it can neither scroll internally nor
    grow. Payment labels match `/sales` (none → "Sin pago", one → the method, several → "Mixto").
  - `AlertPanels`: the low-stock panel is **removed** (grep for `useLowStockProducts` → no matches);
    only "Gastos por pagar" and "Tareas abiertas" remain, capped at 2 rows each and side by side from
    `md` up.
  - Evidence: vitest on the 3 affected suites → **24 passed (24)**; eslint clean; `tsc --noEmit` clean.
  - Independent verification: **`verified`** — all 10 claims confirmed.
- 2026-10-11 — **T9 done** (verification).
  - Full frontend suite: **79 files, 611 tests passed**.
  - `npm run build`: **succeeds**, `/dashboard` prerendered.
  - `npm run lint`: **26 problems (4 errors, 22 warnings)**, byte-identical to the stashed baseline —
    no lint regression. All 4 errors are pre-existing (`settings/(advanced)`, `settings/(invoicing)`,
    `components/ui/CurrencyInput.tsx`). The one warning this work introduced (an unused `userEvent`
    import in `AlertPanels.test.tsx`) was fixed in `5b70c0a`.
  - **Still pending: the on-screen check.** The constant piece height and the 4+4 KPI grid were proven
    by CSS analysis and unit tests, but jsdom has no layout engine, so nobody has looked at it in a
    real browser yet.

## Next step

Implementation is complete. Delivery is the remaining step: create the stacked PRs, which needs
explicit push authorization. The on-screen check (constant piece height + the 4+4 KPI grid) still
needs a browser and is pending on the user.

## Mirror status

**PENDING.** Engram `mem_save` for the `odd/dashboard-redesign/tasks` mirror started failing on
2026-10-11 with "multiple active runtime sessions match the current project and directory" (the
delegated workers opened sessions in the same project). The local document is the source of truth;
the mirror needs a resync from a session with a bound ID, or after the stale sessions are closed.

## Known separate issue (not in this plan)

`INVENTORY_USER` can open `/dashboard` (`DashboardLayout.tsx:13`) but every data source it uses is
ADMIN-only (`ReportsController` is `@Roles(OrgRole.ADMIN)`; `GET /products/low-stock` is
`@Roles(ADMIN, MEMBER)`), so that user sees empty/zeroed panels. Flagged for a separate fix.
