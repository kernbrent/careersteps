# Invoice email operations

The invoice list has Email / Email again / Retry email actions. The client record
is authoritative for the recipient. Every send copies admin@careersteps.net and
uses that address for replies. The current Word generator builds a fresh branded
attachment; the existing Word download action is unchanged.

The authenticated, origin- and CSRF-protected endpoint is
`POST /api/admin/invoices/:id/email`. It validates the client mailbox, invoice
revision, selected private document, and sender domain. The browser cannot choose
the sender or CC. Void invoices cannot be sent. Demo mode cannot send email.

## Configuration and release

1. Use the separate CareerSteps Resend account (admin@careersteps.net), not the
   Christian Steps Ministries account. Cloudflare currently forwards that address
   to kernbrent@gmail.com; the existing MX records belong to Cloudflare Email Routing.
2. Add careersteps.net to the CareerSteps Resend account. Add the exact DKIM and
   sending records provided by Resend, and verify the domain. Do not replace
   root MX records or enable Resend receiving; that would interfere with replies.
   Use invoices@careersteps.net as the sender. If the verified setup requires
   admin@careersteps.net, change INVOICE_EMAIL_FROM accordingly.
3. Store a sending-only Resend key scoped to this domain as the Worker secret
   RESEND_API_KEY. Never put the key in browser configuration, source control,
   command arguments, or chat. The Hope Sojourns key must not be reused.
4. INVOICE_EMAIL_MODE is live for the verified production sender. Enable live only once account setup,
   domain verification, and the key are complete. Re-run Wrangler types if config
   changes. No Gmail account is required when the forwarding address works.
5. Release only after Brent explicitly authorizes deployment. Back up D1, apply
   migration 0006_invoice_email.sql, then release the Worker and canonical admin
   assets together using the existing stack. The public admin frontend is served
   by GitHub Pages, and the API by Cloudflare Workers. This task does not itself
   authorize a commit, push, or deployment.
6. Before live client use, send a clearly marked synthetic invoice to an owned
   test mailbox, confirm the actual attachment and the admin copy arrive, and
   compare Resend's message ID with the portal. Do not test using a real client.

## Persistence and duplicate protection

Provider acceptance sets emailed_at, emailed_to, email_message_id and sent_at,
and records an audit event. Payment status is independent. “Emailed” means Resend
accepted the message, not that it reached an inbox. Later rejection of a resend
does not erase a prior successful send; the new error is shown alongside it.

invoice_email_operations is a durable per-invoice operation with a private R2
snapshot of the exact message, recipient and attachment. A database lease stops
concurrent sends. Each operation uses its own Resend idempotency key. Resends
require confirmation against the last accepted message ID, preventing stale tabs
and double clicks from sending a second message accidentally.

Network errors, redirects, throttling and server errors preserve the original
operation for retry. Even if the client email changes, retry sends the immutable
original message. Explicit validation/authentication rejections allow a corrected
new operation. An unconfirmed operation freezes invoice content edits. Emailed
invoices are retained rather than deleted, preserving the billing record.

Retries stop at 23 hours, before Resend's 24-hour idempotency retention ends. For
an expired unconfirmed operation, an administrator must reconcile the operation
against Resend's logs before changing its state. If accepted, record its provider
ID and acceptance time in one transaction with the invoice/audit update. Only if
the provider confirms no send occurred may the pending operation be removed to
allow a new send. Never clear a pending operation merely to bypass an error.

Payloads and attachments remain private in R2. Send history is retained in audit
events; snapshots are retained for reconciliation. A future retention policy can
remove superseded payloads after the required billing retention period. Do not
log API keys, message contents, full provider responses, or exception text from
the email provider.

## Validation

`npm test` includes a Cloudflare runtime integration test using real local D1/R2
and a controlled outbound Resend endpoint. It covers authentication, CSRF/origin,
client email and revision checks, attachment validation, rejection, uncertain
retry, concurrent requests, confirmed resend, redirect rejection, expired retry,
persistence after reload, and retained prior success. Existing invoice document,
preview, payment validation, and other bookkeeping tests remain in the suite.

The isolated browser preview also exercised the actual Word generator, private
artifact upload, Email confirmation, server send, and persistent Emailed display
after reload. Outgoing mail was captured locally; no client was emailed.

The separate CareerSteps Resend account and careersteps.net domain are verified. The domain-scoped sending key is stored encrypted in Cloudflare. On 2026-09-18, Brent explicitly authorized commit, push, and deployment. The database was backed up, migration 0006 applied, and the Worker deployed with the existing admin and API routes preserved. All 30 tests, TypeScript, and the dry-run build passed. Live browser and delivery verification is in progress.
