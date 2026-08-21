import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { z } from 'zod/v4';
import { SandboxChannel } from './sandbox-channel';

const outboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text-delta'),
    id: z.string(),
    delta: z.string(),
  }),
  z.object({ type: z.literal('finish') }),
  z.object({
    type: z.literal('bridge-interrupted'),
    ok: z.boolean(),
    error: z.unknown().optional(),
  }),
  z.object({ type: z.literal('error'), error: z.unknown() }),
]);
type Outbound = z.infer<typeof outboundSchema>;
type Inbound =
  | { type: 'start' }
  | { type: 'abort' }
  | { type: 'interrupt' }
  | { type: 'resume'; lastSeenEventId: number };

type FakeSocket = {
  socket: WebSocket;
  deliver(message: object, seq?: number): void;
  drop(code?: number): void;
  sent: string[];
};

function makeFakeSocket(): FakeSocket {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  const sent: string[] = [];
  const fake = {
    on(event: string, handler: (...args: unknown[]) => void) {
      (handlers[event] ??= []).push(handler);
    },
    send(data: string) {
      sent.push(data);
    },
    close(code = 1000) {
      for (const h of handlers.close ?? []) h(code, Buffer.from(''));
    },
  };
  return {
    socket: fake as unknown as WebSocket,
    deliver(message: object, seq?: number) {
      const payload = seq === undefined ? message : { ...message, seq };
      const raw = JSON.stringify(payload);
      for (const h of handlers.message ?? []) h(raw);
    },
    drop(code = 1006) {
      for (const h of handlers.close ?? []) h(code, Buffer.from(''));
    },
    sent,
  };
}

/** Connect thunk that hands out a fresh fake socket per call and records them. */
function makeConnector() {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    connect: async () => {
      const s = makeFakeSocket();
      sockets.push(s);
      return s.socket;
    },
    current: () => sockets[sockets.length - 1],
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0));
}

function makeChannel(
  connector: ReturnType<typeof makeConnector>,
  onDebug?: (e: unknown) => void,
) {
  return new SandboxChannel<Outbound, Inbound>({
    connect: connector.connect,
    outboundSchema,
    reconnect: { initialDelayMs: 1, maxDelayMs: 1, maxElapsedMs: 200 },
    ...(onDebug ? { onDebug: onDebug as never } : {}),
  });
}

