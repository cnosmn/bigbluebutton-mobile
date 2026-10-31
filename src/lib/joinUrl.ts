// Accepts what a teacher would paste (with or without scheme) and returns a
// normalized https URL, or null when it is not something we should open.
export function normalizeJoinUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  // Camera/microphone access in the WebView requires a secure context.
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;

  return url.toString();
}

export const defaultServerUrl = process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ?? '';
