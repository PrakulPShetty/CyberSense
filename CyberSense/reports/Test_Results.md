# SENTINEL-X / "CyberSense" — Test Results & Evidence Log

**Audit:** Phase 11–13 continuation (performance & reliability), executed 2026-10-14
**Rule applied:** a test is only marked **PASS** if it was executed in this session and its outcome inspected. Findings carried over from the earlier audit phase are labelled **prior evidence (not re-executed)**; anything not run is labelled **NOT RUN**.

---

## 1. Environment

| Item | Value |
| --- | --- |
| Workstation OS | Windows (win32), Git Bash shell |
| Node.js / npm | v22.17.0 / 10.9.2 |
| Repository state | 1 commit; application tree untracked (see `Repository_Inventory.md` §1) |
| Database backend used | PGLite fallback (no `DATABASE_URL` set) |
| `XAI_API_KEY` | absent → grounded-analyst deterministic path exercised (the xAI path is **NOT RUN**) |
| Dev server | started per-session for browser checks; see §2 environment limitation |

**Environment limitation (affects every npm-script run on this host).** `npm run dev`, `npm run build` and `npm run preview:restart` cannot execute on this workstation:

| Command | Result | Cause |
| --- | --- | --- |
| `npm run dev` | FAIL (exit 127) — `[with-app-env] failed to run vite: spawn vite ENOENT` | `scripts/with-app-env.mjs` spawns the bare `vite` shim without `shell: true`; npm runs scripts through `cmd.exe` on Windows, so the POSIX shim is not executable |
| `npm run build` | FAIL — same wrapper error | same |
| `npm run preview:restart` | FAIL — `[preview] no /proc — this script only runs inside the sandbox` | `scripts/preview.mjs` requires the Linux sandbox |
| Direct workaround used for verification | `node node_modules/vite/bin/vite.js dev … --host 0.0.0.0 --port 8080` and `node node_modules/vite/bin/vite.js build` | bypasses the wrapper (and therefore `VITE_AUTH_ENABLED` injection) — acceptable because auth is unused by this app |

This is a reproducibility finding (**TD-18**), not a functional defect of SENTINEL-X; the documented contract works on the intended Linux sandbox.

---

## 2. Static checks

| Check | Command | Exit | Outcome |
| --- | --- | --- | --- |
| Type check | `npm run typecheck` (`tsc --noEmit`) | **0** | **PASS** — 0 errors across the project |
| Lint | `npm run lint` (`eslint .`) | **1** | **FAIL** — 6 problems: **1 error** (`src/lib/app-data/client.server.ts:281` `no-empty`) and 5 warnings (`screenshots/qa.mjs:8` unused `events`; `src/lib/auth/use-current-user.ts:59` unused eslint-disable; `src/lib/sentinel/defense.ts:215` unused `beforeIds`; `src/lib/sentinel/defense.ts:251` unused `beforeRisk`; `src/lib/sentinel/pipeline.ts:38` unused arg `now`) |
| Production bundle | `node node_modules/vite/bin/vite.js build` (workaround for `npm run build`) | **0** | **PASS** — built in **1.65 s**, `.vercel/output/nitro.json` generated. Client assets total **998 KB** (`index-*.js` 364 KB, `generateCategoricalChart-*.js` 356 KB (recharts), `api-*.js` 72 KB); CSS 26.4 KB |
| Bundle render check (built output) | `npm run preview:restart` | 1 | **NOT RUN** — preview server refuses on this host (no `/proc`). The built output was not rendered in a browser |
| Secrets scan | `grep -rE "sk-…\|AIza…\|ghp_…\|eyJhbGciOi" src/ scripts/ server/` | 0 matches | **PASS** — no committed credentials found (values redacted by policy) |

Evidence logs: `reports/.evidence/npm-lint.log`, `reports/.evidence/vite-build-direct.log`, `reports/.evidence/npm-build.log`, `reports/.evidence/preview-restart.log`.

---

## 3. Automated test suites

### 3.1 `npm test` as configured

```
> node --test 'scripts/**/*.test.mjs' && node --experimental-strip-types --test \
    src/lib/app-data/app-data.test.ts src/lib/app-data/readiness-schedule.test.ts \
    src/lib/auth/gate-identity.test.ts src/lib/auth/sign-in-gate.test.ts \
    src/lib/sentinel/normalize.test.ts src/lib/sentinel/engines.test.ts
```

