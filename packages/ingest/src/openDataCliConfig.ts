import { MEF_OPEN_DATA_URL } from "./adapters/OpenDataCsvSource.js";

interface CommonConfig {
  force: boolean;
  limit: number | undefined;
  /** http(s) URL or local file path of the CSV. */
  source: string;
}

export type OpenDataCliConfig =
  | (CommonConfig & { mode: "dry-run"; outputFile: string | undefined })
  | (CommonConfig & { mode: "supabase"; supabaseUrl: string; serviceRoleKey: string });

type Env = Record<string, string | undefined>;

/** Value of `--name value` or `--name=value`; undefined when absent; "" when the value is missing. */
function flagValue(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index >= 0) {
    const next = argv[index + 1];
    return next === undefined || next.startsWith("--") ? "" : next;
  }
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline === undefined ? undefined : inline.slice(name.length + 1);
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`--limit: expected a positive integer, got "${value}"`);
  }
  return Number(value);
}

export function parseOpenDataCliConfig(argv: readonly string[], env: Env): OpenDataCliConfig {
  const common: CommonConfig = {
    force: argv.includes("--force"),
    limit: parseLimit(flagValue(argv, "--limit")),
    source: flagValue(argv, "--source") || env.OPEN_DATA_SOURCE?.trim() || MEF_OPEN_DATA_URL,
  };
  const outputFile = flagValue(argv, "--out") || undefined;

  if (argv.includes("--dry-run")) return { mode: "dry-run", ...common, outputFile };
  if (outputFile !== undefined) throw new Error("--out is only supported with --dry-run");

  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl) throw new Error("SUPABASE_URL is required (or pass --dry-run)");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required (or pass --dry-run)");
  return { mode: "supabase", ...common, supabaseUrl, serviceRoleKey };
}
