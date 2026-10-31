import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ContractorSummary, ContractorWork } from '@/features/investments/domain/infobras';

import { ContractorView } from './ContractorView';
import { parseContractorRuc } from './contractorRoute';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));

const SUMMARY: ContractorSummary = {
  ruc: '20100000001',
  name: 'CONSTRUCTORA ANDES S.A.C. (demo)',
  kind: 'empresa',
  obraCount: 3,
  totalContractAmount: 48_000_000,
  totalAdditionalWorks: 2_500_000,
  contraloriaParalyzedCount: 1,
  finishedCount: 1,
  inProgressCount: 1,
  notStartedCount: 0,
  infobrasParalyzedCount: 1,
  invalidContractCount: 0,
  dataAsOf: '2026-03-31',
};

const work = (overrides: Partial<ContractorWork>): ContractorWork => ({
  infobrasCode: 1,
  cui: '9900001',
  executionStatus: 'En Ejecución',
  contractAmount: 30_000_000,
  contractAmountValid: true,
  additionalWorksAmount: null,
  physicalProgressActual: 40,
  investmentName: 'Planta de tratamiento (demo)',
  entity: 'MUNICIPALIDAD PROVINCIAL DE AREQUIPA',
  departmentCode: 4,
  governmentLevel: 'GL',
  investmentStatus: 'ACTIVO',
  contraloriaParalyzed: false,
  ...overrides,
});

const baseProps = {
  status: 'success' as const,
  isFetchingMore: false,
  onEndReached: jest.fn(),
  onRetry: jest.fn(),
  onPressInvestment: jest.fn(),
  onOpenUrl: jest.fn(),
};

describe('parseContractorRuc', () => {
  it('accepts a company RUC or a consortium code only', () => {
    expect(parseContractorRuc('20100000001')).toBe('20100000001');
    expect(parseContractorRuc('C0003136723')).toBe('C0003136723');
    expect(parseContractorRuc('10412345678')).toBeNull();
    expect(parseContractorRuc(undefined)).toBeNull();
    expect(parseContractorRuc('x')).toBeNull();
  });
});

describe('ContractorView', () => {
  it('shows the contractor, its national totals and the dated caveat', async () => {
    await render(<ContractorView {...baseProps} summary={SUMMARY} works={[]} />);
    expect(screen.getByRole('header', { name: 'CONSTRUCTORA ANDES S.A.C. (demo)' })).toBeOnTheScreen();
    expect(screen.getByText('Empresa · RUC 20100000001')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto contratado: S/ 48 M')).toBeOnTheScreen();
    expect(screen.getByLabelText('Adicionales de obra: S/ 2.5 M')).toBeOnTheScreen();
    expect(screen.getByLabelText('Obras en el informe de obras paralizadas: 1')).toBeOnTheScreen();
    expect(screen.getByText('Según INFOBRAS: 1 finalizada · 1 en ejecución · 1 paralizada')).toBeOnTheScreen();
    expect(screen.getByText('Totales de todo el país. Datos de INFOBRAS al 31/03/2026. El estado puede haber cambiado.')).toBeOnTheScreen();
  });

  it('lists the obras and opens the project, or the INFOBRAS ficha when Fiscus lacks the CUI', async () => {
    const onPressInvestment = jest.fn();
    const onOpenUrl = jest.fn();
    await render(
      <ContractorView
        {...baseProps}
        onPressInvestment={onPressInvestment}
        onOpenUrl={onOpenUrl}
        summary={SUMMARY}
        works={[
          work({ contraloriaParalyzed: true }),
          work({ infobrasCode: 2, cui: null, investmentName: null, entity: null, governmentLevel: null, investmentStatus: null }),
        ]}
      />,
    );

    await fireEvent.press(
      screen.getByRole('button', {
        name:
          '1. Planta de tratamiento (demo), Gobierno local, CUI 9900001 · MUNICIPALIDAD PROVINCIAL DE AREQUIPA, ' +
          'En Ejecución · contrato S/ 30 M · en el informe de obras paralizadas',
      }),
    );
    expect(onPressInvestment).toHaveBeenCalledWith('9900001');

    await fireEvent.press(screen.getByRole('button', { name: /^2\. Obra 2 en INFOBRAS, Sin CUI en Fiscus/ }));
    expect(onOpenUrl).toHaveBeenCalledWith('https://infobras.contraloria.gob.pe/InfobrasWeb/Mapa/Sumario?ObraId=2');
  });

  it('says how many invalid contract amounts the total leaves out, and marks them in the list', async () => {
    await render(
      <ContractorView
        {...baseProps}
        summary={{ ...SUMMARY, invalidContractCount: 3 }}
        works={[work({ infobrasCode: 507248, contractAmount: 113_862_565_000, contractAmountValid: false })]}
      />,
    );
    expect(screen.getByText('3 montos no válidos excluidos')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Monto de contrato no válido/ })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /En Ejecución · monto de contrato no válido en la fuente INFOBRAS$/ }),
    ).toBeOnTheScreen();
  });

  it('shows no exclusion note when every amount is valid', async () => {
    await render(<ContractorView {...baseProps} summary={SUMMARY} works={[]} />);
    expect(screen.queryByText(/no válidos? excluidos?/)).toBeNull();
  });

  it('says when the contractor is unknown', async () => {
    await render(<ContractorView {...baseProps} summary={null} works={[]} />);
    expect(screen.getByText('No hay datos de este contratista en INFOBRAS.')).toBeOnTheScreen();
  });
});
