import { generateText } from 'ai';
import { run } from '../../lib/run';
import {
  openai,
  type OpenAILanguageModelResponsesOptions,
  type OpenaiResponsesReasoningProviderMetadata,
} from '@ai-sdk/openai';
run(async () => {
  const result = await generateText({
    model: openai('gpt-5'),
    prompt: 'How many "r"s are in the word "strawberry"?',
    reasoning: 'low',
    providerOptions: {
      openai: {
        reasoningSummary: 'detailed',
        store: false,
        include: ['reasoning.encrypted_content'], // Use encrypted reasoning items
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

        // In the Responses API, explicitly setting store to false opts out of both conversation history and reasoning token storage.
        // As a result, reasoningEncryptedContent is used to restore the reasoning tokens for the conversation history.
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
