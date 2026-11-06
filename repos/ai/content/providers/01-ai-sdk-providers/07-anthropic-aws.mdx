---
title: Claude Platform on AWS
description: Learn how to use the Claude Platform on AWS provider.
---

# Claude Platform on AWS Provider

The Claude Platform on AWS provider for the [AI SDK](/docs) gives you access to the Anthropic Messages API hosted inside your AWS environment. Anthropic operates the stack, so you get the same API surface and feature set as the first-party [Anthropic provider](/providers/ai-sdk-providers/anthropic) — including streaming, prompt caching, tool use, computer use, Agent Skills, and `anthropic-beta` headers — with AWS-native authentication and AWS Marketplace billing.

This differs from [Amazon Bedrock](/providers/ai-sdk-providers/amazon-bedrock) in two important ways: Claude Platform on AWS uses Anthropic's Messages API directly (not Bedrock's `Converse`/`InvokeModel`), and new features are available the same day they launch on the first-party Claude API (no AWS integration delay).

## Setup

The Claude Platform on AWS provider is available in the `@ai-sdk/anthropic-aws` module. You can install it with:

<InstallPackages packages="@ai-sdk/anthropic-aws" />

### Prerequisites

Before you can use the provider, your AWS account must be subscribed to Claude Platform on AWS through the AWS Marketplace, and outbound web identity federation must be enabled on the account (a one-time setup step):

```bash
aws iam enable-outbound-web-identity-federation
```

Without this, every request returns `Outbound web identity federation is disabled for your account`. This is the most common setup error.

You'll also need your workspace ID. When you subscribe, AWS provisions an initial workspace for your account in the selected region. You can find the ID in the Claude Console under **Workspaces** (accessed from the AWS Console via the Claude Platform on AWS service page).

### Authentication

The provider supports two authentication methods:

#### Using AWS SigV4 (recommended for production)

SigV4 integrates with your existing AWS IAM policies, roles, and auditing. Configure AWS credentials using any method supported by the AWS default credential provider chain — environment variables, shared credentials file, web identity (IRSA), ECS container credentials, or EC2 instance metadata.

```bash
AWS_REGION=us-west-2
ANTHROPIC_AWS_WORKSPACE_ID=wrkspc_…
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
# AWS_SESSION_TOKEN=…  # only for temporary credentials (SSO, STS, assumed role)
```

Then use the default provider instance:

```ts
import { anthropicAws } from '@ai-sdk/anthropic-aws';
```

Or instantiate explicitly:

```ts
import { createAnthropicAws } from '@ai-sdk/anthropic-aws';

const anthropicAws = createAnthropicAws({
  region: 'us-west-2',
  workspaceId: 'wrkspc_…',
});
```

For dynamic credentials (e.g., assuming a role at request time):

```ts
const anthropicAws = createAnthropicAws({
  region: 'us-west-2',
  workspaceId: 'wrkspc_…',
  credentialProvider: async () => fetchCredentialsFromSTS(),
});
```

#### Using an API key

For simpler integration paths (local development, scripts, migration from the first-party Claude API), you can authenticate with an API key instead of SigV4. Your Anthropic account representative provisions API keys for Claude Platform on AWS.

```bash
ANTHROPIC_AWS_API_KEY=sk-…
```

When `apiKey` is set, it takes precedence over any SigV4 credentials in the environment.

```ts
import { createAnthropicAws } from '@ai-sdk/anthropic-aws';

const anthropicAws = createAnthropicAws({
  region: 'us-west-2',
  workspaceId: 'wrkspc_…',
  apiKey: 'sk-…',
});
```

### Provider Settings

| Setting              | Description                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `region`             | AWS region for the Claude Platform on AWS endpoint. Reads from `AWS_REGION` if omitted. Required — no fallback default.                                         |
| `workspaceId`        | Anthropic workspace ID for this AWS account. Sent on every request via the `anthropic-workspace-id` header. Reads from `ANTHROPIC_AWS_WORKSPACE_ID` if omitted. |
| `apiKey`             | API key for `x-api-key` authentication. When provided, used instead of SigV4. Reads from `ANTHROPIC_AWS_API_KEY` if omitted.                                    |
| `accessKeyId`        | AWS access key ID for SigV4. Reads from `AWS_ACCESS_KEY_ID`.                                                                                                    |
| `secretAccessKey`    | AWS secret access key for SigV4. Reads from `AWS_SECRET_ACCESS_KEY`.                                                                                            |
| `sessionToken`       | AWS session token for SigV4 (temporary credentials only). Reads from `AWS_SESSION_TOKEN`.                                                                       |
| `baseURL`            | Base URL override. Defaults to `https://aws-external-anthropic.{region}.api.aws/v1`.                                                                            |
| `headers`            | Custom headers to include on every request.                                                                                                                     |
| `fetch`              | Custom fetch implementation for testing or middleware.                                                                                                          |
| `credentialProvider` | Function returning dynamic AWS credentials. Overrides `accessKeyId`, `secretAccessKey`, and `sessionToken`.                                                     |

## Language Models

You can create models that call the Anthropic Messages API on AWS using the provider instance:

```ts
import { anthropicAws } from '@ai-sdk/anthropic-aws';

const model = anthropicAws('claude-sonnet-4-6');
```

Model IDs are identical to the first-party Anthropic API. See the [Anthropic provider docs](/providers/ai-sdk-providers/anthropic#language-models) for the full list of language model options, prompt caching, computer use, web search, code execution, and Agent Skills. All of these work identically here because Claude Platform on AWS uses Anthropic's runtime directly.

### Example

```ts
import { anthropicAws } from '@ai-sdk/anthropic-aws';
import { generateText } from 'ai';

const { text } = await generateText({
  model: anthropicAws('claude-sonnet-4-6'),
  prompt: 'Invent a new holiday and describe its traditions.',
});
```

## IAM permissions

Your IAM principal needs permission to call the Claude Platform on AWS actions on your workspace. AWS provides three managed policies:

- `AnthropicFullAccess` — grants `aws-external-anthropic:*` on all resources.
- `AnthropicInferenceAccess` — grants read actions plus `CreateInference`, `CreateBatchInference`, `CancelBatchInference`, `DeleteBatchInference`, and `CountTokens` on all workspaces. **This is the minimum for calling models.**
- `AnthropicReadOnlyAccess` — grants `Get*`, `List*`, and `CallWithBearerToken` on all workspaces. Insufficient for inference.
