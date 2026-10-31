/** A spreadsheet given on the command line instead of the discovered edition. */
export interface ManualEdition {
  /** http(s) URL or local path. */
  xlsx: string;
  /** yyyy-mm-dd */
  cutoff: string;
  publishedAt: string | null;
}

interface CommonConfig {
  force: boolean;
  /** URL or local path of the collection page; undefined: gob.pe. */
  collection: string | undefined;
  manual: ManualEdition | undefined;
}

export type ParalyzedCliConfig =
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

function isoDate(flag: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${flag}: expected yyyy-mm-dd, got "${value}"`);
  return value;
}

function parseManual(argv: readonly string[]): ManualEdition | undefined {
  const xlsx = flagValue(argv, "--xlsx") || undefined;
  if (xlsx === undefined) return undefined;
  const cutoff = isoDate("--cutoff", flagValue(argv, "--cutoff") || undefined);
  if (cutoff === undefined) throw new Error("--xlsx needs --cutoff yyyy-mm-dd (the edition cut-off)");
  return { xlsx, cutoff, publishedAt: isoDate("--published", flagValue(argv, "--published") || undefined) ?? null };
}

export function parseParalyzedCliConfig(argv: readonly string[], env: Env): ParalyzedCliConfig {
  const common: CommonConfig = {
    force: argv.includes("--force"),
    collection: flagValue(argv, "--collection") || undefined,
    manual: parseManual(argv),
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
