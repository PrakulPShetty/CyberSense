/** Deterministic normalization and asset fingerprinting. Never merge on similarity alone. */

const PROTOCOL_RE = /^(https?|ssh|git|ftp):\/\//i;

export function normalizeHostname(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(PROTOCOL_RE, "");
  const slash = s.indexOf("/");
  if (slash >= 0) s = s.slice(0, slash);
  const at = s.lastIndexOf("@");
  if (at >= 0) s = s.slice(at + 1);
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end > 0) return s.slice(1, end);
  }
  const colon = s.indexOf(":");
  if (colon >= 0) s = s.slice(0, colon);
  if (s.endsWith(".")) s = s.slice(0, -1);
  return s;
}

export function normalizeUrl(input: string): string {
  const raw = input.trim();
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const u = new URL(hasScheme ? raw : `https://${raw}`);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) {
      u.port = "";
    }
    if (u.pathname === "/") u.pathname = "";
    let out = `${u.protocol}//${u.hostname}`;
    if (u.port) out += `:${u.port}`;
    out += u.pathname.replace(/\/+$/, "");
    return out;
  } catch {
    return normalizeHostname(raw);
  }
}

export function extractPort(input: string): number | null {
  const s = input.trim();
  const m = s.match(/:(\d{1,5})(?:\/|$)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n < 65536 ? n : null;
}

export function parentDomain(hostname: string): string | null {
  const h = normalizeHostname(hostname);
  const parts = h.split(".").filter(Boolean);
  if (parts.length < 3) return null;
  return parts.slice(1).join(".");
}

export function isSubdomainOf(host: string, domain: string): boolean {
  const h = normalizeHostname(host);
  const d = normalizeHostname(domain);
  return h === d || h.endsWith(`.${d}`);
}

export function isValidPublicDomain(input: string): boolean {
  const h = normalizeHostname(input);
  if (!h || h.length > 253) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  if (h.includes(":")) return false;
  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (/\.(local|internal|intranet|lan|home|corp|private)$/.test(h)) return false;
  if (h.endsWith(".arpa")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(h);
}

export function isPrivateIp(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0 || a === 169) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function assetFingerprint(type: string, canonical: string): string {
  return `${type}:${canonical.toLowerCase()}`;
}

export function normalizeRepository(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^git\+/, "");
  s = s.replace(/\.git$/, "");
  s = s.replace(/^https?:\/\//, "").replace(/^git@/, "");
  s = s.replace(/github\.com[:/]/, "github.com/");
  return s.replace(/\/+$/, "");
}

export const DEMO_DOMAIN = "demo-university.edu";

export const ALLOWED_DEMO_TARGETS = new Set([
  DEMO_DOMAIN,
  `www.${DEMO_DOMAIN}`,
  `portal.${DEMO_DOMAIN}`,
]);
