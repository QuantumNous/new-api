import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const openai = createOpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey: process.env.XAI_API_KEY,
  });

  const result = streamText({
    model: openai('grok-4-1-fast-reasoning'),
    prompt: 'What documents do you have access to?',
    tools: {
      file_search: openai.tools.fileSearch({
        vectorStoreIds: ['vs_example'],
        maxNumResults: 5,
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
        console.log(`\nTool call: ${JSON.stringify(chunk, null, 2)}`);
        break;
      }
      case 'tool-result': {
        console.log(`\nTool result: ${JSON.stringify(chunk, null, 2)}`);
        break;
      }
    }
  }

  console.log();
});
