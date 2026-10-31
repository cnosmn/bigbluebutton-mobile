# Known issues and next steps

Tested so far on a Redmi Note 11 (Snapdragon 680, Android 12) against
BigBlueButton 3.0.16 with bbb-webrtc-sfu (mediasoup) and Greenlight.

## Known issues

### Platform support

- **No screen sharing on iOS.** The native module's iOS side is a stub. See
  [ios-build.md](ios-build.md) for what is missing.
- **Android 13+ notification permission is untested on a real device.** The app
  asks for it right before the first screen share. On Android 12 and earlier
  the dialog never appears.
- **ARM only.** Release APKs contain `armeabi-v7a` and `arm64-v8a` libraries;
  x86 devices (emulators, a few Chromebooks and old Intel tablets) are not
  supported. Add `x86_64` in `plugins/withReleaseSigning.js` if needed.
- **Old WebView versions.** On older devices, "Android System WebView" must be
  updated from the Play Store for BigBlueButton's web client to work.

### Screen sharing quality

- **Software VP8 on many devices.** The server accepts VP8 only for screen
  sharing (`codec_video_content: VP8`), and many recent Qualcomm chips have no
  VP8 hardware encoder. To keep the encoder from becoming CPU-bound, capture is
  capped at 1280 px on the long side and 15 fps. Quality depends on the CPU;
  stronger tablets do better.
  - Possible improvement: use 1920 px when a VP8 hardware encoder is available.
  - Possible improvement (server side): switching `codec_video_content` to
    H.264 would allow hardware encoding on almost all Android devices, but it
    also affects browser screen sharing and recordings.
- **Inflated packet loss in stats.** `packetsLost` reported back by the SFU keeps
  growing even when very little media is sent, likely because padding used for
  bandwidth probing is counted as lost. No visible effect has been observed.

### BigBlueButton integration

- **Browser check workaround.** BigBlueButton 3.0's `index.html` rejects Android
  WebView as "Safari 4" (it matches `Version/4.0 ... Safari`). The app removes
  the `Version/x` token from its user agent. Worth reporting upstream.
- **Fragile call-type detection.** BigBlueButton's mobile bridge decides which
  WebRTC connection goes to the app by looking for `startScreensharing` in a
  JavaScript stack trace. A BigBlueButton update that renames or bundles this
  differently would silently break screen sharing. Re-test after every server
  upgrade.
- **Cancelled consent leaves the share button idle.** If the user dismisses
  Android's screen capture dialog, the web client only logs the failure; the
  button does nothing until pressed again. This is in BigBlueButton's bridge
  code (`getDisplayMedia` never settles on failure).
- **Leaving with the back button.** Leaving a class through the app's back
  button returns to the portal without BigBlueButton's own "leave" call, so
  other participants may still see the user for a few seconds until the server
  notices the disconnect.
- **Phone layout.** BigBlueButton's action bar does not fit phone screens; on
  screens whose shortest side is under 600 CSS px the class page is scaled down
  to about 480 CSS px wide, so text is smaller on phones. Tablets are not
  affected.

### Networking

- **No TURN server configured** on the test server. Networks that block UDP
  (some school and corporate networks) cannot carry audio, video or screen
  sharing, in the browser or the app. The app uses whatever STUN/TURN servers
  BigBlueButton provides, so adding a TURN server (for example coturn) needs no
  app change.

### Lifecycle

- **Sharing cannot survive process death.** Android's capture consent is single
  use; if the system kills the app, sharing stops and must be started again.
  Locking the screen and switching apps were tested and keep sharing.

## Next steps

1. Test on the teachers' actual tablets (encoder type, CPU limit, Android 13+
   notification permission) using the debug stats logged by `BbbScreenShare`.
2. Adaptive capture size: 1920 px when a VP8 hardware encoder exists.
3. Report the browser check issue to BigBlueButton.
4. iOS: port the Broadcast Upload Extension, add the config plugin and
   Info.plist keys, then build through EAS or GitHub Actions
   ([ios-build.md](ios-build.md)).
5. Replace the placeholder icons with real artwork (`assets/brand/`).
6. Optional: deep links (`derslik://` and Android App Links, which need an
   `assetlinks.json` on the server) if join links are ever shared directly.
7. Optional: Play Store release (AAB, store listing, privacy policy).
