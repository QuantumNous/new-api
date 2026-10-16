export type ToolRelayCall = {
  toolName: string;
  input: unknown;
};

export type ToolRelayResult = {
  output: unknown;
  isError?: boolean;
};

export class ToolRelayAuthorizer {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly authorizations: Array<{ key: string; expiresAt: number }> =
    [];
  private readonly pendingRequests: Array<{
    key: string;
    expiresAt: number;
    timeout: ReturnType<typeof setTimeout>;
    resolve: (authorized: boolean) => void;
  }> = [];

  constructor({
    ttlMs = 10_000,
    now = Date.now,
  }: {
    ttlMs?: number;
    now?: () => number;
  } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  authorizeToolCall(call: ToolRelayCall): void {
    this.pruneExpired();
    const key = toolRelayCallKey(call);
    const pendingRequestIndex = this.pendingRequests.findIndex(
      request => request.key === key,
    );
    if (pendingRequestIndex !== -1) {
      const [pendingRequest] = this.pendingRequests.splice(
        pendingRequestIndex,
        1,
      );
      clearTimeout(pendingRequest.timeout);
      pendingRequest.resolve(true);
      return;
    }
    this.authorizations.push({
      key,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  waitForToolCallAuthorization(call: ToolRelayCall): Promise<boolean> {
    this.pruneExpired();
    const key = toolRelayCallKey(call);
    const authorizationIndex = this.authorizations.findIndex(
      authorization => authorization.key === key,
    );
    if (authorizationIndex !== -1) {
      this.authorizations.splice(authorizationIndex, 1);
      return Promise.resolve(true);
    }

    const expiresAt = this.now() + this.ttlMs;
    return new Promise(resolve => {
      const pendingRequest = {
        key,
        expiresAt,
        timeout: setTimeout(() => {
          const index = this.pendingRequests.indexOf(pendingRequest);
          if (index !== -1) this.pendingRequests.splice(index, 1);
          resolve(false);
        }, this.ttlMs),
        resolve,
      };
      this.pendingRequests.push(pendingRequest);
    });
  }

  close(): void {
    this.authorizations.length = 0;
    for (const pendingRequest of this.pendingRequests.splice(0)) {
      clearTimeout(pendingRequest.timeout);
      pendingRequest.resolve(false);
    }
  }

  private pruneExpired(): void {
    const now = this.now();
    for (let i = this.authorizations.length - 1; i >= 0; i--) {
      if (this.authorizations[i].expiresAt <= now) {
        this.authorizations.splice(i, 1);
      }
    }
    for (let i = this.pendingRequests.length - 1; i >= 0; i--) {
      const pendingRequest = this.pendingRequests[i];
      if (pendingRequest.expiresAt <= now) {
        this.pendingRequests.splice(i, 1);
        clearTimeout(pendingRequest.timeout);
        pendingRequest.resolve(false);
      }
    }
  }
}

export class ToolRelayPendingCalls {
  private readonly calls = new Map<string, Promise<ToolRelayResult>>();

  begin({
    call,
    run,
  }: {
    call: ToolRelayCall;
    run: () => Promise<ToolRelayResult>;
  }): { result: Promise<ToolRelayResult>; isNew: boolean } {
    const key = toolRelayCallKey(call);
    const existing = this.calls.get(key);
    if (existing) return { result: existing, isNew: false };

    const result = run();
    this.calls.set(key, result);
    void result
      .finally(() => {
        if (this.calls.get(key) === result) {
          this.calls.delete(key);
        }
      })
      .catch(() => {});
    return { result, isNew: true };
  }
}

function toolRelayCallKey({ toolName, input }: ToolRelayCall): string {
  return `${toolName}\0${canonicalJson(input ?? {})}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value));
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeJsonValue(entryValue)]),
    );
  }
  return value;
}
