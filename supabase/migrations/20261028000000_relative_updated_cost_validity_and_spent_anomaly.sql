-- The S/ 1,000 floor (20261027000000) still lets through truncated MEF updated costs such as
-- S/ 4,558.66 for a project with a S/ 1,990,720 viable amount, which yields a 31,206% "spent"
-- ratio. An updated cost is now also invalid when it is below 1% of a positive viable amount.
-- When viable_amount is null or not positive only the absolute floor applies.
--
-- Projects whose cost is coherent with the viable amount but whose accrued total is far above it
-- (e.g. CUI 2057689: S/ 18.7M accrued against S/ 299,700) stay valid: the anomaly is in the
-- accrued figure, so it is flagged with spent_anomaly instead of being hidden.
--
-- Keep the rule in sync with packages/ingest/src/domain/metrics.ts (MIN_VALID_UPDATED_COST,
-- MIN_UPDATED_COST_RATIO) and apps/mobile. Generated columns cannot reference other generated
-- columns, so the validity condition is repeated in every expression. SET EXPRESSION
-- (Postgres 17) works on any stored generated column, including the boolean flag; the summary
-- views only reference these columns by name, so they need no recreation, and the new column
-- inherits the table's RLS policy and select grants.

alter table public.investments
  alter column updated_cost_valid set expression as (
    updated_cost is not null
    and updated_cost >= 1000
    and (viable_amount is null or viable_amount <= 0 or updated_cost >= viable_amount * 0.01)
  );

alter table public.investments
  alter column cost_increase set expression as (
    case
      when updated_cost >= 1000
        and (viable_amount is null or viable_amount <= 0 or updated_cost >= viable_amount * 0.01)
      then updated_cost - viable_amount
    end
  );

alter table public.investments
  alter column cost_increase_pct set expression as (
    case
      when updated_cost >= 1000
        and (viable_amount is null or viable_amount <= 0 or updated_cost >= viable_amount * 0.01)
      then (updated_cost - viable_amount) / nullif(viable_amount, 0) * 100
    end
  );

alter table public.investments
  alter column execution_progress set expression as (
    case
      when updated_cost >= 1000
        and (viable_amount is null or viable_amount <= 0 or updated_cost >= viable_amount * 0.01)
      then accrued_total / updated_cost
    end
  );

alter table public.investments
  add column spent_anomaly boolean not null generated always as (
    coalesce(
      case
        when updated_cost >= 1000
          and (viable_amount is null or viable_amount <= 0 or updated_cost >= viable_amount * 0.01)
        then accrued_total / updated_cost > 10
      end,
      false
    )
  ) stored;

comment on column public.investments.updated_cost_valid is
  'False when updated_cost is null, below S/ 1,000, or below 1% of a positive viable_amount (MEF placeholder or truncated values). Derived metrics are null then.';
comment on column public.investments.spent_anomaly is
  'True when execution_progress > 10, i.e. accrued_total is more than 10 times a valid updated_cost (unusual figure in the MEF source). False when execution_progress is null.';
