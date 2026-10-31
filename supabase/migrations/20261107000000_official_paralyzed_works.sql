-- Official paralyzed works: the quarterly "Informe de obras paralizadas en el territorio nacional" of
-- the Contraloría General de la República (Anexo N° 01, one row per obra registered in INFOBRAS).
-- Unlike "Sin gasto reciente" (a rule of Fiscus over MEF accruals), this is the Contraloría's own
-- list. Every edition is kept (about 2,300 rows a quarter); the app reads the latest one.
--
-- Ingest: packages/ingest (pnpm ingest:paralyzed), weekly from .github/workflows/paralyzed-works-ingest.yml.
-- The source has no personal names; the ingest keeps only the columns below.

create table public.official_paralyzed_works (
  -- Cut-off of the edition (last day of the month in its title, "a junio de 2026" -> 2026-06-30).
  edition_cutoff               date not null,
  -- Publication date of the edition on gob.pe.
  published_at                 date,
  -- CODIGO INFOBRAS: the obra in INFOBRAS (the ObraId of its public ficha).
  infobras_code                int  not null check (infobras_code > 0),
  -- Investment code (CUI); null when the source leaves it blank (0). Several obras can share one CUI.
  cui                          text check (cui ~ '^\d{1,12}$'),
  snip                         text check (snip ~ '^\d{1,12}$'),
  investment_description       text,
  obra_description             text,
  entity                       text,
  government_level             text check (government_level in ('GN', 'GR', 'GL')),
  sector                       text,
  department_code              int  check (department_code between 1 and 25),
  department                   text,
  province                     text,
  district                     text,
  -- EVENTO: Proceso Normal, Reconstrucción con Cambios, ...
  event                        text,
  modality                     text,
  -- TIPO DE OBRA (first level).
  work_type                    text,
  -- CAUSAL PARALIZACION, split into its leading number and its text ("2 INCUMPLIMIENTO DE CONTRATO").
  causal_code                  int,
  causal_label                 text,
  -- AVANCE FÍSICO, 0-100 as published.
  physical_progress            numeric,
  -- COSTO DE OBRA SEGÚN EXP. TEC. (INFOBRAS), soles.
  expediente_cost              numeric,
  -- SALDO DE OBRA: obra cost minus the valued progress, soles.
  remaining_work_balance       numeric,
  -- COSTO ACTUALIZADO and SALDO DE LA INVERSIÓN according to Invierte.pe, soles.
  updated_cost                 numeric,
  investment_balance           numeric,
  start_year                   int  check (start_year between 1900 and 2100),
  -- PLAZO DE EJECUCIÓN, in days (the source publishes a term, not a date).
  execution_days               int  check (execution_days >= 0),
  -- In the MEF inventory of paralyzed works, and when it was registered there.
  mef_inventory                boolean,
  mef_inventory_registered_at  date,
  -- Situational report filed with the MEF: its date and PDF.
  situational_report_at        date,
  mef_report_url               text check (mef_report_url ~ '^https?://'),
  -- In the prioritized list for reactivation, with its resolution.
  prioritized                  boolean,
  prioritized_resolution_at    date,
  prioritized_resolution_url   text check (prioritized_resolution_url ~ '^https?://'),
  ingested_at                  timestamptz not null default now(),
  primary key (edition_cutoff, infobras_code)
);

comment on table public.official_paralyzed_works is
  'Contraloría General de la República, Informe de obras paralizadas (Anexo N° 01), one row per obra and edition.';

create index official_paralyzed_works_cui_idx on public.official_paralyzed_works (cui, edition_cutoff);

alter table public.official_paralyzed_works enable row level security;

create policy "official paralyzed works are publicly readable"
  on public.official_paralyzed_works for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.official_paralyzed_works from anon, authenticated;
grant select on public.official_paralyzed_works to anon, authenticated;

-- The latest edition only.
create view public.latest_paralyzed_works
with (security_invoker = true) as
select w.*
from public.official_paralyzed_works w
where w.edition_cutoff = (select max(edition_cutoff) from public.official_paralyzed_works);

comment on view public.latest_paralyzed_works is
  'official_paralyzed_works of the latest edition (largest edition_cutoff).';

