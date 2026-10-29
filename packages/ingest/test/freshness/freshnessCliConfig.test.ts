import { describe, expect, it } from "vitest";
import { parseFreshnessCliConfig } from "../../src/freshness/freshnessCliConfig.js";

const ENV = { SUPABASE_URL: "https://x.supabase.co/", SUPABASE_ANON_KEY: "anon" };

describe("parseFreshnessCliConfig", () => {
  it("reads the anon credentials with a 36 h default", () => {
    expect(parseFreshnessCliConfig([], ENV)).toEqual({
      supabaseUrl: "https://x.supabase.co",
      anonKey: "anon",
      maxAgeHours: 36,
      runUrl: "ejecución local",
      dryRun: false,
    });
  });

  it("requires the URL and the anon key", () => {
    expect(() => parseFreshnessCliConfig([], {})).toThrow(/SUPABASE_URL/);
    expect(() => parseFreshnessCliConfig([], { SUPABASE_URL: "u" })).toThrow(/SUPABASE_ANON_KEY/);
  });

  it("builds the Actions run URL and reads the threshold and --dry-run", () => {
    expect(
      parseFreshnessCliConfig(["--dry-run"], {
        ...ENV,
        MAX_AGE_HOURS: "12",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "o/r",
        GITHUB_RUN_ID: "42",
      }),
    ).toMatchObject({ maxAgeHours: 12, runUrl: "https://github.com/o/r/actions/runs/42", dryRun: true });
  });

  it("rejects a threshold that is not a positive number", () => {
    expect(() => parseFreshnessCliConfig([], { ...ENV, MAX_AGE_HOURS: "x" })).toThrow(/MAX_AGE_HOURS/);
    expect(() => parseFreshnessCliConfig([], { ...ENV, MAX_AGE_HOURS: "0" })).toThrow(/MAX_AGE_HOURS/);
  });
});
