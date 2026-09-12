import { openai } from '@ai-sdk/openai';
import { run } from '../lib/run';

run(async () => {
  const result = await openai('gpt-5-mini').doStream({
    responseFormat: {
      type: 'json',
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
    },
    temperature: 0,
    prompt: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Invent a new holiday and describe its traditions. Output as JSON object.',
          },
        ],
      },
    ],
    includeRawChunks: false,
  });

  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value.type === 'text-delta') {
      process.stdout.write(value.delta);
    }
  }
});
