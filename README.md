# Fiscus

Read-only public dashboard of Peruvian government investment projects. This repository holds the data
backend (a daily ingest of MEF data into Supabase) and the app in `apps/mobile` (iOS, Android and web).

## Data sources

Two MEF sources load the same `investments` table, keyed by CUI.

### SSI report (regional governments, daily from Peru)

MEF "Seguimiento de Inversiones" (SSI) report, downloaded as XLSX per department:

- `POST https://ofi5.mef.gob.pe/inviertews/Ssi/expRepSSIDet`
- Body: `{"sect":"","plie":"<1..25>","dpto":0,"prov":0,"dist":0,"tipo":"GR"}`. `plie` is the department code.
- Each call takes about 50 s, so departments are fetched one after another. Each attempt has a 120 s timeout and is retried 3 times with exponential backoff.
- Regional governments (GR) only, including closed projects. The host blocks GitHub runners, so it runs from a machine in Peru (see "Daily ingest").

### Open data (every level, active projects, GitHub Actions)

`https://fs.datosabiertos.mef.gob.pe/datastorefiles/DETALLE_INVERSIONES.csv`: about 250 MB, UTF-8 with
BOM, every field quoted, about 150,000 rows. It lists only ACTIVE investments, of national (GN), regional
(GR) and local (GL) governments, with location (ubigeo, coordinates), physical progress and the
executing unit. MEF does not refresh it every day.

- `OpenDataCsvSource` sends a HEAD request first. When `Last-Modified` and `Content-Length` match the
  last successful ingest in `source_snapshots`, the run logs it and exits 0 without downloading
  (`--force` ingests anyway).
- The file is streamed and parsed row by row with `csv-parse` (never loaded whole). `ALTERNATIVA`
  (free text, about 37 % of the bytes) is dropped by the parser, and unmapped columns are never stored.
- `accrued_total = DEVEN_ACUMUL_ANIO_ANT + DEV_ANIO_ACTUAL`, rounded to cents. This matches the SSI total
  to the cent (CUI 2094808: S/ 1,459,731,800.72). `PIM_ANIO_ACTUAL` and `DEV_ANIO_ACTUAL` go into the
  existing `pim` and `accrued_year` columns, which hold the same figures in the SSI.
- Coordinates outside Peru's bounding box (latitude -19 to 0, longitude -82 to -68), including the
  source's `0.0`, are stored as null. `physical_progress` is null unless `TIENE_AVAN_FISICO = SI` and
  the value is between 0 and 100. `ULTIMO_DEVENGADO`-style `yyyymm` months become first-of-month dates.
- `department_code` comes from the first two digits of `UBIGEO` (INEI department codes match 1-25), then
  from the `DEPARTAMENTO` name when the ubigeo is blank. Multi-department national investments
  (ubigeo `99...`) have no department and only count nationwide.
- Rows without CUI (67 in the October 2026 file) are skipped; a repeated CUI keeps the last row.
- Rows are upserted 1,000 at a time through `public.upsert_open_data_investments`. Ownership rule
  (`data_source`): once the SSI has loaded an investment (`ssi`), the open-data ingest only fills the
  columns the SSI lacks (location, coordinates, physical progress, previous-years accrual, pending
  balance, executing unit, `source_seen_at`). The SSI figures stay untouched, because they are
  refreshed daily and the open-data file can be days older, and the cost history does not log
  back-and-forth changes. Investments only the file has (`open_data`) get every column.
- `.github/workflows/open-data-ingest.yml` runs it daily at 10:00 UTC (05:00 Lima, after the SSI run)
  and on manual dispatch (`force` input).

Views. The existing views (`region_comparison`, `stalled_investments`, `accrual_reference_month`,
`function_summary`, `department_function_summary`, `department_summary`) now filter
`government_level = 'GR'` explicitly, so their numbers stay the same when national and local rows
arrive. New `*_by_level` views (`region_comparison_by_level`, `stalled_investments_by_level`,
`function_summary_by_level`, `department_function_summary_by_level`) have a `government_level` column
(`GN`, `GR`, `GL`, or `ALL` for every level) for the app to filter on. `region_comparison_by_level`
only has the 25 departments. **The app also reads `investments` and `investment_cost_changes`
directly. Those reads need a level filter before the open-data workflow runs against production,
otherwise rankings, search and "Aumentos recientes" will start to include national and local
projects.**

