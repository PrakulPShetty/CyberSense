# CyberSense — Setup and Demo Guide

This guide takes you from a fresh clone to a running CyberSense application: install, start, scan a page with real accessibility findings, run the security checks, download a PDF report, and stop the server safely.

Every command in this guide was taken from the actual project files (`package.json`, `scripts/*`, `src/routes/*`). Commands are copy-paste-ready for the shell named beside them. `Git Bash` and `PowerShell` commands are never interchangeable — use the block that matches your terminal.

> Complementary document: [`MENTOR_DEMO_GUIDE.md`](./MENTOR_DEMO_GUIDE.md) covers the demonstration narrative. This guide is the technical setup and run book.

## A. Project prerequisites

| Requirement | Why it is needed | Notes |
| --- | --- | --- |
| **Node.js 22 or newer** | The dev server, build and test runner all run on Node. `npm test` uses Node's TypeScript type-stripping (`--experimental-strip-types`). | Check with `node -v`. The project declares no `engines` field; Node 22+ is the documented baseline in the project README. |
| **npm** | Installs dependencies and runs the scripts in `package.json`. | Ships with Node. |
| **Git** | Clone the repository. Git Bash also provides the OpenSSL binary the security fixture looks for on Windows. | |
| **VS Code** (optional) | Editor used for development. | |
| **Chrome or Microsoft Edge** (recommended) | The accessibility scanner launches a real headless browser. It tries Playwright's bundled Chromium first, then an installed **Chrome**, then an installed **Edge** — so one of them must exist. The end-to-end script (`cybersense-e2e.mjs`) specifically uses the Edge channel. | If Playwright's browser download failed during install, having Chrome or Edge installed is enough — the scanner falls back to it automatically. |
| **OpenSSL** (optional) | Only needed for the synthetic **security-check fixture** (`scripts/cybersense-security-fixture.mjs`) and the security unit test, which generate a throwaway self-signed certificate. | On Windows the script automatically tries Git's `openssl.exe` and common install locations. You can point it at any binary with `CYBERSENSE_OPENSSL_BIN`. |

You do **not** need a database server. With no configuration, CyberSense runs on an embedded PGLite database (see section D).

## B. Repository setup

The application root is the directory that contains `package.json`. In this repository that directory is `CyberSense/` — one level below the repository root. If you cloned the repository into a folder also named `CyberSense`, the full path becomes `YourClone/CyberSense` (i.e. a nested `CyberSense/CyberSense`). Always confirm you are in the right directory before running anything: every npm script only works from the application root.

**Git Bash:**

```bash
pwd                 # where am I?
ls                  # what is here?
test -f package.json && echo "package.json found"
```

**PowerShell:**

```powershell
Get-Location
Get-ChildItem
Test-Path .\package.json
```

If the check prints `package.json found` (Git Bash) or `True` (PowerShell), you are in the application root. If not, move into it:

```bash
cd CyberSense       # Git Bash — from the repository root
```

```powershell
cd CyberSense       # PowerShell — from the repository root
```

> Do not run `Test-Path` in Git Bash or `test -f` in PowerShell — each command only exists in its own shell.

## C. Dependency installation

From the application root (the directory containing `package.json`):

```bash
npm install
```

Run this once after cloning, and again after switching branches that change dependencies. The install downloads the `playwright` package, which may also download a Chromium browser build; if that download is blocked by your network, the scanner can still use an installed Chrome or Edge (section A).

If `npm install` fails:

1. Confirm Node is 22+ (`node -v`) and you are in the application root (`test -f package.json`).
2. Re-run `npm install` once — transient registry/network failures are common.
3. If a previous install was interrupted, remove `node_modules` and `package-lock.json` is **not** required for a retry; a plain re-run is normally enough.

## D. Environment configuration

CyberSense uses **no `.env` file** — you should not create one. Configuration comes from environment variables you set in your shell, or from nothing at all (every variable is optional).

