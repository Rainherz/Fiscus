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
  balance, executing unit, `open_data_updated_at`). The SSI figures stay untouched, because they are
  refreshed daily and the open-data file can be days older, and the cost history does not log
  back-and-forth changes. Investments only the file has (`open_data`) get every column.
- `.github/workflows/open-data-ingest.yml` runs it daily at 10:00 UTC (05:00 Lima, after the SSI run)
  and on manual dispatch (`force` input re-ingests an unchanged file).
- Unchanged rows are not rewritten. The `touch_ingested_at` trigger skips an update when no data column
  changed, for both ingests. `ingested_at`, `source_updated_at` and `open_data_updated_at` therefore
  move only when the data changes; whole-source freshness is in `ingest_runs` (SSI) and
  `source_snapshots` (open data). The detail screen shows `source_updated_at` as "Último cambio en los
  datos del MEF: dd/mm/yyyy" (the last time the project's figures changed); the footers keep the
  whole-source "Datos actualizados el …".

Views. The existing views (`region_comparison`, `stalled_investments`, `accrual_reference_month`,
`function_summary`, `department_function_summary`, `department_summary`) now filter
`government_level = 'GR'` explicitly, so their numbers stay the same when national and local rows
arrive. New `*_by_level` views (`region_comparison_by_level`, `stalled_investments_by_level`,
`function_summary_by_level`, `department_function_summary_by_level`) have a `government_level` column
(`GN`, `GR`, `GL`, or `ALL` for every level) for the app to filter on. `region_comparison_by_level`
only has the 25 departments. The app reads only the `*_by_level` views and filters its direct
`investments` and `investment_cost_changes` reads by level (see "Government levels").

`supabase/migrations/20261101000000_entity_comparison.sql` adds:

- `entity_comparison`: one row per entity and `government_level` per scope. `scope_department_code = 0`
  is all of Peru (every project of the entity, including those without department; `department_code`
  is set only when all of them are in one department); `1-25` counts only the entity's projects in that
  department, so a ministry appears in every region where it works. Same figures as the region
  comparison (valid costs, positive increases only, overspent, stalled from
  `stalled_investments_by_level`). Two `UNION ALL` branches, so a scope filter prunes the other branch
  and a department filter uses `investments_department_level_idx`. It is a plain view: every page
  aggregates the scope again (a full scan of about 165k rows nationwide).
- `accrual_reference_month_all_levels`: the end of the data window over every level, the reference
  month of `stalled_investments_by_level`.
- `investments_cost_increase_pct_idx`, for the "Mayor aumento (%)" ranking on the larger table.

Size (measured on Postgres 17 with the October 2026 file plus 27,296 SSI-like GR rows, autovacuum off):
`investments` takes 142 MB after the first load of both sources (111 MB heap, 31 MB indexes) and
`investment_cost_changes` 28 MB (one `first_seen` row per investment). A second identical ingest of both
sources adds 0 bytes. A run where about 1 % of the rows change adds about 1.3 MB to `investments` and
0.3 MB to the history.

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
  app/           Expo Router routes: (tabs) index, rankings, categories, search; region; map; investment/[cui]; category/[fn]
  features/      investments (domain, query specs, port, Supabase + in-memory adapters, hooks),
                 department, home, rankings, regions, categories, search, investment-detail (container + view),
                 share-card (share image: presentation, card, capture and share)
  shared/        theme tokens, formatters, UI atoms
supabase/migrations/   schema, RLS, summary views
.github/workflows/     ingest.yml (manual SSI ingest), open-data-ingest.yml (manual open-data ingest),
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
| `EXPO_PUBLIC_SITE_URL` | Optional. Public web address (`https://rainherz.github.io/Fiscus`); when set, the share card and the shared message link to `<site>/investment/<cui>` |
| `EXPO_BASE_URL` | Optional, build time only. Sub-path of the web export (`/Fiscus`); unset, the app lives at `/` |

To run the app on a phone, install Expo Go, keep the phone on the same network as your computer, and scan
the QR code that `start` prints. If the network blocks LAN, use `pnpm --filter @fiscus/mobile exec expo start --tunnel`.

Scope: every screen shows either all of Peru ("TODO EL PERÚ", the default) or one department. The last
choice is kept on the device with `@react-native-async-storage/async-storage` (localStorage on web); if
the storage fails, the app falls back to all of Peru. The screens wait until the stored choice is read, so
they never fetch or show the wrong scope (the header shows a placeholder meanwhile). Repository methods
take an optional `departmentCode`: undefined means all of Peru, and the query specs drop the department
filter. National reads stay paged or limited, never whole-table fetches.

