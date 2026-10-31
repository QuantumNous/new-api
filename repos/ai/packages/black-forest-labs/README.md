# AI SDK - Black Forest Labs Provider

The **[Black Forest Labs provider](https://ai-sdk.dev/providers/ai-sdk-providers/black-forest-labs)** for the [AI SDK](https://ai-sdk.dev/docs) adds image model support for the [Black Forest Labs API](https://docs.bfl.ai/).

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Black Forest Labs (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Black Forest Labs provider is available in the `@ai-sdk/black-forest-labs` module. You can install it with

```bash
pnpm add @ai-sdk/black-forest-labs
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `blackForestLabs` from `@ai-sdk/black-forest-labs`:

```ts
import { blackForestLabs } from '@ai-sdk/black-forest-labs';
```

## Image Generation Example

```ts
import fs from 'node:fs';
import { blackForestLabs } from '@ai-sdk/black-forest-labs';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: blackForestLabs.image('flux-pro-1.1'),
  prompt: 'A cat wearing a intricate robe',
});

const filename = `image-${Date.now()}.png`;
fs.writeFileSync(filename, image.uint8Array);
console.log(`Image saved to ${filename}`);
```

## Additional Options

If you want to pass additional inputs to the model besides the prompt, use the `providerOptions.blackForestLabs` property:

```ts
import {
  blackForestLabs,
  type BlackForestLabsImageProviderOptions,
} from '@ai-sdk/black-forest-labs';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: blackForestLabs.image('flux-pro-1.1'),
  prompt: 'A cat wearing an intricate robe',
  aspectRatio: '16:9',
  providerOptions: {
    blackForestLabs: {
      outputFormat: 'png',
    } satisfies BlackForestLabsImageProviderOptions,
  },
});
```

## Configuring Base URL

By default, the provider uses `https://api.bfl.ai/v1`. You can override this to use regional or legacy endpoints:

```ts
import { createBlackForestLabs } from '@ai-sdk/black-forest-labs';

const blackForestLabs = createBlackForestLabs({
  baseURL: 'https://api.eu.bfl.ai/v1',
  apiKey: process.env.BFL_API_KEY,
});
```

## Configuring Polling

You can customize how often the client polls for image completion and how long it waits before timing out:

```ts
import { createBlackForestLabs } from '@ai-sdk/black-forest-labs';

const blackForestLabs = createBlackForestLabs({
  apiKey: process.env.BFL_API_KEY,
  // Poll every 500ms, timeout after 5 minutes
  pollIntervalMillis: 500,
  pollTimeoutMillis: 5 * 60_000,
});
```

You can also override these polling settings per request via `providerOptions.blackForestLabs`:

```ts
import { blackForestLabs } from '@ai-sdk/black-forest-labs';
import { generateImage } from 'ai';

const { image } = await generateImage({
  model: blackForestLabs.image('flux-pro-1.1'),
  prompt: 'A cat wearing an intricate robe',
  providerOptions: {
    blackForestLabs: {
      pollIntervalMillis: 250,
      pollTimeoutMillis: 30_000,
    },
  },
});
```

## Documentation

See the [Black Forest Labs provider](https://ai-sdk.dev/providers/ai-sdk-providers/black-forest-labs) for more information.
