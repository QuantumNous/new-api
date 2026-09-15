# AI SDK - Cohere Provider

The **[Cohere provider](https://ai-sdk.dev/providers/ai-sdk-providers/cohere)** for the [AI SDK](https://ai-sdk.dev/docs) contains language model support for the Cohere API.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Cohere (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Cohere provider is available in the `@ai-sdk/cohere` module. You can install it with

```bash
npm i @ai-sdk/cohere
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `cohere` from `@ai-sdk/cohere`:

```ts
import { cohere } from '@ai-sdk/cohere';
```

## Example

```ts
import { cohere } from '@ai-sdk/cohere';
import { generateText } from 'ai';

const { text } = await generateText({
  model: cohere('command-r-plus'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Documentation

Please check out the **[Cohere provider](https://ai-sdk.dev/providers/ai-sdk-providers/cohere)** for more information.
