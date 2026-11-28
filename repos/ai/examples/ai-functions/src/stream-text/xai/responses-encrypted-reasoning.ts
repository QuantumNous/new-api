import { xai, type XaiLanguageModelResponsesOptions } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const models = ['grok-code-fast-1', 'grok-4-1-fast-reasoning'];

  for (const modelId of models) {
    console.log(`\n=> ${modelId}`);

    const result = streamText({
      model: xai.responses(modelId),
      prompt: 'What is 2+2? Think carefully.',
      providerOptions: {
        xai: {
          store: false,
        } satisfies XaiLanguageModelResponsesOptions,
      },
    });

    let textContent = '';
    let reasoningSummary = '';
    let encryptedContent: string | undefined;
    let itemId: string | undefined;

    for await (const part of result.stream) {
      if (part.type === 'text-delta') {
        textContent += part.text || '';
      }

      if (part.type === 'reasoning-delta') {
        reasoningSummary += part.text || '';
      }

      if (part.type === 'reasoning-end') {
        const xaiMetadata = part.providerMetadata?.xai as {
          itemId?: string;
          reasoningEncryptedContent?: string;
        };
        if (xaiMetadata) {
          encryptedContent = xaiMetadata?.reasoningEncryptedContent;
          itemId = xaiMetadata.itemId;
        }
      }
    }

    console.log('Text:', textContent);
    console.log('\nUsage:', await result.usage);
    console.log('\nReasoning:');
    console.log('  - Summary length:', reasoningSummary.length);
    console.log('  - Item ID:', itemId);
    console.log('  - Encrypted content length:', encryptedContent?.length || 0);
    console.log('  - Has encrypted content:', !!encryptedContent);

    if (encryptedContent) {
      console.log(
        '  - Encrypted content (first 100 chars):',
        encryptedContent.substring(0, 100) + '...',
      );
    }
  }
});
