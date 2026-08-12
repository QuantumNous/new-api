# AI SDK - Mistral Provider

The **[Mistral provider](https://ai-sdk.dev/providers/ai-sdk-providers/mistral)** for the [AI SDK](https://ai-sdk.dev/docs) contains language model support for the Mistral chat API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Mistral (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Mistral provider is available in the `@ai-sdk/mistral` module. You can install it with

```bash
npm i @ai-sdk/mistral
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `mistral` from `@ai-sdk/mistral`:

```ts
import { mistral } from '@ai-sdk/mistral';
```

## Example

```ts
import { mistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';

const { text } = await generateText({
  model: mistral('mistral-large-latest'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Documentation

Please check out the **[Mistral provider](https://ai-sdk.dev/providers/ai-sdk-providers/mistral)** for more information.
