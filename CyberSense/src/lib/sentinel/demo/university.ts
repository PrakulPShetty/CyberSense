import { DEMO_DOMAIN } from "../normalize.ts";
export { DEMO_DOMAIN };
import type {
  AssetType,
  Criticality,
  KnownInventoryItem,
  Organization,
  RawObservation,
} from "../types.ts";

export const NORTHSHORE: Organization = {
  id: "org_northshore",
  name: "Northshore State University",
  canonicalDomain: DEMO_DOMAIN,
  sector: "Higher education (synthetic)",
};

/**
 * Fingerprints must match `assetFingerprint(type, host)` used by asset resolution.
 * Matching also falls back to the host suffix via `isKnownInventory`.
 */
export const KNOWN_INVENTORY: KnownInventoryItem[] = [
  { canonicalId: `domain:${DEMO_DOMAIN}`, displayName: DEMO_DOMAIN, assetType: "domain", criticality: "HIGH" },
  { canonicalId: `subdomain:www.${DEMO_DOMAIN}`, displayName: `www.${DEMO_DOMAIN}`, assetType: "subdomain", criticality: "LOW" },
  { canonicalId: `application:portal.${DEMO_DOMAIN}`, displayName: `portal.${DEMO_DOMAIN}`, assetType: "application", criticality: "CRITICAL" },
  { canonicalId: `subdomain:vpn.${DEMO_DOMAIN}`, displayName: `vpn.${DEMO_DOMAIN}`, assetType: "subdomain", criticality: "HIGH" },
  { canonicalId: `subdomain:mail.${DEMO_DOMAIN}`, displayName: `mail.${DEMO_DOMAIN}`, assetType: "subdomain", criticality: "MEDIUM" },
  { canonicalId: `authentication_endpoint:auth.${DEMO_DOMAIN}`, displayName: `auth.${DEMO_DOMAIN}`, assetType: "authentication_endpoint", criticality: "CRITICAL" },
  { canonicalId: `identity_surface:idp.${DEMO_DOMAIN}`, displayName: `idp.${DEMO_DOMAIN}`, assetType: "identity_surface", criticality: "CRITICAL" },
  { canonicalId: `api:api.${DEMO_DOMAIN}`, displayName: `api.${DEMO_DOMAIN}`, assetType: "api", criticality: "HIGH" },
  { canonicalId: `data_asset:student-sis-db`, displayName: "Student Information Database", assetType: "data_asset", criticality: "CRITICAL" },
];

export function isKnownInventory(canonicalId: string, displayName?: string): boolean {
  if (KNOWN_INVENTORY.some((k) => k.canonicalId === canonicalId)) return true;
  const host = canonicalId.includes(":") ? canonicalId.split(":").slice(1).join(":") : canonicalId;
  if (KNOWN_INVENTORY.some((k) => k.displayName === host || k.displayName === displayName)) return true;
  return KNOWN_INVENTORY.some((k) => {
    const kh = k.canonicalId.includes(":") ? k.canonicalId.split(":").slice(1).join(":") : k.canonicalId;
    return kh === host;
  });
}

export type DemoSlice = "w1" | "w2" | "now";

function obs(partial: Omit<RawObservation, "id"> & { id: string }): RawObservation {
  return partial;
}

const RELIABLE_DNS = 0.92;
const RELIABLE_CT = 0.88;
const RELIABLE_REPO = 0.74;
const RELIABLE_FINGERPRINT = 0.8;

function dnsSub(id: string, host: string, at: string, extra?: Partial<RawObservation>): RawObservation {
  return obs({
    id,
    sourceName: "mock_dns",
    sourceType: "dns",
    observationType: "hostname_observed",
    observedAt: at,
    target: DEMO_DOMAIN,
    rawReference: `dns:${host}`,
    value: host,
    metadata: { record: "CNAME_OR_A" },
    sourceReliability: RELIABLE_DNS,
    confidence: 0.95,
    ...extra,
  });
}

function aRecord(id: string, host: string, ip: string, at: string): RawObservation {
  return obs({
    id,
    sourceName: "mock_dns",
    sourceType: "dns",
    observationType: "a_record",
    observedAt: at,
    target: host,
    rawReference: `dns-a:${host}`,
    value: ip,
    metadata: { hostname: host, ip },
    sourceReliability: RELIABLE_DNS,
    confidence: 0.93,
  });
}

function cert(id: string, host: string, at: string): RawObservation {
  return obs({
    id,
    sourceName: "mock_ct",
    sourceType: "certificate_transparency",
    observationType: "certificate_hostname",
    observedAt: at,
    target: DEMO_DOMAIN,
    rawReference: `ct:${host}`,
    value: host,
    metadata: { san: host, issuer: "Synthetic CA" },
    sourceReliability: RELIABLE_CT,
    confidence: 0.9,
  });
}

