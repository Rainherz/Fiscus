import { describe, expect, it } from "vitest";
import {
  CLOSURE_DESCRIPTION_MAX_LENGTH,
  mapClosedDataRecord,
  type ClosedInvestment,
} from "../../src/domain/closedData.js";
import type { OpenDataContext, OpenDataCsvRecord } from "../../src/domain/openData.js";

const context: OpenDataContext = {
  sourceUpdatedAt: "2026-10-27T18:12:19.000Z",
  runAt: "2026-10-28T10:05:00.000Z",
};

/** A real row of CIERRE_INVERSIONES.csv (CUI 2100997, GL Huancavelica); RESPONSABLE_UEI is a placeholder. */
function record(overrides: OpenDataCsvRecord = {}): OpenDataCsvRecord {
  return {
    NIVEL: "GL",
    SECTOR: "GOBIERNOS LOCALES",
    ENTIDAD: "MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA",
    CODIGO_UNICO: "2100997",
    CODIGO_SNIP: "124557",
    NOMBRE_INVERSION: "FORTALECIMIENTO DE CAPACIDADES PARA LA ACTIVIDAD PRODUCTIVA DE GANADO OVINO",
    ESTADO: "CERRADO",
    SITUACION: "VIABLE",
    MONTO_VIABLE: "101700.0",
    COSTO_ACTUALIZADO: "101700.0",
    CONTROL_CONCURR: "0.0",
    MONTO_LAUDO: "0.0",
    MONTO_FIANZA: "0.0",
    FECHA_REGISTRO: "2009-07-17 00:00:00",
    FECHA_VIABILIDAD: "2009-07-17 00:00:00",
    FUNCION: "AGROPECUARIA",
    PROGRAMA: "PECUARIO",
    SUBPROGRAMA: "INOCUIDAD PECUARIA",
    MARCO: "SNIP",
    TIPO_INVERSION: "PIP MENOR (SNIP)",
    NOM_OPMI: "OPMI DE LA MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA",
    NOM_UEI: "UEI DE LA MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA",
    RESPONSABLE_UEI: "PERSONA DE PRUEBA",
    SEC_EJEC: "300793",
    NOM_UEP: "MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA",
    EXPEDIENTE_TECNICO: "NO",
    INFORME_CIERRE: "SI",
    FEC_CIERRE: "2019-11-29 18:57:46",
    DES_CIERRE: "Sí, con liquidación",
    TIENE_F9: "SÍ",
    CULMINADA: "SÍ",
    INICIO_EJEC_FISICA: "2010-03-01 00:00:00",
    CULMINA_EJEC_FISICA: "2010-11-30 00:00:00",
    ETAPA_F9: "Cierre",
    FEC_INI_OPER: "2010-12-27 00:00:00",
    PRIMER_DEVENGADO: "201005",
    ULTIMO_DEVENGADO: "201012",
    DEVEN_ACUMULADO: "97418.7",
    TOTAL_LIQUIDACION: "100000.0",
    FEC_LIQUIDACION: "2015-05-19 00:00:00",
    UNIDAD_OPE_MANT: "poblacion beneficiaria",
    BENEFICIARIO: "220.0",
    DEPARTAMENTO: "HUANCAVELICA",
    PROVINCIA: "HUANCAVELICA",
    DISTRITO: "ACOBAMBILLA",
    UBIGEO: "090102",
    LATITUD: "-12.6611",
    LONGITUD: "-75.3253",
    ANIO_PROCESO: "2026",
    ...overrides,
  };
}

function map(overrides: OpenDataCsvRecord = {}): ClosedInvestment {
  const result = mapClosedDataRecord(record(overrides), context);
  if (result === null) throw new Error("expected a mapped investment");
  return result;
}

