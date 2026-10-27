import type { Investment } from '@/features/investments/domain/investment';
import { formatSignedSoles } from '@/shared/format';

import { withRegion } from '../department/scope';

/** Line under a project in a category: its increase, or its CUI. Listing all of Peru, the region leads. */
export function categoryRowDetail(item: Investment, options: { national?: boolean } = {}): string {
  const line =
    item.costIncrease !== null && item.costIncrease !== 0
      ? `${formatSignedSoles(item.costIncrease)} vs. monto viable`
      : `CUI ${item.cui}`;
  return options.national ? withRegion(item.departmentCode, line) : line;
}
