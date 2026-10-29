import {
  CLOSED_STATUS,
  STATUS_FILTERS,
  isClosed,
  isStatusFilter,
  matchesStatus,
  statusValueOf,
} from './investmentStatus';

describe('status filter', () => {
  it('has three choices: active, closed and every status', () => {
    expect(STATUS_FILTERS).toEqual(['ACTIVE', 'CLOSED', 'ALL']);
    expect(isStatusFilter('CLOSED')).toBe(true);
    expect(isStatusFilter('CERRADO')).toBe(false);
    expect(isStatusFilter(null)).toBe(false);
  });

  it('maps a filter to the MEF status it keeps', () => {
    expect(statusValueOf('ACTIVE')).toBe('ACTIVO');
    expect(statusValueOf('CLOSED')).toBe('CERRADO');
    expect(statusValueOf('ALL')).toBeNull();
    expect(statusValueOf(undefined)).toBeNull();
  });

  it('matches a project status like the database (other statuses only under ALL)', () => {
    expect(matchesStatus('ACTIVO', 'ACTIVE')).toBe(true);
    expect(matchesStatus('CERRADO', 'ACTIVE')).toBe(false);
    expect(matchesStatus('CERRADO', 'CLOSED')).toBe(true);
    expect(matchesStatus(null, 'CLOSED')).toBe(false);
    expect(matchesStatus('DESACTIVADO', 'ALL')).toBe(true);
    expect(matchesStatus(null, undefined)).toBe(true);
  });

  it('tells closed projects apart', () => {
    expect(CLOSED_STATUS).toBe('CERRADO');
    expect(isClosed({ status: 'CERRADO' })).toBe(true);
    expect(isClosed({ status: 'ACTIVO' })).toBe(false);
    expect(isClosed({ status: null })).toBe(false);
  });
});
