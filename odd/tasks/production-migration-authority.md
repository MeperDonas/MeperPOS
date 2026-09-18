# Feature: production-migration-authority

Issue: MeperPOS #116 — "Establish one production migration and provisioning authority"
Audit: AUDIT-FINDING-010 (HIGH, CONFIRMED). Related: AUDIT-FINDING-011 (out of scope), AUDIT-FINDING-019 (out of scope).

## Why this exists

`docs/runbooks/runbook-despliegue-produccion.md` documents a deployment contract that the
executable scripts do not implement. The audit confirmed the contradiction and left the
migration owner unnamed ("Establish one verifiable owner"), because the owner was lost.

Git archaeology (recorded here because it is the core of the finding):

| Commit | Date | Change |
|---|---|---|
| `9c5fe10` "chore(deploy): preparar app para Railway, Supabase y Vercel" | 2026-03-06 | Introduced `"prebuild": "npx prisma generate && npx prisma migrate deploy"` **deliberately**, explained in `docs/planes/historicos/2026-03-06-deployment-implementation.md:262`: Railway's Nixpacks runs `npm run build` automatically, so migrations had to run before the NestJS build. |
| `e5e9d0a` "Update package.json" | 2026-03-24 | Removed `&& npx prisma migrate deploy` from `prebuild`. Commit message carries no rationale. |

The runbook still describes the 2026-03-06 intent, so it asserts a migration behavior that
no longer exists. Railway production today has only `start:prod` configured and **no
pre-deploy command**, so nothing migrates at deploy time: the application can start against
an older schema.

## Decisions taken (human-owned, this session)

1. **Migration owner**: versioned in `backend/package.json` by making `start:prod` run
   `npm run migrate:prod` **before** the application process:
   `"start:prod": "npm run migrate:prod && dotenv -e .env.production -- node dist/src/main.js"`.
   `migrate:prod` (`prisma migrate deploy`) stays the single migration entry point, reused by
   both the operator and the container start.

   Rationale: acceptance criterion #1 requires a *versioned* owner and the audit's root cause
   is an *unversioned platform control plane*. Chaining keeps the owner in the repository,
   independent of the platform, and fail-closed: if the migration fails the container never
   starts, Railway marks the deploy failed, and the previous deployment keeps serving — code
   is never served against an unmigrated schema.

   **Rejected after verifying Railway's official documentation** (do not re-litigate without
   new evidence):
   - `railway.toml` / Config as Code: it is **deprecated**; "New services cannot opt into
     Config as Code" and "Existing Config as Code files stop being read on 2026-12-01 (hard
     cutoff)". The backend service was created through the dashboard with no CaC file, so a
     newly added file may not even be read. It also overrides dashboard values.
   - `.railway/railway.ts` (Infrastructure as Code, the supported replacement): it owns the
     whole project graph (omit = delete) and requires installing the Railway CLI, adding the
     `railway` package, and `railway link`. Too large a blast radius and too much scope for
     this issue.
   - Migrating inside `prebuild`: writes to the production database during the build, and
     `prebuild` also runs in CI.

   **Constraint for the chained command**: it must work both on the developer's Windows shell
   and in Railway's Linux container, so it must not depend on `sh -c`.

   **Verified environment fact**: `dotenv -e .env.<missing-file>` does not fail (exit code 0,
   the process runs with the platform-provided env). `backend/.env.production` is gitignored
   and therefore absent from the Railway container; this is why production scripts still work.
   Do not "fix" that by committing env files.
2. **Scope**: full slice. Criteria #1 and #2 both, including building the missing
   production-safe provisioning path.
3. **Workflow**: ODD with tasks and strict TDD.

## Verified current state (evidence, not assumption)

- `backend/package.json`: `prebuild` = `dotenv -e .env.production -- npx prisma generate` only.
  `migrate:prod` = `npx prisma migrate deploy` exists separately. `seed` and `seed:org` load
  `.env.development`. `seed:org:prod` requires `SEED_ALLOW_NON_DEV=true`.
- `backend/prisma/seed.ts:414` hard-refuses when `NODE_ENV !== 'development'`; it hardcodes
  `admin@sistema.com` / `admin123` (`seed.ts:26,41`) and creates demo organizations.
- `backend/prisma/seed-org.ts:293-308` has the `SEED_ALLOW_NON_DEV` guard, but it requires a
  pre-existing user that already belongs to an organization (`seed-org.ts:123-142`), so it
  cannot bootstrap an empty production database.
