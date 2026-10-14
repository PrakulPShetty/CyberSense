# CyberSense — Verification, Operation & Mentor Demonstration Guide

**Project:** CyberSense (product name inside the code: **SENTINEL-X**)
**Event:** Hackurity 2026 — Track D, P7 "Accessible by Default"
**Repository:** `PrakulPShetty/CyberSense` · **Branch worked on:** `cybersense-development`
**`main`:** untouched (`82cc6e6`, identical to `origin/main`)
**Report generated:** 14 October 2026
**Nothing has been committed or pushed.**

> Every claim in this document was produced by running the code on this machine.
> Anything that could not be verified is labelled **NOT VERIFIED** or **NOT RUN**
> rather than assumed to work. Sample/synthetic data is labelled **DEMO/SYNTHETIC**.

---

## A. Project overview

### What CyberSense is

CyberSense (SENTINEL-X in the interface) builds an **evidence-backed model of
authorized external exposure** and then simulates defences against it. It does
**not** exploit, brute-force or modify anything. Its own language rules are
enforced in code: *observed / modeled / potential / requires verification* —
never "breached".

The working pipeline is:

```
authorization gate → collection → normalization → assets → evidence →
relationships → attack graph → attack paths → risk → uncertainty →
exposure twin → momentum/drift → dashboard
```

Collection is deliberately passive:

| Mode | What it actually contacts |
| --- | --- |
| **DEMO** | Nothing on the network. A fixed synthetic corpus for `demo-university.edu` (Northshore State University). |
| **LIVE** | One DNS-over-HTTPS A-record lookup against a hard-coded public resolver (`cloudflare-dns.com`). The target host is **never fetched**. |

### The problem this addresses under Track D

Track D is about accessibility. The honest position is:

- The **existing** prototype contained **no accessibility functionality at all**.
  It is a cybersecurity exposure tool. I searched the whole tree for
  `axe`, `wcag`, `a11y` and `contrast` and the only matches were ARIA attributes
  on SENTINEL-X's own buttons and SVGs.
- A cyber tool that reports on "accessible by default" is only credible if it can
  **measure** accessibility on a real rendered page with real findings.

So this work adds a **separate, real accessibility scanner** alongside the
cybersecurity features, and keeps the two result sets strictly apart.

### Which existing cybersecurity features are retained

All of them. Nothing was removed or disabled. What changed is documented in
§H — a cold-start crash fix, three truthfulness fixes, and the accessibility
scanner. The cyber exposure pipeline, attack graph, simulator, optimizer,
reports, analyst and audit trail are the original implementation and still work.

### An important scope correction

The brief describes CyberSense as a website-security scanner. **It is not one.**
There is no HTTP client pointed at the target, no port scan, no TLS/cookie/header
inspection and no CVE matching anywhere in the code. This is a deliberate product
doctrine, not an unfinished feature. This guide states that plainly rather than
letting the demo imply otherwise.

---

## B. Feature verification table

"How verified" = the actual method used on 14 Oct 2026. `Code` = source read.
`Run` = executed. `Browser` = driven through a real browser.

| # | Feature | Status | Source (file → route) | Required input | What the code really does | Verified? | Output type | Known limitations / misleading behaviour |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Starting the application | **Works (fixed)** | `package.json` → `npm run dev`; `scripts/with-app-env.mjs` | none | Starts Vite dev server on `0.0.0.0:8080`. | **Yes — Run.** Three cold restarts, first request returned `200` after the fix (previously `500`). | live | First compile of a cold route takes ~10–18 s. |
| 2 | Creating an assessment from a submitted target | **Works** | `src/routes/index.tsx` → `createAssessmentFn` (`src/lib/sentinel/api.ts`) → `repo.createAndRun` → `runPipeline` | target, authorized-by, confirmation phrase, mode | Validates the target, writes an authorization record, runs all engines, persists an immutable snapshot, audits the event. | **Yes — Run + Browser.** Created a DEMO assessment from the home form; landed on the executive page. | live (computed) over DEMO or LIVE collection | There is no queue: each submit runs synchronously in the request. |
| 3 | DEMO mode vs LIVE mode | **Works; LIVE is much narrower than it sounds** | `src/lib/sentinel/pipeline.ts`, `osint.ts` | the mode toggle | DEMO → synthetic corpus only. LIVE → `mockAdapter` returns `UNAVAILABLE` for any non-demo domain, `dohAdapter` performs one passive DoH A-record query. | **Yes — Run + Code.** LIVE probe against `example.com`: 4 assets, 0 paths, `cloudflare_doh` COMPLETED, `mock_osint` UNAVAILABLE. | DEMO = SYNTHETIC · LIVE = live DNS only | LIVE produces only `hostname_observed` + `a_record`. Every richer observation type exists only in the demo corpus. |
| 4 | Passive DNS lookup & A-record handling | **Works (status reporting fixed)** | `src/lib/sentinel/osint.ts` (`dohAdapter`), `normalize.ts` | a valid public domain | Queries `https://cloudflare-dns.com/dns-query?...&type=A` with a 4 s abort; filters private answers; never contacts the target. | **Yes — Run + Code.** Live lookup returned the real A record. | live | **Fixed this session:** it used to report `COMPLETED` even when the resolver returned **no** A record (NXDOMAIN/NODATA). It now reports `PARTIAL` with an explicit "unknown, not clean" note. |
| 5 | Evidence collection & normalization | **Works** | `normalize.ts`, `assets.ts`, `evidence.ts`, `scoring.ts` | raw observations | Deterministic host/URL/repo normalization, asset fingerprinting, evidence records with a documented confidence formula (reliability, recency, corroboration, verification). | **Yes — Code + unit tests** (`engines.test.ts`). | derived from real input | Freshness windows are documented constants, not tuned to any real dataset. |
| 6 | Risk analysis & scoring | **Works (truthfulness fixed)** | `risk.ts`, `scoring.ts` → `/assessments/$id/risk`, `/technical` | a completed pipeline run | Per-path factor breakdown (7 named factors, each with a documented maximum) plus a landscape score. | **Yes — Code + Browser.** DEMO twin scores 84 / CRITICAL with 15 critical paths. | modeled | **Fixed this session:** a twin with **no modeled path** used to display a reassuring `18 / LOW`. It now reports "no score / insufficient evidence". |
| 7 | Attack graphs & attack paths | **Works** | `graph.ts` → `/graph`, `/paths` and the SVG `graph-view.tsx` | a graph | Deterministic edge construction; bounded depth-first path enumeration (≤7 hops, ≤16 paths). | **Yes — Browser** (26 nodes / 60 edges / 16 paths on the DEMO twin). | modeled | The `MAX_PATHS` cap means a saturated search silently bounds the landscape. |
| 8 | Simulation & optimization | **Works (baseline fixed)** | `defense.ts`, `/simulate`, `/optimize` | ≥1 control selected | Clones the graph, mutates edge difficulty deterministically, recomputes paths and risk. Optimizer scores bounded control combinations. | **Yes — Browser + unit test.** Simulator and optimizer both ran from the UI. | modeled / simulated | **Fixed this session:** "risk before" disagreed with the posture shown everywhere else. It now uses the same landscape score. `maxControls` is silently clamped to 3. |
| 9 | Assessment history & report generation | **Works** | `repo.ts` (`listAssessments`, `listHistory`), `report.ts`, `/reports` | a completed assessment | Lists assessments; generates an 8-section report with references and a language disclaimer; persists it. | **Yes — Browser.** Report generated from the UI; historical twins (week −3 / −2 / now) render on the home page. | live (computed from stored snapshots) | Reports are only as good as the snapshot they summarise. |
| 10 | Audit & other pages | **Works** | `repo.ts` (`audit`), `/audit` | an assessment id | Every assessment, simulation, optimization, report and analyst event is written to `audit_logs`; the page lists them. | **Yes — Browser** (17 assessment sub-pages, 0 console errors). | live | `current_stage` is always `"ready"`, and `error_code`/`error_message` columns are never written — see §H. |
| 11 | Existing accessibility functionality | **None existed** | — | — | A repo-wide search for `axe`/`wcag`/`a11y`/`contrast` found only ARIA attributes on SENTINEL-X's own buttons and SVGs. | **Yes — Code (search).** | — | Nothing was assumed. The scanner in §E is new work. |
| 12 | HTTP security / TLS / cookie / vulnerability checks | **Not implemented** | — | — | No HTTP request is ever made to the target. No port scan, no header or cookie inspection, no TLS probe, no CVE feed. | **Yes — Code (search + read).** | — | Reporting these as "checks" would be fabrication. They do not exist. |

