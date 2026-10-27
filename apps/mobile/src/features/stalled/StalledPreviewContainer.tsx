import { useStalledPreview } from '@/features/investments/hooks/queries';

import { StalledPreviewSection, type StalledPreviewState } from './StalledPreviewSection';

const STALLED_PREVIEW_COUNT = 3;

interface Props {
  departmentCode: number;
  onPressInvestment: (cui: string) => void;
  onPressSeeAll: () => void;
}

export function StalledPreviewContainer({ departmentCode, onPressInvestment, onPressSeeAll }: Props) {
  const preview = useStalledPreview(departmentCode, STALLED_PREVIEW_COUNT);
  const state: StalledPreviewState =
    preview.status === 'success'
      ? { status: 'success', ...preview.data }
      : preview.status === 'error'
        ? { status: 'error', onRetry: () => preview.refetch() }
        : { status: 'pending' };
  return (
    <StalledPreviewSection state={state} onPressInvestment={onPressInvestment} onPressSeeAll={onPressSeeAll} />
  );
}
