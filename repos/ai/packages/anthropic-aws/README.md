# AI SDK - Claude Platform on AWS Provider

The **[Claude Platform on AWS provider](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic-aws)** for the [AI SDK](https://ai-sdk.dev/docs)
gives you access to the Anthropic Messages API hosted in AWS at
`aws-external-anthropic.{region}.api.aws`, authenticated with AWS SigV4 or an
AWS-provisioned API key.

Same wire format and feature set as `@ai-sdk/anthropic` — model IDs, streaming,
prompt caching, tool use, computer use, Agent Skills, and `anthropic-beta`
headers all match the first-party Claude API.

## Setup

```bash
npm install @ai-sdk/anthropic-aws
```

## Provider Instance

```ts
import { createAnthropicAws } from '@ai-sdk/anthropic-aws';

// SigV4 — picks up AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
const anthropicAws = createAnthropicAws({
  region: 'us-west-2',
  workspaceId: 'wrkspc_…',
});
```

## Example

```ts
import { createAnthropicAws } from '@ai-sdk/anthropic-aws';
import { generateText } from 'ai';

const anthropicAws = createAnthropicAws();

const { text } = await generateText({
  model: anthropicAws('claude-sonnet-4-6'),
  prompt: 'Invent a new holiday and describe its traditions.',
});
```

## Documentation

Please check out the **[Claude Platform on AWS provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic-aws)** for more information.
