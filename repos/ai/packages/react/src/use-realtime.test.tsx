import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { realtimeInstances } = vi.hoisted(() => ({
  realtimeInstances: [] as Array<{
    options: {
      api: { token: string };
      onError?: (error: Error) => void;
    };
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('ai', () => ({
  Experimental_AbstractRealtimeSession: class {
    protected state = {
      status: 'disconnected',
      messages: [],
      events: [],
      isCapturing: false,
      isPlaying: false,
    };
    protected maxEvents = 500;

    readonly options: {
      api: { token: string };
      onError?: (error: Error) => void;
    };
    dispose = vi.fn();

    constructor(options: {
      api: { token: string };
      maxEvents?: number;
      onError?: (error: Error) => void;
    }) {
      this.options = options;
      this.maxEvents = options.maxEvents ?? 500;
      realtimeInstances.push(this);
    }

    connect = vi.fn(async () => {});
    disconnect = vi.fn();
    addToolOutput = vi.fn();
    sendEvent = vi.fn();
    sendTextMessage = vi.fn();
    sendAudio = vi.fn();
    commitAudio = vi.fn();
    clearAudioBuffer = vi.fn();
    requestResponse = vi.fn();
    cancelResponse = vi.fn();
    startAudioCapture = vi.fn();
    stopAudioCapture = vi.fn();
    stopPlayback = vi.fn();
  },
}));

const { experimental_useRealtime } = await import('./use-realtime');

const testModel = {} as never;

function TestComponent({
  token,
  onError,
}: {
  token: string;
  onError?: (error: Error) => void;
}) {
  experimental_useRealtime({
    model: testModel,
    api: { token },
    onError,
  });

  return null;
}

describe('experimental_useRealtime', () => {
  afterEach(() => {
    cleanup();
    realtimeInstances.length = 0;
  });

  it('keeps the session when only callbacks change', () => {
    const firstOnError = vi.fn();
    const secondOnError = vi.fn();

    const { rerender } = render(
      <TestComponent token="/api/realtime/setup" onError={firstOnError} />,
    );

    rerender(
      <TestComponent token="/api/realtime/setup" onError={secondOnError} />,
    );

    expect(realtimeInstances).toHaveLength(1);

    realtimeInstances[0].options.onError?.(new Error('test'));

    expect(firstOnError).not.toHaveBeenCalled();
    expect(secondOnError).toHaveBeenCalledOnce();
  });

  it('replaces the session when the token endpoint changes', () => {
    const { rerender } = render(
      <TestComponent token="/api/realtime/setup-a" />,
    );
    const firstInstance = realtimeInstances[0];

    rerender(<TestComponent token="/api/realtime/setup-b" />);

    expect(realtimeInstances).toHaveLength(2);
    expect(realtimeInstances[1].options.api.token).toBe(
      '/api/realtime/setup-b',
    );
    expect(firstInstance.dispose).toHaveBeenCalledOnce();
  });
});
