-- Cost history. MEF only publishes the current cost of each investment, so history exists only
-- from the day we start recording it. Triggers on public.investments log one row per change of
-- viable_amount or updated_cost, so the ingest code does not need to know about history.

create table public.investment_cost_changes (
  id                     bigint generated always as identity primary key,
  cui                    text not null references public.investments (cui) on delete cascade,
  -- 'baseline': value present when recording started; 'first_seen': investment appeared later;
  -- 'changed': viable_amount or updated_cost differs from the previous ingest.
  change_kind            text not null check (change_kind in ('baseline', 'first_seen', 'changed')),
  observed_at            timestamptz not null default now(),
  source_updated_at      timestamptz,
  previous_viable_amount numeric,
  viable_amount          numeric,
  previous_updated_cost  numeric,
  updated_cost           numeric,
  accrued_total          numeric,
  updated_cost_delta     numeric generated always as (updated_cost - previous_updated_cost) stored
);

comment on table public.investment_cost_changes is
  'One row per observed change of viable_amount or updated_cost. Starts on 2026-10-27; earlier history is unknown.';
comment on column public.investment_cost_changes.source_updated_at is
  'Timestamp of the MEF report the value came from (investments.source_updated_at at that moment).';

create index investment_cost_changes_cui_observed_idx
  on public.investment_cost_changes (cui, observed_at desc);
create index investment_cost_changes_changed_idx
  on public.investment_cost_changes (observed_at desc)
  where change_kind = 'changed';

create function public.log_investment_cost_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.investment_cost_changes
      (cui, change_kind, source_updated_at, viable_amount, updated_cost, accrued_total)
    values
      (new.cui, 'first_seen', new.source_updated_at, new.viable_amount, new.updated_cost, new.accrued_total);
  else
    insert into public.investment_cost_changes
      (cui, change_kind, source_updated_at, previous_viable_amount, viable_amount,
       previous_updated_cost, updated_cost, accrued_total)
    values
      (new.cui, 'changed', new.source_updated_at, old.viable_amount, new.viable_amount,
       old.updated_cost, new.updated_cost, new.accrued_total);
  end if;
  return null;
end;
$$;

create trigger investments_log_cost_insert
  after insert on public.investments
  for each row execute function public.log_investment_cost_change();

-- The ingest upserts every row daily; only real changes are logged.
create trigger investments_log_cost_update
  after update of viable_amount, updated_cost on public.investments
  for each row
  when (old.viable_amount is distinct from new.viable_amount
        or old.updated_cost is distinct from new.updated_cost)
  execute function public.log_investment_cost_change();

-- Baseline: the values known when recording starts.
insert into public.investment_cost_changes
  (cui, change_kind, source_updated_at, viable_amount, updated_cost, accrued_total)
select cui, 'baseline', source_updated_at, viable_amount, updated_cost, accrued_total
from public.investments;

alter table public.investment_cost_changes enable row level security;

create policy "investment cost changes are publicly readable"
  on public.investment_cost_changes for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.investment_cost_changes from anon, authenticated;
grant select on public.investment_cost_changes to anon, authenticated;
revoke execute on function public.log_investment_cost_change() from public, anon, authenticated;
