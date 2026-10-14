# SENTINEL-X / "CyberSense" — Technical Audit Report

**Subject:** `CyberSense/` application tree (product name **SENTINEL-X**)
**Audit:** continuation of the multi-phase security/quality audit — Phases 11 (performance & reliability), 12 (limitations & technical debt), 13 (roadmap) plus final consolidation & verification
**Date:** 2026-10-14 · **Status of this report:** complete for the audited scope, with the unverified areas listed in §12 stated explicitly
**Companion documents:** [`Repository_Inventory.md`](./Repository_Inventory.md) · [`Test_Results.md`](./Test_Results.md) · [`Prioritized_Improvement_Roadmap.md`](./Prioritized_Improvement_Roadmap.md) · raw evidence under `reports/.evidence/`

---

## 0. Provenance — what was inherited, what is new

The audit brief instructed continuation rather than restart. The workspace was inspected first; findings:

| Expected prior artifact | Found? | Action taken |
| --- | --- | --- |
| `reports/` directory with earlier-phase reports | **No — did not exist** | All four required reports created in this session (§13) |
| Repository inventory / progress notes | **No** | Reconstructed from the actual tree; `new/` is an empty directory, no notes anywhere |
| Test results / QA evidence | **Yes, partially** — `screenshots/qa-results.json` (22 recorded steps), 27 screenshots, `screenshots/qa{,2,3}.mjs`, `bench.mjs`, `probe-live.mjs` | Reused as evidence; the two recorded console errors were **independently re-verified in this session**; `bench.mjs` and `probe-live.mjs` were **re-executed** |
| Engine benchmark numbers | **No stored output** (only the script) | Re-executed 3× (this session) — §8.1 |
| Phase 11/12/13 analysis | **No** | Produced new from code inspection + controlled measurements — §8, §9, §13 |

Because no earlier report existed, this document **is** the consolidated report: it reconstructs the Phases 1–10 findings from the code and prior QA evidence and completes Phases 11–13. Nothing was fabricated; every number below is traceable to `reports/.evidence/*` or to a prior-phase artifact, and everything not executed is labelled **NOT MEASURED / NOT RUN**.

**Naming and scope clarification (TD-20).** The brief describes a "website-security scanning workflow" for a project called *CyberSense*. The audited repository is one application, branded **SENTINEL-X**, whose README describes an *evidence-backed cyber exposure twin*: it models authorized external exposure as a temporal graph and simulates defenses. Its only collection components are a synthetic (mock) corpus and **passive DNS-over-HTTPS** against a fixed public resolver; **it never fetches, packages, ports or otherwise probes the target**. The git-tracked root `README.md` is a two-line "CyberSense" stub, which is the only place the project name appears. Both the naming mismatch and the brief's scanner premise are recorded as findings rather than silently reconciled.

---

## 1. Executive summary

SENTINEL-X is a **single-tenant, deterministic cybersecurity decision-support application** built on TanStack Start (React 19, Vite 8) with an embedded PGLite/Neon Postgres store. Its engineering discipline is genuinely good: the exposure model, scoring formulas, freshness windows, uncertainty treatment and control effects are documented in code, the whole engine is deterministic and unit-tested (13 domain tests passing), the AI layer is *design-only grounded* (it cannot invent evidence and falls back to a deterministic explainer), and rendering is XSS-safe with no committed secrets and **no SSRF surface** (the target host is never fetched).

The audit's material findings are of three kinds:

1. **Operational/process risk, not code risk.** The entire application is **untracked in git** (1 commit containing only `.gitattributes` + a stub README; `git status` → `?? CyberSense/`). There is no history, review trail or rollback, and the audit's own evidence lives in a gitignored directory. Additionally, `npm test` **exits 0 while skipping 195 platform tests, 18 of which fail** when actually executed, so the regression gate is weaker than it appears (**TD-01, TD-11**).
2. **Trust-in-the-numbers defects.** "Unknown" is reported as low risk (a non-existent domain yields posture **18 / LOW** with confidence 0.4); a DNS source that returns **no records** is reported `COMPLETED`; the simulator's "risk before" (**92**) does not equal the posture the rest of the app reports (**84**); and all 14 pipeline stages are logged `COMPLETED` with zero duration even when collection returned nothing (**TD-03, TD-06, TD-07, TD-08**). For a product whose entire claim is "every number traces to evidence", these are the highest-value fixes after the process issues.
3. **Two reproducible runtime defects.** The `/twin` page fails hydration on every visit (locale-dependent date shipping through SSR) and the `/audit` page throws `Objects are not valid as a React child (found: [object Date])` — both **re-verified in this session** (**TD-04, TD-05**).

Performance is a **non-issue at current scale**: a DEMO scan's compute is **3.6 ms** (12 runs) and the slowest endpoint measured is the optimizer at **129 ms** (175 bounded simulations). LIVE scans are dominated by external DNS latency (**1.2–2.0 s**, single measurement). The reliability story is mostly sound — adapter failures are isolated (`Promise.allSettled`), timeouts work exactly as configured (**aborted at 4008.7 ms** of a 4 s budget), no memory leak was observed over 60 runs — with the reservations in §8. The dominant risks are **governance (untracked code), enforceability of the authorization claim (a free-text phrase, no accounts, no rate limit), and the accuracy of derived numbers**, not throughput.

