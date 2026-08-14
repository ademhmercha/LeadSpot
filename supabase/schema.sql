-- ============================================================================
-- LeadSpot — Supabase (Postgres) schema
-- Run this in the Supabase SQL editor, or via `supabase db push` / migrations.
-- Idempotent : ré-exécutable sans danger.
-- ============================================================================

-- Extensions ------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- profiles — 1:1 with auth.users, created automatically on signup
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- leads — establishments discovered via Geoapify that have no real website
-- ============================================================================
-- Création idempotente de l'enum (Postgres n'a pas de CREATE TYPE IF NOT EXISTS).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type public.lead_status as enum (
      'nouveau',
      'contacte',
      'interesse',
      'converti',
      'pas_interesse'
    );
  end if;
end;
$$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- Geoapify place identity
  place_id text not null,
  name text not null,
  category text not null,
  address text,
  lat double precision,
  lon double precision,
  phone text,
  email text,
  siret text, -- French business registration number, when present in OSM data
  website text, -- null, or a facebook.com/instagram.com only link

  -- search context this lead was found under (used for cache key + rescans)
  search_category text not null,
  search_zone text not null, -- free-form label (city name or "lat,lon")
  search_radius_km numeric not null,

  status public.lead_status not null default 'nouveau',
  notes text,
  email_opened_at timestamptz, -- première ouverture d'un email de prospection (suivi)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, place_id)
);

create index if not exists leads_user_id_idx on public.leads (user_id);
create index if not exists leads_status_idx on public.leads (user_id, status);
create index if not exists leads_search_idx on public.leads (user_id, search_category, search_zone);

-- Safe to re-run against a database created before these columns existed: a
-- no-op on fresh installs (already in the CREATE TABLE above).
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists siret text;
alter table public.leads add column if not exists email_opened_at timestamptz;

alter table public.leads enable row level security;

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads
  for select using (auth.uid() = user_id);

drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads
  for insert with check (auth.uid() = user_id);

drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads
  for update using (auth.uid() = user_id);

drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- saved_zones — zones a user wants to be re-scanned weekly (alerts)
-- ============================================================================
create table if not exists public.saved_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  zone_label text not null,   -- e.g. "Lyon" or "Lyon (45.75,4.85)"
  lat double precision not null,
  lon double precision not null,
  radius_km numeric not null,
  alerts_enabled boolean not null default true,
  last_scanned_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists saved_zones_user_id_idx on public.saved_zones (user_id);
create index if not exists saved_zones_alerts_idx on public.saved_zones (alerts_enabled);

alter table public.saved_zones enable row level security;

drop policy if exists "saved_zones_select_own" on public.saved_zones;
create policy "saved_zones_select_own" on public.saved_zones
  for select using (auth.uid() = user_id);

drop policy if exists "saved_zones_insert_own" on public.saved_zones;
create policy "saved_zones_insert_own" on public.saved_zones
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_zones_update_own" on public.saved_zones;
create policy "saved_zones_update_own" on public.saved_zones
  for update using (auth.uid() = user_id);

drop policy if exists "saved_zones_delete_own" on public.saved_zones;
create policy "saved_zones_delete_own" on public.saved_zones
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- message_templates — modèles de messages réutilisables (email / WhatsApp)
-- ============================================================================
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  subject text, -- objet, canal email uniquement
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_templates_user_id_idx on public.message_templates (user_id);

alter table public.message_templates enable row level security;

drop policy if exists "message_templates_select_own" on public.message_templates;
create policy "message_templates_select_own" on public.message_templates
  for select using (auth.uid() = user_id);

drop policy if exists "message_templates_insert_own" on public.message_templates;
create policy "message_templates_insert_own" on public.message_templates
  for insert with check (auth.uid() = user_id);

drop policy if exists "message_templates_update_own" on public.message_templates;
create policy "message_templates_update_own" on public.message_templates
  for update using (auth.uid() = user_id);

drop policy if exists "message_templates_delete_own" on public.message_templates;
create policy "message_templates_delete_own" on public.message_templates
  for delete using (auth.uid() = user_id);

drop trigger if exists message_templates_set_updated_at on public.message_templates;
create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute procedure public.set_updated_at();

-- ============================================================================
-- usage — one row per user per calendar month, counts searches
-- ============================================================================
create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  search_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

alter table public.usage enable row level security;

drop policy if exists "usage_select_own" on public.usage;
create policy "usage_select_own" on public.usage
  for select using (auth.uid() = user_id);

-- Inserts/updates to usage are done via the service-role key from API routes
-- only (server-side quota enforcement), so no insert/update policy is granted
-- to authenticated users here.

-- Atomically increment (or create) the usage counter for a user/period and
-- return the new count. Called from the server with the service role key.
create or replace function public.increment_usage(p_user_id uuid, p_period text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.usage (user_id, period, search_count)
  values (p_user_id, p_period, 1)
  on conflict (user_id, period)
  do update set search_count = public.usage.search_count + 1,
                updated_at = now()
  returning search_count into v_count;

  return v_count;
end;
$$;

-- ============================================================================
-- keepalive_pings — trivial table hit by /api/keepalive to keep the Supabase
-- free-tier project from being auto-paused after ~7 days of inactivity.
-- ============================================================================
create table if not exists public.keepalive_pings (
  id boolean primary key default true,
  pinged_at timestamptz not null default now(),
  constraint keepalive_singleton check (id)
);

insert into public.keepalive_pings (id, pinged_at)
values (true, now())
on conflict (id) do update set pinged_at = excluded.pinged_at;

-- ============================================================================
-- push_subscriptions — abonnements Web Push (notifications des zones suivies)
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- lead_events — historique d'activité d'un lead (créé, message envoyé, email
-- ouvert, statut modifié, doublon fusionné)
-- ============================================================================
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null check (type in ('created', 'status_changed', 'sent', 'opened', 'merged')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_events_lead_id_idx on public.lead_events (lead_id);
create index if not exists lead_events_user_id_idx on public.lead_events (user_id);

alter table public.lead_events enable row level security;

drop policy if exists "lead_events_select_own" on public.lead_events;
create policy "lead_events_select_own" on public.lead_events
  for select using (auth.uid() = user_id);

drop policy if exists "lead_events_insert_own" on public.lead_events;
create policy "lead_events_insert_own" on public.lead_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "lead_events_delete_own" on public.lead_events;
create policy "lead_events_delete_own" on public.lead_events
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- audits — lien d'audit partageable (public) généré pour un lead. L'id uuid du
-- lien tient lieu de token non devinable : la page /audit/<id> est publique.
-- ============================================================================
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lead_id)
);

create index if not exists audits_user_id_idx on public.audits (user_id);

alter table public.audits enable row level security;

drop policy if exists "audits_select_own" on public.audits;
create policy "audits_select_own" on public.audits
  for select using (auth.uid() = user_id);

drop policy if exists "audits_insert_own" on public.audits;
create policy "audits_insert_own" on public.audits
  for insert with check (auth.uid() = user_id);

drop policy if exists "audits_delete_own" on public.audits;
create policy "audits_delete_own" on public.audits
  for delete using (auth.uid() = user_id);
