// @ts-nocheck
import { TokenUsage, CompletionTokenUsage, EmbeddingTokenUsage } from 'ai';

function recordUsage(usage: TokenUsage) {
  console.log(usage);
}

function processEmbedding(usage: EmbeddingTokenUsage) {
  console.log(usage);
}

const handler = (data: CompletionTokenUsage) => {
  console.log(data);
};
