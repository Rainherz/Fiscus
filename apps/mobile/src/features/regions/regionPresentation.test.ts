import type { RegionComparison } from '../investments/domain/regionComparison';
import {
  ALPHABETICAL_DEPARTMENTS,
  REGION_SORT_OPTIONS,
  departmentsWithoutData,
  isRegionSort,
  regionDetail,
  regionName,
  regionNote,
  regionSummary,
  regionValue,
} from './regionPresentation';

const arequipa: RegionComparison = {
  departmentCode: 4,
  departmentName: 'AREQUIPA',
  projectCount: 1638,
  activeCount: 1200,
  validCostCount: 1500,
  totalViableAmount: 13_380_000_000,
  totalUpdatedCost: 17_190_000_000,
  totalCostIncrease: 3_809_492_486,
  projectsWithIncrease: 412,
  costIncreasePct: 28.47,
  overspentCount: 8,
  stalledCount: 12,
  stalledPendingAmount: 202_400_000,
};

describe('region presentation', () => {
  it('labels the four sorts in Spanish', () => {
    expect(REGION_SORT_OPTIONS.map((o) => o.label)).toEqual([
      'Mayor aumento (S/)',
      'Mayor aumento (%)',
      'Más obras sin gasto reciente',
      'Más gasto sobre el costo',
    ]);
    expect(REGION_SORT_OPTIONS.map((o) => o.key)).toEqual(['increase-amount', 'increase-pct', 'stalled', 'overspent']);
  });

  it('recognizes sort names from the route', () => {
    expect(isRegionSort('overspent')).toBe(true);
    expect(isRegionSort('cost')).toBe(false);
    expect(isRegionSort(undefined)).toBe(false);
  });

  it('names the department with its accented name', () => {
    expect(regionName(arequipa)).toBe('Arequipa');
    expect(regionName({ ...arequipa, departmentCode: 2 })).toBe('Áncash');
  });

  it('shows the figure of the selected sort', () => {
    expect(regionValue('increase-amount', arequipa)).toBe('+S/ 3,809 M');
    expect(regionValue('increase-pct', arequipa)).toBe('+28%');
    expect(regionValue('stalled', arequipa)).toBe('12');
    expect(regionValue('overspent', arequipa)).toBe('8');
  });

  it('shows no sign without increases and a dash without a percentage', () => {
    const none = { ...arequipa, totalCostIncrease: 0, projectsWithIncrease: 0, costIncreasePct: null };
    expect(regionValue('increase-amount', none)).toBe('S/ 0');
    expect(regionValue('increase-pct', none)).toBe('—');
  });

  it('adds the other context in a second line', () => {
    expect(regionDetail('increase-amount', arequipa)).toBe('1,638 proyectos · 412 con aumento');
    expect(regionDetail('increase-pct', arequipa)).toBe('412 con aumento · +S/ 3,809 M');
    expect(regionDetail('stalled', arequipa)).toBe('1,638 proyectos · S/ 202 M por ejecutar');
    expect(regionDetail('overspent', arequipa)).toBe('1,638 proyectos · 12 sin gasto reciente');
  });

  it('uses singular forms for one project', () => {
    const one = { ...arequipa, projectCount: 1, projectsWithIncrease: 1, stalledCount: 1 };
    expect(regionDetail('increase-amount', one)).toBe('1 proyecto · 1 con aumento');
    expect(regionDetail('overspent', one)).toBe('1 proyecto · 1 sin gasto reciente');
  });

  it('describes the figure for screen readers', () => {
    expect(regionSummary('increase-amount', arequipa)).toBe('+S/ 3,809 M');
    expect(regionSummary('stalled', arequipa)).toBe('12 sin gasto reciente');
    expect(regionSummary('overspent', arequipa)).toBe('8 con gasto sobre el costo');
  });

  it('explains each sort and the scope of the data', () => {
    expect(regionNote('increase-amount')).toBe('Suma de los aumentos de costo. No descuenta las reducciones.');
    expect(regionNote('increase-pct')).toBe('Aumentos sumados sobre el monto viable de los proyectos que aumentaron.');
    expect(regionNote('stalled')).toMatch(/^Proyectos activos que gastaron entre 5 % y 95 %/);
    expect(regionNote('overspent')).toBe('Proyectos cuyo gasto acumulado supera su costo actualizado.');
  });
});

describe('region picker lists', () => {
  it('lists every department alphabetically for the fallback list', () => {
    expect(ALPHABETICAL_DEPARTMENTS).toHaveLength(25);
    expect(ALPHABETICAL_DEPARTMENTS.slice(0, 3).map((d) => d.name)).toEqual(['Amazonas', 'Áncash', 'Apurímac']);
    expect(ALPHABETICAL_DEPARTMENTS.at(-1)?.name).toBe('Ucayali');
  });

  it('finds the departments the comparison has no data for', () => {
    const present = ALPHABETICAL_DEPARTMENTS.filter((d) => d.code !== 7 && d.code !== 17).map((d) => ({
      ...arequipa,
      departmentCode: d.code,
    }));
    expect(departmentsWithoutData(present).map((d) => d.name)).toEqual(['Callao', 'Madre de Dios']);
    expect(departmentsWithoutData([])).toHaveLength(25);
  });
});
