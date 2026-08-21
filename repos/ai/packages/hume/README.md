# AI SDK - Hume Provider

The **[Hume provider](https://ai-sdk.dev/providers/ai-sdk-providers/hume)** for the [AI SDK](https://ai-sdk.dev/docs)
contains support for the Hume API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Hume (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Hume provider is available in the `@ai-sdk/hume` module. You can install it with

```bash
npm i @ai-sdk/hume
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `hume` from `@ai-sdk/hume`:

```ts
import { hume } from '@ai-sdk/hume';
```

## Example

```ts
import { hume } from '@ai-sdk/hume';
import { generateSpeech } from 'ai';

const result = await generateSpeech({
  model: hume.speech('aurora'),
  text: 'Hello, world!',
});
```

## Documentation

Please check out the **[Hume provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/hume)** for more information.
