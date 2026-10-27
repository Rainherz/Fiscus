-- Second data source: MEF open data (DETALLE_INVERSIONES.csv, fs.datosabiertos.mef.gob.pe).
-- It lists every ACTIVE investment of national (GN), regional (GR) and local (GL) governments,
-- with location (ubigeo, coordinates) and physical progress. The SSI ingest keeps loading GR
-- investments, including closed ones.
--
-- Ownership of a row (data_source):
--   'ssi'       the SSI has loaded the investment. The SSI owns every column it publishes; the
--               open-data ingest only fills the columns the SSI does not have (location,
--               physical progress, previous-years accrual, pending balance, executing unit,
--               open_data_updated_at). The SSI ingest sends data_source = 'ssi', so it also claims rows
--               first inserted by the open-data ingest.
--   'open_data' only the open-data file has the investment (GN, GL, or a GR row the SSI has not
--               loaded yet). The open-data ingest writes every column it has.
-- This keeps SSI figures (refreshed daily) from being overwritten by the older open-data file
-- (refreshed every few days) and keeps the cost history free of back-and-forth changes.
--
-- department_code becomes nullable: some national investments span several departments (MEF
-- ubigeo 99) or have none. They only appear in national scope. For open-data rows the code is the
-- department of the ubigeo (the location); for SSI rows it stays the SSI department (the regional
-- government), which matches the location for >99% of active GR rows.
--
-- Views: the existing views keep their current meaning ("regional governments only") by filtering
-- government_level = 'GR' explicitly, so the app's numbers do not change when GN/GL rows arrive.
-- New *_by_level views expose every level for the app phase: one row per level plus an 'ALL'
-- row (grouping sets), so the app can filter by level, including "all levels".
-- Note: the app also reads public.investments and public.investment_cost_changes directly; those
-- reads need a government_level filter before the open-data ingest is enabled (see README).
--
-- Unchanged rows are not rewritten. Both ingests upsert every row on every run; the BEFORE UPDATE
-- trigger below now skips an update when no data column changed, so a repeated ingest creates no
-- new row versions (no table bloat), keeps ingested_at, and logs no cost history. Freshness of a
-- whole source lives in ingest_runs (SSI) and source_snapshots (open data).

-- touch_ingested_at (20261026000000) now also decides whether an update happens at all.
-- Ignored in the comparison:
--   ingested_at, open_data_updated_at  bookkeeping set by the writer;
--   source_updated_at                  the SSI report timestamp changes every day even when the
--                                      figures do not, so it is only refreshed together with a real
--                                      change (it reads "report the current values came from");
--   generated columns                  NEW has them null in a BEFORE trigger; they derive from the
--                                      compared columns anyway.
-- A new generated or bookkeeping column must be added to this list, or every upsert will rewrite.
-- Returning null skips the row: no new tuple, no AFTER UPDATE trigger (cost history), and it is
-- not counted in the statement's row count.
create or replace function public.touch_ingested_at() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ignored constant text[] := array[
    'ingested_at', 'open_data_updated_at', 'source_updated_at',
    'cost_increase', 'cost_increase_pct', 'execution_progress', 'updated_cost_valid', 'spent_anomaly'
  ];
begin
  if (to_jsonb(new) - ignored) = (to_jsonb(old) - ignored) then
    return null;
  end if;
  new.ingested_at := now();
  return new;
end;
$$;

-- Every row loaded so far comes from the SSI GR report.
update public.investments set government_level = 'GR' where government_level is null;

alter table public.investments
  alter column department_code drop not null,
  add column province               text,
  add column district               text,
  add column ubigeo                 text check (ubigeo ~ '^[0-9]{6}$'),
  add column latitude               double precision check (latitude >= -19 and latitude < 0),
  add column longitude              double precision check (longitude between -82 and -68),
  add column physical_progress      numeric check (physical_progress between 0 and 100),
  add column accrued_previous_years numeric,
  add column pending_balance        numeric,
  add column executing_unit         text,
  add column data_source            text not null default 'ssi'
                                    check (data_source in ('ssi', 'open_data')),
  add column open_data_updated_at         timestamptz,
  add constraint investments_coordinates_pair_check
    check ((latitude is null) = (longitude is null)),
  -- NOT VALID: enforced for new and updated rows without failing on unexpected legacy values.
  add constraint investments_government_level_check
    check (government_level in ('GN', 'GR', 'GL')) not valid;

comment on column public.investments.department_code is
  'Department 1-25. SSI rows: the regional government. Open-data rows: the ubigeo department. Null for national investments spanning several departments or without location.';
