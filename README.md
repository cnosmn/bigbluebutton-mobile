# BBB Mobile

An open source mobile app for joining BigBlueButton 3.0 classes from a tablet and **sharing the tablet's screen**.

Mobile browsers (Chrome on Android, Safari on iOS) do not support `getDisplayMedia`, so a tablet cannot share its screen from the browser. BBB Mobile opens BigBlueButton in a WebView, captures the screen natively and sends it straight to BigBlueButton's media server (bbb-webrtc-sfu). It does this through the bridge that BigBlueButton's web client provides for mobile apps.

> **Status:** early development. Android only for now; iOS support will follow.

The app UI is available in English and Turkish (picked from the device language).

- [Known issues and next steps](docs/known-issues.md)
- [Building for iOS without a Mac](docs/ios-build.md)

## Requirements

| Tool | Version |
|---|---|
| Node.js | 20.19+ (tested with 22 LTS) |
| JDK | 17 or 21 |
| Android SDK | Platform 36, Build-Tools 36, NDK 27.1 (Gradle downloads anything missing) |
| Device | Android 7.0 (API 24) or later, with USB debugging enabled |

Tech stack: Expo SDK 58, React Native 0.88, TypeScript, Expo Router.

## Setup and running

```bash
npm install
cp .env.example .env.local   # EXPO_PUBLIC_PORTAL_URL: the site the app opens on launch
npm run android              # generates android/, builds, installs on the connected device and starts Metro
```

On launch the app opens `EXPO_PUBLIC_PORTAL_URL` directly: the site where teachers log in and start their rooms (for example Greenlight). The address is embedded at build time; after changing it, restart Metro with `npx expo start --clear`.

The `android/` and `ios/` directories are **generated** and not committed (Expo Continuous Native Generation). Do not edit them by hand: native settings live in `app.config.ts`, `brand.json` and config plugins. To regenerate after a configuration change:

```bash
npm run prebuild
```

Use `adb devices` to list connected devices.

## Release APK

Release builds are signed with the key described in `keystore.properties` at the project root. Neither that file nor the key is committed. Without the file, release builds are signed with the debug key.

1. Create a key (once):

   ```bash
   mkdir -p credentials
   keytool -genkeypair -v -storetype PKCS12 -keystore credentials/bbb-mobile-release.jks \
     -alias bbb-mobile -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Create `keystore.properties` at the project root:

   ```properties
   storeFile=credentials/bbb-mobile-release.jks
   storePassword=...
   keyAlias=bbb-mobile
   keyPassword=...
   ```

3. Build:

   ```bash
   npm run build:apk      # output: dist/bbb-mobile-<version>.apk (ARM only: armeabi-v7a, arm64-v8a)
   ```

> ⚠️ Back up the key and its passwords outside the repository. If the key is lost, new versions cannot be installed over existing ones and users have to uninstall and reinstall the app. For the Play Store, build an AAB with `./gradlew bundleRelease`.

Before each release, increase `version` and `android.versionCode` in `app.config.ts`.

## Branding

The app name, package name (`applicationId`), URL scheme, colors and icon paths live in a single file: [`brand.json`](brand.json).

1. Edit `brand.json`.
2. Run `npm run icons` to regenerate the placeholder icons from the colors (requires Pillow). If you have real artwork, put the PNG files under `assets/brand/` instead.
3. `npm run prebuild && npm run android`

## License

This project is licensed under the **GNU Lesser General Public License v3.0** (LGPL-3.0-only). The license texts are in [`COPYING.LESSER`](COPYING.LESSER) (LGPL-3.0) and [`COPYING`](COPYING) (GPL-3.0, which the LGPL builds on).

In practice, LGPL-3.0 means:

- When you distribute the app (as an APK, AAB or IPA), you must give users access to this project's **source code**. A link to the repository is enough.
- Changes you make to this project's files must also be released under LGPL-3.0.
- License and copyright notices must be kept.

Related projects:

- [BigBlueButton](https://github.com/bigbluebutton/bigbluebutton) (LGPL-3.0): the app implements the WebView ↔ native bridge protocol defined in `bigbluebutton-html5/imports/ui/services/mobile-app`.
- [`bigbluebutton-tablet-sdk`](https://www.npmjs.com/package/bigbluebutton-tablet-sdk) (npm 0.1.35): its `package.json` says LGPL-3.0 while its `LICENSE` file says MIT. Any code taken from it is marked in the file header.
- [`bigbluebutton-mobile`](https://github.com/bigbluebutton/bigbluebutton-mobile): has no license file. **No code was copied** from it; it was only studied as an architectural reference.

"BigBlueButton" is a trademark of BigBlueButton Inc. This project is not affiliated with BigBlueButton Inc.
