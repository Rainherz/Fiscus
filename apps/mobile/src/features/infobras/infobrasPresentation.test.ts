import { mapInfobrasWorkRow, type InfobrasWork } from '@/features/investments/domain/infobras';

import {
  contractorKindLabel,
  contractorRowDetail,
  contractorSortValue,
  contractorsNote,
  contractorWorkRow,
  infobrasCaveat,
  infobrasContractLine,
  infobrasDetailLine,
  infobrasFigures,
  infobrasFooter,
  infobrasMoreLabel,
  infobrasObraRows,
  infobrasObraSummary,
  infobrasSourceName,
  INVALID_CONTRACT_AMOUNT_TEXT,
  invalidContractsText,
  visibleInfobrasWorks,
} from './infobrasPresentation';

const NO_PARTY = { kind: null, ruc: null, name: null };

function work(overrides: Partial<InfobrasWork> = {}): InfobrasWork {
  return {
    ...mapInfobrasWorkRow({ infobras_code: 36233, cui: '2132947' }),
    executionStatus: 'En Ejecución',
    physicalProgressActual: 62.5,
    physicalProgressPlanned: 80,
    progressPeriod: '2025-12-01',
    contractAmount: 3_158_683.99,
    contractor: { kind: 'empresa', ruc: '20301552115', name: 'CONSTRUCTORA ANDES S.A.C. (demo)' },
    supervisor: { kind: 'consorcio', ruc: 'C0003136723', name: 'CONSORCIO SUPERVISOR (demo)' },
    modality: 'Contrata',
    ...overrides,
  };
}

describe('infobrasCaveat', () => {
  it('states the date of the data and that the status may have changed', () => {
    expect(infobrasCaveat('2026-03-31')).toBe('Datos de INFOBRAS al 31/03/2026. El estado puede haber cambiado.');
    expect(infobrasCaveat(null)).toBe('Datos de INFOBRAS. El estado puede haber cambiado.');
  });
});

describe('invalid contract amounts (Regla de Fiscus)', () => {
  it('shows the notice instead of the figure and leaves it out of the total', () => {
    const invalid = work({ contractAmount: 113_862_565_000, contractAmountValid: false });
    expect(infobrasContractLine({ ...invalid, contractor: NO_PARTY })?.text).toBe(INVALID_CONTRACT_AMOUNT_TEXT);
    expect(INVALID_CONTRACT_AMOUNT_TEXT).toBe('Monto de contrato no válido en la fuente INFOBRAS');
    expect(JSON.stringify([infobrasObraRows([invalid]), infobrasFigures([invalid])])).not.toMatch(/113,862|113\.9|114 M/);
  });

  it('says how many amounts were excluded', () => {
    expect(invalidContractsText(0)).toBeNull();
    expect(invalidContractsText(1)).toBe('1 monto no válido excluido');
    expect(invalidContractsText(3)).toBe('3 montos no válidos excluidos');
  });

  it('marks an invalid amount in the obra row of the contractor page', () => {
    const row = contractorWorkRow({
      infobrasCode: 507248,
      cui: null,
      executionStatus: 'Paralizada',
      contractAmount: 113_862_565_000,
      contractAmountValid: false,
      additionalWorksAmount: null,
      physicalProgressActual: 97,
      investmentName: null,
      entity: null,
      departmentCode: null,
      governmentLevel: null,
      investmentStatus: null,
      contraloriaParalyzed: false,
    });
    expect(row.detail[1]).toBe('Paralizada · monto de contrato no válido en la fuente INFOBRAS');
  });
});

describe('visibleInfobrasWorks', () => {
  const works = Array.from({ length: 7 }, (_, i) => work({ infobrasCode: i + 1 }));

  it('shows five obras until expanded', () => {
    expect(visibleInfobrasWorks(works, false)).toEqual({ shown: works.slice(0, 5), hidden: 2 });
    expect(visibleInfobrasWorks(works, true)).toEqual({ shown: works, hidden: 0 });
    expect(visibleInfobrasWorks(works.slice(0, 3), false)).toEqual({ shown: works.slice(0, 3), hidden: 0 });
  });
});

