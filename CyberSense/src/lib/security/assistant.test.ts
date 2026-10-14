import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { explainSecurityRun, securityRecommendations } from "./assistant.ts";
import type { SecurityCheckRun } from "./checks.ts";

const run: SecurityCheckRun = {
  id: "sec_test",
  targetUrl: "https://example.com/",
  startedAt: "2026-10-15T00:00:00.000Z",
  completedAt: "2026-10-15T00:00:01.000Z",
  limitations: ["Test-only run."],
  results: [
    {
      id: "https-availability",
      description: "HTTPS availability",
      expected: "HTTPS responds without a certificate or transport error",
      observed: "HTTP 200",
      status: "pass",
    },
    {
      id: "hsts",
      description: "HTTP response header strict-transport-security",
      expected: "strict-transport-security configured with a restrictive value",
      observed: "not present",
      status: "fail",
      severityRationale: "Missing HSTS can expose users to downgrade attacks.",
    },
    {
      id: "network-error",
      description: "Network observation",
      expected: "A live response can be observed from the authorized target",
      observed: "timeout",
      status: "error",
      limitation: "Observation could not be completed.",
    },
    {
      id: "cookie-attributes",
      description: "Cookie security attributes",
      expected: "No insecure cookies observed",
      observed: "no Set-Cookie header in the initial response",
      status: "not-verified",
      limitation: "Cookies set after login were not observed.",
    },
  ],
};

describe("security explanation", () => {
  it("explains a selected failed check using its evidence", () => {
    const explanation = explainSecurityRun(run, "hsts");
    assert.equal(explanation.checkId, "hsts");
    assert.equal(explanation.why, "Without this header, a user may reach the site over HTTP and become vulnerable to downgrade or interception attacks.");
    assert.equal(explanation.verify, "Re-run the security check and confirm the header is present with the intended values.");
    assert.equal(explanation.evidence, "not present");
  });

  it("returns an insufficient-evidence result when no checks exist", () => {
    const empty: SecurityCheckRun = { ...run, results: [] };
    const explanation = explainSecurityRun(empty, "hsts");
    assert.equal(explanation.checkId, "hsts");
    assert.match(explanation.what, /No security check result/);
    assert.ok(explanation.limitations.length > 0);
  });

  it("only recommends non-passing checks", () => {
    const recommendations = securityRecommendations(run);
    assert.deepEqual(
      recommendations.map((r) => r.checkId),
      ["network-error", "hsts", "cookie-attributes"],
    );
    assert.ok(recommendations.every((r) => r.caveat.toLowerCase().includes("advisory")));
  });
});
