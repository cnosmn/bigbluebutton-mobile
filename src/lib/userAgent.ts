import { Platform } from 'react-native';

import BbbNative from '../../modules/bbb-native';

let cached: string | undefined;

// BigBlueButton 3.0's index.html runs a browser check before the client loads:
// /Version\/(\d+).*Safari/ < 14 => "Browser not supported". Android WebView's
// default user agent carries a legacy "Version/4.0" token next to
// "Chrome/<n> ... Safari", so the check misreads it as Safari 4. Dropping that
// token leaves a regular Chrome Mobile user agent.
export function meetingUserAgent(): string | undefined {
  if (Platform.OS !== 'android') return undefined;
  if (cached === undefined) {
    cached = BbbNative.getDefaultUserAgent()?.replace(/ Version\/[\d.]+/, '') ?? undefined;
  }
  return cached;
}
