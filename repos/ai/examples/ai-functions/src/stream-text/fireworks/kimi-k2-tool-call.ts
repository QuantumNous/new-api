import { fireworks } from '@ai-sdk/fireworks';
import {
  streamText,
  type ModelMessage,
  type ToolCallPart,
  type ToolResultPart,
} from 'ai';
import { weatherTool } from '../../tools/weather-tool';
import { run } from '../../lib/run';

const messages: ModelMessage[] = [];

run(async () => {
  let toolResponseAvailable = false;

  const result = streamText({
    model: fireworks('accounts/fireworks/models/kimi-k2-instruct'),
    maxOutputTokens: 512,
    tools: {
      weather: weatherTool,
    },
    toolChoice: 'auto',
    prompt: 'What is the weather in San Francisco?',
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
        if (delta.dynamic) {
          continue;
        }

        const transformedDelta: ToolResultPart = {
          ...delta,
          output: { type: 'json', value: delta.output },
        };
        toolResponses.push(transformedDelta);

        process.stdout.write(
          `\nTool response: '${delta.toolName}' ${JSON.stringify(delta.output)}`,
        );
        toolResponseAvailable = true;
        break;
      }

      case 'error': {
        console.log(`\nError: ${delta.error}`);
        break;
      }
    }
  }

  messages.push({
    role: 'assistant',
    content: [{ type: 'text', text: fullResponse }, ...toolCalls],
  });

  if (toolResponses.length > 0) {
    messages.push({ role: 'tool', content: toolResponses });
  }

  toolResponseAvailable = toolCalls.length > 0;
  console.log('Messages:', messages[0].content);

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
