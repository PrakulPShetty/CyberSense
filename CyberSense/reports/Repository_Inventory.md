# SENTINEL-X / "CyberSense" — Repository Inventory

**Audit:** Phase 11–13 continuation + final report consolidation
**Inventory date:** 2026-10-14
**Method:** direct filesystem + `git` inspection, `package.json`/config read, source read of every module in the audit scope. All paths are repository-relative to the application root (`CyberSense/`, referred to below as `<app>/`).

> **Naming note (important for traceability).** The audit brief calls this project *CyberSense* and describes a "website-security scanning workflow". The delivered repository is a single application branded **SENTINEL-X** whose README describes a *cyber exposure twin*: it models authorized external exposure as a temporal graph. Its only collection component is **passive** (synthetic corpus + DNS-over-HTTPS lookups against a fixed resolver); it never fetches, packages, ports or otherwise probes a target. There is no website security scanner in the codebase. This inventory therefore documents SENTINEL-X as the audited system and records the brief/repository mismatch as a documentation finding (TD-20).

---

## 1. Repository / working-copy state

| Item | Value | Evidence |
| --- | --- | --- |
| Git work-tree root | `<repo parent>` (`…/GitHub/CyberSense`) | `git rev-parse --show-toplevel` |
| Application directory | `<repo parent>/CyberSense/` | `git status --porcelain` → `?? CyberSense/` |
| Commits | **1** — `616c2ee Initial commit` | `git log --oneline` |
| Files under version control | **2** — `.gitattributes`, `README.md` | `git ls-files` |
| Application source under version control | **None** — the whole `CyberSense/` tree is untracked | `git status`, `git ls-files` |
| Repo-root `.gitignore` | absent | `ls <repo parent>` |
| App `.gitignore` | present (untracked), ignores `.env*`, `node_modules/`, `.vercel/`, `.grok/`, `.tanstack/`, `screenshots/`, `docs/` | `<app>/.gitignore` |

**Consequence:** no history, no review trail, no rollback for any application file; the only copy is the local (OneDrive-synced) working directory. Recorded as **TD-01 (Critical)**.

### Untracked but present artefacts

| Path | Kind | Notes |
| --- | --- | --- |
| `<app>/.vercel/output/` | Build output | Deploy bundle from an earlier `vite build`; gitignored |
| `<app>/.tanstack/tmp/` | Tool cache | empty dir |
| `<app>/new/` | **Empty directory** | leftover, no content, unreferenced |
| `<app>/screenshots/` | Prior-phase QA evidence | 27 PNGs + `qa-results.json` + `qa.mjs`, `qa2.mjs`, `qa3.mjs`, `bench.mjs`, `probe-live.mjs`; gitignored |
| `<app>/.grok/` | **Absent** | the platform `.grok/skills/**` tree the template tests reference does not exist in this copy |

---

## 2. Application layout

```
<app>/
├─ package.json           scripts + deps (§4)
├─ vite.config.ts         Vite 8 + TanStack Start plugin (+ nitro for deploy)
├─ tsconfig.json          TS project config
├─ eslint.config.mjs      flat ESLint config
├─ .prettierrc            formatting
├─ startup.sh             sandbox restart contract (`cd /workspace`, `npm run dev`)
├─ migrations/            0002_sentinel.sql (11 tables), auth/0001_auth.sql (opt-in, unused)
├─ scripts/               platform tooling (23 files, 9 *.test.mjs)
├─ server/                middleware/grok-pwa.ts, virtual-grok-og-identity.d.ts
├─ public/                favicon.svg, og.jpg, __grok/ (platform PWA chrome)
├─ screenshots/           prior-phase QA evidence (gitignored)
└─ src/
   ├─ router.tsx, routeTree.gen.ts, styles.css, vite-env.d.ts
   ├─ components/         sentinel/{shell,brand,severity,graph-view}.tsx, ui/* (9 primitives), preview-host-bridge, query-provider
   ├─ lib/
   │  ├─ sentinel/        the application engine — 21 modules, 4,534 LOC (§3)
   │  ├─ auth/            17 modules — platform Better-Auth helpers (only AuthProvider mounted)
   │  ├─ app-data/        9 modules — connector/gate helpers (unused by SENTINEL-X)
   │  ├─ multiplayer/     2 modules — p2p helpers (unused)
   │  ├─ og/site.json     share-card metadata
   │  └─ db.ts, env.server.ts, utils.ts, error-component.tsx, preview-*.ts
   └─ routes/             page + API routes, 1,463 LOC (§5)
```

Sizes: `src/` 630 KB, `public/` 261 KB, `scripts/` 244 KB, `migrations/` 12 KB, `screenshots/` 4.1 MB.

---

## 3. Engine modules (`src/lib/sentinel/`, 21 files)

