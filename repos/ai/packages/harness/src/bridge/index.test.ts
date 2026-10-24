import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { runBridge, type BridgeHandle, type BridgeTurn } from './index';

const TOKEN = 'test-token';
const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

/** Start a bridge whose `onStart` is driven by the test. */
async function startBridge(
  onStart: (start: { type: 'start' }, turn: BridgeTurn) => Promise<void>,
  onDetach?: () => unknown,
): Promise<BridgeHandle> {
  const handle = await runBridge<{ type: 'start' }>({
    bridgeType: 'test',
    bridgeStateDir: `${process.env.TMPDIR ?? '/tmp'}/harness-bridge-test-${Math.floor(performance.now())}`,
    port: 0,
    token: TOKEN,
    onStart,
    ...(onDetach ? { onDetach } : {}),
    // Never call process.exit from a test.
    onExit: () => {},
  });
  cleanups.push(() => handle.close());
  return handle;
}

type Client = {
  ws: WebSocket;
  frames: Array<Record<string, unknown>>;
  /** Resolve once a frame matching `pred` arrives (checks backlog first). */
  waitFor(
    pred: (f: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown>>;
  send(msg: object): void;
  close(): void;
};

function connect(port: number): Promise<Client> {
  const ws = new WebSocket(
    `ws://127.0.0.1:${port}/?agent_bridge_token=${TOKEN}`,
  );
  const frames: Array<Record<string, unknown>> = [];
  const waiters: Array<{
    pred: (f: Record<string, unknown>) => boolean;
    resolve: (f: Record<string, unknown>) => void;
  }> = [];
  ws.on('message', raw => {
    const frame = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    frames.push(frame);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(frame)) {
        waiters[i].resolve(frame);
        waiters.splice(i, 1);
      }
    }
  });
  const client: Client = {
    ws,
    frames,
    waitFor(pred) {
      const existing = frames.find(pred);
      if (existing) return Promise.resolve(existing);
      return new Promise(resolve => waiters.push({ pred, resolve }));
    },
    send(msg) {
      ws.send(JSON.stringify(msg));
    },
    close() {
      ws.close();
    },
  };
  cleanups.push(() => ws.close());
  return new Promise(resolve => ws.on('open', () => resolve(client)));
}

