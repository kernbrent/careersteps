# Career Steps website dashboard

Private website directory and encrypted credential vault, prepared November 9, 2026. Intended production address: `https://dashboard.careersteps.net`. No release is authorized by this document.

## Included websites

The initial registry has Career Steps, Christian Steps Ministries, Hope Sojourns, Choice 1 Recruiting, Josh Beyond Borders, Prayer Portal, NTX Earthquakes, Street FC, InterVarsity / Benzi George, Light Appraisal, Metro Relief's existing website, and the separate Metro Relief replacement/review website. PortalWorks is deliberately excluded.

Add website creates a registry entry. Edit changes its details, category, ordering, access option, and saved credentials. Remove from dashboard requires typing the site's name and removes only that entry, its encrypted credentials, and outstanding launch tickets. It never deletes a website, account, database, repository, or business record. The entry can be recreated through Add website; its removed credentials cannot be recovered from the dashboard.

Public sites and placeholders have a Visit site link. External portals have their normal admin link. Sites with both saved credentials and a connection key show One-click configured, which describes configuration rather than claiming a successful live connection test. A connector must also be deployed on the target site. No production passwords have been imported into this checkout or the local preview.

## Architecture and authentication

The dashboard is an independent Cloudflare Worker, static frontend, and dedicated SQLite-backed Durable Object. Production and test use separate Worker namespaces and encryption keys, independent of all client databases. The account's ten D1 slots are already occupied, so the hosted release does not create, reuse, migrate, or delete any existing D1 database. The versioned SQL migrations initialize each new namespace atomically; their D1-compatible query interface is also tested against ordinary SQLite fixtures. The dashboard has one administrator, initially `admin@careersteps.net`; there is no public account registration. Passwords use a 100,000-iteration salted PBKDF2-SHA256 hash after the initial password is changed. Initial and updated passwords require at least 16 characters. Sessions use random tokens stored only as SHA-256 hashes, HttpOnly/Secure host cookies, eight-hour expiry or seven days when remembered, same-origin mutation checks, and CSRF tokens. Failed/repeated authentication and credential-reveal attempts are rate limited.

Site username/password/connection-key JSON is encrypted using AES-256-GCM under the independent `VAULT_KEY`. Each encrypted record is authenticated against its site ID. Listing returns username and configured flags, never passwords or connection keys. Revealing credentials requires the dashboard password again. The credential dialog clears after 60 seconds and on close; no password is saved in browser storage. Audit events record actions, site IDs and times, not passwords, raw launch codes, or keys. Losing `VAULT_KEY` loses access to existing saved credentials; back it up separately from the database. Changing the dashboard password does not require re-encrypting the vault.

### One-click launch

1. The tile opens the target site's `/dashboard-connect` in a new tab.
2. A same-origin POST creates a random two-minute browser verifier cookie. Only its SHA-256 challenge goes to the dashboard.
3. The dashboard requires its own active session, the configured site, and saved credentials. It issues a 60-second, single-use launch code bound to the source session, exact site ID, and browser challenge.
4. A redirect places that code in the target URL fragment. The target removes it from browser history immediately.
5. The target's connector redeems it server-to-server using a unique `DASHBOARD_CONNECT_SECRET` and the browser verifier. Redemption atomically consumes the code and checks that the source dashboard session is still active. A removed/edited site or signed-out session invalidates outstanding codes.
6. The connector submits the stored credentials to the site's existing login handler through a private, same-account Cloudflare service binding, preserving its account status, password checks, permissions, throttling and session cookies. Passwords and connection keys are never placed in URLs. It then opens the admin area without a form submission by the user.

Existing site accounts remain authoritative. If a password changes on a site, update its saved dashboard password. Dashboard sign-out and removal do not revoke sessions already established on other sites; use those sites' sign-out controls when needed. There is no universal browser automation, account merging, or cross-domain cookie sharing.

Career Steps now uses `/api/admin` on the frontend's own origin, matching its existing Worker routes. This is necessary because a host-only cookie issued on careersteps.net would not authenticate requests sent to admin-api.careersteps.net. The older API custom domain can remain configured. Existing users with only a session on that API hostname will need to sign in once on the website origin.

Josh Beyond Borders retains its encrypted workbook. Its connector returns the stored password only to the same-origin admin script after the verifier-bound exchange; the script invokes the existing decryption function directly and keeps the password in working memory for the existing workbook operations. It never clicks/submits a login form, writes a plaintext workbook, or publishes donor updates during sign-in. A dashboard launch disables and clears the existing remembered-password cache for that browser. Its ordinary manual sign-in remains available.

The current Metro Relief WebInOne portal is an external sign-in link because supported provider SSO has not been established. No third-party sign-in is represented as automatic. Street FC and the Metro replacement have public links because they have no admin backend to sign into. InterVarsity and Light Appraisal are placeholders.

## Local preview and validation

This checkout reuses the sibling `careersteps/worker/node_modules` Wrangler installation. With a current Node runtime from the Codex workspace dependencies:

```text
node tools/setup-local.mjs
node tools/prepare-connectors.mjs
node tools/prepare-earthquakes.mjs
node tools/prepare-test.mjs
node tools/prepare-storage.mjs
node --test test/dashboard.test.mjs test/connectors.test.mjs test/earthquakes.test.mjs test/storage.test.mjs
node tools/check.mjs
node ../worker/node_modules/wrangler/bin/wrangler.js dev --local --port 8798 --local-upstream localhost:8798
```

