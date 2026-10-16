---
title: Reasoning
description: Learn how to control reasoning across providers with the top-level reasoning parameter.
---

# Reasoning

Many language models support an internal "reasoning" phase (sometimes also called "thinking") before producing a response. The AI SDK provides a top-level `reasoning` parameter on [`generateText`](/docs/reference/ai-sdk-core/generate-text) and [`streamText`](/docs/reference/ai-sdk-core/stream-text) that controls this behavior across providers with a single, portable setting.

## Basic Usage

```ts
import { generateText } from 'ai';

const { text, reasoning, reasoningText } = await generateText({
  model: 'anthropic/claude-sonnet-4.6',
  reasoning: 'medium',
  prompt: 'How many people will live in the world in 2040?',
});
```

The `reasoning` parameter accepts the following values:

| Value                | Behavior                                                             |
| -------------------- | -------------------------------------------------------------------- |
| `'provider-default'` | Use the provider's default reasoning behavior (default when omitted) |
| `'none'`             | Disable reasoning                                                    |
| `'minimal'`          | Bare-minimum reasoning                                               |
| `'low'`              | Fast, concise reasoning                                              |
| `'medium'`           | Balanced reasoning                                                   |
| `'high'`             | Thorough reasoning                                                   |
| `'xhigh'`            | Maximum reasoning                                                    |

## Streaming

The `reasoning` parameter works the same way with `streamText`:

```ts
import { streamText } from 'ai';

const result = streamText({
  model: 'google/gemini-3-flash-preview',
  reasoning: 'high',
  prompt: 'Explain the Riemann hypothesis in simple terms.',
});

for await (const part of result.stream) {
  if (part.type === 'reasoning') {
    process.stdout.write(part.textDelta);
  } else if (part.type === 'text-delta') {
    process.stdout.write(part.textDelta);
  }
}
```

## Precedence Rules

The top-level `reasoning` parameter and provider-specific `providerOptions` are **never merged**. If you set reasoning-related options in `providerOptions`, they take full precedence and the top-level `reasoning` parameter is ignored.

```ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai.responses('gpt-5.4'),
  reasoning: 'low', // ignored because providerOptions.openai.reasoningEffort is set
  providerOptions: {
    openai: {
      reasoningEffort: 'high', // this wins
    },
  },
  prompt: 'Explain quantum entanglement.',
});
```

This design lets you use the portable `reasoning` parameter by default and fall back to `providerOptions` only when you need provider-specific features like exact token budgets.

## Provider Support

The `reasoning` parameter is supported by the following providers: OpenAI, Anthropic, Google, xAI, Groq, DeepSeek, Fireworks, and Amazon Bedrock. Each provider translates the value to its native reasoning API. Some providers support all six levels natively, while others coerce to fewer levels (a warning is emitted when coercion occurs). Some providers use a numeric token budget instead of an enum for reasoning control; in those cases the top-level `reasoning` value is mapped to a budget calculated as a percentage of the model's maximum output tokens.

Providers that do not support reasoning (e.g. Mistral, Perplexity, Cohere) emit an `unsupported` warning and ignore the parameter.

## Migrating from `providerOptions`

If you currently control reasoning via `providerOptions`, you can migrate to the top-level `reasoning` parameter for portability across providers.

### Before (Anthropic)

```ts
const { text } = await generateText({
  model: anthropic('claude-opus-4.6'),
  providerOptions: {
    anthropic: {
      thinking: { type: 'adaptive', effort: 'high' },
    },
  },
  prompt: 'How many people will live in the world in 2040?',
});
```

### After (Anthropic)

```ts
const { text } = await generateText({
  model: anthropic('claude-opus-4.6'),
  reasoning: 'high',
  prompt: 'How many people will live in the world in 2040?',
});
```

### Before (Anthropic with older model)

```ts
const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 12000 },
    },
  },
  prompt: 'How many people will live in the world in 2040?',
});
```

### After (Anthropic with older model)

```ts
const { text } = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  reasoning: 'medium',
  prompt: 'How many people will live in the world in 2040?',
});
```

If you need to enforce an exact token budget (e.g. exactly 12000 tokens), keep using `providerOptions` instead of the top-level `reasoning` parameter.

### Before (Google with `includeThoughts`)

```ts
const { text } = await generateText({
  model: google('gemini-3-flash-preview'),
  providerOptions: {
    google: {
      thinkingConfig: { thinkingBudget: 4096, includeThoughts: true },
    },
  },
  prompt: 'Explain the Riemann hypothesis in simple terms.',
});
```

### After (Google with `includeThoughts`)

```ts
const { text } = await generateText({
  model: google('gemini-3-flash-preview'),
  reasoning: 'medium',
  providerOptions: {
    google: { thinkingConfig: { includeThoughts: true } },
  },
  prompt: 'Explain the Riemann hypothesis in simple terms.',
});
```

### Before (OpenAI with `reasoningSummary`)

```ts
const { text } = await generateText({
  model: openai.responses('o3'),
  providerOptions: {
    openai: { reasoningEffort: 'high', reasoningSummary: 'auto' },
  },
  prompt: 'Explain quantum entanglement.',
});
```

### After (OpenAI with `reasoningSummary`)

```ts
const { text } = await generateText({
  model: openai.responses('o3'),
  reasoning: 'high',
  providerOptions: {
    openai: { reasoningSummary: 'auto' },
  },
  prompt: 'Explain quantum entanglement.',
});
```

Note that `providerOptions` can still be used alongside `reasoning` for provider-specific features unrelated to reasoning effort. However, if `providerOptions` includes reasoning effort/budget settings (e.g. `reasoningEffort`, `thinking`, `thinkingConfig.thinkingBudget`), those take full precedence and the top-level `reasoning` parameter is ignored.
