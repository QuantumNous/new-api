---
title: Local Caching Middleware
description: Learn how to create a caching middleware for local development.
tags: ['streaming', 'caching', 'middleware']
---

# Local Caching Middleware

When developing AI applications, you'll often find yourself repeatedly making the same API calls during development. This can lead to increased costs and slower development cycles. A caching middleware allows you to store responses locally and reuse them when the same inputs are provided.

This approach is particularly useful in two scenarios:

1. **Iterating on UI/UX** - When you're focused on styling and user experience, you don't want to regenerate AI responses for every code change.
2. **Working on evals** - When developing evals, you need to repeatedly test the same prompts, but don't need new generations each time.

## Implementation

In this implementation, you create a JSON file to store responses. When a request is made, you first check if you have already seen this exact request. If you have, you return the cached response immediately (as a one-off generation or chunks of tokens). If not, you trigger the generation, save the response, and return it.

<Note>
  Make sure to add the path of your local cache to your `.gitignore` so you do
  not commit it.
</Note>

### How it works

For regular generations, you store and retrieve complete responses. Instead, the streaming implementation captures each token as it arrives, stores the full sequence, and on cache hits uses the SDK's `simulateReadableStream` utility to recreate the token-by-token streaming experience at a controlled speed (defaults to 10ms between chunks).

This approach gives you the best of both worlds:

- Instant responses for repeated queries
- Preserved streaming behavior for UI development

The middleware handles all transformations needed to make cached responses indistinguishable from fresh ones, including normalizing tool calls and fixing timestamp formats.

### Middleware

```ts
import {
  type LanguageModelV4Middleware,
  type LanguageModelV4StreamPart,
  type LanguageModelV4CallOptions,
  type LanguageModelV4,
} from '@ai-sdk/provider';
import { safeParseJSON } from '@ai-sdk/provider-utils';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { wrapLanguageModel, simulateReadableStream } from 'ai';

const CACHE_FILE = path.join(process.cwd(), '.cache/ai-cache.json');

export const cached = (model: LanguageModelV4) =>
  wrapLanguageModel({
    middleware: cacheMiddleware,
    model,
  });

const ensureCacheFile = () => {
  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  if (!fs.existsSync(CACHE_FILE)) {
    fs.writeFileSync(CACHE_FILE, '{}');
  }
};

const getCachedResult = (key: string | object) => {
  ensureCacheFile();
  const cacheKey = typeof key === 'object' ? JSON.stringify(key) : key;
  try {
    const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');

    const parseResult = safeParseJSON({ text: cacheContent });
    if (!parseResult.success) {
      console.error('Failed to parse cache:', parseResult.error);
      return null;
    }
    const cache = parseResult.value as Record<string, unknown>;

    const result = cache[cacheKey];

    return result ?? null;
  } catch (error) {
    console.error('Cache error:', error);
    return null;
  }
};

const updateCache = (key: string, value: any) => {
  ensureCacheFile();
  try {
    const parseResult = safeParseJSON({
      text: fs.readFileSync(CACHE_FILE, 'utf-8'),
    });
    const cache = parseResult.success
      ? (parseResult.value as Record<string, unknown>)
      : {};
    const updatedCache = { ...cache, [key]: value };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(updatedCache, null, 2));
  } catch (error) {
    console.error('Failed to update cache:', error);
  }
};

const cleanPrompt = (prompt: LanguageModelV4CallOptions['prompt']) => {
  return prompt.map(m => {
    if (m.role === 'assistant') {
      return {
        ...m,
        content: m.content.map(part =>
          part.type === 'tool-call' ? { ...part, toolCallId: 'cached' } : part,
        ),
      };
    }
    if (m.role === 'tool') {
      return {
        ...m,
        content: m.content.map(tc => ({
          ...tc,
          toolCallId: 'cached',
          result: {},
        })),
      };
    }

    return m;
  });
};

export const cacheMiddleware: LanguageModelV4Middleware = {
  specificationVersion: 'v4',
  wrapGenerate: async ({ doGenerate, params, model }) => {
    const cacheKey = JSON.stringify({
      prompt: cleanPrompt(params.prompt),
      _function: 'generate',
      model: model.modelId,
    });

    const cached = getCachedResult(cacheKey);

    if (cached && cached !== null) {
      return {
        ...cached,
        response: {
          ...cached.response,
          timestamp: cached?.response?.timestamp
            ? new Date(cached?.response?.timestamp)
            : undefined,
        },
      };
    }

    const result = await doGenerate();

    updateCache(cacheKey, result);

    return result;
  },

  wrapStream: async ({ doStream, params, model }) => {
    const cacheKey = JSON.stringify({
      prompt: cleanPrompt(params.prompt),
      _function: 'stream',
      model: model.modelId,
    });

    const cached = getCachedResult(cacheKey);

    if (cached && cached !== null) {
      const { chunks, ...rest } = cached;
      const formattedChunks = (chunks as LanguageModelV4StreamPart[]).map(p => {
        if (p.type === 'response-metadata' && p.timestamp) {
          return { ...p, timestamp: new Date(p.timestamp) };
        }
        return p;
      });

      return {
        stream: simulateReadableStream({
          initialDelayInMs: 0,
          chunkDelayInMs: 10,
          chunks: formattedChunks,
        }),
        ...rest,
      };
    }

    const { stream, ...rest } = await doStream();

    const fullResponse: LanguageModelV4StreamPart[] = [];

    const transformStream = new TransformStream<
      LanguageModelV4StreamPart,
      LanguageModelV4StreamPart
    >({
      transform(chunk, controller) {
        fullResponse.push(chunk);
        controller.enqueue(chunk);
      },

      flush() {
        updateCache(cacheKey, { chunks: fullResponse, ...rest });
      },
    });

    return {
      stream: stream.pipeThrough(transformStream),
      ...rest,
    };
  },
};
```

## Using the Middleware

The middleware can be easily integrated into your existing AI SDK setup:

```ts highlight="4,8"
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import 'dotenv/config';
import { cached } from '../middleware/your-cache-middleware';

async function main() {
  const result = streamText({
    model: cached(openai('gpt-4o')),
    maxOutputTokens: 512,
    temperature: 0.3,
    maxRetries: 5,
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
}

main().catch(console.error);
```

## Considerations

When using this caching middleware, keep these points in mind:

1. **Development Only** - This approach is intended for local development, not production environments
2. **Cache Invalidation** - You'll need to clear the cache (delete the cache file) when you want fresh responses
3. **Multi-Step Flows** - When using `stopWhen`, be aware that caching occurs at the individual language model response level, not across the entire execution flow. This means that while the model's generation is cached, the tool call is not and will run on each generation.