Government levels: the scope also holds a level, "Todos los niveles" (default), "Gobierno nacional",
"Gobiernos regionales" or "Gobiernos locales", stored on the device (`fiscus.level`) like the region.
It is chosen in the region picker ("NIVEL DE GOBIERNO", a segmented control above the regions; the
region ranking updates at once) and shown in the header as a second line under the region. This adds
no extra row to every screen at 320 px. Every read follows it: direct `investments` and
`investment_cost_changes` reads add `government_level = <code>` unless it is every level, and view reads
use the `*_by_level` views with `government_level = 'ALL' | <code>` (`stalled_investments_by_level` has
no `ALL` rows, so it is simply not filtered). An exact CUI search ignores the level, as it ignores the
region. Footnotes name the level ("Gobiernos regionales. Montos en soles corrientes."; nationwide and
national ones add "No incluye proyectos de varias regiones."). Rows and the detail carry a GN/GR/GL tag
announced as "Gobierno nacional/regional/local". National projects without department read "Varias
regiones" and never appear in a region. The detail adds entity, executing unit, province and district
when present, and "AVANCE FÍSICO 42 %" (`physical_progress`) as a plain bar, apart from the striped
"GASTADO X % DEL COSTO". Its source line follows `data_source` (SSI or open data).

Entidades: a Rankings tab (`/rankings?tab=entities&sort=…`) ranks `entity_comparison` in the scope and
level, paged by the view, with the region comparison's sorts (S/, %, sin gasto reciente, gasto sobre el
costo; only entities with a value above zero; the % sort needs more than S/ 1 M approved in the projects
that increased). Tapping an entity opens `/entity?name=…&level=…`: its projects in the current region,
with the project ranking tabs, filtered by the entity and its own level. The demo mode adds national and
local projects marked "(demo)", one national project without department and one local project with
physical progress and coordinates.

The "Categorías" screen reads `department_function_summary_by_level` for a department and
`function_summary_by_level` for all of Peru.

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
applies the rule and adds `months_without_accrual` and `pending_amount`. The app reads
`stalled_investments_by_level`, the same rule over every level against the reference month of the whole
dataset (`accrual_reference_month_all_levels`), and shows them as a "Sin gasto reciente" tab in Rankings, a block on home and a line on the detail screen. The demo mode adds
invented projects marked "(demo)" so these screens have something to show.

Region picker: the selector in the header ("TODO EL PERÚ ▾" or the region name) opens the "Elegir región"
screen (`/region`). Its first option is "Todo el Perú"; below, it compares all departments, sorted by total cost increase (S/ or %), "Sin gasto reciente"
projects, or projects that spent more than their updated cost. It reads `region_comparison_by_level` for
the selected level: cost figures only use valid updated
costs, and the increase total adds positive increases only (reductions are not netted). The current choice
is marked "ACTUAL"; tapping an option selects it and returns to the previous screen. Departments without
data, and every department while the comparison loads or fails, are listed alphabetically so picking a
region never depends on it. Rankings, Categorías and Buscar work within the selected scope; listing all of Peru, every row shows its
region, and Buscar searches names nationwide (an exact CUI is always searched nationwide). Old
`?tab=regions` links open the default Rankings tab.

National home: "EL MAYOR AUMENTO DEL PAÍS" (with its region), the national top 5 of increases,
"Regiones con más aumentos" (top 5 regions by total increase from `region_comparison_by_level`; tapping one selects
it, "Ver las 25" opens the picker), then "Sin gasto reciente" and "Aumentos recientes" for all of Peru.
A region's home keeps its own layout. The older `department_summary` view is unchanged but not used by the app.

Comparar regiones (`/compare?a=4&b=8`, shareable): two departments side by side from `region_comparison_by_level`,
one row per metric (size, increases, execution) with both values printed and a mirrored bar pair (left
region in ink, right in signal yellow with an ink outline), plus each region's project with the largest
increase. Percent-of-projects rows divide by projects with a valid updated cost. Missing or unknown codes
fall back to the current region (or the largest total increase) and the next one by total increase, and the
URL is rewritten. Choosing a region here never changes the app's scope. It opens from "Comparar dos
regiones" on the national home and at the top of the picker, and from "Comparar con otra región" on a
region's home.

Compartir: "COMPARTIR" on the detail screen renders a 1080x1350 (4:5) image of the project off screen,
captures it with `react-native-view-shot` and previews that same PNG with "Compartir" and "Cancelar", so
people see exactly what they send. The card reuses the detail rules (cost increase, invalid cost notice,
spent share, overspend, unusual data, "Sin gasto") and cites the CUI, the MEF source (SSI or open data) and the date the figures last changed. On
iOS and Android the PNG goes to the system share sheet through `expo-sharing`. On web, view-shot draws the
DOM with `html2canvas-pro` (its optional web peer, loaded lazily as a separate chunk), then the page uses
the Web Share API with the file when `navigator.canShare({ files })` allows it, otherwise it downloads
`fiscus-<cui>.png`. Card logic is in `features/share-card/shareCardPresentation.ts`.

