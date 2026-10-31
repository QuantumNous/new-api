import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRealtimeTransport } from './browser-realtime-transport';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  close = vi.fn(() => {
    this.readyState = 3;
  });
  send = vi.fn();
  onopen: (() => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(
    public url: string,
    public protocols?: string | string[],
  ) {
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

const model = {
  getWebSocketConfig: ({ url }: { url: string }) => ({ url }),
  serializeClientEvent: (event: unknown) => event,
  parseServerEvent: (raw: unknown) => raw,
} as never;

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('BrowserRealtimeTransport', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('closes a socket that is still connecting on disconnect', () => {
    const transport = new BrowserRealtimeTransport({
      model,
      onServerEvent: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    });

    const onOpen = vi.fn();
    transport.connect({ token: 'token', url: 'wss://example.com', onOpen });

    const ws = MockWebSocket.instances[0];
    expect(ws.readyState).toBe(MockWebSocket.CONNECTING);

    // Disconnect before the socket finishes connecting.
    transport.disconnect();
    expect(ws.close).toHaveBeenCalledOnce();

    // A late open for the now-disconnected socket must not fire onOpen
    // (which would send session-update against a disconnected session).
    ws.open();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('fires onOpen when the socket opens normally', () => {
    const transport = new BrowserRealtimeTransport({
      model,
      onServerEvent: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    });

    const onOpen = vi.fn();
    transport.connect({ token: 'token', url: 'wss://example.com', onOpen });

    MockWebSocket.instances[0].open();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('closes an existing socket before reconnecting', () => {
    const onClose = vi.fn();
    const transport = new BrowserRealtimeTransport({
      model,
      onServerEvent: vi.fn(),
      onError: vi.fn(),
      onClose,
    });

    transport.connect({
      token: 'token-1',
      url: 'wss://example.com/one',
      onOpen: vi.fn(),
    });
    const firstSocket = MockWebSocket.instances[0];

    transport.connect({
      token: 'token-2',
      url: 'wss://example.com/two',
      onOpen: vi.fn(),
    });
    const secondSocket = MockWebSocket.instances[1];

    expect(firstSocket.close).toHaveBeenCalledOnce();

    firstSocket.onclose?.();
    expect(onClose).not.toHaveBeenCalled();

    secondSocket.onclose?.();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('preserves send order when serialization is async', async () => {
    let resolveFirst: (() => void) | undefined;
    const asyncModel = {
      getWebSocketConfig: ({ url }: { url: string }) => ({ url }),
      serializeClientEvent: (event: { type: string }) => {
        if (event.type === 'first') {
          return new Promise(resolve => {
            resolveFirst = () => resolve({ type: 'first' });
          });
        }
        return event;
      },
      parseServerEvent: (raw: unknown) => raw,
    } as never;

    const transport = new BrowserRealtimeTransport({
      model: asyncModel,
      onServerEvent: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    });

    transport.connect({
      token: 'token',
      url: 'wss://example.com',
      onOpen: vi.fn(),
    });
    const ws = MockWebSocket.instances[0];
    ws.open();

    transport.sendEvent({ type: 'first' } as never);
    transport.sendEvent({ type: 'second' } as never);

    await flush();
    expect(ws.send).not.toHaveBeenCalled();

    resolveFirst?.();
    await flush();

    expect(ws.send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ type: 'first' }),
    );
    expect(ws.send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({ type: 'second' }),
    );
  });

  it('sends serialized strings and binary data without JSON encoding', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const rawModel = {
      getWebSocketConfig: ({ url }: { url: string }) => ({ url }),
      serializeClientEvent: (event: { type: string }) =>
        event.type === 'binary' ? bytes : 'finalize',
      parseServerEvent: (raw: unknown) => raw,
    } as never;
    const transport = new BrowserRealtimeTransport({
      model: rawModel,
      onServerEvent: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    });

    transport.connect({
      token: 'token',
      url: 'wss://example.com',
      onOpen: vi.fn(),
    });
    const ws = MockWebSocket.instances[0];
    ws.open();

    transport.sendEvent({ type: 'text' } as never);
    transport.sendEvent({ type: 'binary' } as never);
    await flush();

    expect(ws.send).toHaveBeenNthCalledWith(1, 'finalize');
    expect(ws.send).toHaveBeenNthCalledWith(2, bytes);
  });
});
