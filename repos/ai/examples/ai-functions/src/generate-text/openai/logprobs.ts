import {
  openai,
  type OpenAILanguageModelChatOptions,
  type OpenaiResponsesProviderMetadata,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-4.1-mini'),
    prompt: 'Invent a new holiday and describe its traditions.',
    providerOptions: {
      openai: {
        logprobs: 2,
      } satisfies OpenAILanguageModelChatOptions,
    },
  });

  const providerMetadata = result.finalStep.providerMetadata as
    | OpenaiResponsesProviderMetadata
    | undefined;
  if (!providerMetadata) return;
  const {
    openai: { responseId, logprobs, serviceTier },
  } = providerMetadata;
  responseId && console.log(`responseId: ${responseId}`);
  serviceTier && console.log(`serviceTier: ${serviceTier}`);
  if (!logprobs) return;
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
});
