# Career Steps admin setup

The public website can remain on GitHub Pages. Supabase provides the private
authentication, relational database, and non-public file storage required by
the bookkeeping portal.

## 1. Create the private project

Create a dedicated Supabase project for Career Steps. In Authentication:

1. Keep email/password sign-in enabled.
2. Disable public user sign-ups after the first administrator is created.
3. Create the administrator account and use a strong, unique password.
4. Set the Site URL to `https://careersteps.net/admin/` and add the same URL
   to the allowed redirect URLs for password recovery.

## 2. Apply the schema

Run
`migrations/20260901190000_careersteps_bookkeeping.sql` in the Supabase SQL
Editor, or apply it through the Supabase CLI if the project is already linked.

The migration creates:

- the admin allowlist;
- settings, categories, clients, projects, expenses, income, payments, mileage,
  and attachment metadata tables;
- ownership constraints, duplicate-search indexes, updated timestamps, and
  payment-status synchronization;
- row-level security and least-privilege grants;
- a private `bookkeeping-attachments` bucket with a 15 MB per-file limit.

## 3. Authorize the administrator

After the Auth user exists, run this in the SQL Editor with the correct email:

```sql
insert into private.admin_users (user_id, display_name, mfa_required)
select id, 'Career Steps Administrator', false
from auth.users
where email = 'your-admin@example.com'
on conflict (user_id) do update
set display_name = excluded.display_name;
```

Only an Auth user present in this table can reach bookkeeping records. Every
record is also restricted to its owner.

The `mfa_required` switch is a security foundation for a future or separately
configured TOTP flow. Leave it `false` until the account can establish an
`aal2` Supabase session; setting it prematurely will intentionally block all
bookkeeping access for that user.

## 4. Configure the browser client

Open `admin/assets/config.js` and replace only:

- `YOUR_SUPABASE_URL` with the Project URL;
- `YOUR_SUPABASE_PUBLISHABLE_KEY` with the publishable browser key.

The publishable key is expected to be visible in the browser. Security comes
from the admin allowlist, authentication token, table grants, row-level
security, and storage policies. Never place a secret key, database password, or
service-role key in this repository.

## 5. Verify before publishing

Test these cases:

1. A signed-out visitor sees only the sign-in screen.
2. An authenticated but non-allowlisted user receives no bookkeeping access.
3. The authorized user can add, edit, search, and delete each record type.
4. Multiple receipt files upload, open through a short-lived link, and delete.
5. A second test user cannot read another user's rows or storage paths.
6. The YTD and CPA Tax Package totals match a manual sample calculation.
7. CSV, PDF, and Excel exports open correctly.
8. The public home, about, services, contact, and schedule pages are unchanged.

Database backups do not automatically include Supabase Storage objects. Plan a
separate periodic backup or retention process for receipt files before relying
on the portal as the only copy.
