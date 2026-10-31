import type { ExpoConfig } from 'expo/config';

import brand from './brand.json';

// All branding (name, package id, icons, colors) comes from brand.json.
// Edit that file, then regenerate native projects with `npm run prebuild`.
const config: ExpoConfig = {
  name: brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '0.1.0',
  orientation: 'default',
  icon: brand.icons.app,
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: brand.iosBundleIdentifier,
  },
  android: {
    package: brand.androidPackage,
    adaptiveIcon: {
      backgroundColor: brand.colors.primary,
      foregroundImage: brand.icons.androidForeground,
      monochromeImage: brand.icons.androidMonochrome,
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: brand.icons.favicon,
  },
  plugins: ['expo-router', 'expo-status-bar', 'expo-localization'],
  extra: {
    brandColors: brand.colors,
  },
};

export default config;
