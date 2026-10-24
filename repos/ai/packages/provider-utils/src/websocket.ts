import { delay } from './delay';

export type WebSocketLike = {
  readyState: number;
  /** Bytes queued by `send` but not yet transmitted (native + `ws`). */
  readonly bufferedAmount?: number;
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

const WEBSOCKET_OPEN_STATE = 1;

/**
 * Waits until the socket's send buffer drains below `highWaterMark` bytes.
 * No-op for implementations that do not expose `bufferedAmount`. There is no
 * portable drain event, so this polls. Returns as soon as the socket is no
 * longer open or the signal aborts — `bufferedAmount` never drains on a
 * closed socket, so waiting on would poll forever.
 */
export async function waitForWebSocketBufferDrain(
  socket: WebSocketLike,
  {
    highWaterMark = 1024 * 1024,
    pollIntervalMs = 20,
    abortSignal,
  }: {
    highWaterMark?: number;
    pollIntervalMs?: number;
    abortSignal?: AbortSignal;
  } = {},
): Promise<void> {
  while (
    socket.readyState === WEBSOCKET_OPEN_STATE &&
    (socket.bufferedAmount ?? 0) > highWaterMark
  ) {
    if (abortSignal?.aborted === true) {
      return;
    }
    await delay(pollIntervalMs);
  }
}
