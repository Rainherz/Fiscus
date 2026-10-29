import { describe, expect, it } from "vitest";
import { MEF_CLOSED_DATA_URL, MEF_OPEN_DATA_URL } from "../src/adapters/OpenDataCsvSource.js";
import { parseOpenDataCliConfig } from "../src/openDataCliConfig.js";

const CREDENTIALS = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" };

describe("parseOpenDataCliConfig", () => {
  it("defaults to a Supabase run over the MEF URL", () => {
    expect(parseOpenDataCliConfig([], CREDENTIALS)).toEqual({
      mode: "supabase",
      dataset: "active",
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
      dataset: "active",
      force: false,
      limit: undefined,
      source: MEF_OPEN_DATA_URL,
      outputFile: undefined,
    });
  });

  it("parses --force, --limit, --source and --out", () => {
    expect(
      parseOpenDataCliConfig(["--dry-run", "--force", "--limit", "500", "--source", "/data/x.csv", "--out", "rows.ndjson"], {}),
    ).toEqual({ mode: "dry-run", dataset: "active", force: true, limit: 500, source: "/data/x.csv", outputFile: "rows.ndjson" });
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

  describe("--dataset", () => {
    it("selects the closed-investments file and its URL", () => {
      expect(parseOpenDataCliConfig(["--dry-run", "--dataset", "closed"], {})).toMatchObject({
        dataset: "closed",
        source: MEF_CLOSED_DATA_URL,
      });
      expect(parseOpenDataCliConfig(["--dry-run", "--dataset=active"], {})).toMatchObject({
        dataset: "active",
        source: MEF_OPEN_DATA_URL,
      });
    });

    it("takes the closed source from OPEN_DATA_CLOSED_SOURCE, never from OPEN_DATA_SOURCE", () => {
      const env = { OPEN_DATA_SOURCE: "/active.csv", OPEN_DATA_CLOSED_SOURCE: " /closed.csv " };
      expect(parseOpenDataCliConfig(["--dry-run", "--dataset", "closed"], env).source).toBe("/closed.csv");
      expect(parseOpenDataCliConfig(["--dry-run", "--dataset", "closed"], { OPEN_DATA_SOURCE: "/a.csv" }).source).toBe(
        MEF_CLOSED_DATA_URL,
      );
      expect(parseOpenDataCliConfig(["--dry-run"], env).source).toBe("/active.csv");
    });

    it("--source wins for either dataset", () => {
      expect(parseOpenDataCliConfig(["--dry-run", "--dataset", "closed", "--source", "/x.csv"], {}).source).toBe("/x.csv");
    });

    it("rejects an unknown dataset", () => {
      expect(() => parseOpenDataCliConfig(["--dry-run", "--dataset", "old"], {})).toThrow(/--dataset/);
      expect(() => parseOpenDataCliConfig(["--dry-run", "--dataset"], {})).toThrow(/--dataset/);
    });
  });
});
