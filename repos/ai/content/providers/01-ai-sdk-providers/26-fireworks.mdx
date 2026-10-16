---
title: Fireworks
description: Learn how to use Fireworks models with the AI SDK.
---

# Fireworks Provider

[Fireworks](https://fireworks.ai/) is a platform for running and testing LLMs through their [API](https://readme.fireworks.ai/).

## Setup

The Fireworks provider is available via the `@ai-sdk/fireworks` module. You can install it with

<InstallPackages packages="@ai-sdk/fireworks" />

## Provider Instance

You can import the default provider instance `fireworks` from `@ai-sdk/fireworks`:

```ts
import { fireworks } from '@ai-sdk/fireworks';
```

If you need a customized setup, you can import `createFireworks` from `@ai-sdk/fireworks`
and create a provider instance with your settings:

```ts
import { createFireworks } from '@ai-sdk/fireworks';

const fireworks = createFireworks({
  apiKey: process.env.FIREWORKS_API_KEY ?? '',
});
```

You can use the following optional settings to customize the Fireworks provider instance:

- **baseURL** _string_

  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://api.fireworks.ai/inference/v1`.

- **apiKey** _string_

  API key that is being sent using the `Authorization` header. It defaults to
  the `FIREWORKS_API_KEY` environment variable.

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

- **fetch** _(input: RequestInfo, init?: RequestInit) => Promise&lt;Response&gt;_

  Custom [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) implementation.

## Language Models

You can create [Fireworks models](https://fireworks.ai/models) using a provider instance.
The first argument is the model id, e.g. `accounts/fireworks/models/firefunction-v1`:

```ts
const model = fireworks('accounts/fireworks/models/firefunction-v1');
```

### Reasoning Models

Fireworks exposes the thinking of `deepseek-r1` in the generated text using the `<think>` tag.
You can use the `extractReasoningMiddleware` to extract this reasoning and expose it as a `reasoning` property on the result:

```ts
import { fireworks } from '@ai-sdk/fireworks';
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';

const enhancedModel = wrapLanguageModel({
  model: fireworks('accounts/fireworks/models/deepseek-r1'),
  middleware: extractReasoningMiddleware({ tagName: 'think' }),
});
```

You can then use that enhanced model in functions like `generateText` and `streamText`.

### Example

You can use Fireworks language models to generate text with the `generateText` function:

```ts
import { fireworks } from '@ai-sdk/fireworks';
import { generateText } from 'ai';

const { text } = await generateText({
  model: fireworks('accounts/fireworks/models/firefunction-v1'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

Fireworks language models can also be used in the `streamText` function
(see [AI SDK Core](/docs/ai-sdk-core)).

### Provider Options

Fireworks chat models support additional provider options that are not part of
the [standard call settings](/docs/ai-sdk-core/settings). You can pass them in the `providerOptions` argument:

```ts
import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { generateText } from 'ai';

const { text, reasoningText } = await generateText({
  model: fireworks('accounts/fireworks/models/kimi-k2p6'),
  providerOptions: {
    fireworks: {
      thinking: { type: 'enabled', budgetTokens: 4096 },
      reasoningHistory: 'interleaved',
    } satisfies FireworksLanguageModelOptions,
  },
  prompt: 'How many "r"s are in the word "strawberry"?',
});
```

The following optional provider options are available for Fireworks chat models:

- **promptCacheKey** _string_

  A stable, opaque key that improves prompt cache hit rates by routing requests
  with shared prompt prefixes to the same Fireworks replica. Reuse the same key
  for all steps and calls in one conversation, and use different keys for
  unrelated conversations.

- **serviceTier** _'priority'_

  Uses the Fireworks Priority serving path for higher reliability during peak
  traffic. The provider sends it as Fireworks' `service_tier` request field.

- **thinking** _object_

  Configuration for thinking/reasoning models like Kimi K2.6.
  - **type** _'enabled' | 'disabled'_

    Whether to enable thinking mode.

  - **budgetTokens** _number_

    Maximum number of tokens for thinking (minimum 1024).

- **reasoningHistory** _'disabled' | 'interleaved' | 'preserved'_

  Controls how reasoning history is handled in multi-turn conversations:
  - `'disabled'`: Remove reasoning from history
  - `'interleaved'`: Include reasoning between tool calls within a single turn
  - `'preserved'`: Keep all reasoning in history

### Prompt Cache Affinity

[Fireworks prompt caching](https://docs.fireworks.ai/guides/prompt-caching)
is automatic, but cached prefixes are local to a replica. Set
`promptCacheKey` to an opaque session or conversation identifier to improve
cache affinity. The provider sends it as Fireworks'
[`prompt_cache_key`](https://docs.fireworks.ai/api-reference/post-chatcompletions)
request field.

The AI SDK reuses the same provider options for every model step in a
multi-step `generateText` or `streamText` call, so one key covers the complete
tool loop:

```ts
import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { generateText, isStepCount, tool } from 'ai';
import { z } from 'zod';

const sessionId = 'conversation-123';

const result = await generateText({
  model: fireworks('accounts/fireworks/models/kimi-k2p6'),
  providerOptions: {
    fireworks: {
      promptCacheKey: sessionId,
    } satisfies FireworksLanguageModelOptions,
  },
  tools: {
    weather: tool({
      description: 'Get the weather for a city.',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => `It is sunny in ${city}.`,
    }),
  },
  stopWhen: isStepCount(5),
  prompt: 'What is the weather in San Francisco?',
});

console.log(result.usage.inputTokenDetails.cacheReadTokens);
```

For a reusable `ToolLoopAgent`, use call options to supply a key for each
conversation. Pass the same key again for later agent calls that continue that
conversation:

```ts
import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { weatherTool } from './weather-tool';

const agent = new ToolLoopAgent({
  model: fireworks('accounts/fireworks/models/kimi-k2p6'),
  callOptionsSchema: z.object({
    sessionId: z.string(),
  }),
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    providerOptions: {
      fireworks: {
        promptCacheKey: options.sessionId,
      } satisfies FireworksLanguageModelOptions,
    },
  }),
  tools: { weather: weatherTool },
});

