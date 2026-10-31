import {
  infobrasUrl,
  mapParalyzedInvestmentRow,
  mapParalyzedSummaryRow,
  mapParalyzedWorkRow,
  summarizeParalyzedWorks,
  type ParalyzedWork,
} from './paralyzed';
import { buildParalyzedQuery } from './queries';

const work = (overrides: Partial<ParalyzedWork>): ParalyzedWork => ({
  infobrasCode: 1,
  cui: '2151761',
  editionCutoff: '2026-06-30',
  publishedAt: '2026-08-17',
  obraDescription: 'Obra',
  causalCode: 2,
  causalLabel: 'INCUMPLIMIENTO DE CONTRATO',
  physicalProgress: 31,
  remainingWorkBalance: 800_000,
  mefReportUrl: null,
  ...overrides,
});

describe('infobrasUrl', () => {
  it('links to the public INFOBRAS ficha of the obra', () => {
    expect(infobrasUrl(45282)).toBe('https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Sumario?ObraId=45282');
  });
});

describe('mappers', () => {
  it('maps a latest_paralyzed_works row, keeping only http(s) report links', () => {
    expect(
      mapParalyzedWorkRow({
        infobras_code: 45282,
        cui: '2151761',
        edition_cutoff: '2026-06-30',
        published_at: '2026-08-17',
        obra_description: 'Agua Muñapata',
        causal_code: 2,
        causal_label: 'INCUMPLIMIENTO DE CONTRATO',
        physical_progress: '31.5',
        remaining_work_balance: '800000.25',
        mef_report_url: 'https://ofi5.mef.gob.pe/x.pdf',
      }),
    ).toEqual({
      infobrasCode: 45282,
      cui: '2151761',
      editionCutoff: '2026-06-30',
      publishedAt: '2026-08-17',
      obraDescription: 'Agua Muñapata',
      causalCode: 2,
      causalLabel: 'INCUMPLIMIENTO DE CONTRATO',
      physicalProgress: 31.5,
      remainingWorkBalance: 800000.25,
      mefReportUrl: 'https://ofi5.mef.gob.pe/x.pdf',
    });
    expect(mapParalyzedWorkRow({ infobras_code: 1, mef_report_url: 'javascript:alert(1)' }).mefReportUrl).toBeNull();
  });

  it('maps a paralyzed_by_cui row', () => {
    expect(
      mapParalyzedSummaryRow({
        cui: '2151761',
        edition_cutoff: '2026-06-30',
        published_at: '2026-08-17',
        obra_count: 2,
        main_causal_label: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ',
        min_physical_progress: 31,
        max_physical_progress: '60',
        total_remaining_work_balance: '2000000',
        infobras_codes: [45282, 45283],
      }),
    ).toEqual({
      cui: '2151761',
      editionCutoff: '2026-06-30',
      publishedAt: '2026-08-17',
      obraCount: 2,
      mainCausalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ',
      minPhysicalProgress: 31,
      maxPhysicalProgress: 60,
      totalRemainingWorkBalance: 2_000_000,
      infobrasCodes: [45282, 45283],
    });
  });

  it('maps a paralyzed_investments row with its investment', () => {
    expect(
      mapParalyzedInvestmentRow({
        cui: '2151761',
        edition_cutoff: '2026-06-30',
        published_at: '2026-08-17',
        obra_count: 1,
        main_causal_label: 'ABANDONO DE OBRA',
        min_physical_progress: 5,
        max_physical_progress: 5,
        total_remaining_work_balance: 10,
        infobras_codes: [81],
        name: 'Agua',
        entity: 'MUNICIPALIDAD',
        department_code: 8,
        government_level: 'GL',
        status: 'ACTIVO',
      }),
    ).toMatchObject({ name: 'Agua', entity: 'MUNICIPALIDAD', departmentCode: 8, governmentLevel: 'GL', status: 'ACTIVO', obraCount: 1 });
  });
});

describe('summarizeParalyzedWorks', () => {
  it('aggregates the obras of one CUI like the paralyzed_by_cui view', () => {
    const summary = summarizeParalyzedWorks([
      work({ infobrasCode: 45283, causalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ', physicalProgress: 60, remainingWorkBalance: 1_200_000 }),
      work({ infobrasCode: 45282 }),
    ]);
    expect(summary).toEqual({
      cui: '2151761',
      editionCutoff: '2026-06-30',
      publishedAt: '2026-08-17',
      obraCount: 2,
      mainCausalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ',
      minPhysicalProgress: 31,
      maxPhysicalProgress: 60,
      totalRemainingWorkBalance: 2_000_000,
      infobrasCodes: [45282, 45283],
    });
  });

  it('is null without obras or without a CUI', () => {
    expect(summarizeParalyzedWorks([])).toBeNull();
    expect(summarizeParalyzedWorks([work({ cui: null })])).toBeNull();
  });
});

describe('buildParalyzedQuery', () => {
  it('ranks by remaining balance within the scope, level and status', () => {
    expect(buildParalyzedQuery({ departmentCode: 8, level: 'GL', status: 'ACTIVE', page: 1, pageSize: 10 })).toEqual({
      filters: [
        { column: 'department_code', op: 'eq', value: 8 },
        { column: 'government_level', op: 'eq', value: 'GL' },
        { column: 'status', op: 'eq', value: 'ACTIVO' },
      ],
      order: [
        { column: 'total_remaining_work_balance', ascending: false },
        { column: 'cui', ascending: true },
      ],
      range: { from: 10, to: 19 },
    });
    expect(buildParalyzedQuery({ level: 'ALL', status: 'ALL', page: 0 }).filters).toEqual([]);
  });
});
