import { googleVertex } from '@ai-sdk/google-vertex';
import {
  streamText,
  type ModelMessage,
  type ToolCallPart,
  type ToolResultPart,
} from 'ai';
import * as process from 'process';
import { run } from '../../lib/run';

const messages: ModelMessage[] = [];
run(async () => {
  let toolResponseAvailable = false;

  const result = streamText({
    model: googleVertex('gemini-2.5-pro'),
    tools: { code_execution: googleVertex.tools.codeExecution({}) },
    maxOutputTokens: 10000,
    prompt:
      'Calculate 20th fibonacci number. Then find the nearest palindrome to it.',
  });

  let fullResponse = '';
  const toolCalls: ToolCallPart[] = [];
  const toolResponses: ToolResultPart[] = [];

  for await (const delta of result.stream) {
    switch (delta.type) {
      case 'text-delta': {
        fullResponse += delta.text;
        process.stdout.write(delta.text);
        break;
      }

      case 'tool-call': {
        toolCalls.push(delta);

        process.stdout.write(
          `\nTool call: '${delta.toolName}' ${JSON.stringify(delta.input)}`,
        );
        break;
      }

      case 'tool-result': {
        const transformedDelta: ToolResultPart = {
          ...delta,
          output: { type: 'json', value: delta.output as any },
        };
        toolResponses.push(transformedDelta);

        process.stdout.write(
          `\nTool response: '${delta.toolName}' ${JSON.stringify(
            delta.output,
          )}`,
        );
        break;
      }
    }
  }
  process.stdout.write('\n\n');

  messages.push({
    role: 'assistant',
    content: [{ type: 'text', text: fullResponse }, ...toolCalls],
  });

  if (toolResponses.length > 0) {
    messages.push({ role: 'tool', content: toolResponses });
  }

  toolResponseAvailable = toolCalls.length > 0;
  console.log('Messages:', messages[0].content);
});
