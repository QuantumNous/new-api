import { googleVertex } from '@ai-sdk/google-vertex';
import { isStepCount, streamText, tool } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: googleVertex('gemini-3.1-pro-preview'),
    stopWhen: isStepCount(5),
    prompt:
      'Search for current San Francisco news, then call ping with "done".',
    tools: {
      google_search: googleVertex.tools.googleSearch({}),
      ping: tool({
        description: 'No-op ping tool.',
        inputSchema: z.object({
          value: z.string(),
        }),
        execute: async ({ value }) => `pong: ${value}`,
      }),
    },
    include: {
      rawChunks: true,
    },
    maxRetries: 0,
  });

  const rawChunks: unknown[] = [];
  for await (const part of result.stream) {
    if (part.type === 'text-delta') {
      process.stdout.write(part.text);
    } else if (part.type === 'raw') {
      rawChunks.push(part.rawValue);
    }
  }

  console.log();
  print('Request body:', (await result.request).body);
  print('Raw response chunks:', rawChunks);
  print('Response metadata:', await result.response);
});
