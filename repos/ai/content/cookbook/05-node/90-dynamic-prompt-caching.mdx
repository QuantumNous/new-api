---
title: Dynamic Prompt Caching
description: Learn how to reduce API costs by implementing dynamic prompt caching for Anthropic models using cache control directives.
tags: ['caching', 'cost-optimization']
---

# Dynamic Prompt Caching

When building agents, API costs can add up quickly as conversations grow. Many providers offer prompt caching features that allow you to cache conversation prefixes, significantly reducing costs for repeated context.

This recipe shows a pattern you can copy into your project and customize for your specific providers and caching strategies. The example implementation covers Anthropic's recommended approach out of the box, but you can extend it to support other providers as needed.

This pattern is particularly useful when:

1. **Building agents with long conversations** - Multi-turn agent interactions accumulate context that gets resent with every request.
2. **Using tools heavily** - Tool calls and results add significant token overhead that benefits from caching.

For non-Anthropic models, messages pass through unchanged, making this safe to use in provider-agnostic code.

## Implementation

The utility adds Anthropic's `cacheControl` directive to your messages, marking the final message with `{ type: "ephemeral" }`. This tells Anthropic to cache everything up to that point, so subsequent requests only pay full price for new content.

### How it works

The function detects the model provider and applies the appropriate caching strategy. In this implementation, it checks for Anthropic models by examining the provider name and model ID. When it finds an Anthropic model, it adds `providerOptions` to the last message in your array with `cacheControl: { type: "ephemeral" }`. Per Anthropic's documentation: "Mark the final block of the final message with cache_control so the conversation can be incrementally cached."

For non-Anthropic models, the function returns your messages unchanged. You can extend this pattern to support other providers by adding detection logic and provider-specific options.

### Message-level vs block-level cache control

You might notice this implementation adds `providerOptions` at the **message level**, while Anthropic's API expects `cache_control` at the **content block level**. The AI SDK handles this translation automatically.

When you set `providerOptions` on a message, the SDK applies it to the last content block when constructing the API request. For example:

```ts
// What you write (message-level)
{
  role: 'user',
  content: [
    { type: 'text', text: 'First part' },
    { type: 'text', text: 'Second part' },
  ],
  providerOptions: {
    anthropic: { cacheControl: { type: 'ephemeral' } },
  },
}

// What the SDK sends to Anthropic (block-level)
{
  "role": "user",
  "content": [
    { "type": "text", "text": "First part" },
    { "type": "text", "text": "Second part", "cache_control": { "type": "ephemeral" } }
  ]
}
```

This behavior is intentional and consistent across user messages, assistant messages, and tool results. If you need finer control, you can also set `providerOptions` directly on individual content parts, which takes priority over message-level settings.

### Utility Function

```ts
import type { ModelMessage, JSONValue, LanguageModel } from 'ai';

function isAnthropicModel(model: LanguageModel): boolean {
  if (typeof model === 'string') {
    return model.includes('anthropic') || model.includes('claude');
  }
  return (
    model.provider === 'anthropic' ||
    model.provider.includes('anthropic') ||
    model.modelId.includes('anthropic') ||
    model.modelId.includes('claude')
  );
}

export function addCacheControlToMessages({
  messages,
  model,
  providerOptions = {
    anthropic: { cacheControl: { type: 'ephemeral' } },
  },
}: {
  messages: ModelMessage[];
  model: LanguageModel;
  providerOptions?: Record<string, Record<string, JSONValue>>;
}): ModelMessage[] {
  if (messages.length === 0) return messages;
  if (!isAnthropicModel(model)) return messages;

  return messages.map((message, index) => {
    if (index === messages.length - 1) {
      return {
        ...message,
        providerOptions: {
          ...message.providerOptions,
          ...providerOptions,
        },
      };
    }
    return message;
  });
}
```

## Using the Utility

Integrate the utility into your agent using the `prepareStep` callback with `generateText` and `stopWhen`:

```ts
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { addCacheControlToMessages } from './add-cache-control-to-messages';

async function main() {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: 'Help me analyze this codebase and suggest improvements.',
    stopWhen: isStepCount(10),
    tools: {
      // your tools here
      analyzeFile: tool({
        description: 'Analyze a file in the codebase',
        inputSchema: z.object({
          path: z.string().describe('Path to the file'),
        }),
        execute: async ({ path }) => {
          // implementation
          return { analysis: `Analysis of ${path}` };
        },
      }),
    },
    prepareStep: ({ messages, model }) => ({
      messages: addCacheControlToMessages({ messages, model }),
    }),
  });

  console.log(result.text);
}

main().catch(console.error);
```

You can also customize the cache control options if needed:

```ts
prepareStep: ({ messages, model }) => ({
  messages: addCacheControlToMessages({
    messages,
    model,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  }),
}),
```

## Considerations

When using this utility, keep these points in mind:

1. **Provider-specific behavior** - This implementation targets Anthropic models. For other providers, messages pass through unchanged. You can extend the pattern to support additional providers.
2. **Minimum token threshold** - Anthropic requires a minimum number of tokens before caching activates. Short conversations may not benefit. Other providers may have similar requirements.
3. **Cache lifetime** - Anthropic's ephemeral cache has a 5-minute TTL. Inactive conversations lose their cache. Check your provider's documentation for cache duration details.
4. **Cost structure** - With Anthropic, cached tokens cost 10% of input tokens, but cache writes cost 25% more. You save money when cache hits exceed cache misses. Cost structures vary by provider.
