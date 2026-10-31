import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { streamText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: vertexAnthropic('claude-sonnet-4-5'),
    prompt: 'What is the weather in San Francisco?',
    stopWhen: isStepCount(10),
    tools: {
      toolSearch: vertexAnthropic.tools.toolSearchBm25_20251119(),

      get_weather: tool({
        description: 'Get the current weather at a specific location',
        inputSchema: z.object({
          location: z
            .string()
            .describe('The city and state, e.g. San Francisco, CA'),
          unit: z
            .enum(['celsius', 'fahrenheit'])
            .optional()
            .describe('Temperature unit'),
        }),
        execute: async ({ location, unit = 'fahrenheit' }) => ({
          location,
          temperature: unit === 'celsius' ? 18 : 64,
          condition: 'Partly cloudy',
          humidity: 65,
        }),
        providerOptions: {
          anthropic: { deferLoading: true },
        },
      }),

      search_files: tool({
        description: 'Search through files in the workspace',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
          file_types: z
            .array(z.string())
            .optional()
            .describe('Filter by file types'),
        }),
        execute: async ({ query }) => ({
          results: [`Found 3 files matching "${query}"`],
        }),
        providerOptions: {
          anthropic: { deferLoading: true },
        },
      }),

      send_email: tool({
        description: 'Send an email to a recipient',
        inputSchema: z.object({
          to: z.string().describe('Recipient email address'),
          subject: z.string().describe('Email subject'),
          body: z.string().describe('Email body content'),
        }),
        execute: async ({ to, subject }) => ({
          success: true,
          message: `Email sent to ${to} with subject: ${subject}`,
        }),
        providerOptions: {
          anthropic: { deferLoading: true },
        },
      }),
    },
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        console.log(
          `\n\x1b[32m\x1b[1mTool call:\x1b[22m ${chunk.toolName}\x1b[0m`,
        );
        console.log(JSON.stringify(chunk.input, null, 2));
        break;
      }

      case 'tool-result': {
        console.log(
          `\x1b[32m\x1b[1mTool result:\x1b[22m ${chunk.toolName}\x1b[0m`,
        );
        console.log(JSON.stringify(chunk.output, null, 2));
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }

  console.log('\n');
});