### B.2 Practical input / output reference

Every row below was executed through the **browser UI** on 14 Oct 2026
(harness: `reports/.evidence/harness/sentinel-negative-cases.mjs`,
`a11y-e2e.mjs`). Console/page errors across these runs: **0**.

> **Numbers depend on the target and on the run.** The figures quoted here are
> what *this* machine observed once; they are not constants. For LIVE DNS the
> output depends entirely on what the resolver returns, and for accessibility it
> depends on the page. Nothing below is a predetermined count.

| Input you enter | Operation actually executed | Evidence obtained | What the app shows when it succeeds | When nothing is found / the request fails | live? synthetic? simulated? |
| --- | --- | --- | --- | --- | --- |
| **DEMO** mode, target `demo-university.edu`, any authorizer, any confirmation (the demo domain is auto-authorized) | `mockAdapter` emits the fixed synthetic Northshore corpus, then the full deterministic pipeline runs | 34 synthetic observations → 26 assets, 60 graph edges, 45 relationships, 34 evidence records, 16 modeled paths | Executive page, status **COMPLETED**, posture **84 / CRITICAL**, confidence **77 %**, **15** critical modeled paths | The corpus is fixed, so it cannot come back empty. This is the deterministic demo path. | Collection **SYNTHETIC**; all arithmetic **real execution** |
| **LIVE** mode, target `example.com`, confirmation containing *“I confirm this target is authorized”* | One passive DNS-over-HTTPS **A-record** query to `cloudflare-dns.com`. The target host is never fetched. | Hostname observation + A record(s). `mock_osint` reports `UNAVAILABLE` for a non-demo domain. | Executive page, status **PARTIAL**, posture **“no score — insufficient evidence”**, confidence **40 %**, **0** critical paths; source panel shows `cloudflare_doh` COMPLETED and `mock_osint` UNAVAILABLE | Reported as **unknown, not clean**. A no-record answer now marks the DNS source `PARTIAL` with an explicit note, instead of a false `COMPLETED`. | **LIVE** (DNS only). No security score is claimed. |
| Out-of-scope target: `not a domain`, `http://localhost`, `127.0.0.1`, `10.0.0.1`, `thing.internal`, `https://user:pw@example.com` | Authorization/URL validation only — **no network traffic at all** | None | — | Inline error, e.g. **“Target is not a valid public domain and is out of scope.”** No assessment is created. | Refusal (no scan) |
| **LIVE** target `example.com` but confirmation reads `please scan it` | Phrase check only | None | — | Inline error: **`Authorization confirmation must include: "I confirm this target is authorized".`** | Refusal (no scan) |
| Simulator → **MFA** pre-selected → **Apply to cloned graph** | Clones the graph, adds +48 difficulty to authentication/VPN/IdP edges, re-runs path enumeration and risk | The control set and the list of changed edges | “Risk before” = **the same posture the rest of the app reports**; risk after; critical paths before → after; crown jewels reachable before → after; residual risk and band | If the control changes nothing, before equals after and every path survives — the UI does not imply success. | **SIMULATED** over real stored evidence |
| Optimizer → **Find strategies** | Bounded combination search over the 10 controls (≈175 combinations; `maxControls` is silently clamped to 3), each scored by cloning and simulating | Ranked strategies with residual risk, critical paths removed, estimated cost | Ranked defence strategies + “Defense Efficiency” (labelled a SENTINEL-X project metric) | A budget that eliminates every combination returns no strategy rather than a fake one. | **MODELED** |
| Reports → **Generate report** | Builds the 8-section report from the stored snapshot + saved simulations and persists it | References to evidence, path, risk and simulation ids | Report with executive summary, posture, sections, references and the language disclaimer | With no snapshot there is nothing to report; the page stays empty rather than inventing content. | Real computation over the stored twin |
| Analyst → ask *“What is the biggest modeled weakness?”* | With **no `XAI_API_KEY`**: grounded deterministic explainer (no network). With a key: xAI call, validated against the context. | Cited evidence ids / path ids | A grounded answer that cites the twin's own records | If the twin lacks evidence it answers “Insufficient evidence” — it never invents a CVE or an asset. | Deterministic here. The xAI path is **NOT RUN** (no key). |
| Open **Audit** | Reads `audit_logs` | Assessment / simulation / report / analyst / accessibility events | Reverse-chronological event list with details | Empty state text if nothing was recorded for that assessment. | Live |
| `npm run dev:a11y-demo`, then in **Accessibility** type `http://127.0.0.1:8080/a11y-demo` → **Run accessibility scan** | Playwright loads the page at 1280×900 in a real browser; axe-core 4.14.0 runs the WCAG 2.0/2.1/2.2 A+AA + best-practice rule set inside the page | **12 failing rules, 28 failing elements**, 27 rules passed, 1 undecided — each with rule id, impact, WCAG tags, real selector, real HTML snippet and axe's own message | Summary + **Open full findings** detail page | A page with no failures shows: *“No rule in this tag set failed … that is not a claim of WCAG compliance.”* | **LIVE render + LIVE rule engine**; the page itself is **SYNTHETIC** |
| Accessibility → `https://example.com/` | Same, against a public page | **3 failing rules, 9 failing elements**, 11 passed, 1 undecided (`landmark-one-main`, `page-has-heading-one`, `region`) | Same findings layout | Same empty-state message | **LIVE** (public page) |
| Accessibility → `http://127.0.0.1:8080/a11y-demo` while running plain `npm run dev` | URL validation only — the browser is never started | None | — | **`Scan refused (LOOPBACK_BLOCKED)`** with the exact opt-in instructions | Refusal (SSRF control); recorded as `a11y_scan_failed` in the audit log |
| Accessibility — other failure inputs | Validation, DNS pre-check, or the browser run | None | — | `EMPTY_URL`, `URL_TOO_LONG`, `INVALID_URL`, `UNSUPPORTED_SCHEME` (`file:`, `javascript:`, `chrome:`, `data:`), `CREDENTIALS_IN_URL`, `PORT_NOT_ALLOWED`, `PRIVATE_ADDRESS` (LAN / link-local / `169.254.169.254`), `INVALID_DOMAIN`, `DNS_FAILED`, `REDIRECT_OFF_ORIGIN`, `TARGET_HTTP_ERROR`, `PLAYWRIGHT_MISSING`, `AXE_MISSING`, `BROWSER_UNAVAILABLE`, `ENGINE_NOT_READY` | Every one shows its exact code and an actionable message, and is logged as a failure — **never** displayed as a page that passed. | Refusal / failure |

