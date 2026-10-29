/**
 * Glossary of the terms the app shows. Definitions follow Invierte.pe and MEF terminology; terms
 * that are a rule or a record of Fiscus itself (kind 'fiscus') say so ("Regla de Fiscus: …").
 * One sentence each, plus an optional second sentence. Keep the rules in sync with
 * features/investments/domain (stalled.ts, investment.ts, costChange.ts).
 */

export const TERM_IDS = [
  'cui',
  'monto-viable',
  'costo-actualizado',
  'aumento',
  'devengado',
  'gastado',
  'avance-fisico',
  'pim',
  'nivel',
  'entidad',
  'unidad-ejecutora',
  'funcion',
  'estado',
  'cierre',
  'liquidacion',
  'sin-gasto-reciente',
  'costo-no-valido',
  'dato-inusual',
  'historial',
  'fuentes',
] as const;

export type TermId = (typeof TERM_IDS)[number];

export interface GlossaryTerm {
  id: TermId;
  /** The name as the guide and the hint show it. */
  term: string;
  /** One sentence. */
  definition: string;
  /** An optional second sentence. */
  extra?: string;
  /** 'mef': MEF / Invierte.pe terminology. 'fiscus': a rule or record of Fiscus. */
  kind: 'mef' | 'fiscus';
}

