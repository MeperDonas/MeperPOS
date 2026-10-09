# POS filter/grid recovery

## Objective and authorized scope
Recover stranded query filters, POS/category pagination onto fresh master; harden Services feedback, cap POS rows at five cards, and fix hard-refresh capacity initialization before a feature-branch PR chain.
- Services off means all types; preserve search/Favorites, reset page 1.
- Responsive <=5 tracks, measured full rows; pager outside capacity area. Responsive category modal two columns.
- User authorized commits, push, PR publication, and now the narrow POS observer reload fix. No global auth/client/hooks changes, merge, or deployment.
- Single writer; English technical artifacts and existing Spanish UI conventions.
- Preserve unrelated untracked `.pi/`, `odd/prs/`, `odd/tasks/ui-pagination-fixes.md`.
- Delivery: user-selected `feature-branch-chain`. Recovery 997 diff lines/13 files; first fix146/4; reload fix forecast under150. Advisory size budget; split cohesive work units, no code golf.

## Tasks
- [ ] T1 Recover existing work units and verify baseline. Parent Git + delegated verifier. Recovery complete; database integration blocker keeps task partial.
- [x] T2 Harden Services boundary feedback and cap CSS/capacity at five columns. Delegated worker, acknowledged native review. Commit `57c762204994441b845e742e8836a0ffaa15f54b`; 83 tests PASS. Original production Services symptom remains unproven.
- [x] T5 Fix observer initialization after deferred auth/layout mount with deterministic RED/GREEN regression. Delegated worker (two nontrivial files); independent66-test spot check PASS and native review acknowledged. Commit `35c0f46da0ec939f4473daf42bea17a6cf55b35b`, pushed/read back. Auth semantics and max-five preserved.
- [ ] T3 Verify browser layouts/toggle/category/reload and database integration; native-review recovered slices. Delegated verifier + parent review. Runtime unavailable; partial.
- [ ] T4 Prepare correctly ordered feature-branch PR chain to master. Parent Git/GitHub. IN PROGRESS: branch updated/pushed; PR publication awaits matching approved issue. Reload code fix complete; runtime proof remains under T3. No merge/deploy.

## Acceptance
Repeated Services on/off during pending/empty/error preserves other filters; explicit query error/retry. CSS/capacity agree <=5 across widths. On initial auth loading grid is absent; after loading ends observer attaches, replaces initial limit1 with measured capacity, remains responsive, and cleans up on unmount. No global authentication or query-enable changes. Report focused tests, typecheck/lint, real browser/API and database checks independently; local/source proof is not production proof.

## Branch and work-unit evidence
Branch `fix/pos-filter-grid-recovery` from `1659d480cc88f403b9b164d976c16cc11f3b9091`; merge-base confirmed. Recovered without conflicts:
- `45d6135` from `ed0f522`: product query filters173diff lines; review pending.
- `aed1a48` from `42dafc3`: POS pagination424; review pending.
- `b8f1373` from `29dc5ae`: category modal400; review pending.
- `57c762204994441b845e742e8836a0ffaa15f54b`: POS cap/Services accessibility/error feedback146.
- `35c0f46da0ec939f4473daf42bea17a6cf55b35b`: attach observer after auth loading clears106; pushed/read back.
PR196 merged parent before children197–199; child merges did not propagate to master. Push succeeded; latest remote readback35c0f46. No PR created yet. Old PRs lack approved-issue linkage; loaded branch-pr skill requires one, so do not invent approval/link unrelated issue. Tracker must remain draft/no-merge until children integrate.

## Checks and review
Baseline verifier `muyc6o1u-2-gc4e`: focused frontend70PASS; backend products128PASS/5integrationFAIL at localhost5432 plus undefined-fixture teardown; nonincremental tscPASS. Services control never disabled; real stuck symptom unreproduced.
Worker `muycc0oa-3-4lmo`: RED5FAIL/58PASS (missing error/aria-pressed/column ceiling), GREEN63PASS, final four-file83PASS. tscPASS; scoped eslint exit0 with preexisting loader dependency warning; diff-checkPASS. Pending/empty toggles passed before edits, not fabricated RED. Rollback57c7622 removes only new hardening/tests, retains recovery.
Native mode ON global, unchanged. Four-file146-line fix medium, one reliability reviewer; lineage `review-2818b8b6a7d19ebc` approved and exact acknowledgement succeeded/authority burned before commit. Not approval of recovered slices or delivery authorization. Initial assess unavailable due to undeclared untracked files; inspect excluded unrelated untracked paths.
Verifier `muyci2cv-4-zfjj` settled partial: layout12PASS, backend controller/service83PASS; ports3000/3001/9222/5432 unavailable. No browser/app/DB launched, no actual track measurements or authenticated runtime proof. Installed browser dependencies alone are not runtime evidence.

## Reload diagnosis
User screenshot one card/170total and request limit1 after refresh; route reentry restores capacity. Explorer `muydkuxb-5-pz90`: POS pageSize/capacityRef starts1; mount-only effect exits on null refs while DashboardLayout withholds children during auth loading, never retries. Strong local explanation; production SHA unknown. Early products/customers/settings401 may refresh/retry, not proof of persistent auth failure. Existing tests passthrough-mock layout and miss deferred mount. User now authorizes narrow observer fix, not global auth changes.

## T5 completed evidence
Worker `muyevc9f-6-2n6i`: reproduced limit1 with grid withheld during auth loading; effect now guards authLoading and depends on it. RED2FAIL/64PASS; GREEN66PASS; final four-file85PASS, nonincremental tscPASS, scoped eslint exit0 (preexisting loader dependency warning), diff-checkPASS. Tests cover ready/deferred mount, card counts/pager, resize/reset, repeated loading, observer/listener cleanup and inert callbacks after unmount.
Independent verifier `muyf00no-7-g6t1`: exact focused POS/layout66PASS; loading-gate mock fidelity confirmed for relevant lifecycle. StrictMode safety inspected but not explicitly executed; mock omits redirects/actual spinner/authentication gate/layout geometry. No severe regression found. Native lineage `review-1acfb9933c0e2f05` medium106lines, one reliability reviewer, approved then exact acknowledgement completed (`authority: burned`) before commit. No auth/API/client edits. Rollback: revert35c0f46 removes only observer loading dependency and regression tests. Production/browser/401-retry proof remains unavailable; fix cannot claim to resolve unrelated401s.

## Next step
Resolve matching approved issue for PR publication; preserve feature-branch-chain and draft/no-merge tracker order. Browser/DB and recovered-slice reviews remain pending; no merge/deploy. Latest authorized push35c0f46 confirmed.