const result = await agent.generate({
  prompt: 'What is the weather in San Francisco?',
  options: {
    sessionId: 'conversation-123',
  },
});
```

Use non-identifying values for cache keys rather than email addresses or other
personal information.

### Priority Service Tier

[Fireworks Priority tier](https://docs.fireworks.ai/serverless/serving-paths)
prioritizes supported models above Standard traffic. Set `serviceTier` to
`'priority'` to send Fireworks' `service_tier` request field:

```ts
import {
  fireworks,
  type FireworksLanguageModelOptions,
} from '@ai-sdk/fireworks';
import { generateText } from 'ai';

const result = await generateText({
  model: fireworks('accounts/fireworks/models/glm-5p2'),
  providerOptions: {
    fireworks: {
      serviceTier: 'priority',
    } satisfies FireworksLanguageModelOptions,
  },
  prompt: 'Write a haiku about reliable inference.',
});
```

### Completion Models

You can create models that call the Fireworks completions API using the `.completionModel()` factory method:

```ts
const model = fireworks.completionModel(
  'accounts/fireworks/models/firefunction-v1',
);
```

### Model Capabilities

| Model                                                      | Image Input | Object Generation | Tool Usage | Tool Streaming |
| ---------------------------------------------------------- | ----------- | ----------------- | ---------- | -------------- |
| `accounts/fireworks/models/firefunction-v1`                | <Cross />   | <Check />         | <Check />  | <Check />      |
| `accounts/fireworks/models/deepseek-r1`                    | <Cross />   | <Check />         | <Cross />  | <Cross />      |
| `accounts/fireworks/models/deepseek-v3`                    | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/llama-v3p1-405b-instruct`       | <Cross />   | <Check />         | <Check />  | <Check />      |
| `accounts/fireworks/models/llama-v3p1-8b-instruct`         | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/llama-v3p2-3b-instruct`         | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/llama-v3p3-70b-instruct`        | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/mixtral-8x7b-instruct`          | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/mixtral-8x7b-instruct-hf`       | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/mixtral-8x22b-instruct`         | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/qwen2p5-coder-32b-instruct`     | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/qwen2p5-72b-instruct`           | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/qwen-qwq-32b-preview`           | <Cross />   | <Check />         | <Cross />  | <Cross />      |
| `accounts/fireworks/models/qwen2-vl-72b-instruct`          | <Check />   | <Check />         | <Cross />  | <Cross />      |
| `accounts/fireworks/models/llama-v3p2-11b-vision-instruct` | <Check />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/qwq-32b`                        | <Cross />   | <Check />         | <Cross />  | <Cross />      |
| `accounts/fireworks/models/yi-large`                       | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/kimi-k2-instruct`               | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/kimi-k2-thinking`               | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/kimi-k2p6`                      | <Check />   | <Check />         | <Check />  | <Cross />      |
| `accounts/fireworks/models/minimax-m2`                     | <Cross />   | <Check />         | <Check />  | <Cross />      |

