import { useStalledPreview, type ReadScope } from '@/features/investments/hooks/queries';

import { StalledPreviewSection, type StalledPreviewState } from './StalledPreviewSection';

const STALLED_PREVIEW_COUNT = 3;

interface Props {
  /** Department (undefined: all of Peru) and level counted. */
  read: ReadScope;
  onPressInvestment: (cui: string) => void;
  onPressSeeAll: () => void;
}

export function StalledPreviewContainer({ read, onPressInvestment, onPressSeeAll }: Props) {
  const preview = useStalledPreview(read, STALLED_PREVIEW_COUNT);
  const state: StalledPreviewState =
    preview.status === 'success'
      ? { status: 'success', ...preview.data }
      : preview.status === 'error'
        ? { status: 'error', onRetry: () => preview.refetch() }
        : { status: 'pending' };
  return (
    <StalledPreviewSection
      state={state}
      national={read.departmentCode === undefined}
      onPressInvestment={onPressInvestment} onPressSeeAll={onPressSeeAll} />
  );
}
