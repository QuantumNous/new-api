// End-to-end proof: a bridge writes its turn events to `event-log.ndjson`,
// the process dies, and a *respawned* bridge started with
// `BRIDGE_REPLAY_FROM_DISK=1` reloads that log and serves a host's resume cursor
// — delivering the tail (including the terminal `finish`) the dead bridge never
// got to send. This is `replay` recovery.
//
// Node-only (binds real sockets + touches the filesystem); excluded from the
// edge run via the `**/src/bridge/**` pattern in vitest.edge.config.js.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { z } from 'zod/v4';
import { runBridge, type BridgeHandle, type BridgeTurn } from './index';
import { SandboxChannel } from '../utils/sandbox-channel';

const TOKEN = 'replay-token';
const outboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('bridge-hello'),
    state: z.string().optional(),
    lastSeq: z.number().optional(),
  }),
  z.object({
    type: z.literal('text-delta'),
    id: z.string(),
    delta: z.string(),
  }),
  z.object({ type: z.literal('finish') }),
  z.object({ type: z.literal('error'), error: z.unknown() }),
]);
type Outbound = z.infer<typeof outboundSchema>;
type Inbound = { type: 'start' } | { type: 'resume'; lastSeenEventId: number };

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
  delete process.env.BRIDGE_REPLAY_FROM_DISK;
});

function connectTo(port: number): () => Promise<WebSocket> {
  const url = `ws://127.0.0.1:${port}/?agent_bridge_token=${TOKEN}`;
  return () =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
}

async function waitUntil(pred: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = performance.now();
  while (!pred()) {
    if (performance.now() - start > timeoutMs) {
      throw new Error('waitUntil timed out');
    }
    await new Promise(r => setTimeout(r, 5));
  }
}

describe('runBridge disk replay', () => {
  it('a respawned bridge replays a finished turn from event-log.ndjson', async () => {
    const bridgeStateDir = `${process.env.TMPDIR ?? '/tmp'}/harness-replay-${Math.floor(performance.now())}`;
    const eventLogPath = `${bridgeStateDir}/event-log.ndjson`;

    // ── Bridge #1: run a full turn, then "die". ────────────────────────
    const onStart = async (_s: { type: 'start' }, turn: BridgeTurn) => {
      turn.emit({ type: 'text-delta', id: 'm', delta: 'one' }); // seq 1
      turn.emit({ type: 'text-delta', id: 'm', delta: 'two' }); // seq 2
      turn.emit({ type: 'text-delta', id: 'm', delta: 'three' }); // seq 3
      turn.emit({ type: 'finish' }); // seq 4
    };
    const first: BridgeHandle = await runBridge<{ type: 'start' }>({
      bridgeType: 'test',
      bridgeStateDir,
      port: 0,
      token: TOKEN,
      onStart,
      onExit: () => {},
    });

    const ch1 = new SandboxChannel<Outbound, Inbound>({
      connect: connectTo(first.port),
      outboundSchema,
    });
    cleanups.push(() => ch1.close());
    const got1: string[] = [];
    ch1.on('text-delta', e => got1.push(e.delta));
    let finished1 = false;
    ch1.on('finish', () => (finished1 = true));
    await ch1.open();
    ch1.send({ type: 'start' });
    await waitUntil(() => finished1);
    expect(got1).toEqual(['one', 'two', 'three']);
    expect(ch1.lastSeenEventId).toBe(4);

    // The disk mirror is written on `setImmediate`; wait for all four lines.
    await waitUntil(() => {
      try {
        return (
          readFileSync(eventLogPath, 'utf8').split('\n').filter(Boolean)
            .length === 4
        );
      } catch {
        return false;
      }
    });

    ch1.close();
    await first.close(); // bridge #1 is gone

    // ── Bridge #2: respawn in replay mode against the same state dir. ───
    process.env.BRIDGE_REPLAY_FROM_DISK = '1';
    const second: BridgeHandle = await runBridge<{ type: 'start' }>({
      bridgeType: 'test',
      bridgeStateDir,
      port: 0,
      token: TOKEN,
      // Would only run for a *new* turn; replay must not invoke it.
      onStart: async () => {
        throw new Error('onStart must not run during replay');
      },
      onExit: () => {},
    });
    cleanups.push(() => second.close());

    // A host that had only seen seq ≤ 2 attaches and resumes from its cursor.
    const ch2 = new SandboxChannel<Outbound, Inbound>({
      connect: connectTo(second.port),
      outboundSchema,
      initialLastSeenEventId: 2,
    });
    cleanups.push(() => ch2.close());
    const got2: string[] = [];
    ch2.on('text-delta', e => got2.push(e.delta));
    let finished2 = false;
    ch2.on('finish', () => (finished2 = true));

    await ch2.open({ resume: true });
    await waitUntil(() => finished2);

    // Only the tail past the cursor is replayed — exactly once, in order.
    expect(got2).toEqual(['three']);
    expect(finished2).toBe(true);
    expect(ch2.lastSeenEventId).toBe(4);
  });
});
