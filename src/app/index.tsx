import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

import BbbNative from '../../modules/bbb-native';
import { handleBridgeMessage } from '../bridge/handler';
import { attachScreenShareEvents } from '../bridge/screenShare';
import { t } from '../i18n';
import { isClassUrl, portalUrl } from '../lib/config';
import { meetingApplicationName, meetingUserAgent } from '../lib/userAgent';
import { colors } from '../theme';

const KEEP_AWAKE_TAG = 'class';

// Schemes the page itself may load; anything else (mailto:, tel:, intent:, ...)
// is handed to the OS.
const IN_APP_SCHEMES = ['http:', 'https:', 'about:', 'blob:', 'data:'];

// BigBlueButton's action bar does not fit a phone's ~390 CSS px width. On
// phone-sized screens (shortest side < 600), render the class page at ~480
// CSS px and let the viewport scale it down. Tablets are left untouched.
const FIT_CLASS_TO_PHONE = `
  (function () {
    if (location.pathname.indexOf('/html5client/') === -1) return;
    var shortest = Math.min(screen.width, screen.height);
    if (shortest >= 600) return;
    var scale = Math.max(0.7, shortest / 480).toFixed(2);
    var meta = document.querySelector('meta[name=viewport]');
    if (!meta) return;
    meta.content = 'width=device-width,initial-scale=' + scale + ',maximum-scale=' + scale +
      ',user-scalable=no,viewport-fit=cover';
  })();
  true;
`;

function isInAppUrl(url: string): boolean {
  return IN_APP_SCHEMES.some((scheme) => url.startsWith(scheme));
}

export default function Portal() {
  if (!portalUrl) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{t.portal.notConfigured}</Text>
      </SafeAreaView>
    );
  }
  return <PortalWebView url={portalUrl} />;
}

function PortalWebView({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Changing the key remounts the WebView, e.g. after its renderer crashed.
  const [webViewKey, setWebViewKey] = useState(0);
  const [navigation, setNavigation] = useState({ url, canGoBack: false });
  const webViewRef = useRef<ComponentRef<typeof WebView>>(null);
  const inClass = isClassUrl(navigation.url);

  // Also stops any screen share when the app is closed.
  useEffect(() => attachScreenShareEvents(webViewRef), []);

  useEffect(() => {
    BbbNative.disableAutofill().catch(() => {});
  }, []);

  // A class can run for a long time without touch input. Outside of a class
  // there is nothing to share, so make sure capture is not left running.
  useEffect(() => {
    if (inClass) {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }
    BbbNative.stopScreenShare().catch(() => {});
  }, [inClass]);

  const leaveClass = useCallback(() => {
    Alert.alert(t.portal.leaveTitle, t.portal.leaveMessage, [
      { text: t.portal.cancel, style: 'cancel' },
      {
        text: t.portal.leave,
        style: 'destructive',
        onPress: () =>
          webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`),
      },
    ]);
  }, [url]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (inClass) {
        leaveClass();
        return true;
      }
      if (navigation.canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false; // let Android close the app
    });
    return () => subscription.remove();
  }, [inClass, navigation.canGoBack, leaveClass]);

  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    setNavigation({ url: state.url, canGoBack: state.canGoBack });
  }, []);

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (isInAppUrl(request.url)) return true;
    Linking.openURL(request.url).catch(() => {});
    return false;
  }, []);

  const retry = () => {
    setFailed(false);
    setLoading(true);
    setWebViewKey((key) => key + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t.portal.loadError}</Text>
          <Pressable onPress={retry} style={styles.button}>
            <Text style={styles.buttonText}>{t.portal.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          userAgent={meetingUserAgent()}
          applicationNameForUserAgent={meetingApplicationName()}
          onMessage={(event) => handleBridgeMessage(webViewRef, event.nativeEvent.data)}
          onNavigationStateChange={onNavigationStateChange}
          injectedJavaScript={FIT_CLASS_TO_PHONE}
          domStorageEnabled
          thirdPartyCookiesEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          webviewDebuggingEnabled={__DEV__}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          // target="_blank" links (chat links, exports) open in the browser.
          onOpenWindow={(event) => Linking.openURL(event.nativeEvent.targetUrl).catch(() => {})}
          onLoadEnd={() => setLoading(false)}
          onError={(event) => {
            const { code, description, url: failedUrl } = event.nativeEvent;
            console.warn(`WebView load failed (${code}) ${description}: ${failedUrl}`);
            setFailed(true);
          }}
          onRenderProcessGone={() => setFailed(true)}
        />
      )}
      {loading && !failed && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.onPrimary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.onPrimary,
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
