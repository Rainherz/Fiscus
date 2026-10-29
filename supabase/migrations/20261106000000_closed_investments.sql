-- Third data source: MEF open data CIERRE_INVERSIONES.csv (fs.datosabiertos.mef.gob.pe), every
-- CLOSED investment of national (GN), regional (GR) and local (GL) governments (~117k CUIs in
-- October 2026). DETALLE_INVERSIONES.csv lists only active ones, so until now closed GN and GL
-- projects were not in Fiscus at all (closed GR ones came from the SSI).
--
-- Ownership of a row (data_source), extended:
--   'ssi'               unchanged: the SSI owns every column it publishes. Both open-data ingests only
--                       fill the columns the SSI lacks.
--   'open_data'         the active file (DETALLE_INVERSIONES.csv) wrote the row last.
--   'open_data_closed'  the closed file (CIERRE_INVERSIONES.csv) wrote the row last.
-- A separate value instead of 'open_data' plus a flag: the provenance is per file, and each open-data
-- ingest needs to know which file owns a non-SSI row. A project that closes leaves the active file and
-- appears in the closed one; the closed upsert takes the row over ('open_data' -> 'open_data_closed')
-- and its status flips to CERRADO. The two files share no CUI (checked on the October 2026 files);
-- if one ever appears in both, each re-ingest of a changed file overwrites the other's values (the
-- newer file wins), and the cost history logs only real cost changes.
--
-- Columns the closed file does not publish are cleared on rows it owns (pim, pim_year,
-- accrued_year, accrued_previous_years, pending_balance, physical_progress): a value left over from
-- the active file would describe a project that no longer exists in that form. accrued_total comes
-- from DEVEN_ACUMULADO.
--
-- New closure columns (the closed file only; the active upsert clears them, the SSI never sends them).
-- RESPONSABLE_UEI (a person's name), the OPMI/UF/UEI names and the other unmapped columns are never
-- stored: the ingest drops RESPONSABLE_UEI in the CSV parser.
--
-- Views: the app's views keep their meaning (every status, as they always were: the SSI already
-- loaded closed GR projects). New *_by_status views add a status_group dimension ('ACTIVE' =
-- status ACTIVO, 'CLOSED' = status CERRADO, 'ALL' = every status) for the app's status filter, so a
-- deployed app that does not know about statuses keeps reading the same numbers until it is updated.
-- "Sin gasto reciente" already requires status = 'ACTIVO' everywhere (stalled_investments,
-- stalled_investments_by_level, map_points and map_list), so closed projects never qualify.

alter table public.investments
  add column closed_at           date,
  add column closure_description text check (char_length(closure_description) <= 200),
  add column liquidation_amount  numeric,
  add column liquidated_at       date,
  add column culminated          boolean,
  add column physical_start_at   date,
  add column physical_end_at     date,
  add column operation_start_at  date,
  drop constraint investments_data_source_check,
  add constraint investments_data_source_check
    check (data_source in ('ssi', 'open_data', 'open_data_closed'));

comment on column public.investments.closed_at is 'Closure date (closed file, FEC_CIERRE).';
comment on column public.investments.closure_description is
  'Closure type as MEF publishes it (closed file, DES_CIERRE), e.g. "Sí, con liquidación", "No culminada". At most 200 characters.';
comment on column public.investments.liquidation_amount is
  'Final settled cost (closed file, TOTAL_LIQUIDACION), as published (0 happens). Null without liquidation.';
comment on column public.investments.liquidated_at is 'Liquidation date (closed file, FEC_LIQUIDACION).';
comment on column public.investments.culminated is
  'Whether the works were completed (closed file, CULMINADA SÍ/NO). Null when not reported.';
comment on column public.investments.physical_start_at is 'Start of physical execution (closed file, INICIO_EJEC_FISICA).';
comment on column public.investments.physical_end_at is 'End of physical execution (closed file, CULMINA_EJEC_FISICA).';
comment on column public.investments.operation_start_at is 'Start of operation (closed file, FEC_INI_OPER).';
comment on column public.investments.data_source is
  'ssi: the SSI owns the columns it publishes. open_data: only the active open-data file has the investment. '
  'open_data_closed: only the closed open-data file (CIERRE_INVERSIONES.csv) has it.';