describe('runBridge', () => {
  it('rejects when the requested port is already in use', async () => {
    const handle = await startBridge(async () => {});

    await expect(
      runBridge<{ type: 'start' }>({
        bridgeType: 'test',
        bridgeStateDir: `${process.env.TMPDIR ?? '/tmp'}/harness-bridge-port-conflict`,
        port: handle.port,
        token: TOKEN,
        onStart: async () => {},
        onExit: () => {},
      }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });

  it('greets with bridge-hello and stamps a monotonic seq on emitted events', async () => {
    const handle = await startBridge(async (_start, turn) => {
      turn.emit({ type: 'text-delta', delta: 'a' });
      turn.emit({ type: 'text-delta', delta: 'b' });
      turn.emit({ type: 'finish' });
    });
    const client = await connect(handle.port);

    const hello = await client.waitFor(f => f.type === 'bridge-hello');
    expect(hello).toMatchObject({ type: 'bridge-hello', state: 'waiting' });

    client.send({ type: 'start' });
    await client.waitFor(f => f.type === 'finish');

    const events = client.frames.filter(
      f => f.type === 'text-delta' || f.type === 'finish',
    );
    expect(events.map(e => e.seq)).toEqual([1, 2, 3]);
  });

  it('replaces the active connection (single-flight) and replays past the cursor on resume', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const handle = await startBridge(async (_start, turn) => {
      turn.emit({ type: 'text-delta', delta: 'one' }); // seq 1
      turn.emit({ type: 'text-delta', delta: 'two' }); // seq 2
      await gate;
      // Emitted AFTER the first client dropped — proves the turn was not
      // aborted by the disconnect.
      turn.emit({ type: 'text-delta', delta: 'three' }); // seq 3
      turn.emit({ type: 'finish' }); // seq 4
    });

    const a = await connect(handle.port);
    await a.waitFor(f => f.type === 'bridge-hello');
    a.send({ type: 'start' });
    await a.waitFor(f => f.seq === 2);

    // Drop A mid-turn, reconnect as B, resume from cursor 2.
    a.close();
    const b = await connect(handle.port);
    await b.waitFor(f => f.type === 'bridge-hello');
    b.send({ type: 'resume', lastSeenEventId: 2 });

    // Let the turn finish; B must receive only seq > 2 (no replay of 1/2).
    release();
    await b.waitFor(f => f.type === 'finish');

    const deltas = b.frames.filter(f => f.type === 'text-delta');
    expect(deltas.map(d => d.delta)).toEqual(['three']);
    expect(b.frames.filter(f => f.type === 'finish')).toHaveLength(1);
  });

  it('routes a host tool result back to the awaiting requestToolResult', async () => {
    const handle = await startBridge(async (_start, turn) => {
      turn.emit({
        type: 'tool-call',
        toolCallId: 'tc1',
        toolName: 'foo',
        input: '{}',
      });
      const result = await turn.requestToolResult('tc1');
      turn.emit({ type: 'tool-observed', output: result.output });
      turn.emit({ type: 'finish' });
    });
    const client = await connect(handle.port);
    await client.waitFor(f => f.type === 'bridge-hello');
    client.send({ type: 'start' });
    await client.waitFor(f => f.type === 'tool-call');
    client.send({ type: 'tool-result', toolCallId: 'tc1', output: 'OK' });
    const observed = await client.waitFor(f => f.type === 'tool-observed');
    expect(observed.output).toBe('OK');
  });

  it('reports non-fatal bridge warnings to stderr without emitting stream errors', async () => {
    const stderrLines: string[] = [];
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((
      chunk: string | Uint8Array,
      encodingOrCallback?:
        | BufferEncoding
        | ((err?: Error | null | undefined) => void),
      callback?: (err?: Error | null | undefined) => void,
    ) => {
      stderrLines.push(
        typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(),
      );
      const cb =
        typeof encodingOrCallback === 'function'
          ? encodingOrCallback
          : callback;
      cb?.();
      return true;
    }) as typeof process.stderr.write);

    try {
      const handle = await startBridge(async (_start, turn) => {
        turn.emitWarning({ message: 'watch this' });
        turn.emit({ type: 'finish' });
      });
      const client = await connect(handle.port);
      await client.waitFor(f => f.type === 'bridge-hello');
      client.send({ type: 'start' });
      await client.waitFor(f => f.type === 'finish');

      expect(stderrLines).toContain('[harness:test:warn] watch this\n');
      expect(client.frames.some(f => f.type === 'error')).toBe(false);
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('reports bridge errors to stderr without stringifying the stream error value', async () => {
    const stderrLines: string[] = [];
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((
      chunk: string | Uint8Array,
      encodingOrCallback?:
        | BufferEncoding
        | ((err?: Error | null | undefined) => void),
      callback?: (err?: Error | null | undefined) => void,
    ) => {
      stderrLines.push(
        typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(),
      );
      const cb =
        typeof encodingOrCallback === 'function'
          ? encodingOrCallback
          : callback;
      cb?.();
      return true;
    }) as typeof process.stderr.write);

    try {
      const error = { name: 'AdapterError', data: { message: 'boom' } };
      const handle = await startBridge(async (_start, turn) => {
        turn.emitError({ error, message: 'adapter failed' });
        turn.emit({ type: 'finish' });
      });
      const client = await connect(handle.port);
      await client.waitFor(f => f.type === 'bridge-hello');
      client.send({ type: 'start' });
      const errorFrame = await client.waitFor(f => f.type === 'error');
      await client.waitFor(f => f.type === 'finish');

      expect(errorFrame.error).toEqual(error);
      expect(stderrLines).toContain(
        '[harness:test:error] adapter failed: {"name":"AdapterError","data":{"message":"boom"}}\n',
      );
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('runs the active turn interrupt handler before acknowledging interrupt', async () => {
    let interrupted = false;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const handle = await startBridge(async (_start, turn) => {
      turn.onInterrupt(async () => {
        await gate;
        interrupted = true;
      });
      await new Promise<void>(() => {});
    });
    const client = await connect(handle.port);
    await client.waitFor(f => f.type === 'bridge-hello');
    client.send({ type: 'start' });

    client.send({ type: 'interrupt' });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(client.frames.some(f => f.type === 'bridge-interrupted')).toBe(
      false,
    );

    release();
    const ack = await client.waitFor(f => f.type === 'bridge-interrupted');
    expect(interrupted).toBe(true);
    expect(ack).toMatchObject({ type: 'bridge-interrupted', ok: true });
  });

  it('preserves a turn waiting for a host tool result when interrupted', async () => {
    let interrupted = false;
    const handle = await startBridge(async (_start, turn) => {
      turn.onInterrupt(() => {
        interrupted = true;
      });
      turn.emit({ type: 'tool-call', toolCallId: 'tool-1' });
      const result = await turn.requestToolResult('tool-1');
      turn.emit({ type: 'text-delta', delta: String(result.output) });
      turn.emit({ type: 'finish' });
    });
    const client = await connect(handle.port);
    await client.waitFor(f => f.type === 'bridge-hello');
    client.send({ type: 'start' });
    await client.waitFor(f => f.type === 'tool-call');

    client.send({ type: 'interrupt' });
    const ack = await client.waitFor(f => f.type === 'bridge-interrupted');
    expect(interrupted).toBe(false);
    expect(ack).toMatchObject({ type: 'bridge-interrupted', ok: true });

    client.send({
      type: 'tool-result',
      toolCallId: 'tool-1',
      output: 'sunny',
    });
    await client.waitFor(f => f.type === 'finish');
    expect(client.frames).toContainEqual(
      expect.objectContaining({ type: 'text-delta', delta: 'sunny' }),
    );
  });

  it('preserves a turn waiting for host approval when interrupted', async () => {
    let interrupted = false;
    const handle = await startBridge(async (_start, turn) => {
      turn.onInterrupt(() => {
        interrupted = true;
      });
      turn.emit({
        type: 'tool-approval-request',
        approvalId: 'approval-1',
        toolCallId: 'tool-1',
      });
      const response = await turn.requestToolApproval('approval-1');
      turn.emit({ type: 'text-delta', delta: String(response.approved) });
      turn.emit({ type: 'finish' });
    });
    const client = await connect(handle.port);
    await client.waitFor(f => f.type === 'bridge-hello');
    client.send({ type: 'start' });
    await client.waitFor(f => f.type === 'tool-approval-request');

    client.send({ type: 'interrupt' });
    const ack = await client.waitFor(f => f.type === 'bridge-interrupted');
    expect(interrupted).toBe(false);
    expect(ack).toMatchObject({ type: 'bridge-interrupted', ok: true });

    client.send({
      type: 'tool-approval-response',
      approvalId: 'approval-1',
      approved: true,
    });
    await client.waitFor(f => f.type === 'finish');
    expect(client.frames).toContainEqual(
      expect.objectContaining({ type: 'text-delta', delta: 'true' }),
    );
  });

  it('clears the log per turn but keeps seq monotonic across turns', async () => {
    let turnNo = 0;
    const handle = await startBridge(async (_start, turn) => {
      turnNo++;
      turn.emit({ type: 'text-delta', delta: `t${turnNo}` });
      turn.emit({ type: 'finish' });
    });
    const a = await connect(handle.port);
    await a.waitFor(f => f.type === 'bridge-hello');

    a.send({ type: 'start' });
    await a.waitFor(f => f.type === 'finish'); // seq 1,2

    a.send({ type: 'start' });
    await a.waitFor(f => f.seq === 4); // turn 2: seq 3,4 (monotonic, not reset)

    // A fresh connection that resumes from 0 sees ONLY the current turn's log
    // (turn 1's seq 1,2 were cleared at turn 2's start); seq stayed monotonic.
    const b = await connect(handle.port);
    await b.waitFor(f => f.type === 'bridge-hello');
    b.send({ type: 'resume', lastSeenEventId: 0 });
    await b.waitFor(f => f.seq === 4);

    const replayedSeqs = b.frames
      .filter(f => typeof f.seq === 'number')
      .map(f => f.seq);
    expect(replayedSeqs).toEqual([3, 4]);
  });

  it('emits a bridge-detach payload from onDetach', async () => {
    let exited = false;
    const handle = await runBridge<{ type: 'start' }>({
      bridgeType: 'test',
      bridgeStateDir: `${process.env.TMPDIR ?? '/tmp'}/harness-bridge-detach`,
      port: 0,
      token: TOKEN,
      onStart: async () => {},
      onDetach: () => ({ threadId: 'th_42' }),
      onExit: () => {
        exited = true;
      },
    });
    cleanups.push(() => handle.close());
    const client = await connect(handle.port);
    await client.waitFor(f => f.type === 'bridge-hello');
    client.send({ type: 'detach' });
    const detach = await client.waitFor(f => f.type === 'bridge-detach');
    expect(detach.data).toEqual({ threadId: 'th_42' });
    await new Promise(r => setTimeout(r, 50));
    expect(exited).toBe(true);
  });
});
