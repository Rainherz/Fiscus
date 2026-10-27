-- MEF publishes placeholder updated costs (S/ 1, 3, 5, 10...) for some projects. Dividing by them
-- yields absurd execution ratios and huge negative cost increases, so any updated_cost below
-- S/ 1,000 is treated as invalid: the derived metrics become null and updated_cost_valid lets
-- clients tell "invalid in the source" (updated_cost present, flag false) from "no data"
-- (updated_cost null).
--
-- Keep the threshold in sync with packages/ingest/src/domain/metrics.ts.
-- SET EXPRESSION (Postgres 17) rewrites the table and its indexes; the summary views only
-- reference the columns, so they keep working and now ignore invalid rows in sum/avg.

alter table public.investments
  add column updated_cost_valid boolean generated always as (
    updated_cost is not null and updated_cost >= 1000
  ) stored;

alter table public.investments
  alter column cost_increase set expression as (
    case when updated_cost >= 1000 then updated_cost - viable_amount end
  );

alter table public.investments
  alter column cost_increase_pct set expression as (
    case when updated_cost >= 1000
      then (updated_cost - viable_amount) / nullif(viable_amount, 0) * 100
    end
  );

alter table public.investments
  alter column execution_progress set expression as (
    case when updated_cost >= 1000 then accrued_total / updated_cost end
  );

comment on column public.investments.updated_cost_valid is
  'False when updated_cost is null or below S/ 1,000 (MEF placeholder values). Derived metrics are null then.';
comment on column public.investments.cost_increase is
  'updated_cost - viable_amount; null when updated_cost is invalid (see updated_cost_valid).';
comment on column public.investments.cost_increase_pct is
  'Cost increase as a percentage (0-100 scale) of viable_amount; null when updated_cost is invalid.';
comment on column public.investments.execution_progress is
  'accrued_total / updated_cost as a ratio (share of the updated cost already accrued, not physical progress; may exceed 1). Null when updated_cost is invalid.';
