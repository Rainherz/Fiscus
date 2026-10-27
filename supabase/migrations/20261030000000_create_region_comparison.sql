-- "Regiones": one row per department to compare the 25 regional governments.
--
-- Cost figures only use rows with a valid updated cost (updated_cost_valid), so MEF placeholder
-- and truncated costs do not distort them. total_viable_amount and total_updated_cost cover the
-- same valid rows, so they can be compared with each other.
--
-- total_cost_increase sums positive increases only: cost reductions are excluded, so a region with
-- large reductions does not hide its increases. cost_increase_pct divides that sum by the viable
-- amount of the same projects (those with an increase); it is null when there are none.
--
-- department_summary (20261026000000) is not used by the app and nets reductions against
-- increases. It is kept unchanged for existing API consumers; the app reads this view instead.
--
-- Grouped by department_code only: department_name can be null in some source rows, and grouping
-- by it would split a department in two. The name is the non-null value of the department.
--
-- Keep in sync with apps/mobile/src/features/investments/domain/regionComparison.ts (in-memory
-- adapter).

create view public.region_comparison
with (security_invoker = true) as
with stalled as (
  select
    department_code,
    count(*)            as stalled_count,
    sum(pending_amount) as stalled_pending_amount
  from public.stalled_investments
  group by department_code
),
regions as (
  select
    department_code,
    max(department_name)                                             as department_name,
    count(*)                                                         as project_count,
    count(*) filter (where status = 'ACTIVO')                        as active_count,
    count(*) filter (where updated_cost_valid)                       as valid_cost_count,
    sum(viable_amount) filter (where updated_cost_valid)             as total_viable_amount,
    sum(updated_cost) filter (where updated_cost_valid)              as total_updated_cost,
    coalesce(sum(cost_increase) filter (where updated_cost_valid and cost_increase > 0), 0)
                                                                     as total_cost_increase,
    count(*) filter (where updated_cost_valid and cost_increase > 0) as projects_with_increase,
    sum(viable_amount) filter (where updated_cost_valid and cost_increase > 0)
                                                                     as increased_viable_amount,
    count(*) filter (where updated_cost_valid and execution_progress > 1)
                                                                     as overspent_count
  from public.investments
  group by department_code
)
select
  r.department_code,
  r.department_name,
  r.project_count,
  r.active_count,
  r.valid_cost_count,
  r.total_viable_amount,
  r.total_updated_cost,
  r.total_cost_increase,
  r.projects_with_increase,
  r.total_cost_increase / nullif(r.increased_viable_amount, 0) * 100 as cost_increase_pct,
  r.overspent_count,
  coalesce(s.stalled_count, 0)                                       as stalled_count,
  coalesce(s.stalled_pending_amount, 0)                              as stalled_pending_amount
from regions r
left join stalled s using (department_code);

comment on view public.region_comparison is
  'One row per department: project counts and cost aggregates over valid updated costs, for comparing regions.';
comment on column public.region_comparison.total_cost_increase is
  'Sum of positive cost_increase over rows with a valid updated cost. Reductions are excluded. 0 when there are none.';
comment on column public.region_comparison.cost_increase_pct is
  'total_cost_increase / sum(viable_amount) of the same projects * 100 (0-100 scale). Null without increases.';
comment on column public.region_comparison.overspent_count is
  'Projects whose accrued total exceeds a valid updated cost (execution_progress > 1).';
comment on column public.region_comparison.stalled_count is
  'Rows of stalled_investments in the department ("Sin gasto reciente").';
comment on column public.region_comparison.stalled_pending_amount is
  'Sum of stalled_investments.pending_amount in the department. 0 when there are none.';
comment on view public.department_summary is
  'Legacy per-department summary (nets cost reductions against increases). The app uses region_comparison.';

grant select on public.region_comparison to anon, authenticated;
