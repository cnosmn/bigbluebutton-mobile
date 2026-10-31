// The site teachers log in to and start their rooms from. Set it in
// .env.local (see .env.example); it is inlined at build time.
function readPortalUrl(): string | null {
  const value = process.env.EXPO_PUBLIC_PORTAL_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    // Camera/microphone access in the WebView requires a secure context.
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const portalUrl = readPortalUrl();

// BigBlueButton's HTML5 client is served under /html5client/.
export function isClassUrl(url: string): boolean {
  return url.includes('/html5client/');
}
