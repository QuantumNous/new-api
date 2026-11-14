import { describe, expect, it } from 'vitest';
import { waitForWebSocketBufferDrain, type WebSocketLike } from './websocket';

function socketWithBuffer(initial: number): WebSocketLike & {
  bufferedAmount: number;
} {
  return {
    readyState: 1,
    bufferedAmount: initial,
    send: () => {},
    close: () => {},
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };
}

describe('waitForWebSocketBufferDrain', () => {
  it('should resolve immediately when the buffer is below the high-water mark', async () => {
    await expect(
      waitForWebSocketBufferDrain(socketWithBuffer(0)),
    ).resolves.toBeUndefined();
  });

  it('should resolve immediately when bufferedAmount is not exposed', async () => {
    const socket = socketWithBuffer(0) as WebSocketLike & {
      bufferedAmount?: number;
    };
    delete socket.bufferedAmount;
    await expect(waitForWebSocketBufferDrain(socket)).resolves.toBeUndefined();
  });

  it('should wait until the buffer drains below the high-water mark', async () => {
    const socket = socketWithBuffer(100);
    let drained = false;
    const wait = waitForWebSocketBufferDrain(socket, {
      highWaterMark: 10,
      pollIntervalMs: 1,
    }).then(() => {
      drained = true;
    });

    await new Promise(resolve => setTimeout(resolve, 5));
    expect(drained).toBe(false);

    socket.bufferedAmount = 0;
    await wait;
    expect(drained).toBe(true);
  });

  it('should resolve when the socket is no longer open even with a full buffer', async () => {
    // bufferedAmount never drains on a closed socket
    const socket = socketWithBuffer(100);
    socket.readyState = 3;
    await expect(
      waitForWebSocketBufferDrain(socket, { highWaterMark: 10 }),
    ).resolves.toBeUndefined();
  });

  it('should resolve when the socket closes mid-wait', async () => {
    const socket = socketWithBuffer(100);
    const wait = waitForWebSocketBufferDrain(socket, {
      highWaterMark: 10,
      pollIntervalMs: 1,
    });
    socket.readyState = 3;
    await expect(wait).resolves.toBeUndefined();
  });

  it('should resolve when the abort signal fires mid-wait', async () => {
    const socket = socketWithBuffer(100);
    const controller = new AbortController();
    const wait = waitForWebSocketBufferDrain(socket, {
      highWaterMark: 10,
      pollIntervalMs: 1,
      abortSignal: controller.signal,
    });
    controller.abort();
    await expect(wait).resolves.toBeUndefined();
  });
});
