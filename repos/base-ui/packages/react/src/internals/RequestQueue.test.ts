import { expect, vi } from 'vitest';
import { RequestQueue } from './RequestQueue';

function createDeferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('RequestQueue', () => {
  it('calls fetchFn for each queued key', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const queue = new RequestQueue({ fetchFn });

    await queue.queue(['a', 'b']);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledWith('a');
    expect(fetchFn).toHaveBeenCalledWith('b');
  });

  it('reports correct request status', () => {
    const d = createDeferred();
    const fetchFn = vi.fn().mockReturnValue(d.promise);
    const queue = new RequestQueue({ fetchFn, maxConcurrentRequests: 1 });

    queue.queue(['a', 'b']);

    expect(queue.getRequestStatus('a')).toBe('pending');
    expect(queue.getRequestStatus('b')).toBe('queued');
    expect(queue.getRequestStatus('c')).toBe('unknown');

    d.resolve();
  });

  it('does not re-queue a key that is already pending', async () => {
    const d = createDeferred();
    const fetchFn = vi.fn().mockReturnValue(d.promise);
    const queue = new RequestQueue({ fetchFn });

    queue.queue(['a']);
    queue.queue(['a']);

    expect(fetchFn).toHaveBeenCalledTimes(1);

    d.resolve();
  });

  it('respects maxConcurrentRequests', () => {
    const fetchFn = vi.fn().mockReturnValue(createDeferred().promise);
    const queue = new RequestQueue({ fetchFn, maxConcurrentRequests: 2 });

    queue.queue(['a', 'b', 'c']);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(queue.getRequestStatus('a')).toBe('pending');
    expect(queue.getRequestStatus('b')).toBe('pending');
    expect(queue.getRequestStatus('c')).toBe('queued');
  });

  it('processes next queued item on setRequestSettled', () => {
    const fetchFn = vi.fn().mockReturnValue(createDeferred().promise);
    const queue = new RequestQueue({ fetchFn, maxConcurrentRequests: 1 });

    queue.queue(['a', 'b']);

    expect(queue.getRequestStatus('a')).toBe('pending');
    expect(queue.getRequestStatus('b')).toBe('queued');

    // Don't await — setRequestSettled triggers processQueue which
    // starts 'b' and hangs on its unresolved fetch promise.
    queue.setRequestSettled('a');

    expect(queue.getRequestStatus('a')).toBe('unknown');
    expect(queue.getRequestStatus('b')).toBe('pending');
  });

  it('processes next queued item on clearPendingRequest', () => {
    const fetchFn = vi.fn().mockReturnValue(createDeferred().promise);
    const queue = new RequestQueue({ fetchFn, maxConcurrentRequests: 1 });

    queue.queue(['a', 'b']);

    queue.clearPendingRequest('a');

    expect(queue.getRequestStatus('a')).toBe('unknown');
    expect(queue.getRequestStatus('b')).toBe('pending');
  });

  it('clears all queued and pending requests', () => {
    const fetchFn = vi.fn().mockReturnValue(createDeferred().promise);
    const queue = new RequestQueue({ fetchFn, maxConcurrentRequests: 1 });

    queue.queue(['a', 'b']);
    queue.clear();

    expect(queue.getRequestStatus('a')).toBe('unknown');
    expect(queue.getRequestStatus('b')).toBe('unknown');
  });

  it('continues processing when fetchFn rejects', async () => {
    const deferreds = new Map<string, ReturnType<typeof createDeferred>>();
    const fetchFn = vi.fn((key: string) => {
      const d = createDeferred();
      deferreds.set(key, d);
      return d.promise;
    });
    const queue = new RequestQueue({ fetchFn, maxConcurrentRequests: 1 });

    const queuePromise = queue.queue(['a', 'b']);

    // Reject 'a' -> removed from pending by catch handler, queue continues to 'b'
    deferreds.get('a')!.reject(new Error('fail'));
    await vi.waitFor(() => {
      expect(queue.getRequestStatus('a')).toBe('unknown');
      expect(queue.getRequestStatus('b')).toBe('pending');
    });

    deferreds.get('b')!.resolve();
    await queuePromise;
  });

  it('supports custom getKeyId for complex key types', async () => {
    const fetchFn = vi.fn().mockResolvedValue(undefined);
    const queue = new RequestQueue({
      fetchFn,
      getKeyId: (key: { id: number }) => String(key.id),
    });

    await queue.queue([{ id: 1 }, { id: 2 }, { id: 1 }]);

    // { id: 1 } appears twice but should be deduplicated
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('processes keys in FIFO order', async () => {
    const order: string[] = [];
    const fetchFn = vi.fn((key: string) => {
      order.push(key);
      return Promise.resolve();
    });
    const queue = new RequestQueue({ fetchFn });

    await queue.queue(['c', 'a', 'b']);

    expect(order).toEqual(['c', 'a', 'b']);
  });
});
