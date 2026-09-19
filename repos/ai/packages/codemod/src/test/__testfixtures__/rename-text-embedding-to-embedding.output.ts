// @ts-nocheck
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { embed, embedMany } from 'ai';

// Using the full method name
const model1 = openai.embeddingModel('text-embedding-3-small');

// Using the shorthand
const model2 = openai.embedding('text-embedding-3-small');

// With other providers
const model3 = anthropic.embeddingModel('some-model');
const model4 = anthropic.embedding('some-model');

// In embed function
const { embedding } = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'sunny day at the beach',
});

// In embedMany function
const { embeddings } = await embedMany({
  model: openai.embeddingModel('text-embedding-3-small'),
  values: ['sunny day at the beach', 'rainy afternoon'],
});

// Assigned to variable without immediate call
const embeddingFn = openai.embedding;
const embeddingModelFn = openai.embeddingModel;

// Chained usage
async function getEmbedding(text: string) {
  return embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text,
  });
}

