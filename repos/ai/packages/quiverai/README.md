# AI SDK - QuiverAI Provider

The **QuiverAI provider** for the [AI SDK](https://ai-sdk.dev/docs) adds image generation support for the [QuiverAI](https://quiver.ai/) API. QuiverAI generates SVG documents from text prompts and can also vectorize raster images.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access many models from other providers — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The QuiverAI provider is available in the `@ai-sdk/quiverai` module. You can install it with:

```bash
npm i @ai-sdk/quiverai
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `quiverai` from `@ai-sdk/quiverai`:

```ts
import { quiverai } from '@ai-sdk/quiverai';
```

## Image Generation Example

```ts
import { quiverai } from '@ai-sdk/quiverai';
import { generateImage } from 'ai';
import fs from 'fs';

const { image } = await generateImage({
  model: quiverai.image('arrow-1.1'),
  prompt: 'A logo for the next AI Design startup',
});

const filename = `image-${Date.now()}.svg`;
fs.writeFileSync(filename, image.uint8Array);
console.log(`Image saved to ${filename}`);
```

## Documentation

Please check out the **[QuiverAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/quiverai)** for more information.
