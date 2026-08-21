---
title: Retrieval Augmented Generation
description: Learn how to use retrieval augmented generation using the AI SDK and Node
tags: ['node']
---

# Retrieval Augmented Generation

Retrieval Augmented Generation (RAG) is a technique that enhances the capabilities of language models by providing them with relevant information from external sources during the generation process.
This approach allows the model to access and incorporate up-to-date or specific knowledge that may not be present in its original training data.

This example uses [the following essay](https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/examples/data/paul_graham/paul_graham_essay.txt) as an input (`essay.txt`). This example uses a simple in-memory vector database to store and retrieve relevant information. Alternatively, you can check out our [Knowledge Base Agent example](/cookbook/node/knowledge-base-agent) which uses Upstash Search to generate embeddings and manage the knowledge base.

For a more in-depth guide, check out the [RAG Chatbot Guide](/cookbook/guides/rag-chatbot) which will show you how to build a RAG chatbot with [Next.js](https://nextjs.org), [Drizzle ORM](https://orm.drizzle.team/) and [Postgres](https://postgresql.org).

```ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { cosineSimilarity, embed, embedMany, generateText } from 'ai';

dotenv.config();

async function main() {
  const db: { embedding: number[]; value: string }[] = [];

  const essay = fs.readFileSync(path.join(__dirname, 'essay.txt'), 'utf8');
  const chunks = essay
    .split('.')
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 0 && chunk !== '\n');

  const { embeddings } = await embedMany({
    model: 'openai/text-embedding-3-small',
    values: chunks,
  });
  embeddings.forEach((e, i) => {
    db.push({
      embedding: e,
      value: chunks[i],
    });
  });

  const input =
    'What were the two main things the author worked on before college?';

  const { embedding } = await embed({
    model: 'openai/text-embedding-3-small',
    value: input,
  });
  const context = db
    .map(item => ({
      document: item,
      similarity: cosineSimilarity(embedding, item.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map(r => r.document.value)
    .join('\n');

  const { text } = await generateText({
    model: 'openai/gpt-4o',
    prompt: `Answer the following question based only on the provided context:
             ${context}

             Question: ${input}`,
  });
  console.log(text);
}

main().catch(console.error);
```
