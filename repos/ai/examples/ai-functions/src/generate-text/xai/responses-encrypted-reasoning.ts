import { xai, type XaiLanguageModelResponsesOptions } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const models = ['grok-code-fast-1', 'grok-4-1-fast-reasoning'];
  for (const modelId of models) {
    console.log(`\n=> ${modelId}`);

    const result = await generateText({
      model: xai.responses(modelId),
      prompt: 'What is 2+2? Think carefully.',
      providerOptions: {
        xai: {
          store: false,
        } satisfies XaiLanguageModelResponsesOptions,
      },
    });

    console.log('Text:', result.text);
    console.log('Usage:', result.usage);
    const reasoningParts = result.content.filter(
      part => part.type === 'reasoning',
    );
    console.log('\nReasoning:');
    console.log('  - Parts found:', reasoningParts.length);

    if (reasoningParts.length > 0) {
      const reasoning = reasoningParts[0];
      const xaiMetadata = reasoning.providerMetadata?.xai as {
        itemId?: string;
        reasoningEncryptedContent?: string;
      };
      console.log('  - Summary length:', reasoning.text?.length || 0);
      console.log('  - Item ID:', xaiMetadata?.itemId);
      console.log(
        '  - Encrypted content length:',
        xaiMetadata?.reasoningEncryptedContent?.length || 0,
      );
      console.log(
        '  - Has encrypted content:',
        !!xaiMetadata?.reasoningEncryptedContent,
      );

      if (xaiMetadata?.reasoningEncryptedContent) {
        console.log(
          '  - Encrypted content (first 100 chars):',
          xaiMetadata.reasoningEncryptedContent.substring(0, 100) + '...',
        );
      }
    }
  }
});
