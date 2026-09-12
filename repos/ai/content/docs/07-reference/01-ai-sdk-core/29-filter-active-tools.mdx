---
title: filterActiveTools
description: Filter a tool set to the currently active tools (API Reference)
---

# `filterActiveTools()`

<Note type="warning">`filterActiveTools` is an experimental feature.</Note>

`filterActiveTools` filters a tool set to only the string tool names listed in `activeTools`.
If `activeTools` is `undefined`, it returns the original tool set.
If `tools` is `undefined`, it returns `undefined`.

`filterActiveTools` is useful for limiting which tools are sent to a model in a particular step.

```ts
import { experimental_filterActiveTools as filterActiveTools, tool } from 'ai';
import { z } from 'zod';

const tools = {
  weather: tool({
    description: 'Get the weather for a city',
    inputSchema: z.object({ city: z.string() }),
  }),
  time: tool({
    description: 'Get the current time for a city',
    inputSchema: z.object({ city: z.string() }),
  }),
};

const activeTools = ['weather'] as const;

const filteredTools = filterActiveTools({
  tools,
  activeTools,
});
```

## Import

<Snippet
  text={`import { experimental_filterActiveTools as filterActiveTools } from "ai"`}
  prompt={false}
/>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'tools',
      type: 'ToolSet | undefined',
      description: 'The tool set to filter.',
    },
    {
      name: 'activeTools',
      type: 'ActiveTools<TOOLS>',
      description:
        'The names of the tools that should remain active. When omitted, all tools are returned.',
    },
  ]}
/>

### Returns

The filtered tool set, or `undefined` when `tools` is `undefined`.

When `activeTools` is provided as a literal array such as `["weather"] as const`,
TypeScript narrows the return type to only that subset of tools.

## Types

### `ActiveTools`

```ts
type ActiveTools<TOOLS extends ToolSet> =
  | ReadonlyArray<keyof TOOLS & string>
  | undefined;
```

`ActiveTools` only accepts string keys from the tool set because tool names are strings at runtime.
