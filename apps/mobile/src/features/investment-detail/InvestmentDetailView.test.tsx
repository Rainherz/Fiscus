import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

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
      'Gastado: 18 por ciento del costo actualizado',
    );
    expect(screen.getByText('GASTADO 18 % DEL COSTO')).toBeOnTheScreen();
  });

  it('states how much spending exceeds the updated cost', async () => {
    await render(
      <InvestmentDetailView
        investment={{ ...full, updatedCost: 1_432_976_292.23, accruedTotal: 1_459_731_800.72, executionProgress: 1.0187 }}
        now={NOW}
      />,
    );
    expect(screen.getByText('GASTADO 102 % DEL COSTO')).toBeOnTheScreen();
    expect(screen.getByText('Gastó S/ 26.8 M más que su costo actualizado')).toBeOnTheScreen();
  });

  it('flags spending above 10 times the updated cost as unusual source data', async () => {
    await render(
      <InvestmentDetailView
        investment={{
          ...full,
          viableAmount: 299_700,
          updatedCost: 299_700,
          accruedTotal: 18_768_455.33,
          costIncrease: 0,
          costIncreasePct: 0,
          executionProgress: 62.624,
          spentAnomaly: true,
        }}
        now={NOW}
      />,
    );
    expect(
      screen.getByText('Dato inusual en la fuente MEF: lo gastado supera 10 veces el costo actualizado.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Gastó S/ 18.5 M más que su costo actualizado')).toBeOnTheScreen();
  });

  it('does not flag ordinary spending as unusual', async () => {
    await render(<InvestmentDetailView investment={full} now={NOW} />);
    expect(screen.queryByText(/Dato inusual/)).toBeNull();
  });

  it('replaces the metrics with a notice when the source cost is a placeholder', async () => {
    await render(
      <InvestmentDetailView
        investment={{
          ...full,
          updatedCost: 10,
          updatedCostValid: false,
          costIncrease: null,
          costIncreasePct: null,
          executionProgress: null,
        }}
        now={NOW}
      />,
    );
    expect(screen.getByText('Costo actualizado no válido en la fuente MEF')).toBeOnTheScreen();
    expect(
      screen.getByText('El MEF publica S/ 10 como costo actualizado. No se calculan el aumento ni el porcentaje gastado.'),
    ).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Costo actualizado:/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/GASTADO/)).toBeNull();
    expect(screen.queryByText(/AUMENTO/)).toBeNull();
    expect(screen.getByTestId('viable-amount')).not.toHaveStyle({ textDecorationLine: 'line-through' });
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
      screen.getByText(
        'Fuente: MEF – Sistema de Seguimiento de Inversiones. Último cambio en los datos del MEF: 25/10/2026.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Actualizado el/)).toBeNull();
  });

  it('cites the open data for projects only the open-data file has', async () => {
    await render(<InvestmentDetailView investment={{ ...full, dataSource: 'open_data' }} now={NOW} />);
    expect(
      screen.getByText(
        'Fuente: MEF – Datos Abiertos, Detalle de inversiones. Último cambio en los datos del MEF: 25/10/2026.',
      ),
    ).toBeOnTheScreen();
  });

  it('shows a dash for missing values', async () => {
    await render(<InvestmentDetailView investment={{ ...full, beneficiaries: null }} now={NOW} />);
    expect(screen.getByLabelText('Beneficiarios: —')).toBeOnTheScreen();
  });

  it('renders the cost history it is given', async () => {
    await render(<InvestmentDetailView investment={full} now={NOW} costHistory={<Text>historial</Text>} />);
    expect(screen.getByText('historial')).toBeOnTheScreen();
  });

  describe('share action', () => {
    it('offers sharing the project as an image', async () => {
      const onShare = jest.fn();
      await render(<InvestmentDetailView investment={full} now={NOW} onShare={onShare} />);
      const button = screen.getByRole('button', { name: 'Compartir este proyecto como imagen' });
      expect(button).toHaveTextContent('COMPARTIR');
      expect(button).toHaveStyle({ minHeight: 44 });
      await fireEvent.press(button);
      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it('is absent when sharing is not wired', async () => {
      await render(<InvestmentDetailView investment={full} now={NOW} />);
      expect(screen.queryByRole('button', { name: 'Compartir este proyecto como imagen' })).toBeNull();
    });
  });

  describe('map link', () => {
    const located: Investment = { ...full, coordinates: { latitude: -16.35, longitude: -72.15 } };

    it('opens the map on a project with coordinates', async () => {
      const onOpenMap = jest.fn();
      await render(<InvestmentDetailView investment={located} now={NOW} onOpenMap={onOpenMap} />);
      const link = screen.getByRole('link', { name: 'Ver en el mapa' });
      expect(link).toHaveStyle({ minHeight: 44 });
      await fireEvent.press(link);
      expect(onOpenMap).toHaveBeenCalledTimes(1);
    });

    it('is absent without coordinates', async () => {
      await render(<InvestmentDetailView investment={{ ...full, coordinates: null }} now={NOW} onOpenMap={jest.fn()} />);
      expect(screen.queryByRole('link', { name: 'Ver en el mapa' })).toBeNull();
    });
  });

  describe('without recent spending', () => {
    const stalled: Investment = { ...full, status: 'ACTIVO', executionProgress: 0.32, lastAccrualMonth: '2025-04-01' };
    const SENTENCE = 'Sin gasto registrado desde abr 2025 (18 meses).';

    it('states since when there is no recorded spending when the project meets the rule', async () => {
      await render(<InvestmentDetailView investment={stalled} now={NOW} referenceMonth="2026-10-01" />);
      expect(screen.getByText(SENTENCE)).toBeOnTheScreen();
    });

    it('says nothing when the project has recent spending or the reference month is unknown', async () => {
      const { rerender } = await render(
        <InvestmentDetailView investment={{ ...stalled, lastAccrualMonth: '2025-10-01' }} now={NOW} referenceMonth="2026-10-01" />,
      );
      expect(screen.queryByText(/^Sin gasto registrado/)).toBeNull();
      await rerender(<InvestmentDetailView investment={stalled} now={NOW} referenceMonth={null} />);
      expect(screen.queryByText(/^Sin gasto registrado/)).toBeNull();
      await rerender(<InvestmentDetailView investment={stalled} now={NOW} />);
      expect(screen.queryByText(/^Sin gasto registrado/)).toBeNull();
    });
  });

  describe('levels, location and physical progress', () => {
    const local: Investment = {
      ...full,
      governmentLevel: 'GL',
      entity: 'MUNICIPALIDAD DISTRITAL DE CAYMA',
      executingUnit: 'MUNICIPALIDAD DISTRITAL DE CAYMA',
      province: 'AREQUIPA',
      district: 'CAYMA',
      physicalProgress: 42,
      dataSource: 'open_data',
    };

    it('tags the level and lists entity, executing unit, province and district', async () => {
      await render(<InvestmentDetailView investment={local} now={NOW} />);
      expect(screen.getByLabelText('Gobierno local')).toBeOnTheScreen();
      for (const [label, value] of [
        ['Nivel de gobierno', 'Gobierno local'],
        ['Entidad', 'MUNICIPALIDAD DISTRITAL DE CAYMA'],
        ['Unidad ejecutora', 'MUNICIPALIDAD DISTRITAL DE CAYMA'],
        ['Región', 'AREQUIPA'],
        ['Provincia', 'AREQUIPA'],
        ['Distrito', 'CAYMA'],
      ]) {
        expect(screen.getByLabelText(`${label}: ${value}`)).toBeOnTheScreen();
      }
    });

    it('shows physical progress apart from the share of the cost spent', async () => {
      await render(<InvestmentDetailView investment={local} now={NOW} />);
      expect(screen.getByText('AVANCE FÍSICO 42 %')).toBeOnTheScreen();
      expect(screen.getByText('GASTADO 18 % DEL COSTO')).toBeOnTheScreen();
      expect(screen.getByRole('progressbar', { name: 'Avance físico: 42 por ciento, reportado al MEF' })).toBeOnTheScreen();
      expect(screen.getByText('Avance de la obra reportado al MEF. No es lo gastado.')).toBeOnTheScreen();
    });

    it('leaves out physical progress, executing unit and location when the source has none', async () => {
      await render(<InvestmentDetailView investment={full} now={NOW} />);
      expect(screen.queryByText(/AVANCE FÍSICO/)).toBeNull();
      expect(screen.queryByLabelText(/^Unidad ejecutora/)).toBeNull();
      expect(screen.queryByLabelText(/^Provincia/)).toBeNull();
      expect(screen.queryByLabelText(/^Distrito/)).toBeNull();
    });

    it('says "Varias regiones" for a national project without department', async () => {
      await render(
        <InvestmentDetailView
          investment={{ ...local, governmentLevel: 'GN', departmentCode: null, departmentName: null, province: null, district: null }}
          now={NOW}
        />,
      );
      expect(screen.getByLabelText('Región: Varias regiones')).toBeOnTheScreen();
      expect(screen.getByLabelText('Nivel de gobierno: Gobierno nacional')).toBeOnTheScreen();
    });
  });
});