**Bottom line:** a well-built demo/stage product with strong evidence-first engineering, undermined by absent version control, an authorization control that is declarative rather than verifiable, and a handful of places where the UI states something the evidence does not support. Nothing in this report requires a rewrite; the roadmap's Wave 0–2 (≈6 focused items) addresses ~80 % of the risk.

---

## 2. Actual technology stack

| Layer | Technology (verified from `package.json` / lockfile) |
| --- | --- |
| Runtime | Node.js 22.17.0, npm 10.9.2 |
| Framework | `@tanstack/react-start` 1.168 (SSR + `createServerFn`), `@tanstack/react-router` 1.170, `@tanstack/react-query` 5.101, `@tanstack/react-table` 8.21 |
| UI | React 19.2, 22 Radix packages, `lucide-react`, `recharts` 2.13, `cmdk`, `vaul`, `sonner`, Tailwind CSS 4.3 (`@tailwindcss/vite`) |
| State / validation | React Query in use; `zustand` 5 installed; `zod` 4.4 installed (server fns use hand-written typed validators) |
| Data | `@electric-sql/pglite` 0.5.4 (embedded, default) **or** `pg` 8.16.3 → Neon when `DATABASE_URL` is set; raw parameterised SQL via `src/lib/db.ts`; `kysely` installed (used only by auth helpers) |
| Auth | `better-auth` 1.6.30 + `jose` present as platform helpers; **no login route and no `authMiddleware` usage** → the application effectively runs auth-off |
| Build / deploy | Vite 8.2, `nitro` 3.0.260610-beta → `.vercel/output` (Vercel target) |
| Quality tooling | `tsc --noEmit`, ESLint 9 flat config + Prettier, Node's built-in test runner, Playwright 1.62 (dev only) |

Deliberately absent: any scanner/port-scanner engine, headless browser in the product path, vulnerability/CVE feed, alerting or scheduling.

---

## 3. Architecture and end-to-end workflow

```
Browser (React 19 + React Query)
   │  createServerFn (16 endpoints, src/lib/sentinel/api.ts)
   ▼
Application engines (src/lib/sentinel/*, 21 modules, 4,534 LOC)
   │   runPipeline() — 14 declared stages
   │     authorization → source_planning → collection → normalization →
   │     asset_resolution → evidence → relationships → (executed: attack_graph →
   │     attack_paths → risk → uncertainty) → exposure_twin → momentum → ready
   │   adapters: mockAdapter (synthetic corpus) · dohAdapter (passive Cloudflare DoH)
   ▼
Persistence (src/lib/sentinel/repo.ts → src/lib/db.ts)
   │   assessments · authorization_records · twin_snapshots · simulations ·
   │   defense_optimizations · reports · ai_queries · audit_logs (migrations/0002_sentinel.sql)
   ▼
PGLite (embedded, preview)  |  Neon Postgres (when DATABASE_URL is set)
```

**What a "scan" actually is.** `createAssessmentFn` → `repo.createAndRun` → `runPipeline`:
1. **Authorization gate** — `evaluateAuthorization` validates the target shape (public domain, not private/localhost) and, for non-demo targets, requires the sentence *"I confirm this target is authorized"* plus a non-empty authorizer (`authorization.ts:20-40`).
2. **Collection** — adapters run in parallel under a 4 s abort budget (`pipeline.ts:79-92`). `mockAdapter` emits the Northshore synthetic corpus only for `demo-university.edu` (otherwise `UNAVAILABLE`); `dohAdapter` performs a single A-record lookup against `https://cloudflare-dns.com/dns-query` and never contacts the target.
3. **Deterministic derivation** — observations → canonical assets → evidence (with freshness/confidence scoring) → typed relationships → attack graph → bounded path enumeration (≤7 hops, ≤16 paths) → per-path risk factors + landscape score → uncertainty, evidence gaps, verification tasks → shadow-asset detection → momentum/drift vs the previous snapshot.
4. **Persistence** — one snapshot per run (written to two columns, see TD-15) plus an authorization row, and an `audit_logs` entry.
5. **Presentation** — 16 pages: the executive posture page plus 15 analysis sections (technical, assets, evidence, twin, graph, paths, risk, uncertainty, simulator, optimizer, drift, momentum, analyst, reports, audit), backed by simulation/optimizer/report/analyst server functions.

---

## 4. Implemented feature status

