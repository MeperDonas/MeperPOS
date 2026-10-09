## Summary
Keep filtered POS pages complete and responsive. Planned draft; label: `type:bug`. No merge pending visual checks/CI.

## Scope and changes
| Area | Change |
|---|---|
| POS | Adaptive capacity; complete services/favorites paging |
| POS tests | Real-hook request/cache contracts; pagination/layout regressions |

Out of scope: category modal, money/stock rules, roles, scanner/cart behavior, ODD/profile artifacts. Real-hook tests in the POS suite complete frontend contract coverage; hook source belongs to the upstream API slice.

## Checks and limits
Own snapshot `42dafc3`: frontend 587 tests/77 files and typecheck PASS. Prior normal-workspace full tree: frontend 601 tests/build (30 pages), backend 83 mocked tests/build PASS; focused POS 51 PASS. Final linked-worktree frontend build FAIL (Turbopack: node_modules symlink outside root); backend build there NOT RUN. Independent final committed-tree `29dc5ae` builds PASS in normal non-junction workspace: frontend 30/30 pages; backend Prisma generation + Nest. HEAD unchanged; tracked tree clean before/after. This does not establish earlier-snapshot builds; linked-worktree builds not rerun. Backend test-file tsc: 16 unchanged-boundary errors; no clean-base proof. DB/e2e not run. Browser/API unavailable: short-height document overflow, mobile overlays/pager wrapping unverified. Final native review unavailable after consent expiry; independent fallback tests PASS, not native approval.

## Chain Context
Stacked to master; 3/4. Base/start and dependency: `feat/product-query-filters`. End: `42dafc3`, filtered POS paging. Follow-up: category/modal below. Budget: 424/400 changed lines; user explicitly accepted 24 extra for this coherent slice; target ≤60-minute review.

```text
master
└─ fix/dashboard-inventory-alerts
   └─ feat/product-query-filters
      └─ 📍 fix/pos-filtered-pagination
         └─ fix/category-modal-pagination
```

Rollback: revert POS page/layout/tests together; retain upstream API and hook. Review filter-to-request/cache behavior first.
