import { fireEvent, render, screen } from '@testing-library/react-native';

import { StyleSheet } from 'react-native';

import type { ParalyzedDetail, ParalyzedWork } from '@/features/investments/domain/paralyzed';
import { colors } from '@/shared/theme/tokens';

import { ParalyzedBlock } from './ParalyzedBlock';
import { PARALYZED_TITLE } from './paralyzedPresentation';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));

const NOW = new Date('2026-10-30T15:00:00Z');

const work = (overrides: Partial<ParalyzedWork>): ParalyzedWork => ({
  infobrasCode: 45282,
  cui: '2151761',
  editionCutoff: '2026-06-30',
  publishedAt: '2026-08-17',
  obraDescription: 'Agua y saneamiento en Muñapata',
  causalCode: 2,
  causalLabel: 'INCUMPLIMIENTO DE CONTRATO',
  physicalProgress: 31,
  remainingWorkBalance: 800_000,
  mefReportUrl: null,
  ...overrides,
});

const single: ParalyzedDetail = {
  summary: {
    cui: '2151761',
    editionCutoff: '2026-06-30',
    publishedAt: '2026-08-17',
    obraCount: 1,
    mainCausalLabel: 'INCUMPLIMIENTO DE CONTRATO',
    minPhysicalProgress: 31,
    maxPhysicalProgress: 31,
    totalRemainingWorkBalance: 800_000,
    infobrasCodes: [45282],
  },
  works: [work({ mefReportUrl: 'https://ofi5.mef.gob.pe/invierte/general/downloadArchivo?idArchivo=x.pdf' })],
};

describe('ParalyzedBlock', () => {
  it('states the official facts with their source and edition', async () => {
    await render(<ParalyzedBlock detail={single} now={NOW} onOpenUrl={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'PARALIZADA SEGÚN LA CONTRALORÍA' })).toBeOnTheScreen();
    expect(screen.getByText('Causal: Incumplimiento de contrato')).toBeOnTheScreen();
    expect(screen.getByLabelText('Avance físico: 31 %')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saldo de obra: S/ 800,000')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Obras:/)).toBeNull();
    expect(screen.getByText('Corte: junio 2026 (hace 4 meses) · publicado 17/08/2026')).toBeOnTheScreen();
    expect(screen.getByText('Fuente: Contraloría General de la República.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Qué significa Obra paralizada (Contraloría)' })).toBeOnTheScreen();
  });

  it('keeps the alert look: ink ground, signal edge and signal title', async () => {
    await render(<ParalyzedBlock detail={single} now={NOW} onOpenUrl={jest.fn()} />);
    expect(StyleSheet.flatten(screen.getByTestId('paralyzed').props.style)).toMatchObject({
      backgroundColor: colors.ink,
      borderLeftWidth: 6,
      borderLeftColor: colors.signal,
    });
    expect(StyleSheet.flatten(screen.getByText(PARALYZED_TITLE).props.style).color).toBe(colors.signal);
    expect(StyleSheet.flatten(screen.getByText('Ver ficha en INFOBRAS →').props.style).color).toBe(colors.signal);
  });

  it('opens the INFOBRAS ficha and the MEF situational report', async () => {
    const onOpenUrl = jest.fn();
    await render(<ParalyzedBlock detail={single} now={NOW} onOpenUrl={onOpenUrl} />);

    await fireEvent.press(screen.getByRole('link', { name: 'Ver ficha en INFOBRAS' }));
    expect(onOpenUrl).toHaveBeenLastCalledWith('https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Sumario?ObraId=45282');
    await fireEvent.press(screen.getByRole('link', { name: 'Informe situacional del MEF' }));
    expect(onOpenUrl).toHaveBeenLastCalledWith('https://ofi5.mef.gob.pe/invierte/general/downloadArchivo?idArchivo=x.pdf');
  });

  it('lists every obra of a CUI with several, each with its own link', async () => {
    const onOpenUrl = jest.fn();
    const several: ParalyzedDetail = {
      summary: { ...single.summary, obraCount: 2, maxPhysicalProgress: 60, totalRemainingWorkBalance: 2_000_000, infobrasCodes: [45282, 45283] },
      works: [
        work({ infobrasCode: 45283, causalLabel: 'FALTA DE RECURSOS FINANCIEROS Y LIQUIDEZ', physicalProgress: 60, remainingWorkBalance: 1_200_000 }),
        work({}),
      ],
    };
    await render(<ParalyzedBlock detail={several} now={NOW} onOpenUrl={onOpenUrl} />);

    expect(screen.getByLabelText('Obras: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Avance físico: 31–60 %')).toBeOnTheScreen();
    expect(screen.getByText('Obra 45283 · Falta de recursos financieros y liquidez · avance 60 % · saldo S/ 1.2 M')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Ver ficha en INFOBRAS de la obra 45283' }));
    expect(onOpenUrl).toHaveBeenLastCalledWith('https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Sumario?ObraId=45283');
    expect(screen.queryByRole('link', { name: /Informe situacional/ })).toBeNull();
  });
});
