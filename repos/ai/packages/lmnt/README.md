# AI SDK - LMNT Provider

The **[LMNT provider](https://ai-sdk.dev/providers/ai-sdk-providers/lmnt)** for the [AI SDK](https://ai-sdk.dev/docs)
contains language model support for the LMNT API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access LMNT (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The LMNT provider is available in the `@ai-sdk/lmnt` module. You can install it with

```bash
npm i @ai-sdk/lmnt
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `lmnt` from `@ai-sdk/lmnt`:

```ts
import { lmnt } from '@ai-sdk/lmnt';
```

## Example

```ts
import { lmnt } from '@ai-sdk/lmnt';
import { generateSpeech } from 'ai';

const result = await generateSpeech({
  model: lmnt.speech('aurora'),
  text: 'Hello, world!',
});
```

## Documentation

Please check out the **[LMNT provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/lmnt)** for more information.
