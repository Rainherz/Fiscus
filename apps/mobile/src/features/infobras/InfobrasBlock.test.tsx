import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { mapInfobrasWorkRow, type InfobrasWork } from '@/features/investments/domain/infobras';
import { colors } from '@/shared/theme/tokens';

import { InfobrasBlock } from './InfobrasBlock';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));

function work(code: number, overrides: Partial<InfobrasWork> = {}): InfobrasWork {
  return {
    ...mapInfobrasWorkRow({ infobras_code: code, cui: '9900001' }),
    executionStatus: 'En Ejecución',
    contractAmount: 1_500_000,
    contractor: { kind: 'empresa', ruc: '20100000001', name: 'CONSTRUCTORA ANDES S.A.C. (demo)' },
    ...overrides,
  };
}

describe('InfobrasBlock', () => {
  it('shows a neutral panel with key figures, one compact row per obra, its ficha link and the dated footer', async () => {
    const onOpenUrl = jest.fn();
    await render(
      <InfobrasBlock
        works={[
          work(36233, {
            physicalProgressActual: 52,
            physicalProgressPlanned: 100,
            progressPeriod: '2024-06-01',
            supervisor: { kind: 'persona_natural', ruc: null, name: null },
            extensionDays: 30,
          }),
        ]}
        dataAsOf="2026-03-31"
        onOpenUrl={onOpenUrl}
      />,
    );

    expect(screen.getByRole('header', { name: 'OBRAS EN INFOBRAS' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Qué significa INFOBRAS' })).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('infobras').props.style)).toMatchObject({
      backgroundColor: colors.concrete,
      borderLeftColor: colors.signal,
    });
    expect(screen.getByLabelText('Obras: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto contratado: S/ 1.5 M')).toBeOnTheScreen();
    expect(screen.getByLabelText('Avance físico real: 52 %')).toBeOnTheScreen();
    expect(screen.getByText('Obra 36233 · En Ejecución · avance 52 % (prog. 100 %, jun 2024)')).toBeOnTheScreen();
    // Each line is one flowing text; the glossary hints live in the legend, not in the lines.
    expect(screen.getByText('Contratista: CONSTRUCTORA ANDES S.A.C. (demo) (RUC 20100000001) · S/ 1.5 M')).toBeOnTheScreen();
    expect(screen.getByText('Supervisión: persona natural · ampliaciones de plazo 30 días')).toBeOnTheScreen();
    expect(within(screen.getByTestId('infobras-terms')).getByRole('button', { name: /Qué significa Ampliación de plazo/ })).toBeOnTheScreen();
    expect(within(screen.getByTestId('infobras-obra-36233')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('Datos de INFOBRAS al 31/03/2026. El estado puede haber cambiado.')).toBeOnTheScreen();
    expect(screen.getByText('Fuente: Contraloría General de la República – INFOBRAS.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('link', { name: 'Ver ficha en INFOBRAS de la obra 36233' }));
    expect(onOpenUrl).toHaveBeenCalledWith('https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Sumario?ObraId=36233');
  });

  it('keeps the glossary hints of the terms it uses, once each, and draws every obra row alike', async () => {
    await render(
      <InfobrasBlock
        works={[
          work(1, { supervisor: { kind: 'persona_natural', ruc: null, name: null }, additionalWorksAmount: 10_000 }),
          work(2, { contractAmount: 9_000_000_000, contractAmountValid: false, supervisor: { kind: 'persona_natural', ruc: null, name: null } }),
        ]}
        dataAsOf={null}
        onOpenUrl={() => {}}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Qué significa Contratista' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Qué significa Supervisión/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Qué significa Adicional/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Monto de contrato no válido/ })).toBeOnTheScreen();
    // No hint inside any obra row: the first row has the same structure as the others.
    for (const code of [1, 2]) {
      expect(within(screen.getByTestId(`infobras-obra-${code}`)).queryAllByRole('button')).toHaveLength(0);
    }
    expect(screen.getAllByText(/^Supervisión: persona natural$/)).toHaveLength(2);
  });

  it('shows five obras and the rest on "Ver N obras más"', async () => {
    const works = Array.from({ length: 7 }, (_, i) => work(100 + i));
    await render(<InfobrasBlock works={works} dataAsOf={null} onOpenUrl={() => {}} />);

    expect(screen.getByLabelText('Obras: 7')).toBeOnTheScreen();
    expect(screen.getByText(/^Obra 104 /)).toBeOnTheScreen();
    expect(screen.queryByText(/^Obra 105 /)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver 2 obras más' }));
    expect(screen.getByText(/^Obra 106 /)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /obras? más/ })).toBeNull();
  });

  it('shows an invalid contract amount as such, without the figure, and leaves it out of the total', async () => {
    await render(
      <InfobrasBlock
        works={[work(507248, { contractor: { kind: null, ruc: null, name: null }, contractAmount: 113_862_565_000, contractAmountValid: false })]}
        dataAsOf={null}
        onOpenUrl={() => {}}
      />,
    );
    expect(screen.getByText('Monto de contrato no válido en la fuente INFOBRAS')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto contratado: —')).toBeOnTheScreen();
    expect(screen.getByText('Monto contratado: 1 monto no válido excluido.')).toBeOnTheScreen();
    expect(screen.queryByText(/S\/ 11[34]/)).toBeNull();
  });
});
