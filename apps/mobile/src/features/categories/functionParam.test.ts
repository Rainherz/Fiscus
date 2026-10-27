import { decodeFunctionParam, encodeFunctionParam } from './functionParam';

describe('function route param', () => {
  it('round-trips function labels', () => {
    expect(decodeFunctionParam(encodeFunctionParam('EDUCACION Y CULTURA'))).toBe('EDUCACION Y CULTURA');
  });

  it('represents a missing function with a sentinel', () => {
    expect(encodeFunctionParam(null)).toBe('_sin-funcion');
    expect(decodeFunctionParam('_sin-funcion')).toBeNull();
  });

  it('takes the first value of repeated params', () => {
    expect(decodeFunctionParam(['SALUD', 'X'])).toBe('SALUD');
    expect(decodeFunctionParam(undefined)).toBeNull();
  });
});
