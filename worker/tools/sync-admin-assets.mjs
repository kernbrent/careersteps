import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workerDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = resolve(workerDirectory, "public");
const sourceDirectory = resolve(workerDirectory, "..", "admin");
const destinationDirectory = resolve(publicDirectory, "admin");

if (destinationDirectory !== resolve(workerDirectory, "public", "admin")) {
  throw new Error("Refusing to replace an unexpected admin asset directory.");
}

await mkdir(publicDirectory, { recursive: true });
await rm(destinationDirectory, { recursive: true, force: true });
await cp(sourceDirectory, destinationDirectory, { recursive: true, force: true });
const adminHeaders = `  Cache-Control: no-store, private, max-age=0
  Content-Security-Policy: default-src 'self'; connect-src 'self' https://admin-api.careersteps.net; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  Cross-Origin-Resource-Policy: same-origin
  Expires: 0
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Pragma: no-cache
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY`;

await writeFile(resolve(publicDirectory, "_headers"), `/admin
${adminHeaders}

/admin/*
${adminHeaders}
`, "utf8");

console.log("Admin assets refreshed from the canonical source with no-cache headers.");
