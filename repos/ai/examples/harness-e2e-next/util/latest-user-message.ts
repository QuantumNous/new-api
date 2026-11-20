import type { HarnessV1Prompt } from '@ai-sdk/harness';
import type { ModelMessage } from 'ai';

/**
 * The latest user message from a converted `useChat` history, as a
 * `HarnessV1Prompt` (a single `UserModelMessage`). The harness session owns
 * prior-turn history, so a workflow run carries only the newest user turn — and
 * keeping it as a message (not a flattened string) preserves multi-part content.
 */
export function latestUserMessage(
  messages: ModelMessage[],
): HarnessV1Prompt | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === 'user') return message;
  }
  return undefined;
}
