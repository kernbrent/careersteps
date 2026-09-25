import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { expect, it } from "vitest";
import { validInvoiceEmail } from "../src/invoice-email";

it("validates one client mailbox and rejects address/header injection", () => {
  for (const value of ["", "no-address", "a@b", "a@b.com,b@c.com", "a@b.com\r\nBcc:x@y.com", "a@-b.com", ".a@b.com", "a..b@c.com"]) expect(validInvoiceEmail(value)).toBe(false);
  expect(validInvoiceEmail("billing+invoices@example.com")).toBe(true);
});

it("runs the authenticated invoice workflow with real D1/R2 and a controlled Resend endpoint", async () => {
  const bundled = await build({ entryPoints: ["src/index.ts"], bundle: true, write: false, format: "esm", platform: "browser", external: ["node:buffer"] });
  let providerStatus = 200;
  let calls: { key: string | null; body: Record<string, unknown> }[] = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundled.outputFiles[0]!.text,
    compatibilityDate: "2026-09-01", compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"], r2Buckets: ["ATTACHMENTS"],
    bindings: { ALLOWED_ORIGINS: "https://careersteps.net", INVOICE_EMAIL_MODE: "live", INVOICE_EMAIL_FROM: "invoices@careersteps.net", RESEND_API_KEY: "dummy-test-key" },
    outboundService: async (request) => {
      expect(request.url).toBe("https://api.resend.com/emails");
      expect(request.headers.get("Authorization")).toBe("Bearer dummy-test-key");
      calls.push({ key: request.headers.get("Idempotency-Key"), body: await request.json() as Record<string, unknown> });
      return providerStatus === 200 ? Response.json({ id: `message-${calls.length}` }) : new Response("rejected", { status: providerStatus });
    },
  }));
  try {
    const db = await mf.getD1Database("DB");
    // D1 exec accepts a statement per line; preserve trigger bodies together.
    for (const name of readdirSync("migrations").filter(n => n.endsWith(".sql")).sort()) {
      const sql = readFileSync(`migrations/${name}`, "utf8").replace(/--[^\n]*/g, "");
      const statements = sql.match(/\s*CREATE TRIGGER[\s\S]*?END;|[^;]+;/gi) || [];
      for (const statement of statements) await db.prepare(statement.trim()).run();
    }
    const token = "a".repeat(48);
    const stamp = new Date().toISOString();
    await db.prepare("INSERT INTO admin_sessions(id,token_hash,csrf_token,created_at,expires_at,last_seen_at) VALUES ('test-session',?1,'test-csrf',?2,?3,?2)")
      .bind(createHash("sha256").update(token).digest("hex"), stamp, new Date(Date.now() + 3600000).toISOString()).run();
    const headers = { Origin: "https://careersteps.net", Cookie: `__Secure-careersteps_admin_session=${token}`, "X-CSRF-Token": "test-csrf", "Content-Type": "application/json" };
    const call = (path: string, body?: object, overrides: Record<string,string> = {}) => mf.dispatchFetch(`https://admin-api.careersteps.net/api/admin${path}`, {
      method: body ? "POST" : "GET", headers: { ...headers, ...overrides }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const clientResponse = await call("/records/clients", { name: "Safe Test Client", email: "test@example.test", is_active: true });
    expect(clientResponse.status, await clientResponse.clone().text()).toBe(201);
    const clientResult = await clientResponse.json() as { record: { id: string } };
    const clientId = clientResult.record.id;
    const invoiceResponse = await call("/invoices", {
      client_id: clientId, invoice_number: "TEST-DO-NOT-PAY", created_date: "2026-09-17", period_start: "2026-09-17", period_end: "2026-09-17",
      contract_name: "Safe email workflow test", include_client_logo: false, items: [{ billing_type: "fixed", cadence: "one_time", work_type: "Test only", quantity: 1, unit_rate: 1 }],
    });
    expect(invoiceResponse.status, await invoiceResponse.clone().text()).toBe(201);
    const { invoice } = await invoiceResponse.json() as { invoice: { id: string; updated_at: string } };
    const doc = new Uint8Array([80,75,3,4,0,0,0,0]);
    const upload = await mf.dispatchFetch(`https://admin-api.careersteps.net/api/admin/artifacts?type=invoice&clientId=${clientId}&invoiceId=${invoice.id}&displayName=Test`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "X-File-Name": "test.docx" }, body: doc,
    });
    expect(upload.status, await upload.clone().text()).toBe(201);
    const { artifact } = await upload.json() as { artifact: { id: string } };
    const body = { artifact_id: artifact.id, expected_recipient: "test@example.test", invoice_updated_at: invoice.updated_at, previous_message_id: null as string | null };
    const path = `/invoices/${invoice.id}/email`;
    expect((await call(path, body, { Cookie: "" })).status).toBe(401);
    expect((await call(path, body, { "X-CSRF-Token": "wrong" })).status).toBe(403);
    expect((await call(path, body, { Origin: "https://attacker.test" })).status).toBe(403);
    expect(calls).toHaveLength(0);
    await db.prepare("UPDATE clients SET email=NULL WHERE id=?1").bind(clientId).run();
    expect((await call(path, body)).status).toBe(422);
    await db.prepare("UPDATE clients SET email='test@example.test' WHERE id=?1").bind(clientId).run();
    expect((await call(path, { ...body, artifact_id: "wrong" })).status).toBe(422);
    expect((await call(path, { ...body, expected_recipient: "unexpected@example.test" })).status).toBe(409);
    expect((await call(path, { ...body, invoice_updated_at: "stale-version" })).status).toBe(409);
    providerStatus = 503;
    expect((await call(path, body)).status).toBe(502);
    expect((await db.prepare("SELECT emailed_at FROM invoices WHERE id=?1").bind(invoice.id).first())?.emailed_at).toBeNull();
    const firstKey = calls[0]!.key;
    const firstBody = calls[0]!.body;
    expect(firstBody).toMatchObject({ from: "Career Steps Consulting <invoices@careersteps.net>", to: ["test@example.test"], cc: ["admin@careersteps.net"], reply_to: "admin@careersteps.net" });
    expect(firstBody.attachments).toEqual([{ filename: "test.docx", content: Buffer.from(doc).toString("base64"), content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }]);
    // Changing the client after a timeout must not mutate the retry payload.
    await db.prepare("UPDATE clients SET email='changed@example.test' WHERE id=?1").bind(clientId).run();
    providerStatus = 200;
    const retry = await call(path, body);
    expect(retry.status).toBe(200);
    expect(calls[1]).toEqual({ key: firstKey, body: firstBody });
    const sent = await retry.json() as { email_message_id: string };
    expect((await db.prepare("SELECT emailed_to,email_message_id,status FROM invoices WHERE id=?1").bind(invoice.id).first())).toMatchObject({ emailed_to: "test@example.test", email_message_id: sent.email_message_id, status: "pending" });
    expect((await call(path, body)).status).toBe(409);
    expect(calls).toHaveLength(2);
    body.previous_message_id = sent.email_message_id;
    body.expected_recipient = "changed@example.test";
    const concurrent = await Promise.all([call(path, body), call(path, body)]);
    expect(concurrent.map(r => r.status).sort()).toEqual([200,409]);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.key).not.toBe(firstKey);
    const data = await (await call("/data")).json() as { invoices: Array<{ emailed_at: string; email_message_id: string }> };
    expect(data.invoices[0]!.emailed_at).toBeTruthy();
    expect(data.invoices[0]!.email_message_id).toBe("message-3");
    // A definitive provider rejection must leave prior success intact and permit correction.
    providerStatus = 422;
    body.previous_message_id = "message-3";
    expect((await call(path, body)).status).toBe(502);
    expect((await db.prepare("SELECT email_message_id,email_error FROM invoices WHERE id=?1").bind(invoice.id).first())).toMatchObject({ email_message_id: "message-3", email_error: expect.stringContaining("rejected") });
    providerStatus = 200;
    expect((await call(path, body)).status).toBe(200);
    // Redirects must never forward credentials, and old ambiguous sends must not
    // be sent again after Resend's idempotency retention expires.
    body.previous_message_id = "message-5";
    providerStatus = 302;
    const beforeRedirect = calls.length;
    expect((await call(path, body)).status).toBe(502);
    expect(calls).toHaveLength(beforeRedirect + 1);
    await db.prepare("UPDATE invoice_email_operations SET created_at=?1 WHERE invoice_id=?2").bind(new Date(Date.now() - 24 * 3600000).toISOString(), invoice.id).run();
    expect((await call(path, body)).status).toBe(409);
    expect(calls).toHaveLength(beforeRedirect + 1);
    const deletion = await mf.dispatchFetch(`https://admin-api.careersteps.net/api/admin/invoices/${invoice.id}`, {method: "DELETE", headers});
    expect(deletion.status).toBe(409);
    // Confirmed email history must not prevent removing an unpaid void mistake.
    await db.prepare("UPDATE invoice_email_operations SET status='sent' WHERE invoice_id=?1").bind(invoice.id).run();
    await db.prepare("UPDATE invoices SET status='void' WHERE id=?1").bind(invoice.id).run();
    const row = await db.prepare("SELECT income_id FROM invoices WHERE id=?1").bind(invoice.id).first<{ income_id: string }>();
    const operation = await db.prepare("SELECT payload_path FROM invoice_email_operations WHERE invoice_id=?1").bind(invoice.id).first<{ payload_path: string }>();
    const storedArtifact = await db.prepare("SELECT storage_path FROM client_artifacts WHERE id=?1").bind(artifact.id).first<{ storage_path: string }>();
    // Even void invoices remain protected if there is a recorded payment.
    await db.prepare("INSERT INTO income_payments(id,income_id,payment_date,amount,created_at,updated_at) VALUES ('guard-payment',?1,'2026-09-17',0.01,?2,?2)").bind(row!.income_id, stamp).run();
    expect((await mf.dispatchFetch(`https://admin-api.careersteps.net/api/admin/invoices/${invoice.id}`, {method: "DELETE", headers})).status).toBe(409);
    await expect(db.prepare("DELETE FROM invoices WHERE id=?1").bind(invoice.id).run()).rejects.toThrow();
    await db.prepare("DELETE FROM income_payments WHERE id='guard-payment'").run();
    const removed = await mf.dispatchFetch(`https://admin-api.careersteps.net/api/admin/invoices/${invoice.id}`, {method: "DELETE", headers});
    expect(removed.status, await removed.clone().text()).toBe(200);
    for (const table of ["invoices", "invoice_items", "invoice_email_operations"]) {
      const key = table === "invoices" ? "id" : "invoice_id";
      expect(await db.prepare(`SELECT * FROM ${table} WHERE ${key}=?1`).bind(invoice.id).first()).toBeNull();
    }
    expect(await db.prepare("SELECT id FROM income WHERE id=?1").bind(row!.income_id).first()).toBeNull();
    expect(await db.prepare("SELECT id FROM client_artifacts WHERE id=?1").bind(artifact.id).first()).toBeNull();
    const bucket = await mf.getR2Bucket("ATTACHMENTS");
    expect(await bucket.head(operation!.payload_path)).toBeNull();
    expect(await bucket.head(storedArtifact!.storage_path)).toBeNull();
    const audit = await db.prepare("SELECT metadata_json FROM audit_events WHERE entity_id=?1 AND event_type='deleted'").bind(invoice.id).first<{metadata_json:string}>();
    expect(JSON.parse(audit!.metadata_json)).toMatchObject({invoice_number: "TEST-DO-NOT-PAY", status: "void", email_message_id: "message-5"});
  } finally { await mf.dispose(); }
}, 60000);
