import type { ParalyzedInvestment, ParalyzedSummary } from '@/features/investments/domain/paralyzed';

import {
  editionAgeMonths,
  paralyzedCausal,
  paralyzedCountText,
  paralyzedEditionLine,
  paralyzedProgressText,
  paralyzedRowDetail,
  paralyzedSourceName,
} from './paralyzedPresentation';

const NOW = new Date('2026-10-30T15:00:00Z');

const summary: ParalyzedSummary = {
  cui: '2151761',
  editionCutoff: '2026-06-30',
  publishedAt: '2026-08-17',
  obraCount: 1,
  mainCausalLabel: 'INCUMPLIMIENTO DE CONTRATO',
  minPhysicalProgress: 31.4,
  maxPhysicalProgress: 31.4,
  totalRemainingWorkBalance: 2_000_000,
  infobrasCodes: [45282],
};

const item: ParalyzedInvestment = {
  ...summary,
  name: 'Agua Muñapata',
  entity: 'MUNICIPALIDAD PROVINCIAL DE QUISPICANCHI',
  departmentCode: 8,
  governmentLevel: 'GL',
  status: 'ACTIVO',
};

describe('paralyzedEditionLine', () => {
  it('states the cut-off, its age and the publication date', () => {
    expect(paralyzedEditionLine({ editionCutoff: '2026-06-30', publishedAt: '2026-08-17' }, NOW)).toBe(
      'Corte: junio 2026 (hace 4 meses) · publicado 17/08/2026',
    );
  });

  it('leaves out what is unknown', () => {
    expect(paralyzedEditionLine({ editionCutoff: '2026-06-30', publishedAt: null })).toBe('Corte: junio 2026');
    expect(paralyzedEditionLine({ editionCutoff: '2026-10-31', publishedAt: null }, NOW)).toBe('Corte: octubre 2026');
  });
});

describe('editionAgeMonths', () => {
  it('counts whole calendar months from the cut-off month', () => {
    expect(editionAgeMonths('2026-06-30', NOW)).toBe(4);
    expect(editionAgeMonths('2026-09-30', NOW)).toBe(1);
    expect(editionAgeMonths('nope', NOW)).toBeNull();
  });
});

describe('paralyzedCausal', () => {
  it('reads the causal in sentence case', () => {
    expect(paralyzedCausal('FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ')).toBe('Falta de recursos financieros y liquidez');
    expect(paralyzedCausal('EVENTOS CLIMÁTICOS')).toBe('Eventos climáticos');
    expect(paralyzedCausal(null)).toBe('Causal no informada');
  });
});

describe('paralyzedProgressText', () => {
  it('shows one value, or the range of several obras', () => {
    expect(paralyzedProgressText(summary)).toBe('31 %');
    expect(paralyzedProgressText({ ...summary, maxPhysicalProgress: 60 })).toBe('31–60 %');
    expect(paralyzedProgressText({ ...summary, minPhysicalProgress: null, maxPhysicalProgress: null })).toBe('—');
  });
});

describe('paralyzedRowDetail', () => {
  it('shows the causal, the physical progress and the remaining balance', () => {
    expect(paralyzedRowDetail(item)).toEqual(['Incumplimiento de contrato', 'Avance físico 31 % · S/ 2.0 M saldo de obra']);
  });

  it('leads with the region nationwide and counts several obras', () => {
    expect(paralyzedRowDetail({ ...item, obraCount: 3 }, { national: true })).toEqual([
      'Cusco · Incumplimiento de contrato',
      'Avance físico 31 % · S/ 2.0 M saldo de obra · 3 obras',
    ]);
  });
});

describe('paralyzedCountText', () => {
  it('counts projects in the scope', () => {
    expect(paralyzedCountText(1)).toBe('1 proyecto en la región');
    expect(paralyzedCountText(1234, { national: true })).toBe('1,234 proyectos en el país');
  });
});

describe('paralyzedSourceName', () => {
  it('names the source with the cut-off when known', () => {
    expect(paralyzedSourceName('2026-06-30')).toBe('Contraloría – Informe de obras paralizadas (corte junio 2026)');
    expect(paralyzedSourceName(null)).toBe('Contraloría – Informe de obras paralizadas');
  });
});
