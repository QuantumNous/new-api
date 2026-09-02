export class CacheClient {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  async connect(): Promise<void> {
    console.log('[cache] Memory cache enabled');
  }

  async disconnect(): Promise<void> {
    this.store.clear();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return JSON.parse(entry.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async setPersistent<T>(key: string, value: T): Promise<void> {
    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: null,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  isEnabled(): boolean {
    return true;
  }
}
