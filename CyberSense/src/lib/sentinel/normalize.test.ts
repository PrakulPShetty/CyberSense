import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assetFingerprint,
  extractPort,
  isPrivateIp,
  isSubdomainOf,
  isValidPublicDomain,
  normalizeHostname,
  normalizeRepository,
  normalizeUrl,
} from "./normalize.ts";

describe("normalize", () => {
  it("canonicalizes hostnames", () => {
    assert.equal(normalizeHostname("VPN.EXAMPLE.COM"), "vpn.example.com");
    assert.equal(normalizeHostname("https://vpn.example.com"), "vpn.example.com");
    assert.equal(normalizeHostname("vpn.example.com:443"), "vpn.example.com");
    assert.equal(normalizeHostname("vpn.example.com."), "vpn.example.com");
  });

  it("canonicalizes urls", () => {
    assert.equal(normalizeUrl("https://vpn.example.com:443/"), "https://vpn.example.com");
    assert.equal(normalizeUrl("vpn.example.com/cas/login"), "https://vpn.example.com/cas/login");
  });

  it("extracts ports and domain hierarchy", () => {
    assert.equal(extractPort("https://jenkins.demo-university.edu:8080"), 8080);
    assert.equal(isSubdomainOf("vpn.demo-university.edu", "demo-university.edu"), true);
    assert.equal(isSubdomainOf("evil.com", "demo-university.edu"), false);
  });

  it("rejects private / invalid targets", () => {
    assert.equal(isValidPublicDomain("localhost"), false);
    assert.equal(isValidPublicDomain("192.168.1.1"), false);
    assert.equal(isValidPublicDomain("demo-university.edu"), true);
    assert.equal(isPrivateIp("10.0.0.5"), true);
    assert.equal(isPrivateIp("203.0.113.10"), false);
  });

  it("fingerprints and repos", () => {
    assert.equal(assetFingerprint("subdomain", "VPN.Example.COM"), "subdomain:vpn.example.com");
    assert.equal(normalizeRepository("https://github.com/demo-university/student-portal.git"), "github.com/demo-university/student-portal");
  });
});
