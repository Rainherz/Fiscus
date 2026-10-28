-- Map insights: filters on the map and the list of the projects in view.
--
-- Filters (all optional, combined with AND), the same rules as the rest of the app:
--   only_increase   a positive cost increase on a valid updated cost ("Con aumento").
--   only_stalled    "Sin gasto reciente" (stalled_investments_by_level): ACTIVO, valid updated cost,
--                   spent 5 %-95 %, last accrual month strictly before the reference month
--                   (accrual_reference_month_all_levels) minus 12 months.
--   only_overspent  valid updated cost and accrued_total above it (execution_progress > 1,
--                   "Gastó más que su costo", as overspent_count).
-- Keep the rules in sync with apps/mobile/src/features/investments/domain/mapPoints.ts.
--
-- map_points gains the three filters with defaults: callers that send the original seven
-- arguments keep working. A second overload would make those calls ambiguous, so the function is
-- dropped and created again (in this transaction) with the same grants.

drop function public.map_points(double precision, double precision, double precision, double precision, int, text, int);

create function public.map_points(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  zoom int,
  level text default 'ALL',
  department int default null,
  only_increase boolean default false,
  only_stalled boolean default false,
  only_overspent boolean default false
)
returns table (
  kind                  text,
  cui                   text,
  name                  text,
  latitude              double precision,
  longitude             double precision,
  point_count           int,
  government_level      text,
  cost_increase         numeric,
  cost_increase_pct     numeric,
  updated_cost_valid    boolean,
  total_cost_increase   numeric,
  max_cost_increase_pct numeric,
  increased_count       int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  -- Individual projects from this zoom on, or whenever the view holds at most this many.
  points_min_zoom constant int := 13;
  max_points      constant int := 500;
  max_cells       constant int := 400;
  z               int := least(greatest(coalesce(zoom, 0), 0), 22);
  -- A quarter of a 256 px web-mercator tile: cells of about 64 px on screen.
  cell            double precision := 360.0 / power(2, z) / 4;
  inc             boolean := coalesce(only_increase, false);
  stl             boolean := coalesce(only_stalled, false);
  ovr             boolean := coalesce(only_overspent, false);
  -- Read only when the stalled filter is on (max() reads the end of an index).
  stalled_before  date;
  in_view         int;
begin
  if min_lat is null or min_lon is null or max_lat is null or max_lon is null then
    return;
  end if;
  if stl then
    select r.reference_month - interval '12 months' into stalled_before
    from public.accrual_reference_month_all_levels r;
  end if;

  select count(*) into in_view
  from (
    select 1
    from public.investments i
    where i.latitude is not null
      and i.latitude between min_lat and max_lat
      and i.longitude between min_lon and max_lon
      and (level = 'ALL' or i.government_level = level)
      and (department is null or i.department_code = department)
      and (not inc or (i.updated_cost_valid and i.cost_increase > 0))
      and (not stl or (i.status = 'ACTIVO' and i.updated_cost_valid
                       and i.execution_progress between 0.05 and 0.95
                       and i.last_accrual_month < stalled_before))
      and (not ovr or (i.updated_cost_valid and i.execution_progress > 1))
    limit max_points + 1
  ) limited;

  if z >= points_min_zoom or in_view <= max_points then
    return query
    select
      'point'::text,
      i.cui,
      i.name,
      i.latitude,
      i.longitude,
      1,
      i.government_level,
      i.cost_increase,
      i.cost_increase_pct,
      i.updated_cost_valid,
      null::numeric,
      null::numeric,
      null::int
    from public.investments i
    where i.latitude is not null
      and i.latitude between min_lat and max_lat
      and i.longitude between min_lon and max_lon
      and (level = 'ALL' or i.government_level = level)
      and (department is null or i.department_code = department)
      and (not inc or (i.updated_cost_valid and i.cost_increase > 0))
      and (not stl or (i.status = 'ACTIVO' and i.updated_cost_valid
                       and i.execution_progress between 0.05 and 0.95
                       and i.last_accrual_month < stalled_before))
      and (not ovr or (i.updated_cost_valid and i.execution_progress > 1))
    -- When more than max_points are in view, the largest increases come first.
    order by i.cost_increase desc nulls last, i.cui
    limit max_points;
    return;
  end if;

  return query
  select
    'cluster'::text,
    null::text,
    null::text,
    avg(i.latitude),
    avg(i.longitude),
    count(*)::int,
    null::text,
    null::numeric,
    null::numeric,
    null::boolean,
    coalesce(sum(i.cost_increase) filter (where i.updated_cost_valid and i.cost_increase > 0), 0),
    max(i.cost_increase_pct) filter (where i.updated_cost_valid),
    (count(*) filter (where i.updated_cost_valid and i.cost_increase > 0))::int
  from public.investments i
  where i.latitude is not null
    and i.latitude between min_lat and max_lat
    and i.longitude between min_lon and max_lon
    and (level = 'ALL' or i.government_level = level)
    and (department is null or i.department_code = department)
    and (not inc or (i.updated_cost_valid and i.cost_increase > 0))
    and (not stl or (i.status = 'ACTIVO' and i.updated_cost_valid
                     and i.execution_progress between 0.05 and 0.95
                     and i.last_accrual_month < stalled_before))
    and (not ovr or (i.updated_cost_valid and i.execution_progress > 1))
  group by floor(i.latitude / cell), floor(i.longitude / cell)
  order by count(*) desc
  limit max_cells;
end;
$$;

comment on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean) is
  'Map view: grid clusters (zoom < 13 and more than 500 matching projects in the box) or up to 500 projects. '
  'level: GN, GR, GL or ALL; department: null for all of Peru; only_increase, only_stalled, only_overspent '
  'combine with AND, and clusters count only the matching projects.';

