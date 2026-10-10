---
title: Knowledge Base Agent
description: Build an AI agent that can read from and write to a knowledge base using Upstash Search and the AI SDK
tags: ['node', 'retrieval', 'tools']
---

In this recipe, you'll learn how to build an AI agent that can interact with a knowledge base using [Upstash Search](https://upstash.com/docs/search). The agent will be able to both retrieve information from the knowledge base and add new resources to it, leveraging AI SDK tools.

Upstash Search offers input enrichment, reranking, semantic search, and full-text search for highly accurate results. It also provides a built-in embedding service, eliminating the need for a separate embedding provider. This makes it convenient for building and managing simple knowledge bases.

This example uses [the following essay](https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/examples/data/paul_graham/paul_graham_essay.txt) as input data (`essay.txt`).

For a more in-depth guide, check out the [RAG Agent Guide](/cookbook/guides/rag-chatbot), which shows you how to build a RAG Agent with [Next.js](https://nextjs.org), [Drizzle ORM](https://orm.drizzle.team/), and [Postgres](https://postgresql.org).

## Getting Started

Create an Upstash Search database on [Upstash Console](https://console.upstash.com/search). Once created, you will get a REST URL and a token. Set these in your environment variables:

```bash
UPSTASH_SEARCH_REST_URL="***"
UPSTASH_SEARCH_REST_TOKEN="***"
```

## Project Setup

Create a new empty directory for your project and initialize pnpm:

```bash
mkdir knowledge-base-agent
cd knowledge-base-agent
pnpm init
```

Install the AI SDK, OpenAI provider, Upstash Search packages, and tsx as a dev dependency:

```bash
pnpm i ai zod @ai-sdk/openai @upstash/search
pnpm i -D tsx
```

Finally, download and save the input essay:

```bash
curl -o essay.txt https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/examples/data/paul_graham/paul_graham_essay.txt
```

## Setting Up the Knowledge Base

Next, let's set up the initial knowledge base by reading a file and uploading its content to Upstash Search. Create a script called `setup.ts`:

```ts filename="setup.ts"
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { Search } from '@upstash/search';

type KnowledgeContent = {
  text: string;
  section: string;
  title?: string;
};

// Initialize Upstash Search client
const search = new Search({
  url: process.env.UPSTASH_SEARCH_REST_URL!,
  token: process.env.UPSTASH_SEARCH_REST_TOKEN!,
});

const index = search.index<KnowledgeContent>('knowledge-base');

async function setupKnowledgeBase() {
  // Read and process the source file
  const content = fs.readFileSync(path.join(__dirname, 'essay.txt'), 'utf8');

  // Split content into meaningful chunks
  const chunks = content
    .split(/\n\s*\n/) // Split by double line breaks (paragraphs)
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 50); // Only keep substantial chunks

  // Upload chunks to Upstash Search in batches of 100
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize).map((chunk, j) => ({
      id: `chunk-${i + j}`,
      content: {
        text: chunk,
        section: `section-${Math.floor((i + j) / 10)}`,
        title: chunk.split('\n')[0] || `Chunk ${i + j + 1}`,
      },
    }));
    await index.upsert(batch);
    console.log(
      `Upserted ${Math.min(i + batch.length, chunks.length)} chunks out of ${chunks.length} chunks`,
    );
  }
}

// Run setup
setupKnowledgeBase().catch(console.error);
```

Run the setup script to populate your knowledge base:

```bash
pnpm tsx setup.ts
```

Navigate to the Upstash Console and check the data browser of your Search database. You should see the essay has been indexed.

## Building the Knowledge Base Agent

Now let's create an agent that can interact with this knowledge base. Create a new file called `agent.ts`:

```ts filename="agent.ts"
import { tool, isStepCount, generateText, generateId } from 'ai';
import { z } from 'zod';
import { Search } from '@upstash/search';

import 'dotenv/config';

const search = new Search({
  url: process.env.UPSTASH_SEARCH_REST_URL!,
  token: process.env.UPSTASH_SEARCH_REST_TOKEN!,
});

type KnowledgeContent = {
  text: string;
  section: string;
  title?: string;
};

const index = search.index<KnowledgeContent>('knowledge-base');

async function main(prompt: string) {
  const { text } = await generateText({
    model: 'openai/gpt-4o',
    prompt,
    stopWhen: isStepCount(5),
    tools: {
      addResource: tool({
        description:
          'Add a new resource or piece of information to the knowledge base',
        inputSchema: z.object({
          resource: z
            .string()
            .describe('The content or resource to add to the knowledge base'),
          title: z
            .string()
            .optional()
            .describe('Optional title for the resource'),
        }),
        execute: async ({ resource, title }) => {
          const id = generateId();
          await index.upsert({
            id,
            content: {
              text: resource,
              section: 'user-added',
              title: title || `Resource ${id.slice(0, 8)}`,
            },
          });
          return `Successfully added resource "${title || 'Untitled'}" to knowledge base with ID: ${id}`;
        },
      }),
      searchKnowledge: tool({
        description:
          'Search the knowledge base to find relevant information for answering questions',
        inputSchema: z.object({
          query: z
            .string()
            .describe('The search query to find relevant information'),
          limit: z
            .number()
            .optional()
            .describe('Maximum number of results to return (default: 3)'),
        }),
        execute: async ({ query, limit = 3 }) => {
          const results = await index.search({
            query,
            limit,
            reranking: true,
          });

          if (results.length === 0) {
            return 'No relevant information found in the knowledge base.';
          }

          return results.map((hit, i) => ({
            resourceId: hit.id,
            rank: i + 1,
            title: hit.content.title || 'Untitled',
            content: hit.content.text || '',
            section: hit.content.section || 'unknown',
            score: hit.score,
          }));
        },
      }),
      deleteResource: tool({
        description: 'Delete a resource from the knowledge base',
        inputSchema: z.object({
          resourceId: z.string().describe('The ID of the resource to delete'),
        }),
        execute: async ({ resourceId }) => {
          try {
            await index.delete({ ids: [resourceId] });
            return `Successfully deleted resource with ID: ${resourceId}`;
          } catch (error) {
            return `Failed to delete resource: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        },
      }),
    },
    // log out intermediate steps
    onStepEnd: ({ toolResults }) => {
      if (toolResults.length > 0) {
        console.log('Tool results:');
        console.dir(toolResults, { depth: null });
      }
    },
  });

  return text;
}

const question =
  'What are the two main things I worked on before college? (utilize knowledge base)';

main(question).then(console.log).catch(console.error);
```

## Running the Agent

Now let's run the agent:

```bash
pnpm tsx agent.ts
```

The agent will utilize the knowledge base to answer questions, add new resources, and delete existing ones as needed. You can modify the `question` variable to test different queries and interactions with the knowledge base.
