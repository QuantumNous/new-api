# AI SDK - Prodia Provider

The **[Prodia provider](https://ai-sdk.dev/providers/ai-sdk-providers/prodia)** for the [AI SDK](https://ai-sdk.dev/docs) adds image model support for the [Prodia API](https://docs.prodia.com/).

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Prodia (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Prodia provider is available in the `@ai-sdk/prodia` module. You can install it with

```bash
pnpm add @ai-sdk/prodia
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `prodia` from `@ai-sdk/prodia`:

```ts
import { prodia } from '@ai-sdk/prodia';
```

## Image Generation Example

```ts
import fs from 'node:fs';
import { prodia } from '@ai-sdk/prodia';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: prodia.image('inference.flux-fast.schnell.txt2img.v2'),
  prompt: 'A cat wearing a intricate robe',
});

const filename = `image-${Date.now()}.png`;
fs.writeFileSync(filename, image.uint8Array);
console.log(`Image saved to ${filename}`);
```

## Additional Options

If you want to pass additional inputs to the model besides the prompt, use the `providerOptions.prodia` property:

```ts
import { prodia, type ProdiaImageProviderOptions } from '@ai-sdk/prodia';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: prodia.image('inference.flux-fast.schnell.txt2img.v2'),
  prompt: 'A cat wearing an intricate robe',
  providerOptions: {
    prodia: {
      width: 1024,
      height: 1024,
      steps: 4,
    } satisfies ProdiaImageProviderOptions,
  },
});
```

## Configuring Base URL

By default, the provider uses `https://inference.prodia.com/v2`. You can override this if needed:

```ts
import { createProdia } from '@ai-sdk/prodia';

const prodia = createProdia({
  baseURL: 'https://inference.prodia.com/v2',
  apiKey: process.env.PRODIA_TOKEN,
});
```

## Documentation

See the [Prodia provider](https://ai-sdk.dev/providers/ai-sdk-providers/prodia) for more information.
