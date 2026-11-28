# AI SDK - Perplexity Provider

The **[Perplexity provider](https://ai-sdk.dev/providers/ai-sdk-providers/perplexity)** for the [AI SDK](https://ai-sdk.dev/docs)
contains language model support for Perplexity's Sonar API - a powerful answer engine with real-time web search capabilities.

## Features

- Real-time web search grounding for accurate, up-to-date responses
- Support for advanced queries and follow-up questions
- Multiple tiers available:
  - **Sonar Pro**: Enhanced capabilities for complex tasks with 2x more citations
  - **Sonar**: Lightweight offering optimized for speed and cost
- Industry-leading answer quality
- Data privacy - no training on customer data
- Self-serve API access with scalable pricing

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Perplexity (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Perplexity provider is available in the `@ai-sdk/perplexity` module. You can install it with:

```bash
npm i @ai-sdk/perplexity
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `perplexity` from `@ai-sdk/perplexity`:

```ts
import { perplexity } from '@ai-sdk/perplexity';
```

## Example

```ts
import { perplexity } from '@ai-sdk/perplexity';
import { generateText } from 'ai';

const { text } = await generateText({
  model: perplexity('sonar-pro'),
  prompt: 'What are the latest developments in quantum computing?',
});
```

## Documentation

Please check out the **[Perplexity provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/perplexity)** for more information.