---

## C. Setup and operation (Windows)

### C.0 The correct working directory

The Git repository root and the application folder are **not the same place**.
The app lives one level down:

```
Repository root : C:\Users\BALAJI N\OneDrive\Documents\GitHub\CyberSense
Application dir : C:\Users\BALAJI N\OneDrive\Documents\GitHub\CyberSense\CyberSense
```

**Every command below runs in the application directory.** In Git Bash:

```bash
cd "/c/Users/BALAJI N/OneDrive/Documents/GitHub/CyberSense/CyberSense"
```

> OneDrive note: this folder is inside OneDrive. OneDrive's background sync locks
> and re-uploads `node_modules`, which makes installs and builds slow and can
> cause sporadic file-lock errors. It works, but moving the repo outside OneDrive
> (e.g. `C:\dev\CyberSense`) is strongly recommended before the presentation.

### C.1 Prerequisites

| Requirement | Tested value on this machine | Notes |
| --- | --- | --- |
| Node.js | **v25.2.1** | Project targets Node 22+. |
| npm | **11.6.2** | |
| A Chromium-based browser | **Google Chrome** (installed) | Only needed for the **accessibility scanner**. The scanner tries Playwright's bundled Chromium, then installed Chrome, then Edge. |
| Internet connection | available | Only needed for **LIVE** DNS probing and for a public accessibility scan. |

No Docker, no PostgreSQL server and no cloud account are required.

### C.2 Install dependencies

```bash
npm ci
```

`npm ci` installs exactly the locked versions (421 packages, ~1 minute here).
`npm install` also works. You only need to do this once, or after pulling changes
to `package.json`.

### C.3 Environment variables

**None are required to run the demo.** The app is designed to start with an empty
environment using an embedded database.

| Variable | Required? | What it does | Safe handling |
| --- | --- | --- | --- |
| `DATABASE_URL` | No | Points the app at a real Postgres/Neon database instead of the embedded PGLite. | Leave unset. If you ever set it, keep it in your shell or a secret manager, **never** in a committed file. |
| `XAI_API_KEY` | No | Enables the live xAI/Grok "Decision Analyst". Without it the analyst answers from a deterministic, fully grounded fallback. | Leave unset for the demo. **Never paste it into a file in this repository.** |
| `CYBERSENSE_A11Y_ALLOW_LOOPBACK` | Only for the fixture demo | `=1` lets the accessibility scanner reach `localhost`/`127.0.0.1`. Off by default (SSRF protection). | Do not use it during a public deployment. `npm run dev:a11y-demo` sets it for you, for that one process only. |

There is **no `.env` file** in this repository and you should not create one.

### C.4 The exact command to start the application

```bash
npm run dev
```

For the full demonstration (which includes scanning the bundled controlled
fixture page) use instead:

```bash
npm run dev:a11y-demo
```

Both bind `0.0.0.0:8080`. Wait for this line before opening a browser:

