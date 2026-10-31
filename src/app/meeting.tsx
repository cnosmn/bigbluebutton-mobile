import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
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
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { handleBridgeMessage } from '../bridge/handler';
import { t } from '../i18n';
import { meetingApplicationName, meetingUserAgent } from '../lib/userAgent';
import { colors } from '../theme';

// Schemes the meeting page itself may load; anything else (mailto:, tel:,
// intent:, ...) is handed to the OS.
const IN_APP_SCHEMES = ['http:', 'https:', 'about:', 'blob:', 'data:'];

function isInAppUrl(url: string): boolean {
  return IN_APP_SCHEMES.some((scheme) => url.startsWith(scheme));
}

export default function Meeting() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Changing the key remounts the WebView, e.g. after its renderer crashed.
  const [webViewKey, setWebViewKey] = useState(0);
  const webViewRef = useRef<ComponentRef<typeof WebView>>(null);

  // A class can run for a long time without touch input.
  useKeepAwake();

  const confirmLeave = useCallback(() => {
    Alert.alert(t.meeting.leaveTitle, t.meeting.leaveMessage, [
      { text: t.meeting.cancel, style: 'cancel' },
      { text: t.meeting.leave, style: 'destructive', onPress: () => router.back() },
    ]);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmLeave();
      return true;
    });
    return () => subscription.remove();
  }, [confirmLeave]);

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

  if (!url) {
    router.back();
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t.meeting.loadError}</Text>
          <Pressable onPress={retry} style={styles.button}>
            <Text style={styles.buttonText}>{t.meeting.retry}</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.linkButton}>
            <Text style={styles.linkText}>{t.meeting.back}</Text>
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
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
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
  linkButton: {
    marginTop: 12,
    padding: 8,
  },
  linkText: {
    color: colors.muted,
  },
});
