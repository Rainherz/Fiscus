-- INFOBRAS contract amounts typed without their decimal separator.
--
-- The source file itself has contract amounts that lost their decimal separator: obra 507248
-- (OBRASCON HUARTE LAIN) has "Monto del contrato en soles" 113862565000 while its "Costo de obra
-- según Expediente técnico" is 68571690 63 (S/ 68.6 M); obra 504362 has 21560454080 for an
-- expediente of 25464014 95. In the dataset of 31-10-2026, 778 of the 78,633 obras with a contract
-- amount exceed 10 times their expediente cost (86 exceed 100 times), adding S/ 243,409 M of bogus
-- amounts that put the wrong contractors at the top of the ranking.
--
-- Regla de Fiscus: a contract amount is not valid when it is greater than 10 times the expediente
-- técnico cost of the same obra. The amount stays stored as published (contract_amount), but
-- contract_amount_valid marks it and every total sums only valid amounts; the count of invalid
-- amounts is exposed so the app can say how many were excluded. Amounts without an expediente cost
-- to compare are kept as valid. The supervision contract amount is not stored, so no rule applies.
--
-- Keep the rule in sync with packages/ingest/src/domain/infobrasWorks.ts (isContractAmountValid)
-- and apps/mobile/src/features/investments/domain/infobras.ts.

-- Costo de obra en soles según ET; the ingest falls back to "Costo de obra según Expediente
-- técnico" when the currency is soles and the soles column is blank or 0.
alter table public.infobras_works add column expediente_cost_soles numeric check (expediente_cost_soles > 0);

comment on column public.infobras_works.expediente_cost_soles is
  'Costo de obra según expediente técnico in soles (INFOBRAS); the reference of contract_amount_valid.';

alter table public.infobras_works add column contract_amount_valid boolean not null generated always as (
  contract_amount is null
  or expediente_cost_soles is null
  or expediente_cost_soles <= 0
  or contract_amount <= 10 * expediente_cost_soles
) stored;

comment on column public.infobras_works.contract_amount_valid is
  'Regla de Fiscus: false when contract_amount is greater than 10 times expediente_cost_soles of the same obra '
  '(a typing error in the source, such as a missing decimal separator). Totals sum only valid amounts.';

-- The upsert gains expediente_cost_soles (in the whitelist, the update and the no-op comparison).
-- contract_amount_valid is generated, so it is neither sent nor compared.
create or replace function public.upsert_infobras_works(rows jsonb)
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
    expediente_cost_soles, additional_works_amount, deductions_amount, modality, contractor_kind,
    contractor_ruc, contractor_name, supervisor_kind, supervisor_ruc, supervisor_name
  )
  select
    r.infobras_code, r.paralysis_days, r.extension_days, r.progress_period, r.progress_registered_at,
    r.paralysis_date, r.reception_date, r.liquidation_date, r.has_paralysis, r.cui, r.snip,
    r.execution_status, r.paralysis_cause, r.physical_progress_planned, r.physical_progress_actual,
    r.contract_amount, r.expediente_cost_soles, r.additional_works_amount, r.deductions_amount,
    r.modality, r.contractor_kind, r.contractor_ruc, r.contractor_name, r.supervisor_kind,
    r.supervisor_ruc, r.supervisor_name
  from jsonb_to_recordset(rows) as r (
    infobras_code int, paralysis_days int, extension_days int, progress_period date,
    progress_registered_at date, paralysis_date date, reception_date date, liquidation_date date,
    has_paralysis boolean, cui text, snip text, execution_status text, paralysis_cause text,
    physical_progress_planned numeric, physical_progress_actual numeric, contract_amount numeric,
    expediente_cost_soles numeric, additional_works_amount numeric, deductions_amount numeric,
    modality text, contractor_kind text, contractor_ruc text, contractor_name text,
    supervisor_kind text, supervisor_ruc text, supervisor_name text
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
    expediente_cost_soles     = excluded.expediente_cost_soles,
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
         w.physical_progress_actual, w.contract_amount, w.expediente_cost_soles,
         w.additional_works_amount, w.deductions_amount, w.modality, w.contractor_kind,
         w.contractor_ruc, w.contractor_name, w.supervisor_kind, w.supervisor_ruc, w.supervisor_name)
        is distinct from
        (excluded.paralysis_days, excluded.extension_days, excluded.progress_period,
         excluded.progress_registered_at, excluded.paralysis_date, excluded.reception_date,
         excluded.liquidation_date, excluded.has_paralysis, excluded.cui, excluded.snip,
         excluded.execution_status, excluded.paralysis_cause, excluded.physical_progress_planned,
         excluded.physical_progress_actual, excluded.contract_amount, excluded.expediente_cost_soles,
         excluded.additional_works_amount, excluded.deductions_amount, excluded.modality,
         excluded.contractor_kind, excluded.contractor_ruc, excluded.contractor_name,
         excluded.supervisor_kind, excluded.supervisor_ruc, excluded.supervisor_name);

  get diagnostics written = row_count;
  return written;
end;
$$;

