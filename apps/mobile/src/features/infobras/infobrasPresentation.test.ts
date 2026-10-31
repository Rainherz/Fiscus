import { mapInfobrasWorkRow, type InfobrasWork } from '@/features/investments/domain/infobras';

import {
  contractorKindLabel,
  contractorRowDetail,
  contractorSortValue,
  contractorsNote,
  infobrasCaveat,
  infobrasObraFacts,
  infobrasSourceName,
  partyText,
  visibleInfobrasWorks,
} from './infobrasPresentation';

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

describe('partyText', () => {
  it('names companies and consortia with their RUC or consortium code', () => {
    expect(partyText({ kind: 'empresa', ruc: '20301552115', name: 'A S.A.C.' })).toBe('A S.A.C. · RUC 20301552115');
    expect(partyText({ kind: 'consorcio', ruc: 'C0003136723', name: 'CONSORCIO B' })).toBe('CONSORCIO B · código C0003136723');
    expect(partyText({ kind: 'consorcio', ruc: null, name: 'CONSORCIO C' })).toBe('CONSORCIO C');
  });

  it('never names a natural person', () => {
    expect(partyText({ kind: 'persona_natural', ruc: null, name: null })).toBe('Persona natural');
  });

  it('is null when nothing is registered', () => {
    expect(partyText({ kind: null, ruc: null, name: null })).toBeNull();
  });
});

describe('infobrasObraFacts', () => {
  it('lists the registered facts of an obra in reading order', () => {
    expect(
      infobrasObraFacts(
        work({
          additionalWorksAmount: 159_570,
          deductionsAmount: 710,
          extensionDays: 45,
          hasParalysis: true,
          paralysisCause: 'Incumplimiento de contrato',
          paralysisDate: '2025-12-01',
          paralysisDays: 31,
        }),
      ),
    ).toEqual([
      { label: 'Estado de ejecución', value: 'En Ejecución' },
      { label: 'Avance físico', value: '63 % real · 80 % programado (dic 2025)' },
      { label: 'Contratista', value: 'CONSTRUCTORA ANDES S.A.C. (demo) · RUC 20301552115' },
      { label: 'Monto de contrato', value: 'S/ 3.2 M' },
      { label: 'Supervisión', value: 'CONSORCIO SUPERVISOR (demo) · código C0003136723' },
      { label: 'Adicionales de obra', value: 'S/ 159,570' },
      { label: 'Deductivos', value: 'S/ 710' },
      { label: 'Ampliaciones de plazo', value: '45 días' },
      { label: 'Paralización informada', value: 'Desde 01/12/2025 · 31 días · Incumplimiento de contrato' },
      { label: 'Modalidad', value: 'Contrata' },
    ]);
  });

  it('shows reception and liquidation dates and leaves out what is not registered', () => {
    expect(
      infobrasObraFacts(
        work({
          executionStatus: 'Finalizado',
          physicalProgressActual: null,
          physicalProgressPlanned: null,
          progressPeriod: null,
          contractAmount: null,
          contractor: { kind: 'persona_natural', ruc: null, name: null },
          supervisor: { kind: null, ruc: null, name: null },
          receptionDate: '2013-12-31',
          liquidationDate: '2014-02-10',
          modality: null,
        }),
      ),
    ).toEqual([
      { label: 'Estado de ejecución', value: 'Finalizado' },
      { label: 'Contratista', value: 'Persona natural' },
      { label: 'Recepción', value: '31/12/2013' },
      { label: 'Liquidación', value: '10/02/2014' },
    ]);
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

  it('labels the kinds', () => {
    expect(contractorKindLabel('empresa')).toBe('Empresa');
    expect(contractorKindLabel('consorcio')).toBe('Consorcio');
    expect(contractorKindLabel(null)).toBe('Contratista');
  });

  it('explains the list, its scope and the date of the data', () => {
    expect(contractorsNote('2026-03-31')).toBe(
      'Empresas y consorcios con obras registradas en INFOBRAS; no incluye personas naturales. ' +
        'La región, el nivel y el estado son los del proyecto de cada obra. Datos de INFOBRAS al 31/03/2026.',
    );
  });
});

describe('infobrasSourceName', () => {
  it('adds the date of the data to the footer source', () => {
    expect(infobrasSourceName('2026-03-31')).toBe('Contraloría – INFOBRAS (datos al 31/03/2026)');
    expect(infobrasSourceName(null)).toBe('Contraloría – INFOBRAS');
  });
});
