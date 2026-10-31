import { Platform } from 'react-native';

import BbbNative from '../../modules/bbb-native';

// Makes BigBlueButton's web client enable its mobile app bridge
// (browserInfo.isTabletApp), which routes screen sharing to native code.
const TABLET_APP_TOKEN = 'BigBlueButton-Tablet';

let cached: string | undefined;

// BigBlueButton 3.0's index.html runs a browser check before the client loads:
// /Version\/(\d+).*Safari/ < 14 => "Browser not supported". Android WebView's
// default user agent carries a legacy "Version/4.0" token next to
// "Chrome/<n> ... Safari", so the check misreads it as Safari 4. Dropping that
// token leaves a regular Chrome Mobile user agent.
function androidUserAgent(): string | undefined {
  const base = BbbNative.getDefaultUserAgent()?.replace(/ Version\/[\d.]+/, '');
  return base ? `${base} ${TABLET_APP_TOKEN}` : undefined;
}

export function meetingUserAgent(): string | undefined {
  if (Platform.OS !== 'android') return undefined;
  if (cached === undefined) cached = androidUserAgent();
  return cached;
}

export function meetingApplicationName(): string | undefined {
  // iOS keeps its default user agent and only appends the token.
  return Platform.OS === 'ios' ? TABLET_APP_TOKEN : undefined;
}
