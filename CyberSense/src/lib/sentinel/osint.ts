import { DEMO_DOMAIN, isPrivateIp, isValidPublicDomain, normalizeHostname } from "./normalize.ts";
import { demoObservations, type DemoSlice } from "./demo/university.ts";
import type { RawObservation, SourceRun } from "./types.ts";
import { newId } from "./ids.ts";

export interface AdapterHealth {
  sourceName: string;
  ok: boolean;
  detail: string;
}

export interface AdapterResult {
  run: SourceRun;
  observations: RawObservation[];
}

export interface AdapterContext {
  assessmentId: string;
  target: string;
  now: string;
  demoSlice?: DemoSlice;
  abortMs?: number;
}

export interface OSINTSourceAdapter {
  sourceName: string;
  sourceType: string;
  capabilities: string[];
  requiredCredentials: string[];
  execute(ctx: AdapterContext): Promise<AdapterResult>;
  healthCheck(): Promise<AdapterHealth>;
}

function runBase(ctx: AdapterContext, sourceName: string, sourceType: string): SourceRun {
  return {
    id: newId("src"),
    assessmentId: ctx.assessmentId,
    sourceName,
    sourceType,
    status: "RUNNING",
    startedAt: ctx.now,
    completedAt: null,
    errorClass: null,
    errorMessage: null,
    observationCount: 0,
    notes: null,
  };
}

export const mockAdapter: OSINTSourceAdapter = {
  sourceName: "mock_osint",
  sourceType: "synthetic",
  capabilities: ["dns", "certificate_transparency", "repository_metadata", "public_exposure"],
  requiredCredentials: [],
  async healthCheck() {
    return { sourceName: "mock_osint", ok: true, detail: "synthetic adapter ready" };
  },
  async execute(ctx) {
    const run = runBase(ctx, "mock_osint", "synthetic");
    const host = normalizeHostname(ctx.target);
    const inDemo = host === DEMO_DOMAIN || host.endsWith(`.${DEMO_DOMAIN}`);
    if (!inDemo) {
      run.status = "UNAVAILABLE";
      run.completedAt = new Date().toISOString();
      run.notes = "Mock adapter only emits the Northshore synthetic corpus.";
      return { run, observations: [] };
    }
    const observations = demoObservations(ctx.demoSlice ?? "now", ctx.now).map((o) => ({
      ...o,
      id: `${ctx.assessmentId}:${o.id}`,
    }));
    run.status = "COMPLETED";
    run.completedAt = new Date().toISOString();
    run.observationCount = observations.length;
    run.notes = `slice=${ctx.demoSlice ?? "now"}`;
    return { run, observations };
  },
};

async function fetchWithTimeout(url: string, ms: number, headers: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Passive DNS over HTTPS against a hardcoded resolver. Never fetches the target. */
export const dohAdapter: OSINTSourceAdapter = {
  sourceName: "cloudflare_doh",
  sourceType: "dns",
  capabilities: ["dns_a"],
  requiredCredentials: [],
  async healthCheck() {
    return { sourceName: "cloudflare_doh", ok: true, detail: "DoH adapter configured" };
  },
  async execute(ctx) {
    const run = runBase(ctx, "cloudflare_doh", "dns");
    const host = normalizeHostname(ctx.target);
    if (!isValidPublicDomain(host)) {
      run.status = "FAILED";
      run.errorClass = "INVALID_DOMAIN";
      run.errorMessage = "Refusing DoH for invalid domain";
      run.completedAt = new Date().toISOString();
      return { run, observations: [] };
    }
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`;
      const res = await fetchWithTimeout(url, ctx.abortMs ?? 4000, { Accept: "application/dns-json" });
      if (!res.ok) {
        run.status = "FAILED";
        run.errorClass = "SOURCE_HTTP_ERROR";
        run.errorMessage = `DoH HTTP ${res.status}`;
        run.completedAt = new Date().toISOString();
        return { run, observations: [] };
      }
      const body = (await res.json()) as { Answer?: { data: string; type: number }[] };
      const answers = (body.Answer ?? []).filter((a) => a.type === 1);
      const observations: RawObservation[] = [];
      for (const a of answers) {
        if (isPrivateIp(a.data)) continue;
        observations.push({
          id: newId("obs"),
          sourceName: "cloudflare_doh",
          sourceType: "dns",
          observationType: "a_record",
          observedAt: ctx.now,
          target: host,
          rawReference: `doh:${host}`,
          value: a.data,
          metadata: { hostname: host, ip: a.data },
          sourceReliability: 0.86,
          confidence: 0.86,
        });
      }
      observations.unshift({
        id: newId("obs"),
        sourceName: "cloudflare_doh",
        sourceType: "dns",
        observationType: "hostname_observed",
        observedAt: ctx.now,
        target: host,
        rawReference: `doh-q:${host}`,
        value: host,
        metadata: {},
        sourceReliability: 0.86,
        confidence: 0.9,
      });
      // A no-record answer (NXDOMAIN / no A record) is NOT a successful scan and
      // must not read as a clean result. The hostname observation above is always
      // present, so the record count — not the observation count — decides status.
      const aRecordCount = observations.filter((o) => o.observationType === "a_record").length;
      run.status = aRecordCount > 0 ? "COMPLETED" : "PARTIAL";
      run.completedAt = new Date().toISOString();
      run.observationCount = observations.length;
      run.notes =
        aRecordCount > 0
          ? `Passive DoH only: ${aRecordCount} A record(s). Absence of records is not absence of risk.`
          : "Passive DoH only: the resolver returned no A record for this name. That is an unknown result, not a clean one.";
      return { run, observations };
    } catch (err) {
      run.status = "FAILED";
      run.errorClass = err instanceof Error && err.name === "AbortError" ? "SOURCE_TIMEOUT" : "SOURCE_UNAVAILABLE";
      run.errorMessage = err instanceof Error ? err.message : "DoH failed";
      run.completedAt = new Date().toISOString();
      run.notes = "Source failure must not be interpreted as absence of risk.";
      return { run, observations: [] };
    }
  },
};

export async function runAdapters(ctx: AdapterContext, adapters: OSINTSourceAdapter[]): Promise<AdapterResult[]> {
  const settled = await Promise.allSettled(adapters.map((a) => a.execute(ctx)));
  return settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const run = runBase(ctx, adapters[i].sourceName, adapters[i].sourceType);
    run.status = "FAILED";
    run.errorClass = "ADAPTER_EXCEPTION";
    run.errorMessage = s.reason instanceof Error ? s.reason.message : "adapter failed";
    run.completedAt = new Date().toISOString();
    return { run, observations: [] };
  });
}
