import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-5-nano'),
  providerOptions: {
    openai: {
      reasoningEffort: 'medium',
    } satisfies OpenAILanguageModelResponsesOptions,
  },
  instructions:
    'You are an expert at solving math problems.' +
    'You must use the code interpreter tool for any math operations.',
  tools: {
    codeInterpreter: openai.tools.codeInterpreter(),
    done: tool({
      description: 'Signal that you have finished your work',
      inputSchema: z.object({
        answer: z.string().describe('The answer to the problem'),
      }),
      // no execute function, will stop the agent when called
    }),
  },
  toolChoice: 'required', // force tool calls
});

run(async () => {
  const result = await agent.generate({
    prompt:
      'Four friends ran a total of 26.54 miles. ' +
      'The friend who ran the farthest ran 12.63 miles. ' +
      'The friend who ran the shortest amount ran 3.67 miles. ' +
      'If the other two friends ran the same amount, how much did each of the other friend run?',
  });

  // extract answer from done tool call
  const toolCall = result.staticToolCalls[0]; // tool call from final step
  if (toolCall?.toolName === 'done') {
    console.log(toolCall.input.answer);
  }
});
