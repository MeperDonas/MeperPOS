## Summary
Filter products before server pagination/counting. Planned draft; label: `type:feature`. No merge pending visual checks/CI.

## Scope and changes
| Area | Change |
|---|---|
| Product API | Type, IDs and eligibility filters before rows/count |
| Backend tests | Mocked filter/count contract coverage |
| Product hook | Forward query filters in `useProducts.ts` |

Out of scope: POS rendering, money/stock rules, roles, ODD/profile artifacts. Frontend hook request/cache contract tests arrive downstream in the POS slice.

## Checks and limits
Own snapshot `ed0f522`: frontend 573 tests/typecheck and backend 83 mocked tests/2 suites PASS. Prior normal-workspace full tree: frontend 601 tests/build (30 pages), backend build PASS. Final linked-worktree frontend build FAIL (Turbopack: node_modules symlink outside root); backend build there NOT RUN. Independent final committed-tree `29dc5ae` builds PASS in normal non-junction workspace: frontend 30/30 pages; backend Prisma generation + Nest. HEAD unchanged; tracked tree clean before/after. This does not establish earlier-snapshot builds; linked-worktree builds not rerun. Backend full test-file tsc: 16 unchanged-boundary errors; no clean-base proof. DB/e2e not run. Browser/API unavailable; visual fit unverified. Final native review unavailable after consent expiry; independent fallback tests PASS, not native approval.

## Chain Context
Stacked to master; 2/4. Base/start and dependency: `fix/dashboard-inventory-alerts`. End: `ed0f522`, filter-aware API. Follow-up: POS below. Budget: 173/400 changed lines; target ≤60-minute review.

```text
master
└─ fix/dashboard-inventory-alerts
   └─ 📍 feat/product-query-filters
      └─ fix/pos-filtered-pagination
         └─ fix/category-modal-pagination
```

Rollback: revert product controller/service, their tests and `useProducts.ts` together after coordinating dependent POS consumers; retain dashboard/inventory. Review filtering-before-count first.
