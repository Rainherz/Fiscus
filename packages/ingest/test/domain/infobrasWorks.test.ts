import { describe, expect, it } from "vitest";
import {
  classifyParty,
  dataAsOf,
  headerKeys,
  INFOBRAS_HEADERS,
  mapInfobrasRecord,
  parseInfobrasDecimal,
  type InfobrasRecord,
} from "../../src/domain/infobrasWorks.js";

/** A real row of the INFOBRAS dataset (30-10-2026), only the kept columns, keyed by headerKeys. */
const RECORD: InfobrasRecord = {
  "Código INFOBRAS": "36233",
  "Modalidad de ejecución de la obra": "Contrata",
  "Estado de ejecución": "En Ejecución",
  "Codigo unico de inversión": "2132947",
  "Código SNIP": "165944",
  "RUC (Ejecución)": "20301552115",
  "Nombre o razón social de la empresa o consorcio": "AMERIKA PROMASER S R L",
  "Monto del contrato en soles": "3158683 99",
  "RUC (Supervisión)": "20341472564",
  "Nombre o razón social de la empresa o consorcio #2": "CONSORCIO SUPERVISOR ANDINO",
  "Año de avance": "2025",
  "Mes de avance": "12",
  "Fecha de registro de avance": "31/01/2026",
  "Avance Físico Programado Acumulado (%)": "80",
  "Avance Físico Real Acumulado (%)": "62 5",
  "Existe Paralización": "Si",
  "Causal de paralización": "Incumplimiento de contrato",
  "Fecha de paralización": "01/12/2025",
  "Número de dias paralizado": "31",
  "N° días de modificaciones de plazo": "45",
  "Monto de adicionales de obra en soles": "159570 0652",
  "Monto de deductivos de obra en soles": "710 36",
  "Fecha de recepción": "",
  "Fecha de aprobación de liquidación de obra": "",
};

describe("parseInfobrasDecimal", () => {
  it("reads a space as the decimal separator", () => {
    expect(parseInfobrasDecimal("693405 56")).toBe(693405.56);
    expect(parseInfobrasDecimal("8166711 8")).toBe(8166711.8);
    expect(parseInfobrasDecimal("159570 0652")).toBe(159570.0652);
  });

  it("reads whole numbers and a dot decimal", () => {
    expect(parseInfobrasDecimal("389511")).toBe(389511);
    expect(parseInfobrasDecimal("0")).toBe(0);
    expect(parseInfobrasDecimal("12.5")).toBe(12.5);
    expect(parseInfobrasDecimal("-3 25")).toBe(-3.25);
  });

  it("is null for blanks and anything else", () => {
    expect(parseInfobrasDecimal("")).toBeNull();
    expect(parseInfobrasDecimal("  ")).toBeNull();
    expect(parseInfobrasDecimal(undefined)).toBeNull();
    expect(parseInfobrasDecimal("1 234 567")).toBeNull();
    expect(parseInfobrasDecimal("S/N")).toBeNull();
  });
});

describe("headerKeys", () => {
  it("collapses whitespace, drops a trailing colon and numbers repeated headers", () => {
    expect(
      headerKeys([
        "Código INFOBRAS",
        "Monto del contrato  en soles",
        "Nombre o razón social de la empresa o consorcio",
        "Nombre o razón social de la empresa o consorcio:",
        "Monto del contrato  en soles",
        "Fecha de aprobación del expediente ",
      ]),
    ).toEqual([
      "Código INFOBRAS",
      "Monto del contrato en soles",
      "Nombre o razón social de la empresa o consorcio",
      "Nombre o razón social de la empresa o consorcio #2",
      "Monto del contrato en soles #2",
      "Fecha de aprobación del expediente",
    ]);
  });
});

describe("classifyParty", () => {
  it("keeps a company (RUC 20) with its name", () => {
    expect(classifyParty("20301552115", "AMERIKA PROMASER S R L")).toEqual({
      kind: "empresa",
      ruc: "20301552115",
      name: "AMERIKA PROMASER S R L",
    });
  });

  it("marks a RUC 20 whose name starts with CONSORCIO as a consortium", () => {
    expect(classifyParty("20548593761", " Consorcio San Juan ")).toEqual({
      kind: "consorcio",
      ruc: "20548593761",
      name: "Consorcio San Juan",
    });
  });

  it("keeps a consortium code (C + 10 digits) as a consortium", () => {
    expect(classifyParty("C0003136723", "CONSORCIO VIAL NORTE")).toEqual({
      kind: "consorcio",
      ruc: "C0003136723",
      name: "CONSORCIO VIAL NORTE",
    });
  });

  it("keeps neither the name nor the RUC of a natural person (RUC 10, 15 or 17)", () => {
    for (const ruc of ["10412345678", "15123456789", "17123456789"]) {
      expect(classifyParty(ruc, "JUAN PEREZ")).toEqual({ kind: "persona_natural", ruc: null, name: null });
    }
    // Even when the name looks like a consortium: the RUC is a person's.
    expect(classifyParty("10412345678", "CONSORCIO JUAN PEREZ")).toEqual({
      kind: "persona_natural",
      ruc: null,
      name: null,
    });
  });

  it("keeps only a consortium name when the identifier is not valid", () => {
    expect(classifyParty("S/N", "CONSORCIO LOS ANDES")).toEqual({
      kind: "consorcio",
      ruc: null,
      name: "CONSORCIO LOS ANDES",
    });
  });

  it("keeps nothing for an invalid identifier with any other name (it may be a person)", () => {
    expect(classifyParty("1048", "JUAN PEREZ")).toEqual({ kind: null, ruc: null, name: null });
    expect(classifyParty("2050403691", "CONSTRUCTORA SUR SAC")).toEqual({ kind: null, ruc: null, name: null });
    expect(classifyParty("00123456789", "ALGO")).toEqual({ kind: null, ruc: null, name: null });
    expect(classifyParty("", "")).toEqual({ kind: null, ruc: null, name: null });
    expect(classifyParty(undefined, undefined)).toEqual({ kind: null, ruc: null, name: null });
  });

  it("keeps a company RUC without a name", () => {
    expect(classifyParty("20301552115", "")).toEqual({ kind: "empresa", ruc: "20301552115", name: null });
  });
});