comment on column public.investments.government_level is
  'GN (national), GR (regional) or GL (local) government. The SSI ingest only loads GR.';
comment on column public.investments.ubigeo is 'INEI ubigeo of the location (open data). 99xxxx: several departments.';
comment on column public.investments.latitude is 'Open data. Null when the source has 0.0 or a point outside Peru.';
comment on column public.investments.longitude is 'Open data. Null when the source has 0.0 or a point outside Peru.';
comment on column public.investments.physical_progress is
  'Physical progress percent (0-100) reported to MEF (open data). Null when not reported or out of range.';
comment on column public.investments.accrued_previous_years is 'Accrued before the current year (open data, DEVEN_ACUMUL_ANIO_ANT).';
comment on column public.investments.pending_balance is 'SALDO_EJECUTAR as published by MEF (open data). Can be negative.';
comment on column public.investments.executing_unit is 'Budget execution unit (open data, NOMBRE_UEP).';
comment on column public.investments.data_source is
  'ssi: the SSI owns the columns it publishes. open_data: only the open-data file has the investment.';
comment on column public.investments.open_data_updated_at is
  'Start of the last open-data ingest that inserted the investment or changed its data. Source freshness: source_snapshots.';
comment on column public.investments.source_updated_at is
  'Timestamp of the MEF report or file the current values came from. Refreshed only when the data changes (see touch_ingested_at).';
comment on column public.investments.pim is
  'Current-year modified budget (PIM). Same figure in the SSI ("PIM yyyy") and open data (PIM_ANIO_ACTUAL).';
comment on column public.investments.accrued_year is
  'Accrued in the current year. Same figure in the SSI ("DEVENGADO yyyy") and open data (DEV_ANIO_ACTUAL).';

-- (department_code, government_level) also serves department_code-only filters.
drop index public.investments_department_code_idx;
create index investments_department_level_idx on public.investments (department_code, government_level);
create index investments_government_level_idx on public.investments (government_level);
create index investments_entity_idx on public.investments (entity);
create index investments_coordinates_idx on public.investments (latitude, longitude)
  where latitude is not null;

-- One row per external file: what was ingested last, to skip unchanged downloads.
create table public.source_snapshots (
  source         text primary key,
  last_modified  timestamptz,
  content_length bigint,
  ingested_at    timestamptz not null,
  rows_upserted  int not null default 0
);

comment on table public.source_snapshots is
  'Last successful ingest per external file (HTTP Last-Modified and Content-Length).';

alter table public.source_snapshots enable row level security;

create policy "source snapshots are publicly readable"
  on public.source_snapshots for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.source_snapshots from anon, authenticated;
grant select on public.source_snapshots to anon, authenticated;