| Invocation | Exit | Tests | Pass | Fail | Verdict |
| --- | --- | --- | --- | --- | --- |
| `npm test` (whole command) | **0** | 68 | 68 | 0 | **PASS — but misleading:** the first half executed **0 tests** on this host |

**Finding (confirmed by execution).** On Windows npm runs scripts through `cmd.exe`, which does not strip the single quotes around `'scripts/**/*.test.mjs'`; Node's test runner therefore received a quoted pattern, matched nothing and reported `1..0 / tests 0 / pass 0` **without failing**. The named TypeScript suites then ran normally, so `npm test` exits 0 while silently skipping 9 test files / 195 tests. Evidence: `reports/.evidence/npm-test.log` (first TAP block: `1..0`, `# tests 0`).

### 3.2 TypeScript suites actually executed (second half of `npm test`)

| Metric | Value |
| --- | --- |
| **PASS** | **68 tests / 23 suites / 0 failures** (`node --experimental-strip-types --test …`, exit 0) |
| SENTINEL-X domain suites | 7 suites / **13 tests** — all **PASS** (`authorization` ×2, `evidence scoring` ×2, `vertical slice` ×1, `temporal slices` ×1, `simulation and optimizer` ×1, `AI grounding` ×1, `normalize` ×5) |
| Platform/auth/app-data suites | 16 suites / 55 tests — all **PASS** (unchanged platform helpers) |

Notable domain assertions that were exercised: invalid-domain rejection; confirmation-phrase requirement; freshness decay (`FRESH`→`EXPIRED`); band mapping; end-to-end vertical slice (assets ≥8, evidence ≥8, relationships ≥5, nodes ≥8, paths ≥3, shadow ≥1); temporal slice ordering `w1 < w2 < now` with momentum > 0; MFA simulation `afterRisk ≤ beforeRisk + 1`; optimizer returns ≥1 strategy; AI validator rejects an invented CVE and drops unknown ids.

Evidence logs: `reports/.evidence/ts-tests.log`, `reports/.evidence/npm-test.log`.

### 3.3 Platform script suites skipped by `npm test` (run manually this session)

| Metric | Value |
| --- | --- |
| Command | `node --test scripts/{brand-check,browser-smoke-verdict,check-auth-invariant,grok-pwa-plugin,migration-plan,preview,sign-out-plan,with-app-env,write-atomic}.test.mjs` |
| Result | **FAIL — 195 tests, 177 pass, 18 fail**, exit 1 |

All 18 failures are in **platform/template-harness** tests, not SENTINEL-X domain logic. Verified classes:

| Class | Count | Example (verified detail) |
| --- | --- | --- |
| `.grok/skills/**` reference tree absent from this copy | 4 | `not ok 27/28/29` → `ENOENT … .grok\skills\og\SKILL.md`; `not ok 194` → `ENOENT … .grok\skills\og\references` |
| Windows symlink permission (`EPERM`) in the test setup | 2 | `not ok 80`, `not ok 184` → `EPERM: operation not permitted, symlink …` |
| Assertions hard-coded to template defaults (app name, app-env file, og/PWA placeholder titles, auth-glob layout) | 12 | `not ok 89` expects `og:title content="Hello World"`; the app injects `content="SENTINEL-X"`; `not ok 178` expects `.grok/app-env.json` to ship `VITE_AUTH_ENABLED=false`, actual `{}` (file absent) |

Because these suites are skipped by the default `npm test`, **the repository's regression gate is currently green while 18 platform tests fail** — recorded as **TD-10/TD-11**.

Evidence log: `reports/.evidence/scripts-tests.log`.

### 3.4 Test-coverage gaps (identified by reading the suites, not by execution)

No automated test exists for: the persistence layer (`repo.ts` — SQL, seeding, cascade behaviour), `drift.ts`, `report.ts`, `relationships.ts`, `evidence.ts`, `assets.ts` beyond the smoke-level vertical slice, path enumeration edge cases (cycles, `MAX_PATHS` saturation, `PATH_BREAK_DIFFICULTY` boundary), any React route/component, the server functions in `api.ts`, or the AI HTTP path. Two assertions in `engines.test.ts` are tautologies (`… || true` at line ~91; `assert.ok(ctx.evidence.some(…) || e.length > 0)` in the AI test) and therefore cannot fail — recorded as **TD-10**.

---

## 4. Browser verification (Playwright, local Chrome, dev server on `127.0.0.1:8080`)

### 4.1 Re-verification of the two console errors recorded in the earlier phase

Command: `node reports/.evidence/harness/qa-reverify.mjs` → `REVERIFY_DONE`. Output: `reports/.evidence/reverify/reverify.json`, screenshots in `reports/.evidence/reverify/`.

