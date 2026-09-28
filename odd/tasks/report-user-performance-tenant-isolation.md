# Report user performance tenant isolation

## Objective
Prevent `GET /api/reports/users/performance?userIds=...` from revealing the names of users who do not belong to the selected organization.

## Scope and constraints
- Restrict name resolution to current organization membership OR sales recorded in that organization when `organizationId` is present. Preserve historical sellers after membership removal, shared members and the global SuperAdmin view without a selected organization. A foreign selected ID with neither membership nor scoped sales must not be returned.
- Change only the report service and mocked tests; do not connect to a user database. Product-category isolation, schema-level tenant foreign keys, and unrelated reports are separate work.
- Branch `fix/report-user-performance-tenant-isolation` starts from `origin/master` after PR #165.
- Strict TDD: **on**, from `openspec/config.yaml` (`strict_tdd: true`, `rules.apply.tdd: true`); backend Jest runner `cd backend && npm run test`, focused using `--runInBand --runTestsByPath src/reports/reports.service.spec.ts`. Observe RED before GREEN. On Windows the child shell may lack bash; a parent PowerShell fallback must report exact results, not invent them.
- Delivery strategy: ask-on-risk; revised forecast about 300 authored changed lines (additions plus deletions) after the accepted historical-seller scenario required two-period sales mocks. One behavior/test work-unit commit, with task evidence tracked separately when needed to record its hash. Rollback: revert the report-service membership predicate and its regression tests; no data migration.

## Task checklist
- [x] **RPT-1 — Resolve performance-report users within the selected organization.** Route: delegated `gentle-ai-worker` (service and tests are two nontrivial edit surfaces; preparation and writer triggers). Regressions: foreign selected ID without scoped sales is omitted; current/shared member appears; removed member with historical scoped sales still appears; global SuperAdmin remains unfiltered. Observe RED for the historical scenario before revising the current-membership-only implementation, then GREEN and backend build. Close with Conventional Commit including tests and record hash plus check results.

## Progress and evidence
- Static trace: sale aggregates are organization-scoped but `user.findMany` by selected IDs alone resolves foreign names. `OrganizationUser` is the membership relation and removing a member deletes its row. No runtime reproduction or DB access yet.
- Current status: RPT-1 behavior and focused checks complete; user chose to preserve historical sellers after removal when scoped sales prove the relationship. Implementation uses conditional membership OR historical-sale relation. Work-unit commit created; native review and push pending.
- TDD: first RED 2 failed/8 passed (missing membership predicate), first GREEN 17/17 service+controller. Second RED 2 failed/10 passed (missing historical-sales branch), final GREEN 19/19 service+controller after test readability pass. All runs via parent PowerShell `npm.cmd` fallback because child bash cannot launch.
- Verification: final parent PowerShell Jest 19/19 service+controller passed and backend build passed after test formatting; `git diff --check` passed. Independent structural verifier found no actionable issue but could not launch bash. Read-only ESLint on changed files failed with existing 21 Prettier errors (all outside changed lines) and 30 warnings; four new test formatting errors found initially were fixed before final rerun. Full suite/HTTP-DB integration not run because no isolated disposable DB. Native assessment was unassessable due untracked task file; high-risk verification plan satisfied by writer checks plus independent structural verifier.
- Work-unit commit: `fbdb2a74d1148fbbfc469c0bd893a6a347fe1175` (`fix(reports): scope performance users to organization history`). Review and branch push pending; do not record review outcome in this repository document because changing it after review would create a new candidate.
