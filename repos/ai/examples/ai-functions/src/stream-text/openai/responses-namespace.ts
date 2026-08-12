import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

/**
 * Demonstrates `namespace` propagation on dispatched function calls.
 * Server-executed tool_search lets OpenAI search across deferred tools
 * and dispatch one - the resulting function_call carries `namespace`
 * identifying which deferred tool the model picked. Surfaces via
 * `providerMetadata.openai.namespace` on the tool-call content part.
 *
 * https://developers.openai.com/api/docs/guides/function-calling#defining-namespaces
 */
run(async () => {
  const result = streamText({
    model: openai.responses('gpt-5.4'),
    prompt: 'What is the current weather in Tokyo?',
    tools: {
      tool_search: openai.tools.toolSearch({ execution: 'server' }),
      get_weather: tool({
        description: 'Get the current weather at a specific location',
        inputSchema: z.object({
          location: z.string(),
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 64,
          condition: 'Partly cloudy',
        }),
        providerOptions: {
          openai: { deferLoading: true },
        },
      }),
    },
  });

  for await (const part of result.stream) {
    if (part.type === 'tool-input-end') {
      console.log(
        `tool-input-end providerMetadata.openai: ${JSON.stringify(part.providerMetadata?.openai)}`,
      );
    } else if (part.type === 'tool-call') {
      console.log(`tool-call ${part.toolName}:`);
      console.log(`  input: ${JSON.stringify(part.input)}`);
      console.log(
        `  providerMetadata.openai: ${JSON.stringify(part.providerMetadata?.openai)}`,
      );
    }
  }
});
