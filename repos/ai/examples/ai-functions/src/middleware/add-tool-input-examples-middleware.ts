import { openai } from '@ai-sdk/openai';
import {
  addToolInputExamplesMiddleware,
  generateText,
  tool,
  wrapLanguageModel,
} from 'ai';
import { z } from 'zod';
import { run } from '../lib/run';

run(async () => {
  const result = await generateText({
    model: wrapLanguageModel({
      model: openai('gpt-4o'),
      middleware: addToolInputExamplesMiddleware({
        prefix: 'Examples:',
        format: (example, index) =>
          `${index + 1}. ${JSON.stringify(example.input)}`,
        remove: true,
      }),
    }),
    tools: {
      weather: tool({
        description: 'Get the weather in a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get the weather for'),
        }),
        inputExamples: [
          { input: { location: 'San Francisco' } },
          { input: { location: 'London' } },
        ],
      }),
    },
    toolChoice: 'required',
    prompt: 'What is the weather in Tokyo?',
  });

  console.log(JSON.stringify(result.request.body, null, 2));
});
