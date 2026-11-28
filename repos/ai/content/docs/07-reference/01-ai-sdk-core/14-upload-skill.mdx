---
title: uploadSkill
description: API Reference for uploadSkill.
---

# `uploadSkill()`

Uploads a skill (a bundle of files) to a provider and returns a `ProviderReference` that can be used in subsequent inference calls.

```ts
import { uploadSkill } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
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
```

## Import

<Snippet text={`import { uploadSkill } from "ai"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'api',
      type: 'SkillsV4 | ProviderV4',
      description:
        'The skills API interface to use for uploading. Can be a `SkillsV4` instance (e.g. `anthropic.skills()`) or a provider instance directly (e.g. `anthropic`), in which case `.skills()` is called automatically.',
    },
    {
      name: 'files',
      type: 'SkillsV4File[]',
      description:
        'The files that make up the skill. Each file has a relative `path` and `content` (either a `Uint8Array` or a base64-encoded string).',
    },
    {
      name: 'displayTitle',
      type: 'string',
      isOptional: true,
      description: 'Human-readable title for the skill.',
    },
    {
      name: 'providerOptions',
      type: 'ProviderOptions',
      isOptional: true,
      description: 'Additional provider-specific options.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'providerReference',
      type: 'ProviderReference',
      description:
        'A `Record<string, string>` mapping provider names to provider-specific skill identifiers. Pass this when referencing the skill in inference calls.',
    },
    {
      name: 'displayTitle',
      type: 'string',
      isOptional: true,
      description:
        'Human-readable title returned by the provider (if supported).',
    },
    {
      name: 'name',
      type: 'string',
      isOptional: true,
      description:
        'Skill name inferred by the provider from the uploaded files.',
    },
    {
      name: 'description',
      type: 'string',
      isOptional: true,
      description:
        'Skill description inferred by the provider from the uploaded files.',
    },
    {
      name: 'latestVersion',
      type: 'string',
      isOptional: true,
      description: 'Latest version identifier assigned by the provider.',
    },
    {
      name: 'providerMetadata',
      type: 'ProviderMetadata',
      isOptional: true,
      description:
        'Additional provider-specific metadata returned from the upload.',
    },
    {
      name: 'warnings',
      type: 'Warning[]',
      description: 'Warnings from the provider (e.g. unsupported settings).',
    },
  ]}
/>
