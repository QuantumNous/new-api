import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
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
    model: vertexAnthropic('claude-3-5-sonnet-v2@20241022'),
    maxOutputTokens: 512,
    tools: {
      weather: weatherTool,
    },
    toolChoice: 'required',
    prompt:
      'What is the weather in San Francisco and what attractions should I visit?',
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
