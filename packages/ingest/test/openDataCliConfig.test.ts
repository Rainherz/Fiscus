import { describe, expect, it } from "vitest";
import { MEF_OPEN_DATA_URL } from "../src/adapters/OpenDataCsvSource.js";
import { parseOpenDataCliConfig } from "../src/openDataCliConfig.js";

const CREDENTIALS = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" };

describe("parseOpenDataCliConfig", () => {
  it("defaults to a Supabase run over the MEF URL", () => {
    expect(parseOpenDataCliConfig([], CREDENTIALS)).toEqual({
      mode: "supabase",
      force: false,
      limit: undefined,
      source: MEF_OPEN_DATA_URL,
      supabaseUrl: "https://x.supabase.co",
      serviceRoleKey: "secret",
    });
  });

  it("requires credentials outside dry-run", () => {
    expect(() => parseOpenDataCliConfig([], {})).toThrow(/SUPABASE_URL/);
    expect(() => parseOpenDataCliConfig([], { SUPABASE_URL: "u" })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("parses --dry-run without credentials", () => {
    expect(parseOpenDataCliConfig(["--dry-run"], {})).toEqual({
      mode: "dry-run",
      force: false,
      limit: undefined,
      source: MEF_OPEN_DATA_URL,
      outputFile: undefined,
    });
  });

  it("parses --force, --limit, --source and --out", () => {
    expect(
      parseOpenDataCliConfig(["--dry-run", "--force", "--limit", "500", "--source", "/data/x.csv", "--out", "rows.ndjson"], {}),
    ).toEqual({ mode: "dry-run", force: true, limit: 500, source: "/data/x.csv", outputFile: "rows.ndjson" });
  });

  it("accepts --flag=value forms", () => {
    expect(parseOpenDataCliConfig(["--dry-run", "--limit=3", "--source=/x.csv", "--out=o.ndjson"], {})).toMatchObject({
      limit: 3,
      source: "/x.csv",
      outputFile: "o.ndjson",
    });
  });

  it("takes the source from OPEN_DATA_SOURCE when no flag is given", () => {
    expect(parseOpenDataCliConfig(["--dry-run"], { OPEN_DATA_SOURCE: " /env.csv " }).source).toBe("/env.csv");
  });

  it("rejects an invalid --limit", () => {
    expect(() => parseOpenDataCliConfig(["--dry-run", "--limit", "0"], {})).toThrow(/--limit/);
    expect(() => parseOpenDataCliConfig(["--dry-run", "--limit", "abc"], {})).toThrow(/--limit/);
    expect(() => parseOpenDataCliConfig(["--dry-run", "--limit"], {})).toThrow(/--limit/);
  });

  it("rejects --out outside dry-run", () => {
    expect(() => parseOpenDataCliConfig(["--out", "x"], CREDENTIALS)).toThrow(/--out/);
  });
});
