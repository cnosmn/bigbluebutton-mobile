import type { RefObject } from 'react';

import BbbNative from '../../modules/bbb-native';
import type { WebViewHandle } from './handler';

type Description = { sdp: string };

// Bridge methods the web client calls while publishing a screen share,
// in this order: initialize -> createOffer -> setRemoteSDP -> addRemoteIceCandidate*.
export const screenShareMethods: Record<string, (args: unknown[]) => Promise<unknown>> = {
  initializeScreenShare: () => BbbNative.initializeScreenShare(),
  createScreenShareOffer: ([stunTurn]) => BbbNative.createScreenShareOffer(JSON.stringify(stunTurn ?? {})),
  setScreenShareRemoteSDP: ([description]) =>
    BbbNative.setScreenShareRemoteSdp((description as Description).sdp),
  addRemoteIceCandidate: ([candidate]) =>
    BbbNative.addScreenShareRemoteIceCandidate(JSON.stringify(candidate)),
  stopScreenShare: () => BbbNative.stopScreenShare(),
};

function callPage(webView: RefObject<WebViewHandle | null>, callback: string, arg?: unknown) {
  const args = arg === undefined ? '' : JSON.stringify(arg);
  webView.current?.injectJavaScript(`window.${callback} && window.${callback}(${args}); true;`);
}

/** Forwards native screen share events into the page; returns a cleanup function. */
export function attachScreenShareEvents(webView: RefObject<WebViewHandle | null>): () => void {
  const subscriptions = [
    BbbNative.addListener('onScreenShareLocalIceCandidate', (candidate) =>
      callPage(webView, 'bbbMobileScreenShareIceCandidateCallback', { candidate }),
    ),
    BbbNative.addListener('onScreenShareSignalingStateChange', ({ state }) =>
      callPage(webView, 'bbbMobileScreenShareSignalingStateChangeCallback', state),
    ),
    BbbNative.addListener('onScreenShareConnectionStateChange', ({ state }) =>
      console.log(`[bridge] screen share connection: ${state}`),
    ),
    // Clicks BBB's own "stop sharing" button so its UI and the SFU are updated.
    BbbNative.addListener('onScreenShareStopped', ({ reason }) => {
      console.log(`[bridge] screen share stopped on device: ${reason}`);
      callPage(webView, 'bbbMobileScreenShareBroadcastFinishedCallback');
    }),
  ];

  return () => {
    subscriptions.forEach((subscription) => subscription.remove());
    BbbNative.stopScreenShare().catch(() => {});
  };
}
