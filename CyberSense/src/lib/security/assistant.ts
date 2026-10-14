import type { SecurityCheckResult, SecurityCheckRun } from "./checks.ts";

export interface SecurityExplanation {
  checkId: string;
  what: string;
  why: string;
  who: string;
  steps: string[];
  example: string;
  where: string;
  verify: string;
  evidence: string;
  limitations: string[];
}

const GUIDES: Record<string, Omit<SecurityExplanation, "checkId" | "evidence" | "limitations">> = {
  hsts: {
    what: "The site did not send Strict-Transport-Security, so browsers are not instructed to use HTTPS for future requests.",
    why: "Without this header, a user may reach the site over HTTP and become vulnerable to downgrade or interception attacks.",
    who: "Visitors on networks where HTTP requests can be redirected.",
    steps: [
      "Serve the site exclusively over HTTPS with a valid certificate.",
      "Add a Strict-Transport-Security response header.",
      "Start with a short max-age, verify traffic, then increase it.",
    ],
    example: "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
    where: "Web server, reverse proxy, CDN, or hosting response headers configuration.",
    verify: "Re-run the security check and confirm the header is present with the intended values.",
  },
  "x-content-type-options": {
    what: "The site did not send X-Content-Type-Options: nosniff.",
    why: "Without this, some browsers may guess content types and interpret files in unexpected ways.",
    who: "Visitors whose browsers rely on content-type sniffing.",
    steps: ["Add X-Content-Type-Options: nosniff to all responses.", "Re-run the security check."],
    example: "X-Content-Type-Options: nosniff",
    where: "Web server or framework response header configuration.",
    verify: "Re-run the check and confirm the header is present on every response you intend to protect.",
  },
  "referrer-policy": {
    what: "The site did not send a Referrer-Policy header.",
    why: "A missing policy can leak URLs, query parameters, or fragments to third parties.",
    who: "Visitors whose links and assets cause referrer data to leave the origin.",
    steps: ["Choose a policy that limits referrer exposure appropriately.", "Add it to responses.", "Re-run the check."],
    example: "Referrer-Policy: strict-origin-when-cross-origin",
    where: "Response headers configuration.",
    verify: "Re-run the check and confirm the policy value.",
  },
  "content-security-policy": {
    what: "The site did not send a Content-Security-Policy header.",
    why: "CSP can reduce the impact of content-injection defects, but a missing CSP does not prove one exists.",
    who: "Visitors whose browsers may be exposed to injected content.",
    steps: [
      "Inventory legitimate scripts, styles, images, and connections.",
      "Create a restrictive policy, test in report-only mode.",
      "Enforce it after resolving legitimate blocked resources.",
    ],
    example: "Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'self'",
    where: "Response headers configuration.",
    verify: "Re-run the check and inspect the CSP value against actual site behavior.",
  },
  "cookie-attributes": {
    what: "The observed Set-Cookie header did not include the required security attributes, or no cookie was observed.",
    why: "Cookies lacking Secure, HttpOnly, or SameSite can expose sessions under certain conditions.",
    who: "Visitors with cookies set by this response.",
    steps: [
      "Identify all cookies issued by the site.",
      "Set Secure for cookies used over HTTPS.",
      "Set HttpOnly unless browser script access is required.",
      "Set SameSite according to the intended cross-site behavior.",
    ],
    example: "Set-Cookie: session=...; Secure; HttpOnly; SameSite=Lax; Path=/",
    where: "Application session/cookie configuration.",
    verify: "Re-run the check and review all cookie attributes from the login response.",
  },
  "http-https-redirect": {
    what: "The HTTP version of the site did not redirect to the same HTTPS URL.",
    why: "Serving plaintext content can allow interception or downgrade of requests.",
    who: "Visitors who type the site without https or follow an HTTP link.",
    steps: ["Redirect HTTP requests to the HTTPS equivalent path.", "Use a 301 redirect after testing.", "Re-run the check."],
    example: "HTTP/1.1 301 Moved Permanently\nLocation: https://example.com/",
    where: "Web server, reverse proxy, CDN, or load balancer configuration.",
    verify: "Request the HTTP URL and confirm it redirects to the same HTTPS URL.",
  },
  "tls-certificate": {
    what: "The TLS certificate did not appear valid or the check could not verify it.",
    why: "Certificate issues can expose users to connection errors or interception risk.",
    who: "All visitors making HTTPS connections.",
    steps: [
      "Inspect the certificate's expiration dates and hostname.",
      "Install the full certificate chain.",
      "Ensure renewal automation is active.",
    ],
    example: "Certificate should be issued to the requested hostname and trusted by clients.",
    where: "Server TLS/terminating proxy certificate configuration.",
    verify: "Re-run the check and inspect the certificate evidence and authorization status.",
  },
};

export function explainSecurityRun(run: SecurityCheckRun, checkId?: string): SecurityExplanation {
  const result = run.results.find((r) => r.id === checkId) ?? run.results[0];
  if (!result) {
    return {
      checkId: checkId ?? "none",
      what: "No security check result was available in this persisted run.",
      why: "There is no observed evidence to explain.",
      who: "No target component is known from this result.",
      steps: ["Run the security checks again against an authorized target."],
      example: "No example can be provided without evidence.",
      where: "Not applicable.",
      verify: "Re-run the security check and open the saved result.",
      evidence: "No evidence observed.",
      limitations: run.limitations,
    };
  }
  const guide = GUIDES[result.id];
  const base: Omit<SecurityExplanation, "checkId" | "evidence" | "limitations"> = guide ?? {
    what: result.description,
    why: result.severityRationale ?? "This is a configuration observation with unknown impact until manually reviewed.",
    who: "Users or systems that interact with this check.",
    steps: ["Review the observed evidence.", "Compare it with the expected condition.", "Apply only changes you are authorized to make."],
    example: "No example mapping is available for this check.",
    where: "Target web server or hosting configuration.",
    verify: "Re-run the check and confirm the observed value changed.",
  };
  return {
    checkId: result.id,
    ...base,
    evidence: result.observed,
    limitations: [...(result.limitation ? [result.limitation] : []), ...run.limitations],
  };
}

export interface SecurityRecommendation {
  checkId: string;
  priority: number;
  action: string;
  example: string;
  verification: string;
  caveat: string;
}

export function securityRecommendations(run: SecurityCheckRun): SecurityRecommendation[] {
  const priority: Record<SecurityCheckResult["status"], number> = {
    error: 1,
    fail: 2,
    "not-verified": 3,
    skipped: 4,
    pass: 5,
  };
  return run.results
    .filter((r) => r.status !== "pass")
    .map((r) => {
      const explanation = explainSecurityRun(run, r.id);
      return {
        checkId: r.id,
        priority: priority[r.status],
        action: explanation.steps.join(" "),
        example: explanation.example,
        verification: explanation.verify,
        caveat: "Advisory only. Do not change production configuration without authorized review.",
      };
    })
    .sort((a, b) => a.priority - b.priority);
}
