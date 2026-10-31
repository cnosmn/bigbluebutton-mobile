import { NativeModule, requireNativeModule } from 'expo';

declare class BbbNativeModule extends NativeModule<{}> {
  /** The WebView's built-in user agent (Android); null where not applicable. */
  getDefaultUserAgent(): string | null;
}

export default requireNativeModule<BbbNativeModule>('BbbNative');