| Variable | Required? | What it does | Recommended value for a demo |
| --- | --- | --- | --- |
| `DATABASE_URL` | No | Points the app at a real Postgres/Neon database. When unset (or blank), the app uses the embedded **PGLite** fallback, which needs no setup. | Leave unset. If you ever set one, keep it out of committed files. |
| `CYBERSENSE_PGLITE_DATA_DIR` | No | Directory where the embedded PGLite database persists its files. When unset, PGLite runs **in memory** and every scan is lost when the server stops. | Set it before a demo so scan history survives restarts (section I). |
| `CYBERSENSE_A11Y_ALLOW_LOOPBACK` | Only for the fixture demo | `=1` allows the accessibility scanner to target `localhost` / `127.0.0.1`. Off by default as an SSRF protection. | Set automatically by `npm run dev:a11y-demo` for that one process. Never enable it in a public deployment. |
| `CYBERSENSE_OPENSSL_BIN` | No | Full path to an `openssl` executable, used only by the synthetic security fixture. | Leave unset; the fixture finds Git's OpenSSL on Windows by itself. |
| `CYBERSENSE_E2E_BASE` | No | Base URL used by the verification scripts (`cybersense-api.mjs`, `cybersense-e2e.mjs`). Defaults to `http://127.0.0.1:8080`. | Leave unset unless your server is elsewhere. |

Two more notes:

- `npm run dev`, `npm run build` and `npm run preview` route through `scripts/with-app-env.mjs`, which merges `VITE_*` keys from `.grok/app-env.json` into the process environment (an explicit `process.env` entry always wins). You normally never touch this file.
- **Never commit real credentials** in any file, and never paste API keys into the repository.

## E. Starting the website manually

There are two ways to start the development server. Both listen on **port 8080** and both must be started from the application root.

### Standard development server

```bash
npm run dev
```

Loopback (`127.0.0.1`) scan targets are **refused** by default. Use this for scanning public websites.

### Accessibility demo server (preferred for demonstrations)

```bash
npm run dev:a11y-demo
```

This is the same dev server, started with `CYBERSENSE_A11Y_ALLOW_LOOPBACK=1` for that one process, so you can scan the bundled controlled fixture at `http://127.0.0.1:8080/a11y-demo` — a synthetic page with deliberate, known accessibility defects. The flag is opt-in and process-scoped; a plain `npm run dev` keeps loopback refused.

### What to expect

- Keep the terminal open while you use the application — the dev server runs in it.
- Wait for Vite's ready output (it prints a `Local:` line pointing at `http://127.0.0.1:8080/`). The first page load can take a few extra seconds while Vite optimizes dependencies.
- Open **http://127.0.0.1:8080** in Chrome or Edge.

### If port 8080 is already occupied

The server is configured with `strictPort`, so it will **not** silently move to another port — it prints a "Port 8080 is already in use" error and exits. This almost always means a previous dev server is still running. Do **not** start a second instance; go back to the terminal running the old server and stop it (section J), then start again. To identify the process holding the port on Windows:

```powershell
netstat -ano | findstr :8080
```

then stop that specific PID (for example from Task Manager) — never by killing every Node.js process.

## F. Website pages

All pages are served by the running dev server at `http://127.0.0.1:8080`. These are the real routes in `src/routes/`:

| Route | What it is for |
| --- | --- |
| `/` | Public home / overview page. |
| `/accessibility` | **New Scan page.** Enter a URL, run a real browser + axe-core scan, see scan history and same-host comparisons. |
| `/accessibility/$scanId` | **Saved scan detail.** Full findings with evidence (rule id, impact, WCAG tags, element selector, HTML snippet), fix recommendations, AI explanation, PDF download. `$scanId` is the dynamic scan identifier, e.g. `/accessibility/a11y_89290d8f24724478`. |
| `/dashboard` | Overview of stored scans: metrics, recent scans, quick actions, scan-activity chart. |
| `/results` | Browse findings from stored scans. |
| `/recommendations` | Advisory, manual remediation guidance derived from stored scans. |
| `/assistant` | AI Assistant chat. Explanations are grounded in stored scan evidence. |
| `/history` | Saved scan records with search/filter and comparison. |
| `/reports` | Report listing and **Download PDF report** for stored scans. |
| `/security` | Low-impact website security checks (HTTPS, redirect, TLS, headers, cookies). |
| `/security/$id` | Saved security-check run with observed evidence, explanation and guidance. |
| `/a11y-demo` | The synthetic accessibility **test fixture** page (deliberate defects). Not part of the product UI. |
| `/assessments/$id/*` | Legacy cyber-exposure routes, kept for historical use. Not needed for the accessibility/security demo. |
| `/api/v1/health`, `/api/v1/ready` | Small HTTP endpoints for quick liveness/readiness checks (e.g. `curl http://127.0.0.1:8080/api/v1/health`). |