describe('contractor ranking wording', () => {
  const item = {
    ruc: '20301552115',
    name: 'CONSTRUCTORA ANDES S.A.C. (demo)',
    kind: 'empresa' as const,
    obraCount: 12,
    totalContractAmount: 48_000_000,
    totalAdditionalWorks: 2_500_000,
    contraloriaParalyzedCount: 1,
    invalidContractCount: 0,
  };

  it('shows the figure of the sort', () => {
    expect(contractorSortValue('contract', item)).toBe('S/ 48 M');
    expect(contractorSortValue('additional', item)).toBe('S/ 2.5 M');
    expect(contractorSortValue('paralyzed', item)).toBe('1');
  });

  it('describes a contractor in one factual line', () => {
    expect(contractorRowDetail(item)).toBe('Empresa · RUC 20301552115 · 12 obras · S/ 2.5 M en adicionales · 1 paralizada (Contraloría)');
    expect(contractorRowDetail({ ...item, kind: 'consorcio', ruc: 'C0003136723', obraCount: 1, totalAdditionalWorks: 0, contraloriaParalyzedCount: 0 })).toBe(
      'Consorcio · código C0003136723 · 1 obra',
    );
  });

  it('says how many invalid contract amounts the total leaves out', () => {
    expect(contractorRowDetail({ ...item, totalAdditionalWorks: 0, contraloriaParalyzedCount: 0, invalidContractCount: 3 })).toBe(
      'Empresa · RUC 20301552115 · 12 obras · 3 montos no válidos excluidos',
    );
  });

  it('labels the kinds', () => {
    expect(contractorKindLabel('empresa')).toBe('Empresa');
    expect(contractorKindLabel('consorcio')).toBe('Consorcio');
    expect(contractorKindLabel(null)).toBe('Contratista');
  });

  it('explains the list, its scope and the date of the data', () => {
    expect(contractorsNote('2026-03-31')).toBe(
      'Empresas y consorcios con obras registradas en INFOBRAS; no incluye personas naturales. ' +
        'La región, el nivel y el estado son los del proyecto de cada obra. ' +
        'Los montos de contrato no válidos en la fuente no se suman. Datos de INFOBRAS al 31/03/2026.',
    );
  });
});

describe('infobrasObraSummary', () => {
  it('states code, status and real progress with the programmed one and its month', () => {
    expect(infobrasObraSummary(work({ infobrasCode: 171686, executionStatus: 'Finalizado', physicalProgressActual: 52, physicalProgressPlanned: 100, progressPeriod: '2024-06-01' }))).toBe(
      'Obra 171686 · Finalizado · avance 52 % (prog. 100 %, jun 2024)',
    );
  });

  it('keeps what is registered and says when the status is not', () => {
    expect(infobrasObraSummary(work({ physicalProgressPlanned: null, progressPeriod: null }))).toBe('Obra 36233 · En Ejecución · avance 63 %');
    expect(infobrasObraSummary(work({ physicalProgressActual: null }))).toBe('Obra 36233 · En Ejecución · avance — (prog. 80 %, dic 2025)');
    expect(
      infobrasObraSummary(work({ executionStatus: null, physicalProgressActual: null, physicalProgressPlanned: null, progressPeriod: null })),
    ).toBe('Obra 36233 · Estado no informado');
  });
});

describe('infobrasContractLine', () => {
  it('names the contractor with its consortium code or RUC and the valid contract amount', () => {
    expect(
      infobrasContractLine(work({ contractor: { kind: 'consorcio', ruc: 'C0003423283', name: 'CONSORCIO TIERRA BLANCA' }, contractAmount: 301_640 })),
    ).toMatchObject({ text: 'Contratista: CONSORCIO TIERRA BLANCA (código C0003423283) · S/ 301,640', terms: ['contratista'] });
  });

  it('never names a natural person', () => {
    expect(infobrasContractLine(work({ contractor: { kind: 'persona_natural', ruc: null, name: null }, contractAmount: null }))).toMatchObject({
      text: 'Contratista: persona natural',
      terms: ['contratista'],
    });
  });

  it('shows the notice instead of an invalid contract amount', () => {
    expect(infobrasContractLine(work({ contractAmount: 1_250_000_000, contractAmountValid: false }))).toMatchObject({
      text: 'Contratista: CONSTRUCTORA ANDES S.A.C. (demo) (RUC 20301552115) · monto de contrato no válido en la fuente INFOBRAS',
      terms: ['contratista', 'monto-contrato-no-valido'],
    });
    expect(infobrasContractLine(work({ contractor: NO_PARTY, contractAmount: 1_250_000_000, contractAmountValid: false }))).toMatchObject({
      text: 'Monto de contrato no válido en la fuente INFOBRAS',
      terms: ['monto-contrato-no-valido'],
    });
  });

  it('says when no contractor is registered, and is null when nothing is', () => {
    expect(infobrasContractLine(work({ contractor: NO_PARTY, contractAmount: 2_300_000 }))).toMatchObject({
      text: 'Contratista no registrado · S/ 2.3 M',
      terms: [],
    });
    expect(infobrasContractLine(work({ contractor: NO_PARTY, contractAmount: null }))).toBeNull();
  });

  it('adds additional works and deductions', () => {
    expect(infobrasContractLine(work({ contractAmount: 9_800_000, additionalWorksAmount: 640_000, deductionsAmount: 20_000 }))).toMatchObject({
      text: 'Contratista: CONSTRUCTORA ANDES S.A.C. (demo) (RUC 20301552115) · S/ 9.8 M · adicionales S/ 640,000 · deductivos S/ 20,000',
      terms: ['contratista', 'adicional-de-obra', 'deductivo'],
    });
  });
});

