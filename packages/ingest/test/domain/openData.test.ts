import { describe, expect, it } from "vitest";
import {
  mapOpenDataRecord,
  peruCoordinates,
  type OpenDataCsvRecord,
  type OpenDataContext,
} from "../../src/domain/openData.js";

const context: OpenDataContext = {
  sourceUpdatedAt: "2026-10-25T18:31:25.000Z",
  runAt: "2026-10-26T10:00:00.000Z",
};

/** A real row of DETALLE_INVERSIONES.csv (CUI 2114611, GR Arequipa), ALTERNATIVA dropped. */
function record(overrides: OpenDataCsvRecord = {}): OpenDataCsvRecord {
  return {
    NIVEL: "GR",
    SECTOR: "GOBIERNOS REGIONALES",
    ENTIDAD: "GOBIERNO REGIONAL AREQUIPA",
    CODIGO_UNICO: "2114611",
    CODIGO_SNIP: "143835",
    NOMBRE_INVERSION: "MEJORAMIENTO E IMPLEMENTACION DEL TALLER  DE EQUIPO MECÁNICO",
    NOMBRE_UEP: "REGION AREQUIPA-TRANSPORTES",
    ESTADO: "ACTIVO",
    SITUACION: "VIABLE",
    MONTO_VIABLE: "1372738.0",
    COSTO_ACTUALIZADO: "1420793.0",
    CTRL_CONCURR: "0.0",
    MONTO_LAUDO: "250.5",
    MONTO_FIANZA: "1000.0",
    FECHA_REGISTRO: "2010-01-28 00:00:00",
    FECHA_VIABILIDAD: "2010-02-03 00:00:00",
    FUNCION: "TRANSPORTE",
    PROGRAMA: "TRANSPORTE TERRESTRE",
    SUBPROGRAMA: "VÍAS DEPARTAMENTALES",
    MARCO: "SNIP",
    TIPO_INVERSION: "PIP MAYOR (SNIP)",
    PRIMER_DEVENGADO: "201008",
    ULTIMO_DEVENGADO: "202609",
    DEVEN_ACUMUL_ANIO_ANT: "1385293.0",
    DEV_ANIO_ACTUAL: "410.0",
    PIM_ANIO_ACTUAL: "35500",
    SALDO_EJECUTAR: "0.0",
    TIENE_AVAN_FISICO: "SI",
    AVANCE_FISICO: "97.5",
    DEPARTAMENTO: "AREQUIPA",
    PROVINCIA: "AREQUIPA",
    DISTRITO: "PAUCARPATA",
    UBIGEO: "040112",
    LATITUD: "-16.4285",
    LONGITUD: "-71.5065",
    NUM_HABITANTES_BENEF: "1152303",
    ANIO_PROCESO: "2026",
    ...overrides,
  };
}

function map(overrides: OpenDataCsvRecord = {}) {
  const result = mapOpenDataRecord(record(overrides), context);
  if (result === null) throw new Error("expected a mapped investment");
  return result;
}

