---
title: Repair Malformed JSON with jsonrepair
description: Learn how to use the jsonrepair library to automatically fix truncated or malformed JSON output from language models.
tags: ['error-handling', 'json', 'structured-outputs']
---

# Repair Malformed JSON with jsonrepair

When generating structured outputs, language models sometimes produce malformed JSON output. This can happen due to:

- Truncated responses (hitting token limits)
- Syntax errors like single quotes instead of double quotes
- Missing closing brackets or braces
- Trailing commas

With AI SDK v6, a practical pattern is to generate text, repair it, then parse and validate it. Combined with the [`jsonrepair`](https://github.com/josdejong/jsonrepair) library, you can automatically fix many common JSON issues.

## Installation

First, install the `jsonrepair` library:

```bash
pnpm add jsonrepair
```

## Using with generateText

Here's how to use `jsonrepair` with `generateText`:

```ts
import { generateText, Output } from 'ai';
import { safeParseJSON } from '@ai-sdk/provider-utils';
__PROVIDER_IMPORT__;
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';

const recipeSchema = z.object({
  recipe: z.object({
    name: z.string(),
    ingredients: z.array(
      z.object({
        name: z.string(),
        amount: z.string(),
      }),
    ),
    steps: z.array(z.string()),
  }),
});

const result = await generateText({
  model: __MODEL__,
  output: Output.text(),
  prompt: 'Generate a lasagna recipe.',
});

const repairedText = jsonrepair(result.text);
const parseResult = safeParseJSON({ text: repairedText });

if (!parseResult.success) {
  throw parseResult.error;
}

const output = recipeSchema.parse(parseResult.value);
console.log(output.recipe);
```

## How it Works

This flow has three steps:

1. Generate plain text from the model (`Output.text()`).
2. Repair malformed JSON with `jsonrepair`.
3. Parse safely and validate with your schema.

## What jsonrepair Can Fix

The `jsonrepair` library can automatically fix many common issues:

- Missing closing brackets: `{"name": "test"` -> `{"name": "test"}`
- Single quotes: `{'name': 'test'}` -> `{"name": "test"}`
- Missing quotes around keys: `{name: "test"}` -> `{"name": "test"}`
- Trailing commas: `{"items": [1, 2, 3,]}` -> `{"items": [1, 2, 3]}`
- Comments in JSON
- Unescaped special characters

## Considerations

1. **Repair is Best-Effort** - While `jsonrepair` handles many cases, it cannot fix all malformed JSON (e.g., semantically incorrect data that happens to be valid JSON)
2. **Schema Validation** - Even after repair, the object must still match your schema. If the model produces structurally wrong data, repair won't help
3. **Truncated Content** - For severely truncated responses, consider increasing `maxOutputTokens` or simplifying your schema
