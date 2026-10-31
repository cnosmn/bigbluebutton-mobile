import type { RefObject } from 'react';

// Protocol defined by BigBlueButton's web client
// (bigbluebutton-html5/imports/ui/services/mobile-app/index.js):
//   page -> app: window.ReactNativeWebView.postMessage({ sequence, method, arguments })
//   app -> page: window.nativeMethodCallResult(sequence, ok, resultOrError)
// It is only active when the user agent contains "BigBlueButton-Tablet".

// The part of the WebView instance the bridge needs.
export type WebViewHandle = {
  injectJavaScript(script: string): void;
};

type BridgeCall = {
  sequence: number;
  method: string;
  arguments?: unknown[];
};

type MethodImpl = (args: unknown[]) => Promise<unknown>;

const methods: Record<string, MethodImpl> = {};

function isBridgeCall(value: unknown): value is BridgeCall {
  const call = value as BridgeCall;
  return typeof call?.sequence === 'number' && typeof call?.method === 'string';
}

function reply(webView: RefObject<WebViewHandle | null>, sequence: number, ok: boolean, payload: unknown) {
  const args = payload === undefined ? '' : `, ${JSON.stringify(payload)}`;
  webView.current?.injectJavaScript(
    `window.nativeMethodCallResult && window.nativeMethodCallResult(${sequence}, ${ok}${args}); true;`,
  );
}

export function handleBridgeMessage(webView: RefObject<WebViewHandle | null>, raw: string) {
  let call: unknown;
  try {
    call = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isBridgeCall(call)) return;

  const { sequence, method } = call;
  const args = call.arguments ?? [];
  console.log(`[bridge] <- #${sequence} ${method}`, JSON.stringify(args).slice(0, 300));

  const impl = methods[method];
  if (!impl) {
    console.warn(`[bridge] #${sequence} ${method} is not implemented yet`);
    reply(webView, sequence, false, `${method} is not implemented`);
    return;
  }

  impl(args).then(
    (result) => reply(webView, sequence, true, result),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[bridge] #${sequence} ${method} failed: ${message}`);
      reply(webView, sequence, false, message);
    },
  );
}