| Feature | Status | Evidence |
| --- | --- | --- |
| Authorization gate (domain validation, confirmation phrase, scope record) | **Implemented & verified** | 5 malformed/private targets rejected `INVALID_DOMAIN`; missing phrase → `AUTHORIZATION_REQUIRED` (probe §8.3); unit tests |
| Synthetic (DEMO) collection | **Implemented & verified** | 34 observations → 26 assets in 3.6 ms (bench) |
| Passive DNS (LIVE) collection | **Implemented, partially verified** | 2 live DoH lookups executed (2028 ms / 1159 ms); status semantics defective (TD-06) |
| Normalisation & asset fingerprinting | **Implemented & tested** | 5 `normalize` tests; private-IP and private-TLD rejection |
| Evidence records + confidence/freshness model | **Implemented & tested** | documented formula in `scoring.ts:88-118`; 2 tests |
| Attack graph + bounded path enumeration | **Implemented, lightly tested** | 26 nodes/60 edges/16 paths; edge cases untested (TD-10) |
| Risk scoring (path factors + landscape) + bands | **Implemented & tested** | factor table documented `scoring.ts:120-137`; demo posture 84 |
| Uncertainty, evidence gaps, verification tasks | **Implemented** | rendered on `/uncertainty` (5024 chars in prior QA) |
| Drift vs previous twin + Exposure Momentum (disclosed project metric) | **Implemented & tested** | temporal-slice test asserts `w1 < w2 < now`, momentum > 0 |
| Shadow-asset detection vs known inventory | **Implemented & tested** | ≥1 potential shadow asserted |
| Counterfactual simulator (10 controls, deterministic graph mutation) | **Implemented & measured** | 1122 ms end-to-end; residual recomputed; consistency defect TD-07 |
| Defense optimizer (bounded combination search + efficiency metric) | **Implemented & measured** | 129 ms for 175 combos; cap silently 3 (TD-13) |
| Deterministic report builder (8 sections, references, language disclaimer) | **Implemented & measured** | build < 1 ms; 1070 ms end-to-end incl. persistence |
| Grounded AI analyst (context grounding, validator, deterministic fallback) | **Implemented; live path NOT RUN** | deterministic path verified 905 ms; no `XAI_API_KEY` (TD-09/TD-19) |
| Audit trail surface | **Implemented; runtime defect** | crashes on render (TD-05) |
| Auth / accounts / per-user isolation | **Not implemented** (by design for the demo) | no login route; no ownership columns; all rows global (TD-02) |
| Scheduling / continuous monitoring / alerting | **Not implemented** | no scheduler, no notification path (TD-21) |
| Real scanner capabilities (HTTP fetch, port/service probing, cert/header inspection, CVE matching) | **Not implemented — out of product doctrine** | `certificate_hostname`, `service_fingerprint`, `mx_record`, `public_repository` observation types exist but **only the demo corpus emits them**; the LIVE path emits only `hostname_observed` + `a_record` |

---

## 5. Collection ("scanner") implementation analysis

**Design.** Collection is deliberately reduced to passive, offline-safe sources. `OSINTSourceAdapter` defines `sourceName`/`sourceType`/`capabilities`/`requiredCredentials`/`execute`/`healthCheck`; `runAdapters` runs every adapter with `Promise.allSettled` and converts a rejection into a `FAILED`/`ADAPTER_EXCEPTION` `SourceRun` (`osint.ts:167-181`), so one bad source cannot abort a scan (verified by injection).

**Measured behaviour.**

| Aspect | Result |
| --- | --- |
| DEMO collection | 34 observations, deterministic corpus, sub-millisecond |
| LIVE collection | 3 observations for a reachable domain (`example.com`), **0 A records for a non-existent domain** but status `COMPLETED` |
| Target isolation | `dohAdapter` queries only the hard-coded resolver; `isPrivateIp` filters private answers; the target host is never fetched → **no SSRF, no intrusive traffic** |
| Timeout | exactly enforced (injected hang aborted at **4008.7 ms** of a 4 000 ms budget) |
| Retry | **none** (HTTP 503 → immediate `FAILED` in 0.3 ms) |
| Source failure semantics | non-2xx → `SOURCE_HTTP_ERROR`; transport error → `SOURCE_UNAVAILABLE`; abort → `SOURCE_TIMEOUT`; adapter throw → `ADAPTER_EXCEPTION`; all four verified |
| Downstream effect of total source failure | snapshot still produced: `PARTIAL`, 2 assets, 0 paths, **score 18 / band LOW**, confidence 0.4 |

**Weaknesses.** (a) DoH outcome is not classified — the adapter always prepends a `hostname_observed` observation (`osint.ts:138`), so `observations.length` is never 0 and the ternary at `osint.ts:151` is dead: NXDOMAIN and "found nothing" are reported as a successful source (**TD-06**). (b) No retry, no fallback resolver, no circuit breaker — a single third-party DNS endpoint is the entire live data path (**PR-05/R-8**). (c) Only two observation types are reachable in LIVE mode, so every derived claim in a LIVE twin rests on a single A record; the twin still prints a posture score (**TD-03**). (d) `MAX_PATHS = 16` and the enumeration cap (`out.length < MAX_PATHS * 3`, `graph.ts:118`) mean a saturated search silently truncates the landscape — fine as a documented bound, but the score's dependence on it is only loosely tested.

---

## 6. Application security findings

**Strengths (verified).**

| Control | Verification |
| --- | --- |
| No SSRF / no intrusive collection | Source read of `osint.ts` + probe: only the fixed DoH URL is contacted; `javascript:`, `localhost`, `127.0.0.1`, `10.0.0.1`, `not a domain` all rejected |
| No XSS from model/AI output | `grep dangerouslySetInnerHTML` → 0 matches; all report/analyst text is rendered as React text children |
| No committed secrets | no `.env*` in the tree; `grep` for `sk-…`/`AIza…`/`ghp_…`/`eyJhbGciOi` → 0 matches; `DATABASE_URL` and `XAI_API_KEY` come from the environment only (values redacted) |
| SQL injection | all queries parameterised (`$1…`), JSONB passed as `$n::jsonb` |
| Destructive operations | no delete-all/overwrite-all endpoint is exposed; the only delete is the scoped demo re-seed (`repo.ts:77`) |
| Private-target protection | `isValidPublicDomain` + `isPrivateIp` reject RFC1918/loopback/CGNAT/`.internal`/`.local`/`.arpa` |

