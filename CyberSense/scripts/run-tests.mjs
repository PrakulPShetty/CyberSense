import { dirname, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url)); // scripts/ folder
const ROOT = join(SCRIPT_ROOT, '..');                        // project root (CyberSense subfolder)

function listScriptsTests() {
  const dir = join(ROOT, 'scripts');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => join(dir, f))
    .sort((a, b) => a.localeCompare(b));
}

function listSrcTests() {
  return [
    join(ROOT, 'src/lib/app-data/app-data.test.ts'),
    join(ROOT, 'src/lib/app-data/readiness-schedule.test.ts'),
    join(ROOT, 'src/lib/auth/gate-identity.test.ts'),
    join(ROOT, 'src/lib/auth/sign-in-gate.test.ts'),
    join(ROOT, 'src/lib/sentinel/normalize.test.ts'),
    join(ROOT, 'src/lib/sentinel/engines.test.ts'),
    join(ROOT, 'src/lib/a11y/guard.test.ts'),
    join(ROOT, 'src/lib/security/assistant.test.ts'),
    join(ROOT, 'src/lib/security/checks.test.ts'),
  ];
}

function runTests() {
  const scriptsTests = listScriptsTests();
  const srcTests = listSrcTests();

  const allScriptsExist = scriptsTests.every((p) => statSync(p).isFile());
  const allSrcExist = srcTests.every((p) => statSync(p).isFile());

  if (!allScriptsExist || !allSrcExist) {
    console.error('npm test: expected test files are missing from disk');
    console.error('  scripts missing:', scriptsTests.filter((p) => !statSync(p).isFile()));
    console.error('  src missing:', srcTests.filter((p) => !statSync(p).isFile()));
    process.exit(2);
  }

  // One honest node invocation runs every suite npm test is supposed to run.
  const proc = spawn(process.execPath, [
    '--experimental-strip-types',
    '--test',
    ...scriptsTests,
    ...srcTests,
  ], { stdio: 'inherit' });

  return new Promise((resolve) => {
    proc.on('exit', (code, signal) => {
      if (signal) resolve(1);
      else if (typeof code === 'number') resolve(code);
      else resolve(1);
    });
    proc.on('error', () => resolve(1));
  });
}

(async () => {
  try {
    const code = await runTests();
    process.exit(code);
  } catch (err) {
    console.error('npm test: unexpected error:', err?.message || err);
    process.exit(1);
  }
})();