| Module | Role | Audit reference |
| --- | --- | --- |
| `pipeline.ts` | Orchestrates the 14 declared stages end-to-end | PR-01, PR-04, PR-14 |
| `authorization.ts` | Target/authorization gate (`evaluateAuthorization`, `inScope`) | TD-02 |
| `osint.ts` | Source adapters: `mockAdapter` (synthetic), `dohAdapter` (Cloudflare DoH), `runAdapters` (allSettled isolation) | PR-03–PR-07, TD-06 |
| `normalize.ts` | Hostname/URL/repo canonicalisation, `isValidPublicDomain`, `isPrivateIp`, fingerprints | Phase 12 (validated) |
| `assets.ts` | Observation → canonical asset resolution, shadow-asset ownership state | TD-14 |
| `evidence.ts` | Evidence records + freshness/confidence scoring | — |
| `relationships.ts` | Typed relationship construction | — |
| `graph.ts` | Attack-graph build + bounded path enumeration (`MAX_PATH_LENGTH=7`, `MAX_PATHS=16`) | TD-10 |
| `risk.ts` | Path scoring factors, landscape score, uncertainty, evidence gaps, verification tasks | TD-07 |
| `scoring.ts` | Documented constants + formulas (risk factors, freshness windows, bands) | TD-13 |
| `defense.ts` | `CONTROL_CATALOG` (10 controls), `applyControls`, `simulateDefense`, `optimizeDefense` | PR-08, TD-07 |
| `drift.ts` | `detectShadow`, `computeDrift` (canonicalId-keyed), `computeMomentum` | PR-12 |
| `report.ts` | Deterministic 8-section report builder | PR-02 |
| `ai.ts` | Grounded analyst: context builder, deterministic fallback, xAI call + claim validator | PR-15, TD-09 |
| `repo.ts` | Persistence layer (Kysely-free raw SQL via `@/lib/db`), seeding, audit log | PR-11, TD-08, TD-16 |
| `api.ts` | 16 `createServerFn` endpoints | TD-02 |
| `types.ts` | Domain types + `PIPELINE_STAGES` (14) | PR-14 |
| `ids.ts` | `newId` (UUID-derived), `stableId` (32-bit FNV-1a) | TD-14 |
| `use-assessment.ts` | React Query hooks | — |
| `demo/university.ts` | Northshore synthetic corpus (`w1`/`w2`/`now` slices, `KNOWN_INVENTORY`) | — |
| `engines.test.ts`, `normalize.test.ts` | Domain tests (13 tests) | Test_Results.md |

---

## 4. Technology stack (as actually installed)

| Layer | Technology | Version (`package.json` / lockfile) |
| --- | --- | --- |
| Runtime | Node.js / npm | 22.17.0 / 10.9.2 (verified) |
| Framework | `@tanstack/react-start` (SSR + server functions) | 1.168.0 |
| Router / data | `@tanstack/react-router` 1.170.0, `@tanstack/react-query` 5.101.0, `@tanstack/react-table` 8.21.0 | — |
| UI | React 19.2, Radix primitives (22 pkgs), `lucide-react`, `cmdk`, `vaul`, `sonner`, `recharts` 2.13 | — |
| Styling | Tailwind CSS 4.3 + `@tailwindcss/vite`, `tw-animate-css`, `class-variance-authority`, `tailwind-merge` | — |
| State | `zustand` 5 (installed), React Query (used) | — |
| Validation | `zod` 4.4 (installed; server fns use plain typed validators) | — |
| Build | Vite 8.2 + `@vitejs/plugin-react` 5.2, `lightningcss`, `nitro` 3.0.260610-beta (deploy target) | — |
| Database | `@electric-sql/pglite` 0.5.4 (embedded, preview) **or** `pg` 8.16.3 (Neon) when `DATABASE_URL` is set; `kysely` 0.28 installed | `src/lib/db.ts` |
| Auth | `better-auth` 1.6.30 + `jose` (platform helpers present; **no login route, no server function uses auth**) | `src/lib/auth/*` |
| Testing/QA | Node built-in test runner (`node --test`), Playwright 1.62 (dev-only), TypeScript 5.7 `tsc --noEmit`, ESLint 9 flat config | — |
| Deploy | Vercel (nitro output in `.vercel/output`) | `.grok/references/deploy-target.md` contract |

Not present: Vitest/Jest, any scanner/port-scanner engine, any headless browser in the product path, any CVE/vulnerability feed.

---

## 5. Routes (17 pages + 2 API endpoints; 20 files under `src/routes/`)

| Route | Purpose |
| --- | --- |
| `/` | Launch form (DEMO/LIVE, target, authorizer, confirmation) + seeded twin summary + assessment history |
| `/assessments/$id` | Executive posture shell + section navigation |
| `/assessments/$id/{technical,assets,evidence,twin,graph,paths,risk,uncertainty,simulate,optimize,drift,momentum,assistant,reports,audit}` | 14 analysis surfaces |
| `/api/v1/health` | Static `{status:"ok"}` |
| `/api/v1/ready` | Static `{status:"ready"}` (does not touch the database) |

