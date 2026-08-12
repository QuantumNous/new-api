export type WebSocketLike = {
  readyState: number;
  send(data: string | Uint8Array | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
};

export type WebSocketConstructor = new (
  url: string | URL,
  protocols?: string | string[],
  options?: {
    headers?: Record<string, string | undefined>;
  },
) => WebSocketLike;

export function getWebSocketConstructor(
  webSocket: WebSocketConstructor | undefined,
): WebSocketConstructor {
  const WebSocketConstructor =
    webSocket ?? (globalThis.WebSocket as unknown as WebSocketConstructor);

  if (WebSocketConstructor == null) {
    throw new Error('No WebSocket implementation available.');
  }

  return WebSocketConstructor;
}

/**
 * Converts an http(s) URL to the corresponding ws(s) URL.
 */
export function toWebSocketUrl(url: string | URL): URL {
  const wsUrl = new URL(url);
  if (wsUrl.protocol === 'http:') {
    wsUrl.protocol = 'ws:';
  } else if (wsUrl.protocol === 'https:') {
    wsUrl.protocol = 'wss:';
  }
  return wsUrl;
}

const textDecoder = new TextDecoder();

/**
 * Reads WebSocket message data as text, handling string, binary,
 * and Blob payloads.
 */
export async function readWebSocketMessageText(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return textDecoder.decode(data);
  if (ArrayBuffer.isView(data)) {
    return textDecoder.decode(data);
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.text();
  }
  return String(data);
}
