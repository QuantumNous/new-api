import type { LanguageModelV4FinishReason } from '@ai-sdk/provider';

export function mapPerplexityFinishReason(
  finishReason: string | null | undefined,
): LanguageModelV4FinishReason['unified'] {
  switch (finishReason) {
    case 'stop':
    case 'length':
      return finishReason;
    default:
      return 'other';
  }
}
