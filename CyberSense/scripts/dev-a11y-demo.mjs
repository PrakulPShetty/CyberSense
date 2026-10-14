#!/usr/bin/env node
/**
 * `npm run dev:a11y-demo` — dev server with loopback accessibility scanning enabled.
 *
 * The accessibility scanner refuses loopback targets by default so a URL-based
 * browser scan can never reach the machine it runs on. Demonstrating the
 * scanner against the bundled controlled fixture (`/a11y-demo`, a page with
 * deliberate axe-core defects) needs exactly that reach, so this script sets
 * `CYBERSENSE_A11Y_ALLOW_LOOPBACK=1` for the dev server only — in one
 * cross-platform command, instead of asking the operator for shell-specific
 * `VAR=1 …` / `set VAR=1 && …` syntax.
 *
 * The flag is opted into explicitly here; a plain `npm run dev` keeps loopback
 * refused.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const child = spawn(
  process.execPath,
  [join(ROOT, "scripts", "with-app-env.mjs"), "vite", "dev", "--host", "0.0.0.0", "--port", "8080"],
  {
    stdio: "inherit",
    cwd: ROOT,
    env: { ...process.env, CYBERSENSE_A11Y_ALLOW_LOOPBACK: "1" },
  },
);

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (err) => {
  console.error("[dev:a11y-demo] failed to start the dev server:", err?.message || err);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
