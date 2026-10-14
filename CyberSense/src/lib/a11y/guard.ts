/**
 * Server-side target validation and SSRF rules for URL-based browser scanning.
 *
 * A headless browser is a much more capable fetcher than `fetch()`, so the guard
 * is deliberately strict and applied BEFORE the browser is ever started:
 *
 *   - http/https only (no file:, data:, chrome:, blob:, view-source:)
 *   - no embedded credentials (`https://user:pass@host/`)
 *   - never the target's own protocol default port tricks — only 80/443
 *   - the hostname must be a public DNS name, which by construction rejects every
 *     IP literal, `localhost`, `*.localhost`, `.local`, `.internal`, `.arpa`
 *   - the hostname is then resolved and every returned address is checked against
 *     the blocked ranges (RFC1918, loopback, link-local incl. the cloud metadata
 *     address 169.254.169.254, CGNAT, multicast, reserved, IPv6 ULA/link-local)
 *
 * Loopback is refused by default. It can be enabled for the bundled controlled
 * fixture page by starting the app with `CYBERSENSE_A11Y_ALLOW_LOOPBACK=1`
 * (`npm run dev:a11y-demo`), so a demo can scan a page with known defects without
 * opening the scanner to the machine it runs on.
 */
import { isPrivateIp, isValidPublicDomain } from "../sentinel/normalize.ts";

export const ALLOW_LOOPBACK_ENV = "CYBERSENSE_A11Y_ALLOW_LOOPBACK";
export const MAX_TARGET_URL_LENGTH = 2048;

export type UrlGuardResult =
  | { ok: true; url: URL; loopback: boolean }
  | { ok: false; error_code: string; message: string };

function reject(error_code: string, message: string): UrlGuardResult {
  return { ok: false, error_code, message };
}

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0" || h.endsWith(".localhost");
}

/** IPv4/IPv6 recognition plus every range we refuse to let the browser reach. */
export function isBlockedAddress(address: string): boolean {
  const raw = address.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!raw) return false;

  if (raw.includes(":")) {
    // IPv4-mapped / IPv4-compatible forms carry an embedded IPv4 address.
    const mapped = raw.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped && isPrivateIp(mapped[1])) return true;
    if (raw === "::" || raw === "::1" || raw === "0:0:0:0:0:0:0:0") return true;
    if (/^f[cd][0-9a-f]{2}:/.test(raw)) return true; // unique-local fc00::/7
    if (/^fe[89ab][0-9a-f]:/.test(raw)) return true; // link-local fe80::/10
    if (/^ff[0-9a-f]{2}:/.test(raw)) return true; // multicast ff00::/8
    return false;
  }

  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return false;
  const octets = raw.split(".").map(Number);
  if (octets.some((o) => o > 255)) return false;
  const [a, b, c] = octets;
  if (isPrivateIp(raw)) return true; // 10/8, 127/8, 0/8, 169.254/16, 192.168/16, 172.16/12, 100.64/10
  if (a >= 224) return true; // multicast + reserved
  // Documentation / benchmarking ranges: never globally reachable, so never a
  // legitimate audit target. Matched at the precise /24, not the whole /16.
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  return false;
}

/** A DNS name that is not a public registrable domain is never a valid target. */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return isLoopbackHostname(h) || !isValidPublicDomain(h);
}

export function loopbackAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env[ALLOW_LOOPBACK_ENV] === "1";
}

export function guardScanUrl(raw: string, env: Record<string, string | undefined> = process.env): UrlGuardResult {
  const input = (raw ?? "").trim();
  if (!input) return reject("EMPTY_URL", "Enter a URL to scan.");
  if (input.length > MAX_TARGET_URL_LENGTH) {
    return reject("URL_TOO_LONG", `URL must be at most ${MAX_TARGET_URL_LENGTH} characters.`);
  }

  let url: URL;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(input);
    url = new URL(hasScheme ? input : `https://${input}`);
  } catch {
    return reject("INVALID_URL", "That is not a parsable URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return reject("UNSUPPORTED_SCHEME", `Only http and https URLs can be scanned, not ${url.protocol.replace(":", "")}:.`);
  }
  if (url.username || url.password) {
    return reject("CREDENTIALS_IN_URL", "Remove the credentials from the URL — the scanner never sends a login.");
  }

  url.hash = "";
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const loopback = isLoopbackHostname(hostname);

  // The loopback decision comes first so that the reason reported is the real
  // one, and so the designated local fixture — which is served on the dev port,
  // not 80/443 — is not rejected by the public-target port rule instead.
  if (loopback) {
    if (!loopbackAllowed(env)) {
      return reject(
        "LOOPBACK_BLOCKED",
        `Scanning ${hostname} is refused by default (server-side request forgery protection). ` +
          `To scan the built-in demonstration page, start the app with ${ALLOW_LOOPBACK_ENV}=1 — ` +
          `\`npm run dev:a11y-demo\` does that for you.`,
      );
    }
    return { ok: true, url, loopback: true };
  }

  // Ports are restricted for public targets: the scanner is a page auditor, not a
  // port probe.
  if (url.port && url.port !== "80" && url.port !== "443") {
    return reject("PORT_NOT_ALLOWED", `Only the standard web ports are scanned (80/443); refused port ${url.port}.`);
  }

  if (isBlockedAddress(hostname)) {
    return reject("PRIVATE_ADDRESS", "Scanning a private, loopback or link-local address is refused.");
  }
  if (!isValidPublicDomain(hostname)) {
    return reject(
      "INVALID_DOMAIN",
      "That hostname is not a public DNS name (IP literals, .local, .internal and .arpa are refused).",
    );
  }

  return { ok: true, url, loopback: false };
}
