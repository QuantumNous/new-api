import type { LanguageModelV4FinishReason } from '@ai-sdk/provider';

export function mapGoogleFinishReason({
  finishReason,
  hasToolCalls,
}: {
  finishReason: string | null | undefined;
  hasToolCalls: boolean;
}): LanguageModelV4FinishReason['unified'] {
  switch (finishReason) {
    case 'STOP':
      return hasToolCalls ? 'tool-calls' : 'stop';
    case 'MAX_TOKENS':
      return 'length';
    case 'IMAGE_SAFETY':
    case 'RECITATION':
    case 'SAFETY':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
    case 'SPII':
      return 'content-filter';
    case 'MALFORMED_FUNCTION_CALL':
      return 'error';
    case 'FINISH_REASON_UNSPECIFIED':
    case 'OTHER':
    default:
      return 'other';
  }
}
