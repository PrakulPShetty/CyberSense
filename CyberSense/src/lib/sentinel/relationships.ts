import { stableId } from "./ids.ts";
import { normalizeHostname } from "./normalize.ts";
import { linkEvidence } from "./evidence.ts";
import type { Asset, ClaimKind, EvidenceRecord, Observation, Relationship, RelationshipType } from "./types.ts";

function rel(
  assessmentId: string,
  source: Asset,
  target: Asset,
  type: RelationshipType,
  confidence: number,
  kind: ClaimKind,
  difficulty: number,
  evidenceIds: string[],
  assumptions: string[],
  controlDependencies: Relationship["controlDependencies"],
  seen: string,
): Relationship {
  return {
    id: stableId("rel", assessmentId, source.id, target.id, type),
    assessmentId,
    sourceAssetId: source.id,
    targetAssetId: target.id,
    type,
    confidence,
    evidenceIds,
    firstSeen: seen,
    lastSeen: seen,
    status: "ACTIVE",
    kind,
    difficulty,
    assumptions,
    controlDependencies,
  };
}

function findByCanonical(assets: Asset[], needle: string): Asset | undefined {
  const n = needle.toLowerCase();
  return assets.find((a) => a.canonicalId.toLowerCase().includes(n) || a.displayName.toLowerCase() === n);
}

function hostOf(asset: Asset): string {
  if (asset.metadata.host) return String(asset.metadata.host);
  if (asset.canonicalId.includes(":")) return asset.canonicalId.split(":").slice(1).join(":");
  return asset.displayName;
}

/**
 * Deterministic relationship construction. AI is not allowed to invent edges.
 * CONNECTED_TO (VPN → internal apps) is explicitly MODELED with an assumption.
 */