```
  VITE v8.2.2  ready in ~10-18 s
  ➜  Local:   http://localhost:8080/
```

### C.5 The correct local URL

**http://localhost:8080** — this is the home page with the assessment form.

| Page | URL |
| --- | --- |
| Home / start an assessment | `http://localhost:8080/` |
| Northshore demo twin | `http://localhost:8080/assessments/asm_northshore_now` |
| Accessibility scanner | `http://localhost:8080/accessibility` |
| Controlled accessibility fixture | `http://localhost:8080/a11y-demo` |
| Readiness probe | `http://localhost:8080/api/v1/ready` |

### C.6 Database / seed command

**Nothing to run.** With `DATABASE_URL` unset the app starts an **embedded
Postgres (PGLite, in the server process)**, applies `migrations/*.sql` itself, and
on first data access seeds the synthetic Northshore corpus (three historical
snapshots: week −3, week −2, now).

Consequences to be aware of:

- Data is **in memory**: restarting the dev server resets everything and re-seeds.
- Your own scans disappear on restart. For a demo, do the run you want to show
  **in the same server session**.
- `npm run build` also runs `npm run db:migrate`, which prints
  `[migrate] DATABASE_URL not set — skipping` — that is expected and harmless.

### C.7 How to stop the application safely

Click the terminal and press **Ctrl + C**. Wait until the prompt returns.

If a stale server is holding port 8080, close the window, or in Git Bash:

```bash
for p in $(netstat -ano | grep LISTENING | grep ":8080" | awk '{print $5}' | sort -u); do taskkill //PID $p //F; done
```

### C.8 Verified command reference

| Command | Purpose | Tested result |
| --- | --- | --- |
| `npm run dev` | Start the app (safe defaults) | **PASS** |
| `npm run dev:a11y-demo` | Start the app with loopback accessibility scanning enabled | **PASS** |
| `npm run typecheck` | TypeScript check | **PASS** — 0 errors |
| `npm run lint` | ESLint | **PASS** — 0 errors, 4 warnings |
| `npm test` | Full test suite | **RUN** — 277 tests, 259 pass, **18 fail** (all pre-existing template-harness tests; see §F) |
| `npm run build` | Production build + migrate | **PASS** |
| `npm run preview:restart` | Production preview server | **DOES NOT RUN HERE** — that script requires a Linux `/proc`; use `npx vite preview` (see §F) |

> Two of the project's wrapper scripts were broken on Windows in the previous
> audit (`spawn vite ENOENT`, and a test glob that silently matched nothing). Both
> are already fixed in this branch, which is why `npm run dev` and `npm test` now
> work directly. If you find a `npm run` command in older notes that told you to
> bypass the wrapper, you no longer need to.

---

## D. Live demonstration script

Run `npm run dev:a11y-demo`, wait for the "ready" line, then open
**http://localhost:8080**.

### Step 1 — Start the application

> "I start the app with one command. It uses an embedded Postgres, so there is no
> database to install and no credentials in the repository."

Let it load fully (first load of a route can take a few seconds).

### Step 2 — Explain the dashboard

On the home page, point at the **Northshore State University** card:
posture **84 / CRITICAL**, 15 critical modeled paths, confidence **77 %**.

> "This is a **synthetic** institution — a demonstration twin, clearly labelled
> DEMO. Nothing here was scanned from a real network. Note that risk and
> confidence are two different numbers, and the tool refuses to blur them."

Point at the three small cards (Week −3 → 44, Week −2 → 73, Now → 84):

> "The twin is temporal. The same synthetic organization gets worse over three
> weeks as new external surfaces appear."

### Step 3 — Submit a supported input

Leave the form as it is (DEMO mode, target `demo-university.edu`) — or, to show the
authorization gate, switch to **LIVE**, keep the target `example.com`, and clear
the confirmation field first.

> "Every assessment needs an authorization statement. Live mode is passive DNS
> only: it asks a public resolver for an A record and never touches the target."

Click **Authorize and run**.

### Step 4 — Run the actual assessment

> "That single click ran the whole pipeline: normalization, asset resolution,
> evidence scoring, relationship building, the attack graph, path enumeration,
> risk and uncertainty. The result is stored as an immutable snapshot."

### Step 5 — Open the resulting findings

Walk the left navigation: **Executive → Paths → Graph → Risk**.

- *Executive*: posture, confidence, the highest-scoring modeled paths.
- *Paths*: each path labelled OBSERVED / MODELED / INFERRED, with its own score and
  confidence.
- *Graph*: the twin as nodes and edges.

> "Everything is labelled by how strongly it is known. 'Modeled' means the tool
> reasoned it; it is not a claim that it happened."

### Step 6 — Inspect the evidence

Open **Evidence**, then **Uncertainty**.

> "Every path points back to evidence records with a source, a timestamp, a
> freshness state and a confidence score. Uncertainty is reported, not hidden —
> this page lists what is missing and what is stale."

### Step 7 — Explain the recommended fixes

Open **Simulator** (MFA is pre-selected) and click **Apply to cloned graph**.
Then open **Optimize** and click **Find strategies**.

> "The simulator clones the graph and applies a control. **Risk before** is the
> same number the rest of the app shows — I fixed that, because a 'before/after'
> pair that starts from a different number is not a comparison. Residual risk is
> always recomputed and never assumed to be zero."

### Step 8 — Generate the report

Open **Reports** and click **Generate report**.

> "An eight-section report with references and an explicit language disclaimer:
> it describes modeled potential paths, not a breach."

### Step 9 — Accessibility (the Track D part)

Click **Accessibility** in the left navigation (or the card on the home page).

1. In the URL box type `http://127.0.0.1:8080/a11y-demo` and click
   **Run accessibility scan**. A real browser renders the page and axe-core runs
   its rules. Expect **12 failing rules, 28 failing elements, 27 rules passed, 1
   undecided** (~2–3 s).
2. Click **Open full findings**.
3. Walk one rule out loud: e.g. `color-contrast` → impact **serious** → WCAG
   `WCAG143` → the failing element `p` → the exact HTML and the contrast message.