---

## 6. Database schema (`migrations/0002_sentinel.sql`)

| Table | Purpose | Notes / audit references |
| --- | --- | --- |
| `organizations` | Tenant-ish org rows, `canonical_domain` unique | used for demo + LIVE targets |
| `assessments` | Scan runs; `stage_log`, `snapshot` JSONB, `error_code`/`error_message` | ⚠ `error_code`/`error_message` never written (**TD-08**); `current_stage` always `"ready"` |
| `authorization_records` | Authorization record per run | self-asserted evidence (**TD-02**) |
| `twin_snapshots` | Immutable snapshot per run | duplicate of `assessments.snapshot` (**TD-15**) |
| `simulations` | Simulation results | `result` JSONB ≈ 54 KB/row; `target_path_ids` never written (**TD-08/15**) |
| `defense_optimizations` | Optimizer outputs | strategies stored in two columns |
| `reports` | Generated report content (JSONB) | — |
| `ai_queries` | Analyst Q&A rows (question, provider, response, rejected) | — |
| `audit_logs` | Action log (`assessment_started`, `simulation_created`, `report_generated`, `ai_query_submitted`, `seed_demo`) | success-only; failures never logged (**PR-13**) |
| `_migrations` | Applied migration tracking (created by `scripts/migrate.mjs` / PGlite bootstrap) | — |

Indexes exist on the FK/ordering columns used by the queries (`assessments_org_idx`, `assessments_status_idx`, `assessments_created_idx`, `authorization_assessment_idx`, `twin_snapshots_assessment_idx`, `simulations_assessment_idx`, `defense_opt_assessment_idx`, `reports_assessment_idx`, `ai_queries_assessment_idx`, `audit_logs_assessment_idx`, `audit_logs_action_idx`).

`migrations/auth/0001_auth.sql` exists but is outside the globbed migration path (auth opt-in, unused by this app).

---

## 7. Configuration, scripts and environment

`package.json` scripts: `dev` (`node scripts/with-app-env.mjs vite dev --host 0.0.0.0 --port 8080`), `build` (vite build + `db:migrate`), `db:migrate`, `build:dev`, `preview`, `preview:restart`, `preview:stop`, `typecheck`, `check:auth`, `test`, `lint`, `format`.

Environment variables referenced in code: `DATABASE_URL` (optional — selects Neon vs PGLite), `XAI_API_KEY` (optional — grounded analyst; absent in this environment), `VITE_AUTH_ENABLED` (platform flag; `.grok/app-env.json` is absent from this copy). No `.env*` file exists in the tree; no API keys, tokens or private keys were found in source (`grep` for `sk-…`, `AIza…`, `ghp_…`, `eyJhbGciOi` → 0 matches; redacted where relevant).

**Run contract status on this workstation (TD-18):** `startup.sh` hard-codes `cd /workspace` (sandbox path, not present here) and `npm run dev` fails with `[with-app-env] failed to run vite: spawn vite ENOENT` because `scripts/with-app-env.mjs` spawns the bare `vite` shim without a shell (npm on Windows executes scripts through `cmd.exe`). Verification for this audit therefore started Vite directly (`node node_modules/vite/bin/vite.js dev …`), which is documented in `Test_Results.md` as an environment limitation, not an application defect.

---

## 8. Prior audit artefacts found (reused, not regenerated)

| Artefact | Content | Reuse decision |
| --- | --- | --- |
| `screenshots/qa-results.json` | 22 recorded QA steps: home render, negative-target rejection, assessment creation (62 ms), 12 section renders, simulator/report/assistant runs, desktop console (2 errors), mobile home/assessment (0 px overflow, 0 console errors) | **Reused**; the two console errors were independently re-verified in this session |
| `screenshots/*.png` (27) | Desktop (1440×900) + mobile (390×844) captures of every surface | Referenced as visual evidence |
| `screenshots/qa.mjs`, `qa2.mjs`, `qa3.mjs` | Playwright scripts that produced the above | Reused as the record of method; `qa.mjs` still contains fixed `waitForTimeout` sleeps (method caveat recorded in `Test_Results.md`) |
| `screenshots/bench.mjs` | Engine benchmark (pipeline, simulate, optimize, report build, graph size, snapshot bytes) | **Re-executed** (3×, this session) |
| `screenshots/probe-live.mjs` | Passive-DoH probe: reachable domain, non-existent domain, 5 rejected targets, missing confirmation | **Re-executed** (1×, this session — low-volume, passive only) |
| `reports/` | **Did not exist** | All four required reports are created new in this session (see `Test_Results.md` §"Provenance") |