Size (measured on Postgres 17 with the October 2026 file plus 27,296 SSI-like GR rows): `investments`
takes 142 MB right after the first load (127 MB after `VACUUM FULL`: 104 MB heap, 24 MB indexes) and
`investment_cost_changes` 26-28 MB (one `first_seen` row per new investment). Each ingest rewrites every
row it receives, so until autovacuum reuses the space the table can reach about twice its live size
(248 MB measured after a second full ingest).

## Layout

```
packages/ingest/src/
  domain/        Investment and OpenDataInvestment mappers, normalizers, cost metrics,
                 department codes (pure)
  ports/         InvestmentSource, InvestmentRepository, OpenDataSource, OpenDataRepository
  adapters/      MefXlsxSource (HTTP + XLSX), ssiReportParser, SupabaseInvestmentRepository,
                 JsonFileInvestmentRepository (dry-run), OpenDataCsvSource (HEAD + streamed CSV),
                 SupabaseOpenDataRepository, DryRunOpenDataRepository
  application/   runIngest (per-department fault isolation), runOpenDataIngest (snapshot check,
                 chunked upsert)
  cli.ts         SSI entrypoint
  openDataCli.ts open-data entrypoint
apps/mobile/src/
  app/           Expo Router routes: (tabs) index, rankings, categories, search; region; investment/[cui]; category/[fn]
  features/      investments (domain, query specs, port, Supabase + in-memory adapters, hooks),
                 department, home, rankings, regions, categories, search, investment-detail (container + view)
  shared/        theme tokens, formatters, UI atoms
supabase/migrations/   schema, RLS, summary views
.github/workflows/     ingest.yml (manual SSI ingest), open-data-ingest.yml (daily open data),
                       ci.yml (typecheck + tests)
```

The XLSX parser uses `exceljs`. It is maintained on npm, has TypeScript types, and exposes typed
hyperlink, rich-text and formula cell values that the parser unwraps. The SheetJS `xlsx` package on npm
is stuck at 0.18.5, and newer versions are only published on SheetJS's own CDN.

## Running locally

Requires Node 22+ and pnpm.

```sh
pnpm install
pnpm test
pnpm typecheck

# Dry run: no database. Writes normalized JSON to packages/ingest/out/
DEPARTMENTS=4 pnpm ingest --dry-run
# or choose the output directory
DEPARTMENTS=4,15 pnpm ingest --dry-run --out /absolute/path

# Real run into Supabase
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest
```

```sh
# Open data. Dry run: streams the file and prints counts by level, coordinates, duplicates...
pnpm ingest:open-data --dry-run
pnpm ingest:open-data --dry-run --source /path/to/DETALLE_INVERSIONES.csv --out /absolute/rows.ndjson
pnpm ingest:open-data --dry-run --limit 1000
# Real run (skips when the file is unchanged since the last ingest; --force ingests anyway)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:open-data [--force]
```

`--source` takes a URL or a local path (default: the MEF URL); `--out` writes the exact rows a real run
would send, as NDJSON; `--limit N` stops after N rows and never records the snapshot.

Leave `DEPARTMENTS` unset to ingest all 25 departments. The process exits non-zero only when every
department fails. Rows without a CUI are skipped and counted (`rowsSkipped`, `ingest_runs.rows_skipped`).

Apply the schema with the Supabase CLI (`supabase db push`) or by pasting
`supabase/migrations/*.sql` into the SQL editor.

## Mobile and web app

Expo SDK 58 with Expo Router, TanStack Query and `@supabase/supabase-js`. It reads with the public anon
key, and RLS keeps that key read-only.

```sh
cp apps/mobile/.env.example apps/mobile/.env   # then set EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm --filter @fiscus/mobile start             # QR code for Expo Go; press w for web
pnpm --filter @fiscus/mobile web               # web only
pnpm --filter @fiscus/mobile test
pnpm --filter @fiscus/mobile typecheck
pnpm --filter @fiscus/mobile export:web        # static web build in apps/mobile/dist
```

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL (public) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key (public, read-only through RLS). Never use the service role key here. |
| `EXPO_PUBLIC_USE_MOCK` | `1` uses bundled sample records from Arequipa, so no credentials are needed |