**Risks.**

| ID | Severity | Finding |
| --- | --- | --- |
| **TD-02** | **Critical** | **The "authorized targets only" control is declarative.** It is a substring check on a free-text field (`authorization.ts:21,28`) that the UI pre-fills for the user. There are no accounts, no ownership verification, no rate limiting and no queue, so any visitor to a deployed instance can drive LIVE passive lookups against arbitrary public domains, and every stored assessment is global (no `user_id` anywhere; `organizations` has no owner). In a public deployment this is both an abuse/hosting-cost exposure and a data-confidentiality issue (all scans visible to all visitors). Practical mitigation today: keep the app private/demo-only, or ship LIVE disabled. |
| **TD-05** | High | Rendered `Date` objects leak from the persistence layer into JSX, crashing the page (details §7.2). Indicates a type boundary that is *declared* (`createdAt: string`) but not enforced. |
| **TD-04** | High | Hydration mismatch exposes a non-deterministic render path (locale/timezone) on a core surface. |
| **TD-20** | Low | Documentation/authorization-scope mismatch: "CyberSense" vs SENTINEL-X, and an audit premise (scanner) that does not match the product. Understates/overstates what the app does, which matters for the authorization story. |
| — | Info | Server functions are unauthenticated by design and accept arbitrary ids; combined with the absence of rate limiting this amplifies TD-02 rather than adding a new class. |

---

## 7. Defects re-verified in this session

### 7.1 `/twin` hydration failure (TD-04) — **reproduced**
`src/routes/assessments.$id.twin.tsx:17` renders `new Date(snap.timestamp).toLocaleString()` during SSR. Server renders `14/10/2026, 13:08:43`, client hydrates as `14/10/2026, 1:08:43 pm` → React abandons the server HTML and re-renders the tree. Observed on every `/twin` visit (`reports/.evidence/reverify/reverify.json`, `pageerror`). Prior phase recorded the same error (`screenshots/qa-results.json`, step `desktop_console`).

### 7.2 `/audit` Date-render crash (TD-05) — **reproduced**
`src/routes/assessments.$id.audit.tsx:27` renders `{row.createdAt}` in a `<span>`, where `repo.ts:409` returns the raw `created_at` column. Under PGLite (and `pg`) a `timestamptz` arrives as a JS `Date`; `src/lib/db.ts` installs parsers for `int8`, `date` and `interval` only. React throws `Objects are not valid as a React child (found: [object Date])` and the error boundary replaces the audit content. The row types claim `string`, so TypeScript cannot catch it.

Both defects are one-line fixes with a shared root cause (timestamp handling at the DB/render boundary) — roadmap R-3/R-4.

---

## 8. Phase 11 — Performance and reliability findings

Method for every row: local synthetic runs (`DEMO` corpus) and injected adapter failures via a stubbed `global.fetch`; two low-volume passive DoH probes. Full logs in `reports/.evidence/`. Nothing was measured against production infrastructure.

