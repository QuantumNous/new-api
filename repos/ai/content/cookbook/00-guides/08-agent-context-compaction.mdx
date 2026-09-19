---
title: Compact Agent Context
description: Learn how to compact agent context by mutating message state between steps with prepareStep.
tags: ['agent', 'context', 'compaction', 'prepareStep']
---

# Compact Agent Context

In this guide, you will learn how to compact an agent's context by returning a new `messages` array from `prepareStep`.

The example uses `pruneMessages`, a built-in helper that removes selected messages and message parts. You can use any compaction logic you want. The core behavior is that `prepareStep` can mutate the message state that later steps receive.

## Start With a Growing Agent Loop

Agents that call tools can build up large message histories. Each tool call and tool result becomes part of the context for the next step.

This example uses a tool that returns long results:

```ts
import { ToolLoopAgent, isStepCount, tool } from 'ai';
import { z } from 'zod';
__PROVIDER_IMPORT__;

const readDocument = tool({
  description: 'Read a document by name',
  inputSchema: z.object({
    name: z.string(),
  }),
  execute: async ({ name }) => {
    return {
      name,
      text: await loadLargeDocument(name),
    };
  },
});

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    readDocument,
  },
  stopWhen: isStepCount(10),
});

const result = await agent.generate({
  prompt: 'Read the project documents and summarize the migration plan.',
});
```

This works, but the message list grows after each tool call. If the agent reads several large documents, later steps may send old tool results that the model no longer needs in full.

## Add a Compaction Trigger

You decide when compaction should happen.

This example uses a simple token estimate:

```ts
import type { ModelMessage } from 'ai';

const COMPACT_AFTER_TOKENS = 100_000;

const estimateTokens = (messages: ModelMessage[]) => {
  return JSON.stringify(messages).length / 4;
};
```

Use a real tokenizer or provider usage data if you need tighter accounting. The exact trigger does not matter for the pattern.

## Compact Messages in prepareStep

`prepareStep` runs before each model step. It receives the `messages` that will be sent to the model for that step.

When you return a new `messages` array, the SDK uses it for the current step and as the base for following steps.

```ts
import {
  ToolLoopAgent,
  isStepCount,
  pruneMessages,
  tool,
  type ModelMessage,
} from 'ai';
import { z } from 'zod';
__PROVIDER_IMPORT__;

const COMPACT_AFTER_TOKENS = 100_000;

const estimateTokens = (messages: ModelMessage[]) => {
  return JSON.stringify(messages).length / 4;
};

const readDocument = tool({
  description: 'Read a document by name',
  inputSchema: z.object({
    name: z.string(),
  }),
  execute: async ({ name }) => {
    return {
      name,
      text: await loadLargeDocument(name),
    };
  },
});

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    readDocument,
  },
  stopWhen: isStepCount(10),
  prepareStep: ({ messages }) => {
    if (estimateTokens(messages) > COMPACT_AFTER_TOKENS) {
      return {
        messages: pruneMessages({
          messages,
          reasoning: 'all',
          toolCalls: 'before-last-3-messages',
          emptyMessages: 'remove',
        }),
      };
    }
  },
});

const result = await agent.generate({
  prompt: 'Read the project documents and summarize the migration plan.',
});
```

`pruneMessages` is only one way to compact. You can replace it with your own logic when you need a different message shape.

## Understand What Persists

The `messages` parameter is the loop's current message state. If `prepareStep` returns `messages`, that changed list persists into later steps. New assistant and tool response messages are appended as the loop continues.

If you want to build a step from the original input plus the model responses so far, use `initialMessages` and `responseMessages`:

```ts
prepareStep: ({ initialMessages, responseMessages, stepNumber }) => {
  if (stepNumber > 0) {
    return {
      messages: [...initialMessages, ...responseMessages.slice(-10)],
    };
  }
};
```

This is useful when you do not want previous `messages` overrides to be the starting point for the next step.

## Use the Same Pattern With Core Functions

The same `prepareStep` behavior works with `generateText` and `streamText`:

```ts
import { generateText, isStepCount, pruneMessages } from 'ai';
__PROVIDER_IMPORT__;

const result = await generateText({
  model: __MODEL__,
  prompt: 'Read the project documents and summarize the migration plan.',
  tools: {
    readDocument,
  },
  stopWhen: isStepCount(10),
  prepareStep: ({ messages }) => {
    if (estimateTokens(messages) > COMPACT_AFTER_TOKENS) {
      return {
        messages: pruneMessages({
          messages,
          reasoning: 'all',
          toolCalls: 'before-last-3-messages',
          emptyMessages: 'remove',
        }),
      };
    }
  },
});
```

## Learn More

- [Loop Control](/docs/agents/loop-control) for `prepareStep` with agents
- [Tools and Tool Calling](/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback) for `prepareStep` with AI SDK Core
- [`pruneMessages`](/docs/reference/ai-sdk-ui/prune-messages) for built-in message pruning options
