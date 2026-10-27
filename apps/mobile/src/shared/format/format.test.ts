import {
  formatDate,
  formatInteger,
  formatMonth,
  formatProgress,
  formatSignedPercent,
  formatSignedSoles,
  formatSoles,
  formatSolesCompact,
  formatYear,
  formatYears,
  yearsSince,
} from './index';

describe('formatSoles', () => {
  it('shows whole millions with thousands separators from S/ 10 M up', () => {
    expect(formatSoles(5_147_912_126)).toBe('S/ 5,148 M');
    expect(formatSoles(1_338_419_640)).toBe('S/ 1,338 M');
    expect(formatSoles(440_442_502)).toBe('S/ 440 M');
    expect(formatSoles(10_000_000)).toBe('S/ 10 M');
  });

  it('shows one decimal between S/ 1 M and S/ 10 M', () => {
    expect(formatSoles(2_460_000)).toBe('S/ 2.5 M');
    expect(formatSoles(1_000_000)).toBe('S/ 1.0 M');
  });

  it('shows the full amount below S/ 1 M', () => {
    expect(formatSoles(845_300.4)).toBe('S/ 845,300');
    expect(formatSoles(0)).toBe('S/ 0');
  });

  it('keeps the sign of negative amounts', () => {
    expect(formatSoles(-12_400_000)).toBe('-S/ 12 M');
  });

  it('returns a dash when the amount is unknown', () => {
    expect(formatSoles(null)).toBe('—');
  });
});

describe('formatSignedSoles', () => {
  it('prefixes increases with +', () => {
    expect(formatSignedSoles(440_442_502)).toBe('+S/ 440 M');
  });

  it('prefixes decreases with -', () => {
    expect(formatSignedSoles(-1_970)).toBe('-S/ 1,970');
  });

  it('shows zero without sign and unknown as a dash', () => {
    expect(formatSignedSoles(0)).toBe('S/ 0');
    expect(formatSignedSoles(null)).toBe('—');
  });
});

describe('formatSignedPercent', () => {
  it('rounds to a whole percentage with sign and no space', () => {
    expect(formatSignedPercent(284.63)).toBe('+285%');
    expect(formatSignedPercent(-10.2)).toBe('-10%');
    expect(formatSignedPercent(0.2)).toBe('0%');
  });

  it('uses thousands separators for large percentages', () => {
    expect(formatSignedPercent(12_345.6)).toBe('+12,346%');
  });

  it('returns a dash when unknown', () => {
    expect(formatSignedPercent(null)).toBe('—');
  });
});

describe('formatProgress', () => {
  it('turns a ratio into a whole percentage with a space', () => {
    expect(formatProgress(0.18)).toBe('18 %');
    expect(formatProgress(0.894)).toBe('89 %');
  });

  it('does not cap ratios above 1', () => {
    expect(formatProgress(1.05)).toBe('105 %');
  });

  it('returns a dash when unknown', () => {
    expect(formatProgress(null)).toBe('—');
  });
});

describe('yearsSince', () => {
  const now = new Date('2026-10-26T12:00:00Z');

  it('counts full years elapsed', () => {
    expect(yearsSince('2008-01-10', now)).toBe(18);
    expect(yearsSince('2016-10-27', now)).toBe(9);
    expect(yearsSince('2016-10-26', now)).toBe(10);
  });

  it('is null when the date is unknown or invalid', () => {
    expect(yearsSince(null, now)).toBeNull();
    expect(yearsSince('not-a-date', now)).toBeNull();
  });
});

describe('formatYears', () => {
  it('pluralizes in Spanish', () => {
    expect(formatYears(18)).toBe('18 años');
    expect(formatYears(1)).toBe('1 año');
  });

  it('describes less than a year', () => {
    expect(formatYears(0)).toBe('Menos de 1 año');
  });

  it('returns a dash when unknown', () => {
    expect(formatYears(null)).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats ISO dates as dd/mm/yyyy', () => {
    expect(formatDate('2008-01-10')).toBe('10/01/2008');
    expect(formatDate('2026-10-26T05:30:00Z')).toBe('26/10/2026');
  });

  it('returns a dash when unknown or invalid', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('garbage')).toBe('—');
  });
});

describe('formatMonth', () => {
  it('formats a month in Spanish', () => {
    expect(formatMonth('2019-03-01')).toBe('marzo 2019');
  });

  it('returns a dash when unknown', () => {
    expect(formatMonth(null)).toBe('—');
  });
});

describe('formatInteger', () => {
  it('adds thousands separators', () => {
    expect(formatInteger(1_234_567)).toBe('1,234,567');
    expect(formatInteger(42)).toBe('42');
  });

  it('returns a dash when unknown', () => {
    expect(formatInteger(null)).toBe('—');
  });
});

describe('formatYear', () => {
  it('extracts the calendar year', () => {
    expect(formatYear('2008-01-10')).toBe('2008');
    expect(formatYear(null)).toBe('—');
  });
});

describe('formatSolesCompact', () => {
  it('keeps one decimal for millions below S/ 100 M', () => {
    expect(formatSolesCompact(26_754_508.49)).toBe('S/ 26.8 M');
    expect(formatSolesCompact(1_000_000)).toBe('S/ 1.0 M');
  });

  it('shows whole millions from S/ 100 M up', () => {
    expect(formatSolesCompact(440_442_502)).toBe('S/ 440 M');
    expect(formatSolesCompact(5_147_912_126)).toBe('S/ 5,148 M');
  });

  it('shows thousands as "mil" below S/ 1 M', () => {
    expect(formatSolesCompact(950_000)).toBe('S/ 950 mil');
    expect(formatSolesCompact(1_499)).toBe('S/ 1 mil');
  });

  it('moves to millions instead of showing "1,000 mil"', () => {
    expect(formatSolesCompact(999_700)).toBe('S/ 1.0 M');
  });

  it('shows small amounts in full, keeps the sign and dashes unknowns', () => {
    expect(formatSolesCompact(845)).toBe('S/ 845');
    expect(formatSolesCompact(-950_000)).toBe('-S/ 950 mil');
    expect(formatSolesCompact(null)).toBe('—');
  });
});
