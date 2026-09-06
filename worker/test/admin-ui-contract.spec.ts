import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const adminScript = readFileSync(resolve(testDirectory, "../../admin/assets/app.js"), "utf8");
const adminPage = readFileSync(resolve(testDirectory, "../../admin/index.html"), "utf8");

describe("Admin Portal sign-in contract", () => {
  it("collects and submits the administrator ID with the password", () => {
    expect(adminPage).toContain('<label for="login-user-id">User ID');
    expect(adminPage).toMatch(/<input id="login-user-id" type="text" name="userId" autocomplete="username" required/);
    expect(adminPage).toContain('autocomplete="current-password"');
    expect(adminScript).toContain('userId: String(data.get("userId"))');
  });
});