<Note>
  The table above lists popular models. Please see the [Fireworks models
  page](https://fireworks.ai/models) for a full list of available models.
</Note>

## Embedding Models

You can create models that call the Fireworks embeddings API using the `.embeddingModel()` factory method:

```ts
const model = fireworks.embeddingModel('nomic-ai/nomic-embed-text-v1.5');
```

You can use Fireworks embedding models to generate embeddings with the `embed` function:

```ts
import { fireworks } from '@ai-sdk/fireworks';
import { embed } from 'ai';

const { embedding } = await embed({
  model: fireworks.embeddingModel('nomic-ai/nomic-embed-text-v1.5'),
  value: 'sunny day at the beach',
});
```

### Model Capabilities

| Model                            | Dimensions | Max Tokens |
| -------------------------------- | ---------- | ---------- |
| `nomic-ai/nomic-embed-text-v1.5` | 768        | 8192       |

<Note>
  For more embedding models, see the [Fireworks models
  page](https://fireworks.ai/models) for a full list of available models.
</Note>

## Image Models

You can create Fireworks image models using the `.image()` factory method.
For more on image generation with the AI SDK see [generateImage()](/docs/reference/ai-sdk-core/generate-image).

```ts
import { fireworks, type FireworksImageModelOptions } from '@ai-sdk/fireworks';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: fireworks.image('accounts/fireworks/models/flux-1-dev-fp8'),
  prompt: 'A futuristic cityscape at sunset',
  aspectRatio: '16:9',
  providerOptions: {
    fireworks: {
      guidance_scale: 4.5,
      num_inference_steps: 8,
    } satisfies FireworksImageModelOptions,
  },
});
```

<Note>
  Model support for `size` and `aspectRatio` parameters varies. See the [Model
  Capabilities](#model-capabilities-1) section below for supported dimensions,
  or check the model's documentation on [Fireworks models
  page](https://fireworks.ai/models) for more details.
</Note>

### Provider Options

Fireworks image models support flexible provider options through the `providerOptions.fireworks` object. Use the `FireworksImageModelOptions` type to validate known Fireworks image options while still allowing model-specific options to pass through.

The following typed provider options are available:

- **guidance_scale** _number_

  Classifier-free guidance scale for the image diffusion process.

- **num_inference_steps** _number_

  Number of denoising steps for FLUX workflow image generation.

- **output_format** _'jpeg' | 'png'_

  Desired output format for FLUX Kontext image generation and editing.

- **prompt_upsampling** _boolean_

  Whether Fireworks should automatically modify the prompt for more creative generation.

- **safety_tolerance** _number_

  Moderation tolerance level for inputs and outputs, from `0` to `6`. Fireworks limits image-to-image requests to `2`.

- **webhook_url** _string_

  URL to receive webhook notifications for async Kontext requests.

- **webhook_secret** _string_

  Secret for webhook signature verification.

- **cfg_scale** _number_

  Guidance scale for legacy `image_generation` models.

- **steps** _number_

  Number of generation steps for legacy `image_generation` models.

### Image Editing

Fireworks supports image editing through FLUX Kontext models (`flux-kontext-pro` and `flux-kontext-max`). Pass input images via `prompt.images` to transform or edit existing images.

<Note>
  Fireworks Kontext models do not support explicit masks. Editing is
  prompt-driven — describe what you want to change in the text prompt.
</Note>

#### Basic Image Editing

Transform an existing image using text prompts:

```ts
const imageBuffer = readFileSync('./input-image.png');

const { images } = await generateImage({
  model: fireworks.image('accounts/fireworks/models/flux-kontext-pro'),
  prompt: {
    text: 'Turn the cat into a golden retriever dog',
    images: [imageBuffer],
  },
  providerOptions: {
    fireworks: {
      output_format: 'jpeg',
      safety_tolerance: 2,
    } satisfies FireworksImageModelOptions,
  },
});
```

#### Style Transfer

Apply artistic styles to an image:

```ts
const imageBuffer = readFileSync('./input-image.png');

const { images } = await generateImage({
  model: fireworks.image('accounts/fireworks/models/flux-kontext-pro'),
  prompt: {
    text: 'Transform this into a watercolor painting style',
    images: [imageBuffer],
  },
  aspectRatio: '1:1',
});
```

<Note>
  Input images can be provided as `Buffer`, `ArrayBuffer`, `Uint8Array`, or
  base64-encoded strings. Fireworks only supports a single input image per
  request.
</Note>

### Model Capabilities

For all models supporting aspect ratios, the following aspect ratios are supported:

`1:1 (default), 2:3, 3:2, 4:5, 5:4, 16:9, 9:16, 9:21, 21:9`

For all models supporting size, the following sizes are supported:

`640 x 1536, 768 x 1344, 832 x 1216, 896 x 1152, 1024x1024 (default), 1152 x 896, 1216 x 832, 1344 x 768, 1536 x 640`

| Model                                                        | Dimensions Specification | Image Editing |
| ------------------------------------------------------------ | ------------------------ | ------------- |
| `accounts/fireworks/models/flux-kontext-pro`                 | Aspect Ratio             | <Check />     |
| `accounts/fireworks/models/flux-kontext-max`                 | Aspect Ratio             | <Check />     |
| `accounts/fireworks/models/flux-1-dev-fp8`                   | Aspect Ratio             | <Cross />     |
| `accounts/fireworks/models/flux-1-schnell-fp8`               | Aspect Ratio             | <Cross />     |
| `accounts/fireworks/models/playground-v2-5-1024px-aesthetic` | Size                     | <Cross />     |
| `accounts/fireworks/models/japanese-stable-diffusion-xl`     | Size                     | <Cross />     |
| `accounts/fireworks/models/playground-v2-1024px-aesthetic`   | Size                     | <Cross />     |
| `accounts/fireworks/models/SSD-1B`                           | Size                     | <Cross />     |
| `accounts/fireworks/models/stable-diffusion-xl-1024-v1-0`    | Size                     | <Cross />     |

For more details, see the [Fireworks models page](https://fireworks.ai/models).

#### Stability AI Models

Fireworks also presents several Stability AI models backed by Stability AI API
keys and endpoint. The AI SDK Fireworks provider does not currently include
support for these models:

| Model ID                               |
| -------------------------------------- |
| `accounts/stability/models/sd3-turbo`  |
| `accounts/stability/models/sd3-medium` |
| `accounts/stability/models/sd3`        |
