// @ts-nocheck
import { tool } from 'ai';
import { z } from 'zod';

// Case 1: Simple identifier named 'result' - needs rename in body
const imageTool = tool({
  description: 'Generate an image',
  inputSchema: z.object({ prompt: z.string() }),
  execute: async ({ prompt }) => ({ data: 'base64...' }),
  toModelOutput(result) {
    return typeof result === 'string'
      ? [{ type: 'text', text: result }]
      : [{ type: 'image', data: result.data, mediaType: 'image/png' }];
  },
});

// Case 2: Simple identifier named 'output' - no rename needed
const contentTool = tool({
  description: 'Get content',
  inputSchema: z.object({ id: z.string() }),
  execute: async ({ id }) => ({ value: 'content' }),
  toModelOutput: output => ({
    type: 'content',
    value: [{ type: 'text', text: output.value }],
  }),
});

// Case 3: Already destructured - wrap in { output: ... }
const weatherTool = tool({
  description: 'Get weather',
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => ({ location, temperature: 72 }),
  toModelOutput: ({ location, temperature }) => ({
    type: 'text',
    value: `The weather in ${location} is ${temperature} degrees Fahrenheit.`,
  }),
});

// Case 4: Arrow function with result parameter
const simpleTool = tool({
  description: 'Simple tool',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => input.toUpperCase(),
  toModelOutput: result => [{ type: 'text', text: result }],
});

// Case 5: Function expression with result parameter
const funcTool = tool({
  description: 'Func tool',
  inputSchema: z.object({ input: z.string() }),
  execute: async ({ input }) => input,
  toModelOutput: function(result) {
    return [{ type: 'text', text: result }];
  },
});
