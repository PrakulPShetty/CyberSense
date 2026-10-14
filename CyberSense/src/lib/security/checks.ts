import { lookup } from "node:dns/promises";
import { connect, type TLSSocket } from "node:tls";
import http from "node:http";
import https from "node:https";
import { isBlockedAddress, loopbackAllowed } from "../a11y/guard.ts";
import { isValidPublicDomain } from "../sentinel/normalize.ts";

export type SecurityCheckStatus = "pass" | "fail" | "not-verified" | "skipped" | "error";

export interface SecurityCheckResult {
  id: string;
  description: string;
  expected: string;
  observed: string;
  status: SecurityCheckStatus;
  severityRationale?: string;
  limitation?: string;
}

export interface SecurityCheckRun {
  /** Persisted identifier, added after the run is saved. */
  id?: string;
  targetUrl: string;
  startedAt: string;
  completedAt: string;
  results: SecurityCheckResult[];
  limitations: string[];
}

const HEADER_DEFAULTS: Record<string, string> = {
  "content-type": "text/html",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export function headerCheck(id: string, name: string, value: string | null): SecurityCheckResult {
  if (!value) {
    return {
      id,
      description: `HTTP response header ${name}`,
      expected: `${name} configured with a restrictive value`,
      observed: "not present",
      status: "fail",
      severityRationale: "A missing header can expose users to browser-level attacks, but it is not proof of compromise.",
    };
  }
  return {
    id,
    description: `HTTP response header ${name}`,
    expected: `${name} configured with a restrictive value`,
    observed: value,
    status: "pass",
    limitation: "Presence of a header is observed; policy strength still needs manual review.",
  };
}

function normalizeHeaderRecord(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
  return out;
}

export function cookieChecks(setCookie: string[]): SecurityCheckResult[] {
  if (!setCookie.length) {
    return [
      {
        id: "cookie-attributes",
        description: "Cookie security attributes",
        expected: "No insecure cookies observed",
        observed: "no Set-Cookie header in the initial response",
        status: "not-verified",
        limitation: "Cookies set after login or later requests were not observed.",
      },
    ];
  }
  const insecure: SecurityCheckResult = {
    id: "cookie-attributes",
    description: "Cookie security attributes",
    expected: "Secure, HttpOnly, and SameSite attributes where applicable",
    observed: setCookie.map((c) => c.slice(0, 300)).join("\n"),
    status: setCookie.every((c) => /;\s*secure/i.test(c)) ? "pass" : "fail",
    severityRationale: "Cookies without Secure can be exposed over plaintext HTTP; absence here does not imply exploitation.",
  };
  return [insecure];
}

export async function assertResolvesPublic(hostname: string): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch (err) {
    throw Object.assign(new Error(`The hostname ${hostname} did not resolve (DNS lookup failed).`), {
      error_code: "DNS_FAILED",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
  if (!addresses.length) throw Object.assign(new Error(`${hostname} resolved to no address.`), { error_code: "DNS_FAILED" });
  for (const a of addresses) {
    if (isBlockedAddress(a.address)) {
      throw Object.assign(
        new Error(`${hostname} resolves to a prohibited address (${a.address}), so the security check is refused.`),
        { error_code: "PRIVATE_ADDRESS" },
      );
    }
  }
}

interface HttpProbeResponse {
  status: number;
  type: string;
  headers: Headers & { getSetCookie?: () => string[] };
}

async function fetchWithTimeout(url: string, ms = 7000): Promise<HttpProbeResponse> {
  const target = new URL(url);
  const lib = target.protocol === "http:" ? http : https;
  return new Promise<HttpProbeResponse>((resolve, reject) => {
    const request = lib.request(target, {
      method: "GET",
      headers: HEADER_DEFAULTS,
      rejectUnauthorized: false,
      timeout: ms,
    }, (response) => {
      const raw = response.headers ?? {};
      const headers = new Headers();
      for (const [name, value] of Object.entries(raw)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const entry of value) headers.append(name, entry);
        } else {
          headers.set(name, String(value));
        }
      }
      const setCookie = Array.isArray(raw["set-cookie"])
        ? [...raw["set-cookie"]]
        : raw["set-cookie"]
          ? [String(raw["set-cookie"])]
          : [];
      const decorated = Object.assign(headers, { getSetCookie: () => setCookie });
      const body: Buffer[] = [];
      response.on("data", (chunk: Buffer) => body.push(chunk));
      response.on("end", () => {
        resolve({
          status: (response.statusCode ?? 0) || 502,
          type: "basic",
          headers: decorated,
        });
      });
      response.on("error", reject);
    });
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error(`Timed out after ${ms} ms`)));
    request.end();
  });
}

