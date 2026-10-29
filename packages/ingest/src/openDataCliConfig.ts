import { MEF_CLOSED_DATA_URL, MEF_OPEN_DATA_URL } from "./adapters/OpenDataCsvSource.js";

/** Which MEF open-data file: DETALLE_INVERSIONES.csv (active) or CIERRE_INVERSIONES.csv (closed). */
export type OpenDataDataset = "active" | "closed";

interface CommonConfig {
  dataset: OpenDataDataset;
  force: boolean;
  limit: number | undefined;
  /** http(s) URL or local file path of the CSV. */
  source: string;
}

export type OpenDataCliConfig =
  | (CommonConfig & { mode: "dry-run"; outputFile: string | undefined })
  | (CommonConfig & { mode: "supabase"; supabaseUrl: string; serviceRoleKey: string });

type Env = Record<string, string | undefined>;

/** Default URL and the environment variable that overrides it, per dataset. */
const DATASET_SOURCES: Record<OpenDataDataset, { url: string; env: string }> = {
  active: { url: MEF_OPEN_DATA_URL, env: "OPEN_DATA_SOURCE" },
  closed: { url: MEF_CLOSED_DATA_URL, env: "OPEN_DATA_CLOSED_SOURCE" },
};

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

function parseDataset(value: string | undefined): OpenDataDataset {
  if (value === undefined) return "active";
  if (value === "active" || value === "closed") return value;
  throw new Error(`--dataset: expected "active" or "closed", got "${value}"`);
}

export function parseOpenDataCliConfig(argv: readonly string[], env: Env): OpenDataCliConfig {
  const dataset = parseDataset(flagValue(argv, "--dataset"));
  const defaults = DATASET_SOURCES[dataset];
  const common: CommonConfig = {
    dataset,
    force: argv.includes("--force"),
    limit: parseLimit(flagValue(argv, "--limit")),
    source: flagValue(argv, "--source") || env[defaults.env]?.trim() || defaults.url,
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
