export type AuthSessionSyncEvent = {
  kind: 'authenticated' | 'signed_out'
  sid: string
  source: string
  nonce: string
  timestamp: number
}

const AUTH_SYNC_CHANNEL = 'new-api:auth-session'
const AUTH_SYNC_STORAGE_KEY = 'new-api:auth-session:event'

function randomIdentifier(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const authSyncSource = randomIdentifier()

function isAuthSessionSyncEvent(value: unknown): value is AuthSessionSyncEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<AuthSessionSyncEvent>
  return (
    (event.kind === 'authenticated' || event.kind === 'signed_out') &&
    typeof event.sid === 'string' &&
    event.sid.length > 0 &&
    typeof event.source === 'string' &&
    typeof event.nonce === 'string' &&
    typeof event.timestamp === 'number'
  )
}

export function publishAuthSessionEvent(
  kind: AuthSessionSyncEvent['kind'],
  sid: string
): void {
  if (typeof window === 'undefined' || !sid) return
  const event: AuthSessionSyncEvent = {
    kind,
    sid,
    source: authSyncSource,
    nonce: randomIdentifier(),
    timestamp: Date.now(),
  }

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL)
    channel.postMessage(event)
    channel.close()
    return
  }

  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(event))
    window.localStorage.removeItem(AUTH_SYNC_STORAGE_KEY)
  } catch {
    // Storage can be disabled; the in-memory session remains authoritative.
  }
}

export function subscribeAuthSessionEvents(
  listener: (event: AuthSessionSyncEvent) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined

  const deliver = (value: unknown) => {
    if (
      isAuthSessionSyncEvent(value) &&
      value.source !== authSyncSource &&
      Math.abs(Date.now() - value.timestamp) < 60_000
    ) {
      listener(value)
    }
  }

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL)
    const handleMessage = (message: MessageEvent<unknown>) =>
      deliver(message.data)
    channel.addEventListener('message', handleMessage)
    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return
    try {
      deliver(JSON.parse(event.newValue))
    } catch {
      // Ignore malformed events from another tab.
    }
  }
  window.addEventListener('storage', handleStorage)
  return () => window.removeEventListener('storage', handleStorage)
}
