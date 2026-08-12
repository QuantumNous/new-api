import { openai } from '@ai-sdk/openai';
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
            toolName: 'cityAttractions',
            // wrong tool call arguments (city vs cities):
            input: `{ "city": "San Francisco" }`,
          },
        ],
      }),
    }),
    tools: {
      cityAttractions: tool({
        inputSchema: z.object({ cities: z.array(z.string()) }),
      }),
    },
    prompt: 'What are the tourist attractions in San Francisco?',

    experimental_repairToolCall: async ({
      toolCall,
      tools,
      error,
      messages,
      instructions,
    }) => {
      const result = await generateText({
        model: openai('gpt-4o'),
        instructions,
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: toolCall.input,
              },
            ],
          },
          {
            role: 'tool' as const,
            content: [
              {
                type: 'tool-result',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                output: { type: 'error-text', value: error.message },
              },
            ],
          },
        ],
        tools,
      });

      const newToolCall = result.toolCalls.find(
        newToolCall => newToolCall.toolName === toolCall.toolName,
      );

      return newToolCall != null
        ? {
            type: 'tool-call' as const,
            toolCallType: 'function' as const,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: JSON.stringify(newToolCall.input),
          }
        : null;
    },
  });

  console.log('Repaired tool calls:');
  console.log(JSON.stringify(result.toolCalls, null, 2));
});