revoke execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean) from public;
grant execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean) to anon, authenticated;

-- The list beside the map: a page of the projects in the box that match the filters, largest cost
-- increase first (nulls last), then largest updated cost, then CUI. total_count is the number of
-- matching projects in the box (the same on every row of a page; no rows past the last page).
create function public.map_list(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  level text default 'ALL',
  department int default null,
  only_increase boolean default false,
  only_stalled boolean default false,
  only_overspent boolean default false,
  page_limit int default 30,
  page_offset int default 0
)
returns table (
  cui                text,
  name               text,
  entity             text,
  government_level   text,
  status             text,
  latitude           double precision,
  longitude          double precision,
  updated_cost       numeric,
  updated_cost_valid boolean,
  accrued_total      numeric,
  cost_increase      numeric,
  cost_increase_pct  numeric,
  execution_progress numeric,
  spent_anomaly      boolean,
  physical_progress  numeric,
  last_accrual_month date,
  stalled            boolean,
  total_count        bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with reference as (
    select r.reference_month - interval '12 months' as stalled_before
    from public.accrual_reference_month_all_levels r
  ),
  in_view as (
    select
      i.*,
      coalesce(
        i.status = 'ACTIVO' and i.updated_cost_valid
        and i.execution_progress between 0.05 and 0.95
        and i.last_accrual_month < ref.stalled_before,
        false
      ) as is_stalled
    from public.investments i
    cross join reference ref
    where i.latitude is not null
      and i.latitude between min_lat and max_lat
      and i.longitude between min_lon and max_lon
      and (level = 'ALL' or i.government_level = level)
      and (department is null or i.department_code = department)
  )
  select
    v.cui,
    v.name,
    v.entity,
    v.government_level,
    v.status,
    v.latitude,
    v.longitude,
    v.updated_cost,
    v.updated_cost_valid,
    v.accrued_total,
    v.cost_increase,
    v.cost_increase_pct,
    v.execution_progress,
    v.spent_anomaly,
    v.physical_progress,
    v.last_accrual_month,
    v.is_stalled,
    count(*) over ()
  from in_view v
  where (not coalesce(only_increase, false) or (v.updated_cost_valid and v.cost_increase > 0))
    and (not coalesce(only_stalled, false) or v.is_stalled)
    and (not coalesce(only_overspent, false) or (v.updated_cost_valid and v.execution_progress > 1))
  order by v.cost_increase desc nulls last, v.updated_cost desc nulls last, v.cui
  limit least(greatest(coalesce(page_limit, 30), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

comment on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int) is
  'Projects with coordinates in the box that match the map filters, largest cost increase first; '
  'page_limit 1-100 (default 30), total_count = matching projects in the box.';

revoke execute on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int) from public;
grant execute on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int) to anon, authenticated;
