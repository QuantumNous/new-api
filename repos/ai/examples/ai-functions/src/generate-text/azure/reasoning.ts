import {
  azure,
  type AzureResponsesReasoningProviderMetadata,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/azure';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: azure('gpt-5'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    providerOptions: {
      azure: {
        reasoningEffort: 'low',
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
          | AzureResponsesReasoningProviderMetadata
          | undefined;
        if (!providerMetadata) break;
        const {
          azure: { itemId, reasoningEncryptedContent },
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
