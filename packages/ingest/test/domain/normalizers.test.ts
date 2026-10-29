import { describe, expect, it } from "vitest";
import {
  parseDayMonthYear,
  parseCompactYearMonth,
  parseInteger,
  parseIsoDate,
  parseYesNo,
  parseNumber,
  parseText,
  parseYearMonth,
} from "../../src/domain/normalizers.js";

describe("parseText", () => {
  it("trims strings", () => {
    expect(parseText("  ACTIVO ")).toBe("ACTIVO");
  });

  it("returns null for empty, blank, null and undefined", () => {
    expect(parseText("")).toBeNull();
    expect(parseText("   ")).toBeNull();
    expect(parseText(null)).toBeNull();
    expect(parseText(undefined)).toBeNull();
  });

  it("stringifies numbers", () => {
    expect(parseText(143835)).toBe("143835");
  });
});

describe("parseNumber", () => {
  it("passes finite numbers through", () => {
    expect(parseNumber(1372738)).toBe(1372738);
    expect(parseNumber(115202.67)).toBe(115202.67);
    expect(parseNumber(0)).toBe(0);
  });

  it("parses numeric strings, tolerating thousands separators", () => {
    expect(parseNumber("1385703")).toBe(1385703);
    expect(parseNumber(" 1,385,703.50 ")).toBe(1385703.5);
    expect(parseNumber("-12.5")).toBe(-12.5);
  });

  it("returns null for empty or non-numeric input", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber("N/A")).toBeNull();
    expect(parseNumber(Number.NaN)).toBeNull();
    expect(parseNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("parseInteger", () => {
  it("rounds numeric input to an integer", () => {
    expect(parseInteger(1152303)).toBe(1152303);
    expect(parseInteger("2111")).toBe(2111);
    expect(parseInteger(12.6)).toBe(13);
  });

  it("returns null for empty input", () => {
    expect(parseInteger(null)).toBeNull();
    expect(parseInteger("")).toBeNull();
  });
});

describe("parseDayMonthYear", () => {
  it("converts dd/mm/yyyy to ISO date", () => {
    expect(parseDayMonthYear("28/01/2010")).toBe("2010-01-28");
    expect(parseDayMonthYear(" 3/2/2010 ")).toBe("2010-02-03");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseDayMonthYear("31/02/2010")).toBeNull();
    expect(parseDayMonthYear("00/01/2010")).toBeNull();
  });

  it("accepts Date instances as UTC calendar dates", () => {
    expect(parseDayMonthYear(new Date(Date.UTC(2016, 11, 30)))).toBe("2016-12-30");
  });

  it("returns null for empty or malformed input", () => {
    expect(parseDayMonthYear("")).toBeNull();
    expect(parseDayMonthYear(null)).toBeNull();
    expect(parseDayMonthYear("2010-01-28")).toBeNull();
  });
});

describe("parseYearMonth", () => {
  it("converts yyyy-mm to the first day of that month", () => {
    expect(parseYearMonth("2010-08")).toBe("2010-08-01");
    expect(parseYearMonth("2026-9")).toBe("2026-09-01");
  });

  it("returns null for empty, malformed or out-of-range months", () => {
    expect(parseYearMonth("")).toBeNull();
    expect(parseYearMonth(null)).toBeNull();
    expect(parseYearMonth("2010-13")).toBeNull();
    expect(parseYearMonth("08/2010")).toBeNull();
  });
});

describe("parseIsoDate", () => {
  it("takes the date part of an ISO date-time", () => {
    expect(parseIsoDate("2010-01-28 00:00:00")).toBe("2010-01-28");
  });

  it("accepts a bare ISO date", () => {
    expect(parseIsoDate("2026-06-03")).toBe("2026-06-03");
  });

  it("returns null for empty, malformed and impossible dates", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate("28/01/2010")).toBeNull();
    expect(parseIsoDate("2026-02-30 00:00:00")).toBeNull();
  });
});

describe("parseCompactYearMonth", () => {
  it("parses yyyymm to the first day of the month", () => {
    expect(parseCompactYearMonth("202610")).toBe("2026-10-01");
    expect(parseCompactYearMonth("201008")).toBe("2010-08-01");
  });

  it("returns null for empty, malformed and impossible months", () => {
    expect(parseCompactYearMonth("")).toBeNull();
    expect(parseCompactYearMonth(null)).toBeNull();
    expect(parseCompactYearMonth("2026-10")).toBeNull();
    expect(parseCompactYearMonth("202613")).toBeNull();
    expect(parseCompactYearMonth("20261")).toBeNull();
  });
});

describe("parseYesNo", () => {
  it("reads SÍ / SI as true and NO as false, with or without accent and case", () => {
    expect(parseYesNo("SÍ")).toBe(true);
    expect(parseYesNo("SI")).toBe(true);
    expect(parseYesNo(" sí ")).toBe(true);
    expect(parseYesNo("NO")).toBe(false);
    expect(parseYesNo("no")).toBe(false);
  });

  it("returns null for blanks and anything else", () => {
    expect(parseYesNo("")).toBeNull();
    expect(parseYesNo(undefined)).toBeNull();
    expect(parseYesNo("TAL VEZ")).toBeNull();
    expect(parseYesNo(1)).toBeNull();
  });
});