- The **only** place that creates a SuperAdmin is `backend/prisma/seed.ts:41`. The other
  `isSuperAdmin: true` hits are a response DTO (`auth.service.ts:445`) and JWT validation
  (`jwt.strategy.ts:62`). A fresh production database therefore cannot create its first
  SuperAdmin through any supported path.
- `POST /api/admin/organizations` (SuperAdmin-only, `admin.controller.ts:30`) is already a
  production-safe org bootstrap: one transaction creating the organization, the owner user
  with a **random** temp password (`crypto.randomBytes(8)`), the `ADMIN` +
  `isPrimaryOwner` membership, `SALE`/`PO` sequences, and a default cash register
  (`admin.service.ts:40-110`).
- `docs/sdd/audit/triage.md` classifies "missing public `/auth/register`" as a **false
  positive**: registration is disabled and `AuthController` has no register route. Public
  self-registration is therefore not a provisioning path.
- `.github/workflows/ci.yml:57-59` applies migrations as an explicit separate step after
  build, which is the CI precedent for a separate production owner.
- No `railway.toml`, `Procfile`, `Dockerfile` or `nixpacks.toml` exists in the repository.
- `backend/src/runbook.content.spec.ts` asserts on `docs/secrets-rotation.md`, **not** on the
  deployment runbook. The deployment runbook has zero coverage today.
- Test harness: Jest `rootDir: src`, `testRegex: .*\.spec\.ts$` — specs must live under
  `backend/src/`. Integration specs use `setupTwoOrgFixture` from `backend/src/testing/`.

## Acceptance criteria (from issue #116)

- [ ] Exactly one versioned owner executes production schema migrations, verified in the
      runbook, CI, and platform configuration evidence.
- [ ] Production provisioning no longer routes through the development/demo seed path
      without an explicit production-safe alternative.
- [ ] The runbook accurately reflects the versioned scripts and CI migration behavior.
- [ ] Operators can verify that migrations ran before application start in production.

## Tasks

### Work unit 1 — versioned migration owner

1. [x] RED: add `backend/src/deployment-contract.spec.ts` pinning the versioned contract from
       `backend/package.json`: `start:prod` invokes `migrate:prod` and only then starts the
       application (migration strictly ordered first); `migrate:prod` runs
       `prisma migrate deploy` and is the only migration entry point; `prebuild` does not
       migrate. It must fail against the current `package.json`.
2. [x] GREEN: change `start:prod` in `backend/package.json` to chain `migrate:prod` before
       the application process, without breaking Windows or Linux shells.
3. [x] RED: add `backend/src/deployment-runbook.content.spec.ts` pinning the deployment
       runbook to the acceptance criteria: no claim that `prebuild` migrates; the versioned
       owner named with real paths/commands; an explicit operator verification step that
       migrations ran before start.
4. [x] GREEN: correct the runbook sections that assert the removed behavior (lines 27 and 334)
       and name the real owner plus the verification step.

### Work unit 2 — production-safe provisioning

5. [x] RED: add a unit spec for the provisioning decision logic: refuses when
       `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` are missing, refuses weak or known-default
       passwords, is idempotent for an existing SuperAdmin, and refuses to silently promote a
       non-SuperAdmin user without explicit consent.
6. [x] GREEN: implement the pure provisioning plan module plus the thin CLI
       (`backend/prisma/provision.ts`) wired as `provision:prod`, with no demo data, no faker,
       no hardcoded credentials and no dev-mode gate blocking production use.
7. [x] GREEN: rewrite the runbook's initial-provisioning section to route through
       `npm run provision:prod` and `POST /api/admin/organizations`, and remove
       `npm run seed` from every production path.
8. [x] Extend the runbook content spec to pin criterion #2 (no production route through the
       development seed; the production-safe path is named).

### Verification and closure

9. [x] Run the backend suite (`npm run test`) covering unit + integration and record the
       evidence; confirm the new specs fail before their GREEN step (TDD evidence) and pass
       after.
10. [x] Report failed, skipped or pending checks honestly, including the platform-side
        evidence that the repository cannot verify (Railway dashboard confirmation).
11. [x] Native review at the deliverable boundary under the user-owned review switch.

## Verification evidence

Run in this session with PowerShell (the `bash` tool cannot spawn a shell here, and the delegated writer
had no working shell at all, so it could not run anything).