| ID | What was examined | Evidence / measurement | Method | Result | Limitation | Recommended improvement |
| --- | --- | --- | --- | --- | --- | --- |
| **PR-01** | Typical scan execution time (engine) | 5 runs × 3 sessions: 4/4/4/4/4 ms; 6/7/11/6/5 ms; 4/4/4/3/4 ms (`bench.log`) | `node --experimental-strip-types screenshots/bench.mjs` ×3 | **3.6 ms/run** serial (12 runs), bound by CPU only; 26 assets/60 edges/34 evidence/16 paths, score 84 | DEMO corpus only; single Windows workstation; no DB in the measured path | Keep; add a perf budget assertion to CI (R-17/R-18) |
| **PR-02** | End-to-end user-visible latency of the main flows | create **1756 ms**, report **1070 ms**, analyst **905 ms**, optimizer **1030 ms**, simulate **1122 ms** (`flow-timings.json`) | Playwright with element-state waits (no fixed sleeps); 1 sample each, dev server, localhost | All flows succeed first attempt, 0 console errors | Dev-mode unminified SSR; single sample; includes network settle and navigation; not production numbers | Instrument per-stage durations server-side and load-test the built output (R-7, R-18) |
| **PR-03** | LIVE scan time / external dependency | `example.com` **2028 ms**; non-existent domain **1159 ms** (`probe-live.log`) | `screenshots/probe-live.mjs`, 2 passive DoH lookups | LIVE scans are DNS-round-trip bound, ~600× slower than DEMO | One domain per case, one run; depends on outbound latency; no resolver in another region tested | Cache lookups, add retry with backoff and a secondary resolver (R-8) |
| **PR-04** | HTTP timeouts / slow responses | injected never-resolving fetch → abort at **4008.7 ms**, `SOURCE_TIMEOUT`, 0 observations (`phase11-harness.log`) | stubbed `fetch` in the harness | Timeout is enforced exactly at the configured 4 000 ms and the timer is cleared in `finally` (no timer leak) | Budget is hard-coded (`pipeline.ts:92`); no test of a *partially* slow response (headers ok, body stalls); no per-source override | Make the budget configurable per source and add a body-read timeout (R-22/R-8) |
| **PR-05** | Error recovery / retries | network error → `SOURCE_UNAVAILABLE` in 1.4 ms; HTTP 503 → `SOURCE_HTTP_ERROR` in 0.3 ms, **no retry**; adapter throw → `ADAPTER_EXCEPTION` isolated; no exception escapes the pipeline | injected failures | Failure classification and adapter isolation are **good**; retry policy is **absent** | No transient-failure/retry-path test against a real flaky source | Bounded retry + fallback resolver + source health check (R-8) |
| **PR-06** | Handling of unreachable websites | non-existent domain: `PARTIAL`, 2 assets, 0 paths, `mock_osint` UNAVAILABLE, **`cloudflare_doh` COMPLETED** with 0 A records | live probe + source read (`osint.ts:138,151`) | Unreachable targets are handled *safely* but reported **inaccurately** (success status for a no-record answer) | Single case; no NXDOMAIN-vs-NODATA distinction tested separately | Explicit `NO_RECORDS`/`NXDOMAIN` status (R-5) |
| **PR-07** | Handling of external service failures | all sources failed → snapshot returned rather than throwing, but posture **18 / LOW**, confidence 0.4 | injected 500 + live NXDOMAIN | The app degrades gracefully *mechanically* but maps "unknown" onto "low risk" | Same as PR-06 | Explicit insufficient-evidence state, suppress the score (R-2) |
| **PR-08** | Scanner resource consumption | no browser/port scanner exists; CPU-bound work is the optimizer: **128.6 ms** for 175 combinations (max 1 → 29 ms, 2 → 49 ms) | harness + `bench.mjs` | Single-threaded Node; the optimizer is the only meaningful CPU burst and blocks the event loop for its duration | No CPU profiling on production hardware; no multi-user load test | Reduce/parallelise the search; move it off the request path (R-19) |
| **PR-09** | Concurrent scan behaviour | 12 concurrent DEMO pipelines: **31.4 ms** total vs **42.9 ms** serial (2.6 vs 3.6 ms/run, 1.4×) — all `COMPLETED`, all identical score (`phase11-harness.log`) | harness | No shared mutable state, no cross-run interference, no duplicate results under concurrency | No queue/limit exists: unbounded concurrent *LIVE* submissions each hold an external dependency for up to 4 s; serverless concurrency not tested | Rate limiting + global collection concurrency cap (R-12) |
| **PR-10** | Memory usage and cleanup | 60 retained snapshots: heap 12.4 MB → 21.4 MB (**153.5 KB/snapshot**, matching the 143 KB JSON); 12.7 MB after release | harness with `--expose-gc` | No leak observed; per-scan payload ≈ 143 KB and persists **twice** (≈292 KB/scan) | 60 runs is not a soak; PGLite is in-memory in this environment so disk growth is untested | Retention policy + single canonical snapshot store (R-20) |
| **PR-11** | Database performance | row sizes measured: snapshot 146,068 B, simulation result 54,902 B, optimization 4,575 B; structural review of indexes and query paths | row-size probe + schema read | **NOT MEASURED** (no query latency instrumented). Structurally: indexes match the access paths; `ensureSeeded()` adds 2–3 queries to every read; snapshots are written twice | Could not instrument server functions headlessly — `repo.ts` depends on Vite's `import.meta.glob` | Add timing instrumentation; seed once per process; deduplicate storage (R-21, R-20) |
| **PR-12** | Repeated scans and duplicate results | two identical-input scans: identical score (84)/counts, **159 differing internal id references** (all assessment-scoped ids) | determinism harness + diff tool | Repeats are numerically deterministic and safe; entities are **not** re-usable across scans (by design) — drift keys on `canonicalId`, which is correct | 32-bit `stableId` collision bound untested (TD-14); no duplicate-suppression/“same target already scanned” indicator | Document `canonicalId` as the join key; add collision test and duplicate detection (R-10) |
| **PR-13** | Logging and observability | no application logging in the sentinel domain (only auth-helper error logs); `audit_logs` records successes only; `error_code`/`error_message` columns never written; `/api/v1/ready` and `readyFn` hard-code `{status:"ready"}` / `database: true` | source read (`repo.ts:25-26,162`, `api.ts:25-31`, `routes/api/v1/ready.ts:6`) | **No observable failure path and no truthful health signal** | Nothing was observed under production monitoring | Persist failure state, structured scan logs, real readiness probe (R-13, R-9) |
| **PR-14** | Reliability of scan-state reporting | 14/14 stages `COMPLETED` with `startedAt === completedAt` (1 distinct timestamp); same for a run whose collection produced **zero** observations; `current_stage` always `"ready"`; declared stage order ≠ execution order | harness (`stage_log`, `live_source_failure_pipeline`) | The stage log conveys no timing and can show "all completed" for an empty scan | Single snapshot family inspected | Real per-stage timestamps/status, honest `current_stage`, ordered stages (R-7) |
| **PR-15** | AI path performance | deterministic analyst answer in **905 ms** end-to-end, `provider = deterministic`; the xAI call has no timeout/retry/quota | `measure-flows.mjs` + source read (`ai.ts:218-244`) | Fallback path is fast and grounded; the live path is **unbounded and NOT RUN** (no key) | No `XAI_API_KEY` in this environment | Add `AbortSignal.timeout`, retries, quotas, telemetry (R-26) |

