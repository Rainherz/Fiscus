import { useParalyzedPreview, type ReadScope } from '@/features/investments/hooks/queries';

import { ParalyzedPreviewSection, type ParalyzedPreviewState } from './ParalyzedPreviewSection';

const PARALYZED_PREVIEW_COUNT = 3;

interface Props {
  /** Department (undefined: all of Peru), level and status counted. */
  read: ReadScope;
  onPressInvestment: (cui: string) => void;
  onPressSeeAll: () => void;
}

export function ParalyzedPreviewContainer({ read, onPressInvestment, onPressSeeAll }: Props) {
  const preview = useParalyzedPreview(read, PARALYZED_PREVIEW_COUNT);
  const state: ParalyzedPreviewState =
    preview.status === 'success'
      ? { status: 'success', ...preview.data }
      : preview.status === 'error'
        ? { status: 'error', onRetry: () => preview.refetch() }
        : { status: 'pending' };
  return (
    <ParalyzedPreviewSection
      state={state}
      now={new Date()}
      national={read.departmentCode === undefined}
      onPressInvestment={onPressInvestment}
      onPressSeeAll={onPressSeeAll}
    />
  );
}
