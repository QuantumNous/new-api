import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result1 = await generateText({
    model: openai.responses('gpt-5.4'),
    tools: {
      shell: openai.tools.shell({
        environment: {
          type: 'containerAuto',
        },
      }),
    },
    prompt: 'Run uname -a',
  });

  console.log('Turn 1:', result1.text);

  const result2 = await generateText({
    model: openai.responses('gpt-5.4'),
    tools: {
      shell: openai.tools.shell({
        environment: {
          type: 'containerAuto',
        },
      }),
    },
    messages: [
      { role: 'user', content: 'Run uname -a' },
      ...result1.responseMessages,
      { role: 'user', content: 'What architecture do you run in?' },
    ],
  });

  console.log('Turn 2:', result2.text);
});