| Check | Command | Result |
|---|---|---|
| Contract spec | `npm run test -- --testPathPatterns=deployment-contract` | PASS, 5/5 |
| Runbook spec | `npm run test -- --testPathPatterns=deployment-runbook` | PASS, 8/8 |
| Provisioning plan spec | `npm run test -- --testPathPatterns=provisioning-plan` | PASS, 15/15 |
| Deployment specs together | `npm run test -- --testPathPatterns=deployment` | PASS, 13/13 |
| Full backend suite | `npm run test` | 79 suites / 839 tests pass; 17 suites / 94 tests fail, all `*.int.spec.ts` plus `reports.golden.spec.ts` |
| Failure cause | one int spec captured | `PrismaClientInitializationError: Can't reach database server at localhost:5432`, 251 occurrences across the run; port 5432 unreachable and the Docker daemon is stopped |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | zero errors in the five new/changed source files; every reported error is in a pre-existing spec excluded from `tsconfig.build.json` |
| Typecheck coverage | `npx tsc --noEmit --listFiles -p tsconfig.json` | confirms all four new files were actually included, including `backend/prisma/provision.ts` |

Note on `--testPathPattern`: this Jest version requires the plural `--testPathPatterns`; the singular form
documented in `AGENTS.md` fails with "Option testPathPattern was replaced by --testPathPatterns".

### RED evidence, reconstructed rather than observed

Strict TDD was not honoured chronologically: the delegated writer could not execute anything, so the
implementation was already on disk before the first test run. No RED output was observed when it should have
been. To avoid claiming unobserved evidence, RED was reconstructed non-destructively: both files changed by
this work were backed up with hashes, restored to `HEAD`, and the new specs were run against the old state.

| Spec | Against old state | Against new state |
|---|---|---|
| `deployment-contract.spec.ts` | FAIL 1/5 - `start:prod` ordering, `migrate:prod` index `-1` | PASS 5/5 |
| `deployment-runbook.content.spec.ts` | FAIL 5/8 - one failure per violated criterion | PASS 8/8 |

The specs are therefore non-vacuous: each failed assertion maps to a real defect in the pre-change state.
The four contract assertions that pass in both states describe invariants that were never broken (for
example, `migrate:prod` already ran `prisma migrate deploy`), so they cannot be RED by construction.
Hashes after restoring the new state matched the pre-check hashes exactly.

## Disclosed deviations

- The provisioning plan reuses the existing shared denylist `COMMON_PASSWORDS` and
  `PASSWORD_MIN_LENGTH` from `backend/src/common/validators/password.policy.ts` instead of duplicating a
  list, which the spec pins. That file was read, never modified. It is stricter than the original plan
  and is the better single-source-of-truth outcome, but it was not in the original instruction.
- Criterion #1 also demands verification in "platform configuration evidence". The repository cannot
  verify the Railway dashboard, and AUDIT-FINDING-019 is explicitly out of scope, so the human-confirmed
  fact is recorded here instead: as of this session the Railway backend service has only
  `npm run start:prod` configured and no pre-deploy command, which is exactly why chaining the migration
  into `start:prod` closes the gap without touching the dashboard.

## Native review outcome

Lineage `review-104f96d1af0051cd`, target `sha256:0690d21865bafa9b01a9f42e21ff4fbd6b374c2ba675d469df0151311a5508da`,
risk tier `medium`, provider-selected lens `review-reliability`, 9 changed files, 1091 original changed
lines, correction budget 200.

Outcome: **approved** on the last admitted event, then acknowledged. Authority burned
(`gentle-ai.review-acknowledged/v1`), consumed revision `sha256:4a8857bcd5ed8f6177335a033140650047826b06873e0d01bf053e938536aa09`.
No correction was opened, so the review never entered the correction path. Delivery remains ordinary
repository policy: this approval authorizes nothing by itself.

Advisory findings, all declared non-blocking by the provider:

| ID | Severity | Location |
|---|---|---|
| R3-1 | WARNING | `backend/src/provisioning/provisioning-plan.ts:152-168` |
| R3-2 | SUGGESTION | `backend/src/deployment-contract.spec.ts:104-105` |
| R3-3 | SUGGESTION | `backend/src/deployment-runbook.content.spec.ts:72-78` |
| R3-4 | SUGGESTION | `openspec/config.yaml:17` |

R3-4 is the unrelated local configuration change that was knowingly included in the candidate, exactly as
predicted before START, and is the reason it earned no correction.

Operator reading of the first two locations (this is inspection of the code, not the reviewer's own wording,
which the closure envelope does not carry):

- R3-1 points at the password validation ordering. A whitespace-only password of at least 12 characters
  currently passes both the denylist and the length rule. A blank/entropy check would close it.
- R3-2 points at `expect.arrayContaining(['build', 'prebuild'])`, which is non-exhaustive by design, while the
  adjacent comment claims the spec must be revisited if those scripts are renamed. An exact-set assertion
  would match the stated intent.

