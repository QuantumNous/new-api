import {
  openai,
  type OpenAILanguageModelChatOptions,
  type OpenaiResponsesProviderMetadata,
} from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai('gpt-3.5-turbo'),
    maxOutputTokens: 512,
    temperature: 0.3,
    maxRetries: 5,
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      openai: {
        logprobs: 2,
      } satisfies OpenAILanguageModelChatOptions,
    },
  });

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta': {
        console.log('Text:', part.text);
        break;
      }

      case 'finish-step': {
        console.log();
        console.log(`finishReason: ${part.finishReason}`);
        const providerMetadata = part.providerMetadata as
          | OpenaiResponsesProviderMetadata
          | undefined;
        if (!providerMetadata) continue;
        const {
          openai: { responseId, logprobs, serviceTier },
        } = providerMetadata;
        responseId && console.log(`responseId: ${responseId}`);
        serviceTier && console.log(`serviceTier: ${serviceTier}`);
        if (!logprobs) continue;
        let printed = 0;
        for (const logprob of logprobs) {
          if (logprob != null) {
            for (const token_info of logprob) {
              console.log(
                `token: ${token_info.token} , logprob: ${token_info.logprob} , top_logprobs: ${JSON.stringify(token_info.top_logprobs)}`,
              );
            }
            console.log();
            printed++;
          }
          if (printed >= 5) break; // Output only the first 5 entries to prevent excessive logging
        }
        break;
      }

      case 'error':
        console.error('Error:', part.error);
        break;
    }
  }
});
