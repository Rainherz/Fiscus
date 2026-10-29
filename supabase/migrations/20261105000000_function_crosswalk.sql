-- Function crosswalk: one functional classification for the whole dataset.
--
-- investments.function mixes two MEF functional classifications: the OLD one, used for projects
-- declared viable roughly 2002-2018 (e.g. "EDUCACION Y CULTURA", "SALUD Y SANEAMIENTO"), and the
-- NEW one, in force since 2009 (e.g. "EDUCACIÓN", "SALUD", "SANEAMIENTO"). Grouping by the raw label
-- splits a category across both. Some old functions map to several new ones, so the mapping uses
-- the functional division, never name similarity.
--
-- public.function_crosswalk is the documented mapping (mirrored in the app by
-- apps/mobile/src/features/investments/domain/functionCrosswalk.ts; a test keeps both in sync).
-- Rule, in public.canonical_function():
--   1. exact (function, division) row;
--   2. else the (function, null) row: the wildcard for every other division of that function;
--   3. else the function itself (already a new label, or identical in both classifications).
-- Labels are compared exactly as stored (MEF publishes them verbatim, so case and accents are
-- significant) after trimming whitespace. A null or blank function stays null ("Sin función").
--
-- investments.function_canonical stores the result. A BEFORE INSERT OR UPDATE trigger keeps it in
-- step with function and functional_division, so neither ingest has to know about the crosswalk.
-- function and functional_division keep the original MEF labels (the detail screen shows them as
-- "Clasificación original del MEF").
--
-- Changing the crosswalk later requires a migration that also re-backfills function_canonical
-- (as below): rows are only recomputed when they are written.

create table public.function_crosswalk (
  source_function    text not null check (source_function = btrim(source_function)),
  -- null: every division of source_function without its own row.
  source_division    text check (source_division = btrim(source_division)),
  canonical_function text not null check (canonical_function = btrim(canonical_function)),
  -- A primary key cannot include the nullable wildcard column; NULLS NOT DISTINCT makes the
  -- wildcard row unique per function too.
  constraint function_crosswalk_source_key unique nulls not distinct (source_function, source_division)
);

comment on table public.function_crosswalk is
  'Documented mapping of the old MEF functional classification (pre-2009 labels) to the current one. '
  'Match (source_function, source_division) exactly, else (source_function, null), else the function maps to itself. '
  'Read by public.canonical_function(); mirrored in the app (functionCrosswalk.ts).';
comment on column public.function_crosswalk.source_division is
  'Functional division of the old classification; null is the wildcard for every other division of source_function.';

insert into public.function_crosswalk (source_function, source_division, canonical_function) values
  ('ADMINISTRACION Y PLANEAMIENTO', null, 'PLANEAMIENTO, GESTIÓN Y RESERVA DE CONTINGENCIA'),
  ('AGRARIA', 'PRESERVACION DE LOS RECURSOS NATURALES RENOVABLES', 'AMBIENTE'),
  ('AGRARIA', null, 'AGROPECUARIA'),
  ('ASISTENCIA Y PREVISION SOCIAL', 'PREVISION', 'PREVISIÓN SOCIAL'),
  ('ASISTENCIA Y PREVISION SOCIAL', null, 'PROTECCIÓN SOCIAL'),
  ('DEFENSA Y SEGURIDAD CIUDADANA', null, 'DEFENSA Y SEGURIDAD NACIONAL'),
  ('EDUCACION Y CULTURA', 'CULTURA', 'CULTURA Y DEPORTE'),
  ('EDUCACION Y CULTURA', 'EDUCACION FISICA Y DEPORTES', 'CULTURA Y DEPORTE'),
  ('EDUCACION Y CULTURA', null, 'EDUCACIÓN'),
  ('ENERGIA Y RECURSOS MINERALES', 'RECURSOS MINERALES', 'MINERÍA'),
  ('ENERGIA Y RECURSOS MINERALES', null, 'ENERGÍA'),
  ('INDUSTRIA, COMERCIO Y SERVICIOS', 'TURISMO', 'TURISMO'),
  ('INDUSTRIA, COMERCIO Y SERVICIOS', 'COMERCIO', 'COMERCIO'),
  ('INDUSTRIA, COMERCIO Y SERVICIOS', 'INDUSTRIA', 'INDUSTRIA'),
  ('INDUSTRIA, COMERCIO Y SERVICIOS', null, 'COMERCIO'),
  ('SALUD Y SANEAMIENTO', 'SANEAMIENTO', 'SANEAMIENTO'),
  ('SALUD Y SANEAMIENTO', 'PROTECCION DEL MEDIO AMBIENTE', 'AMBIENTE'),
  ('SALUD Y SANEAMIENTO', null, 'SALUD');

-- Row Level Security: public read, no public writes (same as the other tables).
alter table public.function_crosswalk enable row level security;

create policy "function crosswalk is publicly readable"
  on public.function_crosswalk for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.function_crosswalk from anon, authenticated;
grant select on public.function_crosswalk to anon, authenticated, service_role;

