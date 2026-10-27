import { resolve } from "node:path";
import { JsonFileInvestmentRepository } from "./adapters/JsonFileInvestmentRepository.js";
import { MefXlsxSource } from "./adapters/MefXlsxSource.js";
import { SupabaseInvestmentRepository } from "./adapters/SupabaseInvestmentRepository.js";
import { runIngest } from "./application/runIngest.js";
import { parseCliConfig } from "./cliConfig.js";
import type { InvestmentRepository } from "./ports/InvestmentRepository.js";

async function main(): Promise<number> {
  const config = parseCliConfig(process.argv.slice(2), process.env);
  const repository: InvestmentRepository =
    config.mode === "dry-run"
      ? new JsonFileInvestmentRepository(resolve(config.outputDir))
      : SupabaseInvestmentRepository.fromCredentials(config.supabaseUrl, config.serviceRoleKey);

  console.log(
    `ingest start: mode=${config.mode} departments=${config.departments.join(",")}` +
      (config.mode === "dry-run" ? ` out=${resolve(config.outputDir)}` : ""),
  );

  const summary = await runIngest({ source: new MefXlsxSource(), repository, departments: config.departments });

  console.log(
    JSON.stringify(
      {
        departmentsOk: summary.departmentsOk,
        departmentsFailed: summary.departmentsFailed,
        rowsUpserted: summary.rowsUpserted,
        rowsSkipped: summary.rowsSkipped,
        duplicatesDropped: summary.duplicatesDropped,
        startedAt: summary.startedAt,
        finishedAt: summary.finishedAt,
      },
      null,
      2,
    ),
  );
  return summary.allFailed ? 1 : 0;
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
