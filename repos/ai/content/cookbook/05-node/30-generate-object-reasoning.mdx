---
title: Generate Object with a Reasoning Model
description: Learn how to generate structured data with a reasoning model using the AI SDK and Node
tags: ['node', 'structured data', 'reasoning']
---

# Generate Object with a Reasoning Model

Reasoning models, like [DeepSeek's](/providers/ai-sdk-providers/deepseek) R1, are gaining popularity due to their ability to understand and generate better responses to complex queries than non-reasoning models.
You may want to use these models to generate structured data. However, most (like R1 and [OpenAI's](/providers/ai-sdk-providers/openai) o1) do not support tool-calling or structured outputs.

One solution is to pass the output from a reasoning model through a smaller model that can output structured data (like gpt-4o-mini). These lightweight models can efficiently extract the structured data while adding very little overhead in terms of speed and cost.

```ts
import { generateText, Output } from 'ai';
import 'dotenv/config';
import { z } from 'zod';

async function main() {
  const { text: rawOutput } = await generateText({
    model: 'deepseek/deepseek-r1',
    prompt:
      'Predict the top 3 largest city by 2050. For each, return the name, the country, the reason why it will on the list, and the estimated population in millions.',
  });

  const { output } = await generateText({
    model: 'openai/gpt-4o-mini',
    prompt: 'Extract the desired information from this text: \n' + rawOutput,
    output: Output.array({
      element: z.object({
        name: z.string().describe('the name of the city'),
        country: z.string().describe('the name of the country'),
        reason: z
          .string()
          .describe(
            'the reason why the city will be one of the largest cities by 2050',
          ),
        estimatedPopulation: z.number(),
      }),
    }),
  });

  console.log(output);
}

main().catch(console.error);
```