-- The crosswalk rule. Stable (reads the table); security invoker, so callers need select on
-- function_crosswalk (granted above).
create function public.canonical_function(fn text, division text)
returns text
language sql
stable
set search_path = ''
as $$
  with source as (
    select nullif(btrim(fn), '') as fn, nullif(btrim(division), '') as division
  )
  select coalesce(
    (
      select c.canonical_function
      from public.function_crosswalk c
      where c.source_function = s.fn
        and (c.source_division = s.division or c.source_division is null)
      -- The exact division row (false) before the wildcard row (true).
      order by c.source_division is null
      limit 1
    ),
    s.fn
  )
  from source s;
$$;

comment on function public.canonical_function(text, text) is
  'Canonical (current MEF) function for a function and functional division, per public.function_crosswalk. Null when the function is null or blank.';

alter table public.investments add column function_canonical text;

comment on column public.investments.function_canonical is
  'function in the current MEF classification (public.canonical_function of function and functional_division). '
  'Set by the set_function_canonical trigger; function and functional_division keep the original labels.';

-- Backfill. touch_ingested_at is disabled meanwhile: it would see the new value as a data change
-- and move ingested_at for every row, but nothing came from the MEF. The cost-history triggers
-- only fire on viable_amount/updated_cost and stay quiet. Rows without function stay null and are
-- not rewritten.
alter table public.investments disable trigger investments_touch_ingested_at;

update public.investments
set function_canonical = public.canonical_function(function, functional_division)
where function_canonical is distinct from public.canonical_function(function, functional_division);

alter table public.investments enable trigger investments_touch_ingested_at;

create index investments_function_canonical_idx on public.investments (function_canonical);

-- Keeps function_canonical derived on every insert and update (including a direct write of
-- function_canonical itself, which is overwritten).
--
-- Interplay with touch_ingested_at, the BEFORE UPDATE trigger that returns null (skips the write)
-- when no data column changed:
--   * BEFORE triggers of the same event fire in alphabetical order of their names:
--     investments_set_function_canonical runs before investments_touch_ingested_at, so touch
--     compares a NEW row whose function_canonical is already final.
--   * An identical re-upsert recomputes the same value from the unchanged function and division,
--     so NEW still equals OLD and touch skips the row: no new row version, no ingested_at change,
--     no cost-history row. Neither ingest writes function_canonical (the SSI upsert sends only its
--     own columns; upsert_open_data_investments lists its columns), so NEW carries OLD's value
--     before this trigger recomputes it.
--   * function_canonical is deliberately NOT in touch's ignore list: it only differs from OLD when
--     function or functional_division changed (a real change anyway) or when the crosswalk changed
--     (then rewriting the row is the correct outcome). Ignoring it would also make any later
--     backfill UPDATE of function_canonical a silent no-op.
--   * If touch returns null, later BEFORE triggers are not run and the row is left as is.
create function public.set_function_canonical()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.function_canonical := public.canonical_function(new.function, new.functional_division);
  return new;
end;
$$;

create trigger investments_set_function_canonical
  before insert or update on public.investments
  for each row execute function public.set_function_canonical();

revoke execute on function public.set_function_canonical() from public, anon, authenticated;

-- Views that group or filter by function now use function_canonical. The column keeps its name
-- (function) so the app and other readers keep working; it now holds the canonical label.
create or replace view public.function_summary
with (security_invoker = true) as
select
  function_canonical       as function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
where government_level = 'GR'
group by function_canonical;

create or replace view public.department_function_summary
with (security_invoker = true) as
select
  department_code,
  function_canonical       as function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
where government_level = 'GR'
group by department_code, function_canonical;

create or replace view public.function_summary_by_level
with (security_invoker = true) as
select
  case when grouping(government_level) = 1 then 'ALL' else government_level end as government_level,
  function_canonical       as function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
group by grouping sets ((government_level, function_canonical), (function_canonical));

create or replace view public.department_function_summary_by_level
with (security_invoker = true) as
select
  department_code,
  case when grouping(government_level) = 1 then 'ALL' else government_level end as government_level,
  function_canonical       as function,
  count(*)                 as investment_count,
  sum(updated_cost)        as total_updated_cost,
  sum(cost_increase)       as total_cost_increase,
  avg(execution_progress)  as avg_execution_progress
from public.investments
where department_code is not null
group by grouping sets ((department_code, government_level, function_canonical), (department_code, function_canonical));

comment on view public.function_summary is
  'Per-function aggregates of regional governments (GR) nationwide. function is the canonical function (function_crosswalk).';
comment on view public.department_function_summary is
  'Per-department function aggregates of regional governments (GR). function is the canonical function (function_crosswalk).';
comment on view public.function_summary_by_level is
  'function_summary per government level (GN, GR, GL, or ALL), nationwide including rows without department. function is canonical.';
comment on view public.department_function_summary_by_level is
  'department_function_summary per government level (GN, GR, GL, or ALL). Rows without department_code are excluded. function is canonical.';

-- The app reads the same columns from investments and stalled_investments_by_level; the view
-- gains function_canonical as its last column (create or replace view can only append).
create or replace view public.stalled_investments_by_level
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
  i.updated_cost - i.accrued_total as pending_amount,
  i.function_canonical
from public.investments i
cross join reference r
where i.status = 'ACTIVO'
  and i.updated_cost_valid
  and i.execution_progress between 0.05 and 0.95
  and i.last_accrual_month < r.reference_month - interval '12 months';