To run the app on a phone, install Expo Go, keep the phone on the same network as your computer, and scan
the QR code that `start` prints. If the network blocks LAN, use `pnpm --filter @fiscus/mobile exec expo start --tunnel`.

Scope: every screen shows either all of Peru ("TODO EL PERÚ", the default) or one department. The last
choice is kept on the device with `@react-native-async-storage/async-storage` (localStorage on web); if
the storage fails, the app falls back to all of Peru. The screens wait until the stored choice is read, so
they never fetch or show the wrong scope (the header shows a placeholder meanwhile). Repository methods
take an optional `departmentCode`: undefined means all of Peru, and the query specs drop the department
filter. National reads stay paged or limited, never whole-table fetches.

The "Categorías" screen reads the `department_function_summary` view for a department
(`supabase/migrations/20261026120000_create_department_function_summary.sql`) and the `function_summary`
view for all of Peru, so apply those migrations before you use it.

Cost history: MEF only publishes the current cost, so Fiscus records its own history in
`investment_cost_changes` from 27/10/2026 onwards
(`supabase/migrations/20261027200000_create_investment_cost_changes.sql`). Every investment starts with a
`baseline` row; triggers add a `changed` row when `viable_amount` or `updated_cost` changes. The detail
screen shows this as "Historial del costo", and home lists the latest increases of the selected scope under
"Aumentos recientes". Earlier history is unknown. The demo mode includes an invented history for Majes
Siguas II, only so these screens have something to show.

Sin gasto reciente: active projects (`status = 'ACTIVO'`, valid updated cost) that spent between 5 % and
95 % of their cost and whose last accrual month is more than 12 months before the reference month, the
latest `last_accrual_month` in the dataset (not today, so MEF publication delays do not inflate the list).
The `stalled_investments` view (`supabase/migrations/20261029000000_create_stalled_investments.sql`)
applies the rule and adds `months_without_accrual` and `pending_amount`. The app shows them as a
"Sin gasto reciente" tab in Rankings, a block on home and a line on the detail screen. The demo mode adds
invented projects marked "(demo)" so these screens have something to show.

Region picker: the selector in the header ("TODO EL PERÚ ▾" or the region name) opens the "Elegir región"
screen (`/region`). Its first option is "Todo el Perú"; below, it compares all departments, sorted by total cost increase (S/ or %), "Sin gasto reciente"
projects, or projects that spent more than their updated cost. It reads the `region_comparison` view
(`supabase/migrations/20261030000000_create_region_comparison.sql`): cost figures only use valid updated
costs, and the increase total adds positive increases only (reductions are not netted). The current choice
is marked "ACTUAL"; tapping an option selects it and returns to the previous screen. Departments without
data, and every department while the comparison loads or fails, are listed alphabetically so picking a
region never depends on it. Rankings, Categorías and Buscar work within the selected scope; listing all of Peru, every row shows its
region, and Buscar searches names nationwide (an exact CUI is always searched nationwide). Old
`?tab=regions` links open the default Rankings tab.

National home: "EL MAYOR AUMENTO DEL PAÍS" (with its region), the national top 5 of increases,
"Regiones con más aumentos" (top 5 regions by total increase from `region_comparison`; tapping one selects
it, "Ver las 25" opens the picker), then "Sin gasto reciente" and "Aumentos recientes" for all of Peru.
A region's home keeps its own layout. The older `department_summary` view is unchanged but not used by the app.

Comparar regiones (`/compare?a=4&b=8`, shareable): two departments side by side from `region_comparison`,
one row per metric (size, increases, execution) with both values printed and a mirrored bar pair (left
region in ink, right in signal yellow with an ink outline), plus each region's project with the largest
increase. Percent-of-projects rows divide by projects with a valid updated cost. Missing or unknown codes
fall back to the current region (or the largest total increase) and the next one by total increase, and the
URL is rewritten. Choosing a region here never changes the app's scope. It opens from "Comparar dos
regiones" on the national home and at the top of the picker, and from "Comparar con otra región" on a
region's home.

## Daily ingest

