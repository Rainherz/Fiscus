interface CommonConfig {
  force: boolean;
  /** URL or local path of the DataSets page; undefined: the INFOBRAS page. */
  page: string | undefined;
  /** A local copy of the obras XLSX instead of the linked download. */
  file: string | undefined;
}

export type InfobrasCliConfig =
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

export function parseInfobrasCliConfig(argv: readonly string[], env: Env): InfobrasCliConfig {
  const file = flagValue(argv, "--file");
  if (file === "") throw new Error("--file needs a path to the obras XLSX");
  const common: CommonConfig = {
    force: argv.includes("--force"),
    page: flagValue(argv, "--page") || undefined,
    file,
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