function tlsInfo(hostname: string, port = 443, ms = 5000): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let socket: TLSSocket | undefined;
    let settled = false;
    const done = (value: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      if (socket && !socket.destroyed) socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => {
      socket?.destroy();
      done({ tlsStatus: "timeout", detail: `TLS probe did not complete within ${ms} ms.` });
    }, ms);

    try {
      socket = connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
        clearTimeout(timer);
        const cert = (socket?.getPeerCertificate?.() ?? {}) as {
  valid_from?: string;
  valid_to?: string;
  subject?: { CN?: string };
  subjectaltname?: string;
};
        const authorized = Boolean(socket?.authorized);
        const authorizedError = socket?.authorizationError?.message ?? null;
        const validFrom = typeof cert.valid_from === "string" ? cert.valid_from : null;
        const validTo = typeof cert.valid_to === "string" ? cert.valid_to : null;
        const subjectCN = typeof cert.subject?.CN === "string" ? cert.subject.CN : null;
        const sans = Array.isArray(cert.subjectaltname) ? cert.subjectaltname.join(", ") : null;
        done({
          tlsStatus: authorized ? "valid" : "observed",
          tlsAuthorized: authorized,
          tlsAuthorizationError: authorizedError,
          tlsSubjectCN: subjectCN,
          tlsSubjectAltNames: sans,
          tlsValidFrom: validFrom,
          tlsValidTo: validTo,
          tlsProtocol: socket?.getProtocol?.() ?? null,
        });
      });
      socket.on("error", (err: Error) => {
        clearTimeout(timer);
        done({ tlsStatus: "error", detail: err.message });
      });
    } catch (err) {
      clearTimeout(timer);
      done({ tlsStatus: "error", detail: err instanceof Error ? err.message : String(err) });
    }
  });
}

