# AI SDK - Fireworks Provider

The **[Fireworks provider](https://ai-sdk.dev/providers/ai-sdk-providers/fireworks)** for the [AI SDK](https://ai-sdk.dev/docs) contains language model and image model support for the [Fireworks](https://fireworks.ai) platform.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Fireworks (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Fireworks provider is available in the `@ai-sdk/fireworks` module. You can install it with

```bash
npm i @ai-sdk/fireworks
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `fireworks` from `@ai-sdk/fireworks`:

```ts
import { fireworks } from '@ai-sdk/fireworks';
```

## Language Model Example

```ts
import { fireworks } from '@ai-sdk/fireworks';
import { generateText } from 'ai';

const { text } = await generateText({
  model: fireworks('accounts/fireworks/models/deepseek-v3'),
  prompt: 'Write a JavaScript function that sorts a list:',
});
```

## Image Model Examples

```ts
import { fireworks } from '@ai-sdk/fireworks';
import { generateImage } from 'ai';
import fs from 'fs';

const { image } = await generateImage({
  model: fireworks.image('accounts/fireworks/models/flux-1-dev-fp8'),
  prompt: 'A serene mountain landscape at sunset',
});
const filename = `image-${Date.now()}.png`;
fs.writeFileSync(filename, image.uint8Array);
console.log(`Image saved to ${filename}`);
```

## Documentation

Please check out the **[Fireworks provider](https://ai-sdk.dev/providers/ai-sdk-providers/fireworks)** for more information.
