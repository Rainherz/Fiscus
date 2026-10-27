-- "Sin gasto reciente": active projects that spent between 5% and 95% of a valid updated cost and
-- have no accrual in the last 12 months of MEF data.
--
-- The 12 months are counted back from the reference month, the latest last_accrual_month in the
-- dataset, not from today: MEF publishes accruals with a delay, and counting from today would
-- inflate the list whenever the source lags. A project qualifies when its last accrual month is
-- strictly earlier than reference_month - 12 months (exactly 12 months before does not qualify).
--
-- Keep the rule in sync with apps/mobile/src/features/investments/domain/stalled.ts.

-- max(last_accrual_month) reads the end of this index instead of scanning the table.
create index investments_last_accrual_month_idx on public.investments (last_accrual_month);

create view public.accrual_reference_month
with (security_invoker = true) as
select max(last_accrual_month) as reference_month
from public.investments;

comment on view public.accrual_reference_month is
  'One row: the latest last_accrual_month in the dataset (first day of a month), the end of the data window.';

create view public.stalled_investments
with (security_invoker = true) as
with reference as (
  select reference_month from public.accrual_reference_month
)
select
  i.cui,
  i.name,
  i.entity,
  i.status,
  i.situation,
  i.function,
  i.functional_division,
  i.functional_group,
  i.beneficiaries,
  i.registered_at,
  i.viability_at,
  i.first_accrual_month,
  i.last_accrual_month,
  i.viable_amount,
  i.updated_cost,
  i.updated_cost_valid,
  i.accrued_total,
  i.cost_increase,
  i.cost_increase_pct,
  i.execution_progress,
  i.department_code,
  i.department_name,
  i.source_updated_at,
  i.spent_anomaly,
  r.reference_month,
  (
    (extract(year from r.reference_month) - extract(year from i.last_accrual_month)) * 12
    + extract(month from r.reference_month) - extract(month from i.last_accrual_month)
  )::int as months_without_accrual,
  i.updated_cost - i.accrued_total as pending_amount
from public.investments i
cross join reference r
where i.status = 'ACTIVO'
  and i.updated_cost_valid
  and i.execution_progress between 0.05 and 0.95
  and i.last_accrual_month < r.reference_month - interval '12 months';

comment on view public.stalled_investments is
  'Active investments that spent 5%-95% of a valid updated cost and have no accrual in the 12 months before accrual_reference_month.';
comment on column public.stalled_investments.months_without_accrual is
  'Whole months between last_accrual_month and reference_month (always more than 12 here).';
comment on column public.stalled_investments.pending_amount is
  'updated_cost - accrued_total: the part of the updated cost not yet accrued.';

grant select on public.accrual_reference_month, public.stalled_investments to anon, authenticated;
