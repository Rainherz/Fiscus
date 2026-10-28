import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. EXPO_BASE_URL sets the web sub-path the export is hosted under (GitHub Pages
 * serves the site at /Fiscus/); unset, the app lives at the root, as in local development.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const raw = process.env.EXPO_BASE_URL?.trim().replace(/^\/+|\/+$/g, '');
  const baseUrl = raw ? `/${raw}` : undefined;
  return {
    ...(config as ExpoConfig),
    experiments: { ...config.experiments, ...(baseUrl ? { baseUrl } : {}) },
  };
};