## G. Complete accessibility demo

This is the full demonstration workflow, start to finish. Start with the **demo server** so the bundled fixture can be scanned.

1. **Start the accessibility demo server** in the application root:

   ```bash
   npm run dev:a11y-demo
   ```

   Wait for the Vite ready line, then keep the terminal open.

2. **Open the scanner page:** <http://127.0.0.1:8080/accessibility>

3. **Enter the scan target** in the *Page URL* field:

   ```text
   http://127.0.0.1:8080/a11y-demo
   ```

   `/a11y-demo` is a synthetic test page that contains intentional accessibility defects with known axe-core rule ids (`image-alt`, `color-contrast`, `label`, `select-name`, `button-name`, `link-name`, `aria-roles`, `heading-order`, `list`, `tabindex`, `frame-title`, plus a best-practice `region` issue). Its results are for controlled demonstration only — they are not evidence about any external website.

4. **Confirm authorization.** Click **Run accessibility scan**. A dialog asks you to confirm the target and reminds you to only scan sites you own or are authorized to test. Click **Run scan** to proceed. (Client-side validation catches empty or malformed URLs first; the server re-validates every URL independently.)

5. **Wait for the scan to complete.** A "Scanning…" state appears while a real headless browser renders the page and axe-core runs its rules against the rendered DOM. Each scan has a 20-second navigation budget and a 45-second overall budget, so this normally takes a few seconds.

6. **Inspect real findings and evidence.** On completion, a summary panel shows failing rules, failing elements, rules passed and undecided rules, plus per-impact counts (critical / serious / moderate / minor). Click **Open full findings** to open `/accessibility/$scanId`, where every finding carries its rule id, impact, WCAG tags, affected element selector, HTML snippet and failure summary — all produced by the axe-core engine, nothing prewritten.

7. **Open Fix Recommendations.** From the scan detail page (the *Fix recommendations* section) or at `/recommendations`. Recommendations are advisory manual guidance — CyberSense never modifies your source code.

8. **Open the AI Assistant and explain a stored finding.** On the scan detail page, select a finding and click **Explain selected finding**. The explanation (also available at `/assistant`) answers *What is the problem?*, *Why does it matter?*, *What needs to be done?* and *How to verify* — grounded in the stored evidence of that exact finding. Without an external AI key the app uses a deterministic, fully grounded fallback; it never invents findings.

9. **Inspect History.** Open `/history` (or the history panel on `/accessibility`) to see the saved scan with its URL, timestamp and status. Two scans of the **same host** can be compared to see which findings are new, resolved or persistent.

10. **Download the PDF.** Open `/reports` and click **Download PDF report** (a *Download PDF report* link also exists on the scan completion panel). The PDF is generated on the server from the stored scan: branded cover, executive summary, findings with evidence, remediation guidance and limitations.

## H. Security checks demo

The security workflow is separate from accessibility scanning and works with either server (`npm run dev` is fine — these checks do not need loopback enabled unless you point them at a local target).

