import { DEPARTMENTS } from "./domain/departments.js";

export type CliConfig =
  | { mode: "dry-run"; departments: number[]; outputDir: string }
  | { mode: "supabase"; departments: number[]; supabaseUrl: string; serviceRoleKey: string };

type Env = Record<string, string | undefined>;

function parseDepartments(value: string | undefined): number[] {
  const all = DEPARTMENTS.map((d) => d.code);
  const tokens = (value ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return all;
  const codes: number[] = [];
  for (const token of tokens) {
    const code = Number(token);
    if (!Number.isInteger(code) || !all.includes(code)) {
      throw new Error(`DEPARTMENTS: invalid department code "${token}" (expected 1-25)`);
    }
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

function outputDirFrom(argv: readonly string[]): string {
  const index = argv.indexOf("--out");
  if (index >= 0 && argv[index + 1]) return argv[index + 1]!;
  const inline = argv.find((a) => a.startsWith("--out="));
  return inline ? inline.slice("--out=".length) : "out";
}

export function parseCliConfig(argv: readonly string[], env: Env): CliConfig {
  const departments = parseDepartments(env.DEPARTMENTS);
  if (argv.includes("--dry-run")) {
    return { mode: "dry-run", departments, outputDir: outputDirFrom(argv) };
  }
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl) throw new Error("SUPABASE_URL is required (or pass --dry-run)");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required (or pass --dry-run)");
  return { mode: "supabase", departments, supabaseUrl, serviceRoleKey };
}