---

## 9. Phase 12 — Limitations and technical debt

Prioritised; each item distinguishes **confirmed defect** (reproduced) from **analytical risk** (reasoned from code, not observed).

| ID | Pri. | Type | Finding | Evidence / rationale |
| --- | --- | --- | --- | --- |
| **TD-01** | **Critical** | Confirmed | The entire application is untracked in git; the repo's single commit contains only `.gitattributes` + a stub `README.md` | `git ls-files` (2 files), `git status` → `?? CyberSense/`; §1 of the inventory |
| **TD-02** | **Critical** | Confirmed | Authorization is self-asserted free text; no accounts, ownership isolation, rate limiting or queue → open passive-lookup endpoint and globally visible scan data once deployed | `authorization.ts:21,28`; `src/routes/index.tsx` pre-fills the phrase; no auth usage anywhere |
| **TD-03** | High | Confirmed defect | Zero-observation / unreachable scans present posture **18 / LOW**, confidence 0.4, with no insufficient-evidence state — contradicts "absence of records is not absence of risk" | live probe (`live_nxdomain`, `live_source_failure_pipeline`) |
| **TD-04** | High | Confirmed defect | `/twin` hydration mismatch on every visit (locale-dependent date in SSR) | re-verified §7.1; `assessments.$id.twin.tsx:17` |
| **TD-05** | High | Confirmed defect | `/audit` throws `[object Date]` and is replaced by the error boundary; row types claim `string` while the value is a `Date` | re-verified §7.2; `assessments.$id.audit.tsx:27`, `repo.ts:409`, `db.ts` (no `timestamptz` parser) |
| **TD-06** | High | Confirmed defect | DNS source reports `COMPLETED` for a no-record answer; the `PARTIAL` branch is unreachable because a `hostname_observed` observation is always prepended | `osint.ts:138,151`; `live_nxdomain` showed `COMPLETED` with 0 A records |
| **TD-07** | High | Confirmed defect | Simulator "risk before" (92) ≠ reported posture (84); dead expression and unused variable remain in the same function | harness (`simulator_before_value`), `defense.ts:251-256`, lint warnings at `defense.ts:215,251` |
| **TD-08** | High | Confirmed | Scan state is partly fictional: `error_code`/`error_message` never written, `current_stage` always `"ready"`, all 14 stages `COMPLETED` with zero duration, readiness/health hard-code success, `simulations.target_path_ids` never written | `repo.ts:25-26,162`, `api.ts:25-31`, `ready.ts:6`, harness `stage_log` |
| **TD-09** | High | Confirmed by inspection | xAI call has no timeout, retry, per-caller quota or outcome telemetry; hard-coded model id; a bad response silently degrades with no record | `ai.ts:218-244`; deterministic fallback verified, live path not run |
| **TD-10** | High | Confirmed | No automated tests for `repo.ts`, `drift.ts`, `report.ts`, `relationships.ts`, `evidence.ts`, path-enumeration edge cases, any route/server function; two `engines.test.ts` assertions are tautologies (`… \|\| true`) | test inventory in `Test_Results.md` §3.4 |
| **TD-11** | High | Confirmed defect | `npm test` exits 0 while executing **0** tests for `scripts/**/*.test.mjs` (single-quoted pattern survives `cmd.exe`); run manually the same suites are **195 tests / 18 failures** (missing `.grok/skills` fixtures, Windows symlink EPERM, template-name assertions) | `npm-test.log` (`1..0`), `scripts-tests.log` |
| **TD-12** | Medium | Confirmed defect | `npm run lint` fails: 1 error (`app-data/client.server.ts:281` empty block) + 5 warnings, two of them dead code in the audited engine | `npm-lint.log` |
| **TD-13** | Medium | Confirmed | Tunables are hard-coded across modules: resolver URL, model id, 4 s timeout, optimizer cap 3 (silently clamped), `MAX_PATHS=16`, `MAX_PATH_LENGTH=7`, risk-factor maxima, demo org literals | `osint.ts:110`, `ai.ts`, `pipeline.ts:92`, `defense.ts:300`, `scoring.ts:15-16`, `risk.ts:17-31` |
| **TD-14** | Medium | Analytical risk | `stableId` is 32-bit FNV-1a rendered as 8 hex chars; collisions become plausible in the tens of thousands of ids and would silently merge distinct entities; no collision test; cross-scan identity exists only via `canonicalId` | `ids.ts`; determinism harness showed 159 id differences between identical scans |
| **TD-15** | Medium | Confirmed | Every scan stores the same ~143 KB snapshot twice (**≈292 KB/scan**), simulations store a 54 KB full result, optimizer rows duplicate `strategies`, and no retention policy exists | row-size probe; `repo.ts`, `migrations/0002_sentinel.sql` |
| **TD-16** | Medium | Confirmed | `ensureSeeded()` runs on every read (2–3 extra queries) and re-seeds destructively on a revision bump | `repo.ts:60,74,76-78` |
| **TD-17** | Medium | Confirmed | Large unused template surface (`lib/app-data` 9 files, `lib/auth` 17 files — only `AuthProvider` mounted, `lib/multiplayer`, most `components/ui`, `lib/og/site.json`) plus an empty `new/` directory and a stub root README | inventory §2; `grep` for imports of those modules |
| **TD-18** | Medium | Confirmed defect | `npm run dev`, `npm run build` and `npm run preview:restart` cannot run outside the Linux sandbox (`spawn vite ENOENT`; `no /proc`), so the documented contract is unrunnable on this workstation and the audit had to bypass the env wrapper | `npm-build.log`, `preview-restart.log`; works around §2 of `Test_Results.md` |
| **TD-19** | Medium | Unverified area | The AI live path (real model behaviour, prompt-injection resistance, `grok-4.5` availability, cost per query) was never exercised — no key — and no evaluation harness exists | `XAI_API_KEY` absent; `ai.ts` HTTP branch untested |
| **TD-20** | Low | Confirmed | Naming/scope mismatch: brief says "CyberSense / website-security scanning"; the product is SENTINEL-X and performs no scanning; the git-tracked root README is a 2-line stub | inventory §1; root `README.md` |
| **TD-21** | Low | Confirmed | Documented-but-unimplemented surface: single collection path (mock + DoH), no authenticated inventory ingestion (`KNOWN_INVENTORY` is a literal), no scheduling/continuous monitoring, no alerting, no CVE correlation, no accounts, history strip hard-coded to 3 seeded ids (`repo.ts:415`), `insufficientEvidence` never surfaced in the UI (only inside analyst answers) | source reads listed above |

