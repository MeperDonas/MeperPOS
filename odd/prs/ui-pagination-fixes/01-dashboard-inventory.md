## Summary
Fix dashboard stock alerts and inventory deep links. Planned draft; label: `type:bug`. No merge pending visual checks/CI.

## Scope and changes
| Area | Change |
|---|---|
| Dashboard | Correct statuses, aligned low-stock CTA, fallback icon |
| Inventory | URL low/zero-stock filtering, hidden refresh, null-parameter handling |

Out of scope: POS/category work, server money/stock rules, roles, ODD/profile artifacts.

## Checks and limits
Own snapshot `aaa27bb`: frontend 573 tests/76 files and typecheck PASS. Prior normal-workspace full tree: frontend 601 tests/build (30 pages), backend 83 mocked tests/build PASS. Final linked-worktree frontend build FAIL (Turbopack: node_modules symlink outside root); backend build there NOT RUN. Independent final committed-tree `29dc5ae` builds PASS in normal non-junction workspace: frontend 30/30 pages; backend Prisma generation + Nest. HEAD unchanged; tracked tree clean before/after. This does not establish earlier-snapshot builds; linked-worktree builds not rerun. Backend full test-file tsc: 16 unchanged-boundary errors; no clean-base proof. DB/e2e not run. Browser/API unavailable; visual fit unverified. Final native review unavailable after consent expiry; independent fallback tests PASS, not native approval.

## Chain Context
Stacked to master; 1/4. Base/start: `master`; end: `aaa27bb`, corrected alert navigation. Dependencies: none. Follow-up: product filters below. Budget: 188/400 changed lines; target ≤60-minute review.

```text
master
└─ 📍 fix/dashboard-inventory-alerts
   └─ feat/product-query-filters
      └─ fix/pos-filtered-pagination
         └─ fix/category-modal-pagination
```

Rollback: revert dashboard AlertPanels, inventory page and their tests; coordinate dependent descendants first. Review dashboard-to-inventory navigation before layout.
