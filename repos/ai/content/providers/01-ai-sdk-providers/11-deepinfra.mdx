---
title: DeepInfra
description: Learn how to use DeepInfra's models with the AI SDK.
---

# DeepInfra Provider

The [DeepInfra](https://deepinfra.com) provider contains support for state-of-the-art models through the DeepInfra API, including Llama 3, Mixtral, Qwen, and many other popular open-source models.

## Setup

The DeepInfra provider is available via the `@ai-sdk/deepinfra` module. You can install it with:

<InstallPackages packages="@ai-sdk/deepinfra" />

## Provider Instance

You can import the default provider instance `deepInfra` from `@ai-sdk/deepinfra`:

```ts
import { deepInfra } from '@ai-sdk/deepinfra';
```

If you need a customized setup, you can import `createDeepInfra` from `@ai-sdk/deepinfra` and create a provider instance with your settings:

```ts
import { createDeepInfra } from '@ai-sdk/deepinfra';

const deepInfra = createDeepInfra({
  apiKey: process.env.DEEPINFRA_API_KEY ?? '',
});
```

You can use the following optional settings to customize the DeepInfra provider instance:

- **baseURL** _string_

  Use a different URL prefix for API calls, e.g. to use proxy servers.
  The default prefix is `https://api.deepinfra.com/v1`.

  Note: Language models and embeddings use OpenAI-compatible endpoints at `{baseURL}/openai`,
  while image models use `{baseURL}/inference`.

- **apiKey** _string_

  API key that is being sent using the `Authorization` header. It defaults to
  the `DEEPINFRA_API_KEY` environment variable.

- **headers** _Record&lt;string,string&gt;_

  Custom headers to include in the requests.

- **fetch** _(input: RequestInfo, init?: RequestInit) => Promise&lt;Response&gt;_

  Custom [fetch](https://developer.mozilla.org/en-US/docs/Web/API/fetch) implementation.
  Defaults to the global `fetch` function.
  You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.

## Language Models

You can create language models using a provider instance. The first argument is the model ID, for example:

```ts
import { deepInfra } from '@ai-sdk/deepinfra';
import { generateText } from 'ai';

const { text } = await generateText({
  model: deepInfra('meta-llama/Meta-Llama-3.1-70B-Instruct'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

DeepInfra language models can also be used in the `streamText` function (see [AI SDK Core](/docs/ai-sdk-core)).

## Model Capabilities

| Model                                               | Image Input | Object Generation | Tool Usage | Tool Streaming |
| --------------------------------------------------- | ----------- | ----------------- | ---------- | -------------- |
| `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` | <Check />   | <Cross />         | <Cross />  | <Cross />      |
| `meta-llama/Llama-4-Scout-17B-16E-Instruct`         | <Check />   | <Cross />         | <Cross />  | <Cross />      |
| `meta-llama/Llama-3.3-70B-Instruct-Turbo`           | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Llama-3.3-70B-Instruct`                 | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Meta-Llama-3.1-405B-Instruct`           | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`      | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Meta-Llama-3.1-70B-Instruct`            | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`       | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `meta-llama/Meta-Llama-3.1-8B-Instruct`             | <Cross />   | <Check />         | <Check />  | <Check />      |
| `meta-llama/Llama-3.2-11B-Vision-Instruct`          | <Check />   | <Check />         | <Cross />  | <Cross />      |
| `meta-llama/Llama-3.2-90B-Vision-Instruct`          | <Check />   | <Check />         | <Cross />  | <Cross />      |
| `mistralai/Mixtral-8x7B-Instruct-v0.1`              | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `deepseek-ai/DeepSeek-V3`                           | <Cross />   | <Check />         | <Check />  | <Check />      |
| `deepseek-ai/DeepSeek-R1`                           | <Cross />   | <Cross />         | <Cross />  | <Cross />      |
| `deepseek-ai/DeepSeek-R1-Distill-Llama-70B`         | <Cross />   | <Cross />         | <Cross />  | <Cross />      |
| `deepseek-ai/DeepSeek-R1-Turbo`                     | <Cross />   | <Cross />         | <Cross />  | <Cross />      |
| `nvidia/Llama-3.1-Nemotron-70B-Instruct`            | <Cross />   | <Check />         | <Check />  | <Cross />      |
| `Qwen/Qwen2-7B-Instruct`                            | <Cross />   | <Check />         | <Cross />  | <Cross />      |
| `Qwen/Qwen2.5-72B-Instruct`                         | <Cross />   | <Check />         | <Check />  | <Check />      |
| `Qwen/Qwen2.5-Coder-32B-Instruct`                   | <Cross />   | <Check />         | <Cross />  | <Cross />      |
| `Qwen/QwQ-32B-Preview`                              | <Cross />   | <Check />         | <Cross />  | <Cross />      |
| `google/codegemma-7b-it`                            | <Cross />   | <Cross />         | <Cross />  | <Cross />      |
| `google/gemma-2-9b-it`                              | <Cross />   | <Cross />         | <Cross />  | <Cross />      |
| `microsoft/WizardLM-2-8x22B`                        | <Cross />   | <Cross />         | <Cross />  | <Cross />      |

<Note>
  The table above lists popular models. Please see the [DeepInfra
  docs](https://deepinfra.com) for a full list of available models. You can also
  pass any available provider model ID as a string if needed.
</Note>

## Image Models

You can create DeepInfra image models using the `.image()` factory method.
For more on image generation with the AI SDK see [generateImage()](/docs/reference/ai-sdk-core/generate-image).

```ts
import { deepInfra, type DeepInfraImageModelOptions } from '@ai-sdk/deepinfra';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: deepInfra.image('stabilityai/sd3.5'),
  prompt: 'A futuristic cityscape at sunset',
  aspectRatio: '16:9',
});
```

<Note>
  Model support for `size` and `aspectRatio` parameters varies by model. Please
  check the individual model documentation on [DeepInfra's models
  page](https://deepinfra.com/models/text-to-image) for supported options and
  additional parameters.
</Note>

### Model-specific options

You can pass model-specific parameters using the `providerOptions.deepinfra` field:

```ts
import { deepInfra } from '@ai-sdk/deepinfra';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: deepInfra.image('stabilityai/sd3.5'),
  prompt: 'A futuristic cityscape at sunset',
  aspectRatio: '16:9',
  providerOptions: {
    deepinfra: {
      num_inference_steps: 30,
    } satisfies DeepInfraImageModelOptions,
  },
});
```

The following options are available via `providerOptions.deepinfra`. You can
type them with `DeepInfraImageModelOptions`.

- **negative_prompt** _string_

  Text description of what to avoid in the generated image.

- **num_inference_steps** _number_

  Number of denoising steps for models that expose this option.

- **guidance_scale** _number_

  Guidance scale for models that expose this option.

- **guidance** _number_

  Guidance value for image edit models that expose this option.

- **response_format** _'b64_json'_

  Format for OpenAI-compatible image responses. DeepInfra currently supports
  `b64_json`.

- **quality** _string_

  OpenAI-compatible image quality option.

- **style** _string_

  OpenAI-compatible image style option.

- **user** _string_

  Unique identifier for your end user.

<Note>
  DeepInfra image generation models expose model-specific parameters. Additional
  fields can be passed through `providerOptions.deepinfra` and are validated by
  DeepInfra.
</Note>

### Image Editing

DeepInfra supports image editing through models like `Qwen/Qwen-Image-Edit`. Pass input images via `prompt.images` to transform or edit existing images.

#### Basic Image Editing

Transform an existing image using text prompts:

```ts
const imageBuffer = readFileSync('./input-image.png');

const { images } = await generateImage({
  model: deepInfra.image('Qwen/Qwen-Image-Edit'),
  prompt: {
    text: 'Turn the cat into a golden retriever dog',
    images: [imageBuffer],
  },
  size: '1024x1024',
});
```

#### Inpainting with Mask

Edit specific parts of an image using a mask. Transparent areas in the mask indicate where the image should be edited:

```ts
const image = readFileSync('./input-image.png');
const mask = readFileSync('./mask.png');

const { images } = await generateImage({
  model: deepInfra.image('Qwen/Qwen-Image-Edit'),
  prompt: {
    text: 'A sunlit indoor lounge area with a pool containing a flamingo',
    images: [image],
    mask: mask,
  },
});
```

#### Multi-Image Combining

Combine multiple reference images into a single output:

```ts
const cat = readFileSync('./cat.png');
const dog = readFileSync('./dog.png');

const { images } = await generateImage({
  model: deepInfra.image('Qwen/Qwen-Image-Edit'),
  prompt: {
    text: 'Create a scene with both animals together, playing as friends',
    images: [cat, dog],
  },
});
```

<Note>
  Input images can be provided as `Buffer`, `ArrayBuffer`, `Uint8Array`, or
  base64-encoded strings. DeepInfra uses an OpenAI-compatible image editing API
  at `https://api.deepinfra.com/v1/openai/images/edits`.
</Note>

### Model Capabilities

For models supporting aspect ratios, the following ratios are typically supported:
`1:1 (default), 16:9, 1:9, 3:2, 2:3, 4:5, 5:4, 9:16, 9:21`

For models supporting size parameters, dimensions must typically be:

- Multiples of 32
- Width and height between 256 and 1440 pixels
- Default size is 1024x1024

| Model                                  | Dimensions Specification | Notes                                                    |
| -------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `stabilityai/sd3.5`                    | Aspect Ratio             | Premium quality base model, 8B parameters                |
| `black-forest-labs/FLUX-1.1-pro`       | Size                     | Latest state-of-art model with superior prompt following |
| `black-forest-labs/FLUX-1-schnell`     | Size                     | Fast generation in 1-4 steps                             |
| `black-forest-labs/FLUX-1-dev`         | Size                     | Optimized for anatomical accuracy                        |
| `black-forest-labs/FLUX-pro`           | Size                     | Flagship Flux model                                      |
| `black-forest-labs/FLUX.1-Kontext-dev` | Size                     | Image editing and transformation model                   |
| `black-forest-labs/FLUX.1-Kontext-pro` | Size                     | Professional image editing and transformation            |
| `stabilityai/sd3.5-medium`             | Aspect Ratio             | Balanced 2.5B parameter model                            |
| `stabilityai/sdxl-turbo`               | Aspect Ratio             | Optimized for fast generation                            |

For more details and pricing information, see the [DeepInfra text-to-image models page](https://deepinfra.com/models/text-to-image).

## Embedding Models

You can create DeepInfra embedding models using the `.embeddingModel()` factory method.
For more on embedding models with the AI SDK see [embed()](/docs/reference/ai-sdk-core/embed).

```ts
import { deepInfra } from '@ai-sdk/deepinfra';
import { embed } from 'ai';

const { embedding } = await embed({
  model: deepInfra.embeddingModel('BAAI/bge-large-en-v1.5'),
  value: 'sunny day at the beach',
});
```

### Model Capabilities

| Model                                                 | Dimensions | Max Tokens |
| ----------------------------------------------------- | ---------- | ---------- |
| `BAAI/bge-base-en-v1.5`                               | 768        | 512        |
| `BAAI/bge-large-en-v1.5`                              | 1024       | 512        |
| `BAAI/bge-m3`                                         | 1024       | 8192       |
| `intfloat/e5-base-v2`                                 | 768        | 512        |
| `intfloat/e5-large-v2`                                | 1024       | 512        |
| `intfloat/multilingual-e5-large`                      | 1024       | 512        |
| `sentence-transformers/all-MiniLM-L12-v2`             | 384        | 256        |
| `sentence-transformers/all-MiniLM-L6-v2`              | 384        | 256        |
| `sentence-transformers/all-mpnet-base-v2`             | 768        | 384        |
| `sentence-transformers/clip-ViT-B-32`                 | 512        | 77         |
| `sentence-transformers/clip-ViT-B-32-multilingual-v1` | 512        | 77         |
| `sentence-transformers/multi-qa-mpnet-base-dot-v1`    | 768        | 512        |
| `sentence-transformers/paraphrase-MiniLM-L6-v2`       | 384        | 128        |
| `shibing624/text2vec-base-chinese`                    | 768        | 512        |
| `thenlper/gte-base`                                   | 768        | 512        |
| `thenlper/gte-large`                                  | 1024       | 512        |

<Note>
  For a complete list of available embedding models, see the [DeepInfra
  embeddings page](https://deepinfra.com/models/embeddings).
</Note>
