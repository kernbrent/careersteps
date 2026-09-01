# Career Steps Consulting

Static website for [careersteps.net](https://careersteps.net).

## Project structure

- `index.html` — home page
- `about/`, `services/`, `contact/` — site pages
- `assets/css/` — shared styles
- `assets/js/` — shared scripts
- `assets/images/` — site images
- `includes/` — reserved for reusable source fragments
- `admin/` — private bookkeeping portal frontend
- `supabase/` — database, access-control, and private attachment setup

## Local development

Open the repository folder in Visual Studio Code, then open `index.html` with Live Server. All navigation uses relative links so the site works locally and on GitHub Pages.

## Workflow

Work and test locally using Live Server. Commit changes to `main` locally, then push to GitHub only when the site is ready for production.

## Admin portal

The admin portal is served from `/admin/` and is designed to stay compatible
with the site's existing GitHub Pages hosting. Bookkeeping records and
attachments are not stored in this repository or in browser storage. They use a
dedicated Supabase project with:

- email/password authentication and an explicit admin allowlist;
- row-level security on every bookkeeping table;
- a private attachment bucket with per-user paths and short-lived viewing URLs;
- relational ledgers for expenses, income and partial payments, mileage,
  clients, projects, categories, and CPA review items.

See [supabase/README.md](supabase/README.md) for the one-time configuration.

When the Supabase placeholders have not been configured, production displays a
setup notice. A local server on `localhost` or `127.0.0.1` displays a
temporary sample-data preview so the interface can be reviewed without using
real financial information.