| Page | Rendered chars | Console errors | Outcome |
| --- | --- | --- | --- |
| `/` | 1080 | 0 | **PASS** |
| `/assessments/asm_northshore_now` (executive) | 1286 | 0 | **PASS** |
| `/assessments/asm_northshore_now/twin` | 963 | **1** | **FAIL (re-verified)** — `pageerror: Hydration failed because the server rendered text didn't match the client …` (server `14/10/2026, 13:08:43` vs client `14/10/2026, 1:08:43 pm`). Source: `src/routes/assessments.$id.twin.tsx:17` renders `new Date(snap.timestamp).toLocaleString()` during SSR |
| `/assessments/asm_northshore_now/audit` | 366 | **1** | **FAIL (re-verified)** — `Error: Objects are not valid as a React child (found: [object Date])` thrown in a `<span>`. Source: `src/routes/assessments.$id.audit.tsx:27` renders `{row.createdAt}` where `repo.ts:409` returns `created_at` (timestamptz → JS `Date`) |

Both defects reproduce exactly as recorded in the prior phase (`screenshots/qa-results.json` steps `desktop_console`), so the prior evidence is **confirmed, not merely reused**.

### 4.2 End-to-end flow timing (element-state waits, no fixed sleeps)

Command: `node reports/.evidence/harness/measure-flows.mjs` → `MEASURE_DONE`. Output: `reports/.evidence/reverify/flow-timings.json`, screenshot `flow-final.png`.
Method: each step is timed from click to a **condition** (`waitForURL` / `waitForSelector`), so the numbers are the app's response time rather than a script sleep. Prior-phase figures such as "report 4055 ms" / "assistant 5050 ms" were **fixed `waitForTimeout(4000/5000)` sleeps** in `screenshots/qa.mjs` and are *not* measurements of the app.

| Flow | ms | Console errors | Notes |
| --- | --- | --- | --- |
| Create assessment (DEMO) from home form | 1756 | 0 | Includes form fill, pipeline run, DB writes, client navigation **and** `networkidle` settle → upper bound |
| Generate report | 1070 | 0 | Server fn (`getSnapshot` + `listSimulations` + `buildReport` + `saveReport`) + query invalidation + render |
| Ask decision analyst | 905 | 0 | `provider = deterministic` (no `XAI_API_KEY`); grounded answer rendered |
| Optimizer "Find strategies" (page defaults: budget 40, max 3) | 1030 | 0 | Includes snapshot read from DB + 175 bounded simulations + save |
| Simulator "Apply to cloned graph" (MFA, pre-selected) | 1122 | 0 | Residual/survivability re-rendered |

All five steps completed successfully on the first attempt with a clean console → the **primary workflow is functional** on dev. Whether the *first* attempt succeeds under a cold DB or concurrent load is **NOT measured**.

### 4.3 Prior-phase browser evidence (reused, not re-executed)

`screenshots/qa-results.json`: home render; negative target rejected with "Target is not a valid public domain and is out of scope."; assessment created in 62 ms (URL-change wait only); 12 sections each rendering >120 chars; simulator button inventory; report and assistant answered; desktop console 2 errors (superseded by §4.1); **mobile 390×844: home 1146 visible chars / 0 px horizontal overflow, assessment 1138 chars / 0 px overflow, 0 console errors**; 27 screenshots across desktop and mobile.

---

## 5. Phase 11 measurements (performance & reliability)

All Phase 11 runs are local and synthetic: the DEMO corpus (`demo-university.edu`) plus **injected** adapter failures (a stubbed `global.fetch`). No public host is scanned; the only outbound traffic is the passive DoH probe in §5.3.

### 5.1 Engine benchmark — `screenshots/bench.mjs`, executed 3× (`reports/.evidence/bench.log`)

| Step | Run 1 | Run 2 | Run 3 | Notes |
| --- | --- | --- | --- | --- |
| `pipeline_demo` (n=5, DEMO) | samples 4,4,4,4,4 ms | 6,7,11,6,5 ms | 4,4,4,3,4 ms | Warm-process compute only (no DB, no HTTP) |
| `simulate_mfa` (n=5) | mean 2 ms | 2 ms | 2 ms | Range 1–4 ms |
| `optimize_max3` (n=3) | 106/98/69 ms (mean 91) | 99/92/74 (88) | 98/95/68 (87) | 175 control combinations, budget 60 |
| `report_build` | <1 ms | <1 ms | <1 ms | Pure function |
| Twin size | 26 assets, 60 edges, 45 relationships, 34 evidence, 16 paths, score 84 | idem | idem | Deterministic |
| Snapshot JSON | 147,435 B | idem | idem | ≈143 KB per snapshot |

