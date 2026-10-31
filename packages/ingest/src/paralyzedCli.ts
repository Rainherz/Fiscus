import { resolve } from "node:path";
import { DryRunParalyzedWorksRepository } from "./adapters/DryRunParalyzedWorksRepository.js";
import { GobPeParalyzedWorksSource } from "./adapters/GobPeParalyzedWorksSource.js";
import { SupabaseParalyzedWorksRepository } from "./adapters/SupabaseParalyzedWorksRepository.js";
import { runParalyzedWorksIngest } from "./application/runParalyzedWorksIngest.js";
import { parseParalyzedCliConfig } from "./paralyzedCliConfig.js";
import type { ParalyzedWorksRepository } from "./ports/ParalyzedWorksRepository.js";
import type { ParalyzedEdition, ParalyzedWorksSource } from "./ports/ParalyzedWorksSource.js";

/**
 * pnpm ingest:paralyzed [--dry-run [--out rows.ndjson]] [--force] [--collection <url|path>]
 *                       [--xlsx <url|path> --cutoff yyyy-mm-dd [--published yyyy-mm-dd]]
 */
async function main(): Promise<number> {
  const config = parseParalyzedCliConfig(process.argv.slice(2), process.env);
  const outputFile = config.mode === "dry-run" && config.outputFile ? resolve(config.outputFile) : undefined;
  const repository: ParalyzedWorksRepository =
    config.mode === "dry-run"
      ? new DryRunParalyzedWorksRepository(outputFile)
      : SupabaseParalyzedWorksRepository.fromCredentials(config.supabaseUrl, config.serviceRoleKey);

  const gobPe = new GobPeParalyzedWorksSource({ collection: config.collection });
  const manual = config.manual;
  const source: ParalyzedWorksSource = manual
    ? {
        latestEdition: async (): Promise<ParalyzedEdition> => ({
          title: `Edición a ${manual.cutoff} (indicada manualmente)`,
          url: manual.xlsx,
          publishedAt: manual.publishedAt,
          cutoff: manual.cutoff,
          xlsxUrl: manual.xlsx,
        }),
        records: (edition) => gobPe.records(edition),
      }
    : gobPe;

  console.log(
    `paralyzed-works ingest start: mode=${config.mode}` +
      (config.force ? " force" : "") +
      (manual ? ` xlsx=${manual.xlsx}` : ` collection=${config.collection ?? "gob.pe"}`) +
      (outputFile ? ` out=${outputFile}` : ""),
  );
  const started = Date.now();
  const summary = await runParalyzedWorksIngest({ source, repository, force: config.force });
  console.log(JSON.stringify({ ...summary, seconds: Math.round((Date.now() - started) / 100) / 10 }, null, 2));
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
