import { describe, expect, it } from "vitest";
import { departmentCodeFromName, departmentCodeFromUbigeo } from "../../src/domain/departments.js";

describe("departmentCodeFromUbigeo", () => {
  it("reads the INEI department from the first two digits", () => {
    expect(departmentCodeFromUbigeo("040112")).toBe(4);
    expect(departmentCodeFromUbigeo("070101")).toBe(7);
    expect(departmentCodeFromUbigeo("250101")).toBe(25);
  });

  it("accepts a department-only code", () => {
    expect(departmentCodeFromUbigeo("01")).toBe(1);
  });

  it("returns null for multi-department, blank and malformed codes", () => {
    expect(departmentCodeFromUbigeo("990000")).toBeNull();
    expect(departmentCodeFromUbigeo("99")).toBeNull();
    expect(departmentCodeFromUbigeo("000000")).toBeNull();
    expect(departmentCodeFromUbigeo("")).toBeNull();
    expect(departmentCodeFromUbigeo(undefined)).toBeNull();
    expect(departmentCodeFromUbigeo("4A0112")).toBeNull();
  });
});

describe("departmentCodeFromName", () => {
  it("matches MEF upper-case names without accents", () => {
    expect(departmentCodeFromName("ANCASH")).toBe(2);
    expect(departmentCodeFromName("SAN MARTIN")).toBe(22);
    expect(departmentCodeFromName("MADRE DE DIOS")).toBe(17);
    expect(departmentCodeFromName(" lima ")).toBe(15);
  });

  it("matches accented names", () => {
    expect(departmentCodeFromName("Huánuco")).toBe(10);
  });

  it("returns null for multi-department markers and unknown names", () => {
    expect(departmentCodeFromName("-MUL.DEP-")).toBeNull();
    expect(departmentCodeFromName("")).toBeNull();
    expect(departmentCodeFromName(undefined)).toBeNull();
  });
});