-- The active upsert (20261031000000) with two changes: a non-SSI row it writes becomes 'open_data'
-- again (a project in the active file is active), and the closure columns are cleared (the active
-- file has none; for SSI rows they are open-data columns like the location).
create or replace function public.upsert_open_data_investments(rows jsonb)
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
    -- Columns only the open-data files have: always refreshed.
    executing_unit         = excluded.executing_unit,
    accrued_previous_years = excluded.accrued_previous_years,
    pending_balance        = excluded.pending_balance,
    physical_progress      = excluded.physical_progress,
    province               = excluded.province,
    district               = excluded.district,
    ubigeo                 = excluded.ubigeo,
    latitude               = excluded.latitude,
    longitude              = excluded.longitude,
    open_data_updated_at   = excluded.open_data_updated_at,
    closed_at              = null,
    closure_description    = null,
    liquidation_amount     = null,
    liquidated_at          = null,
    culminated             = null,
    physical_start_at      = null,
    physical_end_at        = null,
    operation_start_at     = null,
    data_source             = case when i.data_source = 'ssi' then 'ssi' else 'open_data' end,
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
  'Active open-data ingest upsert: inserts new investments as open_data; on SSI-owned rows only fills the open-data-only columns; clears closure columns.';

-- Closed open-data upsert, same ownership rule. Rows must have distinct CUIs within one call.
-- Returns the rows inserted or changed (touch_ingested_at skips unchanged rows, so an identical
-- re-ingest writes nothing and logs no cost history). The function crosswalk trigger fills
-- function_canonical from function and functional_division (PROGRAMA) as for the active file.
create function public.upsert_closed_investments(rows jsonb)
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
    functional_group, framework, viable_amount, updated_cost, accrued_total, first_accrual_month,
    last_accrual_month, dispute_cost, guarantee_amount, concurrent_control_cost, department_code,
    department_name, province, district, ubigeo, latitude, longitude, closed_at,
    closure_description, liquidation_amount, liquidated_at, culminated, physical_start_at,
    physical_end_at, operation_start_at, source_updated_at, open_data_updated_at, data_source
  )
  select
    r.cui, r.snip_code, r.name, r.government_level, r.sector, r.entity, r.executing_unit, r.status,
    r.situation, r.beneficiaries, r.registered_at, r.viability_at, r.investment_type, r.function,
    r.functional_division, r.functional_group, r.framework, r.viable_amount, r.updated_cost,
    r.accrued_total, r.first_accrual_month, r.last_accrual_month, r.dispute_cost,
    r.guarantee_amount, r.concurrent_control_cost, r.department_code, r.department_name,
    r.province, r.district, r.ubigeo, r.latitude, r.longitude, r.closed_at,
    left(btrim(r.closure_description), 200), r.liquidation_amount, r.liquidated_at, r.culminated,
    r.physical_start_at, r.physical_end_at, r.operation_start_at, r.source_updated_at,
    r.open_data_updated_at, 'open_data_closed'
  from jsonb_to_recordset(rows) as r (
    cui text, snip_code text, name text, government_level text, sector text, entity text,
    executing_unit text, status text, situation text, beneficiaries bigint, registered_at date,
    viability_at date, investment_type text, function text, functional_division text,
    functional_group text, framework text, viable_amount numeric, updated_cost numeric,
    accrued_total numeric, first_accrual_month date, last_accrual_month date,
    dispute_cost numeric, guarantee_amount numeric, concurrent_control_cost numeric,
    department_code int, department_name text, province text, district text, ubigeo text,
    latitude double precision, longitude double precision, closed_at date,
    closure_description text, liquidation_amount numeric, liquidated_at date, culminated boolean,
    physical_start_at date, physical_end_at date, operation_start_at date,
    source_updated_at timestamptz, open_data_updated_at timestamptz
  )
  on conflict (cui) do update set
    -- Columns only the open-data files have: always refreshed. The closed file has no physical
    -- progress, pending balance or previous-years accrual, so they are cleared.
    executing_unit          = excluded.executing_unit,
    province                = excluded.province,
    district                = excluded.district,
    ubigeo                  = excluded.ubigeo,
    latitude                = excluded.latitude,
    longitude               = excluded.longitude,
    open_data_updated_at    = excluded.open_data_updated_at,
    closed_at               = excluded.closed_at,
    closure_description     = excluded.closure_description,
    liquidation_amount      = excluded.liquidation_amount,
    liquidated_at           = excluded.liquidated_at,
    culminated              = excluded.culminated,
    physical_start_at       = excluded.physical_start_at,
    physical_end_at         = excluded.physical_end_at,
    operation_start_at      = excluded.operation_start_at,
    accrued_previous_years  = null,
    pending_balance         = null,
    physical_progress       = null,
    data_source             = case when i.data_source = 'ssi' then 'ssi' else 'open_data_closed' end,
    -- Columns the SSI also publishes: kept when the SSI owns the row. pim, pim_year and
    -- accrued_year are not in the closed file: cleared on rows it owns.
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
    pim                     = case when i.data_source = 'ssi' then i.pim end,
    pim_year                = case when i.data_source = 'ssi' then i.pim_year end,
    accrued_year            = case when i.data_source = 'ssi' then i.accrued_year end,
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