describe('SandboxChannel', () => {
  it('dispatches outbound messages by type', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    const text: string[] = [];
    channel.on('text-delta', evt => text.push(evt.delta));
    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: 'hello' });
    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: ' world' });
    await flush();
    expect(text).toEqual(['hello', ' world']);
  });

  it('replays messages buffered before the listener subscribes', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    connector.current().deliver({ type: 'finish' });
    await flush();
    const captured: unknown[] = [];
    channel.on('finish', evt => captured.push(evt));
    expect(captured).toHaveLength(1);
  });

  it('suspend freezes the cursor at the last delivered event and closes with reason "suspended"', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();

    const text: string[] = [];
    channel.on('text-delta', evt => text.push(evt.delta));
    let closeReason: string | undefined;
    channel.onClose((_code, reason) => {
      closeReason = reason;
    });

    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: 'one' }, 1);
    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: 'two' }, 2);
    await flush();

    const cursor = await channel.suspend();
    expect(cursor).toBe(2);
    expect(closeReason).toBe('suspended');
    expect(channel.lastSeenEventId).toBe(2);

    // Frames arriving after suspend are ignored — the cursor must not advance
    // past what was delivered (the bridge replays the rest to the next slice).
    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: 'three' }, 3);
    await flush();
    expect(text).toEqual(['one', 'two']);
    expect(channel.lastSeenEventId).toBe(2);

    // No `resume` was sent — suspend is a one-way close, not a reconnect.
    expect(connector.current().sent).toEqual([]);
  });

  it('serialises and sends inbound messages', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    channel.send({ type: 'abort' });
    expect(connector.current().sent).toEqual([
      JSON.stringify({ type: 'abort' }),
    ]);
  });

  it('sends interrupt and resolves after the bridge acknowledges it', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();

    const interrupted = channel.interrupt();
    expect(connector.current().sent).toEqual([
      JSON.stringify({ type: 'interrupt' }),
    ]);

    connector.current().deliver({ type: 'bridge-interrupted', ok: true });
    await expect(interrupted).resolves.toBeUndefined();
  });

  it('rejects interrupt when the bridge reports a failure', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();

    const interrupted = channel.interrupt();
    connector.current().deliver({
      type: 'bridge-interrupted',
      ok: false,
      error: { message: 'native interrupt failed' },
    });

    await expect(interrupted).rejects.toThrow(/native interrupt failed/);
  });

  it('refuses to send once terminally closed', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    channel.close();
    await flush();
    expect(() => channel.send({ type: 'abort' })).toThrow(/closed/);
  });

  it('surfaces malformed messages as error events', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    const errors: unknown[] = [];
    channel.on('error', evt => errors.push(evt));
    connector.current().deliver({ type: 'mystery' });
    await flush();
    expect(errors).toHaveLength(1);
  });

  it('reconnects transparently on a transient drop and resumes from the cursor', async () => {
    const connector = makeConnector();
    const debug: Array<{ event: string }> = [];
    const channel = makeChannel(connector, e =>
      debug.push(e as { event: string }),
    );
    await channel.open();

    const closes: number[] = [];
    channel.onClose(code => closes.push(code));

    const text: string[] = [];
    channel.on('text-delta', evt => text.push(evt.delta));

    // Two events seen on the first socket (cursor advances to seq 2).
    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: 'one' }, 1);
    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: 'two' }, 2);
    await flush();

    // Transient drop → channel reconnects on a fresh socket.
    connector.current().drop();
    await flush();

    expect(connector.sockets).toHaveLength(2);
    // First frame on the new socket is a resume carrying the last seen cursor.
    expect(connector.current().sent).toEqual([
      JSON.stringify({ type: 'resume', lastSeenEventId: 2 }),
    ]);
    // Transient drop must NOT fire onClose.
    expect(closes).toEqual([]);
    expect(debug.map(d => d.event)).toContain('reconnected');

    // Replayed-then-live events continue to flow without duplication.
    connector
      .current()
      .deliver({ type: 'text-delta', id: 'a', delta: 'three' }, 3);
    await flush();
    expect(text).toEqual(['one', 'two', 'three']);
  });

  it('queues host → bridge sends while disconnected and flushes them on reconnect', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();

    connector.current().drop();
    // send during the reconnect gap — must not throw, must queue
    channel.send({ type: 'abort' });
    await flush();

    expect(connector.sockets).toHaveLength(2);
    expect(connector.current().sent).toEqual([
      JSON.stringify({ type: 'resume', lastSeenEventId: 0 }),
      JSON.stringify({ type: 'abort' }),
    ]);
  });

  it('fires onClose on a host-initiated close (terminal)', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    const closes: number[] = [];
    channel.onClose(code => closes.push(code));
    channel.close();
    await flush();
    expect(closes).toEqual([1000]);
    expect(channel.isClosed()).toBe(true);
  });

  it('treats a drop after beginClose as terminal, not a reconnect', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    const closes: number[] = [];
    channel.onClose(code => closes.push(code));

    channel.beginClose();
    connector.current().drop(1000);
    await flush();

    expect(connector.sockets).toHaveLength(1); // no reconnect attempted
    expect(closes).toEqual([1000]);
  });

  it('gives up and fires onClose once the reconnect budget is exhausted', async () => {
    const sockets: FakeSocket[] = [];
    let calls = 0;
    const channel = new SandboxChannel<Outbound, Inbound>({
      connect: async () => {
        calls++;
        if (calls === 1) {
          const s = makeFakeSocket();
          sockets.push(s);
          return s.socket;
        }
        throw new Error('connect refused');
      },
      outboundSchema,
      reconnect: { initialDelayMs: 1, maxDelayMs: 1, maxElapsedMs: 30 },
    });
    await channel.open();
    const closes: number[] = [];
    channel.onClose(code => closes.push(code));
    sockets[0].drop();
    await vi.waitFor(() => expect(closes.length).toBe(1));
    expect(closes[0]).toBe(1006);
  });

  it('seeds lastSeenEventId and advances it as events arrive', async () => {
    const connector = makeConnector();
    const channel = new SandboxChannel<Outbound, Inbound>({
      connect: connector.connect,
      outboundSchema,
      initialLastSeenEventId: 7,
    });
    expect(channel.lastSeenEventId).toBe(7);
    await channel.open();
    channel.on('text-delta', () => {});
    connector.current().deliver({ type: 'text-delta', id: 'm', delta: 'x' }, 9);
    await flush();
    expect(channel.lastSeenEventId).toBe(9);
  });

  it('open({ resume: true }) sends a resume frame with the seeded cursor', async () => {
    const connector = makeConnector();
    const channel = new SandboxChannel<Outbound, Inbound>({
      connect: connector.connect,
      outboundSchema,
      initialLastSeenEventId: 4,
    });
    await channel.open({ resume: true });
    expect(connector.current().sent).toContainEqual(
      JSON.stringify({ type: 'resume', lastSeenEventId: 4 }),
    );
  });

  it('open() without resume sends no resume frame', async () => {
    const connector = makeConnector();
    const channel = makeChannel(connector);
    await channel.open();
    expect(connector.current().sent).toEqual([]);
  });

  it('routes sandbox-log/debug-event frames to onDiagnostic, not type listeners', async () => {
    const diagSchema = z.discriminatedUnion('type', [
      z.object({
        type: z.literal('text-delta'),
        id: z.string(),
        delta: z.string(),
      }),
      z.object({
        type: z.literal('sandbox-log'),
        source: z.string(),
        stream: z.enum(['stdout', 'stderr']),
        line: z.string(),
      }),
      z.object({
        type: z.literal('debug-event'),
        level: z.string(),
        subsystem: z.string(),
        message: z.string(),
      }),
    ]);
    type DiagOut = z.infer<typeof diagSchema>;

    const connector = makeConnector();
    const diagnostics: DiagOut[] = [];
    const channel = new SandboxChannel<DiagOut, Inbound>({
      connect: connector.connect,
      outboundSchema: diagSchema,
      onDiagnostic: e => diagnostics.push(e),
    });
    await channel.open();

    // A type listener for sandbox-log must NOT receive the diagnostic frame.
    const leaked: DiagOut[] = [];
    channel.on('sandbox-log', e => leaked.push(e));
    const text: string[] = [];
    channel.on('text-delta', e => text.push(e.delta));

    connector
      .current()
      .deliver(
        { type: 'sandbox-log', source: 'bridge', stream: 'stdout', line: 'hi' },
        1,
      );
    connector.current().deliver(
      {
        type: 'debug-event',
        level: 'info',
        subsystem: 'bridge.turn',
        message: 'started',
      },
      2,
    );
    connector.current().deliver({ type: 'text-delta', id: 'a', delta: 'x' }, 3);
    await flush();

    expect(diagnostics.map(d => d.type)).toEqual([
      'sandbox-log',
      'debug-event',
    ]);
    expect(leaked).toEqual([]);
    expect(text).toEqual(['x']);
    // Diagnostics still advance the resume cursor (they carry a seq).
    expect(channel.lastSeenEventId).toBe(3);
  });

  it('reports error frames to onBridgeError and still dispatches them normally', async () => {
    const connector = makeConnector();
    const errors: Outbound[] = [];
    const channel = new SandboxChannel<Outbound, Inbound>({
      connect: connector.connect,
      outboundSchema,
      onBridgeError: e => errors.push(e),
    });
    await channel.open();

    const listenerEvents: Outbound[] = [];
    channel.on('error', event => listenerEvents.push(event));
    connector.current().deliver(
      {
        type: 'error',
        error: {
          name: 'Error',
          message: 'boom',
          stack: 'Error: boom',
        },
      },
      1,
    );
    await flush();

    expect(errors).toEqual([
      {
        type: 'error',
        error: {
          name: 'Error',
          message: 'boom',
          stack: 'Error: boom',
        },
      },
    ]);
    expect(listenerEvents).toEqual(errors);
    expect(channel.lastSeenEventId).toBe(1);
  });
});
