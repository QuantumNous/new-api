import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture transport instances and outgoing events. The transport is created
// inside the session constructor, so we replace it with a controllable fake
// that lets the test feed server events and observe sent client events.
const sentEvents: Array<{ type: string; [key: string]: unknown }> = [];
const transportInstances: Array<{
  emitServerEvent: (event: unknown) => Promise<void> | void;
}> = [];

vi.mock('./browser-realtime-transport', () => ({
  BrowserRealtimeTransport: class {
    private readonly options: {
      onServerEvent: (event: unknown) => Promise<void> | void;
    };
    constructor(options: {
      onServerEvent: (event: unknown) => Promise<void> | void;
    }) {
      this.options = options;
      transportInstances.push(this);
    }
    connect = vi.fn();
    disconnect = vi.fn();
    dispose = vi.fn();
    sendRaw = vi.fn();
    sendEvent = (event: { type: string }) => {
      sentEvents.push(event);
    };
    emitServerEvent(event: unknown) {
      return this.options.onServerEvent(event);
    }
  },
}));

vi.mock('./browser-realtime-audio', () => ({
  BrowserRealtimeAudio: class {
    constructor(_options: unknown) {}
    ensurePlaybackContext = vi.fn();
    startCapture = vi.fn();
    stopCapture = vi.fn();
    stopPlayback = vi.fn();
    playAudio = vi.fn();
    getPlaybackOffsetMs = vi.fn(() => 0);
    dispose = vi.fn();
  },
}));

const { AbstractRealtimeSession } = await import('./realtime-session');

class TestSession extends AbstractRealtimeSession {
  protected setState(): void {
    // no-op for tests
  }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const functionCallDone = (callId: string, name: string) => ({
  type: 'function-call-arguments-done',
  responseId: 'resp-1',
  itemId: `item-${callId}`,
  callId,
  name,
  arguments: '{}',
  raw: {},
});

const responseDone = () => ({
  type: 'response-done',
  responseId: 'resp-1',
  status: 'completed',
  raw: {},
});

describe('AbstractRealtimeSession', () => {
  beforeEach(() => {
    sentEvents.length = 0;
    transportInstances.length = 0;
  });

  it('does not error when onToolCall returns undefined (manual flow)', async () => {
    const onError = vi.fn();
    new TestSession({
      model: {} as never,
      api: { token: 'token' },
      onToolCall: async () => undefined,
      onError,
    });

    const transport = transportInstances.at(-1)!;
    await transport.emitServerEvent(functionCallDone('call-1', 'getWeather'));
    await flush();

    // Returning undefined is the documented "submit later" pattern and must not
    // be treated as a missing handler.
    expect(onError).not.toHaveBeenCalled();
  });

  it('errors when no onToolCall handler is provided', async () => {
    const onError = vi.fn();
    new TestSession({ model: {} as never, api: { token: 'token' }, onError });

    const transport = transportInstances.at(-1)!;
    await transport.emitServerEvent(functionCallDone('call-1', 'getWeather'));
    await flush();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toContain(
      'No handler provided for tool',
    );
  });

  it('requests a single response after all tool outputs are submitted', async () => {
    new TestSession({
      model: {} as never,
      api: { token: 'token' },
      onToolCall: async () => ({ ok: true }),
    });

    const transport = transportInstances.at(-1)!;
    await transport.emitServerEvent(functionCallDone('call-1', 'a'));
    await transport.emitServerEvent(functionCallDone('call-2', 'b'));
    await transport.emitServerEvent(responseDone());
    await flush();

    const responseCreates = sentEvents.filter(
      e => e.type === 'response-create',
    );
    expect(responseCreates).toHaveLength(1);

    const outputs = sentEvents.filter(
      e =>
        e.type === 'conversation-item-create' &&
        (e.item as { type?: string })?.type === 'function-call-output',
    );
    expect(outputs).toHaveLength(2);
  });

  it('does not request a response before the tool-bearing response is done', async () => {
    new TestSession({
      model: {} as never,
      api: { token: 'token' },
      onToolCall: async () => ({ ok: true }),
    });

    const transport = transportInstances.at(-1)!;
    // Output submitted before response-done arrives.
    await transport.emitServerEvent(functionCallDone('call-1', 'a'));
    await flush();
    expect(sentEvents.filter(e => e.type === 'response-create')).toHaveLength(
      0,
    );

    await transport.emitServerEvent(responseDone());
    await flush();
    expect(sentEvents.filter(e => e.type === 'response-create')).toHaveLength(
      1,
    );
  });
});
