import { displayLocation } from './location';

describe('displayLocation', () => {
  it.each(['- TODOS -', '-TODOS-', 'TODOS', ' todos ', '- Todos', 'TODOS -'])(
    'reads %p as several provinces or districts',
    (value) => {
      expect(displayLocation(value, 'provincia')).toBe('Varias provincias');
      expect(displayLocation(value, 'distrito')).toBe('Varios distritos');
    },
  );

  it('keeps real names as they are', () => {
    expect(displayLocation('AREQUIPA', 'provincia')).toBe('AREQUIPA');
    expect(displayLocation('TODOS LOS SANTOS', 'distrito')).toBe('TODOS LOS SANTOS');
  });

  it('keeps a missing value missing', () => {
    expect(displayLocation(null, 'distrito')).toBeNull();
  });
});
