import { fireEvent, render, screen } from '@testing-library/react-native';

import { mapInfobrasWorkRow, type InfobrasWork } from '@/features/investments/domain/infobras';

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
  it('shows each obra with its facts, its ficha link and the dated caveat', async () => {
    const onOpenUrl = jest.fn();
    await render(
      <InfobrasBlock
        works={[work(36233, { supervisor: { kind: 'persona_natural', ruc: null, name: null }, extensionDays: 30 })]}
        dataAsOf="2026-03-31"
        onOpenUrl={onOpenUrl}
      />,
    );

    expect(screen.getByRole('header', { name: 'OBRAS EN INFOBRAS' })).toBeOnTheScreen();
    expect(screen.getByText('Obra 36233')).toBeOnTheScreen();
    expect(screen.getByText('CONSTRUCTORA ANDES S.A.C. (demo) · RUC 20100000001')).toBeOnTheScreen();
    expect(screen.getByText('Persona natural')).toBeOnTheScreen();
    expect(screen.getByText('30 días')).toBeOnTheScreen();
    expect(screen.getByText('Datos de INFOBRAS al 31/03/2026. El estado puede haber cambiado.')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('link', { name: 'Ver ficha en INFOBRAS de la obra 36233' }));
    expect(onOpenUrl).toHaveBeenCalledWith('https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Sumario?ObraId=36233');
  });

  it('shows five obras and the rest on "Ver más"', async () => {
    const works = Array.from({ length: 7 }, (_, i) => work(100 + i));
    await render(<InfobrasBlock works={works} dataAsOf={null} onOpenUrl={() => {}} />);

    expect(screen.getByText('Obra 104')).toBeOnTheScreen();
    expect(screen.queryByText('Obra 105')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver más obras (2)' }));
    expect(screen.getByText('Obra 106')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Ver más/ })).toBeNull();
  });

  it('says how many obras the CUI has in INFOBRAS when there are several', async () => {
    await render(<InfobrasBlock works={[work(1), work(2)]} dataAsOf={null} onOpenUrl={() => {}} />);
    expect(screen.getByText('2 obras registradas para este CUI')).toBeOnTheScreen();
  });
});
