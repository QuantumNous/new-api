import { generateText, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: new MockLanguageModelV3({
      doGenerate: async () => ({
        warnings: [],
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 20,
            text: 20,
            reasoning: undefined,
          },
        },
        finishReason: { raw: undefined, unified: 'tool-calls' },
        content: [
          {
            type: 'tool-call',
            toolCallType: 'function',
            toolCallId: 'call-1',
            toolName: 'attractions', // wrong tool name
            input: `{ "city": "San Francisco" }`,
          },
        ],
      }),
    }),
    tools: {
      cityAttractions: tool({
        inputSchema: z.object({ city: z.string() }),
      }),
    },
    prompt: 'What are the tourist attractions in San Francisco?',

    experimental_repairToolCall: async ({ toolCall }) => {
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

  console.log('Repaired tool calls:');
  console.log(JSON.stringify(result.toolCalls, null, 2));
});