## Follow-up: R3-1 resolved

Finding R3-1 (WARNING, `backend/src/provisioning/provisioning-plan.ts` whitespace password) was fixed in a
separate pass after the first approval, so it started its own candidate and its own review lineage.

Defect: a password of 12 spaces passed every guard. It is not empty, the denylist compares a trimmed value,
and raw length reached the minimum, so `planProvisioning` returned `create` with a secret that protects
nothing. RED reproduced it verbatim:

```
expected a refusal, received action "create" ({"action":"create","email":"owner@meperpos.com","password":"            "})
```

Fix, two additive guards placed **after** the known-default rule and **before** the length rule:

| Code | Rule |
|---|---|
| `PASSWORD_BLANK` | refuses when the trimmed value is empty |
| `PASSWORD_SURROUNDING_WHITESPACE` | refuses when `password !== password.trim()` |

Placing them after the known-default rule was deliberate: the existing assertion that `' admin123 '` yields
`PASSWORD_KNOWN_DEFAULT` stays valid, so the change adds refusals without weakening any verified contract.
Once both rules pass, raw and effective length are identical, which is what makes the minimum-length rule
unfakeable by padding. Nothing is silently trimmed: the operator gets an actionable refusal instead of a
secret that differs from what they will type at login.

Evidence: `npm run test -- --testPathPatterns=provisioning-plan` went from 15/19 (4 RED) to 19/19 GREEN.
Full suite regression check: identical 17 failing suites and identical 251 database-connection errors as
before the change, with totals moving 933 to 937 tests and 839 to 843 passing, so the change added four
passing tests and no new failures.

### Second review (candidate including the R3-1 fix)

Lineage `review-701bbc4f269d227d`, target `sha256:ae916e2de55ee7ca2aac3b9489a2f25982e59f4bbc4671de5693e404a176a340`,
tier `medium`, lens `review-reliability`, 9 files, 1252 changed lines, correction budget 200. Outcome:
**approved** on the last admitted event, acknowledged, authority burned (consumed
`sha256:f4b6dbcbe3bf5fdc6869b458ac657457096650cff29963bcce02b5a4e2ca380a`). No correction opened.

The whitespace finding is absent from this round, which is the evidence that the fix closed it.

| ID | Severity | Location |
|---|---|---|
| R3-001 | WARNING | `backend/src/deployment-contract.spec.ts:43-48` |
| R3-002 | SUGGESTION | `backend/prisma/provision.ts:44-49` |
| R3-003 | SUGGESTION | `openspec/config.yaml:15` |

Operator reading of the first two (inspection of the code, not the reviewer's own wording, which the closure
envelope does not carry):

- R3-001 lands on `stagesOf`, whose comment claims a stage index is "a reliable ordering signal". The split on
  `&&`, `||`, `;` and `|` is a heuristic, not a shell parser: a quoted `"&&"` inside a script argument would be
  mis-split, so the claim is stronger than the implementation.
- R3-002 lands on the read-then-write flow in `provision.ts`: the plan is computed from a user lookup and the
  insert happens afterwards, so a concurrent provisioning run or a unique-constraint violation is unhandled.
- R3-003 is the same unrelated local configuration change flagged before.

### Separate verified defect, deliberately NOT fixed here

The same class of defect is live in the shared policy, which is a much wider surface:
`validatePasswordPolicy('            ')` returns `null`, meaning valid. Confirmed by executing the function,
not by reading it. That policy is enforced through `IsValidPassword` in `auth/dto/auth.dto.ts`,
`users/dto/create-user.dto.ts`, `users/dto/reset-user-password.dto.ts`,
`admin/dto/create-organization.dto.ts`, `admin/dto/add-organization-member.dto.ts`, and directly in
`imports/helpers/validators/user.ts`. `password.policy.spec.ts` does not pin whitespace behaviour, so
nothing blocks a fix; it simply belongs to its own change with its own review, not to this one.

## Out of scope

- AUDIT-FINDING-011: migration chain / DDL reconciliation and clean-replay drift.
- AUDIT-FINDING-019: hosted platform configuration evidence beyond what the repository can
  version; the Railway dashboard confirmation remains a human-verified step.
- AUDIT-FINDING-020: general documentation authority.
- Provisioning demo catalog for a sandbox organization (`seed:org:prod`) — left as is.

## Review workload note

Two work units, each independently reviewable and each under the ~200-line guard. They touch
overlapping files (runbook, package.json), so they should land as two separate commits rather
than one oversized change. No commit is created unless the user explicitly asks.
