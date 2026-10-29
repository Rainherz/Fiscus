import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { createInMemoryInvestmentsRepository } from '@/features/investments/adapters/inMemoryInvestmentsRepository';
import type { DataFreshness } from '@/features/investments/domain/freshness';
import { RepositoryProvider } from '@/features/investments/RepositoryContext';
import { AppHeader } from '@/shared/ui/AppHeader';
import { BackHeader } from '@/shared/ui/BackHeader';

import { FreshnessBannerProvider } from './FreshnessBannerProvider';
import { StaleDataBanner } from './StaleDataBanner';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 2, fontScale: 1 })),
}));

const MESSAGE = 'Los datos podrían estar desactualizados. Última actualización: 24/10/2026 04:12.';
const NOW = new Date('2026-10-28T15:00:00Z');

describe('StaleDataBanner', () => {
  it('states that the data may be out of date, with the last update in Lima time', async () => {
    await render(<StaleDataBanner lastUpdatedAt="2026-10-24T09:12:00Z" onDismiss={() => {}} />);
    expect(screen.getByText(MESSAGE)).toBeOnTheScreen();
  });

  it('is ink on signal yellow over a 2px ink rule', async () => {
    await render(<StaleDataBanner lastUpdatedAt="2026-10-24T09:12:00Z" onDismiss={() => {}} />);
    expect(StyleSheet.flatten(screen.getByTestId('stale-banner').props.style)).toMatchObject({
      backgroundColor: '#FFC20E',
      borderBottomWidth: 2,
      borderBottomColor: '#111111',
    });
    expect(StyleSheet.flatten(screen.getByText(MESSAGE).props.style)).toMatchObject({ color: '#111111' });
  });

  it('can be dismissed with a labeled button', async () => {
    const onDismiss = jest.fn();
    await render(<StaleDataBanner lastUpdatedAt="2026-10-24T09:12:00Z" onDismiss={onDismiss} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar aviso' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

function setup(freshness: DataFreshness, ui: React.ReactNode) {
  const repository = createInMemoryInvestmentsRepository({ rows: [], lastRun: null, freshness });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository} isDemo={false}>
        <FreshnessBannerProvider now={() => NOW}>{ui}</FreshnessBannerProvider>
      </RepositoryProvider>
    </QueryClientProvider>,
  );
}

const STALE: DataFreshness = { ssiLastSuccessAt: '2026-10-24T09:12:00Z', openDataCheckedAt: null };
const FRESH: DataFreshness = { ssiLastSuccessAt: '2026-10-28T09:30:00Z', openDataCheckedAt: null };

/** A screen that can be swapped, like navigating from a tab to a pushed screen. */
function Screens() {
  const [pushed, setPushed] = useState(false);
  return pushed ? (
    <BackHeader onBack={() => setPushed(false)} title="DETALLE" />
  ) : (
    <>
      <AppHeader scopeLabel="Cusco" levelLabel="Todos los niveles" onPressScope={() => {}} />
      <Pressable accessibilityRole="button" onPress={() => setPushed(true)}>
        <Text>Abrir</Text>
      </Pressable>
    </>
  );
}

describe('FreshnessBannerProvider', () => {
  it('shows the banner under the app header when the SSI data is older than 48 h', async () => {
    await setup(STALE, <AppHeader scopeLabel="Cusco" levelLabel="Todos los niveles" onPressScope={() => {}} />);
    expect(await screen.findByText(MESSAGE)).toBeOnTheScreen();
  });

  it('shows it under the back header of pushed screens too', async () => {
    await setup(STALE, <BackHeader onBack={() => {}} />);
    expect(await screen.findByText(MESSAGE)).toBeOnTheScreen();
  });

  it('stays hidden while the data is fresh', async () => {
    await setup(FRESH, <BackHeader onBack={() => {}} />);
    await screen.findByRole('button', { name: 'Volver' });
    expect(screen.queryByText(/podrían estar desactualizados/)).toBeNull();
  });

  it('stays dismissed for the rest of the session, on every screen', async () => {
    await setup(STALE, <Screens />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ocultar aviso' }));
    expect(screen.queryByText(MESSAGE)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(await screen.findByText('DETALLE')).toBeOnTheScreen();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('headers render no banner outside the provider', async () => {
    await render(<BackHeader onBack={() => {}} />);
    expect(screen.queryByTestId('stale-banner')).toBeNull();
  });
});
