---
title: Skill Uploads
description: Learn how to upload skills and use provider references with the AI SDK.
---

# Skill Uploads

The AI SDK provides the [`uploadSkill`](/docs/reference/ai-sdk-core/upload-skill)
function to upload custom skills to a provider and get back a `ProviderReference` that
can be passed to subsequent inference calls.

A **skill** is a bundle of files (e.g. a `SKILL.md` describing the skill's behavior)
that providers can load, e.g. in sandboxed container environments.

In the AI SDK, the uploaded skill is identified by a `ProviderReference` — a
`Record<string, string>` mapping provider names to provider-specific identifiers.
This concept is used for other provider specific asset references too, such as
uploaded media files.

```ts
import { uploadSkill, generateText } from 'ai';
import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { readFileSync } from 'fs';

const { providerReference } = await uploadSkill({
  api: anthropic.skills(),
  files: [
    {
      path: 'my-skill/SKILL.md',
      content: readFileSync('./SKILL.md'),
    },
  ],
  displayTitle: 'My Skill',
});

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-6'),
  tools: {
    code_execution: anthropic.tools.codeExecution_20260120(),
  },
  prompt: 'Use the skill to complete the task.',
  providerOptions: {
    anthropic: {
      container: {
        skills: [{ type: 'custom', providerReference }],
      },
    } satisfies AnthropicLanguageModelOptions,
  },
});
```

As a shorthand, you can pass a provider instance directly to `api` instead of calling `.skills()` explicitly — the SDK will call `.skills()` for you:

```ts highlight="2"
const { providerReference } = await uploadSkill({
  api: anthropic, // shorthand for anthropic.skills()
  files: [{ path: 'my-skill/SKILL.md', content: readFileSync('./SKILL.md') }],
  displayTitle: 'My Skill',
});
```

## Skill Files

A skill is composed of one or more files, each with a relative `path` and `content`.
File content can be provided as a `Uint8Array` (e.g. from `fs.readFileSync`) or as a
base64-encoded string:

```ts
const { providerReference } = await uploadSkill({
  api: openai.skills(),
  files: [
    {
      path: 'my-skill/SKILL.md',
      content: readFileSync('./SKILL.md'), // Uint8Array
    },
    {
      path: 'my-skill/helper.py',
      content: readFileSync('./helper.py'),
    },
  ],
});
```

## Upload Result

`uploadSkill` returns an `UploadSkillResult` with the following fields:

| Field               | Type                | Description                                                      |
| ------------------- | ------------------- | ---------------------------------------------------------------- |
| `providerReference` | `ProviderReference` | Maps provider names to provider-specific skill IDs               |
| `displayTitle`      | `string?`           | Human-readable title (if supported and provided)                 |
| `name`              | `string?`           | Name inferred by the provider from the skill files               |
| `description`       | `string?`           | Description inferred by the provider from the skill files        |
| `latestVersion`     | `string?`           | Latest version identifier assigned by the provider               |
| `providerMetadata`  | `object?`           | Additional provider-specific metadata (e.g. timestamps)          |
| `warnings`          | `Warning[]`         | Warnings for unsupported options (e.g. `displayTitle` on OpenAI) |

## Provider References

A `ProviderReference` is a `Record<string, string>` mapping provider names to
provider-specific skill identifiers:

```ts
// Example ProviderReference
{
  anthropic: 'skill_abc123',
}
```

Pass the `providerReference` when referencing the skill during inference. Each provider
looks up its own skill ID from the reference. If no entry exists for the current
provider, an error is thrown.

## Multi-Provider Usage

If you want to use the same skill across multiple providers, upload it to each one and
merge the references:

```ts
const [openaiUpload, anthropicUpload] = await Promise.all([
  uploadSkill({
    api: openai.skills(),
    files: [{ path: 'my-skill/SKILL.md', content: skillSource }],
  }),
  uploadSkill({
    api: anthropic.skills(),
    files: [{ path: 'my-skill/SKILL.md', content: skillSource }],
    displayTitle: 'My Skill',
  }),
]);

const mergedReference = {
  ...openaiUpload.providerReference,
  ...anthropicUpload.providerReference,
};

// mergedReference: { openai: 'sk_...', anthropic: 'sk_...' }
```

The merged reference can then be used in inference calls regardless of which provider
processes the request — each provider will find its own skill ID.

## Using Skills in Inference Calls

How you attach a skill to an inference call depends on the provider.

### Anthropic

Pass the `providerReference` inside the `container.skills` array in `providerOptions`:

```ts
await generateText({
  model: anthropic('claude-sonnet-4-6'),
  tools: {
    code_execution: anthropic.tools.codeExecution_20260120(),
  },
  prompt: '...',
  providerOptions: {
    anthropic: {
      container: {
        skills: [{ type: 'custom', providerReference }],
      },
    } satisfies AnthropicLanguageModelOptions,
  },
});
```

### OpenAI

Pass the `providerReference` inside the `shell` tool's `environment.skills` array:

```ts
await generateText({
  model: openai.responses('gpt-5.2'),
  tools: {
    shell: openai.tools.shell({
      environment: {
        type: 'containerAuto',
        skills: [{ type: 'skillReference', providerReference }],
      },
    }),
  },
  prompt: '...',
});
```

## Supported Providers

The following providers support `skills()` and skill uploads:

| Provider  | Factory Method       |
| --------- | -------------------- |
| Anthropic | `anthropic.skills()` |
| OpenAI    | `openai.skills()`    |
