-- Data freshness: when each source was last updated and last checked, for the app's stale-data
-- banner and the data-freshness workflow (.github/workflows/data-freshness.yml).
--
-- source_snapshots.checked_at: the last successful open-data run, including runs that skipped an
-- unchanged file. ingested_at keeps meaning "last time the file was actually ingested". Existing
-- rows are backfilled with ingested_at.

alter table public.source_snapshots add column checked_at timestamptz;

update public.source_snapshots set checked_at = ingested_at;

alter table public.source_snapshots
  alter column checked_at set not null,
  alter column checked_at set default now();

comment on column public.source_snapshots.checked_at is
  'Last successful run of the ingest for this file, including runs that skipped it because it was unchanged.';

-- One row per source:
--   source = 'ssi'                       the SSI report (ingest_runs).
--     last_success_at  finished_at of the latest run with at least one department ingested
--                      (cardinality(departments_ok) > 0). A run where every department failed is
--                      not a success; a partial run is, because it refreshed the departments in
--                      departments_ok (the failed ones are listed in departments_failed). The ingest
--                      CLI uses the same rule: it exits 1 only when every department failed.
--     last_checked_at  finished_at of the latest run, successful or not.
--   source = <source_snapshots.source>   an open-data file (e.g. 'mef_detalle_inversiones').
--     last_success_at  ingested_at: the last time the file was ingested.
--     last_checked_at  checked_at: the last successful run, also when the file was unchanged.
-- Readable by anon through RLS on ingest_runs and source_snapshots (security_invoker).
create view public.data_freshness
with (security_invoker = true) as
select
  'ssi'::text as source,
  (select max(finished_at) from public.ingest_runs where cardinality(departments_ok) > 0) as last_success_at,
  (select max(finished_at) from public.ingest_runs)                                        as last_checked_at
union all
select
  source,
  ingested_at as last_success_at,
  checked_at  as last_checked_at
from public.source_snapshots;

comment on view public.data_freshness is
  'Per source: last successful update and last check. SSI success = a run with at least one department ingested; open data: ingested_at and checked_at of source_snapshots.';

grant select on public.data_freshness to anon, authenticated;
