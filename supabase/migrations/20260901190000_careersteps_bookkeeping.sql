-- Career Steps bookkeeping foundation
-- Apply this migration in a dedicated Supabase project before configuring /admin/.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  mfa_required boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

revoke all on private.admin_users from public, anon, authenticated;

create or replace function private.is_bookkeeping_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users as admins
    where admins.user_id = (select auth.uid())
      and (
        not admins.mfa_required
        or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      )
  );
$$;

revoke execute on function private.is_bookkeeping_admin() from public, anon;
grant execute on function private.is_bookkeeping_admin() to authenticated;

do $$ begin
  create type public.record_status as enum ('included', 'excluded', 'needs_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.income_payment_status as enum ('unpaid', 'partial', 'paid', 'overdue', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attachment_record_type as enum ('expense', 'income');
exception when duplicate_object then null; end $$;

create table if not exists public.app_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Career Steps Consulting LLC',
  default_tax_year integer not null default extract(year from current_date)::integer check (default_tax_year between 2000 and 2100),
  currency_code text not null default 'USD' check (char_length(currency_code) = 3),
  mileage_rate numeric(8, 3) not null default 0 check (mileage_rate >= 0),
  contact_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  tax_line text,
  color text not null default '#0d4b73' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, name),
  unique (id, owner_id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  company text,
  email text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, owner_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_client_owner_fk foreign key (client_id, owner_id) references public.clients(id, owner_id) on delete cascade,
  constraint projects_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  unique (id, owner_id),
  unique (id, client_id, owner_id),
  unique (owner_id, client_id, name)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  vendor text not null check (char_length(trim(vendor)) between 1 and 180),
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid,
  description text,
  business_purpose text,
  payment_method text,
  client_id uuid,
  project_id uuid,
  tax_year integer not null check (tax_year between 2000 and 2100),
  reimbursable boolean not null default false,
  reimbursed boolean not null default false,
  deductibility_percent numeric(5, 2) not null default 100 check (deductibility_percent between 0 and 100),
  record_status public.record_status not null default 'included',
  cpa_review boolean not null default false,
  cpa_notes text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint expenses_reimbursement_check check (not reimbursed or reimbursable),
  constraint expenses_project_requires_client_check check (project_id is null or client_id is not null),
  constraint expenses_category_owner_fk foreign key (category_id, owner_id) references public.categories(id, owner_id) on delete restrict,
  constraint expenses_client_owner_fk foreign key (client_id, owner_id) references public.clients(id, owner_id) on delete restrict,
  constraint expenses_project_client_owner_fk foreign key (project_id, client_id, owner_id) references public.projects(id, client_id, owner_id) on delete restrict,
  unique (id, owner_id)
);

create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  income_date date not null,
  client_id uuid,
  project_id uuid,
  payer_name text not null check (char_length(trim(payer_name)) between 1 and 180),
  invoice_number text,
  invoice_date date,
  due_date date,
  amount numeric(12, 2) not null check (amount > 0),
  payment_status public.income_payment_status not null default 'unpaid',
  description text,
  payment_method text,
  tax_year integer not null check (tax_year between 2000 and 2100),
  record_status public.record_status not null default 'included',
  cpa_review boolean not null default false,
  cpa_notes text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint income_invoice_dates_check check (due_date is null or invoice_date is null or due_date >= invoice_date),
  constraint income_project_requires_client_check check (project_id is null or client_id is not null),
  constraint income_client_owner_fk foreign key (client_id, owner_id) references public.clients(id, owner_id) on delete restrict,
  constraint income_project_client_owner_fk foreign key (project_id, client_id, owner_id) references public.projects(id, client_id, owner_id) on delete restrict,
  unique (id, owner_id)
);

create table if not exists public.income_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  income_id uuid not null,
  payment_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text,
  reference_number text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint income_payments_income_owner_fk foreign key (income_id, owner_id) references public.income(id, owner_id) on delete cascade,
  unique (id, owner_id)
);

