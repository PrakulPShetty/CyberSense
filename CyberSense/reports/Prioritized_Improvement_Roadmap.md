# SENTINEL-X / "CyberSense" — Prioritized Improvement Roadmap

**Scope:** planning only. **No recommended change in this document was implemented**; the application source is unchanged by this audit.
**Basis:** `CyberSense_Technical_Audit_Report.md`, `Test_Results.md` (executed evidence), `Repository_Inventory.md`.
**Priorities:** P0 = blocker / must fix before any further demo or deploy · P1 = high · P2 = medium · P3 = low.
**Complexity:** Low / Medium / High (engineering effort + risk of the change).

---

## Category 1 — Immediate blockers and critical security concerns

### R-1 · Get the application under version control 🔴 P0
- **Problem addressed:** TD-01 — the entire application tree is untracked (`git status` → `?? CyberSense/`; the only commit contains `.gitattributes` + `README.md`). No history, no rollback, no review trail, no diffable audit evidence.
- **Proposed action:** commit the application tree (respecting the existing `.gitignore`), push to a remote, and keep the audit reports + `reports/.evidence/` as tracked evidence. Decide deliberately whether the app lives at the repo root or in `CyberSense/` (currently the git root sits one level *above* the app).
- **Files:** repository layout, `<app>/.gitignore`, root `README.md`.
- **Complexity:** Low. **Dependencies:** none.
- **Verification:** `git ls-files | wc -l` > 100; `git status --porcelain` clean; a test commit can be reverted.
- **Expected benefit:** removes the single largest project risk (irrecoverable loss / unmaintainable hand-over) and makes every other fix reviewable.

### R-2 · Stop reporting "unknown" as low risk 🔴 P0
- **Problem addressed:** TD-03 / PR-06 / PR-07 — a LIVE scan of a **non-existent** domain returns `PARTIAL`, 0 paths and **score 18 / band LOW** (measured), and a total source failure likewise yields score 18 with confidence 0.4. The product's own doctrine ("absence of records is not absence of risk") is contradicted by the number a user sees.
- **Proposed action:** introduce an explicit insufficient-evidence state (`INSUFFICIENT_EVIDENCE` band or a `null` score) whenever evidence/observation counts fall below a documented threshold; suppress the posture number and say what could not be observed; surface the same state on the executive, report and AI-answer surfaces.
- **Files:** `src/lib/sentinel/risk.ts` (`landscapeScore`, `buildRisk`), `src/lib/sentinel/pipeline.ts` (status derivation, lines ~142/175), `src/lib/sentinel/report.ts`, `src/routes/assessments.$id.index.tsx`, `src/lib/sentinel/types.ts` (`RiskBand`).
- **Complexity:** Medium. **Dependencies:** R-5 (source-status semantics) for a correct trigger signal.
- **Verification:** re-run `screenshots/probe-live.mjs` — an NXDOMAIN / all-sources-failed scan must present `INSUFFICIENT_EVIDENCE`, never `18 LOW`; add a regression test asserting no numeric band for zero-evidence scans.
- **Expected benefit:** removes a materially misleading claim from every screen and report; protects the product's credibility with security reviewers.

### R-3 · Fix the `/twin` hydration failure 🟠 P1
- **Problem addressed:** TD-04 — re-verified this session: `Hydration failed because the server rendered text didn't match the client` on every visit to a twin page (server `14/10/2026, 13:08:43` vs client `1:08:43 pm`), forcing a full client re-render.
- **Proposed action:** render the timestamp through a fixed, explicit formatter (fixed locale + UTC or a documented timezone) or move it into a client-only boundary; apply the same rule anywhere a timestamp is displayed.
- **Files:** `src/routes/assessments.$id.twin.tsx:17`; shared formatter suggested in `src/lib/utils.ts`.
- **Complexity:** Low. **Dependencies:** none.
- **Verification:** `node reports/.evidence/harness/qa-reverify.mjs` → twin page `errorCount: 0`.
- **Expected benefit:** removes a console error and an avoidable full-page re-render on a core evidence surface.

