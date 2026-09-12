import type { LanguageModelV4FinishReason } from '@ai-sdk/provider';
import type { GoogleInteractionsStatus } from './google-interactions-prompt';

/*
 * `tool-calls` is selected when the response includes a client-side function
 * call. The API itself signals this via `requires_action`, but
 * `completed + hasFunctionCall` also occurs in practice.
 */
export function mapGoogleInteractionsFinishReason({
  status,
  hasFunctionCall,
}: {
  status: GoogleInteractionsStatus | string | null | undefined;
  hasFunctionCall: boolean;
}): LanguageModelV4FinishReason['unified'] {
  switch (status) {
    case 'completed':
      return hasFunctionCall ? 'tool-calls' : 'stop';
    case 'requires_action':
      return 'tool-calls';
    case 'failed':
      return 'error';
    case 'incomplete':
      return 'length';
    case 'cancelled':
      return 'other';
    case 'in_progress':
    default:
      return 'other';
  }
}
