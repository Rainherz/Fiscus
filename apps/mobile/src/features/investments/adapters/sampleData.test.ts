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

  it('invalidates updated costs below 1% of a positive viable amount, like the database', () => {
    const row = sampleRow({ cui: '1', viable: 1_990_720, updated: 4_558.66, accrued: 1_422_564.44 });
    expect(row.updated_cost_valid).toBe(false);
    expect(row.cost_increase).toBeNull();
    expect(row.execution_progress).toBeNull();
    expect(row.spent_anomaly).toBe(false);
  });

  it('applies only the absolute floor when the viable amount is missing', () => {
    expect(sampleRow({ cui: '1', viable: null, updated: 5_000 }).updated_cost_valid).toBe(true);
  });

  it('flags spending above 10 times a valid updated cost, like the database', () => {
    expect(sampleRow({ cui: '1', viable: 299_700, updated: 299_700, accrued: 18_768_455.33 }).spent_anomaly).toBe(true);
    expect(sampleRow({ cui: '2', viable: 1_000_000, updated: 1_000_000, accrued: 10_000_000 }).spent_anomaly).toBe(false);
    expect(sampleRow({ cui: '3', viable: 1_000_000, updated: 1_000_000, accrued: null }).spent_anomaly).toBe(false);
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

  it('includes a project whose updated cost is below 1% of its viable amount', () => {
    const truncated = mock.find((i) => i.cui === '2045951');
    expect(truncated?.updatedCost).toBe(4_558.66);
    expect(truncated?.updatedCostValid).toBe(false);
    expect(truncated?.executionProgress).toBeNull();
  });

  it('includes a project whose spending is unusually high for its updated cost', () => {
    const anomaly = mock.find((i) => i.cui === '2057689');
    expect(anomaly?.updatedCostValid).toBe(true);
    expect(anomaly?.spentAnomaly).toBe(true);
    expect(anomaly?.executionProgress).toBeCloseTo(62.62, 2);
  });

  it('has unique CUIs', () => {
    expect(new Set(mock.map((i) => i.cui)).size).toBe(mock.length);
  });
});