Open `http://localhost:8798`. Local-only login instructions are in ignored `.private/LOCAL-LOGIN.txt`; `.dev.vars` contains independently generated local secrets. Neither file belongs in Git, screenshots, documentation, or production. Setup never replaces an existing local setup. Keep the explicit local upstream: otherwise Wrangler rewrites the Origin to the production route hostname and the local application correctly rejects it.

The tests exercise migrations with SQLite, CRUD, encryption and site binding, password changes, CSRF and origin checks, credential reveal, rate limits, expiry/logout/deletion/replay, full broker-to-connector flows for all seven supported sites, login-field mapping, and the real local NTX backend. Other existing site login handlers are represented by controlled bindings; live credentials and production services are not used. Run Career Steps' existing Worker tests after its frontend origin change, and Josh's existing tests after the workbook entrypoint change.

`tools/prepare-earthquakes.mjs` synchronizes the shared security helper and generates a one-time seed migration from the team's existing public JSON. Check helper parity with `tools/check.mjs`. Generated seed SQL is tracked; do not regenerate a shipped migration to change live content. Make subsequent edits in the admin portal or create a new explicit migration.

## Release preparation after explicit approval

Brent approved committing, pushing, and deploying this implementation on November 9, 2026. Cloudflare zone/account ownership has been verified and pinned. The hosted version uses independent SQLite Durable Object namespaces; the earlier local D1 fixtures remain test-only. No existing business database is repurposed.

1. Verify and pin the Cloudflare account for the dashboard, each connector, and NTX. Each connector must be in the account containing its target Worker and DNS zone. Choice 1 / Street FC ownership is separate from the Hope Sojourns account; do not move client resources into the dashboard's account. The existing `AUTH_BACKEND` service bindings remain local to each site's own account.
2. Deploy separate SQLite Durable Object namespaces for the production dashboard, test dashboard, and NTX admin. Their constructors apply versioned migrations atomically once per namespace. Do not bind local development to remote data. Back up and compare the existing site's live public JSON before enabling NTX's data routes.
3. Generate separate production `ADMIN_PASSWORD` and 32-byte base64url `VAULT_KEY` secrets, with independent values for test. Provision the NTX `ADMIN_PASSWORD`; use the configured NTX admin username. Send secrets only through authenticated API requests or hidden prompts, never command arguments, logs, or tracked files. The operator backup is protected by Windows CurrentUser encryption in ignored local storage. Provide Brent's initial login through the local protected-login helper, then have him change his dashboard password.
4. Publish the test dashboard at `dashboard-test.careersteps.net` and test connectors at `test.hopesojourns.com` and `prayer-test.hopesojourns.com`. Test connectors refer only to the test broker and test backend. The test seed connects only HS test and Prayer test; other sites are uncredentialed public references. Use separate test credentials, vault keys, connection keys, and databases. Never connect test identities to production data.
5. After the test flow is verified, publish the production dashboard, the NTX backend, and the seven production connector Workers. In each dashboard tile enter its existing site username/password. Generate a unique connection key, save it encrypted in the dashboard, and install that exact value as `DASHBOARD_CONNECT_SECRET` on only its corresponding connector. The same process with different values applies in test. Do not copy production credentials or business data into test. Unconfigured bridges fail closed while direct sign-in links remain available.
6. Release the Career Steps frontend config change and Josh's updated admin script/cache version alongside their adapters. Other existing portal source is unchanged; adapters call the existing login handlers. Keep unrelated user changes in Christian Steps, Hope Sojourns, Metro Relief and Josh outside this release. Hope's production/test connector code is identical, with environment-specific bindings only. The standalone dashboard launch instructions are maintained here; existing Hope Sojourns authentication, portal navigation, account permissions, native guides, and business records are unchanged.
7. Verify actual browser sign-in for every configured production tile, existing direct sign-in, wrong-password behavior, expired/replayed codes, site access permissions, password reveal, adding/removing a disposable tile, and NTX's public calendar/roster/results. No live verification should publish donor records, send invitations, or change business data. Record any provider-managed portal that remains manual.

Normal key rotation: generate and save a new per-site connection key, replace the connector secret, and verify one launch. The brief mismatch fails closed. To revoke a connection, clear its saved credentials/key or remove its tile; separately revoke any already-established native site sessions if necessary. To recover the dashboard password, an authorized operator can replace only its `settings.password` hash and revoke dashboard sessions/tickets. Do not reset the database or discard the vault key.

## Future highlighted data

The registry is independent of site business records, so a later widgets migration can add selected metrics without changing launch credentials or merging databases. Implement read-only, explicitly scoped summary connectors per site and fetch them on the dashboard server. Do not reuse an unrestricted browser admin cookie as a data integration. Define each metric's source, reporting period, currency, permissions, refresh time, and unavailable state before displaying it. Aggregate donation/finance totals carefully: Christian Steps, Hope Sojourns, and Josh can describe the same transferred gift, so adding their figures together would double-count it. Prayer widgets must re-check audience and role permissions and should default to counts rather than private prayer text. This first release does not claim to display live business metrics.
