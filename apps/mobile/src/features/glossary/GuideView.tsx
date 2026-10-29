import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FUNCTION_CROSSWALK, type CrosswalkRule } from '@/features/investments/domain/functionCrosswalk';
import { gutterFor } from '@/shared/layout/breakpoints';
import { useBreakpoint } from '@/shared/layout/useBreakpoint';
import { colors, rule, space } from '@/shared/theme/tokens';
import { BodyText, DisplayText, MonoText } from '@/shared/ui/typography';

import { FISCUS_RULES, GLOSSARY, termById, type GlossaryTerm } from './terms';

/** A readable line length for running text. */
const GUIDE_MAX_WIDTH = 760;

function Paragraph({ children }: { children: string }) {
  return <BodyText size={16}>{children}</BodyText>;
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.bullets}>
      {items.map((item) => (
        <View key={item} style={styles.bullet}>
          <MonoText bold size={14} style={styles.bulletMark}>
            —
          </MonoText>
          <BodyText size={16} style={styles.bulletText}>
            {item}
          </BodyText>
        </View>
      ))}
    </View>
  );
}

function TermEntry({ term }: { term: GlossaryTerm }) {
  return (
    <View nativeID={`termino-${term.id}`} style={styles.term}>
      <MonoText bold size={13}>
        {term.term}
      </MonoText>
      <BodyText size={15}>{term.definition}</BodyText>
      {term.extra ? (
        <BodyText size={15} muted>
          {term.extra}
        </BodyText>
      ) : null}
    </View>
  );
}

const sources = termById('fuentes');

/**
 * One line per crosswalk rule: "FUNCTION / DIVISION → CANONICAL"; a function's wildcard rule reads
 * "otras divisiones" when the function also has rules for specific divisions.
 */
export function crosswalkRuleLines(rules: readonly CrosswalkRule[] = FUNCTION_CROSSWALK): string[] {
  return rules.map((rule) => {
    const hasSpecific = rules.some((r) => r.sourceFunction === rule.sourceFunction && r.sourceDivision !== null);
    const source =
      rule.sourceDivision !== null
        ? `${rule.sourceFunction} / ${rule.sourceDivision}`
        : hasSpecific
          ? `${rule.sourceFunction} / otras divisiones`
          : rule.sourceFunction;
    return `${source} → ${rule.canonicalFunction}`;
  });
}

