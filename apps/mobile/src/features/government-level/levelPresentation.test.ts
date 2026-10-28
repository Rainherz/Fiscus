import { LEVEL_OPTIONS, levelFilterLabel, levelName, levelScopeNote, levelTag, regionsNote } from './levelPresentation';

describe('level presentation', () => {
  it('labels the filter and the picker options in Spanish', () => {
    expect(['ALL', 'GN', 'GR', 'GL'].map((l) => levelFilterLabel(l as 'ALL'))).toEqual([
      'Todos los niveles',
      'Gobierno nacional',
      'Gobiernos regionales',
      'Gobiernos locales',
    ]);
    expect(LEVEL_OPTIONS.map((o) => o.label)).toEqual(['Todos', 'Nacional', 'Regional', 'Local']);
  });

  it('names each tag', () => {
    expect(levelName('GN')).toBe('Gobierno nacional');
    expect(levelName('GR')).toBe('Gobierno regional');
    expect(levelName('GL')).toBe('Gobierno local');
  });

  it('builds the tag of a project, or none without a known level', () => {
    expect(levelTag('GN')).toEqual({ text: 'GN', label: 'Gobierno nacional' });
    expect(levelTag(null)).toBeUndefined();
  });

  it('writes the footnotes from the selected level', () => {
    expect(levelScopeNote('ALL')).toBe('Todos los niveles de gobierno.');
    expect(levelScopeNote('GR')).toBe('Gobiernos regionales.');
    expect(regionsNote('GR')).toBe('Gobiernos regionales. Montos en soles corrientes.');
    expect(regionsNote('GL')).toBe('Gobiernos locales. Montos en soles corrientes.');
    expect(regionsNote('ALL')).toBe(
      'Todos los niveles de gobierno. No incluye proyectos de varias regiones. Montos en soles corrientes.',
    );
    expect(regionsNote('GN')).toBe(
      'Gobierno nacional. No incluye proyectos de varias regiones. Montos en soles corrientes.',
    );
  });
});
