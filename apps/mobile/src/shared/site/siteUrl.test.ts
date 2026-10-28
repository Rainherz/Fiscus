import { investmentLink, resolveSiteUrl } from './siteUrl';

describe('resolveSiteUrl', () => {
  it('keeps an http(s) URL without its trailing slash', () => {
    expect(resolveSiteUrl('https://rainherz.github.io/Fiscus/')).toBe('https://rainherz.github.io/Fiscus');
    expect(resolveSiteUrl('  http://localhost:8080 ')).toBe('http://localhost:8080');
  });

  it('is null when unset, blank or not a web URL', () => {
    expect(resolveSiteUrl(undefined)).toBeNull();
    expect(resolveSiteUrl('   ')).toBeNull();
    expect(resolveSiteUrl('rainherz.github.io/Fiscus')).toBeNull();
    expect(resolveSiteUrl('ftp://example.com')).toBeNull();
  });
});

describe('investmentLink', () => {
  it('builds the project URL and a short label without the scheme', () => {
    expect(investmentLink('https://rainherz.github.io/Fiscus', '2088142')).toEqual({
      url: 'https://rainherz.github.io/Fiscus/investment/2088142',
      label: 'rainherz.github.io/Fiscus/investment/2088142',
    });
  });

  it('encodes the CUI as a path segment', () => {
    expect(investmentLink('https://example.com', 'a b/c')?.url).toBe('https://example.com/investment/a%20b%2Fc');
  });

  it('is null without a site URL', () => {
    expect(investmentLink(null, '2088142')).toBeNull();
  });
});
