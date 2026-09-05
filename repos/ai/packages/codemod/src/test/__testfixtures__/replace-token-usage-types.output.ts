// @ts-nocheck
import { LanguageModelUsage, EmbeddingModelUsage } from 'ai';

function recordUsage(usage: LanguageModelUsage) {
  console.log(usage);
}

function processEmbedding(usage: EmbeddingModelUsage) {
  console.log(usage);
}

const handler = (data: LanguageModelUsage) => {
  console.log(data);
};
