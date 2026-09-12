import {
  perplexity,
  type PerplexityLanguageModelOptions,
} from '@ai-sdk/perplexity';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: perplexity('sonar-pro'),
    prompt:
      'Describe recent Mars rover discoveries and include relevant images.',
    providerOptions: {
      perplexity: {
        return_images: true,
        image_domain_filter: ['nasa.gov', 'esa.int'],
        image_format_filter: ['jpeg', 'png'],
      } satisfies PerplexityLanguageModelOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
  console.log(
    'Metadata:',
    JSON.stringify((await result.finalStep).providerMetadata, null, 2),
  );
});
