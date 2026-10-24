import { mistral, type MistralEmbeddingModelOptions } from '@ai-sdk/mistral';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embedding, usage, warnings } = await embed({
    model: mistral.embedding('codestral-embed-2505'),
    value: 'function add(a: number, b: number) { return a + b; }',
    providerOptions: {
      mistral: {
        metadata: {
          source: 'examples/ai-functions',
          useCase: 'single-embedding-provider-options',
        },
        outputDimension: 1024,
        outputDtype: 'float',
      } satisfies MistralEmbeddingModelOptions,
    },
  });

  console.log('embedding dimensions:', embedding.length);
  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
