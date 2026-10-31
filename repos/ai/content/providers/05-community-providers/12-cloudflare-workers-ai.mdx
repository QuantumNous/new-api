---
title: Cloudflare Workers AI
description: Learn how to use the Cloudflare Workers AI provider for the AI SDK.
---

# Cloudflare Workers AI

[workers-ai-provider](https://github.com/cloudflare/ai/tree/main/packages/workers-ai-provider) is a community provider that allows you to use Cloudflare's [Workers AI](https://ai.cloudflare.com/) models with the AI SDK.

## Setup

The Cloudflare Workers AI provider is available in the `workers-ai-provider` module. You can install it with:

<InstallPackages packages="workers-ai-provider" />

Then, setup an AI binding in your Cloudflare Workers project `wrangler.toml` file:

```bash filename="wrangler.toml"
[ai]
binding = "AI"
```

## Provider Instance

To create a `workersai` provider instance, use the `createWorkersAI` function, passing in the AI binding as an option:

```typescript
import { createWorkersAI } from 'workers-ai-provider';

const workersai = createWorkersAI({ binding: env.AI });
```

## Language Models

To create a model instance, call the provider instance and specify the model you would like to use as the first argument. You can also pass additional settings in the second argument:

```typescript highlight="4-7"
import { createWorkersAI } from 'workers-ai-provider';

const workersai = createWorkersAI({ binding: env.AI });
const model = workersai('@cf/meta/llama-3.1-8b-instruct', {
  // additional settings
  safePrompt: true,
});
```

You can use the following optional settings to customize:

- **safePrompt** _boolean_

  Whether to inject a safety prompt before all conversations. Defaults to `false`

### Examples

You can use Cloudflare Workers AI language models to generate text with the **`generateText`** or **`streamText`** function:

#### `generateText`

```typescript
import { createWorkersAI } from 'workers-ai-provider';
import { generateText } from 'ai';

type Env = {
  AI: Ai;
};

export default {
  async fetch(_: Request, env: Env) {
    const workersai = createWorkersAI({ binding: env.AI });
    const result = await generateText({
      model: workersai('@cf/meta/llama-2-7b-chat-int8'),
      prompt: 'Write a 50-word essay about hello world.',
    });

    return new Response(result.text);
  },
};
```

#### `streamText`

```typescript
import { createWorkersAI } from 'workers-ai-provider';
import { createTextStreamResponse, streamText, toTextStream } from 'ai';

type Env = {
  AI: Ai;
};

export default {
  async fetch(_: Request, env: Env) {
    const workersai = createWorkersAI({ binding: env.AI });
    const result = streamText({
      model: workersai('@cf/meta/llama-2-7b-chat-int8'),
      prompt: 'Write a 50-word essay about hello world.',
    });

    return createTextStreamResponse({
      stream: toTextStream({ stream: result.stream }),
      headers: {
        // add these headers to ensure that the
        // response is chunked and streamed
        'Content-Type': 'text/x-unknown',
        'content-encoding': 'identity',
        'transfer-encoding': 'chunked',
      },
    });
  },
};
```

#### Structured Output

Some Cloudflare Workers AI language models also support structured data generation with [`Output`](/docs/reference/ai-sdk-core/output):

```typescript
import { createWorkersAI } from 'workers-ai-provider';
import { generateText, Output } from 'ai';
import { z } from 'zod';

type Env = {
  AI: Ai;
};

export default {
  async fetch(_: Request, env: Env) {
    const workersai = createWorkersAI({ binding: env.AI });
    const result = await generateText({
      model: workersai('@cf/meta/llama-3.1-8b-instruct'),
      prompt: 'Generate a Lasagna recipe',
      output: Output.object({
        schema: z.object({
          recipe: z.object({
            ingredients: z.array(z.string()),
            description: z.string(),
          }),
        }),
      }),
    });

    return Response.json(result.output);
  },
};
```
