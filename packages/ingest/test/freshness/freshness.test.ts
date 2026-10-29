import { describe, expect, it } from "vitest";
import {
  evaluateFreshness,
  OPEN_DATA_FRESHNESS_SOURCE,
  parseFreshnessRows,
  planStaleIssue,
  renderStaleIssueBody,
  SSI_FRESHNESS_SOURCE,
  STALE_ISSUE_TITLE,
  type FreshnessRow,
} from "../../src/freshness/freshness.js";

const NOW = new Date("2026-10-28T15:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

function rows({ ssi = hoursAgo(11), openData = hoursAgo(5) }: { ssi?: string | null; openData?: string | null } = {}) {
  const result: FreshnessRow[] = [
    { source: SSI_FRESHNESS_SOURCE, lastSuccessAt: ssi, lastCheckedAt: ssi },
    { source: OPEN_DATA_FRESHNESS_SOURCE, lastSuccessAt: hoursAgo(400), lastCheckedAt: openData },
  ];
  return result;
}

describe("parseFreshnessRows", () => {
  it("maps the data_freshness view rows", () => {
    expect(
      parseFreshnessRows([
        { source: "ssi", last_success_at: "2026-10-28T09:30:00+00:00", last_checked_at: null },
      ]),
    ).toEqual([{ source: "ssi", lastSuccessAt: "2026-10-28T09:30:00+00:00", lastCheckedAt: null }]);
  });

  it("rejects anything that is not the view's shape", () => {
    expect(() => parseFreshnessRows({ message: "permission denied" })).toThrow(/array/);
    expect(() => parseFreshnessRows([{ source: 1 }])).toThrow(/source/);
  });
});

describe("evaluateFreshness", () => {
  it("is fresh when the SSI succeeded and the open data was checked within 36 hours", () => {
    const result = evaluateFreshness(rows({ ssi: hoursAgo(35.9), openData: hoursAgo(36) }), NOW);

    expect(result.stale).toBe(false);
    expect(result.checks).toEqual([
      { key: "ssi", label: "SSI: última ingesta exitosa", at: hoursAgo(35.9), ageHours: 35.9, stale: false },
      { key: "open-data", label: "Datos abiertos: última revisión", at: hoursAgo(36), ageHours: 36, stale: false },
    ]);
  });

  it("is stale when the last SSI success is older than 36 hours", () => {
    const result = evaluateFreshness(rows({ ssi: hoursAgo(36.1) }), NOW);

    expect(result.stale).toBe(true);
    expect(result.checks.map((check) => check.stale)).toEqual([true, false]);
  });

  it("judges the open data by its last check, not its last ingest", () => {
    expect(evaluateFreshness(rows({ openData: hoursAgo(37) }), NOW).checks[1]).toMatchObject({ stale: true });
    expect(evaluateFreshness(rows({ openData: hoursAgo(2) }), NOW).checks[1]).toMatchObject({ stale: false });
  });

  it("is stale when a source has never succeeded or is missing", () => {
    expect(evaluateFreshness(rows({ ssi: null }), NOW).checks[0]).toEqual({
      key: "ssi",
      label: "SSI: última ingesta exitosa",
      at: null,
      ageHours: null,
      stale: true,
    });
    expect(evaluateFreshness([], NOW).checks.every((check) => check.stale)).toBe(true);
  });

  it("accepts a custom threshold", () => {
    expect(evaluateFreshness(rows({ ssi: hoursAgo(13) }), NOW, { maxAgeHours: 12 }).stale).toBe(true);
  });
});

describe("renderStaleIssueBody", () => {
  it("lists every source with its Lima time, age and status, and the run link", () => {
    const body = renderStaleIssueBody(evaluateFreshness(rows({ ssi: hoursAgo(50), openData: null }), NOW), {
      runUrl: "https://github.com/o/r/actions/runs/1",
    });

    expect(body).toContain("| SSI: última ingesta exitosa | 26/10/2026 08:00 | 50 h | Desactualizado |");
    expect(body).toContain("| Datos abiertos: última revisión | sin registro | — | Desactualizado |");
    expect(body).toContain("más de 36 h");
    expect(body).toContain("https://github.com/o/r/actions/runs/1");
  });
});

describe("planStaleIssue", () => {
  const stale = evaluateFreshness(rows({ ssi: hoursAgo(50) }), NOW);
  const fresh = evaluateFreshness(rows(), NOW);

  it("opens an issue when stale and none is open", () => {
    expect(planStaleIssue(stale, null, { runUrl: "u" })).toEqual({
      kind: "open",
      title: STALE_ISSUE_TITLE,
      body: renderStaleIssueBody(stale, { runUrl: "u" }),
    });
  });

  it("updates the open issue while still stale", () => {
    expect(planStaleIssue(stale, 7, { runUrl: "u" })).toEqual({
      kind: "update",
      issue: 7,
      body: renderStaleIssueBody(stale, { runUrl: "u" }),
    });
  });

  it("closes the open issue once fresh again, with the current status as a comment", () => {
    expect(planStaleIssue(fresh, 7, { runUrl: "u" })).toEqual({
      kind: "close",
      issue: 7,
      comment: `Datos al día de nuevo.\n\n${renderStaleIssueBody(fresh, { runUrl: "u" })}`,
    });
  });

  it("does nothing when fresh and no issue is open", () => {
    expect(planStaleIssue(fresh, null, { runUrl: "u" })).toEqual({ kind: "none" });
  });
});
