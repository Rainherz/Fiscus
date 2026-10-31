import { EmptyState, type EmptyStateAction } from '@/shared/ui/EmptyState';

import {
  describeActiveFilters,
  emptyHint,
  emptyShortcuts,
  filteredEmptyMessage,
  type EmptyListKind,
  type EmptyShortcutId,
} from './emptyState';
import { NATIONAL } from './scope';
import { useOptionalScope } from './ScopeContext';

interface Props {
  /** What is missing, without the final period: "No hay proyectos para este ranking". */
  what: string;
  list?: EmptyListKind;
  /** False: `what` is a full sentence kept verbatim; only the shortcuts are added. */
  describeFilters?: boolean;
  /** False: the list does not follow the scope (region comparisons). */
  followsScope?: boolean;
  /** Filters of the screen itself (the map chips), named after the global ones. */
  extraFilters?: readonly string[];
  /** Overrides the hint of the list kind. */
  hint?: string | null;
  variant?: 'plain' | 'ruled';
}

/**
 * The empty state of a list read through the global scope, level and status: names the filters
 * that are on and offers shortcuts that relax them in place (same state as the region picker).
 * Outside ScopeProvider it only shows the message.
 */
export function FilteredEmptyState({
  what,
  list = 'default',
  describeFilters = true,
  followsScope = true,
  extraFilters = [],
  hint,
  variant,
}: Props) {
  const context = useOptionalScope();
  if (!context) {
    return <EmptyState message={describeFilters ? `${what}.` : what} hint={hint} variant={variant} />;
  }
  const { level, status, setScope, setLevel, setStatus } = context;
  const scope = followsScope ? context.scope : null;
  const relax: Record<EmptyShortcutId, () => void> = {
    status: () => setStatus('ALL'),
    level: () => setLevel('ALL'),
    scope: () => setScope(NATIONAL),
  };
  const actions: EmptyStateAction[] = emptyShortcuts({ scope, level, status, list }).map((shortcut) => ({
    key: shortcut.id,
    label: shortcut.label,
    accessibilityLabel: shortcut.accessibilityLabel,
    onPress: relax[shortcut.id],
  }));
  const message = describeFilters
    ? filteredEmptyMessage(what, describeActiveFilters(scope, level, status, extraFilters))
    : what;
  return (
    <EmptyState
      message={message}
      hint={hint === undefined ? emptyHint(list, status) : hint}
      actions={actions}
      variant={variant}
    />
  );
}
