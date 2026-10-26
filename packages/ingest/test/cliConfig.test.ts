import { describe, expect, it } from "vitest";
import { parseCliConfig } from "../src/cliConfig.js";

const ALL = Array.from({ length: 25 }, (_, i) => i + 1);

describe("parseCliConfig", () => {
  it("defaults to every department and Supabase mode", () => {
    const config = parseCliConfig([], { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" });
    expect(config).toEqual({
      mode: "supabase",
      departments: ALL,
      supabaseUrl: "https://x.supabase.co",
      serviceRoleKey: "k",
    });
  });

  it("limits departments from DEPARTMENTS, de-duplicated and in input order", () => {
    const config = parseCliConfig(["--dry-run"], { DEPARTMENTS: " 15, 4,15 " });
    expect(config.departments).toEqual([15, 4]);
  });

  it("treats a blank DEPARTMENTS as all departments", () => {
    expect(parseCliConfig(["--dry-run"], { DEPARTMENTS: "" }).departments).toEqual(ALL);
  });

  it("rejects unknown department codes", () => {
    expect(() => parseCliConfig(["--dry-run"], { DEPARTMENTS: "4,26" })).toThrow(/26/);
    expect(() => parseCliConfig(["--dry-run"], { DEPARTMENTS: "abc" })).toThrow(/abc/);
  });

  it("dry-run needs no credentials and writes to ./out by default", () => {
    expect(parseCliConfig(["--dry-run"], {})).toEqual({ mode: "dry-run", departments: ALL, outputDir: "out" });
    expect(parseCliConfig(["--dry-run", "--out", "/tmp/x"], {})).toMatchObject({ outputDir: "/tmp/x" });
    expect(parseCliConfig(["--dry-run", "--out=/tmp/y"], {})).toMatchObject({ outputDir: "/tmp/y" });
  });

  it("requires Supabase credentials outside dry-run", () => {
    expect(() => parseCliConfig([], { SUPABASE_URL: "https://x" })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => parseCliConfig([], {})).toThrow(/SUPABASE_URL/);
  });
});