**Deliberately not duplicated here:** issues already documented in the prior phase's notes (the two console errors) appear above with fresh reproduction evidence plus root cause, because they were unverified as *fixes* and are needed for the roadmap.

---

## 10. Phase 13 — Prioritized improvement roadmap (summary)

Full detail — problem, action, files, complexity, dependencies, verification and expected benefit per item — is in [`Prioritized_Improvement_Roadmap.md`](./Prioritized_Improvement_Roadmap.md).

| Wave | Items | Theme |
| --- | --- | --- |
| **0 — now** | R-1 version control · R-15 fix the test command (18 hidden failures) · R-3 `/twin` hydration · R-4 `/audit` crash | Unblock and re-establish a trustworthy baseline |
| **1 — correctness/trust** | R-2 unknown ≠ low risk · R-5 truthful source status · R-6 simulator baseline · R-7 real stage state · R-9 real readiness · R-13 failure logging | Make every displayed number/status defensible |
| **2 — security/abuse** | R-11 verifiable authorization for LIVE · R-12 rate limiting/governor · R-14 CI, branch protection, secret scan · R-26 AI timeout/quota/telemetry | Enforce the claims and bound the resources |
| **3 — coverage/scale** | R-16 core tests · R-17 golden fixture · R-18 wire browser QA into npm/CI · R-10 identity/collision test · R-19 optimizer efficiency · R-20 storage dedupe + retention · R-21 seed once · R-22 config surface | Safety net, then hygiene |
| **4 — polish/optional** | R-23 prune unused surface · R-24 trim client bundle · R-25 Windows-safe dev/build · R-27 AI evaluation harness · R-28 agentic verification loop (**conditional — not justified by the current architecture**) | Reduce surface, measure the AI, defer agentic work |

---

## 11. Test results and evidence (summary)

Complete detail, commands, exit codes and per-suite counts: [`Test_Results.md`](./Test_Results.md).

| Check | Command | Outcome |
| --- | --- | --- |
| Type check | `npm run typecheck` | **PASS** (exit 0) |
| Lint | `npm run lint` | **FAIL** — 1 error, 5 warnings |
| Domain tests | `node --experimental-strip-types --test src/lib/sentinel/{normalize,engines}.test.ts` | **PASS** — 13 tests / 7 suites |
| `npm test` as configured | `npm test` | exit 0 — **68 tests pass**, but the platform suites (195 tests) are **silently skipped** on Windows (**TD-11**) |
| Platform suites when actually run | `node --test scripts/*.test.mjs` | **FAIL** — 195 tests: 177 pass, **18 fail** (fixtures/template coupling/Windows symlinks) |
| Production build | `node node_modules/vite/bin/vite.js build` (workaround) | **PASS** — 1.65 s, nitro output generated; client ≈998 KB |
| Built-output render | `npm run preview:restart` | **NOT RUN** — preview requires the Linux sandbox |
| Browser — main flows | `reports/.evidence/harness/measure-flows.mjs` | **PASS** — 5/5 flows, 0 console errors, latencies in PR-02 |
| Browser — defect re-verification | `reports/.evidence/harness/qa-reverify.mjs` | `/twin` **FAIL** (hydration), `/audit` **FAIL** (`[object Date]`), home + executive PASS |
| Engine benchmark | `screenshots/bench.mjs` ×3 | numbers in PR-01 |
| Reliability harness | `reports/.evidence/harness/perf-reliability.mjs` | numbers in PR-04…PR-14 |
| Passive live probe | `screenshots/probe-live.mjs` | numbers in PR-03/PR-06 and §6 |
| Prior-phase QA (reused) | `screenshots/qa-results.json` + 27 screenshots | 12 sections rendered, mobile 390×844 with 0 px overflow and a clean console |

