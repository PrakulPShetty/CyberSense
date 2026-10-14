import { ALLOWED_DEMO_TARGETS, DEMO_DOMAIN, isValidPublicDomain, normalizeHostname } from "./normalize.ts";
import { newId } from "./ids.ts";
import type { AuthorizationRecord } from "./types.ts";

export interface AuthorizationInput {
  target: string;
  authorizedBy: string;
  authorizationType: AuthorizationRecord["authorizationType"];
  confirmationText: string;
  modules?: string[];
  now?: string;
}

export type AuthorizationDecision =
  | { ok: true; record: Omit<AuthorizationRecord, "assessmentId"> }
  | { ok: false; error_code: string; message: string };

const REQUIRED_PHRASE = "I confirm this target is authorized";

export function evaluateAuthorization(input: AuthorizationInput): AuthorizationDecision {
  const target = normalizeHostname(input.target);
  if (!isValidPublicDomain(target) && !ALLOWED_DEMO_TARGETS.has(target)) {
    return {
      ok: false,
      error_code: "INVALID_DOMAIN",
      message: "Target is not a valid public domain and is out of scope.",
    };
  }

  const isDemo = target === DEMO_DOMAIN || target.endsWith(`.${DEMO_DOMAIN}`);
  const confirmation = input.confirmationText.trim();
  if (!isDemo && !confirmation.toLowerCase().includes(REQUIRED_PHRASE.toLowerCase())) {
    return {
      ok: false,
      error_code: "AUTHORIZATION_REQUIRED",
      message: `Authorization confirmation must include: "${REQUIRED_PHRASE}".`,
    };
  }
  if (!input.authorizedBy.trim()) {
    return {
      ok: false,
      error_code: "AUTHORIZATION_REQUIRED",
      message: "authorized_by is required.",
    };
  }

  const now = input.now ?? new Date().toISOString();
  const record: Omit<AuthorizationRecord, "assessmentId"> = {
    id: newId("auth"),
    target,
    authorizedBy: input.authorizedBy.trim(),
    authorizationType: isDemo ? "SYNTHETIC_DEMO" : input.authorizationType,
    scope: {
      domains: isDemo ? [DEMO_DOMAIN, `*.${DEMO_DOMAIN}`] : [target],
      modules: input.modules ?? ["osint_passive", "graph", "risk", "simulation"],
      passiveOnly: true,
    },
    startTime: now,
    endTime: null,
    allowedModules: input.modules ?? ["osint_passive", "graph", "risk", "simulation", "ai", "reporting"],
    restrictions: [
      "No exploitation",
      "No credential attacks",
      "No destructive testing",
      "Passive or synthetic collection only",
      "Do not fetch arbitrary URLs on the target",
    ],
    confirmationText: isDemo ? "SYNTHETIC_DEMO auto-authorized" : confirmation,
    status: "GRANTED",
  };
  return { ok: true, record };
}

export function inScope(hostname: string, record: AuthorizationRecord): boolean {
  const h = normalizeHostname(hostname);
  return record.scope.domains.some((d) => {
    if (d.startsWith("*.")) {
      const root = d.slice(2);
      return h === root || h.endsWith(`.${root}`);
    }
    return h === normalizeHostname(d) || h.endsWith(`.${normalizeHostname(d)}`);
  });
}
