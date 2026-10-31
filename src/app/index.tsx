import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { defaultServerUrl, normalizeJoinUrl } from '../lib/joinUrl';
import { loadLastJoinUrl, saveLastJoinUrl } from '../lib/storage';
import { colors } from '../theme';

export default function Home() {
  const [url, setUrl] = useState(defaultServerUrl);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLastJoinUrl().then((last) => {
      if (last) setUrl(last);
    });
  }, []);

  const join = () => {
    const normalized = normalizeJoinUrl(url);
    if (!normalized) {
      setError(true);
      return;
    }
    setError(false);
    saveLastJoinUrl(normalized);
    router.push({ pathname: '/meeting', params: { url: normalized } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior="padding" style={styles.inner}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Constants.expoConfig?.name}</Text>
        </View>
        <Text style={styles.subtitle}>{t.home.subtitle}</Text>

        <Text style={styles.label}>{t.home.urlLabel}</Text>
        <TextInput
          value={url}
          onChangeText={(value) => {
            setUrl(value);
            setError(false);
          }}
          onSubmitEditing={join}
          placeholder={t.home.urlPlaceholder}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectTextOnFocus
          style={[styles.input, error && styles.inputError]}
        />
        {error && <Text style={styles.error}>{t.home.invalidUrl}</Text>}

        <Pressable
          onPress={join}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{t.home.join}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    marginTop: 6,
  },
  button: {
    marginTop: 20,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
