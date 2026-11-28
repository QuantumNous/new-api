import type { LanguageModelV4FinishReason } from '@ai-sdk/provider';
import type { AmazonBedrockStopReason } from './amazon-bedrock-api-types';

export function mapAmazonBedrockFinishReason(
  finishReason: AmazonBedrockStopReason,
  isJsonResponseFromTool?: boolean,
): LanguageModelV4FinishReason['unified'] {
  switch (finishReason) {
    case 'stop_sequence':
    case 'end_turn':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'content_filtered':
    case 'guardrail_intervened':
      return 'content-filter';
    case 'tool_use':
      return isJsonResponseFromTool ? 'stop' : 'tool-calls';
    default:
      return 'other';
  }
}