create table if not exists public.mileage_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mileage_date date not null,
  origin text not null check (char_length(trim(origin)) between 1 and 240),
  destination text not null check (char_length(trim(destination)) between 1 and 240),
  business_purpose text not null check (char_length(trim(business_purpose)) between 1 and 500),
  miles numeric(10, 2) not null check (miles > 0),
  client_id uuid,
  project_id uuid,
  tax_year integer not null check (tax_year between 2000 and 2100),
  record_status public.record_status not null default 'included',
  cpa_review boolean not null default false,
  cpa_notes text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint mileage_project_requires_client_check check (project_id is null or client_id is not null),
  constraint mileage_client_owner_fk foreign key (client_id, owner_id) references public.clients(id, owner_id) on delete restrict,
  constraint mileage_project_client_owner_fk foreign key (project_id, client_id, owner_id) references public.projects(id, client_id, owner_id) on delete restrict,
  unique (id, owner_id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_type public.attachment_record_type not null,
  expense_id uuid,
  income_id uuid,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint attachments_exactly_one_record_check check (
    (record_type = 'expense' and expense_id is not null and income_id is null)
    or (record_type = 'income' and income_id is not null and expense_id is null)
  ),
  constraint attachments_expense_owner_fk foreign key (expense_id, owner_id) references public.expenses(id, owner_id) on delete cascade,
  constraint attachments_income_owner_fk foreign key (income_id, owner_id) references public.income(id, owner_id) on delete cascade,
  unique (owner_id, storage_path)
);

create index if not exists expenses_owner_date_idx on public.expenses (owner_id, expense_date desc);
create index if not exists expenses_owner_vendor_amount_idx on public.expenses (owner_id, lower(vendor), expense_date, amount);
create index if not exists income_owner_date_idx on public.income (owner_id, income_date desc);
create index if not exists income_owner_invoice_idx on public.income (owner_id, invoice_number) where invoice_number is not null;
create index if not exists income_payments_owner_income_idx on public.income_payments (owner_id, income_id, payment_date desc);
create index if not exists mileage_owner_date_idx on public.mileage_entries (owner_id, mileage_date desc);
create index if not exists clients_owner_name_idx on public.clients (owner_id, lower(name));
create unique index if not exists categories_owner_name_lower_idx on public.categories (owner_id, lower(name));
create index if not exists projects_owner_client_idx on public.projects (owner_id, client_id);
create index if not exists attachments_owner_record_idx on public.attachments (owner_id, record_type, expense_id, income_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function private.sync_income_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_income_id uuid;
  invoice_total numeric(12, 2);
  received_total numeric(12, 2);
  existing_status public.income_payment_status;
begin
  target_income_id := coalesce(new.income_id, old.income_id);

  select item.amount, item.payment_status
    into invoice_total, existing_status
  from public.income as item
  where item.id = target_income_id;

  if existing_status = 'void' then
    return null;
  end if;

  select coalesce(sum(payment.amount), 0)
    into received_total
  from public.income_payments as payment
  where payment.income_id = target_income_id;

  update public.income
  set payment_status = case
        when received_total <= 0 then 'unpaid'::public.income_payment_status
        when received_total < invoice_total then 'partial'::public.income_payment_status
        else 'paid'::public.income_payment_status
      end,
      updated_at = timezone('utc', now())
  where id = target_income_id;

  return null;
end;
$$;

revoke execute on function private.touch_updated_at() from public, anon, authenticated;
revoke execute on function private.sync_income_payment_status() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['app_settings','categories','clients','projects','expenses','income','income_payments','mileage_entries'] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

drop trigger if exists income_payments_sync_status on public.income_payments;
create trigger income_payments_sync_status
after insert or update or delete on public.income_payments
for each row execute function private.sync_income_payment_status();

do $$
declare table_name text;
begin
  foreach table_name in array array['app_settings','categories','clients','projects','expenses','income','income_payments','mileage_entries','attachments'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_access', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.is_bookkeeping_admin()) and owner_id = (select auth.uid())) with check ((select private.is_bookkeeping_admin()) and owner_id = (select auth.uid()))',
      table_name || '_owner_access', table_name
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bookkeeping-attachments',
  'bookkeeping-attachments',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bookkeeping_attachments_select on storage.objects;
create policy bookkeeping_attachments_select
on storage.objects for select to authenticated
using (
  bucket_id = 'bookkeeping-attachments'
  and (select private.is_bookkeeping_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists bookkeeping_attachments_insert on storage.objects;
create policy bookkeeping_attachments_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'bookkeeping-attachments'
  and (select private.is_bookkeeping_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists bookkeeping_attachments_update on storage.objects;
create policy bookkeeping_attachments_update
on storage.objects for update to authenticated
using (
  bucket_id = 'bookkeeping-attachments'
  and (select private.is_bookkeeping_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'bookkeeping-attachments'
  and (select private.is_bookkeeping_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists bookkeeping_attachments_delete on storage.objects;
create policy bookkeeping_attachments_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'bookkeeping-attachments'
  and (select private.is_bookkeeping_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on table private.admin_users is 'Explicit allowlist for the Career Steps bookkeeping portal. Add users here only after creating their Supabase Auth accounts.';
comment on table public.attachments is 'Metadata only. File bytes are stored in the private bookkeeping-attachments bucket.';
