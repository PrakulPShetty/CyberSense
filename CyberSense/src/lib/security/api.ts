import { createServerFn } from "@tanstack/react-start";
import { runSecurityChecks, type SecurityCheckRun } from "./checks.ts";
import { getSecurityCheck, listSecurityChecks, saveSecurityRun } from "./repo.ts";
import { explainSecurityRun, securityRecommendations } from "./assistant.ts";
import { buildSecurityReportPdf } from "./report.ts";

export const runSecurityChecksFn = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<SecurityCheckRun> => {
    const run = await runSecurityChecks(data.url);
    const id = await saveSecurityRun(run);
    return { ...run, id };
  });

export const listSecurityChecksFn = createServerFn({ method: "GET" }).handler(
  async () => listSecurityChecks(),
);

export const getSecurityCheckFn = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<SecurityCheckRun | null> => getSecurityCheck(data.id));

export const explainSecurityCheckFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; checkId?: string }) => input)
  .handler(async ({ data }) => {
    const run = await getSecurityCheck(data.id);
    if (!run) return null;
    return explainSecurityRun(run, data.checkId);
  });

export const securityRecommendationsFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const run = await getSecurityCheck(data.id);
    if (!run) return null;
    return securityRecommendations(run);
  });

export const generateSecurityReportFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const run = await getSecurityCheck(data.id);
    if (!run) return null;
    const base64 = buildSecurityReportPdf(run);
    return { id: run.id ?? data.id, base64, filename: `CyberSense-security-${run.id ?? data.id}.pdf` };
  });
