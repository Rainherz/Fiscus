import { canonicalFunction, FUNCTION_CROSSWALK, originalClassification } from './functionCrosswalk';

// The app's tsconfig has no Node types: the two modules are typed here with what the test uses.
const { readFileSync } = jest.requireActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('fs');
const { join } = jest.requireActual<{ join(...parts: string[]): string }>('path');
declare const __dirname: string;

const MIGRATION = join(
  __dirname,
  '..', '..', '..', '..', '..', '..',
  'supabase', 'migrations', '20261105000000_function_crosswalk.sql',
);

const literal = (value: string) => value.replace(/''/g, "'");

/** The (function, division, canonical) tuples of the migration's `insert into public.function_crosswalk`. */
function migrationSeed() {
  const sql = readFileSync(MIGRATION, 'utf8');
  const insert = sql.match(/insert into public\.function_crosswalk[^;]*;/)?.[0];
  if (!insert) throw new Error('crosswalk seed not found');
  const tuple = /\(\s*'((?:[^']|'')*)'\s*,\s*(null|'((?:[^']|'')*)')\s*,\s*'((?:[^']|'')*)'\s*\)/g;
  return [...insert.matchAll(tuple)].map((m) => ({
    sourceFunction: literal(m[1]!),
    sourceDivision: m[2] === 'null' ? null : literal(m[3]!),
    canonicalFunction: literal(m[4]!),
  }));
}

describe('function crosswalk', () => {
  it('matches the seed of the migration, rule by rule and in order', () => {
    const seed = migrationSeed();
    expect(seed).toHaveLength(18);
    expect(FUNCTION_CROSSWALK).toEqual(seed);
  });

  it.each([
    ['EDUCACION Y CULTURA', 'INFRAESTRUCTURA EDUCATIVA', 'EDUCACIÓN'],
    ['EDUCACION Y CULTURA', 'CULTURA', 'CULTURA Y DEPORTE'],
    ['EDUCACION Y CULTURA', 'EDUCACION FISICA Y DEPORTES', 'CULTURA Y DEPORTE'],
    ['SALUD Y SANEAMIENTO', 'SANEAMIENTO', 'SANEAMIENTO'],
    ['SALUD Y SANEAMIENTO', 'PROTECCION DEL MEDIO AMBIENTE', 'AMBIENTE'],
    ['SALUD Y SANEAMIENTO', 'SALUD INDIVIDUAL', 'SALUD'],
    ['AGRARIA', 'PRESERVACION DE LOS RECURSOS NATURALES RENOVABLES', 'AMBIENTE'],
    ['AGRARIA', 'PROMOCION DE LA PRODUCCION AGRARIA', 'AGROPECUARIA'],
    ['ASISTENCIA Y PREVISION SOCIAL', 'PREVISION', 'PREVISIÓN SOCIAL'],
    ['ASISTENCIA Y PREVISION SOCIAL', 'ASISTENCIA SOLIDARIA', 'PROTECCIÓN SOCIAL'],
    ['ENERGIA Y RECURSOS MINERALES', 'RECURSOS MINERALES', 'MINERÍA'],
    ['ENERGIA Y RECURSOS MINERALES', 'ENERGIA', 'ENERGÍA'],
    ['INDUSTRIA, COMERCIO Y SERVICIOS', 'TURISMO', 'TURISMO'],
    ['INDUSTRIA, COMERCIO Y SERVICIOS', 'INDUSTRIA', 'INDUSTRIA'],
    ['INDUSTRIA, COMERCIO Y SERVICIOS', 'OTRA', 'COMERCIO'],
    ['ADMINISTRACION Y PLANEAMIENTO', 'ADMINISTRACION', 'PLANEAMIENTO, GESTIÓN Y RESERVA DE CONTINGENCIA'],
    ['DEFENSA Y SEGURIDAD CIUDADANA', 'DEFENSA Y SEGURIDAD NACIONAL', 'DEFENSA Y SEGURIDAD NACIONAL'],
  ])('maps %s / %s to %s', (fn, division, expected) => {
    expect(canonicalFunction(fn, division)).toBe(expected);
  });

  it('falls back to the wildcard row without a division', () => {
    expect(canonicalFunction('SALUD Y SANEAMIENTO', null)).toBe('SALUD');
  });

  it('keeps every other function as it is, compared exactly after trimming', () => {
    expect(canonicalFunction('EDUCACIÓN', 'EDUCACIÓN BÁSICA')).toBe('EDUCACIÓN');
    expect(canonicalFunction('TRANSPORTE', null)).toBe('TRANSPORTE');
    expect(canonicalFunction(' TRANSPORTE ', null)).toBe('TRANSPORTE');
    expect(canonicalFunction('  SALUD Y SANEAMIENTO ', ' SANEAMIENTO ')).toBe('SANEAMIENTO');
    expect(canonicalFunction('salud y saneamiento', 'SANEAMIENTO')).toBe('salud y saneamiento');
  });

  it('keeps a missing function missing', () => {
    expect(canonicalFunction(null, null)).toBeNull();
    expect(canonicalFunction(null, 'SANEAMIENTO')).toBeNull();
    expect(canonicalFunction('   ', null)).toBeNull();
  });

  it('describes the original classification only when it differs from the canonical one', () => {
    expect(originalClassification('EDUCACION Y CULTURA', 'INFRAESTRUCTURA EDUCATIVA', 'EDUCACIÓN')).toBe(
      'EDUCACION Y CULTURA / INFRAESTRUCTURA EDUCATIVA',
    );
    expect(originalClassification('AGRARIA', null, 'AGROPECUARIA')).toBe('AGRARIA');
    expect(originalClassification('TRANSPORTE', 'TRANSPORTE TERRESTRE', 'TRANSPORTE')).toBeNull();
    expect(originalClassification(' TRANSPORTE ', null, 'TRANSPORTE')).toBeNull();
    expect(originalClassification(null, null, null)).toBeNull();
  });
});
