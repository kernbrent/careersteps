import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function loadFolderPickerId(): (clientId: string) => string {
  const source = readFileSync(resolve(process.cwd(), "../admin/assets/invoice-ui.js"), "utf8");
  const helper = source.match(/function folderPickerId\(clientId\) \{\s*return ([^;]+);\s*\}/);
  if (!helper?.[1]) throw new Error("The folder picker ID helper was not found.");
  return new Function("clientId", `return ${helper[1]};`) as (clientId: string) => string;
}

describe("invoice folder picker", () => {
  it("uses a valid stable ID for UUID client records", () => {
    const folderPickerId = loadFolderPickerId();
    const pickerId = folderPickerId("6f32f220-ecd6-4fe0-a1bd-2e60b3b685e7");

    expect(pickerId).toBe("6f32f220ecd64fe0a1bd2e60b3b685e7");
    expect(pickerId).toHaveLength(32);
    expect(pickerId).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
