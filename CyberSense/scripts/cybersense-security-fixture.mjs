#!/usr/bin/env node
/**
 * CONTROLLED SECURITY-CHECK FIXTURE — synthetic target servers, not product code.
 *
 * The security checks in `src/lib/security/checks.ts` observe a target's HTTPS
 * response (headers, cookies, TLS evidence) and its HTTP→HTTPS redirect. To
 * verify those checks against *known* responses, this script stands up two
 * local-only servers with deliberately configured behaviour:
 *
 *   - HTTP  on 127.0.0.1:80  — redirects / to the HTTPS equivalent
 *   - HTTPS on 127.0.0.1:443 — serves configurable header/cookie profiles with
 *                              a self-signed certificate for `localhost`
 *
 * The security-check target builder always uses the standard ports (80/443),
 * which is why the fixture uses them. A self-signed certificate is generated at
 * start-up with the local `openssl` binary into a scratch directory; it is
 * intentionally untrusted, so the TLS check is expected to report observed
 * (not valid) certificate evidence — that is the deterministic result being
 * verified.
 *
 * Usage (standalone):  node scripts/cybersense-security-fixture.mjs
 * Usage (from a test): import { startSecurityFixture } from the same file.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";

/** Deterministic profiles served by the HTTPS fixture. */
export const PROFILES = {
  /** / and /secure-cookie: strict headers + a hardened cookie. */
  strict: {
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy": "default-src 'self'; frame-ancestors 'self'",
  },
  /** /insecure-cookie: same headers, cookie missing Secure. */
  insecureCookie: {
    "set-cookie": "fixture_session=abc123; Path=/; HttpOnly; SameSite=Lax",
  },
  /** /no-headers: completely bare response. */
  none: {},
};

/** @param {string} body */
function html(body) {
  return `<!doctype html><html lang="en"><head><title>CyberSense security fixture</title></head><body>${body}</body></html>`;
}

function findOpenssl() {
  const candidates = [
    process.env.CYBERSENSE_OPENSSL_BIN,
    "openssl",
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe",
    "C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      execFileSync(candidate, ["version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

/** @param {string} dir @param {string} openssl */
function makeSelfSignedCert(dir, openssl) {
  const keyPath = join(dir, "fixture-key.pem");
  const certPath = join(dir, "fixture-cert.pem");
  // CA:TRUE so the certificate can be used as a one-off trust anchor via
  // NODE_EXTRA_CA_CERTS for the test/dev run — never for anything real.
  execFileSync(
    openssl,
    [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath,
      "-days", "2",
      "-subj", "/CN=localhost",
      "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-addext", "basicConstraints=critical,CA:TRUE",
    ],
    { stdio: "ignore" },
  );
  return { key: keyPath, cert: certPath };
}

/** @param {{ withTls?: boolean; scratchDir?: string }} [options] */
export async function startSecurityFixture({ withTls = true, scratchDir } = {}) {
  const ownedDir = scratchDir ?? mkdtempSync(join(tmpdir(), "cybersense-sec-fixture-"));
  let tls = null;
  let tlsError = null;
  let tlsCertPath = null;
  if (withTls) {
    const openssl = findOpenssl();
    if (!openssl) {
      tlsError = "no openssl binary found (set CYBERSENSE_OPENSSL_BIN)";
    } else {
      try {
        const { key, cert } = makeSelfSignedCert(ownedDir, openssl);
        tls = { key: readFileSync(key), cert: readFileSync(cert) };
        tlsCertPath = cert;
      } catch (err) {
        tlsError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const http = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/no-redirect") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(html("<p>Plain HTTP served without redirecting.</p>"));
      return;
    }
    // Deterministic redirect: same host, https scheme.
    res.writeHead(301, { location: `https://localhost${url.pathname}${url.search}` });
    res.end("");
  });

  const https = tls
    ? createHttpsServer(tls, (req, res) => {
        const url = new URL(req.url ?? "/", "https://localhost");
        let headers = /** @type {Record<string, string | string[]>} */ ({ "content-type": "text/html" });
        if (url.pathname === "/insecure-cookie") {
          headers = { ...headers, ...PROFILES.strict, "set-cookie": PROFILES.insecureCookie["set-cookie"] };
        } else if (url.pathname === "/no-headers") {
          headers = { "content-type": "text/html" };
        } else {
          headers = { ...headers, ...PROFILES.strict };
          headers["set-cookie"] = "fixture_secure=xyz789; Path=/; Secure; HttpOnly; SameSite=Strict";
        }
        res.writeHead(200, headers);
        res.end(html(`<p>CyberSense HTTPS fixture at ${url.pathname}</p>`));
      })
    : null;

  await new Promise((resolve, reject) => {
    http.once("error", reject);
    /** @type {(port: number, host: string, callback: () => void) => void} */
    const httpListen = http.listen;
    httpListen.call(http, 80, "127.0.0.1", () => resolve(null));
  });
  let httpsServer = null;
  if (https) {
    httpsServer = await new Promise((resolve, reject) => {
      https.once("error", reject);
      /** @type {(port: number, host: string, callback: () => void) => void} */
      const httpsListen = https.listen;
      httpsListen.call(https, 443, "127.0.0.1", () => resolve(null));
    });
  }

  return {
    httpOrigin: "http://localhost",
    httpsOrigin: "https://localhost",
    tlsAvailable: Boolean(https),
    tlsError,
    tlsCertPath,
    scratchDir: ownedDir,
    async close() {
      await new Promise((resolve) => http.close(() => resolve(null)));
      if (https) await new Promise((resolve) => https.close(() => resolve(null)));
      if (!scratchDir) rmSync(ownedDir, { recursive: true, force: true });
    },
  };
}

import { readFileSync } from "node:fs";

// Standalone mode: start the fixture and keep it running.
if (process.argv[1] && process.argv[1].endsWith("cybersense-security-fixture.mjs")) {
  const fixture = await startSecurityFixture();
  console.log(
    `[security-fixture] http://localhost (80) up; https://localhost (443) ${fixture.tlsAvailable ? "up" : `down (${fixture.tlsError})`}`,
  );
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => fixture.close().then(() => process.exit(0)));
}