> "Every rule id, impact, selector and snippet on this page came back from
> axe-core against a page the browser actually loaded. The fixture is a page I
> wrote with deliberate defects — an image with no alt text, a 2:1 contrast
> paragraph, an unlabelled field, an icon button with no accessible name — so you
> can see the scanner find exactly what it should. Nothing on this screen is
> prewritten."

4. Optional, to show the safety control: restart with plain `npm run dev`, submit
   the same `127.0.0.1` URL and show it is **refused** with
   `Scan refused (LOOPBACK_BLOCKED)`.

> "URL scanning has server-side validation, private-address and metadata-address
> blocking, a redirect restriction, timeouts and resource limits. Scanning
> localhost is refused unless it is explicitly switched on."

### Step 10 — Explain the limitations honestly

> "Three things I want to be precise about. First, automated rules cover only a
> subset of WCAG — a clean scan is not WCAG compliance, and we say so on screen.
> Second, the cybersecurity side is passive: passive DNS plus a synthetic corpus.
> There is no port scanning, no TLS or cookie inspection, no CVE matching — that
> was a design decision, not an unfinished feature. Third, today's test suite has
> 18 failing tests. They are all in the platform harness copied into this repo
> from the template, none of them in the application, and I have listed every one
> of them with its root cause."

---

## E. Detection capability list

### E.1 Implemented and verified by execution

**Accessibility (new this session)**

| Capability | Evidence |
| --- | --- |
| Real headless-browser page render + axe-core run | `axe-core 4.14.0` reported in every stored scan |
| Image with no alternative text | `image-alt` found on the fixture |
| Insufficient colour contrast | `color-contrast` found on the fixture |
| Form controls without accessible labels | `label`, `select-name` found on the fixture |
| Buttons/links without accessible names | `button-name`, `link-name` found on the fixture |
| Invalid ARIA roles | `aria-roles` found on the fixture |
| Non-semantic list markup | `list` found on the fixture |
| Heading level skipped | `heading-order` found on the fixture |
| Positive `tabindex` | `tabindex` found on the fixture |
| Frame with no title | `frame-title` found on the fixture |
| Missing/absent main landmark and heading-one, content outside landmarks | `landmark-one-main`, `page-has-heading-one`, `region` found on a live `example.com` scan |
| Per-finding rule id, impact, WCAG tags, selector, HTML snippet, remediation link | Rendered on the scan detail page |
| SSRF/validation refusals | 14 unit tests: schemes, credentials, ports, private/link-local/metadata addresses, internal DNS names, loopback opt-in, length limits |

**Cybersecurity (pre-existing, re-verified)**

| Capability | Evidence |
| --- | --- |
| Authorization gate: target-shape validation + required confirmation phrase + authorizer | Rejection paths in code + unit tests. `localhost`, `127.0.0.1`, IP literals, `.internal/.local/.lan` and non-domains are refused |
| Passive DNS A-record collection | Live lookup executed (`example.com`) |
| Asset resolution / canonical fingerprinting | Code + `engines.test.ts` |
| Evidence records with freshness and confidence | Documented formula in `scoring.ts`; unit tests |
| Attack graph + bounded path enumeration | Browser: 26 nodes / 60 edges / 16 paths |
| Risk scoring with named factors and bands | Browser: 84 / CRITICAL on the DEMO twin |
| Uncertainty, evidence gaps, verification tasks | Rendered on `/uncertainty` |
| Drift and Exposure Momentum (a SENTINEL-X project metric, labelled as such) | Browser on `/drift`, `/momentum` |
| Counterfactual simulation and defence optimization | Browser: both ran from the UI |
| Deterministic report generation | Browser: report rendered |
| Audit trail | Browser: `/audit` renders events |

### E.2 Demo / synthetic only

| Item | Label |
| --- | --- |
| The entire Northshore corpus — every asset, service fingerprint, certificate entry and repository observation | **SYNTHETIC** (`mock_osint`, `demo-university.edu` only) |
| `certificate_hostname`, `service_fingerprint`, `mx_record`, `public_repository` observation types | **DEMO only** — the LIVE path never emits them |
| The `/a11y-demo` fixture page | **SYNTHETIC** — deliberately broken page, marked in-product |
| Estimated control cost / "Defense Efficiency" | Modeling, not financial truth (stated in the UI) |

### E.3 Partial or unverified

| Item | Status |
| --- | --- |
| LIVE mode | **Partial.** Works, but produces only 1 hostname + A records. |
| LIVE without internet | **Not verifiable here** beyond the failure path: source failure is recorded as `FAILED`/`SOURCE_UNAVAILABLE`, and the scan becomes `PARTIAL`. |
| xAI/Grok live analyst | **NOT RUN** — no `XAI_API_KEY` on this machine. The deterministic fallback *was* verified. |
| Concurrent LIVE scans | **NOT MEASURED.** |
| Production/Vercel behaviour | **NOT MEASURED** (see §F.5). |

### E.4 Reported as missing (must not be implied in the demo)

- HTTP security headers, TLS/certificate inspection, cookie flags.
- Port/service probing, banner grabbing, vulnerability or CVE matching.
- Authenticated or post-login assessment of any kind.
- Any exploitation, credential testing or destructive action.
- Continuous monitoring, scheduling or alerting.
- Any claim of WCAG compliance. Automated rules cover a subset of WCAG; the
  product says this on the scan page and in the stored limitations.
- Accessibility results folded into the cyber risk score — deliberately kept
  separate in a separate table and a separate section of the app.

---

## F. Validation record

