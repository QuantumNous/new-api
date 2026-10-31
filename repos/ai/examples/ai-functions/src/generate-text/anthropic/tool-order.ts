import { createAnthropic } from '@ai-sdk/anthropic';
import { parseJSON } from '@ai-sdk/provider-utils';
import assert from 'node:assert/strict';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const expectedToolOrder = ['middle', 'alpha', 'gamma', 'zebra'];

const anthropic = createAnthropic({
  apiKey: 'test-api-key',
  fetch: async (_url, options) => {
    const body = (await parseJSON({
      text: options!.body! as string,
    })) as {
      tools?: Array<{ name?: string }>;
    };

    assert.deepEqual(
      body.tools?.map(tool => tool.name),
      expectedToolOrder,
    );

    return new Response(
      JSON.stringify({
        id: 'msg_tool_order',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-haiku-20241022',
        content: [{ type: 'text', text: 'Tool order verified.' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  },
});

const tools = {
  zebra: tool({
    description: 'Zebra tool',
    inputSchema: z.object({}),
  }),
  alpha: tool({
    description: 'Alpha tool',
    inputSchema: z.object({}),
  }),
  gamma: tool({
    description: 'Gamma tool',
    inputSchema: z.object({}),
  }),
  middle: tool({
    description: 'Middle tool',
    inputSchema: z.object({}),
  }),
};

run(async () => {
  const { text } = await generateText({
    model: anthropic('claude-3-5-haiku-20241022'),
    tools,
    toolOrder: ['middle'],
    prompt: 'Verify the order tools are sent to the provider.',
  });

  console.log(text);
});
