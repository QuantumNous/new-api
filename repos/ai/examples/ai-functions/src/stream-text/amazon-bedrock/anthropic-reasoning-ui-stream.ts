import {
  amazonBedrock,
  type AmazonBedrockLanguageModelChatOptions,
} from '@ai-sdk/amazon-bedrock';
import { streamText, toUIMessageStream } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: amazonBedrock('us.anthropic.claude-opus-4-7'),
    prompt:
      'Solve this step by step: if f(x) = x^3 - 6x^2 + 11x - 6, find all roots and prove they are correct.',
    maxOutputTokens: 55000,
    providerOptions: {
      bedrock: {
        // Without `reasoningConfig.display: 'summarized'` here, this won't include reasoning in the stream,
        // but it may still include a reasoning signature.
        reasoningConfig: {
          type: 'adaptive',
          maxReasoningEffort: 'high',
        },
      } satisfies AmazonBedrockLanguageModelChatOptions,
    },
  });

  const uiMessageStream = toUIMessageStream({
    stream: result.stream,
    sendReasoning: true,
  });

  const reader = uiMessageStream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(JSON.stringify(value));
  }
});