1. Open <http://127.0.0.1:8080/security>.
2. Enter an **authorized** target URL in the URL field and click **Run checks**.
3. The results heading shows *Results for <your URL>* with observed evidence for: HTTPS availability, HTTP-to-HTTPS redirect behavior, TLS certificate validity, the `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` and `Content-Security-Policy` headers, and cookie `Secure` attribute observation from the initial `Set-Cookie` response.
4. Each check records the actual observed value, the expected condition, a status (`pass`, `fail`, `not-verified`, `skipped` or `error`), a severity rationale where applicable, and its limitations. Saved runs open at `/security/$id` with explanation and advisory guidance.
5. Prohibited targets (loopback, private, link-local and cloud-metadata addresses) are refused before any request is made — the UI reports *Security check refused or unavailable* instead of results.

**Limitations — state them plainly during a demo:** these are deliberately low-impact, advisory configuration checks against the initial response of a target. They are **not** a penetration test, they do not probe, exploit or enumerate anything, and a missing header is not proof of a vulnerability. Only scan targets you own or are authorized to test.

## I. Database persistence

CyberSense stores accessibility scans in `accessibility_scans` and security runs in `security_checks` through the project's existing database layer.

- **Default (no configuration):** the app runs on an embedded **PGLite** database *in memory*. Everything works, but **saved scans disappear when the server stops**. This is expected behavior, not a bug.
- **Persistent local storage:** set `CYBERSENSE_PGLITE_DATA_DIR` to a directory before starting the server. PGLite then writes its database files there and every scan survives restarts.
- **External database:** set `DATABASE_URL` to a Postgres/Neon connection string instead. Leave it unset for demos.

**Git Bash:**

```bash
export CYBERSENSE_PGLITE_DATA_DIR="$HOME/CyberSenseData"
npm run dev:a11y-demo
```

**PowerShell:**

```powershell
$env:CYBERSENSE_PGLITE_DATA_DIR = "$HOME\CyberSenseData"
npm run dev:a11y-demo
```

Rules that matter:

- **Reuse the same directory after every restart** — point it somewhere new and the app starts with an empty database again.
- **Two running instances must not share the same data directory.** PGLite locks its directory; a second server opened on it will fail to initialize.
- The variable is read once at server start. Set it in the terminal *before* running `npm run dev…`.
- The environment variable applies to the current shell session only. Re-export it in every new terminal before restarting the server.

**Migrations.** `npm run db:migrate` exists and is normally run automatically as part of `npm run build`. It only applies SQL migration files to a `DATABASE_URL` Postgres database; with no `DATABASE_URL` it prints `[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).` and exits 0. The PGLite fallback applies the same migration files itself at startup, so **you never need to run it manually for the local demo**.

## J. Stopping the server

1. Focus the terminal window that is running the dev server — it is the one showing Vite output (`Local: http://127.0.0.1:8080/...` lines and request logs). It is a `node` process started by `npm run dev` or `npm run dev:a11y-demo`.
2. Press **Ctrl+C** in that terminal. The server shuts down cleanly and your shell prompt returns.
3. To restart later: `cd` back to the application root, re-export `CYBERSENSE_PGLITE_DATA_DIR` if you use it (section I), and run `npm run dev` or `npm run dev:a11y-demo` again.

Do **not** kill all Node.js processes to stop the server — that would also terminate editors, language servers and any other Node tools you have running. Ctrl+C in the right terminal is always sufficient. If the port still reports as occupied afterwards, check for a second terminal still running an old server.

## K. Testing and verification

