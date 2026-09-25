import { streamText, tool } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          {
            type: 'tool-call',
            toolCallType: 'function',
            toolCallId: 'call-1',
            toolName: 'attractions', // wrong tool name
            input: `{ "city": "San Francisco" }`,
          },
          {
            type: 'finish',
            finishReason: { raw: undefined, unified: 'tool-calls' },
            logprobs: undefined,
            usage: {
              inputTokens: {
                total: 3,
                noCache: 3,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: 10,
                text: 10,
                reasoning: undefined,
              },
            },
          },
        ]),
      }),
    }),
    tools: {
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    prompt: 'What are the tourist attractions in San Francisco?',

    repairToolCall: async ({ toolCall }) => {
      return toolCall.toolName === 'attractions'
        ? {
            type: 'tool-call' as const,
            toolCallType: 'function' as const,
            toolCallId: toolCall.toolCallId,
            toolName: 'cityAttractions',
            input: toolCall.input,
          }
        : null;
    },
  });

  for await (const part of result.stream) {
    console.log(JSON.stringify(part, null, 2));
  }

  console.log('Repaired tool calls:');
  console.log(JSON.stringify(await result.toolCalls, null, 2));
});
