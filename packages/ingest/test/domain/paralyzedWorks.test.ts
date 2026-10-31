import { describe, expect, it } from "vitest";
import {
  excelDate,
  mapParalyzedRecord,
  normalizeHeader,
  parseCode,
  parseGovernmentLevel,
  safeUrl,
  splitCausal,
  type ParalyzedRecord,
} from "../../src/domain/paralyzedWorks.js";

const EDITION = { cutoff: "2026-06-30", publishedAt: "2026-08-17" };

/** Row 2 of the June 2026 Anexo N° 01, as exceljs reads it, keyed by normalized header. */
const RECORD: ParalyzedRecord = {
  "N°": 2,
  "CODIGO INFOBRAS": 80,
  CUI: 2031099,
  "DESCRIPCION DE INVERSION": "AMPLIACION Y MEJORAMIENTO DEL SISTEMA DE AGUA POTABLE Y ALCANTARILLADO",
  SNIP: 32800,
  "DESCRIPCION OBRA": "AMPLIACION Y MEJORAMIENTO DEL SISTEMA DE AGUA POTABLE Y ALCANTARILLADO ",
  ENTIDAD: "SERV AGUA POTAB Y ALCANT DE LIMA-SEDAPAL",
  EVENTO: "Proceso Normal",
  "MODALIDAD DE EJECUCIÓN": "Contrata",
  "COSTO DE OBRA SEGÚN EXP. TEC.": 40489002,
  "SALDO DE OBRA": 0,
  "COSTO ACTUALIZADO": 99937290.57,
  "SALDO DE LA INVERSIÓN": 99937290.57,
  "TIPO DE OBRA": "Vivienda, Construcción Y Saneamiento",
  DEPARTAMENTO: "LIMA",
  PROVINCIA: "LIMA",
  DISTRITO: "VILLA EL SALVADOR",
  "AÑO INICIO OBRA": 2008,
  "PLAZO DE EJECUCIÓN": 480,
  "AVANCE FÍSICO": 87.63,
  "NIVEL DE GOBIERNO": "G. NACIONAL",
  SECTOR: "VIVIENDA CONSTRUCCIÓN Y SANEAMIENTO",
  "CAUSAL PARALIZACION": "2 INCUMPLIMIENTO DE CONTRATO",
  "UNIDAD ORGÁNICA": "SUBGERENCIA DE CONTROL DEL SECTOR VIVIENDA, CONSTRUCCIÓN Y SANEAMIENTO",
  "ESTA EN EL INVENTARIO OBRAS PARALIZADAS MEF": "SI",
  "FECHA DE REGISTRO EN EL INVENTARIO": new Date("2025-11-04T00:00:00.000Z"),
  "CUENTA CON INFORME DE ESTADO SITUACIONAL": "SI",
  "FECHA INFORME SITUACIONAL": 46003,
  "URL INFORME": "https://ofi5.mef.gob.pe/invierte/general/downloadArchivo?idArchivo=dabf8ca9.pdf",
  "DENTRO DE LA LISTA PRIORIZADA": "NO",
  "URL RESOLUCION": " ",
};

describe("normalizeHeader", () => {
  it("keeps the first line of a header, trimmed and in upper case", () => {
    expect(normalizeHeader("SALDO DE OBRA\n(Costo de obra - Avance Valorizado)")).toBe("SALDO DE OBRA");
    expect(normalizeHeader(" Avance físico ")).toBe("AVANCE FÍSICO");
    expect(normalizeHeader(null)).toBe("");
  });
});

describe("excelDate", () => {
  it("reads dates, Excel serials and ISO text", () => {
    expect(excelDate(new Date("2025-11-04T00:00:00.000Z"))).toBe("2025-11-04");
    expect(excelDate(46004)).toBe("2025-12-13");
    expect(excelDate(45694)).toBe("2025-02-06");
    expect(excelDate("2024-04-22")).toBe("2024-04-22");
    expect(excelDate("22/04/2024")).toBe("2024-04-22");
  });

  it("is null for blanks and nonsense", () => {
    expect(excelDate(null)).toBeNull();
    expect(excelDate(" ")).toBeNull();
    expect(excelDate(0)).toBeNull();
    expect(excelDate(-3)).toBeNull();
    expect(excelDate("No declarado")).toBeNull();
    expect(excelDate(new Date(Number.NaN))).toBeNull();
  });
});

describe("splitCausal", () => {
  it("splits the leading number from the text", () => {
    expect(splitCausal("2 INCUMPLIMIENTO DE CONTRATO")).toEqual({ code: 2, label: "INCUMPLIMIENTO DE CONTRATO" });
    expect(splitCausal("9 EVENTOS CLIMÁTICOS ")).toEqual({ code: 9, label: "EVENTOS CLIMÁTICOS" });
    expect(splitCausal("15 OTROS")).toEqual({ code: 15, label: "OTROS" });
  });

  it("keeps a causal without number as text", () => {
    expect(splitCausal("FALTA DE PERSONAL CLAVE")).toEqual({ code: null, label: "FALTA DE PERSONAL CLAVE" });
    expect(splitCausal("  ")).toEqual({ code: null, label: null });
    expect(splitCausal(null)).toEqual({ code: null, label: null });
  });
});

