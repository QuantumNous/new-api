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
      'What recent peer-reviewed research explains the relationship between sleep and memory consolidation?',
    providerOptions: {
      perplexity: {
        search_mode: 'academic',
        web_search_options: {
          search_context_size: 'low',
        },
      } satisfies PerplexityLanguageModelOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Sources:', await result.sources);
  console.log('Finish reason:', await result.finishReason);
  console.log('Usage:', await result.usage);
  console.log(
    'Metadata:',
    JSON.stringify((await result.finalStep).providerMetadata, null, 2),
  );
});
