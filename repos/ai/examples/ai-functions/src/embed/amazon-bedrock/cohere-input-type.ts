import {
  amazonBedrock,
  type AmazonBedrockEmbeddingModelOptions,
} from '@ai-sdk/amazon-bedrock';
import { embed } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // Use 'search_document' for documents to be searched,
  // and 'search_query' for search queries (default).
  const { embedding, usage, warnings } = await embed({
    model: amazonBedrock.embedding('cohere.embed-english-v3'),
    value: 'sunny day at the beach',
    providerOptions: {
      bedrock: {
        inputType: 'search_document',
      } satisfies AmazonBedrockEmbeddingModelOptions,
    },
  });

  console.log(embedding);
  console.log(usage);
  console.log(warnings);
});
