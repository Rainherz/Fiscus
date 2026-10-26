import { describe, expect, it } from "vitest";
import { normalizeInvestment, type RawInvestmentRecord } from "../../src/domain/investment.js";
import { departmentName, DEPARTMENTS } from "../../src/domain/departments.js";

const context = {
  departmentCode: 4,
  sourceUpdatedAt: "2026-10-26T18:41:38-05:00",
  pimYear: 2023,
};

const raw: RawInvestmentRecord = {
  cui: "2114611",
  snipCode: 143835,
  name: " MEJORAMIENTO DEL TALLER ",
  governmentLevel: "GR",
  sector: "GOBIERNOS REGIONALES",
  entity: "GOBIERNO REGIONAL AREQUIPA",
  status: "ACTIVO",
  situation: "VIABLE",
  beneficiaries: 1152303,
  registeredAt: "28/01/2010",
  viabilityAt: "03/02/2010",
  investmentType: "PROYECTO DE INVERSION",
  function: "TRANSPORTE",
  functionalDivision: "TRANSPORTE TERRESTRE",
  functionalGroup: "VÍAS DEPARTAMENTALES",
  framework: "SNIP",
  viableAmount: 1372738,
  pim: 35500,
  accruedYear: 410,
  firstAccrualMonth: "2010-08",
  lastAccrualMonth: "2026-09",
  accruedTotal: 1385703,
  updatedCost: 1420793,
  disputeCost: 0,
  guaranteeAmount: 0,
  concurrentControlCost: 0,
};

describe("normalizeInvestment", () => {
  it("maps a raw record to a typed investment with computed metrics", () => {
    const investment = normalizeInvestment(raw, context);

    expect(investment).toMatchObject({
      cui: "2114611",
      snipCode: "143835",
      name: "MEJORAMIENTO DEL TALLER",
      beneficiaries: 1152303,
      registeredAt: "2010-01-28",
      viabilityAt: "2010-02-03",
      firstAccrualMonth: "2010-08-01",
      lastAccrualMonth: "2026-09-01",
      viableAmount: 1372738,
      pim: 35500,
      pimYear: 2023,
      accruedYear: 410,
      updatedCost: 1420793,
      departmentCode: 4,
      departmentName: "Arequipa",
      sourceUpdatedAt: "2026-10-26T18:41:38-05:00",
      costIncrease: 48055,
    });
    expect(investment?.costIncreasePct).toBeCloseTo(3.5007, 3);
    expect(investment?.executionProgress).toBeCloseTo(0.97530, 4);
  });

  it("returns null when the CUI is missing or blank", () => {
    expect(normalizeInvestment({ ...raw, cui: "" }, context)).toBeNull();
    expect(normalizeInvestment({ ...raw, cui: null }, context)).toBeNull();
    expect(normalizeInvestment({ ...raw, cui: undefined }, context)).toBeNull();
  });

  it("treats empty strings and missing fields as null", () => {
    const investment = normalizeInvestment(
      { cui: "2322636", firstAccrualMonth: "", lastAccrualMonth: "", accruedTotal: null },
      context,
    );

    expect(investment).toMatchObject({
      cui: "2322636",
      name: null,
      firstAccrualMonth: null,
      lastAccrualMonth: null,
      accruedTotal: null,
      updatedCost: null,
      costIncrease: null,
      costIncreasePct: null,
      executionProgress: null,
    });
  });
});

describe("departments", () => {
  it("covers codes 1 through 25", () => {
    expect(DEPARTMENTS.map((d) => d.code)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(departmentName(15)).toBe("Lima");
    expect(departmentName(2)).toBe("Áncash");
    expect(departmentName(99)).toBeNull();
  });
});