-- Open-data upsert with the ownership rule above. Called by the ingest (service role) with a JSON
-- array of rows; the column list is the whitelist (generated columns cannot be written).
-- Rows must have distinct CUIs within one call. Returns the rows inserted or changed: rows whose
-- data is unchanged are skipped by touch_ingested_at and not counted.
create function public.upsert_open_data_investments(rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  written integer;
begin
  insert into public.investments as i (
    cui, snip_code, name, government_level, sector, entity, executing_unit, status, situation,
    beneficiaries, registered_at, viability_at, investment_type, function, functional_division,
    functional_group, framework, viable_amount, updated_cost, pim, pim_year, accrued_year,
    accrued_previous_years, accrued_total, first_accrual_month, last_accrual_month,
    pending_balance, dispute_cost, guarantee_amount, concurrent_control_cost, physical_progress,
    department_code, department_name, province, district, ubigeo, latitude, longitude,
    source_updated_at, open_data_updated_at, data_source
  )
  select
    r.cui, r.snip_code, r.name, r.government_level, r.sector, r.entity, r.executing_unit, r.status,
    r.situation, r.beneficiaries, r.registered_at, r.viability_at, r.investment_type, r.function,
    r.functional_division, r.functional_group, r.framework, r.viable_amount, r.updated_cost, r.pim,
    r.pim_year, r.accrued_year, r.accrued_previous_years, r.accrued_total, r.first_accrual_month,
    r.last_accrual_month, r.pending_balance, r.dispute_cost, r.guarantee_amount,
    r.concurrent_control_cost, r.physical_progress, r.department_code, r.department_name,
    r.province, r.district, r.ubigeo, r.latitude, r.longitude, r.source_updated_at,
    r.open_data_updated_at, 'open_data'
  from jsonb_to_recordset(rows) as r (
    cui text, snip_code text, name text, government_level text, sector text, entity text,
    executing_unit text, status text, situation text, beneficiaries bigint, registered_at date,
    viability_at date, investment_type text, function text, functional_division text,
    functional_group text, framework text, viable_amount numeric, updated_cost numeric,
    pim numeric, pim_year int, accrued_year numeric, accrued_previous_years numeric,
    accrued_total numeric, first_accrual_month date, last_accrual_month date,
    pending_balance numeric, dispute_cost numeric, guarantee_amount numeric,
    concurrent_control_cost numeric, physical_progress numeric, department_code int,
    department_name text, province text, district text, ubigeo text,
    latitude double precision, longitude double precision, source_updated_at timestamptz,
    open_data_updated_at timestamptz
  )
  on conflict (cui) do update set
    -- Columns only the open-data file has: always refreshed.
    executing_unit         = excluded.executing_unit,
    accrued_previous_years = excluded.accrued_previous_years,
    pending_balance        = excluded.pending_balance,
    physical_progress      = excluded.physical_progress,
    province               = excluded.province,
    district               = excluded.district,
    ubigeo                 = excluded.ubigeo,
    latitude               = excluded.latitude,
    longitude              = excluded.longitude,
    open_data_updated_at         = excluded.open_data_updated_at,
    -- Columns the SSI also publishes: kept when the SSI owns the row.
    snip_code               = case when i.data_source = 'ssi' then i.snip_code else excluded.snip_code end,
    name                    = case when i.data_source = 'ssi' then i.name else excluded.name end,
    government_level        = case when i.data_source = 'ssi' then i.government_level else excluded.government_level end,
    sector                  = case when i.data_source = 'ssi' then i.sector else excluded.sector end,
    entity                  = case when i.data_source = 'ssi' then i.entity else excluded.entity end,
    status                  = case when i.data_source = 'ssi' then i.status else excluded.status end,
    situation               = case when i.data_source = 'ssi' then i.situation else excluded.situation end,
    beneficiaries           = case when i.data_source = 'ssi' then i.beneficiaries else excluded.beneficiaries end,
    registered_at           = case when i.data_source = 'ssi' then i.registered_at else excluded.registered_at end,
    viability_at            = case when i.data_source = 'ssi' then i.viability_at else excluded.viability_at end,
    investment_type         = case when i.data_source = 'ssi' then i.investment_type else excluded.investment_type end,
    function                = case when i.data_source = 'ssi' then i.function else excluded.function end,
    functional_division     = case when i.data_source = 'ssi' then i.functional_division else excluded.functional_division end,
    functional_group        = case when i.data_source = 'ssi' then i.functional_group else excluded.functional_group end,
    framework               = case when i.data_source = 'ssi' then i.framework else excluded.framework end,
    viable_amount           = case when i.data_source = 'ssi' then i.viable_amount else excluded.viable_amount end,
    updated_cost            = case when i.data_source = 'ssi' then i.updated_cost else excluded.updated_cost end,
    pim                     = case when i.data_source = 'ssi' then i.pim else excluded.pim end,
    pim_year                = case when i.data_source = 'ssi' then i.pim_year else excluded.pim_year end,
    accrued_year            = case when i.data_source = 'ssi' then i.accrued_year else excluded.accrued_year end,
    accrued_total           = case when i.data_source = 'ssi' then i.accrued_total else excluded.accrued_total end,
    first_accrual_month     = case when i.data_source = 'ssi' then i.first_accrual_month else excluded.first_accrual_month end,
    last_accrual_month      = case when i.data_source = 'ssi' then i.last_accrual_month else excluded.last_accrual_month end,
    dispute_cost            = case when i.data_source = 'ssi' then i.dispute_cost else excluded.dispute_cost end,
    guarantee_amount        = case when i.data_source = 'ssi' then i.guarantee_amount else excluded.guarantee_amount end,
    concurrent_control_cost = case when i.data_source = 'ssi' then i.concurrent_control_cost else excluded.concurrent_control_cost end,
    department_code         = case when i.data_source = 'ssi' then i.department_code else excluded.department_code end,
    department_name         = case when i.data_source = 'ssi' then i.department_name else excluded.department_name end,
    source_updated_at       = case when i.data_source = 'ssi' then i.source_updated_at else excluded.source_updated_at end;

  get diagnostics written = row_count;
  return written;
end;
$$;

comment on function public.upsert_open_data_investments(jsonb) is
  'Open-data ingest upsert: inserts new investments as open_data; on SSI-owned rows only fills the open-data-only columns.';

revoke execute on function public.upsert_open_data_investments(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_open_data_investments(jsonb) to service_role;

-- Existing views: unchanged meaning, regional governments only.
create or replace view public.department_summary
with (security_invoker = true) as
select
  department_code,
  department_name,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
where government_level = 'GR'
group by department_code, department_name;

create or replace view public.function_summary
with (security_invoker = true) as
select
  function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
where government_level = 'GR'
group by function;

create or replace view public.department_function_summary
with (security_invoker = true) as
select
  department_code,
  function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
where government_level = 'GR'
group by department_code, function;

create or replace view public.accrual_reference_month
with (security_invoker = true) as
select max(last_accrual_month) as reference_month
from public.investments
where government_level = 'GR';

create or replace view public.stalled_investments
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
where i.government_level = 'GR'
  and i.status = 'ACTIVO'
  and i.updated_cost_valid
  and i.execution_progress between 0.05 and 0.95
  and i.last_accrual_month < r.reference_month - interval '12 months';

-- region_comparison reads stalled_investments (GR only); its own aggregate is filtered too, and
-- department_code is never null for GR rows loaded by the SSI.
create or replace view public.region_comparison
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
  where government_level = 'GR'
    and department_code is not null
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

comment on view public.department_summary is
  'Legacy per-department summary of regional governments (nets cost reductions against increases). The app uses region_comparison.';
comment on view public.function_summary is 'Per-function aggregates of regional governments (GR) nationwide.';
comment on view public.department_function_summary is 'Per-department function aggregates of regional governments (GR).';
comment on view public.accrual_reference_month is
  'One row: the latest last_accrual_month of regional-government rows (first day of a month), the end of the data window.';
comment on view public.stalled_investments is
  'Active regional-government investments that spent 5%-95% of a valid updated cost and have no accrual in the 12 months before accrual_reference_month.';
comment on view public.region_comparison is
  'One row per department: regional-government project counts and cost aggregates over valid updated costs. See region_comparison_by_level for every level.';

-- New level-aware views for the app phase. government_level is GN, GR, GL or 'ALL' (every level).

-- Same rule as stalled_investments over every level. The reference month is the end of the whole
-- dataset, shared by all levels.
create view public.stalled_investments_by_level
with (security_invoker = true) as
with reference as (
  select max(last_accrual_month) as reference_month from public.investments
)
select
  i.cui,
  i.name,
  i.government_level,
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
  i.physical_progress,
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

-- Only the 25 departments: rows without department_code (multi-department national investments)
-- are left out here and counted in national figures only.
create view public.region_comparison_by_level
with (security_invoker = true) as
with stalled as (
  select
    department_code,
    case when grouping(government_level) = 1 then 'ALL' else government_level end
                        as government_level,
    count(*)            as stalled_count,
    sum(pending_amount) as stalled_pending_amount
  from public.stalled_investments_by_level
  where department_code is not null
  group by grouping sets ((department_code, government_level), (department_code))
),
regions as (
  select
    department_code,
    case when grouping(government_level) = 1 then 'ALL' else government_level end
                                                                     as government_level,
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
                                                                     as overspent_count,
    count(*) filter (where physical_progress is not null)            as physical_progress_count,
    avg(physical_progress)                                           as avg_physical_progress
  from public.investments
  where department_code is not null
  group by grouping sets ((department_code, government_level), (department_code))
)
select
  r.department_code,
  r.government_level,
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
  coalesce(s.stalled_pending_amount, 0)                              as stalled_pending_amount,
  r.physical_progress_count,
  r.avg_physical_progress
from regions r
left join stalled s using (department_code, government_level);

-- Nationwide: includes rows without department_code.
create view public.function_summary_by_level
with (security_invoker = true) as
select
  case when grouping(government_level) = 1 then 'ALL' else government_level end as government_level,
  function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
group by grouping sets ((government_level, function), (function));

create view public.department_function_summary_by_level
with (security_invoker = true) as
select
  department_code,
  case when grouping(government_level) = 1 then 'ALL' else government_level end as government_level,
  function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
where department_code is not null
group by grouping sets ((department_code, government_level, function), (department_code, function));

comment on view public.stalled_investments_by_level is
  'stalled_investments over every government level; reference_month is the latest last_accrual_month of the whole dataset.';
comment on view public.region_comparison_by_level is
  'region_comparison per department and government level (GN, GR, GL, or ALL for every level). Rows without department_code are excluded.';
comment on view public.function_summary_by_level is
  'function_summary per government level (GN, GR, GL, or ALL), nationwide including rows without department.';
comment on view public.department_function_summary_by_level is
  'department_function_summary per government level (GN, GR, GL, or ALL). Rows without department_code are excluded.';

grant select on
  public.stalled_investments_by_level,
  public.region_comparison_by_level,
  public.function_summary_by_level,
  public.department_function_summary_by_level
to anon, authenticated;