export const TERMS: Record<TermId, GlossaryTerm> = {
  cui: {
    id: 'cui',
    term: 'CUI (Código Único de Inversiones)',
    definition: 'Número que identifica a cada inversión pública en el Banco de Inversiones del Invierte.pe.',
    extra: 'Con él se puede buscar el proyecto en las consultas del MEF.',
    kind: 'mef',
  },
  'monto-viable': {
    id: 'monto-viable',
    term: 'Monto viable (aprobado)',
    definition: 'Costo de la inversión cuando fue declarada viable o aprobada, según su ficha técnica o estudio de preinversión.',
    extra: 'Fiscus lo muestra como «aprobado».',
    kind: 'mef',
  },
  'costo-actualizado': {
    id: 'costo-actualizado',
    term: 'Costo actualizado',
    definition: 'Costo total de la inversión que figura hoy en el Banco de Inversiones, con las modificaciones registradas después de su viabilidad.',
    extra: 'Fiscus lo muestra como «cuesta hoy».',
    kind: 'mef',
  },
  aumento: {
    id: 'aumento',
    term: 'Aumento de costo',
    definition: 'Diferencia entre el costo actualizado y el monto viable, en soles y como porcentaje del monto viable.',
    extra: 'Lo calcula Fiscus solo cuando el costo actualizado es válido; el MEF no publica esta cifra.',
    kind: 'mef',
  },
  devengado: {
    id: 'devengado',
    term: 'Devengado (gastado)',
    definition: 'Gasto reconocido como obligación de pago después de verificar la entrega del bien, servicio u obra, según el registro del MEF.',
    extra: 'El devengado acumulado suma lo devengado en todos los años.',
    kind: 'mef',
  },
  gastado: {
    id: 'gastado',
    term: 'Gastado % del costo',
    definition: 'Devengado acumulado dividido entre el costo actualizado: la parte del costo que ya se gastó.',
    extra: 'Mide dinero, no avance de obra, y puede superar el 100 %.',
    kind: 'mef',
  },
  'avance-fisico': {
    id: 'avance-fisico',
    term: 'Avance físico',
    definition: 'Porcentaje de ejecución de la obra que la entidad reporta al MEF.',
    extra: 'No es lo gastado y depende de que la entidad lo mantenga al día.',
    kind: 'mef',
  },
  pim: {
    id: 'pim',
    term: 'PIM (Presupuesto Institucional Modificado)',
    definition: 'Presupuesto del año asignado a la inversión, con las modificaciones hechas durante el año al presupuesto inicial (PIA).',
    kind: 'mef',
  },
  nivel: {
    id: 'nivel',
    term: 'Nivel de gobierno (GN/GR/GL)',
    definition: 'Quién ejecuta la inversión: Gobierno Nacional (GN), Gobierno Regional (GR) o Gobierno Local (GL).',
    extra: 'GN agrupa ministerios y sus organismos; GL, municipalidades provinciales y distritales.',
    kind: 'mef',
  },
  entidad: {
    id: 'entidad',
    term: 'Entidad',
    definition: 'Institución pública responsable de la inversión, como un ministerio, un gobierno regional o una municipalidad.',
    kind: 'mef',
  },
  'unidad-ejecutora': {
    id: 'unidad-ejecutora',
    term: 'Unidad ejecutora',
    definition: 'Dependencia de la entidad que ejecuta la inversión: contrata, paga y registra el gasto.',
    kind: 'mef',
  },
  funcion: {
    id: 'funcion',
    term: 'Función / división / grupo funcional',
    definition: 'Clasificación del gasto público por su finalidad, de lo general a lo particular.',
    extra: 'Fiscus agrupa la clasificación anterior del MEF en la vigente; ver la guía.',
    kind: 'mef',
  },
  estado: {
    id: 'estado',
    term: 'Estado y situación',
    definition: 'El estado indica si la inversión está activa, desactivada o cerrada en el Banco de Inversiones; la situación, la etapa en que se encuentra, como viable o aprobada.',
    kind: 'mef',
  },
  cierre: {
    id: 'cierre',
    term: 'Cierre de la inversión',
    definition: 'Registro con el que la unidad ejecutora da por terminada una inversión en el Banco de Inversiones, con el formato de cierre, tras su ejecución y liquidación o cuando ya no se va a culminar.',
    extra: 'Un proyecto cerrado ya no debería registrar gasto; «culminada» indica si la obra llegó a terminarse.',
    kind: 'mef',
  },
  liquidacion: {
    id: 'liquidacion',
    term: 'Liquidación',
    definition: 'Cálculo final del costo total de una inversión cuando termina su ejecución, aprobado por la entidad.',
    extra: 'Puede ser distinto del costo actualizado; Fiscus lo muestra tal como lo publica el MEF.',
    kind: 'mef',
  },
  'sin-gasto-reciente': {
    id: 'sin-gasto-reciente',
    term: 'Sin gasto reciente',
    definition: 'Regla de Fiscus: proyecto activo, con costo actualizado válido, que gastó entre el 5 % y el 95 % de su costo y no registra devengado en los 12 meses previos al último mes con datos.',
    extra: 'No significa que la obra esté paralizada, solo que no hay gasto registrado.',
    kind: 'fiscus',
  },
  'costo-no-valido': {
    id: 'costo-no-valido',
    term: 'Costo actualizado no válido',
    definition: 'Regla de Fiscus: el costo actualizado no es válido cuando es menor que S/ 1,000 o menor que el 1 % del monto viable.',
    extra: 'Suelen ser valores de relleno o truncados en la fuente; con ellos no se calculan el aumento ni el porcentaje gastado.',
    kind: 'fiscus',
  },
  'dato-inusual': {
    id: 'dato-inusual',
    term: 'Dato inusual',
    definition: 'Regla de Fiscus: se marca cuando lo gastado supera 10 veces el costo actualizado.',
    extra: 'El proyecto sigue visible, pero alguna de las dos cifras puede tener un error en la fuente.',
    kind: 'fiscus',
  },
  historial: {
    id: 'historial',
    term: 'Historial del costo',
    definition: 'Regla de Fiscus: cada ingesta compara el costo actualizado y el monto viable de cada proyecto y guarda un registro cuando cambian.',
    extra: 'El registro empezó el 27/10/2026; el MEF no publica los cambios anteriores.',
    kind: 'fiscus',
  },
  fuentes: {
    id: 'fuentes',
    term: 'Fuentes (SSI y Datos Abiertos del MEF)',
    definition: 'Fiscus usa el reporte del Sistema de Seguimiento de Inversiones (SSI), con proyectos de gobiernos regionales actualizados a diario, y dos archivos de Datos Abiertos: «Detalle de inversiones», con las inversiones activas de los tres niveles, y «Cierre de inversiones», con las cerradas.',
    extra: 'Si un proyecto está en ambas fuentes, sus cifras vienen del SSI.',
    kind: 'mef',
  },
};

export function termById(id: TermId): GlossaryTerm {
  return TERMS[id];
}

/** Every term in guide order. */
export const GLOSSARY: readonly GlossaryTerm[] = TERM_IDS.map((id) => TERMS[id]);

/** The rules and records of Fiscus, for the "Reglas de Fiscus" section. */
export const FISCUS_RULES: readonly GlossaryTerm[] = GLOSSARY.filter((term) => term.kind === 'fiscus');