-- Latest edition per CUI (obras without a CUI are left out). The main causal is the one of the obra
-- with the largest remaining balance; causal_labels lists every distinct causal of the CUI.
create view public.paralyzed_by_cui
with (security_invoker = true) as
select
  w.cui,
  max(w.edition_cutoff)                                                     as edition_cutoff,
  max(w.published_at)                                                       as published_at,
  count(*)::int                                                             as obra_count,
  (array_agg(w.causal_code order by w.remaining_work_balance desc nulls last, w.infobras_code))[1]
                                                                            as main_causal_code,
  (array_agg(w.causal_label order by w.remaining_work_balance desc nulls last, w.infobras_code))[1]
                                                                            as main_causal_label,
  array_agg(distinct w.causal_label) filter (where w.causal_label is not null)
                                                                            as causal_labels,
  max(w.causal_code)                                                        as max_causal_code,
  min(w.physical_progress)                                                  as min_physical_progress,
  max(w.physical_progress)                                                  as max_physical_progress,
  sum(w.remaining_work_balance)                                             as total_remaining_work_balance,
  sum(w.expediente_cost)                                                    as total_expediente_cost,
  bool_or(coalesce(w.mef_inventory, false))                                 as mef_inventory,
  array_agg(w.infobras_code order by w.infobras_code)                       as infobras_codes
from public.latest_paralyzed_works w
where w.cui is not null
group by w.cui;

comment on view public.paralyzed_by_cui is
  'Latest Contraloría edition aggregated per CUI: obra count, main causal (obra with the largest remaining balance), progress range, total remaining balance, INFOBRAS codes.';

-- paralyzed_by_cui joined with the investments Fiscus has, for the ranking and the home block: the
-- scope (department, level) and the status filter apply to the investment, like every other list.
create view public.paralyzed_investments
with (security_invoker = true) as
select
  p.*,
  i.name,
  i.entity,
  i.department_code,
  i.government_level,
  i.status,
  i.updated_cost,
  i.updated_cost_valid
from public.paralyzed_by_cui p
join public.investments i on i.cui = p.cui;

comment on view public.paralyzed_investments is
  'paralyzed_by_cui with the investment it belongs to (name, entity, department, level, status).';

grant select on public.latest_paralyzed_works, public.paralyzed_by_cui, public.paralyzed_investments
  to anon, authenticated;

-- source_snapshots: the Contraloría source ('contraloria_obras_paralizadas') is identified by its
-- edition, not by HTTP headers: the URL of the Anexo N° 01 file and the edition cut-off.
alter table public.source_snapshots
  add column edition_cutoff date,
  add column edition_url    text;

comment on column public.source_snapshots.edition_cutoff is
  'Editioned sources (contraloria_obras_paralizadas): cut-off of the last ingested edition.';
comment on column public.source_snapshots.edition_url is
  'Editioned sources (contraloria_obras_paralizadas): URL of the last ingested file; an unchanged URL skips the ingest.';

-- data_freshness gains edition_cutoff (null for every other source). Appended last, as create or
-- replace view requires. The weekly paralyzed-works run is judged by last_checked_at; the edition
-- age is quarterly by design and only shown in the app.
create or replace view public.data_freshness
with (security_invoker = true) as
select
  'ssi'::text as source,
  (select max(finished_at) from public.ingest_runs where cardinality(departments_ok) > 0) as last_success_at,
  (select max(finished_at) from public.ingest_runs)                                        as last_checked_at,
  null::date                                                                               as edition_cutoff
union all
select
  source,
  ingested_at as last_success_at,
  checked_at  as last_checked_at,
  edition_cutoff
from public.source_snapshots;

-- Map: map_points and map_list gain only_paralyzed (default false, so callers that do not send it
-- keep their results) and return whether each project is in the latest Contraloría edition
-- (paralyzed). Dropped and created again, like 20261106000000.

drop function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean, text);

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
  only_overspent boolean default false,
  status_filter text default 'ALL',
  only_paralyzed boolean default false
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
  increased_count       int,
  status                text,
  paralyzed             boolean
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
  par             boolean := coalesce(only_paralyzed, false);
  -- 'ALL' (or null, or an unknown value) keeps every status.
  st              text := coalesce(status_filter, 'ALL');
  -- Read only when the stalled filter is on (max() reads the end of an index).
  stalled_before  date;
  in_view         int;