`ofi5.mef.gob.pe` drops TCP connections from GitHub-hosted runners (US datacenter IPs), so the ingest
cannot run on a GitHub Actions schedule. It runs from a machine in Peru through a systemd user timer:

```ini
# ~/.config/systemd/user/fiscus-ingest.service
[Unit]
Description=Fiscus: ingest MEF SSI report into Supabase
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/Fiscus
# .env.local holds SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
EnvironmentFile=/path/to/Fiscus/.env.local
ExecStart=/path/to/pnpm ingest
TimeoutStartSec=90min
```

```ini
# ~/.config/systemd/user/fiscus-ingest.timer
[Timer]
OnCalendar=*-*-* 04:00:00 America/Lima
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now fiscus-ingest.timer
systemctl --user start fiscus-ingest        # run now
journalctl --user -u fiscus-ingest -f       # follow logs
```

`Persistent=true` runs a missed ingest at the next login when the machine was off at 04:00.
The `ingest.yml` workflow is kept for manual dispatch only.

## Secrets (GitHub Actions)

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. It bypasses RLS, so use it server-side only and never ship it to clients. |

The public dashboard reads with the anon key. RLS lets the anon key run SELECT and nothing else.

## Known caveats

- **Incomplete TLS chain.** `ofi5.mef.gob.pe` does not send its intermediate certificate. Verification
  is not disabled. Instead, the intermediate (Entrust OV TLS Issuing RSA CA 2, from
  `http://crt.sectigo.com/EntrustOVTLSIssuingRSACA2.crt`) is committed as
  `packages/ingest/certs/entrust-ov-tls-issuing-rsa-ca2.pem` and loaded with `NODE_EXTRA_CA_CERTS`
  (in the `ingest` script and in the workflow). If MEF rotates its certificate, replace that file.
- **National and local governments come only from open data.** The SSI ingest requests `tipo: "GR"`.
  The open-data file has GN and GL too, but only active projects, so closed national and local
  projects are not in Fiscus.
- **PIM year label.** The SSI report headers say `PIM 2023` / `DEVENGADO 2023` even in 2026 reports, and
  SSI rows store that header year in `pim_year`. The open-data file has the same figures as
  `PIM_ANIO_ACTUAL` / `DEV_ANIO_ACTUAL` with `ANIO_PROCESO = 2026` (checked on CUIs 2114611 and
  2322636), so they are the current-year budget and accrual. Open-data rows store `pim_year = 2026`.
- `execution_progress` is null when `accrued_total` is empty. It is not coerced to 0, because the source
  does not say whether empty means "no accrual" or "unknown".
- **`execution_progress` is money, not physical progress.** It is `accrued_total / updated_cost`, the
  share of the updated cost already spent. The app labels it "Gastado X % del costo". It can exceed
  100 % legitimately (about 12 % of projects with data): the bar is capped at 100 % and the app states
  the overspend in soles instead.
- **Placeholder and truncated updated costs.** MEF publishes some `updated_cost` values like S/ 1,
  3, 5 or 10, and others that look truncated (e.g. S/ 4,558.66 for a project with a S/ 1,990,720
  viable amount, which would read as 31,206 % spent). An updated cost is invalid when it is below
  S/ 1,000, or below 1 % of a positive `viable_amount` (only the S/ 1,000 floor applies when the
  viable amount is missing or not positive). Then `updated_cost_valid` is false and
  `cost_increase`, `cost_increase_pct` and `execution_progress` are null
  (`supabase/migrations/20261027000000_invalidate_placeholder_updated_cost.sql` and
  `20261028000000_relative_updated_cost_validity_and_spent_anomaly.sql`; mirrored in
  `packages/ingest/src/domain/metrics.ts`). The app keeps those projects out of the home hero and
  the increase and cost rankings, and shows "Costo actualizado no válido en la fuente MEF" on their
  detail screen.
- **Unusual accrued totals.** Some projects have a coherent updated cost but an accrued total far
  above it (e.g. CUI 2057689: S/ 18.8 M accrued against S/ 299,700, 6,262 %). They stay visible:
  `spent_anomaly` is true when `execution_progress` is above 10, and the app adds
  "Dato inusual en la fuente MEF: lo gastado supera 10 veces el costo actualizado." under the bar
  (detail screen and home hero), next to the usual overspend line.
