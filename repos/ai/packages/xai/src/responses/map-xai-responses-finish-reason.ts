import type { LanguageModelV4FinishReason } from '@ai-sdk/provider';

export function mapXaiResponsesFinishReason(
  finishReason: string | null | undefined,
): LanguageModelV4FinishReason['unified'] {
  switch (finishReason) {
    case 'stop':
    case 'completed':
      return 'stop';
    case 'length':
    case 'max_output_tokens':
      return 'length';
    case 'tool_calls':
    case 'function_call':
      return 'tool-calls';
    case 'content_filter':
      return 'content-filter';
    default:
      return 'other';
  }
}
