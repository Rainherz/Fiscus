-- Fiscus: public investment projects of Peruvian regional governments (source: MEF SSI report).
-- Read-only for the public (anon/authenticated). Writes happen only through the service role,
-- which bypasses RLS.

create table public.investments (
  cui                      text primary key,
  snip_code                text,
  name                     text,
  government_level         text,
  sector                   text,
  entity                   text,
  status                   text,
  situation                text,
  beneficiaries            bigint,
  registered_at            date,
  viability_at             date,
  investment_type          text,
  function                 text,
  functional_division      text,
  functional_group         text,
  framework                text,
  viable_amount            numeric,
  pim                      numeric,
  -- Year parsed from the "PIM yyyy" header. Unverified: the source labels it 2023 in 2026 reports.
  pim_year                 int,
  accrued_year             numeric,
  first_accrual_month      date, -- first day of the month
  last_accrual_month       date, -- first day of the month
  accrued_total            numeric,
  updated_cost             numeric,
  dispute_cost             numeric,
  guarantee_amount         numeric,
  concurrent_control_cost  numeric,
  department_code          int not null check (department_code between 1 and 25),
  department_name          text,
  source_updated_at        timestamptz,
  ingested_at              timestamptz not null default now(),

  -- Derived metrics (mirror packages/ingest/src/domain/metrics.ts). Null-safe by construction.
  cost_increase            numeric generated always as (updated_cost - viable_amount) stored,
  cost_increase_pct        numeric generated always as (
                             (updated_cost - viable_amount) / nullif(viable_amount, 0) * 100
                           ) stored,
  execution_progress       numeric generated always as (
                             accrued_total / nullif(updated_cost, 0)
                           ) stored
);

comment on column public.investments.cost_increase_pct is 'Cost increase as a percentage (0-100 scale) of viable_amount.';
comment on column public.investments.execution_progress is 'accrued_total / updated_cost as a ratio (1 = fully accrued; may exceed 1).';

create index investments_department_code_idx on public.investments (department_code);
create index investments_function_idx on public.investments (function);
create index investments_updated_cost_idx on public.investments (updated_cost desc nulls last);
create index investments_cost_increase_idx on public.investments (cost_increase desc nulls last);
create index investments_viability_at_idx on public.investments (viability_at);

-- Upserts (on conflict do update) keep column defaults untouched; refresh ingested_at explicitly.
create function public.touch_ingested_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ingested_at := now();
  return new;
end;
$$;

create trigger investments_touch_ingested_at
  before update on public.investments
  for each row execute function public.touch_ingested_at();

create table public.ingest_runs (
  id                  bigint generated always as identity primary key,
  started_at          timestamptz not null,
  finished_at         timestamptz not null,
  departments_ok      int[] not null default '{}',
  departments_failed  int[] not null default '{}',
  rows_upserted       int not null default 0,
  rows_skipped        int not null default 0 -- rows without CUI
);

create index ingest_runs_started_at_idx on public.ingest_runs (started_at desc);

-- Row Level Security: public read, no public writes.
alter table public.investments enable row level security;
alter table public.ingest_runs enable row level security;

create policy "investments are publicly readable"
  on public.investments for select
  to anon, authenticated
  using (true);

create policy "ingest runs are publicly readable"
  on public.ingest_runs for select
  to anon, authenticated
  using (true);

-- Defense in depth on top of RLS: strip write privileges from the public roles.
revoke insert, update, delete, truncate on public.investments from anon, authenticated;
revoke insert, update, delete, truncate on public.ingest_runs from anon, authenticated;
grant select on public.investments, public.ingest_runs to anon, authenticated;

-- Aggregates. security_invoker makes the views respect the caller's RLS.
create view public.department_summary
with (security_invoker = true) as
select
  department_code,
  department_name,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
group by department_code, department_name;

create view public.function_summary
with (security_invoker = true) as
select
  function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
group by function;

grant select on public.department_summary, public.function_summary to anon, authenticated;
