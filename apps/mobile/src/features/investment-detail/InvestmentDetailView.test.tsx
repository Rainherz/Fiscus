import { render, screen } from '@testing-library/react-native';

import type { Investment } from '@/features/investments/domain/investment';
import { NOW, majes } from '@/test/fixtures';

import { InvestmentDetailView } from './InvestmentDetailView';

const full: Investment = {
  ...majes,
  entity: 'GOBIERNO REGIONAL AREQUIPA',
  functionalDivision: 'RIEGO',
  functionalGroup: 'INFRAESTRUCTURA DE RIEGO',
  situation: 'VIABLE',
  beneficiaries: 38_500,
  registeredAt: '2007-11-20',
  firstAccrualMonth: '2009-03-01',
  lastAccrualMonth: '2026-09-01',
  sourceUpdatedAt: '2026-10-25T15:00:00Z',
};

describe('InvestmentDetailView', () => {
  it('shows identity and the cost story', async () => {
    await render(<InvestmentDetailView investment={full} now={NOW} />);
    expect(screen.getByText('Majes Siguas II etapa')).toBeOnTheScreen();
    expect(screen.getByText('CUI 2088142')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto viable: S/ 1,338 M')).toBeOnTheScreen();
    expect(screen.getByLabelText('Costo actualizado: S/ 5,148 M')).toBeOnTheScreen();
    expect(screen.getByText('+S/ 3,809 M · +285%')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveAccessibleName(
      'Avance de ejecución: 18 por ciento',
    );
  });

  it('strikes through the approved amount when the cost went up', async () => {
    await render(<InvestmentDetailView investment={full} now={NOW} />);
    expect(screen.getByTestId('viable-amount')).toHaveStyle({ textDecorationLine: 'line-through' });
  });

  it('does not strike through when there is no increase', async () => {
    await render(
      <InvestmentDetailView investment={{ ...full, costIncrease: -5, costIncreasePct: -1 }} now={NOW} />,
    );
    expect(screen.getByTestId('viable-amount')).not.toHaveStyle({
      textDecorationLine: 'line-through',
    });
  });

  it('lists the key facts', async () => {
    await render(<InvestmentDetailView investment={full} now={NOW} />);
    const facts: [string, string][] = [
      ['Entidad', 'GOBIERNO REGIONAL AREQUIPA'],
      ['Función', 'AGRARIA'],
      ['División funcional', 'RIEGO'],
      ['Grupo funcional', 'INFRAESTRUCTURA DE RIEGO'],
      ['Estado', 'ACTIVO'],
      ['Situación', 'VIABLE'],
      ['Fecha de registro', '20/11/2007'],
      ['Fecha de viabilidad', '10/01/2008'],
      ['Primer devengado', 'marzo 2009'],
      ['Último devengado', 'septiembre 2026'],
      ['Tiempo desde la viabilidad', '18 años'],
      ['Devengado acumulado', 'S/ 927 M'],
      ['Beneficiarios', '38,500'],
    ];
    for (const [label, value] of facts) {
      expect(screen.getByLabelText(`${label}: ${value}`)).toBeOnTheScreen();
    }
  });

  it('cites the source and its update date', async () => {
    await render(<InvestmentDetailView investment={full} now={NOW} />);
    expect(
      screen.getByText('Fuente: MEF – Sistema de Seguimiento de Inversiones. Actualizado el 25/10/2026.'),
    ).toBeOnTheScreen();
  });

  it('shows a dash for missing values', async () => {
    await render(<InvestmentDetailView investment={{ ...full, beneficiaries: null }} now={NOW} />);
    expect(screen.getByLabelText('Beneficiarios: —')).toBeOnTheScreen();
  });
});