Guía (`/guia`, "CÓMO LEER ESTOS DATOS"): what Fiscus is, the sources, how to read a project, the
glossary, the rules of Fiscus and the known limitations. Linked from the footer ("Cómo leer estos
datos"), from Inicio on phones and as a fifth header item ("GUÍA") on desktop (it does not fit on
tablet). A small "?" (`features/glossary/TermHint.tsx`, 44 px touch target) next to figure labels on the
detail, home hero, desktop ranking headers, map card and compare opens the term's definition: a popover
on tablet and desktop, a bottom sheet on phones. Every definition lives in `features/glossary/terms.ts`;
a test checks that each term the app refers to is defined there.

Mapa (`/map`, `/map?f=increase,stalled,overspent`, `/map?cui=…`): the projects with coordinates (open data `latitude`/`longitude`, about 77 %
of the rows; the screen says so) in the current scope and level. It opens from "Ver en el mapa →" on home
and, centered on the project with its card open, from "VER EN EL MAPA" on a project's detail (shown only
when it has coordinates). It is a stack screen rather than a fifth tab, which did not fit at 320 px.
Nationwide it frames Peru; with a department it frames approximate department bounds
(`features/map/mapRequest.ts`).

- One map implementation: `features/map/mapHtml.ts` builds a MapLibre GL JS 5.24.0 page (from unpkg,
  pinned, with sha384 subresource integrity; the 5.x single-file build inlines its worker, so the hash
  covers all the code, while 6.x is ESM-only with separately loaded chunks). iOS/Android load it in `react-native-webview` (`source={{ html }}`, included in
  Expo Go); the web loads it in a sandboxed iframe (`srcDoc`, scripts only). The page only draws and
  reports; data, labels and states stay in React Native.
- Bridge (`features/map/mapBridge.ts`): the page sends `ready`, `moved` (bbox + MapLibre zoom on load and
  `moveend`), `pointPressed`, `mapPressed` and `loadFailed` (MapLibre not loaded, no WebGL, or the style
  or first tiles failed; the screen then shows its error and "Ver como lista"); the app sends `setData` and `highlight`. Every message
  from the page is parsed and validated (unknown types, bad numbers, inverted boxes and non-digit CUIs are
  dropped). On the web only messages from the map's own iframe are read.
- Requests: 300 ms after the map stops moving, the box is clipped to Peru, rounded outward to 0.01° and
  sent with the zoom, scope and level to `getMapPoints`. MapLibre zooms count 512-px tiles and
  `map_points` sizes cells on 256-px tiles, so the request uses `floor(zoom + 1)` (`toTileZoom`), which
  keeps a cell at 64 px on screen. The previous view stays on screen while
  the next one loads; a status line over the map says "Cargando…", errors (with "Reintentar"), an empty
  area, or when only the first 500 projects are shown.
- Clusters and points are one GeoJSON source with WebGL circle and symbol layers; the app computes the
  labels and sizes and passes them as feature properties. Cluster labels use the style's own fonts (Noto
  Sans Bold, served by OpenFreeMap with the tiles, so they load whenever the basemap does) instead of an
  HTML marker per cluster. Clusters are ink circles with a yellow compact count ("1.2 mil"), sized on a
  log scale; tapping one eases in by two levels (up to MapLibre zoom 12, where the server sends projects). Points are yellow with an ink outline when the project has a positive valid
  cost increase, small ink dots otherwise. A fixed native legend over the map names the three marks
  ("Con aumento de costo", "Sin aumento", "Grupo de proyectos (toca para acercar)"); phones can collapse
  it. "Ver como lista" goes to Rankings. The map is announced as supplementary.
- Controls above the map (`features/map/MapControls.tsx`): the scope ("TODO EL PERÚ  CAMBIAR →" opens
  `/region`; a new region remounts the map on its bounds), the level of government (the app's global
  level, the same state as the region picker) and three filter chips combined with AND: "Con aumento"
  (positive increase on a valid cost), "Sin gasto reciente" (the stalled rule of `domain/stalled.ts`) and
  "Gastó más que su costo" (valid cost, accrued above it). Filters live in the URL (`f`, parsed and written
  in a fixed order by `features/map/mapFilters.ts`), so a filtered map can be shared.