/** "CÓMO LEER ESTOS DATOS": the sections of the guide, in order. */
export const GUIDE_SECTIONS: readonly { title: string; testID?: string; body: ReactNode }[] = [
  {
    title: 'Qué es Fiscus',
    body: (
      <>
        <Paragraph>
          Fiscus muestra datos públicos del Ministerio de Economía y Finanzas (MEF) sobre los proyectos de inversión
          del Estado peruano: cuánto se aprobó, cuánto cuestan hoy y cuánto se gastó.
        </Paragraph>
        <Paragraph>
          No es un sitio del MEF. Los datos se leen tal como el MEF los publica, con algunas reglas propias que se
          explican abajo.
        </Paragraph>
      </>
    ),
  },
  {
    title: 'De dónde salen los datos',
    body: (
      <>
        <Paragraph>{`${sources.definition} ${sources.extra ?? ''}`.trim()}</Paragraph>
        <Paragraph>
          El reporte del SSI se carga cada día. El archivo de Datos Abiertos se revisa cada día y se carga cuando el
          MEF lo actualiza, lo que ocurre con menos frecuencia. El pie de página muestra ambas fechas.
        </Paragraph>
      </>
    ),
  },
  {
    title: 'Cómo leer un proyecto',
    body: (
      <Bullets
        items={[
          'Aprobado es el monto viable: lo que se estimó al declarar viable la inversión.',
          'Cuesta hoy es el costo actualizado: el costo que figura ahora en el Banco de Inversiones.',
          'El aumento es la diferencia entre los dos, en soles y en porcentaje de lo aprobado.',
          'Gastado % del costo compara lo devengado con el costo actualizado; mide dinero, no avance de obra.',
          'Avance físico es el avance de la obra que la entidad reporta al MEF; no siempre coincide con lo gastado.',
          'El historial del costo muestra los cambios que Fiscus registró desde el 27/10/2026.',
        ]}
      />
    ),
  },
  {
    title: 'Clasificación por función',
    testID: 'guide-functions',
    body: (
      <>
        <Paragraph>
          El MEF usa una clasificación funcional vigente desde 2009, pero muchos proyectos declarados viables antes,
          y algunos hasta 2018, conservan la anterior, como EDUCACION Y CULTURA o SALUD Y SANEAMIENTO.
        </Paragraph>
        <Paragraph>
          Para no partir una misma categoría en dos, Fiscus agrupa cada función anterior en la vigente según su
          división funcional, no por el parecido del nombre. El detalle de cada proyecto muestra también la
          clasificación original del MEF. Las demás funciones se muestran tal como las publica el MEF.
        </Paragraph>
        <Bullets items={crosswalkRuleLines()} />
      </>
    ),
  },
  {
    title: 'Glosario',
    testID: 'guide-glossary',
    body: GLOSSARY.filter((term) => term.kind === 'mef').map((term) => <TermEntry key={term.id} term={term} />),
  },
  {
    title: 'Reglas de Fiscus',
    testID: 'guide-rules',
    body: (
      <>
        <Paragraph>Criterios propios de Fiscus para leer los datos; no son categorías oficiales del MEF.</Paragraph>
        {FISCUS_RULES.map((term) => (
          <TermEntry key={term.id} term={term} />
        ))}
      </>
    ),
  },
  {
    title: 'Limitaciones conocidas',
    testID: 'guide-limitations',
    body: (
      <Bullets
        items={[
          'SSI y Datos Abiertos no cubren lo mismo: el SSI trae solo gobiernos regionales, incluidos proyectos cerrados; Datos Abiertos trae los tres niveles, pero solo proyectos activos. Los proyectos cerrados del Gobierno Nacional y de gobiernos locales no están en Fiscus.',
          'El mapa muestra solo los proyectos con coordenadas registradas en el MEF (≈77 %).',
          'El historial del costo empieza el 27/10/2026; los cambios anteriores no se conocen.',
          'Algunos costos actualizados publicados por el MEF son valores de relleno o truncados: si son menores que S/ 1,000 o que el 1 % del monto viable, Fiscus los marca como no válidos y no calcula aumento ni porcentaje gastado.',
        ]}
      />
    ),
  },
];

/** "/guia": how to read the data, the glossary, the rules of Fiscus and the known limitations. */
export function GuideView() {
  const breakpoint = useBreakpoint();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingHorizontal: gutterFor(breakpoint) }]}>
      <DisplayText weight={900} size={34} accessibilityRole="header" style={styles.title}>
        CÓMO LEER ESTOS DATOS
      </DisplayText>
      {GUIDE_SECTIONS.map((section) => (
        <View key={section.title} testID={section.testID} style={styles.section}>
          <DisplayText weight={900} size={24} accessibilityRole="header">
            {section.title}
          </DisplayText>
          {section.body}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.concrete },
  content: {
    width: '100%',
    maxWidth: GUIDE_MAX_WIDTH,
    alignSelf: 'center',
    paddingTop: space.lg,
    paddingBottom: space.xl * 2,
  },
  title: { lineHeight: 36 },
  section: { marginTop: space.xl, paddingTop: space.md, borderTopWidth: rule, borderTopColor: colors.ink, gap: space.md },
  bullets: { gap: space.sm },
  bullet: { flexDirection: 'row', gap: space.sm },
  bulletMark: { lineHeight: 22 },
  bulletText: { flex: 1 },
  term: { gap: 2, paddingTop: space.xs },
});
