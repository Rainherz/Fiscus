import { basename, resolve } from "node:path";
import { ContraloriaInfobrasSource } from "./adapters/ContraloriaInfobrasSource.js";
import { DryRunInfobrasRepository } from "./adapters/DryRunInfobrasRepository.js";
import { SupabaseInfobrasRepository } from "./adapters/SupabaseInfobrasRepository.js";
import { runInfobrasIngest } from "./application/runInfobrasIngest.js";
import { parseInfobrasCliConfig } from "./infobrasCliConfig.js";
import type { InfobrasRepository } from "./ports/InfobrasRepository.js";
import type { InfobrasSource } from "./ports/InfobrasSource.js";

/**
 * pnpm ingest:infobras [--dry-run [--out rows.ndjson]] [--force] [--page <url|path>] [--file <obras.xlsx>]
 */
async function main(): Promise<number> {
  const config = parseInfobrasCliConfig(process.argv.slice(2), process.env);
  const outputFile = config.mode === "dry-run" && config.outputFile ? resolve(config.outputFile) : undefined;
  const repository: InfobrasRepository =
    config.mode === "dry-run"
      ? new DryRunInfobrasRepository(outputFile)
      : SupabaseInfobrasRepository.fromCredentials(config.supabaseUrl, config.serviceRoleKey);

  const contraloria = new ContraloriaInfobrasSource({ page: config.page });
  const file = config.file ? resolve(config.file) : undefined;
  const source: InfobrasSource = file
    ? {
        latestDataSet: async () => ({ url: file, filename: basename(file), fileDate: null }),
        download: (link) => contraloria.download(link),
        records: (path) => contraloria.records(path),
      }
    : contraloria;

  console.log(
    `infobras ingest start: mode=${config.mode}` +
      (config.force ? " force" : "") +
      (file ? ` file=${file}` : ` page=${config.page ?? "infobras.contraloria.gob.pe"}`) +
      (outputFile ? ` out=${outputFile}` : ""),
  );
  const started = Date.now();
  const summary = await runInfobrasIngest({ source, repository, force: config.force });
  console.log(
    JSON.stringify(
      {
        ...summary,
        seconds: Math.round((Date.now() - started) / 100) / 10,
        peakRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
      },
      null,
      2,
    ),
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
