-- ============================================================
-- Bullion Desk — Supabase schema
-- Run this in Supabase → SQL Editor → New query
-- ============================================================

-- 1. Custom users table (extends auth.users)
create table if not exists public.users (
  id                uuid        references auth.users(id) on delete cascade primary key,
  email             text        not null,
  hashed_password   text        not null,
  hashed_access_code text       not null,
  trading_horizon   text        not null default 'daytrade'
                                check (trading_horizon in ('scalp', 'daytrade', 'swing')),
  created_at        timestamptz not null default now()
);

-- 2. AI analysis history
create table if not exists public.ai_analyses (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  created_at    timestamptz not null default now(),
  mode          text,
  analysis_mode text        default 'deep',
  decision      text,
  summary       text,
  trade_taken   boolean     -- null = not set, true = taken, false = ignored
);

-- 3. Row-level security
alter table public.users         enable row level security;
alter table public.ai_analyses   enable row level security;

-- users policies
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- ai_analyses policies
create policy "analyses_select_own" on public.ai_analyses
  for select using (auth.uid() = user_id);

create policy "analyses_insert_own" on public.ai_analyses
  for insert with check (auth.uid() = user_id);

create policy "analyses_update_own" on public.ai_analyses
  for update using (auth.uid() = user_id);

-- 4. Index for fast user lookup
create index if not exists ai_analyses_user_id_idx
  on public.ai_analyses (user_id, created_at desc);

-- ai_levels — persistent structural levels identified by the AI across sessions
create table if not exists public.ai_levels (
  id              uuid          default gen_random_uuid() primary key,
  user_id         uuid          not null references auth.users(id) on delete cascade,
  level_type      text          not null, -- 'ob_bullish', 'ob_bearish', 'fvg_bullish', 'fvg_bearish', 'resistance', 'support'
  price_low       float         not null,
  price_high      float         not null,
  timeframe       text,                   -- 'H1', 'H4', 'D1'
  identified_at   timestamptz   default now(),
  mitigated       boolean       default false,
  touch_count     int           default 0,
  notes           text
);

alter table public.ai_levels enable row level security;

create policy "ai_levels_select_own" on public.ai_levels
  for select using (auth.uid() = user_id);

create policy "ai_levels_insert_own" on public.ai_levels
  for insert with check (auth.uid() = user_id);

create policy "ai_levels_update_own" on public.ai_levels
  for update using (auth.uid() = user_id);

create index if not exists ai_levels_user_active_idx
  on public.ai_levels (user_id, mitigated, identified_at desc);
