import { useState } from 'react';

import { TermHint } from '@/features/glossary/TermHint';
import type { InfobrasWork } from '@/features/investments/domain/infobras';
import { infobrasUrl } from '@/features/investments/domain/paralyzed';
import { SourcePanel, type SourcePanelItem } from '@/shared/ui/SourcePanel';

import {
  INFOBRAS_TITLE,
  infobrasFigures,
  infobrasFooter,
  infobrasMoreLabel,
  infobrasObraRows,
  visibleInfobrasWorks,
} from './infobrasPresentation';

interface Props {
  works: readonly InfobrasWork[];
  /** yyyy-mm-dd: the date the INFOBRAS data describes. */
  dataAsOf: string | null;
  /** Opens the INFOBRAS ficha in the system browser or a new tab. */
  onOpenUrl: (url: string) => void;
}

/**
 * "OBRAS EN INFOBRAS" on the detail screen: the same panel as the Contraloría paralyzed block, in
 * the neutral tone so that one stays the warning. Key figures, one compact row per obra (five, then
 * "Ver N obras más") and always the date of the data.
 */
export function InfobrasBlock({ works, dataAsOf, onOpenUrl }: Props) {
  const [expanded, setExpanded] = useState(false);
  const rows = infobrasObraRows(works);
  const { shown, hidden } = visibleInfobrasWorks(rows, expanded);
  const items: SourcePanelItem[] = shown.map((row) => ({
    key: String(row.infobrasCode),
    testID: `infobras-obra-${row.infobrasCode}`,
    summary: row.summary,
    lines: row.lines.map((line) => ({
      text: line.text,
      parts: line.parts.map((part) => ({ text: part.text, hint: part.term ? <TermHint term={part.term} /> : undefined })),
    })),
    links: [
      {
        label: 'Ver ficha en INFOBRAS',
        accessibilityLabel: `Ver ficha en INFOBRAS de la obra ${row.infobrasCode}`,
        onPress: () => onOpenUrl(infobrasUrl(row.infobrasCode)),
      },
    ],
  }));
  return (
    <SourcePanel
      testID="infobras"
      tone="neutral"
      title={INFOBRAS_TITLE}
      titleHint={<TermHint term="infobras" />}
      figures={infobrasFigures(works)}
      items={items}
      more={hidden > 0 ? { label: infobrasMoreLabel(hidden), onPress: () => setExpanded(true) } : undefined}
      footer={infobrasFooter(works, dataAsOf)}
    />
  );
}
