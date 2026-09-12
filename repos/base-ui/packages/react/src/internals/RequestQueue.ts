export type RequestStatus = 'queued' | 'pending' | 'unknown';

export interface RequestQueueOptions<TKey> {
  /**
   * The function to call when a queued key is ready to be fetched.
   */
  fetchFn: (key: TKey) => Promise<void>;
  /**
   * The maximum number of concurrent requests.
   * @default Infinity
   */
  maxConcurrentRequests?: number | undefined;
  /**
   * Serialize a key to a string for use as a map key.
   * Required for complex key types (e.g., objects).
   * @default String(key)
   */
  getKeyId?: ((key: TKey) => string) | undefined;
}

/**
 * Manages concurrent fetching with a queue system.
 * Tracks request lifecycle through queued → pending states
 * and limits concurrency to prevent overwhelming the server.
 */
export class RequestQueue<TKey> {
  protected pendingRequests = new Map<string, TKey>();

  protected queuedRequests = new Map<string, TKey>();

  protected fetchFn: (key: TKey) => Promise<void>;

  protected maxConcurrentRequests: number;

  protected getKeyId: (key: TKey) => string;

  constructor(options: RequestQueueOptions<TKey>) {
    this.fetchFn = options.fetchFn;
    this.maxConcurrentRequests = options.maxConcurrentRequests ?? Infinity;
    this.getKeyId = options.getKeyId ?? String;
  }

  /**
   * Returns the next `count` entries to process from the queue.
   * Default is FIFO (oldest first). Subclasses can override for different ordering.
   */
  protected pickEntries(count: number): [string, TKey][] {
    const result: [string, TKey][] = [];
    const iterator = this.queuedRequests.entries();
    for (let i = 0; i < count; i += 1) {
      const { value } = iterator.next() as IteratorYieldResult<[string, TKey]>;
      result.push(value);
    }
    return result;
  }

  protected processQueue = async () => {
    if (this.queuedRequests.size === 0 || this.pendingRequests.size >= this.maxConcurrentRequests) {
      return;
    }

    const loopLength = Math.min(
      this.maxConcurrentRequests - this.pendingRequests.size,
      this.queuedRequests.size,
    );
    if (loopLength === 0) {
      return;
    }

    const fetchPromises: Promise<void>[] = [];

    for (const [keyId, key] of this.pickEntries(loopLength)) {
      this.queuedRequests.delete(keyId);
      this.pendingRequests.set(keyId, key);

      fetchPromises.push(
        this.fetchFn(key).catch(() => {
          this.pendingRequests.delete(keyId);
        }),
      );
    }

    await Promise.all(fetchPromises);
    if (this.queuedRequests.size > 0) {
      await this.processQueue();
    }
  };

  public queue = async (keys: TKey[]) => {
    for (const key of keys) {
      const keyId = this.getKeyId(key);
      if (!this.pendingRequests.has(keyId)) {
        this.queuedRequests.set(keyId, key);
      }
    }
    await this.processQueue();
  };

  public setRequestSettled = async (key: TKey) => {
    const keyId = this.getKeyId(key);
    this.pendingRequests.delete(keyId);
    await this.processQueue();
  };

  public clear = () => {
    this.queuedRequests.clear();
    this.pendingRequests.clear();
  };

  public clearPendingRequest = async (key: TKey) => {
    const keyId = this.getKeyId(key);
    this.pendingRequests.delete(keyId);
    await this.processQueue();
  };

  public getRequestStatus = (key: TKey): RequestStatus => {
    const keyId = this.getKeyId(key);
    if (this.pendingRequests.has(keyId)) {
      return 'pending';
    }
    if (this.queuedRequests.has(keyId)) {
      return 'queued';
    }
    return 'unknown';
  };
}
