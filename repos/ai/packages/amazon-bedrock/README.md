# AI SDK - Amazon Bedrock Provider

The **[Amazon Bedrock provider](https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock)** for the [AI SDK](https://ai-sdk.dev/docs)
contains language model support for the Amazon Bedrock [converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html).

> **Deploying to Vercel?** With Vercel's AI Gateway you can access Amazon Bedrock (and hundreds of models from other providers) — no additional packages, API keys, or extra cost. [Get started with AI Gateway](https://vercel.com/ai-gateway).

## Setup

The Amazon Bedrock provider is available in the `@ai-sdk/amazon-bedrock` module. You can install it with

```bash
npm i @ai-sdk/amazon-bedrock
```

## Skill for Coding Agents

If you use coding agents such as Claude Code or Cursor, we highly recommend adding the AI SDK skill to your repository:

```shell
npx skills add vercel/ai
```

## Provider Instance

You can import the default provider instance `bedrock` from `@ai-sdk/amazon-bedrock`:

```ts
import { bedrock } from '@ai-sdk/amazon-bedrock';
```

## Authentication

The Amazon Bedrock provider supports two authentication methods with automatic fallback:

### API Key Authentication (Recommended)

API key authentication provides a simpler setup process compared to traditional AWS SigV4 authentication. You can authenticate using either environment variables or direct configuration.

#### Using Environment Variable

Set the `AWS_BEARER_TOKEN_BEDROCK` environment variable with your API key:

```bash
export AWS_BEARER_TOKEN_BEDROCK=your-api-key-here
```

```ts
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

const { text } = await generateText({
  model: bedrock('anthropic.claude-3-haiku-20240307-v1:0'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
  // API key is automatically loaded from AWS_BEARER_TOKEN_BEDROCK
});
```

#### Using Direct Configuration

You can also pass the API key directly in the provider configuration:

```ts
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

const bedrockWithApiKey = bedrock.withSettings({
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK, // or your API key directly
  region: 'us-east-1', // Optional: specify region
});

const { text } = await generateText({
  model: bedrockWithApiKey('anthropic.claude-3-haiku-20240307-v1:0'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

### SigV4 Authentication (Fallback)

If no API key is provided, the provider automatically falls back to AWS SigV4 authentication using standard AWS credentials:

```ts
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

// Uses AWS credentials from environment variables or AWS credential chain
const { text } = await generateText({
  model: bedrock('anthropic.claude-3-haiku-20240307-v1:0'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

This method requires standard AWS environment variables:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` (optional, for temporary credentials)

### Authentication Precedence

The provider uses the following authentication precedence:

1. **API key from direct configuration** (`apiKey` in `withSettings()`)
2. **API key from environment variable** (`AWS_BEARER_TOKEN_BEDROCK`)
3. **SigV4 authentication** (AWS credential chain fallback)

## Example

```ts
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { generateText } from 'ai';

const { text } = await generateText({
  model: bedrock('meta.llama3-8b-instruct-v1:0'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Documentation

Please check out the **[Amazon Bedrock provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/amazon-bedrock)** for more information.
