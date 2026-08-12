# AI SDK - Groq Provider

The **[Groq provider](https://ai-sdk.dev/providers/ai-sdk-providers/groq)** for the [AI SDK](https://ai-sdk.dev/docs)
contains language model support for the Groq chat and completion APIs, transcription support, and browser search tool.

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Groq (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Groq provider is available in the `@ai-sdk/groq` module. You can install it with

```bash
npm i @ai-sdk/groq
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `groq` from `@ai-sdk/groq`:

```ts
import { groq } from '@ai-sdk/groq';
```

## Browser Search Tool

The Groq provider includes a browser search tool that provides interactive web browsing capabilities. Unlike traditional web search, browser search navigates websites interactively, providing more detailed and comprehensive results.

### Supported Models

Browser search is only available for these models:

- `openai/gpt-oss-20b`
- `openai/gpt-oss-120b`

⚠️ **Important**: Using browser search with other models will generate a warning and the tool will be ignored.

### Basic Usage

```ts
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const result = await generateText({
  model: groq('openai/gpt-oss-120b'), // Must use supported model
  prompt:
    'What are the latest developments in AI? Please search for recent news.',
  tools: {
    browser_search: groq.tools.browserSearch({}),
  },
  toolChoice: 'required', // Ensure the tool is used
});

console.log(result.text);
```

### Streaming Example

```ts
import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';

const result = streamText({
  model: groq('openai/gpt-oss-120b'),
  prompt: 'Search for the latest tech news and summarize it.',
  tools: {
    browser_search: groq.tools.browserSearch({}),
  },
  toolChoice: 'required',
});

for await (const delta of result.stream) {
  if (delta.type === 'text-delta') {
    process.stdout.write(delta.text);
  }
}
```

### Key Features

- **Interactive Browsing**: Navigates websites like a human user
- **Comprehensive Results**: More detailed than traditional search snippets
- **Server-side Execution**: Runs on Groq's infrastructure, no setup required
- **Powered by Exa**: Uses Exa search engine for optimal results
- **Currently Free**: Available at no additional charge during beta

### Best Practices

- Use `toolChoice: 'required'` to ensure the browser search is activated
- Supported models only: `openai/gpt-oss-20b` and `openai/gpt-oss-120b`
- The tool works automatically - no configuration parameters needed
- Server-side execution means no additional API keys or setup required

### Model Validation

The provider automatically validates model compatibility:

```ts
// ✅ Supported - will work
const result = await generateText({
  model: groq('openai/gpt-oss-120b'),
  tools: { browser_search: groq.tools.browserSearch({}) },
});

// ❌ Unsupported - will show warning and ignore tool
const result = await generateText({
  model: groq('gemma2-9b-it'),
  tools: { browser_search: groq.tools.browserSearch({}) },
});
// Warning: "Browser search is only supported on models: openai/gpt-oss-20b, openai/gpt-oss-120b"
```

## Basic Text Generation

```ts
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const { text } = await generateText({
  model: groq('gemma2-9b-it'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Documentation

Please check out the **[Groq provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/groq)** for more information.

For browser search details, see the **[Groq Browser Search Documentation](https://console.groq.com/docs/browser-search)**.
