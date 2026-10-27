import { describe, expect, it } from "vitest";
import {
  MIN_VALID_UPDATED_COST,
  costIncrease,
  costIncreasePct,
  executionProgress,
  isValidUpdatedCost,
} from "../../src/domain/metrics.js";

describe("isValidUpdatedCost", () => {
  it("rejects missing costs and MEF placeholders below S/ 1,000", () => {
    expect(MIN_VALID_UPDATED_COST).toBe(1000);
    expect(isValidUpdatedCost(null)).toBe(false);
    expect(isValidUpdatedCost(10)).toBe(false);
    expect(isValidUpdatedCost(999.99)).toBe(false);
    expect(isValidUpdatedCost(1000)).toBe(true);
  });
});

describe("costIncrease", () => {
  it("is updated cost minus viable amount", () => {
    expect(costIncrease({ viableAmount: 1372738, updatedCost: 1420793 })).toBe(48055);
    expect(costIncrease({ viableAmount: 541045, updatedCost: 539075 })).toBe(-1970);
  });

  it("is null when either side is missing", () => {
    expect(costIncrease({ viableAmount: null, updatedCost: 10 })).toBeNull();
    expect(costIncrease({ viableAmount: 10, updatedCost: null })).toBeNull();
  });

  it("is null when the updated cost is a placeholder below S/ 1,000", () => {
    expect(costIncrease({ viableAmount: 166262211, updatedCost: 10 })).toBeNull();
  });
});

describe("costIncreasePct", () => {
  it("is the increase as a percentage of the viable amount", () => {
    expect(costIncreasePct({ viableAmount: 1000, updatedCost: 1250 })).toBe(25);
    expect(costIncreasePct({ viableAmount: 10000, updatedCost: 9000 })).toBe(-10);
  });

  it("is null when the viable amount is zero or missing", () => {
    expect(costIncreasePct({ viableAmount: 0, updatedCost: 100 })).toBeNull();
    expect(costIncreasePct({ viableAmount: null, updatedCost: 100 })).toBeNull();
    expect(costIncreasePct({ viableAmount: 100, updatedCost: null })).toBeNull();
  });

  it("is null when the updated cost is a placeholder below S/ 1,000", () => {
    expect(costIncreasePct({ viableAmount: 100, updatedCost: 3 })).toBeNull();
  });
});

describe("executionProgress", () => {
  it("is accrued total over updated cost", () => {
    expect(executionProgress({ accruedTotal: 250, updatedCost: 1000 })).toBe(0.25);
  });

  it("can exceed 1 when accrual overruns the updated cost", () => {
    expect(executionProgress({ accruedTotal: 1100, updatedCost: 1000 })).toBeCloseTo(1.1);
  });

  it("guards division by zero and missing values", () => {
    expect(executionProgress({ accruedTotal: 10, updatedCost: 0 })).toBeNull();
    expect(executionProgress({ accruedTotal: null, updatedCost: 1000 })).toBeNull();
    expect(executionProgress({ accruedTotal: 10, updatedCost: null })).toBeNull();
  });

  it("is null when the updated cost is a placeholder below S/ 1,000", () => {
    expect(executionProgress({ accruedTotal: 5000, updatedCost: 3 })).toBeNull();
  });
});