/**
 * Temporal corpus:
 *   w1  — public www/mail/portal hostnames + declared SIS inventory (no login, VPN, or API)
 *   w2  — identity/VPN/API surfaces and staging/admin appear
 *   now — CI, leftover VPN, public repo, and a development host expand the twin
 */
export function demoObservations(slice: DemoSlice, nowIso: string): RawObservation[] {
  const t = (daysAgo: number) => new Date(Date.parse(nowIso) - daysAgo * 86400000).toISOString();

  const w1: RawObservation[] = [
    dnsSub("obs_root", DEMO_DOMAIN, t(20)),
    dnsSub("obs_www", `www.${DEMO_DOMAIN}`, t(18)),
    dnsSub("obs_portal", `portal.${DEMO_DOMAIN}`, t(12)),
    dnsSub("obs_mail", `mail.${DEMO_DOMAIN}`, t(14)),
    cert("obs_ct_www", `www.${DEMO_DOMAIN}`, t(40)),
    cert("obs_ct_portal", `portal.${DEMO_DOMAIN}`, t(30)),
    aRecord("obs_a_portal", `portal.${DEMO_DOMAIN}`, "203.0.113.20", t(12)),
    obs({
      id: "obs_student_db_modeled",
      sourceName: "org_inventory",
      sourceType: "inventory",
      observationType: "data_asset_declared",
      observedAt: t(1),
      target: DEMO_DOMAIN,
      rawReference: "inventory:student-sis-db",
      value: "student-sis-db",
      metadata: { name: "Student Information Database", criticality: "CRITICAL" },
      sourceReliability: 0.97,
      confidence: 0.97,
    }),
    obs({
      id: "obs_mail_svc",
      sourceName: "mock_dns",
      sourceType: "dns",
      observationType: "mx_record",
      observedAt: t(14),
      target: DEMO_DOMAIN,
      rawReference: `mx:${DEMO_DOMAIN}`,
      value: `mail.${DEMO_DOMAIN}`,
      metadata: {},
      sourceReliability: RELIABLE_DNS,
      confidence: 0.94,
    }),
  ];

  if (slice === "w1") return w1;

  const w2: RawObservation[] = [
    ...w1,
    dnsSub("obs_vpn", `vpn.${DEMO_DOMAIN}`, t(10)),
    dnsSub("obs_auth", `auth.${DEMO_DOMAIN}`, t(9)),
    dnsSub("obs_idp", `idp.${DEMO_DOMAIN}`, t(9)),
    dnsSub("obs_api", `api.${DEMO_DOMAIN}`, t(8)),
    dnsSub("obs_staging", `staging.${DEMO_DOMAIN}`, t(16)),
    dnsSub("obs_admin", `admin.${DEMO_DOMAIN}`, t(11)),
    cert("obs_ct_vpn", `vpn.${DEMO_DOMAIN}`, t(25)),
    cert("obs_ct_auth", `auth.${DEMO_DOMAIN}`, t(22)),
    cert("obs_ct_staging", `staging.${DEMO_DOMAIN}`, t(16)),
    cert("obs_ct_admin", `admin.${DEMO_DOMAIN}`, t(11)),
    aRecord("obs_a_vpn", `vpn.${DEMO_DOMAIN}`, "203.0.113.10", t(10)),
    aRecord("obs_a_api", `api.${DEMO_DOMAIN}`, "203.0.113.40", t(8)),
    obs({
      id: "obs_portal_login",
      sourceName: "mock_exposure",
      sourceType: "public_exposure",
      observationType: "authentication_endpoint",
      observedAt: t(6),
      target: `portal.${DEMO_DOMAIN}`,
      rawReference: `https://portal.${DEMO_DOMAIN}/cas/login`,
      value: `/cas/login`,
      metadata: {
        url: `https://portal.${DEMO_DOMAIN}/cas/login`,
        mfa: false,
        protocol: "https",
      },
      sourceReliability: RELIABLE_FINGERPRINT,
      confidence: 0.91,
    }),
    obs({
      id: "obs_auth_oidc",
      sourceName: "mock_exposure",
      sourceType: "public_exposure",
      observationType: "authentication_endpoint",
      observedAt: t(6),
      target: `auth.${DEMO_DOMAIN}`,
      rawReference: `https://auth.${DEMO_DOMAIN}/oauth2`,
      value: `/oauth2`,
      metadata: { protocol: "oidc", mfa: false },
      sourceReliability: RELIABLE_FINGERPRINT,
      confidence: 0.88,
    }),
    obs({
      id: "obs_vpn_banner",
      sourceName: "mock_exposure",
      sourceType: "public_exposure",
      observationType: "service_fingerprint",
      observedAt: t(5),
      target: `vpn.${DEMO_DOMAIN}`,
      rawReference: `vpn:${DEMO_DOMAIN}:443`,
      value: "OpenVPN-compatible portal on 443",
      metadata: { port: 443, product: "vpn-portal", mfa: false },
      sourceReliability: RELIABLE_FINGERPRINT,
      confidence: 0.84,
    }),
    obs({
      id: "obs_admin_login",
      sourceName: "mock_exposure",
      sourceType: "public_exposure",
      observationType: "authentication_endpoint",
      observedAt: t(10),
      target: `admin.${DEMO_DOMAIN}`,
      rawReference: `https://admin.${DEMO_DOMAIN}/`,
      value: "/admin",
      metadata: { mfa: false },
      sourceReliability: RELIABLE_FINGERPRINT,
      confidence: 0.8,
    }),
    obs({
      id: "obs_staging_app",
      sourceName: "mock_exposure",
      sourceType: "public_exposure",
      observationType: "service_fingerprint",
      observedAt: t(15),
      target: `staging.${DEMO_DOMAIN}`,
      rawReference: `https://staging.${DEMO_DOMAIN}`,
      value: "SIS staging application",
      metadata: { env: "staging", port: 443 },
      sourceReliability: RELIABLE_FINGERPRINT,
      confidence: 0.78,
    }),
  ];

  if (slice === "w2") return w2;

  return [
    ...w2,
    dnsSub("obs_dev", `dev.${DEMO_DOMAIN}`, t(21)),
    dnsSub("obs_oldvpn", `old-vpn.${DEMO_DOMAIN}`, t(95), { confidence: 0.7 }),
    cert("obs_ct_oldvpn", `old-vpn.${DEMO_DOMAIN}`, t(95)),
    dnsSub("obs_jenkins", `jenkins.${DEMO_DOMAIN}`, t(7)),
    aRecord("obs_a_jenkins", `jenkins.${DEMO_DOMAIN}`, "203.0.113.30", t(7)),
    obs({
      id: "obs_jenkins_svc",
      sourceName: "mock_exposure",
      sourceType: "public_exposure",
      observationType: "service_fingerprint",
      observedAt: t(7),
      target: `jenkins.${DEMO_DOMAIN}`,
      rawReference: `https://jenkins.${DEMO_DOMAIN}:8080`,
      value: "CI service fingerprint",
      metadata: { product: "jenkins", port: 8080, env: "development" },
      sourceReliability: 0.77,
      confidence: 0.72,
    }),
    obs({
      id: "obs_repo",
      sourceName: "mock_repo",
      sourceType: "repository_metadata",
      observationType: "public_repository",
      observedAt: t(4),
      target: DEMO_DOMAIN,
      rawReference: "github.com/demo-university/student-portal",
      value: "github.com/demo-university/student-portal",
      metadata: {
        visibility: "public",
        mentions_staging: true,
        env_example: true,
        redacted_secret_pattern: true,
      },
      sourceReliability: RELIABLE_REPO,
      confidence: 0.76,
    }),
    obs({
      id: "obs_repo_staging_ref",
      sourceName: "mock_repo",
      sourceType: "repository_metadata",
      observationType: "repository_reference",
      observedAt: t(4),
      target: `staging.${DEMO_DOMAIN}`,
      rawReference: "github.com/demo-university/student-portal:README",
      value: `https://staging.${DEMO_DOMAIN}`,
      metadata: {
        hostname: `staging.${DEMO_DOMAIN}`,
        untrusted: true,
      },
      sourceReliability: RELIABLE_REPO,
      confidence: 0.58,
    }),
  ];
}

export function criticalityFor(canonicalId: string, type: AssetType, host: string): Criticality {
  const known = KNOWN_INVENTORY.find((k) => k.canonicalId === canonicalId || k.displayName === host);
  if (known) return known.criticality;
  if (type === "data_asset") return "CRITICAL";
  if (host.startsWith("admin.")) return "CRITICAL";
  if (host.startsWith("idp.") || host.startsWith("auth.")) return "CRITICAL";
  if (host.startsWith("portal.")) return "CRITICAL";
  if (host.startsWith("vpn.") || host.startsWith("api.")) return "HIGH";
  if (host.startsWith("staging.") || host.startsWith("jenkins.")) return "HIGH";
  if (host.startsWith("old-vpn.") || host.startsWith("dev.")) return "MEDIUM";
  if (type === "repository") return "MEDIUM";
  return "LOW";
}

export const DEMO_AUTHORIZER = "Office of Information Security (synthetic)";
