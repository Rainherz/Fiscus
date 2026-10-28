/** A public link to a page of the web app, plus the same address without the scheme for display. */
export interface SiteLink {
  url: string;
  label: string;
}

/** Normalizes the raw EXPO_PUBLIC_SITE_URL: an http(s) URL without trailing slash, or null. */
export function resolveSiteUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, '');
  if (!value || !/^https?:\/\/[^/\s]+/i.test(value)) return null;
  return value;
}

/** EXPO_PUBLIC_* must be read with static property access so Expo can inline it. */
export function siteUrlFromEnv(): string | null {
  return resolveSiteUrl(process.env.EXPO_PUBLIC_SITE_URL);
}

/** Link to an investment's detail page on the published site; null when no site is configured. */
export function investmentLink(siteUrl: string | null, cui: string): SiteLink | null {
  if (!siteUrl) return null;
  const url = `${siteUrl}/investment/${encodeURIComponent(cui)}`;
  return { url, label: url.replace(/^https?:\/\//i, '') };
}
