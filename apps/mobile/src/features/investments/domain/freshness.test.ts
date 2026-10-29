import {
  isSsiStale,
  mapDataFreshnessRows,
  OPEN_DATA_FRESHNESS_SOURCE,
  SSI_FRESHNESS_SOURCE,
  STALE_AFTER_HOURS,
} from './freshness';

const NOW = new Date('2026-10-28T15:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe('isSsiStale', () => {
  it('flags the SSI data after 48 hours without a successful update', () => {
    expect(STALE_AFTER_HOURS).toBe(48);
    expect(isSsiStale({ ssiLastSuccessAt: hoursAgo(48.01), openDataCheckedAt: null }, NOW)).toBe(true);
  });

  it('keeps it fresh up to exactly 48 hours', () => {
    expect(isSsiStale({ ssiLastSuccessAt: hoursAgo(48), openDataCheckedAt: null }, NOW)).toBe(false);
    expect(isSsiStale({ ssiLastSuccessAt: hoursAgo(1), openDataCheckedAt: null }, NOW)).toBe(false);
  });

  it('ignores the open data, which MEF refreshes rarely', () => {
    expect(isSsiStale({ ssiLastSuccessAt: hoursAgo(2), openDataCheckedAt: hoursAgo(500) }, NOW)).toBe(false);
  });

  it('says nothing without a usable date', () => {
    expect(isSsiStale({ ssiLastSuccessAt: null, openDataCheckedAt: null }, NOW)).toBe(false);
    expect(isSsiStale({ ssiLastSuccessAt: 'garbage', openDataCheckedAt: null }, NOW)).toBe(false);
  });

  it('accepts another threshold', () => {
    expect(isSsiStale({ ssiLastSuccessAt: hoursAgo(13), openDataCheckedAt: null }, NOW, 12)).toBe(true);
  });
});

describe('mapDataFreshnessRows', () => {
  it('takes the SSI last success and the open-data last check from data_freshness', () => {
    expect(
      mapDataFreshnessRows([
        { source: SSI_FRESHNESS_SOURCE, last_success_at: 'a', last_checked_at: 'b' },
        { source: OPEN_DATA_FRESHNESS_SOURCE, last_success_at: 'c', last_checked_at: 'd' },
      ]),
    ).toEqual({ ssiLastSuccessAt: 'a', openDataCheckedAt: 'd' });
  });

  it('leaves missing sources unknown', () => {
    expect(mapDataFreshnessRows([])).toEqual({ ssiLastSuccessAt: null, openDataCheckedAt: null });
  });
});
