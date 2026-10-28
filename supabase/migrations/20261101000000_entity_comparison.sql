-- App phase of the open data (20261031000000): the app filters by government level, ranks
-- entities (ministries, regional governments, municipalities), and needs the end of the data
-- window over every level.

-- The end of the data window over every level, the same reference month that
-- stalled_investments_by_level uses. accrual_reference_month stays regional-only. max() reads the
-- end of investments_last_accrual_month_idx.
create view public.accrual_reference_month_all_levels
with (security_invoker = true) as
select max(last_accrual_month) as reference_month
from public.investments;

comment on view public.accrual_reference_month_all_levels is
  'One row: the latest last_accrual_month of every government level (first day of a month), as used by stalled_investments_by_level.';

-- One row per entity and government level in every scope:
--   scope_department_code = 0     all of Peru: every project of the entity, including projects
--                                 without department (multi-department national investments).
--                                 department_code is the entity's department when all of its
--                                 projects are in one department, else null.
--   scope_department_code = 1-25  only the entity's projects in that department (department_code
--                                 is the same code), so a ministry is listed in every region where
--                                 it has projects.
-- Figures follow region_comparison_by_level: cost figures over valid updated costs, increases
-- counted only when positive (reductions are not netted), stalled figures from
-- stalled_investments_by_level. Rows without entity are left out.
-- Two UNION ALL branches instead of grouping sets, so a filter on scope_department_code prunes the
-- other branch and a department filter reaches investments_department_level_idx below the aggregate.
create view public.entity_comparison
with (security_invoker = true) as
with stalled as (
  select
    entity,
    government_level,
    0                   as scope_department_code,
    count(*)            as stalled_count,
    sum(pending_amount) as stalled_pending_amount
  from public.stalled_investments_by_level
  where entity is not null
  group by entity, government_level
  union all
  select
    entity,
    government_level,
    department_code,
    count(*),
    sum(pending_amount)
  from public.stalled_investments_by_level
  where entity is not null
    and department_code is not null
  group by entity, government_level, department_code
),
entities as (
  select
    entity,
    government_level,
    0                                                                as scope_department_code,
    case when count(department_code) = count(*) and min(department_code) = max(department_code)
         then min(department_code) end                               as department_code,
    case when count(department_code) = count(*) and min(department_code) = max(department_code)
         then max(department_name) end                               as department_name,
    count(*)                                                         as project_count,
    count(*) filter (where updated_cost_valid)                       as valid_cost_count,
    sum(updated_cost) filter (where updated_cost_valid)              as total_updated_cost,
    coalesce(sum(cost_increase) filter (where updated_cost_valid and cost_increase > 0), 0)
                                                                     as total_cost_increase,
    count(*) filter (where updated_cost_valid and cost_increase > 0) as projects_with_increase,
    sum(viable_amount) filter (where updated_cost_valid and cost_increase > 0)
                                                                     as increased_viable_amount,
    count(*) filter (where updated_cost_valid and execution_progress > 1)
                                                                     as overspent_count
  from public.investments
  where entity is not null
  group by entity, government_level
  union all
  select
    entity,
    government_level,
    department_code,
    department_code,
    max(department_name),
    count(*),
    count(*) filter (where updated_cost_valid),
    sum(updated_cost) filter (where updated_cost_valid),
    coalesce(sum(cost_increase) filter (where updated_cost_valid and cost_increase > 0), 0),
    count(*) filter (where updated_cost_valid and cost_increase > 0),
    sum(viable_amount) filter (where updated_cost_valid and cost_increase > 0),
    count(*) filter (where updated_cost_valid and execution_progress > 1)
  from public.investments
  where entity is not null
    and department_code is not null
  group by entity, government_level, department_code
)
select
  e.entity,
  e.government_level,
  e.scope_department_code,
  e.department_code,
  e.department_name,
  e.project_count,
  e.valid_cost_count,
  e.total_updated_cost,
  e.total_cost_increase,
  e.projects_with_increase,
  e.increased_viable_amount,
  e.total_cost_increase / nullif(e.increased_viable_amount, 0) * 100 as cost_increase_pct,
  e.overspent_count,
  coalesce(s.stalled_count, 0)                                       as stalled_count,
  coalesce(s.stalled_pending_amount, 0)                              as stalled_pending_amount
from entities e
left join stalled s using (entity, government_level, scope_department_code);

comment on view public.entity_comparison is
  'Per entity and government level: project counts, cost increases (positive only, valid costs), overspent and stalled figures. scope_department_code 0 = all of Peru (department_code set only when the entity works in one department), 1-25 = only the projects in that department.';

grant select on public.accrual_reference_month_all_levels, public.entity_comparison to anon, authenticated;

-- The table grows from about 27.5k (GR) to about 165k rows with GN and GL. The percentage ranking
-- ("Mayor aumento (%)") orders by cost_increase_pct; without an index every page sorted the
-- whole filtered table.
create index investments_cost_increase_pct_idx on public.investments (cost_increase_pct desc nulls last);
