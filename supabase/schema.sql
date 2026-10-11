-- VC Pipeline Intelligence — Supabase schema
-- Run once in Supabase SQL Editor (project dtbzdggwehqoghmcwnzm).
-- Design goal: the server key can write ONLY the 4 signal-derived columns on vcs.
-- Vikram's manual columns are protected by Postgres column privileges, not just app code.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 1. VCs — Vikram's pipeline table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.vcs (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  firm               text not null,
  role               text,
  thesis             text,
  focus_tags         text[] not null default '{}',
  location           text,
  firm_website       text,
  blog_rss           text,
  linkedin_url       text,

  -- MANUAL columns (Vikram-owned). The pipeline must NEVER write these.
  contact_status     text not null default 'yet_to_reach_out'
                     check (contact_status in ('yet_to_reach_out','waiting_for_response','in_conversation','passed')),
  last_contact_date  date,
  contact_history    text,
  personal_notes     text,

  -- SIGNAL-DERIVED columns. The ONLY columns the pipeline may update.
  last_signal_date   date,
  signal_summary     text,
  follow_up_score    integer check (follow_up_score between 0 and 100),
  recommended_action text,

  created_at         timestamptz not null default now(),
  unique (name, firm)
);

-- ─────────────────────────────────────────────────────────────
-- 2. Signals — raw evidence. Never deleted (60-day lookback for scoring,
--    full history kept).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.signals (
  id            uuid primary key default gen_random_uuid(),
  vc_id         uuid not null references public.vcs(id) on delete cascade,
  url           text not null,
  url_hash      text generated always as (md5(url)) stored,
  title         text,
  snippet       text,
  source        text not null check (source in ('google_news','gdelt','rss','firecrawl','linkedin','manual')),
  signal_type   text check (signal_type in ('blog_post','interview','investment','event','social_post','news_mention','other')),
  relevance     numeric(3,2) check (relevance between 0 and 1),
  is_about_vc   boolean,            -- Gemini entity check: is this really about this person/firm?
  summary       text,               -- Gemini one-liner
  published_at  timestamptz not null,
  discovered_at timestamptz not null default now(),
  classified_at timestamptz,
  unique (vc_id, url_hash)
);
create index if not exists signals_vc_published_idx on public.signals (vc_id, published_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3. Runs — audit log shown on the dashboard
-- ─────────────────────────────────────────────────────────────
create table if not exists public.runs (
  id                     uuid primary key default gen_random_uuid(),
  kind                   text not null check (kind in ('ingest','score','full')),
  trigger                text not null check (trigger in ('cron','manual')),
  started_at             timestamptz not null default now(),
  finished_at            timestamptz,
  status                 text not null default 'running' check (status in ('running','success','partial','failed')),
  vcs_processed          integer default 0,
  signals_new            integer default 0,
  errors                 jsonb not null default '[]'::jsonb,
  protected_check        jsonb      -- { before_hash, after_hash, unchanged: bool }
);

-- ─────────────────────────────────────────────────────────────
-- 4. Hard guarantee: column-level privileges
--    The app's server key (service_role) may INSERT rows (seed / CSV import)
--    but may UPDATE only the 4 signal columns.
-- ─────────────────────────────────────────────────────────────
revoke update on public.vcs from service_role, anon, authenticated;
grant  update (last_signal_date, signal_summary, follow_up_score, recommended_action)
       on public.vcs to service_role;

-- Lock the public API: RLS on, no anon/authenticated policies (dashboard reads server-side).
alter table public.vcs     enable row level security;
alter table public.signals enable row level security;
alter table public.runs    enable row level security;
revoke all on public.vcs, public.signals, public.runs from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. The only write path the pipeline uses for vcs
-- ─────────────────────────────────────────────────────────────
create or replace function public.update_vc_signals(
  p_vc_id              uuid,
  p_last_signal_date   date,
  p_signal_summary     text,
  p_follow_up_score    integer,
  p_recommended_action text
) returns void
language sql
security invoker
set search_path = public
as $$
  update public.vcs
     set last_signal_date   = p_last_signal_date,
         signal_summary     = p_signal_summary,
         follow_up_score    = p_follow_up_score,
         recommended_action = p_recommended_action
   where id = p_vc_id;
$$;
revoke execute on function public.update_vc_signals(uuid, date, text, integer, text) from public, anon, authenticated;
grant  execute on function public.update_vc_signals(uuid, date, text, integer, text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. Fingerprint of manual columns — used before/after each run to PROVE
--    nothing manual changed. Stored in runs.protected_check.
-- ─────────────────────────────────────────────────────────────
create or replace function public.manual_columns_fingerprint()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select md5(coalesce(string_agg(
           id::text || '|' || contact_status || '|' || coalesce(last_contact_date::text,'') || '|' ||
           coalesce(contact_history,'') || '|' || coalesce(personal_notes,''),
           ',' order by id), ''))
  from public.vcs;
$$;
revoke execute on function public.manual_columns_fingerprint() from public, anon, authenticated;
grant  execute on function public.manual_columns_fingerprint() to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. Firecrawl cache (72h, saves free-tier credits) + run progress/credits
-- ─────────────────────────────────────────────────────────────
create table if not exists public.search_cache (
  query       text primary key,
  fetched_at  timestamptz not null default now(),
  results     jsonb not null default '[]'::jsonb
);
alter table public.search_cache enable row level security;
revoke all on public.search_cache from anon, authenticated;

alter table public.runs add column if not exists firecrawl_credits integer not null default 0;
alter table public.runs add column if not exists vcs_total integer;
alter table public.runs add column if not exists stage text;

-- Sanity test you can run after seeding (should ERROR with "permission denied"):
--   set role service_role;
--   update public.vcs set personal_notes = 'x' where true;
--   reset role;
