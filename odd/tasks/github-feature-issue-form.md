# ODD: Feature issue form and product redesign tracker

## Objective
Enable a YAML Issue Form on MeperPOS so feature work, including the completed responsive product-card/form redesign, can be tracked in a conforming GitHub issue before publication of its PRs.

## Evidence and constraints
- Target: `github.com/MeperDonas/MeperPOS`, default branch `master`, issues enabled. No `.github/ISSUE_TEMPLATE` on current remote `master` at `2a855082843d842ed01a9350841d7887bd54e455`.
- No equivalent issue found in open/closed searches for product-card redesign, product modal, or issue forms. Search again with selected form and full candidate review before publication.
- Issue-creation policy requires a YAML Issue Form already on the default branch; Markdown/blank issue body is not a fallback.
- Branch-PR policy requires a linked approved issue for every PR; neither issue nor approval may be invented. Repository Git guidance prohibits direct push to the default branch. This creates a bootstrap dependency that cannot be bypassed by publishing a branch alone.
- The responsive redesign is on isolated local branch `feat/responsive-product-card-form` in `../MeperPOS-product-card-form`, with local PR slice refs and no push. Its base predates newly merged stock tracking on `origin/master`; reconcile before proposing a PR. Preserve original `feat/150-untracked-stock` worktree and modified `openspec/config.yaml`.
- No push, issue, PR, merge, or protected label without the applicable gates, even if an artifact is locally ready.

## Plan
- [x] **FORM-1** — Add a reusable YAML Feature Request issue form with unambiguous purpose, required problem/outcome/acceptance fields, optional scope/verification context; validate YAML structure locally and commit on `chore/github-feature-issue-form`. Route: inline direct (one small config file + progress document). Acceptance: exact form is readable, controls valid, no claim of publication.
- [ ] **ISSUE-2** — Once the form is on `master`, follow issue-creation skill: fetch current form/policy and labels, search open+closed duplicates, materialize reviewed answers privately, create/read back exactly once. Route: pending external bootstrap; do not claim issue created until confirmed.
- [ ] **PR-3** — Once a conforming issue is approved by authorized maintainer, reconcile redesign against latest `master`, verify tests/CI, apply review-budget strategy and then publish issue-linked PR slices with exact one type label. Route: pending issue and approval; direct push to master forbidden.

## Progress and evidence
- `FORM-1`: done. Commit `a003284fd57b849d49808e694c2d0e542f89a084`; YAML parsed with installed `js-yaml` (3 required + 2 optional textarea controls, unique IDs); native review `review-2e18bc93dd928404` approved and acknowledged. Branch `chore/github-feature-issue-form` pushed to `origin` at this commit. Rollback: revert this one commit and remove the unpublished form branch only with explicit authorization.
- `ISSUE-2`: blocked until the form is available on `master` by an authorized route.
- `PR-3`: blocked until issue existence/approval and integration with current `master` are verified.

## Next step
Blocked: an authorized maintainer must resolve the issue-first bootstrap dependency and merge the form to `master` by repository policy. Only then may ISSUE-2 proceed; PR-3 additionally needs a conforming approved issue and redesign integration with latest `master`. Do not create a PR without an approved issue, directly push to `master`, or invent approval.
