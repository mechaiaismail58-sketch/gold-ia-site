-- trade_outcomes: structured outcome data for learning what works
-- Run this migration once in Supabase SQL editor

create table if not exists trade_outcomes (
  id                uuid primary key default gen_random_uuid(),
  trade_id          uuid references trades(id) on delete cascade,
  user_id           uuid references users(id) on delete cascade,

  setup_type        text check (setup_type in (
                      'ict_ob_retest','ict_fvg_fill','wyckoff_spring','wyckoff_upthrust',
                      'sweep_reversal','bos_retest','continuation_fvg',
                      'continuation_displacement','crt_reversal','amd_distribution',
                      'breaker_block','other'
                    )),
  session           text check (session in (
                      'asia','london','london_ny_overlap','ny','overnight'
                    )),
  confluence_score  integer,
  direction         text check (direction in ('long','short')),
  result            text check (result in ('tp1','tp2','sl','breakeven','manual_close')),
  points_pnl        numeric,
  r_multiple        numeric,
  key_drivers       text[],
  failure_reason    text,
  success_reason    text,
  chart_attached    boolean default false,

  created_at        timestamptz default now()
);

-- Index for aggregation queries
create index if not exists trade_outcomes_user_id_idx on trade_outcomes(user_id);
create index if not exists trade_outcomes_setup_type_idx on trade_outcomes(setup_type);
create index if not exists trade_outcomes_session_idx on trade_outcomes(session);

-- RLS
alter table trade_outcomes enable row level security;

create policy "Users read own outcomes"
  on trade_outcomes for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on trade_outcomes for all
  using (true)
  with check (true);
