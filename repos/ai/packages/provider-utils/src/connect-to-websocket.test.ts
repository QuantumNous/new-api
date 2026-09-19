import { describe, expect, it, vi } from 'vitest';
import { connectToWebSocket } from './connect-to-websocket';
import type { WebSocketConstructor } from './websocket';

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readyState = 0;
  send = vi.fn();
  close = vi.fn();
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(
    readonly url: string | URL,
    readonly protocols?: string | string[],
    readonly options?: { headers?: Record<string, string | undefined> },
  ) {
    MockWebSocket.instances.push(this);
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const baseOptions = {
  url: 'wss://example.com/socket',
  webSocket: MockWebSocket as unknown as WebSocketConstructor,
  onMessageText: () => {},
  onProcessingError: () => {},
};

describe('connectToWebSocket', () => {
  it('should construct the socket with protocols and stripped headers', () => {
    MockWebSocket.instances = [];
    const connection = connectToWebSocket({
      ...baseOptions,
      protocols: ['proto-a'],
      headers: { Authorization: 'Bearer token', 'X-Unset': undefined },
    });

    const ws = MockWebSocket.instances[0];
    expect(connection.socket).toBe(ws);
    expect(ws.url).toBe('wss://example.com/socket');
    expect(ws.protocols).toEqual(['proto-a']);
    expect(ws.options?.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('should route the constructor throw to onProcessingError and return no socket', () => {
    const onProcessingError = vi.fn();
    const failingConstructor = class {
      constructor() {
        throw new Error('bad url');
      }
    } as unknown as WebSocketConstructor;

    const connection = connectToWebSocket({
      ...baseOptions,
      webSocket: failingConstructor,
      onProcessingError,
    });

    expect(onProcessingError).toHaveBeenCalledWith(new Error('bad url'));
    expect(connection.socket).toBeUndefined();
    expect(() => connection.close()).not.toThrow();
  });

  it('should call onAbort without opening a socket when already aborted', () => {
    MockWebSocket.instances = [];
    const onAbort = vi.fn();
    const controller = new AbortController();
    controller.abort('early');

    const connection = connectToWebSocket({
      ...baseOptions,
      abortSignal: controller.signal,
      onAbort,
    });

    expect(onAbort).toHaveBeenCalledWith('early');
    expect(connection.socket).toBeUndefined();
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('should call onAbort when the signal fires and not after close', () => {
    MockWebSocket.instances = [];
    const onAbort = vi.fn();
    const controller = new AbortController();

    const connection = connectToWebSocket({
      ...baseOptions,
      abortSignal: controller.signal,
      onAbort,
    });

    connection.close();
    controller.abort('late');
    expect(onAbort).not.toHaveBeenCalled();

    const second = new AbortController();
    connectToWebSocket({
      ...baseOptions,
      abortSignal: second.signal,
      onAbort,
    });
    second.abort('mid-stream');
    expect(onAbort).toHaveBeenCalledWith('mid-stream');
  });

  it('should decode messages and route processing failures to onProcessingError', async () => {
    MockWebSocket.instances = [];
    const onMessageText = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const onProcessingError = vi.fn();

    connectToWebSocket({ ...baseOptions, onMessageText, onProcessingError });

    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: 'frame-1' });
    await flush();
    expect(onMessageText).toHaveBeenCalledWith('frame-1');
    expect(onProcessingError).toHaveBeenCalledWith(new Error('boom'));

    ws.onmessage?.({ data: new TextEncoder().encode('frame-2') });
    await flush();
    expect(onMessageText).toHaveBeenCalledWith('frame-2');
  });

  it('should route open, socket error, and close events', async () => {
    MockWebSocket.instances = [];
    const onOpen = vi.fn();
    const onSocketError = vi.fn();
    const onClose = vi.fn();

    connectToWebSocket({ ...baseOptions, onOpen, onSocketError, onClose });

    const ws = MockWebSocket.instances[0];
    ws.onopen?.({});
    ws.onerror?.({});
    ws.onclose?.({});
    expect(onOpen).toHaveBeenCalledWith(ws);
    await flush();
    expect(onSocketError).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should route onOpen throws to onProcessingError', () => {
    MockWebSocket.instances = [];
    const onProcessingError = vi.fn();

    connectToWebSocket({
      ...baseOptions,
      onProcessingError,
      onOpen: () => {
        throw new Error('send failed');
      },
    });

    MockWebSocket.instances[0].onopen?.({});
    expect(onProcessingError).toHaveBeenCalledWith(new Error('send failed'));
  });

  it('should process messages in order and run close after pending messages', async () => {
    MockWebSocket.instances = [];
    const events: string[] = [];
    const onClose = vi.fn(() => {
      events.push('close');
    });

    connectToWebSocket({
      ...baseOptions,
      onMessageText: text => {
        events.push(text);
      },
      onClose,
    });

    const ws = MockWebSocket.instances[0];
    // Blob decoding is genuinely async; a string frame decodes immediately.
    ws.onmessage?.({ data: new Blob(['slow-frame']) });
    ws.onmessage?.({ data: 'fast-frame' });
    ws.onclose?.({});
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(events).toEqual(['slow-frame', 'fast-frame', 'close']);
  });

  it('should close the socket with the code and swallow close throws', () => {
    MockWebSocket.instances = [];
    const connection = connectToWebSocket({ ...baseOptions });

    const ws = MockWebSocket.instances[0];
    connection.close(1000);
    expect(ws.close).toHaveBeenCalledWith(1000);

    ws.close.mockImplementation(() => {
      throw new Error('already closed');
    });
    expect(() => connection.close()).not.toThrow();
  });
});
