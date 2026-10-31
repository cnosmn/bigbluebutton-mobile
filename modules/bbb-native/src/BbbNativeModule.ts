import { NativeModule, requireNativeModule } from 'expo';

export type IceCandidateInit = {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
};

export type BbbNativeEvents = {
  onScreenShareLocalIceCandidate(candidate: IceCandidateInit): void;
  onScreenShareSignalingStateChange(event: { state: string }): void;
  onScreenShareConnectionStateChange(event: { state: string }): void;
  /** Sharing ended on the device side (system stop, notification, lock, failure). */
  onScreenShareStopped(event: { reason: string }): void;
};

declare class BbbNativeModule extends NativeModule<BbbNativeEvents> {
  /** The WebView's built-in user agent (Android); null where not applicable. */
  getDefaultUserAgent(): string | null;

  /** Keeps Android's autofill popup from closing the keyboard in the WebView. */
  disableAutofill(): Promise<void>;

  /** Asks the user for screen capture consent; resolves when capturing may start. */
  initializeScreenShare(): Promise<void>;
  /** Takes BBB's STUN/TURN dictionary as JSON; resolves with the SDP offer. */
  createScreenShareOffer(stunTurnJson: string): Promise<string>;
  setScreenShareRemoteSdp(sdp: string): Promise<void>;
  /** Takes an RTCIceCandidateInit as JSON. */
  addScreenShareRemoteIceCandidate(candidateJson: string): Promise<void>;
  stopScreenShare(): Promise<void>;
}

export default requireNativeModule<BbbNativeModule>('BbbNative');