begin
  if min_lat is null or min_lon is null or max_lat is null or max_lon is null then
    return;
  end if;
  if st not in ('ACTIVE', 'CLOSED') then
    st := 'ALL';
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
      and (st = 'ALL' or public.status_group(i.status) = st)
      and (not inc or (i.updated_cost_valid and i.cost_increase > 0))
      and (not stl or (i.status = 'ACTIVO' and i.updated_cost_valid
                       and i.execution_progress between 0.05 and 0.95
                       and i.last_accrual_month < stalled_before))
      and (not ovr or (i.updated_cost_valid and i.execution_progress > 1))
      and (not par or exists (select 1 from public.latest_paralyzed_works p where p.cui = i.cui))
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
      null::int,
      i.status,
      exists (select 1 from public.latest_paralyzed_works p where p.cui = i.cui)
    from public.investments i
    where i.latitude is not null
      and i.latitude between min_lat and max_lat
      and i.longitude between min_lon and max_lon
      and (level = 'ALL' or i.government_level = level)
      and (department is null or i.department_code = department)
      and (st = 'ALL' or public.status_group(i.status) = st)
      and (not inc or (i.updated_cost_valid and i.cost_increase > 0))
      and (not stl or (i.status = 'ACTIVO' and i.updated_cost_valid
                       and i.execution_progress between 0.05 and 0.95
                       and i.last_accrual_month < stalled_before))
      and (not ovr or (i.updated_cost_valid and i.execution_progress > 1))
      and (not par or exists (select 1 from public.latest_paralyzed_works p where p.cui = i.cui))
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
    (count(*) filter (where i.updated_cost_valid and i.cost_increase > 0))::int,
    null::text,
    null::boolean
  from public.investments i
  where i.latitude is not null
    and i.latitude between min_lat and max_lat
    and i.longitude between min_lon and max_lon
    and (level = 'ALL' or i.government_level = level)
    and (department is null or i.department_code = department)
    and (st = 'ALL' or public.status_group(i.status) = st)
    and (not inc or (i.updated_cost_valid and i.cost_increase > 0))
    and (not stl or (i.status = 'ACTIVO' and i.updated_cost_valid
                     and i.execution_progress between 0.05 and 0.95
                     and i.last_accrual_month < stalled_before))
    and (not ovr or (i.updated_cost_valid and i.execution_progress > 1))
    and (not par or exists (select 1 from public.latest_paralyzed_works p where p.cui = i.cui))
  group by floor(i.latitude / cell), floor(i.longitude / cell)
  order by count(*) desc
  limit max_cells;
end;
$$;

comment on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean, text, boolean) is
  'Map view: grid clusters (zoom < 13 and more than 500 matching projects in the box) or up to 500 projects. '
  'level: GN, GR, GL or ALL; department: null for all of Peru; only_increase, only_stalled, only_overspent, '
  'only_paralyzed combine with AND, and clusters count only the matching projects; status_filter: ACTIVE, CLOSED or ALL; '
  'paralyzed: the project is in the latest Contraloría edition of paralyzed works.';

revoke execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean, text, boolean) from public;
grant execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean, text, boolean) to anon, authenticated;

drop function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int, text);

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
  page_offset int default 0,
  status_filter text default 'ALL',
  only_paralyzed boolean default false
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
  total_count        bigint,
  paralyzed          boolean
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
      ) as is_stalled,
      exists (select 1 from public.latest_paralyzed_works p where p.cui = i.cui) as is_paralyzed
    from public.investments i
    cross join reference ref
    where i.latitude is not null
      and i.latitude between min_lat and max_lat
      and i.longitude between min_lon and max_lon
      and (level = 'ALL' or i.government_level = level)
      and (department is null or i.department_code = department)
      and (coalesce(status_filter, 'ALL') not in ('ACTIVE', 'CLOSED')
           or public.status_group(i.status) = status_filter)
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
    count(*) over (),
    v.is_paralyzed
  from in_view v
  where (not coalesce(only_increase, false) or (v.updated_cost_valid and v.cost_increase > 0))
    and (not coalesce(only_stalled, false) or v.is_stalled)
    and (not coalesce(only_overspent, false) or (v.updated_cost_valid and v.execution_progress > 1))
    and (not coalesce(only_paralyzed, false) or v.is_paralyzed)
  order by v.cost_increase desc nulls last, v.updated_cost desc nulls last, v.cui
  limit least(greatest(coalesce(page_limit, 30), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

comment on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int, text, boolean) is
  'Projects with coordinates in the box that match the map filters, largest cost increase first; '
  'page_limit 1-100 (default 30), total_count = matching projects in the box; status_filter: ACTIVE, CLOSED or ALL; '
  'only_paralyzed / paralyzed: the latest Contraloría edition of paralyzed works.';

revoke execute on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int, text, boolean) from public;
grant execute on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int, text, boolean) to anon, authenticated;
