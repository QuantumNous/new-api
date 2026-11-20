import { createGoogle } from '@ai-sdk/google';
import { parseJSON } from '@ai-sdk/provider-utils';
import assert from 'node:assert/strict';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const expectedToolOrder = ['middle', 'alpha', 'gamma', 'zebra'];

const google = createGoogle({
  apiKey: 'test-api-key',
  fetch: async (_url, options) => {
    const body = (await parseJSON({
      text: options!.body! as string,
    })) as {
      tools?: Array<{
        functionDeclarations?: Array<{ name?: string }>;
      }>;
    };

    assert.deepEqual(
      body.tools?.[0]?.functionDeclarations?.map(tool => tool.name),
      expectedToolOrder,
    );

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: 'Tool order verified.' }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
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
    model: google('gemini-2.5-flash'),
    tools,
    toolOrder: ['middle'],
    prompt: 'Verify the order tools are sent to the provider.',
  });

  console.log(text);
});
