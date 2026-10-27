# Fiscus

Read-only public dashboard of Peruvian government investment projects. This repository holds the data
backend (a daily ingest of MEF data into Supabase) and the app in `apps/mobile` (iOS, Android and web).

## Data source

MEF "Seguimiento de Inversiones" (SSI) report, downloaded as XLSX per department:

- `POST https://ofi5.mef.gob.pe/inviertews/Ssi/expRepSSIDet`
- Body: `{"sect":"","plie":"<1..25>","dpto":0,"prov":0,"dist":0,"tipo":"GR"}`. `plie` is the department code.
- Each call takes about 50 s, so departments are fetched one after another. Each attempt has a 120 s timeout and is retried 3 times with exponential backoff.

## Layout

```
packages/ingest/src/
  domain/        Investment type, normalizers, cost metrics, department codes (pure)
  ports/         InvestmentSource, InvestmentRepository
  adapters/      MefXlsxSource (HTTP + XLSX), ssiReportParser, SupabaseInvestmentRepository,
                 JsonFileInvestmentRepository (dry-run)
  application/   runIngest (per-department fault isolation)
  cli.ts         entrypoint
apps/mobile/src/
  app/           Expo Router routes: (tabs) index, rankings, categories, search; investment/[cui]; category/[fn]
  features/      investments (domain, query specs, port, Supabase + in-memory adapters, hooks),
                 department, home, rankings, categories, search, investment-detail (container + view)
  shared/        theme tokens, formatters, UI atoms
supabase/migrations/   schema, RLS, summary views
.github/workflows/     ingest.yml (manual ingest), ci.yml (typecheck + tests)
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

The "Categorías" screen reads the `department_function_summary` view
(`supabase/migrations/20261026120000_create_department_function_summary.sql`), so apply that
migration before you use it.

Cost history: MEF only publishes the current cost, so Fiscus records its own history in
`investment_cost_changes` from 27/10/2026 onwards
(`supabase/migrations/20261027200000_create_investment_cost_changes.sql`). Every investment starts with a
`baseline` row; triggers add a `changed` row when `viable_amount` or `updated_cost` changes. The detail
screen shows this as "Historial del costo", and home lists the department's latest increases under
"Aumentos recientes". Earlier history is unknown. The demo mode includes an invented history for Majes
Siguas II, only so these screens have something to show.

Sin gasto reciente: active projects (`status = 'ACTIVO'`, valid updated cost) that spent between 5 % and
95 % of their cost and whose last accrual month is more than 12 months before the reference month, the
latest `last_accrual_month` in the dataset (not today, so MEF publication delays do not inflate the list).
The `stalled_investments` view (`supabase/migrations/20261029000000_create_stalled_investments.sql`)
applies the rule and adds `months_without_accrual` and `pending_amount`. The app shows them as a
"Sin gasto reciente" tab in Rankings, a block on home and a line on the detail screen. The demo mode adds
invented projects marked "(demo)" so these screens have something to show.

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
- **Regional governments only.** The ingest requests `tipo: "GR"`. National and local governments are
  not included yet.
- **PIM year label is unverified.** The report headers say `PIM 2023` / `DEVENGADO 2023` even in 2026
  reports. The columns are matched by prefix (`PIM yyyy`, `DEVENGADO yyyy`), and the header year is
  stored in `pim_year` as-is. Do not present it as the current-year budget until this is confirmed with MEF.
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
