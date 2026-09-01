import { describe, expect, it } from "vitest";
import {
  adminPasswordPolicyError,
  deriveAdminPasswordHash,
  isAllowedOrigin,
  secureEqual,
} from "../src/index";

describe("admin security helpers", () => {
  it("accepts a strong initial password and rejects weak replacements", () => {
    expect(adminPasswordPolicyError("ExamplePortal2026!")).toBeNull();
    expect(adminPasswordPolicyError("short")).toMatch(/12 characters/i);
    expect(adminPasswordPolicyError("alllowercaseletters")).toMatch(/three of/i);
  });

  it("derives repeatable password hashes and compares values safely", async () => {
    const salt = new Uint8Array(16).fill(7);
    const first = await deriveAdminPasswordHash("ExamplePortal2026!", salt, 1_000);
    const second = await deriveAdminPasswordHash("ExamplePortal2026!", salt, 1_000);
    expect(first).toBe(second);
    expect(await secureEqual(first, second)).toBe(true);
    expect(await secureEqual(first, `${second}x`)).toBe(false);
  });

  it("allows only CareerSteps production origins", () => {
    const allowed = "https://careersteps.net,https://www.careersteps.net";
    expect(isAllowedOrigin("https://careersteps.net", allowed)).toBe(true);
    expect(isAllowedOrigin("https://www.careersteps.net", allowed)).toBe(true);
    expect(isAllowedOrigin("https://example.com", allowed)).toBe(false);
    expect(isAllowedOrigin(null, allowed)).toBe(false);
  });
});