### R-4 · Fix the `/audit` Date-render crash 🟠 P1
- **Problem addressed:** TD-05 — re-verified: `Objects are not valid as a React child (found: [object Date])`; the error boundary replaces the audit page content. Root cause is a typed-as-`string` value that is actually a JS `Date` (result-parser output for `timestamptz`).
- **Proposed action:** normalise timestamp columns to ISO strings at the persistence boundary (as `src/lib/db.ts` already does for `int8`/`date`/`interval`), or format in the view; correct the lying types (`AssessmentRow`, `AssessmentSummary`, `listAudit`'s return type).
- **Files:** `src/lib/db.ts` (add a `timestamptz` parser or cast in SQL), `src/lib/sentinel/repo.ts:409` and its row interfaces, `src/routes/assessments.$id.audit.tsx:27`.
- **Complexity:** Low. **Dependencies:** none.
- **Verification:** re-verify the `/audit` route has 0 console errors and renders the log; add a unit assertion that `listAudit`/`listAssessments` return strings.
- **Expected benefit:** the audit trail — the compliance-visible surface — actually renders; removes a class of latent `Date`-in-JSX bugs (same pattern is one keystroke away in other routes).

---

## Category 2 — Core scanner correctness and reliability

### R-5 · Make source status tell the truth 🟠 P1
- **Problem addressed:** TD-06 / PR-06 — `dohAdapter` always prepends a `hostname_observed` observation (`osint.ts:138`), so the "no records" branch at `osint.ts:151` is unreachable and an NXDOMAIN/NODATA lookup is reported **`COMPLETED`** with zero A records (measured on a non-existent domain).
- **Proposed action:** classify DNS outcomes explicitly (`NO_RECORDS` / `NXDOMAIN` / `COMPLETED`) and propagate that through `SourceRun.status`, the stage log and the UI; keep the doctrine note attached to the non-result, not just to the run notes.
- **Files:** `src/lib/sentinel/osint.ts:118-160`, `src/lib/sentinel/types.ts`, `src/routes/assessments.$id.twin.tsx` (source panel).
- **Complexity:** Low. **Dependencies:** none (feeds R-2).
- **Verification:** injected `{Answer: []}` fetch and the NXDOMAIN probe both report a non-`COMPLETED` status; unit test covering both.
- **Expected benefit:** "we found nothing" and "we looked successfully" stop being indistinguishable — the central correctness claim of a passive collector.

### R-6 · Align simulator baseline with the reported posture 🟠 P1
- **Problem addressed:** TD-07 — measured: snapshot posture **84** vs simulator `beforeRisk` **92**. `simulateDefense` silently substitutes the mean of the top-5 path risks (`defense.ts:251-256`) and also carries a dead expression (`* 0 + (… ? 0 : 0)`), so "before → after" never starts from the executive number.
- **Proposed action:** pass the snapshot's `risk.overallScore` into `simulateDefense`/`optimizeDefense` as the baseline (or recompute it identically), delete the dead expression and the unused `beforeIds` variable, and make the UI label the baseline source explicitly.
- **Files:** `src/lib/sentinel/defense.ts:243-270` (also `:215`), `src/lib/sentinel/api.ts` (`runSimulationFn`, `optimizeFn`), `src/routes/assessments.$id.simulate.tsx`, `src/routes/assessments.$id.optimize.tsx`.
- **Complexity:** Low–Medium. **Dependencies:** none; interacts with R-18 (golden fixture).
- **Verification:** assertion `simulation.beforeRisk === snapshot.risk.overallScore` for the demo twin; UI shows the same number on executive, simulator and report sections.
- **Expected benefit:** the flagship "simulate before you change" workflow stops contradicting itself, which is exactly the kind of inconsistency a security reviewer will find.

### R-7 · Make scan-state reporting real 🟠 P1
- **Problem addressed:** TD-08 / PR-14 — no stage timing (14/14 stages have `startedAt === completedAt`), `current_stage` is the literal `"ready"`, the stage list order (`exposure_twin` before `attack_graph`) does not match execution order, and every stage logs `COMPLETED` even when collection returned zero observations.
- **Proposed action:** capture real per-stage start/end timestamps and per-stage status (including `SKIPPED`/`NO_DATA`), persist `current_stage` as the pipeline advances, and render the declared stages in execution order.
- **Files:** `src/lib/sentinel/pipeline.ts:39-52` and `complete()` call sites, `src/lib/sentinel/types.ts` (`PIPELINE_STAGES`), `src/lib/sentinel/repo.ts:162`, `src/routes/assessments.$id.twin.tsx` (pipeline card).
- **Complexity:** Medium. **Dependencies:** R-5 for meaningful per-source status.
- **Verification:** a DEC-observed run shows non-zero, monotonic stage durations; a zero-observation run shows a non-`COMPLETED` collection stage.
- **Expected benefit:** the "immutable snapshot of what was known" becomes auditable in time and in outcome — required for any operational trust in the twin.

### R-8 · Add bounded retries and a fallback resolver 🟠 P1
- **Problem addressed:** PR-05 — no retry at all: an HTTP 503 fails the source in 0.3 ms; a single hard-coded resolver (`osint.ts:110`) is the app's only live data path (single point of failure).
- **Proposed action:** one or two retries with jittered backoff inside the existing 4 s budget, plus a configurable secondary DoH resolver and a source-health pre-check surfaced in the stage log.
- **Files:** `src/lib/sentinel/osint.ts` (`fetchWithTimeout`, `dohAdapter`, `runAdapters`), `src/lib/sentinel/pipeline.ts:92`.
- **Complexity:** Low–Medium. **Dependencies:** R-5 (so a retry exhaustion is distinguishable from "no records").
- **Verification:** injected transient 503 followed by success yields `COMPLETED` with an attempt count in the run notes; total time stays within the configured budget.
- **Expected benefit:** transient external failures stop degrading scans to "18 LOW", and the external dependency stops being a single point of failure.

### R-9 · Make health/readiness truthful 🟠 P1
- **Problem addressed:** TD-08 / PR-13 — `/api/v1/ready` returns a hard-coded `{status:"ready"}` and the `readyFn` server function hard-codes `database: true`; neither touches the database or any source, so both would report healthy during an outage.
- **Proposed action:** implement readiness as a real probe (`select 1` against the active backend, plus optional DoH reachability) with a bounded timeout and a `503` on failure; keep `/health` liveness-only and say so.
- **Files:** `src/routes/api/v1/ready.ts`, `src/lib/sentinel/api.ts:25-31`, `src/lib/db.ts` (`getSql`).
- **Complexity:** Low. **Dependencies:** none.
- **Verification:** with the DB intentionally unavailable, `/api/v1/ready` returns non-200; with it available, `< 50 ms`.
- **Expected benefit:** deploy automation and uptime checks stop relying on a constant.

### R-10 · Prove or fix cross-assessment identity 🟡 P2
- **Problem addressed:** TD-14 / PR-12 — `stableId` is 32-bit FNV-1a truncated to 8 hex characters (`ids.ts`), and entity ids are assessment-scoped. Two identical scans produced **159 differing id references** (correct behaviour for drift, since `drift.ts` keys on `canonicalId`) but the collision bound (~tens of thousands of ids) is untested and a collision would silently merge two distinct assets/paths.
- **Proposed action:** add a collision test at realistic cardinalities (or widen the hash / use a cheap content hash), document that `canonicalId` is the only cross-scan join key, and add a "duplicate assessment for the same target" indicator.
- **Files:** `src/lib/sentinel/ids.ts`, `src/lib/sentinel/drift.ts`, `src/lib/sentinel/assets.ts`, `src/lib/sentinel/repo.ts` (`createAndRun`).
- **Complexity:** Low–Medium. **Dependencies:** none.
- **Verification:** generate ≥100k synthetic ids/entities and assert zero collisions (or assert uniqueness by construction); a repeated-scan test asserting `drift.events ⊆ expected` when only timestamps differ.
- **Expected benefit:** removes a silent-wrong-answer class from the graph/risk core and makes repeat-scan behaviour explicit.

---

## Category 3 — Security hardening

### R-11 · Replace self-asserted authorization with verifiable ownership for LIVE scans 🟠 P1
- **Problem addressed:** TD-02 — the product's headline control ("authorized targets only") is a free-text phrase (`authorization.ts:21,28`) that the UI pre-fills; combined with no accounts and no rate limiting, anyone with the URL can drive passive DNS lookups against any public domain under the app owner's infrastructure.
- **Proposed action:** require an authenticated operator for LIVE mode, add a lightweight ownership challenge (DNS TXT record or signed token published by the target owner) before LIVE unlocks, persist the evidence of that challenge, and record who ran what.
- **Files:** `src/lib/sentinel/authorization.ts`, `src/lib/sentinel/api.ts` (`createAssessmentFn`), `src/lib/sentinel/repo.ts` (`authorization_records`), `src/routes/index.tsx` (launch form).
- **Complexity:** High (introduces the account model the app currently avoids). **Dependencies:** R-12, R-13; decision on whether LIVE ships at all in a public deployment.
- **Verification:** an unauthorized LIVE attempt is refused server-side (not just in the form); an authorized one records the challenge evidence.
- **Expected benefit:** the central ethical/legal control becomes enforceable rather than declarative.

### R-12 · Add rate limiting and a scan governor 🟠 P1
- **Problem addressed:** TD-02 / PR-09 — no authentication, no per-IP/per-target limits, no queue: unlimited unauthenticated LIVE submissions (each holding an external dependency up to 4 s), and the optimizer blocks the event loop for ~129 ms per click on a single-threaded server.
- **Proposed action:** per-IP/per-target token buckets on `createAssessmentFn`/`optimizeFn`/`explainFn`, a global concurrency cap for outbound collection, and a request budget so a single caller cannot monopolise the worker.
- **Files:** `src/lib/sentinel/api.ts`, new `src/lib/sentinel/limits.ts`, `src/routes/api/v1/*`.
- **Complexity:** Medium. **Dependencies:** R-11 (identity for per-account quotas; per-IP is possible immediately).
- **Verification:** a burst of N concurrent create calls returns `429` beyond the limit while legitimate serial calls stay unaffected.
- **Expected benefit:** closes the resource-exhaustion and abuse-cost exposure that unauthenticated scanning endpoints create.

### R-13 · Log failures, not just successes 🟠 P1
- **Problem addressed:** TD-08 / PR-13 — `audit_logs` records only successful actions; `assessments.error_code`/`error_message` are never written; nothing is logged when a source fails or the pipeline throws.
- **Proposed action:** write failure state to `assessments.error_code`/`error_message` and an `audit_logs` row for rejected/aborted runs, emit a structured log line per scan with duration and source outcomes, and expose the last N failures in the audit view.
- **Files:** `src/lib/sentinel/repo.ts` (insert paths, `audit()`), `src/lib/sentinel/pipeline.ts` (throw path), `src/routes/assessments.$id.audit.tsx`.
- **Complexity:** Low–Medium. **Dependencies:** R-7 for stage context.
- **Verification:** a failing scan (injected source failure) produces an audit row and a persisted error code; the audit page shows it.
- **Expected benefit:** failures become diagnosable instead of invisible; the existing schema columns stop being dead weight.

### R-14 · Protect the AI budget and the CI/secret posture 🟡 P2
- **Problem addressed:** TD-09 (no timeout/quota on the xAI call — see R-26) plus repo hygiene: no branch protection possible while untracked (R-1), `screenshots/` and `.grok/` are gitignored so QA evidence and skills never travel with the code, and no CI exists.
- **Proposed action:** once R-1 lands, add branch protection and a CI pipeline running typecheck, lint, tests, build and the browser smoke check; keep a single secrets path (`XAI_API_KEY`, `DATABASE_URL` from the platform) and add a pre-commit secret scan.
- **Files:** `.github/workflows/*`, `package.json` scripts, `<app>/.gitignore`.
- **Complexity:** Medium. **Dependencies:** R-1, R-16, R-17.
- **Verification:** CI is red on an intentionally broken commit and green on `main`; secret scan blocks a planted dummy key.
- **Expected benefit:** regressions and secret leaks are caught before they ship.

---

## Category 4 — Automated testing and regression coverage

### R-15 · Fix the test command so nothing is skipped silently 🔴 P0
- **Problem addressed:** TD-10/TD-11 — `npm test` exits **0** while executing **0 tests** for `scripts/**/*.test.mjs` (the single-quoted pattern survives `cmd.exe` and matches nothing); the same suites contain **18 failing tests** when actually run (195 tests: 177 pass / 18 fail).
- **Proposed action:** pass explicit file lists or an unquoted directory (`node --test scripts`), then repair or quarantine the 18 failures — restoring the missing `.grok/skills` fixture tree, skipping symlink-dependent tests on Windows, and un-coupling the template-name/app-env assertions (e.g. `grok-pwa-plugin.test.mjs:105` hard-codes `og:title content="Hello World"` while the app injects `SENTINEL-X`).
- **Files:** `package.json` (`test` script), `scripts/*.test.mjs`, fixture tree for `.grok/skills/**`.
- **Complexity:** Low–Medium. **Dependencies:** none.
- **Verification:** a deliberate failure in any `scripts/*.test.mjs` makes `npm test` exit non-zero; documented count becomes 263 executed / 263 passing.
- **Expected benefit:** restores the regression gate; today a green `npm test` proves much less than it appears to.

### R-16 · Cover the untested core (persistence, drift, report, routes) 🟠 P1
- **Problem addressed:** TD-10 — no tests for `repo.ts`, `drift.ts`, `report.ts`, `relationships.ts`, `evidence.ts`, path-enumeration edge cases, `api.ts` server functions, or any route; and two `engines.test.ts` assertions are tautologies (`… || true`) that can never fail.
- **Proposed action:** add `node:test` suites for those modules using the in-memory PGLite backend, replace the tautological assertions with real expectations, and add a smoke test that each route renders with content (the existing Playwright scripts can be reused as the basis).
- **Files:** `src/lib/sentinel/*.test.ts` (new), `src/lib/sentinel/engines.test.ts:91`, `scripts/browser-smoke.mjs`.
- **Complexity:** Medium. **Dependencies:** R-15.
- **Verification:** new suites fail when the corresponding module is mutated (mutation spot-check on 3 assertions).
- **Expected benefit:** the engines that produce every number on screen acquire an actual safety net.

### R-17 · Add a golden-snapshot regression fixture 🟡 P2
- **Problem addressed:** TD-10 — the demo twin's numbers (26 assets, 60 edges, 34 evidence, 16 paths, score 84, momentum ordering) are asserted only loosely, so engine drift (scoring weights, path limits, freshness windows) would pass unnoticed.
- **Proposed action:** commit a frozen expectation for the three demo slices (asset/evidence/path counts, score, band, critical-path count, momentum direction) and assert exact equality.
- **Files:** new fixture + `src/lib/sentinel/engines.test.ts` or a dedicated `golden.test.ts`.
- **Complexity:** Low. **Dependencies:** R-6 (baseline semantics) so the fixture doesn't lock in the current inconsistency.
- **Verification:** the test fails when a scoring constant is perturbed; passes otherwise.
- **Expected benefit:** turns "the demo still looks right" into a checkable invariant.

### R-18 · Wire the browser QA into the project, and stop sleeping 🟡 P2
- **Problem addressed:** TD-11 / §4.2 of `Test_Results.md` — the only browser coverage lives in gitignored `screenshots/*.mjs`, is not exposed as an npm script, and the prior phase's headline "timings" (report 4055 ms, assistant 5050 ms) were fixed `waitForTimeout` sleeps, not measurements; `qa.mjs:8` also carries a lint warning.
- **Proposed action:** promote the QA scripts into tracked `scripts/` with npm script entries (`qa:browser`, `bench:engine`, `probe:live`), replace every fixed sleep with an element-state wait, and have `scripts/browser-smoke.mjs` gate CI.
- **Files:** `scripts/` (moved from `screenshots/`), `package.json`, `<app>/.gitignore`.
- **Complexity:** Low–Medium. **Dependencies:** R-15.
- **Verification:** `npm run qa:browser` produces a JSON verdict with real latencies and fails when a route renders blank or logs a console error.
- **Expected benefit:** every future phase gets trustworthy, reproducible UI evidence instead of hand-run scripts.

---

## Category 5 — Performance and maintainability

### R-19 · Take the optimizer off the request's critical path 🟡 P2
- **Problem addressed:** PR-08 — `optimizeDefense` runs up to 175 full graph simulations synchronously (measured 128.6 ms; 175 × clone-graph + path enumeration + risk rebuild) on the single Node thread; `maxControls` is silently clamped to 3 (`defense.ts:300`).
- **Proposed action:** memoise the control-effect graph clones, evaluate combinations with early pruning (skip supersets of already-dominated strategies), move the search into a worker/background job when the catalog or cap grows, and surface the effective cap in the UI.
- **Files:** `src/lib/sentinel/defense.ts`, `src/lib/sentinel/api.ts` (`optimizeFn`).
- **Complexity:** Medium. **Dependencies:** none.
- **Verification:** re-run `optimize_max3` (target: comfortably under 50 ms, no event-loop stall); assert the same top strategy is returned before/after.
- **Expected benefit:** keeps the most expensive endpoint responsive as the graph grows, without changing recommendations.

### R-20 · Deduplicate snapshot storage and add retention 🟡 P2
- **Problem addressed:** TD-15 — each scan writes the same ~143 KB snapshot twice (`assessments.snapshot` + `twin_snapshots.snapshot`, ≈292 KB/scan measured), a simulation row stores a 54 KB full result, optimizer rows store strategies in two columns, and there is no retention policy.
- **Proposed action:** designate one canonical snapshot store (or store a digest + reference), trim `simulations.result` to what is needed for the row's own columns, drop the duplicated `strategies` copy, and document retention (e.g. keep N snapshots per target).
- **Files:** `migrations/0002_sentinel.sql`, `src/lib/sentinel/repo.ts` (`persistNewAssessment`, `saveSimulation`, `saveOptimization`).
- **Complexity:** Medium. **Dependencies:** R-1 (schema change under version control).
- **Verification:** measurement script reporting bytes per scan before/after; row counts and sizes verified in PGLite; snapshot read path unchanged.
- **Expected benefit:** roughly halves storage growth per scan and keeps the JSONB payloads inspectable.

### R-21 · Seed once, not per request 🟡 P2
- **Problem addressed:** TD-16 — `ensureSeeded()` runs on every `listAssessments()`/`getSnapshot()` (2–3 extra queries per call, `repo.ts:60,74`) and performs a delete-then-recreate of the three demo assessments on revision bumps (`repo.ts:76-78`).
- **Proposed action:** memoise the seed check per process, gate it behind an explicit seed command/flag, and replace the destructive re-seed with an idempotent upsert.
- **Files:** `src/lib/sentinel/repo.ts`.
- **Complexity:** Low. **Dependencies:** none.
- **Verification:** query-count assertion (≤1 seed query per process) and a re-run of the demo bootstrap with existing data left intact.
- **Expected benefit:** removes per-request overhead and a destructive code path from the hot read route.

### R-22 · Extract a configuration surface 🟡 P2
- **Problem addressed:** TD-13 — hard-coded `https://cloudflare-dns.com/dns-query` (`osint.ts:110`), model id `grok-4.5`, 4000 ms abort budget (`pipeline.ts:92`), optimizer cap 3, `MAX_PATHS=16`/`MAX_PATH_LENGTH=7` (`scoring.ts:15-16`), risk-factor maxima (`risk.ts:17-31`) and the demo-org literals are all magic values spread across modules.
- **Proposed action:** centralise tunables in one documented config module (env-overridable where operational, e.g. resolver URL, timeout, collection cap) while keeping scoring constants documented next to their formulas.
- **Files:** new `src/lib/sentinel/config.ts`, `src/lib/sentinel/{osint,pipeline,defense,scoring,risk}.ts`.
- **Complexity:** Low–Medium. **Dependencies:** R-17 (so config moves don't silently change scores).
- **Verification:** equal outputs for default config vs the golden fixture; an env override changes the resolver/timeout as documented.
- **Expected benefit:** operational tuning without code edits, and a single place to document the model's assumptions.

### R-23 · Remove or clearly mark the unused template surface 🟡 P2
- **Problem addressed:** TD-17 — `src/lib/app-data/*` (9 modules), `src/lib/auth/*` (17 modules, only `AuthProvider` mounted in `__root.tsx`), `src/lib/multiplayer/*`, most of `src/components/ui/*`, and `src/lib/og/site.json` are unused by SENTINEL-X; they inflate the review surface and make it harder to see what the app actually does.
- **Proposed action:** either delete the unused modules or quarantine them in a clearly labelled `platform/` area with a note that they are template-provided and unused; do the same for the one-line root `README.md` and the empty `new/` directory.
- **Files:** `src/lib/app-data/**`, `src/lib/auth/**`, `src/lib/multiplayer/**`, `src/components/ui/**`, `src/routes/__root.tsx` (auth mount), `<app>/new/`, repo-root `README.md`.
- **Complexity:** Low–Medium (delete path risks breaking the platform contract — verify against `AGENTS.md` before removing anything platform-owned).
- **Dependencies:** R-1.
- **Verification:** typecheck + build + browser smoke still pass; bundled size non-increasing.
- **Expected benefit:** a smaller, honest codebase that a reviewer (or the next audit) can read end to end.

### R-24 · Trim the client bundle 🟢 P3
- **Problem addressed:** PR-02 — the built client is ~998 KB with `index-*.js` 364 KB and the recharts chunk 356 KB (measured from the production build), plus 753 KB PGLite in the server function.
- **Proposed action:** confirm which route actually needs recharts and either lazy-load that chart or replace it with the existing CSS/SVG presentation used elsewhere; keep chart code out of the initial route chunk.
- **Files:** route/components importing `recharts`; `vite.config.ts` (chunking) if needed.
- **Complexity:** Low–Medium. **Dependencies:** R-18 (browser regression check).
- **Verification:** build report shows the initial-route JS reduced; the affected route still renders its chart.
- **Expected benefit:** faster first load, especially on the mobile viewport the app already supports.

### R-25 · Make the dev/build contract work outside the Linux sandbox 🟢 P3
- **Problem addressed:** TD-18 — `npm run dev`, `npm run build` and `npm run preview:restart` all fail on this Windows workstation (`spawn vite ENOENT`; `[preview] no /proc`), so no contributor on Windows can run the documented commands, and the audit could only verify the build via a direct Vite invocation.
- **Proposed action:** have `scripts/with-app-env.mjs` resolve the local bin (e.g. `shell: true` on Windows, or spawn `process.execPath node_modules/vite/bin/vite.js`), and make `scripts/preview.mjs` degrade gracefully with a clear message.
- **Files:** `scripts/with-app-env.mjs`, `scripts/preview.mjs`, `startup.sh` (document the sandbox assumption).
- **Complexity:** Low. **Dependencies:** none.
- **Verification:** `npm run dev`, `npm run build` and `npm run preview:restart` behave as documented on Windows **and** still work on the Linux sandbox.
- **Expected benefit:** reproducible runs for any auditor or contributor working outside the sandbox — which is exactly what this audit needed.

---

## Category 6 — Optional AI / agentic AI enhancements (only where justified)

### R-26 · Harden the existing grounded analyst 🟠 P1
- **Problem addressed:** TD-09 — the xAI call has **no timeout, no retry, no per-caller quota and no telemetry** (`ai.ts:218-244`); a hung request holds the server function indefinitely, and a malformed response silently degrades to the deterministic fallback (`rejected: true`) with nothing recorded. The model id `grok-4.5` is hard-coded. The deterministic path itself works (verified, 905 ms).
- **Proposed action:** add `AbortSignal.timeout`, one bounded retry, per-caller request/token budgets, usage + rejection telemetry (reuse `ai_queries.provider`/`rejected`), and make model id/params configurable. Keep the current validator contract intact — it is the reason AI output cannot invent evidence.
- **Files:** `src/lib/sentinel/ai.ts`, `src/lib/sentinel/api.ts` (`explainFn`), `src/lib/sentinel/repo.ts` (`saveAiQuery`).
- **Complexity:** Low–Medium. **Dependencies:** R-12 for quota enforcement; `XAI_API_KEY` present to test the live path.
- **Verification:** with a stubbed hanging/500/`timeout` response, `explainFn` returns the deterministic answer within the budget and records `rejected`/provider; a quota test returns `429` beyond the limit.
- **Expected benefit:** the AI feature becomes operable and cost-bounded instead of unbounded, while its grounding guarantees stay.

### R-27 · Add a grounding/red-team evaluation for the analyst 🟡 P2
- **Problem addressed:** the only AI test today is one validator unit test (invented-CVE rejection); there is no evaluation of the *live* model against prompt-injection or fabricated-evidence probing, and no key was available in this audit, so the live path is entirely unverified (TD-19).
- **Proposed action:** build a small offline evaluation set (adversarial questions, poisoned repository/hostname strings, ids that do not exist, requests to declare a breach) and assert the output always resolves to grounded claims or `insufficientEvidence: true`; run it when a key is configured.
- **Files:** new `src/lib/sentinel/ai.eval.test.ts` (skipped without `XAI_API_KEY`), fixture set under `reports/.evidence/` or `src/lib/sentinel/ai/fixtures/`.
- **Complexity:** Medium. **Dependencies:** R-26; an API key in the test environment.
- **Verification:** the evaluation reports the pass rate and fails on any ungrounded claim or breach language; runs green before/after a prompt change.
- **Expected benefit:** the "assistant may only cite deterministic facts" guarantee is measured, not assumed.

### R-28 · Agentic verification loop — recommended **only after** collection actually expands 🟢 P3 (conditional)
- **Problem addressed:** the app already produces `verificationTasks` and `evidenceGaps` with a `UNVERIFIED`/`NEEDS_REVIEW` lifecycle, but nothing ever advances them, and the collection surface is currently one synthetic adapter plus passive DoH — so an autonomous agent today would have no new facts to gather.
- **Proposed action (deferred):** if authenticated inventory ingestion or additional passive sources are added, let an agent propose *collection actions* (specific gap → specific source query) that a human approves, writing only evidence records through the existing deterministic pipeline — never mutating the graph, scores or recommendations directly. Gate on: R-2 (no score without evidence), R-5 (truthful source status), R-13 (audit every action), R-26/R-27 (budget + evaluation).
- **Files:** `src/lib/sentinel/{risk,osint,pipeline}.ts` extension points; new approval surface.
- **Complexity:** High. **Dependencies:** a real second/third collection source; all P0/P1 items above.
- **Verification:** agent-proposed actions are recorded with evidence ids; removing human approval stops the loop; the deterministic engines remain the sole source of every displayed number.
- **Expected benefit:** closes the loop from "gap identified" to "evidence collected" without weakening the evidence-first guarantees — but it is **not justified by the current architecture**, so it stays out of scope until the collection surface grows.

---

## Suggested sequencing

| Wave | Items | Rationale |
| --- | --- | --- |
| **Wave 0 — this week** | R-1, R-15, R-3, R-4 | Nothing can be safely changed while the code is untracked, and the test command currently hides 18 failures. The two render defects are small, verified and user-visible. |
| **Wave 1 — correctness & trust** | R-2, R-5, R-6, R-7, R-9, R-13 | Make every number, status and health signal mean what it says (posture vs unknown, source status, simulator baseline, stage state, readiness, failure audit). |
| **Wave 2 — security & abuse** | R-11, R-12, R-14, R-26 | Enforce the authorization claim, bound the resources and the AI spend, get CI/branch protection in place. |
| **Wave 3 — coverage & scale** | R-16, R-17, R-18, R-10, R-19, R-20, R-21, R-22 | Safety net around the engines, then storage/compute/config hygiene. |
| **Wave 4 — polish & optional AI** | R-23, R-24, R-25, R-27, R-28 | Smaller surface, faster load, portable tooling, measured AI grounding; agentic work only if collection expands. |
