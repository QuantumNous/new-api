import { z } from 'zod/v4';

/**
 * Pi `session.subscribe` emits a discriminated union of events. The exact
 * shape evolves with Pi versions; we accept loose objects and extract only
 * the fields we recognise. The `type` field is required and stringly-typed
 * because Pi may add new types we want to ignore.
 */
export const piSessionEventSchema = z.looseObject({
  type: z.string(),
  assistantMessageEvent: z
    .looseObject({
      type: z.string().optional(),
      delta: z.string().optional(),
    })
    .optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
  args: z.unknown().optional(),
  input: z.unknown().optional(),
  result: z.unknown().optional(),
  content: z.unknown().optional(),
  isError: z.boolean().optional(),
  // Compaction events (`compaction_start` / `compaction_end`). `result` (a
  // `CompactionResult`) rides the shared `result` field above; `reason`
  // distinguishes manual vs automatic (threshold/overflow) compaction.
  reason: z.string().optional(),
  aborted: z.boolean().optional(),
  error: z
    .union([
      z.string(),
      z.looseObject({
        errorMessage: z.string().optional(),
        stopReason: z.string().optional(),
      }),
    ])
    .optional(),
  message: z
    .looseObject({
      role: z.string().optional(),
      content: z.unknown().optional(),
      stopReason: z.string().optional(),
      errorMessage: z.string().optional(),
    })
    .optional(),
});

export type PiSessionEvent = z.infer<typeof piSessionEventSchema>;

/**
 * Decode an unknown raw event into a `PiSessionEvent` if it looks like one.
 * Returns `undefined` if it doesn't parse so the caller can skip it.
 */
export function parseNativeEvent(raw: unknown): PiSessionEvent | undefined {
  const parsed = piSessionEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Detect whether a Pi event signals a terminal error for the current turn.
 * Returns the error message if so. Mirrors the original adapter's
 * `getPiTerminalError`.
 */
export function getPiTerminalError(event: PiSessionEvent): string | undefined {
  const isTerminalStopReason = (value: string | undefined) =>
    value === 'error' || value === 'aborted';

  if (typeof event.error === 'string' && event.error.trim()) {
    return event.error.trim();
  }

  if (event.error && typeof event.error === 'object') {
    const errorMessage = event.error.errorMessage?.trim();
    if (errorMessage) {
      return errorMessage;
    }
    const stopReason = event.error.stopReason?.trim();
    if (isTerminalStopReason(stopReason)) {
      return stopReason;
    }
  }

  const messageError = event.message?.errorMessage?.trim();
  if (messageError) {
    return messageError;
  }

  const messageStopReason = event.message?.stopReason?.trim();
  if (isTerminalStopReason(messageStopReason)) {
    return messageStopReason;
  }

  if (
    event.isError &&
    typeof event.content === 'string' &&
    event.content.trim()
  ) {
    return event.content.trim();
  }

  return undefined;
}

/** Pull the assistant text from a `turn_end` / `message_end` event payload. */
export function extractAssistantText(
  message: PiSessionEvent['message'],
): string {
  if (!message || message.role !== 'assistant') {
    return '';
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return '';
  }

  return message.content
    .flatMap(part => {
      if (!part || typeof part !== 'object') {
        return [];
      }
      const contentPart = part as Record<string, unknown>;
      return contentPart.type === 'text' && typeof contentPart.text === 'string'
        ? [contentPart.text]
        : [];
    })
    .join('');
}