describe("mapOpenDataRecord", () => {
  it("maps every column of a full row", () => {
    expect(map()).toEqual({
      cui: "2114611",
      snipCode: "143835",
      name: "MEJORAMIENTO E IMPLEMENTACION DEL TALLER  DE EQUIPO MECÁNICO",
      governmentLevel: "GR",
      sector: "GOBIERNOS REGIONALES",
      entity: "GOBIERNO REGIONAL AREQUIPA",
      executingUnit: "REGION AREQUIPA-TRANSPORTES",
      status: "ACTIVO",
      situation: "VIABLE",
      beneficiaries: 1152303,
      registeredAt: "2010-01-28",
      viabilityAt: "2010-02-03",
      investmentType: "PIP MAYOR (SNIP)",
      function: "TRANSPORTE",
      functionalDivision: "TRANSPORTE TERRESTRE",
      functionalGroup: "VÍAS DEPARTAMENTALES",
      framework: "SNIP",
      viableAmount: 1372738,
      updatedCost: 1420793,
      pim: 35500,
      pimYear: 2026,
      accruedYear: 410,
      accruedPreviousYears: 1385293,
      accruedTotal: 1385703,
      firstAccrualMonth: "2010-08-01",
      lastAccrualMonth: "2026-09-01",
      pendingBalance: 0,
      disputeCost: 250.5,
      guaranteeAmount: 1000,
      concurrentControlCost: 0,
      physicalProgress: 97.5,
      departmentCode: 4,
      departmentName: "Arequipa",
      province: "AREQUIPA",
      district: "PAUCARPATA",
      ubigeo: "040112",
      latitude: -16.4285,
      longitude: -71.5065,
      sourceUpdatedAt: "2026-10-25T18:31:25.000Z",
      openDataUpdatedAt: "2026-10-26T10:00:00.000Z",
    });
  });

  it("returns null without a CUI", () => {
    expect(mapOpenDataRecord(record({ CODIGO_UNICO: "" }), context)).toBeNull();
    expect(mapOpenDataRecord(record({ CODIGO_UNICO: "  " }), context)).toBeNull();
  });

  it("never carries ALTERNATIVA or unmapped columns", () => {
    const mapped = map({ ALTERNATIVA: "Long free text, with commas", NOMBRE_OPMI: "OPMI" });
    expect(JSON.stringify(mapped)).not.toContain("Long free text");
    expect(mapped).not.toHaveProperty("alternative");
    expect(JSON.stringify(mapped)).not.toContain("OPMI");
  });

  describe("accrued total", () => {
    it("adds previous years and the current year, matching the SSI to the cent", () => {
      // CUI 2094808: the SSI reports an accrued total of 1,459,731,800.72.
      const mapped = map({ DEVEN_ACUMUL_ANIO_ANT: "1344883454.24", DEV_ANIO_ACTUAL: "114848346.48" });
      expect(mapped.accruedTotal).toBe(1459731800.72);
    });

    it("treats one missing part as zero", () => {
      expect(map({ DEVEN_ACUMUL_ANIO_ANT: "", DEV_ANIO_ACTUAL: "410.0" }).accruedTotal).toBe(410);
      expect(map({ DEVEN_ACUMUL_ANIO_ANT: "1385293.0", DEV_ANIO_ACTUAL: "" }).accruedTotal).toBe(1385293);
    });

    it("is null when both parts are missing", () => {
      const mapped = map({ DEVEN_ACUMUL_ANIO_ANT: "", DEV_ANIO_ACTUAL: "" });
      expect(mapped.accruedTotal).toBeNull();
      expect(mapped.accruedYear).toBeNull();
      expect(mapped.accruedPreviousYears).toBeNull();
    });
  });

  describe("coordinates", () => {
    it("are null when the source has 0.0", () => {
      const mapped = map({ LATITUD: "0.0", LONGITUD: "0.0" });
      expect(mapped.latitude).toBeNull();
      expect(mapped.longitude).toBeNull();
    });

    it("are both null when either one is outside Peru", () => {
      expect(map({ LATITUD: "-16.4", LONGITUD: "71.5" })).toMatchObject({ latitude: null, longitude: null });
      expect(map({ LATITUD: "-25.0", LONGITUD: "-71.5" })).toMatchObject({ latitude: null, longitude: null });
    });

    it("are null when empty or not numeric", () => {
      expect(map({ LATITUD: "", LONGITUD: "" })).toMatchObject({ latitude: null, longitude: null });
      expect(map({ LATITUD: "abc", LONGITUD: "-71.5" })).toMatchObject({ latitude: null, longitude: null });
    });
  });

  describe("department", () => {
    it("comes from the ubigeo when it has one", () => {
      expect(map({ UBIGEO: "070101", DEPARTAMENTO: "CALLAO" })).toMatchObject({
        departmentCode: 7,
        departmentName: "Callao",
      });
    });

    it("falls back to the department name when the ubigeo is blank", () => {
      expect(map({ UBIGEO: "", DEPARTAMENTO: "LIMA" })).toMatchObject({
        departmentCode: 15,
        departmentName: "Lima",
        ubigeo: null,
      });
    });

    it("is null for multi-department investments", () => {
      expect(map({ UBIGEO: "990000", DEPARTAMENTO: "-MUL.DEP-" })).toMatchObject({
        departmentCode: null,
        departmentName: null,
        ubigeo: "990000",
      });
      expect(map({ UBIGEO: "99", DEPARTAMENTO: "-MUL.DEP-" })).toMatchObject({
        departmentCode: null,
        ubigeo: null,
      });
    });

    it("is null without ubigeo or department name", () => {
      expect(map({ UBIGEO: "", DEPARTAMENTO: "" })).toMatchObject({ departmentCode: null, departmentName: null });
    });
  });

  describe("physical progress", () => {
    it("is null when the investment reports no physical progress", () => {
      expect(map({ TIENE_AVAN_FISICO: "NO", AVANCE_FISICO: "0.0" }).physicalProgress).toBeNull();
      expect(map({ TIENE_AVAN_FISICO: "SI", AVANCE_FISICO: "" }).physicalProgress).toBeNull();
    });

    it("keeps 0 and 100 when reported", () => {
      expect(map({ AVANCE_FISICO: "0.0" }).physicalProgress).toBe(0);
      expect(map({ AVANCE_FISICO: "100.0" }).physicalProgress).toBe(100);
    });

    it("is null outside the 0-100 range", () => {
      expect(map({ AVANCE_FISICO: "1250.0" }).physicalProgress).toBeNull();
      expect(map({ AVANCE_FISICO: "-1" }).physicalProgress).toBeNull();
    });
  });

  it("turns empty values into nulls", () => {
    const mapped = map({
      CODIGO_SNIP: "",
      MONTO_VIABLE: "",
      FECHA_VIABILIDAD: "",
      PRIMER_DEVENGADO: "",
      ULTIMO_DEVENGADO: "",
      NUM_HABITANTES_BENEF: "",
      NOMBRE_UEP: "",
      PIM_ANIO_ACTUAL: "",
      SALDO_EJECUTAR: "",
      ANIO_PROCESO: "",
    });
    expect(mapped).toMatchObject({
      snipCode: null,
      viableAmount: null,
      viabilityAt: null,
      firstAccrualMonth: null,
      lastAccrualMonth: null,
      beneficiaries: null,
      executingUnit: null,
      pim: null,
      pendingBalance: null,
      pimYear: null,
    });
  });

  it("keeps negative pending balances as published", () => {
    expect(map({ SALDO_EJECUTAR: "-1520.35" }).pendingBalance).toBe(-1520.35);
  });

  it("treats missing columns like empty ones", () => {
    const mapped = mapOpenDataRecord({ CODIGO_UNICO: "1", NIVEL: "GN" }, context);
    expect(mapped).toMatchObject({ cui: "1", governmentLevel: "GN", departmentCode: null, accruedTotal: null });
  });
});

describe("peruCoordinates", () => {
  it("accepts points inside the Peru bounding box", () => {
    expect(peruCoordinates(-12.0464, -77.0428)).toEqual({ latitude: -12.0464, longitude: -77.0428 });
    expect(peruCoordinates(-19, -82)).toEqual({ latitude: -19, longitude: -82 });
  });

  it("rejects 0.0, missing values and points outside the box", () => {
    expect(peruCoordinates(0, 0)).toBeNull();
    expect(peruCoordinates(0, -77)).toBeNull();
    expect(peruCoordinates(null, -77)).toBeNull();
    expect(peruCoordinates(-12, -67.9)).toBeNull();
    expect(peruCoordinates(-19.1, -77)).toBeNull();
  });
});