-- Per CUI: the total contract amount sums only valid amounts; invalid_contract_count (appended last,
-- as create or replace view requires) counts the amounts left out.
create or replace view public.infobras_by_cui
with (security_invoker = true) as
select
  w.cui,
  count(*)::int                                                                       as obra_count,
  array_agg(distinct w.execution_status) filter (where w.execution_status is not null) as execution_statuses,
  sum(w.contract_amount) filter (where w.contract_amount_valid)                       as total_contract_amount,
  array_agg(distinct w.contractor_name)
    filter (where w.contractor_kind in ('empresa', 'consorcio') and w.contractor_name is not null)
                                                                                      as contractors,
  (count(*) filter (where w.contractor_kind = 'persona_natural'))::int                as natural_person_contractors,
  max(w.physical_progress_actual)                                                     as max_physical_progress_actual,
  (select s.data_as_of from public.source_snapshots s where s.source = 'infobras_obras') as data_as_of,
  (count(*) filter (where not w.contract_amount_valid))::int                          as invalid_contract_count
from public.infobras_works w
where w.cui is not null
group by w.cui;

comment on view public.infobras_by_cui is
  'INFOBRAS obras aggregated per CUI: count, statuses, total of valid contract amounts (Regla de Fiscus), '
  'contractors (companies and consortia), progress, data_as_of, count of invalid contract amounts.';

-- Contractor totals: the materialized view and the views and function built on it are recreated
-- with valid-only contract totals and invalid_contract_count.
drop function public.contractor_ranking(text, int, text, text, int, int);
drop view public.contractor_summary;
drop materialized view public.contractor_scope_totals;

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
  coalesce(sum(w.contract_amount) filter (where w.contract_amount_valid), 0) as total_contract_amount,
  coalesce(sum(w.additional_works_amount), 0)                           as total_additional_works,
  (count(*) filter (where w.execution_status = 'Finalizado'))::int      as finished_count,
  (count(*) filter (where w.execution_status = 'En Ejecución'))::int    as in_progress_count,
  (count(*) filter (where w.execution_status = 'Sin Ejecución'))::int   as not_started_count,
  (count(*) filter (where w.execution_status = 'Paralizada'))::int      as infobras_paralyzed_count,
  (count(*) filter (where not w.contract_amount_valid))::int            as invalid_contract_count
from public.infobras_works w
join names n on n.contractor_ruc = w.contractor_ruc
left join public.investments i on i.cui = w.cui
where w.contractor_ruc is not null and w.removed_at is null
group by w.contractor_ruc, n.contractor_name, n.contractor_kind, i.department_code, i.government_level,
         public.status_group(i.status);

comment on materialized view public.contractor_scope_totals is
  'INFOBRAS contractors (companies and consortia) per scope of the investment (department, level, status group): '
  'obra count, total of valid contract amounts (Regla de Fiscus), additional-works total, counts by execution '
  'status, count of invalid contract amounts. Refreshed by refresh_contractor_totals().';

create index contractor_scope_totals_ruc_idx on public.contractor_scope_totals (contractor_ruc);
create index contractor_scope_totals_scope_idx
  on public.contractor_scope_totals (department_code, government_level, status_group);

grant select on public.contractor_scope_totals to anon, authenticated;

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
  (select s.data_as_of from public.source_snapshots s where s.source = 'infobras_obras') as data_as_of,
  sum(t.invalid_contract_count)::int                                    as invalid_contract_count
from public.contractor_scope_totals t
left join paralyzed p on p.contractor_ruc = t.contractor_ruc
group by t.contractor_ruc;

comment on view public.contractor_summary is
  'INFOBRAS contractor (company or consortium) national totals: obras, valid contract amounts (Regla de Fiscus) '
  'and additional works, counts by execution status, obras in the latest Contraloría paralyzed report, '
  'data_as_of, count of invalid contract amounts.';

grant select on public.contractor_summary to anon, authenticated;

-- Same parameters as before; the result gains invalid_contract_count (contract amounts of the
-- contractor in the scope left out of total_contract_amount by the Regla de Fiscus).
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
  invalid_contract_count      int,
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
      sum(t.total_additional_works)     as total_additional_works,
      sum(t.invalid_contract_count)::int as invalid_contract_count
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
    s.invalid_contract_count,
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
  'status_filter ACTIVE/CLOSED/ALL (of the investment), sort_by contract/additional/paralyzed; page_limit 1-100. '
  'total_contract_amount sums only valid amounts (Regla de Fiscus); invalid_contract_count counts the rest.';

revoke execute on function public.contractor_ranking(text, int, text, text, int, int) from public;
grant execute on function public.contractor_ranking(text, int, text, text, int, int) to anon, authenticated;

-- The obras of a contractor gain contract_amount_valid (appended last), so the contractor page shows
-- an invalid amount as such instead of the figure.
create or replace view public.contractor_works
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
           as contraloria_paralyzed,
  w.contract_amount_valid
from public.infobras_works w
left join public.investments i on i.cui = w.cui
where w.contractor_ruc is not null;
