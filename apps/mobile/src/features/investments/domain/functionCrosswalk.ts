/**
 * Crosswalk from the old MEF functional classification (projects declared viable roughly
 * 2002-2018, e.g. "EDUCACION Y CULTURA") to the current one (since 2009, e.g. "EDUCACIÓN").
 *
 * Mirrors the seed of `public.function_crosswalk` (supabase/migrations/20261105000000_function_crosswalk.sql);
 * functionCrosswalk.test.ts fails when the two differ. The database sets `function_canonical` with
 * the same rule; this copy backs the demo mode and the guide.
 */

export interface CrosswalkRule {
  sourceFunction: string;
  /** Null: every other division of `sourceFunction`. */
  sourceDivision: string | null;
  canonicalFunction: string;
}

export const FUNCTION_CROSSWALK: readonly CrosswalkRule[] = [
  { sourceFunction: 'ADMINISTRACION Y PLANEAMIENTO', sourceDivision: null, canonicalFunction: 'PLANEAMIENTO, GESTIÓN Y RESERVA DE CONTINGENCIA' },
  { sourceFunction: 'AGRARIA', sourceDivision: 'PRESERVACION DE LOS RECURSOS NATURALES RENOVABLES', canonicalFunction: 'AMBIENTE' },
  { sourceFunction: 'AGRARIA', sourceDivision: null, canonicalFunction: 'AGROPECUARIA' },
  { sourceFunction: 'ASISTENCIA Y PREVISION SOCIAL', sourceDivision: 'PREVISION', canonicalFunction: 'PREVISIÓN SOCIAL' },
  { sourceFunction: 'ASISTENCIA Y PREVISION SOCIAL', sourceDivision: null, canonicalFunction: 'PROTECCIÓN SOCIAL' },
  { sourceFunction: 'DEFENSA Y SEGURIDAD CIUDADANA', sourceDivision: null, canonicalFunction: 'DEFENSA Y SEGURIDAD NACIONAL' },
  { sourceFunction: 'EDUCACION Y CULTURA', sourceDivision: 'CULTURA', canonicalFunction: 'CULTURA Y DEPORTE' },
  { sourceFunction: 'EDUCACION Y CULTURA', sourceDivision: 'EDUCACION FISICA Y DEPORTES', canonicalFunction: 'CULTURA Y DEPORTE' },
  { sourceFunction: 'EDUCACION Y CULTURA', sourceDivision: null, canonicalFunction: 'EDUCACIÓN' },
  { sourceFunction: 'ENERGIA Y RECURSOS MINERALES', sourceDivision: 'RECURSOS MINERALES', canonicalFunction: 'MINERÍA' },
  { sourceFunction: 'ENERGIA Y RECURSOS MINERALES', sourceDivision: null, canonicalFunction: 'ENERGÍA' },
  { sourceFunction: 'INDUSTRIA, COMERCIO Y SERVICIOS', sourceDivision: 'TURISMO', canonicalFunction: 'TURISMO' },
  { sourceFunction: 'INDUSTRIA, COMERCIO Y SERVICIOS', sourceDivision: 'COMERCIO', canonicalFunction: 'COMERCIO' },
  { sourceFunction: 'INDUSTRIA, COMERCIO Y SERVICIOS', sourceDivision: 'INDUSTRIA', canonicalFunction: 'INDUSTRIA' },
  { sourceFunction: 'INDUSTRIA, COMERCIO Y SERVICIOS', sourceDivision: null, canonicalFunction: 'COMERCIO' },
  { sourceFunction: 'SALUD Y SANEAMIENTO', sourceDivision: 'SANEAMIENTO', canonicalFunction: 'SANEAMIENTO' },
  { sourceFunction: 'SALUD Y SANEAMIENTO', sourceDivision: 'PROTECCION DEL MEDIO AMBIENTE', canonicalFunction: 'AMBIENTE' },
  { sourceFunction: 'SALUD Y SANEAMIENTO', sourceDivision: null, canonicalFunction: 'SALUD' },
];

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * The function in the current classification: the exact (function, division) rule, else the
 * function's wildcard rule, else the function itself. Labels are compared exactly (MEF publishes
 * them verbatim) after trimming. Like `public.canonical_function`.
 */
export function canonicalFunction(fn: string | null | undefined, division: string | null | undefined): string | null {
  const source = clean(fn);
  if (source === null) return null;
  const sourceDivision = clean(division);
  const rules = FUNCTION_CROSSWALK.filter((rule) => rule.sourceFunction === source);
  const rule =
    rules.find((r) => r.sourceDivision !== null && r.sourceDivision === sourceDivision) ??
    rules.find((r) => r.sourceDivision === null);
  return rule ? rule.canonicalFunction : source;
}

/**
 * "FUNCTION / DIVISION" as the MEF published it, when the canonical function differs from the
 * original one; null otherwise (nothing to explain).
 */
export function originalClassification(
  fn: string | null,
  division: string | null,
  canonical: string | null,
): string | null {
  const source = clean(fn);
  if (source === null || source === clean(canonical)) return null;
  const sourceDivision = clean(division);
  return sourceDivision ? `${source} / ${sourceDivision}` : source;
}
