# Career Steps Consulting

Static website for [careersteps.net](https://careersteps.net).

## Project structure

- `index.html` - home page
- `about/`, `services/`, `contact/` - public site pages
- `assets/` - shared public styles, scripts, and images
- `admin/` - private bookkeeping portal frontend
- `worker/` - Cloudflare Worker API, D1 migrations, R2 integration, and tests

## Local development

Open the repository folder in Visual Studio Code, then open `index.html` with Live Server. The `/admin/` page uses temporary sample data on `localhost` by default. Add `?live=1` when serving the admin assets through the local Worker to test authenticated API access.

## Admin portal

The `/admin/` frontend remains on the existing GitHub Pages deployment. It connects to the `careersteps-admin-api` Worker at `admin-api.careersteps.net`, which is a dedicated same-site Cloudflare custom domain.

Bookkeeping records and attachments are never stored in this repository or browser storage. The private portal uses:

- a dedicated Cloudflare D1 database for expenses, income, invoices, reusable invoice starting points, payments, mileage, clients, projects, settings, sessions, and audit events;
- a dedicated private R2 bucket for receipts, generated invoices, contracts, MOUs, client logos, and the business signature;
- a strong password stored only as an encrypted Worker secret, with PBKDF2 password changes stored as salted hashes in D1;
- secure HTTP-only cookies, strict same-site scope, CSRF checks, origin validation, login rate limiting, session expiration, and security audit events;
- authenticated, server-validated API endpoints for every read and change.

See [worker/README.md](worker/README.md) for validation, migration, deployment, and backup operations.