### 5.2 Concurrency, memory, determinism, failure injection — `reports/.evidence/harness/perf-reliability.mjs` (`phase11-harness.log`)

| Measurement | Result |
| --- | --- |
| 12 sequential DEMO runs | 42.9 ms total (3.6 ms/run) |
| 12 concurrent DEMO runs | **31.4 ms** total (2.6 ms/run; 1.4× speed-up) — all `COMPLETED`, all identical score, no cross-run interference |
| Memory, 60 retained snapshots | heap 12.4 MB → 21.4 MB (**153.5 KB per retained snapshot**, matching the 143 KB JSON); back to **12.7 MB** after releasing references → no leak observed |
| Repeat-scan determinism | identical score (84), asset/path/evidence counts; **159 differing internal id references** — all assessment-scoped ids (`stableId(prefix, assessmentId, …)`), not divergent results |
| Injected network error (`fetch` throws) | `FAILED` / `SOURCE_UNAVAILABLE` in 1.4 ms, 0 observations, no exception escapes |
| Injected HTTP 503 | `FAILED` / `SOURCE_HTTP_ERROR` in 0.3 ms, **no retry attempted** |
| Injected hang (never-resolving fetch) | aborted at **4008.7 ms** → `SOURCE_TIMEOUT`; timeout enforced exactly as configured and the timer is cleared (`fetchWithTimeout` `finally`) |
| Adapter exception | isolated to its own `SourceRun` as `ADAPTER_EXCEPTION` via `Promise.allSettled`; the other source still completed |
| Whole-source failure through the pipeline | snapshot still returned: status `PARTIAL`, 2 assets, 0 paths, **score 18 / band LOW**, confidence 0.4, and **all 14 stages logged `COMPLETED`** |
| Optimizer scaling | maxControls 1 → 29 ms, 2 → 49 ms, 3 → **128.6 ms** (175 combos); requesting `maxControls: 8` is silently clamped to 3 |
| Stage-log timing | 14/14 stages `COMPLETED` with **`startedAt === completedAt`**, 1 distinct start timestamp → stage durations carry no information |
| Simulator baseline | snapshot posture **84** vs simulator `beforeRisk` **92** → the "before/after" pair does not start from the reported posture |
| Row sizes | snapshot 146,068 B (written twice per scan ⇒ ≈292 KB/scan); simulation result 54,902 B/row; optimization result 4,575 B (strategies stored twice) |

### 5.3 Passive live probe — `screenshots/probe-live.mjs`, executed once (`reports/.evidence/probe-live.log`)

| Case | Result |
| --- | --- |
| `example.com` LIVE | 2028 ms; `PARTIAL`; 4 assets, 3 evidence, 3 relationships, **0 paths**, score 22; `mock_osint` UNAVAILABLE, `cloudflare_doh` COMPLETED (3 observations) |
| Non-existent domain LIVE | 1159 ms; `PARTIAL`; 2 assets, 0 paths, **score 18 / LOW**; DoH reported **`COMPLETED`** despite zero A records (it always prepends a `hostname_observed` observation — `osint.ts:138`, making the ternary at `osint.ts:151` unreachable) |
| Rejected targets: `http://localhost`, `127.0.0.1`, `javascript:alert(1)`, `10.0.0.1`, `not a domain` | all rejected → `INVALID_DOMAIN` |
| Missing confirmation phrase on a live target | rejected → `AUTHORIZATION_REQUIRED` |
| Protocol safety | `dohAdapter` only queries `https://cloudflare-dns.com/dns-query`; the target host is never fetched (no SSRF surface, no port/service probing) — verified by source read **and** by the probe results |

Volume note: 2 HTTPS DoH queries total, against a public resolver, to a well-known domain and a deliberately non-existent domain. No scanning against public websites was performed at any point in this audit.

### 5.4 Not measured (do not treat as verified)

DB query latency and connection-pool behaviour; production/Vercel cold-start and concurrency; behaviour under concurrent *LIVE* scans; long-running soak/leak behaviour beyond 60 runs; the AI HTTP round trip (no key); the built bundle rendering; mobile/desktop visual regression against the new build; and event-loop blocking under real multi-user load. How each could be tested is stated per finding in the main report (Phase 11 table) and the roadmap.
