import type { ExpoConfig } from 'expo/config';

import brand from './brand.json';

// All branding (name, package id, icons, colors) comes from brand.json.
// Edit that file, then regenerate native projects with `npm run prebuild`.
const config: ExpoConfig = {
  name: brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '0.2.1',
  orientation: 'default',
  icon: brand.icons.app,
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: brand.iosBundleIdentifier,
  },
  android: {
    package: brand.androidPackage,
    versionCode: 5,
    // Requested at runtime when the meeting page asks for microphone/camera.
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
    ],
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
  plugins: ['expo-router', 'expo-status-bar', 'expo-localization', './plugins/withReleaseSigning'],
  extra: {
    brandColors: brand.colors,
  },
};

export default config;
