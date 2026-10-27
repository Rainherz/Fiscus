-- Per-department function aggregates for the app's "Categorías" screen.
-- public.function_summary groups by function only (nationwide), so it cannot be filtered by department.
-- Function labels are kept as published by MEF (old and new labels are not merged here).

create view public.department_function_summary
with (security_invoker = true) as
select
  department_code,
  function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
group by department_code, function;

grant select on public.department_function_summary to anon, authenticated;
