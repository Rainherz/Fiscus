-- Map of investments with coordinates (open data; ~77% of rows). One call per map view:
-- grid clusters when zoomed out, individual projects when zoomed in or when few are in view.
--
-- Rows have one shape; `kind` says which columns apply:
--   'point'   cui, name, government_level, cost_increase, cost_increase_pct, updated_cost_valid;
--             point_count = 1.
--   'cluster' point_count, total_cost_increase (sum of positive valid increases),
--             max_cost_increase_pct (largest valid percentage), increased_count; the per-project
--             columns are null. latitude/longitude are the centroid of the cell's projects.
-- The bbox filter matches investments_coordinates_idx (partial, latitude is not null).

create function public.map_points(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  zoom int,
  level text default 'ALL',
  department int default null
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
  in_view         int;
begin
  if min_lat is null or min_lon is null or max_lat is null or max_lon is null then
    return;
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
  group by floor(i.latitude / cell), floor(i.longitude / cell)
  order by count(*) desc
  limit max_cells;
end;
$$;

comment on function public.map_points(double precision, double precision, double precision, double precision, int, text, int) is
  'Map view: grid clusters (zoom < 13 and more than 500 projects in the box) or up to 500 projects. '
  'level: GN, GR, GL or ALL; department: null for all of Peru.';

revoke execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int) from public;
grant execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int) to anon, authenticated;
