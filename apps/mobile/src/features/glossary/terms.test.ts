import { FISCUS_RULES, GLOSSARY, TERM_IDS, TERMS, termById } from './terms';

// The app's tsconfig has no Node types: the two modules are typed here with what the test uses.
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { isDirectory(): boolean };
}>('fs');
const { join } = jest.requireActual<{ join(...parts: string[]): string }>('path');
declare const __dirname: string;

const SRC = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Term ids referenced in app code: `term="…"` props and `term: '…'` fields. */
function usedTermIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    if (file.endsWith(join('glossary', 'terms.ts'))) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bterm(?:=|:\s*)["']([a-z-]+)["']/g)) ids.add(match[1]!);
  }
  return ids;
}

/** One sentence: a single full stop, at the end. */
const isSentence = (text: string) => text.endsWith('.') && (text.match(/\.(?=\s|$)/g) ?? []).length === 1;

describe('glossary terms', () => {
  it('covers every required term', () => {
    expect(GLOSSARY.map((t) => t.term)).toEqual([
      'CUI (Código Único de Inversiones)',
      'Monto viable (aprobado)',
      'Costo actualizado',
      'Aumento de costo',
      'Devengado (gastado)',
      'Gastado % del costo',
      'Avance físico',
      'PIM (Presupuesto Institucional Modificado)',
      'Nivel de gobierno (GN/GR/GL)',
      'Entidad',
      'Unidad ejecutora',
      'Función / división / grupo funcional',
      'Estado y situación',
      'Sin gasto reciente',
      'Costo actualizado no válido',
      'Dato inusual',
      'Historial del costo',
      'Fuentes (SSI y Datos Abiertos del MEF)',
    ]);
  });

  it('keys every term by its id', () => {
    for (const id of TERM_IDS) expect(termById(id).id).toBe(id);
  });

  it('defines every term in one sentence, with at most one more', () => {
    for (const term of GLOSSARY) {
      expect([term.id, isSentence(term.definition)]).toEqual([term.id, true]);
      if (term.extra !== undefined) expect([term.id, isSentence(term.extra)]).toEqual([term.id, true]);
    }
  });

  it('says so when a definition is a rule of Fiscus', () => {
    expect(FISCUS_RULES.map((t) => t.id)).toEqual(['sin-gasto-reciente', 'costo-no-valido', 'dato-inusual', 'historial']);
    for (const term of FISCUS_RULES) expect(term.definition.startsWith('Regla de Fiscus: ')).toBe(true);
    for (const term of GLOSSARY.filter((t) => t.kind === 'mef')) expect(term.definition).not.toMatch(/Regla de Fiscus/);
  });

  it('defines every term the app refers to', () => {
    const used = usedTermIds();
    expect(used.size).toBeGreaterThan(10);
    for (const id of used) expect(TERMS).toHaveProperty([id]);
  });
});
