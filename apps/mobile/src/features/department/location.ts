/**
 * MEF writes "- TODOS -" (or "-TODOS-", "TODOS") in PROVINCIA / DISTRITO when a project spans
 * several of them. Only the display changes; stored data keeps the raw value.
 */
const ALL_PATTERN = /^\s*-?\s*TODOS\s*-?\s*$/i;

const SEVERAL: Record<'provincia' | 'distrito', string> = {
  provincia: 'Varias provincias',
  distrito: 'Varios distritos',
};

export function displayLocation(value: string | null, kind: 'provincia' | 'distrito'): string | null {
  if (value === null) return null;
  return ALL_PATTERN.test(value) ? SEVERAL[kind] : value;
}
