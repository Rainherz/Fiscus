import { TermHint } from '@/features/glossary/TermHint';
import { infobrasUrl, type ParalyzedDetail, type ParalyzedWork } from '@/features/investments/domain/paralyzed';
import { formatInteger, formatSoles, formatSolesCompact } from '@/shared/format';
import { SourcePanel, type SourcePanelFigure, type SourcePanelLink } from '@/shared/ui/SourcePanel';

import {
  PARALYZED_ATTRIBUTION,
  PARALYZED_TITLE,
  paralyzedCausal,
  paralyzedEditionLine,
  paralyzedProgressText,
} from './paralyzedPresentation';

interface Props {
  detail: ParalyzedDetail;
  now: Date;
  /** Opens an external page (INFOBRAS ficha, MEF report) in the system browser or a new tab. */
  onOpenUrl: (url: string) => void;
}

function obraLine(work: ParalyzedWork): string {
  const progress = work.physicalProgress === null ? '—' : `${formatInteger(work.physicalProgress)} %`;
  return `Obra ${work.infobrasCode} · ${paralyzedCausal(work.causalLabel)} · avance ${progress} · saldo ${formatSolesCompact(work.remainingWorkBalance)}`;
}

/** Links of one obra: its INFOBRAS ficha and, when filed, the MEF situational report. */
function obraLinks(work: ParalyzedWork, several: boolean, onOpenUrl: (url: string) => void): SourcePanelLink[] {
  const of = several ? ` de la obra ${work.infobrasCode}` : '';
  return [
    {
      label: 'Ver ficha en INFOBRAS',
      accessibilityLabel: `Ver ficha en INFOBRAS${of}`,
      onPress: () => onOpenUrl(infobrasUrl(work.infobrasCode)),
    },
    ...(work.mefReportUrl
      ? [
          {
            label: 'Informe situacional del MEF',
            accessibilityLabel: `Informe situacional del MEF${of}`,
            onPress: () => onOpenUrl(work.mefReportUrl!),
          },
        ]
      : []),
  ];
}

/**
 * "PARALIZADA SEGÚN LA CONTRALORÍA" on the detail screen: the official record, in ink and signal so
 * it is not read as the "Sin gasto reciente" line (a rule of Fiscus, drawn as a plain ink rule).
 */
export function ParalyzedBlock({ detail, now, onOpenUrl }: Props) {
  const { summary, works } = detail;
  const several = works.length > 1;
  const figures: SourcePanelFigure[] = [
    { label: 'Avance físico', value: paralyzedProgressText(summary) },
    { label: 'Saldo de obra', value: formatSoles(summary.totalRemainingWorkBalance) },
    ...(summary.obraCount > 1 ? [{ label: 'Obras', value: formatInteger(summary.obraCount) }] : []),
  ];
  return (
    <SourcePanel
      testID="paralyzed"
      tone="alert"
      title={PARALYZED_TITLE}
      titleHint={<TermHint term="obra-paralizada" onInk />}
      headline={`Causal: ${paralyzedCausal(summary.mainCausalLabel)}`}
      figures={figures}
      items={
        several
          ? works.map((work) => ({ key: String(work.infobrasCode), summary: obraLine(work), links: obraLinks(work, true, onOpenUrl) }))
          : undefined
      }
      links={!several && works[0] ? obraLinks(works[0], false, onOpenUrl) : undefined}
      footer={[paralyzedEditionLine(summary, now), PARALYZED_ATTRIBUTION]}
    />
  );
}