export async function runSecurityChecks(rawUrl: string): Promise<SecurityCheckRun> {
  const started = new Date();
  let url: URL;
  try {
    const input = rawUrl.trim();
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    url = new URL(hasScheme);
  } catch {
    throw Object.assign(new Error("Invalid target URL for security checks."), { error_code: "INVALID_URL" });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw Object.assign(new Error("Only HTTP URLs can be checked."), { error_code: "UNSUPPORTED_SCHEME" });
  }
  if (url.username || url.password) {
    throw Object.assign(new Error("Credentials in URL are not allowed."), { error_code: "CREDENTIALS_IN_URL" });
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (isBlockedAddress(hostname) && !loopback) {
    throw Object.assign(new Error(`${hostname} resolves to a prohibited address, so the security check is refused.`), { error_code: "PRIVATE_ADDRESS" });
  }
  if (!isValidPublicDomain(hostname) && !loopback) {
    throw Object.assign(new Error("Security checks require a public DNS hostname."), { error_code: "INVALID_DOMAIN" });
  }
  if (!(loopback && loopbackAllowed(process.env))) {
    await assertResolvesPublic(hostname);
  }

  const results: SecurityCheckResult[] = [];
  const limitations: string[] = [
    "Only the initially requested response is observed; no session, discovery, or multi-step workflow is executed.",
    "These checks describe configuration strength and are not proof of exploitability or safety.",
  ];

  const targetUrl = `https://${hostname}${url.pathname}${url.search}`;
  try {
    const httpsUrl = new URL(targetUrl);
    const response = await fetchWithTimeout(httpsUrl.toString());
    results.push({
      id: "https-availability",
      description: "HTTPS availability",
      expected: "HTTPS responds without a certificate or transport error",
      observed: `HTTP ${response.status}`,
      status: response.status < 400 && response.type !== "opaque" ? "pass" : "fail",
      severityRationale: "If HTTPS is unavailable, traffic cannot be protected in transit.",
    });

    const headers = normalizeHeaderRecord(Object.fromEntries(response.headers.entries()));
    const setCookie = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    results.push(headerCheck("hsts", "strict-transport-security", headers["strict-transport-security"] ?? null));
    results.push(headerCheck("x-content-type-options", "x-content-type-options", headers["x-content-type-options"] ?? null));
    results.push(headerCheck("referrer-policy", "referrer-policy", headers["referrer-policy"] ?? null));
    results.push(headerCheck("content-security-policy", "content-security-policy", headers["content-security-policy"] ?? null));
    results.push(...cookieChecks(setCookie));

    if (httpsUrl.protocol === "https:") {
      const tls = await tlsInfo(hostname, 443);
      results.push({
        id: "tls-certificate",
        description: "TLS certificate validity",
        expected: "Certificate is valid, unexpired, and matches the hostname",
        observed: JSON.stringify(tls),
        status: tls.tlsStatus === "valid" ? "pass" : tls.tlsStatus === "observed" ? "fail" : "not-verified",
        severityRationale: tls.tlsStatus === "valid" ? undefined : "A certificate problem exposes users to connection or interception risk.",
        limitation: "Only the leaf certificate from the initial handshake is observed.",
      });
    } else {
      results.push({
        id: "tls-certificate",
        description: "TLS certificate validity",
        expected: "TLS certificate is valid",
        observed: "HTTP target does not provide certificate evidence without first negotiating TLS",
        status: "not-verified",
        limitation: "Run the check against the HTTPS host to obtain certificate evidence.",
      });
    }

    const plainUrl = new URL(`http://${hostname}${url.pathname}${url.search}`);
    const plain = await fetchWithTimeout(plainUrl.toString());
    if (isRedirect(plain.status)) {
      const location = plain.headers.get("location") ?? "";
      const redirectSafe = /^https:\/\//i.test(location) && new URL(location, plainUrl.toString()).hostname === hostname;
      results.push({
        id: "http-https-redirect",
        description: "HTTP-to-HTTPS redirect behavior",
        expected: "HTTP redirects to the same HTTPS URL",
        observed: `HTTP ${plain.status} Location: ${location || "(missing)"}`,
        status: redirectSafe ? "pass" : "fail",
        severityRationale: "If HTTP serves content without redirecting, users may send requests over plaintext.",
      });
    } else {
      results.push({
        id: "http-https-redirect",
        description: "HTTP-to-HTTPS redirect behavior",
        expected: "HTTP redirects to the same HTTPS URL",
        observed: `HTTP ${plain.status} with no redirect`,
        status: "fail",
        severityRationale: "HTTP content served directly can encourage insecure connections.",
      });
    }
  } catch (err) {
    results.push({
      id: "network-error",
      description: "Network observation",
      expected: "A live response can be observed from the authorized target",
      observed: err instanceof Error ? err.message + " :: " + ((err as { cause?: { message?: string } }).cause?.message || "NO CAUSE") : "Unknown network failure",
      status: "error",
      limitation: "A check failure means the observation could not be completed; it does not prove the site is safe or unsafe.",
    });
  }

  return {
    targetUrl,
    startedAt: started.toISOString(),
    completedAt: new Date().toISOString(),
    results,
    limitations,
  };
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400 && status !== 304;
}
