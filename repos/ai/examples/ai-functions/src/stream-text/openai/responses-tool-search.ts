import { openai } from '@ai-sdk/openai';
import { streamText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai.responses('gpt-5.4'),
    prompt: 'What is the weather in San Francisco?',
    stopWhen: isStepCount(10),
    tools: {
      toolSearch: openai.tools.toolSearch(),

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
          openai: { deferLoading: true },
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
          openai: { deferLoading: true },
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
          openai: { deferLoading: true },
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
          `TOOL CALL ${chunk.toolName} ${JSON.stringify(chunk.input)}`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `TOOL RESULT ${chunk.toolName} ${JSON.stringify(chunk.output)}`,
        );
        break;
      }

      case 'finish-step': {
        console.log();
        console.log();
        console.log('STEP FINISH');
        console.log('Finish reason:', chunk.finishReason);
        console.log('Usage:', chunk.usage);
        console.log();
        break;
      }

      case 'finish': {
        console.log('FINISH');
        console.log('Finish reason:', chunk.finishReason);
        console.log('Total Usage:', chunk.totalUsage);
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