describe("mapClosedDataRecord", () => {
  it("maps every stored column of a full row", () => {
    expect(map()).toEqual({
      cui: "2100997",
      snipCode: "124557",
      name: "FORTALECIMIENTO DE CAPACIDADES PARA LA ACTIVIDAD PRODUCTIVA DE GANADO OVINO",
      governmentLevel: "GL",
      sector: "GOBIERNOS LOCALES",
      entity: "MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA",
      executingUnit: "MUNICIPALIDAD DISTRITAL DE ACOBAMBILLA",
      status: "CERRADO",
      situation: "VIABLE",
      beneficiaries: 220,
      registeredAt: "2009-07-17",
      viabilityAt: "2009-07-17",
      investmentType: "PIP MENOR (SNIP)",
      function: "AGROPECUARIA",
      functionalDivision: "PECUARIO",
      functionalGroup: "INOCUIDAD PECUARIA",
      framework: "SNIP",
      viableAmount: 101700,
      updatedCost: 101700,
      accruedTotal: 97418.7,
      firstAccrualMonth: "2010-05-01",
      lastAccrualMonth: "2010-12-01",
      disputeCost: 0,
      guaranteeAmount: 0,
      concurrentControlCost: 0,
      departmentCode: 9,
      departmentName: "Huancavelica",
      province: "HUANCAVELICA",
      district: "ACOBAMBILLA",
      ubigeo: "090102",
      latitude: -12.6611,
      longitude: -75.3253,
      closedAt: "2019-11-29",
      closureDescription: "Sí, con liquidación",
      liquidationAmount: 100000,
      liquidatedAt: "2015-05-19",
      culminated: true,
      physicalStartAt: "2010-03-01",
      physicalEndAt: "2010-11-30",
      operationStartAt: "2010-12-27",
      sourceUpdatedAt: "2026-10-27T18:12:19.000Z",
      openDataUpdatedAt: "2026-10-28T10:05:00.000Z",
    });
  });

  it("never carries RESPONSABLE_UEI (a person's name) or other unmapped columns", () => {
    const mapped = map({ RESPONSABLE_UEI: "JUAN PEREZ" });
    const json = JSON.stringify(mapped);
    expect(json).not.toContain("JUAN PEREZ");
    expect(json).not.toContain("PERSONA DE PRUEBA");
    expect(json).not.toContain("OPMI DE LA");
    expect(json).not.toContain("poblacion beneficiaria");
  });

  it("returns null without a CUI", () => {
    expect(mapClosedDataRecord(record({ CODIGO_UNICO: "" }), context)).toBeNull();
    expect(mapClosedDataRecord(record({ CODIGO_UNICO: "   " }), context)).toBeNull();
  });

  it("reads CULMINADA SÍ / NO / blank", () => {
    expect(map({ CULMINADA: "SÍ" }).culminated).toBe(true);
    expect(map({ CULMINADA: "NO" }).culminated).toBe(false);
    expect(map({ CULMINADA: "" }).culminated).toBeNull();
  });

  it("leaves absent closure facts null", () => {
    expect(
      map({
        FEC_CIERRE: "",
        DES_CIERRE: "",
        TOTAL_LIQUIDACION: "",
        FEC_LIQUIDACION: "",
        INICIO_EJEC_FISICA: "",
        CULMINA_EJEC_FISICA: "",
        FEC_INI_OPER: "",
      }),
    ).toMatchObject({
      closedAt: null,
      closureDescription: null,
      liquidationAmount: null,
      liquidatedAt: null,
      physicalStartAt: null,
      physicalEndAt: null,
      operationStartAt: null,
    });
  });

  it("keeps a published zero liquidation (the app decides how to show it)", () => {
    expect(map({ TOTAL_LIQUIDACION: "0.0" }).liquidationAmount).toBe(0);
  });

  it("trims the closure description and caps its length", () => {
    expect(map({ DES_CIERRE: "  No culminada  " }).closureDescription).toBe("No culminada");
    expect(map({ DES_CIERRE: "x".repeat(300) }).closureDescription).toHaveLength(CLOSURE_DESCRIPTION_MAX_LENGTH);
  });

  it("drops the source's 0.0 coordinates and finds the department from the ubigeo", () => {
    expect(map({ LATITUD: "0.0", LONGITUD: "0.0" })).toMatchObject({ latitude: null, longitude: null, departmentCode: 9 });
  });

  it("has no department for multi-department national investments", () => {
    expect(map({ NIVEL: "GN", UBIGEO: "990000", DEPARTAMENTO: "" })).toMatchObject({
      departmentCode: null,
      departmentName: null,
      ubigeo: "990000",
    });
  });
});
