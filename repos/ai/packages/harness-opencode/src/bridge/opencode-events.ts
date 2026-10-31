export type OpenCodeEvent = {
  id?: string;
  type?: string;
  properties?: Record<string, any>;
};

export function unwrapOpenCodeEvent(
  rawEvent: unknown,
): OpenCodeEvent | undefined {
  if (!rawEvent || typeof rawEvent !== 'object') return undefined;
  const raw = rawEvent as Record<string, any>;
  if (raw.type === 'sync' && raw.syncEvent) {
    const sync = raw.syncEvent as Record<string, any>;
    return {
      id: String(sync.id ?? raw.id ?? ''),
      type: stripSyncVersion(String(sync.type ?? '')),
      properties: asRecord(sync.data) ?? {},
    };
  }
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    type: typeof raw.type === 'string' ? stripSyncVersion(raw.type) : undefined,
    properties: asRecord(raw.properties) ?? asRecord(raw.data) ?? {},
  };
}

export function getOpenCodeEventSessionId(
  event: OpenCodeEvent,
): string | undefined {
  const props = event.properties;
  if (!props) return undefined;
  if (typeof props.sessionID === 'string') return props.sessionID;
  if (typeof props.sessionId === 'string') return props.sessionId;
  if (event.type?.startsWith('session.') && typeof props.id === 'string') {
    return props.id;
  }
  const part = props.part;
  if (
    part &&
    typeof part === 'object' &&
    !Array.isArray(part) &&
    typeof (part as { sessionID?: unknown }).sessionID === 'string'
  ) {
    return (part as { sessionID: string }).sessionID;
  }
  return undefined;
}

export function isStepSettlementEvent(event: OpenCodeEvent): boolean {
  return (
    event.type === 'session.next.step.ended' ||
    event.type === 'session.next.step.failed' ||
    event.type === 'session.error'
  );
}

export function emitMissingFinalDelta({
  id,
  fullText,
  emittedText,
  emit,
  type,
}: {
  id: string;
  fullText: string | undefined;
  emittedText: string;
  emit: (msg: Record<string, unknown>) => void;
  type: 'text-delta' | 'reasoning-delta';
}): void {
  if (
    !fullText ||
    fullText === emittedText ||
    !fullText.startsWith(emittedText)
  ) {
    return;
  }
  emit({ type, id, delta: fullText.slice(emittedText.length) });
}

function stripSyncVersion(type: string): string {
  return type.replace(/\.\d+$/, '');
}

function asRecord(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  return value as Record<string, any>;
}