describe("parseCode", () => {
  it("turns a positive whole number into text and a blank (0) into null", () => {
    expect(parseCode(2031099)).toBe("2031099");
    expect(parseCode("2499818")).toBe("2499818");
    expect(parseCode(0)).toBeNull();
    expect(parseCode("")).toBeNull();
    expect(parseCode("12a")).toBeNull();
    expect(parseCode(12.5)).toBeNull();
  });
});

describe("parseGovernmentLevel", () => {
  it("maps the source labels to GN, GR and GL", () => {
    expect(parseGovernmentLevel("G. NACIONAL")).toBe("GN");
    expect(parseGovernmentLevel("G. REGIONAL")).toBe("GR");
    expect(parseGovernmentLevel("G. LOCAL")).toBe("GL");
    expect(parseGovernmentLevel("Gobierno Local")).toBe("GL");
    expect(parseGovernmentLevel("OTRO")).toBeNull();
  });
});

describe("safeUrl", () => {
  it("keeps http(s) URLs only", () => {
    expect(safeUrl(" https://ofi5.mef.gob.pe/x.pdf ")).toBe("https://ofi5.mef.gob.pe/x.pdf");
    expect(safeUrl(" ")).toBeNull();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("ofi5.mef.gob.pe/x.pdf")).toBeNull();
  });
});

describe("mapParalyzedRecord", () => {
  it("maps every kept column", () => {
    expect(mapParalyzedRecord(RECORD, EDITION)).toEqual({
      editionCutoff: "2026-06-30",
      publishedAt: "2026-08-17",
      infobrasCode: 80,
      cui: "2031099",
      snip: "32800",
      investmentDescription: "AMPLIACION Y MEJORAMIENTO DEL SISTEMA DE AGUA POTABLE Y ALCANTARILLADO",
      obraDescription: "AMPLIACION Y MEJORAMIENTO DEL SISTEMA DE AGUA POTABLE Y ALCANTARILLADO",
      entity: "SERV AGUA POTAB Y ALCANT DE LIMA-SEDAPAL",
      governmentLevel: "GN",
      sector: "VIVIENDA CONSTRUCCIÓN Y SANEAMIENTO",
      departmentCode: 15,
      department: "LIMA",
      province: "LIMA",
      district: "VILLA EL SALVADOR",
      event: "Proceso Normal",
      modality: "Contrata",
      workType: "Vivienda, Construcción Y Saneamiento",
      causalCode: 2,
      causalLabel: "INCUMPLIMIENTO DE CONTRATO",
      physicalProgress: 87.63,
      expedienteCost: 40489002,
      remainingWorkBalance: 0,
      updatedCost: 99937290.57,
      investmentBalance: 99937290.57,
      startYear: 2008,
      executionDays: 480,
      mefInventory: true,
      mefInventoryRegisteredAt: "2025-11-04",
      situationalReportAt: "2025-12-12",
      mefReportUrl: "https://ofi5.mef.gob.pe/invierte/general/downloadArchivo?idArchivo=dabf8ca9.pdf",
      prioritized: false,
      prioritizedResolutionAt: null,
      prioritizedResolutionUrl: null,
    });
  });

  it("never keeps the Contraloría unit or the row number", () => {
    const work = mapParalyzedRecord(RECORD, EDITION) as unknown as Record<string, unknown>;
    expect(Object.values(work)).not.toContain(RECORD["UNIDAD ORGÁNICA"]);
    expect(Object.keys(work)).not.toContain("rowNumber");
  });

  it("turns blanks into null: CUI and SNIP 0, an undeclared start year, missing progress", () => {
    const work = mapParalyzedRecord(
      {
        ...RECORD,
        CUI: 0,
        SNIP: 0,
        "AÑO INICIO OBRA": "No declarado",
        "AVANCE FÍSICO": null,
        "PLAZO DE EJECUCIÓN": null,
        DEPARTAMENTO: "ÁNCASH",
        "ESTA EN EL INVENTARIO OBRAS PARALIZADAS MEF": "NO",
        "FECHA DE REGISTRO EN EL INVENTARIO": null,
        "URL INFORME": null,
        "CUENTA CON INFORME DE ESTADO SITUACIONAL": null,
        "DENTRO DE LA LISTA PRIORIZADA": null,
      },
      EDITION,
    );
    expect(work).toMatchObject({
      cui: null,
      snip: null,
      startYear: null,
      physicalProgress: null,
      executionDays: null,
      departmentCode: 2,
      mefInventory: false,
      mefInventoryRegisteredAt: null,
      mefReportUrl: null,
      prioritized: null,
    });
  });

  it("reads the Callao department as the source writes it", () => {
    expect(mapParalyzedRecord({ ...RECORD, DEPARTAMENTO: "P. C. DEL CALLAO" }, EDITION)?.departmentCode).toBe(7);
    expect(mapParalyzedRecord({ ...RECORD, DEPARTAMENTO: "PROVINCIA CONSTITUCIONAL DEL CALLAO" }, EDITION)?.departmentCode).toBe(7);
  });

  it("drops a row without an INFOBRAS code", () => {
    expect(mapParalyzedRecord({ ...RECORD, "CODIGO INFOBRAS": null }, EDITION)).toBeNull();
    expect(mapParalyzedRecord({ ...RECORD, "CODIGO INFOBRAS": 0 }, EDITION)).toBeNull();
  });
});
