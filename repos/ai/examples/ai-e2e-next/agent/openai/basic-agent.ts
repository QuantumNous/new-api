import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { ToolLoopAgent, type InferAgentUIMessage } from 'ai';
export const openaiBasicAgent = new ToolLoopAgent({
  model: openai('gpt-5-mini'),
  reasoning: 'medium',
  providerOptions: {
    openai: {
      reasoningSummary: 'detailed',
      // store: false,
    } satisfies OpenAILanguageModelResponsesOptions,
  },
  onStepFinish: ({ request }) => {
    console.dir(request.body, { depth: Infinity });
  },
});

export type OpenAIBasicMessage = InferAgentUIMessage<typeof openaiBasicAgent>;
