import {
  openai,
  type OpenAILanguageModelResponsesOptions,
  type OpenaiResponsesReasoningProviderMetadata,
} from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai('gpt-5'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    reasoning: 'low',
    providerOptions: {
      openai: {
        reasoningSummary: 'detailed',
      } satisfies OpenAILanguageModelResponsesOptions,
    },
  });

  for (const part of result.content) {
    switch (part.type) {
      case 'reasoning': {
        console.log('--- reasoning ---');
        console.log(part.text);
        const providerMetadata = part.providerMetadata as
          | OpenaiResponsesReasoningProviderMetadata
          | undefined;
        if (!providerMetadata) break;
        const {
          openai: { itemId, reasoningEncryptedContent },
        } = providerMetadata;
        console.log(`itemId: ${itemId}`);

        // In the Responses API, store is set to true by default, so conversation history is cached.
        // The reasoning tokens from that interaction are also cached, and as a result, reasoningEncryptedContent returns null.
        console.log(`reasoningEncryptedContent: ${reasoningEncryptedContent}`);
        break;
      }
      case 'text': {
        console.log('--- text ---');
        console.log(part.text);
        break;
      }
    }
    console.log();
  }
});
