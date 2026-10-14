import { criticalityFor, isKnownInventory } from "./demo/university.ts";
import { stableId } from "./ids.ts";
import {
  assetFingerprint,
  isSubdomainOf,
  normalizeHostname,
  normalizeRepository,
  normalizeUrl,
  parentDomain,
} from "./normalize.ts";
import type { Asset, AssetType, Observation, RawObservation } from "./types.ts";

export interface ResolvedWorld {
  assets: Asset[];
  observations: Observation[];
}

function hostType(host: string, apex: string): AssetType {
  if (host === apex) return "domain";
  if (host.startsWith("auth.")) return "authentication_endpoint";
  if (host.startsWith("idp.")) return "identity_surface";
  if (host.startsWith("api.")) return "api";
  if (host.startsWith("portal.") || host.startsWith("admin.")) return "application";
  if (host.startsWith("staging.")) return "staging_environment";
  if (host.startsWith("dev.") || host.startsWith("jenkins.")) return "development_environment";
  return "subdomain";
}

function upsertAsset(
  map: Map<string, Asset>,
  assessmentId: string,
  type: AssetType,
  canonical: string,
  display: string,
  observedAt: string,
  publicExposure: boolean,
  sourceBump: boolean,
  metadata: Asset["metadata"] = {},
): Asset {
  const fp = assetFingerprint(type, canonical);
  const existing = map.get(fp);
  const known = isKnownInventory(fp, display);
  if (existing) {
    existing.lastSeen = observedAt > existing.lastSeen ? observedAt : existing.lastSeen;
    existing.firstSeen = observedAt < existing.firstSeen ? observedAt : existing.firstSeen;
    if (sourceBump) existing.sourceCount += 1;
    if (publicExposure) existing.exposureState = "PUBLIC";
    existing.metadata = { ...existing.metadata, ...metadata };
    return existing;
  }
  const asset: Asset = {
    id: stableId("ast", assessmentId, fp),
    assessmentId,
    canonicalId: fp,
    displayName: display,
    type,
    status: "ACTIVE",
    criticality: criticalityFor(fp, type, canonical),
    exposureState: type === "data_asset" ? "INTERNAL" : publicExposure ? "PUBLIC" : "UNKNOWN",
    ownershipState: known ? "KNOWN" : "UNKNOWN",
    confidence: 0.7,
    firstSeen: observedAt,
    lastSeen: observedAt,
    sourceCount: 1,
    tags: [],
    metadata,
  };
  map.set(fp, asset);
  return asset;
}

export function resolveAssets(
  assessmentId: string,
  target: string,
  raw: RawObservation[],
  now: string,
): ResolvedWorld {
  const apex = normalizeHostname(target);
  const map = new Map<string, Asset>();
  const observations: Observation[] = [];

  upsertAsset(map, assessmentId, "organization", apex, apex, now, true, false);
  upsertAsset(map, assessmentId, "domain", apex, apex, now, true, false);

  for (const r of raw) {
    const type = r.observationType;
    let asset: Asset | null = null;

    if (type === "hostname_observed" || type === "certificate_hostname") {
      const host = normalizeHostname(r.value);
      if (!isSubdomainOf(host, apex) && host !== apex) continue;
      const at = hostType(host, apex);
      asset = upsertAsset(map, assessmentId, at, host, host, r.observedAt, true, true);
      if (host !== apex) {
        const parent = parentDomain(host);
        if (parent && isSubdomainOf(parent, apex)) {
          upsertAsset(map, assessmentId, hostType(parent, apex), parent, parent, r.observedAt, true, false);
        }
      }
    } else if (type === "a_record") {
      const host = normalizeHostname(String(r.metadata.hostname ?? r.target));
      const ip = String(r.metadata.ip ?? r.value);
      asset = upsertAsset(map, assessmentId, "ip", ip, ip, r.observedAt, true, true, { hostname: host });
      if (isSubdomainOf(host, apex) || host === apex) {
        upsertAsset(map, assessmentId, hostType(host, apex), host, host, r.observedAt, true, true);
      }
    } else if (type === "authentication_endpoint") {
      const host = normalizeHostname(r.target);
      const url = normalizeUrl(r.rawReference);
      asset = upsertAsset(map, assessmentId, "authentication_endpoint", url, url, r.observedAt, true, true, {
        mfa: Boolean(r.metadata.mfa),
        host,
      });
      upsertAsset(map, assessmentId, hostType(host, apex), host, host, r.observedAt, true, false);
    } else if (type === "service_fingerprint") {
      const host = normalizeHostname(r.target);
      const product = String(r.metadata.product ?? r.value);
      const key = `${host}:${product}`;
      const st: AssetType = product === "jenkins" ? "development_environment" : "service";
      asset = upsertAsset(map, assessmentId, st, key, `${product} on ${host}`, r.observedAt, true, true, {
        host,
        port: r.metadata.port ?? null,
        mfa: r.metadata.mfa ?? null,
      });
      upsertAsset(map, assessmentId, hostType(host, apex), host, host, r.observedAt, true, false);
    } else if (type === "public_repository" || type === "repository_reference") {
      const repo = normalizeRepository(type === "public_repository" ? r.value : r.rawReference.split(":")[0]);
      asset = upsertAsset(map, assessmentId, "repository", repo, repo, r.observedAt, true, true, {
        untrusted: true,
        mentions_staging: Boolean(r.metadata.mentions_staging || type === "repository_reference"),
      });
    } else if (type === "data_asset_declared") {
      asset = upsertAsset(
        map,
        assessmentId,
        "data_asset",
        r.value,
        String(r.metadata.name ?? r.value),
        r.observedAt,
        false,
        true,
      );
      asset.exposureState = "INTERNAL";
      asset.ownershipState = "KNOWN";
    } else if (type === "mx_record") {
      const host = normalizeHostname(r.value);
      asset = upsertAsset(map, assessmentId, "subdomain", host, host, r.observedAt, true, true);
    }

    observations.push({
      id: r.id,
      assessmentId,
      assetId: asset?.id ?? null,
      observationType: r.observationType,
      sourceId: r.sourceName,
      timestamp: r.observedAt,
      rawReference: r.rawReference,
      normalizedValue: r.value,
      confidence: r.confidence,
      verificationStatus: "UNVERIFIED",
      freshness: "FRESH",
      sourceReliability: r.sourceReliability,
      notes: null,
    });
  }

  for (const a of map.values()) {
    const known = isKnownInventory(a.canonicalId, a.displayName);
    if (!known && a.type !== "organization" && a.type !== "domain" && a.exposureState === "PUBLIC") {
      a.ownershipState = "POTENTIAL_SHADOW";
      a.tags = [...new Set([...a.tags, "potential-shadow"])];
    } else if (known) {
      a.ownershipState = "KNOWN";
    }
    a.confidence = Math.min(0.98, 0.55 + a.sourceCount * 0.12);
  }

  return { assets: [...map.values()], observations };
}
