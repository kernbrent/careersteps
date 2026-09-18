import { Buffer } from "node:buffer";
import { AdminError, adminJson, readAdminJson } from "./security";

const COPY_TO = "admin@careersteps.net";
const MAX_FILE = 5 * 1024 * 1024;
type Operation = { invoice_id: string; id: string; recipient: string; payload_path: string; status: string; message_id: string | null; created_at: string; sent_at: string | null; lease_until: string };
type Invoice = { id: string; client_id: string; invoice_number: string; updated_at: string; status: string; email_message_id: string | null };

export function validInvoiceEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value)
    && !value.split("@")[0]!.startsWith(".") && !value.split("@")[0]!.endsWith(".") && !value.includes("..");
}

export async function emailInvoice(request: Request, env: Env, invoiceId: string): Promise<Response> {
  const body = await readAdminJson(request);
  if (String(env.INVOICE_EMAIL_MODE) !== "live" || !env.RESEND_API_KEY?.trim()) {
    throw new AdminError(503, "EMAIL_NOT_CONFIGURED", "Invoice email is not enabled. Configure the verified Resend sender and API key first.");
  }
  const invoice = await env.DB.prepare("SELECT * FROM invoices WHERE id = ?1").bind(invoiceId).first<Invoice>();
  if (!invoice) throw new AdminError(404, "NOT_FOUND", "That invoice no longer exists.");
  if (invoice.status === "void") throw new AdminError(409, "VOID_INVOICE", "A void invoice cannot be emailed.");
  let operation = await env.DB.prepare("SELECT * FROM invoice_email_operations WHERE invoice_id = ?1").bind(invoiceId).first<Operation>();
  const now = new Date().toISOString();
  if (!operation || operation.status === "sent") {
    // Compare-and-swap confirmation prevents stale tabs and double clicks from
    // silently starting another send after the first request succeeds.
    if ((body.previous_message_id ?? null) !== invoice.email_message_id) {
      throw new AdminError(409, "ALREADY_EMAILED", "This invoice was already emailed. Refresh to review the prior send before confirming another copy.");
    }
    const client = await env.DB.prepare("SELECT email FROM clients WHERE id = ?1").bind(invoice.client_id).first<{ email: string | null }>();
    const recipient = client?.email?.trim() || "";
    if (!validInvoiceEmail(recipient)) throw new AdminError(422, "CLIENT_EMAIL_REQUIRED", "Add a valid email address to the client record before emailing this invoice.");
    if (body.expected_recipient !== recipient || body.invoice_updated_at !== invoice.updated_at) {
      throw new AdminError(409, "INVOICE_CHANGED", "The invoice or client email changed. Refresh and review it before sending.");
    }
    const sender = env.INVOICE_EMAIL_FROM?.trim();
    if (!validInvoiceEmail(sender) || !sender.toLowerCase().endsWith("@careersteps.net")) {
      throw new AdminError(503, "EMAIL_NOT_CONFIGURED", "Configure a verified careersteps.net sender before sending.");
    }
    const artifact = await env.DB.prepare(
      `SELECT storage_path, file_name, mime_type, created_at FROM client_artifacts
       WHERE id = ?1 AND linked_invoice_id = ?2 AND client_id = ?3 AND artifact_type = 'invoice' AND is_current = 1`,
    ).bind(typeof body.artifact_id === "string" ? body.artifact_id : "", invoiceId, invoice.client_id)
      .first<{ storage_path: string; file_name: string; mime_type: string; created_at: string }>();
    if (!artifact || artifact.created_at < invoice.updated_at || !["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(artifact.mime_type)) {
      throw new AdminError(422, "INVOICE_DOCUMENT_REQUIRED", "Generate a current invoice document before sending.");
    }
    const file = await env.ATTACHMENTS.get(artifact.storage_path);
    if (!file) throw new AdminError(422, "INVOICE_DOCUMENT_REQUIRED", "The invoice document is unavailable. Generate it again.");
    if (file.size > MAX_FILE) throw new AdminError(422, "INVOICE_TOO_LARGE", "The email attachment must be under 5 MB. Reduce the invoice images and try again.");
    const operationId = crypto.randomUUID();
    const payloadPath = `invoice-email/${invoiceId}/${operationId}.json`;
    const payload = JSON.stringify({
      from: `Career Steps Consulting <${sender}>`, to: [recipient], cc: [COPY_TO], reply_to: COPY_TO,
      subject: `Career Steps Consulting invoice ${invoice.invoice_number.replace(/[\r\n]/g, " ")}`,
      text: `Please find invoice ${invoice.invoice_number} attached.\n\nPlease reply to this email with any questions.\n\nThank you,\nCareer Steps Consulting`,
      attachments: [{ filename: artifact.file_name, content: Buffer.from(await file.arrayBuffer()).toString("base64"), content_type: artifact.mime_type }],
    });
    await env.ATTACHMENTS.put(payloadPath, payload, { httpMetadata: { contentType: "application/json" } });
    const inserted = await env.DB.prepare(
      `INSERT INTO invoice_email_operations (invoice_id,id,recipient,payload_path,status,created_at,lease_until)
       SELECT ?1,?2,?3,?4,'pending',?5,'' FROM invoices i JOIN clients c ON c.id=i.client_id
       WHERE i.id=?1 AND i.updated_at=?7 AND trim(c.email)=?3 AND i.status!='void'
       ON CONFLICT(invoice_id) DO UPDATE SET id=excluded.id,recipient=excluded.recipient,payload_path=excluded.payload_path,
         status='pending',message_id=NULL,created_at=excluded.created_at,sent_at=NULL,lease_until=''
       WHERE invoice_email_operations.status='sent' AND invoice_email_operations.message_id=?6`,
    ).bind(invoiceId, operationId, recipient, payloadPath, now, body.previous_message_id ?? null, invoice.updated_at).run();
    if (!inserted.meta.changes) {
      await env.ATTACHMENTS.delete(payloadPath);
      throw new AdminError(409, "EMAIL_IN_PROGRESS", "Another email request has already started. Refresh to check its result.");
    }
    operation = { invoice_id: invoiceId, id: operationId, recipient, payload_path: payloadPath, status: "pending", message_id: null, created_at: now, sent_at: null, lease_until: "" };
  }
  // Resend retains keys for 24h. Never repeat an uncertain operation beyond that
  // window; an administrator must reconcile it against the provider's log.
  if (Date.now() - Date.parse(operation.created_at) >= 23 * 60 * 60 * 1000) {
    throw new AdminError(409, "EMAIL_RECONCILIATION_REQUIRED", "The prior send is unconfirmed and too old to retry safely. Check the Resend log before sending again.");
  }
  const lease = new Date(Date.now() + 60_000).toISOString();
  const claimed = await env.DB.prepare(
    "UPDATE invoice_email_operations SET lease_until=?1 WHERE invoice_id=?2 AND id=?3 AND status='pending' AND lease_until < ?4",
  ).bind(lease, invoiceId, operation.id, now).run();
  if (!claimed.meta.changes) throw new AdminError(409, "EMAIL_IN_PROGRESS", "An email request is already processing. Wait a minute, then refresh or retry.");
  let messageId: string;
  try {
    const snapshot = await env.ATTACHMENTS.get(operation.payload_path);
    if (!snapshot || snapshot.size > 8 * 1024 * 1024) throw new Error("Missing snapshot");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, "Content-Type": "application/json", "Idempotency-Key": `invoice/${operation.id}` },
      body: await snapshot.text(),
    });
    if (!response.ok) {
      await response.body?.cancel();
      // Explicit validation/auth rejection cannot have sent; allow corrected data
      // to create a new operation. Timeouts, 409, 429, redirects, 5xx stay pending.
      const rejected = [400, 401, 403, 404, 422].includes(response.status);
      if (rejected) await env.DB.prepare("DELETE FROM invoice_email_operations WHERE invoice_id=?1 AND id=?2").bind(invoiceId, operation.id).run();
      throw new AdminError(502, "EMAIL_SEND_FAILED", rejected
        ? `Resend rejected the email (HTTP ${response.status}). Check sender verification, API key, and client address, then retry.`
        : `Resend did not confirm the send (HTTP ${response.status}). Retry will check the same request without creating a new email.`);
    }
    const result = await response.json<{ id?: string }>();
    if (!result.id || typeof result.id !== "string") throw new Error("No provider ID");
    messageId = result.id;
  } catch (error) {
    const message = error instanceof AdminError ? error.message : "The email send could not be confirmed. Retry uses the original recipient and attachment to prevent duplicates.";
    await env.DB.batch([
      env.DB.prepare("UPDATE invoices SET email_error=?1 WHERE id=?2").bind(message, invoiceId),
      env.DB.prepare("UPDATE invoice_email_operations SET lease_until='' WHERE invoice_id=?1 AND id=?2").bind(invoiceId, operation.id),
    ]);
    throw new AdminError(502, "EMAIL_SEND_FAILED", message);
  }
  const sentAt = new Date().toISOString();
  // These writes are atomic. If persistence fails, the pending operation remains
  // retryable with the same provider key and immutable message.
  await env.DB.batch([
    env.DB.prepare("UPDATE invoice_email_operations SET status='sent',message_id=?1,sent_at=?2,lease_until='' WHERE invoice_id=?3 AND id=?4").bind(messageId, sentAt, invoiceId, operation.id),
    env.DB.prepare("UPDATE invoices SET emailed_at=?1,emailed_to=?2,email_message_id=?3,email_error=NULL,sent_at=?1 WHERE id=?4").bind(sentAt, operation.recipient, messageId, invoiceId),
    env.DB.prepare("INSERT INTO audit_events (id,entity_type,entity_id,event_type,metadata_json,created_at) VALUES (?1,'invoices',?2,'emailed',?3,?4)").bind(crypto.randomUUID(), invoiceId, JSON.stringify({ recipient: operation.recipient, cc: COPY_TO, message_id: messageId, operation_id: operation.id }), sentAt),
  ]);
  return adminJson({ emailed_at: sentAt, emailed_to: operation.recipient, email_message_id: messageId });
}
