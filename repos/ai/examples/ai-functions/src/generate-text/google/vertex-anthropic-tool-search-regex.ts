import { vertexAnthropic } from '@ai-sdk/google-vertex/anthropic';
import { generateText, tool, isStepCount } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: vertexAnthropic('claude-sonnet-4-5'),
    prompt: 'Find out weather data in SF',
    stopWhen: isStepCount(10),
    onStepFinish: step => {
      console.log(`\n=== Step Response ===`);
      console.dir(step.response.body, { depth: Infinity });
    },
    tools: {
      toolSearch: vertexAnthropic.tools.toolSearchRegex_20251119(),

      get_temp_data: tool({
        description: 'For a location',
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

  console.log('\n=== Final Result ===');
  console.log('Text:', result.text);
});