comment on function public.upsert_closed_investments(jsonb) is
  'Closed open-data ingest upsert (CIERRE_INVERSIONES.csv): inserts new investments as open_data_closed; '
  'on SSI-owned rows only fills the open-data-only and closure columns.';

revoke execute on function public.upsert_closed_investments(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_closed_investments(jsonb) to service_role;

-- The status filter's groups: 'ACTIVE' (status ACTIVO), 'CLOSED' (status CERRADO). Any other or a
-- missing status only counts under 'ALL'. Used by map_points. Immutable, so the planner inlines it.
create function public.status_group(status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case status when 'ACTIVO' then 'ACTIVE' when 'CERRADO' then 'CLOSED' end;
$$;

comment on function public.status_group(text) is
  'Status filter group of an investment status: ACTIVE (ACTIVO), CLOSED (CERRADO), null otherwise.';

-- Building blocks of the *_by_status views: every investment once per status group it belongs to
-- ('ALL', plus 'ACTIVE' or 'CLOSED') and per level group (its own level, and 'ALL' with
-- all_levels = true), as UNION ALL branches with constant columns. A filter on status_group and
-- level_group then prunes the other branches at plan time, so a view read scans the table once and
-- aggregates only the requested group. (GROUP BY CUBE / ROLLUP was measured 3-10 times slower on
-- 267k rows: no filter reaches below grouping sets, so every group was aggregated on every read.)
-- Only the columns the views use.
create view public.investment_status_groups
with (security_invoker = true) as
select 'ALL'::text as status_group, i.government_level as level_group, false as all_levels,
       i.department_code, i.department_name, i.government_level, i.entity,
       i.function_canonical, i.viable_amount, i.updated_cost, i.updated_cost_valid, i.cost_increase,
       i.execution_progress, i.physical_progress, i.status
from public.investments i
union all
select 'ALL', 'ALL', true,
       i.department_code, i.department_name, i.government_level, i.entity,
       i.function_canonical, i.viable_amount, i.updated_cost, i.updated_cost_valid, i.cost_increase,
       i.execution_progress, i.physical_progress, i.status
from public.investments i
union all
select 'ACTIVE', i.government_level, false,
       i.department_code, i.department_name, i.government_level, i.entity,
       i.function_canonical, i.viable_amount, i.updated_cost, i.updated_cost_valid, i.cost_increase,
       i.execution_progress, i.physical_progress, i.status
from public.investments i
where i.status = 'ACTIVO'
union all
select 'ACTIVE', 'ALL', true,
       i.department_code, i.department_name, i.government_level, i.entity,
       i.function_canonical, i.viable_amount, i.updated_cost, i.updated_cost_valid, i.cost_increase,
       i.execution_progress, i.physical_progress, i.status
from public.investments i
where i.status = 'ACTIVO'
union all
select 'CLOSED', i.government_level, false,
       i.department_code, i.department_name, i.government_level, i.entity,
       i.function_canonical, i.viable_amount, i.updated_cost, i.updated_cost_valid, i.cost_increase,
       i.execution_progress, i.physical_progress, i.status
from public.investments i
where i.status = 'CERRADO'
union all
select 'CLOSED', 'ALL', true,
       i.department_code, i.department_name, i.government_level, i.entity,
       i.function_canonical, i.viable_amount, i.updated_cost, i.updated_cost_valid, i.cost_increase,
       i.execution_progress, i.physical_progress, i.status
from public.investments i
where i.status = 'CERRADO';

-- Stalled projects are ACTIVO by definition, so they belong to 'ALL' and 'ACTIVE' only: a CLOSED
-- group never has stalled projects.
create view public.stalled_status_groups
with (security_invoker = true) as
select 'ALL'::text as status_group, s.government_level as level_group, false as all_levels, s.department_code, s.government_level, s.entity, s.pending_amount
from public.stalled_investments_by_level s
union all
select 'ALL', 'ALL', true, s.department_code, s.government_level, s.entity, s.pending_amount
from public.stalled_investments_by_level s
union all
select 'ACTIVE', s.government_level, false, s.department_code, s.government_level, s.entity, s.pending_amount
from public.stalled_investments_by_level s
where s.status = 'ACTIVO'
union all
select 'ACTIVE', 'ALL', true, s.department_code, s.government_level, s.entity, s.pending_amount
from public.stalled_investments_by_level s
where s.status = 'ACTIVO';

comment on view public.investment_status_groups is
  'Internal: each investment once under status_group ALL and once under ACTIVE (ACTIVO) or CLOSED (CERRADO). Feeds the *_by_status views.';
comment on view public.stalled_status_groups is
  'Internal: stalled_investments_by_level under status_group ALL and ACTIVE (stalled projects are always ACTIVO).';

-- region_comparison_by_level per status group. government_level: GN, GR, GL or 'ALL';
-- status_group: ACTIVE, CLOSED or 'ALL'.
create view public.region_comparison_by_status
with (security_invoker = true) as
with stalled as (
  select
    department_code,
    level_group         as government_level,
    status_group,
    count(*)            as stalled_count,
    sum(pending_amount) as stalled_pending_amount
  from public.stalled_status_groups
  where department_code is not null
  group by department_code, level_group, status_group
),
regions as (
  select
    department_code,
    level_group                                                      as government_level,
    status_group,
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
  from public.investment_status_groups
  where department_code is not null
  group by department_code, level_group, status_group
)
select
  r.department_code,
  r.government_level,
  r.status_group,
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
left join stalled s using (department_code, government_level, status_group);

-- function_summary_by_level and department_function_summary_by_level per status group.
create view public.function_summary_by_status
with (security_invoker = true) as
select
  level_group              as government_level,
  status_group,
  function_canonical       as function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investment_status_groups
group by level_group, status_group, function_canonical;

create view public.department_function_summary_by_status
with (security_invoker = true) as
select
  department_code,
  level_group              as government_level,
  status_group,
  function_canonical       as function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investment_status_groups
where department_code is not null
group by department_code, level_group, status_group, function_canonical;

-- entity_comparison per status group (ACTIVE, CLOSED or 'ALL' per entity and level; there is no
-- 'ALL' level here, as in entity_comparison). Same two UNION ALL scope branches.
create view public.entity_comparison_by_status
with (security_invoker = true) as
with stalled as (
  select
    entity,
    government_level,
    status_group,
    0                   as scope_department_code,
    count(*)            as stalled_count,
    sum(pending_amount) as stalled_pending_amount
  from public.stalled_status_groups
  where not all_levels
    and entity is not null
  group by entity, government_level, status_group
  union all
  select
    entity,
    government_level,
    status_group,
    department_code,
    count(*),
    sum(pending_amount)
  from public.stalled_status_groups
  where not all_levels
    and entity is not null
    and department_code is not null
  group by entity, government_level, status_group, department_code
),
entities as (
  select
    entity,
    government_level,
    status_group,
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
  from public.investment_status_groups
  where not all_levels
    and entity is not null
  group by entity, government_level, status_group
  union all
  select
    entity,
    government_level,
    status_group,
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
  from public.investment_status_groups
  where not all_levels
    and entity is not null
    and department_code is not null
  group by entity, government_level, status_group, department_code
)
select
  e.entity,
  e.government_level,
  e.status_group,
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
left join stalled s using (entity, government_level, status_group, scope_department_code);

comment on view public.region_comparison_by_status is
  'region_comparison_by_level per status group: ACTIVE (ACTIVO), CLOSED (CERRADO) or ALL. Rows without department_code are excluded.';
comment on view public.function_summary_by_status is
  'function_summary_by_level per status group (ACTIVE, CLOSED or ALL), nationwide. function is canonical.';
comment on view public.department_function_summary_by_status is
  'department_function_summary_by_level per status group (ACTIVE, CLOSED or ALL). function is canonical.';
comment on view public.entity_comparison_by_status is
  'entity_comparison per status group (ACTIVE, CLOSED or ALL).';

grant select on
  public.investment_status_groups,
  public.stalled_status_groups,
  public.region_comparison_by_status,
  public.function_summary_by_status,
  public.department_function_summary_by_status,
  public.entity_comparison_by_status
to anon, authenticated;
grant execute on function public.status_group(text) to anon, authenticated;

-- Map: map_points and map_list gain status_filter ('ACTIVE', 'CLOSED' or 'ALL', the default, so
-- callers that do not send it keep their results), and map_points returns each project's status
-- (closed projects get their own marker). Dropped and created again, like 20261103000000.

drop function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean);

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
  status_filter text default 'ALL'
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
  status                text
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
      i.status
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
    null::text
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
  group by floor(i.latitude / cell), floor(i.longitude / cell)
  order by count(*) desc
  limit max_cells;
end;
$$;

comment on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean, text) is
  'Map view: grid clusters (zoom < 13 and more than 500 matching projects in the box) or up to 500 projects. '
  'level: GN, GR, GL or ALL; department: null for all of Peru; only_increase, only_stalled, only_overspent '
  'combine with AND, and clusters count only the matching projects; status_filter: ACTIVE, CLOSED or ALL.';

revoke execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean, text) from public;
grant execute on function public.map_points(double precision, double precision, double precision, double precision, int, text, int, boolean, boolean, boolean, text) to anon, authenticated;

drop function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int);

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
  status_filter text default 'ALL'
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
    count(*) over ()
  from in_view v
  where (not coalesce(only_increase, false) or (v.updated_cost_valid and v.cost_increase > 0))
    and (not coalesce(only_stalled, false) or v.is_stalled)
    and (not coalesce(only_overspent, false) or (v.updated_cost_valid and v.execution_progress > 1))
  order by v.cost_increase desc nulls last, v.updated_cost desc nulls last, v.cui
  limit least(greatest(coalesce(page_limit, 30), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

comment on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int, text) is
  'Projects with coordinates in the box that match the map filters, largest cost increase first; '
  'page_limit 1-100 (default 30), total_count = matching projects in the box; status_filter: ACTIVE, CLOSED or ALL.';

revoke execute on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int, text) from public;
grant execute on function public.map_list(double precision, double precision, double precision, double precision, text, int, boolean, boolean, boolean, int, int, text) to anon, authenticated;