describe("mapInfobrasRecord", () => {
  it("maps the kept columns", () => {
    expect(mapInfobrasRecord(RECORD)).toEqual({
      infobrasCode: 36233,
      cui: "2132947",
      snip: "165944",
      executionStatus: "En Ejecución",
      hasParalysis: true,
      paralysisCause: "Incumplimiento de contrato",
      paralysisDate: "2025-12-01",
      paralysisDays: 31,
      physicalProgressPlanned: 80,
      physicalProgressActual: 62.5,
      progressPeriod: "2025-12-01",
      progressRegisteredAt: "2026-01-31",
      contractAmount: 3158683.99,
      contractorKind: "empresa",
      contractorRuc: "20301552115",
      contractorName: "AMERIKA PROMASER S R L",
      supervisorKind: "consorcio",
      supervisorRuc: "20341472564",
      supervisorName: "CONSORCIO SUPERVISOR ANDINO",
      additionalWorksAmount: 159570.0652,
      deductionsAmount: 710.36,
      extensionDays: 45,
      receptionDate: null,
      liquidationDate: null,
      modality: "Contrata",
    });
  });

  it("drops a natural-person contractor and supervisor", () => {
    const work = mapInfobrasRecord({
      ...RECORD,
      "RUC (Ejecución)": "10412345678",
      "RUC (Supervisión)": "10498765432",
      "Nombre o razón social de la empresa o consorcio #2": "MARIA LOPEZ",
    });
    expect(work).toMatchObject({
      contractorKind: "persona_natural",
      contractorRuc: null,
      contractorName: null,
      supervisorKind: "persona_natural",
      supervisorRuc: null,
      supervisorName: null,
    });
    expect(JSON.stringify(work)).not.toMatch(/AMERIKA|MARIA|1041|1049/);
  });

  it("stores zero amounts and terms as null (nothing registered)", () => {
    const work = mapInfobrasRecord({
      ...RECORD,
      "Monto del contrato en soles": "0",
      "Monto de adicionales de obra en soles": "0",
      "Monto de deductivos de obra en soles": "0",
      "N° días de modificaciones de plazo": "0",
      "Número de dias paralizado": "0",
    });
    expect(work).toMatchObject({
      contractAmount: null,
      additionalWorksAmount: null,
      deductionsAmount: null,
      extensionDays: null,
      paralysisDays: null,
    });
  });

  it("reads a finished obra with reception and liquidation and no progress report", () => {
    const work = mapInfobrasRecord({
      ...RECORD,
      "Estado de ejecución": "Finalizado",
      "Existe Paralización": "No",
      "Causal de paralización": "",
      "Fecha de paralización": "",
      "Número de dias paralizado": "",
      "Año de avance": "",
      "Mes de avance": "",
      "Fecha de registro de avance": "",
      "Avance Físico Programado Acumulado (%)": "",
      "Avance Físico Real Acumulado (%)": "",
      "Fecha de recepción": "31/12/2013",
      "Fecha de aprobación de liquidación de obra": "27/12/2013",
    });
    expect(work).toMatchObject({
      executionStatus: "Finalizado",
      hasParalysis: false,
      paralysisCause: null,
      paralysisDate: null,
      physicalProgressPlanned: null,
      physicalProgressActual: null,
      progressPeriod: null,
      progressRegisteredAt: null,
      receptionDate: "2013-12-31",
      liquidationDate: "2013-12-27",
    });
  });

  it("treats a CUI or SNIP of 0 as missing and an unknown status as null", () => {
    const work = mapInfobrasRecord({
      ...RECORD,
      "Codigo unico de inversión": "0",
      "Código SNIP": "",
      "Estado de ejecución": "Otro",
    });
    expect(work).toMatchObject({ cui: null, snip: null, executionStatus: null });
  });

  it("is null without a valid INFOBRAS code", () => {
    expect(mapInfobrasRecord({ ...RECORD, "Código INFOBRAS": "" })).toBeNull();
    expect(mapInfobrasRecord({ ...RECORD, "Código INFOBRAS": "abc" })).toBeNull();
    expect(mapInfobrasRecord({ ...RECORD, "Código INFOBRAS": "0" })).toBeNull();
  });

  it("never reads a person-name column", () => {
    for (const header of INFOBRAS_HEADERS) expect(header).not.toMatch(/Nombres Apellidos/);
  });
});

describe("dataAsOf", () => {
  it("is the latest progress registration date, ignoring dates after the load", () => {
    const rows = [
      { progressRegisteredAt: "2026-03-31" },
      { progressRegisteredAt: null },
      { progressRegisteredAt: "2026-01-15" },
      { progressRegisteredAt: "2031-01-01" },
    ];
    expect(dataAsOf(rows, "2026-10-31")).toBe("2026-03-31");
  });

  it("is null without any registration date", () => {
    expect(dataAsOf([{ progressRegisteredAt: null }], "2026-10-31")).toBeNull();
  });
});
