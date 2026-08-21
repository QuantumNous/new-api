---
title: experimental_getRealtimeToolDefinitions
description: API reference for experimental_getRealtimeToolDefinitions.
---

# `experimental_getRealtimeToolDefinitions()`

<Note type="warning">
  `experimental_getRealtimeToolDefinitions` is part of the experimental realtime
  API.
</Note>

Converts an AI SDK `ToolSet` into provider-neutral realtime tool definitions
that can be passed to a realtime session setup request.

Use it in the server-side setup endpoint that creates a short-lived realtime
provider token.

```ts
import { openai } from '@ai-sdk/openai';
import { experimental_getRealtimeToolDefinitions, tool } from 'ai';
import { z } from 'zod';

const tools = {
  getWeather: tool({
    description: 'Get the current weather for a city',
    inputSchema: z.object({
      city: z.string(),
    }),
  }),
};

const toolDefinitions = await experimental_getRealtimeToolDefinitions({
  tools,
});

const token = await openai.experimental_realtime.getToken({
  model: 'gpt-realtime',
  sessionConfig: {
    tools: toolDefinitions,
  },
});
```

## Import

<Snippet
  text={`import { experimental_getRealtimeToolDefinitions } from "ai"`}
  prompt={false}
/>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'options',
      type: 'Object',
      description: 'The options for converting tools.',
      properties: [
        {
          type: 'Object',
          parameters: [
            {
              name: 'tools',
              type: 'ToolSet',
              description:
                'The AI SDK tools to expose to the realtime model. Function and dynamic tools are converted to realtime function definitions. Provider tools are skipped.',
            },
            {
              name: 'toolsContext',
              type: 'InferToolSetContext<TOOLS>',
              isOptional: true,
              description:
                'Per-tool context used when resolving dynamic tool descriptions.',
            },
          ],
        },
      ],
    },
  ]}
/>

### Returns

A `Promise<Experimental_RealtimeToolDefinition[]>`.

Each returned definition contains:

<PropertiesTable
  content={[
    {
      name: 'type',
      type: "'function'",
      description: 'The realtime tool definition type.',
    },
    {
      name: 'name',
      type: 'string',
      description: 'The tool name from the input ToolSet.',
    },
    {
      name: 'description',
      type: 'string | undefined',
      description: 'The tool description sent to the realtime model.',
    },
    {
      name: 'parameters',
      type: 'JSONSchema7',
      description:
        'The JSON schema converted from the tool inputSchema. The realtime model uses this schema to generate tool call arguments.',
    },
  ]}
/>

## Notes

- Tool execution is not handled by `experimental_getRealtimeToolDefinitions`. Use
  [`experimental_useRealtime`](/docs/reference/ai-sdk-ui/use-realtime)
  `onToolCall` and `addToolOutput` to execute tools and return results.
- Provider tools are skipped because realtime providers expect regular function
  definitions in the session config.
- Dynamic tool descriptions are resolved with the matching value from
  `toolsContext` before the definitions are returned.
