import {
  perplexity,
  type PerplexityLanguageModelOptions,
} from '@ai-sdk/perplexity';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log('Metadata:', result.finalStep.providerMetadata);
});