### F.1 Static checks

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npm run typecheck` | **PASS** — exit 0, 0 errors |
| Lint | `npm run lint` | **PASS** — exit 0, 0 errors, **4 warnings** (all pre-existing, unused variables) |
| Production build | `npm run build` | **PASS** — exit 0, `.vercel/output/nitro.json` generated; `db:migrate` correctly skips with no `DATABASE_URL` |
| Bundle hygiene | — | `playwright` and `axe-core` are **not** in the server bundle (resolved at call time), so the deploy bundle stays small |

Lint went from 6 warnings to 4 because dead code I touched was removed; no
suppression or rule was changed.

### F.2 Test suite

`npm test` — one honest run, exit code **1**:

```
ℹ tests 277
ℹ pass 259
ℹ fail 18
```

**259 passing** includes the **14 new accessibility-guard tests** (all passing)
and the 245 that passed before.

**The 18 failures are all in `scripts/*.test.mjs` and none are in application
code.** They are the platform/template harness that was copied into this repo and
never adapted. By file:

| File | Fails | Root cause |
| --- | --- | --- |
| `grok-pwa-plugin.test.mjs` | 8 | Assertions pinned to the template's default app name/`og:` placeholders; the app injects `SENTINEL-X` |
| `with-app-env.test.mjs` | 3 | Expects a template `.grok/app-env.json` that this repo does not ship; one test creates a symlink, which Windows refuses (`EPERM`) |
| `brand-check.test.mjs` | 3 | Reads `.grok/skills/og/SKILL.md`, which does not exist in this repository |
| `check-auth-invariant.test.mjs` | 2 | Same missing `.grok` template tree |
| `write-atomic.test.mjs` | 1 | Reads `.grok/skills/og/references` — absent |
| `migration-plan.test.mjs` | 1 | Expects the template's auth-migration layout |

These were **not** silenced, skipped, or deleted, and I did not weaken an
assertion to make them pass. They are outside the CyberSense application: fixing
them means either restoring the `.grok` template tree or rewriting template
assertions, neither of which serves the demo. **They are a known, open item.**

### F.3 Browser verification — development server

Harness: `reports/.evidence/harness/browser-qa.mjs` (Playwright, Chrome channel),
19 routes × 2 viewports = **38 checks**.

| Metric | Result |
| --- | --- |
| Routes returning `200` | **38 / 38** |
| Pages with visible content | **38 / 38** |
| Uncaught console / page errors | **0** |
| Hydration completed | **38 / 38** |
| Horizontal overflow at 390×844 (mobile) | **0** |
| **Problems** | **0** |

Evidence: `reports/.evidence/qa/qa-results-dev.json` + 38 screenshots.

### F.4 Browser verification — production build

`npm run build` succeeded, then the built output was served with
`npx vite preview` (127.0.0.1:8081) and the same 38 checks were run.

| Metric | Result |
| --- | --- |
| Routes returning `200` | **38 / 38** |
| Uncaught console / page errors | **0** |
| Horizontal overflow | **0** |
| **Problems** | **0** |

Evidence: `reports/.evidence/qa/qa-results-production.json`.
`GET /api/v1/ready` on the built output returned
`{"status":"ready","database":true,...}` from a real database query.

### F.5 Failures and checks that could NOT be verified

| Item | Status | Detail |
| --- | --- | --- |
| **PGLite assets are not emitted into the production bundle** | **PRE-EXISTING, NOT FIXED — reproduced** | `npm run build` succeeds, but the built server cannot start its embedded database on this machine: `pglite.data`, `pglite.wasm` and `initdb.wasm` exist in `node_modules/@electric-sql/pglite/dist/` and are **not** copied into `.vercel/output/functions/__server.func/_libs/`. The server crashes with `ENOENT`. **To complete the production-build check I manually copied those three files into the build output** (build output only — no source change). With them present, all 38 checks passed. On Vercel the platform injects `DATABASE_URL`, so the PGLite path is not used there; a local production server without `DATABASE_URL` is the affected case. **Remaining action:** add an asset-copy step to the build, or always set `DATABASE_URL`. |
| `npm run preview:restart` | **Does not run on Windows** | `scripts/preview.mjs` requires Linux `/proc`. Pre-existing; use `npx vite preview` instead (as above). |
| The 18 template-harness test failures | **Failing** | See §F.2. |
| xAI live analyst path | **NOT RUN** | No `XAI_API_KEY` here; deliberately not retried. |
| Deployed (Vercel) behaviour | **NOT MEASURED** | No deployment was made (and none was authorised). |
| Real third-party sites beyond `example.com` | **NOT SCANNED** | Only the controlled fixture and IANA's reserved example domain were used. |
| Concurrency / load / long-run soak | **NOT MEASURED.** | |

### F.6 Accessibility scanner — end-to-end evidence

Driven through the real UI (`/accessibility`), not by calling server functions.

| Run | Target | Result |
| --- | --- | --- |
| Secure default | `http://127.0.0.1:8080/a11y-demo` | **Refused** — `Scan refused (LOOPBACK_BLOCKED)`, no findings shown. SSRF control proven by its refusal. |
| `npm run dev:a11y-demo` | same fixture | **12 failing rules, 28 failing elements, 27 rules passed, 1 undecided.** **All 11 deliberately planted rule ids were found** (`image-alt`, `color-contrast`, `label`, `select-name`, `button-name`, `link-name`, `aria-roles`, `heading-order`, `list`, `tabindex`, `frame-title`), plus `region`. Console errors: **0**. |
| `npm run dev:a11y-demo` | `https://example.com/` (live, public) | **3 failing rules, 9 failing elements, 11 passed, 1 undecided** — `landmark-one-main`, `page-has-heading-one`, `region`, each with a real selector and axe's own message. Console errors: **0**. |
| Unit tests | guard only (no browser) | **14 / 14 PASS** (`src/lib/a11y/guard.test.ts`) |

Sampled WCAG tags from the fixture scan: `wcag2a ×7`, `wcag2aa ×1`, `wcag111`,
`wcag131`, `wcag143`, `wcag244`, `wcag412 ×5`.

Evidence: `reports/.evidence/qa/a11y-e2e-*.json`, `a11y-*.png`.

---

## G. Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `npm run dev` prints `'vite' is not recognized` / `ENOENT` | Dependencies not installed | `npm ci` in the **application** directory (the nested `CyberSense` folder). |
| `Error: listen EADDRINUSE :::8080` | Another server still holds the port | Press Ctrl+C in the other window, or run the `taskkill` one-liner in §C.7. |
| Browser shows "Something went wrong" | The error boundary caught a server error — the message is printed on the page | Read the message on the page. A cold-start database race used to cause this on the very first page load; that is **fixed** in this branch. If you see a *different* message, note it and restart. |
| Page takes 10–20 s on first open | Vite compiles routes on demand | Normal. Wait; subsequent visits are fast. |
| Blank page in the terminal's "ready" line but browser errors | Interacting before the page hydrates | Reload and wait a second before typing. |
| `[migrate] DATABASE_URL not set — skipping` | Expected | Harmless — the embedded database migrates itself. |
| Accessibility scan says `BROWSER_UNAVAILABLE` | No bundled Chromium, and no Chrome/Edge found | Install Google Chrome, or run `npx playwright install chromium`, then run the scan again. |
| Accessibility scan says `PLAYWRIGHT_MISSING` / `AXE_MISSING` | Dependencies incomplete | `npm ci` again. |
| Accessibility scan says `LOOPBACK_BLOCKED` | You are scanning `localhost`/`127.0.0.1` with the default safe settings | Restart with `npm run dev:a11y-demo`. |
| Accessibility scan says `PRIVATE_ADDRESS` | The hostname resolves inside your LAN, or is a link-local/metadata address | Expected and correct. Use a public URL. |
| Accessibility scan says `REDIRECT_OFF_ORIGIN` | The page redirected to a different host | Scan the final address instead, if it is in scope. |
| Accessibility scan says `DNS_FAILED` | Hostname does not resolve (typo, or offline) | Check the URL and your connection. |
| Accessibility scan says `TARGET_HTTP_ERROR` | The page returned 4xx/5xx | Nothing to scan; check the URL. |
| LIVE assessment returns `PARTIAL` with 0 paths | DNS returned no A record, or there is no internet | Expected. The app reports an *unknown* result — not a clean one. |
| Everything resets after restart | The embedded database is in-memory | Expected. Do demo runs in one server session. |
| Build succeeded but the built server cannot start its database | Missing PGLite runtime assets in the bundle (§F.5) | Set `DATABASE_URL`, or copy `pglite.data`, `pglite.wasm` and `initdb.wasm` from `node_modules/@electric-sql/pglite/dist/` into the server function's `_libs` folder. |
| Slow installs / random file-lock errors | The repo sits inside OneDrive | Move it outside OneDrive before the presentation. |

---

## H. What was changed, and why

Priority order was: startup → core workflow → truthful results → existing cyber
features → accessibility scanning.

| # | Issue | Root cause | Fix attempted | Verification | Remaining action |
| --- | --- | --- | --- | --- | --- |
| 1 | **First page load after every cold start returned HTTP 500** (the user's very first impression of the app). Message: `duplicate key value violates unique constraint "organizations_pkey"`. | `ensureSeeded()` was not concurrency-safe. The home loader requests the assessment list **and** the history in parallel; each call, plus `getSnapshot` per history row, saw "no organization yet" and inserted it. The losers crashed. | Single-flight the seed on a shared `globalThis` promise (retryable on failure, HMR-safe) **and** made the organization insert `on conflict (id) do nothing`. | **FIXED — verified.** Three separate cold restarts: first request `200` each time (previously `500` every time). | None. |
| 2 | Live DNS reported a **clean** source when the resolver returned no A record. | `dohAdapter` always prepended a `hostname_observed` observation, so `observations.length` was never 0 and the status ternary could never choose `PARTIAL`. | Status is now decided by the A-record count: `COMPLETED` only with ≥1 record, otherwise `PARTIAL` with an explicit "unknown, not a clean result" note. | **FIXED — verified** by code read and the live/failure path. | None. |
| 3 | The simulator's **"risk before" disagreed** with the posture shown everywhere else. | It averaged the five riskiest paths instead of using the landscape score the rest of the app reports. | `simulateDefense` now uses the same `landscapeScore()` as the executive/risk pages. Also removed a `|| crownBefore` fallback that inflated "critical paths before" whenever the real count was zero. | **FIXED — verified.** `npm test` simulation assertion still passes; both pages now agree. | None. |
| 4 | A twin with **no modelled path** displayed a reassuring `18 / LOW`. | The landscape score has a floor of 18, and nothing distinguished "nothing found" from "nothing to score". | Added `insufficientEvidence` to the risk assessment; the shell header, executive, technical, risk pages and the report now state "no score / insufficient evidence" instead of a number. | **FIXED — verified** by typecheck, tests, and browser render. | Consider surfacing it in the history list too (deliberately left alone). |
| 5 | `/api/v1/ready` and `readyFn` **hard-coded `database: true`**. | Readiness was asserted, never observed. | Both now run a real query and return `503` + `status: "unavailable"` on failure. | **FIXED — verified.** Built output returned real JSON from a live query. | Persisting failure state into `error_code`/`error_message` and honest `current_stage` values remain open (see #8). |
| 6 | **No accessibility functionality existed.** | Feature never built. | New scanner: Playwright renders the page, axe-core runs inside it, violations are stored verbatim; separate table, separate route tree, separate from cyber risk. Includes SSRF guard, redirect restriction, timeouts, resource limits, a controlled fixture page and 14 unit tests. | **IMPLEMENTED — verified** end to end through the UI: 11/11 planted defects found on the fixture; 3 real findings on a live public page; loopback refused under safe defaults. | Add richer rule sets / multiple viewports if time allows; some WCAG criteria can only be checked manually. |
| 7 | `/twin` hydration mismatch and `/audit` `[object Date]` crash reported by the previous audit. | Locale-dependent date in SSR; a `Date` object rendered as a React child. | Already fixed in this branch before I inspected it (`toUTCString()`; `String(row.createdAt)`). | **VERIFIED FIXED** — 0 console/page errors on both routes across 2 viewports in dev **and** the production build. | None. |
| 8 | Scan state is partly cosmetic: all 14 pipeline stages log `COMPLETED` with `startedAt === completedAt`, `current_stage` is always `"ready"`, and the `error_code`/`error_message` columns are never written. | Stage log records a static scaffold; failure columns unused. | **Not fixed (out of the remaining time).** The stage *details* do carry real counts, and a source failure does surface as `PARTIAL` with `FAILED`/`UNAVAILABLE` in the source-runs panel. | **Reproduced by code read.** Not displayed as "all good" anywhere else. | Add per-stage timestamps and persist failure state. Low risk, moderate effort. |
| 9 | 18 failing template-harness tests. | Platform template tests pinned to a template tree (`.grok/`, `app-env.json`, default app name) that this repo does not ship; two create symlinks, which Windows refuses. | **Not fixed — reported.** They are outside the application, and silencing or weakening them would hide a real signal. | **Reproduced**, per-file breakdown in §F.2. | Either restore the template tree or rewrite the template assertions. |
| 10 | PGLite runtime assets missing from the production bundle. | Build packaging: `pglite.data`/`.wasm` are not traced into the nitro output. | **Not fixed** (no source change made). Worked around for verification only by copying the assets into the build output. | **Reproduced.** With the assets present the built output passed all 38 checks. | Add an asset-copy step to the build, or always set `DATABASE_URL`. |

### Files added / changed (uncommitted)

**Added:** `src/lib/a11y/{types,guard,scan.server,repo,api}.ts`,
`src/lib/a11y/guard.test.ts`, `src/routes/accessibility.tsx`,
`src/routes/accessibility.index.tsx`, `src/routes/accessibility.$scanId.tsx`,
`src/routes/a11y-demo.tsx`, `migrations/0003_accessibility.sql`,
`scripts/dev-a11y-demo.mjs`, `docs/MENTOR_DEMO_GUIDE.md`,
`reports/.evidence/harness/{browser-qa,a11y-e2e}.mjs`,
`reports/.evidence/qa/`.

**Changed:** `package.json` (one npm script + `axe-core`),
`package-lock.json`, `scripts/run-tests.mjs` (register one new test file),
`src/lib/sentinel/{repo,risk,types,report,osint,defense,api}.ts`,
`src/routes/{index,api/v1/ready}.tsx/ts`,
`src/routes/assessments.$id.{index,risk,technical}.tsx`,
`src/components/sentinel/{shell,severity}.tsx`, `src/routeTree.gen.ts` (generated).

Nothing was deleted or disabled.

---

## I. Where the evidence lives

| Path | Contents |
| --- | --- |
| `reports/.evidence/qa/qa-results-dev.json` | All 19 routes × 2 viewports on the dev server |
| `reports/.evidence/qa/qa-results-production.json` | The same checks on the production build |
| `reports/.evidence/qa/a11y-e2e-*.json` | Accessibility scanner runs (fixture, refusal, live public) |
| `reports/.evidence/qa/*.png` | 49 screenshots (19 routes × desktop + mobile, plus the accessibility and rejection cases) |
| `reports/.evidence/harness/browser-qa.mjs` | Re-runnable route render / console harness |
| `reports/.evidence/harness/a11y-e2e.mjs` | Re-runnable accessibility scanner harness |
| `reports/.evidence/harness/sentinel-negative-cases.mjs` | Re-runnable assessment rejection / DEMO / LIVE form harness |
| `reports/.evidence/qa/sentinel-negative-cases.json` | Verified refusal messages and DEMO/LIVE outcomes |
| `reports/Test_Results.md`, `reports/CyberSense_Technical_Audit_Report.md` | The **previous** audit — background, not re-verified by this session |

### Reproducing this session's checks

```bash
cd "/c/Users/BALAJI N/OneDrive/Documents/GitHub/CyberSense/CyberSense"
npm ci
npm run typecheck && npm run lint
npm test                          # expect 259 pass / 18 fail (template harness)
npm run build
npm run dev                       # then, in another shell:
node reports/.evidence/harness/browser-qa.mjs
node reports/.evidence/harness/a11y-e2e.mjs --expect refusal
node reports/.evidence/harness/sentinel-negative-cases.mjs
# restart with: npm run dev:a11y-demo
node reports/.evidence/harness/a11y-e2e.mjs --expect findings
node reports/.evidence/harness/a11y-e2e.mjs --expect findings --target https://example.com/
```

---

## Summary for the mentor

1. **The application starts**, with `npm run dev` (or `npm run dev:a11y-demo` for
   the accessibility fixture). I fixed a crash that made the *first* page load
   fail with HTTP 500 on every cold start.
2. **Local URL:** http://localhost:8080
3. **Demonstrable today:** the full cyber exposure workflow (assessment →
   graph → paths → risk → evidence → uncertainty → simulator → optimizer →
   report → audit) on a clearly-labelled **synthetic** twin, plus a **real**
   accessibility scanner that finds real axe-core violations on a real rendered
   page — 11 of 11 planted defects on the controlled fixture and 3 real findings
   on a live public page.
4. **Real vs demo:** all cybersecurity *collection* in the demo is
   **DEMO/SYNTHETIC**; LIVE mode is real but limited to passive DNS. The
   accessibility findings, the graph/path/risk arithmetic, the simulations, the
   reports and the audit log are all produced by real execution over whatever the
   collection step returned.
5. **Fixed:** the cold-start 500 crash; DNS no-record status; the simulator's
   inconsistent baseline; a misleading low score on empty twins; a hard-coded
   readiness probe. Disabled: nothing.
6. **Accessibility status:** implemented and verified end to end, with SSRF
   protections, a controlled fixture and 14 unit tests. It is **not** a WCAG
   conformance claim, and the product says so on screen.
7. **Tests and build:** typecheck PASS, lint PASS (0 errors), tests 277 run /
   **259 pass / 18 fail** (all in the copied platform harness, none in the
   application), build PASS, and 38/38 browser checks clean on **both** the dev
   server and the production build.
8. **Report path:** `docs/MENTOR_DEMO_GUIDE.md`
   *(note: `docs/` is listed in `.gitignore`; a negation rule was added so this
   file can be committed when you decide to).*