- List of the view (`features/map/MapProjectList.tsx`): the projects of the same box, scope and filters,
  largest increase first (then updated cost), 30 a page with "Cargar más", refreshed with the map (same
  debounce). From 768 px it is a side panel next to the map; on phones a bar under the map says "N
  proyectos en esta zona" and opens the list over the lower part of the map (covering instead of
  shrinking it, so the view and the list stay the same). No gesture library is involved.
- Card (`features/map/MapPointCard.tsx`): name, level tag, entity, "+S/ X M · +Y%" (or "Sin aumento", or
  the invalid-cost notice), "COSTO ACTUAL", "GASTADO X % DEL COSTO", "AVANCE FÍSICO X %" when reported,
  "Sin gasto desde mmm yyyy" when stalled, and "Ver detalle →". A row of the list brings its figures; a
  point tapped on the map is read by CUI (`useInvestment`). The selected project is always drawn and
  highlighted, even inside a cluster (`withSelected`).
- Basemap: OpenFreeMap Positron vector tiles (`https://tiles.openfreemap.org/styles/positron`): free, no
  key, no request limits. The attribution OpenFreeMap requires ("OpenFreeMap © OpenMapTiles Data from
  OpenStreetMap") is always visible through MapLibre's attribution control; its links open in the system
  browser on iOS/Android. The OpenStreetMap tile servers are not used (their policy forbids app traffic).
- Clustering runs in Postgres: `map_points(min_lat, min_lon, max_lat, max_lon, zoom, level = 'ALL',
  department = null)` (`supabase/migrations/20261102000000_map_points.sql`, security invoker, stable,
  executable by anon/authenticated). From zoom 13, or with at most 500 projects in the box, it returns up to
  500 projects (largest increase first); otherwise grid cells of a quarter tile (`360 / 2^zoom / 4`
  degrees) with count, centroid, sum of positive valid increases, largest valid percentage and projects
  with an increase, at most 400 cells. The bbox filter uses `investments_coordinates_idx`. The in-memory
  adapter applies the same rules (`domain/mapPoints.ts`); the demo rows carry approximate demo
  coordinates.
- Filters and list in Postgres (`supabase/migrations/20261103000000_map_filters_and_list.sql`):
  `map_points` gains `only_increase`, `only_stalled` and `only_overspent` (default false; clusters count
  only the matching projects). It is dropped and created again with the same grants, because an overload
  would make the original seven-argument calls ambiguous; the app sends the filter arguments only when a
  filter is on. `map_list(min_lat, min_lon, max_lat, max_lon, level, department, only_increase,
  only_stalled, only_overspent, page_limit = 30, page_offset = 0)` returns the columns of the list and
  card plus `stalled` and `total_count` (a window count), ordered by `cost_increase desc nulls last,
  updated_cost desc nulls last, cui`; `page_limit` is capped at 100.

## Web

The web build is published on GitHub Pages: **https://rainherz.github.io/Fiscus/**

- **Deploy**: `.github/workflows/web-deploy.yml` runs on every push to `main` that touches
  `apps/mobile/**`, `pnpm-lock.yaml` or the workflow, and on manual dispatch. It runs the mobile tests,
  `expo export --platform web`, then deploys with `actions/deploy-pages` (Pages source: GitHub Actions).
- **Base path**: the site lives under `/Fiscus/`. `apps/mobile/app.config.ts` sets Expo's
  `experiments.baseUrl` from `EXPO_BASE_URL`, so assets, fonts and Expo Router links get the prefix.
  Without it (local `expo start`), the app stays at `/`.
- **Deep links**: the export is a single-page app (`web.output: "single"`). Pages answers unknown paths
  such as `/Fiscus/investment/2088142` with `404.html`, which the workflow makes a copy of `index.html`,
  so every route loads on direct visit and refresh (with HTTP status 404, which browsers ignore).
  `.nojekyll` is added as well.
- **Env at build time**: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` come from the
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets, `EXPO_PUBLIC_USE_MOCK=0`,
  `EXPO_PUBLIC_SITE_URL=https://rainherz.github.io/Fiscus`. The service role key is never used there.
- **Page metadata**: title, description, Open Graph/Twitter tags and `lang="es"` live in
  `apps/mobile/public/index.html`, the HTML template of the single-page export.

Build the Pages variant locally (demo data, no keys; `EXPO_NO_DOTENV=1` skips `apps/mobile/.env`):

```sh
cd apps/mobile
EXPO_NO_DOTENV=1 EXPO_BASE_URL=/Fiscus EXPO_PUBLIC_USE_MOCK=1 pnpm exec expo export --platform web --output-dir dist
cp dist/index.html dist/404.html   # then serve dist/ under /Fiscus/ with 404.html as fallback
```

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
| `SUPABASE_ANON_KEY` | Public anon key, baked into the web build (`web-deploy.yml`) |

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
