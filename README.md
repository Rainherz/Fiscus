# Fiscus

Read-only public dashboard of Peruvian government investment projects. This repository currently holds
the data backend: a daily ingest of MEF data into Supabase. The mobile app will live in `apps/mobile`.

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
supabase/migrations/   schema, RLS, summary views
.github/workflows/     ingest.yml (daily cron), ci.yml (typecheck + tests)
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