### Ordinary commands (no server required)

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`). |
| `npm test` | Runs the project's test suites: the `scripts/*.test.mjs` files plus the listed unit tests under `src/lib/**` (URL guard, security checks and explanations, normalization, auth gates), using Node's test runner with TypeScript type-stripping. |
| `npm run build` | Production build (`vite build`), then database migrations (skipped without `DATABASE_URL`). |
| `npm run lint` | ESLint across the project. |
| `npm run format` | Prettier write-mode formatting. |

### Optional developer verification (requires a running dev server)

These talk to the app at `http://127.0.0.1:8080` (override with `CYBERSENSE_E2E_BASE`). Start the server first and keep it running.

**API harness — poke the real server functions:**

```bash
node scripts/cybersense-api.mjs listScans                 # list stored accessibility scans
node scripts/cybersense-api.mjs getScan <scanId>          # one full scan record with evidence
node scripts/cybersense-api.mjs compare <baseId> <laterId>  # compare two same-host scans
node scripts/cybersense-api.mjs listChecks                # list stored security runs
node scripts/cybersense-api.mjs getCheck <id>             # one full security-check record
node scripts/cybersense-api.mjs runScan https://example.com     # trigger a scan through the API
node scripts/cybersense-api.mjs runChecks https://example.com   # trigger security checks
```

Note: the CLI's `report`, `explain` and `recommendations` subcommands address the **security** variants of those functions (the security exports share those names and win the lookup). To generate an accessibility PDF, use the Download PDF button in the UI, which calls the accessibility report function.

**Restart-persistence check (two phases, around a restart):**

```bash
# with the server running and a scan already saved:
node scripts/cybersense-persistence-check.mjs record <scanId>
# stop the server (Ctrl+C), start it again with the SAME environment, then:
node scripts/cybersense-persistence-check.mjs verify <scanId>
```

`record` snapshots the scan, history entry and report metadata to your system temp directory; `verify` re-fetches them after the restart and compares everything (exit 0 = persistence verified). Without `CYBERSENSE_PGLITE_DATA_DIR` or `DATABASE_URL` set, the verify phase will honestly report the scan as missing — that is the in-memory default described in section I.

**End-to-end browser workflow (Playwright, uses Microsoft Edge):**

```bash
CYBERSENSE_E2E_BASE=http://127.0.0.1:8080 node scripts/cybersense-e2e.mjs
```

Requires the dev server running, Edge installed, and internet access (it scans `https://example.com` as a public target). It visits every main route, runs a real accessibility scan, opens the saved scan, requests an AI explanation, checks recommendations/history, downloads the PDF, runs the security checks, and asserts a refused loopback target — saving screenshots under `screenshots/`. It creates real records in the running server's database.

**Auth-flag invariant check:**

```bash
npm run check:auth   # against a running dev server; exit 0 = dev and build agree
```

**Standalone security fixture (advanced):**

```bash
node scripts/cybersense-security-fixture.mjs
```

Starts synthetic HTTP/HTTPS servers on `127.0.0.1:80` and `:443` with deliberately configured headers/cookies. Needs an OpenSSL binary and permission to bind ports 80/443. This is test infrastructure, not part of the product.

## L. Troubleshooting

**`Test-Path: command not found`**
You ran a PowerShell command inside Git Bash. `Test-Path`, `Get-Location` and `Get-ChildItem` are PowerShell-only; in Git Bash use `test -f`, `pwd` and `ls`. Conversely, `test -f` does not exist in PowerShell.

**`package.json` not found / `npm ERR! enoent`**
You are not in the application root. `cd` into the directory that contains `package.json` (in this repository: `CyberSense/` — see section B) and run the command again.

**`npm install` fails**
Confirm `node -v` reports 22+, confirm you are in the application root, then re-run `npm install` once — most failures are transient registry or proxy problems. The Playwright browser download may fail on restricted networks; that does not break the install, and the scanner can use an installed Chrome or Edge instead (section A).

**Port 8080 is already in use**
A previous dev server is still running (the server uses `strictPort`, so it refuses to move and exits). Stop the old server with Ctrl+C in its terminal, or find the holder on Windows with `netstat -ano | findstr :8080` and stop that specific PID. Do not start a second instance and do not kill unrelated Node processes.

**Blank page or Vite startup errors**
Wait for the `Local:` ready line before opening the browser; the first load may take a few seconds while Vite optimizes dependencies. Hard-refresh (Ctrl+Shift+R). If the page loads but a route errors, check the dev-server terminal — SSR errors print there — and reload. Use `http://127.0.0.1:8080` rather than a LAN IP for local work.

**`Error: aborted` or `ECONNRESET` in the server log**
Often harmless: closing a tab, cancelling a request, a proxy or an exceeded scan budget aborts an in-flight request and Node logs exactly this. Do not treat it as automatically fatal. Verify first: is the server still answering (`curl http://127.0.0.1:8080/api/v1/health`)? Did the scan appear in History? If the app is healthy and the problem does not reproduce, no code change is needed.

**Scan refused: loopback target**
Scanning `localhost` / `127.0.0.1` is refused by default (SSRF protection) and the refusal message names `CYBERSENSE_A11Y_ALLOW_LOOPBACK`. To scan the bundled fixture, start with `npm run dev:a11y-demo` instead of `npm run dev`. Never enable this flag in a public deployment.

**Scan results disappear after restarting the server**
Expected with the default in-memory PGLite. Set `CYBERSENSE_PGLITE_DATA_DIR` (section I) and restart, or configure `DATABASE_URL`. Also make sure you re-export the variable in the same terminal before restarting — shell variables do not survive new terminals.

**Browser/Playwright startup failures during a scan**
The scanner tries three launch paths in order: Playwright's bundled Chromium, installed Chrome, installed Edge. If the first fails (common when the browser download was blocked), install Chrome or Edge, or run `npx playwright install chromium` to fetch the bundled build. A scan that cannot launch any browser is recorded as a failure — never as a page that passed.

**PDF generation or download problems**
The PDF is generated on the server from a *stored* scan. If the download fails: confirm the scan still exists (in-memory data is lost on restart — section I), check the server terminal for the generation error, and verify the scan id on `/reports` matches the one you expect. A valid file starts with `%PDF-`.

**Security fixture / OpenSSL issues (`cybersense-security-fixture.mjs`, security unit tests)**
The fixture needs an `openssl` binary to mint a throwaway certificate and permission to bind ports 80 and 443 on `127.0.0.1`. On Windows the script probes Git's `openssl.exe` automatically; otherwise set `CYBERSENSE_OPENSSL_BIN` to the full path of your openssl executable. If port binding fails, another service (IIS, another web server) may hold 80/443, or your user may lack the right to bind privileged ports. The fixture is test infrastructure — the main application never needs it.

## M. Known limitations

- **Automated accessibility results are not WCAG conformance.** axe-core detects a subset of success criteria. The page is loaded once, at one viewport, in its initial state; menus, modals, authenticated pages and interactive states are not exercised, and some issues require manual testing.
- **Security checks are advisory and low-impact.** They observe the initial response (HTTPS, redirect, TLS evidence, four security headers, cookie attributes). They are not a penetration test, never probe or exploit anything, and statuses include `not-verified`, `skipped` and `error` by design. A missing header is not proof of a vulnerability.
- **The AI Assistant is deterministic by default.** Without an external AI provider key it answers from a fully grounded fallback built only from the stored evidence of the selected finding. It never invents findings and never claims an external AI service was used.
- **`/a11y-demo` is a synthetic fixture.** Its defects are deliberate and annotated; results from it demonstrate the scanner, and say nothing about any external website.
- **Default storage is in-memory.** Without `CYBERSENSE_PGLITE_DATA_DIR` or `DATABASE_URL`, scans and history vanish on server restart (section I).
- **Legacy routes remain.** The historical `/assessments/*` cyber-exposure routes still exist in the codebase; they are not part of the accessibility/security workflow.

## Quick reference

```bash
# one-time, from the application root (the folder containing package.json):
npm install

# every demo session (pick ONE server):
npm run dev:a11y-demo     # demo with the bundled fixture (loopback enabled)
npm run dev               # standard server (public targets only)

# then open:
#   http://127.0.0.1:8080/accessibility   — scan http://127.0.0.1:8080/a11y-demo
#   http://127.0.0.1:8080/security        — security checks
#   http://127.0.0.1:8080/reports         — download the PDF

# persistent history (optional, set BEFORE starting the server):
#   Git Bash:  export CYBERSENSE_PGLITE_DATA_DIR="$HOME/CyberSenseData"
#   PowerShell: $env:CYBERSENSE_PGLITE_DATA_DIR = "$HOME\CyberSenseData"

# stop: Ctrl+C in the server's terminal.
```
