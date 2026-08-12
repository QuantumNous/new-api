import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: openai.responses('gpt-5.4'),
    tools: {
      shell: openai.tools.shell({
        environment: {
          type: 'containerAuto',
        },
      }),
    },
    prompt:
      'Print "Hello from container!" and show the system info using uname -a',
  });

  console.log('Result:', result.text);
});
