-- INFOBRAS obras: the open dataset of the Contraloría General de la República ("Dataset - Obras
-- Públicas", https://infobras.contraloria.gob.pe/InfobrasWeb/DataSets), one row per obra: execution
-- status, physical progress, paralysis, contract, contractor and supervision firm, additional works,
-- deductions, time extensions, reception and liquidation.
--
-- Ingest: packages/ingest (pnpm ingest:infobras), weekly from .github/workflows/infobras-ingest.yml.
--
-- Privacy: the dataset names people (supervisor and resident engineers, and contractors that are
-- natural persons, whose RUC 10 embeds their DNI). None of that is stored: the ingest never reads
-- the person-name columns, and a party whose RUC belongs to a natural person (RUC 10, 15 or 17)
-- keeps only its kind ('persona_natural'). The check constraints below enforce it.
--
-- Freshness: the file is regenerated every day, but its content can be months old. The date the
-- data describes is source_snapshots.data_as_of (latest "Fecha de registro de avance" in the file),
-- shown wherever this data appears. The Contraloría quarterly report (official_paralyzed_works)
-- stays the authoritative list of paralyzed works.
--
-- Size: only the columns the app shows are kept (no descriptions, addresses or investment fields
-- the investments table already has). Zero amounts and terms in the source are stored as null.

create table public.infobras_works (
  -- Código INFOBRAS: the obra (the ObraId of its public ficha).
  infobras_code             int  primary key check (infobras_code > 0),
  -- Número de dias paralizado.
  paralysis_days            int  check (paralysis_days > 0),
  -- N° días de modificaciones de plazo: days added by time extensions (ampliaciones de plazo).
  extension_days            int  check (extension_days > 0),
  -- Año / Mes de avance of the last progress report, as the first day of that month.
  progress_period           date,
  -- Fecha de registro de avance.
  progress_registered_at    date,
  paralysis_date            date,
  reception_date            date,
  -- Fecha de aprobación de liquidación de obra.
  liquidation_date          date,
  -- The day an ingest no longer found the obra in the file; such rows are hidden (see the policy).
  removed_at                date,
  -- Existe Paralización (Sí / No), as reported by the entity.
  has_paralysis             boolean,
  -- Codigo unico de inversión; null when the source leaves it blank or writes 0. Several obras can
  -- share one CUI.
  cui                       text check (cui ~ '^\d{1,12}$'),
  snip                      text check (snip ~ '^\d{1,12}$'),
  execution_status          text check (execution_status in ('Finalizado', 'En Ejecución', 'Sin Ejecución', 'Paralizada')),
  paralysis_cause           text,
  -- Avance Físico Programado / Real Acumulado, 0-100 as published.
  physical_progress_planned numeric check (physical_progress_planned >= 0),
  physical_progress_actual  numeric check (physical_progress_actual >= 0),
  -- Monto del contrato (ejecución) in soles.
  contract_amount           numeric check (contract_amount > 0),
  -- Monto de adicionales de obra / de deductivos de obra, in soles.
  additional_works_amount   numeric check (additional_works_amount > 0),
  deductions_amount         numeric check (deductions_amount > 0),
  -- Modalidad de ejecución de la obra (Contrata, Administración directa, ...).
  modality                  text,
  -- Contractor (ejecución) and supervision firm: kind, RUC (20 + 9 digits) or OSCE consortium code
  -- (C + 10 digits), and name. Natural persons: kind only.
  contractor_kind           text check (contractor_kind in ('empresa', 'consorcio', 'persona_natural')),
  contractor_ruc            text check (contractor_ruc ~ '^(20\d{9}|C\d{10})$'),
  contractor_name           text,
  supervisor_kind           text check (supervisor_kind in ('empresa', 'consorcio', 'persona_natural')),
  supervisor_ruc            text check (supervisor_ruc ~ '^(20\d{9}|C\d{10})$'),
  supervisor_name           text,
  constraint infobras_works_contractor_privacy check (
    contractor_kind is distinct from 'persona_natural' or (contractor_ruc is null and contractor_name is null)
  ),
  constraint infobras_works_supervisor_privacy check (
    supervisor_kind is distinct from 'persona_natural' or (supervisor_ruc is null and supervisor_name is null)
  )
);

comment on table public.infobras_works is
  'Contraloría General de la República, INFOBRAS open dataset (Obras Públicas), one row per obra. '
  'No personal data: natural-person contractors and supervisors keep only their kind.';

create index infobras_works_cui_idx on public.infobras_works (cui) where cui is not null;
create index infobras_works_contractor_ruc_idx on public.infobras_works (contractor_ruc) where contractor_ruc is not null;

alter table public.infobras_works enable row level security;

-- Obras the file no longer has stay in the table for the record but are not public.
create policy "infobras works are publicly readable"
  on public.infobras_works for select
  to anon, authenticated
  using (removed_at is null);

revoke insert, update, delete, truncate on public.infobras_works from anon, authenticated;
grant select on public.infobras_works to anon, authenticated;

-- source_snapshots.data_as_of: the date the data of a source describes, when it is not the date of
-- the file (INFOBRAS: latest progress registration date in the file).
alter table public.source_snapshots add column data_as_of date;

comment on column public.source_snapshots.data_as_of is
  'Sources whose content lags the file (infobras_obras): the date the data describes.';

-- data_freshness gains data_as_of (null for every other source), appended last as create or replace
-- view requires. The weekly INFOBRAS run is judged by last_checked_at; data_as_of is only shown.
create or replace view public.data_freshness
with (security_invoker = true) as
select
  'ssi'::text as source,
  (select max(finished_at) from public.ingest_runs where cardinality(departments_ok) > 0) as last_success_at,
  (select max(finished_at) from public.ingest_runs)                                        as last_checked_at,
  null::date                                                                               as edition_cutoff,
  null::date                                                                               as data_as_of
union all
select
  source,
  ingested_at as last_success_at,
  checked_at  as last_checked_at,
  edition_cutoff,
  data_as_of
from public.source_snapshots;

-- Upsert from the ingest (service role) with a JSON array of rows; the column list is the
-- whitelist. Codes must be distinct within one call. Unchanged rows are skipped by the where clause
-- (no new tuple), so a weekly re-ingest of an unchanged file writes nothing. A row seen again after
-- being marked as removed is restored. Returns the rows inserted or changed.
create function public.upsert_infobras_works(rows jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  written integer;
begin
  insert into public.infobras_works as w (
    infobras_code, paralysis_days, extension_days, progress_period, progress_registered_at,
    paralysis_date, reception_date, liquidation_date, has_paralysis, cui, snip, execution_status,
    paralysis_cause, physical_progress_planned, physical_progress_actual, contract_amount,
    additional_works_amount, deductions_amount, modality, contractor_kind, contractor_ruc,
    contractor_name, supervisor_kind, supervisor_ruc, supervisor_name
  )
  select
    r.infobras_code, r.paralysis_days, r.extension_days, r.progress_period, r.progress_registered_at,
    r.paralysis_date, r.reception_date, r.liquidation_date, r.has_paralysis, r.cui, r.snip,
    r.execution_status, r.paralysis_cause, r.physical_progress_planned, r.physical_progress_actual,
    r.contract_amount, r.additional_works_amount, r.deductions_amount, r.modality, r.contractor_kind,
    r.contractor_ruc, r.contractor_name, r.supervisor_kind, r.supervisor_ruc, r.supervisor_name
  from jsonb_to_recordset(rows) as r (
    infobras_code int, paralysis_days int, extension_days int, progress_period date,
    progress_registered_at date, paralysis_date date, reception_date date, liquidation_date date,
    has_paralysis boolean, cui text, snip text, execution_status text, paralysis_cause text,
    physical_progress_planned numeric, physical_progress_actual numeric, contract_amount numeric,
    additional_works_amount numeric, deductions_amount numeric, modality text, contractor_kind text,
    contractor_ruc text, contractor_name text, supervisor_kind text, supervisor_ruc text,
    supervisor_name text
  )
  on conflict (infobras_code) do update set
    paralysis_days            = excluded.paralysis_days,
    extension_days            = excluded.extension_days,
    progress_period           = excluded.progress_period,
    progress_registered_at    = excluded.progress_registered_at,
    paralysis_date            = excluded.paralysis_date,
    reception_date            = excluded.reception_date,
    liquidation_date          = excluded.liquidation_date,
    removed_at                = null,
    has_paralysis             = excluded.has_paralysis,
    cui                       = excluded.cui,
    snip                      = excluded.snip,
    execution_status          = excluded.execution_status,
    paralysis_cause           = excluded.paralysis_cause,
    physical_progress_planned = excluded.physical_progress_planned,
    physical_progress_actual  = excluded.physical_progress_actual,
    contract_amount           = excluded.contract_amount,
    additional_works_amount   = excluded.additional_works_amount,
    deductions_amount         = excluded.deductions_amount,
    modality                  = excluded.modality,
    contractor_kind           = excluded.contractor_kind,
    contractor_ruc            = excluded.contractor_ruc,
    contractor_name           = excluded.contractor_name,
    supervisor_kind           = excluded.supervisor_kind,
    supervisor_ruc            = excluded.supervisor_ruc,
    supervisor_name           = excluded.supervisor_name
  where w.removed_at is not null
     or (w.paralysis_days, w.extension_days, w.progress_period, w.progress_registered_at,
         w.paralysis_date, w.reception_date, w.liquidation_date, w.has_paralysis, w.cui, w.snip,
         w.execution_status, w.paralysis_cause, w.physical_progress_planned,
         w.physical_progress_actual, w.contract_amount, w.additional_works_amount,
         w.deductions_amount, w.modality, w.contractor_kind, w.contractor_ruc, w.contractor_name,
         w.supervisor_kind, w.supervisor_ruc, w.supervisor_name)
        is distinct from
        (excluded.paralysis_days, excluded.extension_days, excluded.progress_period,
         excluded.progress_registered_at, excluded.paralysis_date, excluded.reception_date,
         excluded.liquidation_date, excluded.has_paralysis, excluded.cui, excluded.snip,
         excluded.execution_status, excluded.paralysis_cause, excluded.physical_progress_planned,
         excluded.physical_progress_actual, excluded.contract_amount,
         excluded.additional_works_amount, excluded.deductions_amount, excluded.modality,
         excluded.contractor_kind, excluded.contractor_ruc, excluded.contractor_name,
         excluded.supervisor_kind, excluded.supervisor_ruc, excluded.supervisor_name);

  get diagnostics written = row_count;
  return written;
end;
$$;

comment on function public.upsert_infobras_works(jsonb) is
  'INFOBRAS ingest upsert by infobras_code; unchanged rows are not rewritten; restores removed rows.';

revoke execute on function public.upsert_infobras_works(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_infobras_works(jsonb) to service_role;

-- After a full load: marks as removed (today) every visible obra whose code is not in the JSON array
-- of codes the file had. Refuses when the list has fewer than half the visible obras (a partial or
-- broken file must not hide the table). Returns the rows newly marked.
create function public.mark_removed_infobras_works(codes jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  present_count integer;
  visible_count integer;
  marked        integer;
begin
  select count(*) into present_count from jsonb_array_elements(codes);
  select count(*) into visible_count from public.infobras_works where removed_at is null;
  if present_count * 2 < visible_count then
    raise exception 'mark_removed_infobras_works: % codes for % visible obras; refusing to mark more than half as removed',
      present_count, visible_count;
  end if;

  update public.infobras_works w
  set removed_at = current_date
  where w.removed_at is null
    and not exists (
      select 1 from jsonb_array_elements_text(codes) as c (code) where c.code::int = w.infobras_code
    );

  get diagnostics marked = row_count;
  return marked;
end;
$$;

comment on function public.mark_removed_infobras_works(jsonb) is
  'INFOBRAS ingest: marks obras missing from the file as removed (kept, hidden); refuses when fewer than half are present.';

revoke execute on function public.mark_removed_infobras_works(jsonb) from public, anon, authenticated;
grant execute on function public.mark_removed_infobras_works(jsonb) to service_role;

-- Per CUI (obras without a CUI are left out): obra count, statuses, total contract amount, the
-- companies and consortia that executed them, natural-person contractors (count only), the largest
-- physical progress and the date the data describes.
create view public.infobras_by_cui
with (security_invoker = true) as
select
  w.cui,
  count(*)::int                                                                       as obra_count,
  array_agg(distinct w.execution_status) filter (where w.execution_status is not null) as execution_statuses,
  sum(w.contract_amount)                                                              as total_contract_amount,
  array_agg(distinct w.contractor_name)
    filter (where w.contractor_kind in ('empresa', 'consorcio') and w.contractor_name is not null)
                                                                                      as contractors,
  (count(*) filter (where w.contractor_kind = 'persona_natural'))::int                as natural_person_contractors,
  max(w.physical_progress_actual)                                                     as max_physical_progress_actual,
  (select s.data_as_of from public.source_snapshots s where s.source = 'infobras_obras') as data_as_of
from public.infobras_works w
where w.cui is not null
group by w.cui;

comment on view public.infobras_by_cui is
  'INFOBRAS obras aggregated per CUI: count, statuses, total contract amount, contractors (companies and consortia), progress, data_as_of.';

grant select on public.infobras_by_cui to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Contractors (companies and consortia; natural persons have no RUC here and never appear).
--
-- Aggregating 80,000 contracted obras per contractor on every read took about 400 ms (national)
-- and up to 560 ms with the status filter (measured on the full file in postgres 17), so the
-- totals are a materialized view refreshed by the INFOBRAS ingest after every load. Its grain is
-- contractor x the scope of the investment the obra belongs to (department, level, status group),
-- so the ranking honours the same scope, level and status filters as every other list by summing
-- a few rows per contractor. Obras without a CUI in investments have null scope columns and only
-- count when no filter is set. The scope columns reflect investments at refresh time (weekly).
-- Counts of obras in the latest Contraloría paralyzed report are joined live (about 2,300 rows), so
-- a new quarterly edition shows without a refresh.
create materialized view public.contractor_scope_totals as
with names as (
  select
    w.contractor_ruc,
    mode() within group (order by w.contractor_name) as contractor_name,
    mode() within group (order by w.contractor_kind) as contractor_kind
  from public.infobras_works w
  where w.contractor_ruc is not null and w.removed_at is null
  group by w.contractor_ruc
)
select
  w.contractor_ruc,
  n.contractor_name,
  n.contractor_kind,
  i.department_code,
  i.government_level,
  public.status_group(i.status)                                         as status_group,
  count(*)::int                                                         as obra_count,
  coalesce(sum(w.contract_amount), 0)                                   as total_contract_amount,
  coalesce(sum(w.additional_works_amount), 0)                           as total_additional_works,
  (count(*) filter (where w.execution_status = 'Finalizado'))::int      as finished_count,
  (count(*) filter (where w.execution_status = 'En Ejecución'))::int    as in_progress_count,
  (count(*) filter (where w.execution_status = 'Sin Ejecución'))::int   as not_started_count,
  (count(*) filter (where w.execution_status = 'Paralizada'))::int      as infobras_paralyzed_count
from public.infobras_works w
join names n on n.contractor_ruc = w.contractor_ruc
left join public.investments i on i.cui = w.cui
where w.contractor_ruc is not null and w.removed_at is null
group by w.contractor_ruc, n.contractor_name, n.contractor_kind, i.department_code, i.government_level,
         public.status_group(i.status);

comment on materialized view public.contractor_scope_totals is
  'INFOBRAS contractors (companies and consortia) per scope of the investment (department, level, status group): '
  'obra count, contract and additional-works totals, counts by execution status. Refreshed by refresh_contractor_totals().';

create index contractor_scope_totals_ruc_idx on public.contractor_scope_totals (contractor_ruc);
create index contractor_scope_totals_scope_idx
  on public.contractor_scope_totals (department_code, government_level, status_group);

grant select on public.contractor_scope_totals to anon, authenticated;

-- Called by the ingest after a load. Security definer: refreshing requires owning the view.
create function public.refresh_contractor_totals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view public.contractor_scope_totals;
end;
$$;

comment on function public.refresh_contractor_totals() is
  'INFOBRAS ingest: recomputes contractor_scope_totals after a load.';

revoke execute on function public.refresh_contractor_totals() from public, anon, authenticated;
grant execute on function public.refresh_contractor_totals() to service_role;

-- National totals per contractor, for the contractor page.
create view public.contractor_summary
with (security_invoker = true) as
with paralyzed as (
  select w.contractor_ruc, count(*)::int as n
  from public.latest_paralyzed_works p
  join public.infobras_works w on w.infobras_code = p.infobras_code
  where w.contractor_ruc is not null
  group by w.contractor_ruc
)
select
  t.contractor_ruc,
  max(t.contractor_name)                                                as contractor_name,
  max(t.contractor_kind)                                                as contractor_kind,
  sum(t.obra_count)::int                                                as obra_count,
  sum(t.total_contract_amount)                                          as total_contract_amount,
  sum(t.total_additional_works)                                         as total_additional_works,
  sum(t.finished_count)::int                                            as finished_count,
  sum(t.in_progress_count)::int                                         as in_progress_count,
  sum(t.not_started_count)::int                                         as not_started_count,
  sum(t.infobras_paralyzed_count)::int                                  as infobras_paralyzed_count,
  coalesce(max(p.n), 0)                                                 as contraloria_paralyzed_count,
  (select s.data_as_of from public.source_snapshots s where s.source = 'infobras_obras') as data_as_of
from public.contractor_scope_totals t
left join paralyzed p on p.contractor_ruc = t.contractor_ruc
group by t.contractor_ruc;

comment on view public.contractor_summary is
  'INFOBRAS contractor (company or consortium) national totals: obras, contract and additional-works amounts, '
  'counts by execution status, obras in the latest Contraloría paralyzed report, data_as_of.';

grant select on public.contractor_summary to anon, authenticated;

-- Ranking of contractors in a scope. level: GN, GR, GL or ALL; department: null for all of Peru;
-- status_filter: ACTIVE, CLOSED or ALL (the investment's status group); sort_by: 'contract'
-- (total contract amount, the default), 'additional' (additional works) or 'paralyzed' (obras in the
-- latest Contraloría report). total_count = contractors in the scope.
create function public.contractor_ranking(
  level text default 'ALL',
  department int default null,
  status_filter text default 'ALL',
  sort_by text default 'contract',
  page_limit int default 30,
  page_offset int default 0
)
returns table (
  contractor_ruc              text,
  contractor_name             text,
  contractor_kind             text,
  obra_count                  int,
  total_contract_amount       numeric,
  total_additional_works      numeric,
  contraloria_paralyzed_count int,
  total_count                 bigint,
  data_as_of                  date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      coalesce(level, 'ALL') as lv,
      department as dep,
      case when status_filter in ('ACTIVE', 'CLOSED') then status_filter else 'ALL' end as st
  ),
  scoped as (
    select
      t.contractor_ruc,
      max(t.contractor_name)            as contractor_name,
      max(t.contractor_kind)            as contractor_kind,
      sum(t.obra_count)::int            as obra_count,
      sum(t.total_contract_amount)      as total_contract_amount,
      sum(t.total_additional_works)     as total_additional_works
    from public.contractor_scope_totals t, params
    where (params.lv = 'ALL' or t.government_level = params.lv)
      and (params.dep is null or t.department_code = params.dep)
      and (params.st = 'ALL' or t.status_group = params.st)
    group by t.contractor_ruc
  ),
  paralyzed as (
    select w.contractor_ruc, count(*)::int as n
    from public.latest_paralyzed_works p
    join public.infobras_works w on w.infobras_code = p.infobras_code
    left join public.investments i on i.cui = w.cui
    cross join params
    where w.contractor_ruc is not null
      and (params.lv = 'ALL' or i.government_level = params.lv)
      and (params.dep is null or i.department_code = params.dep)
      and (params.st = 'ALL' or public.status_group(i.status) = params.st)
    group by w.contractor_ruc
  )
  select
    s.contractor_ruc,
    s.contractor_name,
    s.contractor_kind,
    s.obra_count,
    s.total_contract_amount,
    s.total_additional_works,
    coalesce(p.n, 0),
    count(*) over (),
    (select ss.data_as_of from public.source_snapshots ss where ss.source = 'infobras_obras')
  from scoped s
  left join paralyzed p on p.contractor_ruc = s.contractor_ruc
  order by
    case coalesce(sort_by, 'contract')
      when 'additional' then s.total_additional_works
      when 'paralyzed' then coalesce(p.n, 0)
      else s.total_contract_amount
    end desc,
    s.total_contract_amount desc,
    s.contractor_ruc
  limit least(greatest(coalesce(page_limit, 30), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

comment on function public.contractor_ranking(text, int, text, text, int, int) is
  'INFOBRAS contractors (companies and consortia) in a scope: level GN/GR/GL/ALL, department or null, '
  'status_filter ACTIVE/CLOSED/ALL (of the investment), sort_by contract/additional/paralyzed; page_limit 1-100.';

revoke execute on function public.contractor_ranking(text, int, text, text, int, int) from public;
grant execute on function public.contractor_ranking(text, int, text, text, int, int) to anon, authenticated;

-- The obras of a contractor with the investment they belong to (when Fiscus has it), for the
-- contractor page: filter by contractor_ruc.
create view public.contractor_works
with (security_invoker = true) as
select
  w.contractor_ruc,
  w.infobras_code,
  w.cui,
  w.execution_status,
  w.contract_amount,
  w.additional_works_amount,
  w.physical_progress_actual,
  i.name   as investment_name,
  i.entity,
  i.department_code,
  i.government_level,
  i.status as investment_status,
  exists (select 1 from public.latest_paralyzed_works p where p.infobras_code = w.infobras_code)
           as contraloria_paralyzed
from public.infobras_works w
left join public.investments i on i.cui = w.cui
where w.contractor_ruc is not null;

comment on view public.contractor_works is
  'INFOBRAS obras of companies and consortia with their investment (name, entity, scope, status) and whether they are in the latest Contraloría paralyzed report.';

grant select on public.contractor_works to anon, authenticated;
