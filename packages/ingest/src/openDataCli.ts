import { resolve } from "node:path";
import { DryRunOpenDataRepository } from "./adapters/DryRunOpenDataRepository.js";
import { OpenDataCsvSource } from "./adapters/OpenDataCsvSource.js";
import { SupabaseOpenDataRepository } from "./adapters/SupabaseOpenDataRepository.js";
import { runOpenDataIngest } from "./application/runOpenDataIngest.js";
import { parseOpenDataCliConfig } from "./openDataCliConfig.js";
import type { OpenDataRepository } from "./ports/OpenDataRepository.js";

async function main(): Promise<number> {
  const config = parseOpenDataCliConfig(process.argv.slice(2), process.env);
  const outputFile =
    config.mode === "dry-run" && config.outputFile ? resolve(config.outputFile) : undefined;
  const repository: OpenDataRepository =
    config.mode === "dry-run"
      ? new DryRunOpenDataRepository(outputFile)
      : SupabaseOpenDataRepository.fromCredentials(config.supabaseUrl, config.serviceRoleKey);

  console.log(
    `open-data ingest start: mode=${config.mode} source=${config.source}` +
      (config.force ? " force" : "") +
      (config.limit !== undefined ? ` limit=${config.limit}` : "") +
      (outputFile ? ` out=${outputFile}` : ""),
  );

  const started = Date.now();
  const summary = await runOpenDataIngest({
    source: new OpenDataCsvSource({ location: config.source }),
    repository,
    force: config.force,
    limit: config.limit,
  });

  console.log(
    JSON.stringify({ ...summary, seconds: Math.round((Date.now() - started) / 100) / 10 }, null, 2),
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