describe('infobrasDetailLine', () => {
  it('states supervision and the paralysis reported in INFOBRAS', () => {
    expect(
      infobrasDetailLine(
        work({ hasParalysis: true, paralysisDate: '2024-03-23', paralysisDays: 99, paralysisCause: 'Incumplimiento de contrato' }),
      ),
    ).toMatchObject({
      text: 'Supervisión: CONSORCIO SUPERVISOR (demo) (código C0003136723) · paralización informada desde 23/03/2024 · 99 días · Incumplimiento de contrato',
      terms: ['supervision'],
    });
  });

  it('never names a natural-person supervisor and leaves out an absent paralysis', () => {
    expect(infobrasDetailLine(work({ supervisor: { kind: 'persona_natural', ruc: null, name: null }, hasParalysis: false }))).toMatchObject({
      text: 'Supervisión: persona natural',
      terms: ['supervision'],
    });
  });

  it('adds extensions, reception, liquidation and a modality other than Contrata', () => {
    expect(
      infobrasDetailLine(
        work({ supervisor: NO_PARTY, extensionDays: 1, receptionDate: '2024-12-20', liquidationDate: '2025-06-30', modality: 'Administración directa' }),
      ),
    ).toMatchObject({
      text: 'Ampliaciones de plazo 1 día · recepción 20/12/2024 · liquidación 30/06/2025 · modalidad Administración directa',
      terms: ['ampliacion-de-plazo'],
    });
  });

  it('is null when there is nothing more to say', () => {
    expect(infobrasDetailLine(work({ supervisor: NO_PARTY }))).toBeNull();
    expect(infobrasDetailLine(work({ supervisor: NO_PARTY, hasParalysis: true }))).toMatchObject({ text: 'Paralización informada', terms: [] });
  });
});

describe('infobrasObraRows', () => {
  it('keeps each glossary term only where it first appears', () => {
    const rows = infobrasObraRows([work({ infobrasCode: 1 }), work({ infobrasCode: 2, contractAmountValid: false })]);
    expect(rows.map((row) => row.summary)).toEqual([expect.stringMatching(/^Obra 1 /), expect.stringMatching(/^Obra 2 /)]);
    expect(rows[0].lines.map((line) => line.terms)).toEqual([['contratista'], ['supervision']]);
    expect(rows[1].lines.map((line) => line.terms)).toEqual([['monto-contrato-no-valido'], []]);
  });

  it('splits each line into facts, the term attached to the fact that names it', () => {
    const [row] = infobrasObraRows([work({ contractAmount: 9_800_000, additionalWorksAmount: 640_000 })]);
    expect(row.lines[0].parts).toEqual([
      { text: 'Contratista: CONSTRUCTORA ANDES S.A.C. (demo) (RUC 20301552115)', term: 'contratista' },
      { text: 'S/ 9.8 M' },
      { text: 'adicionales S/ 640,000', term: 'adicional-de-obra' },
    ]);
  });
});

describe('infobrasFigures', () => {
  it('counts the obras, sums the valid contract amounts and gives the real progress range', () => {
    const works = [
      work({ contractAmount: 1_000_000, physicalProgressActual: 31 }),
      work({ contractAmount: 500_000, physicalProgressActual: 60 }),
      work({ contractAmount: 9_000_000_000, contractAmountValid: false, physicalProgressActual: null }),
    ];
    expect(infobrasFigures(works)).toEqual([
      { label: 'Obras', value: '3' },
      { label: 'Monto contratado', value: 'S/ 1.5 M' },
      { label: 'Avance físico real', value: '31–60 %' },
    ]);
  });

  it('uses a dash when no amount or progress is registered, and one value for one obra', () => {
    expect(infobrasFigures([work({ contractAmount: null, physicalProgressActual: null })])).toEqual([
      { label: 'Obras', value: '1' },
      { label: 'Monto contratado', value: '—' },
      { label: 'Avance físico real', value: '—' },
    ]);
    expect(infobrasFigures([work({})])[2]).toEqual({ label: 'Avance físico real', value: '63 %' });
  });
});

describe('infobrasFooter', () => {
  it('dates the data, names the source and says which amounts the total leaves out', () => {
    expect(infobrasFooter([work({})], '2026-03-31')).toEqual([
      'Datos de INFOBRAS al 31/03/2026. El estado puede haber cambiado.',
      'Fuente: Contraloría General de la República – INFOBRAS.',
    ]);
    expect(infobrasFooter([work({ contractAmountValid: false })], null)).toEqual([
      'Monto contratado: 1 monto no válido excluido.',
      'Datos de INFOBRAS. El estado puede haber cambiado.',
      'Fuente: Contraloría General de la República – INFOBRAS.',
    ]);
  });
});

describe('infobrasMoreLabel', () => {
  it('says how many obras are left', () => {
    expect(infobrasMoreLabel(1)).toBe('Ver 1 obra más');
    expect(infobrasMoreLabel(12)).toBe('Ver 12 obras más');
  });
});

describe('infobrasSourceName', () => {
  it('adds the date of the data to the footer source', () => {
    expect(infobrasSourceName('2026-03-31')).toBe('Contraloría – INFOBRAS (datos al 31/03/2026)');
    expect(infobrasSourceName(null)).toBe('Contraloría – INFOBRAS');
  });
});
