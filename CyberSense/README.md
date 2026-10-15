# CyberSense

CyberSense is an accessibility-first website scanning and analysis platform. It runs real browser-based accessibility checks with Playwright and axe-core, performs genuine low-impact website security configuration checks, stores results, explains findings in simple academic English, provides advisory remediation guidance, compares compatible historical scans, and generates downloadable PDF accessibility reports.

Legacy CyberSense cyber-exposure functionality remains in the codebase under `/assessments/*` for internal/historical use, but accessibility and security scanning are the primary workflows.

See [`docs/CYBERSENSE_SETUP_AND_DEMO.md`](docs/CYBERSENSE_SETUP_AND_DEMO.md) for the full setup, environment, database, troubleshooting, and demo guide.

## Quick Start

From the directory containing `package.json`:

```bash
npm install
npm run dev:a11y-demo    # demo server (scanning the bundled fixture is allowed)
# or: npm run dev        # standard server (public targets only)
```

Then open <http://127.0.0.1:8080/accessibility> and scan `http://127.0.0.1:8080/a11y-demo` — a synthetic page with known defects, for controlled demonstrations.

Stop the server with **Ctrl+C** in its terminal. Saved scans only survive restarts when `CYBERSENSE_PGLITE_DATA_DIR` is set — see the [setup guide](docs/CYBERSENSE_SETUP_AND_DEMO.md), section I.

## Primary URLs

- `/accessibility` — accessibility scanner and history.
- `/accessibility/$scanId` — saved accessibility scan, findings, evidence, AI explanation, recommendations, and PDF download.
- `/security` — low-impact website security checks.
- `/security/$id` — saved security check result, observed evidence, AI explanation, and advisory remediation guidance.

## Features

### Accessibility scanning

- A real headless browser renders the target page.
- axe-core runs its WCAG 2.0/2.1/2.2 A/AA and best-practice rule set.
- Findings include:
  - rule id
  - impact
  - description
  - relevant WCAG tags
  - affected element selector
  - HTML snippet
  - failure summary
  - target URL and timestamp
  - engine version and scan limitations
- Violations, incomplete checks, passing rules, and inapplicable rules are stored separately.
- Automated accessibility results are not a claim of full WCAG conformance.

### Website security checks

Current checks are deliberately low-impact and advisory:

- HTTPS availability.
- HTTP-to-HTTPS redirect behavior.
- TLS certificate evidence, where the TLS handshake can be observed.
- HTTP security headers:
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Content-Security-Policy`
- Cookie `Secure` attribute observation from the initial `Set-Cookie` response.

Each result records the actual observed value, expected condition, status, severity rationale where applicable, and limitations.

Supported statuses include:

- `pass`
- `fail`
- `not-verified`
- `skipped`
- `error`

A missing security header is not automatically treated as an exploitable vulnerability. A failed or unavailable check is not treated as a scan result of "no findings."

### Persistence

CyberSense uses the existing database layer and migrations.

- `accessibility_scans` stores accessibility scans and full scan records.
- `security_checks` stores security-check runs and full result records.

With the default local development database, data is stored through PGLite and does not survive a full process restart unless persistent storage is configured. Set `DATABASE_URL` to use a configured persistent Postgres/Neon database.

### AI Assistant

The AI Assistant explains only findings that are present in the saved scan or security-check record.

Accessibility and security explanations include:

- what the problem is
- why it matters
- who or what may be affected
- what the evidence shows
- ordered remediation guidance
- example fix
- where to apply it
- how to verify the result
- limitations and unknown items

If no evidence is available, the assistant says so instead of inventing findings.

The deterministic fallback works without an external AI key.

## Setup

Requirements:

- Node.js 22 or newer.
- NPM dependencies installed.

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The development server listens on port `8080`.

For a production build:

```bash
npm run build
```

Preview the built application:

```bash
npm run preview
```

Run database migrations:

```bash
npm run db:migrate
```

## Environment variables

CyberSense uses the project's existing environment conventions.

- `DATABASE_URL` — optional. When set, use the configured Postgres/Neon database. When unset, the app uses the local PGLite fallback.
- `CYBERSENSE_A11Y_ALLOW_LOOPBACK=1` — development-only opt-in that allows scanning the bundled controlled fixture at `http://127.0.0.1:8080/a11y-demo`.

Start the controlled fixture scanner locally with:

```bash
npm run dev:a11y-demo
```

Do not enable loopback scanning in public production scanning.

External AI provider keys are optional and must remain server-side. The application must remain usable when the provider is unavailable.

## Scanning safety

CyberSense applies server-side URL and SSRF protections before starting a browser or security request.

Current protections include:

- http/https only.
- No credentials in URL.
- No arbitrary port access for public targets.
- Rejection of loopback, private, link-local, reserved, and cloud metadata addresses by default.
- DNS resolution checks for public targets.
- Refusal to silently scan a redirect target on another host for accessibility scans.
- Timeouts and bounded scans.
- Controlled fixture scanning only when loopback is explicitly enabled for development.

Limitations:

- Automated checks cannot prove full security or accessibility safety.
- Security checks observe only the initial response and do not perform exploitation or intrusive scanning.
- Accessibility scans do not test authenticated pages, dynamic states, or every interactive component.

## Testing

Run the full test suite:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

Run linting:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

Some existing template tests fail for unrelated platform/sandbox reasons, including missing `.grok` skill fixtures and Windows symlink permissions. Those failures are not caused by CyberSense scanner logic.

Recent verification:

- accessibility target guard tests: passed.
- security explanation tests: passed.
- controlled accessibility fixture scan: passed.
- live public accessibility scan: passed.
- security check run against `https://example.com`: completed with evidence-backed statuses.

## Known limitations

- Global navigation has not yet been fully reduced to the six final primary destinations.
- PDF reports are functional but currently use a compact text-based layout rather than a feature-rich report design.
- Full browser end-to-end verification and database restart/retrieval verification are still pending.
- Legacy cyber-exposure routes remain present under `/assessments/*`.

## Git safety

Implementation is expected on `cybersense-development`.

Do not commit, push, merge, force-push, or modify `main` without explicit approval.
