import { openai } from '@ai-sdk/openai';
import { generateText, NoSuchToolError, Output, tool } from 'ai';
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
      inputSchema,
      error,
    }) => {
      if (NoSuchToolError.isInstance(error)) {
        return null; // do not attempt to fix invalid tool names
      }

      const tool = tools[toolCall.toolName as keyof typeof tools];

      // example approach: use a model with structured outputs for repair:
      const { output: repairedArgs } = await generateText({
        model: openai('gpt-4o'),
        output: Output.object({ schema: tool.inputSchema }),
        prompt: [
          `The model tried to call the tool "${
            toolCall.toolName
          }" with the following arguments: ${JSON.stringify(toolCall.input)}.`,
          `The tool accepts the following schema: ${JSON.stringify(
            inputSchema(toolCall),
          )}.`,
          'Please try to fix the arguments.',
        ].join('\n'),
      });

      return { ...toolCall, input: JSON.stringify(repairedArgs) };
    },
  });

  console.log('Repaired tool calls:');
  console.log(JSON.stringify(result.toolCalls, null, 2));
});
