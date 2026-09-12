import { mistral, type MistralEmbeddingModelOptions } from '@ai-sdk/mistral';
import { embedMany } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embeddings, usage, warnings } = await embedMany({
    model: mistral.embedding('codestral-embed-2505'),
    values: [
      'function add(a: number, b: number) { return a + b; }',
      'function subtract(a: number, b: number) { return a - b; }',
      'function multiply(a: number, b: number) { return a * b; }',
    ],
    providerOptions: {
      mistral: {
        metadata: {
          source: 'examples/ai-functions',
          useCase: 'batch-embedding-provider-options',
        },
        outputDimension: 1024,
        outputDtype: 'int8',
      } satisfies MistralEmbeddingModelOptions,
    },
  });

  console.log('embedding count:', embeddings.length);
  console.log('embedding dimensions:', embeddings[0].length);
  console.log(embeddings);
  console.log(usage);
  console.log(warnings);
});
