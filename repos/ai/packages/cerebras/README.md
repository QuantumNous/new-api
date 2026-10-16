# AI SDK - Cerebras Provider

The **Cerebras provider** for the [AI SDK](https://ai-sdk.dev/docs) contains language model support for [Cerebras](https://cerebras.ai), offering high-speed AI model inference powered by Cerebras Wafer-Scale Engines and CS-3 systems.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Cerebras (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Cerebras provider is available in the `@ai-sdk/cerebras` module. You can install it with

```bash
npm i @ai-sdk/cerebras
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `cerebras` from `@ai-sdk/cerebras`:

```ts
import { cerebras } from '@ai-sdk/cerebras';
```

## Available Models

Cerebras offers a variety of high-performance language models:
https://inference-docs.cerebras.ai/models/overview

## Example

```ts
import { cerebras } from '@ai-sdk/cerebras';
import { generateText } from 'ai';

const { text } = await generateText({
  model: cerebras('llama-3.3-70b'),
  prompt: 'Write a JavaScript function that sorts a list:',
});
```

## Documentation

For more information about Cerebras' high-speed inference capabilities and API documentation, please visit:

- [Cerebras Inference Documentation](https://inference-docs.cerebras.ai/introduction)
- [Cerebras Website](https://cerebras.ai)

Note: Due to high demand in the early launch phase, context windows are temporarily limited to 8192 tokens in the Free Tier.
