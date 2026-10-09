## Summary
Paginate category products in a responsive two-column modal. Planned draft; label: `type:bug`. No merge pending visual checks/CI.

## Scope and changes
| Area | Change |
|---|---|
| Category modal | Responsive columns and server paging |
| Shared Modal/tests | Preserve default scrolling; pagination/layout regressions |

Out of scope: POS behavior, money/stock rules, roles, ODD/profile artifacts.

## Checks and limits
Own snapshot `29dc5ae`: frontend 601 tests/78 files and typecheck PASS. Prior normal-workspace full tree: frontend build (30 pages), backend 83 mocked tests/build PASS; focused category 19 PASS. This snapshot's linked-worktree frontend build FAIL (Turbopack: node_modules symlink outside root); backend build there NOT RUN. Independent final committed-tree `29dc5ae` builds PASS in normal non-junction workspace: frontend 30/30 pages; backend Prisma generation + Nest. HEAD unchanged; tracked tree clean before/after. Linked-worktree builds not rerun. Backend test-file tsc: 16 unchanged-boundary errors; no clean-base proof. DB/e2e not run. Browser/API unavailable: visual fit and very tall category rows unverified; POS short-height document overflow remains unverified. Final native review unavailable after consent expiry; independent fallback tests PASS, not native approval.

## Chain Context
Stacked to master; 4/4. Base/start and dependency: `fix/pos-filtered-pagination` (includes product-filter API). End: `29dc5ae`, paged category modal. Follow-up: visual checks and CI, no fifth source slice. Budget: 400/400 changed lines; target ≤60-minute review.

```text
master
└─ fix/dashboard-inventory-alerts
   └─ feat/product-query-filters
      └─ fix/pos-filtered-pagination
         └─ 📍 fix/category-modal-pagination
```

Rollback: revert category/Modal/tests together; retain upstream slices. Review shared Modal default-scroll compatibility first.
