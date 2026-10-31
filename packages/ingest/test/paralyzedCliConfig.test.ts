import { describe, expect, it } from "vitest";
import { parseParalyzedCliConfig } from "../src/paralyzedCliConfig.js";

const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service" };

describe("parseParalyzedCliConfig", () => {
  it("discovers the edition on gob.pe and writes to Supabase by default", () => {
    expect(parseParalyzedCliConfig([], ENV)).toEqual({
      mode: "supabase",
      force: false,
      collection: undefined,
      manual: undefined,
      supabaseUrl: "https://x.supabase.co",
      serviceRoleKey: "service",
    });
  });

  it("supports a dry run with an output file, force and a local collection page", () => {
    expect(parseParalyzedCliConfig(["--dry-run", "--force", "--out", "rows.ndjson", "--collection=page.html"], {})).toEqual({
      mode: "dry-run",
      force: true,
      collection: "page.html",
      manual: undefined,
      outputFile: "rows.ndjson",
    });
  });

  it("takes a spreadsheet directly with its cut-off and publication date", () => {
    const config = parseParalyzedCliConfig(
      ["--dry-run", "--xlsx", "anexo.xlsx", "--cutoff", "2026-06-30", "--published", "2026-08-17"],
      {},
    );
    expect(config.manual).toEqual({ xlsx: "anexo.xlsx", cutoff: "2026-06-30", publishedAt: "2026-08-17" });
  });

  it("rejects incomplete or malformed options", () => {
    expect(() => parseParalyzedCliConfig(["--dry-run", "--xlsx", "anexo.xlsx"], {})).toThrow(/--cutoff/);
    expect(() => parseParalyzedCliConfig(["--dry-run", "--xlsx", "a.xlsx", "--cutoff", "junio"], {})).toThrow(/yyyy-mm-dd/);
    expect(() => parseParalyzedCliConfig(["--out", "rows.ndjson"], ENV)).toThrow(/--dry-run/);
    expect(() => parseParalyzedCliConfig([], {})).toThrow(/SUPABASE_URL/);
    expect(() => parseParalyzedCliConfig([], { SUPABASE_URL: "u" })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
