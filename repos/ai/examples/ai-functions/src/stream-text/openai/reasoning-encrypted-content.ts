import { streamText } from 'ai';
import { run } from '../../lib/run';
import {
  openai,
  type OpenAILanguageModelResponsesOptions,
  type OpenaiResponsesReasoningProviderMetadata,
} from '@ai-sdk/openai';
run(async () => {
  const result = streamText({
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

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'reasoning-start':
        process.stdout.write('\x1b[34m');
        break;

      case 'reasoning-delta':
        process.stdout.write(chunk.text);
        break;

      case 'reasoning-end':
        process.stdout.write('\x1b[0m');
        process.stdout.write('\n');
        const providerMetadata = chunk.providerMetadata as
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

      case 'text-start':
        process.stdout.write('\x1b[0m');
        break;

      case 'text-delta':
        process.stdout.write(chunk.text);
        break;

      case 'text-end':
        process.stdout.write('\x1b[0m');
        console.log();
        break;
    }
  }
});
