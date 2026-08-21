import { openai } from '@ai-sdk/openai';
import { cosineSimilarity, embedMany } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const { embeddings, warnings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: ['sunny day at the beach', 'rainy afternoon in the city'],
  });

  console.log(
    `cosine similarity: ${cosineSimilarity(embeddings[0], embeddings[1])}`,
  );
  console.log(warnings);
});
