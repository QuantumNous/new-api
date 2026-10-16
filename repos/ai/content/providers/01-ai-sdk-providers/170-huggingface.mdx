---
title: Hugging Face
description: Learn how to use Hugging Face Provider.
---

# Hugging Face Provider

The [Hugging Face](https://huggingface.co/) provider offers access to thousands of language models through [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/index), including models from Meta, DeepSeek, Qwen, and more.

API keys can be obtained from [Hugging Face Settings](https://huggingface.co/settings/tokens).

## Setup

The Hugging Face provider is available via the `@ai-sdk/huggingface` module. You can install it with:

<InstallPackages packages="@ai-sdk/huggingface" />

## Provider Instance

You can import the default provider instance `huggingFace` from `@ai-sdk/huggingface`:

```ts
import { huggingFace } from '@ai-sdk/huggingface';
```

For custom configuration, you can import `createHuggingFace` and create a provider instance with your settings:

```ts
import { createHuggingFace } from '@ai-sdk/huggingface';

const huggingFace = createHuggingFace({
  apiKey: process.env.HUGGINGFACE_API_KEY ?? '',
});
```

You can use the following optional settings to customize the Hugging Face provider instance:

- **baseURL** _string_

  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://router.huggingface.co/v1`.

- **apiKey** _string_

  API key that is being sent using the `Authorization` header. It defaults to
  the `HUGGINGFACE_API_KEY` environment variable. You can get your API key
  from [Hugging Face Settings](https://huggingface.co/settings/tokens).

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

- **fetch** _(input: RequestInfo, init?: RequestInit) => Promise&lt;Response&gt;_

  Custom [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) implementation.

## Language Models

You can create language models using a provider instance:

```ts
import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const { text } = await generateText({
  model: huggingFace('deepseek-ai/DeepSeek-V3-0324'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

You can also use the `.responses()` or `.languageModel()` factory methods:

```ts
const model = huggingFace.responses('deepseek-ai/DeepSeek-V3-0324');
// or
const model = huggingFace.languageModel('moonshotai/Kimi-K2-Instruct');
```

Hugging Face language models can be used in the `streamText` function
(see [AI SDK Core](/docs/ai-sdk-core)).

You can explore the latest and trending models with their capabilities, context size, throughput and pricing on the [Hugging Face Inference Models](https://huggingface.co/inference/models) page.

### Provider Options

Hugging Face language models support provider-specific options that you can pass via `providerOptions.huggingface`:

```ts
import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const { text } = await generateText({
  model: huggingFace('deepseek-ai/DeepSeek-R1'),
  prompt: 'Explain the theory of relativity.',
  providerOptions: {
    huggingface: {
      reasoningEffort: 'high',
      instructions: 'Respond in a clear and educational manner.',
    },
  },
});
```

The following provider options are available:

- **metadata** _Record&lt;string, string&gt;_

  Additional metadata to include with the request.

- **instructions** _string_

  Instructions for the model. Can be used to provide additional context or guidance.

- **strictJsonSchema** _boolean_

  Whether to use strict JSON schema validation for structured outputs. Defaults to `false`.

- **reasoningEffort** _string_

  Controls the reasoning effort for reasoning models like DeepSeek-R1. Higher values result in more thorough reasoning.

### Reasoning Output

For reasoning models like `deepseek-ai/DeepSeek-R1`, you can control the reasoning effort and access the model's reasoning process in the response:

```ts
import { huggingFace } from '@ai-sdk/huggingface';
import { streamText } from 'ai';

const result = streamText({
  model: huggingFace('deepseek-ai/DeepSeek-R1'),
  prompt: 'How many r letters are in the word strawberry?',
  providerOptions: {
    huggingface: {
      reasoningEffort: 'high',
    },
  },
});

for await (const part of result.stream) {
  if (part.type === 'reasoning') {
    console.log(`Reasoning: ${part.textDelta}`);
  } else if (part.type === 'text-delta') {
    process.stdout.write(part.textDelta);
  }
}
```

For non-streaming calls with `generateText`, the reasoning content is available in the `reasoning` field of the response:

```ts
import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';

const result = await generateText({
  model: huggingFace('deepseek-ai/DeepSeek-R1'),
  prompt: 'What is 25 * 37?',
  providerOptions: {
    huggingface: {
      reasoningEffort: 'medium',
    },
  },
});

console.log('Reasoning:', result.reasoning);
console.log('Answer:', result.text);
```

### Image Input

For vision-capable models like `Qwen/Qwen2.5-VL-7B-Instruct`, you can pass images as part of the message content:

```ts
import { huggingFace } from '@ai-sdk/huggingface';
import { generateText } from 'ai';
import { readFileSync } from 'fs';

const result = await generateText({
  model: huggingFace('Qwen/Qwen2.5-VL-7B-Instruct'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image in detail.' },
        {
          type: 'file',
          mediaType: 'image',
          data: readFileSync('./image.png'),
        },
      ],
    },
  ],
});
```

You can also pass image URLs:

```ts
{
  type: 'file',
  mediaType: 'image',
  data: 'https://example.com/image.png',
}
```

## Model Capabilities

| Model                                           | Image Input | Object Generation | Tool Usage | Tool Streaming |
| ----------------------------------------------- | ----------- | ----------------- | ---------- | -------------- |
| `meta-llama/Llama-3.1-8B-Instruct`              | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Llama-3.1-70B-Instruct`             | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Llama-3.3-70B-Instruct`             | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Llama-4-Maverick-17B-128E-Instruct` | <Cross />   | <Check />         | <Check />  | <Check />      |
| `deepseek-ai/DeepSeek-V3.1`                     | <Cross />   | <Check />         | <Check />  | <Check />      |
| `deepseek-ai/DeepSeek-V3-0324`                  | <Cross />   | <Check />         | <Check />  | <Check />      |
| `deepseek-ai/DeepSeek-R1`                       | <Cross />   | <Check />         | <Check />  | <Check />      |
| `deepseek-ai/DeepSeek-R1-Distill-Llama-70B`     | <Cross />   | <Check />         | <Check />  | <Check />      |
| `Qwen/Qwen3-32B`                                | <Cross />   | <Check />         | <Check />  | <Check />      |
| `Qwen/Qwen3-Coder-480B-A35B-Instruct`           | <Cross />   | <Check />         | <Check />  | <Check />      |
| `Qwen/Qwen2.5-VL-7B-Instruct`                   | <Check />   | <Check />         | <Check />  | <Check />      |
| `google/gemma-3-27b-it`                         | <Cross />   | <Check />         | <Check />  | <Check />      |
| `moonshotai/Kimi-K2-Instruct`                   | <Cross />   | <Check />         | <Check />  | <Check />      |

<Note>
  The table above lists popular models. You can explore all available models on
  the [Hugging Face Inference Models](https://huggingface.co/inference/models)
  page. The capabilities depend on the specific model you're using. Check the
  model documentation on Hugging Face Hub for detailed information about each
  model's features.
</Note>
