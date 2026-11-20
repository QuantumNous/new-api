import type { LanguageModelV4ToolChoice } from '@ai-sdk/provider';
import type { ToolChoice } from '../types/language-model';

export function prepareToolChoice({
  toolChoice,
}: {
  // use of any because it doesn't matter for tool choice preparation
  toolChoice: ToolChoice<any> | undefined;
}): LanguageModelV4ToolChoice {
  return toolChoice == null
    ? { type: 'auto' }
    : typeof toolChoice === 'string'
      ? { type: toolChoice }
      : { type: 'tool' as const, toolName: toolChoice.toolName as string };
}
