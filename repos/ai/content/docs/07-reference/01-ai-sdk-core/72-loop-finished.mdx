---
title: isLoopFinished
description: API Reference for isLoopFinished.
---

# `isLoopFinished()`

Creates a stop condition that never triggers, letting the agent loop run until it naturally finishes (i.e., the model stops making tool calls).

By default, `ToolLoopAgent` uses `isStepCount(20)` as a safety measure to prevent runaway loops that could result in excessive API calls and costs. If you are confident that your agent will terminate naturally or you are less concerned about costs, `isLoopFinished()` removes that limit and lets the agent run until the model is truly done.

```ts
import { ToolLoopAgent, isLoopFinished } from 'ai';
__PROVIDER_IMPORT__;

const agent = new ToolLoopAgent({
  model: __MODEL__,
  tools: {
    // your tools
  },
  stopWhen: isLoopFinished(),
});

const result = await agent.generate({
  prompt: 'Analyze this dataset and create a summary report',
});
```

## Import

<Snippet text={`import { isLoopFinished } from "ai"`} prompt={false} />

## API Signature

### Parameters

This function takes no parameters.

### Returns

A `StopCondition` function that always returns `false`, meaning it never triggers the stop condition. The agent loop will only stop through its natural termination conditions:

- The model stops making tool calls, or
- A tool without an `execute` function is called, or
- A tool call needs approval

## Examples

### Basic Usage

Let the agent run until it's finished:

```ts
import { ToolLoopAgent, isLoopFinished } from 'ai';

const agent = new ToolLoopAgent({
  model: yourModel,
  tools: yourTools,
  stopWhen: isLoopFinished(),
});
```

### Combining with Other Conditions

You can combine `isLoopFinished()` with other conditions. Since `isLoopFinished()` never triggers, the other conditions still apply:

```ts
import { ToolLoopAgent, isLoopFinished, hasToolCall } from 'ai';

const agent = new ToolLoopAgent({
  model: yourModel,
  tools: yourTools,
  stopWhen: [isLoopFinished(), hasToolCall('finalAnswer')],
});
```

In practice, this does not make much sense in this context, since you could just omit `isLoopFinished()`.

## See also

- [`isStepCount()`](/docs/reference/ai-sdk-core/is-step-count)
- [`hasToolCall()`](/docs/reference/ai-sdk-core/has-tool-call)
- [`ToolLoopAgent`](/docs/reference/ai-sdk-core/tool-loop-agent)
