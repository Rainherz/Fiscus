import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../../../scripts/notify-ingest-failure.sh", import.meta.url));

/** The redaction step of scripts/notify-ingest-failure.sh, run on its own. */
function redact(text: string): string {
  return execFileSync("bash", [SCRIPT, "--redact"], { input: text, encoding: "utf8" });
}

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.dGhpc2lzbm90YXJlYWxzaWduYXR1cmU";

describe("notify-ingest-failure.sh redaction", () => {
  it("hides JWTs, Supabase and GitHub keys and Bearer tokens", () => {
    const out = redact(
      [
        `apikey ${JWT}`,
        "key sb_secret_AbCdEf123456_xyz",
        "gh token ghp_abcdefghijklmnopqrstuvwxyz0123456789",
        "Authorization: Bearer abc.def-123",
      ].join("\n"),
    );

    expect(out).not.toContain("eyJ");
    expect(out).not.toContain("sb_secret_");
    expect(out).not.toContain("ghp_");
    expect(out).not.toContain("abc.def-123");
    expect(out).toContain("Bearer [REDACTED]");
  });

  it("hides values assigned to KEY, TOKEN, SECRET or PASSWORD names", () => {
    const out = redact('SUPABASE_SERVICE_ROLE_KEY=s3cr3t\n{"access_token": "t0k3n"}\nPASSWORD: hunter2\n');

    expect(out).toBe('SUPABASE_SERVICE_ROLE_KEY=[REDACTED]\n{"access_token": "[REDACTED]"}\nPASSWORD: [REDACTED]\n');
  });

  it("hides long opaque strings and the home directory, keeping ordinary log lines", () => {
    const line = "department 4: 1234 rows upserted, 0 skipped (no CUI), 2 duplicates";
    const out = redact(`${line}\n${"a1B2".repeat(12)}\nopen /home/someone/Proyectos/Fiscus/.env.local\n`);

    expect(out).toBe(`${line}\n[REDACTED]\nopen ~/Proyectos/Fiscus/.env.local\n`);
  });
});
