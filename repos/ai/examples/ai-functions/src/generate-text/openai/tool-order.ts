import { createOpenAI } from '@ai-sdk/openai';
import { parseJSON } from '@ai-sdk/provider-utils';
import assert from 'node:assert/strict';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const expectedToolOrder = ['middle', 'alpha', 'gamma', 'zebra'];

const openai = createOpenAI({
  apiKey: 'test-api-key',
  fetch: async (_url, options) => {
    const body = (await parseJSON({
      text: options!.body! as string,
    })) as {
      tools?: Array<{ name?: string; function?: { name?: string } }>;
    };

    assert.deepEqual(
      body.tools?.map(tool => tool.function?.name ?? tool.name),
      expectedToolOrder,
    );

    return new Response(
      JSON.stringify({
        id: 'resp_tool_order',
        object: 'response',
        created_at: 0,
        status: 'completed',
        error: null,
        incomplete_details: null,
        model: 'gpt-4o-mini',
        output: [
          {
            id: 'msg_tool_order',
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Tool order verified.',
                annotations: [],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
        },
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
    model: openai('gpt-4o-mini'),
    tools,
    toolOrder: ['middle'],
    prompt: 'Verify the order tools are sent to the provider.',
  });

  console.log(text);
});
