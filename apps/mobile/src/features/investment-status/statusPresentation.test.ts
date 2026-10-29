import { projectTag, regionsNote } from '../government-level/levelPresentation';
import {
  ACTIVE_ONLY_NOTE,
  STATUS_OPTIONS,
  isActiveOnlyHidden,
  statusFilterLabel,
  statusScopeNote,
} from './statusPresentation';

describe('status filter presentation', () => {
  it('offers Activos, Cerrados and Todos, in that order', () => {
    expect(STATUS_OPTIONS).toEqual([
      { key: 'ACTIVE', label: 'Activos' },
      { key: 'CLOSED', label: 'Cerrados' },
      { key: 'ALL', label: 'Todos' },
    ]);
  });

  it('names the filter for the header', () => {
    expect(statusFilterLabel('ACTIVE')).toBe('Proyectos activos');
    expect(statusFilterLabel('CLOSED')).toBe('Proyectos cerrados');
    expect(statusFilterLabel('ALL')).toBe('Activos y cerrados');
  });

  it('describes which projects a figure covers', () => {
    expect(statusScopeNote('ACTIVE')).toBe('Solo proyectos activos.');
    expect(statusScopeNote('CLOSED')).toBe('Solo proyectos cerrados.');
    expect(statusScopeNote('ALL')).toBe('Proyectos activos y cerrados.');
  });

  it('hides the active-only figures (sin gasto reciente, time running) for closed projects', () => {
    expect(isActiveOnlyHidden('CLOSED')).toBe(true);
    expect(isActiveOnlyHidden('ACTIVE')).toBe(false);
    expect(isActiveOnlyHidden('ALL')).toBe(false);
    expect(ACTIVE_ONLY_NOTE).toContain('solo a proyectos activos');
  });
});

describe('projectTag', () => {
  it('is the level code, plus CERRADO for closed projects', () => {
    expect(projectTag({ governmentLevel: 'GL', status: 'ACTIVO' })).toEqual({ text: 'GL', label: 'Gobierno local' });
    expect(projectTag({ governmentLevel: 'GN', status: 'CERRADO' })).toEqual({
      text: 'GN · CERRADO',
      label: 'Gobierno nacional, proyecto cerrado',
    });
  });

  it('shows CERRADO alone when the level is unknown, and nothing for an active project without level', () => {
    expect(projectTag({ governmentLevel: null, status: 'CERRADO' })).toEqual({ text: 'CERRADO', label: 'Proyecto cerrado' });
    expect(projectTag({ governmentLevel: null, status: 'ACTIVO' })).toBeUndefined();
  });
});

describe('regionsNote with a status', () => {
  it('says which projects the comparison covers', () => {
    expect(regionsNote('GR', 'CLOSED')).toBe('Gobiernos regionales. Solo proyectos cerrados. Montos en soles corrientes.');
    expect(regionsNote('ALL', 'ACTIVE')).toBe(
      'Todos los niveles de gobierno. Solo proyectos activos. No incluye proyectos de varias regiones. Montos en soles corrientes.',
    );
  });
});
