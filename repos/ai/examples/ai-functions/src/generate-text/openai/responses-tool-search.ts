import { openai } from '@ai-sdk/openai';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.4'),
    prompt: 'What is the weather in San Francisco?',
    stopWhen: isStepCount(10),
    onStepFinish: step => {
      console.log(`\n=== Step Content ===`);
      console.dir(step.content, { depth: Infinity });
      console.log(`\n=== Step Response ===`);
      console.dir(step.response.body, { depth: Infinity });
    },
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

  console.log('\n=== Final Result ===');
  console.log('Text:', result.text);
});
