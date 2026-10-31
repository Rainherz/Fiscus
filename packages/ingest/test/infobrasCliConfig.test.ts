import { describe, expect, it } from "vitest";
import { parseInfobrasCliConfig } from "../src/infobrasCliConfig.js";

const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service" };

describe("parseInfobrasCliConfig", () => {
  it("reads the DataSets page and writes to Supabase by default", () => {
    expect(parseInfobrasCliConfig([], ENV)).toEqual({
      mode: "supabase",
      force: false,
      page: undefined,
      file: undefined,
      supabaseUrl: "https://x.supabase.co",
      serviceRoleKey: "service",
    });
  });

  it("supports a dry run with an output file, force, a local page and a local file", () => {
    expect(
      parseInfobrasCliConfig(["--dry-run", "--force", "--out", "rows.ndjson", "--page=page.html", "--file", "obras.xlsx"], {}),
    ).toEqual({
      mode: "dry-run",
      force: true,
      page: "page.html",
      file: "obras.xlsx",
      outputFile: "rows.ndjson",
    });
  });

  it("rejects incomplete options", () => {
    expect(() => parseInfobrasCliConfig(["--out", "rows.ndjson"], ENV)).toThrow(/--dry-run/);
    expect(() => parseInfobrasCliConfig(["--dry-run", "--file"], {})).toThrow(/--file needs a path/);
    expect(() => parseInfobrasCliConfig([], {})).toThrow(/SUPABASE_URL/);
    expect(() => parseInfobrasCliConfig([], { SUPABASE_URL: "u" })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
