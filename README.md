# CyberSense

The CyberSense application lives in the [`CyberSense/`](CyberSense/) directory.

## Quick Start

```bash
cd CyberSense
npm install
npm run dev:a11y-demo    # demo server (scanning the bundled fixture is allowed)
# or: npm run dev        # standard server (public targets only)
```

Open <http://127.0.0.1:8080/accessibility> and scan `http://127.0.0.1:8080/a11y-demo`. Stop the server with Ctrl+C in its terminal.

Full instructions — prerequisites, environment variables, database persistence, the complete demo workflow, troubleshooting and known limitations — are in [`CyberSense/docs/CYBERSENSE_SETUP_AND_DEMO.md`](CyberSense/docs/CYBERSENSE_SETUP_AND_DEMO.md). See also [`CyberSense/README.md`](CyberSense/README.md) for features and architecture.

## Acknowledgements and AI Tools

**Libraries and frameworks:** CyberSense uses third-party libraries and frameworks, including React, TypeScript, Vite, Playwright, and axe-core. Refer to `package.json` for the complete dependency list and their respective licences.

**AI tools:** AI tools were used for assistance with development, debugging, documentation, and/or explanation where applicable. All project functionality and claims should be verified against the submitted code.

**Third-party resources:** Any reused code, assets, datasets, or documentation must be credited to their original sources.