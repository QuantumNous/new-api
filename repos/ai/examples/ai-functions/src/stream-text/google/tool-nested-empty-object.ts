import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: google('gemini-3-flash-preview'),
    tools: {
      navigate: tool({
        description: 'Navigate to a URL',
        inputSchema: z.object({
          url: z.string().describe('URL to navigate to'),
          launchOptions: z
            .object({})
            .describe('Browser launch options as key-value pairs'),
        }),
      }),
    },
    toolChoice: 'required',
    prompt: 'Navigate to https://example.com with default launch options',
  });

  for await (const part of result.stream) {
    if (part.type === 'tool-call') {
      console.log('Tool call:', part.toolName, part.input);
    }
  }
});
