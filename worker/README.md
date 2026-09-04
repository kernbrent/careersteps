# CareerSteps Admin Worker

This Cloudflare Worker serves the private `/admin/` portal and protects the `/api/admin/*` bookkeeping API. D1 is the canonical ledger and R2 is the private attachment store.

## Security model

- The initial administrator password and session-signing material exist only as Cloudflare Worker secrets.
- Passwords changed in the portal are stored as uniquely salted PBKDF2-SHA256 hashes; plaintext passwords are never stored.
- Session tokens are random, stored only as SHA-256 hashes in D1, and sent through secure HTTP-only cookies limited to `/api/admin`.
- Every state-changing request requires the session CSRF token and an approved CareerSteps origin.
- Login failures are rate limited by a keyed hash of the connecting address.
- The API accepts only explicit record types and fields, validates values server-side, and uses bound D1 statements.
- R2 has no public access route. Attachments can be uploaded, viewed, or removed only through an authenticated API request.
- Admin responses use no-store caching and restrictive security headers. Worker logs and traces are enabled without recording passwords, session tokens, CSRF tokens, or file contents.

## Invoice workflow

- Creating an invoice also creates a matching pending Income record. Payments recorded from either workflow update both views.
- Invoice starting points can retain client, project, contract, billing lines, payment terms, summary source, and logo choices for reuse.
- Contracts, MOUs, logos, generated invoices, and other client files are stored privately in R2 and cataloged in D1.
- Word invoices are generated in the browser and saved to a remembered client folder when the browser supports folder access; otherwise they download normally.
- The Career Steps signature is loaded through an authenticated endpoint and dated with the invoice creation date. Configure or replace it from **Client Files > Business signature** after deployment. Never add the raw signature image to the repository or public asset folder.

## Local validation

From `worker/`:

```text
npm install
npm run types
npm test
npm run db:migrate:local
npm run check
```

The `check` task synchronizes the canonical `admin/` frontend into the ignored `worker/public/` staging directory, type-checks the Worker, and performs a deployment dry run.

## Production resources

- Worker: `careersteps-admin-api`
- D1 database: `careersteps-admin`
- Private R2 bucket: `careersteps-attachments-production`
- Custom domain: `admin-api.careersteps.net` (the portal frontend remains at `careersteps.net/admin/`)

Required encrypted Worker secrets:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Apply the numbered D1 migrations before the first production deployment:

```text
npm run db:migrate:remote
npm run deploy
```

## Backups

D1 and R2 are separate systems. Export D1 regularly and copy R2 attachments to a second protected location before treating this portal as the only copy of tax records. Database exports do not include R2 objects.
