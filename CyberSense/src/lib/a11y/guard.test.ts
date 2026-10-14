import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALLOW_LOOPBACK_ENV, guardScanUrl, isBlockedAddress, isLoopbackHostname } from "./guard.ts";

const OPEN = { [ALLOW_LOOPBACK_ENV]: "1" };
const CLOSED = {};

function code(input: string, env: Record<string, string | undefined> = CLOSED): string {
  const result = guardScanUrl(input, env);
  return result.ok ? "OK" : result.error_code;
}

describe("accessibility target guard", () => {
  it("accepts a normal public https target and normalizes it", () => {
    const result = guardScanUrl("https://example.org/docs?page=2#results", CLOSED);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.url.hostname, "example.org");
      assert.equal(result.url.hash, "");
      assert.equal(result.loopback, false);
    }
  });

  it("assumes https when no scheme is given", () => {
    const result = guardScanUrl("example.org", CLOSED);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.url.protocol, "https:");
  });

  it("allows the standard web ports only, for public targets", () => {
    assert.equal(code("https://example.org:443/"), "OK");
    assert.equal(code("http://example.org:80/"), "OK");
    assert.equal(code("https://example.org:8443/"), "PORT_NOT_ALLOWED");
    assert.equal(code("https://example.org:22/"), "PORT_NOT_ALLOWED");
  });

  it("refuses non-web schemes", () => {
    assert.equal(code("file:///etc/passwd"), "UNSUPPORTED_SCHEME");
    assert.equal(code("javascript:alert(1)"), "UNSUPPORTED_SCHEME");
    assert.equal(code("data:text/html,<p>x"), "UNSUPPORTED_SCHEME");
    assert.equal(code("chrome://settings"), "UNSUPPORTED_SCHEME");
  });

  it("refuses credentials embedded in the URL", () => {
    assert.equal(code("https://user:secret@example.org/"), "CREDENTIALS_IN_URL");
    assert.equal(code("https://user@example.org/"), "CREDENTIALS_IN_URL");
  });

  it("refuses private, link-local and metadata addresses", () => {
    for (const target of [
      "https://10.0.0.1/",
      "https://192.168.1.10/",
      "https://172.16.0.5/",
      // The cloud metadata endpoint is the classic SSRF payoff.
      "https://169.254.169.254/latest/meta-data/",
      "https://100.64.0.1/",
      "https://203.0.113.5/",
    ]) {
      assert.equal(code(target), "PRIVATE_ADDRESS", target);
    }
  });

  it("refuses internal-only DNS names", () => {
    for (const target of ["https://myhost.internal/", "https://printer.local/", "https://thing.lan/"]) {
      assert.equal(code(target), "INVALID_DOMAIN", target);
    }
  });

  it("refuses loopback by default and names the opt-in", () => {
    assert.equal(code("http://localhost:8080/"), "LOOPBACK_BLOCKED");
    assert.equal(code("http://127.0.0.1:8080/"), "LOOPBACK_BLOCKED");
    assert.equal(code("http://[::1]:8080/"), "LOOPBACK_BLOCKED");
    const result = guardScanUrl("http://127.0.0.1:8080/a11y-demo", CLOSED);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /CYBERSENSE_A11Y_ALLOW_LOOPBACK/);
  });

  it("allows loopback only when explicitly opted in, and keeps its port", () => {
    const result = guardScanUrl("http://127.0.0.1:8080/a11y-demo", OPEN);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.loopback, true);
      assert.equal(result.url.pathname, "/a11y-demo");
    }
    assert.equal(guardScanUrl("http://localhost:3000/", OPEN).ok, true);
  });

  it("still refuses other private ranges while loopback is opted in", () => {
    assert.equal(code("https://10.0.0.1/", OPEN), "PRIVATE_ADDRESS");
    assert.equal(code("https://169.254.169.254/", OPEN), "PRIVATE_ADDRESS");
  });

  it("rejects an empty or absurdly long target", () => {
    assert.equal(code("   "), "EMPTY_URL");
    assert.equal(code(`https://${"a".repeat(3000)}.example.org/`), "URL_TOO_LONG");
  });

  it("rejects unparsable input", () => {
    assert.equal(code("https://"), "INVALID_URL");
  });

  it("classifies addresses the browser must never reach", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.20.5.5", "169.254.169.254", "100.64.1.1", "0.0.0.0", "224.0.0.1", "192.0.2.1"]) {
      assert.equal(isBlockedAddress(ip), true, ip);
    }
    // 203.0.113.0/24 is TEST-NET-3: blocked precisely at the /24, so its
    // neighbours in the same /16 stay reachable.
    assert.equal(isBlockedAddress("203.0.113.5"), true);
    assert.equal(isBlockedAddress("203.0.114.5"), false);
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "93.184.216.34"]) {
      assert.equal(isBlockedAddress(ip), false, ip);
    }
    for (const ip of ["::1", "fe80::1", "fd00::1", "fc00::1", "::ffff:127.0.0.1", "ff02::1"]) {
      assert.equal(isBlockedAddress(ip), true, ip);
    }
    for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
      assert.equal(isBlockedAddress(ip), false, ip);
    }
    // Host names are not addresses; they must not be classified as IPs.
    assert.equal(isBlockedAddress("example.org"), false);
  });

  it("recognizes loopback host names, including bracketed IPv6", () => {
    assert.equal(isLoopbackHostname("localhost"), true);
    assert.equal(isLoopbackHostname("LOCALHOST"), true);
    assert.equal(isLoopbackHostname("api.localhost"), true);
    assert.equal(isLoopbackHostname("[::1]"), true);
    assert.equal(isLoopbackHostname("example.org"), false);
  });
});