**Honesty statement:** no test is marked PASS in this report unless it was executed and its output inspected in this session. Prior-phase artifacts are labelled as such. Where a measurement was impossible (DB latency, AI live path, built-output render, production load), the item is labelled **NOT MEASURED / NOT RUN** with the method that would be needed.

---

## 12. Known gaps and unverified areas

1. **No production performance data.** All timings come from a single Windows workstation, mostly in-process or against a Vite dev server. Cold starts, Vercel/Neon latency, connection pooling under load and behaviour with concurrent LIVE scans are unmeasured.
2. **Database latency unmeasured** (PR-11) — server functions could not be instrumented headlessly because `repo.ts` uses Vite's `import.meta.glob`.
3. **AI live path unverified** (TD-19) — no `XAI_API_KEY`; model behaviour, prompt-injection resistance, validator behaviour against a real model and per-query cost are untested; an evaluation harness does not exist.
4. **Built output never rendered** — `npm run preview:restart` refuses outside the sandbox, so only the dev-rendered UI was inspected.
5. **Postgres (Neon) path unexercised** — every executed test used the PGLite fallback; the `pg` branch of `src/lib/db.ts` (and its `int8`/`date` parsing) is untested here. *(Note: TD-05's Date behaviour affects both drivers.)*
6. **Path-enumeration and scoring edge cases untested** — cycles, `MAX_PATHS` saturation, `PATH_BREAK_DIFFICULTY` boundaries, empty-graph behaviour and the 32-bit id collision bound (TD-14).
7. **The 18 platform-test failures were characterised, not fully triaged** — classes were verified (missing `.grok/skills` fixtures, Windows symlink EPERM, template-name/app-env assertions); each individual assertion was not individually repaired (explicitly out of scope: this is an audit).
8. **Scheduling/alerting/multi-tenancy** were never implemented, so "continuous exposure monitoring" claims cannot be tested.
9. **No load, soak or security-penetration testing** was performed beyond the injected-failure harness and the malformed-target probe; no dependency-vulnerability scan (`npm audit`) was executed in this session.

---

## 13. Completion summary and handoff

**Report files delivered (all four exist, verified):**

| # | Path | Content |
| --- | --- | --- |
| 1 | `reports/CyberSense_Technical_Audit_Report.md` | This document — consolidated Phases 1–13 |
| 2 | `reports/Repository_Inventory.md` | Repository state, layout, engine modules, stack, schema, config, prior artefacts |
| 3 | `reports/Test_Results.md` | Every executed command, exit code, counts, browser re-verification, benchmarks, limitations |
| 4 | `reports/Prioritized_Improvement_Roadmap.md` | 28 roadmap items in the six requested categories, with verification methods |
| 5 | `reports/Audit_Progress_Checklist.md` | Step-1 progress checklist: per-phase status, remaining-task tracker, blocked items, verification trail |

**Supporting evidence (new this session, under `reports/.evidence/`):** `npm-test.log`, `ts-tests.log`, `scripts-tests.log`, `npm-lint.log`, `npm-build.log`, `vite-build-direct.log`, `preview-restart.log`, `bench.log`, `phase11-harness.log`, `determinism-diff.log`, `probe-live.log`, and the harness scripts `harness/perf-reliability.mjs`, `harness/determinism-diff.mjs`, `harness/qa-reverify.mjs`, `harness/measure-flows.mjs` plus their JSON/PNG outputs.

**Work completed this session.** Inspection of the repository and all pre-existing audit artifacts (no `reports/` directory existed — reconstructed rather than restarted); full source review of the 21-module engine, 18 routes, API surface and schema; execution of typecheck, lint, the configured test command, the platform test suites, the production build, three engine benchmark sessions, a controlled reliability harness (concurrency, memory, determinism, injected network/HTTP/timeout/adapter failures), a low-volume passive live probe, and a browser re-verification of the two recorded console errors plus timing of the five main UI flows; then Phases 11–13 analysis and the four reports.

**Measurements actually performed:** engine latency (3.6 ms/scan, 3 sessions), UI flow latencies (5 flows), optimization cost curve (29/49/129 ms for 1/2/3 controls), concurrency (12 parallel scans, 1.4× speed-up), memory (153.5 KB/snapshot, no leak over 60 runs), timeout enforcement (4008.7 ms measured), failure classification (4 error classes verified), determinism (159 id-level differences between identical scans), row sizes (146 KB snapshot / 54.9 KB simulation / 4.6 KB optimisation), live DoH latency (2028 ms / 1159 ms), build time and bundle sizes (1.65 s / 998 KB client).

**Still incomplete or blocked (restated for the handoff):** the application is not under version control (TD-01 — the single most important remediation); the AI live path cannot be verified without `XAI_API_KEY`; DB/Neon and production-load performance are unmeasured; the built bundle was never rendered in a browser (sandbox-only preview script); the 18 platform tests are characterised but unrepaired; and no dependency-vulnerability audit was run. **This audit is complete for the requested phases, but it is not a clean bill of health:** the confirmed defects TD-03, TD-04, TD-05, TD-06, TD-07, TD-11 and TD-12 are reproducible today, and TD-01/TD-02 remain the blocking process and security issues.