export function buildRelationships(
  assessmentId: string,
  assets: Asset[],
  observations: Observation[],
  evidence: EvidenceRecord[],
): Relationship[] {
  const out: Relationship[] = [];
  const seen = new Set<string>();
  const push = (r: Relationship) => {
    if (seen.has(r.id)) return;
    seen.add(r.id);
    for (const e of evidence) {
      if (r.evidenceIds.includes(e.id) && !e.relationshipIds.includes(r.id)) e.relationshipIds.push(r.id);
    }
    out.push(r);
  };

  const org = assets.find((a) => a.type === "organization");
  const domain = assets.find((a) => a.type === "domain");
  const db = assets.find((a) => a.type === "data_asset");
  const portal = assets.find((a) => a.displayName.startsWith("portal."));
  const api = assets.find((a) => a.type === "api" || a.displayName.startsWith("api."));
  const vpn = assets.find((a) => a.displayName.startsWith("vpn.") && a.type !== "service");
  const auth = assets.find((a) => a.displayName.startsWith("auth.") && a.type !== "service");
  const idp = assets.find((a) => a.displayName.startsWith("idp."));
  const staging = assets.find((a) => a.displayName.startsWith("staging."));
  const admin = assets.find((a) => a.displayName.startsWith("admin."));
  const jenkins = assets.find((a) => a.displayName.startsWith("jenkins.") || a.canonicalId.includes("jenkins"));
  const repo = assets.find((a) => a.type === "repository");
  const mail = assets.find((a) => a.displayName.startsWith("mail."));

  const evForAsset = (a?: Asset) => (a ? linkEvidence(evidence, a.id) : []);
  const latest = (a?: Asset) => a?.lastSeen ?? observations[0]?.timestamp ?? new Date().toISOString();

  if (org && domain) {
    push(rel(assessmentId, org, domain, "OWNS", 0.99, "OBSERVED", 5, evForAsset(domain), [], [], latest(domain)));
  }

  for (const a of assets) {
    if (!domain) break;
    if (a.id === domain.id || a.type === "organization" || a.type === "ip" || a.type === "data_asset") continue;
    const host = hostOf(a);
    if (host.endsWith(`.${domain.displayName}`) || a.displayName.endsWith(`.${domain.displayName}`)) {
      push(
        rel(
          assessmentId,
          domain,
          a,
          "OWNS",
          Math.min(0.97, a.confidence),
          "OBSERVED",
          8,
          evForAsset(a),
          [],
          [],
          latest(a),
        ),
      );
    }
  }

  for (const ip of assets.filter((a) => a.type === "ip")) {
    const hostName = String(ip.metadata.hostname ?? "");
    const hostAsset = assets.find((a) => a.displayName === hostName || hostOf(a) === hostName);
    if (hostAsset) {
      push(
        rel(
          assessmentId,
          hostAsset,
          ip,
          "RESOLVES_TO",
          0.93,
          "OBSERVED",
          10,
          [...evForAsset(ip), ...evForAsset(hostAsset)],
          [],
          [],
          latest(ip),
        ),
      );
    }
  }

  for (const svc of assets.filter((a) => a.type === "service" || a.type === "authentication_endpoint")) {
    const hostName = String(svc.metadata.host ?? "");
    const hostAsset = assets.find(
      (a) => a.id !== svc.id && (a.displayName === hostName || hostOf(a) === hostName),
    );
    if (hostAsset) {
      push(
        rel(
          assessmentId,
          hostAsset,
          svc,
          "EXPOSES",
          0.86,
          "OBSERVED",
          18,
          evForAsset(svc),
          [],
          ["REMOVE_PUBLIC_EXPOSURE", "WAF"],
          latest(svc),
        ),
      );
    }
  }

  const loginObs = observations.filter((o) => o.observationType === "authentication_endpoint");
  for (const o of loginObs) {
    const host = normalizeHostname(o.normalizedValue.startsWith("/") ? "" : o.rawReference);
    const hostAsset =
      assets.find((a) => o.rawReference.includes(a.displayName)) ??
      assets.find((a) => a.displayName.startsWith(host));
    const endpoint = assets.find((a) => a.id === o.assetId);
    if (hostAsset && endpoint && hostAsset.id !== endpoint.id) {
      push(
        rel(
          assessmentId,
          hostAsset,
          endpoint,
          "AUTHENTICATES",
          0.88,
          "OBSERVED",
          22,
          evidence.filter((e) => e.observationId === o.id).map((e) => e.id),
          ["Public authentication endpoint observed; MFA not observed."],
          ["MFA", "IMPROVE_ACCESS_CONTROL"],
          o.timestamp,
        ),
      );
    }
  }

  if (portal && auth) {
    push(
      rel(assessmentId, portal, auth, "USES", 0.84, "MODELED", 20, evForAsset(auth), [
        "Student portal is modeled as using the organization identity service.",
      ], ["MFA"], latest(portal)),
    );
  }
  if (portal && idp) {
    push(
      rel(assessmentId, portal, idp, "AUTHENTICATES", 0.8, "MODELED", 24, evForAsset(idp), [
        "Portal authenticates via the campus identity provider.",
      ], ["MFA"], latest(idp)),
    );
  }
  if (auth && idp) {
    push(rel(assessmentId, auth, idp, "USES", 0.86, "MODELED", 15, evForAsset(idp), [], ["MFA"], latest(auth)));
  }
  const hasAuthSurface = Boolean(
    auth ||
      vpn ||
      observations.some((o) => o.observationType === "authentication_endpoint"),
  );
  if (portal && db && hasAuthSurface) {
    push(
      rel(assessmentId, portal, db, "DEPENDS_ON", 0.9, "MODELED", 28, evForAsset(db), [
        "Declared crown-jewel database backing the student portal. Modeled only after an authentication or VPN surface is observed — DNS of the portal alone is not a path to student data.",
      ], ["NETWORK_SEGMENTATION", "PRIVILEGED_ACCESS_CONTROL"], latest(db)),
    );
  }
  if (api && db) {
    push(
      rel(assessmentId, api, db, "DEPENDS_ON", 0.88, "MODELED", 30, evForAsset(db), [
        "Production API is modeled as dependent on the student database.",
      ], ["NETWORK_SEGMENTATION"], latest(db)),
    );
  }
  if (vpn && portal) {
    push(
      rel(
        assessmentId,
        vpn,
        portal,
        "CONNECTS_TO",
        0.62,
        "MODELED",
        35,
        evForAsset(vpn),
        [
          "MODELED: a campus VPN that authenticates without MFA is treated as a path onto internal applications. This is not a confirmed compromise.",
        ],
        ["MFA", "RESTRICT_EXTERNAL_ACCESS", "NETWORK_SEGMENTATION"],
        latest(vpn),
      ),
    );
  }
  if (vpn && api) {
    push(
      rel(
        assessmentId,
        vpn,
        api,
        "CONNECTS_TO",
        0.55,
        "MODELED",
        38,
        evForAsset(vpn),
        ["MODELED VPN reachability to production API."],
        ["MFA", "RESTRICT_EXTERNAL_ACCESS", "NETWORK_SEGMENTATION"],
        latest(vpn),
      ),
    );
  }
  if (staging && api) {
    push(
      rel(
        assessmentId,
        staging,
        api,
        "ASSOCIATED_WITH",
        0.57,
        "INFERRED",
        40,
        evForAsset(staging),
        ["Staging is inferred to share deployment lineage with production API."],
        ["NETWORK_SEGMENTATION", "REMOVE_PUBLIC_EXPOSURE"],
        latest(staging),
      ),
    );
  }
  if (repo && staging) {
    const repoEv = evidence.filter((e) => e.normalized.type === "repository_reference" || e.assetIds.includes(repo.id));
    push(
      rel(
        assessmentId,
        repo,
        staging,
        "REFERENCES",
        0.48,
        "INFERRED",
        32,
        repoEv.map((e) => e.id),
        [
          "Public repository metadata references the staging hostname. Content is UNTRUSTED and was not executed as instructions.",
        ],
        ["REMOVE_PUBLIC_REPOSITORY", "CREDENTIAL_ROTATION"],
        latest(repo),
      ),
    );
  }
  if (jenkins && staging) {
    push(
      rel(
        assessmentId,
        jenkins,
        staging,
        "ASSOCIATED_WITH",
        0.44,
        "INFERRED",
        36,
        evForAsset(jenkins),
        ["CI service is inferred to deploy or influence staging."],
        ["DISABLE_UNNECESSARY_SERVICE", "RESTRICT_EXTERNAL_ACCESS"],
        latest(jenkins),
      ),
    );
  }
  if (admin && db) {
    push(
      rel(
        assessmentId,
        admin,
        db,
        "POTENTIALLY_AFFECTS",
        0.7,
        "MODELED",
        26,
        evForAsset(admin),
        ["Administrative portal is modeled as able to affect student records."],
        ["PRIVILEGED_ACCESS_CONTROL", "MFA", "IMPROVE_ACCESS_CONTROL"],
        latest(admin),
      ),
    );
  }
  if (admin && idp) {
    push(
      rel(assessmentId, admin, idp, "AUTHENTICATES", 0.72, "MODELED", 24, evForAsset(idp), [], ["MFA", "PRIVILEGED_ACCESS_CONTROL"], latest(admin)),
    );
  }
  if (mail && idp) {
    push(
      rel(
        assessmentId,
        mail,
        idp,
        "POTENTIALLY_AFFECTS",
        0.5,
        "MODELED",
        48,
        evForAsset(mail),
        ["Mailbox recovery is a modeled identity-reset path, not a confirmed attack."],
        ["MFA", "IMPROVE_ACCESS_CONTROL"],
        latest(mail),
      ),
    );
  }

  const oldVpn = findByCanonical(assets, "old-vpn.");
  if (oldVpn && portal) {
    push(
      rel(
        assessmentId,
        oldVpn,
        portal,
        "CONNECTS_TO",
        0.33,
        "INFERRED",
        42,
        evForAsset(oldVpn),
        ["Historical VPN hostname; evidence is aging/stale. Requires verification."],
        ["RESTRICT_EXTERNAL_ACCESS", "DISABLE_UNNECESSARY_SERVICE"],
        latest(oldVpn),
      ),
    );
  }

  return out;
}
