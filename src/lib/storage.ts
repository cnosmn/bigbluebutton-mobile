import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_JOIN_URL = 'lastJoinUrl';

export async function loadLastJoinUrl(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_JOIN_URL);
  } catch {
    return null;
  }
}

export async function saveLastJoinUrl(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_JOIN_URL, url);
  } catch {
    // Remembering the URL is a convenience; ignore storage failures.
  }
}
