import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: openai.responses('gpt-5-nano'),
    tools: {
      code_interpreter: openai.tools.codeInterpreter(),
    },
    prompt:
      'Simulate rolling two dice 10000 times and return the sum of all the results.',
  });

  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'text-delta': {
        process.stdout.write(chunk.text);
        break;
      }

      case 'tool-call': {
        console.log('Tool call:', JSON.stringify(chunk, null, 2));
        break;
      }

      case 'tool-result': {
        console.log('Tool result:', JSON.stringify(chunk, null, 2));
        break;
      }

      case 'error':
        console.error('Error:', chunk.error);
        break;
    }
  }
});
