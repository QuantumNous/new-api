# AI SDK - DeepInfra Provider

The **[DeepInfra provider](https://ai-sdk.dev/providers/ai-sdk-providers/deepinfra)** for the [AI SDK](https://ai-sdk.dev/docs)
contains language model support for the DeepInfra API, giving you access to models like Llama 3, Mixtral, and other state-of-the-art LLMs.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access DeepInfra (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The DeepInfra provider is available in the `@ai-sdk/deepinfra` module. You can install it with

```bash
npm i @ai-sdk/deepinfra
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `deepinfra` from `@ai-sdk/deepinfra`:

```ts
import { deepinfra } from '@ai-sdk/deepinfra';
```

## Example

```ts
import { deepinfra } from '@ai-sdk/deepinfra';
import { generateText } from 'ai';

const { text } = await generateText({
  model: deepinfra('meta-llama/Llama-3.3-70B-Instruct'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Documentation

Please check out the **[DeepInfra provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/deepinfra)** for more information.
