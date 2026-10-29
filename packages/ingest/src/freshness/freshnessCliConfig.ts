import { DEFAULT_MAX_AGE_HOURS } from "./freshness.js";

export interface FreshnessCliConfig {
  supabaseUrl: string;
  anonKey: string;
  maxAgeHours: number;
  runUrl: string;
  /** Print the planned issue action instead of calling gh. */
  dryRun: boolean;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/** Reads the data-freshness check settings. Only the public anon key is used: the check is read-only. */
export function parseFreshnessCliConfig(argv: readonly string[], env: NodeJS.ProcessEnv): FreshnessCliConfig {
  const maxAge = env.MAX_AGE_HOURS?.trim();
  const maxAgeHours = maxAge ? Number(maxAge) : DEFAULT_MAX_AGE_HOURS;
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error("MAX_AGE_HOURS must be a positive number");
  const runUrl =
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : "ejecución local";
  return {
    supabaseUrl: required(env, "SUPABASE_URL").replace(/\/+$/, ""),
    anonKey: required(env, "SUPABASE_ANON_KEY"),
    maxAgeHours,
    runUrl,
    dryRun: argv.includes("--dry-run"),
  };
}
