import { mapInvestmentRow } from '../domain/mappers';
import { MOCK_ROWS, sampleRow } from './sampleData';

const mock = MOCK_ROWS.map(mapInvestmentRow);

describe('sampleRow', () => {
  it('nulls the derived metrics for placeholder costs below S/ 1,000, like the database', () => {
    const row = sampleRow({ cui: '1', viable: 166_262_211, updated: 10, accrued: 5_000 });
    expect(row.updated_cost_valid).toBe(false);
    expect(row.cost_increase).toBeNull();
    expect(row.cost_increase_pct).toBeNull();
    expect(row.execution_progress).toBeNull();
    expect(row.accrued_total).toBe(5_000);
  });

  it('keeps an explicit null name, status and department name', () => {
    const row = sampleRow({ cui: '1', name: null, status: null, departmentName: null });
    expect(row.status).toBeNull();
    expect(row.name).toBeNull();
    expect(row.department_name).toBeNull();
  });
});

describe('MOCK_ROWS', () => {
  it('includes a project that spent more than its updated cost', () => {
    const lorena = mock.find((i) => i.cui === '2094808');
    expect(lorena?.updatedCostValid).toBe(true);
    expect(lorena?.executionProgress).toBeGreaterThan(1);
  });

  it('includes a project whose source cost is a placeholder', () => {
    const placeholder = mock.find((i) => i.cui === '2196297');
    expect(placeholder?.updatedCost).toBe(10);
    expect(placeholder?.updatedCostValid).toBe(false);
  });

  it('has unique CUIs', () => {
    expect(new Set(mock.map((i) => i.cui)).size).toBe(mock.length);
  });
});
